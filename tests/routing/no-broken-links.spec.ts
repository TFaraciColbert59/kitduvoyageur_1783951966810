import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACTIVE_ROUTES,
  BLOCKED_ROUTES,
  KEPT_ROUTES,
  RESERVED_WITHOUT_PAGE,
  buildRedirects,
} from '@/constants/routeRegistry';
import { LEGACY_REDIRECTS } from '@/lib/hub/hubRedirects';

/**
 * P6 — Routage : aucune destination cassee, aucune chaine, aucun lien mort.
 *
 * Le test ne se contente pas de lire le registre : il le confronte au SYSTEME
 * DE FICHIERS reel. Une destination qui ne resout pas vers un `page.tsx` est un
 * 404 deguise en 301, et `/voyage-ia -> /voyages/nouveau` l'a deja ete avant ce
 * chantier.
 *
 * Convention Next : une `source` sans `:param` est une correspondance EXACTE.
 * `/carte` ne masque donc pas `/carte-interactive`. Les tests de masquage
 * verifient cette semantique au lieu de la supposer.
 */

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'src', 'app');

/** Retire la query et le hash : on ne teste que le chemin. */
function pathnameOnly(route: string): string {
  return route.split('?')[0].split('#')[0];
}

/** Une source est dynamique des qu'elle contient un segment `:param`. */
function isDynamic(source: string): boolean {
  return source.includes(':');
}

/**
 * Resout un pathname vers le `page.tsx` attendu sous `src/app`.
 * `/hub/[section]` -> src/app/hub/[section]/page.tsx. Les crochets sont
 * ECRITS tels quels dans le registre (syntaxe Next) : on teste l'existence du
 * segment sur le disque, pas sa resolution a l'execution.
 */
function pageFileFor(route: string): string {
  const segments = pathnameOnly(route)
    .split('/')
    .filter(Boolean);
  return path.join(APP_DIR, ...segments, 'page.tsx');
}

function hasPage(route: string): boolean {
  return fs.existsSync(pageFileFor(route));
}

describe('P6 — registre de routage : destinations reelles', () => {
  it('chaque destination active resout vers un page.tsx existant', () => {
    const broken = ACTIVE_ROUTES.filter((route) => !hasPage(route.destination)).map(
      (route) => `${route.source} -> ${route.destination} (attendu ${pageFileFor(route.destination)})`,
    );
    expect(broken).toEqual([]);
  });

  it('le registre n est pas vide : une liste vide masquerait une regression', () => {
    expect(ACTIVE_ROUTES.length).toBeGreaterThan(0);
  });

  it('chaque source active est unique', () => {
    const sources = ACTIVE_ROUTES.map((route) => route.source);
    expect(new Set(sources).size).toBe(sources.length);
  });
});

describe('P6 — aucune chaine de redirection', () => {
  it('aucune destination active n est elle-meme une source active', () => {
    const sources = new Set(ACTIVE_ROUTES.map((route) => route.source));
    const chained = ACTIVE_ROUTES.filter((route) =>
      sources.has(pathnameOnly(route.destination)),
    ).map((route) => `${route.source} -> ${route.destination}`);
    expect(chained).toEqual([]);
  });

  it('aucune source ne pointe vers elle-meme', () => {
    const loops = ACTIVE_ROUTES.filter((route) => route.source === route.destination).map(
      (route) => route.source,
    );
    expect(loops).toEqual([]);
  });

  it('aucune destination active ne traverse le middleware : pas de double saut', () => {
    // Une destination geree par LEGACY_REDIRECTS serait redirigee une seconde
    // fois : 301 puis 307. La cible doit etre une route terminale.
    const middlewareSources = new Set(Object.keys(LEGACY_REDIRECTS));
    const doubled = ACTIVE_ROUTES.filter((route) =>
      middlewareSources.has(pathnameOnly(route.destination)),
    ).map((route) => `${route.source} -> ${route.destination}`);
    expect(doubled).toEqual([]);
  });

  it('aucune source active n est aussi une source du middleware', () => {
    const middlewareSources = new Set(Object.keys(LEGACY_REDIRECTS));
    const overlap = ACTIVE_ROUTES.filter((route) => middlewareSources.has(route.source)).map(
      (route) => route.source,
    );
    expect(overlap).toEqual([]);
  });
});

