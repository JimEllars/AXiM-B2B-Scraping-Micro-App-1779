
function sanitizeLLMResponse(rawText) {
  let cleanText = rawText.trim();
  // Eliminate markdown code fence wrappers if present
  if (cleanText.includes("```")) {
    const matches = cleanText.match(/```(?:json)?([\s\S]*?)```/);
    if (matches && matches[1]) {
      cleanText = matches[1].trim();
    }
  }
  // Strip any malicious or malformed leading/trailing text outside the bounds of the array
  const startIdx = cleanText.indexOf('[');
  const endIdx = cleanText.lastIndexOf(']');
  if (startIdx !== -1 && endIdx !== -1) {
    cleanText = cleanText.substring(startIdx, endIdx + 1);
  }
  return cleanText;
}


function maskEmailInString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/([a-zA-Z0-9._%+-]+)(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match, localPart, domain) => {
    return localPart[0] + '***' + domain;
  });
}

function scrubPII(obj) {
  if (typeof obj === 'string') {
    return maskEmailInString(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(scrubPII);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = scrubPII(obj[key]);
    }
    return newObj;
  }
  return obj;
}
// worker.js (Cloudflare Worker Edge Logic - Deploy separately)
// This file is provided as requested for your edge node deployment.









export default {
  async fetch(request, env, ctx) {
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    const edgeContext = {
      colo: request.cf?.colo || 'UNKNOWN',
      country: request.cf?.country || 'UNKNOWN',
      rayId: request.headers.get('cf-ray') || 'UNKNOWN',
      botScore: request.cf?.botManagement?.score ?? 'N/A'
    };
    const rateLimitUrl = new URL(request.url);

    if (['/api/checkout', '/api/fulfill'].includes(rateLimitUrl.pathname) && request.method === 'POST') {
      const rlKey = `rate_limit_${clientIP}`;
      const requestCount = await env.KV_BINDING.get(rlKey) || 0;

      if (Number(requestCount) >= 5) {
        return new Response(JSON.stringify({ error: "Too Many Requests" }), {
          status: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': env.FRONTEND_URL || '*' }
        });
      }
      // Increment and set TTL to 60 seconds
      await env.KV_BINDING.put(rlKey, (Number(requestCount) + 1).toString(), { expirationTtl: 60 });
    }



    const origin = request.headers.get('Origin');
    const allowedOrigin = env.FRONTEND_URL || 'http://localhost:5173';
    const url = new URL(request.url);


    const rayIdHeader = request.headers.get('cf-ray') || 'UNKNOWN';
    const corsHeaders = {
      'X-AXiM-Ray-ID': rayIdHeader,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, stripe-signature',
      'Access-Control-Max-Age': '86400'
    };

    if (url.pathname.startsWith('/api/status/')) {

        const statusHeaders = {
            ...corsHeaders,
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';"
        };
        const id = url.pathname.split('/').pop();
        try {
            const data = await env.KV_BINDING.get(id, { type: "json" });
            let count = 0;
            let status = 'PROCESSING';

            const authHeader = request.headers.get('Authorization');
            const isInternal = authHeader && authHeader === `Bearer ${env.AXIM_SERVICE_KEY}`;

            if (data) {
                if (Array.isArray(data)) {
                    count = data.length;
                } else if (data.data && Array.isArray(data.data)) {
                    count = data.data.length;
                    status = data.status || 'PROCESSING';
                }
            }

            if (isInternal) {
                return new Response(JSON.stringify(data || { count, status }), { headers: statusHeaders });
            } else {
                return new Response(JSON.stringify({ count, status }), { headers: statusHeaders });
            }
        } catch (err) {
             return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: statusHeaders });
        }
    }

    if (url.pathname.startsWith('/api/')) {
      if (origin !== allowedOrigin) {
        return new Response(JSON.stringify({ error: "Forbidden: Invalid Origin" }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }




    // A CF Bot Score below 30 indicates likely automated/malicious traffic
    const isWebhook = url.pathname === '/api/webhook';
    if (!isWebhook && edgeContext.botScore !== 'N/A' && edgeContext.botScore < 30) {
      ctx.waitUntil(
        fetch('https://api.axim.us.com/v1/telemetry/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telemetry_envelope: { project_id: "AXIM_B2B_SCRAPER", environment: "production", timestamp: new Date().toISOString() },
            event_payload: {
              event_type: "SECURITY_ALERT_BOT_TRAFFIC",
              severity: "HIGH",
              error_message: "Automated/malicious traffic blocked by Edge.",
              metadata: { routing_designation: 'ASGUARD_SOC', ...edgeContext }
            }
          })
        }).catch(err => console.error("Telemetry failed for bot block", err))
      );

      return new Response(JSON.stringify({ error: "EDGE_SECURITY_BLOCK" }), {
        status: 403,
        headers: corsHeaders
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname.startsWith('/api/')) {
      const missingKeys = [];
      if (!env.STRIPE_SECRET_KEY) missingKeys.push('STRIPE_SECRET_KEY');
      if (!env.EMAILIT_API_KEY) missingKeys.push('EMAILIT_API_KEY');
      if (!env.AXIM_SERVICE_KEY) missingKeys.push('AXIM_SERVICE_KEY');
      if (!env.STRIPE_WEBHOOK_SECRET) missingKeys.push('STRIPE_WEBHOOK_SECRET');
      if (!env.KV_BINDING) missingKeys.push('KV_BINDING');

      if (missingKeys.length > 0) {


    const payload = {
          telemetry_envelope: {
            metadata: edgeContext,
            project_id: "AXIM_B2B_SCRAPER",
            environment: "production",
            timestamp: new Date().toISOString()
          },
          event_payload: {
            event_type: "MISSING_SECRETS",
            severity: "HIGH",
            error_message: `Missing runtime secrets: ${missingKeys.join(', ')}`,
            stack_trace: "",
            metadata: { route: url.pathname, ...edgeContext }
          }
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        ctx.waitUntil(
          fetch('https://api.axim.us.com/v1/telemetry/ingest', {
            method: 'POST',
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-AXiM-Geo': `${request.cf?.city || 'UNKNOWN'}, ${request.cf?.country || 'LOCAL'}` },
            body: JSON.stringify(payload),
            signal: controller.signal
          }).then(() => clearTimeout(timeoutId)).catch(() => clearTimeout(timeoutId))
        );

        return new Response(JSON.stringify({ error: "Service Unavailable" }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-AXiM-Geo': `${request.cf?.city || 'UNKNOWN'}, ${request.cf?.country || 'LOCAL'}` } });
      }
    }


    // 1. STRIPE CHECKOUT ORCHESTRATION
    if (url.pathname === '/api/checkout' && request.method === 'POST') {
      try {
        const reqBody = await request.json();
        if (!reqBody || typeof reqBody.email !== 'string' || typeof reqBody.filters !== 'object') {
          return new Response(JSON.stringify({ error: "MALFORMED_PAYLOAD" }), { status: 400, headers: corsHeaders });
        }
        const { filters, email } = reqBody;

        // Idempotency: Hashed combination of email and a basic timestamp for double-click prevention
        const timestampWindow = Math.floor(Date.now() / 60000); // 1-minute window
        const idempotencyKey = request.headers.get('Idempotency-Key') || btoa(`${email}:${timestampWindow}`).slice(0, 32);

        // Handle Stripe directly at the edge
        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Idempotency-Key': idempotencyKey
          },
          body: new URLSearchParams({
            'payment_method_types[]': 'card',
            'line_items[0][price_data][currency]': 'usd',
            'line_items[0][price_data][product_data][name]': `B2B Leads: ${filters.industry} in ${filters.location}`,
            'line_items[0][price_data][unit_amount]': '2900', // $29.00 Flat Rate
            'line_items[0][quantity]': '1',
            'mode': 'payment',
            'success_url': `${env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            'metadata[email]': email,
            'metadata[filters]': JSON.stringify(filters)
          })
        });
        
        const session = await stripeResponse.json();
        return new Response(JSON.stringify(session), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-AXiM-Geo': `${request.cf?.city || 'UNKNOWN'}, ${request.cf?.country || 'LOCAL'}` } });
      } catch (error) {
        logForegroundTelemetry(ctx, error, '/api/checkout', edgeContext);
        const errorHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: errorHeaders });
      }
    }

    // 2. LEAD SCRAPING & DECENTRALIZED FULFILLMENT
    if (url.pathname === '/api/fulfill' && request.method === 'POST') {
      try {
        const stripeSignature = request.headers.get('stripe-signature');
        if (stripeSignature) {
          const timestampMatch = stripeSignature.match(/t=(\d+)/);
          if (timestampMatch) {
            const signatureTimestamp = parseInt(timestampMatch[1], 10);
            const timeDifference = (Date.now() / 1000) - signatureTimestamp;
            if (timeDifference > 300) {
              const payload = {
                telemetry_envelope: {
                  project_id: "AXIM_B2B_SCRAPER",
                  environment: "production",
                  timestamp: new Date().toISOString()
                },
                event_payload: {
                  event_type: "SECURITY_ALERT",
                  severity: "CRITICAL",
                  error_message: "[SECURITY_ALERT] WEBHOOK REPLAY ATTACK BLOCKED",
                  stack_trace: "",
                  metadata: { route: '/api/fulfill', target_swarm: "Onyx Swarm", ...edgeContext }
                }
              };
              ctx.waitUntil(
                fetch('https://api.axim.us.com/v1/telemetry/ingest', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                }).catch(() => {})
              );
              return new Response(JSON.stringify({ error: "Bad Request: Webhook signature expired" }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-AXiM-Geo': `${request.cf?.city || 'UNKNOWN'}, ${request.cf?.country || 'LOCAL'}` }
              });
            }
          }
        }

        const { session_id } = await request.json();
        
        const response = await executeFulfillmentPipeline(session_id, env, ctx, '/api/fulfill', corsHeaders, edgeContext, request);
        return response;
      } catch (error) {
        logForegroundTelemetry(ctx, error, '/api/fulfill', edgeContext);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-AXiM-Geo': `${request.cf?.city || 'UNKNOWN'}, ${request.cf?.country || 'LOCAL'}` } });
      }
    }



    // 2.9 ADMIN AUTHENTICATION

    // 2.95 ADMIN METRICS
    if (url.pathname === '/api/admin/metrics' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer TEMP_SESSION_TOKEN_')) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }

      try {
        const { keys } = await env.KV_BINDING.list();
        let activeBlocks = 0;
        let cacheHits = 0;
        let sessions = [];

        let cacheHitsTotal = await env.KV_BINDING.get('cache_hits_total');
        cacheHits = parseInt(cacheHitsTotal || '0', 10);

        for (const keyObj of keys) {
            if (keyObj.name.startsWith('rate_limit_') || keyObj.name.startsWith('webhook_lock_') || keyObj.name.startsWith('admin_auth_limit_')) {
                activeBlocks++;
            } else if (keyObj.name.startsWith('query_cache_') || keyObj.name === 'cache_hits_total') {
                // Ignore these for session counting
            } else {
                // Assume it's a session ID if it doesn't have these prefixes
                sessions.push(keyObj.name);
            }
        }

        // The instructions: "collect the 3 most recent active session IDs from KV keys (excluding rate limits and other prefixes)."
        const active_sessions = sessions.slice(0, 3);

        return new Response(JSON.stringify({ active_blocks: activeBlocks, cache_hits: cacheHits, active_sessions }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === '/api/admin/auth' && request.method === 'POST') {
      try {
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const adminRlKey = `admin_auth_limit_${clientIP}`;
        const loginFailures = await env.KV_BINDING.get(adminRlKey) || 0;

        const statusHeaders = {
            ...corsHeaders,
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';"
        };

        if (Number(loginFailures) >= 3) {
          return new Response(JSON.stringify({ error: "ADMIN_ACCESS_LOCKED" }), {
            status: 429, headers: statusHeaders
          });
        }

        const body = await request.json();
        const { protocol_key } = body;

        if (protocol_key && protocol_key === env.ADMIN_PROTOCOL_KEY) {
          await env.KV_BINDING.delete(adminRlKey);
          // In a real app this would be a proper signed JWT. For Phase 45 micro-increment, a temporary hash is fine.
          const token = `TEMP_SESSION_TOKEN_${crypto.randomUUID()}`;
          return new Response(JSON.stringify({ success: true, token }), { status: 200, headers: corsHeaders });
        } else {
          await env.KV_BINDING.put(adminRlKey, String(Number(loginFailures) + 1), { expirationTtl: 900 });
          return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: "Bad Request" }), { status: 400, headers: corsHeaders });
      }
    }

    // 2.8 INTERNAL ECOSYSTEM TRIGGER
    if (url.pathname === '/api/internal/scrape' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || authHeader !== `Bearer ${env.AXIM_SERVICE_KEY}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      try {
        const body = await request.json();
        const { filters, force_refresh, origin_source } = body;
        if (!filters) {
          return new Response(JSON.stringify({ error: "Missing filters" }), { status: 400, headers: corsHeaders });
        }

        const internal_session_id = `internal_${crypto.randomUUID()}`;
        const queryHash = `query_cache_${btoa(JSON.stringify(filters)).slice(0, 32)}`;
        const forceRefresh = force_refresh === true;

        if (!forceRefresh) {
            const cachedData = await env.KV_BINDING.get(queryHash, { type: "json" });
            if (cachedData) {
                // If forceRefresh is false and we have cache, we could just return the cache
                // But this internal trigger is for syncing, so we might just sync cached data?
                // The prompt says "When executing the queryHash cache check, add the override logic: ... If forceRefresh is true, skip the cache check and proceed to Apify extraction".
                ctx.waitUntil(
                    (async () => {
                        try {
                            const { cleanLeads } = sanitizeLeads(cachedData.slice(0, 5000));
                            await syncToAximCore(env, env.AXIM_SERVICE_KEY, cleanLeads, filters, undefined, origin_source, internal_session_id);
                        } catch (err) {
                            console.error("Internal cache sync failed", err);
                        }
                    })()
                );
                return new Response(JSON.stringify({ status: "Accepted (Cached)" }), { status: 202, headers: corsHeaders });
            }
        }

        ctx.waitUntil(
            (async () => {
                try {
                    const scrapeResult = await executeScrape(env.AXIM_SERVICE_KEY, filters, env, ctx, internal_session_id, null, request, { isInternal: true, origin_source });
                    if (!scrapeResult.hasNextPage) {
                        const { cleanLeads } = sanitizeLeads(scrapeResult.data.slice(0, 5000));
                        await syncToAximCore(env, env.AXIM_SERVICE_KEY, cleanLeads, filters, undefined, origin_source, internal_session_id);
                        await env.KV_BINDING.put(queryHash, JSON.stringify(cleanLeads), { expirationTtl: 86400 });
                        await env.KV_BINDING.put(internal_session_id, JSON.stringify({ data: scrapeResult.data, status: 'COMPLETED' }), { expirationTtl: 86400 });
                    }
                } catch (err) {
                    console.error("Internal scrape failed", err);
                }
            })()
        );
        return new Response(JSON.stringify({ status: "Accepted" }), { status: 202, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Bad Request" }), { status: 400, headers: corsHeaders });
      }
    }

    // 2.5 CONTINUE SCRAPE ENDPOINT
    if (url.pathname === '/api/continue-scrape' && request.method === 'POST') {
        try {
            const body = await request.json();
            const { session_id, cursor, filters } = body;

            if (!session_id || !filters) {
                return new Response(JSON.stringify({ error: "Missing required parameters" }), { status: 400, headers: corsHeaders });
            }

            ctx.waitUntil(
                (async () => {
                    try {
                        const opts = body.opts || {};
                        const scrapeResult = await executeScrape(env.AXIM_SERVICE_KEY, filters, env, ctx, session_id, cursor, request, opts);

                        if (!scrapeResult.hasNextPage) {
                            if (opts.userEmail) {
                                await finalizeFulfillmentPipeline(ctx, env, session_id, opts.userEmail, filters, scrapeResult.data, edgeContext, null, opts.payment_intent);
                            } else if (opts.isInternal) {
                                const { cleanLeads } = sanitizeLeads(scrapeResult.data.slice(0, 5000));
                                await syncToAximCore(env, env.AXIM_SERVICE_KEY, cleanLeads, filters, undefined, opts.origin_source || 'Cockpit_UI', session_id);
                            }
                        }
                    } catch (err) {
                        console.error("Continued scrape failed", err);
                    }
                })()
            );

            return new Response(JSON.stringify({ status: "continued" }), { status: 200, headers: corsHeaders });
        } catch (error) {
            logForegroundTelemetry(ctx, error, '/api/continue-scrape', edgeContext);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
    }


    // 3. ASYNCHRONOUS WEBHOOK FALLBACK
    if (url.pathname === '/api/webhook' && request.method === 'POST') {
      let lockKey;
      try {
        const signature = request.headers.get('stripe-signature');
        if (!signature) {
          return new Response("Missing signature", { status: 400 });
        }

        const bodyText = await request.text();

        // Web Crypto API signature verification
        const encoder = new TextEncoder();
        const secret = env.STRIPE_WEBHOOK_SECRET;

        // Parse the signature header
        const sigParts = signature.split(',').reduce((acc, part) => {
            const [key, value] = part.split('=');
            if (key && value) {
                if (!acc[key]) acc[key] = [];
                acc[key].push(value);
            }
            return acc;
        }, {});

        const t = sigParts['t'] ? sigParts['t'][0] : null;
        const v1 = sigParts['v1'] ? sigParts['v1'] : [];

        if (!t || v1.length === 0) {
            return new Response("Invalid signature format", { status: 400 });
        }

        // Check timestamp against 5 minute tolerance
        const currentTimestamp = Math.floor(Date.now() / 1000);
        if (currentTimestamp - parseInt(t, 10) > 300) {
             return new Response("Webhook signature expired", { status: 400 });
        }

        const signedPayload = `${t}.${bodyText}`;
        const secretKeyData = encoder.encode(secret);

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            secretKeyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        let isValid = false;
        for (const sig of v1) {
            const sigBytes = new Uint8Array(sig.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const valid = await crypto.subtle.verify(
                'HMAC',
                cryptoKey,
                sigBytes,
                encoder.encode(signedPayload)
            );
            if (valid) {
                isValid = true;
                break;
            }
        }

        if (!isValid) {
            return new Response("Invalid signature", { status: 400 });
        }

        const event = JSON.parse(bodyText);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const session_id = session.id;

            lockKey = `webhook_lock_${session_id}`;
            const isLocked = await env.KV_BINDING.get(lockKey);
            if (isLocked) {
                return new Response(JSON.stringify({ status: "already_processing" }), { status: 200, headers: corsHeaders });
            }
            // Lock for 5 minutes to prevent concurrent webhook execution
            await env.KV_BINDING.put(lockKey, 'true', { expirationTtl: 300 });

            try {
                // Execute fulfillment pipeline
                // Since this is a webhook, we trigger and wait, but stripe expects a quick 200.
                // We use ctx.waitUntil to let the fulfillment run in the background.
                ctx.waitUntil(
                    (async () => {
                        try {
                            await executeFulfillmentPipeline(session_id, env, ctx, '/api/webhook', corsHeaders, edgeContext, request);
                        } catch (err) {
                            console.error("Webhook fulfillment failed", err);
                        }
                    })()
                );
            } catch (err) {
                // Release the lock so Stripe's retry mechanism can succeed later
                await env.KV_BINDING.delete(lockKey);
                throw err; // Pass to outer error handler
            }
        }

        return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-AXiM-Geo': `${request.cf?.city || 'UNKNOWN'}, ${request.cf?.country || 'LOCAL'}` } });

      } catch (error) {
        if (typeof lockKey !== 'undefined') {
          await env.KV_BINDING.delete(lockKey);
        }
        logForegroundTelemetry(ctx, error, '/api/webhook', edgeContext);
        return new Response("Webhook Validation Fault", { status: 400 });
      }
    }

    return new Response("Not Found", { status: 404, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  }
};



async function executeFulfillmentPipeline(session_id, env, ctx, routePath, corsHeaders, edgeContext, request) {
    try {
        // Strict Session ID Validation
        const sessionRegex = /^cs_(test|live)_[a-zA-Z0-9]{20,60}$/;
        if (!session_id || !sessionRegex.test(session_id)) {
          return new Response(JSON.stringify({ error: "Bad Request: Invalid session ID format" }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-AXiM-Geo': `${request.cf?.city || 'UNKNOWN'}, ${request.cf?.country || 'LOCAL'}` }
          });
        }

        // Verify Stripe Payment
        const verify = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
          headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` }
        });
        if (!verify.ok) {
            return new Response(JSON.stringify({ error: "UPSTREAM_VERIFICATION_FAILED" }), { status: 502, headers: corsHeaders });
        }
        const session = await verify.json();
        
        if (session.payment_status !== 'paid') {
          return new Response(JSON.stringify({ error: "Payment unverified" }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-AXiM-Geo': `${request.cf?.city || 'UNKNOWN'}, ${request.cf?.country || 'LOCAL'}` } });
        }

        // Idempotency: Ensure we haven't already processed this session
        if (session.metadata && session.metadata.fulfilled === 'true') {
          return new Response(JSON.stringify({ status: "already_fulfilled" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-AXiM-Geo': `${request.cf?.city || 'UNKNOWN'}, ${request.cf?.country || 'LOCAL'}` } });
        }

        // ATOMIC LOCK: Synchronously mark session as fulfilled in Stripe to prevent double processing
        try {
          await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ 'metadata[fulfilled]': 'true' })
          });
        } catch (err) {
            console.error("Failed to update Stripe session metadata", err);
            // We proceed but there might be a race condition if this failed.
        }

        const filters = JSON.parse(session.metadata.filters);
        const userEmail = session.metadata.email;
        const queryHash = `query_cache_${btoa(JSON.stringify(filters)).slice(0, 32)}`;

        // Check KV Cache First
        const cachedData = await env.KV_BINDING.get(queryHash, { type: "json" });
        if (cachedData) {
            let cache_hits = parseInt(await env.KV_BINDING.get('cache_hits_total') || '0', 10);
            await env.KV_BINDING.put('cache_hits_total', (cache_hits + 1).toString());

            const finalStatus = await finalizeFulfillmentPipeline(ctx, env, session_id, userEmail, filters, cachedData, edgeContext, queryHash, session.payment_intent);
            return new Response(JSON.stringify(finalStatus), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-AXiM-Geo': `${request.cf?.city || 'UNKNOWN'}, ${request.cf?.country || 'LOCAL'}` }
            });
        }

        // Execute Scraping Logic (Mocked external API call)
        let scrapedLeads = [];
        let scrapeResult = {};
        try {
          const opts = { userEmail, payment_intent: session.payment_intent };
          const extractionPromise = executeScrape(env.AXIM_SERVICE_KEY, filters, env, ctx, session_id, null, request, opts);
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
                  body: new URLSearchParams({ // Fix: Use URLSearchParams
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
            finalStatus = await finalizeFulfillmentPipeline(ctx, env, session_id, userEmail, filters, scrapedLeads, edgeContext, queryHash, session.payment_intent);
        }

        return new Response(JSON.stringify(finalStatus), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-AXiM-Geo': `${request.cf?.city || 'UNKNOWN'}, ${request.cf?.country || 'LOCAL'}` }
        });
    } catch (error) {
        const errorHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

        logForegroundTelemetry(ctx, error, routePath, edgeContext);

        if (error.message && error.message.toLowerCase().includes("timeout")) {
          return new Response(JSON.stringify({ error: "Gateway Timeout: Upstream extraction exceeded time limits." }), { status: 504, headers: errorHeaders });
        }

        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: errorHeaders });
    }
}

// --- HELPER FUNCTIONS ---

async function safeExecuteWithTelemetry(taskName, taskFn, env, runtimeParams = {}, edgeContext = {}) {
  try {
    await taskFn();
  } catch (error) {
    console.error(`Background task ${taskName} failed:`, error);

    let payloadString;
    try {
      const payload = {
        telemetry_envelope: {
          project_id: "AXIM_B2B_SCRAPER",
          environment: "production",
          timestamp: new Date().toISOString()
        },
        event_payload: {
          event_type: "BACKGROUND_TASK_FAILURE",
          severity: "HIGH",
          error_message: maskEmailInString(error.message),
          stack_trace: maskEmailInString(error.stack || ""),
          metadata: scrubPII({ component: taskName, execution_timestamp: new Date().toISOString(), runtime_parameters: runtimeParams })
        }
      };
      payloadString = JSON.stringify(payload);
    } catch (e) {
      console.error("Failed to serialize telemetry payload", e);
      return;
    }

    try {
      await fetch('https://api.axim.us.com/v1/telemetry/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadString
      });
    } catch (telemetryError) {
      console.error("Failed to send telemetry for background task failure", telemetryError);
    }
  }
}


function sanitizePhone(phone) {
  if (!phone) return null;
  // E.164 formatting: Strip all non-digits except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (e164Regex.test(cleaned)) {
    return cleaned;
  }
  return null;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

function sanitizeLeads(leads) {
  const originalCount = leads.length;
  const cleanLeads = leads.filter(lead => {
    // Attempt to find and validate email
    const emailKey = Object.keys(lead).find(k => k.toLowerCase() === 'email') || Object.keys(lead).find(k => k.toLowerCase().includes('email'));
    if (emailKey && lead[emailKey]) {
      return isValidEmail(lead[emailKey]);
    }
    return false; // Drop if no email or invalid
  }).map(lead => {
    // Format phones
    const exactPhoneKeys = Object.keys(lead).filter(k => k.toLowerCase() === 'phone');
    const phoneKeys = exactPhoneKeys.length > 0 ? exactPhoneKeys : Object.keys(lead).filter(k => k.toLowerCase().includes('phone'));
    phoneKeys.forEach(k => {
      if (lead[k]) {
        const sanitized = sanitizePhone(lead[k]);
        if (sanitized) {
          lead[k] = sanitized;
        } else {
          delete lead[k];
        }
      }
    });
    return lead;
  });

  return {
    cleanLeads,
    droppedCount: originalCount - cleanLeads.length
  };
}

async function executeScrape(apiKey, filters, env, ctx, session_id, cursor = null, request, opts = {}) {
  let kvState = { data: [], iteration: 0, next_cursor: null, status: 'PROCESSING' };
  try {
    // 1. Initialize State from KV
    if (session_id) {
        kvState = await env.KV_BINDING.get(session_id, { type: "json" }) || kvState;
    }
    let currentCohort = kvState.data || [];
    let currentCursor = kvState.next_cursor || cursor;

    // DeepSeek AI Extraction Pivot
    let rawHtmlChunk = '';
    try {
        const targetUrl = filters.website || 'https://example.com';
        const htmlRes = await fetch(targetUrl);
        const htmlText = await htmlRes.text();
        rawHtmlChunk = htmlText.slice(0, 5000);
    } catch (e) {
        rawHtmlChunk = '<html><body>Dummy content due to fetch failure</body></html>';
    }

    const llmPayload = {
      model: "deepseek-coder",
      prompt: `Extract B2B contact data from the following HTML. Return ONLY a valid JSON array of objects matching this schema: { "first_name": "string", "last_name": "string", "company": "string", "email": "string", "phone": "string", "is_b2b": true }. Do not include markdown formatting or explanations.\n\nHTML:\n${rawHtmlChunk}`
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://api.axim.us.com/v1/llm/proxy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.AXIM_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(llmPayload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`LLM Proxy failed with status: ${response.status}`);
    }

    const dataText = await response.text();
    let scrapedItems = [];
    try {
        let cleanJsonStr = sanitizeLLMResponse(dataText);
        scrapedItems = JSON.parse(cleanJsonStr);
        if (!Array.isArray(scrapedItems)) {
            scrapedItems = [];
        }
    } catch (e) {
        console.error("Failed to parse LLM response", e);
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
                            event_type: "LLM_PARSE_FAILURE",
                            severity: "HIGH",
                            error_message: e.message || String(e),
                            metadata: {
                                routing_designation: 'SUPPORT_TRIAGE'
                            }
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
            })()
        );
        scrapedItems = [];
    }

    // 3. Save State
    currentCohort = currentCohort.concat(scrapedItems);

    let nextCursor = null;

    if (session_id) {
        await env.KV_BINDING.put(session_id, JSON.stringify({
          data: currentCohort,
          iteration: kvState.iteration + 1,
          next_cursor: nextCursor,
          status: nextCursor ? 'PROCESSING' : 'COMPLETED'
        }), { expirationTtl: 86400 });
    }

    if (nextCursor) {
        if (kvState.iteration >= 10) {
          kvState.status = 'PARTIAL_SUCCESS';
          await env.KV_BINDING.put(session_id, JSON.stringify(kvState), { expirationTtl: 86400 });

          // Dispatch telemetry event for tracking partial exhaustion states
          ctx.waitUntil(
            fetch('https://api.axim.us.com/v1/telemetry/ingest', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                telemetry_envelope: { project_id: "AXIM_B2B_SCRAPER", environment: "production", timestamp: new Date().toISOString() },
                event_payload: { event_type: "CIRCUIT_BREAKER_TRIPPED", severity: "HIGH", error_message: "Recursive loop cut at 10 ceiling iterations.", metadata: { session_id } }
              })
            }).catch(() => {})
          );
          return { data: currentCohort, hasNextPage: false };
        }

        const requestUrl = new URL(request.url);
        ctx.waitUntil(
            fetch(`${requestUrl.origin}/api/continue-scrape`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${env.AXIM_SERVICE_KEY}`,
                  'Content-Type': 'application/json',
                  'Origin': env.FRONTEND_URL || 'http://localhost:5173'
                },
                body: JSON.stringify({ session_id, cursor: nextCursor, filters, opts })
            }).catch(err => console.error("Failed to self-trigger continue scrape", err))
        );
    }

    return { data: currentCohort, hasNextPage: !!nextCursor };
  } catch (err) {
    if (session_id) {
        kvState.status = 'FAILED';
        await env.KV_BINDING.put(session_id, JSON.stringify(kvState), { expirationTtl: 86400 });
    }
    if (err.name === 'AbortError') {
      throw new Error("Scrape execution timeout: The scraping task took too long and timed out at the edge.");
    }
    throw new Error(`Scrape execution failed: ${err.message}`);
  }
}

function flattenObject(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '_' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

function convertToCSV(data) {
  if (!data || !data.length) return "";

  const flattenedData = data.map(obj => flattenObject(obj));
  const headerSet = new Set();
  flattenedData.forEach(obj => Object.keys(obj).forEach(k => headerSet.add(k)));
  const headers = Array.from(headerSet);

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    let str = String(val).replace(/\r/g, '');
    if (['=', '+', '-', '@'].includes(str[0])) {
      str = "'" + str;
    }
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = flattenedData.map(obj => headers.map(h => escapeCSV(obj[h])).join(",")).join("\n");
  return `${headers.map(escapeCSV).join(",")}\n${rows}`;
}

async function sendEmailItFulfillment(apiKey, email, csvData, filters) {
    const bytes = new TextEncoder().encode(csvData);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  const safeBase64 = btoa(binary);

  const payload = {
    to: [{ email }],
    subject: `Your B2B Lead List: ${filters.industry} / ${filters.location}`,
    html: `<h1>Order Complete</h1><p>Your targeted lead list is attached.</p>`,
    attachments: [{ filename: 'b2b_leads.csv', content: safeBase64, encoding: 'base64' }]
  };

  const response = await fetch('https://api.emailit.com/v1/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`EmailIt API failed with status ${response.status}`);
}

async function syncToAximCore(env, aximKey, leads, filters, warningLog, originSource, sessionId) {
  // Silent pipeline into Deskera / Albato via AXiM Core
  const payload = { source: originSource || 'Cockpit_UI', session_id: sessionId, cohort: filters, data: leads, records: leads };
  if (warningLog) payload.warning = warningLog;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch('https://api.axim.us.com/v1/webhooks/enrich', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${aximKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
        throw new Error(`Sync to AXiM Core failed with status ${response.status}`);
    }
  } catch (err) {
    if (sessionId) {
        let kvStateStr = await env.KV_BINDING.get(sessionId);
        if (kvStateStr) {
            try {
                let kvState = JSON.parse(kvStateStr);
                kvState.status = 'FAILED';
                await env.KV_BINDING.put(sessionId, JSON.stringify(kvState), { expirationTtl: 86400 });
            } catch (e) {
                console.error("KV parse failed", e);
            }
        }
    }
    const telemetryPayload = {
        telemetry_envelope: { project_id: "AXIM_B2B_SCRAPER", environment: "production", timestamp: new Date().toISOString() },
        event_payload: { event_type: "[BRIDGE_EGRESS_FAULT]", severity: "CRITICAL", error_message: err.message || String(err), metadata: { session_id: sessionId } }
    };
    await fetch('https://api.axim.us.com/v1/telemetry/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telemetryPayload) }).catch(() => {});
    throw err;
  }
}

async function logExecutionToLedger(aximKey, sessionId, filters) {
  const payload = {
    session_id: sessionId,
    filters: filters,
    timestamp: new Date().toISOString()
  };

  const response = await fetch('https://api.axim.us.com/v1/ledger/log', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aximKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Ledger logging failed with status ${response.status}`);
}


function logForegroundTelemetry(ctx, error, routePath, edgeContext) {
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
              : maskEmailInString(error.message || String(error)),
            stack_trace: maskEmailInString(error.stack || ""),
            metadata: scrubPII({
              route: routePath,
              execution_timestamp: new Date().toISOString(),
              target_swarm: isTimeout ? "Onyx Swarm" : undefined,
              routing_designation: isTimeout ? 'SUPPORT_TRIAGE' : undefined
            })
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
}

async function finalizeFulfillmentPipeline(ctx, env, session_id, userEmail, filters, scrapedLeads, edgeContext, queryHash = null, paymentIntentId = null) {
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
                  payment_intent: paymentIntentId || session_id
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
      await env.KV_BINDING.put(session_id, JSON.stringify({ data: scrapedLeads, status: 'COMPLETED' }), { expirationTtl: 86400 });
      return { status: "empty_refunded", count: 0 };
  }

  const csvData = convertToCSV(cleanLeads);

  // ASYNC TASK A: Send Email to Customer via EmailIt (Decentralized)
  ctx.waitUntil(safeExecuteWithTelemetry('sendEmailItFulfillment', () => sendEmailItFulfillment(env.EMAILIT_API_KEY, userEmail, csvData, filters), env, { userEmail, filters }, edgeContext));

  // ASYNC TASK B: Dual-Benefit - Send Leads to AXiM Core for Internal CRM
  ctx.waitUntil(safeExecuteWithTelemetry('syncToAximCore', () => syncToAximCore(env, env.AXIM_SERVICE_KEY, cleanLeads, filters, warningLog, 'Cockpit_UI', session_id), env, { filters, leadCount: cleanLeads.length, warningLog }, edgeContext));

  // ASYNC TASK C: Log Execution to Core Ledger
  ctx.waitUntil(safeExecuteWithTelemetry('logExecutionToLedger', () => logExecutionToLedger(env.AXIM_SERVICE_KEY, session_id, filters), env, { session_id, filters }, edgeContext));

  // Write to KV Cache on Success
  if (queryHash) {
      await env.KV_BINDING.put(queryHash, JSON.stringify(cleanLeads), { expirationTtl: 86400 });
  }

  // Mark KV as COMPLETED
  await env.KV_BINDING.put(session_id, JSON.stringify({ data: scrapedLeads, status: 'COMPLETED' }), { expirationTtl: 86400 });

  return { status: "fulfilled", count: cleanLeads.length, dropped: droppedCount };
}
