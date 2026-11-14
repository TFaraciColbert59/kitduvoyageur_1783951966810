# Handoff Report — Survey Task 1: Codebase & Capacitor iOS Bridge Architecture

## 1. Observation

Direct code observations from read-only inspection of the repository:

### 1.1. Messagerie (`/messagerie`)
- **Route & Shell** : `src/app/messagerie/page.tsx:44-57` monte `<MessagesScreen currentUserId={user?.id ?? null} currentUserProfile={...} />`.
- **Monolithe d'écran** : `src/components/messaging/MessagesScreen.tsx` (2103 lignes) et `src/components/messaging/messages-grammar.css` (1943 lignes).
- **Navigation anormale du Header** :
  - `src/components/messaging/MessagesScreen.tsx:1471` : `<button type="button" className="lg ig-handle" onClick={() => router.push('/compte')} aria-label="Messages — aller au compte">` redirige explicitement vers `/compte`.
  - `src/components/messaging/MessagesScreen.tsx:1480` : `<NotificationBell userId={currentUserId ?? undefined} />` redirige également vers `/compte`.
- **Superposition de la pilule de filtres** :
  - `src/components/messaging/MessagesScreen.tsx:1661-1677` : `<SubCapsuleTabs ... className="mfilters" placement="float" />`.
  - `src/components/messaging/messages-grammar.css:995-1015` : `.lkdv-messages .mfilters { position: absolute !important; right: 12px !important; bottom: 10px !important; z-index: 6 !important; width: 196px !important; }`. Cette capsule flotte au-dessus de `.card-scroll` et masque la 4e discussion (`Dolomites — août`).
- **Bouton "Nouvelle discussion" non fonctionnel** :
  - `src/components/messaging/MessagesScreen.tsx:1441-1444` : `const focusSearch = () => { searchRef.current?.focus({ preventScroll: true }); }`.
  - `src/components/messaging/MessagesScreen.tsx:1628, 1804` : Les boutons "Nouvelle discussion" appellent `onClick={focusSearch}` au lieu d'ouvrir une modale de création.
  - Le composant `src/features/messaging/components/NewConversationModal.tsx` existe mais n'est pas instancié dans `MessagesScreen.tsx`.
- **Doublon d'états vides & Contraste sous `Demandes`** :
  - `src/components/messaging/MessagesScreen.tsx:1598-1644` (état vide supérieur) et `1801-1808` (état vide inférieur dans `.mapzone`).
  - `src/components/compte/compte-v8.css:32` définit `--pg-ink: #17402C;`, appliqué sur `.mbtn.p` avec fond dégradé sombre, provoquant un manque critique de contraste (texte foncé sur fond vert foncé).
- **Tiroirs `ComposerMenuSheet` et `ConversationOptionsSheet` mal positionnés** :
  - `src/features/messaging/components/ComposerMenuSheet.tsx:5, 238` utilise `<AccountDrawerHost variant="card" open={isOpen} ...>`.
  - `src/features/messaging/components/ConversationOptionsSheet.tsx:6, 111` utilise `<AccountDrawerHost variant="card" open={isOpen} ...>`.
  - `src/design/account/AccountDrawerHost.tsx:24` définit `DRAWER_INSET = { top: 48, left: 12, right: 12, bottom: 342.92 }`. Le tiroir s'ouvre donc dans la carte du haut (`y=114..386`) et non en bottom sheet.
- **Gel de la liste sur squelettes lors de l'ouverture d'un groupe** :
  - `src/features/messaging/hooks/useConversations.ts:46` : `setLoading(true)` est appelé systématiquement dans `fetchConversations()`.
  - Lorsqu'un fil s'ouvre, `markAsRead` met à jour Supabase Realtime, qui déclenche `fetchConversations()` ; `setLoading(true)` remplace alors toute la liste par 4 squelettes `.mskel` (`MessagesScreen.tsx:1582-1589`).
- **Réactions aux messages** :
  - `src/components/messaging/MessagesScreen.tsx:798-845` : lorsque `openMenu === message.id`, les émojis et les boutons `Répondre`, `Transférer`, `Copier` sont injectés en ligne dans un `div.mreacts` qui passe sur 2 lignes et pousse les messages suivants.

