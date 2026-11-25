# Aperçu équilibré (31 s) : rythme posé sur les mesures, écrans lisibles et tenus, texte travaillé (italique, mot à mot),
# grain de film et lumière, la Terre et la route comme fil rouge. Musique : tools/musique3.py ; voix : tools/son3.sh.
import os, sys, math, json
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(HERE, '..', 'presentation', 'tools'))
from ui import ico
D = 31.0
h, j = [], []
def T(sel, a, b, t, ir=True):
    b = dict(b)
    if not ir: b['immediateRender'] = False
    j.append(f'tl.fromTo("{sel}", {json.dumps(a)}, {json.dumps(b)}, {round(t, 3)});')
def TO(sel, b, t): j.append(f'tl.to("{sel}", {json.dumps(b)}, {round(t, 3)});')
def SET(sel, b, t): j.append(f'tl.set("{sel}", {json.dumps(b)}, {round(t, 3)});')
GAR = "font-family:'EB Garamond Italic',Georgia,serif;font-style:italic;font-weight:400"
k_ = [0]
def uid(p): k_[0] += 1; return f'{p}{k_[0]}'

def poem(text, t0, dur, top, size=72, color='#FAF8F5', emph=(), z=120, out=None, align='center', shadow=True, ec='#D0A070'):
    """Une phrase qui apparaît mot à mot (flou → net), cadencée sur la durée de la voix."""
    i = uid('p'); words = text.split(' '); tot = sum(len(w) + 1 for w in words); acc = 0; spans = []
    sh = 'text-shadow:0 4px 30px rgba(6,18,12,.85),0 0 2px rgba(6,18,12,.5);' if shadow else 'text-shadow:0 2px 24px rgba(250,240,235,.6);'
    for w in words:
        c = ec if w.strip('.,:;?!') in emph else color
        spans.append((f'<span class="{i}w" style="display:inline-block;opacity:0;color:{c}">{w}</span>', t0 + dur * 0.85 * acc / tot)); acc += len(w) + 1
    h.append(f'<div id="{i}" style="position:absolute;left:60px;right:60px;top:{top}px;text-align:{align};{GAR};font-size:{size}px;line-height:1.12;color:{color};{sh}z-index:{z}">'
             + ' '.join(s for s, _ in spans) + '</div>')
    for k, (_, t) in enumerate(spans):
        T(f'#{i} .{i}w:nth-child({k + 1})', {'opacity': 0, 'y': 14, 'filter': 'blur(10px)'}, {'opacity': 1, 'y': 0, 'filter': 'blur(0px)', 'duration': 0.55, 'ease': 'power2.out'}, t)
    if out: TO(f'#{i}', {'opacity': 0, 'y': -10, 'filter': 'blur(6px)', 'duration': 0.5, 'ease': 'power2.in'}, out - 0.5)
    return i

def excuse(text, t, out):
    """L'excuse s'écrit finement en haut, un trait laiton la barre lentement, elle reste en retrait."""
    i = uid('x')
    h.append(f'<div id="{i}" style="position:absolute;left:0;right:0;top:118px;text-align:center;z-index:130">'
             f'<span style="position:relative;display:inline-block;{GAR};font-size:50px;color:#FAF8F5;text-shadow:0 3px 20px rgba(6,18,12,.9)">'
             + ' '.join(f'<span class="{i}w" style="display:inline-block;opacity:0">{w}</span>' for w in text.split(' '))
             + f'<span id="{i}b" style="position:absolute;left:-10px;right:-10px;top:55%;height:3px;background:#D0A070;border-radius:2px;transform-origin:0 50%;box-shadow:0 0 12px rgba(208,160,112,.7)"></span></span></div>')
    j.append(f'gsap.set("#{i}b",{{scaleX:0}});')
    j.append(f'tl.fromTo("#{i} .{i}w",{{opacity:0,y:10,filter:"blur(8px)"}},{{opacity:1,y:0,filter:"blur(0px)",duration:0.45,ease:"power2.out",stagger:0.09}},{t});')
    T(f'#{i}b', {'scaleX': 0}, {'scaleX': 1, 'duration': 0.7, 'ease': 'power2.inOut'}, t + 0.9)
    TO(f'#{i}', {'opacity': 0.5, 'duration': 0.6}, t + 1.7)
    TO(f'#{i}', {'opacity': 0, 'duration': 0.4}, out - 0.4)

