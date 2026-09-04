# LKDV — Plan Maître de Développement

## 🎯 PROMPT DE LANCEMENT — à lire en premier, avant toute action

```
Tu reçois ce document comme plan de travail complet pour le projet LKDV (Le Kit du
Voyageur) : Next.js 15 / React 19 / TypeScript / Supabase (PostgreSQL + PostGIS), déployé,
avec des vrais utilisateurs. Ce n'est pas un projet jouet.

AVANT DE TOUCHER À QUOI QUE CE SOIT :
1. Lis l'intégralité de ce document une première fois, en entier, sans coder — comprends
   l'état réel du projet (section "État réel du projet"), les paliers de faisabilité
   (section "Roadmap"), et la logique globale avant d'exécuter le premier prompt.
2. Utilise tous les skills et outils dont tu disposes pour explorer le repo et la base
   AVANT de modifier quoi que ce soit : lis les fichiers réellement concernés (routes API,
   hooks, composants) plutôt que de supposer leur contenu à partir de ce document — les
   extraits de code cités ici datent de l'audit, le code a pu bouger depuis. Si tu as accès
   à des outils d'inspection de base de données, vérifie l'état réel des tables/RLS avant
   d'appliquer une migration, ne fais jamais confiance aveuglément à un extrait figé dans
   ce texte.
3. Ce plan est séquentiel et volontairement ordonné : PROMPT #1 (sécurité) doit être fait
   et vérifié avant tout le reste, quoi qu'il arrive. Ne saute pas au Prompt #4 parce qu'il
   te semble plus intéressant. Chaque prompt précise ses propres tests de validation à la
   fin du bloc — exécute-les avant de passer au suivant, pas après.
4. Chaque prompt contient parfois une section "PRÉCISION IMPORTANTE" ou une contrainte
   découverte en base juste avant lui (ex : géométries 2D sans altitude, politique
   d'usage des serveurs de tuiles, absence de vraie IA collective) — ce sont des limites
   réelles du projet, pas des suggestions optionnelles. Respecte-les même si une solution
   "plus simple" te vient à l'esprit ; ces contraintes existent pour une raison documentée.
5. Ne fais AUCUNE action irréversible (suppression de données, migration destructive,
   déploiement en production, merge sur main) sans t'arrêter et demander confirmation à
   Tony explicitement. Pour tout le reste, avance en autonomie mais documente ce que tu
   fais au fur et à mesure (crée ou mets à jour un fichier MISSION_LOG.md à la racine avec
   un résumé daté de chaque étape complétée, les décisions prises, et tout ce qui s'est
   écarté du plan initial).
6. Si un des prompts ne correspond plus à l'état réel du code que tu observes (fichier
   déplacé, fonction déjà existante, table déjà créée différemment), signale l'écart dans
   MISSION_LOG.md et adapte-toi intelligemment à ce qui existe réellement plutôt que
   d'appliquer le prompt à la lettre en cassant quelque chose.

Une fois ces points compris, commence par le PROMPT #1 ci-dessous.
```

*Plan basé sur un audit live du 06/08/2026 (Supabase MCP + repo GitHub `main`).*

---


---

## 🔎 État réel du projet (audit live)

### ✅ Corrigé depuis les chantiers d'août-septembre 2026
- **/admin** protégé par middleware + vérification du rôle (`user_profiles.role = 'admin'`)
- **Webhook Stripe** (`/api/stripe/webhook`) écrit correctement les commandes, avec idempotence stricte
- **Refonte mobile & Gestes Apple** : 100% des pages et modals unifiées avec `MobilePageShell`, `PremiumBottomSheet` et les hooks de gestes tactiles
- **RLS verrouillé** sur l'ensemble des tables (e-commerce, communauté, groupes, carnets, et les 7 tables trail)
- **Vues SQL** passées en `SECURITY INVOKER` et `search_path` fixé sur les fonctions PL/pgSQL
- **Table `kit_reports`** créée et fiabilisée
- **Prix recalculés côté serveur** au checkout
- **Lignées de kits (`materiel_kits`) & Épreuve du terrain** implémentées (filiation, immuabilité, score de confiance sans métrique monétaire)
- **Bloqueur N°1 Résolu (ADR-011)** : Le configurateur alimente directement `materiel_kits` et `kit_reports.kit_id`
- **Orientation & Empreinte de Terrain (ADR-010)** : Étanchéité RLS stricte et Sceau FieldSeal déterministe
- **Mode hors-ligne** : Cache vectoriel IndexedDB + tuiles OSM z=14 via `useOfflineDownload` et `offlineStorage`

### ⚠️ Points sous vigilance résiduelle
1. **Réconciliation Stripe Live** : À exécuter via la clé restreinte en mémoire volatile PowerShell (`$env:STRIPE_RESTRICTED_KEY`).
2. **Lot 6 (Attributions/Royalties)** : Maintenu gelé et isolé physiquement dans `supabase/migrations_frozen/`.
3. **Déstockage physique** : Inventaire physique à vérifier avant exécution de `honor_order.sql`.

### 🧱 Fondations GPS déjà présentes (bonne nouvelle pour la suite)
- `useGeolocation.ts` — hook de géolocalisation navigateur
- `useActiveHikeMode.ts` — tracking basique : distance (Haversine), durée, allure, positions, contact d'urgence, persistance `localStorage`
- Base PostGIS : 115 507 segments, 1 173 itinéraires
- Aucun mode hors-ligne réel (le `manifest.json` ne fait que du PWA cosmétique, pas de cache offline)
- Aucune reconnaissance caméra / AR implémentée

---

## 🗺️ Roadmap par paliers de faisabilité

Le document ChatGPT original part de zéro et mélange des features à 2 semaines avec des features à 2 ans. Voici le vrai classement :

### TIER A — Sécurité & dette technique (bloquant, avant tout le reste)
| # | Item |
|---|------|
| 1 | RLS + policies sur les 7 tables trail |
| 2 | Passer les 3 vues en `SECURITY INVOKER` |
| 3 | Fixer `search_path` sur les 4 fonctions |
| 4 | Créer la table `kit_reports` |
| 5 | Recalcul serveur des prix au checkout (source = DB, jamais le client) |
| 6 | Activer la protection mot de passe compromis |

