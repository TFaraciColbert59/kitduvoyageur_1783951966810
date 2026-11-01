# PERFORMANCE — règles de vitesse de LKDV

À lire avant toute nouvelle fonctionnalité. Chiffres de référence : `PERF_BASELINE.md` ; décisions : `DECISIONS.md` ; résultats : `PERF_RESULTS.md`.

## Budgets (mobile milieu de gamme, 4G, cache froid)

| Métrique | Cible | Plafond |
|---|---|---|
| TTFB | < 200 ms | 400 ms |
| Contenu réellement visible / LCP | < 1,2 s | 2,0 s |
| INP p75 | < 150 ms | 200 ms |
| CLS | 0 | 0,05 |
| Premiers pixels de carte (Explorer) | < 600 ms | 1,0 s |
| JS d'une surface (union mise en page racine + page, gzip) | < 120 Ko | 180 Ko |

Le plafond anti-régression actuel (poids mesuré + 5 %) est vérifié en CI par `npm run perf:budget` (`scripts/perf/check-bundle-budget.mjs`). On abaisse ces plafonds à chaque gain ; on ne les relève jamais sans décision écrite.

## Mesurer

- **Poids** : `npm run build` puis `npm run perf:budget`. Le tableau « First Load JS » de `next build` ne compte pas la mise en page racine : ne pas s'y fier seul.
- **Laboratoire** : `npm run perf:surfaces -- <url> <dossier> --runs 3 --throttle` (cache froid, mobile ralenti ; `COMPAS_DEMO=1` pour la connexion démo sur un aperçu où `DEMO_AUTO_LOGIN=true`, `NO_LOGIN=1` pour les pages publiques). Explorer seul en local : `npm run perf:mobile`.
- **Terrain (RUM)** : `WebVitalsReporter` envoie `web_vitals` et `experience_metric` dans `hub_telemetry`. **Exclure les comptes de banc de test** des statistiques (un seul compte de banc représentait 99 % des mesures du Compas).
- **Serveur** : `traceStage()` (`src/lib/perf/ssrTrace.ts`), actif avec `LKDV_TRACE_SSR=1` (activé sur les aperçus de la branche de travail), lisible dans les journaux Vercel (1 h de rétention sur le plan Hobby).

## Règles

1. **Rien de lourd dans la mise en page racine** (`src/app/layout.tsx` et ses fournisseurs) : elle est chargée par toutes les pages. Toute librairie qui ne sert pas au premier affichage de toutes les pages (validation, base locale, boîtes de dialogue, cartes, éditeurs) se charge à la demande (`import()` dans l'effet ou au geste, `next/dynamic`).
2. **Aucun écran plein écran qui masque le contenu** (écran de démarrage, spinner global). Le contenu rendu par le serveur s'affiche dès qu'il arrive ; les régions en attente ont un squelette à leur forme exacte.
3. **Tiroirs, modales, panneaux** : montés à la première ouverture, préchargés au repos (`requestIdleCallback`), jamais dans le JS initial de la page.
4. **Cartes** : MapLibre jamais dans le JS initial d'une page qui n'est pas la carte ; sur l'Explorer, son téléchargement démarre dès l'évaluation du module, en parallèle de l'hydratation ; préconnexion à l'hôte des tuiles.
5. **Images** : formats modernes (WebP/AVIF), taille d'affichage × densité, jamais un PNG de 100 Ko pour un logo. Conversion sans perte vérifiée au pixel quand l'image doit rester identique.
6. **Préconnexions** : seulement vers des hôtes utilisés au premier affichage (chaque préconnexion inutile coûte DNS + TCP + TLS sur mobile).
7. **Service workers** : une portée par worker ; ne recharger la page sur `controllerchange` que pour le worker de l'app (`src/lib/pwa/serviceWorkerScopes.ts`). Deux workers sur la même portée = boucle de rechargement (incident du 01/11/2026).
8. **Dictionnaires de langue** : seules les langues actives (`NEXT_PUBLIC_I18N_*_ENABLED=1` au build) sont embarquées.
9. **Serveur** : paralléliser les lectures indépendantes (`Promise.all`), mettre en cache les appels externes immuables (relief, normales climatiques) et ne jamais attendre un service externe avant d'envoyer la coquille de la page (`loading.tsx` / `<Suspense>`).
10. **Base** : `(select auth.uid())` dans les politiques RLS, jamais `auth.uid()` nu ; pas d'index en double ; chaque migration avec son rollback dans `supabase/migrations_down/`.

## Pièges connus

- `next build` local : `NODE_OPTIONS=--max-old-space-size=8192` (la vérification de types dépasse 2 Go).
- Plusieurs tests `tests/design/*` échouent déjà sur `main` (contrats de refontes anciennes) : comparer les échecs à ceux de `main` avant de conclure à une régression.
- Les journaux Vercel affichent la région du point d'entrée réseau, pas celle de la fonction (`cdg1`, voir le déploiement).
