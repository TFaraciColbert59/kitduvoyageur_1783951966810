# Bundle — baseline mesurée (31/10/2026)

Source : `npm run build` sur la branche P0 (base `f89f5665`), Next.js 15.5.25,
sortie officielle `Route (app)` de `next build`. Tailles **parsed** affichées
par Next (kB), pas gzip. Aucune mesure Lighthouse n'a été exécutée localement
(pas de serveur de preview autorisé) — voir `BASELINE.md`.

## Socle partagé

| Élément | Taille |
|---|---:|
| First Load JS shared by all | **105 kB** |
| — `chunks/4bd1b696` | 54,2 kB |
| — `chunks/1255` | 46,0 kB |
| — autres chunks partagés | 4,49 kB |
| Middleware | 98,9 kB |

## Routes les plus lourdes (First Load JS)

| Route | Page | First Load JS |
|---|---:|---:|
| `/hub/[section]` | 95,1 kB | **596 kB** |
| `/hub` | 61,3 kB | **554 kB** |
| `/compas` | 16,2 kB | **537 kB** |
| `/dev/compas-v5` | 228 B | 512 kB |
| `/connexion` | 6,19 kB | 461 kB |
| `/communaute` | 67,1 kB | 413 kB |
| `/pays/[code]` | 39,9 kB | 387 kB |
| `/messagerie` | 21,9 kB | 340 kB |
| `/compte` | 94,7 kB | 285 kB |
| `/` | 5,03 kB | 271 kB |
| `/communaute/reels` | 20,9 kB | 266 kB |
| `/panier` | 6,85 kB | 250 kB |
| `/explorer` | 35,3 kB | **156 kB** |

## Lecture

- L'objectif historique « shell Explorer ≤ 170 kB » est **tenu** : `/explorer`
  = 156 kB First Load JS (dont 105 kB partagés).
- Le poste dominant des routes lourdes est le **socle partagé** (105 kB) plus
  les composants de route (`/hub` 61 kB, `/compte` 95 kB, `/communaute` 67 kB).
  `/hub/[section]` et `/hub` portent 450–490 kB au-delà du socle.
- **Le worker géo n'apparaît pas dans le bundle** : `useGeoProfile` n'est
  importé par aucun écran (grep exhaustif `src/`, `tests/`, `scripts/`), donc le
  hook et son worker sont éliminés par le tree-shaking. Le correctif P0 est
  livré et testé, mais son coût bundle est **nul tant qu'il n'est pas branché**.
  C'est un constat, pas une recommandation de branchement : le profil affiché
  reste calculé côté serveur par choix produit.
- Aucune optimisation de bundle n'a été appliquée dans ce chantier : les pistes
  crédibles (dynamic import des panneaux `/hub`, allègement des composants
  `compte`/`communaute`, analyse `@next/bundle-analyzer` complète) exigent une
  validation visuelle E2E indisponible ici. Changer le découpage des chunks sans
  recette visuelle serait un pari, pas une optimisation prouvée.

## Comment reproduire

```bash
NODE_OPTIONS=--max-old-space-size=6144 \
NEXT_PUBLIC_SUPABASE_URL="https://ci-build-placeholder.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="<placeholder CI>" \
npm run build
```

Durée mesurée : compilation 3,0 min ; build complet ~25 min sur une machine
partagée (load average 30–150 pendant l'exécution). Les chiffres de bundle ne
dépendent pas de la charge ; les durées, si.
