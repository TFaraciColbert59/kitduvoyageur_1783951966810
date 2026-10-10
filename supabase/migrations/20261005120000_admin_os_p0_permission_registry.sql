-- ============================================================================
-- ADMIN OS P0-01 — Registre permissions étendu : seeds idempotents.
-- DOWN: DELETE FROM public.permissions WHERE code IN (...liste ci-dessous...)
--       (ne supprime que les codes ajoutés ici, jamais les 13 seeds P1).
-- Idempotent : ON CONFLICT (code) DO NOTHING.
-- Mapping rôles : super_admin hérite tout via role_permissions existant ;
-- on attache explicitement les nouvelles clés sensibles aux rôles.
-- ============================================================================

INSERT INTO public.permissions (code, resource, action) VALUES
  ('admin.access', 'admin', 'access'),
  ('users.profile.read', 'users.profile', 'read'),
  ('users.pii.reveal', 'users.pii', 'reveal'),
  ('support.ticket.assign', 'support.ticket', 'assign'),
  ('commerce.refund.request', 'commerce.refund', 'request'),
  ('commerce.refund.approve', 'commerce.refund', 'approve'),
  ('marketplace.listing.restrict', 'marketplace.listing', 'restrict'),
  ('trust.case.decide', 'trust.case', 'decide'),
  ('features.flag.update', 'features.flag', 'update'),
  ('ai.prompt.promote', 'ai.prompt', 'promote'),
  ('ops.job.retry', 'ops.job', 'retry'),
  ('audit.export.create', 'audit.export', 'create'),
  ('trips.read', 'trips', 'read'),
  ('geo.read', 'geo', 'read'),
  ('countries.read', 'countries', 'read'),
  ('access.elevate', 'access', 'elevate')
ON CONFLICT (code) DO NOTHING;

-- Attachement rôles (idempotent) :
-- super_admin : toutes les nouvelles clés.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'super_admin'
  AND p.code IN (
    'admin.access', 'users.profile.read', 'users.pii.reveal',
    'support.ticket.assign', 'commerce.refund.request', 'commerce.refund.approve',
    'marketplace.listing.restrict', 'trust.case.decide', 'features.flag.update',
    'ai.prompt.promote', 'ops.job.retry', 'audit.export.create',
    'trips.read', 'geo.read', 'countries.read', 'access.elevate'
  )
ON CONFLICT DO NOTHING;

-- admin : lecture + opérationnel courant, hors grants/approbations critiques.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
  AND p.code IN (
    'admin.access', 'users.profile.read',
    'support.ticket.assign', 'commerce.refund.request',
    'marketplace.listing.restrict', 'features.flag.update',
    'ops.job.retry', 'audit.export.create',
    'trips.read', 'geo.read', 'countries.read', 'access.elevate'
  )
ON CONFLICT DO NOTHING;

-- moderateur : lecture + assignation, sans PII/finance.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'moderateur'
  AND p.code IN ('admin.access', 'users.profile.read', 'support.ticket.assign')
ON CONFLICT DO NOTHING;
