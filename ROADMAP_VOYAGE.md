# 🧭 ROADMAP VOYAGE — LKDV (Le Kit du Voyageur)

**Document maître du programme « Module Voyage ».**
Source de vérité unique. Tout écart doit être justifié ici avant d'être codé.

- **Stack** : Next.js 15 (App Router) / React 19 / TypeScript strict / Tailwind
- **Backend** : Supabase (PostgreSQL + PostGIS), RLS obligatoire
- **Paiement** : Stripe (server-side, webhooks async)
- **IA** : OpenRouter (modèle gratuit illimité)
- **Cartes** : Leaflet + OSM · **3D** : react-globe.gl
- **Tests** : Vitest/Jest + Playwright (`playwright.config.ts`) + Playwright visual
  (`playwright.visual.config.ts`)

**Suivi d'exécution** : `docs/PROGRESS_VOYAGE.md`
**Historique** : `MISSION_LOG.md` · **Conventions** : `CLAUDE.md`, `DESIGN_SYSTEM.md`, `AGENTS.md`

---

## 0. MODE D'EMPLOI

Un chantier = une branche = une PR = une section dans `PROGRESS_VOYAGE.md`.
Les chantiers s'exécutent **dans l'ordre**. La parallélisation par subagents est
autorisée **à l'intérieur** d'une phase, jamais entre phases, jamais entre chantiers.

Pour chaque chantier, on génère un prompt d'exécution qui contient obligatoirement :
la Phase 0 de chargement, l'état vérifié de l'existant, les phases et sous-phases,
la règle de cochage, les points d'arrêt, les livrables.

**Aucun chantier ne démarre si le précédent n'est pas ✅ ou explicitement ⏸️ documenté.**

---

## 1. INVARIANTS GLOBAUX (vérifiés par lecture du dépôt — ne pas re-débattre)

### 1.1 Conventions techniques confirmées
- FK utilisateur → **`public.user_profiles(id)`**, jamais `auth.users` en direct.
- Table groupes → **`public.travel_groups`** (et non `groupes`).
- Migrations **horodatées** : `YYYYMMDDHHMMSS_nom.sql`, jamais numérotées.
- Migrations **additives et idempotentes** : `create ... if not exists`,
  `create or replace function`, `drop policy if exists` avant `create policy`.
  **Aucun `DROP TABLE`, aucun `DROP COLUMN`, aucune donnée détruite.**
- Fonctions `security definer` **toujours** avec `set search_path = public, pg_temp`,
  puis `revoke all from public` et `grant execute` ciblé.
- Accès base **exclusivement** via service layer `import 'server-only'`.
- Écritures **exclusivement** via Server Actions validées par zod.
- Zéro `any`, zéro `@ts-ignore`, zéro `eslint-disable` nouveau.

### 1.2 Design system
- **Dual-view systématique** : desktop en classes Tailwind, mobile en inline styles
  dans `MobilePageShell`. Coût réel assumé : ~40 % de temps par écran.
