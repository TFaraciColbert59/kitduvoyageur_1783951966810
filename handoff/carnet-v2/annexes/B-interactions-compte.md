# B — Spécification d'INTERACTION de /compte (référence absolue)

Abréviations (chemins sous `src/` du dépôt `kitduvoyageur_1783951966810`) :
RT=components/compte/compte-liquid-glass-v8-runtime.js · TSX=components/compte/CompteLiquidGlassV8.tsx · V8=components/compte/compte-v8.css · HIG=components/compte/compte-apple-hig.css ·
SS=components/compte/drawer/SlotShell.tsx · DS=…/drawer/shell/DrawerShell.tsx · LP=…/drawer/LensPager.tsx · SSEL=…/drawer/SlotSelector.tsx · PDH=…/drawer/ProfileDrawerHost.tsx ·
OS=…/overlay/OverlaySheet.tsx · COH=…/overlay/CompteOverlayHost.tsx · PS=…/overlay/PostSheet.tsx · OV=…/overlay/compte-overlay.css · DRW=…/overlay/compte-drawers.css ·
LC=styles/liquid-capsules.css · LSEL=styles/liquid-selectors.css · DST=styles/drawer-selectors-tabbar.css · TOK=styles/tokens.css · GM=hooks/gestures/gestureMath.ts

AVERTISSEMENT DE FIDÉLITÉ. (1) /compte n'a qu'UNE hauteur de tiroir effective : "card". Les trois hauteurs peek/medium/large (docs/compas/DESIGN_REFERENCE.md:16) sont celles du Compas ; dans /compte
elles ne subsistent que comme CSS mort (V8:241-243, 651-652) car `setDet` et `openSheet` forcent `det="card"` (RT:2126-2140 openSheet, 2191-2207 setDet, 2208 `DETS=["closed","card"]`). (2) Les couches CSS se
surchargent par `!important` ; ce document donne la valeur FINALE (ordre d'import TSX:41-44 : compte-drawers.css → compte-v8.css → compte-apple-hig.css ; DST chargé en dernier, spécificité `:not(#lkdv-tabbar-glass)`).
(3) Le DOM de l'écran est une chaîne HTML injectée (`COMPTE_V8_HTML`, TSX:97) pilotée par un runtime vanilla ; React ne rend que le contenu des tiroirs par portails (TSX:1473-1505).

## 0. Tokens utilisés partout (TOK:253-276)
```
--ease-glass  cubic-bezier(.22,1,.36,1)     --ease-spring cubic-bezier(.34,1.56,.64,1)
--ease-out    cubic-bezier(.16,1,.3,1)      --motion-ease-standard cubic-bezier(.32,.72,0,1)
--motion-ease-accelerate cubic-bezier(.55,0,1,.45)   durées: fast 180, base/med 280, slow 420 ms, sheet 380, page 260, press 110
--motion-press-scale .97 (non utilisé par le runtime : les appuis du runtime sont codés en dur, voir §5)
```
Verre : variables `--ga` (alpha, défaut .19) et `--gb` (flou px, défaut 7) sur `.phone` (V8:21). Couleurs : ink #172B24, forest #17402C, accent #5B7F55, subtle #A6C1A0, mint #EBF2EC (V8:18-21).

## 1. Architecture de l'écran
### 1.1 Cadre
- Mobile (<768 px, `__LKDV_NEXT_PROD`) : `.lkdv-compte-v8` fixed inset 0, 100dvh, `.phone` plein écran sans rayon ni ombre, `transform:none` (V8:954-1000 ; RT:2822-2832 `fit()`). Barre d'état, île et indicateur home : `display:none` (V8:997-1000 ; `.home` V8:397).
- ≥768 px : maquette 390×844 centrée, rayon 54, `box-shadow 0 0 0 8px #10130f…`, mise à l'échelle `sc=min(1,(innerHeight-32)/844, largeurParent/390)` via `transform:scale(sc)` origine 0 0 (RT:2833-2837 ; V8:25-31) ; `G.sc` corrige toutes les mesures (`relRect`, drag tabbar).
- `.phone` = grille 2 lignes : ligne 1 `calc(69% - 46px)` (≈536 px sur 844) = zone haute (`#top`), ligne 2 `1fr` (≈308 px) = carte `#map` (HIG:125-131 final ; V8:36). Transition `grid-template-rows .55s var(--motion-ease-standard)` (HIG:127). Carte agrandie `.mapbig` : lignes `144px 1fr` (HIG:129-131).
  Note : V8:991 (mobile) dit `calc(100% - 176px) 176px`, mais HIG, chargé après avec le même sélecteur, l'emporte.
### 1.2 Pile verticale (z-index, du fond vers l'avant)
```
-1  .bg (photo fond, brightness1.1 saturate1.05)      V8:46
 1  .top (#top)  profil : .ig-top 36px + #card.cs     V8:87
 1  .mapzone > .map (radius 32 32 0 0, touch-action:none) ; .mctl z3 (droite 10 top 14) ; .mgrab z4 ; .callout z4 ; .mopts z30
12  .tabbar/.tb  (desktop) ; fixed centré bas, width min(100vw-28,430), z-index 1250 (DRW:40)   V8:372
20  .sw-wrap#sw  (voile + tiroir)   pointer-events:none, enfant .sheet pointer-events:auto   V8:234
25  .home   30 .status   34 .popv   35 .ctx (aperçu appui long)   38 .rmenu (morph visibilité)   40 .island
1200 .lkdv-compte-overlay (feuilles React : post, enregistrements, trophée…)  1320 si nested  1400 toast  1500 lightbox   OS:125 ; OV:1,54,63
3000 .story (absolute) → fixed inset 0 z-index 9999 quand .on (HIG:1190-1200)
```
Fixe : status, île, tabbar, `.mgrab`, `.mctl`, `.ig-top`. Défile : uniquement `#card .card-scroll` (padding 8 12 56, `overflow-y:auto`, `overscroll-behavior:contain`, scrollbar masquée, HIG:2487-2501) et le corps de chaque tiroir. La carte ne défile jamais.
### 1.3 Zone haute (RT:3322-3418, HIG:2487-2540)
- `.top` padding 50 12 6 (V8:650), gap 5. `.ig-top` : pastille `@handle` (verre, 34 px haut, `.rp`) à gauche ; à droite 3 boutons ronds verre (34 px, V8:661) : `+` créer (`openCreate`), soleil `popv` (affichage), curseurs `openAccountDrawer`.
- `#card.cs` : `flex:1`, radius `var(--card-radius)` 24, overflow hidden ; contient `.card-scroll` (en-tête avatar+3 stats `publications/abonnés/abonnements`, bio, 5 stories « À la une » `.ig-hl-row` grille 5 col, puis `.ig-swipe-view` = grille 3 col ou liste sorties).
- Capsule flottante `.ig-tabs-float` (absolute right 10 bottom 10, z 12) contenant `.ig-tabs` 88×30 : 2 boutons (grille / sorties) et lentille `.ig-th` (HIG:2502-2545, RT:3335-3341).
- Bornes de la card exposées en variables `--card-top/left/right/bottom/radius` sur `.phone` (défauts 48/8/8/60/24, HIG:2470-2476), recalculées par `syncCardBounds()` (RT:2232-2263, rect de `#card` ÷ `G.sc`) à l'ouverture, au push, au resize et 620 ms après un `mapbig`.
### 1.4 Ce que l'ouverture d'un tiroir change dans le décor
- `phone.sheet-open` + `data-sheet-open="true"` + `data-det="card"` (RT:2126-2131). `.tb/.acc/.tabbar` : `opacity 0; pointer-events none; translateY(120%)` en `.25s ease / .35s standard` (HIG:1147-1176). `.mctl` et sélecteur d'échelle 3D : `opacity 0, translateY(12px)`, `.2s ease` (SS:292 l'emporte sur HIG:2059).
- Pas de voile : en `card`, `.scrim{opacity:0; pointer-events:none}` (HIG:2087). Pas de flou du fond, pas de mise à l'échelle du fond. Le fond est rendu inerte (§7).
- Carte « mode contexte » tant que le tiroir Profil est ouvert : `mapzone[data-map-context] .map{filter:saturate(.6) brightness(.97); transition filter .3s}` + badge verre en haut-gauche 26 px (SS:333-335) ; couches de carte réduites au slot actif : vitrine→empreinte, kit→lignees, prets→traces, souvenirs→carnets, communaute→lignees (RT:572-583, 1745-1775) ; snapshot pris à l'entrée et restauré à la fermeture.

