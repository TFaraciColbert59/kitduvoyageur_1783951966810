# Présentation complète de LKDV — 9:16 (1080×1920), 20 premières secondes, 120 BPM (un temps = 0,5 s).
#   0–3 s   HOOK : un vrai écran par temps, téléphone en gros plan ; un verbe claque en haut à chaque temps
#           (Préparer · T'équiper · Partir · Raconter · Partager · Progresser).
#   3–5 s   IMPACT : le téléphone recule, les six écrans rentrent dedans (doubles croches) → « Toute ton aventure. Une seule app. »
#   5–7 s   01 · LE HUB : les huit vraies tuiles jaillissent autour du téléphone puis rentrent.
#   7–19 s  huit vrais tiroirs du Hub, un toutes les 1,5 s : le doigt touche la tuile, le tiroir monte, son détail réel
#           sort de l'écran et se pose sur le temps.
#   19–20 s « Ce n'était que le Hub. »
# Tout ce qui ressemble à l'app EST l'app : captures 393×852 à 3x du compte de démo sur main (assets/screens, assets/real).
import os, math, json
from PIL import Image
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = 20.0
W, H = 1080, 1920
INK, STONE, BRASS, GREY = '#0B1F17', '#FAF8F5', '#D0A070', 'rgba(250,248,245,.66)'
SANS = "font-family:Inter,sans-serif"
OUT_E = 'expo.out'
h, j = [], []
k_ = [0]
def uid(p): k_[0] += 1; return f'{p}{k_[0]}'
def T(sel, a, b, t, ir=True):
    b = dict(b)
    if not ir: b['immediateRender'] = False
    j.append(f'tl.fromTo("{sel}", {json.dumps(a)}, {json.dumps(b)}, {round(t, 3)});')
def TO(sel, b, t): j.append(f'tl.to("{sel}", {json.dumps(b)}, {round(t, 3)});')
def SET(sel, b, t): j.append(f'tl.set("{sel}", {json.dumps(b)}, {round(t, 3)});')

def mline(text, top, t_in, t_out=None, size=60, weight=700, color=STONE, track='-0.025em', lh=1.14, z=120, words=True, dur=0.6, stag=0.04, out=0.28):
    """Ligne qui monte d'un masque exact (mot à mot) ; sortie rapide vers le haut (out secondes), finie à t_out."""
    i = uid('t'); hgt = math.ceil(size * lh) + 2
    ws = text.split(' ') if words else [text]
    inner = ' '.join(f'<span class="{i}w" style="display:inline-block">{w}</span>' for w in ws)
    h.append(f'<div id="{i}" style="position:absolute;left:60px;right:60px;top:{top}px;height:{hgt}px;overflow:hidden;text-align:center;z-index:{z}">'
             f'<div style="{SANS};font-weight:{weight};font-size:{size}px;line-height:{lh};letter-spacing:{track};color:{color};white-space:nowrap">{inner}</div></div>')
    j.append(f'gsap.set(".{i}w",{{yPercent:140}});')
    if t_out is not None:
        avail = (t_out - out) - t_in - 0.03; tot = dur + stag * (len(ws) - 1)
        if tot > avail: kk = max(avail, 0.2) / tot; dur, stag = max(0.2, dur * kk), stag * kk
    j.append(f'tl.to(".{i}w",{{yPercent:0,duration:{round(dur, 3)},ease:"{OUT_E}",stagger:{round(stag, 4)}}},{round(t_in, 3)});')
    if t_out is not None:
        j.append(f'tl.to(".{i}w",{{yPercent:-140,duration:{out},ease:"power3.in",stagger:0.015}},{round(t_out - out, 3)});')
    return i

# ---------- fond, grain, vignette, Terre
h.append(f'<div id="grain" style="position:absolute;left:-60px;top:-60px;width:{W + 120}px;height:{H + 120}px;background:url(assets/img/grain.png);opacity:.05;z-index:800;pointer-events:none;mix-blend-mode:overlay"></div>')
j.append(f'tl.fromTo("#grain",{{x:0,y:0}},{{x:-48,y:37,duration:{D},ease:"steps({int(D * 12)})"}},0);')
h.append('<div id="vig" style="position:absolute;inset:0;z-index:780;pointer-events:none;background:radial-gradient(120% 85% at 50% 42%,rgba(0,0,0,0) 58%,rgba(4,12,8,.55) 100%)"></div>')
CX = 540; R = 1600; HOR = 1730; CY = HOR + R
h.append(f'<div id="terre" style="position:absolute;left:{CX - R}px;top:{HOR}px;width:{2 * R}px;height:{2 * R}px;border-radius:{R}px;overflow:hidden;z-index:20;'
         f'box-shadow:0 -12px 80px rgba(150,190,230,.42),0 0 0 2px rgba(190,220,255,.3);background:#06120C;opacity:0">'
         f'<div id="sol" style="position:absolute;left:{R - 1300}px;top:0;width:2600px;height:1950px;background:url(assets/img/alpes-z8.jpg) center/cover;filter:brightness(.6)"></div>'
         f'<div style="position:absolute;inset:0;border-radius:{R}px;background:radial-gradient(circle at 50% 5%,rgba(0,0,0,0) 0%,rgba(6,18,12,.3) 11%,rgba(6,18,12,.9) 28%)"></div></div>')
