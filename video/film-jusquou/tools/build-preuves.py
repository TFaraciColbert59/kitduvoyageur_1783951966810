# Écrit compositions/preuves.html : le W vu du ciel avec son tracé réel, puis 13 preuves de carnet de bord
# dont la durée raccourcit (de 1,5 à 0,5 temps à 90 BPM) avant le sommet (les Torres, 2 temps).
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = 60 / 90
plan = open(os.path.join(ROOT, '..', 'film-planif', 'compositions', 'plan.html')).read()
lines = re.search(r'<g id="p-lines">.*?</g>', plan, re.S).group(0).replace('p-lines', 'w-lines').replace('p-seg', 'w-seg')
halo = re.search(r'<g id="p-halo".*?</g>', plan, re.S).group(0).replace('p-halo', 'w-halo').replace('url(#p-blur)', 'url(#w-blur)')
stops = re.findall(r'<circle cx="([\d.]+)" cy="([\d.]+)" r="10"/>', plan)

# (numéro d'image, durée en temps, légende, mouvement de caméra)
P = [(12, 1.5, 'Chili · sans-visa', 'in'), (7, 1.5, 'Bus · Puerto-Natales · 7h30', 'drift'),
     (8, 1.5, 'Catamaran · Pehoé · 9h', 'in'), (9, 1.5, 'Refugio-Grey · nuit-1', 'out'),
     (10, 1.0, 'Source · km-23', 'in'), (11, 1.0, 'Météo · mardi-6h · vent-40', 'up'),
     (13, 1.0, 'Sac · 9,4-kg', 'rot'), (14, 0.75, '1-398-€ · chacun', 'in'),
     (18, 0.5, 'Mirador-Británico · km-34', 'down'), (17, 0.5, 'Guanacos · km-61', 'in'),
     (15, 0.5, 'Carte · hors-ligne', 'out'), (16, 1.25, 'Maman · en-direct', 'in'),
     (19, 2.0, 'Torres · aube · 4h50', 'rise')]
LABTOP = {14: 560}  # légende déplacée quand le centre de l'image est trop clair
ALT = {12: 'Passeport sur la tablette, les Andes par le hublot', 7: 'Maya endormie contre la vitre du bus',
       8: 'Tom sur le pont du catamaran', 9: 'Fenêtre éclairée du refuge, chaussures qui sèchent',
       10: "Gourde sous un filet d'eau glaciaire", 11: 'Nuage lenticulaire vu depuis la tente', 13: 'Le contenu du sac, vu du dessus',
       14: 'Trois tasses qui trinquent', 18: 'Un condor sous la falaise', 17: "Portrait d'un guanaco",
       15: 'Tente éclairée sous la Voie lactée', 16: 'Hélène sourit en suivant sa fille', 19: 'Les trois amis face aux Torres à l’aube'}
T0 = 2 * B  # le W dure 2 temps
clips, js = [], []
t = T0
for k, (n, beats, lab, mv) in enumerate(P, 1):
    d = beats * B; s = round(t, 3); dd = round(d, 3)
    lt = f' style="top:{LABTOP[n]}px"' if n in LABTOP else ''
    clips.append(f'''    <div id="e{k}" class="clip e-shot" data-start="{s}" data-duration="{dd}" data-track-index="{1 + k % 2}">
      <div id="e{k}-cam" class="e-cam"><div id="e{k}-hand" class="e-hand"><img src="assets/prep/{n:02d}.jpg" alt="{ALT[n]}"></div></div>
      <div id="e{k}-l" class="e-lab" data-layout-allow-safe-zone{lt}>\\ {lab} \\</div>
    </div>''')
    m = {'in': ('{ scale: 1.03 }', '{ scale: 1.09'), 'out': ('{ scale: 1.1 }', '{ scale: 1.04'),
         'drift': ('{ x: -30, scale: 1.06 }', '{ x: 26, scale: 1.07'), 'up': ('{ y: 40, scale: 1.06 }', '{ y: -30, scale: 1.06'),
         'down': ('{ y: -40, scale: 1.07 }', '{ y: 40, scale: 1.09'), 'rot': ('{ rotation: -1.2, scale: 1.06 }', '{ rotation: 1.2, scale: 1.09'),
         'rise': ('{ y: 30, scale: 1.02 }', '{ y: -20, scale: 1.08')}[mv]
    js.append(f'      tl.fromTo("#e{k}-cam", {m[0]}, {m[1]}, duration: {dd}, ease: "none" }}, {s});')
    js.append(f'      hand("#e{k}-hand", {s}, {dd}, {6 if beats < 1.5 else 4}, {k * 1.9:.1f});')
    t += d