## 2. Le tiroir (sheet) — hauteur unique « card »
### 2.1 Géométrie finale
```
.sw-wrap[data-det=card]   top/left/right/bottom = var(--card-*)  overflow:hidden  border-radius:var(--card-radius)  pointer-events:none   HIG:2955-2962
.sheet                    inset:0 dans le wrap, radius:inherit(24), padding:0, transform:translateY(100%) → .in : translateY(0)        HIG:2964-2977
                          transition: transform .72s var(--ease-out)  (dernière règle, HIG:3160) ; pendant .dragging : transition:none
fond verre                rgba(255,255,255, ga+.70 → ga+.64 (46%) → ga+.68), backdrop blur(gb+18px) saturate1.85 brightness1.05, bord .5px rgba(255,255,255,.8)  HIG:2563-2580
ombre                     inset 0 1px 0 #fff95, 0 0 0 .5px rgba(23,43,36,.12), 0 10px 30px rgba(23,43,36,.14)
```
Le tiroir est donc CLIPPÉ dans la card : il monte depuis le bord bas de la card, il ne sort jamais de son cadre et ne recouvre pas la carte du bas.
Contenu interne : `.grab` (poignée) puis soit `.sheet-nav`+`.sh-b`(+`.sh-f`) pour les feuilles « classiques », soit `#lkdv-slot-root`/`#lkdv-drawer-root` pour le contenu React (RT:1839-1869, 1870-1915).
### 2.2 Poignée
`.grab` hauteur 18, `touch-action:none`, `cursor:grab`, marge `0 -13px` (V8:245) ; pastille `span` 38×5 radius 3 `rgba(255,255,255,.82)` (HIG:2096-2101). Bouton retour `.sh-back` (chevron ‹, 32 px verre, `data-a="close"`) affiché seulement si la pile `S.stk` est non vide (RT:1843, HIG:2990-3000 ; `.sheet-nav.has-back{padding-left:36px}`). Aucun tap sur la poignée ne ferme le tiroir runtime (aucun handler de clic).
### 2.3 Ouverture
```js
openSheet(k, tab, det): cancelClose(); S.big=false; syncCardBounds(); captureSheetOpener();   // mémorise document.activeElement (RT:2053-2060)
  S.sh={k,tab,page:0,det:'card'}; renderSheet(); animateSheetIn(); rAF(()=>focus('[data-a=close]')||sheet)   // RT:2110-2145
animateSheetIn(): sheet.transition='none'; sheet.transform='translateY(100%)'; reflow; retirer les inline; wrap.classList.add('in'); sheet.classList.add('anim-in'); retirer 'anim-in' après 820 ms
```
Déclencheurs : boutons `data-a` (clic délégué `phone.click`, RT:2661-2683 ; `preventDefault+stopPropagation`), deep link, appui long. Aucun tap hors du tiroir ne le ferme.
### 2.4 Fermeture
- Échap (§7) ou glissement : `startSheetClose()` → `sheet.transition='transform .56s var(--ease-out)' !important; transform:translateY(100%)`, `G.closing=true`, `sheet.inert=true`, puis `finishClose` à 570 ms (0 si reduced-motion) : vide `#sheet`, `wrap.classList.remove('in','dragging')`, `data-det="closed"` (CSS : `transition:none; visibility:hidden`, HIG:3154), `S.sh=null; S.stk=[]`, retire `sheet-open`, restaure le focus sur l'opener (RT:2061-2083, 2084-2108).
- Glissement (poignée) : voir 2.5. Pas de fermeture par le voile, pas de swipe horizontal de fermeture.
- `data-a="close"` : `if(!popSheet()) setDet('closed')` (RT:2453) — retire d'abord un niveau de pile.
- Passage en carte agrandie (`mapbig`) pendant qu'un tiroir est ouvert : `S.sh=null; renderSheet()` → fermeture IMMÉDIATE, sans animation de sortie (RT:2477-2479).
### 2.5 Glissement vertical du tiroir (RT:2744-2800)
```js
const DRAG_RATIO=.30, DRAG_KNEE=.35, DRAG_RESIST=.35;
pointerdown sur [data-drag] (poignée, .sheet-nav ; un <button> ne démarre que dans .sheet-nav) si tiroir ouvert et !closing:
   st={y,h:sheet.height,t:now}; wrap.add('dragging'); sheet.transition='none'; setPointerCapture (sauf bouton: capture différée)
pointermove: capture dès |dy|>4px; raw=max(0,dy)   // seulement vers le BAS
   dy = raw<=h*.35 ? raw : h*.35 + (raw-h*.35)*.35       // rubber-band: résistance 0.35 au-delà de 35 % de la hauteur
   sheet.transform=translateY(dy); preventDefault si dy>4
pointerup/cancel: v=dy/max(1,Δt) (px/ms); close = dy>h*.30 || v>.55
   transition 'transform .34s var(--motion-ease-standard)' ; close→translateY(h)+inert+finishClose@360ms ; sinon translateY(0) puis nettoyage@360ms
   si dy>8 : suppression du clic fantôme 350 ms ; haptic(close?8:3)
```
Pas de glissement vers le haut, pas de snap intermédiaire, pas de détente.
### 2.6 Contenu interne et défilement
Le corps défile seul : `.sh-b{overflow-y:auto; padding:2 2 8 ; gap:8; scrollbar masquée}` (HIG:2078-2086) ; en React `.lkdv-drawer-pane`/`.lkdv-lens-pane{overflow-y:auto; overscroll-behavior:contain}` (DS:213 ; SS:321). Le geste de fermeture n'est capturé QUE depuis la poignée/`.sheet-nav` : le scroll interne n'est jamais converti en fermeture (pas de « passage du geste au tiroir » au bout du scroll).
Cascade d'entrée des lignes (feuilles classiques uniquement, pas les slots React) : `.sheet.anim-in .sh-b > *{animation:sheetRowIn .45s var(--ease-glass) both}` ; delays 0 / .03 / .06 / .09 s pour les enfants 1-4, .1 s pour le 5ᵉ ; `@keyframes sheetRowIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}` (HIG:3167-3170, 2224-2234).
Pagination interne classique : `per` lignes/page, ajusté en mesurant le débordement (`G.fit`, RT:1990-1996) ; `data-a="pg"` ±1 ; en-tête `.lh` « ‹ 1/3 ›.

