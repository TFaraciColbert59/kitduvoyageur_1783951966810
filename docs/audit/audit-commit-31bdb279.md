# Audit du commit `31bdb279`

J’ai vérifié la branche distante [`audit/adventure-intelligence`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/tree/audit/adventure-intelligence), qui pointe bien sur le commit complet [`31bdb279`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/commit/31bdb279d740a62b2b1f1d49d3786af3b6b26973).

## Verdict général

Le chantier contient une **très bonne fondation de domaine**, mais il ne constitue pas encore un système utilisable de bout en bout.

| Niveau | Estimation |
|---|---:|
| Architecture et contrats | **85 %** |
| Moteurs métier purs | **80 %** |
| BDD écrite sur le papier | **75 %** |
| Intégration serveur réelle | **50 %** |
| Intégration UI réelle | **20 %** |
| Validation avec données réelles | **10 %** |
| Préparation production | **25 %** |

Le terme approprié est :

> **Socle Adventure Intelligence complet en code, mais produit encore partiellement câblé et non validé sur une véritable base Supabase.**

---

# P0 — Corrections indispensables

## 1. Aucune CI n’a validé le commit distant

La branche d’audit est bien disponible, mais GitHub indique :

- **0 workflow exécuté** pour `audit/adventure-intelligence` ;
- seul le check Vercel « Preview Comments » est vert ;
- ce check ne compile ni ne teste le projet.

La cause se trouve dans [`.github/workflows/ci.yml`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/.github/workflows/ci.yml) :

```yaml
on:
  push:
    branches: [main, 'chantier/**']
```

La branche `audit/**` n’est pas couverte.

### À faire

Modifier temporairement le workflow :

```yaml
on:
  push:
    branches:
      - main
      - 'chantier/**'
      - 'audit/**'
```

Puis exiger les gates suivantes :

```text
npm ci
npm run type-check
npm run lint
npm run verify:invariants
npm run verify:icons
npm test
npm run build
npm run test:e2e
npm run test:a11y
npm run test:visual
```

Le workflow actuel ne lance par ailleurs qu’un seul fichier E2E :

```yaml
npx playwright test scripts/e2e/voyage.spec.ts
```

Il faut exécuter toute la suite Playwright, ou créer une suite dédiée Adventure Intelligence.

---

## 2. Les migrations et tests pgTAP ne sont toujours pas validés

Le rapport [`A9_VERIFICATION.md`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/docs/reports/A9_VERIFICATION.md) confirme explicitement que :

- les 16 migrations n’ont pas été appliquées sur une copie ;
- les suites pgTAP n’ont pas été exécutées sur cette copie ;
- F1 demeure ouvert.

C’est le principal blocage.

### À faire

Sur une base temporaire :

```bash
supabase db push --db-url "$AUDIT_DATABASE_URL"
supabase test db --db-url "$AUDIT_DATABASE_URL"
```

Puis répéter sur une copie anonymisée du schéma réel.

Il faut valider deux scénarios différents :

1. création complète depuis une base vide ;
2. migration d’une base historique existante.

---

## 3. F1 : exposition potentielle des profils utilisateurs

Le rapport de sécurité laisse volontairement ouverte la policy :

```text
public_read_user_profiles
```

Tant que ce point n’est pas fermé, la release doit être bloquée.

### Requête de contrôle

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_profiles';
```

Il faut également tester avec les rôles :

- `anon` ;
- utilisateur A ;
- utilisateur B ;
- administrateur ;
- `service_role`.

Si la lecture publique n’est pas strictement nécessaire, supprimer la policy dans **une nouvelle migration additive**.

---

## 4. Le traitement GPS produit potentiellement de fausses performances

C’est l’écart métier le plus important découvert.

Dans [`processHikeSession.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/src/features/adventure-intelligence/server/processHikeSession.ts), une `LineString` GeoJSON ne possède pas d’horodatage. Le code invente donc un intervalle fixe :

