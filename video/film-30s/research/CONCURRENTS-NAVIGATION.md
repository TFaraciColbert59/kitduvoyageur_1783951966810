# LKDV face aux applications de navigation et de randonnée

Veille établie le 18/11/2026. Partie « concurrents de navigation et de randonnée » de l'analyse concurrentielle et du SWOT de LKDV (Le Kit du Voyageur).

**Règles de lecture**
- Chaque fait est suivi de sa source : URL et date de publication, ou date de mise à jour de la page. « Page sans date » signifie que la page consultée n'en affiche pas.
- « Non trouvé » : la donnée n'est pas publique, ou la recherche ne l'a pas fait apparaître.
- « Estimation » : chiffre calculé ou rapporté par un tiers. La base est indiquée.
- Les chiffres d'utilisateurs sont ceux que les acteurs annoncent eux-mêmes (membres inscrits, sauf mention contraire). Ils ne sont pas comparables entre eux : inscrits, actifs mensuels et téléchargements sont des mesures différentes.
- Côté LKDV, les capacités et leurs limites viennent de `POTENTIEL-APP.md` (17/11/2026) : sections 1, 3, 6 et 7.

---

## 1. Tableau comparatif

Légende : ● fonction complète · ◐ fonction partielle ou payante · ○ fonction absente · ? non vérifié.
« Préparation complète » veut dire : itinéraire, météo, budget, papiers d'entrée, risques, groupe et matériel réunis dans un même plan.

