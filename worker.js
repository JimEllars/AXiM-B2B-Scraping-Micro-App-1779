
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


// --- RATE LIMITING ---
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, firstRequestTime: now };

  if (now - record.firstRequestTime > RATE_LIMIT_WINDOW_MS) {
    record.count = 1;
    record.firstRequestTime = now;
  } else {
    record.count += 1;
  }

  rateLimitMap.set(ip, record);


  return record.count <= RATE_LIMIT_MAX;
}






export default {
  async fetch(request, env, ctx) {
    if (Math.random() < 0.1) {
      const now = Date.now();
      const cutoff = now - RATE_LIMIT_WINDOW_MS;
      for (const [key, val] of rateLimitMap.entries()) {
        if (val.firstRequestTime < cutoff) {
          rateLimitMap.delete(key);
        }
      }
    }
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    const rateLimitUrl = new URL(request.url);

    if (['/api/checkout', '/api/fulfill'].includes(rateLimitUrl.pathname) && request.method === 'POST') {
      if (!checkRateLimit(clientIP)) {
        return new Response(JSON.stringify({ error: "Too Many Requests" }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': env.FRONTEND_URL || '*' }
        });
      }
    }



    const origin = request.headers.get('Origin');
    const allowedOrigin = env.FRONTEND_URL || 'http://localhost:5173';
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (origin !== allowedOrigin) {
        return new Response(JSON.stringify({ error: "Forbidden: Invalid Origin" }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const corsHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, stripe-signature',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname.startsWith('/api/')) {
      const missingKeys = [];
      if (!env.STRIPE_SECRET_KEY) missingKeys.push('STRIPE_SECRET_KEY');
      if (!env.SCRAPING_API_KEY) missingKeys.push('SCRAPING_API_KEY');
      if (!env.EMAILIT_API_KEY) missingKeys.push('EMAILIT_API_KEY');
      if (!env.AXIM_SERVICE_KEY) missingKeys.push('AXIM_SERVICE_KEY');

      if (missingKeys.length > 0) {
        const payload = {
          telemetry_envelope: {
            project_id: "AXIM_B2B_SCRAPER",
            environment: "production",
            timestamp: new Date().toISOString()
          },
          event_payload: {
            event_type: "MISSING_SECRETS",
            severity: "HIGH",
            error_message: `Missing runtime secrets: ${missingKeys.join(', ')}`,
            stack_trace: "",
            metadata: { route: url.pathname }
          }
        };

        ctx.waitUntil(
          fetch('https://api.axim.us.com/v1/telemetry/ingest', {
            method: 'POST',
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(() => {})
        );

        return new Response(JSON.stringify({ error: "Service Unavailable" }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }


    // 1. STRIPE CHECKOUT ORCHESTRATION
    if (url.pathname === '/api/checkout' && request.method === 'POST') {
      try {
        const { filters, email } = await request.json();
        
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
        return new Response(JSON.stringify(session), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (error) {
        logForegroundTelemetry(ctx, error, '/api/checkout');
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
                  metadata: { route: '/api/fulfill', target_swarm: "Onyx Swarm" }
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
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }
        }

        const { session_id } = await request.json();
        
        // Strict Session ID Validation
        const sessionRegex = /^cs_(test|live)_[a-zA-Z0-9]{20,60}$/;
        if (!session_id || !sessionRegex.test(session_id)) {
          return new Response(JSON.stringify({ error: "Bad Request: Invalid session ID format" }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }


        // Verify Stripe Payment
        const verify = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
          headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` }
        });
        const session = await verify.json();
        
        if (session.payment_status !== 'paid') {
          return new Response(JSON.stringify({ error: "Payment unverified" }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Idempotency: Ensure we haven't already processed this session
        if (session.metadata && session.metadata.fulfilled === 'true') {
          return new Response(JSON.stringify({ status: "already_fulfilled" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Mark session as fulfilled in Stripe to prevent double processing
        ctx.waitUntil(
          fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ 'metadata[fulfilled]': 'true' })
          }).catch(err => console.error("Failed to update Stripe session metadata", err))
        );

        const filters = JSON.parse(session.metadata.filters);
        const userEmail = session.metadata.email;

        // Execute Scraping Logic (Mocked external API call)
        let scrapedLeads = [];
        try {
          const extractionPromise = executeScrape(env.SCRAPING_API_KEY, filters);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), 25000)
          );
          scrapedLeads = await Promise.race([extractionPromise, timeoutPromise]);
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
                  body: new URLSearchParams({
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
                              metadata: { target_swarm: "Onyx Swarm" }
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
                        payment_intent: session.payment_intent
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
                                metadata: { target_swarm: "Onyx Swarm" }
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

            return new Response(JSON.stringify({ status: "empty_refunded", count: 0 }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        const csvData = convertToCSV(cleanLeads);

        // ASYNC TASK A: Send Email to Customer via EmailIt (Decentralized)
        ctx.waitUntil(safeExecuteWithTelemetry('sendEmailItFulfillment', () => sendEmailItFulfillment(env.EMAILIT_API_KEY, userEmail, csvData, filters), env, { userEmail, filters }));

        // ASYNC TASK B: Dual-Benefit - Send Leads to AXiM Core for Internal CRM
        ctx.waitUntil(safeExecuteWithTelemetry('syncToAximCore', () => syncToAximCore(env.AXIM_SERVICE_KEY, cleanLeads, filters, warningLog), env, { filters, leadCount: cleanLeads.length, warningLog }));

        // ASYNC TASK C: Log Execution to Core Ledger
        ctx.waitUntil(safeExecuteWithTelemetry('logExecutionToLedger', () => logExecutionToLedger(env.AXIM_SERVICE_KEY, session_id, filters), env, { session_id, filters }));

        return new Response(JSON.stringify({ status: "fulfilled", count: cleanLeads.length, dropped: droppedCount }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        const errorHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

        logForegroundTelemetry(ctx, error, '/api/fulfill');

        if (error.message && error.message.toLowerCase().includes("timeout")) {
          return new Response(JSON.stringify({ error: "Gateway Timeout: Upstream extraction exceeded time limits." }), { status: 504, headers: errorHeaders });
        }

        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: errorHeaders });
      }
    }

    return new Response("Not Found", { status: 404, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  }
};

// --- HELPER FUNCTIONS ---

async function safeExecuteWithTelemetry(taskName, taskFn, env, runtimeParams = {}) {
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

async function executeScrape(apiKey, filters) {
  try {
    const payload = {
      industry: filters.industry,
      location: filters.location,
      size: filters.size,
      keywords: filters.keywords
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for Edge

    const response = await fetch('https://api.apify.com/v2/actor-tasks/axim-scraper/run-sync-get-dataset-items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Scraper API failed with status: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    return data;
  } catch (err) {
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

async function syncToAximCore(aximKey, leads, filters, warningLog) {
  // Silent pipeline into Deskera / Albato via AXiM Core
  const payload = { source: 'b2b_scraper_microapp', cohort: filters, records: leads };
  if (warningLog) payload.warning = warningLog;

  const response = await fetch('https://api.axim.us.com/v1/internal/leads/ingest', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${aximKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Sync to AXiM Core failed with status ${response.status}`);
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


function logForegroundTelemetry(ctx, error, routePath) {
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
              target_swarm: isTimeout ? "Onyx Swarm" : undefined
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
