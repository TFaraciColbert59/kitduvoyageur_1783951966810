# Rapport d'Enquête Architectural : Domaine Canonique & Algorithmes « LKDV Social »

> **Auteur** : `explorer_social_domain_1` (Teamwork Explorer — Spécialiste Domaine Canonique & Algorithmes)  
> **Date** : 2026-10-04  
> **Périmètre** : `src/features/messaging/`, entités outdoor LKDV, intégration IA Terra, réputation collaborative & Supabase  
> **Statut** : Rapport d'analyse et spécifications d'ingénierie (Read-only)

---

## 1. Synthèse Exécutive & Carte de l'Architecture

Le système de messagerie actuel de LKDV (`src/features/messaging/`) repose sur une implémentation hybride (Supabase Realtime + cache mémoire démo) structurée autour d'un service monolithique (`messagingService.ts`, 1312 lignes), de 5 hooks React et de 22 composants UI.

L'objectif de **LKDV Social** est de hisser ce socle au rang de **plateforme communautaire outdoor temps réel industrielle**, unifiant discussions directes (DM), groupes d'aventure, clubs thématiques et "Expedition Rooms" sans rupture d'API et sans créer de base de données parallèle.

### Diagnostics Clés
1. **Ordonnancement et pagination** : Les messages sont actuellement triés uniquement par `created_at ASC` avec une limite fixe de 50 messages, sans pagination par curseur ni garantie de monotonicité face aux horloges distribuées ou insertions concurrentes.
2. **Duplication réseau** : Aucun mécanisme d'idempotence client (`client_nonce`). Une perte de réseau suivie d'un rejeu provoque des doublons en base.
3. **Accusés de lecture fragiles** : Le suivi de lecture s'appuie sur la comparaison de timestamps avec une tolérance arbitraire de `-1000ms`, source d'anomalies de fuseaux horaires et d'incohérences visuelles.
4. **Absence de persistance hors-ligne** : En cas de déconnexion, l'UI bascule en erreur ou en mémoire volatile démo ; les messages non envoyés sont perdus au rechargement.
5. **Couverture de tests critique** : Un seul test unitaire existe dans le frontend (`tests/messaging/messagingUtils.spec.ts`, 7 assertions sur le formatage des dates). Le service métier, les hooks, l'ordonnancement, l'idempotence et les composants n'ont **aucun test unitaire ou d'intégration**.

---

## 2. Audit Approfondi du Socle Existant (`src/features/messaging/`)

### 2.1 Manifeste des Fichiers & Rôles

```
src/features/messaging/
├── types/
│   └── messaging.types.ts          # Modèles de données (Conversation, Message, Member, etc.)
├── services/
│   └── messagingService.ts        # Service monolithique (1312 lignes, Supabase + Mock Démo)
├── lib/
│   └── messagingUtils.ts          # Formatage dates et découpe texte
├── hooks/
│   ├── useConversations.ts        # Liste des conversations + subscription realtime
│   ├── useMessages.ts             # Messages d'une conversation + mutations optimistes
│   ├── useRealtimeMessaging.ts    # Signaux typing (broadcast Supabase)
│   ├── useBackGuard.ts            # Gestion du retour mobile
│   └── useKeyboardInset.ts        # Gestion hauteur clavier tactile iOS
└── components/
    ├── ConversationView.tsx       # Écran conversation principal (header, liste, composer, modales)
    ├── MessageList.tsx            # Fil de messages, séparateurs de dates, groupement 2min
    ├── MessageBubble.tsx          # Bulle de message (swipe reply, double-tap ❤️, long-press)
    ├── MessageComposer.tsx        # Barre de saisie (texte, audio, menu pièces jointes)
    ├── ComposerMenuSheet.tsx      # Feuille d'action d'envoi (équipement, GPX, randonnées, kits)
    ├── ConversationList.tsx       # Liste des discussions avec onglets
    ├── ConversationRow.tsx        # Item de conversation avec badges non-lus
    ├── AudioPlayerBubble.tsx      # Lecteur note vocale audio
    ├── GPXPreviewCard.tsx         # Carte preview trace GPX avec SVG et dénivelé
    ├── ProductCard.tsx            # Carte matériel LKDV
    ├── TrailCard.tsx              # Carte randonnée catalogue
    ├── KitCard.tsx                # Carte lignée de kit (ouvre KitSheetContext)
    ├── GroupSettingsModal.tsx     # Gestion membres, rôles, titre et lien cockpit départ
    ├── ConversationOptionsSheet.tsx # Options (mute, archiver, bloquer)
    ├── ForwardMessageSheet.tsx    # Transfert de message avec contrôle de blocage
    └── MobileSheet.tsx            # Sheet bottom sheet iOS native
```

