# Aperçu « à la Apple » (31 s) : grille stricte, typographie sobre, et une chaîne de mouvement continue
# où chaque élément engendre le suivant :
#   point de lumière → iris sur la nuit → titres masqués → trait qui barre « Pas pour moi. » → horizon de la Terre
#   → point d'Annecy qui trace le téléphone → vrais écrans (Explorer, Compas, Cordée) poussés comme sur iOS
#   → mots tapés qui sortent du champ en étiquettes → pastille « Je prépare ton aventure… » → point qui tombe sur la route
#   → avatars de la cordée → l'écran s'ouvre en photo du refuge → l'aube se lève depuis l'horizon
#   → le point de position parcourt la route jusqu'au Lac Blanc, monte et devient l'anneau du logo.
# Bande-son : audio/bande-son3.wav (voix + musique équilibrée, 31 s). Sortie : index.html
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
k_ = [0]
def uid(p): k_[0] += 1; return f'{p}{k_[0]}'

# ---------- système
W, H, M = 1080, 1920, 96                       # marges latérales 96 px
Y_EYE, Y_H1, Y_SUB = 168, 214, 300            # rubrique, titre, sous-titre
PH = (280, 440, 520, 1126)                     # téléphone (cadre)
SC = (PH[0] + 10, PH[1] + 10, PH[2] - 20, PH[3] - 20)   # écran : 290, 450, 500 × 1106
HOR = 1712                                     # sommet de l'horizon
INK, STONE, BRASS, GREY = '#0B1F17', '#FAF8F5', '#D0A070', 'rgba(250,248,245,.62)'
SANS = "font-family:Inter,sans-serif"
GAR = "font-family:'EB Garamond Italic',Georgia,serif;font-style:italic;font-weight:400"
OUT_E = 'expo.out'

def mline(text, top, t_in, t_out=None, size=60, weight=700, color=STONE, track='-0.022em', family=SANS, lh=1.12, z=120, words=True, dur=0.9, stag=0.05, align='center', cid=None, strike=None):
    """Ligne de texte qui monte depuis un masque (mot par mot) et sort vers le haut. strike=(t, durée) : un trait fin la barre."""
    i = cid or uid('t'); hgt = math.ceil(size * lh) + 2
    ws = text.split(' ') if words else [text]
    inner = ' '.join(f'<span class="{i}w" style="display:inline-block">{w}</span>' for w in ws)
    bar = f'<span id="{i}b" style="position:absolute;left:-8px;right:-8px;top:54%;height:3px;background:{BRASS};border-radius:2px;transform-origin:0 50%;box-shadow:0 0 10px rgba(208,160,112,.6)"></span>' if strike else ''
    h.append(f'<div id="{i}" style="position:absolute;left:64px;right:64px;top:{top}px;height:{hgt}px;overflow:hidden;text-align:{align};z-index:{z}">'
             f'<div style="{family};font-weight:{weight};font-size:{size}px;line-height:{lh};letter-spacing:{track};color:{color};white-space:nowrap">'
             f'<span style="position:relative;display:inline-block">{inner}{bar}</span></div></div>')
    j.append(f'gsap.set(".{i}w",{{yPercent:140}});')
    j.append(f'tl.to(".{i}w",{{yPercent:0,duration:{dur},ease:"{OUT_E}",stagger:{stag}}},{round(t_in, 3)});')
    if strike:
        j.append(f'gsap.set("#{i}b",{{scaleX:0}});')
        j.append(f'tl.to("#{i}b",{{scaleX:1,duration:{strike[1]},ease:"power2.inOut"}},{strike[0]});')
    if t_out is not None:
        j.append(f'tl.to(".{i}w",{{yPercent:-140,duration:0.5,ease:"power3.in",stagger:0.025}},{round(t_out - 0.5, 3)});')
        if strike: j.append(f'tl.to("#{i}b",{{opacity:0,duration:0.3}},{round(t_out - 0.5, 3)});')
    return i

def eyebrow(text, t_in, t_out, cid=None):
    return mline(text.upper(), Y_EYE, t_in, t_out, size=22, weight=600, color=BRASS, track='0.26em', words=False, dur=0.8, cid=cid)

def clipvid(src, t0, t1, ms=0.0, z=10, extra='', rate=1.0, track=None):
    i = uid('v'); tr = track if track is not None else 2 + k_[0] % 3
    h.append(f'<video id="{i}" class="clip" src="assets/video/{src}.mp4" muted playsinline data-start="{t0}" data-duration="{round(t1 - t0, 3)}" data-media-start="{ms}" data-playback-rate="{rate}" data-track-index="{tr}" '
             f'style="position:absolute;left:0;top:0;width:{W}px;height:{H}px;object-fit:cover;z-index:{z};{extra}"></video>')
    return i