| Acteur | Cible | Utilisateurs annoncés | Prix 2026 | Modèle | Préparation complète | Carte et navigation hors ligne | Suivi en direct / SOS | Communauté | Carnets / récit | Matériel / kit | IA | Groupe |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **LKDV** | aventuriers francophones, du week-end à l'expédition | 86 comptes, dont 54 de démonstration (pas de traction) | gratuit ; offre Pro affichée mais non branchée | non actif : Stripe et affiliation éteints | ● une phrase produit itinéraire, météo, budget, papiers, risques et kit | ◐ zone hors ligne, PWA ; pas d'application dans les stores | ● lien invité sans compte, SOS qui compose le numéro d'urgence du pays ; pas de satellite | ● clubs, sorties, stories, messagerie, bouteille à la mer | ● carnets avec verdict sur chaque objet | ● sac 3D modulaire, lignées de kits | ◐ l'IA (NVIDIA Nemotron) relit et propose des lieux, toujours vérifiés sur la carte | ● groupe, compagnons de route |
| **Komoot** | vélo, randonnée, gravel (Europe) | 45 M | Premium 59,99 €/an ; pack Monde 29,99 £ en achat unique | freemium : cartes à l'achat + abonnement | ○ | ● | ◐ Live Tracking (Premium) | ● | ◐ récits de sortie (« Collections ») | ○ | ◐ application dans ChatGPT | ◐ partage d'itinéraire |
| **AllTrails** | randonneurs grand public (Amérique du Nord d'abord) | 100 M (août 2026) | Plus ≈ 36 $/an ; Peak 79,99 $/an | freemium, trois niveaux | ◐ étapes de plusieurs jours, conditions sur le sentier | ● (Plus) | ◐ partage en direct (Plus) | ● avis, photos | ○ | ○ | ● itinéraires par IA (Peak), applications dans ChatGPT et Claude | ○ |
| **Strava** | sportifs d'endurance, multisport | plus de 200 M (août 2026) | 79,99 $/an (États-Unis) | freemium, abonnement | ○ | ◐ itinéraires hors ligne (abonnés) | ◐ Beacon | ● clubs, kudos, défis | ◐ publications d'activité | ○ | ● recherche en langage courant, Athlete Intelligence | ◐ clubs |
| **Outdooractive** | randonnée et tourisme (Alpes, Europe) | 70 M d'utilisateurs, 17 M de membres de la communauté | Pro 29,99 €/an ; Pro+ 59,99 €/an | B2B2C : plus de 10 000 partenaires touristiques + abonnements | ◐ circuits, conditions, hébergements des destinations | ● | ◐ BuddyBeacon | ● | ◐ | ○ | ● Outdooractive Scout (Pro+, nov. 2026) | ○ |
| **Gaia GPS** (Outside) | arrière-pays, États-Unis | « millions » | 59,90 $/an ; 89,99 $/an avec Outside+ | abonnement, offre groupée Outside+ | ○ | ● plus de 250 cartes | ? | ○ | ○ | ○ | ? | ○ |
| **Wikiloc** | randonnée, Espagne, France, Andorre | plus de 22 M de membres, 85 M de traces | 19,99 €/an | freemium | ○ | ● (Premium) | ◐ suivi en direct (Premium) | ● | ◐ | ○ | ◐ application dans ChatGPT (2026) | ○ |
| **Visorando** | randonneurs français | ≈ 4 M | 25 €/an ou 6 €/mois | freemium | ○ | ● cartes IGN | ◐ partage de position | ● | ○ | ○ | ○ | ○ |
| **Iphigénie / Whympr** | cartographes, montagnards français | plus de 100 000 par mois | 24,99 €/an ; Pack Outdoor 39,99 €/an | abonnement | ○ | ● IGN, swisstopo | ◐ balise | ◐ Whympr | ○ | ○ | ○ | ○ |
| **Mapy.com** (Seznam) | grand public d'Europe centrale | ≈ 4 M actifs par mois | 249 Kč/an (République tchèque) | freemium | ○ | ● | ? | ◐ avis | ○ | ○ | ? | ○ |
| **FarOut** | grandes traversées (PCT, AT) | « centaines de milliers » | 96 $/an ou guide à l'unité (9,99 à 74,99 $) | guides payants + abonnement | ◐ guides par sentier | ● | ○ | ◐ commentaires sur les points | ○ | ○ | ○ | ○ |
| **Hiiker** | longues distances, Royaume-Uni, Irlande | non trouvé | 29,99 £/an | abonnement | ◐ étapes | ● | ◐ Live Locator | ◐ | ○ | ○ | ○ | ○ |
| **CalTopo** | secours, ski de randonnée, experts | non trouvé | 20 ou 50 $/an | abonnement | ○ | ● | ? | ○ | ○ | ○ | ○ | ◐ cartes partagées |
| **Locus Map** | utilisateurs Android avancés | non trouvé | Silver 10 €/an ; Gold 24 €/an | freemium | ○ | ● | ◐ groupes privés (Gold) | ○ | ○ | ○ | ○ | ◐ |
| **Garmin** (Connect+, inReach) | possesseurs de montres et de balises | non trouvé | Connect+ 69,99 $/an ; inReach de 7,99 à 49,99 $/mois | matériel + abonnements | ○ | ● sur l'appareil | ● SOS satellite, centre de secours 24 h/24 | ◐ | ○ | ○ | ◐ Active Intelligence | ○ |
| **Suunto** | montres outdoor | non trouvé | application gratuite | matériel | ○ | ◐ | ? | ○ | ○ | ○ | ? | ○ |
| **Decathlon Outdoor** | débutants en France | plus de 2 M de membres | gratuit | produit d'appel du distributeur | ○ | ● | ○ | ◐ | ○ | ○ (alors que Decathlon vend le matériel) | ○ | ○ |
| **Camptocamp** | alpinisme, escalade | 93 000 comptes | gratuit (association) | adhésions, dons | ○ | ○ | ○ | ● forum, sorties | ● récits de sortie | ○ | ○ | ○ |
| **Polarsteps** (voisin du côté voyage) | voyageurs au long cours | 15 M (juillet 2025) | gratuit ; livres imprimés payants | vente de livres photo | ◐ planification | ◐ | ● suivi par les proches | ◐ | ● récit, livre | ○ | ◐ | ● « Travel Together » |
| **Planificateurs IA** (Roamze, Xploreum, GoAdventa, TrailNights) | randonneurs américains et alpins | non trouvé (très petits) | freemium | abonnements, affiliation | ◐ itinéraire, matériel, permis, budget | ◐ | ○ | ○ | ◐ | ◐ listes de matériel | ● | ◐ |

---

## 2. Fiches des six acteurs majeurs

### 2.1 Komoot

- **Positionnement.** Le planificateur d'itinéraires de référence en Europe pour le vélo et la randonnée.
- **Cible et pays forts.** Cyclistes, gravel et randonneurs. Allemagne, Royaume-Uni, Italie et France sont cités par son propriétaire comme marchés établis (BikeRadar, 15/09/2025, https://www.bikeradar.com/news/komoot-redesign-2025).
- **Utilisateurs.** 45 M (BikeRadar, 21/03/2025, https://www.bikeradar.com/news/komoot-acquisition ; même chiffre dans Daily Stoke, 20/10/2026, https://dailystoke.com/travel-apps/komoot-review/).
- **Rachat confirmé.** Bending Spoons (Milan : WeTransfer, Evernote, Meetup, Vimeo) a racheté Komoot en mars 2025, pour un prix non publié. Entre 75 % et 85 % des quelque 150 salariés ont été licenciés. Les fondateurs, dont le PDG Markus Hallermann, sont partis (BikeRadar, 15/09/2025, lien ci-dessus ; heise, 15/09/2025, https://www.heise.de/en/news/After-sale-and-redundancies-Komoot-gets-a-fresh-design-10644247.html ; Follow the Money, 18/11/2025, https://www.ftm.eu/articles/wetransfer-owner-buys-up-apps-then-makes-them-more-expensive).
- **Modèle et prix.**
  - Cartes à l'achat unique : une région, un lot de régions ou le pack Monde.
  - Abonnement Premium : 59,99 €/an, 6,99 €/mois sur le web, 4,99 €/semaine dans les applications (BikeRadar, 15/09/2025).
  - Pack Monde : 29,99 £ ; Premium : 59,99 £/an (prix de l'App Store britannique, Daily Stoke, 20/10/2026).
  - Depuis mars 2025, un nouveau compte sans carte achetée ne peut plus envoyer ses itinéraires vers un appareil (road.cc, 21/03/2025, https://road.cc/content/news/job-cuts-expected-komoot-after-tech-firm-purchase-313159).
  - Comparatif officiel Cartes / Premium : https://support.komoot.com/hc/en-us/articles/10163258809626 (mise à jour le 13/11/2026).
- **Fonctions clés.**
  - Calcul d'itinéraire selon le sport.
  - « Highlights » recommandés par la communauté.
  - Synchronisation avec Garmin et Bosch.
  - En Premium : itinéraires de plusieurs jours, suivi en direct, météo sur le parcours, cartes 3D, cartes de fréquentation.
  - En 2026 : planificateur refait sur iOS (juin) et Android (septembre), alertes incendie (octobre), 3 000 itinéraires de plusieurs jours sélectionnés par des experts (novembre) (https://support.komoot.com/hc/en-us/articles/10621431252250, mise à jour le 16/11/2026).
- **IA.** Application Komoot dans ChatGPT, lancée le 10/02/2026 : 7 M d'itinéraires et 4 M de Highlights accessibles en langage courant (https://newsroom.komoot.com/261872-komoot-makes-outdoor-adventures-accessible-with-ai-powered-route-discovery-on-chatgpt/, 18/02/2026).
- **Ce qu'il fait mieux que LKDV.** Un moteur d'itinéraire éprouvé, une base de 45 M d'utilisateurs, l'intégration aux GPS et vélos électriques, une application native publiée, et une monétisation qui fonctionne.
- **Ce qu'il n'a pas.** Pas de budget, de papiers d'entrée, de risques ni de matériel. Pas de groupe au sens d'une expédition, pas de verdicts sur le matériel, pas de transmission de kits, pas de recherche de compagnons.
- **Actualité.** Prix en hausse et offre gratuite réduite. Trustpilot partagé : 3,7/5, avec 30 % d'avis à une étoile (Daily Stoke, 20/10/2026). L'enquête de Follow the Money décrit le même schéma à chaque rachat de Bending Spoons : licenciements massifs, puis hausse des prix.

### 2.2 AllTrails

- **Positionnement.** L'annuaire mondial des sentiers. Il domine les recherches « trails near me ».
- **Cible et pays forts.** Randonneurs grand public. En 2021, environ deux tiers des utilisateurs étaient en Amérique du Nord (TechCrunch, 17/11/2021, https://techcrunch.com/2021/11/17/alltrails-raises-150m-after-covid-accelerates-peoples-interest-in-exploring-the-outdoors/). L'application existe en 14 langues.
- **Utilisateurs.** 100 M de membres le 25/08/2026, sur environ 500 000 itinéraires (communiqué, https://www.alltrails.com/press/alltrails-community-reaches-100-million-members).
- **Propriétaire et levées.**
  - Spectrum Equity, majoritaire depuis 2018 (75 M$).
  - Permira, 150 M$ en 2021 (Reuters, 17/11/2021, https://www.reuters.com/business/finance/pe-firm-permira-invests-150-mln-hiking-app-alltrails-2021-11-17/).
  - Liz Hamren, ancienne PDG de Ring, est PDG depuis août 2025 (The Brand Report, 04/09/2026, https://thebrand.report/articles/alltrails-hike-two).
- **Modèle et prix.** Trois niveaux : Base (gratuit), Plus, Peak. Peak coûte 79,99 $/an depuis mai 2025 (TechCrunch, 12/05/2025, https://techcrunch.com/2025/05/12/alltrails-debuts-a-80-year-membership-that-includes-ai-powered-smart-routes/ ; GearJunkie, 12/05/2025). Plus coûte environ 36 $/an (The Brand Report, 04/09/2026).
- **Revenus.**
  - Estimation : plus de 150 M$ de revenus récurrents annuels en 2024. Base : analystes cités par The Brand Report, 04/09/2026 ; l'entreprise ne publie rien.
  - 1 M d'abonnés payants dès janvier 2021 (TechCrunch, 2021).
  - Rentable depuis 2017 (TechCrunch, 2021).
- **Fonctions clés.**
  - Plus : cartes hors ligne, alertes de mauvais embranchement, aperçu 3D, partage en direct.
  - Peak : itinéraires sur mesure avec « smart routing » par IA, Route Assistant qui découpe une traversée en étapes, conditions sur le sentier (15 facteurs météo), carte de fréquentation, Outdoor Lens pour identifier plantes et insectes (centre d'aide, mis à jour le 28/10/2026, https://support.alltrails.com/hc/en-us/articles/43589223010708).
- **IA.** Smart routing et Outdoor Lens. Applications dédiées dans Claude et ChatGPT (communiqué du 25/08/2026).
- **Ce qu'il fait mieux que LKDV.** L'échelle, la notoriété et le référencement. Environ 72 M d'avis. Un abonnement payé par des millions de personnes. Le découpage d'une traversée en étapes existe déjà en Peak.
- **Ce qu'il n'a pas.** Pas de budget, de papiers d'entrée, de risques par pays, de groupe ni de matériel. Pas de carnet avec verdicts, pas de recherche de compagnons. AllTrails reste un outil de sentier, pas un préparateur de voyage.
- **Actualité.** Placements payants proposés aux marques dans l'application, avec AllGear Digital (note de la rédaction de The Brand Report du 14/09/2026). Hausse du prix du niveau supérieur, réservé aux fonctions d'IA.

### 2.3 Strava (et la fermeture de FATMAP)

- **Positionnement.** Le réseau social du sport d'endurance. Il devient aussi une application de navigation outdoor.
- **Cible et pays forts.** Coureurs et cyclistes, de plus en plus de randonneurs. « Une personne sur quatre au Royaume-Uni est sur Strava » (Fortune, 13/01/2026, https://fortune.com/2026/01/13/how-strava-ran-toward-a-comeback-ipo/).
- **Utilisateurs.**
  - 180 M d'inscrits en décembre 2025 (Fortune, 13/01/2026).
  - Plus de 200 M en août 2026 (Forge Global, 28/08/2026, https://forgeglobal.com/insights/strava-upcoming-ipo-news/).
  - 50 M d'actifs mensuels en 2025 selon Sensor Tower (TechCrunch, 13/10/2025, https://techcrunch.com/2025/10/12/strava-eyes-ipo-as-gen-z-trades-dating-apps-for-running-clubs/).
- **Levées et valorisation.** 2,2 Md$, dette comprise, en mai 2025 (tour mené par Sequoia ; WSJ, 22/05/2025, https://www.wsj.com/finance/strava-app-2-2-billion-dollar-valuation-ef50e598).
- **Introduction en bourse.**
  - Dossier S-1 déposé confidentiellement, annoncé le 02/02/2026 (https://press.strava.com/articles/strava-confidential-submission-of-draft-registration-statement-for-IPO).
  - Aucune cotation au 28/08/2026 (Forge Global). Aucune introduction n'a été trouvée depuis.
- **Rachats.** Runna (avril 2025) et The Breakaway (mai 2025), prix non publiés (WSJ, 22/05/2025 ; SiliconANGLE, 08/01/2026).
- **Revenus.**
  - Estimation : 490 M$ de revenus récurrents annuels en 2025 (Sacra, https://sacra.com/c/strava/, 2025).
  - Estimation basse : 415 M$ (Business of Apps, cité par curvedtrading.com le 23/07/2026).
- **Prix.** 11,99 $/mois ou 79,99 $/an aux États-Unis. Offre famille à 139,99 $/an. Strava + Runna à 149,99 $/an (https://www.strava.com/pricing, mis à jour le 01/07/2025). Prix en euros : non trouvé.
- **FATMAP.** Racheté en janvier 2023, fermé le 01/10/2024. Seuls les tracés ont pu être transférés. Les guides, les aventures et les points de passage ont été perdus (Strava, 24/06/2024, https://press.strava.com/articles/fatmap-is-transitioning-to-strava ; TechCrunch, 26/06/2024, https://techcrunch.com/2024/06/26/strava-to-shutter-3d-mapping-platform-fatmap-18-months-after-acquisition/). Le moteur 3D est réapparu dans Strava en mars 2025 (beyondmaps.app, 13/10/2026).
- **Randonnée en 2026.**
  - Juin : alertes de sortie d'itinéraire, itinéraires hors ligne, guidage sur Apple Watch, clubs de randonnée, dont le nombre a été multiplié par 5,8 en un an (Android Authority, 12/06/2026, https://www.androidauthority.com/strava-new-hiking-features-3677280/).
  - Octobre : recherche d'itinéraires « dans vos propres mots » grâce au modèle de langage de Strava, et guidage vocal annoncé (T3, 23/10/2026, https://www.t3.com/active/hiking-walking/strava-hiking-updates-1026 ; TechRadar, 27/10/2026).
- **Polémique.** Strava a attaqué Garmin pour violation de brevets (segments, cartes de fréquentation) le 30/09/2025, puis s'est désisté le 21/10/2025 (DC Rainmaker, 22/10/2025, https://www.dcrainmaker.com/2025/10/strava-drops-voluntarily-lawsuit-against.html ; Bloomberg Law, 23/10/2025).
- **Ce qu'il fait mieux que LKDV.** L'effet de réseau, les clubs et l'émulation, les données de fréquentation, le financement, les intégrations avec les montres.
- **Ce qu'il n'a pas.** Pas de préparation de voyage, de budget, de papiers ni de matériel. Pas de carnet d'expédition. La logique reste celle de l'activité, pas celle du voyage.

### 2.4 Outdooractive

- **Positionnement.** Plateforme qui vend du contenu aux offices de tourisme et des abonnements aux randonneurs (modèle B2B2C). Elle publie les données officielles de plus de 10 000 partenaires.
- **Cible et pays forts.** Randonneurs, cyclistes et skieurs de l'espace alpin : Allemagne, Autriche, Italie, Suisse. Elle s'étend en Europe.
- **Utilisateurs.** 70 M d'utilisateurs et 17 M de membres de la communauté (communiqué du 11/11/2026, https://corporate.outdooractive.com/press/outdooractive-launches-ai-assistant-and-revolutionises-the-digital-outdoor-travel-guide/). Le compteur en temps réel affiche 17 478 558 membres et 11 212 partenaires (https://corporate.outdooractive.com/en/platform/, consulté le 18/11/2026).
- **Propriétaire.** Outdooractive AG (Immenstadt, Allgäu). Le fondateur Hartmut Wimmer est passé président du conseil de surveillance. Albert Brenner est PDG depuis avril 2026 (communiqué du 15/04/2026, https://corporate.outdooractive.com/press/754-2/). Chiffre d'affaires : non trouvé, les comptes 2025 ont été déposés le 11/11/2026 (northdata.com).
- **Prix.** Pro 29,99 €/an ; Pro+ 59,99 €/an (https://www.outdooractive.com/en/membership/plans.html, page sans date).
- **Fonctions clés.**
  - Itinéraires de destinations « officielles » et cartes d'éditeurs : Alpenverein, KOMPASS, freytag & Berndt.
  - Hauteurs de neige, mode 3D, BuddyBeacon.
  - « Pro Alliance » : les éditeurs (ALPIN, Rother, ADAC…) touchent une part des abonnements Pro+ (communiqué du 11/03/2026, https://corporate.outdooractive.com/press/alpin-integrates-its-tour-content-into-the-outdooractive-platform/).
- **IA.** Outdooractive Scout, lancé le 09/11/2026 et inclus dans Pro+ : on décrit sa sortie en langage courant ; l'assistant tient compte du profil, de la météo, des fermetures et des avalanches (communiqué du 11/11/2026). Partenariat IA avec destination.one (02/07/2026).
- **Ce qu'il fait mieux que LKDV.** Les contenus officiels et vérifiés, les cartes sous licence, le réseau B2B, et un assistant IA qui comprend une demande en langage courant. C'est le concurrent le plus proche de l'idée « une phrase, une sortie ».
- **Ce qu'il n'a pas.** Pas de budget, de papiers d'entrée ni de risques par pays. Pas de groupe, de matériel, de verdicts ni de transmission de kits. Le périmètre reste la sortie, pas le voyage hors d'Europe.

### 2.5 Gaia GPS (Outside Inc.)

- **Positionnement.** Navigation hors réseau pour l'arrière-pays, avec plus de 250 cartes et calques.
- **Cible et pays forts.** Randonneurs, chasseurs, adeptes du tout-terrain, États-Unis et Canada.
- **Utilisateurs.** « Des millions », sans chiffre précis (blog Gaia GPS, 01/12/2023, https://blog.gaiagps.com/price-adjustment-2023/).
- **Propriétaire.** Outside Interactive Inc., qui l'a racheté en 2021. Outside a levé plus de 150 M$ et revendique environ 1 M d'abonnés sur l'ensemble de ses marques. Le groupe a connu trois vagues de licenciements depuis 2022 et vise une introduction en bourse « dans trois à quatre ans » (Colorado Sun, 18/02/2025, https://coloradosun.com/2025/02/18/outside-inc-adds-inntopia/). Vente de Gaia GPS : aucune trouvée.
- **Prix.** Premium 59,90 $/an ; 89,99 $/an avec Outside+, qui ajoute magazines, Trailforks Pro et Outside Watch (comparatif Goat Maps, mis à jour le 27/10/2026, https://www.goatmaps.com/compare/goat-maps-vs-gaia-gps ; centre d'aide Gaia, mis à jour le 15/10/2026, https://help.gaiagps.com/hc/en-us/articles/115003524547).
- **Fonctions clés.** Cartes IGN France et swisstopo, terres publiques et privées aux États-Unis, couches incendies et qualité de l'air, téléchargement hors ligne (Premium).
- **Ce qu'il fait mieux que LKDV.** La profondeur cartographique et la fiabilité hors ligne pour un public d'experts.
- **Ce qu'il n'a pas.** Pas de communauté forte, de préparation, de groupe, de matériel ni de carnet.
- **Actualité.** Concurrence de Goat Maps (29,99 $/an), créé fin 2024 par d'anciens ingénieurs de Gaia (Goat Maps, 27/10/2026). Attention : la société cotée « Gaia, Inc. » (GAIA) est un service de vidéo en ligne sans lien avec Gaia GPS.

### 2.6 Wikiloc

- **Positionnement.** La plus grande base de traces réelles partagées par la communauté.
- **Cible et pays forts.** 60 % des utilisateurs sont en Espagne, en France et en Andorre, et 10 % au Japon (analyse produit d'Eloi Pardo, 12/02/2025, https://productforeveryone.substack.com/p/product-analysis-wikiloc).
- **Utilisateurs.** Plus de 22 M de membres et plus de 85 M de traces (https://www.wikiloc.com/wikiloc/about-us.do, consulté le 18/11/2026). 20 M de membres annoncés en 2026.
- **Propriétaire.** Wikiloc Outdoor SL (Gérone), fondé en 2006 par Jordi Ramot. Le fonds Miura Partners a pris 40 % du capital en juin 2023, pour un prix non publié (Eloi Pardo, 12/02/2025).
- **Revenus.**
  - 5 M€ de chiffre d'affaires et 2 M€ de bénéfice net en 2021 (cités par Eloi Pardo d'après The New Barcelona Post et Xataka).
  - Estimation : plus de 10 M€ aujourd'hui (même source ; base : 5,5 % d'abonnés payants sur 16 M d'utilisateurs).
- **Prix.** Premium 19,99 €/an, ou 9,99 € pour un trimestre (App Store Espagne, https://apps.apple.com/es/app/wikiloc-rutas-del-mundo/id432102730). Le prix annuel est passé de 9,99 € à 19,99 € en juillet 2024.
- **Fonctions clés.** Planificateur d'itinéraires (2024), cartes 3D, recherche des traces qui passent par un lieu, suivi en direct, envoi vers un GPS, identification des sommets (2025), application Wikiloc dans ChatGPT (2026, page « À propos »).
- **Ce qu'il fait mieux que LKDV.** Le nombre de traces dans le monde entier, y compris dans des endroits très isolés, et un prix bas.
- **Ce qu'il n'a pas.** Pas de préparation complète, de budget, de papiers, de groupe, de matériel ni de carnet avec verdicts. Pas de recherche de compagnons.

---

## 3. Fiches courtes

**Visorando (France).**
- Leader de la randonnée en France. Environ 4 M d'utilisateurs, plus de 40 000 itinéraires (Les Échos, 20/10/2025, https://www.lesechos.fr/pme-regions/grand-est/sport-visorando-automatise-le-tracage-des-randonnees-2193314 ; melles750.fr, 02/10/2025).
- Premium : 25 €/an ou 6 €/mois. Inclut les cartes IGN hors ligne, le partage de position et une météo heure par heure (https://www.visorando.com/premium.html).
- Société de Soultz (Haut-Rhin), créée par Fabien Biver et Arnaud Lecus. Elle a racheté le site britannique Plotaroute en 2024 et lancé le tracé automatique en 2025 (Les Échos).
- Aucune IA générative, aucun budget, aucun matériel. C'est le concurrent français le plus visible auprès du même public que LKDV.

**Iphigénie / Whympr (France).**
- Application de cartographie de référence : IGN, swisstopo, cartes italiennes, plus de 70 fonds de carte.
- Carto à 24,99 €/an ; Pack Outdoor (avec Whympr et l'application web) à 39,99 €/an. Plus de 100 000 utilisateurs par mois. Remise pour les licenciés FFCAM (https://manuels.iphigen.ie/fr/article/quel-abonnement-iphigenie-choisir-qdx1tk/, mis à jour le 10/09/2026 ; https://www.ffcam.fr/FR_whympr-iphigenie.html).
- Éditeur : Whympr (Chamonix). Outil d'expert, sans dimension « voyage ».

**Mapy.com (ex-Mapy.cz, Seznam).**
- Le service est devenu Mapy.com en 2025 pour viser l'international.
- Environ 4 M d'utilisateurs actifs par mois, dont un quart à l'étranger (Seznam Zprávy, 27/03/2025, https://www.seznamzpravy.cz/clanek/ekonomika-byznys-rozhovory-mapy-com-se-blizi-pujdou-na-apple-watch-v-cizine-je-predstavi-obri-kampan-272637 ; blog Seznam, 26/03/2025).
- Premium à 249 Kč/an en République tchèque (blog Seznam, 27/11/2025). Prix en euros : non trouvé.
- Navigation routière et piétonne. Un acteur adossé au premier portail tchèque, qui progresse en Europe centrale.

**FarOut (ex-Guthook, Atlas Guides).**
- Guides des grandes traversées (PCT, AT, JMT…) : plus de 200 guides, plus de 80 000 km de sentiers.
- Guide à l'unité de 9,99 à 74,99 $, ou abonnement Unlimited à 96 $/an ou 15 $/mois (https://faroutguides.com/unlimited ; apppricinglab.com, 02/05/2026).
- Note de 4,8/5 sur 25 200 avis. Rachat : non trouvé.
- Concurrent direct de LKDV sur les « sentiers nommés » aux États-Unis.

**Hiiker (Irlande).**
- Sacré « Gear of the Year 2026 » par le magazine TGO : planification par étapes, cartes OS et Harvey, Live Locator.
- 20,99 £ la première année, puis 29,99 £/an (TGO, 01/09/2026, https://www.thegreatoutdoorsmag.com/gear-guides/best-hiking-apps/).
- Utilisateurs et levées : non trouvés.

**CalTopo.**
- Référence des secouristes et des skieurs de randonnée : couches de pente, cartes partagées.
- Mobile à 20 $/an, Pro à 50 $/an (https://caltopo.com/northern, page sans date).
- Propriétaire et utilisateurs : non trouvés.

**Locus Map (Asamm, République tchèque).**
- Application Android pour utilisateurs avancés, avec une version iOS allégée.
- Silver à 10 €/an, Gold à 24 €/an. Suivi en direct dans des groupes privés (Gold). Fin du support de Locus Map 3 Classic en décembre 2026 (https://www.locusmap.app/comparison/ ; itechguides.com, 03/10/2026).

**Garmin (Connect+, inReach, Messenger).**
- Garmin Connect+ (mars 2025) : 6,99 $/mois ou 69,99 $/an. Ajoute l'IA « Active Intelligence » et un LiveTrack étendu. C'est un revirement par rapport à la promesse de ne pas mettre de fonctions derrière un abonnement (The Verge, 27/03/2025, https://www.theverge.com/news/636211/garmin-connect-plus-subscription-wearables).
- inReach : formules Enabled (7,99 $/mois), Essential (14,99 $), Standard (29,99 $) et Premium (49,99 $), plus 39,99 $ d'activation. Le SOS passe par Garmin Response, joignable 24 h/24 (Garmin Rumors, 03/09/2025, https://garminrumors.com/a-look-at-garmins-inreach-technology-plans/ ; Garmin, 20/10/2026, https://www.garmin.com/en-US/blog/outdoor/overview-inreach-subscription-plans/).
- inReach est intégré à la montre fenix 8 Pro depuis septembre 2025.
- C'est la référence du secours par satellite, un domaine où LKDV n'a aucune solution propre.

**Suunto.**
- Appartient à Liesheng (Chine) depuis mai 2022. 85,6 M€ de chiffre d'affaires et 208 salariés en 2025, chiffres non audités (rapport de durabilité Suunto 2025, https://www.suunto.com/globalassets/about-suunto/sustainability/documents/suunto-sustainability-report-2025-14mb.pdf).
- Application gratuite, liée à la montre.

**Decathlon Outdoor (France).**
- **Pas fermée.** Mise à jour sur Google Play le 15/06/2026 ; refonte de l'été 2025 avec fond satellite, enregistrement libre et export GPX (Les Numériques, 28/07/2025, https://www.lesnumeriques.com/sante-sport/decathlon-outdoor-muscle-son-app-pour-l-ete-et-mise-sur-la-liberte-d-exploration-n240351.html).
- Entièrement gratuite, liée au programme de fidélité. Plus de 80 000 randonnées, plus de 2 M de membres (https://www.decathlon-outdoor.com/fr-fr/app).
- Paradoxe : le premier distributeur de matériel ne relie pas son application au sac ni à la liste de matériel.

**Camptocamp.org.**
- Association loi 1901, site gratuit de topos collaboratifs pour l'alpinisme. 93 000 comptes.
- Environ 12 000 € de frais par an et 600 adhérents en 2025. L'application vieillit et l'association manque de développeurs bénévoles (forum Camptocamp, 14/06/2025, https://forum.camptocamp.org/t/c2c-a-besoin-de-vous-appel-aux-dons-2025/348916 ; 25/09/2025).
- Référence pour les conditions en haute montagne, sans modèle économique.

**Autres acteurs importants découverts.**
- **onX** (États-Unis : chasse, tout-terrain, arrière-pays). Investissement de TCV en novembre 2025. Revenus récurrents annuels presque triplés en trois ans (https://www.onxmaps.com/blog/onx-announces-strategic-investment-from-tcv-to-drive-next-phase-of-growth-and-outdoor-innovation, 03/11/2025).
- **YAMAP** (Japon). 5,2 M de téléchargements et environ 70 % de part de marché des applications de montagne au Japon. A lancé une assurance outdoor et la publicité dans l'application en 2025 (guide YAMAP du 22/09/2025, https://file.yamap.co.jp/baitai/19970ade7b61a6.pdf). Série D de 13,4 M$ le 25/02/2025 (PitchBook).
- **Polarsteps** (Pays-Bas, voyage). 15 M d'utilisateurs en juillet 2025 (https://www.polarsteps.com/news/polarsteps-hits-15-million-users-as-travelers-embrace-authentic-storytelling).
  - La France représente plus de 21 % des utilisateurs, et Paris est la première ville au monde (Polarsteps, 06/06/2025, d'après Les Échos).
  - Plus de 10 M€ de revenus par an, tirés des livres imprimés, et rentable (PMF Show, 01/05/2025).
  - C'est le concurrent le plus dangereux pour les carnets de LKDV auprès du public français.
- **Planificateurs « une phrase → un voyage outdoor » (2025-2026)** :
  - Roamze (États-Unis) : plan jour par jour, matériel, repas, permis, coûts, préparation à plusieurs et hors ligne (App Store, 2.5.0 du 02/11/2026, https://apps.apple.com/us/app/roamze/id6761348971).
  - Xploreum « Xavier » (https://xploreum.io/ai-trip-planner, mis à jour le 14/10/2026).
  - GoAdventa, GoTravelHiking.
  - TrailNights : refuges des Alpes, budget, « une phrase », réservations (https://trailnights.com/en).
  - Utilisateurs : non trouvés pour tous. Ce sont de petites équipes, centrées sur les États-Unis ou sur un seul massif.
- **Secours par satellite gratuit dans le téléphone.**
  - Apple : SOS par satellite, gratuit encore un an pour les iPhone 14 à 16 (prolongation annoncée le 10/09/2026), disponible en France (9to5Mac, 11/09/2026, https://9to5mac.com/2026/09/10/apple-extends-free-iphone-satellite-access-for-another-year/ ; Apple, 05/10/2026, https://support.apple.com/en-us/101573).
  - Google Pixel 9 : SOS satellite, gratuit une année de plus (9to5Google, 21/10/2026).
  - Conséquence : le SOS logiciel devient une fonction attendue, que le téléphone fournit sans frais.
- **Life360 et équivalents** : non étudiés en détail. Pas de positionnement outdoor trouvé.

---

## 4. Synthèse

### 4.1 Tendances du marché

1. **Consolidation par des fonds et des groupes de rachat.**
   - Komoot a été racheté par Bending Spoons en mars 2025, avec trois quarts de l'équipe licenciés puis des prix en hausse.
   - Strava a racheté FATMAP (puis l'a fermé), Runna et The Breakaway.
   - AllTrails appartient à des fonds (Spectrum Equity et Permira).
   - onX a été repris par TCV en 2025 ; Wikiloc par Miura à 40 %.
   - Outside réunit Gaia GPS, Trailforks et MapMyFitness.
   - Dataintelo parle d'un marché qui « s'est fortement consolidé en 2025 » (https://dataintelo.com/report/global-hiking-apps-market, mis à jour le 09/10/2026).
2. **L'IA en langage courant devient la norme en 2026.**
   - Le smart routing d'AllTrails Peak (2025).
   - Komoot dans ChatGPT (février 2026).
   - Wikiloc dans ChatGPT (2026) ; AllTrails dans Claude et ChatGPT (2026).
   - La recherche en langage courant de Strava (octobre 2026).
   - Outdooractive Scout (novembre 2026).
   - Dans tous les cas, l'IA **cherche des itinéraires**. Aucune ne prépare un voyage complet.
3. **Hausse des prix et nouveau niveau d'abonnement.**
   - AllTrails Peak à 79,99 $, environ deux fois le prix de Plus.
   - Komoot Premium à 59,99 € et fin de l'envoi gratuit vers un appareil.
   - Wikiloc a doublé son prix (de 9,99 € à 19,99 €).
   - Garmin Connect+.
   - Strava a aligné ses prix par pays en juillet 2025.
   - Le prix courant d'un abonnement premium se situe désormais entre 60 et 80 € par an.
4. **Strava et Garmin entrent sur le terrain de la randonnée.**
   - Strava a lancé ses fonctions de randonnée (juin et octobre 2026) et appelé les clubs de randonnée « en explosion ».
   - Garmin a intégré inReach à sa montre.
   - Les spécialistes de la randonnée sont pris en étau entre ces écosystèmes.
5. **Le SOS par satellite se banalise** grâce à Apple et Google, gratuitement pour l'instant.

### 4.2 Taille du marché (sources de faible fiabilité)

Les estimations divergent d'un facteur dix ; aucune ne vient d'un cabinet de premier rang.

| Source | Périmètre | Valeur 2025 | Projection |
|---|---|---|---|
| Dataintelo, mis à jour le 09/10/2026 (https://dataintelo.com/report/global-hiking-apps-market) | revenus des applications de randonnée ; seule la part randonnée de Strava et Komoot est comptée | 550 M$ | 1,30 Md$ en 2034 (+10 %/an) ; 72 % du revenu vient des abonnements |
| PW Consulting, 11/06/2026 (https://pmarketresearch.com/worldwide-hiking-apps-market-research/) | applications de randonnée | 542,8 M$ | 1,24 Md$ en 2032 (+12,5 %/an) |
| The Insight Partners, 28/04/2026 (https://www.theinsightpartners.com/reports/hiking-apps-market) | applications de randonnée | 1,34 Md$ | 2,76 Md$ en 2034 |
| Marketintelo, 10/06/2026 (https://marketintelo.com/report/outdoor-navigation-app-market) | navigation outdoor au sens large, y compris la conduite | 6,2 Md$ | 16,8 Md$ en 2034 |

Recoupement :
- Strava fait environ 0,4 à 0,5 Md$ de revenus, tous sports confondus (Sacra 2025 ; Business of Apps cité le 23/07/2026).
- AllTrails, plus de 150 M$ (estimation, The Brand Report, 04/09/2026).
- Wikiloc, environ 10 M€ (estimation, Eloi Pardo, 2025).
- L'ordre de grandeur **« quelques centaines de millions de dollars pour la randonnée pure »** de Dataintelo est le plus défendable. Il est confirmé par sa propre note : « hundreds of millions, not billions ».
- Le marché voisin, plus vaste, est celui du **voyage d'aventure** et du **matériel**. Il n'a pas été chiffré ici : à traiter dans la partie « voyage » du SWOT.

### 4.3 Espaces libres : ce que personne ne couvre

1. **De la phrase au voyage complet, au-delà de l'itinéraire.** Aucun des grands acteurs ne produit dans un même plan budget sourcé, papiers d'entrée par passeport, prises et devises, alertes officielles, risques, groupe et kit. Seuls de petits planificateurs américains (Roamze, Xploreum, GoAdventa) ou centrés sur un massif (TrailNights) s'en approchent, sans base de lieux mondiale vérifiée.
2. **Le lien entre matériel et terrain.** Personne ne note l'utilité réelle de chaque objet après la sortie (« jamais servi », « défaillant », « manquait »), ni ne transmet un kit éprouvé d'un voyageur à l'autre. Decathlon possède l'application et le matériel, mais ne relie pas les deux. Les comparateurs de matériel par IA (CampMate) ne disent rien de l'usage réel sur le terrain.
3. **Le groupe comme unité de préparation.** Les applications de navigation restent individuelles. Polarsteps fait « Travel Together » pour le récit, pas pour la préparation. Aucune ne permet de trouver des compagnons de route avec un seuil de confiance (la bouteille à la mer de LKDV).
4. **Un carnet d'expédition rattaché au kit et à la trace.** Polarsteps a le récit et le livre ; Camptocamp a les comptes rendus de sortie. Aucun des deux ne relie le récit au matériel et à la preuve GPS.
5. **Le français, et un voyage qui dépasse l'Europe.** Les acteurs français (Visorando, Iphigénie, Decathlon Outdoor) sont centrés sur la France et l'IGN. Les acteurs mondiaux ne préparent pas un voyage hors de l'Union européenne (papiers, risques). C'est le créneau « je pars en Géorgie ou en Patagonie ».

---

## 5. Où LKDV est réellement différent, et où il est en retard

**Différences réelles, en production :**
- Une phrase produit un voyage complet, avec budget, papiers et risques, sur des lieux réels vérifiés.
- Le groupe et la bouteille à la mer.
- Des carnets avec un verdict sur chaque objet, et la reprise d'un kit.
- Un configurateur 3D de sac modulaire.
- Un lien de suivi en direct pour un proche sans compte.
- La base « une phrase → un voyage » est un terrain que les leaders n'occupent pas : leur IA se limite à chercher des itinéraires.

**Retards nets (`POTENTIEL-APP.md`, § 3 et § 6) :**
- **Traction.** 86 comptes dont 54 de démonstration, 7 connexions sur 30 jours. Face à 45 M (Komoot), 100 M (AllTrails) et plus de 200 M (Strava).
- **Distribution.** Pas d'application dans les stores. Production en français seulement.
- **Monétisation.** Stripe absent, affiliation inactive.
- **Écosystème.** Aucun connecteur montre ou sport actif, alors que Garmin, Komoot et Strava se synchronisent nativement.
- **Navigation.** Pas de guidage vocal ni de cartes sous licence (IGN, swisstopo, Alpenverein) comparables à Gaia, Iphigénie ou Outdooractive. Dépendance à Overpass, qui expire souvent.
- **Sécurité.** Pas de SOS par satellite : LKDV compose un numéro d'urgence et suppose donc du réseau, quand Garmin inReach, Apple et Google passent par satellite.
- **Lignées de kits.** Jamais utilisées en production : 0 reprise.
