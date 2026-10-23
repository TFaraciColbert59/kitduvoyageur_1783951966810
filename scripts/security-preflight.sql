-- Audit lecture seule. Faire tourner sur le BON environnement confirme.
BEGIN READ ONLY;
SELECT current_database(),current_user,version();
SELECT table_name,column_name,udt_name,is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN('shop_products','gear_items','kit_reports','materiel_kits')
 ORDER BY table_name,ordinal_position;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
 WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN('r','p');
SELECT n.nspname,p.proname,p.prosecdef,p.proconfig
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' ORDER BY p.proname;
SELECT extname,extversion,n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace;
ROLLBACK;
