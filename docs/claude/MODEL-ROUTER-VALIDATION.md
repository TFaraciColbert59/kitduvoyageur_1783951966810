# Validation du routage — 2026-11-03 (Claude Code 2.1.317)

Méthode : sessions neuves `claude -p` (headless, stream-json) lancées dans le dépôt LKDV, sans nommer d'agent sauf r5. Modèle et effort réellement servis lus dans les transcriptions `~/.claude/projects/<projet>/<session>/subagents/agent-*.jsonl` (champs `requestedModel`, `attributionAgent`, `effort`, `perTurnEffort`) et dans `modelUsage` du résultat.

## Syntaxe vérifiée dans le binaire
- Agent : `name, description, tools, disallowedTools, model, effort, permissionMode, mcpServers, hooks, maxTurns, skills, memory, background, isolation…` ; `effort ∈ low|medium|high|xhigh|max` (ou entier).
- Alias : `haiku → claude-haiku-5-5`, `sonnet → claude-sonnet-5-5`, `opus → claude-opus-5-5`. Les trois modèles annoncent la capacité `effort`.
- Les agents sont lus **au démarrage de session** seulement (pas de rechargement à chaud) ; les skills, si.

## Résultats finaux

| Scénario | Attendu | Observé | Durée | Coût (prix catalogue) |
|---|---|---|---|---|
| v1 Recherche (lecture de 106 fichiers) | Haiku low | 3 × `scout` en parallèle → `claude-haiku-5-5`, `effort: low` sur 18/18 tours | 54 s | 0,740 $ (Opus 0,718 + Haiku 0,022) |
| r5 Recherche nommée (`scout`) | Haiku low | `claude-haiku-5-5`, `effort: low` 3/3 tours | 28 s | 0,410 $ |
| r2 Implémentation standard (slugify + tests) | Sonnet medium | `builder` → `claude-sonnet-5-5`, `effort: medium` ; tests 7/7 relancés par l'orchestrateur | 49 s | 0,595 $ (Opus 0,435 + Sonnet 0,159) |
| v3 Problème architectural | Opus high | traité en direct par la session principale `claude-opus-5-5` (effort high), sans délégation | 44 s | 0,592 $ |

## Constats et corrections pendant la validation
1. **Première passe (t1–t3) : aucune délégation.** Cause : Claude Code injecte, sur ce forfait, « Do not spawn agents unless the user asks… it's the expensive path on this plan » dans la description de l'outil Agent (sauf demande explicite ou agent nommé). Correction : le CLAUDE.md formule une demande explicite et permanente nommant les agents.
2. **Le skill n'est jamais chargé automatiquement** (0 appel `Skill` sur 10 sessions). Correction : la grille de décision compacte vit dans `CLAUDE.md` (toujours en contexte) ; le skill garde le détail (brief, escalade, qualité).
3. **Critère « plus d'une commande » inopérant** : Opus regroupe une recherche en une seule commande Bash composée. Critère retenu : volume lu (plusieurs fichiers ou > ~100 lignes) → `scout`.
4. Recherche courte (un grep, r1/r3) : traitée en direct par Opus — conforme à la règle « pas de sous-agent pour les tâches très courtes ».

## Coûts mesurés : pas d'économie démontrée sur ces tests
| Comparaison (même demande) | Direct Opus | Délégué | Écart |
|---|---|---|---|
| Lecture de 106 fichiers (r4 → v1) | 0,682 $ · 63 s | 0,740 $ · 54 s | +8,5 % coût, −14 % durée |
| slugify + tests (t2 → r2) | 0,534 $ · 52 s | 0,595 $ · 49 s | +11 % coût |

Chaque session headless paie ~0,30–0,35 $ fixes (création du cache du prompt système Opus, ~69 k tokens), et l'orchestrateur rédige des briefs puis relit/fusionne les comptes rendus. Sur des tâches de cette taille, la délégation ne réduit donc pas le coût ; elle préserve le contexte de l'orchestrateur et permet le parallélisme. Une économie n'est plausible que lorsque le travail délégué est grand devant le brief — **non mesurée à ce jour**. Les montants sont des équivalents prix catalogue (`costBasis: list`), pas une facture : sur un abonnement, ils correspondent à de la consommation de quota.