### 1.2. Design System & Palettes de Couleurs
- **Source unique de vérité** : `src/design/bank.ts` et son compilateur `scripts/generate-design-bank.mjs`.
- **Tokens maîtres** :
  - `surfaces`: `canvas: '#FBFAF6'`, `sauge: '#F5F7F3'`, `surfaceElevated: '#FFFFFF'`, `surfaceGrouped: '#F0F5EE'`.
  - `inks`: `labelPrimary: '#172B24'`, `labelSecondary: '#56665D'`, `labelTertiary: '#46584D'`, `onBrand: '#FFFFFF'`.
  - `brand`: `primary: '#17402C'`, `action: '#226148'`, `secondary: '#5B7F55'`.
- **Détection des noirs et anomalies sombres** :
  - `capacitor.config.ts:75` : `Keyboard: { style: "DARK" as any }` force un clavier sombre iOS dans une application 100% claire.
  - `src/styles/tokens.css:633-720` contient un bloc `.dark` résiduel avec `--lkv-app-bg-fallback: #0b0d12` et `--lkv-on-action: #08150F`.
  - `src/components/compte/compte-apple-hig.css:1797` et `compte-v8.css:717` : `background: #0d1e15 !important;` sur `.ig-tile`.
  - `src/components/messaging/messages-grammar.css:1395, 1410` : ombres `rgba(0, 0, 0, 0.22)`.

### 1.3. Architecture Native iOS Capacitor (`ios/App/App`)
- `capacitor.config.ts` : `appId: "com.lekitduvoyageur.app"`, `backgroundColor: "#17402C"`, `StatusBar: { style: "LIGHT", backgroundColor: "#FBFAF6", overlaysWebView: true }`.
- `ios/App/App/MainViewController.swift:8-12` : hérite de `CAPBridgeViewController`.
- `ios/App/App/SceneDelegate.swift` (1193 lignes) :
  - `LKDVBridgeViewController` monte une instance unique de `WKWebView`.
  - `LKDVNativeTabBarHost` gère la `UITabBar` native avec effet `UIBlurEffect(style: .systemUltraThinMaterialLight)`.
  - `LKDVNativeUIPlugin` (`@objc(LKDVNativeUIPlugin)`) implémente :
    - `presentActions` : Action sheet natif SwiftUI avec `UISheetPresentationController` (`detents: [.medium(), .large()]`, `prefersGrabberVisible = true`, `preferredCornerRadius = 28`, `.listStyle(.insetGrouped)`).
    - `presentPrompt`, `presentDate`, `presentChoices`, `presentPhotos`, `importGPX`, `exportGPX`, `share`, `authenticateBiometric`.
- `src/lib/native/ui.ts` : consommateur TypeScript de `LKDVNativeUI`.
- `src/lib/native/haptics.ts` : retours haptiques natifs via `@capacitor/haptics` (`light`, `medium`, `heavy`, `selection`, etc.).
- `ios/App/App/DesignTokens.generated.swift` : tokens Swift synchronisés automatiquement depuis `src/design/bank.ts`.

---

## 2. Logic Chain

