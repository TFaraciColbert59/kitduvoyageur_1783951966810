# Écrit compositions/carte.html : la carte vivante posée sur la Terre (calque séparé de la vidéo du globe).
# À chaque preuve, un repère apparaît à l'endroit exact du voyage et y reste (la carte garde la mémoire) :
# nuits, rencontre, source, météo, sac, budget, Pokédex (condor, guanaco), suivi en direct, sommet.
# Pendant la plongée, l'avion, le bus puis le bateau suivent le point du voyage.
# Positions : assets/earth/points.json (tools/earth_points.py, même caméra que tools/earth.py).
import os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = json.load(open(os.path.join(ROOT, 'assets', 'earth', 'points.json')))
F = P['fixed']

# Icônes (traits ivoire/laiton, 24 × 24)
ICON = {
    'moon': '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.4A7 7 0 0 1 15.5 3.5z" fill="#F3D7A8"/>',
    'people': '<circle cx="8" cy="8" r="3.2" fill="#F3D7A8"/><circle cx="16.5" cy="9" r="2.8" fill="#F3D7A8"/><path d="M2.5 20c.6-4 3-6 5.5-6s4.9 2 5.5 6M12.5 20c.4-3.2 2.2-4.8 4-4.8s3.6 1.6 4 4.8" fill="none" stroke="#F3D7A8" stroke-width="1.8" stroke-linecap="round"/>',
    'drop': '<path d="M12 3c3.5 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.4 6-11z" fill="#9EC9D9"/>',
    'wind': '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7" fill="none" stroke="#F3D7A8" stroke-width="2" stroke-linecap="round"/>',
    'pack': '<rect x="6" y="6" width="12" height="15" rx="3.5" fill="none" stroke="#F3D7A8" stroke-width="2"/><path d="M9 6V4.5a3 3 0 0 1 6 0V6M9 13h6" fill="none" stroke="#F3D7A8" stroke-width="2" stroke-linecap="round"/>',
    'euro': '<path d="M17.5 6.5A7 7 0 1 0 17.5 17.5M4 10.5h9M4 13.5h9" fill="none" stroke="#F3D7A8" stroke-width="2" stroke-linecap="round"/>',
    'offline': '<path d="M3 9.5a13 13 0 0 1 18 0M6.5 13a8 8 0 0 1 11 0M10 16.5a3 3 0 0 1 4 0M4 4l16 16" fill="none" stroke="#F3D7A8" stroke-width="2" stroke-linecap="round"/>',
    'live': '<circle cx="12" cy="12" r="3.5" fill="#E07A5F"/><path d="M6.5 6.5a8 8 0 0 0 0 11M17.5 6.5a8 8 0 0 1 0 11" fill="none" stroke="#F3D7A8" stroke-width="2" stroke-linecap="round"/>',
    'flag': '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6" fill="none" stroke="#F3D7A8" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
    'plane': '<path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-6z" fill="#F3D7A8"/>',
    'bus': '<rect x="4" y="4" width="16" height="14" rx="3" fill="none" stroke="#F3D7A8" stroke-width="2"/><path d="M4 11h16M7.5 18v2.5M16.5 18v2.5" stroke="#F3D7A8" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="14.5" r="1.2" fill="#F3D7A8"/><circle cx="16" cy="14.5" r="1.2" fill="#F3D7A8"/>',
    'boat': '<path d="M3 15h18l-2.5 4.5h-13zM12 4v11M12 5l6 8h-6" fill="none" stroke="#F3D7A8" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',
}
def svg(name, size=26): return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" aria-hidden="true">{ICON[name]}</svg>'

