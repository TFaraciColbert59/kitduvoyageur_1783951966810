# LKDV — Le préparateur d’aventures universel
Vision de refonte, raccordement de l’existant et feuille de route — 30 septembre 2026.

**Promesse proposée : « Dis-moi ce que tu veux vivre. LKDV organise une aventure adaptée à toi, à ton groupe, à ton matériel et aux conditions, puis t’aide à l’ajuster. »**

Ce document propose une cible produit. Il s’appuie sur une lecture ciblée de 35 fichiers du dépôt à la révision 4f5764e3986fe98f57f192a899f111e2c8a7ce4a, des requêtes de lecture dans le projet Supabase connecté et les documentations publiques des fournisseurs. Les fonctionnalités proposées ne sont pas toutes disponibles aujourd’hui. Aucun code de l’application ni aucune donnée métier n’ont été modifiés. Aucun parcours n’a été exécuté dans l’application déployée et aucune réservation ni clé de production n’a été testée.

## 1. La décision structurante : une aventure, à toutes les échelles

Une course de 60 minutes, un week-end en groupe et un voyage de 30 jours utilisent le même plan. La quantité de questions, les informations affichées et les calculs dépendent du contexte.

Le voyage contient des journées ; chaque journée contient des déplacements, activités, pauses et nuitées. Une randonnée, une visite Viator ou un running matinal est une activité à l’intérieur de ce voyage. Elle peut également exister seule. Ajouter une course au Japon ne doit jamais obliger à sortir du voyage pour créer un deuxième dossier sans lien.

Le plan conserve l’intention, les choix, les réservations, les contraintes, le matériel attribué et les inconnues. La carte, le Hub, la préparation, le suivi et le carnet lisent ce même plan.

| Échelle | Décisions demandées | Résultat utile |
| --- | --- | --- |
| Running 1 h | Départ, durée, horaire, allure ou effort souhaité ; préférences déjà connues proposées à confirmation | Boucle adaptée, temps estimé, terrain, météo au passage, retour prévu, essentiels |
| Sortie à la journée | Participants, transport d’accès, objectifs, retour maximal | Parcours, pauses, eau, repas, matériel, conditions, solution de retour |
| Week-end / trek | Dates, nuitées, autonomie, groupe, budget | Étapes cohérentes, couchages, répartition du matériel, ravitaillement, alternatives |
| Voyage 1 mois | Grandes envies, régions, rythme, contraintes fixes, budget | Vue globale et journées détaillables, transports, hébergements, activités, documents et coûts suivis |
| Activités spécialisées | Compétences, encadrement et contraintes spécifiques | Module adapté au sport et à la couverture de données réellement disponible |

Une courte sortie peut nécessiter une préparation importante en terrain difficile ; un long séjour simple peut demander peu de réglages. La durée ne doit donc pas être le seul critère d’adaptation.

**Le principe produit : utiliser toutes les briques LKDV pertinentes, puis n’afficher que ce qui aide à décider maintenant.**

## 2. Ce que LKDV possède déjà, et ce que cette inspection démontre

Les comptages SQL exacts réalisés pendant cette étude donnent :

| Domaine | État observé dans la base connectée | Conséquence |
| --- | --- | --- |
| Catalogue activités | 43 entrées | Partir du catalogue, définir des capacités par activité |
| Randonnées | 1 170 entrées, dont 1 139 avec géométrie non nulle | Réutiliser ce catalogue, vérifier qualité et couverture avant proposition |
| POI de sentiers | 1 811 entrées | Les sélectionner le long des étapes utiles |
| Inventaire et kits | 47 entrées product_ownership, 25 materiel_kits | Raccorder les possessions au calcul des besoins |
| Voyages et plans | 36 trips, 14 adventure_plans | Étendre le modèle existant et clarifier son autorité |
| Communauté | 20 publications, 35 carnets, 5 relations de suivi | Amorcer la recommandation avec les contenus autorisés |
| Historique | 20 hike_sessions | Vérifier exploitabilité et consentement avant apprentissage |
| Intelligence apprise | 0 user_performance_profiles, 0 terrain_reports, 0 trail_segments | Prévoir un démarrage sans historique et une alimentation progressive |
| Réservations | 0 bookings | La table existe ; ce comptage ne prouve pas un checkout opérationnel |

