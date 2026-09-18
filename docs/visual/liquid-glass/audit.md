# Inventaire Liquid Glass LKDV

## Méthode

`node scripts/visual/liquid-glass-inventory.mjs before` produit la référence immuable ; employer `after` pour la comparaison. Le JSON fournit toutes les routes, états, feuilles CSS et correspondances avec chemin, ligne, colonne et contexte. `canonical` indique une primitive/adaptateur partagé, `legacy` une recette concurrente, `exception-review` une surface à examiner et non une exception approuvée. Catégories chevauchantes ; commentaires et composants non publiés peuvent apparaître. Le scan ne prouve pas le comportement navigateur.

## Audit initial

75 pages et 29 loading/error/not-found. Recherches exploratoires : 119 ouvertures GlassCard dans 84 fichiers, 1 ProductGlassCard, 27 GlassModal, 10 GlassDrawer, 5 GlassSheet. Deux LiquidGlassCard concurrents sans utilisation JSX détectée. Les 620 mentions de classe glass et 456 de glass-sub-card imposent de conserver un adaptateur CSS sémantique.

| Source | Constat initial | Migration |
| --- | --- | --- |
| `src/components/ui/GlassCard.tsx` | Blur et bordures locaux, wrapper flex et animation Framer | Tokens et variantes canoniques, préserver layout |
| `src/styles/liquid-glass.css` | `.glass`, exception `.hub-rail .glass`, `glass-pure`, tons 4 % blanc, sous-surfaces floutées | Une recette partagée et variantes sémantiques |
| `src/styles/tokens.css` | Rayons centralisés, tokens glass encore ailleurs | Source unique des valeurs optiques |
| `src/components/ui/liquid-glass.tsx` | Moteur alternatif, blur inline constant 20 px | Vérifier imports/exports avant suppression |
| `src/components/ui-layouts/liquid-glass.tsx` | Moteur SVG trois couches | Aucun JSX détecté ; vérifier références filtres |
| `src/app/hub/layout.tsx` | Rend encore LiquidGlassDefs | Supprimer après preuve d'absence de références |
| `src/styles/tailwind.css` | premium-card / interactive-card concurrents | Adapter usages avant retrait |
| `src/app/components/home/HomepagePressTestimonialsSection.tsx` | premium-card active | Adapter glass sans modifier structure |
| `src/app/pays/styles/country.css` | Cards nommées, blurs 6–28 px, fonds blancs textes | Migrer matériaux, conserver layouts/media queries |
| `src/components/ui/GlassModal.tsx` et `GlassSheet.tsx` | Blur 32 px et header flouté imbriqué | glass overlay et sous-surfaces sans blur |
| `src/components/ui/GlassDrawer.tsx` | Matériau glass, animation sans reduced-motion | Variante overlay et mouvement réduit |
| `src/components/ui/PremiumBottomSheet.tsx` | Deux matériaux default/liquid inline | Une recette, snap et drag inchangés |
| `src/components/ui/LkvButton.tsx` | Dimensions 32/42 px et transformations JS | Minimum 44 px et interactions CSS |
| `src/components/ui/LkvChip.tsx` | span role button, blur systématique | Button natif si action, span sans blur sinon |

## Migration CSS nommée

Conserver `.glass` sur les liens, articles, sections et panneaux existants, avec les tokens de GlassCard et `data-glass-variant`. Remplacer les recettes optiques seulement : les layouts, rayons de panneau, safe areas, rôles, focus traps et gestes restent conservés. Retirer les blurs imbriqués des sous-surfaces. Migrer country par groupes : information (`high-card`, `prat-card`, `safe-card`), météo (`weather-card`), résultat (`act-card`, `gast-card`) et image (`dest-card`, `m-dest-card`). Les scrims photo sont distincts. Remplacer les exceptions hub par variantes explicites et valider contraste sur photo.

## Lots et routes

- Hub/voyage : `features/hub`, `features/trips`, widgets photo et tiroirs mobiles.
- Communauté/profils : `CommunityPostCard`, `MobileCompteV2` (18 blurs initiaux), `PublicMobileProfileView` (13).
- Explorer/randonnée : `ExplorerClient`, `ExplorerListCard`, `TrailDetailPanel`, carousel, panneaux desktop et sheets ; arrière-plan map.
- Préparation/matériel : `DesktopPreparationView` (16 blurs), tabs Team/Shakedown, participants, alerts, inventaire, kits et départ.
- Carnets/clubs/groupes : cards listes et détail, formulaires, modales et états vides.
- Commerce : produit, boutique, kits, occasion, achat flottant et sélection.
- Pays/éditorial : country.css, guides, blog et homepage.
- Messagerie : previews et sheets ; bulles sémantiques distinctes des cards.
- Tous les autres chemins et les 29 états sont listés individuellement dans le JSON.

## Exceptions et risques à examiner

`features/hub/components/menu/GearSection.tsx:173` documente des articles glass pour éviter le rognage du wrapper GlassCard : préserver leur structure. Les dark surfaces randonnée portent du texte clair : ne pas changer leur fond isolément. Scrims, map/canvas, bulles de messagerie et navigation ne sont pas des cards ordinaires. AppShell reste un conteneur de fond/safe area. Contrôles produit initiaux de 36 px dans `ProductDetailClient.tsx:561,569` à vérifier. `.ultra-save-mode` est défini sans activateur TS/TSX détecté. Le fallback backdrop initial précédait .glass de même spécificité, donc pouvait être écrasé.

## Limites de validation

Le scan ne prouve pas WCAG AA, lecteur d'écran, GPU/batterie, publication des états ni Safari iOS/Chrome Android réel. Les captures avant/après et mesures runtime doivent compléter l'inventaire. Aucune exception n'est approuvée par le seul classement du scanner.
