#!/usr/bin/env bash
# Bande-son de la présentation : voix (audio/voix-finale.wav) + orgue (audio/orgue.wav),
# l'orgue s'efface sous la voix (sidechain), puis normalisation en deux passes à -14 LUFS, crête -1 dBTP.
set -euo pipefail
cd "$(dirname "$0")/.."
FC="[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,highpass=f=75,equalizer=f=140:t=q:w=1:g=2.5,equalizer=f=3200:t=q:w=1.2:g=2,acompressor=threshold=-20dB:ratio=3:attack=8:release=180:makeup=3,volume=1.6,asplit=2[v][sc];\
[1:a]volume=0.95[m];[m][sc]sidechaincompress=threshold=0.03:ratio=5:attack=40:release=650:makeup=1[md];\
[v][md]amix=inputs=2:normalize=0:duration=longest[mx]"
ffmpeg -hide_banner -loglevel error -y -i audio/voix-finale.wav -i audio/orgue.wav -filter_complex "$FC" -map "[mx]" -c:a pcm_s24le audio/mix-brut.wav
J=$(ffmpeg -hide_banner -i audio/mix-brut.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$J" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -hide_banner -loglevel error -y -i audio/mix-brut.wav -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -c:a pcm_s16le audio/bande-son.wav
rm -f audio/mix-brut.wav
ffmpeg -hide_banner -i audio/bande-son.wav -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | grep -E "I:|LRA:|Peak:"