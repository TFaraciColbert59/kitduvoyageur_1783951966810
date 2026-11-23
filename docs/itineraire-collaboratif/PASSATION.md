# Passation · /compas/itineraire (23/11/2026)

À lire en premier par tout agent qui reprend ce chantier (Claude, Gemini ou autre). Il est autonome : il ne suppose rien de la conversation qui l'a produit.

## Où en est le travail

- Branche : `claude/nifty-hopper-w9gui9` (dépôt `TFaraciColbert59/kitduvoyageur_1783951966810`). Toujours pousser sur cette branche. Ne pas fusionner dans `main` sans décision de Tony (voir « Blocages »).
- Plan de référence : 4 prérequis + 100 améliorations, recopiés et suivis ligne à ligne dans `docs/itineraire-collaboratif/ETAT-100.md` (statut, preuve fichier + test, reste à faire). C'est la source de vérité : ne cocher « Fait » qu'avec une preuve dans le code et un test.
- État vérifié au 23/11 : 81 Fait, 18 Partiel, 1 Non fait (10.5 Clubs). Depuis l'application de la migration, 8.3 et 8.8 sont en pratique réglés (à confirmer dans ETAT-100).
- Points d'accroche avec le reste de LKDV : `docs/itineraire-collaboratif/ACCROCHES-LKDV.md` et `INTERCONNEXION-LKDV.md`.
- Règles du dépôt : `CLAUDE.md` à la racine (règles dures : RLS, SECURITY DEFINER avec `search_path`, zod, jetons `--lkv-*`, « rien d'inventé », Vercel/Capacitor uniquement).

## Base de données

- Migration `supabase/migrations/20261118120000_route_collab_20_10.sql` : **appliquée en production** le 23/11/2026 (projet Supabase `icxyvwzfjbflcbqukpfz`, par l'éditeur SQL : elle n'est donc PAS inscrite dans `supabase_migrations.schema_migrations` ; un futur `supabase db push` voudra la rejouer — elle est idempotente, mais mieux vaut la marquer comme appliquée). Retour arrière : `supabase/migrations_down/20261118120000_route_collab_20_10.down.sql`. Test : `supabase/tests/database/route_collab_20_10_rls.test.sql` (191 assertions, à jouer sur un Postgres local avec PostGIS + pgTAP).
- Migration suivante en cours d'écriture : `supabase/migrations/20261123130000_route_collab_followups.sql` (préférences Simple/Expert par compte `user_ui_prefs`, RPC clubs `publish_club_event_route_from_workspace`, modération `admin_list_route_moderation` / `admin_apply_route_moderation`). **Non appliquée.** Avant application : relecture de sécurité indépendante, test SQL local vert, puis application. L'outil MCP Supabase demande une confirmation qui n'atteint pas toujours l'utilisateur : le plus sûr est que l'utilisateur colle le fichier dans l'éditeur SQL de Supabase, puis vérifier en base (tables en RLS, droits `anon`, conseillers de sécurité).

## Travail en cours au moment de la passation

Trois lots sur les points partiels, modifications NON commitées dans l'arbre si l'agent précédent s'est arrêté :

1. Carte et tiroir — 2.1 (moteur de `LiveMap` du Compas partagé), 2.5 (couleur des jours dans la pilule), 2.10 (tuiles du corridor dans le pack hors ligne, selon les conditions du fournisseur), 4.2 (coquille de `V5Sheet` réutilisée), 4.6 (`popstate` ferme un niveau).
2. Entrée, formats, partage — 1.1 (choisir/créer un voyage sans `?trip=`), 5.9 (décodeur FIT `insights/fit.ts`), 8.10 (envoi d'un jour dans la messagerie), 9.8 (cockpit `/randonnee-active` qui envoie version + sac), 9.10 (brouillon « Reprendre cette sortie » côté serveur, bouton du carnet vers `/compas/itineraire`), 10.9 (story et carnet).
3. Serveur et base — 4.1, 7.6 (alertes NWS et GDACS ; FIRMS exige `NASA_FIRMS_MAP_KEY`, secret de Tony), 10.5, 10.6 (transports et achats vers `trip_expenses`), 10.8 (recalcul du profil de performance après chaque sortie), 10.10 (modération appliquée).

Pour reprendre : `git status` et `git diff` montrent le travail laissé ; lire les lignes correspondantes d'ETAT-100 ; finir par petites étapes qui compilent.

## Contrôles avant chaque commit

```
npx tsc --noEmit -p .          # 19 erreurs préexistantes sur main (components/carnet, components/clubs, KitProductSheetV2, HubCockpit) : n'en ajouter aucune
npx vitest run src/features/route-collab src/app/api src/features/compas src/features/hub src/features/explorer-v2 src/features/hiking
                               # 2 échecs préexistants sur main : compas/__tests__/overpassEndpoints, explorer-v2/__tests__/n01-n02-wiring
npx eslint <fichiers modifiés> # 0 erreur
```

Ne jamais committer un test rouge (hors les deux préexistants). Message de commit en français ; ne pas mettre d'identifiant de modèle dans les commits.

## Vérification à l'écran

- `.env.local` (non versionné) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé publique du projet) et `ROUTE_COLLAB_STORE=memory` (aucune écriture en base). À recréer si absent.
- `NODE_OPTIONS=--max-old-space-size=6144 npx next dev -p 4000`, puis Playwright avec un cookie `sb-local-auth-token=x` (le middleware ne teste que la présence d'un cookie de session) sur `http://localhost:4000/compas/itineraire` : accueil → « Carte vide » → toucher la carte.

## Blocages qui ne relèvent pas du code

- Le déploiement de production Vercel de `main` échoue déjà par manque de mémoire au build (`next build` tué, SIGKILL). C'est une question d'offre Vercel : décision de Tony. Tant que ce n'est pas réglé, ne pas fusionner dans `main` pour « mettre en production ».
- `NASA_FIRMS_MAP_KEY` (feux) : secret à fournir par Tony.
