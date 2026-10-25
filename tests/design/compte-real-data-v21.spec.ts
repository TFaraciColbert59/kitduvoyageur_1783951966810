import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('Compte réel — bootstrap et hydratation', () => {
  it('expose une route bootstrap authentifiée', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/api/compte/bootstrap/route.ts'))).toBe(true);
    const route = read('src/app/api/compte/bootstrap/route.ts');
    expect(route).toContain('loadAccountBootstrap');
    expect(route).toContain("runtime = 'nodejs'");
    expect(route).toContain('authenticated: false');
  });

  it('le runtime remplace les mocks, il ne les complète plus', () => {
    const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
    expect(runtime).toContain('if (data.replace === true)');
    expect(runtime).toContain('CARNETS = data.carnets');
    expect(runtime).toContain('OUTINGS = data.outings');
    expect(runtime).toContain('TRIBU = data.tribu');
    expect(runtime).toContain('ORDERS = data.orders');
    expect(runtime).toContain('applyAccountBootstrap');
  });

  it('la page charge le bootstrap après la synchronisation historique', () => {
    const page = read('src/components/compte/CompteLiquidGlassV8.tsx');
    expect(page).toContain("fetch('/api/compte/bootstrap'");
    expect(page).toContain('replace: true');
    expect(page).toContain('payload?.authenticated');
  });
});