# ---------- fond, grain, vignette
h.append('<div id="encre" class="encre" style="z-index:1"></div>')
h.append('<div id="grain" style="position:absolute;left:-60px;top:-60px;width:1200px;height:2040px;background:url(assets/img/grain.png);opacity:.06;z-index:800;pointer-events:none;mix-blend-mode:overlay"></div>')
j.append(f'tl.fromTo("#grain",{{x:0,y:0}},{{x:-48,y:37,duration:{D},ease:"steps({int(D * 12)})"}},0);')
h.append('<div id="vig" style="position:absolute;inset:0;z-index:780;pointer-events:none;background:radial-gradient(120% 85% at 50% 42%,rgba(0,0,0,0) 58%,rgba(6,18,12,.55) 100%)"></div>')

# ================= 1 · LA NUIT (0 – 7) : un point de lumière ouvre l'image
LX, LY = 580, 628                              # la frontale dans le plan j01
nuit = clipvid('j01', 0.0, 7.4, 0.0, z=10)
j.append(f'gsap.set("#{nuit}",{{clipPath:"circle(0px at {LX}px {LY}px)"}});')
T(f'#{nuit}', {'clipPath': f'circle(0px at {LX}px {LY}px)', 'scale': 1.12}, {'clipPath': f'circle(2300px at {LX}px {LY}px)', 'duration': 1.8, 'ease': 'power3.inOut'}, 0.5)
TO(f'#{nuit}', {'scale': 1.0, 'duration': 5.6, 'ease': 'none'}, 1.8)
h.append(f'<div id="lux" style="position:absolute;left:{LX - 9}px;top:{LY - 9}px;width:18px;height:18px;border-radius:9px;background:#FFE7C2;box-shadow:0 0 40px 12px rgba(255,214,160,.55);z-index:20;opacity:0"></div>')
T('#lux', {'opacity': 0, 'scale': 0.2}, {'opacity': 1, 'scale': 1, 'duration': 0.5, 'ease': 'power2.out'}, 0.05)
TO('#lux', {'opacity': 0, 'scale': 3, 'duration': 0.9, 'ease': 'power2.in'}, 0.9)
# la voix de l'app : une pastille sobre
h.append(f'<div id="guide" style="position:absolute;left:0;right:0;top:1290px;text-align:center;z-index:120;opacity:0">'
         f'<span style="display:inline-flex;align-items:center;gap:18px;padding:22px 36px;border-radius:44px;background:rgba(11,15,12,.55);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(18px);{SANS};font-weight:600;font-size:40px;letter-spacing:-0.01em;color:{STONE}">'
         f'{ico("turnl", "ico", "width:40px;height:40px;color:" + BRASS)}200 m<span style="font-weight:500;color:{GREY}">à gauche</span></span></div>')
T('#guide', {'opacity': 0, 'y': 24}, {'opacity': 1, 'y': 0, 'duration': 0.9, 'ease': OUT_E}, 0.7)
TO('#guide', {'opacity': 0, 'y': -16, 'duration': 0.5, 'ease': 'power2.in'}, 2.45)
eyebrow('05 h 12 · 2 352 m', 1.1, 2.6)
# il y a six mois, tu disais encore : pas pour moi.
mline('Il y a six mois,', Y_H1, 2.72, 6.9, size=60)
mline('tu disais encore :', Y_H1 + 80, 3.93, 6.9, size=54, weight=500, color=GREY)
h.append(f'<div id="ppm" style="position:absolute;left:0;right:0;top:560px;height:176px;overflow:hidden;text-align:center;z-index:121">'
         f'<div id="ppmi" style="{GAR};font-size:150px;line-height:1.15;color:{BRASS}">pas pour moi.</div></div>')
j.append('gsap.set("#ppmi",{yPercent:140});')
TO('#ppmi', {'yPercent': 0, 'duration': 1.0, 'ease': OUT_E}, 5.45)
# le trait qui barre l'excuse… deviendra l'horizon
CX, R = 540, 1600; CY = HOR + R
def pt(a, r=R): a = math.radians(a); return CX + r * math.sin(a), CY - r * math.cos(a)
NPT = 48
def arcpath(a0, a1, r=R, n=NPT): return 'M' + ' L'.join(f'{pt(a0 + (a1 - a0) * i / n, r)[0]:.1f} {pt(a0 + (a1 - a0) * i / n, r)[1]:.1f}' for i in range(n + 1))
line_y = 668
strike = 'M' + ' L'.join(f'{300 + 480 * i / NPT:.1f} {line_y}' for i in range(NPT + 1))
horizon = arcpath(-22, 22)
A0, A1, A2 = -12, 3, 11                        # Annecy, Chamonix, Lac Blanc
h.append(f'<svg id="sv" width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position:absolute;left:0;top:0;z-index:125;overflow:visible" aria-hidden="true">'
         f'<path id="trait" d="{strike}" fill="none" stroke="{BRASS}" stroke-width="5" stroke-linecap="round" style="filter:drop-shadow(0 0 8px rgba(255,200,140,.7))"/>'
         f'<path id="horiz" d="{horizon}" fill="none" stroke="none"/></svg>')
