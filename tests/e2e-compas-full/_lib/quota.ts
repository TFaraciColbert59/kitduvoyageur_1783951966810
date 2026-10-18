import fs from 'node:fs';
import path from 'node:path';
import { LEDGER_DIR, PREP_GLOBAL, PREP_PER_PERSON, PREP_WINDOW_MS, RUN_DIR } from './env';

/**
 * File d'attente des préparations, PARTAGÉE entre workers ET entre passages :
 * le site accepte 6 lancements par 10 minutes et par personne (et 120 par
 * heure pour tout le site). Chaque lancement est inscrit dans
 * `proof/compas-full/prep-ledger.json` sous un verrou (création atomique d'un
 * dossier) ; un worker qui dépasserait la limite attend son tour.
 */
const LEDGER = path.join(LEDGER_DIR, 'prep-ledger.json');
const LOCK = path.join(LEDGER_DIR, '.prep-ledger.lock');
const MARGIN_MS = 5_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Entry = { key: string; at: number };

async function withLock<T>(fn: () => T): Promise<T> {
  fs.mkdirSync(LEDGER_DIR, { recursive: true });
  for (let i = 0; ; i += 1) {
    try {
      fs.mkdirSync(LOCK);
      break;
    } catch {
      // Verrou abandonné (worker tué) : au-delà de 30 s, il est repris.
      try {
        if (Date.now() - fs.statSync(LOCK).mtimeMs > 30_000) fs.rmSync(LOCK, { recursive: true, force: true });
      } catch {
        /* disparu entre-temps */
      }
      if (i > 600) throw new Error('[banc] verrou de la file des préparations introuvable depuis 60 s');
      await sleep(100);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(LOCK, { recursive: true, force: true });
  }
}

const read = (): Entry[] => {
  try {
    return JSON.parse(fs.readFileSync(LEDGER, 'utf8')) as Entry[];
  } catch {
    return [];
  }
};

/**
 * Prochaine place libre pour `key` (en ms à attendre, 0 = tout de suite),
 * calcul pur : exporté pour le test.
 */
export function waitFor(entries: Entry[], key: string, now: number, perPerson = PREP_PER_PERSON, global = PREP_GLOBAL, windowMs = PREP_WINDOW_MS): number {
  const live = entries.filter((e) => now - e.at < windowMs);
  const mine = live.filter((e) => e.key === key).map((e) => e.at).sort((a, b) => a - b);
  const all = live.map((e) => e.at).sort((a, b) => a - b);
  let wait = 0;
  if (mine.length >= perPerson) wait = Math.max(wait, mine[mine.length - perPerson] + windowMs - now + MARGIN_MS);
  if (all.length >= global) wait = Math.max(wait, all[all.length - global] + windowMs - now + MARGIN_MS);
  return wait;
}

/**
 * Réserve un lancement pour `key` (compte qui prépare) ; attend si besoin.
 * `onWait(ms)` est appelé avant chaque attente (pour allonger le délai du test).
 */
export async function acquirePrepSlot(key: string, onWait?: (ms: number) => void): Promise<{ waitedMs: number }> {
  const t0 = Date.now();
  for (;;) {
    const wait = await withLock(() => {
      const now = Date.now();
      const entries = read().filter((e) => now - e.at < PREP_WINDOW_MS);
      const w = waitFor(entries, key, now);
      if (w === 0) {
        entries.push({ key, at: now });
        fs.writeFileSync(LEDGER, JSON.stringify(entries, null, 1));
      }
      return w;
    });
    if (wait === 0) {
      const waitedMs = Date.now() - t0;
      if (waitedMs > 0) {
        fs.mkdirSync(RUN_DIR, { recursive: true });
        fs.appendFileSync(path.join(RUN_DIR, 'file-attente.jsonl'), JSON.stringify({ key, waitedMs, at: new Date().toISOString() }) + '\n');
      }
      return { waitedMs };
    }
    onWait?.(wait);
    await sleep(Math.min(wait, 30_000));
  }
}
