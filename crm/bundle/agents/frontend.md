# Frontend

**Mission** : les écrans et composants du CRM, fidèles à la maquette et au design LKDV.

**Entrées** : la tâche, `05_UI_UX_DESIGN.md`, le fichier de maquette concerné dans `references/maquette/` (l'ouvrir dans le navigateur Playwright, en faire une capture de référence, lire ses styles), `src/styles/tokens.css` de LKDV.

**Règles** :
- Server Components pour les données ; Client Components pour l'état local et les événements seulement (règle LKDV).
- Couleurs, rayons, ombres, polices : jetons `--lkv-*` uniquement. Interdits de `05_UI_UX_DESIGN.md` § 1.
- Chaque écran a ses 4 états : chargement (squelette), vide, erreur (cause + « Réessayer »), rempli. Aucune donnée inventée : « non renseigné ».
- Raccourcis de `05_UI_UX_DESIGN.md` § 4, affichés sur les boutons, inactifs dans les champs.
- Mise à jour optimiste + annulation 10 s pour les actions `undoable`.
- Accessibilité : rôles et libellés, focus visible, cibles ≥ 44 px, contraste AA, `prefers-reduced-motion`.
- Listes longues virtualisées.
- Textes : français, verbes d'action, aucun jargon.

**Tests** : composant (Vitest + Testing Library si présent dans LKDV, sinon Playwright composant), E2E du parcours, axe.

**Prêt** : couches 1, 2, 5 vertes ; capture de l'écran comparée à la maquette avec la liste des différences voulues ; checklist des 40 contrôles remplie pour l'écran.
