import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NetworkFeed() {
  const [activities, setActivities] = useState([
    "Node #412 active in Berlin",
    "Secure Ledger Sync: Complete",
    "Awaiting next deployment..."
  ]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const fetchRecent = async () => {
      const recent = [];
      if (recent.length > 0) {
        const formatted = recent.map(r => 
          `Extraction: ${r.industry} in ${r.location} [${r.status}]`
        );
        setActivities(formatted);
      }
    };

    fetchRecent();
    const refreshTimer = setInterval(fetchRecent, 30000);
    const rotateTimer = setInterval(() => {
      setIndex(prev => (prev + 1) % activities.length);
    }, 4000);

    return () => {
      clearInterval(refreshTimer);
      clearInterval(rotateTimer);
    };
  }, [activities.length]);

  return (
    <div className="w-full h-8 bg-axim-teal/5 border-y border-axim-teal/10 flex items-center overflow-hidden px-4 mb-8">
      <div className="flex items-center gap-2 shrink-0 border-r border-axim-teal/20 pr-4 mr-4">
        <div className="w-1.5 h-1.5 rounded-full bg-axim-teal animate-pulse"></div>
        <span className="text-[8px] font-black text-axim-teal uppercase tracking-widest">Live_Ledger</span>
      </div>
      <AnimatePresence mode="wait">
        <div className="flex-1 min-w-0 flex items-center">
          <motion.p
            key={`${index}-${activities[index]}`}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="text-[9px] font-mono text-gray-500 uppercase tracking-wider max-w-full truncate block overflow-hidden whitespace-nowrap"
          >
            {activities[index]}
          </motion.p>
        </div>
      </AnimatePresence>
    </div>
  );
}