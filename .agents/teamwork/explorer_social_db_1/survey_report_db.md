# Architecture BDD & Sécurité — LKDV Social (Messagerie & Communauté Outdoor)

**Document** : Rapport d'audit et spécification d'architecture base de données  
**Auteur** : `explorer_social_db_1` (Database & Security Architecture Explorer)  
**Date** : 2026-10-04  
**Statut** : Validé pour implémentation  
**Périmètre** : `supabase/migrations/`, `src/features/messaging/`, `src/lib/supabase/types.ts`  

---

## 1. Synthèse Exécutive & Périmètre Architectural

Le projet **« LKDV Social »** formalise le système de messagerie et la communauté outdoor d'aventure du Kit du Voyageur en s'appuyant sur l'infrastructure existante (`src/features/messaging/` et Supabase PostgreSQL) sans créer de système parallèle.

L'objectif de cette étude est d'établir le schéma de données, la gouvernance de sécurité (Row Level Security & RPCs SECURITY DEFINER), les mécanismes de séquencement et d'idempotence, ainsi que les modèles relationnels pour :
1. **Le socle canonique de messagerie** : conversations 1:1 (DM) et de groupes, adhésions, séquencement strict per-conversation (`sequence_number`), idempotence réseau (`client_nonce`), et synchronisation d'état de lecture fiable (`last_read_sequence`).
2. **Le verrouillage RLS étanche** : élimination complète des risques de fuite inter-conversations, vérification stricte des membres actifs (`left_at IS NULL`), et optimisation des prédicats avec sous-requêtes InitPlan `(SELECT auth.uid())`.
3. **La structure de Clubs & Salons** : clubs thématiques/régionaux, salons (`club_channels`) avec pont direct sur le moteur conversationnel canonique, et matrice de rôles outdoor à 5 niveaux (`owner`, `admin`, `guide`, `safety`, `member`).
4. **Les Expedition Rooms** : espaces de coordination temps réel liant conversation, tracé GPX, conditions météo, checklist partagée et check-ins terrain géolocalisés.
5. **L'IA d'aventure Terra** : configuration des permissions par conversation, niveau d'accès et consentements explicites, persistance des actions proposées sous forme de brouillons (`terra_drafted_actions`) avec citations obligatoires des messages sources.
6. **La réputation collaborative & Streaks d'aventure** : points de contribution fondés sur l'utilité réciproque (avis utile, complétion de checklist, check-in validé) avec anti-spam strict (zéro point pour le volume brut de chat) et suivi des streaks collectifs d'aventure.

---

## 2. Audit de l'Existant & Identification des Écarts Critiques

### 2.1. Inventaire des Migrations et Tables Existantes

L'audit approfondi des 94 migrations Supabase a mis en évidence les fondations suivantes :

| Table | Migration Source | Statut Actuel | Rôle dans l'Architecture |
|---|---|---|---|
| `conversations` | `20260831000000` | Opérationnelle | Table canonique des discussions (`type IN ('direct', 'group')`, `direct_pair_key`). |
| `conversation_members` | `20260830000000`, `20260831000000` | Opérationnelle | Membres de conversation (`role IN ('member', 'admin', 'owner')`, `last_read_at`, `unread_count`). |
| `messages` | `20260831000000` | Opérationnelle | Messages (`content`, `message_type`, `reply_to_id`, `metadata`, `gps_*`). |
| `message_attachments` | `20260831000000` | Opérationnelle | Pièces jointes liées au bucket privé `message-attachments`. |
| `message_reactions` | `20260831000000` | Opérationnelle | Réactions emoji/texte per-user et per-message. |
| `message_mentions` | `20260831000000` | Opérationnelle | Mentions utilisateurs au sein des messages. |
| `clubs` | `20260713120000` | Opérationnelle | Clubs plein air (`slug`, `type`, `privacy`, `members_count`, `category`). |
| `club_members` | `20260713120000` | Opérationnelle | Adhésions clubs (`role IN ('admin', 'moderator', 'member')`, `status`). |
| `club_topics` / `replies` | `20260713120000` | Opérationnelle | Discussions asynchrones de type forum. |
| `trips` / `crews` | `20260904050000`, `20260907000000` | Opérationnelle | Entités de voyage, équipages et checklists (`trip_checklist_items`). |
| `group_live_sessions` / `positions` | `20260913200000`, `20260913210000` | Opérationnelle | Sessions et positions GPS éphémères de groupes. |
| `contributions` / `progression_events` | `20260919010000`, `20261003120000` | Opérationnelle | Système de fidélité, points de progression et ledger anti-fraude. |

### 2.2. Vulnérabilités & Gaps Détectés

1. **Absence de séquencement conversationnel (`sequence_number`)** :
   - *Constat* : Actuellement, le tri des messages repose uniquement sur `created_at DESC` (horodatage client/serveur).
   - *Risque* : En conditions terrain (latence mobile, reconnexion, micro-coupures), deux messages peuvent avoir le même timestamp ou arriver désordonnés, cassant la chronologie du fil de discussion.
   - *Correctif nécessaire* : Implémenter un compteur atomique `sequence_number BIGINT NOT NULL` unique par conversation.

