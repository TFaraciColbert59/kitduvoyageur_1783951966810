-- Rollback de 20261112123000 (A03/S1.15 — persistance des imports de trace).
--
-- Le retour arrière retire uniquement la provenance et la RPC de déduplication.
-- Les sorties `hike_sessions` déjà créées ne sont PAS supprimées : ce sont des
-- données utilisateur privées, pas des artefacts de migration. Une fois la
-- table `trace_imports` retirée, les imports suivants reviennent au contrôle
-- historique `(user_id, started_at)` de la route.
--
-- Aucune requête réseau, aucune donnée distante.

begin;

drop function if exists public.record_trace_import(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid
);

drop table if exists public.trace_imports;

commit;
