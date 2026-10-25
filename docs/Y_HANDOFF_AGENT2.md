# Y_HANDOFF_AGENT2 — Passation vers l'agent suivant
> Écrit le 08/09/2026 02:13. À lire INTÉGRALEMENT avant toute action.
> Ce document = état réel vérifié + ce qui reste à faire + pièges connus.

---

## 1. IDENTITÉ DU CHANTIER

| Champ | Valeur |
|---|---|
| Dépôt | `TFaraciColbert59/kitduvoyageur_1783951966810` |
| Chemin local | `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810` |
| Branche de travail | **`chantier/x-design-unique`** (jamais pousser sur `main`) |
| HEAD commit | `01d3425d` — `docs(y8): MISSION_LOG phases Y4-Y8` |
| Tags posés et poussés | `y1-done` `y2-done` `y3-done` `y4-done` `y5-done` `y6-done` `y7-done` |
| Dev server | **En cours sur port 4000** (`npm run dev`) — le réutiliser pour les tests Playwright |
| Shell | PowerShell (Windows). `&&` invalide → utiliser `;` ou deux commandes séparées |

---

## 2. ÉTAT RÉEL DES PORTES (mesuré ce jour)

| Porte | Commande | État | Preuve |
|---|---|---|---|
| **G1** Types | `npm run type-check` | ✅ exit 0 | Vérifié 02:13 |
| **G2** Unitaires | `npm test` | ✅ **1042/1042** (139 fichiers) | Vérifié 02:02 |
| **G3** Y-D80 | `npm test -- y-d80` | ✅ **12/12** | Inclus dans G2 |
| **G4** Build | `npm run build` | ✅ exit 0, `/voyages/[slug]` **144 kB** | Vérifié 02:06 |
| **G5** Visuel | `npm run test:visual` | ❌ **Non exécuté** | — |
| **G6** A11y | `npm run test:a11y` | ❌ **Non exécuté** | — |

---

## 3. CE QUI EST FAIT (ne pas refaire)

### Phases Y1 → Y7 — COMPLÈTES ET TAGUÉES

- **Y1** : `tripProfileEngine.ts` TDD 53 tests, registres sections/widgets
- **Y2** : Layout unique `[slug]/layout.tsx`, TripHubShell, 6 routes
- **Y3** : Dédoublonnage, Y-D80 12/12, code mort supprimé
- **Y4** : 12 widgets colonne droite, harmonisation 11 sections hub
- **Y5** : Navigation globale, filtres profil, mémoire section, Android back
- **Y6** : Configurateur gear panneau, ponts matériel/groupes/pays
- **Y7** : Zones sûres, cibles tactiles ≥44px, haptique, Dexie offline

### Y8 partiel (commit `62ebe901`)

- **Sécurité** : `share-actions` owner-only, `budget-actions` canManageBudget, `document-actions` canViewDocuments+canEdit, `actions.ts` 6 sites sanitisés, `api/voyages` CSRF, `go/[slug]` allowlist ALLOWED_AFFILIATE_DOMAINS
- **Performance** : `TripKitView` virtualisation TanStack Virtual (seuil 50 items)
- **A11y** : `TripSidebarLeft` focus-visible, `ActiveTripSwitcher` Cmd+K, `AlertsWidget` aria-live
- **Import dynamique Y8.2 EN COURS** : `HikingCockpitPage.tsx` modifié (voir §4) — **fichier stagé mais PAS commité**

---

## 4. FICHIER MODIFIÉ NON COMMITÉ — À TRAITER EN PREMIER

```
M src/features/hiking/components/HikingCockpitPage.tsx
```

**Ce qui a été fait :** remplacement de l'import statique de `DesktopMapOverlay` par un `dynamic()` pour briser la chaîne `HikingCockpitPage → DesktopMapOverlay → ExplorerMap → leaflet`.

**Diff appliqué :**
```diff
- import DesktopMapOverlay from './DesktopMapOverlay';
+ import dynamic from 'next/dynamic';
+ import { useHikingStore } from '../hooks/useHikingStore';
+ const DesktopMapOverlay = dynamic(() => import('./DesktopMapOverlay'), { ssr: false });
```

**Action requise :** Vérifier que `useHikingStore` est bien présent (il était absent avant et a été réinséré). Lancer `tsc --noEmit` puis `next build` pour mesurer l'impact sur le bundle `/terrain`. Commiter si vert.

### Audit complet Y8.2 (résultats réels)