2. **Absence d'idempotence réseau (`client_nonce`)** :
   - *Constat* : `messages` ne dispose d'aucune clé d'unicité client.
   - *Risque* : Lorsqu'un smartphone perd la connexion avant de recevoir le ACK du serveur, il renvoie le message lors de la reconnexion, produisant des doublons visibles dans la conversation.
   - *Correctif nécessaire* : Ajouter `client_nonce TEXT` avec contrainte `UNIQUE(conversation_id, client_nonce)`.

3. **Faiblesse du suivi de lecture (`last_read_sequence`)** :
   - *Constat* : `conversation_members` utilise `last_read_at TIMESTAMPTZ` et un compteur `unread_count` décrémenté/incrémenté de façon asynchrone côté client.
   - *Risque* : Dérive des compteurs non-lus entre appareils, faux indicateurs de messages non-lus.
   - *Correctif nécessaire* : Introduire `last_read_sequence BIGINT`, permettant de calculer `unread_count = GREATEST(0, last_sequence_number - last_read_sequence)`.

4. **Faille de sécurité dans `is_conversation_member` (Membres ayant quitté)** :
   - *Constat* : La fonction `public.is_conversation_member(target_conversation_id, target_user_id)` vérifie uniquement l'existence d'une ligne dans `conversation_members` sans vérifier `left_at IS NULL`.
   - *Risque* : Un utilisateur ayant quitté ou été exclu d'un groupe conserve un accès total en lecture et écriture RLS si sa ligne n'a pas été supprimée en base.
   - *Correctif nécessaire* : Durcir le helper pour exiger formellement `cm.left_at IS NULL`.

5. **Absence de salons temps réel pour les Clubs (`club_channels`)** :
   - *Constat* : Les clubs n'ont actuellement que des `club_topics` (type forum PHPBB/Reddit), mais aucun canal de discussion instantanée.
   - *Correctif nécessaire* : Créer la table `club_channels` pointant 1:1 vers une conversation canonique de type `'group'`, tout en héritant des permissions du club.

6. **Inadéquation des rôles de Clubs avec les exigences Outdoor** :
   - *Constat* : `club_members.role` est restreint à `('admin', 'moderator', 'member')`.
   - *Exigence LKDV Social* : Nécessite 5 rôles métier clairs : `owner`, `admin`, `guide`, `safety`, `member`.

7. **Absence d'entité unifiée pour les Expedition Rooms** :
   - *Constat* : Les expéditions sont dispersées entre `trips`, `travel_groups`, et `group_live_sessions`.
   - *Correctif nécessaire* : Créer `expedition_rooms`, `expedition_checklist_items` et `expedition_checkins` orchestrés autour d'une conversation centrale.

8. **Manque d'isolation des permissions et actions Terra AI** :
   - *Constat* : Aucune table ne consigne l'activation explicite de Terra, ses droits d'accès ou les propositions d'actions soumises à approbation humaine.

---

## 3. Spécification DDL Complète de la Migration

Voici le schéma DDL conçu selon les standards de production Supabase : idempotent, additif, rétro-compatible, avec verrouillage des grants et contraintes strictes.

