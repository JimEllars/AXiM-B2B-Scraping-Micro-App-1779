import React from 'react';
import SafeIcon from '../common/SafeIcon';
import { FiShield, FiCheckCircle, FiZap, FiDatabase } from 'react-icons/fi';

export default function TrustSignals() {
  const signals = [
    { icon: FiShield, title: "SMTP VERIFIED", desc: "No bounce-backs guaranteed." },
    { icon: FiZap, title: "REAL-TIME", desc: "Scraped at moment of order." },
    { icon: FiCheckCircle, title: "LEGAL", desc: "GDPR & CAN-SPAM Compliant." },
    { icon: FiDatabase, title: "ENRICHED", desc: "Phone, Email & Firmographics." }
  ];

  return (
    <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 mb-8">
      {signals.map((s, i) => (
        <div key={i} className="flex flex-col items-center text-center p-4 border border-white/5 rounded-xl bg-white/[0.01]">
          <SafeIcon icon={s.icon} className="text-axim-teal text-lg mb-2" />
          <h4 className="text-[9px] font-black text-white uppercase mb-1">{s.title}</h4>
          <p className="text-[8px] text-gray-500 leading-tight uppercase font-medium">{s.desc}</p>
        </div>
      ))}
    </div>
  );
}