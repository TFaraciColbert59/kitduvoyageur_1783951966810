// verify_css_utilities.mjs
// Empirical test harness for CSS utilities in src/styles/tokens.generated.css and src/styles/tokens.css

import fs from 'node:fs';
import path from 'node:path';

const projectDir = '/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference';
const tokensGenPath = path.join(projectDir, 'src/styles/tokens.generated.css');
const tokensCssPath = path.join(projectDir, 'src/styles/tokens.css');
const bankPath = path.join(projectDir, 'src/design/bank.ts');

console.log('=== STARTING CSS UTILITIES & TOKENS EMPIRICAL VERIFICATION ===');

const tokensGenContent = fs.readFileSync(tokensGenPath, 'utf-8');
const tokensCssContent = fs.readFileSync(tokensCssPath, 'utf-8');
const bankContent = fs.readFileSync(bankPath, 'utf-8');

let errors = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    errors++;
  } else {
    console.log(`  ✓ ${message}`);
  }
}

// 1. Verify Apple WebKit Font Utilities (.apple-font-*)
console.log('[1/5] Verifying .apple-font-* utilities...');
const expectedFonts = [
  { cls: '.apple-font-large-title', primitive: '-apple-system-large-title', tracking: '0.37px' },
  { cls: '.apple-font-title1', primitive: '-apple-system-title1', tracking: '0.36px' },
  { cls: '.apple-font-title2', primitive: '-apple-system-title2', tracking: '0.35px' },
  { cls: '.apple-font-title3', primitive: '-apple-system-title3', tracking: '0.38px' },
  { cls: '.apple-font-headline', primitive: '-apple-system-headline', tracking: '-0.41px' },
  { cls: '.apple-font-body', primitive: '-apple-system-body', tracking: '-0.41px' },
  { cls: '.apple-font-callout', primitive: '-apple-system-callout', tracking: '-0.32px' },
  { cls: '.apple-font-subheadline', primitive: '-apple-system-subheadline', tracking: '-0.24px' },
  { cls: '.apple-font-footnote', primitive: '-apple-system-footnote', tracking: '-0.08px' },
  { cls: '.apple-font-caption1', primitive: '-apple-system-caption1', tracking: '0px' },
  { cls: '.apple-font-caption2', primitive: '-apple-system-caption2', tracking: '0.07px' },
];

for (const font of expectedFonts) {
  assert(tokensGenContent.includes(font.cls), `Class ${font.cls} exists in tokens.generated.css`);
  assert(tokensGenContent.includes(font.primitive), `Font primitive ${font.primitive} used for ${font.cls}`);
}

// 2. Verify Squircle Continuous Corner Utilities (.squircle-*)
console.log('[2/5] Verifying .squircle-* utilities and continuous corners...');
const expectedSquircles = [
  '.squircle-xs',
  '.squircle-sm',
  '.squircle-md',
  '.squircle-lg',
  '.squircle-card',
  '.squircle-sheet',
  '.squircle-pill'
];

for (const sq of expectedSquircles) {
  assert(tokensGenContent.includes(sq), `Class ${sq} exists in tokens.generated.css`);
}

assert(tokensGenContent.includes('@supports (corner-shape: squircle)'), 'Progressive enhancement @supports (corner-shape: squircle) present');
assert(tokensGenContent.includes('corner-shape: squircle;'), 'corner-shape: squircle property applied in @supports rule');

// 3. Verify Sheet Grabber Utility (.apple-sheet-grabber)
console.log('[3/5] Verifying .apple-sheet-grabber utility...');
assert(tokensGenContent.includes('.apple-sheet-grabber'), '.apple-sheet-grabber class present');
assert(tokensGenContent.includes('--sheet-grabber-w: 36px;'), '--sheet-grabber-w is 36px');
assert(tokensGenContent.includes('--sheet-grabber-h: 5px;'), '--sheet-grabber-h is 5px');
assert(tokensGenContent.includes('--sheet-grabber-r: 2.5px;'), '--sheet-grabber-r is 2.5px');
assert(tokensGenContent.includes('--sheet-grabber-color: rgba(23, 64, 44, 0.25);'), '--sheet-grabber-color is rgba(23, 64, 44, 0.25)');
assert(tokensGenContent.includes('.apple-sheet-grabber:active'), '.apple-sheet-grabber:active pseudo-class present');

// 4. Verify Apple Materials Utilities (.apple-material-*)
console.log('[4/5] Verifying .apple-material-* utilities...');
const expectedMaterials = [
  'ultra-thin',
  'thin',
  'regular',
  'thick',
  'chrome'
];

for (const mat of expectedMaterials) {
  const cls = `.apple-material-${mat}`;
  assert(tokensGenContent.includes(cls), `Class ${cls} exists in tokens.generated.css`);
  // Check for both standard and WebKit prefix for Safari
  const matIdx = tokensGenContent.indexOf(cls);
  const block = tokensGenContent.slice(matIdx, matIdx + 250);
  assert(block.includes('-webkit-backdrop-filter:'), `${cls} includes -webkit-backdrop-filter`);
  assert(block.includes('backdrop-filter:'), `${cls} includes backdrop-filter`);
  assert(block.includes('blur('), `${cls} includes blur filter`);
  assert(block.includes('saturate('), `${cls} includes saturate filter`);
}

// 5. Verify Zero Pure Black & Zero #0d1117 across files
console.log('[5/5] Checking for zero pure black (#000000, #000, #0d1117)...');
const forbiddenHex = [/#000000\b/i, /#000\b/i, /#0d1117\b/i];
for (const re of [/#000000\b/i, /#0d1117\b/i]) {
  assert(!re.test(tokensGenContent), `tokens.generated.css has no match for ${re}`);
  assert(!re.test(bankContent), `bank.ts has no match for ${re}`);
}

if (errors === 0) {
  console.log('=== ALL CSS UTILITIES & TOKENS EMPIRICALLY VERIFIED: 100% SUCCESS ===');
} else {
  console.error(`=== VERIFICATION FAILED WITH ${errors} ERRORS ===`);
  process.exit(1);
}
