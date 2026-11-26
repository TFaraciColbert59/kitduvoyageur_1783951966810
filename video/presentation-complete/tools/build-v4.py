# Présentation complète de LKDV — 9:16 (1080×1920), 20 premières secondes, v4 « dopamine ».
# On n'enchaîne plus des fonctions : on suit un humain. Julien disait « Pas pour moi ». Chaque geste dans la vraie app
# déclenche un moment de sa vie (coupe raccord), la tension monte, se tait, puis éclate à l'aube avec les autres.
#   0,0–2,0  HOOK  visage de nuit (c06) : « La montagne ? » « Pas pour moi. » → le trait barre « Pas » sur le temps → « POUR MOI. »
#   2,0–3,0        il ouvre l'app (d09) → zoom à travers son téléphone → le vrai Compas « Je prépare ton aventure… »
#   3,0–4,0        explosion des huit vraies tuiles du Hub (récompense) — « Tout se prépare. »
#   4,0–5,0        la vraie checklist défile → raccord sur le vrai sac étalé (h14) — « Ton sac, objet par objet. »
#   5,0–7,0        le vrai Groupe « Seul ? » → la poignée de main (g10) « Des inconnus. » → la guide (g11) « Puis une cordée. »
#   7,0–8,0        le vrai bouton « Démarrer le voyage », pressé sur le temps → éclair
#   8,0–10,0       la nuit à la frontale (j01, j19) — « 5 h 12. » « 2 352 m. » « Ensemble. »
#   10,0–12,0      le vrai Suivi en direct → sa mère sourit à son téléphone (j20) — la musique se pose
#   12,0–13,5      la paroi : trois plans, un par temps (c08, j17, j18), la tension monte
#   13,5–14,0      noir, silence, un point de lumière
#   14,0–16,0      DROP : l'aube au lac avec les autres (a02) — « Toi. Ici. »
#   16,0–17,0      la tablée du refuge (g12) + la vraie carte Rencontre « Marc, berger »
#   17,0–18,5      le vrai carnet du Tour des Écrins ; ses chiffres réels comptent (4 jours · 72 km · +4 520 m)
#   18,5–20,0      LE KIT DU VOYAGEUR · « Là où la carte se termine. »
# Images de l'histoire : les plans animés de « Pas pour moi » (assets/video). Tout ce qui ressemble à l'app EST l'app.
import os, math, json
from PIL import Image
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = 20.0
W, H = 1080, 1920
INK, STONE, BRASS, GREY = '#0B1F17', '#FAF8F5', '#D0A070', 'rgba(250,248,245,.72)'
FOREST, SAGE, DEEP = '#17402C', '#5B7F55', '#06120C'
SANS = "font-family:Inter,sans-serif"
ANTON = "font-family:Anton,Inter,sans-serif;font-weight:400"
GAR = "font-family:'EB Garamond Italic',Georgia,serif;font-style:italic"
SHADOW = 'text-shadow:0 4px 30px rgba(0,0,0,.55)'
h, j = [], []
k_ = [0]
def uid(p): k_[0] += 1; return f'{p}{k_[0]}'
def T(sel, a, b, t, ir=True):
    b = dict(b)
    if not ir: b['immediateRender'] = False
    j.append(f'tl.fromTo("{sel}", {json.dumps(a)}, {json.dumps(b)}, {round(t, 3)});')
def TO(sel, b, t): j.append(f'tl.to("{sel}", {json.dumps(b)}, {round(t, 3)});')
def SET(sel, b, t): j.append(f'tl.set("{sel}", {json.dumps(b)}, {round(t, 3)});')
def size_of(src): return Image.open(os.path.join(HERE, src)).size
TRACK = [0]
class Scene:
    def __init__(self, t0, t1, bg, z):
        self.id = uid('S'); self.t0, self.t1, self.z = t0, t1, z; self.kids = []
        h.append(None); self.slot = len(h) - 1; self.bg = bg
        j.append(f'gsap.set("#{self.id}",{{autoAlpha:0}});')
        SET(f'#{self.id}', {'autoAlpha': 1}, t0); SET(f'#{self.id}', {'autoAlpha': 0}, t1)
    def add(self, html): self.kids.append(html)
    def close(self):
        h[self.slot] = (f'<div id="{self.id}" style="position:absolute;inset:0;overflow:hidden;background:{self.bg};z-index:{self.z};perspective:1600px">' + ''.join(self.kids) + '</div>')

