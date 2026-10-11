# Droits commerciaux et coûts (T37)

Relevé `scripts/audit/economic_entitlements_scan.mjs` du 2026-10-11T18:06Z (production, lecture seule) :

| Famille | Unité | Journal | Écart | Constat |
|---|---|---|---|---|
| Fidélité historique | crédits | `loyalty_history` (16 lignes) | **0** | 10 comptes porteurs ; ouvertures I1 conservées |
| Parts de contribution | points économiques | `reward_transactions` (18 lignes à effet de solde) | **0** | 111 comptes ; aucun nouveau crédit like/message à ouvrir |
| Crédit boutique de lignée | centimes | `store_credit_ledger` (0 ligne) | **0** | aucun droit historique existant ; circuit royalties en place |

- **Aucune conversion** entre familles ni vers les XP ; les journaux restent séparés.
- **Mapping de continuité** : les anciens droits restent lisibles dans leurs journaux ; aucune dévaluation rétroactive ; la vue Mes avantages (T41) les réunit sans les fusionner.
- **Portes fermées (motifs exacts)** :
  - bons futurs (1 000/2 €, 2 500/5 €, 5 000/10 €) : exigent marge contributive vérifiée et réserve financée — non fournies ;
  - pool de contribution (15 % / 5 000 mois / 50 000 an configurés) : **aucun financement prouvé** → distribution fermée (`funded_pool`) ;
  - émission de parts pour like/message : fermée ; les droits historiques légitimes restent intacts.
