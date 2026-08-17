-- ============================================================
-- CONFIGURATOR SESSIONS & KIT REPORTS
-- Rapport de kit personnalisé généré à la volée
-- ============================================================

-- 1. configurator_sessions — stocke les paramètres de chaque session
CREATE TABLE IF NOT EXISTS public.configurator_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  destination     TEXT NOT NULL DEFAULT '',
  country         TEXT NOT NULL DEFAULT '',
  start_date      DATE,
  end_date        DATE,
  season          TEXT NOT NULL DEFAULT '',
  activity        TEXT NOT NULL DEFAULT '',
  level           TEXT NOT NULL DEFAULT '',
  max_weight_g    INTEGER NOT NULL DEFAULT 10000,
  budget_eur      NUMERIC NOT NULL DEFAULT 500,
  body_weight_kg  NUMERIC,
  climate         TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_configurator_sessions_user_id
  ON public.configurator_sessions(user_id);

-- 2. kit_reports — rapport généré à la volée depuis une session
CREATE TABLE IF NOT EXISTS public.kit_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  session_id          UUID REFERENCES public.configurator_sessions(id) ON DELETE SET NULL,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  destination         TEXT NOT NULL DEFAULT '',
  country             TEXT NOT NULL DEFAULT '',
  start_date          DATE,
  end_date            DATE,
  season              TEXT NOT NULL DEFAULT '',
  activity            TEXT NOT NULL DEFAULT '',
  level               TEXT NOT NULL DEFAULT '',
  climate             TEXT NOT NULL DEFAULT '',
  body_weight_kg      NUMERIC,
  budget_eur          NUMERIC NOT NULL DEFAULT 0,
  -- Produits sélectionnés (JSONB array)
  selected_items      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Alternatives par article (JSONB)
  alternatives        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Consommables recommandés
  consumables         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Articles à apporter soi-même
  bring_yourself      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Gabarit de poids
  weight_breakdown    JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_weight_g      INTEGER NOT NULL DEFAULT 0,
  -- Détail budgétaire
  total_price_eur     NUMERIC NOT NULL DEFAULT 0,
  -- Empreinte carbone estimée
  carbon_kg_estimate  NUMERIC,
  -- Statut du rapport
  status              TEXT NOT NULL DEFAULT 'draft',
  -- Converti en inventaire après achat
  converted_to_inventory BOOLEAN NOT NULL DEFAULT false,
  converted_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kit_reports_user_id
  ON public.kit_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_kit_reports_session_id
  ON public.kit_reports(session_id);

-- 3. gear_items — inventaire personnel (si pas encore créé)
CREATE TABLE IF NOT EXISTS public.gear_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL DEFAULT '',
  brand                 TEXT NOT NULL DEFAULT '',
  model                 TEXT NOT NULL DEFAULT '',
  category              TEXT NOT NULL DEFAULT 'autre',
  condition             TEXT NOT NULL DEFAULT 'bon',
  purchase_date         DATE,
  purchase_price        NUMERIC NOT NULL DEFAULT 0,
  weight_g              INTEGER NOT NULL DEFAULT 0,
  expiry_date           DATE,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  notes                 TEXT NOT NULL DEFAULT '',
  serial_number         TEXT,
  usage_count           INTEGER NOT NULL DEFAULT 0,
  image                 TEXT NOT NULL DEFAULT '',
  alt                   TEXT NOT NULL DEFAULT '',
  tags                  TEXT[] NOT NULL DEFAULT '{}',
  source_report_id      UUID REFERENCES public.kit_reports(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gear_items_user_id
  ON public.gear_items(user_id);

-- 4. RLS
ALTER TABLE public.configurator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_configurator_sessions" ON public.configurator_sessions;
CREATE POLICY "users_manage_own_configurator_sessions"
  ON public.configurator_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_own_kit_reports" ON public.kit_reports;
CREATE POLICY "users_manage_own_kit_reports"
  ON public.kit_reports FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_own_gear_items" ON public.gear_items;
CREATE POLICY "users_manage_own_gear_items"
  ON public.gear_items FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