T('#terre', {'opacity': 0, 'y': 120}, {'opacity': 1, 'y': 0, 'duration': 0.9, 'ease': 'expo.out'}, 3.0)
T('#sol', {'x': 0}, {'x': -300, 'duration': D - 3.0, 'ease': 'none'}, 3.0)

# ---------- le téléphone (un seul, qui change d'échelle) : écran 393×852 points à l'échelle S
S = 1.12; SW, SH = 393 * S, 852 * S
SX, SY = CX - SW / 2, 440                                   # écran à taille normale
BZ = 13; RAD = 58
h.append(f'<div id="ph" style="position:absolute;left:{SX - BZ:.1f}px;top:{SY - BZ:.1f}px;width:{SW + 2 * BZ:.1f}px;height:{SH + 2 * BZ:.1f}px;border-radius:{RAD + BZ}px;background:#0A0F0C;'
         f'box-shadow:0 60px 140px rgba(0,0,0,.6),0 0 0 1.5px rgba(255,255,255,.14);z-index:50;transform-origin:50% 50%">'
         f'<div id="scr" style="position:absolute;left:{BZ}px;top:{BZ}px;width:{SW:.1f}px;height:{SH:.1f}px;border-radius:{RAD}px;overflow:hidden;background:#E9EEEA">SCREENS</div>'
         f'<div style="position:absolute;left:50%;top:{BZ + 11}px;width:104px;height:31px;margin-left:-52px;border-radius:16px;background:#000;z-index:5"></div></div>')
SCREENS = []
def scr_img(src, z, extra=''):
    i = uid('e'); SCREENS.append(f'<img id="{i}" src="{src}" alt="" style="position:absolute;left:0;top:0;width:100%;height:100%;z-index:{z};{extra}">'); return i

# ================= 0 · HOOK (0 – 3)
BIG = 1.42                                                   # le téléphone en gros plan pendant le hook
PH_CY = SY + SH / 2
HOOK_Y = 1080                                                # centre du téléphone pendant le hook
SET('#ph', {'scale': BIG, 'y': HOOK_Y - PH_CY}, 0)
HOOK = [('Préparer.', 'compas'), ('T’équiper.', 'kit-studio'), ('Partir.', 'compte_suivi-en-direct'),
        ('Raconter.', 'dev_carnet-v2'), ('Partager.', 'carnets'), ('Progresser.', 'compte')]
dirs = [(0, 0), (1, 0), (0, 1), (-1, 0), (0, -1), (1, 0)]
hook_ids = []
for b, ((word, src), (dx, dy)) in enumerate(zip(HOOK, dirs)):
    t = 0.5 * b
    i = scr_img(f'assets/screens/ecrans/{src}.png', 10 + b, 'opacity:0')
    hook_ids.append(i)
    if b == 0:
        T(f'#{i}', {'opacity': 1, 'scale': 1.25}, {'opacity': 1, 'scale': 1, 'duration': 0.24, 'ease': 'expo.out'}, 0.0)
    else:   # chaque écran arrive juste avant le temps et se pose dessus
        T(f'#{i}', {'opacity': 1, 'xPercent': 100 * dx, 'yPercent': 100 * dy, 'scale': 1 if (dx or dy) else 1.3},
          {'opacity': 1, 'xPercent': 0, 'yPercent': 0, 'scale': 1, 'duration': 0.2, 'ease': 'power4.out'}, t - 0.12, ir=False)
        prev = hook_ids[b - 1]
        TO(f'#{prev}', {'xPercent': -30 * dx, 'yPercent': -30 * dy, 'filter': 'brightness(.45)', 'duration': 0.2, 'ease': 'power4.out'}, t - 0.12)
    # contretemps : petit coup de zoom (sur la charleston)
    T(f'#{i}', {'scale': 1}, {'scale': 1.035, 'duration': 0.1, 'ease': 'power2.out', 'yoyo': True, 'repeat': 1}, t + 0.25, ir=False)
    # le verbe claque en haut, sur le temps
    mline(word, 120, t - 0.03, t + 0.5 if b < 5 else 2.98, size=150, weight=700, words=False, dur=0.22, out=0.12, z=130)
