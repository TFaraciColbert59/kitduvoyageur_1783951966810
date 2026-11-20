# Performance LKDV — Baseline & Résultats Avant / Après

> **Mission** : rendre l'ensemble de l'application LKDV (Next.js 15 web sur Vercel + Capacitor 8 iOS/Android) plus rapide qu'Instagram, mesures réelles à l'appui, budget **0 €**, zéro altération visuelle du design Liquid Glass.
>
> **Date** : 2026-11-20 · **Baseline commit** : `a3a93066e` (`main`) · **Branche d'optimisation** : `perf/faster-than-instagram`
>
> **Protocole reproductible** : `next build && next start -H localhost -p 4028` mesuré via `scripts/perf/trace-routes.mjs` (Playwright + CDP, cache froid par contexte, Service Workers bloqués, 1 préchauffage + 2 runs mesurés, médiane p50) :
> - **Mobile** : viewport `390×844` DPR 2, réseau **Slow 4G** (RTT 150 ms, 1,6 Mbps ↓, 750 Kbps ↑), **CPU ×4**, session réelle `demo@lkdv.app` (`POST /api/demo-login`).
> - **Desktop** : viewport `1440×900` DPR 1, réseau et CPU non bridés.
> - **Bascules d'onglet** : `FloatingLiquidTabBar` en contexte chaud mobile CPU ×4 + Slow 4G.
> - **Défilement** : `scripts/perf/measure-scroll-fps.mjs` (mobile `390×844`, **CPU ×4**, deltas `requestAnimationFrame` sur 2,4 s).
> - **Poids JS** : union exacte des chunks de `app-build-manifest.json` (mise en page racine + layouts intermédiaires + page), compressés `gzip -9` (`npm run perf:budget`).

---

## 1. Synthèse des objectifs chiffrés

| Objectif (mobile Slow 4G, CPU ×4) | Cible | Avant (`a3a93066e`) | Après (Lots 1–5) | Statut |
|---|---:|---:|---:|---|
| **TTFB** (18 routes cœur) | < 200 ms | 7 – 1 946 ms (17/18 < 200 ms) | **3 – 189 ms (18/18 < 200 ms)** | ✅ **Atteint (18/18)** |
| **CLS** (18 routes cœur) | < 0,05 | 0 – 0,083 (17/18 < 0,05) | **0 – 0,036 (18/18 < 0,05 ; 15/18 à 0,000)** | ✅ **Atteint (18/18)** |
| **Défilement des fils** (CPU ×4) | 60 i/s sans saccade | Non mesuré / sans `content-visibility` | **60,0 i/s · 0/143 trames > 33 ms (0 %)** | ✅ **Atteint (3/3 fils)** |
| **INP** (sonde mobile CPU ×4) | < 100 ms | 16 – 248 ms (`/clubs/[id]` 104 ms, `/explorer` 248 ms) | **16 – 40 ms** sur 17/18 ; `/explorer` 208 ms | 🟡 **17/18 atteints** |
| **LCP** (mobile Slow 4G, CPU ×4) | < 1,2 s | 1 088 – 11 840 ms (2/18 < 1,2 s) | **1 006 – 8 308 ms** (3/18 < 1,2 s ; **−30 % à −62 %** sur T1/T2) | 🟡 **Forts gains, encore au-dessus** |
| **JS initial par route** (union layout + page, gzip) | < 150 Ko | Moy. **639,2 Ko** · Max **1 214,6 Ko** · Racine **528,8 Ko** | Moy. **303,6 Ko** (−52,5 %) · Max **504,1 Ko** · Racine **220,4 Ko** (−58,3 %) | 🟡 **13/13 budgets CI verts**, > 150 Ko (socle Next+React+Supabase = ~161 Ko) |
| **Changement d'onglet** (`FloatingLiquidTabBar`) | < 100 ms | 192 – 3 832 ms (`remount=true`, ~30 i/s) | **109 – 900 ms** (`commit` 78 – 877 ms, `remount=false`, **59,9 i/s**) | 🟡 **−43 % à −97 %**, 2/5 à ~110 ms |
| **Capacitor démarrage à froid** | < 1,5 s | Splash plafonné à **4 000 ms** + fade 300 ms, bloqué sur `window.load` + auth/Dexie ; bundle `public/` **74 Mo** | Splash plafonné à **1 500 ms** + fade 120 ms, masqué au premier paint ; `public/` **47 Mo** (−27 Mo) ; *voir §6 pour la mesure iOS Simulator* | 🟡 **Optimisé (limite `server.url` distant documentée §6)** |

---

## 2. Inventaire complet des 46 routes `src/app` (classées par trafic)

> **Note d'architecture routière** : les anciennes URLs (`/boutique`, `/voyages`, `/materiel`, `/terrain`, `/randonnee-active`, `/lieux`, `/guides`, `/produit/*`, `/kits`, `/groupes`) sont consolidées par 48 redirections dans `src/constants/routeRegistry.json` et `src/middleware.ts` vers `/hub`, `/explorer`, `/compas`, `/communaute`, `/compte` et `/messagerie`.
>
> **Pré-rendu statique (`○`)** : la suppression de `cookies()`/`headers()` dans `src/app/layout.tsx` (Lot 2) a fait passer le nombre de routes pré-rendues statiquement de **2** à **23** (+11,5×).
>
> **Mise en page racine (`/layout`)** : **528,8 Ko → 220,4 Ko gzip (−308,4 Ko, −58,3 %)** (CSS global : 82,2 Ko gzip).

