import { create } from 'zustand';
import { logError } from '../utils/telemetry';

export const useScraperStore = create((set, get) => ({
  filters: { industry: '', location: '', size: '1-10', keywords: '' },
  email: '',
  estimatedLeads: 0,
  globalLeadsScraped: 1420582,
  isProcessing: false,
  fulfillmentStatus: 'idle',
  logs: [],
  
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
        estimatedLeads: Math.floor(estimate % 4500) + 120 
      };
    });
  },

  addLog: (message) => set(state => ({
    logs: [...state.logs, { id: Date.now(), timestamp: new Date().toLocaleTimeString(), message }]
  })),

  initiateCheckout: async () => {
    set({ isProcessing: true });
    const { addLog } = get();
    addLog("INITIATING_SECURE_CHECKOUT_PROTOCOL");
    
    try {
      const { filters, email } = get();
      if (import.meta.env.DEV) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        window.location.hash = `/success?session_id=mock_${Date.now()}`;
        set({ isProcessing: false });
        return;
      }
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, email })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url; 
    } catch (err) {
      logError("CHECKOUT_FAILURE", err);
      addLog("CHECKOUT_ERROR: PROTOCOL_ABORTED");
    } finally {
      set({ isProcessing: false });
    }
  },

  triggerFulfillment: async (sessionId) => {
    const { addLog } = get();
    set({ fulfillmentStatus: 'verifying', logs: [] });
    addLog(`Fulfillment Sequence Started: ${sessionId}`);
    
    try {
      if (import.meta.env.DEV) {
        await new Promise(resolve => setTimeout(resolve, 800));
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
        for (const step of steps) {
          await new Promise(resolve => setTimeout(resolve, 800));
          addLog(`${step}... OK`);
        }
        set({ fulfillmentStatus: 'completed' });
        addLog("Mission Complete: Leads Dispatched.");
        return;
      }
      const res = await fetch('/api/fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      if (!res.ok) throw new Error("API_ERROR");
      set({ fulfillmentStatus: 'completed' });
    } catch (err) {
      set({ fulfillmentStatus: 'error' });
      addLog(`ERR: ${err.message}`);
    }
  }
}));