# Matrice d'acceptation — état au 2026-11-01

Règle appliquée : un statut `complet` n'est posé que s'il repose sur une preuve **exécutée dans cette session** (nom du test ou de la commande). Tout le reste est `non vérifié` ou `bloqué`, avec sa cause. Aucune ligne n'est cochée « parce que le code a l'air bon ».

Dernière exécution : 208/208 tests passés sur `src/features/kit-studio`, `src/features/hub`, `src/features/materiel`, `src/lib/materiel`, `src/app/api/materiel`, `src/app/api/kit-studio`, `src/components/ui`, `tests/design/h-d85-guard.spec.ts`. `tsc --noEmit` : 0 erreur. `npm run lint` : 0 erreur. `npm run build` : exit 0.

## I0 — correctif de perte de données (branche `correctif/lot-l0-data-integrity`)

| Exigence | Statut | Preuve nommée |
|---|---|---|
| Renommer un kit ne vide pas ses articles (A-01) | **complet** | `KitManager.test.tsx › renommer un kit ne vide pas ses articles` ; **mutation vérifiée** : si `items` est toujours envoyé, le test échoue |
| Ouvrir l'édition remplit les cases depuis `k.items` | **complet** | `KitManager.test.tsx › ouvrir l'édition d'un kit à 2 articles → 2 cases cochées` ; **mutation vérifiée** : si le semis est retiré, le test échoue |
| PATCH distingue absent / vide / avec drapeau | **complet** | `kits-patch.test.ts` (5/5) |
| Synchro hors ligne n'avale plus les échecs | **complet** | `syncOffline.test.ts` (4/4) |
| Vrais kits séparés des vitrines (`ok`/`empty`/`error`) | **complet** | `getKits.test.ts` (7/7) |
| `/hub` s'ouvre sur la racine, reprise < 24 h | **complet (unitaire)** | `hub-resume.test.tsx` (6/6). Le test Playwright `hub-resume.spec.ts` n'a pas été rejoué : `non vérifié` |
| Store du HUB purgé des données fictives | **complet** | `useHubStore.test.ts` (4/4) |
| `replace_kit_items` atomique, `23514` sur vidage, comptage inchangé (A-02, SEC-05..07) | **bloqué** | Migration + test SQL écrits, **jamais exécutés** : `supabase`, `psql`, `docker` absents. Levée : Tony, `supabase db reset --local` |
| M0 : mesure deux contextes WebGL sur iPhone (H-01..H-03) | **bloqué** | Page `public/test-m0.html` + `docs/hub-camp-3d/PROTOCOLE_M0.md` livrés. Aucun chiffre produit. Levée : Tony, deux iPhone (récent + entrée de gamme) |

## I1 — HUB sans 3D (`chantier/hub-camp-3d`)

| Exigence | Statut | Preuve nommée |
|---|---|---|
| `kitConfiguration` pur, `totals` dérivé, `weightG: null` | **complet** | `kitConfiguration.test.ts` (20/20) |
| Mutations optimistes + retour arrière (50 mutations dont 20 échecs) | **complet (1 test agrégé)** | `mutations.test.ts` (1/1) + `tests/adversarial/lot-l1-adversarial.spec.ts` (17/17) |
| `DrawerShell` / `LensPager` extraits sans régression Compte | **complet** | `DrawerShell.test.tsx` (10/10), `LensPager.test.tsx` (12/12) ; contrats Compte pointent le fichier extrait |
| Machine de drawers (retour arrière, alias, URL) | **complet** | `drawerMachine.test.ts` (9/9) |
| Un seul contexte WebGL (`camp-map` XOR `bag-scene`) | **complet (unitaire)** | `WebGLArbiter.test.ts` (8/8). Comportement sur iPhone : `bloqué` |
| Zéro mockup dans HUB / Studio | **complet** | `node scripts/verify/hub_no_mockup.mjs` : succès |
| Zéro nouvelle `page.tsx` | **complet** | `git diff --name-status d065897e HEAD -- 'src/app/**/page.tsx'` : 2 modifiées, 0 ajoutée |
| `hubSectionRegistry.ts` intact | **complet** | identique à `origin/main` |
| Garde-fou H-D85 (14 règles) | **complet** | `h-d85-guard.spec.ts` (14/14) ; **avec 3 entrées d'exemption ajoutées, à valider par Tony** |
| Flag `hub_camp_v1` testé ON **et** OFF | **non vérifié** | Aucun test nommé ne couvre les deux sens |
| Parcours `hub-drawers.spec.ts`, `hub-map.spec.ts` (Playwright) | **non vérifié** | Playwright non rejoué |

## I2 — Kit Studio 3D

