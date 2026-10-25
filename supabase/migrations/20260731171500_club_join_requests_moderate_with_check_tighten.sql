-- Chantier 15b (2e passe) — colmater self-approval club_join_requests
-- Projet icxyvwzfjbflcbqukpfz — appliqué 2026-07-31
--
-- Découvert par probes RLS adversariales (P10) : le WITH CHECK de
-- `club_join_requests_moderate` contenait une branche `user_id = auth.uid()`
-- OR admin/modérateur. RLS évalue USING et WITH CHECK de façon INDÉPENDANTE
-- entre policies (OR sur chaque clause) : l'utilisateur passait le USING via
-- `club_join_requests_self_update` puis le WITH CHECK via la branche self de
-- `moderate` -> self-approval `status='approved'` possible.
--
-- Correctif : WITH CHECK strictement admin/modérateur du club. La branche
-- self est redondante depuis `club_join_requests_self_update`, qui autorise la
-- re-soumission en 'pending' uniquement (upsert ON CONFLICT DO UPDATE).

DROP POLICY IF EXISTS club_join_requests_moderate ON public.club_join_requests;

CREATE POLICY club_join_requests_moderate ON public.club_join_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_join_requests.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_join_requests.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'moderator')
    )
  );
