# Recette — Communauté v2 (tiroirs Explorer et Création)

Dossier de preuves `07-RECETTE.md` du chantier **Communauté v2**
(`handoff/communaute-v2/`). Aucune case n'est cochée sans preuve exécutable :
le tableau de suivi est [`PREUVES.md`](./PREUVES.md).

## Contexte machine (2026-11-08) — ce qui est testable ici

| Élément | État | Conséquence recette |
|---|---|---|
| Base Supabase réelle | **Non branchée** dans ce worktree (`.env.local` = placeholders CI) | Les scénarios de **données réelles** (création des 6 types, stories, compteurs) se **sautent proprement** : ils sont prêts dans `tests/e2e/communaute-v2-db.spec.ts` (`LKDV_E2E_DB=test`). |
| Migrations prod | **Non appliquées** : `BACKUP_PASSPHRASE` absent, `db-backup.yml` ne produit aucun artefact (JOURNAL J-08) | Recette **§ B Production** et **§ A sur aperçu branché base de prod** : non testables sans le feu vert sauvegarde. |
| iPhone / Xcode | Non disponible dans la session | Recette **§ C** (haptique, safe areas, clavier/caméra iOS) reportée ; le flow Maestro est prêt (`.maestro/communaute.yaml`). |
| Maquette | Serveur local `python3 -m http.server 8765` dans `handoff/communaute-v2/annexes/` | `captures-maquette/` = 58 références 390×844 (copiées de `audit-communaute-v2/maquette/`). |
| Build v2 | `NEXT_PUBLIC_COMMUNAUTE_V2=true` figé au build | Toute preuve v2 exige ce build ; sans lui, les specs se sautent avec une raison explicite. |

**Ce qui reste prouvable ici et en CI, sans base** : gestes UI (ouverture par les
déclencheurs, capsule, mini-capsule, glisser, poignée, Échap ordonné, fond
inerte, focus), tri et point vert, Peek, états vide/erreur/skeleton, recherche
(accents, ponctuation, erreur, clavier, carte), formulaires (étapes, Suivant/
Retour, erreurs une seule fois, brouillon, confirmation), invité/`requireAuth`,
0 débordement 360/390/430, 0 erreur console, a11y axe, régression visuelle
390×844. Tout passe par le harnais de mock réseau Playwright.

## Fichiers

| Fichier | Rôle |
|---|---|
| `captures-maquette/` | Référence : 58 captures de la maquette (390×844). |
| `captures-v2/` | Production du travail : captures des tiroirs réels sur données mockées. À remplir avec `capture-v2.mjs` (aucune capture n'est inventée). |
| `capture-v2.mjs` | Orchestrateur de capture : vérifie le serveur, lance le harnais d'intégration des fondations (`integration/capture.mjs` : 21 scénarios Explorer + étape 1 des 6 types de création, états vide/erreur/skeleton, île, tri, détail, Peek, brouillon), copie les PNG ici + `MANIFEST.json` ; `--visual` met aussi à jour les références Playwright. |
| `playwright.communaute-v2.config.ts` | Config de recette locale pour compter/exécuter les specs v2 **avant** l'ajout au `testMatch` racine. |
| `CI-LIGNES-A-AJOUTER.md` | Lignes exactes (testMatch, CI jobs, env) à appliquer par le Lead dans les fichiers hors scope. |
| `PREUVES.md` | Tableau `07 § A/B/C` : commande/spec/preuve ou « non testable ici : raison ». |

## Rejouer

### 1. Build v2 + serveur (obligatoire, le drapeau est figé au build)

```bash
cd /Users/fr168256/Documents/deepseek-harness/default-workspace/lkdv-communaute-v2
NEXT_PUBLIC_COMMUNAUTE_V2=true \
NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key \
npm run build
npm run start          # http://127.0.0.1:4028
```

> `fixture.supabase.co` est un hôte fictif : **aucune requête réseau** ne sort,
> tout est intercepté par `tests/e2e/communaute-v2.fixtures.ts` (données de
> `integration/fixtures.mjs`) et par `integration/network.mjs` pour les captures.

### 2. Preuves déterministes (`@ui-mock`, sans base)

```bash
PW_BASE_URL=http://127.0.0.1:4028 npx playwright test tests/e2e/communaute-v2*.spec.ts \
  --project=mobile-webkit --project=mobile-chromium
PW_BASE_URL=http://127.0.0.1:4028 npx playwright test \
  tests/a11y/e2e/communaute-v2-a11y.spec.ts --config=playwright.a11y.config.ts --project=iphone-14-pro
PW_BASE_URL=http://127.0.0.1:4028 npx playwright test \
  tests/visual/communaute-v2-visual.spec.ts --config=playwright.visual.config.ts --project=iphone-14-pro-chromium
```

Le drapeau `false` (scénario 11) exige un build séparé :
`NEXT_PUBLIC_COMMUNAUTE_V2=false npm run build && npm run start` puis
`LKDV_E2E_V2_FLAG=false npx playwright test tests/e2e/communaute-v2-flag.spec.ts`.

### 3. Captures de recette

```bash
node docs/audit/communaute-v2-2026-11-08/recette/capture-v2.mjs            # captures
node docs/audit/communaute-v2-2026-11-08/recette/capture-v2.mjs --visual   # + références visuelles
```

Sorties : `captures-v2/*.png` + `captures-v2/MANIFEST.json` (+ horodatage, base,
échecs du harnais). Comparer aux références `captures-maquette/` (côte à côte)
pour le rapport ; écarts assumés vs maquette → `RAPPORT.md` du Lead.

### 4. Données réelles (CI / aperçu migré uniquement)

```bash
LKDV_E2E_DB=test LKDV_E2E_AUTH=1 AUDIT_EMAIL=… AUDIT_PASSWORD=… \
PW_BASE_URL=<base de test migrée> npx playwright test tests/e2e/communaute-v2-db.spec.ts --project=mobile-chromium
```

Jamais la prod ; sortie/club **seulement** sur base de test (`00` § 4.8).

## Tolérance visuelle et limites honnêtes

- **Régression Playwright** : `maxDiffPixelRatio: 0.02` (2 % des pixels) sur
  390×844, animations coupées, horloge figée au 2026-11-08 (fixtures
  déterministes). Documenté dans `tests/visual/communaute-v2-visual.spec.ts`.
- **Comparaison maquette** : appréciation humaine côte à côte (pas un diff
  pixel automatique) : la maquette n'est pas rendue par le même moteur CSS.
- **Ce qui n'a pas pu être capturé ici** : § B (prod), § A sur base de prod
  réelle, **étapes 2+ des formulaires** (le harnais d'intégration capture
  l'étape 1 des 6 types ; la story exige un média réel, le carnet des photos
  téléversées, la sortie une date/position — l'upload Storage est simulé mais
  non branché), clavier iOS réel, haptique. Raisons : J-08 (sauvegarde absente →
  aucune migration prod), pas d'iPhone, Storage non branché. Les étapes de la
  **maquette** restent la référence visuelle pour ces écrans
  (`captures-maquette/*-e2|e3|e4.png`).
- Les captures `integration/captures/` (fondations) servent de source ; ce
  dossier ne duplique pas le moteur de capture, il l'orchestre et l'archive.
