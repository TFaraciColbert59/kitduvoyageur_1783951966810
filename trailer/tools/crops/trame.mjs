// Lecture du tableau « Découpage seconde par seconde » de TRAME-60s.md (plans, actes, images, sources, ★).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const TRAME = resolve(HERE, '../../TRAME-60s.md');

export function parseTrame(text) {
  const rows = [];
  let act = null;
  for (const line of text.split('\n')) {
    const a = line.match(/^\|\s*\*\*ACTE\s+(\d+)\s+—\s+([^*]+)\*\*/);
    if (a) { act = { number: Number(a[1]), name: a[2].trim() }; continue; }
    const m = line.match(/^\|\s*P(\d{2})\s*\|[^|]*\|\s*(\d+)–(\d+)\s*\|\s*([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (!m) continue;
    const sources = [...m[4].matchAll(/img\d+[ab]?/g)].map((x) => x[0]);
    const rng = m[4].match(/img(\d+)→(\d+)→(\d+)/);
    if (rng) sources.splice(0, sources.length, ...rng.slice(1).map((n) => `img${n}`));
    const tl = m[4].match(/img(\d+)a→(\d+)b/);
    if (tl) sources.splice(0, sources.length, `img${tl[1]}a`, `img${tl[2]}b`);
    rows.push({
      id: `p${m[1]}`, act, startFrame: Number(m[2]), endFrame: Number(m[3]), sources,
      star: m[6].includes('★'),
    });
  }
  return rows;
}

export const readTrame = (path = TRAME) => parseTrame(readFileSync(path, 'utf8'));
