#!/bin/sh
# Rend les trois essais animés (proposition) : images de la surcouche composées sur le film, puis ffmpeg avec la musique v4.
# Depuis trailer/ : sh motion-lab/essais.sh
set -e
T="$(cd "$(dirname "$0")/.." && pwd)"
cd "$T"
export PATH="$T/node_modules/ffmpeg-static:$T/node_modules/ffprobe-static/bin/darwin/arm64:$PATH"
W=motion-lab/work
enc() { # dossier première nb sortie
  ffmpeg -v error -y -framerate 24 -start_number "$2" -i "$1/f%04d.png" \
    -ss "$(python3 -c "print($2/24)")" -t "$(python3 -c "print($3/24)")" -i qa/mix-v4.wav \
    -map 0:v -map 1:a -frames:v "$3" -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -r 24 -c:a aac -b:a 256k "$4"
}
node motion-lab/render.mjs seq essai-1 547 673 $W/essai1 > /dev/null
enc $W/essai1 547 127 livraison/LKDV-motion-essai-1-fil-seceda.mp4
node motion-lab/render.mjs seq essai-2 210 294 $W/essai2 > /dev/null
enc $W/essai2 210 85 livraison/LKDV-motion-essai-2-iris.mp4
node motion-lab/render.mjs seq essai-3 799 925 $W/essai3A '{"version":"A"}' > /dev/null
node motion-lab/render.mjs seq essai-3 799 925 $W/essai3B '{"version":"B"}' > /dev/null
node motion-lab/render.mjs seq carton 0 23 $W/cartonA '{"titre":"A · LE FIL SEUL","sous":"sans texte ni chiffre"}' > /dev/null
node motion-lab/render.mjs seq carton 0 23 $W/cartonB '{"titre":"B · LA DONNÉE JUSTE","sous":"valeurs réelles de l’app (capture E10)"}' > /dev/null
# essai 3 : carton A (1 s, silence) + version A + carton B + version B, en une seule suite d'images
rm -rf $W/e3seq && mkdir -p $W/e3seq
i=0
for src in "cartonA 0 23" "essai3A 799 925" "cartonB 0 23" "essai3B 799 925"; do
  set -- $src
  for n in $(seq $2 $3); do
    ln -s "../$1/f$(printf %04d $n).png" "$W/e3seq/f$(printf %04d $i).png"; i=$((i+1))
  done
done
S=$(python3 -c "print(799/24)"); D=$(python3 -c "print(127/24)")
ffmpeg -v error -y -framerate 24 -i $W/e3seq/f%04d.png \
  -f lavfi -t 1 -i anullsrc=r=48000:cl=stereo -ss $S -t $D -i qa/mix-v4.wav \
  -filter_complex "[1:a]asplit[s1][s2];[2:a]aresample=48000,aformat=channel_layouts=stereo,asplit[m1][m2];[s1][m1][s2][m2]concat=n=4:v=0:a=1[a]" \
  -map 0:v -map "[a]" -frames:v $i -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -r 24 -c:a aac -b:a 256k livraison/LKDV-motion-essai-3-donnee.mp4
echo fini