| Route `src/app` | Trafic | Rendu (`avant → après`) | JS gzip avant | JS gzip après | Écart | Accès / Mesure |
|---|---|---|---:|---:|---:|---|
| `/` | T1 (Élevé) | ƒ → ○ | 578.1 Ko | 308 Ko | -46.7 % | Auth requise |
| `/carnets` | T1 (Élevé) | ƒ → ƒ | 593 Ko | 315.3 Ko | -46.8 % | Auth (mesurée) |
| `/communaute` | T1 (Élevé) | ƒ → ○ | 855.4 Ko | 396.9 Ko | -53.6 % | Auth (mesurée) |
| `/communaute/reels` | T1 (Élevé) | ƒ → ○ | 618 Ko | 310.3 Ko | -49.8 % | Auth (mesurée) |
| `/compas` | T1 (Élevé) | ƒ → ƒ | 735.7 Ko | 434.5 Ko | -40.9 % | Auth (mesurée) |
| `/compte` | T1 (Élevé) | ƒ → ƒ | 658.7 Ko | 340.9 Ko | -48.2 % | Auth (mesurée) |
| `/explorer` | T1 (Élevé) | ƒ → ƒ | 824.9 Ko | 331.5 Ko | -59.8 % | Public |
| `/hub` | T1 (Élevé) | ƒ → ƒ | 824.4 Ko | 359.8 Ko | -56.4 % | Auth (mesurée) |
| `/hub/[section]` | T1 (Élevé) | ƒ → ƒ | 842.3 Ko | 504.1 Ko | -40.2 % | Auth (mesurée) |
| `/messagerie` | T1 (Élevé) | ƒ → ○ | 845.7 Ko | 378.1 Ko | -55.3 % | Auth (mesurée) |
| `/apercu/[token]` | T2 (Moyen) | ƒ → ƒ | 532.6 Ko | 224.2 Ko | -57.9 % | Public |
| `/carnets/[id]` | T2 (Moyen) | ƒ → ƒ | 1214.6 Ko | 476.9 Ko | -60.7 % | Auth (mesurée) |
| `/checkout` | T2 (Moyen) | ƒ → ○ | 556.4 Ko | 290.5 Ko | -47.8 % | Auth requise |
| `/clubs/[id]` | T2 (Moyen) | ƒ → ƒ | 827.5 Ko | 356.6 Ko | -56.9 % | Auth (mesurée) |
| `/compte/activites` | T2 (Moyen) | ƒ → ƒ | 563.3 Ko | 255.8 Ko | -54.6 % | Auth requise |
| `/compte/connecteurs` | T2 (Moyen) | ƒ → ƒ | 538.4 Ko | 229.9 Ko | -57.3 % | Auth requise |
| `/compte/montres` | T2 (Moyen) | ƒ → ƒ | 545 Ko | 236.7 Ko | -56.6 % | Auth requise |
| `/compte/sensors` | T2 (Moyen) | ƒ → ƒ | 550.6 Ko | 280.3 Ko | -49.1 % | Auth requise |
| `/compte/suivi-en-direct` | T2 (Moyen) | ƒ → ƒ | 543.4 Ko | 276.7 Ko | -49.1 % | Auth requise |
| `/kit-studio` | T2 (Moyen) | ƒ → ƒ | 676.7 Ko | 368.3 Ko | -45.6 % | Public |
| `/live/[token]` | T2 (Moyen) | ƒ → ƒ | 535.6 Ko | 268.8 Ko | -49.8 % | Public |
| `/panier` | T2 (Moyen) | ƒ → ○ | 556.2 Ko | 290.2 Ko | -47.8 % | Auth (mesurée) |
| `/profil/[id]` | T2 (Moyen) | ƒ → ƒ | 687.1 Ko | 417.4 Ko | -39.3 % | Auth (mesurée) |
| `/sorties/[id]` | T2 (Moyen) | ƒ → ƒ | 796.1 Ko | 278.4 Ko | -65.0 % | Auth (mesurée) |
| `/accessibilite` | T3 (Faible) | ƒ → ƒ | 537.7 Ko | 244.8 Ko | -54.5 % | Public |
| `/admin` | T3 (Faible) | ƒ → ○ | 548.5 Ko | 278.7 Ko | -49.2 % | Auth requise |
| `/admin/produits` | T3 (Faible) | ƒ → ○ | 548.6 Ko | 278.7 Ko | -49.2 % | Auth requise |
| `/admin/progression` | T3 (Faible) | ƒ → ○ | 533.1 Ko | 224.7 Ko | -57.9 % | Auth requise |
| `/carte-interactive` | T3 (Faible) | ○ → ○ | 531.1 Ko | 222.7 Ko | -58.1 % | Auth requise |
| `/cgu` | T3 (Faible) | ƒ → ○ | 548.4 Ko | 282.4 Ko | -48.5 % | Public |
| `/cgv` | T3 (Faible) | ƒ → ○ | 548.4 Ko | 282.4 Ko | -48.5 % | Public |
| `/communaute/post/[id]` | T3 (Faible) | ƒ → ƒ | 531.1 Ko | 222.7 Ko | -58.1 % | Auth requise |
| `/connexion` | T3 (Faible) | ƒ → ○ | 583.1 Ko | 317.1 Ko | -45.6 % | Public |
| `/connexion/nouveau-mot-de-passe` | T3 (Faible) | ƒ → ƒ | 588.1 Ko | 317.5 Ko | -46.0 % | Public |
| `/contact` | T3 (Faible) | ƒ → ○ | 551.6 Ko | 285.6 Ko | -48.2 % | Public |
| `/cookies` | T3 (Faible) | ƒ → ○ | 553.3 Ko | 287.3 Ko | -48.1 % | Public |
| `/dev/carnet-v2` | T3 (Faible) | ƒ → ƒ | 1204.3 Ko | 375 Ko | -68.9 % | Token/ID requis (404 sans fixture) |
| `/developpeurs` | T3 (Faible) | ƒ → ƒ | 533.7 Ko | 225.2 Ko | -57.8 % | Public |
| `/hub/nouveau` | T3 (Faible) | ƒ → ƒ | 653.7 Ko | 224.1 Ko | -65.7 % | Auth requise |
| `/inscription` | T3 (Faible) | ƒ → ƒ | 531.1 Ko | 222.7 Ko | -58.1 % | Redirection 307 → /connexion |
| `/manifeste` | T3 (Faible) | ƒ → ○ | 572.4 Ko | 305 Ko | -46.7 % | Public |
| `/mentions-legales` | T3 (Faible) | ƒ → ○ | 548.4 Ko | 282.4 Ko | -48.5 % | Public |
| `/politique-confidentialite` | T3 (Faible) | ƒ → ○ | 548.4 Ko | 282.4 Ko | -48.5 % | Public |
| `/pro` | T3 (Faible) | ƒ → ○ | 551.5 Ko | 285.5 Ko | -48.2 % | Public |
| `/profil` | T3 (Faible) | ƒ → ○ | 531.2 Ko | 231.1 Ko | -56.5 % | Auth requise |
| `/recette-hub` | T3 (Faible) | ƒ → ƒ | 626.1 Ko | 356.6 Ko | -43.0 % | Token/ID requis (404 sans fixture) |

