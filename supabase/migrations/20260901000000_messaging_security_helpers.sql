BEGIN;

-- 1. Helpers membres (signatures uuid, uuid) - SECURITY DEFINER pour eviter recursion RLS
CREATE OR REPLACE FUNCTION public.is_conversation_member(
  target_conversation_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = target_conversation_id
      AND cm.user_id = target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conv_owner(
  target_conversation_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = target_conversation_id
      AND cm.user_id = target_user_id
      AND cm.role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conv_admin(
  target_conversation_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = target_conversation_id
      AND cm.user_id = target_user_id
      AND cm.role IN ('admin','owner')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conv_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conv_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conv_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conv_admin(uuid, uuid) TO authenticated;

-- 2. Table user_blocks (blocage utilisateur)
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_blocks_select_own" ON public.user_blocks
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

CREATE POLICY "user_blocks_insert_own" ON public.user_blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "user_blocks_delete_own" ON public.user_blocks
  FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

COMMIT;
