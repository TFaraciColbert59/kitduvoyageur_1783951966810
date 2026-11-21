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
- Le cockpit emploie les mêmes primitives que le reste de LKDV, dont `Card`, `Badge`,
  `Metric`, `Icon` et `Sheet`. Le fond et le verre proviennent du thème de l’application.
  Le tracé Canvas utilise les couleurs de la banque de design. Le CSS du cockpit règle
  principalement la grille et les espacements.
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
  Après l’alignement sur LKDV, le typage du dépôt et les 42 assertions des suites du tiroir
  et des tokens passent. Dans WebKit au format iPhone, l’aperçu du réseau local a passé
  l’ouverture des huit tiroirs, le retour au bon élément, le lien direct et l’absence
  de débordement du libellé Paperasse.
  Le premier build Next complet de cette livraison a été interrompu par le garde disque
  du profileur.

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

## Reprise de la référence Communauté

Le cockpit réutilise le tiroir Explorer et Création de Communauté, sa feuille de style
et sa pastille d’identité. Les huit widgets ouvrent un contenu propre. Le détail d’une
étape est commun à la carte et à la liste de la journée. La carte utilise le fond
Leaflet de l’itinéraire. Les tronçons gardent leur séparation et les repères sont
sélectionnables. La météo affiche le point utilisé et interroge MET Norway via la route
existante avec les coordonnées GPS du visiteur, après autorisation.

Les dépenses sont ordonnées par date réelle. Les échéances de réservation ne sont
affichées que lorsqu’elles sont renseignées. Une étape qui suggère un hébergement
ou un billet sans réservation enregistrée apparaît « À vérifier ». Les profils, le
carnet, les dépenses, les documents et le kit affecté sont lus sous la session du
voyage. La scène Kits se charge à la demande et requiert une configuration enregistrée
pour le kit concerné. L’ajout de moment réutilise le formulaire Carnet. La nouvelle
migration crée un seau privé et applique les droits du carnet aux médias du HUB.

- **WebKit mobile · PASS.** Huit tiroirs et leurs détails, vrai fond de carte, repère
  vers étape, cinq étapes défilantes, liens directs et 3,5 jours visibles dans la rangée.
  Parcours d’interface réalisé sur la route locale `/recette-hub`, avec données de test.
- **Météo · PASS.** La route locale `/api/weather/point` a renvoyé des prévisions
  de MET Norway pour un point public. La position d’un iPhone reste à vérifier.
- **PostgreSQL local · PASS.** 116 suites et 1 932 assertions. Le propriétaire peut
  déposer et lire son média. Un autre utilisateur et le visiteur sont refusés.
- **Typage et tests ciblés · PASS.** 45 assertions. La suite de fondations Communauté
  signale un écart préexistant dans les couleurs de `DynamicIsland`.
- Le schéma hébergé expose les relations utilisées. Le projet Supabase accessible
  ne présente que `main`. Il reste à tester le parcours connecté complet, l’envoi
  du média et le rendu du kit affecté dans un environnement de recette authentifié.

### Tableau de bord sur écran fixe

Le tableau de bord réserve la place de la barre du bas, des zones sûres et du
panneau de consentement. Les huit widgets tiennent dans la hauteur disponible.
La liste Étapes et les rangées de pastilles gardent leur propre zone de défilement.
La tuile Météo affiche les températures et les prévisions. Le lieu et les conditions
sont consultables dans le tiroir. Le lien Sécurité est accessible depuis Groupe.

Contrôle WebKit local sur six formats, de 320 × 568 à 1280 × 800, dont un écran
en paysage. Les huit cartes restent dans la zone visible avec et sans panneau
de consentement. Le document ne défile pas. Le détail de la dernière étape et
le lieu de la prévision restent accessibles dans les tiroirs.

### Navigation du cockpit par jour

Le HUB s’ouvre sur la date locale du téléphone. Les pastilles d’Étapes
changent le jour de la carte, des étapes, du budget, du carnet et des
éléments de kit datés. Météo, Paperasse et Groupe portent sur la sortie.
La carte affiche les repères du jour et la trace lorsque les points
enregistrés permettent de la délimiter. Le budget reprend les prévisions
datées. Si seule l’enveloppe du voyage existe, elle est répartie au centime
et marquée comme estimation dans le tiroir.

La roue du carnet s’appuie sur les heures stockées et les moments du jour.
L’animation de la pastille active et le relief de la roue suivent les préférences
de mouvement. Le sélecteur de sortie ouvre le tiroir de Communauté depuis
une poignée haute de 8 px. Le changement de sortie recharge les données
via la sélection d’aventure existante.

La vérification WebKit locale couvre le changement de jour, les dépenses
sur une ligne, le retour du détail d’un moment à son heure, l’ouverture
de la recherche et le chargement du fond de carte. La recette authentifiée
avec les profils et le changement de sortie réel reste à valider sur
l’environnement de recette et sur iPhone physique.

### P02-02 · Découverte des sorties

