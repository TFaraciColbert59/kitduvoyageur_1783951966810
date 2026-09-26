import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP_DIR = path.join(process.cwd(), 'src', 'app');
const ROUTE_FILE = /^(?:page|route)\.[cm]?[jt]sx?$/;

function routeDirectories(root: string): string[][] {
  const directories: string[][] = [];

  const walk = (directory: string, segments: string[]) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(directory, entry.name), [...segments, entry.name]);
        continue;
      }
      if (ROUTE_FILE.test(entry.name)) directories.push(segments);
    }
  };

  walk(root, []);
  return directories;
}

describe('segments dynamiques des routes App Router', () => {
  it('n’utilise qu’un seul nom de paramètre par position dynamique', () => {
    const namesByPosition = new Map<string, Set<string>>();

    for (const segments of routeDirectories(APP_DIR)) {
      segments.forEach((segment, index) => {
        if (!/^\[[^\]]+\]$/.test(segment)) return;
        const key = `${JSON.stringify(segments.slice(0, index))}:${index}`;
        const names = namesByPosition.get(key) ?? new Set<string>();
        names.add(segment);
        namesByPosition.set(key, names);
      });
    }

    const conflicts = [...namesByPosition.entries()]
      .filter(([, names]) => names.size > 1)
      .map(([key, names]) => `${key} -> ${[...names].join(', ')}`)
      .sort();

    expect(conflicts).toEqual([]);
  });
});
