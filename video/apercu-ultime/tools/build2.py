# Aperçu dynamique (21,6 s) : coupes au temps (120 BPM), mots qui claquent, flashs, secousses, téléphone en 3D,
# stroboscope des fonds de carte, rafale de plans, la Terre et la route qui se referme en logo.
# Écrans de l'app = vrais enregistrements de main (assets/video/explorer|compas|club.mp4). Sortie : index.html
import os, sys, math, json
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(HERE, '..', 'presentation', 'tools'))
from ui import ico
D = 21.6
h, j = [], []
def T(sel, a, b, t): j.append(f'tl.fromTo("{sel}", {json.dumps(a)}, {json.dumps(b)}, {round(t, 3)});')
def TO(sel, b, t): j.append(f'tl.to("{sel}", {json.dumps(b)}, {round(t, 3)});')
def SET(sel, b, t): j.append(f'tl.set("{sel}", {json.dumps(b)}, {round(t, 3)});')
def shake(t, a=22):
    j.append(f'tl.to(".sh", {{keyframes:[{{x:{-a},y:{a * 0.5:.0f},duration:0.035}},{{x:{a * 0.8:.0f},y:{-a * 0.6:.0f},duration:0.035}},{{x:{-a * 0.5:.0f},y:{a * 0.3:.0f},duration:0.04}},{{x:0,y:0,duration:0.06}}], ease:"none"}}, {round(t, 3)});')
def flash(t, o=0.85, d=0.28): T('#flash', {'opacity': o}, {'opacity': 0, 'duration': d, 'ease': 'power2.out', 'immediateRender': False}, t)
k_clip = [0]
def vid(src, t0, t1, ms=0.0, z=60, zoom=(1.22, 1.0), track=None, rate=1.0, x0=0):
    k_clip[0] += 1; i = f'v{k_clip[0]}'
    tr = track if track is not None else 2 + k_clip[0] % 2
    h.append(f'<video id="{i}" class="clip sh" src="assets/video/{src}.mp4" muted playsinline data-start="{t0}" data-duration="{round(t1 - t0, 3)}" data-media-start="{ms}" data-playback-rate="{rate}" data-track-index="{tr}" '
             f'style="position:absolute;left:0;top:0;width:1080px;height:1920px;object-fit:cover;z-index:{z}"></video>')
    T(f'#{i}', {'scale': zoom[0], 'x': x0}, {'scale': zoom[1], 'x': 0, 'duration': t1 - t0, 'ease': 'power3.out'}, t0)
    return i
def slam(i, t, sc=1.7, d=0.22, rot=0):
    T(f'#{i}', {'opacity': 0, 'scale': sc, 'rotation': rot}, {'opacity': 1, 'scale': 1, 'rotation': 0, 'duration': d, 'ease': 'expo.out'}, t)
ANTON = "font-family:Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:0.01em;line-height:0.92"

# fond, flash
h.append(f'<div id="encre" class="encre" style="z-index:1"></div>')
h.append('<div id="flash" style="position:absolute;inset:0;background:#FAF8F5;opacity:0;z-index:900;pointer-events:none"></div>')
h.append('<div id="vig" style="position:absolute;inset:0;z-index:850;pointer-events:none;background:radial-gradient(120% 85% at 50% 45%,rgba(0,0,0,0) 55%,rgba(6,18,12,.6) 100%)"></div>')

# ---------- 0 · PAS / POUR / MOI. — l'entaille — la nuit
words = [('PAS', 0.9, 420), ('POUR', 1.15, 700), ('MOI.', 1.42, 980)]
h.append('<div id="ppm" class="sh" style="position:absolute;inset:0;z-index:80">' + ''.join(
    f'<div id="w{k}" style="position:absolute;left:0;right:0;top:{y}px;text-align:center;{ANTON};font-size:300px;color:#FAF8F5;opacity:0">{w}</div>' for k, (w, t, y) in enumerate(words)) + '</div>')
