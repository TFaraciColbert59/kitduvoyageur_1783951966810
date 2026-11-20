# LKDV face à ses concurrents : planification, carnets, communauté, matériel

Établi le 18/11/2026. Veille web (pages officielles, communiqués, presse 2024–2026). Chaque fait porte son URL et sa date ; « consulté le 18/11/2026 » signale une page non datée. « Non trouvé » veut dire qu'aucune source sérieuse n'a été trouvée ; une **estimation** est toujours marquée comme telle, avec sa base.

Ce que LKDV est réellement (d'après `POTENTIEL-APP.md`, 17/11/2026) : environ 212 fonctionnalités visibles en production, mais **aucune traction publique**. On compte 86 comptes, dont 54 de démonstration, et 7 connexions sur 30 jours. Stripe n'est pas configuré. Aucune reprise de kit (lignée) n'a jamais eu lieu en production. L'application n'est pas dans les stores et n'existe qu'en français. Toute comparaison ci-dessous porte donc sur le **produit**, pas sur l'usage.

---

## 1. Tableau comparatif

Légende : ● fort · ◐ partiel · ○ absent. « Prépa complète » veut dire qu'une seule demande donne l'itinéraire, la météo, le budget, les papiers, les risques, le groupe et le kit.

| Acteur | Cible | Utilisateurs (public) | Prix 2026 | Modèle | Prépa complète | Aventure / outdoor | Carnet / récit | Communauté / compagnons | Matériel | IA | Hors ligne / sécurité |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **LKDV** | aventuriers FR (rando, bivouac, trek, monde) | 86 comptes dont 54 démo | gratuit ; Pro 29–149 €/mois affiché, non branché | boutique, affiliation, part créateur (tout éteint ou sans clé) | ● (phrase → aventure) | ● | ● (carnet + verdicts d'objets) | ● (clubs, sorties, bouteille à la mer, messagerie) | ● (inventaire, kits, prêts, Kit Studio 3D) | ◐ (relit et conseille, ne fournit pas les lieux) | ◐ (Compas hors ligne, suivi invité, SOS ; pas de cartes hors ligne type AllTrails) |
| Polarsteps | voyageurs au long cours, randonneurs | 20 M+ voyageurs | gratuit ; Plus 8,99 €/mois ou 29,99 €/an | livres imprimés, affiliation, abonnement | ◐ (planificateur + IA) | ◐ (Plus vise les randonneurs) | ● | ◐ (abonnés, compagnons de voyage) | ○ | ◐ | ● (suivi automatique) |
| Wanderlog | voyageurs loisirs | 1 M+ « ont essayé », 8 M+ voyages planifiés | Pro 39,99 $/an (variantes de 31,99 à 59,99 $) | freemium | ◐ (itinéraire, dépenses) | ○ | ○ | ◐ (guides partagés, co-édition) | ○ | ◐ | ◐ (Pro : hors ligne) |
| TripIt (SAP Concur) | voyageurs d'affaires | non trouvé | Pro 49 $/an | freemium, B2B | ○ (organise les réservations) | ○ | ○ | ○ | ○ | ○ | ◐ (alertes) |
| Roadtrippers | road-trips US | non trouvé | 35,99 à 59,99 $/an | abonnement | ◐ | ◐ (route) | ○ | ○ | ○ | ○ | ◐ |
| Mindtrip | grand public US, offices de tourisme | non publié ; 1 M+ visites/mois (T3 2025) ; 18 000 assistants en bêta | gratuit | commission sur réservation, B2B pour destinations | ◐ (planifie et réserve) | ○ | ○ | ◐ (chat de groupe) | ◐ (conseils de bagage) | ● | ○ |
| Layla | grand public, inspiration sociale | non trouvé | non trouvé | réservation, affiliation | ◐ | ○ | ○ | ○ | ○ | ● | ○ |
| Google (AI Mode, Canvas) | tout le monde | n.d. | gratuit | publicité, partenaires | ◐ (itinéraire, vols, hôtels) | ○ | ○ | ○ | ○ | ● | ○ |
| ChatGPT (applis Expedia, Booking) | tout le monde | 800 M d'utilisateurs ChatGPT | gratuit / abonnements | abonnement, applis partenaires | ◐ | ○ | ○ | ○ | ○ | ● | ○ |
| Booking / Expedia / Kayak | réservation | n.d. | gratuit | commission | ○ (réservation) | ○ | ○ | ○ | ○ | ● | ○ |
| FindPenguins | voyageurs | « des millions » | gratuit + livres | livres photo | ◐ | ◐ | ● | ◐ | ○ | ○ | ● (suivi hors ligne) |
| Journi | voyageurs, familles | ~6 M inscrits (2024) | Premium 53,99 €/an | livres photo, abonnement | ○ | ○ | ● | ◐ | ○ | ○ | ◐ |
| Day One | journal personnel | non trouvé | Silver 49,99 $/an, Gold 74,99 $/an | abonnement | ○ | ○ | ● | ○ | ○ | ● (Gold) | ● (chiffrement) |
| AllTrails | randonneurs | 100 M membres | Plus ; Peak 79,99 $/an | abonnement | ◐ (itinéraire du jour) | ● | ◐ | ◐ (avis) | ○ | ● (itinéraires IA) | ● (cartes hors ligne, partage en direct) |
| Komoot (Bending Spoons) | rando, vélo | 45 M | Premium 59,99 €/an | abonnement | ◐ | ● | ◐ | ◐ | ○ | ○ | ● (hors ligne) |
| Strava (clubs) | sportifs | 180 M ; 1 M de clubs | 79,99 $/an | abonnement | ○ | ● | ◐ | ● | ◐ (suivi d'usure) | ◐ | ◐ (Beacon) |
| Meetup (Bending Spoons) | communautés locales | 60 M membres | organisateurs dès 29,99 $/mois | abonnement des organisateurs | ○ | ◐ | ○ | ● | ○ | ○ | ○ |
| Couchsurfing | voyageurs, hôtes | 25 M membres revendiqués | ~5,99 €/mois ou 22,99 €/an (Europe) | abonnement | ○ | ○ | ○ | ● | ○ | ○ | ◐ (vérification) |
| Travello (TWAI) | jeunes voyageurs solo | non trouvé | gratuit | activités, cashback | ○ | ◐ | ◐ | ● | ○ | ○ | ○ |
| Tourlina | voyageuses solo | 157 600+ inscrits | freemium | abonnement | ○ | ○ | ○ | ● | ○ | ○ | ◐ (vérification) |
| Groupes Facebook | tout le monde | 1,8 Md de membres de groupes/mois (2021) | gratuit | publicité | ○ | ◐ | ○ | ● | ○ | ○ | ○ |
| FFRandonnée / FFCAM | pratiquants encadrés FR | 236 768 licences / 110 000+ | licence | associatif | ○ | ● | ○ | ● (clubs réels) | ○ | ○ | ● (encadrement, assurance) |
| LighterPack | ultralégers | non trouvé | gratuit (dons) | open source | ○ | ● | ○ | ◐ (liens partagés) | ● (liste de poids) | ○ | ○ |
| PackWizard | ultralégers US | non trouvé | gratuit | affiliation | ○ | ● | ○ | ◐ | ● (10 000+ objets, prix du jour) | ○ | ○ |
| Packfire | ultralégers | non trouvé | gratuit | soutien Greenbelly / Garage Grown Gear | ○ | ● | ○ | ○ | ● | ○ | ○ |
| Hikt, Packstack, Gearli | randonneurs | Hikt 2 000+ actifs | freemium | abonnement | ○ | ● | ○ | ◐ | ● | ◐ | ◐ |
| Decathlon (seconde vie, location) | grand public | 1,58 M d'objets de seconde main vendus (2025) | — | distribution | ○ | ◐ | ○ | ○ | ● (neuf, occasion, location) | ○ | ○ |
| Vinted (catégorie sport) | grand public | 31 M actifs/mois dans l'UE | 0 frais vendeur | frais acheteur | ○ | ○ | ○ | ○ | ◐ (occasion) | ○ | ○ |
| Patagonia Worn Wear, REI Re/Supply | clients des marques | 160 000 objets (Patagonia), 1,4 M (REI, 2024) | — | revente de marque | ○ | ◐ | ○ | ○ | ◐ | ○ | ○ |
| Location entre particuliers FR (GearAround, GoRoadeo, Locarando, Poppins) | pratiquants locaux | non trouvé (marché en démarrage) | 0 à 20 % de commission | commission | ○ | ◐ | ○ | ◐ | ◐ (location) | ○ | ○ |
| Evaneos | sur mesure, familles | ~1 M voyageurs depuis 2009 | prix du voyage | commission sur agences locales | ● (par un humain) | ◐ | ○ | ○ | ○ | ○ | ● (agence sur place) |
| Allibert / Terres d'Aventure (VDM) | randonneurs FR | 30 000 / ~35 000 voyageurs par an | prix du voyage | voyagiste | ● (forfait guidé) | ● | ○ | ◐ (petit groupe) | ◐ (liste de matériel) | ○ | ● (guide) |
| Intrepid, G Adventures | aventure en petit groupe | 317 880 clients (Intrepid, 2025) | prix du voyage | voyagiste | ● | ● | ○ | ◐ | ○ | ○ | ● |

---

## 2. Fiches par acteur

### 2.1 Planificateurs de voyage et IA

**Polarsteps** (Amsterdam). Application tout-en-un : planifier, suivre automatiquement, revivre son voyage dans un livre imprimé.
- Cible : voyageurs au long cours et backpackers, de plus en plus randonneurs. Marchés : Pays-Bas (9 M d'utilisateurs), puis Belgique, Allemagne, Suisse et France ; les États-Unis et le Royaume-Uni sont les priorités d'expansion ([El Cronista, 28/07/2026](https://www.cronista.com/infotechnology/entreprenerds/ingresos-propios-sin-funding-externo-y-un-premio-de-la-reina-maxima-la-historia-de-la-app-que-compite-contra-google-maps-y-chatgpt/)).
- Utilisateurs : 20 M de voyageurs (mars 2026), contre 15 M en 2025 et 5 M en 2022 ([Polarsteps, 27/03/2026](https://www.polarsteps.com/news/20-million-travelers-and-counting-tech-success-story-polarsteps-celebrates-its-fast-growing-community)) ; 25 M de voyages suivis ; 100 salariés ([Polarsteps, 12/10/2026](https://www.polarsteps.com/news/polarsteps-reaches-100-team-members-and-opens-new-amsterdam-headquarters)).
- Modèle : rentable. Plus de 20 M€ de chiffre d'affaires selon la PDG ([Polarsteps, 15/10/2026](https://www.polarsteps.com/stories/the-people-behind-the-app-ceo-clare-jones-on-accelerating-growth-diverse-revenue-streams-and-company-culture)), « plus de 25 M€ par an » selon le cofondateur, dont plus de 95 % viennent des livres ([El Cronista, 28/07/2026](https://www.cronista.com/infotechnology/entreprenerds/ingresos-propios-sin-funding-externo-y-un-premio-de-la-reina-maxima-la-historia-de-la-app-que-compite-contra-google-maps-y-chatgpt/)). Trois sources de revenus : livres, affiliation (Booking, Airbnb, Hostelworld, depuis 2025) et l'abonnement **Plus**, lancé le 14/07/2026 à 8,99 €/mois ou 29,99 €/an. Plus apporte cartes 3D, profils d'altitude et jusqu'à 10 compagnons de voyage, et vise « randonneurs au long cours, bikepackers, ski de randonnée » ([Polarsteps, 14/07/2026](https://www.polarsteps.com/news/polarsteps-launches-polarsteps-plus-a-new-subscription-for-its-most-dedicated-travelers)). Ni publicité ni revente de données ([Clare Jones, LinkedIn, 20/07/2026](https://www.linkedin.com/posts/clare-jones-_how-does-polarsteps-make-money-polarsteps-activity-7484888485028409345-Fw_A)).
- Levées : 5,05 M$ au total, la dernière série A date de 2019 ([Tracxn, 10/11/2026](https://tracxn.com/d/companies/polarsteps/__Q-i1_EyIFQ7H8ztDGL5LpHMOoZvC18hrwpY-xIskvKg)). Environ 90 % de la croissance vient du bouche-à-oreille. Ambition affichée : 100 M d'utilisateurs actifs par mois.
- Ce qu'il fait mieux que LKDV : l'échelle, la rentabilité, le suivi automatique sobre en batterie, un livre imprimé qui finance tout, et une confiance forte (pas de publicité).
- Ce qu'il n'a pas : ni papiers d'entrée, ni risques, ni budget sourcé, ni kit ou matériel, ni clubs et sorties, ni SOS. Le récit n'y est pas relié à un sac transmissible.
- Actualité : l'arrivée de Plus sur le segment randonnée et 3D en fait le concurrent le plus proche du carnet LKDV.

**Wanderlog** (San Francisco, Y Combinator 2019). Planificateur collaboratif d'itinéraires.
- Utilisateurs : « plus d'1 million de personnes ont essayé », « 8 M+ voyages planifiés », note de 4,9 sur l'App Store ([wanderlog.com, consulté le 18/11/2026](https://wanderlog.com/)). Estimation tierce : environ 100 000 téléchargements et 100 000 $ de revenus par mois en octobre 2026 ([Adapty, mis à jour le 07/11/2026](https://adapty.io/paywall-library/wanderlog/), **estimation**).
- Prix : Pro à 39,99 $/an ([Wanderlog, 14/10/2024](https://wanderlog.com/blog/2024/10/14/is-there-a-free-trip-planner/)). Pro ajoute le hors ligne, la lecture automatique de Gmail, l'optimisation de trajet et l'export vers Google Maps.
- Levées : 1,5 M$ en seed (General Catalyst, Abstract), annoncés en 2021 ([PhocusWire, 06/09/2021](https://www.phocuswire.com/Wanderlog-1-5M-seed-funding)).
- Mieux que LKDV : import automatique des réservations, collaboration en temps réel, ergonomie mûre, guides de la communauté.
- N'a pas : l'outdoor, le kit, la sécurité, les papiers et les risques.

**Mindtrip** (San Francisco, 2023). Planificateur conversationnel qui réserve vols et hôtels, et se vend aux destinations.
- Levées : 22,5 M$ au total. Investisseurs : Costanoa, Forerunner, Amex Ventures, Capital One Ventures, United Airlines Ventures ([PhocusWire, 04/12/2025](https://www.phocuswire.com/mindtrip-ai-travel-planning-capital-one-ventures-united-airlines-ventures)). Rachat de Thatch (mars 2025), application mobile (juin 2025). 51 salariés en juin 2026 ([Hospitality.today, 24/08/2026](https://www.hospitality.today/article/mindtrip-raised-19-million-to-sit-between-your-guest-and-the-search-box)).
- Produit : partenariat agentique avec Sabre et PayPal ([Sabre, 12/02/2026](https://investors.sabre.com/news-releases/news-release-details/sabre-paypal-and-mindtrip-partner-deliver-industrys-first-end)). Lancement de Mindtrip Flights le 06/05/2026 et de Stays le 15/07/2026. Assistant personnel lancé le 30/09/2026 : 18 000 voyageurs en bêta, qui créent 3 fois plus de voyages ([PR Newswire via Yahoo, 30/09/2026](https://finance.yahoo.com/technology/ai/articles/mindtrip-launches-personal-travel-assistant-123400314.html)). Expansion en Europe avec Madère et la Norvège ([PhocusWire, 03/06/2026](https://www.phocuswire.com/news/startups/mindtrip-expands-europe-dmos-ai-trip-planning)). Plus de 35 destinations partenaires, dont le Kentucky ([PR Newswire, 11/11/2026](https://www.prnewswire.com/news-releases/mindtrip-teams-up-with-the-kentucky-department-of-tourism-to-reimagine-how-travelers-discover-the-bluegrass-state-302936706.html)).
- Utilisateurs : non publiés ; plus d'1 M de visites par mois entre juillet et septembre 2025 ([TNMT, 13/11/2025](https://tnmt.com/ai-traveler-journey/)).
- Modèle : commission sur réservations et produit B2B « Answer Intelligence » pour les offices de tourisme.
- Mieux que LKDV : réservation dans la conversation, mémoire des préférences, financement, accords de distribution.
- N'a pas : terrain, sentiers, sécurité, papiers vérifiés, matériel, carnet.

**Layla** (Berlin/Londres). Inspiration par vidéos courtes, puis planification et réservation. Seed de 3 M€ (Firstminute, M13 et les cofondateurs de Booking, Skyscanner et lastminute) ([Travolution, 29/11/2023](https://www.travolution.com/en/data-innovation/new-travel-start-up-layla-announces-3m-in-funding-for-travel-recommendation-app)). Rachat de Roam Around, qui revendiquait 10 M d'itinéraires et 500 000 visites par mois ([TechCrunch, 12/02/2024](https://techcrunch.com/2024/02/12/travel-startup-layla-acquires-flyr-backed-ai-itinerary-building-bot/)). Utilisateurs et prix 2026 : non trouvés. Mieux que LKDV : le lien avec les créateurs (Beautiful Destinations). N'a pas : rien sur l'outdoor.

**Google (AI Mode, Canvas, Flights).** Canvas de planification de voyage dans AI Mode, aux États-Unis ([Google, 17/11/2025](https://blog.google/products-and-platforms/products/search/agentic-plans-booking-travel-canvas-ai-mode/)). Depuis le 27/08/2026, la **réservation d'hôtel se fait dans la conversation** avec Google Pay aux États-Unis, auprès de Booking, Expedia, Marriott, Hilton et d'autres. Le suivi des prix des vols est disponible dans 180 pays, hors EEE ; la réservation de vols n'est pas encore là ([Google, 27/08/2026](https://blog.google/products-and-platforms/products/search/book-travel-ai-mode/) ; [PhocusWire, 27/08/2026](https://www.phocuswire.com/news/technology/google-ai-mode-hotel-booking-agentic-flights-loyalty)). Mieux que LKDV : la distribution, les données Maps et les prix en temps réel. N'a pas : l'aventure hors des routes, le kit, les risques par axe, la communauté.

**ChatGPT et les applis de voyage.** Des applis Booking.com et Expedia existent dans ChatGPT depuis le 06/10/2025, avec accès à « plus de 800 M d'utilisateurs ». Elles sont alors indisponibles dans l'EEE, en Suisse et au Royaume-Uni ([OpenAI, 06/10/2025](https://openai.com/index/introducing-apps-in-chatgpt/) ; [Expedia, 06/10/2025](https://www.expedia.com/newsroom/smart-trip-planning-new-expedia-app-in-chatgpt-to-plan-your-trip/)). AllTrails est aussi accessible dans ChatGPT ([TIME, 30/04/2026](https://time.com/collection/time100-most-influential-companies/2026/alltrails/)). C'est le concurrent d'usage n°1 de la « phrase → voyage ». En revanche, il n'y a aucun calcul vérifié : ni horaires de passage, ni budget sourcé, ni papiers par passeport.

**Booking.com, Expedia, Kayak.** Booking a fait évoluer son AI Trip Planner vers des aides intégrées au parcours : assistance de voyage, voix, résumés de vols ([Booking, 09/10/2025](https://news.booking.com/bookingcom-debuts-agentic-ai-innovations-adding-to-its-robust-suite-of-genai-tools-for-customers/)). Kayak a lancé AI Mode (ChatGPT) le 15/10/2025, devenu « Ask AI » en avril 2026 ([Kayak, 15/10/2025](https://www.kayak.com/news/ai-mode/)). Ce sont des acteurs de réservation : ils ne couvrent pas l'aventure.

**TripIt** (SAP Concur). Il organise les réservations et envoie des alertes. Pro coûte 49 $/an ([TripIt, consulté le 18/11/2026](https://www.tripit.com/web/pro/pricing)) et est offert aux clients Concur TripLink ([TripIt, 25/03/2025](https://www.tripit.com/web/blog/business-travel/tripit-pro-concur-triplink)). Utilisateurs 2026 : non trouvés. Hors du périmètre de l'aventure.

**Roadtrippers.** Road-trips, surtout aux États-Unis. Trois formules de 35,99 à 59,99 $/an ([Roadtrippers, 17/11/2026](https://support.roadtrippers.com/hc/en-us/articles/360000831566-What-features-are-included-with-Roadtrippers-memberships)). Utilisateurs : non trouvés.

### 2.2 Carnets et récit de voyage

**FindPenguins** (Munich). Suivi automatique hors ligne, livre photo, vidéo de survol. Il revendique « des millions » de voyageurs et 10 M de récits d'expérience ([findpenguins.com, consulté le 18/11/2026](https://findpenguins.com/)). Chiffre précis : non trouvé. Gratuit, financé par les livres.

**Journi** (Vienne). Récit chronologique et livres photo. Environ 6 M d'inscrits, 200 000 téléchargements par mois, plus de 20 M€ de chiffre d'affaires en 2023 et +50 % visés en 2024 ([trend.at, 26/11/2024](https://www.trend.at/unternehmen/das-innovativste-start-up-oesterreichs-journi)). Premium à 9,99 €/mois ou 53,99 €/an ([Google Play, mis à jour le 05/11/2026](https://play.google.com/store/apps/details?id=com.journiapp.journi&hl=en_US)).

**Day One** (Automattic). Journal intime chiffré. Silver coûte 49,99 $/an et Gold 74,99 $/an, ce dernier avec l'IA ; Premium a été renommé Silver en mars 2026 ([Day One, consulté le 18/11/2026](https://dayoneapp.com/guides/premium-subscription/day-one-pricing-features-guide/)). Il s'intègre à Strava. Utilisateurs : non trouvés.

**Instagram et TikTok (concurrence d'usage).** Ce sont les lieux par défaut du récit et de l'inspiration. Les planificateurs IA cherchent à les capter : Mindtrip importe les vidéos TikTok, Instagram et YouTube ([BusinessWire, 08/12/2025](https://www.businesswire.com/news/home/20251208469469/en/Mindtrip-Unveils-New-AI-Travel-and-Events-Features-Announces-Investments-From-Amex-Ventures-Capital-One-Ventures-and-United-Airlines-Ventures)) et Layla est née du contenu social. Chez Strava, plus de la moitié de la génération Z dit vouloir utiliser l'application davantage en 2026, et la plupart utiliseront Instagram et TikTok autant ou moins ([Strava, 02/12/2025](https://press.strava.com/articles/strava-releases-12th-annual-year-in-sport-trend-report-2025)).

Ce que ces acteurs font mieux que LKDV : la monétisation par l'objet imprimé (Polarsteps, Journi) et le suivi automatique. Ce qu'ils n'ont pas : un carnet qui juge chaque objet du kit (essentiel, jamais servi, défaillant…) et un bouton « reprendre le kit ».

### 2.3 Outdoor : sentiers, communautés et clubs

**AllTrails.** C'est la référence mondiale de la randonnée : 100 M de membres le 25/08/2026, 500 000 itinéraires et 72 M d'avis ([AllTrails, 25/08/2026](https://www.alltrails.com/press/alltrails-community-reaches-100-million-members)). La formule Peak à 80 $/an apporte des itinéraires « intelligents » par IA, des prévisions d'état du sentier et des cartes de fréquentation ([TechCrunch, 12/05/2025](https://techcrunch.com/2025/05/12/alltrails-debuts-a-80-year-membership-that-includes-ai-powered-smart-routes/)). Partenariats avec T-Mobile (satellite), Apple et OpenAI ([TIME, 30/04/2026](https://time.com/collection/time100-most-influential-companies/2026/alltrails/)). Levée de 150 M$ en 2021 (Permira). Mieux que LKDV : contenu de sentiers (500 000 contre 1 181 sentiers chez LKDV), cartes hors ligne, avis. N'a pas : voyage complet hors du sentier, papiers, budget, groupe, kit.

**Komoot.** 45 M d'utilisateurs. Racheté par Bending Spoons le 20/03/2025 ([BusinessWire, 20/03/2025](https://www.businesswire.com/news/home/20250320568940/en/Bending-Spoons-Acquires-komoot)), pour un prix rapporté d'environ 300 M€ ([DC Rainmaker, 28/05/2025](https://www.dcrainmaker.com/2025/05/komoot-team-goodbye.html), **non officiel**). Environ 85 % des salariés ont été licenciés et les prix ont augmenté : Premium à 59,99 €/an ([BikeRadar, 15/09/2025](https://www.bikeradar.com/news/komoot-redesign-2025)). Il en résulte une **fenêtre de mécontentement** chez les randonneurs européens.

**Strava (clubs).** 180 M d'utilisateurs. Les nouveaux clubs ont presque quadruplé en 2025, jusqu'à 1 M de clubs ; **les clubs de randonnée ont été multipliés par 5,8** ([Strava, 02/12/2025](https://press.strava.com/articles/strava-releases-12th-annual-year-in-sport-trend-report-2025)). Valorisation de 2,2 Md$ ; projet d'introduction en Bourse ([Fortune, 03/03/2026](https://fortune.com/article/strava-ceo-michael-martin-gen-z-run-clubs-analog-lifestyle-social-media-detox-marathons/)). Revenu récurrent estimé à 490 M$ en 2025 ([Sacra, consulté le 18/11/2026](https://sacra.com/c/strava/), **estimation**). Strava est entré sur le marché de la randonnée en 2026 ([The Inertia, 12/06/2026](https://www.theinertia.com/mountain/strava-hiking-app-market-users-alltrails-apple/)).

**Meetup.** 60 M de membres inscrits et 330 000 groupes. Racheté par Bending Spoons en janvier 2024 ([BusinessWire, 24/01/2024](https://www.businesswire.com/news/home/20240124551711/en/Bending-Spoons-finalizes-acquisition-of-U.S.-based-community-building-platform-Meetup-and-announces-%2450000-Community-Fund)). Ce sont les organisateurs qui paient, à partir de 29,99 $/mois ; les prix ont augmenté en juin 2024 ([Meetup, consulté le 18/11/2026](https://help.meetup.com/hc/en-us/articles/28677808413197-Organizer-Subscription-prices-overview)). Mieux que LKDV : la masse critique locale. N'a pas : une préparation, ni de lien entre la sortie et le matériel.

**Couchsurfing.** Revendique 25 M de membres, avec vérification biométrique ([Couchsurfing, consulté le 18/11/2026](https://about.couchsurfing.com/m/en/home)). Le service est payant depuis mai 2020 ; une partie de la communauté est partie ([Fodor's, 28/10/2025](https://www.fodors.com/news/hotels/is-couchsurfing-still-worth-it-how-the-once-free-travel-community-changed-after-going-corporate)). En Europe, environ 5,99 €/mois ou 22,99 €/an ([PriceTimeline, 26/06/2025](https://pricetimeline.com/data/price/couchsurfing)).

**Travello.** Réseau social australien de voyageurs (180 pays), racheté par TWAI en juin 2025 ([LinkedIn Travello, 28/06/2025](https://linkedin.com/company/travello-app)). Le modèle repose sur la réservation d'activités avec cashback. Utilisateurs : non trouvés.

**Tourlina.** Recherche de compagnons de voyage avec profils vérifiés, d'abord pour les femmes. 157 600+ inscrits et 18 000 « matchs » revendiqués ([Tourlina, consulté le 18/11/2026](https://tourlina.com/travel-companion-thailand/)).

**Groupes Facebook.** Ils restent le forum réel des voyageurs : 1,8 Md de membres de groupes par mois (chiffre 2021). En France, « Voyageurs autour du monde » compte 300 000 membres et « Les fouineurs de voyage » environ 800 000 ([Le Figaro, 02/07/2025](https://www.lefigaro.fr/voyages/guides/pourquoi-facebook-est-devenu-une-mine-d-or-pour-les-voyageurs-20250702)).

**FFRandonnée et FFCAM (Club alpin).** La FFRandonnée compte 236 768 licences et 3 251 clubs en 2024/2025 ([FFRandonnée, rapport d'activité 2025](https://www.ffrandonnee.fr/Media/Default/Documents/FFRANDO_Rapport%20d'activit%C3%A9%202025.pdf)). La FFCAM revendique plus de 110 000 licenciés dans 500 clubs et comités ([FFCAM, consulté le 18/11/2026](https://www.ffcam.fr/qui-sommes-nous.html)). Mieux que LKDV : encadrement humain, assurance, légitimité. Ce sont des **partenaires possibles** plutôt que des concurrents : leurs outils numériques sont faibles (constat qualitatif, sans source chiffrée).

### 2.4 Matériel et kit

**LighterPack.** C'est le format standard des listes de poids. Gratuit et open source, il est resté sans développement de 2021 à 2024, puis a repris en juillet 2026 avec 76 commits ([TrailGearList, août 2026](https://trailgearlist.com/best-lighterpack-alternatives/)).

**PackWizard.** Gratuit, financé par l'affiliation. Base de plus de 10 000 objets avec prix du jour et suggestions d'objets plus légers ; web seulement ([PackWizard, consulté le 18/11/2026](https://www.packwizard.com/) ; [Clever Backpacking, 16/10/2026](https://cleverbackpacking.com/2026/10/16/pack-builder-vs-lighterpack/)).

**Packfire.** Gratuit et sans formule payante prévue (Greenbelly, Garage Grown Gear), avec une base d'objets choisie à la main ([Featherline, consulté le 18/11/2026](https://featherline.pro/alternatives/packfire)).

**Hikerbiker.** Non trouvé. Les acteurs actifs en 2026 sont plutôt **Hikt** (2 000+ randonneurs actifs, 9 langues dont le français) ([hikt.app, consulté le 18/11/2026](https://hikt.app/)), Packstack, Gearli, MetaGear et Featherline (suggestions par IA).
- Ce que ces outils font mieux que LKDV : la communauté ultralégère anglophone, la base de prix (PackWizard), l'import et l'export au format LighterPack.
- Ce qu'ils n'ont pas : aucun ne relie la liste à un voyage réel (météo, altitude, nuits), au retour du terrain (verdicts) et à une transmission (lignée).

**Configurateurs de sacs.** Aucun grand fabricant ne propose de configurateur 3D modulaire grand public.
- Mystery Ranch arrête sa ligne outdoor fin 2025, au profit de YETI, et « ne fait pas de travail sur mesure » ; il existe seulement un programme de tailles sur mesure ([Mystery Ranch, consulté le 18/11/2026](https://www.mysteryranch.com/contact)).
- Osprey propose des réglages d'ajustement et une gamme Extended Fit, mais pas de configurateur ([Osprey, consulté le 18/11/2026](https://www.osprey.com/featured/extended-fit)).
- Les marques artisanales (LiteAF, par exemple) se limitent à des options en menu déroulant ([LiteAF, consulté le 18/11/2026](https://liteaf.com/product/dyneema-40l-curve-full-suspension-custom-backpack/)).
- Hyperlite et Decathlon : aucun configurateur trouvé.
- Le **Kit Studio LKDV est donc sans équivalent direct**, mais aussi sans produit vendable aujourd'hui : l'enregistrement d'un corps LKDV ONE est refusé et Stripe est absent (`POTENTIEL-APP.md` § 6).

**Seconde main et location.**
- **Decathlon** : 1,58 M d'objets de seconde main vendus en 2025 dans 43 pays et 1 746 ateliers de réparation ([Decathlon, résultats 2025](https://www.decathlon-united.media/pressfiles/resultats2025)). En France : 570 000 objets d'occasion et **47 000 abonnements de location actifs** ([Ecommerce Nation, 03/04/2026](https://www.ecommerce-nation.fr/decathlon-20-milliards-bascule-modele-plateforme-sport/)). Le Trocathlon existe depuis 1986 ([Decathlon, consulté le 18/11/2026](https://www.decathlon.fr/Seconde-vie_lp-7FWOY6)).
- **Vinted** : catégorie Sport lancée le 20/05/2025, avec « camping, randonnée et cyclisme » ([Vinted, 20/05/2025](https://www.vinted.fr/infoboard)) ; volume d'affaires de 10,8 Md€ en 2025 ([Vinted, 09/04/2026](https://company.vinted.com/newsroom/financial-results-2025)).
- **Patagonia Worn Wear** : 160 000 objets et environ 13 M$ en exercice 2026, intégré à patagonia.com le 14/10/2026 ([GearJunkie, 14/10/2026](https://gearjunkie.com/apparel/patagonia-used-gear-website)). Cela représente environ 1 % du chiffre d'affaires ([Aistetic, consulté le 18/11/2026](https://www.aistetic.com/resale-operations/briefing/what-worn-wear-is-actually-telling-you)).
- **REI Re/Supply** : 1,4 M d'objets en 2024 ([Trellis, 08/05/2025](https://trellis.net/article/rei-reaches-key-zero-waste-milestone-before-target-and-walmart/)), retiré de la vente en ligne en 2025 ([GearJunkie, 14/10/2026](https://gearjunkie.com/apparel/patagonia-used-gear-website)).
- **Location entre particuliers en France** : marché éclaté et naissant. GearAround est gratuit et sans assurance ([geararound.fr](https://geararound.fr/)). GoRoadeo n'est pas encore ouvert au public (commission de 15 à 20 %) ([goroadeo.com](https://goroadeo.com/)). Locarando passe par Stripe ([app-locarando.fr](https://app-locarando.fr/)). Poppins est généraliste, avec une garantie jusqu'à 5 000 € ([poppins.app](https://www.poppins.app/fr-fr/location/sport-activite-exterieur/)). Trippez (Pau, 2021) avait une commission de 20 % ([Sport et Tourisme, 31/08/2021](https://www.sport-et-tourisme.fr/corporate/trippez/)). Pages consultées le 18/11/2026. **Aucun leader.**
- Côté LKDV : prêts entre membres (G05) et petites annonces (E29) en production. Aucune **location payante** n'apparaît dans l'inventaire.

### 2.5 Organisateurs de voyages d'aventure (concurrence d'usage)

**Evaneos.** Voyage sur mesure avec des agences locales : 2 000 agences et 160 destinations ([Evaneos, consulté le 18/11/2026](https://www.evaneos.fr/presse/a-propos/)). Plus d'1 M de voyageurs et 1 Md€ de ventes depuis 2009 ([e-marketing, 01/07/2025](https://www.e-marketing.fr/Thematique/marques-1296/strategie-marque-2250/Breves/aurelie-saint-martin-evaneos-sommes-alternative-concrete-surtourisme-482645.htm)). Croissance à deux chiffres en 2025 ; voyages en famille +25 % ([L'Écho touristique, 28/01/2026](https://www.lechotouristique.com/article/evaneos-les-familles-tirent-la-croissance)). Environ 110 M€ levés au total, dont 20 M€ en 2022 ([L'Écho touristique, 06/12/2022](https://www.lechotouristique.com/article/evaneos-leve-20-millions-deuros-pour-accelerer-son-essor-en-europe)). Mieux que LKDV : un humain sur place, la réservation, la garantie. N'a pas : l'autonomie, le kit, la communauté, le récit.

**Voyageurs du Monde (Allibert, Terres d'Aventure, Nomade).** L'activité aventure du groupe pèse 231,7 M€ en 2025 (+8,8 %) ([VDM, résultats 2025, 15/04/2026](https://www.voyageursdumonde.fr/voyage-sur-mesure/Img/institutionnel/info-fi/data/2025/RA-31.12.2025-VOY-VDef.pdf)).
- Allibert : environ 60 M€, 30 000 voyageurs par an, 1 600 voyages ; « 4 voyageurs sur 10 choisissent un niveau 1 ou 2 », avec une nouvelle identité lancée le 05/10/2026 ([Allibert, 05/10/2026](https://www.allibert-trekking.com/uploads/media/documents/4684-communique-de-presse-5-10-2026-eco.pdf)).
- Terres d'Aventure : environ 35 000 voyageurs et 85 M€ en 2024 ([Next Tourisme, 04/04/2025](https://www.next-tourisme.com/eric-balian-terres-d-aventure-service-client-humanise-et-personnalise/)).
- La Balaguère : non trouvé.

**Intrepid.** « Plus grande entreprise d'aventure du monde » selon elle : 809,3 M A$ de chiffre d'affaires (+29 %) et 317 880 clients en 2025 ; 1 Md A$ de réservations visé en 2026 ([Intrepid, mars 2026](https://www.intrepidtravel.com/en/newsroom/releases/reveals-record-fy2025-financial-impact-and-customer-results)).

**G Adventures.** Ventes +20 % sur l'exercice 2025, plus de 1 000 voyages, formule « Solo-ish » ([ATTA, 05/09/2025](https://www.adventuretravelnews.com/g-adventures-fy25-a-year-of-big-steps-bold-moves-incredible-impact)).

**Komoot Collections et guides** : voir Komoot (§ 2.3).

Ce que ces voyagistes font mieux que LKDV : la responsabilité juridique, la logistique, le guide, et une marque de confiance pour les débutants. Ce qu'ils n'ont pas : la préparation en autonomie, gratuite et immédiate, le matériel et la vie de groupe après le voyage. LKDV peut leur **fournir des clients autonomes** ou leur vendre un outil, plutôt que les combattre.

---

## 3. Synthèse

### 3.1 Tendances

1. **La planification par IA devient le métier des géants.**
   - Google réserve des hôtels dans AI Mode (États-Unis, 27/08/2026) ; ChatGPT intègre Booking et Expedia (06/10/2025) ; Kayak, Booking et Expedia ont chacun leur IA ; Mindtrip, avec 22,5 M$, réserve vols et hôtels.
   - Adoption réelle : 67 % des voyageurs ont déjà utilisé l'IA pour un aspect du voyage ([Booking.com, 23/07/2025](https://news.booking.com/bookingcom-releases-the-global-ai-sentiment-report/), 37 325 personnes dans 33 pays).
   - Mais seuls **8 % des voyageurs américains et britanniques s'appuient sur un chatbot pour planifier**, contre 59 % sur un moteur de recherche ([Expedia, 14/04/2026](https://ir.expediagroup.com/news-and-events/news/news-details/2026/Expedia-Group-Reveals-The-AI-Trust-Gap-Travelers-Embrace-AI-for-Planning-but-Rely-on-Trusted-Brands-to-Book/default.aspx)). Au Royaume-Uni, l'ABTA mesure 8 % contre 4 % un an plus tôt ([BBC, 07/10/2025](https://www.bbc.com/news/articles/czdjzm2gv7qo)).
   - Le frein n°1 est l'information fausse ou périmée, citée par 58 % ([Beach.com, 24/09/2025](https://www.beach.com/trends/ai-trip-planner-survey/)). La **vérification** (lieux réels, sources affichées) répond directement à ce frein.
2. **Le freemium devient la règle, souvent plus cher.** Polarsteps Plus (29,99 €/an, juillet 2026), AllTrails Peak (79,99 $/an), Komoot (59,99 €/an après rachat), Strava (79,99 $/an), Day One Gold (74,99 $/an). Bending Spoons, propriétaire de Komoot et Meetup, applique hausses de prix et réductions d'équipe, ce qui crée du mécontentement.
3. **La seconde main et la location deviennent courantes, mais rapportent peu.** Decathlon : 1,58 M d'objets et 47 000 abonnements de location en France. Vinted ouvre le sport en 2025. Patagonia rapatrie Worn Wear sur son site principal, qui ne pèse pourtant qu'environ 1 % de son chiffre d'affaires. REI retire Re/Supply du web. Le matériel de randonnée est rare en occasion : « le problème n'est pas de les vendre, mais d'en trouver à vendre » (Au Vieux Campeur, [L'Équipe, 31/12/2025](https://www.lequipe.fr/Respire/Tendances/Actualites/Velos-skis-sacs-de-randonnee-quels-equipements-sportifs-ont-la-cote-sur-le-marche-de-l-occasion/1628099)).
4. **Les communautés de niche se rencontrent en vrai.** Clubs de randonnée multipliés par 5,8 sur Strava (2025), « Solo-ish » chez G Adventures, groupes Facebook de voyageuses, Tourlina. L'enjeu se déplace de l'application vers la **sortie réelle**, avec de la confiance et de la vérification.
5. **Les planificateurs se rapprochent de l'outdoor.** Polarsteps ajoute la 3D et l'altitude pour randonneurs, Strava entre dans la randonnée (2026), AllTrails ajoute itinéraires IA et intégration ChatGPT. L'espace « aventure » attire désormais les acteurs à 20–180 M d'utilisateurs.

### 3.2 Tailles de marché (avec réserves)

| Marché | Valeur | Source | Réserve |
|---|---|---|---|
| Tourisme d'aventure mondial | 1 160 Md$ (2024), dépense des voyageurs internationaux « d'aventure » | [ATTA, consulté le 18/11/2026](https://learn.adventuretravel.biz/adventure-travel-market-sizing) | définition large (tout le voyage d'un voyageur « ouvert à l'aventure ») |
| Tourisme d'aventure mondial | 406 Md$ (2024), environ +17 %/an jusqu'en 2030 | Grand View Research, cité par [Forbes, 04/02/2025](https://www.forbes.com/sites/sarahhernholm/2025/02/04/the-rise-of-adventure-travel-among-digital-nomads-and-entrepreneurs/) | les cabinets divergent : 394 Md$ (GIA, 2024, [atpress, 05/09/2025](https://www.atpress.ne.jp/news/3643405)), 421,9 Md$ (TBRC, 2025, [TBRC, 09/2026](https://www.thebusinessresearchcompany.com/report/adventure-tourism-global-market-report)) |
| Voyagistes d'aventure (repère réel) | 231,7 M€ (pôle aventure VDM, 2025) ; 809 M A$ (Intrepid, 2025) | rapports annuels cités § 2.5 | chiffres audités, préférables aux rapports de cabinet |
| Équipement de randonnée mondial | 6,4 Md$ (2025), puis 10,9 Md$ en 2033 | [Grand View Research, juin 2026](https://www.grandviewresearch.com/industry-analysis/hiking-gear-equipment-market) | hors camping |
| Camping et randonnée, équipement mondial | 17,31 Md$ (2025), Europe 41 % | [Fortune Business Insights, 02/11/2026](https://www.fortunebusinessinsights.com/camping-and-hiking-equipment-market-115954) | |
| Outdoor en Europe | non retenu | — | l'EOG est passé aux données de sortie de caisse et n'a pas publié de taille de marché fiable en 2025 ([EOG, 19/05/2026](https://www.europeanoutdoorgroup.com/articles/european-outdoor-week-partners-reveal-plans-to-build-on-successful-first-event)) ; les chiffres qui circulent (10,4 Md€, 21,7 Md€) viennent de sources secondaires incohérentes |
| Outdoor en France | 1,4 Md€ (2025) ; 79 % des Français pratiquent une activité outdoor, 64 % la marche ou la randonnée | OpinionWay pour Intersport, [Sport Stratégies, 16/07/2026](https://www.sportstrategies.com/outdoor-le-nouveau-moteur-du-marche-du-sport/) | étude commandée par une enseigne |
| Articles de sport en France | 20 Md€ (2025, -0,3 %) | UESC, [LSA, 22/04/2026](https://www.lsa-conso.fr/decathlon-vs-intersport-pourquoi-ces-deux-leaders-du-sport-ecrasent-la-concurrence-analyse-de-leur-strategie,465438) | |
| Seconde main outdoor | **non trouvé** (aucune taille de marché sérieuse) | — | repères : vélo d'occasion = 26 % du neuf en France (Xerfi, via [L'Équipe, 31/12/2025](https://www.lequipe.fr/Respire/Tendances/Actualites/Velos-skis-sacs-de-randonnee-quels-equipements-sportifs-ont-la-cote-sur-le-marche-de-l-occasion/1628099)), +12,6 % en 2025 ([UESC](https://www.unionsportcycle.com/observatoire-du-cycle/chiffres-marche)) ; Decathlon 570 000 objets en France (2025) |

**Estimation** de la cible LKDV en France : environ 350 000 licenciés de randonnée et de montagne (FFRandonnée 236 768 + FFCAM 110 000, en comptant les doubles licences). C'est le noyau « engagé » ; la base pratiquante, beaucoup plus large, représente 64 % des adultes qui marchent ou randonnent.

### 3.3 Espaces libres

1. **La préparation vérifiable de l'aventure hors des villes.** Personne ne combine itinéraire sur lieux réels, papiers par passeport, alertes officielles, risques par axe, budget sourcé et kit calculé en une seule demande. Les IA généralistes produisent du texte non vérifié ; AllTrails et Komoot couvrent le sentier, pas le voyage ; les voyagistes le font, mais avec un humain et contre paiement. La réponse au « fossé de confiance » de l'IA mesuré par Expedia est la vérification affichée.
2. **La boucle matériel ↔ terrain ↔ récit.** Aucun concurrent ne relie la liste de matériel (LighterPack, PackWizard) au voyage réel, au retour d'expérience objet par objet, puis à la transmission (« reprendre le kit », lignée, part créateur). Polarsteps et Journi racontent sans matériel ; les outils ultralégers pèsent sans raconter.
3. **Le configurateur de sac modulaire en 3D.** Aucun équivalent grand public trouvé chez Osprey, Mystery Ranch (qui sort de l'outdoor), Hyperlite ou Decathlon.
4. **La location de matériel entre pratiquants, en France.** Le marché est éclaté (GearAround, GoRoadeo, Locarando, Poppins), la demande existe (randonnée dans le top 3 des recherches de seconde vie chez Decathlon, matériel rare en occasion) et il n'y a pas de leader. Le prêt entre membres de LKDV en est la première brique, mais il n'y a pas encore de paiement.
5. **Les compagnons d'aventure avec seuil de confiance, rattachés à un voyage précis.** La « bouteille à la mer » répond à ce que font Tourlina, Couchsurfing et les groupes Facebook, mais à l'intérieur de la préparation. Strava montre que les clubs de randonnée explosent.
6. **Les Européens mécontents des rachats.** Hausse des prix et réduction d'équipe chez Komoot ; Meetup facture les organisateurs ; Couchsurfing est devenu payant. Une offre française, sans publicité et respectueuse des données (RGPD, pas de coordonnées partagées) peut capter cette défiance. Polarsteps prouve que cette promesse est rentable.
7. **Un outil pour les fédérations et les voyagistes.** FFRandonnée et FFCAM ont environ 350 000 licenciés et des outils numériques faibles (constat qualitatif). Allibert vise les débutants. LKDV peut être leur outil de préparation ou leur source de clients.

### 3.4 Où LKDV est en retard

- **Traction nulle** face à des acteurs comptant de 20 à 180 M d'utilisateurs. Ce n'est pas un défaut du produit mais un manque de distribution.
- **Pas de réservation ni de revenus actifs** : Stripe, affiliation et formule Pro sont absents ou non branchés. Mindtrip, Google et ChatGPT réservent déjà dans la conversation.
- **Contenu de sentiers mince** (1 181 sentiers contre 500 000 chez AllTrails), et pas de cartes hors ligne comparables à AllTrails ou Komoot.
- **Absent des stores, français uniquement**, face à des concurrents internationaux : AllTrails propose 14 langues ([AllTrails, 25/08/2026](https://www.alltrails.com/press/alltrails-community-reaches-100-million-members)) et Hikt 9.
- **Fiabilité des données ouvertes** (Overpass souvent indisponible), aucun connecteur de montre actif, catalogue de test hors outdoor.
- **Effets de réseau communautaires** (clubs, sorties) à construire de zéro face à Strava, Meetup et Facebook.
