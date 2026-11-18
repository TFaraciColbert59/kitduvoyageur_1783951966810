# Mission LKDV · Gemini Hydrogen dans Antigravity

Je veux que tu implémentes dans Le Kit du Voyageur un créateur d’itinéraires collaboratif complet, de la préparation jusqu’au retour de sortie. Ouvre le dépôt de l’app dans Antigravity. Avance étape par étape, tranche seul les choix réversibles et valide chaque tranche avant de poursuivre. Travaille sur une branche d’implémentation distincte, selon les conventions du dépôt.

## Récupère les ressources sur GitHub

Dépôt de l’app : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810

Depuis le dépôt LKDV ouvert, récupère la branche documentaire sans changer ta branche de travail.

```sh
git fetch origin refs/heads/docs/itineraire-collaboratif
git show FETCH_HEAD:docs/itineraire-collaboratif/README.md
git show FETCH_HEAD:docs/itineraire-collaboratif/01-recherche-approfondie.md
git show FETCH_HEAD:docs/itineraire-collaboratif/02-specification-fonctionnelle.md
git show FETCH_HEAD:docs/itineraire-collaboratif/03-recette-et-benchmark.md
```

Lis le cahier des charges de recherche et la spécification avant de fixer les choix techniques. Le benchmark donne la recette et le point de départ historique. Vérifie l’état actuel du dépôt et de l’environnement avant de reprendre un constat ancien ou une proposition de schéma. Utilise les ressources de la branche documentaire sur une base d’implémentation à jour.

## Étape 0 · Ouvre le projet et vérifie l’état réel

1. Identifie le commit, la branche, les changements locaux et les instructions du dépôt. Préserve le travail déjà présent et isole ta mission si nécessaire.
2. Cartographie les entrées normales d’Explorer, Compas, Hub, clubs, activités, inventaire et carnet. Vérifie le schéma Supabase, les droits, les modèles de propositions, les exports, les feature flags et les tests existants.
3. Cherche **`src/features/adventure-prep/routeRevision.ts`**, **`routingService.ts`**, les actions serveur **`src/features/compas/server/`**, **`src/app/api/voyages/[slug]/gpx/route.ts`**, les migrations d’invitation, les suites RLS Compas et les contrats de synchronisation. Ces chemins sont des points de départ issus de l’audit. Suis leurs appels réels et retrouve leurs remplacements si le code a bougé.
4. Exécute le minimum de vérifications de référence pour isoler les problèmes préexistants. Vérifie particulièrement les cas de build, de chargement de Compas sans WebGL, de recherche « Lille » sans GPS et de reprise du brouillon après connexion.
5. Tiens un tableau de travail court avec exigence, état actuel, point d’entrée, décision de réutilisation, test et résultat. Distingue une fonction atteignable dans l’app, du code présent sans recette et d’une exigence à construire. Commence la réalisation dès que la prochaine tranche est claire.

## Étape 1 · Termine le créateur d’itinéraires dans Compas

