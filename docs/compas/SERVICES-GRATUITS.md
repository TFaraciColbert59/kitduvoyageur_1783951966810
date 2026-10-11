# Compas — services gratuits autorisés en commercial (vérifiés le 8 octobre 2026)

> Règle du chantier : **0 €**, et seulement des services dont les conditions permettent
> l'usage commercial. Recherche du 8 octobre : six recherches parallèles, 275 sources lues
> (pages officielles quand le proxy les laissait passer, sinon extraits de recherche,
> signalés). Ce n'est pas un avis juridique ; chaque ligne « à confirmer » doit être relue
> sur la page officielle avant le lancement.
>
> Légende : **Oui** autorisé · **Non** interdit · **?** conditions floues (usage modéré
> seulement, confirmer par écrit) · *(extrait)* lu dans un extrait de recherche, pas sur
> la page.

## Ce qui change dans le plan

| Sujet | Utilisé aujourd'hui | Verdict | Choix à 0 € |
|---|---|---|---|
| Hébergement | Vercel Hobby (aucune facture sur le compte) | **Non** : Hobby réservé à l'usage personnel non commercial ; « tout moyen de demander ou traiter un paiement » et un site d'affiliation sont commerciaux | ⚖️ Tony (voir « Décisions ») |
| IA | NVIDIA, clé d'essai | **Non** en production : l'essai sert à l'évaluation ; « production » = toute activité qui sert de vrais utilisateurs | Compas complet sans IA ; IA allumée seulement pour les tests tant qu'aucune offre conforme n'existe à 0 € |
| Fond de carte | Esri sans clé, OSM France, OpenTopoMap | **Non** (Esri sans clé : usage commercial sur accord écrit ; OSM France : sites sans but lucratif) | OpenFreeMap (standard) + ArcGIS Location Platform gratuit (relief, satellite) |
| Routage | ~~OSRM démo, FOSSGIS OSRM, BRouter~~ (retirés le 8 oct.) ; Geoapify, Valhalla | OSRM démo **Non** (vérifié) ; BRouter **?** | **Fait (lot D)** : cache → Geoapify Routing → Valhalla FOSSGIS (identifié) → estimation annoncée |
| Overpass | 5 serveurs en course | overpass-api.de **Non** pour une application ; private.coffee **Oui** *(extrait)* | private.coffee seul, en série |
| Géocodage | Photon, Nominatim, Geoapify | Nominatim **Non** pour le trafic d'une application ; Photon **?** | Référentiel local → Geoapify → LocationIQ → Photon (faible volume) |
| Papiers par passeport | travelrequirements.info v1.3.0 (table versionnée, côté serveur) ; règles internes en repli | Jeux « Passport Index » **Non** (recherche académique seulement, même republiés sous MIT) | **Fait (lot T)** : travelrequirements.info (CC BY 4.0), `scripts/compas/build-entry-requirements.mjs` ; crédit dans les mentions légales |

## Services retenus

