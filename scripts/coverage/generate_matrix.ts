/**
 * Phase 4 — Matrice de couverture honnête (générateur).
 *
 * Liste l'état RÉEL : tant qu'aucun dataset sous licence n'est importé,
 * toutes les cibles sont `not_covered`. Le générateur n'invente ni dataset,
 * ni métrique, ni statut : il projette les entrées fournies (et l'absence
 * d'entrées = `not_covered`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { CoverageStatus, FeatureFlags } from './types';
import { PUBLICATION_FLAG_ID } from './publishPlan';

export interface CoverageTarget {
  id: string;
  label: string;
  kind: 'country' | 'region';
  countryIsoA2: string;
  regionCode: string;
}

export interface CoverageStateRow {
  countryIsoA2: string;
  regionCode: string;
  status: CoverageStatus;
  datasetKey: string | null;
  version: string | null;
  validGeometries: number | null;
  sourcedPois: number | null;
  sampledRoutes: number | null;
  licenseCode: string | null;
  pipelineVersion: string | null;
  importedAt: string | null;
  publishedAt: string | null;
}

export interface CoverageMatrixInput {
  targets: readonly CoverageTarget[];
  coverage: readonly CoverageStateRow[];
  flags: FeatureFlags;
  generatedAt: string;
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function statusLabel(status: CoverageStatus): string {
  if (status === 'covered') return 'covered';
  if (status === 'experimental') return 'experimental';
  return 'not_covered';
}

export function buildCoverageMatrix(input: CoverageMatrixInput): string {
  const byKey = new Map<string, CoverageStateRow>();
  for (const row of input.coverage) {
    byKey.set(`${row.countryIsoA2}::${row.regionCode}`, row);
  }

  const flagEnabled = input.flags[PUBLICATION_FLAG_ID] === true;
  const coveredCount = input.coverage.filter((row) => row.status === 'covered').length;

  const lines: string[] = [];
  lines.push('# Matrice de couverture — Phase 4');
  lines.push('');
  lines.push(`> Généré le ${input.generatedAt} par \`scripts/coverage/generate_matrix.ts\`.`);
  lines.push('> Cibles issues de `docs/analysis/SYNTHESIS_DECISIONS.md` (décision D-B) :');
  lines.push('> 5 pays pilotes + 3 extensions régionales. Décision documentaire, pas une couverture.');
  lines.push('');
  lines.push(
    `> **Statut global : INSUFFICIENT_DATA** — aucune donnée géographique sous licence n'est importée à ce stade.`
  );
  lines.push(
    `> **Feature flag \`${PUBLICATION_FLAG_ID}\` : ${flagEnabled ? 'ACTIVÉ' : 'désactivé'}** — l'activation est une décision humaine.`
  );
  lines.push(
    `> **Régions \`covered\` dans les données : ${coveredCount}.** Aucune région ne peut être déclarée couverte sans dataset licencié, seuils atteints et 20 parcours échantillonnés humainement.`
  );
  lines.push('');
  lines.push(
    '| Cible | Type | Pays | Région | Statut | Dataset | Version | Géométries valides | POI sourcés | Échantillons | Licence | Importé le | Publié le |'
  );
  lines.push('| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |');

  for (const target of input.targets) {
    const row = byKey.get(`${target.countryIsoA2}::${target.regionCode}`);
    lines.push(
      '| ' +
        [
          target.label,
          target.kind === 'country' ? 'Pays' : 'Région',
          target.countryIsoA2,
          target.regionCode || '—',
          statusLabel(row?.status ?? 'not_covered'),
          cell(row?.datasetKey),
          cell(row?.version),
          cell(row?.validGeometries),
          cell(row?.sourcedPois),
          cell(row?.sampledRoutes),
          cell(row?.licenseCode),
          cell(row?.importedAt),
          cell(row?.publishedAt),
        ].join(' | ') +
        ' |'
    );
  }

  lines.push('');
  lines.push('## Lecture');
  lines.push('');
  lines.push('- `not_covered` : aucune donnée importée, aucune promesse de navigation.');
  lines.push(
    '- `experimental` : données présentes mais gates incomplets (jamais exposé publiquement comme couvert).'
  );
  lines.push(
    '- `covered` : dataset licencié, seuils atteints, échantillonnage humain ≥ 20, requêtes sous SLO, rollback possible.'
  );
  lines.push('');
  lines.push(
    "**Ce document ne déclare AUCUNE couverture réelle.** Il est régénéré par un script, jamais édité à la main."
  );
  lines.push('');

  return lines.join('\n');
}

interface MatrixFiles {
  targetsPath: string;
  coveragePath: string;
  flagsPath?: string;
  outputPath: string;
}

export function generateMatrixFiles(files: MatrixFiles, now: Date = new Date()): string {
  const targetsRaw = JSON.parse(readFileSync(files.targetsPath, 'utf8')) as
    | CoverageTarget[]
    | { targets: CoverageTarget[] };
  const targets = Array.isArray(targetsRaw) ? targetsRaw : targetsRaw.targets;

  const coverageRaw = JSON.parse(readFileSync(files.coveragePath, 'utf8')) as
    | CoverageStateRow[]
    | { coverage: CoverageStateRow[] };
  const coverage = Array.isArray(coverageRaw) ? coverageRaw : coverageRaw.coverage;

  const flags = files.flagsPath
    ? (JSON.parse(readFileSync(files.flagsPath, 'utf8')) as FeatureFlags)
    : {};
  const markdown = buildCoverageMatrix({
    targets,
    coverage,
    flags,
    generatedAt: now.toISOString(),
  });
  writeFileSync(files.outputPath, markdown, 'utf8');
  return markdown;
}

const invokedScript = process.argv[1]?.replace(/\\/g, '/') ?? '';
if (/\/scripts\/coverage\/generate_matrix\.(ts|js|mjs)$/.test(invokedScript)) {
  const options = {
    targetsPath: process.argv[2] ?? 'docs/coverage/targets.json',
    coveragePath: process.argv[3] ?? 'docs/coverage/coverage-input.json',
    flagsPath: process.argv[4],
    outputPath: process.argv[5] ?? 'docs/coverage/COVERAGE_MATRIX.md',
  };
  const markdown = generateMatrixFiles(options);
  console.log(`Matrice générée (${markdown.length} caractères).`);
}
