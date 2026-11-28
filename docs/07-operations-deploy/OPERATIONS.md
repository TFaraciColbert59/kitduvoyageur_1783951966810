# 07 — Opérations, Déploiement & Onboarding Développeur

## 1. Onboarding Développeur (macOS / Linux)

### Prérequis
- **Node.js** `22+` et `npm`
- **Rust / wasm-pack** (uniquement si modification de `crates/lkdv-route-core`)
- **Xcode** (builds iOS) / **Android Studio + JDK 17** (builds Android)

### Installation locale
```bash
git clone <repo-url> lkdv-reference
cd lkdv-reference
npm ci
cp .env.example .env.local
npm run design:check
npm run dev
```

### Variables d'environnement essentielles (`.env.local`)

| Variable | Portée | Description |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | URL du projet Supabase (`https://icxyvwzfjbflcbqukpfz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Clé anonyme (soumise aux politiques RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur | Clé admin serveur (migrations, cron, webhooks) — **jamais exposée au client** |
| `DATABASE_URL` | Serveur | Chaîne de connexion PostgreSQL directe |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Serveur | Paiements & webhooks boutique |
| `DOC_SIGNING_SECRET` | Serveur | Signature des URLs de documents privés (`user-documents`) |
| `CRON_SECRET` | Serveur | Protection des routes `/api/cron/*` |
| `CAPACITOR_SERVER_URL` | Build Mobile | URL HTTPS de production servie dans les apps iOS/Android |

---

## 2. Contraintes Matérielles & Build (Machine 8 Go RAM)

Sur une machine de développement à **8 Go de RAM** :
- Toujours limiter le heap V8 à `3072 Mo` et activer `FAST_BUILD=1`.
- Toujours purger `.next/cache/webpack` après un build pour préserver l'espace disque (~1,2 Go économisés).
- Ne jamais lancer deux builds ou deux suites lourdes en parallèle.

```bash
FAST_BUILD=1 NODE_OPTIONS="--max-old-space-size=3072" npx next build && rm -rf .next/cache/webpack
npx next start -p 3001 -H ::
```

---

## 3. Déploiement Web : Cloudflare Workers (`vinext`)

- **Cible unique** : Cloudflare Workers (`@vinext/cloudflare` + `cloudflare.config.ts` + `vite.config.ts`). **Vercel a été entièrement retiré.**
- **Cron quotidien** : `/api/cron/daily` (et les autres routes `/api/cron/*`) doivent être déclenchées via **Cloudflare Cron Triggers** ou **GitHub Actions** avec le header d'autorisation `CRON_SECRET`.

---

## 4. Builds Mobiles Natifs (Capacitor 8 — iOS & Android)

```bash
# Synchroniser les projets natifs (CAPACITOR_SERVER_URL obligatoire en HTTPS)
CAPACITOR_SERVER_URL="https://lekitduvoyageur.com" npx cap sync

# Ouvrir dans Xcode / Android Studio
npx cap open ios
npx cap open android
```

---

## 5. CI/CD GitHub Actions (`.github/workflows/`)

| Workflow | Rôle |
| :--- | :--- |
| `ci.yml` | Lint, Design Check, Tests & Build |
| `ios.yml` / `ios-testflight.yml` | Build iOS Capacitor & déploiement TestFlight (`CAPACITOR_SERVER_URL` → `https://lekitduvoyageur.com`) |
| `db-backup.yml` | Sauvegarde planifiée de la base Supabase |
| `geo-places-monthly.yml` / `geo-pois-monthly.yml` / `geo-referentials-import.yml` | Synchronisations mensuelles des référentiels géographiques PostGIS |
| `lighthouse-ci.yml` / `visual-regression.yml` / `lkdv-chantier-checks.yml` | Qualité perf, non-régression visuelle et garde-fous |
| `ops-alerts.yml` | Alerting opérationnel |

---

## 6. Stratégie de Tests

| Couche | Outil | Commande |
| :--- | :--- | :--- |
| **Unitaire & Moteurs** | Vitest | `npm test` (ou ciblé `npx vitest run <chemin>`) |
| **Design Tokens** | Script Design Bank | `npm run design:check` |
| **E2E Web & Responsive** | Playwright | `npx playwright test` (`playwright.config.ts`, `playwright.baseline.config.ts`, `playwright.compas-full.config.ts`, `playwright.kit-studio.config.ts`) |
| **E2E Mobile Natif** | Maestro | `.maestro/` |
| **Accessibilité** | Axe-core + Playwright | `@axe-core/playwright` |
