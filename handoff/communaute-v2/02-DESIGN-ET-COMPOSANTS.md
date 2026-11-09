# 02 — Design et composants : réutiliser `/compte`, ne rien réinventer

Règle : **chercher la primitive avant de créer un composant** (DESIGN_SYSTEM.md § 6). La maquette est en HTML vanilla pour la démonstration ; en production tu utilises les composants React existants listés ici. Les annexes A, B et C donnent chaque valeur avec `fichier:ligne` ; l'annexe H décrit l'existant de la Communauté (et ses 34 écarts).

## 1. Sources de vérité, par priorité
1. Code réel de `/compte` : `src/components/compte/**`, `compte-v8.css` puis `compte-apple-hig.css` (les `!important` de la dernière couche l'emportent), `src/styles/{tokens,liquid-*,drawer-selectors-tabbar,floating-liquid-tabbar}.css`.
2. `annexes/A-design-visuel-compte.md`, `annexes/B-interactions-compte.md`, `annexes/C-contenus-compte.md`.
3. La maquette (contenus et comportements propres à la Communauté) et le document (`annexes/D-document-refonte.md`).

Valeurs clés : tiroir entrée `.72s cubic-bezier(.16,1,.3,1)`, sortie `.56s` ; capsule 56 px, lentille `.42s cubic-bezier(.32,.72,0,1)` ; mini-capsule 30 px, lentille `.28s cubic-bezier(.34,1.56,.64,1)` ; LensPager 420 ms `ease-glass`, verrou d'axe 8 px, seuil 48 px ; appui `scale(.96)` `.12s` ; cascade `.45s` ; matériaux du tiroir et des cartes de `/compte` ; libellés de champ 600 10 px majuscules ; champs 16 px, 44-48 px ; titres de tuile 600 14 px ; méta 10,5 px.

## 2. Correspondance maquette → composants réels

| Élément de la maquette | Composant à utiliser | Notes |
|---|---|---|
| Montage des tiroirs | `src/app/communaute/page.tsx` (`dynamic(ssr:false)`, préchargement à l'idle) | Si `NEXT_PUBLIC_COMMUNAUTE_V2 === 'true'` : monter `CommunityExploreSheetV2` et `CreateSheetV2` ; sinon `CommunitySectionsDrawer` et `CreateDrawer` actuels. Mêmes props, mêmes callbacks (`onRequireAuth`, `handleCreated`). |
| Coque, slots, lentilles | `SlotShell` (`src/components/compte/drawer/SlotShell.tsx`), `CapsuleTabs` (`src/components/ui/CapsuleTabs.tsx`, 56 et 30), `LensPager`, `DrawerShell` + `DrawerSkeleton/Error/Empty` (`src/components/ui/drawer/*`) | Une seule copie : la primitive `ui/drawer`. Si son comportement diffère de `/compte`, aligne la primitive et ajoute un test. Si le chantier carnet-v2 l'a déjà fait, réutilise. |
| Bouton et menu de tri | Nouveau `SortMenuButton` dans `src/components/ui/drawer/` | 30 px, même verre que la mini-capsule (`.ig-tabs`), positionné par la coque à droite de la mini-capsule (la coque réserve 46 px). Menu au matériau `glass-bg-medium`, options 44 px, animation .28 s spring. Réutilisable par `/compte` plus tard ; ne pas l'y brancher ici. |
| Détails empilés | `OverlaySheet` / `CompteOverlayHost` (pile `pushSheet` + `.sh-back`) | Club, sortie, sélecteur de produit (Kit), confirmation. |
| Tuiles carnet | `CarnetTile` revu (`src/features/community/sections/CarnetTile.tsx`) | Verre des cartes de `/compte` (§ 3 bis), tampon de visa, trace SVG en filigrane, anneau « En route » comme la fiche carnet v2. Supprime `carnet-tile.css` du chemin V2 seulement. |
| Blason de club | Nouveau `ClubCrest` (SVG, initiale + icône d'activité, teinte par jeton vert dérivée de l'id) | Utilisé par la tuile, le détail et l'aperçu du formulaire Club. |
| Billet de sortie, bande agenda | Nouveaux `EventTicket`, `AgendaStrip` | `CapacityGauge` existant pour la jauge. |
| Post (aperçu vivant Publication) | `CommunityFeedPost` (le vrai) | Alimenté par les valeurs du formulaire. |
| Stories (éditeur, aperçu) | `src/components/communaute/StoriesViewer.tsx` (mêmes barres, même dock) | L'éditeur pose ses calques au-dessus du visualiseur en mode composition ; pas de second visualiseur. |
| Carte (Recherche « Sur la carte », Tracé, RDV, zone de club) | Stack carte existante (`CompteMap` / MapLibre, routeur et `/api/elevation` déjà utilisés par `CarnetMapDrawer`) | Un seul contexte WebGL à la fois (ADR-002) : la carte de formulaire est démontée quand on quitte l'étape. Aucune nouvelle origine CSP. |
| Infos visuelles | `InfoCards` existants (`CaptionRuler`, `PollBalance`, `DifficultyLadder`, `CapacityGauge`, `SafetyManifest`, `MeetingPin`, `StoryTrim`, `JoinStepper`, `KitRing`, `KitPackingMatrix`) | Les rhabiller au verre `/compte`, ne pas les réécrire. |
| Médias | `MediaPicker` + `upload.ts` | Ajouter : réordonner au doigt (poignée, comme la maquette), suppression par bouton 44 px, recadrage (4:5, 1:1, original ; 9:16 pour story ; carré et 3:1 pour club). EXIF toujours retiré. |
| Haptique | `useHapticFeedback()` / `triggerNativeHaptic` | 4 → `selection`, 6–8 → `light`, 10–12 → `medium`, 14–15 → `rigid`, réussite → `success`. |
| Île dynamique | Celle de la V2 carnet si elle existe (`CarnetIsland` ou équivalent extrait en primitive), sinon l'extraire en `ui/DynamicIsland` | Remplace les toasts « Création publiée. », « Club rejoint. », etc. dans la V2. |
| Géolocalisation | Plugin Capacitor existant si présent, sinon `navigator.geolocation` | Message de refus explicite ; aucune position stockée sauf coordonnées de RDV ou de lieu saisies volontairement. |
| Back, safe areas, z-index | `HeaderBackButton`, tokens/AppShell, échelle `--z-*` / `src/lib/ui/zIndex.ts` | Fin du `z-index: 2147483000` de la capsule d'étapes. |

## 2 bis. Code à ne pas suivre
- `src/features/community/card/` (ExplorerDrawer, CreateDrawer, wizard) est une variante **non branchée** (annexe J § 0.1, § 3.1) : ne la prends pas pour base et ne la supprime pas dans cette PR (seulement la mentionner dans la PR de nettoyage).
- L'écriture client de `clubs.members_count` (`useCommunitySections.ts`, `ClubCreateForm.tsx`) ne doit pas être reprise : le trigger le tient.

## 3. CSS
- Un fichier `src/styles/communaute-v2.css` (ou CSS modules) portés par une classe racine `.lkdv-communaute-v2` ; uniquement des jetons.
- **Ne pas** modifier les règles existantes de `community-feed.css`, `community-post-polish.css`, `create-drawer-layout.css`, `carnet-map-drawer.css` : elles servent l'ancienne version derrière le drapeau. La V2 ne charge pas les classes `lkdv-half-drawer`, `lkdv-drawer-*`.
- Jetons de type à ajouter dans `tokens.css` : `--type-post`, `--type-carnet`, `--type-club`, `--type-sortie`, `--type-membre`, tous dans les verts (forêt, sauge, mousse, menthe, vert lichen), contraste AA sur le verre vérifié.

## 3 bis. Jetons de matériau
Les noms `--sheet-*` et `--drawer-card-*` des annexes A/B **n'existent pas** dans le dépôt : ce sont des noms de travail. Les valeurs réelles sont des `rgba()` littéraux dans les règles `.phone .sheet {…}` de `src/components/compte/compte-apple-hig.css` (vers L2930-2952). Crée les jetons correspondants dans `tokens.css` à partir de ces valeurs exactes (source en commentaire), ou réutilise les jetons existants (`--glass-bg-medium`, etc.) quand ils sont identiques. Le garde `tests/design/unification.spec.ts` (U-D60) interdit tout littéral hors `tokens.css`.

## 4. Interdits
- Aucune couleur littérale hors `tokens.css` ; aucune teinte non verte pour les types et décorations.
- Couleurs interdites : `#E4501C`, `#1C2620`, `#A3C4A3`, `#0B1F17`, `#2D6B4A`, et les anciennes teintes `#8A6A2F`, `#3D6F63`, `#A05A3C`, `#4B6B7C`.
- Aucune police hors jetons.
- Pas de nouveau composant si une primitive existe ; pas de deuxième post, visualiseur de stories ou carte.
- Animer `transform`/`opacity` uniquement ; `prefers-reduced-motion` partout.
- Pas de `window.location.assign` pour naviguer (`router.push`).
- Skills obligatoires pour toute décision UI mobile : `apple-ui-designer` et `interaction-design` (AGENTS.md).
