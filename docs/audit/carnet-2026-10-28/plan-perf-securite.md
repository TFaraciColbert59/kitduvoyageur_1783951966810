# Plan performance + sécurité — fiche carnet (28 octobre)

Décision : l'utilisateur autorise l'exécution sans approbation préalable, à condition de ne rien risquer
(« rien de risqué ou qui risque régression »). Donc : uniquement des changements locaux, testables,
réversibles, sans migration de données ni changement d'interface publique.

## Checklist performance (50)

### Rendu et React
- [ ] 1. `React.memo` sur les tuiles de grille (props stables)
- [ ] 2. `useCallback` sur les handlers passés aux listes
- [ ] 3. `useMemo` sur les tableaux dérivés (participants, jours, moments)
- [ ] 4. Découper `CarnetCard` : en-tête / grille / pied mémoïsés séparément
- [ ] 5. Éviter les objets/tableaux inline dans les props
- [ ] 6. Clés de liste stables (id réel, jamais l'index)
- [ ] 7. `startTransition` sur les changements de page du carrousel
- [ ] 8. `useDeferredValue` sur le filtre de commentaires

### Images
- [ ] 9. `sizes` correct sur chaque tuile (33vw)
- [ ] 10. `loading="lazy"` sauf 3 premières tuiles
- [ ] 11. `fetchpriority="high"` sur la première tuile uniquement
- [ ] 12. `decoding="async"` sur les vignettes
- [ ] 13. Largeur/hauteur explicites (zéro CLS)
- [ ] 14. Placeholder flouté 20 px en `background-image`
- [ ] 15. `next/image` là où le domaine est autorisé, sinon `<img>` avec dimensions

### Réseau et données
- [ ] 16. Requêtes Supabase parallélisées (`Promise.all`) vérifiées
- [ ] 17. Colonnes explicites dans chaque `select` (jamais `*`)
- [ ] 18. `count: 'exact'` remplacé par `planned` si le chiffre exact n'est pas affiché
- [ ] 19. `limit` sur likes/commentaires
- [ ] 20. Pas de requête dans un composant client déjà servie par le serveur
- [ ] 21. Cache serveur court par utilisateur (déjà en place ?) vérifié
- [ ] 22. `revalidate` cohérent avec la fraîcheur attendue
- [ ] 23. Prefetch des routes au survol uniquement

### Bundle
- [ ] 24. `dynamic()` sur la carte MapLibre (déjà fait) vérifié
- [ ] 25. Imports nommés (pas d'import de barrel entier)
- [ ] 26. Aucun `lodash` complet, aucun polyfill inutile
- [ ] 27. `lucide-react` en imports nommés uniquement
- [ ] 28. Vérifier le poids du chunk carnet après build
- [ ] 29. Supprimer les imports morts détectés par eslint

### CSS
- [ ] 30. Aucun `@import` dans une feuille critique
- [ ] 31. `content-visibility: auto` sur les sections hors écran
- [ ] 32. `will-change` limité aux éléments animés
- [ ] 33. Transitions uniquement sur `transform`/`opacity`
- [ ] 34. Pas de `filter`/`backdrop-filter` sur des listes longues

### Exécution
- [ ] 35. Pas de `setState` dans une boucle
- [ ] 36. Throttle sur le scroll (si listener)
- [ ] 37. `passive: true` sur les listeners de scroll/touch
- [ ] 38. Nettoyage de tous les timers/listeners
- [ ] 39. Pas de re-render au focus
- [ ] 40. `ResizeObserver` au lieu de `resize`

### Mesure
- [ ] 41. LCP < 2,5 s sur la fiche
- [ ] 42. INP < 200 ms sur changement de page
- [ ] 43. CLS < 0,02
- [ ] 44. TTFB < 800 ms
- [ ] 45. Poids JS initial < 250 Ko gzip
- [ ] 46. Nombre de requêtes < 15 au premier rendu
- [ ] 47. Aucune image > 300 Ko
- [ ] 48. Cache statique `immutable` sur `/_next/static`
- [ ] 49. Service worker : network-first respecté
- [ ] 50. Rapport Lighthouse consigné

## Checklist sécurité (50)

### En-têtes et transport
- [ ] 1. CSP sans `unsafe-eval` en prod
- [ ] 2. `Strict-Transport-Security` présent
- [ ] 3. `X-Content-Type-Options: nosniff`
- [ ] 4. `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] 5. `Permissions-Policy` minimal
- [ ] 6. `X-Frame-Options` ou `frame-ancestors`
- [ ] 7. `Cache-Control: no-store` sur les pages privées
- [ ] 8. Pas de source map publique en prod

### Authentification et session
- [ ] 9. Cookies `httpOnly` + `secure` + `sameSite`
- [ ] 10. Aucun jeton dans `localStorage`
- [ ] 11. Rafraîchissement de session côté serveur
- [ ] 12. Déconnexion purge le service worker
- [ ] 13. Pas d'énumération d'utilisateurs via erreurs

### Autorisation (RLS)
- [ ] 14. `carnets` : lecture limitée au public ou au propriétaire
- [ ] 15. `carnet_moments` : même règle que le carnet
- [ ] 16. `carnet_comments` : insertion authentifiée, suppression auteur
- [ ] 17. `carnet_likes` : insertion authentifiée
- [ ] 18. `carnet_collaborators` : lecture scoped
- [ ] 19. `hike_sessions` : `visibility` respectée (écart connu)
- [ ] 20. `hike_session_participants` : participants d'un carnet public
- [ ] 21. Aucune table sans RLS activée
- [ ] 22. Vérification des `security definer` (search_path)
- [ ] 23. Pas d'`EXECUTE` anon sur des fonctions sensibles

### Entrées et injections
- [ ] 24. Validation de longueur sur tous les champs libres
- [ ] 25. Échappement systématique (React) — aucun `dangerouslySetInnerHTML`
- [ ] 26. `serializeJsonLd` échappe `<`, `>`, `&`
- [ ] 27. Aucune requête SQL construite par concaténation
- [ ] 28. `ilike` avec caractères échappés
- [ ] 29. Upload : type MIME et taille vérifiés
- [ ] 30. `stripImageMetadata` appliqué (EXIF/GPS)
- [ ] 31. URL d'image validée (domaines autorisés)
- [ ] 32. Redirections ouvertes impossibles

### Secrets et config
- [ ] 33. Aucun secret dans le bundle client
- [ ] 34. `.env.local` ignoré par git
- [ ] 35. Clés publiques uniquement côté client
- [ ] 36. Service role jamais importé dans un composant client
- [ ] 37. Logs sans données personnelles
- [ ] 38. Erreurs génériques côté client

### Abus et disponibilité
- [ ] 39. Rate limit sur les mutations (like/commentaire)
- [ ] 40. Taille de payload limitée
- [ ] 41. Pas de boucle infinie de requêtes (garde de temps)
- [ ] 42. Timeouts sur les appels externes
- [ ] 43. Turnstile sur les formulaires publics (si activé)
- [ ] 44. Aucun `eval`/`new Function`

### Vie privée
- [ ] 45. Pas de géoloc exacte exposée publiquement
- [ ] 46. Participant anonymisé si `visibility = collective_anonymized`
- [ ] 47. Pas d'email dans les payloads publics
- [ ] 48. Droit à l'effacement : suppression en cascade vérifiée
- [ ] 49. Analytics sans identifiant persistant
- [ ] 50. Journal d'audit des accès propriétaire

## Périmètre d'exécution de cette session

Seules les cases sans risque de régression seront cochées : optimisation locale de rendu, images,
requêtes, en-têtes déjà configurés (vérification), contrôles RLS en lecture (rapport), validation d'entrées
existante (vérification). Aucune migration, aucune policy modifiée, aucun changement d'interface.