- Depuis Explorer, une commune ou une trace de catalogue donne accès à « Préparer avec ce tracé ». Compas permet aussi de partir d’une route vide, d’un GPX ou d’une activité antérieure. Le GPX source est préservé. Une copie éditable garde son origine et une section importée peut conserver sa géométrie.
- Donne à chaque point, section et étape un identifiant stable. Prends en charge boucle, aller simple, aller-retour, inversion, insertion, suppression et déplacement. Une route accepte des sections routées et manuelles. Les raccords, les ruptures et les entrées invalides ont des états explicites.
- Le routage accepte au minimum randonnée et vélo, selon les capacités réellement documentées du fournisseur configuré. Réutilise les profils existants. Pour chaque calcul, associe une empreinte des points, du profil, des options et de la version du fournisseur ou des données quand elle est disponible. Un résultat tardif correspondant à un ancien état ne modifie jamais la trace active.
- Permets de découper un itinéraire en journées, déplacer les coupures, attacher notes, arrêts et nuits, puis exporter chaque étape et la route complète. Vérifie la continuité des sections, le respect de l’ordre et les dates locales lors d’un changement d’étape.
- Relie le profil de dénivelé à la carte et à la liste. Compare les variantes par section et par journée avec distance, D+, durée et surfaces lorsqu’ils sont disponibles. Indique la source, la date, la méthode et les données inconnues. Utilise la météo du lieu et du créneau. Pour l’eau, les refuges, les fermetures et les alertes, affiche la provenance et la fraîcheur. Une donnée inconnue ne vaut ni confirmation d’accès ni disponibilité.
- Conserve la navigation et les conventions visuelles LKDV. Sur mobile, garde l’essentiel accessible en bas de l’écran et laisse la place à la carte. Sur bureau, affiche ensemble étapes, carte et détail si l’espace le permet. La vue liste doit permettre de modifier les points, lire les étapes, comparer les variantes et ouvrir les vérifications sans dépendre du rendu de la carte.
- Cette étape est terminée quand les parcours sont accessibles par les entrées normales, que la sauvegarde est relue, que les fichiers GPX exportés passent une validation d’échange et qu’un écran cartographique en échec laisse le plan utilisable.

## Étape 2 · Fais marcher la coédition, les propositions et les conflits

- Réutilise l’identité et les invitations des voyages. Prévois responsable, coorganisateur avec droit délégué, éditeur, contributeur qui propose ou commente, et participant qui consulte et télécharge. La participation à une sortie de club ne donne pas de droit d’édition. Vérifie les droits serveur à chaque lecture ou mutation sensible et à l’acceptation d’un lien. Teste l’invitation expirée, révoquée, déjà utilisée ou liée au mauvais compte.
- Affiche la présence des personnes et l’étape sur laquelle elles travaillent. La présence reste indicative. Les gestes de glisser sur la carte sont temporaires jusqu’à l’enregistrement d’une opération. Ajoute des commentaires ancrés à une entité et à sa révision. Si un segment disparaît, préserve le commentaire et demande de repositionner son ancre.
- Une proposition contient un avant/après, sa justification et ses impacts. Prévois acceptation, refus, retour à une version et historique des décisions. Relis le diff au moment de l’acceptation. Si le brouillon a changé, revalide la proposition avant de l’appliquer. Une restauration crée un nouvel état dans l’historique.
- Utilise un journal d’opérations métier, des versions par entité et des publications immuables. Chaque opération porte un identifiant idempotent, l’acteur, la route, les versions attendues des entités touchées et une séquence serveur après application. Une opération répétée rend le premier résultat. Le même identifiant avec un contenu différent est refusé.
- Fusionne les opérations indépendantes. Montre un conflit lorsque deux intentions modifient le même objet ou une dépendance commune, y compris entre deux journées qui partagent une jonction. La réponse d’un fournisseur de routage passe par les mêmes contrôles de version. Garde les transactions courtes et les appels fournisseurs hors transaction.
- Les permissions et la révocation doivent rester cohérentes avec les écritures concurrentes. Utilise les mécanismes Postgres et Supabase déjà disponibles. Realtime diffuse une présence limitée et la disponibilité d’une nouvelle séquence. Les clients récupèrent les changements autorisés côté serveur et comblent un trou de séquence par rattrapage ou rechargement.
- Recette minimale avec trois rôles. Deux éditeurs modifient des jours indépendants, puis le même point. Un participant consulte la publication. Rejoue suppression concurrente, déplacement d’une jonction, reprise hors ligne, lot rejoué, réponse tardive et révocation pendant une session active.

## Étape 3 · Relie les effets de la route au matériel et au groupe

