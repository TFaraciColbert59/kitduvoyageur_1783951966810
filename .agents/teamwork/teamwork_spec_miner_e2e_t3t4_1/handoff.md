# Rapport de Spécification E2E : Tiers 3 (Combinaisons Multi-Fonctionnalités) & 4 (Scénarios Réels)
**Auteur** : `teamwork_spec_miner_e2e_t3t4_1`  
**Destinataire** : Orchestrateur E2E (`8b353675-61d6-4e5a-b238-7710154d9d01`)  
**Périmètre matériel & viewport** : iPhone 16 Pro (`402 × 874 pt`, Retina @3x `1206 × 2622 px`, iOS 18)  
**Date** : 14 novembre 2026  
**Statut** : LIVRÉ / COMPLET

---

## 1. Observation

L'analyse approfondie du code source et des artefacts de spécification a permis de constater les faits techniques et ergonomiques exacts suivants :

1. **Rupture de navigation dans l'en-tête** :
   - Dans `src/components/messaging/MessagesScreen.tsx:1468-1476`, le titre « Messages » (`.ig-handle`) possède `onClick={() => router.push('/compte')}` et `aria-label="Messages — aller au compte"`.
   - Dans `src/components/ui/NotificationBell.tsx:29-36`, l'icône cloche utilise `<Link href="/compte?tab=notifications">`.
   - Constat audit physique (`00-messagerie-main.png`, `messagerie-tree.xml:1471`) : le tap sur ces boutons quitte la messagerie avec un flash sombre `#0d1117`.

2. **Superposition physique du sélecteur de filtres (`SubCapsuleTabs`)** :
   - Dans `src/components/messaging/messages-grammar.css:995-1010`, la classe `.mfilters` applique :
     `position: absolute !important; bottom: 10px !important; right: 12px !important; width: 196px; height: 30px; z-index: 6;`.
   - Constat audit physique (`00-messagerie-main.png`, `02-messagerie-toutes.png`) : la pastille flottante (`x=182..378, y=346..376`) recouvre directement la 4e ligne de conversation (`Dolomites — août`, `y=337..393`).

3. **Collision de coordonnées dans le Split View 40/60** :
   - Dans `src/components/messaging/messages-grammar.css:1909-1918`, `.msplit` est centré à `left: 50%` (`x=157..245, y=396, w=88, h=22`).
   - Dans `src/components/messaging/messages-grammar.css:360-384`, `.mpill` a `max-width: min(78%, 300px)` et `margin: 8px 12px 6px`. Sur un groupe (« Bivouac de printemps · 5 membres »), la pastille mesure 189 pt de large (`x=12..201`).
   - Constat audit physique (`06-messagerie-conv-groupe-bivouac.png`) : collision physique de **44 pt** entre `x=157` et `x=201`.
   - De plus, la première bulle de message (`y=338`) est masquée sous l'en-tête et sous la poignée de drag (`y=394..446`) par manque de padding supérieur.

4. **Anomalie critique d'ancrage des tiroirs modaux (`AccountDrawerHost variant="card"`)** :
   - Dans `src/features/messaging/components/ComposerMenuSheet.tsx:238` et `src/features/messaging/components/ConversationOptionsSheet.tsx:111`, les deux composants instancient `<AccountDrawerHost variant="card">`.
   - Constat audit physique (`07-messagerie-composer-menu-sheet.png`, `messagerie-composer-menu-tree.xml:110`) : le tiroir s'ouvre dans la boîte `#card` tout en haut de l'écran (`y=110..386`) avec une hauteur restreinte à **276 pt**, tronquant « Randonnée » et masquant totalement « Équipement » et « Kit ».

5. **Doublon d'états vides et contraste défaillant sur l'onglet Demandes** :
   - Dans `MessagesScreen.tsx:1599-1644` et `1801-1808`, quand aucun message n'est en attente (`visible.length === 0` et `!selected`), la liste haute affiche un bloc `.mstate` (« Aucune discussion ») ET la zone basse affiche un second bloc `.mstate` (« Choisissez une discussion »).
   - Le bouton « Nouvelle discussion » utilise `onClick={focusSearch}` qui cible le champ de recherche local au lieu d'ouvrir `NewConversationModal`.
   - Le contraste du bouton dans l'audit physique était mesuré à `1.05:1` (texte vert foncé sur fond vert foncé).

6. **Gel sur squelettes gris dans les conversations de groupe** :
   - Dans `src/features/messaging/hooks/useConversations.ts:47`, `fetchConversations()` appelle systématiquement `setLoading(true)` lors des rafraîchissements en tâche de fond (déclenchés par les événements Realtime `markAsRead`), remplaçant la liste des conversations par 4 squelettes gris (`.mskel`).

7. **Gestion dégradée des publications partagées (`SharedPostEmbed`)** :
   - Dans `src/features/messaging/components/SharedPostEmbed.tsx:61`, l'échec de résolution d'un UUID ou une restriction RLS renvoie un élément brut `<div className="mpost-embed-fallback">Publication indisponible</div>` stylé en gris sans action ni branding LKDV.

8. **Rupture de mise en page du menu de réactions** :
   - Dans `MessagesScreen.tsx:798-845`, l'appui long injecte un conteneur inline `.mreacts` dans le flux DOM régulier contenant 3 boutons d'action + 6 émojis, cassant sur 2 lignes et décalant verticalement la suite de la discussion.

9. **Banque centrale de design tokens & parité multi-cibles** :
   - `src/design/bank.ts` centralise la charte LKDV : surfaces claire/sauge (`#FBFAF6`, `#F5F7F3`, `#F0F5EE`), encres forêt (`#172B24`, `#56665D`), vert marque (`#17402C`, `#226148`, `#2D7255`), et bannit tout noir pur `#000000` et fond sombre `#0d1117`.
   - `scripts/generate-design-bank.mjs` compile ces tokens vers CSS Web (`tokens.generated.css`) et Swift iOS (`ios/App/App/DesignTokens.generated.swift`).

---

## 2. Logic Chain

1. **Tier 3 (Cross-Feature Combinations)** nécessite de tester les points de friction aux interfaces entre deux ou plusieurs composants :
   - *Combinaison F5 × F6* : Changer de filtre avec `SubCapsuleTabs` ne doit ni provoquer de flash noir `#0d1117` ni interférer avec l'en-tête « Messages ».
   - *Combinaison F7 × F8* : Redimensionner le Split View (modifier `--msg-split`) ne doit en aucun cas modifier le point d'ancrage du Bottom Sheet (`ComposerMenuSheet` / `ConversationOptionsSheet`), qui doit toujours émerger du bas physique de l'écran (`y >= 500pt`).
   - *Combinaison F10 × F12* : Recevoir un signal Realtime Postgres en tâche de fond pendant qu'un utilisateur maintient un appui long sur un message ne doit pas réinitialiser la liste sur des squelettes gris ni fermer brutalement la bulle d'emojis flottante.
   - *Combinaison F9 × F2 × F1* : L'état vide de `Demandes` doit combiner un affichage unique, un contraste WCAG AAA (texte `#FFFFFF` sur fond vert `#2D7255`) et le déclenchement de `NewConversationModal` conforme aux primitives Apple HIG.
   - *Combinaison F11 × F1 × F2* : Le fallback de `SharedPostEmbed` doit adopter la typographie système `-apple-system-*` et le fond groupé sauge `#F0F5EE`, sans boîte grise orpheline.
   - *Combinaison F3 × F1 × F2* : La synchronisation continue entre `bank.ts`, les variables CSS `:root` et l'énumération Swift `DesignTokens` garantit une intégrité visuelle multiplateforme sans dérive chromatique.

