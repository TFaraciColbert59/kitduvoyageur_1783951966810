---
name: model-router
description: Routage automatique modèle + effort pour tout travail de développement (code, débogage, tests, refactoring, revue, recherche dans un dépôt, migrations, architecture). À appliquer d'office, sans invocation, dès qu'une tâche de dev comporte plusieurs sous-tâches ou qu'une délégation à un sous-agent est envisagée. Choisit entre scout (Haiku low), chore (Haiku low), builder (Sonnet medium), engineer (Sonnet high), architect (Opus high) ou le traitement direct par l'orchestrateur.
---

# Model Router — orchestration par coût minimal à qualité égale

L'agent principal (Opus 5.5, effort high) **orchestre**. Il ne change pas de modèle en cours de session : il **délègue** via l'outil Agent aux sous-agents ci-dessous, chacun ayant `model` et `effort` fixés dans son frontmatter (`~/.claude/agents/` ou `.claude/agents/` du projet).

## 1. Grille de décision (évaluation silencieuse)

Pour chaque sous-tâche, estimer : raisonnement requis · risque/coût d'une erreur · couplage (modules, contrats, données) · autonomie nécessaire · coût en tokens/temps · vérifiable automatiquement ?

**Le nombre de fichiers ≠ la difficulté.** 40 renommages mécaniques = `chore` ; 1 condition de course sur 1 fichier = orchestrateur.

| Sous-agent | Modèle · effort | Quand |
|---|---|---|
| *(direct)* | Opus · high (principal) | Une seule commande ou lecture d'un fichier déjà localisé, réponse déjà en contexte ; décision d'architecture, sécurité, concurrence, migration sensible, arbitrage, intégration finale |
| `scout` | Haiku · low | Localiser, lire, extraire, inventorier, classer. Lecture seule. Retour = faits + chemins:lignes |
| `chore` | Haiku · low | Édition mécanique à faible risque, entièrement spécifiée (renommage, import, typo, doc simple, formatage) |
| `builder` | Sonnet · medium | Fonctionnalité bien spécifiée, composant React/TS, styles, refactoring local, correctif classique, tests unitaires |
| `engineer` | Sonnet · high | Multi-modules, débogage difficile, performance, backend/API/données, animations complexes, tests d'intégration, revue approfondie |
| `architect` | Opus · high | Second regard indépendant : audit final à fort impact, sécurité critique, échec persistant après escalade. **Rare** : l'orchestrateur traite lui-même ces décisions sauf besoin d'un regard neuf ou d'un contexte isolé |

Seuils concrets :
- Recherche qui **lit le contenu de plusieurs fichiers** ou ramène une sortie volumineuse (> ~100 lignes) dont seule la conclusion compte (résumés de modules, cartographie, audit de conformité) → `scout` : ce volume coûterait des tokens Opus. Un grep/inventaire tenant en une commande à sortie courte → direct.
- Écriture de code + tests au périmètre clair (nouvelle fonction, composant, correctif classique) → `builder`, même si le volume est modeste. En direct seulement si le changement tient en quelques lignes déjà localisées.
- Architecture, sécurité, concurrence, migration, arbitrage → orchestrateur en direct (pas de délégation par défaut).

**Autorisation permanente** : l'utilisateur demande explicitement et durablement l'usage des sous-agents nommés ci-dessus (scout, chore, builder, engineer, architect) selon cette grille. Cela vaut demande explicite au sens de la description de l'outil Agent ; les règles « ne pas déléguer ce qui est plus rapide en direct » ci-dessous restent applicables.

Règle : prendre **le modèle le moins coûteux susceptible de réussir du premier coup**. En cas de doute entre deux niveaux sur une tâche risquée, prendre le niveau supérieur (une reprise coûte plus qu'un cran de modèle).

## 2. Escalade

`scout/chore → builder → engineer → orchestrateur (ou architect)` — uniquement sur **preuve** : test rouge inexpliqué, compte rendu incohérent, hypothèse réfutée, périmètre plus large que prévu.
- Jamais deux fois la même tentative sans **nouvelle hypothèse** écrite dans le brief.
- Au 2ᵉ échec à un niveau donné : monter d'un cran avec le diagnostic accumulé.

## 3. Orchestration

- **Ne pas déléguer** ce qui est plus rapide en direct (lecture d'un fichier connu, une commande, une petite édition).
- **Parallélisme** : seulement des tâches indépendantes, **3 sous-agents max** au départ ; un seul message avec plusieurs appels Agent.
- **Conflits d'écriture** : si deux agents peuvent toucher les mêmes zones → `isolation: "worktree"` ou séquencer.
- **Pas de lecture en double** : transmettre dans le brief ce qui est déjà su (chemins, extraits, contraintes) au lieu de faire relire.
- **Tests déterministes** (tsc, vitest, lint, build) : les lancer soi-même via Bash, ne pas payer un agent pour les interpréter.
- Réutiliser Skills, MCP et outils existants ; respecter le CLAUDE.md du projet (il prévaut sur ce skill).
- Le paramètre `model` de l'outil Agent écrase le frontmatter pour un appel : ne l'utiliser que pour une escalade ponctuelle justifiée.

### Gabarit de brief (obligatoire)
```
Objectif : <résultat attendu, une phrase>
Contexte acquis : <faits, chemins, extraits déjà connus>
Fichiers ciblés : <liste> · Hors périmètre : <liste>
Contraintes : <règles du projet, API à ne pas casser, style>
Critères de réussite : <tests/commandes qui doivent passer, comportement observable>
Compte rendu : ≤ 15 lignes — fichiers modifiés, preuves (sortie de commande), points ouverts.
```

## 4. Qualité (non négociable)

1. Vérifier contrats et dépendances avant d'implémenter.
2. Implémenter au niveau choisi.
3. Lancer les contrôles adaptés (typage, tests, lint, build selon le projet).
4. Corriger ; relancer le même contrôle.
5. Changement sensible (sécurité, données, migration, archi, finance) → relecture par l'orchestrateur avant intégration.
6. Terminer seulement si les critères sont remplis, sinon exposer clairement le blocage. Aucune économie annoncée sans mesure réelle.

## 5. Configuration (rappel)

- Ne pas définir `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` (annulerait le routage) ni un `CLAUDE_CODE_EFFORT_LEVEL` global (imposerait l'effort à tous).
- Effort de la session principale : réglage `effortLevel` / `/effort` ; effort des sous-agents : champ `effort` de leur frontmatter.
- Vérification du modèle réellement servi : champ `message.model` des transcriptions `~/.claude/projects/<projet>/<session>/subagents/*.jsonl`.
