-- Migration : Enrichissement massif des pages pays (country_content_blocks)
-- Extension et supersession de country_practical_guides avec 4 tiers de criticité et workflow de review humaine

create table if not exists public.country_content_blocks (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries_geo(iso_a2) on delete cascade,
  block_type text not null check (block_type in (
    'formalites','securite_alertes',                          -- Tier 1
    'transport','budget','sante','etiquette',                 -- Tier 2
    'vue_ensemble','meilleure_periode_activite','itineraires_suggeres',
    'spots_incontournables','niveau_difficulte','faq',         -- Tier 3
    'recommandations_kit'                                      -- Tier 4
  )),
  tier smallint not null check (tier between 1 and 4),
  content_md text not null,
  content_json jsonb,
  sources jsonb not null default '[]'::jsonb,
  model_used text not null,
  generated_at timestamptz not null default now(),
  stale_after timestamptz not null,
  degraded boolean not null default false,
  needs_human_review boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  constraint uq_country_content_blocks unique (country_code, block_type)
);

-- Indexation optimisée
create index if not exists idx_ccb_country_code on public.country_content_blocks(country_code);
create index if not exists idx_ccb_needs_review on public.country_content_blocks(needs_human_review) where needs_human_review = true;
create index if not exists idx_ccb_stale_after on public.country_content_blocks(stale_after);

-- Migration des données existantes de country_practical_guides si elle existe
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'country_practical_guides') then
    insert into public.country_content_blocks (
      country_code,
      block_type,
      tier,
      content_md,
      sources,
      model_used,
      generated_at,
      stale_after,
      degraded,
      needs_human_review,
      reviewed_at
    )
    select
      cpg.country_code,
      case 
        when cpg.section = 'securite' then 'securite_alertes'
        when cpg.section = 'meilleure_saison' then 'meilleure_periode_activite'
        else cpg.section
      end as block_type,
      case 
        when cpg.section in ('formalites', 'securite') then 1
        when cpg.section in ('transport', 'budget', 'sante') then 2
        else 3
      end as tier,
      cpg.content_md,
      cpg.sources,
      cpg.model_used,
      cpg.generated_at,
      cpg.stale_after,
      cpg.degraded,
      false as needs_human_review,
      now() as reviewed_at
    from public.country_practical_guides cpg
    on conflict (country_code, block_type) do update set
      content_md = excluded.content_md,
      sources = excluded.sources,
      model_used = excluded.model_used,
      generated_at = excluded.generated_at,
      stale_after = excluded.stale_after,
      degraded = excluded.degraded;
  end if;
end $$;

-- Configuration de la Row Level Security (RLS)
alter table public.country_content_blocks enable row level security;

-- Lecture publique : uniquement les blocs validés (pas de review en attente) et non dégradés
drop policy if exists "country_content_blocks_public_read" on public.country_content_blocks;
create policy "country_content_blocks_public_read"
  on public.country_content_blocks
  for select
  to anon, authenticated
  using (
    (needs_human_review = false or reviewed_at is not null)
    and degraded = false
  );

-- Écriture réservée exclusivement au service_role (crons, backend jobs)
drop policy if exists "country_content_blocks_service_write" on public.country_content_blocks;
create policy "country_content_blocks_service_write"
  on public.country_content_blocks
  for all
  to service_role
  using (true)
  with check (true);
