# FINAL_REPORT.md — Programme de sécurisation LKDV (rapport exécutif)

Date : 2026-10-09 · Référence : `main` @ `14d80de870930f454096390e1a7f6636fd105750`
Artefacts : `security-mission/` (registres, preuves, documents) · branche locale
`security/fixes-wave1` (9 commits, non poussée) · worktrees jetables `%TEMP%\opencode\`.

## 1. Ce qui a été fait

- **P0-P1** : référence figée, capabilities runtime, architecture vérifiée (123 routes API, 15 crons,
  251 migrations, 420 ENABLE RLS, 1077 policies, 264 SECURITY DEFINER, SW v4, CSP Report-Only),
  **baseline exécutée** (tsc/lint/build 0 ; vitest 6939 verts, 8 échecs préexistants identifiés).
- **P3 (4 vagues statiques)** : pouvoirs/isolation, argent, IA/offline/fournisseurs, plateforme —
  faits ancrés dans `evidence/` (wave1, wave1-completion, wave3).
- **P5** : 3 vérifications indépendantes en contexte neuf (F-003/F-008 ; lot initial de correctifs ;
  rev2 F-010/F-011 — dont une **réfutation** qui a déclenché une reprise).
- **P4** : **21 commits locaux** sur `security/fixes-wave1`, chacun avec test avant/après et suite
  complète sans régression ; après revues indépendantes (3 passes, 1 réfutation corrigée), les
  réserves finales ont été levées dans `5bfe8bc5` (CSRF hors /api, matérialisation prod F-012 par
  nouvelle migration, group-media clubs+UUID, pin `next` exact, INV-5 sans regex). PR draft #85.
- **P7** : ce rapport + RELEASE_PLAN, ROLLBACK, BACKUP_RESTORE, INCIDENT_RUNBOOK, THREAT_MODEL,
  PRIVACY_REGISTER, COMPLIANCE_MATRIX, RETENTION, diff reviewable.

## 2. Constats

**Confirmés (vérification indépendante)** :
- **F-003** — `/api/notifications/process` et `/digest` sans aucun contrôle, effets service-role
  (emails/push, mutations de livraisons) → corrigé (branche).
- **F-008** — 5 migrations seedent 31 emails avec mots de passe fixes, lisibles dans le dépôt public ;
  application en prod attestée par le ledger → migration de remédiation prête (locale, D1).

**Candidats non confirmés (sans sévérité)** : F-001 (CSRF/SameSite=None), F-002 (résiduel purge SW),
F-004 (SEED_SECRET en query), F-006 (group-media public), F-009 (template email sans échappement),
F-010 (SSRF og-preview — corrigé rev2, DNS résiduel H-032), F-011 (rétention inter-comptes — corrigé
rev2/rev3, réserves : purge différée à la déconnexion, migration 1re transition).

**Durcissements** : H-001..H-036 (rate-limit 10/123, zod 23/123, tests RLS miroirs, CSP, crons
timing-safe, dépendances critiques H-035, données médicales locales H-036, etc.).

## 3. Couverture (honnête)

- Statique : ~17 unités `checked`/`in_progress` (ledger) sur un périmètre inventorié ; unités
  dynamiques quasi toutes `planned/blocked` (pas d'accès DB distante ni d'exécution de l'app cible).
- Dynamique exécutée : baseline CI (tsc/lint/build/tests) + 5 specs de sécurité nouvelles
  (25+ tests) + reproduction indépendante. **Aucun test dynamique sur la production ni sur une base
  distante.**
- Non couvert : RLS réelle en prod, protections plateforme (WAF), comportements mobiles sur device,
  juridique (décisions humaines).

## 4. Limites et risques résiduels

DNS→privé sur og-preview (H-032) ; purge inter-comptes sans purge à la déconnexion seule (choix
documenté) ; dépendances critical Capacitor à patcher (B3) ; 8 tests CI préexistants rouges (H-019) ;
aucun workflow backup dans le dépôt ; rétention quasi non définie ; pas de vérification prod (D1).

## 5. Décisions humaines requises

| # | Décision | Éléments préparés | Bloque |
| --- | --- | --- | --- |
| D1 | Accès Supabase prod (lecture/écriture bornée) pour dry-run F-008, vérif RLS, backup | migration prête, procédures | application F-008, vérifs prod |
| D2 | Décisions juridiques (bases légales, DPA, AITD, AIPD, DPO, mineurs) | PRIVACY_REGISTER, COMPLIANCE_MATRIX, RETENTION | conformité |
| D3 | Publication : revue du diff `14d80de8..security/fixes-wave1` puis PR/merge | 9 commits + preuves | livraison |
| D4 | Politique purge à la déconnexion (invité) | revue v2, réserve 2 | F-011 final |
| D5 | og-preview : allowlist vs acceptation + auth/rate-limit | H-032 | F-010 final |
| D6 | Capacitor bump + device tests | avis critical, H-035 | binaire mobile |
| D7 | group-media privé (migration URLs) | F-006 | confidentialité groupes |
| D8 | Rétention (valeurs) + jobs de purge | RETENTION.md | privacy |

## 6. Prochaines étapes recommandées

1. Revue humaine du diff → décision D3 ; traiter B1-B4 de RELEASE_PLAN dans l'ordre.
2. Démarrer Docker + base locale pour les tests RLS réels (H-003) et rejouer le test de restauration.
3. Compléter la vague dynamique (A→B PWA/mobile, jobs notifications, SSRF) sur environnement isolé.
4. Revalider les textes UE au run de release (AI Act/CRA/NIS2) avant toute communication publique.

Aucune annonce de « sécurité validée pour lancement » n'est faite : les preuves de production
manquent (D1) et des réserves sont ouvertes (H-032, H-035, purge déconnexion).
