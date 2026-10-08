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
| Routage | OSRM démo, FOSSGIS, Valhalla, BRouter | OSRM démo **Non** (vérifié) ; les autres **?** | Cache → Geoapify Routing → Valhalla FOSSGIS (identifié) → estimation annoncée |
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