- Lors d’un changement, calcule le diff à partir des mêmes révisions que celles affichées. Montre quels segments, étapes, nuits, horaires, vérifications et articles du kit sont concernés. Une durée ou un impact impossible à calculer reste signalé.
- Un article personnel réutilise son objet d’inventaire. Un article partagé peut être affecté à un équipier. Une révision déclenche une demande de vérification seulement quand la donnée dont elle dépend a changé. Préserve les confirmations encore valables, les poids renseignés et les articles déjà choisis.
- L’éditeur propose un changement et le rôle autorisé publie sur la révision qui a été effectivement relue. Une tête modifiée entre la revue et la publication demande une nouvelle vérification. L’événement de club et la messagerie pointent vers l’objet autorisé. Regroupe les notifications d’une même publication et indique qui est concerné et pourquoi.

## Étape 4 · Rends la sortie fiable hors réseau et boucle jusqu’au carnet

- Fige une **version de départ** avec route, étapes, notes, repères utiles et checklist. Le manifeste du pack indique identifiants, version, taille, contenu, intégrité et disponibilité des fonds de carte. Utilise uniquement les fonds autorisés pour l’usage retenu. Documente le périmètre des licences, quotas et dépendances selon les fournisseurs réellement utilisés.
- Marque « téléchargé » après vérification locale. Une mise à jour interrompue laisse la dernière copie complète accessible. Sépare l’état « téléchargé sur cet appareil » de la confirmation de préparation du participant. Après fermeture et coupure réseau, la route, les étapes et le kit doivent rester ouvrables.
- Mets les modifications locales dans une file persistante. À la reconnexion, applique-les dans un ordre compatible avec leurs dépendances et les permissions courantes. Rends visibles attente, rejet ou conflit. Une copie hors ligne affiche sa version et la date du dernier contrôle. Elle ne peut garantir qu’elle possède la version la plus récente en l’absence de réseau.
- Démarre une activité avec l’identifiant de la version choisie et l’instantané du kit. Une version publiée pendant la séance peut être proposée sur action explicite. Conserve la trace des changements réellement utilisés. Le partage de position, s’il est exposé dans ce parcours, garde ses propres permissions et ses commandes d’arrêt.
- Rattache le résultat réel au carnet. Le carnet montre le plan, la trace enregistrée et le matériel de départ, même après publication d’une autre version. « Reprendre cette sortie » crée un brouillon indépendant avec provenance. Préserve la lecture des voyages et activités antérieurs à la migration.

## Étape 5 · Valide l’intégration et les limites de service

- Mets en place les migrations d’ajout compatibles avec les anciennes données. Vérifie la conversion d’un jeu représentatif et le retour arrière selon le workflow du dépôt. Définis une source unique d’écriture par voyage pendant la transition.
- Vérifie les rôles et accès aux routes, journaux, publications, commentaires, packs, liens et médias. Teste l’accès de deux comptes et d’une session anonyme dans un environnement autorisé. Gère l’expiration, la révocation et les permissions anciennes après reconnexion.
- Teste grosses traces réalistes, étapes vides, géométrie invalide, import borné, absence d’altitude, données périmées, fournisseur indisponible, retries, perte réseau, fin de quota de stockage et changement d’heure. Mesure les coûts d’appels et les volumes des packs sur un jeu reproductible. Réutilise cache et quotas existants.
- Vérifie le résultat en interface sur mobile et bureau, y compris clavier et lecteur d’écran pour les actions critiques. Vérifie les états vides, en cours, erreur et récupération. Documente exactement l’environnement de chaque mesure, surtout quand un vrai appareil ou un fournisseur est requis.
- Fais passer les contrôles appropriés au projet, notamment types, lint, tests unitaires, intégration base, E2E multi-utilisateur et build. Ajoute des tests ciblés lorsque les suites existantes ne couvrent pas les invariants de cette mission.
- Vérifie chaque point P1 à P4 du benchmark dans le parcours réel. Pour les critères matériel, communauté, hors-ligne, droits et carnet, indique le résultat exact validé dans cette mission. Garde les objectifs de mesure distincts des résultats obtenus.

## Étape 6 · Relance et améliore au moins cinq fois

