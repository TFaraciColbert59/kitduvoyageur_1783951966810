# CHANTIER ATLAS — Fusion Aventure × Earth en un explorateur unique façon Google Earth

> **Dépôt :** `TFaraciColbert59/kitduvoyageur_1783951966810`
> **Agent d'exécution :** OpenCode, accès complet (lecture/écriture/bash/DB)
> **Portée :** remplacer `/carte-interactive` (Aventure) et `/pays` (Earth) par un seul explorateur cartographique continu — zoom local sur les randonnées → dézoom progressif → globe 3D pour choisir un pays — préparé pour un lancement mondial à forte volumétrie.
> **Ce document est autonome** : un agent qui n'a jamais vu la conversation d'origine doit pouvoir l'exécuter du début à la fin sans contexte supplémentaire.

---

## 0. Statut & portée (GEL)

Ce chantier **remplace le moteur cartographique**, il n'invente pas de nouvelles fonctionnalités produit. Interdiction formelle (GEL) tant qu'une phase n'est pas explicitement dédiée à ça :
- pas de nouvelle table hors celles listées en Phase 1,
- pas de nouvelle route API hors celles listées en Phase 1/3,
- pas de changement de logique métier dans les composants communauté (`BouteilleALaMer.tsx`, etc.) — ils sont hors périmètre.

Tout écart de scope doit être noté dans le rapport de fin de phase, pas exécuté silencieusement.

---

## 1. Instructions d'amorçage obligatoires

**Rien de ce qui suit n'est optionnel.** À exécuter avant la moindre ligne de code, dans l'ordre.

### 1.1 Skills à lire, dans cet ordre

1. `.agents/skills/lkdv-development/SKILL.md` — règles générales du projet (ne jamais inventer table/colonne/fonction, préférer le plus petit diff propre).
2. `.agents/skills/using-superpowers/SKILL.md` puis `.agents/skills/brainstorming/SKILL.md` puis `.agents/skills/writing-plans/SKILL.md` — le workflow Superpowers est une **règle permanente** du dépôt (voir `AGENTS.md` racine), pas une option.
3. `.agents/skills/map-geospatial/SKILL.md` — règles géospatiales spécifiques LKDV (jamais charger toutes les données en mémoire, viewport obligatoire, simplification de géométrie).
4. `.agents/skills/supabase-postgis/SKILL.md` — règles Supabase/PostGIS spécifiques LKDV (RLS, index, jamais de service-role côté client).
5. `.agents/skills/nextjs-performance/SKILL.md` — budget de perf mobile.
6. `.agents/skills/security-audit/SKILL.md` — checklist sécurité Supabase/API.
7. `.agents/skills/ux-mobile/SKILL.md` puis `.agents/skills/apple-ui-designer/SKILL.md` puis `.agents/skills/interaction-design/SKILL.md` — **Règle Permanente UX** du dépôt (`AGENTS.md` racine) : obligatoires pour toute décision de layout, hiérarchie visuelle, microinteraction ou transition.
8. `.agents/skills/subagent-driven-development/SKILL.md`, `.agents/skills/test-driven-development/SKILL.md`, `.agents/skills/verification-before-completion/SKILL.md`, `.agents/skills/systematic-debugging/SKILL.md` — discipline d'exécution.
9. `.agents/skills/using-git-worktrees/SKILL.md` et `.agents/skills/finishing-a-development-branch/SKILL.md` — isolation et clôture de branche.
10. `.agents/skills/github-workflow/SKILL.md`, `.agents/skills/requesting-code-review/SKILL.md`, `.agents/skills/receiving-code-review/SKILL.md`.

### 1.2 Fichiers de référence à lire avant tout code

- `docs/Design-tokens.md` — **source de vérité absolue** de la palette et des classes du design system Liquid Glass. Rien ne s'écrit en dehors.
- `src/styles/liquid-glass.css` — classes réelles (`.glass`, `.glass-sub-card`, `.glass-pill`, `.glass-capsule-btn`, `.glass-capsule-bar`, `.glass-input`…).
- `.agents/agents/pays-conformite-lg.md` — **c'est le modèle à suivre** pour la checklist de conformité (grep de couleurs bannies, vérification build/Playwright). Ce chantier doit produire l'équivalent pour les nouveaux fichiers de l'explorateur.
- `.agents/agents/pays-hero-refonte.md` et `.agents/agents/pays-sections-refonte.md` — montrent le niveau de précision attendu dans le repérage des zones de code et des classes à toucher/ne pas toucher.
- `MISSION_LOG.md` et `HANDOFF_AGENT.md` — format de rapport attendu en fin de chantier (voir section 9).
- `src/app/pays/page.tsx` — page Earth actuelle, **déjà en Liquid Glass clair** : c'est la référence visuelle à égaler, pas à réinventer.