Compas, le rail du HUB et le sélecteur de sorties partagent la même requête.
Elle retient les sorties actives ou à venir liées au compte connecté par
propriété, collaboration ou participation confirmée visible sous RLS. Elle
filtre les sorties terminées, passées et annulées. Les pages sont ordonnées
par date puis identifiant et le retour au cache du compte est conservé en cas
d’erreur de lecture du sélecteur.

Recette sur un PostgreSQL 17.12 isolé, restauré depuis la base locale de
recette en excluant pg_cron, via PostgREST 14.4 et des identités synthétiques.
Résultat pour le compte invité :

- Sortie propre, sortie privée partagée et sortie publique avec participation
  confirmée visibles. Une sortie avec deux affiliations apparaît une fois.
- Sortie publique tierce, sortie passée, sortie annulée et invitation sans
  confirmation exclues de la liste.
- 22 sorties du même jour réparties en pages de 20 puis 2 sans perte ni doublon.
- Le premier passage a confirmé que la lecture directe d’une sortie privée
  reste réservée au propriétaire et aux collaborateurs. Le lot ci-dessous
  raccorde les participants confirmés par une projection dédiée.
  P02-02 reste en cours jusqu’au rattachement des inscriptions aux sorties.

Le test `src/features/hub/__tests__/adventure-discovery.test.tsx` vérifie la
consommation de la liste serveur par le sélecteur. Typage et ESLint ciblé
passants. La suite ciblée HUB, Compas et versions SQL passe sur 249 fichiers
et 4 799 tests. Le parcours Supabase Auth de
bout en bout reste à vérifier. Les modifications et essais du lot portent sur
le worktree et la base locale de recette.

### P09-14 · Classeur de suivi

Les 187 identifiants des deux documents fournis correspondent exactement.
La copie `LKDV_Audit_Implementation_Hub_Suivi.xlsx` conserve les 11 onglets, les formules, le tableau Excel
et la validation des statuts. Les 54 lignes annotées indiquent la preuve
acquise ou la condition qui reste à vérifier. Les 133 autres conservent le
statut initial. Les seules lignes clôturées dans cette passe sont P00-01 et
P01-02. Les gates des dix phases restent à vérifier avec leurs dépendances.

### P02-02 / P02-08 · Consultation par le participant confirmé

La migration `20261119191915_confirmed_private_trip_overview.sql` expose
les sorties privées du participant confirmé et leurs étapes en lecture seule.
Elle s’appuie sur la participation de la session, avec une projection contrôlée
dans un schéma hors de l’API. Le lecteur du HUB et de Compas utilise cette
projection quand la lecture directe ne donne pas accès au voyage. La sélection
vérifie le trip.id de l’aventure. Les données de partage, les montants du
budget, les documents, les notes et les hébergements privés restent exclus.
Le registre des collaborateurs et les politiques sur les tables existantes
sont conservés. Une révocation invalide la projection dès la requête suivante.

- PostgREST 14.4 et PostgreSQL 17.12 sur la base locale isolée. Requêtes POST
  de liste et de détail, étapes enregistrées et refus du tiers confirmés.
- 117 suites pgTAP et 1 946 assertions réussies, dont 14 sur la projection.
  Lint ciblé, typage et 4 801 tests Vitest passent.
- Retour arrière SQL exécuté sur la copie locale. Le script est dans
  `supabase/migrations_down/20261119191915_confirmed_private_trip_overview.down.sql`.
- L’analyse généralisée Supabase Advisors n’a pas pu se connecter au cluster
  local via son socket Unix. Les droits de l’API, le refus de l’accès direct
  et la liste des champs retournés sont testés dans la nouvelle suite pgTAP.

P02-02 attend le rattachement des inscriptions de club et de communauté.
P02-08 attend la réconciliation des écritures de joinActivity, des invitations
et de l’historique. La recette Supabase Auth dans le navigateur reste à
faire pour l’ouverture de la sortie depuis le sélecteur.

### P02-11 · RSVP historiques de club

Les anciennes lignes de `club_event_participants` correspondent à des
réponses affirmatives du parcours Compte. Leur horodatage est porté par
`joined_at` sur le schéma de référence et par `created_at` sur le schéma
initial. Les deux formes sont acceptées. Une ligne sans date vérifiable
reste dans son registre source.

La migration `20261119193057_import_legacy_club_event_rsvp.sql` importe
les RSVP datés lorsque tous les horaires connus de la sortie sont passés.
Les autres restent lus dans leur registre historique au travers de la vue
de compatibilité. Une ligne du registre moderne prime toujours sur le RSVP,
y compris lorsque son statut est `cancelled`. Aucun enregistrement de
présence ni rapprochement avec un événement communautaire n’est déduit.

La liste de club et la fiche de sortie lisent cette vue sous les droits
de la session. Le membre voit son inscription et le gestionnaire peut
lire celles de son club. La fiche utilise l’API du club pour les sorties
de club et le RPC communautaire pour celles issues du registre communautaire.
Une annulation depuis la fiche de club est enregistrée explicitement,
même tant que le RSVP initial réside dans l’ancien registre.

