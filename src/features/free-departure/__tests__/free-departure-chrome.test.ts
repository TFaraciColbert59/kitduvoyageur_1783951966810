import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * La barre d onglets doit disparaitre sur 60/61/62 sans dependre d un signal
 * envoye au montage — elle est montee en client-only et le recevait trop tard.
 * Une regle CSS ne peut pas « ne pas fonctionner » bruyamment : si un seul des
 * deux selecteurs ne correspond a rien, l ecriture passe, la barre reste, et rien
 * ne le signale. Ces tests existent pour que ce silence devienne bruyant.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const css = readFileSync(join(here, '..', 'free-departure.css'), 'utf8');

const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

describe('le retour libre retire la barre d onglets', () => {
  it('la regle existe, et elle est structurelle', () => {
    expect(css).toContain('body:has(.free-departure) .lkv-nav-surface');
    const body = css.match(/body:has\(\.free-departure\) \.lkv-nav-surface\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(body).toMatch(/display:\s*none/);
  });

  it('le selecteur de la barre correspond a un element REEL', () => {
    // `NavigationSurface` porte `lkv-nav-surface`. Si la classe changeait, la
    // regle cesserait de matcher — silencieusement, la barre resterait posee.
    const nav = read('src', 'components', 'mobile-nav', 'navigation', 'NavigationSurface.tsx');
    expect(nav).toContain('lkv-nav-surface');
  });

  it('le selecteur d etat correspond aux trois ecrans du retour libre', () => {
    // 60 avant, 61 pendant, 62 apres : les trois doivent porter la classe racine,
    // sinon un etat garde la barre par-dessus lui.
    for (const file of [
      ['FreeDepartureScreen', '60 avant'],
      ['FreeLiveScreen', '61 pendant'],
      ['FreeSummaryScreen', '62 apres'],
    ] as const) {
      const src = read('src', 'features', 'free-departure', 'components', `${file[0]}.tsx`);
      expect(src, `${file[1]} (${file[0]}) ne porte pas .free-departure`).toContain(
        'adventure-prep free-departure',
      );
    }
  });

  it("n'a plus besoin du canal d evenement ni de son rejeu", () => {
    // Le contournement par rejeu est mort : il introduisait une course et
    // surtout une restauration a maintenir a la main. Aucun reliquat ne doit
    // survivre, sous peine de ressusciter la double mecanique.
    expect(read('src', 'features', 'free-departure', 'engine', 'freeFlow.ts')).not.toContain(
      'lkdv-toggle-bottom-bar',
    );
    // Le module lui. Le fichier de test, lui, existe par definition : c'est
    // celui-ci. Le nommer ici serait une assertion qui se contredit elle-meme.
    expect(
      () => read('src', 'features', 'free-departure', 'engine', 'chrome.ts'),
      'engine/chrome.ts existe encore',
    ).toThrow();
  });
});