### TIER B — GPS & Navigation cœur (le sujet central du document)
| # | Item | Base existante |
|---|------|---|
| 7 | Écran "Randonnée active" plein écran (carte + stats live : distance/temps/dénivelé/vitesse) | `useActiveHikeMode` + `useGeolocation` |
| 8 | Détection de sortie d'itinéraire (comparaison position ↔ géométrie `trail_segments`) | Base PostGIS |
| 9 | Guidage directionnel simple (texte + vibration, pas de voix au début) | — |
| 10 | Mode hors-ligne basique (cache tracé + tuiles avant départ, IndexedDB/service worker) | — |

### TIER C — Carnet & IA rédactrice (déjà bien avancé)
| # | Item | Base existante |
|---|------|---|
| 11 | Timeline interactive automatique | `carnet_moments` existe déjà |
| 12 | IA rédactrice (3 versions : journal / aventure / sportive) | Configurateur IA déjà en place, même pattern |

### TIER D — Personnalisation IA
| # | Item |
|---|------|
| 13 | Profil sportif appris depuis l'historique réel de randonnées |
| 14 | Assistant préparation voyage (itinéraire/équipement/checklist avant départ) |

### TIER E — Features tierces réalistes (pas d'IA maison)
| # | Item | Comment |
|---|------|---|
| 15 | Reconnaissance plante/animal | API externe (Plant.id ou équivalent), pas de modèle entraîné par toi |
| 16 | "Boussole augmentée" (sommets visibles via caméra) | `DeviceOrientation` API, pas un vrai moteur AR |

### TIER F — Explicitement repoussé, pas un item de dev
- IA collective sur traces anonymisées à grande échelle → nécessite une masse réelle d'utilisateurs, à revisiter après lancement
- Digital Twin des randonnées → conséquence du Tier F, pas buildable indépendamment
- Reconnaissance IA des étoiles, objets connectés, marketplace ML poussée → post-lancement

---

## 🚀 PROMPT #1 — Sécurité (à coller dans Antigravity)

```
Contexte : projet Next.js 15 / React 19 / TypeScript / Supabase (projet lwrmuggefbmboikjgudc, eu-west-3).
Corrige les failles de sécurité suivantes, une par une, en testant après chaque étape.

1) RLS sur les tables trail
Active RLS et ajoute des policies de LECTURE PUBLIQUE (le contenu trail est public par nature)
mais d'ÉCRITURE RESTREINTE (service_role uniquement, aucun insert/update/delete via anon/authenticated) :

ALTER TABLE public.trail_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiking_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trail_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trail_pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trail_route_pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trail_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON public.trail_segments FOR SELECT USING (true);
CREATE POLICY "public_read" ON public.hiking_routes FOR SELECT USING (true);
CREATE POLICY "public_read" ON public.trail_metadata FOR SELECT USING (true);
CREATE POLICY "public_read" ON public.trail_pois FOR SELECT USING (true);
CREATE POLICY "public_read" ON public.trail_route_pois FOR SELECT USING (true);
CREATE POLICY "public_read" ON public.trail_scores FOR SELECT USING (true);
CREATE POLICY "public_read" ON public.spatial_ref_sys FOR SELECT USING (true);

Vérifie ensuite que les routes /api/map/sync, /api/map/sync-trails et /api/map/seed-trails
utilisent bien le client service_role (pas le client anon) pour écrire dans ces tables,
sinon elles vont casser après ce changement.

2) Vues SECURITY DEFINER → SECURITY INVOKER
Recrée ces 3 vues en SECURITY INVOKER (regarde leur définition actuelle avant de les recréer
pour ne rien casser) : featured_hiking_routes, trail_full, explore_trails.

3) search_path sur les fonctions
Ajoute `SET search_path = public, pg_temp` à la définition de :
delete_old_trails, get_nearby_trails, can_view_carnet, is_groupe_member.

4) Table kit_reports manquante
Crée la table kit_reports (colonnes à déduire de ce que /api/kit-report/generate,
/api/kit-report/save et /api/kit-report/convert-inventory essaient d'insérer/lire — inspecte
ces 3 fichiers de route en détail avant de définir le schéma). Ajoute RLS : un utilisateur
ne voit/modifie que ses propres kit_reports (user_id = auth.uid()).

5) Prix côté serveur au checkout
Dans /api/checkout/route.ts, ne fais plus confiance à item.priceEur envoyé par le client.
Pour chaque item reçu, récupère le prix réel depuis la table products ou kits (selon le type
d'item) via le client service_role, recalcule le total côté serveur, et utilise CE prix pour
créer la session Stripe. Si un produit n'existe pas ou n'est pas actif, rejette la requête.

6) Auth
Active "Leaked password protection" dans les paramètres Auth du projet Supabase
(Authentication > Policies > Password Security).

Teste après chaque étape : les pages /carte-interactive, /explorer, /boutique, /checkout
et le configurateur IA (/ai-configurator) doivent continuer à fonctionner normalement.
```

---

---

## ⚠️ Contrainte découverte en base (impacte le Prompt #2)

`trail_segments` et `hiking_routes` ont des géométries **2D uniquement** (`ST_NDims = 2`, pas de Z).
**Aucune donnée d'altitude n'existe dans la base actuelle.** Ça veut dire :
- Le dénivelé positif/négatif ne peut PAS venir du tracé stocké — il doit venir du GPS de l'appareil (`coords.altitude`), qui est bruité et absent sur certains devices.
- Le Prompt #2 ci-dessous gère ça avec un lissage + dégradation propre (pas de fausse donnée affichée).
- Si tu veux un dénivelé fiable plus tard, il faudra soit appeler une API d'altimétrie (l'IGN a une API française précise) pour enrichir les tracés une fois, soit accepter l'imprécision du GPS mobile. Pas urgent — à trancher au Tier B avancé.

