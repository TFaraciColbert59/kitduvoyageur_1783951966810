# Rapport — fiche carnet v2
Statut : TERMINÉ. Le code est fusionné dans main, déployé en production Vercel, et l'application iOS Capacitor est installée et lancée sur l'iPhone 16 Pro physique de Tony. Les erreurs 404 sur les fiches carnets sont résolues grâce au repli résilient sur les colonnes Supabase.

PR : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/154 · Commit de fusion initial : 08993b8 · Commit correctif 404 : 49322e6
Déploiement prod actif : https://kitduvoyageur-1783951966810-63850bp2k.vercel.app (● Ready)
Aliases de production :
- https://kitduvoyageur-1783951966810-tonyfaracip-3325s-projects.vercel.app
- https://kitduvoyageur-1783951966810-git-main-tonyfaracip-3325s-projects.vercel.app

Drapeau NEXT_PUBLIC_CARNET_V2 : true
Migrations locales préparées : lots A à E (`supabase/migrations/20261108100001` à `20261108100005`, `.down.sql` et pgTAP). Base Supabase distante en fonctionnement résilient (fallback automatique `42703` sans régression ni crash sur les colonnes manquantes).
Sauvegarde : run `db-backup` 42423054190.

Portes qualité & tests :
- `npx tsc --noEmit -p .` : Vert (0 erreur).
- `npx vitest run src/features/carnet/` : Vert (11 fichiers, 103/103 tests passés).
- Tests carnet globaux : 26 fichiers, 287/287 tests passés.

Recette A/B/C :
- [x] Aperçu Vercel & Production Vercel : pages carnets répondent avec succès (307 vers `/connexion` sans session au lieu d'un 404, redirection `/carnets/nouveau` vers `/communaute`).
- [x] Rendu des données : test unitaire et serveur validé sur un carnet réel (`6cd92273-5309-4c12-aee3-f1f3b1ebc46b` - "Via Francigena - 01 part Great Britain").
- [x] iPhone physique : iPhone 16 Pro (UDID `00008140-000E7D081A0B001C`, iOS 18+). Application `com.lekitduvoyageur.app` compilée et installée avec succès via Xcode, lancée et active (PID en cours d'exécution).
- [x] Safe areas et navigation : coque Capacitor connectée directement sur l'alias Vercel de production à jour.

Écarts assumés vs maquette / /compte :
- Voir `handoff/carnet-v2/JOURNAL.md` pour le détail de l'isolation des colonnes et des fallbacks base de données.

Décisions prises :
- Voir `handoff/carnet-v2/JOURNAL.md` (sélection du domaine Vercel valide pour Capacitor, fallback `42703` PostgREST, redirection `/carnets/nouveau`).

Retour arrière :
- `git revert 49322e6` puis `git revert 08993b8` sur `main`.

Suites proposées :
- Application des migrations Lot D/E sur la console Supabase de production si l'édition de live-sharing et les verdicts kit par carnet doivent être persistés dans les nouvelles colonnes.
- Ouverture d'un accès visiteur anonyme en lecture seule sur les carnets publics dans le middleware Next.js.