### 2.2 Analyse des Types (`messaging.types.ts`)
- **`ConversationType`** : Limité à `'direct' | 'group'`. Ne modélise pas explicitement les `'expedition'` ou salons de club (`'club_channel'`).
- **`MessageType`** : Comprend déjà `'text' | 'image' | 'video' | 'file' | 'system' | 'audio' | 'gpx' | 'product' | 'trail' | 'kit'`. Manque : `'expedition'`, `'pack_merge'`, `'poll'`, `'terra_action'`.
- **`MemberRole`** : Limité à `'member' | 'admin' | 'owner'`. Ne prend pas en compte les rôles terrain modulaires requis : `'guide'`, `'safety'` (sécurité/médic).
- **`Message`** : Ne possède ni `sequence_number` (numéro d'ordre conversationnel), ni `client_nonce` (clé d'idempotence), ni drapeau de synchronisation `is_offline_pending`.
- **`ConversationMember`** : Possède `last_read_at` et `unread_count`, mais aucun `last_read_sequence`.

### 2.3 Analyse du Monolithe `messagingService.ts`
Le fichier combine plusieurs responsabilités hétérogènes :
1. **Mode Démo & Mock en mémoire** : `localDemoMessages` (Map locale) et `demoConversationsCache` conservent l'état lors de l'exploration sans compte.
2. **Requêtage Supabase sans jointures directes** : Utilise `fetchPublicProfilesWith` pour contourner l'absence de clé étrangère explicite vers `public_profiles` (pattern canonique F1 de l'application).
3. **Écritures directes non isolées** :
   - Insertion manuelle dans la table `notifications` côté client (lignes 786-807), risquant d'échouer ou de bypasser les politiques RLS serveur.
   - Mutations de préférences de membres (`conversation_members.is_muted`, `is_archived`).
4. **Calculs lourds côté client** : Résolution de slug produit dans `getShareableInventory` via scanning du catalogue entier (`limit(500)`).
5. **Gestion des fichiers privés** : Upload direct dans le bucket privé `message-attachments` avec création d'URL signée 24h (`storage.createSignedUrl`).

---

## 3. Spécifications & Conception Algorithmique Canonique

### 3.1 Consolidation Sans Rupture d'API (Pattern Façade)

Pour respecter la règle stricte de **non-régression**, `messagingService.ts` doit être conservé comme point d'entrée unique exporté, mais modularisé en sous-services de domaine spécialisés :

```
src/features/messaging/services/
├── messagingService.ts               # Façade publique inchangée (délègue aux sous-services)
├── domain/
│   ├── conversationDomainService.ts  # Création, listage, membres, rôles, transfert ownership
│   ├── messageDomainService.ts       # Envoi déterministe, curseur pagination, soft delete
│   ├── sequenceService.ts            # Gestion et calcul des numéros de séquence
│   ├── readTrackingService.ts        # Accusés de lecture agrégés par séquence
│   ├── idempotencyService.ts         # Validation client_nonce et déduplication
│   ├── offlineSyncService.ts         # File d'attente locale & réconciliation au retour réseau
│   ├── outdoorIntegrationService.ts  # Snapshots GPX, kits, Pack Merge, expéditions
│   ├── terraAssistantService.ts      # Isolation, Quiet Catch-Up, citations, actions draft
│   └── reputationRewardService.ts    # Points d'utilité réciproque & streaks collectifs
```

### 3.2 Ordonnancement Déterministe & Pagination par Curseur

#### Problème Actuel
L'ordonnancement par `created_at` souffre des dérives d'horloge entre clients et de la non-unicité des timestamps sous forte concurrence. La limite de 50 messages bloque l'accès à l'historique ancien.

