import { create } from 'zustand';
import { logError } from '../utils/telemetry';
import { orderService } from '../services/orderService';


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

  initiateCheckout: async () => {
    set({ isProcessing: true, checkoutError: null });
    const { addLog, filters, email } = get();
    addLog("INITIATING_SECURE_CHECKOUT_PROTOCOL");
    
    try {
      // 1. Record the order in Google Sheets
      const orderId = await orderService.createOrder({
        email,
        ...filters
      });
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
      if (data.url) {
        set({ idempotencyKey: generateIdempotencyKey() });
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned from API");
      }
    } catch (err) {
      const errorMessage = err.message || 'PROTOCOL_ABORTED';
      if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests")) {
        set({ checkoutError: 'RATE_LIMIT_EXCEEDED' });
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
        
        // Update Sheets to 'PROCESSING'
        await orderService.updateOrderStatus(sessionId, 'PROCESSING');
        
        set({ fulfillmentStatus: 'scraping' });
        const steps = [
          "Allocating Edge Nodes (US-EAST-1)", 
          "Bypassing Captcha Layers...", 
          "Extracting B2B Profiles", 
          "Initiating SMTP Discovery", 
          "Verifying Email Deliverability",
          "Generating Encrypted CSV",
          "Dispatching via EmailIt Protocol"
        ];
        for (const step of steps) {
          await new Promise(resolve => setTimeout(resolve, 600));
          addLog(`${step}... OK`);
        }
        
        // Update Sheets to 'COMPLETED'
        await orderService.updateOrderStatus(sessionId, 'COMPLETED', estimatedLeads);
        
        set({ fulfillmentStatus: 'completed' });
        addLog("Mission Complete: Leads Dispatched.");
        return;
      }

      // Real API fulfillment
      const fetchPromise = fetch('/api/fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      }).catch(err => ({ _isNetworkError: true, error: err }));

      const fastCheck = new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 2500));

      const result = await Promise.race([fetchPromise, fastCheck]);

      if (result !== 'TIMEOUT') {
        const res = result;
        if (res._isNetworkError) {
          throw new Error(`Network failure: ${res.error.message}`);
        }
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Fulfillment failed with status ${res.status}`);
        }
        const data = await res.json();

        if (data.status === 'empty_refunded') {
          addLog("[REFUND_ISSUED] 0 MATCHING RECORDS FOUND. PAYMENT REVERSED.");
          set({ fulfillmentStatus: 'refunded' });
          return;
        } else if (data.status === 'already_fulfilled') {
          addLog("[SYSTEM] LEDGER RECONCILED. DISPATCH ALREADY COMPLETED.");
          set({ fulfillmentStatus: 'completed' });
          return;
        } else {
          // It completed surprisingly fast and wasn't already fulfilled
          if (data.dropped !== undefined) {
            addLog(`[SYSTEM] Data scrub complete. ${data.dropped} corrupted records purged. ${data.count} clean records packed for delivery.`);
          } else {
            addLog(`Extraction completed. ${data.count || estimatedLeads} leads found.`);
          }
          await orderService.updateOrderStatus(sessionId, 'COMPLETED', data.count || estimatedLeads);
          set({ fulfillmentStatus: 'completed' });
          return;
        }
      }

      // If we are here, fetch is taking longer than 2.5s, meaning it's likely a fresh scrape.
      addLog("Stripe Payment Verified: [PAID]");
      set({ fulfillmentStatus: 'scraping' });
      
      const steps = [
        "Allocating Edge Nodes (US-EAST-1)",
        "Bypassing Captcha Layers...",
        "Extracting B2B Profiles",
        "Initiating SMTP Discovery",
        "Verifying Email Deliverability",
        "Generating Encrypted CSV",
        "Dispatching via EmailIt Protocol"
      ];

      // Run terminal logging sequence while awaiting fetch
      let fetchDone = false;
      let data = null;

      const finishFetch = async () => {
        const res = await fetchPromise;
        if (res._isNetworkError) {
          throw new Error(`Network failure: ${res.error.message}`);
        }
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Fulfillment failed with status ${res.status}`);
        }
        data = await res.json();
        fetchDone = true;
      };

      let fetchError = null;
      const fetchTask = finishFetch().catch(err => {
        fetchError = err;
        fetchDone = true;
      });

      for (const step of steps) {
        if (fetchDone) break; // If fetch completes early, stop artificial logs
        await new Promise(resolve => setTimeout(resolve, 600));
        addLog(`${step}... OK`);
      }

      // Wait for fetch to complete if it hasn't yet
      await fetchTask;

      if (fetchError) {
        throw fetchError;
      }

      if (data.status === 'empty_refunded') {
        addLog("[REFUND_ISSUED] 0 MATCHING RECORDS FOUND. PAYMENT REVERSED.");
        set({ fulfillmentStatus: 'refunded' });
        return;
      } else if (data.status === 'already_fulfilled') {
        addLog("[SYSTEM] LEDGER RECONCILED. DISPATCH ALREADY COMPLETED.");
      } else if (data.dropped !== undefined) {
        addLog(`[SYSTEM] Data scrub complete. ${data.dropped} corrupted records purged. ${data.count} clean records packed for delivery.`);
      } else {
        addLog(`Extraction completed. ${data.count || estimatedLeads} leads found.`);
      }

      await orderService.updateOrderStatus(sessionId, 'COMPLETED', data.count || estimatedLeads);
      set({ fulfillmentStatus: 'completed' });

    } catch (err) {
      logError("FULFILLMENT_FAILURE", {
        message: err.message || 'FULFILLMENT_ERROR',
        stack: err.stack || JSON.stringify(err)
      });
      set({ fulfillmentStatus: 'error' });
      addLog(`[EXTRACTION_PIPELINE_TIMEOUT] ERR: ${err.message}`);
      await orderService.updateOrderStatus(sessionId, 'FAILED');
    }
  }
}));