### 1.3 Câblage OpenCode (agents + skills) — vérifier avant de supposer quoi que ce soit

Constat : ce dépôt contient **quatre** emplacements de skills/agents différents (`.claude/`, `.agents/`, `.agent/`, et le pack `.agents/skills/SkillsForOpenCode/.opencode/`), mais **aucun dossier `.opencode/` n'existe à la racine**, et `opencode.json` ne référence ni `instructions`, ni `agent`, ni `skill`. Concrètement : OpenCode ne découvre probablement **rien** de tout ça automatiquement aujourd'hui.

Avant d'invoquer un skill "nativement", vérifier la réalité de l'installation :
```bash
opencode --version
cat opencode.json
opencode agent list        # si la commande n'existe pas, vérifier la doc locale/--help
```
Puis, dans `opencode.json` à la racine, ajouter (en conservant le plugin `omniroute` existant) :
```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["AGENTS.md"],
  "plugin": [ /* ... configuration omniroute existante, inchangée ... */ ]
}
```
Puis créer `.opencode/agent/` et `.opencode/skills/` à la racine et y **copier** (pas déplacer, pas casser Claude Code qui lit `.claude/`) :
- les skills listées en 1.1 depuis `.agents/skills/`,
- les agents `pays-conformite-lg.md`, `architect.md`, `security-reviewer.md`, `database-reviewer.md`, `performance-optimizer.md`, `code-reviewer.md`, `silent-failure-hunter.md`, `a11y-architect.md` depuis `.agents/skills/SkillsForOpenCode/.opencode/agents/`.

Créer en plus, dans `.opencode/agent/`, les agents propres à ce chantier (mêmes conventions de frontmatter que `pays-conformite-lg.md`, `model: opus` ou équivalent le plus capable disponible dans le routeur `omniroute`) :
- `atlas-data-layer.md` — RPC PostGIS, vues matérialisées, RLS (Phase 1)
- `atlas-globe-engine.md` — composant MapLibre unifié, projection globe (Phase 2-4)
- `atlas-conformite-lg.md` — clone de `pays-conformite-lg.md` adapté aux nouveaux fichiers de l'explorateur (Phase 6)

Si la découverte automatique par OpenCode s'avère différente de ce qui précède une fois vérifiée (nom de dossier `agent` vs `agents` selon version), l'agent adapte le chemin et **documente l'écart** dans le rapport de Phase 0 — ne pas deviner en silence.

### 1.4 Séquence Superpowers obligatoire

`brainstorming` → produire le plan avec `writing-plans` (fichier `docs/architecture/CHANTIER_ATLAS_PLAN.md`) → exécution `subagent-driven-development` + `test-driven-development` phase par phase → `verification-before-completion` avant chaque clôture de phase → `systematic-debugging` si un test casse. Ne jamais sauter à l'implémentation sans le plan écrit.

### 1.5 Git

Branche `chantier/atlas-0-fondations`, une branche par phase (`chantier/atlas-1-...`, `chantier/atlas-2-...`), jamais de merge direct sur `main`. PR à chaque fin de phase même en accès complet — c'est une discipline de sécurité pour un chantier qui touche deux pages flagship, pas une question de confiance.

---

## 2. Contexte technique (résumé du diagnostic déjà établi)

- **Aventure** (`/carte-interactive`) = Leaflet + tuiles raster, rayon fixe 10 km, composant réel dans `src/components/map/InteractiveMap.tsx` (le fichier `src/app/carte-interactive/components/InteractiveMap.tsx` est du **code mort**, `return null`, à supprimer en Phase 5).
- **Earth** (`/pays`) = `react-globe.gl` (Three.js) + GeoJSON statique `/public/data/countries-110m.geojson`.
- **`maplibre-gl@^6.4.1`** est déjà en dépendance, **inutilisé nulle part** dans le code — c'est l'outil retenu (voir section 3).
- **Bug de perf confirmé** : le filtre viewport de `getTrails` (`src/lib/queries/trails.ts`) filtre sur les colonnes calculées `start_lat`/`start_lng` de la vue `explore_trails`, ce qui ignore l'index GIST existant sur `hiking_routes.geom` → recalcul géométrique sur 115 000+ lignes à chaque requête. À corriger en Phase 1.
- **Migration `20260810000000_explore_trails_no_synthetic.sql`** contient elle-même la mention "NON APPLIQUÉE" — à vérifier sur le Supabase distant (projet `icxyvwzfjbflcbqukpfz`, jamais `lwrmuggefbmboikjgudc`) avant de construire dessus.
- **`countries_geo.geometry`** est un point (capitale), actuellement `NULL` pour les 195 pays — sans rapport avec les polygones du globe (fichier statique, intact), mais responsable du `focusPoint` cassé de `CountryGlobe.tsx`.
- Pas de `AbortController`, pas de debounce sur les fetches viewport, pas de rate limiting sur `/api/hikes` et `/api/pois`.

