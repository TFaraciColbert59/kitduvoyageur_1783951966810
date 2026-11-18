# Le créateur d’itinéraires collaboratif
## Vision produit
Une équipe prépare la même sortie dans Compas. Chacun peut prendre en charge une étape, annoter un passage, proposer un détour ou ajouter un arrêt. Le groupe sait quelle route suivre, ce que ce choix change pour le matériel et qui doit encore télécharger la version de départ.
> La différence produit se mesure au moment où le plan change. Déplacer un refuge doit montrer le nouveau kilométrage par jour, les horaires impactés et les vérifications à refaire. La route, le kit et la sortie de club restent liés.
## Le test qui justifie le produit
Alice prépare deux nuits dans le Vercors. Éloi propose un détour vers un refuge. Mina prépare le lendemain pendant qu’Alice modifie le départ. Leurs modifications indépendantes se retrouvent dans le même plan. L’organisatrice compare le détour au plan initial, en accepte une partie et publie la version 2. Au départ, Mina voit « Version 1 téléchargée · version 2 disponible » et peut garder sa copie si elle est déjà hors réseau. De retour, le carnet rappelle la version suivie et le kit réellement emporté.
## Trois parcours avec la même logique
- Express. « Boucle de 10 km autour de Lille » donne des points de départ et des boucles candidates à comparer. La destination est résolue avant la recherche. Le visiteur peut prévisualiser et conserver son brouillon local en se connectant.
- Précis. Création sur carte, dessin manuel, import GPX, suppression ou ajout de points, itinéraire aller-retour, inversion, sections distinctes et variantes. Le même éditeur fonctionne en solo et en équipe.
- Expédition. Chaque étape a ses contraintes, sa nuit, ses accès, ses repères, ses horaires, le matériel associé et les actions à confirmer. Un groupe répartit la préparation sans devoir s’ajouter dans plusieurs espaces.
## Périmètre de ce document
Conception et spécification d’intégration à LKDV. Cible mobile en priorité, avec web et installation sur appareil pour la recette. Référence produit et code du 18 novembre 2026. Les seuils indiqués sont des objectifs de validation.
# Où le produit peut aller plus loin
## Recherche comparative
## Komoot
L’organisateur partage des modifications avec les participants, qui peuvent suivre la route. La participation et l’édition du contenu sont distinctes. Le planificateur multi-jours de groupe a une limite documentée. À reprendre pour LKDV. Une invitation simple, une diffusion claire des nouvelles versions et un propriétaire de la décision de départ.
> https://support.komoot.com/hc/fr/articles/10374965887130-Organiser-et-g%C3%A9rer-des-activit%C3%A9s-de-groupe
## Ride with GPS
Le propriétaire invite des lecteurs ou éditeurs, gère leurs accès et peut joindre une note aux changements. L’historique joue un rôle dans la révision. À apporter dans LKDV. Comparaison par étape, fusion des modifications indépendantes et demande ciblée quand deux intentions touchent le même segment.
> https://support.ridewithgps.com/hc/fr/articles/35209413405851-Collaborer-sur-les-itin%C3%A9raires
## AllTrails Peak
Le découpage par jour peut tenir compte de la distance, du dénivelé et de points d’intérêt. Les limites de jours restent ajustables et la route originale peut rester visible. LKDV doit expliquer le choix du découpage, relier nuits et équipements aux étapes et traiter chaque seuil comme une contrainte modifiable du groupe.
> https://support.alltrails.com/hc/en-us/articles/50326663440020-Planning-a-multi-day-backpacking-route-with-AllTrails
## Parcours Rando
Le sac réutilisable, le poids des repas et les besoins en eau sont déjà intégrés à la préparation. Le partage compagnon documenté est en lecture seule. LKDV peut coordonner les choix d’une équipe et propager une modification d’étape jusqu’aux responsables et à la checklist.
> https://www.parcours-rando.fr/fonctionnalites/
> Hypothèse à mesurer. L’intérêt distinctif vient du temps gagné entre « on change cette étape » et « tout le monde sait quoi faire », ainsi que de la réduction des départs avec des packs différents.
# Ce que l’utilisateur manipule
## L’éditeur Compas
## Création et contrôle de la trace
Départ par recherche de commune, itinéraire Explorer, GPX, sortie antérieure ou écran vide. Saisie structurée toujours disponible. Un assistant peut interpréter « 2 jours, pas plus de 700 m de D+ par jour » et remplir des contraintes que l’utilisateur voit et peut corriger. L’utilisateur confirme la destination et le profil avant d’appliquer les suggestions.
Le tracé distingue les points de passage, sections routées, sections libres et segments GPX conservés. Déplacement, insertion, fusion et découpe gardent des identifiants stables. Les points peuvent être modifiés depuis la liste. Une section manuelle affiche son caractère non vérifié, son raccord et ses métriques disponibles. Le mode « garder ma trace » préserve sa géométrie.
## Comparateur de variantes
De deux à trois variantes par section ou journée dans le premier périmètre. Comparer les écarts de distance, D+, temps estimé, surface, portions hors réseau cartographique, accès, nuit et heure de passage. L’utilisateur peut afficher deux traces superposées, consulter les changements sous forme de liste et faire de la variante une proposition. Si le sol ou l’altitude sont inconnus, afficher cette information directement dans la comparaison.
## Découpage, profil et chronologie
À partir d’une trace continue, proposer des limites de jour en visant des fourchettes de durée et D+, des nuits plausibles et des points de repli. Déplacer une coupure montre l’impact sur les deux journées. Raccords invalides, chevauchements et segments sans continuité sont signalés. Prévoir plusieurs heures de départ, horaires locaux et regroupement manuel.
## Informations qui aident à décider
Coupler carte et profil. En touchant une pente ou un point du profil, montrer le même point sur la carte et dans la liste. Chaque repère indique sa provenance et sa date. Distinguer point d’eau cartographié, potabilité déclarée et confirmation récente. Prévoir une option de repli et les horaires utiles. La météo est liée à un lieu et à un créneau. Toute couverture absente ou prévision périmée reste visible.
## Mobile et accès dégradé
Carte plein écran et tiroir à deux hauteurs. Barre principale avec étapes, équipe et révision. Une boussole ou la position actuelle servent à se repérer. Un mode liste offre la création de points, données utiles, comparaison, commentaires et checklist sans WebGL. Sur ordinateur, carte et liste cohabitent. Clavier et lecteur d’écran donnent accès aux opérations critiques.
# À plusieurs, pendant la préparation
## Rôles et arbitrages
## Qui peut faire quoi
- Responsable. Invite, retire ou change un rôle, publie une version de départ, révoque un lien et décide d’un retour à une version antérieure. Peut transférer la responsabilité selon le modèle du voyage.
- Coorganisateur. Prépare et publie dans le périmètre délégué. Une modification des accès reste distincte de la publication.
- Éditeur. Modifie les étapes, le tracé et les repères autorisés du brouillon. Peut soumettre un changement important. Les changements de rôle et la version de départ relèvent d’autres permissions.
- Contributeur. Commente un segment, propose une variante, signale une hypothèse et formule un avis. L’adoption crée une opération signée par le décideur.
- Participant. Consulte la version publiée, télécharge le pack et confirme quelle version il a préparée. La présence à l’événement et le droit d’éditer sont deux permissions distinctes.
## Travailler ensemble sans se gêner
Présence légère sur une carte déjà ouverte. Montrer « Mina travaille sur J2 » et le contour de l’étape concernée. Les déplacements pendant le geste restent locaux ou éphémères. La souris, le GPS et le clavier du collaborateur ne sont jamais nécessaires à la lecture du plan.
Les commentaires sont ancrés à un jour, un point, une section ou une position avec sa révision. Si l’ancre disparaît, la discussion passe dans « à relocaliser » et garde son contexte d’origine. Une proposition contient le diff, la raison et l’état à revoir, acceptée ou refusée. Les votes peuvent éclairer la décision et sont associés à la proposition précise.
## Les cas qui doivent être démontrés
- Deux éditeurs modifient des jours différents. Les deux changements apparaissent sans effort.
- Deux membres déplacent le même point. Le second voit sa proposition et le déplacement déjà enregistré, avec impacts et options de résolution.
- Une personne déplace un point pendant qu’une autre recalcule une section qui y est attachée. Le résultat du calcul obsolète n’est pas inséré.
- Un membre travaille hors ligne puis perd son accès. Au retour du réseau, le serveur refuse les mutations, les brouillons locaux privés restent gérés suivant la politique de l’app et l’interface explique leur état.
# Distinguer le plan du terrain
## Publier, partir et revenir
## Brouillon, validation, départ
Brouillon modifiable à plusieurs → Révision candidate avec diff → Version publiée → Copie téléchargée → Sortie ouverte avec cette version. Une version publiée est un instantané immuable. Annuler un changement public crée une nouvelle version dérivée d’une version antérieure. Les packs et comptes rendus gardent leur référence initiale.
## Conséquences et confirmation
Un changement de nuit, de départ ou de cadence déclenche les mises à jour utiles et marque les éléments dépendants à vérifier. Exemples. Une nouvelle nuit en refuge change les articles utiles. Un détour ajoute du temps et change le créneau météo. Une modification de point de rendez-vous doit être confirmée par les participants concernés. Une notification résume le changement, le jour concerné et la version.
## En mode avion
Le pack inclut géométrie, étapes, repères essentiels, checklist, notes utiles et cartes autorisées quand elles sont disponibles. Le manifeste décrit taille, version, contenu et éléments manquants. Le téléchargement se fait en arrière-plan quand possible et bascule vers « prêt » après contrôle. Le dernier pack complet reste disponible si une mise à jour est interrompue. Un participant ne voit « téléchargé » que lorsque sa copie locale a été vérifiée.
## Pendant la sortie
Le guidage référence la version choisie au démarrage. Une nouvelle publication avertit les personnes en ligne. Le changement de route dans une séance se fait sur action explicite avec aperçu. Une sortie en cours garde le journal de changement et le calcul respecte les ruptures de réseau.
## Après la sortie
Relier l’activité réelle à la révision planifiée et au snapshot du sac. Comparer planifié et enregistré sur le même profil, montrer les écarts et les points à revoir. Le carnet reprend les données disponibles et permet de suggérer une meilleure variante au groupe. Dupliquer le plan crée un nouveau brouillon avec référence d’origine et ses propres permissions.
# Intégration dans LKDV
## Routes, interfaces et données
## Surfaces et contrats existants
- Compas devient l’entrée de création et d’édition. Reprendre son éditeur de trace, son parcours de jours et ses invitations. Associer le voyage sélectionné au brouillon via un identifiant stable.
- Explorer ouvre « Préparer avec ce tracé » depuis la fiche et lance la navigation d’une version autorisée. Le catalogue garde son origine, le brouillon porte la copie éditable.
- Hub expose plan courant, liste de matériel et état au départ. Traiter les changements du plan avec les services déjà utilisés par le kit. Figer la version du kit au départ.
- Clubs, sorties et messagerie partagent un objet et un lien accédant à sa version. Reprendre la capacité et les RSVP. Une invitation d’événement ne crée aucun droit d’édition.
- Compte, activité et carnet réutilisent l’export et les associations existantes. Référencer l’identifiant de départ et la révision lorsque disponibles. Conserver la lecture des anciennes activités.
## Modèle cible à confirmer sur le schéma déployé
- Route. ID stable, rattachement au voyage, compteur de tête du brouillon, dernière version publiée et état. Réutiliser l’audience et les membres du voyage, avec une permission d’édition spécifique si nécessaire.
- Contenu. Points, sections et étapes à ID stable avec version d’entité. Une étape contient ordre, date ou jour relatif et liens vers segments, nuit et notes. Le contenu rendu est une projection de l’état courant.
- Révisions. Instantané immuable, numéro, parent, auteur, source des sections, géométrie, métriques, résumé du changement et état de publication. Garder les calculs volumineux hors du canal temps réel.
- Opérations. ID client unique par route, auteur déduit de la session, type, paramètres bornés, entités touchées avec versions attendues, séquence résultante, motif et résultat. Une opération annulée reçoit une nouvelle écriture.
- Propositions, commentaires et packs. Objets distincts qui référencent étape, section, id de route et version de référence. Le pack est associé à un manifeste de version et le statut de confirmation à un participant.
## Composants à examiner avant écriture
src/features/adventure-prep/routeRevision.ts contient déjà RouteRevision, RouteSection et les modes routed/manual. routingService.ts porte les profils, le cache et les fournisseurs de routage. Vérifier leur utilisation depuis les versions de Compas/Explorer à intégrer. Partir des migrations d’invitation et des tests RLS existants. Réutiliser le contrat GPX de voyage et contrôler son audience. Les noms de nouvelles tables ou d’actions sont proposés ici comme concepts.
# Coédition fiable dans Supabase
## Concurrence et synchronisation
## Couche transactionnelle
Client → action serveur validée → transaction Postgres. Conserver une seule voie d’écriture métier. Dans la transaction, autoriser l’acteur, sérialiser les écritures courtes sur la tête de route, vérifier l’idempotence et les versions des objets concernés, appliquer et écrire le journal. Le contrôle d’accès et son retrait doivent être ordonnés avec la mutation, par le même verrou métier ou une stratégie équivalente. L’émission intervient après commit. Les opérations relues par les clients suivent un compteur monotone.
## Fusion des opérations
Ajouter un commentaire et déplacer un point se combinent. Une mise à jour sur J1 et une autre sur J3 se combinent si la jointure commune est intacte. Deux modifications d’une même entité ou une suppression en conflit retournent un diff et la version courante. Pour un ajout au même intervalle, utiliser un ordre stable si les deux ajouts gardent du sens, sinon demander un arbitrage. Un déplacement protège aussi ses sections dépendantes. Une publication vérifie la tête exacte qui a été relue.
## Calcul asynchrone et reprise
Le moteur reçoit une empreinte des points, profil et options. La réponse est appliquée seulement si l’empreinte correspond encore. Pas d’appel réseau dans le verrou. Mettre en cache les résultats avec leur provenance et leur date, appliquer quotas et délai. Un échec laisse la trace précédente clairement marquée ou propose une section manuelle confirmée. Les métriques sont associées à la géométrie qui les a produites.
## Temps réel et perte réseau
Utiliser un canal privé Supabase autorisé par appartenance. Le canal diffuse la disponibilité d’une séquence et la présence. Les clients relisent les opérations autorisées depuis leur dernier curseur. Après reconnexion, récupérer les opérations manquantes ou un snapshot. Les mutations hors ligne sont rejouées dans leur ordre causal, avec idempotence et contrôle d’accès. La session peut perdre le droit de lecture. Comme l’autorisation d’un canal peut dépendre de son cycle de connexion, utiliser des événements minimaux, contrôler chaque lecture et invalidation d’accès, et vérifier la révocation sur un client déjà connecté.
## Droits, données et exports
Matrice RLS sur route, commentaires, propositions, révisions et fichiers. Lien en lecture seule à portée limitée, révocable, avec durée et audience explicites. Consentement distinct pour la position live. Protéger les URLs de médias et éviter de publier un point de départ privé par défaut. Pour GPX, conserver les segments et altitudes disponibles, valider les fichiers, préserver la source et tester l’export dans un lecteur externe.
> https://supabase.com/docs/guides/realtime/authorization
> https://www.postgresql.org/docs/current/explicit-locking.html
> https://www.topografix.com/GPX/1/1/index.htm
# Contrats prêts à transformer en tickets
## Les écritures et les lectures
## Commandes de l'éditeur
getRouteWorkspace retourne les droits, la tête du brouillon et la dernière publication. getRouteChanges(afterSeq) retourne les changements depuis le dernier curseur ou réclame une resynchronisation quand l'historique disponible commence plus tard. La réponse précise l'identifiant, la séquence et les versions d'entités.
applyRouteOperation reçoit routeId, opId, baseSeq, kind, payload et expectedVersions. Exemples de kind. moveWaypoint, setSectionMode, applyRoutingResult, splitDay, moveDayBoundary, attachStop, acceptProposal. Réponses attendues. applied, alreadyApplied, conflict ou denied. Un conflit porte les objets touchés et leur état autorisé. Un opId rejoué avec un contenu différent est rejeté.
publishRouteRevision reçoit routeId et expectedHeadSeq. Le serveur valide géométrie, dates, droits et état des alertes essentielles avant de figer la version. L'organisateur peut accepter une inconnue explicitement quand elle ne constitue pas un blocage métier. L'écriture enregistre résumé, version parente, horodatage et dépendances à revalider.
getRoutePackManifest(revisionId) expose les éléments autorisés et leur empreinte. markPackReady reçoit une version et une confirmation de vérification locale. startActivity reçoit routeId, revisionId et kitSnapshotId. Le bilan pointe vers ces identifiants même si la publication a changé.
## Exemple concret de conflit
État commun à la séquence 42. Mina modifie la note de J2, Éloi déplace le refuge de J1. Les opérations passent aux séquences 43 et 44 car leurs entités sont indépendantes. Alice déplace le même refuge depuis l'état 42. Elle reçoit le point déplacé en séquence 44 et peut garder la version actuelle, sauvegarder sa proposition ou demander un recalcul. Chaque choix entraînant une mutation repart des versions courantes.
## Transition des voyages existants
Lire d'abord la structure existante et identifier la source qui fait foi pour les traces. Ajouter les champs de référence en lecture compatible. Sur la cohorte pilote, convertir les géométries existantes une fois, conserver la source de l'import et comparer les distances, le nombre de sections et d'étapes. Pendant la transition, sélectionner une seule source d'écriture par voyage. En cas de repli, conserver révisions, packs et références aux activités existantes.
## Quatre écrans à recetter ensemble
- Carte et liste. Modifier une section, ouvrir son profil, créer une variante puis aller à l'étape suivante depuis le clavier ou le mobile.
- Équipe. Voir état et rôle, ouvrir une proposition, comparer les versions et relire la décision.
- Départ. Voir « version téléchargée », « version recommandée » et les éléments qui demandent confirmation.
- Retour. Consulter trace réelle, écarts au plan, matériel emporté et action « Reprendre cette sortie ».
# Qualité, métriques et mise en œuvre
## Conditions de livraison
## Lot 0 · Fiabiliser le point de départ
Build reproductible, contrôle de la version servie, écran Compas utilisable sans WebGL, retour vers le brouillon après connexion. Jeu de traces et de données anonymisées, deux comptes de recette et version de référence des parcours.
## Lot 1 · Éditeur et préparation
Édition routée/manuelle, persistance, import/export GPX, découpage et notes par jour, prévision et repères datés. Réutiliser la météo existante et la préparer par fenêtre de passage. Afficher la vigilance officielle selon couverture et préserver l’état inconnu. Prendre en compte la différence entre règles du fournisseur, données du graphe et vérification terrain.
> https://www.data.gouv.fr/dataservices/api-bulletin-vigilance
> https://github.com/valhalla/valhalla/blob/master/docs/docs/api/route/api-reference.md
## Lot 2 · Équipe et conflits
Invitations et rôles, deux éditeurs, journal et diff, propositions, commentaires ancrés et reconnexion. Recette en navigateur mobile, deux comptes, opérations au même instant et révocation. Publier sur une tête vérifiée et relier au premier événement de club.
## Lot 3 · Terrain, matériel et carnet
Packs versionnés, détection de changements, confirmation de téléchargement, guidage avec la version choisie, rattachement du kit et du bilan réel. Rejouer après fermeture de l’app, couper le réseau et remettre le réseau pendant un changement. Contrôler l’autorisation d’usage hors ligne des fonds utilisés.
## Seuils proposés et protocole
- Édition. Sur 20 scénarios avec deux éditeurs, aucun changement indépendant perdu et aucun écrasement silencieux. Répéter en mode avion, avec suppression concurrente et serveur temporairement indisponible.
- Départ. Au moins 19 packs sur 20 s’ouvrent entièrement après fermeture et mode avion sur iOS et Android sélectionnés. Identifier toute version obsolète en présence d’une connexion et conserver le dernier pack complet.
- Temps réel. Sur un réseau de recette défini, visibilité d’un changement accepté en moins de 1,5 s au p95. Mesurer séparément le routage réclamant un fournisseur.
- Intégrité. Toutes les recettes d’accès passent. Tous les exports du jeu de référence conservent points attendus, sections, jours et dates disponibles. Un rejeu d’opération produit un seul résultat.
- Utilité. Comparer six équipes sur quatre tâches, même brief et mêmes traces. Mesurer délai jusqu’au plan partagé, ressaisies, erreurs de version, et nombre de personnes capables de partir hors réseau. Comparer une fois le produit testé.
## Lecture du benchmark
La planification partait de 18/40. Chaque groupe P1 à P4 atteint 10/10 après validation de ses cinq contrôles. La coédition et la route versionnée améliorent C3 selon la recette. La préparation du pack et l’enregistrement reprennent les contrôles terrain séparément. Le « 20/10 » désigne la valeur supplémentaire du parcours collectif complet, mesurable avec les tâches ci-dessus.