# éclair blanc sur l'impact
h.append('<div id="flash" style="position:absolute;inset:0;background:#FAF8F5;z-index:700;opacity:0;pointer-events:none"></div>')
T('#flash', {'opacity': 0.0}, {'opacity': 0.55, 'duration': 0.04}, 2.98, ir=False); TO('#flash', {'opacity': 0, 'duration': 0.35, 'ease': 'power2.out'}, 3.02)

# ================= IMPACT (3 – 5) : le téléphone recule, les six écrans rentrent dedans
TO('#ph', {'scale': 1, 'y': 0, 'duration': 0.6, 'ease': 'expo.out'}, 3.0)
hub = scr_img('assets/screens/hub.png', 30, 'opacity:0')
T(f'#{hub}', {'opacity': 0}, {'opacity': 1, 'duration': 0.15}, 3.0, ir=False)
for b in range(6): TO(f'#{hook_ids[b]}', {'opacity': 0, 'duration': 0.01}, 3.2)
# les six écrans, en cartes, éventail autour du téléphone puis aspirés dedans (doubles croches à 3,5)
fan = [(-330, -420, -14), (330, -420, 14), (-390, 60, -10), (390, 60, 10), (-330, 520, -6), (330, 520, 6)]
for b, ((_, src), (fx, fy, rot)) in enumerate(zip(HOOK, fan)):
    i = uid('c'); cw, chh = 393 * 0.52, 852 * 0.52
    h.append(f'<div id="{i}" style="position:absolute;left:{CX}px;top:{PH_CY:.0f}px;width:{cw:.0f}px;height:{chh:.0f}px;border-radius:30px;overflow:hidden;'
             f'box-shadow:0 24px 60px rgba(0,0,0,.5);z-index:45;opacity:0"><img src="assets/screens/ecrans/{src}.png" alt="" style="width:100%;height:100%;display:block"></div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50,yPercent:-50}});')
    T(f'#{i}', {'opacity': 0, 'x': 0, 'y': 0, 'rotation': 0, 'scale': 1.6}, {'opacity': 1, 'x': fx, 'y': fy, 'rotation': rot, 'scale': 1, 'duration': min(0.5, 3.5 + 0.125 * b - 0.2 - 3.0), 'ease': 'expo.out'}, 3.0)
    TO(f'#{i}', {'x': 0, 'y': 0, 'rotation': 0, 'scale': 0.35, 'opacity': 0, 'duration': 0.3, 'ease': 'power3.in'}, 3.5 + 0.125 * b - 0.18)
mline('LE KIT DU VOYAGEUR', 150, 3.25, 4.95, size=24, weight=600, color=BRASS, track='0.32em', words=False, dur=0.5)
mline('Toute ton aventure.', 194, 3.45, 4.95, size=76, dur=0.5)
mline('Une seule app.', 290, 3.95, 4.95, size=76, weight=500, color=GREY, dur=0.5)

# ================= 01 · LE HUB (5 – 7) : les tuiles jaillissent puis rentrent
mline('01 · LE HUB', 150, 4.98, None, size=24, weight=600, color=BRASS, track='0.3em', words=False, dur=0.5)
mline('Ton aventure,', 194, 5.0, 6.95, size=76, dur=0.5)
mline('d’un coup d’œil.', 290, 5.25, 6.95, size=76, weight=500, color=GREY, dur=0.5)
BOX = {'meteo': (37, 24, 584, 376), 'budget': (598, 24, 1143, 376), 'carte': (37, 390, 677, 1483), 'etapes': (690, 390, 1143, 1483),
       'carnet': (37, 1497, 584, 1762), 'kits': (598, 1497, 1142, 1762), 'paperasse': (37, 1776, 1142, 1984), 'groupe': (37, 1998, 1142, 2284)}
DEST = {'meteo': (178, 560, 1.4, -5), 'budget': (902, 560, 1.4, 5), 'carte': (172, 920, 1.12, 3), 'etapes': (912, 920, 1.12, -3),
        'carnet': (184, 1290, 1.4, -3), 'kits': (896, 1290, 1.4, 3), 'paperasse': (540, 1500, 1.28, 1.5), 'groupe': (540, 1636, 1.28, -1.5)}
