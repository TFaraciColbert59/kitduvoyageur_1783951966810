#!/bin/bash
# usage : normalize-audio.sh entree.mp4 sortie.mp4 — loudnorm en deux passes à -14 LUFS / -1,5 dBTP, image copiée telle quelle
set -e
in="$1"; out="$2"
j=$(ffmpeg -hide_banner -i "$in" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['input_i'])")
mt=$(echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['input_tp'])")
ml=$(echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['input_lra'])")
mth=$(echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['input_thresh'])")
off=$(echo "$j" | python3 -c "import json,sys;print(json.load(sys.stdin)['target_offset'])")
ffmpeg -v error -y -i "$in" -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$mi:measured_TP=$mt:measured_LRA=$ml:measured_thresh=$mth:offset=$off:linear=true,aresample=48000" -c:a aac -b:a 192k -movflags +faststart "$out"
