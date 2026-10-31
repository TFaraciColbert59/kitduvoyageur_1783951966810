# Mesures de performance mobile — Explorer (31/10/2026)

## Ce qui a été mesuré, et comment

Serveur de **production local** (`next start`, build de `main`), page `/explorer`
(zone autorisée, HUB et Compas exclus), service worker désactivé pour éviter la
boucle de rechargement d'un build sans backend.

Deux profils, **3 passes chacun**, médiane + min/max :

| Profil | Moteur | Bridage |
|---|---|---|
| `webkit-iphone16pro` | WebKit (moteur Safari) | aucun |
| `chromium-iphone16pro-cpu4x-slow4g` | Chromium | CPU ×4 + réseau « Slow 4G » (150 ms RTT, 1,6 Mb/s) |

Commande reproductible :

```bash
npm run perf:mobile -- --url=http://127.0.0.1:4034 --runs=3 \
  --out=docs/cleanup/evidence/mobile-perf-explorer-lab.json
```

Résultats bruts : [`evidence/mobile-perf-explorer-lab.json`](evidence/mobile-perf-explorer-lab.json).

## Résultats (médiane, min–max sur 3 passes)

| Métrique | WebKit iPhone 16 Pro | Chromium CPU ×4 + Slow 4G |
|---|---:|---:|
| LCP | **396 ms** (336–556) | **3 024 ms** (3 008–3 040) |
| FCP | 319 ms (213–353) | 972 ms (948–980) |
| TTFB | 40 ms (23–106) | 17 ms (14–29) |
| CLS | 0 (0–0) | 0 (0–0) |
| Long tasks (> 50 ms) | 0 | **7 à 11** (637–938 ms cumulées) |
| Frame time p95 | 19 ms | 16,8 ms |
| Transfert | 2 102 Ko (79–87 requêtes) | 1 323 Ko (62 requêtes) |
| Mémoire JS | n/d (WebKit) | 23 Mo |

Machine : macOS arm64, `load average` ≈ 13 pendant les passes ; serveur local
(le TTFB ne reflète donc **pas** la latence réseau réelle de production).

## Lecture honnête

1. **Aucune amélioration globale n'est revendiquée.** Ces chiffres sont une
   **ligne de base labo mobile**, pas une comparaison avant/après : aucune
   mesure équivalente n'existe sur l'état antérieur.
2. Sous bridage mobile réaliste, **LCP ≈ 3,0 s** sur `/explorer` : l'objectif
   interne (≤ 2,0 s) n'est **pas** tenu. Le poste dominant est le JS de la carte
   et de l'application (1,3 Mo transférés, 62 requêtes).
3. **7 à 11 long tasks** sous CPU ×4 (jusqu'à 938 ms cumulées) : risque d'INP
   sur appareil milieu de gamme. À traiter par découpage/hydratation, pas par
   Rust.
4. Sans bridage (WebKit), la page est rapide (LCP 396 ms) : le contenu est prêt
   vite quand le CPU et le réseau suivent.
5. Le WebKit headless ne rend pas la carte 3D comme Safari sur appareil : ces
   chiffres mesurent le shell applicatif, pas le rendu GPU.

## Appareil physique : détecté mais non instrumenté

`xcrun devicectl list devices` voit un **iPhone 16 Pro physique**
(« iPhone de Tony », apparié, disponible) et deux simulateurs (iPhone 17,
iPhone 18 Pro). Aucune mesure automatisée n'est possible en l'état :

- mesurer Safari sur appareil exige WebDriverAgent / un runner XCUITest signé,
  non installé dans cet environnement ;
- le build Capacitor iOS demande une signature et un déploiement Xcode, hors
  périmètre de ce chantier ;
- `adb` est absent (pas de mesure Android) et la config MCP Maestro pointe vers
  un chemin Windows.

Statut : **BLOCKED** pour la mesure physique, avec ces causes exactes. Les
chiffres ci-dessus sont donc explicitement **labo émulés**, et le resteront
jusqu'à instrumentation d'un appareil.

## Ce qu'il faudrait pour aller plus loin

1. XCUITest/WebDriverAgent sur l'iPhone 16 Pro, profil de trace Instruments
   (Core Animation, Time Profiler) sur `/explorer` et `/communaute`.
2. Lighthouse mobile sur la preview de la PR (réseau réel, CDN) pour distinguer
   réseau et CPU.
3. Mesure du rendu carte (FPS GPU) : le WebKit headless ne l'expose pas.
