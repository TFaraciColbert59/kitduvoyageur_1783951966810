# Audit carnet — brief commun aux auditeurs

**Date :** 2026-10-24
**Repo :** `/Users/fr168256/Desktop/lkdv-communaute-feed` (worktree git, branche `chantier/post-system`)
**Périmètre principal :** la fiche d'un carnet, route `/carnets/[id]`, du rendu serveur au dernier bouton.
**Périmètre de comparaison :** `/communaute` refondue (feed plein écran), qui devient la référence de style.
**Livrable :** un fichier markdown par axe dans `docs/audit/carnet-2026-10-24/`, puis consolidation par le contrôleur.

## Règles

1. **Lecture seule sur le code applicatif.** Ne modifier aucun fichier `src/`, `supabase/`, `tests/`, `package.json`. Le seul fichier que tu écris est ta section d'audit assignée.
2. **Preuve obligatoire.** Chaque constat cite un fichier + numéro de ligne (`src/...:123`), une requête SQL, une réponse API, ou une capture. Pas de constat « au feeling ».
3. **Vérifié vs suspecté.** Marque `[VÉRIFIÉ]` quand tu as lu le code/la donnée, `[SUSPECTÉ]` quand c'est une hypothèse à confirmer. Ne présente jamais une hypothèse comme un fait.
4. **Sévérité.** `P0` = bloque la mise en production ou casse une promesse produit ; `P1` = bug majeur, perte de données, sécurité ou accessibilité grave ; `P2` = défaut notable d'UX/perf/maintenabilité ; `P3` = polish/dette.
5. **Pas de recommandation générique.** Décris le changement concret attendu, pas « améliorer la performance ».
6. **Ne pas lancer** `next build`, `next dev`, `npm test` ni de migration. Le contrôleur fait les vérifications live. Tu peux lire les artefacts `.next-*` et les rapports existants.
7. **Ne pas exposer de secret.** Ne recopie jamais une clé, un token ou une valeur de `.env.local`.
8. **Français**, ton factuel, pas de flatterie. Le rapport doit pouvoir être lu par un développeur qui n'a pas le contexte.

## Format de section attendu

```md
# <Axe> — audit

## Périmètre et méthode
…

## Constats

### CARNET-<AXE>-001 — <titre court> — P1
- **Statut :** [VÉRIFIÉ]
- **Preuve :** `src/...:123`, requête, capture…
- **Constat :** …
- **Impact :** …
- **Correctif attendu :** …

## Matrice de couverture
| Élément | Audité | Preuve | État |
…

## Zones non couvertes / limites
…
```

Numérotation : `ARCH-`, `DATA-`, `API-`, `UX-`, `VIS-`, `PERF-`, `A11Y-`, `SEO-`, `TEST-`, `CONTENT-`.

## Contexte produit utile

- La page doit rester lisible **sans session** pour un carnet public, et **protégée** pour un carnet privé.
- Le produit revendique « zéro mock » : toute donnée affichée doit être réelle ou explicitement absente.
- Le style cible est celui de `/communaute` : colonne 430–520 px, fond global, cartes verre, pastille auteur, capsule d'actions, barre basse Compte, pas de hero marketing.
- Les contraintes du dépôt sont dans `DESIGN_SYSTEM.md`, `CLAUDE.md`, `AGENTS.md`, `docs/compas/DESIGN_REFERENCE.md`.
- Les specs Communauté récentes : `docs/superpowers/specs/2026-10-23-communaute-feed-design.md`, `docs/superpowers/specs/2026-10-24-communaute-post-system-design.md`.

## État live connu au moment du brief

- Serveur de dev : `http://127.0.0.1:4015` (worktree `lkdv-communaute-feed`).
- Carnet public de test riche : `6f39f0d3-2f4b-5006-a1f1-0e0c0d354802` (« Tour du Mont-Blanc en autonomie complète »).
- Projet Supabase : `icxyvwzfjbflcbqukpfz` (base `lekitduvoyageur2`).
- La page desktop utilise un scroll interne (`h-[100dvh] overflow-hidden`) ; la page mobile utilise le scroll document.
