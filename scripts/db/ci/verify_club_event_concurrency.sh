#!/usr/bin/env bash
# Preuve PostgreSQL en deux sessions sur une base locale de recette.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh
require_local_database

query() { psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 "$@"; }

IFS='|' read -r organizer first second club event <<< \
  "$(query -c 'SELECT gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()')"
workspace=$(mktemp -d)
first_pid=
second_pid=
cleanup() {
  if [[ -n "$first_pid" ]]; then kill "$first_pid" 2>/dev/null || true; wait "$first_pid" 2>/dev/null || true; fi
  if [[ -n "$second_pid" ]]; then kill "$second_pid" 2>/dev/null || true; wait "$second_pid" 2>/dev/null || true; fi
  query -v club="$club" -v organizer="$organizer" -v first="$first" -v second="$second" >/dev/null <<'SQL' || true
DELETE FROM public.clubs WHERE id = :'club';
DELETE FROM auth.users WHERE id IN (:'organizer', :'first', :'second');
SQL
  rm -rf "$workspace"
}
trap cleanup EXIT

query -v organizer="$organizer" -v first="$first" -v second="$second" -v club="$club" -v event="$event" <<'SQL'
INSERT INTO auth.users (id,email) VALUES
  (:'organizer', :'organizer' || '@recette.example.test'),
  (:'first', :'first' || '@recette.example.test'),
  (:'second', :'second' || '@recette.example.test');
INSERT INTO public.clubs (id, slug, name, privacy, created_by)
VALUES (:'club', 'concurrence-' || :'club', 'Recette de concurrence', 'open', :'organizer');
INSERT INTO public.club_events (id, club_id, organizer_id, title, event_date, max_participants, waitlist_enabled, visibility)
VALUES (:'event', :'club', :'organizer', 'Une seule place', now() + interval '1 day', 1, true, 'public');
SQL

PGAPPNAME="rsvp-first-$event" query -v actor="$first" -v event="$event" >"$workspace/first" <<'SQL' &
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = :'actor';
SELECT public.transact_club_event_registration(:'event', true) #>> '{registration,status}';
DO $$ BEGIN PERFORM pg_sleep(3); END $$;
COMMIT;
SQL
first_pid=$!

await_session() {
  local app="$1" state="$2" result
  for _ in {1..40}; do
    result=$(query -v app="$app" -v state="$state" <<'SQL'
SELECT EXISTS (
  SELECT 1 FROM pg_stat_activity WHERE application_name = :'app' AND wait_event_type = :'state'
);
SQL
)
    if [[ "$result" == t ]]; then return; fi
    sleep 0.05
  done
  printf 'Session %s absente de l’attente %s\n' "$app" "$state" >&2
  exit 1
}
await_session "rsvp-first-$event" Timeout

PGAPPNAME="rsvp-next-$event" query -v actor="$second" -v event="$event" >"$workspace/second" <<'SQL' &
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = :'actor';
SELECT public.transact_club_event_registration(:'event', true) #>> '{registration,status}';
COMMIT;
SQL
second_pid=$!
await_session "rsvp-next-$event" Lock

wait "$first_pid"; first_pid=
wait "$second_pid"; second_pid=
[[ $(cat "$workspace/first") == registered ]]
[[ $(cat "$workspace/second") == waitlist ]]

result=$(query -v event="$event" -v first="$first" -v second="$second" <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = :'first';
SELECT public.transact_club_event_registration(:'event', false) #>> '{registration,status}';
RESET ROLE;
SELECT status FROM public.club_event_registrations WHERE event_id = :'event' AND user_id = :'second';
SELECT participants_count FROM public.club_events WHERE id = :'event';
COMMIT;
SQL
)
[[ "$result" == $'cancelled\nregistered\n1' ]]
printf '%s\n' 'PASS — deux sessions, une place confirmée, une attente, une promotion FIFO et un décompte final de 1.'
