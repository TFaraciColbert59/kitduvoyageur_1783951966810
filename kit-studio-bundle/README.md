# Bundle « Kit Studio v2 » — chantier autonome (0 €)

Tout ce qu'il faut à un agent de code pour livrer le nouveau Kit Studio dans l'app LKDV, sur l'iPhone 16 Pro de Tony, **sans poser de question**.

## Démarrer en 3 gestes
1. Copier ce dossier à la racine du dépôt `kitduvoyageur` (ou lancer `scripts/bootstrap.sh`, qui fait la copie, crée la branche et installe agents, skills et MCP au bon endroit).
2. Ouvrir Claude Code **avec Opus 5.5, effort élevé** (c'est le coordinateur).
3. Coller le contenu de `00-LANCEMENT.md`. Rien d'autre.

## Plan du bundle
| Dossier / fichier | Rôle |
|---|---|
| `00-LANCEMENT.md` | Le prompt unique du coordinateur |
| `CLAUDE.kit-studio.md` | Règles du chantier (à ajouter à `CLAUDE.md` par le bootstrap) |
| `audit/AUDIT-KIT-STUDIO-ACTUEL.md` | Audit de la maquette actuelle : forces, défauts, dette, risques |
| `audit/INVENTAIRE-MAQUETTE.md` | Inventaire exact du code et des données de la maquette (numéros de ligne) |
| `spec/BRIEF-TONY.md` | Les demandes de Tony, mot pour mot, et leur interprétation figée |
| `spec/SPEC-PRODUIT.md` | Parcours, écrans, états, textes |
| `spec/SPEC-DRAWER.md` | Géométrie et comportement du tiroir iOS (mesures, détentes) |
| `spec/SPEC-3D.md` | Scène three.js, vignettes 3D, performances iPhone |
| `spec/SPEC-ARCHITECTURE.md` | Arborescence cible dans le dépôt, données, état, tests |
| `spec/DECISIONS.md` | ADR du chantier (à ne pas rouvrir) |
| `plan/DISPATCH-MODELES.md` | Quel modèle, quel effort, pour quoi, avec quels plafonds |
| `plan/TASKS.md` + `plan/backlog.json` | Les tâches, dépendances, modèle, critères d'acceptation |
| `plan/DEFINITION-OF-DONE.md` | Portes de qualité et preuves exigées |
| `agents/*.md` | Sous-agents (Haiku, Sonnet, Opus) prêts pour `.claude/agents/` |
| `skills/*/SKILL.md` | Skills du chantier prêts pour `.claude/skills/` |
| `mcp/mcp.kit-studio.json` | Serveurs MCP gratuits à brancher |
| `ios/RUN-ON-IPHONE.md` | Du build à l'iPhone 16 Pro (Xcode, ou repli sans Mac) |
| `scripts/` | `bootstrap.sh`, `verify-kit-studio.sh`, `ios-run.sh` |
| `reference/` | Maquette actuelle, maquette cible (v2) et captures |

## Budget
0 € : GitHub Actions (dépôt public), Vercel et Supabase déjà en place, `three` (MIT), identifiant Apple gratuit pour l'installation sur l'iPhone, aucune API payante, aucune police ni image achetée.