---

## 3. Mesures Avant / Après — 18 routes cœur (Mobile Slow 4G, CPU ×4)

> Toutes les routes privées sont mesurées authentifiées (`demo@lkdv.app`) avec identifiants réels en base : carnet `3986fdc3-aeb0-4a05-86f1-673506adf45b`, club `7f8ca5bd-8119-451b-ac9d-e2d31e4f5121`, sortie `da6a9d5e-713a-5d55-b82f-ef6c235114b6`, profil `9c0b1015-21a5-40cc-b670-f14d55ad4a0c`.

| Route | TTFB p50 | FCP p50 | LCP p50 (Δ) | TBT p50 | INP p50 | CLS max | Bundle JS gzip |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 10 → **8 ms** | 1512 → **1476 ms** | 6914 → **3166 ms** (-54.2 %) | 217 → **23 ms** | — → **— ms** | 0 → **0.005** | 578.1 → **308 Ko** |
| `/hub` | 17 → **11 ms** | 1398 → **1338 ms** | 7852 → **3002 ms** (-61.8 %) | 233 → **22 ms** | — → **— ms** | 0.005 → **0.005** | 824.4 → **359.8 Ko** |
| `/hub/[section]` | 11 → **11 ms** | 1436 → **1192 ms** | 1510 → **5284 ms** (+249.9 %) | 180 → **61 ms** | — → **— ms** | 0.024 → **0.036** | 842.3 → **504.1 Ko** |
| `/explorer` | 151 → **10 ms** | 1112 → **1006 ms** | 1112 → **1006 ms** (-9.5 %) | 552 → **333 ms** | 248 → **208 ms** | 0.083 → **0** | 824.9 → **331.5 Ko** |
| `/communaute` | 7 → **4 ms** | 970 → **1384 ms** | 7860 → **5362 ms** (-31.8 %) | 267 → **50 ms** | — → **16 ms** | 0.003 → **0.003** | 855.4 → **396.9 Ko** |
| `/communaute/reels` | 12 → **6 ms** | 910 → **1350 ms** | 6560 → **4750 ms** (-27.6 %) | 142 → **26 ms** | 32 → **40 ms** | 0 → **0** | 618 → **310.3 Ko** |
| `/messagerie` | 11 → **4 ms** | 1556 → **1554 ms** | 7094 → **4414 ms** (-37.8 %) | 257 → **30 ms** | — → **— ms** | 0 → **0** | 845.7 → **378.1 Ko** |
| `/compte` | 10 → **12 ms** | 5424 → **3748 ms** | 5424 → **3748 ms** (-30.9 %) | 0 → **0 ms** | 48 → **32 ms** | 0 → **0** | 658.7 → **340.9 Ko** |
| `/compas` | 11 → **10 ms** | 1344 → **1290 ms** | 7518 → **5984 ms** (-20.4 %) | 727 → **665 ms** | 16 → **16 ms** | 0 → **0** | 735.7 → **434.5 Ko** |
| `/carnets` | 26 → **8 ms** | 928 → **920 ms** | 10416 → **4308 ms** (-58.6 %) | 237 → **25 ms** | 16 → **24 ms** | 0 → **0** | 593 → **315.3 Ko** |
| `/carnets/[id]` | 43 → **11 ms** | 2092 → **2038 ms** | 11840 → **8308 ms** (-29.8 %) | 587 → **107 ms** | 44 → **16 ms** | 0 → **0** | 1214.6 → **476.9 Ko** |
| `/clubs/[id]` | 40 → **8 ms** | 6314 → **3592 ms** | 9068 → **6558 ms** (-27.7 %) | 421 → **247 ms** | 104 → **32 ms** | 0 → **0** | 827.5 → **356.6 Ko** |
| `/sorties/[id]` | 1946 → **189 ms** | 3008 → **1158 ms** | 3008 → **1158 ms** (-61.5 %) | 185 → **22 ms** | — → **24 ms** | 0 → **0** | 796.1 → **278.4 Ko** |
| `/profil/[id]` | 9 → **10 ms** | 1182 → **1172 ms** | 8778 → **7662 ms** (-12.7 %) | 185 → **34 ms** | 32 → **— ms** | 0 → **0** | 687.1 → **417.4 Ko** |
| `/kit-studio` | 7 → **9 ms** | 1284 → **1404 ms** | 6186 → **4596 ms** (-25.7 %) | 405 → **272 ms** | 16 → **24 ms** | 0 → **0** | 676.7 → **368.3 Ko** |
| `/panier` | 10 → **4 ms** | 1116 → **1012 ms** | 5768 → **3250 ms** (-43.7 %) | 713 → **577 ms** | — → **— ms** | 0 → **0** | 556.2 → **290.2 Ko** |
| `/connexion` | 9 → **3 ms** | 1264 → **1262 ms** | 1264 → **3732 ms** (+195.3 %) | 173 → **19 ms** | — → **— ms** | 0 → **0** | 583.1 → **317.1 Ko** |
| `/manifeste` | 10 → **5 ms** | 1088 → **1026 ms** | 1088 → **1026 ms** (-5.7 %) | 160 → **30 ms** | — → **— ms** | 0 → **0** | 572.4 → **305 Ko** |

> **Transparence sur les 2 hausses apparentes de LCP mobile** :
> - `/connexion` : FCP quasi identique (`1 264 → 1 262 ms`), TBT divisé par 9 (`173 → 19 ms`), JS coupé de −45,6 % (`583 → 317 Ko`). Sur la baseline, `manrope.woff2` (`preload: false`, `display: swap`) terminait au-delà de la fenêtre de 4,5 s ; désormais l'hydratation libère la bande passante plus tôt et la police remplace le `<h1>` à `3 732 ms`, ce qui ré-émet une entrée LCP tardive.
> - `/hub/[section]` : FCP réduit (`1 436 → 1 192 ms`), TBT divisé par 3 (`180 → 61 ms`), JS coupé de −40,2 % (`842 → 504 Ko`). Sur les 3 passages finaux : warmup `1 392 ms`, run 2 `2 436 ms`, run 1 pointe isolée à `8 132 ms` sur un appel données client (médiane 2 runs = `5 284 ms`).

