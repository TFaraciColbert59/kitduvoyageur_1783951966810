# Recette fiche carnet — Cloudflare Workers, 25 octobre 19 h

URL : https://kitduvoyageur.faracitonyp.workers.dev/carnets/9ba890ca-e071-5ab8-8624-6bd8a471a6c1
Branche : `cf/carnet-latest` (worktree `lkdv-cf-carnet2`), commit `d51c4e96`.

## Mesures 430 × 932 (relevé après déploiement)

| Ancre | Compte | Carnet | Écart |
|---|---|---|---|
| scrollHeight = innerHeight | oui | oui | — |
| top `.ig-top` / `.ckp-topbar` | 12/6/406×36 | 12/6/406×36 | 0 |
| carte | 12/48/406×541 | 12/48/406×541 | 0 |
| stats | 102/72 101×39 | 102/70 101×39 | y −2 |
| sélecteur | 320/549 88×30 | 320/549 88×30 | 0 |
| carte monde | 0/597/430×335 | 0/597/430×335 | 0 |
| barre basse | 14/868/402×48 | 14/868/402×48 | 0 |

## Écarts connus

1. Stats 2 px trop haut (bloc bio plus court d'une ligne).
2. Troisième libellé de la barre : `Communauté` (AccountBottomBar) au lieu de `Matériel` (barre du Compte). Composant partagé : décision requise.
3. Anneaux : 5 actions métier au lieu de 6 stories — contenu différent, grammaire identique (anneau 44/38).

## Déploiement

`npm run deploy:vinext` a publié trois fois un bundle périmé alors que le build local contenait `CarnetScreen`.
Secours : build puis `npx cf deploy --prebuilt` (`.cloudflare/output/v0`). Contrôle systématique :
`curl …/carnets/<id> | grep -c ckp-screen` ≥ 2, `ckp-shell` = 0. Cache ISR vidé (103 clés).
