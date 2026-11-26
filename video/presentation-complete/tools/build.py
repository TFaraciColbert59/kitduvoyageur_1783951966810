# Présentation complète de LKDV — 16:9 (1920×1080). Ce fichier construit les 10 premières secondes :
#   0 · Ouverture : un point de lumière s'ouvre en trait laiton ; la devise monte au-dessus ; le trait se courbe en horizon de la Terre ;
#       le prochain voyage de Léa (Vercors) s'allume sur l'horizon.
#   1 · Le Hub (début) : le fil part du Vercors et trace le téléphone ; le vrai Hub s'allume ; ses huit tuiles réelles
#       (captures à 3x du compte de démo, assets/real/hub-*.png) sortent de l'écran et se posent en constellation autour de lui.
# Aucun élément d'interface n'est redessiné : tout ce qui ressemble à l'app EST l'app. Sortie : index.html
import os, math, json
from PIL import Image
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = 10.5
W, H = 1920, 1080
INK, STONE, BRASS, GREY, FOREST = '#0B1F17', '#FAF8F5', '#D0A070', 'rgba(250,248,245,.62)', '#17402C'
SANS = "font-family:Inter,sans-serif"
GAR = "font-family:'EB Garamond Italic',Georgia,serif;font-style:italic;font-weight:400"
OUT_E = 'expo.out'
h, j = [], []
k_ = [0]
def uid(p): k_[0] += 1; return f'{p}{k_[0]}'
def T(sel, a, b, t, ir=True):
    b = dict(b)
    if not ir: b['immediateRender'] = False
    j.append(f'tl.fromTo("{sel}", {json.dumps(a)}, {json.dumps(b)}, {round(t, 3)});')
def TO(sel, b, t): j.append(f'tl.to("{sel}", {json.dumps(b)}, {round(t, 3)});')

def mline(text, top, t_in, t_out=None, size=60, weight=700, color=STONE, track='-0.022em', family=SANS, lh=1.14, z=120, words=True, dur=0.9, stag=0.05, left=120, right=120, align='center'):
    """Ligne de texte qui monte depuis un masque exact (mot par mot) et sort vers le haut. L'entrée finit avant la sortie."""
    i = uid('t'); hgt = math.ceil(size * lh) + 2
    ws = text.split(' ') if words else [text]
    inner = ' '.join(f'<span class="{i}w" style="display:inline-block">{w}</span>' for w in ws)
    h.append(f'<div id="{i}" style="position:absolute;left:{left}px;right:{right}px;top:{top}px;height:{hgt}px;overflow:hidden;text-align:{align};z-index:{z}">'
             f'<div style="{family};font-weight:{weight};font-size:{size}px;line-height:{lh};letter-spacing:{track};color:{color};white-space:nowrap">{inner}</div></div>')
    j.append(f'gsap.set(".{i}w",{{yPercent:140}});')
    if t_out is not None:
        avail = (t_out - 0.5) - t_in - 0.05; tot = dur + stag * (len(ws) - 1)
        if tot > avail: kk = max(avail, 0.3) / tot; dur, stag = max(0.3, dur * kk), stag * kk
    j.append(f'tl.to(".{i}w",{{yPercent:0,duration:{round(dur, 3)},ease:"{OUT_E}",stagger:{round(stag, 4)}}},{round(t_in, 3)});')
    if t_out is not None:
        j.append(f'tl.to(".{i}w",{{yPercent:-140,duration:0.5,ease:"power3.in",stagger:0.025}},{round(t_out - 0.5, 3)});')
    return i

# ---------- fond, grain, vignette
h.append(f'<div id="grain" style="position:absolute;left:-60px;top:-60px;width:{W + 120}px;height:{H + 120}px;background:url(assets/img/grain.png);opacity:.05;z-index:800;pointer-events:none;mix-blend-mode:overlay"></div>')
j.append(f'tl.fromTo("#grain",{{x:0,y:0}},{{x:-48,y:37,duration:{D},ease:"steps({int(D * 12)})"}},0);')
h.append('<div id="vig" style="position:absolute;inset:0;z-index:780;pointer-events:none;background:radial-gradient(90% 80% at 50% 45%,rgba(0,0,0,0) 55%,rgba(4,12,8,.6) 100%)"></div>')

# ================= 0 · OUVERTURE
CX0, LY = 960, 600                               # le point, puis le trait
h.append(f'<div id="lux" style="position:absolute;left:{CX0 - 8}px;top:{LY - 8}px;width:16px;height:16px;border-radius:8px;background:#FFE7C2;'
         f'box-shadow:0 0 36px 10px rgba(255,214,160,.55);z-index:130;opacity:0"></div>')