#### Conception de la Séquence Monotone
Chaque conversation maintient un compteur de séquence atomique dans `public.conversations` (`last_sequence_number BIGINT DEFAULT 0`).
À chaque insertion de message :
1. Le numéro de séquence est incrémenté de manière atomique sur le serveur PostgreSQL (via un trigger `BEFORE INSERT` ou une RPC privilégiée).
2. `NEW.sequence_number := v_next_sequence;`
3. L'ordre de tri garanti et immuable est : `(conversation_id, sequence_number ASC)`.

#### Algorithme de Pagination Curseur Bidirectionnelle
```typescript
interface CursorPaginationParams {
  conversationId: string;
  cursor?: number; // sequence_number
  direction?: 'before' | 'after'; // 'before' pour scroll haut, 'after' pour rattrapage
  limit?: number; // défaut 50, max 100
}
```
- **Chargement initial** : Derniers N messages (`ORDER BY sequence_number DESC LIMIT 50`, inversés en mémoire).
- **Historique plus ancien (`before`)** : `WHERE sequence_number < cursor ORDER BY sequence_number DESC LIMIT N`.
- **Rattrapage temps réel (`after`)** : `WHERE sequence_number > cursor ORDER BY sequence_number ASC LIMIT N`.

### 3.3 Idempotence d'Envoi Client (`client_nonce`)

#### Problème Actuel
En cas de micro-coupure réseau mobile (fréquente en milieu outdoor), la requête HTTP d'envoi peut être reçue par Supabase, mais la réponse perdue par le client. Le client renvoie le message, créant un doublon strict dans le fil de discussion.

#### Conception Canonique
1. Chaque message créé côté client reçoit un `client_nonce: UUID` généré immédiatement (`crypto.randomUUID()`).
2. Contrainte d'unicité en base de données :
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conversation_client_nonce 
   ON public.messages (conversation_id, client_nonce) 
   WHERE client_nonce IS NOT NULL;
   ```
3. Fonction RPC d'envoi sécurisée `send_message_canonical` :
   ```sql
   -- Si le nonce existe déjà pour cette conversation, renvoie le message existant
   -- sans lever d'erreur et sans créer de doublon.
   SELECT * INTO v_existing FROM public.messages 
   WHERE conversation_id = p_conversation_id AND client_nonce = p_client_nonce;
   IF FOUND THEN
     RETURN v_existing;
   END IF;
   ```
4. Côté client : Même en cas de reconnexion ou de 5 tentatives consécutives, le même payload avec le même `client_nonce` garantit une sémantique d'exécution **exactement-une-fois (effectively-once)**.

### 3.4 Suivi de Lecture Agrégé (`last_read_sequence`)

#### Problème Actuel
`MessageList.tsx` compare `last_read_at` avec l'horodatage du message moins 1000 millisecondes (`m.last_read_at >= msgTime - 1000`). Ce bricolage temporel provoque des faux positifs ou des battements d'état selon la synchronisation NTP des téléphones.

#### Solution Arithmétique par Séquence
1. Dans `public.conversation_members`, ajout de `last_read_sequence BIGINT DEFAULT 0`.
2. Mutation de lecture :
   ```sql
   UPDATE public.conversation_members
   SET last_read_sequence = GREATEST(last_read_sequence, p_sequence),
       last_read_at = now(),
       unread_count = (
         SELECT COUNT(*) FROM public.messages 
         WHERE conversation_id = p_conversation_id 
           AND sequence_number > p_sequence
           AND deleted_at IS NULL
       )
   WHERE conversation_id = p_conversation_id AND user_id = auth.uid();
   ```
3. Détermination des états de lecture en complexité O(1) :
   - **En DM 1:1** : Le message est lu si `other_member.last_read_sequence >= message.sequence_number`.
   - **En Groupe** : `readByCount = members.filter(m => m.user_id !== me && m.last_read_sequence >= message.sequence_number).length`.
   - Affichage : "Vu", "Vu par 3" ou popover listant les membres ayant lu jusqu'à ce message.

### 3.5 Synchronisation Hors-Ligne & Réconciliation au Retour Réseau

#### Machine à États du Client
Le client de messagerie implémente 4 états :
1. `ONLINE` : Envoi direct via Supabase + subscription WebSocket active.
2. `OFFLINE` : Réseau inaccessible. Les messages sont stockés dans la file d'attente locale (`pending_queue`).
3. `RECONNECTING` : Récupération du signal (événement `window.online` ou WebSocket reconnectée).
4. `SYNCING` : Exécution du protocole de réconciliation en 3 phases.

#### Protocole de Réconciliation en 3 Phases
```
[Détection Online]
        │
        ▼
 Phase 1 : Flush Sortant (Outbound Drain)
 ─────────────────────────────────────────
 • Dépilement séquentiel de la `pending_queue`
 • Envoi avec `client_nonce` préservé
 • Succès -> mise à jour du message local ('sent', sequence_number serveur)
        │
        ▼
 Phase 2 : Rattrapage Entrant (Inbound Catch-Up)
 ──────────────────────────────────────────────
 • Calcul de `max_local_sequence`
 • Requête : `getMessages(convId, { cursor: max_local_sequence, direction: 'after' })`
 • Insertion des messages manquants sans duplication
        │
        ▼
 Phase 3 : Alignement des Lectures (Read Sync)
 ────────────────────────────────────────────
 • Envoi du `last_read_sequence` maximal affiché à l'écran
 • Réabonnement aux channels Realtime Postgres
