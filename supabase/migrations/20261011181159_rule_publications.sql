-- T42 — Journal de publication des règles : chaque publication de version,
-- activation ou coupe-circuit par producteur est TRACÉE (qui, quand, quoi).
-- Aucune édition opaque de solde : ce journal ne touche jamais aux journaux
-- économiques ; l'activation reste une décision journalisée et auditée.
CREATE TABLE IF NOT EXISTS public.progression_rule_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  action text NOT NULL DEFAULT '*',
  operation text NOT NULL CHECK (operation IN ('publish', 'activate', 'deactivate')),
  published_by uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.progression_rule_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.progression_rule_publications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.progression_rule_publications TO service_role;
