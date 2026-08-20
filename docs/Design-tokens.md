# Design tokens — Mon Matériel (LKDV)

> Tokens visuels et conventions applicatives du cockpit « Mon Matériel ».

## Palette

| Token | Valeur | Usage |
|---|---|---|
| `--lkv-paper` | `#FBFAF6` | Fond de base clair |
| `--mm-paper` | `#F5F3EE` | Fond cockpit |
| Encre | `#1C2620` | Texte principal / bordures |
| Forest | `#17402C` / `#2D5A3D` | Accents primaires, boutons |
| Sage | `#A3C4A3` / `#2D6B4A` | Teintes secondaires, fonds doux |
| Ambre | `#8C6A1A` | Avertissements, alertes warning, usure |
| Danger | `#9B2C2C` | Critiques, blocants, suppressions |
| Info | `#3E6B7A` | Compléments d'information |

**Interdiction** : `#E4501C` / orange dans les nouveaux composants (palette héritée obsolète).

## Verre (GlassCard)

- Fond : `rgba(255,255,255,0.55)` + `backdrop-blur(40px) saturate(1.5)`
- Liseré : `border-white/70` + `border-[#1C2620]/7..10`
- Reflet supérieur blanc (`rgba(255,255,255,0.6) → transparent`) + inner highlight
  `inset 0 1px 0 rgba(255,255,255,0.85)`
- Ombre : `0 24px 60px -24px rgba(11,31,23,0.22)`
- Variante « carte » : `bg-white/60 border-[#1C2620]/7` (listes, tuiles pleine page)

## Typographie

- Sans : DM Sans (`--font-sans`) · Display : Manrope (`--font-display`) · Mono : IBM Plex Mono (`--font-mono`)
- Plancher `text-xs` (≥ 12 px) pour le texte secondaire (contraste WCAG AA sur papier clair)

## Motion

- Grille : `Reorder` framer-motion, spring `{ stiffness: 400, damping: 32 }`, drag élastique 0.12
- Fullscreen : shared-element `layoutId="lkdv-exp-{id}"`, transition spring douce
- États : boutons `active:scale-95`, progression `transition-all duration-500`
- **`prefers-reduced-motion: reduce`** → animations coupées (fond figé sur poster, transitions désactivées)

## Accessibilité

- États actifs encodés par **texte**, pas uniquement la couleur (badges + libellés).
- Cibles tactiles ≥ 44 px, focus trap dans les fullscreens, `aria-label` explicites,
  `aria-pressed` sur les toggles, rôles sur les handles de drag.
- Dark mode : `colorScheme` supporté globalement ; le cockpit est conçu clair (hors périmètre sombre).

## Données

Politique stricte : **aucun mock présenté comme réel**. Les widgets lisent Supabase (RLS)
ou des projections pures du domaine sur des données réellement chargées. Les exports CSV
génèrent des blobs côté client (aucun serveur de fichier nécessaire).