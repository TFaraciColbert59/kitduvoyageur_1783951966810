# Écrit compositions/acteA.html (0 → 10,667 s) : l'accroche, le Compas, « prépare tout », l'itinéraire.
# Tracé du W : OpenStreetMap (relation 2203617, ODbL), repris de film-planif/assets/map/trace.json.
import os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TR = json.load(open(os.path.join(ROOT, '..', 'film-planif', 'assets', 'map', 'trace.json')))
OX, OY, SC = 60, 600, 940 / 960          # recadrage de la carte (carte-w.png) puis mise à l'échelle dans la fiche

def pts(p):
    return ' '.join(f'{(float(x) - OX) * SC:.1f},{(float(y) - OY) * SC:.1f}' for x, y in (q.split(',') for q in p.split()))
segs = ''.join(f'<polyline class="a-seg" points="{pts(s["p"])}" pathLength="1" data-d0="{s["d0"]}" data-d1="{s["d1"]}"/>' for s in TR['segs'])
DMAX = TR['dmax']
NOMS = ['Grey', 'Paine Grande', 'Los Cuernos', 'Chileno', 'Base Torres']
pins = ''
for k, st in enumerate(TR['stops']):
    x, y = (st['x'] - OX) * SC, (st['y'] - OY) * SC
    pins += f'<g id="a-pin{k}" class="a-pin" data-d="{st["d"]}"><circle cx="{x:.1f}" cy="{y:.1f}" r="22" fill="#17402C" stroke="#FAF8F5" stroke-width="5"/><text x="{x:.1f}" y="{y + 9:.1f}" text-anchor="middle">J{k + 1}</text></g>'

TUILES = [('Itinéraire', '5 jours · 72 km', 'M4 18 L9 6 L13 13 L16 9 L20 18 Z'),
          ('Refuges', '4 nuits réservées', 'M3 11 L12 4 L21 11 V20 H3 Z M9 20 V14 H15 V20'),
          ('Météo', 'Fenêtre mardi 6 h', 'M7 15 a4 4 0 0 1 1-7.9 5 5 0 0 1 9.6 1.4 3.5 3.5 0 0 1-.6 6.5 Z'),
          ('Sac', '9,4 kg au total', 'M7 7 H17 a3 3 0 0 1 3 3 V20 H4 V10 a3 3 0 0 1 3-3 Z M9 7 V5 a3 3 0 0 1 6 0 V7'),
          ('Budget', '1 398 € chacun', 'M17 6.5 A7 7 0 1 0 17 17.5 M4 10.5 H13 M4 13.5 H13'),
          ('Hors ligne', 'Carte téléchargée', 'M12 3 V15 M7 10 L12 15 L17 10 M5 20 H19')]
