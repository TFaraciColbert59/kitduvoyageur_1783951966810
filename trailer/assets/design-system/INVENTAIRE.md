# INVENTAIRE du design system LKDV (faits relevés dans le dépôt, copies non modifiées dans ce dossier)

Chemins d'origine relatifs à APP = dépôt parent. Numéros de ligne = fichier d'origine.

## 1. Fichiers copiés
- Polices (`assets/fonts/`, source `src/app/fonts/`), toutes SIL OFL 1.1 (`LICENCES.md` copié) :
  - inter.woff2 (48 256 o, variable 400–900) ; manrope.woff2 (24 836 o, variable 400–800)
  - instrumentserif.woff2 (21 032 o, romain) ; instrumentserif-italic.woff2 (22 128 o)
  - plexmono-400.woff2 (14 708 o) ; plexmono-500.woff2 (14 888 o) ; plexmono-600.woff2 (15 620 o)
  - Rien ne manque : Inter, Manrope, Instrument Serif romain + italique, Plex Mono 400/500/600 sont tous présents. Sous-ensemble « latin » seulement.
- Icônes : `assets/icons/sf/`, 160 SVG (source `public/icons/sf/`) + LICENSE.txt. Liste en §7.
- Marque (`assets/brand/`) : logo-mark.svg ; lkdv-boot-logo.png = 256 x 256, 8 bits, RGBA (canal alpha présent).
- Références : tokens.css, compas.css, tokens.ts (src/design/tokens.ts).

## 2. logo-mark.svg (public/assets/logo-mark.svg), contenu exact
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <path d="M2 24 L10 10 L14 16 L20 6 L30 24 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
  <path d="M2 24 L30 24" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="24" cy="9" r="1.6" fill="currentColor"/>
