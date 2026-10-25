# Préparateur LKDV — audit des données, des sources et des blocages (7 octobre 2026)

> Objectif : que le Préparateur aille au bout de presque toutes les demandes (voyage,
> rando, trek, road trip, sortie courte, séjour sur place). Audit du code et de la base
> réelle, puis recherche des meilleures sources. Rien n'est supposé : chaque chiffre
> « mesuré » vient de la base de production du 7 octobre.

## 1. Le constat mesuré

| Mesure (3 derniers jours, base de production) | Valeur |
|---|---|
| Aventures créées par le Compas | 154 |
| Préparées jusqu'au bout | 138 (90 %) |
| Jamais préparées (pas de lieu ou de durée compris) | 16 (10 %), dont 13 sans lieu trouvé |
| Sans aucune étape | 7 |
| Préparées **avec un repli** (lieu introuvable, carte indisponible, itinéraire impossible) | 53 (38 % des préparées) |
| Catalogue de parcours `hiking_routes` | 1 171, **dont ~1 130 dans le Nord et en Belgique** (1 seul dans les Alpes) |
| Refuges en base (`map_refuges`) | 10 |
| Lieux GeoNames (`places_geo`) | 592 816, mais **692 seulement pour la France** (import partiel) |

Ce que les 40 parcours rejoués aujourd'hui ont montré : quand les données existent
(lieux réels de la zone), le calcul donne un bon résultat en 25 à 40 s ; quand une source
répond mal ou qu'une donnée manque, tout le reste s'effondre en cascade (repli sur l'IA,
dépassement de temps, étapes répétées).

## 2. Les données que nous avons déjà

| Domaine | Source actuelle | Qualité | Limite |
|---|---|---|---|
| Comprendre la demande | Règles maison (`intent.ts`) + IA NVIDIA (Nemotron) | Bonne pour durée, groupe, activité, dates | Lieux composés mal lus (« Le Népal en trek »), dépend de l'IA |
| Trouver le lieu (géocodage) | Photon (komoot) + Nominatim (OSM) | Bonne couverture mondiale | Homonymes (Mont Rose, Vosges département/massif) ; **usage commercial non prévu** sur les instances publiques |
| Lieux d'une zone (villages, refuges) | Photon par catégorie, Overpass en secours | Bonne (testé sur 6 zones) | Instances publiques limitées ; pas d'altitude ni de population dans Photon |
| Parcours de randonnée | `hiking_routes` (OSM) | Bonne là où il y en a | **Quasi uniquement Nord / Belgique** |
| Distances et itinéraires routiers, à pied, à vélo | OSRM / Valhalla / BRouter publics (FOSSGIS) | Bonne | Serveurs de démonstration, retrait possible à tout moment |
| Altitude | Tuiles de relief Terrarium (AWS Open Data) | Bonne, gratuite | — |
| Météo prévue (≤ 9 jours) | MET Norway | Très bonne, gratuite, commerciale OK | Exige un User-Agent identifié |
| Météo de saison (tendance) | NASA POWER | Bonne, domaine public | — |
| Alertes météo | MeteoAlarm | Europe seulement | — |
| Alertes pays | Liens diplomatie.gouv.fr | Lien seulement | Pas d'API officielle |
| Points sur place (eau, commerces, restos) | Overpass | Bonne | Même limite qu'Overpass |
| Prix (repas, nuits, location) | **Barème maison** (`costs.ts`, ~110 pays) | Ordre de grandeur cohérent | Fait main ; pays absents = moyenne |
| Vols | **Barème par tranche de distance** | Approximatif | Aucun prix réel |
| Trains, bus, ferries | **Rien** | — | Pas de transport en commun |
| Hébergements réels | RouteStack (bac à sable) | — | Pas en production |
| Activités réservables | Viator | Bonne | Réservation verrouillée |
| Visas / formalités | **Table maison (25 pays)** | Partielle | Russie, Chine… absents |
| Change | Frankfurter (BCE) | Bonne, gratuite | — |
| Matériel / inventaire / boutique | Supabase (`trip_items`, inventaire, 67 produits) | Bonne | — |

## 3. Les données qui manquent pour couvrir la majorité des demandes

