# PHASE 2 — Rapport d'avancement (refonte iOS 27 / Liquid Glass)

> Baseline officielle : `PHASE1_AUDIT.md`, `PHASE2_READINESS.md`, `baseline-metrics.json`,
> `baseline-screenshots/`. Référence Apple vérifiée : `IOS27_REFERENCE.md` (niveaux A/B/C).
> Règle : aucune API native sans vérification SDK macOS.

## Lot 1 — Socle visuel v2 (TERMINÉ)

### Ce qui a été implémenté

| Domaine | Changement | Fichiers |
|---|---|---|
| Typographie | Échelle Dynamic Type iOS : body 17, subheadline 15, footnote 13, caption 12/11, large title 34 ; SF Pro d'abord (`--font-display` système), Manrope → `--font-brand` ; tracking/graisses/interlignes iOS | `tokens.css`, `tailwind.css`, `layout.tsx`, `tailwind.config.js` |
| Couleurs/surfaces | Palette marque conservée (contrastes AA validés) ; verre plus clair (`--card-tint` 0.64, `--btn-tint` 0.78), liserés adoucis (`--glass-border` 0.12) | `tokens.css` |
| Radius | Cartes 26, feuilles 34 (haut), contrôles 14, rayon **concentrique** (`calc(card − space-4)`), xs 8 | `tokens.css`, `tailwind.config.js`, `GlassCard.tsx` |
| Matériaux | Flous plus profonds (carte 14, bouton 10, barres 28), tokens de barre (`--material-bar-*`), fond de feuille, edge effect | `tokens.css`, `tailwind.css` |
| Background LKDV | Brume CSS en couches (halos sauge/forêt + dégradé vertical), plus de photo ; dark mode dédié | `tokens.css`, `tailwind.css`, `layout.tsx` (themeColor) |
| Motion | Tokens iOS : appui 110 ms, contrôle 220 ms, feuille 380 ms, page 260 ms ; courbes standard/décélération/accélération ; `--motion-press-scale` | `tokens.css`, `design/tokens.ts` |
| Miroir TS | `typography.dynamicType`, `radius.sheet/control/concentric`, `motion.*` v2, `materials` | `design/tokens.ts` |
| Contrats de tests | Direction P5 → Phase 2 (valeurs verrouillées mises à jour, intention conservée) | `tests/design/p5-direction-tokens.spec.ts`, `tokens-sync.spec.ts` |

### Références Apple appliquées (vérifiées, cf. `IOS27_REFERENCE.md`)

- **Deux couches** (WWDC26/251) : marque dans le contenu, contrôles en verre.
- **Concentricité** (WWDC25/356) : capsules pour les contrôles, rayon concentrique pour les cartes.
- **Typographie bolder, Dynamic Type** (WWDC25/356, WWDC26/251) : SF Pro, échelle iOS.
- **Matériaux + edge effects « soft »** (WWDC25/284, 356, 323) : barres flottantes, flou de bord.
- Aucune API native utilisée : tout est CSS/React (niveau A documentaire, niveau C natif).

### Vérifications

| Contrôle | Résultat |
|---|---|
| `npm run type-check` | ✅ 0 erreur |
| `npm run lint` | ✅ 0 erreur |
| `npm test` | ✅ 406 fichiers / 2 936 tests |
| `npm run build` | ✅ compilé en 16,6 s |
| `tests/design` (contrats) | ✅ 17 fichiers / 151 tests |
| Captures après lot | `docs/design-system/phase2-screenshots/lot1/` (60 fichiers, 2,63 Mo) |

Comparaison visuelle avec `baseline-screenshots/` (home, matériel, compte) : **contenu identique,
aucune action perdue, bottom nav et bandeaux intacts, aucune régression responsive** sur les
4 gabarits. Le nouveau background est visible sur les pages sans hero plein écran.

### Métriques (après lot 1)

Les métriques page-level sont **inchangées** (hex 5 203, `rounded-[…]` 342, `text-[…]` 8 030,
inline styles 1 529, modales 23/2/5/2/10, pages desktop/mobile 54) : le lot 1 agit dans la
couche tokens, pas encore dans les pages. Premières réductions attendues aux lots 2 (shell,
navigation) et 3+ (familles de pages). Commande : `node scripts/design/baseline-metrics.mjs`.

## Lot 2 — Shell, safe areas, header et navigation (TERMINÉ)

### Architecture finale AppShell

```text
AppShell (unique shell de page)
 ├─ Background            → CompteBackground (canvas global .lkv-app-background)
 ├─ Header layer          → slot `header` (PageHeader sticky/material)
 ├─ Main scroll layer     → contenu, padding = --page-top-inset / --bottom-nav-height
 ├─ BottomExtra layer     → au-dessus de la barre (filtres, plateau)
 └─ NavigationBar (global, rendu par MobileNavWrapper)
     └─ contrat NavigationBar → BottomTabBar (Web) · UITabBar (natif, désactivé)
```

### Stratégie safe-area finale (source unique)

| Besoin | Token | Consommé par |
|---|---|---|
| Encoches / Dynamic Island | `--safe-top/right/bottom/left` = `env(safe-area-inset-*)` | `tokens.css` uniquement |
| Hauteur barre / plateau | `--nav-height: 52px`, `--nav-plateau-height: 48px` | `BottomTabBar` |
| Offsets navigation | `--nav-offset`, `--nav-offset-extended` | `AppShell` (`--bottom-nav-height`), cartes/FAB |
| Insets de page | `--page-top-inset`, `--page-bottom-inset*`, `--page-bottom-inset-bare` | `AppShell`, `OfflineBanner` |
| Overlays | `--overlay-inset-top/bottom` | modales/sheets (lot 3) |
| Clavier | `--keyboard-inset: 0px` (Capacitor `resize: body` gère le natif) | contrats, pas de double compensation |

### Contrats

- **PageHeader** : `[Back] — Titre — [Trailing]` invariable ; variantes `inline` (17 semi-bold) / `large` (34 bold) ; `sticky`, `transparent` + `scrollAware` (état matériau au scroll) ; retour via `HeaderBackButton` (44×44, chevron, historique puis `backHref`).
- **NavigationBar** : point de bascule unique (`NATIVE_TABBAR_ENABLED = false`) ; onglets et prédicat de plateau centralisés dans `destinationRegistry` (`DESTINATIONS`, `getActiveDestinationId`, `hasExtendedNav`).
- **Scroll** : `.lkv-shell` = seul conteneur (`100svh`/`100dvh`, overscroll contenu) ; plus de `100vh` brut ni de padding bas manuel.
- **Règles de mémoire musculaire** documentées dans `DESIGN_SYSTEM.md` §5.

### Anciens systèmes supprimés

- Variables `--bottom-tab-base-height` / `--bottom-tab-extended-height` et leurs replis 80/112/68 px (0 occurrence restante).
- Listes de routes du plateau dupliquées (AppShell) → `hasExtendedNav`.
- `env(safe-area-inset-*)` dans AppShell, BottomTabBar, OfflineBanner, MobileDrawer, MobileProfilePage, SosFloatingButton → tokens (13 → 0 ; seuls des commentaires documentaires subsistent dans AppShell).
- Double compensation safe-area du bouton SOS (`--bottom-nav-height` + `env()` → tokens).
- Ancien matériau inline de la barre (gradient + ombres codées) → `.lkv-material-bar` par tokens.

### Métriques avant / après

| Mesure | Avant lot 2 | Après lot 2 |
|---|---|---|
| Variables `--bottom-tab-*` | 8 | **0** |
| `env(safe-area-inset-*)` shell/nav/bannière/FAB | 13 | **0** |
| Hauteurs de barre codées en dur (52/80/68/112) | 4 | **0** (`--nav-height` / `--nav-offset*`) |
| Listes de routes du plateau dupliquées | 2 | **1** (`hasExtendedNav`) |
| Bottom bars | 3 fichiers | 1 contrat actif (`NavigationBar`) ; 2 legacy (desktop/mobile) |
| Headers custom (pages `src/app`) | 13 | 13 (migration lot 4) |
| `z-[...]` | 86 | 86 (migration lot 4) |

### Captures et tests

- Captures : `docs/design-system/phase2-screenshots/lot2/` (60 fichiers) — plateau + barre empilés sans contenu masqué, matériau allégé, safe areas correctes sur les 4 gabarits.
- `type-check` ✅ · `lint` ✅ · `vitest` ✅ 406 fichiers / 2 946 tests · `tests/design` ✅ 18 fichiers / 161 tests (dont nouveau `lot2-shell.spec.ts`) · `build` ✅.
- Contrats historiques recablés : `x7-bottom-nav-conflict` (conservé), `y7-app-first` (invariant safe-area renforcé : tokens → shell).

