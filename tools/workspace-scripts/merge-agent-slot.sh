#!/usr/bin/env bash
set -euo pipefail

# Usage: ~/LKDV/scripts/merge-agent-slot.sh <slot-name>
SLOT="${1:-}"
ROOT="/Users/fr168256/LKDV"
REPO="$ROOT/repo"
WT_DIR="$ROOT/worktrees/$SLOT"
BRANCH="agent/$SLOT"

if [ -z "$SLOT" ]; then
  echo "Usage: $0 <slot-name>" >&2
  exit 1
fi

if [ ! -d "$WT_DIR" ]; then
  echo "Slot '$SLOT' introuvable dans $WT_DIR" >&2
  exit 1
fi

if [ -n "$(git -C "$WT_DIR" status --porcelain)" ]; then
  echo "❌ Le slot '$SLOT' contient des modifications non commitées. Commite d'abord dans $WT_DIR." >&2
  exit 1
fi

# Retirer le symlink node_modules avant suppression du worktree
[ -L "$WT_DIR/node_modules" ] && rm -f "$WT_DIR/node_modules"
[ -L "$WT_DIR/.env.local" ] && rm -f "$WT_DIR/.env.local"

git -C "$REPO" checkout main
git -C "$REPO" merge --no-ff "$BRANCH" -m "merge(agent/$SLOT): integrate validated parallel agent work"
git -C "$REPO" worktree remove "$WT_DIR"
git -C "$REPO" branch -d "$BRANCH"

echo "✅ Slot '$SLOT' mergé dans main et nettoyé."
