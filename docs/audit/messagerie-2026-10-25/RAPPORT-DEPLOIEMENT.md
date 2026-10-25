# Rapport de déploiement — comment publier `chantier/messagerie-refonte` sur Cloudflare

Enquête du 2026-10-25. Aucun déploiement exécuté, aucun secret affiché.

## 1. Où vit la configuration Cloudflare

Aucun `wrangler.json` / `wrangler.jsonc` / `wrangler.toml`, aucun `open-next.config.ts` dans les cinq copies.

La config est **typée** (`cf/config`) : `cloudflare.config.ts` + `vite.config.ts` + `empty-stub.js` + deps `vinext` dans `package.json`.

| Copie | Branche | Config CF | Worker |
|---|---|---|---|
| `/Users/fr168256/lkdv-cf` | `deploy/cf-pays` | **oui** (`cloudflare.config.ts:5`) | `kitduvoyageur` |
| `/Users/fr168256/Desktop/lkdv-cloudflare` | `cloudflare/vinext` | oui | `kitduvoyageur` |
| `/Users/fr168256/Desktop/lkdv-cf-carnet` | `cf/carnet` | oui | `kitduvoyageur` |
| `/Users/fr168256/Desktop/lkdv-cf-carnet2` | `cf/carnet-latest` | oui | `kitduvoyageur` |
| `/Users/fr168256/lkdv-pays` | `chantier/pays-refonte` | **non** (`.vercel/project.json`) | — |
| `/Users/fr168256/lkdv-messages` | `chantier/messagerie-refonte` | **non** | — |

**Quatre worktrees écrivent le même Worker `kitduvoyageur`.** C'est le risque n°1.

`/Users/fr168256/lkdv-cf` est le seul worktree de config qui appartient au dépôt du code (`/Users/fr168256/lkdv`). Les trois autres sont des worktrees d'un second clone (`Desktop/kitduvoyageur_1783951966810`).

## 2. Méthode réellement utilisée

`vinext-cloudflare deploy` (vinext 1.3.0, `@vinext/cloudflare` 1.2.0).

Preuves :
- `lkdv-cf/package.json:96` → `"build:vinext": "vite build"` ; `"deploy:vinext": "vinext-cloudflare deploy"`
- `node_modules/@vinext/cloudflare/dist/deploy.js:386` → `existsSync("cloudflare.config.ts") ? "cf" : "wrangler"`
- `deploy.js:443` → binaire `node_modules/cf/bin/cf` (cf CLI v1.0.0-beta.21, **pas Wrangler**)
- `vinext-cloudflare deploy --dry-run` dans `lkdv-cf` → `Project: kitduvoyageur / Router: App Router / ISR: detected / Dry run complete`
- `cf workers deployments list --worker kitduvoyageur` → `source: cf_cli`, dernier déploiement `2026-10-25T17:33:57Z`

Ce n'est ni Wrangler, ni OpenNext, ni Vercel, ni GitHub Actions : les 10 workflows de `.github/workflows/` ne déploient rien sur Cloudflare (`ci.yml`, `lighthouse-ci.yml`, `ios*.yml`, `geo-*.yml`, `db-backup.yml`, `ops-alerts.yml`, `visual-regression.yml`). Vercel existe en parallèle (`.vercel/project.json`, `VERCEL_OIDC_TOKEN`) mais ne sert pas `workers.dev`.

## 3. Authentification

| Vérification | Résultat |
|---|---|
| `env \| grep -i cloudflare` | aucune variable |
| `~/.wrangler/config/default.toml` | absent |
| `~/.config/.wrangler/config/default.toml` | absent |
| `~/Library/Preferences/.wrangler/` | logs + metrics, **aucun credential** |
| `npx wrangler whoami` | **non authentifié** (2 logs wrangler du jour le confirment) |
| `cf auth whoami` | **authentifié**, token valide, OAuth via `~/Library/Preferences/cloudflare/config/default.json` |

`cf` : 1 compte, 1 profil `default` non lié à un répertoire, 45 secrets sur le Worker. **Rien à faire côté humain pour l'authentification** — `wrangler login` est inutile ici puisque Wrangler n'est pas l'outil de déploiement.

## 4. Commande exacte pour le code de `lkdv-messages`