tiles = ''
for i, (t, s, d) in enumerate(TUILES):
    x = 60 if i % 2 == 0 else 555; y = 540 + (i // 2) * 222
    tiles += f'''<div id="a-t{i}" class="a-tile" style="left:{x}px; top:{y}px"><div class="a-ti"><svg width="40" height="40" viewBox="0 0 24 24"><path d="{d}" fill="none" stroke="#17402C" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/></svg></div><div><div class="a-tt">{t}</div><div class="a-ts">{s}</div></div><div id="a-tc{i}" class="a-tc"><svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 12.5 L10 17 L19 7" fill="none" stroke="#FAF8F5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
'''
PHRASE = "5 jours dans le W, à trois, en novembre"
typed = ''.join(f'<span class="a-ch">{c if c != " " else "&nbsp;"}</span>' for c in PHRASE)

html = f'''<template>
  <style>
    #root {{ position:absolute; inset:0; overflow:hidden; }}
    #root .a-card {{ position:absolute; background:#FFFFFF; border-radius:36px; box-shadow:0 26px 60px rgba(11,31,23,0.16), 0 2px 8px rgba(11,31,23,0.08); border:1px solid rgba(11,31,23,0.06); }}
    #root .a-anton {{ font-family:"Anton",sans-serif; text-transform:uppercase; letter-spacing:0.01em; line-height:0.92; }}
    #root .a-stk {{ position:absolute; padding:10px 26px 14px; background:#B84A32; color:#FAF8F5; border-radius:14px; box-shadow:0 10px 24px rgba(11,31,23,0.22); font-family:"Anton",sans-serif; font-size:68px; line-height:1; text-transform:uppercase; opacity:0; }}
    #root .a-stk.ink {{ background:#0B1F17; }}
    /* 1 — accroche */
    #a-head {{ position:absolute; left:0; right:0; top:470px; text-align:center; font-size:176px; color:#0B1F17; }}
    #a-head span {{ display:inline-block; opacity:0; }}
    #a-under {{ position:absolute; left:300px; top:640px; width:480px; height:14px; background:#D0A070; border-radius:7px; transform-origin:0 50%; }}
    #a-phone {{ position:absolute; left:320px; top:700px; width:440px; height:800px; background:#0B1F17; border-radius:64px; padding:12px; box-shadow:0 34px 70px rgba(11,31,23,0.32); }}
    #a-phone img {{ width:416px; height:776px; border-radius:52px; object-fit:cover; display:block; }}
    #a-pill {{ position:absolute; left:40px; top:46px; padding:10px 18px; border-radius:20px; background:rgba(250,248,245,0.88); font-family:"Inter",sans-serif; font-weight:700; font-size:22px; color:#0B1F17; }}
    #a-pc {{ position:absolute; left:28px; right:28px; bottom:36px; padding:18px 20px; border-radius:26px; background:rgba(250,248,245,0.94); font-family:"Inter",sans-serif; }}
    #a-pc b {{ display:block; font-weight:800; font-size:28px; color:#0B1F17; }}
    #a-pc span {{ display:inline-block; margin:10px 8px 0 0; padding:6px 12px; border-radius:12px; background:#E4EADF; color:#17402C; font-weight:600; font-size:19px; }}
    #a-burst {{ position:absolute; left:0; top:0; }}
    /* 2 — le Compas */
    #a-compas {{ left:70px; width:940px; top:640px; height:400px; }}
    #a-ch1 {{ position:absolute; left:40px; top:34px; font-family:"Inter",sans-serif; font-weight:700; font-size:26px; color:#5F6E64; display:flex; align-items:center; gap:12px; }}
    #a-ou {{ position:absolute; right:40px; top:30px; padding:6px 16px; border-radius:14px; background:#E4EADF; font-family:"Inter",sans-serif; font-weight:700; font-size:22px; color:#17402C; }}
    #a-input {{ position:absolute; left:36px; right:36px; top:96px; height:128px; border-radius:24px; border:3px solid #17402C; padding:0 26px; display:flex; align-items:center; font-family:"Inter",sans-serif; font-weight:600; font-size:38px; color:#0B1F17; white-space:nowrap; overflow:hidden; }}
    #root .a-ch {{ opacity:0; }}
    #a-cur {{ display:inline-block; width:4px; height:46px; background:#17402C; margin-left:4px; }}
    #a-btn {{ position:absolute; left:36px; right:36px; top:262px; height:100px; border-radius:50px; background:#17402C; color:#FAF8F5; font-family:"Inter",sans-serif; font-weight:800; font-size:34px; display:flex; align-items:center; justify-content:center; gap:16px; opacity:0; }}
    #a-ripple {{ position:absolute; left:470px; top:312px; width:40px; height:40px; margin:-20px 0 0 -20px; border-radius:50%; background:rgba(250,248,245,0.5); opacity:0; }}
    /* 3 — prépare tout */
    #root .a-tile {{ position:absolute; width:465px; height:196px; background:#FFFFFF; border-radius:30px; box-shadow:0 18px 44px rgba(11,31,23,0.14); border:1px solid rgba(11,31,23,0.06); display:flex; align-items:center; gap:22px; padding:0 26px; opacity:0; }}
    #root .a-ti {{ width:78px; height:78px; border-radius:24px; background:#E4EADF; display:flex; align-items:center; justify-content:center; flex:none; }}
    #root .a-tt {{ font-family:"Inter",sans-serif; font-weight:800; font-size:34px; color:#0B1F17; }}
    #root .a-ts {{ font-family:"Inter",sans-serif; font-weight:600; font-size:24px; color:#5F6E64; margin-top:6px; white-space:nowrap; }}
    #root .a-tc {{ position:absolute; right:18px; top:18px; width:40px; height:40px; border-radius:20px; background:#17402C; display:flex; align-items:center; justify-content:center; opacity:0; }}
    /* 4 — itinéraire */
    #a-map {{ left:50px; width:980px; top:520px; height:880px; padding:20px; }}
    #a-mh {{ position:absolute; left:40px; top:34px; font-family:"Inter",sans-serif; font-weight:800; font-size:32px; color:#0B1F17; }}
    #a-mchip {{ position:absolute; right:40px; top:30px; padding:6px 16px; border-radius:14px; background:#E4EADF; font-family:"Inter",sans-serif; font-weight:700; font-size:22px; color:#17402C; }}
    #a-mapbox {{ position:absolute; left:20px; top:100px; width:940px; height:715px; border-radius:26px; overflow:hidden; }}
    #a-mapbox img {{ width:940px; height:715px; display:block; }}
    #a-mapsvg {{ position:absolute; left:0; top:0; overflow:visible; }}
    #root .a-seg {{ fill:none; stroke:#17402C; stroke-width:9; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:1 1; stroke-dashoffset:1; }}
    #root .a-pin {{ opacity:0; }}
    #root .a-pin text {{ font-family:"Inter",sans-serif; font-weight:800; font-size:22px; fill:#FAF8F5; }}
  </style>
  <div id="root" data-composition-id="acteA" data-width="1080" data-height="1920">
    <div id="a-s1" class="clip" data-start="0" data-duration="3.3" data-track-index="1">
      <div id="a-head" class="a-anton"><span>5</span><span>&nbsp;</span><span>j</span><span>o</span><span>u</span><span>r</span><span>s</span></div>
      <div id="a-under"></div>
      <div id="a-phone"><img src="assets/img/torres.jpg" alt="Les Torres à l'aube dans l'app"><div id="a-pill">Le W · Torres del Paine</div><div id="a-pc"><b>Ton aventure est prête</b><span>5 jours</span><span>72 km</span><span>4 refuges</span></div></div>
      <div id="a-stk1" class="a-stk" style="left:600px; top:650px; transform-origin:50% 50%">0 oubli</div>
      <svg id="a-burst" width="1080" height="1920" viewBox="0 0 1080 1920" aria-hidden="true"></svg>
    </div>
    <div id="a-s2" class="clip" data-start="3.3" data-duration="2.25" data-track-index="2">
      <div id="a-compas" class="a-card">
        <div id="a-ch1"><svg width="30" height="30" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#17402C" stroke-width="2"/><path d="M12 5 L14.5 12 L12 19 L9.5 12 Z" fill="#D0A070"/></svg>Compas</div>
        <div id="a-ou">Où ?</div>
        <div id="a-input">{typed}<span id="a-cur"></span></div>
        <div id="a-btn">Préparer mon aventure <span>→</span><div id="a-ripple"></div></div>
      </div>
    </div>
    <div id="a-s3" class="clip" data-start="5.1" data-duration="2.2" data-track-index="1">
{tiles}      <div id="a-stk3" class="a-stk" style="left:300px; top:1230px">Tout est prêt</div>
    </div>
    <div id="a-s4" class="clip" data-start="7.3" data-duration="3.367" data-track-index="2">
      <div id="a-map" class="a-card">
        <div id="a-mh">Itinéraire · Le W</div><div id="a-mchip">Torres del Paine</div>
        <div id="a-mapbox"><img src="assets/img/carte-w.png" alt="Carte du W en aplats">
          <svg id="a-mapsvg" width="940" height="715" viewBox="0 0 940 715" aria-hidden="true">{segs}{pins}</svg>
        </div>
      </div>
      <div id="a-stk4a" class="a-stk ink" style="left:90px; top:1340px">5 jours</div>
      <div id="a-stk4b" class="a-stk" style="left:700px; top:1330px"><span id="a-km">0</span> km</div>
    </div>
  </div>
  <script>
    (function () {{
      gsap.registerPlugin(MorphSVGPlugin);
      const tl = gsap.timeline({{ paused: true }});
      let s = 5; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const pop = (sel, t, from = {{ scale: 0.4 }}) => tl.fromTo(sel, {{ opacity: 0, ...from }}, {{ opacity: 1, scale: 1, rotation: 0, y: 0, x: 0, duration: 0.45, ease: "back.out(2.2)" }}, t);
      function burst(svgSel, cx, cy, t, n) {{
        const svg = document.querySelector(svgSel); const COL = ["#17402C", "#5B7F55", "#D0A070", "#E07A5F"];
        for (let i = 0; i < n; i++) {{
          const r = document.createElementNS("http://www.w3.org/2000/svg", "rect"); const a = rnd() * Math.PI * 2, d = 160 + rnd() * 360;
          r.setAttribute("x", cx - 6); r.setAttribute("y", cy - 3); r.setAttribute("width", 12 + rnd() * 8); r.setAttribute("height", 6); r.setAttribute("rx", 2); r.setAttribute("fill", COL[i % 4]); r.setAttribute("opacity", "0");
          svg.appendChild(r);
          tl.fromTo(r, {{ opacity: 1, x: 0, y: 0, rotation: 0 }}, {{ opacity: 0, x: d * Math.cos(a), y: d * Math.sin(a) + 120, rotation: (rnd() - 0.5) * 720, duration: 0.9, ease: "power3.out", svgOrigin: `${{cx}} ${{cy}}` }}, t);
        }}
      }}
      // 1 — accroche : « 5 JOURS » claque lettre par lettre, le téléphone monte avec les Torres, sticker « 0 OUBLI » sur « oublié »
      gsap.utils.toArray("#a-head span").forEach((el, i) => tl.fromTo(el, {{ opacity: 0, y: -90, scale: 1.5 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "back.out(2.6)" }}, 0.15 + i * 0.045));
      tl.fromTo("#a-under", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.4, ease: "expo.out" }}, 0.55);
      tl.fromTo("#a-phone", {{ y: 900, rotation: -8 }}, {{ y: 0, rotation: 0, duration: 0.75, ease: "back.out(1.4)" }}, 0.2);
      tl.to("#a-phone", {{ y: -14, rotation: 1.5, duration: 1.4, ease: "sine.inOut" }}, 1.0);
      burst("#a-burst", 540, 560, 0.35, 26);
      pop("#a-stk1", 2.2, {{ scale: 2.4, rotation: 18 }}); tl.to("#a-stk1", {{ rotation: 8, duration: 0.2 }}, 2.65);
      tl.to(["#a-head", "#a-under", "#a-stk1"], {{ y: -260, opacity: 0, duration: 0.22, ease: "power2.in" }}, 3.08);
      tl.to("#a-phone", {{ y: 1000, rotation: 10, duration: 0.3, ease: "power2.in" }}, 3.0);
      // 2 — le Compas : la fiche surgit, la phrase se tape lettre par lettre, le bouton arrive
      pop("#a-compas", 3.3, {{ scale: 0.75, y: 120 }});
      gsap.utils.toArray("#a-input .a-ch").forEach((el, i) => tl.set(el, {{ opacity: 1 }}, 3.55 + i * 0.026));
      for (let t = 3.4; t < 5.5; t += 0.5) {{ tl.set("#a-cur", {{ opacity: 0 }}, t + 0.25); tl.set("#a-cur", {{ opacity: 1 }}, t + 0.5); }}
      pop("#a-btn", 4.6, {{ scale: 0.6 }});
      // 3 — « prépare tout » : le bouton s'enfonce, la fiche s'efface, six tuiles surgissent et se valident
      tl.to("#a-btn", {{ scale: 0.92, duration: 0.08, ease: "power2.in" }}, 5.0); tl.to("#a-btn", {{ scale: 1.04, duration: 0.18, ease: "back.out(3)" }}, 5.08);
      tl.fromTo("#a-ripple", {{ opacity: 0.8, scale: 1 }}, {{ opacity: 0, scale: 26, duration: 0.45, ease: "power2.out" }}, 5.02);
      tl.to("#a-compas", {{ y: -140, scale: 0.6, opacity: 0, duration: 0.3, ease: "power2.in" }}, 5.25);
      for (let i = 0; i < 6; i++) {{ pop("#a-t" + i, 5.25 + i * 0.12, {{ scale: 0.5, y: 80, rotation: (i % 2 ? 6 : -6) }}); pop("#a-tc" + i, 5.55 + i * 0.12, {{ scale: 0 }}); }}
      pop("#a-stk3", 6.25, {{ scale: 2.2, rotation: -16 }}); tl.to("#a-stk3", {{ rotation: -5, duration: 0.2 }}, 6.7);
      for (let i = 0; i < 6; i++) tl.to("#a-t" + i, {{ y: -40 + (i % 2 ? 20 : -20), x: (i % 2 ? 60 : -60), opacity: 0, duration: 0.22, ease: "power2.in" }}, 7.05 + i * 0.02);
      tl.to("#a-stk3", {{ scale: 0, opacity: 0, duration: 0.15 }}, 7.1);
      // 4 — l'itinéraire : la carte surgit, le W se trace, les jours s'allument, les compteurs claquent
      pop("#a-map", 7.3, {{ scale: 0.8, y: 140 }});
      const segs = gsap.utils.toArray("#a-mapsvg .a-seg"); const DM = {DMAX};
      segs.forEach((sg) => tl.to(sg, {{ strokeDashoffset: 0, duration: Math.max(0.03, (sg.dataset.d1 - sg.dataset.d0) / DM * 1.7), ease: "none" }}, 7.65 + sg.dataset.d0 / DM * 1.7));
      gsap.utils.toArray("#a-mapsvg .a-pin").forEach((p) => {{ const t = 7.65 + p.dataset.d / DM * 1.7; const c = p.querySelector("circle");
        tl.fromTo(p, {{ opacity: 0, scale: 0 }}, {{ opacity: 1, scale: 1, duration: 0.35, ease: "back.out(3)", svgOrigin: c.getAttribute("cx") + " " + c.getAttribute("cy") }}, t); }});
      pop("#a-stk4a", 9.3, {{ scale: 2, rotation: -14 }}); tl.to("#a-stk4a", {{ rotation: -4, duration: 0.2 }}, 9.75);
      pop("#a-stk4b", 9.45, {{ scale: 2, rotation: 16 }}); tl.to("#a-stk4b", {{ rotation: 5, duration: 0.2 }}, 9.9);
      const km = {{ v: 0 }}; tl.to(km, {{ v: 72, duration: 0.7, ease: "power2.out", onUpdate: () => {{ document.getElementById("a-km").textContent = Math.round(km.v); }} }}, 9.5);
      window.__timelines = window.__timelines || {{}};
      window.__timelines["acteA"] = tl;
    }})();
  </script>
</template>
'''
open(os.path.join(ROOT, 'compositions', 'acteA.html'), 'w').write(html)
print('acteA.html ok')
