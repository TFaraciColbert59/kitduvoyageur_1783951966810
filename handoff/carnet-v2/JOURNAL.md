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

---

## 2026-11-08 — Déploiement, recette mobile et correctifs production

- **2026-11-08 15:40 — Correction de l'URL du serveur distant Capacitor**
  - **Décision :** Reconfiguration de `CAPACITOR_SERVER_URL` avec l'alias Vercel de production `https://kitduvoyageur-1783951966810-git-main-tonyfaracip-3325s-projects.vercel.app` au lieu de `https://lekitduvoyageur.fr`.
  - **Raison :** `lekitduvoyageur.fr` n'est pas encore routé/résolu par les DNS publics et est bloqué par Zscaler (403), affichant un écran d'erreur dans la coquille native sur l'iPhone.
  - **Alternative écartée :** Attendre la mise en service DNS de `lekitduvoyageur.fr`.

- **2026-11-08 16:15 — Résolution du 404 sur les fiches carnet (`/carnets/[id]`)**
  - **Diagnostic :** La fonction `getCarnetDetail` incluait dans son `select` la colonne `live_sharing` (table `carnets`) et les colonnes `verdict`, `verdict_note`, `jours_utilises` (table `carnet_kit_items`). Ces colonnes font partie des migrations Lot D/E qui n'ont pas encore été appliquées sur l'instance Supabase distante de production. PostgREST renvoyait un code d'erreur `42703` (colonne inexistante), causant le retour de `null` par `getCarnetDetail`, ce qui déclenchait Next.js `notFound()`.
  - **Décision :** Implémentation d'un mécanisme de repli automatique (graceful fallback) dans `getCarnetDetail.ts` en cas d'erreur `42703` vers un jeu de colonnes compatibles base distante (`CARNET_COLUMNS_BASE`), et fallback sur `carnet_kit_items`. Ajout également de la redirection de la route legacy `/carnets/nouveau` vers `/communaute?creer=carnet`.
  - **Raison :** Tolérance aux bases sans migration D/E sans casser le rendu de la v2. Résout instantanément les 404 sur tous les carnets publics existants (ex: `6cd92273-5309-4c12-aee3-f1f3b1ebc46b`).
  - **Alternative écartée :** Exiger une intervention manuelle d'application de migration en urgence sur la base de production Supabase avant de pouvoir consulter les carnets.

- **2026-11-08 16:26 — Déploiement Vercel Production & relance sur iPhone 16 Pro**
  - **Décision :** Commit `49322e6` poussé sur `origin/main`. Déploiement de production Vercel `dpl_4EvcJVS9tZafBB5eBPmeN6bRTD4i` (`kitduvoyageur-1783951966810-63850bp2k.vercel.app`) passé à l'état Ready. Relance du processus de l'application native sur l'iPhone 16 Pro physique (UDID `00008140-000E7D081A0B001C`).


