# NOTE P6 — Messagerie fonctionnelle : état des lieux (lecture seule) + plan phasé

> Agent P6 — mission STRICTEMENT EN LECTURE SEULE. Aucun code produit modifié,
> aucune migration écrite, aucune base touchée. Seul fichier créé : le présent
> `NOTE-P6-PLAN.md`. Constat P5 reconduit : `/messagerie` non authentifié affiche
> le mur « Connexion requise » (`src/app/messagerie/page.tsx:70-87`) — les
> correctifs P5 portent sur l'état authentifié, non revalidables visuellement
> sans compte test (cf. §5).

Date : 2026-09-22 · Repo : `kitduvoyageur_1783951966810` · Base : commit `d4570c96` (P5).

---

## 1. État des lieux — existant inventorié (preuves)

### 1.1 `src/features/messaging/` (22 composants, 5 hooks, 1 service, 1 types, 1 lib)

**Composants** (`components/`) :
`AudioPlayerBubble`, `ComposerMenuSheet` (GPX/équipement/rando/kit),
`ConversationList`, `ConversationOptionsMenuModal`, `ConversationOptionsSheet`,
`ConversationRow` (retouché P5 : tokens 11px, pastille non-lus, swipe 44px),
`ConversationView` (chef d'orchestre : `useMessages` + `useRealtimeMessaging` +
handlers `handleSend*`), `ForwardMessageSheet`, `GPXPreviewCard`,
`GroupSettingsModal`, `KitCard`, `MessageBubble`, `MessageComposer` (retouché P5 :
`input[type=file]` labellisé), `MessageInbox`, `MessageList` (+ skeleton,
séparateurs jour, groupement 2 min, accusés calculés client),
`MobileSheet`, `NewConversationModal`, `OpenGraphCard`, `ProductCard`,
`TrailCard`, `TypingIndicator`, `VoiceRecorderBar`.

**Hooks** (`hooks/`) :
- `useMessages.ts` — fetch + optimistic text + subscription realtime
  (`chat-messages-${conversationId}-<rand>` : `postgres_changes` INSERT
  `messages` filtré `conversation_id`, + `*` sur `message_reactions` avec
  refetch complet) ; `markAsRead` après fetch et à chaque INSERT d'autrui.
- `useConversations.ts` — fetch + subscription
  (`user-conversations-<uid>-<rand>` : `*` sur `conversation_members`
  filtré `user_id`, + UPDATE sur `conversations` → refetch complet).
- `useRealtimeMessaging.ts` — typing par `broadcast` (`typing-<conv>` envoi,
  `typing-<conv>-<rand>` écoute, timeout 3 s) ; ignore l'echo propre.
- `useKeyboardInset.ts`, `useBackGuard.ts` — confort iOS / nav (hors scope
  fonctionnel).

**Service** (`services/messagingService.ts`, 1311 lignes) :
`getConversations` (members → conversations → last message → `public_profiles`),
`getOrCreateDirectConversation` (RPC), `getMessages(conversationId, limit=50)`,
`toggleReaction`, `sendMessage` (INSERT `messages` + bump `last_message_at` +
INSERT `notifications` best-effort), `uploadAttachment` (bucket
`message-attachments`, chemin `{conversationId}/{userId}/{fichier}`, URL signée
24 h, fallback `URL.createObjectURL`), `markAsRead` (`unread_count=0` +
`last_read_at`), `getBlockedUserIds`, `updateMemberPreferences`,
`accept/declineMessageRequest`, `forwardMessage` (contrôle membership + blocage
réciproque + copie message + copie `message_attachments`), `getShareableInventory`
(`product_ownership` + `products`), `getShareableTrails` (`hiking_routes`),
`getGroupMembers`, `updateGroupInfo`, `updateMemberRole`, `removeGroupMember`,
`leaveGroup` (garde owner-transfer). **Mode démo** : `demo-conv-*` servis depuis
`Map` locale + cache `demoConversationsCache` (persiste mute/archivé/accepté
entre rendus) ; **fallback démo si la base échoue ou revient vide**
(`getMessages` retourne la démo si `error || data.length===0`, `sendMessage`
renvoie un objet local si INSERT échoue).

