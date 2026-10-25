# Anti-abus — code livré et configuration externe (ops/humain)

> **À VALIDER PAR UN HUMAIN HABILITÉ — BROUILLON / opérations.** Ce document
> distingue ce qui est traité côté code (testé) de ce qui relève d'une
> configuration externe non réalisable par l'agent.

**Date du brouillon :** 2026-09-12

## 1. Rate limiting distribué — routes couvertes (code)

Abstraction : `src/lib/rate-limit` (Upstash REST si configuré, repli mémoire
sinon ; `failMode: 'closed'` ou `'open'` explicite). Garde uniforme Phase 8 :
`src/lib/rate-limit/routes.ts` (`enforceRateLimit` → 429/503).

| Route | Portée | Limite | Fail mode |
|---|---|---:|---|
| `POST /api/adventure/generate` | génération | (Phase 6, existant) | closed |
| `POST /api/ai/jobs` | file IA | (Phase 6, existant) | closed |
| `POST /api/ai/chat-completion` | chat IA | (Phase 6, existant) | closed |
| `POST /api/checkout` | paiement | (Phase 6, existant) | — |
| `POST /api/terrain/reports` | signalements | (Phase 6, existant) | open |
| `GET /api/terrain/conditions` | lecture | (Phase 6, existant) | open |
| `POST /api/adventure/offline/sync` | sync | (Phase 6, existant) | open |
| `POST /api/rewards/claim` | points | 30/min | closed |
| `POST /api/rewards/withdraw` | cash-out | 5/h | closed |
| `GET /api/account/export` | export RGPD | 10/h | open |
| `DELETE /api/account/delete` | effacement | 5/h | open |
| `POST /api/carnet/identify-species` | IA vision | 10/min | closed |
| `POST /api/kit-report/generate` | IA kit | 10/min | closed |
| `POST /api/trip-assistant` | IA | 20/min | closed |
| `POST /api/telemetry/hub` | télémétrie | 120/min | open |
| `POST /api/notifications/subscribe` | push | 20/min | open |
| `POST /api/hike-sessions` | écriture GPS | 30/min | open |

Le webhook Stripe (`/api/stripe/webhook`) n'est **pas** rate-limité : il est
protégé par signature et idempotence ; le limiter risquerait de casser les
retries Stripe.

## 2. Autres protections code-side (vérifiées)

- Idempotence webhook : `public.stripe_events` (Phase 8).
- RLS stricte + tests horizontal/vertical (Phase 8).
- Modération Terrain Live (rate limits métier en base, A14).
- GeoJSON : bornes de bbox et tolérance (`tests/security/a14-abuse.spec.ts`).
- Photos : URL http(s) uniquement, taille bornée (A14).
- Secrets HMAC fail-closed (A14).

## 3. Configuration externe — items HUMAIN/OPS (non réalisés)

| Item | Où | Statut |
|---|---|---|
| **WAF Vercel** (règles managed + custom : bots, injection, abus API) | dashboard Vercel | `INSUFFICIENT_DATA` — non configuré |
| **Bot management / challenge** Vercel (BotID, rate rules par IP/route) | dashboard Vercel | `INSUFFICIENT_DATA` |
| **Upstash Redis** réel (`UPSTASH_REDIS_REST_URL`/`TOKEN`) | Vercel env | `INSUFFICIENT_DATA` — absent |
| **Alertes** sur 429/5xx et saturation | observabilité | `INSUFFICIENT_DATA` (Phase 10) |
| **CAPTCHA** sur inscription/contact si abus constaté | selon besoin | à décider |
| **Limites plateforme** (Vercel functions, Supabase connections) | dashboards | à vérifier |

## 4. Procédure de vérification (humain)

1. Configurer Upstash en environnement de test → rejouer les specs Phase 6/8
   avec `fetch` réel, vérifier compteurs partagés.
2. Activer les règles WAF Vercel en mode log → observer → passer en block.
3. Tester un pic scripté (autocannon, cf. `scripts/ops/a15_load_test.mjs`) et
   vérifier les 429/503 attendus.

**Aucune configuration externe n'a été modifiée par l'agent.**