T('#lux', {'opacity': 0, 'scale': 0.2}, {'opacity': 1, 'scale': 1, 'duration': 0.6, 'ease': 'power2.out'}, 0.3)
TO('#lux', {'scale': 1.35, 'duration': 0.3, 'ease': 'sine.inOut', 'yoyo': True, 'repeat': 1}, 0.7)
TO('#lux', {'opacity': 0, 'scale': 0.4, 'duration': 0.4, 'ease': 'power2.in'}, 1.3)
# deux demi-traits partent du point vers la gauche et la droite ; deux étincelles les mènent
HALF = 330; NPT = 40
def seg(x0, x1): return 'M' + ' L'.join(f'{x0 + (x1 - x0) * i / NPT:.1f} {LY}' for i in range(NPT + 1))
R = 2600; HOR = 880; CY = HOR + R
def pt(a, r=R): a = math.radians(a); return CX0 + r * math.sin(a), CY - r * math.cos(a)
def arc(a0, a1): return 'M' + ' L'.join(f'{pt(a0 + (a1 - a0) * i / NPT)[0]:.1f} {pt(a0 + (a1 - a0) * i / NPT)[1]:.1f}' for i in range(NPT + 1))
h.append(f'<svg id="sv" width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position:absolute;left:0;top:0;z-index:125;overflow:visible" aria-hidden="true">'
         f'<path id="trG" d="{seg(CX0, CX0 - HALF)}" fill="none" stroke="{BRASS}" stroke-width="3" stroke-linecap="round" style="filter:drop-shadow(0 0 6px rgba(255,200,140,.7))"/>'
         f'<path id="trD" d="{seg(CX0, CX0 + HALF)}" fill="none" stroke="{BRASS}" stroke-width="3" stroke-linecap="round" style="filter:drop-shadow(0 0 6px rgba(255,200,140,.7))"/>'
         f'<path id="hzG" d="{arc(0, -21)}" fill="none" stroke="none"/><path id="hzD" d="{arc(0, 21)}" fill="none" stroke="none"/></svg>')
for s in ('G', 'D'):
    h.append(f'<div id="sp{s}" style="position:absolute;left:0;top:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:5px;background:#FFE7C2;box-shadow:0 0 18px 6px rgba(255,214,160,.6);z-index:131;opacity:0"></div>')
    j.append(f'(function(){{const p=document.getElementById("tr{s}"); const L=p.getTotalLength(); gsap.set(p,{{strokeDasharray:L+" "+L, strokeDashoffset:L}});'
             f'tl.to(p,{{strokeDashoffset:0,duration:1.0,ease:"power2.inOut"}},1.0); tl.set(p,{{strokeDasharray:"none"}},2.05);'
             f'tl.to(p,{{morphSVG:{{shape:"#hz{s}"}},duration:1.25,ease:"power3.inOut"}},3.8); tl.to(p,{{opacity:0,duration:0.8}},5.0);}})();')
    j.append(f'tl.set("#sp{s}",{{opacity:1}},1.0); tl.fromTo("#sp{s}",{{motionPath:{{path:"#tr{s}",align:"#tr{s}",alignOrigin:[0.5,0.5],start:0,end:0}}}},'
             f'{{motionPath:{{path:"#tr{s}",align:"#tr{s}",alignOrigin:[0.5,0.5],start:0,end:1}},duration:1.0,ease:"power2.inOut",immediateRender:false}},1.0);'
             f'tl.to("#sp{s}",{{opacity:0,scale:0.3,duration:0.4}},2.0);')
# la devise, au-dessus du trait
mline('LE KIT DU VOYAGEUR', 404, 1.45, 3.75, size=22, weight=600, color=BRASS, track='0.34em', words=False, dur=0.8)
mline('Là où la carte se termine.', 452, 1.7, 3.75, size=104, family=GAR, weight=400, color=STONE, track='-0.005em', lh=1.2, stag=0.08, dur=1.0)

# ---------- LA TERRE (l'horizon reprend le trait)
h.append(f'<div id="terre" style="position:absolute;left:{CX0 - R}px;top:{HOR}px;width:{2 * R}px;height:{2 * R}px;border-radius:{R}px;overflow:hidden;z-index:40;'
         f'box-shadow:0 -14px 90px rgba(150,190,230,.45),0 0 0 2px rgba(190,220,255,.32);background:#06120C;opacity:0">'
         f'<div id="sol" style="position:absolute;left:{R - 1500}px;top:-140px;width:3000px;height:2250px;background:url(assets/img/alpes-z8.jpg) center/cover;filter:brightness(.6) saturate(.95)"></div>'
         f'<div style="position:absolute;inset:0;border-radius:{R}px;background:radial-gradient(circle at 50% 3%,rgba(0,0,0,0) 0%,rgba(6,18,12,.35) 6%,rgba(6,18,12,.92) 15%)"></div></div>')
