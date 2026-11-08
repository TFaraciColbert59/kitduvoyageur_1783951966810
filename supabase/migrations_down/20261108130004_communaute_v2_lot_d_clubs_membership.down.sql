-- Rollback du lot D Communauté v2 (20261108130004) :
-- RPC d'adhésion aux clubs + colonnes de club.
-- Règle 06 § 3.5 : refus si une colonne supprimée contient des données.
--
-- Note `clubs.rules` : la colonne a été créée par ce chantier (vérifié absent
-- en production et dans la baseline du 11 sept. avant application). Le .down ne
-- la retire donc que si elle est vide. Si un autre chantier l'a créée entre
-- temps, adapter ce fichier avant de l'exécuter (ne jamais supprimer une
-- colonne préexistante).

-- ── RPC ────────────────────────────────────────────────────────────────────
drop function if exists public.review_join_request(uuid, boolean);
drop function if exists public.cancel_join_request(uuid);
drop function if exists public.leave_club(uuid);
drop function if exists public.join_club(uuid, jsonb);

drop index if exists public.idx_club_join_requests_club_status;

-- ── Contrôles de données ───────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.clubs where rules is not null and btrim(rules) <> '') then
    raise exception 'Rollback lot D refusé : clubs.rules contient des données.';
  end if;
  if exists (select 1 from public.clubs where join_questions is distinct from '[]'::jsonb) then
    raise exception 'Rollback lot D refusé : clubs.join_questions contient des données.';
  end if;
  if exists (select 1 from public.clubs where cardinality(coalesce(activities, '{}'::text[])) > 0) then
    raise exception 'Rollback lot D refusé : clubs.activities contient des données.';
  end if;
  if exists (select 1 from public.clubs where location_label is not null) then
    raise exception 'Rollback lot D refusé : clubs.location_label contient des données.';
  end if;
  if exists (select 1 from public.club_join_requests where answers is distinct from '[]'::jsonb) then
    raise exception 'Rollback lot D refusé : club_join_requests.answers contient des données.';
  end if;
end
$$;

-- ── Colonnes ───────────────────────────────────────────────────────────────
alter table public.club_join_requests drop column if exists answers;

alter table public.clubs
  drop column if exists location_label,
  drop column if exists activities,
  drop column if exists join_questions,
  drop column if exists rules;

-- ── Helpers internes (posés ici, réutilisés par le lot E) ──────────────────
drop function if exists public.lkdv_recount_club_members(uuid);
drop function if exists public.lkdv_require_actor();
drop function if exists public.lkdv_raise(text, text, text);