for k, (w, t, y) in enumerate(words): slam(f'w{k}', t, 2.2, 0.16); shake(t, 26); flash(t, 0.35, 0.15)
h.append('<div id="slash0" style="position:absolute;left:-200px;top:900px;width:1480px;height:34px;background:#D0A070;transform-origin:0 50%;z-index:85;box-shadow:0 0 40px rgba(208,160,112,.8)"></div>')
j.append('gsap.set("#slash0",{rotation:-14, scaleX:0});')
TO('#slash0', {'scaleX': 1, 'duration': 0.12, 'ease': 'power4.out'}, 1.6)
TO('#w0', {'y': -900, 'rotation': -12, 'duration': 0.35, 'ease': 'power3.in'}, 1.75)
TO('#w1', {'x': -1300, 'rotation': 8, 'duration': 0.35, 'ease': 'power3.in'}, 1.75)
TO('#w2', {'y': 900, 'rotation': 10, 'duration': 0.35, 'ease': 'power3.in'}, 1.75)
TO('#slash0', {'opacity': 0, 'duration': 0.2}, 1.85)
for k in range(3): SET(f'#w{k}', {'opacity': 0}, 2.12)
flash(1.7, 0.9, 0.3); shake(1.7, 34)
vid('nuit', 1.7, 3.2, 0.6, z=60, zoom=(1.35, 1.02))
vid('j19', 3.2, 3.7, 2.0, z=61, zoom=(1.3, 1.05))
vid('j01', 3.7, 4.2, 1.2, z=62, zoom=(1.3, 1.05))
for t in (3.2, 3.7): flash(t, 0.4, 0.15); shake(t, 14)
h.append(f'<div id="g200" class="hud light sh" style="left:250px;top:880px;font-size:64px;padding:26px 44px;z-index:90">{ico("turnl")}<span>200 m</span><span style="font-weight:500;color:#5E6B63">· à gauche</span></div>')
slam('g200', 2.25, 1.5, 0.25); TO('#g200', {'opacity': 0, 'scale': 0.8, 'duration': 0.15}, 4.05)
h.append('<div id="alt" class="sh" style="position:absolute;left:0;right:0;top:260px;text-align:center;font:700 150px/1 \'JetBrains Mono\',monospace;color:#FAF8F5;text-shadow:0 6px 40px rgba(0,0,0,.7);z-index:90;opacity:0"><span id="altn">2 100</span><span style="font-size:70px;color:#D0A070"> m</span></div>')
slam('alt', 2.0, 1.4, 0.2); TO('#alt', {'opacity': 0, 'duration': 0.12}, 4.1)
j.append('(function(){const o={v:2100}; const el=document.getElementById("altn"); tl.to(o,{v:2352,duration:2.0,ease:"power2.out",onUpdate:()=>{el.textContent=Math.round(o.v).toLocaleString("fr-FR").replace(/\\u202f/g," ");}},2.0);})();')

# ---------- excuses : deux lignes qui claquent, l'entaille laiton, elles volent
def excuse(t, l1, l2, n):
    a, b = f'e{n}a', f'e{n}b'
    h.append(f'<div id="{a}" class="sh" style="position:absolute;left:0;right:0;top:700px;text-align:center;{ANTON};font-size:150px;color:#FAF8F5;z-index:95;opacity:0">{l1}</div>')
    h.append(f'<div id="{b}" class="sh" style="position:absolute;left:0;right:0;top:850px;text-align:center;{ANTON};font-size:150px;color:#D0A070;z-index:95;opacity:0">{l2}</div>')
    h.append(f'<div id="es{n}" style="position:absolute;left:-150px;top:860px;width:1380px;height:26px;background:#D0A070;transform-origin:0 50%;z-index:96;box-shadow:0 0 30px rgba(208,160,112,.7)"></div>')
    j.append(f'gsap.set("#es{n}",{{rotation:-9, scaleX:0}});')
    h.append(f'<div id="eb{n}" style="position:absolute;inset:0;background:#06120C;z-index:94;opacity:0"></div>')
    T(f'#eb{n}', {'opacity': 0}, {'opacity': 0.92, 'duration': 0.06}, t - 0.02)
    slam(a, t, 1.8, 0.16); slam(b, t + 0.25, 1.8, 0.16); shake(t, 24); shake(t + 0.25, 18); flash(t, 0.5, 0.18)
    TO(f'#es{n}', {'scaleX': 1, 'duration': 0.1, 'ease': 'power4.out'}, t + 0.42)
    TO(f'#{a}', {'x': -1300, 'rotation': -8, 'duration': 0.3, 'ease': 'power3.in'}, t + 0.5)
    TO(f'#{b}', {'x': 1300, 'rotation': 8, 'duration': 0.3, 'ease': 'power3.in'}, t + 0.5)
    TO(f'#es{n}', {'opacity': 0, 'duration': 0.15}, t + 0.55)
    SET(f'#{a}', {'opacity': 0}, t + 0.82); SET(f'#{b}', {'opacity': 0}, t + 0.82)
    TO(f'#eb{n}', {'opacity': 0, 'duration': 0.2}, t + 0.5)
    flash(t + 0.5, 0.7, 0.25); shake(t + 0.5, 30)
