# LKDV — Direction visuelle (P5)

Phase P5 du programme « Progression canonique et direction mobile » — spec
`docs/superpowers/specs/2026-09-19-lkdv-progression-canonique-direction-mobile-design.md` §6,
dossier de lancement « Direction visuelle mobile ». Branche : `feat/mobile-direction-progression`.

Objectif : appliquer la direction **via les tokens centraux** (clair + sombre complet),
sans réécrire les composants métier.

---

## 1. Contrastes mesurés (WCAG 2.2)

Script : `scripts/audit/visual-contrast.mjs` (`npm run audit:contrast`).
Il lit les valeurs réellement déclarées dans `src/styles/tokens.css`, compose les
couches translucides (verre, frontières rgba) sur leur fond et échoue si une paire
passe sous 4,5:1 (texte courant) ou 3:1 (grand texte / UI).

Exécution sur le commit de P5 : **42/42 paires conformes**.

| Mode | Paire | Ratio mesuré | Seuil |
|---|---|---:|---:|
| Clair | `#172B24` / `#F5F7F3` (texte principal / fond) | 13,84:1 | 4,5 |
| Clair | `#172B24` / `#FFFFFF` (texte principal / carte) | 14,92:1 | 4,5 |
| Clair | `#56665D` / `#F5F7F3` (texte secondaire / fond) | 5,64:1 | 4,5 |
| Clair | `#56665D` / `#FFFFFF` (texte secondaire / carte) | 6,08:1 | 4,5 |
| Clair | `#5C6B62` / `#F5F7F3` (texte discret / fond) | 5,22:1 | 4,5 |
| Clair | `#65736A` / `#F5F7F3` (texte subtil / fond) | 4,62:1 | 4,5 |
| Clair | `#226148` / `#F5F7F3` (action texte/icône / fond) | 6,78:1 | 4,5 |
| Clair | `#226148` / `#FFFFFF` (action texte/icône / carte) | 7,31:1 | 4,5 |
| Clair | `#FFFFFF` sur `#226148` (texte / bouton plein) | 7,31:1 | 4,5 |
| Clair | `#172B24` / `#D3EBD9` (texte / accent doux) | 11,83:1 | 4,5 |
| Clair | `#A8443A` / `#FDE8E6` (danger / fond danger) | 5,03:1 | 4,5 |
| Clair | `#8C6418` / `#FBF1DC` (avertissement / fond) | 4,74:1 | 4,5 |
| Clair | `#4B6B7C` / `#DDE7EE` (info / fond) | 4,53:1 | 4,5 |
| Clair | `#5B7F55` / `#E1EBDE` (succès / fond, UI) | 3,72:1 | 3 |
| Clair | contenu de carte `#172B24` / verre blanc 55 % composé sur `#F5F7F3` | 14,43:1 | 4,5 |
| Clair | texte secondaire du verre (rgba 23,43,36,0.74) / verre composé | 6,29:1 | 4,5 |
| Clair | contenu de bouton / verre blanc 72 % composé | 14,61:1 | 4,5 |
| Clair | frontière forte (rgba 23,43,36,0.52) / fond composé (UI) | 3,19:1 | 3 |
| Clair | frontière forte / carte composée (UI) | 3,26:1 | 3 |
| Clair | focus `#226148` / fond (UI) | 6,78:1 | 3 |
| Sombre | `#F1F5F1` / `#101C17` (texte principal / fond) | 15,89:1 | 4,5 |
| Sombre | `#F1F5F1` / `#1B2D24` (texte principal / carte) | 13,18:1 | 4,5 |
| Sombre | `#C2CFC8` / `#101C17` (texte secondaire / fond) | 10,87:1 | 4,5 |
| Sombre | `#C2CFC8` / `#1B2D24` (texte secondaire / carte) | 9,02:1 | 4,5 |
| Sombre | `#A9B8B0` / `#101C17` (texte discret / fond) | 8,47:1 | 4,5 |
| Sombre | `#8A9A91` / `#101C17` (texte subtil / fond) | 5,92:1 | 4,5 |
| Sombre | `#7FC49A` / `#101C17` (action texte/icône / fond) | 8,55:1 | 4,5 |
| Sombre | `#7FC49A` / `#1B2D24` (action texte/icône / carte) | 7,09:1 | 4,5 |
| Sombre | `#08150F` sur `#7FC49A` (texte / bouton plein) | 9,13:1 | 4,5 |
| Sombre | `#F1F5F1` / `#24382C` (texte / accent doux) | 11,37:1 | 4,5 |
| Sombre | `#EFA096` / `#3A211E` (danger / fond danger) | 7,16:1 | 4,5 |
| Sombre | `#E4C27A` / `#3A2F1B` (avertissement / fond) | 7,67:1 | 4,5 |
| Sombre | `#9FC4D4` / `#1D2F38` (info / fond) | 7,47:1 | 4,5 |
| Sombre | `#8FC7A4` / `#1E3327` (succès / fond, UI) | 6,98:1 | 3 |
| Sombre | contenu de carte / verre sombre 10 % composé | 11,94:1 | 4,5 |
| Sombre | texte secondaire du verre (rgba 241,245,241,0.74) / verre composé | 7,30:1 | 4,5 |
| Sombre | contenu de bouton / verre blanc 14 % composé | 10,42:1 | 4,5 |
| Sombre | frontière forte (rgba 241,245,241,0.42) / fond composé (UI) | 3,80:1 | 3 |
| Sombre | frontière forte / carte composée (UI) | 3,58:1 | 3 |
| Sombre | focus `#7FC49A` / fond (UI) | 8,55:1 | 3 |

