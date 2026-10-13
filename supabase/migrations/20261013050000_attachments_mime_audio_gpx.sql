-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-007 — MIME audio et GPX autorisés sur message-attachments
-- Chantier communauté (audit 2026-10-12) — P0 formats du composeur
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-007, statuts C + D) : le recorder produit audio/webm,
-- audio/ogg ou audio/mp4 et le composeur accepte application/gpx+xml, mais la
-- liste blanche du bucket privé ne contenait ni audio ni GPX : l'upload était
-- rejeté puis remplacé par une URL blob locale (cf. F-006).
--
-- Correctif : compléter la liste blanche avec les formats réellement produits
-- et consommés par l'application. La taille max (25 Mio) et le caractère privé
-- du bucket sont conservés. Aucun format générique (octet-stream, zip…) n'est
-- ajouté : les formats restent explicites.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  -- existants
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'application/pdf',
  'text/plain',
  -- F-007 : notes vocales (MediaRecorder sur iOS/Android/desktop)
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  -- F-007 : traces GPX (selon navigateur : type dédié ou repli text/plain déjà autorisé)
  'application/gpx+xml',
  'application/xml'
]
WHERE id = 'message-attachments';
