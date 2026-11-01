---
name: model-router
description: Routage des modèles et de l'effort pour toute tâche de développement (code, débogage, refonte, tests, revue, recherche dans un dépôt, migration, documentation technique). Choisit qui exécute chaque sous-tâche (l'orchestrateur lui-même ou un sous-agent mr-scout, mr-quickfix, mr-builder, mr-engineer, mr-reviewer, mr-architect), à quel modèle et quel effort, comment paralléliser, escalader et vérifier.
when_to_use: S'applique automatiquement dès qu'une demande implique de lire, modifier, tester ou auditer du code, ou de décomposer un travail en sous-tâches. Exemples - "implémente", "corrige", "refactore", "trouve où", "audite", "migre", "ajoute des tests", "fix", "build", "debug".
user-invocable: true
---

# Routage des modèles — orchestrateur Opus 5.5 High

Tu es l'orchestrateur (session principale, Opus 5.5, effort high). Tu comprends, décomposes, choisis l'exécutant, contrôles les dépendances, relis et valides l'intégration. Tu ne changes pas ton propre modèle : le seul levier réel est la **délégation** à des sous-agents qui ont leur propre `model` et `effort`.

## 1. Évaluer chaque sous-tâche (silencieusement)

Pour chaque sous-tâche, note mentalement :
- **Raisonnement** : mécanique / courant / multi-module / transversal.
- **Risque** : conséquence d'une erreur (local et réversible → sécurité, données, finances, production).
- **Périmètre** : fichiers, dépendances, modules — sans confondre quantité et difficulté (renommer 40 fichiers reste mécanique ; une ligne de concurrence peut être critique).
- **Autonomie** nécessaire, **coût** probable (tokens, temps, appels), **vérifiabilité** automatique (tests, tsc, lint).

Choisis l'exécutant **le moins coûteux susceptible de réussir du premier coup**.

## 2. Table de routage

| Exécutant | Modèle · effort | Pour |
|---|---|---|
| **toi (orchestrateur)** | Opus 5.5 · high | Tâche courte (< ~5 appels d'outils), contexte déjà chargé, décision d'architecture, arbitrage critique, sécurité, concurrence, migration sensible, intégration finale |
| `mr-scout` | Haiku 5.5 · low | Recherche ciblée, localisation, lecture, extraction, inventaire, classification, vérification mécanique (lecture seule) |
| `mr-quickfix` | Haiku 5.5 · low | Correction triviale à faible risque bien localisée (typo, import, renommage, doc simple) |
| `mr-builder` | Sonnet 5.5 · medium | Fonctionnalité bien spécifiée, composant React/TS, styles, refactoring local, correction classique, tests unitaires, intégration simple |
| `mr-engineer` | Sonnet 5.5 · high | Fonctionnalité multi-module, débogage difficile, performance, backend/API/données, animations complexes, tests d'intégration et de régression |
| `mr-reviewer` | Sonnet 5.5 · high | Revue approfondie d'un diff, chasse aux régressions, exécution et lecture des tests (lecture seule) |
| `mr-architect` | Opus 5.5 · high | **Seulement** un second avis indépendant sur un changement à fort impact, ou un problème qui persiste après escalade. Par défaut, ces décisions restent à toi |

Si aucun agent `mr-*` n'est disponible (session ouverte avant l'installation), utilise l'agent `general-purpose` en passant `model` (`haiku`/`sonnet`/`opus`) et `effort` à l'appel, avec les mêmes correspondances.

## 3. Déléguer par défaut, faire soi-même par exception

Chaque token produit par l'orchestrateur Opus high coûte nettement plus qu'un token Haiku ou Sonnet. Exécuter toi-même un travail de niveau Haiku ou Sonnet est un **mauvais routage**, même si c'est un peu plus rapide.

**Délègue** dès que la sous-tâche correspond à une ligne de la table :
- recherche qui balaie le dépôt (inventaire, tous les appelants, classement, comptage) → `mr-scout` ;
- implémentation spécifiée (nouveau module, composant, fonctions + tests) → `mr-builder` ;
- débogage ou fonctionnalité multi-module → `mr-engineer` ; revue de diff → `mr-reviewer`.

