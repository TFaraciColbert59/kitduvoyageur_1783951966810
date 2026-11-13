# Tests — LKDV Control

Ce dossier porte les couches **2 (unitaire)**, **4 (contrat d'API)**, **5 (accessibilité)**,
**6 (parité visuelle)**, **7 (performance)** et **9 (E2E)** de `bundle/07_VERIFICATION.md`.

Le corpus est écrit **avant** les écrans : chaque scénario décrit le comportement attendu
et sera activé dès que la page, la base migrée et le compte de test existeront.

## 1. Lancer

```bash
cd crm

# Couche 2 — unitaires (Vitest)
npx vitest run

# Couche 1 — typage (les tests sont hors tsconfig, le code applicatif est vérifié)
npx tsc --noEmit

# Couches 4, 5, 6, 7, 9 — Playwright (démarre `npm run dev` sur 4100 si CRM_BASE_URL absent)
npx playwright test                      # tous les projets
npx playwright test --project=desktop    # bureau 1440 × 1040
npx playwright test --project=mobile     # téléphone 390 × 844 (scénarios @mobile)
npx playwright test --project=a11y       # accessibilité bureau
npx playwright test --config=playwright.a11y.config.ts   # a11y bureau + mobile
npx playwright test --project=perf       # performance
npx playwright test --project=visuel     # parité visuelle

# Captures de parité (hors Playwright), écrites dans bundle/etat/preuves/visuel/
node scripts/capture-screens.mjs
```

Rapports : `crm/bundle/etat/preuves/playwright/` (HTML, JSON, traces), captures dans
`crm/bundle/etat/preuves/visuel/`.

## 2. Variables

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `CRM_BASE_URL` | Cible des tests. **La production est refusée.** | `http://localhost:4100` |
| `CRM_TEST_EMAIL` | Compte de test `is_demo` (jamais un compte réel) | — |
| `CRM_TEST_PASSWORD` | Mot de passe du compte de test | — |
| `CRM_TEST_TOTP_SECRET` | Secret base32 du second facteur du compte de test | — |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Nécessaires au démarrage du middleware | — |
| `CRM_E2E_WORKERS` | Parallélisme Playwright (1 par défaut : une seule session de test) | `1` |

Les variables se posent dans l'environnement ou dans `crm/.env.local` / `crm/.env.test.local`
(ignorés par git, jamais commités). Sans les trois `CRM_TEST_*`, les scénarios authentifiés
sont `test.skip` **motivés** — ils ne passent pas en silence, ils sont listés.

## 3. Ce qui est couvert

### Unitaires (couche 2) — `crm/src/lib/*.test.ts`

| Fichier | Ce qui est verrouillé |
| --- | --- |
| `catalog.test.ts` | 144 actions, `ACT-001`…`ACT-144` sans trou, pôles/rôles/drapeaux valides, **parité ligne à ligne avec `bundle/04_CATALOGUE_ACTIONS.md`**, compteurs par pôle, argent et irréversible en « 2 personnes » |
| `rbac.test.ts` | `canRun` : super admin partout, responsable sur son pôle, membre limité, hors pôle refusé, élévation par commande (jamais par joker), agent/système jamais ; `canSelfValidate` ; `agentCanValidate` |
| `countdown.test.ts` | tons `gris`/`orange`/`rouge` (≤ 5 min, ≤ 20 %, dépassé), bornes exactes, `formatRemaining`, tri `EX-INBOX-02` (urgence haute → délai → ancienneté) |
| `format.test.ts` | `maskEmail` (2 caractères max), `euros`, `firstName`, `relativeFr`, « non renseigné » au lieu d'un chiffre inventé |
| `fingerprint.test.ts` | empreinte SHA-256 stable (ordre des clés) et sensible à tout changement de valeur/type/liste |
| `totp-harness.test.ts` | l'outillage TOTP des tests suit la RFC 6238 (vecteurs officiels) |
| `errors.test.ts` | traduction Postgres/PostgREST (`42501` → « Votre rôle ne permet pas cette action. »), priorité du marqueur `hint`, catalogue des phrases et des statuts, corps d'erreur sans détail technique, `redact` (jetons, clés Stripe/Supabase, e-mails) |
| `cmd-schema.test.ts` | schémas zod des routes (`/api/cmd`, outils MCP) : 1 schéma strict par commande, champ inconnu refusé, motif obligatoire, montants entiers positifs, `unknown_command` en 400, JSON Schema `tools/list`, commandes « jamais » non exposées aux agents |
| `totp-harness.test.ts` | l'outillage TOTP des tests suit la RFC 6238 (vecteurs officiels) |
| `test-guardrails.test.ts` | méta-tests : pas de `.only`, pas de `waitForTimeout`, `skip` motivés, `fixme` éventuel « en attente de la page », aucune donnée réelle, aucune action inventée, un fichier par domaine, seuils écrits |

### E2E (couche 9) — `crm/tests/e2e/`

Un fichier par domaine du catalogue (`d01-comptes.spec.ts` … `d19-systeme.spec.ts`),
plus `transverses.spec.ts` (connexion + TOTP, file et tri, clavier `J`/`K`, `⌘K`,
annulation 10 s, états vide/erreur/chargement, mode solo) et `catalogue-144.spec.ts`
(les 144 actions servies par `admin.commands_catalog()` et affichées à l'écran).

Chaque test cite les `ACT-…` qu'il couvre et vérifie l'**effet** : toast, ligne de
journal, état à l'écran. Aucun test ne se contente d'un clic sans conséquence.

### Accessibilité (couche 5) — `crm/tests/a11y/`

- `ecrans.spec.ts` : axe (WCAG 2.0/2.1/2.2 AA) sur chaque écran, deux tailles ; contraste
  calculé sur les jetons ; cibles ≥ 44 px ; focus visible ; titre et langue.
- `etats.spec.ts` : états vide / erreur / chargement / déjà décidé, connexion, double
  authentification, accès refusé, SOS mobile.
- `clavier.spec.ts` : décision complète sans souris, `Échap` qui rend le focus, barre de
  commande, aide `?`, pas de focus perdu sur 25 tabulations.

### Performance (couche 7) — `crm/tests/perf/`

Seuils écrits dans le test, **jamais à la baisse** : accusé < 100 ms, réponse p95 < 400 ms
sur 20 ouvertures, aucune longue tâche > 200 ms pendant 30 défilements d'une liste de
10 000 lignes virtualisée (< 200 lignes montées), LCP < 2 000 ms.

### Parité visuelle (couche 6) — `crm/tests/visuel/` + `scripts/capture-screens.mjs`

Capture de chaque écran à 1440 × 1040 et 390 × 844 dans
`bundle/etat/preuves/visuel/`, vérification des dimensions et de l'absence de débordement
horizontal, et registre écrit des différences voulues (`differences.json`) : chaque
différence porte une justification, aucune n'est implicite.

### Contrat d'API (couche 4) — `crm/tests/api/`

`/api/health`, `/api/cmd`, `/api/approve`, `/api/cron/*`, `/api/stripe/webhook` :
validation du corps, refus sans session, messages en français, aucun code brut
(`42501`), aucun secret dans la réponse.

## 4. Contrat de sélecteurs (frontend ↔ tests)

Stables, documentés dans `tests/support/selectors.ts`. À poser côté frontend :

`app-shell`, `nav-poles` (déjà `nav[aria-label="Navigation principale"]`), `command-bar-trigger`,
`command-input`, `command-results`, `solo-badge`, `realtime-chip`, `session-card`,
`login-form`, `totp-form`, `inbox`, `inbox-group` (+ `data-group`), `queue-row` (+ `data-key`,
`data-due-at`, `aria-selected`), `queue-countdown` (+ `data-tone`), `inbox-counts`, `inbox-empty`,
`inbox-error`, `inbox-skeleton`, `case`, `case-facts`, `decision-card`, `reason-select`,
`decision-save`, `member-notice-preview`, `ai-suggestion`, `toast`, `toast-action`,
`toast-countdown`, `approval-panel`, `approval-steps`, `approval-fingerprint`,
`confirmation-input`, `approve-button`, `solo-notice`, `audit-table`, `audit-row`,
`agents-overview`, `agent-card`, `sos-screen`, `sos-call-112`, `sos-take`, `sos-close`,
`sos-position`, `sos-timeline`, `catalogue-list`, `catalogue-row` (+ `data-act`),
`catalogue-search`, `catalogue-count`, `member-record`, `member-email`, `reveal-pii`,
`order-detail`, `order-total`, `order-refund`, et les racines `contenus-root`, `ia-root`,
`technique-root`, `order-status`, `ia-cost`.

## 5. État au 2026-11-09 (ce qui est vert, rouge, en attente)

**Vert, exécuté :**

- `npx vitest run` : 11 fichiers, **tous verts** (couche 2 + schémas zod des routes, erreurs traduites, garde-fous du corpus).
- Playwright, aucune base requise : `/api/health` (200, aucune valeur de secret),
  `/api/mcp` sans jeton (refus), `GET /api/cmd` → 405 + `Allow`, en-têtes de sécurité et
  `robots.txt`, registre des différences de parité, tailles des captures de référence,
  captures des 3 écrans publics aux deux tailles.
- `npx playwright test` complet : **0 test rouge inattendu** ; les scénarios qui exigent la
  base migrée ou le compte de test sont `test.skip` **motivés** (voir ci-dessous).

**Rouge, à corriger côté frontend (défaut réel, mesuré) :**

- Cibles tactiles < 44 px sur les liens secondaires des écrans d'authentification
  (`a[Vérifier un code →]` 112 × 18 px sur `/connexion`, `a[← Revenir à la connexion]`
  151 × 18 px sur `/double-authentification`). Contrôle 32 de `05_UI_UX_DESIGN` § 8.
  Test : `tests/a11y/etats.spec.ts` (projets `a11y` et `a11y-mobile`).

**En attente d'une base migrée / des identifiants (non exécutable ici) :**

1. **Identifiants de test** (`CRM_TEST_EMAIL`, `CRM_TEST_PASSWORD`, `CRM_TEST_TOTP_SECRET`)
   et `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` : sans eux, le middleware ne démarre pas et
   aucun scénario authentifié ne peut se connecter. Tous les `test.skip` correspondants
   portent `NO_CREDENTIALS_MOTIF` / `NO_SUPABASE_MOTIF`.
2. **Jeux de données de test** (rôle base de données) : file vide, panne simulée, réponse
   lente, cas déjà décidé, 10 000 lignes pour la virtualisation, contenus `[TEST CRM]`,
   commandes Stripe de test, SOS ouvert. Les tests concernés sont `test.skip` motivés.
3. **Un test par action** : les 19 familles sont couvertes (minimum demandé) ; les 144
   `ACT-…` seront couvertes une par une à la porte de phase 9, pilotées par
   `scripts/catalog-diff.mjs`.
4. **Parcours croisés CRM ↔ LKDV** (`croises.spec.ts`, deux navigateurs) et **test
   « novice »** (contrôle 38) : à écrire dès que les écrans sont stables.
5. **Couche 10 (production)** : volontairement absente de ce corpus — aucune suite ne
   vise la production pendant le chantier.
6. **Artefacts Playwright** : traces et captures d'échec vont dans `crm/test-results/`
   (ignoré par git), jamais dans `crm/bundle/etat/preuves/` où seuls les rapports et les
   captures de parité ont leur place.

## 6. Règles

- Aucun `.only`, aucun `waitForTimeout` : on attend une condition, pas une durée.
- Un test rouge reste rouge et se signale ; il ne se désactive pas.
- Un seuil ne se baisse pas (100/400/200 ms, 44 px, 0 violation axe).
- Aucune donnée réelle, aucun compte réel, aucun e-mail réel (`@example.test`,
  `delivered@resend.dev` uniquement).
- Les `fixme` sont temporaires et portent toujours « en attente de la page » ; aujourd'hui
  toutes les pages du CONTRACT existent, il n'en reste aucun.
- Les artefacts Playwright (traces, captures d'échec) ne sont pas versionnés :
  `outputDir` pointe sur `crm/test-results/`.