---

## 3. Décision d'architecture

**MapLibre GL JS, projection `globe`, moteur unique** pour remplacer Leaflet ET `react-globe.gl`. Un seul canvas WebGL : carte plate en zoom local, bascule native en globe 3D en dézoomant, caméra continue via `flyTo`/`easeTo`. Aucune dépendance nouvelle — elle est déjà installée.

4 paliers de rendu/données par zoom (voir diagramme fourni en amont de ce chantier) :

| Palier | Zoom | Source de données |
|---|---|---|
| Local | 14-18 | RPC PostGIS indexée (Phase 1) |
| Région | 8-13 | Vue matérialisée geohash |
| Continent | 4-7 | Vue matérialisée densité pays |
| Monde | 0-3 | GeoJSON pays statique existant |

---

## 4. Règles fondamentales non négociables

| Code | Règle |
|---|---|
| ATLAS-R1 | Aucune table, colonne, fonction ou route inventée — tout ce qui n'existe pas doit être créé via migration explicite et documentée. |
| ATLAS-R2 | Toute requête géographique passe par `ST_Intersects`/`ST_DWithin` sur une colonne indexée GIST — jamais de filtre sur colonne calculée non indexée. |
| ATLAS-R3 | Aucune couleur hors `docs/Design-tokens.md` ; `#E4501C` reste banni à 0 occurrence (grep obligatoire, voir section 6). |
| ATLAS-R4 | Mobile-first : chaque écran est conçu et testé sur mobile avant desktop, avec les skills `ux-mobile` + `apple-ui-designer` + `interaction-design`. |
| ATLAS-R5 | Budget de perf : First Load JS ≤ 170 Ko, LCP ≤ 2.0 s mobile sur la page explorateur (cohérent avec l'audit de perf en cours sur le reste de l'app). |
| ATLAS-R6 | RLS explicite et intentionnelle sur toute table lue par l'explorateur — jamais "RLS désactivé" par oubli. |
| ATLAS-R7 | Un test avant le correctif, rouge puis vert, pour chaque bug corrigé (pattern Z-R4 déjà en usage sur ce dépôt). |
| ATLAS-R8 | Rapport factuel uniquement : coller la vraie sortie brute du terminal (build, tests, grep), jamais de paraphrase de "ça a marché". |
| ATLAS-R9 | Aucun fallback silencieux vers une donnée fictive (pas de pattern `EXAMPLE_TRAIL`) — une donnée absente s'affiche `—`, jamais une valeur inventée. |
| ATLAS-R10 | Les deux anciennes pages restent fonctionnelles derrière un flag jusqu'à la Phase 8 — pas de suppression avant validation complète. |
| ATLAS-R11 | Aucun merge direct sur `main`, une PR par phase, même en accès complet. |
| ATLAS-R12 | `BouteilleALaMer.tsx`, `PaysCarnetsList.tsx`, `PaysClubsList.tsx` : logique métier intouchée si l'explorateur les référence. |

---

## 5. Phases

### Phase 0 — Amorçage (voir section 1 en intégralité)
**Sortie attendue :** `.opencode/` câblé et vérifié, `docs/architecture/CHANTIER_ATLAS_PLAN.md` écrit et validé (skill `writing-plans`), branche `chantier/atlas-0-fondations` créée.
**Preuve :** sortie de `opencode agent list` (ou équivalent constaté), diff du plan.

### Phase 1 — Vérité base de données
**Skills/agents à invoquer :** `supabase-postgis`, `map-geospatial`, `security-audit`, puis agent `atlas-data-layer` (ou `database-reviewer` du pack SkillsForOpenCode) pour la revue.

