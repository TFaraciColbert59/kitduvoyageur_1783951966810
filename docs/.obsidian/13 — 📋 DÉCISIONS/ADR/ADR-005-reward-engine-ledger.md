---
title: ADR-005 — Grand Livre Immuable pour le Reward Engine
aliases:
  - ADR-005
tags:
  - adr
  - rewards
  - ledger
date: 2026-08-16
status: Accepté
---

# ADR-005 — GRAND LIVRE IMMUABLE POUR LE REWARD ENGINE

### Contexte
La rémunération des créateurs de carnets et le parrainage nécessitent une traçabilité financière inattaquable et une protection totale contre les faux likes et les doubles réclamations.

### Décision
Adopter un modèle de comptabilité en partie double avec un registre de transactions (`reward_transactions`) en append-only strict (interdiction SQL des `UPDATE` et `DELETE`), protégé par RLS et des triggers anti-auto-like.

### Conséquences
- **Positives :** Auditabilité parfaite, zéro risque de corruption de solde, équilibre financier garanti par le pool mensuel de 30% des marges.
