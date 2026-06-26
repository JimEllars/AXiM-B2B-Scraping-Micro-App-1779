const fs = require('fs');
let code = fs.readFileSync('worker.js', 'utf8');

// Update the catch block in /api/fulfill
const catchBlockRegex = /} catch \(error\) {\s*const errorHeaders = { \.\.\.corsHeaders, 'Content-Type': 'application\/json' };\s*if \(error\.message === "UPSTREAM_TIMEOUT"\) \{[\s\S]*?return new Response\(JSON\.stringify\(\{ error: error\.message \}\), \{ status: 500, headers: errorHeaders \}\);\s*\}/;

const newCatchBlock = `} catch (error) {
        const errorHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

        logForegroundTelemetry(ctx, error, '/api/fulfill');

        if (error.message && error.message.toLowerCase().includes("timeout")) {
          return new Response(JSON.stringify({ error: "Gateway Timeout: Upstream extraction exceeded time limits." }), { status: 504, headers: errorHeaders });
        }

        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: errorHeaders });
      }`;

code = code.replace(catchBlockRegex, newCatchBlock);

// Update logForegroundTelemetry
const telemetryRegex = /function logForegroundTelemetry\(ctx, error, routePath\) \{[\s\S]*?console\.error\("Foreground telemetry dispatch failed", telemetryError\);\s*\}\s*\}\)\(\)\s*\);\s*\}/;

const newTelemetry = `function logForegroundTelemetry(ctx, error, routePath) {
  const isTimeout = error.message && error.message.toLowerCase().includes("timeout");

  ctx.waitUntil(
    (async () => {
      try {
        const payload = {
          telemetry_envelope: {
            project_id: "AXIM_B2B_SCRAPER",
            environment: "production",
            timestamp: new Date().toISOString()
          },
          event_payload: {
            event_type: isTimeout ? "UPSTREAM_TIMEOUT_CRITICAL" : "ROUTE_EXECUTION_FAILURE",
            severity: isTimeout ? "CRITICAL" : "HIGH",
            error_message: isTimeout
              ? "External scraper exceeded edge execution limits (Apify is lagging, not our code)"
              : (error.message || String(error)),
            stack_trace: error.stack || "",
            metadata: {
              route: routePath,
              execution_timestamp: new Date().toISOString(),
              target_swarm: isTimeout ? "Onyx Swarm" : undefined
            }
          }
        };
        await fetch('https://api.axim.us.com/v1/telemetry/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (telemetryError) {
        console.error("Foreground telemetry dispatch failed", telemetryError);
      }
    })()
  );
}`;

code = code.replace(telemetryRegex, newTelemetry);
fs.writeFileSync('worker.js', code);
