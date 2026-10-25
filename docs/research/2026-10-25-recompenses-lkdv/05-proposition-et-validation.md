# Proposition produit et protocole de validation

Date : 25 octobre 2026. **Proposition de recherche, non activée.** Ce document fournit une direction concrète pour la phase suivante. Le barème final dépend des coûts rendus, du budget reçu et des droits historiques, encore inconnus. Il ne remplace pas la spécification technique détaillée qui suivra les décisions produit.

## 1. Choisir entre trois directions

| Option | Avantage | Coût / faiblesse | Avis |
|---|---|---|---|
| Unifier tous les soldes : XP, achats, cash créateur | Un seul nombre apparent | Fusionne des droits différents, rend la compétence achetable et les dépenses capables de modifier l’identité ; inventaire/migration difficiles | Écarter la fusion comptable |
| Points pour tout, comme le brief +5/+50/×3 | Explication immédiate et nombreux retours | Beaucoup de dépenses sur interactions très faciles ; course aux likes, contenu redondant, dépendance à la publication ; forte sensibilité à l’automatisation | Garder comme scénario de comparaison, pas comme défaut ouvert |
| Un solde de points dépensables + un objectif, gains liés à des réalisations utiles | Interface simple, valeur concrète, coût mieux contrôlé ; XP en détail | Demande des preuves et un financement ; un bon design de l’attente est nécessaire | **Direction recommandée pour le pilote** |

La recommandation est une synthèse raisonnée des [preuves](01-preuves-scientifiques.md), du [modèle économique](02-economie-et-cadre.md), des [benchmarks](03-ux-et-benchmarks.md) et de [l’audit réel](04-audit-existant.md). Aucune étude ne démontre que cette combinaison ou son barème est optimale pour LKDV.

## 2. Boucle visible de l’utilisateur

**Je choisis une récompense → je réalise une action utile → LKDV confirme un gain et sa raison → je vois mon objectif avancer → je réclame l’objet quand mes points et le stock le permettent.**

L’action vaut d’abord par son utilité : préparer une sortie, la vivre, documenter une information utile ou aider un autre membre. Le compteur donne un retour concret ; il ne rémunère pas toute présence dans l’application. Les premières satisfactions comprennent confirmation, souvenir, remerciement et petit avantage finançable : tout n’a pas à attendre un gros objet.

Le grand public voit « **points** » ou « **points LKDV** », écrits simplement, avec nombres entiers et séparation française des milliers. Les XP gardent ce nom dans Progression. Pas de diamant, crypto, taux cash implicite ou cinquième portefeuille exposé. Le nom et la taille des nombres sont des hypothèses de lisibilité, pas une conclusion neuroscientifique.

Dans Compte : solde confirmé, image de l’objectif et « acquis / requis ». Un appui ouvre Récompenses, puis catalogue ou historique. Dans les parcours éligibles : un rappel compact et un retour près de l’action ; aucune obligation d’afficher le solde au-dessus d’un SOS, d’une carte terrain, du clavier ou de chaque ligne de feed. Les spécifications d’animation et d’accessibilité sont dans [l’étude UX](03-ux-et-benchmarks.md).

## 3. Barème de départ à tester, pas à publier tel quel

Le scénario C du [simulateur](simulate-economy.mjs) est une base de discussion avec **plafond économique de 250 points/semaine**, indépendant des caps XP historiques. Un montant n’est annoncé comme gagnable que lorsqu’une enveloppe le finance déjà.

| Action | Hypothèse de gain dépensable | Limite illustrative | Preuve avant crédit / raison |
|---|---:|---|---|
| Like donné | 0 par défaut ; réaction et remerciement immédiats | Pas de dette monétaire par défaut | Le like reste libre, sans acheter la position d’un contenu dans le classement |
| Activité validée | 50 | 3/semaine | Réalisation canonique attribuable, qualité et plausibilité contrôlées ; aucune prime de vitesse, distance extrême ou météo dangereuse |
| Récit utile lié à une activité | +25 | 2/semaine | Contenu distinct, non copié, accepté selon des critères connus ; une activité privée garde sa base ; pas de ×3 à l’ouverture du partage natif |
| Aide ou correction utile acceptée | 25 | 2/semaine | Validation indépendante de la simple déclaration de l’auteur ; absence de double rôle ou d’auto-validation |
| Préparation pertinente terminée | 10 | 1/semaine | Contrôles dus et source persistée ; pas de gains répétés en cochant/décochant |
| Connexion, temps passé, clic, achat pour XP, badge, SOS, partage de localisation | 0 | — | L’usage essentiel et la confidentialité ne conditionnent pas la rémunération |

