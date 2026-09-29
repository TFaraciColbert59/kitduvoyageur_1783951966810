/**
 * A4 — la barre basse n est JAMAIS masquee sur le preparateur.
 *
 * Le code etait deja correct : `MobileNavWrapper.tsx:23-35` ne liste plus
 * `/prepare` parmi les routes sans navigation, et `AdventurePrepScreen.tsx:23`
 * demande bien la reservation via `hasBottomNav`. Ce qui manquait, etait la
 * PREUVE : jusqu ici `isNoNavRoute` n apparaisse dans aucun test. Le seul
 * fichier qui en parlait, `shell-day-focus.test.tsx:11`, le faisait dans un
 * commentaire. Une regression qui remettrait `/prepare` dans la liste
 * n aurait rougi aucun test — elle aurait rendu l ecran sans issue, et
 * `AppShell` ne rend que la reservation de place, jamais la barre.
 *
 * Ce fichier monte donc le composant REEL, en jsdom, et regarde ce qui est
 * reellement dans le DOM. Il ne lit pas la source : il observe la branche.
 *
 * Deux moities, deux preuves :
 * - « jamais masquee »    : la barre basse est montee sur `/prepare` ;
 * - « jamais recouverte » : l ecran demande la reservation, donc le contenu
 *   ne passe pas dessous.
 */

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SearchProvider } from '@/contexts/SearchContext';
import { ToastProvider } from '@/contexts/ToastContext';
import MobileNavWrapper from '@/components/mobile-nav/MobileNavWrapper';
import AdventurePrepScreen from '@/features/adventure-prep/components/AdventurePrepScreen';

/* ------------------------------------------------------------------ */
/* Routeur : la seule chose qu on pilote. Aucun composant n est simule. */
/* ------------------------------------------------------------------ */

const router = vi.hoisted(() => ({ pathname: '/prepare' as string | null }));