1. **Header Navigation** : `MessagesScreen.tsx:1471` a `onClick={() => router.push('/compte')}` sur le bouton textuel "Messages". L'audit indique que cliquer sur ce titre quitte inopinément la messagerie vers `/compte`. Par conséquent, le remplacement de ce handler par un élément d'en-tête inerte ou un sélecteur interne résoudra directement l'anomalie.
2. **Superposition du filtre** : `messages-grammar.css:995-1015` force `position: absolute !important; bottom: 10px; right: 12px;` sur `.mfilters`. Le défilement de `.card-scroll` fait passer les éléments sous ces coordonnées précises. Par conséquent, l'intégration du `SegmentedControl` dans le flux normal (sous la barre de recherche) supprimera tout risque de collision.
3. **Ouverture des Tiroirs** : `ComposerMenuSheet.tsx` et `ConversationOptionsSheet.tsx` encapsulent leur contenu dans `AccountDrawerHost variant="card"`, dont la règle `DRAWER_INSET` (`top: 48, bottom: 342.92`) restreint l'affichage à la moitié supérieure de l'écran. En migrant vers `src/components/ui/Sheet.tsx` (déjà testé et ancré en `fixed inset-x-0 bottom-0`), les menus s'ouvriront en bas de l'écran avec la poignée 36×5pt officielle.
4. **Bouton Nouvelle Discussion** : `focusSearch()` dans `MessagesScreen.tsx:1441` ne fait qu'un focus input. `NewConversationModal.tsx` est un composant complet mais orphelin. Son branchement restaurera la fonctionnalité attendue.
5. **Gel sur squelettes** : Dans `useConversations.ts:46`, `fetchConversations()` exécute `setLoading(true)`. Tout événement Realtime (comme un accusé de lecture `markAsRead`) déclenche un re-fetch qui repasse `loading` à `true` et efface la liste au profit des squelettes. Conserver `loading: true` uniquement lors du montage initial évitera tout gel visuel.
6. **Tokens & Clavier** : `capacitor.config.ts:75` impose `Keyboard.style: "DARK"`. Basculer cette valeur sur `"LIGHT"` garantit un clavier iOS en accord avec la charte 100% claire.

---

## 3. Caveats

- Les tests physiques sur iPhone 16 Pro (UDID `00008140-000E7D081A0B001C`) et les captures Appium sont du ressort des phases d'implémentation et de vérification physique ; cette enquête s'est concentrée sur l'analyse statique et dynamique du code source et de la configuration Xcode.
- La base de données Supabase distante n'a pas été modifiée durant cette phase (mode lecture seule strict).
- Les 12 fichiers identifiés sur les routes condamnées lors de la session précédente n'ont pas d'incidence sur la messagerie (`/messagerie`).

---

## 4. Conclusion

1. L'architecture globale de `/messagerie` est hautement réutilisable mais souffre d'un composant écran monolithique (`MessagesScreen.tsx`) contenant des branchements erronés (redirection vers `/compte`, `focusSearch` au lieu de modale, injection de drawer haut via `AccountDrawerHost`).
2. Le Design System dispose déjà d'un pivot architectural solide (`src/design/bank.ts` et `scripts/generate-design-bank.mjs`) qui synchronise le Web, Swift (`DesignTokens.generated.swift`) et Android sans aucun noir pur. Les primitives Apple (`SegmentedControl`, `Sheet`, haptics) sont disponibles dans le codebase et prêtes à être intégrées.
3. Le bridge iOS Capacitor (`ios/App/App/SceneDelegate.swift`) est déjà très riche (`LKDVNativeUIPlugin` avec `presentActions`, `presentPrompt`, `presentPhotos`, `importGPX`), mais la messagerie utilisait des composants web ad-hoc plutôt que ce pont natif ou les primitives canoniques.
4. Toutes les anomalies de la Section 5 de l'audit iPhone sont précisément cartographiées avec leur solution technique identifiée.

---

## 5. Verification Method

Pour vérifier indépendamment ces constats :

1. **Vérification de la compilation TypeScript** :
   ```bash
   npx tsc --noEmit
   ```
2. **Vérification de la suite de tests de design & bridge** :
   ```bash
   npx vitest run tests/adversarial-lot2-web-primitives.test.tsx tests/native/native-ui-bridge.spec.ts tests/design/tokens-sync.spec.ts
   ```
3. **Vérification de la synchronisation de la banque de design** :
   ```bash
   node scripts/generate-design-bank.mjs --check
   ```
4. **Vérification de la présence des anomalies dans `MessagesScreen.tsx`** :
   ```bash
   grep -n "router.push('/compte')" src/components/messaging/MessagesScreen.tsx
   grep -n "AccountDrawerHost" src/features/messaging/components/ComposerMenuSheet.tsx src/features/messaging/components/ConversationOptionsSheet.tsx
   grep -n "Keyboard" capacitor.config.ts
   ```
