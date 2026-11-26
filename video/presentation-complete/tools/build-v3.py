# Présentation complète de LKDV — 9:16 (1080×1920), 20 premières secondes, 120 BPM (un temps = 0,5 s).
# v3 : on CHANGE DE SCÈNE toutes les 1,5 s environ ; chaque scène a sa composition, sa couleur et son mouvement propres.
#   S0  0,0–2,0  HOOK : huit mots géants (Anton), un par croche, fonds alternés ; la vraie tuile du Hub claque avec chaque mot.
#   S1  2,0–3,0  « Tout ça… » / « …dans une seule app. » (encre) ; les huit tuiles s'aspirent au centre.
#   S2  3,0–4,5  Le téléphone tombe et flotte en 3D devant « HUB » géant rempli par le vrai écran.
#   S3  4,5–6,0  Fond pierre : deux rangées de vraies tuiles défilent en sens contraire.
#   S4  6,0–7,5  Météo : gros plan du vrai tiroir, la frise horaire glisse ; « 6,8° » géant en contour.
#   S5  7,5–9,0  Carte : la vraie carte du tiroir couchée en perspective ; le repère réel pulse.
#   S6  9,0–10,5 Kits : la vraie checklist défile plein cadre ; « 11 » géant.
#   S7  10,5–12  Budget, fond laiton : les trois vraies cartes claquent une par temps.
#   S8  12–13,5  Étapes : le vrai bouton « Démarrer le voyage », pressé sur le temps.
#   S9  13,5–15  Paperasse : un mot par temps, le liseré laiton passe d'onglet en onglet.
#   S10 15–16,5  Écran coupé en diagonale : Carnet (raconter) / Groupe (ensemble).
#   S11 16,5–18,5 Carrousel 3D des huit vrais détails autour du téléphone, puis aspiration.
#   S12 18,5–20  « Ce n'était que le Hub. »
# Tout ce qui ressemble à l'app EST l'app : captures 393×852 à 3x du compte de démo sur main (assets/screens, assets/real).
import os, math, json
from PIL import Image
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = 20.0
W, H = 1080, 1920
INK, STONE, BRASS, GREY = '#0B1F17', '#FAF8F5', '#D0A070', 'rgba(250,248,245,.66)'
FOREST, SAGE, DEEP = '#17402C', '#5B7F55', '#06120C'
SANS = "font-family:Inter,sans-serif"
ANTON = "font-family:Anton,Inter,sans-serif;font-weight:400"
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

class Scene:
    """Un plan plein cadre visible de t0 à t1 (coupe sèche aux bornes, sauf transition explicite)."""
    def __init__(self, t0, t1, bg, z):
        self.id = uid('S'); self.t0, self.t1, self.z = t0, t1, z; self.kids = []
        h.append(None); self.slot = len(h) - 1; self.bg = bg
        j.append(f'gsap.set("#{self.id}",{{autoAlpha:0}});')
        SET(f'#{self.id}', {'autoAlpha': 1}, t0); SET(f'#{self.id}', {'autoAlpha': 0}, t1)
    def add(self, html): self.kids.append(html)
    def close(self):
        h[self.slot] = (f'<div id="{self.id}" style="position:absolute;inset:0;overflow:hidden;background:{self.bg};z-index:{self.z};perspective:1600px">' + ''.join(self.kids) + '</div>')

def text(sc, txt, x, y, t_in, size=80, color=STONE, family=SANS, weight=700, track='-0.025em', lh=1.1, align='left', words=True, dur=0.45, stag=0.035, w=None, extra='', t_out=None, out=0.2):
    """Texte masqué qui monte (mot à mot). x = bord gauche (align left), centre (center) ou bord droit (right)."""
    i = uid('t'); hgt = math.ceil(size * lh) + 4
    ws = txt.split(' ') if words else [txt]
    inner = ' '.join(f'<span class="{i}w" style="display:inline-block">{w_}</span>' for w_ in ws)
    if align == 'center': pos = f'left:0;right:0;text-align:center'
    elif align == 'right': pos = f'right:{W - x}px;text-align:right'
    else: pos = f'left:{x}px;text-align:left'
    sc.add(f'<div id="{i}" style="position:absolute;{pos};top:{y}px;height:{hgt}px;overflow:hidden;{extra}">'
           f'<div style="{family};font-weight:{weight};font-size:{size}px;line-height:{lh};letter-spacing:{track};color:{color};white-space:nowrap">{inner}</div></div>')
    j.append(f'gsap.set(".{i}w",{{yPercent:130}});')
    j.append(f'tl.to(".{i}w",{{yPercent:0,duration:{dur},ease:"expo.out",stagger:{stag}}},{round(t_in, 3)});')
    if t_out is not None: j.append(f'tl.to(".{i}w",{{yPercent:-130,duration:{out},ease:"power3.in",stagger:0.015}},{round(t_out - out, 3)});')
    return i

