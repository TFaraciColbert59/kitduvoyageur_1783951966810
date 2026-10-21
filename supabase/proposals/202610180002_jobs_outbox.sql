-- LOT ULTERIEUR : mecanique transactionnelle generique, non activee.
BEGIN;
CREATE TABLE public.kit_engine_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN('awin_import','trip_feedback')),
 business_key text NOT NULL UNIQUE,payload jsonb NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN('queued','leased','done','dead')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 available_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz,lease_token uuid,last_error_code text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kit_engine_jobs_claim ON public.kit_engine_jobs(available_at,id)
 WHERE state IN('queued','leased');
ALTER TABLE public.kit_engine_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kit_engine_jobs FROM anon,authenticated;
GRANT ALL ON public.kit_engine_jobs TO service_role;
CREATE OR REPLACE FUNCTION public.claim_kit_engine_jobs(p_count integer DEFAULT 10)
RETURNS SETOF public.kit_engine_jobs LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 WITH due AS (
 SELECT id FROM public.kit_engine_jobs
 WHERE attempts<5 AND available_at<=now()
 AND(state='queued' OR(state='leased' AND lease_until<now()))
 ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT LEAST(50,GREATEST(1,p_count))
 ) UPDATE public.kit_engine_jobs j SET state='leased',attempts=attempts+1,
 lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid()
 FROM due WHERE j.id=due.id RETURNING j.*;
$$;
CREATE OR REPLACE FUNCTION public.finish_kit_engine_job(p_id uuid,p_token uuid,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE affected integer;
BEGIN
 UPDATE public.kit_engine_jobs SET
 state=CASE WHEN p_error IS NULL THEN 'done' WHEN attempts>=5 THEN 'dead' ELSE 'queued' END,
 available_at=now()+make_interval(secs=>LEAST(3600,power(2,attempts)::integer*10)),
 last_error_code=left(p_error,64),lease_until=NULL,lease_token=NULL
 WHERE id=p_id AND state='leased' AND lease_token=p_token AND lease_until>now();
 GET DIAGNOSTICS affected=ROW_COUNT;RETURN affected=1;
END;$$;
CREATE OR REPLACE FUNCTION public.reap_kit_engine_jobs()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE affected integer;
BEGIN
 UPDATE public.kit_engine_jobs SET state='dead',lease_token=NULL,lease_until=NULL,
 last_error_code='LEASE_EXHAUSTED' WHERE state='leased' AND lease_until<now() AND attempts>=5;
 GET DIAGNOSTICS affected=ROW_COUNT;RETURN affected;
END;$$;
REVOKE ALL ON FUNCTION public.claim_kit_engine_jobs(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_kit_engine_job(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reap_kit_engine_jobs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_kit_engine_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_kit_engine_job(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reap_kit_engine_jobs() TO service_role;
COMMIT;
