# Programme Qualité & Grande Échelle — Design Spec

Date : 2026-09-13 · Lots : A (audit) → B (correctifs) → C (fluidité/polish) → D (durcissement) → E (runbook)

## 1. Goal

Auditer, corriger, fluidifier et durcir **toute l'application** (hors 16 pages marketing/légal listées ci-dessous) pour un déploiement à grande échelle : zéro bug bloquant, zéro incohérence visible, perfs mesurées, CI verte, durcissement code complet.

**Hors périmètre** : `/manifeste`, `/blog`, `/guides(+/[slug])`, `/experts`, `/createurs`, `/ambassadeurs`, `/pro`, `/communaute-pro`, `/avis`, `/contact`, `/faq`, `/cgu`, `/cgv`, `/cookies`, `/mentions-legales`, `/politique-confidentialite`.

## 2. Règles design (Règle Permanente AGENTS.md)

- **apple-ui-designer** : natif > custom, calme, hiérarchie par taille/poids, translucidité, safe areas, bottom sheets, pas de sur-design.
- **ux-mobile** : feedback immédiat, 44 px, skeletons/états vides/erreurs jamais blancs, motion court et utile.
- **interaction-design** : palette `#0B1F17`/`#17402C`/`#2D6B4A`/`#A3C4A3`/`#FBFAF6`, **jamais `#E4501C`**, animations `transform`/`opacity` uniquement, `prefers-reduced-motion`, timings 100-450 ms.
- Gardes existants : H-D85 (R1 familles Tailwind interdites, R2 hex bruts) + tokens `--lkv-*`/`.glass*`.

## 3. Lot A — Audit global (lecture seule sur le code)

- Script `scripts/audit/global-audit.mjs` (Playwright chromium) : matrice de routes (statiques + dynamiques résolues par fixtures via REST service-role), 3 devices (1440×900, 430×932, 834×1194), deux passes (anonyme + connectée y-demo).
- Par route : HTTP, `pageerror`, erreurs console, liens internes cassés (échantillon), captures plein écran.
- Sorties : `docs/audit-global/captures/<device>/<route>.png`, `docs/audit-global/findings.json`, `docs/audit-global/rapport.md` (P0 bloquant / P1 incohérence / P2 polish).
- A11y : ré-exécution des specs existantes + axe sur les routes auditées.
- Perf : poids JS par route (build), traces LCP/INP sur 5 routes clés.

## 4. Lot B — Correctifs

- P0 : routes cassées, erreurs 5xx, fuites de données, faux succès, dead links, écrans blancs.
- P1 : incohérences compteurs/agrégats, affordances vs RLS, états vides mensongers, a11y critiques.
- **4 suites rouges réparées** (`a13-backtest-export`, `a14-healthcheck`, `a15-rollout`, `phase10-capacity`) : CI verte obligatoire, preuve d'exécution.
- Chaque fix : test rouge d'abord (TDD) + garde e2e/visuel.

## 5. Lot C — Fluidité & polish

- Budgets : LCP < 2,5 s mobile, INP < 200 ms, CLS < 0,1 (CPU ×4 / réseau bridé) ; caps JS par page.
- Corrections mesurées avant/après (waterfalls, dynamic imports, images, prefetch).
- Polish UX selon les 3 skills : micro-interactions, skeletons, transitions, densité, états vides/erreurs ; surfaces non alignées DS corrigées.

## 6. Lot D — Durcissement échelle (code-side)

1. **Rate limiting distribué** : remplacement des seaux mémoire par un stockage Postgres (`rate_limit_hits` + RPC) — aucune dépendance externe.
2. **Crons versionnés** : `vercel.json` (schedules + route protégées `CRON_SECRET`) pour les routes existantes + nouvelles (positions live, éphémères).
3. **Observabilité** : `/api/health` (db + version), error tracking applicatif (`client_errors` + boundary global), doc dashboards (Sentry = option externe).
4. **Charge** : re-run `scripts/ops/a15_load_test.mjs` sur build prod local ; restore backup re-prouvé.
5. **Cache** : en-têtes explicites sur routes publiques stables.

## 7. Lot E — Déploiement

- Checklist env ↔ usage réel, procédure deploy/rollback, smoke post-deploy scripté, mise à jour `A15_LAUNCH_READINESS` (statuts + blocages externes), `MISSION_LOG`, rapport final.

## 8. DoD du programme

- [ ] Audit exécuté (captures 3 devices + findings classés) et rapport commité.
- [ ] 0 P0 ouvert ; P1 traités ou justifiés.
- [ ] `npm test` **100 % vert** (4 suites réparées), tsc/lint/build verts, e2e + visuel + a11y verts.
- [ ] Budgets perf mesurés et respectés sur les routes clés.
- [ ] Rate limit distribué + crons versionnés + `/api/health` + error tracking en place.
- [ ] Runbook à jour ; merge `--no-ff` + push ; WIP propriétaire jamais stagé.