**Recette locale.** Les 15 nouvelles assertions vérifient l’idempotence,
le statut et la date repris, la priorité d’une annulation, les permissions
de lecture et le retour arrière. La suite SQL complète passe avec
118 fichiers et 1 961 assertions. Les 13 tests applicatifs ciblés et le
typage passent. L’aperçu du HUB sur le réseau local répond 200.
L’ordre de livraison est la migration puis l’application. Pour revenir
en arrière, rétablir d’abord l’application, puis exécuter le script SQL
de retour. Il retire les copies intactes et conserve les inscriptions
modifiées ainsi que les RSVP sources.

P02-11 attend encore le lien entre l’événement et l’aventure. Le lot suivant
raccorde les parcours Compte, fiche et invitation à la même transaction.


### P02-11 / P09-03 · Dernière place et liste d’attente

La fiche du club, le profil Compte et l’invitation de sortie passent par la
même transaction PostgreSQL. Le verrou porte sur la sortie. Le calcul des
places inclut les inscriptions actuelles et les RSVP hérités encore en vigueur.
La confirmation, l’attente, le retrait et la promotion FIFO sont persistés
dans ce registre. Une répétition renvoie le statut enregistré. Le compteur
d’utilisation du lien est écrit dans la même transaction et aucune place
n’est confirmée à l’écran avant la réponse du serveur.

**Recette locale.** Le script
`scripts/db/ci/verify_club_event_concurrency.sh` attend deux sessions PostgreSQL
distinctes et vérifie que la seconde attend sur le verrou de la première.
Pour une seule place, la première inscription est confirmée et la seconde
est placée en attente. Le retrait promeut cette dernière et le compteur
final reste à un. 19 assertions pgTAP ciblent la transaction, dont l’attente
FIFO, le refus d’un lien sans place, l’usage unique d’une invitation répétée et
la fermeture des écritures directes. Au total, 119 suites et 1 980 assertions
PostgreSQL passent, ainsi que 98 tests applicatifs ciblés et le typage.

Le retour arrière a été exercé dans une transaction locale. Il retire le RPC,
rétablit les écritures et recalcule le compteur historique. Il conserve les
inscriptions modernes. L’ancien profil lit son propre registre après rollback
et les nouvelles lignes du registre moderne y restent invisibles jusqu’au
rétablissement de l’application actuelle. Coordonner le déploiement SQL et
applicatif, car les anciens clients écrivent directement dans les tables.

Les sections suivantes couvrent le lien à l’aventure et l’annulation.
P09-03 conserve la recette sur appareil et les scénarios de départ,
révision, dépense, kit, reprise hors ligne et notification.

### P02-01 / P02-02 / P02-11 · Relier une sortie à une aventure existante

Depuis la fiche de club ou de communauté, l’organisateur peut relier
un voyage dont il est propriétaire. Supabase enregistre la source,
son UUID, l’organisateur et le voyage canonique dans une table privée.
Les anciennes fiches disposent du même choix. Aucun rapprochement
automatique n’est fait à partir du titre, de la date ou d’un UUID
commun à deux sources. Pour une sortie de club avec tracé, la résolution
renvoie sa révision enregistrée.

Les inscrits confirmés et les anciens RSVP admissibles retrouvent
l’itinéraire dans le HUB et Compas. La fiche propose aussi de l’ouvrir
directement dans le HUB. Les inscriptions d’un même utilisateur à
plusieurs événements reliés au même voyage n’ajoutent qu’un voyage au
sélecteur. La projection privée reste limitée aux informations de
consultation. Un retrait ferme l’accès issu de cette inscription.
La liste d’attente, le blocage, le changement d’organisateur et
l’annulation côté communauté sont couverts par des tests locaux.

La recette PostgreSQL locale couvre 120 suites et 2 005 assertions,
dont 25 sur le lien et son retour arrière. Le typage et 4 782 tests
applicatifs ciblés passent. Le script de retour supprime les liaisons
et conserve les voyages, événements et inscriptions. Exécuter ce retour
avant celui de la migration des RSVP historiques.

La recette connectée a utilisé une base PostgreSQL neuve, Supabase Auth
et PostgREST. WebKit au format iPhone a confirmé la connexion par le
formulaire de l’application, la liaison depuis la fiche du club, puis
l’inscription et l’ouverture du HUB avec deux étapes issues de la base.
Le retrait de l’inscription retire le bouton d’accès. Des tuiles distantes
ont été chargées au-dessus de ces coordonnées. La fiche organisation
propose aussi les voyages terminés appartenant à l’organisateur.

L’aperçu avec données de test a été ouvert dans Safari sur l’iPhone
de Tony. Le serveur local a reçu sa demande et répondu HTTP 200.
La recette authentifiée s’est déroulée dans WebKit sur le Mac. La référence
des activités libres et le parcours Auth sur iPhone physique restent ouverts.

