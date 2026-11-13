-- Rollback de 20261113110000 (A03/S2.05 — persistance des tours source).
--
-- Le retour arrière retire la RPC versionnée, la table des tours et la clé de
-- portée ajoutée à `trace_imports`. Il NE supprime PAS les sorties
-- `hike_sessions` ni les provenances `trace_imports` : ce sont des données
-- utilisateur privées, pas des artefacts de migration.
--
-- La table `trace_import_laps` contient des données utilisateur (tours, FC,
-- cadence, puissance). Son DROP est donc irréversible pour ces tours : les
-- imports suivants ne les restitueront plus et un réimport du même contenu
-- retournera la sortie existante sans les recréer. Exporter ou archiver avant
-- un rollback de production.
--
-- Aucune requête réseau, aucune donnée distante.

begin;

drop function if exists public.record_trace_import_with_laps(
  timestamptz, timestamptz, numeric, integer, numeric, integer, jsonb, jsonb,
  jsonb, text, text, text, text, text, integer, uuid, jsonb
);

drop table if exists public.trace_import_laps;

alter table public.trace_imports
  drop constraint if exists trace_imports_lap_scope_key;

commit;
