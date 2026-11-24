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
# recadrage vertical de chaque plan dans la zone haute (au-dessus de la Terre), en px
OFF = {12: -400, 7: -360, 8: -560, 9: -560, 10: -440, 11: -260, 13: -300, 14: -420, 18: -150, 17: -200, 15: -760, 16: -300, 19: -280}
ALT = {12: 'Passeport sur la tablette, les Andes par le hublot', 7: 'Maya endormie contre la vitre du bus',
       8: 'Tom sur le pont du catamaran', 9: 'Fenêtre éclairée du refuge, chaussures qui sèchent',
       10: "Gourde sous un filet d'eau glaciaire", 11: 'Nuage lenticulaire vu depuis la tente', 13: 'Le contenu du sac, vu du dessus',
       14: 'Trois tasses qui trinquent', 18: 'Un condor sous la falaise', 17: "Portrait d'un guanaco",
       15: 'Tente éclairée sous la Voie lactée', 16: 'Hélène sourit en suivant sa fille', 19: 'Les trois amis face aux Torres à l’aube'}
T0 = 2 * B  # le W dure 2 temps
clips, js, vids = [], [], []
t = T0
for k, (n, beats, lab, mv) in enumerate(P, 1):
    d = beats * B; s = round(t, 3); dd = round(d, 3)
    vids.append(f'''      <video id="e{k}-v" class="clip e-v" style="top:{OFF[n]}px" src="assets/shots/{n:02d}.mp4" muted playsinline data-start="{s}" data-duration="{dd}" data-track-index="{1 + k % 2}" aria-label="{ALT[n]}"></video>''')
    clips.append(f'''    <div id="e{k}-l" class="clip e-lab" data-start="{s}" data-duration="{dd}" data-track-index="4" data-layout-allow-safe-zone>\\ {lab} \\</div>''')
    m = {'in': ('{ scale: 1.03 }', '{ scale: 1.09'), 'out': ('{ scale: 1.1 }', '{ scale: 1.04'),
         'drift': ('{ x: -30, scale: 1.06 }', '{ x: 26, scale: 1.07'), 'up': ('{ y: 40, scale: 1.06 }', '{ y: -30, scale: 1.06'),
         'down': ('{ y: -40, scale: 1.07 }', '{ y: 40, scale: 1.09'), 'rot': ('{ rotation: -1.2, scale: 1.06 }', '{ rotation: 1.2, scale: 1.09'),
         'rise': ('{ y: 30, scale: 1.02 }', '{ y: -20, scale: 1.08')}[mv]
    t += d
TOTAL = round(t, 3)
stop_svg = ''.join(f'<circle class="w-st" cx="{x}" cy="{y}" r="11"/>' for x, y in stops)
html = f'''<template>
  <style>
    #root {{ position:absolute; inset:0; overflow:hidden; background:transparent; }}
    #e-scene {{ position:absolute; left:0; top:0; width:1080px; height:1190px; overflow:hidden; -webkit-mask-image:linear-gradient(to bottom, #000 0, #000 860px, transparent 1130px); mask-image:linear-gradient(to bottom, #000 0, #000 860px, transparent 1130px); }}
    #root .e-shot {{ position:absolute; inset:0; overflow:hidden; background:#06120C; }}
    #root .e-cam {{ position:absolute; inset:0; }}
    #root .e-v {{ position:absolute; left:0; width:1080px; height:1920px; }}
    #root .e-lab {{ position:absolute; z-index:2; left:0; right:0; margin:0 auto; width:fit-content; top:1086px; text-align:center; font-family:"JetBrains Mono",monospace; font-weight:400; font-size:34px; line-height:44px; letter-spacing:0.01em; color:#FAF8F5; white-space:pre; text-shadow:0 2px 22px rgba(6,18,12,0.8), 0 0 3px rgba(6,18,12,0.5); }}
    #w-cam {{ position:absolute; left:0; top:-480px; width:1080px; height:1920px; transform-origin:540px 960px; }}
    #w-img {{ position:absolute; left:0; top:0; width:1080px; height:1920px; }}
    #w-ov {{ position:absolute; left:0; top:0; overflow:visible; }}
    #w-halo polyline {{ fill:none; stroke:rgba(233,197,149,0.55); stroke-width:16; stroke-linecap:round; stroke-linejoin:round; }}
    #w-lines polyline {{ fill:none; stroke:#F3D7A8; stroke-width:5; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:1 1; stroke-dashoffset:1; }}
    #root .w-st {{ fill:#FAF8F5; stroke:#D0A070; stroke-width:5; opacity:0; }}
    #w-lab {{ position:absolute; left:0; right:0; margin:0 auto; width:fit-content; top:1086px; text-align:center; font-family:"JetBrains Mono",monospace; font-size:34px; color:#FAF8F5; white-space:pre; text-shadow:0 2px 22px rgba(6,18,12,0.8); opacity:0; }}
  </style>
  <div id="root" data-composition-id="preuves" data-width="1080" data-height="1920">
    <div id="e-scene">
{chr(10).join(vids)}
    </div>
    <div id="w-lab" class="clip" data-start="0" data-duration="{round(T0, 3)}" data-track-index="4" data-layout-allow-safe-zone>\\ Paris → Torres-del-Paine · 14 200 km \\</div>
{chr(10).join(clips)}
  </div>
  <script>
    (function () {{
      const tl = gsap.timeline({{ paused: true }});
      const F = 1 / 30;
      tl.set("#w-lab", {{ opacity: 1 }}, 0.25);
      // Les preuves : plans animés (vidéos), légende posée sans effet.
{chr(10).join(js)}
      window.__timelines = window.__timelines || {{}};
      window.__timelines["preuves"] = tl;
    }})();
  </script>
</template>
'''
open(os.path.join(ROOT, 'compositions', 'preuves.html'), 'w').write(html)
print('preuves.html', TOTAL, 's,', len(P), 'preuves +W,', len(stops), 'étapes')