---

## 🚀 PROMPT #2 — Écran "Randonnée active" (Tier B, item 7)

```
Contexte : Next.js 15 / React 19 / TypeScript. Deux hooks existent déjà :
- src/hooks/useGeolocation.ts
- src/hooks/useActiveHikeMode.ts (state: distanceKm, durationSeconds, paceMinPerKm,
  positions[], emergencyContact — persisté en localStorage sous 'lkdv_hike_state')

Objectif : construire l'écran "Randonnée active" plein écran décrit ci-dessous, en étendant
useActiveHikeMode plutôt qu'en le remplaçant.

CONTRAINTE IMPORTANTE : trail_segments et hiking_routes ont des géométries PostGIS 2D
uniquement (pas d'altitude stockée). Le dénivelé doit venir de coords.altitude du GPS
de l'appareil, avec ce traitement :
- Ignorer les lectures où coords.altitudeAccuracy est absent ou > 25m
- Lisser avec une moyenne mobile sur les 5 dernières lectures valides pour éviter le bruit
- Cumuler uniquement les deltas positifs significatifs (> 2m) pour le dénivelé+
- Si l'appareil ne fournit jamais d'altitude (fréquent), masquer la carte dénivelé plutôt
  que d'afficher une fausse valeur à 0m ou un placeholder trompeur

ÉTAPE 1 — Étendre useActiveHikeMode
Ajoute au hook :
- Paramètre optionnel routeId au démarrage (startHike(routeId?: string))
- Si routeId fourni : fetch une fois la route depuis hiking_routes (distance_km) et les POIs
  associés via trail_route_pois (jointure trail_pois), triés par distance_m
- Nouveaux champs dans HikeStats : elevationGainM (voir logique de lissage ci-dessus),
  progressPercent (distanceKm parcourue / distance_km de la route si routeId fourni, sinon null),
  nextPoi: { name: string; distanceRemainingM: number } | null (calculé par distance
  euclidienne approx entre la position actuelle et le geom du prochain POI non atteint)

ÉTAPE 2 — Composant écran plein écran
Crée src/app/randonnee-active/page.tsx (utilise MobilePageShell comme les autres pages) :
- Carte plein écran en fond (réutilise le composant carte déjà utilisé dans
  src/app/carte-interactive, ne pas en recréer un nouveau)
- Overlay de stats en bas, format carte comme dans le cahier des charges :
  🥾 distance parcourue / distance totale (ou juste distance si pas de routeId)
  ⏱ durée
  ↑ dénivelé (masqué si pas de donnée fiable, voir contrainte ci-dessus)
  📍 prochain point : nom - distance restante (masqué si pas de routeId)
  🟢 barre de progression (masquée si pas de routeId)
  🔋 estimation batterie restante — utilise navigator.getBattery() si disponible
     (Chrome/Android uniquement, absent sur iOS Safari) ; masque la carte si l'API
     n'est pas supportée, n'affiche jamais une estimation inventée
- Bouton flottant Pause/Reprendre et bouton Stop (avec confirmation avant d'arrêter)
- Au Stop : sauvegarde le résumé de la sortie (les données existent déjà dans HikeStats,
  regarde comment carnet_moments est rempli ailleurs dans le code pour rester cohérent
  avec le modèle de données existant)

Teste sur mobile réel si possible (le GPS émulateur desktop ne donne pas d'altitude réaliste).
```

---

---

## 🚀 PROMPT #3 — Sortie d'itinéraire + guidage directionnel (Tier B, items 8-9)

```
Contexte : Next.js 15 / React 19 / TypeScript / Supabase. L'écran randonnee-active
(src/app/randonnee-active/page.tsx) existe déjà avec useActiveHikeMode étendu
(routeId, elevationGainM, progressPercent, nextPoi).

PRÉCISION IMPORTANTE : pas de moteur de recalcul d'itinéraire (routing) dans ce projet —
"Nouvelle route" dans l'alerte ci-dessous doit rester un bouton qui ferme juste l'alerte
et arrête le suivi de progression, PAS un vrai recalcul d'itinéraire GraphHopper/OSRM.
Ce serait un chantier d'infra séparé, à ne pas improviser ici.

ÉTAPE 1 — Fonction SQL de déviation
Crée cette fonction (SECURITY INVOKER, appelable par anon en lecture seule, cohérente avec
le pattern déjà utilisé par get_nearby_trails) :

CREATE OR REPLACE FUNCTION public.get_route_deviation(
  p_route_id bigint,
  p_lat double precision,
  p_lon double precision
)
RETURNS TABLE(
  distance_m numeric,
  closest_lat double precision,
  closest_lon double precision,
  bearing_deg numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    ST_Distance(h.geom::geography, p.pt::geography) AS distance_m,
    ST_Y(ST_ClosestPoint(h.geom, p.pt)) AS closest_lat,
    ST_X(ST_ClosestPoint(h.geom, p.pt)) AS closest_lon,
    degrees(ST_Azimuth(p.pt, ST_ClosestPoint(h.geom, p.pt))) AS bearing_deg
  FROM public.hiking_routes h,
       LATERAL (SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326) AS pt) p
  WHERE h.id = p_route_id;
$$;

ÉTAPE 2 — Polling côté client
Dans useActiveHikeMode, quand routeId est défini et la randonnée est active (pas en pause) :
- Appelle get_route_deviation via supabase.rpc() toutes les 15 secondes (pas plus souvent,
  pour ménager la batterie)
- Debounce : il faut 2 lectures consécutives avec distance_m > 50 pour déclencher l'alerte
  de sortie de parcours, et 2 lectures consécutives avec distance_m < 30 pour la lever
  automatiquement (évite le flicker sur un tracé sinueux ou un GPS imprécis en forêt)
- Stocke isOffRoute (boolean) et deviationMeters dans le state du hook

ÉTAPE 3 — Alerte de sortie de parcours (reprend le cahier des charges d'origine)
Composant overlay affiché quand isOffRoute === true :
  ⚠️ Vous avez quitté le parcours
  Distance : {deviationMeters} mètres
  [→ Revenir] [→ Nouvelle route] [→ Continuer librement]

- "Revenir" : affiche une flèche pointant vers bearing_deg (utilise DeviceOrientationEvent
  si disponible pour orienter la flèche par rapport au nord réel du téléphone ; sinon
  affiche juste "Dirigez-vous vers le [nord-est/sud/...]" en texte à partir de bearing_deg)
- "Nouvelle route" : ferme l'alerte et désactive le suivi de progression pour le reste de la
  sortie (progressPercent et nextPoi repassent à null) — PAS de recalcul réel, voir précision
  ci-dessus
- "Continuer librement" : ferme l'alerte, garde le tracking actif mais isOffRoute reste
  connu en interne pour ne pas re-déclencher l'alerte pour la même déviation

ÉTAPE 4 — Guidage directionnel simple (item 9)
Quand nextPoi existe et l'utilisateur est sur le parcours (pas isOffRoute) : affiche une
carte discrète "Prochain point : {nextPoi.name} - {distanceRemainingM}m" avec une flèche
orientée vers le POI (même logique DeviceOrientationEvent que ci-dessus). Pas de synthèse
vocale dans cette passe — si tu veux l'ajouter facilement plus tard, l'API Web Speech
(SpeechSynthesis) est native au navigateur, aucune infra à ajouter.

Teste avec un vrai déplacement GPS (marche dehors ou simulation de position dans Chrome
DevTools) — un test statique sur place ne déclenchera jamais la déviation.
```

