# Déploiement & vérification — 25/10/2026 (mise à jour)

## Build

`npx next build` propre (dev arrêté, `.next` vide) : **Compiled successfully**, tableau `Route (app)` complet.
Deux causes d'échec corrigées : build concurrent avec `next dev` (PageNotFoundError global) et `string | null` sur le `src` d'un anneau.

## Recette sur le build de production local (`next start`)

| Route | 430 × 932 | 768 × 1024 | 1440 × 900 |
|---|---|---|---|
| `/pays/fr` | **19/19** | **19/19** | **19/19** |
| `/carnets/b2000000-…-011` | **19/19** | **19/19** | **19/19** |
| `/compte` (référence) | **19/19** | maquette 390 × 844 (hors contrat) | maquette (hors contrat) |

`/compte` au-delà de 430 est une **maquette de présentation** (châssis 390 × 844 mis à l'échelle) : elle ne peut pas respecter le contrat « colonne 430 ». La porte ne l'évalue donc qu'à 430 — c'est le contrôle qui prouve qu'elle mesure bien la grammaire.

## URL déployée

| | |
|---|---|
| URL | **https://kitduvoyageur-1783951966810-egm49obe7.vercel.app** |
| Porte 430 / 768 / 1440 | `/pays/fr` **19/19 · 19/19 · 19/19** — `/carnets/…011` **19/19 · 19/19 · 19/19** |
| Captures | `deploy2-pays-430.png` |

Pièges de vérification rencontrés :
- une preview **en cours de build** répond 200 avec « Deployment is building » → la porte échoue à 3/19. Attendre `Ready` **et** réchauffer la route avant de conclure ;
- un serveur `next start` fantôme sur le même port sert un **build périmé** (page à 2 299 px, sans `.phone`). Vérifier le port avant de mesurer.

## Prod Cloudflare

La prod est le Worker `kitduvoyageur.faracitonyp.workers.dev`, construit depuis `cloudflare/vinext`.
Blocage actuel, constaté : `wrangler whoami` → **non authentifié**, aucune variable `CLOUDFLARE_*` dans l'environnement, pas de `wrangler.jsonc` sur cette branche, et `git push` refusé (403) — impossible de déclencher la CI. La mise en production Cloudflare demande un merge sur `cloudflare/vinext` + `wrangler deploy` avec un token.