def img(sc, src, cx, cy, w, rad=0, z=1, shadow=True, extra='', op=1):
    iw, ih = size_of(src); hh = ih * w / iw; i = uid('i')
    sh = 'box-shadow:0 30px 80px rgba(4,12,8,.45),0 0 0 1px rgba(255,255,255,.14);' if shadow else ''
    sc.add(f'<div id="{i}" style="position:absolute;left:{cx - w / 2:.1f}px;top:{cy - hh / 2:.1f}px;width:{w:.1f}px;height:{hh:.1f}px;border-radius:{rad}px;overflow:hidden;{sh}z-index:{z};opacity:{op};{extra}">'
           f'<img src="{src}" alt="" style="display:block;width:100%;height:100%"></div>')
    return i, hh

def phone(sc, src, cx, cy, sh, z=5, extra=''):
    """Un vrai écran (393×852) dans un cadre de téléphone ; sh = hauteur de l'écran en px."""
    s = sh / 852; sw = 393 * s; bz = 12 * sh / 900; rad = 58 * sh / 900; i = uid('p')
    sc.add(f'<div id="{i}" style="position:absolute;left:{cx - sw / 2 - bz:.1f}px;top:{cy - sh / 2 - bz:.1f}px;width:{sw + 2 * bz:.1f}px;height:{sh + 2 * bz:.1f}px;border-radius:{rad + bz:.1f}px;'
           f'background:#0A0F0C;box-shadow:0 60px 140px rgba(0,0,0,.55),0 0 0 1.5px rgba(255,255,255,.14);z-index:{z};{extra}">'
           f'<div style="position:absolute;left:{bz:.1f}px;top:{bz:.1f}px;width:{sw:.1f}px;height:{sh:.1f}px;border-radius:{rad:.1f}px;overflow:hidden">'
           f'<img id="{i}i" src="{src}" alt="" style="display:block;width:100%;height:100%"></div>'
           f'<div style="position:absolute;left:50%;top:{bz + 10 * s:.1f}px;width:{104 * s:.0f}px;height:{31 * s:.0f}px;margin-left:-{52 * s:.0f}px;border-radius:{16 * s:.0f}px;background:#000"></div></div>')
    return i

TILES = ['meteo', 'carte', 'budget', 'etapes', 'paperasse', 'kits', 'carnet', 'groupe']
WORDS = {'meteo': 'MÉTÉO', 'carte': 'CARTE', 'budget': 'BUDGET', 'etapes': 'ÉTAPES', 'paperasse': 'PAPIERS', 'kits': 'KITS', 'carnet': 'CARNET', 'groupe': 'GROUPE'}

# ---------- grain et vignette (au-dessus de tout)
h.append(f'<div id="grain" style="position:absolute;left:-60px;top:-60px;width:{W + 120}px;height:{H + 120}px;background:url(assets/img/grain.png);opacity:.06;z-index:800;pointer-events:none;mix-blend-mode:overlay"></div>')
j.append(f'tl.fromTo("#grain",{{x:0,y:0}},{{x:-48,y:37,duration:{D},ease:"steps({int(D * 12)})"}},0);')
h.append('<div id="vig" style="position:absolute;inset:0;z-index:780;pointer-events:none;background:radial-gradient(120% 85% at 50% 45%,rgba(0,0,0,0) 60%,rgba(4,12,8,.4) 100%)"></div>')
h.append(f'<div id="flash" style="position:absolute;inset:0;background:{STONE};z-index:700;opacity:0;pointer-events:none"></div>')
def flash(t, a=0.6):
    T('#flash', {'opacity': a}, {'opacity': 0, 'duration': 0.3, 'ease': 'power2.out'}, t, ir=False)

