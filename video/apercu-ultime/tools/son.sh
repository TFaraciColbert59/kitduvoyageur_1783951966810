#!/usr/bin/env bash
# Bande-son de l'aperçu (22 s) : phrases prises telles quelles dans la voix de la présentation + deux passages de l'orgue
# (la montée des « couches de demain », puis l'accord final calé sur « Le Kit du Voyageur »). -14 LUFS.
set -euo pipefail
cd "$(dirname "$0")/.."
V=../presentation/audio/voix-finale.wav; O=../presentation/audio/orgue.wav
seg() { echo "[0:a]atrim=$1:$2,asetpts=PTS-STARTPTS,adelay=$3|$3[$4]"; }
FC="$(seg 0.45 2.45 400 v1);$(seg 12.45 16.15 3000 v2);$(seg 51.55 53.15 9300 v3);$(seg 111.85 114.72 11600 v4);$(seg 163.95 166.15 14700 v5);$(seg 323.03 326.83 17500 v6);\
[v1][v2][v3][v4][v5][v6]amix=inputs=6:normalize=0,pan=stereo|c0=c0|c1=c0,highpass=f=75,equalizer=f=140:t=q:w=1:g=2.5,acompressor=threshold=-20dB:ratio=3:makeup=3,volume=1.6,asplit=2[v][sc];\
[1:a]atrim=80.4:97.9,asetpts=PTS-STARTPTS,afade=t=in:d=0.4,afade=t=out:st=16.9:d=0.6[a];\
[1:a]atrim=322.43:327.53,asetpts=PTS-STARTPTS,afade=t=in:d=0.4,adelay=16900|16900[b];\
[a][b]amix=inputs=2:normalize=0,volume=1.1[m];[m][sc]sidechaincompress=threshold=0.03:ratio=5:attack=40:release=500[md];\
[v][md]amix=inputs=2:normalize=0:duration=longest,atrim=0:22,afade=t=out:st=21.0:d=1.0[mx]"
ffmpeg -hide_banner -loglevel error -y -i $V -i $O -filter_complex "$FC" -map "[mx]" -c:a pcm_s24le audio/brut.wav
J=$(ffmpeg -hide_banner -i audio/brut.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$J" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -hide_banner -loglevel error -y -i audio/brut.wav -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -c:a pcm_s16le audio/bande-son.wav
rm -f audio/brut.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 audio/bande-son.wav
