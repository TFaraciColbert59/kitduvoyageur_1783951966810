# Règles du chantier Kit Studio v2 (s'ajoutent à CLAUDE.md ; en cas de conflit, CLAUDE.md prévaut)

## Périmètre
- Nouveau module `src/features/kit-studio/` + route `src/app/kit-studio/`. **Ne jamais modifier `src/features/compas/**` ni `src/app/compas/**`.** Un lien d'entrée se pose depuis le hub ou le matériel, pas depuis le Compas.
- Le Kit Studio est une page plein écran sans barre de navigation du bas : déclarer `/kit-studio` dans `HIDE_CHROME_PREFIXES` (`src/components/mobile-nav/MobileNavWrapper.tsx`).
- Aucun nouveau service payant, aucune clé, aucune police web, aucun asset binaire de plus de 100 Ko. La 3D est **procédurale** (aucun modèle importé).

## Interface (décisions de Tony, non négociables)
1. Une seule surface interactive en bas : **le tiroir**. Rien ne s'ouvre en haut de l'écran.
2. Hauteur du tiroir : **30 % de la hauteur d'écran au maximum**, partout.
3. Cartes carrées, **3 visibles au plus**, défilement de droite à gauche, objet 3D au centre, nom en petit en bas à droite (style Apple).
4. Sélecteur de catégories en capsule, en bas à droite du tiroir ; sélecteur de mode en bas à gauche.
5. La pilule du poids est en haut quand le tiroir est fermé ; à l'ouverture elle descend se poser **2 px au-dessus** du tiroir.
6. Le sac est centré au-dessus du tiroir et se replace de façon cinématique selon l'état du tiroir.
7. **Aucun titre, sous-titre, étiquette flottante ni toast** sur la scène. Aucun bouton flottant : « Commander » vit dans le tiroir.
8. **Aucune bordure colorée** (ni vert, ni orange, ni bleu). Sélection = surface plus claire + pastille ✓ en encre.
9. Verre clair uniquement, ombres à base d'encre, jamais de `rgba(0,0,0)`, palette Forest/Sage/Stone, jamais `#E4501C`.

## Exécution
- TDD pour tout moteur pur (`domain/`). Composants testés par Vitest + Testing Library, parcours par Playwright WebKit mobile (viewport iPhone 16 Pro : 402 × 874).
- Avant chaque commit : `scripts/verify-kit-studio.sh`.
- Une session = un worktree propre ; pas de `git stash` nu.
- Les sous-agents ne committent pas : le coordinateur committe après vérification.
- Les chiffres écrits dans les journaux sont réels (échecs compris).