**Types** (`types/messaging.types.ts`) : `ConversationType`, `MessageType`
(`text|image|video|file|system|audio|gpx|product|trail|kit`), `ProductMessageMeta`
/ `TrailMessageMeta` / `KitMessageMeta` (série dans `messages.metadata`),
`Conversation` (`unread_count`, `is_muted`, `is_archived`, `status`),
`ConversationMember` (`last_read_at`, `unread_count`), `MessageAttachment`,
`MessageReaction`, `Message` (`status: sending|sent|error`, `metadata`).

**Lib** (`lib/messagingUtils.ts`) : format dates FR, timestamps relatifs,
`truncateText`. Aucune logique métier.

### 1.2 Base — tables canoniques (migration `20260831000000_messaging_system_canonical.sql`)

`conversations` (`type` direct|group + CHECK, `direct_pair_key` + index unique
partiel, `last_message_at`), `conversation_members` (UNIQUE conv+user, `role`
member|admin|owner, `is_muted`, `is_archived`, `last_read_at`, `unread_count>=0`,
`left_at`), `messages` (`conversation_id`, `sender_id` NOT NULL, `content`,
`message_type`, `reply_to_id` self-FK, `metadata` JSONB, champs GPS, `deleted_at`
soft-delete), `message_attachments` (`message_id` CASCADE, `file_url`,
`file_name/type/size>0`), `message_reactions` (UNIQUE msg+user+value),
`message_mentions` (UNIQUE msg+mentionné, `is_read`), `travel_groups.conversation_id`
UNIQUE. Index : `last_message_at DESC`, `messages(conv, created_at DESC)`,
`sender`, `attachments(msg)`, `reactions(msg)`.
Tables legacy co-existantes dans le baseline (`group_messages`,
`groupe_messages`) — non utilisées par le service ; à déprécier hors P6.
Fonctions : `get_or_create_direct_conversation` (SECURITY DEFINER, advisory lock
sur pair-key, self-DM rejeté), `is_conversation_member` / `is_conv_admin` /
`is_conv_owner` (référencées par les policies). Triggers : immuabilité
`conversation_id`+`sender_id` sur `messages`, hiérarchie rôles sur
`conversation_members`.

### 1.3 RLS actuelles (lecture seule — cf. migration canonique §6 + test pgTAP)

- `conversations` : SELECT membres, UPDATE admins, DELETE créateur/owner. Pas
  d'INSERT direct (création via RPC DM ; groupes créés côté app — point à
  vérifier en phase 1).
- `conversation_members` : SELECT membres, INSERT admins, UPDATE
  (soi-même ou admin), DELETE (soi-même ou admin).
- `messages` : SELECT membres, INSERT `sender_id = auth.uid()` + membre, UPDATE
  / DELETE expéditeur + membre.
- `message_attachments` : SELECT si membre de la conv du message ; INSERT si
  expéditeur du message + membre. Pas d'UPDATE (ok).
- `message_reactions` : SELECT si membre ; INSERT `user_id = auth.uid()` + membre ;
  DELETE `user_id = auth.uid()`.
- Storage `message-attachments` (**privé**, 25 Mo,
  `image/jpeg|png|webp|gif`, `video/mp4`, `application/pdf`, `text/plain`) :
  SELECT si membre de la conv = `foldername(name)[1]` ; INSERT si
  `foldername(name)[2] = auth.uid()` + membre ; DELETE si segment 2 = uid.
  Chemin imposé `{conversationId}/{userId}/{fichier}` — le service le respecte.
- Couverture test : `supabase/tests/database/messaging_security.test.sql`
  (15 assertions : anon aveugle, non-membre aveugle, anti-usurpation,
  anti-déplacement, anti-auto-ajout, anti-auto-promotion, DELETE sans effet,
  RPC refusées à anon, self-DM rejeté, storage anonyme vide).

