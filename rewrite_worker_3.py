import re

with open("worker.js", "r") as f:
    content = f.read()

# Replace executeFulfillmentPipeline body for scrape and finalize
start_marker = "        // Execute Scraping Logic (Mocked external API call)"
end_marker = "        return new Response(JSON.stringify({ status: \"fulfilled\", count: cleanLeads.length, dropped: droppedCount }), {"

old_chunk = content[content.find(start_marker):content.find(end_marker) + len("        return new Response(JSON.stringify({ status: \"fulfilled\", count: cleanLeads.length, dropped: droppedCount }), {")]

new_chunk = """        // Execute Scraping Logic (Mocked external API call)
        let scrapedLeads = [];
        let scrapeResult = {};
        try {
          const opts = { userEmail, payment_intent: session.payment_intent };
          const extractionPromise = executeScrape(env.SCRAPING_API_KEY, filters, env, ctx, session_id, null, request, opts);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), 25000)
          );
          scrapeResult = await Promise.race([extractionPromise, timeoutPromise]);
          scrapedLeads = scrapeResult.data || [];
        } catch (scrapeError) {
          // Upstream API Fail-Safe Refunds
          ctx.waitUntil(
              fetch('https://api.stripe.com/v1/refunds', {
                  method: 'POST',
                  headers: {
                      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
                      'Content-Type': 'application/x-www-form-urlencoded',
                      'Idempotency-Key': crypto.randomUUID()
                  },
                  body: newSearchParams({ // Fix: Use URLSearchParams
                      payment_intent: session.payment_intent
                  })
              }).catch(err => console.error("Failed to initiate Stripe refund", err))
          );

          const refundEmailHtml = `<h1>Extraction Failed</h1><p>An upstream network fault prevented your extraction. A full refund of $29.00 has been initiated.</p>`;
          ctx.waitUntil(
              (async () => {
              try {
                  const response = await fetch('https://api.emailit.com/v1/send', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${env.EMAILIT_API_KEY}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          to: [{ email: userEmail }],
                          subject: `Refund Initiated: Network Fault`,
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

          ctx.waitUntil(safeExecuteWithTelemetry('upstreamFaultRefund', () => Promise.resolve(), env, { session_id, status: 'REFUNDED_DUE_TO_UPSTREAM_FAULT' }));

          throw scrapeError;
        }

        let finalStatus = { status: "processing", count: scrapedLeads.length };

        if (!scrapeResult.hasNextPage) {
            finalStatus = await finalizeFulfillmentPipeline(ctx, env, session_id, userEmail, filters, scrapedLeads, edgeContext);
        }

        return new Response(JSON.stringify(finalStatus), {"""

# Fix the missing URLSearchParams
new_chunk = new_chunk.replace("newSearchParams({", "new URLSearchParams({")

content = content.replace(old_chunk, new_chunk)


# Also update the continue-scrape endpoint to conditionally call finalize
old_continue = """            ctx.waitUntil(
                (async () => {
                    try {
                        await executeScrape(env.SCRAPING_API_KEY, filters, env, ctx, session_id, cursor, request);
                    } catch (err) {
                        console.error("Continued scrape failed", err);
                    }
                })()
            );"""

new_continue = """            ctx.waitUntil(
                (async () => {
                    try {
                        const opts = body.opts || {};
                        const scrapeResult = await executeScrape(env.SCRAPING_API_KEY, filters, env, ctx, session_id, cursor, request, opts);

                        if (!scrapeResult.hasNextPage && opts.userEmail) {
                            await finalizeFulfillmentPipeline(ctx, env, session_id, opts.userEmail, filters, scrapeResult.data, edgeContext);
                        }
                    } catch (err) {
                        console.error("Continued scrape failed", err);
                    }
                })()
            );"""

content = content.replace(old_continue, new_continue)


with open("worker.js", "w") as f:
    f.write(content)

print("worker.js partial update 3 complete")