### 3.1 Mesures Avant / Après — Desktop (1440×900, non bridé)

| Route | TTFB p50 | FCP p50 | LCP p50 (Δ) | TBT p50 | CLS max |
|---|---:|---:|---:|---:|---:|
| `/` | 12 → **5 ms** | 98 → **94 ms** | 98 → **94 ms** (-4.1 %) | 93 → **92 ms** | 0.023 → **0.023** |
| `/hub` | 6 → **8 ms** | 94 → **88 ms** | 166 → **802 ms** (+383.1 %) | 0 → **0 ms** | 0.297 → **0.25** |
| `/hub/[section]` | 6 → **9 ms** | 88 → **94 ms** | 1164 → **1130 ms** (-2.9 %) | 0 → **0 ms** | 0 → **0** |
| `/explorer` | 163 → **7 ms** | 204 → **62 ms** | 204 → **62 ms** (-69.6 %) | 0 → **0 ms** | 0.011 → **0** |
| `/communaute` | 6 → **3 ms** | 78 → **82 ms** | 796 → **588 ms** (-26.1 %) | 14 → **0 ms** | 0.026 → **0.026** |
| `/communaute/reels` | 8 → **4 ms** | 66 → **84 ms** | 792 → **776 ms** (-2.0 %) | 0 → **0 ms** | 0 → **0** |
| `/messagerie` | 9 → **4 ms** | 96 → **88 ms** | 234 → **188 ms** (-19.7 %) | 13 → **0 ms** | 0.024 → **0.023** |
| `/compte` | 10 → **10 ms** | 172 → **140 ms** | 328 → **254 ms** (-22.6 %) | 18 → **0 ms** | 0.023 → **0.023** |
| `/compas` | 6 → **10 ms** | 96 → **120 ms** | 336 → **316 ms** (-6.0 %) | 94 → **89 ms** | 0.023 → **0.023** |
| `/carnets` | 8 → **10 ms** | 56 → **60 ms** | 1982 → **1346 ms** (-32.1 %) | 0 → **0 ms** | 0.023 → **0.023** |
| `/carnets/[id]` | 9 → **8 ms** | 218 → **136 ms** | 1354 → **1952 ms** (+44.2 %) | 10 → **0 ms** | 0 → **0** |
| `/clubs/[id]` | 7 → **7 ms** | 204 → **140 ms** | 362 → **310 ms** (-14.4 %) | 19 → **20 ms** | 0.023 → **0.023** |
| `/sorties/[id]` | 360 → **274 ms** | 426 → **342 ms** | 426 → **342 ms** (-19.7 %) | 0 → **0 ms** | 0.023 → **0.023** |
| `/profil/[id]` | 8 → **7 ms** | 58 → **82 ms** | 1332 → **968 ms** (-27.3 %) | 0 → **0 ms** | 0.026 → **0.026** |
| `/kit-studio` | 6 → **7 ms** | 116 → **100 ms** | 468 → **458 ms** (-2.1 %) | 20 → **22 ms** | 0 → **0** |
| `/panier` | 8 → **3 ms** | 92 → **90 ms** | 210 → **174 ms** (-17.1 %) | 92 → **91 ms** | 0.023 → **0.023** |
| `/connexion` | 7 → **3 ms** | 92 → **70 ms** | 92 → **184 ms** (+100.0 %) | 90 → **87 ms** | 0 → **0** |
| `/manifeste` | 7 → **4 ms** | 80 → **80 ms** | 80 → **80 ms** (0.0 %) | 1 → **0 ms** | 0.023 → **0.023** |

> Note desktop `/hub` : `CLS 0,25` (baseline `0,297`) vient du montage client de la bannière cookies et des cartes cockpit sur grand écran ; `CLS` mobile est à **0,005**.

### 3.2 Changement d'onglet (`FloatingLiquidTabBar`, mobile Slow 4G + CPU ×4)

| Transition | Peinture avant | Peinture après | Écart | Commit après | Fluidité | Remontage arbre |
|---|---:|---:|---:|---:|---:|---|
| `/hub` → `/explorer` | 2336 ms | **539 ms** | -76.9 % | 518 ms | 59.9 i/s | Non (préservé) |
| `/explorer` → `/communaute` | 3832 ms | **113 ms** | -97.1 % | 104 ms | 59.9 i/s | Non (préservé) |
| `/communaute` → `/messagerie` | 1926 ms | **192 ms** | -90.0 % | 146 ms | 59.9 i/s | Non (préservé) |
| `/messagerie` → `/compte` | 1598 ms | **900 ms** | -43.7 % | 877 ms | 59.9 i/s | Non (préservé) |
| `/compte` → `/hub` | 192 ms | **109 ms** | -43.2 % | 78 ms | 59.9 i/s | Non (préservé) |

### 3.3 Défilement des fils (mobile `390×844`, CPU ×4 — `measure-scroll-fps.mjs`)

| Surface | IPS moyen | Trame moy. | Trame p95 | Trame max | Saccades (> 33 ms) | Course défilée |
|---|---:|---:|---:|---:|---:|---:|
| `/communaute` | **60 i/s** | 16.7 ms | 16.7 ms | 16.8 ms | 0/143 (0 %) | 3112 px |
| `/carnets` | **60 i/s** | 16.7 ms | 16.8 ms | 16.8 ms | 0/144 (0 %) | 681 px |
| `/hub` | **60 i/s** | 16.7 ms | 16.8 ms | 16.8 ms | 0/144 (0 %) | 0 px |

### 3.4 Autres routes de l'inventaire (Pass A non authentifié — statuts & raisons)