# (temps, type, icône, texte, lieu, position de l'étiquette x, y, durée d'affichage de l'étiquette)
EV = [  # textes complémentaires des légendes du haut (pas de redite)
    (17.70, 'pin', 'moon', 'Nuit 1', 'grey', 40, 1330, 1.3),
    (18.10, 'pin', 'people', 'Inès et Paulo · même trek', 'grey', 40, 1394, 1.3),
    (18.70, 'pin', 'drop', 'Eau potable', 'source', 40, 1700, 1.1),
    (19.35, 'pin', 'wind', 'Départ 6 h · fenêtre météo', 'pgrande', 60, 1800, 1.2),
    (20.02, 'pin', 'pack', 'Rien d’oublié', 'sac', 40, 1640, 1.0),
    (20.69, 'pin', 'moon', 'Nuit 2', 'italiano', 610, 1700, 1.1),
    (20.85, 'pin', 'euro', 'Partagé à 3', 'italiano', 610, 1762, 1.0),
    (21.19, 'dex', 'condor', 'Condor des Andes', 'britanico', 250, 1255, 0.9),
    (21.69, 'dex', 'guanaco', 'Guanaco', 'guanacos', 700, 1500, 0.75),
    (22.02, 'pin', 'moon', 'Nuit 3', 'cuernos', 680, 1660, 0.9),
    (22.10, 'pin', 'offline', 'Carte téléchargée', 'cuernos', 680, 1722, 0.8),
    (22.35, 'live', 'live', 'Hélène · à 13 000 km', 'chileno', 740, 1290, 0.65),
    (22.40, 'pin', 'moon', 'Nuit 4', 'chileno', 800, 1460, 0.9),
    (23.02, 'pin', 'flag', 'Arrivés', 'torres', 520, 1250, 1.3),
]
HUD = [(14.70, 15.62, 'plane', 'Vol · Paris → Punta Arenas'), (15.69, 16.62, 'bus', 'Puerto Natales → Pudeto · 2 h'),
       (16.69, 17.62, 'boat', 'Lac Pehoé · 30 min')]

els, js = [], []
for i, (t, kind, ic, txt, place, cx, cy, hold) in enumerate(EV):
    x, y, _ = F[place]
    if kind == 'dex':
        els.append(f'''    <div id="k{i}-m" class="k-dex" style="left:{x - 30:.0f}px; top:{y - 30:.0f}px"><img src="assets/img/dex-{ic}.jpg" alt=""></div>
    <div id="k{i}-c" class="k-card" data-layout-allow-safe-zone style="left:{cx}px; top:{cy}px"><img src="assets/img/dex-{ic}.jpg" alt="{txt}"><div><div class="k-tag">Pokédex · vu</div><div class="k-name">{txt}</div></div></div>''')
        js.append(f'      pop("#k{i}-c", {t}); tl.to("#k{i}-c", {{ opacity: 0, scale: 0.9, duration: 0.25, ease: "sine.in" }}, {t + hold});')
        js.append(f'      tl.fromTo("#k{i}-m", {{ opacity: 0, scale: 0.3 }}, {{ opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }}, {t + 0.15});')
    else:
        els.append(f'''    <div id="k{i}-m" class="k-pin{' k-live' if kind == 'live' else ''}" style="left:{x - 17:.0f}px; top:{y - 17:.0f}px">{svg(ic, 20)}</div>
    <div id="k{i}-c" class="k-chip" data-layout-allow-safe-zone style="left:{cx}px; top:{cy}px">{svg(ic)}<span>{txt}</span></div>''')
        js.append(f'      pop("#k{i}-c", {t}); tl.to("#k{i}-c", {{ opacity: 0, duration: 0.25, ease: "sine.in" }}, {t + hold});')
        js.append(f'      tl.fromTo("#k{i}-m", {{ opacity: 0, scale: 0.3 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }}, {t});')
    if kind == 'live':
        for r in range(3):
            els.append(f'    <div id="k{i}-r{r}" class="k-ring" style="left:{x - 40:.0f}px; top:{y - 40:.0f}px"></div>')
            js.append(f'      tl.fromTo("#k{i}-r{r}", {{ opacity: 0.9, scale: 0.3 }}, {{ opacity: 0, scale: 2.2, duration: 0.9, ease: "sine.out" }}, {t + r * 0.22});')

for j, (a, b, ic, txt) in enumerate(HUD):
    els.append(f'    <div id="h{j}" class="k-chip k-hud" data-layout-allow-safe-zone>{svg(ic)}<span>{txt}</span></div>')
    js.append(f'      pop("#h{j}", {a}); tl.to("#h{j}", {{ opacity: 0, duration: 0.2 }}, {b});')
# icône de transport qui suit le point du voyage pendant la plongée
for v in ('plane', 'bus', 'boat'):
    els.append(f'    <div id="k-veh-{v}" class="k-veh">{svg(v, 30)}</div>')
