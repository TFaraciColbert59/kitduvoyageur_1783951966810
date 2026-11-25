# Aperçu « vrais éléments » (31 s) : tout élément d'interface montré est un vrai composant de l'app (enregistrement ou
# capture recadrée à 3x dans assets/real/), jamais une reconstitution. Base : tools/build5.py (légendes) et build4.py. : grille stricte, typographie sobre, et une chaîne de mouvement continue
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
PH = (300, 430, 480, 1040)                     # téléphone (cadre) — laisse la place à la légende dessous
SC = (PH[0] + 10, PH[1] + 10, PH[2] - 20, PH[3] - 20)   # écran : 310, 440, 460 × 1020
Y_CAP = 1512                                   # zone des légendes (sous le téléphone, au-dessus de l'horizon)
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
    if t_out is not None:   # l'entrée mot à mot doit être finie avant que la sortie commence (sinon elle l'emporte)
        avail = (t_out - 0.5) - t_in - 0.05; tot = dur + stag * (len(ws) - 1)
        if tot > avail: k = max(avail, 0.3) / tot; dur, stag = max(0.3, dur * k), stag * k
    j.append(f'tl.to(".{i}w",{{yPercent:0,duration:{round(dur, 3)},ease:"{OUT_E}",stagger:{round(stag, 4)}}},{round(t_in, 3)});')
    if strike:
        j.append(f'gsap.set("#{i}b",{{scaleX:0}});')
        j.append(f'tl.to("#{i}b",{{scaleX:1,duration:{strike[1]},ease:"power2.inOut"}},{strike[0]});')
    if t_out is not None:
        j.append(f'tl.to(".{i}w",{{yPercent:-140,duration:0.5,ease:"power3.in",stagger:0.025}},{round(t_out - 0.5, 3)});')
        if strike: j.append(f'tl.to("#{i}b",{{opacity:0,duration:0.3}},{round(t_out - 0.5, 3)});')
    return i

def caption(name, text, t_in, t_out, lead=True, dark_bg=False):
    """Légende : le nom de la fonction (laiton, petites capitales) et ce qu'elle fait (une phrase). Un fin trait la relie au téléphone."""
    if lead:
        i = uid('ld')
        h.append(f'<div id="{i}" style="position:absolute;left:{CX - 1}px;top:{PH[1] + PH[3] + 4}px;width:2px;height:{Y_CAP - PH[1] - PH[3] - 14}px;background:linear-gradient({BRASS},rgba(208,160,112,.2));transform-origin:50% 0;z-index:119"></div>')
        T(f'#{i}', {'scaleY': 0, 'opacity': 1}, {'scaleY': 1, 'opacity': 1, 'duration': 0.5, 'ease': 'power2.out'}, t_in - 0.15)
        TO(f'#{i}', {'opacity': 0, 'duration': 0.3}, t_out - 0.3)
    if dark_bg:
        i = uid('gb')
        h.append(f'<div id="{i}" style="position:absolute;left:0;right:0;top:{Y_CAP - 220}px;height:440px;background:linear-gradient(rgba(6,18,12,0),rgba(6,18,12,.72) 45%,rgba(6,18,12,.72) 70%,rgba(6,18,12,0));z-index:118;opacity:0"></div>')
        T(f'#{i}', {'opacity': 0}, {'opacity': 1, 'duration': 0.6}, t_in - 0.2); TO(f'#{i}', {'opacity': 0, 'duration': 0.4}, t_out)
    mline(name.upper(), Y_CAP, t_in, t_out, size=20, weight=600, color=BRASS, track='0.26em', words=False, dur=0.8)
    mline(text, Y_CAP + 36, t_in + 0.12, t_out, size=30, weight=500, color='rgba(250,248,245,.88)', track='-0.005em', dur=0.85, stag=0.025)

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
caption('Ton itinéraire', 'Prévu en pointillés, parcouru en plein.', 7.85, 8.85, lead=False)
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
         'tl.to(p,{strokeDashoffset:0,duration:0.7,ease:"power2.inOut"},8.8); tl.to(p,{opacity:0,duration:0.5},9.5);})();')
h.append(f'<div id="ph" style="position:absolute;left:{PH[0]}px;top:{PH[1]}px;width:{PH[2]}px;height:{PH[3]}px;border-radius:70px;border:10px solid #0A0F0C;'
         f'box-shadow:0 60px 140px rgba(0,0,0,.55),0 0 0 1.5px rgba(255,255,255,.12);z-index:55;opacity:0">'
         f'<div style="position:absolute;left:50%;top:14px;width:118px;height:34px;margin-left:-59px;border-radius:17px;background:#000"></div></div>')
T('#ph', {'opacity': 0}, {'opacity': 1, 'duration': 0.5}, 9.3)
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
T(f'#{s1}', {'opacity': 0, 'scale': 0.98}, {'opacity': 1, 'scale': 1, 'duration': 0.5, 'ease': 'power2.out'}, 9.35)
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
    mline(excuse, Y_H1, t, answer_lines[0][1] + 0.02, size=52, weight=600, color='rgba(250,248,245,.86)', strike=(strike_at, 0.45))   # elle a fini de sortir quand la réponse arrive
    for k, (txt, t_in, t_out, kind) in enumerate(answer_lines):
        if kind == 'h1': mline(txt, Y_H1, t_in, t_out, size=60)
        else: mline(txt, Y_SUB, t_in, t_out, size=38, weight=500, color=GREY)


