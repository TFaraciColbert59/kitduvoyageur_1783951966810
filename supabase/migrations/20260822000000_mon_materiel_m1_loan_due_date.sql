-- ============================================================================
-- LKDV — Mon Matériel v3 : M1 — prêts à échéance (loan_due_date)
-- Widget « Prêts à échéance » du fullscreen Disponibilité.
-- Idempotent, aucune suppression de données, RLS conservées.
-- ============================================================================

ALTER TABLE public.gear_items
  ADD COLUMN IF NOT EXISTS loan_due_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_gear_items_loan_due_date
  ON public.gear_items(loan_due_date)
  WHERE loan_due_date IS NOT NULL;