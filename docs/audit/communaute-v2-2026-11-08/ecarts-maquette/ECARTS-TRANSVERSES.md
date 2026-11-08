# Écarts transverses — Communauté v2 (livré vs maquette / design system)

**Date** : 2026-11-08 · **Auteur** : agent `ecarts-visuel` (lecture/comparaison seule)
**Périmètre** : écarts *transverses* entre la **V2 livrée** et la **maquette + le design system de
référence** — couleurs et teintes, typographies, rayons, ombres/matières, espacements et cibles
tactiles, motion (durées/courbes, reduced-motion), états (vide/erreur/chargement), capsule et
mini-capsule, poignée, focus, safe areas, débordements.
**Hors périmètre** : le détail écran par écran (→ `ECARTS-EXPLORER.md`, `ECARTS-CREATION.md`,
`ECARTS-MAQUETTE.md`). Aucun code modifié, aucun serveur ni build lancé.

**Synthèse** : **13 thèmes** vérifiés · **P1 : 0 · P2 : 4 · P3 : 16** · dont **18 écarts non
documentés** (4 P2 + 14 P3), 11 écarts déjà documentés ailleurs, 11 points non comparables.
Le socle (capsule 56 / mini-capsule 30, poignée, motion, reduced-motion/transparency, safe areas,
jetons de type, focus, cibles 44 px) est **conforme** ; les écarts sont concentrés sur les
**matières d'états et de badges**, la **structure d'un entête de détail** et **deux contrôles de
formulaire**.

## Sources

| Source | Usage |
|---|---|
| `docs/audit/communaute-v2-2026-11-08/ecarts-maquette/captures-v2/` (**48 PNG 390×844**, `MANIFEST.json`) | constaté V2 |
| `docs/audit/communaute-v2-2026-11-08/recette/captures-maquette/` (**58 PNG 390×844**) | attendu maquette |
| `handoff/communaute-v2/annexes/maquette-communaute.html` | CSS réel de la maquette (valeurs citées ligne à ligne) |
| `handoff/communaute-v2/annexes/A-design-visuel-compte.md` (§1 jetons, §3 matériaux, §6 espacements/mouvement) | attendu design system |
| `handoff/communaute-v2/annexes/B-interactions-compte.md` (§0-1 : tokens de mouvement, bornes `--card-*`) | attendu motion/géométrie |
| `handoff/communaute-v2/02-DESIGN-ET-COMPOSANTS.md` (§1 valeurs clés, §4 interdits) | attendu contractuel |
| `handoff/communaute-v2/00-MISSION.md` (§3 décisions déjà prises) | attendu contractuel |
| `src/styles/tokens.css` (`--type-*` L1162-1166, `--cv2-*` L1172-1211, `--cv2-light-*` L1220-1249), `src/styles/communaute-v2.css`, `src/styles/communaute-v2-shell.css`, `src/features/community/v2/{explore/explore-v2.css,create/create-v2.css}` | constaté code |
| `docs/audit/.../integration/RAPPORT-INTEGRATION.md`, `recette/PREUVES.md`, `COUVERTURE-200.md`, `handoff/communaute-v2/JOURNAL.md` | écarts **déjà documentés** |

## Méthode (reproductible)

1. **Images réellement ouvertes** (`read_image`) — 21 paires/crops V2 ↔ maquette :
   `explorer-recherche`, `explorer-etat-vide` ↔ `etat-st-empty`, `explorer-etat-chargement` ↔
   `etat-st-load`, `explorer-recherche-erreur` ↔ `etat-st-err`, `explorer-clubs` (crop blason),
   `explorer-carnets` (crops couverture + badges), `explorer-carnets-tri-menu` (crops menus),
   `explorer-sorties-detail` (crops entêtes billet), `explorer-carnets-peek`, `explorer-invite` ↔
   `role-invite-explorer`, `creation-publication-etape1`, `creation-publication-erreurs`,
   `creation-brouillon`, `creation-fermeture-confirmation`, `creation-story-etape1` ↔ `story-e1`,
   `creation-carnet-etape2` ↔ `carnet-e2-trace`, `creation-carnet-etape4` ↔ `carnet-e4-partage`,
   `creation-kit-picker`.
2. **Mesures pixel** sur les PNG (PIL) : teinte du verre intérieur/extérieur du tiroir, couleur des
   pastilles d'état, des badges et des blasons (valeurs hex ci-dessous), bord du tiroir
   (`x = 8..382`, haut ≈ 42-47).
3. **Vérification code** (`grep`/`read`) de tout le mesurable : durées/courbes, seuils 44/48, rayons,
   jetons vs maquette, littéraux couleur, `prefers-reduced-motion`/`-transparency`, focus, safe areas.

