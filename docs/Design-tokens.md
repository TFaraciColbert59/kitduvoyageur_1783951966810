# Design System LKDV — Source de vérité unique

> **La page « Mon Matériel » (`/materiel`) est la référence frontend canonique.**
> Tout nouveau composant ou page DOIT reproduire son rendu (Liquid Glass, iOS 26 / WWDC 2025).
> Ce document est la seule source de vérité des tokens, classes et conventions.
> **Version 2.0 — mise à jour après la refonte de la page pays détail (Tabs fullscreen).**

## 1. Palette officielle (valeurs réellement affichées)

Le thème `[data-lkv-material-theme="light"]` (défini dans `liquid-glass.css`) est le rendu de référence.

| Rôle | Token / valeur | Usage |
|---|---|---|
| Texte principal | `--label` = **`#17402C`** | Titres, valeurs, icônes |
| Texte secondaire | `--label-secondary` = **`#365233`** | Libellés de section, sous-textes |
| Texte tertiaire | `--label-tertiary` = **`#5A7064`** | Captions, compteurs, placeholders |
| Fond clair | stone-50 `#FAF8F5` / papier `#FBFAF6` | Fonds de page |
| Verre | blanc translucide (3–18 %) + blur 6–16px + bord `rgba(255,255,255,0.35)` | Cartes GlassCard |
| Sage (primaire) | `--sage-500` = **`#5B7F55`** · sage-300 `#A6C1A0` · sage-700 `#365233` | Accents, remplissages, badges |
| Warn | `--warn` = **`#C89A3B`** (texte `#8C6418`) | Alertes, vigilance |
| Danger | `--danger` = **`#A8443A`** (texte `#8A241B`) | Critiques, suppressions |
| Info | `--info` = **`#4B6B7C`** | Compléments |
| Ombres | base ink `rgba(23,64,44,…)` — jamais noir pur | Élévations 1→5 |

### Interdictions strictes

| Couleur | Raison |
|---|---|
| `#E4501C` / orange | Palette héritée obsolète — **interdite partout** |
| `#1C2620` | Ancien ink — remplacé par `#17402C` |
| `#2D5A3D` / `#0d1a12` / `#0d1a14` | Anciens verts forêt sombres |
| `#9B2C2C` / `#8C6A1A` / `#2D6B4A` / `#7FA97A` / `#A3C4A3` | Anciennes sémantiques / tokens parallèles |
| `#1B4332` (`--lkv-forest-800` parallèle) | Écart de marque — la marque est `#17402C` |
| `#0F2D1F`, `#E53E3E`, `#C53030`, `#82C39B` | Boutons/états réinventés hors design system |
| `#0B1F17` | Ancien ink parallèle — remplacer par `#17402C` |
| `rgba(11,31,23,…)` | Base ink obsolète — utiliser `rgba(23,64,44,…)` |
| `bg-white/60`, `bg-white/90` (Tailwind inline) | Utiliser la **card blanche DS** (`rgba(255,255,255,0.92)`) ou `.glass` |
| Classes Tailwind par défaut (`emerald-*`, `amber-*`, `rose-*`, `red-*`, `gray-*`) | Utiliser les tokens sage/warn/danger |

## 2. Classes design system (obligatoires)

| Classe | Usage | Définition clé |
|---|---|---|
| `.glass` | Toute surface verre (cartes, capsules, inputs) | fond blanc translucide + `blur(10px) saturate(150%)` + bord blanc 0.32 + rim light (::before/::after) + elevation |
| `.glass-sub-card` | Sous-cards / micro-widgets | fond blanc 0.08, bord 0.35, radius `--r-md` 16px, **sans blur** (évite le double flou) |
| `.glass-capsule-btn` | Boutons pilule | **rendu réel = « engraved » sage translucide** (fond sage-300 24 % + blanc, texte `#365233`, sans lévitation) |
| `.glass-capsule-bar` | Barre segmentée | pill blanc translucide, blur 28px |
| `.glass-capsule-segment` (+`.active`) | Segments | fond blanc .75→.45 quand actif |
| `.glass-pill` (+`.pill-warn/danger/info`) | Pills tags/badges | sage-500 15 %, texte sage-700 |
| `.glass-input` | Inputs | min-height 44px, radius r-md 16px, fond glass, focus ring sage |
| `.glass-metric` / `.glass-eyebrow` / `.glass-caption` / `.glass-progress` | Métriques / labels / captions / progress | définis dans `liquid-glass.css` |
| `.glass-check-circle` (+`.checked`) | Cases à cocher | coche blanche sur rond sage quand checked |

