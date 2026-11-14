# DISPATCH Log

## 2026-11-13T21:14:19Z
Sender: 6796be9d-64b5-4995-96f3-d07512bb1662
Priority: HIGH

Go en autonomie compléte avec un critiques

---
Contexte complet approuvé par l'utilisateur (plan validé, prêt pour exécution complète avec vérificateur/critique indépendant) :
- Plan directeur approuvé à exécuter intégralement (Lots 0 → 5) : `/Users/fr168256/.gemini/antigravity/brain/25ed2e40-8086-4101-9dbd-3687f6e94b76/implementation_plan.md`
- Dépôt principal : `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference` (branche `codex/lkdv-integration-2026-11-11`).
- Dossier QA et captures de référence (vérité terrain iPhone 16 Pro) : `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa` (`shots/*.png`, `webshots/*.png`, `device.mjs`, `web-audit.mjs`).
- Projet Vercel : `prj_AqYb1FBEcyNGTZMVimBJXRDulyXp` (team `team_lBmtlHsEp3YQAM4hQCaWovPG`, URL `https://kitduvoyageur-1783951966810-ruddy.vercel.app`).
- Projet Supabase : `icxyvwzfjbflcbqukpfz` (`lekitduvoyageur2`).

Exigences utilisateur verrouillées (toutes les décisions `/grill-me` ont déjà été tranchées et approuvées) :
1. Exécution en autonomie complète **avec critique/revue rigoureuse** à chaque phase jusqu'à ce que tout soit fonctionnel, propre et vérifié visuellement (tests + build + Vercel + `web-audit.mjs` Playwright + `device.mjs` Appium sur iPhone réel + inspection visuelle via `read_file` des nouvelles captures).
2. Banque unique Design System (`src/design/bank.ts` + générateur) pour **toute l'app** :
   - **100 % Mode Clair Liquid Glass — Quasi zéro sombre, zéro noir (`#000`/`#101010`/`#121815`)** : toile claire `#FBFAF6` / sauge `#F5F7F3`, verres sauge/blanc (`#F0F5EE`, `#D8E5D5`, `#D3EBD9`), encres vert forêt (`#172B24`, `#17402C`, `#56665D`), actions vert LKDV (`#226148`, `#17402C`, `#5B7F55`), bordures & ombres teintées vert (`rgba(23,43,36,…)` / `rgba(23,64,44,…)`), `--g3-bg` / `CookieConsentBanner` / `404` en verre dépoli clair teinté sauge/vert. Fin de `.dark`, `liquid-ios27` sombre et `#lkdv-theme-init`. `StatusBar` en `Style.Light` par défaut.
   - Multi-cibles générées : `tokens.generated.css`, `tokens.generated.ts`, `tailwind.preset.generated.js`, `ios/App/App/DesignTokens.generated.swift`, Android Material 3 (`design_tokens.generated.xml` + `LKDVTheme.generated.kt`).
   - Nettoyage radical des 18 CSS globaux, ~4 285 `!important`, 35 variables fantômes, collision `--glass-rim`, inversion `--z-modal`, `<style>` inline, PNG masks d'icônes (1 seul `Icon.tsx` sans import direct `lucide-react`), fusion des primitives dupliquées (`1 Sheet`, `1 SegmentedControl`, `1 DynamicIslandHost` + réparation `lkvAlert`), et libellés minimaux (« icônes d'abord ») + Dynamic Island safe-area.
3. Maximisation native Apple Swift (iOS) & parité Kotlin Material 3 (Android) :
   - `UITabBar` Liquid Glass Apple sur **toutes** les routes (retirer l'exclusion `/compas`) + `LKDVAndroidTabBarHost` capsule Material 3 Kotlin Android.
   - Cible Xcode `LkdvWidgetsExtension` (ActivityKit Dynamic Island / Lock Screen) + enregistrement `LkdvLiveActivityPlugin` dans `SceneDelegate.swift` + service Live notification Android.
   - Ponts natifs branchés partout pour `UIAlertController` (.alert/.actionSheet/prompt), `UIMenu`, `UIDatePicker`, `PHPicker`, `UIDocumentPicker` GPX, `QLPreviewController`, `UIActivityViewController` partage, `SFSafariViewController`, Face ID `LAContext`, `CoreHaptics` (et équivalents Kotlin Material 3 Android).
4. Zéro mock & Données réelles + Nettoyage routes & SQL Supabase :
   - Supprimer 100 % des `DEMO_*`, `_MOCK_*`, `CLUB_PRESETS`, `Mathieu Chevrier`, fausses stories Dolomites/GR20, données Alpes/Écrins en dur, `/assets/images/no_image.png`.
   - **IMPORTANT** : NE PAS supprimer le compte démo le plus complet utilisé sur `/connexion` (`/api/demo-login`) ; conserver sa connexion sur `/connexion`. Purger par SQL ciblé sur `icxyvwzfjbflcbqukpfz` uniquement les comptes/lignes de test parasites (`ergre`, `Jdjdjd`/`Bdjdjdjd`, `traytest_*`, comptes démo secondaires autres que le compte démo officiel de `/connexion`, club `Judisid`, événements démo initiaux type `Soirée Népal`/`Rencontre vanlife`/`Rencontre Japon`, posts `CC0`).
   - Supprimer définitivement les **9 pages UI** (`/planification`, `/heatmaps`, `/segments`, `/classements`, `/rankings`, `/live-segments`, `/accessibilite`, `/carbone`, `/pays/[code]`) + `/dev/*` et tous leurs liens entrants, en conservant intacts `src/app/api/*` et `src/lib/*`.
5. Parité `/profil/[id]` ↔ `/compte` en 60/40 Liquid Glass (données publiques RLS sans réglages intimes) + marqueurs verre discrets sans texte sur `/hub` + correction de tous les défauts visuels iPhone 16 Pro listés dans `implementation_plan.md`.
6. Règle sur les modifs déjà présentes dans le working tree : vérifier `git status` / `git diff` au démarrage ; certaines ébauches précédentes (`Batch 1-3` avant le `/plan`) peuvent déjà être partiellement présentes — les auditer et les intégrer/remplacer proprement par l'architecture de la banque unique.

---
### RESTART CONTEXT (RECOVERY AFTER TEMPORARY API 429 QUOTA RESET)
- Generation: 1 (Restart of Project Orchestrator)
- Working Directory: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference`
- State Folder: `/Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/orchestrator_gen1`
- Previous Orchestrator State: `.agents/teamwork/orchestrator/`
- Prior Work Completed:
  1. Survey & Working tree audit: DONE (`.agents/teamwork/teamwork_explorer_survey_1/handoff.md`, `teamwork_explorer_survey_2/handoff.md`, `teamwork_explorer_survey_3_gen1/handoff.md`).
  2. Lot 0 Implementation: DONE (`.agents/teamwork/teamwork_worker_lot0/handoff.md`) — all 7 fixes applied, vitest 494/494 passed, tsc 0 error, and verified by `.agents/teamwork/teamwork_reviewer_lot0_1/handoff.md`.
- Immediate Objective: Review the Lot 0 artifacts / handoffs, conclude Lot 0 sign-off, and immediately dispatch Lot 1: Design System Bank (`src/design/bank.ts` + multi-target generators) with your worker & critic swarm!
