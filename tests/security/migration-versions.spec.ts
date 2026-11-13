import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function filesIn(relativeDir: string): string[] {
  return readdirSync(path.join(ROOT, relativeDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

function versionOf(file: string): string | null {
  const match = /^(\d{14})_/.exec(file);
  return match ? match[1] : null;
}

function duplicates(files: string[]): Array<[string, string[]]> {
  const byVersion = new Map<string, string[]>();
  for (const file of files) {
    const version = versionOf(file);
    if (!version) continue;
    const list = byVersion.get(version) ?? [];
    list.push(file);
    byVersion.set(version, list);
  }
  return [...byVersion.entries()].filter(([, list]) => list.length > 1);
}

describe('versions des migrations', () => {
  it('aucune version dupliquée dans supabase/migrations', () => {
    expect(duplicates(filesIn('supabase/migrations'))).toEqual([]);
  });

  it('aucune version dupliquée dans supabase/migrations_down', () => {
    expect(duplicates(filesIn('supabase/migrations_down'))).toEqual([]);
  });

  it('la migration carnet trace_raw_guard est renumérotée en 20261112121000', () => {
    const files = filesIn('supabase/migrations').filter((file) =>
      file.includes('carnet_v2_trace_raw_guard'),
    );

    expect(files).toEqual(['20261112121000_carnet_v2_trace_raw_guard.sql']);
    expect(files.some((file) => file.startsWith('20261112120000_'))).toBe(false);
  });

  it('le down de trace_raw_guard porte la même version', () => {
    const files = filesIn('supabase/migrations_down').filter((file) =>
      file.includes('carnet_v2_trace_raw_guard'),
    );

    expect(files).toEqual(['20261112121000_carnet_v2_trace_raw_guard.down.sql']);
  });
});
