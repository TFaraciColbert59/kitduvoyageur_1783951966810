# PERFORMANCE BUDGET — `/explorer` (moteur ATLAS unifié)

> Règle PERF-R3 : `/explorer` n'est **pas** comparé au budget 170 Ko du reste de
> l'app. La carte WebGL a son propre budget, mesuré, distinct du budget applicatif.

## Deux budgets séparés

| Budget | Métrique | Valeur mesurée | Où c'est mesuré |
|---|---|---|---|
| **A — Shell applicatif** | « First Load JS » Next.js (hors carte, hors chunks `dynamic`) | **265 Ko** (shared 104 Ko) | `npm run build` (table des routes) |
| **B — Moteur carte (lazy)** | JS réellement téléchargé pour rendre la carte (après hydratation) | **286 Ko gzip** (1 124 Ko brut) | `node scripts/perf/measure-maplibre.mjs` |

### Détail budget B — `maplibre-gl@6.4.1` (mesuré le 2026-09-12)

```
fichier                                                           brut        gzip
maplibre-gl.mjs                                                 554 Ko      139 Ko
maplibre-gl-shared.mjs                                          471 Ko      131 Ko
maplibre-gl-worker.mjs                                           18 Ko        6 Ko
maplibre-gl.css                                                  81 Ko       10 Ko
TOTAL                                                          1124 Ko      286 Ko
```

**Total « carte utilisable » ≈ 265 Ko (shell) + ~280 Ko (lib + worker + css) ≈ 545-550 Ko gzip.**
Le chiffre 265 Ko seul mesurait le First Load JS strict, qui **exclut par construction**
les imports `dynamic(..., { ssr: false })` — il ne contenait donc jamais la carte.

## Pourquoi ce n'est pas une régression

Il n'existe pas de version officiellement allégée de MapLibre GL JS pour un rendu
de globe WebGL. La bonne réponse n'est pas de tordre la métrique : c'est de la
**séparer** et de la **surveiller**. Aucune de ces valeurs ne doit être présentée
comme « ≤ 170 Ko » dans un rapport.

## Commandes de mesure (à rejouer à chaque audit)

```bash
node scripts/perf/measure-maplibre.mjs     # poids réel de la lib (brut + gzip)
npm run analyze                            # build + rapports .next/analyze/{client,nodejs,edge}.html
npm run build                              # table des routes (First Load JS par route)
```

## Cache

Les assets `/_next/static/*` sont servis par Next.js avec
`Cache-Control: public, max-age=31536000, immutable` (défaut). `next.config.mjs`
ne définit que des en-têtes de sécurité (HSTS, X-Frame-Options, etc.) et
n'écrase pas ce cache — vérifié après build en P4.

## Leviers restants (hors périmètre de ce chantier)

- Réduire le shell applicatif (104 Ko shared) : dépendances partagées, shell explorer.
- Chargement progressif : ne payer le worker/css qu'à l'ouverture réelle de la carte.
- Fournisseur de tuiles de production (fiabilité + latence perçue en absolu).