def label(text, t, out, top=196):
    i = uid('l')
    h.append(f'<div id="{i}" style="position:absolute;left:0;right:0;top:{top}px;text-align:center;font:600 24px/1 Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#D0A070;z-index:130;opacity:0">{text}</div>')
    T(f'#{i}', {'opacity': 0, 'y': 8}, {'opacity': 1, 'y': 0, 'duration': 0.6, 'ease': 'power2.out'}, t)
    TO(f'#{i}', {'opacity': 0, 'duration': 0.4}, out - 0.4)

def clip(src, t0, t1, ms=0.0, z=10, push=(1.08, 1.0), fade=0.6, track=None, rate=1.0, box=None, radius=0):
    i = uid('v'); tr = track if track is not None else 2 + k_[0] % 3
    pos = 'left:0;top:0;width:1080px;height:1920px' if box is None else f'left:{box[0]}px;top:{box[1]}px;width:{box[2]}px;height:{box[3]}px;object-position:top;border-radius:{radius}px'
    h.append(f'<video id="{i}" class="clip" src="assets/video/{src}.mp4" muted playsinline data-start="{t0}" data-duration="{round(t1 - t0, 3)}" data-media-start="{ms}" data-playback-rate="{rate}" data-track-index="{tr}" style="position:absolute;{pos};object-fit:cover;z-index:{z}"></video>')
    T(f'#{i}', {'opacity': 0, 'scale': push[0]}, {'opacity': 1, 'scale': push[0] - (push[0] - push[1]) * min(1, fade / (t1 - t0)), 'duration': fade, 'ease': 'power1.out'}, t0)
    TO(f'#{i}', {'scale': push[1], 'duration': max(0.1, t1 - t0 - fade), 'ease': 'none'}, t0 + fade)
    return i

# ---------------- fond, grain, lumière
h.append('<div id="encre" class="encre" style="z-index:1"></div>')
h.append('<div id="grain" style="position:absolute;left:-60px;top:-60px;width:1200px;height:2040px;background:url(assets/img/grain.png);opacity:.075;z-index:800;pointer-events:none;mix-blend-mode:overlay"></div>')
j.append(f'tl.fromTo("#grain",{{x:0,y:0}},{{x:-48,y:37,duration:{D},ease:"steps({int(D * 12)})"}},0);')
h.append('<div id="leak" style="position:absolute;left:-400px;top:-300px;width:1400px;height:1400px;border-radius:50%;background:radial-gradient(circle,rgba(255,196,140,.35),rgba(255,196,140,0) 65%);z-index:790;pointer-events:none;mix-blend-mode:screen;opacity:0"></div>')
h.append('<div id="vig" style="position:absolute;inset:0;z-index:780;pointer-events:none;background:radial-gradient(120% 85% at 50% 42%,rgba(0,0,0,0) 55%,rgba(6,18,12,.6) 100%)"></div>')

