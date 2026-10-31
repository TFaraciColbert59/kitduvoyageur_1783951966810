# Baseline LKDV — 31/10/2026

Branche de référence : `origin/main` = `f89f5665961754e1dd5d37a55374169aac4dfedb`
(« fix(explorer-v2): resolution du crash client sur /explorer, securisation des
coordonnees de carte et diagnostic temps reel », 30/10/2026 18:10 +0100).
Copie de travail isolée : worktree `/Users/fr168256/lkdv-chantier-cleanup`
(detached HEAD puis branches `chore/lkdv-cleanup-perf-2026` et
`fix/explorer-geo-p0`). Le worktree de travail `unified/latest` (100 commits
d'avance, non poussés) n'a **pas** été touché.

## Environnement

| Élément | Valeur |
|---|---|
| OS | macOS Darwin 25.6.0 (arm64) |
| Node | v26.8.2 (`~/.local/bin/node`) |
| npm | 11.19.1 |
| Rust/cargo | **absent** (`~/.cargo`, `brew` introuvables) |
| Playwright | installé (devDependency), navigateurs non vérifiés |
| CI | `.github/workflows/ci.yml` — Node 22, `NODE_OPTIONS=--max-old-space-size=5120` |
| Supabase | lecture seule via MCP / SQL SELECT (voir `SQL_AUDIT.md`) |

## Inventaire (lecture seule, `npm run cleanup:audit`)

| Mesure | Valeur |
|---|---|
| Fichiers suivis par git | 9 514 |
| Octets suivis | 276,8 MiB |
| Fichiers source/texte scannés | 5 066 |
| Scripts `package.json` cassés (avant) | 3 (`design:diff`, `cleanup:quarantine`, `explorer:shots`) |
| Scripts cassés (après lot outillage) | 0 |
| Groupes de fichiers exactement identiques | 40 (plafond d'affichage) |
| Sources ≥ 800 lignes | 35 |

Lignes par extension (fichiers suivis) : 2 565 `.ts`, 2 157 `.md`, 1 058 `.tsx`,
603 `.sql`, 211 `.mjs`, 61 `.css`, 17 `.js`, 7 `.swift`.

Plus gros fichiers suivis : captures d'audit PNG dans `docs/audit/` et
`audit/captures-carnet-selecteur/` (4,1 Mo max), `public/materiel/background.jpg`
(2,4 Mo), `public/assets/images/workshop.jpg` (2 Mo). Ce sont des **preuves
d'audit** : conservées.

Marqueurs de dette : 452 `: any`, 2 `@ts-ignore`, 128 `eslint-disable`,
0 TODO/FIXME/HACK, 32 `console.log`, 35 tests `skip`/`xit`.

## Portes de qualité — état de référence

| Commande | Résultat | Détail |
|---|---|---|
| `npm ci` | **ÉCHEC** sur HEAD | lockfile désynchronisé : `webpack@5.112.2`, `@opencode-ai/plugin@1.19.5`, 60 paquets absents → la CI échoue dès l'installation |
| `npm run type-check` | exit 0 avec `NODE_OPTIONS=--max-old-space-size=6144` | OOM à 2 Go (tas par défaut) ; la CI passe 5 Go |
| `npm test` (vitest) | à mesurer après correction du lockfile | node_modules incomplet au premier essai |
| `npm run build` | `✓ Compiled successfully in 3.0min` | voir §Bundle |
| `node --test tests/cleanup/*.node-test.mjs` | 8/8 | nouveaux outils de nettoyage |

**Constat P0 CI** : sur `f89f5665`, `npm ci` échoue → le job
« LKDV Unified Quality Gates » ne peut pas être vert, quelle que soit la qualité
du code. La resynchronisation du lockfile fait partie du lot outillage.

## Bundle (à compléter)

Renseigné à partir de la sortie `next build` (voir `BUNDLE.md`).

## SQL (lecture seule)

Voir `SQL_AUDIT.md` : `trails_in_viewport` 8 994 appels / 159,8 ms de moyenne
(p95 approx. 617 ms), `get_trail_pois_bbox` 4 425 appels / 87,7 ms, index GIST
dupliqués sur `hiking_routes.geom`, index simples doublons des index uniques sur
`trips.slug`/`trips.share_token`.

## Non mesuré (et pourquoi)

| Mesure | Statut | Cause |
|---|---|---|
| LCP/INP/CLS en conditions réelles | `BLOCKED` | pas de déploiement preview autorisé dans ce chantier ; mesures labo possibles uniquement |
| FPS MapLibre sur appareil mobile | `BLOCKED` | aucun appareil iOS/Android connecté, pas de simulateur démarré |
| p50/p95 des RPC | partiel | `pg_stat_statements` ne fournit que moyenne/écart-type (p95 approximé) |
| Bench Rust/WASM | `BLOCKED` | toolchain Rust absente, installation `curl | bash` interdite par le contrat |
| RLS multi-comptes | `BLOCKED` | pas de base staging autorisée dans cet environnement |
