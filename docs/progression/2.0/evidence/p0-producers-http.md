# P0 — Sept producteurs : intégration HTTP et SQL réelle

Contrôle exécuté le **10 octobre 2026 à 22:47 Europe/Paris** (20:47 UTC),
base de travail Git `d8aeac7e0873af4084b5749e0db772e34014ed85`, environnement
local `/workspace/kitduvoyageur_1783951966810`. Aucun accès production dans cette
tranche ; aucun moteur, hook, client Supabase, serveur SQL ou serveur Auth mocké.
La suite existante garde seulement son stub neutre `server-only` de compatibilité
Vitest ; ce stub ne remplace aucune exécution métier ou authentification.

## Résultat exécuté

Commande : `node scripts/ops/progression_v2_local_api.mjs`

Le script démarre une passerelle HTTP de transport puis exécute réellement
`tests/phase1/producers.integration.spec.ts` avec `PHASE1_PRODUCERS_E2E=1` et des
URL/clefs locales explicites : **9 tests réussis, 0 échec, 0 ignoré**, code de
sortie **0**. Durée Vitest 1,87 s ; démarrage
`2026-10-10T20:47:34.984Z`. Rapport JSON brut :
`/tmp/lkdv-v2-db/producers-http-tests.json` (fichier temporaire local, non commité).

Les tests créent deux utilisateurs via **GoTrue Admin réel**, écrivent les faits
via **PostgREST réel**, appellent les sept hooks TypeScript existants puis
vérifient décision, transaction canonique `PROGRESSION_AWARD`, absence d’impact
sur le solde économique, outbox pending, traitement SQL, événement unique et
projection permanente exactement égale aux sept transactions de l’utilisateur A.
La publication d’avis du même lieu par B produit une transaction distincte.
Les replays randonnée/préparation sont idempotents ; session non traitée,
débrief absent, carnet privé/non rattaché, checklist incomplète/vide et voyage
sans preuve sont refusés selon les règles **actuelles**, sans émission.

Après nettoyage réel de la suite, contrôle SQL sur le clone : utilisateurs
`integ-prod-…@lkdv.test` = **0**, voyages `phase1-e2e-…` = **0**, segments de
fixture = **0**, transactions `PROGRESSION_AWARD` restantes = **0**.

## Environnement et fidélité

- Container DB existant préservé : `lkdv-v2-test`, PostgreSQL/PostGIS 17.11,
  loopback `55432`. Seule la base dédiée **`lkdv_producers`** appartient à cette
  tranche ; les bases `postgres` et `lkdv_restore` ne sont pas modifiées.
- Réseau Docker existant préparé par la tranche SQL : `lkdv-v2-test-net`.
- **GoTrue officiel v2.177.0**, image de 47,1 Mo, digest
  `sha256:6a916b47af0386b7e0152ca84f3d45d050bf056e449a75a5460b48742fd67822`.
  **54 migrations Auth officielles** appliquées sur une base initialement vide.
- **PostgREST officiel v12.2.12**, image de 17,4 Mo, digest
  `sha256:5f4ce744539bbba786b4e24dbbd95bdb2a956dcf568c5374995a0ff4a68f5bd2`.
- Container `lkdv-v2-auth` : `127.0.0.1:54382`. Container `lkdv-v2-rest` :
  `127.0.0.1:54383`. Passerelle `127.0.0.1:54381`, uniquement pendant le script,
  qui relaie `/auth/v1` et `/rest/v1` vers ces services sans produire de réponse
  métier ni usurper une vérification de JWT.
- Dump schéma public/extensions + seeds de la base locale rejouée, sans données
  du snapshot production : `/tmp/lkdv-v2-db/producers-public.sql`, SHA-256
  `59560c611a3afb58ca28f5a8a627d4307bd6714959c9c86e58b6a8b066a906ad`.
  Schéma public restauré transactionnellement après Auth ; helpers
  `auth.uid/role/jwt` et deux triggers d’onboarding récupérés du schéma source.
  Les extensions publiques du schéma source sont installées identiquement.
- Le dump `--no-acl` nécessite les privilèges d’infrastructure standard
  `service_role` sur le clone. Aucune permission `anon/authenticated` n’est
  élargie par le script. Cette suite valide le chemin serveur service-role ;
  elle **ne prouve pas** les RLS inter-comptes ou un parcours login navigateur.
- Secrets JWT de fixture générés localement et persistés uniquement dans
  `/tmp/lkdv-v2-db/local-api-state.json`, mode `0600`, sans clef de production.

## Diagnostic et reprise

Deux échecs de bootstrap GoTrue ont montré qu’une base vide requiert un schéma
`auth` précréé et un search_path `auth,public,extensions` avant ses migrations.
Seuls les schémas partiels vides du **clone** ont été reconstruits pendant ce
diagnostic ; aucun container existant ni donnée réelle n’a été détruit.
Un dump initial non transactionnel a rencontré une classe d’opérateur absente ;
la restauration du script est désormais transactionnelle. La première suite
active a ensuite donné 4 succès/5 échecs : `unaccent(text)` absent du dump par
schémas empêchait la création de voyages. Installer les extensions de la base
source a corrigé l’environnement, sans changer le code métier ni les critères
de la suite. La suite suivante est entièrement verte, puis le contrôle a été
réexécuté pour enregistrer le rapport JSON brut indiqué ci-dessus.

Le script est relançable sur les containers gérés par son label et la même base
clone ; il refuse un container homonyme non géré ou une configuration différente.
Il ne crée ni ne supprime une base, ne détruit aucun container et n’utilise pas
les variables de connexion Supabase de production pour la suite. Les tentatives
de disponibilité sont bornées. Les deux containers officiels restent présents ;
la passerelle ferme après le test. Une reconstruction complète du clone requiert
la préparation DB décrite par la tranche SQL et le dump local indiqué ci-dessus.

## Limites explicites

Cette preuve porte sur les hooks actuels et leur barème historique actif local,
pas les nouvelles conditions de preuve/quotas de Progression 2.0. Elle ne valide
pas encore intention durable, planification, concurrence, panne de worker,
traitement hors ligne, navigation/mobile, production, déploiement ou activation.
L’avertissement existant Vite CommonJS/ESM est présent mais ne bloque pas la suite.
`node --check scripts/ops/progression_v2_local_api.mjs` et `git diff --check`
retournent 0. Le commit d’intégration doit être renseigné par l’orchestrateur ;
aucun commit n’a été créé par cette sous-tâche.
