/**
 * Route Redirects Configuration — derive de src/constants/routeRegistry.json.
 *
 * `next.config.mjs` ne peut pas importer de TypeScript : ce module est donc le
 * pont ESM vers la MEME source unique (le JSON), sur le modele de
 * `image-hosts.config.mjs`. Il ne contient aucune donnee propre : toute
 * decision de routage vit dans le JSON, et la coherence des deux est verrouillee
 * par tests/routing/no-broken-links.spec.ts.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Registre brut, lu une seule fois au chargement de la configuration. */
const REGISTRY = JSON.parse(
  readFileSync(join(HERE, 'src', 'constants', 'routeRegistry.json'), 'utf8'),
);

/** Redirections reellement appliquees par Next (`status: active` uniquement). */
export const ROUTE_REDIRECTS = Object.freeze(
  REGISTRY.active.map((entry) => Object.freeze({ ...entry })),
);

/** Destinations, pour l'invariant « aucune chaine ». */
export const ROUTE_REDIRECT_SOURCES = Object.freeze(ROUTE_REDIRECTS.map((entry) => entry.source));

/**
 * Redirections au format attendu par `next.config.mjs`.
 * Une destination deja Complete (avec query) reste intacte : c'est Next qui
 * construit l'URL finale, aucune chaine n'est ajoutee ici.
 */
export function buildRedirects() {
  return ROUTE_REDIRECTS.map((entry) => ({
    source: entry.source,
    destination: entry.destination,
    permanent: entry.permanent === true,
  }));
}
