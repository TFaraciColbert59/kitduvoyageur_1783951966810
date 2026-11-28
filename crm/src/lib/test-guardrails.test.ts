import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDS } from './catalog';

/**
 * Méta-tests : ils vérifient le corpus de tests lui-même (08_GARDE_FOUS § 1.20 :
 * « ne jamais affaiblir un test »). Ils ne testent pas l'application : ils empêchent
 * qu'un `skip`, un `only`, une attente arbitraire ou une donnée réelle s'installent
 * dans les tests sans qu'on le voie.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TESTS_DIR = path.join(ROOT, 'tests');
const SELF = path.basename(fileURLToPath(import.meta.url));

function walk(dir: string, extension = '.ts'): string[] {
  if (!readdirSync(dir).length) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, extension));
    else if (full.endsWith(extension) || full.endsWith('.mjs')) out.push(full);
  }
  return out;
}

const specFiles = walk(TESTS_DIR).filter((file) => file.endsWith('.spec.ts'));
const supportFiles = walk(path.join(TESTS_DIR, 'support'));
const unitFiles = walk(path.join(ROOT, 'src')).filter(
  (file) => file.endsWith('.test.ts') && path.basename(file) !== SELF
);

const read = (file: string): string => readFileSync(file, 'utf8');

describe('corpus de tests — anti-affaiblissement', () => {
  it('ne contient ni `.only` ni attente arbitraire (`waitForTimeout`)', () => {
    const problems: string[] = [];
    for (const file of [...specFiles, ...unitFiles]) {
      const text = read(file);
      if (/\.only\s*\(/.test(text)) problems.push(`${path.relative(ROOT, file)} : .only`);
      if (/waitForTimeout\s*\(/.test(text)) problems.push(`${path.relative(ROOT, file)} : waitForTimeout`);
    }
    expect(problems).toEqual([]);
  });

  it('motive chaque `test.skip` par une phrase, jamais une impasse silencieuse', () => {
    const problems: string[] = [];
    for (const file of specFiles) {
      const lines = read(file).split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!/\.skip\(/.test(trimmed)) return;
        // Le motif est soit une phrase entre guillemets, soit une constante nommée
        // (NO_CREDENTIALS_MOTIF, NO_SUPABASE_MOTIF…) déclarée dans tests/support/env.ts.
        const inner = trimmed.slice(trimmed.indexOf('.skip(') + 6).replace(/\)\s*;?\s*$/, '');
        const parts = inner.split(/,\s*/);
        const motif = parts.length >= 2 ? parts.slice(1).join(', ') : '';
        const quoted = /^'[^']{15,}'$/.test(motif);
        const constant = /^[A-Z][A-Z0-9_]{4,}$/.test(motif);
        if (!quoted && !constant) {
          problems.push(`${path.relative(ROOT, file)}:${index + 1} : skip sans motif identifiable « ${motif} »`);
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it('marque chaque `fixme` du motif exact « en attente de la page »', () => {
    const problems: string[] = [];
    for (const file of specFiles) {
      const lines = read(file).split('\n');
      lines.forEach((line, index) => {
        if (!/\.fixme\(/.test(line)) return;
        const previous = index > 0 ? lines[index - 1]! : '';
        if (!/en attente de la page/.test(line) && !/en attente de la page/.test(previous)) {
          problems.push(`${path.relative(ROOT, file)}:${index + 1} : fixme sans « en attente de la page »`);
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it('n’utilise que des adresses de test et ne vise jamais la production', () => {
    const problems: string[] = [];
    const forbiddenEmail = /@(gmail|outlook|hotmail|icloud|yahoo|proton|live|lekitduvoyageur)\.[a-z]{2,}/i;
    for (const file of [...specFiles, ...supportFiles]) {
      const text = read(file);
      const relative = path.relative(ROOT, file);
      if (forbiddenEmail.test(text)) problems.push(`${relative} : adresse e-mail réelle`);
      if (/sk_live_|whsec_[A-Za-z0-9]{10,}/.test(text)) problems.push(`${relative} : secret Stripe`);
      if (/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]+['"]/.test(text)) problems.push(`${relative} : clé service_role en dur`);
      if (file.endsWith('env.ts')) continue; // ce fichier contient la garde anti-production
      if (text.includes('lekitduvoyageur.fr')) problems.push(`${relative} : URL de production`);
    }
    expect(problems).toEqual([]);
  });

  it('n’utilise pas `force: true` ni d’assertion vide', () => {
    const problems: string[] = [];
    for (const file of specFiles) {
      const text = read(file);
      if (/force:\s*true/.test(text)) problems.push(`${path.relative(ROOT, file)} : force: true`);
      if (/expect\(true\)\.toBe\(true\)/.test(text)) problems.push(`${path.relative(ROOT, file)} : assertion vide`);
    }
    expect(problems).toEqual([]);
  });

  it('couvre une famille de tests par domaine du catalogue, et aucune action inventée', () => {
    const known = new Set(COMMANDS.map((command) => command.id));
    const domains = new Set(COMMANDS.map((command) => command.domain));
    const referenced = new Set<string>();
    const problems: string[] = [];

    for (const domain of domains) {
      const number = Number(domain.slice(1));
      const prefix = `d${String(number).padStart(2, '0')}-`;
      const file = specFiles.find((candidate) => path.basename(candidate).startsWith(prefix));
      if (!file) {
        problems.push(`domaine ${domain} : aucun fichier ${prefix}*.spec.ts`);
        continue;
      }
      const ids = read(file).match(/ACT-\d{3}/g) ?? [];
      if (ids.length === 0) problems.push(`domaine ${domain} : aucune action ACT-… citée`);
      for (const id of ids) referenced.add(id);
    }

    for (const id of referenced) if (!known.has(id)) problems.push(`action inconnue citée : ${id}`);
    expect(problems).toEqual([]);
    expect(referenced.size).toBeGreaterThanOrEqual(domains.size);
  });

  it('documente le lancement des tests (README) et les variables attendues', () => {
    const readme = read(path.join(TESTS_DIR, 'README.md'));
    for (const marker of ['CRM_TEST_EMAIL', 'CRM_BASE_URL', 'vitest', 'playwright', 'capture-screens.mjs']) {
      expect(readme).toContain(marker);
    }
  });

  it('garde des seuils de performance et d’accessibilité écrits, non modifiables en silence', () => {
    const perf = read(path.join(TESTS_DIR, 'perf/ouverture-cas.spec.ts'));
    expect(perf).toContain('accuseMs: 100');
    expect(perf).toContain('reponseP95Ms: 400');
    expect(perf).toContain('longueTacheMs: 200');
    const a11y = JSON.parse(read(path.join(TESTS_DIR, 'support/screens.json'))) as {
      accessibilite: { cibleMinPx: number; echecsAxeAutorises: number };
    };
    expect(a11y.accessibilite.cibleMinPx).toBe(44);
    expect(a11y.accessibilite.echecsAxeAutorises).toBe(0);
  });
});
