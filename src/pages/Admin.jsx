import React, { useState } from 'react';

// Minimal Admin Page scaffolding for Phase 44 Micro-Increment
export default function Admin() {
  const [protocolKey, setProtocolKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState(null);

  React.useEffect(() => {
    if (isAuthenticated) {
      const fetchMetrics = async () => {
        try {
          const token = sessionStorage.getItem('adminToken');
          const res = await fetch('/api/admin/metrics', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setMetrics(data);
          }
        } catch (err) {
          console.error("Failed to fetch metrics", err);
        }
      };
      fetchMetrics();
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ protocol_key: protocolKey })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.token) {
          sessionStorage.setItem('adminToken', data.token);
          setIsAuthenticated(true);
        } else {
          setError('Invalid Protocol Key');
        }
      } else {
        setError('Invalid Protocol Key');
      }
    } catch (err) {
      setError('Connection failed. Try again.');
    }
  };

  if (isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-6">
        <div className="max-w-md w-full bg-void border border-white/10 rounded-lg p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-axim-teal to-transparent opacity-50"></div>
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-xl font-black tracking-[0.2em] uppercase text-axim-teal">Dashboard</h1>
            <p className="text-[10px] font-mono text-gray-500 mt-2 uppercase tracking-widest text-center">
              System Access Granted.
            </p>
            {metrics && (
              <div className="flex flex-col gap-2 mt-6 items-center">
                <p className="font-mono text-xs text-gray-400">ACTIVE_BLOCKS: {metrics.active_blocks}</p>
                <p className="font-mono text-xs text-gray-400">CACHE_HITS: {metrics.cache_hits}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-6">
      <div className="max-w-md w-full bg-void border border-white/10 rounded-lg p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-axim-teal to-transparent opacity-50"></div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-full border border-axim-teal/30 bg-axim-teal/10 flex items-center justify-center mb-4 text-axim-teal">
            <span className="font-mono text-xl">🔒</span>
          </div>
          <h1 className="text-xl font-black tracking-[0.2em] uppercase text-white">System Access</h1>
          <p className="text-[10px] font-mono text-gray-500 mt-2 uppercase tracking-widest text-center">
            Restricted Area. Enter Protocol Key.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="protocolKey" className="text-[9px] font-mono text-axim-teal uppercase tracking-[0.2em]">
              Admin Access Protocol Key
            </label>
            <input
              type="password"
              id="protocolKey"
              value={protocolKey}
              onChange={(e) => setProtocolKey(e.target.value)}
              className="bg-black border border-white/10 rounded p-3 text-white font-mono text-sm focus:outline-none focus:border-axim-teal transition-colors focus:shadow-[0_0_10px_rgba(0,229,255,0.2)]"
              placeholder="••••••••••••"
              autoComplete="off"
            />
            {error && (
              <span className="text-[10px] font-mono text-red-500 mt-1 uppercase tracking-widest">
                {error}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-axim-teal text-black font-black uppercase tracking-widest text-xs py-4 rounded hover:bg-white hover:text-black transition-all duration-300 shadow-[0_0_15px_rgba(0,229,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)] mt-2"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