# ================= S0 · HOOK (0 – 2) : un mot par croche
BGS = [(DEEP, STONE), (STONE, INK), (BRASS, INK), (FOREST, STONE), (INK, BRASS), (STONE, FOREST), (SAGE, STONE), (DEEP, BRASS)]
for k, name in enumerate(TILES):
    t0 = 0.25 * k; bg, fg = BGS[k]
    sc = Scene(t0, t0 + 0.25, bg, 10 + k)
    word = WORDS[name]
    wi = uid('w')
    sc.add(f'<div id="{wi}" style="position:absolute;left:0;right:0;top:330px;text-align:center;{ANTON};font-size:{300 if len(word) <= 6 else 250}px;line-height:1;letter-spacing:.01em;color:{fg}">{word}</div>')
    T(f'#{wi}', {'scale': 1.35, 'y': 0}, {'scale': 1, 'y': 0, 'duration': 0.22, 'ease': 'expo.out'}, t0)
    rot = [-6, 5, -4, 7, -5, 4, -7, 5][k]
    ti, _ = img(sc, f'assets/real/hub-{name}.png', 540 + [-60, 70, -40, 60, -70, 50, -50, 40][k], 1150, 640 if name not in ('carte', 'etapes') else 420, rad=36, z=3)
    T(f'#{ti}', {'scale': 0.6, 'rotation': rot * 2, 'y': 160}, {'scale': 1, 'rotation': rot, 'y': 0, 'duration': 0.22, 'ease': 'back.out(1.6)'}, t0)
    sc.close()
# ================= S1 · « Tout ça… dans une seule app. » (2 – 3)
sc = Scene(2.0, 3.0, INK, 30)
for k, name in enumerate(TILES):
    a = math.radians(k * 45 + 20); rx, ry = 540 + 380 * math.cos(a), 960 + 520 * math.sin(a)
    ti, _ = img(sc, f'assets/real/hub-{name}.png', rx, ry, 300 if name not in ('carte', 'etapes') else 190, rad=18, z=2)
    T(f'#{ti}', {'opacity': 0, 'scale': 0.4}, {'opacity': 1, 'scale': 1, 'duration': 0.25, 'ease': 'back.out(1.6)'}, 2.0 + 0.03 * k)
    TO(f'#{ti}', {'x': 540 - rx, 'y': 960 - ry, 'scale': 0.1, 'rotation': 90, 'opacity': 0, 'duration': 0.38, 'ease': 'power3.in'}, 2.6)
text(sc, 'Tout ça…', 540, 800, 2.0, size=130, align='center', words=False, dur=0.3, t_out=2.5, out=0.12)
text(sc, '…dans une seule app.', 540, 830, 2.5, size=96, color=BRASS, align='center', dur=0.3, stag=0.03)
sc.close()

# ================= S2 · LE HUB en 3D (3 – 4,5)
sc = Scene(3.0, 4.5, f'radial-gradient(120% 80% at 50% 45%,#14352A 0%,{DEEP} 75%)', 40)
hb = uid('hb')
sc.add(f'<div id="{hb}" style="position:absolute;left:-40px;top:250px;{ANTON};font-size:880px;line-height:.9;letter-spacing:-.01em;white-space:nowrap;'
       f'background:url(assets/screens/hub.png) 0 0/1080px auto;-webkit-background-clip:text;background-clip:text;color:transparent;opacity:.5">HUB</div>')