def video(sc, src, t0, t1, ms=0.0, z=1, extra=''):
    """Un plan de l'histoire, plein cadre, joué de t0 à t1 à partir de ms secondes."""
    i = uid('v'); TRACK[0] = (TRACK[0] + 1) % 4
    sc.add(f'<video id="{i}" class="clip" src="assets/video/{src}.mp4" muted playsinline data-start="{t0}" data-duration="{round(t1 - t0, 3)}" data-media-start="{ms}" data-track-index="{2 + TRACK[0]}" '
           f'style="position:absolute;left:0;top:0;width:{W}px;height:{H}px;object-fit:cover;z-index:{z};{extra}"></video>')
    return i

def text(sc, txt, x, y, t_in, size=80, color=STONE, family=SANS, weight=700, track='-0.025em', lh=1.1, align='left', words=True, dur=0.45, stag=0.04, extra='', t_out=None, out=0.2, shadow=True):
    i = uid('t'); hgt = math.ceil(size * lh) + 8
    ws = txt.split(' ') if words else [txt]
    inner = ' '.join(f'<span class="{i}w" style="display:inline-block">{w_}</span>' for w_ in ws)
    if align == 'center': pos = 'left:0;right:0;text-align:center'
    elif align == 'right': pos = f'right:{W - x}px;text-align:right'
    else: pos = f'left:{x}px;text-align:left'
    sc.add(f'<div id="{i}" style="position:absolute;{pos};top:{y}px;height:{hgt}px;overflow:hidden;z-index:20;{extra}">'
           f'<div style="{family};font-weight:{weight};font-size:{size}px;line-height:{lh};letter-spacing:{track};color:{color};white-space:nowrap;{SHADOW if shadow else ""}">{inner}</div></div>')
    j.append(f'gsap.set(".{i}w",{{yPercent:130}});')
    j.append(f'tl.to(".{i}w",{{yPercent:0,duration:{dur},ease:"expo.out",stagger:{stag}}},{round(t_in, 3)});')
    if t_out is not None: j.append(f'tl.to(".{i}w",{{yPercent:-130,duration:{out},ease:"power3.in",stagger:0.015}},{round(t_out - out, 3)});')
    return i

def img(sc, src, cx, cy, w, rad=0, z=5, shadow=True, extra=''):
    iw, ih = size_of(src); hh = ih * w / iw; i = uid('i')
    sh = 'box-shadow:0 30px 80px rgba(4,12,8,.5),0 0 0 1px rgba(255,255,255,.16);' if shadow else ''
    sc.add(f'<div id="{i}" style="position:absolute;left:{cx - w / 2:.1f}px;top:{cy - hh / 2:.1f}px;width:{w:.1f}px;height:{hh:.1f}px;border-radius:{rad}px;overflow:hidden;{sh}z-index:{z};{extra}">'
           f'<img src="{src}" alt="" style="display:block;width:100%;height:100%"></div>')
    return i, hh

def phone(sc, src, cx, cy, sh, z=5, extra=''):
    s = sh / 852; sw = 393 * s; bz = 12 * sh / 900; rad = 58 * sh / 900; i = uid('p')
    sc.add(f'<div id="{i}" style="position:absolute;left:{cx - sw / 2 - bz:.1f}px;top:{cy - sh / 2 - bz:.1f}px;width:{sw + 2 * bz:.1f}px;height:{sh + 2 * bz:.1f}px;border-radius:{rad + bz:.1f}px;'
           f'background:#0A0F0C;box-shadow:0 60px 140px rgba(0,0,0,.6),0 0 0 1.5px rgba(255,255,255,.14);z-index:{z};{extra}">'
           f'<div style="position:absolute;left:{bz:.1f}px;top:{bz:.1f}px;width:{sw:.1f}px;height:{sh:.1f}px;border-radius:{rad:.1f}px;overflow:hidden">'
           f'<img src="{src}" alt="" style="display:block;width:100%;height:100%"></div>'
           f'<div style="position:absolute;left:50%;top:{bz + 10 * s:.1f}px;width:{104 * s:.0f}px;height:{31 * s:.0f}px;margin-left:-{52 * s:.0f}px;border-radius:{16 * s:.0f}px;background:#000"></div></div>')
    return i