excuse(4.2, 'Je ne saurais', 'pas où aller ?', 1)
excuse(7.2, "C'est trop", 'compliqué ?', 2)
excuse(11.2, 'Personne', 'avec qui partir ?', 3)

# ---------- la Terre (fil rouge) et la route
CX, CY, R = 540, 2790, 1600
def pt(a, r=1588): a = math.radians(a); return CX + r * math.sin(a), CY - r * math.cos(a)
def arc(a0, a1, n=30, wob=7):
    return 'M' + ' L'.join(f'{pt(a0 + (a1 - a0) * i / n, 1588 + wob * math.sin(i * 1.3))[0]:.1f} {pt(a0 + (a1 - a0) * i / n, 1588 + wob * math.sin(i * 1.3))[1]:.1f}' for i in range(n + 1))
A0, A1, A2 = -13, 3, 10
ring = 'M' + ' L'.join(f'{540 + 160 * math.sin(2 * math.pi * i / 48):.1f} {600 - 160 * math.cos(2 * math.pi * i / 48):.1f}' for i in range(49))
h.append('<div id="terre" style="position:absolute;left:-1060px;top:1190px;width:3200px;height:3200px;border-radius:1600px;overflow:hidden;z-index:40;box-shadow:0 -10px 90px rgba(150,190,230,.55),0 0 0 3px rgba(190,220,255,.4);background:#06120C;opacity:0">'
         '<div id="sol" style="position:absolute;left:600px;top:-120px;width:2600px;height:1950px;background:url(assets/img/alpes-z8.jpg) center/cover;filter:brightness(.7) saturate(1.05)"></div>'
         '<div style="position:absolute;inset:0;border-radius:1600px;background:radial-gradient(circle at 50% 8%,rgba(0,0,0,0) 0%,rgba(6,18,12,.25) 18%,rgba(6,18,12,.85) 42%)"></div></div>')
h.append(f'<svg id="fil" width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;left:0;top:0;z-index:50;overflow:visible" aria-hidden="true">'
         f'<path id="plan" d="{arc(A0, A2, 44)}" fill="none" stroke="#FAF8F5" stroke-opacity=".8" stroke-width="5" stroke-dasharray="3 13" stroke-linecap="round" opacity="0"/>'
         f'<path id="route" d="{arc(A0, A2, 44)}" fill="none" stroke="#D0A070" stroke-width="10" stroke-linecap="round" style="filter:drop-shadow(0 0 12px rgba(255,200,140,.95))" opacity="0"/>'
         f'<path id="anneau" d="{ring}" fill="none" stroke="none"/>'
         + ''.join(f'<circle id="pin{k}" cx="{pt(a)[0]:.1f}" cy="{pt(a)[1]:.1f}" r="12" fill="#FAF8F5" stroke="#D0A070" stroke-width="6" opacity="0"/>' for k, a in enumerate((A0, A1, A2))) + '</svg>')
T('#terre', {'opacity': 0, 'y': 500}, {'opacity': 1, 'y': 0, 'duration': 0.6, 'ease': 'expo.out'}, 4.7)
T('#sol', {'x': 0}, {'x': -900, 'duration': D - 4.7, 'ease': 'none'}, 4.7)
T('#plan', {'opacity': 0}, {'opacity': 1, 'duration': 0.4}, 5.0)
for k in range(3): T(f'#pin{k}', {'opacity': 0, 'attr': {'r': 2}}, {'opacity': 1, 'attr': {'r': 12}, 'duration': 0.25, 'ease': 'back.out(3)'}, 5.0 + 0.12 * k)

