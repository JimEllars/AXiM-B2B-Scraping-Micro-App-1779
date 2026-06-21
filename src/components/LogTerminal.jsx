import React, { useEffect, useRef } from 'react';
import { useScraperStore } from '../store/useScraperStore';

export default function LogTerminal() {
  const logs = useScraperStore(state => state.logs);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full bg-black border border-white/5 rounded-lg p-4 font-mono text-[10px] h-48 overflow-y-auto mt-6 scrollbar-hide" ref={scrollRef}>
      <div className="flex flex-col gap-1">
        {logs.map(log => (
          <div key={log.id} className="flex gap-3">
            <span className="text-gray-600">[{log.timestamp}]</span>
            <span className={log.message.includes('ERROR') ? 'text-red-500' : 'text-axim-teal'}>
              {log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <span className="text-gray-800 animate-pulse italic">AWAITING_SEQUENCE...</span>
        )}
      </div>
    </div>
  );
}