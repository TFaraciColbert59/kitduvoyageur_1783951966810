import json, sys, os, subprocess
d, out = sys.argv[1], sys.argv[2]
m = json.load(open(os.path.join(d, 'meta.json')))
lines = []
for k, (fn, ts) in enumerate(m):
    dur = (m[k + 1][1] - ts) if k + 1 < len(m) else 0.5
    lines.append(f"file '{os.path.join(d, fn)}'\nduration {max(dur, 0.001):.4f}")
lines.append(f"file '{os.path.join(d, m[-1][0])}'")
open(os.path.join(d, 'list.txt'), 'w').write('\n'.join(lines))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', os.path.join(d, 'list.txt'), '-vf', 'fps=30,scale=786:-2:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-movflags', '+faststart', out], check=True)
print(out, round(m[-1][1] - m[0][1] + 0.5, 2), 's')
mk = os.path.join(d, 'marks.json')
if os.path.exists(mk):
    t0 = m[0][1]; ms = {k: round(v - t0, 3) for k, v in json.load(open(mk))}
    json.dump(ms, open(out.replace('.mp4', '.marks.json'), 'w')); print('repères', ms)