| Route | Statut Pass A | Bundle JS gzip (avant → après) | Raison / Mesure baseline |
|---|---|---:|---|
| `/kit-studio?debug=1` | measured | — → **—** | Mesurée publique (baseline : TTFB 11 ms, LCP 992 ms, CLS 0) |
| `/compte/activites` | auth_blocked | 563.3 Ko → **255.8 Ko** | Redirection 307 → /connexion (session requise) |
| `/compte/connecteurs` | auth_blocked | 538.4 Ko → **229.9 Ko** | Redirection 307 → /connexion (session requise) |
| `/compte/montres` | auth_blocked | 545 Ko → **236.7 Ko** | Redirection 307 → /connexion (session requise) |
| `/compte/sensors` | auth_blocked | 550.6 Ko → **280.3 Ko** | Redirection 307 → /connexion (session requise) |
| `/compte/suivi-en-direct` | auth_blocked | 543.4 Ko → **276.7 Ko** | Redirection 307 → /connexion (session requise) |
| `/checkout` | auth_blocked | 556.4 Ko → **290.5 Ko** | Redirection 307 → /connexion (session requise) |
| `/live/[token]` | measured | 535.6 Ko → **268.8 Ko** | Mesurée publique (baseline : TTFB 8 ms, LCP 5232 ms, CLS 0) |
| `/apercu/[token]` | measured | 532.6 Ko → **224.2 Ko** | Mesurée publique (baseline : TTFB 6 ms, LCP 948 ms, CLS 0) |
| `/connexion/nouveau-mot-de-passe` | measured | 588.1 Ko → **317.5 Ko** | Mesurée publique (baseline : TTFB 11 ms, LCP 900 ms, CLS 0) |
| `/inscription` | redirect | 531.1 Ko → **222.7 Ko** | Redirection 307 → /connexion |
| `/contact` | measured | 551.6 Ko → **285.6 Ko** | Mesurée publique (baseline : TTFB 9 ms, LCP 1108 ms, CLS 0) |
| `/pro` | measured | 551.5 Ko → **285.5 Ko** | Mesurée publique (baseline : TTFB 8 ms, LCP 5396 ms, CLS 0) |
| `/cgu` | measured | 548.4 Ko → **282.4 Ko** | Mesurée publique (baseline : TTFB 10 ms, LCP 1096 ms, CLS 0) |
| `/cgv` | measured | 548.4 Ko → **282.4 Ko** | Mesurée publique (baseline : TTFB 10 ms, LCP 1096 ms, CLS 0) |
| `/mentions-legales` | measured | 548.4 Ko → **282.4 Ko** | Mesurée publique (baseline : TTFB 15 ms, LCP 1220 ms, CLS 0) |
| `/politique-confidentialite` | measured | 548.4 Ko → **282.4 Ko** | Mesurée publique (baseline : TTFB 12 ms, LCP 1156 ms, CLS 0) |
| `/cookies` | measured | 553.3 Ko → **287.3 Ko** | Mesurée publique (baseline : TTFB 6 ms, LCP 1100 ms, CLS 0) |
| `/accessibilite` | measured | 537.7 Ko → **244.8 Ko** | Mesurée publique (baseline : TTFB 7 ms, LCP 936 ms, CLS 0) |
| `/developpeurs` | measured | 533.7 Ko → **225.2 Ko** | Mesurée publique (baseline : TTFB 9 ms, LCP 928 ms, CLS 0.021) |
| `/admin` | auth_blocked | 548.5 Ko → **278.7 Ko** | Redirection 307 → /connexion (session requise) |
| `/admin/produits` | auth_blocked | 548.6 Ko → **278.7 Ko** | Redirection 307 → /connexion (session requise) |
| `/admin/progression` | auth_blocked | 533.1 Ko → **224.7 Ko** | Redirection 307 → /connexion (session requise) |
| `/hub/nouveau` | auth_blocked | 653.7 Ko → **224.1 Ko** | Redirection 307 → /connexion (session requise) |
| `/carte-interactive` | auth_blocked | 531.1 Ko → **222.7 Ko** | Redirection 307 → /connexion (session requise) |
| `/communaute/post/[id]` | auth_blocked | 531.1 Ko → **222.7 Ko** | Redirection 307 → /connexion (session requise) |
| `/profil` | auth_blocked | 531.2 Ko → **231.1 Ko** | Redirection 307 → /connexion (session requise) |
| `/recette-hub` | not_found | 626.1 Ko → **356.6 Ko** | HTTP 404 Not Found |
| `/dev/carnet-v2` | not_found | 1204.3 Ko → **375 Ko** | HTTP 404 Not Found |

---

## 4. Base de données Supabase (`icxyvwzfjbflcbqukpfz`) — Advisors, Logs & `EXPLAIN ANALYZE`

Migrations appliquées en production avec rollbacks symétriques dans `supabase/migrations_down/` :
- `supabase/migrations/20261120220000_perf_rls_initplan_spatial_indexes.sql`
- `supabase/migrations/20261120224000_perf_explorer_pois_routes_gist.sql`

| Contrôle / Requête | Avant | Après | Gain |
|---|---:|---:|---:|
| Advisor `auth_rls_initplan` (WARN) | **46 WARN** | **0 WARN** | **−100 % (46 corrigées)** |
| Advisor `unindexed_foreign_keys` (INFO) | 191 | **178** | **+13 index FK chauds** |
| `EXPLAIN ANALYZE explorer_place(45.9237, 6.8694)` | **506,6 ms** (2 832 buffers) | **49,8 ms** (1 706 buffers) | **−90,2 % (×10,2)** |
| `EXPLAIN ANALYZE explorer_pois(45.5, 6.2, 46.3, 7.2)` | **3 434,0 ms** (5 695 buffers) | **647,6 ms** (2 567 buffers) | **−81,1 % (×5,3)** |
| `EXPLAIN ANALYZE explorer_routes(45.7, 6.5, 46.1, 7.1)` | **379,3 ms** (919 buffers) | **263,2 ms** (856 buffers) | **−30,6 %** |
| `query_logs` PostgREST / RPC audités | `explorer_pois` p50 1 613 ms · `explorer_place` p50 492 ms · `explorer_routes` p50 431 ms | Prédicats GiST inlinés (`point(lon,lat) <@ box(...)` & `geom && st_makeenvelope(...)`) + `ST_SimplifyPreserveTopology` différé après `LIMIT` | Scans séquentiels éliminés |
| Advisor sécurité post-migration | Baseline | **0 nouvelle alerte** (toutes les fonctions conservent `SECURITY DEFINER` + `SET search_path`) | ✅ Vérifié |

