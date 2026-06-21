import React from 'react';
import Wizard from '../components/Wizard';
import LeadPreview from '../components/LeadPreview';
import NetworkStats from '../components/NetworkStats';
import NetworkFeed from '../components/NetworkFeed';
import TrustSignals from '../components/TrustSignals';
import DataSchema from '../components/DataSchema';
import NodeMap from '../components/NodeMap';
import SafeIcon from '../common/SafeIcon';
import { FiActivity, FiLayers, FiCpu } from 'react-icons/fi';
import { GetStarted } from '@questlabs/react-sdk';

export default function Home() {
  const getStartedStyle = {
    Form: { backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '32px' },
    Heading: { color: '#ffffff', fontSize: '20px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' },
    Description: { color: '#6b7280', fontSize: '13px' },
    Card: { backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' },
    PrimaryButton: { backgroundColor: '#00e5ff', color: '#000000', fontWeight: '900', borderRadius: '8px' },
    ProgressBar: { 
      barColor: '#00e5ff', 
      barParentColor: '#1a1a1a', 
      ProgressText: { color: '#ffffff', fontWeight: '900', fontSize: '12px' } 
    }
  };

  return (
    <div className="w-full max-w-6xl flex flex-col items-center py-12 px-6">
      <NetworkFeed />
      
      <div className="w-full grid lg:grid-cols-[1.1fr_0.9fr] gap-16">
        {/* Left Column: Mission Control */}
        <div className="flex flex-col">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="px-2 py-0.5 bg-axim-teal/10 border border-axim-teal/20 rounded text-[8px] font-black text-axim-teal uppercase tracking-widest">v2.4 Stable</div>
                <div className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-black text-gray-500 uppercase tracking-widest">Edge-Optimized</div>
              </div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic text-white">
                AXiM <span className="text-axim-teal">B2B</span> Scraper
              </h1>
              <p className="text-[11px] font-mono text-gray-500 tracking-[0.2em] uppercase mt-2">Decentralized Lead Acquisition Protocol</p>
            </div>
            <SafeIcon icon={FiCpu} className="text-white/10 text-5xl hidden sm:block" />
          </div>

          <Wizard />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <LeadPreview />
            <DataSchema />
          </div>
          
          <NetworkStats />
        </div>

        {/* Right Column: Intelligence & Trust */}
        <div className="space-y-10">
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-axim-teal/5 blur-3xl rounded-full"></div>
            <GetStarted 
              questId="axim-onboarding" 
              userId="vis_123" 
              styleConfig={getStartedStyle}
            />
          </div>

          <NodeMap />
          
          <div className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-6 flex items-center gap-2">
              <div className="w-1 h-3 bg-axim-teal rounded-full"></div>
              Compliance & Security
            </h3>
            <TrustSignals />
          </div>
          
          <div className="p-6 border border-axim-teal/10 rounded-2xl bg-axim-teal/[0.02] flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-axim-teal/10 flex items-center justify-center shrink-0">
              <SafeIcon icon={FiActivity} className="text-axim-teal" />
            </div>
            <div>
              <h4 className="text-[11px] font-black text-white uppercase mb-1">Dual-Benefit Logic</h4>
              <p className="text-[10px] text-gray-500 leading-relaxed uppercase">
                Every extraction is mirrored to your AXiM Core CRM (Deskera/Albato) for immediate automation and follow-up sequences.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}