# DATA_FLOWS_AND_ENGINES — Moteurs, Hooks & Utilitaires Déjà Codés

> **Règle d'or** : Avant d'écrire une fonction de calcul, un hook de geste, un upload média ou un appel API, vérifie ici — **il existe probablement déjà dans LKDV**.

---

## 1. Moteurs Télémétrie, Sport & Physiologie (`src/features/explorer-v2/` & `src/lib/`)
- **`summaryAnalysisEngine.ts`** (`src/features/explorer-v2/redesign/summary/`) — Orchestrateur pur TS connectant **20+ moteurs** :
  - `analyzeOutingTelemetry`, `activityMetrics`, `powerCurve` (`cycling-physics-v1` MMP/FTP)
  - `computeSlopeAdjustedPace` (Minetti 2002 GAP), `computeEffortScore` (LCDA + 6 piliers Shapley), `computeFatigue`
  - `analyzeClimbs` (Cat 1–5, VAM), `analyzeDifficulty`, `sortiePerformanceEngine` (IBP / km-Effort / P50–P90)
  - `computeSessionLoadUnits` (sRPE), `computeTrainingLoad` (Banister CTL/ATL/TSB Avant→Après)
  - `computeExplorerReadiness` (EWMA ACWR, dette 96h, DOMS excentriques 18–48h, acclimatation 21j), `scoreOutingFit`
  - `extractCleanRunningBestEffortsFromTrace`, `computeRacePredictions` (Riegel), `findComparableOutings`, `detectOutingHighlights`
  - `computeOfflineDaylight` (NOAA offline), `computeThermalStress`, `estimateHydrationLiters`, `buildRecoveryProgram` (0–48h)
  - `buildAiActivityInsightPayload` (RGPD Art. 9 strictement opt-in)
- **`useSummaryExpertAnalysis.ts`** — Hydratation IndexedDB (`readSessionPoints`), historique offline 2 niveaux, backfill AWS Terrarium DEM 1-tap, seuils `fcMax`/`fcRest`/`ftpW`/`vmaKmh`, détection opt-in `/api/segments/detect`.
- **`outingHandoff.ts`** (`src/features/explorer-v2/outingHandoff.ts`) — Sérialisation complète d'une sortie GPS pour auto-remplir les 6 formulaires Communauté V2.

## 2. Cartographie 3D, Routage & Open-Data (0 €)
- **`crates/lkdv-route-core`** — Crate Rust/WASM pour géométrie et routage haute performance côté client.
- **`/api/explorer/v2/outdoor-routes`** — Proxy Waymarked Trails / OSM (`hiking`, `cycling`, `mtb`, `slopes`, GeoJSON live, `0 €`).
- **AWS Terrarium DEM pur JS** — Décodage altitude PNG compatible Cloudflare Workers (`vinext`).
- **`src/components/clubs/map/clubTrackGeometry.ts`** — `buildOutingTrackGeometry`, `snapPointAlongTrack`.
- **`src/features/compte/map/geometry.ts`** — `boundsOf`.

## 3. Médias, Profils, Partage & Auth
- **`stripImageMetadata`** (`src/lib/media/stripImageMetadata.ts`) — Nettoyage EXIF obligatoire avant upload image.
- **`storyMediaUrl`** / **`replyToStory`** (`src/lib/stories/`) — URLs signées et réponses Stories.
- **`fetchPublicProfilesWith`** (`src/lib/queries/publicProfilesCore.ts`) — Chargement batch optimisé des profils publics (avatars, noms, trust score).
- **`usePostShareTargets`** (`src/features/community/feed/usePostShareTargets.ts`) — Liste des conversations Messagerie + envoi en 1 tap.
- **`useAuth`** (`src/contexts/AuthContext.tsx`) & **`createClient`** (`src/lib/supabase/client.ts`).

## 4. Interactions Tactiles, Haptique & Feedbacks
- **`useDragDismiss`** (`src/hooks/gestures`) — Fermeture verticale fluide sur encoche/drawer.
- **`useHapticFeedback`** (`src/hooks/useHapticFeedback.ts`) — Retour haptique Capacitor aligné sur les crans et validations.
- **`useToast`** (`src/contexts/ToastContext.tsx`) — Feedbacks globaux standardisés (`success` / `error`).
- **`useCarnetDialog`** / **`useClubDialog`** — Pose `body.lkdv-dialog-open` pour masquer `.lkdv-floating-tabbar`.
