const fs = require('fs');
const content = fs.readFileSync('src/components/compte/CompteLiquidGlassV8.tsx', 'utf8');
const idx = content.indexOf('maplibre-compte-canvas');
console.log(content.slice(idx - 100, idx + 300));
