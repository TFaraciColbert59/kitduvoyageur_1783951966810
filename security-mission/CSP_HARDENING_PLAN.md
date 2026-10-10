# CSP_HARDENING_PLAN.md — passage du Report-Only au bloquant (B10)

État actuel (`next.config.mjs:128-141`) : `Content-Security-Policy-Report-Only` avec
`script-src 'self' 'unsafe-inline' 'unsafe-eval' …`, `report-uri /api/telemetry/hub`.
Aucun nonce. Le mode bloquant n'est PAS activé.

## Étape 0 — Observabilité (2 semaines minimum)

1. Consommer les rapports `/api/telemetry/hub` : classifier par directive et par source
   (scripts inline JSON-LD, js.stripe.com, googletagmanager, vercel-scripts, workers MapLibre blob).
2. Objectif de sortie : liste exhaustive des violations par page du parcours critique
   (pays/globe, carte interactive, checkout, communauté, admin).

## Étape 1 — Nonce + strict-dynamic (scripts)

1. Générer un nonce par requête dans `src/middleware.ts` (Web Crypto, base64) et le poser sur la
   réponse (`x-nonce`) + dans la CSP.
2. Ajouter `nonce={...}` à CHAQUE script inline (JSON-LD compris) — inventaire par
   `git grep -n "<script" src/app` puis `dangerouslySetInnerHTML`.
3. Passer `script-src` à `'self' 'nonce-…' 'strict-dynamic' https://js.stripe.com …` (retirer
   `'unsafe-inline'`), garder `report-uri` pendant la transition.
4. Vérification : parcours checkout Stripe (Elements), globe/carte, analytics, service worker.

## Étape 2 — Retrait de `unsafe-eval`

1. Tester sans `'unsafe-eval'` : MapLibre GL (workers), Stripe Elements, recharts, framer-motion,
   Tailwind runtime (aucun), GTM.
2. Si un composant exige eval → décision : version/patch du composant, ou exception documentée
   avec date d'expiration.

## Étape 3 — Bascule bloquante

1. Renommer l'en-tête `Content-Security-Policy-Report-Only` → `Content-Security-Policy`
   (une seule ligne, rollback trivial = revenir en Report-Only).
2. Fenêtre de surveillance 72 h : erreurs console, taux d'échec checkout, remontées utilisateurs.
3. Garder `frame-src https://js.stripe.com`, `worker-src 'self' blob:`, `connect-src` Supabase/OSM/
   météo inchangés.

## Matrice de compatibilité (à cocher avant bascule)

| Surface | Risque | Test |
| --- | --- | --- |
| Globe Pays (three.js/react-globe) | scripts eval/worker | capture + console |
| Carte MapLibre (worker blob) | `worker-src blob:` requis | carte + tuiles |
| Checkout Stripe (Elements iframe) | `frame-src js.stripe.com` | sandbox |
| Analytics GA/Vercel | scripts externes | réseau |
| Service worker PWA | `worker-src 'self'` | offline |
| JSON-LD SEO | inline → nonce obligatoire | rendu HTML |

## Rollback

Revenir à `Content-Security-Policy-Report-Only` (aucune donnée affectée). Aucune migration.
