---
title: ADR-009 — Commission de lignée 70/20/10, crédit boutique, conditionnée au terrain
aliases:
  - ADR-009
tags:
  - adr
  - kits
  - lignees
  - economie
  - commission
date: 2026-09-03
status: Proposé
---

# ADR-009 — COMMISSION DE LIGNÉE (70/20/10, 3 GÉNÉRATIONS, CRÉDIT BOUTIQUE)

### Contexte

LKDV veut rémunérer la **valeur de l'adaptation** : un forkeur améliore un kit (allège,
remplace des items, transpose à un massif) ; ses descendants achètent des produits issus
de ce kit. La commission doit :
1. Récompenser le travail d'adaptation (le forkeur), pas la simple duplication (auto-fork).
2. Ne jamais récompenser ni l'acheteur ni des arbres de duplication vides
   (anti fork-spam) → **condition de preuve terrain** dans la descendance.
3. Rester **transparente** (conflit d'intérêt réel : un créateur rémunéré à la commande
   est incité à charger son kit — obligation commerciale de divulgation).
4. Être indépendante du prix (aucun terme monétaire dans les scores de confiance).

**Constat d'audit structurant (Lot 0, §1.10)** : le système de rémunération existant
(`reward_accounts`, `reward_withdrawals`) verse en **virement bancaire** (`bank_transfer`)
et ne connaît **aucun « crédit boutique »**. Le plan initial (Lot 6.5) supposait
`/fidelite + /recompenses` capables de porter un crédit consommable — cette hypothèse est
**fausse**. Le versement du chantier s'appuiera donc sur une **extension du reward engine**
(voir Décision).

### Décision

**Barème** — répartition le long de l'ascendance, décroissante, **3 générations max** :
- 70 % au forkeur (génération 0 = celui qui a adapté, parent du kit acheté),
- 20 % au parent (génération 1),
- 10 % au grand-parent (génération 2),
- extinction au-delà.

**Paramétrage en base** — table `royalty_config` (taux global en `bps`, poids par
génération) modifiable sans migration. Plancher : aucune part < 1 centime n'est créée.

**Condition d'activation** — aucune royalité sur une lignée **sans preuve terrain** dans
la descendance (au moins 1 session `hike_sessions` avec `distance_km ≥ 1` rattachée à la
lignée). Un arbre de duplications vide ne rapporte rien.

**Modèle de données** — `kit_attributions` (une par `order_item`, `UNIQUE(order_item_id)`
pour l'idempotence webhook) + `kit_royalty_shares` (une par bénéficiaire × génération,
lecture RLS propre au bénéficiaire, écriture **service_role uniquement**).

**Versement en crédit boutique** — extension du reward engine : ajout d'un mode
« store credit » aux `reward_accounts` (ou table dédiée) permettant de **consommer le
crédit sur les commandes** plutôt que de le retirer en virement. Décision d'implémentation
du Lot 6, à valider avec Tony. Le cycle de vie : `pending → confirmed` après le délai légal
de rétractation de 14 jours et absence de retour ; `reversed` sur retour/remboursement ;
`paid` au crédit boutique.

**Anti-fraude** — auto-forks exclus de la filiation (`origin='manuel'`,
`forked_from=NULL`), l'acheteur est exclu de la répartition (on ne se paie pas sur son
propre achat), attribution posée uniquement depuis **metadata Stripe vérifiées**
(cookie `lkdv_kit_ref` signé HMAC-SHA256, secret serveur `KIT_REF_SECRET`).

### Alternatives écartées

1. **Commission en euros / virement via reward_withdrawals** — réouverture de la question
   du statut fiscal du créateur particulier, factures, seuils déclaratifs (hors périmètre
   du chantier ; le crédit boutique évite tout cela dès le premier jour).
2. **Taux unique à plat** — ne récompenserait pas la chaîne d'adaptation ; le 70/20/10
   décroissant matérialise l'ordre de la dette créative.
3. **Commission sans condition terrain** — ouvrirait la porte au fork-spam (le forkeur
   n'a rien prouvé) ; la condition terrain est la parade économique.

### Conséquences

**Positives :**
- Aligne l'incitation sur la valeur (adaptation + usage terrain), pas sur le volume.
- Conforme aux règles du projet : vérité financière côté serveur, idempotence,
  traçabilité (modèle hérité du reward engine).
- Transparence obligatoire affichée dans le `KitSheet` (mention de la part créateur).

**Négatives :**
- Complexité webhook accrue : attribution + parts + rejeu idempotent + reversals.
- Dépend du tuyau Stripe réparé (Lot 3) : sans `order_items` propres, aucune attribution
  n'est possible — **le Lot 6 est strictement bloqué par les Lots 1, 3 et 4**.
- Nécessite l'extension « store credit » du reward engine (décision à trancher).

### Références

- Audit des lignées de kits (Lot 0) — `docs/reports/AUDIT_KITS_LIGNEE.md` §1.10, §2, §3
- ADR-007 (entité vivante), ADR-008 (filiation matérialisée)
- Principes du reward engine — `docs/reports/REWARD_ENGINE_STATE.md` §1 (invariants)