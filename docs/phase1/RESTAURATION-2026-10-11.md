# Test de restauration isolée T01 — tables de points (2026-10-11)

> **Statut** : ✅ Test exécuté, restauration fidèle au manifest (13/13 compteurs).
> ⚠️ Les contrôles fonctionnels B et C révèlent des écarts **propres au snapshot du
> 2026-10-10T13:29:31Z** (état *avant* les migrations I1/I2/I4 de la même journée).
> Ces écarts sont signalés sans maquillage en §6 et §7. Le manifest, lui, est
> **conforme à 100 %**.

| | |
|---|---|
| **Date/heure d'exécution** | 2026-10-11 14:25 CEST (Europe/Paris, UTC+02:00) — 12:25 UTC |
| **Source** | `backups/phase1-2026-10-10T13-29-31-910Z/*.json` (snapshot prod 2026-10-10T13:29:31.911Z, 13 tables + `manifest.json`) |
| **Cible** | Schéma `restore_t01` du container Docker **local** `supabase_db_ai-finalization` |
| **Rôle SQL** | `supabase_admin` (superuser local) |
| **Script** | `scripts/ops/t01_restore_check.sql` |
| **Prod** | ❌ Aucune connexion. Aucune commande `--linked`. Aucun objet `public.*` modifié (insertions confinées à `restore_t01`). |

---

## 1. Objectif

Démontrer qu'une **restauration isolée** des 13 tables de points depuis les
sauvegardes JSON du 10/10/2026 est possible, fidèle au manifest, et vérifier
4 contrôles d'intégrité (compteurs, fidélité legacy, économique, progression),
sans toucher à la production ni à `public.*`.

---

## 2. Méthode réelle (commandes exécutées)

### 2.1 Copie des fichiers + contrôle d'intégrité

```powershell
docker exec supabase_db_ai-finalization bash -c "mkdir -p /tmp/t01"
# pour les 13 tables + manifest.json :
docker cp "<backup>\<table>.json" supabase_db_ai-finalization:/tmp/t01/<table>.json
```

Contrôle d'intégrité du transfert (`sha256sum` dans le container vs `manifest.json`) :

```text
e06a9770...cd13  user_profiles.json            (sha manifest : e06a9770...cd13 ✅)
8af51e13...a2f1  loyalty_history.json          (✅)
4f53cda1...b945  loyalty_redemptions.json      (✅)
c8840f8b...5891  reward_transactions.json      (✅)
916ff157...3363  progression_outbox.json       (✅)
4f53cda1...b945  progression_events.json       (✅)
4a30e2e2...7a5  user_progression.json          (✅)
bd255a60...f304  user_season_progress.json     (✅)
facd3dbe...a160  orders.json                   (✅)
4f53cda1...b945  progression_legacy_snapshot.json (✅)
e4f0e845...1b5c  reward_accounts.json          (✅)
fb870c57...8a3d  kit_reports.json              (✅)
02b84a6c...389f  reward_config.json            (✅)
```

**13/13 fichiers conformes au manifest** (sha256 identiques, aucun tronquage).

### 2.2 Restauration (script `scripts/ops/t01_restore_check.sql`)

```powershell
docker cp scripts/ops/t01_restore_check.sql supabase_db_ai-finalization:/tmp/t01/
docker exec -i supabase_db_ai-finalization psql -U supabase_admin -d postgres `
  -v ON_ERROR_STOP=1 -A -F "|" -f /tmp/t01/t01_restore_check.sql