</svg>
```
(un commentaire XML « Trois montagnes stylisées… » existe dans le fichier, non recopié). Filet seul, couleur = currentColor.

## 3. tokens.css (src/styles/tokens.css) — thème clair, premier bloc :root
| Jeton | Valeur | Ligne |
|---|---|---|
| --lkv-primary | #17402C (sombre : #7FC49A, l.628) | 18 |
| --sage-500 | #5B7F55 | 90 |
| --sage-700 | #3D6038 | 88 |
| --lkv-secondary-subtle | #D8E5D5 (sombre : #24382C, l.641) | 31 |
| --ink-900 | #141916 | 138 |
| --ink-700 | #2C3530 | 139 |
| --lkv-warning | #C89A3B (sombre : #E4C27A, l.675) | 165 |
| --lkv-amber-800 | #765014 | 159 |
| --lkv-brick-600 | #A8443A | 160 |
| --sky-600 / --lkv-sky-600 | #2A5A6E / var(--sky-600) | 179 / 496 |
| --lkv-info | #4B6B7C (sombre : #9FC4D4, l.682) ; --lkv-info-bg #DDE7EE | 172 |
| --lkv-danger | #A8443A ; --lkv-warning-dark #765014 ; --lkv-success #3D6038 | 163-171 |
| --tracking-caps | 0.04em | 434 |
| Stone (échelle) | --stone-50 #EEF3EC, -100 #F3EFEA, -200 #E8E2D9, -300 #D4CCC0 … -950 #1A1815 | 105-115 |
| #F5F2EC | uniquement dans `--cv2-light-page` | 1226 |
| #FBFAF6 | AUCUNE occurrence dans tokens.css ni compas.css | — |
| Surfaces | --lkv-surface #F5F7F3 ; --lkv-surface-paper #FFFFFF ; --lkv-surface-muted #EDF1EA | 45-49 |

Rayons (premier bloc, l.194-207) : --lkv-radius-xs 10px, -sm 14px, -md 18px, -lg 24px, -xl 28px, -card 28px, -2xl 32px, -large-card 32px, -sheet 36px, -nav 32px, -control 18px, -button 20px, -full 9999px.
Rayons (bloc ultérieur, l.790-798, surcharge) : -min 12px, -tile 24px, -popover 28px, -card 28px, -hero 38px, -sheet 44px, -full 9999px.

## 4. compas.css (src/features/compas/compas.css) — bloc .compas, l.23-69
- --cp-ga: 0.6 (l.41) ; --cp-gb: 10px (l.42)
- « plein soleil » `.compas[data-outdoor='1']` : --cp-ga: 0.9 ; --cp-gb: 30px (l.96-97), plus --cp-ink2 var(--lkv-ink-900)
- --cp-pg (l.46-53) :
  `linear-gradient(180deg, rgb(255 255 255 / 0.62), rgb(255 255 255 / 0.16) 52%, rgb(255 255 255 / 0.3)), rgb(150 186 142 / 0.34)` ; --cp-pg-ink: var(--lkv-primary)
- --cp-pg-sh (l.55-58) :
  `inset 0 1px 0 rgb(255 255 255 / 0.95), inset 0 -1px 0 rgb(255 255 255 / 0.4), inset 0 0 0 0.6px rgb(255 255 255 / 0.5), 0 0 0 0.6px rgb(23 64 44 / 0.16), 0 5px 14px rgb(23 64 44 / 0.13)`
- --cp-shadow: 0 8px 22px rgb(23 43 36 / 0.12) (l.60)
- --cp-island-bg: var(--lkv-ink-900) = #141916 (l.69) ; --cp-island-ink var(--lkv-on-dark) ; --cp-island-accent var(--lkv-secondary-subtle). Îlot : border-radius 28px, ombre 0 10px 30px rgb(23 43 36 / 0.28) (l.925-932).
- --cp-row-h: 3rem (l.62) = 48 px à 16 px de base. Autres : --cp-soft rgb(150 186 142 / 0.28) ; --cp-soft-line rgb(91 127 85 / 0.38) ; --cp-fill rgb(23 43 36 / 0.07) ; --cp-sep rgb(23 43 36 / 0.1) ; --cp-accent var(--lkv-sage-500) ; --cp-good var(--lkv-sage-700), -bg rgb(61 96 56 / 0.14) ; --cp-warn var(--lkv-amber-800), -bg rgb(200 154 59 / 0.2) ; --cp-bad-bg rgb(168 68 58 / 0.14) ; --cp-info var(--lkv-sky-600).
- Verre : fond blanc alpha (--cp-ga ± 0.06..0.14), `backdrop-filter: blur(var(--cp-gb)) saturate(1.9) brightness(1.07)` (l.162-175) ; tiroir : blur(calc(var(--cp-gb) + 18px)) saturate(1.8) brightness(1.05) (l.206-213).

### Blocs CSS (tels quels)
```css
.cp-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--cp-row-h);
  padding: 0.375rem 4px;
  border: 0;
  border-bottom: 0.5px solid var(--cp-sep);
  background: transparent;
  text-align: left;
  width: 100%;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

/* .cp-steps l.275-304 */
.cp-steps {
  flex: 1;
  min-width: 0;
  position: relative;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  padding: 2px;
  border-radius: 999px;
}
/* Lentille qui glisse d'une étape à l'autre, comme la barre d'onglets. */
.cp-steps__lens {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc((100% - 4px) / 5);
  border-radius: 999px;
  z-index: 1;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.62), rgb(255 255 255 / 0.26));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 1),
    inset 0 -1px 1px rgb(255 255 255 / 0.5),
    0 0 0 0.5px rgb(23 43 36 / 0.08),
    0 3px 10px rgb(23 43 36 / 0.1);
  transition: transform 0.55s cubic-bezier(0.3, 1.35, 0.4, 1);
}
.cp-steps {
  touch-action: pan-y;
}

/* .cp-sheet l.781-803 */
.cp-sheet {
  position: absolute;
  z-index: 21;
  left: 0;
  right: 0;
  top: 0;
  bottom: calc(var(--cp-map-h) + var(--cp-gap));
  display: flex;
  flex-direction: column;
  border-radius: 30px;
  overflow: hidden;
  transition:
    bottom 0.45s cubic-bezier(0.32, 0.72, 0, 1),
    top 0.45s cubic-bezier(0.32, 0.72, 0, 1);
  animation: cp-sheet-in 0.42s cubic-bezier(0.32, 0.72, 0, 1);
}
.cp-sheet[data-detent='small'] {
  top: auto;
  height: min(46%, 340px);
}
.cp-sheet[data-detent='large'] {
  bottom: var(--cp-nav-clear);
}

