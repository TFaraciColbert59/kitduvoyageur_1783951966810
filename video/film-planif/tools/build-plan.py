# Écrit compositions/plan.html à partir de assets/map/trace.json et overlay-keys.json (tracé OSM réel du W).
import json, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tr=json.load(open(os.path.join(ROOT,'assets/map/trace.json'))); keys=json.load(open(os.path.join(ROOT,'assets/map/overlay-keys.json')))
T0,TD=1.75,1.20   # début et durée du dessin (temps local de la scène)
dmax=tr['dmax']
halo=''.join(f'<polyline points="{s["p"]}"/>' for s in tr['segs'])
lines=''.join(f'<polyline class="p-seg" points="{s["p"]}" pathLength="1" data-d0="{s["d0"]}" data-d1="{s["d1"]}"/>' for s in tr['segs'])
off={'Jour 1':(22,-26,'start'),'Jour 2':(24,-24,'start'),'Jour 3':(-22,52,'end'),'Jour 4':(-22,52,'end'),'Jour 5':(-22,-28,'end')}
stops=''
for i,s in enumerate(tr['stops']):
    dx,dy,anc=off[s['jour']]
    stops+=f'<g id="p-st{i+1}" class="p-st"><circle cx="{s["x"]}" cy="{s["y"]}" r="10"/><text x="{s["x"]+dx}" y="{s["y"]+dy}" text-anchor="{anc}">{s["jour"]}</text></g>'
segs_js=json.dumps([[s['d0'],s['d1']] for s in tr['segs']])
stops_js=json.dumps([s['d'] for s in tr['stops']])
keys_js=json.dumps([[k['t'],k['s'],k['r'],k['x'],k['y']] for k in keys if 1.45<=k['t']<=2.34])
html=f'''<template>
  <style>
    #root {{ position:absolute; inset:0; overflow:hidden; background:#000; }}
    #p-vid {{ position:absolute; left:0; top:0; width:1080px; height:1920px; }}
    #p-push {{ position:absolute; inset:0; transform-origin:540px 960px; }}
    #p-ov {{ position:absolute; left:0; top:0; width:1080px; height:1920px; transform-origin:0 0; }}
    #p-ov svg {{ position:absolute; left:0; top:0; overflow:visible; }}
    #p-halo polyline {{ fill:none; stroke:rgba(233,197,149,0.55); stroke-width:16; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; }}
    #p-lines polyline {{ fill:none; stroke:#F3D7A8; stroke-width:5; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:1 1; stroke-dashoffset:1; vector-effect:non-scaling-stroke; }}
    #root .p-st circle {{ fill:#FAF8F5; stroke:#D0A070; stroke-width:5; }}
    #root .p-st text {{ font-family:"JetBrains Mono",monospace; font-size:30px; fill:#FAF8F5; paint-order:stroke; stroke:rgba(6,18,12,0.55); stroke-width:6px; }}
    #p-shade {{ position:absolute; inset:0; background:linear-gradient(180deg, rgba(6,18,12,0.55) 0%, rgba(6,18,12,0) 32%, rgba(6,18,12,0) 72%, rgba(6,18,12,0.45) 100%); opacity:0; }}
    #p-lab {{ position:absolute; left:0; right:0; top:420px; text-align:center; font-family:"JetBrains Mono",monospace; font-size:36px; letter-spacing:0.02em; color:#FAF8F5; text-shadow:0 2px 18px rgba(6,18,12,0.7); white-space:pre; opacity:0; }}
  </style>
  <div id="root" data-composition-id="plan" data-width="1080" data-height="1920">
    <div id="p-push">
      <video id="p-vid" class="clip" src="assets/map/plongee.mp4" muted playsinline data-start="0" data-duration="3.333" data-track-index="1"></video>
      <div id="p-ov">
        <svg width="1080" height="1920" viewBox="0 0 1080 1920">
          <defs><filter id="p-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter></defs>
          <g id="p-halo" filter="url(#p-blur)" opacity="0">{halo}</g>
          <g id="p-lines">{lines}</g>
          <g id="p-stops">{stops}</g>
        </svg>
      </div>
    </div>
    <div id="p-shade"></div>
    <div id="p-lab" data-var-text="plan_titre">\\ 5 jours · 72 km \\</div>
  </div>
  <script>
    (function () {{
      const tl = gsap.timeline({{ paused: true }});
      const F = 1 / 30, T0 = {T0}, TD = {TD}, DMAX = {dmax};
      // Le tracé suit la caméra pendant la descente : une similitude par image (calculée depuis la projection réelle).
      const K = {keys_js};
      gsap.set("#p-ov", {{ transformOrigin: "0 0", x: K[0][3], y: K[0][4], scale: K[0][1], rotation: K[0][2] }});
      K.forEach((k) => tl.set("#p-ov", {{ x: k[3], y: k[4], scale: k[1], rotation: k[2] }}, k[0]));
      // Dessin du W : chaque tronçon part quand le parcours l'atteint (distance réelle depuis le refuge Grey).
      const segs = {segs_js};
      const els = gsap.utils.toArray("#p-lines polyline");
      els.forEach((el, i) => {{
        const a = T0 + (segs[i][0] / DMAX) * TD, b = T0 + (segs[i][1] / DMAX) * TD;
        tl.fromTo(el, {{ strokeDashoffset: 1 }}, {{ strokeDashoffset: 0, duration: Math.max(b - a, F), ease: "none", immediateRender: false }}, a);
      }});
      tl.fromTo("#p-halo", {{ opacity: 0 }}, {{ opacity: 0.9, duration: 0.5, ease: "sine.out" }}, T0 + TD - 0.25);
      // Les cinq jours s'allument quand le tracé les atteint.
      const st = {stops_js};
      st.forEach((d, i) => {{
        const t = T0 + (d / DMAX) * TD;
        tl.fromTo("#p-st" + (i + 1), {{ opacity: 0, scale: 0.6, transformOrigin: "50% 50%" }}, {{ opacity: 1, scale: 1, duration: 4 * F, ease: "power2.out", immediateRender: false }}, t);
      }});
      gsap.set(".p-st", {{ opacity: 0 }});
      tl.fromTo("#p-shade", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6, ease: "sine.out" }}, 1.9);
      tl.set("#p-lab", {{ opacity: 1 }}, 2.0);
      // Une respiration de caméra après l'arrivée.
      tl.fromTo("#p-push", {{ scale: 1 }}, {{ scale: 1.035, duration: 1.0, ease: "sine.inOut" }}, 2.333);
      window.__timelines = window.__timelines || {{}};
      window.__timelines["plan"] = tl;
    }})();
  </script>
</template>
'''
open(os.path.join(ROOT,'compositions/plan.html'),'w').write(html)
print('plan.html', len(html))