1. **Grands itinéraires de randonnée partout** (GR, GRP, Haute Route, TMB, sentiers
   nationaux étrangers) : notre catalogue ne couvre que le Nord.
2. **Lieux marquants d'un pays ou d'une région** (pour un road trip ou un circuit de
   13 jours au Vietnam ou en Russie, savoir que ce sont Hanoï, Hạ Long, Huế, Hội An qui
   comptent) : aujourd'hui seule l'IA le sait, d'où les lieux inventés.
3. **Contours des massifs et parcs** (« Vosges » = le massif, pas le département) :
   aucune donnée de massif.
4. **Refuges et abris** hors OSM partiel (10 en base).
5. **Transports réels** : trains, bus, ferries, et prix de vols réels.
6. **Hébergements réels** avec prix et disponibilité.
7. **Formalités d'entrée** pour tous les pays (visa, ETA, durée).
8. **Niveau de prix officiel par pays** (remplacer le barème fait main).
9. **Saisonnalité par activité** (enneigement, mousson, ouverture des refuges).
10. **Lieux habités du monde entier en base locale** (pour ne plus dépendre d'un service
    externe à chaque préparation) : GeoNames complet.

## 4. Ce qui s'obtient gratuitement (API ou open data), utilisable commercialement

| Donnée | Meilleure source gratuite | Licence | Limites / conditions |
|---|---|---|---|
| Lieux habités du monde (nom, population, altitude, noms alternatifs) | **GeoNames** `cities500` / `allCountries` + `alternateNames` (téléchargement) | CC BY 4.0, commercial autorisé | Import ponctuel en base, mise à jour mensuelle |
| Lieux marquants, sommets, massifs, parcs, notoriété (nombre de liens Wikipédia) | **Wikidata** (dump ou SPARQL) | CC0 | SPARQL public : 60 s de calcul par minute → passer par un import, pas en direct |
| Liste « villes / autres destinations » d'un pays ou d'une région, itinéraires types | **Wikivoyage** (dumps) | CC BY-SA 4.0 | Citer, partage à l'identique pour le texte ; les listes de noms sont exploitables |
| Itinéraires de randonnée balisés du monde (GR, iwn/nwn/rwn) | **OSM route relations** (via import Overpass ou Geofabrik) ; Waymarked Trails pour le GPX | ODbL | Attribution OSM ; base dérivée sous ODbL |
| Refuges, cabanes, points d'eau (Alpes, Pyrénées) | OSM (`tourism=alpine_hut`, `wilderness_hut`) ; refuges.info | ODbL ; refuges.info : licence non claire | Demander l'accord à refuges.info avant usage commercial |
| Niveau de prix par pays | **Banque mondiale** `PA.NUS.PPPC.RF` (niveau de prix PPA) | CC BY 4.0 | Annuel, couvre tous les pays |
| Visas pour un passeport français | jeu `visa-requirements` (datahub, CC BY 4.0) ; `passport-index-dataset` (archivé 2025) | CC BY 4.0 / MIT | À rafraîchir ; toujours renvoyer vers diplomatie.gouv.fr |
| Météo prévue | **MET Norway** (déjà en place) | NLOD / CC BY 4.0 | User-Agent identifié obligatoire |
| Climat de saison | **NASA POWER** (déjà en place) | Domaine public | — |
| Altitude | Terrarium AWS (déjà en place) ; Copernicus GLO-30 | Libre (attribution) | — |
| Transport en commun Europe | **Transitous** (MOTIS, 1 300 flux GTFS, 48 pays) | Service bénévole | Réservé aux usages libres / non lucratifs → **auto-héberger MOTIS** pour un usage commercial |
| Itinéraires routiers / à pied / à vélo | OSRM, Valhalla, BRouter (serveurs FOSSGIS) | ODbL | Démo : attribution, peut être retiré ; commercial = auto-héberger |
| Prix des carburants (France) | data.gouv « prix des carburants » | Licence Ouverte | France seulement |
| Change | Frankfurter / BCE (déjà en place) | Libre | — |

