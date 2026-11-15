"""Compile the LKDV workbook into a reproducible, local-only Supabase seed."""

import argparse
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
import itertools
import json
import os
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryFile
from urllib.parse import parse_qs, unquote, urlsplit
from uuid import UUID, uuid5
from zoneinfo import ZoneInfo

from openpyxl import load_workbook

import clubs
import community
import journeys
from media import landscape
from verify import verify

BASE = datetime(2026, 11, 15, 18, tzinfo=timezone.utc)
NAMESPACE = UUID("8bfea315-555a-4b27-8a02-801843fb4960")
SAFE_NAME = re.compile(r"^[a-z][a-z0-9_]*$")
EMAIL = re.compile(r"^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$")
ANCHOR = "P0001"
DEFAULT_EMAIL = "p0001@lkdv.invalid"
SEED_SHEETS = ("02 ", "10 ", "11 ", "12 ", "13 ", "14 ", "15 ", "20 ", "21 ", "22 ", "23 ", "24 ", "25 ", "30 ", "31 ", "40 ", "41 ", "42 ", "43 ", "44 ", "45 ", "50 ", "51 ", "52 ", "53 ", "54 ", "55 ", "56 ", "60 ", "61 ", "62 ", "63 ", "64 ", "65 ", "66 ", "70 ")
# Ordered by FK and by trigger dependencies such as story audiences and counters.
TABLES = """
user_profiles user_traveller notification_preferences
user_follows follow_requests user_content_mutes story_close_friends
clubs club_members club_channels club_channel_messages club_topics club_topic_replies
events event_participants club_events club_event_registrations club_event_participants
conversations conversation_members travel_groups group_members group_tasks group_polls
group_poll_votes group_kit_items group_expenses group_messages
materiel_kits product_ownership materiel_kit_items materiel_loans
crews crew_members trips trip_collaborators trip_participants trip_steps trip_items
carnets carnet_etapes carnet_kit_items activity_sessions hike_sessions hike_session_participants
hike_session_gear outing_share_metrics carnet_moments
carnet_views carnet_likes carnet_favorites carnet_comments carnet_moment_likes
community_posts community_post_drafts post_comments post_comment_likes post_likes post_saves
post_stories story_views story_likes story_comments story_highlights story_highlight_items
messages post_shares notifications
""".split()
# Canonical coordinates are city centroids, not personal addresses.
OPTIONAL_TABLES = {
    "user_content_mutes", "club_channels", "club_channel_messages",
    "club_event_registrations", "outing_share_metrics",
}
OPTIONAL_COLUMNS = {
    "clubs": {"primary_sport", "sports"},
    "club_events": {"ends_at", "format", "meeting_point", "sport", "starts_at", "visibility", "waitlist_enabled"},
    "activity_sessions": {"client_session_id"},
    "hike_sessions": {"activity_session_id"},
    "hike_session_gear": {"gear_item_id", "sport"},
}
CITY_COORDS = dict(zip(
    ("Lille", "Grenoble", "Morlaix", "Liège", "Glasgow", "Leipzig", "Porto", "Valencia", "Kraków",
     "Rovaniemi", "Bologna", "Ioánnina", "Montréal", "Whitehorse", "Minneapolis", "Oaxaca",
     "San José", "Medellín", "Curitiba", "Valdivia", "Cusco", "Rabat", "Dakar", "Nairobi",
     "Cape Town", "Alexandrie", "Amman", "Bengaluru", "Kochi", "Đà Nẵng", "Sapporo", "Taipei",
     "Busan", "Yogyakarta", "Hobart", "Dunedin"),
    ((50.63,3.06),(45.19,5.73),(48.58,-3.83),(50.63,5.57),(55.86,-4.25),(51.34,12.37),
     (41.15,-8.61),(39.47,-0.38),(50.06,19.94),(66.5,25.73),(44.49,11.34),(39.66,20.85),
     (45.5,-73.57),(60.72,-135.06),(44.98,-93.27),(17.07,-96.72),(9.93,-84.08),
     (6.25,-75.57),(-25.43,-49.27),(-39.82,-73.25),(-13.52,-71.97),(34.02,-6.84),
     (14.72,-17.47),(-1.29,36.82),(-33.93,18.42),(31.2,29.92),(31.95,35.93),
     (12.97,77.59),(9.93,76.27),(16.05,108.2),(43.06,141.35),(25.03,121.57),
     (35.18,129.08),(-7.8,110.37),(-42.88,147.33),(-45.87,170.5)),
))
PREFERENCES = ("post_liked", "post_commented", "group_invite", "group_message", "group_task_assigned",
               "group_expense_added", "group_poll_created", "club_event_reminder", "new_message",
               "new_follower", "post_reposted", "mention", "gear_loan_requested")


