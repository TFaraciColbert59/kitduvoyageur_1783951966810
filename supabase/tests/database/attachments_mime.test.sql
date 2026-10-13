BEGIN;
SELECT plan(4);

-- F-007 — formats audio et GPX acceptés par le bucket privé message-attachments.

SELECT ok(
  (SELECT allowed_mime_types @> ARRAY['audio/webm', 'audio/ogg', 'audio/mp4']::text[]
     FROM storage.buckets WHERE id = 'message-attachments'),
  '1. Les trois formats audio du recorder sont autorisés (webm, ogg, mp4)'
);

SELECT ok(
  (SELECT allowed_mime_types @> ARRAY['application/gpx+xml', 'application/xml', 'text/plain']::text[]
     FROM storage.buckets WHERE id = 'message-attachments'),
  '2. GPX (gpx+xml, xml, repli text/plain) est autorisé'
);

SELECT ok(
  (SELECT allowed_mime_types @> ARRAY['image/jpeg', 'video/mp4', 'application/pdf']::text[]
     FROM storage.buckets WHERE id = 'message-attachments'),
  '3. Les formats historiques restent autorisés (aucune régression)'
);

SELECT is(
  (SELECT (public = false AND file_size_limit = 26214400)
     FROM storage.buckets WHERE id = 'message-attachments'),
  true,
  '4. Le bucket reste privé, plafonné à 25 Mio'
);

SELECT * FROM finish();
ROLLBACK;
