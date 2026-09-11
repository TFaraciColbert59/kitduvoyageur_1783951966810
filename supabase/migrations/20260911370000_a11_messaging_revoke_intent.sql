-- ============================================================================
-- A11 — Réapplication des révocations d'exécution messagerie (drift prod).
--
-- Constat (Étape 0-B, pgTAP messaging_security sur base baseline) : sur la
-- production, `anon` peut exécuter `is_conversation_member` et
-- `get_or_create_direct_conversation` ; l'intention du dépôt
-- (20260830000000 §73, 20260831000000 §267) est : PUBLIC et anon révoqués,
-- authenticated seul autorisé. Les GRANTs ayant été perdus/élargis en prod,
-- cette migration post-baseline réapplique l'intention. Idempotente.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_conversation_member(uuid, uuid) IS
  'A11 — EXECUTE : authenticated uniquement (anon/PUBLIC révoqués, intention dépôt 20260830).';
COMMENT ON FUNCTION public.get_or_create_direct_conversation(uuid) IS
  'A11 — EXECUTE : authenticated uniquement (anon/PUBLIC révoqués, intention dépôt 20260831).';