T(f'#{hb}', {'x': 120, 'backgroundPosition': '0px 0px'}, {'x': -120, 'backgroundPosition': '0px -500px', 'duration': 1.5, 'ease': 'none'}, 3.0)
ph = phone(sc, 'assets/screens/hub.png', 540, 1000, 1080, z=5, extra='transform-style:preserve-3d')
T(f'#{ph}', {'y': -1500, 'rotationX': 0, 'rotationY': 0, 'rotationZ': -8}, {'y': 0, 'rotationX': 14, 'rotationY': -24, 'rotationZ': 0, 'duration': 0.5, 'ease': 'back.out(1.1)'}, 3.0)
TO(f'#{ph}', {'rotationY': 18, 'rotationX': 8, 'duration': 1.0, 'ease': 'sine.inOut'}, 3.5)
text(sc, '01 · LE HUB', 96, 120, 3.25, size=30, color=BRASS, weight=600, track='.3em', words=False)
text(sc, 'Ton aventure,', 96, 1600, 3.4, size=84)
text(sc, 'd’un coup d’œil.', 96, 1700, 3.6, size=84, weight=500, color=GREY)
sc.close()

# ================= S3 · défilé de tuiles sur pierre (4,5 – 6)
sc = Scene(4.5, 6.0, STONE, 50)
T(f'#{sc.id}', {'xPercent': 100}, {'xPercent': 0, 'duration': 0.25, 'ease': 'power4.out'}, 4.5, ir=False)   # coup de fouet
rows = [(['meteo', 'budget', 'carnet', 'kits', 'meteo', 'budget'], 640, -1), (['paperasse', 'groupe', 'paperasse', 'groupe'], 1180, 1)]
for names, y, d in rows:
    rid = uid('row'); x = 0; parts = []
    for n in names:
        iw, ih = size_of(f'assets/real/hub-{n}.png'); hgt = 300 if n in ('paperasse', 'groupe') else 330; w_ = iw * hgt / ih
        parts.append(f'<div style="position:absolute;left:{x:.0f}px;top:{-hgt / 2:.0f}px;width:{w_:.0f}px;height:{hgt}px;border-radius:30px;overflow:hidden;box-shadow:0 24px 60px rgba(11,31,23,.22)">'
                     f'<img src="assets/real/hub-{n}.png" alt="" style="width:100%;height:100%;display:block"></div>'); x += w_ + 36
    sc.add(f'<div id="{rid}" style="position:absolute;left:0;top:{y}px;width:{x:.0f}px;height:1px">' + ''.join(parts) + '</div>')
    span = x - W
    T(f'#{rid}', {'x': 0 if d < 0 else -span}, {'x': -span if d < 0 else 0, 'duration': 1.5, 'ease': 'power1.inOut'}, 4.5)
text(sc, 'Tout ton voyage.', 540, 250, 4.62, size=104, color=INK, align='center')
text(sc, 'Sur un seul écran.', 540, 1520, 4.85, size=84, color=FOREST, weight=500, align='center')
sc.close()

# ================= S4 · MÉTÉO (6 – 7,5) : zoom à travers la tuile, gros plan du vrai tiroir
sc = Scene(6.0, 7.5, f'linear-gradient(180deg,#0E2A3A 0%,{DEEP} 100%)', 60)
big = uid('bg')
sc.add(f'<div id="{big}" style="position:absolute;left:0;right:0;top:120px;text-align:center;{ANTON};font-size:560px;line-height:1;color:transparent;-webkit-text-stroke:3px rgba(208,160,112,.55)">6,8°</div>')
T(f'#{big}', {'scale': 1.4, 'opacity': 0}, {'scale': 1, 'opacity': 1, 'duration': 0.6, 'ease': 'expo.out'}, 6.0)
mi, mh = img(sc, 'assets/real/tiroir-meteo.png', 540, 900, 980, rad=50, z=3)
T(f'#{mi}', {'scale': 0.32, 'y': 300, 'rotation': -6}, {'scale': 1, 'y': 0, 'rotation': 0, 'duration': 0.5, 'ease': 'expo.out'}, 6.0)
fr, fh = img(sc, 'assets/real/tiroir-meteo-frise.png', 540, 1290, 1020, rad=40, z=2)
T(f'#{fr}', {'x': 700, 'opacity': 0}, {'x': 0, 'opacity': 1, 'duration': 0.45, 'ease': 'expo.out'}, 6.5)
TO(f'#{fr}', {'x': -60, 'duration': 0.55, 'ease': 'none'}, 6.95)
text(sc, 'MÉTÉO', 96, 1560, 6.5, size=34, color=BRASS, weight=600, track='.28em', words=False)
text(sc, 'MET Norway, heure par heure.', 96, 1612, 6.62, size=60)
sc.close()

