-- Rollback de 20261113124000 (A03/S1.15 — métriques et séries FIT/TCX).
--
-- Le retour arrière retire la RPC versionnée, les deux tables de métriques et
-- la colonne `average_power_w` ajoutée aux tours. Il NE supprime PAS les
-- sorties `hike_sessions`, les provenances `trace_imports` ni les tours
-- `trace_import_laps` : ce sont des données utilisateur privées, pas des
-- artefacts de migration.
--
-- Les tables `trace_import_summaries` et `trace_import_samples` contiennent des
-- données utilisateur (FC, cadence, puissance, température). Leur DROP est
-- irréversible pour ces mesures : un réimport du même contenu retournera la
-- sortie existante sans les recréer. Exporter ou archiver avant un rollback de
-- production. Le DROP de `average_power_w` perd également la puissance moyenne
-- des tours déjà écrits.
--
-- Aucune requête réseau, aucune donnée distante.

begin;

drop function if exists public.record_trace_import_with_metrics(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid, jsonb, jsonb, jsonb
);

drop table if exists public.trace_import_samples;
drop table if exists public.trace_import_summaries;

alter table public.trace_import_laps
  drop constraint if exists trace_import_laps_average_power_check;

alter table public.trace_import_laps
  drop column if exists average_power_w;

commit;
