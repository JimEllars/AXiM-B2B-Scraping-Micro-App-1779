import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Success from './pages/Success';
import SafeIcon from './common/SafeIcon';
import { FiTerminal, FiLayout } from 'react-icons/fi';
import '@questlabs/react-sdk/dist/style.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-void text-white font-sans flex flex-col relative selection:bg-axim-teal selection:text-black">
        {/* Scanned Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,229,255,0.05)_0%,transparent_50%)] pointer-events-none"></div>
        
        <header className="w-full p-6 flex justify-between items-center border-b border-white/5 relative z-10 bg-void/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-axim-teal rounded flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]">
              <SafeIcon icon={FiTerminal} className="font-bold text-xl" />
            </div>
            <div>
              <span className="font-black tracking-[0.2em] uppercase text-xl block">AXiM<span className="text-axim-teal text-opacity-80">.LISTS</span></span>
              <span className="text-[7px] font-mono text-gray-600 block -mt-1 tracking-[0.5em] uppercase">Edge Scraper Node</span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            {['Terminal', 'Assets', 'Ledger', 'API'].map((item) => (
              <a key={item} href="#" className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-axim-teal transition-colors">{item}</a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5">
              <div className="w-2 h-2 rounded-full bg-axim-teal animate-pulse"></div>
              <span className="text-[9px] font-mono text-gray-400 tracking-wider">NODE_049_ACTIVE</span>
            </div>
          </div>
        </header>
        
        <main className="flex-1 flex flex-col items-center relative z-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/success" element={<Success />} />
          </Routes>
        </main>
        
        <footer className="w-full p-8 border-t border-white/5 relative z-10 bg-void">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-axim-teal rounded-full"></div>
              <p className="text-[9px] font-mono text-gray-600 uppercase tracking-[0.2em]">
                &copy; 2024 AXiM Core Systems. All Rights Reserved.
              </p>
            </div>
            <div className="flex gap-6">
              <a href="#" className="text-[8px] font-black uppercase tracking-widest text-gray-700 hover:text-white">Privacy_Policy</a>
              <a href="#" className="text-[8px] font-black uppercase tracking-widest text-gray-700 hover:text-white">Core_Status</a>
              <a href="#" className="text-[8px] font-black uppercase tracking-widest text-gray-700 hover:text-white">Service_SLA</a>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;