### Dette restante (lot 2)

1. `z-[...]` et headers custom des pages non migrées (lot 4).
2. `PageHeader` non encore adopté par les pages (13 headers maison) — migration par familles.
3. Bottom bar : composant encore volumineux (975 lignes, logique de plateaux par feature) — découpage prévu au lot 3/4.
4. Écouteur clavier : contrat posé, aucune implémentation JS (pas de double compensation) ; à valider sur appareil.
5. `AppShellDesktop` non unifié avec le nouveau shell (desktop hors périmètre mobile).

## Lot 3 — Primitives et composants canoniques (TERMINÉ)

### Primitives finales et variantes autorisées

| Primitive | Variantes | États / options |
|---|---|---|
| `Button` | `primary`, `secondary`, `ghost`, `destructive` | tailles sm/md/lg, loading, icône leading/trailing, icon-only (aria-label typé obligatoire), fullWidth, pressed/focus/disabled |
| `IconButton` | `ghost`, `glass`, `solid` | tailles sm/md/lg, `aria-label` obligatoire, 44×44 par défaut |
| `Card` | `standard`, `interactive`, `featured`, `compact` | surfaces calmes (pas de verre par défaut), `selected`, actionnable clavier |
| `ListItem` | — | leading, title, subtitle, metadata, trailing, chevron, selected, disabled |
| `ConfirmDialog` | `default`, `destructive` | Radix Dialog (focus trap, Escape/overlay), loading |
| `LoadingState` | — | label, compact |
| `SearchField` | — | icône, clear, focus, `--lkv-field-*` |
| `Tabs` | `segmented`, `scrollable` | icône, compteur, aria tablist |

Toutes les valeurs viennent des tokens (contrôles, radius, typographie, couleurs, motion, opacité) ; `prefers-reduced-motion` respecté ; focus visible ; cibles ≥ 44 px.

### Composants supprimés (0 consommateur restant)

- `ScrollableTabs.tsx` (remplacé par `Tabs variant="scrollable"`).
- `IOSSegmentedControl.tsx` (2 usages migrés vers `Tabs variant="segmented"`).
- Ancien `Tabs` dispatcher remplacé par l'implémentation canonique.

### Usages migrés (preuve de viabilité)