j.append('(function(){const p=document.getElementById("trait"); const L=p.getTotalLength(); gsap.set(p,{strokeDasharray:L+" "+L, strokeDashoffset:L});'
         'tl.to(p,{strokeDashoffset:0,duration:0.7,ease:"power2.inOut"},6.15); tl.set(p,{strokeDasharray:"none"},6.9);'
         'tl.to(p,{morphSVG:{shape:"#horiz"},duration:1.3,ease:"power3.inOut"},6.95); tl.to(p,{opacity:0,duration:0.6},8.25);})();')
TO('#ppmi', {'yPercent': -140, 'duration': 0.6, 'ease': 'power3.in'}, 6.9)
TO(f'#{nuit}', {'opacity': 0, 'duration': 1.0, 'ease': 'power2.inOut'}, 6.6)

# ================= LA TERRE (fil rouge)
h.append(f'<div id="terre" style="position:absolute;left:{CX - R}px;top:{HOR}px;width:{2 * R}px;height:{2 * R}px;border-radius:{R}px;overflow:hidden;z-index:40;'
         f'box-shadow:0 -12px 80px rgba(150,190,230,.42),0 0 0 2px rgba(190,220,255,.3);background:#06120C;opacity:0">'
         f'<div id="sol" style="position:absolute;left:{R - 1300}px;top:-120px;width:2600px;height:1950px;background:url(assets/img/alpes-z8.jpg) center/cover;filter:brightness(.62) saturate(.95)"></div>'
         f'<div style="position:absolute;inset:0;border-radius:{R}px;background:radial-gradient(circle at 50% 6%,rgba(0,0,0,0) 0%,rgba(6,18,12,.3) 14%,rgba(6,18,12,.9) 34%)"></div></div>')
T('#terre', {'opacity': 0}, {'opacity': 1, 'duration': 1.0, 'ease': 'power2.out'}, 7.7)
T('#sol', {'x': 0}, {'x': -360, 'duration': D - 7.7, 'ease': 'none'}, 7.7)
pins = [(A0, 'Annecy'), (A1, 'Chamonix'), (A2, 'Lac Blanc')]
route = arcpath(A0, A2, R - 10, 60)
h.append(f'<svg id="sv2" width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position:absolute;left:0;top:0;z-index:46;overflow:visible" aria-hidden="true">'
         f'<path id="plan" d="{route}" fill="none" stroke="{STONE}" stroke-opacity=".55" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" opacity="0"/>'
         f'<path id="route" d="{route}" fill="none" stroke="{BRASS}" stroke-width="6" stroke-linecap="round" style="filter:drop-shadow(0 0 8px rgba(255,200,140,.8))" opacity="0"/>'
         + ''.join(f'<circle id="pin{k}" cx="{pt(a, R - 10)[0]:.1f}" cy="{pt(a, R - 10)[1]:.1f}" r="7" fill="{STONE}" stroke="{BRASS}" stroke-width="4" opacity="0"/>' for k, (a, _) in enumerate(pins))
         + '</svg>')
for k, (a, nm) in enumerate(pins):
    x, y = pt(a, R - 10)
    h.append(f'<div id="pl{k}" style="position:absolute;left:{x:.0f}px;top:{y + 22:.0f}px;{SANS};font-weight:600;font-size:18px;letter-spacing:.2em;text-transform:uppercase;color:rgba(250,248,245,.7);z-index:47;opacity:0">{nm}</div>')
    j.append(f'gsap.set("#pl{k}",{{xPercent:-50}});')
    T(f'#pin{k}', {'opacity': 0, 'attr': {'r': 1}}, {'opacity': 1, 'attr': {'r': 7}, 'duration': 0.5, 'ease': 'back.out(2)'}, 8.0 + 0.15 * k)
    T(f'#pl{k}', {'opacity': 0, 'y': 6}, {'opacity': 1, 'y': 0, 'duration': 0.6}, 8.1 + 0.15 * k)
    TO(f'#pl{k}', {'opacity': 0, 'duration': 0.5}, 9.6)
T('#plan', {'opacity': 0}, {'opacity': 1, 'duration': 0.8}, 8.0)
j.append('(function(){const p=document.getElementById("route"); const L=p.getTotalLength(); gsap.set(p,{strokeDasharray:L+" "+L, strokeDashoffset:L});'
         f'tl.set(p,{{opacity:1}},15.9); tl.to(p,{{strokeDashoffset:L*{1 - (A1 - A0) / (A2 - A0):.3f},duration:1.0,ease:"power2.inOut"}},15.9);'
         'tl.to(p,{strokeDashoffset:0,duration:1.8,ease:"power2.inOut"},20.4);})();')

# ================= LE TÉLÉPHONE : tracé depuis Annecy
ax, ay = pt(A1, R - 10)
r_ = 70; x0, y0, x1, y1 = PH[0], PH[1], PH[0] + PH[2], PH[1] + PH[3]
outline = (f'M{ax:.1f} {ay:.1f} L{ax:.1f} {y1} L{x1 - r_} {y1} A{r_} {r_} 0 0 0 {x1} {y1 - r_} L{x1} {y0 + r_} A{r_} {r_} 0 0 0 {x1 - r_} {y0} '
           f'L{x0 + r_} {y0} A{r_} {r_} 0 0 0 {x0} {y0 + r_} L{x0} {y1 - r_} A{r_} {r_} 0 0 0 {x0 + r_} {y1} L{CX} {y1}')
