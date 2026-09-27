import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const TOKENS_CSS = path.join(SRC, 'styles', 'tokens.css');

function listSourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, out);
    else if (/\.(ts|tsx|css|js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const SOURCE_FILES = listSourceFiles(SRC);

function violations(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of SOURCE_FILES) {
    const content = fs.readFileSync(file, 'utf8');
    content.split('\n').forEach((line, index) => {
      if (pattern.test(line)) {
        found.push(`${path.relative(ROOT, file).replace(/\\/g, '/')}:${index + 1}`);
      }
    });
  }
  return found;
}

describe('Design system — utilitaires de motion Tailwind (P5)', () => {
  it('TEST-MOTION-01: aucune classe ambiguousë duration-[var() / ease-[var() (jetée par Tailwind v3)', () => {
    // Tailwind v3oi : `duration-*` colle entre transition-duration et
    // animation-duration, `ease-*` entre transition- et animation- :
    // la classe estSignalee "ambiguous" puis ELIMINEE. La transition
    // demandee par le design system n'est donc jamais appliquee.
    const hits = violations(/(?<![-\w])(duration|ease)-\[var\(/);
    expect(
      hits,
      `Classes de motion inertes trouvées :\n${hits.join('\n')}\nUtiliser [transition-duration:var(--x)] / [transition-timing-function:var(--x)].`
    ).toEqual([]);
  });

  it('TEST-MOTION-02: aucune syntaxe v4 transition-duration-[...] / transition-timing-function-[...]', () => {
    // Ces préfixes n'existent pas en Tailwind 3.4 : ils ne génèrent rien.
    const hits = violations(/transition-(duration|timing-function)-\[/);
    expect(hits, `Syntaxe Tailwind v4 inerte en v3 :\n${hits.join('\n')}`).toEqual([]);
  });

  it('TEST-MOTION-03: chaque token de motion référencé est déclaré dans tokens.css', () => {
    const declared = new Set<string>();
    for (const match of fs.readFileSync(TOKENS_CSS, 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g)) {
      declared.add(match[1]);
    }
    const missing: string[] = [];
    for (const file of SOURCE_FILES) {
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(/\[transition-(?:duration|timing-function):var\((--[a-z0-9-]+)\)\]/g)) {
        if (!declared.has(match[1])) {
          missing.push(`${path.relative(ROOT, file).replace(/\\/g, '/')} -> ${match[1]}`);
        }
      }
    }
    expect(missing, `Tokens de motion non déclarés :\n${missing.join('\n')}`).toEqual([]);
  });

  it('TEST-MOTION-04: aucun placeholder de codemod résiduel (var($1))', () => {
    const hits = violations(/var\(\$1\)/);
    expect(hits, `Placeholders résiduels :\n${hits.join('\n')}`).toEqual([]);
  });

  it('TEST-MOTION-05: les utilitaires de motion canoniques sont réellement utilisés', () => {
    const used = new Set<string>();
    for (const file of SOURCE_FILES) {
      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(/\[transition-(?:duration|timing-function):var\((--[a-z0-9-]+)\)\]/g)) {
        used.add(match[1]);
      }
    }
    // Garde-fou : si un jour le codemod casse la resolution, ces 6 tokens
    // doivent rester references par des classes reellement generees par Tailwind.
    for (const token of [
      '--motion-control-duration',
      '--motion-press-duration',
      '--dur-fast',
      '--motion-ease-standard',
      '--ease-glass',
      '--motion-ease-decelerate',
    ]) {
      expect(used.has(token), `${token} n'est plus référencé`).toBe(true);
    }
  });
});