Aucune adaptation de valeur n'a été nécessaire après la première exécution : la
palette du dossier passe les seuils telle quelle, une fois les états complétés.

## 2. Palette finale (hex exacts)

### Clair (`:root`, `src/styles/tokens.css`)

| Rôle | Token | Hex / valeur |
|---|---|---|
| Fond applicatif + toile | `--lkv-surface` / `--lkv-app-bg-fallback` | `#F5F7F3` |
| Surface de carte / papier | `--lkv-surface-card`, `--lkv-surface-paper`, `--lkv-surface-elevated` | `#FFFFFF` |
| Surface atténuée / survol | `--lkv-surface-muted` / `--lkv-hover-surface` | `#EDF1EA` / `#E7EDE6` |
| Texte principal | `--lkv-text-primary` | `#172B24` |
| Texte secondaire | `--lkv-text-secondary` | `#56665D` |
| Texte discret / subtil | `--lkv-text-muted` / `--lkv-text-subtle` | `#5C6B62` / `#65736A` |
| Titres de marque (verrou test) | `--lkv-primary` | `#17402C` |
| Action (boutons, liens, focus) | `--lkv-action` | `#226148` |
| Action survol | `--lkv-action-hover` | `#1B4F3A` |
| Accent doux | `--lkv-primary-subtle` / `--lkv-action-soft` | `#D3EBD9` |
| Texte sur action | `--lkv-on-action` | `#FFFFFF` |
| Bordures | `--lkv-border` / `-subtle` / `-strong` | rgba(23,43,36, .14 / .07 / .52) |
| Champs | `--lkv-field-bg` / `--lkv-field-border` | `#FFFFFF` / rgba(23,43,36,0.22) |
| Désactivé | `--lkv-disabled-bg` / `--lkv-disabled-text` | `#E7EBE5` / `#7C8A80` |
| Statuts | danger `#A8443A` · warning `#C89A3B` (`-dark` `#8C6418`) · info `#4B6B7C` · succès `#5B7F55` | |

### Sombre (`.dark`, mêmes fichiers de tokens)