**Important : les instances publiques gratuites (Overpass, Nominatim, Photon, OSRM) ne
sont pas prévues pour un usage commercial intensif.** Overpass demande l'auto-hébergement
ou une instance payante pour le commercial ; Nominatim, 1 requête/s au total ; Photon,
« usage équitable, sera bridé ». Seule exception repérée : l'instance Overpass de
Private.coffee autorise l'usage commercial sans limite annoncée.

## 5. Les meilleures API payantes (quand le gratuit ne suffit pas)

| Besoin | API | Coût indicatif | Remarque |
|---|---|---|---|
| Géocodage + lieux + itinéraires en un seul fournisseur OSM | Geoapify | gratuit 3 000 crédits/jour « commercial limité » ; **59 $/mois** commercial complet | Le plus simple pour remplacer Photon/Nominatim/Overpass publics |
| Itinéraires à pied / randonnée / vélo fiables | GraphHopper | gratuit non commercial ; **à partir de 56 €/mois** | Profil « hiking » réservé aux offres payantes |
| Itinéraires (alternative) | openrouteservice | gratuit 2 000/jour **non commercial** ; commercial sur devis | — |
| Météo étendue (historique, saisonnier) | Open-Meteo | **29 $/mois** (1 M appels) | Gratuit seulement non commercial |
| Hébergement + prix réels | Booking.com Demand API | Commission | **Statut « Managed Affiliate Partner » obligatoire**, contrat |
| Vols, hôtels, transferts, location (prix et liens) | Travelpayouts (Aviasales, etc.) | Gratuit, rémunéré à la commission | Inscription partenaire ; Data API pour les prix de vols |
| Vols réservables | Duffel | Frais par réservation | Amadeus Self-Service **ferme le 17/07/2026** |
| Hébergements (alternative) | RouteStack (déjà intégré) | Selon contrat | Clés de production à obtenir |
| Activités | Viator (déjà intégré) | Commission | Réservation à déverrouiller |

## 6. Ce qui exige obligatoirement un compte payant ou partenaire

- **Prix et disponibilités réels d'hébergement** : Booking (partenaire géré), RouteStack
  (clés de production) ou Travelpayouts (hôtels).
- **Prix réels de vols** : Travelpayouts Data API (compte partenaire, gratuit) ; réservation :
  Duffel.
- **Billets de train et bus** (prix, réservation) : partenaires type Trainline, Omio
  (hors open data).
- **Réservation de refuges** : pas d'API ouverte (gardiens, plateformes régionales).
- **IA en production** : le point d'accès gratuit NVIDIA (build.nvidia.com) est réservé à
  l'évaluation et au prototypage ; servir de vrais utilisateurs relève d'une licence
  NVIDIA AI Enterprise. Il faut un fournisseur d'IA payant pour la production.
- **Usage commercial des services OSM** à volume : auto-hébergement (serveur) ou
  fournisseur payant (Geoapify, GraphHopper…).

## 7. Les vrais blocages actuels

| Blocage | Effet observé | Cause | Remède |
|---|---|---|---|
| **Durée de calcul bridée à 60 s par nous-mêmes** | Préparations coupées, deux phases, reprises | `export const maxDuration = 60` dans `src/app/compas/page.tsx` ; Vercel Fluid Compute autorise 300 s (offre gratuite) et 800 s (Pro) | Monter à 300 s et faire une seule passe (aucun coût) |
| **Comprendre le lieu** | 13 aventures sans lieu ; Mont Rose à Marseille ; Vosges = plaine | Géocodeur sans notion de « massif », « parc », « région touristique » | Table locale des massifs, parcs et régions (Wikidata + OSM), choix selon l'activité |
| **Itinéraire à l'échelle d'un pays** | Noms inventés par l'IA, 45 % introuvables à l'audit | Aucune donnée « lieux marquants » | Wikidata (notoriété) + Wikivoyage (« villes / autres destinations ») en base |
| **Catalogue de randonnées** | Treks hors Nord calculés de village en village, sans sentier réel | 1 171 parcours, presque tous dans le Nord | Import mondial des relations OSM `route=hiking` (iwn, nwn, rwn) |
| **Dépendance aux services publics gratuits** | « Service de carte injoignable » en série | Limites Overpass, Photon, Nominatim pour une IP partagée Vercel | Données de base en local (GeoNames, Wikidata, routes OSM), puis Geoapify ou auto-hébergement |
| **Transports** | Vol estimé à la distance, aucun train ni bus | Aucune source de transport | Travelpayouts (vols), Transitous auto-hébergé ou Navitia (trains et bus) |
| **Prix** | Barème fait main, vol approximatif, visas partiels | Pas de source officielle branchée | Banque mondiale (niveau de prix), jeu visas CC BY, Travelpayouts (vols) |
| **Hébergement et réservation** | Pas d'offre réelle | RouteStack en bac à sable, Booking non partenaire | Clés RouteStack de production ou Travelpayouts / Booking |
| **IA en production** | Risque juridique et quotas (40 requêtes/min) | Point d'accès NVIDIA d'évaluation | Fournisseur payant (contrat de production) |
| **Orchestration** | Deux appels serveur, verrous, reprises | Contournement de la limite de 60 s | Une préparation en une passe (300 s), étapes enregistrées |
| **Repli** | Une source en panne fait tomber toute la préparation | Chaque étape dépend d'un service en direct | Données de base en local : la préparation n'a plus besoin du réseau pour l'essentiel |

