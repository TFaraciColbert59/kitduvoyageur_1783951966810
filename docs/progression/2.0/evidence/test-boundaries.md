# Frontières réseau des tests de routes progression

10 octobre 2026 ; environnement cloud `/workspace/kitduvoyageur_1783951966810`, commit de base `373689c6a`. Modifications non commitées confiées à l'orchestrateur.

## Diagnostic et correction

Les tests de routes `canonicalRoutes.spec.ts` et `territoryRoute.spec.ts` simulaient l'authentification et les services métier mais laissaient `enforceRateLimit` réel. Avec les credentials Supabase de cet environnement, le rate limiter choisissait PostgreSQL et tentait un appel externe, que la garde no-network bloquait correctement. Les routes fermées renvoyaient alors 503 avant d'atteindre les assertions métier.

Ajout d'un mock explicite de `@/lib/rate-limit/routes`, réinitialisé à `null` avant chaque test. Le service rate-limit garde ses tests dédiés (`tests/lib/rate-limit.spec.ts`), lus pour vérifier les branches allowed/limited/unavailable et les backends PostgreSQL/Redis/mémoire. Aucune règle applicative, assertion existante ou garde réseau retirée ; aucun changement à `src/` ou à Vitest.

Huit nouveaux cas couvrent les refus 429 et 503 : lecture de profil, lecture du classement, lecture de territoire et écriture de territoire. Chaque cas vérifie que la réponse de refus est propagée et que le service métier n'est pas appelé. Les scopes utilisateur et `failMode: 'closed'` sont également vérifiés.

## Vérification

Suite élargie réellement exécutée :

```sh
npx vitest run tests/features/progression tests/phase1/producers.integration.spec.ts
```

À 16:51:27 UTC (18:51:27 Europe/Paris), exit 0 : **16 fichiers réussis, 1 ignoré ; 188 tests réussis, 9 ignorés**. Le périmètre inclut les travaux simultanés indépendants de l'orchestrateur et des autres sous-agents ; ce nombre ne correspond pas seulement aux huit nouveaux cas. Le test producteurs E2E demeure ignoré sans activation locale explicite et ne constitue pas une preuve source→SQL→projection.

`git diff --check` sur les deux fichiers modifiés : exit 0.

La vérification ciblée finale avec la suite rate-limit est enregistrée ci-dessous après exécution. Aucun appel de production ni écriture SQL effectué par cette tranche.

Commande finale ciblée :

```sh
npx vitest run tests/features/progression/canonicalRoutes.spec.ts tests/features/progression/territoryRoute.spec.ts tests/lib/rate-limit.spec.ts
```

À 16:52:13 UTC (18:52:13 Europe/Paris), **3 fichiers, 41 tests réussis**, exit 0. Ce contrôle inclut les assertions finales de scope et failMode. Relecture du diff : aucune assertion préexistante supprimée, changement limité aux deux tests de routes et à ce rapport.