- Tokens de `DESIGN_SYSTEM.md`. Vert de marque `#17402C`.
  ⚠️ Ne jamais poser `text-[#17402C]` sur fond `#17402C` (bug constaté dans
  l'ancien `/voyage-ia`).
- `AppImage` avec fallback, `LkvIcon`, `EmptyState`.
- Zones tactiles ≥ 44 px. `dynamic import` pour tout composant lourd.
- `loading.tsx` + `error.tsx` sur chaque route.
- Breakpoints de test : **390 px** et **1440 px**.

### 1.3 Décisions produit gelées
| Sujet | Décision |
|---|---|
| Priorité business | 1. Boutique LKDV · 2. Affiliation Travelpayouts · 3. SEO |
| Accès | 100 % gratuit, aucun paywall |
| Situation initiale | **Cold start** : le seed de données est vital |
| Géographie | Multi-pays dès le schéma ET l'UI |
| Seed initial | FR, NP, PE, IS, MA (simples `country_code`, changeables) |
| Groupes | Réutilisation de `travel_groups`, c'est au groupe de s'adapter |
| Modération | A posteriori, par signalement |
| IA | Illimitée, mais elle **ordonne / argumente / rédige** — elle **n'invente JAMAIS un lieu** |
| Réseau d'affiliation | **Travelpayouts** seul au départ (un contrat, un auto-entrepreneur) |
| Mention d'affiliation | Discrète **mais présente** : `text-xs` gris, au-dessus du bloc, `rel="sponsored nofollow"` |
| Classement | La rémunération n'influence **jamais** l'ordre d'affichage, et c'est écrit dans les CGU |

### 1.4 Contraintes légales non négociables
- **Transparence publicitaire** : art. L121-2 / L121-3 Code de la consommation +
  loi n° 2023-451 du 9 juin 2023. Dissimuler la nature commerciale d'un lien =
  pratique commerciale trompeuse. Statut auto-entrepreneur ⇒ patrimoine personnel exposé.
- **CGU Travelpayouts / Amazon / Booking** : clause de disclosure obligatoire.
  Non-conformité = fermeture de compte et perte des commissions en cours.
- **RGPD** : `trip_documents` (passeports, visas) invisibles même aux `viewer`
  d'un voyage public. Droit à l'effacement effectif (voir bug `deleted_at`, C0).
- **Cookies / CNIL** : consentement préalable à tout tracking tiers (bloquant pour le C5).
- **DSA / P2B** : critères de classement des lieux documentés publiquement.
- **Sécurité des personnes** : les lieux sensibles (bivouacs sauvages, sources,
  sites archéo) doivent pouvoir être floutés (C4).

---

## 2. TABLEAU DE BORD DU PROGRAMME

| # | Chantier | Dépend de | Statut | Branche |
|---|---|---|---|---|
| C0 | Unification messagerie ↔ groupes | — | 🔄 prompt à générer | `feat/c0-messaging-unification` |
| C1 | Fondations entité Trip | C0 (noms de tables) | ✅ prompt livré | `feat/c1-trips-core` |
| C2 | Wizard + moteur de répartition | C1 | ✅ prompt livré | `feat/c2-trip-wizard` |
| C3 | Planificateur d'itinéraire | C2 | ⬜ | `feat/c3-itinerary-planner` |
| C4 | Lieux communautaires | C1 | ⬜ | `feat/c4-community-places` |
| C5 | Affiliation Travelpayouts | C1, C4 | ⬜ | `feat/c5-affiliation` |
| C6 | IA + Kit contextuel (**cœur business**) | C2, C4, C5 | ⬜ | `feat/c6-ai-kit` |
| C7 | Collaboratif, partage, offline, papiers, budget | C1, C0 | ⬜ | `feat/c7-collab-offline` |
| C8 | Boucle de fin : voyage vécu → carnet | C3, C4, C7 | ⬜ | `feat/c8-trip-completion` |
| RF | Recette finale & pré-lancement | tous | ⬜ | `release/voyage-v1` |

---

# CHANTIER 0 — UNIFICATION MESSAGERIE ↔ GROUPES

**Pourquoi en premier** : le C1 dépend du nom réel de `travel_groups` et de la
convention `user_profiles`. Et rétrofitter la confidentialité plus tard coûte 10× plus cher.

### Principe d'architecture : ON NE SYNCHRONISE RIEN
Deux fils qu'on réplique = divergences, doublons, messages perdus garantis.
Le schéma actuel a déjà la bonne réponse : `travel_groups.conversation_id UUID UNIQUE
REFERENCES conversations(id)`. Un groupe **possède** une conversation (1-1).
Une seule ligne `conversations`, une seule table `messages`, **deux surfaces
d'affichage** qui lisent le même `conversation_id`. C'est structurellement le même
objet : rien à synchroniser.

### Bugs constatés par lecture de `20260831000000_messaging_system_canonical.sql`
| ID | Bug | Impact |
|---|---|---|
| B1 | **Aucune policy INSERT sur `conversations`** | Impossible de créer une conversation de groupe aujourd'hui |
| B2 | `last_message_at` : colonne + index mais **aucun trigger** | Tri de la liste des conversations cassé, tout figé à la création |
| B3 | `unread_count` : colonne + CHECK mais **rien ne l'alimente** | Compteurs de non-lus non fonctionnels |
| B4 | `message_mentions` : RLS activé, **zéro policy**, malgré `GRANT SELECT, UPDATE` | Système de mentions inaccessible |
| B5 | `message_attachments` : `GRANT DELETE` **sans policy DELETE** | Suppression de pièce jointe impossible |
| B6 | `members_select_messages` ne filtre pas `deleted_at` | Message « supprimé » lisible par appel API direct → **problème RGPD** |
| B7 | `is_conversation_member` ignore probablement `left_at` | Un ex-membre pourrait lire les messages postérieurs à son départ |

### Phases

**0.0 — Reconnaissance**
- 0.0.1 Phase 0 de chargement (docs + skills + agents), inventaire rapporté.
- 0.0.2 Confirmer le nom exact de la table des membres de groupe
  (`travel_group_members` ?) et de sa **colonne de rôle** + valeurs autorisées.
- 0.0.3 Lire `20260901000000_messaging_security_helpers.sql` : contenu réel de
  `is_conversation_member`, `get_or_create_direct_conversation`.
- 0.0.4 Inventorier les surfaces d'affichage existantes : `src/app/messagerie/`,
  la page groupe, `src/components/groups/`.
- 0.0.5 Reproduire et **documenter** B1→B7 par requête SQL réelle avant correction.
- 0.0.6 Baseline `tsc` / `lint` / `build`. Branche `feat/c0-messaging-unification`.

**0.1 — Migration `<horodatage>_messaging_group_unification.sql`**
- 0.1.1 RPC `get_or_create_group_conversation(p_group_id uuid)` : vérifie
  l'appartenance au groupe, `pg_advisory_xact_lock` anti-course, crée la
  conversation `type='group'`, la lie au groupe, peuple `conversation_members`
  depuis les membres du groupe avec mapping des rôles.
- 0.1.2 Trigger `after insert/update/delete on travel_group_members` →
  propagation vers `conversation_members`. **Sur départ : on renseigne `left_at`,
  on ne supprime pas la ligne** (préservation de l'historique).
- 0.1.3 Durcir `is_conversation_member` : exclure `left_at is not null` (corrige B7).
- 0.1.4 Trigger `bump_conversation_on_message` : met à jour `last_message_at`,
  `updated_at`, et incrémente `unread_count` des autres membres actifs (corrige B2, B3).
- 0.1.5 RPC `mark_conversation_read(p_conversation_id)` : remet `unread_count` à 0,
  pose `last_read_at`.
- 0.1.6 Policies manquantes sur `message_mentions` (corrige B4) et DELETE sur
  `message_attachments` (corrige B5).
- 0.1.7 Filtrer `deleted_at is null` dans `members_select_messages` (corrige B6).
- 0.1.8 Ajouter `trips.conversation_id UUID UNIQUE REFERENCES conversations(id)
  ON DELETE SET NULL` + RPC `get_or_create_trip_conversation(p_trip_id)`.

**0.2 — Règle produit du chat de voyage**
- 0.2.1 Si `trip.group_id` non nul → le chat du voyage **EST** celui du groupe,
  on ne crée rien. Sinon → conversation dédiée créée à la demande.
  *Justification : un club de rando qui organise 3 voyages garde un fil unique
  plutôt que 4 fils morts ; un solo qui invite 2 amis a quand même un fil.*
- 0.2.2 `conversations.type` reste `direct | group`. Ne pas complexifier.

**0.3 — Factorisation front (le vrai lieu de l'unification)**
- 0.3.1 Hook `useConversation(conversationId)` : chargement paginé, envoi optimiste,
  abonnement Realtime sur `messages:conversation_id=eq.X`, reconnexion, marquage lu.
- 0.3.2 Composant unique `<ConversationPanel conversationId variant="page" | "embedded" />`,
  dual-view **à l'intérieur** du composant.
- 0.3.3 `/messagerie` l'utilise en pleine page.
- 0.3.4 La page groupe l'embarque dans un onglet.
- 0.3.5 Aucune logique de chat dupliquée ailleurs. **Test de grep automatisé.**

**0.4 — Tests**
- 0.4.1 Non-régression B1→B7 : un test nommé par bug, prouvant la correction.
- 0.4.2 Un message envoyé depuis la page groupe est lu depuis `/messagerie`
  (même `message.id`) et réciproquement.
- 0.4.3 Concurrence : deux appels simultanés à `get_or_create_group_conversation`
  → une seule conversation créée.
- 0.4.4 Ex-membre : ne lit pas les messages postérieurs à son `left_at`.
- 0.4.5 `unread_count` et `last_message_at` corrects après envoi/lecture.
- 0.4.6 Non-membre : aucun accès (RLS).
- 0.4.7 Playwright e2e sur les deux surfaces, 390 px et 1440 px. Realtime testé.

**0.5 — Clôture** : `tsc` / `lint` / `build` verts · migration rejouée 2× ·
audit `security/` **bloquant** · code review · `verification-before-completion` ·
`MISSION_LOG.md` · PR.

**Points d'arrêt** : nom réel de la table des membres différent · B1→B7 non
reproductibles (schéma divergent de la migration lue) · baseline déjà rouge.

---

# CHANTIER 1 — FONDATIONS DE L'ENTITÉ TRIP
*(prompt détaillé déjà livré — résumé de contrôle)*

9 tables : `trips`, `trip_countries`, `trip_stages`, `trip_days`, `trip_items`,
`trip_kit_items`, `trip_documents`, `trip_budget_lines`, `trip_collaborators`.
RLS complète via `can_read_trip` / `can_edit_trip` (`security definer` pour
**casser la récursion infinie** entre `trips` et `trip_collaborators`).
`trip_documents` en SELECT restreint à `can_edit_trip` — invisible même aux
`viewer` d'un voyage public. RPC `get_trip_by_share_token`. Triggers `geog`
dérivé de lat/lng, `updated_at`. Index GIST sur les deux colonnes `geog`.
Service layer `queries-trips.ts` avec `getTripFull` en **une seule requête**
(select imbriqué). `computeCompleteness` : itinéraire 25 / kit 25 / papiers 20 /
budget 15 / réservations 15. Routes `/voyages` et `/voyages/[slug]` en lecture.

⚠️ **Corrections à appliquer** : `owner_id` et `trip_collaborators.user_id` →
`user_profiles(id)` · `group_id` → `travel_groups(id)` · migration horodatée.

---

# CHANTIER 2 — WIZARD + MOTEUR DE RÉPARTITION
*(prompt détaillé déjà livré — résumé de contrôle)*

**Règle structurante : ZÉRO appel LLM.** Un moteur non déterministe est
intestable : on ne pourrait jamais prouver que « 14 jours sur 3 pays » donne
bien 14 jours. L'IA arrive au C6 **par-dessus** ce socle.

`src/features/trips/engine/` en fonctions pures : `allocateDays` (plus grand
reste, plancher 2 jours/pays, invariant `somme === durée`), `travelTime`
(Haversine, barèmes par mode, item `transport` si > 90 min), `paceRules`
(chill/standard/intense), `seasonality` (table de règles en données),
`buildItinerary`, `selectCandidates` (**ne renvoie que des `ref_id` réels**).
Wizard 5 étapes, état en URL, brouillon `localStorage` + `draft` en base dès
l'étape 3, Server Action transactionnelle. Régénération préservant
`source='user'`. Seed idempotent des 5 pays. `/voyage-ia` supprimé → 308 vers
`/voyages/nouveau`. **`/preparation` et `PreparationCockpit` : NE PAS TOUCHER**
(actif réel, réutilisé au C6).

⚠️ **Point de rupture** : compter les lignes réelles de `hiking_routes` et des
tables de POI en phase 2.0.3. Base vide = wizard creux.

---

# CHANTIER 3 — PLANIFICATEUR D'ITINÉRAIRE

**Objectif** : passer de la lecture à l'édition. C'est l'écran où l'utilisateur
passe le plus de temps, donc l'écran qui décide de la rétention.

### Phase 3.0 — Reconnaissance
- 3.0.1 Chargement (docs + skills + agents : `programming`, `design`, `data-ai`).
- 3.0.2 Lire le moteur C2 : le planificateur doit pouvoir **recalculer
  partiellement** (déplacer un item recalcule le temps de trajet du jour).
- 3.0.3 Relever la dette et les ⏸️ du C2 dans `PROGRESS_VOYAGE.md`.
- 3.0.4 Baseline `tsc` / `lint` / `build`. Branche `feat/c3-itinerary-planner`.

### Phase 3.1 — Modèle d'ordonnancement
- 3.1.1 Stratégie de `order_index` : **espacement par 1000** (1000, 2000, 3000)
  pour insérer entre deux items sans réécrire toute la liste.
- 3.1.2 Fonction de rééquilibrage quand deux `order_index` deviennent adjacents.
- 3.1.3 RPC `reorder_trip_items(p_day_id, p_ordered_ids uuid[])` **transactionnel**
  et idempotent, avec vérification `can_edit_trip`.
- 3.1.4 RPC `move_trip_item(p_item_id, p_target_day_id, p_position int)` :
  déplacement inter-jours + recalcul du `stage_id` implicite.
- 3.1.5 Verrou anti-conflit : `updated_at` envoyé par le client, rejet si
  obsolète (optimistic concurrency). Message clair, pas d'écrasement silencieux.

### Phase 3.2 — `/voyages/[slug]/itineraire` desktop
- 3.2.1 Layout 3 colonnes : liste des jours · détail du jour · carte contextuelle.
- 3.2.2 Réordonnancement par **boutons monter/descendre d'abord** (accessible,
  testable, fonctionne au clavier).
- 3.2.3 Drag & drop **ensuite**, en surcouche, avec les boutons conservés comme
  chemin de repli. Annonces ARIA live.
- 3.2.4 Déplacement d'un item vers un autre jour (menu + DnD).
- 3.2.5 Édition inline : titre, durée, prix, `booking_status`, notes.
- 3.2.6 Ajout d'item : recherche dans `hiking_routes`, refuges, POI (et `places`
  dès le C4), plus item libre.
- 3.2.7 Duplication de jour, insertion de jour, suppression de jour avec
  **renumérotation `day_index` sans trou** (contrainte UNIQUE à respecter).
- 3.2.8 Indicateurs par jour : temps de trajet cumulé, dénivelé cumulé,
  alerte de surcharge selon `paceRules`.
- 3.2.9 Undo de la dernière action destructive (30 s), sinon confirmation.

### Phase 3.3 — Version mobile
- 3.3.1 `MobilePageShell`, un jour par écran, carrousel horizontal entre jours.
- 3.3.2 Bottom sheet d'ajout et d'édition d'item.
- 3.3.3 Réordonnancement mobile : **poignées + boutons**, pas de DnD tactile
  au premier jet (coût élevé, fiabilité faible). DnD tactile = sous-phase
  optionnelle, seulement si 3.3.1→3.3.2 sont ✅.
- 3.3.4 Sauvegarde optimiste avec état visible (`saving` / `saved` / `erreur`).

### Phase 3.4 — `/voyages/[slug]/carte`
- 3.4.1 Leaflet + OSM, chargé en `dynamic import` (`ssr: false`).
- 3.4.2 Multi-pays : `fitBounds` sur l'ensemble, clustering par étape.
- 3.4.3 Marqueurs typés par `kind`, tracés reliant les items d'un même jour,
  couleur par jour.
- 3.4.4 Sélection croisée carte ↔ liste (clic marqueur = surlignage item).
- 3.4.5 Affichage des tracés GPX des randos référencées.
- 3.4.6 Performance : > 300 marqueurs → clustering obligatoire, pas de re-render
  complet à chaque interaction.

### Phase 3.5 — Tests
- 3.5.1 `order_index` : insertion entre deux items, rééquilibrage, 100 insertions
  successives sans collision.
- 3.5.2 `reorder_trip_items` idempotent, transactionnel, refusé pour un non-éditeur.
- 3.5.3 Déplacement inter-jours : `day_id` et `stage_id` cohérents après coup.
- 3.5.4 Suppression/insertion de jour : `day_index` de 1..N sans trou, contrainte
  UNIQUE jamais violée.
- 3.5.5 Concurrence : deux éditeurs simultanés → le second reçoit un conflit
  explicite, aucune perte de donnée.
- 3.5.6 RLS : `viewer` ne réordonne pas, `editor` oui, non-membre rien.
  **Rejouer la suite RLS complète C1.**
- 3.5.7 Playwright : réordonnancement par boutons, puis par DnD, puis déplacement
  inter-jours, en 390 px et 1440 px.
- 3.5.8 Playwright a11y : parcours complet du planificateur **au clavier seul**.
- 3.5.9 Playwright visual : planificateur et carte, deux largeurs.
- 3.5.10 Perf : itinéraire de 30 jours × 5 items → interaction < 100 ms.

### Phase 3.6 — Clôture
`tsc` / `lint` / `build` · audit `security/` sur les 2 nouveaux RPC · code review ·
`verification-before-completion` · `MISSION_LOG.md` · PR.

**Points d'arrêt** : impossibilité de garantir `day_index` sans trou sans changer
le schéma · DnD non fiabilisable en mobile (alors on l'abandonne officiellement
et on le note en dette, on ne livre pas un DnD cassé).

---

# CHANTIER 4 — LIEUX COMMUNAUTAIRES

**Objectif** : construire le seul actif que Booking et TripAdvisor n'ont pas —
des lieux qualifiés par des gens qui y sont réellement allés.
**C'est un chantier de contenu autant que de code.**

### Phase 4.0 — Reconnaissance
- 4.0.1 Chargement (agents `data-ai`, `product-policy`, `security`, `design`).
- 4.0.2 Inventaire des tables de lieux/POI/refuges **déjà existantes**. Décision
  explicite : étendre l'existant ou créer `places` ? Justifier par écrit.
- 4.0.3 Lire le système de gamification et de badges existant : `contributor_trust`
  s'y branche, **une seule source de vérité**.
- 4.0.4 Vérifier la faisabilité Overpass/OSM : quotas, licence ODbL, attribution.
- 4.0.5 Baseline. Branche `feat/c4-community-places`.

### Phase 4.1 — Schéma
- 4.1.1 `places` : id, kind, name, slug unique, country_code, `geog(Point,4326)`,
  altitude_m, osm_id, source (`osm|editorial|user`), `verified_by_admin`,
  `sensitivity` (`public|blurred|restricted`), description, best_season,
  access_notes, created_by, created_at, updated_at.
- 4.1.2 `place_contributions` : place_id, user_id, type (`photo|tip|warning|price|access`),
  body, media_url, season, `status` (`visible|flagged|hidden`), created_at.
- 4.1.3 `place_votes` : (place_id, user_id) PK composite, value ∈ {-1, 1}, created_at.
- 4.1.4 `place_reports` : signalements (a posteriori), motif, statut de traitement.
- 4.1.5 `place_scores` : place_id, wilson_score, votes_30d, saves, completions_90d,
  freshness, contributor_trust, final_score, refreshed_at.
- 4.1.6 Index : GIST sur `geog`, (country_code, final_score desc), slug,
  partiel sur `sensitivity <> 'public'`.
- 4.1.7 `trip_items.ref_type='place'` devient exploitable (colonne déjà prévue au C1).

### Phase 4.2 — Scoring
- 4.2.1 Formule **gelée** :
  `final = 0.45×wilson(votes) + 0.30×log(1+completions_90d) + 0.15×freshness + 0.10×contributor_trust`
  *Justification : la moyenne d'étoiles est massivement biaisée à faible volume ;
  Wilson corrige, et la preuve d'usage rend le farming coûteux.*
- 4.2.2 `completions_90d` = sessions de rando terminées à proximité, via
  `ST_DWithin` sur `hike_sessions`. **Preuve d'usage réelle, pas déclarative.**
- 4.2.3 `contributor_trust` dérivé de la gamification existante.
- 4.2.4 Vue matérialisée + rafraîchissement horaire (`pg_cron` ou route planifiée).
  Fallback : score en lecture directe si la vue est périmée.
- 4.2.5 Anti-abus : 1 vote par user et par lieu (PK composite) · poids nul pour
  les comptes < 7 jours · auto-flag si > 5 votes d'une même IP sur un lieu en 24 h.
- 4.2.6 Classement **par pays et par activité**. Jamais de classement mondial unique.
- 4.2.7 **Documenter publiquement** les critères de classement (obligation DSA/P2B)
  et affirmer que la rémunération n'y entre pas.

### Phase 4.3 — Lieux sensibles (éthique + sécurité)
- 4.3.1 `sensitivity='blurred'` → coordonnées arrondies à ~500 m côté **serveur**,
  jamais les vraies coordonnées envoyées au client.
- 4.3.2 `sensitivity='restricted'` → visible uniquement à son créateur et à ses
  collaborateurs de voyage.
- 4.3.3 Un contributeur peut demander le floutage d'un lieu qu'il a créé.
- 4.3.4 Vue publique dédiée exposant **uniquement** les coordonnées autorisées.
  Test prouvant qu'aucune fuite n'est possible par l'API.

### Phase 4.4 — Import & seed éditorial
- 4.4.1 Script d'import Overpass par pays et par `kind`, idempotent (upsert sur `osm_id`).
- 4.4.2 **Attribution ODbL** affichée (obligation de licence OSM).
- 4.4.3 Dédoublonnage géographique : deux lieux à < 50 m avec noms proches →
  file de fusion manuelle, pas de fusion automatique.
- 4.4.4 Socle éditorial rédigé sur les 5 pays. Objectif chiffré : **≥ 40 lieux
  qualifiés par pays**. En dessous, le C6 n'aura rien à recommander.
- 4.4.5 Tableau des volumes réels par pays et par `kind` dans `PROGRESS_VOYAGE.md`.

### Phase 4.5 — UI
- 4.5.1 `/lieux/[slug]` : fiche SEO complète (metadata, JSON-LD `TouristAttraction`,
  OG image), contributions, photos, votes, bouton « ajouter à un voyage ».
- 4.5.2 `/lieux` : exploration filtrée par pays, kind, saison, score.
- 4.5.3 Formulaire de contribution : tout compte > 7 jours, publication immédiate
  mais **score nul jusqu'à 3 votes**.
- 4.5.4 Signalement en un clic (modération a posteriori assumée).
- 4.5.5 File de modération dans `/admin` : signalements, fusions, vérifications.
- 4.5.6 Upload photo : Supabase Storage, licence non exclusive dans les CGU,
  limite de taille, validation de type MIME **côté serveur**.
- 4.5.7 Intégration dans le planificateur C3 (recherche de lieux) et la carte.
- 4.5.8 `sitemap.ts` étendu aux pages lieux.
- 4.5.9 Dual-view desktop/mobile.

### Phase 4.6 — Tests
- 4.6.1 Wilson : valeurs de référence connues, cas 0 vote, cas 1 vote négatif.
- 4.6.2 Invariance : un lieu à 2 votes ne dépasse pas un lieu à 200 votes de
  même ratio.
- 4.6.3 Anti-abus : second vote du même user rejeté · compte neuf de poids nul ·
  auto-flag IP déclenché.
- 4.6.4 Floutage : coordonnées exactes **jamais** dans la réponse API pour
  `blurred` · `restricted` invisible aux tiers. Test d'intrusion explicite.
- 4.6.5 Import idempotent : rejoué 2× → aucun doublon.
- 4.6.6 `completions_90d` : `ST_DWithin` correct, une session hors rayon
  n'incrémente pas.
- 4.6.7 RLS : contribution modifiable par son auteur seul, lecture publique
  des `visible` uniquement.
- 4.6.8 Playwright : contribution, vote, signalement, ajout à un voyage.
- 4.6.9 Playwright visual + a11y. SEO : metadata et JSON-LD validés.

### Phase 4.7 — Clôture
Standard + audit `security/` **renforcé** sur le floutage (enjeu de sécurité
physique des personnes).

**Points d'arrêt** : Overpass inexploitable (quotas/licence) · < 40 lieux par pays
atteignables dans le temps imparti → arbitrer : réduire à 3 pays plutôt que
livrer 5 pays vides.

---

# CHANTIER 5 — AFFILIATION TRAVELPAYOUTS

**Règle d'or** : jamais une URL affiliée en dur dans un composant. Sinon on ne
peut ni changer de partenaire, ni mesurer, ni rester conforme.

### Phase 5.0 — Reconnaissance
- 5.0.1 Chargement (agents `business`, `security`, `product-policy`, `platform-operations`).
- 5.0.2 **Vérifier que le compte Travelpayouts est validé** et relever les
  identifiants réels (marker, sous-ID, formats de deeplink par produit).
- 5.0.3 **Vérifier qu'un CMP conforme CNIL existe et fonctionne.** Sans consentement
  préalable, aucun tracking tiers n'est légal. **Bloquant.**
- 5.0.4 Relire les CGU Travelpayouts : obligations de disclosure, interdictions
  (pas de bid sur marque, pas de cashback non déclaré, etc.).
- 5.0.5 Baseline. Branche `feat/c5-affiliation`.

### Phase 5.1 — Schéma
- 5.1.1 `affiliate_partners` : slug, name, network, base_url, commission_model,
  default_rate, cookie_days, `deeplink_template`, is_active, geo_allowlist,
  `requires_consent` bool.
- 5.1.2 `affiliate_links` : partner_id, slug unique, target_url, campaign,
  context_type, context_id, params jsonb.
- 5.1.3 `affiliate_clicks` : link_id, user_id (nullable), trip_id, `session_hash`
  (**haché, pas d'IP en clair** — minimisation RGPD), country, device, referrer,
  clicked_at.
- 5.1.4 `affiliate_conversions` : link_id, click_id, external_order_id **unique**,
  amount_cents, commission_cents, status (`pending|approved|rejected`),
  currency, postback_at, raw_payload jsonb.
- 5.1.5 `trip_items.affiliate_link_id` → FK activée (colonne posée nue au C1).
- 5.1.6 RLS : tables d'affiliation **inaccessibles** au rôle client.
  Lecture admin uniquement. Écriture par service role / RPC signé.
- 5.1.7 Rétention : purge automatique des clics > 13 mois (durée CNIL usuelle).

### Phase 5.2 — Deeplink & redirecteur
- 5.2.1 `src/lib/affiliate/deeplink.ts` (**server-only**) : injecte le contexte
  dans `deeplink_template`. Aucun identifiant partenaire ne doit apparaître
  dans le HTML rendu. Test de grep prouvant l'absence du marker côté client.
- 5.2.2 `label` / sous-ID encodant `trip_{id}_{kind}` pour l'attribution par voyage.
- 5.2.3 Route `/go/[slug]` : insert du clic → `redirect(302)`. Jamais de 200 HTML.
- 5.2.4 Robustesse : slug inconnu → 404 · partenaire inactif → redirection vers
  la page de recherche interne, jamais d'erreur brute · échec d'insert → on
  redirige quand même (le clic perdu vaut mieux que l'utilisateur bloqué).
- 5.2.5 `rel="sponsored nofollow"` + `target="_blank"` + `referrerpolicy` sur
  tous les liens sortants. Exclusion de `/go/*` dans `robots.ts`.
- 5.2.6 Respect du consentement : si `requires_consent` et consentement refusé →
  lien direct **sans tracking**, pas de blocage de l'utilisateur.

### Phase 5.3 — Postback
- 5.3.1 Endpoint `POST /api/affiliate/postback/[partner]` : **signature vérifiée**
  (HMAC ou secret partagé selon le format Travelpayouts), rejet 401 sinon.
- 5.3.2 Idempotence sur `external_order_id` unique : un postback rejoué ne crée
  pas de doublon.
- 5.3.3 Validation zod du payload, stockage du `raw_payload` pour audit.
- 5.3.4 Rate limiting et journalisation des tentatives invalides.
- 5.3.5 Import CSV de secours dans `/admin` (les dashboards restent la source
  de vérité comptable au début — décision actée : **les deux**).
- 5.3.6 Réconciliation : rapport des écarts entre clics attribués et conversions.

### Phase 5.4 — UI & conformité
- 5.4.1 `<AffiliateDisclosure />` : une ligne `text-xs` gris, **au-dessus** du
  bloc, non repliable, texte type « Liens partenaires — nous touchons une
  commission, sans surcoût pour toi. » **Discret, jamais caché.**
- 5.4.2 Blocs de réservation dans `/voyages/[slug]/reservations` : hébergement,
  transport, voiture, assurance, eSIM, activités.
- 5.4.3 **L'ordre d'affichage ne dépend jamais de la rémunération.** Critère de
  tri affiché à l'utilisateur.
- 5.4.4 Page CGU/mentions : modèle économique, critères de classement (DSA/P2B),
  statut auto-entrepreneur.
- 5.4.5 Dashboard `/admin/revenus` : clics, conversions, taux, revenus par
  partenaire et par voyage, écarts de réconciliation.
- 5.4.6 Dual-view.

### Phase 5.5 — Tests
- 5.5.1 Deeplink : template correctement interpolé pour chaque produit,
  échappement des paramètres, aucun marker en clair côté client.
- 5.5.2 `/go/[slug]` : 302 émis, clic inséré, `session_hash` haché et non
  réversible, aucune IP stockée en clair.
- 5.5.3 Postback : signature valide acceptée · signature invalide rejetée 401 ·
  rejeu idempotent · payload malformé rejeté proprement.
- 5.5.4 Consentement refusé → aucun cookie tiers, aucun tracking, lien
  fonctionnel malgré tout.
- 5.5.5 RLS : un utilisateur authentifié ne lit **aucune** table d'affiliation.
- 5.5.6 Présence du disclosure sur **100 %** des surfaces contenant un lien
  affilié. Test automatisé qui échoue si un lien `/go/` apparaît sans disclosure
  dans le même arbre de rendu. **C'est le garde-fou juridique.**
- 5.5.7 `rel="sponsored nofollow"` présent sur tous les sortants.
- 5.5.8 Purge de rétention à 13 mois fonctionnelle.
- 5.5.9 Playwright + visual.

### Phase 5.6 — Clôture
Standard + audit `security/` sur le postback et audit `product-policy` sur la
conformité DGCCRF. **Les deux bloquants.**

**Points d'arrêt** : compte Travelpayouts non validé · CMP absent (on ne livre
pas de tracking sans consentement) · format de postback non documenté par le
partenaire → on livre en mode CSV seul et on note la dette.

---

# CHANTIER 6 — IA + KIT CONTEXTUEL (CŒUR DU BUSINESS)

**C'est le chantier qui rapporte.** Tout le reste sert à amener l'utilisateur ici.

### Phase 6.0 — Reconnaissance
- 6.0.1 Chargement (agents `business`, `data-ai`, `programming`, `product-policy`).
- 6.0.2 Lire `@/features/preparation` (`PreparationCockpit`) : participants, poids,
  audit du sac. **On réutilise, on ne réécrit pas.**
- 6.0.3 Lire l'inventaire utilisateur existant, le catalogue produits, `/location`,
  `/occasion`, `/kits`.
- 6.0.4 Lire `src/lib/ai/chatCompletion.ts` : signature, gestion d'erreur, modèle.
- 6.0.5 Baseline. Branche `feat/c6-ai-kit`.

### Phase 6.1 — Moteur de kit (déterministe d'abord)
- 6.1.1 Table de règles `kit_requirements` : conditions (country, saison, altitude
  max, `trip_style`, durée, `kind` d'items présents) → catégories requises,
  criticité, poids indicatif. **Données, pas code.**
- 6.1.2 `computeRequiredKit(trip)` — fonction pure : dérive les besoins depuis
  l'itinéraire réel (altitude des étapes, saison, présence de bivouac, etc.).
- 6.1.3 `diffKit(required, userInventory)` → manquant / possédé / à remplacer.
- 6.1.4 Peuplement de `trip_kit_items` avec `source='template'`, sans écraser
  les lignes `source='user'`.
- 6.1.5 Bilan de poids par personne, réparti sur les participants du groupe,
  réutilisant la logique du `PreparationCockpit`.
- 6.1.6 Alertes : essentiel manquant, surpoids, matériel inadapté à la saison.

### Phase 6.2 — Cascade de conversion (ordre impératif)
- 6.2.1 **1. Boutique LKDV** (marge pleine, Stripe existant) — mise en avant
  prioritaire quand le produit existe au catalogue.
- 6.2.2 **2. Location** (`/location`) — pour le matériel cher et peu utilisé.
- 6.2.3 **3. Occasion** (`/occasion`) — pour le budget serré.
- 6.2.4 **4. Emprunt communautaire** — si la fonctionnalité de prêt existe.
- 6.2.5 **5. Affiliation** — **en dernier recours uniquement**, pour ce que tu ne
  vends pas.
- 6.2.6 Règle anti-biais explicite et testée : **« besoin d'abord, produit ensuite »**.
  Les alternatives location/occasion sont **toujours** affichées à côté de l'achat.
  Un besoin sans produit correspondant s'affiche quand même comme besoin.
- 6.2.7 Ajout au panier en un clic de tout le kit manquant.
- 6.2.8 Disclosure C5 présent dès qu'un lien affilié apparaît.

### Phase 6.3 — Couche IA
- 6.3.1 Contrainte absolue : **l'IA n'invente JAMAIS un lieu, un produit ou un
  prix.** Elle reçoit un contexte issu de la base et le met en forme. Toute
  sortie est validée par zod contre les IDs réellement existants ; un ID
  inconnu = sortie rejetée, fallback déterministe.
- 6.3.2 Cas d'usage IA : argumentaire de kit, reformulation d'itinéraire,
  conseils de saison, résumé de voyage, copilote conversationnel.
- 6.3.3 Cache en base sur `(country, duration, style, season, hash_context)` —
  réutilisable entre utilisateurs. Même en illimité, le cache divise la latence.
- 6.3.4 **Fallback déterministe systématique** : timeout, quota, panne réseau,
  JSON invalide → l'utilisateur obtient toujours un résultat exploitable.
  Aucune fonctionnalité ne doit être en panne parce que le LLM est indisponible.
- 6.3.5 Prompts versionnés dans le dépôt, `temperature` basse, sortie JSON
  structurée. Jamais de prompt construit avec des données non échappées.
- 6.3.6 Toute clé et tout appel LLM **côté serveur uniquement**.
- 6.3.7 Journalisation des générations (prompt version, latence, fallback ou non)
  pour mesurer la qualité réelle.
- 6.3.8 Mention « généré automatiquement, à vérifier » sur tout contenu IA
  affiché comme conseil.

### Phase 6.4 — UI `/voyages/[slug]/kit`
- 6.4.1 Vue par catégorie, criticité visible, poids cumulé, complétude.
- 6.4.2 Statuts manipulables : `needed` → `to_buy` / `to_rent` / `owned` / `packed`.
- 6.4.3 Mode « check-list de départ » utilisable la veille, une main, sur mobile.
- 6.4.4 Contribution à `computeCompleteness` (25 points du C1).
- 6.4.5 Dual-view.

### Phase 6.5 — Tests
- 6.5.1 `computeRequiredKit` : jeux de cas par pays × saison × altitude × style,
  résultats attendus figés.
- 6.5.2 `diffKit` : inventaire vide, partiel, complet, avec doublons.
- 6.5.3 **Hallucination : une réponse IA contenant un ID inexistant est rejetée
  et déclenche le fallback.** Test central du chantier.
- 6.5.4 Fallback : LLM en timeout, en erreur 500, en JSON invalide → résultat
  exploitable dans les trois cas.
- 6.5.5 Cascade : ordre boutique → location → occasion → emprunt → affiliation
  respecté, vérifié par test.
- 6.5.6 Anti-biais : un besoin sans produit s'affiche comme besoin ; les
  alternatives sont présentes ; aucun lien affilié ne précède un produit maison
  équivalent.
- 6.5.7 Aucune clé IA côté client (grep automatisé).
- 6.5.8 Ajout au panier : cohérence avec Stripe, quantités, prix serveur.
- 6.5.9 Playwright + visual + a11y sur la check-list mobile.

### Phase 6.6 — Clôture
Standard + audit `business` sur la cascade + audit `security` sur l'injection
de prompt et l'exposition de clés.

**Points d'arrêt** : catalogue produits insuffisant pour couvrir les besoins →
arbitrer entre affiliation temporaire et réduction du périmètre · sorties IA
non fiabilisables → on livre le déterministe seul (c'est acceptable).

---

# CHANTIER 7 — COLLABORATIF, PARTAGE, OFFLINE, PAPIERS, BUDGET

### Phase 7.0 — Reconnaissance
Chargement · relire les policies `trip_collaborators` du C1 et le
`ConversationPanel` du C0 · baseline · branche `feat/c7-collab-offline`.

### Phase 7.1 — Collaboration
- 7.1.1 Invitation par email ou lien, rôles `owner|editor|viewer`.
- 7.1.2 Écran de gestion des membres : changement de rôle, retrait, transfert
  de propriété.
- 7.1.3 Un `owner` ne peut pas se retirer sans transférer (test).
- 7.1.4 Chat du voyage via `<ConversationPanel variant="embedded" />` et la règle
  0.2.1 (groupe s'il existe, sinon conversation dédiée).
- 7.1.5 Journal d'activité du voyage (qui a modifié quoi, quand).
- 7.1.6 Édition concurrente : réutilise l'optimistic concurrency du C3.

### Phase 7.2 — Partage & export
- 7.2.1 `visibility` : `private` → `link` (via `share_token`) → `public`.
- 7.2.2 Page publique `/voyages/[slug]` en lecture, SEO complet, JSON-LD `Trip`,
  OG image générée.
- 7.2.3 **Vérification explicite** : `trip_documents` et `trip_budget_lines`
  jamais exposés en public. Test d'intrusion.
- 7.2.4 Rotation du `share_token` (révocation d'un lien diffusé).
- 7.2.5 Export PDF **server-side** : itinéraire, contacts, papiers, cartes.
  Utilisable à une frontière ou par une assurance, donc lisible imprimé en N&B.
- 7.2.6 Export GPX de l'itinéraire complet.

### Phase 7.3 — Offline
- 7.3.1 Pack offline via `useOfflineCache` : itinéraire, GPX, documents, contacts.
- 7.3.2 Tuiles cartographiques **seulement si** la taille est acceptable —
  mesurer et décider, ne pas supposer. Sinon : dette assumée documentée.
- 7.3.3 `OfflineBanner` et état de synchronisation visibles.
- 7.3.4 Résolution de conflit au retour en ligne : le serveur gagne par défaut,
  les modifications locales sont présentées à l'utilisateur, jamais écrasées
  silencieusement.
- 7.3.5 Quota de stockage géré, purge des vieux packs.

### Phase 7.4 — Papiers, budget, checklist
- 7.4.1 `/voyages/[slug]/papiers` : visa, vaccins, assurance, permis, eSIM,
  passeport. Statuts, échéances, upload chiffré.
- 7.4.2 Storage : bucket **privé**, URLs signées à durée courte, policies
  strictes. Aucune URL publique de document, jamais.
- 7.4.3 Suppression effective d'un document (fichier **et** ligne) — droit à
  l'effacement RGPD.
- 7.4.4 Informations visa/vaccins présentées comme **indicatives**, avec renvoi
  aux sources officielles. Jamais de conseil juridique ou médical affirmatif.
- 7.4.5 `/voyages/[slug]/budget` : lignes par catégorie, estimé vs réel,
  répartition par personne, multi-devise (colonnes prêtes depuis le C1).
- 7.4.6 `/voyages/[slug]/checklist` : jalons J-60 / J-30 / J-7 / veille, générés
  depuis les papiers, le kit et les réservations.
- 7.4.7 Notifications in-app + email (pas de push au premier jet), avec
  désinscription.

### Phase 7.5 — Tests
- 7.5.1 Matrice de rôles complète : owner/editor/viewer/non-membre/anon × lecture,
  écriture, suppression, invitation, sur chacune des 9 tables. **Test exhaustif.**
- 7.5.2 Documents : invisibles en `link` et en `public`, y compris par appel API
  direct. Test d'intrusion.
- 7.5.3 `share_token` : révocation effective, ancien lien mort.
- 7.5.4 PDF : contenu complet, aucune donnée d'un autre voyage.
- 7.5.5 Offline : mode avion → consultation OK · retour en ligne → conflits
  présentés, aucune perte.
- 7.5.6 Storage : URL signée expirée refusée, accès direct au bucket refusé.
- 7.5.7 Suppression de document : fichier réellement absent du Storage.
- 7.5.8 Playwright multi-utilisateurs (deux contextes navigateur simultanés).
- 7.5.9 Playwright visual + a11y.

### Phase 7.6 — Clôture
Standard + audit `security/` **renforcé** (documents d'identité, Storage,
partage public). Bloquant.

**Points d'arrêt** : tuiles offline trop volumineuses · impossibilité de garantir
la non-exposition des documents en partage public (alors on désactive le partage
public jusqu'à résolution).

---

# CHANTIER 8 — BOUCLE DE FIN : VOYAGE VÉCU → CARNET

**Objectif** : fermer la boucle produit. Un voyage terminé devient du contenu
qui alimente le SEO, la communauté et le prochain voyage d'un autre.

### Phase 8.0 — Reconnaissance
Chargement · lire `features/hiking` (`useHikingStore`, `hike_sessions`,
`CompletionView`) et le système de carnets existant (`CarnetView`,
`CreateCarnetView`, `CarnetMoment`, `CarnetStatItem`, `CarnetKitItem`) ·
baseline · branche `feat/c8-trip-completion`.

### Phase 8.1 — Cycle de vie
- 8.1.1 Transitions de statut : `planning` → `booked` → `active` → `completed`
  → `archived`. Machine à états explicite, transitions invalides refusées côté
  serveur.
- 8.1.2 Passage automatique en `active` à `start_date` (ou manuel).
- 8.1.3 Passage en `completed` à `end_date` + confirmation utilisateur.
- 8.1.4 Mode « voyage en cours » : vue du jour, accès au cockpit rando,
  cochage des items en `done`.
- 8.1.5 Un voyage `completed` reste éditable pour le récit, mais plus pour la
  planification.

### Phase 8.2 — Agrégation
- 8.2.1 Rattachement des `hike_sessions` aux `trip_items` de `kind='hike'` par
  proximité spatio-temporelle (`ST_DWithin` + fenêtre de dates).
- 8.2.2 Statistiques du voyage : distance, dénivelé, jours actifs, altitude max,
  pays, nombre de lieux visités.
- 8.2.3 Photos et moments collectés depuis les sessions et les contributions.
- 8.2.4 Bilan de kit **a posteriori** : ce qui a servi, ce qui était inutile.
  C'est la donnée la plus précieuse du produit — elle améliore le C6 pour tous.
- 8.2.5 Bilan budgétaire : estimé vs réel.
- 8.2.6 Alimentation de `place_scores.completions_90d` (C4) depuis les visites réelles.

### Phase 8.3 — Carnet
- 8.3.1 Génération automatique d'un carnet depuis le voyage, réutilisant les
  types existants (`CarnetMoment`, `CarnetStatItem`, `CarnetKitItem`).
- 8.3.2 Édition du récit, réordonnancement des moments, sélection des photos.
- 8.3.3 Texte de liaison rédigé par l'IA (C6), **entièrement modifiable**,
  jamais publié sans validation humaine.
- 8.3.4 Publication : privé / lien / public. Page SEO + JSON-LD.
- 8.3.5 Retour de contribution : proposer au voyageur d'enrichir les `places`
  visités (photos, tips, avertissements). **C'est le moteur du cold start.**

### Phase 8.4 — Duplication & templates
- 8.4.1 « Refaire ce voyage » : duplication d'un voyage public →
  nouveau `trip` avec `duplicated_from` (colonne prévue au C1).
- 8.4.2 La duplication copie l'itinéraire et le kit, **jamais** les documents,
  le budget réel, ni les collaborateurs. Test explicite.
- 8.4.3 Dates recalculées relativement à la nouvelle date de départ.
- 8.4.4 Compteur de duplications = signal de qualité, remonté dans le classement.
- 8.4.5 Attribution à l'auteur original.

### Phase 8.5 — Tests
- 8.5.1 Machine à états : chaque transition valide passe, chaque invalide est
  refusée côté serveur (pas seulement côté UI).
- 8.5.2 Rattachement des sessions : session dans le rayon et la fenêtre rattachée,
  session hors critères non rattachée.
- 8.5.3 Statistiques : jeu de sessions connu → valeurs attendues exactes.
- 8.5.4 Duplication : aucune fuite de documents, budget ni collaborateurs.
  **Test d'intrusion.**
- 8.5.5 Dates recalculées correctes, y compris sur changement d'année et sur
  voyage sans dates.
- 8.5.6 Carnet public : aucune donnée privée exposée.
- 8.5.7 `completions_90d` incrémenté correctement, sans double comptage.
- 8.5.8 Playwright : cycle complet planning → active → completed → carnet publié
  → dupliqué par un autre utilisateur.
- 8.5.9 Playwright visual + a11y.

### Phase 8.6 — Clôture
Standard + audit `security/` sur la duplication et la publication.

---

# RECETTE FINALE — PRÉ-LANCEMENT (`release/voyage-v1`)

À exécuter quand C0→C8 sont ✅. Aucune de ces vérifications n'est optionnelle.

### RF.1 — Intégrité technique
- RF.1.1 `npx tsc --noEmit` : zéro erreur. Inventaire de **tous** les
  `@ts-ignore`/`any` du module : doit être vide.
- RF.1.2 `npm run lint` : zéro warning.
- RF.1.3 `npx next build` : vert. Analyse de la taille des bundles, aucune
  régression majeure.
- RF.1.4 Toutes les migrations rejouées **de zéro** sur base vierge :
  `supabase db reset` puis `db push` **deux fois** → succès.
- RF.1.5 Suite de tests complète verte : unitaires, intégration, RLS, e2e, visual.
- RF.1.6 Aucune dépendance npm non justifiée. `npm audit` sans vulnérabilité
  critique.

### RF.2 — Sécurité (audit `security/` global, bloquant)
- RF.2.1 RLS activée sur **100 %** des tables du module (vérification par
  requête `pg_tables.rowsecurity`, pas par relecture de code).
- RF.2.2 Toute fonction `security definer` a `set search_path` et des `grant` ciblés.
- RF.2.3 Matrice d'accès complète rejouée : owner/editor/viewer/non-membre/anon
  × toutes les tables × select/insert/update/delete.
- RF.2.4 Aucun secret côté client : grep sur clés Supabase service, OpenRouter,
  Stripe, marker Travelpayouts.
- RF.2.5 `trip_documents` inaccessibles hors éditeurs, en toutes circonstances.
- RF.2.6 Lieux `blurred` : coordonnées exactes jamais servies par l'API.
- RF.2.7 Tables d'affiliation invisibles aux clients.
- RF.2.8 Postback : signature obligatoire, idempotent, rate-limité.
- RF.2.9 Storage : buckets privés, URLs signées courtes, pas d'accès direct.
- RF.2.10 Aucune erreur serveur ne fuit de détail d'implémentation ni
  d'information sur l'existence d'une ressource privée.

### RF.3 — Conformité légale (audit `product-policy/`, bloquant)
- RF.3.1 Disclosure d'affiliation présent sur **100 %** des surfaces à liens
  affiliés (test automatisé).
- RF.3.2 `rel="sponsored nofollow"` sur tous les sortants affiliés.
- RF.3.3 CMP conforme CNIL, aucun cookie tiers avant consentement (vérification
  au DevTools réseau).
- RF.3.4 CGU à jour : modèle économique, critères de classement (DSA/P2B),
  licence des contributions, statut auto-entrepreneur.
- RF.3.5 Attribution ODbL pour les données OSM.
- RF.3.6 Droit à l'effacement effectif : suppression de compte → données de
  voyage et documents réellement supprimés (fichiers inclus).
- RF.3.7 Rétention : purge des clics à 13 mois opérationnelle.
- RF.3.8 Informations visa/vaccins présentées comme indicatives, sources
  officielles citées.
- RF.3.9 Aucune donnée personnelle inutile collectée (minimisation) ; pas d'IP
  en clair.

### RF.4 — Qualité produit
- RF.4.1 Parcours complet vérifié à la main : inscription → création de voyage →
  planification → kit → réservations → voyage vécu → carnet → duplication.
- RF.4.2 Dual-view contrôlé écran par écran en 390 px et 1440 px.
- RF.4.3 Cold start : chaque écran a un `EmptyState` soigné. **Aucun écran vide
  et muet** — c'est ce que verront 100 % des premiers visiteurs.
- RF.4.4 Volumes de données réels par pays documentés. Un pays sous le seuil est
  soit complété, soit retiré de la mise en avant. **Pas de destination vitrine vide.**
- RF.4.5 Accessibilité : parcours principaux au clavier, contrastes conformes
  (vérifier le bug `#17402C` sur `#17402C`), libellés ARIA.
- RF.4.6 Performance : `getTripFull` en une requête, pages principales < 200 ms
  sur données seed, Lighthouse mobile ≥ 85.
- RF.4.7 SEO : `sitemap.ts` couvre voyages publics, lieux, carnets ;
  `robots.ts` exclut `/go/*`, `/admin`, `/compte` ; JSON-LD valide.
- RF.4.8 Aucune page 500. Toutes les routes ont `loading.tsx` et `error.tsx`.

### RF.5 — Documentation & clôture
- RF.5.1 `docs/PROGRESS_VOYAGE.md` : 100 % des sous-phases ✅ ou ⏸️ documentée.
  **Aucune ⬜, aucune 🔄.**
- RF.5.2 `CLAUDE.md` mis à jour : conventions du module Voyage.
- RF.5.3 `MISSION_LOG.md` : les 9 chantiers consignés.
- RF.5.4 `README.md` : arborescence à jour.
- RF.5.5 Registre de dette assumée consolidé, avec impact et coût de résolution.
- RF.5.6 Runbook d'exploitation : rafraîchissement des vues matérialisées,
  purges, réconciliation d'affiliation, modération.
- RF.5.7 `finishing-a-development-branch` sur `release/voyage-v1`.

---

# PROTOCOLE DE PROGRESSION — `docs/PROGRESS_VOYAGE.md`

Créé au C1, poursuivi à chaque chantier. Une section par chantier, tenue
**en continu** (pas à la fin), commitée à chaque phase terminée.

### Format imposé
| ID | Sous-phase | État | Preuve de validation | Commit | Date |
|----|-----------|------|---------------------|--------|------|
| 1.1.2 | Table `trips` | ✅ | `pg_tables` + 14 CHECK vérifiés + test 1.5.4 vert | `a1b2c3d` | 2026-.. |

**États** : ⬜ à faire · 🔄 en cours · ✅ validé · ❌ échoué · ⏸️ bloqué

### RÈGLE ABSOLUE DE COCHAGE
Une sous-phase passe à ✅ **uniquement** si les quatre conditions sont réunies :
1. le code est écrit **et commité** ;
2. un test **automatisé** la couvre **et il est vert** ;
3. la **sortie réelle** de la commande de vérification est **collée dans le
   fichier** (extrait, pas un résumé) ;
4. `tsc`, `lint` et `build` restent verts après la modification.

**Interdictions formelles** : cocher par anticipation · cocher parce que « ça
devrait marcher » · cocher sans avoir exécuté la commande · **inventer une
sortie de terminal**.

Si une commande ne peut pas être exécutée : état ⏸️, avec la commande exacte que
l'humain doit lancer et le résultat attendu.

> **Une sous-phase honnêtement ⏸️ vaut infiniment mieux qu'un ✅ mensonger.**
> C'est le mode d'échec numéro un de ce genre de programme : 40 cases cochées
> dont 12 non vérifiées donnent l'illusion d'un chantier fini et font construire
> le suivant sur du sable. Un faux ✅ au C2 contamine six chantiers.

### Sections obligatoires du fichier
Tableau de bord de tête (X/Y sous-phases, % par phase et par chantier) ·
baseline d'avant-chantier · journal des décisions techniques avec justification ·
registre des blocages avec la question exacte posée à l'humain · dette assumée
avec impact et coût · tableau des volumes de données réels par pays.

---

# REGISTRE DES RISQUES

| # | Risque | Prob. | Impact | Mitigation | Chantier |
|---|---|---|---|---|---|
| R1 | **Base de lieux vide → produit creux** | Élevée | Critique | Comptage en 2.0.3 · import OSM · seuil ≥ 40 lieux/pays · réduire à 3 pays plutôt que livrer 5 vides | C2, C4 |
| R2 | Périmètre « tout tout tout » → rien livré | Élevée | Critique | Découpage en 9 chantiers · un chantier = une PR · couper avant d'ajouter | Global |
| R3 | Faux ✅ → dette invisible | Moyenne | Critique | Règle de cochage à 4 conditions · preuves collées | Global |
| R4 | Non-conformité DGCCRF → amende, patrimoine perso exposé | Moyenne | Critique | Disclosure testé automatiquement · CGU · audit `product-policy` bloquant | C5 |
| R5 | Fuite de documents d'identité | Faible | Critique | RLS dédiée dès le C1 · Storage privé · tests d'intrusion | C1, C7 |
| R6 | Fuite de coordonnées de lieux sensibles | Moyenne | Élevé | Floutage serveur · vue publique dédiée · audit renforcé | C4 |
| R7 | Compte Travelpayouts refusé | Moyenne | Élevé | Vérifié en 5.0.2 **avant** de coder · architecture multi-partenaires par table | C5 |
| R8 | Hallucination IA (lieu/produit/prix inventé) | Élevée | Élevé | L'IA ne fournit jamais d'ID · validation zod contre la base · fallback déterministe | C6 |
| R9 | Dual-view double le coût | Certaine | Moyen | Assumé et budgété (+40 %/écran) · composants factorisés | Global |
| R10 | DnD mobile non fiable | Moyenne | Faible | Boutons d'abord, DnD en surcouche · abandon documenté si non fiabilisable | C3 |
| R11 | Récursion infinie de policies RLS | Moyenne | Élevé | `security definer` `can_read_trip`/`can_edit_trip` · test anti-récursion dédié | C1 |
| R12 | Tuiles offline trop volumineuses | Moyenne | Faible | Mesurer avant de décider · dette assumée acceptable | C7 |
| R13 | Cold start : aucune contribution | Élevée | Élevé | Seed éditorial · boucle carnet → contribution (8.3.5) · gamification | C4, C8 |

---

# ANTI-PÉRIMÈTRE (ce qu'on ne fait PAS en v1)

Réservation en direct (on est apporteur d'affaires, pas agence de voyage —
statut réglementé). Recherche de vols avec prix réels (Duffel/Amadeus : coût et
complexité disproportionnés, deeplink suffit). Multi-langue et multi-devise
opérationnels (colonnes prêtes, UI en FR/EUR). Notifications push. Application
mobile native. Fiches d'hôtels commerciaux stockées (deeplink uniquement ; en
revanche on stocke les refuges et bivouacs, valeur unique non couverte par
Booking). Restaurants comme centre de profit (quasi aucun programme d'affiliation
exploitable → contenu communautaire et aimant SEO, rien de plus). Réseaux
d'affiliation multiples (Travelpayouts seul ; la table `affiliate_partners`
permet d'en ajouter sans refonte).

---

**Fin du document.** Toute évolution de périmètre s'écrit ici avant d'être codée.
