// Compas v6 — contrôle du jeu « demandes-or » (SPEC-V6-MOTEUR §5, tâche T0.3).
//
// Usage :
//   node scripts/compas/validate-demandes-or.mjs <fichier.json> [--part]
//   --part : fichier partiel (un lot de 100) : les quotas sont divisés par 3.
//
// Sortie : le tableau des répartitions, puis « OK » (code 0) ou la liste des
// écarts (code 1). Aucune écriture.
import fs from 'node:fs';
import { z } from 'zod';

export const FAMILLES = [
  'marche', // hiking, trekking
  'bivouac', // bivouac, bushcraft
  'velo', // cycling
  'route', // roadtrip, vanlife
  'ville-culture', // citytrip, cultural
  'plage', // beach
  'ski', // ski
  'alpinisme', // mountaineering
  'escalade', // climbing
  'eau', // water
  'course', // running
  'multi', // mixed, plusieurs activités
];
export const ACTIVITES = [
  'hiking', 'trekking', 'bivouac', 'roadtrip', 'cultural', 'bushcraft', 'mixed', 'cycling',
  'ski', 'mountaineering', 'climbing', 'water', 'citytrip', 'beach', 'vanlife', 'running',
];
export const DUREES = ['1h', 'journee', 'week-end', 'semaine', '2-semaines', '1-mois'];
export const LANGUES = ['fr', 'en', 'es', 'de', 'it'];
export const GROUPES = ['solo', 'couple', 'famille', 'groupe'];
export const CONTINENTS = ['europe', 'asie', 'afrique', 'amerique-nord', 'amerique-sud', 'oceanie'];
export const SAISONS = ['printemps', 'ete', 'automne', 'hiver'];

const attendu = z.strictObject({
  /** ISO 3166-1 alpha-2 du pays attendu ; null si la demande ne permet pas de le dire. */
  pays: z.string().regex(/^[A-Z]{2}$/).nullable(),
  /** Lieu attendu : centre approximatif et rayon de tolérance (repère de test, jamais affiché). */
  lieu: z
    .strictObject({
      nom: z.string().min(2),
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      rayonKm: z.number().min(10).max(1500),
    })
    .nullable(),
  jours: z.number().int().min(1).max(60).nullable(),
  /** Écart de jours accepté quand la phrase ne dit pas un nombre (« un week-end » = 2 ou 3, « un mois » = 28 à 33). Posé à la fusion des lots. */
  joursTolerance: z.number().int().min(0).max(3).optional(),
  heures: z.number().min(0.25).max(23.75).nullable(),
  personnes: z.number().int().min(1).max(30).nullable(),
  enfants: z.number().int().min(0).max(10).nullable(),
  activite: z.enum(ACTIVITES).nullable(),
  /** Mois de départ attendu (1 à 12) quand la phrase le dit ou l'implique. */
  mois: z.number().int().min(1).max(12).nullable(),
  /** Demande à plusieurs activités : la suite d'activités attendue (au moins deux). */
  segments: z.array(z.enum(ACTIVITES)).min(2).nullable(),
  /** « pret » : un voyage complet est attendu. « precision » : le Compas doit dire ce qui manque ou se contredit. */
  issue: z.enum(['pret', 'precision']),
});

const demande = z.strictObject({
  id: z.string().regex(/^D\d{3}$/),
  phrase: z.string().min(3).max(400),
  langue: z.enum(LANGUES),
  famille: z.enum(FAMILLES),
  duree: z.enum(DUREES),
  groupe: z.enum(GROUPES),
  continent: z.enum(CONTINENTS),
  saison: z.enum(SAISONS),
  /** Demande volontairement floue ou contradictoire. */
  floue: z.boolean(),
  /** Pour une demande floue : ce qui est flou ou contradictoire. */
  note: z.string().nullable(),
  attendu,
});

export const jeu = z.strictObject({
  version: z.literal(1),
  demandes: z.array(demande),
});

/** Quotas du jeu entier (300 demandes). */
const QUOTAS = {
  total: 300,
  famille: 20,
  duree: 40,
  langue: 40,
  groupe: 50,
  continent: 30,
  saison: 50,
  floues: 30,
  multi: 20,
};

