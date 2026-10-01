# Compas — référence design

**Statut (décision de Tony, 2026-10-01) :** le Compas (`/compas`) est la référence visuelle et d'interaction de l'application pour tout nouvel écran. Source : `src/features/compas/compas.css` et `src/features/compas/components/`.

Les jetons de couleur restent ceux de `src/styles/tokens.css` (`--lkv-*`). Le Compas n'en crée pas de nouveaux : il les consomme.

## 1. Matériau (Liquid Glass v8)
- Verre très translucide, bords lumineux (`.cp-glass`, `.cp-sheet-glass`) ; ombres teintées ink, jamais `rgba(0,0,0)` en clair.
- **Aucune couleur primaire pleine** sur les boutons et pastilles : verre teinté doux (`.cp-btn--pg` principal, `.cp-btn--soft` secondaire, `.cp-btn--bad` danger).
- Fond propre à l'écran : paysage LKDV éclairci (`.cp-bg`).
- Mode plein soleil (`data-outdoor="1"`) : verre plus opaque, textes plus contrastés. Thème sombre pris en charge.

## 2. Structure d'écran
- 60 % haut = étape courante, 40 % bas = carte vivante agrandissable (la carte ne zoome pas, le haut se réduit à une carte-titre).
- Étapes = même capsule que la barre d'onglets (`.cp-steps`) : icône + libellé.
- **Tiroirs à trois hauteurs** (`.cp-sheet[data-detent]`) : petit (≈ moitié de la zone haute), moyen (s'arrête AU-DESSUS de la carte), grand. La poignée se tire ou se touche ; Échap ferme ; le focus entre dans le tiroir.
- Onglets de tiroir (`.cp-seg`) : défilent au-delà de 4 ; chaque onglet garde la largeur de son contenu.

## 3. Listes et lignes
- `.cp-row` : hauteur fixe (48 px), paginée par `PagedList`.
- `.cp-row--tall` (+ `.cp-row__t--wrap`) : texte long, hauteur libre, le tiroir défile (`TallList`).
- Champs de saisie dans une ligne : `.cp-row__t input` ; formulaires : `.cp-field`.
- Pastilles `.cp-chip`, `.cp-tchip` ; barres `.cp-bar` ; notes `.cp-note`, mentions `.cp-disc`.

## 4. Règles de contenu (partie de la référence)
- Aucune valeur inventée : une donnée absente est dite absente (« non renseigné », « à peser », « non évalué »). Jamais un zéro ou une estimation déguisée.
- Chaque chiffre de décision cite sa source et sa date. Pas de score magique.
- L'IA explique et traduit ; le moteur décide.
- Aucun paiement, commande ou lien de paiement sans geste explicite de l'utilisateur ; mode test d'un fournisseur toujours signalé.
- Liens affiliés : `AffiliateDisclosure` + `rel="sponsored nofollow"`.
- Interdits : `#E4501C`, tout jeton CSS contenant `role`, hex hors palette. Icônes : uniquement les noms présents dans `public/icons/sf/*.svg` (`node scripts/verify/icon-names.mjs`).

## 5. Accessibilité (état mesuré)
Audit axe-core (WCAG 2 A/AA, Chromium 390×844, données de test) sur l'écran et six tiroirs : 0 violation après correction d'une. Limite : fond de page de test, contrastes de couleur à confirmer sur le vrai fond.

## 6. Dette connue avant que la référence soit réutilisable partout
1. Les variables `--cp-*` sont limitées à `.compas`, et environ 90 valeurs `rgb(…)` y sont écrites en littéral. À promouvoir dans `tokens.css` pour les partager.
2. Les classes `cp-*` ne s'appliquent que dans `.compas` : à extraire en primitives (`src/components/ui/`) pour d'autres écrans.
3. Les primitives canoniques (`LkvButton`, `GlassCard`, `LkvChip`, `IOSSegmentedControl`) n'ont pas encore ce matériau : à aligner.
4. Les tests de gouvernance du design (`tests/design/`) ne couvrent pas `compas.css`.
5. Aucune comparaison pixel à pixel avec la maquette v8 n'a été faite (maquette absente du dépôt).
6. Gestes restants de la maquette : lentille au doigt, barre d'onglets qui se réduit, appui long avec aperçu de l'effet, îlot dynamique « Annuler ».

## 7. En attendant la promotion en primitives
Pour un nouvel écran : reprendre les motifs ci-dessus, consommer les jetons `--lkv-*`, ne définir aucune couleur littérale hors d'un fichier de jetons, et vérifier avec `ci_invariants`, `icon-names` et un audit axe.