```ts
export const GEOJSON_POINT_INTERVAL_S = 10;
```

Chaque point est artificiellement espacé de dix secondes à partir de `ended_at`.

Conséquences :

- durée des passages potentiellement fausse ;
- allure potentiellement fausse ;
- pauses impossibles à déduire correctement ;
- profil personnel pollué ;
- ETA personnelle mal calibrée ;
- agrégats collectifs faussés.

### Correction obligatoire

Conserver les échantillons GPS horodatés sous une forme adaptée :

```ts
interface PersistedGpsSample {
  lat: number;
  lng: number;
  timestamp: string;
  elevationM?: number;
  accuracyM?: number;
  speedMps?: number;
}
```

La `LineString` doit servir à la géométrie et à l’affichage, pas à reconstruire artificiellement le temps.

Tant que ce correctif n’est pas livré :

- ne pas activer `performance_profile_v2` ;
- ne pas activer `collective_intelligence` ;
- ne pas utiliser ces passages pour calibrer les ETA.

---

## 5. Le pipeline GPS n’est pas transactionnel et peut dupliquer les observations

Le traitement effectue successivement :

1. upsert des passages ;
2. insert des observations ;
3. mise à jour de la session.

Si l’étape 2 ou 3 échoue, un retry peut :

- retrouver les passages existants ;
- réinsérer les observations ;
- produire des doublons dans `performance_observations`.

L’idempotence annoncée n’est donc pas complète.

### Correction

Créer une RPC transactionnelle ou une procédure SQL unique :

```text
persist_processed_hike_session(
  session,
  passages,
  observations,
  processor_version
)
```

Elle doit, dans une seule transaction :

- upserter les passages ;
- upserter les observations avec une clé stable ;
- mettre la session à `processed` ;
- annuler l’ensemble si une étape échoue.

Ajouter une contrainte d’idempotence telle que :

```text
UNIQUE(passage_id, processor_version)
```

ou une clé d’observation calculée explicitement.

---

## 6. Les sessions peuvent rester bloquées éternellement en `processing`

La fonction `a2_claim_pending_sessions` transforme les sessions :

```text
pending → processing
```

Mais il n’existe pas de lease, de date d’expiration ou de récupération explicite si le worker tombe après le claim.

Une session peut donc rester définitivement bloquée.

### Correction

Ajouter :

```text
processing_started_at
processing_attempts
last_processing_error
next_retry_at
```

Puis réclamer :

- les sessions `pending` ;
- les sessions `processing` dont le lease a expiré ;
- uniquement si le nombre maximal de tentatives n’est pas dépassé.

Prévoir un état terminal :

```text
dead_letter
```

---

## 7. Le map-matching fait potentiellement des milliers de RPC séquentielles

Le traitement appelle `getCandidates()` pour chaque coordonnée arrondie distincte :

```ts
for (const [key, coordinates] of coordinatesByKey) {
  await client.getCandidates(...)
}
```

Avec une trace pouvant contenir jusqu’à 50 000 points, cela peut produire plusieurs milliers de requêtes PostGIS séquentielles.

Conséquences :

- timeout du cron ;
- coût BDD élevé ;
- sessions bloquées ;
- latence très importante ;
- contention Postgres.

### Correction

Remplacer le N+1 par une RPC batch :

```text
a2_match_track_candidates(points jsonb, radius_m float8)
```

Ou envoyer la trace simplifiée en une fois et effectuer :

- simplification ;
- recherche spatiale ;
- projection ;
- classement des candidats ;

directement dans PostgreSQL/PostGIS.

Ajouter une limite de durée et une simplification adaptée à la précision GPS.

---

## 8. Le rattachement observation → passage est ambigu

Le code regroupe les passages persistés uniquement par `segment_id`, puis utilise une file :

```ts
const idsBySegment = new Map<number, string[]>();
```

