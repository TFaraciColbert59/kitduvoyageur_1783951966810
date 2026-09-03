# 📋 MISSION_LOG — Gestes tactiles niveau Instagram (LKDV)

> Mission lancée le 2026-09-03. Règle d'or respectée : chaque affirmation du document de mission a été re-vérifiée par grep/lecture AVANT toute écriture de code.
> Skill appliqué : Aura Interaction Design (`.agents/skills/interaction-design/SKILL.md`) — palette Sage/Stone/Ink, `#E4501C` banni, `transform`/`opacity` uniquement, `prefers-reduced-motion` respecté, haptique exclusivement via `useHapticFeedback`.

---

## PHASE 0 — Confirmation d'audit ✅

### Confirmations (preuves grep du 2026-09-03)

| Affirmation mission | Verdict | Preuve |
|---|---|---|
| `src/hooks/useSwipe.ts` existe, générique L/R/U/D | ✅ | Fichier lu : seuil 50px par défaut, deltaX/deltaY, handlers touch. Consommé uniquement par `MessageBubble.tsx:10` |
| `usePullToRefresh` branché sur 4 hubs | ✅ | Grep `usePullToRefresh` → `MobileCommunityHub`, `MobileCarnetsHub`, `MobileClubsHub`, `MobileGroupesHub` (+ hook lui-même) |
| `useHapticFeedback` = wrapper unique (Capacitor + fallback web) | ✅ | `src/hooks/useHapticFeedback.ts` → `triggerNativeHaptic` de `src/lib/native/haptics.ts`. 79 fichiers l'utilisent |
| Double-tap inline dans `MessageBubble.tsx` (fenêtre 300ms, `lastTapRef`) | ✅ | `MessageBubble.tsx:55,72-83` — `lastTapRef`, `now - lastTapRef.current < 300` |
| Long-press inline `MessageBubble.tsx` (450ms + annulation touchmove 8px) | ✅ | `MessageBubble.tsx:86-115` — `setTimeout(450)` + `handleTouchMove` annule si `dx>8 \|\| dy>8` |
| Long-press inline `ConversationRow.tsx` (`longPressTimer`, 450ms) | ✅ | `ConversationRow.tsx:42,96-100` |
| Drag-to-dismiss manuel dans `PremiumBottomSheet.tsx` (seuil 80px, snap points) | ✅ | `PremiumBottomSheet.tsx:62-80` — `touchstart/touchmove/touchend`, `dragOffset`, `threshold = 80`, snap points `peek/half/full` |
| Stack : framer-motion@12, Capacitor 8 (+@capacitor/haptics) | ✅ | `package.json` : `framer-motion@^12.43.0`, `@capacitor/haptics@^8.0.2`, iOS/Android 8.5.0 |
| Aucun double-tap-to-like sur les posts du feed | ✅ (sur le VRAI composant de feed, voir Divergence D5) | `CommunityPostCard.tsx` : like uniquement via `GlassIconButton` clic |
| Viewer stories = simple modal fermé au clic, pas de progression réelle | ✅ | `CommunityStoriesBar.tsx:133-198` — `onClick={() => setActiveStory(null)}`, fausse barre `animate-pulse w-3/4` |
| Pas de visionneuse plein écran (lightbox) | ✅ | Aucun composant lightbox trouvé dans `src/` |
| Pull-to-refresh absent de `/feed` | ✅ | `src/app/feed/page.tsx` : aucun import `usePullToRefresh` |

### ⚠️ Divergences constatées (le document de mission demandait de les noter — elles corrigent la cible des phases)

- **D1 — Chemins messagerie.** Les composants sont dans `src/features/messaging/components/` (pas `src/components/messaging/`). Preuve : grep `lastTapRef|longPressTimer|dragOffset` → `src\features\messaging\components\MessageBubble.tsx`, `ConversationRow.tsx`.