def shade(sc, top=True, bottom=True, a=0.55):
    if top: sc.add(f'<div style="position:absolute;left:0;right:0;top:0;height:640px;background:linear-gradient(rgba(4,10,7,{a}),rgba(4,10,7,0));z-index:10"></div>')
    if bottom: sc.add(f'<div style="position:absolute;left:0;right:0;bottom:0;height:760px;background:linear-gradient(rgba(4,10,7,0),rgba(4,10,7,{a + .1}));z-index:10"></div>')

# ---------- grain, vignette, éclair
h.append(f'<div id="grain" style="position:absolute;left:-60px;top:-60px;width:{W + 120}px;height:{H + 120}px;background:url(assets/img/grain.png);opacity:.07;z-index:800;pointer-events:none;mix-blend-mode:overlay"></div>')
j.append(f'tl.fromTo("#grain",{{x:0,y:0}},{{x:-48,y:37,duration:{D},ease:"steps({int(D * 12)})"}},0);')
h.append('<div id="vig" style="position:absolute;inset:0;z-index:780;pointer-events:none;background:radial-gradient(120% 85% at 50% 45%,rgba(0,0,0,0) 58%,rgba(4,12,8,.5) 100%)"></div>')
h.append(f'<div id="flash" style="position:absolute;inset:0;background:{STONE};z-index:700;opacity:0;pointer-events:none"></div>')
def flash(t, a=0.7, d=0.35): T('#flash', {'opacity': a}, {'opacity': 0, 'duration': d, 'ease': 'power2.out'}, t, ir=False)

# ================= 0 – 2 · HOOK : « Pas pour moi. » barré → « POUR MOI. »
sc = Scene(0.0, 2.0, DEEP, 10)
v = video(sc, 'c06', 0.0, 2.0, 0.4)
T(f'#{v}', {'scale': 1.0}, {'scale': 1.14, 'duration': 2.0, 'ease': 'none'}, 0.0)
shade(sc, top=False, a=0.6)
text(sc, 'La montagne ?', 540, 1180, 0.08, size=88, family=GAR, weight=400, track='0', align='center', dur=0.5, t_out=1.5, out=0.18)
pp = uid('pp')
sc.add(f'<div id="{pp}" style="position:absolute;left:0;right:0;top:1290px;text-align:center;z-index:20;opacity:0"><span style="position:relative;display:inline-block;{GAR};font-weight:400;font-size:150px;line-height:1.15;color:{BRASS};{SHADOW}">'
       f'<span id="{pp}a" style="position:relative;display:inline-block">Pas<span id="{pp}b" style="position:absolute;left:-10px;right:-10px;top:52%;height:9px;background:{STONE};border-radius:5px;transform-origin:0 50%;box-shadow:0 0 18px rgba(255,255,255,.7)"></span></span> pour moi.</span></div>')
T(f'#{pp}', {'opacity': 0, 'y': 60}, {'opacity': 1, 'y': 0, 'duration': 0.4, 'ease': 'expo.out'}, 0.5)
j.append(f'gsap.set("#{pp}b",{{scaleX:0}});')
TO(f'#{pp}b', {'scaleX': 1, 'duration': 0.14, 'ease': 'power4.out'}, 1.0)
TO(f'#{pp}a', {'y': 260, 'rotation': 24, 'opacity': 0, 'duration': 0.3, 'ease': 'power3.in'}, 1.18)
TO(f'#{pp}', {'opacity': 0, 'duration': 0.05}, 1.48)
pm = uid('pm')
sc.add(f'<div id="{pm}" style="position:absolute;left:0;right:0;top:1180px;text-align:center;{ANTON};font-size:250px;line-height:1;color:{STONE};z-index:21;opacity:0;{SHADOW}">POUR MOI.</div>')
T(f'#{pm}', {'opacity': 0, 'scale': 1.8}, {'opacity': 1, 'scale': 1, 'duration': 0.18, 'ease': 'power4.out'}, 1.5)
flash(1.5, 0.45, 0.25)
sc.close()

