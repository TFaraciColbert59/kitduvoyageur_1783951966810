-- LOT 3 : Migration expedition_reports → kit_reports
-- Suppression des politiques RLS pour expedition_reports (le code utilise déjà kit_reports)

-- Suppression des politiques existantes
DROP POLICY IF EXISTS "public_read_expedition_reports" ON public.expedition_reports;
DROP POLICY IF EXISTS "auth_insert_expedition_reports" ON public.expedition_reports;
DROP POLICY IF EXISTS "auth_manage_expedition_reports" ON public.expedition_reports;
DROP POLICY IF EXISTS "users_manage_own_reports" ON public.expedition_reports;

-- Note: La table expedition_reports reste pour préserver les données existantes
-- mais n'est plus utilisée par l'application (remplacée par kit_reports)