vi.mock('next/navigation', () => ({
  usePathname: () => router.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

/* ------------------------------------------------------------------ */
/* Outils de lecture                                                   */
/* ------------------------------------------------------------------ */

/**
 * La barre basse telle que le code lui-meme la nomme.
 *
 * `nav[aria-label="Navigation principale"]` n est pas un selecteur invente par
 * le test : c'est la chaine que `WebNavigationBar.tsx` utilise pour retrouver
 * son declencheur (`HUB_TRIGGER`), et le libelle qu il passe a
 * `NavigationSurface`. Un test qui choisirait un autre marqueur pourrait
 * passer sur une barre qui n est pas celle du site.
 */
const BARRE = 'nav[aria-label="Navigation principale"]';

function barre(): HTMLElement | null {
  return document.querySelector<HTMLElement>(BARRE);
}

/**
 * Le budget d attente de la barre, en millisecondes.
 *
 * `NavigationBar` n est pas un composant local : `MobileNavWrapper` le charge
 * par `next/dynamic(..., { ssr: false })`. La barre n existe donc pas au
 * moment du `render` : elle n existe qu une fois le module resolu, et ce
 * module passe par la transformation de Vite.
 *
 * Le budget par defaut de `waitFor` (1 000 ms) est alors une course : quand
 * la suite tourne en entier, le premier worker qui charge ce module partage
 * le processeur avec les 204 autres fichiers, et la resolution peut depasser
 * la seconde. Le test echouait alors sur un defaut de BARRE, sans que le
 * code change : un faux rouge qui apprend au lecteur a ignorer le signal.
 *
 * On elargit donc le budget, et on ne touche qu a lui. L assertion reste
 * « la barre est montee » ; elle cesse seulement de dependre de la charge
 * machine. Une vraie regression — /prepare remis dans la liste des routes
 * sans navigation — echoue toujours, et tout de suite.
 */
const BUDGET_BARRE = { timeout: 15_000 } as const;

/**
 * Le budget du runner, en millisecondes.
 *
 * Il doit surpasser `BUDGET_BARRE`, sinon vitest tue le test a 5 s et le
 * defaut sort en « timeout » : on ne lit plus CE QUI MANQUE, on lit une
 * course perdue. Un test qui echoue doit nommer son absence — ici, la
 * barre qui ne se monte pas — sinon le lecteur est renvoye vers le
 *.verbose pour deviner.
 */
const BUDGET_TEST = 20_000;

/** Attend que la barre soit la, avec le budget dedie. */
async function attendreBarre(message: string): Promise<HTMLElement> {
  return waitFor(() => {
    const trouve = barre();
    expect(trouve, message).not.toBeNull();
    return trouve as HTMLElement;
  }, BUDGET_BARRE);
}

/** Les routes que la liste masque encore, et qui doivent donc le rester. */
const ROUTES_SANS_BARRE = [
  '/connexion',
  '/inscription',
  '/checkout',
  '/checkout/paiement',
  '/communaute/publier',
] as const;

beforeEach(() => {
  router.pathname = '/prepare';
});

afterEach(() => {
  cleanup();
});

/**
 * Un client de requetes neuf par montage.
 *
 * Les fournisseurs ci-dessous ne sont pas des doublures : ce sont les
 * fournisseurs reels du layout racine, montes a l identique. Seul le client
 * est recree, pour qu aucun cache ne survive d un test a l autre. Sans lui,
 * `TabItem` echoue sur `useQueryClient` et la barre ne se monte pas.
 */
function nouveauClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Monte le wrapper reel dans ses fournisseurs, puis rend la main. */
async function monter(pathname: string): Promise<void> {
  router.pathname = pathname;
  render(
    React.createElement(
      QueryClientProvider,
      { client: nouveauClient() },
      React.createElement(
        SearchProvider,
        null,
        React.createElement(
          ToastProvider,
          null,
          React.createElement(MobileNavWrapper as unknown as React.ComponentType),
        ),
      ),
    ),
  );
  // Laisse le temps aux effets de montage de passer. Sans cela une absence
  // de barre pourrait etre un simple retard, pas une decision.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('A4-1 — la barre basse est montee sur /prepare', () => {
  it('A4-01: /prepare rend la barre de navigation principale', async () => {
    await monter('/prepare');
    await attendreBarre('la barre basse ne se monte pas sur /prepare');
  }, BUDGET_TEST);

  it('A4-02: la barre porte des onglets, pas seulement un conteneur vide', async () => {
    await monter('/prepare');
    // Une barre vide ne prouverait rien : on compte les liens de
    // destination reellement rendus, pas la presence d une balise.
    const surface = await attendreBarre('la barre ne se monte pas, ses onglets nont rien a porter');
    const liens = surface.querySelectorAll('a[href]');
    expect(liens.length, 'la barre est montee mais ne rend aucun onglet').toBeGreaterThan(3);
  }, BUDGET_TEST);

  it('A4-03: /prepare n est PAS dans la liste des routes sans navigation', async () => {
    // Le temoin qui empeche l item d etre vacu : la meme liste, la meme
    // fonction, sur une route qui EST masquee. Si `/prepare` etait masque,
    // ce test passerait quand meme en ne rendant rien du tout.
    await monter('/checkout');
    expect(barre(), '/checkout ne devrait pas monter la barre').toBeNull();
    await monter('/prepare');
    await attendreBarre(
      'la meme liste masque /prepare : liste et route ne sont pas dissociees',
    );
  }, BUDGET_TEST);
});

describe('A4-2 — les routes reellement masquees le restent', () => {
  for (const route of ROUTES_SANS_BARRE) {
    it(`A4-04: ${route} ne monte aucune barre basse`, async () => {
      await monter(route);
      // La branche sans navigation rend `<OfflineBanner />` seul. On exige
      // l absence ET l absence de tout lien de navigation : une barre
      // cassee ne disparaitrait pas, elle se viderait.
      expect(barre(), `${route} ne devrait pas monter la barre basse`).toBeNull();
      expect(
        document.querySelectorAll('a[href]').length,
        `${route} rend encore des liens de navigation`,
      ).toBe(0);
    });
  }
});

describe('A4-3 — la frontiere de prefixe reste respectee', () => {
  it('A4-05: /preparer-randonnee garde sa navigation', async () => {
    // Un prefixe `/prepare` trop large deborderait sur les autres routes du
    // preparateur, qui ont leur propre contenu de chrome.
    await monter('/preparer-randonnee');
    await attendreBarre('/preparer-randonnee a perdu sa navigation');
  }, BUDGET_TEST);

  it('A4-06: /preparer-sentier garde sa navigation', async () => {
    await monter('/preparer-sentier');
    await attendreBarre('/preparer-sentier a perdu sa navigation');
  }, BUDGET_TEST);
});

describe('A4-4 — la barre reserve sa place : jamais recouverte', () => {
  it('A4-07: /prepare publie une reservation basse NON nue', async () => {
    await monter('/prepare');
    await attendreBarre('la barre ne se monte pas, la reservation ne peut pas etre publiee');
    // La reservation est publiee sur la RACINE par `BottomNavReservation`.
    // `--page-bottom-inset-bare` est la valeur « pas de barre » : la lire
    // ici prouverait que l ecran a ete mesure comme si la barre n existait
    // pas, donc que le contenu passe dessous.
    const reserve = document.documentElement.style.getPropertyValue('--bottom-nav-height');
    expect(reserve, 'aucune reservation basse publiee sur /prepare').not.toBe('');
    expect(reserve, 'la reservation correspond a « pas de barre »').not.toBe(
      'var(--page-bottom-inset-bare)',
    );
  }, BUDGET_TEST);

  it('A4-08: l ecran du preparateur demande la reservation au shell', async () => {
    // Moitie « jamais recouverte » cote page : `AdventurePrepScreen` doit
    // passer `hasBottomNav` a `AppShell`, sinon le padding du shell annule
    // la reservation que la barre publie. On lit l effet sur le style inline
    // du div racine, donc sur le DOM rendu et non sur la source.
    render(React.createElement(AdventurePrepScreen as unknown as React.ComponentType));
    const racine = await waitFor(() => {
      const el = document.querySelector('.app-shell') as HTMLElement | null;
      expect(el, 'le shell du preparateur ne se monte pas').not.toBeNull();
      return el as HTMLElement;
    }, BUDGET_BARRE);
    const padding = racine.style.paddingBottom;
    expect(padding, 'le shell ne reserve aucune place en bas').not.toBe('');
    expect(
      padding,
      'le shell mesure la page comme si la barre n existait pas',
    ).not.toContain('--page-bottom-inset-bare');
  }, BUDGET_TEST);
});
