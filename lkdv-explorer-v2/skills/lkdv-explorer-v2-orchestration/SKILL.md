---
name: lkdv-explorer-v2-orchestration
description: Use at the start of every session of the Explorer v2 chantier, after any context loss, and before marking any checklist item done. Defines the autonomous loop, proof rules and decision protocol.
---
# Orchestration du chantier Explorer v2

1. Relis `handoff/explorer-v2/00_MISSION.md`, puis `07_CHECKLIST.md`, puis les 30 dernières entrées de `docs/explorer-v2/MISSION_LOG.md`.
2. Prends le premier point non coché de la phase en cours. Jamais deux points à la fois.
3. Cherche l’existant (`rg`, `01_AUDIT.md`) avant d’écrire.
4. Implémente → prouve par commande réelle → consigne la sortie → coche → commit atomique.
5. Fin de phase : gate de `06_PHASES.md`.
6. Question sans réponse dans les docs : protocole `00_MISSION.md §6`, une ligne `DECISIONS.md`, et tu continues.
7. Blocage : contournement `00_MISSION.md §9`, une ligne `BLOCAGES.md`, et tu continues.
8. Interdits : projet `lwrmuggefbmboikjgudc`, dossiers Compas, `#E4501C`, données inventées, dépense, secret côté client, appel SOS réel.
9. Tu ne dis jamais « terminé » : seule la sortie 0 de `npm run explorer:verify` et 100 % de cases cochées le disent.
