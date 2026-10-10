-- ============================================================================
-- REMÉDIATION SÉCURITÉ — invalidation des comptes de démonstration seedés avec
-- des mots de passe FIXES et publiquement lisibles dans l'historique du dépôt
-- (5 migrations de seed : 20260713130000, 140000, 150000, 160000, 170000).
--
-- FAITS PRODUCTION (lecture seule, 2026-10-09) :
--   • 18 comptes sur les 31 emails existent en production (projet icxyvwzfjbflcbqukpfz) :
--     — 10 comptes @kitduvoyageur.fr créés janv.–juil. 2026 (seed 20260713170000) ;
--     — 8 comptes @email.fr créés le 2026-08-25 (application tardive des seeds) ;
--     — last_sign_in_at = null pour tous (aucune connexion connue).
--   • REMÉDIATION DÉJÀ EXÉCUTÉE en production le 2026-10-09 via l'API admin :
--     mots de passe remplacés par des valeurs aléatoires (non conservées) et
--     comptes bannis (ban_duration 876000h, vérifié par relecture admin).
--
-- Cette migration reste la ceinture-bretelles côté base (idempotente) :
-- ferme l'authentification par mot de passe (`encrypted_password = '!'`).
--   • AUCUNE suppression de donnée : profils, clubs, avis et contenus de démo
--     référencés par ces UUID restent intacts.
--   • Garde-fou : seules les lignes créées avant le 2026-09-12 (cutoff prod
--     constaté) sont touchées, et JAMAIS un compte administrateur plateforme —
--     un compte réel créé plus tard avec l'un de ces emails n'est pas affecté.
--   • Idempotente : les lignes déjà invalidées ne sont pas réécrites.
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
     AND created_at < timestamptz '2026-09-12'
     AND encrypted_password IS DISTINCT FROM '!'
     AND NOT EXISTS (
       SELECT 1 FROM public.user_profiles p
       WHERE p.id = auth.users.id AND p.role = 'admin'
     );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'invalidate_seed_credentials: % compte(s) de démonstration fermé(s)', affected;
END $$;
