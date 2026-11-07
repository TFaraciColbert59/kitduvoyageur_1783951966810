# Journal des décisions — Fiche Carnet v2

Format : Date | Décision | Contexte & Raison | Alternative écartée

---

## 2026-11-07 — Démarrage et initialisation de la mission

- **2026-11-07 23:00 — Création de la branche et initialisation**
  - **Décision :** Branche de travail créée à partir de `main` : `feat/carnet-v2`. Le bundle handoff est importé sous `handoff/carnet-v2/`.
  - **Raison :** Conforme aux consignes de `00-MISSION.md` et `04-PLAN-IMPLEMENTATION.md`.
  - **Alternative écartée :** Travailler directement sur `main` (interdit par les garde-fous).

- **2026-11-07 23:05 — Phase 0 : Audit des portes qualité initiales**
  - **Résultats :**
    - `npx tsc --noEmit -p .` : Vert (0 erreur).
    - `npm run lint` : Vert (0 erreur).
    - `npx vitest run tests/design/unification.spec.ts` : Vert (5/5).
    - `npm run verify:invariants` & `npm run verify:icons` : Vert après alignement de 3 incohérences d'icônes legacy (`StoriesViewer.tsx` share2/trash2, `CarnetTile.tsx` message-square, suppression du SVG path non utilisé dans `MessagesScreen.tsx`).
    - `npm run perf:budget` : Vert sur toutes les surfaces.
    - Tests existants du carnet (`src/components/carnet` & `src/features/carnet`) : 26 fichiers, 287 tests tous verts (dont `CarnetPostSheet.test.tsx` ajusté pour le décodage d'URL Next.js Image).
    - Tests généraux du dépôt : 1164 fichiers / 13752 tests unitaires passent. 38 fichiers de tests plus anciens ou nécessitant Chromium Playwright / base Supabase étaient déjà rouges ou en échec hors carnet.