TOTAL = round(t, 3)
stop_svg = ''.join(f'<circle class="w-st" cx="{x}" cy="{y}" r="11"/>' for x, y in stops)
html = f'''<template>
  <style>
    #root {{ position:absolute; inset:0; overflow:hidden; background:#06120C; }}
    #root .e-shot {{ position:absolute; inset:0; overflow:hidden; background:#06120C; }}
    #root .e-cam, #root .e-hand {{ position:absolute; inset:0; transform-origin:50% 50%; }}
    #root .e-hand img {{ position:absolute; left:-54px; top:-96px; width:1188px; height:2112px; }}
    #root .e-shot::after {{ content:''; position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse 66% 8% at 50% 50.1%, rgba(6,18,12,0.32), rgba(6,18,12,0) 100%); }}
    #root .e-lab {{ position:absolute; z-index:2; left:0; right:0; margin:0 auto; width:fit-content; top:938px; text-align:center; font-family:"JetBrains Mono",monospace; font-weight:400; font-size:34px; line-height:44px; letter-spacing:0.01em; color:#FAF8F5; white-space:pre; text-shadow:0 2px 22px rgba(6,18,12,0.8), 0 0 3px rgba(6,18,12,0.5); }}
    #w-cam {{ position:absolute; inset:0; transform-origin:540px 960px; }}
    #w-img {{ position:absolute; left:0; top:0; width:1080px; height:1920px; }}
    #w-ov {{ position:absolute; left:0; top:0; overflow:visible; }}
    #w-halo polyline {{ fill:none; stroke:rgba(233,197,149,0.55); stroke-width:16; stroke-linecap:round; stroke-linejoin:round; }}
    #w-lines polyline {{ fill:none; stroke:#F3D7A8; stroke-width:5; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:1 1; stroke-dashoffset:1; }}
    #root .w-st {{ fill:#FAF8F5; stroke:#D0A070; stroke-width:5; opacity:0; }}
    #w-lab {{ position:absolute; left:0; right:0; margin:0 auto; width:fit-content; top:420px; text-align:center; font-family:"JetBrains Mono",monospace; font-size:34px; color:#FAF8F5; white-space:pre; text-shadow:0 2px 22px rgba(6,18,12,0.8); opacity:0; }}
  </style>
  <div id="root" data-composition-id="preuves" data-width="1080" data-height="1920">
    <div id="w" class="clip e-shot" data-start="0" data-duration="{round(T0, 3)}" data-track-index="1">
      <div id="w-cam"><img id="w-img" src="assets/map/w.png" alt="Le W de Torres del Paine vu du satellite">
        <svg id="w-ov" width="1080" height="1920" viewBox="0 0 1080 1920">
          <defs><filter id="w-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter></defs>
          {halo}
          {lines}
          <g id="w-stops">{stop_svg}</g>
        </svg>
      </div>
      <div id="w-lab">\\ Le-W · 5-jours · 72-km \\</div>
    </div>
{chr(10).join(clips)}
  </div>
  <script>
    (function () {{
      const tl = gsap.timeline({{ paused: true }});
      const F = 1 / 30;
      function hand(sel, t0, dur, amp, seed) {{
        for (let t = 0; t < dur - 1e-6; t += 2 * F) {{
          const u = t + seed;
          tl.set(sel, {{ x: amp * (0.6 * Math.sin(u * 1.7) + 0.4 * Math.sin(u * 3.3)),
                        y: amp * (0.6 * Math.sin(u * 1.3 + 1) + 0.4 * Math.sin(u * 2.9)),
                        rotation: amp * 0.018 * Math.sin(u * 1.1) }}, t0 + t);
        }}
      }}
      // Le W : coupe nette depuis la Terre, le tracé laiton se dessine en 0,8 s, les cinq étapes s'allument.
      tl.fromTo("#w-cam", {{ scale: 1.12 }}, {{ scale: 1.0, duration: {round(T0, 3)}, ease: "power2.out" }}, 0);
      const segs = gsap.utils.toArray("#w-lines .w-seg");
      const dmax = Math.max(...segs.map((s) => +s.dataset.d1));
      segs.forEach((s) => tl.to(s, {{ strokeDashoffset: 0, duration: Math.max(F, (s.dataset.d1 - s.dataset.d0) / dmax * 0.8), ease: "none" }}, 0.12 + s.dataset.d0 / dmax * 0.8));
      tl.fromTo("#w-halo", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.5 }}, 0.5);
      gsap.utils.toArray("#w-stops .w-st").forEach((c, i) => tl.to(c, {{ opacity: 1, duration: 2 * F }}, 0.12 + [0, 0.2, 0.4, 0.62, 0.8][i]));
      tl.set("#w-lab", {{ opacity: 1 }}, 0.1);
      // Les preuves : poussées et glissements alternés, caméra à l'épaule, légende posée sans effet.
{chr(10).join(js)}
      window.__timelines = window.__timelines || {{}};
      window.__timelines["preuves"] = tl;
    }})();
  </script>
</template>
'''
open(os.path.join(ROOT, 'compositions', 'preuves.html'), 'w').write(html)
print('preuves.html', TOTAL, 's,', len(P), 'preuves +W,', len(stops), 'étapes')
