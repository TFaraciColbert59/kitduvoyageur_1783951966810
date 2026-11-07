---
name: smart-model-router
description: Routeur de modèles et d'effort à coût minimal. La session principale (Opus 5.5, effort high) orchestre et confie chaque sous-tâche à l'agent le moins coûteux capable de la réussir (scout, chore, builder, engineer, architect), avec le bon modèle et le bon effort. À appliquer dès qu'une demande implique de chercher, lire, modifier, tester, relire ou décomposer du travail.
when_to_use: Toute tâche de développement ou de recherche dans le dépôt - "implémente", "corrige", "trouve où", "audite", "teste", "refactore", "migre", "documente", "fix", "debug".
user-invocable: true
---

# Smart Model Router — Haiku d'abord, Sonnet si besoin, Opus seulement si nécessaire

Tu es l'orchestrateur (Opus 5.5 · high). Tu ne peux pas changer ton propre modèle : le **seul levier** est la délégation via l'outil `Agent`. Tony demande explicitement et durablement cette délégation (CLAUDE.md §1.9) : elle n'est pas « non demandée ».

Principe : **l'agent le moins cher avec l'effort le plus bas qui réussit du premier coup.** Économiser ne justifie jamais un résultat faux.

## 1. Table de routage (agents du projet, `.claude/agents/`)

| Niveau | Appel `Agent` | Modèle · effort | Pour |
|---|---|---|---|
| 1 | `scout` | Haiku · low | Localiser, lire, extraire, inventorier, classer, résumer (lecture seule) |
| 1 | `chore` | Haiku · low | Édition mécanique entièrement spécifiée (renommage, import, typo, doc, formatage) |
| 2 | `scout` / `chore` + `effort: "medium"` | Haiku · medium | Même périmètre, mais tri ou synthèse en plusieurs étapes |
| 3 | `builder` | Sonnet · medium | Code au périmètre clair (1–2 modules), composant, correctif classique, tests unitaires |
| 4 | `engineer` | Sonnet · high | Multi-modules, débogage dur, perf, backend/données, revue de diff approfondie |
| 5 | toi | Opus · high | Architecture, sécurité, RLS, migration, argent, concurrence, intégration finale |
| 6 | `architect` | Opus · high (`max` seulement après échec à high) | Second avis indépendant, rare |

Cible indicative : ~80 % du travail délégué en Haiku, ~18 % en Sonnet, ~2 % en Opus hors orchestration.

**Pièges coûteux à éviter**
- `general-purpose`, `claude` et `Plan` **héritent d'Opus** : ne les appelle jamais sans `model: "haiku"` ou `"sonnet"`. Préfère `scout` à `Explore`.
- Les agents personas (`linus-torvalds`, `kent-beck`…) et `pays-*` sont réglés sur Sonnet · medium. Ne les remonte pas en Opus.
- Un passage `model` à l'appel prime sur la définition de l'agent : ne passe `model: "opus"` que pour le niveau 6.

## 2. Moi ou un agent ?

Décide avant le premier appel d'outil.

**Fais-le toi-même** seulement si : ≤ 3 appels d'outils, ou la réponse est déjà dans ton contexte ; décision du niveau 5 ; contrôle déterministe existant (`tsc`, `vitest`, lint, build : lance-le en Bash, ne paie pas un agent pour le lire).

**Délègue** dès que le travail est **grand devant le brief** : lire plusieurs fichiers ou > ~100 lignes → `scout` ; écrire du code spécifié → `builder` ; etc. Mesure du 03/11 (`docs/claude/MODEL-ROUTER-VALIDATION.md`) : sur une petite tâche, brief + relecture coûtent plus que l'économie. Ne délègue pas une tâche de 2 minutes.

**Garde-fou** : si tu as choisi « moi » et dépasses 3 appels, ou si ton approche échoue, re-route la suite vers l'agent adapté avec ce que tu as appris.

## 3. Économie de tokens (le coût, c'est surtout l'orchestrateur)

1. Brief **court et autonome** : l'agent part à froid, ne lui envoie pas l'historique, seulement ce qu'il faut.
2. Donne chemins et lignes connus ; interdis la relecture large (« lis seulement X:120-180 »).
3. Exige un compte rendu court (≤ 15 lignes, chemins:lignes, résultats de tests) ; ne relis pas ce qu'un agent a prouvé, sauf changement sensible.
4. Parallélise seulement l'indépendant : 3 agents maximum dans un même message ; `isolation: "worktree"` si des zones se recoupent.
5. Jamais la même tâche à plusieurs modèles. Jamais de nouvelle tentative sans nouvelle hypothèse.
6. Côté orchestrateur : réponses brèves, pas d'explication de routage à l'utilisateur, pas de régénération d'information déjà obtenue.

### Brief type
```
Objectif : <résultat attendu, une phrase>
Fichiers : <chemins:lignes>
Contexte : <contrats, décisions prises, déjà vérifié>
Contraintes : <ne pas toucher X ; pas de commit/push sauf mention>
Réussite : <commandes qui doivent passer, comportement attendu>
Compte rendu : ≤ 15 lignes — fichiers modifiés, preuves, doutes.
```

## 4. Escalade progressive, sur preuve seulement

`scout`/`chore` low → même agent `effort: "medium"` → `builder` → `engineer` → toi → `architect`.

- Déclencheurs : test rouge inexpliqué, résultat faux ou incohérent, contrainte oubliée, agent qui signale dépasser son niveau. **La longueur d'une tâche n'est pas un déclencheur.**
- Avant d'escalader, essaie moins cher : brief plus précis, sous-tâches plus petites, meilleur contexte.
- Transmets au niveau suivant l'échec constaté et ce qui a été essayé.
- Décompose : les parties simples d'une tâche complexe restent en Haiku/Sonnet, seule la partie dure monte.

## 5. Qualité et honnêteté

- Après délégation : lance toi-même les contrôles (`npx tsc --noEmit -p .`, `npx vitest run <périmètre>`), relis le diff réel des changements sensibles.
- Le modèle réellement servi se lit dans `/tasks` ou dans les transcripts de sous-agents (`message.model`). Si l'organisation substitue un modèle, signale-le.
- N'annonce aucune économie chiffrée sans mesure (coût lu dans les rapports d'exécution).
