# Stabilisation — frontières des tests globaux

10 octobre 2026, contrôle ciblé démarré à 22:47:09 Europe/Paris (20:47:09 UTC). Environnement local `/workspace/kitduvoyageur_1783951966810`, commit de base `d8aeac7e0873af4084b5749e0db772e34014ed85`. Correctifs non committés ; intégration et revue relèvent de l’orchestrateur.

## Diagnostic du relevé global antérieur

Le log `/tmp/lkdv-tests-full.log` rapporte 7 933 tests réussis et **70 tests uniques échoués**. Les sections d’erreur peuvent nommer deux fois le même test : assertion initiale, puis garde réseau après le test. Le classement suivant déduplique par chemin et titre :

| Catégorie principale | Tests échoués | Sens du constat |
| --- | ---: | --- |
| Appel réseau non simulé à une frontière | 51 | Supabase réellement sollicité puis refusé par la garde ; certaines assertions et expirations de délai en sont les conséquences. |
| Chromium Playwright absent | 11 | Exécutable de navigateur indisponible ; installation ou contrôle navigateur séparé requis. |
| Autres assertions | 8 | Trois tests MET détournés par le backend du rate-limit ; quatre assertions découverte et une assertion météo hors de ce périmètre. |

Le log signale aussi une suite en erreur avant exécution (`m53-duree-cible-contraste.test.ts`, Chromium absent), distincte des 70 tests exécutés en échec. Aucun de ces échecs de navigateur n’est présenté comme une réussite.

## Correctifs réalisés exclusivement dans les tests

Le rate-limit lit directement les configurations Postgres et Upstash depuis leurs lecteurs d’environnement. Simuler seulement `getServiceSupabase` n’isole donc pas cette dépendance. Avec des clés présentes dans l’environnement local, les tests partaient vers PostgREST, indépendamment de leur mock métier. Dans les tests MET dont `fetch` est simulé, le mock répondait aussi au compteur PostgREST : la réponse MET n’avait pas le format d’un compteur, créant un repli et des appels supplémentaires.

Les lecteurs `readPostgresEnv` et `readUpstashEnv` sont désormais simulés explicitement comme configurations absentes dans les cinq suites ci-dessous. Le reste des modules est conservé par import original. Les vraies politiques `rateLimit`, son compteur mémoire, limites et résultats continuent à s’exécuter ; le compteur est réinitialisé entre les tests quand nécessaire. Le scénario du plafond IA exerce ainsi réellement deux appels puis un troisième refusé. La garde réseau, ses erreurs et tous les asserts existants restent inchangés.

| Fichier | Frontière corrigée | Échecs antérieurs du fichier résolus |
| --- | --- | ---: |
| `tests/ai/askAI.spec.ts` | Lecteurs de configuration de backend et réinitialisation du compteur mémoire. | 10 |
| `tests/security/a14-abuse.spec.ts` | Même frontière ; validations photo/description et contrôles secrets continuent à être exercés. | 3 |
| `tests/security/a14-gdpr-account.spec.ts` | Même frontière ; vrai garde de route, contrats export/suppression et erreur résiduelle préservés. | 5 |
| `tests/observability/generate-route-correlation.spec.ts` | Même frontière ; propagation/remplacement du correlation ID conservés. | 3 |
| `tests/lib/metno-request.spec.ts` | Même frontière ; vrais slots MET et rate-limit mémoire, mock fetch réservé aux réponses MET attendues. | 3 |
| `tests/places/placesActions.spec.ts` | Hook indépendant `awardPlaceReview` simulé ; l’action d’avis et ses écritures métier restent testées. Les preuves et l’attribution du hook relèvent de leurs propres suites. | 1 |

Ces fichiers n’avaient pas été modifiés par cette sous-tranche lors du relevé global. Aucun code de production, dépendance, configuration globale de tests, assertion, skip ou timeout n’a été changé pour obtenir le résultat. Aucune préexistence à une branche plus ancienne n’est affirmée sans exécution de cette branche : le diagnostic porte précisément sur l’état et le log fournis par l’orchestrateur.

## Vérification exécutée

`npm test -- tests/ai tests/security tests/observability tests/places tests/lib/metno-request.spec.ts` : **36 fichiers et 355 tests réussis**, sortie 0, durée 15,95 secondes. Le log ciblé est `/tmp/lkdv-test-boundaries.log`. Les 25 tests précédemment échoués du périmètre sont inclus dans cette exécution ; aucun appel réseau non simulé n’a échappé à la garde.

`git diff --check` sur les seuls chemins de tests autorisés : succès. Aucun types/build ni nouvelle suite globale n’a été lancé dans cette sous-tranche.

## Reste identifié hors de ce périmètre

Ces nombres décrivent le **log antérieur**, ils ne préjugent pas des corrections parallèles ni d’une nouvelle exécution globale.

| Frontières réseau encore signalées dans le log ancien | Nombre |
| --- | ---: |
| `tests/adventure-intelligence/` : generation-limits, adventure-api, billing-entitlements, terrain-conditions.server et terrain-flag-gating | 13 |
| `src/features/compas/__tests__/` : actionLimits et autofillStart | 4 |
| `src/lib/ai/__tests__/askai-failover.test.ts` | 3 |
| `tests/countries_geo.spec.ts` | 6 |
| `tests/trips/notes/queries-trip-notes.spec.ts` | 2 |
| `tests/affiliation/queries-affiliation.spec.ts` | 1 |

Les quatre autres assertions de découverte sont dans `tests/features/discovery/klook.spec.tsx` et `provider-selection.spec.ts` ; l’assertion météo est dans `tests/features/pays/weather-route.spec.ts`. Les onze échecs de navigateur concernent les suites audit/design citées dans le log. Les chemins partagés de progression n’ont pas été touchés.

Prochaine action : intégrer après revue ces six correctifs de frontières, traiter séparément les chemins restants et exécuter la suite globale à un jalon approprié. Le succès de ce lot n’équivaut pas au succès des 8 000 tests, au déploiement ni à la sortie opérationnelle P0.
