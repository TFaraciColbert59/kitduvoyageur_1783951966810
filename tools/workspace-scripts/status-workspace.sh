#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/fr168256/LKDV"
REPO="$ROOT/repo"

echo "=== LKDV DEV ENVIRONMENT ($ROOT) ==="
echo "Main HEAD : $(git -C "$REPO" log -1 --oneline)"
echo "Dirty main: $(git -C "$REPO" status --short | wc -l | tr -d ' ') fichier(s)"
echo ""
echo "=== WORKTREES / SLOTS MULTI-AGENTS ==="
git -C "$REPO" worktree list
echo ""
echo "=== MEMOIRE VIVANTE (memory/STATE.md) ==="
head -n 25 "$REPO/memory/STATE.md" 2>/dev/null || echo "(memory/STATE.md non initialisé)"
echo ""
echo "=== ESPACE DISQUE ==="
df -h / | tail -n 1