Ce plafond ne signifie pas que chacun doit atteindre 250, ni qu’une journée de randonnée doit devenir une cadence à maintenir. Les sous-plafonds totalisent 260 ; le simulateur applique un écrêtage hebdomadaire agrégé à 250 et ne simule pas l’ordre des événements. Pour le futur produit, proposition : gain entier accepté ou non attribué, jamais un +25 annoncé puis +15 silencieux. Si le reliquat ne permet pas le gain, annoncer avant l’action connue comme telle qu’elle ne donnera pas de points supplémentaires cette semaine ; aucune fermeture du programme n’empêche l’action utile elle-même. Le total réel peut donc rester inférieur à 250 selon l’ordre des gains. Les actions purement déclaratives ne deviennent pas éligibles parce qu’une ligne de barème existe : le producteur reste fermé tant que sa preuve manque. Les personnes ne pratiquant pas la randonnée ou n’utilisant pas le GPS doivent pouvoir accéder à des contributions utiles et à des récompenses selon des modalités vérifiables et accessibles. Ne pas inventer une preuve de présence ou imposer une collecte continue de localisation.

**Option sociale à tester séparément :** +5 pour la première réaction authentique éligible d’une journée, au plus trois jours par semaine, dans une sous-enveloppe plafonnée à 15 points/semaine **comprise dans le total de 250**, jamais 265. Une seule récompense par couple utilisateur/source, même après unlike/relike ; pas d’auto-like ; pas d’achat de visibilité et indication claire des réactions incitées. Ceci est une variante expérimentale, absente de la simulation C actuelle. Elle exige une étude de fraude/coût et du déplacement éventuel de gains d’activité par les gains sociaux avant activation ; sa simulation ne doit pas être confondue avec les résultats du script livré. La recherche sur les points sociaux symboliques justifie une hypothèse à tester, pas l’assurance qu’un like payé améliore la communauté.

La fidélité d’achat et les droits créateur restent décrits par leurs règles actuelles jusqu’à migration contrôlée. Une contribution ne doit pas produire simultanément un crédit du nouveau programme et un vieux crédit économique pour le même avantage. Un même fait peut produire une reconnaissance XP et un gain commercial si le contrat l’annonce explicitement ; ces deux unités ne s’additionnent jamais dans le solde visible.

## 4. Prix, échelle et délai : choisir dans cet ordre

1. **Délai acceptable par type d’utilisateur.** Hypothèses de recherche : un petit avantage concret accessible en quelques semaines d’usage occasionnel ; un objet plus cher comme objectif de moyen terme, sans promesse universelle. Faire tester les délais annoncés, pas seulement le nom des points.
2. **Coût livré vérifié.** Achat, taxes non récupérables éventuelles, préparation, livraison, retours, assistance et fraude résiduelle. Un prix public de 30 € ne dit pas combien LKDV doit payer.
3. **Enveloppe déjà financée.** Marge contributive réalisée et réservée, subvention marketing encaissée, financement partenaire reçu ou stock/prestation contractuellement sécurisé. Ni futur engagement commercial non sécurisé ni valeur supposée d’un like ne sont de la trésorerie.
4. **Taux d’émission et seuils.** Déterminer les points et les caps qui respectent les trois contraintes précédentes. Tester 100/250 comme petits paliers et 1 500/15 000 comme prix de lampe uniquement pour comparer, sans les promettre.
5. **Échelle de présentation.** Diviser TOUS les gains, prix et soldes par le même facteur conserve la générosité ; diviser seulement un prix l’augmente. Les décimales produites par une normalisation doivent être traitées explicitement, jamais arrondies au détriment des anciens droits.

Avec le profil occasionnel illustratif C à 27,5 points/semaine, 100 points représentent environ 3,6 semaines ; 1 500, environ 54,5 semaines. Avec le profil actif à 172,5, 1 500 représente environ 8,7 semaines. Ce n’est pas une prévision utilisateur : les fréquences sont des hypothèses du [JSON de simulation](simulation-economie.json). Cela montre qu’une même lampe peut être un objectif convenable pour un groupe et trop lointain pour un autre. Le catalogue doit proposer des satisfactions proches et des objectifs choisis, sans faux démarrage ni stock fictif.

Un programme « en circuit fermé » doit boucler **aussi financièrement** : les recettes ou financements couvrent les coûts engagés. Les points ne créent pas la ressource qui paie l’objet. Une limite par compte contrôle l’exposition individuelle ; elle ne résout pas les fermes de comptes. Avant de promettre un objet, réserver le budget correspondant et sa disponibilité selon des conditions connues. Quand le financement ne suffit plus, fermer les nouvelles offres avant l’action ; honorer les droits déjà acquis et proposer un recours.