```

Le script contient, dans l'ordre :

1. `DROP SCHEMA IF EXISTS restore_t01 CASCADE; CREATE SCHEMA restore_t01;`
2. Pour les 13 tables :
   `CREATE TABLE restore_t01.<t> (LIKE public.<t> INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY);`
3. Pour 12 tables, la commande générique demandée :
   `INSERT INTO restore_t01.<t> SELECT * FROM jsonb_populate_recordset(null::public.<t>, (SELECT pg_read_file('/tmp/t01/<t>.json')::jsonb));`
   (une variante pour `user_profiles` — voir §3.2).

### 2.3 Adaptations par rapport au plan initial (détaillées)

| Point | Plan initial | Réalité constatée | Adaptation |
|---|---|---|---|
| Rôle SQL | `-U postgres` | `postgres` **n'est pas superuser** dans ce container (`rolsuper = f`) → `ERROR: permission denied for function pg_read_file` | Bascule sur `-U supabase_admin` (`rolsuper = t`, `pg_read_file` OK, manifest lu : 2124 octets). Restauration toujours **dans le container local**. |
| Colonne `is_demo` | insertion générique `SELECT *` | `user_profiles.is_demo` (**NOT NULL DEFAULT false**) est absente des JSON : colonne ajoutée par la migration `20261010160000` (I2), postérieure au snapshot du 10/10 13:29 | Injection du défaut de schéma (`false`) dans chaque élément JSON avant `jsonb_populate_recordset`, pour cette seule table. Vérifié : aucune autre colonne du schéma n'est absente des JSON (requête de contrôle sur `information_schema.columns`). |
| Fichiers « minifiés » | — | Un fallback CSV (JSON minifié) avait été préparé avant la découverte de `supabase_admin` | **Non utilisé**, supprimé du container après le test. Les restaurations proviennent des JSON d'origine (`/tmp/t01/*.json`), sha256 vérifiés. |

Aucun objet `public.*` n'a été créé, modifié ou supprimé. Le schéma `restore_t01`
a été **laissé en place pour inspection** (13 tables, cf. §8) — c'est volontaire
et documenté, conformément à l'option prévue.

---

## 3. Sorties brutes de la restauration

```text
=== 1. Schema isole ===
DROP SCHEMA        (NOTICE: schema "restore_t01" does not exist, skipping)
CREATE SCHEMA

=== 2. Clones de structure ===
CREATE TABLE x13

=== 3. Insertions depuis les JSON (jsonb_populate_recordset) ===
INSERT 0 111   -- user_profiles
INSERT 0 6     -- loyalty_history
INSERT 0 0     -- loyalty_redemptions   ([] -> 0 ligne, normal)
INSERT 0 31    -- reward_transactions
INSERT 0 15    -- progression_outbox
INSERT 0 0     -- progression_events    ([] -> 0 ligne, normal)
INSERT 0 9     -- user_progression
INSERT 0 9     -- user_season_progress
INSERT 0 3     -- orders
INSERT 0 0     -- progression_legacy_snapshot ([] -> 0 ligne, normal)
INSERT 0 111   -- reward_accounts
INSERT 0 6     -- kit_reports
INSERT 0 12    -- reward_config
```

Code de sortie global : **0** (`ON_ERROR_STOP=1`, aucune erreur SQL).

---

## 4. Contrôle A — compteurs restaurés vs `manifest.json`

Sortie psql réelle :

```text
table_name|manifest_rows|restored_rows|match
kit_reports|6|6|t
loyalty_history|6|6|t
loyalty_redemptions|0|0|t
orders|3|3|t
progression_events|0|0|t
progression_legacy_snapshot|0|0|t
progression_outbox|15|15|t
reward_accounts|111|111|t
reward_config|12|12|t
reward_transactions|31|31|t
user_profiles|111|111|t
user_progression|9|9|t
user_season_progress|9|9|t
(13 rows)
```

| Table | Attendu (manifest) | Obtenu (restore_t01) | Match |
|---|---:|---:|---|
| kit_reports | 6 | 6 | ✅ |
| loyalty_history | 6 | 6 | ✅ |
| loyalty_redemptions | 0 | 0 | ✅ |
| orders | 3 | 3 | ✅ |
| progression_events | 0 | 0 | ✅ |
| progression_legacy_snapshot | 0 | 0 | ✅ |
| progression_outbox | 15 | 15 | ✅ |
| reward_accounts | 111 | 111 | ✅ |
| reward_config | 12 | 12 | ✅ |
| reward_transactions | 31 | 31 | ✅ |
| user_profiles | 111 | 111 | ✅ |
| user_progression | 9 | 9 | ✅ |
| user_season_progress | 9 | 9 | ✅ |

**13/13 conformes.**

---

## 5. Contrôle B — fidélité : `user_profiles.loyalty_points` vs `SUM(loyalty_history.points)`

Sortie psql réelle :

```text
profiles|journal_rows|journal_sum|ecarts
111|6|16760|10

--- detail des ecarts (user | points_profil | somme_journal) :
id|loyalty_points|journal_sum
2b963f49-0725-4dd3-8e49-b6c63884d250|1650|
3612c45b-d3d7-4e3c-921f-686953ee69e9|2900|
44545b16-e32d-4340-a790-9275b4cecb02|590|
485fc864-6b5f-4417-8755-be6d806d4175|2400|
4bb56d7e-2371-4589-8e0f-e8a4274b5b03|750|
870e373d-28af-413d-a53e-154dc480f629|980|
940b68bb-5d40-433d-ae34-d09750aadab8|0|4380
b431d26e-5d6a-4b0a-8f02-e356bf66e748|1350|
ce296ba3-cf7e-489a-9e43-6b72567e4d59|2600|
d5451f35-db9f-4575-9114-6d3b79550bbc|1850|
(10 rows)

--- journal : repartition par type :
type|rows|sum_points
earned|3|8380
purchase|3|8380
(2 rows)
```

**Résultat : 10 écarts** (et non 0). Détail :

- **9 utilisateurs** ont des points dans leur profil (`loyalty_points` > 0) mais
  **aucune ligne de journal** : `2b963f49, 3612c45b, 44545b16, 485fc864,
  4bb56d7e, 870e373d, b431d26e, ce296ba3, d5451f35` — ce sont exactement les
  9 utilisateurs de `user_progression` (points issus de la progression, pas du
  journal legacy).
- **1 utilisateur** (`940b68bb`) a **4380 points au journal** mais `0` dans son
  profil.

> **Interprétation (cf. §6)** : ces 10 écarts sont l'état **réel et attendu** du
> snapshot du 10/10 13:29:31Z, **avant** la migration I1. La mission mentionnait
> « 0 écart (16 lignes de journal dont 10 ouvertures) » : c'est l'état **après**
> I1 (backfill de 10 lignes d'ouverture), qui n'est **pas** dans ce backup.

---

## 6. Contrôle C — économique : `reward_accounts` vs `SUM(reward_transactions.points)`

Sortie psql réelle :

```text
accounts|transactions|ecarts_available|ecarts_lifetime
111|31|1|1

--- detail des ecarts (user | available | ledger_bal | lifetime | ledger_pos) :
user_id|available_points|sum_affects_balance|lifetime_points|sum_positive
d5451f35-db9f-4575-9114-6d3b79550bbc|2480|12|3120|9412
(1 row)
```

**Résultat : 1 écart `available` + 1 écart `lifetime`**, sur le même compte :
`d5451f35-...` (compte **démo**).

> **Interprétation** : cet écart est **documenté et connu** — c'est exactement
> l'écart corrigé par la réconciliation I4 (cf. §7). Il est présent dans le
> snapshot du 13:29 et disparaît des états post-I4.

---

## 7. Contrôle D — progression : `progression_events` vs `user_progression`

Sortie psql réelle :

```text
events_rows|events_points_total|user_progression_rows|user_lifetime_total
0|0|9|29435

--- comparaison demandee : SUM(events.points_total) vs SUM(user_progression.lifetime_points) :
sum_events|sum_lifetime|users_sans_parite
0|29435|9

--- outbox : repartition par statut (contexte) :
status|rows
processed|15
```

**Résultat : 0 événement** — conforme à l'attendu (« 0 événement à la
sauvegarde »). `SUM(progression_events.points_total) = 0` vs
`SUM(user_progression.lifetime_points) = 29435` : les 9 projections sont
initialisées mais aucun événement n'existe encore dans ce snapshot (la chaîne
d'événements sera produite/backfillée par I4). Les 15 lignes d'outbox sont
toutes `processed` (contexte).

---

## 8. Écarts au manifest

**Aucun écart.** Les 13 compteurs restaurés sont **exactement** ceux de
`manifest.json` (§4). Les écarts observés aux contrôles B et C sont des écarts
**fonctionnels du snapshot** — pas des écarts de restauration — et sont
attribués ci-dessous, sans maquillage.

### 8.1 Attribution des écarts fonctionnels (B : 10, C : 1)

Chronologie factuelle (preuves dans le repo) :

| Heure (UTC) 2026-10-10 | Événement | État journal legacy | État économique |
|---|---|---|---|
| **13:29:31** | **Snapshot T01** (`backups/phase1-2026-10-10T13-29-31-910Z`) | 6 lignes, **10 écarts** | **1 écart** (d5451f35, démo) |
| ~14:00 | Migration I1 `20261010140000` (balance lockdown + backfill de **10 lignes d'ouverture** `opening_balance`) | → 16 lignes, **0 écart** (cf. `docs/phase1/RAPPORT-DEPLOIEMENT-INCR1.md` : « 10 lignes d'ouverture, 0 écart de solde ») | — |
| ~16:00 | Migration I2 `20261010160000` (ajout `is_demo`) | — | — |
| 15:54 & 16:13 | Réconciliation I4 : purge projections démo, provenance comptes démo | 16 lignes, 0 écart (`backups/reconcile-i4-*`) | 0 écart (`affects_balance_tx` = 18) |
| 2026-10-11 12:09 | Scan d'anomalies prod (`backups/phase1-anomaly-scan-2026-10-11T12-09-43-032Z`) | 16 lignes, 0 mismatch | 0 mismatch |

**Conclusion** : la restauration reproduit **fidèlement l'état sauvegardé** au
13:29:31Z (pré-I1). Les « 0 écart » attendus dans la mission correspondent à
l'état post-I1/I4 de la prod (16 lignes dont 10 ouvertures), qui est **postérieur
au snapshot restauré**. Aucune donnée n'est perdue ou altérée par la
restauration : ce sont les mêmes écarts que ceux qui existaient en prod avant
réconciliation.

---

## 9. Horodatage

- Fin d'exécution : **2026-10-11 14:25:19 +02:00** (« Romance Standard Time »,
  Europe/Paris) = **12:25:19 UTC** (horloge du container vérifiée via `date -u`).
- Snapshot source : 2026-10-10T13:29:31.911Z (veille, UTC).

---

## 10. Limites du test

1. **Même cluster local** : la restauration s'effectue dans le **même cluster
   PostgreSQL** que `public` (container local), dans un **schéma isolé**
   `restore_t01`. Ce n'est **pas** un cluster distinct : le test démontre la
   restaurabilité logique des données JSON, pas la reconstruction d'une
   infrastructure complète (rôles, extensions, RLS, triggers, FK — non copiés
   par `LIKE`).
2. **`LIKE` ne copie pas** : FK, UNIQUE, CHECK, RLS, triggers, index, commentaires.
   La restauration valide le contenu, pas la topologie relationnelle complète.
   (Le dump complet `data_public_full.sql` permettrait un test de cluster complet —
   hors périmètre ici.)
3. **`is_demo`** : valeur forcée au défaut de schéma (`false`) pour les 111
   profils, faute de donnée dans le snapshot (§2.3). Les comptes démo du
   snapshot ne sont pas identifiables rétroactivement dans `restore_t01`.
4. **Lecture fichier** : via `pg_read_file` (rôle superuser local). Pas d'accès
   réseau, pas de prod.
5. Les identifiants réels (uuid, e-mails) apparaissent dans les sorties de
   contrôle ; ce document reste interne (même niveau de confidentialité que les
   backups JSON déjà présents dans le repo).

---

## 11. Nettoyage

Le schéma `restore_t01` est **laissé en place pour inspection** (option prévue) :

- État vérifié après test : `restore_t01` = 13 tables ; `user_profiles` = 111,
  `reward_accounts` = 111.

Nettoyage manuel quand l'inspection est terminée :

```powershell
docker exec -i supabase_db_ai-finalization psql -U supabase_admin -d postgres `
  -c "DROP SCHEMA IF EXISTS restore_t01 CASCADE;"
```

(Le script `t01_restore_check.sql` est idempotent : il redémarre par
`DROP SCHEMA IF EXISTS ... CASCADE`.)

---

## 12. Artefacts

| Fichier | Rôle |
|---|---|
| `scripts/ops/t01_restore_check.sql` | Script SQL complet du test (création, insertions, 4 contrôles) |
| `docs/phase1/RESTAURATION-2026-10-11.md` | Ce rapport |
| `backups/phase1-2026-10-10T13-29-31-910Z/*` | Source (inchangée, sha256 vérifiés) |