```sql
-- ============================================================================
-- 20261004120000_lkdv_social_core_architecture.sql
--
-- LKDV Social — Architecture Canonique de Messagerie, Clubs & Expéditions
-- 1. Séquencement & Idempotence des Conversations
-- 2. Structure des Salons de Clubs (club_channels) & Rôles Outdoor
-- 3. Expedition Rooms, Checklists Partagées & Check-ins Terrain
-- 4. Paramétrage & Actions Brouillons Terra AI
-- 5. Streaks d'Aventure & Réputation Collaborative
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. EXTENSION DU SOCLE CANONIQUE DE MESSAGERIE
-- ────────────────────────────────────────────────────────────────────────────

-- 1.1 Colonnes de séquence et de contexte sur `conversations`
ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS last_sequence_number BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS context_type TEXT NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS context_id UUID;

DO $$ BEGIN
    ALTER TABLE public.conversations
        ADD CONSTRAINT conversations_context_type_check
        CHECK (context_type IN ('general', 'direct', 'club_channel', 'expedition_room'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1.2 Colonne last_read_sequence & élargissement des rôles sur `conversation_members`
ALTER TABLE public.conversation_members
    ADD COLUMN IF NOT EXISTS last_read_sequence BIGINT NOT NULL DEFAULT 0;

DO $$ BEGIN
    ALTER TABLE public.conversation_members
        DROP CONSTRAINT IF EXISTS conversation_members_role_check;
    ALTER TABLE public.conversation_members
        ADD CONSTRAINT conversation_members_role_check
        CHECK (role IN ('member', 'admin', 'owner', 'guide', 'safety'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1.3 Colonnes sequence_number, client_nonce et sender_type sur `messages`
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS sequence_number BIGINT,
    ADD COLUMN IF NOT EXISTS client_nonce TEXT,
    ADD COLUMN IF NOT EXISTS sender_type TEXT NOT NULL DEFAULT 'user';

DO $$ BEGIN
    ALTER TABLE public.messages
        ADD CONSTRAINT messages_sender_type_check
        CHECK (sender_type IN ('user', 'terra_ai', 'system'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1.4 Backfill rétro-compatible du sequence_number sur les messages existants
DO $$
DECLARE
    rec RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM public.messages WHERE sequence_number IS NULL) THEN
        WITH ranked AS (
            SELECT id, conversation_id,
                   ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at ASC, id ASC) as seq
            FROM public.messages
        )
        UPDATE public.messages m
        SET sequence_number = ranked.seq
        FROM ranked
        WHERE m.id = ranked.id AND m.sequence_number IS NULL;

        -- Aligner les last_sequence_number des conversations
        UPDATE public.conversations c
        SET last_sequence_number = COALESCE((
            SELECT MAX(sequence_number)
            FROM public.messages m
            WHERE m.conversation_id = c.id
        ), 0);

        -- Aligner last_read_sequence sur les membres existants
        UPDATE public.conversation_members cm
        SET last_read_sequence = COALESCE((
            SELECT MAX(m.sequence_number)
            FROM public.messages m
            WHERE m.conversation_id = cm.conversation_id
              AND m.created_at <= cm.last_read_at
        ), 0)
        WHERE cm.last_read_sequence = 0;
    END IF;
END $$;

-- Forcer NOT NULL sur sequence_number après backfill
ALTER TABLE public.messages ALTER COLUMN sequence_number SET NOT NULL;

-- Contraintes d'unicité sur messages
DO $$ BEGIN
    ALTER TABLE public.messages
        ADD CONSTRAINT uq_messages_conversation_sequence
        UNIQUE (conversation_id, sequence_number);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conversation_nonce
    ON public.messages (conversation_id, client_nonce)
    WHERE client_nonce IS NOT NULL;

-- 1.5 Trigger d'assignation atomique du numéro de séquence
CREATE OR REPLACE FUNCTION public.assign_message_sequence_and_touch_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.sequence_number IS NULL OR NEW.sequence_number = 0 THEN
        UPDATE public.conversations
        SET last_sequence_number = last_sequence_number + 1,
            last_message_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.conversation_id
        RETURNING last_sequence_number INTO NEW.sequence_number;

        IF NEW.sequence_number IS NULL THEN
            RAISE EXCEPTION 'Conversation introuvable pour assignation de séquence: %', NEW.conversation_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_message_sequence ON public.messages;
CREATE TRIGGER trg_assign_message_sequence
    BEFORE INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_message_sequence_and_touch_conversation();


-- ────────────────────────────────────────────────────────────────────────────
-- 2. STRUCTURE DES CLUBS & SALONS (CLUB_CHANNELS)
-- ────────────────────────────────────────────────────────────────────────────

-- 2.1 Élargissement des rôles de clubs (5 rôles outdoor)
DO $$ BEGIN
    ALTER TABLE public.club_members
        DROP CONSTRAINT IF EXISTS club_members_role_check;
    ALTER TABLE public.club_members
        ADD CONSTRAINT club_members_role_check
        CHECK (role IN ('owner', 'admin', 'guide', 'safety', 'member'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2.2 Table des salons de club
CREATE TABLE IF NOT EXISTS public.club_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    topic TEXT,
    channel_type TEXT NOT NULL DEFAULT 'text' CHECK (channel_type IN ('text', 'announcement', 'expedition', 'safety')),
    min_role_to_read TEXT NOT NULL DEFAULT 'member' CHECK (min_role_to_read IN ('member', 'safety', 'guide', 'admin', 'owner')),
    min_role_to_write TEXT NOT NULL DEFAULT 'member' CHECK (min_role_to_write IN ('member', 'safety', 'guide', 'admin', 'owner')),
    position INTEGER NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_club_channels_club_slug UNIQUE (club_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_club_channels_club ON public.club_channels (club_id, position ASC);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. EXPEDITION ROOMS & CHECKLISTS PARTAGÉES
-- ────────────────────────────────────────────────────────────────────────────

-- 3.1 Table des Expedition Rooms
CREATE TABLE IF NOT EXISTS public.expedition_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    destination_name TEXT,
    gpx_route_id UUID,
    gpx_snapshot JSONB DEFAULT '{}'::jsonb,
    weather_cache JSONB DEFAULT '{}'::jsonb,
    emergency_contact_info TEXT,
    created_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_expedition_rooms_trip ON public.expedition_rooms (trip_id);
CREATE INDEX IF NOT EXISTS idx_expedition_rooms_creator ON public.expedition_rooms (created_by);

-- 3.2 Items de checklist partagée d'expédition
CREATE TABLE IF NOT EXISTS public.expedition_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.expedition_rooms(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('gear', 'food', 'safety', 'shelter', 'navigation', 'general')),
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_expedition_checklist_room ON public.expedition_checklist_items (room_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_expedition_checklist_assigned ON public.expedition_checklist_items (assigned_to);

-- 3.3 Check-ins terrain géolocalisés
CREATE TABLE IF NOT EXISTS public.expedition_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.expedition_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    checkin_type TEXT NOT NULL CHECK (checkin_type IN ('status', 'bivouac', 'summit', 'water_point', 'hazard', 'sos')),
    status_text TEXT,
    lat DOUBLE PRECISION NOT NULL CHECK (lat >= -90 AND lat <= 90),
    lng DOUBLE PRECISION NOT NULL CHECK (lng >= -180 AND lng <= 180),
    altitude_m NUMERIC,
    battery_level_pct INTEGER CHECK (battery_level_pct >= 0 AND battery_level_pct <= 100),
    network_state TEXT CHECK (network_state IN ('online', 'offline_buffered', 'satellite')),
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_expedition_checkins_room_created ON public.expedition_checkins (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expedition_checkins_user ON public.expedition_checkins (user_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 4. TERRA AI : PARAMÈTRES ET ACTIONS BROUILLONS
-- ────────────────────────────────────────────────────────────────────────────

-- 4.1 Paramètres de Terra par conversation
CREATE TABLE IF NOT EXISTS public.conversation_terra_settings (
    conversation_id UUID PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    access_level TEXT NOT NULL DEFAULT 'mention_only' CHECK (access_level IN ('disabled', 'mention_only', 'quiet_catchup', 'full_copilot')),
    allow_context_reading BOOLEAN NOT NULL DEFAULT false,
    allow_draft_actions BOOLEAN NOT NULL DEFAULT true,
    allow_field_safety_alerts BOOLEAN NOT NULL DEFAULT true,
    quiet_catchup_cadence_hours INTEGER NOT NULL DEFAULT 24 CHECK (quiet_catchup_cadence_hours BETWEEN 1 AND 168),
    last_catchup_at TIMESTAMPTZ,
    configured_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4.2 Actions proposées par Terra (Stade brouillon obligatoire)
CREATE TABLE IF NOT EXISTS public.terra_drafted_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('create_expedition', 'create_poll', 'suggest_kit', 'suggest_route', 'add_checklist_items', 'weather_alert')),
    title TEXT NOT NULL,
    description TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_message_ids UUID[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'executed', 'expired')),
    proposed_by_agent TEXT NOT NULL DEFAULT 'terra_v1',
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_terra_actions_conv_status ON public.terra_drafted_actions (conversation_id, status);


-- ────────────────────────────────────────────────────────────────────────────
-- 5. RÉPUTATION COLLABORATIVE & STREAKS D'AVENTURE
-- ────────────────────────────────────────────────────────────────────────────

-- 5.1 Table des Streaks d'aventure collectifs et individuels
CREATE TABLE IF NOT EXISTS public.adventure_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streak_type TEXT NOT NULL CHECK (streak_type IN ('user', 'crew', 'club')),
    target_id UUID NOT NULL,
    current_streak_weeks INTEGER NOT NULL DEFAULT 0 CHECK (current_streak_weeks >= 0),
    longest_streak_weeks INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak_weeks >= 0),
    last_activity_week TEXT NOT NULL,
    last_activity_date DATE NOT NULL,
    total_adventures_completed INTEGER NOT NULL DEFAULT 0 CHECK (total_adventures_completed >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_adventure_streaks UNIQUE (streak_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_adventure_streaks_target ON public.adventure_streaks (streak_type, target_id);

COMMIT;
```

