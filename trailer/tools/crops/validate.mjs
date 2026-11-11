#!/usr/bin/env node
// Validateur de film/crops.json.
//   node tools/crops/validate.mjs [crops.json]       -> code 1 et liste des fautes si invalide
// Contrôles : les 54 plans de la trame, dans l'ordre, aux mêmes images (et à film/shots.json s'il existe) ;
// rapport 9:16 exact à RATIO_TOL près ; cadres dans l'image ; point d'intérêt dans le cadre de début et de fin ;
// plans ★ de la trame marqués « star » ; cas particuliers P14 (trois bandes) et P46 (timelapse) ; statut provisoire.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTrame } from './trame.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CROPS = resolve(HERE, '../../film/crops.json');
export const SHOTS = resolve(HERE, '../../film/shots.json');
// 9:16 découpé dans du 16:9, en pourcentages : w% / h% = (9/16) × (9/16) = 81/256
export const RATIO_9x16 = 81 / 256;
// tranche 1080×640 de P14 : w% / h% = (1080/640) × (9/16)
export const RATIO_STRIPE = (1080 / 640) * (9 / 16);
export const RATIO_TOL = 0.005; // 0,5 % relatif (les valeurs sont arrondies au centième de %)
export const STARS = ['p26', 'p27', 'p30', 'p38', 'p40', 'p42', 'p43', 'p50'];
const EPS = 1e-6;

function checkRect(r, label, ratio, errs) {
  if (!r || typeof r !== 'object') return errs.push(`${label} : cadre absent`);
  for (const k of ['x', 'y', 'w', 'h']) if (!Number.isFinite(r[k])) return errs.push(`${label} : ${k} manquant`);
  if (r.w <= 0 || r.h <= 0) errs.push(`${label} : taille nulle`);
  if (r.x < -EPS || r.y < -EPS || r.x + r.w > 100 + EPS || r.y + r.h > 100 + EPS) errs.push(`${label} : sort de l'image (${r.x}, ${r.y}, ${r.w}, ${r.h})`);
  const q = r.w / r.h;
  if (Math.abs(q / ratio - 1) > RATIO_TOL) errs.push(`${label} : rapport ${q.toFixed(4)} au lieu de ${ratio.toFixed(4)}`);
}
const inside = (p, r) => p.x >= r.x - EPS && p.x <= r.x + r.w + EPS && p.y >= r.y - EPS && p.y <= r.y + r.h + EPS;

export function validate(data, trame, shotsJson = null) {
  const errs = [];
  const shots = data?.shots;
  if (!Array.isArray(shots)) return ['« shots » absent'];
  if (trame.length !== 54) errs.push(`la trame donne ${trame.length} plans au lieu de 54`);
  const ids = shots.map((s) => s.id);
  for (const t of trame) if (!ids.includes(t.id)) errs.push(`${t.id} : plan oublié`);
  const seen = new Set();
  shots.forEach((s, i) => {
    const L = s.id ?? `#${i}`;
    if (seen.has(s.id)) errs.push(`${L} : en double`);
    seen.add(s.id);
    const t = trame.find((x) => x.id === s.id);
    if (!t) return errs.push(`${L} : absent de la trame`);
    if (trame[i]?.id !== s.id) errs.push(`${L} : hors de l'ordre de la trame`);
    if (!Array.isArray(s.frames) || s.frames[0] !== t.startFrame || s.frames[1] !== t.endFrame) errs.push(`${L} : images ${s.frames} au lieu de ${t.startFrame}–${t.endFrame}`);
    const sj = shotsJson?.shots?.find((x) => x.id === s.id);
    if (shotsJson && (!sj || sj.startFrame !== s.frames?.[0] || sj.endFrame !== s.frames?.[1])) errs.push(`${L} : ne correspond pas à film/shots.json`);
    if (!/provisoire/.test(s.status || '')) errs.push(`${L} : statut « provisoire » manquant`);
    if (!s.poi || !Number.isFinite(s.poi.x) || !Number.isFinite(s.poi.y)) errs.push(`${L} : point d'intérêt manquant`);
    const star = STARS.includes(s.id);
    if (star !== (s.type === 'star')) errs.push(`${L} : type « star » ${star ? 'manquant' : 'en trop'}`);
    if (t.star !== star) errs.push(`${L} : ★ de la trame et liste des plans ★ divergent`);
    if (star && !s.fallback) errs.push(`${L} : plan ★ sans repli décrit`);
    if (s.id === 'p14') {
      if (s.layout !== 'trois-bandes-empilees' || !Array.isArray(s.bands) || s.bands.length !== 3) return errs.push(`${L} : trois bandes attendues`);
      s.bands.forEach((b, k) => { checkRect(b.start, `${L} bande ${k + 1} début`, RATIO_STRIPE, errs); if (b.end) checkRect(b.end, `${L} bande ${k + 1} fin`, RATIO_STRIPE, errs); });
      return;
    }
    if (s.id === 'p46' && (s.layout !== 'timelapse-meme-cadre' || s.sources?.length !== 2)) errs.push(`${L} : timelapse à deux images et cadre commun attendu`);
    checkRect(s.start, `${L} début`, RATIO_9x16, errs);
    if (s.end !== null) checkRect(s.end, `${L} fin`, RATIO_9x16, errs);
    if (s.poi && s.start && !inside(s.poi, s.start)) errs.push(`${L} : point d'intérêt hors du cadre de début`);
    if (s.poi && s.end && !inside(s.poi, s.end)) errs.push(`${L} : point d'intérêt hors du cadre de fin`);
  });
  return errs;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = resolve(process.argv[2] || CROPS);
  const shotsJson = existsSync(SHOTS) ? JSON.parse(readFileSync(SHOTS, 'utf8')) : null;
  const errs = validate(JSON.parse(readFileSync(file, 'utf8')), readTrame(), shotsJson);
  if (errs.length) { console.error(`${errs.length} faute(s) dans ${file} :\n- ${errs.join('\n- ')}`); process.exit(1); }
  console.log(`crops.json valide : 54 plans, rapport 9:16 à ${RATIO_TOL * 100} % près, cadres dans l'image${shotsJson ? ', conforme à shots.json' : ''}.`);
}
