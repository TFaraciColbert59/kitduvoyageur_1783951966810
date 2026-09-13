-- ============================================================
-- TRIBU — M10 : journal d'activite du groupe
-- ============================================================
-- Peuple UNIQUEMENT par triggers AFTER I/U/D sur les 6 tables
-- collaboratives : aucune mutation ne peut passer entre les mailles,
-- meme via service_role. Lecture reservee aux membres (RLS), aucune
-- policy d'ecriture (les triggers sont SECURITY DEFINER).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.travel_groups(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('created', 'updated', 'deleted')),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_activity_log_group_created
  ON public.group_activity_log(group_id, created_at DESC);

ALTER TABLE public.group_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_log_read_member" ON public.group_activity_log;
CREATE POLICY "activity_log_read_member" ON public.group_activity_log
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

GRANT SELECT ON public.group_activity_log TO authenticated, service_role;

-- ── Trigger generique ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_group_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_data JSONB;
  v_group_id UUID;
  v_entity_id UUID;
  v_actor UUID := auth.uid();
  v_actor_name TEXT;
  v_verb TEXT;
  v_label TEXT;
  v_title TEXT;
  v_target_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_data := to_jsonb(OLD);
  ELSE
    v_data := to_jsonb(NEW);
  END IF;

  v_group_id := (v_data ->> 'group_id')::uuid;
  v_entity_id := (v_data ->> 'id')::uuid;

  IF v_group_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Suppression en cascade du groupe : le parent n'existe plus, ne pas
  -- tenter de journaliser (la ligne de journal serait orpheline).
  IF NOT EXISTS (SELECT 1 FROM public.travel_groups g WHERE g.id = v_group_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT full_name INTO v_actor_name FROM public.user_profiles WHERE id = v_actor;

  v_verb := CASE TG_OP
    WHEN 'INSERT' THEN 'a créé'
    WHEN 'UPDATE' THEN 'a modifié'
    ELSE 'a supprimé'
  END;

  IF TG_TABLE_NAME = 'group_expenses' THEN
    v_label := 'la dépense';
    v_title := COALESCE(v_data ->> 'title', '');
  ELSIF TG_TABLE_NAME = 'group_tasks' THEN
    v_label := 'la tâche';
    v_title := COALESCE(v_data ->> 'title', '');
  ELSIF TG_TABLE_NAME = 'group_kit_items' THEN
    v_label := 'le matériel';
    v_title := COALESCE(v_data ->> 'name', '');
  ELSIF TG_TABLE_NAME = 'group_polls' THEN
    v_label := 'le sondage';
    v_title := COALESCE(v_data ->> 'question', '');
  ELSIF TG_TABLE_NAME = 'group_album' THEN
    v_label := 'une photo';
    v_title := '';
  ELSE
    v_label := 'un membre';
    SELECT full_name INTO v_target_name
    FROM public.user_profiles
    WHERE id = (v_data ->> 'user_id')::uuid;
    v_title := COALESCE(v_target_name, '');
  END IF;

  INSERT INTO public.group_activity_log
    (group_id, actor_id, action_type, entity_type, entity_id, summary)
  VALUES (
    v_group_id,
    v_actor,
    CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END,
    TG_TABLE_NAME,
    v_entity_id,
    CASE
      WHEN v_title <> '' THEN
        format('%s %s %s « %s »', COALESCE(v_actor_name, 'Quelqu''un'), v_verb, v_label, v_title)
      ELSE
        format('%s %s %s', COALESCE(v_actor_name, 'Quelqu''un'), v_verb, v_label)
    END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS log_group_expenses_activity_trg ON public.group_expenses;
CREATE TRIGGER log_group_expenses_activity_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.group_expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_group_activity();

DROP TRIGGER IF EXISTS log_group_tasks_activity_trg ON public.group_tasks;
CREATE TRIGGER log_group_tasks_activity_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.group_tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_group_activity();

DROP TRIGGER IF EXISTS log_group_kit_items_activity_trg ON public.group_kit_items;
CREATE TRIGGER log_group_kit_items_activity_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.group_kit_items
  FOR EACH ROW EXECUTE FUNCTION public.log_group_activity();

DROP TRIGGER IF EXISTS log_group_polls_activity_trg ON public.group_polls;
CREATE TRIGGER log_group_polls_activity_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.group_polls
  FOR EACH ROW EXECUTE FUNCTION public.log_group_activity();

DROP TRIGGER IF EXISTS log_group_album_activity_trg ON public.group_album;
CREATE TRIGGER log_group_album_activity_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.group_album
  FOR EACH ROW EXECUTE FUNCTION public.log_group_activity();

DROP TRIGGER IF EXISTS log_group_members_activity_trg ON public.group_members;
CREATE TRIGGER log_group_members_activity_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.log_group_activity();
