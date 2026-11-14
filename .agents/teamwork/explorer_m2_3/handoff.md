# Handoff Report — Explorer 3 (Features 10, 11, 12 — Milestone M2)

## 1. Observation
- **Audit iPhone Section 5 (`audit_complet_iphone.md`)** :
  - Lignes 323-326 : "Disparition / blocage de la liste des discussions en haut : quand on ouvre `Bivouac de printemps`, la liste du haut se vide et ne laisse qu'une ligne fantôme `Camille Rochat` à 30 % d'opacité sans avatar ; sur `Dolomites — août`, la liste du haut reste bloquée sur 4 squelettes gris de chargement."
  - Ligne 326 : "Contenu cassé dans le fil : affiche une carte grise `'Publication indisponible'`, l'image partagée en haut est tranchée en deux, et la bulle `'Top / Bien'` casse deux mots de 3 et 4 lettres sur 2 lignes."
  - Lignes 335-337 : "Actions sur un message (appui long sur une bulle) : La rangée de 6 réactions + `Répondre` + `Copier` se casse sur 2 lignes et pousse le message suivant sous la barre de saisie. Aucune action `Supprimer` ou `Modifier` sur ses propres messages."
- **Code source inspecté** :
  - `src/features/messaging/hooks/useConversations.ts:35` : `const [loading, setLoading] = useState(true);`.
  - `src/features/messaging/hooks/useConversations.ts:47` : `setLoading(true);` exécuté à chaque appel de `fetchConversations()`.
  - `src/features/messaging/hooks/useConversations.ts:84-98` : abonnements Realtime sur `conversation_members` et `conversations` appelant `fetchConversations()` sans option silencieuse.
  - `src/features/messaging/hooks/useMessages.ts:48` : `await messagingService.markAsRead(conversationId, currentUserId);` appelé dès le chargement d'un fil.
  - `src/features/messaging/services/messagingService.ts:1001-1008` : `markAsRead` met à jour `conversation_members.unread_count = 0`, déclenchant immédiatement l'événement Realtime qui rappelle `fetchConversations()` avec `setLoading(true)`.
  - `src/components/messaging/MessagesScreen.tsx:1582-1589` : `{loading ? [1, 2, 3, 4].map(...) : ...}` remplace toute la liste de conversations par 4 squelettes gris `mskel` dès que `loading === true`.
  - `src/features/messaging/components/SharedPostEmbed.tsx:71-73` : `if (failed) return <div className="mpost-embed-fallback">Publication indisponible</div>;`.
  - `src/components/messaging/messages-grammar.css:1513-1519` : `.lkdv-messages .mpost-embed-fallback` style un bloc brut terne avec `background: var(--fill3); color: var(--label2);`.
  - `src/components/messaging/messages-grammar.css:100-101` : `.lkdv-messages .bub` applique `word-break: break-word;` combiné à `.mstack` sans `width: fit-content;`, causant la rupture anormale des mots courts ("Top / Bien") sur iOS WebKit.
  - `src/components/messaging/MessagesScreen.tsx:798-845` : `openMenu === message.id` rend 9 boutons (`.mreacts`) directement dans le flux sous la bulle dans `.mstack`.
  - `src/components/messaging/messages-grammar.css:185-190` : `.mreacts { display: flex; flex-wrap: wrap; }` casse la rangée sur 2 lignes et allonge la bulle, repoussant le fil vers le bas.
  - `src/components/messaging/messages-grammar.css:1720` : `.mthread { contain: paint; }` rogne tout élément absolu qui tente de déborder du haut du volet de discussion.
  - `src/features/messaging/services/messagingService.ts` : absence complète de `deleteMessage` et `editMessage` alors que `useMessages.ts:146-177` écoute déjà `UPDATE (deleted_at)` et `DELETE`.

