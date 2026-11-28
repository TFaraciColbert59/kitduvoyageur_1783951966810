// Compas — note d'un passage de validation (voir validate-online.mjs) contre la grille
// docs/compas/phase7/attendus.json : préparation prête, pays, zone de l'ancre, durée.
//
// Usage :
//   node scripts/compas/score-run.mjs <dossier> [--trips voyages.json] [--md]
//
// Le voyage de chaque phrase est lu dans results.jsonl (champ `trip`, écrit par le lanceur
// quand il a une session d'essai). Pour un ancien passage sans ce champ, --trips donne la
// liste des voyages relus en base (même forme que `trip`, avec `say` ou dans l'ordre des
// phrases). « Lieu juste » = prête, pays attendu et ancre dans la zone attendue s'il y en a
// une ; la durée est notée à part.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--trips');
if (!dir) {
  console.error('Usage : node scripts/compas/score-run.mjs <dossier> [--trips voyages.json] [--md]');
  process.exit(2);
}
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const phase7 = path.join(root, 'docs/compas/phase7');
const expected = JSON.parse(fs.readFileSync(path.join(phase7, 'attendus.json'), 'utf8'));
const idOf = new Map();
for (const [prefix, file] of [
  ['FE', 'demandes-france-europe.json'],
  ['MO', 'demandes-monde.json'],
]) {
  JSON.parse(fs.readFileSync(path.join(phase7, file), 'utf8')).forEach((say, i) =>
    idOf.set(say, `${prefix}${String(i + 1).padStart(2, '0')}`)
  );
}

const rows = fs
  .readFileSync(path.join(dir, 'results.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => typeof r.say === 'string');
const extra = opt('--trips') ? JSON.parse(fs.readFileSync(opt('--trips'), 'utf8')) : null;

const days = (t) =>
  t?.start && t?.end ? Math.round((Date.parse(t.end) - Date.parse(t.start)) / 86_400_000) + 1 : null;
const inZone = (t, zone) => {
  if (!zone) return true;
  const lat = Number(t?.anchor?.lat);
  const lon = Number(t?.anchor?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return lat >= zone[0] && lat <= zone[1] && lon >= zone[2] && lon <= zone[3];
};

const scored = rows.map((r, k) => {
  const id = idOf.get(r.say) ?? null;
  const want = id ? expected[id] : null;
  // Liste relue en base : par phrase quand elle les porte (une phrase sans voyage n'en prend aucun),
  // sinon dans l'ordre des phrases.
  const bySay = extra?.some((t) => typeof t.say === 'string');
  const trip = r.trip ?? (extra ? (bySay ? extra.find((t) => t.say === r.say) ?? null : extra[k] ?? null) : null);
  const ready = !r.error && /Ton aventure est prête/.test(r.head ?? '');
  const country = trip?.country ?? null;
  const countryOk = Boolean(want && country && want.pays.includes(country));
  const zoneOk = Boolean(want && trip && inZone(trip, want.zone));
  const d = days(trip);
  return {
    id,
    say: r.say,
    ready,
    place: trip?.anchor?.name ?? trip?.destination ?? null,
    country,
    days: d,
    placeOk: ready && countryOk && zoneOk,
    daysOk: Boolean(want && d === want.jours),
    want,
    error: r.error ?? trip?.error ?? null,
  };
});

const n = scored.length;
const count = (f) => scored.filter(f).length;
const pct = (k) => (n ? `${Math.round((1000 * k) / n) / 10} %` : '—');
const summary = {
  phrases: n,
  ready: count((s) => s.ready),
  placeOk: count((s) => s.placeOk),
  placeAndDaysOk: count((s) => s.placeOk && s.daysOk),
};

if (args.includes('--md')) {
  console.log(
    `${n} phrases : **${summary.ready} prêtes**, **${summary.placeOk} lieux justes (${pct(summary.placeOk)})**, ` +
      `${summary.placeAndDaysOk} avec la durée (${pct(summary.placeAndDaysOk)}).`
  );
  console.log('');
  console.log('| id | Demande | Prête | Lieu (ancre) | Pays | Jours | Écart |');
  console.log('|----|---------|-------|--------------|------|-------|-------|');
  for (const s of scored) {
    const gaps = [];
    if (!s.ready) gaps.push(s.error ? 'erreur' : 'non prête');
    if (s.want && !s.placeOk && s.ready) gaps.push(`lieu (attendu ${s.want.pays.join('/')}${s.want.zone ? ', zone' : ''})`);
    if (s.want && !s.daysOk) gaps.push(`durée (attendu ${s.want.jours})`);
    console.log(
      `| ${s.id ?? '?'} | ${s.say.replace(/\|/g, '/')} | ${s.ready ? 'oui' : 'non'} | ${(s.place ?? '—').replace(/\|/g, '/')} | ${s.country ?? '—'} | ${s.days ?? '—'} | ${gaps.join(' ; ') || '—'} |`
    );
  }
} else {
  console.log(JSON.stringify({ summary, scored }, null, 1));
}
