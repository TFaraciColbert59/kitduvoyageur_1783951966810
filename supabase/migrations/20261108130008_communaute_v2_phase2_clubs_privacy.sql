-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Communauté v2 — PHASE 2 : contrainte de visibilité des clubs
-- À appliquer APRÈS revue (06 § 3), en même temps que 20261108130007.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- VÉRIFICATION PRÉALABLE (lecture seule, production `icxyvwzfjbflcbqukpfz`,
-- le 2026-11-08 avant rédaction) :
--
--   select privacy, count(*) from public.clubs group by 1;
--   → open = 23, secret = 15  (aucune autre valeur, aucun NULL)
--
--   select version from supabase_migrations.schema_migrations où le dernier
--   numéro est 20261108000000 : la contrainte `clubs_privacy_check` n'existe
--   pas en production (vérifié dans pg_constraint), donc open/closed/secret est
--   un domaine strictement plus large que les données réelles.
--
-- La migration re-vérifie elle-même l'absence de valeur hors domaine et
-- échoue bruyamment plutôt que de poser une contrainte qui invaliderait des
-- lignes existantes.
--
-- Effet : `clubs.privacy` devient un domaine explicite open/closed/secret.
-- Aucune policy n'est modifiée : `Public read clubs` exclut déjà les clubs
-- `secret` pour les non-membres (en place en prod avant ce chantier).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_bad text;
begin
  select string_agg(distinct privacy, ', ')
    into v_bad
    from public.clubs
   where privacy is not null
     and privacy not in ('open', 'closed', 'secret');

  if v_bad is not null then
    raise exception
      'clubs_privacy_check non posée : valeurs hors domaine détectées dans public.clubs.privacy (%)', v_bad
      using errcode = '23514';
  end if;
end
$$;

alter table public.clubs drop constraint if exists clubs_privacy_check;
alter table public.clubs
  add constraint clubs_privacy_check
  check (privacy in ('open', 'closed', 'secret'));

comment on constraint clubs_privacy_check on public.clubs is
  'Communauté v2 : domaine explicite de clubs.privacy — open (ouvert), closed (sur validation), secret (privé). Vérifié en prod le 2026-11-08 : open=23, secret=15, aucune autre valeur.';