Ce sont des volumes de lignes, pas des nombres de clients actifs, ni une preuve que les données sont toutes issues d’usages réels. Les statistiques du simple inventaire de tables étaient parfois périmées ; les nombres ci-dessus proviennent de COUNT(*). Une géométrie présente ne prouve ni sa validité ni l’accessibilité actuelle du parcours. La couverture mondiale n’est pas établie.

Le code offre déjà un socle précieux :

- Une route /prepare et un nouveau flux activité → destination → itinéraire → départ.
- Un objet AdventurePlan avec 19 sections, provenance, confiance, versions et décisions.
- Des moteurs de parcours, météo, équipement, budget, cohérence, groupe et alternatives.
- Une infrastructure IA avec fournisseurs, quotas, repli et jobs.
- Des adaptateurs RouteStack et Viator, du matériel, des voyages, du suivi et des briques hors ligne.

Sources : [entrée /prepare](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/app/prepare/page.tsx), [flux](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/adventure-prep/components/PrepFlow.tsx), [AdventurePlan](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/adventure-intelligence/domain/adventurePlan.ts), [génération serveur](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/adventure-intelligence/server/generateAdventure.ts).

**Quatre raccordements prioritaires sont visibles dans les fichiers inspectés.**

1. **Préservation du plan.** La sauvegarde du nouveau flux envoie essentiellement une phrase, des coordonnées et weatherDays. Elle ne transmet pas le programme détaillé, les étapes conservées, les affectations du sac ou l’ensemble des participants sous une forme structurée. Le serveur peut produire un plan, mais ce passage ne garantit pas qu’il reproduise tous les choix de l’écran. Il faut sauvegarder une version exacte du plan accepté. [Source](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/adventure-prep/adventureRequest.ts)
2. **Durée du voyage.** draftText réutilise draftWeatherDays, borné à sept jours. Un brouillon de 30 jours devient donc « sur 7 jours » dans le texte envoyé. Séparer durée, dates et horizon météo est un préalable à la promesse d’un mois. [Source](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/adventure-prep/adventureRequest.ts)
3. **Matériel personnel.** Le moteur du nouveau flux génère des besoins par activité ; l’adaptateur serveur examiné indique explicitement un inventaire non fourni. Le raccordement à product_ownership et aux disponibilités des participants doit devenir effectif. [Besoins](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/adventure-prep/engine/gear.ts), [adaptateur](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/adventure-intelligence/server/adapters/gearAdapter.ts)
4. **Données envoyées à l’IA.** Le prompt d’itinéraire inspecté reçoit surtout les préférences du formulaire et les lieux de départ/arrivée. Il faut enrichir cette entrée avec des candidats LKDV autorisés, sélectionnés et vérifiés. La phase intitulée « disponibilités » annote actuellement les étapes à réserver ; elle ne consulte pas les fournisseurs dans ce module. [Prompt](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/adventure-prep/engine/aiItinerary.ts), [phases](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/adventure-prep/engine/itineraryPhases.ts)

Ces constats concernent les chemins inspectés sur cette révision. Ils ne constituent pas un audit exhaustif de toutes les branches ou du déploiement.

## 3. Une entrée immédiate, puis des questions utiles

L’accueil du préparateur propose une phrase ou des choix rapides :

- « Courir une heure autour de moi avant le dîner. »
- « Trois jours en train avec deux amis, nature et petit budget. »
- « Un mois avec randonnée, villes et plongée, sans changer d’hôtel tous les soirs. »
- « Reprendre ce carnet avec mon matériel et mon rythme. »
- « Je dispose de ce week-end et de ce sac : propose-moi une destination. »

Les autres points d’entrée sont une randonnée LKDV, un POI de carte, une publication, un carnet, une sortie de club, un kit ou un voyage existant. Tous deviennent une intention préremplie dans le même préparateur, avec attribution et permissions conservées.

L’IA demande seulement les informations qui peuvent changer la proposition : date, durée, retour impératif, budget, composition du groupe ou contrainte importante. Les préférences apprises sont affichées comme choix modifiables. Une destination peut rester ouverte ; un budget peut rester inconnu.

Le système présente jusqu’à trois variantes réellement distinctes, par exemple calme, équilibrée et plus soutenue. Chaque variante précise ses différences : temps de déplacement, effort, coût connu et estimé, souplesse, points restant à vérifier. Éviter trois itinéraires presque identiques maquillés par des titres.