| Zone | Migration |
|---|---|
| `window.confirm` | **`lkvConfirm` réécrit en promesse** + hôte global `ConfirmHost` (Radix) monté dans le layout → **17 flux destructifs** (13 fichiers : groupes, compte, messagerie, matériel, pays, hors-ligne…) passent au dialogue accessible **sans toucher aux appelants** (ajout d'`await`) |
| Home (`src/app/page.tsx`) | 2 CTA migrés vers `Button` (liens conservés) |
| Matériel (`src/app/materiel/page.tsx`) | `StatChip` ×5 → `Card variant="compact"` ; lignes « À préparer » → `ListItem` (routes conservées) |
| Messagerie (`src/app/messagerie/page.tsx`) | spinner maison → `LoadingState` |
| Recherche (`SearchOverlay`) | input maison → `SearchField` ; fermeture → `IconButton` (nouvelle affordance accessible) |
| Hub budget + Prêts matériel | `IOSSegmentedControl` → `Tabs` |

### Exceptions documentées

- `lkvPrompt` conserve `window.prompt` (saisie de texte sans hôte canonique) — dette lot 4.
- `LkvButton` (17 importeurs), `GlassCard` (89), `GlassIconButton`, `Badge`/`LkvChip`, `Sheet`, `PremiumBottomSheet` : encore utilisés → migration lot 4, aucune suppression prématurée.
- 17 overlays `role="dialog"` maison : migration lot 4.

### Métriques avant / après

| Mesure | Avant Phase 2 | Après lot 3 |
|---|---|---|
| Hex codés en dur | 5 203 | **5 192** |
| `rounded-[...]` littéraux (hors `var()`) | non mesuré (342 au total) | **218** (131 tokenisés dont primitives) |
| `z-[...]` littéraux (hors `var()`) | non mesuré (86 au total) | **80** |
| Styles inline | 1 529 | **1 525** |
| `window.confirm` | 2 | **1** (`lkvPrompt` seul) |
| Primitives `src/components/ui` | 49 | **56** |
| Fichiers `*Tabs.tsx` | 7 | **6** |
| Fichiers `*Button.tsx` | 6 | 9 (ajout `Button` + `IconButton` canoniques) |
| Headers custom / `role="dialog"` | 13 / 17 | 13 / 17 (lot 4) |

### Captures et tests

- Captures : `docs/design-system/phase2-screenshots/lot3/` (60 fichiers) — Matériel vérifié après migration Card/ListItem : contenu et actions intacts, aucune régression responsive.
- `type-check` ✅ · `lint` ✅ · `vitest` ✅ 407 fichiers / **2 946 tests** · `tests/design`+`design-system` ✅ 18 fichiers / 161 tests · `build` ✅ 19,9 s.

### Dette restante (lot 4)

1. Migrer `LkvButton` → `Button`, `GlassCard` → `Card` (89 importeurs), `Badge`/`LkvChip`, `GlassIconButton` → `IconButton`.
2. Unifier `Modal`/`Sheet`/`ConfirmDialog` : 5 primitives modales encore présentes, 17 overlays maison.
3. Purger les 218 `rounded-[…]` littéraux et 80 `z-[…]` littéraux restants par feature.
4. Migrer les 13 headers custom vers `PageHeader`.
5. `lkvPrompt` : hôte canonique de saisie à créer.
6. Découper `BottomTabBar` (975 lignes) et migrer les formulaires (`LkvInput` & co) par famille.

## Lot 4 — Migration massive des UI legacy (TERMINÉ pour le périmètre composants)

### Migrations réalisées

| Legacy | Avant | Après | Traitement |
|---|---|---|---|
| `LkvButton` | 15 importeurs | **0** | → `Button` / `IconButton` (mapping variantes/taille/icône), **fichier supprimé** |
| `GlassIconButton` | 13 importeurs | **0** | → `IconButton` (aria-label, badge en children), **fichier supprimé** |
| `GlassCard` | 90 importeurs | **0** | → `Card` (variants standard/interactive/featured/compact, `tone` absorbé), **fichier supprimé** |
| `PremiumGlassCard(.client)` | 0 consommateur | **0** | **supprimés** (dépendaient de GlassCard) |
| `lkvPrompt` | 3 usages | **0** | `PromptDialog` + `PromptHost` créés (pattern Radix identique à ConfirmDialog), `lkvPromptAsync` prometteuse, hôte monté dans le layout, admin migré, `window.prompt` **supprimé** |

- **120 fichiers touchés** (113 modifiés, 5 supprimés, 2 créés) : **+715 / −1180 lignes**.
- Migrations par lots de ~15 fichiers avec `type-check` intermédiaire.

### Exceptions documentées

1. `src/components/ui/ReportBlockModal.tsx:106` — `confirm()` natif conservé (hors périmètre des étapes ; à migrer en Lot 5).
2. `src/components/dev/glass/GlassLab.tsx` / `GlassLabSurface.tsx` — fixtures de démo adaptées aux variants canoniques (`disabled` → `aria-disabled`, `selected`/`critical` → `selected`/`tone="danger"`).
3. Tests recablés sur le contrat canonique : `tests/ui/glass-card.spec.tsx`, `tests/design-system/glass-controls.spec.ts`, `tests/design-system/primitives.spec.ts`.

### Métriques avant / après

| Mesure | Avant Phase 2 | Après lot 3 | Après lot 4 |
|---|---|---|---|
| `window.confirm/alert/prompt` | 2 | 1 | **0** |
| Styles inline | 1 529 | 1 525 | **1 522** |
| `z-[...]` littéraux | n/m | 80 | **79** |
| `rounded-[...]` littéraux | n/m | 218 | 218 (pages non encore migrées) |
| Primitives `src/components/ui` | 49 | 56 | **53** (4 supprimées, 2 créées) |
| Fichiers `*Button.tsx` | 6 | 9 | **7** (legacy supprimés) |
| `LkvButton` / `GlassCard` / `GlassIconButton` | 15 / 90 / 13 | idem | **0 / 0 / 0** |

### Captures et tests

- Captures : `docs/design-system/phase2-screenshots/lot4/` (60 fichiers). Vérification visuelle Compte (mobile) + Home (desktop) : contenu, CTA, header, navigation intacts, aucune perte.
- `type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 946 tests** · `build` ✅ 12,1 s.

### Dette restante (Lot 5)

1. **13 headers custom** → `PageHeader` ; **17 overlays `role="dialog"`** maison + 5 primitives modales (`GlassModal` 23 importeurs, `GlassSheet` 5, `GlassDrawer` 10, `Sheet` 2, `PremiumBottomSheet` 2) → cible `Modal`/`Sheet`/`ConfirmDialog`.
2. **218 `rounded-[…]` littéraux** et **79 `z-[…]` littéraux** à purger par feature (tokens).
3. **5 192 hex** et **1 522 styles inline** restants dans les pages.
4. **54 pages desktop/mobile séparées** à fusionner quand données/structure/actions sont communes.
5. `BottomTabBar` (975 lignes) à découper (NavigationBar/TabItem/plateau/modèle/adaptateurs).
6. Consolidation `Badge`/`LkvChip` (information/statut vs action/sélection) et `ProductGlassCard`.
7. `ReportBlockModal` : dernier `confirm()` natif.
8. Formulaires legacy (`LkvInput` & co) à généraliser.

## Lot 5 — Modales/Sheets canoniques + découpage BottomTabBar (TERMINÉ pour ce périmètre)

### Primitives canoniques d'overlay

| Primitive | Rôle | API |
|---|---|---|
| `Modal` | information / édition / formulaire léger | `open`, `onOpenChange`, `title`, `description`, `children`, `footer`, `size` sm/md/lg, `scrollable`, `loading`, `dismissible`, `hideTitle` |
| `Sheet` | sélection / actions mobiles | `open`, `onOpenChange`, `title`, `children`, `footer`, `detent` auto/medium/large, `dismissible` — safe-area bas, scroll interne, poignée |
| `ConfirmDialog` | confirmation (lot 3) | inchangé |
| `PromptDialog` | saisie courte (lot 4) | inchangé |

- `GlassModal` (23), `GlassSheet` (5), `PremiumBottomSheet` (2) : **0 consommateur → supprimés** (+ exports retirés).
- Legacy `Sheet` (`isOpen/onClose`) remplacé par la nouvelle API (28 importeurs au total).
- `GlassDrawer` (10 importeurs) : **exception documentée** — panneau latéral desktop, pattern distinct conservé.

### Overlays `role="dialog"` maison : 17 → 11

Migrés : `panier` (confirm → `lkvConfirm`), `ProposalCard` → `Modal`, `ClubGroupsTab`, `EphemeralGroupSheet`, `QuickReportSheet` → `Sheet`.
Exceptions documentées (11) : `ImageViewer`, `StoriesViewer` (média), `MobileDrawer` (tiroir latéral), `SearchOverlay` (recherche live), `TerrainLiveCockpitControl` + `AdventureCockpitControl` (cockpits drag), `GlassBreakModal` ×2 (urgence médicale, matériau custom + re-verrouillage), `AddParticipantModal`/`AddGearModal` (formulaires préparation matériau forêt), `useHubSwipeNav` (sélecteur CSS, pas un dialogue).
Sheets sociales détectées hors périmètre (`social/ReportSheet`, `MoreMenuSheet`, `CommentsSheet`) → candidates lot suivant.

### Confirm/alert/prompt natifs : 0

`ReportBlockModal` migré (`confirm` → `lkvConfirm` destructif, `alert` → `lkvAlert`). Plus aucun appel navigateur applicatif.

### BottomTabBar découpée (961 → 8 modules ≤ 250 lignes)

`navigation/` : `WebNavigationBar` (79) · `NavigationSurface` (127) · `NavigationPlateau` (224) · `useNavigationPlateau` (239) · `TabItem` (198) · `HamburgerMenu` (196) · `ProminentAction` (28) · `useNavigationBadges` (20) ; `NavigationBar` (17) reste le point de bascule (`NATIVE_TABBAR_ENABLED = false`) ; `destinationRegistry` non dupliqué ; `BottomTabBar.tsx` supprimé. Comportement conservé (11 événements écoutés, 9 émis, haptics, prefetch, masquage, badges, appui long 550 ms).

### Métriques avant / après

| Mesure | Avant lot 5 | Après lot 5 |
|---|---|---|
| Importeurs `GlassModal` / `GlassSheet` / `PremiumBottomSheet` | 23 / 5 / 2 | **0 / 0 / 0** |
| `Sheet` canonique | legacy | **28 importeurs** · `Modal` 7 |
| `role="dialog"` maison | 17 | **11** (exceptions documentées) |
| `confirm/alert/prompt` natifs | 1 | **0** |
| Bottom bars détectées | 3 | **2** (`WebNavigationBar` + desktop) |
| BottomTabBar LOC | 961 | **0** (8 modules ≤ 250) |
| Styles inline | 1 522 | **1 513** |
| Hex | 5 192 | **5 188** |
| `z-[…]` littéraux | 79 | **77** |
| `rounded-[…]` littéraux | 218 | **217** |
| Primitives `ui/` | 53 | **51** |

### Captures et tests

- Captures : `docs/design-system/phase2-screenshots/lot5/` (60 fichiers).
- `type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 946 tests** · `build` ✅ 13,1 s.

### Exceptions / régressions assumées

1. Drag-to-dismiss et snap points non repris dans la nouvelle `Sheet` (2 écrans concernés) — à restaurer si l'UX le justifie.
2. `GlassSheet` plein écran → bottom sheet 90dvh sur 4 écrans (changement voulu).
3. `KitSheetModal` perd le centrage desktop ; texte « glissez la poignée » retiré de `MomentMapCard`.
4. Animations de sortie absentes des nouvelles primitives (entrée seule, comme `ConfirmDialog`).

### Dette restante (Lot 6)

1. **13 headers custom** → `PageHeader` ; **11 `role="dialog"`** exceptions ; 3 sheets sociales.
2. Consolidation `Badge`/`LkvChip` (information/statut vs action/sélection).
3. **217 `rounded-[…]`** et **77 `z-[…]`** littéraux ; **5 188 hex** ; **1 513 styles inline**.
4. **54 paires desktop/mobile** à fusionner sur les cas simples.
5. Drag/snap de la Sheet, animations de sortie, `GlassDrawer` (10 importeurs) à trancher.
6. Formulaires legacy (`LkvInput` & co).

## Lot 6 — Itération 1 : dette structurelle prioritaire (TERMINÉE)

### Livré

| Chantier | Avant | Après |
|---|---|---|
| Headers custom (`src/app`) | 13 | **2** (exceptions documentées : `hub/error.tsx`, `hub/[section]/error.tsx` — message d'erreur multi-lignes incompatible avec `subtitle` truncate) |
| `LkvChip` | 6 importeurs | **0 — supprimé** ; `Chip` canonique créé (sélection/filtre, `aria-pressed`, tokens) ; `Badge` reste information/statut (standalone) |
| `GlassDrawer` | 9 fichiers / 10 usages | **0 — supprimé** (mobile → `Sheet`, desktop/édition → `Modal`, dual → responsive via `useMediaQuery`) |
| Sheets sociales legacy | 3 | **0** — `CommentsSheet`, `MoreMenuSheet`, `ReportSheet` migrées vers `Sheet` canonique |
| `Sheet.dragToDismiss` | absent | **implémenté** (pointer events, seuil 25 %, snap retour, `prefers-reduced-motion` désactive le geste) et utilisé sur 4 écrans |
| Animations de sortie | absentes | ajoutées sur `Modal`/`Sheet`/overlays via `data-[state=closed]` + keyframes existantes |
| `KitSheetModal` desktop | centrage perdu | **restauré** via `Modal size="lg"` (md+) / `Sheet detent="large"` (mobile) |

- **Fichiers créés** : `src/components/ui/Chip.tsx`. **Supprimés** : `LkvChip.tsx`, `GlassDrawer.tsx`.
- 11 headers migrés vers `PageHeader` (actions de droite conservées à l'identique) ; normalisations assumées : headers admin en matériau tokenisé, overlines `Eyebrow` retirées des hero, titres de modales `location`/`occasion` en tokens.
- 2 tests adaptés (aucun supprimé) : `glass-controls.spec.tsx`, `depart-equipe-section.spec.ts`.

### Métriques avant / après (itération 1)

| Mesure | Avant lot 6 | Après itération 1 |
|---|---|---|
| Headers custom | 13 | **2** |
| `GlassDrawer` | 10 | **0** |
| `LkvChip` | 6 | **0** |
| Hex | 5 188 | **5 171** |
| `z-[…]` littéraux | 77 | **74** |
| Styles inline | 1 513 | **1 498** |
| Primitives `ui/` | 51 | **50** |
| `role="dialog"` maison | 11 | 11 (exceptions) |
| `rounded-[…]` littéraux | 217 | 217 |
| Paires desktop/mobile | 54 | 54 |

### Vérification

`type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 946 tests** · `build` ✅ 11,7 s · **60 captures** `phase2-screenshots/lot6/`.

### Reste du Lot 6 (itérations suivantes)

1. Migration des familles de pages (Home/hubs → Matériel → Voyage → Explorer → Communauté → Groupes → Compte → Boutique → secondaires) : adoption `PageHeader`/`Button`/`Card`/`ListItem`/états, tokenisation hex/inline au passage.
2. Purge `rounded-[…]` (217) par fréquence → tokens `control/card/surface/sheet/pill/circle` ; `z-[…]` littéraux (74) → échelle centrale.
3. 11 overlays `role="dialog"` exceptions (média, cockpits, urgence, formulaires préparation) : tokeniser surface/radius/z/boutons même sans changer de moteur.
4. 54 paires desktop/mobile (cas simples d'abord) ; 2 bottom bars → 1 contrat + adapters.
5. Hex (5 171) et styles inline (1 498) des pages non encore migrées.

## Lot 6 — Itération 2 · Famille 1 : Home / hubs (TERMINÉE)

### Périmètre et résultat
107 fichiers (1 Home + 9 `src/app/hub` + 97 composants hub réellement importés) ; **70 fichiers modifiés**, **0 supprimé** (staging hub non touché).

| Mesure (périmètre famille 1) | Avant | Après |
|---|---|---|
| Hex codés en dur | 34 | **10** (Leaflet SVG : `var()` non interprété — valeurs canoniques de tokens, garde-fou H-D85 R2) |
| `rounded-[…]` littéraux | 72 | **0** |
| `z-[…]` littéraux | 6 | **0** |
| Styles inline | 36 | **28** (tous dynamiques : progression, couleurs runtime, motion, offsets) |
| Headers custom (`src/app/hub`) | 2 | **0** |
| Boutons bruts / `<Button>` / `<IconButton>` | 126 / 2 / 0 | **1 / 100 / 24** |
| `glass-capsule-btn` / `glass-circle-btn` / `glass-pill` | 117 / 23 / 12 | **10 / 0 / 0** |
| `GlassCapsuleBtn` / spinners maison | 4 / 3 | **0 / 0** |

- Migration : 125 boutons bruts → `Button`/`IconButton`, `glass-pill` → `Badge` (12), filtres → `Tabs`, lignes → `ListItem`, surfaces → `Card`, sélecteur de mode → `Chip`, états vides/erreur → `EmptyState`/`ErrorState`, spinners → `Spinner`/`LoadingState`.
- **Exception headers supprimée** : `PageHeader.subtitleLines` (0/2+ = multi-lignes `line-clamp`, défaut 1 strictement inchangé) → les 2 `hub/error.tsx` sont migrés ; `src/app` = **0 header custom**.
- Exceptions documentées : 10 hex Leaflet, 28 inline dynamiques, 11 `<header>` = en-têtes de cartes de section (pas des h1 de page), 10 liens-actions `glass-capsule-btn` (pas de `<button>`), 1 `role="switch"` custom (pas de `Switch` canonique), `GlassCapsuleBtn` conservé (26 importeurs hors périmètre).

### Métriques globales après famille 1

| Mesure | Baseline lot 6 | Après famille 1 |
|---|---|---|
| Headers custom | 13 | **0** |
| `rounded-[…]` littéraux | 217 | **145** |
| `z-[…]` littéraux | 74 | **68** |
| Hex | 5 171 | **5 147** |
| Styles inline | 1 498 | **1 490** |
| Paires desktop/mobile | 54 | 54 |
| Bottom bars | 2 | 2 |
| Overlays custom | 11 | 11 |

### Vérification
`type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 946 tests** · `build` ✅ 14,3 s · **60 captures** `phase2-screenshots/lot6-famille1/`. 4 tests impactés : 3 corrigés côté code, 1 adapté (contrat `IconButton`), **aucun supprimé**.

### Prochaine famille : **Matériel / kits / départ** (famille 2)

## Lot 6 — Itération 2 · Famille 2 : Matériel / Kits / Départ (TERMINÉE)

### Périmètre et résultat
120 fichiers (app matériel/kits + `features/materiel` + partagés) ; **60 fichiers modifiés** (57 source + 3 tests), **0 supprimé** (staging mort non touché).

| Mesure (périmètre famille 2) | Avant | Après |
|---|---|---|
| Hex UI | 62 | **0** |
| `rounded-[…]` littéraux | 17 | **0** |
| `z-[…]` littéraux | 2 | **0** |
| `<button>` bruts | 91 | **7** (6 fichiers morts + 1 exception live) |
| Overlays custom `fixed inset-0` | 4 | **1** (backdrop listbox, z tokenisé) |
| Classes legacy `glass-*` | 152 | **32** (30 fichiers/CSS morts + 2 `glass-progress` contractuels) |
| Styles inline | 15 | **14** (tous dynamiques) |

- Migrations : 84 boutons live → `Button`/`IconButton`/`Chip`/`Tabs`, overlays → `Modal`/`Sheet`/`lkvConfirm`, états → `EmptyState`/`LoadingState`/`Skeleton`, recherche → `SearchField`, pastilles → `Badge`, lignes → `ListItem`, surfaces → `Card`, headers → `PageHeader` — **Smart Departure inclus** (mêmes primitives).
- Exception documentée : `DepartChecklist.tsx:606` (accordéon disclosure `aria-expanded` dense), `glass-progress` (contrat de test), contrôles natifs `<select>`/checkbox tokenisés, `window.print()` conservé.
- **Logique métier intacte** : aucun fichier actions/domain/services/hooks/store modifié ; `NATIVE_TABBAR_ENABLED` inchangé.

### Métriques globales après famille 2

| Mesure | Après famille 1 | Après famille 2 |
|---|---|---|
| Headers custom | 0 | **0** |
| `rounded-[…]` littéraux | 145 | **138** |
| `z-[…]` littéraux | 68 | **66** |
| Hex | 5 147 | **5 085** |
| Styles inline | 1 490 | **1 489** |
| Paires desktop/mobile | 54 | 54 |
| Bottom bars | 2 | 2 |
| Overlays custom | 11 | 11 |

### Vérification
`type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 946 tests** · `build` ✅ 17,9 s · **60 captures** `phase2-screenshots/lot6-famille2/`. 3 tests adaptés (classes → tokens, `<hr>` → `Divider`, `glass-pill` → `Badge`), **aucun supprimé**.

## Lot 6 — Itération 2 · Famille 3 : Voyage / Préparation (TERMINÉE)

### Périmètre et résultat
155 fichiers live (`app/voyages`, `features/trips`, `features/preparation`, `preparer-sentier`, `features/participants`) ; **70 fichiers modifiés** (66 source + 4 tests), **0 supprimé** (16 fichiers staging non touchés).

| Mesure (périmètre) | Avant | Après |
|---|---|---|
| Hex UI | 188 | **0** |
| `rounded-[…]` littéraux | 3 | **0** |
| `z-[…]` littéraux | 1 | **0** |
| `<button>` bruts | 123 | **1** (`TripPhaseController:70`, tabs à double ligne) |
| `glass-*` legacy | 211 | **0** (7 chaînes = tokens) |
| Overlays custom | 9 | **2** (scrim/click-catcher tokenisés) |
| `role="dialog"` maison | 4 | **0** |
| Headers custom | 3 | **2** (barre sticky autoGen, `<header>` d'impression) |
| Styles inline | 21 | **18** (dynamiques) |

- 122 boutons → `Button`/`IconButton`/`Chip` ; 4 modales maison → `Modal`/`Sheet`/`ConfirmDialog` ; layouts canoniques (liste → `ListPageLayout`, détail → `DetailPageLayout`, formulaires → `FormPageLayout`) ; formulaires (labels/erreurs/validation/CTA) standardisés ; `Tabs` étendu d'un `badge` rétro-compatible.
- Exceptions documentées : `TripPhaseController:70`, `AutoGenTripCreateView:130` (scrim tokenisé), `DayView:135` (click-catcher), `TripExportView:39` (feuille imprimée), 18 inline dynamiques.
- **Logique métier intacte** : aucun fichier actions/domain/services/engine/store/hooks/server/API modifié ; `NATIVE_TABBAR_ENABLED` inchangé.

### Métriques globales après famille 3

| Mesure | Après famille 2 | Après famille 3 |
|---|---|---|
| Hex | 5 085 | **4 897** |
| `role="dialog"` maison | 11 | **7** |
| Styles inline | 1 489 | **1 486** |
| Headers custom | 0 | **0** |
| Bottom bars | 2 | 2 |

### Vérification
`type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 946 tests** · `build` ✅ 14,4 s · **60 captures** `phase2-screenshots/lot6-famille3/`. 4 tests adaptés, **aucun supprimé**.

### Prochaine famille : **Famille 4 — Explorer / carte**

## Lot 6 — Itération 2 · Famille 4 : Explorer / Carte (TERMINÉE)

### Périmètre et résultat
37 fichiers live (`app/explorer`, `app/carte-interactive`, `app/hors-ligne`, `components/explorer`, `components/map` UI, `features/places`, `features/discovery`, `features/terrain-live`) ; **33 fichiers modifiés** (32 source + 1 test), **0 supprimé**. Moteur carte non touché (Leaflet/MapLibre, clustering, géométrie, POI data, bbox offline, tuiles, géocodage).

| Mesure (périmètre) | Avant | Après |
|---|---|---|
| Hex UI | 420 | **75** (100 % exceptions moteur/données documentées) |
| `rounded-[…]` littéraux | 3 | **0** |
| `z-[…]` littéraux | 32 | **0** |
| Styles inline | 38 | **12** (dynamiques + Leaflet) |
| `<button>` bruts | 70 | **3** (1 scrim click-catcher + 2 faux positifs commentaire) |
| Classes `glass-*` legacy (`.glass`, `glass-capsule-btn`, `glass-pill`, `glass-circle-btn`, `glass-sub-card`, `glass-input`) | 157 | **0** (restent `--glass-border`, `variant="glass"`, `glass-progress` contractuel) |
| Overlays custom `fixed inset-0` | 7 | **3** (loading plein écran, cockpit drag, overlay modal testé SSR) |
| `env(safe-area-*)` | 19 | **0** |
| Paires desktop/mobile | 1 (carte-interactive : rendu doublé) | **0** |
| Écrans carte migrés vers `MapPageLayout` | 0 | **2** (`/explorer`, `/carte-interactive`) |

- `MapPageLayout` étendu (slot `overlay`, carte `fixed inset-0`, wrappers `pointer-events-none` + `--z-*`) ; ExplorerClient et CarteClient convergent dessus sans recréer la structure.
- Contrôles → `IconButton`/`Button`/`Tabs`/`Chip`/`SearchField` ; panneau filtres mobile d'`InteractiveMap` → `Sheet` ; fiche sentier (`TrailDetailPanel`) → `Sheet` (`dragToDismiss`, safe-area, footer d'actions) ; `ReportPlaceModal` → `Modal` ; états → `EmptyState`/`LoadingState`/`Skeleton`/`Spinner` ; POI/cartes → `Card`/`Badge`/`ListItem`.
- `Badge` étendu d'un `style?` (teinte dynamique des catégories, rétro-compatible).
- **Aucune régression d'interaction carte** : wrappers d'overlays en `pointer-events-none`, seuls les contrôles déclarent `pointer-events-auto` ; `TestResult` terrain/atlas inchangés.
- **Logique métier intacte** : aucun fichier hooks/engine/queries/services/actions/store/API/PostGIS modifié ; `NATIVE_TABBAR_ENABLED` inchangé.

### Exceptions documentées
1. `components/explorer/TrailLayer.tsx` (21 hex) et `components/map/InteractiveMap.tsx` (31 hex) : markup Leaflet des marqueurs/clusters/popups (moteur carte).
2. `components/explorer/ExplorerMap.tsx` (11 hex + 2 styles inline) : couleurs Path Leaflet (`preferCanvas` ne résout pas `var()`) + `touchAction` des gestes.
3. `components/explorer/types.ts` (5 hex) et `ExplorerFilterPanel.tsx` (7 hex) : palettes de données difficulté/POI (non peintes directement).
4. `features/terrain-live/components/TerrainLiveCockpitControl.tsx:163` : scrim click-catcher + panneau drag maison (exception lot 5) — surface/z/boutons tokenisés.
5. `features/places/components/AddPlaceToTripModal.tsx:78` : overlay conservé pour rester rendu par `renderToStaticMarkup` (`tests/places/placeComponents.spec.ts`) — scrim/z/radius canoniques.
6. `TripRatingBadge.tsx:46`, `TripadvisorAttribution.tsx:28` : dimensions imposées par les Display Requirements Tripadvisor.
7. `UnifiedCountryGlobe.tsx:373` : coordonnées dynamiques du tooltip (souris).
8. Styles inline dynamiques restants : couleurs runtime et largeurs de progression (5 fichiers).

### Métriques globales après famille 4

| Mesure | Après famille 3 | Après famille 4 |
|---|---|---|
| Hex | 4 897 | **4 552** |
| `rounded-[…]` littéraux | 138 | **132** |
| `z-[…]` littéraux | 66 | **33** |
| Styles inline | 1 486 | **1 460** |
| `role="dialog"` maison | 7 | 7 |
| Pages desktop/mobile séparées | 54 | **52** |

### Vérification
`type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 946 tests** (27 skipped) · `build` ✅ 14,2 s · **60 captures** `phase2-screenshots/lot6-famille4/` (matrice 4 gabarits). 1 test adapté (`render.spec.tsx` : `animate-pulse` → `animate-shimmer` du `Skeleton` canonique), **aucun supprimé**. Métriques globales revérifiées indépendamment : hex 4 552 · `rounded` littéraux 132 · `z` littéraux 33 · inline 1 460 · paires desktop/mobile 52.

## Lot 6 — Itération 2 · Famille 5 : Communauté / Messagerie (TERMINÉE)

### Périmètre et résultat
55 fichiers live (`app/communaute`, `app/messagerie`, `app/feed`, `app/publier`, `components/communaute`, `components/social`, `features/messaging`) ; **42 fichiers modifiés**, **0 supprimé**, **0 test modifié**. Hors Groupes/Clubs/Carnets (famille 6).

| Mesure (périmètre) | Avant | Après |
|---|---|---|
| Hex UI | 842 | **0** |
| `rounded-[…]` littéraux | 12 | **0** |
| `z-[…]` littéraux | 4 | **0** |
| Styles inline | 109 | **10** (dynamiques) |
| `<button>` bruts | 157 | **6** (5 boutons réels tokenisés + 1 calque) |
| `glass-*` legacy | 124 | **0** |
| Overlays custom | 1 | 1 (calque conversation mobile, z de l'échelle partagée) |
| `env(safe-area-*)` directs | 8 | **0** |
| Paires desktop/mobile | 5 | **3** (documentées) |
| Composants UI sociaux spécifiques | 4 | **0** |

- Feed/publications : `Card`/`Button`/`Badge`/`Chip` ; actions sociales (like/commentaire/partager/enregistrer/menu/supprimer/signaler) uniformisées ; messagerie : header `PageHeader`, listes `ListItem`, recherche `SearchField`, états canoniques, composer avec `--safe-bottom` − `--kb-inset` (aucun double inset) ; `MessageBubble` 100 % tokens ; 3 sheets sociales vérifiées non cassées ; `/publier` + `/communaute/publier` + `/feed` fusionnés en arbre responsive.
- Exceptions : 4 tuiles d'action swipe (`ConversationRow`, gestes conservés, tokenisées), calque conversation mobile, `StoriesViewer` (gestes plein écran tokenisé), 10 inline dynamiques.
- **Logique métier intacte** : realtime/Supabase, typing/présence, read receipts, uploads, pagination, ranking, gestes et clavier inchangés ; `NATIVE_TABBAR_ENABLED` inchangé.

### Métriques globales après famille 5

| Mesure | Après famille 4 | Après famille 5 |
|---|---|---|
| Hex | 4 552 | **3 710** |
| `rounded-[…]` littéraux | 132 | **120** |
| `z-[…]` littéraux | 33 | **29** |
| Styles inline | 1 460 | **1 361** |
| Paires desktop/mobile | 52 | **50** |

### Vérification
`type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 946 tests** · `build` ✅ 17,1 s · **60 captures** `phase2-screenshots/lot6-famille5/`. Métriques revérifiées indépendamment.

## Lot 6 — Itération 2 · Famille 6 : Groupes / Clubs / Carnets (TERMINÉE)

### Périmètre et résultat
75 fichiers live (`app/nouveau-groupe`, `app/clubs`, `app/carnets`, `components/groupes`, `components/clubs`, `components/carnets`, `components/carnet`, `features/tribu`) ; **56 fichiers modifiés**, **0 supprimé**. Hors `features/crews/{actions,types,schemas}` et `features/tribu/{actions,hooks,lib}` (métier intact).

| Mesure (périmètre) | Avant | Après |
|---|---|---|
| Hex | 682 | **23** (Leaflet/data persistée) |
| `rounded-[…]` littéraux | 14 | **0** |
| `z-[…]` littéraux | 10 | **0** |
| Styles inline | 27 | **8** (dynamiques) |
| `<button>` bruts | 231 | **4** (exceptions sémantiques) |
| `glass-*` legacy | 524 | **0** |
| Overlays custom | 12 | **0** |
| `env(safe-area-*)` directs | 4 | **0** |
| Composants sociaux/overlays spécialisés | 7 | **0** |

- Listes → `Card`/`ListItem`/`Badge`/`Chip` ; détails groupe/club → `PageHeader` + structure identité/actions/infos/membres/activité ; carnets : identité éditoriale conservée, fondations `@/design` ; formulaires canoniques ; membres/rôles en `ListItem`+`Badge` ; actions destructives → `ConfirmDialog`/`lkvConfirm` ; états canoniques.
- Corrections incluses : `IconButton variant="glass"`, `Badge title` sur span, `shadow-[var(--elevation-N)]` → `shadow-elevation-N` (garde-fou U-D62 de nouveau vert), imports inutiles.
- Exceptions : couleurs Leaflet (`CarnetMap`, `ParcoursCard`, `nouveau-groupe`), palette `ACCENT_COLORS` consommée par Leaflet, `couleur_tag` persistée en base, 4 boutons sémantiques (`role="radio"`/`switch`/checkbox/emoji), 8 inline dynamiques, table de correspondance legacy DB (jamais rendue).

### Métriques globales après famille 6

| Mesure | Après famille 5 | Après famille 6 |
|---|---|---|
| Hex | 3 710 | **3 051** |
| `rounded-[…]` littéraux | 120 | **106** |
| `z-[…]` littéraux | 29 | **19** |
| Styles inline | 1 361 | **1 342** |
| Paires desktop/mobile | 50 | **50** (4 paires clubs/carnets conservées, UX distincte) |

### Vérification
`type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 946 tests** · `build` ✅ 14,2 s · **60 captures** `phase2-screenshots/lot6-famille6/`. Aucun test modifié ni supprimé. Métriques revérifiées indépendamment.

### Prochaine famille : **Famille 8 — Boutique / Commandes**

## Lot 6 — Itération 2 · Famille 7 : Compte / Profil (TERMINÉE)

### Périmètre et résultat

45 entrées (42 modifiés, 1 supprimé `LkvSwitch.tsx`, 1 créé `Switch.tsx`) : `app/compte`, `app/profil`, `app/progression`, `components/compte`, `components/profile`, `components/identity`, `components/progression`, `features/identity`. Reprise d'un run interrompu : **31 fichiers du run précédent complétés/corrigés**, 8 déjà conformes conservés, **3 fichiers progression ajoutés** (`app/progression/page.tsx`, `MaProgressionView`, `ProgressionCompactCard`), **`Switch` finalisé**. Aucune logique métier touchée (auth, Supabase, sessions, profils, RLS, upload avatar, notifications, préférences, API, hooks, services, stores).

| Mesure (périmètre) | Avant | Après |
|---|---|---|
| Hex | 820 | **0** |
| `rounded-[…]` littéraux (toutes variantes) | 66 | **0** |
| `z-[…]` littéraux (hors `var()`) | 5 | **0** |
| `z-10…z-90` numériques | 34 | **0** |
| Styles inline | 116 | **13** (dynamiques) |
| `<button>` bruts | 125 | **1** (dans la primitive `Switch`) |
| `glass-*` legacy | 336 | **0** |
| `glass-modal` / overlays custom | 10 / 4 | **0 / 1** (éditeur plein écran) |
| `env(safe-area-*)` directs | 4 | **0** |
| Switches custom (`role="switch"`) | 2 | **0** (`Switch` canonique ×6) |
| Paires desktop/mobile | 4 | **4** (cockpit vs app mobile, UX distincte) |

### Primitive `Switch` canonique

`src/components/ui/Switch.tsx` (créé/finalisé, exporté depuis `index.ts`) : `{ checked, onCheckedChange, disabled?, label?, id?, className?, aria-label? }`, `role="switch"` + `aria-checked`, label associé (`aria-labelledby`) ou `aria-label` obligatoire, clavier natif Espace/Entrée, focus visible, cible ≥ 44 px, `prefers-reduced-motion`, tokens uniquement. Remplace `LkvSwitch.tsx` (0 importeur, **supprimé**) et le switch maison de `ParametresCompteCard` ; 6 usages (ParametresCompteCard ×5, EditProfileView ×1). Test `TEST-PRIM-06` ajouté à `tests/design-system/primitives.spec.ts`.

### Migrations

- **Modales** : `glass-modal` → `Modal` canonique (AddressModal, CardModal, modale badges) ; actions sensibles → `lkvConfirm`/`lkvAlert` (déconnexion, annulation commande, suppression brouillon, sessions).
- **Navigation/filtres** → `Tabs` (TabsCompte, historique commandes, badges, tri carnets, filtre clubs, métriques/années/statuts aventures, classements progression).
- **Surfaces** → `Card` (identité compte, cartes compte, stats, profil public, profil randonneur, progression) ; **lignes** → `ListItem` (notifications, confidentialité, 2FA/passkeys, activité).
- **Pastilles** → `Badge`/`Chip` ; **états** → `EmptyState`/`ErrorState`/`LoadingState`/`Skeleton` ; **headers** → `PageHeader` + `HeaderBackButton` (profil public, édition profil).
- Formulaires tokenisés (`lkv-field-*`), libellés/erreurs standardisés ; avatar/upload conservés à l'identique.

### Exceptions documentées

1. `src/components/compte/EditProfileModal.tsx:17` — overlay plein écran d'édition au-dessus du cockpit desktop (z tokenisé, `--z-modal`) : pas d'équivalent plein écran dans `Modal`.
2. 13 styles inline **dynamiques** (largeurs de progression, couleurs runtime de graphiques, URL de couverture) : `AventuresTab`, `CarnetsTab` ×2, `CommandesTab`, `EditProfileView`, `FideliteTab`, `MobileCompteV2` ×2, `ProchainVoyageCard`, `StatsBandeau`, `MaProgressionView` ×3.
3. `src/components/ui/Switch.tsx:58` — le `<button role="switch">` est la primitive elle-même.
4. 4 paires desktop/mobile conservées (compte, profil public, progression, édition) : structures et actions distinctes.
5. Header applicatif de `MobileCompteV2` (`<header>` sticky, bouton-titre interactif + actions) conservé : hors contrat `PageHeader` (titre `h1` non interactif) ; actions passées en `Button`/`IconButton`.
6. Champs natifs tokenisés (`input`/`textarea`/`select`) : aucune primitive `Input` canonique (`LkvInput` legacy sans consommateur).
7. `MobilePageShell` conservé sur les pages existantes (règle shell tolérée).

### Vérification

`type-check` ✅ 0 · `lint` ✅ 0 erreur · `vitest` ✅ 407 fichiers / **2 947 tests** · `build` ✅ · `verify:invariants` ✅ 0. Aucun test supprimé ; 1 test ajouté (`Switch`).

## Lot 6 — Itération 2 · Famille 8 : Boutique (TERMINÉE)

### Périmètre et résultat
23 fichiers modifiés + **1 créé** (`src/components/produit/ProductCard.tsx` — pattern produit unique) ; 0 supprimé. `app/admin/produits` non touché (hors front utilisateur).

| Mesure (périmètre) | Avant | Après |
|---|---|---|
| Hex UI | 189 | **0** |
| `rounded-[…]` littéraux | 5 | **0** |
| `<button>` bruts | 79 | **0** |
| `glass-*` legacy | 145 | **0** |
| Overlays custom | 6 | **0** |
| `env(safe-area-*)` directs | 1 | **0** |
| Styles inline | 236 | **7** (dynamiques : jauges, progression, nuancier) |
| Composants produit spécifiques | 4 patterns | **1** (`ProductCard`) |

- Catalogue → `Card`/`Badge`/`Chip`/`Tabs`/`SearchField` ; fiche produit → `PageHeader` (mobile) + primitives ; **pattern prix unique** (mono, promo `-X%` textuel, ancien prix barré, caution) ; location claire ; affiliation : mêmes composants, **mentions légales conservées** ; overlays → `Modal` ; panier/checkout → primitives + `lkvConfirm` ; états canoniques.
- **Dette `Switch` absorbée (2/2)** : `TeamDrawers.tsx` (« sac de bât ») et `app/carnets/page.tsx` migrés vers la primitive canonique, comportement identique. Restent 3 `role="switch"` hors mandat (`HubSectionPicker` non importé, `TeamMobileExperience`, `ItineraryDrawers`) → Famille 9.
- Exception assumée : correction de contraste des héros sombres (`bg-dark-bg` inexistant → `--lkv-primary` tokenisé).

### Métriques globales après famille 8

| Mesure | Après famille 7 | Après famille 8 |
|---|---|---|
| Hex | 2 222 | **2 033** |
| `rounded-[…]` littéraux | 41 | **36** |
| `z-[…]` littéraux | 12 | 12 |
| Styles inline | 1 239 | **1 010** |
| Paires desktop/mobile | 50 | **48** |

### Vérification
`type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 947 tests** · `build` ✅ 11,0 s · `verify:invariants` ✅ 6/6 · **60 captures** `phase2-screenshots/lot6-famille8/`. Aucun test supprimé ni adapté. Métriques revérifiées indépendamment.

### Prochaine famille : **Famille 9 — Pages secondaires + purge finale Lot 6**

## Lot 6 — Itération 2 · Famille 9 : Pages secondaires + purge finale (TERMINÉE)

### Baseline recalculée (avant modifications)

`node scripts/design/baseline-metrics.mjs --json` : hex **2 033** · `rounded-[…]` littéraux **36** ·
`z-[…]` littéraux **12** · styles inline **1 010** (statiques **464** / dynamiques **546**) ·
`<button>` bruts **395** · classes `glass-*` legacy **546** · `env(safe-area-*)` directs **21** ·
`role="dialog"` **7** · bottom bars **2** · paires desktop/mobile **48** · headers custom `src/app` **0**.

### Périmètre et résultat
109 fichiers modifiés, **13 supprimés** (0 consommateur prouvé), 0 créé. Les pages secondaires migrées :
`/connexion`, `/inscription`, `/cgu`, `/cgv`, `/cookies`, `/mentions-legales`,
`/politique-confidentialite`, `/not-found`, `/global-error`, `/faq`, `/contact`, `/entraide`,
`/copilote`, `/experts`, `/createurs`, `/ambassadeurs`, `/carbone`, `/guides`, `/guides/[slug]`,
`/avis`, `/rapport-expedition`, `/outils`, plus tokenisation transverse de
`/evenements`, `/blog`, `/outils/[slug]`, `/pro`, `/communaute-pro`, `/recompenses`, `/pays` et des
cockpits `features/hiking`. Routes `notifications`/`favoris`/`feedback` inexistantes dans `src/app`
(les notifications vivent dans `/compte`) ; `/admin` (back-office) et `/dev/*` (staging) hors périmètre.

| Mesure (globale, `src/**/*.{ts,tsx}`) | Baseline famille 9 | Après famille 9 |
|---|---|---|
| Hex codés en dur | 2 033 | **251** (100 % technique/données — UI live **0**) |
| `rounded-[…]` littéraux | 36 | **5** (`CountryFlag`, géométrie) |
| `z-[…]` littéraux | 12 | **0** |
| Styles inline | 1 010 | **440** (statiques **125** / dynamiques **315**) |
| `<button>` bruts | 395 | **297** |
| Classes `glass-*` legacy | 546 | **458** |
| `env(safe-area-*)` directs | 21 | **14** |
| Switches custom `role="switch"` live | 3 | **0** |
| Overlays spécialisés hors primitives | 7 | **6** (tous tokenisés, `role="dialog"`/`aria-modal`) |
| Paires desktop/mobile | 48 | **47** |
| Code mort « deletable » | 12 | **0** (88 protégés staging, 0 supprimable) |

### 1. Pages secondaires
Layouts canoniques (`AppShell`/`PageLayout`), `PageHeader`/`HeaderBackButton`, primitives
(`Button`/`IconButton`/`Card`/`Chip`/`Badge`/`Tabs`/`SearchField`), états canoniques
(`EmptyState`/`ErrorState`/`LoadingState`/`Skeleton`/`Spinner`) et tokens partout. Fusions notables :
`/not-found` (une seule arborescence responsive, paire 48→47), `/faq` (accordéon unique desktop/mobile),
`/contact` (liste + formulaire partagés), `/inscription` (formulaire unique avec labels associés).

### 2. Switches custom → `Switch` canonique
`TeamMobileExperience.tsx` (sac du chien), `ItineraryDrawers.tsx` (matériel du jour) et les 2 switches
`aria-pressed` de `/cookies` migrés ; `HubSectionPicker.tsx` (0 importeur vérifié) **supprimé**.
`role="switch"` live restant : **0** (uniquement la primitive `Switch.tsx`).

### 3. Overlays
`ImageViewer`, `StoriesViewer`, `MobileDrawer`, `SearchOverlay`, `AdventureCockpitControl` migrés aux
tokens (scrim `--lkv-overlay-scrim`, surface, radius, `--z-*`, typographie, `Button`/`IconButton`,
motion réduite) ; `TerrainLiveCockpitControl` déjà conforme ; `GlassBreakModal` ×2,
`AddParticipantModal`, `AddGearModal` déjà canoniques (constat, aucune modification) ;
`useHubSwipeNav` = sélecteur CSS `[role="dialog"]` (pas un overlay). Les modales maison
`NewReportModal`/`ReportDetailModal` (rapport-expédition) et `WriteReviewModal` (avis) migrées vers
`Modal`. Correction incluse : les classes `story-*` n'existaient plus dans le CSS — `StoriesViewer`
était non stylé ; reconstruit en utilitaires Tailwind + keyframes `lkv-story-progress`
(`src/styles/tailwind.css`).

### 4. Bottom bars
`MobileNavWrapper` = unique assemblage de navigation (contrat `NavigationBar`,
`NATIVE_TABBAR_ENABLED = false` inchangé) ; `DesktopDockBar` (randonnée active) reclassé **dock
d'actions local** (hors `NavigationModel`), documenté. Aucune implémentation UIKit.

### 5. Purge `rounded-[…]` / `z-[…]`
Tous les littéraux live mappés (`0.75rem→--lkv-radius-sm`, `1.5rem→--lkv-radius-lg`,
`1.75rem→--lkv-radius-card`, `2rem→--lkv-radius-card`) et `z` vers `--z-*` (`--z-emergency`,
`--z-command`, `--z-sticky`, `--z-toast`, `--z-modal`). Restent 5 `rounded-[2..6px]` dans
`src/components/ui/CountryFlag.tsx:13-17` (rayons proportionnels au drapeau, exception géométrique).

### 6. Hex — UI vs technique
UI live : **2 033 → 0**. Les 251 restants sont classés :
- **Leaflet/moteur carte (119)** : `components/map/InteractiveMap.tsx` (31), `TrailLayer` (21),
  `ExplorerMap` (11), `map/engine/mapTheme.ts` (11), `HubMiniMap` (8), `HubRouteMap` (8),
  `CarnetMap` (8), `ExplorerFilterPanel` (7), `ParcoursCard` (6), `explorer/types.ts` (5),
  `DayTraceMap` (2), `ItineraryMapSection` (1).
- **Données/palettes persistées (60)** : `constants/equipmentCategories.ts` (28),
  `features/hub/mobile/mobileHubEngine.ts` (7), `lib/pays/danger.ts` (6), `lib/mock/carnet-chartreuse.ts` (4),
  `terrainDisplay.ts` (3), `app/carbone/page.tsx` (3, série de graphe non rendue), `lib/queries/carnet.ts` (1,
  `couleur_tag`), `app/nouveau-groupe/page.tsx` (8, accents persistés).
- **Technique** : PDF `HikeReportPDFService.ts` (19), HTML email `api/notifications/process/route.ts` (9),
  natif/`themeColor` (`lib/native/status-bar.ts` 3, `NativeAppBootstrap.tsx` 1, `app/layout.tsx` 2),
  dataviz `ElevationProfileChart.tsx` (12), back-office `app/admin` (14), staging dev
  `components/dev/style/StyleShowcase.tsx` (12).

### 7. Inline styles
Statiques **464 → 125**, dynamiques **546 → 315** (total **1 010 → 440**). Les 125 statiques restants
sont concentrés dans les pages non réécrites intégralement (dette documentée) : `blog/BlogClient.tsx` (21),
`evenements/page.tsx` (19), `dev/glass/GlassLab.tsx` (9), `outils/[slug]/page.tsx` (7),
`pro/page.tsx` (7), `dev/style/StyleShowcase.tsx` (5), `ui/Icon/Icon.tsx` (4).
Dynamiques justifiés : jauges/progressions, transforms de gestes, couleurs runtime, virtualisation, carte.

### 8. Paires desktop/mobile
**48 → 47** : `/not-found` fusionné (arborescence responsive unique). Les 46 autres sont conservées et
justifiées : shells distincts (Header/Footer desktop vs `AppShell` mobile) et/ou contenus/UX distincts ;
là où le contenu était dupliqué (`/faq`, `/contact`, `/inscription`, `/avis`), il est désormais partagé
entre les deux shells.

### 9. Code mort / staging
`find-dead-code.mjs` : 100 morts / 12 supprimables en début de famille → **88 morts / 0 supprimable**
en fin (88 protégés staging métier). 13 fichiers UI supprimés avec preuve 0 consommateur :
`icons/chevron-up.tsx`, `materiel/BackgroundVideo.tsx`, `mobile-nav/MobileProfilePage.tsx`,
`profile/HikingProfileCard.tsx`, `social/MoreMenuSheet.tsx`, `social/SocialActions.tsx`,
`ui/BackButton.tsx`, `ui/LkvCheckbox.tsx`, `ui/LkvInput.tsx`, `ui/LkvSelect.tsx`,
`ui/LkvTextarea.tsx`, `ui/MediaUpload.tsx`, `features/hub/components/HubSectionPicker.tsx`.

### 10. Mémoire musculaire & accessibilité
`aria-expanded` sur les accordéons FAQ, `aria-pressed` sur les bascules restantes, `aria-label`
obligatoire sur tous les `IconButton` introduits, labels associés (`htmlFor`/`id`) sur les
formulaires migrés, `role="status"`/`aria-live` sur les retours, cibles ≥ 44 px, focus visible via
tokens, `prefers-reduced-motion` conservé, statuts jamais portés uniquement par la couleur.

### Exceptions documentées
1. `CountryFlag.tsx:13-17` — rayons 2–6 px proportionnels au drapeau (géométrie).
2. `useHubSwipeNav.ts:21` — `[role="dialog"]` est un sélecteur d'exclusion de geste.
3. Overlays spécialisés conservés (gestes plein écran / panneaux) mais 100 % tokenisés :
   `ImageViewer.tsx:163`, `StoriesViewer.tsx:142`, `MobileDrawer.tsx:195`, `SearchOverlay.tsx:104`,
   `TerrainLiveCockpitControl.tsx:171`, `AdventureCockpitControl.tsx:86`.
4. 251 hex techniques/données (détail §6) ; `app/layout.tsx:73-74` et
   `NativeAppBootstrap.tsx:44` exigent des littéraux (meta/natif).
5. 125 inline statiques restants dans les pages non réécrites (détail §7).
6. `app/admin/**` (back-office) : 14 hex, 46 inline, 66 `<button>` — hors front utilisateur.
7. `features/hiking/**` : hex de classes purgés (443 → 0) ; boutons bruts résiduels hors périmètre.

### Vérification
`type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 947 tests** (27 skipped) ·
`build` ✅ · `verify:invariants` ✅ 6/6. Aucun test supprimé ni adapté. Métriques recalculées via
`baseline-metrics.mjs --write` (JSON à jour) et classification par scripts d'audit.

# Lot 6 — Final

## Familles migrées (9/9)
1. Home / hubs · 2. Matériel / kits / départ · 3. Voyage / préparation · 4. Explorer / carte · 5. Communauté / messagerie · 6. Groupes / clubs / carnets · 7. Compte / profil · 8. Boutique · 9. Pages secondaires + purge finale.

## Métriques globales — Phase 1 → fin Lot 6

| Mesure | Baseline Phase 1 | Fin Lot 6 |
|---|---|---|
| Hex `src/**/*.{ts,tsx}` | 5 808 | **251** — dont **UI live 0**, 251 techniques/données (Leaflet 119, palettes/persisté 60, PDF 19, emails 9, natif/meta 6, admin 14, dev 12, dataviz 12) |
| Styles inline | 1 529 | **440** — statiques **125** / dynamiques justifiés **315** |
| `rounded-[…]` littéraux | 342 (total) | **5** (`CountryFlag`, géométrie) |
| `z-[…]` littéraux | 88 | **0** |
| Headers custom | 13 | **0** |
| Switches custom | 5 | **0** (primitive `Switch` canonique) |
| `window.confirm/alert/prompt` | 2 | **0** |
| Overlays `role="dialog"` maison | 17 | **7** (spécialisés gestes, 100 % tokenisés) |
| Paires desktop/mobile | 54 | **47** (1 fusionnée, 46 justifiées : shells Header/Footer vs AppShell, split views, cockpits) |
| Bottom bars | 3 implémentations | **2** : 1 contrat `NavigationBar` (`NATIVE_TABBAR_ENABLED=false`) + 1 dock local reclassé (`DesktopDockBar`) |
| Boutons bruts | 395 | **297** (admin back-office 66, staging/dev, pages non réécrites) |

## Legacy supprimé (0 consommateur, preuves `find-dead-code.mjs` + `rg`)
`LkvButton`, `GlassCard`, `GlassIconButton`, `GlassModal`, `GlassSheet`, `PremiumBottomSheet`, `GlassDrawer`, `LkvChip`, `LkvSwitch`, `LkvInput`, `LkvCheckbox`, `LkvSelect`, `LkvTextarea`, `MediaUpload`, `BackButton`, `ScrollableTabs`, `IOSSegmentedControl`, `Sheet` legacy, `HubSectionPicker`, `BackgroundVideo`, `MobileProfilePage`, `HikingProfileCard`, `MoreMenuSheet`, `SocialActions`, `chevron-up` + 2 composants morts antérieurs.

## Exceptions (chemin + raison)
1. `CountryFlag.tsx:13-17` — rayons 2–6 px proportionnels (géométrie).
2. `useHubSwipeNav.ts:21` — `[role="dialog"]` = sélecteur d'exclusion de geste.
3. Overlays spécialisés tokenisés : `ImageViewer`, `StoriesViewer`, `MobileDrawer`, `SearchOverlay`, `TerrainLiveCockpitControl`, `AdventureCockpitControl`.
4. 251 hex techniques/données + `app/layout.tsx` / `NativeAppBootstrap` (meta/natif).
5. 125 inline statiques dans pages non réécrites (blog 21, evenements 19, dev 14, outils 7, pro 7…) — dette Lot 7.
6. `app/admin/**` back-office : 14 hex, 46 inline, 66 `<button>` — hors front utilisateur.
7. 46 paires desktop/mobile justifiées (UX réellement distincte).

## Tests
`type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ 407 fichiers / **2 947 tests** (27 skipped) · `build` ✅ 11,0 s · `verify:invariants` ✅ 6/6 · **captures** : 60 par famille (`phase2-screenshots/lot6-famille1..9`). Aucun test supprimé.

## Dette Lot 7 (polish uniquement — aucune migration structurelle restante)
Polish visuel · motion/micro-interactions · QA fine (états, clavier, overlays) · accessibilité fine · validation iOS native/macOS (`IOS27_REFERENCE.md` §6) · performance · préparation prod · captures authentifiées (seed démo) · 125 inline statiques + back-office admin.

## Lots suivants

| Lot | Contenu | Statut |
|---|---|---|
| 6 | Familles 1-9 migrées + purge finale | **terminé** |
| 7 | Polish visuel, motion, QA fine, validation native | à faire |

## Risques / points ouverts

1. Le socle v2 n'est pas encore consommé par les pages : rendu global encore hétérogène (attendu).
2. Bottom bar web vs native : décision en attente de l'étude `BOTTOM_BAR_ARCHITECTURE.md` + SDK macOS.
3. Captures non authentifiées : la comparaison des pages connectées reste à compléter (seed démo).
4. Les tests de contraste `x6-accessibility.spec.ts` utilisent des constantes historiques (palette
   inchangée au lot 1) — à recâbler sur les tokens réels au lot 2.