from PIL import Image
def real(src, w, x, y, t_in, t_out, frm=None, to=None, z=110, rad=50, dur=0.9, shadow=True):
    """Un vrai composant de l'app (capture recadrée à 3x, assets/real/), centré en (x, y), largeur w.
    frm=(x0, y0, échelle) : il naît de ce point (sinon il monte de 30 px). to=(x1, y1, échelle) : il y retourne (sinon il s'efface vers le haut)."""
    iw, ih = Image.open(os.path.join(HERE, 'assets', 'real', src + '.png')).size
    s = w / iw; hh = ih * s; i = uid('r')
    sh = 'box-shadow:0 28px 70px rgba(6,18,12,.45),0 0 0 1px rgba(255,255,255,.08);' if shadow else ''
    h.append(f'<div id="{i}" style="position:absolute;left:{x}px;top:{y}px;width:{w:.0f}px;height:{hh:.0f}px;border-radius:{rad * s:.0f}px;overflow:hidden;{sh}z-index:{z};opacity:0">'
             f'<img src="assets/real/{src}.png" alt="" style="display:block;width:100%;height:100%"></div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50,yPercent:-50}});')
    if t_out is not None: dur = min(dur, t_out - (0.55 if to else 0.4) - t_in - 0.02)   # l'entrée finit avant la sortie
    if frm: T(f'#{i}', {'opacity': 0, 'x': frm[0] - x, 'y': frm[1] - y, 'scale': frm[2]}, {'opacity': 1, 'x': 0, 'y': 0, 'scale': 1, 'duration': dur, 'ease': OUT_E}, t_in)
    else: T(f'#{i}', {'opacity': 0, 'y': 30}, {'opacity': 1, 'y': 0, 'duration': dur, 'ease': OUT_E}, t_in)
    if to: TO(f'#{i}', {'x': to[0] - x, 'y': to[1] - y, 'scale': to[2], 'opacity': 0, 'duration': 0.55, 'ease': 'power3.in'}, t_out - 0.55)
    elif t_out is not None: TO(f'#{i}', {'opacity': 0, 'y': -12, 'duration': 0.4, 'ease': 'power2.in'}, t_out - 0.4)
    return i, hh

# ================= 2 · EXPLORER (9 – 12)
SCR_AT = len(h)
eyebrow('Explorer', 8.3, 12.0)
excuse_then_answer('Explorer', 'Je ne saurais pas où aller.', 8.4, 9.0, [('La carte est vivante.', 9.76, 12.0, 'h1'), ('Le globe s’ouvre sur toi.', 10.2, 12.0, 'sub')])
focus(9.6, 11.0, 0.675, 0.99)
caption('Le monde', 'Pays, régions et destinations phares, selon la saison.', 9.75, 10.95)
caption('Fond de carte', 'Relief 3D, satellite ou plan : la carte qu’il faut au terrain.', 11.05, 12.0, lead=False)
# le vrai sélecteur « Fond de carte » de l'Explorer sort de l'écran, agrandi, sous le téléphone
real('fond-de-carte', 820, CX, 1330, 10.9, 12.35, frm=(CX, SC[1] + 0.8 * SC[3], 0.56), rad=40, dur=0.7)

# ================= 3 · LE COMPAS (12 – 16)
eyebrow('Le Compas', 12.0, 15.9)
push(s1, s2, 11.95)
excuse_then_answer('Le Compas', 'C’est trop compliqué.', 11.95, 12.35, [('Une phrase.', 13.05, 15.9, 'h1'), ('C’est tout ce qu’on te demande.', 14.27, 15.9, 'sub')])
focus(12.45, 14.9, 0.545, 0.89)
caption('Le Compas, ton préparateur', 'Il lit ta demande et vérifie tout sur la carte.', 12.6, 14.75)
# la phrase tapée dans le champ du Compas devient le vrai bandeau « Je prépare ton aventure… » (capture réelle)
IX, IY = CX, SC[1] + 0.651 * SC[3]
PW = 620; PHH = 189 * PW / 896
h.append(f'<div id="prep" style="position:absolute;left:{CX}px;top:1588px;width:{PW}px;height:{PHH:.0f}px;z-index:72;opacity:0">'
         f'<div id="prepi" style="position:absolute;inset:0;border-radius:{PHH / 2:.0f}px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5)"><img src="assets/real/compas-prepare.png" alt="" style="display:block;width:100%;height:100%"></div>'
         f'<div id="prepd" style="position:absolute;left:50%;top:50%;width:{PHH:.0f}px;height:{PHH:.0f}px;margin:-{PHH / 2:.0f}px 0 0 -{PHH / 2:.0f}px;border-radius:50%;background:{BRASS};opacity:0"></div></div>')
