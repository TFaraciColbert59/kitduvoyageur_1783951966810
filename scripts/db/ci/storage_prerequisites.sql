-- ============================================================================
-- Objets du schéma `storage` présents en production, absents de la baseline.
-- ----------------------------------------------------------------------------
-- La baseline (`supabase/baseline/prod_schema_20260911.sql`) est un dump du seul
-- schéma `public`. Les migrations d'avant la coupure (ledger de 143 versions)
-- ne sont pas rejouées ; or une migration postérieure
-- (`20260925010000_messaging_rls_auth_initplan.sql`) vérifie que les trois
-- politiques de pièces jointes de la messagerie existent sur `storage.objects`
-- avant de les réécrire. Ce fichier les recrée, À L'IDENTIQUE de
-- `20260831000000_messaging_system_canonical.sql` (lignes 410 à 447).
-- Si cette migration change, ce fichier doit changer avec elle.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'application/pdf', 'text/plain']
)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "storage_select_message_attachments" on storage.objects;
create policy "storage_select_message_attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.is_conversation_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists "storage_insert_message_attachments" on storage.objects;
create policy "storage_insert_message_attachments" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[2]::uuid = auth.uid()
    and public.is_conversation_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists "storage_delete_message_attachments" on storage.objects;
create policy "storage_delete_message_attachments" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[2]::uuid = auth.uid()
  );