2. **Tier 4 (Real-World Scenarios)** valide des flux utilisateur complets, réalistes et continus sur la géométrie physique de l'iPhone 16 Pro (`402 × 874 pt`) :
   - Modélisation de 6 parcours de bout en bout couvrant la messagerie directe quotidienne, la collaboration de groupe avec pièces jointes, la prospection de contact via l'onglet Demandes, le stress tactile du redimensionnement de split view, l'exploration complète du Bottom Sheet de partage (5 options), et l'audit automatisé de non-régression sur le noir pur `#000000`.

---

## 3. Caveats

1. **Émulation WebKit vs Appareil Physique** : Les tests automatisés Playwright exécutés en mode `mobile-webkit` (DPR 3, viewport 402×874 pt) répliquent fidèlement le moteur de rendu Safari/WebKit, mais l'interaction avec le pont natif Capacitor (`ios/App/App/SceneDelegate.swift`) et les retours haptiques `UIImpactFeedbackGenerator` nécessitent la validation complémentaire de la suite Appium M3.
2. **Gestion du clavier virtuel (`--kb-inset`)** : Sur un navigateur desktop de test, `--kb-inset` vaut `0px`. Le test de surélévation du composer simule la variable CSS `--kb-inset: 336px` conformément aux dimensions du clavier standard iOS 18.
3. **Persistance locale** : Le redimensionnement du split view stocke sa valeur dans `localStorage['lkdv:messagerie:split']` ; les tests E2E doivent vérifier la persistance inter-rechargements.

---

## 4. Conclusion

Les 14 cas de test de **Tier 3 (Cross-Feature Combinations)** et les 6 scénarios de **Tier 4 (Real-World Scenarios)** définis ci-après constituent une spécification exhaustive, concrète et directement traduisible en code Playwright / Vitest. Chaque test dispose de sélecteurs exacts, de coordonnées précises, d'assertions géométriques au pixel près et de critères d'invalidation stricts.

---

## 5. Verification Method

Pour vérifier indépendamment cette spécification :
1. **Validation statique de conformité des tokens** :
   ```bash
   node scripts/generate-design-bank.mjs --check
   ```
2. **Exécution de la suite de tests E2E Playwright** :
   ```bash
   npx playwright test tests/e2e/messaging-t3-t4.spec.ts --project=mobile-webkit
   ```
3. **Conditions d'invalidation** :
   - Présence d'au moins une occurrence de `#000000` ou `#0d1117` dans le DOM calculé de `/messagerie`.
   - Collision supérieure à 0 pt entre `msplit` et `mpill`.
   - Ouverture d'un tiroir à `y < 450 pt` (tiroir non ancré au bas).
   - Présence de plus d'un élément `.mstate` visible simultanément.
   - Apparition de squelettes `.mskel` lors d'un rafraîchissement d'arrière-plan.

---

## Features Discovered

| # | Catégorie | Fonctionnalité | Description | Entrées (Inputs) | Sorties (Outputs) | Comportement d'Erreur | Découvert Via |
|---|-----------|----------------|-------------|------------------|-------------------|-----------------------|---------------|
| 1 | Navigation | Header Title "Messages" | Bouton statique titre d'en-tête (ne navigue pas vers /compte) | Tap utilisateur | Maintien sur `/messagerie` / scroll-to-top | Précédemment : redirection brutale vers `/compte` + flash noir `#0d1117` | `MessagesScreen.tsx:1471`, `00-messagerie-main.png` |
| 2 | Navigation | Header Notification Bell | Bouton cloche d'en-tête pour notifications in-app | Tap utilisateur | Affichage tiroir notifications ou filtre mention | Précédemment : `<Link href="/compte?tab=notifications">` | `NotificationBell.tsx:29`, `01-messagerie-tab-notifications.png` |
| 3 | Filtrage | SubCapsuleTabs Placement | Sélecteur Toutes/Directs/Groupes/Demandes ancré dans le flux | Tap sur un filtre | Filtrage instantané de la liste `visible` | Précédemment : pastille flottante masquant la 4e discussion à `y=346..376` | `messages-grammar.css:995`, `02-messagerie-toutes.png` |
| 4 | Split View | Split Handle de-collision | Poignée `msplit` décorrélée de la pastille contact `mpill` | Drag vertical pointer | Ajustement dynamique de `--msg-split` | Précédemment : chevauchement de 44 pt entre `msplit` et `mpill` | `messages-grammar.css:1909`, `06-messagerie-conv-groupe-bivouac.png` |
| 5 | Split View | Top Message Clearance | Marge supérieure de dégagement sous l'en-tête split | Scroll fil de messages | Premier message 100 % lisible sous le header | Précédemment : première bulle coupée à `y=338` sous la poignée | `MessagesScreen.tsx:1739`, `04-messagerie-conv-camille-rochat.png` |
| 6 | Tiroirs | ComposerMenuSheet Bottom Sheet | Tiroir d'ajout (+) ancré en bas de l'écran (`y >= 500pt`) | Tap sur bouton `+` | Bottom sheet Apple avec poignée 36×5pt et 5 options | Précédemment : confiné à `y=110..386`, coupant « Équipement » et « Kit » | `ComposerMenuSheet.tsx:238`, `07-messagerie-composer-menu-sheet.png` |
| 7 | Tiroirs | ConversationOptionsSheet Bottom Sheet | Fiche options (...) ancrée en bas de l'écran | Tap sur `mpill` ou `...` | Bottom sheet avec gestion de groupe/contact | Précédemment : ouvert en haut à `y=110`, bouton redondant « Écrire » | `ConversationOptionsSheet.tsx:111`, `08-messagerie-conversation-options-sheet.png` |
| 8 | États Vides | Demandes Unique Empty State | État vide unique et centré sur l'onglet Demandes | Filtre `Demandes` sans invitation | Bloc `.mstate` unique avec contraste WCAG AAA | Précédemment : 2 états vides simultanés l'un sur l'autre | `MessagesScreen.tsx:1599,1801`, `02-messagerie-filter-demandes.png` |
| 9 | Création | Action Nouvelle Discussion | Bouton d'action ouvrant `NewConversationModal` | Tap sur bouton vert | Présentation modale du sélecteur de contacts | Précédemment : mettait simplement le curseur dans l'input local | `MessagesScreen.tsx:1628`, `03-messagerie-nouvelle-discussion-tap.png` |
| 10 | Realtime | Group Chat Background Sync | Maintien du cache existant sans `loading=true` | Événement Postgres Changes | Mise à jour transparente des compteurs | Précédemment : gel sur 4 squelettes gris de chargement | `useConversations.ts:47`, `06-messagerie-conv-groupe-bivouac.png` |
| 11 | Intégration | SharedPostEmbed Fallback | Carte de post communautaire partagé | ID post dans message | Rendu preview ou fallback carte verte marque | Précédemment : carte grise d'erreur brute « Publication indisponible » | `SharedPostEmbed.tsx:61`, `06-messagerie-conv-groupe-bivouac.png` |
| 12 | Réactions | Floating Emoji Overlay Bar | Capsule de 6 émojis flottant au-dessus de la bulle | Long press (> 500 ms) | Overlay contextuel Apple sans saut de DOM | Précédemment : conteneur inline cassé sur 2 lignes décalant le fil | `MessagesScreen.tsx:798`, `09-messagerie-message-longpress.png` |
| 13 | Charte | LKDV Green Palette (No Black) | Zéro `#000000`, zéro `#0d1117`, teintes vertes | Rendu CSS | Palette verte LKDV exclusive | Précédemment : résidus de noir `#000000` et gris sombre `#0d1117` | `src/design/bank.ts`, `ORIGINAL_REQUEST.md:23` |
| 14 | Multiplateforme | Swift Tokens Synchronization | Parité continue Web CSS et Swift UIKit/SwiftUI | Script `generate-design-bank.mjs` | `DesignTokens.generated.swift` identique | Risque de désynchronisation entre Web et bridge natif iOS | `scripts/generate-design-bank.mjs:380` |

