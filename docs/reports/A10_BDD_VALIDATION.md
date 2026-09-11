# A10 — Validation BDD (Étape 0-B) — rapport corrigé (méthodologie stricte)

Date : 2026-09-11 (révision suite à revue indépendante) · Environnement : Docker Desktop +
Supabase CLI 2.117 local (PostgreSQL 17.6.1.141) · Dump prod : **schema-only**, hors données.

> Correctif de la revue : le harnais initial (2 passes tolérantes) n'était pas une preuve
> stricte et le « replay historique intégral » revendiqué n'en était pas un. La stratégie
> officielle est désormais **BASELINE + migrations post-baseline**, avec `ON_ERROR_STOP=1`
> sur toutes les phases certifiantes. L'ancien harnais est supprimé.

## 1. Stratégie officielle (ruling)

```text
Baseline = snapshot schema-only de la production au cutoff 20260911120000
           (143 migrations prod déjà appliquées → intégrées, jamais rejouées)
install : PostgreSQL vide → baseline → 33 migrations post-baseline (strictes) → pgTAP → F1 → EXPLAIN
upgrade : baseline (= snapshot historique au cutoff) → ledger initialisé (143 versions prod)
          → 33 migrations post-baseline (strictes) → pgTAP → F1 → EXPLAIN
```

Harnais unique : `scripts/db/install-from-baseline.ps1 -Mode install|upgrade`
(`psql -X -v ON_ERROR_STOP=1` partout ; toute erreur SQL = échec).

Artefacts de baseline (schema-only, **aucune donnée**) :
`supabase/baseline/prod_schema_20260911.sql`, `applied_migrations.txt` (143),
`auth_integration.sql` (trigger `auth.users` non capturé par un dump public),
`grants.sql` (GRANTs absents du dump + default privileges).

## 2. Résultats d'exécution (preuves réelles)

| Mode | Migrations strictes | F1 | EXPLAIN | Verdict |
|---|---|---|---|---|
| `install` | ✅ 33/33 (0 erreur) | ✅ (0 policy large, vue présente) | ✅ 17,7 ms | échecs = pgTAP uniquement |
| `upgrade` | ✅ 33/33 après ledger 143 | ✅ | ✅ 17,6 ms | échecs = pgTAP uniquement |

**Aucune erreur SQL de migration dans les deux modes.** Les échecs restants sont des suites
pgTAP (tests), pas des migrations.

## 3. pgTAP — état réel

| Suite | Statut | Détail |
|---|---|---|
| `a1_domain_security` | ✅ | consentements, passages, profils, seuils, plans, events |
| `a2_segment_processing` | ✅ | contrat de claim réécrit **par IDs** (gate utilisateur) |
| `a10_session_lease` | ✅ 12/12 | |
| `a10_consent_enforcement` | ✅ | |
| `messaging_security` | ✅ 15/15 | |
| `lineage` | ✅ 24/24 | |
| `field_proof` | ✅ (mode upgrade) | 1 réserve locale en mode install (collision de fixtures route prod) |
| `conservation` | ❌ **ouvert** | `could not create unique index "kit_trust_scores_kit_id_key"` au premier refresh non concurrent : la matview produit des doublons de `kit_id` avec les fixtures — défaut de définition/agrégation à instruire |
| `attributions` | 🟠 **quarantaine** | la migration `20260903050000_kit_attributions.sql` est **gelée** (`migrations_frozen/`) et **absente du ledger prod** ET de la baseline : fonctionnalité jamais déployée. Reproduction : `insert_kit_attribution` inexistante. Échec antérieur à A10 (mêmes traces lors du replay historique). A10 n'aggrave pas : aucun objet attributions n'est créé/modifié par les migrations A. |
| `security_lignees` | 🟠 **quarantaine** | même cause : table `kit_attributions` absente (migration gelée non déployée). |

**Quarantaines** : conformes au ruling (cause exacte + reproduction + preuve d'absence prod
`applied_migrations.txt` + preuve d'échec pré-A10 + A10 neutre). Propriétaire : humain ;
cible : décision produit sur la fonctionnalité attributions (dégeler ou retirer les suites).

## 4. Défauts réels découverts et corrigés par cette validation

1. **Claim de sessions** : `UPDATE … WHERE id IN (SELECT … LIMIT n FOR UPDATE)` ne plafonnait
   pas le lot → corrigé en CTE `MATERIALIZED` (migration `20260911230000` modifiée).
2. **Anti-cycle filiation** : `NEW.forked_from = ANY(ancestors)` bloquait **tout fork** →
   condition correcte `NEW.id = ANY(ancestors)` (`20260911350000`).
3. **Immuabilité contournable** : trigger limité à `UPDATE OF forked_from` → élargi aux 4
   champs + message de cycle explicite (`20260911380000`).
4. **Refresh matviews** : `CONCURRENTLY` sur matview non peuplée → repli non concurrent
   (`20260911360000`).
5. **Révocations messagerie** : `anon` pouvait exécuter `is_conversation_member` et
   `get_or_create_direct_conversation` (drift GRANTs prod) → réappliquées (`20260911370000`).

## 5. Hygiène

- Dump prod : schema-only uniquement, hors dépôt, supprimé après usage ; aucune donnée en Git.
- **Aucune écriture en production** (lectures seules : policies, ledger, dump schema-only).
- Flags de domaine toujours OFF.

## 6. Reste pour clore la gate B (et poser les tags)

1. `conservation` : instruire les doublons `kit_trust_scores` (définition matview vs fixtures).
2. `field_proof` en mode install : collision d'IDs de fixtures avec la prod (route 90001) —
   rendre la fixture insensible (IDs improbables) pour que les deux modes soient identiques.
3. Décision sur les quarantaines attributions/security_lignees (dégeler la migration ou retirer
   les suites du périmètre, avec ticket).
4. Re-run `install` + `upgrade` complets verts → CI verte sur le HEAD → **alors seulement**
   `a10-code-done` / `a11-code-done` (sur commit à CI verte).