---

---

## ⚠️ Contrainte découverte dans le code (impacte le Prompt #4)

Le projet utilise **Leaflet** avec des tuiles raster publiques : OpenTopoMap, OpenStreetMap,
et ArcGIS World Imagery (`src/app/carte-interactive/components/InteractiveMap.tsx`).

OSM et OpenTopoMap ont des **politiques d'usage qui interdisent le téléchargement en masse**
de tuiles (pas de boucle qui aspire des centaines de tuiles d'un coup, pas de bulk caching
automatisé). Le Prompt #4 respecte ça : cache **à la demande, limité, avec débit contrôlé** —
c'est un usage raisonnable (un utilisateur qui précharge sa propre randonnée), pas du scraping.
Si l'usage hors-ligne devient un axe fort du produit à grande échelle, il faudra migrer vers
un fournisseur de tuiles payant (MapTiler, Thunderforest) ou un serveur de tuiles auto-hébergé
— à garder en tête, pas à faire maintenant.

---

## 🚀 PROMPT #4 — Mode hors-ligne basique (Tier B, item 10)

```
Contexte : Next.js 15 / React 19 / TypeScript. Carte Leaflet + react-leaflet dans
src/app/carte-interactive/components/InteractiveMap.tsx, tuiles depuis OpenTopoMap/OSM/ArcGIS.
PWA basique existante (public/manifest.json), pas de service worker actif actuellement.

CONTRAINTE : OSM/OpenTopoMap interdisent le téléchargement en masse de tuiles. Le cache doit
être limité à UNE seule bande de zoom (pas multi-zoom), plafonné à 400 tuiles max par
randonnée, avec un débit de max 3 requêtes/seconde pendant le téléchargement.

ÉTAPE 1 — Service worker pour le cache de tuiles
Crée un service worker (public/sw.js ou via next-pwa si déjà présent dans les dépendances,
sinon écris-le à la main) qui :
- Intercepte les requêtes vers les URLs de tuiles (tile.opentopomap.org, tile.openstreetmap.org,
  server.arcgisonline.com)
- Stratégie cache-first pour ces requêtes : sert depuis le Cache API si présent, sinon fetch
  réseau puis stocke
- Utilise un nom de cache par randonnée téléchargée (ex: `lkdv-tiles-route-{routeId}`) pour
  pouvoir purger individuellement plus tard

ÉTAPE 2 — Bouton "Télécharger pour hors-ligne"
Sur la page de détail d'une randonnée (route existante à identifier dans src/app), ajoute un
bouton qui, au clic :
1. Récupère la géométrie de la route (hiking_routes.geom) et calcule sa bounding box
2. Calcule la liste des tuiles z/x/y nécessaires pour UNE SEULE bande de zoom (zoom 14,
   raisonnable pour la randonnée) couvrant cette bbox, avec une marge de ~500m autour du tracé
3. Si le nombre de tuiles dépasse 400, refuse et affiche un message ("randonnée trop longue
   pour le hors-ligne pour le moment, réessaie sur un tronçon plus court")
4. Télécharge les tuiles séquentiellement à un débit max de 3/seconde (setTimeout entre les
   requêtes, pas de Promise.all en parallèle), avec une barre de progression
5. En parallèle, sauvegarde en IndexedDB (utilise idb ou une petite lib équivalente) :
   la géométrie GeoJSON de la route, les POIs associés (trail_pois via trail_route_pois),
   et les métadonnées de base de la route (nom, distance, difficulté)

ÉTAPE 3 — Détection hors-ligne et fallback de données
Dans les hooks qui fetch des données de randonnée (useActiveHikeMode, la page
randonnee-active), détecte navigator.onLine. Si hors-ligne ET qu'une route a des données
en IndexedDB : utilise ces données au lieu d'appeler Supabase. Si hors-ligne SANS données
en cache : affiche clairement "Cette randonnée n'est pas disponible hors-ligne, télécharge-la
avant de partir" plutôt qu'un écran cassé ou un chargement infini.

ÉTAPE 4 — Gestion du stockage
Ajoute une page simple (ou section dans les paramètres) listant les randonnées téléchargées
avec leur taille approximative et un bouton pour les supprimer individuellement (purge le
cache de tuiles nommé + les entrées IndexedDB correspondantes).

Teste en coupant le réseau dans Chrome DevTools (Network > Offline) après un téléchargement
complet, pas juste en simulant.
```

---

---

