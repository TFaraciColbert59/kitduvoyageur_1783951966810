# AGENTS.md — LKDV Agent Configurations, Skills & Icon Agents

Ce repository contient des configurations, des règles, des skills et des agents spécialisés pour Antigravity, Claude Code et les agents IA.

## Skills Disponibles

- **`apple-ui-designer`** (`.agents/skills/apple-ui-designer/SKILL.md`):
  Redesign mobile app UI to feel unmistakably Apple-like, iOS-forward, and native with SF Pro typography, translucency, native system components, safe-area awareness, and Human Interface Guidelines rigor.
- **`interaction-design`** (`.agents/skills/interaction-design/SKILL.md`):
  Design and implement microinteractions, motion design, transitions, and user feedback patterns. Use when adding polish to UI interactions, implementing loading states, or creating delightful user experiences.
- **`superpowers`** (Suite de 14 skills dans `.agents/skills/` & `.claude/skills/`) :
  - `brainstorming` : Exploration interactive des idées et conception avant écriture de code
  - `subagent-driven-development` : Exécution modulaire avec sous-agents spécialisés et revues indépendantes
  - `executing-plans` : Exécution disciplinée de plans avec validation incrémentale
  - `writing-plans` : Rédaction de plans d'implémentation rigoureux et testables
  - `systematic-debugging` : Diagnostic méthodique et traçabilité des bugs
  - `test-driven-development` : TDD strict Red/Green/Refactor
  - `verification-before-completion` : Contrôles de validation et tests d'assurance qualité avant clôture
  - `requesting-code-review` & `receiving-code-review` : Revue de code critique et gestion des retours
  - `dispatching-parallel-agents` : Parallélisation efficace des tâches indépendantes
  - `using-git-worktrees` : Gestion sécurisée des worktrees Git pour isoler les branches
  - `finishing-a-development-branch` : Finalisation propre, fusion et publication des branches
  - `writing-skills` : Création et affinage de nouveaux skills
  - `using-superpowers` : Guidage d'amorçage et priorisation des processus de développement
- **`obsidian-skills`** (`kepano/obsidian-skills` dans `.agents/skills/`, `.claude/skills/` & `.agent/skills/`) :
  - `obsidian-markdown` : Création et édition de Markdown Obsidian (wikilinks `[[Note]]`, embeds `![[embed]]`, callouts `> [!type]`, propriétés frontmatter)
  - `obsidian-bases` : Création et édition d'Obsidian Bases (`.base`) avec vues tabulaires, filtres et formules
  - `json-canvas` : Création et manipulation de graphes visuels JSON Canvas (`.canvas`)
  - `obsidian-cli` : Pilotage en ligne de commande de coffres Obsidian, recherche et automatisation
  - `defuddle` : Extraction de markdown propre et concis depuis des pages web pour économiser les tokens

## Règle Permanente UX & Interaction Design

> **Règle Permanente :** Les skills `apple-ui-designer` et Aura `interaction-design` doivent être appliqués pour toute décision relative aux layouts mobiles, hiérarchies visuelles, microinteractions et transitions natives iOS/Apple.
> **Règle Superpowers :** Pour toute tâche de développement majeure, appliquer le workflow de Superpowers (Brainstorming -> Plan d'implémentation -> Subagent-driven / TDD -> Vérification).

---

## 🏗️ Icon Agents (64 experts répartis en 8 pods)

Installés dans `.claude/agents/`, `.claude/commands/` et `.agents/agents/` :

1. **Programming Pod** : Linus Torvalds, John Carmack, Rich Hickey, Alan Kay, Kent Beck, Barbara Liskov, Leslie Lamport, Donald Knuth
2. **Security Pod** : Dan Kaminsky, Katie Moussouris, Bruce Schneier, Mikko Hyppönen, Tarah Wheeler, Mudge Zatko, Eva Galperin, Moxie Marlinspike
3. **Design Pod** : Dieter Rams, Don Norman, Edward Tufte, Jonathan Ive, Susan Kare, Jakob Nielsen, Kat Holmes, Lou Downe
4. **Business Pod** : Clayton Christensen, Michael Porter, Eric Ries, Steve Jobs, Jeff Bezos, Satya Nadella, Reid Hoffman, Elon Musk
5. **Data & AI Pod** : Andrew Ng, Fei-Fei Li, Geoffrey Hinton, Hilary Mason, Yann LeCun, Cassie Kozyrkov, DJ Patil, Demis Hassabis
6. **Product & Policy Pod** : Marty Cagan, Gene Kim, Joanna Bryson, Michelle Zatlyn, Julie Zhuo, Ben Horowitz, Tristan Harris, Cathy O'Neil
7. **Platform & Operations Pod** : Tim Berners-Lee, Vint Cerf, Radia Perlman, Werner Vogels, Martin Fowler, Brendan Gregg, Kelsey Hightower, Jessie Frazelle
8. **Healthcare & AI Pod** : Atul Gawande, Eric Topol, Regina Barzilay, Daphne Koller, Robert Wachter, Fei-Fei Li, Andrew Ng, Vinod Khosla

### Commandes d'évaluation disponibles :
- `/icon-review` (Revue multi-domaines globale)
- `/icon-programming-review`
- `/icon-security-review`
- `/icon-design-review`
- `/icon-business-review`
- `/icon-data-ai-review`
- `/icon-product-policy-review`
- `/icon-platform-operations-review`
- `/icon-healthcare-review`