/* .cp-seg l.635-665 */
.cp-seg {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: var(--cp-fill);
}
.cp-seg button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 2.125rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font-size: 0.78125rem;
  font-weight: 600;
  color: var(--cp-ink2);
  cursor: pointer;
  min-width: 0;
  white-space: nowrap;
}
.cp-seg button[aria-pressed='true'] {
  background: var(--cp-soft);
  box-shadow:
    inset 0 0 0 0.6px var(--cp-soft-line),
    inset 0 1px 0 rgb(255 255 255 / 0.7);
  color: var(--cp-ink);

/* .cp-chip l.539-567 */
.cp-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 1.5rem;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 0.71875rem;
  font-weight: 600;
  white-space: nowrap;
  background: var(--cp-fill);
  color: var(--cp-ink);
}
.cp-chip[data-tone='good'] {
  background: var(--cp-good-bg);
  color: var(--cp-good);
}
.cp-chip[data-tone='warn'] {
  background: var(--cp-warn-bg);
  color: var(--cp-warn);
}
.cp-chip[data-tone='bad'] {
  background: var(--cp-bad-bg);
  color: var(--cp-bad);
}
.cp-chip[data-tone='soft'] {
  background: var(--cp-soft);
  box-shadow: inset 0 0 0 0.6px var(--cp-soft-line);
}