tr = sorted(((float(k), v) for k, v in P['track'].items()), key=lambda kv: kv[0])
veh = []
for t, (x, y, vis) in tr:
    ic = 'plane' if t < 15.65 else ('bus' if t < 16.65 else 'boat')
    veh.append((round(t, 3), round(x), round(y), 1 if vis and 14.67 <= t < 17.65 else 0, ic))
js.append(f'      const V = {json.dumps(veh)};')
js.append('''      V.forEach(([t, x, y, on, ic]) => ["plane", "bus", "boat"].forEach((k) => tl.set("#k-veh-" + k, { x: x - 25, y: y - 62, opacity: on && k === ic ? 1 : 0 }, t)));''')

html = f'''<template>
  <style>
    #root {{ position:absolute; inset:0; overflow:hidden; background:transparent; pointer-events:none; }}
    #root .k-chip {{ position:absolute; display:flex; align-items:center; gap:10px; height:52px; padding:0 20px 0 13px; border-radius:26px;
      background:rgba(11,31,23,0.82); border:1.5px solid rgba(208,160,112,0.65); box-shadow:0 6px 22px rgba(6,18,12,0.55);
      font-family:"Inter",sans-serif; font-weight:600; font-size:26px; letter-spacing:0.01em; color:#FAF8F5; white-space:nowrap; opacity:0; transform-origin:0 50%; }}
    #root .k-hud {{ left:0; right:0; margin:0 auto; width:fit-content; top:1262px; transform-origin:50% 50%; }}
    #root .k-pin {{ position:absolute; width:34px; height:34px; border-radius:17px; display:flex; align-items:center; justify-content:center;
      background:rgba(11,31,23,0.86); border:2px solid #D0A070; box-shadow:0 2px 10px rgba(6,18,12,0.6); opacity:0; }}
    #root .k-live {{ border-color:#E07A5F; }}
    #root .k-ring {{ position:absolute; width:80px; height:80px; border-radius:40px; border:3px solid #E07A5F; opacity:0; }}
    #root .k-dex {{ position:absolute; width:60px; height:60px; border-radius:30px; overflow:hidden; border:3px solid #D0A070; box-shadow:0 3px 12px rgba(6,18,12,0.6); opacity:0; }}
    #root .k-dex img {{ width:100%; height:100%; object-fit:cover; display:block; }}
    #root .k-card {{ position:absolute; display:flex; align-items:center; gap:14px; padding:10px 20px 10px 10px; border-radius:20px;
      background:rgba(11,31,23,0.86); border:1.5px solid rgba(208,160,112,0.7); box-shadow:0 8px 26px rgba(6,18,12,0.6); opacity:0; transform-origin:0 50%; }}
    #root .k-card img {{ width:96px; height:96px; border-radius:14px; object-fit:cover; display:block; }}
    #root .k-tag {{ font-family:"Inter",sans-serif; font-weight:700; font-size:18px; letter-spacing:0.14em; text-transform:uppercase; color:#D0A070; }}
    #root .k-name {{ font-family:"Inter",sans-serif; font-weight:600; font-size:30px; color:#FAF8F5; margin-top:4px; white-space:nowrap; }}
    #root .k-veh {{ position:absolute; left:0; top:0; width:50px; height:50px; border-radius:25px; display:flex; align-items:center; justify-content:center;
      background:rgba(11,31,23,0.88); border:2px solid #D0A070; opacity:0; }}
  </style>
  <div id="root" data-composition-id="carte" data-width="1080" data-height="1920">
{chr(10).join(els)}
  </div>
  <script>
    (function () {{
      const tl = gsap.timeline({{ paused: true }});
      function pop(sel, t) {{ tl.fromTo(sel, {{ opacity: 0, scale: 0.7 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.8)" }}, t); }}
{chr(10).join(js)}
      window.__timelines = window.__timelines || {{}};
      window.__timelines["carte"] = tl;
    }})();
  </script>
</template>
'''
open(os.path.join(ROOT, 'compositions', 'carte.html'), 'w').write(html)
print('carte.html', len(EV), 'repères,', len(HUD), 'trajets,', len(veh), 'positions du véhicule')