## 3. Sous-tiroirs et navigation imbriquée
### 3.1 Trois mécanismes
1. **Pile runtime `S.stk`** (RT:2169-2190) : `pushSheet({k:'item',id})` empile une copie de `S.sh`, ré-affiche `renderSheet()` puis `animateSheetIn()` (le tiroir entier se réarme : `translateY(100%)`→0, .72 s ease-out, cascade de lignes), haptic 8, focus sur le bouton retour. `popSheet()` (RT:2187-2190) : `S.sh=S.stk.pop(); renderSheet()` — retour SANS animation de sortie. Cibles : fiche objet (appui long), coffre `vault`, etc.
2. **Navigation entre sections dans une même feuille classique** : `stab` (onglet), `fnext/fprev` (Précédent / Suivant|Terminer ; Terminer = `popSheet` sinon fermeture). Le corps entrant porte `data-slide=±1` : `lkdvSheetInRight/Left .42s var(--motion-ease-standard)` (`from{opacity:.55; translateX(±100%)}`) ; l'ancien corps est cloné en fantôme `.sh-b-ghost` (position fixed, z 70, `transition transform .42s standard, opacity .42s`) qui part à `translateX(∓102%)` + opacity .2, supprimé après 480 ms (RT:1946-1975 ; V8:934-938).
3. **Feuilles React empilées `CompteOverlayHost`** (COH:37-132, OS) : pile `stack: Entry[]`, `push` dédoublonne par clé (`post:id:pane`, `badge:id`, `gear:id`, `profile:id`, `create:type`, `saved`, `seal`, `trust`) en retirant l'entrée de même clé, `pop` retire le sommet, `closeAll`. Seul le SOMMET est rendu (les niveaux sous-jacents sont démontés → leur état local est perdu ; état conservé seulement via les données déjà chargées et le `bootstrap` mis en cache dans le host). API globale `window.__lkdvOpenPost/Saved/Badge/Gear/Seal/Trust/Create` (COH:64-71). `badge`, `gear`, `trust`, `profile` sont `nested`.
### 3.2 Feuille OverlaySheet (OS:28-180 ; OV)
```
.lkdv-compte-overlay  position:fixed; left/top/width/height = rect de #card (mesuré: resize + scroll capture) ; display:block; overflow:hidden; radius 26 ; z 1200 (nested 1320)
.lkdv-overlay-scrim   inset 0 ; rgba(10,20,14,.32) + blur(6px) ; radius 26 ; clic = onClose           (post: rgba(10,20,14,.34), blur 8px)
.lkdv-overlay-sheet   absolute inset 8px (nested 14px) ; radius 26 (nested 24) ; verre blanc .94-.96 ; role=dialog aria-modal
entrée: @keyframes lkdv-overlay-in{from{translateY(24px);opacity:.65}to{none}} 260 ms var(--ease-out)      OV:3-4
sortie: AUCUNE animation (démontage immédiat), sauf PostSheet (§3.3)
transform inline translateY(dragY) ; transition 'transform .28s var(--ease-glass)' (none si dragActive)
header 52px: titre (h2 15/700) + sous-titre 11 ; bouton fermer 32px rond (zone ±6px) ; corps overflow-y:auto padding 12 14 18 ; footer optionnel
```
Variantes : `post` = pleine card (inset 0, radius 28, fond transparent, photo plein cadre, pilule auteur verre 60 px en haut, pas de croix) ; `saved/create` = inset 8, top 8, hauteur auto, grille 2 col (saved, cartes 4/5 radius 16) ou 3 col (catalogue création, tuiles 84 px) ; `seal` = verre 64 % + radar 128 px. Verrous à l'ouverture : `document.body.style.overflow='hidden'`, `#sheet` runtime reçoit `inert` (restauré à la fermeture), focus sur le 1ᵉʳ focusable (rAF), focus restauré (`setTimeout 0`) à la fermeture (OS:48-69).
### 3.3 Post (PS:20-80, PostDrawer)
Poignée = `<button class="lkdv-post-grab">` 42×5 radius pill `rgba(255,255,255,.78)` à top 7 centrée (OV:202-203). Tap sans drag → `onClose`. Drag : `dragY=max(0,dy)` suivi du doigt ; au relâchement `shouldDismiss(distance, distance/elapsed*1000)` = `distance>80 px || vitesse>500 px/s` (GM:54-75) → `setDragY(520)` puis `onClose` après `SHEET_EXIT_MS=280 ms` ; sinon `dragY=0` (rebond .28 s ease-glass). Le post a aussi un `onDismissGesture`. Chargement : "Chargement…" ; échec : bloc `role=alert` « Publication indisponible » + pastille Réessayer (PostDrawer:104-112). À l'ouverture la carte 3D fait `flyTo({zoom:12.4,pitch:58,bearing:-28,duration:1600})` jusqu'à 24 essais ×400 ms (PostDrawer:84-100).
### 3.4 Drawers React dans le tiroir runtime (RT:1870-1915 ; TSX:1473-1505)
`account_drawer→CompteDrawer`, `followers_sheet→ReseauDrawer`, `outing_drawer→SortieDrawer`, `story_edit_drawer→HighlightEditDrawer`. Le runtime écrit `#lkdv-drawer-root[data-kind]`, appelle `__lkdvMountDrawer(root,kind,props)` → `createPortal`. Changer d'onglet à l'intérieur ne ferme/rouvre PAS le tiroir. Une mutation lancée depuis React utilise `refreshWithoutSheet` (RT:2320) pour ne pas démonter le slot en cours de persistance.
Ouvertures chaînées : Réseau → clic avatar `openUserProfile` → navigation `router.push('/profil/<handle>')` (TSX:622-646) ; Sortie → ouverte avec `openSheet('outing_drawer',0,'card',{outingId})` puis `flyToOuting` en rAF (RT:4823-4829) ; Story à la une → appui long.