export function controle(data, { part = false } = {}) {
  const errs = [];
  const parsed = jeu.safeParse(data);
  if (!parsed.success) {
    for (const i of parsed.error.issues.slice(0, 40)) errs.push(`schéma ${i.path.join('.')} : ${i.message}`);
    return { errs, tables: {} };
  }
  const d = parsed.data.demandes;
  const q = (n) => (part ? Math.floor(n / 3) : n);
  const count = (key, values) => {
    const t = Object.fromEntries(values.map((v) => [v, 0]));
    for (const x of d) t[x[key]] += 1;
    return t;
  };
  const tables = {
    famille: count('famille', FAMILLES),
    duree: count('duree', DUREES),
    langue: count('langue', LANGUES),
    groupe: count('groupe', GROUPES),
    continent: count('continent', CONTINENTS),
    saison: count('saison', SAISONS),
  };
  if (d.length !== q(QUOTAS.total)) errs.push(`total ${d.length}, attendu ${q(QUOTAS.total)}`);
  for (const [dim, t] of Object.entries(tables))
    for (const [v, n] of Object.entries(t))
      if (n < q(QUOTAS[dim])) errs.push(`${dim} « ${v} » : ${n}, minimum ${q(QUOTAS[dim])}`);
  const floues = d.filter((x) => x.floue).length;
  const multi = d.filter((x) => x.attendu.segments).length;
  tables.special = { floues, multi };
  if (part ? floues < 10 : floues !== QUOTAS.floues) errs.push(`floues ${floues}, attendu ${q(QUOTAS.floues)}`);
  if (multi < q(QUOTAS.multi)) errs.push(`multi-activités ${multi}, minimum ${q(QUOTAS.multi)}`);

  const ids = new Set();
  const phrases = new Set();
  for (const x of d) {
    if (ids.has(x.id)) errs.push(`${x.id} : identifiant en double`);
    ids.add(x.id);
    const k = x.phrase.trim().toLowerCase();
    if (phrases.has(k)) errs.push(`${x.id} : phrase en double`);
    phrases.add(k);
    const a = x.attendu;
    if (x.floue && !x.note) errs.push(`${x.id} : demande floue sans note`);
    if (!x.floue && a.issue !== 'pret') errs.push(`${x.id} : issue « precision » sur une demande non floue`);
    if (!x.floue && !a.pays) errs.push(`${x.id} : pays attendu manquant`);
    if (!x.floue && !a.lieu) errs.push(`${x.id} : lieu attendu manquant`);
    if (!x.floue && a.jours == null && a.heures == null) errs.push(`${x.id} : ni jours ni heures attendus`);
    if (x.duree === '1h' && !x.floue && (a.heures == null || a.heures > 3))
      errs.push(`${x.id} : durée « 1h » sans heures attendues (≤ 3)`);
    if (a.segments && new Set(a.segments).size < 2) errs.push(`${x.id} : segments sans deux activités distinctes`);
    if (a.enfants != null && a.personnes != null && a.enfants >= a.personnes)
      errs.push(`${x.id} : enfants ≥ personnes`);
    if (x.groupe === 'solo' && !x.floue && a.personnes != null && a.personnes !== 1)
      errs.push(`${x.id} : groupe solo, personnes ${a.personnes}`);
    if (x.groupe === 'couple' && !x.floue && a.personnes !== 2) errs.push(`${x.id} : groupe couple, personnes ≠ 2`);
    if (x.groupe === 'famille' && !x.floue && !(a.enfants >= 1)) errs.push(`${x.id} : famille sans enfant attendu`);
  }
  return { errs, tables };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const [file, flag] = process.argv.slice(2);
  if (!file) {
    console.error('Usage : node scripts/compas/validate-demandes-or.mjs <fichier.json> [--part]');
    process.exit(2);
  }
  const { errs, tables } = controle(JSON.parse(fs.readFileSync(file, 'utf8')), { part: flag === '--part' });
  for (const [dim, t] of Object.entries(tables)) console.info(dim.padEnd(10), JSON.stringify(t));
  if (errs.length) {
    console.error(`${errs.length} écart(s) :`);
    for (const e of errs) console.error(' -', e);
    process.exit(1);
  }
  console.info('OK');
}
