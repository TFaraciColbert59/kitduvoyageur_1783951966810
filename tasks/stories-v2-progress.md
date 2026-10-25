# Stories V2 — pilotage d'exécution

> Chantier : parité fonctionnelle/gestuelle Stories.
> **Canaux :** GitHub MCP + Supabase MCP. Branche UX : `feat/stories-v2-ux` (depuis `main` post-merge #96).

## Vague UX (2026-10-14) — re-audit + upgrade

Re-audit complet post-merge : code (CI 100 % verte), base (matrice 16/16), objets Storage, logs, intégration desktop+mobile, historique `main` — tout sain. Améliorations livrées :

- [x] **Rail** : squelettes de chargement, erreur explicite + « Réessayer », en-tête « Stories · N » — la panne n'est plus silencieuse.
- [x] **Viewer** : double tape = j'aime (cœur 700 ms), dock de réponse DM, saisie = pause, clavier ignoré en frappe, légende/son décalés.
- [x] **Réponses DM** : `src/lib/stories/reply.ts` (conversation directe RPC + message avec metadata `story_reply`), `reply_policy` propagée (`off` masqué, `followers` vérifié via batch), alertes succès/échec.
- [x] Correctif clavier : Espace/flèches ignorés quand un champ est actif.

Commits : helper reply + viewer + barre. Vérification : CI de la PR (type-check, lint, vitest, build, invariants, icônes, pgTAP).

## Backlog P2 restant

Stickers interactifs (sondage/quiz/questions/curseur/décompte), mentions/liens, actions kit/parcours, partage/deep link, recadrage 9:16, pagination curseur, reprise « première non vue », commentaires publics.

## Gates opérateur (inchangés)

Smoke mobile (dont : réponse DM, double tape, dock, états chargement/erreur), merge, activation cohortes, appareils réels.
