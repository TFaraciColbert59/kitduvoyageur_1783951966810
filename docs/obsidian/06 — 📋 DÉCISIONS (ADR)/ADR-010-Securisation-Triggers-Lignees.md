---
title: ADR-010b — Sécurisation Triggers Lignées & Écoute Sélective
aliases:
  - ADR-010b
tags:
  - adr
  - triggers
  - bdd
  - postgresql
  - performance
date: 2026-09-04
status: Accepté
---

# ADR-010b — Sécurisation Triggers Lignées & Écoute Sélective

### Contexte
Le trigger `trg_prevent_lineage_cycle` protégeant l'arbre généalogique des kits contre les boucles récursives s'exécutait sur toute opération `UPDATE` sur la table `kits`.
Or, 98% des mises à jour sur `kits` concernent des attributs annexes (nom, description, visibilité publique, horodatage de synchronisation), pour lesquels la structure de parenté n'est nullement modifiée.

### Décision
Restreindre formellement l'événement de déclenchement du trigger à la clause :
```sql
CREATE TRIGGER trg_prevent_lineage_cycle
BEFORE UPDATE OF forked_from ON kits
FOR EACH ROW EXECUTE FUNCTION check_lineage_cycle();
```
Le parcours récursif de vérification de boucle n'est désormais invoqué **que** si la colonne `forked_from` est explicitement mutée.

### Conséquences
- **Positives :**
  - Réduction drastique de l'overhead CPU sur les mutations fréquentes de kits.
  - Élimination des verrous de concurrence inutiles lors des éditions en ligne.
- **Négatives :**
  - Aucune : l'invariance anti-cycle demeure rigoureusement étanche.

### Liens & Références
- [[02 — 🎒 MATÉRIEL & KITS/Architecture Lignées|Architecture des Lignées de Kits]]
- [[04 — 🏗️ ARCHITECTURE & BACKEND/BDD & Schéma|BDD & Schéma Supabase]]