# ================= S5 · CARTE (7,5 – 9) : la vraie carte couchée en perspective
sc = Scene(7.5, 9.0, f'linear-gradient(180deg,{DEEP} 0%,#14352A 100%)', 70)
j.append(f'gsap.set("#{sc.id}",{{clipPath:"circle(0% at 50% 50%)"}});')
T(f'#{sc.id}', {'clipPath': 'circle(0% at 50% 55%)'}, {'clipPath': 'circle(80% at 50% 55%)', 'duration': 0.35, 'ease': 'power3.out'}, 7.5, ir=False)
ci, chh = img(sc, 'assets/real/tiroir-carte.png', 540, 1060, 940, rad=56, z=2, extra='transform-origin:50% 60%')
T(f'#{ci}', {'rotationX': 0, 'scale': 1.25}, {'rotationX': 38, 'scale': 1, 'duration': 0.9, 'ease': 'expo.out'}, 7.5)
TO(f'#{ci}', {'rotationZ': -6, 'duration': 0.6, 'ease': 'sine.inOut'}, 8.4)
# le repère réel (Le Pont-de-Claix) : un anneau laiton pulse dessus, sur chaque temps
pin = uid('pn')
sc.add(f'<div id="{pin}" style="position:absolute;left:{540 - 940 / 2 + 940 * 0.587 - 60:.0f}px;top:{1060 - chh / 2 + chh * 0.535 - 60:.0f}px;width:120px;height:120px;border-radius:60px;border:5px solid {BRASS};z-index:4;opacity:0"></div>')
for t in (8.0, 8.5):
    T(f'#{pin}', {'scale': 0.2, 'opacity': 1}, {'scale': 1.6, 'opacity': 0, 'duration': 0.45, 'ease': 'power2.out'}, t, ir=False)
text(sc, 'CARTE', 540, 150, 7.6, size=34, color=BRASS, weight=600, track='.28em', words=False, align='center')
text(sc, 'Ta trace,', 540, 205, 7.7, size=110, align='center')
text(sc, 'même hors ligne.', 540, 330, 7.9, size=110, color=GREY, weight=500, align='center')
sc.close()

# ================= S6 · KITS (9 – 10,5) : la vraie checklist défile plein cadre
sc = Scene(9.0, 10.5, STONE, 80)
T(f'#{sc.id}', {'yPercent': 100}, {'yPercent': 0, 'duration': 0.25, 'ease': 'power4.out'}, 9.0, ir=False)
onze = uid('o')
sc.add(f'<div id="{onze}" style="position:absolute;right:30px;top:40px;{ANTON};font-size:640px;line-height:1;color:rgba(23,64,44,.1)">11</div>')
T(f'#{onze}', {'y': 200}, {'y': -60, 'duration': 1.5, 'ease': 'none'}, 9.0)
li, lh_ = img(sc, 'assets/real/tiroir-kits-liste.png', 540, 0, 900, rad=44, z=3, shadow=True)
T(f'#{li}', {'y': 1500}, {'y': 1150, 'duration': 0.35, 'ease': 'expo.out'}, 9.0)
TO(f'#{li}', {'y': 640, 'duration': 1.15, 'ease': 'power1.inOut'}, 9.35)
mask = uid('m')
sc.add(f'<div id="{mask}" style="position:absolute;left:0;right:0;top:0;height:660px;background:linear-gradient({STONE} 82%,rgba(250,248,245,0));z-index:4"></div>')
text(sc, 'KITS', 96, 150, 9.1, size=34, color=SAGE, weight=600, track='.28em', words=False, extra='z-index:5')
text(sc, 'Ton sac,', 96, 205, 9.2, size=110, color=INK, extra='z-index:5')
text(sc, 'objet par objet.', 96, 330, 9.4, size=110, color=FOREST, weight=500, extra='z-index:5')
sc.close()