---

## Edge Cases

| # | Fonctionnalité | Entrée (Input) | Comportement Observé / Attendu |
|---|----------------|----------------|--------------------------------|
| 1 | Header Navigation | Double-tap rapide sur le titre « Messages » (`x=12, y=69`) | Doit scroller doucement la liste vers le haut (offset y=0) sans jamais quitter `/messagerie`. |
| 2 | Header Navigation | Tap sur l'icône Cloche avec 0 notification vs 100+ notifications | Le badge affiche un compteur exact ou `99+` et ouvre le panneau local sans redirection vers `/compte`. |
| 3 | Split View | Pointer drag de `msplit` vers `y=80` (trop haut) ou `y=850` (trop bas) | La valeur `--msg-split` est strictement clampée entre `140px` et `viewportHeight - 180px`. |
| 4 | Split View | Double-clic / double-tap sur la poignée `msplit` | Réinitialise instantanément le split à la hauteur optimale par défaut (`360px`). |
| 5 | Bottom Sheet | Tap sur `+` puis ouverture simultanée du clavier virtuel iOS (`--kb-inset=336px`) | Le bottom sheet s'élève au-dessus du clavier ou le clavier est flouté (`blur`) avec detent prioritaire. |
| 6 | Bottom Sheet | Glissement tactile descendant (swipe down) sur la poignée grabber `36×5pt` | Le tiroir suit le doigt et se referme avec animation fluide `spring` dès que le seuil de 80 pt est franchi. |
| 7 | Demandes Filter | Filtrage sur `Demandes` avec exactement 1 demande en attente | La rangée unique s'affiche avec badge vert, aucun état vide n'apparaît, et le split 60% attend la sélection. |
| 8 | Group Chat Realtime | Réception de 15 messages simultanés via Postgres Realtime en 2 secondes | Le fil défile automatiquement vers le bas sans à-coups ni déclenchement d'état `loading`. |
| 9 | Emoji Reactions | Long press sur une bulle située tout en haut de la zone de chat (`y < 120pt`) | La barre d'emojis s'affiche intelligemment **en dessous** de la bulle pour ne pas être rognée par le split header. |
| 10 | Shared Post Fallback | Message contenant un UUID inexistant (`00000000-0000-0000-0000-000000000000`) | Affiche une carte de marque LKDV avec icône boussole et mention claire, sans casser le rendu du fil. |
| 11 | Inset Grouped Styling | Affichage de conversations avec titres très longs (>= 50 caractères) | Les titres sont tronqués par points de suspension (`ellipsis`) sans déborder de la rangée de `358pt`. |
| 12 | Pure Green Palette | Audit DOM complet de tous les éléments calculés en mode sombre simulé | 100 % des couleurs restent des nuances de vert (`#06130D`, `#0B1E16`, `#143527`) ; aucun noir `#000000`. |

---

## Spécification Détaillée : Tier 3 — Combinaisons Multi-Fonctionnalités (14 Cas de Test)

### Matrice de Couverture des Combinaisons F1 à F12

| ID Test | Fonctionnalités Liées | Description Synthétique |
|---------|-----------------------|-------------------------|
| **T3-COMB-01** | F5 × F6 | Navigation Header inaltérée lors du changement d'onglet dans SubCapsuleTabs |
| **T3-COMB-02** | F7 × F8 | Redimensionnement du Split View et ancrage invariant du Bottom Sheet |
| **T3-COMB-03** | F10 × F12 | Synchronisation Realtime en arrière-plan pendant l'affichage de l'overlay de réactions |
| **T3-COMB-04** | F9 × F2 × F1 | Filtre Demandes avec état vide unique, contraste WCAG AAA et NewConversationModal |
| **T3-COMB-05** | F11 × F1 × F2 | Fallback SharedPostEmbed stylé aux couleurs LKDV et primitives Inset Grouped |
| **T3-COMB-06** | F3 × F1 × F2 | Synchronisation continue et parité exacte entre Swift DesignTokens et CSS Tokens |
| **T3-COMB-07** | F7 × F10 × F1 | Dé-collision géométrique poignée msplit vs pastille mpill sur groupe à nom étendu |
| **T3-COMB-08** | F6 × F7 × F10 | Sélection de groupe via filtre, intégrité de la 4e rangée et padding du 1er message |
| **T3-COMB-09** | F8 × F11 × F1 | Ajout de pièce jointe via ComposerMenuSheet (5 options) et insertion dans le fil |
| **T3-COMB-10** | F8 × F2 × F5 | Options de conversation (...) en Bottom Sheet Apple avec palette LKDV sans noir |
| **T3-COMB-11** | F12 × F7 × F1 | Positionnement dynamique de l'overlay d'emojis aux frontières haute/basse du split |
| **T3-COMB-12** | F4 × F9 × F1 | Conformité Apple HIG des cibles tactiles 44×44pt et typographie système |
| **T3-COMB-13** | F8 × F7 × F1 | Interaction entre clavier virtuel iOS (--kb-inset), barre composer et Bottom Sheet |
| **T3-COMB-14** | F5 × F7 × F10 | Bascule rapide direct/groupe avec persistance du split et en-tête statique |

---

### Fiches Détaillées des Cas de Test Tier 3

#### T3-COMB-01 : Header Navigation Fix + SubCapsuleTabs Filter Switching (F5 × F6)
- **Objectif** : Vérifier que le changement continu d'onglets de filtre dans `SubCapsuleTabs` n'entraîne aucune redirection intempestive vers `/compte` et que les boutons d'en-tête restent stables.
- **Préconditions** : L'utilisateur est connecté et se trouve sur `/messagerie` avec un jeu de 6 conversations.
- **Sélecteurs & Éléments** :
  - Bouton titre : `header .ig-handle` ou `button[aria-label="Messages"]`
  - Bouton cloche : `.lkdv-notif-wrap`
  - Onglets filtres : `.mfilters button` (`[aria-selected="true"]`)
- **Séquence d'actions** :
  1. Cliquer sur le 2e onglet « Directs » (`idx=1`).
  2. Cliquer sur le titre « Messages ».
  3. Cliquer sur le 3e onglet « Groupes » (`idx=2`).
  4. Cliquer sur le 4e onglet « Demandes » (`idx=3`).
  5. Cliquer sur l'icône Cloche.
  6. Revenir au 1er onglet « Toutes » (`idx=0`).
