-- LOT 8: Messagerie & Notifications
-- Migration: 20260810213000_lot8_messaging_and_notifications.sql
-- Auteur: LKDV Interconnectivity Repair
-- Description: Complétion du système de messagerie et amélioration des notifications
-- Timestamp: 2026-08-10 21:30:21

BEGIN;

-- ===========================================================================
-- 1. COMPLÉTION DU SYSTÈME DE MESSAGERIE
-- ===========================================================================

-- 1.1 Table des participants aux conversations
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Rôle dans la conversation
    role text DEFAULT 'member' CHECK (role IN ('member', 'admin', 'creator')),
    
    -- Statuts
    is_muted boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    notification_preferences jsonb DEFAULT '{\"new_messages\": true, \"mentions\": true, \"reactions\": true}'::jsonb,
    
    -- Métriques d'engagement
    last_read_at timestamptz,
    unread_count integer DEFAULT 0,
    total_messages_sent integer DEFAULT 0,
    
    -- Configuration
    joined_at timestamptz DEFAULT now(),
    left_at timestamptz,
    
    -- Audit
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Contraintes
    UNIQUE(conversation_id, user_id),
    CHECK (joined_at <= COALESCE(left_at, 'infinity'::timestamptz)),
    CHECK (unread_count >= 0),
    CHECK (total_messages_sent >= 0)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON public.conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_last_read_at ON public.conversation_members(last_read_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_members_is_archived ON public.conversation_members(is_archived);

-- 1.2 Table des réactions aux messages
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Type de réaction (emoji ou texte court)
    reaction_type text NOT NULL CHECK (reaction_type IN ('emoji', 'text')),
    reaction_value text NOT NULL, -- '👍', '❤️', '😂', etc.
    
    -- Métadonnées
    created_at timestamptz DEFAULT now(),
    
    -- Contraintes
    UNIQUE(message_id, user_id, reaction_value)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_created_at ON public.message_reactions(created_at DESC);

-- 1.3 Table des mentions dans les messages
CREATE TABLE IF NOT EXISTS public.message_mentions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
    mentioned_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    mention_position integer, -- Position dans le message
    
    -- Statut
    is_read boolean DEFAULT false,
    read_at timestamptz,
    
    -- Audit
    created_at timestamptz DEFAULT now(),
    
    -- Contraintes
    UNIQUE(message_id, mentioned_user_id),
    CHECK (mention_position >= 0)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_message_mentions_message_id ON public.message_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_mentioned_user_id ON public.message_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_is_read ON public.message_mentions(is_read);

-- 1.4 Table des messages supprimés (soft delete)
CREATE TABLE IF NOT EXISTS public.deleted_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    original_message_id uuid NOT NULL,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Métadonnées du message original
    original_content text,
    original_sender_id uuid,
    original_created_at timestamptz,
    
    -- Raison de la suppression
    deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    deletion_reason text CHECK (deletion_reason IN ('user_request', 'admin_action', 'violation', 'system')),
    
    -- Audit
    deleted_at timestamptz DEFAULT now(),
    
    -- Contraintes
    CHECK (deletion_reason IS NOT NULL)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_deleted_messages_original_message_id ON public.deleted_messages(original_message_id);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_conversation_id ON public.deleted_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_deleted_messages_user_id ON public.deleted_messages(user_id);

-- ===========================================================================
-- 2. AMÉLIORATION DU SYSTÈME DE NOTIFICATIONS
-- ===========================================================================

-- 2.1 Amélioration de la table notifications existante
ALTER TABLE IF EXISTS public.notifications 
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('messaging', 'social', 'system', 'security', 'activity', 'reminder')),
ADD COLUMN IF NOT EXISTS action_url text,
ADD COLUMN IF NOT EXISTS action_label text,
ADD COLUMN IF NOT EXISTS expires_at timestamptz,
ADD COLUMN IF NOT EXISTS source_id uuid, -- ID de la source (message_id, activity_id, etc.)
ADD COLUMN IF NOT EXISTS source_type text, -- Type de source ('message', 'like', 'comment', 'friend_request')
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Index pour les nouvelles colonnes
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON public.notifications(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read) WHERE read = false;

