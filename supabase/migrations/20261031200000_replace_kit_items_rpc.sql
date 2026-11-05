-- Migration: 20261031200000_replace_kit_items_rpc.sql
-- Description: Remplacement atomique et audité des articles d'un kit avec garde-fou anti-vidage

-- 1. Évolution additive des colonnes de révision et d'emplacement
alter table public.materiel_kits
  add column if not exists studio_revision integer not null default 0;

alter table public.materiel_kit_items
  add column if not exists slot_id text,
  add column if not exists slot_order integer;

-- 2. Autorisation de l'action 'items_replaced' dans l'historique
alter table public.materiel_kit_history
  drop constraint if exists materiel_kit_history_action_check;

alter table public.materiel_kit_history
  add constraint materiel_kit_history_action_check
  check (action in ('created','updated','deleted','restored','forked','optimized','compared','items_replaced'));

-- 3. Création de la fonction RPC transactionnelle replace_kit_items
create or replace function public.replace_kit_items(
  p_kit_id uuid,
  p_items jsonb,
  p_allow_empty boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
  v_previous integer;
begin
  -- Vérification d'authentification
  if v_user is null then
    raise exception 'non authentifié' using errcode = '28000';
  end if;

  -- Vérification de propriété du kit
  if not exists (
    select 1 from public.materiel_kits
    where id = p_kit_id and user_id = v_user
  ) then
    raise exception 'kit introuvable ou non autorisé' using errcode = '42501';
  end if;

  v_count := jsonb_array_length(coalesce(p_items, '[]'::jsonb));
  select count(*) into v_previous
    from public.materiel_kit_items where kit_id = p_kit_id;

  -- Garde-fou central : interdiction de vider un kit non vide sans confirmation explicite
  if v_count = 0 and v_previous > 0 and not p_allow_empty then
    raise exception
      'vidage non intentionnel refusé : % article(s) seraient perdus (passer p_allow_empty)', v_previous
      using errcode = '23514';
  end if;

  -- Remplacement atomique en transaction unique
  delete from public.materiel_kit_items where kit_id = p_kit_id;

  if v_count > 0 then
    insert into public.materiel_kit_items
      (kit_id, user_id, product_ownership_id, name, category,
       weight_g, quantity, is_checked, slot_id, slot_order)
    select
      p_kit_id, v_user,
      nullif(item->>'product_ownership_id','')::uuid,
      item->>'name',
      item->>'category',
      nullif(item->>'weight_g', '')::integer,
      coalesce((item->>'quantity')::integer, 1),
      coalesce((item->>'is_checked')::boolean, false),
      item->>'slot_id',
      (item->>'slot_order')::integer
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) as item;
  end if;

  -- Journalisation du diff d'articles dans materiel_kit_history
  insert into public.materiel_kit_history (kit_id, user_id, action, payload)
  values (p_kit_id, v_user, 'items_replaced',
          jsonb_build_object('before', v_previous, 'after', v_count));

  -- Incrémentation monotone de la révision
  update public.materiel_kits
     set studio_revision = studio_revision + 1,
         updated_at = now()
   where id = p_kit_id;

  return v_count;
end;
$$;

revoke execute on function public.replace_kit_items(uuid, jsonb, boolean) from public;
grant execute on function public.replace_kit_items(uuid, jsonb, boolean) to authenticated;
