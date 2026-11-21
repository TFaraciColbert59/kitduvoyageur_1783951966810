// node --test tools/grade/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTransform, buildTable, toCube, PARAMS } from './build-lut.mjs';
import { hexToRgb, srgbToLab, deltaE2000, srgbToOklab, oklabToLch, hueDiff, displayLuma, parseCube } from './lib/color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const dE = (a, b) => deltaE2000(srgbToLab(a), srgbToLab(b));
const hue = (rgb) => oklabToLch(srgbToOklab(rgb))[2];

test('gris : rampe strictement monotone aux trois forces', () => {
  for (const s of [0.6, 1, 1.3]) {
    const t = makeTransform(s);
    let prev = -1;
    for (let i = 0; i <= 255; i++) {
      const y = displayLuma(t([i / 255, i / 255, i / 255]));
      assert.ok(y >= prev - 1e-9, `force ${s}, gris ${i}`);
      prev = y;
    }
  }
});

test('noir pur jamais pur, vert et proche de l’encre ; blanc crème', () => {
  const t = makeTransform(1);
  const k = t([0, 0, 0]);
  assert.ok(k[1] > k[0] && k[1] > k[2], 'noir teinté vert');
  assert.ok(Math.max(...k) > 0.03, 'noir relevé');
  assert.ok(dE(k, hexToRgb(PARAMS.blackPoint)) < 8);
  assert.ok(dE(t([1, 1, 1]), hexToRgb(PARAMS.whitePoint)) < 1);
});

test('étalonnage léger : peaux, olive du sac et turquoise quasi intacts', () => {
  const t = makeTransform(1);
  for (const hex of ['#E8B898', '#C68863', '#7A4E35', '#8A9A3A', '#3FC1C0', '#E2701E']) {
    const c = hexToRgb(hex), o = t(c);
    assert.ok(dE(c, o) < 2, `${hex} ΔE ${dE(c, o).toFixed(2)}`);
    assert.ok(Math.abs(hueDiff(hue(o), hue(c))) < 2.5, `${hex} teinte`);
  }
});

test('verts francs retenus vers le sauge', () => {
  const t = makeTransform(1);
  const g = hexToRgb('#3C8C3C');
  assert.ok(oklabToLch(srgbToOklab(t(g)))[1] < oklabToLch(srgbToOklab(g))[1] * 0.92);
});

test('le cube livré est bien celui que produit le script', () => {
  const file = resolve(HERE, '../../film/assets/luts/lkdv-trailer.cube');
  const text = readFileSync(file, 'utf8');
  const { size, table } = parseCube(text);
  assert.equal(size, 33);
  assert.equal(text, toCube(buildTable(1), 33, 1));
  assert.ok(table.every((v) => v >= 0 && v <= 1));
});
