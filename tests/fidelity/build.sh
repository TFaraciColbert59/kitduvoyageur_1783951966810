#!/usr/bin/env bash
# Banc de fidélité — build unique, mode fixtures, pour les deux drapeaux.
# Même recette que docs/audit/communaute-v2-2026-11-08/ecarts-maquette/VERIFIER.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."
export NEXT_PUBLIC_COMMUNAUTE_V2=true
export NEXT_PUBLIC_CARNET_V2=true
export NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key
export CIRCLE_NODE_TOTAL=1
export NEXT_TELEMETRY_DISABLED=1
# 8 192 Mo par défaut (recette d'origine) ; `FIDELITY_NODE_OPTIONS` permet de
# réduire le tas quand la machine hôte est sous pression mémoire (le worker de
# build Next est tué par le système, SIGKILL/SIGTERM, avant d'écrire BUILD_ID).
export NODE_OPTIONS="${FIDELITY_NODE_OPTIONS:---max-old-space-size=8192}"
npx next build