## ⚠️ Contrainte découverte en base (impacte le Prompt #5)

`carnet_moments` existe déjà (id, carnet_id, jour_numero, heure *(text)*, citation, auteur_nom,
auteur_id, lieu, image_url, created_at) — mais c'est purement pour les entrées **manuelles**
du carnet (section 16 du cahier des charges). **Aucune table ne persiste les sessions de
randonnée terminées** : les stats de `useActiveHikeMode` (distance, durée, dénivelé, POIs
passés) ne vivent qu'en `localStorage` et disparaissent. Pour une vraie "timeline automatique"
(section 18), il faut d'abord stocker la session quelque part en base — c'est le préalable
du Prompt #5.

Autre point : `heure` est un champ **text libre**, pas un timestamp — le tri chronologique
fiable n'est pas garanti si le format n'est pas cohérent. Le prompt ajoute un vrai timestamp
pour les entrées automatiques sans casser l'existant.

---

## 🚀 PROMPT #5 — Timeline interactive automatique (Tier C, item 11)

```
Contexte : Next.js 15 / React 19 / TypeScript / Supabase. Table carnet_moments existante
(entrées manuelles du carnet). Écran randonnee-active (src/app/randonnee-active) avec
useActiveHikeMode qui track distance/durée/dénivelé/POIs mais ne persiste rien en base
actuellement — tout disparaît à la fin de la session (localStorage uniquement).

ÉTAPE 1 — Table hike_sessions
Crée une table pour persister les randonnées terminées :

CREATE TABLE public.hike_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id bigint REFERENCES public.hiking_routes(id),
  carnet_id uuid REFERENCES public.carnets(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  distance_km numeric NOT NULL,
  duration_seconds integer NOT NULL,
  elevation_gain_m numeric,
  positions_geojson jsonb,
  poi_events jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.hike_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sessions" ON public.hike_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

poi_events stocke un tableau [{ poiName, reachedAt, lat, lon }] rempli pendant la randonnée
(voir étape 2).

Ajoute aussi à carnet_moments (sans rien casser de l'existant) :
ALTER TABLE public.carnet_moments ADD COLUMN moment_timestamp timestamptz;
ALTER TABLE public.carnet_moments ADD COLUMN source text DEFAULT 'manuel'
  CHECK (source IN ('manuel', 'auto'));
ALTER TABLE public.carnet_moments ADD COLUMN hike_session_id uuid
  REFERENCES public.hike_sessions(id) ON DELETE SET NULL;

ÉTAPE 2 — Tracker les POIs atteints pendant la randonnée
Dans useActiveHikeMode (déjà étendu aux Prompts #2/#3), ajoute un tableau poiEvents au state.
Quand nextPoi.distanceRemainingM passe sous 30m, enregistre { poiName, reachedAt: now(),
lat, lon } dans poiEvents et passe au POI suivant de la liste.

ÉTAPE 3 — Persister la session au Stop
Modifie l'action Stop de randonnee-active (créée au Prompt #2) : au lieu de juste vider le
localStorage, insère une ligne dans hike_sessions avec toutes les données de la session
(started_at = début du tracking, ended_at = now(), positions simplifiées en GeoJSON
LineString — pas besoin de stocker chaque point brut, simplifie avec un point toutes les
10-15 secondes pour ne pas gonfler la table). Ne vide le localStorage qu'après confirmation
de l'insertion réussie.

ÉTAPE 4 — Génération automatique de moments
Après la sauvegarde de la session, si un carnet_id est fourni (l'utilisateur choisit d'associer
la sortie à un carnet existant ou en crée un rapidement) : génère automatiquement des lignes
carnet_moments avec source='auto', hike_session_id renseigné :
- Un moment "Départ" à started_at avec le lieu (reverse-géocodage optionnel, sinon juste
  les coordonnées)
- Un moment par entrée de poiEvents
- Un moment "Arrivée" à ended_at avec le résumé (distance/durée/dénivelé)

ÉTAPE 5 — Composant Timeline
Sur la page d'un carnet (identifie la route existante des carnets dans src/app), affiche une
frise chronologique verticale qui mélange :
- Les carnet_moments manuels (photos, citations, notes) — icône note/photo
- Les carnet_moments auto générés à l'étape 4 — icône GPS/pin, style visuellement distinct
Tri par moment_timestamp si présent, sinon par jour_numero + ordre d'insertion (created_at)
en fallback pour les anciennes entrées manuelles qui n'ont que le champ heure en texte libre.

Ne fais AUCUNE migration de données rétroactive sur les carnet_moments existants — source
reste à 'manuel' par défaut pour tout ce qui existe déjà, aucune donnée n'est réinterprétée.
```

---

---

## 🔧 Pattern réutilisé pour le Prompt #6

Le configurateur IA existant (`src/app/api/kit-report/generate/route.ts`) donne le pattern
exact à suivre : `getChatCompletion(GEMINI_PROVIDER, GEMINI_DEFAULT_MODEL, messages)` depuis
`@/lib/ai/chatCompletion`, avec un system prompt qui force du JSON strict en sortie. Le
Prompt #6 réutilise ce même pattern plutôt que d'introduire un nouveau provider IA.

---

## 🚀 PROMPT #6 — IA rédactrice (Tier C, item 12)