Si une randonnée parcourt deux fois le même segment, l’ordre retourné par l’upsert Supabase n’est pas garanti. Une observation peut être associée au mauvais passage.

### Correction

Donner à chaque passage une clé déterministe :

```text
session_id
segment_id
direction
entered_at
processor_version
```

Puis retourner cette clé complète lors de l’upsert et effectuer le rattachement par clé exacte, jamais uniquement par `segment_id`.

---

## 9. La génération d’aventure n’est pas transactionnelle

Dans [`generateAdventure.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/src/features/adventure-intelligence/server/generateAdventure.ts), la persistance est séquentielle :

1. insertion du plan ;
2. insertion de la version ;
3. insertion des runs un par un ;
4. insertion des décisions.

Si une étape échoue, un plan incomplet reste en base.

### Correction

Créer une RPC transactionnelle :

```text
create_adventure_plan_bundle(
  plan jsonb,
  version jsonb,
  runs jsonb,
  decisions jsonb
)
```

Le plan, sa version initiale, ses runs et ses décisions doivent être persistés atomiquement.

---

## 10. `/api/adventure/generate` n’a ni rate limiting ni idempotence

La route [`/api/adventure/generate`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/src/app/api/adventure/generate/route.ts) vérifie bien :

- l’authentification ;
- le JSON ;
- le schéma Zod.

Mais il manque :

- limitation par utilisateur ;
- quota par abonnement ;
- clé d’idempotence ;
- protection contre le double clic ;
- limite de génération simultanée ;
- contrôle de coût ;
- timeout explicite.

### Correction

Accepter un en-tête :

```text
Idempotency-Key
```

Puis imposer :

- une seule génération active par utilisateur ;
- un quota par minute/jour ;
- une réponse identique pour une clé déjà traitée ;
- un statut de job si la génération devient longue.

---

## 11. Le consentement n’est pas imposé au traitement personnel

[`buildUserProfile.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/src/features/adventure-intelligence/server/buildUserProfile.ts) reconstruit et persiste le profil sans vérifier directement le consentement `personal_performance`.

Le cron GPS crée également des `performance_observations` sans contrôle explicite du consentement dans la route ou dans la fonction de claim.

### Correction

Établir une règle sans ambiguïté :

- segmentation technique de la session : possible pour fournir le service demandé ;
- création d’observations personnelles : seulement avec `personal_performance` actif ;
- inclusion collective : seulement avec `collective_terrain` actif ;
- profil de groupe : seulement selon la politique de partage du groupe.

Le contrôle doit être dans la couche serveur ou SQL, pas seulement dans l’interface.

---

## 12. La révocation d’un consentement n’entraîne aucune purge visible

[`consents.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/src/features/adventure-intelligence/server/consents.ts) enregistre bien `revoked_at`, mais aucune procédure complète n’est visible pour :

- supprimer ou désactiver les observations dérivées ;
- reconstruire les profils ;
- retirer les contributions collectives futures ;
- invalider les agrégats affectés ;
- purger les caches et données offline.

### Correction

Mettre en place un événement de révocation :

```text
consent.revoked
```

avec traitement idempotent :

```text
révoquer
→ désactiver les observations
→ reconstruire/supprimer le profil
→ recalculer les agrégats concernés
→ invalider les caches
→ purger les données locales
→ journaliser la réalisation
```

---

# P0 — Fonctionnalités annoncées mais non actives

## 13. L’ETA n’est pas réellement personnalisée

Le rapport A9 le confirme : `buildUserProfile` n’a pas d’appelant de production.

Dans la route de génération, aucun profil n’est chargé ni injecté dans `predictionAdapter`. Le moteur retombe donc sur l’allure standard.

Par ailleurs, [`predictionAdapter.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/src/features/adventure-intelligence/server/adapters/predictionAdapter.ts) utilise :

```text
uniform_from_blueprint
```

Il divise les agrégats du blueprint en segments moyens. Il ne prédit pas encore à partir d’une véritable route map-matchée.

