# RESEARCH_LOG.md — Journal des Recherches Scientifiques, Universitaires & GitHub
<!-- Budget max : 120 lignes | Synthèse max 5 lignes par sujet pour ne jamais refaire deux fois la même recherche -->

## Physiologie & Science du Sport (Validées dans Explorer v2)
- **Minetti et al. (2002) — Coût énergétique de la marche/course en pente** : polynôme degré 5 (`Cr(i)`) utilisé dans `computeSlopeAdjustedPace` (GAP) pour convertir allure en côte/descente en allure équivalente sur plat.
- **Banister (1975) — Fitness-Fatigue (CTL / ATL / TSB)** : moyennes exponentielles 42j (CTL) / 7j (ATL) et delta Avant→Après session dans `computeTrainingLoad`.
- **EWMA ACWR & DOMS Excentriques** : fenêtre métabolique 96h, pic DOMS excentriques 18–48h en D-, acclimatation altitude 21j dans `computeExplorerReadiness`.
- **Riegel (1981)** : prédictions de temps de course $T_2 = T_1 \cdot (D_2/D_1)^{1.06}$ dans `computeRacePredictions`.
- **NOAA Solar Calculations (offline)** : éphémérides lever/coucher/crépuscule civil sans appel réseau dans `computeOfflineDaylight`.

## Cartographie & Open-Data 0 €
- **Waymarked Trails / OSM** : API publique gratuite (`hiking`, `cycling`, `mtb`, `slopes`) branchée sur `/api/explorer/v2/outdoor-routes` avec polylignes GeoJSON live.
- **AWS Terrarium DEM** : tuiles RGB PNG publiques (`0 €`) décodées en pur JS (compatible Cloudflare Workers, 0 binaire natif).
- **Cloudflare Workers + Next.js 15 (`vinext`)** : `@vinext/cloudflare` + `empty-stub.js` remplace Vercel sans coût serverless supplémentaire.