```
Contexte : Next.js 15 / React 19 / TypeScript / Supabase. Table hike_sessions (créée au
Prompt #5) avec distance_km, duration_seconds, elevation_gain_m, poi_events, started_at,
ended_at, route_id, carnet_id. Pattern IA existant à réutiliser :
getChatCompletion(provider, model, messages) depuis src/lib/ai/chatCompletion.ts
(GEMINI_PROVIDER, GEMINI_DEFAULT_MODEL), regarde src/app/api/kit-report/generate/route.ts
pour le pattern exact d'appel et de parsing JSON.

ÉTAPE 1 — Colonne de stockage
ALTER TABLE public.hike_sessions ADD COLUMN narratives jsonb;
(structure : { "journal": string, "aventure": string, "sportive": string,
generated_at: string })

ÉTAPE 2 — Route API de génération
Crée src/app/api/hike-sessions/[id]/narrative/route.ts (POST) :
- Vérifie que auth.uid() correspond au user_id de la session (403 sinon)
- Récupère la hike_session complète + le nom de la route associée (hiking_routes.name/ref
  si route_id existe) + les carnet_moments manuels liés (photos/notes que l'utilisateur a
  ajoutés pendant la sortie, pour enrichir le contexte)
- Construit un system prompt clair : "Tu rédiges le récit d'une randonnée réelle à partir
  des données fournies. N'invente AUCUN détail non présent dans les données (pas de météo,
  pas d'événements, pas de rencontres non mentionnées) — reste factuel sur la base de ce qui
  est donné, le style change mais pas les faits. Réponds en JSON strict."
- User prompt avec les données concrètes : distance, durée, dénivelé, dates/heures de
  départ-arrivée, liste des POIs traversés avec horaires (depuis poi_events), nom de la
  randonnée, et les notes/citations manuelles si présentes
- Demande les 3 versions dans un seul appel (pas 3 appels séparés, pour limiter le coût
  et la latence) :
  {
    "journal": "récit à la première personne, ton posé, chronologique",
    "aventure": "récit narratif, ton plus vivant, orienté sensations",
    "sportive": "résumé factuel condensé façon fiche de performance (distance/dénivelé/temps
      en avant, phrases courtes)"
  }
- Sauvegarde le résultat dans hike_sessions.narratives, retourne le JSON au client

ÉTAPE 3 — UI
Sur la page de détail d'une hike_session terminée (ou dans le carnet associé) : bouton
"Générer le récit IA" (affiche un état de chargement, l'appel peut prendre plusieurs
secondes). Une fois généré, affiche les 3 versions dans des onglets (Journal / Aventure /
Sportif) avec un bouton pour copier le texte ou l'ajouter comme moment dans le carnet
(nouvelle entrée carnet_moments avec citation = le texte choisi, source = 'auto').

Ne régénère pas automatiquement si narratives existe déjà — ajoute un bouton "Régénérer"
séparé et explicite pour éviter des appels IA inutiles à chaque visite de la page.
```

---

---

## ⚠️ Cadrage honnête pour le Prompt #7

Le cahier des charges original parle d'une "IA qui apprend" le profil sportif. En réalité,
avec le volume de données d'un seul utilisateur (quelques dizaines de sorties dans le
meilleur des cas), il n'y a pas de vrai machine learning à faire — ce serait du sur-apprentissage
sur trop peu de points. Le Prompt #7 fait donc de **l'agrégation statistique honnête**
(moyennes, tendances) sur `hike_sessions`, pas un modèle IA. C'est ce qui a de la valeur
réelle à ce stade, et ça reste la meilleure base si tu veux brancher un vrai modèle plus tard
une fois qu'il y aura beaucoup plus de données par utilisateur.

---

## 🚀 PROMPT #7 — Profil sportif basé sur l'historique réel (Tier D, item 13)

```
Contexte : Next.js 15 / React 19 / TypeScript / Supabase. Table hike_sessions (créée au
Prompt #5) avec distance_km, duration_seconds, elevation_gain_m, route_id, started_at.
hiking_routes a une colonne sac_scale (échelle de difficulté OSM) — vérifie ses valeurs
possibles en base avant de coder le mapping de difficulté (ex: SELECT DISTINCT sac_scale
FROM hiking_routes).

ÉTAPE 1 — Fonction d'agrégation
CREATE OR REPLACE FUNCTION public.get_user_hiking_stats(p_user_id uuid)
RETURNS TABLE(
  total_sessions integer,
  total_distance_km numeric,
  avg_distance_km numeric,
  avg_pace_min_per_km numeric,
  avg_elevation_gain_m numeric,
  favorite_difficulty text,
  most_active_weekday text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    COUNT(*)::integer,
    COALESCE(SUM(hs.distance_km), 0),
    COALESCE(AVG(hs.distance_km), 0),
    COALESCE(AVG(hs.duration_seconds / 60.0 / NULLIF(hs.distance_km, 0)), 0),
    COALESCE(AVG(hs.elevation_gain_m), 0),
    MODE() WITHIN GROUP (ORDER BY hr.sac_scale),
    MODE() WITHIN GROUP (ORDER BY to_char(hs.started_at, 'Day'))
  FROM public.hike_sessions hs
  LEFT JOIN public.hiking_routes hr ON hr.id = hs.route_id
  WHERE hs.user_id = p_user_id;
$$;

ÉTAPE 2 — Seuil minimum
Dans le composant qui affiche le profil : n'affiche RIEN de significatif si total_sessions
< 3 — affiche à la place "Fais quelques randonnées de plus pour débloquer ton profil" plutôt
qu'une moyenne calculée sur 1 seule sortie qui n'a aucun sens statistique.

ÉTAPE 3 — UI "Ton profil randonneur"
Carte sur la page profil utilisateur (identifie la route de profil existante dans src/app),
affichant les stats de get_user_hiking_stats sous forme lisible :
"X randonnées, Y km parcourus, une moyenne de Z km par sortie, plutôt les {favorite_difficulty},
souvent en sortie le {most_active_weekday}"
Pas de jargon technique, formulation naturelle comme dans l'exemple du cahier des charges
("Tu préfères les randonnées de 12 km avec... difficulté moyenne").

Cette fonction sera réutilisée telle quelle comme contexte du Prompt #8 (assistant de
préparation de voyage) — ne pas la dupliquer, juste l'appeler depuis le nouveau endpoint.
```

---

---

## 🐛 Bug de prod découvert (corrigé dans le Prompt #8)

`src/app/api/kit-report/generate/route.ts` interroge une table `gear_items` pour charger
l'inventaire de l'utilisateur connecté — **cette table n'existe pas en base**. Chaque appel
du configurateur IA par un utilisateur connecté échoue silencieusement sur cette requête.
Ce n'est pas une nouvelle feature, c'est un bug actif sur une fonctionnalité déjà en prod.
Le Prompt #8 crée cette table en fondation (elle sert de toute façon à l'assistant de
préparation) — ça corrige le bug existant ET pose la base de la section 14 du cahier des
charges (gestion intelligente du sac).

