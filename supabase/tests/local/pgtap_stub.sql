-- Substitut minimal de pgTAP pour exécuter les tests hors extension.
create or replace function public.plan(n integer) returns text language plpgsql as $$
begin raise notice 'plan: % assertions', n; return '1..' || n; end $$;

create or replace function public.is(got anyelement, expected anyelement, description text) returns text language plpgsql as $$
begin
  if got is distinct from expected then
    raise exception 'NOT OK — % (attendu %, obtenu %)', description, expected, got;
  end if;
  return 'ok';
end $$;

create or replace function public.isnt(got anyelement, notexpected anyelement, description text) returns text language plpgsql as $$
begin
  if got is not distinct from notexpected then
    raise exception 'NOT OK — % (ne devait pas valoir %)', description, notexpected;
  end if;
  return 'ok';
end $$;

create or replace function public.lives_ok(stmt text, description text) returns text language plpgsql as $$
begin
  execute stmt;
  return 'ok';
exception when others then
  raise exception 'NOT OK — % (erreur inattendue : %)', description, sqlerrm;
end $$;

create or replace function public.throws_ok(stmt text, errcode text, errmsg text, description text) returns text language plpgsql as $$
begin
  execute stmt;
  raise exception 'NOT OK — % (aucune erreur levée, % attendu)', description, errcode;
exception
  when others then
    if sqlstate <> errcode then
      raise exception 'NOT OK — % (attendu %, obtenu % : %)', description, errcode, sqlstate, sqlerrm;
    end if;
    return 'ok';
end $$;

create or replace function public.throws_ok(stmt text, errcode text, errmsg text) returns text language sql as $$
  select public.throws_ok(stmt, errcode, errmsg, stmt);
$$;

create or replace function public.finish() returns text language sql as $$ select 'done' $$;

grant execute on all functions in schema public to authenticated, anon;