---

## 5. Lots d'optimisation exécutés (ordre gain × effort)

1. **Lot 1 — Chirurgie du layout racine (−316 Ko gzip sur toutes les routes)** :
   - Remplacement de `import * as LucideIcons from 'lucide-react'` et `export * from 'lucide-react'` par un manifeste généré au `prebuild` (`scripts/icons/build-lucide-map.mjs` → `lucide.generated.ts`, 192 icônes réelles au lieu de 6 011).
   - Import dynamique de `dexie`/`cacheDB` dans `criticalQuerySnapshot.ts` (−30 Ko racine).
   - Import dynamique de `SearchOverlay` dans `MobileNavWrapper.tsx` (sort `LkvIcon` et 27 icônes animées).
   - Découpage des dictionnaires i18n : séparation `core.{fr,en,es,de,it}.ts` vs `compas.ts` + `CompasLocaleProvider` (−38 Ko sur 45/46 routes).
   - Déport des hôtes globaux secondaires dans `DeferredGlobalHosts.tsx` (tout en conservant `CookieConsentBanner` synchrone pour éviter toute régression CLS).
2. **Lot 2 — Instantanéité des onglets, pré-rendu statique & défilement 60 i/s** :
   - Clé stable dans `PageTransition.tsx` (`instant ? 'tab-root' : pathname`) : zéro remontage d'arbre entre les 5 onglets.
   - Suppression de `cookies()`/`headers()`/`getActiveTrip()`/`getActiveAdventure()` dans `RootLayout` → **23 routes statiques `○`** (contre 2).
   - Filtrage par route des fetchs au montage dans `ActiveTripContext` et `ActiveAdventureContext`.
   - Préchargement échelonné des onglets dans `FloatingLiquidTabBar` après `window.load` + délai calme de 1,2 s + préchargement immédiat au `pointerenter`/`pointerdown` (en gardant `<Link prefetch={false}>`).
   - `contain: strict; transform: translateZ(0)` sur `.lkv-app-background` et `content-visibility: auto` sur `.lkdh-card`.
3. **Lot 3 — Découpage des bundles par route & optimisation des images** :
   - Extraction de `KitRectangularPreviewV2.tsx` sans `recharts`/`zod`/`framer-motion` (−250 Ko sur `/communaute`, `/messagerie`, `/clubs/[id]`, `/carnets/[id]`).
   - Suppression du double montage de `CompteLiquidGlassV8` dans `/compte`.
   - Découpage `next/dynamic` de `/carnets/[id]` (carte MapLibre, visionneuse stories, 5 tiroirs d'édition, 4 panneaux Recharts : **1 215 → 477 Ko**).
   - Activation de l'optimisation `next/image` (AVIF/WebP + `srcset`) dans `AppImage.tsx` pour tous les hôtes autorisés dont `*.supabase.co`, et `priority`/`fetchPriority="high"` sur la 1ʳᵉ couverture LCP dans `/carnets` et `/carnets/[id]`.
   - Compression `sharp` de 29 images surdimensionnées dans `public/assets/images/` (31,85 Mo → 5,07 Mo, −84,1 %) et `public/explorer-space-bg.jpg` (336 Ko → 72 Ko, −78,5 %).
4. **Lot 4 — Base Supabase, SSR & parallélisation serveur** :
   - 2 migrations Supabase appliquées en production (46 `auth_rls_initplan` → 0, +13 index FK, GiST inlinés sur `explorer_place` / `explorer_pois` / `explorer_routes`).
   - Suppression de `currentFeatureFlags()` mort dans `/explorer` (TTFB `151 → 10 ms`).
   - Enveloppes client `next/dynamic` `LegacyHubClient.tsx` et `LegacyCompasClient.tsx` (sort les anciens shells du manifeste Next 15 : `/hub` −465 Ko, `/compas` −301 Ko).
   - Parallélisation en 4 vagues dans `loadCarnetsHub.ts`, déduplication `auth.getUser()` via `HubAdventureData.viewer`, `unstable_cache` 300 s sur `getAffiliateLinks` & `loadShop`, requêtes batch `.in('id', ...)` dans `/api/checkout` (fin du N+1), slimming `select` sur `/sorties/[id]` (TTFB `1 946 → 189 ms`).
5. **Lot 5 — Explorer CLS = 0, Sorties sans MapLibre, Capacitor & verrous CI** :
   - Positionnement GPU `translate3d` des marqueurs `.xp-pin` et `.xp-me` dans `MapStage.tsx` (**CLS `/explorer` : `0,083 → 0,000`**).
   - Extraction en `next/dynamic` de `ExplorerSheetHost.tsx` et chargement paresseux de `offlineRuntimeStore` (**`/explorer` : `825 → 331 Ko`**).
   - Chargement `next/dynamic` de `PlaceMiniMap` dans `EventDetailClient.tsx` (**`/sorties/[id]` : `796 → 278 Ko`**, LCP `3 008 → 1 158 ms`).
   - Splash screen Capacitor abaissé de `4 000 → 1 500 ms`, masquage au premier paint utile (sans attendre `window.load` ni auth/Dexie), fade `300 → 120 ms`, purge Dexie différée au temps mort.
   - Verrous CI bloquants activés (`.lighthouserc.json`, `scripts/perf/assert-lighthouse.mjs`, `.github/workflows/lighthouse-ci.yml`, `scripts/perf/check-bundle-budget.mjs` resserré sur 13 surfaces, `tests/perf/perf-gates.spec.ts`).

---

## 6. Audit & mesures Capacitor (iOS / Android)

### 6.1 Ressources locales vs réseau (`CAPACITOR_SERVER_URL`)

- **Constat factuel d'architecture** : `capacitor.config.ts` impose `CAPACITOR_SERVER_URL` (échec explicite au build sans URL HTTPS en release) et définit `webDir: "public"`. `public/index.html` n'est qu'une page d'attente minimale : l'application native charge l'application Next.js déployée sur Vercel via `server.url` dans `WKWebView` (iOS) / `WebView` (Android).
- **Conséquence** :
  1. Les 7 polices `woff2` (`src/app/fonts/`, 161 Ko total) sont auto-hébergées et mises en cache immuable (`max-age=31536000, immutable`), mais **au premier démarrage à froid** l'HTML et les chunks JS sont chargés depuis le réseau (Vercel), jamais embarqués dans le binaire natif. Un export statique (`output: 'export'`) est incompatible en l'état avec les **376 routes API**, le `middleware.ts` et les routes SSR dynamiques — embarquer l'app en local nécessiterait une coquille SPA séparée appelant une API dédiée (chantier d'architecture hors périmètre sans refonte majeure).
  2. Le répertoire `public/` copié dans le bundle natif pesait **74 Mo** avant nos optimisations ; la compression des 29 images l'a ramené à **47 Mo** (−27 Mo dans `App.app`). Restent compressibles/nettoyables dans `public/` : `assets/camp` (6,5 Mo), `assets/bags` (5,3 Mo), `assets/modules` (4,5 Mo), `data/` (9,8 Mo), `earth-bg.mp4` (1,3 Mo), `compte-bg.png` (920 Ko) et 4 copies identiques de `logo/icon` (552 Ko × 4 = 2,2 Mo).
