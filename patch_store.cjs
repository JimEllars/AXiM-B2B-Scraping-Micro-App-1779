const fs = require('fs');
let code = fs.readFileSync('src/store/useScraperStore.js', 'utf8');

// Ensure checkoutError is stored properly for the UI Escape Hatch
const initiateCheckoutCatchRegex = /const errorMessage = err\.message \|\| 'PROTOCOL_ABORTED';\s*if \(errorMessage\.includes\("429"\) \|\| errorMessage\.includes\("Too Many Requests"\)\) \{\s*set\(\{ checkoutError: 'RATE_LIMIT_EXCEEDED' \}\);\s*\}/;

const newInitiateCheckoutCatch = `const errorMessage = err.message || 'PROTOCOL_ABORTED';
      if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests")) {
        set({ checkoutError: 'RATE_LIMIT_EXCEEDED' });
      } else {
        set({ checkoutError: errorMessage });
      }`;

code = code.replace(initiateCheckoutCatchRegex, newInitiateCheckoutCatch);
fs.writeFileSync('src/store/useScraperStore.js', code);