ORDER = ['meteo', 'budget', 'carte', 'etapes', 'carnet', 'kits', 'paperasse', 'groupe']
def in_screen(box):   # centre d'une boîte (px 3x de la capture) dans l'écran du téléphone à taille normale
    x0, y0, x1, y1 = box; return SX + (x0 + x1) / 6 * S, SY + (y0 + y1) / 6 * S
for k, name in enumerate(ORDER):
    bx0, by0, bx1, by1 = BOX[name]; cw, chh = (bx1 - bx0) / 3, (by1 - by0) / 3
    sx, sy = in_screen(BOX[name]); dx, dy, sc, rot = DEST[name]
    i = f'tu{name}'
    h.append(f'<div id="{i}" style="position:absolute;left:{dx}px;top:{dy}px;width:{cw * sc:.0f}px;height:{chh * sc:.0f}px;border-radius:{22 * sc:.0f}px;overflow:hidden;'
             f'box-shadow:0 24px 56px rgba(4,12,8,.5),0 0 0 1px rgba(255,255,255,.16);z-index:{60 + k};opacity:0">'
             f'<img src="assets/real/hub-{name}.png" alt="" style="display:block;width:100%;height:100%"></div>')
    j.append(f'gsap.set("#{i}",{{xPercent:-50,yPercent:-50}});')
    t = 5.5 + 0.125 * k
    T(f'#{i}', {'opacity': 0, 'x': sx - dx, 'y': sy - dy, 'scale': S / sc, 'rotation': 0},
      {'opacity': 1, 'x': 0, 'y': 0, 'scale': 1, 'rotation': rot, 'duration': min(0.55, 6.6 - t), 'ease': 'expo.out'}, t)
    TO(f'#{i}', {'x': sx - dx, 'y': sy - dy, 'scale': S / sc, 'rotation': 0, 'duration': 0.32, 'ease': 'power3.in'}, 6.62 + 0.012 * k)
    TO(f'#{i}', {'opacity': 0, 'duration': 0.01}, 6.95)
T(f'#{hub}', {'filter': 'brightness(1)'}, {'filter': 'brightness(.45)', 'duration': 0.4}, 5.5, ir=False)
TO(f'#{hub}', {'filter': 'brightness(1)', 'duration': 0.3}, 6.65)

# ================= 7 – 19 : les huit tiroirs réels
TXT = {'meteo': ('Météo.', 'MET Norway, heure par heure.'), 'budget': ('Budget.', 'Dépensé, prévu, ce qu’il reste.'),
       'carte': ('Carte.', 'Ta trace, même hors ligne.'), 'etapes': ('Étapes.', 'Jour après jour, jusqu’au départ.'),
       'carnet': ('Carnet.', 'Moments, notes, puis le récit.'), 'kits': ('Kits.', 'La checklist de ton sac.'),
       'paperasse': ('Paperasse.', 'Billets, réservations, urgences.'), 'groupe': ('Groupe.', 'Ton équipe, et sa sécurité.')}
CROP = {'meteo': (30, 380, 1152, 740), 'budget': (40, 910, 1140, 1130), 'carte': (40, 370, 1152, 1500), 'etapes': (30, 370, 1152, 600),
        'carnet': (40, 370, 1150, 715), 'kits': (30, 866, 1152, 1425), 'paperasse': (40, 380, 1150, 550), 'groupe': (30, 330, 1152, 800)}
