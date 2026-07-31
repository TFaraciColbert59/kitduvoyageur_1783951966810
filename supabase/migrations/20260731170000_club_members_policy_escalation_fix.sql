-- Chantier 15b — colmater l'escalade de privilèges club_members + club_join_requests
-- Projet icxyvwzfjbflcbqukpfz — appliqué 2026-07-31
--
-- Découvert par le verifier adversarial (probes RLS JWT) : la policy héritée
-- `club_members_manage` (FOR ALL ... WITH CHECK (user_id = auth.uid())) était
-- OR-combinée avec les nouvelles policies (RLS OR entre policies de même cmd),
-- donc n'importe quel utilisateur connecté pouvait :
--   1) s'insérer dans n'importe quel club avec role='admin' (INSERT)
--   2) se promouvoir admin en UPDATE sur sa propre ligne (UPDATE)
--   3) contourner totalement le flux de modération (club_join_requests)
-- Le correctif : remplacer la policy générique par des policies de commande
-- restreintes (role, statut, propriété du club, rôle admin/modérateur).

-- 1) club_members : DROP de la policy FOR ALL héritée
DROP POLICY IF EXISTS club_members_manage ON public.club_members;

-- 2) INSERT self-join : uniquement son propre profil, en 'member',
--    uniquement dans un club OUVRert (l'app route les clubs fermés vers
--    club_join_requests — politique, pas l'inverse).
CREATE POLICY club_members_self_join ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id
        AND c.privacy = 'open'
    )
  );

-- 3) INSERT créateur : le créateur du club s'insère en 'admin'
--    (flux "Créer un club" → auto-join admin). Gated sur clubs.created_by
--    pour qu'on ne puisse JAMAIS devenir admin d'un club qu'on n'a pas créé.
CREATE POLICY club_members_creator_admin ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id
        AND c.created_by = auth.uid()
    )
  );

-- 4) UPDATE modération : ban (status='banned') et changement de rôle
--    (clubs/page.tsx handleBanMember / handlePromoteMember) réservés aux
--    admin/modérateurs actifs du même club.
CREATE POLICY club_members_admin_moderate ON public.club_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_members.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin', 'moderator')
    )
  );

-- 5) DELETE : quitter un club (suppression de sa propre adhésion).
--    Les admins n'expulsent jamais par DELETE dans l'app (ils bannissent
--    via UPDATE status='banned').
CREATE POLICY club_members_self_delete ON public.club_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 6) club_join_requests : re-soumission d'une demande. L'app utilise
--    `upsert({status:'pending'}, {onConflict:'club_id,user_id'})` : quand la
--    ligne existe déjà (demande rejetée → nouveau tap "Rejoindre"), le
--    branch ON CONFLICT DO UPDATE est déclenché et exige une policy UPDATE.
--    L'utilisateur peut remettre SA demande à 'pending' mais JAMAIS la
--    passer en 'approved'/'rejected' (self-approval impossible).
DROP POLICY IF EXISTS club_join_requests_manage ON public.club_join_requests;
DROP POLICY IF EXISTS club_join_requests_read ON public.club_join_requests;

CREATE POLICY club_join_requests_self_update ON public.club_join_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
