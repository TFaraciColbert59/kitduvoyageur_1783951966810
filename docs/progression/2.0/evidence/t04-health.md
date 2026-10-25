# T04.a — Préparation HTTP et observation bornée

10 octobre 2026, environnement cloud Linux, base applicative d8aeac7e0 (avant intégration de cette tranche).

- Test GET ajouté d’abord : échec `GET is not a function`, 5 succès / 1 échec. Adaptateur `GET = POST` ensuite : 9/9 tests outbox et purge réussis, sans changement des droits, limites ou effets du POST.
- La sonde précédente chargeait les lignes avec une limite REST implicite et arrondissait les minutes avant contrôle. Nouvelle lecture : cinq compteurs HEAD exacts, deux dates triées avec limit 1, seuils comparés sans arrondi. Aucun téléchargement de la file complète.
- `node --test tests/ops/progression-health.test.mjs` : 5/5 succès, file vide, 1500 pending/dead, frontières +1ms, retard classement et erreur/date absente.
- `node --use-env-proxy scripts/ops/progression_outbox_health.mjs` en production, lecture seule : outbox 0 pending/failed/dead ; classement 9 pending, environ 21087 minutes ; `ok=false`, exit 1 attendu pour cette dégradation. Aucun lot traité et aucun gain émis.
- Revue indépendante : complément T04 dans preparation-review.md, conforme et acceptable.

T04 reste ouvert : aucune planification déployée ou panne/reprise réellement observée. L’adaptateur ne présume ni plan Vercel payant ni présence de CRON_SECRET. Le rollback applicatif conserve les journaux et les protections ; cette tranche n’a aucune migration.

Types : première tentative interrompue par mémoire Node (heap par défaut). Relance 6 Go : une erreur nouvelle de typage de test registry et trois erreurs de dépendances préexistantes absentes dans node_modules. Correction du test par son auteur et `npm ci` à partir du lock existant ; vérification de nouveau nécessaire avant intégration.
