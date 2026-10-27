# Carnet / Création — plan performance & sécurité

**Date :** 2026-10-28
**Mode :** autonomie, sans approbation. Aucune modification des flux Compte.
**Règle :** uniquement des changements locaux, réversibles, sans migration ni secret.

## Garde-fous

- Pas de migration DB, pas de nouvelle clé, pas de changement RLS.
- Pas de modification des API publiques existantes.
- Pas de refonte visuelle globale ; uniquement les points sûrs.
- Tout échec de snapping/IA reste un fallback visible, jamais une perte de saisie.
- Build + tests + prod Vercel à la fin.

---

# A. 50 améliorations performance

## Bundle & chargement (1–10)
- [x] 1. Charger MapLibre uniquement à l’ouverture de Carnet (`next/dynamic`).
- [x] 2. Isoler `CarnetMapDrawer` dans un chunk séparé.
- [ ] 3. Vérifier la taille du chunk MapLibre.
- [ ] 4. Différer le CSS MapLibre au chunk Carnet.
- [x] 5. Ne pas importer CarnetMapDrawer pour les autres types.
- [ ] 6. Précharger le chunk Carnet au survol de l’onglet.
- [ ] 7. Vérifier le tree-shaking des icônes Lucide.
- [ ] 8. Supprimer les imports inutilisés de Carnet.
- [ ] 9. Éviter les barrels d’imports lourds.
- [ ] 10. Mesurer LCP/INP de /communaute avant/après.

## Rendu (11–20)
- [ ] 11. Mémoriser les listes de moments.
- [ ] 12. Éviter de recréer tous les marqueurs à chaque frappe.
- [ ] 13. Diff/reuse des marqueurs MapLibre.
- [x] 14. Éviter `innerHTML` pour les marqueurs.
- [ ] 15. `requestAnimationFrame` pour le tracé.
- [ ] 16. Limiter les points de tracé rendus.
- [x] 17. Plafonner les points stockés.
- [ ] 18. `content-visibility` sur les slides inactives.
- [ ] 19. `loading="lazy"` sur toutes les images.
- [ ] 20. Éviter les `watch()` globaux inutiles.

## Réseau (21–30)
- [x] 21. Debounce de la recherche d’adresse (320 ms).
- [x] 22. Abort des requêtes géocodage précédentes.
- [x] 23. Abort du routage précédent.
- [ ] 24. Cache local des routes par empreinte.
- [ ] 25. Cache local des recherches d’adresse.
- [ ] 26. Dédupliquer les appels de géocodage identiques.
- [ ] 27. Réduire le payload `map_points`.
- [ ] 28. Compression des réponses JSON.
- [ ] 29. Backoff sur 429/503.
- [ ] 30. Ne pas appeler la route si < 3 points.

## Carte (31–40)
- [ ] 31. `maxPixelRatio` limité sur mobile.
- [ ] 32. Désactiver les couches inutiles du style topo.
- [ ] 33. Réduire le nombre de labels.
- [ ] 34. Simplifier le tracé avant rendu.
- [ ] 35. Limiter les points de route à 14.
- [ ] 36. Détruire la carte à la fermeture.
- [x] 37. Une seule carte fixe, pas une par jour.
- [ ] 38. `ResizeObserver` unique.
- [ ] 39. Éviter les `setData` identiques.
- [ ] 40. Désactiver les animations si reduced-motion.

## Formulaires (41–50)
- [x] 41. Brouillon local debounced existant.
- [ ] 42. Validation par champ, pas globale à chaque frappe.
- [ ] 43. Ne pas charger l’IA avant clic.
- [x] 44. Bouton IA désactivé sans texte.
- [ ] 45. Compression image avant upload.
- [ ] 46. Upload seulement à la soumission.
- [ ] 47. `startTransition` pour les slides.
- [ ] 48. `requestIdleCallback` pour les marqueurs.
- [ ] 49. Code splitting des composants lourds.
- [ ] 50. Budget perf CI (bundle + INP).

---

# B. 50 améliorations sécurité

## Entrées & validation (1–10)
- [x] 1. Schémas Zod sur les formulaires.
- [x] 2. Longueurs maximales des champs.
- [x] 3. Encodage URL des recherches.
- [x] 4. Allowlist des paramètres `/api/route`.
- [x] 5. Allowlist des paramètres `/api/geocode`.
- [x] 6. Validation lat/lon côté serveur.
- [ ] 7. Valider lat/lon côté client avant `map_points`.
- [x] 8. Limiter les points de route (`MAX_ROUTE_POINTS`).
- [x] 9. Taille fichier média limitée à 50 Mo.
- [x] 10. Types MIME acceptés limités.

## Auth & données (11–20)
- [x] 11. Auth vérifiée avant insertion carnet.
- [x] 12. `author_id` vient de la session.
- [ ] 13. Vérifier RLS `carnets` en lecture/écriture.
- [ ] 14. Vérifier RLS `community_posts`.
- [ ] 15. Vérifier RLS `materiel_kits`.
- [ ] 16. Aucun service role côté client.
- [ ] 17. Vérifier les policies storage.
- [ ] 18. Purger le brouillon après succès.
- [ ] 19. Purger le brouillon à la déconnexion.
- [ ] 20. Ne pas stocker de PII dans `map_points`.

## XSS & rendu (21–30)
- [x] 21. Pas de `dangerouslySetInnerHTML`.
- [x] 22. Marqueurs sans `innerHTML` utilisateur.
- [x] 23. Labels React échappés.
- [ ] 24. Vérifier les URLs de cover.
- [ ] 25. Vérifier les liens de story.
- [ ] 26. Pas d’emoji HTML injecté.
- [ ] 27. CSP report-only à durcir.
- [ ] 28. `rel="noopener noreferrer"` sur liens externes.
- [ ] 29. Valider les noms de fichiers affichés.
- [ ] 30. Éviter les data URLs non contrôlées.

## API & abus (31–40)
- [x] 31. Rate limit `/api/route`.
- [x] 32. Rate limit `/api/geocode`.
- [x] 33. Timeout fournisseur.
- [x] 34. Fallback sans fuite de secret.
- [ ] 35. Vérifier le budget Geoapify.
- [ ] 36. Vérifier les logs sans PII.
- [ ] 37. Vérifier les erreurs sans stack client.
- [ ] 38. Vérifier CORS same-origin.
- [ ] 39. Vérifier CSRF sur mutations.
- [ ] 40. Vérifier les webhooks/cron.

## Robustesse (41–50)
- [x] 41. Abort des fetch au démontage.
- [x] 42. Fallback si route indisponible.
- [ ] 43. Cap `map_points` (taille JSON).
- [ ] 44. Cap jours/moments.
- [ ] 45. Gérer quota localStorage.
- [ ] 46. Gérer image object URL (revoke).
- [ ] 47. Error boundary Carnet.
- [ ] 48. Tests d’injection label/commentaire.
- [ ] 49. Audit dépendances (`npm audit`).
- [ ] 50. Revue sécurité finale + prod.

---

## Implémentation sûre de ce lot

1. Lazy-load MapLibre/CarnetMapDrawer.
2. Abort routage/géocodage au démontage et au nouveau tracé.
3. Marqueurs sans `innerHTML`.
4. Caps : 2 000 points de tracé, 60 jours, 50 moments.
5. Validation/clamp lat/lon.
6. Images lazy/async + `URL.revokeObjectURL`.
7. Tests ciblés, build, Vercel.
