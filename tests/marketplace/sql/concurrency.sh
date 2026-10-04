#!/usr/bin/env bash
set -euo pipefail
container="${1:-marketplace-test-pg}"
database="${2:-marketplace_run2}"
psql_db() { docker exec -i "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -At; }
psql_db <<'SQL'
insert into public.product_ownership(id,user_id,name,listing_mode) values ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Race compass','vente');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.marketplace_publish('20000000-0000-4000-8000-000000000003','Concurrent request test','Paris',1000,0);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select public.marketplace_request((select (j->>'id')::uuid from public.marketplace_list('vente',false) j where j->>'name'='Race compass'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
select public.marketplace_request((select (j->>'id')::uuid from public.marketplace_list('vente',false) j where j->>'name'='Race compass'));
SQL
first="$(psql_db <<'SQL'
select id from public.marketplace_transactions where item_id='20000000-0000-4000-8000-000000000003' and buyer_id='10000000-0000-4000-8000-000000000002';
SQL
)"
second="$(psql_db <<'SQL'
select id from public.marketplace_transactions where item_id='20000000-0000-4000-8000-000000000003' and buyer_id='10000000-0000-4000-8000-000000000003';
SQL
)"
psql_db <<SQL > /tmp/marketplace-race-first.log 2>&1 &
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.marketplace_transaction_action('$first','accept');
select pg_sleep(1);
commit;
SQL
first_pid=$!
# Both sessions race for the same inventory row. Exactly one may commit acceptance.
set +e
psql_db <<SQL > /tmp/marketplace-race-second.log 2>&1
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.marketplace_transaction_action('$second','accept');
commit;
SQL
second_status=$?
wait "$first_pid"
first_status=$?
set -e
if [[ "$first_status" = 0 && "$second_status" = 0 ]]; then echo 'Both concurrent accepts succeeded' >&2; exit 1;fi
if [[ "$first_status" != 0 && "$second_status" != 0 ]]; then echo 'Neither concurrent accept succeeded' >&2; exit 1;fi
psql_db <<'SQL'
do $$ begin if (select count(*) from public.marketplace_transactions where item_id='20000000-0000-4000-8000-000000000003' and status='accepted')<>1 then raise exception 'Concurrent commitment invariant failed';end if;end $$;
SQL
