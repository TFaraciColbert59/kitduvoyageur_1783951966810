import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// Modules .mjs de support du parcours E2E.
import { signJwt, verifyJwt } from '../e2e/compas/support/jwt.mjs';
import { assertLocalDatabase } from '../e2e/compas/support/seed.mjs';

/**
 * PLAN-100 2.4 / 2.12 — garde-fous des outils de base éphémère et du parcours E2E.
 * Ils tournent à chaque `npm test` (sans base ni navigateur) : si l'un casse, la CI
 * ne pourrait plus garantir qu'aucun script de test n'écrit hors de la machine.
 */
const root = process.cwd();

const REMOTE_URLS = [
  'postgresql://postgres:secret@db.abcdefghijkl.supabase.co:5432/postgres',
  'postgresql://postgres.abcdefghijkl:secret@aws-0-eu-west-3.pooler.supabase.com:6543/postgres',
  'postgresql://user@10.0.0.12:5432/lkdv',
];

describe('scripts/db/ci : refus de toute base qui n’est pas locale', () => {
  for (const script of ['install.sh', 'run_pgtap.sh']) {
    for (const url of REMOTE_URLS) {
      it(`${script} refuse ${new URL(url).hostname}`, () => {
        const res = spawnSync('bash', [path.join(root, 'scripts/db/ci', script)], {
          env: { PATH: process.env.PATH ?? '', DATABASE_URL: url } as unknown as NodeJS.ProcessEnv,
          encoding: 'utf8',
          timeout: 20_000,
        });
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('REFUS');
        // Rien n'a été lancé avant le refus : pas de ligne d'étape.
        expect(res.stdout).not.toContain('[ci-db]');
      });
    }
  }

  it('install.sh exige DATABASE_URL', () => {
    const res = spawnSync('bash', [path.join(root, 'scripts/db/ci/install.sh')], {
      env: { PATH: process.env.PATH ?? '' } as unknown as NodeJS.ProcessEnv,
      encoding: 'utf8',
      timeout: 20_000,
    });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('DATABASE_URL');
  });

  it('le seed du parcours E2E refuse une base distante et accepte la machine locale', () => {
    for (const url of REMOTE_URLS) expect(() => assertLocalDatabase(url)).toThrow(/REFUS/);
    for (const url of ['postgresql://postgres@127.0.0.1:5433/lkdv_ci', 'postgresql://postgres@localhost/lkdv_ci'])
      expect(() => assertLocalDatabase(url)).not.toThrow();
  });
});

describe('JWT de la passerelle de test', () => {
  it('accepte un jeton signé, refuse un jeton altéré, expiré ou signé par une autre clé', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt({ sub: 'u1', role: 'authenticated', exp: now + 60 });
    expect(verifyJwt(token)?.sub).toBe('u1');
    const [h, b, s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'u2', role: 'service_role', exp: now + 60 })).toString('base64url');
    expect(verifyJwt(`${h}.${forged}.${s}`)).toBeNull();
    expect(verifyJwt(signJwt({ sub: 'u1', exp: now - 10 }))).toBeNull();
    expect(verifyJwt(signJwt({ sub: 'u1', exp: now + 60 }, 'une-autre-cle'))).toBeNull();
    expect(verifyJwt('pas-un-jeton')).toBeNull();
    expect(b.length).toBeGreaterThan(0);
  });
});

describe('workflow CI : jobs de test sans base distante ni secret de production', () => {
  const ci = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  const jobBody = (name: string) => {
    const start = ci.indexOf(`\n  ${name}:`);
    expect(start, `job ${name} introuvable`).toBeGreaterThan(-1);
    const next = ci.slice(start + 1).search(/\n {2}[a-z0-9-]+:\n/);
    const body = ci.slice(start, next === -1 ? undefined : start + 1 + next);
    // Les commentaires (dont celui du job suivant) ne sont pas du code exécuté.
    return body
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join('\n');
  };

  it('database-gates : autonome (ni variable d’activation, ni secret, ni base distante)', () => {
    const body = jobBody('database-gates');
    expect(body).not.toMatch(/\bif:\s/);
    expect(body).not.toContain('secrets.');
    expect(body).not.toContain('LKDV_TEST_DATABASE_URL');
    expect(body).not.toMatch(/supabase(@\d+)? (db push|test db)/);
    expect(body).toContain('ephemeral-postgres');
    expect(body).toContain('run_pgtap.sh');
  });

  it('e2e-compas : aucun secret de service, base éphémère, PostgREST vérifié par somme de contrôle', () => {
    const body = jobBody('e2e-compas');
    expect(body).not.toMatch(/SERVICE_ROLE/i);
    expect(body).not.toContain('LKDV_TEST_DATABASE_URL');
    expect(body).toContain('sha256sum -c');
    expect(body).toContain('ephemeral-postgres');
    expect(body).toContain('playwright.compas.config.ts');
  });

  it('le mode « faux backend » n’existe pas dans le code applicatif', () => {
    // Le parcours E2E ne modifie aucun code de l'application : le branchement des doublures
    // vit dans tests/e2e/compas (préchargement du lanceur), jamais dans src/.
    const res = spawnSync('grep', ['-rIl', '-E', 'E2E_DOUBLES_URL|doubles-server|__ext/', path.join(root, 'src')], {
      encoding: 'utf8',
    });
    expect(res.stdout.trim()).toBe('');
  });
});