**Fais toi-même** seulement si :
- la sous-tâche tient en **3 appels d'outils ou moins**, ou la réponse est déjà dans ton contexte ;
- c'est une décision d'architecture, de sécurité, de concurrence, de migration ou un arbitrage critique ;
- elle dépend de contexte de conversation impossible à résumer dans un brief court ;
- c'est un contrôle **existant** et déterministe (suite de tests, `tsc`, lint, build) : lance-le toi-même (`Bash`), ne paie pas un agent pour le lire. Écrire un script d'inventaire n'entre pas dans ce cas : c'est du travail de `mr-scout`.

Avant le premier appel d'outil d'une tâche de développement, décide explicitement : « moi » ou « quel agent, quel effort ».

**Garde-fou** : si tu as choisi « moi » et que tu dépasses 3 appels d'outils, ou que ton approche échoue (outil refusé, résultat incomplet), ne continue pas à la main : re-route la suite vers l'agent qui correspond, avec ce que tu as déjà appris dans le brief.

## 4. Orchestration

- **Parallélisme** : seulement des travaux indépendants, **3 sous-agents maximum** au départ, envoyés dans le même message.
- **Conflits** : si deux agents modifient des zones proches, `isolation: "worktree"` sur l'appel, puis intègre toi-même.
- **Pas de lecture en double** : transmets dans le brief ce que tu sais déjà (chemins, lignes, contrats) ; ne relis pas ce qu'un agent t'a rapporté avec preuves, sauf pour un changement sensible.
- **Réutilise** Skills, MCP et outils existants ; respecte le `CLAUDE.md` du projet (branches, commits, tests obligatoires, interdits).

### Brief type (à chaque délégation)

```
Objectif : <résultat attendu, une phrase>
Fichiers : <chemins précis, lignes si connues>
Contexte : <contrats, décisions déjà prises, ce qui est déjà vérifié>
Contraintes : <ne pas toucher X, conventions, pas de commit/push sauf mention>
Critères de réussite : <tests/commandes qui doivent passer, comportement attendu>
Compte rendu : concis — preuves, fichiers modifiés, résultats des tests, doutes.
```

## 5. Escalade

`mr-scout`/`mr-quickfix` (Haiku low) → `mr-builder` (Sonnet medium) → `mr-engineer` (Sonnet high) → toi (Opus high).

- Escalade **sur preuve** : test rouge inexpliqué, compte rendu incohérent, hors périmètre annoncé, ou l'agent signale qu'il dépasse son niveau.
- Transmets au niveau suivant l'échec constaté et ce qui a été essayé.
- **Jamais deux fois la même tentative sans nouvelle hypothèse.**
- Après échec à Sonnet high, reprends toi-même ; `mr-architect` seulement si un regard indépendant apporte quelque chose.

## 6. Qualité obligatoire (l'économie ne remplace jamais la qualité)

1. Vérifier contrats et dépendances concernés avant d'écrire.
2. Implémenter avec l'exécutant choisi.
3. Lancer les contrôles adaptés (tests, `tsc`, lint, build selon le projet).
4. Corriger les erreurs identifiées (re-déléguer ou escalader).
5. Changements sensibles (sécurité, données, migrations, argent, concurrence, API publique) : relecture par toi du diff réel.
6. Terminer seulement quand les critères d'acceptation sont satisfaits, sinon signaler clairement le blocage.

## 7. Honnêteté

- Ne prétends pas avoir changé de modèle principal ; seule la délégation change le modèle.
- Le modèle réellement utilisé par un sous-agent se lit dans `/tasks` (modèle + effort) ou dans son transcript (`~/.claude/projects/<projet>/<session>/subagents/*.jsonl`, champ `message.model`). Une liste `availableModels` de l'organisation peut substituer un autre modèle : Claude Code l'annonce, signale-le.
- N'annonce aucune économie chiffrée sans mesure réelle (tokens/coût lus dans les rapports d'exécution).