h.append(f'<svg id="sv3" width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position:absolute;left:0;top:0;z-index:56;overflow:visible" aria-hidden="true">'
         f'<path id="contour" d="{outline}" fill="none" stroke="{BRASS}" stroke-width="3" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(255,200,140,.6))"/></svg>')
j.append('(function(){const p=document.getElementById("contour"); const L=p.getTotalLength(); gsap.set(p,{strokeDasharray:L+" "+L, strokeDashoffset:L});'
         'tl.to(p,{strokeDashoffset:0,duration:1.0,ease:"power2.inOut"},8.3); tl.to(p,{opacity:0,duration:0.5},9.3);})();')
h.append(f'<div id="ph" style="position:absolute;left:{PH[0]}px;top:{PH[1]}px;width:{PH[2]}px;height:{PH[3]}px;border-radius:70px;border:10px solid #0A0F0C;'
         f'box-shadow:0 60px 140px rgba(0,0,0,.55),0 0 0 1.5px rgba(255,255,255,.12);z-index:55;opacity:0">'
         f'<div style="position:absolute;left:50%;top:14px;width:118px;height:34px;margin-left:-59px;border-radius:17px;background:#000"></div></div>')
T('#ph', {'opacity': 0}, {'opacity': 1, 'duration': 0.5}, 9.0)
TO('#ph', {'opacity': 0, 'scale': 1.04, 'duration': 0.5, 'ease': 'power2.in'}, 18.45); TO('#scr', {'opacity': 0, 'duration': 0.2}, 18.6)
# l'écran : un cadre fixe qui masque les vraies vidéos de l'app (poussées comme sur iOS)
SCR_CLIP = f'inset({SC[1]}px {W - SC[0] - SC[2]}px {H - SC[1] - SC[3]}px {SC[0]}px round 60px)'
SCR = []   # les vraies vidéos de l'app vivent dans un écran masqué (débordement caché), comme dans un vrai téléphone
def screen(src, t0, t1, ms, rate=1.0):
    i = uid('s')
    SCR.append(f'<video id="{i}" class="clip" src="assets/video/{src}.mp4" muted playsinline data-start="{t0}" data-duration="{round(t1 - t0, 3)}" data-media-start="{ms}" data-playback-rate="{rate}" data-track-index="{5 + k_[0] % 2}" '
               f'style="position:absolute;left:0;top:0;width:{SC[2]}px;height:{SC[3]}px;object-fit:cover;object-position:top;opacity:0"></video>')
    return i
s1 = screen('explorer', 8.9, 12.4, 0.9)
T(f'#{s1}', {'opacity': 0, 'scale': 0.98}, {'opacity': 1, 'scale': 1, 'duration': 0.6, 'ease': 'power2.out'}, 9.0)
s2 = screen('compas', 11.9, 16.35, 0.726)
s3 = screen('club', 15.95, 18.8, 0.814)
def push(old, new, t):     # transition iOS : l'ancien glisse un peu à gauche et s'assombrit, le nouveau entre par la droite
    T(f'#{new}', {'opacity': 1, 'x': SC[2]}, {'opacity': 1, 'x': 0, 'duration': 0.7, 'ease': 'power4.inOut'}, t)
    T(f'#{old}', {'x': 0, 'filter': 'brightness(1)'}, {'x': -SC[2] * 0.3, 'filter': 'brightness(.5)', 'duration': 0.7, 'ease': 'power4.inOut'}, t, ir=False)
    TO(f'#{old}', {'opacity': 0, 'duration': 0.01}, t + 0.7)

def focus(t0, t1, y0, y1):
    """Le détail utile : un liseré laiton qui se dessine autour, le reste de l'écran s'efface légèrement."""
    i = uid('f'); top = SC[1] + SC[3] * y0; hh = SC[3] * (y1 - y0)
    h.append(f'<div id="{i}d" style="position:absolute;left:{SC[0]}px;top:{SC[1]}px;width:{SC[2]}px;height:{SC[3]}px;border-radius:60px;z-index:57;opacity:0;pointer-events:none;'
             f'background:linear-gradient(to bottom, rgba(6,18,12,.45) 0, rgba(6,18,12,.45) {top - SC[1] - 8:.0f}px, rgba(0,0,0,0) {top - SC[1] - 8:.0f}px, rgba(0,0,0,0) {top - SC[1] + hh + 8:.0f}px, rgba(6,18,12,.45) {top - SC[1] + hh + 8:.0f}px)"></div>')
    h.append(f'<svg id="{i}" width="{W}" height="{H}" style="position:absolute;left:0;top:0;z-index:58;overflow:visible;pointer-events:none" aria-hidden="true">'
             f'<rect id="{i}r" x="{SC[0] + 6}" y="{top - 8:.0f}" width="{SC[2] - 12}" height="{hh + 16:.0f}" rx="28" fill="none" stroke="{BRASS}" stroke-width="2.5"/></svg>')
    j.append(f'(function(){{const p=document.getElementById("{i}r"); const L=2*({SC[2] - 12}+{hh + 16:.0f}); gsap.set(p,{{strokeDasharray:L+" "+L, strokeDashoffset:L}});'
             f'tl.to(p,{{strokeDashoffset:0,duration:0.9,ease:"power2.inOut"}},{t0}); tl.to(p,{{opacity:0,duration:0.4}},{t1 - 0.4});}})();')
    T(f'#{i}d', {'opacity': 0}, {'opacity': 1, 'duration': 0.6}, t0 + 0.2)
    TO(f'#{i}d', {'opacity': 0, 'duration': 0.4}, t1 - 0.4)

