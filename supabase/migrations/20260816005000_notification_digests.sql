-- ============================================================
-- KIT DU VOYAGEUR — Agrégation de Digests & Préventions Spam
-- Migration: 20260816005000_notification_digests.sql
-- ============================================================

-- Update notify() to override email_enabled to false for minor social events
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

  -- 2. Prevent unit-level email spams for low-priority notifications
  -- (They will be summarized and sent in bulk via the daily digest instead)
  IF p_type IN ('post_liked', 'carnet_liked', 'new_follower', 'points_earned') THEN
    v_email := false;
  END IF;

  -- 3. SOS Alert Bypass (Always send everywhere)
  IF p_type = 'sos_alert' THEN
    v_in_app := true;
    v_email := true;
    v_push := true;
  END IF;

  -- 4. Group messages clustering (Check unread within 15 minutes)
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

  -- 5. Build channels JSON array
  v_channels := '[]'::jsonb;
  IF v_in_app THEN v_channels := v_channels || '"in_app"'::jsonb; END IF;
  IF v_email THEN v_channels := v_channels || '"email"'::jsonb; END IF;
  IF v_push THEN v_channels := v_channels || '"push"'::jsonb; END IF;

  -- 6. Insert notification
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

  -- 7. Enqueue delivery jobs if enabled
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


-- ─── 2. DIGEST AGGREGATION PROCEDURE ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_digests()
RETURNS INT AS $$
DECLARE
  v_user RECORD;
  v_count INT;
  v_msg TEXT;
  v_notif_ids UUID[];
  v_digest_count INT := 0;
BEGIN
  -- Find users who have notifications that should be summarized
  FOR v_user IN 
    SELECT DISTINCT user_id 
    FROM public.notifications 
    WHERE read = false 
      AND type IN ('post_liked', 'carnet_liked', 'new_follower', 'points_earned')
      -- Has not been sent via email yet
      AND NOT (channels_sent @> '["email"]'::jsonb)
  LOOP
    -- Count unread interactions
    SELECT COUNT(*), array_agg(id)
    INTO v_count, v_notif_ids
    FROM public.notifications
    WHERE user_id = v_user.user_id
      AND read = false
      AND type IN ('post_liked', 'carnet_liked', 'new_follower', 'points_earned')
      AND NOT (channels_sent @> '["email"]'::jsonb);

    IF v_count > 0 THEN
      v_msg := v_count || ' nouvelles interactions et activités sur vos carnets et publications.';
      
      -- Create a single digest notification (notifying the user by email)
      PERFORM public.notify(
        v_user.user_id,
        'digest',
        'Résumé de votre activité LKDV',
        v_msg,
        NULL,
        'digest',
        NULL,
        '/alertes'
      );

      -- Mark original notifications as email-sent
      UPDATE public.notifications
      SET channels_sent = COALESCE(channels_sent, '[]'::jsonb) || '"email"'::jsonb
      WHERE id = ANY(v_notif_ids);

      v_digest_count := v_digest_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_digest_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
