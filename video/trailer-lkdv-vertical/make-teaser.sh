#!/bin/bash
# Teaser 9:16 (~16 s) monté depuis le rendu vertical, coupes sur les mesures de la musique (128 BPM).
#   A 0,00–3,25   accroche « Là où la carte se termine. »
#   B 7,00–10,75  la musique s'ouvre : plongée satellite et tracé
#   C 14,50–18,25 sac 3D : coloris et module
#   D 31,37–37,00 « Une phrase. Tout le voyage. », badge, lekitduvoyageur.fr
# Usage : ./make-teaser.sh renders/trailer-lkdv-9x16.mp4 renders/teaser-lkdv-9x16.mp4
set -euo pipefail
in="$1"; out="$2"
segs=("0:3.25" "7.0:10.75" "14.5:18.25" "31.37:37.0")
f=""; n=0
for s in "${segs[@]}"; do
  a=${s%%:*}; b=${s##*:}; d=$(python3 -c "print(round($b-$a,3))")
  f+="[0:v]trim=start=$a:end=$b,setpts=PTS-STARTPTS[v$n];"
  f+="[0:a]atrim=start=$a:end=$b,asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=$(python3 -c "print(round($d-0.04,3))"):d=0.04[a$n];"
  n=$((n+1))
done
for i in $(seq 0 $((n-1))); do f+="[v$i][a$i]"; done
f+="concat=n=$n:v=1:a=1[v][a]"
ffmpeg -v error -y -i "$in" -filter_complex "$f" -map "[v]" -map "[a]" \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 192k -movflags +faststart "$out"
