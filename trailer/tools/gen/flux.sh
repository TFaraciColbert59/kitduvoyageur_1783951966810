#!/usr/bin/env bash
# Piste A : FLUX.1 [schnell] Q4_K_S + T5 Q4_K_M via stable-diffusion.cpp (CPU).
# Usage: flux.sh NOM "prompt" [largeur hauteur] [graine]
set -e
G=${GEN:-/tmp/claude-0/-home-user-kitduvoyageur-1783951966810/01a3ca9d-48c3-50c5-8d53-c0cbef7f3fab/scratchpad/gen}
OUT=${OUT:-$(dirname "$0")/../../qa/tmp/gen}
N=$1; P=$2; W=${3:-1024}; H=${4:-576}; S=${5:-1783}
python3 "$(dirname "$0")/run_timed.py" $G/logs/flux_$N.log -- $G/build/bin/sd-cli \
  --diffusion-model $G/models/flux1-schnell-Q4_K_S.gguf --vae $G/models/ae.safetensors \
  --clip_l $G/models/clip_l.safetensors --t5xxl $G/models/t5-v1_1-xxl-encoder-Q4_K_M.gguf \
  -p "$P" --cfg-scale 1.0 --steps 4 --sampling-method euler -W $W -H $H -s $S -t 4 \
  --vae-tiling --offload-to-cpu --mmap -v -o $OUT/flux_$N.png