# ---------------- I. la nuit (0–6)
clip('j01', 0.0, 6.6, 0.0, z=10, push=(1.12, 1.0), fade=0.8)
h.append(f'<div id="guide" class="hud light" style="left:290px;top:980px;font-size:44px;padding:22px 36px;z-index:120">{ico("turnl")}<span>200 m</span><span style="font-weight:500;color:#5E6B63">· à gauche</span></div>')
T('#guide', {'opacity': 0, 'y': 16, 'filter': 'blur(8px)'}, {'opacity': 1, 'y': 0, 'filter': 'blur(0px)', 'duration': 0.6, 'ease': 'power2.out'}, 0.5)
TO('#guide', {'opacity': 0, 'filter': 'blur(8px)', 'duration': 0.5}, 2.4)
h.append('<div id="hud" style="position:absolute;left:0;right:0;top:120px;text-align:center;font:500 26px/1 \'JetBrains Mono\',monospace;letter-spacing:.18em;color:rgba(250,248,245,.75);z-index:120;opacity:0">05:12 · 2 352 M · EN DIRECT</div>')
T('#hud', {'opacity': 0}, {'opacity': 1, 'duration': 0.8}, 0.3); TO('#hud', {'opacity': 0, 'duration': 0.6}, 2.6)
poem('Il y a six mois,', 2.75, 0.7, 380, 64, out=6.3)
poem('tu disais encore :', 3.96, 1.0, 460, 64, out=6.3)
ppm = poem('pas pour moi.', 5.5, 0.55, 560, 128, color='#D0A070', out=None)
h.append('<div id="ppmb" style="position:absolute;left:250px;width:580px;top:650px;height:4px;background:#D0A070;border-radius:2px;transform-origin:0 50%;box-shadow:0 0 16px rgba(208,160,112,.8);z-index:121"></div>')
j.append('gsap.set("#ppmb",{scaleX:0});')
T('#ppmb', {'scaleX': 0}, {'scaleX': 1, 'duration': 0.8, 'ease': 'power2.inOut'}, 6.2)
TO(f'#{ppm}', {'opacity': 0, 'filter': 'blur(8px)', 'duration': 0.6}, 7.0)
# le trait descend et devient l'horizon
TO('#ppmb', {'y': 1010, 'scaleX': 2.2, 'opacity': 0, 'duration': 1.0, 'ease': 'power2.in'}, 7.0)

# ---------------- la Terre et la route (fil rouge)
CX, CY, R = 540, 3260, 1600
def pt(a, r=1588): a = math.radians(a); return CX + r * math.sin(a), CY - r * math.cos(a)
def arc(a0, a1, n=30, wob=6):
    pts = [pt(a0 + (a1 - a0) * i / n, 1588 + wob * math.sin(i * 1.3)) for i in range(n + 1)]
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
A0, A1, A2 = -13, 2, 10
ring = 'M' + ' L'.join(f'{540 + 170 * math.sin(2 * math.pi * i / 48):.1f} {640 - 170 * math.cos(2 * math.pi * i / 48):.1f}' for i in range(49))
h.append('<div id="terre" style="position:absolute;left:-1060px;top:1660px;width:3200px;height:3200px;border-radius:1600px;overflow:hidden;z-index:40;box-shadow:0 -10px 90px rgba(150,190,230,.5),0 0 0 3px rgba(190,220,255,.35);background:#06120C;opacity:0">'
         '<div id="sol" style="position:absolute;left:600px;top:-120px;width:2600px;height:1950px;background:url(assets/img/alpes-z8.jpg) center/cover;filter:brightness(.7) saturate(1.05)"></div>'
         '<div style="position:absolute;inset:0;border-radius:1600px;background:radial-gradient(circle at 50% 8%,rgba(0,0,0,0) 0%,rgba(6,18,12,.25) 16%,rgba(6,18,12,.85) 38%)"></div></div>')
T('#terre', {'opacity': 0, 'y': 400}, {'opacity': 1, 'y': 0, 'duration': 1.6, 'ease': 'power3.out'}, 6.6)
T('#sol', {'x': 0}, {'x': -420, 'duration': D - 6.6, 'ease': 'none'}, 6.6)
pins = [(A0, 'Annecy'), (A1, 'Chamonix'), (A2, 'Lac Blanc')]
h.append(f'<svg id="fil" width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;left:0;top:0;z-index:45;overflow:visible" aria-hidden="true">'
         f'<path id="plan" d="{arc(A0, A2, 44)}" fill="none" stroke="#FAF8F5" stroke-opacity=".7" stroke-width="4" stroke-dasharray="3 12" stroke-linecap="round" opacity="0"/>'
         f'<path id="route" d="{arc(A0, A2, 44)}" fill="none" stroke="#D0A070" stroke-width="8" stroke-linecap="round" style="filter:drop-shadow(0 0 10px rgba(255,200,140,.9))" opacity="0"/>'
         f'<path id="anneau" d="{ring}" fill="none" stroke="none"/>'
         + ''.join(f'<circle id="pin{k}" cx="{pt(a)[0]:.1f}" cy="{pt(a)[1]:.1f}" r="10" fill="#FAF8F5" stroke="#D0A070" stroke-width="5" opacity="0"/>' for k, (a, _) in enumerate(pins)) + '</svg>')
