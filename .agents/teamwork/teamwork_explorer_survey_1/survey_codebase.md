# Rapport d'Enquête Technique : Codebase LKDV & Architecture Native iOS Capacitor

**Date** : 2026-11-14  
**Agent** : `teamwork_explorer_survey_1`  
**Périmètre** : `/messagerie`, Design System / CSS / Palettes, Bridge Natif Capacitor iOS (`ios/App/App`)  

---

## 1. Analyse Détaillée de la Page `/messagerie`

### 1.1. Routage & Point d'Entrée
- **Fichier de route** : `src/app/messagerie/page.tsx`
  - Utilise `"use client"`.
  - Récupère l'état d'authentification via `useAuth()` (`user`, `profile`, `loading`).
  - Gère l'encart clavier via `useKeyboardInset()`.
  - Délègue l'intégralité du rendu à `<MessagesScreen currentUserId={user?.id ?? null} currentUserProfile={...} />`.
- **Layout** : `src/app/messagerie/layout.tsx` (métadonnées canoniques).
- **Règles de réécriture / proxy** : `src/middleware.ts` inclut `/messagerie` dans les routes protégées / publiques autorisées.
- **Registre des routes** : `src/constants/routeRegistry.json` (`destination: "/messagerie"`).

---

### 1.2. Architecture des Composants & Hiérarchie

La messagerie repose sur deux dossiers principaux :
1. `src/components/messaging/` : Composant d'écran monolithique et styles de grammaire.
   - `MessagesScreen.tsx` (2103 lignes) : Shell principal, gestion split 40/60, liste des conversations, fil actif, composer, recherche transverse.
   - `messagesModel.ts` (87 lignes) : Modèle pur (filtrage, aperçu des messages, calculs de swipe).
   - `messages-grammar.css` (1943 lignes) : Règles CSS du fil, bulles, composer, capsules.
2. `src/features/messaging/` : Services, hooks et composants modulaires.
   - `services/messagingService.ts` (1511 lignes) : Service Supabase pour messages, conversations directes/groupes, pièces jointes, accusés de lecture, recherche, blocages.
   - `hooks/useConversations.ts` : Récupération des conversations et souscription Realtime Supabase (`conversation_members` et `conversations`).
   - `hooks/useMessages.ts` : Récupération paginée des messages d'un fil et souscription Realtime (`messages`).
   - `hooks/useRealtimeMessaging.ts` : Indicateur de saisie en temps réel (`typingUserNames`, `sendTypingSignal`).
   - `hooks/useKeyboardInset.ts` : Mesure de l'encart clavier sur mobile.
   - `components/ComposerMenuSheet.tsx` (898 lignes) : Menu de partage d'équipements, randos, traces GPX, kits et photos.
   - `components/ConversationOptionsSheet.tsx` (340 lignes) : Fiche de contact / options de conversation.
   - `components/NewConversationModal.tsx` (188 lignes) : Annuaire modal de recherche et création de nouvelle discussion (non branché actuellement).
   - `components/MobileSheet.tsx` (34 lignes) : Wrapper canonique au-dessus de `src/components/ui/Sheet.tsx`.
   - `components/SharedPostEmbed.tsx` (87 lignes) : Intégration d'un post communautaire dans une bulle.
   - `components/GroupSettingsModal.tsx` (348 lignes) : Paramètres de groupe.

---

### 1.3. Diagnostic des Anomalies Identifiées dans l'Audit iPhone