### À faire

- charger le profil courant ;
- vérifier le consentement ;
- charger les véritables segments de la route ;
- injecter surfaces, pente, sens, longueur et dénivelé ;
- persister `segment_predictions` et `route_predictions` ;
- comparer l’ETA au temps réellement observé.

---

## 14. Les trois variantes ne sont pas trois plans complets

Les candidats « confort », « équilibré » et « aventure » sont surtout des variations de scores/deltas. Ils ne constituent pas encore trois itinéraires complets ayant chacun :

- géométrie ;
- étapes ;
- hébergements ;
- budget ;
- matériel ;
- risques ;
- ETA ;
- provenance ;
- décisions propres.

### À faire

Générer trois `AdventureCandidatePlan` complets, puis permettre :

```text
prévisualiser → comparer → sélectionner → matérialiser comme version du plan
```

---

## 15. Plusieurs sections du plan sont explicitement toujours vides

Dans `buildPlanSections()` :

```ts
bookings: null,
documents: null,
regulations: null,
offlinePackage: null,
liveConditions: null,
```

De plus, météo, réglementation et documents utilisent des adaptateurs volontairement `skipped` dans [`skippedAdapters.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/src/features/adventure-intelligence/server/adapters/skippedAdapters.ts).

### Il reste à construire

- source météo réelle ;
- réglementation officielle ;
- documents nécessaires par destination ;
- conditions Terrain Live injectées dans le plan ;
- génération du pack offline ;
- couche réservation/transaction lorsque souhaitée.

---

## 16. L’explication IA n’est jamais branchée dans la route

`generateAdventure()` accepte une fonction optionnelle :

```ts
explain?: (context) => Promise<string>
```

Mais `/api/adventure/generate` ne la fournit pas.

Résultat : `aiUsed` reste normalement `false` pour cette explication, et seul le résumé local est produit.

Ce n’est pas dangereux — le fallback est bon — mais la fonctionnalité annoncée n’est pas active.

---

## 17. Les shadow runners n’existent pas

Les fonctions de comparaison et les flags existent, mais aucun job ne les exécute.

Il faut créer au minimum :

- `run-profile-shadow` ;
- `run-route-prediction-shadow` ;
- `run-collective-shadow` ;
- `run-terrain-auto-detection-shadow`.

Les sorties doivent être persistées dans une table dédiée avec :

- version V1 ;
- version V2 ;
- différence ;
- erreur observée ;
- confiance ;
- latence ;
- décision de promotion.

---

# P1 — Terrain Live

## 18. Fusion anti-doublon non atomique

Le code :

1. lit le rapport ;
2. calcule `report_count + 1` ;
3. met à jour.

Deux signalements simultanés peuvent écraser leur incrément respectif.

### Correction

Faire la fusion dans une RPC transactionnelle :

```sql
UPDATE terrain_reports
SET report_count = report_count + 1,
    updated_at = now()
WHERE id = ...
RETURNING ...;
```

## 19. Un même utilisateur peut artificiellement renforcer un rapport

La fusion d’un nouveau signalement augmente `report_count`, mais ne crée pas nécessairement une corroboration unique par utilisateur.

Il faut empêcher qu’un utilisateur renforce plusieurs fois le même événement avec des signalements répétés.

## 20. Course lors des confirmations

Le code vérifie l’existence, puis insère. La contrainte unique protège probablement la BDD, mais une course concurrente peut transformer un doublon normal en erreur 500.

Il faut convertir l’erreur d’unicité en réponse métier `duplicate`.

## 21. URLs de photo externes non maîtrisées

`photoUrl` accepte n’importe quelle URL valide.

Avant activation réelle :

- stockage contrôlé ;
- types MIME ;
- taille réelle vérifiée serveur ;
- suppression EXIF ;
- scan ;
- URL signée ;
- suppression/modération ;
- interdiction des schémas et domaines non autorisés.

## 22. Lecture publique sans cache ni rate limit

`GET /api/terrain/conditions` peut devenir coûteux. Ajouter :

- cache court ;
- limite par IP/session ;
- rayon par défaut prudent ;
- quotas ;
- métriques de latence PostGIS.

---

# P1 — Intelligence collective

## 23. Risque de conservation d’anciens agrégats publiables

Si un agrégat auparavant public passe sous cinq utilisateurs après révocation ou expiration, le calcul actuel « supprime » l’écriture mais ne montre pas qu’il retire l’ancien agrégat.

Il faut :

- supprimer l’ancien agrégat ;
- ou le marquer `publishable = false` ;
- ou garantir que la vue publique vérifie récence et seuil à chaque lecture.

## 24. Limite globale de 5 000 passages

Le cron charge au maximum 5 000 passages pour jusqu’à 200 segments, triés par récence globale. Les segments très fréquentés peuvent monopoliser le lot.

Utiliser :

- une limite par segment ;
- une pagination ;
- un curseur ;
- une fenêtre déterministe ;
- un statut de recalcul.

## 25. Consentements versionnés ambigus

Le consentement est unique par :

```text
user_id, purpose, policy_version
```

Mais l’agrégateur considère qu’un utilisateur est consentant si **n’importe quelle ancienne version** possède encore une ligne active.

Il faut définir « consentement courant » :

- dernière version seulement ;
- ou version minimale obligatoire ;
- ou table d’état courant distincte de l’historique.

---

# P1 — Offline

## 26. La base Dexie n’est pas séparée par utilisateur

[`offline/db.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/src/features/adventure-intelligence/offline/db.ts) utilise une base globale :

