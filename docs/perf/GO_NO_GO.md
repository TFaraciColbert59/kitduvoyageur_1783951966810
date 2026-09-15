# GO / NO-GO — lancement grande échelle

Date : 2026-09-16 · Branche : `perf/instant-feel` · Commits : Étape 0 → P5 partiels

## Checklist de lancement (SLO §7 du plan)

| # | SLO / garde-fou | Cible | Mesuré | Statut |
|---|---|---|---|---|
| 1 | TTFB `/hub` sortie < 400 ms (seuil blocage) | < 200 ms | **615 ms HTML complet / 13-29 ms premier octet** | ✅ premier octet ; ⚠ HTML complet passe au-dessus du seuil local (réseau Supabase distant +météo) — à re-mesurer depuis la prod EU |
| 2 | Premier skeleton visible < 400 ms | < 250 ms | **13-29 ms** | ✅ |
| 3 | Aucune donnée cross-comptes (SEC-1) | 3 tests | **3/3** | ✅ |
| 4 | HTML prérendu sans donnée perso (SEC-5, PPR) | — | PPR non activé | ⏳ P1-2 |
| 5 | UI-1 test:visual 0 diff | 0 diff | 80/83 + 3 flaky réseau `pays-skeleton-loading` (documentés) | 🟡 |
| 6 | vitest | vert | **2756/0** | ✅ |
| 7 | a11y (axe critical/serious) | 0 | **0** (57/57) | ✅ |
| 8 | e2e | vert | 18 échecs **pré-existants** (bug possession hub, double-arbre, test cassé) | 🔴 à corriger hors-perf |
| 9 | First Load route mobile ≤ 250 kB (seuil) | ≤ 220 | **563 kB /hub/[section]** (P0-4 bloqué) | 🔴 |
| 10 | First Load partagé ≤ 90 kB (seuil) | ≤ 85 | **104 kB** (P1-3 partiel) | 🔴 |
| 11 | Requêtes Postgres par rendu hub ≤ 8 | ~20 | cascade aplatie à ~2 vagues + enrich ; comptage exact à faire (trace par requête) | 🟡 |
| 12 | RUM branché | — | **WebVitalsReporter → telemetry/hub** | ✅ (données à collecter) |
| 13 | Test de charge 3× pic attendu | — | non exécuté (ops:a15 prêt) | 🔴 |
| 14 | Appareils physiques iOS/Android (Capacitor) | — | non exécuté (sameSite arbitré non changé) | 🔴 avant release native |
| 15 | Région Supabase vs déploiement | — | **à vérifier en premier (gain le plus rapide possible)** | ⏳ |

## Verdict actuel : **NO-GO lancement large** — GO possible après 3 chantiers

Le lancement à grande échelle exige :
1. **P0-4 via ViewportOnly + P1-3 suite** (bundle : /hub/[section] ≤ 220 kB, partagé ≤ 90 kB) — les 2 seulswrappeurs manquants.
2. **Résolution des 18 échecs e2e pré-existants** (la CI doit être 100 % vert avant d'ouvrir les vannes).
3. **Test de charge 3× pic + validation iOS/Android physique**.

Les gains SSR livrés (TTFB −38 %, premier octet 13-29 ms, cascade aplatie, isolation
RGPD du SW) sont **livrés et verrouillés par tests**. Le reste est du bundle-payload,
mesurable en une session ciblée.