### P02-11 / P09-03 · Annulation d’une sortie par l’organisateur

L’organisateur confirme l’annulation depuis la fiche de club, accessible
depuis le Compte. PostgreSQL enregistre l’auteur et l’horodatage, ferme
les places et révoque les invitations dans une même transaction. La fiche
reste accessible avec l’état « Sortie annulée ». Le registre conserve
les RSVP d’origine, y compris les inscriptions en attente et les RSVP
hérités. La vue des inscriptions expose l’annulation aux lecteurs admis.

La sortie cesse de donner accès à l’itinéraire dans le HUB et Compas.
Un droit obtenu directement sur le voyage ou par un autre événement
reste applicable. La tentative d’inscription depuis une fiche ou
un drawer déjà ouvert reçoit l’état d’annulation. La recherche et
les prochains événements de Compte excluent cette sortie.

**Preuves locales.** 121 suites PostgreSQL, soit 2 030 assertions,
dont 25 sur l’annulation. Une vérification à deux connexions a observé
l’inscription attendre le verrou pris par l’annulation, puis l’a vue
refusée après validation de la transaction. La recette WebKit au
format iPhone a utilisé trois comptes Supabase Auth. Elle a vérifié
la confirmation et son abandon, la dernière place, la liste d’attente,
la fermeture du lien d’invitation et le retrait du voyage de la liste
du HUB. Elle a aussi ouvert une fiche de club historique. Les 126
tests applicatifs ciblés passent.

Les lectures de Compte et de la recherche utilisent la nouvelle colonne.
Appliquer la migration avant l’application. Le retour SQL a été exercé
avant et après une annulation. Le retour s’exécute en transaction et
l’essai avec une annulation enregistrée a refusé de retirer le mécanisme. P02-11 est vérifié dans
la recette locale. P09-03 garde les parcours connectés sur l’iPhone
physique ainsi que les autres scénarios de bout en bout.

### P07-01 / P07-02 · Position et prévisions dans WebKit mobile

Sur le HUB connecté à la recette, WebKit a fourni une position simulée
différente du point enregistré du voyage. Le bouton du tiroir Météo a
déclenché une requête météo avec les coordonnées du navigateur, arrondies
au centième de degré. La réponse de MET Norway contenait une température
et dix jours de prévision. Le tiroir a affiché « Ma position ». À 390 px,
la rangée du widget laisse voir environ 3,5 pastilles et défile
horizontalement jusqu’aux jours suivants. Le GPS de l’iPhone physique et
la parité avec Compas restent à vérifier.

### P02-12 / P07-19 · Proposition de parcours et décision des inscrits

La publication relie la sortie à une version précise du catalogue. La
distance provient de la géométrie et le dénivelé apparaît si le catalogue
le fournit. La transaction conserve le rendez-vous précédent et écrit la
nouvelle proposition avec une notification pour chaque inscrit éligible.
La notification ouvre la fiche du bon événement. Les modifications de
rendez-vous saisies en texte remplacent le libellé courant et retirent
son ancien repère géographique.

Recevoir une révision laisse la décision en attente. Adopter le nouveau
tracé ou garder le précédent crée une décision par personne et par version.
Une ancienne géométrie adoptée reste consultable depuis la fiche. Le tiroir
Carte du HUB ouvre cette même fiche. Les décisions sont privées, même pour
deux membres de la même sortie. L’annulation ferme la lecture des
participants et conserve l’historique en base.

**Recette locale.** 122 suites PostgreSQL et 2 067 assertions passent,
dont 37 couvrent le cycle de publication, les droits, la géométrie,
la notification et les décisions simultanées. Les 144 tests
applicatifs ciblés passent. PostgREST et l’API renvoient HTTP 409
sur une proposition périmée. Les deux comptes de recette ont enregistré
des choix distincts sur le même événement avec les révisions 1 et 2
conservées en base.

Le rejeu des migrations inclut les optimisations RLS intégrées au dépôt.
Les deux anciennes policies d’écriture restent absentes lorsque la
synchronisation passe par le RPC. Le retour du changement de code
d’erreur a aussi été exercé sur la base locale.

**Copie du tracé adopté.** Depuis la fiche, un inscrit peut enregistrer la
géométrie de sa révision et la retirer de cet appareil. La copie est
partitionnée par compte, sortie et révision. La déconnexion et le changement
de compte retirent les copies de l’ancien compte. En ligne, la fiche refait
la lecture autorisée en base.

**Recette WebKit mobile.** Le tiroir Carte du HUB authentifié ouvre la
fiche de cette sortie. Une sortie publiait la révision 2 alors que le
participant avait conservé la révision 1. Le test a comparé la géométrie
enregistrée à celle du RPC PostgreSQL, puis ouvert le tracé après coupure du
réseau, sans requête RPC ni tuile. La copie a été retrouvée à la réouverture
de la fiche avec réseau. Sa suppression a été vérifiée dans IndexedDB et lors
d’une nouvelle coupure.

