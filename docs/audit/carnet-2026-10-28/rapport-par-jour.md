# Fiche carnet — balayage par jour et capsule des drawers (tâches 3 et 4)

Branche `cf/carnet-latest`, worktree `lkdv-cf-carnet2`. Aucun déploiement, aucun merge.

## Ce qui change

- La carte se balaie **Résumé → J1 → … → Jn** : geste horizontal, flèches ←/→,
  `Home`/`End`, bornes strictes, 220 ms, `prefers-reduced-motion` sans translation.
- **Résumé** (page 0) : pastille « Résumé », totaux du carnet (18 km · 1 240 m ·
  8 jours), compte de moments, grille = tous les moments.
- **Jour n** : pastille de date (« 22 sept. »), distance / D+ / durée du jour
  (`— km`, `— m`, `— h` quand la donnée manque), grille des moments du jour,
  ligne de lieu et participants inchangés.
- Le carrousel Posts/Parcours/Étapes/Matériel/Nature/J’aime/Commentaires/Gérer
  garde son geste et son sélecteur : un balayage commencé dans la grille ne
  change jamais de jour.
- Le pied de carte ne porte plus que la **capsule des drawers** (88 × 30, deux
  segments, lentille 41,5 × 25) à 10 px des bords droit et bas. ♥ et 💬 ont
  quitté la carte ; leurs pages se lisent dans le carrousel.

## Mesures (430 × 932, Playwright)

| Élément | Attendu | Mesuré |
| --- | --- | --- |
| Carte | 12 / 48 / 406 × 541 (espace dispo) | 12 / 48 / 406 × 503,2 (stable d’un jour à l’autre) |
| Grille | 406, tuile 134, gap 2 | 406, tuile 134 |
| Capsule | 88 × 30, à 10/10 | 320 / 511,2 – 88 × 30 (10 px des bords) |
| Lentille | 41,5 × 25 | 41,5 × 25 |
| Segments | 2 (▦ 🗺) | 2 |
| Carte 768 × 1024 | espace disponible | 181 / 48 / 406 × 558,4 ; capsule 489 / 566,4 |
| Carte 1440 × 900 | espace disponible | 517 / 48 / 406 × 484 ; capsule 825 / 492 |
| Débordement | `scrollWidth = innerWidth` | 430/430, 768/768, 1440/1440 |
| Mouvement réduit | aucune translation | `animation: none` |

## Captures

- `apres-resume-430.png` — Résumé, 7 moments, 18 km · 1 240 m · 8 jours.
- `apres-jour1-430.png` — J1 « 22 sept. », 1 moment, `— km` / `— m` / `— h`.
- `apres-dernier-jour-430.png` — jour sans moment : état vide honnête, distance GPS réelle.
- `apres-resume-768.png`, `apres-resume-1440.png` — tablettes et bureau.
- `capsule-carte-x3.png` — capsule ×3.
- `apres-drawer-stats-430.png` — capsule du drawer, même matière.
- `apres-parcours-430.png` — sélecteur du bas sur Parcours : la lentille glisse,
  le jour affiché ne change pas.
- `apres-jour1-posts-430.png` — retour sur Posts : J1 et sa photo unique.
- `mesures-430.json` — mesures brutes.

## Décisions

1. **Cadre stable** : `.ckp-card` prend l’espace disponible (`flex: 1 1 auto`).
   Sans cela, un jour à une seule photo faisait sauter la carte et la carte 3D de
   76 px à chaque balayage. Conséquence assumée : un jour court laisse du verre
   vide sous la grille.
2. **Totaux du Résumé** : distance/D+ = total du carnet (`detail.distanceKm`,
   `detail.elevationM`) — la valeur du sous-drawer statistiques et du JSON-LD —,
   `summary` en relais ; jours et moments = `summary` (le nombre réel de pages).
   La ligne de lieu lit la même source : la carte n’affiche jamais deux totaux.
3. **Clavier au document** : écouté au document, jamais volé au carrousel
   (`.ckp-pages`), à une feuille (`.ckp-post-sheet`, `.ckp-viewer`) ni à un champ.
4. **Pas de saut de jour** : un jour sans GPS ou sans moment reste une page.