# ---------- le téléphone et les vrais écrans
PH = dict(x=290, y=110, w=500, h=1084)
h.append(f'<div id="ph" class="sh" style="position:absolute;left:{PH["x"]}px;top:{PH["y"]}px;width:{PH["w"]}px;height:{PH["h"]}px;border-radius:66px;border:10px solid #0A0F0C;'
         f'box-shadow:0 50px 120px rgba(0,0,0,.6),0 0 0 2px rgba(255,255,255,.1);z-index:52;opacity:0"><div style="position:absolute;left:50%;top:14px;width:116px;height:34px;margin-left:-58px;border-radius:17px;background:#000"></div></div>')
def screen(src, t0, t1, ms, rate=1.0):
    k_clip[0] += 1; i = f'v{k_clip[0]}'
    h.append(f'<video id="{i}" class="clip sh" src="assets/video/{src}.mp4" muted playsinline data-start="{t0}" data-duration="{round(t1 - t0, 3)}" data-media-start="{ms}" data-playback-rate="{rate}" data-track-index="{4 + k_clip[0] % 2}" '
             f'style="position:absolute;left:{PH["x"] + 10}px;top:{PH["y"] + 10}px;width:{PH["w"] - 20}px;height:{PH["h"] - 20}px;object-fit:cover;object-position:top;border-radius:56px;z-index:51"></video>')
    return i
def phone_in(t, vid_id, frm):
    sel = f'#ph, #{vid_id}'
    T(sel, dict(frm, opacity=0), {'opacity': 1, 'x': 0, 'y': 0, 'rotationY': 0, 'rotationX': 0, 'rotation': 0, 'scale': 1, 'duration': 0.45, 'ease': 'expo.out'}, t)
    shake(t + 0.1, 14)
s1 = screen('explorer', 4.7, 6.2, 1.0)   # le tiroir apparaît (clic à 0,98 s + 0,5 s de l'app) pile sur le temps 5,2 s
phone_in(4.7, s1, {'y': 900, 'rotationX': 50, 'scale': 0.7})
T(f'#ph, #{s1}', {'scale': 1}, {'scale': 1.28, 'y': -150, 'duration': 0.35, 'ease': 'expo.out'}, 5.7)
TO('#ph', {'opacity': 0, 'duration': 0.1}, 6.2)
# stroboscope des fonds : Plan · Relief · Satellite · 3D (Chamonix)
meta = json.load(open(os.path.join(HERE, '..', 'presentation', 'assets', 'img', 'alpes.json')))['z12']
def P12(lon, lat):
    n = 256 * 2 ** meta['z']; x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x - meta['ox'], y - meta['oy']
X, Y = P12(6.88, 45.94); s = 1.15
for k, (src, lab, t) in enumerate([('plan-z12', 'Plan', 6.2), ('relief-z12', 'Relief', 6.45), ('alpes-z12', 'Satellite', 6.7), ('alpes-z12', '3D', 6.95)]):
    i = f'map{k}'
    rot = 'transform-origin:50% 60%;' if k == 3 else ''
    h.append(f'<div id="{i}w" class="sh" style="position:absolute;inset:0;overflow:hidden;z-index:{63 + k};opacity:0;perspective:1200px"><img id="{i}" src="assets/img/{src}.jpg" alt="" '
             f'style="position:absolute;left:{540 - X * s:.0f}px;top:{960 - Y * s:.0f}px;width:{meta["w"] * s:.0f}px;height:{meta["h"] * s:.0f}px;transform-origin:{X * s:.0f}px {Y * s:.0f}px;{rot}"></div>')
    h.append(f'<div id="{i}t" class="sh" style="position:absolute;left:0;right:0;top:1300px;text-align:center;{ANTON};font-size:210px;color:#FAF8F5;text-shadow:0 10px 50px rgba(0,0,0,.6);z-index:{70 + k};opacity:0">{lab}</div>')
    SET(f'#{i}w', {'opacity': 1}, t); SET(f'#{i}w', {'opacity': 0}, 7.2)
    T(f'#{i}', {'scale': 1.25}, {'scale': 1.0, 'duration': 0.3, 'ease': 'expo.out'}, t)
    slam(f'{i}t', t, 1.6, 0.14); SET(f'#{i}t', {'opacity': 0}, t + 0.25 if k < 3 else 7.2)
    flash(t, 0.3, 0.12)
