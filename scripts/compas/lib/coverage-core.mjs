// Compas — phase 7 : cœur PUR du rapport de couverture.
//
// Entrées : l'inventaire statique (docs/compas/phase7/inventaire-controles.json),
// les enregistrements du navigateur (proof/.../coverage-runtime.json) et le
// registre (tests/e2e-compas-full/coverage-registry.json).
//
// Règle sans faux 100 % : un contrôle est COUVERT seulement si un scénario l'a
// activé (clic, saisie, geste) PUIS a vérifié son effet par une assertion
// (enregistrement `verified: true`). Un clic sans assertion est montré à part,
// jamais compté. Un enregistrement qui ressemble à deux contrôles à égalité
// n'est crédité à aucun des deux (ambigu, listé).

export const ETAPES = ['depart', 'commun', 'ou', 'nous', 'resa', 'verdict', 'kit'];
export const ETAPE_NOM = {
  depart: 'Départ',
  commun: 'Commun',
  ou: 'Où',
  nous: 'Nous',
  resa: 'Résa',
  verdict: 'Verdict',
  kit: 'Kit',
};

const IMPLICIT = { button: 'button', a: 'link', textarea: 'textbox', select: 'combobox', summary: 'group' };
const INPUT_ROLE = { checkbox: 'checkbox', radio: 'radio', range: 'slider', submit: 'button', button: 'button' };

/** Rôle effectif : attribut `role`, sinon rôle implicite de la balise. */
export function effectiveRole({ tag, role, type }) {
  if (role) return role;
  if (tag === 'input') return INPUT_ROLE[type ?? 'text'] ?? 'textbox';
  return IMPLICIT[tag] ?? null;
}

const literalLength = (nom) => (/^\[.*\]$/.test(nom ?? '') ? 0 : (nom ?? '').replace(/…/g, '').trim().length);
const regexCache = new Map();
const re = (src) => {
  if (!regexCache.has(src)) regexCache.set(src, new RegExp(src));
  return regexCache.get(src);
};
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

function candidatesFor(controls, element, record) {
  const out = [];
  const elRole = effectiveRole(element);
  const classes = new Set(element.classes ?? []);
  const around = new Set(record.ancestorClasses ?? []);
  for (const c of controls) {
    if (c.delegue) continue;
    // Nom entièrement calculé, sans classe ni parent distinctif : rien ne le distingue d'un
    // autre bouton. Il n'est crédité que par son identifiant explicite (`cover.*({ control })`).
    if (literalLength(c.nom) === 0 && !(c.classes?.length || c.ancetres?.length) && !c.geste) continue;
    const isGesture = c.type === 'geste';
    if (Boolean(record.gesture) !== isGesture) continue;
    if (isGesture && c.geste !== record.gesture) continue;
    if (c.balise !== element.tag) continue;
    if (!isGesture && c.role && elRole && c.role !== elRole) continue;
    if (c.input && element.type && c.input !== element.type) continue;
    if (!(c.classes ?? []).every((k) => classes.has(k))) continue;
    if (!(c.ancetres ?? []).every((k) => around.has(k) || classes.has(k))) continue;
    if (!re(c.motif).test(norm(element.name))) continue;
    const score =
      literalLength(c.nom) + 5 * (c.classes?.length ?? 0) + 3 * (c.ancetres?.length ?? 0) + (c.etape === record.etape ? 4 : 0);
    out.push({ id: c.id, score });
  }
  return out;
}

/**
 * Rattache un enregistrement du navigateur à UN contrôle de l'inventaire.
 * @returns {{ id: string } | { ambigu: string[] } | null}
 */
export function matchRecord(controls, record) {
  if (record.control) return controls.some((c) => c.id === record.control && !c.delegue) ? { id: record.control } : null;
  for (const element of record.chain ?? []) {
    const cands = candidatesFor(controls, element, record);
    if (!cands.length) continue;
    const best = Math.max(...cands.map((c) => c.score));
    const top = cands.filter((c) => c.score === best);
    return top.length === 1 ? { id: top[0].id } : { ambigu: top.map((c) => c.id) };
  }
  return null;
}