---

## 4. Matrice de Rôles, Capacités & Permissions

Afin d'éviter tout chevauchement non maîtrisé entre contextes (club, équipage, discussion directe), l'architecture implémente une hiérarchie stricte des 5 rôles outdoor :

| Rôle | Portée Principale | Lecture Salons | Écriture Salons | Modération / Exclusion | Création Salons / Expéditions | Validation Actions Terra |
|---|---|---|---|---|---|---|
| **`owner`** | Créateur du club ou salon | Tous | Tous | Totale | Oui | Oui |
| **`admin`** | Administrateur délégué | Tous | Tous | Membres, Guides, Safety | Oui | Oui |
| **`guide`** | Encadrant certifié / meneur | Tous | Salons normaux + Expéditions | Non | Création Expéditions & Salons sorties | Oui (itinéraires, kits) |
| **`safety`** | Responsable sécurité / météo | Tous | Salons normaux + Alertes Safety | Bannissement temporaire SOS | Non | Oui (alertes météo) |
| **`member`** | Voyageur actif | Salons publics du club | Salons autorisés | Aucune | Non | Non |

### Règle d'Immuabilité des Rôles (Trigger de Sécurité)

La modification des rôles est strictement contrôlée par la fonction `enforce_member_role_hierarchy` étendue :
- Un `member` ne peut jamais promouvoir un pair.
- Seul un `owner` peut céder la propriété ou nommer un co-propriétaire.
- Un `admin` ne peut pas modifier un `owner`.

