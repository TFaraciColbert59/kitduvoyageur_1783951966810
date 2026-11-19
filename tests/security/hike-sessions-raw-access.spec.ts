import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Invariant RGPD — accès aux points GPS des sorties (2026-11-11).
 *
 * La migration `20261111101000_carnet_public_trace_scope` retire au rôle
 * `authenticated` la lecture directe des colonnes brûlantes de
 * `hike_sessions` (`positions_geojson`, `positions_timed`, `poi_events`,
 * `narratives`, `notes`). Tout écran qui en a besoin doit passer par
 * `hike_sessions_participant` (sa propre sortie, un carnet où l'on participe,
 * une sortie où l'on est présent) ou par `hike_sessions_public` (visiteur).
 *
 * Ce test casse le build si un futur code relit les colonnes brutes sur la
 * table : le déploiement échouerait alors en production par un 42501.
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const SENSITIVE = [
  'positions_geojson',
  'positions_timed',
  'poi_events',
  'narratives',
  'notes',
] as const;

/** Fichiers autorisés à lire la vue participant (serveur uniquement). */
const PARTICIPANT_VIEW_USERS = [
  'src/app/api/hike-sessions/route.ts',
  'src/app/api/hike-sessions/[id]/narrative/route.ts',
  'src/features/adventure-intelligence/server/cockpitData.ts',
  'src/features/adventure-intelligence/server/offlineSync.ts',
  'src/features/compte/data/accountBootstrap.ts',
  'src/features/compte/map/server/loadCompteMap.ts',
  'src/features/compte/server/sorties.ts',
  'src/features/carnet/detail/getCarnetDetail.ts',
  'src/features/community/v2/create/carnet/TracePaneV2.tsx',
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function relative(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

/** Lectures légitimes de la table brute : tâches de fond à clé de service. */
const SERVICE_ROLE_READERS = ['src/app/api/cron/'];

const SELECT_AFTER_TABLE = /\.from\('hike_sessions'\)[\s\S]{0,200}?\.select\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/;

describe('RGPD — points GPS des sorties : aucune lecture brute sur la table', () => {
  const files = walk(SRC);

  it('aucun fichier ne sélectionne les colonnes brûlantes depuis hike_sessions', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(file);
      if (SERVICE_ROLE_READERS.some((prefix) => rel.startsWith(prefix))) continue;
      const source = fs.readFileSync(file, 'utf8');
      let match: RegExpExecArray | null;
      const pattern = new RegExp(SELECT_AFTER_TABLE.source, 'g');
      while ((match = pattern.exec(source)) !== null) {
        const columns = match[1] ?? match[2] ?? match[3] ?? '';
        const hit = SENSITIVE.find((column) => columns.includes(column));
        if (hit) offenders.push(`${rel} (${hit})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('les écrans qui ont besoin des points lisent la vue participant', () => {
    const missing = PARTICIPANT_VIEW_USERS.filter((relativePath) => {
      const full = path.join(ROOT, relativePath);
      if (!fs.existsSync(full)) return true;
      return !fs.readFileSync(full, 'utf8').includes('hike_sessions_participant');
    });
    expect(missing).toEqual([]);
  });

});
