# AUDIT DES SOURCES DE DESIGN — CHANTIER U (U0 : cartographie exhaustive)

> Date : 07/09/2026 · Base : main `6ce8fc2` · Branche : `chantier/u-unification-design`
> Méthode : extraction par script node (hex/rayons/polices/durées/ombres), absence de
> toute modification de style. La gouvernance DESIGN_SYSTEM.md existe et n'est PAS appliquée.

---

## 1. Les six (ou plus) sources de style

| Source | Taille (o) | Rôle déclaré |
|---|---|---|
| `src/design/tokens.ts` | 3 264 | Tokens TS (palette) |
| `src/styles/tokens.css` | 3 528 | **Source canonique de valeurs (voulu)** |
| `src/styles/liquid-glass.css` | 36 609 | Recettes verre/ombres/mouvement |
| `src/styles/tailwind.css` | 22 822 | Couche utilitaire via `@theme` (Tailwind v4) |
| `src/app/pays/styles/country.css` | 48 568 | **Shell 3 colonnes /pays (LOCAL à la route)** |
| `src/app/pays/styles/earth.css` | 5 639 | Globe /pays |
| `tailwind.config.js` | — | Config utilitaire (couches, ombres nommées, radius) |

Note : `tailwind.config.ts` n'existe pas ; `tailwind.config.js` oui (équivalent).

---

## 2. Couleurs — doublons exhaustifs

Résultat du script `hex-dup` : **32 couleurs partagées entre ≥ 2 fichiers**.

Les pires multi-déclarations :

| Couleur | Déclarée dans (nb) | Valeur canonique DESIGN_SYSTEM.md |
|---|---|---|
| `#17402c` (Forest) | **6** fichiers (tokens.ts, tokens.css, liquid-glass, tailwind.css, country.css, earth.css) | `#17402C` |
| `#5b7f55` (Sage) | **5** (tokens.ts, tokens.css, liquid-glass, tailwind.css, country.css) | `#5B7F55` |
| `#a6c1a0` (Sage subtle) | **5** (tokens.ts, liquid-glass, tailwind.css, country.css, earth.css) | `#A6C1A0` |
| `#365233` (Forest soft) | **5** (tokens.ts, liquid-glass, tailwind.css, country.css, earth.css) | `#365233` |
| `#c89a3b` (Warning) | **5** (tokens.ts, tokens.css, liquid-glass, tailwind.css, country.css) | `#C89A3B` |
| `#fbfaf6` / `#faf8f5` (Stone/Paper) | 5 / 4 | `#FAF8F5`, `#FBFAF6` |
| `#a8443a`, `#4b6b7c`, `#dde7ee`, `#e1ebde`, `#f5ddd9` | 3-4 | — |

**Contradictions de palette directement observables :**
- DESIGN_SYSTEM.md dit Forest hover `#205238` / soft `#365233` ; `tokens.css` (3 528 o) déclare `--lkv-primary-hover:#123323` et **jamais** `#205238`/`#365233`.
- DESIGN_SYSTEM.md : `--danger-bg #F5DDD9`, `--warn-bg #FBF1DC` ; ces valeurs sont présentes mais dispersées.
- `liquid-glass.css` porte des couleurs **orphelines** non dans la gouvernance : `#e4501c` (orange interdit !), `#be123c`, `#e11d48` (rose/rouge), `#1e1e17`, `#235039`, `#23503b`, `#255c40`, `#2f7050`.

---

## 3. Rayons — 4 échelles concurrentes (contradiction la plus dure)

| Source | Valeurs (px) |
|---|---|
| DESIGN_SYSTEM.md (§1, /materiel) | **12 / 16 / 24 / rounded-full** |
| `src/styles/tokens.css` | 6, 10, 14, **20**, 24, **26, 32**, 9999 |
| `src/styles/tailwind.css` | 4, 8, **12, 16, 24**, 32, 9999 |
| `tailwind.config.js` border-radius | xs 6, sm 10, md 14, lg 20, xl 26, 2xl 32, full |
| `GlassCard.tsx` | `rounded-[28px]` **en dur** (ni dans DESIGN_SYSTEM, ni dans tokens) |