- **Assertions & États attendus** :
  - L'URL de la page reste strictement `http://localhost:4028/messagerie` tout au long du test.
  - Aucun élément `#0d1117` ni tiroir de compte n'apparaît.
  - La pastille active `.ig-th` se déplace avec une transition `transform` fluide.
  - Le titre « Messages » ne déclenche aucun appel `router.push('/compte')`.

#### T3-COMB-02 : Split View Resize Handle Drag + Bottom Sheet Presentation (F7 × F8)
- **Objectif** : Vérifier que le redimensionnement interactif du Split View via `msplit` ne perturbe pas l'ancrage ni la hauteur du Bottom Sheet `ComposerMenuSheet`.
- **Préconditions** : Une conversation directe est active (`selectedId = 'camille-rochat'`).
- **Sélecteurs & Éléments** :
  - Poignée de split : `.msplit`
  - Bouton ouverture tiroir : `.mcomposer .gbtn[aria-label*="Partager"]` ou bouton `+`
  - Tiroir Bottom Sheet : `.lkdv-sheet`, `.sheet-backdrop`
- **Séquence d'actions** :
  1. Effectuer un drag pointer sur `.msplit` de `y=396` à `y=220` (réduction de la liste haute à 220px).
  2. Vérifier que la variable CSS calculée `--msg-split` vaut `220px`.
  3. Cliquer sur le bouton `+` dans le composer à `y=728`.
  4. Inspecter la bounding box du Bottom Sheet qui s'ouvre.
  5. Fermer le tiroir via le bouton `×` ou le backdrop.
  6. Effectuer un second drag sur `.msplit` vers `y=520`.
  7. Ré-ouvrir le Bottom Sheet.
- **Assertions & États attendus** :
  - Dans les deux cas de redimensionnement, la boîte du Bottom Sheet s'ancre au bas de l'écran (`top >= 437 pt`, `bottom = 874 pt`).
  - Le Bottom Sheet ne s'ouvre JAMAIS à l'intérieur de `#card` (`y=110..386`).
  - À la fermeture du tiroir, la hauteur `--msg-split` reste exactement celle réglée par l'utilisateur (`220px` puis `520px`).

#### T3-COMB-03 : Group Chat Realtime Sync + Reaction Emoji Overlay Bar (F10 × F12)
- **Objectif** : S'assurer qu'un événement Supabase Realtime reçu pendant la consultation d'un message avec la barre d'emojis ouverte ne détruit pas le composant ni ne réinitialise la liste sur des squelettes gris.
- **Préconditions** : Discussion de groupe « Bivouac de printemps » ouverte avec 5 messages affichés.
- **Sélecteurs & Éléments** :
  - Bulle de message : `.mbub[data-message-id="msg-4"]`
  - Overlay d'emojis : `.mreact-overlay`, `.mreact-emoji-bar`
  - Squelettes de liste : `.mskel`
- **Séquence d'actions** :
  1. Effectuer un appui long (pointerdown 600 ms) sur le 4e message.
  2. Constater l'apparition de la capsule flottante contenant les 6 émojis (`👍, ❤️, 😂, 😮, 🙏, 🔥`).
  3. Émettre un événement simulé Supabase Postgres Changes (`INSERT` d'un message entrant ou `UPDATE` d'accusé de lecture).
  4. Vérifier la réaction du composant `useConversations` et de `MessageThread`.
- **Assertions & États attendus** :
  - Aucun squelette `.mskel` n'apparaît dans la liste supérieure des conversations.
  - La capsule d'emojis `.mreact-emoji-bar` reste visible et positionnée au-dessus de la bulle ciblée.
  - La sélection de l'émoji `🔥` applique la réaction sans décalage vertical du fil de discussion.

#### T3-COMB-04 : Demandes Empty State + NewConversationModal + LKDV Green Palette (F9 × F2 × F1)
- **Objectif** : Valider l'unicité de l'état vide sur l'onglet Demandes, le respect du contraste WCAG AAA sur le bouton d'action et le déclenchement effectif de `NewConversationModal`.
- **Préconditions** : Utilisateur connecté sans demande de message en attente (`pendingCount = 0`).
- **Sélecteurs & Éléments** :
  - 4e onglet : `.mfilters button:nth-child(4)`
  - État vide : `.mstate`
  - Bouton d'action : `.mstate button.mbtn.p`
  - Modale nouvelle discussion : `.lkdv-modal-new-conv`, `input[type="search"]`
- **Séquence d'actions** :
  1. Cliquer sur l'onglet « Demandes » (`SubCapsuleTabs`).
  2. Compter le nombre d'éléments `.mstate` visibles dans le DOM.
  3. Extraire les couleurs calculées (`getComputedStyle`) du bouton « Nouvelle discussion » (fond et texte).
  4. Calculer le ratio de contraste relatif WCAG.
  5. Cliquer sur le bouton « Nouvelle discussion ».
- **Assertions & États attendus** :
  - `document.querySelectorAll('.mstate:not([style*="display: none"])').length === 1` (exactement un état vide).
  - Couleur de fond du bouton : `#2D7255` ou dégradé vert émeraude ; couleur du texte : `#FFFFFF` (ratio de contraste >= `8.5:1`, conforme WCAG AAA).
  - Le clic ouvre `NewConversationModal` sous forme d'une sheet modale avec champ de sélection de contact.
  - Aucune présence de `#000000` ni `#0d1117` dans le scrim ou le corps de la modale.

#### T3-COMB-05 : Shared Post Embed Fallback + Inset Grouped Design Bank (F11 × F1 × F2)
- **Objectif** : Vérifier que lorsqu'un message contient un post partagé inaccessible, le fallback s'affiche sous forme d'une carte Inset Grouped élégante aux teintes LKDV sans boîte grise brute.
- **Préconditions** : Une discussion contient un message de type `post` avec un ID invalide `invalid-uuid-404`.
- **Sélecteurs & Éléments** :
  - Conteneur post : `.mpost-embed`
  - Carte de fallback : `.mpost-fallback-card`
- **Séquence d'actions** :
  1. Ouvrir la conversation contenant le message d'erreur.
  2. Localiser la bulle de post partagé.
  3. Inspecter les propriétés CSS de `.mpost-fallback-card`.
- **Assertions & États attendus** :
  - La carte ne comporte aucun texte brut « Publication indisponible » sur fond gris.
  - La carte utilise un fond sauge / verre sombre (`--lkv-surface-grouped: #F0F5EE` ou `--lkdv-green-900: #143527`), une icône de boussole discrète et un bouton d'action secondaire « Voir sur la communauté ».
  - Le rayon de courbure est un squircle continu conforme à `radii.sm` (16 pt).
  - Absence totale de `#000000`.

#### T3-COMB-06 : Swift Native Design Tokens Sync + CSS Custom Properties Parity (F3 × F1 × F2)
- **Objectif** : Vérifier par analyse automatisée la parfaite parité des valeurs de design entre `src/design/bank.ts`, `src/styles/tokens.generated.css` et `ios/App/App/DesignTokens.generated.swift`.
- **Préconditions** : Le script de build `scripts/generate-design-bank.mjs` a été exécuté.
- **Séquence d'actions** :
  1. Lire `bank.ts` et extraire les dictionnaires `surfaces`, `inks`, `brand`, `radii`, `zIndex`.
  2. Parser `tokens.generated.css` et extraire les variables `--lkv-*`.
  3. Parser `DesignTokens.generated.swift` et extraire les constantes de `DesignTokens.Colors`, `Radii`, `ZIndex`.
  4. Comparer clé par clé les valeurs hexadécimales et numériques.
