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

## Lots suivants

| Lot | Contenu | Statut |
|---|---|---|
| 4+ | Migration des pages par familles (avec bascule des primitives legacy), comparaison baseline à chaque famille | à faire |

## Risques / points ouverts

1. Le socle v2 n'est pas encore consommé par les pages : rendu global encore hétérogène (attendu).
2. Bottom bar web vs native : décision en attente de l'étude `BOTTOM_BAR_ARCHITECTURE.md` + SDK macOS.
3. Captures non authentifiées : la comparaison des pages connectées reste à compléter (seed démo).
4. Les tests de contraste `x6-accessibility.spec.ts` utilisent des constantes historiques (palette
   inchangée au lot 1) — à recâbler sur les tokens réels au lot 2.
