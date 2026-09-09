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
  '/materiel': '/hub',
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
  '/equipages': '/hub/equipage',
  // ── Racines absorbées (H5) ──
  '/preparation': '/hub/preparation',
  '/alertes': '/hub/alertes',
  '/terrain': '/hub',
  '/mes-aventures': '/hub',
  '/recommandations': '/hub',
  // ── Mode live : un seul cockpit canonique (D2) ──
  '/naviguer': '/randonnee-active',
  '/boussole': '/randonnee-active',
  // ── Assistants : un seul wizard kit (D5) ──
  '/rapport-kit': '/ai-configurator',
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
 * - /groupes/[id] et /equipages/[slug] → sections hub correspondantes ;
 * - /voyages/[slug] et /voyages/[slug]/[section] restent des SHIMS serveur
 *   (changement d'aventure active puis redirection) — non gérés ici.
 */
export function resolveLegacyRedirect(pathname: string): LegacyRedirect | null {
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
  if (pathname.startsWith('/equipages/')) return { destination: '/hub/equipage' };

  return null;
}
