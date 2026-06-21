// worker.js (Cloudflare Worker Edge Logic - Deploy separately)
// This file is provided as requested for your edge node deployment.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. STRIPE CHECKOUT ORCHESTRATION
    if (url.pathname === '/api/checkout' && request.method === 'POST') {
      try {
        const { filters, email } = await request.json();
        
        // Handle Stripe directly at the edge
        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded'
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
        return new Response(JSON.stringify(session), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 2. LEAD SCRAPING & DECENTRALIZED FULFILLMENT
    if (url.pathname === '/api/fulfill' && request.method === 'POST') {
      try {
        const { session_id } = await request.json();
        
        // Verify Stripe Payment
        const verify = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
          headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` }
        });
        const session = await verify.json();
        
        if (session.payment_status !== 'paid') {
          return new Response(JSON.stringify({ error: "Payment unverified" }), { status: 402 });
        }

        const filters = JSON.parse(session.metadata.filters);
        const userEmail = session.metadata.email;

        // Execute Scraping Logic (Mocked external API call)
        const scrapedLeads = await executeScrape(env.SCRAPING_API_KEY, filters);
        const csvData = convertToCSV(scrapedLeads);

        // ASYNC TASK A: Send Email to Customer via EmailIt (Decentralized)
        ctx.waitUntil(sendEmailItFulfillment(env.EMAILIT_API_KEY, userEmail, csvData, filters));

        // ASYNC TASK B: Dual-Benefit - Send Leads to AXiM Core for Internal CRM
        ctx.waitUntil(syncToAximCore(env.AXIM_SERVICE_KEY, scrapedLeads, filters));

        // ASYNC TASK C: Log Execution to Core Ledger
        ctx.waitUntil(logExecutionToLedger(env.AXIM_SERVICE_KEY, session_id, filters));

        return new Response(JSON.stringify({ status: "fulfilled", count: scrapedLeads.length }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};

// --- HELPER FUNCTIONS ---

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
      throw new Error("Scraper returned no leads");
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
    const str = String(val);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = flattenedData.map(obj => headers.map(h => escapeCSV(obj[h])).join(",")).join("\n");
  return `${headers.join(",")}\n${rows}`;
}

async function sendEmailItFulfillment(apiKey, email, csvData, filters) {
  const payload = {
    to: [{ email }],
    subject: `Your B2B Lead List: ${filters.industry} / ${filters.location}`,
    html: `<h1>Order Complete</h1><p>Your targeted lead list is attached.</p>`,
    attachments: [{ filename: 'b2b_leads.csv', content: btoa(csvData), encoding: 'base64' }]
  };

  await fetch('https://api.emailit.com/v1/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function syncToAximCore(aximKey, leads, filters) {
  // Silent pipeline into Deskera / Albato via AXiM Core
  await fetch('https://api.axim.us.com/v1/internal/leads/ingest', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${aximKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'b2b_scraper_microapp', cohort: filters, records: leads })
  });
}

async function logExecutionToLedger(aximKey, sessionId, filters) {
  try {
    const payload = {
      session_id: sessionId,
      filters: filters,
      timestamp: new Date().toISOString()
    };

    await fetch('https://api.axim.us.com/v1/ledger/log', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aximKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Ledger logging failed", err);
  }
}
