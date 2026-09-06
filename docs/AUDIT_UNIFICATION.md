# AUDIT DE VÉRITÉ & LIGNE DE BASE — UNIFICATION LKDV (PHASE 0)
Date : 2026-09-07T01:15:00+02:00
Référence commit HEAD : `dbde56064d3fd58e2da5512ecba450d2ce28343a` (branche `main`)
Projet : Le Kit du Voyageur (LKDV) — Unification Module Voyage & Groupes

---

## 0.1 Ligne de Base Technique

### Environnement & Outils
| Outil | Version constatée |
|---|---|
| Node.js | `v24.18.0` |
| npm | `12.0.2` |
| Next.js | `15.5.18` (App Router) |
| React / React DOM | `19.0.3` |
| Supabase JS | `@supabase/supabase-js 2.49.4`, `@supabase/ssr 0.6.1` |
| Vitest | `4.1.11` |
| Playwright | `1.51.1` |

### Historique Git récent (15 derniers commits)
```
dbde560 fix(materiel): fix spring keyframe limit, countdown hydration mismatch, and optimistic state transition
944e7d2 fix(groupes): prevent Leaflet double initialization and fix nested button hydration error
f86ff69 merge: release/voyage-v1 -> main (Module Voyage C0-C8)
d61f0c0 test(e2e): suite Playwright Voyage et snapshots visuels 390px/1440px, cloture DETTE-RF-1
b8c89fb docs: audit de vérité terrain, alignement PROGRESS_VOYAGE et enregistrement DETTE-RF-1
097bb34 docs: complete Voyage roadmap closure, update CLAUDE.md and MISSION_LOG
961c1a9 chore(release): final acceptance and master completion report for Voyage v1
cccbf58 docs(c8): update commit sha in PROGRESS_VOYAGE.md
1d54883 feat(c8): retrospective, trip completion, carnet conversion, and field reviews
f9cfb6c docs(c7): update commit sha in PROGRESS_VOYAGE.md
73a87df feat(c7): collaborative trips, sharing, offline storage, travel documents, budget and tests
06413db feat(c6): contextual gear kit, gear gap engine, lkdv shop integration and tests
467c7ad docs: record Chantier 5 validation in PROGRESS_VOYAGE.md
ab0c096 feat(c5): complete Travelpayouts affiliation, RGPD hashing, legal disclosure and tests
63c755f docs(c4): finalize Chantier 4 progress tracking
```

### Validation des Quality Gates de base
* **Vitest (`npm test -- --run`)** :
  ```
  Test Files  87 passed (87)
       Tests  572 passed (572)
    Duration  5.60s
  ```
  *Constat : Le nombre exact de 572 tests unitaires/intégration revendiqué lors du merge est vérifié et 100% passant.*

* **TypeScript (`npx tsc --noEmit`)** :
  ```
  npm notice run kitduvoyageur@0.1.0 npx
  npm notice run tsc --noEmit
  Exit code: 0 (0 erreur)
  ```

* **Linter (`npm run lint`)** :
  ```
  Exit code: 0 (0 erreur bloquante, warnings connus sur des guillemets non échappés)
  ```

* **Production Build (`npm run build`)** :
  ```
  Creating an optimized production build ...
  ✓ Compiled successfully in 14.6s
  Generating static pages (86/86) ...
  Exit code: 0
  ```

---

## 0.2 Cartographie du Modèle de Données

Inspection directe via le projet Supabase `icxyvwzfjbflcbqukpfz` :

### Tables du domaine Groupes & Voyages
| Table | Lignes réelles | RLS actif | Rôle / Usage |
|---|---|---|---|
| `travel_groups` | 11 | Oui | Groupes d'expédition actuels |
| `group_members` | 54 | Oui | Membres de groupes (`organizer`, `co_organizer`, `member`, `observer`) |
| `group_messages` | 66 | Oui | Chat interne de groupe |
| `group_expenses` | 18 | Oui | Dépenses partagées du groupe |
| `group_kit_items` | 12 | Oui | Équipement collectif |
| `group_tasks` | 26 | Oui | Tâches de préparation |
| `group_polls` | 4 | Oui | Sondages de groupe |
| `group_poll_votes`| 14 | Oui | Votes aux sondages |
| `trips` | 1 | Oui | Voyages créés (Module Voyage) |
| `trip_collaborators` | 1 | Oui | Collaborateurs du voyage (`owner`, `editor`, `viewer`) |
| `trip_steps` | 2 | Oui | Étapes de voyage |
| `trip_items` | 0 | Oui | Équipements de voyage |
| `trip_expenses` | 1 | Oui | Dépenses de voyage |
| `trip_documents` | 0 | Oui | Documents de voyage (chiffrés) |
| `trip_pois` | 0 | Oui | Points d'intérêt épinglés |
| `trip_safety_checkpoints` | 0 | Oui | Checkpoints de sécurité |
| `trip_notes` | 0 | Oui | Carnet de bord / notes |
| `destination_steps` | 33 | Oui | Catalogue d'étapes de référence pour l'itinéraire |
| `places` | 42 | Oui | Topos et lieux géoréférencés |
| `affiliate_links` | 21 | Oui | Liens partenaires d'affiliation |