| Service | Limite gratuite | Commercial | Obligations | Source |
|---|---|---|---|---|
| **Geoapify** (géocodage, lieux, routage) | 3 000 crédits/jour, 5 req/s ; au-delà, pas de facture | Oui (page [pricing](https://www.geoapify.com/pricing) lue le 10 oct. 2026 : « You can use the Free plan for commercial websites, apps, and business projects, including in production » dans les limites du plan ; les conditions générales, elles, disent « The commercial use of the Free-package is allowed in the development and, with some limitations, in the production phase. Please contact us for details » : deux textes qui ne disent pas tout à fait la même chose, à confirmer par écrit avant le lancement) | « Powered by Geoapify » en **lien suivi** « near the map or information provided by the service » ; attribution OpenStreetMap toujours ([conditions](https://www.geoapify.com/terms-and-conditions) : « Geoapify attribution is mandatory when using Free subscription plan ») ; clé gratuite | [pricing](https://www.geoapify.com/pricing), [conditions](https://www.geoapify.com/terms-and-conditions) |
| **LocationIQ** (géocodage, secours) | 5 000 req/jour, 2 req/s | Oui, avec lien visible vers locationiq.com *(extrait)* | « Search by LocationIQ.com » ; clé gratuite | [pricing](https://locationiq.com/pricing) |
| **Photon** public | « raisonnable », sinon bridé ou banni | ? (aucune clause commerciale) | User-Agent identifiant ; faible volume | [README](https://github.com/komoot/photon) |
| **Overpass private.coffee** | pas de limite, éviter les requêtes simultanées | Oui *(extrait : « including commercial use »)* | Prévenir l'opérateur avant un usage important | [overpass.private.coffee](https://overpass.private.coffee/) |
| **Valhalla FOSSGIS** | limites de débit non chiffrées | ? (« ouvert au public ») | En-tête `X-Client-Id` et annonce sur GitHub Discussions | [README](https://github.com/valhalla/valhalla) |
| **OpenFreeMap** (vecteur) | aucune limite, sans clé | Oui | « OpenFreeMap © OpenMapTiles Data from OpenStreetMap » ; peut s'arrêter sans préavis | [openfreemap.org](https://openfreemap.org/), [ToS](https://openfreemap.org/tos/) |
| **ArcGIS Location Platform** (relief, satellite) | 2 M tuiles/mois, 1 000 sessions/mois ; s'arrête au-delà sans paiement à l'usage | Oui avec un compte et une clé | « Powered by Esri » + crédits des données ; clé restreinte au domaine | [pricing](https://location.arcgis.com/pricing/), [licence](https://location.arcgis.com/help/licensing-and-attribution/) |
| **MET Norway** (prévision) | 20 req/s pour toute l'application | Oui (CC BY 4.0) | Crédit + lien CC BY ; User-Agent avec domaine et contact (sinon 403) | [ToS](https://api.met.no/doc/TermsOfService) |
| **NASA POWER** (tendance ; normales mensuelles : PRECTOTCORR pour la période, T2M, T2M_MIN, T2M_MAX et PRECTOTCORR pour le kit) | aucune | Oui (« no restrictions ») | Citation demandée | [referencing](https://power.larc.nasa.gov/docs/referencing/) |
| **Meteoalarm** (alertes officielles des services nationaux d'Europe) | flux JSON par pays, aucune fréquence d'appel chiffrée ; l'information doit arriver avec 5 min de retard en moyenne, 10 au plus | Oui, par la CC BY 4.0 (« terms equivalent to the Creative Commons Attribution 4.0 International License (CC BY 4.0), along with the following additional requirements » ; la page ne prononce pas le mot « commercial », c'est la CC BY 4.0 qui le permet) | Nom du service national, heure d'émission, lien meteoalarm.org, avertissement officiel mot pour mot, texte officiel donné avec l'alerte mise en forme | [conditions](https://meteoalarm.org/en/live/page/terms-and-conditions), [Redistribution Hub](https://meteoalarm.org/en/live/page/redistribution-hub) (relues le 10 et le 11 oct. 2026) |
| **Frankfurter** (change) | sans clé ni quota ; 223 devises | Oui (code MIT ; conditions de chaque banque centrale) | BCE : « Source: ECB statistics. » | [frankfurter.dev](https://frankfurter.dev/), [BCE](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html) |
| fawazahmed0 currency-api (secours) | sans limite ; 200+ devises | Oui (CC0) | Aucune ; prévoir l'URL de secours | [dépôt](https://github.com/fawazahmed0/exchange-api) |
| **travelrequirements.info** (papiers) | jeu v1.3.0, 199 destinations × 199 passeports (39 601 lignes, versionnées dans `src/features/compas/data/entryRequirements.json`) | Oui (CC BY 4.0) | Crédit exact donné par l'éditeur, affiché dans les mentions légales : « TravelRequirements.info — Entry Requirements Dataset v1.3.0, AXG Sp. z o.o., https://travelrequirements.info/data/ (CC BY 4.0) » | [data](https://travelrequirements.info/en/data/) |
| **OurAirports** (aéroports) | 86 216 aéroports | Oui (domaine public) | Aucune | [data](https://ourairports.com/data/) |
| **GeoNames** (lieux habités) | cities500 : ≈ 185 000 lieux | Oui (CC BY 4.0) | Lien vers GeoNames | [export](https://www.geonames.org/export/) |
| **OpenStreetMap** (données) | — | Oui (ODbL) | « © OpenStreetMap contributors » + lien ; **une base dérivée servie au public doit rester sous ODbL** | [copyright](https://www.openstreetmap.org/copyright) |
| **Bulletin pétrolier de l'UE** (carburant, UE-27) | hebdomadaire | Oui (CC BY 4.0) | Crédit Commission européenne | [bulletin](https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en) |
| **Supabase** gratuit | 500 Mo (lecture seule au-delà), 5 Go de sortie, 50 000 MAU, pause après 7 jours sans activité, aucune sauvegarde | ? (aucune interdiction trouvée) | Sessions anonymes : **captcha obligatoire** (sinon base remplie) | [pricing](https://supabase.com/pricing), [anonyme](https://supabase.com/docs/guides/auth/auth-anonymous) |
| **hCaptcha** gratuit | plafond non confirmé | ? (aucune interdiction trouvée) | Sous-traitant RGPD (DPA intégré) ; à citer dans la politique de confidentialité. Turnstile exclu (Cloudflare, règle du dépôt) | [pricing](https://www.hcaptcha.com/pricing), [RGPD](https://www.hcaptcha.com/gdpr) |
| **Vercel BotID** basique, pare-feu | BotID basique gratuit ; 1 règle de limite de débit par projet (Hobby) | — (fonctions ; la restriction Hobby reste) | — | [BotID](https://vercel.com/docs/botid), [WAF](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) |
| **Sentry** Developer | 50 000 erreurs/mois, 1 utilisateur | ? (usage interne de son propre site, a priori couvert) | — | [pricing](https://sentry.io/pricing/) |
| **GitHub Actions** (dépôt privé) | 2 000 min/mois, 500 Mo d'artefacts | Oui | Bloqué au-delà sans moyen de paiement | [billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |

## Écartés (interdits en commercial ou payants)

| Service | Raison | Source |
|---|---|---|
| OSRM démo (`router.project-osrm.org`) | « reasonable, non-commercial use-cases » | [Demo server](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server) |
| Nominatim public | trafic régulier d'une application = géocodage en masse, déconseillé ; 1 req/s pour toute l'application | [politique](https://operations.osmfoundation.org/policies/nominatim/) |
| overpass-api.de et miroirs | utilisateurs commerciaux renvoyés vers leurs propres serveurs | [wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) |
| Tuiles OSM (osm.org) et OSM France | « not intended for commercial use » ; OSM France : sites sans but lucratif | [OSMF](https://operations.osmfoundation.org/policies/tiles/), [OSM France](https://www.openstreetmap.fr/usage/) |
| Esri `server.arcgisonline.com` sans clé | usage commercial sur accord écrit | [ToU Esri](https://www.esri.com/en-us/legal/terms/web-site-service) |
| MapTiler, Stadia, GraphHopper (offres gratuites) | non commercial | [MapTiler](https://www.maptiler.com/terms/cloud/), [Stadia](https://stadiamaps.com/terms-of-service/) |
| OpenCage essai | « do NOT run production services on a free trial » | [FAQ](https://opencagedata.com/faq) |
| EOX Sentinel-2 Cloudless 2018-2025 | CC BY-NC-SA | [licence](https://cloudless.eox.at/license-non-commercial) |
| IA : NVIDIA essai, Gemini gratuit, Mistral Experiment, OpenRouter `:free`, Hugging Face, Cerebras | essai/prototypage ; Gemini gratuit interdit pour des utilisateurs de l'EEE et entraîne sur les requêtes ; quotas trop bas | [Gemini](https://ai.google.dev/gemini-api/terms), [NVIDIA](https://docs.api.nvidia.com/nim/docs/product) |
| Groq gratuit | « not for consumer use » dans le contrat de service | [contrat](https://console.groq.com/docs/legal/services-agreement) |
| Cloudflare (Turnstile, Workers AI) | règle du dépôt : aucune plateforme hors Vercel et Capacitor | `CLAUDE.md` |
| Passport Index et ses copies (MIT) | « research purposes only by academia » | [FAQ](https://www.passportindex.org/faq/) |
| Banque mondiale, prix des carburants | arrêté en avril 2025 | [catalogue](https://datacatalog.worldbank.org/search/dataset/0066829/global-fuel-prices-database) |

## Points de vigilance

- **ODbL** : afficher une carte ou un itinéraire tiré d'OSM est une « œuvre produite »
  (attribution seule). Servir au public une **base** de lieux OSM (référentiel, caches)
  impose de la proposer sous ODbL. Le référentiel `geo_places` n'est pas exposé comme
  base ; à garder ainsi, et à noter dans les mentions.
- **Comptes gratuits à créer par Tony** (0 €, aucune carte) : Geoapify, LocationIQ,
  ArcGIS Location Platform, hCaptcha. Les clés se posent dans Vercel par Tony,
  **jamais collées dans la conversation**.
- **Prix du carburant hors UE** : aucune source gratuite, à jour et sous licence claire ;
  le budget l'annonce comme « estimation » (barème versionné, daté).
- **À relire sur les pages officielles** (proxy bloqué pendant la recherche) : conditions
  LocationIQ, private.coffee, Valhalla FOSSGIS, hCaptcha gratuit. (Geoapify, GeoNames, BCE
  et Terrain Tiles relus le 10 puis le 11 oct. 2026 sur les pages officielles ; Meteoalarm
  voir plus bas ; textes dans `DataSources.tsx`, vérifiés mot pour mot par
  `src/app/mentions-legales/__tests__/dataSources.test.tsx`.)
- **« Powered by Geoapify »** : la page tarifaire demande un lien suivi « near the map or
  information provided by the service ». Il s'affiche dans Parcours, sous les étapes dont la
  distance a été mesurée par Geoapify (`distanceSource === 'geoapify'`), et dans les mentions
  légales. Il ne s'affiche PAS près des points « Sur place » (restos, commerces, eau…) : ils
  viennent d'Overpass et du catalogue OpenStreetMap, jamais de Geoapify. Limite connue : quand
  Geoapify est le dernier secours du géocodage ou de la recherche de lieux (Photon, Nominatim
  puis LocationIQ muets), le résultat n'est pas marqué de sa provenance et aucun crédit ne
  s'affiche à côté ; le crédit des mentions légales couvre ce cas rare.

## Meteoalarm (lu le 10 octobre 2026, relu mot pour mot le 11 ; plan 1.8 et 4.9)

Conditions lues sur la page officielle
[Terms and Conditions](https://meteoalarm.org/en/live/page/terms-and-conditions) (« Last
Updated: 15/03/2024 »), § 5 : « All Information on the MeteoAlarm Website may be used and
redistributed under terms equivalent to the Creative Commons Attribution 4.0 International
License (CC BY 4.0), along with the following additional requirements ». **La page ne dit
pas « commercial »** ; l'usage commercial est permis parce que la CC BY 4.0 le permet. Les
« Information » sont les éléments obligatoires du message CAP (nom du service, titre,
description, consignes, heures…) ; tout le reste du site (« Content » : cartes, données
téléchargeables, logiciel) appartient à EUMETNET (§ 4, qui ne mentionne aucune licence pour
des tiers). Exigences du § 5, appliquées dans le code :

| Exigence (§ 5) | Où |
|---|---|
| « If the Information being redistributed is modified in any way, it must be redistributed along with the same Information without any material change or modification » | le texte officiel (titre `headline`, `description`, `instruction`, par langue, nettoyé et borné mais jamais reformulé) accompagne l'alerte : `texts` (`engine/officialAlerts.ts`), `OfficialAlertTexts.tsx`, libellé du signal (`engine/danger.ts`) |
| Un seul pays : « the name of the relevant MeteoAlarm Participant » | `providerLabel` (`engine/meteoalarmFeeds.ts`), noms de la page [Our Warning Providers](https://meteoalarm.org/en/live/page/warning-providers) relus le 11 oct. (test `meteoalarmFeeds.test.ts`) ; jamais l'expéditeur brut du flux (il peut nommer une personne). Plusieurs pays : « EUMETNET – MeteoAlarm » (le Compas ne lit qu'un pays par voyage) |
| « the time of issue » | `sent` (le profil CAP v2.0 : « the date and time of the origination of the alert message »), affiché avec l'alerte, en UTC |
| Un lien vers meteoalarm.org | `METEOALARM_HOME`, sous les signaux du verdict, dans la Veille, dans les Sources et dans les mentions légales |
| Retard moyen < 5 min, jamais > 10 min | cache de 5 minutes par instance, flux lus `no-store`, aucune lecture de plus de 10 minutes ressservie (`server/officialAlerts.ts`) ; **l'heure de lecture du flux est affichée** (« Flux lu le … UTC ») : une page restée ouverte ne se rafraîchit pas |
| Avertissement publié mot pour mot | `METEOALARM_DISCLAIMER`, sous les signaux du verdict, avec sa traduction française |

**Style Guide v1.0 (février 2026)**, publié dans le Redistribution Hub
([PDF](https://gitlab.com/meteoalarm-pm-group/documents/-/raw/master/MeteoAlarm_Style_Guide_v1.0.pdf?inline=true),
lu le 11 oct. 2026). Il se dit « guidelines and good practices », marque pourtant
« MANDATORY » : le niveau et le phénomène dans le titre, le nom du service (`senderName`),
le début et la fin (`onset`, `expires`) « with the applicable time zone abbreviation », la
zone (`areaDesc`), la description et les consignes « displayed exactly as provided », « in
all languages provided in the CAP message ». `<sent>` est « optional ». Le § 1.3 précise que
la redistribution doit en plus respecter les conditions. Le Compas applique ces points : titre
(niveau et phénomène du libellé), service (`Source :`), période de validité en UTC
(« valable du … au … »), zone, texte officiel de chaque langue du message (rubrique « Texte
officiel », qui s'ouvre sous les signaux du verdict et dans la Veille). Les consignes à barres
verticales sont rendues en liste, comme le guide le permet. Limite : le texte est replié par
défaut dans un `<details>` ; pas de logo du service (accès à demander au « Programme
Management »).

Aucune fréquence d'appel n'est chiffrée par Meteoalarm (conditions, « Redistribution Hub » et
page des flux relues le 11 oct. : aucune mention de limite). Le cache de 5 minutes par instance
(au plus 1 appel par pays toutes les 5 minutes **par instance** : sur Vercel chaque instance a
son cache) est donc aussi notre limite. Le Hub parle de « Registered Redistributors » (support
sous 8 h, canal Slack) : **à faire par Tony**, écrire à `meteoalarm@geosphere.at` pour
s'enregistrer comme redistributeur et lui demander si le trafic attendu pose un problème.

**Flux.** `https://feeds.meteoalarm.org/api/v1/warnings/feeds-<pays>` : la liste JSON d'un
pays. **Les pages lues ne décrivent pas cette adresse** : c'est le préfixe que les flux Atom
officiels (`feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-<pays>`, « maintained for
backward compatibility » d'après le [portail API](https://api.meteoalarm.org)) donnent en
lien `application/cap+xml` pour chaque alerte (`…/feeds-<pays>/<uuid>`). Elle répond sans
jeton et contient les alertes du flux Atom **plus l'historique des alertes finies** (relevé le
11 oct. : Allemagne, 131 messages dont 55 dans le flux Atom, les 76 autres finis ou sans heure de
fin ; Suisse : 57 messages tous finis). Si elle change ou ferme, le Compas dit « indisponibles ». Le
Hub précise que les messages `Cancel` ne figurent pas dans les flux (les alertes annulées
disparaissent) ; aucun n'a été relevé le 11 oct. sur les 33 flux (Alert 2 110, Update 1 406,
tous `status` « Actual »). Les messages `status` autre que « Actual » sont ignorés
(profil CAP, § 2.1.4). Le portail propose aussi « MeteoGate » (« the preferred way [...] for the
general public ») et l'API EDR (jeton). Poids relevé le 11 oct. : de 15 octets (flux vide) à 4,9 Mo
(Israël) ; Allemagne 3 Mo, Espagne 1,9 Mo, Suisse 2,2 Mo : au-delà de 2 Mo le cache de données
de Next refuse l'entrée, d'où le cache en mémoire de la réduction du flux.

**Entrée non fiable (contrôle de sécurité du lot U).** Le flux est celui d'un tiers : lecture
bornée à 12 Mo (annoncés par `Content-Length` ou comptés en route), jamais de HTML interprété,
chaque texte nettoyé (caractères de contrôle, marques de direction forcée) et borné (titre 300
signes, description et consigne 2 500 ; relevé du 11 oct. : 189, 1 245, 671), chaque adresse
`web` gardée seulement en https et sans identifiants (738 des 7 778 adresses du 11 oct. étaient
en `http`, 578 absentes : on renvoie alors à meteoalarm.org), nombre de messages, de langues,
de zones et de contours borné (de l'ordre de dix fois le maximum relevé). Un dépassement ou un
message illisible est **compté** : le flux ne prouve plus alors qu'une zone est calme.

**Ce que le Compas ne sait pas lire, dit honnêtement.**
- Le profil CAP rend `expires` obligatoire, mais les bulletins maritimes du DWD (« Amtliche
  Warnung des Seewetterdienstes Hamburg », Helgoland, Ostfriesische Küste…) n'en ont pas le 11
  oct. (5 messages, 40 blocs jaunes sur les 8 356 relevés), et le flux Atom officiel ne les
  reprend pas. Le Compas ne les montre pas non plus, sans les écarter à tort : la zone est dite
  « partielle » ou « non rapprochée », jamais « aucune alerte ».
- Un flux entièrement vide n'est pas pris pour un pays calme (le flux garde l'historique, un flux
  vide ressemble à une panne ; même règle que pour les pays exclus de la table) : « indisponibles ».
- Le `eventCode` « LICENSE » du DWD porte « © GeoBasis-DE / BKG 2021 (Daten modifiziert) »
  (1 048 occurrences, Allemagne seule) : c'est la licence des contours de zones, que le Compas
  n'affiche pas (il ne dessine aucune carte d'alerte) ; à revoir si un jour la zone d'alerte est
  dessinée.

**Ce qui n'est PAS possible sans accord.**
- L'API EDR et l'API Metadata (zones, géométries) demandent un jeton :
  « Organizations and re-users who need direct API access can request a token through our
  registration process » ([API Portal](https://api.meteoalarm.org/edr/v1?f=html)). Rien n'est
  demandé ni inventé ici : à demander par Tony à `meteoalarm@geosphere.at`.
- Le fichier officiel des zones (`MeteoAlarm_Geocodes_2026_07_31.json`, 2 006 régions
  EMMA_ID, 33 Mo, publié dans le Redistribution Hub parmi les « specifications » pour
  les redistributeurs) permettrait de rapprocher n'importe quel point d'un code de zone.
  Les conditions disent que le « Content » (cartes, données téléchargeables) appartient à
  EUMETNET et ne mentionnent aucune licence pour des tiers (§ 4) : **licence du fichier non
  claire, non embarqué**. À confirmer par écrit auprès de Meteoalarm avant tout import.

**Où les zones sont reconnues aujourd'hui** (lecture des 33 flux le 11 oct. 2026) :
- *contours* dans toutes les zones : Andorre, Estonie, Islande, Israël, Norvège, Slovénie,
  Suède, Suisse, Ukraine : le lieu est testé contre les contours, « aucune alerte » est une
  preuve ;
- *noms des départements* : France (vérifié le 1er oct.) ;
- *noms ou codes* ailleurs (Allemagne `Kreis X`, Espagne zones de AEMET, Italie régions,
  Autriche districts…) : le nom exact d'une unité administrative de la carte, sinon « zone
  non rapprochée » (rien n'est affirmé) ; une alerte trouvée par nom est donnée avec la
  réserve « d'autres alertes peuvent exister » ;
- flux vides le 10 oct. (Royaume-Uni, Luxembourg, Malte, Moldavie, Macédoine du Nord,
  Slovaquie) : « non couvert » plutôt qu'un faux « aucune alerte ».

## Alertes officielles hors Europe : sources gratuites recherchées (10 octobre 2026, non branchées)

| Pays | Source | Ce qui a été lu | Verdict |
|---|---|---|---|
| États-Unis | NWS, `api.weather.gov/alerts/active?point=lat,lon` (répond sans clé, testé) | « The information on National Weather Service (NWS) Web pages are in the public domain, unless specifically noted otherwise, and may be used without charge for any lawful purpose so long as you do not: 1) claim it is your own […] 2) use it in a manner that implies an endorsement » ([disclaimer](https://www.weather.gov/disclaimer)) ; « All of the information presented via the API is intended to be open data, free to use for any purpose » ; User-Agent obligatoire, limite de débit non publiée ([API](https://www.weather.gov/documentation/services-web-api)) | **Oui, la plus simple** : à brancher en premier hors Europe |
| Canada | ECCC (alertes CAP) | « a worldwide, royalty-free, perpetual, non-exclusive licence to use the Information, including for commercial purposes » ; pour les alertes : « reproduced in such a way that there is no alteration of the content or intent of the alert » ; attribution « Data Source: Environment and Climate Change Canada » ([licence](https://eccc-msc.github.io/open-data/licence/readme_en/)) | **Oui**, avec attribution et texte non altéré |
| Japon | JMA | « Public Data License (Version 1.0) » ; source à citer (« Source: Japan Meteorological Agency website (URL) »), mention « édité » si modifié ; usage restreint par la loi sur le service météorologique (« Meteorological Service Act ») pour certains contenus ([conditions](https://www.jma.go.jp/jma/en/copyright.html)) | **À confirmer** : lire la licence v1.0 en entier et la loi avant tout branchement |
| Australie | BoM | page de droits d'auteur injoignable depuis le poste de recherche (DNS) | **Non lu** : rien affirmé |
| Autres pays | Registre OMM des autorités d'alerte ([alertingauthority.wmo.int](https://alertingauthority.wmo.int/)) | Il liste, pays par pays, l'autorité et ses flux CAP ; la licence est celle de chaque autorité | À lire pays par pays, au besoin d'un voyage précis |

Aucune de ces sources n'est branchée : chacune a son format, ses zones et ses conditions.
Hors Europe, le Compas dit « pays non couvert par Meteoalarm » (statut `non_couvert`).