| Anomalie Audit | Localisation Exacte dans le Code | Cause Racine Technique Identifiée | Correction Recommandée |
|---|---|---|---|
| **1. Bouton "Messages" et Cloche redirigent vers `/compte` avec flash noir** | `MessagesScreen.tsx:1468-1481` | `<button type="button" className="lg ig-handle" onClick={() => router.push('/compte')} aria-label="Messages — aller au compte">` : le bouton titre et `NotificationBell` appellent directement `router.push('/compte')` au lieu de rester sur `/messagerie` ! | Remplacer par un titre statique accessible ou un sélecteur de vue in-situ sans redirection externe. |
| **2. Superposition de la pilule flottante de filtres sur la 4e discussion** | `MessagesScreen.tsx:1661-1677` et `messages-grammar.css:995-1015` | `.lkdv-messages .mfilters` a `position: absolute !important; bottom: 10px; right: 12px; z-index: 6; width: 196px;` flottant directement au-dessus de la zone défilante `.card-scroll`. | Déplacer le sélecteur de filtre (`SegmentedControl` Apple HIG) en en-tête fixe sous la barre de recherche ou intégré au flux supérieur sans superposition absolue sur les rangées. |
| **3. Disproportion 40/60 & zone vide** | `MessagesScreen.tsx:1170-1202, 1729-1808` | Le split initial est calculé à 60% hauteur écran pour la liste (`computeDefaultSplit`), laissant un bloc vide "Choisissez une discussion" de 40% en bas, ou inversement sur iPhone compact (seules 3,5 lignes visibles). | Permettre un affichage adaptatif (liste pleine page sur mobile avec transition vers le fil lors de la sélection, ou split rééquilibré avec premier message visible sans masquage). |
| **4. Bouton "Nouvelle discussion" inopérant** | `MessagesScreen.tsx:1441-1444, 1627-1641, 1804-1806` | La fonction `focusSearch = () => { searchRef.current?.focus() }` ne fait que donner le focus à la recherche locale de messages/discussions. Le composant dédié `NewConversationModal.tsx` existe déjà dans `src/features/messaging/components/NewConversationModal.tsx` mais n'était pas instancié ! | Instancier et ouvrir `NewConversationModal` (ou bottom sheet dédiée) au clic sur "Nouvelle discussion". |
| **5. Filtre `Demandes` : Contraste illisible & Doublon d'états vides** | `MessagesScreen.tsx:1598-1644` et `1801-1808`, `compte-v8.css:32` | 1) `visible.length === 0` affiche simultanément un état vide en haut ET en bas quand aucune conversation n'est sélectionnée. 2) `.mbtn.p` hérite de `--pg-ink: #17402C` avec fond sombre `--pg`, provoquant un texte noir/sombre sur fond vert `#19442c` / `#17402c`. | N'afficher qu'un seul état vide cohérent ; forcer `--pg-ink: #FFFFFF` sur bouton primaire sombre ; câbler le bouton sur `NewConversationModal`. |
| **6. En-tête de conversation & Poignée masquant le premier message** | `MessagesScreen.tsx:1682-1785`, `messages-grammar.css:1909-1915, 360-370` | `.lkdv-messages .mapzone > .msplit` est à `top: 2px; left: 50%`. `.mpill` a `margin: 8px 12px 6px; max-width: min(78%, 300px);`. Pour un groupe ("Bivouac de printemps · 5 membres"), `.mpill` dépasse les 50% et heurte la poignée. Le conteneur `.mthread` n'a pas de padding-top suffisant, glissant le 1er message sous l'en-tête. | Ajouter un padding-top dédié (minimum 54px) sur `.mthread` ; ajuster la disposition de l'en-tête pour séparer la poignée de la capsule de titre. |
| **7. Blocage sur squelettes gris & "Publication indisponible"** | `useConversations.ts:46`, `MessagesScreen.tsx:1582-1589`, `SharedPostEmbed.tsx:72` | 1) Lors de l'ouverture d'un message, `markAsRead` met à jour Supabase Realtime, qui rappelle `fetchConversations()`, lequel appelle `setLoading(true)` à chaque rafraîchissement en tâche de fond ! Cela remplace instantanément la liste par 4 squelettes `.mskel`. 2) `SharedPostEmbed.tsx` bascule en `failed=true` si la requête Supabase de post échoue ou n'est pas trouvée. | Empêcher `setLoading(true)` lors des rafraîchissements en tâche de fond (conserver les données existantes) ; sécuriser le fallback de `SharedPostEmbed`. |
| **8. Tiroirs `ComposerMenuSheet` et `ConversationOptionsSheet` ouverts en haut au lieu de bottom sheet** | `ComposerMenuSheet.tsx:5, 238`, `ConversationOptionsSheet.tsx:6, 111` | Les deux composants importent `<AccountDrawerHost variant="card">` qui applique en dur `DRAWER_INSET = { top: 48, left: 12, right: 12, bottom: 342.92 }` ! Ils se logent donc dans la carte haute (`y=114..386`) au lieu d'une vraie feuille basse. Les cartes du bas sont coupées par le conteneur à hauteur fixe. | Remplacer `AccountDrawerHost` par la primitive canonique `Sheet` / `MobileSheet` (`fixed inset-x-0 bottom-0`) avec détent adaptatif (`medium` / `large`) et poignée Apple HIG 36×5pt. |
| **9. Barre d'emojis de réaction cassée sur 2 lignes** | `MessagesScreen.tsx:798-845` | Quand `openMenu === message.id`, les 6 émojis + Répondre + Transférer + Copier sont injectés inline dans un `<div className="mreacts">` au flux du message, brisant sur deux lignes. | Extraire la barre de réactions en capsule flottante indépendante (style `UIContextMenuInteraction` / iMessage) positionnée au-dessus de la bulle ciblée, avec menu contextuel d'actions structuré. |

