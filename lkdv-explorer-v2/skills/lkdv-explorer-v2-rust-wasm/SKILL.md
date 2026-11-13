---
name: lkdv-explorer-v2-rust-wasm
description: Use when optimizing Explorer v2 client geo computations (track simplification, elevation profile, off-route distance, isochrone) with a Web Worker and optionally Rust compiled to WebAssembly.
---
# Worker géo et Rust/WASM

- Interface unique `workers/geo.worker.ts` (Comlink non requis ; `postMessage` typé). Fonctions : `simplify`, `profile`, `distanceToRoute`, `isochrone`.
- Étape 1 : implémentation TypeScript + tests Vitest avec valeurs de référence.
- Étape 2 : `scripts/explorer-v2/bench-geo.mjs` (traces de 1 000 / 10 000 / 100 000 points, DEM 512²).
- Étape 3 (si gain ≥ 2× attendu) : crate `crates/lkdv-geo` (`wasm-bindgen`, `opt-level = "z"`, `lto = true`), `wasm-pack build --target web --release`, `wasm-opt -Oz`. Installation : `curl https://sh.rustup.rs -sSf | sh -s -- -y && cargo install wasm-pack` (gratuit).
- Adoption seulement si gain ≥ 2× **et** wasm ≤ 150 Ko gz ; sinon garder TS et consigner la mesure.
- Le worker décode les tuiles terrarium (`(R*256 + G + B/256) - 32768`) via `OffscreenCanvas` ou `createImageBitmap`.
- Isochrone : Dijkstra sur grille DEM avec vitesse de Tobler `6·exp(-3.5·|pente+0.05|)` km/h.
