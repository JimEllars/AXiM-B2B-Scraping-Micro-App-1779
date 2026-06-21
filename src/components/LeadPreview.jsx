import React from 'react';
import { useScraperStore } from '../store/useScraperStore';
import SafeIcon from '../common/SafeIcon';
import { FiEye, FiLock } from 'react-icons/fi';

export default function LeadPreview() {
  const industry = useScraperStore(state => state.filters.industry);
  
  if (!industry) return null;

  return (
    <div className="mt-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Live Sample Preview</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-axim-teal animate-pulse"></div>
          <span className="text-[8px] font-mono text-axim-teal/60">SYNCED_WITH_CORE</span>
        </div>
      </div>
      
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white/[0.03] border border-white/5 p-3 rounded-lg flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-gray-600">
                <SafeIcon icon={FiEye} className="text-xs" />
              </div>
              <div className="flex flex-col">
                <div className="h-2 w-24 bg-white/10 rounded mb-1.5"></div>
                <div className="h-1.5 w-32 bg-white/5 rounded"></div>
              </div>
            </div>
            <SafeIcon icon={FiLock} className="text-gray-700 text-xs" />
          </div>
        ))}
      </div>
    </div>
  );
}