- **Assertions & États attendus** :
  - `brandPrimary` : `#17402C` identique dans les 3 cibles.
  - `brandAction` : `#226148` identique dans les 3 cibles.
  - `surfaceCanvas` : `#FBFAF6` identique dans les 3 cibles.
  - `labelPrimary` : `#172B24` identique dans les 3 cibles.
  - Rayons `xs=12`, `sm=16`, `md=20`, `lg=24`, `card=28`, `sheet=44`, `pill=9999` identiques.
  - Aucune clé ne contient `#000000` ou `#0d1117`.

#### T3-COMB-07 : Split View De-collision under Group Contact Pill + Drag Interaction (F7 × F10 × F1)
- **Objectif** : Démontrer l'absence absolue de collision physique entre la pastille de contact de groupe `mpill` et la poignée de redimensionnement `msplit`.
- **Préconditions** : Discussion de groupe « Bivouac de printemps · 5 membres » ouverte sur iPhone 16 Pro (largeur 402 pt).
- **Séquence d'actions** :
  1. Mesurer la bounding box de `mpill` : `{ x, y, width, height }`.
  2. Mesurer la bounding box de `msplit` : `{ x, y, width, height }`.
  3. Calculer l'intersection géométrique entre les deux rectangles.
  4. Effectuer un drag pointer de `msplit` de `y=396` à `y=300`.
  5. Re-calculer l'intersection à chaque pas de 20 pt.
- **Assertions & États attendus** :
  - L'intersection `intersectionArea(rectPill, rectSplit)` est strictement égale à **0 px²** à toutes les hauteurs.
  - La pastille `mpill` est positionnée soit décalée horizontalement avec une marge de sécurité >= 16 pt, soit intégrée dans la barre supérieure du détail de chat.
  - Le tap sur `msplit` pour redimensionner ne déclenche jamais le clic sur `mpill`.

#### T3-COMB-08 : SubCapsuleTabs Filter Switching + Group Chat Selection + History Scroll Top Padding (F6 × F7 × F10)
- **Objectif** : Valider la visibilité de la 4e discussion lors du filtrage, l'absence de squelettes lors de la sélection d'un groupe et le padding de dégagement de la première bulle de message.
- **Préconditions** : Écran `/messagerie` affichant au moins 4 discussions.
- **Séquence d'actions** :
  1. Vérifier les coordonnées de la 4e rangée de discussion (`Dolomites — août`) par rapport à la capsule de filtre.
  2. Cliquer sur le filtre « Groupes ».
  3. Sélectionner « Bivouac de printemps ».
  4. Défiler la conversation jusqu'au premier message tout en haut.
  5. Mesurer la position `y` de la première bulle par rapport au bas de l'en-tête du split view.
- **Assertions & États attendus** :
  - La 4e discussion n'est recouverte par aucun élément (espacement vertical >= 8 pt).
  - Aucun clignotement ou persistance de squelettes `.mskel` lors de l'ouverture du groupe.
  - La première bulle de message a son sommet situé au moins **12 pt en dessous** du bord inférieur de l'en-tête `mpill`/`msplit` (aucun masquage de texte).

#### T3-COMB-09 : ComposerMenuSheet (+ action) + Media/GPX Attachment Selection + Thread Update (F8 × F11 × F1)
- **Objectif** : Vérifier l'ouverture du tiroir de pièces jointes depuis le bas de l'écran, la visibilité complète de ses 5 options et l'insertion d'un aperçu dans la rédaction.
- **Préconditions** : Discussion active ouverte, clavier fermé.
- **Séquence d'actions** :
  1. Cliquer sur le bouton `+` à `x=316, y=728`.
  2. Attendre l'animation d'ouverture du Bottom Sheet.
  3. Vérifier les coordonnées `y` et la visibilité des 5 options : `Photo`, `Carte GPX`, `Randonnée`, `Équipement`, `Kit`.
  4. Vérifier le `padding-left` du titre et des options (>= 16 pt).
  5. Cliquer sur « Carte GPX ».
  6. Sélectionner une trace GPX de test.
