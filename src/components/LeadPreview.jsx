import React from 'react';
import { useScraperStore } from '../store/useScraperStore';
import SafeIcon from '../common/SafeIcon';
import { FiEye, FiLock, FiMail, FiPhone } from 'react-icons/fi';

export default function LeadPreview() {
  const industry = useScraperStore(state => state.filters.industry);
  
  if (!industry) return (
    <div className="mt-8 w-full p-8 border border-white/5 rounded-2xl bg-white/[0.01] flex flex-col items-center justify-center text-center">
      <SafeIcon icon={FiEye} className="text-gray-800 text-3xl mb-4" />
      <p className="text-[8px] font-mono text-gray-700 uppercase tracking-widest">Define parameters to generate preview</p>
    </div>
  );

  const mockLeads = [
    { name: "John D.", role: "CEO", business: `${industry} Solutions` },
    { name: "Sarah K.", role: "Ops Director", business: `Global ${industry} Inc` }
  ];

  return (
    <div className="mt-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Live Sample Preview</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-axim-teal animate-pulse"></div>
          <span className="text-[8px] font-mono text-axim-teal/60">SYNCED_WITH_CORE</span>
        </div>
      </div>
      <div className="space-y-3">
        {mockLeads.map((lead, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/5 p-4 rounded-xl flex items-center justify-between group hover:border-axim-teal/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-axim-teal/5 flex items-center justify-center text-axim-teal border border-axim-teal/10">
                <SafeIcon icon={FiLock} className="text-xs" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-white uppercase">{lead.name}</span>
                  <span className="text-[8px] px-1.5 py-0.5 bg-white/5 rounded text-gray-500 font-mono">{lead.role}</span>
                </div>
                <div className="text-[8px] font-mono text-gray-600 uppercase tracking-widest flex items-center gap-3">
                  <span className="flex items-center gap-1"><SafeIcon icon={FiMail} /> *******@company.com</span>
                  <span className="flex items-center gap-1"><SafeIcon icon={FiPhone} /> +1 ***-***-****</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-black text-axim-teal/40 uppercase italic">{lead.business}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}