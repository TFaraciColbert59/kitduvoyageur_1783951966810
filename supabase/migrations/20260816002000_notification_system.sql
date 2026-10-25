-- ============================================================
-- KIT DU VOYAGEUR — Système de Notifications
-- Migration: 20260816002000_notification_system.sql
-- ============================================================

-- ─── 1. EXTEND NOTIFICATIONS TABLE ───────────────────────────────────────────
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS channels_sent JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Ensure notifications RLS is active
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ─── 2. CREATE PREFERENCES TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id, notification_type)
);

-- Enable RLS on preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- ─── 3. CREATE DELIVERIES TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'email', 'push'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  provider_response JSONB,
  attempted_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on deliveries
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- ─── 4. SECURITY & RLS POLICIES ──────────────────────────────────────────────

-- Remove existing permissive INSERT policies on public.notifications
DROP POLICY IF EXISTS "Système peut insérer des notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_manage_own_notifications" ON public.notifications;

-- Create secure policies for public.notifications
-- CREATE POLICY "Users can read own notifications" ON public.notifications
--   FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- CREATE POLICY "Users can update own notifications" ON public.notifications
--   FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- CREATE POLICY "Users can delete own notifications" ON public.notifications
--   FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- Create policies for public.notification_preferences
-- CREATE POLICY "Users can read own preferences" ON public.notification_preferences
--   FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own preferences" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own preferences" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can delete own preferences" ON public.notification_preferences;
CREATE POLICY "Users can delete own preferences" ON public.notification_preferences
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- For public.notification_deliveries, only admins/service role can do anything.
-- We do not add any public policy, locking it out from normal user clients.

-- ─── 5. CENTRAL FUNCTION: NOTIFY ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT NULL,
  p_related_id UUID DEFAULT NULL,
  p_link TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_in_app BOOLEAN := true;
  v_email BOOLEAN := true;
  v_push BOOLEAN := true;
  v_existing_id UUID;
  v_notif_id UUID;
  v_channels JSONB;
BEGIN
  -- 1. Check Preferences (Default is true if not configured)
  SELECT in_app_enabled, email_enabled, push_enabled
  INTO v_in_app, v_email, v_push
  FROM public.notification_preferences
  WHERE user_id = p_user_id AND notification_type = p_type;

  IF NOT FOUND THEN
    v_in_app := true;
    v_email := true;
    v_push := true;
  END IF;

  -- 2. SOS Alert Bypass (Always send everywhere)
  IF p_type = 'sos_alert' THEN
    v_in_app := true;
    v_email := true;
    v_push := true;
  END IF;

  -- 3. Group messages clustering (Check unread within 15 minutes)
  IF p_type = 'group_message' THEN
    SELECT id INTO v_existing_id
    FROM public.notifications
    WHERE user_id = p_user_id
      AND type = 'group_message'
      AND related_id = p_related_id
      AND read = false
      AND created_at > (now() - INTERVAL '15 minutes')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Group messages together: update existing message and bump timestamp
      UPDATE public.notifications
      SET message = p_message,
          actor_id = p_actor_id,
          created_at = now(),
          updated_at = now()
      WHERE id = v_existing_id;

      -- Queue new email/push alerts if active
      IF v_email THEN
        INSERT INTO public.notification_deliveries (notification_id, channel, status)
        VALUES (v_existing_id, 'email', 'pending');
      END IF;

      IF v_push THEN
        INSERT INTO public.notification_deliveries (notification_id, channel, status)
        VALUES (v_existing_id, 'push', 'pending');
      END IF;

      RETURN v_existing_id;
    END IF;
  END IF;

  -- 4. Build channels JSON array
  v_channels := '[]'::jsonb;
  IF v_in_app THEN v_channels := v_channels || '"in_app"'::jsonb; END IF;
  IF v_email THEN v_channels := v_channels || '"email"'::jsonb; END IF;
  IF v_push THEN v_channels := v_channels || '"push"'::jsonb; END IF;

  -- 5. Insert notification
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    read,
    actor_id,
    related_type,
    related_id,
    link,
    channels_sent,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    false,
    p_actor_id,
    p_related_type,
    p_related_id,
    p_link,
    v_channels,
    now(),
    now()
  )
  RETURNING id INTO v_notif_id;

  -- 6. Enqueue delivery jobs if enabled
  IF v_email THEN
    INSERT INTO public.notification_deliveries (notification_id, channel, status)
    VALUES (v_notif_id, 'email', 'pending');
  END IF;

  IF v_push THEN
    INSERT INTO public.notification_deliveries (notification_id, channel, status)
    VALUES (v_notif_id, 'push', 'pending');
  END IF;

  RETURN v_notif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 6. AUTOMATIC TRIGGERS (SOCIAL EVENTS) ───────────────────────────────────

