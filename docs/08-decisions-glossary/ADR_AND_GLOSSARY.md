# 08 — Architecture Decision Records (ADR) & Glossaire LKDV

## Partie A — Décisions d'Architecture Majeures (ADR)

### ADR-001 — Migration Web vers Cloudflare Workers (`vinext`) & Retrait de Vercel
- **Statut** : Adopté (Novembre 2026)
- **Contexte** : Réduire les coûts d'hébergement (`0 €` / tarification edge), unifier le runtime edge et éviter les limites de fonctions serverless Vercel.
- **Décision** : Migrer entièrement sur `@vinext/cloudflare` (`cloudflare.config.ts`, `vite.config.ts`, décodeur PNG DEM pur JS, `empty-stub.js`). Suppression définitive de `vercel.json`, `.vercel/` et des URLs `.vercel.app` dans CI.
- **Conséquence** : Les routes `/api/cron/*` sont déclenchées par Cloudflare Cron Triggers ou GitHub Actions.

### ADR-002 — Standardisation Cartographique sur MapLibre GL + Three.js `r186`
- **Statut** : Adopté (Novembre 2026)
- **Contexte** : L'ancienne pile `react-leaflet` + `explorer-osm` ne supportait ni le terrain 3D, ni les dioramas GLB, ni le rendu 60 FPS mobile.
- **Décision** : Explorer v2 repose sur MapLibre GL + Three.js `r186` + AWS Terrarium DEM + Waymarked Trails (`0 €`). `react-leaflet` et `explorer-osm` ont été supprimés du dépôt. *(Note : 4 petits composants secondaires isolés conservent encore un import dynamique `leaflet` en attendant leur migration finale.)*

### ADR-003 — Fusion `/itineraire` → `/explorer?mode=plan` & Suppression du Hub `/carnets`
- **Statut** : Adopté (Novembre 2026)
- **Contexte** : Réduire la fragmentation de navigation et unifier l'expérience cartographique et sociale.
- **Décision** :
  - `/itineraire` redirige vers `/explorer?mode=plan` (HUD 3 detents intégré directement sur la carte 3D).
  - `/carnets` (hub) est supprimé avec une redirection `308` vers `/communaute` (`src/constants/routeRegistry.json`), tout en conservant les pages de détail `/carnets/[id]`.

### ADR-004 — Handoff Universel Post-Sortie (`outingHandoff.ts`)
- **Statut** : Adopté (Novembre 2026)
- **Décision** : Toute sortie terminée dans Explorer v2 pré-remplit automatiquement les 6 formulaires de Communauté V2 (`Carnet`, `Post`, `Story`, `Sortie`, `Kit`, `Club`) avec la télémétrie complète (distance, D+, durée, GPX, lieu, RPE, notes).

### ADR-005 — Isolation CSS `.xp20-exp-scope` pour les Sub-Drawers Portaled
- **Statut** : Adopté (Novembre 2026)
- **Contexte** : `.xp20-root` (`position: fixed; inset: 0; overflow: hidden;`) écrasait la hauteur des drawers portaled à `131 px` sur mobile.
- **Décision** : Interdiction formelle de `.xp20-root` dans `ExplorerNestedSubDrawer` ; utilisation exclusive de `.xp20-exp-scope` (`92dvh`) et reset `scrollTop = 0` sur `.xp20-nested-body`.

### ADR-006 — Nettoyage Sécurisé Supabase en Mode `RESTRICT`
- **Statut** : Adopté (Novembre 2026)
- **Décision** : Toute suppression de table passe par un audit croisé (`src/`, `pg_proc`, `pg_views`, `scripts/`, `count(*)`) et s'exécute en `DROP TABLE IF EXISTS ... RESTRICT` (jamais `CASCADE`). 31 tables vides 100 % orphelines et 2 buckets Storage vides ont été purgés sans aucune régression.

---

## Partie B — Glossaire Métier & Technique

| Terme | Définition |
| :--- | :--- |
| **ACWR (EWMA)** | *Acute:Chronic Workload Ratio* — ratio de charge aiguë (7 j) sur chronique (28 j) utilisé dans le calcul de Readiness. |
| **Banister (CTL/ATL/TSB)** | Modèle physiologique de charge d'entraînement : Fitness chronique (`CTL`), Fatigue aiguë (`ATL`) et Forme (`TSB = CTL - ATL`). |
| **Design Bank** | Source unique de tokens visuels (`src/design/bank.ts`) compilée en presets Tailwind ESM et CJS. |
| **DOMS** | *Delayed Onset Muscle Soreness* — courbatures musculaires excentriques (fenêtre 18–48 h) modélisées en descente D-. |
| **Explorer v2** | Module cartographique 3D principal (`/explorer`) intégrant carte, traceur, tracker GPS et studio d'analyse. |
| **GAP** | *Grade Adjusted Pace* — allure équivalente sur plat calculée via le modèle énergétique de Minetti (2002). |
| **IBP / km-Effort** | Indices de difficulté physique d'une sortie intégrant distance et dénivelé positif (`km + D+/100`). |
| **Kit Studio** | Studio 3D (`/kit-studio`) de composition de sac à dos et de calcul de poids/répartition. |
| **LCDA** | Score composite d'effort de la sortie décomposé en 6 piliers Shapley. |
| **Liquid Glass** | Langage visuel d'interface de LKDV (translucidité floutée, mode clair `#FBFAF6`, thèmes `dark` et `night-red`). |
| **Pokédex Nature** | Carnet naturaliste gamifié répertoriant la faune et la flore géolocalisées découvertes sur le terrain. |
| **RLS** | *Row Level Security* — contrôle d'accès par ligne au niveau PostgreSQL/Supabase. |
| **RPE / sRPE** | *Rating of Perceived Exertion* (échelle 1–10) et charge de session (`sRPE = RPE × durée en min`, en UA). |
| **Terrarium DEM** | Tuiles d'élévation publiques AWS encodées en RGB PNG (`0 €`), décodées localement en pur JS. |
| **`vinext`** | Adaptateur permettant de compiler et exécuter Next.js App Router nativement sur Cloudflare Workers. |
| **Waymarked Trails** | Réseau open-data (`0 €`) d'itinéraires balisés OSM (`hiking`, `cycling`, `mtb`, `slopes`) intégré au 6e onglet Explorer. |
