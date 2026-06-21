import React from 'react';
import SafeIcon from '../common/SafeIcon';
import { FiGlobe, FiZap, FiServer } from 'react-icons/fi';

const StatCard = ({ icon, label, value, color }) => (
  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col items-center text-center group hover:border-axim-teal/30 transition-all">
    <SafeIcon icon={icon} className={`${color} mb-2 group-hover:scale-110 transition-transform`} />
    <p className="text-[7px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</p>
    <p className="font-mono text-[10px] text-white/80">{value}</p>
  </div>
);

export default function NetworkStats() {
  return (
    <div className="mt-10 grid grid-cols-3 gap-3 w-full">
      <StatCard icon={FiZap} label="Latency" value="12ms" color="text-axim-teal" />
      <StatCard icon={FiGlobe} label="Nodes" value="4,129" color="text-axim-teal" />
      <StatCard icon={FiServer} label="Uptime" value="99.99%" color="text-axim-teal" />
    </div>
  );
}