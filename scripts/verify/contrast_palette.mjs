#!/usr/bin/env node
/**
 * CALCUL DE CONTRASTE WCAG 2.1 — palette officielle Design-tokens.md v2.0
 * Usage : node scripts/verify/contrast_palette.mjs
 * Source : docs/Design-tokens.md §1 (palette officielle).
 * Tonalités : tok / hex / luminance relative / ratio sur #FAF8F5 et #FBFAF6
 *             (fond stone-50 / papier) + statut AA/AAA texte normal.
 */
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
const FOND = ['FAF8F5', 'FBFAF6']; // stone-50 / papier

const palette = [
  ['label (texte 1er)',       '17402C'],
  ['label-secondary / sage-700', '365233'],
  ['label-tertiary',          '5A7064'],
  ['sage-500 (primaire)',     '5B7F55'],
  ['sage-300',                'A6C1A0'],
  ['warn',                    'C89A3B'],
  ['warn texte',              '8C6418'],
  ['danger',                  'A8443A'],
  ['danger texte',            '8A241B'],
  ['info',                    '4B6B7C'],
];

console.log('Contraste WCAG sur fond (AA normal = 4.5:1 · AA grand = 3:1)');
console.log('| Tonalité | hex | #FAF8F5 | AA | #FBFAF6 | AA |');
for (const [name, hex] of palette) {
  const r1 = ratio('#' + hex, '#' + FOND[0]);
  const r2 = ratio('#' + hex, '#' + FOND[1]);
  console.log(
    `| ${name} | #${hex.toLowerCase()} | ${r1.toFixed(2)}:1 | ${r1 >= 4.5 ? '✓' : r1 >= 3 ? 'grand' : '✗'} | ${r2.toFixed(2)}:1 | ${r2 >= 4.5 ? '✓' : r2 >= 3 ? 'grand' : '✗'} |`
  );
}

console.log('\nPaires utiles complémentaires :');
const pairs = [
  ['blanc sur sage-500', 'FFFFFF', '5B7F55'],
  ['blanc sur sage-700', 'FFFFFF', '365233'],
  ['sage-700 sur sage-300', '365233', 'A6C1A0'],
  ['label sur blanc', '17402C', 'FFFFFF'],
];
for (const [name, a, b] of pairs) {
  const r = ratio('#' + a, '#' + b);
  console.log(`  ${name} : ${r.toFixed(2)}:1 ${r >= 4.5 ? '✓ AA' : r >= 3 ? '(grand uniquement)' : '✗'}`);
}