## 5. Risques concrets et réponses

| Risque / comportement prévisible | Réponse produit et serveur |
|---|---|
| Like/unlike, bots, anneaux de likes | Source unique, quotas multi-échelles, contrôle relationnel proportionné et recours ; aucun bonus de visibilité algorithmique acheté par des réactions |
| Faux GPS, activités découpées ou GPX recopié | Réalisation canonique et contrôle de plausibilité ; déduplication inter-adaptateurs ; pas de prime au risque ou à la seule distance |
| Brouillons publiés/supprimés, récits IA répétitifs | Prime seulement au contenu utile accepté ; une édition n’est pas une nouvelle réalisation ; critères de modération lisibles |
| Validation collusive d’entraide | Séparer bénéficiaire, auteur et validateur ; limiter récidive de paires et doubles rôles ; revue humaine pour les cas contestés |
| Partage public imposé ou fuite de domicile | Aucune publication nécessaire à la base d’activité ; masquage géographique et partage choisi ; aucune prime au consentement |
| Découragement à 15 000 ou après plafond | Objectif choisi et jalons réels ; petits avantages financés ; arrêt clair des gains futurs, sans perte de série ou compte à rebours de pression |
| Inflation ou baisse de valeur après croissance | Budget d’émission par cohorte, version des offres et protection des anciens engagements ; aucune dévaluation silencieuse |
| Échange double, panne réseau, stock épuisé | Vérification du solde canonique ; réservation stock/débit atomique ; idempotence ; compensation ; reçu et suivi |
| Retours après récompense dépensée | Compensations liées à la source, conditions commerciales explicites ; remboursement légal non empêché ; pas de débit caché des XP |
| Solde indisponible ou validation lente | Distinguer erreur, attente et zéro ; délai honnête et support ; ne pas célébrer un droit inexistant |
| Mineurs, dépenses imposées, pression répétitive | Revue du parcours et des données adaptée à l’âge ; écarter mécanique compulsive/urgence artificielle ; conditions et portée DSA détaillées dans l’étude juridique |

Les contrôles ne doivent pas imposer une collecte invasive d’identités ou de positions à tous. Les signaux d’abus sont minimisés, conservés pendant une durée justifiée et contestables. Une baisse des notifications ou l’arrêt volontaire d’utilisation n’enlève pas des points acquis pour punir l’absence.

## 6. Expérimentation : prouver la valeur pour LKDV

### Phase A — compréhension et désirabilité

Prototype après accord sur les hypothèses, avec 8–12 personnes de profils différents : nouveau, occasionnel, contributeur actif, créateur, personne à mobilité réduite, texte agrandi/lecteur d’écran. Cette taille est un choix pratique qualitatif, sans prétention de représentativité. Montrer les mêmes scénarios : choisir un objet, recevoir un gain pending, voir un refus, échanger, constater une rupture et une compensation. Recueillir explication spontanée, confiance, perception de pression, compréhension du coût réel et intention d’usage.

Critères internes proposés : chaque personne doit pouvoir expliquer ce qui est dépensable, ce qui est seulement XP, si un gain est acquis et si un objet entraîne un paiement complémentaire. Les incompréhensions monétaires ou de confidentialité bloquent le lancement même si les boutons sont faciles à trouver.

### Phase B — pilote financé et instrumenté

Établir avant l’exposition : budget maximal, membres éligibles, dates, action principale, conditions et offres honorables. Exclure comptes démo des analyses. Mesurer d’abord le fonctionnement : source → intention → décision → journal → affichage → échange. Les 42 intentions actuelles doivent être expliquées et traitées selon le contrat historique, sans bonus rétroactif arbitraire.

Événements analytiques proposés : objectif choisi/modifié, fait métier vérifié, demande enregistrée, gain confirmé/refusé, consultation du détail, échange demandé/réservé/échoué/annulé/livré. Les événements économiques viennent du serveur ; un événement navigateur ne constitue jamais une preuve de crédit ou de livraison. Distinguer les cohortes exposées, réellement actives et éligibles pour éviter les dénominateurs flatteurs. Définir consentement/base légale, rétention et minimisation avant instrumentation.

### Phase C — comparaison causale

Commencer par **deux variantes** : interface objectif choisi contre présentation catalogue seule, à barème et budget identiques. Cette comparaison mesure l’effet de la présentation, pas l’effet propre ni la rentabilité des récompenses. Pour mesurer ces derniers, prévoir ensuite un témoin sans nouvelle incitation économique, tout en conservant les droits antérieurs des deux groupes. Tester ensuite, séparément, le bonus social borné ou le récit utile. Ne pas changer ensemble la taille des nombres, les gains, le catalogue, la visibilité et les notifications : il serait impossible d’attribuer l’effet.