Blocage structurel : `deploy/cf-pays` est une **branche orpheline** (root commit `50557255`, 8674 fichiers, `git merge-base` vide) portant un snapshot **plus ancien** du code (1881 fichiers d'écart avec messagerie). Donc pas de `git merge`, et `wrangler deploy --config ailleurs` est impossible (le build part du répertoire courant).

La plomberie à porter est exactement **5 fichiers** : `cloudflare.config.ts`, `vite.config.ts`, `empty-stub.js`, `.gitignore` (+`.vinext/`, `.cloudflare/`), et dans `package.json` **8 deps + 4 scripts** — ne pas prendre le `package.json` entier (il pin `react ^19.3.1` et ajoute `"type": "module"`).

```bash
cd /Users/fr168256/lkdv-messages

# 1. branche de déploiement
git switch -c deploy/messagerie chantier/messagerie-refonte

# 2. plomberie Cloudflare (3 fichiers tels quels)
git checkout deploy/cf-pays -- cloudflare.config.ts vite.config.ts empty-stub.js

# 3. package.json : ajouter à la main
#    scripts : dev:vinext, build:vinext, start:vinext, deploy:vinext
#    deps    : @vinext/cloudflare ^1.2.0, vinext ^1.3.0, @cloudflare/vite-plugin ^2.0.0-beta.v.4,
#              @vitejs/plugin-react ^6.1.2, @vitejs/plugin-rsc ^0.5.38, cf ^1.0.0-beta.21,
#              vite-css-modules ^1.16.0
printf '\n.vinext/\n.cloudflare/\n' >> .gitignore

# 4. installer (node_modules est aujourd'hui un symlink vers lkdv-pays, sans vinext)
npm install

# 5. validation sans build ni envoi
./node_modules/.bin/vinext-cloudflare deploy --dry-run

# 6. production
./node_modules/.bin/vinext-cloudflare deploy
```

Variables d'environnement nécessaires : **aucune** (auth OAuth déjà en place, un seul compte). `CLOUDFLARE_ACCOUNT_ID` inutile. Le build inline les `NEXT_PUBLIC_*` de `.env.local` du worktree : les jeux de noms sont identiques entre `lkdv-messages` et `lkdv-cf`, seules les valeurs sont à confirmer.

Temps estimé, première fois : `npm install` 2–5 min, build Vite 3–6 min, upload ~30 s → **6–12 min**.

Variante plus rapide (réutilise `node_modules` de 1,1 Go déjà en place) : depuis `lkdv-cf`, stasher les 12 fichiers modifiés (travail pays en cours), `git switch -c deploy/messagerie chantier/messagerie-refonte`, puis les 3 `git checkout` et le deploy. Sans le stash, le WIP pays part en production.

## 5. Risques

- **Quatre worktrees → un seul Worker.** Un deploy depuis `lkdv-cloudflare`, `lkdv-cf-carnet` ou `lkdv-cf-carnet2` écrase la prod avec un autre code. Contrôler `cloudflare.config.ts` avant chaque envoi.
- **`lkdv-cf` est sale** : 12 fichiers modifiés/untracked (pays) → deploy depuis là = publier du WIP.
- **`deploy/cf-pays` est plus ancienne** que messagerie : déployer depuis elle publie une prod sans la refonte.
- **Secrets** : 45 déjà présents sur le Worker (`AUDIT_*`, `BOOKING_PROVIDER`, `NEXT_PUBLIC_SUPABASE_*`, `STRIPE_*`, `VIATOR_*`, `LOCATIONIQ_API_KEY`, …). Un déploiement les conserve ; un nouveau nom exigé par le code devrait être ajouté (`cf workers secrets put`). Aucun secret à fournir pour le déploiement lui-même.
- **`vite build` ne lance pas `npm run prebuild`** (sprite d'icônes, worker maplibre, `verify/traveller_privacy.mjs`). Sprite (161 fichiers) et maplibre sont commités → pas de régression visuelle, mais le garde-fou privacy ne bloque plus le déploiement.
- **Domaine / route** : prod = `https://kitduvoyageur.faracitonyp.workers.dev` (200, `/messagerie` 200, `CF-RAY`, `Server: cloudflare`). Aucune route custom n'a pu être lue (`cf workers triggers` n'expose que `deploy`). L'alias `lkdv.app` est bloqué par le proxy du poste (cf. `AUDIT.md`).
- **Rollback** : `cf workers deployments create --worker kitduvoyageur --versions '[{"version_id":"<id>","percentage":100}]'` — dernier bon connu : version `3ed50c12-eb2a-4bd3-b9bd-84ce433ac5d1` (déploiement `5b330102`, 2026-10-25T17:33:57Z). Vérifier la forme exacte avec `--dry-run`. `wrangler rollback` est indisponible (non authentifié). Garde-fou : `vinext-cloudflare deploy --no-promote` envoie une version sans la promouvoir à 100 %, et `previews deploy` existe pour un aperçu.

## 6. Ce qui débloque quoi

- **Rien de bloquant côté authentification** : `cf auth whoami` est vert. Action humaine nécessaire uniquement pour le portage de la plomberie (§4) et pour vérifier les valeurs de `.env.local`.
- Si l'auth venait à expirer : `./node_modules/cf/bin/cf auth login` (OAuth navigateur), pas `wrangler login`.
