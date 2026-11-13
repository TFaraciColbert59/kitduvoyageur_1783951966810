# API `/api/planning` — Lot R04

Calculs sans état du contrat `src/features/planning/index.ts`. Aucun plan, partage ou
bulletin n'est persisté ici : l'appelant écrit le résultat dans sa couche de stockage.

| Route | Action | Contrat |
| --- | --- | --- |
| `GET /api/planning` | capacités | liste des actions, fuseau explicite, P01 |
| `POST /api/planning/search` | `search` | `searchMultiDayPlans` (K1.13) |
| `POST /api/planning/split` | `split` | `splitRouteIntoDays` (K2.29) |
| `POST /api/planning/boundary/preview` | `boundary.preview` | `previewStageBoundaryMove` (K2.30) |
| `POST /api/planning/boundary/commit` | `boundary.commit` | `commitStageBoundaryMove` (K2.30) |
| `POST /api/planning/lodging/anchor` | `lodging.anchor` | `anchorStageToLodging` (K2.31) |
| `POST /api/planning/weather/evaluate` | `weather.evaluate` | `evaluatePlanWeather` |
| `POST /api/planning/weather/windows` | `weather.windows` | `findOptimalWindows` |
| `POST /api/planning/shares/create` | `shares.create` | `createPlanShare` (P01) |
| `POST /api/planning/shares/revoke` | `shares.revoke` | `revokePlanShare` (P01) |
| `POST /api/planning/shares/access` | `shares.access` | `evaluateShareAccessP01` (P01) |
| `POST /api/planning/stages/launch` | `stages.launch` | `getStageLaunchReadiness` (K2.32) |

`POST /api/planning` accepte aussi `{ "action": "<action>", "payload": { ... } }`.

Les schémas Zod sont dans `_lib/schemas.ts`, l'exécution dans `_lib/actions.ts`.
Les payloads contiennent le plan, le tracé ou le `ViewerContextP01` nécessaire au calcul.
**Ces routes ne sont pas une frontière d'autorisation** : un adaptateur authentifié doit
résoudre l'utilisateur et le contexte P01 côté serveur avant de les appeler.
