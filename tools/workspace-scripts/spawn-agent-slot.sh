#!/usr/bin/env bash
set -euo pipefail

# Usage: ~/LKDV/scripts/spawn-agent-slot.sh <slot-name> [base-branch]
SLOT="${1:-}"
BASE="${2:-main}"
ROOT="/Users/fr168256/LKDV"
REPO="$ROOT/repo"
WT_DIR="$ROOT/worktrees/$SLOT"
BRANCH="agent/$SLOT"

if [ -z "$SLOT" ]; then
  echo "Usage: $0 <slot-name> [base-branch=main]" >&2
  exit 1
fi

if [ -d "$WT_DIR" ]; then
  echo "Slot '$SLOT' already exists at $WT_DIR"
  exit 0
fi

git -C "$REPO" worktree add -b "$BRANCH" "$WT_DIR" "$BASE"

# Partager .env.local et node_modules sans dupliquer plusieurs Go sur disque
if [ -f "$REPO/.env.local" ]; then
  ln -sfn "$REPO/.env.local" "$WT_DIR/.env.local"
fi
if [ -d "$REPO/node_modules" ] && [ ! -e "$WT_DIR/node_modules" ]; then
  ln -sfn "$REPO/node_modules" "$WT_DIR/node_modules"
fi

echo "✅ Slot multi-agent prêt :"
echo "   Chemin  : $WT_DIR"
echo "   Branche : $BRANCH (depuis $BASE)"
echo "   Port recommandé (dev) : 3011-3019 (ne pas utiliser 3001 réservé à main)"