T('#map3', {'rotationX': 0, 'scale': 1.6}, {'rotationX': 55, 'scale': 2.1, 'duration': 0.2, 'ease': 'expo.out'}, 6.95)
# Compas : la phrase, mot à mot
s2 = screen('compas', 7.7, 11.2, 0.826)   # chaque mot tapé tombe sur un temps (8,2 · 8,7 · 9,2 · 9,7 · 10,2)
phone_in(7.7, s2, {'x': 1100, 'rotationY': -60, 'scale': 0.8})
SET('#ph', {'opacity': 1}, 7.7)
T(f'#ph, #{s2}', {'scale': 1}, {'scale': 0.78, 'y': -170, 'duration': 0.25, 'ease': 'expo.out'}, 7.95)
for k, (w, t) in enumerate([('5 jours', 8.2), ('Les Alpes', 8.7), ('Rando', 9.2), ('Via ferrata', 9.7), ('Kayak', 10.2)]):
    i = f'kw{k}'
    h.append(f'<div id="{i}" class="sh" style="position:absolute;left:0;right:0;top:1040px;text-align:center;{ANTON};font-size:150px;color:{"#D0A070" if k % 2 else "#FAF8F5"};text-shadow:0 8px 40px rgba(0,0,0,.6);z-index:90;opacity:0">{w}</div>')
    slam(i, t, 1.9, 0.15, rot=-4 if k % 2 else 4); shake(t, 10); SET(f'#{i}', {'opacity': 0}, t + 0.48)
h.append(f'<div id="prep" class="sh" style="position:absolute;left:150px;right:150px;top:1050px;height:120px;border-radius:60px;background:#0B0F0C;color:#FAF8F5;display:flex;flex-direction:column;justify-content:center;padding:0 40px;z-index:91;opacity:0">'
         f'<div style="font:600 38px Inter">Je prépare ton aventure…</div><div style="font:500 26px Inter;color:rgba(250,248,245,.7);margin-top:6px">Nuits, trajet, kit et budget</div></div>')
slam('prep', 10.7, 1.4, 0.2); TO('#prep', {'opacity': 0, 'duration': 0.12}, 11.12)
T('#route', {'opacity': 0}, {'opacity': 1, 'duration': 0.01}, 10.7)
j.append('(function(){const p=document.getElementById("route"); const L=p.getTotalLength(); gsap.set(p,{strokeDasharray:L+" "+L, strokeDashoffset:L}); tl.to(p,{strokeDashoffset:L*0.45,duration:0.5,ease:"power2.out"},10.7); tl.to(p,{strokeDashoffset:0,duration:1.5,ease:"power1.inOut"},14.7); tl.set(p,{strokeDasharray:"none"},16.2); tl.to(p,{morphSVG:{shape:"#anneau"},duration:0.5,ease:"expo.inOut"},16.2);})();')
TO('#ph', {'opacity': 0, 'duration': 0.08}, 11.15)
# Cordée des Alpes
s3 = screen('club', 11.7, 13.2, 0.364, 2.0)   # espaces 11,95 · membres 12,45 · sorties 12,7
phone_in(11.7, s3, {'x': -1100, 'rotationY': 60, 'scale': 0.8})
SET('#ph', {'opacity': 1}, 11.7)
T(f'#ph, #{s3}', {'rotation': 0}, {'rotation': -4, 'scale': 1.08, 'duration': 0.25, 'ease': 'expo.out'}, 12.45)
TO('#ph', {'opacity': 0, 'duration': 0.05}, 13.17)
vid('g10', 13.2, 13.45, 0.6, z=66, zoom=(1.35, 1.1))
vid('g11', 13.45, 13.7, 0.6, z=67, zoom=(1.35, 1.1))
vid('g12', 13.7, 14.2, 0.8, z=68, zoom=(1.3, 1.05))
for t in (13.2, 13.45, 13.7): flash(t, 0.45, 0.15); shake(t, 16)
for k, (nm, x) in enumerate([('Julien', 120), ('Sofia', 300), ('Marc', 680), ('Claire', 905)]):
    i = f'nm{k}'
    h.append(f'<div id="{i}" class="hud light sh" style="left:{x}px;top:560px;font-size:34px;padding:12px 24px;z-index:92">{nm}</div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50}});'); slam(i, 13.7 + 0.125 * k, 1.6, 0.12); SET(f'#{i}', {'opacity': 0}, 14.2)