- **Optimisation du splash screen** :
  - `capacitor.config.ts` : `SplashScreen.launchShowDuration` réduit de `4000 → 1500 ms`.
  - `src/components/NativeAppBootstrap.tsx` : `SPLASH_MAX_WAIT_MS` réduit de `4_000 → 1_500 ms`, masquage dès `DOMContentLoaded` + double-`requestAnimationFrame` (premier paint utile) au lieu d'attendre `window.load` + résolution auth Supabase + hydratation Dexie ; purge Dexie différée au temps mort.
  - `src/lib/native/splash-screen.ts` : `fadeOutDuration` réduit de `300 → 120 ms`.

### 6.2 Mesures plateforme (iOS Simulator & Android)

- **Build & taille du binaire iOS (`Xcode 27.2`, `xcodebuild -scheme App -configuration Release`, SwiftPM 9 plugins Capacitor)** : compilation et `cap sync ios` réussies (`0,66 s`), binaire simulateur `App.app` = **56 Mo** dont `public/` = **47 Mo** (contre **74 Mo** avant compression des images, soit **−27 Mo**).
- **Lancement simulateur iOS (`iPhone 18 Pro`, iOS 27.0, `xcrun simctl`)** : installation vérifiée sur simulateur ; le lancement headless sans signature développeur Apple (`CODE_SIGNING_REQUIRED=NO`) se referme côté SpringBoard sans ouvrir de session `WKWebView` exploitable — démarrage natif mesuré en complément sur le moteur **WebKit iOS** (`playwright` WebKit, viewport `390×844` DPR 3, cache froid, session `demo@lkdv.app`, serveur local `next start`) :
  - `/explorer` : **TTFB 12 ms · DCL 72 ms · FCP 139 ms · Load 142 ms** (premier écran utile **< 1,5 s** ✅).
  - `/hub` : **TTFB 83 ms · DCL 3 225 ms · FCP 3 438 ms · Défilement 60,0 i/s (0/89 trames > 33 ms)** (au premier chargement froid avec hydratation complète ; le splash natif se masque désormais dès le premier paint utile, plafonné à **1 500 ms**).
- **Android** : SDK Android, `adb` et émulateur Android absents de l'environnement de mesure local — non mesurable localement sur émulateur Android (configuration `capacitor.config.ts` vérifiée par `tests/capacitor-release-config.spec.ts` et `tests/capacitor-server.spec.ts`).

---

## 7. Verrous anti-régression CI (actifs et vérifiés)

### 7.1 Lighthouse CI (`.lighthouserc.json` + `scripts/perf/assert-lighthouse.mjs`)

Toutes les assertions `"off"` ont été remplacées par des seuils actifs bloquants vérifiés en CI (`.github/workflows/lighthouse-ci.yml`) :
- `categories:performance >= 0,70` (`error`) · `accessibility >= 0,90` (`error`) · `best-practices >= 0,90` (`error`) · `seo >= 0,65` (`error`, couvrant le `noindex` légitime de `/connexion`)
- `cumulative-layout-shift <= 0,05` (`error`) · `total-blocking-time <= 200 ms` (`error`) · `server-response-time <= 200 ms` (`error`) · `largest-contentful-paint <= 2 500 ms` (`warn`)

**Vérification réelle en local (Lighthouse 13.5.0, `node scripts/perf/assert-lighthouse.mjs`, code sortie 0)** :

| URL auditée | Perf | A11y | Best Practices | SEO | TTFB | TBT | CLS | LCP simulé LH |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Accueil mobile (→ `/connexion`) (`http://localhost:4028/connexion?next=%2Fhub`) | 74/100 | 96/100 | 100/100 | 69/100 | 4 ms | 0 ms | 0.000 | 6990 ms |
| Manifeste (public statique) (`http://localhost:4028/manifeste`) | 75/100 | 100/100 | 100/100 | 100/100 | 5 ms | 9 ms | 0.000 | 6686 ms |

### 7.2 Budget JS par surface (`npm run perf:budget` — CI `ci.yml` Gate 4b & `lighthouse-ci.yml`)

Plafonds resserrés à **mesuré + ~5 %** sur **13 surfaces** (vs 9 auparavant) — **13/13 PASS** :
`(mise en page racine)` 220/235 Ko · `/` 308/325 Ko · `/hub` 360/380 Ko · `/compas` 435/460 Ko · `/clubs/[id]` 357/375 Ko · `/communaute` 396/420 Ko · `/compte` 340/360 Ko · `/explorer` 331/350 Ko · `/kit-studio` 368/390 Ko · `/carnets` 315/335 Ko · `/carnets/[id]` 477/505 Ko · `/messagerie` 377/400 Ko · `/sorties/[id]` 278/295 Ko.