# ================= 2 – 3 · il ouvre l'app : zoom à travers son téléphone → le vrai Compas
sc = Scene(2.0, 3.0, DEEP, 20)
v = video(sc, 'd09', 2.0, 2.6, 1.0, extra='transform-origin:72% 60%')
T(f'#{v}', {'scale': 1.0}, {'scale': 3.2, 'duration': 0.55, 'ease': 'power3.in'}, 2.0)
ph = phone(sc, 'assets/screens/ecrans/compas.png', 540, 1010, 1500, z=6)
T(f'#{ph}', {'scale': 0.2, 'opacity': 0, 'rotation': -10}, {'scale': 1, 'opacity': 1, 'rotation': 0, 'duration': 0.35, 'ease': 'expo.out'}, 2.5)
flash(2.5, 0.5, 0.2)
text(sc, 'Une phrase.', 540, 50, 2.55, size=130, family=ANTON, weight=400, track='.01em', align='center', words=False, dur=0.25)
sc.close()

# ================= 3 – 4 · les huit vraies tuiles explosent (récompense)
sc = Scene(3.0, 4.0, STONE, 30)
NAMES = ['meteo', 'budget', 'carte', 'etapes', 'carnet', 'kits', 'paperasse', 'groupe']
POS = [(250, 560, -9, 500), (830, 520, 8, 500), (200, 1080, 6, 300), (890, 1060, -7, 240), (300, 1480, -5, 500), (790, 1530, 9, 500), (540, 250, 3, 700), (540, 1780, -4, 700)]
for k, (n, (x, y, r, w)) in enumerate(zip(NAMES, POS)):
    ti, _ = img(sc, f'assets/real/hub-{n}.png', x, y, w, rad=34, z=5 + k)
    t = 3.0 + 0.0625 * k
    T(f'#{ti}', {'x': 540 - x, 'y': 960 - y, 'scale': 0.1, 'rotation': 0, 'opacity': 0}, {'x': 0, 'y': 0, 'scale': 1, 'rotation': r, 'opacity': 1, 'duration': 0.45, 'ease': 'back.out(1.5)'}, t)
    TO(f'#{ti}', {'y': -25, 'duration': 0.5, 'ease': 'sine.out'}, t + 0.45)
tx = uid('tx')
sc.add(f'<div id="{tx}" style="position:absolute;left:0;right:0;top:790px;text-align:center;{ANTON};font-size:190px;line-height:1;color:{FOREST};z-index:30;opacity:0">TOUT SE</div>'
       f'<div id="{tx}b" style="position:absolute;left:0;right:0;top:980px;text-align:center;{ANTON};font-size:190px;line-height:1;color:{BRASS};z-index:30;opacity:0">PRÉPARE.</div>')
T(f'#{tx}', {'scale': 2, 'opacity': 0}, {'scale': 1, 'opacity': 1, 'duration': 0.2, 'ease': 'power4.out'}, 3.25)
T(f'#{tx}b', {'scale': 2, 'opacity': 0}, {'scale': 1, 'opacity': 1, 'duration': 0.2, 'ease': 'power4.out'}, 3.5)
sc.close()

# ================= 4 – 5 · la vraie checklist défile → raccord sur le vrai sac (h14)
sc = Scene(4.0, 4.5, STONE, 40)
li, lhh = img(sc, 'assets/real/tiroir-kits-liste.png', 540, 1100, 980, rad=46, z=5)
T(f'#{li}', {'y': 600}, {'y': -450, 'duration': 0.5, 'ease': 'power2.in'}, 4.0)
text(sc, 'Ton sac,', 540, 110, 4.02, size=150, color=INK, family=ANTON, weight=400, track='.01em', align='center', words=False, dur=0.2, shadow=False, extra='z-index:30')
sc.close()
sc = Scene(4.5, 5.0, DEEP, 41)
v = video(sc, 'h14', 4.5, 5.0, 1.5)
T(f'#{v}', {'yPercent': 30, 'scale': 1.2}, {'yPercent': 0, 'scale': 1.05, 'duration': 0.35, 'ease': 'expo.out'}, 4.5)
text(sc, 'objet par objet.', 540, 860, 4.52, size=130, family=ANTON, weight=400, track='.01em', align='center', words=False, dur=0.22)
sc.close()

