# A7 — Rapport de vérification (Phase 7 : Hub, cockpit et offline)

Date : 2026-09-11 · Branche : `chantier/adventure-intelligence` · Commits : `d8c1a5cc`, `ec1988f6`, `8832ea0b` (+ correctif a11y `97e5ddcc`)
Statut : **RÉALISÉ**

## Livrables

| Livrable | Chemin |
|---|---|
| Spec + plan | `docs/superpowers/specs/2026-09-11-a7-hub-cockpit-offline-design.md` |
| Cockpit (domaine pur) | `domain/cockpit.ts` (projection bornée : max 3 indicateurs, max 3 actions) |
| Recalcul (domaine pur) | `domain/recalcTriggers.ts` (déclencheurs + anti-rebond 60 s) |
| Offline V2 | `offline/db.ts` (Dexie, 10 stores), `offline/operations.ts` (idempotence, migration legacy) |
| UI | `ui/AdventureCockpit.tsx`, `ui/AdventureHubSection.tsx`, `ui/OfflineBanner.tsx`, `ui/index.ts` |
| Tests | répertoire `tests/adventure-intelligence` — **35 fichiers / 233 tests** verts à la livraison |

## Preuves

| Commande | Résultat |
|---|---|
| `npx vitest run tests/adventure-intelligence` | ✅ 35 fichiers, 233 tests, 0 échec (à la livraison) |
| `npm run test` (suite complète) | ✅ verte au moment de la livraison |
| `npm run type-check` / `npm run lint` | ✅ exit 0 après chaque commit |

## Gate de sortie Phase 7 (revue indépendante : Approved, 0 Critical/Important)

- ✅ Cockpit borné : projection pure et déterministe, héro unique, ETA toujours en fourchette
  (P90 jamais sous P50), entrée vide ⇒ vue calme sans exception.
- ✅ Recalcul anti-rebond : `now − lastRecalcAt < 60 s` ⇒ aucun recalcul, signaux candidats conservés.
- ✅ Offline V2 idempotent : clé stable `kind:entityId:hash`, `dedupeOperations`, migration legacy
  sans destruction silencieuse (clé inconnue ⇒ `skipped`).
- ✅ UI prête à monter : composants autonomes, tokens `var(--lkv-*)`, cibles tactiles ≥ 44 px,
  safe-area, `prefers-reduced-motion`.
- ⏳ Montage Hub réel + tests Playwright visuels/a11y différés à la Phase 9.

## Correctif a11y

`97e5ddcc` — `role="group"` accessible pour le cockpit (revue Approved après ce correctif).

## Mineurs différés (ledger)

1. Null-guards sur l'entrée cockpit (input partiel non couvert par les tests).
2. `bg-white/60` non tokenisé dans `ui/AdventureCockpit.tsx:326` — à remplacer par un token `--lkv-*`.
3. Contrat de l'heuristique de pause (repos ≥ 2 min via `lastPositionAt` non rafraîchi) — à
   confronter au flux GPS réel.
4. Base Dexie non testée en Node (pas d'IndexedDB) — à couvrir en navigateur/Playwright en Phase 9.