for k, (a, nm) in enumerate(pins):
    x, y = pt(a)
    h.append(f'<div id="pl{k}" style="position:absolute;left:{x:.0f}px;top:{y + 20:.0f}px;font:600 22px/1 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(250,248,245,.85);z-index:46;opacity:0">{nm}</div>')
    j.append(f'gsap.set("#pl{k}",{{xPercent:-50}});')
    T(f'#pin{k}', {'opacity': 0, 'attr': {'r': 2}}, {'opacity': 1, 'attr': {'r': 10}, 'duration': 0.4, 'ease': 'back.out(2.5)'}, 7.6 + 0.25 * k)
    T(f'#pl{k}', {'opacity': 0, 'y': 8}, {'opacity': 1, 'y': 0, 'duration': 0.5}, 7.7 + 0.25 * k)
    TO(f'#pl{k}', {'opacity': 0, 'duration': 0.4}, 9.6)
T('#plan', {'opacity': 0}, {'opacity': 1, 'duration': 0.8}, 7.4)
j.append('(function(){const p=document.getElementById("route"); const L=p.getTotalLength(); gsap.set(p,{strokeDasharray:L+" "+L, strokeDashoffset:L});'
         'tl.set(p,{opacity:1},11.6); tl.to(p,{strokeDashoffset:L*0.62,duration:0.8,ease:"power2.inOut"},11.6);'
         'tl.to(p,{strokeDashoffset:L*0.35,duration:0.8,ease:"power2.inOut"},15.6);'
         'tl.to(p,{strokeDashoffset:0,duration:1.6,ease:"power2.inOut"},20.4);'
         'tl.set(p,{strokeDasharray:"none"},25.0); tl.to(p,{morphSVG:{shape:"#anneau"},duration:0.8,ease:"power3.inOut"},25.0);})();')

# ---------------- le téléphone (8–18,5) : trois vrais écrans, tenus et cerclés
PH = (270, 250, 540, 1170); SC = (PH[0] + 10, PH[1] + 10, PH[2] - 20, PH[3] - 20)
h.append(f'<div id="ph" style="position:absolute;left:{PH[0]}px;top:{PH[1]}px;width:{PH[2]}px;height:{PH[3]}px;border-radius:70px;border:10px solid #0A0F0C;box-shadow:0 50px 120px rgba(0,0,0,.6),0 0 0 2px rgba(255,255,255,.1);z-index:52;opacity:0">'
         '<div style="position:absolute;left:50%;top:14px;width:120px;height:34px;margin-left:-60px;border-radius:17px;background:#000"></div></div>')
def screen(src, t0, t1, ms, rate=1.0):
    i = uid('s')
    h.append(f'<video id="{i}" class="clip" src="assets/video/{src}.mp4" muted playsinline data-start="{t0}" data-duration="{round(t1 - t0, 3)}" data-media-start="{ms}" data-playback-rate="{rate}" data-track-index="{5 + k_[0] % 2}" '
             f'style="position:absolute;left:{SC[0]}px;top:{SC[1]}px;width:{SC[2]}px;height:{SC[3]}px;object-fit:cover;object-position:top;border-radius:60px;z-index:51;opacity:0"></video>')
    T(f'#{i}', {'opacity': 0}, {'opacity': 1, 'duration': 0.35}, t0)
    return i
def halo(t0, t1, y0, y1, note=None):
    i = uid('h'); top = SC[1] + SC[3] * y0; hh = SC[3] * (y1 - y0)
    h.append(f'<div id="{i}" style="position:absolute;left:{SC[0] - 14}px;top:{top - 10:.0f}px;width:{SC[2] + 28}px;height:{hh + 20:.0f}px;border-radius:34px;border:3px solid #D0A070;'
             f'box-shadow:0 0 0 2000px rgba(6,18,12,.28),0 0 30px rgba(208,160,112,.55);z-index:53;opacity:0;pointer-events:none"></div>')
    T(f'#{i}', {'opacity': 0, 'scale': 1.04}, {'opacity': 1, 'scale': 1, 'duration': 0.6, 'ease': 'power2.out'}, t0)
    TO(f'#{i}', {'opacity': 0, 'duration': 0.4}, t1 - 0.4)
