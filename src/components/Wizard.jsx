import React from 'react';
import { useScraperStore } from '../store/useScraperStore';
import SafeIcon from '../common/SafeIcon';
import { FiDatabase, FiLock, FiMail, FiUsers, FiSearch, FiTarget, FiZap } from 'react-icons/fi';

export default function Wizard() {
  const { filters, email, updateFilter, initiateCheckout, isProcessing, estimatedLeads } = useScraperStore();

  return (
    <div className="bg-[#0a0a0a] border border-white/10 p-10 rounded-3xl w-full shadow-[0_0_60px_rgba(0,229,255,0.03)] relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-axim-teal to-transparent opacity-50"></div>
      
      <div className="flex justify-between items-start mb-10">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3 italic">
            <SafeIcon icon={FiDatabase} className="text-axim-teal" />
            Configuration
          </h2>
          <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest mt-1">Define Target Cohort Parameters</p>
        </div>
        {estimatedLeads > 0 && (
          <div className="text-right bg-axim-teal/5 border border-axim-teal/10 px-4 py-2 rounded-xl">
            <p className="text-[8px] font-bold text-axim-teal uppercase tracking-widest">Availability</p>
            <p className="text-xl font-mono text-white leading-none mt-1">{estimatedLeads.toLocaleString()}</p>
          </div>
        )}
      </div>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Target Industry</label>
            <div className="relative group/input">
              <input 
                type="text" 
                value={filters.industry}
                onChange={(e) => updateFilter('industry', e.target.value)}
                placeholder="e.g. Solar, Roofing, SaaS"
                className="w-full bg-black/50 border border-white/10 text-white p-4 rounded-xl font-mono text-sm focus:border-axim-teal focus:ring-1 focus:ring-axim-teal/20 focus:outline-none transition-all placeholder:text-gray-800"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-800 group-focus-within/input:text-axim-teal/40 transition-colors">
                <SafeIcon icon={FiSearch} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Geographic Focus</label>
            <input 
              type="text" 
              value={filters.location}
              onChange={(e) => updateFilter('location', e.target.value)}
              placeholder="City, State or Country"
              className="w-full bg-black/50 border border-white/10 text-white p-4 rounded-xl font-mono text-sm focus:border-axim-teal focus:ring-1 focus:ring-axim-teal/20 focus:outline-none transition-all placeholder:text-gray-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <SafeIcon icon={FiUsers} /> Company Size
            </label>
            <select 
              value={filters.size}
              onChange={(e) => updateFilter('size', e.target.value)}
              className="w-full bg-black/50 border border-white/10 text-white p-4 rounded-xl font-mono text-sm focus:border-axim-teal focus:outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="1-10">1-10 Employees</option>
              <option value="11-50">11-50 Employees</option>
              <option value="51-200">51-200 Employees</option>
              <option value="201-1000">201-1000 Employees</option>
              <option value="1000+">Enterprise (1000+)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <SafeIcon icon={FiTarget} /> Decision Maker
            </label>
            <input 
              type="text" 
              value={filters.keywords}
              onChange={(e) => updateFilter('keywords', e.target.value)}
              placeholder="e.g. CEO, Marketing Director"
              className="w-full bg-black/50 border border-white/10 text-white p-4 rounded-xl font-mono text-sm focus:border-axim-teal focus:outline-none transition-all placeholder:text-gray-800"
            />
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-white/5">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Dispatch Destination</label>
          <div className="relative group/input">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <SafeIcon icon={FiMail} className="text-gray-700 group-focus-within/input:text-axim-teal transition-colors" />
            </div>
            <input 
              type="email" 
              value={email}
              onChange={(e) => useScraperStore.setState({ email: e.target.value })}
              placeholder="operator@company.com"
              className="w-full bg-black/50 border border-white/10 text-white py-4 pr-4 pl-12 rounded-xl font-mono text-sm focus:border-axim-teal focus:outline-none transition-all placeholder:text-gray-800"
            />
          </div>
        </div>

        <div className="pt-6">
          <button 
            onClick={initiateCheckout}
            disabled={isProcessing || !email || !filters.industry}
            className="w-full bg-axim-teal text-black font-black uppercase tracking-[0.3em] py-6 rounded-2xl hover:bg-white transition-all duration-500 disabled:opacity-20 flex items-center justify-center gap-4 group shadow-[0_10px_40px_rgba(0,229,255,0.15)] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
            <SafeIcon icon={isProcessing ? FiZap : FiLock} className={`${isProcessing ? 'animate-spin' : 'group-hover:scale-125'} transition-transform relative z-10`} />
            <span className="relative z-10">{isProcessing ? 'SYNCHRONIZING...' : 'INITIATE EXTRACTION - $29'}</span>
          </button>
          <p className="text-center text-[8px] font-mono text-gray-700 uppercase tracking-[0.4em] mt-4">Secure Encryption: AES-256 Enabled</p>
        </div>
      </div>
    </div>
  );
}