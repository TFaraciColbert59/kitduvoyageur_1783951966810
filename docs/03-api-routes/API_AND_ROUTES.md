# 03 — Inventaire des Routes App Router & API REST

## 1. Pages App Router (`src/app/` — 46 pages actives)

### Cœur Produit & Cartographie
| Route | Description | Auth |
| :--- | :--- | :---: |
| `/` | Accueil / Vitrine & entrée rapide | Public |
| `/explorer` | **Explorer v2** — Carte 3D MapLibre/Three.js, HUD 6 onglets, Route Planner (`?mode=plan`), Tracker GPS & Studio Analyse Avancée | Public / Enrichi connecté |
| `/itineraire` | Redirection vers `/explorer?mode=plan` | Public |
| `/compas` | Compas & préparation de sortie | Public / Connecté |
| `/live/[token]` | Suivi GPS en direct partagé par lien sécurisé | Token |

### Communauté, Carnets, Clubs & Social
| Route | Description | Auth |
| :--- | :--- | :---: |
| `/communaute` | Hub Communauté V2 (fil, création 6 formulaires auto-remplis via `outingHandoff`) | Public / Connecté |
| `/communaute/post/[id]` | Détail d'une publication communautaire | Public |
| `/communaute/reels` | Flux Reels / vidéos outdoor | Public |
| `/carnets/[id]` | Détail d'un carnet de voyage *(le hub `/carnets` redirige en `308` vers `/communaute`)* | Public / Privé |
| `/clubs/[id]` | Espace Club (membres, sorties, fil, carte 3D) | Public / Membre |
| `/sorties/[id]` | Détail d'une sortie collective & propositions d'itinéraires | Public / Membre |
| `/messagerie` | Messagerie directe & conversations de groupe | Connecté |
| `/profil` & `/profil/[id]` | Profil public / personnel, badges, sorties & stats | Connecté / Public |

### Préparation, Hub, Matériel & Boutique
| Route | Description | Auth |
| :--- | :--- | :---: |
| `/hub`, `/hub/[section]`, `/hub/nouveau` | Hub Voyageur (préparation, sacs, voyages, équipements) | Connecté |
| `/kit-studio` | Studio 3D de composition de sac & kits | Public / Connecté |
| `/panier` & `/checkout` | Panier & tunnel de paiement Stripe | Connecté |
| `/apercu/[token]` | Aperçu partagé d'un kit / voyage | Token |

### Compte, Capteurs & Intégrations
| Route | Description | Auth |
| :--- | :--- | :---: |
| `/compte` | Tableau de bord compte, carte personnelle & réglages | Connecté |
| `/compte/activites` | Historique & filtres des activités enregistrées | Connecté |
| `/compte/connecteurs` | Connecteurs externes (Strava, Garmin, etc.) | Connecté |
| `/compte/montres` | Gestion des montres GPS | Connecté |
| `/compte/sensors` | Capteurs BLE (cardio, cadence, puissance) | Connecté |
| `/compte/suivi-en-direct` | Gestion des sessions Live Tracking | Connecté |
| `/connexion`, `/connexion/nouveau-mot-de-passe`, `/inscription` | Authentification Supabase | Public |

### Administration, Légal & Infos
- **Admin** : `/admin`, `/admin/produits`, `/admin/progression`
- **Institutionnel & Légal** : `/manifeste`, `/pro`, `/developpeurs`, `/contact`, `/accessibilite`, `/cgu`, `/cgv`, `/cookies`, `/mentions-legales`, `/politique-confidentialite`
- **Utilitaires internes** : `/carte-interactive`, `/dev/carnet-v2`, `/recette-hub`

---

## 2. API REST (`src/app/api/` — 400+ endpoints)

### Principaux Namespaces

| Namespace | Endpoints | Responsabilité |
| :--- | :---: | :--- |
| `/api/compte/*` | 45 | Profil, préférences, activités, exports, notifications, sécurité |
| `/api/explorer/*` | 42 | POIs 3D, `v2/outdoor-routes` (Waymarked Trails), recherche géo, météo, dangers, relief |
| `/api/clubs/*` | 25 | CRUD clubs, rôles/permissions, événements, participants, invitations |
| `/api/materiel/*` | 18 | Catalogue matériel, inventaire utilisateur, usure, poids |
| `/api/cron/*` | 18 | Tâches planifiées (`/api/cron/daily`, maintenance, syncs — déclenchables via Cloudflare Cron / GitHub Actions) |
| `/api/watches/*` & `/api/connectors/*` | 22 | Sync montres GPS & connecteurs tiers |
| `/api/media-sharing/*` | 13 | Upload, compression & partage sécurisé des médias |
| `/api/planning/*` & `/api/trips/*` | 16 | Planification d'itinéraires, étapes & voyages |
| `/api/live-tracking/*` | 12 | Balises temps réel, positions & tokens de partage |
| `/api/progression/*` & `/api/rankings/*` & `/api/leaderboards/*` | 24 | XP, niveaux, missions, badges, classements |
| `/api/segments/*` & `/api/live-segments/*` | 13 | Détection de segments (`/api/segments/detect`), records |
| `/api/activities/*`, `/api/hikes/*`, `/api/hike-sessions/*` | 15 | Sessions GPS, synchronisation offline, télémétrie |
| `/api/adventure/*` | 9 | Modules aventure, bouteilles à la mer, découvertes |
| `/api/marketplace/*`, `/api/checkout`, `/api/orders`, `/api/stripe` | 12 | E-commerce, commandes, webhooks Stripe |
| `/api/ai-assistant/*` & `/api/ai/*` | 11 | Assistants IA (strictement opt-in pour données santé Art. 9 RGPD) |
| `/api/offline/*` | 6 | Préparation et manifestes de packs offline |
| `/api/carnets/*` & `/api/stories/*` & `/api/highlights/*` | 10 | Carnets de voyage, stories et temps forts |
| `/api/weather`, `/api/elevation`, `/api/geocode`, `/api/pokedex`, `/api/pois` | 5+ | Proxies open-data `0 €` (Open-Meteo, Terrarium DEM, OSM/Overpass) |

---

## 3. Conventions & Sécurité API

1. **Authentification** : Vérification systématique via client Supabase serveur (`createServerClient`) sur toute mutation.
2. **Validation** : Schémas **Zod** sur les payloads entrants.
3. **Cron protégés** : Vérification du header secret (`CRON_SECRET`) sur `/api/cron/*`.
4. **CSP & Reporting** : `/api/csp-report` collecte les violations Content-Security-Policy.
5. **Coût 0 €** : Tous les endpoints géospatiaux utilisent des sources open-data mises en cache (Waymarked Trails, Open-Meteo, Overpass, AWS Terrarium).