```

### 3.6 Objets Outdoor de Premier Rang & Algorithme Pack Merge

#### 1. Snapshots d'Affichage GPX Performants
Le composant `GPXPreviewCard.tsx` parse actuellement le fichier GPX complet via le moteur XML client à chaque affichage, surchargeant le thread principal pour les traces longues (10 000+ points).
**Standardisation dans `metadata`** :
À l'upload du GPX, le serveur génère et enregistre un snapshot compact dans `message.metadata` :
```json
{
  "kind": "gpx_snapshot",
  "route_id": "uuid-optional",
  "title": "Tour du Mont Blanc - Étape 3",
  "distance_km": 18.4,
  "elevation_gain_m": 1250,
  "elevation_loss_m": 1120,
  "min_elevation_m": 1054,
  "max_elevation_m": 2490,
  "point_count": 8420,
  "svg_polyline": "10.2,45.1 12.4,44.8 15.1,42.0...",
  "bounds": { "minLat": 45.8, "maxLat": 46.1, "minLon": 6.8, "maxLon": 7.2 }
}
```
La bulle de message rend instantanément le tracé et les métriques sans aucun parsing XML client.

#### 2. Algorithme de Pack Merge (Fusion de Sacs d'Expédition)
Dans une expédition collective, les membres mutualisent le matériel lourd ou de secours (tente, réchaud, filtre à eau, trousse médicale).
L'algorithme de **Pack Merge** prend en entrée :
- Les kits personnels des participants (`KitSheetKit`, `GearItem[]`).
- Les capacités physiques (`ParticipantLoad[]` via `loadDistribution.ts` : ratio corporel max 20% pour un humain, 15% pour un chien).

**Étapes de l'Algorithme** :
1. **Catégorisation & Détection des Doublons** :
   - Matériel mutualisable : Réchauds (1 pour 2-4 personnes), filtres à eau (1 pour 3-5), tentes partagées, trousse de premier secours groupe.
   - Matériel strictement individuel : Sac de couchage, matelas, vêtements, couverts, gourde personnelle.
2. **Élimination du Poids Redondant** :
   - Sélection du meilleur équipement pour le groupe (le plus léger ou le plus fiable selon l'indice `KitTrustRow`).
   - Mise en "réserve / backup" des doublons non essentiels.
3. **Répartition Équitable de la Charge** :
   - Calcul de la marge disponible par équipier : `marge = maxSafeWeightKg - poidsIndividuel`.
   - Affectation des éléments collectifs aux membres ayant la plus forte marge disponible.
   - Les guides ou secouristes portent en priorité les modules de navigation et de sécurité vitale.
4. **Génération du Message Pack Merge** :
   - Publication dans le chat d'une carte interactive `PackMergeCard` affichant :
     * Poids total économisé par le groupe (ex : *-4,8 kg mutualisés*).
     * Jauges de charge par participant (vert < 80%, orange 80-100%, rouge > 100%).
     * Bouton interactif d'intégration à la checklist partagée de l'Expedition Room.

### 3.7 Intégration de Terra AI & Protocole d'Isolation

#### 1. Isolation Stricte des Permissions par Conversation
- Le contexte envoyé à Terra est hermétiquement borné au `conversation_id` courant.
- Aucune donnée issue d'autres DM ou de groupes privés tiers n'est transmise dans le prompt système ou utilisateur.
- Identité de l'expéditeur : Terra utilise uniquement les prénoms ou pseudos affichés dans la conversation courante.

#### 2. Résumés "Quiet Catch-Up"
- Accessible via un badge flottant quand le nombre de messages non lus dépasse un seuil (ex: ≥ 10 messages).
- Consomme le modèle via `askAI` (tier `fast`, feature `quiet-catch-up`).
- Format de sortie standardisé en 3 sections :
  1. 📌 **Décisions Validées** (horaires, lieux, points de rendez-vous).
  2. 🎒 **Logistique & Matériel** (qui apporte quoi, kits validés).
  3. ⚠️ **Questions en Suspens** (points restant à trancher par l'équipe).
- **Citations Précises Obligatoires** : Chaque assertion doit être suffixée par la citation de son message source avec numéro de séquence et auteur : `[seq #14, Alexandre]`.

#### 3. Actions au Stade de Brouillon Uniquement (Draft-Only Actions)
Terra n'exécute **jamais** de mutation définitive de manière autonome.
Lorsque Terra propose une action (ex : créer un sondage de date, ajouter une étape d'itinéraire, modifier la checklist collective), elle génère un payload de type `terra_action_draft` :
```typescript
export interface TerraActionDraft {
  actionId: string;
  actionType: 'create_expedition' | 'create_poll' | 'update_checklist' | 'alert_terrain';
  title: string;
  payload: Record<string, unknown>;
  requiresConfirmation: true;
  status: 'draft' | 'confirmed' | 'dismissed';
  suggestedBy: 'terra_ai';
  sourceMessageSequence?: number;
}
```
L'UI présente une carte interactive avec deux boutons : **"Valider l'action"** (exécute la mutation au nom de l'utilisateur ayant cliqué) et **"Ignorer"**.

### 3.8 Modèle de Réputation Collaborative (Anti-Spam de Messages Bruts)

Pour préserver la quiétude des voyageurs et éviter le phénomène de "farm à messages" (spam de messages courts pour accumuler des récompenses) :
1. **0 point pour l'envoi de messages de discussion brute** : L'envoi d'un message texte dans un chat ne rapporte strictement aucun point de récompense.
2. **Points Basés sur l'Utilité Réciproque Vérifiée** :
   - `PEER_UTILITY_BOOKMARK` : Un conseil matériel, un relevé de point d'eau ou un tracé partagé est enregistré/favorisé par un autre membre (+5 pts).
   - `FIELD_SAFETY_REPORT` : Signalement terrain validé (état d'un névé, source tarie, éboulement) partagé dans un salon ou une Expedition Room (+25 pts).
   - `PACK_MERGE_CONTRIBUTION` : Équipier acceptant de porter un équipement lourd mutualisé au profit du groupe (+15 pts).
   - `EXPEDITION_COMPLETED` : Expédition collective achevée avec check-ins terrain confirmés par l'ensemble des équipiers (+50 pts par participant).
3. **Streaks Collectifs d'Aventure** :
   - Remplacement du streak de connexion individuel par un streak d'équipage / de club.
   - Un streak s'incrémente lorsqu'au moins deux membres d'un groupe ou d'un club réalisent une sortie réelle ensemble dans un intervalle de 30 jours (prouvée par trace GPS ou point de passage).

---

## 4. Analyse du Schéma de Données & Cohérence RLS Supabase

### 4.1 Schéma Actuel
Les migrations canoniques existantes (`20260831000000_messaging_system_canonical.sql`, `20260925010000_messaging_rls_auth_initplan.sql`) ont établi :
- `conversations` (id, type, title, avatar_url, created_by, direct_pair_key, last_message_at, updated_at).
- `conversation_members` (id, conversation_id, user_id, role, is_muted, is_archived, last_read_at, unread_count, joined_at).
- `messages` (id, conversation_id, sender_id, content, message_type, reply_to_id, metadata, gps_lat, gps_lng, deleted_at, created_at, updated_at).
- `message_attachments` (id, message_id, file_url, file_name, file_type, file_size).
- `message_reactions` (id, message_id, user_id, reaction_type, reaction_value).

### 4.2 Extensions Nécessaires (Non Destructives)

Pour supporter l'ensemble des exigences LKDV Social sans altérer l'existant :
```sql
-- 1. Ordonnancement & Idempotence
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS last_sequence_number BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room_kind TEXT DEFAULT 'standard' CHECK (room_kind IN ('standard', 'expedition', 'club_channel')),
  ADD COLUMN IF NOT EXISTS context_id UUID;

ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS sequence_number BIGINT,
  ADD COLUMN IF NOT EXISTS client_nonce UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conv_client_nonce 
ON public.messages (conversation_id, client_nonce) 
WHERE client_nonce IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conv_sequence 
ON public.messages (conversation_id, sequence_number);

-- 2. Suivi de lecture par séquence
ALTER TABLE public.conversation_members 
  ADD COLUMN IF NOT EXISTS last_read_sequence BIGINT DEFAULT 0;

-- 3. Extension des rôles modulaires
ALTER TABLE public.conversation_members 
  DROP CONSTRAINT IF EXISTS conversation_members_role_check;

ALTER TABLE public.conversation_members 
  ADD CONSTRAINT conversation_members_role_check 
  CHECK (role IN ('member', 'admin', 'owner', 'guide', 'safety'));
```

---

## 5. État des Tests & Analyse des Lacunes de Couverture

### 5.1 Tests Existants
- `tests/messaging/messagingUtils.spec.ts` (Vitest, 7 tests, 100% passants) :
  - Couvre uniquement `formatConversationTimestamp` (temps relatifs, hier, date formattée).
- `supabase/tests/database/messaging_security.test.sql` (pgTAP, 15 tests) :
  - Couvre l'isolation RLS des conversations, l'interdiction de lecture par un tiers, l'usurpation d'identité sur l'insert de message et les règles de suppression.
- `supabase/tests/database/messaging_rls_initplan.test.sql` (pgTAP, 6 tests) :
  - Vérifie la performance des politiques RLS avec caching de `auth.uid()`.

### 5.2 Matrice des Lacunes Critiques (Gaps Identifiés)

| Domaine / Fonctionnalité | Couverture Actuelle | Risque Opérationnel | Tests Requis |
|---|---|---|---|
| `messagingService.getMessages` | 0% | Élevé (Régression chargement fil) | Test unitaire pagination + tri séquentiel |
| `messagingService.sendMessage` | 0% | Critique (Perte ou corruption de messages) | Test unitaire insertion + déduplication |
| Idempotence `client_nonce` | 0% | Critique (Doublons en réseau instable) | Test d'insertion concurrente avec même nonce |
| Séquence conversationnelle | 0% | Élevé (Désordre d'affichage) | Test de monotonicité stricte de la séquence |
| Suivi `last_read_sequence` | 0% | Modéré (Compteurs non lus erronés) | Test de mise à jour arithmétique de lecture |
| File d'attente hors-ligne | 0% | Élevé (Perte de messages rédigés en zone blanche) | Test de cycle offline -> queued -> flush -> sent |
| Pack Merge d'expédition | 0% | Élevé (Erreurs de calcul de portage) | Test d'algorithme de déduplication et ratios |
| Terra Quiet Catch-Up & Citations | 0% | Élevé (Hallucinations d'IA / Fuite de contexte) | Test d'isolation de prompt et validation de format |
| Actions Draft de Terra | 0% | Critique (Mutation non autorisée de l'IA) | Test garantissant l'état `requiresConfirmation: true` |
| Rôles Guide / Sécurité | 0% | Modéré (Permissions de modération) | Test de hiérarchie des permissions modulaires |
| Anti-Spam Réputation | 0% | Élevé (Exploitation de gains de points) | Test vérifiant 0 pt sur message brut |

---

## 6. Blueprint d'Implémentation & Interfaces TypeScript Canoniques

### 6.1 Types Canoniques Étendus (`src/features/messaging/types/canonical.types.ts`)

```typescript
export type CanonicalConversationType = 'direct' | 'group';
export type CanonicalRoomKind = 'standard' | 'expedition' | 'club_channel';

export type CanonicalMemberRole = 'member' | 'admin' | 'owner' | 'guide' | 'safety';

export type CanonicalMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'system'
  | 'audio'
  | 'gpx'
  | 'product'
  | 'trail'
  | 'kit'
  | 'expedition'
  | 'pack_merge'
  | 'poll'
  | 'terra_action';

export interface CanonicalMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sequence_number: number;
  client_nonce?: string | null;
  content: string;
  message_type: CanonicalMessageType;
  reply_to_id?: string | null;
  reply_to_message?: {
    id: string;
    sender_name: string;
    content: string;
  } | null;
  metadata?: Record<string, unknown> | null;
  status: 'queued' | 'sending' | 'sent' | 'error';
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackMergeItem {
  id: string;
  name: string;
  category: string;
  weightGrams: number;
  isMutualized: boolean;
  carrierUserId?: string;
  carrierName?: string;
}

export interface PackMergeSummary {
  kind: 'pack_merge';
  expeditionId: string;
  totalMembers: number;
  totalWeightOriginalGrams: number;
  totalWeightMergedGrams: number;
  weightSavedGrams: number;
  loads: Array<{
    userId: string;
    userName: string;
    allocatedWeightKg: number;
    maxSafeWeightKg: number;
    loadPercentage: number;
    isOverloaded: boolean;
  }>;
}

export interface TerraQuietCatchUpSummary {
  conversationId: string;
  periodStartSequence: number;
  periodEndSequence: number;
  generatedAt: string;
  keyDecisions: Array<{ text: string; citation: { sequence: number; author: string } }>;
  logistics: Array<{ text: string; citation: { sequence: number; author: string } }>;
  openQuestions: Array<{ text: string; citation?: { sequence: number; author: string } }>;
}
```

### 6.2 Interfaces des Services Modulaires

```typescript
export interface IMessageDomainService {
  getMessages(
    conversationId: string,
    options?: { cursor?: number; direction?: 'before' | 'after'; limit?: number }
  ): Promise<CanonicalMessage[]>;

  sendMessage(params: {
    conversationId: string;
    senderId: string;
    content: string;
    messageType?: CanonicalMessageType;
    clientNonce?: string;
    replyToId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CanonicalMessage>;

  markAsRead(conversationId: string, userId: string, sequenceNumber: number): Promise<void>;
}

export interface IOfflineSyncService {
  enqueueMessage(message: Omit<CanonicalMessage, 'id' | 'sequence_number' | 'status'>): Promise<string>;
  getPendingQueue(): Promise<CanonicalMessage[]>;
  reconcileOnReconnect(conversationId: string): Promise<{ syncedCount: number; errors: unknown[] }>;
}

export interface ITerraAssistantService {
  generateQuietCatchUp(params: {
    conversationId: string;
    fromSequence: number;
    toSequence: number;
  }): Promise<TerraQuietCatchUpSummary>;

  extractDecisions(conversationId: string): Promise<Array<{ text: string; sequenceNumber: number }>>;
}

export interface IPackMergeService {
  computeMerge(params: {
    expeditionId: string;
    participantKits: Array<{ userId: string; kitId: string; bodyWeightKg: number }>;
  }): Promise<PackMergeSummary>;
}
```

---

## 7. Recommandations & Prochaines Étapes pour l'Équipe

1. **Phase 1 : Migration Base de Données Supabase**
   - Rédiger la migration `20261004110000_lkdv_social_canonical_core.sql` ajoutant `sequence_number`, `client_nonce`, `last_read_sequence` et la RPC `send_message_canonical`.
2. **Phase 2 : Modularisation Interne de `messagingService.ts`**
   - Découper la logique interne en sous-modules purs et injectables dans `src/features/messaging/services/domain/` tout en conservant `messagingService` comme façade exportée.
3. **Phase 3 : Suite de Tests Vitest de Non-Régression**
   - Créer `tests/messaging/messageDomainService.spec.ts` et `tests/messaging/packMerge.spec.ts`.
4. **Phase 4 : Cartes Riches & Expéditions**
   - Implémenter les composants `PackMergeCard` et `ExpeditionRoomCockpit`.
5. **Phase 5 : Intégration Sécurisée de Terra**
   - Créer le connecteur `askAI` pour le `quiet-catch-up` avec footnotes de citation.
