---
title: Système — Reward Engine & Grand Livre Financier
aliases:
  - Récompenses
  - Reward Engine
  - Ledger
tags:
  - system
  - rewards
  - ledger
  - monetization
updated: 2026-08-17
status: 🟢 Fonctionnel (Phase 1)
---

# 💰 SYSTÈME — REWARD ENGINE & GRAND LIVRE FINANCIER

> [!abstract] **Le moteur d'économie créateur éthique de LKDV**
> Le Reward Engine récompense financièrement les auteurs de carnets, les testeurs d'équipement et les parrains. Il repose sur un registre de transactions immuable en base de données et des garde-fous anti-fraude stricts.

---

## 🔒 Principes d'Intégrité Financière

1. **Grand Livre Immuable (Ledger) :** Toute variation de solde est enregistrée dans `reward_transactions` avec un `idempotency_key` unique. Aucune ligne de transaction ne peut être mise à jour (`UPDATE`) ou supprimée (`DELETE`).
2. **Garde-fous Anti-Fraude :**
   - Blocage de l'auto-like : Un utilisateur ne peut pas gagner de points en aimant ses propres publications.
   - Plafond quotidien de gains sur engagement social (max 500 points/jour).
   - Détection de boucles de commentaires et comptes dormants.
3. **Phase de Déploiement :**
   - **Phase 1 (Active) :** Mode observation, cumul de points et simulation dans `/admin/rewards`.
   - **Phase 2 (Prévue) :** Retraits bancaires effectifs via Stripe Connect après validation KYC.

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir le tunnel de paiement : [[Paiements]]
> - Explorer la matrice de sécurité : [[Permissions]]
