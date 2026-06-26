const fs = require('fs');
let code = fs.readFileSync('src/components/Wizard.jsx', 'utf8');

const checkoutErrorRegex = /\{checkoutError === 'RATE_LIMIT_EXCEEDED' && \(\s*<div className="bg-red-500\/10 border border-red-500 text-red-500 p-3 rounded-lg text-center w-full mb-2">\s*<p className="text-\[10px\] font-mono font-bold uppercase tracking-\[0\.2em\]">\[NETWORK REJECTED\] RATE LIMIT EXCEEDED\. PLEASE WAIT 60 SECONDS\.<\/p>\s*<\/div>\s*\)\}/;

const newCheckoutError = `{checkoutError === 'RATE_LIMIT_EXCEEDED' ? (
                <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg text-center w-full mb-2">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">[NETWORK REJECTED] RATE LIMIT EXCEEDED. PLEASE WAIT 60 SECONDS.</p>
                </div>
              ) : (
                <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg text-center w-full mb-2">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">[SYSTEM FAULT] {checkoutError}</p>
                </div>
              )}`;

code = code.replace(checkoutErrorRegex, newCheckoutError);
fs.writeFileSync('src/components/Wizard.jsx', code);