T('#ph', {'opacity': 0, 'y': 120, 'rotationX': 14, 'scale': 0.94}, {'opacity': 1, 'y': 0, 'rotationX': 0, 'scale': 1, 'duration': 1.0, 'ease': 'expo.out'}, 7.9)
TO('#ph', {'opacity': 0, 'scale': 0.96, 'duration': 0.5}, 18.3)
# Explorer : le tiroir « Le monde » apparaît sur le temps de 8,5 s
s1 = screen('explorer', 7.9, 12.1, 0.9)
excuse('Je ne saurais pas où aller.', 8.2, 12.0); label('Explorer · le monde', 8.6, 12.0)
halo(9.0, 11.9, 0.69, 0.985)
poem('La carte est vivante.', 9.76, 1.3, 1450, 66, emph=('vivante',), out=12.0)
# Compas : la phrase, un mot par temps (12,5 · 13 · 13,5 · 14 · 14,5)
s2 = screen('compas', 12.0, 16.1, 0.826)
excuse("C'est trop compliqué.", 12.2, 16.0); label('Le Compas · ton préparateur', 12.6, 16.0)
halo(12.5, 15.0, 0.52, 0.78)
poem('Une phrase.', 13.05, 0.6, 1450, 66, emph=('phrase',), out=14.2)
poem("C'est tout ce qu'on te demande.", 14.27, 1.3, 1450, 58, out=16.0)
h.append('<div id="prep" style="position:absolute;left:300px;width:480px;top:1180px;height:110px;border-radius:55px;background:#0B0F0C;color:#FAF8F5;display:flex;flex-direction:column;justify-content:center;padding:0 34px;z-index:56;opacity:0;box-shadow:0 20px 50px rgba(0,0,0,.5)">'
         '<div style="font:600 32px Inter">Je prépare ton aventure…</div><div style="font:500 22px Inter;color:rgba(250,248,245,.7);margin-top:6px">Nuits, trajet, kit et budget</div></div>')
T('#prep', {'opacity': 0, 'y': 20}, {'opacity': 1, 'y': 0, 'duration': 0.5, 'ease': 'power2.out'}, 15.0); TO('#prep', {'opacity': 0, 'duration': 0.35}, 15.95)
# Cordée des Alpes : les espaces (16,5), les membres (17,5)
s3 = screen('club', 16.0, 18.6, 0.364)
excuse("Je n'ai personne avec qui partir.", 16.2, 20.0); label('Club · Cordée des Alpes', 16.6, 18.4)
halo(16.9, 18.3, 0.12, 0.62)
poem('Des inconnus,', 17.15, 0.7, 1450, 66, out=20.0)
poem('puis des prénoms.', 18.0, 0.9, 1530, 66, emph=('prénoms',), out=20.0)
# la table du refuge : les prénoms apparaissent, un par temps
clip('g12', 18.5, 20.4, 0.6, z=60, push=(1.1, 1.02), fade=0.5)
for k, (nm, x) in enumerate([('Julien', 120), ('Sofia', 300), ('Marc', 680), ('Claire', 905)]):
    i = uid('n')
    h.append(f'<div id="{i}" class="hud light" style="left:{x}px;top:560px;font-size:32px;padding:12px 24px;z-index:122">{nm}</div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50}});')
    T(f'#{i}', {'opacity': 0, 'y': 12, 'filter': 'blur(6px)'}, {'opacity': 1, 'y': 0, 'filter': 'blur(0px)', 'duration': 0.45, 'ease': 'power2.out'}, 18.8 + 0.25 * k)
    TO(f'#{i}', {'opacity': 0, 'duration': 0.35}, 20.2)
SET('#terre', {'zIndex': 70}, 18.5); SET('#fil', {'zIndex': 71}, 18.5)