Le code déclare donc **20 / 24 / 28 / 12 / 16 / 26 / 32** px, alors que DESIGN_SYSTEM fixe **12 / 16 / 24**.
`tailwind.css` est le plus proche de la gouvernance (12/16/24) ; `tokens.css` et `tailwind.config.js` divergent.

---

## 4. Polices — deux mondes

| Source | Déclaration |
|---|---|
| `src/design/tokens.ts` / `tailwind.css` / `tailwind.config.js` | **DM Sans**, **Manrope**, **IBM Plex Mono**, **Instrument Serif** (next/font, `--font-sans/display/mono/serif`) |
| `src/styles/liquid-glass.css` | `--font-display: "Inter Tight"`, `--font-body: "Inter"` |
| `country.css` | `--font-sans`, `--font-display`, Georgia |
| `layout.tsx` (basé V) | charge DM Sans, Manrope, IBM Plex Mono, Instrument Serif |

**Contradiction** : liquid-glass.css déclare Inter/Inter Tight alors que le site charge l'autre famille ; sur la base 6ce8fc2 (chantier V non mergé), les variables `--font-display/-body` ne sont pas recâblées sur les variables next/font (le fix V0.4 n'est PAS dans main).

---

## 5. Durées, ombres, espacements

| Catégorie | Déclaré dans | Valeurs |
|---|---|---|
| Durées `--dur-*` | liquid-glass.css uniquement | xfast 120, fast 180, med 280, slow 420, xslow 800 ms |
| Ombres élevation | liquid-glass.css | `--elevation-1..5`, `--glass-depth-inset` |
| Ombres utilitaires | tailwind.css (et tailwind.config.js) | `--shadow-xs/sm/md/lg/xl/2xl` |

Pas de contradiction d'ombres/durées entre fichiers (les élévations et durées ne vivent que dans liquid-glass; les shadows nommées dans tailwind). Cohérence relative ici.

---

## 6. Usages réels (pour prioriser U3)

Le plus grand nombre de littéraux est dans : `/pays` (country.css 48 568 o, earth.css 5 639 o),
puis `/voyages` (chantier V — divergence visuelle), puis les composants UI. Sur la base 6ce8fc2,
le module `/voyages` n'a PAS encore convergé (le chantier V n'a pas été merge). C'est donc le
chantier qui doit converger vers la référence `/materiel` (et non l'inverse).

---

## 7. Verdict U0

- **Doublons massifs** : 32 couleurs partagées (jusqu'à 6 lieux), rayons 4 échelles, polices 2 mondes.
- **Contradictions directes avec DESIGN_SYSTEM.md** : rayons (tokens 20/26/32), hover Forest (`#123323` vs `#205238`), absence des valeurs officielles dans tokens.css.
- **Violation orange** : `#e4501c` interdite, présente dans liquid-glass.css.
- **Le vrai défaut** : la gouvernance existe (#3 DESIGN_SYSTEM.md) mais n'est pas appliquée — aucun test ne l'impose (il n'existe pas de garde-fou U-D60-D64 aujourd'hui).

**Décision d'architecture (U1)** : `tokens.css` = unique déclaration de valeurs ; `tokens.ts` dérivé ou supprimé (grep usages) ; `liquid-glass.css` conserve recettes + alias vers tokens ; `tailwind.css` expose via `@theme` sans redéfinir ; `country.css`/`earth.css` vidés des littéraux ; rayons à réconcilier vers DESIGN_SYSTEM (12/16/24) avec preuve de non-régression /pays·/materiel·/compte.

### Complément — usages réels de `tokens.ts` (grep preuve, pour U1)

`src/design/tokens.ts` n'est PAS orphelin :
- `src/components/ui/LkvButton.tsx` : `import { colors, transition } from '@/design/tokens'`
- `src/app/preparer-randonnee/PreparationClient.tsx` : `import './design/tokens.css'` (tokens.css importé via ce chemin)
- Exports : `colors`, `typography`, `spacing`, `radius`, `forest`, `sage`, `stone`, `ink`, `paper`, `shadows`, `transition`.

**Conséquence U1** : suppression de tokens.ts = arrêt (point d'arrêt dur §6, casse LkvButton).
Décision : tokens.ts devient un **dérivé** (généré depuis tokens.css) ou est conservé en tant que
miroir typé aligné — en aucun cas une source de valeurs indépendante. La valeur gagnante reste
celle de tokens.css.