-- 2.2 Table des préférences de notifications
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Préférences par catégorie
    preferences jsonb DEFAULT '{
        \"messaging\": {\"email\": true, \"push\": true, \"in_app\": true},
        \"social\": {\"email\": false, \"push\": true, \"in_app\": true},
        \"system\": {\"email\": true, \"push\": false, \"in_app\": true},
        \"security\": {\"email\": true, \"push\": true, \"in_app\": true},
        \"activity\": {\"email\": false, \"push\": true, \"in_app\": true},
        \"reminder\": {\"email\": true, \"push\": true, \"in_app\": true}
    }'::jsonb,
    
    -- Paramètres globaux
    quiet_hours_start time DEFAULT '22:00',
    quiet_hours_end time DEFAULT '08:00',
    max_notifications_per_day integer DEFAULT 50,
    allow_sound boolean DEFAULT true,
    allow_vibration boolean DEFAULT true,
    
    -- Statistiques
    notifications_received_today integer DEFAULT 0,
    last_reset_date date DEFAULT CURRENT_DATE,
    
    -- Audit
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Contraintes
    CHECK (quiet_hours_start < quiet_hours_end),
    CHECK (max_notifications_per_day BETWEEN 0 AND 1000),
    CHECK (notifications_received_today >= 0)
);

-- 2.3 Table des notifications push (pour mobile)
CREATE TABLE IF NOT EXISTS public.push_notification_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Token du dispositif
    device_token text NOT NULL,
    device_type text NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
    device_name text,
    
    -- Métadonnées du dispositif
    app_version text,
    os_version text,
    
    -- Statut
    is_active boolean DEFAULT true,
    last_used_at timestamptz DEFAULT now(),
    
    -- Sécurité
    token_hash text, -- Hash du token pour sécurité
    
    -- Audit
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Contraintes
    UNIQUE(device_token),
    CHECK (device_token IS NOT NULL AND length(device_token) > 0)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_push_notification_tokens_user_id ON public.push_notification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_tokens_device_type ON public.push_notification_tokens(device_type);
CREATE INDEX IF NOT EXISTS idx_push_notification_tokens_is_active ON public.push_notification_tokens(is_active);

-- ===========================================================================
-- 3. ROW LEVEL SECURITY (RLS) - NOUVELLES TABLES
-- ===========================================================================

-- Activer RLS sur toutes les nouvelles tables
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Supprimer les politiques existantes (pour récréation propre)
DROP POLICY IF EXISTS "users_manage_own_conversation_members" ON public.conversation_members;
DROP POLICY IF EXISTS "users_manage_own_message_reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "users_manage_own_message_mentions" ON public.message_mentions;
DROP POLICY IF EXISTS "admins_manage_deleted_messages" ON public.deleted_messages;
DROP POLICY IF EXISTS "users_manage_own_notification_preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "users_manage_own_push_tokens" ON public.push_notification_tokens;

-- 3.1 Politiques pour conversation_members
CREATE POLICY "users_read_own_conversation_members" ON public.conversation_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "users_manage_own_conversation_members" ON public.conversation_members
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 3.2 Politiques pour message_reactions
CREATE POLICY "users_read_message_reactions" ON public.message_reactions
    FOR SELECT TO authenticated
    USING (true); -- Tout le monde peut voir les réactions

CREATE POLICY "users_manage_own_message_reactions" ON public.message_reactions
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 3.3 Politiques pour message_mentions
CREATE POLICY "users_read_own_mentions" ON public.message_mentions
    FOR SELECT TO authenticated
    USING (mentioned_user_id = auth.uid());

CREATE POLICY "system_insert_message_mentions" ON public.message_mentions
    FOR INSERT TO authenticated
    WITH CHECK (true); -- Le système peut insérer des mentions

CREATE POLICY "users_update_own_mentions" ON public.message_mentions
    FOR UPDATE TO authenticated
    USING (mentioned_user_id = auth.uid())
    WITH CHECK (mentioned_user_id = auth.uid());

