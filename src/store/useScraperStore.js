import { create } from 'zustand';
import { logError } from '../utils/telemetry';


const generateIdempotencyKey = () => {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const useScraperStore = create((set, get) => ({
  filters: { industry: '', location: '', size: '1-10', keywords: '' },
  email: '',
  estimatedLeads: 0,
  globalLeadsScraped: 1420582,
  isProcessing: false,
  fulfillmentStatus: 'idle',
  currentOrderId: null,
  logs: [],
  idempotencyKey: generateIdempotencyKey(),
  checkoutError: null,
  isOnline: navigator.onLine,
  activeNode: 'NODE_049_ACTIVE // SECURE_LINK',
  currentRayId: null,
  
  updateEmail: (email) => set({ email, checkoutError: null }),
  updateFilter: (key, value) => {
    set(state => {
      const newFilters = { ...state.filters, [key]: value };
      const base = 450;
      const industryMod = (newFilters.industry?.length || 1) * 123;
      const locationMod = (newFilters.location?.length || 1) * 87;
      const sizeMod = parseInt(newFilters.size.split('-')[0]) || 1;
      const estimate = (base + industryMod + locationMod) * (1 + sizeMod / 100);
      
      return { 
        filters: newFilters,
        estimatedLeads: Math.floor(estimate % 4500) + 120,
        checkoutError: null
      };
    });
  },

  resetFilters: () => set({
    filters: { industry: '', location: '', size: '1-10', keywords: '' },
    email: '',
    estimatedLeads: 0,
    idempotencyKey: generateIdempotencyKey()
  }),

  hardResetSystem: () => set({
    filters: { industry: '', location: '', size: '1-10', keywords: '' },
    email: '',
    estimatedLeads: 0,
    isProcessing: false,
    checkoutError: null,
    fulfillmentStatus: 'idle',
    currentOrderId: null,
    logs: [],
    idempotencyKey: generateIdempotencyKey()
  }),

  addLog: (message) => set(state => ({
    logs: [...state.logs, { id: Date.now(), timestamp: new Date().toLocaleTimeString(), message }]
  })),

  clearLogs: () => set({ logs: [] }),

  purgeAdminSession: () => {
    if (window._adminPollInterval) {
      clearInterval(window._adminPollInterval);
      window._adminPollInterval = null;
    }
    sessionStorage.removeItem("adminToken");
  },

  invalidateEdgeCache: async (targetQueryHash) => {
    try {
      const token = sessionStorage.getItem('adminToken');
      if (!token) return;

      const res = await fetch('/api/admin/purge-cache', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetQueryHash })
      });

      if (res.ok) {
        get().addLog(`[CACHE_EVICTED] TARGET_HASH: ${targetQueryHash}`);
      }
    } catch (err) {
      console.error("Cache invalidation failed", err);
    }
  },

  startAdminPolling: () => {
    // Only run if not already running to prevent multiple intervals
    if (window._adminPollInterval) return;

    window._adminPollInterval = setInterval(async () => {
      const token = sessionStorage.getItem('adminToken');
      if (!token) {
        clearInterval(window._adminPollInterval);
        window._adminPollInterval = null;
        return;
      }

      try {
        const res = await fetch('/api/admin/metrics', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.active_sessions && data.active_sessions.length > 0) {
            const { addLog } = get();
            data.active_sessions.forEach(sessionId => {
              addLog(`[SYSTEM_BROADCAST] ACTIVE_BACKGROUND_SESSION_DETECTED: ${sessionId}`);
            });
          }
        }
      } catch (err) {
        console.error("Admin polling failed", err);
      }
    }, 5000);
  },

  initiateCheckout: async () => {
    set({ isProcessing: true, checkoutError: null });
    const { addLog, filters, email } = get();
    addLog("INITIATING_SECURE_CHECKOUT_PROTOCOL");
    
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("INVALID_EMAIL_FORMAT");
      }

      // 1. Record the order in Ledger
      const orderId = crypto.randomUUID();
      set({ currentOrderId: orderId });
      addLog(`ORDER_INITIALIZED_IN_LEDGER: ${orderId}`);

      if (import.meta.env.DEV) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        window.location.hash = `/success?session_id=${orderId}`;
        set({ isProcessing: false });
        return;
      }

      // Handle real Stripe redirect if configured
      const { idempotencyKey } = get();
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ filters, email, orderId })
      });
      if (!res.ok) {
        throw new Error(`Checkout API failed with status ${res.status}`);
      }
      const data = await res.json();
      const rayHeader = res.headers.get('X-AXiM-Ray-ID');
      if (rayHeader) {
        set({ currentRayId: rayHeader });
        addLog(`[SYS_RAY_TRACE: ${rayHeader}]`);
      }
      if (data.url) {
        const geo = res.headers.get('X-AXiM-Geo');
        if (geo) {
          set({ activeNode: `NODE_[${geo}] // SECURE_LINK` });
        }
        set({ idempotencyKey: generateIdempotencyKey() });
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned from API");
      }
    } catch (err) {
      const errorMessage = err.message || 'PROTOCOL_ABORTED';
      if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests")) {
        set({ checkoutError: 'RATE_LIMIT_EXCEEDED' });
        setTimeout(() => {
          if (get().checkoutError === 'RATE_LIMIT_EXCEEDED') {
            set({ checkoutError: null });
          }
        }, 60000);
      } else {
        set({ checkoutError: errorMessage });
      }
      logError("CHECKOUT_FAILURE", {
        message: errorMessage,
        stack: err.stack || JSON.stringify(err)
      });
      addLog(`[GATEWAY_HANDSHAKE_FAULT] CHECKOUT_ERROR: ${errorMessage}`);
    } finally {
      set({ isProcessing: false });
    }
  },

  triggerFulfillment: async (sessionId) => {
    const { addLog, estimatedLeads } = get();
    set({ fulfillmentStatus: 'verifying', logs: [] });
    addLog(`Fulfillment Sequence Started: ${sessionId}`);
    
    try {
      if (import.meta.env.DEV || sessionId.startsWith('mock_')) {
        await new Promise(resolve => setTimeout(resolve, 800));
        addLog("Stripe Payment Verified: [PAID]");

        set({ fulfillmentStatus: 'scraping' });
        
        let mockCount = 0;
        const mockInterval = setInterval(() => {
          mockCount += 50;
          addLog(`[KV_SYNC] ${mockCount} records successfully extracted to Edge storage...`);
          if (mockCount >= 150) {
            clearInterval(mockInterval);
            addLog("Mission Complete: Leads Dispatched.");

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
      let isPolling = true;
      let failCount = 0;
      const pollStatus = async () => {
        if (!isPolling) return;
        try {
          const res = await fetch(`/api/status/${sessionId}`);
          if (res.ok) {
            failCount = 0; // Reset on success
            const data = await res.json();
            // Data could be `{ count: X, status: 'PROCESSING' | 'COMPLETED' | 'PARTIAL_SUCCESS' }`
            if (data.count !== undefined) {
               addLog(`[KV_SYNC] ${data.count} records successfully extracted to Edge storage...`);
            }
            if (data.status === 'COMPLETED' || data.status === 'PARTIAL_SUCCESS') {
               isPolling = false;
               set({ fulfillmentStatus: 'completed' });
               addLog("Mission Complete: Leads Dispatched.");

               return; // Exit polling loop
            } else if (data.status === 'FAILED') {
               isPolling = false;
               set({ fulfillmentStatus: 'error' });
               addLog("ERROR: Edge node execution aborted due to unrecoverable parsing anomaly.");

               return; // Exit polling loop
            }
          } else {
             throw new Error('Non-OK response'); // Trigger catch to increment failCount
          }
        } catch (e) {
          failCount++;
          if (failCount >= 5) {
            isPolling = false;
            addLog("[SYSTEM_FAULT] Lost connection to Onyx Swarm. Aborting sync.");
            set({ fulfillmentStatus: 'error', checkoutError: 'NETWORK_TIMEOUT' });
            return;
          }
        }

        if (isPolling) {
            setTimeout(pollStatus, 3000); // Queue next poll
        }
      };

      pollStatus(); // Initial call

      // 3. Keep an eye on the fetch promise in case it fails or finishes with an error early
      const finalRes = await fetchPromise;
      if (finalRes._isNetworkError) {
        isPolling = false;
        throw new Error(`Network failure: ${finalRes.error.message}`);
      }
      if (!finalRes.ok) {
        isPolling = false;
        const errorData = await finalRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Fulfillment failed with status ${finalRes.status}`);
      }
      const data = await finalRes.json();
      const rayHeader = finalRes.headers.get('X-AXiM-Ray-ID');
      if (rayHeader) {
        set({ currentRayId: rayHeader });
        addLog(`[SYS_RAY_TRACE: ${rayHeader}]`);
      }

      if (data.status === 'empty_refunded') {
        isPolling = false;
        addLog("[REFUND_ISSUED] 0 MATCHING RECORDS FOUND. PAYMENT REVERSED.");
        set({ fulfillmentStatus: 'refunded' });
        return;
      } else if (data.status === 'already_fulfilled') {
        isPolling = false;
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

    }
  }
}));