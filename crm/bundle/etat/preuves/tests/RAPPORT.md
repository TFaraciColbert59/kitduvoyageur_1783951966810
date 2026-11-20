# Rapport de tests — LKDV Control

Rôle : testeur (`qa`) · date : 2026-11-09 07:20 Europe/Paris · périmètre : `crm/tests/**`, `crm/playwright*.config.ts`, `crm/scripts/capture-screens.mjs`, `crm/src/lib/*.test.ts`, `crm/bundle/etat/preuves/tests/**`.

Aucune donnée réelle, aucun compte réel, aucun e-mail réel. Aucun test ne vise la production (`CRM_BASE_URL` refuse `lekitduvoyageur.fr`).

## 1. Fichiers livrés

**Unitaires — 9 fichiers, 86 tests** (Vitest, à côté du code : `crm/src/lib/*.test.ts` ; `vitest.config.ts` n'inclut que `src/**`, donc les unitaires ne peuvent pas vivre sous `crm/tests/`).

| Fichier | Tests | Couvre |
| --- | --- | --- |
| `src/lib/catalog.test.ts` | 9 | 144 actions, `ACT-001`…`ACT-144` sans trou ni doublon, pôles/rôles/drapeaux valides, **parité ligne à ligne avec `bundle/04_CATALOGUE_ACTIONS.md`**, compteurs par pôle, argent et irréversible en « 2 personnes » |
| `src/lib/rbac.test.ts` | 10 | `canRun` (super admin partout, responsable sur son pôle, membre limité, hors pôle refusé, élévation par commande sans joker, agent/système jamais), `canSelfValidate`, `agentCanValidate`, ordre des rôles |
| `src/lib/countdown.test.ts` | 15 | tons `gris`/`orange` (≤ 5 min, ≤ 20 %)/`rouge`, bornes exactes, `formatRemaining`, tri `EX-INBOX-02` (urgence → délai → ancienneté), immutabilité |
| `src/lib/format.test.ts` | 10 | `maskEmail` (2 caractères max), `euros`, `firstName`, `relativeFr`, « non renseigné » au lieu d'un chiffre inventé |
| `src/lib/fingerprint.test.ts` | 9 | empreinte stable (ordre des clés) et sensible à toute valeur/type/liste, SHA-256 |
| `src/lib/errors.test.ts` | 9 | `42501` → « Votre rôle ne permet pas cette action. » (jamais de code brut), priorité du `hint`, phrases et statuts de tous les codes, `redact` (jetons, clés Stripe/Supabase, e-mails) |
| `src/lib/cmd-schema.test.ts` | 12 | schémas zod des routes : 1 schéma strict par commande, champ inconnu refusé, motif obligatoire sur les 25 commandes concernées, montant entier positif, `unknown_command` en 400, JSON Schema `tools/list`, commandes « jamais » non exposées aux agents |
| `src/lib/totp-harness.test.ts` | 4 | l'outillage TOTP suit la RFC 6238 (vecteurs officiels) |
| `src/lib/test-guardrails.test.ts` | 8 | méta-tests : aucun `.only`, aucun `waitForTimeout`, `skip` motivés, `fixme` « en attente de la page », aucune donnée réelle, aucune action inventée, un fichier par domaine, seuils écrits |

Total du dépôt avec les deux fichiers des autres rôles (`src/design/tokens.test.ts`, `src/server/__tests__/errors-contract.test.ts`) : **11 fichiers, 93 tests**.

**E2E — 21 fichiers** (`crm/tests/e2e/`) : `d01-comptes` … `d19-systeme` (un fichier par domaine du catalogue, chaque test cite ses `ACT-…`), `transverses.spec.ts` (connexion + TOTP, file/groupes/tri/compte à rebours, `J`/`K`, `Entrée`, `⌘K`, `?`, annulation 10 s, états, mode solo) et `catalogue-144.spec.ts` (les 144 actions servies par `admin.commands_catalog()`, ids comparés à `catalog.ts`).

**Accessibilité — 3 fichiers** (`crm/tests/a11y/`) : `ecrans.spec.ts` (axe WCAG 2.0/2.1/2.2 AA par écran, contraste des jetons, cibles ≥ 44 px, focus visible, titre/langue), `etats.spec.ts` (vide/erreur/chargement/déjà décidé, connexion, double authentification, accès refusé, SOS mobile), `clavier.spec.ts` (décision complète sans souris, `Échap`, barre de commande, aide, pas de focus perdu).

**Performance — 1 fichier** (`crm/tests/perf/ouverture-cas.spec.ts`) : seuils écrits dans le test — accusé < 100 ms, p95 < 400 ms sur 20 ouvertures, aucune longue tâche > 200 ms pendant 30 défilements de 10 000 lignes (< 200 lignes montées), LCP < 2 000 ms.

**Parité visuelle — 1 fichier + registre** (`crm/tests/visuel/`) : `parite.spec.ts` (dimensions exactes, absence de débordement, registre complet), `differences.json` (22 différences voulues, chacune justifiée).

**Contrat d'API — 1 fichier** (`crm/tests/api/contrat.spec.ts`) : `/api/health`, `/api/mcp`, `/api/cmd`, `/api/approve`, `/api/reject`, `/api/undo`, `/api/cron/sla`, `/api/stripe/webhook` ; refus sans session, 405 + `Allow`, aucun secret ni pile, `42501` jamais exposé.

**Configs et outils** : `playwright.config.ts` (7 projets : `desktop` 1440×1040, `mobile` 390×844, `a11y`, `a11y-mobile`, `perf`, `api`, `visuel` ; `baseURL` = `CRM_BASE_URL` sinon `http://localhost:4100` ; `forbidOnly: true` ; `retries: 0` ; artefacts dans `crm/test-results/`, hors dépôt versionné), `playwright.a11y.config.ts`, `scripts/capture-screens.mjs`, `tests/README.md` (lancement, variables, contrat de sélecteurs `data-testid`, restes).

## 2. Vert, exécuté ici

| Commande | Résultat |
| --- | --- |
| `cd crm && npx vitest run` | **11 fichiers, 93 tests, 93 verts** (dont mes 9 fichiers / 86 tests) |
| `cd crm && npx next lint --max-warnings=0` | **0 avertissement, 0 erreur** |
| `cd crm && npx playwright test` | **14 verts, 204 `skip` motivés, 4 rouges** (un seul défaut, § 3) |

Détail des 14 verts (aucune base requise) :

- `desktop` — en-têtes de sécurité (CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy`, `X-Robots-Tag`, `robots.txt` `Disallow: /`).
- `api` — `GET /api/health` 200 sans aucune valeur de secret ; `POST /api/mcp` sans jeton refusé sans détail interne.
- `visuel` — 3 contrôles du registre (couverture des 8 maquettes, tailles des références 1440×1040 et 390×844, routes du CONTRACT) + **6 captures** des écrans publics aux deux tailles.
- `a11y` et `a11y-mobile` — `/acces-refuse` : 0 violation axe, message sans détail technique.

Captures : `crm/scripts/capture-screens.mjs` → `crm/bundle/etat/preuves/visuel/` — **6 / 48** (`connexion`, `double-authentification`, `acces-refuse` × 1440×1040 et 390×844), dimensions vérifiées, `manifest.json` et `RAPPORT-DIFFERENCES.md` écrits. Code de sortie `2` (captures partielles, volontaire).

## 3. Rouge — défaut réel, une seule cause

**Cibles tactiles < 44 px sur les liens secondaires des écrans d'authentification** (contrôle 32 de `05_UI_UX_DESIGN` § 8) :

| Écran | Élément | Mesure | Attendu |
| --- | --- | --- | --- |
| `/connexion` | `a[Vérifier un code →]` | 112 × **18** px | ≥ 44 px de haut |
| `/double-authentification` | `a[← Revenir à la connexion]` | 151 × **18** px | ≥ 44 px de haut |

Tests rouges : `tests/a11y/etats.spec.ts:13` et `:23`, projets `a11y` et `a11y-mobile` (4 tests, reproductibles). Correctif attendu (périmètre frontend) : `min-height: 44px` + `display: inline-flex; align-items: center; padding: 0 4px` sur ces liens, ou en faire des boutons secondaires. Les tests ne seront pas affaiblis : ils passeront au vert avec le correctif.

## 4. Écrit mais non exécutable — base migrée (P4) et identifiants absents

**204 `skip` motivés**, tous avec motif explicite (`NO_CREDENTIALS_MOTIF`, `NO_SUPABASE_MOTIF` ou phrase de jeu de données) :

| Projet | `skip` | Motif |
| --- | --- | --- |
| `desktop` | 76 | session `aal2` + compte `is_demo` + seeds |
| `a11y` / `a11y-mobile` | 35 + 35 | idem (écrans d'équipe) + états sur jeu de données |
| `perf` | 5 | idem + 10 000 lignes fournies par la base |
| `visuel` | 43 | 21 écrans d'équipe × 2 tailles + rapport |
| `api` | 9 | `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` absents |
| `mobile` | 1 | idem |

Pourquoi c'est bloqué, précisément :

1. **`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` absents** → `src/middleware.ts` lève « Configuration publique incomplète » et répond 500 sur toute route non publique ; aucune session ne peut exister.
2. **Session `aal2`** : `requireStaffSession()` exige un second facteur vérifié (`EX-AUTH-02`). Sans `CRM_TEST_EMAIL`, `CRM_TEST_PASSWORD`, `CRM_TEST_TOTP_SECRET`, le test se `skip` avec ce motif.
3. **Compte de test `is_demo` et seeds** (rôle base de données) : sans eux, aucune ligne de file, aucun cas, aucune commande, aucune demande à valider, aucun SOS, aucune commande Stripe de test.
4. **Jeux de données pour les états** : file vide, panne simulée, réponse lente, cas déjà décidé, 10 000 lignes virtualisées — les tests concernés portent un motif explicite plutôt qu'une attente arbitraire.
5. **Migrations de production (P4)** : sans `SUPABASE_DB_URL`/`BACKUP_PASSPHRASE`, la base n'est pas migrée ; les tests sont prêts et se déclencheront sans modification.

## 5. Captures : 6 / 48

- **Capturés** : `connexion`, `double-authentification`, `acces-refuse` en 1440×1040 et 390×844 (PNG aux dimensions exactes, `deviceScaleFactor: 1` pour être comparables aux maquettes).
- **Non capturés (42)** : les 21 écrans d'équipe × 2 tailles, chacun listé dans `bundle/etat/preuves/visuel/RAPPORT-DIFFERENCES.md` avec le motif « identifiants de test absents (CRM_TEST_EMAIL/CRM_TEST_PASSWORD/CRM_TEST_TOTP_SECRET) ». Une capture d'écran d'équipe sans session `aal2` montrerait un 500 ou une redirection — ce ne serait pas une preuve de parité, donc le script ne l'écrit pas (`status: skipped`, sortie `2`).

## 6. Reste à faire

1. **Corriger les deux liens < 44 px** (§ 3) → 4 tests passent au vert.
2. **Fournir la base migrée + le compte `is_demo`** (§ 4) → les 204 `skip` s'exécutent ; prévoir un premier passage de calage des `data-testid` (contrat listé dans `tests/README.md` § 4) car le frontend ne les a pas encore posés.
3. **Un test par action** : 19 familles couvertes aujourd'hui (minimum demandé) ; les 144 `ACT-…` une par une à la porte de phase 9, pilotées par `scripts/catalog-diff.mjs`.
4. **Parcours croisés CRM ↔ LKDV** (deux navigateurs) et **test « novice »** (contrôle 38) à écrire quand les écrans seront stabilisés.
5. **Couche 10 (production)** : volontairement absente — aucune suite ne vise la production pendant le chantier.
6. `npx tsc --noEmit` reste rouge pour 4 erreurs hors de mon périmètre (`src/server/cmd.ts`, `src/server/stripe.ts`) ; mes fichiers de test sont exclus de `tsconfig` et n'y contribuent pas.