# ---------------- l'aube (20–25,5)
clip('a02', 20.0, 25.9, 0.5, z=62, push=(1.14, 1.0), fade=0.8)
T('#leak', {'opacity': 0, 'x': 0}, {'opacity': 1, 'x': 260, 'duration': 5.0, 'ease': 'sine.inOut'}, 20.2, ir=False)
TO('#leak', {'opacity': 0, 'duration': 1.0}, 25.0)
poem('Puis le lac.', 20.55, 0.6, 300, 70, color='#0B1F17', shadow=False, out=21.7)
poem("Le Mont-Blanc, qui s'allume.", 21.8, 1.4, 300, 70, color='#0B1F17', shadow=False, emph=('Mont-Blanc,',), ec='#7E5A30', out=23.6)
poem('Toi. Ici.', 23.9, 1.0, 330, 130, color='#0B1F17', shadow=False, emph=('Ici.',), ec='#7E5A30', out=25.4)
chips = [('bed', 'Nuit', 'Refuge du Lac Blanc', 760, 1720, 21.0), ('paw', 'Pokédex', 'Marmotte des Alpes', 300, 1790, 22.0), ('users', 'Rencontre', 'Claire, guide', 700, 1850, 23.0)]
for icn, a, b, x, y, t in chips:
    i = uid('c')
    h.append(f'<div id="{i}" class="hud light" style="left:{x}px;top:{y}px;font-size:28px;padding:12px 22px;z-index:75">{ico(icn)}<span>{a}</span><span style="font-weight:500;color:#5E6B63">{b}</span></div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50}});')
    T(f'#{i}', {'opacity': 0, 'y': 14, 'filter': 'blur(6px)'}, {'opacity': 1, 'y': 0, 'filter': 'blur(0px)', 'duration': 0.5, 'ease': 'power2.out'}, t)
    TO(f'#{i}', {'opacity': 0, 'duration': 0.4}, 24.9)
TO('#plan', {'opacity': 0, 'duration': 0.4}, 24.8)
for k in range(3): TO(f'#pin{k}', {'opacity': 0, 'duration': 0.3}, 24.8)

# ---------------- le logo (25,5–31)
h.append('<div id="enc2" style="position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 38%,#10291E 0%,#06120C 70%);z-index:65;opacity:0"></div>')
T('#enc2', {'opacity': 0}, {'opacity': 1, 'duration': 0.8, 'ease': 'power1.inOut'}, 25.1)
h.append('<div id="onde" style="position:absolute;left:370px;top:470px;width:340px;height:340px;border-radius:170px;border:3px solid #D0A070;z-index:79;opacity:0"></div>')
T('#onde', {'opacity': 0.8, 'scale': 1}, {'opacity': 0, 'scale': 2.6, 'duration': 1.6, 'ease': 'power2.out'}, 25.6, ir=False)
h.append('<img id="logo" src="assets/img/badge-anneau.png" alt="" style="position:absolute;left:400px;top:500px;width:280px;height:280px;opacity:0;z-index:81">')
T('#logo', {'opacity': 0, 'scale': 0.9}, {'opacity': 1, 'scale': 1, 'duration': 1.0, 'ease': 'power2.out'}, 25.6)
TO('#route', {'opacity': 0, 'duration': 0.6}, 25.8)
h.append('<div id="wm" style="position:absolute;left:0;right:0;top:880px;text-align:center;font:600 64px/1 Inter,sans-serif;letter-spacing:.2em;color:#FAF8F5;z-index:82">'
         + ''.join(f'<span class="lt" style="display:inline-block;opacity:0">{c if c != " " else "&nbsp;"}</span>' for c in 'LE KIT DU VOYAGEUR') + '</div>')
j.append('tl.fromTo(".lt",{opacity:0,y:16,filter:"blur(8px)"},{opacity:1,y:0,filter:"blur(0px)",duration:0.6,ease:"power2.out",stagger:0.04},25.75);')
poem('Là où la carte se termine.', 27.5, 1.6, 980, 66, color='#D0A070', z=82)
T('#terre', {'filter': 'brightness(1)'}, {'filter': 'brightness(1.25)', 'duration': 2.0}, 25.5, ir=False)
TO('#root > *:not(audio)', {'opacity': 0, 'duration': 0.8}, D - 0.9)

html = f'''<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>LKDV — aperçu équilibré de la vidéo ultime</title>
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
      <audio id="son" class="clip" src="audio/bande-son3.wav" data-start="0" data-duration="{D}" data-track-index="20" data-volume="1" data-timeline-role="music"></audio>
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
