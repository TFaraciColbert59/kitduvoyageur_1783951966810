# Programme Qualité & Grande Échelle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development / executing-plans. Steps use checkbox syntax.

**Goal:** Audit total (hors 16 pages marketing/légal) → correctifs P0/P1 + 4 suites réparées → fluidité/polish UX → durcissement échelle → runbook déploiement.

**Spec:** `docs/superpowers/specs/2026-09-13-programme-qualite-echelle-design.md`

## Global Constraints

- WIP propriétaire jamais stagé (`src/app/hub/[section]/page.tsx`, `HubRealtimeRefresh.tsx`, captures) ; staging explicite.
- Design : skills `ux-mobile`, `apple-ui-designer`, `interaction-design` ; gardes H-D85 ; 44 px ; `prefers-reduced-motion`.
- Gates : `tsc` 0 · `lint` 0 · `vitest` 100 % vert · `build` ✓ · e2e 7/7 · visuel 3 projets · harnais pgTAP si migrations.
- Un commit par task. Aucune régression des acquis (TRIBU, préparer, atlas, fluidité).

---

## Lot A — Audit global

### Task A1: Script d'audit `scripts/audit/global-audit.mjs`
- [ ] Résolution des fixtures via REST service-role (trail, club, produit, carnet, voyage, lieu, outil).
- [ ] Matrice routes (statiques + dynamiques), passe anon + passe connectée (y-demo).
- [ ] 3 devices, captures plein écran, collecte HTTP/pageerror/console/liens.
- [ ] Sorties `docs/audit-global/captures/**` + `findings.json`.
- [ ] Commit.

### Task A2: Exécution + rapport
- [ ] Dev server actif (4000) + script exécuté (anon + auth).
- [ ] `rapport.md` P0/P1/P2 + synthèse console.
- [ ] Commit.

---

## Lot B — Correctifs

### Task B1: 4 suites rouges → vertes
- [ ] Diagnostic (`systematic-debugging`) de `a13-backtest-export`, `a14-healthcheck`, `a15-rollout`, `phase10-capacity`.
- [ ] Correctifs code/tests ; preuve `npx vitest run` 100 % vert.
- [ ] Commit.

### Task B2: P0 du rapport
- [ ] Chaque P0 : test rouge → fix → vert ; garde visuel/e2e si UI.
- [ ] Commits dédiés.

### Task B3: P1 du rapport
- [ ] Batch par domaine (hub, explorer, préparer, clubs, commerce, compte) ; tests + captures avant/après.
- [ ] Commit.

---

## Lot C — Fluidité & polish

### Task C1: Mesures perf par route
- [ ] Poids JS/route (build), traces LCP/INP/CLS sur 5 routes clés ; budget documenté.
### Task C2: Corrections perf
- [ ] Waterfalls/imports/images ; re-mesure ; commit.
### Task C3: Polish UX (3 skills)
- [ ] États vides/erreurs/loading, micro-interactions, transitions, densité ; captures avant/après ; commit.

---

## Lot D — Durcissement échelle

### Task D1: Rate limiting distribué (Postgres/RPC) + tests
### Task D2: `vercel.json` (crons versionnés) + env `CRON_SECRET` documenté
### Task D3: `/api/health` + error tracking applicatif (`client_errors`) + doc dashboards
### Task D4: Charge re-mesurée (build prod local) + restore backup prouvé
### Task D5: Cache headers routes publiques stables

---

## Lot E — Déploiement

### Task E1: Runbook + checklist env + smoke post-deploy scripté
### Task E2: `A15_LAUNCH_READINESS` mis à jour (statuts + blocages externes)
### Task E3: Gates finaux, `MISSION_LOG`, rapport final, merge `--no-ff`, push