| Rôle | Token | Hex / valeur |
|---|---|---|
| Fond applicatif + toile | `--lkv-surface` / `--lkv-app-bg-fallback` | `#101C17` |
| Surface de carte | `--lkv-surface-card` | `#1B2D24` |
| Surface élevée / atténuée | `--lkv-surface-elevated` / `--lkv-surface-muted` | `#1F3328` / `#182A21` |
| Texte principal | `--lkv-text-primary` | `#F1F5F1` |
| Texte secondaire | `--lkv-text-secondary` | `#C2CFC8` |
| Texte discret / subtil | `--lkv-text-muted` / `--lkv-text-subtle` | `#A9B8B0` / `#8A9A91` |
| Marque / action | `--lkv-primary` / `--lkv-action` | `#7FC49A` |
| Action survol | `--lkv-action-hover` | `#9AD4B1` |
| Accent doux | `--lkv-primary-subtle` / `--lkv-action-soft` | `#24382C` |
| Texte sur action | `--lkv-on-action` | `#08150F` |
| Bordures | `--lkv-border` / `-subtle` / `-strong` | rgba(241,245,241, .16 / .08 / .42) |
| Champs | `--lkv-field-bg` / `--lkv-field-border` | `#16251D` / rgba(241,245,241,0.28) |
| Désactivé | `--lkv-disabled-bg` / `--lkv-disabled-text` | `#1F2E26` / `#7E8C84` |
| Statuts | danger `#EFA096` · warning `#E4C27A` · info `#9FC4D4` · succès `#8FC7A4` | |

Le verre, les cartes (`--card-*`) et les boutons (`--btn-*`) sont **surdéfinis dans `.dark`** :
contenu de verre clair/sombre, repli opaque `#1B2D24`, action claire `#7FC49A` avec contenu
encre `#08150F`, ombres renforcées. Aucun état n'est laissé à l'inversion du fond seul.

## 3. Espacements, rayons, typographie

- **Espacements** : échelle `4/8/12/16/24/32` (`--space-1`, `2`, `3`, `4`, `6`, `8`) ;
  marque d'écran `--lkv-screen-margin: 16px` + utilitaire `.lkv-screen-x` qui respecte
  les safe areas (`max(16px, env(safe-area-inset-*))`).
- **Rayons** : `12/16/24` (`--lkv-radius-sm/md/lg`), `--lkv-radius-card: 24px`,
  `--glass-radius-sm/md/lg: 12/16/24`, config Tailwind alignée ; `xs: 6px` conservé pour
  les micro-éléments, `full` pour les pilules de filtres/étiquettes.
- **Typographie** : corps `1rem` (`--lkv-text-body`, `font-size` du `body`), secondaire
  `0,875rem`, titres `1,375rem` (22) à `1,75rem` (28) ; tout est en `rem`, le texte agrandi
  navigateur est pris en charge. Utilitaires `.text-lkv-body`, `.text-lkv-body-sm`,
  `.text-lkv-title-sm`, `.text-lkv-title-lg`.
- **Chiffres tabulaires** : `--lkv-font-numeric: tabular-nums`, appliqué à `.font-mono-data`,
  `.mono-data` et à l'utilitaire `.lkv-tabular-nums` (compteurs, points, rangs).
- **Mouvement** : durées 120–220 ms conservées (`--dur-xfast` 120, `--lkv-dur` 220) et
  `prefers-reduced-motion` déjà globalement respecté.

## 4. Verre et topographie

- **Verre clair réservé aux surfaces superposées** : aucun `.glass` ajouté aux cartes de
  contenu ; les cartes existantes deviennent des surfaces claires (blanc 55 % + flou,
  contenu sombre) au lieu du verre blanc-sur-marbrure. Les boutons en verre deviennent
  des surfaces claires à contenu sombre ; le bouton plein est l'action `#226148`.
- **Topographie atténuée** : `.lkv-app-background` superpose une teinte
  `--lkv-app-bg-tint` (rgba(245,247,243,0.90) en clair, rgba(16,28,23,0.90) en sombre)
  à `app-background.jpg`. L'image reste présente comme texture (~10 %), mais le texte
  essentiel ne repose jamais sur un contraste variable ; en mode contraste renforcé /
  transparence réduite, les replis opaques existants prennent le relais.
- **Bornes non-textuelles** : `--lkv-border-strong` composé atteint ≥ 3:1 sur fond et carte
  (mesuré 3,19 / 3,26 clair, 3,80 / 3,58 sombre) — un séparateur pâle n'est jamais la seule
  frontière d'un contrôle.

## 5. Câblage du mode sombre

- **Plus de verrouillage clair** : l'ancien `colorScheme: 'light'` inline et les couleurs
  codées en dur (`bg-[#1C3B2A]`, `text-[#17402C]`) ont été retirés de `src/app/layout.tsx`.
- **Respect du système + classe `.dark`** : un script inline dans `<head>` lit
  `localStorage.theme` (choix explicite) puis `prefers-color-scheme`, applique la classe
  `.dark` sur `<html>` avant la peinture (anti-flash) et règle `colorScheme`.