def excuse_then_answer(eye, excuse, t, strike_at, answer_lines, eyecid=None):
    """L'excuse s'écrit en titre, un trait fin la barre (à sa largeur), elle s'efface vers le haut ; la réponse de la voix monte à sa place."""
    mline(excuse, Y_H1, t, strike_at + 1.0, size=52, weight=600, color='rgba(250,248,245,.86)', strike=(strike_at, 0.55))
    for k, (txt, t_in, t_out, kind) in enumerate(answer_lines):
        if kind == 'h1': mline(txt, Y_H1, t_in, t_out, size=60)
        else: mline(txt, Y_SUB, t_in, t_out, size=38, weight=500, color=GREY)

# ================= 2 · EXPLORER (9 – 12)
SCR_AT = len(h)
eyebrow('Explorer', 8.9, 12.0)
excuse_then_answer('Explorer', 'Je ne saurais pas où aller.', 9.0, 9.2, [('La carte est vivante.', 9.76, 12.0, 'h1'), ('Le globe s’ouvre sur toi.', 10.2, 12.0, 'sub')])
focus(9.6, 11.0, 0.675, 0.99)
# fonds de carte dans l'écran : Plan · Relief · Satellite (avec un sélecteur iOS)
meta = json.load(open(os.path.join(HERE, '..', 'presentation', 'assets', 'img', 'alpes.json')))['z12']
def P12(lon, lat):
    n = 256 * 2 ** meta['z']; x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x - meta['ox'], y - meta['oy']
mx, my = P12(6.88, 45.94); ms_ = 0.62
for k, (src, t) in enumerate([('plan-z12', 11.0), ('relief-z12', 11.35), ('alpes-z12', 11.7)]):
    i = f'fond{k}'
    h.append(f'<div id="{i}" style="position:absolute;left:{SC[0]}px;top:{SC[1]}px;width:{SC[2]}px;height:{SC[3]}px;border-radius:60px;overflow:hidden;z-index:{59 + k};opacity:0">'
             f'<img src="assets/img/{src}.jpg" alt="" style="position:absolute;left:{SC[2] / 2 - mx * ms_:.0f}px;top:{SC[3] / 2 - my * ms_:.0f}px;width:{meta["w"] * ms_:.0f}px;height:{meta["h"] * ms_:.0f}px"></div>')
    T(f'#{i}', {'opacity': 0, 'scale': 1.04}, {'opacity': 1, 'scale': 1, 'duration': 0.35, 'ease': 'power2.out'}, t)
    TO(f'#{i}', {'opacity': 0, 'duration': 0.3}, 12.1)
seg = ['Plan', 'Relief', 'Satellite']
h.append(f'<div id="seg" style="position:absolute;left:{SC[0] + 40}px;top:{SC[1] + 120}px;width:{SC[2] - 80}px;height:62px;border-radius:31px;background:rgba(255,255,255,.82);backdrop-filter:blur(16px);'
         f'box-shadow:0 8px 24px rgba(11,31,23,.18);display:flex;padding:5px;z-index:63;opacity:0">'
         f'<div id="segk" style="position:absolute;left:5px;top:5px;width:{(SC[2] - 90) / 3:.0f}px;height:52px;border-radius:26px;background:#17402C"></div>'
         + ''.join(f'<div id="seg{k}" style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;{SANS};font-weight:600;font-size:22px;color:{"#FAF8F5" if k == 0 else "#17402C"}">{s}</div>' for k, s in enumerate(seg)) + '</div>')
T('#seg', {'opacity': 0, 'y': -10}, {'opacity': 1, 'y': 0, 'duration': 0.4, 'ease': 'power2.out'}, 10.95)
for k, t in enumerate([11.35, 11.7]):
    TO('#segk', {'x': (k + 1) * (SC[2] - 90) / 3, 'duration': 0.35, 'ease': 'power3.inOut'}, t - 0.05)
    TO(f'#seg{k + 1}', {'color': STONE, 'duration': 0.2}, t); TO(f'#seg{k}', {'color': '#17402C', 'duration': 0.2}, t)
TO('#seg', {'opacity': 0, 'duration': 0.3}, 12.1)

