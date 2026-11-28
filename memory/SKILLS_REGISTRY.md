# SKILLS_REGISTRY.md — Routeur de Skills & Auto-Promotion LKDV
<!-- Budget max : 100 lignes | L'agent choisit automatiquement les skills ici sans que le fondateur ait à les nommer -->

## Skills de Démarrage (Déclenchement Automatique)

| Situation détectée | Skill / Outil à activer automatiquement | Quand |
| :--- | :--- | :--- |
| Nouvelle feature, refonte, idée créative ou architecture | **`/brainstorming`** + **`/plan`** | Toujours avant d'écrire du code non trivial |
| Librairie, framework, API (Next 15, React 19, MapLibre, Supabase, Three.js, Capacitor) | **`context7-mcp`** (`resolve-library-id` + `query-docs`) | Avant d'écrire/debugger du code dépendant d'une lib |
| Algorithme complexe, physio sport, GIS, perf, concurrence, pattern avancé | **Recherche Web / Papiers scientifiques / GitHub** (`search_web`) | Avant d'inventer dans le vide — apprendre des meilleurs |
| UI, écran, composant, design polish ou audit visuel | **`docs/06-design-system/DESIGN_SYSTEM.md`** (`Carnets` + `Clubs`) + `frontend-ui-engineering` / `impeccable` | Systématiquement pour toute touche UI |
| Bug, régression, test cassé ou comportement inattendu | **`systematic-debugging`** / **`debugging-and-error-recovery`** | Cause racine d'abord, jamais de patch aveugle |
| Vérification visuelle live d'une page/app web | **`browser` subagent** (`Model="flash"`) | Après tout changement UI/route sur `http://localhost:3001` |
| Tâche complexe nécessitant validation avant clôture | **`verification-before-completion`** | Preuve réelle (tests/build/QA) avant d'affirmer "fini" |
| Travail parallèle sur plusieurs modules | **`~/LKDV/scripts/spawn-agent-slot.sh`** (`~/LKDV/worktrees/`) | Dès que 2+ chantiers indépendants tournent en même temps |

## Skills & Patterns Promus (Auto-Découverts)
<!-- Règle d'auto-promotion (Hermes) :
Quand une tâche complexe amène à découvrir un excellent skill (marketplace, GitHub, doc) ou un pattern qui fait gagner un temps majeur sur LKDV :
1. Le tester et valider sur un cas réel LKDV.
2. Stocker sa fiche courte dans ~/LKDV/library/skills/ ou ~/LKDV/library/patterns/.
3. Ajouter une ligne ici (nom, source, déclencheur). Purger si inutilisé > 60 jours. -->

- **`lkdv-3d-map-assets`** (local) — Pipeline Meshy AI + `gltf-transform` Draco/WebP + Three.js r186 pour dioramas 3D carte.
- **`explorer-gis-architecture`** (local) — Hiérarchie multi-échelles, budgets GPU 60 FPS et déchargement HUD GPS temps réel.
- **`global-open-apis-catalog`** (local) — Catalogue strict `0 €` (Waymarked Trails, Overpass, Open-Meteo, AWS Terrarium DEM, NOAA).