---

## 🚀 PROMPT #8 — Assistant de préparation de voyage (Tier D, item 14)

```
Contexte : Next.js 15 / React 19 / TypeScript / Supabase. BUG À CORRIGER : la table
gear_items n'existe pas alors que src/app/api/kit-report/generate/route.ts l'interroge
(.from('gear_items').select('id, name, brand, category, weight_g').eq('user_id', user.id)).
Corrige ça en créant la vraie table.

ÉTAPE 1 — Table gear_items (inventaire personnel)
CREATE TABLE public.gear_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  category text,
  weight_g integer,
  condition text DEFAULT 'bon',
  is_packed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gear_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_gear" ON public.gear_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

Vérifie que les colonnes correspondent bien à ce que kit-report/generate/route.ts attend
(id, name, brand, category, weight_g au minimum) — ajuste si besoin en regardant le fichier
en détail. Teste que le configurateur IA fonctionne à nouveau pour un utilisateur connecté
après cette création (c'était cassé avant).

ÉTAPE 2 — UI de gestion d'inventaire
Page simple (ex: src/app/mon-materiel/page.tsx, MobilePageShell comme les autres pages) :
liste des gear_items de l'utilisateur, formulaire d'ajout/édition (nom, marque, catégorie,
poids en grammes, état), suppression, et un toggle is_packed par item.

ÉTAPE 3 — Route API assistant de préparation
Crée src/app/api/trip-assistant/route.ts (POST), qui prend en entrée : destination, dates,
activité, niveau souhaité, poids max cible du sac (maxWeightG). Elle :
1. Appelle get_user_hiking_stats(user_id) (créée au Prompt #7) pour le contexte personnel
2. Récupère les gear_items de l'utilisateur (tout l'inventaire, pas que is_packed=true)
3. Appelle l'IA (même pattern que kit-report/generate : getChatCompletion avec
   GEMINI_PROVIDER/GEMINI_DEFAULT_MODEL) avec un prompt qui croise le profil réel de
   l'utilisateur + son inventaire possédé + les paramètres du voyage, et demande en JSON :
   {
     "checklist": [{ "item": string, "owned": boolean, "gearItemId": string | null,
       "essential": boolean }],
     "missingEssentials": [{ "name": string, "reason": string }],
     "advice": string[]
   }
   Le champ owned/gearItemId doit être déterminé par correspondance avec les gear_items
   réels de l'utilisateur (fait-le côté serveur en JS après la réponse IA en comparant les
   noms, ne fais pas confiance à l'IA pour deviner ce que l'utilisateur possède déjà).
4. Calcule le poids total des gear_items marqués is_packed=true et compare à maxWeightG :
   si dépassement, ajoute un message factuel "Ton sac est X kg trop lourd" dans la réponse
   (calcul réel en JS, PAS généré par l'IA — ne jamais laisser l'IA inventer un chiffre)

ÉTAPE 4 — UI
Formulaire simple (destination/dates/activité/niveau/poids cible) → affiche la checklist
générée avec indication visuelle "déjà dans ton sac" vs "à prévoir" vs "manquant essentiel",
et le message de poids s'il y a dépassement. Pour les items manquants, lien vers /boutique
avec une recherche pré-remplie sur le nom de l'item (pas de matching produit automatique
complexe, un simple lien de recherche suffit pour cette version).
```

---

---

## ⚠️ Cadrage honnête sur ce qui est réellement disponible (impacte le Prompt #9)

