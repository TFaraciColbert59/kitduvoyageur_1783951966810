# A15 — Budgets et coûts : inventaire réel et hypothèses

Date : 2026-09-11 · Statut : inventaire de code + compteurs locaux mesurés.
**Aucun chiffre ci-dessous n'est contractuel.** Les montants marqués « hypothèse »
proviennent de tarifs publics indicatifs ou de barèmes usuels, à re-confirmer par
le propriétaire (facturation) avant tout engagement. Les compteurs applicatifs
sont mesurés sur la base de test (Supabase local Docker) et sont proches de zéro :
ils ne préjugent pas du trafic de production.

## 1. Postes identifiés (preuves code/config)

| Poste | Preuve code | Ce que le code impose réellement | Compteur local mesuré |
|---|---|---|---|
| Supabase (base + Auth + PostgREST + Storage) | `.env.example` (URL/clés), `supabase/migrations/*` (223 tables), `supabase/config.toml` | Un seul projet Supabase ; PostGIS ; RLS ; Realtime non utilisé par l'IA | DB locale : 123 MB (dont `spatial_ref_sys` 7,1 MB — PostGIS) |
| Stockage objets | 5 buckets : `carnet-media`, `gear-photos`, `group-media` (publics), `message-attachments`, `user-documents` (privés) | Upload photos/documents ; egress à la lecture | `storage.objects` : **0** |
| Egress API/DB | routes `/api/terrain/conditions` (cache `public, max-age=60`), `/api/adventure/*`, exports GPX/RGPD | Payloads JSON/GeoJSON + exports ; l'offline pack télécharge des données | Non mesurable localement (pas de CDN) |
| Tuiles carto (hors-ligne) | `src/lib/offline/tiles.ts` (`tile.opentopomap.org`, max 400 tuiles/rando, ~15 KB/tuile estimé) ; `InteractiveMap.tsx` (OSM, ArcGIS World Imagery) ; `useOfflineDownload.ts` (`tile.openstreetmap.fr`, `MAX_TILES = 400`) | 4 fournisseurs communautaires **sans clé ni contrat** ; politique d'usage OSM ≠ usage commercial massif | ~6 MB max par randonnée téléchargée hors-ligne (400 × 15 KB) |
| IA (OpenRouter / Nemotron) | `src/lib/ai/providers/openrouter.ts` : `nvidia/nemotron-3-ultra-550b-a55b:free` (heavy), `nvidia/nemotron-3.5-lightning:free` (fast) ; quotas SQL `ai_usage_daily` : < 20 heavy/j et < 100 fast/j par utilisateur (`20260903000000_ai_foundations.sql:135-145`) | Modèles **gratuits** → coût token nul en l'état, mais quotas/rate-limits fournisseur et aucun SLA payant | `ai_usage_daily` : **0 ligne** (aucun appel IA en base de test) |
| Générations de plans | `generationLimits.ts` : 5/h (plan payant), `FREE_GENERATION_QUOTA_PER_HOUR = 2` | Coût de génération = appels LLM + cache `ai_response_cache` | `adventure_engine_runs` : 23 (historique local, dont skipped) |
| Stripe (entrées) | `src/lib/entitlements/server.ts` : 6 price IDs `STRIPE_PRICE_*` attendus ; `.env.local` de test n'en contient **aucun** | Monétisation non configurée dans l'environnement de test | Non applicable |
| Attribution / sortie | `docs/reports/A15_COSTS.md` (ce fichier) | Aucun moyen de paiement sortant branché | — |

## 2. Hypothèses de coût (à valider — jamais contractuelles)

| Poste | Hypothèse de barème | Formule / pilotage attendu |
|---|---|---|
| Supabase | Plan payant ≈ 25 USD/mois (tarif public indicatif) + dépassements compute/stockage/egress | `coût = forfait + max(0, stockage_GB − inclus) × prix_GB + max(0, egress_GB − inclus) × prix_GB` |
| Stockage médias | Facturé au GB stocké + egress de lecture | Sous-utilisé en test (0 objet) ; surveiller taille buckets et invalidation des images |
| Egress API | Inclus dans le plan puis facturé au GB | Instrumenter : octets sortants par route ; le cache 60 s de `/api/terrain/conditions` limite déjà les lectures répétées |
| Tuiles | Fournisseurs communautaires : 0 € mais **pas de contrat** et politique d'usage à respecter ; un fournisseur payant (clé) est probablement requis au-delà d'un usage modéré | Décision externe : fournisseur + clé + quota ; budget ≈ `tuiles servies × prix_mille_tuiles` |
| IA OpenRouter | Modèles `:free` → 0 USD/token ; quotas offerts sans engagement | Alerte budget à brancher côté OpenRouter ; basculer sur un modèle payant uniquement après décision produit |
| Frais Stripe | Hypothèse France carte EEE : ≈ 1,5 % + 0,25 € par transaction (barème public à confirmer) ; Billing éventuel en sus | `frais = volume_encaissé × 1,5 % + 0,25 € × nb_transactions` — **modèle mathématique simple, pas un devis** |

## 3. Ce que l'on peut déjà surveiller (interne, sans dépendance externe)

- `ai_usage_daily` (quotas par utilisateur/jour) : requête de contrôle
  `SELECT count(*), sum(requests_heavy), sum(requests_fast) FROM ai_usage_daily;`
- `adventure_engine_runs` (durées/statuts, cf. `docs/reports/A14_OBSERVABILITY.md`).
- Taille base + tables (`pg_total_relation_size`) et `storage.objects`
  (le healthcheck A14 mesure déjà la latence RPC et les files).

## 4. Dépendances EXTERNES bloquantes pour un budget réel

| Élément | Prérequis exact | Commande/contrôle qui échoue sans lui | Propriétaire | Impact lancement |
|---|---|---|---|---|
| Plan Supabase de production + quotas | Compte Supabase prod, projet, plan choisi, budget d'alerte | `supabase db push --db-url <PROD>` (non exécuté ici) ; facturation | Fondateur/ops | Sans plan/quotas, pas de go-live |
| Fournisseur de tuiles commercial + clé | Compte MapTiler/Stadia/équivalent + clé + conditions d'usage | `useOfflineDownload` utilise des serveurs communautaires sans clé : risque coupure/ToS au volume | Produit/tech | Bloque un lancement à trafic soutenu |
| Budget/quota OpenRouter | Compte OpenRouter, limite de dépense configurée | Appels `:free` : 429/quota sans engagement payant | Produit/tech | Dégradation gracieuse en attendant (fallback sans IA), pas de blocage dur |
| Price IDs Stripe | 6 variables `STRIPE_PRICE_*` + `STRIPE_SECRET_KEY` réels | `/api/billing/entitlements` renvoie `configured:false` (vérifié : absentes de `.env.local`) | Fondateur | Bloque la monétisation, pas le produit |
| Frais Stripe exacts | Contrat Stripe + relevé | Estimation ci-dessus | Fondateur | Non bloquant technique |

## 5. Conclusion

Aucun coût variable significatif n'est engagé dans l'environnement de test
(0 objet stocké, 0 appel IA, 0 transaction). Les seuls postes réellement
contractualisables sont le plan Supabase, un éventuel fournisseur de tuiles,
un budget IA et les frais Stripe : **tous externes, tous à chiffrer par le
propriétaire**. Les modèles IA gratuits actuels ne coûtent rien au token mais
n'offrent ni SLA ni quota garanti.