---

## 2. Design System, CSS/Tailwind & Palettes de Couleurs

### 2.1. Source Unique de Vérité : `src/design/bank.ts`
Le fichier maître `src/design/bank.ts` centralise tous les tokens LKDV :
- **Surfaces** :
  - `canvas`: `#FBFAF6` (fond principal toile claire)
  - `sauge`: `#F5F7F3` (fond doux)
  - `surfaceElevated`: `#FFFFFF`
  - `surfaceGrouped`: `#F0F5EE` (pour listes inset grouped iOS)
  - `surfaceMuted`: `#EDF1EA`
  - `border`: `rgba(23, 43, 36, 0.12)`
- **Encres / Typographie** (Zéro noir pur `#000000` ni `#121815`) :
  - `labelPrimary`: `#172B24` (vert forêt profond, contraste WCAG AAA > 12:1)
  - `labelSecondary`: `#56665D` (vert forêt moyen WCAG AA > 4.8:1)
  - `labelTertiary`: `#46584D`
  - `labelQuaternary`: `#8C9790`
  - `onBrand` / `onAction`: `#FFFFFF`
- **Marque & Actions LKDV** :
  - `primary`: `#17402C` (vert forêt de marque)
  - `action`: `#226148` (vert d'action dynamique)
  - `secondary`: `#5B7F55` (sauge de contraste)
  - `primarySubtle`: `#D3EBD9`
- **Générateur multi-cibles** : `scripts/generate-design-bank.mjs` compile `bank.ts` vers :
  1. `src/styles/tokens.generated.css`
  2. `src/design/tokens.generated.ts`
  3. `tailwind.preset.generated.js` et `.cjs`
  4. `ios/App/App/DesignTokens.generated.swift` (Natif Swift)
  5. `android/app/src/main/res/values/design_tokens.generated.xml` & `LKDVTheme.generated.kt`

### 2.2. Audit des Noirs Purs et Arrière-plans Sombres Accidentels

1. **`capacitor.config.ts` (Ligne 75)** :
   ```typescript
   Keyboard: {
     resize: "body" as any,
     style: "DARK" as any, // ⚠️ ANOMALIE : force le clavier iOS sombre sur une app 100% claire !
     resizeOnFullScreen: true,
   }
   ```
   *Correction* : Remplacer par `style: "LIGHT" as any` ou `DEFAULT`.

2. **Masques CSS et gradients dans la messagerie** :
   - `ComposerMenuSheet.tsx:54-55` : `-webkit-mask-image: linear-gradient(..., #000 10px, #000 ...)` (masque WebKit toléré pour l'alpha, mais doit être standardisé).
   - `messages-grammar.css:1395, 1410` : `box-shadow: 0 4px 18px rgba(0, 0, 0, 0.22);` -> Remplacer par l'élévation verte canonique `rgba(23, 64, 44, 0.12)`.
   - `compte-apple-hig.css:1797` et `compte-v8.css:717` : `background: #0d1e15 !important;` (vignettes grises/charbon).
   - `compte-v8.css:35-37` : `box-shadow: 0 0 0 8px #10130f, 0 0 0 9px rgba(0,0,0,.2)`.

3. **Tokens Apple HIG & Primitives WebKit disponibles** :
   - Primitives typographiques système : `font: -apple-system-body`, `-apple-system-headline`, `-apple-system-subheadline`, `-apple-system-footnote`, `-apple-system-caption1`, `-apple-system-caption2`.
   - Primitives de matières : `-webkit-backdrop-filter: blur(20px) saturate(180%)`.
   - Poignée Apple Sheet : `36×5pt` avec `border-radius: 2.5pt` en `rgba(23, 43, 36, 0.22)` (teinte sauge LKDV).
   - Continuous corner radii (squircle) : `border-radius: 24px` avec raccord continu.

---

## 3. Architecture du Pont Natif Capacitor iOS (`ios/App/App`)

### 3.1. Structure du Projet iOS Xcode
- **Dossier natif** : `ios/App/App/`
- **Contrôleur d'entrée** : `MainViewController.swift` (`CAPBridgeViewController`).
- **Délégation d'application & Scène** :
  - `AppDelegate.swift` délègue la scène à `SceneDelegate.swift`.
  - `SceneDelegate.swift` (1193 lignes) implémente l'architecture hôte :
    - `LKDVBridgeViewController` : Dérive de `CAPBridgeViewController`. Maintient **un WKWebView unique persistant** (évite tout rechargement de page ou perte de session).
    - `LKDVNativeTabBarHost` : Hôte de barre d'onglets native UIKit (`UITabBar`) superposée avec `UIBlurEffect(style: .systemUltraThinMaterialLight)`.

### 3.2. Plugins Capacitor Déclarés & Actifs
1. **`LKDVNativeUIPlugin` (`LKDVNativeUI`)** :
   - Méthodes exposées au bridge JavaScript / TypeScript :
     - `setRoute({ path, revision })` : Synchronisation de route bidirectionnelle.
     - `presentActions({ title, message, actions })` : Présentation d'un Action Sheet SwiftUI natif (`LKDVNativeActionsView`) avec `UISheetPresentationController` (`detents: [.medium(), .large()]`, `prefersGrabberVisible = true`, `preferredCornerRadius = 28`, `.listStyle(.insetGrouped)`).
     - `presentPrompt({ title, placeholder, defaultValue, confirmLabel })` : Boîte de saisie native SwiftUI.
     - `presentDate({ title, value })` : Sélecteur de date natif (`UIDatePicker`).
     - `presentChoices({ title, options, selectedId })` : Sélecteur natif de choix.
     - `presentPhotos({ maxCount })` : Sélecteur photo iOS natif (`PHPickerViewController`).
     - `importGPX()` / `exportGPX({ xml, fileName })` : Sélecteur de fichiers GPX (`UIDocumentPickerViewController`).
     - `share({ url })` : Feuille de partage native iOS (`UIActivityViewController`).
     - `authenticateBiometric()` : Authentification biométrique FaceID / TouchID (`LocalAuthentication`).
2. **`LKDVAccountTabBarPlugin`** : Contrôle natif de la barre d'onglets (visibilité, badge, sélection d'onglet).
3. **`LkdvLiveActivityPlugin`** : Gestion des Live Activities iOS (Dynamic Island & Lock Screen via ActivityKit).

### 3.3. Intégration Côté Web / React
- **Client TypeScript du bridge** : `src/lib/native/ui.ts`
  - Méthodes consommables directement par les composants React : `presentNativeActions()`, `presentNativePrompt()`, `presentNativeDate()`, `presentNativeChoices()`, `presentPhotos()`, `importGPX()`, `exportGPX()`, `share()`.
  - Détection de plateforme : `supportsNativeUI()` et `supportsNativeIOSUI()`.
- **Haptics** : `src/lib/native/haptics.ts` & `src/hooks/useHapticFeedback.ts`
  - Utilise `@capacitor/haptics` avec les retours : `light`, `medium`, `heavy`, `rigid`, `selection`, `success`, `warning`, `error`.
  - Intègre le respect strict de `prefers-reduced-motion`.
- **Barre d'état & Safe Areas** :
  - `src/lib/native/status-bar.ts` : Pilote `@capacitor/status-bar` avec `color: "#FBFAF6"`, `style: Style.Light` (icônes sombres sur fond clair), `setOverlaysWebView: true`.
  - Prise en compte de `env(safe-area-inset-top)` et `env(safe-area-inset-bottom)`.

---

## 4. Synthèse & Plan d'Action Recommandé

1. **Design System & Primitives (Lot 1)** :
   - Étendre `src/design/bank.ts` avec les tokens Apple officiels (`-apple-system-*`, métriques grabber `36×5pt`, continuous radii, ombres vertes sans noir).
   - Régénérer les artefacts via `scripts/generate-design-bank.mjs`.
   - Ajuster `capacitor.config.ts` (`Keyboard.style = "LIGHT"`).

2. **Refonte `/messagerie` (Lot 2)** :
   - Nettoyer les boutons d'en-tête (Messages, Cloche) pour supprimer toute fuite vers `/compte`.
   - Remplacer le positionnement absolu de la pilule de filtre `.mfilters` par un `SegmentedControl` Apple HIG ancré proprement.
   - Corriger les tiroirs `ComposerMenuSheet` et `ConversationOptionsSheet` : abandonner `AccountDrawerHost variant="card"` au profit du `Sheet` canonique ancré en bas (`bottom-0`) avec poignée 36×5pt et detents fluides.
   - Brancher `NewConversationModal` sur le bouton "Nouvelle discussion" et dédoubler l'état vide sous `Demandes`.
   - Éliminer le clignotement squelette dans `useConversations` en évitant `setLoading(true)` lors des rafraîchissements Realtime.
   - Extraire la barre de réactions des messages en capsule flottante contextuelle au-dessus de la bulle.
