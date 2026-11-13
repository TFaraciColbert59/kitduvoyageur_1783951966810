-- Rollback du lot A02 — persistance du cycle de vie des activités.
--
-- La table ne contient que des surcouches produites par le lot : la supprimer
-- rend les activités à leur état source (trace brute `hike_sessions` /
-- `activity_sessions`), sans perte de la géométrie d'origine, conservée dans
-- les tables sources. Les éditions de métadonnées et les corbeilles portées
-- uniquement par la surcouche sont perdues : c'est le comportement attendu
-- d'un retour arrière, à annoncer avant exécution.

begin;

drop policy if exists activity_lifecycle_records_owner_delete on public.activity_lifecycle_records;
drop policy if exists activity_lifecycle_records_owner_update on public.activity_lifecycle_records;
drop policy if exists activity_lifecycle_records_owner_insert on public.activity_lifecycle_records;
drop policy if exists activity_lifecycle_records_owner_read on public.activity_lifecycle_records;

drop table if exists public.activity_lifecycle_records;

commit;