**Travail :**
1. Vérifier via Supabase MCP (`list_projects` d'abord pour confirmer `icxyvwzfjbflcbqukpfz`, jamais l'autre) si la migration `20260810000000_explore_trails_no_synthetic.sql` est réellement appliquée (`execute_sql` sur `information_schema.views` / définition de `explore_trails`). L'appliquer si absente.
2. Vérifier le statut RLS réel sur `hiking_routes`, `trail_metadata`, `trail_scores` via `pg_policies`/`pg_class` (jamais se fier à l'historique de migration). Ajouter une policy `SELECT` publique explicite si RLS est désactivé, verrouiller écriture au service-role.
3. Créer une fonction RPC `trails_in_viewport(min_lng, min_lat, max_lng, max_lat, zoom, simplify_tolerance)` utilisant `ST_Intersects(geom, ST_MakeEnvelope(...))` sur `hiking_routes.geom` (index GIST déjà présent : `idx_hiking_routes_geom`), retournant une géométrie simplifiée selon `zoom`.
4. Créer les vues matérialisées `country_trail_density` (count + scores moyens par pays) et `trail_density_geohash5` (comptage par grille), avec un job de rafraîchissement calqué sur le pattern existant `src/app/api/cron/refresh-country-guides/route.ts`.
5. Calculer et mettre en cache un centroïde par pays depuis le GeoJSON polygonal existant (`public/data/countries-110m.geojson`), pour remplacer la dépendance fragile à `countries_geo.geometry` (point capitale, NULL).
6. Migrer `getTrails`/`src/lib/queries/trails.ts` pour utiliser la RPC au lieu du filtre sur colonnes calculées de la vue.

**Preuve :** sortie SQL brute de la vérification RLS, `EXPLAIN ANALYZE` avant/après sur la requête viewport montrant l'usage de l'index GIST, migrations dans `supabase/migrations/` avec timestamp cohérent.

### Phase 2 — Moteur cartographique unique
**Skills à invoquer :** `nextjs-performance` (import dynamique `ssr:false`), `apple-ui-designer` + `interaction-design` (Règle Permanente), `ux-mobile`.

**Travail :**
1. Supprimer le composant mort `src/app/carte-interactive/components/InteractiveMap.tsx` (skill/agent `refactor-cleaner` ou `code-simplifier` du pack SkillsForOpenCode).
2. Créer `src/components/map/UnifiedExplorerMap.tsx` : initialisation MapLibre GL, `projection: { type: 'globe' }`, style de base cohérent avec la palette Liquid Glass (pas de tuiles satellite criardes par défaut — vérifier le rendu avec `docs/Design-tokens.md`), couche `sky`/atmosphère.
3. Chargement dynamique (`dynamic(..., { ssr:false })`) identique au pattern déjà en place dans `CarteClient.tsx`.

**Preuve :** capture Playwright du rendu initial mobile + desktop, `npx tsc --noEmit` à 0.

### Phase 3 — Palier Local (parité avec Aventure)
**Skills à invoquer :** `map-geospatial`, `ux-mobile`, `test-driven-development`.

**Travail :**
1. Brancher la RPC `trails_in_viewport` + `/api/pois` existant sur les événements `moveend`/`zoomend` de MapLibre, avec `AbortController` et debounce (~200 ms).
2. Remplacer `leaflet.markercluster` par le clustering natif MapLibre (`cluster: true` sur la source GeoJSON) pour les POI.
3. Réutiliser le panneau de détail de sentier existant et le CTA "Créer mon aventure avec l'IA" (logique intacte, seul le conteneur cartographique change).
4. Réutiliser les hooks gestuels existants (`src/hooks/useSwipe.ts`, `src/hooks/usePullToRefresh.ts`, `src/hooks/gestures/`) plutôt que d'en recréer.

**Preuve :** test e2e couvrant pan/zoom + sélection d'un sentier, capture réseau montrant l'annulation des requêtes obsolètes.

### Phase 4 — Paliers Région / Continent / Monde + choréographie caméra
**Skills à invoquer :** `interaction-design` (obligatoire pour le "feel" de la transition), `map-geospatial`.

**Travail :**
1. Couche fill des polygones pays (depuis le GeoJSON statique existant) avec interaction click → sélection pays, remplaçant `CountryGlobe.tsx`/`react-globe.gl`.
2. Couches région (clusters geohash) et continent (densité pays) branchées sur les vues matérialisées de la Phase 1.
3. `flyTo`/`easeTo` avec courbe d'accélération native MapLibre pour l'effet de dézoom continu ; pas d'animation custom réinventée.
4. Corriger le `focusPoint` de la logique de centrage pays avec le centroïde calculé en Phase 1.

**Preuve :** enregistrement vidéo ou séquence de captures Playwright du zoom local → globe, revue par le skill `interaction-design`.

### Phase 5 — Nettoyage & durcissement
**Skills/agents à invoquer :** `security-audit`, `nextjs-performance`, agent `silent-failure-hunter` (pack SkillsForOpenCode), agent `a11y-architect` ou skill `accessibility`.

**Travail :**
1. Rate limiting sur `/api/hikes` et `/api/pois` (fenêtre glissante par IP) + plafond serveur sur la taille de bbox combinée à `limit`.
2. Une fois la parité fonctionnelle confirmée (Phases 3-4 validées), retirer `leaflet`, `leaflet.markercluster`, `react-globe.gl` du `package.json` et vérifier le gain sur le First Load JS (budget ATLAS-R5).
3. Audit `silent-failure-hunter` sur tout le nouveau code pour traquer un éventuel pattern de repli silencieux (type `EXAMPLE_TRAIL`).
4. Accessibilité : alternative clavier/lecteur d'écran pour la sélection de pays (le globe seul n'est pas navigable au clavier), respect WCAG sur les contrôles de zoom.

