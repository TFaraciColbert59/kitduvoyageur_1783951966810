# Protocole de Mesure M0 — Arbitrage WebGL iPhone (Lot L5-0)

## 1. Contexte architectural (ADR-002)

Conformément à `ARCHITECTURE_TO_BE.md §5` et `PROMPT_ANTIGRAVITY_ARGON_HIGH.md`, l’architecture du HUB « Camp de base » et du Kit Studio applique **inconditionnellement l’arbitrage mono-contexte WebGL** via `WebGLArbiter` (`camp-map` XOR `bag-scene`).

Le banc statique `/test-m0.html` (`public/test-m0.html`, zéro route Next.js ajoutée) permet à Tony de mesurer empiriquement sur iPhone physique (Safari iOS & WKWebView Capacitor) le comportement mémoire et GPU lors de l’instanciation séquentielle vs simultanée d’un contexte MapLibre GL et d’un contexte Three.js.

## 2. Protocole reproductible sur iPhone physique

1. Démarrer le serveur local sur le Mac hôte :
   ```bash
   npm run build && npm run start
   ```
2. Connecter l’iPhone cible (modèle plancher recommandé : iPhone 12 / iOS 16+, ou iPhone disponible documenté explicitement) sur le même réseau local ou via câble USB + Web Inspector Safari (`Développement > <iPhone> > Onglet Mémoire / Chronologie`).
3. Ouvrir `http://<IP_LOCALE>:3000/test-m0.html` dans Safari iOS puis dans la WebView Capacitor LKDV.
4. Exécuter successivement :
   - **Scénario A — Arbitrage mono-contexte (comportement de production `WebGLArbiter`)** :
     5 cycles `Carte MapLibre -> Démontage -> Scène Sac Three.js -> Démontage -> Carte MapLibre`.
   - **Scénario B — Stress double contexte simultané (diagnostic M0 uniquement)** :
     Monter les deux contextes simultanément pendant 60 s avec rotation continue + tuiles raster.
5. Relever dans Web Inspector :
   - Pic mémoire GPU / WebContent process (Mo)
   - Nombre d’événements `webglcontextlost`
   - FPS médian et P95 frame time (ms)
   - Température ressentie / throttling éventuel après 3 minutes.

## 3. Statut de mesure de cette exécution

- **Statut** : `bloqué` (`non mesuré` sur appareil physique — aucun iPhone physique connecté à l’environnement d’exécution automatisé, aucune donnée inventée).
- **Décision appliquée dans le code** : `WebGLArbiter` actif par défaut et obligatoire (`camp-map` démonté avant montage de `bag-scene`, état caméra carte sauvegardé et restauré à la sortie du Studio).