## 8. Les fondations à construire (sans attendre Tony, sauf mention)

1. **Une passe unique de 300 s** au lieu de deux de 60 s. Gratuit, immédiat.
2. **Référentiel géographique local** dans Supabase (une migration, accord de Tony) :
   GeoNames complet (lieux habités, altitude, population, noms en français), Wikidata
   (massifs, parcs, sommets, notoriété), relations de randonnée OSM mondiales. Le Préparateur
   lit sa propre base au lieu d'appeler 4 services publics à chaque demande.
3. **Résolution du lieu selon l'activité** : « Vosges + rando » → massif ; « Vosges +
   road trip » → département ; « Mont Rose » → le plus notoire.
4. **Lieux marquants** pour les circuits à l'échelle d'un pays (Wikidata + Wikivoyage) :
   l'IA ne propose plus de noms, elle classe au plus.
5. **Prix et formalités ouverts** : niveau de prix Banque mondiale, jeu visas CC BY 4.0.
6. **Transports** : vols réels via Travelpayouts ; trains et bus en dernier (auto-hébergement
   MOTIS ou partenaire).

Sources principales : [Overpass API (wiki OSM)](https://wiki.openstreetmap.org/wiki/Overpass_API),
[Overpass Private.coffee](https://main.overpass-landing.privatecoffee.coffeegit.page/),
[Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/),
[OSRM / FOSSGIS](https://routing.openstreetmap.de/about.html),
[Open-Meteo pricing](https://open-meteo.com/en/pricing),
[MET Norway ToS](https://api.met.no/doc/TermsOfService),
[GeoNames export](https://geonames.org/export/),
[Wikivoyage dumps / API](https://enterprise.wikimedia.com/project-data/wikivoyage-api/),
[Waymarked Trails](https://wiki.openstreetmap.org/wiki/Waymarked_Trails),
[openrouteservice plans](https://openrouteservice.org/plans/),
[GraphHopper pricing](https://www.graphhopper.com/pricing/),
[Geoapify pricing](https://geoapify.com/pricing),
[Transitous API](https://transitous.org/api/),
[Banque mondiale PA.NUS.PPPC.RF](https://data.worldbank.org/indicator/PA.NUS.PPPC.RF),
[visa-requirements (datahub)](https://datahub.io/visa-requirements/visa-requirements-dataset/CONTRIBUTING),
[passport-index-dataset](https://github.com/ilyankou/passport-index-dataset),
[Booking Demand API prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites),
[Travelpayouts APIs](https://support.travelpayouts.com/hc/en-us/articles/20384016664594-Brands-that-provide-access-to-APIs-and-data-feeds-for-Travelpayouts-partners),
[Amadeus Self-Service shutdown](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers),
[NVIDIA NIM FAQ](https://forums.developer.nvidia.com/t/nvidia-nim-faq/300317),
[Vercel functions limits](https://vercel.com/docs/functions/limitations),
[Photon](https://github.com/komoot/photon).