### 1.4 Realtime déjà en usage dans le repo

- Messagerie : `useMessages` (INSERT `messages`, `*` `message_reactions`),
  `useConversations` (`conversation_members` + `conversations`),
  `useRealtimeMessaging` (`broadcast` typing). Client :
  `createBrowserClient` de `@supabase/ssr` (`src/lib/supabase/client.ts`),
  **sans option `realtime` explicite** (défaut SDK) ; `removeChannel` au cleanup.
- Hors messagerie : aucun autre `postgres_changes` applicatif (bus interne
  `eventBus`, stores hiking : `subscribe` mémoire, pas de realtime distant).
- **Non couvert par realtime** : UPDATE/DELETE `messages`, `message_attachments`,
  `message_mentions`, changements de rôles (hormis refetch via members `*`),
  presence.

### 1.5 Page `/messagerie` — mur auth (constat P5)

`src/app/messagerie/page.tsx:66-87` : `loading` → skeleton ; `!user` → Card
« Connexion requise » + CTA `/connexion` ; sinon `MessageInbox`. Les captures P5
(`phase-messagerie/avant|apres`, 1 route × 2 viewports) montrent donc le mur,
pas les correctifs `ConversationRow`/composer. Manifestes :
`manifest-p5-avant.json` / `manifest-p5-apres.json`, `consoleErrorCount=0`.

---

## 2. Gaps fonctionnels (cartographie)

1. **Temps réel incomplet** — INSERT `messages` + refetch aveugle sur
   `message_reactions` seulement ; pas de UPDATE (édition), pas de DELETE
   (suppression/soft-delete `deleted_at` jamais souscrit), pas de realtime
   `message_attachments` / `mentions` / rôles ; suffixe aléatoire dans les noms
   de channels (pas de channel partagé) ; typing en `broadcast` sans presence
   (pas de « en ligne ») ; réactions = refetch complet des 50 messages à chaque
   événement (coût + clignotement).
2. **Statuts lu/non-lu non fiables** — aucun incrément serveur de
   `unread_count` (aucun trigger/RPC : la colonne n'est remise qu'à 0 par
   `markAsRead`) ; `last_read_at` écrit côté client sans garde (course si deux
   onglets) ; accusés calculés dans `MessageList.tsx:205-221` par comparaison
   `last_read_at >= msgTime - 1000` (heuristique, pas un vrai double-tick) ;
   pas de lecture par message (table `message_mentions.is_read` inutilisée côté
   client) ; pas de propagation temps réel du « lu » vers l'expéditeur.
3. **Pièces jointes à moitié branchées** — `uploadAttachment` + bucket privé +
   policies OK, mais : `MessageComposer` n'accepte que `image/*` ; jamais de
   ligne `message_attachments` créée (l'URL est mise dans `content` avec
   `message_type` image/file/gpx/audio) ; `audio/webm` (voice notes) et `audio/*`
   **absents de la whitelist MIME du bucket** (upload voix rejeté en staging
   dur) ; pas de progression/annulation/retry ; voice/GPX/product/trail/kit sans
   optimistic UI (simple `refreshMessages()` post-envoi).
4. **Pas de pagination** — `getMessages(id, limit=50)` fixe, `ORDER ASC`, aucun
   curseur (`range`/before/after), aucun `onLoadMore` en haut de `MessageList`
   (conteneur scroll avec `handleScroll` limité au near-bottom) ; groupes actifs
   > 50 messages = historique tronqué sans accès au passé.
5. **Optimistic UI partiel + risque de doublon** — texte et réactions optimistes
   (`temp-` → `sent`/`error`), mais envois riches non optimistes ; en cas
   d'erreur texte : statut `error` sans bouton réessayer ; l'INSERT realtime
   serveur et le remplacement du `temp-id` peuvent coexister (le guard
   `prev.some(id)` compare des ids différents → doublon possible si le realtime
   arrive avant le replace).