Le démarrage en mode avion, le fond de carte téléchargé, le guidage terrain
et le calcul des impacts du changement de parcours restent à vérifier.

### P02-13 · Chargement du sélecteur

Le sélecteur appelle la vue liste de l’API des aventures. Cette vue conserve
les mêmes sorties accessibles, groupes, invitations et compteurs que la
réponse complète. Le Camp de base utilise toujours la réponse qui inclut
le titre et le tracé actifs.

**Recette authentifiée.** WebKit a chargé le HUB avec la vue liste.
Sept requêtes chaudes par vue, alternées sur le même compte en recette
locale, ont donné 88 ms en médiane pour la liste et 1 100 ms pour
la réponse avec le voyage actif. La comparaison a vérifié l’égalité des
champs communs. Ce chronométrage mesure l’API du sélecteur.

Le cockpit transmet désormais `schemaVersion: 1`. Le layout courant
laisse la page charger cette projection. La checklist de préparation
et les images du matériel restent dans les écrans détaillés. Les traces
SSR d’une session locale confirment que ces deux lectures sont absentes
de `/hub` et présentes dans `/hub/itineraire`. Les accès authentifiés à
l’itinéraire, au suivi live et à l’entrée Kit Studio ont été contrôlés.
La pagination des détails et la mesure du premier écran complet restent
à traiter.

### P07-28 / P07-29 · Heure des moments

Lors de l’ajout d’un fichier dans le Carnet du HUB, le formulaire conserve
le jour sélectionné, l’instant et le fuseau du téléphone. La ligne garde
ces valeurs si l’ajout se termine après minuit. Pour un texte, l’instant
est fixé à l’envoi. L’horodatage du fichier importé indique sa sélection
dans le formulaire.

**Recette.** Le test du formulaire sélectionne une photo à 23 h 59,
passe au jour suivant et vérifie les valeurs envoyées en base. Dans
WebKit authentifié, une note texte créée via le HUB a été lue directement
dans PostgreSQL avec l’heure, le jour, le fuseau et l’instant attendus.
Les 14 cas de la suite d’interface Carnet qui échouent étaient déjà en
échec avant ce changement. L’upload photo avec stockage réel et la reprise
du brouillon après fermeture en mode avion restent à vérifier.

### P07-48 / P07-49 · Membres du collectif

Le HUB charge les membres du collectif actif depuis `group_members` et
leurs profils depuis `public_profiles`. Les pastilles reprennent le nom,
l’avatar et le rôle, puis ouvrent la fiche de la personne. Les membres en
attente sont comptés à part. Le HUB affiche un état explicite si la lecture
échoue.

**Recette WebKit authentifiée.** Deux membres actifs d’un collectif privé,
l’avatar lu en base et l’ouverture de la fiche ont été contrôlés. Un
compte invité en attente n’a pas accès au rail. Le tri par progression,
les positions consenties et les scénarios avec 50 membres restent ouverts.

Pour une sortie, le chargeur ajoute les inscriptions confirmées de
`trip_participants` aux membres déjà connus. Un collaborateur conserve
son rôle et sa fiche indique « Participation confirmée » quand sa ligne
l’atteste. La recette WebKit a confirmé l’affichage depuis le rail du HUB
puis dans le sous-tiroir d’une personne inscrite en base.

### P02-07 / P07-22 · Exécution des étapes et séparation prévu / réel

Le HUB affiche les horaires prévus et le suivi terrain côte à côte sans
modifier `trip_steps`. La migration `20261121100000_trip_step_execution.sql`
ajoute un journal d’exécution distinct du plan (`trip_step_executions`) avec
statuts (`started`, `arrived`, `completed`, `skipped`, `postponed`, `cancelled`),
horodatages réels, source (`manual`, `gps`, `system`), identifiant d’opération
idempotent, vérification conjointe de la version du journal et de
`trip_steps.updated_at`, instantané du plan d’origine et notes réservées aux
éditeurs. Le retour arrière `20261121100000_trip_step_execution.down.sql`
refuse de supprimer un journal non vide.

Le sous-tiroir Étapes (`StepExecutionDetails.tsx`) permet aux éditeurs de
démarrer, marquer atteinte, terminer, reporter, ignorer ou annuler une étape
avec note facultative réservée aux éditeurs. Les étapes réalisées retirées du
plan restent consultables dans le tiroir sous « Étapes retirées du plan » avec
leur état et leur contexte prévu. Les participants confirmés consultent l’état
et les horaires en lecture seule, sans accès aux notes internes.

**Recette locale.**
- **PostgreSQL / pgTAP · PASS.** 50 assertions dédiées dans
  `supabase/tests/database/trip_step_execution.test.sql` (`1..50`, zéro `not ok`),
  et suite complète verte sur `lkdv_hub_ci` : 123 fichiers, 2 117 assertions.
