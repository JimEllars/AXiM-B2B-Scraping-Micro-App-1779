import React from 'react';
import { logError } from '../utils/telemetry';
import SafeIcon from '../common/SafeIcon';
import { FiAlertOctagon } from 'react-icons/fi';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError('REACT_TREE_CRASH', { message: error.message, stack: errorInfo.componentStack });
    try {
      fetch('https://api.axim.us.com/v1/telemetry/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: "CLIENT_INTERFACE_CRASH",
          metadata: { error: error?.toString(), stack: errorInfo?.componentStack }
        })
      }).catch(e => {
        // Silently catch fetch errors (e.g., blocked by ad-blocker)
      });
    } catch (e) {
      // Silently catch synchronous errors
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-void text-white font-sans flex flex-col items-center justify-center relative p-4">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

          <div className="bg-[#0a0a0a] border border-red-500/20 p-10 rounded-3xl w-full max-w-xl shadow-[0_0_60px_rgba(239,68,68,0.05)] relative overflow-hidden flex flex-col items-center text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>

            <SafeIcon icon={FiAlertOctagon} className="text-red-500 text-6xl mb-6" />

            <h2 className="text-2xl font-black text-red-500 uppercase tracking-tight flex items-center gap-3 italic mb-2">
              System Error
            </h2>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.2em] mb-8">
              A critical fault has occurred in the application tree.
            </p>

            <button
              onClick={() => window.location.reload()}
              className="bg-red-500/10 text-red-400 border border-red-500/20 font-black uppercase tracking-[0.2em] px-8 py-4 rounded-xl hover:bg-red-500 hover:text-black transition-all duration-300"
            >
              Reboot Terminal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
