const fs = require('fs');
let code = fs.readFileSync('src/pages/Success.jsx', 'utf8');

const oldClasses = 'bg-[#141414] border border-axim-teal shadow-[0_0_15px_rgba(0,229,255,0.4)] p-4 rounded-xl mb-6 text-left w-full max-w-md mx-auto animate-[pulse_1.5s_ease-in-out_1]';
const newClasses = 'bg-[#141414] border border-axim-teal shadow-[0_0_20px_rgba(0,229,255,0.15)] p-4 rounded-xl mb-6 text-left w-full max-w-md mx-auto animate-[pulse_1.5s_ease-in-out_1]';

code = code.replace(oldClasses, newClasses);
fs.writeFileSync('src/pages/Success.jsx', code);
