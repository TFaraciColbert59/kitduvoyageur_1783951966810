# A15 — Launch readiness : échelle & lancement (statut par domaine)

Date : 2026-09-11 · Worktree : `worktrees/ai-finalization` (branche `audit/adventure-intelligence`)
Environnement : Supabase local + projet de test ; **aucune production, aucun secret commité, flags OFF**.

## Statuts

| Domaine | Statut | Preuve / blocage |
|---|---|---|
| Charge backend (proximité, conditions, lecture plan) | **Prêt (local)** — à re-mesurer en test distant | `docs/reports/A15_LOAD_TEST.md` + `A15_LOAD_TEST.json` : 3 scénarios PASS (p95 142 / 71 / 4,3 ms, 0 4xx/5xx) |
| Rollout par cohortes 1/5/20/50/100 | **Prêt (technique, local)** — bascule prod = humain | `docs/reports/A15_ROLLOUT_RUNBOOK.md` + `A15_ROLLOUT_VERIFY.json` : 5 paliers PASS, 0 divergence SQL↔TS, état restauré |
| Seuils d'arrêt A9 automatisés | **Prêt (calcul)** — 3 critères exigent des données terrain/prod | `evaluateStopCriteria` : local = `insufficient_data` (23 runs, ETA/batterie absentes) ; fixture dégradée = `STOP` exit 3 |
| Budgets/coûts | **Bloqué externe** | `docs/reports/A15_COSTS.md` : plan Supabase, tuiles, budget IA, frais Stripe à chiffrer par le propriétaire ; compteurs locaux = 0 objet/0 appel IA |
| Build web + sync Capacitor | **Prêt** | `A15_MOBILE_BUILDS.md` : `npm run mobile:build` OK (build 19,7 s, 77 pages, sync android/ios, 9 plugins) |
| Build natif Android signé | **Bloqué externe** | JDK ≥ 11 absent (Java 8), Android SDK absent → `gradlew :app:assembleDebug` échoue (sortie exacte dans `A15_MOBILE_BUILDS.md`) |
| Build iOS / TestFlight | **Bloqué externe** | Windows sans Xcode ; pas de compte Apple/signing ; `A15_MOBILE_BUILDS.md` §3 |
| Comptes stores (Apple/Google) + internal testing | **Humain/externe** | Prérequis listés dans `A15_MOBILE_BUILDS.md` §4 ; aucun compte configuré |
| Appareils physiques + batterie/réseau | **Bloqué externe** | Campagne `A12_LOAD_AND_DEVICE_TEST_PLAN.md` §2-3 (iOS compact+récent, Android milieu/haut, tablette) — aucun appareil branché ici |
| Calibration terrain multi-saisons | **Bloqué externe** | Base de test : **0 paire prédiction/réel** (mesuré) ; 20 sorties réelles minimum requises (A12 §4) |
| Juridique RGPD/AIPD/DPO | **Humain** | `A14_GDPR.md` : textes/AIPD/DPO à valider ; export/suppression prouvés localement |
| Observabilité prod (5xx, dashboards) | **Bloqué externe** | `A14_OBSERVABILITY.md` : instrumentation plateforme à brancher |
| Rate limiting distribué | **Humain/backlog** (avant a15 prod) | `A14` : seaux en mémoire à remplacer ; la route conditions documente la limite par IP |
| Flags en fin de session | **OFF** | 8/8 flags `enabled=false`, `feature_flag_cohorts` vidé après preuve rollout |

## Dépendances EXTERNES : prérequis, commande qui échoue, propriétaire, impact

| # | Élément | Prérequis exact | Commande qui échoue sans lui | Propriétaire | Impact lancement |
|---|---|---|---|---|---|
| 1 | Android natif | JDK 17 + Android SDK (platform 35, build-tools) + keystore | `cd android && gradlew.bat :app:assembleDebug` → « Dependency requires at least JVM runtime version 11 » (JDK 8 actuel) | Fondateur/tech | Pas d'APK/AAB ni de test interne Google Play |
| 2 | iOS natif | Mac + Xcode 16+, compte Apple Developer, certificat/profil | `xcodebuild` (absent sous Windows) ; TestFlight impossible | Fondateur | Pas de build iOS ni TestFlight |
| 3 | Comptes stores | Apple Developer Program + Google Play Console, fiches, confidentialité, classification | Upload TestFlight / internal testing impossible | Fondateur | Distribution store impossible |
| 4 | Appareils réels | iOS compact + récent, Android milieu/haut, tablette | Campagne batterie/GPS/perm (non exécutable sans appareils) | Produit/QA | Validation terrain et critère d'arrêt 5 non mesurés |
| 5 | Calibration terrain | ≥ 20 sorties réelles multi-profils + paires prédiction/réel | `evaluateStopCriteria` reste `insufficient_data` (critère 3) ; base test : 0 paire | Produit/terrain | ETA P90 (critère 3) non validable, palier ≥ 1 non autorisable |
| 6 | Plan Supabase prod + quotas | Projet prod, plan choisi, alertes budget | `supabase db push --db-url <PROD>` ; facturation | Fondateur/ops | Go-live backend impossible sans plan |
| 7 | Fournisseur tuiles | Compte + clé + conditions d'usage (MapTiler/Stadia/équivalent) | Serveurs communautaires OSM sans contrat : coupure/ToS au volume | Produit/tech | Carte/hors-ligne fragiles à l'échelle |
| 8 | Budget/quota OpenRouter | Compte + limite de dépense | Modèles `:free` : quota/429 sans engagement | Produit | Dégradation IA gracieuse, pas de blocage dur |
| 9 | Stripe | `STRIPE_SECRET_KEY` + 6 `STRIPE_PRICE_*` réels | `/api/billing/entitlements` → `configured:false` (vérifié absents de `.env.local`) | Fondateur | Monétisation bloquée |
| 10 | CI (migrations) | URL DB du projet de **test** + service key en secrets CI | `supabase db push` / `supabase test db` sur le projet de test | Tech | Migrations non appliquées automatiquement |
| 11 | Juridique | Validation RGPD, AIPD, DPO désigné | Checkpoint humain roadmap | Fondateur | Bloque l'ouverture publique UE |

## Conclusion

Le **code et les garde-fous d'échelle sont prêts et prouvés localement** (charge,
paliers, calcul d'arrêt, builds web). Tout ce qui reste est **externe ou humain** :
outillage natif/signing, comptes stores, appareils, calibration terrain, plan
Supabase, fournisseur de tuiles, budget IA, Stripe et validation juridique.
Aucun élément marqué « prêt » ci-dessus n'est présenté comme validé en production.