const pct = (n, d) => (d ? (100 * n) / d : 0);
/** Arrondi PAR DÉFAUT à une décimale : 99,96 % s'affiche 99,9 %, jamais 100 %. */
export const pctText = (p) => `${(Math.floor(p * 10) / 10).toString().replace('.', ',')} %`;

/**
 * Croise inventaire, enregistrements et registre.
 */
export function computeCoverage({ inventory, records, registry }) {
  const controls = inventory.controles;
  const counted = controls.filter((c) => !c.delegue);
  const verified = new Map();
  const activated = new Map();
  const ambigus = [];
  const nonReconnus = [];
  for (const r of records) {
    const m = matchRecord(controls, r);
    if (!m) {
      nonReconnus.push(r);
      continue;
    }
    if (m.ambigu) {
      ambigus.push({ ...r, candidats: m.ambigu });
      continue;
    }
    const map = r.verified ? verified : activated;
    if (!map.has(m.id)) map.set(m.id, []);
    map.get(m.id).push(r.scenario ?? '?');
  }

  const nonExerces = [];
  const parEtape = Object.fromEntries(
    ETAPES.map((e) => [e, { total: 0, verifies: 0, sans_assertion: 0, non_testables: 0, en_attente: 0, pourcentage: 0 }])
  );
  for (const c of counted) {
    const row = (parEtape[c.etape] ??= { total: 0, verifies: 0, sans_assertion: 0, non_testables: 0, en_attente: 0, pourcentage: 0 });
    row.total += 1;
    const entry = registry[c.id] ?? null;
    if (verified.has(c.id)) {
      row.verifies += 1;
      continue;
    }
    let raison;
    if (entry?.raison_non_testable) {
      row.non_testables += 1;
      raison = `non testable : ${entry.raison_non_testable}`;
    } else if (activated.has(c.id)) {
      row.sans_assertion += 1;
      raison = `activé sans assertion (${[...new Set(activated.get(c.id))].join(', ')})`;
    } else if (entry?.scenario) {
      raison = `déclaré couvert par « ${entry.scenario} » mais non exercé`;
    } else if (entry?.en_attente) {
      row.en_attente += 1;
      raison = `en attente : ${entry.en_attente}`;
    } else raison = 'aucune entrée au registre';
    nonExerces.push({ id: c.id, nom: c.nom, etape: c.etape, ecran: c.ecran, source: `${c.fichier}:${c.ligne}`, raison });
  }
  for (const row of Object.values(parEtape)) row.pourcentage = pct(row.verifies, row.total);
  const sum = (k) => Object.values(parEtape).reduce((a, r) => a + r[k], 0);
  const verifies = sum('verifies');
  const nonTestables = sum('non_testables');
  const global = {
    total: counted.length,
    verifies,
    sans_assertion: sum('sans_assertion'),
    non_testables: nonTestables,
    en_attente: sum('en_attente'),
    pourcentage: pct(verifies, counted.length),
    pourcentage_testables: pct(verifies, counted.length - nonTestables),
  };
  return {
    global,
    parEtape,
    nonExerces,
    couverts: [...verified.entries()].map(([id, by]) => ({ id, scenarios: [...new Set(by)] })),
    ambigus,
    nonReconnus,
  };
}

