-- ═══════════════════════════════════════════════════════════════════════════
-- LKDV Control — M03/M13 : 144 commandes, drapeaux conformes au catalogue,
-- fonctions présentes, droits corrects.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL search_path = public;
SELECT plan(12);

SELECT is((SELECT count(*) FROM admin.commands), 144::bigint,
  'le registre contient exactement 144 commandes');

SELECT is((SELECT count(DISTINCT id) FROM admin.commands), 144::bigint,
  'les identifiants ACT- sont uniques');
SELECT is((SELECT count(DISTINCT command) FROM admin.commands), 144::bigint,
  'les noms de commande sont uniques');

SELECT is((SELECT count(*) FROM admin.commands WHERE pole_code IS NULL), 0::bigint,
  'chaque commande a un pôle');
SELECT is((SELECT count(*) FROM admin.commands WHERE id !~ '^ACT-[0-9]{3}$'), 0::bigint,
  'tous les identifiants respectent ACT-nnn');

-- Drapeaux : contrôles ciblés sur des lignes vérifiables dans le catalogue.
SELECT is((SELECT needs_validation FROM admin.commands WHERE id = 'ACT-085'), true,
  'ACT-085 order_refund : deux personnes');
SELECT is((SELECT reason_required FROM admin.commands WHERE id = 'ACT-005'), true,
  'ACT-005 member_ban : motif obligatoire');
SELECT is((SELECT agent_allowed FROM admin.commands WHERE id = 'ACT-001'), 'read',
  'ACT-001 member_view_360 : agent en lecture');
SELECT is((SELECT undoable FROM admin.commands WHERE id = 'ACT-016'), true,
  'ACT-016 post_hide : annulable 10 s');
SELECT is((SELECT role_min FROM admin.commands WHERE id = 'ACT-009'), 'super_admin',
  'ACT-009 member_set_staff_role : super admin seulement');
SELECT is((SELECT count(*) FROM admin.commands WHERE realtime NOT IN ('P1','P2','P3')), 0::bigint,
  'chaque commande a une priorité temps réel valide');

-- Les 144 fonctions existent et ne sont pas exécutables par anon.
SELECT is((
  SELECT count(*) FROM admin.commands c
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'admin' AND p.proname = 'cmd_' || c.command
        AND has_function_privilege('anon', p.oid, 'execute') = false
        AND has_function_privilege('authenticated', p.oid, 'execute')
   )
), 0::bigint, 'les 144 fonctions admin.cmd_* existent, exécutables par authenticated et refusées à anon');

SELECT * FROM finish();
ROLLBACK;