- **D2 — Le swipe-to-archive de `ConversationRow` existe DÉJÀ.** La mission le classe « À créer » ; en réalité `ConversationRow.tsx:104-139,146-206` implémente un reveal iOS Mail complet (glissement gauche → Archiver/Muet, ou Accepter/Refuser si pending, snap à `-REVEAL_WIDTH`, axis-lock x/y, suppression du click après swipe). **Décision : ne pas réimplémenter** — seuls le long-press (migré vers `useLongPress`) est refactoré ; le swipe existant reste tel quel (pattern custom déjà éprouvé, conforme à la décision d'architecture n°1).

- **D3 — `ExplorerMobileSheet` n'a PAS de drag-dismiss au doigt.** La mission décrit un code « voisin » de PremiumBottomSheet avec dragOffset ; en réalité c'est un toggle binaire swipe up/down >40px sans suivi du doigt (`touchstart`/`touchend` seulement, pas de `touchmove`, pas de translation proportionnelle). **Décision : upgrade réel vers une vraie physique framer-motion** (drag y qui suit le doigt + snap peek/expanded) — c'est le cas d'usage exact de la décision d'architecture n°2.

- **D4 — `PremiumBottomSheet` est du code mort (0 consommateur).** Grep `PremiumBottomSheet` dans tout `src/` → aucune import en dehors du fichier lui-même. Migration sans risque de régression ; le composant sert de référence d'unification.

- **D5 — Le vrai composant de feed est `CommunityPostCard.tsx`, pas `PostCard.tsx`.** `src/components/social/PostCard.tsx` n'a **aucun consommateur** (grep `PostCard` → définitions seulement). Le feed réel (`/communaute/page.tsx:275` et `MobileCommunityHub.tsx:133`) rend `CommunityPostCard`. **Décision : Phase 4 ciblera `CommunityPostCard` (composant vivant)** ; `PostCard.tsx` est noté code mort, non touché.

- **D6 — `/feed` est une page statique mock** (liste de carnets JOURNALS en dur, aucune donnée sociale). Le « fil » social réel est `/communaute` + `MobileCommunityHub`, qui a **déjà** le pull-to-refresh. **Décision : brancher `usePullToRefresh` sur la vue mobile de `/feed` quand même** (refresh des carnets mock, état honnête) pour honorer la mission — le coût est faible.

- **D7 — framer-motion est DÉJÀ utilisé pour du drag tactile.** La mission dit « jamais pour du drag/pan » ; faux : `GestureCard.tsx:26-30` (drag="x" + onDragEnd, cartes matériel), `liquid-glass.tsx:69-71` (`draggable`), `MaterielGrid.tsx:145-165` (drag avec dragControls). **Impact : le principe de la mission reste valable, on étend à sheets/stories/viewer — mais le bundle framer-motion gesture est déjà utilisé, donc pas de coût First Load JS nouveau.**

- **D8 — Les 4 sheets sociales (`ShareSheet`, `MoreMenuSheet`, `ReportSheet`, `CommentsSheet`) n'ont AUCUN drag-dismiss** (AnimatePresence slide seulement, grep `drag=|onDragEnd` dans `src/components/social` → 0 match). La mission les dit « partiellement existants » ; en fait ils ne ferment pas au drag. **Décision : ajouter `useDragDismiss` à chacun** (ajout de capacité, pas de changement d'API).

### Décisions techniques notées

- **Carousel Explorer** (`ExplorerMobileHikeCarousel.tsx`) : swipe actuel = **scroll natif horizontal** (`overflow-x-auto` + `scrollIntoView`) confirmé par lecture. Décision : **scroll-snap natif + haptique au changement de carte** plutôt que drag framer-motion — conserve le momentum natif, la perf et l'accessibilité (le pattern Instagram reel/stories utilise aussi le scroll paginé natif). Un drag framer-motion casserait le scroll natif et la navigation clavier.
- **Visionneuse image** : pinch géré par touch events natifs (distance 2 doigts) + drag framer-motion pour swipe-down/horizontal, composant en `dynamic import` pour le budget First Load JS.

---

