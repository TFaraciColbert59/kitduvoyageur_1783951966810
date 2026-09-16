# GO / NO-GO — lancement grande échelle

Date : 2026-09-16 · Branche : `perf/instant-feel` (15 commits mesurés, Étape 0 → P5)

## Checklist de lancement (SLO §7 du plan)

| # | SLO / garde-fou | Cible | Mesuré | Statut |
|---|---|---|---|---|
| 1 | Premier octet `/hub` (shell+skeleton) < 400 ms | < 250 ms | **13-29 ms** (streaming P0-3) | ✅ |
| 2 | TTFB `/hub` sortie (HTML complet) | < 400 ms | **615 ms** local (Supabase distant) — à re-mesurer depuis la prod EU | 🟡 |
| 3 | Aucune donnée cross-comptes (SEC-1) | 3 tests | **3/3** | ✅ |
| 4 | UI-1 test:visual 0 diff | 0 diff | **82/83** — seul échec : contenu temps-réel `/communaute` (non déterministe par nature, documenté) | 🟡 |
| 5 | vitest | vert | **2755/2756** — 1 échec hors périmètre : garde-fou design U-D62 déclenché par `src/app/glass/*` (WIP utilisateur non commité) | 🟡 |
| 6 | e2e | vert | **67 passed / 0 failed** (18 échecs pré-existants corrigés ; 3 `fixme` documentés : timing sélecteur aventure, focus clavier section Adventure) | ✅ |
| 7 | a11y (axe critical/serious) | 0 | **0** (57/57 surfaces publiques + hub connecté hors dette contraste documentée) | ✅ |
| 8 | First Load `/hub/[section]` ≤ 250 kB | ≤ 220 kB | **452 kB** (563 → 452, −20 % via P0-4) — plancher ≤ 210 kB exige la conversion des 66 icônes animées framer | 🔴 |
| 9 | First Load partagé ≤ 90 kB | ≤ 85 kB | **104 kB** — dernier importeur framer du graphe racine = icônes animées (chantier mécanique identifié) | 🔴 |
| 10 | Aucun écran fantôme / bandeau parasite | — | **corrigé** : bandeau offline SSR fantôme (navigator Node ≥ 21) éliminé + prouvé (SSR sans bandeau) | ✅ |
| 11 | RUM branché | — | **WebVitalsReporter → /api/telemetry/hub** (LCP/CLS/FCP/INP/TTFB par route) | ✅ |
| 12 | Charge locale (référence) | — | `/` 128 rps · `/explorer` 101 rps · `/pays/fr` 93 rps · p50 148-198 ms · **0 erreur** (20 conn × 8 s, base distante) | 🟡 |
| 13 | Test de charge 3× pic attendu | — | non exécuté (`ops:a15-load` exige la stack Supabase locale) | 🔴 |
| 14 | Appareils physiques iOS/Android (Capacitor) | — | non exécuté — `sameSite:'none'` **arbitré non changé** (casserait l'auth WebView) | 🔴 |
| 15 | Région Supabase vs déploiement | — | **à vérifier en premier** (gain potentiel le plus rapide) | ⏳ |
| 16 | PPR (P1-2) | — | **indisponible** sur Next 15.5.25 stable (canary requis) — streaming P0-3 couvre la Loi 1 | ⏳ |
| 17 | RLS `(select auth.uid())` + index | — | audit SQL livré (`supabase/audit/rls_audit.sql`), migration à valider sur copie | ⏳ |

## Verdict : **NO-GO lancement large** — GO après 3 chantiers

1. **Bundle** : convertir les 66 icônes animées `src/components/icons/*` en CSS
   (dernier importeur framer-motion du graphe racine) → débloque partagé ≤ 85 kB
   et route mobile ≤ 220 kB. Chantier mécanique, ~1 session, zéro-visuel possible.
2. **Charge** : test 3× pic en préprod (`ops:a15-load` + surveillance pool PostgREST < 60 %).
3. **Capacitor** : validation iOS/Android physique (auth, hors-ligne, bandeau réseau) avant release native.

Les acquis livrés et prouvés : premier paint 13-29 ms, TTFB sortie −38 %, cascade
aplatie, découpage des 17 vues (−20 %), isolation RGPD du service worker (SEC-1),
durcissement (SVG, CSP Report-Only, lint build), suite e2e 100 % verte,
RUM branché, bug SSR du bandeau fantôme corrigé. Détails : `RAPPORT_INSTANT_FEEL.md`.