j.append('gsap.set("#prep",{xPercent:-50,yPercent:-50});')
T('#prep', {'opacity': 0, 'x': IX - CX, 'y': IY - 1588, 'scale': 0.45}, {'opacity': 1, 'x': 0, 'y': 0, 'scale': 1, 'duration': 0.8, 'ease': OUT_E}, 14.7)
# le bandeau se résorbe en point laiton et tombe sur Chamonix ; la route Annecy → Chamonix se trace
cx_, cy_ = pt(A1, R - 10)
TO('#prepi', {'scaleX': PHH / PW, 'opacity': 0, 'duration': 0.35, 'ease': 'power3.inOut'}, 15.7)
TO('#prepd', {'opacity': 1, 'duration': 0.25}, 15.75)
TO('#prep', {'scale': 0.15, 'x': cx_ - CX, 'y': cy_ - 1588, 'duration': 0.55, 'ease': 'power3.in'}, 16.0)
TO('#prep', {'opacity': 0, 'duration': 0.1}, 16.55)
T('#pin1', {'attr': {'r': 7}}, {'attr': {'r': 13}, 'duration': 0.2, 'yoyo': True, 'repeat': 1}, 16.55, ir=False)

# ================= 4 · LA CORDÉE (16 – 20)
eyebrow('Cordée des Alpes', 16.0, 18.7)
push(s2, s3, 16.0)
excuse_then_answer('Cordée', 'Je n’ai personne avec qui partir.', 15.95, 16.3, [('Des inconnus,', 17.15, 20.0, 'h1'), ('puis des prénoms.', 18.0, 20.0, 'sub')])
focus(16.9, 18.3, 0.12, 0.62)
caption('La cordée', 'Membres, guides et encadrants d’un club près de chez toi.', 17.0, 18.35)
# trois vrais membres de la Cordée des Alpes (lignes de la liste « Membres ») naissent du point de Chamonix, puis rentrent dans l'écran
for k, (src, y) in enumerate([('membre-camille', 1170), ('membre-genevieve', 1270), ('membre-jeanluc', 1370)]):
    real(src, 680, CX, y, 16.7 + 0.14 * k, 18.4 + 0.04 * k, frm=(cx_, cy_, 0.12), to=(CX, SC[1] + 0.4 * SC[3], 0.5), rad=34, z=70 + k, dur=0.75)
# l'écran s'ouvre et devient la photo du refuge
ref = clipvid('g12', 18.4, 20.9, 0.6, z=65)
inset0 = f'inset({SC[1]}px {W - SC[0] - SC[2]}px {H - SC[1] - SC[3]}px {SC[0]}px round 60px)'
j.append(f'gsap.set("#{ref}",{{clipPath:"{inset0}"}});')
T(f'#{ref}', {'clipPath': inset0, 'scale': 1.0}, {'clipPath': 'inset(0px 0px 0px 0px round 0px)', 'duration': 1.0, 'ease': 'power4.inOut'}, 18.45)
TO(f'#{ref}', {'scale': 1.06, 'duration': 2.0, 'ease': 'none'}, 18.9)
SET('#terre', {'zIndex': 66}, 18.4); SET('#sv2', {'zIndex': 67}, 18.4)
caption('Rencontres', 'Ceux que tu croises en chemin rejoignent ton carnet.', 19.0, 20.15, lead=False, dark_bg=True)
for k, (src, w, x) in enumerate([('rencontre-marc', 402, 310), ('rencontre-gardienne', 440, 751)]):
    real(src, w, x, 620, 18.9 + 0.22 * k, 20.3, z=110, dur=0.7)

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
# la carte vit : le vrai fil de bord du carnet (cartes réelles) s'empile comme un fil, chaque carte pousse la précédente
h.append('<div id="voile" style="position:absolute;left:0;right:0;top:930px;height:200px;background:radial-gradient(60% 50% at 50% 50%,rgba(250,248,245,.78),rgba(250,248,245,0));z-index:109;opacity:0"></div>')
T('#voile', {'opacity': 0}, {'opacity': 1, 'duration': 0.6}, 20.9); TO('#voile', {'opacity': 0, 'duration': 0.4}, 24.4)
mline('LE FIL DE BORD', 1000, 21.0, 24.75, size=20, weight=700, color='#0B1F17', track='0.26em', words=False, z=111)
mline('Ton carnet s’écrit en marchant.', 1036, 21.12, 24.75, size=32, weight=600, color='#0B1F17', track='-0.005em', z=111, stag=0.03)
feed = [('nuit-pigeonnier', 470), ('pokedex-bouquetin', 470), ('performance-j1', 565)]
ys = [1190, 1390, 1560]
for k, ((src, w), y) in enumerate(zip(feed, ys)):
    real(src, w, CX, y, 21.25 + 0.45 * k, 24.75 + 0.05 * k, z=110 + k, dur=0.8)
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
T('#anneau', {'opacity': 0, 'scale': 0.08}, {'opacity': 1, 'scale': 1, 'duration': 0.55, 'ease': 'expo.out'}, 25.95)
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