```text
lkdv-adventure-offline-v1
```

Les lignes ne possèdent pas systématiquement de `userId`.

Sur un appareil partagé :

```text
utilisateur A se déconnecte
→ utilisateur B se connecte
→ risque de retrouver des données locales de A
```

### Correction obligatoire

- partitionner les données par `userId` ;
- purger à la déconnexion ;
- tester le changement de compte ;
- chiffrer les informations sensibles si elles doivent persister.

## 27. Empreinte FNV-1a 32 bits trop faible

L’idempotence utilise un hash 32 bits. Une collision peut supprimer ou ignorer une opération légitime.

Utiliser SHA-256 via Web Crypto, ou une clé déterministe robuste générée côté métier.

## 28. `markSynced(ids)` supprime dans toutes les files

La suppression recherche chaque identifiant dans les trois tables. Il est préférable de retourner :

```ts
{ store, id }
```

et de supprimer uniquement dans la file concernée.

## 29. Aucun véritable moteur de synchronisation

La base et les opérations existent, mais il manque encore :

- worker de synchronisation ;
- backoff exponentiel ;
- `nextAttemptAt` ;
- `lastError` ;
- dead-letter queue ;
- priorité ;
- expiration ;
- résolution de conflit ;
- reprise après crash ;
- verrou multi-onglets ;
- gestion des quotas IndexedDB.

---

# P1 — UI et fonctionnalités de domaine

## 30. Les composants ne sont pas montés

Les composants existent, mais le rapport A7 confirme que l’intégration Hub est différée :

- `AdventureCockpit` ;
- `AdventureHubSection` ;
- `OfflineBanner`.

Il faut les brancher à de vraies données, pas à des fixtures.

## 31. Groupe, trek et entitlements sont essentiellement des fonctions de domaine

Le groupe, le trek et la monétisation disposent de contrats et calculs purs, mais il manque encore selon les éléments audités :

- persistance complète ;
- endpoints ;
- écrans ;
- édition ;
- invitations ;
- synchronisation ;
- gestion des conflits ;
- branchement aux plans ;
- validation d’entitlements côté serveur.

## 32. Les contrats B2B ne sont que des contrats futurs

