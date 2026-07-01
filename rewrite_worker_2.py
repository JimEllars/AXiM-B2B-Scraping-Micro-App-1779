import re

with open("worker.js", "r") as f:
    content = f.read()

# 3. Update executeScrape
old_scrape = """async function executeScrape(apiKey, filters, env, ctx, session_id, cursor = null, request) {
  try {
    // 1. Initialize State from KV
    let currentCohort = [];
    if (session_id) {
        currentCohort = await env.KV_BINDING.get(session_id, { type: "json" }) || [];
    }"""

new_scrape = """async function executeScrape(apiKey, filters, env, ctx, session_id, cursor = null, request, opts = {}) {
  try {
    // 1. Initialize State from KV
    let currentCohort = [];
    let kvData = null;
    if (session_id) {
        kvData = await env.KV_BINDING.get(session_id, { type: "json" });
        if (kvData) {
            if (Array.isArray(kvData)) {
                currentCohort = kvData;
            } else if (kvData.data && Array.isArray(kvData.data)) {
                currentCohort = kvData.data;
            }
        }
    }"""
content = content.replace(old_scrape, new_scrape)


old_save = """    // 3. Save State
    currentCohort = currentCohort.concat(scrapedItems);
    if (session_id && currentCohort.length > 0) {
        // Save the updated array back to KV store, expiring in 1 hour
        await env.KV_BINDING.put(session_id, JSON.stringify(currentCohort), { expirationTtl: 3600 });
    }

    // 4. Check for Next Page and Self-Trigger
    // Assuming Apify returns 'has_next_page' and 'next_cursor' in the response metadata (or similar pattern)
    // For arrays returned directly, we might need to rely on the length == limit. Here we implement a theoretical 'next_cursor'
    let nextCursor = data.next_cursor || (scrapedItems.length === 50 ? (cursor ? cursor + 50 : 50) : null);
    // If the API directly returns an array we use pagination logic above. If it returns an object, we use data.next_cursor

    if (nextCursor && session_id) {
        // Trigger self asynchronously
        const selfUrl = new URL(request.url);
        selfUrl.pathname = '/api/continue-scrape';

        ctx.waitUntil(
            fetch(selfUrl.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': env.FRONTEND_URL || 'http://localhost:5173'
                },
                body: JSON.stringify({ session_id, cursor: nextCursor, filters, opts })
            }).catch(err => console.error("Failed to self-trigger continue scrape", err))
        );
    }

    return currentCohort;"""

new_save = """    // 4. Check for Next Page and Self-Trigger
    // Assuming Apify returns 'has_next_page' and 'next_cursor' in the response metadata (or similar pattern)
    // For arrays returned directly, we might need to rely on the length == limit. Here we implement a theoretical 'next_cursor'
    let nextCursor = data.next_cursor || (scrapedItems.length === 50 ? (cursor ? cursor + 50 : 50) : null);
    // If the API directly returns an array we use pagination logic above. If it returns an object, we use data.next_cursor

    // 3. Save State
    currentCohort = currentCohort.concat(scrapedItems);
    if (session_id && currentCohort.length > 0) {
        // Save the updated array back to KV store, expiring in 1 hour. Keep status as PROCESSING unless it's the end.
        const saveStatus = nextCursor ? 'PROCESSING' : 'COMPLETED'; // If no next cursor, it will be finalized soon.
        await env.KV_BINDING.put(session_id, JSON.stringify({ data: currentCohort, status: saveStatus }), { expirationTtl: 3600 });
    }

    if (nextCursor && session_id) {
        // Trigger self asynchronously
        const selfUrl = new URL(request.url);
        selfUrl.pathname = '/api/continue-scrape';

        ctx.waitUntil(
            fetch(selfUrl.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': env.FRONTEND_URL || 'http://localhost:5173'
                },
                body: JSON.stringify({ session_id, cursor: nextCursor, filters, opts })
            }).catch(err => console.error("Failed to self-trigger continue scrape", err))
        );
    }

    return { data: currentCohort, hasNextPage: !!nextCursor };"""
content = content.replace(old_save, new_save)


with open("worker.js", "w") as f:
    f.write(content)

print("worker.js partial update 2 complete")