T('#terre', {'opacity': 0}, {'opacity': 1, 'duration': 1.1, 'ease': 'power2.out'}, 4.3)
T('#sol', {'x': 0}, {'x': -260, 'duration': D - 4.3, 'ease': 'none'}, 4.3)
# le prochain voyage de Léa : Vercors, 5–7 juin (données réelles du compte de démo, Compas et Hub)
VX, VY = pt(0, R - 12)
h.append(f'<div id="vercors" style="position:absolute;left:{VX - 9:.0f}px;top:{VY - 9:.0f}px;width:18px;height:18px;border-radius:9px;background:{STONE};border:4px solid {BRASS};'
         f'box-shadow:0 0 0 10px rgba(208,160,112,.2),0 0 24px rgba(255,200,140,.7);z-index:46;opacity:0"></div>')
T('#vercors', {'opacity': 0, 'scale': 0.2}, {'opacity': 1, 'scale': 1, 'duration': 0.6, 'ease': 'back.out(2)'}, 4.9)
mline('VERCORS · 5–7 JUIN', int(VY + 26), 5.0, 6.75, size=18, weight=600, color='rgba(250,248,245,.75)', track='0.26em', words=False, z=47, dur=0.7)
mline('Une aventure,', 330, 5.2, 6.7, size=76)
mline('de l’envie au retour.', 420, 5.45, 6.7, size=76, weight=500, color=GREY)

# ================= 1 · LE HUB
SC_H = 640; S = SC_H / 852; SC_W = 393 * S                  # écran : 393×852 points CSS à l'échelle S
SC = (CX0 - SC_W / 2, 214, SC_W, SC_H)                       # x, y, largeur, hauteur
BZ = 11                                                      # cadre
PHX, PHY, PHW, PHH = SC[0] - BZ, SC[1] - BZ, SC_W + 2 * BZ, SC_H + 2 * BZ
r_ = 52; x0, y0, x1, y1 = PHX, PHY, PHX + PHW, PHY + PHH
outline = (f'M{VX:.1f} {VY:.1f} L{CX0} {y1} L{x1 - r_:.1f} {y1:.1f} A{r_} {r_} 0 0 0 {x1:.1f} {y1 - r_:.1f} L{x1:.1f} {y0 + r_:.1f} A{r_} {r_} 0 0 0 {x1 - r_:.1f} {y0:.1f} '
           f'L{x0 + r_:.1f} {y0:.1f} A{r_} {r_} 0 0 0 {x0:.1f} {y0 + r_:.1f} L{x0:.1f} {y1 - r_:.1f} A{r_} {r_} 0 0 0 {x0 + r_:.1f} {y1:.1f} L{CX0} {y1:.1f}')
h.append(f'<svg id="sv3" width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position:absolute;left:0;top:0;z-index:56;overflow:visible" aria-hidden="true">'
         f'<path id="contour" d="{outline}" fill="none" stroke="{BRASS}" stroke-width="3" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(255,200,140,.6))"/></svg>')
j.append('(function(){const p=document.getElementById("contour"); const L=p.getTotalLength(); gsap.set(p,{strokeDasharray:L+" "+L, strokeDashoffset:L});'
         'tl.to(p,{strokeDashoffset:0,duration:0.75,ease:"power2.inOut"},6.6); tl.to(p,{opacity:0,duration:0.5},7.4);})();')
h.append(f'<div id="ph" style="position:absolute;left:{PHX:.1f}px;top:{PHY:.1f}px;width:{PHW:.1f}px;height:{PHH:.1f}px;border-radius:{r_}px;background:#0A0F0C;'
         f'box-shadow:0 50px 120px rgba(0,0,0,.55),0 0 0 1.5px rgba(255,255,255,.12);z-index:55;opacity:0"></div>')
T('#ph', {'opacity': 0}, {'opacity': 1, 'duration': 0.5}, 7.15)
h.append(f'<div id="scr" style="position:absolute;left:{SC[0]:.1f}px;top:{SC[1]}px;width:{SC_W:.1f}px;height:{SC_H}px;border-radius:{r_ - BZ}px;overflow:hidden;z-index:57;opacity:0">'
         f'<img id="scri" src="assets/screens/hub.png" alt="" style="display:block;width:100%;height:100%">'
         f'<div style="position:absolute;left:50%;top:9px;width:92px;height:27px;margin-left:-46px;border-radius:14px;background:#000"></div></div>')