# rafale : kayak, échelle, paroi, nuit
for k, (s_, ms) in enumerate([('j16', 0.4), ('j17', 0.6), ('j18', 1.2), ('j19', 3.0)]):
    t0 = 14.2 + 0.125 * k
    vid(s_, t0, t0 + 0.125, ms, z=69 + k, zoom=(1.4, 1.2))
    flash(t0, 0.35, 0.1); shake(t0, 12)
# DROP : l'aube au Lac Blanc, la Terre surgit, la route se remplit, la carte vit
vid('a02', 14.7, 16.75, 1.5, z=74, zoom=(1.5, 1.08))
SET('#terre', {'zIndex': 75}, 14.7); SET('#fil', {'zIndex': 76}, 14.7)
T('#terre', {'y': 700}, {'y': 0, 'duration': 0.5, 'ease': 'expo.out', 'immediateRender': False}, 14.7)
flash(14.7, 1.0, 0.45); shake(14.7, 40)
chips = [('bed', 'Nuit', 'Refuge du Lac Blanc', 760, 1260, 15.2), ('paw', 'Pokédex', 'Marmotte des Alpes', 290, 1330, 15.45), ('users', 'Rencontre', 'Claire · guide', 640, 1400, 15.7),
         ('nowifi', 'Hors ligne', 'carte prête', 300, 1470, 15.95), ('flower', 'Pokédex', 'Gentiane de Koch', 700, 1540, 16.2)]
for k, (icn, a, b, x, y, t) in enumerate(chips):
    i = f'ch{k}'
    h.append(f'<div id="{i}" class="hud light sh" style="left:{x}px;top:{y}px;font-size:30px;padding:12px 22px;z-index:80">{ico(icn)}<span>{a}</span><span style="font-weight:500;color:#5E6B63">{b}</span></div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50}});'); slam(i, t, 1.5, 0.18); TO(f'#{i}', {'opacity': 0, 'y': 30, 'duration': 0.15}, 16.45)
TO('#plan', {'opacity': 0, 'duration': 0.15}, 16.2)
for k in range(3): TO(f'#pin{k}', {'opacity': 0, 'duration': 0.15}, 16.2)
# LOGO : l'anneau claque, onde de choc, le nom
h.append('<div id="enc2" style="position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 40%,#10291E 0%,#06120C 70%);z-index:74;opacity:0"></div>')
SET('#enc2', {'opacity': 1, 'zIndex': 74}, 16.7)
for k in range(3):
    i = f'wave{k}'
    h.append(f'<div id="{i}" style="position:absolute;left:{540 - 160}px;top:{600 - 160}px;width:320px;height:320px;border-radius:160px;border:6px solid #D0A070;z-index:79;opacity:0"></div>')
    T(f'#{i}', {'opacity': 0.9, 'scale': 1}, {'opacity': 0, 'scale': 4 + k, 'duration': 0.9 + 0.2 * k, 'ease': 'expo.out', 'immediateRender': False}, 16.7 + 0.125 * k)
h.append('<img id="logo" class="sh" src="assets/img/badge-anneau.png" alt="" style="position:absolute;left:390px;top:450px;width:300px;height:300px;opacity:0;z-index:81">')
T('#logo', {'opacity': 0, 'scale': 2.2, 'rotation': -40}, {'opacity': 1, 'scale': 1, 'rotation': 0, 'duration': 0.4, 'ease': 'expo.out'}, 16.7)
TO('#route', {'opacity': 0, 'duration': 0.2}, 16.75)
flash(16.7, 1.0, 0.5); shake(16.7, 40)
letters = 'LE KIT DU VOYAGEUR'
h.append('<div id="wm" class="sh" style="position:absolute;left:0;right:0;top:820px;text-align:center;font:700 74px/1 Inter,sans-serif;letter-spacing:.16em;color:#FAF8F5;z-index:82">'
         + ''.join(f'<span class="lt" style="display:inline-block;opacity:0">{c if c != " " else "&nbsp;"}</span>' for c in letters) + '</div>')
