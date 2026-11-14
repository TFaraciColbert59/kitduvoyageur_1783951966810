import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

// Extract parseColorToSwift exactly as in scripts/generate-design-bank.mjs
function parseColorToSwift(str) {
  if (!str) return { uiColor: 'UIColor.clear', swiftColor: 'Color.clear' };
  const trimmed = str.trim();

  // Hex format #RGB, #RRGGBB, #RRGGBBAA
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex.slice(0, 6), 16);
    const r = ((num >> 16) & 255);
    const g = ((num >> 8) & 255);
    const b = (num & 255);
    let a = 1.0;
    if (hex.length === 8) {
      a = Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 1000) / 1000;
    }
    return {
      uiColor: `UIColor(red: ${r}.0/255.0, green: ${g}.0/255.0, blue: ${b}.0/255.0, alpha: ${a})`,
      swiftColor: `Color(red: ${r}.0/255.0, green: ${g}.0/255.0, blue: ${b}.0/255.0, opacity: ${a})`
    };
  }

  // RGBA format rgba(r, g, b, a)
  const rgbaMatch = trimmed.match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const r = parseFloat(rgbaMatch[1]);
    const g = parseFloat(rgbaMatch[2]);
    const b = parseFloat(rgbaMatch[3]);
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1.0;
    return {
      uiColor: `UIColor(red: ${r}.0/255.0, green: ${g}.0/255.0, blue: ${b}.0/255.0, alpha: ${a})`,
      swiftColor: `Color(red: ${r}.0/255.0, green: ${g}.0/255.0, blue: ${b}.0/255.0, opacity: ${a})`
    };
  }

  return { uiColor: 'UIColor.clear', swiftColor: 'Color.clear' };
}

const testCases = [
  // Hex 3
  { input: '#fff', desc: 'Hex 3 lowercase white' },
  { input: '#FFF', desc: 'Hex 3 uppercase white' },
  { input: '#123', desc: 'Hex 3 custom color' },
  
  // Hex 6
  { input: '#17402C', desc: 'Hex 6 LKDV primary' },
  { input: '#FBFAF6', desc: 'Hex 6 LKDV canvas' },
  { input: '#abcdef', desc: 'Hex 6 lowercase' },

  // Hex 8
  { input: '#17402C80', desc: 'Hex 8 with 50% alpha' },
  { input: '#FFFFFFFF', desc: 'Hex 8 white 100% alpha' },
  { input: '#00000000', desc: 'Hex 8 zero alpha' },

  // RGBA standard
  { input: 'rgba(23, 64, 44, 0.25)', desc: 'Standard rgba with alpha' },
  { input: 'rgb(23, 64, 44)', desc: 'Standard rgb without alpha' },

  // Whitespace variations
  { input: '   #17402C   ', desc: 'Hex with outer whitespace' },
  { input: 'rgba(  23  ,  64  ,  44  ,  0.25  )', desc: 'RGBA with inner whitespace' },
  { input: 'rgb( 23 , 64 , 44 )', desc: 'RGB with inner whitespace' },

  // Decimals & leading dot in RGBA
  { input: 'rgba(23, 64, 44, .25)', desc: 'RGBA alpha with leading dot (.25)' },
  { input: 'rgba(23, 64, 44, 1.0)', desc: 'RGBA alpha 1.0' },
  { input: 'rgba(23, 64, 44, 0)', desc: 'RGBA alpha 0' },
  { input: 'rgba(23.5, 64.2, 44.8, 0.5)', desc: 'RGBA with decimal RGB channels (adversarial)' },

  // Non-standard hex lengths
  { input: '#1234', desc: 'Hex 4 (CSS #RGBA)' },
  { input: '#12345', desc: 'Hex 5 (invalid in CSS)' },
  { input: '#1234567', desc: 'Hex 7 (invalid in CSS)' },
  { input: '#123456789', desc: 'Hex 9 (invalid in CSS)' },

  // Invalid / unsupported colors
  { input: '', desc: 'Empty string' },
  { input: null, desc: 'null' },
  { input: undefined, desc: 'undefined' },
  { input: '#', desc: 'Single hash' },
  { input: '#zzzzzz', desc: 'Invalid hex characters' },
  { input: 'hsl(120, 50%, 50%)', desc: 'HSL color' },
  { input: 'transparent', desc: 'Named color transparent' },
  { input: 'var(--lkv-primary)', desc: 'CSS var' },
];

console.log('Testing parseColorToSwift against', testCases.length, 'cases:');

const results = [];
let swiftSnippet = `import UIKit\nimport SwiftUI\n\nfunc testColors() {\n`;

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  let res;
  let error = null;
  try {
    res = parseColorToSwift(tc.input);
  } catch (err) {
    error = err.message;
  }
  results.push({ ...tc, res, error });

  if (res) {
    swiftSnippet += `  // Case ${i}: ${tc.desc} (${tc.input})\n`;
    swiftSnippet += `  let _ = ${res.uiColor}\n`;
    swiftSnippet += `  let _ = ${res.swiftColor}\n`;
  }
}

swiftSnippet += `}\n`;

// Print results summary
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  console.log(`[Case ${i}] ${r.desc} -> Input: "${r.input}"`);
  if (r.error) {
    console.log(`   ERROR: ${r.error}`);
  } else {
    console.log(`   uiColor:    ${r.res.uiColor}`);
    console.log(`   swiftColor: ${r.res.swiftColor}`);
  }
}

// Now write swiftSnippet to a temporary swift file in challenger folder and test with swiftc
const swiftTestPath = resolve('/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/challenger_m1_1/test_colors.swift');
writeFileSync(swiftTestPath, swiftSnippet, 'utf8');

console.log('\n--- Compiling generated Swift code with xcrun swiftc ---');
try {
  const stdout = execSync(`xcrun -sdk iphonesimulator swiftc -target arm64-apple-ios17.0-simulator -typecheck "${swiftTestPath}"`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.log('✅ Swiftc compilation succeeded without error!');
} catch (err) {
  console.error('❌ Swiftc compilation FAILED:');
  console.error(err.stderr || err.stdout);
} finally {
  try { unlinkSync(swiftTestPath); } catch {}
}
