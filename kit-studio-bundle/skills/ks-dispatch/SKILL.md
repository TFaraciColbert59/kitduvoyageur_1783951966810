---
name: ks-dispatch
description: Use when the coordinator must delegate a Kit Studio task — chooses the sub-agent (Haiku/Sonnet/Opus), effort, brief template and escalation, to minimise credits.
---
# Déléguer au bon modèle, au bon prix

1. Lire la tâche dans `plan/backlog.json` : le champ `agent` fixe le profil. Ne pas le changer sans échec prouvé.
2. Brief (≤ 40 lignes) :
```
Tâche <id> — <titre>      Agent: <profil>   Plafond: <n> tours
Lire (plages): <fichier:lignes>, …
Écrire: <fichiers>
Acceptation: <critère mesurable>
Test: <commande exacte>
Interdits: compas/**, couleurs littérales, innerHTML, commit
Rends: fait / preuve / reste / risque (≤150 mots)
```
3. Lancer en parallèle toutes les tâches de la même vague, en un seul message ; worktree séparé si les fichiers se recoupent.
4. Vérifier par la preuve (sortie du test, capture), pas en relisant le code.
5. Échec → une marche au-dessus (Haiku → Sonnet → Opus), brief enrichi de la preuve de l'échec. Deux échecs Sonnet → `ks-reviewer` en débogage.
6. Écrire la ligne du grand livre : `id | modèle·effort | tours | résultat | preuve`.
7. Ne jamais relancer un agent pour « vérifier » le travail d'un autre : un seul passage Opus par lot (T22).
