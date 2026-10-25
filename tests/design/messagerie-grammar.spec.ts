import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const SCREEN = 'src/components/messaging/MessagesScreen.tsx';
const CSS = 'src/components/messaging/messages-grammar.css';
const PAGE = 'src/app/messagerie/page.tsx';
const FIDELITY = 'scripts/design/design-fidelity.mjs';

/** Nombre d'occurrences littérales (pas de regex : les ancres sont des chaînes). */
const occurrences = (source: string, needle: string) => source.split(needle).length - 1;

/** La prose ne compte pas : les commentaires ne déclarent ni couleur ni matière. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Sélecteurs de toutes les règles, `@keyframes` exclues : les étapes `0 %, 50 %,
 * 100 %` ne sont pas des sélecteurs scopables. Le bloc `@media` est traversé —
 * ses règles internes, elles, doivent être scopées.
 */
function selectors(css: string): string[] {
  const found: string[] = [];
  const stack: Array<{ atRule: boolean; keyframes: boolean }> = [];
  let prelude = '';

  for (const ch of stripComments(css)) {
    if (ch === '{') {
      const head = prelude.trim();
      prelude = '';
      const atRule = head.startsWith('@');
      const insideKeyframes = stack.some((frame) => frame.keyframes);
      if (!atRule && !insideKeyframes) found.push(head);
      stack.push({ atRule, keyframes: head.startsWith('@keyframes') });
    } else if (ch === '}') {
      prelude = '';
      stack.pop();
    } else if (ch === ';' && stack.length === 0) {
      prelude = ''; // at-rule sans bloc (@import, @charset)
    } else {
      prelude += ch;
    }
  }
  return found;
}

describe('/messagerie — grammaire Compte (verre Liquid Glass v8)', () => {
  const screen = read(SCREEN);
  const css = read(CSS);
  const page = read(PAGE);
  const fidelity = read(FIDELITY);

  it('importe les trois feuilles de la grammaire et le contenu de l’écran', () => {
    expect(screen).toContain("import '@/components/compte/compte-v8.css';");
    expect(screen).toContain("import '@/components/compte/compte-apple-hig.css';");
    expect(screen).toContain("import '@/design/account/account-grammar-pins.css';");
    expect(screen).toContain("import '@/components/messaging/messages-grammar.css';");
  });

  it('monte les primitives partagées, jamais une variante ad hoc', () => {
    expect(screen).toMatch(/<AccountBottomBar\b[^>]*\brenderAs="button"/);
    expect(screen).toMatch(/<AccountDrawerHost\b/);
    expect(screen).toMatch(/\binitLiquidLenses\(/);
    expect(screen).toMatch(/\brefreshLiquidLenses\(/);
  });

  it('garde les ancres du shell (top bar, carte, liste, filtre, zone de conversation, barre)', () => {
    expect(occurrences(screen, 'className="ig-top"')).toBe(1);
    expect(occurrences(screen, 'ig-handle')).toBe(1);
    expect(occurrences(screen, 'ig-top-btn')).toBe(3);
    expect(occurrences(screen, 'className="card cs"')).toBe(1);
    expect(occurrences(screen, 'card-scroll')).toBe(1);
    expect(occurrences(screen, 'ig-grid-wrap')).toBe(2);
    expect(occurrences(screen, 'ig-feed-row')).toBe(1);
    expect(occurrences(screen, 'className="mfilter"')).toBe(1);
    expect(occurrences(screen, 'mapzone')).toBe(1);
    expect(occurrences(screen, 'lkdv-account-bar')).toBe(1);
  });

  it('la carte ne porte que la liste : identité, bio et anneaux retirés (décision du 25/10)', () => {
    for (const removed of ['ig-header', 'ig-stat', 'ig-bio', 'ig-hl-row', 'ig-hl-ring']) {
      expect(screen, removed).not.toContain(removed);
    }
    expect(screen).not.toContain('ig-tabs');
  });

  it('n’a aucune trace de l’ancien système sur l’écran', () => {
    for (const legacy of [
      '--glass-',
      '--lkv-',
      'font-mono',
      'MobileSheet',
      'AppShell',
      'BottomTabBar',
      'MessageInbox',
    ]) {
      expect(screen, legacy).not.toContain(legacy);
    }
  });

  it('ne garde d’emoji que la palette de réactions et l’accusé de lecture (contenu, pas décoration)', () => {
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
    const lines = screen.split('\n');
    const withEmoji = lines
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => EMOJI.test(line));

    // Deux usages légitimes, tous deux du contenu de message :
    //  - la palette de réactions (l. ~302) ;
    //  - l'accusé de lecture ✓ / ✓✓ (l. ~450).
    // Aucun emoji de navigation, de titre ou de bouton.
    for (const { line, number } of withEmoji) {
      const legit = line.startsWith('const REACTIONS = [') || line.includes('✓');
      expect(legit, `emoji décoratif ligne ${number} : ${line}`).toBe(true);
    }
    expect(withEmoji.length).toBeGreaterThan(0);
  });

  it('la feuille messages-grammar.css reste un fichier de contenu : pas de couleur littérale, pas de matière', () => {
    const rules = stripComments(css);
    expect(rules).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(rules).not.toContain('backdrop-filter');
    expect(rules).not.toContain('linear-gradient');
    expect(rules.split('\n').length).toBeLessThanOrEqual(700);
    // Le verre et les boîtes viennent de compte-v8.css : la feuille de l'écran
    // se contente de jetons.
    expect(rules).toContain('var(--sf)');
    expect(rules).toMatch(/\.lkdv-messages \.bub\s*\{/);
  });

  it('scoped toutes les règles sous .lkdv-messages, hors @keyframes et préfixe @media', () => {
    const list = selectors(css);
    expect(list.length).toBeGreaterThan(20);
    const unscoped = list
      .flatMap((rule) => rule.split(','))
      .map((selector) => selector.trim())
      .filter((selector) => selector && !selector.startsWith('.lkdv-messages'));
    expect(unscoped).toEqual([]);
    // Les étapes de @keyframes sont bien ignorées par le parseur.
    expect(list.join('\n')).not.toContain('@keyframes');
    expect(list.join('\n')).not.toMatch(/(^|\n)\s*\d+%/);
  });

  it('la page /messagerie ne remonte plus l’ancien shell ni l’ancienne boîte de réception', () => {
    for (const legacy of ['AppShell', 'Header', 'BottomTabBar', 'MessageInbox']) {
      expect(page, legacy).not.toContain(legacy);
    }
    // La refonte ne supprime pas la fonction : l'écran est toujours monté.
    expect(page).toContain("import { MessagesScreen } from '@/components/messaging/MessagesScreen'");
    expect(page).toContain('<MessagesScreen');
  });

  it('contrat des 19 ancres : la porte de fidélité porte les constantes mesurées', () => {
    expect(fidelity).toContain('const VIEWPORT = { width: 430, height: 932 };');
    expect(fidelity).toContain("card: { box: [12, 48, 406, 541.1], radius: '24px' }");
    expect(fidelity).toContain('bottomBar: [14, 868, 402, 48]');
    expect(fidelity).toContain('topBar: [12, 6, 406, 36]');
    expect(fidelity).toContain('const TOL = 1;');
    expect(fidelity).toContain('{ width: 430, height: 932 },\n  { width: 768, height: 1024 },\n  { width: 1440, height: 900 },');
    // 19 ancres : 19 appels `check(...)` en début de ligne (le helper n'est pas compté).
    expect((fidelity.match(/^check\(/gm) ?? []).length).toBe(19);
  });
});