---

## 5. Politiques Supabase RLS de Haute Sécurité

Les politiques RLS ci-dessous garantissent l'isolation hermétique entre conversations et résolvent la faille des utilisateurs sortants (`left_at`).

### 5.1. Helpers SQL `SECURITY DEFINER` Durcis

```sql
-- Helper de validation d'adhésion active
CREATE OR REPLACE FUNCTION public.is_conversation_member(
    target_conversation_id UUID,
    target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    -- 1. Membre direct actif d'une conversation (DM ou Groupe)
    SELECT EXISTS (
        SELECT 1
        FROM public.conversation_members cm
        WHERE cm.conversation_id = target_conversation_id
          AND cm.user_id = target_user_id
          AND cm.left_at IS NULL
    )
    OR
    -- 2. Membre actif d'un club ayant accès au salon
    EXISTS (
        SELECT 1
        FROM public.club_channels cc
        JOIN public.club_members clm ON clm.club_id = cc.club_id
        WHERE cc.conversation_id = target_conversation_id
          AND clm.user_id = target_user_id
          AND clm.status = 'active'
    )
    OR
    -- 3. Membre autorisé d'une Expedition Room rattachée à un voyage
    EXISTS (
        SELECT 1
        FROM public.expedition_rooms er
        WHERE er.conversation_id = target_conversation_id
          AND (
              er.created_by = target_user_id
              OR (er.trip_id IS NOT NULL AND public.can_read_trip(er.trip_id))
          )
    );
$$;

-- Helper de capacité d'écriture dans une conversation
CREATE OR REPLACE FUNCTION public.can_post_in_conversation(
    target_conversation_id UUID,
    target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    -- Vérifie d'abord l'adhésion de base
    SELECT CASE
        -- Pour un salon de club, vérifier le min_role_to_write
        WHEN EXISTS (SELECT 1 FROM public.club_channels WHERE conversation_id = target_conversation_id) THEN
            EXISTS (
                SELECT 1
                FROM public.club_channels cc
                JOIN public.club_members clm ON clm.club_id = cc.club_id
                WHERE cc.conversation_id = target_conversation_id
                  AND clm.user_id = target_user_id
                  AND clm.status = 'active'
                  AND (
                      cc.min_role_to_write = 'member'
                      OR (cc.min_role_to_write = 'guide' AND clm.role IN ('guide', 'admin', 'owner'))
                      OR (cc.min_role_to_write = 'safety' AND clm.role IN ('safety', 'admin', 'owner'))
                      OR (cc.min_role_to_write = 'admin' AND clm.role IN ('admin', 'owner'))
                      OR (cc.min_role_to_write = 'owner' AND clm.role = 'owner')
                  )
            )
        -- Pour les autres conversations, l'adhésion active suffit
        ELSE public.is_conversation_member(target_conversation_id, target_user_id)
    END;
$$;

REVOKE ALL ON FUNCTION public.is_conversation_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_post_in_conversation(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_post_in_conversation(UUID, UUID) TO authenticated, service_role;
```

### 5.2. Politiques RLS sur les Tables Clés

```sql
-- ── Messages ────────────────────────────────────────────────────────────────
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_messages" ON public.messages;
CREATE POLICY "members_select_messages" ON public.messages
    FOR SELECT TO authenticated
    USING (public.is_conversation_member(conversation_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "members_insert_messages" ON public.messages;
CREATE POLICY "members_insert_messages" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = (SELECT auth.uid())
        AND public.can_post_in_conversation(conversation_id, (SELECT auth.uid()))
    );

-- ── Club Channels ───────────────────────────────────────────────────────────
ALTER TABLE public.club_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_members_select_channels" ON public.club_channels;
CREATE POLICY "club_members_select_channels" ON public.club_channels
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = club_channels.club_id
              AND cm.user_id = (SELECT auth.uid())
              AND cm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "club_admins_manage_channels" ON public.club_channels;
CREATE POLICY "club_admins_manage_channels" ON public.club_channels
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = club_channels.club_id
              AND cm.user_id = (SELECT auth.uid())
              AND cm.role IN ('admin', 'owner')
              AND cm.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = club_channels.club_id
              AND cm.user_id = (SELECT auth.uid())
              AND cm.role IN ('admin', 'owner')
              AND cm.status = 'active'
        )
    );

-- ── Expedition Rooms ────────────────────────────────────────────────────────
ALTER TABLE public.expedition_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_expedition_rooms" ON public.expedition_rooms;
CREATE POLICY "members_select_expedition_rooms" ON public.expedition_rooms
    FOR SELECT TO authenticated
    USING (public.is_conversation_member(conversation_id, (SELECT auth.uid())));

-- ── Terra Drafted Actions ───────────────────────────────────────────────────
ALTER TABLE public.terra_drafted_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_terra_drafts" ON public.terra_drafted_actions;
CREATE POLICY "members_select_terra_drafts" ON public.terra_drafted_actions
    FOR SELECT TO authenticated
    USING (public.is_conversation_member(conversation_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "admins_update_terra_drafts" ON public.terra_drafted_actions;
CREATE POLICY "admins_update_terra_drafts" ON public.terra_drafted_actions
    FOR UPDATE TO authenticated
    USING (public.is_conv_admin(conversation_id, (SELECT auth.uid())))
    WITH CHECK (public.is_conv_admin(conversation_id, (SELECT auth.uid())));
```

