// node --test tools/crops/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, CROPS, RATIO_9x16 } from './validate.mjs';
import { readTrame } from './trame.mjs';
import { band, seed } from './seed.mjs';

const trame = readTrame();
const load = () => JSON.parse(readFileSync(CROPS, 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const shot = (d, id) => d.shots.find((s) => s.id === id);

test('la trame donne 54 plans et 8 plans ★', () => {
  assert.equal(trame.length, 54);
  assert.deepEqual(trame.filter((t) => t.star).map((t) => t.id), ['p26', 'p27', 'p30', 'p38', 'p40', 'p42', 'p43', 'p50']);
});

test('film/crops.json est valide, et la graine aussi', () => {
  assert.deepEqual(validate(load(), trame), []);
  assert.deepEqual(validate(seed(), trame), []);
});

test('band() donne un 9:16 exact, ramené dans l\'image', () => {
  const b = band(98, 100);
  assert.ok(Math.abs(b.w / b.h - RATIO_9x16) < 1e-3);
  assert.ok(b.x + b.w <= 100.0001 && b.x >= 0);
});

test('fautes détectées', () => {
  const base = load();
  const cases = [
    ['plan oublié', (d) => d.shots.splice(10, 1), /p11 : plan oublié/],
    ['mauvais rapport', (d) => { shot(d, 'p07').start.w += 3; }, /p07 début : rapport/],
    ['hors image', (d) => { shot(d, 'p20').end.x = 80; }, /p20 fin : sort de l'image/],
    ['point d\'intérêt hors cadre', (d) => { shot(d, 'p30').poi.x = 5; }, /p30 : point d'intérêt hors/],
    ['★ non marqué', (d) => { shot(d, 'p42').type = 'paysage'; }, /p42 : type « star » manquant/],
    ['mauvaises images', (d) => { shot(d, 'p33').frames = [2009, 2064]; }, /p33 : images/],
    ['P14 sans bandes', (d) => { delete shot(d, 'p14').bands; }, /p14 : trois bandes/],
    ['statut', (d) => { shot(d, 'p01').status = 'final'; }, /p01 : statut/],
  ];
  for (const [name, mutate, re] of cases) {
    const d = clone(base);
    mutate(d);
    const errs = validate(d, trame);
    assert.ok(errs.some((e) => re.test(e)), `${name} : ${errs.join(' | ')}`);
  }
});
