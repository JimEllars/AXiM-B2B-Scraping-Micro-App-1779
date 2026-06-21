import React from 'react';
import SafeIcon from '../common/SafeIcon';
import { FiCheck, FiDatabase, FiSmartphone, FiMail, FiLinkedin, FiMapPin, FiBriefcase } from 'react-icons/fi';

const fields = [
  { label: 'Direct Email', icon: FiMail },
  { label: 'Direct Dial', icon: FiSmartphone },
  { label: 'LinkedIn URL', icon: FiLinkedin },
  { label: 'Job Title', icon: FiBriefcase },
  { label: 'HQ Location', icon: FiMapPin },
  { label: 'Company Size', icon: FiDatabase },
];

export default function DataSchema() {
  return (
    <div className="mt-8 w-full">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Output Payload Schema</h3>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((field, idx) => (
          <div key={idx} className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex items-center gap-3 group hover:border-axim-teal/30 transition-all">
            <div className="w-6 h-6 rounded bg-axim-teal/10 flex items-center justify-center">
              <SafeIcon icon={field.icon} className="text-axim-teal text-[10px]" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</span>
            <SafeIcon icon={FiCheck} className="ml-auto text-axim-teal/40 text-[10px]" />
          </div>
        ))}
      </div>
    </div>
  );
}