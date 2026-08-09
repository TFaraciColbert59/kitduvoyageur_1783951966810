-- country_sync_log: tracks AI-generated country data cache state
-- Used for 24-48h cache management and admin resynchronisation

CREATE TABLE IF NOT EXISTS public.country_sync_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code_iso text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  cache_valid_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error', 'pending', 'stale')),
  schema_version text NOT NULL DEFAULT 'v2',
  generated_by text NOT NULL DEFAULT 'gemini/gemini-2.5-flash',
  nationalite text NOT NULL DEFAULT 'France',
  error_message text,
  payload_size_bytes integer,
  UNIQUE (code_iso)
);

-- Index for fast lookups by code
CREATE INDEX IF NOT EXISTS idx_country_sync_log_code ON public.country_sync_log (code_iso);
CREATE INDEX IF NOT EXISTS idx_country_sync_log_valid_until ON public.country_sync_log (cache_valid_until);

-- RLS: public read, only service role can write
ALTER TABLE public.country_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "country_sync_log_public_read" ON public.country_sync_log;
DROP POLICY IF EXISTS "country_sync_log_service_write" ON public.country_sync_log;

CREATE POLICY "country_sync_log_public_read"
  ON public.country_sync_log FOR SELECT
  USING (true);

-- Only service role can insert/update (API route uses service role key)
CREATE POLICY "country_sync_log_service_write"
  ON public.country_sync_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