### Types ENUM de la base
* `trip_collaborator_role` : `'owner'`, `'editor'`, `'viewer'`
* `group_member_role` : `'organizer'`, `'co_organizer'`, `'member'`, `'observer'`
* `group_visibility` : `'public'`, `'private'`, `'invite_only'`
* `trip_visibility` : `'private'`, `'unlisted'`, `'public'`
* `trip_status` : `'draft'`, `'planned'`, `'active'`, `'completed'`, `'cancelled'`

---

## 0.3 Tranchage des Hypothèses H1 à H7

| Hypothèse | Statut | Preuve factuelle constatée |
|---|---|---|
| **H1** — La table de membres s'appelle bien `group_members` | **CONFIRMÉ** | `group_members` contient 54 lignes. `travel_group_members` n'existe pas. Il existe une table `groupe_membres` vestigiale à 0 ligne. |
| **H2** — `trip_collaborators` existe avec rôles `owner\|editor\|viewer` | **CONFIRMÉ** | La table existe (1 ligne) et l'enum postgres `trip_collaborator_role` définit explicitement `('owner', 'editor', 'viewer')`. |
| **H3** — Le générateur d'itinéraire retourne `[]` hors des 5 routes pilotes | **CONFIRMÉ** | `src/features/trips/engine/buildItinerary.ts` lignes 55-63 : si `rawSteps.length === 0`, le moteur logue un warning et exécute `continue` sans insérer d'étape de repli. Or `destinationsSeed.ts` n'a de graines que pour FR, NP, PE, IS, MA. |
| **H4** — Altitude issue d'une constante pays et offres partenaires d'un mapping naïf | **CONFIRMÉ** | `contextualKitEngine.ts` ligne 371 lit `step.elevation_gain_m` (dénivelé étape) comme étant l'altitude max `maxAltitudeM`. Dans `affiliateSeed.ts`, toutes les offres FR sont assignées à Chamonix / Aiguille du Midi par simple filtre `country_code: 'FR'`. |
| **H5** — Trousse de secours à `weight_g: 0` | **CONFIRMÉ** | En base, `shop_products` a `weight_g: 0` pour `trousse-de-premiers-secours-michelin-9531-44-pieces`. Cette valeur écrase le `baseWeightGrams: 200` dans `contextualKitEngine.ts` ligne 421. |
| **H6** — Playwright installé et 7 tests E2E Voyage existants | **CONFIRMÉ** | Playwright v1.51.1 est opérationnel, 22 tests listés dont 7 tests dans `scripts/e2e/voyage.spec.ts`. |
| **H7** — `travel_groups` / `group_members` lus par `clubs`, `communaute`, `activite`, `encheres` | **INFIRMÉ** | `git grep` prouve zéro occurrence dans ces 4 modules. Usages limités à : `/groupes`, `/compte` (Aventures), `/pays` (`BouteilleALaMer`), `/social` (`ShareSheet`) et `lib/queries/groupe.ts`. |

---

## 0.4 Cartographie UI & Incohérences Détectées

### 1. Shells concurrents
* **`AppShell`** : utilisé sur `/ambassadeurs`, `/lieux`, `/voyages/**`.
* **`Header` + `Footer` + `MobilePageShell` + `CompteBackground`** : utilisé sur toutes les autres routes (`/groupes`, `/communaute`, `/clubs`, `/compte`, etc.).
* Conséquence : double navigation, double gestion de safe-area, duplication d'arbre de composants.

### 2. Bibliothèque d'icônes
* `lucide-react` : 109 occurrences (utilisé dans `AppShell`, `voyages`, `preparation`).
* `AppIcon` : 135 occurrences (utilisé dans `Header`, `groupes`, `clubs`).
* `LkvIcon` : 68 occurrences (composant maison).

### 3. Couleurs en dur dans le JSX
* Vert encre dominant : `#17402C` (4 646 occurrences).
* Vert secondaire Voyage : `#5B7F55` (498 occurrences).
* Vert secondaire Groupes : `#5C6B5E` (453 occurrences).
* Gris / Sauge : `#5A7064` (1 075 occurrences), `#6B7A72` (149 occurrences), `#E7E3D6` (128 occurrences).

### 4. Jargon interne exposé
* `src/features/trips/components/TripPlaceholderTab.tsx` : affiche littéralement `Chantier {chantierNumber}`.
* `src/features/trips/components/TripOverviewTab.tsx` L129 : « L’éditeur d’itinéraire complet sera activé au Chantier 2. »
* L210 : « Ce voyage est actuellement en phase de fondation (Chantier 1). Les modules d’édition fine d’itinéraire (C2), de collaboration temps réel (C3)... »

---

## 0.5 Analyse des Défauts Constatés (D1 à D12)

