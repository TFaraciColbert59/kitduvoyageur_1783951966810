# ARCHITECTURE.md — LKDV (v0.1, session 1)

Source de vérité : `git` sur HEAD `14d80de8` (main). Les fichiers non suivis (99 entrées issues de
`feat/explorer-mobile-osm`) sont HORS références et exclus de toute analyse. Chaque fait ci-dessous
est vérifié par lecture ou `git grep` à cette référence.

## 1. Surface serveur (vérifiée)

- **123** route handlers `src/app/api/**/route.ts` répartis en **46** groupes de premier niveau :
  account, admin, adventure, affiliate, ai, amenities, badges, billing, booking, carnet, carnets,
  checkout, cron, dev, discovery, elevation, geocode, guides, hikes, hike-sessions, hub, identity,
  indexnow, kit-report, kits, materiel, notifications, og-preview, pays, pois, produit, progression,
  promotions, rewards, route, seed, stripe, telemetry, terrain, trails, trajectoire, trip-assistant,
  trips, users, voyages, weather.
- **Admin** : une seule route API (`src/app/api/admin/rewards/route.ts`, garde `is_admin()` RPC,
  rewards/withdrawals) + UI `/admin` (layout, page, produits, AdminProductsManager). Le vaste
  « admin OS » (audit, mfa, csrf, moderation…) n'existe PAS sur main : c'est du travail non commité
  de l'autre branche (stash + untracked).
- **Cron** : 15 routes `src/app/api/cron/**` protégées par `CRON_SECRET` (Bearer) — vérifié par grep,
  contrôle exact et timing-safe à auditer.
- **Service role** dans 15 fichiers routés : checkout, 8 crons, materiel/share, notifications×2,
  pays/[code], seed, stripe/webhook (liste `git grep -l SUPABASE_SERVICE_ROLE_KEY` — usages exacts
  à auditer en vague 1).
- **Validation d'entrée** : `zod` importé dans **23/123** routes ; rate limiting présent dans **10/123**
  routes (lib `src/lib/rate-limit` : Upstash REST + repli mémoire, `failMode` open/closed, timeout 750 ms).
- **Middleware** (`src/middleware.ts`) : protège `/admin` et `/checkout` (session via `@supabase/ssr` +
  `is_admin()`), redirections hub/pays ; matcher explicite. L'autorisation fine reste à la charge des
  routes/pages (« middleware seul insuffisant » — incident Vercel 2025).

## 2. Auth / sessions (vérifié)

- `src/lib/supabase/server.ts` : `createServerClient` avec cookie `setAll` forcé
  `sameSite: 'none', secure: true` (candidat F-001 — cf. findings).
- `src/lib/supabase/client.ts` + usages `createBrowserClient` (côté navigateur).
- `.env.example` : `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (serveur),
  `CRON_SECRET`, Stripe (secret/webhook/publishable), IA (OPENROUTER/NVIDIA/legacy), partenaires
  (Tripadvisor/Terra, Viator/RouteStack, Klook), secrets applicatifs (CREW_INVITE_SECRET,
  DOC_SIGNING_SECRET, KIT_REF_SECRET, INDEXNOW_KEY, RESEND, SEED_SECRET, TRAVELPAYOUTS_WEBHOOK_SECRET).
- `supabase/config.toml` local (NON preuve du cloud) : signup activé, confirmations email **false** en
  local, password min 6, refresh rotation on, MFA TOTP désactivé en local, seed `./seed.sql` déclaré
  mais fichier absent.

## 3. Base de données (vérifié — statique)

- **251** migrations `supabase/migrations/*.sql` (dossier en annonçait 279 sur un commit absent).
- Occurrences : `ENABLE ROW LEVEL SECURITY` ×420, `CREATE POLICY` ×1077, `SECURITY DEFINER` ×264.
- Fonction canonique `public.lkv_can` (migration `20260907000000_unify_crews_trips_rls.sql`) ;
  `search_path` verrouillé (`20260913010000_tribu_capabilities.sql:133`).
- Miroir TS `src/lib/security/permissions.ts` (`lkvCan`) — le test `tests/security/rlsMatrix.spec.ts`
  n'exerce QUE ce miroir TS, jamais PostgreSQL (fait vérifié) → trou de couverture inscrit (H-003).
- Storage : buckets créés par 3 migrations (`storage.buckets` inserts : carnet media, groupes,
  messagerie) — politiques et exposition réelles à auditer.

## 4. Client / offline (vérifié)

- `public/sw.js` v4 : listes blanches navigation/API publiques, purge `LKDV_PURGE_PRIVATE` pilotée par
  AuthContext, cache images dédié incluant tout `*.supabase.co` (candidat F-002), LRU tuiles borné.
- `next.config.mjs` : HSTS preload, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy
  (camera/micro `()`), **CSP Report-Only** (non bloqueante), Cache-Control `private, no-store` sur
  routes/API authentifiées listées.
- `capacitor.config.ts` : présent (à lire en vague mobile).

## 5. Paiements (à auditer vague 2)

- Routes `checkout`, `stripe/webhook`, `billing`, `booking`, `rewards`, crons kit-attributions.
- Stripe SDK 17.7.0 (package.json) ; signature/idempotence à vérifier au code.

## 6. IA (à auditer vague 3)

- Groupes `ai`, `kit-report`, `trip-assistant`, `guides`, `carnets` (narratives), `identity`.
- Clients : `src/lib/ai/serviceClient.ts` (service role + providers OpenRouter/NVIDIA).
- `.env.example` documente 6 providers IA dont legacy ; `vitest.config.ts` neutralise
  NVIDIA/OPENROUTER pour l'herméticité des tests.

## 7. Tests & CI (vérifié)

- Vitest : config hermétique (`env` vide les clés IA), include `tests/**/*.spec.ts(x)` +
  `src/**/__tests__` → 530 fichiers spec+tsx dans `tests/` + 260 fichiers dans `src/__tests__`.
- Suites sécurité existantes : `tests/security/` (rlsMatrix [miroir TS], unified-booking-rls,
  phase8-stripe-webhook/eventstore/events/entitlements-forge, ethical-legal-security, atlas-abuse,
  adminOsTriage [spec orpheline d'un autre chantier], a14-gdpr-account, a14-abuse).
- CI `.github/workflows/ci.yml` : typecheck, lint, gate design, vitest, build (placeholders Supabase),
  + gates E2E/a11y/visuel/DB **conditionnels** (`LKDV_E2E_ENABLED`, `LKDV_DB_TESTS_ENABLED`).
- Aucun workflow de sauvegarde (`db-backup`) sur main — écart dossier à documenter en vague plateforme.

## 8. Questions ouvertes (à résoudre en vagues)

1. Matrice (route × identité × action) pour 123 routes — vague 1.
2. Droits d'appel réels des RPC `SECURITY DEFINER` (owners, EXECUTE, search_path) — vague 1 (DB locale).
3. Politiques storage par bucket (lire/écrire après changement de membre) — vague 1.
4. Contrôle CSRF réel des mutations (`sameSite=none`) — vague 1.
5. Idempotence/atomicité Stripe de bout en bout — vague 2.
6. ACL des outils IA et budgets — vague 3.
7. SSRF sur og-preview/geocode/weather/elevation/partenaires — vague 3.
8. Provisionnement cloud/GitHub/secrets/backups — vague 4 (lecture seule autorisée seulement).