---

## 6. Fonctions RPC Transactionnelles Obligatoires

### 6.1. `send_message_idempotent` (Idempotence & Séquencement)

Cette fonction élimine les duplications réseau lors des pertes/reconnexions mobiles :

```sql
CREATE OR REPLACE FUNCTION public.send_message_idempotent(
    p_conversation_id UUID,
    p_client_nonce TEXT,
    p_content TEXT,
    p_message_type TEXT DEFAULT 'text',
    p_reply_to_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_existing_msg RECORD;
    v_new_msg RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
    END IF;

    IF NOT public.can_post_in_conversation(p_conversation_id, v_caller_id) THEN
        RAISE EXCEPTION 'Interdit d écrire dans cette conversation' USING ERRCODE = '42501';
    END IF;

    -- Vérification d'idempotence via le client_nonce
    IF p_client_nonce IS NOT NULL THEN
        SELECT id, conversation_id, sender_id, content, message_type, sequence_number, created_at
        INTO v_existing_msg
        FROM public.messages
        WHERE conversation_id = p_conversation_id
          AND client_nonce = p_client_nonce
        LIMIT 1;

        IF v_existing_msg.id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'id', v_existing_msg.id,
                'conversation_id', v_existing_msg.conversation_id,
                'sender_id', v_existing_msg.sender_id,
                'content', v_existing_msg.content,
                'message_type', v_existing_msg.message_type,
                'sequence_number', v_existing_msg.sequence_number,
                'created_at', v_existing_msg.created_at,
                'is_duplicate', true
            );
        END IF;
    END IF;

    -- Insertion du message (le trigger assign_message_sequence incrémente la séquence)
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        content,
        message_type,
        reply_to_id,
        metadata,
        client_nonce
    )
    VALUES (
        p_conversation_id,
        v_caller_id,
        p_content,
        p_message_type,
        p_reply_to_id,
        p_metadata,
        p_client_nonce
    )
    RETURNING id, conversation_id, sender_id, content, message_type, sequence_number, created_at
    INTO v_new_msg;

    -- Mettre à jour la lecture de l'émetteur automatiquement
    UPDATE public.conversation_members
    SET last_read_sequence = GREATEST(last_read_sequence, v_new_msg.sequence_number),
        last_read_at = v_new_msg.created_at,
        unread_count = 0
    WHERE conversation_id = p_conversation_id AND user_id = v_caller_id;

    RETURN jsonb_build_object(
        'id', v_new_msg.id,
        'conversation_id', v_new_msg.conversation_id,
        'sender_id', v_new_msg.sender_id,
        'content', v_new_msg.content,
        'message_type', v_new_msg.message_type,
        'sequence_number', v_new_msg.sequence_number,
        'created_at', v_new_msg.created_at,
        'is_duplicate', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.send_message_idempotent(UUID, TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_message_idempotent(UUID, TEXT, TEXT, TEXT, UUID, JSONB) TO authenticated, service_role;
```

### 6.2. `mark_conversation_read_sequence` (Lecture Déterministe)

```sql
CREATE OR REPLACE FUNCTION public.mark_conversation_read_sequence(
    p_conversation_id UUID,
    p_sequence_number BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_conv_last_seq BIGINT;
    v_new_unread INTEGER;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
    END IF;

    SELECT last_sequence_number INTO v_conv_last_seq
    FROM public.conversations
    WHERE id = p_conversation_id;

    IF v_conv_last_seq IS NULL THEN
        RAISE EXCEPTION 'Conversation introuvable' USING ERRCODE = 'P0002';
    END IF;

    v_new_unread := GREATEST(0, (v_conv_last_seq - p_sequence_number)::INTEGER);

    UPDATE public.conversation_members
    SET last_read_sequence = GREATEST(last_read_sequence, p_sequence_number),
        last_read_at = timezone('utc'::text, now()),
        unread_count = v_new_unread,
        updated_at = timezone('utc'::text, now())
    WHERE conversation_id = p_conversation_id
      AND user_id = v_caller_id;

    RETURN jsonb_build_object(
        'conversation_id', p_conversation_id,
        'last_read_sequence', p_sequence_number,
        'unread_count', v_new_unread
    );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read_sequence(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read_sequence(UUID, BIGINT) TO authenticated, service_role;
```

### 6.3. `review_terra_drafted_action` (Gouvernance Humaine des Actions IA)