Limites assumées : captures **statiques** (le motion est vérifié dans le code, pas à l'image) ;
jeu de données `@ui-mock` **sans URL Storage ni trace GPS** ; pas de captures 360/430 px.

---

## 1. Couleurs et teintes

| Thème | Attendu (maquette/design system) | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Couleurs littérales | Aucun hex hors `tokens.css` (garde U-D60, 02 §4) | **0 hex** dans `communaute-v2.css`, `communaute-v2-shell.css`, `explore-v2.css`, `create-v2.css` (et dans `src/app/sorties/[id]/event-detail.css`, hors périmètre) ; les `rgba()` du shell citent la source `/compte` | — | — | **Conforme** |
| Palette des types | `--type-post/carnet/club/sortie/membre` uniquement verts, AA (02 §3) | Jetons verts (forêt/sauge), contrastes documentés `tokens.css` L1150-1166 | — | — | **Conforme** |
| Teintes non vertes hors danger | « aucune teinte non verte hors danger » (00 §3) ; `#4B6B7C` explicitement interdit (02 §4) | `--lkv-warning` **#C89A3B** / `--lkv-warning-dark` **#765014** consommés par `.lkdv-cv2-offline` (`communaute-v2.css` L1546-47), `.lkdv-cv2-counter[data-near]` (L1002), `.lkdv-cv2-badge[warn]` (L1752-53) ; `--cv2-light-info` #4B6B7C déclaré mais **non consommé** | Ochre (ambre) sur bandeau hors-ligne, compteur proche limite, badge warn | **P3** | Non documenté (la garde U-D60 ne vérifie que l'absence de littéraux, pas la teinte des jetons ; `PREUVES.md` A4 conclut « verts uniquement ») |
| Badges de tuile carnet | `Carnet de la semaine` = **verre clair + encre forêt** (`.ct-wk`, maquette L1013 : `background:var(--bar-glass-bg)`) ; `En route` = **pilule forêt + texte blanc** (`.ct-live`, L1010) | **Inversé** : `.lkdv-cv2x-carnet-week` = `--lkv-forest-900` + encre inversée (`explore-v2.css` L175-185) ; `.lkdv-cv2x-live` = `--glass-bg-medium` + encre forêt (L194-224). Mesure : badge maquette **#E5F6E0** / V2 **#17402C** ; pilule « En route » maquette forêt/blanc, V2 blanche/encre | Matières des deux badges échangées sur **toutes** les tuiles carnet | **P2** | Non documenté |
| Teinte perçue du verre | Verre du tiroir = `--sheet-bg` + `blur(30px) saturate(1.7) brightness(1.04)` (HIG L2796-2810) | `communaute-v2-shell.css` L62-65 applique **exactement** `--sheet-bg`/`--sheet-blur`/`--sheet-shadow` (`tokens.css` L1123-1125). Écart de teinte **perçu** : intérieur maquette **#B7E1BC** / V2 **#788162** ; extérieur maquette **#4F7B65** / V2 **#525849** | Matériau identique ; la teinte perçue vient du **fond** (photo réelle chaude vs illustration verte) | — | **Non comparable** (voir §5) |
| Blason de club | Maquette : forêt uniforme. Dossier : « teinte par jeton vert dérivée de l'id » (02 §2) | V2 : sauge variable par club (capture « Vercors Alpin » vs « Ski de rando ») | Divergence maquette ↔ dossier | — | **Divergence assumée** (02 §2) |

## 2. Typographies

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Familles | SF Pro d'abord puis Inter (TOK L217-218) ; aucune police hors jetons (02 §4) | `--font-sans`/`--font-display` incluent `-apple-system` puis `--font-inter` ; 0 famille littérale dans les CSS v2 | — | — | **Conforme** |
| Titres et métas de tuile | Maquette `.ct-t` 600 14/1.25 ; `.ct-m` 400 10,5/1.3 | `.lkdv-cv2-title` 600 14/1.25 (`communaute-v2.css` L379-383) ; `.lkdv-cv2-meta` 400 10,5/1.3 (L395-399) | Valeurs **identiques** | — | **Conforme** |
| Échelle des champs | Libellés 600 10 px majuscules (02 §1) ; champs 16 px, 44-48 px | `.lkdv-cv2-field-label` 600 10/1.2, `letter-spacing .05em` (L876-883) ; `.lkdv-cv2-input` 400 16/1.35, `min-height: var(--cv2-field-height)` = 48 px (L885-899, TOK L1192) | Conforme au dossier ; **plus grand que la maquette** (38 px / 12,5 px, maquette L553) | — | **Conforme** (divergence assumée : le dossier prime) |
| Surtitres de section | Maquette : `FORMAT`/`AUDIENCE` nus (10-11 px, 600, tracking) | V2 ajoute un surtitre par étape : « APERÇU VIVANT · ÉTAPE 1 : FORMAT » (`PostFormV2.tsx` L331, `StoryFormV2.tsx` L658) | Libellé non prévu par la maquette, répété à chaque étape | **P3** | Non documenté |
| Métas de contenu | Maquette : « 40 recherches », « Photo / vidéo », « Randonnée · Grenoble · 312 membres » | V2 : « 128 apparitions cette semaine », « Photo », « Randonnée · Grenoble, France · 128 membres » | Libellés plus longs (+ « , France ») | **P3** | Non documenté (contenu, pas de style) |

## 3. Rayons

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Carte d'écran (tiroir) | 24 px (A §3 : `.sw-wrap` radius 24 ; shell `--cv2-radius: 24px`) | `communaute-v2-shell.css` L20 `--cv2-radius: 24px` ; bord mesuré identique sur les deux jeux | — | — | **Conforme** |
| Tuiles | Maquette `.ct`/`.kt` **18 px**, `.mtile` 16, `.tile` 14 | Jetons `--cv2-radius-tile-sm 14` / `tile 16` / `tile-lg **20**` (TOK L1176-1178) ; `.lkdv-cv2-tile--wide` 20 | +2 px sur les tuiles principales | **P3** | Non documenté |
| Champs / pilules / capsules | Champs 11-12 px ; pilules/chips/capsules 999 ; avatars 50 % (A §6) | `--cv2-field-radius 12` ; `--lkv-radius-full` ; `.lkdv-cv2-back` 50 % | — | — | **Conforme** |

## 4. Ombres et matières

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Tuiles / cartes | `--drawer-card-bg` + `--drawer-card-blur` + `--drawer-card-shadow` (HIG L2832-2838) | `--cv2-tile-bg/blur/shadow` = ces jetons (TOK L1172-1175) ; identique à `.cardglass` de la maquette (L1103) | — | — | **Conforme** |
| Poignée | 38×5, `rgba(255,255,255,.82)`, ombre `0 1px 6px rgba(23,43,36,.18)` (A §3) | `communaute-v2-shell.css` L92-99 : 38×5, blanc .82, ombre identique | — | — | **Conforme** |
| Bandeau « Brouillon restauré » | Maquette `.banner-draft` : **pilule 999**, `background: var(--soft)` + `inset 0 0 0 1px var(--soft-line)`, 600 12, horloge + séparateur `·` (L1119, L2710) | `.lkdv-cv2-draft` : **rectangle `--cv2-field-radius` (12 px)**, `--sage-50` opaque, 600 11,5, sans horloge ni `·` (`communaute-v2.css` L1365-1385) ; capture : carte blanche pleine largeur | Matière et forme du bandeau | **P3** | Non documenté |
| Ombres encrées | « ombres à base d'encre `rgba(11,31,23,%)`, jamais `rgba(0,0,0)` » (CLAUDE.md §4) | `--cv2-island-shadow: 0 10px 30px rgba(0,0,0,.35)` (TOK L1208) | Une ombre noire, sur une primitive absente de la maquette | **P3** | Non comparable (île) + à vérifier |
| Ratios de couverture | Maquette `.ct-cover` **4/5** (grille) et **16/10** (tuile large) | `.lkdv-cv2x-carnet-cover` **4/3**, tuile large **16/9** (`explore-v2.css` L40-47) | Tuiles V2 plus larges/écrasées | **P3** | Non documenté |

## 5. Espacements et cibles tactiles

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Cibles ≥ 44 px | ≥ 44 px (CLAUDE.md §4 ; 02 §1) | `.lkdv-cv2-pill` min-h 44 (L1671), `.lkdv-cv2-chip--lg` 44, `.lkdv-cv2-back` 32 + `::after inset -6px` = 44, like/comment 44, bouton tri 30 + `::after -7px`, options de menu 44 | — | — | **Conforme** |
| Champs | 44-48 px (02 §1) | 48 px (`--cv2-field-height`) | — | — | **Conforme** |
| Chips de filtre | ≥ 44 px (CLAUDE.md) | `.lkdv-cv2-chip` **32 px** (L1015-1031) | Sous le seuil — mais **identique à `/compte` (28 px) et à la maquette (28 px)** | **P3** | Déjà connu (dette système `/compte`) |
| Entête du détail Sortie | Maquette : billet **68 px de colonne date à gauche + corps à droite** (`.lkdv-cv2-ticket-main` grid `68px 1fr`, `communaute-v2.css` L603-607 ; maquette L1080) | **Colonne** : le stub date occupe **toute la largeur**, le corps passe dessous (capture `explorer-sorties-detail`). Cause : `.lkdv-cv2-ticket` est `flex-direction: column` (L588-591) et `.lkdv-cv2x-event-head` ne rétablit que `display:flex` (`explore-v2.css` L725-730) sans `flex-direction: row` | Structure du billet de détail | **P2** | Non documenté |
| Pied de formulaire | « Suivant **et Retour** visibles » (00 §3) ; maquette : Retour grisé à l'étape 1 | `CreateSheetV2.tsx` L469-480 : `{activeNav.canBack ? <Retour/> : null}` ; `canBack = step > 0` (`CreateFormEngineV2.tsx` L300) → **aucun Retour à l'étape 1** (6 formulaires) | Contrôle manquant (et cible perdue) | **P2** | Non documenté |
| Libellés dupliqués | Chaque libellé une seule fois (principe 00 §3 « erreurs une fois ») | Carnet, étape Tracé : `TracePaneV2.tsx` L556-575 rend « Distance »/« Dénivelé » en résumé, puis `CarnetFormV2.tsx` L136-137 rend les mêmes libellés sur les champs → **libellés deux fois** (capture `creation-carnet-etape2`) | Doublon visible | **P3** | Non documenté — **même famille que le Majeur 1 documenté** (« Point de rendez-vous » deux fois, `RAPPORT-INTEGRATION.md`) |
| Mini-capsule au-dessus du contenu | Flottante (maquette : elle recouvre aussi le contenu, `carnet-e2-trace`) | V2 : recouvrement observé (Publication étape 1, Story étape 1) | Recouvrement **conforme à la maquette** ; le manque de réserve basse est déjà documenté | — | **Déjà documenté** (`RAPPORT-INTEGRATION.md`, Majeur 2 : `padding-bas` du `.lkdv-cv2c-pane` à porter à ≈ 76 px) |

## 6. Motion (durées et courbes)

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Entrée / sortie du tiroir | entrée `.72s cubic-bezier(.16,1,.3,1)` ; sortie `.56s` (02 §1) | `0.72s var(--ease-out)` (`--ease-out` = `.16,1,.3,1`) ; sortie `0.56s` (shell L67, L78) | — | — | **Conforme** |
| Lentille de capsule | `.42s var(--motion-ease-standard)` (02 §1) | shell L118-124 : `0.42s var(--motion-ease-standard)` | — | — | **Conforme** |
| Lentille de mini-capsule | `.28s cubic-bezier(.34,1.56,.64,1)` (02 §1) | shell L196-198 : `0.28s var(--ease-spring)` | — | — | **Conforme** |
| Cascade de rangées | `.45s ease-glass`, délais +.03 s (A §6) | shell L226, L300-309 : `0.45s var(--ease-glass)` ; `@keyframes cv2RowIn` | — | — | **Conforme** |
| Appui | `scale(.96-.97)` `.12s var(--ease-spring)` (A §6) | 8 occurrences `transform 0.12s var(--ease-spring)` (v2 L174/810/1031/1679, shell L255) ; quelques `.18s var(--ease-out)` sur fond/transform (`create-v2.css` L1476/1492/1561) | — | — | **Conforme** |
| Barre d'onglets qui s'efface | `.25s ease / .35s standard` (B §1.4) | shell L29-31 : `0.25s ease` + `0.35s var(--motion-ease-standard)` | — | — | **Conforme** |
| Source unique des courbes | Aucune `cubic-bezier()` écrite à la main (garde `motion-unique`) | 0 `cubic-bezier()` dans les 4 CSS v2 ; durées littérales, conformes au dossier 02 §1 qui les donne en clair | — | — | **Conforme** |
| Menu de tri | `.28s` spring (02 §2) | `SortMenuButton.tsx` : `animation: lkdv-sort-in .28s var(--ease-spring)` | — | — | **Conforme** |

## 7. Reduced-motion et reduced-transparency

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| `prefers-reduced-motion` (CSS) | Partout (02 §4) | 4 blocs : `communaute-v2.css` L1915, shell L350-369 (feuille, détail, lentilles, tabbar), `explore-v2.css` L1286, `create-v2.css` L1528/L1652 ; `SortMenuButton` (animation + transition) | — | — | **Conforme** |
| `prefers-reduced-motion` (JS) | Idem pour les transitions pilotées | `CommunitySheetShell.tsx` L151-160 : `matchMedia('(prefers-reduced-motion: reduce)')` | — | — | **Conforme** |
| `prefers-reduced-transparency` | Repli opaque (A §3) | shell L371-378 (`--lkv-surface` = `--cv2-light-page` **#F5F2EC**, donc repli **clair** : pas de bug de contraste) ; `communaute-v2.css` L1934 ; `SortMenuButton` | — | — | **Conforme** |
| `prefers-contrast: more` | Non exigé par le dossier | Traité dans le même bloc que reduced-transparency (`communaute-v2.css` L1934) | — | — | **Conforme** (bonus) |

## 8. États (vide / erreur / chargement)

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Erreur — teinte de l'icône | Maquette `.empty.err .gl { background: var(--bad-bg); color: var(--bad) }` (L379) ; capture : pastille **#F5DDD9** + glyphe **#A8443A** | `.lkdv-cv2-empty-ico, .lkdv-cv2-error-state-ico` partagent **la même** règle sage/forêt (`communaute-v2.css` L1523-1533) ; `ExploreError` réutilise la classe (`ExploreStates.tsx` L53-72) ; mesure V2 : **#D8E5D5** + glyphe **#6D8977** | Pas de teinte danger sur l'erreur (4 volets Explorer + création) | **P2** | Non documenté |
| Vide — icône | Maquette `.empty .gl` : cercle 38, `background: var(--soft)` (translucide), glyphe `var(--accent)`, **600 16** (L374) ; illustration montagne 44 px pour les carnets | V2 : cercle 38, `--lkv-secondary-subtle` **#D8E5D5 opaque**, `--lkv-forest-900`, **700 17**, glyphe signet (`.lkdv-cv2-empty-ico`) | Teinte/opacité, graisse et glyphe | **P3** | Non documenté |
| Vide/erreur — ancrage | Maquette `.empty` : `padding:28px 18px`, **ancré sous la barre** (aucun `flex:1`) (L373) | V2 : `flex: 1 1 auto; justify-content: center` (`communaute-v2.css` L1496-1507) → **centré verticalement** (captures) | Position du bloc | **P3** | Non documenté |
| Chargement — forme | Maquette `EXP.skelTiles` : grille **2 col × 6 tuiles** `aspect-ratio 4/5.6`, radius 18 (L1028, L2173) | V2 `ExploreSkeleton variant="tiles"` : **1 tuile large + 4 tuiles** (barre 72 + barre 62 %), hauteurs fixes 140/72/14, radius 20/16/9 (`ExploreStates.tsx` L14-28, `communaute-v2.css` L1461-1493) | Forme et ratios ≠ contenu attendu | **P3** | Non documenté |
| Chargement — shimmer | `1.3s ease-in-out infinite` (maquette L1028) | `lkdv-cv2-shimmer 1.3s ease-in-out infinite` (L1479) | — | — | **Conforme** |
| Erreur — copie | Message distinct d'un vide, « Réessayer » (RAPPORT §Explorer) | `ExploreError` : titre contextuel + message + `Réessayer` (`ExploreStates.tsx` L44-73) | — | — | **Déjà documenté** (`COUVERTURE-200.md` #10 ; `RAPPORT-INTEGRATION.md`) |
| Hors-ligne | Bandeau dédié | `.lkdv-cv2-offline` (L1539-1550) | Teinte ochre → cf. §1 | **P3** | Non documenté |

## 9. Capsule 56 px et mini-capsule 30 px

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Capsule | 56 px, padding 4, boutons 48, lentille 4 px, `.42s` (A §3 ; 02 §1) | shell L106-136 : `height:56px`, `padding:4px`, boutons 48, `sel-lens` top/bottom/left 4, `width: calc((100% - 8px)/var(--n))`, `.42s` | — | — | **Conforme** |
| Mini-capsule | 30 px, padding 2,5, boutons 25, icônes 15, lentille 25, `right/bottom 10px` (A §3, LC L101-160) | `.lkdv-lens-float` 30/2,5/25 (LC) ; position imposée par shell L177-198 (`right:10px; bottom:10px`, `has-footer` → `bottom:72px`) | — | — | **Conforme** |
| Bouton de tri | 30 px rond, même verre, à droite de la mini-capsule, options 44 px, `role=menu` (00 §3) | `SortMenuButton.tsx` L232-236 : 30×30, `--lg-bar-*`, `::after -7px` (44), menu radius 20, options 44, `menuitemradio`, Échap/Tab | — | — | **Conforme** |
| Menu de tri — option active | Maquette : fond sauge **+ anneau inset** (`box-shadow: inset 0 0 0 1px var(--soft-line)`, cf. `.ct`/`.chip` actifs) | V2 : fond `--lkv-secondary-subtle` seul, **sans anneau** (`.lkdv-sort-item[aria-checked="true"]`) ; capture : anneau présent dans la maquette, absent en V2 | Anneau manquant | **P3** | Non documenté |
| Icônes des filtres | Maquette (carnets) : globe / signet / **cœur** / épingle | V2 : **boussole** / signet / **binôme** / épingle (capture `explorer-etat-vide` vs `etat-st-empty`) | 2 icônes sur 4 changées | **P3** | Non documenté |
| Capsule masquée en détail | La capsule de volet disparaît quand un détail est empilé | Captures `explorer-sorties-detail` : capsule absente, entête ‹ Retour | — | — | **Conforme** |

## 10. Poignée

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Forme / teinte | 38×5, rayon 3, blanc .82 + ombre encrée (A §3) | shell L92-99 (identique) | — | — | **Conforme** |
| Zone de préhension | Zone élargie ≥ 44 px (A §4 `::after` min 44) | shell L100-104 : `::after inset 0 -30px -6px` ; `.lkdv-cv2-detail` z 16 > 15 pour ne pas voler le tap du ‹ Retour (L227-231) | — | — | **Conforme** + **déjà documenté** (`PREUVES.md` : `cv2-back` recouvert par la poignée — résolu) |

## 11. Focus

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Anneau | `outline: 2px solid var(--accent)` offset 2 (A §4) | `communaute-v2.css` L128-131 et shell L340-344 : `2px solid var(--lkv-secondary)` offset 2 | — | — | **Conforme** |
| Focus sur champ | bordure forêt + halo (A §4) | `.lkdv-cv2-input:focus` : `inset 0 0 0 2px var(--lkv-secondary)` (L905-909) | — | — | **Conforme** |
| Rayon au focus | Le focus ne doit pas changer la forme du contrôle | `.lkdv-cv2-sheet :focus-visible { … border-radius: 8px }` (shell L340-344, spécificité 0,2,0 > `.lkdv-cv2-pill` 0,1,0) → une **pilule/capsule focalisée au clavier passe en rayon 8 px** | Changement de forme au focus | **P3** | Non documenté (non capturé, déduit du CSS — à vérifier) |
| Focus du bouton de tri | Anneau inset dédié | `SortMenuButton.tsx` : `box-shadow: inset 0 0 0 2px var(--lg-on), inset 0 0 0 4px var(--lkv-text-inverted)` | — | — | **Conforme** |

## 12. Safe areas

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Bornes de la carte | `env(safe-area-inset-*)` + marge (A §6 ; B §1.3 : bornes 48/8/8/60/24) | shell L17-20 : `top = safe-top + 44`, `bottom = safe-bottom + 14`, `left/right 8`, radius 24 ; ≥768 px : `+56/+42` (L381-392) | Top/bottom diffèrent des bornes `/compte` (48/60) mais **conforme à la maquette** (bord haut mesuré 42-47, bas ≈ 836/844) | — | **Non comparable** (géométrie `/compte` ≠ maquette pour la carte) |
| Bas de contenu | Réserve safe-area + scroll | `--cv2-pane` padding-bas 76 (shell L166) ; `.lkdv-cv2-detail-body` `calc(24px + env(safe-area-inset-bottom))` (L307) ; pied `calc(12px + max(0px, env(safe-area-inset-bottom) - 14px))` (L206) | — | — | **Conforme** |
| Barre d'onglets d'app | Masquée tiroir ouvert (B §1.4) | shell L25-32 : `opacity 0`, `translateY(120%)` | — | — | **Conforme** |

## 13. Débordements

| Thème | Attendu | Constaté (V2 + capture) | Écart | Gravité P1/P2/P3 | Statut |
|---|---|---|---|---|---|
| Horizontal 360/390/430 | 0 débordement (00 §7) | `.lkdv-cv2-wrap` `overflow:hidden`, `max-width:430px` ; `.lkdv-cv2-pane` `overflow-x:hidden` (shell L42-46, L162-163) ; **aucun débordement observé sur les 45 captures 390 px** | — | — | **Déjà documenté** (`PREUVES.md` A8 : e2e 1f + 9 verts ; non revérifié à 360/430 ici) |
| Vertical | Contenu scrollable, pas de coupe | Derniers boutons de détail sous le bord : simple position de scroll (`.lkdv-cv2-detail-body` a 24 px + safe-area de réserve) | — | — | **Conforme** (à vérifier au scroll extrême) |
| `z-index` | Fin du `2147483000` (02 §2) | Aucun `z-index` à 7 chiffres dans les CSS v2 ; échelle 60/70 (`--cv2-z-island`) | — | — | **Conforme** |

---

## 3. Classement des écarts

### (a) Déjà documentés — cités, non recomptés

| # | Écart | Document |
|---|---|---|
| D1 | Matière sombre globale qui fuyait dans le tiroir clair (contenu blanc sur verre blanc) | `RAPPORT-INTEGRATION.md` §Bloquant B1 (corrigé, vérifié) |
| D2 | Chevauchement capsule d'étapes / contenu sur les étapes longues (réserve basse insuffisante) | `RAPPORT-INTEGRATION.md` §Majeurs 2 — observé aussi sur `creation-publication-etape1` |
| D3 | Libellé affiché deux fois (« Point de rendez-vous », `SortieFormV2` + `MeetingMapV2`) | `RAPPORT-INTEGRATION.md` §Majeurs 1 — **notre P3 « Distance/Dénivelé » est une autre occurrence** |
| D4 | « Membre ✓ » en barre pleine largeur : se lit comme un état, pas une action | `RAPPORT-INTEGRATION.md` §Mineurs 3 |
| D5 | Couvertures absentes des tuiles (fixtures sans URL Storage) | `RAPPORT-INTEGRATION.md` §Non-écarts |
| D6 | Initiales d'avatars incomplètes dans les détails (mock `public_profiles`) | `RAPPORT-INTEGRATION.md` §Non-écarts |
| D7 | `input[type=date]` en `mm/dd/yyyy` (Chromium headless) | `RAPPORT-INTEGRATION.md` §Mineurs 5 |
| D8 | Contraste du rang des tendances : **pas un écart AA** | `RAPPORT-INTEGRATION.md` §Mineurs 4 |
| D9 | États de page / skeleton / erreur distincts du vide, `Réessayer` | `COUVERTURE-200.md` #10, #12 ; `PREUVES.md` A5 |
| D10 | 0 erreur console, 0 débordement 360/390/430, a11y 4/4 | `PREUVES.md` A8, lignes 35-37 |
| D11 | Motion et rayons tenus par des gardes design (`motion-unique`, `radius`, `contrast`…) | `RAPPORT-INTEGRATION.md` §Contrôles (53 tests verts) |

### (b) Non documentés — inventaire

| # | Écart | Gravité | Preuve code / capture |
|---|---|---|---|
| N1 | **États d'erreur sans teinte danger** : la pastille d'erreur est sage/forêt, identique à celle du vide | **P2** | `communaute-v2.css` L1523-1533 ; `ExploreStates.tsx` L53-72 ; maquette L379 ; mesure V2 #D8E5D5/#6D8977 vs maquette #F5DDD9/#A8443A |
| N2 | **Badges de la tuile carnet inversés** (`Carnet de la semaine` sombre, `En route` clair) | **P2** | `explore-v2.css` L175-224 ; maquette L1010/L1013 ; mesure #17402C vs #E5F6E0 |
| N3 | **Entête du détail Sortie en colonne** : stub date pleine largeur au lieu de 68 px + corps | **P2** | `communaute-v2.css` L588-591 + `explore-v2.css` L725-730 (pas de `flex-direction: row`) ; capture `explorer-sorties-detail` |
| N4 | **« Retour » absent à l'étape 1** des 6 formulaires | **P2** | `CreateSheetV2.tsx` L469-480 ; `CreateFormEngineV2.tsx` L300 ; 00 §3 ; maquette (Retour grisé) |
| N5 | Libellés **Distance/Dénivelé dupliqués** (Carnet, Tracé) | P3 | `TracePaneV2.tsx` L556-575 + `CarnetFormV2.tsx` L136-137 ; capture `creation-carnet-etape2` |
| N6 | États vide/erreur **centrés** au lieu d'être ancrés sous la barre | P3 | `communaute-v2.css` L1496-1507 vs maquette L373 |
| N7 | **Squelette de chargement** de forme différente (1 large + 4 vs 2×6 ratios 4/5,6) | P3 | `ExploreStates.tsx` L14-28 ; `communaute-v2.css` L1461-1493 ; maquette L1028/L2173 |
| N8 | Icône d'état vide : teinte opaque, 700 17, glyphe signet au lieu de `--soft`/`--accent` 600 16 | P3 | `communaute-v2.css` L1523-1533 vs maquette L374 |
| N9 | Bandeau « Brouillon restauré » : rectangle 12 px opaque au lieu de pilule 999 `--soft` + horloge + `·` | P3 | `communaute-v2.css` L1365-1385 vs maquette L1119/L2710 |
| N10 | **Ochre hors danger** (bandeau hors-ligne, compteur proche limite, badge warn) | P3 | `tokens.css` L1241-1243 ; `communaute-v2.css` L1002/1546/1752 ; garde `unification.spec.ts` L121 |
| N11 | Rayons de tuiles **20 px vs 18** ; couvertures **4/3 vs 4/5** et **16/9 vs 16/10** | P3 | `tokens.css` L1176-1178 ; `explore-v2.css` L40-47 ; maquette L998/L1028 |
| N12 | **`border-radius: 8px` forcé au focus** (les pilules se déforment au clavier) | P3 | `communaute-v2-shell.css` L340-344 (à vérifier visuellement) |
| N13 | **Icônes de filtres** de la mini-capsule (globe→boussole, cœur→binôme) | P3 | captures `explorer-etat-vide` ↔ `etat-st-empty` ; `ExploreCapsule.tsx` |
| N14 | Menu de tri : option active **sans anneau inset** | P3 | `SortMenuButton.tsx` L244 ; maquette (anneau visible) |
| N15 | Surtitre « APERÇU VIVANT · ÉTAPE n » non prévu, répété à chaque étape | P3 | `PostFormV2.tsx` L331 ; `StoryFormV2.tsx` L658 |
| N16 | Peek : **3 actions** au lieu de 4 (pas de « Fermer »), icônes **à gauche**, pas de séparateurs | P3 | captures ; 4 actions maquette (L1758-1765) ; 3 actions déjà notées dans `RAPPORT-INTEGRATION.md` |
| N17 | Confirmation de fermeture : hiérarchie **inversée** (V2 met l'action sûre en primaire, la maquette met « Fermer » en danger) | P3 | `CreateSheetV2.tsx` L600-640 ; maquette L1758-1759 ; **divergence assumée** (doctrine : rouge réservé erreurs/suppression) |
| N18 | Libellés de contenu divergents (« apparitions cette semaine » vs « recherches », « Photo » vs « Photo / vidéo », « , France », « Demander » vs « Rejoindre ») | P3 | captures |

### (c) Non comparables — et pourquoi

| # | Point | Raison |
|---|---|---|
| X1 | **Teinte perçue du verre** | Le fond V2 est la **photo réelle** de `/communaute` (chaude/olive) ; la maquette est une **illustration verte**. Matériau (`--sheet-bg`, blur 30/saturate 1.7) identique ; mesures intérieur/extérieur : MAQ #B7E1BC/#4F7B65, V2 #788162/#525849 |
| X2 | Couvertures/images des tuiles, filigrane de trace | Fixtures `@ui-mock` sans URL Storage (documenté D5) ; le filigrane dépend des points de trace du jeu → **à vérifier** |
| X3 | Badge « GPS » absent des tuiles V2 | `verifiedGps === false` dans les fixtures (`CarnetTileV2.tsx` L136-140) — non une régression |
| X4 | Carte du Tracé (Carnet étape 2) blanche | Tuiles OSM non chargées en capture (réseau simulé) |
| X5 | Météo et RENDEZ-VOUS du détail Sortie absents | Données de fixture (`EventDetailView.tsx` L178 les rend conditionnellement) — **à vérifier sur données réelles** |
| X6 | Île dynamique | Primitive `/compte` absente de la maquette (non comparable) ; seule réserve : ombre `rgba(0,0,0,.35)` |
| X7 | Blason de club (teinte par id) | Divergence **documentée** (02 §2) |
| X8 | Contrôles de la maquette < 44 px (CTA 36, champs 38/12,5) | Le design system impose 44-48 px : **la V2 a raison**, la maquette est en deçà |
| X9 | Chrome applicatif (barre « Explorer » + 3 boutons, décalage haut 44 px) | La maquette est une démo hors app : pas de barre d'app |
| X10 | `carnet-e4-partage.png` (maquette) | **Identique à `carnet-e2-trace.png`** (même sha256 `6f2e9b17…`) : la référence de l'étape 4 Carnet **manque** |
| X11 | Largeur du dialogue de confirmation (310 vs 290 px) | Micro-écart non significatif (max-width) |

---

## 4. Ce qui est conforme (pour ne pas noircir)

1. **Coque** : capsule **56 px** (boutons 48, lentille 4, `.42s`), mini-capsule **30 px** (boutons 25, lentille 25, `right/bottom 10`), bouton de tri **30 px** + menu `role=menu` (options **44 px**, radius 20, `.28s` spring, Échap/Tab).
2. **Poignée** : 38×5 blanc .82 + ombre encrée, zone de préhension élargie, `‹ Retour` non volé (z 16 > 15).
3. **Motion** : entrée `.72s` / sortie `.56s` `cubic-bezier(.16,1,.3,1)`, cascade `.45s` ease-glass, appui `scale(.96)` `.12s` spring, lentilles `.42s`/`.28s`, tabbar `.25s/.35s` — **toutes** les valeurs du dossier 02 §1, sans courbe écrite à la main.
4. **`prefers-reduced-motion`** (4 blocs CSS + `matchMedia` JS) et **`prefers-reduced-transparency`** (repli opaque **clair** #F5F2EC, sans bug de contraste).
5. **Couleurs** : **0 littéral hex** dans les 4 CSS v2 ; `--type-*` uniquement verts, AA documenté ; `rgba()` du shell sourcés `/compte`.
6. **Typo** : titres 600 14/1.25 et métas 400 10,5/1,3 **identiques** à la maquette ; libellés de champ 600 10 px majuscules `.05em` ; champs 16 px / **48 px** (dossier 02 §1).
7. **Cibles tactiles** : pilules 44, chips `--lg` 44, `like/comment` 44, `back` 32 + `::after` 44, bouton tri 30 + `::after` 44, options de menu 44.
8. **Focus** : anneau 2 px `--lkv-secondary` offset 2, focus de champ en inset 2 px (contrat `/compte`).
9. **Safe areas** : `--cv2-card-top/bottom` = `env(safe-area-*)` + 44/14 ; panes `+76px` ; détail `+24px + safe` ; pied `max(0, safe-14)`.
10. **États** : `Réessayer` distinct du vide, message « Ce n'est pas "aucun résultat" », shimmer 1.3 s, `aria-busy`, bandeau hors-ligne.
11. **Pas de débordement** observé sur les 45 captures 390 px ; `overflow-x:hidden` sur les panes, `overflow:hidden` sur la feuille ; échelle de `z-index` propre (60/70).
12. **Détail empilé** : entête 46 px, titre 600 15 ellipsé, méta mono 11, animation `.42s` ease-glass, `--cv2-sheet` réutilisé (matière homogène).

## 5. Top 5 à corriger

1. **N2 — Badges de la tuile carnet inversés** (P2) : échanger les deux matières (`explore-v2.css` L175-224) ; c'est l'élément de signature de la tuile, visible sur chaque carnet.
2. **N1 — Icône d'erreur non teintée danger** (P2) : une règle `.lkdv-cv2-error-state-ico { background: var(--lkv-danger-bg); color: var(--lkv-danger) }` (la maquette a déjà `--bad-bg`/`--bad`).
3. **N3 — Entête du détail Sortie en colonne** (P2) : rétablir `flex-direction: row` sur `.lkdv-cv2x-event-head` (+ largeur 68 px du stub) pour retrouver le billet maquette.
4. **N4 — « Retour » absent à l'étape 1** (P2) : rendre le bouton désactivé au lieu de le démonter (décision 00 §3 « Suivant et Retour visibles »).
5. **N5 — Libellés Distance/Dénivelé dupliqués** (P3) : à joindre au correctif du Majeur 1 déjà routé (même famille), en supprimant le résumé ou les libellés des champs.

## 6. À vérifier

- **Contraste local des surtitres** (`#56665D`, 10-11 px) quand une zone sombre de la photo traverse le verre : sur `creation-brouillon`, « AUDIENCE » est peu lisible — mesure impossible sur capture (texte antialiasé), à repasser avec `npm run audit:contrast` ou axe sur fond réel.
- **N12 (focus `border-radius: 8px`)** : non capturé (pas de capture clavier) — déduit de la cascade CSS.
- **X2/X3/X5** : filigrane de trace, badge GPS, météo et RDV du détail Sortie — dépendants des données ; à recontrôler avec des données réelles (URL Storage + `verifiedGps` + coordonnées).
- **360 px et 430 px** : non capturés ici (couverts par l'e2e 1f, `PREUVES.md` A8).
- **X10** : la référence maquette de l'étape 4 Carnet est manquante (PNG dupliqué) — la comparaison de cette étape n'est pas possible.
- **`--cv2-island-shadow` en `rgba(0,0,0,.35)`** vs la règle « ombres à base d'encre » (CLAUDE.md §4) : à trancher côté design (l'île imite le matériel).