6. **Fallbacks démo qui masquent les pannes** — `getMessages` renvoie la démo si
   `error` **ou** `data.length===0` ; `getConversations` renvoie `[]` sans
   distinguer RLS/auth/réseau ; `sendMessage` renvoie un faux `sent` local si
   l'INSERT échoue. En staging, impossible de distinguer « vide » de « cassé ».
7. **Forward storage fuyant** — `forwardMessage` copie les lignes
   `message_attachments` (OK) mais réutilise la même `file_url` / objet storage
   sous le path `{convSource}/…` ; la policy SELECT storage exige le membership
   de la **source** → les membres de la cible sans accès source obtiennent 403
   sur la pièce transférée. À corriger par recopie d'objet ou path neutre
   (décision phase 1).
8. **Notifications best-effort non vérifiées** — INSERT `notifications`
   (`new_message`, lien `/messagerie`) en try/catch silencieux après chaque
   message ; jamais de test RLS/lecture de cette table en P6 (à couvrir ou
   sortir du scope au démarrage du chantier).

---

## 3. Plan d'implémentation phasé (à exécuter quand les prérequis §4 sont fournis)

> Rappel : rien n'est exécuté dans cette note. Ordre imposé : base → realtime →
> UI → QA authentifiée.

### Phase 1 — Base : migrations + RLS + storage (d'abord, sans UI)

- **1A. Audit d'écart** : comparer staging (`pg_policies`, `storage.buckets`) à
  la canonique `20260831000000` ; lister les policies manquantes/divergentes et
  la whitelist MIME effective. Vérifier l'existence et les droits des RPC
  `is_conversation_member|is_conv_admin|is_conv_owner`.
- **1B. Migration `unread`** : trigger `AFTER INSERT ON messages` qui incrémente
  `conversation_members.unread_count` pour tous les membres sauf l'expéditeur +
  bump `conversations.last_message_at` (remplace le bump client, course-safe) ;
  `markAsRead` devient RPC `SECURITY DEFINER` (`last_read_at=now`,
  `unread_count=0` pour `auth.uid()` uniquement).
- **1C. Migration `attachments`** : décider recopie d'objet au forward
  (recommandé) vs path neutre ; ajouter `audio/webm` (+ `audio/mpeg`,
  `audio/mp4` si voix MP4) à la whitelist du bucket ; ajouter policy UPDATE
  manquante si édition de légende voulue (sinon documenter l'absence).
- **1D. Migration `pagination`** : index couvrant
  `messages(conversation_id, created_at DESC, id DESC)` si absent ; fonction
  `get_messages_page(p_conv, p_before, p_limit)` `STABLE` + `SECURITY INVOKER`
  (curseur `created_at,id`, pas d'OFFSET) ; politique SELECT inchangée.
- **1E. Tests base** : étendre `messaging_security.test.sql` (incrément unread,
  `markAsRead` ne touche qu'autrui=0 ligne, forward inter-conv storage,
  pagination curseur stable, MIME voix accepté).

### Phase 2 — Realtime (ensuite, avant l'UI)

- Canal unique par conversation `conv:<id>` : `postgres_changes`
  INSERT+UPDATE+DELETE `messages` (filtre conv), INSERT+DELETE
  `message_reactions` (patch ciblé, fin du refetch complet), INSERT
  `message_attachments`, UPDATE `conversation_members` (read receipts live).
- Canal utilisateur `user:<uid>` : `conversation_members` (unread live) +
  INSERT `conversations` (nouvelle conv sans refetch global).
- `presence` pour « en ligne / en train d'écrire » (remplace le broadcast
  ad-hoc ; garder le broadcast en repli si presence indisponible en staging).
- Dedupe stricte : clé d'idempotence client (`client_msg_id` UUID généré au
  composer, colonne + index unique, `ON CONFLICT DO NOTHING` + retour ligne
  existante) pour tuer le doublon optimistic↔realtime et permettre le retry
  sans double envoi.

