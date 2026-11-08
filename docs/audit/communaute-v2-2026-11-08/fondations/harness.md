# Fondations UI — Communauté v2 : harnais de capture 390×844

Preuves de recette des fondations livrées par le coéquipier **ui-foundation** :

- `SortMenuButton` et `DynamicIsland` (`src/components/ui/drawer/`) ;
- `ClubCrest`, `EventTicket`, `AgendaStrip` (`src/features/community/v2/shared/`) ;
- jetons `--type-*` / `--cv2-*` (`src/styles/tokens.css`, ajouts en fin de fichier) ;
- feuille de contenu `src/styles/communaute-v2.css` (classes `lkdv-cv2-*`).

La coque (`lkdv-cv2-layer/wrap/sheet/grab/topnav/capsule/body/pane/mini-slot/mini/footer/detail*`)
est écrite par le Lead dans `src/styles/communaute-v2-shell.css` : le harnais la charge
telle quelle, avec les mêmes feuilles globales que `src/app/layout.tsx`.

## Captures

| Fichier | Ce qu'il prouve |
|---|---|
| `fondations-390x844.png` | tiroir monté : capsule 56, mini-capsule 30 + bouton de tri, tuile carnet (verre, visa, trace), ligne club + blason, bande agenda, billet daté, recherche 48, formulaire (libellés visibles, champ 16 px, textarea, select, chips, segmented, stepper, jauge, compteur, erreur inline, compteur d'erreurs, brouillon, médias, recadrage), états (skeleton, vide, erreur, hors ligne), pilules/badges/avatars/type. |
| `sort-menu-390x844.png` | menu de tri ouvert au-dessus du bouton : `role=menu`, options 44 px, coche sur le tri actif, verre `--glass-bg-medium`. |
| `dynamic-island-390x844.png` | île active au-dessus du tiroir (z 70, top 5, 366 px, radius 21), action « Voir » + « Annuler ». |
| `peek-390x844.png` | Peek & Pop : scrim + boîte opaque + menu d'actions 44 px. |
| `composants-390x844.png` | composants isolés : `ClubCrest` 28/44/72 (5 teintes vertes), `EventTicket` ouvert / complet / liste d'attente / passé / aperçu, `AgendaStrip` 14 jours (aujourd'hui, week-end, actif, points). |

## Régénérer

```bash
# 1. Harnais + CSS auto-injecté des primitives (aucune copie manuelle)
node docs/audit/communaute-v2-2026-11-08/fondations/build-harness.mjs

# 2. Captures (Playwright déjà installé dans le dépôt)
cd docs/audit/communaute-v2-2026-11-08/fondations
for state in "" "?state=menu" "?state=island" "?state=peek" "?state=components"; do
  npx playwright screenshot --viewport-size="390,844" --wait-for-timeout=350 \
    "file://$(pwd)/harness.html$state" "capture$(echo "$state" | tr -d '?=state').png"
done
```

`build-harness.mjs` lit les **sources réelles** (`tokens.css`, `communaute-v2.css`,
`communaute-v2-shell.css`, et les constantes `SORT_MENU_CSS` / `DYNAMIC_ISLAND_CSS`
des deux primitives) : toute modification de style se voit à la régénération.

Le harnais est une page statique (pas dans `src/app`, aucun impact bundle) ; il ne
teste pas l'interaction React — c'est le rôle de
`src/components/ui/drawer/__tests__/SheetIntegration.test.tsx`
(SortMenuButton dans `.lkdv-cv2-mini-slot`, Échap qui ne ferme pas le tiroir, Tab,
sélection, île hors de la couche).

## Classes de contenu disponibles

Le commentaire d'en-tête de `src/styles/communaute-v2.css` liste toutes les classes
`lkdv-cv2-*` (tuiles, listes, typographie, signatures, formulaires, états, pilules,
badges, avatars, recherche, rails, grille). Les deux coéquipiers (Explorer, Création)
peuvent les consommer directement ; leurs styles spécifiques vont dans
`explore/explore-v2.css` / `create/create-v2.css` avec les préfixes `lkdv-cv2x-` /
`lkdv-cv2c-`.

Keyframes à ne pas dupliquer (déjà prises) :
`lkdv-sort-in`, `lkdv-island-in` (primitives) ; `lkdv-cv2-shimmer`, `lkdv-cv2-fade`,
`lkdv-cv2-peek-in` (fondations) ; `cv2DetailIn`, `cv2RowIn` (coque, Lead).