# ================= S7 · BUDGET (10,5 – 12) : fond laiton, trois vraies cartes, une par temps
sc = Scene(10.5, 12.0, BRASS, 90)
euro = uid('eu')
sc.add(f'<div id="{euro}" style="position:absolute;left:0;right:0;top:420px;text-align:center;{ANTON};font-size:1100px;line-height:1;color:rgba(11,31,23,.08)">€</div>')
T(f'#{euro}', {'rotation': -12, 'scale': 1.2}, {'rotation': 6, 'scale': 1, 'duration': 1.5, 'ease': 'none'}, 10.5)
for k, (n, y, rot) in enumerate([('rythme', 760, -4), ('projection', 1060, 3), ('marge', 1380, -2)]):
    bi, _ = img(sc, f'assets/real/budget-{n}.png', 540 + [-90, 80, 0][k], y, 640 if n != 'marge' else 720, rad=40, z=3 + k)
    T(f'#{bi}', {'scale': 2.4, 'opacity': 0, 'rotation': rot * 3}, {'scale': 1, 'opacity': 1, 'rotation': rot, 'duration': 0.24, 'ease': 'power4.in'}, 10.5 + 0.5 * k - 0.2)
    T(f'#{bi}', {'y': 0}, {'y': 10, 'duration': 0.08, 'yoyo': True, 'repeat': 1, 'ease': 'power2.out'}, 10.5 + 0.5 * k + 0.04, ir=False)
text(sc, 'BUDGET', 96, 150, 10.55, size=34, color=INK, weight=600, track='.28em', words=False)
text(sc, 'Ce qui part,', 96, 205, 10.65, size=110, color=INK)
text(sc, 'ce qui reste.', 96, 330, 10.85, size=110, color=STONE, weight=500)
sc.close()

# ================= S8 · ÉTAPES (12 – 13,5) : le vrai bouton, pressé sur le temps
sc = Scene(12.0, 13.5, FOREST, 100)
T(f'#{sc.id}', {'xPercent': -100}, {'xPercent': 0, 'duration': 0.25, 'ease': 'power4.out'}, 12.0, ir=False)
jj = uid('jj')
sc.add(f'<div id="{jj}" style="position:absolute;left:0;right:0;top:150px;text-align:center;{ANTON};font-size:400px;line-height:1;color:transparent;-webkit-text-stroke:3px rgba(208,160,112,.6)">J-191</div>')
T(f'#{jj}', {'scale': 1.3, 'opacity': 0}, {'scale': 1, 'opacity': 1, 'duration': 0.5, 'ease': 'expo.out'}, 12.0)
TO(f'#{jj}', {'scale': 0.94, 'duration': 1.0, 'ease': 'none'}, 12.5)
ei, eh = img(sc, 'assets/real/tiroir-etapes.png', 540, 1000, 1000, rad=60, z=3)
T(f'#{ei}', {'scale': 0.7, 'opacity': 0}, {'scale': 1, 'opacity': 1, 'duration': 0.4, 'ease': 'expo.out'}, 12.05)
# appui sur « Démarrer le voyage » (le bouton est à ~70 % de la largeur, ~44 % de la hauteur de la découpe)
bx, by = 540 - 500 + 1000 * 0.705, 1000 - eh / 2 + eh * 0.43
TO(f'#{ei}', {'scale': 0.965, 'duration': 0.06, 'ease': 'power2.in'}, 12.5); TO(f'#{ei}', {'scale': 1, 'duration': 0.25, 'ease': 'back.out(3)'}, 12.56)
rp = uid('rp')
sc.add(f'<div id="{rp}" style="position:absolute;left:{bx - 90:.0f}px;top:{by - 90:.0f}px;width:180px;height:180px;border-radius:90px;background:rgba(208,160,112,.35);border:4px solid {BRASS};z-index:5;opacity:0"></div>')
T(f'#{rp}', {'scale': 0.2, 'opacity': 1}, {'scale': 2.4, 'opacity': 0, 'duration': 0.48, 'ease': 'power2.out'}, 12.5, ir=False)
T(f'#{rp}', {'scale': 0.2, 'opacity': 1}, {'scale': 2.4, 'opacity': 0, 'duration': 0.6, 'ease': 'power2.out'}, 13.0, ir=False)
text(sc, 'ÉTAPES', 984, 1300, 12.15, size=34, color=BRASS, weight=600, track='.28em', words=False, align='right')
text(sc, 'Jour après jour,', 984, 1355, 12.25, size=100, align='right')
text(sc, 'jusqu’au départ.', 984, 1470, 12.45, size=100, color=GREY, weight=500, align='right')
sc.close()

