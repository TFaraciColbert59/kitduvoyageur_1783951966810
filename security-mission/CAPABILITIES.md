# CAPABILITIES.md — Préflight modèle & runtime (2026-10-09)

Vérifications inoffensives uniquement. Tout élément non vérifié est marqué **non vérifié**.

## Modèle / route

| Élément | Observation | Statut |
| --- | --- | --- |
| ID modèle runtime | `opencode-go/deepseek-v4.1-flash` (exposé par le runtime) | observé |
| Route fournisseur | Proxy local OmniRoute `http://localhost:20128` (`@omniroute/opencode-plugin@0.2.1` dans `opencode.json`) — pas d'endpoint DeepSeek direct | observé |
| Alias/endpoint/capacités du fournisseur (contexte, sortie, tarifs, tool-calling) | non vérifiés auprès du fournisseur | non vérifié |
| Exécution des tool calls | par le runtime opencode (permissions fichiers/réseau non isolées par agent) | observé |

## Outils réellement disponibles dans cette session

| Capacité | État | Notes |
| --- | --- | --- |
| Shell (PowerShell 5.1, win32) | disponible | pas de sandbox/namespace ; Docker présent mais non utilisé par défaut |
| Lecture/écriture fichiers | disponible | écritures mission → `security-mission/` ; correctifs → branche isolée |
| Sous-agents natifs (Task) | disponible | contextes séparés ; types : explore, general, code-reviewer, security-reviewer, database-reviewer, performance-*, browser-profiler, architect, a11y-architect… |
| Isolation par sous-agent | **absente** | même machine/arbre → règle un-seul-écrivain + vérification par assertions |
| Navigateur : chrome-devtools MCP | exposé dans la session (headless, isolé, localhost seulement) | `opencode.json` le déclare désactivé — override observé au runtime |
| Navigateur : playwright MCP | exposé (webkit mobile, headless, localhost seulement) | idem |
| Git | 2.55.0, worktrees OK | |
| DB locale | Docker 29.7.2 + supabase CLI global + `supabase/config.toml` + `supabase/.temp` | `supabase start` local possible (images à vérifier) |
| Connecteur Supabase distant | **absent** | aucune lecture catalogue distante sans credentials |
| Connecteur GitHub distant | **absent** (pas de MCP gh) | `gh` CLI à vérifier si besoin |
| Web (webfetch/websearch) | disponible | pour recherche sources uniquement |
| Persistance | dépôt + `C:\Users\Tony\AppData\Local\Temp\opencode` | |
| Quotas budget | non fournis | caps opérationnels dans `RUN.md` |

## Secrets

- `.env`, `.env.local` présents — **jamais lus**. `.env.example` consultable (valeurs fictives documentées).
- Aucun `SUPABASE_SERVICE_ROLE_KEY` réel ne doit être chargé dans un process de test.

## Simulation de rôles

Les personnalités `AGENTS.md` (64 icon agents) ne sont pas un budget ni une organisation d'exécution ; les rôles du programme (architecture, data, app-auth, money, ai, mobile-offline, platform, privacy-legal, qa-verifier, coverage-critic) sont mappés sur les types de sous-agents disponibles.

## Conclusion préflight

Mode retenu : **sous-agents natifs en orchestration équivalente** — chaque délégation = contrat borné (`task_id`, chemins, limites), vérification réservée à un contexte neuf, registres écrits par l'orchestrateur uniquement. Les limites réelles (pas de sandbox réseau, pas de connecteur DB distante) contraignent P1/P3 à du statique + base locale ; les faits de production resteront `needs_validation` tant que D1 (SCOPE.md) n'est pas tranchée.