```sql
CREATE OR REPLACE FUNCTION public.review_terra_drafted_action(
    p_action_id UUID,
    p_approved BOOLEAN,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_draft RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_draft
    FROM public.terra_drafted_actions
    WHERE id = p_action_id;

    IF v_draft.id IS NULL THEN
        RAISE EXCEPTION 'Action brouillon introuvable' USING ERRCODE = 'P0002';
    END IF;

    IF v_draft.status <> 'draft' THEN
        RAISE EXCEPTION 'Cette action a déjà été traitée (statut: %)', v_draft.status USING ERRCODE = '22023';
    END IF;

    IF NOT public.is_conv_admin(v_draft.conversation_id, v_caller_id) THEN
        RAISE EXCEPTION 'Seul un administrateur ou guide peut valider une action Terra' USING ERRCODE = '42501';
    END IF;

    UPDATE public.terra_drafted_actions
    SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
        reviewed_by = v_caller_id,
        reviewed_at = timezone('utc'::text, now()),
        rejection_reason = CASE WHEN NOT p_approved THEN p_rejection_reason ELSE NULL END,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_action_id;

    RETURN jsonb_build_object(
        'action_id', p_action_id,
        'status', CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
        'reviewed_by', v_caller_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.review_terra_drafted_action(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_terra_drafted_action(UUID, BOOLEAN, TEXT) TO authenticated, service_role;
```

---

## 7. Réputation Collaborative, Streaks & Anti-Spam

