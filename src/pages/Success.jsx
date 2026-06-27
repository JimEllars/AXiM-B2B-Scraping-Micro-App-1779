import React, { useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useScraperStore } from '../store/useScraperStore';
import LogTerminal from '../components/LogTerminal';
import SafeIcon from '../common/SafeIcon';
import { FiCheckCircle, FiAlertOctagon, FiArrowLeft, FiMail, FiCpu, FiExternalLink } from 'react-icons/fi';
import { Feedback } from '@questlabs/react-sdk';

export default function Success() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { fulfillmentStatus, triggerFulfillment, filters } = useScraperStore();

  const extractionTriggered = useRef(false);

  useEffect(() => {
    if (sessionId && !extractionTriggered.current) {
      extractionTriggered.current = true;
      triggerFulfillment(sessionId);
    }
  }, [sessionId, triggerFulfillment]);

  const feedbackStyle = {
    Form: { backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '32px' },
    Heading: { color: '#ffffff', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' },
    Description: { color: '#6b7280', fontSize: '12px' },
    PrimaryButton: { backgroundColor: '#00e5ff', color: '#000000', fontWeight: '900', borderRadius: '8px' },
    listHover: {
      background: '#141414',
      iconBackground: '#00e5ff',
      iconColor: '#000000',
      Heading: '#ffffff',
      Description: '#9ca3af',
      Icon: { color: '#00e5ff' },
      defaultIconBackground: '#0a0a0a'
    }
  };

  return (
    <div className="w-full max-w-2xl flex flex-col items-center py-12 px-4">
      <div className={`w-full bg-[#0a0a0a] border border-white/10 p-10 rounded-3xl relative overflow-hidden flex flex-col items-center mb-8 ${fulfillmentStatus === 'refunded' ? 'shadow-[0_0_50px_rgba(255,234,0,0.05)]' : 'shadow-[0_0_50px_rgba(0,229,255,0.05)]'}`}>
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent to-transparent opacity-30 ${fulfillmentStatus === 'refunded' ? 'via-yellow-400' : 'via-axim-teal'}`}></div>
        
        {(fulfillmentStatus === 'verifying' || fulfillmentStatus === 'scraping') && (
          <div className="flex flex-col items-center gap-4 w-full py-8">
            <FiCpu className="text-axim-teal text-5xl animate-pulse" />
            <h2 className="text-xl font-black uppercase italic animate-pulse tracking-widest text-white">
              {fulfillmentStatus === 'verifying' ? 'Verifying Ledger' : 'Extracting Data'}
            </h2>
          </div>
        )}


        {fulfillmentStatus === 'completed' && (
          <div className="flex flex-col items-center gap-6 text-center w-full py-4">
            <div className="w-20 h-20 bg-axim-teal/10 rounded-full flex items-center justify-center border border-axim-teal/20 relative">
              <SafeIcon icon={FiCheckCircle} className="text-axim-teal text-4xl" />
              <div className="absolute inset-0 bg-axim-teal/5 animate-ping rounded-full"></div>
            </div>
            <div>
              <h2 className="text-3xl font-black mb-2 uppercase italic text-white">Mission Complete</h2>
              <p className="text-gray-400 text-sm max-w-xs mx-auto mb-6">
                Your encrypted lead cohort has been dispatched to your inbox.
              </p>

              <div className="bg-[#141414] border border-axim-teal shadow-[0_0_20px_rgba(0,229,255,0.15)] p-4 rounded-xl mb-6 text-left w-full max-w-md mx-auto animate-[pulse_1.5s_ease-in-out_1]">
                <h3 className="text-axim-teal text-[10px] font-black uppercase tracking-widest mb-3">Edge Receipt Manifest</h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-300">
                  <div className="text-gray-500">Industry:</div>
                  <div className="text-white">{filters?.industry || 'N/A'}</div>
                  <div className="text-gray-500">Location:</div>
                  <div className="text-white">{filters?.location || 'N/A'}</div>
                  <div className="text-gray-500">Company Size:</div>
                  <div className="text-white">{filters?.size || 'N/A'}</div>
                  {filters?.keywords && (
                    <>
                      <div className="text-gray-500">Keywords:</div>
                      <div className="text-white truncate">{filters.keywords}</div>
                    </>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="text-[10px] font-mono text-gray-500 truncate mr-2 flex-1">
                    ID: {sessionId || 'UNKNOWN'}
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(sessionId || '')}
                    className="flex items-center gap-1.5 bg-axim-teal/10 hover:bg-axim-teal/20 text-axim-teal px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-wider transition-colors"
                  >
                    Copy Receipt Ledger ID
                  </button>
                </div>
              </div>

              <Link to="/" className="flex items-center gap-2 bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white mx-auto w-fit">
                <SafeIcon icon={FiExternalLink} /> View Order History
              </Link>

              {sessionId && (
                <div className="text-gray-500 text-[10px] tracking-widest mt-4 font-mono">
                  [ONYX SUPPORT HASH: {sessionId.slice(0, 8).toUpperCase()}]
                </div>
              )}
            </div>
          </div>
        )}


        {fulfillmentStatus === 'error' && (
          <div className="flex flex-col items-center gap-4 text-center w-full py-8">
            <SafeIcon icon={FiAlertOctagon} className="text-red-500 text-5xl" />
            <h2 className="text-xl font-black uppercase italic text-red-400">Pipeline Failure</h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto mt-2">
              Please contact AXiM Support and reference your session ID:
            </p>
            <p className="font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded mt-2">{sessionId || 'UNKNOWN'}</p>
          </div>
        )}

        {fulfillmentStatus === 'refunded' && (
          <div className="flex flex-col items-center gap-6 text-center w-full py-4">
            <div className="w-20 h-20 bg-yellow-400/10 rounded-full flex items-center justify-center border border-yellow-400/20 relative">
              <SafeIcon icon={FiAlertOctagon} className="text-yellow-400 text-4xl" />
              <div className="absolute inset-0 bg-yellow-400/5 animate-ping rounded-full"></div>
            </div>
            <div>
              <h2 className="text-3xl font-black mb-2 uppercase italic text-yellow-400">EXTRACTION FAILED</h2>
              <p className="text-gray-400 text-sm max-w-xs mx-auto mb-6">
                [EXTRACTION FAILED: 0 MATCHING NODES. FULL REFUND INITIATED TO ORIGINAL PAYMENT METHOD.]
              </p>

              <div className="bg-[#141414] border border-yellow-400/50 shadow-[0_0_20px_rgba(255,234,0,0.15)] p-4 rounded-xl mb-6 text-left w-full max-w-md mx-auto">
                <h3 className="text-yellow-400 text-[10px] font-black uppercase tracking-widest mb-3">Edge Receipt Manifest</h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-300">
                  <div className="text-gray-500">Industry:</div>
                  <div className="text-white">{filters?.industry || 'N/A'}</div>
                  <div className="text-gray-500">Location:</div>
                  <div className="text-white">{filters?.location || 'N/A'}</div>
                  <div className="text-gray-500">Company Size:</div>
                  <div className="text-white">{filters?.size || 'N/A'}</div>
                  {filters?.keywords && (
                    <>
                      <div className="text-gray-500">Keywords:</div>
                      <div className="text-white truncate">{filters.keywords}</div>
                    </>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="text-[10px] font-mono text-gray-500 truncate mr-2 flex-1">
                    ID: {sessionId || 'UNKNOWN'}
                  </div>
                </div>
              </div>

              <Link to="/" className="flex items-center gap-2 bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white mx-auto w-fit">
                <SafeIcon icon={FiArrowLeft} /> Return to Terminal
              </Link>
            </div>
          </div>
        )}

        
        <LogTerminal />

        <div className="mt-10 pt-8 border-t border-white/5 w-full flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors">
            <SafeIcon icon={FiArrowLeft} /> Return to Terminal
          </Link>
          {fulfillmentStatus === 'completed' && (
            <div className="flex items-center gap-2 bg-axim-teal/5 px-3 py-1.5 rounded border border-axim-teal/10">
              <SafeIcon icon={FiMail} className="text-axim-teal text-xs" />
              <span className="font-mono text-[9px] text-axim-teal uppercase tracking-widest">DISPATCHED</span>
            </div>
          )}
          {fulfillmentStatus === 'refunded' && (
            <div className="flex items-center gap-2 bg-yellow-400/5 px-3 py-1.5 rounded border border-yellow-400/10">
              <SafeIcon icon={FiAlertOctagon} className="text-yellow-400 text-xs" />
              <span className="font-mono text-[9px] text-yellow-400 uppercase tracking-widest">REFUNDED</span>
            </div>
          )}
        </div>
      </div>

      {fulfillmentStatus === 'completed' && (
        <div className="w-full animate-in fade-in zoom-in duration-1000 slide-in-from-bottom-8">
          <Feedback 
            questId="axim-feedback" 
            userId={sessionId || "anon"} 
            styleConfig={feedbackStyle}
          />
        </div>
      )}
    </div>
  );
}