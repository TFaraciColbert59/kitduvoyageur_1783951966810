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
| Papiers par passeport | Règles internes | Jeux « Passport Index » **Non** (recherche académique seulement, même republiés sous MIT) | travelrequirements.info (CC BY 4.0) |

## Services retenus

| Service | Limite gratuite | Commercial | Obligations | Source |
|---|---|---|---|---|
| **Geoapify** (géocodage, lieux, routage) | 3 000 crédits/jour, 5 req/s ; au-delà, pas de facture | Oui *(extrait : « we do not restrict that » ; le tableau dit « Limited Commercial Use »)* | « Powered by Geoapify » avec lien ; clé gratuite | [pricing](https://www.geoapify.com/pricing) |
| **LocationIQ** (géocodage, secours) | 5 000 req/jour, 2 req/s | Oui, avec lien visible vers locationiq.com *(extrait)* | « Search by LocationIQ.com » ; clé gratuite | [pricing](https://locationiq.com/pricing) |
| **Photon** public | « raisonnable », sinon bridé ou banni | ? (aucune clause commerciale) | User-Agent identifiant ; faible volume | [README](https://github.com/komoot/photon) |
| **Overpass private.coffee** | pas de limite, éviter les requêtes simultanées | Oui *(extrait : « including commercial use »)* | Prévenir l'opérateur avant un usage important | [overpass.private.coffee](https://overpass.private.coffee/) |
| **Valhalla FOSSGIS** | limites de débit non chiffrées | ? (« ouvert au public ») | En-tête `X-Client-Id` et annonce sur GitHub Discussions | [README](https://github.com/valhalla/valhalla) |
| **OpenFreeMap** (vecteur) | aucune limite, sans clé | Oui | « OpenFreeMap © OpenMapTiles Data from OpenStreetMap » ; peut s'arrêter sans préavis | [openfreemap.org](https://openfreemap.org/), [ToS](https://openfreemap.org/tos/) |
| **ArcGIS Location Platform** (relief, satellite) | 2 M tuiles/mois, 1 000 sessions/mois ; s'arrête au-delà sans paiement à l'usage | Oui avec un compte et une clé | « Powered by Esri » + crédits des données ; clé restreinte au domaine | [pricing](https://location.arcgis.com/pricing/), [licence](https://location.arcgis.com/help/licensing-and-attribution/) |
| **MET Norway** (prévision) | 20 req/s pour toute l'application | Oui (CC BY 4.0) | Crédit + lien CC BY ; User-Agent avec domaine et contact (sinon 403) | [ToS](https://api.met.no/doc/TermsOfService) |
| **NASA POWER** (tendance) | aucune | Oui (« no restrictions ») | Citation demandée | [referencing](https://power.larc.nasa.gov/docs/referencing/) |
| **Meteoalarm** (alertes officielles des services nationaux d'Europe) | flux JSON par pays, aucune limite d'appels chiffrée ; l'information doit arriver avec 5 min de retard en moyenne, 10 au plus | Oui (« terms equivalent to the Creative Commons Attribution 4.0 », lu le 10 oct. 2026) | Nom du service national, heure d'émission, lien meteoalarm.org, avertissement officiel mot pour mot, texte officiel donné avec l'alerte mise en forme | [conditions](https://meteoalarm.org/en/live/page/terms-and-conditions), [Redistribution Hub](https://meteoalarm.org/en/live/page/redistribution-hub) |
| **Frankfurter** (change) | sans clé ni quota ; 223 devises | Oui (code MIT ; conditions de chaque banque centrale) | BCE : « Source: ECB statistics. » | [frankfurter.dev](https://frankfurter.dev/), [BCE](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html) |
| fawazahmed0 currency-api (secours) | sans limite ; 200+ devises | Oui (CC0) | Aucune ; prévoir l'URL de secours | [dépôt](https://github.com/fawazahmed0/exchange-api) |
| **travelrequirements.info** (papiers) | jeu v1.3.0, 199 destinations | Oui (CC BY 4.0) | Crédit exact donné par l'éditeur | [data](https://travelrequirements.info/en/data/) |
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
  Geoapify, LocationIQ, private.coffee, Valhalla FOSSGIS, hCaptcha gratuit.

## Meteoalarm (relu le 10 octobre 2026, plan 1.8 et 4.9)

Conditions lues sur la page officielle
[Terms and Conditions](https://meteoalarm.org/en/live/page/terms-and-conditions) (mise à
jour du 15/03/2024), § 5 : « All Information on the MeteoAlarm Website may be used and
redistributed under terms equivalent to the Creative Commons Attribution 4.0 International
License (CC BY 4.0), along with the following additional requirements ». L'usage
commercial est donc permis, avec ces exigences, appliquées dans le code :

| Exigence (§ 5) | Où |
|---|---|
| Une alerte modifiée est redonnée avec l'information officielle sans changement | `headline` (texte du service) et `web` (sa page) accompagnent l'alerte (`engine/officialAlerts.ts`, `engine/danger.ts`) |
| Un seul pays : le nom du service national | `providerLabel` (`engine/meteoalarmFeeds.ts`), noms de la page [Our Warning Providers](https://meteoalarm.org/en/live/page/warning-providers) ; jamais l'expéditeur brut du flux (il peut nommer une personne) |
| L'heure d'émission | `sent`, affichée avec l'alerte |
| Un lien vers meteoalarm.org | `METEOALARM_HOME`, sous les signaux du verdict et dans les mentions légales |
| Retard moyen < 5 min, jamais > 10 min | cache de 5 minutes par instance, flux lus `no-store`, aucune lecture de plus de 10 minutes ressservie (`server/officialAlerts.ts`) |
| Avertissement publié mot pour mot | `METEOALARM_DISCLAIMER`, sous les signaux du verdict |

Aucune fréquence d'appel n'est chiffrée par Meteoalarm (« Redistribution Hub »). Le cache
de 5 minutes par instance (au plus 1 appel par pays toutes les 5 minutes par instance) est
donc aussi notre limite.

**Flux.** `https://feeds.meteoalarm.org/api/v1/warnings/feeds-<pays>` : l'adresse que les
flux Atom officiels donnent en lien `application/cap+xml` pour chaque alerte (profil CAP
unique ; les flux Atom `meteoalarm-legacy-atom-*` sont gardés « pour compatibilité »).
Poids relevé le 10 oct. : de 15 octets (flux vide) à 5,3 Mo (Israël) ; Allemagne 3,4 Mo,
Espagne 2,4 Mo, Suisse 2,2 Mo : au-delà de 2 Mo le cache de données de Next refuse
l'entrée, d'où le cache en mémoire de la réduction du flux.

**Ce qui n'est PAS possible sans accord.**
- L'API EDR et l'API Metadata (zones, géométries) demandent un jeton :
  « Organizations and re-users who need direct API access can request a token through our
  registration process » ([API Portal](https://api.meteoalarm.org/edr/v1?f=html)). Rien n'est
  demandé ni inventé ici : à demander par Tony à `meteoalarm@geosphere.at`.
- Le fichier officiel des zones (`MeteoAlarm_Geocodes_2026_07_31.json`, 2 006 régions
  EMMA_ID, 33 Mo, publié dans le Redistribution Hub « pour les redistributeurs ») permettrait
  de rapprocher n'importe quel point d'un code de zone. Les conditions disent que le
  « Content » (cartes, données téléchargeables) appartient à EUMETNET sans accorder de
  licence à un tiers (§ 4) : **licence du fichier non claire, non embarqué**. À confirmer
  par écrit auprès de Meteoalarm avant tout import.

**Où les zones sont reconnues aujourd'hui** (lecture des 39 flux le 10 oct. 2026) :
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