-- 3.4 Politiques pour deleted_messages (admin seulement)
CREATE POLICY "admins_read_deleted_messages" ON public.deleted_messages
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    ));

CREATE POLICY "system_insert_deleted_messages" ON public.deleted_messages
    FOR INSERT TO authenticated
    WITH CHECK (true); -- Le système peut insérer

-- 3.5 Politiques pour notification_preferences
CREATE POLICY "users_manage_own_notification_preferences" ON public.notification_preferences
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 3.6 Politiques pour push_notification_tokens
CREATE POLICY "users_manage_own_push_tokens" ON public.push_notification_tokens
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ===========================================================================
-- 4. FONCTIONS ET TRIGGERS
-- ===========================================================================

-- 4.1 Fonction pour incrémenter le compteur de messages non lus
CREATE OR REPLACE FUNCTION public.increment_unread_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
BEGIN
    -- Incrémente le compteur de messages non lus pour tous les membres
    -- sauf l'expéditeur
    UPDATE public.conversation_members cm
    SET unread_count = unread_count + 1,
        updated_at = now()
    WHERE cm.conversation_id = NEW.conversation_id
      AND cm.user_id != NEW.sender_id
      AND cm.left_at IS NULL
      AND cm.is_muted = false;
    
    RETURN NEW;
END;
\$\$;

-- Trigger pour incrémenter les messages non lus
DROP TRIGGER IF EXISTS trigger_increment_unread_count ON public.messages;
CREATE TRIGGER trigger_increment_unread_count
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_unread_count();

-- 4.2 Fonction pour réinitialiser les compteurs de messages non lus
CREATE OR REPLACE FUNCTION public.reset_unread_count(
    p_conversation_id uuid,
    p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
BEGIN
    UPDATE public.conversation_members
    SET unread_count = 0,
        last_read_at = now(),
        updated_at = now()
    WHERE conversation_id = p_conversation_id
      AND user_id = p_user_id
      AND left_at IS NULL;
END;
\$\$;

-- 4.3 Fonction pour créer des notifications pour les mentions
CREATE OR REPLACE FUNCTION public.create_mention_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
BEGIN
    -- Crée une notification pour l'utilisateur mentionné
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        category,
        priority,
        source_id,
        source_type,
        action_url,
        metadata
    )
    SELECT 
        NEW.mentioned_user_id,
        'mention',
        'Vous avez été mentionné',
        COALESCE(
            (SELECT 'Dans la conversation: ' || c.name 
             FROM public.conversations c 
             JOIN public.messages m ON m.conversation_id = c.id 
             WHERE m.id = NEW.message_id),
            'Dans une conversation'
        ),
        'messaging',
        'high',
        NEW.message_id,
        'message',
        '/messaging', -- URL vers la messagerie
        jsonb_build_object(
            'mention_id', NEW.id,
            'conversation_id', (SELECT conversation_id FROM public.messages WHERE id = NEW.message_id)
        )
    WHERE EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = NEW.mentioned_user_id
    );
    
    RETURN NEW;
END;
\$\$;

-- Trigger pour créer des notifications de mentions
DROP TRIGGER IF EXISTS trigger_create_mention_notification ON public.message_mentions;
CREATE TRIGGER trigger_create_mention_notification
    AFTER INSERT ON public.message_mentions
    FOR EACH ROW
    EXECUTE FUNCTION public.create_mention_notification();

