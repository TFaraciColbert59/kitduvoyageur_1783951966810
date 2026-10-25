# DESIGN TRUTH — Arbitrage des Valeurs & Source Unique (Chantier X)

> **Base :** `main` (`6ce8fc2b949d001ed7fc7b574309ab021ab939ed`)  
> **Branche :** `chantier/x-design-unique`  
> **Règle absolue :** Une seule déclaration littérale dans `src/styles/tokens.css`. Tout le reste n'est qu'alias `var()`, type dérivé ou utilitaire.

---

## 1. Couleurs Maîtresses & Sémantiques

| Token Canonique | Valeur Retenue | Valeurs Écartées | Déclarées dans | Justification de l'arbitrage |
|---|---|---|---|---|
| `--lkv-primary` | `#17402C` | `#0B1F17` (trop sombre), `#123323` | `tokens.css`, `tokens.ts`, `tailwind.css`, `country.css` | Vert forêt primaire officiel LKDV, contraste 10.4:1 sur fond blanc/crème. |
| `--lkv-primary-hover` | `#205238` | `#123323`, `#365233`, `#5A8A6A` | `tokens.css` (#123323), `tailwind.css` (#365233) | **Arbitrage imposé** : `tokens.ts` + `DESIGN_SYSTEM.md` concordent sur `#205238`. |
| `--lkv-primary-soft` | `#365233` | `#2D6B4A`, `#4A7C5B` | `tokens.ts` (#365233), `tailwind.css` | **Arbitrage imposé** : `tokens.ts` + `DESIGN_SYSTEM.md` concordent sur `#365233`. |
| `--lkv-primary-subtle` | `#EBF2EC` | `rgba(74,124,91,0.15)` | `tokens.css`, `tokens.ts`, `tailwind.css` | Teinte subtile claire pour badges et fonds d'états sélectionnés. |
| `--lkv-secondary` | `#5B7F55` | `#243028` (noirâtre), `#2D3830` | `tailwind.css` (#243028), `tokens.css` (#5B7F55) | Vert sauge d'action officiel LKDV. `#243028` était un vestige sombre hors charte. |
| `--lkv-secondary-hover` | `#486944` | `#2D3830` | `tokens.css`, `tokens.ts` | Hover naturel sur le vert sauge. |
| `--lkv-secondary-subtle` | `#F2F6F1` | `#EDEAE0` | `tokens.css`, `tokens.ts`, `tailwind.css` | Fond léger pour boutons secondaires et capsules. |
| `--lkv-surface` | `#FBFAF6` | `#F5F3EE`, `#FAF8F5` | `tailwind.css` (#F5F3EE), `tokens.ts` (#FAF8F5) | Surface crème papier officielle LKDV, immersion chaude Apple HIG. |
| `--lkv-surface-paper` | `#FAF8F5` | `#FFFFFF` | `tokens.ts`, `liquid-glass.css` | Fond des cartes Liquid Glass pour donner de la matière sous le verre. |
| `--lkv-surface-card` | `#FFFFFF` | `#F5F3EE`, `#243028` | `tokens.css`, `tailwind.css` | Fond des cartes opaques ou base du verre. |
| `--lkv-surface-elevated`| `rgba(255, 255, 255, 0.85)` | `#FFFFFF` | `tokens.css`, `tailwind.css` | Verre translucide surélevé Apple HIG. |
| `--lkv-surface-muted` | `#F1EDE6` | `#E0DDD0`, `#E9E4D9` | `tokens.css`, `tailwind.css`, `liquid-glass.css` | Fond neutre chaud pour séparateurs et zones inactives. |
| `--lkv-text-primary` | `#17402C` | `#1A1F1C`, `#14140F` | `tailwind.css` (#1A1F1C), `tokens.ts` (#14140F) | Titres et textes d'autorité en vert forêt profond (WCAG AAA). |
| `--lkv-text-secondary` | `#5B7F55` | `#5A574E`, `#384A42` | `tokens.ts` (#5A574E), `tailwind.css` | Sous-titres et libellés secondaires. |
| `--lkv-text-muted` | `#6B7568` | `#5C6B5E` (interdit D10), `#5A7064` | `tokens.css`, `country.css` (#5A7064) | Textes atténués, métadonnées, timestamps. Règle D10 : jamais `#5C6B5E`. |
| `--lkv-text-subtle` | `#8C8779` | `#AEB7B1`, `#8B978F` | `tokens.css`, `liquid-glass.css` | Libellés tertiaires et repères de navigation. |
| `--lkv-success` | `#5B7F55` | `#17402C`, `#065F46` | `tailwind.css` (#17402C), `DESIGN_SYSTEM.md` (#065F46) | **Arbitrage imposé** : `#5B7F55` (correction obligatoire de `tailwind.css` qui utilisait #17402C). |
| `--lkv-success-bg` | `#E1EBDE` | `#F2F6F1`, `#D1FAE5` | `tokens.css`, `tokens.ts`, `liquid-glass.css` | Fond sémantique pour badges de succès et coches d'équipements. |
| `--lkv-warning` | `#C89A3B` | `#78350F`, `#D97706` | `DESIGN_SYSTEM.md` (#78350F), Tailwind default | Or chaud d'avertissement terrain LKDV, sans agressivité. |
| `--lkv-warning-bg` | `#FBF1DC` | `#FEF3C7` | `tokens.css`, `tokens.ts`, `liquid-glass.css` | Fond d'avertissement chaud. |
| `--lkv-danger` | `#A8443A` | `#881337`, `#DC2626` | `DESIGN_SYSTEM.md` (#881337), Tailwind default | Alerte vitale, secours, urgence médicale (WCAG AA). |
| `--lkv-danger-bg` | `#F5DDD9` | `#FFE4E6` | `tokens.css`, `tokens.ts`, `liquid-glass.css` | Fond d'alerte vitale. |
| `--lkv-info` | `#4B6B7C` | `#3E6B7A`, `#2A5A6E` | `tailwind.css` (#3E6B7A), `tokens.ts` (#4B6B7C) | Information, cartographie, points d'eau, météo. |
| `--lkv-info-bg` | `#DDE7EE` | `#D4E8EE` | `tokens.css`, `tokens.ts`, `liquid-glass.css` | Fond d'information cartographique. |

---

## 2. Typographie & Polices

| Rôle | Police Retenue | Polices Écartées & Supprimées | Déclarées dans | Justification |
|---|---|---|---|---|
| **Body / Sans** | `DM Sans` (`var(--font-sans)`) | `Inter Tight`, `Inter`, `Helvetica Neue`, `system-ui` | `tailwind.css`, `country.css` | Seule police sans-serif chargée par `layout.tsx` (`subsets: ['latin']`). |
| **Display / Titres** | `Manrope` (`var(--font-display)`) | `SF Pro Display`, `Inter Tight` | `tailwind.css`, `country.css` | Seule police display chargée par `layout.tsx` (`weight: 400..800`). |
| **Monospace / Métriques**| `IBM Plex Mono` (`var(--font-mono)`) | `JetBrains Mono`, `SF Mono`, `Menlo` | `tailwind.css`, `tokens.ts` | Seule police mono chargée par `layout.tsx`. Suppression de JetBrains Mono. |
| **Serif / Éditorial** | `Instrument Serif` (`var(--font-serif)`)| `Cormorant Garamond`, `Playfair Display`, `Georgia` | `tailwind.css`, `tokens.ts` | Seule police serif chargée par `layout.tsx`. Suppression de Cormorant Garamond. |

---

## 3. Échelle Unifiée des Rayons (Démonstration du Delta Visuel Minimal)

### Analyse des données d'usage réelles (Audit `audit-radii.mjs`)
- **`/materiel` (Référence autorité Liquid Glass)** :
  - `rounded-xl` (101x) ➔ 26px dans `tailwind.config.js`
  - `rounded-full` (100x) ➔ 9999px
  - `rounded-2xl` (56x) ➔ 32px
  - `rounded-lg` (21x) ➔ 20px
  - `rounded-md` (12x) ➔ 14px
  - `rounded-[28px]` (7x) ➔ 28px (cartes principales du cockpit)
- **`/compte` (Référence profils et formulaires)** :
  - `rounded-full` (121x) ➔ 9999px
  - `rounded-2xl` (80x) ➔ 32px
  - `rounded-xl` (72x) ➔ 26px
  - `rounded-[1.25rem]` (47x) ➔ 20px (`lg`)
  - `rounded-3xl` (22x) ➔ 32px (`2xl`)
  - `rounded-[1.5rem]` (17x) ➔ 24px (`xl`)
- **`/pays` (Fiche pays & Globe 3D)** :
  - `rounded-full` (42x) ➔ 9999px
  - `rounded-xl` (34x) ➔ 26px
  - `rounded-2xl` (29x) ➔ 32px
  - `rounded-[1.75rem]` / `css: 28px` (14x) ➔ 28px (GlassCard et conteneurs)
  - `rounded-[1.5rem]` (14x) ➔ 24px (`xl`)

### Démonstration
Si l'on imposait l'ancienne échelle théorique 12/16/24px de `DESIGN_SYSTEM.md` :
- 101 cartes de `/materiel` sauteraient de 26px à 16px (-38% de courbure).
- Les cartes cockpits 28px s'aplatiraient à 24px.
- Le delta visuel Playwright serait massif.

À l'inverse, en adoptant l'échelle réelle compilée par `tailwind.config.js` et en y ajoutant le token canonique `--lkv-radius-card: 28px`, **le delta visuel sur les 3 surfaces est de 0 pixel** :

| Classe Tailwind | Token Canonique (tokens.css) | Valeur | Usage Dédié | Alias Liquid Glass / Tailwind |
|---|---|---|---|---|
| `rounded-xs` | `--lkv-radius-xs` | `6px` | Repères discrets, séparateurs | `--r-xs`, `--radius-xs` |
| `rounded-sm` | `--lkv-radius-sm` | `10px` | Badges, tags, puces | `--r-sm`, `--radius-sm` |
| `rounded-md` | `--lkv-radius-md` | `14px` | Inputs, sélecteurs, boutons compacts | `--r-md`, `--radius-md` |
| `rounded-lg` | `--lkv-radius-lg` | `20px` | Cartes compactes, boutons 44px HIG | `--r-lg`, `--radius-lg` |
| `rounded-xl` | `--lkv-radius-xl` | `26px` | Cartes moyennes, listes | `--r-xl`, `--radius-xl` |
| `rounded-card`| `--lkv-radius-card` | `28px` | Panneaux maîtres, GlassCard cockpit | `--r-2xl` |
| `rounded-2xl` | `--lkv-radius-2xl` | `32px` | Modales immersives, sheets supérieures | `--radius-2xl`, `--r-3xl` |
| `rounded-full`| `--lkv-radius-full` | `9999px`| Avatars, capsules, boutons circulaires | `--r-full`, `--radius-full` |

---

## 4. Durées et Mouvement (liquid-glass.css)

| Token | Valeur | Usage |
|---|---|---|
| `--dur-xfast` | `120ms` | Micro-interactions tactiles, hover, toggles |
| `--dur-fast` | `180ms` | Accordéons, transitions de badges |
| `--dur-med` | `280ms` | Navigation de panneaux, onglets |
| `--dur-slow` | `420ms` | Ouverture de sheets, transitions de pages |
| `--ease-glass` | `cubic-bezier(0.22, 1, 0.36, 1)` | Courbe amortie authentique Apple HIG |

---

## 5. Élévations & Ombres

| Token | Valeur | Usage |
|---|---|---|
| `--elevation-1` | `0 2px 8px rgba(23,64,44,0.04), 0 1px 2px rgba(23,64,44,0.03)` | Cartes au repos sur fond crème |
| `--elevation-2` | `0 4px 16px rgba(23,64,44,0.06), 0 2px 4px rgba(23,64,44,0.04)` | Cartes survolées, blocs interactifs |
| `--elevation-3` | `0 8px 32px rgba(23,64,44,0.08), 0 4px 8px rgba(23,64,44,0.05)` | Menus déroulants, barres flottantes |
| `--elevation-4` | `0 16px 48px rgba(23,64,44,0.12), 0 8px 16px rgba(23,64,44,0.06)` | Modales, bottom sheets |
| `--glass-depth-inset` | `inset 0 1px 1px rgba(255,255,255,0.75)` | Biseau de lumière sur bord supérieur de verre |

---

## 6. Décision sur le Mode Sombre
- **Constat** : `/materiel` et `/pays` ne définissent aucun style sombre. `tokens.css` n'a pas de variantes `.dark`. Le bloc `.dark` de `tailwind.css` réécrivait `--primary` en `#4A7C5B` en contradiction frontale avec la charte LKDV.
- **Décision d'arbitrage** : Stratégie unifiée = **Mode Clair seul**, palette organique vivante (vert forêt, sauge, crème, roche). Le bloc `.dark` contradictoire de `tailwind.css` est supprimé pour éliminer tout risque de bascule involontaire sur des couleurs dégradées.
