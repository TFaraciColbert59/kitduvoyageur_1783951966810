# MCP recommandés (tous gratuits)

| Serveur | Usage | Indispensable ? |
|---|---|---|
| playwright | piloter le navigateur, captures, clics | non : `npx playwright` en terminal suffit |
| supabase | migrations, SQL, RLS sur `icxyvwzfjbflcbqukpfz` | non : `npx supabase` CLI ou base locale Docker |
| github | PR, CI | non : `git` + `gh` CLI |
| context7 | documentation à jour (MapLibre, Capacitor, Next) | non |

Copier `mcp_config.json` dans la configuration MCP de l’agent si ces serveurs n’y sont pas déjà. Les jetons viennent des variables d’environnement existantes ; ne jamais les écrire dans le dépôt. Le chantier est conçu pour avancer même si aucun MCP n’est disponible (contournements `00_MISSION.md §9`).