# ================= 5 – 7 · le vrai Groupe → la poignée de main → la guide
sc = Scene(5.0, 5.5, FOREST, 50)
gi, _ = img(sc, 'assets/real/tiroir-groupe.png', 540, 1050, 960, rad=50, z=5)
T(f'#{gi}', {'x': 1100, 'rotation': 10}, {'x': 0, 'rotation': -2, 'duration': 0.3, 'ease': 'expo.out'}, 5.0)
text(sc, 'Seul ?', 540, 380, 5.05, size=200, family=ANTON, weight=400, track='.01em', align='center', words=False, dur=0.2)
sc.close()
sc = Scene(5.5, 6.25, DEEP, 51)
v = video(sc, 'g10', 5.5, 6.25, 1.0)
T(f'#{v}', {'scale': 1.25}, {'scale': 1.05, 'duration': 0.75, 'ease': 'expo.out'}, 5.5)
shade(sc, top=False)
text(sc, 'Des inconnus.', 540, 1420, 5.55, size=120, family=GAR, weight=400, track='0', align='center', dur=0.35)
sc.close()
sc = Scene(6.25, 7.0, DEEP, 52)
v = video(sc, 'g11', 6.25, 7.0, 1.2)
T(f'#{v}', {'scale': 1.0}, {'scale': 1.12, 'duration': 0.75, 'ease': 'none'}, 6.25)
shade(sc, top=False)
text(sc, 'Puis une cordée.', 540, 1420, 6.3, size=120, family=GAR, weight=400, track='0', align='center', color=BRASS, dur=0.35)
sc.close()

# ================= 7 – 8 · « Démarrer le voyage », pressé sur le temps
sc = Scene(7.0, 8.0, FOREST, 60)
jj = uid('jj')
sc.add(f'<div id="{jj}" style="position:absolute;left:0;right:0;top:300px;text-align:center;{ANTON};font-size:420px;line-height:1;color:transparent;-webkit-text-stroke:3px rgba(208,160,112,.6)">J-191</div>')
T(f'#{jj}', {'scale': 1.25, 'opacity': 0}, {'scale': 1, 'opacity': 1, 'duration': 0.4, 'ease': 'expo.out'}, 7.0)
ei, eh = img(sc, 'assets/real/tiroir-etapes.png', 540, 1150, 1000, rad=60, z=5)
T(f'#{ei}', {'y': 500, 'opacity': 0}, {'y': 0, 'opacity': 1, 'duration': 0.3, 'ease': 'expo.out'}, 7.0)
TO(f'#{ei}', {'scale': 0.95, 'duration': 0.06, 'ease': 'power2.in'}, 7.5); TO(f'#{ei}', {'scale': 1.04, 'duration': 0.2, 'ease': 'back.out(3)'}, 7.56)
bx, by = 540 - 500 + 1000 * 0.705, 1150 - eh / 2 + eh * 0.43
rp = uid('rp')
sc.add(f'<div id="{rp}" style="position:absolute;left:{bx - 90:.0f}px;top:{by - 90:.0f}px;width:180px;height:180px;border-radius:90px;background:rgba(208,160,112,.4);border:5px solid {BRASS};z-index:7;opacity:0"></div>')
T(f'#{rp}', {'scale': 0.2, 'opacity': 1}, {'scale': 4, 'opacity': 0, 'duration': 0.45, 'ease': 'power2.out'}, 7.5, ir=False)
flash(7.85, 0.9, 0.3)
sc.close()

# ================= 8 – 10 · la nuit, à la frontale
sc = Scene(8.0, 9.0, DEEP, 70)
v = video(sc, 'j01', 8.0, 9.0, 2.2)
T(f'#{v}', {'scale': 1.3}, {'scale': 1.08, 'duration': 1.0, 'ease': 'expo.out'}, 8.0)
text(sc, '5 h 12.', 540, 260, 8.05, size=150, family=ANTON, weight=400, track='.02em', align='center', words=False, dur=0.25)
sc.close()
sc = Scene(9.0, 10.0, DEEP, 71)
v = video(sc, 'j19', 9.0, 10.0, 2.5)
T(f'#{v}', {'scale': 1.0}, {'scale': 1.15, 'duration': 1.0, 'ease': 'none'}, 9.0)
shade(sc, top=False, a=0.5)
text(sc, '2 352 m.', 540, 260, 9.05, size=150, family=ANTON, weight=400, track='.02em', align='center', words=False, dur=0.25)
text(sc, 'Ensemble.', 540, 1500, 9.5, size=110, family=GAR, weight=400, track='0', align='center', color=BRASS, dur=0.3)
sc.close()