- **`ThemeToggle`** (`src/components/ui/ThemeToggle.tsx`) a été aligné sur ce mécanisme
  (classe `.dark` + `data-theme` + `localStorage`). Il n'est monté sur aucune route
  aujourd'hui : le mode sombre suit donc le système par défaut, et le composant est prêt
  à être placé (Réglages) sans re-travail.
- **Vérifié en navigateur (Chromium, script extrait de `layout.tsx`)** : système sombre →
  `.dark` + `data-theme="dark"` + `colorScheme: dark` ; système clair → clair ; choix
  `localStorage` `dark` sur système clair → sombre ; choix `light` sur système sombre →
  clair. 4/4 cas conformes.
- `viewport.themeColor` déclare les deux schémas (`#F5F7F3` clair, `#101C17` sombre) et
  `colorScheme: 'light dark'`.

## 6. Adaptations documentées vs le dossier

1. **Police système pour le corps/UI** (dossier §Typographie) : `--font-sans` devient la
   pile système ; DM Sans n'est plus chargée dans `layout.tsx`. **Manrope est conservée**
   pour les titres de marque (`--font-display`), IBM Plex Mono reste pour les données.
2. **`--lkv-primary` conservé à `#17402C`** car verrouillé par `tests/design/tokens-sync.spec.ts`
   (intention : identité de marque des titres). Les éléments d'action utilisent le nouveau
   token `--lkv-action: #226148` (spec §6), câblé sur `--primary` (Tailwind), les boutons
   (`.glass-capsule-btn.primary`, `LkvButton`, `LkvChip`, `GlassIconButton`) et le focus.
3. **Rayon de carte 28 → 24 px** : le test de synchronisation a été mis à jour avec
   justification (direction rayons 12/16/24) ; la vérification n'a pas été supprimée.
4. **Verre** : le dossier demande « verre léger réservé aux surfaces superposées » ; le
   matériau tokenisé passe d'un verre blanc translucide sur marbrure sombre à un verre
   clair à contenu sombre (et inversement en sombre). Aucune nouvelle surface verre ajoutée.
5. **États sombres étendus au-delà du dossier** : le dossier ne listait que fond/surface/texte ;
   bordures, champs, survol, focus, désactivé, statuts, verre, boutons, cartes et bulles de
   messagerie sont complétés (autonomie accordée).
6. **`capacitor.config.ts` non modifié** (partagé avec P4, verrouillé par un test :
   `#17402C`/`#FBFAF6`). Le splash et la barre d'état natives conservent donc les couleurs
   historiques — à réconcilier avec P4 avant publication.
7. **`docs/A11Y_CONTRASTS.md`** décrit l'ancienne palette : une note de renvoi a été ajoutée,
   la réconciliation complète est laissée au prochain passage documentation.

## 7. Limites et restes à vérifier

- **Captures avant/après non produites** dans cet environnement (pas de navigateur piloté
  pour des captures de recette) : la conformité visuelle réelle n'est **pas revendiquée**.
- **Suites de snapshots visuels** (`tests/visual/shell.spec.ts`, `unification-visual.spec.ts`,
  `pays-visual.spec.ts`, `voyages-y-profiles-visual.spec.ts`) : elles échoueront tant que
  les baselines ne seront pas régénérées (`npm run test:visual:update`) **après revue
  humaine des captures**. Elles n'ont pas été mises à jour à l'aveugle.
- **Composants à passe visuelle** : des composants métier utilisent des couleurs littérales
  (`text-white`, `bg-white/90`, `bg-lkv-primary text-white`, palettes `forest-*`) — non
  réécrits par P5. En mode clair, les surfaces tokenisées sont cohérentes ; en mode sombre,
  ces littéraux peuvent rester clairs/sombres à contresens et doivent être traités dans une
  passe dédiée (hors périmètre « sans réécrire les 400 composants »).
- **Vérification par navigateur** : contrat verre (36/36 Playwright Chromium + WebKit)
  exécuté localement et vert ; les autres suites Playwright de captures restent à rejouer.
- **Validation native iOS/Android** : non vérifiée (aucun appareil ici).