### Phase 3 — UI (après base+realtime validés)

- `getMessages` → `getMessagesPage(conv, { before, limit })` ; `MessageList` :
  infinite scroll vers le haut (sentinelle IntersectionObserver + skeleton
  haut, ancre de scroll préservée),jump « nouveaux messages ↓ » conservé.
- Composer : `accept` élargi (image+vidéo+pdf+gpx selon whitelist finale),
  barre de progression + annulation (AbortController) + échec avec **Réessayer**
  (même `client_msg_id`) ; création systématique de la ligne
  `message_attachments` (fini le `content=URL`).
- Accusés : simple-tick `sent`, double-tick `last_read_at >= created_at` par
  destinataire (direct) / `readByCount` (groupe), temps réel via canal conv ;
  `unread_count` live dans `ConversationList` + badge onglet.
- Fin des fallbacks masquants : erreur réseau/RLS → état d'erreur explicite +
  retry ; conversation vide réelle → `EmptyState` ; `demo-conv-*` réservé au
  mode démo explicite (flag, jamais en staging).

### Phase 4 — QA + durcissement

- `type-check` / `lint` / `test` (dont pgTAP étendu) / `build` /
  `verify:invariants` au vert ; scénarios deux-comptes (A→B texte, pièce,
   réaction, lu, forward inter-conv, pagination 100+ messages, offline→retry
  sans doublon) ; perfs (refetch supprimés, payloads realtime ciblées).

---

## 4. Prérequis EXACTS attendus de l'utilisateur (bloquant — rien ne démarre sans)

1. **Accès staging** : URL du projet Supabase staging (ex.
   `https://<ref>.supabase.co`) + confirmation que la canonique
   `20260831000000` y est appliquée (ou accès `supabase db push` autorisé).
2. **Comptes test** : deux comptes existants (emails + mots de passe) membres
   d'au moins une conversation commune, ou autorisation de les créer ;
   préciser si la création passe par `/connexion` ou par le dashboard.
3. **Variables d'env** : valeurs staging pour `.env.local` —
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (jamais commitées ;
   fournies hors git, ex. coffre/secret manager).
4. **Seed** : une conversation directe A↔B avec > 60 messages + une pièce
   image + une pièce GPX (ou autorisation de la générer par script seed) pour
   valider pagination + attachments + forward.
5. **Décisions** : recopie d'objet au forward (recommandée) vs path neutre ;
   édition de messages voulue ou non ( scope UPDATE realtime) ; voix : formats
   à supporter (webm minimum).

---

## 5. Stratégie de revalidation visuelle authentifiée des correctifs P5

Contexte : P5 a corrigé `ConversationRow` (tokens 11px, pastille non-lus,
swipe 44px + focus) et `MessageComposer` (`input[file]` labellisé) sans pouvoir
les photographier (mur « Connexion requise »). Dès les prérequis §4 fournis :

1. Session Playwright authentifiée (login compte A via `/connexion`, contexte
   persisté `storageState`, jamais de credential en clair dans le repo).
2. Passe « P5-revalidation » : `/messagerie` (liste : pastille `unread_count`,
   labels swipe ≥ 11px/44px) + 1 conversation ouverte (composer labellisé,
   focus rings) × 2 viewports (393×852, 1440×900), protocole cookies P5
   reconduit (`scripts/design/baseline/messagerie-p5-shots.spec.ts` + variante
   auth), `cookieBannerVisible=false`, `consoleErrorCount=0`.
3. Livrables : `phase-messagerie/revalidation-auth/` (captures + manifest) +
   addendum à `NOTE-P5.md` (conforme / écart → ticket P6-phase-3).
4. La passe fonctionnelle P6 (temps réel, lus, pièces, pagination) réutilise le
   même harnais deux-comptes (A envoie → B reçoit sans refresh).

---

*Fin NOTE-P6-PLAN — lecture seule respectée (aucune modification produit/base).*
