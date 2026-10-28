# Bundle d’implémentation · Explorer v2 (LKDV)

Ce dossier contient tout ce qu’il faut pour qu’un agent autonome implémente la nouvelle page Explorer de bout en bout, sans intervention humaine.

## Pour Tony (seule action humaine)
1. Copier ce dossier à la racine du dépôt `TFaraciColbert59/kitduvoyageur_1783951966810` sous `handoff/explorer-v2/` (ou donner son lien à l’agent).
2. Envoyer à l’agent ce message unique :
   > Lis `handoff/explorer-v2/00_MISSION.md` et exécute la mission jusqu’au bout, en autonomie complète.

Rien d’autre. L’agent ne doit jamais poser de question : tout ce qui est ambigu est tranché par les règles de `00_MISSION.md` et consigné dans `DECISIONS.md`.

## Contenu
| Fichier | Rôle |
|---|---|
| `00_MISSION.md` | Prompt maître : règles d’autonomie, preuves, boucle de travail, définition de « terminé » |
| `01_AUDIT.md` | Audit de l’existant (dépôt + BDD) : ce qu’on réutilise, ce qu’on remplace, les pièges |
| `02_ARCHITECTURE.md` | Architecture cible : route, composants, état, moteur carte, données, natif, Rust/WASM |
| `03_ECRANS.md` | Spécification des 42 écrans + 3 planches, avec captures et contenus de référence |
| `04_CARTE.md` | Hiérarchie d’affichage, styles de tracés, mouvements de caméra, mode suivi |
| `05_DONNEES.md` | Sources gratuites, migrations, RPC, RLS, règles « zéro donnée inventée » |
| `06_PHASES.md` | Plan en 11 phases avec gates de validation |
| `07_CHECKLIST.md` | Checklist à cocher, preuve par point |
| `08_TESTS.md` | Stratégie Playwright, perf, a11y, sécurité, parité visuelle |
| `09_DESIGN.md` | Jetons, matières verre, icônes, typographie, micro-animations, haptique |
| `skills/` | 8 skills créées pour ce chantier (à copier dans `.agents/skills/` et `.agent/skills/`) |
| `mcp/` | Configuration MCP recommandée (gratuite) |
| `modeles/` | `MISSION_LOG.md`, `DECISIONS.md`, `BLOCAGES.md` à copier à la racine du chantier |
| `maquette/` | Maquette exécutable (`index.html`), 45 captures, `textes_ecrans.json` |

## Lire la maquette en local
```bash
npx serve handoff/explorer-v2/maquette
# ouvrir http://localhost:3000 puis le premier lien (prototype navigable)
```
