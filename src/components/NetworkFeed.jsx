import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ACTIVITIES = [
  "New extraction in Texas (Roofing)",
  "Delivery complete: London (SaaS)",
  "Node #412 active in Berlin",
  "SMTP Verification: 98% Success Rate",
  "Secure Ledger Sync: Complete",
  "New lead cohort found in California"
];

export default function NetworkFeed() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % ACTIVITIES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full h-8 bg-axim-teal/5 border-y border-axim-teal/10 flex items-center overflow-hidden px-4 mb-8">
      <div className="flex items-center gap-2 shrink-0 border-r border-axim-teal/20 pr-4 mr-4">
        <div className="w-1.5 h-1.5 rounded-full bg-axim-teal animate-pulse"></div>
        <span className="text-[8px] font-black text-axim-teal uppercase tracking-widest">Live_Network</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.p 
          key={index}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="text-[9px] font-mono text-gray-500 uppercase tracking-wider"
        >
          {ACTIVITIES[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}