import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { orderService } from '../services/orderService';
import SafeIcon from '../common/SafeIcon';
import { FiX, FiActivity, FiClock, FiMapPin, FiCheckCircle, FiRefreshCcw } from 'react-icons/fi';

export default function LedgerModal({ isOpen, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [ledgerError, setLedgerError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setLedgerError(false);
      orderService.getRecentOrders(20).then(data => {
        if (!data || !Array.isArray(data)) throw new Error("Invalid ledger data");
        setOrders(data);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLedgerError(true);
        setLoading(false);
      });
    }
  }, [isOpen]);

  const handleRefresh = () => {
    setLoading(true);
    setLedgerError(false);
    orderService.getRecentOrders(20).then(data => {
        if (!data || !Array.isArray(data)) throw new Error("Invalid ledger data");
        setOrders(data);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLedgerError(true);
        setLoading(false);
      });
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (order.industry && order.industry.toLowerCase().includes(term)) ||
      (order.location && order.location.toLowerCase().includes(term))
    );
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <SafeIcon icon={FiActivity} className="text-axim-teal" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white italic">Public Ledger History</h2>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={handleRefresh} className="text-gray-500 hover:text-white transition-colors">
                  <SafeIcon icon={FiRefreshCcw} />
                </button>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                  <SafeIcon icon={FiX} />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-white/5">
              <input
                type="text"
                placeholder="[SEARCH LEDGER COHORT // TARGET SECTOR OR REGION]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/50 border border-white/10 text-axim-teal p-3 font-mono text-xs focus:border-axim-teal focus:outline-none placeholder:text-gray-700 mb-4"
              />
              <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-2">
                [LEDGER MATCHES: {filteredOrders.length} OF {orders.length} ACTIVE COHORTS FOUND]
              </div>
            </div>


            <div className="max-h-[60vh] overflow-y-auto p-4">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="py-2 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest max-w-[120px] sm:max-w-[200px] truncate overflow-hidden whitespace-nowrap">Status</th>
                      <th className="py-2 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest max-w-[120px] sm:max-w-[200px] truncate overflow-hidden whitespace-nowrap">Industry</th>
                      <th className="py-2 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest max-w-[120px] sm:max-w-[200px] truncate overflow-hidden whitespace-nowrap">Location</th>
                      <th className="py-2 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">ID</th>
                      <th className="py-2 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="py-20 text-center">
                          <div className="animate-pulse font-mono tracking-widest text-[10px] text-gray-600">
                            Retrieving Encrypted Records...
                          </div>
                        </td>
                      </tr>
                    ) : ledgerError ? (
                      <tr>
                        <td colSpan="5" className="py-20 text-center font-mono text-[10px] text-red-500 uppercase tracking-widest">
                          [UPSTREAM LEDGER UNAVAILABLE. THE ONYX SWARM IS INVESTIGATING. PLEASE TRY AGAIN LATER.]
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-20 text-center text-[10px] font-mono text-gray-600 uppercase tracking-widest">
                          No records found in current segment.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr key={order.id} className="bg-white/[0.02] border-b border-white/5 group hover:border-axim-teal/20 transition-all">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                <SafeIcon icon={order.status === 'COMPLETED' ? FiCheckCircle : FiClock} className={order.status === 'COMPLETED' ? 'text-axim-teal' : (order.status === 'REFUNDED' || order.status === 'empty_refunded') ? 'text-yellow-400' : 'text-axim-gold'} />
                              </div>
                              <div className={`text-[8px] font-black px-2 py-0.5 rounded border inline-block ${
                                order.status === 'COMPLETED' ? 'text-axim-teal border-axim-teal/20 bg-axim-teal/5' : (order.status === 'REFUNDED' || order.status === 'empty_refunded') ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'text-axim-gold border-axim-gold/20 bg-axim-gold/5'
                              }`}>
                                {order.status}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[10px] font-black text-white uppercase max-w-[120px] sm:max-w-[200px] truncate overflow-hidden whitespace-nowrap">
                            {order.industry}
                          </td>
                          <td className="py-3 px-4 text-[10px] font-mono text-gray-500 max-w-[120px] sm:max-w-[200px] truncate overflow-hidden whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <SafeIcon icon={FiMapPin} className="text-[8px] shrink-0" />
                              <span className="truncate">{order.location}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[8px] font-mono text-gray-600 uppercase tracking-widest">
                            {order.id.split('-')[0]}... [SECURED]
                          </td>
                          <td className="py-3 px-4 text-right text-[7px] font-mono text-gray-700 uppercase">
                            {new Date(order.timestamp).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}