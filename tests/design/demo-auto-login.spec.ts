import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('auto-login démo', () => {
  it('garde les identifiants côté serveur et le flag de sécurité', () => {
    const route = read('src/app/api/auth/demo/route.ts');
    expect(route).toContain("process.env.DEMO_AUTO_LOGIN !== 'true'");
    expect(route).toContain('DEMO_LOGIN_EMAIL');
    expect(route).toContain('DEMO_LOGIN_PASSWORD');
    expect(route).toContain('signInWithPassword');
    expect(route).not.toMatch(/compas\.demo@|[A-Za-z0-9_-]{32,}/);
  });

  it('le client ne tente la connexion qu’une fois et ne porte aucun secret', () => {
    const auth = read('src/contexts/AuthContext.tsx');
    expect(auth).toContain("process.env.NEXT_PUBLIC_DEMO_AUTO_LOGIN !== 'true'");
    expect(auth).toContain("fetch('/api/auth/demo'");
    expect(auth).toContain('lkdv.demoAutoLogin');
    expect(auth).not.toContain('DEMO_LOGIN_PASSWORD');
    expect(auth).not.toContain('DEMO_LOGIN_EMAIL');
  });
});
