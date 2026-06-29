import React, { useEffect, useRef } from 'react';
import { useScraperStore } from '../store/useScraperStore';
import { FiTrash2 } from 'react-icons/fi';

export default function LogTerminal() {
  const logs = useScraperStore(state => state.logs);
  const scrollRef = useRef(null);

  const addLog = useScraperStore(state => state.addLog);
  const clearLogs = useScraperStore(state => state.clearLogs);

  useEffect(() => {
    let timeout1, timeout2, timeout3;
    const isBooted = sessionStorage.getItem('terminal_booted');

    if (!isBooted) {
      timeout1 = setTimeout(() => addLog("[SYS_BOOT] INITIALIZING AXIM EDGE NODE..."), 400);
      timeout2 = setTimeout(() => addLog("[NET_SYNC] ESTABLISHING SECURE HANDSHAKE WITH ONYX SWARM... [OK]"), 800);
      timeout3 = setTimeout(() => {
         addLog("[READY] TERMINAL AWAITING DIRECTIVE.");
         sessionStorage.setItem('terminal_booted', 'true');
      }, 1200);
    } else {
       addLog("[READY] TERMINAL AWAITING DIRECTIVE.");
    }

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="w-full relative mt-6">

      <button
        onClick={clearLogs}
        className="absolute top-2 right-2 p-1 text-gray-600 hover:text-red-500 transition-colors z-10"
        title="Clear Logs"
      >
        <FiTrash2 size={14} />
      </button>
      <div className="w-full bg-black border border-white/5 rounded-lg p-4 font-mono text-[10px] h-48 overflow-y-auto scrollbar-hide scroll-smooth" ref={scrollRef}>
      <div className="flex flex-col gap-1">
        {logs.map(log => (
                    <div key={log.id} className="flex gap-3">
            <span className="text-gray-600">
              [<span className="text-axim-gold">{log.timestamp}</span>]
            </span>
            <span className={log.message.includes('ERROR') ? 'text-red-500' : (log.message.includes('[SYSTEM] Data scrub complete.') ? 'text-axim-gold' : 'text-axim-teal')}>
              {log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <span className="text-gray-800 animate-pulse italic">AWAITING_SEQUENCE...</span>
        )}
      </div>
    </div>
    </div>
  );
}