# ================= 3 · LE COMPAS (12 – 16)
eyebrow('Le Compas', 12.1, 15.9)
push(s1, s2, 11.95)
excuse_then_answer('Le Compas', 'C’est trop compliqué.', 12.25, 12.45, [('Une phrase.', 13.05, 15.9, 'h1'), ('C’est tout ce qu’on te demande.', 14.27, 15.9, 'sub')])
focus(12.45, 14.9, 0.545, 0.89)
# les mots tapés (12,5 · 13 · 13,5 · 14 · 14,5) sortent du champ et se rangent de part et d'autre
IX, IY = SC[0] + 0.40 * SC[2], SC[1] + 0.651 * SC[3]
slots = [('5 jours', 160, 760), ('les Alpes', 920, 880), ('rando', 160, 1000), ('via ferrata', 920, 1120), ('kayak', 160, 1240)]
for k, (w, x, y) in enumerate(slots):
    i = f'tag{k}'; t = 12.5 + 0.5 * k + 0.12
    h.append(f'<div id="{i}" style="position:absolute;left:{x}px;top:{y}px;padding:14px 26px;border-radius:30px;border:1.5px solid rgba(208,160,112,.7);background:rgba(11,15,12,.5);'
             f'{SANS};font-weight:600;font-size:26px;letter-spacing:-0.01em;color:{STONE};white-space:nowrap;z-index:70;opacity:0">{w}</div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50,yPercent:-50}});')
    T(f'#{i}', {'opacity': 0, 'x': IX - x, 'y': IY - y, 'scale': 0.5}, {'opacity': 1, 'x': 0, 'y': 0, 'scale': 1, 'duration': 0.8, 'ease': 'expo.out'}, t)
    # elles convergent vers la pastille « Je prépare ton aventure… »
    TO(f'#{i}', {'x': CX - x, 'y': 1640 - y, 'scale': 0.6, 'opacity': 0, 'duration': 0.6, 'ease': 'power3.in'}, 14.85 + 0.04 * k)
h.append(f'<div id="prep" style="position:absolute;left:{CX}px;top:1640px;width:470px;height:104px;border-radius:52px;background:#0B0F0C;border:1px solid rgba(255,255,255,.12);'
         f'box-shadow:0 24px 60px rgba(0,0,0,.5);display:flex;flex-direction:column;justify-content:center;padding:0 34px;z-index:72;opacity:0">'
         f'<div style="{SANS};font-weight:600;font-size:30px;letter-spacing:-0.01em;color:{STONE}">Je prépare ton aventure…</div>'
         f'<div style="{SANS};font-weight:500;font-size:21px;color:{GREY};margin-top:6px">Nuits, trajet, kit et budget</div></div>')
j.append('gsap.set("#prep",{xPercent:-50,yPercent:-50});')
T('#prep', {'opacity': 0, 'scale': 0.7}, {'opacity': 1, 'scale': 1, 'duration': 0.6, 'ease': 'back.out(1.6)'}, 15.3)
# la pastille se réduit en point et tombe sur Chamonix ; la route Annecy → Chamonix se trace
cx_, cy_ = pt(A1, R - 10)
TO('#prep', {'width': 104, 'padding': 0, 'backgroundColor': BRASS, 'borderColor': BRASS, 'duration': 0.35, 'ease': 'power3.inOut'}, 15.65)
TO('#prep > div', {'opacity': 0, 'duration': 0.15}, 15.6)
TO('#prep', {'scale': 0.14, 'x': cx_ - CX, 'y': cy_ - 1640, 'duration': 0.55, 'ease': 'power3.in'}, 16.0)
TO('#prep', {'opacity': 0, 'duration': 0.1}, 16.55)
T('#pin1', {'attr': {'r': 7}}, {'attr': {'r': 13}, 'duration': 0.2, 'yoyo': True, 'repeat': 1}, 16.55, ir=False)

# ================= 4 · LA CORDÉE (16 – 20)
eyebrow('Cordée des Alpes', 16.2, 18.7)
push(s2, s3, 16.0)
excuse_then_answer('Cordée', 'Je n’ai personne avec qui partir.', 16.25, 16.6, [('Des inconnus,', 17.15, 20.0, 'h1'), ('puis des prénoms.', 18.0, 20.0, 'sub')])
focus(16.9, 18.3, 0.12, 0.62)
# des avatars montent de Chamonix, se posent de part et d'autre, puis rejoignent la liste
avs = [('J', 'Julien', '#17402C', 150, 760), ('S', 'Sofia', '#B84A32', 930, 840), ('M', 'Marc', '#5B7F55', 150, 980), ('C', 'Claire', '#7E5A30', 930, 1060)]
for k, (a, nm, col, x, y) in enumerate(avs):
    i = f'av{k}'
    h.append(f'<div id="{i}" style="position:absolute;left:{x}px;top:{y}px;display:flex;flex-direction:column;align-items:center;gap:10px;z-index:70;opacity:0">'
             f'<div style="width:76px;height:76px;border-radius:38px;background:{col};border:3px solid {STONE};display:flex;align-items:center;justify-content:center;{SANS};font-weight:700;font-size:30px;color:{STONE}">{a}</div>'
             f'<div style="{SANS};font-weight:600;font-size:20px;letter-spacing:.04em;color:{STONE}">{nm}</div></div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50,yPercent:-50}});')
    T(f'#{i}', {'opacity': 0, 'x': cx_ - x, 'y': cy_ - y, 'scale': 0.3}, {'opacity': 1, 'x': 0, 'y': 0, 'scale': 1, 'duration': 0.9, 'ease': 'expo.out'}, 16.7 + 0.12 * k)
    TO(f'#{i}', {'x': CX - x, 'y': SC[1] + 0.35 * SC[3] - y, 'scale': 0.4, 'opacity': 0, 'duration': 0.6, 'ease': 'power3.in'}, 17.45 + 0.05 * k)