| # | Défaut | Localisation dans le code | Cause racine identifiée |
|---|---|---|---|
| **D1** | Itinéraire vide (0 jours, 0 km, +0 m D+) | `src/features/trips/engine/buildItinerary.ts:55-63` | `selectCandidateStepsForCountry` renvoie `[]` hors des 5 routes pilotes. Le moteur fait `continue` sans fallback paramétrique ni squelette. |
| **D2** | « Altitude maximale 54 m » pour Chamonix | `src/features/trips/engine/contextualKitEngine.ts:371` | `maxAltitudeM` est calculé avec `step.elevation_gain_m` (dénivelé) au lieu d'une vraie altitude max. |
| **D3** | Trousse de secours à `0 g` | `src/features/trips/engine/contextualKitEngine.ts:421` | Le produit en base `shop_products` a `weight_g: 0`, ce qui écrase `baseWeightGrams: 200`. |
| **D4** | Sac vide `0,0 kg` badgé ULTRALIGHT | `src/features/trips/engine/contextualKitEngine.ts:467` | `if (baseWeightGrams < 5000) weightCategory = 'ultralight'`, or 0 < 5000 est vrai. |
| **D5** | Badge « 14 équipements » vs 6 cartes | `src/features/trips/components/TripKitView.tsx:247,256` | Le badge compte le total (`14`), mais la grille applique `.slice(0, 6)` sans bouton d'expansion. |
| **D6** | Compteur d'onglet `2` avec itinéraire vide | `src/lib/queries-trips.ts:258`, `trip_steps` | 2 étapes de test orphelines existent en DB (`ezfzef`, `zefzefze`), alimentant le compteur même sans itinéraire valide. |
| **D7** | 6/6 recommandations « VITAL » | `src/features/trips/engine/contextualKitEngine.ts:31-150` | Presque toutes les règles contextuelles ont `defaultPriority: 'vital'` en dur sans pondération de risque. |
| **D8** | Dates 26 vs 27 octobre (UTC vs local) | `src/app/voyages/[slug]/export/ExportClientView.tsx:99` | `new Date("YYYY-MM-DD")` parse en UTC minuit, ce qui recule la date au jour précédent dans les fuseaux < UTC. |
| **D9** | Jargon interne exposé (« Chantier 7 », etc.) | `TripPlaceholderTab.tsx`, `TripOverviewTab.tsx` | Chaînes de texte brutes mentionnant les chantiers de dev intégrées dans les vues de prod. |
| **D10** | Contrastes gris sur verre < 4.5:1 | `src/styles/liquid-glass.css`, `#5B7F55`, `text-gray-400` | `#5B7F55` (4.52:1 sur blanc) passe sous 4.5:1 sur tout fond verre translucide (`bg-white/80`). |
| **D11** | Double shell, double thème, 3 libs d'icônes | Architecture transverse | Séparation historique entre `groupes` (mobile shell) et `voyages` (desktop/AppShell). |
| **D12** | N+1 sur le comptage des membres de groupe | `src/app/groupes/page.tsx:93-96, 113-116` | Boucle `Promise.all` exécutant un `count` HTTP Supabase pour chaque groupe affiché. |

---

## 0.6 Baseline Mesurée

### Performances des routes clés sur le serveur local
| Route | Code HTTP | Temps de réponse (ms) | Taille HTML transférée (octets) | First Load JS (Production Build) |
|---|---|---|---|---|
| `/` (Accueil) | 200 | 3 884 | 121 572 | 104 kB |
| `/voyages` | 200 | 2 347 | 78 548 | 200 kB (14.2 kB page) |
| `/voyages/fdgb-3c3a92` | 200 | 1 729 | 95 298 | 350 kB (151 kB page) |
| `/groupes` | 200 | 1 948 | 68 693 | 339 kB (12.5 kB page) |

### État de la suite E2E Playwright
* 7 tests exécutés dans `scripts/e2e/voyage.spec.ts` :
  * 6 PASSÉS (API canonique, affichage Cockpit /voyages, /lieux topos, redirection partenaire, snapshot responsive 390px, snapshot desktop 1440px).
  * 1 ÉCHOUÉ : `TEST-E2E-VOYAGE-03: Wizard /voyages/nouveau`.
  * *Cause racine de l'échec* : `TripWizard.tsx` possède deux arbres complets concurrents (`<div className="hidden md:block">` et `<div className="block md:hidden">`) contenant chacun un `<main id="main-content">`. `page.locator('main').first()` cible le `<main>` du conteneur masqué par CSS, ce qui viole le test de visibilité.

---

## 0.7 Recommandation & Conclusion Phase 0

1. **Point d'arrêt dur A non atteint** : La suite Vitest compte bien 572 tests valides et 0 échec sur `main`. La compilation TypeScript et le build Next.js sont 100% verts.
2. **Tous les défauts D1 à D12 sont précisément expliqués et localisés**.
3. **Le système est prêt pour la Phase 1 (Corrections Fonctionnelles Bloquantes P0)** :
   * P1.1 : Fallback du générateur d'itinéraire (résolution D1).
   * P1.2 : Source unique du profil d'altitude (résolution D2).
   * P1.3 : Cohérence des poids et des badges (résolution D3, D4).
   * P1.4 : Compteurs dérivés réels (résolution D5, D6).
   * P1.5 : Hiérarchie des recommandations de sécurité (résolution D7).
   * P1.6 : Dates civiles locales (résolution D8).
