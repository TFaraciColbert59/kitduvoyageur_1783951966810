# Spécification du tiroir (mesures à reproduire)

Unité : px CSS. Appareil de test principal : **iPhone 16 Pro, 402 × 874**. Contrôles secondaires : 390 × 844, 430 × 932, 375 × 667 (petit écran).

## Géométrie
- Largeur : `min(100vw, 560px) − 24px` (gouttière `--gx: 12px`), centré.
- Hauteur : `--dh: 30dvh` (repli `30vh`). **Une seule valeur pour toutes les vues.** À 874 px : 262 px.
- Marge basse : `--gb: max(12px, env(safe-area-inset-bottom))`.
- Rayon 24 px. Verre : fond `linear-gradient(180deg, rgba(255,255,255,.486), rgba(255,255,255,.384))`, `backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05)`, ombre d'encre `rgba(23,43,36,…)`, reflet interne `::after` en `soft-light`.
- Poignée : zone tactile 18 px de haut, barre 44 × 5 px (`rgba(23,43,36,.28)`), s'élargit à 56 px à l'appui.
- Fermé : `transform: translate(-50%, calc(100% + var(--gb) + 28px))`, `visibility: hidden` après la transition ; le « grabber » flottant (140 × 30) prend le relais.
- Transitions : transformation 550 ms `cubic-bezier(.32,.72,0,1)` (`--sheet-ease`), hauteur 500 ms.

## Zones internes
| Zone | Règle |
|---|---|
| Haut | 18 px de poignée |
| Contenu des cartes | `top: 18px; bottom: 48px`, colonne centrée verticalement, intervalle 12 px |
| Contenu des feuilles | pager `flex: 1`, `margin-bottom: 46px`, masque dégradé 16 px en bas, pages `overflow-y: auto`, `padding: 2px 16px 14px`, scroll vertical confiné (`overscroll-behavior: contain`) |
| Barre basse (`dstrip`) | `left/right: 10px; bottom: 10px; height: 30px`, capsules de 30 px (boutons 25 px, **icônes 18 px seules**, `role="tablist"`/`radiogroup`, `aria-label`, `aria-selected`/`aria-checked`), lentille animée 420 ms |

## Cartes
- Côté `--W = (min(100vw, 560px) − 2·12 − 24 − 2·8) / 3` : 112,7 px à 402 px de large, 122 à 430. **Trois cartes visibles au plus**, jamais un quart de carte visible. Rail : `scroll-snap-type: x mandatory`, `scroll-snap-align: start`, `touch-action: pan-x`, intervalle 8 px.
- Carte : rayon 20 px, dégradé clair, ombre d'encre. Zone objet : `inset: 0 6px 52px 6px` ; image `object-fit: contain`, `drop-shadow`. Légende : bas droite, `bottom: 9px`, nom 11,5 px / 600 sur **2 lignes max**, sous-titre 10,5 px.
- Sélectionnée : fond blanc, ombre plus marquée, pastille ✓ 16 px en encre en haut à gauche. **Aucune bordure colorée.**
- Indisponible : opacité .45, `aria-disabled`.

## Pilule
- Position fermée : en haut, sous la zone de la Dynamic Island (`env(safe-area-inset-top)` + 10).
- Position ouverte : `translateY(innerHeight − gb − dh − 2 − hauteurPilule − paddingHaut)` pour que son bord bas soit à **2 px** du tiroir. Recalculer au redimensionnement et à chaque changement de vue.
- Hauteur 44 px, bague 20 px, kg en chiffres tabulaires, pastille d'alertes.

## Caméra (synchronisée au tiroir)
`S.dk` suit `S.dkT` (0 fermé, 1,7 ouvert) avec amortissement exponentiel (taux 3,6 ; 60 en mouvement réduit). Décalage de vue `yoff = lerp(−0,095 ; 0,035 ; dk) × hauteur`, zoom `1 + (1 − dk) × 0,05`. Valeurs de départ à ajuster **sur capture** pour que le centre du sac tombe au milieu de l'espace libre entre la pilule et le haut de l'écran.

## Accessibilité
`role="dialog"` non modal avec `aria-label` de la vue, focus déplacé sur le tiroir à l'ouverture et rendu à l'élément déclencheur à la fermeture, ordre de tabulation : poignée → contenu → barre basse, cibles ≥ 44 px (zone tactile étendue par `::after`), contrastes AA, `prefers-reduced-motion`, `prefers-reduced-transparency` (fond opaque `#FAF9F5`), `prefers-contrast: more`.

## Critères de recette visuelle (à tester par captures)
1. Hauteur du tiroir ≤ 30 % de l'écran dans **toutes** les vues, à 4 tailles.
2. 3 cartes exactement visibles, aucune superposition légende/objet.
3. Pilule à 2 px (± 1) du tiroir ouvert.
4. Aucun élément dans le tiers haut de l'écran tiroir ouvert, hormis la pilule si le tiroir est fermé.
5. Aucune bordure colorée (test automatisé : balayage des `box-shadow` et `border` calculés, tolérance zéro vert/orange/bleu/rouge).
6. Aucun défilement de la page ; seul l'intérieur du rail ou d'une feuille défile.