def parse_time(raw):
    if isinstance(raw, datetime):
        value = raw
    else:
        value = datetime.fromisoformat(raw.rstrip("Z") + "+00:00" if raw.endswith("Z") else raw)
    if value.tzinfo is None:
        raise ValueError(f"Fuseau manquant : {raw!r}")
    return value.astimezone(timezone.utc)


class Fixture:
    def __init__(self, workbook, at, anchor_id=None, anchor_email=DEFAULT_EMAIL, anchor_name=None):
        self.workbook = workbook
        self.at = at
        self.anchor_id = anchor_id or str(uuid5(NAMESPACE, "persona:" + ANCHOR))
        self.anchor_email = anchor_email
        self.anchor_name = anchor_name
        self.data = defaultdict(list)

    def rows(self, name):
        return iter(self.workbook[name])

    def id(self, raw):
        if raw is None or raw == "":
            return None
        if raw == ANCHOR:
            return self.anchor_id
        key = f"persona:{raw}" if re.fullmatch(r"P\d{4}", str(raw)) else f"fixture:{raw}"
        return str(uuid5(NAMESPACE, key))

    def time(self, raw):
        if raw is None or raw == "":
            return None
        paris = ZoneInfo("Europe/Paris")
        local = parse_time(raw).astimezone(paris)
        days = (self.at.astimezone(paris).date() - BASE.astimezone(paris).date()).days
        return (local + timedelta(days=days)).astimezone(timezone.utc).isoformat()

    def date(self, raw, zone=None):
        if not raw:
            return None
        if isinstance(raw, date) and not isinstance(raw, datetime):
            return (raw + (self.at.date() - BASE.date())).isoformat()
        if isinstance(raw, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
            return (date.fromisoformat(raw) + (self.at.date() - BASE.date())).isoformat()
        return parse_time(self.time(raw)).astimezone(ZoneInfo(zone) if zone else timezone.utc).date().isoformat()

    def add(self, table, **values):
        if table not in TABLES or any(not SAFE_NAME.fullmatch(col) for col in values):
            raise ValueError(f"Table ou colonne hors périmètre : {table}, {tuple(values)}")
        self.data[table].append({key: value for key, value in values.items() if value is not None})


def read_workbook(path):
    workbook = load_workbook(path, read_only=True, data_only=False)
    try:
        result = {}
        for sheet in workbook:
            if not sheet.title.startswith(SEED_SHEETS):
                continue
            result[sheet.title] = list(sheet.iter_rows(min_row=5, values_only=True))
        return result
    finally:
        workbook.close()


def profiles(ctx):
    for r in ctx.rows("10 Profils"):
        persona, _, name, handle, email, _, age, _, _, city, iso = r[:11]
        zone, locale, currency = r[13], r[14], r[17]
        privacy, created = r[40], ctx.time(r[41])
        profile = ctx.id(persona)
        if persona == ANCHOR and ctx.anchor_name:
            name = ctx.anchor_name
        ctx.add("user_profiles", id=profile, email=ctx.anchor_email if persona == ANCHOR else email,
                full_name=name, handle=handle.lower().replace("-", "_"), location=f"{city}, {iso}",
                bio=r[39], profile_visibility=privacy, is_demo=True, created_at=created,
                avatar_url=landscape(r[42], 48, 48) if r[42] else "",
                cover_url=landscape(r[43], 120, 40) if r[43] else None,
                updated_at=created, age_confirmed_at=created if age >= 18 else None,
                notification_prefs={"sms": False, "email": False, "push": False})
        lat, lon = CITY_COORDS[city]
        ctx.add("user_traveller", user_id=profile, residence_country=iso, home_country=iso,
                home_name=city, home_lat=lat, home_lon=lon, language=locale, currency=currency,
                time_zone=zone, updated_at=created)
        for kind in PREFERENCES:
            ctx.add("notification_preferences", user_id=profile, notification_type=kind,
                    in_app_enabled=True, email_enabled=False, push_enabled=False, time_zone=zone)


def build(path, at, anchor_id=None, anchor_email=DEFAULT_EMAIL, anchor_name=None):
    ctx = Fixture(read_workbook(path), at, anchor_id, anchor_email, anchor_name)
    profiles(ctx)
    clubs.build(ctx)
    journeys.build(ctx)
    community.build(ctx)
    community.finish(ctx)
    tables = {table: ctx.data[table] for table in TABLES if ctx.data[table]}
    manifest = {
        "version": 1, "as_of": at.isoformat(), "anchor_id": ctx.anchor_id,
        "counts": {table: len(rows) for table, rows in tables.items()}, "tables": tables,
        "workbook_sha256": sha256(Path(path).read_bytes()).hexdigest(),
        "editorial": {
            "people": [{
                "id": ctx.id(row[0]), "persona": row[0], "age": row[6],
                "genre": row[8], "cadence": row[38], "style": row[32],
                "voice": row[33], "humor": row[34], "mood": row[36],
                "hobbies": [row[26], row[28], row[29]], "life_context": row[20],
                "values": row[31], "availability": row[23], "travel_style": row[25],
            } for row in ctx.rows("10 Profils")],
            "relations": [{
                "id": ctx.id(row[0]), "person_a": ctx.id(row[1]), "person_b": ctx.id(row[2]),
                "kind": row[3], "strength": row[4], "club_id": ctx.id(row[5]),
                "introduced_by": ctx.id(row[6]), "created_at": ctx.time(row[7]),
                "state": row[8], "context": row[9], "international": bool(row[11]),
            } for row in ctx.rows("11 Relations")],
        },
        "anchors": {"public_post": ctx.id(next(r[0] for r in ctx.rows("40 Posts")
                    if r[10] == "E00001" and r[8] == "public" and not r[11])),
                    "club_event": ctx.id("E00001"), "carnet": ctx.id("CA00001")},
    }
    if problems := verify(manifest):
        raise ValueError("Manifeste invalide :\n" + "\n".join(problems[:30]))
    return manifest


def quote(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    if "\x00" in value:
        raise ValueError("Octet NUL interdit dans une cellule")
    return "'" + value.replace("'", "''") + "'"


def write_table(table, rows, club_authors):
    # JSON record conversion renders array, numeric, JSON and timestamp columns
    # according to the real target types and still allows column defaults.
    def key(row):
        if table == "community_posts":
            actor = row.get("author_id") if row.get("audience") == "club" else None
        else:
            actor = club_authors.get(row.get("post_id"))
        return tuple(sorted(row)), actor

    for (columns, actor), batch in itertools.groupby(rows, key):
        raw_rows = list(batch)
        if actor:
            yield f"select set_config('request.jwt.claim.sub', {quote(actor)}, true);"
        for i in range(0, len(raw_rows), 250):
            data = quote(raw_rows[i:i+250])
            names = ", ".join(f'"{column}"' for column in columns)
            action = "do nothing"
            conflict = ""
            if table == "user_profiles":
                conflict = " (id)"
                editable = ("full_name", "bio", "location", "is_demo", "handle", "profile_visibility",
                            "avatar_url", "cover_url",
                            "notification_prefs", "created_at", "updated_at", "age_confirmed_at")
                action = "do update set " + ", ".join(f"{c} = excluded.{c}" for c in editable if c in columns)
            elif table == "notification_preferences":
                conflict = " (user_id, notification_type)"
                action = "do update set email_enabled=false, push_enabled=false"
            yield (
                f"insert into public.{table} ({names}) select {names} "
                f"from jsonb_populate_recordset(null::public.{table}, {data}::jsonb) "
                "where not exists (select 1 from lkdv_demo_local.seed_run) "
                f"on conflict{conflict} {action};"
            )
        if actor:
            yield "select set_config('request.jwt.claim.sub', '', true);"


def sql(manifest, existing_anchor=False):
    tables = manifest["tables"]
    anchor_id = manifest["anchor_id"]
    key = sha256(json.dumps(manifest, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    cohort_rows = tables["user_profiles"]
    club_authors = {row["id"]: row["author_id"] for row in tables["community_posts"] if row["audience"] == "club"}
    yield "begin;"
    yield "set local statement_timeout = 0; set local standard_conforming_strings = on;"
    yield "select pg_advisory_xact_lock(260115001);"
    yield "select set_config('request.jwt.claim.role','service_role',true), set_config('request.jwt.claim.sub','',true);"
    yield """create schema if not exists lkdv_demo_local;
revoke all on schema lkdv_demo_local from public, anon, authenticated;
create table if not exists lkdv_demo_local.seed_run (
  singleton boolean primary key default true check (singleton),
  payload_hash text not null, anchor_id uuid not null, as_of timestamptz not null,
  imported_at timestamptz not null default now()
);
create table if not exists lkdv_demo_local.people(id uuid primary key, editorial jsonb not null default '{}'::jsonb);
create table if not exists lkdv_demo_local.relations(
  id uuid primary key, person_a uuid not null references lkdv_demo_local.people(id),
  person_b uuid not null references lkdv_demo_local.people(id),
  editorial jsonb not null, unique(person_a,person_b), check(person_a <> person_b)
);
create temporary table lkdv_seed_person (id uuid primary key, email text unique not null, full_name text not null, created_at timestamptz not null) on commit drop;
"""
    for i in range(0, len(cohort_rows), 200):
        tuples = ",\n".join("(" + ", ".join(quote(r[c]) for c in ("id", "email", "full_name", "created_at")) + ")" for r in cohort_rows[i:i+200])
        yield "insert into lkdv_seed_person values\n" + tuples + ";"
    yield f"""do $seed$
begin
  if exists(select 1 from lkdv_demo_local.seed_run where payload_hash <> {quote(key)}) then
    raise exception 'Ce bac contient un lot différent : garder son --as-of ou utiliser une base locale distincte';
  end if;
  if exists(
    select 1 from lkdv_seed_person p join auth.users u
      on lower(u.email)=lower(p.email) and u.id<>p.id
  ) then raise exception 'Collision entre un compte Auth et le lot'; end if;
  if exists(
    select 1 from lkdv_seed_person p join auth.users u on u.id=p.id
    where lower(u.email) is distinct from lower(p.email)
    or ((u.raw_app_meta_data->>'lkdv_fixture') is distinct from 'v1'
      and u.id <> {quote(anchor_id)}::uuid)
  ) then raise exception 'Collision sur un UUID Auth de démo'; end if;
  if exists(select 1 from auth.users u where u.id = {quote(anchor_id)}::uuid)
    and not exists (select 1 from public.user_profiles p where p.id={quote(anchor_id)}::uuid and p.is_demo) then
    raise exception 'L’ancre existante doit être un profil explicitement marqué démo';
  end if;
  if exists(select 1 from auth.users u where u.id not in (select id from lkdv_seed_person))
    or exists(select 1 from public.user_profiles p where p.id not in (select id from lkdv_seed_person)) then
    raise exception 'Utiliser un bac local vide ou avec le compte démo seul';
  end if;
end $seed$;
"""
    for field, tab, cols, projection in (
        ("people", "people", "id,editorial", "(row->>'id')::uuid,row"),
        ("relations", "relations", "id,person_a,person_b,editorial",
         "(row->>'id')::uuid,(row->>'person_a')::uuid,(row->>'person_b')::uuid,row"),
    ):
        data = manifest["editorial"][field]
        for i in range(0, len(data), 250):
            yield (f"insert into lkdv_demo_local.{tab} ({cols}) select {projection} "
                   f"from jsonb_array_elements({quote(data[i:i+250])}::jsonb) as rows(row) "
                   "on conflict (id) do nothing;")
    yield f"""insert into auth.users (
    instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
    created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new,encrypted_password
  )
  select '00000000-0000-0000-0000-000000000000',p.id,'authenticated','authenticated',p.email,p.created_at,
    '{{"provider":"email","providers":["email"],"lkdv_fixture":"v1"}}'::jsonb,
    jsonb_build_object('full_name',p.full_name),p.created_at,p.created_at,'','','','',
    case when p.id={quote(anchor_id)}::uuid then
      nullif(current_setting('lkdv_demo.anchor_password_hash',true),'')
    else null end
  from lkdv_seed_person p where not exists (select 1 from auth.users u where u.id=p.id)
  on conflict (id) do nothing;
insert into auth.identities (id,provider_id,user_id,identity_data,provider,created_at,updated_at)
  select p.id,p.id::text,p.id,jsonb_build_object('sub',p.id::text,'email',p.email,'email_verified',true),
         'email',p.created_at,p.created_at
  from lkdv_seed_person p
  join auth.users u on u.id=p.id and u.raw_app_meta_data->>'lkdv_fixture'='v1'
  on conflict(provider_id,provider) do nothing;
"""
    yield """create temporary table lkdv_delivery_baseline on commit drop as select count(*) as total
  from public.notification_deliveries where channel in ('email','push');
create or replace function pg_temp.lkdv_keep_notifications_in_app() returns trigger
language plpgsql as $trigger$
begin
  if new.channel in ('email','push') and exists (
    select 1 from public.notifications n join lkdv_seed_person p on p.id=n.user_id where n.id=new.notification_id
  )
  then return null; end if;
  return new;
end $trigger$;
create trigger lkdv_seed_in_app_only before insert on public.notification_deliveries
  for each row execute function pg_temp.lkdv_keep_notifications_in_app();
"""
    for table, rows in tables.items():
        if existing_anchor and table in {"user_profiles", "user_traveller"}:
            field = "id" if table == "user_profiles" else "user_id"
            rows = [r for r in rows if r[field] != anchor_id]
        yield f"-- {table}"
        yield from write_table(table, rows, club_authors)
    yield "drop trigger lkdv_seed_in_app_only on public.notification_deliveries;"
    yield (Path(__file__).parent / "local_profile_view.sql").read_text()
    yield f"""do $seed$
begin
  if (select count(*) from lkdv_demo_local.relations) <> {len(manifest["editorial"]["relations"])}
    then raise exception 'Le graphe éditorial ne correspond pas au classeur'; end if;
  if (select count(*) from public.user_profiles p join lkdv_seed_person s using(id) where p.is_demo) <> 1000
    then raise exception 'Attendu : 1 000 profils de démo'; end if;
  if (select count(*) from public.notification_deliveries where channel in ('email','push'))
    <> (select total from lkdv_delivery_baseline)
    then raise exception 'Une livraison externe a été produite'; end if;
end $seed$;
insert into lkdv_demo_local.seed_run(payload_hash,anchor_id,as_of)
values ({quote(key)},{quote(anchor_id)},{quote(manifest['as_of'])})
on conflict (singleton) do nothing;
commit;"""


def local_psql(db_url):
    if not db_url:
        raise ValueError("LKDV_DEMO_DB_URL est requis pour apply (instance locale dédiée)")
    url=urlsplit(db_url)
    allowed_options={"sslmode", "connect_timeout", "application_name"}
    if (url.scheme not in {"postgres", "postgresql"} or url.hostname not in {"127.0.0.1", "::1"}
            or not url.path.strip("/") or set(parse_qs(url.query, keep_blank_values=True)) - allowed_options):
        raise ValueError("Utiliser une URL PostgreSQL explicite sur 127.0.0.1 ou ::1")
    # Avoid connection overrides inherited from another development project.
    env={k:v for k,v in os.environ.items() if not k.startswith("PG")}
    env.update(PGHOST=url.hostname, PGPORT=str(url.port or 5432),
               PGDATABASE=unquote(url.path.lstrip("/")))
    if url.username:
        env["PGUSER"] = unquote(url.username)
    if url.password:
        env["PGPASSWORD"] = unquote(url.password)
    for key, values in parse_qs(url.query).items():
        env["PG" + key.upper()] = values[-1]
    return ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-q"], env


def query(command, env, statement):
    return subprocess.run(command + ["-A", "-t"], input=statement, env=env, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout.strip()


def adapt_schema(manifest, command, env):
    catalog = json.loads(query(command, env, """
      select json_object_agg(table_name, cols)
      from (select table_name, json_agg(column_name) as cols
      from information_schema.columns where table_schema='public'
      group by table_name) t;
    """) or "{}")
    rows_by_table = {}
    missing = {}
    for table, rows in manifest["tables"].items():
        if table not in catalog:
            if table not in OPTIONAL_TABLES:
                raise ValueError(f"Table requise absente des migrations : {table}")
            missing[table] = {"rows_omitted": len(rows)}
            continue
        unavailable = set().union(*(row.keys() for row in rows)) - set(catalog[table])
        if unavailable - OPTIONAL_COLUMNS.get(table, set()):
            raise ValueError(f"Colonnes requises absentes : {table}: {', '.join(sorted(unavailable))}")
        if unavailable:
            missing[table] = {"columns_omitted": sorted(unavailable)}
            rows = [{key: value for key, value in row.items() if key not in unavailable} for row in rows]
        rows_by_table[table] = rows
    return {**manifest, "tables": rows_by_table, "counts": {t: len(r) for t, r in rows_by_table.items()}}, missing


def password_hash(command, env, password):
    # Pass password as data on stdin, never as a CLI argument or in a script.
    if not password or len(password.encode()) > 72 or len(password) < 8:
        raise ValueError("DEMO_LOGIN_PASSWORD doit contenir 8 à 72 octets pour créer l’ancre locale")
    return query(command, env,
                 f"select extensions.crypt({quote(password)}, extensions.gen_salt('bf', 10));")


def apply(path, as_of):
    command, env = local_psql(os.environ.get("LKDV_DEMO_DB_URL"))
    email = os.environ.get("DEMO_LOGIN_EMAIL") or DEFAULT_EMAIL
    if not EMAIL.fullmatch(email):
        raise ValueError("DEMO_LOGIN_EMAIL invalide")
    matches = query(command, env, f"select u.id from auth.users u where lower(u.email)=lower({quote(email)});")
    anchor = str(UUID(matches)) if matches else None
    # Treat an anchor previously created by this seed as a fixture on replay.
    reused = bool(anchor and query(command, env, f"""select 1 from auth.users
      where id={quote(anchor)} and raw_app_meta_data->>'lkdv_fixture' is distinct from 'v1';"""))
    if as_of is None and query(command, env, "select coalesce(to_regclass('lkdv_demo_local.seed_run')::text,'');"):
        previous = query(command, env, "select as_of::text from lkdv_demo_local.seed_run where singleton;")
        as_of = parse_time(previous) if previous else None
    anchor_name = query(command, env, f"select full_name from public.user_profiles where id={quote(anchor)}::uuid;") if reused else None
    # Keep the automatically chosen origin stable throughout the local day.
    now = datetime.now(timezone.utc)
    default_as_of = datetime.combine(now.astimezone(ZoneInfo("Europe/Paris")).date(), BASE.time(), timezone.utc)
    manifest = build(path, as_of or default_as_of, anchor, email, anchor_name)
    manifest, omitted = adapt_schema(manifest, command, env)
    hash_value = None if anchor else password_hash(command, env, os.environ.get("DEMO_LOGIN_PASSWORD"))
    with TemporaryFile(mode="w+t", encoding="utf-8") as program:
        if hash_value:
            program.write(f"select set_config('lkdv_demo.anchor_password_hash',{quote(hash_value)},false);\n")
        for statement in sql(manifest, reused):
            program.write(statement + "\n")
        program.seek(0)
        subprocess.run(command, stdin=program, env=env, stdout=subprocess.DEVNULL, check=True)
    print(json.dumps({"as_of": manifest["as_of"], "anchor_id": manifest["anchor_id"],
                      "counts": manifest["counts"], "schema_omissions": omitted}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["plan", "apply"])
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--as-of", type=parse_time)
    parser.add_argument("--out", type=Path, help="Répertoire pour le manifeste et SQL en mode plan")
    args = parser.parse_args()
    if args.mode == "apply":
        apply(args.workbook, args.as_of)
        return
    manifest = build(args.workbook, args.as_of or BASE)
    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
        (args.out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
        with (args.out / "seed.sql").open("w", encoding="utf-8") as output:
            for statement in sql(manifest):
                output.write(statement + "\n")
    print(json.dumps(manifest["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