| Exigence | Statut | Preuve nommée |
|---|---|---|
| Pipeline d'assets reproductible | **complet** | `npm run assets:bags` régénère les 5 GLB **identiques octet pour octet** (`diff -rq`) ; `npm run assets:validate` : 5 modèles, 0 erreur ; générateur identique à celui du bundle (`cmp`) |
| `openable: false` sans charnière (`duffel-60`) | **complet** | `loader.test.ts` (7/7) + sortie du validateur (« non ouvrable ») |
| Caméra pure, interruption, coalescence | **complet** | `camera.test.ts` (16/16) |
| Cycle de vie de la scène | **complet (unitaire)** | `bag-scene-lifecycle.test.tsx` (3/3), `quality.test.ts` (2/2). Fuite mémoire sur 5 cycles : `non mesuré` |
| Statistiques : `unknownWeightCount`, pas de score « parfait » | **complet** | `stats.test.ts` (4/4) |
| Poids inconnu affiché « — » en vue Liste | **complet (corrigé cette session)** | correction dans `BagListView.tsx` ; **pas de test dédié** : à ajouter |
| Lignée conforme | **complet** | `lignee.test.ts` (3/3) + `identity_compliance.mjs` : succès |
| Son muet par défaut, `AudioContext` au geste | **complet** | `ambience.test.ts` (7/7) |
| Parité 3D ↔ Liste en E2E (S-10, double passage) | **non vérifié** | `studio-list.spec.ts` non rejoué |
| Accessibilité (G), parité visuelle Compte ↔ HUB | **non vérifié** | `test:a11y` / `test:visual` non lancés |
| FPS, mémoire, batterie, poids JS (H) | **non mesuré** | Aucun appareil ; aucun chiffre inventé |

## I3 — Groupe, acquisition, insignes

| Exigence | Statut | Preuve nommée |
|---|---|---|
| Drapeau dédié `is_shared_with_group`, `is_public` non étendu | **complet (décision)** | `DECISIONS.md` D-24 |
| Politiques RLS en lecture seule, SEC-01..SEC-10 en base | **bloqué** | SQL écrit, **jamais exécuté** (aucun Postgres local). Levée : Tony |
| Garde-fous côté application | **complet (statique)** | `security-policies.test.ts` (5/5) : lit les fichiers SQL, ne prouve pas leur comportement en base |
| Acquisition sans paiement fictif | **complet (unitaire)** | `acquisition.test.ts` (5/5) |
| Insignes : possession vérifiée serveur (SEC-08) | **bloqué** | `supabase/tests/kit_badges.sql` jamais exécuté |
| Parcours Playwright `studio-groupe.spec.ts` | **non vérifié** | non rejoué |

## I4 — Scène du camp (L8)

| Exigence | Statut | Raison |
|---|---|---|
| L8-0, L8-1, L8-2 | **exclu** | Décision de Tony (L8-0) : le HUB garde la carte MapLibre |

## I — Livraison et clôture

| Exigence | Statut | Preuve / cause |
|---|---|---|
| `CLAUDE.md` corrigé (3D, `transpilePackages`) (I-08) | **complet** | `git diff CLAUDE.md` : deux lignes fausses remplacées ; `next.config` sans `transpilePackages`, `react-globe.gl` absent de `package.json` |
| Retrait de l'ancien HUB (I-06) | **exclu à ce stade** | Interdit avant inventaire 5 axes **et** une semaine de flag actif : non fait, rien supprimé |
| Portes `lint`, `type-check`, `build` | **complet** | 0 erreur ; `build` exit 0 |
| `npm test` complet vert | **non** | 42 fichiers rouges (107 tests), **tous déjà rouges sur `d065897e`** (vérifié sur un worktree jetable) ; 0 régression restante imputable à cette branche |
| `ci_invariants` | **non** | échec `icon-names` dans `communaute` / `messaging`, déjà présent sur la base |
| Livraison iPhone (CHECKLIST_IPHONE_FINAL) | **bloqué** | Aucun déploiement ni installation effectués |

## Défauts connus

- `KitManager.tsx` convertit encore un poids inconnu en `0` à l'enregistrement (`weight_g: i.weight_g ?? 0`), car le schéma d'entrée de l'API (`src/lib/schemas/materiel.ts`) exige un entier `>= 0`. Le corriger change le contrat d'API : non fait.
- Seule la suite adversariale du lot L1 est dans la branche (`tests/adversarial/lot-l1-adversarial.spec.ts`, 17/17 rejoués). Les suites adversariales L0 et L2/L3 ainsi que les tests Playwright `tests/e2e/hub-3d/` annoncés pendant le run par l'équipe Teamwork n'existent plus dans le worktree : leurs résultats ne sont pas reproductibles.
