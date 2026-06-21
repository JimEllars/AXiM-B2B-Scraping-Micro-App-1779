import React from 'react';
import { motion } from 'framer-motion';

export default function NodeMap() {
  return (
    <div className="relative w-full h-48 bg-black/40 border border-white/5 rounded-2xl overflow-hidden mt-8 group">
      <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center grayscale"></div>
      
      {/* Pulse Nodes */}
      {[
        { t: '15%', l: '25%' },
        { t: '45%', l: '65%' },
        { t: '75%', l: '35%' },
        { t: '30%', l: '80%' },
        { t: '60%', l: '15%' }
      ].map((pos, i) => (
        <div 
          key={i}
          className="absolute w-2 h-2 bg-axim-teal rounded-full"
          style={{ top: pos.t, left: pos.l }}
        >
          <div className="absolute inset-0 bg-axim-teal rounded-full animate-ping opacity-75"></div>
        </div>
      ))}

      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-axim-teal animate-pulse"></div>
          <span className="text-[8px] font-black text-white uppercase tracking-widest">Active Edge Nodes: 4,129</span>
        </div>
      </div>
    </div>
  );
}