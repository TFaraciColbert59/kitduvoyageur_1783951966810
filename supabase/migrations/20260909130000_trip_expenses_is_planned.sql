-- LKDV — Budget : dépenses prévues (planned) vs réelles (real)
-- is_planned = true → dépense prévisionnelle datée, exclue des totaux/balances
-- is_planned = false (défaut) → dépense réelle, comptes parfaits comme avant

ALTER TABLE public.trip_expenses
  ADD COLUMN IF NOT EXISTS is_planned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_trip_expenses_planned
  ON public.trip_expenses (trip_id, is_planned, expense_date);
