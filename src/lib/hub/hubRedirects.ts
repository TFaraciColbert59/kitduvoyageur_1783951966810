/**
 * H-AUTO-42 — Matrice des redirections 307 du chantier H (URLs héritées →
 * canoniques du hub). Résolveur PUR : aucun accès réseau, horloge ou storage,
 * testable unitairement (tests/features/hub/hubRedirects.spec.ts).
 *
 * Règles :
 * - 307 (jamais 301) pendant la phase de migration ;
 * - les paramètres utiles (slug, id, route, section, recherche) sont préservés ;
 * - pas de chaîne : aucune destination n'est elle-même une source (testé) ;
 * - pas de boucle : une source ne redirige jamais vers elle-même (testé).
 */

export interface LegacyRedirect {
  /** Pathname de destination canonique. */
  destination: string;
  /** Paramètres à POSER sur l'URL de destination (fusion avec l'existant). */
  setParams?: Record<string, string>;
}

/**
 * Table statique des sources exactes. Les paramètres de requête de l'URL
 * d'origine sont conservés (le middleware clone l'URL et ne change que le
 * pathname) — ex. /materiel/depart?route=x → /hub/depart?route=x.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  // ── Possession : les écrans fonctionnels vivent dans le hub ──
  // `/materiel` est désormais la surface d'entrée Matériel (src/app/materiel) :
  // plus de redirection. Les sous-routes historiques restent des liens
  // profonds vers les sections canoniques du hub.
  '/materiel/inventaire': '/hub/inventaire',
  '/materiel/kits': '/hub/kit',
  '/materiel/preparation': '/hub/preparation',
  '/materiel/depart': '/hub/depart',
  '/materiel/disponibilite': '/hub/disponibilite',
  '/materiel/alertes': '/hub/alertes',
  '/materiel/forget': '/hub/oublis',
  // ── Étape 2 — Hub unique : les pages séparées disparaissent ──
  '/voyages': '/hub',
  '/voyages/nouveau': '/hub/nouveau',
  '/groupes': '/hub/groupe',
  '/equipages': '/hub/groupe',
  // ── Racines absorbées (H5) ──
  '/preparation': '/hub/preparation',
  '/alertes': '/hub/alertes',
  '/terrain': '/hub',
  '/mes-aventures': '/hub',
  '/recommandations': '/hub',
  // ── Mode live : un seul cockpit canonique (D2) ──
  '/naviguer': '/randonnee-active',
  '/boussole': '/randonnee-active',
  // ── Assistants : l'equipement est un onglet du preparateur (traite en cas dynamic ci-dessous) ──
  // ── Social-lite / commerce (D7) ──
  '/activite': '/feed',
  '/gamification': '/recompenses',
  '/encheres': '/occasion',
};

/**
 * Résout un pathname hérité. Retourne null si le pathname n'est pas concerné.
 * Cas dynamiques :
 * - /materiel/depart/[id] → /hub/depart?id=[id] (l'id 'none' = cockpit vitrine,
 *   il est préservé tel quel pour une sémantique identique) ;
 * - /groupes/[id] et /equipages/[slug] → /hub/groupe ;
 * - /voyages/[slug] et /voyages/[slug]/[section] restent des SHIMS serveur
 *   (changement d'aventure active puis redirection) — non gérés ici.
 */
export function resolveLegacyRedirect(pathname: string): LegacyRedirect | null {
  // L'assistant equipement n'est plus une page : c'est l'onglet « equipement »
  // du preparateur. /rapport-kit et /ai-configurator ouvrent directement le
  // bon onglet ; la query d'origine (country, groupId, carnetId, trail) est
  // conservee par le clone d'URL du middleware.
  if (pathname === '/rapport-kit' || pathname === '/ai-configurator') {
    return { destination: '/preparer', setParams: { tab: 'equipement' } };
  }

  const staticTarget = LEGACY_REDIRECTS[pathname];
  if (staticTarget) return { destination: staticTarget };

  const departPrefix = '/materiel/depart/';
  if (pathname.startsWith(departPrefix)) {
    const rest = pathname.slice(departPrefix.length);
    const id = rest.split('/')[0];
    if (!id) return null;
    return { destination: '/hub/depart', setParams: { id } };
  }

  if (pathname.startsWith('/groupes/')) return { destination: '/hub/groupe' };
  if (pathname.startsWith('/equipages/')) return { destination: '/hub/groupe' };

  return null;
}