-- 6.1 Trigger on post_likes
CREATE OR REPLACE FUNCTION public.trg_on_community_post_like()
RETURNS TRIGGER AS $$
DECLARE
  v_author_id UUID;
  v_title TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get post info
  SELECT author_id, SUBSTRING(content FROM 1 FOR 30) INTO v_author_id, v_title
  FROM public.community_posts WHERE id = NEW.post_id;

  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.user_id;

  -- Do not notify self-likes
  IF v_author_id IS NOT NULL AND v_author_id <> NEW.user_id THEN
    PERFORM public.notify(
      v_author_id,
      'post_liked',
      'Nouveau like !',
      COALESCE(v_actor_name, 'Un membre') || ' a aimé votre publication "' || COALESCE(v_title, '') || '..."',
      NEW.user_id,
      'post',
      NEW.post_id,
      '/communaute'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_community_post_like_notify ON public.post_likes;
CREATE TRIGGER trg_community_post_like_notify
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_community_post_like();

-- 6.2 Trigger on post_comments
CREATE OR REPLACE FUNCTION public.trg_on_community_post_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_author_id UUID;
  v_title TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get post info
  SELECT author_id, SUBSTRING(content FROM 1 FOR 30) INTO v_author_id, v_title
  FROM public.community_posts WHERE id = NEW.post_id;

  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.author_id;

  -- Do not notify self-comments
  IF v_author_id IS NOT NULL AND v_author_id <> NEW.author_id THEN
    PERFORM public.notify(
      v_author_id,
      'post_commented',
      'Nouveau commentaire !',
      COALESCE(v_actor_name, 'Un membre') || ' a commenté votre publication "' || COALESCE(v_title, '') || '..."',
      NEW.author_id,
      'post',
      NEW.post_id,
      '/communaute'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_community_post_comment_notify ON public.post_comments;
CREATE TRIGGER trg_community_post_comment_notify
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_community_post_comment();

-- 6.3 Trigger on carnet_likes
CREATE OR REPLACE FUNCTION public.trg_on_carnet_like()
RETURNS TRIGGER AS $$
DECLARE
  v_author_id UUID;
  v_title TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get carnet info
  SELECT author_id, title INTO v_author_id, v_title
  FROM public.carnets WHERE id = NEW.carnet_id;

  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.user_id;

  -- Do not notify self-likes
  IF v_author_id IS NOT NULL AND v_author_id <> NEW.user_id THEN
    PERFORM public.notify(
      v_author_id,
      'carnet_liked',
      'Nouveau like !',
      COALESCE(v_actor_name, 'Un membre') || ' a aimé votre carnet de route "' || COALESCE(v_title, '') || '"',
      NEW.user_id,
      'carnet',
      NEW.carnet_id,
      '/carnets/' || NEW.carnet_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_carnet_like_notify ON public.carnet_likes;
CREATE TRIGGER trg_carnet_like_notify
  AFTER INSERT ON public.carnet_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_carnet_like();

-- 6.4 Trigger on carnet_comments
CREATE OR REPLACE FUNCTION public.trg_on_carnet_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_author_id UUID;
  v_title TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get carnet info
  SELECT author_id, title INTO v_author_id, v_title
  FROM public.carnets WHERE id = NEW.carnet_id;

  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.author_id;

  -- Do not notify self-comments
  IF v_author_id IS NOT NULL AND v_author_id <> NEW.author_id THEN
    PERFORM public.notify(
      v_author_id,
      'carnet_commented',
      'Nouveau commentaire !',
      COALESCE(v_actor_name, 'Un membre') || ' a commenté votre carnet de route "' || COALESCE(v_title, '') || '"',
      NEW.author_id,
      'carnet',
      NEW.carnet_id,
      '/carnets/' || NEW.carnet_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_carnet_comment_notify ON public.carnet_comments;
CREATE TRIGGER trg_carnet_comment_notify
  AFTER INSERT ON public.carnet_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_carnet_comment();

-- 6.5 Trigger on group_messages (using active travel_groups schema)
CREATE OR REPLACE FUNCTION public.trg_on_group_message()
RETURNS TRIGGER AS $$
DECLARE
  v_member RECORD;
  v_actor_name TEXT;
  v_group_name TEXT;
BEGIN
  -- Get actor name
  SELECT full_name INTO v_actor_name
  FROM public.user_profiles WHERE id = NEW.user_id;

  -- Get group name
  SELECT name INTO v_group_name
  FROM public.travel_groups WHERE id = NEW.group_id;

  -- Notify all members of the group except the message sender
  FOR v_member IN 
    SELECT user_id FROM public.group_members 
    WHERE group_id = NEW.group_id AND user_id <> NEW.user_id AND status::text = 'active'
  LOOP
    PERFORM public.notify(
      v_member.user_id,
      'group_message',
      v_group_name,
      COALESCE(v_actor_name, 'Un membre') || ' : ' || SUBSTRING(NEW.content FROM 1 FOR 40),
      NEW.user_id,
      'group',
      NEW.group_id,
      '/groupes/' || NEW.group_id
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_group_message_notify ON public.group_messages;
CREATE TRIGGER trg_group_message_notify
  AFTER INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_group_message();