### 7.1. Principes Anti-Spam de la Messagerie
1. **Zéro point sur les messages bruts** : L'envoi de messages textuels dans les salons ou DM ne confère aucun point d'XP ou de récompense.
2. **Valorisation de l'Utilité Réciproque** : Les points sont attribués exclusivement lorsqu'un tiers valide l'utilité d'un contenu :
   - Réaction `useful` sur un message de conseil : **+10 pts** (limité à 3 réceptions par utilisateur par jour pour éviter la connivence).
   - Réaction `security` (signalement d'un danger vérifié) : **+15 pts**.
   - Prise en charge et complétion d'un item de checklist partagée d'expédition : **+20 pts**.
   - Check-in terrain horodaté et certifié avec altitude/batterie : **+25 pts**.
3. **Journalisation Immuable via Ledger** :
   Chaque gain de réputation passe par l'insertion dans `progression_events` avec une clé d'idempotence composite (`reciprocal:<target_id>:<trigger_user_id>`).

### 7.2. Logique des Streaks d'Aventure
- Calcul hebdomadaire sur base de calendrier ISO (`YYYY-Www`).
- Activité qualifiante : expédition complétée, randonnée validée ou check-in d'étape.
- Un groupe de voyage / club maintient un streak collectif : si au moins une aventure est menée à bien dans la semaine par les membres de l'équipage, le streak augmente de +1.

---

## 8. Index de Performance & Stratégie d'Optimisation

Pour supporter une volumétrie élevée de messages et de requêtes temps réel avec des temps de réponse sous les 15 ms :

```sql
-- Messages : Clé composite pour la pagination par curseur de séquence
CREATE INDEX IF NOT EXISTS idx_messages_conv_sequence_desc
    ON public.messages (conversation_id, sequence_number DESC);

-- Messages : Recherche rapide par expéditeur et date
CREATE INDEX IF NOT EXISTS idx_messages_sender_created
    ON public.messages (sender_id, created_at DESC);

-- Membres : Filtrage ultra-rapide des membres actifs (exclusion left_at)
CREATE INDEX IF NOT EXISTS idx_conv_members_active_lookup
    ON public.conversation_members (conversation_id, user_id)
    WHERE left_at IS NULL;

-- Salons : Tri par position au sein du club
CREATE INDEX IF NOT EXISTS idx_club_channels_order
    ON public.club_channels (club_id, position ASC);

-- Check-ins : Accès chronologique inversé pour les flux cockpit
CREATE INDEX IF NOT EXISTS idx_expedition_checkins_timeline
    ON public.expedition_checkins (room_id, created_at DESC);

-- Actions Terra : Filtrage des brouillons en attente de validation
CREATE INDEX IF NOT EXISTS idx_terra_actions_pending
    ON public.terra_drafted_actions (conversation_id, created_at DESC)
    WHERE status = 'draft';
```

---

## 9. Mappage des Types TypeScript (`types.ts`)

Pour assurer une cohérence stricte avec la base, les interfaces suivantes doivent enrichir `src/lib/supabase/types.ts` et `src/features/messaging/types/messaging.types.ts` :

```typescript
// ── Rôles & Types Conversationnels LKDV Social ──────────────────────────────
export type OutdoorMemberRole = 'owner' | 'admin' | 'guide' | 'safety' | 'member';
export type ConversationContextType = 'general' | 'direct' | 'club_channel' | 'expedition_room';
export type MessageSenderType = 'user' | 'terra_ai' | 'system';

export interface DatabaseConversationExtended {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  avatar_url: string | null;
  created_by: string | null;
  direct_pair_key: string | null;
  last_sequence_number: number;
  context_type: ConversationContextType;
  context_id: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseConversationMemberExtended {
  id: string;
  conversation_id: string;
  user_id: string;
  role: OutdoorMemberRole;
  is_muted: boolean;
  is_archived: boolean;
  last_read_sequence: number;
  last_read_at: string;
  unread_count: number;
  joined_at: string;
  left_at: string | null;
}

export interface DatabaseMessageExtended {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: MessageSenderType;
  content: string;
  message_type: string;
  sequence_number: number;
  client_nonce: string | null;
  reply_to_id: string | null;
  metadata: Record<string, unknown> | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_label: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Salons de Clubs ─────────────────────────────────────────────────────────
export type ChannelType = 'text' | 'announcement' | 'expedition' | 'safety';

export interface DatabaseClubChannel {
  id: string;
  club_id: string;
  conversation_id: string;
  name: string;
  slug: string;
  topic: string | null;
  channel_type: ChannelType;
  min_role_to_read: OutdoorMemberRole;
  min_role_to_write: OutdoorMemberRole;
  position: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// ── Expedition Rooms ────────────────────────────────────────────────────────
export type ExpeditionStatus = 'planning' | 'active' | 'completed' | 'archived';

export interface DatabaseExpeditionRoom {
  id: string;
  conversation_id: string;
  trip_id: string | null;
  title: string;
  status: ExpeditionStatus;
  start_date: string | null;
  end_date: string | null;
  destination_name: string | null;
  gpx_route_id: string | null;
  gpx_snapshot: Record<string, unknown>;
  weather_cache: Record<string, unknown>;
  emergency_contact_info: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseExpeditionChecklistItem {
  id: string;
  room_id: string;
  label: string;
  category: 'gear' | 'food' | 'safety' | 'shelter' | 'navigation' | 'general';
  assigned_to: string | null;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export type ExpeditionCheckinType = 'status' | 'bivouac' | 'summit' | 'water_point' | 'hazard' | 'sos';

export interface DatabaseExpeditionCheckin {
  id: string;
  room_id: string;
  user_id: string;
  checkin_type: ExpeditionCheckinType;
  status_text: string | null;
  lat: number;
  lng: number;
  altitude_m: number | null;
  battery_level_pct: number | null;
  network_state: 'online' | 'offline_buffered' | 'satellite' | null;
  message_id: string | null;
  created_at: string;
}

// ── Terra AI & Actions ──────────────────────────────────────────────────────
export type TerraAccessLevel = 'disabled' | 'mention_only' | 'quiet_catchup' | 'full_copilot';
export type TerraActionType = 'create_expedition' | 'create_poll' | 'suggest_kit' | 'suggest_route' | 'add_checklist_items' | 'weather_alert';
export type TerraActionStatus = 'draft' | 'approved' | 'rejected' | 'executed' | 'expired';

export interface DatabaseConversationTerraSettings {
  conversation_id: string;
  is_enabled: boolean;
  access_level: TerraAccessLevel;
  allow_context_reading: boolean;
  allow_draft_actions: boolean;
  allow_field_safety_alerts: boolean;
  quiet_catchup_cadence_hours: number;
  last_catchup_at: string | null;
  configured_by: string | null;
  updated_at: string;
}

export interface DatabaseTerraDraftedAction {
  id: string;
  conversation_id: string;
  action_type: TerraActionType;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  source_message_ids: string[];
  status: TerraActionStatus;
  proposed_by_agent: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// ── Streaks d'Aventure ──────────────────────────────────────────────────────
export interface DatabaseAdventureStreak {
  id: string;
  streak_type: 'user' | 'crew' | 'club';
  target_id: string;
  current_streak_weeks: number;
  longest_streak_weeks: number;
  last_activity_week: string;
  last_activity_date: string;
  total_adventures_completed: number;
  updated_at: string;
}
```

---

## 10. Recommandations pour la Phase d'Implémentation

1. **Migration sans interruption** :
   - Déployer la migration DDL (`20261004120000_lkdv_social_core_architecture.sql`).
   - Le script gère le calcul rétro-compatible des séquences et l'idempotence des contraintes.
2. **Mise à niveau de `messagingService.ts`** :
   - Remplacer le double appel `insert + update` par l'appel RPC direct à `send_message_idempotent`.
   - Fournir un `client_nonce` via `crypto.randomUUID()` généré au niveau du store local/UI avant envoi.
   - Brancher `markAsRead` sur la fonction RPC `mark_conversation_read_sequence`.
3. **Tests de Sécurité & Non-Régression** :
   - Tester l'exclusion d'un utilisateur d'une conversation (`left_at`) pour prouver qu'il ne reçoit plus d'événements et ne peut plus poster.
   - Valider la tentative de doublon avec le même `client_nonce` et vérifier qu'un seul message est créé.
   - Vérifier qu'un membre sans rôle privilégié ne peut pas valider une action `terra_drafted_actions`.