J'ai vérifié l'état actuel du marché des API de reconnaissance d'espèces (2026, fournisseur
Kindwise) :
- **Plantes** : `plant.id` — mature, précis, ~0,01 à 0,05 € par identification
- **Insectes/invertébrés** : `insect.id` — 14 000+ taxa, même tarification
- **Mammifères et oiseaux** (l'exemple "Vous observez un chamois" du cahier des charges) :
  **il n'existe pas d'API REST équivalente mature et abordable aujourd'hui.** Le même
  fournisseur (Kindwise) liste ça dans sa roadmap future, pas dans son offre actuelle. Une
  API généraliste type Google Vision donnerait au mieux "animal" ou "chèvre", pas "chamois" —
  ce serait moins précis que l'exemple du doc, donc trompeur si on le présente comme fiable.

Le Prompt #9 couvre donc **plantes et insectes seulement** pour cette version. La reconnaissance
mammifères/oiseaux reste en attente d'une API correcte — à réévaluer plus tard, pas à bricoler
avec un outil qui donnerait de mauvaises réponses présentées comme fiables.

---

## 🚀 PROMPT #9 — Reconnaissance plante/insecte via API externe (Tier E, item 15)

```
Contexte : Next.js 15 / React 19 / TypeScript / Supabase. Table carnet_moments avec un champ
image_url existant. Utilise l'API Kindwise (plant.id pour les plantes, insect.id pour les
insectes) — Tony doit créer un compte sur kindwise.com et générer une clé API pour chaque
produit (clés différentes pour plant.id et insect.id), à ajouter en variables d'environnement
KINDWISE_PLANT_API_KEY et KINDWISE_INSECT_API_KEY (ne jamais committer ces clés).

ÉTAPE 1 — Colonne de stockage
ALTER TABLE public.carnet_moments ADD COLUMN identified_species jsonb;
(structure : { category: 'plante' | 'insecte', name: string, scientificName: string,
confidence: number, identifiedAt: string })

ÉTAPE 2 — Route API de reconnaissance
Crée src/app/api/carnet/identify-species/route.ts (POST), qui reçoit une image (upload direct
ou URL déjà stockée) + un paramètre category ('plante' | 'insecte' — choisi par l'utilisateur
dans l'UI, pas de détection automatique dans cette version). Appelle l'endpoint Kindwise
correspondant (api.plant.id/v3/identification ou api.insect.id équivalent — vérifie la doc
exacte des endpoints sur kindwise.com/handbook avant d'implémenter, le format de payload
peut différer légèrement entre les deux produits). Parse la réponse et retourne : nom commun
en français si disponible, nom scientifique, niveau de confiance.

Gère l'échec proprement : si la confiance est basse (< 30% par exemple) ou si l'API ne
retourne rien de concluant, retourne un statut explicite "non identifié avec certitude" —
n'affiche jamais un résultat à faible confiance comme si c'était fiable.

ÉTAPE 3 — UI
Quand l'utilisateur ajoute une photo à un carnet_moment (composant existant à identifier
dans le carnet), propose un bouton optionnel "Identifier plante" / "Identifier insecte"
(deux boutons séparés, l'utilisateur choisit la catégorie). Affiche le résultat comme un
badge sur la photo (nom + nom scientifique en italique), avec la confiance affichée
seulement si elle est en dessous d'un seuil "à confirmer" (ex: sous 60%, mention discrète
"identification incertaine").

Suis la consommation de crédits Kindwise : logue chaque appel réussi dans une table simple
(api_usage_log ou équivalent léger) pour que Tony puisse surveiller ses coûts avant qu'ils
ne deviennent un problème de facturation.
```

---

---

## 🚀 PROMPT #10 — Boussole augmentée (Tier E, item 16)

```
Contexte : Next.js 15 / React 19 / TypeScript / Supabase. Table trail_pois avec des
catégories 'peak' et 'viewpoint' (colonnes : id, osm_id, category, name, description,
tags jsonb, geom). Le tag OSM 'ele' (altitude) est parfois présent dans tags, pas toujours —
gère l'absence proprement (n'affiche pas d'altitude plutôt qu'une valeur inventée).

PRÉCISION IMPORTANTE : ce n'est PAS un vrai moteur de réalité augmentée (pas de reconnaissance
visuelle du terrain, pas d'occlusion, pas de rendu 3D). C'est une boussole superposée à
l'image caméra : on positionne des étiquettes de sommets/points de vue selon leur cap
(bearing) par rapport à l'orientation du téléphone. La précision dépend de la qualité du
capteur boussole du téléphone (souvent imprécis, sensible aux perturbations magnétiques) —
prévenir l'utilisateur que c'est indicatif, pas millimétré.

ÉTAPE 1 — Fonction SQL de recherche par cap
CREATE OR REPLACE FUNCTION public.get_nearby_named_pois(
  p_lat double precision,
  p_lon double precision,
  p_radius_m integer DEFAULT 15000
)
RETURNS TABLE(
  id bigint,
  name text,
  category text,
  distance_m numeric,
  bearing_deg numeric,
  elevation_m text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    t.id,
    t.name,
    t.category,
    ST_Distance(t.geom::geography, p.pt::geography) AS distance_m,
    degrees(ST_Azimuth(p.pt, t.geom)) AS bearing_deg,
    t.tags->>'ele' AS elevation_m
  FROM public.trail_pois t,
       LATERAL (SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326) AS pt) p
  WHERE t.category IN ('peak', 'viewpoint')
    AND t.name IS NOT NULL
    AND ST_DWithin(t.geom::geography, p.pt::geography, p_radius_m)
  ORDER BY distance_m
  LIMIT 30;
$$;

ÉTAPE 2 — Permissions et capteurs
Sur iOS 13+, DeviceOrientationEvent nécessite un appel explicite à
DeviceOrientationEvent.requestPermission() déclenché par un clic utilisateur (pas au
chargement de la page) — gère cette demande de permission avec un bouton clair "Activer la
boussole" avant d'ouvrir la caméra. Sur Android, ça marche généralement sans demande explicite
mais teste quand même. Si l'appareil ne supporte pas l'API du tout, affiche un message clair
plutôt qu'un écran vide.

ÉTAPE 3 — Composant caméra + overlay
Crée src/app/boussole/page.tsx (MobilePageShell) :
- Ouvre la caméra arrière via getUserMedia (facingMode: 'environment')
- Écoute l'orientation de l'appareil (webkitCompassHeading sur iOS, alpha corrigé sur Android
  — les deux calculs diffèrent, teste sur de vrais appareils des deux OS)
- Appelle get_nearby_named_pois avec la position actuelle
- Pour chaque POI dont le bearing_deg est dans le champ de vue approximatif de la caméra
  (± 30° autour du cap actuel du téléphone, ajustable), affiche une étiquette superposée
  (nom + distance, altitude si disponible) positionnée horizontalement selon l'écart angulaire
- Rafraîchit la position affichée à chaque changement d'orientation significatif (throttle,
  pas à chaque frame, pour ménager la batterie)

Affiche un avertissement discret la première fois : "La précision dépend du capteur boussole
de ton téléphone, les positions sont indicatives."
```

---

## ✅ Récapitulatif — fin de la roadmap réaliste

Les Prompts #1 à #10 couvrent l'intégralité de ce qui est raisonnablement buildable en solo
avec Antigravity sur cette stack : sécurité (Tier A), GPS/navigation cœur (Tier B), carnet
et IA rédactrice (Tier C), personnalisation (Tier D), et intégrations tierces réalistes
(Tier E).

Ce qui reste du document ChatGPT d'origine — IA collective sur traces anonymisées à grande
échelle, Digital Twin des randonnées, reconnaissance mammifères/oiseaux, objets connectés,
marketplace avec ML poussé — **reste explicitement hors scope** tant que le produit n'a pas
une base réelle d'utilisateurs actifs. Ce n'est pas qu'une question de temps de dev : ces
features ont besoin de données à l'échelle pour avoir un sens, pas juste d'un prompt de plus.
Le bon réflexe sera de revenir sur cette section une fois que hike_sessions (créée au
Prompt #5) contient des milliers de sorties réelles, pas dix.

D'ici là : Prompts #1 à #10, dans l'ordre, chacun testé avant de passer au suivant.
