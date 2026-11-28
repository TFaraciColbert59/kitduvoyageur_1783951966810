# AGENTS.md — Protocole Universel Multi-Harnesses & Multi-Agents LKDV
<!-- Compatible : Claude Code, Codex, Antigravity, Hermes Agent, Cursor, Agents parallèles -->

Tu travailles dans l'environnement unifié **`~/LKDV/`** (`repo/` = branche `main`, `worktrees/` = slots isolés, `library/` = bibliothèque partagée).
Toutes les règles de fond, l'ambition produit, le routeur automatique de skills et les garde-fous techniques sont définis dans **[CLAUDE.md](CLAUDE.md)** (à lire en priorité absolue).

## 1. Boot Automatique (Économe en Tokens)
1. Lis `CLAUDE.md` + `memory/STATE.md` (coût < 2 500 tokens total).
2. Ne charge `memory/LESSONS.md`, `memory/SKILLS_REGISTRY.md`, `memory/RESEARCH_LOG.md` ou un chapitre `docs/0X-*` **que s'il concerne la tâche courante**.
3. Si la demande change totalement de sujet (pivot), mets à jour `memory/STATE.md` (section *Tâches en Pause*) avant de basculer.

## 2. Exécution Multi-Agents en Parallèle (`~/LKDV/worktrees/`)
Quand plusieurs agents travaillent simultanément sur LKDV :
- **Un slot = un domaine = une branche** :
  ```bash
  ~/LKDV/scripts/spawn-agent-slot.sh <nom-du-slot>
  ```
- Chaque agent travaille exclusivement dans son worktree (`~/LKDV/worktrees/<nom-du-slot>`) sur sa branche `agent/<nom-du-slot>` et sur un port dev dédié (`3011–3019`, jamais `3001`).
- **Interdiction de builds concurrents** : sur Mac 8 Go RAM, un seul `next build` ou `tsc` à la fois. Les agents parallèles lancent des tests Vitest ciblés ; le build global s'exécute une fois après merge dans `~/LKDV/repo`.
- **Intégration propre** :
  ```bash
  ~/LKDV/scripts/merge-agent-slot.sh <nom-du-slot>
  ```

## 3. Boucle d'Auto-Amélioration (Hermes)
- **Recherche d'abord** : pour tout sujet complexe, consulte `context7-mcp`, la littérature scientifique/universitaire et GitHub (`search_web`) — budget `0 €` strict.
- **Auto-promotion** : si tu découvres un skill ou pattern exceptionnel et validé sur LKDV, documente-le dans `~/LKDV/library/` et ajoute-le dans `memory/SKILLS_REGISTRY.md`.
- **Auto-purge** : après une session riche, lance `npm run agent:hygiene` (ou `-- --prune`) pour maintenir la mémoire courte, fraîche et à haut signal.

## 4. Porte Qualité Zéro Régression
Avant de déclarer une tâche terminée :
- `npm run design:check` (si CSS/design touché — vérité unique : `/carnets/[id]` & `/clubs/[id]`).
- Tests Vitest ciblés + `npm run lint` sur les fichiers modifiés.
- Preuve visuelle navigateur (`http://localhost:3001`) sur mobile `390×844` pour tout changement UI.
- Commits propres en Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, `chore(...)`), zéro secret `.env*` commité.
