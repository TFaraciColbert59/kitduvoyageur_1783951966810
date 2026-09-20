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

## Lots suivants (socle puis familles)

| Lot | Contenu | Statut |
|---|---|---|
| 2 | Safe-area unifiée, `AppShell`, `PageHeader`, navigation visuelle + étude bottom bar | à faire |
| 3 | Composants canoniques (Button, Card, Input, Sheet, Modal, Tabs, EmptyState, Spinner) | à faire |
| 4+ | Migration des pages par familles, avec comparaison baseline à chaque famille | à faire |

## Risques / points ouverts

1. Le socle v2 n'est pas encore consommé par les pages : rendu global encore hétérogène (attendu).
2. Bottom bar web vs native : décision en attente de l'étude `BOTTOM_BAR_ARCHITECTURE.md` + SDK macOS.
3. Captures non authentifiées : la comparaison des pages connectées reste à compléter (seed démo).
4. Les tests de contraste `x6-accessibility.spec.ts` utilisent des constantes historiques (palette
   inchangée au lot 1) — à recâbler sur les tokens réels au lot 2.