T('#scr', {'opacity': 0, 'scale': 0.97}, {'opacity': 1, 'scale': 1, 'duration': 0.7, 'ease': 'power2.out'}, 7.3)
mline('01 · LE HUB', 70, 7.85, None, size=22, weight=600, color=BRASS, track='0.3em', words=False, dur=0.8)
mline('Ton aventure, d’un coup d’œil.', 106, 8.0, None, size=56)
# les huit vraies tuiles quittent l'écran et se posent en constellation (centre x, centre y, échelle en px par point CSS, inclinaison)
BOX = {'meteo': (37, 24, 584, 376), 'budget': (598, 24, 1143, 376), 'carte': (37, 390, 677, 1483), 'etapes': (690, 390, 1143, 1483),
       'carnet': (37, 1497, 584, 1762), 'kits': (598, 1497, 1142, 1762), 'paperasse': (37, 1776, 1142, 1984), 'groupe': (37, 1998, 1142, 2284)}
SC_OUT = 1.5
DEST = {'meteo': (612, 318, -1.5), 'carte': (292, 498, 1.2), 'carnet': (612, 540, -0.8), 'paperasse': (436, 856, 0.8),
        'budget': (1308, 318, 1.5), 'etapes': (1626, 498, -1.2), 'kits': (1308, 540, 0.8), 'groupe': (1484, 858, -0.8)}
ORDER = ['meteo', 'budget', 'carte', 'etapes', 'carnet', 'kits', 'paperasse', 'groupe']
for k, name in enumerate(ORDER):
    bx0, by0, bx1, by1 = BOX[name]; cw, chh = (bx1 - bx0) / 3, (by1 - by0) / 3      # taille en points CSS
    sx = SC[0] + (bx0 + bx1) / 6 * S; sy = SC[1] + (by0 + by1) / 6 * S             # centre dans l'écran
    dx, dy, rot = DEST[name]; w_, h_ = cw * SC_OUT, chh * SC_OUT
    i = f'tu{name}'
    h.append(f'<div id="{i}" style="position:absolute;left:{dx}px;top:{dy}px;width:{w_:.0f}px;height:{h_:.0f}px;border-radius:{22 * SC_OUT:.0f}px;overflow:hidden;'
             f'box-shadow:0 26px 60px rgba(4,12,8,.5),0 0 0 1px rgba(255,255,255,.16);z-index:{70 + k};opacity:0">'
             f'<img src="assets/real/hub-{name}.png" alt="" style="display:block;width:100%;height:100%"></div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50,yPercent:-50}});')
    t = 8.25 + 0.125 * k
    T(f'#{i}', {'opacity': 0, 'x': sx - dx, 'y': sy - dy, 'scale': S / SC_OUT, 'rotation': 0},
      {'opacity': 1, 'x': 0, 'y': 0, 'scale': 1, 'rotation': rot, 'duration': 0.95, 'ease': 'expo.out'}, t)
    TO(f'#{i}', {'y': (-6 if k % 2 else 6), 'duration': D - t - 0.95, 'ease': 'sine.inOut'}, t + 0.95)   # flottement
TO('#scri', {'filter': 'brightness(.5)', 'duration': 0.8, 'ease': 'power2.out'}, 8.25)
# légende : le nom de la fonction et ce qu'elle fait
mline('Météo, budget, carte, étapes, carnet, kits, papiers et groupe : tout ton voyage sur un écran.', 972, 9.0, None, size=30, weight=500, color='rgba(250,248,245,.9)', track='-0.005em', stag=0.02, dur=0.8, z=121)

html = f'''<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>LKDV — présentation complète</title>
    <script src="assets/lib/gsap.min.js"></script>
    <script src="assets/lib/MorphSVGPlugin.min.js"></script>
    <script src="assets/lib/MotionPathPlugin.min.js"></script>
    <link rel="stylesheet" href="assets/fonts.css" />
    <style>
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:#06120C; }}
      #root {{ position:relative; width:{W}px; height:{H}px; overflow:hidden; background:radial-gradient(120% 90% at 50% 40%,#0E2219 0%,#06120C 70%); -webkit-font-smoothing:antialiased; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="{W}" data-height="{H}">
      {chr(10).join('      ' + x for x in h).strip()}
      <audio id="son" class="clip" src="audio/bande-son.wav" data-start="0" data-duration="{D}" data-track-index="20" data-volume="1" data-timeline-role="music"></audio>
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
