# Frontières des tests restants — 10 octobre 2026

Environnement : workspace Linux, Node 24, Vitest 4.1.11 ; base de travail `d8aeac7e0873af4084b5749e0db772e34014ed85`, modifications non commitées. Preuves exécutées entre 20:47 et 20:49 UTC. Cette réparation concerne uniquement les tests ; aucun comportement applicatif ou migration n'a été modifié dans ce périmètre.

## Diagnostic et corrections

Le passage global `/tmp/lkdv-tests-full.log` atteignait les backends Supabase de production via des nouvelles dépendances non doublées. Le garde réseau a bloqué ces appels et a correctement fait échouer les tests, même lorsque le code applicatif rattrapait l'exception.

- Génération d'aventure, conditions terrain et failover IA : doublure du module `rate-limit` conservant le vrai moteur et injectant `env: {}` à la frontière des backends distribués. Les fenêtres, les refus et les en-têtes sont toujours calculés par le moteur réel en mémoire. Le test de rafale terrain garde sa limite et son assertion 429. Les suites dédiées Redis/Postgres restent de la responsabilité de l'orchestrateur.
- Météo pays : même isolation du compteur distribué ; le seul `fetch` attendu vise toujours MET Norway et conserve les assertions de normalisation et User-Agent.
- Affiliation : le client de service réutilise le même `from` contrôlé par le test ; les écritures financières testées ne partent jamais vers la production.
- Notes et fin de voyage : producteurs progression doublés à leur frontière, sans modifier les tests d'intégration propres aux producteurs ; chaîne `maybeSingle` ajoutée au client de requêtes afin que le nettoyage d'équipage ne tombe plus en exception artificielle.
- Compas : client des journaux opérationnels doublé ; écriture des métadonnées doublée pour le test de limites. Le test d'effacement de destination exige maintenant également `success: true`, empêchant un faux succès dû à une exception de la doublure.
- Discovery : configuration des scénarios explicitement fixée (`DISCOVERY_PROVIDER`, `DISCOVERY_TERRA_ENABLED`, `KLOOK_AFFILIATE_URL`) au lieu d'hériter du réglage du déploiement.
- Pays : la suite de données réelles exige désormais `COUNTRIES_GEO_E2E=1`, une URL Supabase de boucle locale et la clé anon. Toutes les assertions sur les 195 pays, les contenus et les champs sont conservées. Aucun jeu de données fictif n'a été construit pour remplacer une intégration réelle.

## Vérification exécutée

Commande ciblée large :

```sh
node node_modules/vitest/vitest.mjs run tests/adventure-intelligence tests/affiliation tests/countries_geo.spec.ts tests/features/discovery tests/features/pays/weather-route.spec.ts tests/trips/notes src/features/compas/__tests__ src/lib/ai/__tests__/askai-failover.test.ts
```

Résultat : **190 fichiers réussis, 2 784 tests réussis**, 1 fichier / 6 tests ignorés, durée 66,93 s. Journal `/tmp/lkdv-remaining-boundaries.log`. Aucun échec réseau interdit.

Après les derniers ajustements aux doublures Compas et notes, vérification ciblée supplémentaire : **2 fichiers, 20 tests réussis**, durée 2,75 s. Journal `/tmp/lkdv-remaining-boundaries-final.log`.

## Limites et prochaine vérification

Les six tests `countries_geo.spec.ts` n'ont pas été exécutés : leur opt-in est absent et les identifiants injectés ciblent une base distante. Ce résultat constitue un **skip**, jamais une preuve de réussite du dataset réel. Exécuter la suite avec `COUNTRIES_GEO_E2E=1` sur une base locale contenant le dataset réel via PostgREST ; conserver le garde réseau. Les tests unitaires corrigés ne prouvent ni la concurrence SQL des limites distribuées ni le parcours complet des producteurs de progression. Types, build, revue et passage global sont effectués séparément par l'orchestrateur.
