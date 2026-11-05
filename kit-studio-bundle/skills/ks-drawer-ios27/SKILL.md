---
name: ks-drawer-ios27
description: Use when building or fixing the Kit Studio drawer, cards, capsules, pill or sheets — the exact measures, states and visual rules.
---
# Tiroir iOS (verre) du Kit Studio

Source des mesures : `spec/SPEC-DRAWER.md`. Référence de rendu : `reference/Kit_Studio_v2.html` (ouvrir en WebKit 402×874).

Règles à ne jamais casser :
- Hauteur unique `--dh: 30dvh` ; toutes les vues ; contenu long = défilement interne avec fondu.
- Cartes carrées `--W = (min(100vw,560px) − 24 − 24 − 16) / 3` ; **trois** visibles ; légende bas droite, 2 lignes max ; objet dans `inset: 0 6px 52px 6px`.
- Sélection = surface blanche + ombre + pastille ✓ encre. **Pas de bordure colorée** (ni `box-shadow` coloré, ni `outline` hors focus clavier).
- Capsules : icônes 18 px seules, 30 px de haut, `aria-label`, lentille animée.
- Pilule : bord bas à 2 px du tiroir ouvert ; recalcul à chaque vue et redimensionnement.
- Rien en haut de l'écran tiroir ouvert ; aucun toast, titre flottant, bouton flottant, menu vers le haut.
- Verre clair, ombres d'encre `rgba(23,43,36,…)`, jamais `rgba(0,0,0`, jamais `#E4501C`.
- Mouvement : `transform` et `opacity` seulement ; `prefers-reduced-motion` coupe les rebonds.

Pièges déjà rencontrés (ne pas les refaire) :
1. `.vcards{height:var(--W)}` hérité empêche le centrage vertical : mettre `height:auto` avec `top/bottom`.
2. Légende qui passe sous l'objet : réserver la zone objet (52 px en bas) et limiter le sac à `s ≤ 0,8`.
3. Un nom sur une ligne tronqué (« Veste… ») : autoriser 2 lignes.
4. Contenu de feuille caché sous la barre de capsules : `margin-bottom: 46px` sur le pager.
5. Titre « Contenu » ou nom du kit affiché sous le sac au changement de mode/catégorie : supprimé, ne pas le remettre.
6. Course au démarrage : l'ouverture automatique à 750 ms ne doit pas écraser une action déjà faite (`if (!S.dock)`).
7. Les mesures en grille (`repeat(4, 1fr)`) évitent le défilement horizontal des puces.
