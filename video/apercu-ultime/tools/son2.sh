#!/usr/bin/env bash
# Bande-son de l aperçu dynamique (21,6 s) : phrases de la voix de la présentation sur la musique à 120 BPM (tools/musique2.py). -14 LUFS.
# (la montée des « couches de demain », puis l'accord final calé sur « Le Kit du Voyageur »). -14 LUFS.
set -euo pipefail
cd "$(dirname "$0")/.."
V=../presentation/audio/voix-finale.wav; O=audio/musique2.wav
seg() { echo "[0:a]atrim=$1:$2,asetpts=PTS-STARTPTS,adelay=$3|$3[$4]"; }
FC="$(seg 15.33 16.05 900 v1);$(seg 0.45 2.45 2200 v2);$(seg 51.55 53.15 5700 v3);$(seg 111.85 114.72 8200 v4);$(seg 163.95 166.15 11750 v5);$(seg 323.03 326.83 17200 v6);\
[v1][v2][v3][v4][v5][v6]amix=inputs=6:normalize=0,pan=stereo|c0=c0|c1=c0,highpass=f=75,equalizer=f=140:t=q:w=1:g=2.5,acompressor=threshold=-20dB:ratio=3:makeup=3,volume=1.6,apad=whole_dur=21.6,asplit=2[v][sc];\
[1:a]volume=0.9[m0];\
[m0][sc]sidechaincompress=threshold=0.05:ratio=3:attack=20:release=300[md];\
[v][md]amix=inputs=2:normalize=0:duration=longest,atrim=0:21.6[mx]"
ffmpeg -hide_banner -loglevel error -y -i $V -i $O -filter_complex "$FC" -map "[mx]" -c:a pcm_s24le audio/brut.wav
J=$(ffmpeg -hide_banner -i audio/brut.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$J" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -hide_banner -loglevel error -y -i audio/brut.wav -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -c:a pcm_s16le audio/bande-son2.wav
rm -f audio/brut.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 audio/bande-son2.wav
