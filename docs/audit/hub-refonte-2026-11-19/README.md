# Refonte du Hub LKDV

Le chantier couvre le voyage depuis sa préparation dans Compas jusqu’au retour. Le brief du
19 novembre et son classeur restent les références pour le périmètre, les dépendances et les
critères de recette. Les statuts ci-dessous décrivent l’état constaté sur la branche.

- Branche locale : `chantier/hub-refonte-2026-11`.
- Base : `991244a2473404445dbfb03441879b92849182e4`, vérifiée sur `origin/main` le 19 novembre 2026.
  GitHub confirme que la branche `main` est protégée.
- Audit initial : `7d7ceabd9aa5a9d6959279b9961582a7466f0cbd`. Les trois commits d’écart portent sur
  l’Explorer de la communauté. `git diff --name-only 7d7ceabd..991244a` ne liste aucune modification
  du Hub, de Compas ou des migrations.
- Reprise du 19 novembre : branche rebasée sur `788586d18eb9ed4b9afe36410bb65a16c6ddc798`.
  Les cinq commits ajoutés depuis la mesure initiale ne touchent que le fil Communauté.
- Production servie sur `koosmoweb.fr` : build READY de `3230f88`, vérifié par
  `vercel inspect koosmoweb.fr --logs`. Le dernier build de `main`, `991244a`, a échoué.
  [Déploiement en échec](https://kitduvoyageur-1783951966810-pgp6vj5d8.vercel.app).
- Next.js 15.5.25 d’après `package-lock.json`. CI Node 22, projet Vercel Node 24.x d’après
  `vercel project inspect kitduvoyageur-1783951966810`.
- Supabase : `lekitduvoyageur2`, Paris (`eu-west-3`), PostgreSQL 17.6, PostGIS 3.3.7. Le compte
  connecté expose ce seul projet, avec la seule branche `main`. Les lectures ont porté sur les
  métadonnées du projet, le catalogue SQL et le registre des migrations.
- Les deux SHA recensent 467 fichiers SQL dans `supabase/migrations`. Le lecteur du registre
  retient les 460 fichiers avec un préfixe de version à 14 chiffres. Sept fichiers Explorer v2
  utilisent un préfixe à huit chiffres. Le rapport conserve ces sept fichiers à part du résultat
  du lecteur.

## P00 · Référence et environnement

| ID | État | Résultat ou condition de validation |
| --- | --- | --- |
| P00-01 | Vérifié | Références Git, Vercel et PostgreSQL établies. Branche isolée créée. Voir les références en tête du dossier. |
| P00-02 | En cours | Le seul projet Supabase accessible est la production. Les fichiers de lien CLI ont été retirés de la branche. Le build local utilise une URL de boucle locale et un identifiant factice. La VM Debian dédiée a exécuté le rejeu SQL et pgTAP sur la boucle locale, avec le dépôt monté en lecture seule. La destination Supabase de Preview et la recette connectée complète restent à vérifier. |
| P00-03 | En cours | Les logs Vercel de `991244a` confirment un worker tué par SIGKILL avec événement OOM sur 2 cœurs et 8 Go. Rejeu macOS mesuré ci-dessous. Une mesure sur Linux à capacité équivalente reste nécessaire. |
| P00-04 | En cours | Next utilise la racine du checkout pour les traces et Turbopack. Un build local complet a réussi. Le Studio est déjà chargé dynamiquement côté client, mais sa donnée est résolue au chargement de la page Hub. Mesurer la marge par trois builds à ressources comparables à Vercel. |
| P00-05 | En cours | Installation verrouillée sur Node 22.23.3 et npm 11.19.1. Tests Hub/Compas rétablis. Typage global vert sur Node 24.22.3. La suite Communauté ciblée signale encore des échecs présents sur la référence. |
| P00-06 | En cours | Les variables Supabase sont déclarées conjointement pour Production, Preview et Development dans les métadonnées Vercel. La destination effective de Preview reste à confirmer. Matrice par widget et vérification des fournisseurs à poursuivre en recette. |
| P00-07 | En cours | Le tracer SSR existe déjà (`src/lib/perf/ssrTrace.ts`). Établir la mesure de départ sur les parcours authentifiés en recette. |
| P00-08 | En cours | Sauvegarde et restauration réussies sur la base locale de recette. Le dernier passage de la chaîne distante est vert avec le dump et la publication d’artefact ignorés. Aucun artefact associé. La rétention configurée est de 7 jours. Vérifier une sauvegarde exploitable et mesurer le RPO/RTO de production séparément. |
| P00-09 | En cours | Build et restauration locale acquis. Les 1 926 assertions pgTAP passent après rétablissement des gardes de confidentialité. La recette authentifiée, les échecs historiques de la suite Communauté, la référence de performance et le contrôle de restauration de la sauvegarde distante restent ouverts. |

### Rejeu initial

```sh
npm ci --no-audit --no-fund
npm test -- src/features/hub/__tests__ src/features/compas/__tests__ tests/hub tests/adventure-intelligence/hub-mounting.spec.ts --maxWorkers=2
```

Vitest sur `991244a` : 243 fichiers réussis sur 244, 4 781 tests réussis sur 4 786.
Les cinq échecs se trouvent dans `src/features/compas/__tests__/nativeLocalizations.test.ts`.
Les six chaînes de raccourcis ont été ajoutées au fichier Android par défaut, sans équivalent
dans les cinq locales déclarées. L’ancienne assertion limite encore les chaînes visibles au
nom de l’application et au titre de l’activité.

- **Build de référence · FAIL.** Commande Vercel `NODE_OPTIONS=--max-old-space-size=8192 next build --no-lint`
  sur le SHA de départ, Node 24.22.3, macOS arm64, 8 cœurs et 8 Gio. Compilation réussie en 90 s,
  puis échec TypeScript. Durée totale 181,6 s. Pic de somme RSS échantillonnée à 1 Hz de l’arbre
  de processus : 2 085 488 Kio (environ 2 Gio). Cette mesure compte les pages partagées par
  processus et diffère du compteur mémoire du conteneur Vercel. Le manque de mémoire est
  établi par les logs Vercel, tandis que la mesure locale établit un second blocage du build.
- **TypeScript · FAIL.** Le commit `b7260803` avait retiré le banc Compas et la fixture Communauté
  toujours importés. Restauration depuis son parent `10a71a0c`, avec contrôle local de
  `DATABASE_URL` à l’entrée du banc Compas. Le contrat du moteur carte correspond désormais aux
  méthodes réellement utilisées. `npm run type-check` a encore signalé 59 diagnostics,
  dans les contrats Carnet et Communauté (création, Explorer, fil et fixtures).
  [CI de référence](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/44497010870).
- **TypeScript après correction · PASS.** Le merge `ce9d4cf5` avait ramené trois composants
  Carnet à des contrats incompatibles avec l’écran qui les monte. Leurs versions de
  `3230f88b` ont été réconciliées avec les changements ultérieurs. Les formulaires, le fil et
  Explorer utilisent les contrats actuels pour les actions désactivées, les moments et les kits.
  `npm run type-check` passe sous Node 24.22.3.
- **Suite Carnet et Communauté · FAIL.** 313 tests passent sur 337 après correction. Sur les
  mêmes fichiers et la même chaîne locale, la référence avant correction avait 54 échecs.
  Les 24 échecs restants figurent tous parmi ces 54. Les 30 corrections couvrent surtout le
  montage, l’édition et les tiroirs du Carnet.
- **Vitest ciblé · PASS.** 244 fichiers et 4 786 tests réussis après ajout des libellés de
  raccourcis Android dans les cinq locales et vérification des références de `shortcuts.xml`.
  Les assertions lisent les ressources. Le rendu Android reste à tester sur appareil.
- **Lint des correctifs et découverte Playwright · PASS.** ESLint ciblé vert.
  `playwright test --config=playwright.compas.config.ts --list` découvre les deux tests.
  L’exécution E2E avec PostgREST et PostgreSQL reste à faire.
- **Sauvegarde · preuve incomplète.** Le run s’est terminé sans client PostgreSQL, sans dump
  chiffré et sans artefact. [Exécution GitHub](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/44506340250).

### Recette PostgreSQL locale

- Lima 2.3.0, Debian 13 aarch64, PostgreSQL 17.12 et PostGIS 3.5.2. La base
  `lkdv_hub_ci` écoute sur la boucle locale de la VM. Le worktree est monté en lecture seule.
  Le rejeu utilise un schéma de référence versionné et des données de test, avec les rôles
  et dépendances simulés par `scripts/db/ci/supabase_shim.sql`.
- **Rejeu · PASS.** `bash scripts/db/ci/install.sh` a appliqué 310 migrations après la base de
  référence, avec 467 entrées finales et zéro migration en attente. Quatre correctifs historiques
  déjà présents ont été annulés proprement et enregistrés conformément au script.
- **pgTAP · FAIL.** `bash scripts/db/ci/run_pgtap.sh` a exécuté 1 926 assertions dans 115 fichiers.
  Il reste sept échecs. Six concernent les médias et aperçus des posts à audience restreinte après
  le retrait du garde SQL dans `20261117103000_communaute_v2_creation_fixes.sql`. Un concerne la
  lecture brute de `hike_sessions` après l’ajout de deux politiques dans la migration P01.
  Ces résultats portent sur le schéma local et ses fixtures. Il faut réconcilier les contrats
  d’accès avec la lecture de traces projetées et les médias privés avant validation.
- **Restauration locale · PASS.** Un export `pg_dump -Fc` de la base de recette (3,7 Mio)
  a été restauré dans `lkdv_hub_restore`. Le contrôle retrouve le témoin synthétique,
  384 tables publiques et 467 entrées du registre dans les deux bases. La planification
  `pg_cron` a été exclue de la restauration de recette. Temps observés de 0,7 s pour
  l’export et 2,4 s pour la restauration. La sauvegarde distante et ses délais restent
  à vérifier.
- **Build local après rebase · FAIL.** `npm run build` avec Node 24.22.3, lint activé,
  un plafond de heap de 5 Gio et la VM locale allumée. Les scripts de préparation ont passé.
  Le worker Next s’est arrêté sur SIGKILL en compilation. Durée mesurée de 231 s,
  pic de somme RSS de 2 231 504 Kio. Le garde du profileur n’a pas déclenché.
  Le dépassement mémoire n’a pas été confirmé sur ce rejeu local.
- **Rejeu VM arrêtée · FAIL.** La compilation a terminé en 61 s. Deux erreurs de lint bloquaient
  le build. Le script de nettoyage du service worker en développement utilise maintenant
  `next/script` avec `beforeInteractive`. Le composant Trace garde un ordre stable de hooks,
  y compris lorsque la trace est invisible. ESLint passe sur les deux fichiers et la suite
  `outingsPrivacyUi.test.tsx` passe (2 assertions).
- **Build après correction · PASS.** `npm run build` sous Node 24.22.3, avec lint et typage,
  Supabase configuré vers la boucle locale, plafond de heap de 5 Gio, `CIRCLE_NODE_TOTAL=2`,
  cache réutilisé et VM arrêtée. Durée de 164 s et pic de somme RSS de 1 893 120 Kio.
  Les avertissements de lint existants restent visibles. Ce résultat local ne remplace pas le
  contrôle sur le runner Vercel.
- **Smoke HTTP sans session · PASS.** Sur le build servi avec `next start` en local,
  `/hub` et `/compas` répondent 307 vers `/connexion` avec le chemin de retour attendu.
  `/kit-studio` et `/connexion` répondent 200. Les parcours authentifiés restent à vérifier.

## P01 · Constat de registre

L’API de métadonnées Supabase a retourné 422 versions. Le catalogue montre que le registre ne
contient ni `20261114120000`, ni `20261114120001`, ni de ligne portant le nom de l’un des deux
fichiers en collision. Les objets principaux des deux fichiers sont absents en production
(préférences sportives et leur exposition dans la vue, tables de confidentialité, visibilité
par défaut et politiques nommées de sessions). La contrainte de visibilité accepte déjà
`collective_anonymized`. La preuve porte sur ces objets, pas sur l’équivalence complète du DDL.

La branche attribue `20261114120001` au fichier de confidentialité `p01_privacy_zones_and_visibility`
et conserve l’ordre G01 puis P01. Le diff Git indique un renommage à 100 %. La suite
`tests/ops/migrationsAlignment.spec.ts` et `tests/ops/migrationVersions.spec.ts` passe (5 tests).

`node scripts/db/migrations-alignment.mjs <export CSV du registre>` rapporte 386 versions
alignées, neuf correspondances par nom à une autre version, 65 fichiers sans correspondance
et 27 entrées du registre sans correspondance. Ce résultat classe des versions et des noms.
La comparaison des définitions et le rejeu en recette restent ouverts.

### Confidentialité vérifiée en recette

La migration additive `20261119142048_restore_hub_privacy_guards.sql` a été appliquée
uniquement à `lkdv_hub_ci` dans la VM. Les politiques de lecture des lignes GPS brutes
restent limitées au propriétaire et aux participants. Les autres lecteurs passent par
le partage projeté du carnet. Le garde rétabli refuse les médias et aperçus publics
sur les audiences restreintes. Le formulaire présente la même contrainte et le RPC
renvoie une erreur métier. La lecture privée de médias pour ces audiences reste à raccorder.

**pgTAP PASS.** Les 115 fichiers et 1 926 assertions passent. Les rôles `anon`,
`authenticated` et `service_role` n’ont pas le droit d’appeler directement le RPC interne.

## P06–P07 · Cockpit et aperçu iPhone

- `/hub` utilise le nouveau cockpit par défaut. Les widgets lisent la projection du chargeur
  `getHubAdventureData`, commun à Compas. Les actions de gestion ouvrent les sections
  existantes du voyage. Kit Studio a une entrée distincte. La variable serveur
  `LKDV_HUB_LAYOUT=legacy` permet de rétablir l’ancien affichage au redémarrage.
- Le bloc de présentation a été retiré à la demande de Tony. Les widgets Météo et Budget
  sont en tête. Le sélecteur d’aventure est accessible depuis le bas de l’écran réel.
  Étapes garde le jour et permet de consulter le détail d’un point. Une aventure en solo
  et une aventure collective ont des états séparés. Les comptes sans voyage trouvent l’accès
  Compas et le choix d’aventure, sans grille de huit cartes vides.
- Les tiroirs s’ouvrent à 90 % de la hauteur visible. La vérification Chromium au format iPhone
  couvre les huit tiroirs, le lien direct, le retour, le jour, le brouillon photo, les groupes de
  trois et l’absence de débordement horizontal. Rendu de la version compacte vérifié dans Safari
  sur simulateur iPhone 18 Pro. L’iPhone physique connu est indisponible pour une installation.
- La route `/recette-hub` nécessite `LKDV_HUB_RECETTE=1`. Le même composant React alimente
  une page autonome servie depuis le Mac sur le réseau local. Le voyage de recette est fictif.
  L’aperçu, le QR code et la capture Safari se trouvent dans le dossier de livraison iPhone.
- La carte du cockpit affiche le tracé enregistré et les repères, avec un lien vers la carte
  interactive du voyage réel. Le brouillon photo est conservé dans l’onglet. La recette
  authentifiée, la persistance des brouillons, le hors-ligne complet, la progression du groupe
  et les tests terrain sur appareil physique restent ouverts.
- La compilation de l’aperçu autonome, ESLint ciblé et 19 tests Vitest ciblés passent.
  Le build Next complet de cette livraison a été interrompu par le garde disque du profileur.
  Il doit être rejoué avec l’espace nécessaire.

## Ordre d’implémentation

1. **P00–P01 · Socle.** Mesurer le build et les parcours initiaux. Comparer migrations et DDL en
   lecture seule, puis vérifier en recette les accès par acteur et les migrations additives.
2. **P02–P05 · Données et terrain.** Continuer à partager `getHubAdventureData` avec
   `src/features/compas/server/getCompasData.ts`. Valider l’identité canonique de l’aventure,
   la séparation prévu/réel et les révisions de tracé avant de stabiliser le résumé. Vérifier
   fournisseurs, suivi et reprise hors ligne. Évaluer Rust après profilage et parité TypeScript.
3. **P06–P07 · Cockpit.** Intégrer une grille mobile en gardant le menu de l’application et l’accès
   dédié au Kit Studio. Donner le même poids à Météo et Budget. Afficher la carte et les étapes
   avec une indication de jour, puis Carnet, Kit, Paperasse et Groupe. Utiliser un tiroir partagé
   de 90 % du viewport avec retour, restauration du focus et respect de la réduction des animations.
   Brancher les actions sur les contrats existants, avec des états explicites pour donnée vide,
   dépassée, indisponible ou privée.
4. **P08–P09 · Parcours complet.** Tester départ, activité, arrivée et retour, en ligne et hors ligne.
   Couvrir les voyages de 2 h à 30 j, les rôles, la concurrence et les appareils réels. Remplir la
   preuve par ID après chaque vérification. Préparer la livraison réversible après les cinq passes.