- **Typage, lint et Vitest · PASS.** `npm run type-check` (Node 24, heap 4 Go),
  ESLint ciblé sur `src/features/hub/cockpit/` et 45 tests de
  `src/features/hub/__tests__` passent.
- **Recette WebKit mobile authentifiée · PASS.** Rejeu sur `127.0.0.1:4103/hub`
  avec trois sessions Supabase Auth (deux appareils éditeur, un participant
  confirmé) : démarrage manuel sans GPS, conflit de version entre appareils puis
  actualisation, conflit après modification de `trip_steps.updated_at` puis
  actualisation, enchaînement départ/arrivée/fin avec plan intact, lecture seule
  et confidentialité des notes éditeur vérifiées côté participant, puis retrait
  du plan et ouverture de l’archive « Étapes retirées du plan » (avec note
  visible pour l’éditeur et masquée pour le participant).

Le GPS automatique, le suivi porte-à-porte, les pauses non sportives et la
reprise hors ligne après redémarrage restent à traiter pour clôturer P02-07 et
P07-22.

### P05 / P06-06 / P07 · File hors-ligne persistante et interactions des huit tiroirs

Le cockpit du HUB dispose désormais d’une file d’opérations hors-ligne
persistante dans IndexedDB (`src/features/hub/cockpit/offlineQueue.ts`), d’un
bandeau discret d’état réseau et synchronisation, et d’interactions réelles
branchées sur PostgreSQL dans les tiroirs :

- **Hors-ligne & reprise après redémarrage (`offlineQueue.ts`, `StepExecutionDetails.tsx`).**
  Les actions d’étape, dépenses et coches du kit saisies hors connexion sont
  conservées en file FIFO idempotente avec `operationId` et rejouées
  automatiquement au retour du réseau et au redémarrage, avec détection explicite
  des conflits sans perte silencieuse.
- **Budget (`BudgetDrawerTools.tsx`, `budgetActions.ts`, `budgetMath.ts`).**
  Ajout de dépense réelle depuis le tiroir (en ligne ou en file hors-ligne),
  synthèse par catégorie, projection de fin de voyage et répartition exacte en
  centimes entiers sans erreur d’arrondi.
- **Météo (`weatherAdvice.ts`).** Indicateur de fraîcheur du relevé et alertes
  terrain dérivées uniquement des seuils numériques réels (vent fort, pluie,
  gel, chaleur) avec liens directs vers Kit ou Étapes.
- **Kit (`kitActions.ts`, `kitMath.ts`).** Synthèse exacte du poids (base,
  porté, consommables, total, vitaux à préparer) et bascule `Préparé / À préparer`
  persistée dans `trip_items` (en ligne ou en file hors-ligne).
- **Paperasse (`paperasseStatus.ts`).** Évaluation explicite des échéances
  (`Expiré depuis…`, `Expire aujourd’hui`, `Expire dans…`, `Valide`).
- **Groupe (`groupProgress.ts`).** Découpage en blocs glissants de 3 membres
  (testé jusqu’à 50 membres), comparateur de progression relative sur même
  révision de tracé et accès direct aux secours officiels `tel:112`.
- **Carte & Carnet (`ElevationStrip.tsx`, `offlineMapPack.ts`, `CarnetDraftStore.ts`).**
  Profil de dénivelé SVG interactif relié aux étapes du jour, enregistrement et
  suppression du pack carte hors-ligne dans IndexedDB, et brouillon Carnet
  hors-ligne conservé au redémarrage.

**Preuves locales.**
- **Vitest · PASS.** 11 fichiers, 60 assertions vertes dans `src/features/hub/__tests__/`.
- **Typage et ESLint · PASS.** `npm run type-check` (Node 24, heap 4 Go) et
  ESLint ciblé verts.
- **Recette WebKit mobile authentifiée · PASS.**
  - `verify-hub-step-offline.cjs` : saisie d’étape hors-ligne, rechargement
    complet après retour réseau et synchronisation automatique vérifiée en
    PostgreSQL (`status = 'started'`, `version = 1`, note conservée).
  - `verify-hub-widgets-interactive.cjs` : absence de débordement horizontal
    sur iPhone 14, ajout de dépense réelle persistée dans `trip_expenses` avec
    répartition exacte, coche Kit persistée dans `trip_items.is_packed`,
    statuts expiré/valide dans Paperasse et lien secours 112 dans Groupe.
  - `verify-hub-map-carnet-offline.cjs` : profil de dénivelé, pack carte
    hors-ligne persisté après rechargement et brouillon Carnet hors-ligne
    restauré après redémarrage.

### P00 / P01 / P02 / P03 / P04 / P05 / P08 · Consolidation finale en recette locale

- **P00-06 · Contrat d’environnement redacted.** `src/lib/envContract.ts`
  déclare les variables obligatoires et optionnelles par fonctionnalité,
  distingue `public`/`server` et produit un rapport strictement expurgé de
  toute valeur sensible (`src/lib/__tests__/envContract.test.ts` PASS).
  `npm run verify:hub-no-mockup` confirme zéro contamination de maquette.
