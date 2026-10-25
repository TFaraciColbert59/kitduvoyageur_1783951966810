# Phase 1 — Sondes des parcours protégés (T03)

> Dernière exécution : 2026-10-11 (~12:26 UTC). Cible : production
> `https://kitduvoyageur-1783951966810-ruddy.vercel.app` + Supabase
> `icxyvwzfjbflcbqukpfz` (lecture seule via Management API).

## 1. Sondes HTTP (sans session)

| Route | Méthode | Résultat 2026-10-11 | Attendu |
|---|---|---|---|
| `/api/loyalty/spend` | POST | **401** | 401 — aucune écriture possible sans session vérifiée |
| `/api/loyalty/earn` | POST | **401** | 401 |
| `/api/loyalty/redeem` | POST | **401** | 401 |
| `/api/orders` | POST | **401** | 401 — prix/commande jamais côté client |
| `/api/orders/cancel` | POST | **401** | 401 |
| `/api/progression` | GET | **401** | 401 |

Reproduction :

```powershell
$base='https://kitduvoyageur-1783951966810-ruddy.vercel.app'
foreach ($r in @('/api/loyalty/spend','/api/loyalty/earn','/api/loyalty/redeem','/api/orders','/api/orders/cancel')) {
  try { Invoke-WebRequest -Uri ($base+$r) -Method POST -Body '{}' -ContentType 'application/json' -UseBasicParsing -TimeoutSec 30 | Out-Null }
  catch { "$r -> $($_.Exception.Response.StatusCode.value__)" }
}
```

## 2. Protections de base (I1, déjà prouvées — référence)

- Trigger de profil par colonne : `loyalty_points`, `loyalty_level`, `xp`, `level` inaccessibles en écriture client ; les autres colonnes du profil (nom, avatar…) restent modifiables normalement — contrôle positif couvert par `phase1_balance_lockdown.test.sql`.
- Écritures clientes révoquées sur `loyalty_history`, `loyalty_redemptions`, `orders` ; RPC legacy `legacy_loyalty_spend` refusée en anon/service avec erreurs métier propres (rapport incr1 §3).
- Suites : `supabase/tests/database/phase1_balance_lockdown.test.sql` (49/49), `tests/phase1/loyalty-validation.spec.ts`, `tests/phase1/checkout-pricing.spec.ts`, `tests/phase1/routes.spec.ts` (handlers : 401 sans session, 429 rate-limit, 409 métier, prix serveur).

## 3. Cas « virement non encaissé » (constat daté)

Relevé prod du 2026-10-11 :

| Commande | Paiement | Statut | Montant |
|---|---|---|---|
| KDV-2026-1530 | virement | confirmed | 460 € |
| KDV-2026-1687 | virement | confirmed | 159 € |
| KDV-2026-4557 | carte | confirmed | 219 € |

**Constat :** `confirmed` ne prouve pas l'encaissement — une commande par virement
peut être confirmée avant réception des fonds. Conséquence appliquée au
programme : **aucune émission de fidélité nouvelle (T38) ne pourra se fonder
sur `status = confirmed`** ; un état d'encaissement explicite doit être ajouté
et vérifié avant toute émission commerciale. Aucun crédit de fidélité en
attente n'est actuellement calculé sur ces lignes (`loyalty_points_earned`
n'est qu'un affichage historique ; l'émission future passe par le journal).

## 4. RLS et privilèges (lecture seule, 2026-10-11)

- `loyalty_history` : 16 lignes dont 10 ouvertures I1 — Σ journal = soldes profils (scan prod 0 écart).
- `orders` : RLS activée, insert client refusé (grant révoqué), colonne `loyalty_points_earned` non créditrice.
- Aucun nouveau chemin client de points : le scan d'anomalies (8 contrôles) est vert le 2026-10-11.