L’utilisateur peut modifier un curseur ou dire « moins de voiture », « garde cet hôtel », « ajoute une journée libre ». Les contraintes déjà validées restent visibles.

## 4. L’expérience Apple / Liquid Glass proposée

La direction « iOS 27 » désigne ici l’intention visuelle demandée. Une application web/Capacitor doit reproduire soigneusement les comportements nécessaires ; elle n’hérite pas automatiquement de toute l’interface native.

**Écran d’intention.** Grand titre court, phrase saisissable, suggestions contextuelles et quelques paramètres éditables. Une action principale : « Proposer mon aventure ». La typographie système et les espacements portent la hiérarchie ; les exemples ne ressemblent pas à une liste de paramètres techniques.

**Écran de proposition.** Carte persistante, résumé compact et variantes comparables. Une barre flottante en Liquid Glass permet de changer la vue ou d’ouvrir l’assistant. Le parcours sélectionné reste visuellement dominant. Le profil d’altitude est relié au point survolé ou touché sur la carte.

**Écran d’ajustement.** Trois niveaux : « Voyage », « Jour », « Activité ». Le rail des jours apparaît seulement pour plusieurs jours et se regroupe par semaine pour un mois. Sélectionner J12 focalise la carte sur cette journée et les liaisons utiles. L’hôtel de la veille et celui du soir restent compréhensibles.

**Tiroirs.** Les feuilles du bas permettent de modifier une étape, le sac, l’équipe, le budget ou une réservation sans perdre le contexte. Un seul tiroir actif, avec positions compactes et étendues, retour clair et focus restauré. Les longues listes défilent dans leur zone ; les tailles de texte agrandies ne sont jamais coupées pour imposer artificiellement un écran sans scroll.

**Écran de départ.** Montrer les décisions encore nécessaires, les dernières conditions disponibles, les affaires à préparer et le téléchargement hors ligne. L’action principale dépend de la situation : enregistrer, compléter ou démarrer. Un état « prêt » reste limité aux vérifications couvertes.

**Pendant l’activité.** Carte lisible, prochaine instruction, temps restant et alertes prioritaires. Les surfaces deviennent plus contrastées en mode extérieur. L’assistant n’occupe pas l’écran en permanence.

Apple décrit Liquid Glass comme une couche fonctionnelle de navigation et de commandes au-dessus du contenu. Cela conduit à utiliser le verre sur les barres et contrôles, avec des surfaces stables pour les prix, programmes et alertes. Prévoir mouvement réduit, transparence réduite, contraste, VoiceOver, clavier, safe areas et cibles tactiles d’au moins 44 points CSS comme cible de conception web. [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/materials)

Les transitions expliquent ce qui se déplace : la fiche se relie au POI, la journée sélectionnée recentre la carte, une modification souligne uniquement les éléments touchés. Les effets continus de fond doivent rester facultatifs et s’arrêter quand ils n’aident plus la lecture ou l’autonomie.

## 5. Comment tout LKDV sert réellement la préparation

| Brique | Informations utilisables | Décision améliorée |
| --- | --- | --- |
| Profil | Préférences déclarées, expérience par sport, accessibilité choisie | Sélection de propositions adaptées et questions pertinentes |
| Historique | Durées, distances, terrain, retours volontaires | Fourchette de durée personnalisée, quand l’historique est suffisant |
| Inventaire | Objet possédé, poids, état, quantité, entretien, prêt | Sélection du sac réellement disponible |
| Kits | Composition et retours d’utilisation | Point de départ pour une préparation nouvelle |
| Randonnées LKDV | Trace, longueur, terrain et métadonnées disponibles | Candidats sourcés et modifiables |
| Carte et POI | Eau, repos, transport, logement, accès et services | Étapes réalisables et marges d’autonomie |
| Carnets | Parcours publiés, moments, commentaires et matériel associé | Transformer une inspiration en proposition contextualisée |
| Publications et favoris | Contenus autorisés et goûts explicitement enregistrés | Réutiliser un lieu ou un thème qui intéresse la personne |
| Amis et clubs | Sorties visibles, disponibilités partagées, niveaux déclarés | Trouver une occasion de se rejoindre |
| Groupe | Contraintes, consentements, rôles, matériel commun | Programme compatible et partage des tâches |
| Météo et terrain | Conditions datées sur le trajet et aux heures estimées | Horaire, variantes, équipement et décision de relecture |
| Viator | Expériences, durée, point de rendez-vous, exigences | Activité insérée dans une vraie journée |
| RouteStack | Offres vols, hôtels et voitures selon accès | Liaisons et nuitées compatibles avec le programme |
| Boutique / affiliation | Offres vérifiées correspondant à un besoin | Combler une lacune justifiée |
| Budget et documents | Dépenses, engagements, billets, conditions | Coût suivi et prochaine démarche |
| Récompenses | Contributions utiles et confirmées | Encourager les retours de qualité sans encourager le risque |