Les cinq passes commencent après le premier parcours complet. Chaque passe doit **rejouer des scénarios, relever les écarts, corriger ce qui bloque et relancer les contrôles affectés**. Une absence de correctif compte lorsque la passe a été effectivement exécutée et que sa preuve est fournie. Après toute modification importante, rejoue les invariants touchés des passes précédentes.

| Passe | Travail obligatoire | Preuve attendue |
|---|---|---|
| **1 · Parcours complet** | Repartir d’Explorer, préparer deux jours, partager, publier, télécharger et retrouver version et kit au carnet. Corriger les ruptures entre écrans, droits et modèle. | Scénario reproductible, commit testé et résultat pour chaque étape. |
| **2 · Concurrence et droits** | Utiliser deux éditeurs, un participant et une session anonyme. Tester modifications indépendantes, même point, frontière commune, duplication d’opération, proposition devenue obsolète et révocation. | Résultat serveur et état visible des deux clients. Voies d’accès et écritures vérifiées dans l’environnement de test. |
| **3 · Hors-ligne et reprise** | Couper le réseau pendant le pack, fermer l’app, rouvrir en mode avion, modifier localement, revenir en ligne et rejouer une mutation. Simuler une réponse de routage périmée. | Version complète réellement ouverte, aucune perte inexpliquée ni écriture doublée, conflits visibles. |
| **4 · UX et performance** | Refaire l’essai sur petit écran et bureau. Tester clavier, vue liste sans WebGL, erreurs fournisseurs, trace longue et réseau lent. Corriger les points mesurés. | Résultats avant/après avec appareil ou environnement, jeu de données et limites. |
| **5 · Régression et vérification du chantier complet** | Relire le cahier des charges, confronter les preuves à la matrice et rejouer la recette complète sur le commit final dans l’environnement prévu. Vérifier build, migrations, entrées habituelles, anciennes données et stratégie de retour arrière. | SHA final, commandes exécutées, résultats, critères couverts, preuve du flux complet et liste exacte des blocages s’il en reste. |

Si la passe 5 découvre un écart, lance une **passe 6**, corrige et rejoue. Continue jusqu’à ce que les critères soient prouvés ou qu’un blocage externe réel rende un test impossible. Avance sur les tâches indépendantes pendant ce temps. Pour chaque blocage, donne sa cause, les tentatives faites, ce qui fonctionne déjà et l’accès ou l’environnement réellement nécessaire pour finir.

## Comment je veux que tu travailles et que tu me rendes le résultat

- Utilise le dépôt et les outils disponibles dans Antigravity. Si des agents ou modèles délégués sont disponibles et autorisés, réserve-les aux lots qui peuvent avancer indépendamment. Garde une responsabilité unique pour les fichiers partagés, le schéma et l’intégration. Réemploie des contextes courts et évite les appels payants non autorisés.
- Fais les changements dans le code, vérifie par les entrées normales et prépare des commits cohérents selon le workflow du dépôt. Les actions sur des données réelles et les déploiements suivent les autorisations de la mission et du projet. Utilise des comptes et données de recette pour les validations sensibles.
- À chaque étape, donne une mise à jour courte avec ce qui a changé, ce qui a été prouvé et le blocage concret éventuel. Les arbitrages ordinaires restent à ta charge.
- Au final, donne les fonctionnalités effectivement livrées, les fichiers ou commits, les résultats des cinq passes au minimum, la matrice exigences → preuves, et l’état exact des tests sur appareils, fournisseurs et déploiements. Pour chaque étape importante, indique ce que je peux réellement ouvrir et faire dans l’app.

**La recette finale est celle-ci.** Trois personnes sur deux téléphones et un ordinateur préparent deux jours. Elles modifient deux étapes en parallèle, résolvent un conflit sur le même point, comparent un détour et voient son impact sur le matériel. Elles publient la bonne version. Une coupure interrompt le téléchargement, puis l’app rouvre la dernière copie complète en mode avion. À la reconnexion, chacun récupère son état sans doublon. Après l’activité, le carnet retrouve la version réellement suivie et le kit réellement emporté. Vérifie ce parcours jusqu’au bout.
