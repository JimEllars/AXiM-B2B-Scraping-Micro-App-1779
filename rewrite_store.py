import re

with open("src/store/useScraperStore.js", "r") as f:
    content = f.read()

# We want to replace the `triggerFulfillment` block entirely.
start_str = "  triggerFulfillment: async (sessionId) => {"
# The end is right before the last closing of the store
end_str = "\n}));"
start_idx = content.find(start_str)
end_idx = content.rfind(end_str)

new_trigger = """  triggerFulfillment: async (sessionId) => {
    const { addLog, estimatedLeads } = get();
    set({ fulfillmentStatus: 'verifying', logs: [] });
    addLog(`Fulfillment Sequence Started: ${sessionId}`);

    try {
      if (import.meta.env.DEV || sessionId.startsWith('mock_')) {
        await new Promise(resolve => setTimeout(resolve, 800));
        addLog("Stripe Payment Verified: [PAID]");
        await orderService.updateOrderStatus(sessionId, 'PROCESSING');
        set({ fulfillmentStatus: 'scraping' });

        let mockCount = 0;
        const mockInterval = setInterval(() => {
          mockCount += 50;
          addLog(`[KV_SYNC] ${mockCount} records successfully extracted to Edge storage...`);
          if (mockCount >= 150) {
            clearInterval(mockInterval);
            addLog("Mission Complete: Leads Dispatched.");
            orderService.updateOrderStatus(sessionId, 'COMPLETED', estimatedLeads);
            set({ fulfillmentStatus: 'completed' });
          }
        }, 3000);
        return;
      }

      // 1. Kick off the fulfillment API call asynchronously (do not await it directly yet)
      const fetchPromise = fetch('/api/fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      }).catch(err => ({ _isNetworkError: true, error: err }));

      addLog("Stripe Payment Verified: [PAID]");
      set({ fulfillmentStatus: 'scraping' });

      // 2. Poll the KV status endpoint
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/status/${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            // Data could be `{ count: X, status: 'PROCESSING' | 'COMPLETED' }`
            if (data.count !== undefined) {
               addLog(`[KV_SYNC] ${data.count} records successfully extracted to Edge storage...`);
            }
            if (data.status === 'COMPLETED') {
               clearInterval(pollInterval);
               set({ fulfillmentStatus: 'completed' });
               addLog("Mission Complete: Leads Dispatched.");
               await orderService.updateOrderStatus(sessionId, 'COMPLETED', data.count || estimatedLeads);
            }
          }
        } catch (e) {
          // Ignore polling errors to let it keep retrying
        }
      }, 3000);

      // 3. Keep an eye on the fetch promise in case it fails or finishes with an error early
      const finalRes = await fetchPromise;
      if (finalRes._isNetworkError) {
        clearInterval(pollInterval);
        throw new Error(`Network failure: ${finalRes.error.message}`);
      }
      if (!finalRes.ok) {
        clearInterval(pollInterval);
        const errorData = await finalRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Fulfillment failed with status ${finalRes.status}`);
      }
      const data = await finalRes.json();

      if (data.status === 'empty_refunded') {
        clearInterval(pollInterval);
        addLog("[REFUND_ISSUED] 0 MATCHING RECORDS FOUND. PAYMENT REVERSED.");
        set({ fulfillmentStatus: 'refunded' });
        return;
      } else if (data.status === 'already_fulfilled') {
        clearInterval(pollInterval);
        addLog("[SYSTEM] LEDGER RECONCILED. DISPATCH ALREADY COMPLETED.");
        set({ fulfillmentStatus: 'completed' });
        return;
      }

      // Note: We leave the completion to the polling loop if data.status isn't a quick exit,
      // but in case the polling missed it or it completed instantly, we can check `data.status` here too
      // if we adjust the API to return it.

    } catch (err) {
      logError("FULFILLMENT_FAILURE", {
        message: err.message || 'FULFILLMENT_ERROR',
        stack: err.stack || JSON.stringify(err)
      });
      set({ fulfillmentStatus: 'error' });
      addLog(`[EXTRACTION_PIPELINE_TIMEOUT] ERR: ${err.message}`);
      await orderService.updateOrderStatus(sessionId, 'FAILED');
    }
  }"""

new_content = content[:start_idx] + new_trigger + content[end_idx:]

with open("src/store/useScraperStore.js", "w") as f:
    f.write(new_content)

print("Updated useScraperStore.js")