Chaque connexion doit avoir un effet mesurable sur le plan. Ajouter un badge « personnalisé » sans modifier une décision ne suffit pas.

## 6. La communauté devient une aide à décider

**Le carnet réutilisable.** « Préparer une aventure inspirée de ce carnet » reprend les lieux et étapes partageables, crédite l’auteur et réévalue dates, conditions, budget et difficulté. Le temps réalisé par une autre personne reste une observation contextualisée.

**La recommandation expliquée.** Une fiche peut indiquer : « Enregistré dans tes favoris » ou « Recommandé dans deux carnets consultables ». Elle précise la date et les raisons utiles. La popularité seule ne prouve ni la sécurité ni l’adéquation.

**Les rencontres possibles.** LKDV détecte un recoupement entre le programme et une sortie volontairement visible d’un ami ou d’un club. Il propose une jonction avec impact sur trajet et horaire. Envoyer l’invitation, s’inscrire et partager sa position restent des actions explicites.

**Le groupe adaptable.** Chacun fournit les contraintes qu’il souhaite partager : horaires, budget, effort acceptable, équipement disponible. Le plan tient compte du participant limitant pour une activité commune. Il peut proposer une activité facultative avec point et heure de retrouvailles clairs.

**La mémoire de terrain.** Un retour « point d’eau fermé », « passage boueux » ou « ombre rare à midi » porte date, zone, auteur ou agrégat autorisé, corroboration et durée de validité. L’absence de signalement ne devient jamais une preuve d’absence de problème.

**Le démarrage sans communauté.** Avec peu de données, utiliser les préférences déclarées et les sources géographiques, en indiquant l’absence de retours récents. Ne pas produire de faux avis, faux amis ou statistiques de voyageurs similaires.

Les messages privés, positions exactes et habitudes de tiers ne doivent pas être envoyés automatiquement à l’IA. La personnalisation, le partage avec le groupe, la localisation de sécurité et l’apprentissage collectif ont des finalités séparées et révocables. Les points de départ à domicile restent masqués dans les publications proposées.

## 7. Le sac devient une partie du programme

Le système commence par les besoins de chaque activité et les conditions attendues. Il cherche ensuite les objets de l’utilisateur, puis ceux que les participants ont proposé de partager. Les options d’emprunt, de location et d’achat répondent aux besoins restants.

Les états sont distincts : possédé, disponible aux dates, attribué, compatible, préparé. Un objet prêté ou en maintenance n’est pas considéré disponible. Une case « emballé » ne prouve pas à elle seule l’adéquation au terrain.

Fonctions à relier :

- Eau, nourriture, carburant et batterie calculés par tronçon d’autonomie, avec hypothèses explicites et possibilité d’ajustement.
- Poids porté, poids consommable et équipement porté sur soi séparés ; poids inconnus visibles.
- Répartition du matériel partagé selon accord et contraintes de chaque membre.
- Volume du sac, compatibilités et autonomie énergétique lorsqu’ils sont renseignés.
- Tenue et équipement adaptés aux horaires, à l’altitude et aux activités prévues.
- Lessive et réapprovisionnement pour éviter de préparer trente tenues pour trente jours.
- Contraintes de bagage du transport réservé : dimensions, poids, objets particuliers et source des règles.
- Retour d’usage : matériel emporté mais inutilisé, élément manquant, entretien à prévoir.

Exemple de synergie proposée : remplacer deux bivouacs par des nuitées en hébergement déclenche une nouvelle proposition de sac ; le sac allégé peut modifier l’estimation d’effort ; le programme et le budget montrent ensuite leurs écarts. Rien de réservé n’est annulé automatiquement.

