# RÉCONCILIATION DE L'HISTORIQUE DES MIGRATIONS SUPABASE

Statut : **ZONE ORANGE (Document cadre & Procédure d'exécution pour Tony)**  
Projet Supabase RÉEL : `icxyvwzfjbflcbqukpfz`  
⚠️ **Projet FANTÔME à NE JAMAIS CIBLER** : `lwrmuggefbmboikjgudc` (référence obsolète et dangereuse issue d'anciens plans maîtres).

---

## 1. Contexte & Règle d'engagement

L'agent Antigravity n'applique **aucune migration directement sur la base distante** (Zone Orange).
La base distante `icxyvwzfjbflcbqukpfz` a fait l'objet de sondages en lecture seule révélant que :
- Les colonnes `stripe_session_id`, `subtotal_eur`, etc. de la table `orders` n'y sont pas encore créées.
- Les tables et vues du chantier Lignées (`materiel_kits.forked_from`, `kit_field_reports`, `kit_trust_scores`) ainsi que du chantier Orientation/Empreinte (`user_orientation`, `user_field_signature`) doivent être appliquées de manière séquencée et contrôlée.
- **La migration `20260903050000_kit_attributions.sql` (Lot 6 — Royalties créateurs) est GELÉE** : elle ne doit **PAS** être appliquée tant que le modèle légal et fiscal des reversements marchands n'est pas validé.

---

## 2. Commande d'inspection à lancer par Tony

Avant toute application, Tony doit vérifier l'état actuel de la base distante via la commande Supabase CLI :

```bash
# Vérifier l'état de synchronisation des migrations sur le projet réel icxyvwzfjbflcbqukpfz
supabase migration list --linked
```

> **Critère de succès** : Supabase affiche la liste des migrations avec leur statut `Remote` / `Local`.
> Si une migration locale est absente de la colonne `Remote`, elle est candidate au déploiement selon l'ordre ci-dessous.

---

## 3. Tableau de réconciliation des migrations récentes

| Migration | Intitulé / Rôle | Statut Local | Statut Distant (`icxyvwzfjbflcbqukpfz`) | Action requise |
|---|---|---|---|---|
| `20260903000000_ai_foundations.sql` | Fondations embeddings AI | Présente | *(À vérifier via CLI)* | À appliquer si manquante |
| `20260903010000_kit_lineage.sql` | Lignées de kits (colonnes filiation, GIN, cycle check, immuabilité) | Présente & Validée pgTAP | *(À vérifier via CLI)* | Étape 1 du déploiement |
| `20260903020000_kit_field_proof.sql` | Épreuve terrain (kit_field_reports, journal anonymisé, RLS) | Présente & Validée pgTAP | *(À vérifier via CLI)* | Étape 2 du déploiement |
| `20260903030000_stripe_fix.sql` | RLS orders/order_items + trigger déstockage + webhook idempotence | Présente & Validée pgTAP | *(À vérifier via CLI)* | Étape 3 du déploiement |
| `20260903040000_kit_conservation.sql` | Vues matérialisées survie d'items & scores de confiance | Présente & Validée pgTAP | *(À vérifier via CLI)* | Étape 4 du déploiement |
| `20260903041000_kit_souches_seed.sql` | Kits souches de référence (bivouac alpin, ultra-léger) | Présente | *(À vérifier via CLI)* | Étape 5 du déploiement |
| `20260903050000_kit_attributions.sql` | Lot 6 — Partage de valeur & store credit | **GELÉE — NE PAS APPLIQUER** | **ABSENTE (INTERDITE)** | **AUCUNE (GELÉE)** |
| `20260904010000_user_orientation.sql` | Boussole d'orientation (table privée, RLS strict own) | Présente & Testée | *(À vérifier via CLI)* | Étape 6 du déploiement |
| `20260904020000_user_field_signature.sql` | Matview empreinte terrain + k-anonymat | Présente & Testée | *(À vérifier via CLI)* | Étape 7 du déploiement |

---

## 4. Ordre strict d'application préconisé

Si la base distante est vierge de ces nouvelles migrations, les exécuter dans cet ordre strict (respect absolu des dépendances relationnelles) :

```bash
# 1. Fondations et filiation
supabase db push --include 20260903010000

# 2. Épreuve terrain (dépend de hike_sessions et materiel_kits)
supabase db push --include 20260903020000

# 3. Réparation Stripe & déstockage (dépend de orders et shop_products)
supabase db push --include 20260903030000

# 4. Conservation & Scores de confiance (dépend de kit_field_reports et materiel_kits)
supabase db push --include 20260903040000

# 5. Kits souches
supabase db push --include 20260903041000

# 6. Orientation (indépendante des lignées, table isolée RLS own)
supabase db push --include 20260904010000

# 7. Empreinte terrain (dépend de hike_sessions et hiking_routes.region)
supabase db push --include 20260904020000
```

---

## 5. Plans de Rollback détaillés

En cas d'erreur ou d'incident lors du déploiement distant, voici les scripts de retour arrière unitaire :

### Rollback `20260904020000_user_field_signature.sql`
```sql
DROP MATERIALIZED VIEW IF EXISTS public.user_field_signature;
DROP FUNCTION IF EXISTS public.refresh_user_field_signature();
```

### Rollback `20260904010000_user_orientation.sql`
```sql
DROP TRIGGER IF EXISTS trg_user_orientation_updated ON public.user_orientation;
DROP FUNCTION IF EXISTS public.touch_user_orientation_updated_at();
DROP TABLE IF EXISTS public.user_orientation;
```

### Rollback `20260903041000_kit_souches_seed.sql`
```sql
DELETE FROM public.materiel_kits
WHERE slug IN ('bivouac-alpin-3j', 'randonnee-ultralegere-ete', 'trek-autonomie-massif-central');
```

### Rollback `20260903040000_kit_conservation.sql`
```sql
DROP MATERIALIZED VIEW IF EXISTS public.kit_trust_scores;
DROP MATERIALIZED VIEW IF EXISTS public.kit_item_survival_by_kit;
DROP FUNCTION IF EXISTS public.refresh_kit_conservation_matviews();
```

### Rollback `20260903030000_stripe_fix.sql`
```sql
DROP TRIGGER IF EXISTS trg_order_decrement_stock ON public.orders;
DROP FUNCTION IF EXISTS public.decrement_stock_on_order();
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS stripe_session_id,
  DROP COLUMN IF EXISTS subtotal_eur,
  DROP COLUMN IF EXISTS shipping_eur,
  DROP COLUMN IF EXISTS payment_method;
DROP TABLE IF EXISTS public.checkout_intents;
```

### Rollback `20260903020000_kit_field_proof.sql`
```sql
DROP FUNCTION IF EXISTS public.get_kit_field_journal(uuid, integer);
DROP TABLE IF EXISTS public.kit_field_reports;
ALTER TABLE public.hiking_routes DROP COLUMN IF EXISTS region;
ALTER TABLE public.hike_sessions DROP COLUMN IF EXISTS kit_id;
```

### Rollback `20260903010000_kit_lineage.sql`
```sql
DROP TRIGGER IF EXISTS trg_kit_lineage ON public.materiel_kits;
DROP FUNCTION IF EXISTS public.handle_kit_lineage();
DROP FUNCTION IF EXISTS public.check_kit_ancestry_cycle(uuid, uuid);
ALTER TABLE public.materiel_kits
  DROP COLUMN IF EXISTS lineage_root_id,
  DROP COLUMN IF EXISTS forked_from,
  DROP COLUMN IF EXISTS generation,
  DROP COLUMN IF EXISTS ancestors;
```