j.append('tl.fromTo(".lt",{opacity:0,y:60,scale:1.8},{opacity:1,y:0,scale:1,duration:0.35,ease:"expo.out",stagger:0.0625},17.2);')
h.append('<div id="tag" class="big" style="top:930px;font-size:66px;color:#D0A070;z-index:82">Là où la carte se termine.</div>')
T('#tag', {'opacity': 0, 'y': 30}, {'opacity': 1, 'y': 0, 'duration': 0.6, 'ease': 'expo.out'}, 18.95)
T('#terre', {'filter': 'brightness(1)'}, {'filter': 'brightness(1.35)', 'duration': 1.5, 'immediateRender': False}, 16.7)
TO('#root > *', {'opacity': 0, 'duration': 0.4}, D - 0.45)

# ---------- la pulsation : halo de l'horizon et vignette battent sur chaque grosse caisse
h.append('<div id="halo" style="position:absolute;left:-200px;right:-200px;top:1050px;height:420px;background:radial-gradient(60% 50% at 50% 60%,rgba(208,160,112,.55),rgba(208,160,112,0) 70%);z-index:77;opacity:0;pointer-events:none;mix-blend-mode:screen"></div>')
kicks = [1.7 + 0.5 * i for i in range(26)] + [14.7 + 0.25 * i for i in range(8)]
for t in kicks:
    strong = t >= 14.7 or abs(((t - 1.7) / 0.5) % 2 - 1) < 1e-6
    T('#halo', {'opacity': 0.9 if strong else 0.55}, {'opacity': 0, 'duration': 0.32 if t < 14.7 else 0.2, 'ease': 'power2.out', 'immediateRender': False}, t)
    T('#vig', {'opacity': 1}, {'opacity': 0.55, 'duration': 0.3, 'ease': 'power2.out', 'immediateRender': False}, t)
    if 4.7 <= t < 14.7 and not (6.2 <= t < 7.2):
        j.append(f'tl.fromTo("#terre", {{scale:1.012}}, {{scale:1, duration:0.3, ease:"power2.out", immediateRender:false}}, {t});')

# sous-titres en haut, sur pastille
caps = [(0.9, 1.6, 'pas pour moi.', ''), (2.2, 4.15, '« Dans deux cents mètres, à gauche. »', 'app'), (5.7, 7.15, 'La carte est vivante.', ''),
        (8.2, 8.98, 'Une phrase.', ''), (9.05, 10.65, "C'est tout ce qu'on te demande.", ''), (11.75, 13.65, 'Des inconnus, puis des prénoms.', '')]
for k, (t0, t1, txt, cl) in enumerate(caps):
    st = "font:500 34px/1.2 'JetBrains Mono',monospace;color:#F1D3AE" if cl else 'font:600 42px/1.2 Inter,sans-serif;color:#FAF8F5'
    h.append(f'<div id="st{k}" style="position:absolute;left:40px;right:40px;top:1800px;text-align:center;{st};z-index:870;opacity:0"><span style="display:inline-block;padding:10px 26px;border-radius:34px;background:rgba(6,18,12,.7)">{txt}</span></div>')
    T(f'#st{k}', {'opacity': 0, 'y': 10}, {'opacity': 1, 'y': 0, 'duration': 0.12}, t0 - 0.04); TO(f'#st{k}', {'opacity': 0, 'duration': 0.12}, t1)

html = f'''<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>LKDV — aperçu dynamique de la vidéo ultime</title>
    <script src="assets/lib/gsap.min.js"></script>
    <script src="assets/lib/MorphSVGPlugin.min.js"></script>
    <link rel="stylesheet" href="assets/fonts.css" />
    <link rel="stylesheet" href="assets/ui.css" />
    <style>
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ width:1080px; height:1920px; overflow:hidden; background:#06120C; }}
      #root {{ position:relative; width:1080px; height:1920px; overflow:hidden; background:#06120C; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="1080" data-height="1920">
      {chr(10).join('      ' + x for x in h).strip()}
      <audio id="son" class="clip" src="audio/bande-son2.wav" data-start="0" data-duration="{D}" data-track-index="20" data-volume="1" data-timeline-role="music"></audio>
    </div>
    <script>
      gsap.registerPlugin(MorphSVGPlugin);
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      {chr(10).join('      ' + x for x in j).strip()}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''
open(os.path.join(HERE, 'index.html'), 'w').write(html)
print('ok', len(h), 'éléments,', len(j), 'tweens')
