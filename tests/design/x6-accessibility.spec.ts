import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * Calcul rigoureux de contraste WCAG 2.1
 * Formule : (L1 + 0.05) / (L2 + 0.05)
 * Source unique de vérité : src/styles/tokens.css — les valeurs sont LUES
 * depuis le fichier (light `:root`, premier bloc), jamais dupliquées ici.
 */
function sRGBtoLin(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const TOKENS_PATH = 'src/styles/tokens.css';

/**
 * Parse le premier bloc `:root` de tokens.css (thème clair).
 * Les blocs `.dark` ultérieurs sont ignorés : ce spec valide le thème clair.
 */
function parseLightTokens(): Record<string, string> {
  const css = readFileSync(TOKENS_PATH, 'utf8');
  const firstRoot = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!firstRoot) throw new Error(`Bloc :root introuvable dans ${TOKENS_PATH}`);
  const withoutComments = firstRoot[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens: Record<string, string> = {};
  for (const line of withoutComments.split('\n')) {
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
    if (m) tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

const TOKENS = parseLightTokens();

function token(name: string): string {
  const value = TOKENS[name];
  expect(value, `Token ${name} absent du bloc :root de ${TOKENS_PATH}`).toBeDefined();
  expect(value, `Token ${name} non hexadécimal (lu : ${value})`).toMatch(/^#[0-9A-Fa-f]{6}$/);
  return value;
}

describe('CHANTIER X6 — VALIDATION DES CONTRASTES WCAG AA (TOKENS LKDV RÉELS)', () => {
  it('Texte primaire (--lkv-text-primary) sur fond --lkv-surface ≥ 7.0:1 (dépasse WCAG AAA)', () => {
    const ratio = getContrastRatio(token('--lkv-text-primary'), token('--lkv-surface'));
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it('Texte primaire (--lkv-text-primary) sur fond --lkv-surface-card ≥ 7.0:1 (dépasse WCAG AAA)', () => {
    const ratio = getContrastRatio(token('--lkv-text-primary'), token('--lkv-surface-card'));
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it('Bouton d’action : --lkv-on-action (blanc) sur fond --lkv-action ≥ 7.0:1 (WCAG AAA)', () => {
    // Les éléments d'ACTION utilisent --lkv-action (cf. tokens.css §1), pas --lkv-primary.
    const ratio = getContrastRatio(token('--lkv-on-action'), token('--lkv-action'));
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it('Texte danger (--lkv-danger) sur fond --lkv-surface ≥ 4.5:1 (conforme WCAG AA normal)', () => {
    const ratio = getContrastRatio(token('--lkv-danger'), token('--lkv-surface'));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Texte danger (--lkv-danger) sur fond --lkv-surface-card ≥ 4.5:1 (conforme WCAG AA normal)', () => {
    const ratio = getContrastRatio(token('--lkv-danger'), token('--lkv-surface-card'));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Texte info (--lkv-info) sur fond --lkv-surface-card ≥ 4.5:1 (conforme WCAG AA normal)', () => {
    const ratio = getContrastRatio(token('--lkv-info'), token('--lkv-surface-card'));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Texte muted (--lkv-text-muted) sur fond --lkv-surface ≥ 4.5:1 (conforme WCAG AA normal)', () => {
    // Ancien seuil d'arbitrage 4.0 ; le token réel atteint AA normal (≥ 4.5).
    const ratio = getContrastRatio(token('--lkv-text-muted'), token('--lkv-surface'));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Texte secondaire (--lkv-text-secondary) sur fond --lkv-surface ≥ 4.5:1 (conforme WCAG AA normal)', () => {
    // L'ancien arbitrage « ~3.5:1, texte large uniquement » portait sur l'ancien
    // token sauge #5B7F55. Le token Phase 2 --lkv-text-secondary est un neutre
    // foncé : il atteint AA normal et n'est plus restreint au texte large.
    const ratio = getContrastRatio(token('--lkv-text-secondary'), token('--lkv-surface'));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Texte alerte warning foncé (--lkv-warning-dark) sur fond --lkv-surface ≥ 4.5:1 (conforme WCAG AA texte normal)', () => {
    const ratio = getContrastRatio(token('--lkv-warning-dark'), token('--lkv-surface'));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Warning graphique (--lkv-warning) sur fond --lkv-surface : usage réservé aux pastilles/badges graphiques', () => {
    // Dette documentée : le ratio réel (~2.4:1) est inférieur au seuil WCAG 1.4.11
    // (3:1) des composants d'interface. --lkv-warning n'est donc PAS utilisable
    // seul pour un texte ou un contrôle : utiliser --lkv-warning-dark (≥ 4.5:1)
    // pour le texte. Le présent test gèle uniquement son usage décoratif (≥ 2:1).
    const ratio = getContrastRatio(token('--lkv-warning'), token('--lkv-surface'));
    expect(ratio).toBeGreaterThanOrEqual(2.0);
  });
});