La spec A8 le dit explicitement :

- aucune implémentation ;
- aucun endpoint ;
- uniquement interfaces et catalogue de versions.

Ils ne doivent donc pas être présentés comme une capacité produit active.

---

# P1 — Observabilité et rollout

## 33. Le rollout 1 % → 100 % n’est pas encore techniquement réalisé

Le document prévoit des cohortes, mais les flags visibles sont surtout des booléens globaux.

Il manque :

- attribution stable d’une cohorte ;
- activation par pourcentage ;
- allowlist interne ;
- exclusion ;
- audit des changements ;
- acteur ayant changé le flag ;
- date d’effet ;
- métriques par cohorte.

## 34. Observabilité trop minimale

`adventure_engine_runs` constitue une bonne base, mais il faut compléter avec :

- identifiant de corrélation ;
- version globale de pipeline ;
- timestamps réels début/fin ;
- durée de chaque requête externe ;
- taux de fallback ;
- raisons de skip ;
- coûts IA ;
- volume PostGIS ;
- erreurs de synchronisation ;
- métriques Terrain Live ;
- métriques de calibration.

Actuellement, `started_at` et `finished_at` sont tous deux alimentés avec le même `now`, malgré `duration_ms`.

## 35. Aucun backtesting réel n’est livré

Le moteur de backtesting existe, mais pas :

- dataset ;
- exécution ;
- rapport chiffré ;
- seuils validés ;
- historique des résultats ;
- comparaison V1/V2.

Les critères du rollout ne peuvent donc pas encore être mesurés.

---

# P1 — Sécurité et exploitation

## 36. Clé anon et URL Supabase codées en dur

Le finding F5 est confirmé dans [`src/lib/supabase/client.ts`](https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/blob/audit/adventure-intelligence/src/lib/supabase/client.ts).

Même si la clé anon est publique par conception, le fallback doit être supprimé pour :

- éviter de cibler le mauvais environnement ;
- empêcher une build locale de parler accidentellement à la production ;
- respecter la politique du dépôt.

## 37. `main` n’est pas protégée

Le `main` distant est publiquement signalé comme non protégé.

À configurer :

- PR obligatoire ;
- CI obligatoire ;
- revue obligatoire ;
- interdiction du force-push ;
- interdiction de suppression ;
- approbation manuelle de production.

## 38. GitHub Actions non épinglées par SHA

Les actions utilisent notamment :

```yaml
uses: actions/checkout@v4
uses: actions/setup-node@v4
uses: actions/upload-artifact@v4
```

Pour une chaîne logicielle durcie, les épingler par SHA.

## 39. Aucun test DB dans la CI principale

Le workflow qualité ne lance pas :

```bash
supabase db reset
supabase test db
```

Il faut un job PostgreSQL/Supabase séparé.

---

# P2 — Pour atteindre le système complet

## 40. Sources vivantes

À intégrer plus tard ou maintenant selon la stratégie :

- météo ;
- alertes officielles ;
- fermetures administratives ;
- refuges/hébergements ;
- transports ;
- points d’eau ;
- réglementation locale ;
- documents de voyage.

## 41. Calibration terrain

Il faut constituer un jeu de données anonymisé et mesurer :

- MAE ETA ;
- couverture P90 ;
- biais montée/descente ;
- précision map-matching ;
- précision difficulté ;
- dérive selon surface ;
- dérive selon saison ;
- faux positifs Terrain Live.

## 42. Gouvernance et conformité

Finaliser :

- export utilisateur ;
- effacement ;
- rétention ;
- purge des sauvegardes ;
- registre des traitements ;
- consentement versionné ;
- audit administrateur ;
- procédure d’incident ;
- politique de modération ;
- mentions de non-garantie outdoor.

## 43. Exploitation

Préparer :