-- 4.4 Fonction pour gérer les heures silencieuses
CREATE OR REPLACE FUNCTION public.check_quiet_hours(
    p_user_id uuid,
    p_category text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
DECLARE
    v_prefs jsonb;
    v_quiet_start time;
    v_quiet_end time;
    v_current_time time;
BEGIN
    -- Récupérer les préférences de l'utilisateur
    SELECT preferences, quiet_hours_start, quiet_hours_end
    INTO v_prefs, v_quiet_start, v_quiet_end
    FROM public.notification_preferences
    WHERE user_id = p_user_id;
    
    -- Si pas de préférences, autoriser
    IF v_prefs IS NULL THEN
        RETURN true;
    END IF;
    
    -- Vérifier les heures silencieuses
    v_current_time := CURRENT_TIME;
    
    IF v_quiet_start < v_quiet_end THEN
        -- Heures silencieuses dans la même journée
        IF v_current_time >= v_quiet_start AND v_current_time < v_quiet_end THEN
            RETURN false;
        END IF;
    ELSE
        -- Heures silencieuses qui traversent minuit
        IF v_current_time >= v_quiet_start OR v_current_time < v_quiet_end THEN
            RETURN false;
        END IF;
    END IF;
    
    -- Vérifier la limite quotidienne
    IF EXISTS (
        SELECT 1 FROM public.notification_preferences np
        WHERE np.user_id = p_user_id
          AND np.notifications_received_today >= np.max_notifications_per_day
          AND np.last_reset_date = CURRENT_DATE
    ) THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
\$\$;

-- 4.5 Trigger pour mettre à jour le compteur quotidien
CREATE OR REPLACE FUNCTION public.update_daily_notification_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
BEGIN
    -- Réinitialiser le compteur si c'est un nouveau jour
    UPDATE public.notification_preferences
    SET notifications_received_today = 0,
        last_reset_date = CURRENT_DATE,
        updated_at = now()
    WHERE user_id = NEW.user_id
      AND (last_reset_date IS NULL OR last_reset_date < CURRENT_DATE);
    
    -- Incrémenter le compteur
    UPDATE public.notification_preferences
    SET notifications_received_today = notifications_received_today + 1,
        updated_at = now()
    WHERE user_id = NEW.user_id
      AND last_reset_date = CURRENT_DATE;
    
    RETURN NEW;
END;
\$\$;

-- Trigger pour le compteur quotidien
DROP TRIGGER IF EXISTS trigger_update_daily_notification_count ON public.notifications;
CREATE TRIGGER trigger_update_daily_notification_count
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_daily_notification_count();

-- 4.6 Fonction pour envoyer une notification
CREATE OR REPLACE FUNCTION public.send_notification(
    p_user_id uuid,
    p_type text,
    p_title text,
    p_message text DEFAULT NULL,
    p_category text DEFAULT 'system',
    p_priority text DEFAULT 'normal',
    p_action_url text DEFAULT NULL,
    p_action_label text DEFAULT NULL,
    p_source_id uuid DEFAULT NULL,
    p_source_type text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
DECLARE
    v_notification_id uuid;
    v_can_send boolean;
BEGIN
    -- Vérifier les heures silencieuses et limites
    v_can_send := public.check_quiet_hours(p_user_id, p_category);
    
    IF NOT v_can_send THEN
        -- Enregistrer comme notification silencieuse
        INSERT INTO public.notifications (
            user_id, type, title, message, category, priority,
            action_url, action_label, source_id, source_type, metadata,
            read, expires_at
        ) VALUES (
            p_user_id, p_type, p_title, p_message, p_category, p_priority,
            p_action_url, p_action_label, p_source_id, p_source_type, p_metadata,
            true, now() + interval '7 days' -- Marquer comme lu et expirer plus tôt
        ) RETURNING id INTO v_notification_id;
        
        RETURN v_notification_id;
    END IF;
    
    -- Créer la notification normale
    INSERT INTO public.notifications (
        user_id, type, title, message, category, priority,
        action_url, action_label, source_id, source_type, metadata,
        expires_at
    ) VALUES (
        p_user_id, p_type, p_title, p_message, p_category, p_priority,
        p_action_url, p_action_label, p_source_id, p_source_type, p_metadata,
        CASE 
            WHEN p_priority = 'urgent' THEN now() + interval '24 hours'
            WHEN p_priority = 'high' THEN now() + interval '3 days'
            ELSE now() + interval '7 days'
        END
    ) RETURNING id INTO v_notification_id;
    
    -- TODO: Ajouter ici l'envoi de notifications push si nécessaire
    
    RETURN v_notification_id;
END;
\$\$;

-- ===========================================================================
-- 5. VUES UTILES
-- ===========================================================================

-- 5.1 Vue pour les conversations avec statistiques
CREATE OR REPLACE VIEW public.conversation_stats AS
SELECT 
    c.id as conversation_id,
    c.name as conversation_name,
    c.type as conversation_type,
    c.created_at,
    COUNT(DISTINCT cm.user_id) as active_members_count,
    COUNT(m.id) as total_messages_count,
    MAX(m.created_at) as last_message_at,
    COUNT(CASE WHEN m.type = 'gps' THEN 1 END) as gps_messages_count,
    AVG(CASE WHEN cm.unread_count > 0 THEN cm.unread_count END) as avg_unread_count
FROM public.conversations c
LEFT JOIN public.conversation_members cm ON c.id = cm.conversation_id AND cm.left_at IS NULL
LEFT JOIN public.messages m ON c.id = m.conversation_id
GROUP BY c.id, c.name, c.type, c.created_at;

-- 5.2 Vue pour les notifications non lues avec priorité
CREATE OR REPLACE VIEW public.unread_notifications_priority AS
SELECT 
    n.*,
    CASE 
        WHEN n.priority = 'urgent' THEN 1
        WHEN n.priority = 'high' THEN 2
        WHEN n.priority = 'normal' THEN 3
        WHEN n.priority = 'low' THEN 4
        ELSE 5
    END as priority_order
FROM public.notifications n
WHERE n.read = false
  AND (n.expires_at IS NULL OR n.expires_at > now())
ORDER BY priority_order, n.created_at DESC;

-- ===========================================================================
-- 6. DONNÉES DE RÉFÉRENCE
-- ===========================================================================

-- 6.1 Types de réactions prédéfinis
CREATE TABLE IF NOT EXISTS public.predefined_reactions (
    id SERIAL PRIMARY KEY,
    reaction_value text NOT NULL UNIQUE,
    reaction_label text NOT NULL,
    emoji_unicode text,
    category text DEFAULT 'general',
    is_active boolean DEFAULT true
);

-- Insérer des réactions prédéfinies
INSERT INTO public.predefined_reactions (reaction_value, reaction_label, emoji_unicode, category) VALUES
('thumbs_up', 'Pouce vers le haut', '👍', 'general'),
('heart', 'Cœur', '❤️', 'general'),
('laughing', 'Rire', '😂', 'general'),
('check_mark', 'Coche', '✅', 'action'),
('question', 'Point d''interrogation', '❓', 'question'),
('exclamation', 'Point d''exclamation', '❗', 'alert'),
('star', 'Étoile', '⭐', 'general'),
('fire', 'Feu', '🔥', 'general'),
('party', 'Fête', '🎉', 'celebration'),
('sos', 'SOS', '🆘', 'safety')
ON CONFLICT (reaction_value) DO NOTHING;

-- ===========================================================================
-- 7. TRIGGERS DE MAINTENANCE
-- ===========================================================================

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

-- Appliquer les triggers updated_at
DROP TRIGGER IF EXISTS update_conversation_members_updated_at ON public.conversation_members;
CREATE TRIGGER update_conversation_members_updated_at
    BEFORE UPDATE ON public.conversation_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_push_notification_tokens_updated_at ON public.push_notification_tokens;
CREATE TRIGGER update_push_notification_tokens_updated_at
    BEFORE UPDATE ON public.push_notification_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================================================
-- 8. COMMENTAIRES POUR LA DOCUMENTATION
-- ===========================================================================

COMMENT ON TABLE public.conversation_members IS 'Participants aux conversations de messagerie';
COMMENT ON TABLE public.message_reactions IS 'Réactions aux messages (émoticônes)';
COMMENT ON TABLE public.message_mentions IS 'Mentions d''utilisateurs dans les messages';
COMMENT ON TABLE public.deleted_messages IS 'Messages supprimés (archivage)';
COMMENT ON TABLE public.notification_preferences IS 'Préférences de notifications des utilisateurs';
COMMENT ON TABLE public.push_notification_tokens IS 'Tokens pour notifications push mobiles';
COMMENT ON TABLE public.predefined_reactions IS 'Réactions prédéfinies pour les messages';

COMMIT;

-- ===========================================================================
-- LOT 8: Messagerie & Notifications - COMPLÉTÉ
-- ===========================================================================