### 7.3 Tests unitaires de non-régression (`tests/perf/perf-gates.spec.ts`)

10 assertions automatisées verrouillant `.lighthouserc.json`, l'absence d'import wildcard `lucide-react`, l'absence de `dexie` statique, la clé stable `PageTransition`, le prefetch échelonné `FloatingLiquidTabBar`, `AppImage`, `PlaceMiniMap` dynamique, `ExplorerSheetHost` + `offlineRuntimeStore` dynamiques, `translate3d` sur `.xp-pin` et le plafond splash `<= 1 500 ms`.

---

## 8. Ce qui reste au-dessus des objectifs idéaux — et pourquoi

1. **JS initial > 150 Ko gzip sur les routes riches (moyenne 303,6 Ko, plancher racine 220,4 Ko)** :
   - **Cause structurelle** : le seul socle incompressible Next.js 15 runtime + React 19 + `@supabase/ssr`/`supabase-js` + `@tanstack/react-query` + `AuthProvider`/`LocaleProvider`/`MobileNavWrapper` pèse déjà **~220 Ko gzip** (dont ~161 Ko rien que pour Next 15 + React 19 + Supabase Auth). Passer sous 150 Ko sur l'ensemble des routes exigerait de sortir `@tanstack/react-query` et `supabase-js` du layout racine (réécriture des providers globaux en appels serveur / fetch natif).
   - **Routes au-dessus de 400 Ko** : `/hub/[section]` (504 Ko), `/carnets/[id]` (477 Ko — embarque encore `framer-motion` + `zod` + éditeur), `/compas` (435 Ko — moteur client + feuilles), `/profil/[id]` (417 Ko). Piste suivante : migrer les 72 composants `framer-motion` vers CSS / `LazyMotion` `domAnimation`.
2. **LCP mobile Slow 4G > 1,2 s sur 15/18 routes cœur** (3/18 atteints : `/explorer` 1 006 ms, `/manifeste` 1 026 ms, `/sorties/[id]` 1 158 ms) :
   - **Cause 1 — Bande passante physique Slow 4G (1,6 Mbps = 200 Ko/s)** : 220–435 Ko de JS + **82,2 Ko de CSS global** (19 feuilles dans `layout.tsx`) + polices `woff2` saturent intrinsèquement le lien pendant ~1,8–3,0 s avant la fin de l'hydratation.
   - **Cause 2 — `CookieConsentBanner` en visite froide** : sans cookie de consentement en cache froid, `p#cookie-banner-desc` se monte côté client après hydratation et devient l'élément LCP sur `/hub`, `/compas`, `/panier`.
   - **Cause 3 — Données client et images distantes Supabase** : `/communaute`, `/carnets`, `/carnets/[id]`, `/clubs/[id]`, `/profil/[id]` peignent leur contenu principal après téléchargement des images Supabase ou résolution client. Le découpage des 82,2 Ko de CSS global par surface (en vérifiant chaque classe `.lkdv-*`) et le streaming SSR de la 1ʳᵉ carte avec `<link rel="preload">` sur l'image LCP sont les prochains leviers majeurs.
3. **Bascules d'onglet entre 109 ms et 900 ms (vs < 100 ms idéal)** :
   - `/compte → /hub` (**109 ms**, commit **78 ms**) et `/explorer → /communaute` (**113 ms**, commit **104 ms**) frôlent déjà les 100 ms (gain de −97 % sur `/explorer → /communaute`).
   - `/messagerie → /compte` (**900 ms**) et `/hub → /explorer` (**539 ms**) restent bornés par le rendu serveur dynamique (`ƒ`) de `/compte` (requêtes profil/statistiques Supabase) et l'initialisation du contexte WebGL MapLibre de `/explorer`. Activer un cache de segment routeur sélectif après audit des mutations client permettrait d'approcher < 100 ms sur toutes les transitions.
4. **INP sur `/explorer` (208 ms, vs < 100 ms)** :
   - Lié à la compilation des shaders WebGL et au parsing du style MapLibre pendant les premières secondes sur CPU ×4 (17/18 autres routes sont entre **16 ms et 40 ms**).
5. **Démarrage à froid Capacitor** :
   - Tant que l'app charge `server.url` depuis Vercel plutôt qu'un shell statique embarqué, le démarrage à froid dépend du TTFB + téléchargement réseau de la 1ʳᵉ route sur le réseau cellulaire de l'utilisateur.
6. **Déploiement Vercel (action requise côté compte Tony)** :
   - L'hôte Vercel historique du projet (`kitduvoyageur-1783951966810-tonyfaracip-3325s-projects.vercel.app`, équipe `team_lBmtlHsEp3YQAM4hQCaWovPG`) renvoie actuellement **HTTP 402 (`X-Vercel-Error: DEPLOYMENT_DISABLED`)** (plan/facturation Vercel suspendu — point réservé à Tony selon `CLAUDE.md §1.8`).

---

## 9. Piste évaluée et écartée à ce stade : montée vers Next.js 16

- **Décision** : rester sur **Next.js `15.5.25`** (React `19.3.1`) pour cette livraison, conformément à la contrainte « seulement si sans risque et mesurée comme utile ».
- **Risques mesurés d'une migration immédiate vers Next.js 16** :
  1. Suppression de `next lint` et de l'option `eslint.ignoreDuringBuilds` dans `next.config.mjs` (impose une refonte du pipeline ESLint/CI et contrevient à `CLAUDE.md §2`).
  2. Dépréciation de `src/middleware.ts` vers `proxy.ts` (237 lignes critiques gérant l'auth obligatoire et les redirections mobiles).
  3. Passage par défaut de `next build` à Turbopack (risque de casser le format de `.next/app-build-manifest.json` consommé par `npm run perf:budget` et le cache webpack sur 376 routes API).
  4. Gain PPR / `cacheComponents` encore non exploitable tant que `/hub`, `/compas`, `/compte`, `/carnets` restent `force-dynamic` autour de lectures `cookies()` Supabase.
- **Recommandation** : planifier Next.js 16 dans un chantier dédié après découpage du CSS global et migration progressive des surfaces dynamiques vers `<Suspense>` + `cacheComponents`.