# l'écran s'ouvre et devient la photo du refuge
ref = clipvid('g12', 18.4, 20.9, 0.6, z=65)
inset0 = f'inset({SC[1]}px {W - SC[0] - SC[2]}px {H - SC[1] - SC[3]}px {SC[0]}px round 60px)'
j.append(f'gsap.set("#{ref}",{{clipPath:"{inset0}"}});')
T(f'#{ref}', {'clipPath': inset0, 'scale': 1.0}, {'clipPath': 'inset(0px 0px 0px 0px round 0px)', 'duration': 1.0, 'ease': 'power4.inOut'}, 18.45)
TO(f'#{ref}', {'scale': 1.06, 'duration': 2.0, 'ease': 'none'}, 18.9)
SET('#terre', {'zIndex': 66}, 18.4); SET('#sv2', {'zIndex': 67}, 18.4)
for k, (nm, x) in enumerate([('Julien', 120), ('Sofia', 300), ('Marc', 680), ('Claire', 905)]):
    i = uid('n')
    h.append(f'<div id="{i}" style="position:absolute;left:{x}px;top:560px;padding:10px 20px;border-radius:24px;background:rgba(250,248,245,.92);{SANS};font-weight:600;font-size:26px;color:{INK};z-index:110;opacity:0">{nm}</div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50}});')
    T(f'#{i}', {'opacity': 0, 'y': 14}, {'opacity': 1, 'y': 0, 'duration': 0.7, 'ease': OUT_E}, 19.0 + 0.2 * k)
    TO(f'#{i}', {'opacity': 0, 'duration': 0.4}, 20.2)

# ================= 5 · L'AUBE (20 – 25,5) : elle se lève depuis l'horizon
aube = clipvid('a02', 20.0, 26.0, 0.5, z=68)
j.append(f'gsap.set("#{aube}",{{clipPath:"inset(100% 0% 0% 0%)"}});')
T(f'#{aube}', {'clipPath': 'inset(100% 0% 0% 0%)', 'scale': 1.1}, {'clipPath': 'inset(0% 0% 0% 0%)', 'scale': 1.04, 'duration': 0.95, 'ease': 'power3.inOut'}, 20.0)
TO(f'#{aube}', {'scale': 1.0, 'duration': 5.0, 'ease': 'none'}, 20.95)
SET('#terre', {'zIndex': 69}, 19.95); SET('#sv2', {'zIndex': 70}, 19.95)
mline('Puis le lac.', Y_H1, 20.85, 21.75, color=INK, z=130, size=60)
mline('Le Mont-Blanc, qui s’allume.', Y_H1, 21.8, 23.7, color=INK, z=130, size=56)
h.append(f'<div id="toi" style="position:absolute;left:0;right:0;top:250px;height:182px;overflow:hidden;text-align:center;z-index:130">'
         f'<div id="toii" style="{GAR};font-size:150px;line-height:1.2;color:{INK}">Toi. <span style="color:#7E5A30">Ici.</span></div></div>')
j.append('gsap.set("#toii",{yPercent:140});')
TO('#toii', {'yPercent': 0, 'duration': 1.1, 'ease': OUT_E}, 23.85); TO('#toii', {'yPercent': -140, 'duration': 0.6, 'ease': 'power3.in'}, 25.1)
# la carte vit : trois repères posés sur une même ligne, au-dessus de l'horizon
row = [('bed', 'Nuit', 'Refuge du Lac Blanc'), ('paw', 'Pokédex', 'Marmotte'), ('users', 'Rencontre', 'Claire')]
xs = [260, 540, 820]
for k, ((icn, a, b), x) in enumerate(zip(row, xs)):
    i = f'row{k}'
    h.append(f'<div id="{i}" style="position:absolute;left:{x}px;top:1590px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 20px;width:250px;border-radius:24px;'
             f'background:rgba(250,248,245,.9);box-shadow:0 14px 36px rgba(6,18,12,.25);z-index:110;opacity:0">'
             f'<div style="display:flex;align-items:center;gap:8px;{SANS};font-weight:600;font-size:22px;color:{INK}">{ico(icn, "ico", "width:24px;height:24px;color:#17402C")}{a}</div>'
             f'<div style="{SANS};font-weight:500;font-size:19px;color:#5E6B63;white-space:nowrap">{b}</div></div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50}});')
    T(f'#{i}', {'opacity': 0, 'y': 30}, {'opacity': 1, 'y': 0, 'duration': 0.8, 'ease': OUT_E}, 21.2 + 0.35 * k)
    TO(f'#{i}', {'opacity': 0, 'y': -10, 'duration': 0.4, 'ease': 'power2.in'}, 24.7 + 0.05 * k)
