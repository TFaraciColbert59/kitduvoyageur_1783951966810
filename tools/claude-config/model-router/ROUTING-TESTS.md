# Tests de routage — 31/10 et 01/11/2026

Claude Code 2.1.316, API Anthropic (`firstParty`). Modèle et effort lus dans les transcripts (`message.model`, `effort` de chaque message `assistant`), coûts lus dans les rapports `result` de Claude Code (`modelUsage`, prix catalogue). Chaque test est une session neuve (`claude -p … --output-format stream-json`) sauf les tests « en direct ».

## 1. Effort de la session principale

| Test | Réglage | Résultat mesuré |
|---|---|---|
| Témoin A | `modelSettings.claude-opus-5-5.effortLevel = high` | `claude-opus-5-5` / **high** |
| Témoin B | même chose, `modelSettings` retiré | `claude-opus-5-5` / **medium** (défaut d'Opus 5.5) |

→ C'est bien `modelSettings` qui donne `high` à l'orchestrateur, sans variable globale imposée aux sous-agents.

## 2. Scénarios

| # | Scénario | Attendu | Observé (modèle / effort) | Verdict |
|---|---|---|---|---|
| 1a | Inventaire des appels d'une fonction (v1 des consignes) | Haiku low | Opus high fait seul, Skill non chargé · 6 tours · 0,54 $ | ✗ consignes trop faibles |
| 1b | Même demande (v2) | Haiku low | Skill chargé, Opus fait seul : « un seul Grep suffit, déléguer coûterait plus cher » · 5 tours · 0,39 $ | ✓ règle « tâche très courte » (2 appels d'outils) |
| 1c | Inventaire de 202 routes API (v2) | Haiku low | Opus fait seul ; script refusé, puis poursuite à la main · 29 tours · 1,91 $ · 290 s | ✗ faille → garde-fou ajouté en v3 |
| 1d | Inventaires Realtime et télémétrie, en direct dans la session orchestratrice (v3) | Haiku low | 2 × `mr-scout` : **claude-haiku-5-5 / low** (18 et 28 messages) | ✓ |
| 2a | Module panier + tests `node:test`, bac à sable (v1) | Sonnet medium | Opus high fait seul · 13 tours · 0,44 $ · 16 tests verts | ✗ pas de délégation |
| 2b | Même demande (v2) | Sonnet medium | Opus délègue à `mr-builder` : **claude-sonnet-5-5 / medium** (13 messages) · 0,40 $ au total (Opus 0,235 + Sonnet 0,161) · 25 tests verts | ✓ |
| 3 | Refonte du cache de résolution de lieux (analyse d'architecture) | Opus high | Skill chargé, **claude-opus-5-5 / high**, aucun sous-agent · 12 tours · 1,01 $ | ✓ |

## 3. Corrections apportées pendant les tests

- **v2** : la délégation devient la règle par défaut ; l'exécution directe est limitée à ≤ 3 appels d'outils, aux décisions critiques et aux contrôles existants. Le bloc `CLAUDE.md` demande de charger le Skill avant le premier appel d'outil (1a ne l'avait pas chargé).
- **v3** : « contrôle déterministe » ne couvre plus l'écriture d'un script d'inventaire ; garde-fou : au-delà de 3 appels ou en cas d'échec de l'approche directe, re-router vers l'agent adapté.
- Sauvegardes de l'installateur déplacées hors des dossiers chargés par Claude Code (pas de doublon d'agent ni de Skill).

## 4. Limites et ce qui n'est pas prouvé

- 1c n'a pas été rejoué en session neuve après v3 ; la v3 est validée en direct par 1d (inventaires multi-fichiers délégués à Haiku). Le routage reste une consigne suivie par le modèle, pas un mécanisme imposé : un écart reste possible et se voit dans `/tasks` ou les transcripts.
- Aucune économie globale n'est annoncée : un seul passage par scénario. Seule mesure appariée : 2a (Opus seul, 0,44 $) contre 2b (Opus + Sonnet, 0,40 $) sur la même demande — un échantillon, pas une moyenne.
- Une session ouverte avant la création de `~/.claude/agents` ne voit pas les agents (limite documentée) : redémarrer.
- Sessions cloud : `~/.claude` n'est pas persistant, voir `setup-cloud.sh`.