describe('P6 — les routes canoniques ne sont pas masquees', () => {
  it('aucune source active n est une route canonique du registre', () => {
    const kept = new Set(KEPT_ROUTES.map((route) => route.route));
    const masked = ACTIVE_ROUTES.filter((route) => kept.has(route.source)).map(
      (route) => route.source,
    );
    expect(masked).toEqual([]);
  });

  it('les sources exactes ne masquent aucune route dynamique plus longue', () => {
    // Semantique Next : `/carte` est exact, `/carte/:slug` est dynamique.
    for (const route of ACTIVE_ROUTES) {
      if (isDynamic(route.source)) continue;
      const collision = KEPT_ROUTES.map((entry) => entry.route).find(
        (keptRoute) => keptRoute.startsWith(`${route.source}/`),
      );
      expect(collision ?? null, `${route.source} vs ${collision}`).toBeNull();
    }
  });

  it('chaque route canonique existe, ou est explicitement reservee', () => {
    const missing = KEPT_ROUTES.filter(
      (route) => !hasPage(route.route) && !RESERVED_WITHOUT_PAGE.includes(route.route),
    ).map((route) => route.route);
    expect(missing).toEqual([]);
  });
});

describe('P6 — les propositions refusees sont justifiees par une page vivante', () => {
  it('chaque entree bloquee pointe vers une page reellement servie', () => {
    // C'est l'invariant le plus important du fichier : si quelqu'un supprime
    // la page, le refus n'a plus de sens et le test doit le signaler.
    const unjustified = BLOCKED_ROUTES.filter((route) => !hasPage(route.source)).map(
      (route) => route.source,
    );
    expect(unjustified).toEqual([]);
  });

  it('chaque refus porte un motif materiel, jamais un placeholder', () => {
    for (const route of BLOCKED_ROUTES) {
      expect(route.reason.length).toBeGreaterThan(40);
      expect(route.proposed.startsWith('/')).toBe(true);
    }
  });

  it('aucune proposition refusee n est appliquee en secret', () => {
    const sources = new Set(ACTIVE_ROUTES.map((route) => route.source));
    for (const route of BLOCKED_ROUTES) {
      expect(sources.has(route.source), `${route.source} ne doit pas etre actif`).toBe(false);
    }
  });
});

describe('P6 — next.config.mjs est genere, pas ecrit en dur', () => {
  it('redirects() retourne exactement le registre', () => {
    expect(buildRedirects()).toEqual(
      ACTIVE_ROUTES.map((route) => ({
        source: route.source,
        destination: route.destination,
        permanent: route.permanent,
      })),
    );
  });

  it('la config appelle buildRedirects() et ne contient plus de source litterale', () => {
    const config = fs.readFileSync(path.join(ROOT, 'next.config.mjs'), 'utf8');
    expect(config).toContain('buildRedirects()');
    // On borne au CORPS de redirects() : le fichier contient aussi headers(),
    // qui porte legitimately des `source:` litteraux.
    const redirectsBody = config.slice(
      config.indexOf('async redirects()'),
      config.indexOf('async headers()') > 0
        ? config.indexOf('async headers()')
        : config.length,
    );
    expect(redirectsBody).not.toMatch(/source:\s*'/);
  });

  it('chaque redirection generee est un objet Next valide', () => {
    for (const redirect of buildRedirects()) {
      expect(redirect.source.startsWith('/')).toBe(true);
      expect(redirect.destination.startsWith('/')).toBe(true);
      expect(typeof redirect.permanent).toBe('boolean');
    }
  });
});