/** Résultats Playwright (reporter JSON) par étape, d'après l'étiquette `@etape:<id>` du titre. */
export function testsByEtape(report) {
  const out = {};
  const walk = (suite, titles) => {
    const here = [...titles, suite.title ?? ''];
    for (const spec of suite.specs ?? []) {
      const full = [...here, spec.title].join(' ');
      const etape = /@etape:([a-z]+)/.exec(full)?.[1] ?? 'autre';
      const row = (out[etape] ??= { passed: 0, failed: 0, skipped: 0 });
      for (const t of spec.tests ?? []) {
        const results = t.results ?? [];
        const statuses = results.map((r) => r.status);
        if (!statuses.length || statuses.every((s) => s === 'skipped')) row.skipped += 1;
        // Réussi seulement s'il réussit du premier coup : une reprise qui passe reste un échec instable.
        else if (statuses.length === 1 && statuses[0] === 'passed') row.passed += 1;
        else row.failed += 1;
      }
    }
    for (const s of suite.suites ?? []) walk(s, here);
  };
  for (const s of report.suites ?? []) walk(s, []);
  return out;
}

/** Tableau de bord lisible : scénarios et contrôles, par étape. */
export function scoreboardMarkdown(cov, tests = {}) {
  const lines = [
    '# Compas — tableau de bord du banc de test (phase 7)',
    '',
    'Objectif : 100 % des contrôles **activés ET vérifiés par une assertion**. Un clic sans assertion ne compte pas ;',
    'un enregistrement ambigu (deux contrôles possibles) n’est crédité à personne.',
    '',
    '| Étape | Scénarios réussis | échoués | ignorés | Contrôles vérifiés | Couverture |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  for (const e of ETAPES) {
    const r = cov.parEtape[e] ?? { total: 0, verifies: 0, pourcentage: 0 };
    const t = tests[e] ?? { passed: 0, failed: 0, skipped: 0 };
    lines.push(`| ${ETAPE_NOM[e]} | ${t.passed} | ${t.failed} | ${t.skipped} | ${r.verifies} / ${r.total} | ${pctText(r.pourcentage)} |`);
  }
  const g = cov.global;
  lines.push(
    `| **Total** | | | | **${g.verifies} / ${g.total}** | **${pctText(g.pourcentage)}** |`,
    '',
    `Hors contrôles déclarés non testables en session (${g.non_testables}) : ${pctText(g.pourcentage_testables)}.`,
    `Activés sans assertion : ${g.sans_assertion} · en attente d’un lot : ${g.en_attente} · enregistrements ambigus : ${cov.ambigus.length} · non reconnus : ${cov.nonReconnus.length}.`,
    ''
  );
  return lines.join('\n');
}

/** Rapport complet : tableau de bord + liste exacte des contrôles non exercés. */
export function coverageMarkdown(cov, tests = {}) {
  const lines = [scoreboardMarkdown(cov, tests), '## Contrôles non exercés, par étape', ''];
  for (const e of ETAPES) {
    const list = cov.nonExerces.filter((c) => c.etape === e);
    if (!list.length) continue;
    lines.push(`### ${ETAPE_NOM[e]} — ${list.length}`, '', '| Contrôle | Écran | Raison | Source |', '|---|---|---|---|');
    for (const c of list) lines.push(`| ${(c.nom ?? '').replace(/\|/g, '\\|')} | ${c.ecran} | ${c.raison} | \`${c.source}\` |`);
    lines.push('');
  }
  if (cov.ambigus.length) {
    lines.push('## Enregistrements ambigus (non crédités)', '');
    for (const a of cov.ambigus) lines.push(`- « ${a.chain?.[0]?.name ?? a.control} » (${a.scenario}) → ${a.candidats.join(' | ')}`);
    lines.push('');
  }
  if (cov.nonReconnus.length) {
    lines.push('## Enregistrements non reconnus (hors inventaire : coquille du site, contrôle non inventorié ?)', '');
    const seen = new Set();
    for (const r of cov.nonReconnus) {
      const el = r.chain?.[0] ?? {};
      const k = `${el.tag}|${el.name}|${r.etape}`;
      if (seen.has(k)) continue;
      seen.add(k);
      lines.push(`- \`${el.tag}\` « ${(el.name ?? '').slice(0, 60)} » · étape ${r.etape} · ${r.scenario ?? '?'}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
