# PHASE 11 — Plan de rollback

**Date :** 2026-09-12
**Branche :** `feat/phase11-mobile-build` — base `64b225a6` (= `origin/main`)
**Principe :** la Phase 11 n'apporte que **configuration Android sans secret,
documentation et rapports**. Aucune migration, aucun déploiement, aucune
écriture de données, aucun envoi réseau, aucun secret versionné. Le rollback
applicatif est un simple revert ; le keystore et l'AAB vivent **hors du dépôt**
et ne sont pas concernés par Git.

## 1. Application (rollback recommandé)

```bash
git revert <commit_phase11>   # retour à l'état 64b225a6
```

Effets du revert :

- `android/app/build.gradle` revient au fichier Capacitor d'origine (plus de
  lecture `keystore.properties`, plus de `signingConfigs.release`) ;
- `android/keystore.properties.example` disparaît ;
- `android/.gitignore` revient aux lignes keystore commentées ;
- les docs `docs/mobile/*` et rapports `docs/reports/PHASE_11_*` partent avec le
  revert ;
- le projet Android **reste compilable** : sans câblage de signature,
  `bundleRelease` produit un AAB **non signé** (à ne pas publier).

Alternative sans revert : ne pas fusionner la branche (aucun impact tant qu'elle
n'est pas déployée). Aucun autre code n'importe ces fichiers (config Gradle et
docs uniquement) — vérifié.

## 2. Secrets et keystore

- Le keystore (`C:\Users\Tony\AppData\Local\Temp\opencode\lkdv-release.keystore`)
  et ses mots de passe (`lkdv-keystore.txt`) sont **hors dépôt** : un revert Git
  ne les touche pas.
- **Conserver** keystore + mots de passe même en cas d'abandon : ils
  conditionnent les mises à jour Play. Le rollback ne doit **jamais** les
  supprimer ; en cas de fuite ou perte de contrôle, la rotation passe par
  Google Play App Signing (procédure humaine).
- `android/keystore.properties` et `android/local.properties` (locaux, ignorés)
  peuvent rester en place ; les supprimer n'empêche que la signature locale.
- Aucun secret n'a jamais été commité (preuve : `git check-ignore -v`), donc
  **rien à purger dans l'historique**.

## 3. Artefacts de build

- L'AAB n'est **pas** versionné (`android/.gitignore` ignore `*.aab`) ; il se
  régénère par `npx cap sync android && gradlew bundleRelease`.
- La copie temp `C:\Users\Tony\AppData\Local\Temp\opencode\lkdv-app-release.aab`
  peut être supprimée sans effet sur le dépôt ; elle sert de preuve locale
  (SHA-256 consigné dans `PHASE_11_VERIFICATION.md`).
- Le SDK Android, les JDK et le cache Gradle sont dans le profil utilisateur et
  le dossier temp : leur suppression n'affecte pas le dépôt (réinstallation
  documentée dans `docs/mobile/ANDROID_RELEASE.md`).

## 4. Stores et iOS

- **Aucune publication n'a eu lieu** : rien à retirer d'une console.
- Aucun upload, donc aucune version à retirer côté Play ; aucun TestFlight.
- Si un jour un AAB défectueux était publié, le rollback Play est une
  **nouvelle version** avec `versionCode` incrémenté (ou un halt de rollout),
  pas un revert Git — procédure humaine, hors Phase 11.

## 5. Mapping avec le journal de preuve (§10 du chantier)

| Exigence §10 | Application Phase 11 |
|---|---|
| SHA testé | `64b225a6` (base) + branche `feat/phase11-mobile-build` (SHA poussé consigné dans `PHASE_11_RESULTS.json`) |
| Environnement | Windows non admin, JDK 21/17, SDK 36, Gradle 8.14.3 |
| Commandes exécutées | consignées (sync, gradle, jarsigner, npm) |
| Résultats | AAB signé, `jarsigner` exit 0, npm verts |
| Captures ou artefacts | AAB temp + SHA-256, certificat, logs ; aucun binaire versionné |
| Limites | stores, iOS, appareils, calibration = `INSUFFICIENT_DATA` |
| Risques résiduels | taille AAB, test flaky, sauvegarde keystore |
| Responsable | agent MOBILE/QA ; humain pour stores/iOS/terrain |
| Date | 2026-09-12 |
| Décision | `PASS` local ; `INSUFFICIENT_DATA` hors périmètre local |

## 6. UI / baselines

**Aucune UI modifiée → aucun snapshot visuel à restaurer ni à régénérer.**

## 7. Production

- Rien n'est déployé : branche poussée pour revue, **pas de PR**, `main` non
  touchée.
- Aucun changement runtime (web, API, DB, Stripe) : le comportement de
  production est identique avec ou sans cette branche.

## 8. Verdict

- Rollback **trivial et sans risque de perte** (config/docs uniquement).
- Les éléments `INSUFFICIENT_DATA` (stores, iOS, appareils, calibration) ne
  créent **aucune dette de rollback** : ils n'ont jamais été revendiqués comme
  faits.
- Le seul actif non-dépôt à préserver est le **keystore** (sauvegarde coffre
  obligatoire, cf. §2).