| Lib | Fichier | Statut |
|---|---|---|
| `react-globe.gl` | `CountryGlobe.tsx` | ✅ déjà `dynamic()` depuis avant |
| `three` | Via `react-globe.gl` | ✅ couvert par le dynamic ci-dessus |
| `leaflet` | `ExplorerMap.tsx`, `InteractiveMap.tsx` | ⚠️ statique → dynamisé via `DesktopMapOverlay` dynamic (ci-dessus) |
| `maplibre-gl` | Non présent dans `src/` | ✅ pas de travail |
| `recharts` | Non présent dans `src/` | ✅ pas de travail |

---

## 5. CE QUI RESTE À FAIRE (100 % selon `unification.md`)

### T1 — Finir Y8.2 (imports dynamiques)
1. Vérifier `HikingCockpitPage.tsx` : `tsc --noEmit` exit 0
2. `next build` — mesurer `/terrain` avant/après (baseline avant = bundle non mesuré car changement en cours)
3. Commiter : `perf(y8): import dynamique DesktopMapOverlay — leaflet hors bundle terrain`

### T2 — G6 : `npm run test:a11y`
- Serveur dev port 4000 doit être actif (`npm run dev` si éteint)
- Config : `playwright.a11y.config.ts` → 3 projets (desktop-chrome, iphone-14-pro, ipad-portrait)
- Spec : `tests/a11y/e2e/voyages-a11y.spec.ts` → 13 surfaces × 3 viewports = 39 scans
- Critère : **0 violation `critical` ou `serious`**
- Auth demo : l'email `y-demo@lekitduvoyageur.fr` / `Ydemo!2026` est dans le spec — si les credentials échouent (Supabase distant), les tests tournent en anonyme (redirections vers login = OK, violations a11y sur pages auth = ignorées)
- **Si une violation bloquante apparaît** → corriger dans le composant fautif, re-run G1+G2 pour vérifier qu'on n'a rien cassé

### T3 — G5 : `npm run test:visual`
- Config : `playwright.visual.config.ts` → 2 projets (desktop-chrome, iphone-14-pro)
- Specs visuels existants : `tests/visual/voyages-y-profiles-visual.spec.ts` (7 cas y-*) + specs existants
- **Les snapshots y-profiles n'existent pas encore** → première run crée les références
- **PROTOCOLE OBLIGATOIRE** : inspecter CHAQUE capture visuellement avant d'accepter
- Commande : `npm run test:visual -- --update-snapshots` UNIQUEMENT sur les nouvelles specs, JAMAIS sur les specs existantes (risque de régression silencieuse)
- Planche de contact : `npm run visual:sheet` → `docs/visual/contact-sheet.html`

### T4 — Y8.4 : Revue code diff

```powershell
git diff main...chantier/x-design-unique --stat
git diff main...chantier/x-design-unique -- "src/app/voyages/**" "src/features/trips/**" | head -200
```

Recenser chaque fichier, identifier les risques résiduels. La revue alimente le rapport Y9.3.

### T5 — Y9.1 : 6 portes intégrales

Exécuter DANS L'ORDRE :
1. `npm run type-check` → copier la sortie
2. `npm test` → copier compteur final
3. `npm test -- y-d80` → copier les 12 lignes
4. `npm run build` (sans `.env.local`) → copier les tailles de route
5. `npm run test:visual` → copier le résultat
6. `npm run test:a11y` → copier le résultat

**Pas de `.env.local` pour G4.** Si le fichier existe : `Move-Item .env.local .env.local.bak` avant le build, puis restaurer après.

Parcours e2e : le spec existe en `scripts/e2e/voyage.spec.ts` ou `tests/`. Si pas de spec e2e Playwright dédié aux 5 parcours, les documenter comme **non exécutés** dans le rapport (jamais "validés" à la place).

Test natif Android : **non exécutable par l'agent** (pas d'environnement Android). À mentionner explicitement comme NON EXÉCUTÉ dans Y_REPORT.md.

### T6 — Y9.3 : `docs/Y_REPORT.md`