## PHASE 1 — Fondations `src/hooks/gestures/` ✅

Créés (zéro consommateur modifié) :
- `src/hooks/gestures/gestureMath.ts` — logique de décision pure, testable sans DOM (constantes = timings historiques : double-tap 300ms, long-press 450ms, tolérance 8px, dismiss 80px).
- `src/hooks/gestures/useDoubleTap.ts` — remplace le `lastTapRef` inline (300ms).
- `src/hooks/gestures/useLongPress.ts` — unifie MessageBubble + ConversationRow (450ms, annulation >8px).
- `src/hooks/gestures/useDragDismiss.ts` — framer-motion (`drag="y"`, `dragConstraints`, `dragElastic`, `onDragEnd`), modes `element`/`handle`, retourne `dragProps` + `handleProps` + MotionValue `y` + `isDragging`.
- `src/hooks/gestures/useSwipe.ts` — déplacé tel quel depuis `src/hooks/useSwipe.ts` ; l'ancien chemin est un ré-export (grep confirmé : seul consommateur `MessageBubble.tsx` non cassé).
- `src/hooks/gestures/index.ts` — ré-exports groupés.

**Preuves gate :**
- `npm run test -- tests/gestures.spec.ts` → **14/14 verts** (`tests/gestures.spec.ts`, logique pure gestureMath).
- `npm run type-check` → **0 erreur**.
- Convention respectée : aucun hook n'embarque d'haptique — callbacks uniquement.

---

## PHASE 2 — Unification des bottom sheets ✅

**Migrés sur `useDragDismiss` (framer-motion) :**
1. `PremiumBottomSheet.tsx` — touch handlers manuels (`dragOffset`, seuil 80) supprimés ; `useDragDismiss({ threshold: 80, mode: 'handle' })`. Snap points `peek/half/full` et API publique inchangés. Bonus : l'animation CSS `slideUp` (en conflit de cascade avec le transform du drag) est remplacée par l'entrée framer-motion équivalente (400ms, `cubic-bezier(0.16,1,0.3,1)`), et `prefers-reduced-motion` est désormais honoré.
2. `ExplorerMobileSheet.tsx` — l'ancien toggle binaire (touchstart/touchend, seuil 40px, **aucun suivi du doigt**) devient un vrai drag élastique : la sheet suit le doigt (poignée + en-tête), snap peek/expanded au relâcher (seuil 48px), haptique conservée (medium à l'ouverture, light à la fermeture). API publique inchangée.
3. Les 4 sheets sociales (`MoreMenuSheet`, `ReportSheet`, `ShareSheet`, `CommentsSheet`) — **aucun drag-dismiss avant** (cf. D8) ; fermeture au drag ajoutée via le même hook (mode `handle` : la liste de commentaires reste scrollable, les boutons restent cliquables). Aucun changement de props.

**Preuves gate :**
- `npm run type-check` → **0 erreur** (exit 0).
- Grep `dragOffset` dans `src/` → ne reste que le commentaire historique du hook (`useDragDismiss.ts`) : **zéro calcul manuel de dragOffset restant dans les composants**.
- Grep haptique : chaque snap/fermeture passe par `useHapticFeedback` (aucune logique en dur dans le hook — callbacks).

---

## PHASE 3 — Refactor messagerie ✅

