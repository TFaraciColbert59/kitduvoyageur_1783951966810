# Scope: E2E Testing Track

## Architecture
- **Target System**: Next.js App Router Web UI (`/messagerie`), Design System Bank (`src/design/bank.ts`), iOS Bridge sync (`ios/App/App/DesignTokens.generated.swift`), Appium/QA verification assets.
- **Testing Approach**: Opaque-box requirement-driven testing suite covering all functional, visual, accessibility, structural, and integration requirements.
- **Execution Environment**: Node.js / Playwright / Vitest / custom runner executable via npm/npx/node command with clean exit codes (0 on success, non-zero on failure).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Apple Primitives & Tokens Bank | Spécifications exactes Apple (-apple-system-*, continuous corners squircle, grabber 36x5pt, flou matière) dans `src/design/bank.ts` | E2E-T1..T4 | PROJECT.md F1 |
| 2 | Pure LKDV Green Palette (No Pure Black) | Élimination de #000000 et fonds sombres (#0d1117) au profit des verts LKDV (#17402C, #226148, #0B1E16, #06130D, etc.) | E2E-T1..T4 | PROJECT.md F2 |
| 3 | Swift Native Design Tokens Sync | Génération et synchronisation des tokens dans `ios/App/App/DesignTokens.generated.swift` | E2E-T1..T4 | PROJECT.md F3 |
| 4 | External Skills Integration | Intégration et validation des règles Apple HIG / design system | E2E-T1..T4 | PROJECT.md F4 |
| 5 | Header Navigation Fix | Suppression du router.push('/compte') sur "Messages" et du link cloche pour empêcher la fuite vers /compte | E2E-T1..T4 | PROJECT.md F5 |
| 6 | Filter SegmentedControl Repositioning | Intégration de SubCapsuleTabs dans le flux normal (suppression de l'overlay masquant la 4e discussion) | E2E-T1..T4 | PROJECT.md F6 |
| 7 | Split View 40/60 De-collision | Décalage horizontal et vertical éliminant les 44pt de collision msplit / mpill ; padding haut 1er message | E2E-T1..T4 | PROJECT.md F7 |
| 8 | Bottom Sheet Drawers (+ and ...) | Migration ComposerMenuSheet et ConversationOptionsSheet vers bottom sheet Apple avec grabber 36x5pt | E2E-T1..T4 | PROJECT.md F8 |
| 9 | Demandes & Empty State Fix | Suppression du double état vide, contraste WCAG bouton Nouvelle discussion, ouverture NewConversationModal | E2E-T1..T4 | PROJECT.md F9 |
| 10 | Group Chat Realtime Freeze Elimination | Suppression de setLoading(true) lors des rafraîchissements en tâche de fond (aucun squelette persistant) | E2E-T1..T4 | PROJECT.md F10 |
| 11 | Shared Post Embed Graceful Fallback | Gestion des cartes Publication indisponible avec fallback stylé marque LKDV | E2E-T1..T4 | PROJECT.md F11 |
| 12 | Reaction Emoji Overlay Bar | Affichage barre d'emojis en overlay contextuel flottant au-dessus de la bulle | E2E-T1..T4 | PROJECT.md F12 |

## Test Methodology (4 Tiers)
- **Tier 1 - Feature Coverage**: Minimum 5 test cases per feature (60 tests total). Verifies each feature requirement in isolation.
- **Tier 2 - Boundary & Corner Cases**: Minimum 5 test cases per feature (60 tests total). Edge cases, extreme values, missing data, viewport bounds, token parsing limits.
- **Tier 3 - Cross-Feature Combinations**: Minimum 12 pairwise interaction test cases. Verifies interactions between header, split-view, sheets, realtime updates, and token palettes.
- **Tier 4 - Real-World Scenarios**: Minimum 6 realistic end-to-end user journeys on iPhone 16 Pro (402×874 pt).

## Deliverables
1. `TEST_INFRA.md` at project root with methodology, runner commands, and architecture.
2. Complete test harness and test files located in `tests/e2e/` (or project standard test directory).
3. Dedicated npm test runner command (e.g., `npm run test:e2e` or `node tests/e2e/runner.mjs`).
4. `TEST_READY.md` at project root with full coverage matrix and test report.
