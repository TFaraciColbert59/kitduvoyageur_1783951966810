-- 2026-10-21 — Inscription : le trigger handle_new_user insère un profil sans handle.
-- Le handle est NOT NULL depuis la migration 20261021120000 ; on le remplit avant l'insert.

create or replace function public.set_user_profile_handle()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_base text;
begin
  if new.handle is null or btrim(new.handle) = '' then
    v_base := lower(regexp_replace(split_part(coalesce(new.email, new.id::text), '@', 1), '[^a-zA-Z0-9_]', '_', 'g'));
    if v_base is null or btrim(v_base) = '' then
      v_base := 'user';
    end if;
    new.handle := v_base || '_' || left(new.id::text, 4);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_user_profile_handle on public.user_profiles;
create trigger trg_user_profile_handle
before insert on public.user_profiles
for each row execute function public.set_user_profile_handle();

-- Réparer les éventuels profils sans handle (aucun en principe).
update public.user_profiles
set handle = lower(regexp_replace(split_part(coalesce(email, id::text), '@', 1), '[^a-zA-Z0-9_]', '_', 'g')) || '_' || left(id::text, 4)
where handle is null or btrim(handle) = '';
