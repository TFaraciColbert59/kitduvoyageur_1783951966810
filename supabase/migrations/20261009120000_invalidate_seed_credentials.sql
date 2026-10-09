-- ============================================================================
-- REMÉDIATION SÉCURITÉ — invalidation des comptes de démonstration seedés avec
-- des mots de passe FIXES et publiquement lisibles dans l'historique du dépôt
-- (5 migrations de seed : 20260713130000, 140000, 150000, 160000, 170000).
--
-- Portée : ferme UNIQUEMENT l'authentification par mot de passe de ces comptes
-- (`encrypted_password = '!'`, convention GoTrue d'un hash invalide).
--   • AUCUNE suppression de donnée : profils, clubs, avis et contenus de démo
--     référencés par ces UUID restent intacts.
--   • Garde-fou temporel : seules les lignes créées avant le 2026-08-01
--     (période des seeds) sont touchées — un compte réel créé plus tard avec
--     l'un de ces emails n'est jamais affecté.
--   • Idempotente : les lignes déjà invalidées ne sont pas réécrites.
--   • Exécution production : décision humaine D1 (SCOPE.md) — ce fichier est
--     préparé localement, il n'est PAS appliqué au projet distant.
-- ============================================================================

DO $$
DECLARE
  seed_emails text[] := ARRAY[
    'alice.perrin@email.fr',
    'antoine.moreau@email.fr',
    'camille.leroy@email.fr',
    'clara.fontaine@email.fr',
    'emma.fontaine@email.fr',
    'emma.henry@email.fr',
    'felix.dumont@email.fr',
    'hugo.renard@email.fr',
    'ines.chevalier@email.fr',
    'julie.simon@email.fr',
    'lea.roux@email.fr',
    'lucas.petit@email.fr',
    'manon.girard@email.fr',
    'marie.dupont@email.fr',
    'maxime.garcia@email.fr',
    'nicolas.blanc@email.fr',
    'pierre.lambert@email.fr',
    'romain.leblanc@email.fr',
    'sophie.bernard@email.fr',
    'theo.marceau@email.fr',
    'thomas.martin@email.fr',
    'antoine.moreau@kitduvoyageur.fr',
    'camille.leroy@kitduvoyageur.fr',
    'julie.simon@kitduvoyageur.fr',
    'lea.rousseau@kitduvoyageur.fr',
    'lucas.petit@kitduvoyageur.fr',
    'marie.dupont@kitduvoyageur.fr',
    'maxime.garcia@kitduvoyageur.fr',
    'pierre.lambert@kitduvoyageur.fr',
    'sophie.bernard@kitduvoyageur.fr',
    'thomas.martin@kitduvoyageur.fr'
  ];
  affected integer := 0;
BEGIN
  UPDATE auth.users
     SET encrypted_password = '!',
         updated_at = now()
   WHERE email = ANY (seed_emails)
     AND created_at < timestamptz '2026-08-01'
     AND encrypted_password IS DISTINCT FROM '!';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'invalidate_seed_credentials: % compte(s) de démonstration fermé(s)', affected;
END $$;