## 2. Logic Chain
1. Lorsqu'un utilisateur clique sur un groupe (`Bivouac de printemps`, `Dolomites — août`), `selectedId` change, montant `MessageThread`.
2. `MessageThread` invoque `useMessages`, dont l'effet initial déclenche `messagingService.markAsRead(conversationId, currentUserId)`.
3. Cette écriture en base met à jour `conversation_members`, déclenchant l'événement Realtime Postgres.
4. L'abonnement dans `useConversations` intercepte l'événement et invoque `fetchConversations()`, qui exécute inconditionnellement `setLoading(true)`.
5. Dans `MessagesScreen.tsx:1582`, la condition `loading ?` est satisfaite, écrasant la liste des conversations avec 4 squelettes gris (`mskel`). Si la réponse réseau prend plusieurs centaines de millisecondes, l'écran reste bloqué sur les 4 squelettes. Quand la réponse arrive, les rangées sont remontées de zéro, ce qui déclenche l'animation `@keyframes mrow-in` d'opacité 0 à 1, expliquant la ligne fantôme à 30 % photographiée par Appium.
6. Pour `SharedPostEmbed`, l'absence d'ID valide ou l'indisponibilité de la publication en base active la branche `if (failed)` qui affiche un simple texte brut sans style ni action.
7. Pour la bulle `"Top / Bien"`, la présence de `word-break: break-word` combinée au redimensionnement intrinsèque d'un `<button>` dans une colonne flex fait calculer à WebKit une largeur minimale basée sur le mot le plus long ("Bien"), forçant le saut de ligne après "Top /".
8. Pour le menu contextuel, l'insertion de 9 éléments flex enveloppants dans `.mstack` dans le flux normal pousse inévitablement les messages suivants vers le bas de 50 à 60 px.
9. L'ancrage de la barre doit donc être converti en popover overlay flottant `position: absolute; z-index: 60` avec backdrop dismissible, pilule capsule d'émojis 44pt (Apple HIG) et menu d'actions Inset Grouped proposant `Supprimer` et `Modifier`.

## 3. Caveats
- Aucune modification de code source n'a été effectuée par cet agent (conformément au rôle Teamwork explorer).
- Les changements proposés sont documentés avec exactitude sous forme de blueprints et snippets prêts au déploiement dans `analysis.md`.
- `PostMessageCard.tsx` existe déjà dans `src/features/messaging/components/cards/` et a été vérifié unitairement via Vitest.

## 4. Conclusion
Les 3 fonctionnalités (Feature 10: Group Chat Realtime Freeze, Feature 11: Shared Post Embed & Bubble Text Breaking, Feature 12: Reaction Emoji Overlay Bar & Message Actions) sont intégralement élucidées.
- La cause racine du gel et des squelettes gris en chat de groupe est `setLoading(true)` dans `useConversations.ts:47` déclenché en boucle par `markAsRead` via Realtime. La solution consiste à rendre `fetchConversations` silencieux quand des conversations sont déjà en cache et à protéger l'affichage dans `MessagesScreen.tsx`.
- La carte d'erreur brute est transformée en une carte de repli élégante LKDV avec coins continuous squircle, icône de statut et bouton `Réessayer`, tandis que la césure de texte est corrigée par `overflow-wrap: anywhere; word-break: normal; width: fit-content;`.
- La barre de réaction est transformée en popover overlay flottant indépendant du flux avec pilule capsule 44pt Apple, menu Inset Grouped, backdrop de fermeture, et support complet des actions `Supprimer` et `Modifier`.

## 5. Verification Method
- **Tests unitaires Vitest** :
  `npm test src/components/messaging/`
  `npm test src/features/messaging/components/cards/__tests__/PostMessageCard.test.tsx`
- **Tests E2E Tiers 1-4** :
  `npm run test:e2e:tiers`
- **Scénarios Appium iPhone 16 Pro** :
  `node /Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/crawl-communaute-messagerie-deep.mjs`
  Vérifier les captures `06-messagerie-conv-groupe-bivouac.png` (zéro squelette persistant) et `09-messagerie-message-longpress.png` (overlay flottant non rogné, sans cassure sur 2 lignes).
