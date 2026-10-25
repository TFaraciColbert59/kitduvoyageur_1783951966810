-- Lecture publique rétablie pour les visiteurs sans compte (13 oct.).
--
-- `20261013180000_anon_grant_hygiene` (A-214) a retiré à `anon` le droit d'exécuter
-- des prédicats « internes » en supposant qu'ils ne servaient qu'à des policies
-- `TO authenticated`. Or les policies de lecture des voyages (trips, trip_steps,
-- trip_items, trip_pois, trip_notes, trip_expenses, trip_collaborators,
-- trip_checklist_items, trip_safety_checkpoints, trip_member_profiles,
-- trip_invitations) et des groupes (`groups_public_read`) sont `TO public` et
-- appellent ces fonctions. PostgreSQL vérifie le droit EXECUTE de toute fonction
-- d'une expression avant de l'évaluer : la requête entière échouait
-- (« permission denied for function can_read_trip »), même pour un voyage public.
-- Constaté en production le 13 oct. (`set role anon; select … from trips` en erreur)
-- et par les tests pgTAP `compas_*_rls` (anonyme lit un voyage public).
--
-- Rétablit exactement l'état d'avant A-214 pour ces trois prédicats, rien de plus :
-- chacun renvoie un booléen et lit `auth.uid()` (nul pour un visiteur : faux).
-- `is_admin()` reste fermé à anon (depuis `20260926010000`) : les seules policies
-- `TO public` qui l'appellent portent sur des données personnelles (notifications,
-- préférences, abonnements push) qu'un visiteur ne lit jamais.
grant execute on function public.can_read_trip(uuid) to anon;
grant execute on function public.can_edit_trip(uuid) to anon;
grant execute on function public.is_group_member(uuid, uuid) to anon;