# ================= S9 · PAPERASSE (13,5 – 15) : un mot par temps, le liseré passe d'onglet en onglet
sc = Scene(13.5, 15.0, INK, 110)
j.append(f'gsap.set("#{sc.id}",{{clipPath:"inset(50% 0% 50% 0%)"}});')
T(f'#{sc.id}', {'clipPath': 'inset(50% 0% 50% 0%)'}, {'clipPath': 'inset(0% 0% 0% 0%)', 'duration': 0.3, 'ease': 'power4.out'}, 13.5, ir=False)
pi, phh = img(sc, 'assets/real/tiroir-paperasse.png', 540, 1020, 1000, rad=60, z=3)
T(f'#{pi}', {'y': 300, 'opacity': 0}, {'y': 0, 'opacity': 1, 'duration': 0.4, 'ease': 'expo.out'}, 13.5)
ring = uid('rg')
tabs = [(0.205, 0.33), (0.5, 0.33), (0.79, 0.30)]           # centre et largeur des trois onglets, en fraction de la découpe
sc.add(f'<div id="{ring}" style="position:absolute;left:{540 - 500 + 1000 * tabs[0][0] - 1000 * tabs[0][1] / 2:.0f}px;top:{1020 - phh / 2 + 12:.0f}px;width:{1000 * tabs[0][1]:.0f}px;height:{phh - 24:.0f}px;'
       f'border-radius:{(phh - 24) / 2:.0f}px;border:5px solid {BRASS};box-shadow:0 0 30px rgba(208,160,112,.6);z-index:4;opacity:0"></div>')
SET(f'#{ring}', {'opacity': 1}, 13.55)
for k, ((cx_, wf), word) in enumerate(zip(tabs, ['Billets.', 'Réservations.', 'Urgences.'])):
    t = 13.5 + 0.5 * k
    if k: TO(f'#{ring}', {'x': 1000 * (cx_ - tabs[0][0]), 'width': 1000 * wf, 'duration': 0.22, 'ease': 'power3.inOut'}, t - 0.06)
    text(sc, word, 540, 430, t - 0.03, size=150, family=ANTON, weight=400, track='.01em', color=[STONE, BRASS, STONE][k], align='center', words=False, dur=0.2, t_out=t + 0.5 if k < 2 else None, out=0.1)
pp = phone(sc, 'assets/screens/tiroirs/hub-paperasse.png', 540, 1900, 1050, z=2)
T(f'#{pp}', {'y': 700}, {'y': 0, 'duration': 0.6, 'ease': 'expo.out'}, 13.6)
text(sc, 'PAPERASSE · TOUT AU MÊME ENDROIT', 540, 1240, 13.7, size=30, color=GREY, weight=600, track='.22em', words=False, align='center')
sc.close()

# ================= S10 · Écran coupé en diagonale : Carnet / Groupe (15 – 16,5)
sc = Scene(15.0, 16.5, DEEP, 120)
top_ = uid('dg'); bot_ = uid('dg')
sc.add(f'<div id="{top_}" style="position:absolute;inset:0;background:{STONE};clip-path:polygon(0 0,100% 0,100% 38%,0 62%);z-index:1"></div>')
sc.add(f'<div id="{bot_}" style="position:absolute;inset:0;background:{FOREST};clip-path:polygon(0 62%,100% 38%,100% 100%,0 100%);z-index:1"></div>')
T(f'#{top_}', {'xPercent': -100}, {'xPercent': 0, 'duration': 0.3, 'ease': 'power4.out'}, 15.0)
T(f'#{bot_}', {'xPercent': 100}, {'xPercent': 0, 'duration': 0.3, 'ease': 'power4.out'}, 15.0)
ca, _ = img(sc, 'assets/real/tiroir-carnet.png', 560, 520, 900, rad=50, z=3)
T(f'#{ca}', {'x': -1100, 'rotation': -8}, {'x': 0, 'rotation': -3, 'duration': 0.45, 'ease': 'expo.out'}, 15.1)
gr, _ = img(sc, 'assets/real/tiroir-groupe.png', 520, 1420, 900, rad=50, z=3)
T(f'#{gr}', {'x': 1100, 'rotation': 8}, {'x': 0, 'rotation': 3, 'duration': 0.45, 'ease': 'expo.out'}, 15.5)
text(sc, 'Raconter.', 96, 150, 15.1, size=120, color=INK, family=ANTON, weight=400, track='.01em', words=False, extra='z-index:4')
text(sc, 'Ensemble.', 984, 1660, 15.5, size=120, color=BRASS, family=ANTON, weight=400, track='.01em', words=False, align='right', extra='z-index:4')
sc.close()