Indicateur principal proposé : proportion de membres ayant accompli au moins une réalisation utile vérifiée dans au moins trois des quatre dernières semaines du pilote, soit **un résultat binaire par personne**, avec fenêtre et dénominateur préspécifiés. Les courbes hebdomadaires restent secondaires et doivent traiter la corrélation des observations d’une même personne. Autres secondaires : rétention volontaire D7/D30, utilité des contributions évaluée indépendamment, compréhension du portefeuille, satisfaction, réalisation d’objectifs et échanges livrés. Garde-fous : coût par réalisation additionnelle, fraude acceptée, réclamations, refus erronés, délais pending, désabonnements notifications, signalements de pression, sécurité et confidentialité. Le nombre de likes ou le temps d’écran ne suffit pas.

Prévoir un suivi après retrait des incitations, clairement annoncé dès l’entrée, pour examiner la persistance sans retirer les droits acquis. Exemples de fenêtres à chiffrer selon trafic : 8–12 semaines exposées puis 4–8 semaines de suivi. Ce ne sont pas des durées scientifiques universelles ; les grands essais ont souvent suivi les participants plus longtemps. [Études et limites](01-preuves-scientifiques.md).

Le nombre de comptes observés aujourd’hui ne suffit pas à promettre une détection de petits effets. Illustration statistique indépendante des métriques LKDV : deux proportions 20 % vs 25 %, alpha bilatéral 5 %, puissance 80 %, approximation normale, nécessitent environ **1 094 personnes par bras** avant attrition ou effet de groupe. Calcul : `2 × (1,96 + 0,84)² × 0,225 × 0,775 / 0,05²`. Un pilote de quelques dizaines de personnes sert d’abord à vérifier compréhension, coûts et fonctionnement ; une absence de significativité n’établit pas une absence d’effet. Une communauté a des effets de réseau : définir l’unité de randomisation et la contamination, puis ajuster puissance/cluster avant lancement. Pré-enregistrer les comparaisons et éviter l’arrêt opportuniste dès qu’une courbe devient favorable.

## 7. Découpage proposé du futur chantier

| Ordre | Travail concret | Preuve nécessaire avant étape suivante |
|---|---|---|
| 0 | Inventaire des droits par famille et réconciliation ledger/projections ; revue du relais API legacy ; diagnostic des intentions en attente | Les nouvelles règles n’effacent aucun droit ; exposition des producteurs réellement connue ; rejouabilité en base isolée |
| 1 | Choix du catalogue réel, coûts rendus, financeur, enveloppe, barème/version et conditions | Chaque avantage a un responsable de livraison et un budget ; scénario défavorable soutenable |
| 2 | Spécification d’un portefeuille public raccordé aux journaux actuels et d’un objectif choisi | Un seul solde économique cohérent ; anciennes unités/cash non additionnés arbitrairement ; matrice complète des états |
| 3 | Producteurs et échange atomique derrière configuration fermée, en TDD | Idempotence, quotas concurrents, double dépense, compensation, accès intercomptes et dérive de projections testés |
| 4 | Intégration Compte / communauté à la refonte réelle | Parcours mobile, a11y, reduced motion, erreurs/hors ligne, absence de faux gains et conflits navigation vérifiés |
| 5 | Pilote financé, puis expansion contrôlée | Coût réel, stocks/livraison, utilité, satisfaction, délais et risques sous contrôle ; arrêt de nouvelle émission testable sans perte des droits |

Surfaces actuelles à reprendre : `src/features/loyalty/{validation,server}.ts`, routes `/api/loyalty/*` et `/api/rewards/claim`, producteurs progression, consommateur d’intentions, `CompteLiquidGlassV8`, son runtime, drawers existants et hooks communauté. Ne pas réécrire le feed ou la navigation pour afficher le compteur. Le plan technique détaillé précisera migrations additives, index/contraintes, tests, flags et rollback à partir de l’inventaire, sans réutiliser aveuglément des fonctions pures actuellement non branchées.

## 8. Informations manquantes qui conditionnent la mise en service

Coûts rendus et stocks de la lampe ; budget mensuel réellement disponible ; rôle de la boutique et partenaires ; droits contractuels historiques par récompense ; part de comptes de démonstration et fréquence d’usage réelle ; âge du public ; conditions de livraison/retour ; preuve des actions hors randonnée et coût de modération. La recherche peut recommander une méthode et des ordres de grandeur. Elle ne peut pas fabriquer ces paramètres ni garantir la rentabilité ou un effet comportemental.