# ================= 10 – 12 · le vrai Suivi en direct → sa mère sourit
sc = Scene(10.0, 10.75, '#E9EEEA', 80)
ph = phone(sc, 'assets/screens/ecrans/compte_suivi-en-direct.png', 540, 1000, 1450, z=5)
T(f'#{ph}', {'y': 1500}, {'y': 0, 'duration': 0.35, 'ease': 'expo.out'}, 10.0)
TO(f'#{ph}', {'scale': 0.25, 'x': -40, 'y': 180, 'opacity': 0, 'duration': 0.3, 'ease': 'power3.in'}, 10.45)
sc.close()
sc = Scene(10.75, 12.0, DEEP, 81)
v = video(sc, 'j20', 10.75, 12.0, 2.0)
T(f'#{v}', {'scale': 1.15, 'opacity': 0}, {'scale': 1.0, 'opacity': 1, 'duration': 0.5, 'ease': 'power2.out'}, 10.75)
shade(sc, top=False, a=0.5)
text(sc, 'Sa mère sait', 540, 1380, 10.95, size=104, family=GAR, weight=400, track='0', align='center', dur=0.5, stag=0.08)
text(sc, 'où il est.', 540, 1500, 11.2, size=104, family=GAR, weight=400, track='0', align='center', color=BRASS, dur=0.5, stag=0.08)
sc.close()

# ================= 12 – 13,5 · la paroi, un plan par temps
for k, (src, ms, word) in enumerate([('c08', 0.6, 'Plus haut.'), ('j17', 0.9, 'Encore.'), ('j18', 1.6, 'Respire.')]):
    t0 = 12.0 + 0.5 * k
    sc = Scene(t0, t0 + 0.5, DEEP, 90 + k)
    v = video(sc, src, t0, t0 + 0.5, ms)
    T(f'#{v}', {'scale': 1.35}, {'scale': 1.1, 'duration': 0.5, 'ease': 'expo.out'}, t0)
    text(sc, word, 540, 840, t0 + 0.02, size=170, family=ANTON, weight=400, track='.01em', align='center', words=False, dur=0.18)
    sc.close()
# 13,5 – 14,0 : noir, silence, un point de lumière
sc = Scene(13.5, 14.0, '#000', 95)
dot = uid('dt')
sc.add(f'<div id="{dot}" style="position:absolute;left:530px;top:950px;width:20px;height:20px;border-radius:10px;background:#FFE7C2;box-shadow:0 0 40px 14px rgba(255,214,160,.6);opacity:0"></div>')
T(f'#{dot}', {'scale': 0.3, 'opacity': 0}, {'scale': 1, 'opacity': 1, 'duration': 0.45, 'ease': 'power2.in'}, 13.55)
sc.close()

# ================= 14 – 16 · DROP : l'aube au lac avec les autres
sc = Scene(14.0, 16.0, DEEP, 100)
j.append(f'gsap.set("#{sc.id}",{{clipPath:"circle(0% at 50% 50%)"}});')
T(f'#{sc.id}', {'clipPath': 'circle(0% at 50% 50%)'}, {'clipPath': 'circle(80% at 50% 50%)', 'duration': 0.4, 'ease': 'expo.out'}, 14.0, ir=False)
v = video(sc, 'a02', 14.0, 16.0, 2.0)
T(f'#{v}', {'scale': 1.2}, {'scale': 1.0, 'duration': 2.0, 'ease': 'power2.out'}, 14.0)
flash(14.0, 0.8, 0.6)
toi = uid('toi')
sc.add(f'<div id="{toi}" style="position:absolute;left:0;right:0;top:230px;text-align:center;{GAR};font-weight:400;font-size:190px;line-height:1.1;color:{INK};z-index:20;opacity:0">Toi. <span style="color:#7E5A30">Ici.</span></div>')
T(f'#{toi}', {'opacity': 0, 'y': 60, 'scale': 1.25}, {'opacity': 1, 'y': 0, 'scale': 1, 'duration': 0.9, 'ease': 'expo.out'}, 14.3)
sc.close()