**Preuve :** rapport de bundle avant/après, résultat de l'audit `silent-failure-hunter`, résultat d'audit a11y.

### Phase 6 — Conformité design & QA multi-perspective
**Agent à invoquer :** `atlas-conformite-lg` (clone de `pays-conformite-lg.md`), puis commandes `/icon-review` existantes.

**Travail :**
1. Checklist grep de conformité Liquid Glass sur les nouveaux fichiers (`src/components/map/**`), sur le modèle exact de `pays-conformite-lg.md` :
```bash
rg -n "#E4501C|#1C2620|#2D5A3D|#0B1F17|#0F2A22|#08150F|#A8C4A2|#C89A5A|#E4C695" src/components/map src/app/carte-interactive
```
2. Vérification `npx tsc --noEmit`, `npm run lint`, `npm run build` à 0.
3. Revue multi-perspective avant lancement mondial via les Icon Agents déjà installés dans ce dépôt : `/icon-security-review`, `/icon-design-review`, `/icon-programming-review`, `/icon-platform-operations-review`, puis `/icon-review` global pour la synthèse finale.

**Preuve :** sortie brute des 4 greps (0 occurrence attendue), sortie brute des 3 commandes de build, synthèse des Icon Agents collée telle quelle.

### Phase 7 — Rollout mondial progressif

Ne pas basculer 100 % du trafic d'un coup sur une fonctionnalité qui remplace deux pages flagship. Étendre le système de feature flags **déjà existant** (`src/features/hub/server/featureFlags.ts`, RPC `current_feature_flags()`) avec un nouveau flag `explorer_unified_map_enabled` plutôt que d'inventer un mécanisme parallèle.

Paliers : interne (équipe) → 5 % → 25 % → 100 %, avec surveillance des erreurs/perf sur chaque palier avant de passer au suivant. Les anciennes pages `/carte-interactive` et `/pays` restent joignables tant que le flag n'est pas à 100 % stable (ATLAS-R10) — c'est le mécanisme de rollback instantané en cas de problème en production.

**Preuve :** migration ajoutant le flag, capture des métriques du palier interne avant passage au palier suivant.

---

## 6. Checklist de conformité Liquid Glass (à exécuter à la fin de chaque phase touchant l'UI)

```bash
rg -n "#E4501C" src/components/map src/app/carte-interactive src/app/pays
find src -iname "*.bak" -o -iname "*.old" -o -iname "*_OLD*"
npx tsc --noEmit
npm run lint
npm run build
```
Tout résultat non nul est un blocage de phase, pas une note pour plus tard.

---

## 7. Format de rapport attendu (fin de chaque phase)

Ajouter une entrée à `MISSION_LOG.md`, dans le même format que les entrées existantes (branche, commit, résultat technique avec sortie brute des tests/build, tables/RLS concernées). Ne jamais résumer un résultat de test — coller la sortie réelle du terminal.

---

## 8. Definition of Done — chantier ATLAS

- [ ] Les 4 paliers de zoom fonctionnent dans un seul canvas MapLibre, sans coupure visuelle.
- [ ] `EXPLAIN ANALYZE` prouve l'usage de l'index GIST sur la requête viewport.
- [ ] RLS explicite vérifiée sur toutes les tables lues.
- [ ] 0 occurrence de couleur bannie, `tsc`/`lint`/`build` à 0.
- [ ] First Load JS ≤ 170 Ko et LCP ≤ 2.0 s mobile sur la page explorateur.
- [ ] Rate limiting actif sur `/api/hikes` et `/api/pois`.
- [ ] Flag `explorer_unified_map_enabled` créé, rollout par paliers documenté, rollback possible à tout moment.
- [ ] Synthèse Icon Agents (`/icon-review`) sans blocage critique non résolu.
- [ ] Anciennes pages Leaflet/`react-globe.gl` supprimées uniquement après le palier 100 % stable.