# le point de position parcourt la route jusqu'au Lac Blanc
h.append(f'<div id="moi" style="position:absolute;left:0;top:0;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:12px;background:{BRASS};border:4px solid {STONE};'
         f'box-shadow:0 0 0 10px rgba(208,160,112,.25),0 0 30px rgba(255,200,140,.8);z-index:72;opacity:0"></div>')
f_cham = (A1 - A0) / (A2 - A0)
j.append(f'tl.set("#moi",{{opacity:1}},20.4); tl.fromTo("#moi",{{motionPath:{{path:"#route",align:"#route",alignOrigin:[0,0],start:{f_cham:.3f},end:{f_cham:.3f}}}}},'
         f'{{motionPath:{{path:"#route",align:"#route",alignOrigin:[0,0],start:{f_cham:.3f},end:1}},duration:1.8,ease:"power2.inOut",immediateRender:false}},20.4);')
TO('#plan', {'opacity': 0, 'duration': 0.5}, 24.8)
for k in range(3): TO(f'#pin{k}', {'opacity': 0, 'duration': 0.4}, 24.8)

# ================= 6 · LE LOGO (25,5 – 31) : le point monte et devient l'anneau
h.append('<div id="enc2" style="position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 38%,#10291E 0%,#06120C 70%);z-index:71;opacity:0"></div>')
T('#enc2', {'opacity': 0}, {'opacity': 1, 'duration': 0.9, 'ease': 'power2.inOut'}, 25.0)
TO('#route', {'opacity': 0, 'duration': 0.6}, 25.0)
RX, RY = CX, 700
j.append(f'tl.to("#moi",{{x:{RX},y:{RY},duration:0.9,ease:"power3.inOut"}},25.1);')
h.append(f'<div id="anneau" style="position:absolute;left:{RX - 150}px;top:{RY - 150}px;width:300px;height:300px;border-radius:150px;border:3px solid {BRASS};z-index:73;opacity:0;box-shadow:0 0 40px rgba(208,160,112,.35)"></div>')
T('#anneau', {'opacity': 0, 'scale': 0.08}, {'opacity': 1, 'scale': 1, 'duration': 0.9, 'ease': 'expo.out'}, 25.95)
TO('#moi', {'opacity': 0, 'scale': 0.5, 'duration': 0.3}, 25.95)
h.append(f'<img id="logo" src="assets/img/badge-anneau.png" alt="" style="position:absolute;left:{RX - 140}px;top:{RY - 140}px;width:280px;height:280px;z-index:74;opacity:0">')
T('#logo', {'opacity': 0, 'scale': 0.92}, {'opacity': 1, 'scale': 1, 'duration': 1.0, 'ease': 'power2.out'}, 26.4)
TO('#anneau', {'opacity': 0, 'scale': 1.25, 'duration': 0.9, 'ease': 'power2.out'}, 26.5)
mline('LE KIT DU VOYAGEUR', 930, 26.6, None, size=58, weight=600, track='0.2em', words=False, z=80)
h.append(f'<div id="tag" style="position:absolute;left:0;right:0;top:1016px;height:84px;overflow:hidden;text-align:center;z-index:80">'
         f'<div id="tagi" style="{GAR};font-size:62px;line-height:1.3;color:{BRASS}">Là où la carte se termine.</div></div>')
j.append('gsap.set("#tagi",{yPercent:140});')
TO('#tagi', {'yPercent': 0, 'duration': 1.1, 'ease': OUT_E}, 27.45)
T('#terre', {'filter': 'brightness(1)'}, {'filter': 'brightness(1.2)', 'duration': 2.0}, 25.5, ir=False)
TO('#root > *:not(audio)', {'opacity': 0, 'duration': 0.9}, D - 1.0)

h.insert(SCR_AT, f'<div id="scr" style="position:absolute;left:{SC[0]}px;top:{SC[1]}px;width:{SC[2]}px;height:{SC[3]}px;border-radius:60px;overflow:hidden;z-index:54">' + ''.join(SCR) + '</div>')
html = f'''<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>LKDV — aperçu de la vidéo ultime</title>
    <script src="assets/lib/gsap.min.js"></script>
    <script src="assets/lib/MorphSVGPlugin.min.js"></script>
    <script src="assets/lib/MotionPathPlugin.min.js"></script>
    <link rel="stylesheet" href="assets/fonts.css" />
    <link rel="stylesheet" href="assets/ui.css" />
    <style>
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ width:1080px; height:1920px; overflow:hidden; background:#06120C; }}
      #root {{ position:relative; width:1080px; height:1920px; overflow:hidden; background:#06120C; -webkit-font-smoothing:antialiased; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="1080" data-height="1920">
      {chr(10).join('      ' + x for x in h).strip()}
      <audio id="son" class="clip" src="audio/bande-son3.wav" data-start="0" data-duration="{D}" data-track-index="20" data-volume="1" data-timeline-role="music"></audio>
    </div>
    <script>
      gsap.registerPlugin(MorphSVGPlugin, MotionPathPlugin);
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