## 4. Sélecteurs
### 4.1 Capsule principale 48→56 px : `CapsuleTabs` (components/ui/CapsuleTabs.tsx:51-165), utilisée par `SlotSelector` (SSEL) et `DrawerShell` (DS:108-137)
- Placement : tête du tiroir, `flex:none`, pleine largeur (`.lkdv-slot-topnav` / `.lkdv-drawer-topnav` centrés), tiroir `padding 0 14px`, `gap 8`.
- Hauteur FINALE 56 px, padding 4, radius 999, boutons 48 px haut (min-height 48), icônes 24 px (svg 22) (DST:155-184 > LC:24-98 48 px > DRW 40 px). Verre `--lg-bar-bg` : `linear-gradient(180deg, rgba(255,255,255,ga+.30), rgba(255,255,255,ga+.14) 55%, rgba(255,255,255,ga+.22))`, `blur(7px) saturate1.9 brightness1.07`, ombre `--lg-bar-shadow` (LSEL:16-30), sans bordure. Icône inactive `#172b24`, active `#17402c` ; transition couleur `.2s ease`.
- Lentille `.sel-lens` : absolute top/bottom/left 4, largeur `calc((100% - 8px)/var(--n))`, radius 999, fond `--lg-thumb-bg` (`linear-gradient(180deg, rgba(255,255,255,.62), rgba(255,255,255,.26))`), ombre `inset 0 1px 0 #fff, inset 0 -1px 1px rgba(255,255,255,.5), 0 0 0 .5px rgba(23,43,36,.07), 0 2px 8px rgba(23,43,36,.08)`. Position : `transform:translateX(calc(var(--i)*100%))`, `transition transform .42s cubic-bezier(.32,.72,0,1)` (DST:186-196). Pas de spring (courbe sans dépassement). `--i` peut être fractionnaire pendant un swipe (LP:99-116).
- Slots (ordre fixe, SSEL:14-20) : Vitrine (LayoutGrid), Kit (ShoppingBag), Prêts (ArrowLeftRight), Souvenirs (Bookmark), Communauté (Users) ; icônes seules, libellé en `aria-label`/`title`. Onglets Compte (DS) : Commandes, Notifications, Paramètres, Modifier le profil, Partager (CompteDrawer:53-83).
- Interaction : clic sur onglet non actif → `haptic('selection')` + `onIndexChange` ; clavier ←/→ avec bouclage, Home/End, focus déplacé par rAF ; roving tabindex (actif 0, autres -1) ; `aria-controls` seulement sur l'actif (CapsuleTabs:83-97, 144-149).
- Changement de slot (PDH:216-227) : `dir = indexOf(new) >= indexOf(current) ? 1 : -1` ; `slideSeq++` (clé React → remontage) ; le conteneur `.lkdv-slot-slide[data-dir]` joue `lkdv-slot-in-right|left .34s var(--ease-glass)` : `from{opacity:0; translateX(±16px) scale(.995)} to{none}` sur `.lkdv-slot-panel` (SS:313-316) ; l'index de lentille repasse à 0 ; `__lkdvSetSlot` met à jour l'`aria-label` du tiroir (« Profil · Kit »), la carte (contexte) et vibre 4 ms (RT:2159-2168). L'état d'un slot précédent N'est PAS conservé (remontage).
### 4.2 Mini-capsule de lentilles 30 px (`.lkdv-lens-tabs` dans SlotShell ; `.lkdv-drawer-secondary .ig-tabs` dans DrawerShell)
- Placement : `position:absolute; right:10px; bottom:10px; z-index:14` DANS le tiroir (donc fixe pendant le scroll du contenu), le shell réserve `padding-bottom:54px` (SS:293 ; DS:203 : `calc(56px + safe-area)`).
- Taille : largeur `n×44px (+5)` (`--w`), hauteur 30, padding 2.5, radius 9999, verre `--lg-bar-*` ; boutons 25 px (zone tactile ±10 px par `::after`, DS:220), icônes 15 px.
- Lentille `.ig-th.lens` : top/bottom/left 2.5, hauteur 25, largeur `calc((100% - 4px)/n)` (SS) ou `(100%-5px)/n` (DS), `transform: translateX(index*100%)`, `transition: transform .28s var(--ease-spring)` (HIG:731-743, 1658-1670 : spring AVEC dépassement), fond `--lg-thumb-bg`. Pendant un swipe de lentille la lentille suit le doigt (`translateX(progress*100%)`).
- Appui : `button:active{transform:scale(.92)}` `.12s ease` (HIG:765-767). Actif couleur `#17402c`.
- Lentilles par slot (PDH:88-132) : Vitrine {Stats, Republication, Trophées} · Kit {Kits, Inventaire} · Prêts {Je prête, J'emprunte, Confiance} · Souvenirs {Timeline, Passeport, Souvenirs} · Communauté {Défis, Clubs}. Compte : Commandes→filtres {Toutes, En cours, Passées, Annulées}; Notifications→{Tout, Social, Prêts, Commandes, Système}; autres onglets : pas de mini-capsule (CompteDrawer:86-103). La mini-capsule n'apparaît que si `items.length>1`.
### 4.3 `LensPager` — swipe horizontal entre lentilles (LP:50-305)
```js
viewport: role=group aria-roledescription=carrousel tabIndex=0 touch-action:pan-y overflow:hidden radius 18
track: flex, transform: translateX(calc(-index*100% + dragX px)); transition: (dragging||reduced) ? none : 'transform 420ms var(--ease-glass)'   // LP:273-277
pane: flex 0 0 100%; overflow-y:auto; aria-hidden/inert si inactive
pointerdown (bouton 0, count>=2): axis='pending'; setDragging(true)
pointermove: si |dx|<8 && |dy|<8 → rien ; axis = |dx|>|dy| ? 'x' : 'y' (VERROUILLÉ au 1er franchissement 8 px)
   axis=='x' → setPointerCapture + preventDefault ; axis=='y' → le scroll vertical natif continue
   dx suit le doigt ; aux extrémités: index==0&&dx>0 → min(dx*.24, 12) ; index==last&&dx<0 → max(dx*.24, -12)    // résistance
pointerup: reset(); si axis=='x' : dx<=-48 → index+1 ; dx>=48 → index-1 (seuil 48 px, pas de vélocité)   // GM:39
filets: pointerup/cancel sur window, lostpointercapture → reset
[data-hscroll] (rail de clubs): au pointerdown (capture) viewport.touchAction='auto' jusqu'au pointerup/cancel → le rail reçoit le pan-x
clavier: ArrowLeft/Right sur le pager (pas de bouclage)
```
Synchronisation : `flowRef` = la mini-capsule ; effets : `--i` ou `translateX(i*100%)`, `aria-selected`, classe `cur`, `tabIndex` roving. Toutes les panes des lentilles sont rendues d'emblée (SS:194-212) — pas de lazy intra-slot ; `DrawerShell` est lazy : un onglet n'est rendu qu'après sa 1ʳᵉ visite puis RESTE monté (`visited:Set`, DS:83-92, 156), panes en `absolute inset:0` avec `opacity 0; visibility hidden; translateY(5px) scale(.998)` → actif `opacity 1; transform:none` en `opacity .3s ease, transform .36s var(--ease-glass)` (DS:213-214).
### 4.4 Selector de feuille classique (`.flow`, `.segc.lg-tabs.lens-on`, `.reseau-toggle`, `.ig-sub`) — RT:2007-2050
Lentille `.sel-lens` (`--i`) ou `.th` ; au `pointerdown` sur un bouton : `.pressing` ajouté, lentille forcée `transition .18s var(--ease-spring) !important; translateX(i*100%)`, haptic 4 ; en glissant (>4 px) elle suit le bouton sous le doigt (`floor((x-left)/(w/n))`, `.16s spring`) ; à la fin/leave/cancel : transition et transform inline d'origine restaurés. État `.pressing` : lentille `top/bottom:-6px` (déborde de la capsule), fond `rgba(255,255,255,.15)` (HIG:3199-3208 ; filter brightness(1.06) HIG:3017). Bouton `:active scale(.92)`, `transition transform .12s spring, color .2s`. La hauteur de `.segc.lg-tabs` = 48 px (V8:933). `.flow` : boutons 24 px (V8), lentille `left:3px; width:calc((100% - 6px)/var(--n))`.
### 4.5 Segmented `.segc` (V8:127-132) 
Hauteur 30, padding 2, radius 999, fond `var(--fill)` ; pouce `.th` blanc `box-shadow 0 1px 3px …`, `transition transform .45s var(--ease-spring)`, largeur `calc((100% - 4px)/n)` ; bouton `aria-pressed`, actif font-weight 600.
### 4.6 Tab bar `#tb` (desktop ≥768 uniquement ; masquée <768, V8:1252-1254)
- 5 onglets : HUB, Explorer, Communauté, Messages, Compte (RT:341-347). Placement : absolute `left:14 right:14 bottom:24`, hauteur 54, padding 3, radius 999, verre `.lg`. Lentille `.lens` top/bottom 4, left 3, largeur `calc((100% - 6px)/5)`, `transition transform .55s var(--ease-spring), background .25s, box-shadow .25s` ; initialement sur le 5ᵉ (`translateX(400%)`). Actif : couleur `#2F6B45`, 600.
- Tap : `tabSelect(i)` → lentille `translateX(i*100%)`, haptic 6, puis `router.push('/'+nom)` (`hub, explorer, communaute, messagerie`; l'onglet 4 « compte » ne navigue pas) (RT:2520-2528 ; TSX:635-637).
- Glisser (RT:2719-2741) : pointerdown (sauf `tabMin`), après 6 px horizontaux → capture, classe `.drag` : lentille `top/bottom:-7px`, `transition transform .08s linear`, fond `rgba(255,255,255,.08)`, ombre irisée (rose `rgba(255,120,160,.18)` à gauche, bleu `rgba(90,170,255,.2)` à droite), `translateX(x/sc px) scale(1.18,1)` avec `x=clamp(cx-left-3-w/2, 0, 4w)` et `w=(largeur-6)/5` ; le bouton survolé `.hov` → `scale(1.14)` (.2 s). Relâcher : index = `clamp(round(...),0,4)` → `tabSelect`, suppression du clic 450 ms.
- Repli `tabMin` : déclenché quand la carte est déplacée >6 px (RT:2686-2690) ou quand `.ig-feed` scroll >10 px (retour <2) (RT:4996) ; `.tb` devient un bouton rond 50 px (`right:calc(100% - 14px - 50px)`, un seul bouton `.on`), `.acc` passe à `left:72px; bottom:28px` ; tout tap sur la barre la rétablit (RT:2521). Transitions `left/right/height .5s var(--motion-ease-standard)`.
- Accessoire `#acc` (au-dessus, `bottom:84`, hauteur 42) : bouton KM/% (bascule), lecture `ro1/ro2`, sparkline `#spk` `role=slider` : pointerdown → capture + `scrub(clientX)` (index mois = round(t*11)), haptic 4 à chaque mois, filtre `lit/dim` des tuiles, relâché : retour à l'état neutre après 1600 ms (RT:2711-2716, 3552-3571).
### 4.7 Sélecteur grille/sorties (`.ig-tabs`, 2 boutons)
Clic `igtab` : `S.igTab=+v; S.step=[2,1,3,0][v]; refresh(true)` + haptic 6 → `renderTop()` reconstruit `#top` (la lentille est recréée à sa position finale : le glissement `.28s spring` n'est visible que si le nœud persiste ; en pratique le changement de vue se voit par l'animation de contenu §5.3). Contenu synchronisé : `S.igTab` 0 = grille 3 col (tuiles h 68, gap 3), 1 = sorties (cartes pleine largeur 260 px haut).

## 5. Animations et micro-animations (valeurs finales)
### 5.1 Table des transitions
| Élément | Propriété | Durée / courbe | Source |
|---|---|---|---|
| Entrée tiroir | transform | .72 s ease-out | HIG:3160 |
| Sortie tiroir (Échap) | transform | .56 s ease-out, démontage 570 ms | RT:2091-2097 |
| Fin de glissement | transform | .34 s standard | RT:2786 |
| Grille `.phone` (mapbig) | grid-template-rows | .55 s standard | HIG:127 |
| Lentille capsule 56 px | transform | .42 s standard | DST:195 |
| Mini-lentille `.ig-th` | transform | .28 s spring | HIG:743 |
| Lentille `.flow/.segc` | transform | .45 s spring (th) ; .18/.16 s spring à l'appui | V8:132 ; RT:2024-2038 |
| Lentille tabbar | transform | .55 s spring ; drag .08 s linear | V8:376-379 |
| Pager lentilles | transform | 420 ms ease-glass | LP:276 |
| Pane DrawerShell | opacity/transform | .3 s ease / .36 s ease-glass | DS:214 |
| Slot (entrée) | opacity+translateX(±16) | .34 s ease-glass | SS:313-314 |
| Corps de feuille (slide) | translateX(±100%) | .42 s standard | V8:934-938 |
| Overlay | translateY(24)→0 | 260 ms ease-out | OV:3-4 |
| Overlay drag | transform | .28 s ease-glass | OS:140 |
| Île | width/height/margin/radius | .5 s spring (texte .2 s, delay .16) | V8:53-60 |
| `.popv` | opacity .2 s, transform .35 s spring (depuis scale .9 translateY(-8) origine top-right) | | V8:413 |
| `.mopts` | opacity .18 s, transform .42 s spring (depuis scale .55 translateY(30) origine bottom-right) | | V8:344 |
| `.rmenu` | left/top/width/height .45 s spring ; contenu `.ri` blur 6→0, opacity .25 s delay .12 s | | V8:419-424 |
| `.ctx` (aperçu appui long) | fond opacity .25 s ; `.box` scale .92→1 .35 s spring | | V8:400-403 |
| Interrupteur `.sw` 46×28 | thumb translateX(18) .35 s spring ; fond .25 s (#8DB287) | | V8:146-147 |
| Callout | bottom .45 s standard (132→78 en tabMin, 84 sans acc) | | V8:355 |
| Carte 3D contexte | filter .3 s ease | | SS:333 |
| Story | opacity .28 s ease, transform .3 s standard ; fermeture translateY(≥932px)+opacity 0, démontage 300 ms | | V8:1357-1359 ; RT:3095-3110 |
| Barre de progression story | `stfill 4.4s linear forwards` par slide ; `.hold` = pause | | V8:847-849 |
### 5.2 Appuis (`:active`) — valeurs finales
`.tb button, .pbtn, .gbtn, .mbtn, .chip, .mctl button` : `scale(.96)` en .12 s spring (HIG:96-101 écrase V8:109 `scale(1.04)`) · `.ig-stat` `.96` (+fond blanc .85, `.14s ease`) · `.ig-tile` `.96` (.15 s) · `.ig-hl:active .ig-hl-ring` `.92` (.15 s) · `.ig-handle` `.96` · `.ig-avi-wrap` `.95` · `.voyage-card` `.98` · `.mt` `.93` · `.ig-tabs button`/sélecteurs `.92` (.12 s) · `.pmi-pill-btn` `.9` · `.st-options-rail button` `.92` · `.st-viewcount` `.94` · `.st-viewer-row` `.98` · `.sheet .li.nt` `.995` · `.lkdv-drawer-btn` `.97` · `.lkdv-badge-open` `.98`.
### 5.3 Keyframes
```
zb{40%{scale(1.15)}}  bump{40%{scale(1.06)} .3s}  morph{0%{scaleX(1.18)scaleY(.86);blur(2px)}50%{scaleX(.95)scaleY(1.06);none}100%{none}} .5s spring (pastille après fermeture du menu)
minin{from{opacity:0;translateY(-6px)scale(.98)}} .4s spring (carte-titre en mapbig) · popin{from{opacity:0;scale(.2)}} .42s spring · drawseg (tracé SVG .24 s linear) · ring · burst · pulse{50%{opacity:.3}} 1.6 s (point live) · pulse-live
statbump{0%{scale(.7);opacity:.3}100%{none}} (compteur publications) · stdraw · scanln · lkspin
igSwipeInLeft/Right{from{translateX(∓18%);opacity:.55}to{none}} .32 s ease-glass ; sortie .out-left/.out-right translateX(∓18%) opacity .55 .18 s ease ; .settle .22 s ease-glass (HIG:3175-3182)
lkdv-skel / lkdvDrawerShimmer (§7) · lkdv-compte-boot-shimmer 1.4 s · saveSpin .7 s linear
Post (OV): lkdvLikePop{38%{scale(1.32)rotate(-5deg)}68%{scale(.94)}} · lkdvHeartBurst{0%{opacity0 scale.45}22%{1,scale1.08}60%{scale1}100%{opacity0 scale1.16}} · lkdvOptionsIn · lkdvBubbleIn{from{translateY(-10px)scale(.78)}} cascade · lkdvCountPop · lkdvCommunityPanelIn{from{opacity0 translateY(10px)scale(.985)blur(2px)}}
```
### 5.4 Reflet des bordures `.lg::before`
Bordure conique dont l'angle `--la` suit le pointeur sur `.phone` : `--la = atan2(dy, dx)*180/π + 90` deg (centre du phone), mis à jour en rAF sur `pointermove` ; sur mobile `deviceorientation` : `--la = 140 + gamma*1.6` deg (RT:2564-2572, 5034).
### 5.5 Lentille réfractive (Chrome uniquement)
`lensAll()` (RT:1056-1101) applique à `.tb,.ig-handle,.acc,.gbtn,.mctl,.callout,.ig-tabs, .sheet .flow/.segc/.reseau-toggle…` (éléments ≤420 px de large) un `backdrop-filter:url(#lf…) blur(gb*.55) saturate(1.9) brightness(1.07)` avec carte de déplacement canvas (bisel `clamp(6,round(h*.34),16)`, `scale=min(30,h*.55)`), classe `lens-on` ; rejoué via `lensSoon()` (rAF) à chaque rendu. Absent : flou classique.
### 5.6 prefers-reduced-motion / transparency
`*{transition-duration:.01s!important}` + `.pd, .anim .seg, .anim .pop, .burst, .rp.morph{animation:none}` (V8:431) ; tiroir `transition-duration:.01ms`, cascade de lignes/`.sel-lens`/`.sheet` sans animation (HIG:2235-2241, 2979-2981, 3247) ; `.ig-swipe-view` animation/transition none (HIG:3249) ; `LensPager` : `matchMedia` → `transition:none` (changement possible, sans translation) (LP:70-79, 276) ; `startSheetClose` : démontage à 0 ms (RT:2096) ; skeletons sans shimmer (SS:338 ; DS:235) ; `lkdv-capsule .sel-lens` sans transition (LC:235-240). `prefers-reduced-transparency` : `.lg,.cs` → fond opaque `#FBFAF6` sans flou (V8:79).

## 6. Gestes
| Geste | Zone | Règle | Source |
|---|---|---|---|
| Pan vertical ↓ | poignée / `.sheet-nav` | §2.5 (rubber-band .35 après 35 % ; 30 % ou .55 px/ms) | RT:2744 |
| Pan vertical (post) | `.lkdv-post-grab` | >80 px ou >500 px/s | PS:34-52 |
| Pan horizontal | pager de lentilles | verrou d'axe 8 px, seuil 48 px, résistance .24/12 px | LP |
| Pan horizontal | `.ig-swipe-view` (grille↔sorties) | §6.1 | RT:3419-3516 |
| Pan horizontal | `#tb` | §4.6 | RT:2719 |
| Pan | carte `#tm` | pointer capture, >6 px → `tabMin`, `pan` borné à ±(60+130*(z-1)) ; molette zoom ×1.12 / ÷1.12 ; boutons ×1.4 | RT:2684-2703 |
| Drag poignée carte `#mgrab` | >20 px | `(dy<0) !== S.big` → `mapbig`; clic fantôme supprimé 400 ms | RT:2705-2706 |
| Pan ↓ story | `.story` (hors boutons/entêtes) | `translateY(dy)` si `dy>8 && dy>dx`, opacity `max(.35, 1-dy/700)` ; fermeture si `dy>110` | RT:5003-5032 |
| Tap zones story | `.st-zone` gauche/droite 50 % | précédent / suivant (ignoré si drag ou maintien >250 ms) ; fin de slide (anim `stfill`) → suivant ; dernière → ferme | RT:4932-4933, 4998 |
| Maintien story | `.st-zone,.st-body` | après 220 ms ajoute `.hold` (pause barre) ; retiré au relâcher ; focus champ commentaire = pause | RT:4977, 4999-5000 |
| Appui long | story à la une `.ig-hl` | 500 ms → ouvre le tiroir d'édition (haptic 14, `.bump` .3 s) ; aussi clic droit (contextmenu) ; annulé si >8 px ou scroll ; clic suivant supprimé 450 ms | RT:2531-2543, 2580-2611 |
| Appui long | objet `[data-prod]` | 440 ms → `pushSheet({k:'item'})`, `.lpress` 350 ms, haptic 14 | RT:2620-2632 |
| Appui long | `[data-sim]`, `[data-simseg] button` | 460 ms → aperçu « Si tu valides » (`#ctx`, What-If) ; Valider / Fermer ; haptic 15 | RT:2634-2644, 775-800 |
| Appui long | `.ig-tile` | 460 ms → Peek & Pop (`#ctx` : visuel, tracé, boutons Lire/Voir sur la carte/Épingler/Fermer), haptic 14 | RT:4973-4990 |
| Appui long | pastille `#rpvis` | 520 ms → tiroir « profils » (bascule profil/club) ; tap simple → menu morph | RT:4977 |
| Survol (souris) | `.ig-tile[data-focus]` | met le focus carte (pas au tactile) | RT:4991-4995 |
| Double-tap | — | ABSENT du runtime et des tiroirs lus (la constante `DEFAULT_DOUBLE_TAP_WINDOW_MS=300` existe dans GM:6 mais n'est pas utilisée ici) | — |
Tolérance de mouvement des appuis longs : 8 px (`hypot`). Clic fantôme : `G.sup=Date.now()+Δ; G.supEl=el` ; le gestionnaire de clic ignore tout clic dans `supEl` tant que `Date.now()<G.sup` (RT:2661-2663).
### 6.1 Glissement grille ↔ sorties
`SWIPE_MIN=60, SWIPE_STRONG=120, SWIPE_MAX_Y=44` ; actif seulement si aucun tiroir ouvert et `igTab∈{0,1}`, pointeur primaire, départ dans `.ig-swipe-view`. Armé quand `|dx|>10 && |dx|>|dy|` (classe `.swiping`, suppression du clic 350 ms). Vue grille (tab 0) : capture + `preventDefault`, la vue suit le doigt à `dx*0.45`. Fin : tab 0 → `dx < -60` bascule vers sorties (`out-left` .18 s, après 180 ms re-rendu et `in-right` .32 s, haptic 6) sinon `settle` (retour .22 s). Vue sorties (tab 1) → retour grille si départ sur le bord gauche `.ig-swipe-back` (24 px) avec `dx<-60`, ou `dx<-120` et `|dy|<44` (le code teste `dx` NÉGATIF dans les deux cas). `.ig-swipe-view[data-tab=0]{touch-action:pan-y}`.
### 6.2 Retour haptique (web : `navigator.vibrate`, RT:272 ; React : `haptic('selection')`, hooks/useHapticFeedback)
```
appui sélecteur 4 · changement de slot 4 · onglet de feuille 5 · fnext 5 · tabSelect/igtab/stab 6 · ouverture slot 6 · swipe vue 6 · épingle carte 6
ouverture tiroir/ pushSheet/ mapbig/ vismenu/ islandNext/ story ouvre-ferme 8 · fermeture par drag 8, annulation 3 · mutation appliquée 10, no-op [8,40,8] · undo 12
appui long 14 (aperçu What-If 15) · cycle fav/like [12,25] · cascade d'actions [10,30],[12,30],[10,25],[8,30…]
```

## 7. Logique d'affichage
### 7.1 États de chargement (TSX:392-424, 1377)
- `data-boot="loading"` tant que `authLoading` ou (user && bootstrap `idle|loading`) : enfants de `#card` et de `.ig-top` à `opacity:0; pointer-events:none` (transition .28 s), `#card::after` = verre qui scintille (inset 14, radius 18, dégradé 200 % `lkdv-compte-boot-shimmer 1.4s ease-in-out infinite`, DRW:218-246). La maquette par défaut du runtime n'est jamais visible.
- Invité (pas d'utilisateur) : `hydrate({isDemo:true, …données de démo})`, viewer forcé `visitor`, aucune entrée propriétaire. Connecté : phase `loading` → squelette dans le tiroir ouvert ; `ready` ; `error` → bloc d'erreur « Impossible de charger ce profil. » + Réessayer (relance `syncSupabaseProfile`). Seul `boot.authenticated===true` donne `viewer:'owner'` (TSX:401-424).
- Squelette slot (SS:45-53, 323-332) : conteneur centré, 3 barres : `lg` 72 px radius 16, `normal` 14 px radius 9, `sm` 62 % de large ; fond `linear-gradient(90deg, rgba(23,43,36,.06), rgba(255,255,255,.72), rgba(23,43,36,.06))`, `background-size:220% 100%`, `lkdv-skel 1.3s ease-in-out infinite` (`120%→-120%`). Squelette DrawerShell : 3 barres 64 px radius 18, `lkdvDrawerShimmer 1.4s` (`200%→-200%`, DS:221-234).
- Vide : `○` + texte (« Aucun contenu pour le moment. ») `role` non alerte ; erreur : pastille `!` 38 px + message + bouton Réessayer 34 px (`role=alert`). `DrawerEmpty(title,hint,action)` pour les drawers. Chaque lentille est enveloppée d'un `SlotErrorBoundary` (« Ce volet n'a pas pu s'afficher. Les autres volets du profil restent disponibles. » + Réessayer ; reset par `resetKey slot-lens`). La carte est enveloppée d'un boundary (« Carte momentanément indisponible »).
- Verrou compte privé : visiteur + profil `prive` + non invité → `PrivateAccountLock` remplace TOUT le shell (sélecteur compris) ; le propriétaire voit toujours ses slots (PDH:239).
- Non connecté dans CompteDrawer : `DrawerAuthRequired` (« Connecte-toi pour accéder à ton compte ») ; auth en cours : `DrawerSkeleton`.
- Carte 3D chargée en différé : `IntersectionObserver rootMargin 120px` → `requestIdleCallback(timeout 1800)` (sinon `setTimeout 700` ; sans IO `2800 ms`) (TSX:468-495). Barre de chargement « Initialisation du Relief 3D… ». Sélecteur d'échelle 3D (Orbite/Massif/Sentier) en bas de carte, masqué quand un tiroir est ouvert.
### 7.2 Qui s'affiche quand
- État initial : aucun tiroir (`data-det="closed"`, `#sheet inert`), vue grille (`igTab 0`), `step 0`, `slot vitrine`, carte réduite, tabbar visible (desktop), île au repos `idle`.
- Deep link `?tab=` (prop `initialTab`, appliquée UNE fois, après `authLoading` et après le bootstrap pour un connecté, TSX:796-840) : `carnets`→`igtab 0`+`openStep 2:0` · `aventures`→`igtab 1`+`openStep 1:0` · `clubs`→`igtab 3`+`__lkdvOpenSlot('communaute')` · `commandes`→`openAccountDrawer()` · `notifications`→`openAccountDrawer(1)` · `parametres`→`openAccountDrawer(2)` · `fidelite`→`openStep 3:3` · `kits|kit`→`__lkdvOpenSlot('kit')` · `progression`→`sealzoom` (feuille Empreinte).
- Mapping `openStep "s:t"` : s=0 → slot vitrine (ou `communaute` si t==="3") ; s=1 Aventures (feuille classique, onglets en `segc lg-tabs`), 2 Carnets, 3 Lignées, 4 Réglages (flow `Pratique, Voyageur, Empreinte, Cordée, Tribu, Vie privée…`).
- Île dynamique (feuilles de statut, RT:804-835) : `island(titre, sous-titre, undoable)` → état `note` (366 px de large, ramené à 41-43 px haut, top 5, radius 21 par V8:927-930), annonce `aria-live=polite` (#live-status `sr-only`, `aria-atomic`), repos après 3800 ms ; `islandNext` (prochaine décision, bouton Appliquer) 5500 ms ; bouton Annuler (pile `U` max 40 ; `profilevis` jamais annulable) ; Ctrl/Cmd+Z = annuler.
- Visibilité profil : pastille `@handle` → menu morph (§5.1) ; contenu actuel du menu : un seul item « Se déconnecter » (RT:3519-3541) → `signout` → `signOut()` puis `router.push('/connexion')` quand la session est confirmée (TSX:779-792).
### 7.3 URL / hash / historique
Aucun `hash`, `history.pushState`, ni `popstate`/`hashchange` n'est utilisé par /compte : l'état d'ouverture des tiroirs n'est PAS reflété dans l'URL et le bouton retour du navigateur ne ferme pas un tiroir (il quitte la page). Seul le paramètre d'entrée `?tab=` est lu (une fois). Navigations réelles : `router.push` (`/hub`, `/explorer`, `/communaute`, `/messagerie`, `/profil/<handle>`, `/connexion`, `/compte/modifier`). Persistance locale (`localStorage`, clé `lkdv_compte_v8_state_v1:<userId|guest>`, uniquement `__LKDV_NEXT_PROD`) : `vis, pins, note, orient, traveller, draftPublished, creditUsed, sosShare, extraHl, spPins, invs` ; `lkdv_inventory_items_v1`, `lkdv_device_medical_vault_v1`, `lkdv_forked_kit_v1`. L'index de lentille, le slot courant et le scroll NE sont PAS mémorisés (retour à 0 à chaque changement de slot).
### 7.4 Échap et retour (ordre de priorité réel)
```js
// capture, document: story ouverte → stopImmediatePropagation(); closeStory()                              RT:5036
// document (RT:2806-2815):  ctx ouvert → closeCtx()  sinon rmenu → closeVisMenu() sinon popv → fermer sinon mopts → fermer
//                           sinon si S.sh → setDet('closed')  (ferme TOUT le tiroir y compris la pile S.stk, avec animation de sortie .56 s)
// post legacy: menu d'options ouvert → le fermer et rendre le focus au déclencheur, sinon closePostModal()  RT:2646-2658
// OverlaySheet: onKeyDown sur la feuille: Escape → preventDefault + onClose() (ferme le sommet de pile seulement)  OS:91-97
// Tab / Shift+Tab: piège aux bornes de #sheet (RT:2213-2225, nextSheetFocus) ; piège séparé dans OverlaySheet (OS:98-113)
// Flèches: ←/→ sur capsules (bouclage) et sur le pager (sans bouclage) ; Enter dans #q/#say envoie
```
Ctrl/Cmd+Z : annulation de la dernière mutation (RT:2803). Le bouton « Retour » (chevron) pop la pile ; il n'existe pas de bouton « fermer » visible dans un tiroir sans pile : fermeture = glisser la poignée, Échap, ou geste de retour.
### 7.5 Focus et accessibilité
- Ouverture : focus sur `[data-a="close"]` sinon sur `#sheet` (`tabIndex=-1`) en rAF ; `aria-label` du tiroir = « Profil · <slot> » / « Compte & Activité » / « Abonnés|Abonnements » / « Sortie » / « Story à la une » / titre de feuille (RT:1840, 1877-1883).
- `applySheetModalState` (RT:115-168) : `aria-modal="true"` sur `#sheet` ; sur `#phone > .status, .island, .top, .mapzone, .tabbar, .home` : `inert` + `aria-hidden="true"` avec restauration EXACTE des valeurs précédentes (WeakMap) à la fermeture. Les popovers/menus restent hors liste (utilisables depuis une feuille).
- Fermeture : `#sheet.inert=true` immédiatement, focus rendu à l'élément ouvrant (référence, sinon re-sélection par `[data-a][data-v]`) (RT:2053-2104). Re-rendu de feuille : le focus est restauré sur le même `data-a/data-v` (RT:1969-1973) ; idem pour `renderTop` (`#top`/`#card`, RT:3405-3412).
- Rôles : tablists `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls` (actif), `aria-orientation=horizontal`, roving tabindex ; panes inactives `aria-hidden`+`inert` ; carrousel `aria-roledescription="carrousel"` ; île `role=status aria-live=polite` ; commutateurs `role=switch aria-checked` ; slider chronologie `role=slider tabindex=0` ; boutons `aria-expanded` (popv, mopts, vismenu `aria-haspopup=menu`) ; images décoratives `alt=""`.
- Focus visible : `.phone :focus-visible{outline:2px solid #5B7F55; outline-offset:2px}` (V8:43) ; sélecteurs `box-shadow inset 0 0 0 2px #17402C, inset 0 0 0 4px #fff` (HIG:2040-2050) ; capsules du tiroir `outline 2px #5b7f55; offset -4px` (DST:90-94).
- Cibles tactiles : boutons ≥ 44 px effectifs (capsule 48 px, zones étendues par `::after` ±6/±10 px) ; contraste renforcé `.sub,.note,.disc{color:#38483f}` (HIG:112) ; mode extérieur (`data-outdoor` / `.outdoor`) : `--ga:.9; --gb:30px; font-size 15px`, bordures renforcées (V8:41, 942-955).
- Lecteur d'écran : `#live-status` annonce chaque `island()` ; chaque `data-a="close"` a `aria-label="Retour"`.

## 8. Recette de recréation HTML/JS autonome (résumé exécutable)
```js
const E={glass:'cubic-bezier(.22,1,.36,1)',spring:'cubic-bezier(.34,1.56,.64,1)',out:'cubic-bezier(.16,1,.3,1)',std:'cubic-bezier(.32,.72,0,1)'};
// 1. phone 390x844, grid rows calc(69% - 46px) 1fr ; card=#card (radius 24) ; map row2 ; tabbar fixed bottom
// 2. sheetWrap = div absolute @ rect(#card) overflow:hidden radius 24 ; sheet inset 0, translateY(100%) ; open: add .in → transform .72s E.out ; rows cascade .45s E.glass delays 0/.03/.06/.09
// 3. close(): sheet.style.transition='transform .56s '+E.out ; translateY(100%) ; setTimeout(finish, reduce?0:570) ; finish: inert, restore focus
// 4. drag handle: dy=raw<=h*.35?raw:h*.35+(raw-h*.35)*.35 ; release: close if dy>h*.30||v>.55 px/ms ; transition .34s E.std
// 5. capsule: --i → translateX(calc(var(--i)*100%)) .42s E.std ; mini-capsule lens .28s E.spring ; pager 420ms E.glass, axis lock 8px, threshold 48px, edge resist *.24 max 12px
// 6. page behind: inert+aria-hidden while open ; Esc closes whole sheet ; Tab trap ; focus returns to opener
// 7. overlay stack (post/saved/badge…) : only top rendered ; scrim blur 6px .32 ; post drag-dismiss >80px || >500px/s then 280ms
```
