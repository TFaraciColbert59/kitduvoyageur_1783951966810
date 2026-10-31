# Preuve P0 — `resampleTrack` bouclait jusqu'à l'OOM

## Constat (avant correction)

`src/features/explorer-v2/workers/geo.worker.ts` (HEAD `f89f5665`) :

```ts
let cursor = travelled;
while (cursor + segment >= nextAt && segment > 0) {
  …
  nextAt += stepM;
  cursor = nextAt;   // ← cursor avance avec nextAt
}
```

Après la première itération, `cursor === nextAt`, donc la condition devient
`nextAt + segment >= nextAt`, vraie pour tout `segment > 0` : la boucle ne sort
plus et empile des points jusqu'à saturer le tas.

## Exécution (31/10/2026, Node v26.8.2, macOS arm64)

Scénario : deux points à 1 km, `stepM = 60` (cas banal d'une route rectiligne).

```
node --max-old-space-size=256 docs/cleanup/evidence/repro-resample-legacy.mjs
```

Résultat : `FATAL ERROR: Ineffective mark-compacts near heap limit — JavaScript heap out of memory`,
`exit code 134` après ~3 s. Trace complète : [`resample-legacy-oom.txt`](resample-legacy-oom.txt).
Script de reproduction verbatim : [`repro-resample-legacy.mjs`](repro-resample-legacy.mjs).

## Après correction

Le moteur est déplacé dans `src/features/explorer-v2/geo/track.ts` (partagé
serveur + worker). Le même scénario produit 16 points en **0,4 ms** (test
`tests/explorer-v2/geo-track.spec.ts`, cas « échoue en boucle sur un segment
plus long que le pas »). La progression est bornée mathématiquement :
`nextAt` n'est plus recalé sur `travelled`, et un plafond `maxSamples` protège
des pas dérisoires.
