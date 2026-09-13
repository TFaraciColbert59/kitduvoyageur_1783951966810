-- ============================================================
-- TRIBU — M11 : modeles de checklist par club
-- ============================================================
-- Un modele appartient a un club (source='club'), est officiel
-- (source='official', service_role) ou communautaire. Lecture : membres
-- du club (ou tous pour l'officiel). Application : insertion en masse
-- dans `group_tasks` (capacite contribute cote RLS des taches).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'community',
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_task_templates_source_check CHECK (source IN ('official', 'club', 'community'))
);

CREATE TABLE IF NOT EXISTS public.group_task_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.group_task_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  default_role public.group_member_role,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_group_task_templates_club
  ON public.group_task_templates(club_id);
CREATE INDEX IF NOT EXISTS idx_group_task_template_items_template
  ON public.group_task_template_items(template_id, position);

ALTER TABLE public.group_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_task_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_templates_read" ON public.group_task_templates;
CREATE POLICY "task_templates_read" ON public.group_task_templates
  FOR SELECT TO authenticated
  USING (
    (club_id IS NULL AND source = 'official')
    OR (club_id IS NOT NULL AND public.is_club_member(club_id, auth.uid()))
  );

DROP POLICY IF EXISTS "task_templates_insert_club_member" ON public.group_task_templates;
CREATE POLICY "task_templates_insert_club_member" ON public.group_task_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'club'
    AND club_id IS NOT NULL
    AND created_by = auth.uid()
    AND public.is_club_member(club_id, auth.uid())
  );

DROP POLICY IF EXISTS "task_templates_delete_author_or_admin" ON public.group_task_templates;
CREATE POLICY "task_templates_delete_author_or_admin" ON public.group_task_templates
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR (
      club_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = group_task_templates.club_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'active'
          AND cm.role IN ('admin', 'moderator')
      )
    )
  );

DROP POLICY IF EXISTS "task_template_items_read" ON public.group_task_template_items;
CREATE POLICY "task_template_items_read" ON public.group_task_template_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_task_templates t
      WHERE t.id = template_id
    )
  );

DROP POLICY IF EXISTS "task_template_items_write_author" ON public.group_task_template_items;
DROP POLICY IF EXISTS "task_template_items_insert_author" ON public.group_task_template_items;
CREATE POLICY "task_template_items_insert_author" ON public.group_task_template_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_task_templates t
      WHERE t.id = template_id
        AND t.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_template_items_update_author" ON public.group_task_template_items;
CREATE POLICY "task_template_items_update_author" ON public.group_task_template_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_task_templates t
      WHERE t.id = template_id
        AND t.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_task_templates t
      WHERE t.id = template_id
        AND t.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_template_items_delete_author_or_admin" ON public.group_task_template_items;
CREATE POLICY "task_template_items_delete_author_or_admin" ON public.group_task_template_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_task_templates t
      WHERE t.id = template_id
        AND (
          t.created_by = auth.uid()
          OR (t.club_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = t.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
              AND cm.role IN ('admin', 'moderator')
          ))
        )
    )
  );

GRANT SELECT, INSERT, DELETE ON public.group_task_templates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_task_template_items TO authenticated, service_role;
