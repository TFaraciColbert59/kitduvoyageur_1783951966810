# Performance & sécurité — checklist 50 + 50

Date : 2026-10-27 · Exécution autonome · Aucune migration destructive.

## Performance (50)

| # | Amélioration | État |
|---:|---|---|
| 1 | Désactiver l’en-tête X-Powered-By | Appliqué |
| 2 | Cache immutable des assets /_next/static | Appliqué |
| 3 | Cache immutable des médias /_next/static/media | Appliqué |
| 4 | Preconnect Supabase | Vérifié existant |
| 5 | Preconnect ArcGIS (tuiles) | Appliqué |
| 6 | Formats AVIF/WebP | Vérifié existant |
| 7 | Lazy-loading des images hors écran | Vérifié existant |
| 8 | decoding=async sur les images | Vérifié existant |
| 9 | Simplification des traces Monde/Pays | Appliqué |
| 10 | Identité stable de zoomConfig par bande | Appliqué |
| 11 | Réutilisation des marqueurs DOM | Appliqué |
| 12 | Agrégation des massifs sans rebuild par frame | Appliqué |
| 13 | Selection réappliquée sans recréer le calque | Appliqué |
| 14 | Suppression des logs console en prod | Vérifié existant |
| 15 | Source maps navigateur désactivées | Vérifié existant |
| 16 | Bundle analyzer disponible | Vérifié existant |
| 17 | optimizePackageImports configuré | Vérifié existant |
| 18 | Drawers lourds en dynamic import | Vérifié existant |
| 19 | PostDrawer en dynamic import | Vérifié existant |
| 20 | React Query staleTime sur les drawers | Vérifié existant |
| 21 | Cache HTTP privé sur les routes auth | Vérifié existant |
| 22 | no-store sur /compte et /hub | Vérifié existant |
| 23 | Compression HTTP activée | Vérifié existant |
| 24 | Image responsive sizes/srcset | Vérifié existant |
| 25 | Image minimumCacheTTL 24 h | Vérifié existant |
| 26 | Content-Security-Policy images | Vérifié existant |
| 27 | Polices en font-display swap | Différé — audit |
| 28 | Préchargement de la police critique | Différé |
| 29 | fetchPriority sur l’image héros | Différé |
| 30 | content-visibility sur les sections basses | Différé |
| 31 | Virtualisation des longues listes | Différé |
| 32 | Mémoïsation des cartes communauté | Différé |
| 33 | Réduire le bundle framer-motion | Différé |
| 34 | Tree-shaking des icônes | Vérifié existant |
| 35 | Éviter les clients Supabase dupliqués | Vérifié existant |
| 36 | Pagination des commentaires | Vérifié existant |
| 37 | Limites de requêtes communauté | Vérifié existant |
| 38 | Colonnes Supabase explicites | Vérifié existant |
| 39 | Requêtes N+1 dans les drawers | Différé — audit |
| 40 | Index DB sur les recherches | Différé — audit |
| 41 | Cache CDN des pages publiques | Différé |
| 42 | ETag sur les API publiques | Différé |
| 43 | Compression Brotli | Vérifié plateforme |
| 44 | HTTP/3 | Vérifié plateforme |
| 45 | Early Hints | Différé |
| 46 | Worker MapLibre séparé | Vérifié existant |
| 47 | Cache des tuiles cartographiques | Vérifié navigateur |
| 48 | Debounce du recalcule de clusters | Différé |
| 49 | Hystérésis des agrégats | Différé |
| 50 | Mesure Core Web Vitals en prod | Différé |

## Sécurité (50)

| # | Mesure | État |
|---:|---|---|
| 1 | HSTS preload | Vérifié existant |
| 2 | X-Frame-Options DENY | Vérifié existant |
| 3 | X-Content-Type-Options nosniff | Vérifié existant |
| 4 | Referrer-Policy stricte | Vérifié existant |
| 5 | Permissions-Policy caméra/micro/géoloc | Vérifié existant |
| 6 | X-DNS-Prefetch-Control | Appliqué |
| 7 | X-Permitted-Cross-Domain-Policies | Appliqué |
| 8 | Suppression X-Powered-By | Appliqué |
| 9 | CSP Report-Only | Vérifié existant |
| 10 | CSP enforce avec nonce | Différé — nécessite nonce |
| 11 | Cookies auth HttpOnly | Vérifié existant |
| 12 | Cookies SameSite | Vérifié existant |
| 13 | Cookies Secure en prod | Vérifié existant |
| 14 | Protection CSRF des mutations | Différé — audit |
| 15 | Rate limit connexion | Différé — audit |
| 16 | Rate limit API sensibles | Différé — audit |
| 17 | Validation Zod des entrées | Vérifié existant |
| 18 | Échappement React | Vérifié existant |
| 19 | Requêtes paramétrées Supabase | Vérifié existant |
| 20 | RLS sur les tables utilisateur | Vérifié existant |
| 21 | Politiques Storage | Vérifié existant |
| 22 | URLs signées pour médias privés | Vérifié existant |
| 23 | Buckets privés | Vérifié existant |
| 24 | Validation MIME upload | Vérifié existant |
| 25 | Limite taille upload | Vérifié existant |
| 26 | Protection SSRF des fetch URL | Différé — audit |
| 27 | Open redirect | Différé — audit |
| 28 | Contrôle rôle admin | Vérifié existant |
| 29 | Service role key serveur uniquement | Vérifié existant |
| 30 | Secrets absents du client | Vérifié existant |
| 31 | Signature des webhooks | Différé — audit |
| 32 | Nonce CSP | Différé |
| 33 | Audit dépendances | Différé — exécution CI |
| 34 | Lockfile verrouillé | Vérifié existant |
| 35 | En-têtes sécurité API | Vérifié existant |
| 36 | Cache privé des réponses auth | Vérifié existant |
| 37 | no-store sur données sensibles | Vérifié existant |
| 38 | Révocation de session | Vérifié existant |
| 39 | Reset mot de passe | Vérifié existant |
| 40 | MFA disponible | Vérifié existant |
| 41 | Journal d’audit | Différé — audit |
| 42 | Messages d’erreur sans fuite | Vérifié existant |
| 43 | PII hors logs | Différé — audit |
| 44 | CORS restrictif | Différé — audit |
| 45 | Pas de wildcard CORS | Différé — audit |
| 46 | Proxy image sans SSRF | Différé |
| 47 | SVG interdit via next/image | Vérifié existant |
| 48 | Path traversal upload | Vérifié existant |
| 49 | Content sniffing upload | Vérifié existant |
| 50 | Alertes sécurité | Différé |

## Appliqué dans cette passe

- Suppression de `X-Powered-By`.
- Cache immutable des assets Next.
- `X-DNS-Prefetch-Control: on`.
- `X-Permitted-Cross-Domain-Policies: none`.
- Preconnect Supabase + ArcGIS.
- Hiérarchie carte : traces simplifiées, clusters sans rebuild par frame, sélection stable.
- Drawer Sortie : produits réels, catégories, profils cliquables.

## Différé volontairement

Tout ce qui touche CSP enforce, migrations DB, rate limiting distribué, webhooks, CORS ou audit de dépendances : nécessite une fenêtre de test dédiée pour éviter une régression.