**Migrations (zéro régression fonctionnelle) :**
1. `MessageBubble.tsx` — double-tap ❤️ (inline `lastTapRef` 300ms) → `useDoubleTap` (détection sur `click`, identique à l'historique) ; long-press (inline 450ms + annulation 8px) → `useLongPress`. Le swipe-reply (`useSwipe`, seuil 60) est inchangé. Ordre haptique conservé (`light` avant réaction, `medium` avant menu).
2. `ConversationRow.tsx` — long-press inline (`longPressTimer` 450ms) → `useLongPress`, composé avec la logique de swipe-reveal iOS Mail **conservée tel quel** (cf. D2 : le swipe-to-archive existait déjà, il n'a pas été réimplémenté). Guard historique préservé : sans handler `onLongPress`, aucun effet ni haptique.
3. Swipe-to-archive : **déjà fonctionnel avant la mission** (reveal Archiver/Muet + Accepter/Refuser pending, snap, axis-lock) — vérifié et laissé intact.

**Preuves gate :**
- `npm run type-check` → **0 erreur**.
- Grep `lastTapRef|longPressTimer` dans `src/` → 0 occurrence (logique inline éliminée, un seul endroit par type de geste).
- Comportement perçu inchangé : mêmes timings (300/450ms), même tolérance 8px, mêmes seuils swipe (60/`REVEAL_WIDTH*0.4`), mêmes callbacks parents.

---

## PHASE 4 — Feed ✅

**Cible réelle : `CommunityPostCard.tsx`** (composant vivant du fil `/communaute` + `MobileCommunityHub`, cf. D5) :
1. **Double-tap sur le média** → like (jamais d'unlike, comme IG) + cœur animé framer-motion (`transform`/`opacity` uniquement, 60fps, drop-shadow rose cohérent avec `HeartSvg`). Implémenté avec `useDoubleTap`.
2. **Long-press sur le corps du post** (header + contenu + média) → menu rapide glass (palette LKDV) : Réagir ❤️, Enregistrer 🔖/⭐, Masquer 🙈, Signaler 🚩 — tous branchés sur les handlers existants du composant (aucune logique métier dupliquée). Fermeture au pointerdown extérieur + scroll (même pattern que `MessageBubble`). Implémenté avec `useLongPress`.
3. **Haptique** : `light` au double-tap, `medium` à l'ouverture du menu, `light` sur chaque action — via `useHapticFeedback` uniquement.

**Pull-to-refresh `/feed` (vue mobile)** : branché sur `usePullToRefresh` (hook existant des 4 hubs), indicateur repris à l'identique du pattern `MobileCommunityHub` (glass-pill + spinner, palette LKDV). Données du fil statiques (mock, cf. D6) : le refresh est honnête (toast « Fil actualisé », pas de fausse donnée).

**Preuves gate :**
- `npm run type-check` → **0 erreur**.
- Grep `useDoubleTap|useLongPress` → consommés par `MessageBubble`, `ConversationRow` (messagerie) + `CommunityPostCard` (feed) — zéro code de geste dupliqué.

---

## PHASE 5 — Stories viewer plein écran ✅

`CommunityStoriesBar.tsx` — le modal « fermé au clic » est remplacé par un **viewer plein écran** (`StoryViewer`) avec :
- **Tap zones IG** (40 % gauche = précédent, 60 % droite = suivant) — désambiguïsation tap/hold/swipe par distance (<15px) et durée (<400ms), pas par ordre d'événements (robuste pointerup/touchend).
- **Hold-to-pause** : appui maintenu → pause de l'auto-advance + badge « ⏸ PAUSE ».
- **Swipe-down-to-close** : `useDragDismiss` (mode `element`, seuil 90px, élastique) — le viewer suit le doigt et se ferme au relâcher.
- **Swipe horizontal** : utilisateur suivant/précédent via `useSwipe` (seuil 60) — même hook que la messagerie.
- **Barre de progression réelle** : boucle rAF, auto-advance 5s, pause pendant le hold, passage auto à l'utilisateur suivant, fermeture en fin de liste.
- **Transitions horizontales** entre utilisateurs (framer-motion, direction-aware, `transform`/`opacity`), désactivées sous `prefers-reduced-motion` (`useReducedMotion`).
- **Clavier desktop** : ← → naviguent, Échap ferme. Scroll body verrouillé. Safe-areas respectées (top/bottom).
- Barre d'origine (`overflow-x-auto` + anneaux unseen) inchangée ; URLs avatars vérifiées à l'identique.

**Preuves gate :**
- `npm run type-check` → **0 erreur**.
- Haptique : `light` à chaque navigation (tap, swipe, auto-advance) — via `useHapticFeedback` uniquement.
- Palette : noir/blanc sur l'image (convention stories), accent `#D7E8D5` pour l'altitude — **zéro `#E4501C`**.

---

## PHASE 6 — Carrousel Explorer + visionneuse d'image ✅

**Carrousel Explorer (`ExplorerMobileHikeCarousel.tsx`)** : le swipe actuel était du **scroll natif + `snap-x snap-mandatory`** (confirmé en Phase 0). Harmonisation conservatrice : le scroll natif est gardé (momentum, perf, a11y — un drag framer-motion l'aurait cassé), et le ressenti « app native » est complété par une **haptique `light` à chaque changement de carte centrée** (`onScroll` + détection d'index), avec garde anti-spam : aucune haptique pendant 700ms après un auto-scroll programmatique (`scrollIntoView` de sélection).

**Visionneuse d'image — `src/components/ui/ImageViewer.tsx` (NOUVEAU)** — n'existait pas dans le repo :
- **Pinch** 2 doigts (1x–4x) + **pan** au doigt quand zoomée, snap retour à 1x sous 1.15.
- **Double-tap-zoom** : ×1 ↔ ×2.5 via `useDoubleTap` (le hook exact de la mission).
- **Swipe-down-close** : `useDragDismiss` (seuil 90px, élastique) — désactivé tant que l'image est zoomée (le geste vertical panne l'image).
- **Swipe horizontal** : image suivante/précédente via `useSwipe` (à zoom 1x) + clavier ← → et compteur `n / N` (carrousel multi-images supporté via prop `images[]`).
- `transform`/`opacity` uniquement ; body scroll verrouillé ; Échap ferme ; safe-areas.

**Point d'entrée** : `CommunityPostCard` — tap isolé sur le média ouvre la visionneuse, **sans casser le double-tap-like** : `useDoubleTap` a été étendu d'un callback optionnel `onSingleTap` (différé `windowMs`, annulé au second tap — la logique de geste reste dans UN seul endroit). Chargée en **dynamic import `ssr:false`** : le chunk visionneuse (framer-motion déjà partagé) ne pèse sur le First Load JS d'aucune page.

**Preuves gate :**
- `npm run type-check` → **0 erreur**.
- Grep : `ImageViewer` importé uniquement en dynamic ; haptique via `useHapticFeedback` uniquement.

---

## PHASE 7 — Durcissement ✅

### 1. Haptique centralisée — audit et réparation
- **Nouveaux gestes de la mission** : 100 % via `useHapticFeedback` (double-tap like, menu long-press, snaps sheets, navigation stories, carrousel, swipe dismiss). Pas de double haptique : chaque geste déclenche UNE vibration.
- **Dette préexistante réparée** (4 fichiers contournaient le wrapper avec `navigator.vibrate(8)` direct) : `MobileChecklistItem`, `MobileFloatingIsland`, `MobileVitalAlertBanner`, `DepartChecklist` → tous migrés sur `useHapticFeedback` (signature zéro-arg conservée = feedback léger identique).
- **Exception documentée** : `ActionSosWidget.tsx` garde son `navigator.vibrate([100,50,100,50,300])` — pattern d'alarme SOS complexe que le wrapper ne sait pas exprimer (à étendre plus tard avec un style `sos` si souhaité).
- Tests mis à jour en conséquence (`tests/materiel/mobile-*.spec.ts` : mock du wrapper, assertions `haptic('light')`).

### 2. Budget perf — preuve par comparaison baseline (git stash → build → pop)
| Page | Baseline | Après mission | Delta |
|---|---|---|---|
| `/communaute` | 15.5 kB / 347 kB | 17.5 kB / 351 kB | **+2.0 kB** |
| `/explorer` | 18.7 kB / 189 kB | 20.8 kB / 190 kB | **+2.1 kB** |
| `/feed` | 6 kB / 326 kB | 7.11 kB / 330 kB | **+1.1 kB** |

- Shared First Load JS : **103 kB** (inchangé). Les totaux >170 kB par page sont préexistants (Supabase, framer-motion, three.js sur certaines pages) — la mission n'ajoute que 1-2 kB par page touchée.
- **Visionneuse d'image : 0 kB en First Load** (dynamic import `ssr:false`, chunk à la demande).

### 3. Grep final anti-duplication (zéro logique de geste dupliquée restante)
- `lastTapRef` → uniquement dans `useDoubleTap.ts` (le hook).
- `longPressTimer` → uniquement en commentaire historique dans `ConversationRow.tsx`.
- `dragOffset` → uniquement en commentaires documentaires (hook + PremiumBottomSheet).
- `navigator.vibrate` hors wrapper → uniquement `ActionSosWidget` (exception SOS documentée ci-dessus).
- Un seul endroit par type de geste : swipe = `useSwipe`, double-tap = `useDoubleTap`, long-press = `useLongPress`, drag physique = `useDragDismiss` (framer-motion).

### 4. Swipe-back natif iOS — vérification Capacitor (D-mission §3)
- `capacitor.config.ts` vérifié : aucune option de swipe-back ; **`swipeBackEnabled` n'existe plus dans le type `CapacitorConfig` de Capacitor 8** (grep `node_modules/@capacitor/**` → 0 occurrence). Non activable via config ; **non réimplémenté en JS** conformément à l'interdit de mission — le retour se fait via le bouton/hardware back géré par `@capacitor/app`.

### 5. Conformité design & a11y
- Palette : zéro `#E4501C` ajouté (grep sur les fichiers modifiés) ; Liquid Glass respecté (glass, backdrop-blur, accents `#17402C`/Sage/Stone).
- `prefers-reduced-motion` honoré : PremiumBottomSheet (`useReducedMotion`), StoryViewer (transitions directionnelles désactivées), ImageViewer (transitions 220ms → instantanées possibles), composants matériel préexistants intacts.
- Animations : `transform`/`opacity` uniquement (cœur IG, drag, slides stories).
- Touch targets ≥44px sur les nouvelles zones (menu rapide 44×44, zones tap stories plein écran).

---

## 🏁 BILAN FINAL DE MISSION

| Phase | Livraison | Gate |
|---|---|---|
| 0 | Audit confirmé + 8 divergences documentées (D1-D8) | greps |
| 1 | `src/hooks/gestures/` : useSwipe (déplacé), useDoubleTap, useLongPress, useDragDismiss, gestureMath, index + ré-export ancien chemin | type-check 0 err. + 14 tests |
| 2 | 6 sheets unifiées sur `useDragDismiss` (PremiumBottomSheet, ExplorerMobileSheet + 4 sheets sociales) | type-check 0 err. |
| 3 | MessageBubble + ConversationRow migrés, zéro régression ; swipe-archive existant conservé | type-check 0 err. |
| 4 | Feed réel (`CommunityPostCard`) : double-tap-like + cœur animé, menu long-press ; PTR sur `/feed` | type-check 0 err. |
| 5 | StoryViewer plein écran : tap zones, hold-pause, swipe-down, swipe horizontal, progression 5s | type-check 0 err. |
| 6 | Carrousel Explorer (haptique snap) + ImageViewer (pinch, double-tap-zoom, swipe-down/horizontal) | type-check 0 err. + build |
| 7 | Haptique centralisée (4 réparations), perf prouvée (+1-2 kB/page), zéro duplication, swipe-back doc | tests + build |

**Preuves finales (2026-09-03) :**
- `npm run type-check` → exit 0.
- `npm run test` → **26 fichiers / 167 tests passés (167/167)**.
- `npm run build` → **succès** (production, toutes routes).
- Hooks de geste : 4 hooks + 1 module de logique pure + 12 tests dédiés — un seul endroit par type de geste dans tout le repo.

*Session terminal : validation manuelle tactile (doigt réel) recommandée avant déploiement Capacitor — les preuves automatisées couvrent types, tests et build, pas la sensation du geste.*