**Composants React partagés** (à préférer aux styles inline) : `GlassCard`, `Badge` (tones sage/warn/danger/info/stone), `Eyebrow`, `Metric`, `ProgressBar` (tones sage/warn/danger — palette LG), `Skeleton`, `EmptyState`, `LkvIcon`, `GlassSheet`, `GlassDrawer`.

## 3. Card blanche (lisibilité sur fond vidéo / décor animé)

Convention introduite avec la refonte pays : tout texte posé **à nu sur un fond vidéo ou un décor animé** DOIT reposer sur une **card blanche**.

| Propriété | Valeur |
|---|---|
| Fond | `rgba(255,255,255,0.92)` |
| Bord | `1px solid rgba(255,255,255,0.60)` |
| Radius | `12px` (blocs texte) / `9px` (labels, valeurs, kickers) |
| Padding | `6px 10px` (blocs) / `2px 7px` (compacts) |
| Ombre | **AUCUNE** (ni externe ni inset) — surface plate |

**Règle d'or** : ne JAMAIS poser de card blanche sur une surface déjà verre (`.glass`/`.glass-sub-card` — double card interdit). Les textes dans une card verre restent transparents (le verre porte le fond). Les éléments **décoratifs** (`em`, numéros, icônes, `.n`) ne reçoivent jamais de card.

## 4. Verre renforcé (texte nu sur verre)

Quand un texte doit être lisible sans card blanche mais que le verre standard (0.03) est trop transparent :

| Propriété | Valeur |
|---|---|
| Fond | `rgba(255,255,255,0.12)` |
| Blur | `blur(12px) saturate(150%)` |

Exemple : `.cult-fact` (faits culturels sur fond vidéo).

## 5. Fullscreen — page = 100dvh, aucun scroll de page

**Toutes les pages modernes (desktop ≥ 768px) :**

| Règle | Valeur |
|---|---|
| Conteneur de page | `height: 100dvh; overflow: hidden` |
| Layout principal | `grid` ou `flex` occupant 100 % de la hauteur |
| Contenu riche (articles, listes, avis) | **scroll interne** : `overflow-y: auto` sur la zone de contenu uniquement |
| Centrage | `display: flex; margin: auto` sur l'enfant → **haut = bas** (marge symétrique) |
| Hauteurs de sections | condension systématique (typo/padding) pour tenir sans scroll |
| Listes longues | limiter l'affichage (`slice(0, N)`) ou scroll interne |
| Laptops | `@media (max-height: 800px)` : condensation supplémentaire |

**Mobile (< 768px)** : scroll natif autorisé (contenu riche), le fullscreen s'applique au desktop.

## 6. Layout Tabs pays (pattern réutilisable)

| Règle | Valeur |
|---|---|
| Grid | `minmax(0,15fr) minmax(0,85fr)` — **nav à GAUCHE**, contenu à DROITE |
| Nav | verre (`blur(28px) saturate(200%)`), sticky, `max-height: calc(100dvh - 48px)`, items pill centrés |
| Onglet actif | dégradé blanc `.75→.45` + texte Ink, **sans ombre externe** |
| Contenu | centré par `margin: auto`, `width: 100%` |
| Numéros/titres de nav | **interdits** (labels seuls) |

## 7. Ombres — règles strictes