# ================= 16 – 17 · la tablée + la vraie carte Rencontre
sc = Scene(16.0, 17.0, DEEP, 110)
v = video(sc, 'g12', 16.0, 17.0, 1.6)
T(f'#{v}', {'xPercent': 100}, {'xPercent': 0, 'duration': 0.3, 'ease': 'power4.out'}, 16.0, ir=False)
ri, _ = img(sc, 'assets/real/rencontre-marc.png', 540, 1450, 780, rad=60, z=12)
T(f'#{ri}', {'y': 400, 'opacity': 0, 'rotation': 8}, {'y': 0, 'opacity': 1, 'rotation': -2, 'duration': 0.4, 'ease': 'back.out(1.6)'}, 16.5)
text(sc, 'Des prénoms.', 540, 230, 16.1, size=120, family=GAR, weight=400, track='0', align='center', dur=0.35)
sc.close()

# ================= 17 – 18,5 · le vrai carnet ; ses chiffres réels comptent
sc = Scene(17.0, 18.5, 'linear-gradient(180deg,#F3EFE8 0%,#E3E9E3 100%)', 120)
T(f'#{sc.id}', {'yPercent': 100}, {'yPercent': 0, 'duration': 0.3, 'ease': 'power4.out'}, 17.0, ir=False)
ci, chh = img(sc, 'assets/real/carnet-ecrins.png', 540, 1380, 960, rad=56, z=5)
T(f'#{ci}', {'y': 600, 'rotationX': 30}, {'y': 0, 'rotationX': 0, 'duration': 0.5, 'ease': 'expo.out'}, 17.05)
for k, (val, unit, x) in enumerate([(4, 'JOURS', 190), (72, 'KM', 540), (4520, 'M D+', 890)]):
    ni = uid('n')
    sc.add(f'<div style="position:absolute;left:{x - 200}px;width:400px;top:330px;text-align:center;z-index:8">'
           f'<div id="{ni}" style="{ANTON};font-size:{170 if val < 1000 else 150}px;line-height:1;color:{FOREST};opacity:0">0</div>'
           f'<div style="{SANS};font-weight:600;font-size:30px;letter-spacing:.24em;color:{SAGE};margin-top:14px">{unit}</div></div>')
    j.append(f'(function(){{const el=document.getElementById("{ni}"); const o={{v:0}}; tl.fromTo(o,{{v:0}},{{v:{val},duration:0.9,ease:"power2.out",'
             f'onUpdate:function(){{const n=Math.round(o.v); el.textContent=(n>=1000?("+"+Math.floor(n/1000)+"\\u202f"+String(n%1000).padStart(3,"0")):String(n));}}}},{17.1 + 0.15 * k});}})();')
    T(f'#{ni}', {'scale': 0.6, 'opacity': 0}, {'scale': 1, 'opacity': 1, 'duration': 0.3, 'ease': 'back.out(2)'}, 17.1 + 0.15 * k)
text(sc, 'TOUR DES ÉCRINS · TON CARNET', 540, 200, 17.1, size=30, color=SAGE, weight=600, track='.24em', align='center', words=False, shadow=False)
sc.close()

# ================= 18,5 – 20 · LE KIT DU VOYAGEUR
sc = Scene(18.5, 20.0, f'radial-gradient(120% 80% at 50% 45%,#14352A 0%,{DEEP} 75%)', 130)
flash(18.5, 0.7, 0.4)
lg = uid('lg')
sc.add(f'<img id="{lg}" src="assets/img/badge-anneau.png" alt="" style="position:absolute;left:390px;top:520px;width:300px;height:300px;z-index:5;opacity:0">')
T(f'#{lg}', {'scale': 2.4, 'opacity': 0, 'rotation': -40}, {'scale': 1, 'opacity': 1, 'rotation': 0, 'duration': 0.5, 'ease': 'expo.out'}, 18.5)
text(sc, 'LE KIT DU VOYAGEUR', 540, 900, 18.65, size=96, family=ANTON, weight=400, track='.06em', align='center', words=False, dur=0.3)
text(sc, 'Là où la carte se termine.', 540, 1030, 18.95, size=80, family=GAR, weight=400, track='0', align='center', color=BRASS, dur=0.5, stag=0.05)
sc.close()
TO('#root > *:not(audio)', {'opacity': 0, 'duration': 0.25}, D - 0.25)

html_body = '\n'.join('      ' + x for x in h).strip()
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
      html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:{DEEP}; }}
      #root {{ position:relative; width:{W}px; height:{H}px; overflow:hidden; background:{DEEP}; -webkit-font-smoothing:antialiased; }}
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
