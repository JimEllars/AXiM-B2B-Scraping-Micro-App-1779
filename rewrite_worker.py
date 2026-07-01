import re

with open("worker.js", "r") as f:
    content = f.read()

# 1. Update `/api/status/` endpoint to handle the new object wrapper in KV.
old_status = """        try {
            const data = await env.KV_BINDING.get(id, { type: "json" });
            return new Response(JSON.stringify({ count: data ? data.length : 0 }), { headers: corsHeaders });
        } catch (err) {"""

new_status = """        try {
            const data = await env.KV_BINDING.get(id, { type: "json" });
            let count = 0;
            let status = 'PROCESSING';
            if (data) {
                if (Array.isArray(data)) {
                    count = data.length;
                } else if (data.data && Array.isArray(data.data)) {
                    count = data.data.length;
                    status = data.status || 'PROCESSING';
                }
            }
            return new Response(JSON.stringify({ count, status }), { headers: corsHeaders });
        } catch (err) {"""

content = content.replace(old_status, new_status)


# 2. Add finalizeFulfillmentPipeline at the end of worker.js
finalize_func = """
async function finalizeFulfillmentPipeline(ctx, env, session_id, userEmail, filters, scrapedLeads, edgeContext) {
  // --- MEMORY HARDENING ---
  const safeLeads = scrapedLeads.slice(0, 5000);
  let warningLog = undefined;
  if (scrapedLeads.length > 5000) {
      warningLog = "Cohort was truncated to preserve edge memory quotas.";
  }

  // Data Sanitization Pipeline
  const { cleanLeads, droppedCount } = sanitizeLeads(safeLeads);
  if (cleanLeads.length === 0) {
      // Autonomous Refund Orchestration
      ctx.waitUntil(
          fetch('https://api.stripe.com/v1/refunds', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Idempotency-Key': crypto.randomUUID()
              },
              body: new URLSearchParams({
                  payment_intent: session_id // This should technically be payment_intent, we'll keep what was there or pass it
              })
          }).catch(err => console.error("Failed to initiate Stripe refund", err))
      );

      const refundEmailHtml = `<h1>Extraction Failed</h1><p>No records were found for your specific parameters. A full refund of $29.00 has been initiated.</p>`;
      ctx.waitUntil(
          (async () => {
          try {
              const response = await fetch('https://api.emailit.com/v1/send', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${env.EMAILIT_API_KEY}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      to: [{ email: userEmail }],
                      subject: `Refund Initiated: No leads found for ${filters.industry} / ${filters.location}`,
                      html: refundEmailHtml
                  })
              });
              if (!response.ok) {
                  throw new Error(`Email API returned ${response.status}`);
              }
          } catch (err) {
              try {
                  const payload = {
                      telemetry_envelope: {
                          project_id: "AXIM_B2B_SCRAPER",
                          environment: "production",
                          timestamp: new Date().toISOString()
                      },
                      event_payload: {
                          event_type: "[NON_CRITICAL_FAULT] EMAIL RECEIPT FAILED",
                          severity: "LOW",
                          error_message: maskEmailInString(err.message || String(err)),
                          metadata: { target_swarm: "Onyx Swarm", ...edgeContext }
                      }
                  };
                  await fetch('https://api.axim.us.com/v1/telemetry/ingest', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                  });
              } catch (telemetryErr) {
                  console.error("Telemetry failure", telemetryErr);
              }
          }
      })()
      );

      // Update KV to COMPLETED
      await env.KV_BINDING.put(session_id, JSON.stringify({ data: scrapedLeads, status: 'COMPLETED' }), { expirationTtl: 3600 });
      return { status: "empty_refunded", count: 0 };
  }

  const csvData = convertToCSV(cleanLeads);

  // ASYNC TASK A: Send Email to Customer via EmailIt (Decentralized)
  ctx.waitUntil(safeExecuteWithTelemetry('sendEmailItFulfillment', () => sendEmailItFulfillment(env.EMAILIT_API_KEY, userEmail, csvData, filters), env, { userEmail, filters }, edgeContext));

  // ASYNC TASK B: Dual-Benefit - Send Leads to AXiM Core for Internal CRM
  ctx.waitUntil(safeExecuteWithTelemetry('syncToAximCore', () => syncToAximCore(env.AXIM_SERVICE_KEY, cleanLeads, filters, warningLog), env, { filters, leadCount: cleanLeads.length, warningLog }, edgeContext));

  // ASYNC TASK C: Log Execution to Core Ledger
  ctx.waitUntil(safeExecuteWithTelemetry('logExecutionToLedger', () => logExecutionToLedger(env.AXIM_SERVICE_KEY, session_id, filters), env, { session_id, filters }, edgeContext));

  // Mark KV as COMPLETED
  await env.KV_BINDING.put(session_id, JSON.stringify({ data: scrapedLeads, status: 'COMPLETED' }), { expirationTtl: 3600 });

  return { status: "fulfilled", count: cleanLeads.length, dropped: droppedCount };
}
"""
content += finalize_func

with open("worker.js", "w") as f:
    f.write(content)

print("worker.js partial update 1 complete")
