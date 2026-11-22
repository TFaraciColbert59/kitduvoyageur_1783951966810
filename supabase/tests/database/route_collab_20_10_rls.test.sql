BEGIN;
SELECT plan(9);

-- Vérifie la présence des tables et fonctions de la migration 20261118120000_route_collab_20_10.sql
SELECT has_table('public', 'route_workspaces', 'table route_workspaces existe');
SELECT has_table('public', 'route_workspace_members', 'table route_workspace_members existe');
SELECT has_table('public', 'route_points', 'table route_points existe');
SELECT has_table('public', 'route_sections', 'table route_sections existe');
SELECT has_table('public', 'route_stages', 'table route_stages existe');
SELECT has_table('public', 'route_operations', 'table route_operations existe');
SELECT has_table('public', 'route_revisions', 'table route_revisions existe');
SELECT has_function('public', 'apply_route_operation_tx', 'RPC transactionnelle apply_route_operation_tx existe');
SELECT has_function('public', 'publish_route_revision_tx', 'RPC transactionnelle publish_route_revision_tx existe');

SELECT * FROM finish();
ROLLBACK;