## 8. Le moteur de faisabilité : temps, terrain, conditions, marge

Un trajet doit être validé sur le réseau adapté à l’activité. La trace d’un GR ne prouve pas qu’un itinéraire est autorisé à vélo, qu’un passage est accessible en fauteuil ou qu’une boucle convient à un débutant.

Le moteur doit combiner ce qui est disponible : distance, D+/D−, altitude maximale, pente, revêtement, technicité, exposition, traversées, accès, météo au passage, luminosité, échappatoires et capacités déclarées. La difficulté physique, la difficulté technique et les dangers conjoncturels restent séparés.

Pour le voyage, ajouter les temps d’accès porte à porte, transferts, marges de correspondance, horaires d’ouverture, rendez-vous, check-in, fuseaux horaires, fatigue de déplacement, jours de repos et contraintes réservées.

**Une alerte explique une cause et une action.** Par exemple : « L’arrivée estimée dépasse l’horaire limite d’accueil ; avancer le départ ou contacter l’hébergement. » Le moteur doit pouvoir afficher une information manquante et sa conséquence.

La météo est associée au lieu, à l’altitude pertinente et à l’heure estimée. Pour un voyage lointain, distinguer tendances saisonnières et prévisions à échéance disponible, puis affiner à l’approche. Un mois de voyage ne reçoit pas trente jours de météo locale prétendument certaine. Les horizons et résolutions varient selon les modèles. [Documentation météo](https://open-meteo.com/en/docs)

Les prévisions ne remplacent pas les alertes officielles. Intégrer progressivement des sources par région : Météo-France, Meteoalarm, autorités locales et gestionnaires de terrain. Les bulletins avalanche sont à l’échelle des massifs ; ils ne certifient pas chaque pente. En mer, Open-Meteo précise que ses données côtières ne conviennent pas seules à la navigation. [Meteoalarm](https://api.meteoalarm.org/), [BRA](https://portail-api.meteofrance.fr/web/api/DonneesPubliquesBRA), [Marine](https://open-meteo.com/en/docs/marine-weather-api)

Pour l’eau, la neige, la montagne technique et les activités aériennes, créer des modules de contraintes propres au sport et des exigences d’encadrement ou de validation pertinentes. Une météo favorable ne remplace pas une compétence ou une autorisation.

La couverture devient une information produit : zone couverte, source vieillissante, bulletin absent, donnée non applicable. Un bouton vert global « sans danger » n’a pas sa place dans ce modèle.

## 9. Viator et RouteStack deviennent des éléments du voyage

**Viator.** Une expérience proposée comprend son point de rendez-vous, sa durée, les participants acceptés, les disponibilités accessibles, le matériel inclus, les conditions et les détails de réservation. Elle doit tenir dans la journée en incluant les déplacements et marges.

Les niveaux Basic, Full et Full+Booking donnent des droits différents. La réservation intégrée dépend de l’accès et de la certification ; l’intégration LKDV inspectée prévoit actuellement une redirection externe sous contrôle d’un flag. Il faut construire l’interface selon les droits réels du compte. [API](https://docs.viator.com/partner-api/technical/), [certification](https://partnerresources.viator.com/travel-commerce/certification/), [code LKDV](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/booking/server/viatorBookingProvider.ts)

**RouteStack.** L’intégration actuelle couvre vols, hôtels et voitures. Un vol renseigne le voyage et ses contraintes ; l’hôtel devient une étape fixe ; la voiture structure les points de prise et retour. Le site annonce aussi des activités, mais leur accessibilité effective à LKDV n’est pas établie. Trains, bus et ferries nécessitent des sources complémentaires ou une saisie/import vérifiable. [RouteStack](https://www.routestack.ai/), [code LKDV](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/booking/server/routeStackBookingProvider.ts)

Le sandbox RouteStack utilise des données mises en cache sur un sous-ensemble de destinations. Le fournisseur affiche une offre live payante à partir de 49 USD/mois après une allocation de découverte ; les droits et coûts du compte LKDV restent à vérifier. L’IA gratuite ne rend donc pas toutes les autres API gratuites.

**États indispensables :** suggestion, prix indicatif, disponibilité vérifiée à une date, à réserver, réservation en attente, confirmée par le fournisseur, annulée. Un clic affilié ne marque pas la réservation comme confirmée. Une confirmation externe importée doit préciser sa provenance.

Les offres conservent fournisseur, référence, devise, date de vérification, inclusions et conditions. Revalider ce qui peut changer avant l’engagement. Respecter les règles de cache, d’affichage et d’attribution du fournisseur. Le rythme de mise à jour Viator dépend des endpoints ; éviter un TTL universel. [Guide de certification](https://partnerresources.viator.com/travel-commerce/certification/)

Le classement doit servir la pertinence, le budget et la faisabilité. LKDV possède déjà un moteur qui n’utilise pas la commission dans son classement : le conserver et l’enrichir. [Source](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/features/adventure-intelligence/domain/affiliationRanking.ts)

## 10. Ce que Nemotron doit faire

L’IA comprend une intention, pose une question utile, combine des candidats connus, explique un compromis et propose une modification. Les moteurs vérifient les contraintes et les fournisseurs apportent les faits externes.

Le code référence Nemotron Ultra free et Lightning free via OpenRouter, avec une règle refusant les modèles payants. Il peut aussi choisir un fournisseur NVIDIA selon les clés disponibles ; l’environnement actif n’a pas été inspecté. [OpenRouter LKDV](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/lib/ai/providers/openrouter.ts), [sélecteur](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/4f5764e3986fe98f57f192a899f111e2c8a7ce4a/src/lib/ai/providers/index.ts)

Les variantes sont listées publiquement ; la fiche Lightning précise notamment que le format JSON n’est pas imposé via response_format. Il faut valider systématiquement les sorties plutôt que supposer leur conformité. Les accès gratuits ont des limites et une disponibilité variable. [Ultra](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free), [Lightning](https://openrouter.ai/nvidia/nemotron-3.5-lightning:free), [limites](https://openrouter.ai/docs/api_reference/limits)

Architecture proposée :

1. Charger le contexte autorisé : préférences utiles, inventaire disponible, contraintes du groupe et souvenirs pertinents.
2. Chercher des candidats réels par zone, activité et date ; réduire cet ensemble avant de le présenter à l’IA.
3. Construire un premier plan avec des règles et des références stables.
4. Demander à Nemotron une proposition ou une explication structurée.
5. Valider types, identifiants, heures, coordonnées, compatibilités et citations côté serveur.
6. Présenter une proposition diffusable avec hypothèses et inconnues.
7. Enregistrer une version exacte après acceptation, puis recalculer uniquement les dépendances touchées.

Le texte externe, les commentaires et les fiches fournisseurs sont des données non fiables, jamais des instructions autorisant l’agent à agir. L’accès aux outils, aux données privées et aux opérations de réservation reste contrôlé par l’application.

Pour trente jours, produire d’abord une ossature cohérente, puis enrichir les journées utiles à la demande ou dans un travail borné. Le fichier actuel fixe 4 096 tokens de sortie pour l’itinéraire : cela ne garantit pas trente journées détaillées. Éviter un seul mégaprompt qui transporte tout le voyage à chaque retouche.

Une sortie invalide reçoit au maximum une réparation ciblée, puis un repli explicite. Prévoir annulation, délai maximal, cache autorisé, déduplication des requêtes, budget d’appels par plan et file limitée. Aucun changement silencieux vers un modèle payant. Le plan existant reste consultable même sans réponse IA.

## 11. Les fonctions qui peuvent donner une identité propre à LKDV

**« Que puis-je faire avec ce que j’ai ? »** Partir du sac disponible, des dates et du départ pour proposer des aventures réalisables. Le matériel devient une porte d’entrée vers le voyage.

**« Une aventure inspirée de ce carnet, adaptée à nous. »** Reprendre une inspiration publique et produire une version avec vos dates, votre transport, votre rythme et votre équipement ; les sources restent visibles.

**« Rejoindre sur une partie du parcours. »** Croiser volontairement des aventures pour partager une étape, un déjeuner ou une sortie, en précisant le détour et les contraintes.

**« Une surprise qui tient dans la journée. »** Proposer un détour, un point de vue ou une expérience lorsque les marges de temps, de budget et d’effort le permettent. Respecter la volonté de laisser du temps libre.

**« Alléger l’aventure. »** Un réglage réduit la charge de déplacement, le poids du sac ou le coût ; le système montre ce qui change et les compromis. Les choix verrouillés restent conservés.

**« Mon plan B existe déjà. »** Une variante courte, abritée ou plus accessible est préparée avec ses conditions d’utilisation. Elle reste une proposition à revalider.

**« Le programme tient compte de l’autonomie. »** Le dernier ravitaillement crédible détermine une partie de l’eau à emporter ; la batterie disponible influe sur le besoin de recharge ; un hébergement avec lessive allège le sac.

**« Ce qui reste libre. »** Les plages sans réservation sont assumées et visibles. Un bon voyage peut conserver de la souplesse au lieu de maximiser le nombre d’activités.

**« Un retour qui améliore la prochaine sortie. »** Après l’activité : quelques confirmations sur temps réel, difficulté ressentie, matériel et conditions. Le carnet et la publication sont proposés comme brouillons. Les apprentissages sont contextualisés ; une sortie difficile ne redéfinit pas définitivement le niveau.

Ces fonctionnalités sont des propositions de conception. Leur valeur doit être testée avec des utilisateurs ; elles ne sont pas présentées comme uniques sur le marché.

## 12. Deux parcours cibles

**Course de 60 minutes.** L’utilisateur indique le départ et l’heure limite. LKDV propose une boucle issue du réseau utilisable, avec estimation adaptée ou hypothèse de rythme explicite. La carte montre le terrain, les conditions et les points utiles. Les besoins restent proportionnés au contexte. L’utilisateur peut raccourcir, éviter une côte ou rejoindre une sortie visible. Un écran de vérification suffit avant le suivi. Aucun dossier hôtel n’apparaît.

**Voyage de 30 jours.** L’utilisateur décrit régions, activités et rythme. LKDV construit les grandes liaisons et journées d’abord, vérifie la cohérence des dates et propose les nuitées. Il enrichit chaque jour avec randonnées LKDV, POI, inspirations communautaires et expériences réservables. Un running matinal utilise le même profil et le même inventaire. Les réservations sont verrouillées ; les parties souples restent modifiables. La météo future est indiquée comme tendance ou inconnue, puis devient plus précise au fil du temps. Le carnet se prépare à partir des étapes réellement vécues.

## 13. Le raccordement technique à privilégier

Conserver AdventurePlan comme contrat de planification et clarifier la relation avec trips et ses enfants, qui portent l’exécution du voyage. Définir l’autorité de chaque champ : on évite ainsi deux versions concurrentes du programme.

Étendre les modèles et adaptateurs existants avant de créer des domaines parallèles. Le brouillon sert à l’édition ; la sauvegarde transmet une version structurée complète avec une version attendue. Le serveur vérifie propriétaire, droits, champs modifiables et cohérence avant d’écrire.

Chaque élément du plan doit porter, selon son type : identité, origine, activité/journée, horaire avec fuseau, durée, géométrie ou lieu sourcé, coût et devise, statut, dépendances, verrouillage, dernière vérification et validité. Le contexte personnel reste minimal et filtré.

Un changement d’hôtel invalide les trajets et horaires liés. Un changement d’heure invalide les conditions météo associées. Une modification du groupe invalide certains besoins partagés et disponibilités. Les sections indépendantes sont conservées.

La validation d’un changement présente un aperçu des écarts ; les réservations et décisions importantes nécessitent une confirmation spécifique. Les événements de mise à jour sont idempotents et l’historique permet de revenir sur les modifications réversibles.

Supabase peut continuer à héberger les données relationnelles et spatiales déjà présentes. Ne pas importer des catalogues mondiaux entiers pour une recherche locale ; utiliser des sélections spatiales, caches bornés et règles de licence. Les droits sont vérifiés aussi lors de la récupération du contexte pour l’IA, pas seulement dans l’interface.

Le mode hors ligne précise ce qui a été téléchargé : plan, trace, tuiles autorisées, notes, documents et état des conditions au dernier rafraîchissement. Une position partagée n’est pas garantie sans réseau. Les opérations locales se synchronisent avec gestion des conflits et sans duplication.

## 14. Feuille de route proposée, par résultats vérifiables

| Priorité | Livraison | Critère concret |
| --- | --- | --- |
| P0 | Préserver dates, durée, étapes, participants et sac lors de la sauvegarde | Un voyage de 30 jours relu après connexion est identique aux choix validés |
| P0 | Unifier nouvelle préparation et modification d’une aventure existante | Même plan et mêmes actions, depuis /prepare et le Hub |
| P1 | Réussir une sortie locale de bout en bout | Parcours réel, météo pertinente, inventaire, sauvegarde, départ et retour |
| P1 | Réussir un voyage avec plusieurs étapes | Horaires, fuseaux, liaisons et nuits cohérents, étapes modifiables |
| P2 | Connecter les offres réellement autorisées | Prix et disponibilités datés, sandbox distinct, états de réservation fiables |
| P2 | Ajouter la personnalisation sociale utile | Carnet réutilisable, favoris et sortie de club visibles selon permissions |
| P3 | Recalcul des dépendances et alternatives | Une modification conserve les verrous et explique les impacts |
| P3 | Hors ligne, suivi, débrief et apprentissage | Reprise sans perte, retours attribués et usages consentis |
| P4 | Étendre zones, sports et sources officielles | Chaque extension affiche sa couverture et ses limites |

Les étapes décrivent des résultats, pas des promesses de calendrier. La première livraison doit couvrir une tranche entière du parcours avant d’ouvrir de nombreux modules simultanément.

## 15. Validation finie, centrée sur les risques

Scénarios de référence :

- Running une heure avec retour maximal.
- Randonnée avec un point d’eau non confirmé.
- Week-end avec matériel partagé déjà prêté.
- Voyage de trente jours, avec plusieurs fuseaux.
- Activité Viator qui chevauche un transport réservé.
- Offre RouteStack expirée ou uniquement sandbox.
- Invitation sans accès au voyage et refus de partage de localisation.
- Quota IA atteint ou réponse JSON invalide.
- Modification hors ligne puis reprise sur un second appareil.
- Petit écran, texte agrandi, clavier et lecteur d’écran.

Pour chaque scénario retenu : vérifier la décision, sa sauvegarde, sa reprise et l’état d’erreur. Une inspection visuelle ciblée couvre carte, tiroirs, clavier et barres sur les formats pertinents. La CI existante fournit les contrôles requis.

Condition d’arrêt : les critères de la tranche sont satisfaits, les contrôles ciblés et gates obligatoires passent, les limites résiduelles sont écrites. On ne relance pas des suites inchangées sans risque nouveau et on ne poursuit pas des retouches sans critère produit.

Objectifs à mesurer ensuite : temps pour obtenir une première proposition utile, taux de sauvegarde/reprise, modifications nécessaires, violations de contraintes, part de recommandations sourcées, coût d’API par plan, latence perçue, utilité des alertes et réussite de reprise hors ligne. Aucun résultat chiffré de performance n’est revendiqué dans cette étude.

## 16. Recherche et limites fournisseurs

Recherche externe : 14 requêtes Exa à cinq résultats, soit 70 résultats demandés avant dédoublonnage, réparties sur cinq axes : distribution voyage, IA, météo/alertes, design Apple et inspirations produit. Ce nombre ne désigne pas 70 sources uniques lues intégralement. Les pages retenues proviennent des fournisseurs ou éditeurs eux-mêmes.

Komoot documente notamment parcours multi-jours, étapes et hébergements ; Wanderlog présente carte/itinéraire, réservations, collaboration et budget. Ces références orientent des patterns de conception, sans démontrer leur qualité d’exécution dans LKDV. [Komoot](https://www.komoot.com/premium/multiday-planner), [Wanderlog](https://wanderlog.com/)

La proposition LKDV mise sur la cohérence entre programme, matériel possédé, collectif et conditions. Les différences avec d’autres produits devront être évaluées avant toute revendication commerciale.

Points encore à vérifier avant implémentation des connecteurs : droits Viator et certification, clé live et couverture RouteStack, schémas effectivement exposés, quotas IA du compte, licences et budgets météo, sources locales de réglementation et conditions terrain. L’accès gratuit hébergé Open-Meteo est réservé au non-commercial ; une application monétisée doit choisir un accès compatible. [Tarification Open-Meteo](https://open-meteo.com/en/pricing)

**Décision recommandée : refondre l’expérience et son raccordement autour du plan d’aventure existant. La première preuve de réussite est simple : LKDV conserve ce que la personne a choisi, explique ce qui est vérifié, puis adapte utilement le reste.**