/* .cp-bar l.1328-1347 */
.cp-bar {
  height: 5px;
  border-radius: 99px;
  background: var(--cp-fill);
  overflow: hidden;
  display: flex;
}
.cp-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: var(--cp-accent);
  transition: width 0.5s;
}
.cp-bar[data-tone='warn'] i {
  background: var(--lkv-warning);
}
.cp-bar[data-tone='bad'] i {
  background: var(--cp-bad);
}
```

## 5. Storyboard (section 2) vs dépôt
| Valeur du storyboard | Verdict |
|---|---|
| --lkv-primary #17402C | IDENTIQUE |
| --sage-500 #5B7F55 | IDENTIQUE |
| --sage-700 #3D6038 | IDENTIQUE |
| --lkv-secondary-subtle #D8E5D5 | IDENTIQUE (thème clair ; sombre #24382C) |
| --ink-900 #141916 | IDENTIQUE |
| --ink-700 #2C3530 | IDENTIQUE |
| --lkv-warning #C89A3B / --lkv-amber-800 #765014 | IDENTIQUE |
| --lkv-brick-600 #A8443A | IDENTIQUE |
| --lkv-sky-600 #2A5A6E | IDENTIQUE |
| info #4B6B7C | IDENTIQUE (jeton distinct : --lkv-info, pas sky-600) |
| Stone #F5F2EC | DIFFÉRENT : aucun jeton « Stone » à cette valeur ; #F5F2EC n'existe que comme --cv2-light-page (l.1226). Échelle --stone-100 = #F3EFEA ; surface d'app --lkv-surface = #F5F7F3 |
| Paper #FBFAF6 | DIFFÉRENT : absent des deux CSS ; --lkv-surface-paper = #FFFFFF |
| Verre --cp-ga 0,6 / --cp-gb 10 px | IDENTIQUE |
| Plein soleil 0,9 / 30 px | IDENTIQUE |
| --cp-pg dégradé 0,62 → 0,16 → 0,30 sur sage rgb(150 186 142 / 0,34), encre Forest | IDENTIQUE (le 0,16 est à 52 %) |
| --cp-pg-sh liseré 0,95 haut, contour 0,6 px Forest 16 %, ombre 0 5 14 Forest 13 % | IDENTIQUE (rgb Forest = 23 64 44) |
| --cp-shadow 0 8 22 rgb(23 43  36 / 0,12) | IDENTIQUE |
| Rayons « 12, 16, 24 px et pilule » | DIFFÉRENT : tokens 10/14/18/24/28/32/36 (puis 12/24/28/38/44) ; .cp-sheet 30px, îlot 28px, capsules 999px. Seuls 12 et 24 existent |
| .cp-row 48 px | IDENTIQUE (3rem) |
| --cp-island-bg #141916, accent #D8E5D5 | IDENTIQUE (via --lkv-ink-900, --lkv-secondary-subtle) |
| --tracking-caps (interlettrage) | storyboard sans valeur ; dépôt = 0.04em (CLAUDE.md d'APP cite 0.14em / 0.1em pour les labels : écart documentaire) |
| « PRÊT / OCCASION / LOCATION / ACHAT = tons LkvChip sage/warn/info/stone » | DIFFÉRENT : aucun composant LkvChip dans src (§6) |

## 6. Pastilles
`LkvChip` n'existe pas dans APP/src (seule occurrence : CLAUDE.md d'APP et le storyboard). Composants réels :
- `src/components/ui/Chip.tsx` (ChipTone = neutral | sage | info | warn | danger). Les tons ne colorent QUE le texte (« rien de plein », l.18) sur fond verre `--g2-bg` (rgb(255 255 255 / calc(0.08 + 0.08 * --glass-intensity, 0.5)), l.738), bordure 1px `--glass-rim` (clair : rgba(255,255,255,0.85), l.528), ombre --glass-specular, backdrop-blur-md :
  - sage : texte --lkv-success #3D6038 ; info : --lkv-info #4B6B7C ; warn : --lkv-warning-dark #765014 ; danger : --lkv-danger-dark #7E2D25 ; neutral : --lkv-text-primary. Pas de ton « stone ». Sélectionné : fond --g3-bg rgba(255,255,255,0.90), texte --g3-text #121815.
- `.cp-chip` (compas.css l.539-567), pastilles pleines teintées : défaut fond rgb(23 43 36 / 0.07) texte ink-900 ; good fond rgb(61 96 56 / 0.14) texte #3D6038 ; warn fond rgb(200 154 59 / 0.2) texte #765014 ; bad fond rgb(168 68 58 / 0.14) texte --cp-bad ; soft fond rgb(150 186 142 / 0.28) + liseré rgb(91 127 85 / 0.38). Hauteur 1.5rem, padding 0 9px, 0.71875rem / 600. Pas de ton info ni stone dans .cp-chip.

## 7. Spinner officiel
`src/components/ui/Spinner.tsx` (« Source unique de vérité pour les indicateurs de chargement »). Dessin : un `<span>` rond, `inline-block rounded-full border-t-transparent animate-spin motion-reduce:animate-none`, bordure 2 px (1 px en xs), diamètres --icon-xs/sm/md(20px)/lg/xl, couleur de bordure par ton : primary --glass-label (clair #101813, sombre #FFFFFF), accent --glass-label-secondary, danger --lkv-danger, inverted --lkv-text-inverted #FFFFFF, muted --lkv-text-muted #46584D, current. Défaut size md, tone primary, role="status" aria-label="Chargement". Animation = `animate-spin` Tailwind (rotation 360° linéaire 1 s). Aucun SVG.

## 8. Icônes SF (160)
alert-circle alert-triangle archive-restore archive arrow-down arrow-left arrow-right-left arrow-right arrow-up-right arrow-up award backpack banknote battery bed-double bell-off bell-ring bell bike book-open bookmark building building2 bus calendar-check calendar-days calendar-plus calendar car check-check check-circle check-circle2 check-square check chevron-down chevron-left chevron-right chevron-up chevrons-up-down circle clipboard-list clock cloud-drizzle cloud-fog cloud-lightning cloud-off cloud-rain-wind cloud-rain cloud-snow cloud-sun cloud coins compass copy credit-card crown download droplet droplets edit2 edit3 ellipsis euro external-link eye-off eye file-check file-text filter flag flame flask-conical footprints globe grip-vertical hand-coins handshake heart-pulse heart help-circle home image-off image-plus info key-round layers leaf link lock log-out mail-plus mail map-pin map message-square-plus message-square mic minus moon-star moon more-horizontal more-vertical mountain navigation package paperclip pause pencil phone-call phone pin plane play plus printer radio recycle refresh-cw reply rotate-ccw route scale search send share2 shield-alert shield-check shield ship shirt shopping-bag shopping-cart siren smile sparkles square star sun sunrise sunset tag tent thermometer ticket train trash2 trending-down trending-up unlock user-minus user-plus user users weight wifi-off wifi wind x-circle x zap 