# ================= S11 · Carrousel 3D des huit vrais détails (16,5 – 18,5)
sc = Scene(16.5, 18.5, f'radial-gradient(120% 80% at 50% 50%,#14352A 0%,{DEEP} 75%)', 130)
flash(16.5, 0.5)
car = uid('car'); RR = 470
cards = ['tiroir-meteo', 'budget-marge', 'tiroir-carte', 'tiroir-etapes', 'tiroir-carnet', 'tiroir-kits', 'tiroir-paperasse', 'tiroir-groupe']
inner = []
for k, c in enumerate(cards):
    iw, ih = size_of(f'assets/real/{c}.png'); cw = 560 if c != 'tiroir-carte' else 380; chh2 = ih * cw / iw
    inner.append(f'<div style="position:absolute;left:{-cw / 2:.0f}px;top:{-chh2 / 2:.0f}px;width:{cw}px;height:{chh2:.0f}px;border-radius:26px;overflow:hidden;backface-visibility:hidden;'
                 f'transform:rotateY({k * 45}deg) translateZ({RR}px);box-shadow:0 20px 50px rgba(0,0,0,.45)"><img src="assets/real/{c}.png" alt="" style="width:100%;height:100%;display:block"></div>')
sc.add(f'<div id="{car}" style="position:absolute;left:540px;top:1000px;width:0;height:0;transform-style:preserve-3d;z-index:3">' + ''.join(inner) + '</div>')
T(f'#{car}', {'rotationY': 0, 'rotationX': -8, 'scale': 0.3}, {'rotationY': -300, 'rotationX': -8, 'scale': 1, 'duration': 1.6, 'ease': 'power2.inOut'}, 16.5)
TO(f'#{car}', {'scale': 0, 'duration': 0.35, 'ease': 'power3.in'}, 18.1)
ph2 = phone(sc, 'assets/screens/hub.png', 540, 1000, 600, z=2)
T(f'#{ph2}', {'scale': 0.8, 'opacity': 0.6}, {'scale': 1, 'opacity': 1, 'duration': 1.6, 'ease': 'none'}, 16.5)
TO(f'#{ph2}', {'scale': 1.1, 'duration': 0.3, 'ease': 'power3.in'}, 18.2)
text(sc, 'Huit tiroirs.', 540, 400, 16.6, size=110, align='center')
text(sc, 'Un seul geste.', 540, 1460, 17.0, size=110, color=BRASS, weight=500, align='center')
sc.close()

# ================= S12 · « Ce n'était que le Hub. » (18,5 – 20)
sc = Scene(18.5, 20.0, STONE, 140)
flash(18.5, 0.8)
ph3 = phone(sc, 'assets/screens/hub.png', 540, 1220, 860, z=2)
T(f'#{ph3}', {'y': 900, 'rotationX': 30}, {'y': 0, 'rotationX': 0, 'duration': 0.6, 'ease': 'expo.out'}, 18.5)
text(sc, 'Ce n’était', 540, 200, 18.5, size=150, color=INK, family=ANTON, weight=400, track='.01em', align='center', words=False, dur=0.3)
text(sc, 'que le Hub.', 540, 370, 18.75, size=150, color=FOREST, family=ANTON, weight=400, track='.01em', align='center', words=False, dur=0.3)
text(sc, 'LE KIT DU VOYAGEUR', 540, 580, 19.1, size=30, color=SAGE, weight=600, track='.32em', words=False, align='center')
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