- sauvegarde ;
- restauration testée ;
- rollback applicatif ;
- rollback par flag ;
- dead-letter queues ;
- dashboards ;
- alertes ;
- runbooks ;
- rotation des secrets ;
- budgets IA/cartographie ;
- tests de charge.

## 44. Connecteurs santé

Ils sont correctement absents conformément à la décision initiale. Il ne faut pas les ajouter avant :

- consentement dédié ;
- analyse d’impact ;
- stockage local privilégié ;
- minimisation ;
- chiffrement ;
- révocation ;
- suppression ;
- validation juridique.

---

# Backlog final priorisé

## P0 — Avant préproduction

- [ ] Faire exécuter la CI sur la branche d’audit.
- [ ] Appliquer les migrations sur une base vide.
- [ ] Appliquer les migrations sur une copie historique.
- [ ] Exécuter toutes les suites pgTAP.
- [ ] Fermer F1 `public_read_user_profiles`.
- [ ] Remplacer les timestamps GPS artificiels.
- [ ] Rendre le traitement session transactionnel et idempotent.
- [ ] Ajouter lease/retry/dead-letter aux sessions.
- [ ] Remplacer les RPC PostGIS N+1 par une opération batch.
- [ ] Rendre la génération du plan transactionnelle.
- [ ] Ajouter rate limit et idempotence à `/api/adventure/generate`.
- [ ] Imposer les consentements aux traitements personnels.
- [ ] Implémenter la révocation et la purge.
- [ ] Brancher le profil réel et les segments réels à la prédiction.
- [ ] Monter le Cockpit et le Hub.
- [ ] Écrire les shadow runners.
- [ ] Ajouter les tests E2E Adventure Intelligence.

## P1 — Avant bêta publique

- [ ] Corriger les courses Terrain Live.
- [ ] Empêcher les corroborations multiples d’un même utilisateur.
- [ ] Sécuriser les photos.
- [ ] Invalider les agrégats sous le seuil.
- [ ] Corriger la pagination de l’agrégation.
- [ ] Versionner correctement les consentements.
- [ ] Isoler Dexie par utilisateur.
- [ ] Remplacer FNV-1a.
- [ ] Construire le worker de synchronisation.
- [ ] Brancher groupe, trek et entitlements.
- [ ] Produire trois vrais plans candidats.
- [ ] Ajouter météo/réglementation/documents/conditions live.
- [ ] Construire les cohortes de feature flags.
- [ ] Ajouter métriques, alertes et dashboards.
- [ ] Exécuter un vrai backtesting.
- [ ] Supprimer la clé Supabase codée en dur.
- [ ] Protéger `main`.
- [ ] Ajouter les tests BDD à la CI.

## P2 — Avant généralisation à 100 %

- [ ] Tests de charge.
- [ ] Tests batterie.
- [ ] Tests offline sur appareils réels.
- [ ] Tests iOS et Android.
- [ ] Calibration sur plusieurs terrains et saisons.
- [ ] Validation juridique/RGPD.
- [ ] Test de restauration.
- [ ] Test de rollback.
- [ ] Runbooks support et incident.
- [ ] Rollout 1 %, 5 %, 20 %, 50 %, puis 100 %.

---

# Conclusion

La branche ne doit pas être rejetée : **le travail de fond est important, structuré et bien testé au niveau unitaire**. Cependant, les tags `a1-done` à `a9-done` signifient surtout que les fondations prévues ont été écrites.

Les cinq obstacles principaux sont maintenant très clairs :

1. **BDD jamais exécutée sur une copie réelle** ;
2. **timestamps GPS artificiels qui invalident les données de performance** ;
3. **pipelines de persistance non transactionnels** ;
4. **profil, shadow mode, offline et UI non branchés de bout en bout** ;
5. **absence de calibration et de rollout réellement instrumenté**.

Le prochain chantier doit donc être un **lot de finalisation P0**, et non une nouvelle phase fonctionnelle. Tant que ces P0 ne sont pas terminés, les feature flags doivent rester désactivés.