- **P00-07 · Baseline de performance mesurée.** `baseline-perf.csv` archive
  les mesures p50/p95 authentifiées sur `127.0.0.1:4103` (`/hub`, `/compas`,
  `/api/hub/adventures?view=list`, `/api/weather/point`).
- **P01 · Audit PostgreSQL sur `lkdv_hub_ci`.** 385 tables publiques dont
  **385 avec RLS activée (100 %)**, **0 fonction `SECURITY DEFINER` sans
  `search_path`**, 17 index spatiaux GiST PostGIS, 63 index sur les tables
  `trip*`, et **124 suites pgTAP / 2 135 assertions PASS**.
- **P02-04 / P02-05 / P03-26 / P05-01..P05-03 / P07-18 / P07-54 · Migration
  `20261121120000_hub_live_safety_and_field_reports.sql`.**
  - `trip_lifecycle_events` + RPC `transition_trip_lifecycle` (verrou `FOR UPDATE`,
    idempotence `operation_id`, journalisation atomique du départ/pause/clôture).
  - `trip_live_positions` + RPC `upsert_trip_live_position` / `read_trip_live_positions`
    (persistance en base remplaçant la mémoire de processus, protection contre
    les paquets inversés `recorded_at`, expiration et révocation immédiate).
  - `trip_safety_contacts` (contacts d’urgence persistés en base, RLS stricte
    par propriétaire).
  - `hub_field_reports` + `hub_field_report_confirmations` + RPC
    `confirm_hub_field_report` (signalements terrain datés avec expiration 7 j,
    confirmations idempotentes, formulaire `FieldReportForm.tsx` dans le tiroir Carte).
  - Retour arrière réversible (`20261121120000_hub_live_safety_and_field_reports.down.sql`)
    exercé en transaction sur `lkdv_hub_ci` et 18 nouvelles assertions pgTAP PASS.
- **P03-01 / P03-02 / P08-01..P08-07 · Catalogue géo-environnemental et
  orchestration incrémentale.** `src/features/hub/cockpit/geoCatalog.ts`
  formalise les sources, licences, TTL, fraîcheur et dégradations honnêtes,
  ainsi que le graphe d’invalidation par domaine `resolveAffectedDomains`.
- **P04 · Profiling CPU et décision Rust/WASM.**
  `npm run explorer:bench:geo` mesure le moteur TS pur sur 1k / 10k / 100k
  points : pire cas 100 000 points à **1,126 ms p50 / 2,432 ms p95** (budget
  frame 16,7 ms). `npm run perf:gpx` confirme la parité et les temps d’export/parse.
  Verdict mesuré et documenté : le noyau TypeScript suffit largement sur la
  cible mesurée ; un portage Rust/WASM n’apporte pas de gain end-to-end
  démontrable à ce stade (et la toolchain Cargo n’est pas requise en CI).
- **P01-10 / P01-15 / P02-09 / P05-10 / P05-13 / P07-25 / P07-36..38 · Migration
  `20261121130000_hub_retention_and_shared_gear.sql` & modules terrain.**
  - Index FK ciblés sur `trip_lifecycle_events(actor_id)`,
    `trip_safety_contacts(owner_id)`, `hub_field_reports(trip_id)`.
  - `get_trip_effective_party_size` (taille de groupe canonique dédupliquée
    sans invitations en attente), `assign_trip_shared_item` (attribution d’objet
    partagé réservée aux éditeurs) et `purge_expired_hub_ephemeral_data`
    (purge éphémère réservée à `service_role`, révoquée pour `anon`/`authenticated`).
  - `etaEngine.ts`, `consumablesTracker.ts` et `localDataProtection.ts`
    (effacement atomique des données locales sensibles à la déconnexion).
  - **pgTAP · PASS** : **125 suites, 2 143 assertions** vertes + rollback SQL
    exercé en transaction. **Vitest · PASS** : 14 fichiers, 67 assertions.
  - **WebKit mobile authentifié · PASS** : `verify-hub-field-report.cjs` et
    `verify-hub-lifecycle-safety.cjs` verts sur `127.0.0.1:4103/hub`.
- **P01-14 / P02-01 / P02-06 / P02-14 / P04 / P06-02..03 / P07-21 / P07-48 /
  P08-03 / P08-06 / P09-01 · Contrats noyau et matrice de recette.**
  - `normalization.ts` (IANA, dates civiles, ISO-4217, centimes, km/m),
    `adventureRef.ts` (`sortie`/`collectif`/`activite_libre` + `SharedMutationEnvelope`),
    `geoKernelContract.ts` (ABI TypedArray `Float64Array`/`Float32Array`,
    anti-méridien, trous d’altitude, projection avec ambiguïté),
    `hubObservability.ts` (télémétrie par domaine sans PII + propositions
    réversibles `apply`/`revert`).
  - **Vitest · PASS** : **15 fichiers, 71 assertions** vertes.
  - **Recette WebKit matrice multi-durées (`verify-hub-matrix-durations-50.cjs`) · PASS** :
    sorties de **2 h (1 j)**, **2 j** et **30 j** rendues avec 8 widgets, zéro
    débordement horizontal, pastille `J30` et fermeture clavier `Escape`.
  - **Recette WebKit collectif 50 membres (`verify-hub-50-members.cjs`) · PASS** :
    50 membres réels en base affichés en 17 blocs glissants de 3 avec navigation
    `Suivants` / `Précédents` fluide sur iPhone 14.