| Surface | Ombre |
|---|---|
| Cards principales (dest-card photo, globe wrapper, `.glass`/`GlassCard`) | Élévation autorisée (ex. `0 16px 40px -20px rgba(23,64,44,0.25)`) |
| Surfaces internes (cards blanches, pills, labels, valeurs, onglets actifs, nav, capsules) | **AUCUNE ombre externe, AUCUN inset** — surface plate |
| Inset highlight verre | Autorisé uniquement sur les surfaces verre DS (`.glass`, `.glass-capsule-bar`) |

## 8. Conventions typographiques

| Élément | Pattern |
|---|---|
| Eyebrow (sur-titre) | `Eyebrow` composant ou `.glass-eyebrow` : 11px uppercase, `letter-spacing 0.14em`, `--label-secondary` |
| Titre de carte / section | `text-[20–32px] font-display font-bold tracking-tight text-[#17402C]` |
| Valeur/métrique | `font-mono font-bold text-[#17402C]` (13–36px selon importance) |
| Label de section | `text-[10px] font-semibold uppercase tracking-wider text-[#5A7064]` |
| Caption | `text-[10–12px] text-[#5A7064]` |
| Paragraphe sur fond vidéo | card blanche (section 3), `text-[12–13px] line-height 1.4–1.5`, `#365233` |
| Padding carte | `p-5` (GlassCard) ; sous-card `p-2.5` à `p-3.5` |

## 9. Règles d'or (anti-régression)

1. **Jamais de tokens CSS parallèles** — ne JAMAIS recréer un `:root { --lkv-* }` local qui écrase les tokens globaux.
2. **Jamais de hex inline quand une classe DS existe** — utiliser `.glass`, `.glass-sub-card`, `.glass-capsule-*`, `.glass-pill`, `.glass-input` ou `GlassCard`/`Badge`/`Eyebrow`/`Metric`/`ProgressBar`.
3. **Jamais réinventer un bouton** — tout CTA = `.glass-capsule-btn`.
4. **Pas de `shop.css` sur les pages modernes** — classes legacy interdites.
5. **Sémantique danger unique** — importer `DANGER_META`/`DANGER_FILL` depuis `src/lib/pays/danger.ts`.
6. **Données réelles** — compteurs et stats lisent la donnée, jamais de chiffres hardcodés.
7. **Fullscreen** — page = 100dvh sans scroll de page (scroll interne pour le contenu riche).
8. **Cards blanches** — uniquement sur texte nu (fond vidéo/décor), jamais sur du verre.
9. **Ombres** — jamais d'ombre externe sur les surfaces internes (cards blanches, pills, onglets, nav).
10. **Vérification de conformité** (avant livraison d'une page) :

```bash
# Couleurs interdites dans la page :
rg -n "#E4501C|#1C2620|#2D5A3D|#0d1a12|#9B2C2C|#8C6A1A|#2D6B4A|#7FA97A|#A3C4A3|#1B4332|#0F2D1F|#0B1F17" src/app/<page> src/components/<page>
# → doit renvoyer 0 résultat

# Base ink obsolète :
rg -n "rgba\(11, 31, 23" src/app/<page>
# → 0 résultat (utiliser rgba(23,64,44,…))

# Cards blanches inline (équivalent Tailwind) :
rg -n "bg-white/60|bg-white/90"
# → 0 résultat (utiliser la card blanche DS ou .glass)

# Boutons maison (réinvention de CTA) :
rg -n "bg-gradient-to-b from-\[#17402C\]"
# → 0 résultat (utiliser .glass-capsule-btn)

# Fichiers fantômes (tokens parallèles, backups) :
find src -name "tokens.css" -o -name "*.bak" -o -name "*.old" -o -name "*-copy*"
```

## 10. Motion & accessibilité

- Transitions courtes (<300ms), `ease-glass`, `prefers-reduced-motion` respecté (auto-rotation globe coupée, animations décoratives désactivées).
- États actifs encodés par texte + couleur ; cibles tactiles ≥ 44px ; `aria-pressed` sur toggles ; focus-visible visible (ring sage).
- Urgences/sécurité : accent renforcé (Ink plein + Sage) pour les infos critiques (112/15, secours) — style neutre pour le confort.