- **Assertions & États attendus** :
  - Le Bottom Sheet émerge du bas (`y >= 500 pt` jusqu'au detent 50 % ou 90 %).
  - Les 5 options sont 100 % visibles et ont une cible tactile >= 44×44 pt.
  - La sélection d'une option referme le tiroir et affiche la carte de prévisualisation dans la barre de saisie.

#### T3-COMB-10 : ConversationOptionsSheet (...) + User Mute/Block + Dark-Avoidance Palette (F8 × F2 × F5)
- **Objectif** : Valider l'ouverture de la fiche d'options de conversation en Bottom Sheet natif avec toutes les actions de gestion requises et respect de la palette LKDV.
- **Préconditions** : Discussion avec « Camille Rochat » ouverte.
- **Séquence d'actions** :
  1. Cliquer sur les options de conversation (`mpill` ou bouton `...`).
  2. Vérifier la présence de la poignée grabber 36×5pt et du bouton rond de fermeture `×`.
  3. Vérifier les actions disponibles : Sourdine, Notifications, Partager le contact, Signaler / Bloquer, Supprimer la discussion.
  4. Vérifier l'absence du bouton redondant « Écrire un message ».
  5. Scanner l'ensemble des éléments pour vérifier l'absence de `#000000` et `#0d1117`.
- **Assertions & États attendus** :
  - Le tiroir est ancré à `bottom: 0`.
  - Le bouton `×` est présent en haut à droite avec une cible tactile de 44×44 pt.
  - L'action « Écrire un message » est absente car la discussion est déjà active.
  - Les fonds utilisent le verre clair ou vert forêt (`#143527`, `#0B1E16`), zéro noir pur.

#### T3-COMB-11 : Reaction Emoji Bar Floating Overlay + Viewport Boundary & Split Resize (F12 × F7 × F1)
- **Objectif** : S'assurer que la barre flottante d'emojis s'adapte intelligemment à la position de la bulle ciblée sans jamais être rognée par les frontières du split ou de l'écran.
- **Préconditions** : Conversation avec messages courts et longs.
- **Séquence d'actions** :
  1. Défiler pour amener le premier message tout en haut du viewport de chat (`y ~ 450 pt`).
  2. Effectuer un appui long sur cette première bulle.
  3. Vérifier la position calculée de la capsule d'emojis.
  4. Effectuer un appui long sur un message situé tout en bas au-dessus du composer (`y ~ 700 pt`).
- **Assertions & États attendus** :
  - Si la marge supérieure est < 60 pt, l'overlay s'affiche **en dessous** de la bulle ; sinon, il s'affiche **au-dessus**.
  - La capsule ne déborde ni à gauche (`x >= 12 pt`) ni à droite (`x + width <= 390 pt`).
  - Aucun élément du fil de discussion ne subit de décalage dans le flux DOM (hauteur du fil invariante).

#### T3-COMB-12 : External Skills Apple HIG Standards + Demandes Filter + 44×44pt Touch Targets (F4 × F9 × F1)
- **Objectif** : Exécuter un audit strict de dimension des cibles tactiles et de typographie Apple Dynamic Type sur l'ensemble des contrôles interactifs de `/messagerie`.
- **Préconditions** : Page `/messagerie` chargée sur iPhone 16 Pro (402×874 pt).
- **Séquence d'actions** :
  1. Identifier tous les éléments interactifs (`button`, `a`, `input`, `[role="button"]`).
  2. Mesurer la zone tactile effective via `getBoundingClientRect()`.
  3. Inspecter la propriété CSS `font-family` et `font-size` sur les titres, corps et métadonnées.
- **Assertions & États attendus** :
  - Pour chaque contrôle interactif : `width >= 44 pt` et `height >= 44 pt` (ou pseudo-élément `:after`/padding étendant la zone tactile).
  - La croix de recherche `msearch-x`, les icônes de filtres `mfilters button` et les boutons de tiroirs respectent tous ce minimum.
  - Les polices appliquent la pile Apple (`-apple-system, BlinkMacSystemFont, "SF Pro Text"`).

#### T3-COMB-13 : Virtual Keyboard Inset (--kb-inset) + Composer Bar Elevation + Sheet Dismissal (F8 × F7 × F1)
- **Objectif** : Valider l'adaptation de la barre de rédaction à l'ouverture du clavier logiciel et la fermeture propre du clavier lors de l'ouverture du tiroir de pièces jointes.
- **Préconditions** : Discussion active, champ de saisie prêt.
- **Séquence d'actions** :
  1. Simuler l'ouverture du clavier logiciel iOS (`--kb-inset: 336px`).
  2. Mesurer la position `y` de la barre de rédaction (`.mcomposer`).
  3. Taper sur le bouton `+` pour ouvrir le tiroir de pièces jointes.
- **Assertions & États attendus** :
  - La barre de rédaction s'élève de exactement 336 px (`bottom: calc(336px + ...)`), restant entièrement visible au-dessus du clavier virtuel.
  - L'ouverture du tiroir `ComposerMenuSheet` floute le champ de saisie (`blur()`), réduisant `--kb-inset` à `0px` et déployant le Bottom Sheet sur la hauteur utile complète.

#### T3-COMB-14 : Direct vs Group Chat Switching + Split Handle Persistence + Header Stability (F5 × F7 × F10)
- **Objectif** : Vérifier la persistance de l'état de redimensionnement du split view et la stabilité de l'en-tête lors de la bascule répétée entre conversations directes et de groupe.
- **Préconditions** : Plusieurs conversations présentes.
- **Séquence d'actions** :
  1. Ajuster le split view à `310px`.
  2. Ouvrir « Camille Rochat » (direct).
  3. Vérifier `--msg-split = 310px` et `mpill` affichant « Camille Rochat · Membre LKDV ».
  4. Sélectionner immédiatement « Bivouac de printemps » (groupe).
  5. Vérifier `--msg-split = 310px` et `mpill` affichant « Bivouac de printemps · 5 membres ».
  6. Recharger la page (`page.reload()`).
- **Assertions & États attendus** :
  - La valeur `310px` est conservée via `localStorage['lkdv:messagerie:split']` sans saut brusque de layout.
  - L'en-tête « Messages » ne recharge pas et ne redirige jamais vers `/compte`.
  - La bascule s'effectue sans passage par l'état intermédiaire de 4 squelettes gris.

---

## Spécification Détaillée : Tier 4 — Scénarios Réels d'Utilisation (6 Workflows E2E)

Tous les scénarios ci-dessous sont calibrés pour une exécution automatisée sur un écran de dimensions physiques **402 × 874 pt** (iPhone 16 Pro).

---

### Scénario 1 : Parcours de Messagerie Quotidienne (Daily Messaging Flow)
- **Identifiant** : `T4-SCEN-01-DAILY-MESSAGING`
- **Profil Utilisateur** : Tony F. (utilisateur authentifié, compte régulier).
- **Objectif métier** : Consulter ses discussions récentes, ouvrir une conversation directe, envoyer un message texte et réagir par émoji au message précédent d'un contact.
- **Étapes du workflow** :
  1. **Ouverture de l'application** : Navigation vers `/messagerie`.
     - *Vérification* : La page se charge en < 800 ms. L'en-tête affiche « Messages » statique et la cloche de notifications. Aucun flash `#0d1117`.
  2. **Parcours de la liste des discussions** :
     - *Vérification* : Les rangées 0, 1, 2 et 3 sont affichées dans `#card`. La 4e rangée (« Dolomites — août ») est 100 % lisible et n'est pas recouverte par la capsule de filtres.
  3. **Sélection de la conversation avec Camille Rochat** : Tap sur la rangée 0.
     - *Vérification* : Le volet inférieur 60% se charge instantanément depuis le cache sessionStorage. La pastille `mpill` affiche « Camille Rochat · Membre LKDV » avec son avatar.
     - *Vérification* : La première bulle de message est dégagée de l'en-tête (padding haut >= 12 pt sous le split).
  4. **Rédaction d'un message** : Saisie de « Salut Camille ! On valide le bivouac pour samedi matin ? » dans le composer basse (`y=721..767`).
     - *Vérification* : Le bouton d'envoi passe en vert actif (`#226148`).
  5. **Envoi du message** : Tap sur le bouton d'envoi.
     - *Vérification* : La bulle de message s'affiche immédiatement en mode optimiste côté droit avec le fond vert menthe doux `--lkdv-mint-soft` (`rgba(93, 212, 159, 0.12)`) et texte vert forêt `#172B24`.
  6. **Réaction par émoji sur le message reçu** : Appui prolongé (> 500 ms) sur le message de Camille.
     - *Vérification* : La capsule d'émojis flottante apparaît au-dessus de la bulle sans saut de ligne du fil.
  7. **Sélection de l'émoji ❤️** : Tap sur le cœur.
     - *Vérification* : Le badge de réaction ❤️ apparaît au coin de la bulle avec fond vert accentué.

---

### Scénario 2 : Collaboration de Groupe & Partage Multimédia (Group Collaboration Flow)
- **Identifiant** : `T4-SCEN-02-GROUP-COLLABORATION`
- **Profil Utilisateur** : Membre de l'expédition « Bivouac de printemps ».
- **Objectif métier** : Accéder à une discussion de groupe, vérifier l'absence de freeze sur squelettes, inspecter un post partagé et ouvrir le menu de pièces jointes complet.
- **Étapes du workflow** :
  1. **Filtrage des groupes** : Tap sur le 3e bouton de `SubCapsuleTabs` (« Groupes »).
     - *Vérification* : La liste ne présente que les conversations collectives.
  2. **Ouverture de « Bivouac de printemps »** : Tap sur la discussion.
     - *Vérification* : La liste supérieure conserve l'état visuel sans afficher 4 squelettes gris en boucle.
     - *Vérification* : La pastille `mpill` (« Bivouac de printemps · 5 membres ») ne chevauche pas la poignée `msplit` (dégagement >= 16 pt).
  3. **Inspection du fil et du post partagé** :
     - *Vérification* : Le post communautaire partagé s'affiche sous forme d'une vignette propre ou d'une carte de fallback LKDV élégante (zéro carte d'erreur brute grise « Publication indisponible »).
  4. **Déclenchement du tiroir de partage (+)** : Tap sur le bouton `+` en bas à droite de la barre de rédaction (`y=728`).
     - *Vérification* : Le tiroir `ComposerMenuSheet` émerge du bas de l'écran (`y >= 500 pt`) avec poignée grabber `36×5pt`.
  5. **Contrôle des 5 options disponibles** :
     - *Vérification* : Les 5 boutons sont visibles et distincts :
       1. `Photo` (icône appareil)
       2. `Carte GPX` (icône tracé)
       3. `Randonnée` (icône montagne)
       4. `Équipement` (icône sac)
       5. `Kit` (icône boîte d'équipement)
     - *Vérification* : Toutes les options possèdent une marge gauche >= 16 pt et une hauteur tactile >= 44 pt.
  6. **Fermeture du tiroir** : Glissement vers le bas sur le grabber.
     - *Vérification* : Le tiroir se replie vers le bas avec fluidité sans résidu visuel.

---

### Scénario 3 : Traitement des Demandes & Nouvelle Discussion (Request & Outreach Flow)
- **Identifiant** : `T4-SCEN-03-REQUEST-OUTREACH`
- **Profil Utilisateur** : Randonneur souhaitant contacter un nouveau compagnon de route.
- **Objectif métier** : Vérifier la vue des demandes de messages, valider l'ergonomie de l'état vide et lancer une recherche de contact via la modale de création.
- **Étapes du workflow** :
  1. **Bascule vers le filtre Demandes** : Tap sur le 4e onglet de filtre (icône cloche).
     - *Vérification* : L'écran n'affiche qu'un **seul et unique état vide `.mstate`** centré horizontalement et verticalement dans la page.
  2. **Vérification du contraste et de la lisibilité** :
     - *Vérification* : Le titre « Aucune discussion » est composé en vert forêt `#17402C` sur fond sauge clair `#FBFAF6`.
     - *Vérification* : Le bouton « Nouvelle discussion » affiche un texte blanc pur `#FFFFFF` sur fond vert émeraude `#2D7255` (contraste > 8.5:1, conforme WCAG AAA).
  3. **Action de création** : Clic sur le bouton « Nouvelle discussion ».
     - *Vérification* : L'application n'oriente PAS le curseur dans la barre de recherche locale de l'en-tête, mais ouvre la modale `NewConversationModal`.
  4. **Recherche d'un contact** : Saisie de « Léa » dans le champ de la modale.
     - *Vérification* : La liste des résultats suggère « Léa Fontaine (@lea.fontaine) » avec avatar et localisation.
  5. **Sélection du contact** : Tap sur le profil de Léa.
     - *Vérification* : La modale se referme et une nouvelle discussion directe est initialisée dans le volet inférieur de messagerie.

---

### Scénario 4 : Ajustement Tactile du Split View & Test de Résistance (Split View Stress Flow)
- **Identifiant** : `T4-SCEN-04-SPLIT-VIEW-STRESS`
- **Profil Utilisateur** : Utilisateur manipulant intensivement l'interface en situation de marche.
- **Objectif métier** : Ajuster la répartition 40/60 de la messagerie selon ses besoins, éprouver les limites géométriques et valider le reset par double-tap.
- **Étapes du workflow** :
  1. **État initial** : Discussion active sélectionnée, split par défaut à `--msg-split: 360px`.
  2. **Agrandissement de la zone de chat** : Toucher la poignée `msplit` (`x=201, y=396`) et glisser vers le haut jusqu'à `y=160 pt`.
     - *Vérification* : La card haute se réduit harmonieusement, laissant 1 ligne de conversation visible.
     - *Vérification* : La zone de chat basse s'agrandit pour afficher 12 messages sans déformation.
     - *Vérification* : Aucune collision entre la poignée `msplit` et la pastille `mpill`.
  3. **Agrandissement de la liste haute** : Glisser la poignée vers le bas jusqu'à `y=650 pt`.
     - *Vérification* : La liste haute s'étend pour afficher 8 conversations complètes.
     - *Vérification* : La zone basse se replie en conservant la barre de composer accessible au-dessus de la TabBar.
  4. **Tentative de dépassement des bornes (Edge drag)** : Tirer la poignée jusqu'à `y=50 pt` puis `y=850 pt`.
     - *Vérification* : Le split ne casse pas : il est strictement clampé à un minimum de `140 px` et un maximum garantissant la visibilité des contrôles essentiels.
  5. **Double-tap de réinitialisation** : Double-tap rapide (< 300 ms) sur `msplit`.
     - *Vérification* : Le split revient instantanément à sa valeur par défaut ergonomique (`360 px`).

---

### Scénario 5 : Interaction Complète avec les Bottom Sheets (Bottom Sheet Complete Flow)
- **Identifiant** : `T4-SCEN-05-BOTTOM-SHEET-INTERACTION`
- **Profil Utilisateur** : Utilisateur gérant les paramètres d'une conversation et explorant les options de partage.
- **Objectif métier** : Ouvrir la fiche d'options de conversation, vérifier son ancrage bas, tester les actions de sourdine/blocage, puis ouvrir et explorer le tiroir de pièces jointes.
- **Étapes du workflow** :
  1. **Ouverture de ConversationOptionsSheet** : Tap sur le nom du contact dans `mpill`.
     - *Vérification* : Le tiroir émerge depuis le bas de l'écran (`y >= 500 pt`). Un voile assombri vert forêt `--lkdv-scrim` (`rgba(11, 30, 22, 0.65)`) recouvre le reste de l'écran.
  2. **Contrôle de la fiche d'options** :
     - *Vérification* : Présence de la poignée grabber `36×5pt` et du bouton circulaire `×` de fermeture.
     - *Vérification* : Présence des informations réelles du contact (nom, avatar, statut).
     - *Vérification* : Les options de gestion sont présentes : « Mettre en sourdine », « Rechercher dans la conversation », « Signaler ou bloquer », « Supprimer ».
     - *Vérification* : Absence de bouton « Écrire un message » redondant.
  3. **Fermeture de la fiche** : Tap sur le bouton `×` en haut à droite de la sheet.
     - *Vérification* : Le tiroir se referme immédiatement et la vue de chat redevient interactive.
  4. **Ouverture de ComposerMenuSheet** : Tap sur `+` dans le composer.
     - *Vérification* : Le tiroir s'ouvre en bas (`y >= 500 pt`), les 5 options sont visibles avec padding gauche >= 16 pt.
  5. **Fermeture par tap sur le voile d'arrière-plan** : Tap à `x=200, y=200` sur le scrim.
     - *Vérification* : Le tiroir se referme proprement sans action involontaire sur la liste sous-jacente.

---

### Scénario 6 : Audit Exhaustif de Conformité Design Tokens & Zéro Noir Pur (Dark-Avoidance & Token Audit)
- **Identifiant** : `T4-SCEN-06-TOKEN-COMPLIANCE-AUDIT`
- **Profil Utilisateur** : Auditeur qualité automatisé / Script de vérification CI.
- **Objectif métier** : Parcourir l'ensemble des écrans, tiroirs, états vides et modales de `/messagerie` pour certifier l'absence totale de noir pur `#000000`, de fond sombre non désiré `#0d1117` et la conformité 100 % Apple HIG.
- **Étapes du workflow** :
  1. **Scan de la vue principale (Split 40/60)** :
     - Évaluer chaque élément du DOM pour `color`, `backgroundColor`, `borderColor`, `boxShadow`.
     - *Vérification* : 0 occurrence de `#000000`, `rgb(0,0,0)`, `#0d1117`, `#101010`, `#121815`.
  2. **Scan de l'onglet Demandes & État Vide** :
     - Basculer sur `Demandes`, scanner le conteneur `.mstate` et son bouton.
     - *Vérification* : Fond général `#FBFAF6` / `#F5F7F3`, fond bouton `#2D7255`, texte `#FFFFFF`.
  3. **Scan du Bottom Sheet `ComposerMenuSheet`** :
     - Ouvrir le tiroir `+`, scanner les 5 cartes et le fond de sheet.
     - *Vérification* : Fond de sheet verre régulier ou vert sombre (`--lkdv-green-900: #143527`), voile scrim `--lkdv-scrim`, zéro noir pur.
  4. **Scan de `ConversationOptionsSheet`** :
     - Ouvrir la fiche contact, scanner les boutons destructifs (« Supprimer », « Bloquer »).
     - *Vérification* : Boutons destructifs stylés en rouge cerise adouci (`#85261E` / `--lkv-danger`), zéro fond noir.
  5. **Scan de l'overlay de réactions (Appui Long)** :
     - Ouvrir la barre d'emojis, scanner le fond de la capsule flottante.
     - *Vérification* : Verre capsule (`rgba(255, 255, 255, 0.72)` ou verre vert sombre `#143527` avec `backdrop-filter: blur(20px)`), zéro noir.
  6. **Contrôle de conformité de la banque Swift (`DesignTokens.generated.swift`)** :
     - Vérifier que le fichier Swift compilé ne contient aucun `UIColor(red: 0, green: 0, blue: 0, alpha: 1)`.
     - *Vérification* : 100 % des constantes dérivent de la palette verte LKDV.

---

## Guide d'Implémentation pour les Ingénieurs de Test

Pour implémenter ces cas de test dans le fichier de test Playwright (ex: `tests/e2e/messaging-t3-t4.spec.ts`) :

```typescript
import { test, expect } from '@playwright/test';

test.describe('Messagerie — Tier 3 : Cross-Feature Combinations', () => {
  test.use({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  test('T3-COMB-01: Header navigation remains on /messagerie when switching SubCapsuleTabs', async ({ page }) => {
    await page.goto('/messagerie');
    await expect(page).toHaveURL(/\/messagerie/);

    // Switch to Groupes
    const groupTab = page.locator('.mfilters button').nth(2);
    await groupTab.click();
    await expect(page).toHaveURL(/\/messagerie/);

    // Click header Messages title
    const headerTitle = page.locator('header .ig-handle, .ig-top .ig-handle').first();
    await headerTitle.click();
    await expect(page).toHaveURL(/\/messagerie/);
    await expect(page.locator('.phone')).toBeVisible();

    // Verify zero black flash (#0d1117)
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).not.toBe('rgb(13, 17, 23)');
  });

  test('T3-COMB-02: Split View resize does not alter Bottom Sheet presentation at y >= 500pt', async ({ page }) => {
    await page.goto('/messagerie');
    // Open conversation
    await page.locator('.mconvolist .mrow').first().click();

    // Drag split handle
    const splitHandle = page.locator('.msplit');
    const box = await splitHandle.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, 220);
      await page.mouse.up();
    }

    // Open ComposerMenuSheet (+)
    const addBtn = page.locator('.mcomposer .gbtn').first();
    await addBtn.click();

    const sheet = page.locator('.lkdv-sheet, [data-testid="composer-menu-sheet"]').first();
    await expect(sheet).toBeVisible();
    const sheetBox = await sheet.boundingBox();
    expect(sheetBox).not.toBeNull();
    if (sheetBox) {
      // Must anchor from bottom, top must not be in top card (y < 400)
      expect(sheetBox.y).toBeGreaterThanOrEqual(450);
      expect(sheetBox.y + sheetBox.height).toBeGreaterThanOrEqual(800);
    }
  });

  test('T3-COMB-07: Zero pixel collision between msplit handle and mpill contact capsule', async ({ page }) => {
    await page.goto('/messagerie');
    // Select group conversation
    await page.locator('.mconvolist .mrow').filter({ hasText: /Bivouac/i }).click();

    const pill = page.locator('.mpill');
    const split = page.locator('.msplit');
    await expect(pill).toBeVisible();
    await expect(split).toBeVisible();

    const pillBox = await pill.boundingBox();
    const splitBox = await split.boundingBox();
    expect(pillBox).not.toBeNull();
    expect(splitBox).not.toBeNull();

    if (pillBox && splitBox) {
      const horizontalOverlap = Math.max(0, Math.min(pillBox.x + pillBox.width, splitBox.x + splitBox.width) - Math.max(pillBox.x, splitBox.x));
      const verticalOverlap = Math.max(0, Math.min(pillBox.y + pillBox.height, splitBox.y + splitBox.height) - Math.max(pillBox.y, splitBox.y));
      const hasCollision = horizontalOverlap > 0 && verticalOverlap > 0;
      expect(hasCollision).toBe(false);
    }
  });
});

test.describe('Messagerie — Tier 4 : Real-World Scenarios', () => {
  test.use({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  test('T4-SCEN-03: Request & Outreach Flow with single empty state and WCAG AAA contrast', async ({ page }) => {
    await page.goto('/messagerie');
    // Click Demandes tab
    await page.locator('.mfilters button').nth(3).click();

    // Verify exactly ONE empty state is visible
    const emptyStates = page.locator('.mstate:visible');
    await expect(emptyStates).toHaveCount(1);

    // Verify contrast on action button
    const actionBtn = emptyStates.locator('button.mbtn.p, button:has-text("Nouvelle discussion")');
    await expect(actionBtn).toBeVisible();

    const btnStyles = await actionBtn.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, color: s.color };
    });
    // Text must be white, not dark green on dark green
    expect(btnStyles.color).toBe('rgb(255, 255, 255)');

    // Clicking action opens modal
    await actionBtn.click();
    await expect(page.locator('.lkdv-modal-new-conv, [role="dialog"]')).toBeVisible();
  });

  test('T4-SCEN-06: Deep audit ensuring zero pure black (#000000 or #0d1117) on rendered page', async ({ page }) => {
    await page.goto('/messagerie');
    const blackInstances = await page.evaluate(() => {
      const forbidden = ['#000000', 'rgb(0, 0, 0)', '#0d1117', 'rgb(13, 17, 23)'];
      const found: string[] = [];
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        if (forbidden.includes(style.backgroundColor)) {
          found.push(`${el.tagName}.${el.className} bg: ${style.backgroundColor}`);
        }
        if (forbidden.includes(style.color)) {
          found.push(`${el.tagName}.${el.className} color: ${style.color}`);
        }
      }
      return found;
    });
    expect(blackInstances).toHaveLength(0);
  });
});
```

---
*Fin du rapport de spécification Tier 3 & Tier 4 — Livré dans le state folder de `teamwork_spec_miner_e2e_t3t4_1`.*