CW = {'carte': 560, 'kits': 860}                              # largeur du détail posé (sinon 900)
PANEL_TOP = 190                                               # haut du tiroir dans la capture (px 3x) : le haut de l'écran reste le Hub
h.append(f'<svg id="svt" width="{W}" height="{H}" style="position:absolute;left:0;top:0;z-index:90;overflow:visible;pointer-events:none" aria-hidden="true"></svg>')
for i_, name in enumerate(ORDER):
    t0 = 7.0 + 1.5 * i_
    a, b = TXT[name]
    mline(a, 194, t0 - 0.04, t0 + 1.5 if i_ < 7 else 19.0, size=84, dur=0.4, out=0.2)
    mline(b, 296, t0 + 0.06, t0 + 1.5 if i_ < 7 else 19.0, size=40, weight=500, color=GREY, dur=0.45, stag=0.025, out=0.2)
    # le doigt touche la tuile : un anneau laiton s'ouvre sur elle
    tx, ty = in_screen(BOX[name]); rg = uid('g')
    h.append(f'<div id="{rg}" style="position:absolute;left:{tx - 40:.0f}px;top:{ty - 40:.0f}px;width:80px;height:80px;border-radius:40px;border:4px solid {BRASS};background:rgba(208,160,112,.25);z-index:95;opacity:0"></div>')
    T(f'#{rg}', {'opacity': 1, 'scale': 0.3}, {'opacity': 0, 'scale': 1.8, 'duration': 0.45, 'ease': 'power2.out'}, t0, ir=False)
    # le vrai tiroir monte dans l'écran (seule sa partie basse : le haut de la capture est le Hub, identique)
    dr = uid('d'); top_pct = PANEL_TOP / 2556 * 100
    SCREENS.append(f'<img id="{dr}" src="assets/screens/tiroirs/hub-{name}.png" alt="" style="position:absolute;left:0;top:0;width:100%;height:100%;z-index:{40 + i_};'
                   f'clip-path:inset({top_pct:.2f}% 0 0 0);opacity:0">')
    T(f'#{dr}', {'opacity': 1, 'yPercent': 100}, {'opacity': 1, 'yPercent': 0, 'duration': 0.42, 'ease': 'expo.out'}, t0 + 0.06, ir=False)
    TO(f'#{dr}', {'yPercent': 100, 'duration': 0.26, 'ease': 'power3.in'}, t0 + 1.22)
    # son détail réel sort de l'écran et se pose sur le temps (t0 + 0,5)
    cx0, cy0, cx1, cy1 = CROP[name]; iw, ih = cx1 - cx0, cy1 - cy0
    w_ = CW.get(name, 900); h_ = ih * w_ / iw
    ccx, ccy = SX + (cx0 + cx1) / 6 * S, SY + (cy0 + cy1) / 6 * S
    dy_ = 1190 if name != 'carte' else 1080
    co = uid('k'); s0 = (iw / 3 * S) / w_
    h.append(f'<div id="{co}" style="position:absolute;left:{CX}px;top:{dy_}px;width:{w_:.0f}px;height:{h_:.0f}px;border-radius:{26 * w_ / (iw / 3):.0f}px;overflow:hidden;'
             f'box-shadow:0 34px 90px rgba(4,12,8,.6),0 0 0 1px rgba(255,255,255,.18);z-index:{100 + i_};opacity:0;background:#fff">'
             f'<img src="assets/real/tiroir-{name}.png" alt="" style="display:block;width:100%;height:100%"></div>')
    j.append(f'gsap.set("#{co}",{{xPercent:-50,yPercent:-50}});')
    T(f'#{co}', {'opacity': 0, 'x': ccx - CX, 'y': ccy - dy_, 'scale': s0}, {'opacity': 1, 'x': 0, 'y': 0, 'scale': 1, 'duration': 0.44, 'ease': 'back.out(1.25)'}, t0 + 0.08 + 0.0, ir=True)
    TO(f'#{co}', {'y': -10, 'duration': 0.6, 'ease': 'sine.out'}, t0 + 0.55)
    TO(f'#{co}', {'x': ccx - CX, 'y': ccy - dy_, 'scale': s0, 'opacity': 0, 'duration': 0.26, 'ease': 'power3.in'}, t0 + 1.2)
    TO(f'#{hub}', {'filter': 'brightness(.62)', 'duration': 0.2}, t0 + 0.06); TO(f'#{hub}', {'filter': 'brightness(1)', 'duration': 0.2}, t0 + 1.25)

# ================= 19 – 20 : « Ce n'était que le Hub. »
mline('Ce n’était', 194, 19.0, None, size=84, dur=0.45)
mline('que le Hub.', 296, 19.25, None, size=84, weight=500, color=BRASS, dur=0.45)
TO('#ph', {'scale': 0.94, 'duration': 0.5, 'ease': 'expo.out'}, 19.5)
TO('#root > *:not(audio)', {'opacity': 0, 'duration': 0.3}, D - 0.3)

html_body = '\n'.join('      ' + x for x in h).strip().replace('SCREENS', ''.join(SCREENS))
html = f'''<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>LKDV — présentation complète</title>
    <script src="assets/lib/gsap.min.js"></script>
    <link rel="stylesheet" href="assets/fonts.css" />
    <style>
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:#06120C; }}
      #root {{ position:relative; width:{W}px; height:{H}px; overflow:hidden; background:radial-gradient(120% 80% at 50% 38%,#10291E 0%,#06120C 72%); -webkit-font-smoothing:antialiased; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="{W}" data-height="{H}">
      {html_body}
      <audio id="son" class="clip" src="audio/bande-son.wav" data-start="0" data-duration="{D}" data-track-index="20" data-volume="1" data-timeline-role="music"></audio>
    </div>
    <script>
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
