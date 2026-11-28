# LESSONS.md — Mémoire Technique Auto-Apprenante LKDV
<!-- Budget max : 120 lignes | Ne garder que les leçons durables à fort impact ; purger via npm run agent:hygiene -->

## Architecture & Build (Mac 8 Go RAM)
- **[BUILD-01]** Toujours compiler avec `FAST_BUILD=1 NODE_OPTIONS="--max-old-space-size=3072" npx next build && rm -rf .next/cache/webpack`. Sans purge du cache webpack, `.next/cache` consomme ~1,2 Go et peut figer le build.
- **[BUILD-02]** Ne jamais lancer deux builds Next.js ou deux `tsc --noEmit` en parallèle sur cette machine (OOM garanti à 2–3 Go).
- **[CF-01]** Cible web unique : **Cloudflare Workers (`vinext`)**. Ne jamais recréer `vercel.json` ni `.vercel/`. Conserver `empty-stub.js` à la racine (requis par `vite.config.ts`).
- **[MOBILE-01]** `CAPACITOR_SERVER_URL` doit toujours être en `https://` (`https://lekitduvoyageur.com` en prod) — sinon `capacitor.config.ts` échoue volontairement pour éviter de livrer le placeholder.

## Design System & CSS (Vérité : `Carnets` + `Clubs`)
- **[UI-01]** **Zéro noir pur** (`#000`, `#101010`, `#121815`) sur toute l'app — uniquement la pure palette verte LKDV (`#FBFAF6` canvas, `#172B24` encre primaire, `#17402C` vert marque, `#226148` action).
- **[UI-02]** Ne **JAMAIS** poser `.xp20-root` dans un sub-drawer portaled (`ExplorerNestedSubDrawer`) : son `position: fixed; inset: 0; overflow: hidden;` effondre la hauteur à 131 px. Utiliser `.xp20-exp-scope` et réinitialiser `scrollTop = 0` sur `.xp20-nested-body` au changement d'onglet.
- **[UI-03]** `scripts/generate-design-bank.mjs` génère BOTH `tailwind.preset.generated.js` ET `.cjs` à chaque `predev`/`prebuild` — ne jamais supprimer l'un sans modifier le générateur, et toujours valider avec `npm run design:check`.

## Base de Données Supabase & Sécurité
- **[DB-01]** Avant tout `DROP TABLE`, toujours croiser `src/`, `pg_proc.prosrc`, `pg_views`/`pg_matviews`, `scripts/` et `SELECT count(*)` en direct. Toujours utiliser `DROP TABLE IF EXISTS ... RESTRICT` (jamais `CASCADE`).
- **[DB-02]** Ne jamais supprimer un bucket Storage via SQL direct (`DELETE FROM storage.buckets` bloqué par `storage.protect_delete()`) — passer par l'API `supabase.storage.deleteBucket()`.
- **[RGPD-01]** Toute donnée biométrique/santé (FC, VMA, fatigue, RPE) relève de l'Art. 9 RGPD → partage IA strictement opt-in (`buildAiActivityInsightPayload`).

## Tests & Fixtures Protégées
- **[TEST-01]** 5 fichiers dans `docs/` sont lus par des tests actifs et ne doivent jamais être supprimés : `docs/design-system/maquettes/compte-ios27-v8.html`, `docs/progression/2.0/{economie.md,rules-registry.json}`, `docs/kit-studio/reference/kit-studio.html`, `docs/audit/communaute-v2-2026-11-08/integration/fixtures.mjs`, `docs/coverage/*`.
- **[ROUTE-01]** `/carnets` (hub) redirige en `308` vers `/communaute` ; ne pas ré-ajouter `/carnets` dans `APP_ROUTES` de `src/middleware.ts` sinon les visiteurs non connectés sont interceptés vers `/connexion` avant la redirection `308`.