Modèle en §12 de `unification.md`. Sections obligatoires :
1. Identité (SHA départ `ce605ac0` → SHA final, dates)
2. Décisions arbitrées (depuis `docs/Y_DECISIONS.md`)
3. Bilan suppressions (fichiers supprimés + tailles)
4. État 12 règles Y-D80
5. Mesures de contraste
6. Bilan visuel (nombre captures, masques justifiés, chemin planche)
7. Bilan a11y (surfaces, viewports, violations par gravité)
8. Bilan performance (tableau avant/après par route, LCP, nav inter-sections)
9. Bilan sécurité (chaque point Y0.7)
10. Parcours (5 parcours × 2 viewports)
11. Natif (NON EXÉCUTÉ — justification)
12. Compteurs (tests départ vs arrivée)
13. Sorties brutes des 6 portes horodatées
14. Ce qui reste ouvert (PR #31, fusion main, protection branche)

**Chaque chiffre = valeur réelle des commandes exécutées. Jamais recopier `unification.md`.**

### T7 — Y9.4 + tag + push final

1. Tag `y8-done` : `git tag y8-done HEAD`
2. Commit `docs(y9): Y_REPORT.md + corps de PR — recette finale chantier Y`
3. Push : `git push origin chantier/x-design-unique` ; `git push origin --tags`
4. Générer le corps de PR (pour que Tony colle sur GitHub) : depuis `Y_REPORT.md`, extraire les sections pertinentes

---

## 6. CONTRAINTES NON NÉGOCIABLES

1. **Jamais `main`.** Tout sur `chantier/x-design-unique`.
2. **`gh` indisponible** → fusion PR#31, création `chantier/y-hub-voyage`, fusion finale = **action manuelle Tony** à signaler dans le rapport.
3. **Convention commit** : `<type>(y#): pourquoi` + corps + `Portes: G1 ✅ G2 ✅ (n) G3 ✅ G4 ✅ G5 ✅ G6 ✅` + `Preuves: <sorties>`. Un commit par sous-phase.
4. **Interdits absolus** : `--update-snapshots` sans inspection ; ignorer/skip un test ; réduire le compteur sans déclaration ; modifier un token hors `DESIGN_TRUTH.md` ; écrire "validé" sans preuve.
5. **Windows PowerShell** : chemins avec `[slug]` → entre guillemets. `&&` invalide → utiliser `;`.

---

## 7. FICHIERS CLÉS À LIRE

| Fichier | Pourquoi |
|---|---|
| `unification.md` | Source de vérité du plan — §5 (tests), §6 (phases Y8/Y9), §9 (modèle rapport) |
| `docs/Y_DECISIONS.md` | Arbitrages tranchés — ne pas re-décider |
| `docs/Y_SECURITY.md` | Risques sécurité — ce qui a été corrigé vs ce qui reste |
| `docs/Y_HUB_SPEC.md` | Spec du hub (widgets, sections, classes) |
| `tests/a11y/e2e/voyages-a11y.spec.ts` | Spec G6 — 13 surfaces |
| `tests/visual/voyages-y-profiles-visual.spec.ts` | Spec G5 y-profiles |
| `tests/visual/_helpers/prepareVisualPage.ts` | Helper partagé visuels |
| `playwright.a11y.config.ts` | Config G6 — 3 projets |
| `playwright.visual.config.ts` | Config G5 — 2 projets |
| `docs/MISSION_LOG.md` | Log de mission — ajouter une entrée à la fin |
| `AGENTS.md` | Règles permanentes agent (Apple HIG, Superpowers) |

---

## 8. PIÈGES CONNUS

- **`&&` en PowerShell** → utiliser `;` à la place, ou deux commandes séparées
- **Chemins avec `[slug]`** → toujours entre guillemets : `"src/app/voyages/[slug]/"`
- **`CRLF warnings` git** → normal (LF→CRLF), sans gravité
- **Le build G4 doit tourner SANS `.env.local`** → déplacer temporairement si présent
- **`npm run test:visual` avec `--update-snapshots`** → UNIQUEMENT sur les NOUVELLES specs sans snapshot. Les specs existantes ont des snapshots de référence — ne jamais les écraser sans inspection.
- **Dev server port 4000** → Playwright le réutilise (`reuseExistingServer: true`). S'il est éteint, le démarrer avant les tests Playwright.
- **Auth demo Supabase** → si `y-demo@lekitduvoyageur.fr` n'existe pas, les tests a11y tournent en anonyme. Accepté : l'important c'est que les pages publiques/login soient sans violation.

---

## 9. SÉQUENCE FINALE RECOMMANDÉE

```
1. git add + git commit (HikingCockpitPage.tsx — Y8.2 dynamique)
2. npm run type-check      → G1 ✅
3. npm run build           → G4 mesure /terrain avant/après
4. npm run dev             → s'assurer port 4000 actif
5. npm run test:a11y       → G6 (39 scans)
6. npm run test:visual     → G5 (snapshots y-profiles = nouvelles)
7. npm run visual:sheet    → planche contact-sheet.html
8. npm run type-check      → G1 final
9. npm test                → G2 final (1042+)
10. npm test -- y-d80      → G3 final
11. npm run build           → G4 final (sans .env.local)
12. Rédiger docs/Y_REPORT.md
13. git tag y8-done HEAD
14. git commit docs(y9): Y_REPORT.md + corps PR
15. git push origin chantier/x-design-unique
16. git push origin --tags
```

---

*Fin de la passation. Bonne route.*
