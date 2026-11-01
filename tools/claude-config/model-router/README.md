# Routage des modèles Claude Code (`model-router`)

Configuration **utilisateur** (globale, tous projets) qui fait de la session principale un orchestrateur Opus 5.5 / effort high et délègue chaque sous-tâche au sous-agent le moins coûteux capable de réussir du premier coup. Aucun code applicatif n'est concerné : ce dossier est la source versionnée, `install.mjs` l'installe dans `~/.claude`.

## Contenu

| Fichier source | Installé dans | Rôle |
|---|---|---|
| `skills/model-router/SKILL.md` | `~/.claude/skills/model-router/` | Grille d'évaluation, table de routage, délégation par défaut, escalade, qualité |
| `agents/mr-scout.md` | `~/.claude/agents/` | Haiku 5.5 · low · lecture seule — recherche, inventaire, classification |
| `agents/mr-quickfix.md` | `~/.claude/agents/` | Haiku 5.5 · low — correction triviale localisée |
| `agents/mr-builder.md` | `~/.claude/agents/` | Sonnet 5.5 · medium — implémentation spécifiée, tests unitaires |
| `agents/mr-engineer.md` | `~/.claude/agents/` | Sonnet 5.5 · high — multi-module, débogage, perf, intégration |
| `agents/mr-reviewer.md` | `~/.claude/agents/` | Sonnet 5.5 · high · lecture seule — revue, régressions |
| `agents/mr-architect.md` | `~/.claude/agents/` | Opus 5.5 · high · lecture seule — second avis seulement |
| `CLAUDE.snippet.md` | bloc balisé dans `~/.claude/CLAUDE.md` | Applique le Skill sans invocation manuelle |
| — | `~/.claude/settings.json` | `model: claude-opus-5-5` (si absent) + `modelSettings.claude-opus-5-5.effortLevel: high` |

## Installer

```bash
node tools/claude-config/model-router/install.mjs            # installe / met à jour (idempotent)
node tools/claude-config/model-router/install.mjs --check    # code 1 si l'installation n'est pas à jour
node tools/claude-config/model-router/install.mjs --dry-run  # montre sans écrire
```

Fonctionne sous Windows, macOS et Linux (`CLAUDE_CONFIG_DIR` respecté). Préserve tout le reste : autres agents et Skills, hooks, permissions, `env`, et le contenu existant de `CLAUDE.md` (seul le bloc `<!-- model-router:start/end -->` est remplacé). Toute version remplacée est sauvegardée dans `~/.claude/backups/model-router/<date>/`. Si `~/.claude/agents` n'existait pas au lancement de la session, redémarrer Claude Code.

### Sessions cloud (claude.ai/code)

`~/.claude` n'y persiste pas : le conteneur est recréé. Coller `setup-cloud.sh` (autonome, fichiers embarqués) dans **Environnement → Modifier → Setup script**. Après modification d'un fichier source, régénérer :

```bash
node tools/claude-config/model-router/install.mjs --emit-setup-script > tools/claude-config/model-router/setup-cloud.sh
```

## Choix de configuration (vérifiés dans la documentation Claude Code 2.1.316)

- **Effort de l'orchestrateur** : `modelSettings["claude-opus-5-5"].effortLevel = "high"`. Opus 5.5 démarre à `medium` sinon, et un `effortLevel` de premier niveau dans les réglages utilisateur ne s'applique pas à Opus 5.5.
- **Pas de `CLAUDE_CODE_EFFORT_LEVEL`** : il écraserait l'`effort` de chaque sous-agent. **Pas de `CLAUDE_CODE_SUBAGENT_MODEL(_FORCE)`** : il écraserait leur `model`. `install.mjs` signale ces variables si elles sont présentes.
- **Alias `haiku` / `sonnet` / `opus`** dans les agents plutôt que des identifiants complets : si une liste `availableModels` d'organisation bloque une version, Claude Code substitue la plus récente autorisée de la même famille (un identifiant complet bloqué retomberait sur le modèle principal). Sur l'API Anthropic, ces alias pointent vers Haiku 5.5, Sonnet 5.5 et Opus 5.5 ; sur Bedrock, Vertex ou Foundry, ils pointent vers des versions antérieures.
- Le modèle principal ne change jamais dynamiquement : le seul levier est la délégation.

## Vérifier ce qui tourne réellement

- `/tasks` : modèle et effort de chaque sous-agent en cours.
- Transcripts : `~/.claude/projects/<projet>/<session>/subagents/agent-*.jsonl`, champs `message.model` et `effort` de chaque message `assistant` (type d'agent dans `agent-*.meta.json`).

Résultats des tests de routage : [`ROUTING-TESTS.md`](./ROUTING-TESTS.md).
