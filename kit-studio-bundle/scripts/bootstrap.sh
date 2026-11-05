#!/usr/bin/env bash
# Installe le bundle Kit Studio dans le dépôt LKDV. À lancer depuis la racine du dépôt. Idempotent.
set -euo pipefail
B="${1:-kit-studio-bundle}"
[ -d "$B" ] || { echo "Dossier $B introuvable (lancer depuis la racine du dépôt)"; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null
BR=claude/kit-studio-v2
git show-ref --verify --quiet "refs/heads/$BR" && git checkout "$BR" || git checkout -b "$BR"
mkdir -p .claude/agents .claude/skills docs/kit-studio
for f in "$B"/agents/*.md; do [ -f ".claude/agents/$(basename "$f")" ] || cp "$f" .claude/agents/; done
for d in "$B"/skills/*/; do n=$(basename "$d"); mkdir -p ".claude/skills/$n"; [ -f ".claude/skills/$n/SKILL.md" ] || cp "$d"SKILL.md ".claude/skills/$n/"; done
# MCP : fusion sans écraser l'existant (jq requis), sinon copie à la main
if command -v jq >/dev/null && [ -f .mcp.json ]; then
  jq -s '.[0] * {mcpServers: ((.[0].mcpServers // {}) + .[1].mcpServers)}' .mcp.json "$B/mcp/mcp.kit-studio.json" > .mcp.json.tmp && mv .mcp.json.tmp .mcp.json
elif [ ! -f .mcp.json ]; then cp "$B/mcp/mcp.kit-studio.json" .mcp.json
else echo "jq absent : fusionner à la main $B/mcp/mcp.kit-studio.json dans .mcp.json"; fi
# Règles du chantier référencées depuis CLAUDE.md (une seule fois)
grep -q "CLAUDE.kit-studio.md" CLAUDE.md || printf '\n---\n## Chantier Kit Studio v2\nVoir `%s/CLAUDE.kit-studio.md` et `%s/00-LANCEMENT.md`.\n' "$B" "$B" >> CLAUDE.md
# Journal et grand livre
[ -f docs/kit-studio/JOURNAL.md ] || printf '# Journal Kit Studio v2\n\n' > docs/kit-studio/JOURNAL.md
[ -f docs/kit-studio/LEDGER.md ] || printf '# Grand livre\n\n| id | modèle · effort | tours | résultat | preuve |\n|---|---|---|---|---|\n' > docs/kit-studio/LEDGER.md
# Mesure de départ (sorties filtrées)
{
  echo "## Mesure de départ $(date -u +%FT%TZ)"
  echo '```'
  (npx tsc --noEmit -p . 2>&1 | tail -5) || true
  (npm run lint --silent 2>&1 | tail -5) || true
  echo '```'
} >> docs/kit-studio/JOURNAL.md
echo "Bootstrap terminé sur la branche $BR"