- **Décisions produit & connecteurs officiels sans clé (P00-02, P03-19, P03-20, P04, P07-15/33/45).**
  - **P00-02** : décision explicite de Tony de conserver le projet Supabase
    hébergé unique (sans création de projet Preview), tout en maintenant toutes
    les écritures et recettes sur la VM locale isolée (`127.0.0.1:38423` / `5437`).
  - **P03-19 & P03-20** : branchement en direct sur les flux publics officiels
    sans clé API via `/api/hub/official-alerts` (`officialAlertsServer.ts`,
    `OfficialAlertsPanel.tsx` dans le tiroir Météo) : **MeteoAlarm CAP 1.2**
    (alertes officielles Météo-France / EUMETNET, CC BY 4.0) et **NASA EONET v3**
    (feux actifs officiels filtrés par distance haversine autour du voyage).
    Tests unitaires (`official-alerts.test.ts`) et appel HTTP réel verts.
  - **P04** : décision validée par Tony de suivre la recommandation technique
    mesurée : le noyau TypeScript sur TypedArrays (`geoKernelContract.ts`,
    100 000 points en 1,126 ms p50 / 2,432 ms p95 < 16,7 ms) est retenu sans
    introduire de chaîne de compilation Rust/WASM.
  - **P03-08..10 / P07-15 / P07-33 / P07-45** : `corridorPoiActions.ts`
    (requête `geo_pois` eau/abris/campings avec caveat OSM), `storySummary.ts`
    (export récit sans notes internes éditeur) et `PaperasseQuickAdd.tsx`
    (ajout rapide de confirmation/billet persisté dans `trip_documents`).

### P09 · Cinq passes d’amélioration, livraison réversible et clôture

1. **Passe 1 — Fondations (`P09-07`)** : contrat env redacted (`envContract.ts`),
   zéro contamination maquette (`verify:hub-no-mockup`), 385/385 tables RLS,
   0 fonction `SECURITY DEFINER` sans `search_path`, 125 suites pgTAP / 2 143 assertions.
2. **Passe 2 — Données terrain (`P09-08`)** : catalogue géo (`geoCatalog.ts`),
   MET Norway + MeteoAlarm CAP 1.2 + NASA EONET v3 en direct sans clé API,
   POI corridor `geo_pois`, signalements terrain datés (`hub_field_reports`).
3. **Passe 3 — Logique métier (`P09-09`)** : suivi étapes prévu/réel sans
   altérer le plan, cycle de vie atomique (`trip_lifecycle_events`), taille de
   groupe canonique (`get_trip_effective_party_size`), recalcul ressources sans
   perte (`recomputeResourcesWithoutLoss`), répartition et remboursements exacts
   au centime (`budgetMath.ts`, `settlementsAndGear.ts`).
4. **Passe 4 — Vitesse & Profiling (`P09-10`)** : baseline perf authentifiée
   (`baseline-perf.csv`), benchmarks `explorer:bench:geo` (100k pts en 1,126 ms
   p50 / 2,432 ms p95) et `perf:gpx`, ABI TypedArray prête (`geoKernelContract.ts`),
   repli TS retenu sur décision validée par Tony.
5. **Passe 5 — Usage terrain & mobile (`P09-11`)** : 8 widgets sur écran fixe
   iPhone (zéro débordement sur 2h, 2j, 30j et 50 membres en 17 blocs de 3),
   file hors-ligne IndexedDB avec reprise après redémarrage, pack carte et
   brouillon Carnet hors-ligne, fermeture clavier `Escape`, protection locale à
   la déconnexion (`localDataProtection.ts`), aperçu ouvert sur l’iPhone de Tony.

**Runbook de livraison réversible (`P09-13`) :**
- **Application** : bascule immédiate vers l’ancien HUB via `LKDV_HUB_LAYOUT=legacy`
  sans perte de données.
- **Base de données** : toutes les nouvelles migrations sont additives et
  accompagnées de leur script `.down.sql` testé en transaction sur `lkdv_hub_ci`
  (`20261121100000_trip_step_execution.down.sql`,
  `20261121120000_hub_live_safety_and_field_reports.down.sql`,
  `20261121130000_hub_retention_and_shared_gear.down.sql`). Les scripts
  refusent de supprimer les journaux remplis.
- **Production** : aucune mutation ni déploiement effectué sur la production
  sans autorisation distincte.
