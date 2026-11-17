#!/usr/bin/env python3
"""Génère le film animé (index.html + compositions/film/sNN.html) depuis boards/frames.py (v5).

Écrans réels uniquement (assets/app). 128 BPM : 1 temps = 0,46875 s, 1 mesure = 1,875 s.
Chaque temps se calcule depuis son indice (k * BEAT), jamais par additions d'arrondis.

Passe « mouvement » 2 (après RELECTURE-1) :
- écran du téléphone 412 × 896 = exactement le format des captures (1206 × 2622) : aucune
  capture n'est agrandie ni rognée sur les côtés ; aucun zoom dans l'écran. Seul recadrage :
  la messagerie (pos="bottom"), où c'est le téléphone entier qui est cadré par le bas du champ ;
- tout tient dans la zone sûre (téléphones entre y = 60 et y = 1020, x ≤ 1824) ;
- cinq sortes de coupes, chacune causée par l'image, le plan entrant recouvrant toujours le
  sortant (jamais de fond nu, jamais de fondu entre deux mondes) :
    whip  : fouet (horizontal sur 7 coupes, vertical « rise » sur 5 : le message qui part, etc.) ;
    grow  : ce qu'on touche devient le monde (carte du carnet 02 → 03, carte de l'empreinte
            21 → globe 22) ;
    iris  : un seul iris, depuis la flèche du Compas (05 → 06), le téléphone ne bouge pas ;
    stage : raccord sur le téléphone immobile (06 → 07 → 08 → 09, 13 → 14) : seuls le titre
            et l'écran changent ;
    dip   : trois images qui s'assombrissent puis coupe franche (12 → 13, 15 → 16, 22 → 23) ;
- les titres arrivent avec le plan (ou mot à mot sur un raccord immobile) et se posent tôt ;
  une fois posés, ils ne bougent plus ;
- le geste du pouce est un petit anneau qui ne cache pas le texte.

Le son (boards/film_audio.py, lecture seule) est calé sur les barres : on lui passe AUDIO_LEAD
(plan 06 : 0,35 s) et les gestes visibles tombent aux mêmes instants (tap 02 à barre + 1,525 s,
frappe 05 de + 0,05 à + 1,15 s, clic 05 à barre + 1,62 s, écrans 06 à + 0,47 / + 1,17 s, trois
étapes 07 sur les temps 2-4, légendes à barre + 0,83 s, sac du 10 sur les quatre temps de la
mesure 2, tap 17 à barre + 1,525 s, badge 23 calé à barre + 0,2 s)."""
import html
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from frames import FRAMES, BAR  # noqa: E402

for _try in range(10):  # film_audio.py peut être en cours d'écriture par l'agent du son
    try:
        from film_audio import audio_clips  # noqa: E402
        break
    except Exception:  # pragma: no cover
        time.sleep(3)
else:
    from film_audio import audio_clips  # noqa: E402,F811

E = html.escape
BEAT = BAR / 4
A = "assets/app/"
W, H = 1920, 1080
SW, SH = 412, 896          # écran = 1206 × 2622 réduit à la largeur exacte (rapport identique)
PAD = 16
PW, PH = SW + 2 * PAD, SH + 2 * PAD   # téléphone 444 × 928
FB = {f["n"]: f for f in FRAMES}

# --------------------------------------------------------------------------- montage
ENTRY = {2: "whip", 3: "grow", 4: "whip", 5: "rise", 6: "iris", 7: "stage", 8: "stage", 9: "stage",
         10: "whip", 11: "rise", 12: "whip", 13: "dip", 14: "stage", 15: "rise", 16: "dip",
         17: "whip", 18: "rise", 19: "whip", 20: "whip", 21: "rise", 22: "grow", 23: "dip"}
LEADS = {"whip": 0.3, "rise": 0.3, "grow": 0.35, "iris": 0.35, "stage": 0.0, "dip": 0.0, None: 0.0}
LEAD = {n: LEADS[ENTRY.get(n)] for n in range(1, len(FRAMES) + 1)}
AUDIO_LEAD = {6: LEAD[6]}  # le son ne connaît que l'avance de l'iris (inchangée : 0,35 s)
MOVING = {"whip", "rise", "grow"}   # le plan entre en bougeant : le titre arrive avec lui
CAP_SOUND = {4, 8, 9, 15, 20, 21}     # légendes qui ont un son : posées à barre + 0,83 (son + 1 image)
CAP_AT = 0.80
CAP_EARLY = 0.30                      # légendes muettes : posées tôt, pour être lues plus longtemps
CARRY_CAP = {7}                       # 07 garde la légende du 06 (« 5 jours · 61,5 km ») jusqu'au jour 2

# Positions des téléphones (coin haut-gauche du boîtier 444 × 928), toutes dans la zone sûre.
ONE = [(1190, 76)]
TWO = [(920, 60), (1376, 92)]
PHONES = {16: [(1376, 76)], 22: [(1376, 76), (1376, 76)]}
PUNCH = 2.0                           # messagerie : téléphone ×2, cadré par le bas (seul recadrage)
PUNCH_XY = (916, 1000 + PAD * PUNCH - PH * PUNCH)   # bas de l'écran à y = 1000


def screen_xy(px, py, u, v, s=1.0):
    """Point (u, v) relatif à la capture → coordonnées dans le cadre."""
    return px + s * (PAD + u * SW), py + s * (PAD + v * SH)


# Séquences d'écrans réels dans un même téléphone : [(image, temps depuis la barre, passage)].
# passage : blur (fondu flou 0,16 s, même écran qui change), scroll (le fil défile), cut (0,05 s).
SEQ = {
    1: [[(A + "feed-1.jpg", 0, None), (A + "feed-3.jpg", 1.9, "scroll")],
        [(A + "feed-2.jpg", 0, None), (A + "feed-4.jpg", 2.35, "scroll")]],
    6: [[(A + "compas-prep.jpg", 0.47, "blur"), (A + "compas-voyage.jpg", 1.17, "blur")]],  # pops du son
    7: [[(A + "compas-w-satellite.jpg", 0.05, "blur"), (A + "compas-jour2.jpg", BAR, "blur")]],
    8: [[(A + "compas-verdict.jpg", 0.05, "blur"), (A + "compas-sac.jpg", 3 * BEAT, "blur")]],
    9: [[(A + "compas-groupe.jpg", 0.05, "blur"), (A + "compas-budget.jpg", BEAT, "blur")]],
    # Temps fort 1 : le sac change sur chacun des quatre temps de la mesure 2 (clics du son).
    10: [[(A + "kit-studio-corps.jpg", 0, None), (A + "kit-studio-60.jpg", BAR, "cut"),
          (A + "kit-studio-80.jpg", BAR + BEAT, "cut"), (A + "kit-studio-sauge.jpg", BAR + 2 * BEAT, "cut"),
          (A + "kit-studio-pierre.jpg", BAR + 3 * BEAT, "cut")]],
    14: [[(A + "carnet-photos.jpg", 0.05, "blur")]],
    16: [[(A + "feed-1.jpg", 0, None), (A + "feed-2.jpg", 2 * BAR, "scroll"), (A + "feed-3.jpg", 2 * BAR + 2 * BEAT, "scroll")]],
    22: [[(A + "explorer-chili.jpg", 0, None)], [(A + "explorer-japon.jpg", 0, None)]],
}
# Plan 10 : le doigt sur la carte choisie, à chaque temps (vignette du sac, au-dessus du texte).
KIT_TAPS = [(0.507, 0.75), (0.807, 0.75), (0.207, 0.75), (0.507, 0.75)]
# Plan 07 : les trois refuges de la capture satellite (repères 1, 2 et 4), sur les temps 2-4.
W_STEPS = [(0.405, 0.351), (0.197, 0.621), (0.286, 0.784)]
# Rectangles (relatifs à la capture) qui deviennent le plan suivant (grow).
GROW_FROM = {3: (2, 0.055, 0.30, 0.49, 0.67, 24), 22: (21, 0.012, 0.646, 0.98, 0.915, 24)}
OVER_FLIGHT = {6, 7}  # plans posés sur le vol satellite (fond transparent)
FLIGHT_END = 10.9 + 4.9   # la photo exacte de la fin du vol prend le relais (5 s de vidéo)
# Fonds qui continuent d'une coupe à l'autre (raccords immobiles) : (plans, t0, t1, de, à).
BG_GROUPS = [((7, 8, 9), FLIGHT_END, FB[9]["end"], (0, 1.0), (0, 1.05)),
             ((13, 14), FB[13]["start"], FB[14]["end"], (-30, 1.06), (0, 1.0))]

# Plan 05 : vrai enregistrement. compas-creation-w-804.mp4 = 13 → 23 s de compas-creation-w.mp4,
# 30 i/s (images au quart agrandies ×2, voir passe 1). Frappe : 2,75 → 4,5 s de la source ;
# clic de la source vers 7 s (hors plan : le doigt du film touche la flèche à barre + 1,62 s).
REC = "assets/app/video/compas-creation-w-804.mp4"
REC_RATE = 1.5
REC_START = 2.2
# Flèche « > » du Compas dans l'enregistrement : (702, 1155) sur 804 × 1748, écran à la largeur.
ARROW = (1190 + PAD + 702 * SW / 804, 76 + PAD + 1155 * SH / 1748)
LIVE = "assets/app/video/live.mp4"
GLOBE_VID = "assets/map/globe-chili-japon.mp4"

CSS = """
    #root { position: absolute; inset: 0; overflow: hidden; font-family: "Inter", sans-serif; }
    .ri { position: absolute; inset: 0; }
    .fg, .txt { position: absolute; inset: 0; }
    .bgw { position: absolute; inset: 0; overflow: hidden; }
    .bgw img, .bgw video { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; object-fit: cover; }
    .shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(11,31,23,0.80) 0%, rgba(11,31,23,0.50) 48%, rgba(11,31,23,0.14) 100%); }
    .dip { position: absolute; inset: 0; background: rgba(11,31,23,0.5); opacity: 0; }
    .chapter { position: absolute; left: 124px; top: 232px; color: #dfe8dc; font-weight: 700; font-size: 28px; letter-spacing: 0.14em; text-transform: uppercase; }
    .title { position: absolute; left: 120px; top: 280px; width: 780px; color: #faf8f5; font-weight: 800; font-size: 100px; line-height: 1.02; letter-spacing: -0.03em; }
    .title em { font-family: "EB Garamond", serif; font-style: italic; font-weight: 500; }
    .w { display: inline-block; }
    .cap { position: absolute; left: 124px; top: 606px; display: flex; align-items: center; gap: 16px; padding: 16px 28px; border-radius: 999px; background: rgba(250,248,245,0.94); color: #17402c; font-size: 32px; font-weight: 700; box-shadow: 0 16px 40px rgba(11,31,23,0.25); }
    .cap i { width: 14px; height: 14px; border-radius: 50%; background: #5b7f55; }
    .pz { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
    .phone { position: absolute; width: 444px; height: 928px; border-radius: 64px; background: #0b1f17; padding: 16px; box-shadow: 0 40px 90px rgba(11,31,23,0.55); }
    .screen { position: relative; width: 412px; height: 896px; border-radius: 50px; overflow: hidden; background: #faf8f5; }
    .cam { position: absolute; left: 0; top: 0; width: 412px; height: 896px; }
    .screen img, .screen video { position: absolute; left: 0; top: 0; width: 412px; height: 896px; object-fit: cover; object-position: center top; }
    .touch { position: absolute; width: 40px; height: 40px; border-radius: 50%; border: 3px solid #faf8f5; background: rgba(250,248,245,0.22); box-shadow: 0 4px 14px rgba(11,31,23,0.4); opacity: 0; }
    .mk { position: absolute; width: 54px; height: 54px; border-radius: 50%; border: 3px solid #faf8f5; box-shadow: 0 0 0 3px rgba(23,64,44,0.7), 0 4px 12px rgba(11,31,23,0.4); opacity: 0; }
"""


def f3(x):
    return f"{x:.3f}"


def words(text, cls):
    return " ".join(f'<span class="w {cls}">{E(t)}</span>' for t in text.split())


# --------------------------------------------------------------------------- briques
def bg_drift(n, sid, L, D):
    """Fond : lente dérive qui se pose ; continue d'un plan à l'autre sur un raccord immobile."""
    comp0 = FB[n]["start"] - L
    for plans, t0, t1, (x0, s0), (x1, s1) in BG_GROUPS:
        if n in plans:
            a, b = max(t0, comp0), min(t1, comp0 + D)

            def at(t):
                p = (t - t0) / (t1 - t0)
                return x0 + (x1 - x0) * p, s0 + (s1 - s0) * p
            (xa, sa), (xb, sb) = at(a), at(b)
            return (f'tl.fromTo("#{sid}-bgi", {{ x: {xa:.2f}, scale: {sa:.4f} }}, '
                    f'{{ x: {xb:.2f}, scale: {sb:.4f}, duration: {f3(b - a)}, ease: "none" }}, {f3(a - comp0)});')
    return f'tl.fromTo("#{sid}-bgi", {{ x: -30, scale: 1.06 }}, {{ x: 0, scale: 1.0, duration: {f3(D)}, ease: "none" }}, 0);'


def title_html(f, sid):
    n = f["n"]
    size = f.get("title_size") or (88 if n == 11 else 92 if n == 22 else 100)
    width = 1030 if n == 5 else 1000 if n == 22 else 780
    lh = 1.1 if size < 80 else 1.02
    out = []
    if f.get("chapter"):
        out.append(f'<div class="chapter" id="{sid}-ch">{E(f["chapter"])}</div>')
    out.append(f'<div class="title" id="{sid}-ti" style="font-size:{size}px; width:{width}px; line-height:{lh}">'
               f'{words(f["title"], sid + "-t1")}<br /><em>{words(f["em"], sid + "-t2")}</em></div>')
    return out


def title_tweens(f, sid, L):
    """Plan qui entre en bougeant : chapitre et 1re ligne arrivent avec lui, la 2e ligne se pose
    sur la barre. Raccord immobile, iris ou coupe : tout entre mot à mot juste après la barre.
    Trois façons d'entrer, alternées (flou → net mot à mot, ligne entière, gris → encre)."""
    n, ent = f["n"], ENTRY.get(f["n"])
    if n in (1, 5):
        return []  # image 0 complète ; plan 05 : la phrase arrive entière avec le plan
    v = n % 3
    tl = []

    def line(cls, at, var):
        if var == 0:
            return f'tl.fromTo(".{cls}", {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.14, stagger: 0.067, ease: "power2.out" }}, {f3(at)});'
        if var == 1:
            return f'tl.fromTo(".{cls}", {{ opacity: 0, filter: "blur(10px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power2.out" }}, {f3(at)});'
        return f'tl.fromTo(".{cls}", {{ opacity: 0, color: "#9fb59a" }}, {{ opacity: 1, color: "#faf8f5", duration: 0.16, stagger: 0.08, ease: "power1.out" }}, {f3(at)});'

    em_at = {19: L + 0.80, 22: L + BAR - 0.05}  # 19 : sur le pop du son ; 22 : « en prépare un autre »
    if ent in MOVING:
        tl.append(line(f"{sid}-t2", em_at.get(n, L - 0.02), v))
    else:
        if f.get("chapter"):
            tl.append(f'tl.fromTo("#{sid}-ch", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.18, ease: "power2.out" }}, {f3(L + 0.02)});')
        tl.append(line(f"{sid}-t1", L + 0.08, v))
        tl.append(line(f"{sid}-t2", em_at.get(n, L + 0.36), 2 if v != 2 else 0))
    return tl


def touch(fg, tl, tid, x, y, press, show=0.2):
    """Le doigt : petit anneau qui se pose, s'enfonce sur le clic (press) et s'efface."""
    fg.append(f'<div class="touch" id="{tid}" style="left:{x - 20:.0f}px; top:{y - 20:.0f}px"></div>')
    tl.append(f'tl.fromTo("#{tid}", {{ opacity: 0, scale: 1.3 }}, {{ opacity: 1, scale: 1, duration: {f3(show - 0.06)}, ease: "power2.out" }}, {f3(press - show)});')
    tl.append(f'tl.to("#{tid}", {{ scale: 0.8, duration: 0.08, ease: "power2.in" }}, {f3(press - 0.04)});')
    tl.append(f'tl.to("#{tid}", {{ opacity: 0, scale: 1, duration: 0.14, ease: "power2.out" }}, {f3(press + 0.08)});')


def swap_tween(iid, prev, at, how):
    if how == "scroll":  # le fil défile : l'ancien écran monte, le suivant arrive par le bas
        return [f'tl.to("#{prev}", {{ y: -{SH}, duration: 0.35, ease: "power3.inOut" }}, {f3(at)});',
                f'tl.fromTo("#{iid}", {{ y: {SH}, opacity: 1 }}, {{ y: 0, opacity: 1, duration: 0.35, ease: "power3.inOut" }}, {f3(at)});']
    if how == "cut":
        return [f'tl.fromTo("#{iid}", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.05, ease: "none" }}, {f3(at - 0.025)});']
    return [f'tl.fromTo("#{iid}", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.16, ease: "power2.out" }}, {f3(at)});']


# --------------------------------------------------------------------------- plans
def phone_scene(f, sid, L, D):
    """L : avance (la barre tombe à t = L dans le plan) ; D : durée totale du plan."""
    n = f["n"]
    ent = ENTRY.get(n)
    seqs = SEQ.get(n) or [[(s, 0, None)] for s in f.get("shots", [])]
    punch = f.get("pos") == "bottom"
    places = PHONES.get(n) or (ONE if len(seqs) == 1 else TWO)
    bg, fg, txt, tl = [], [], [], []

    # Fond.
    if n == 22:  # le globe cuit tourne du Chili au Japon (6 s de vidéo pour 5,975 s de plan)
        bg.append(f'<div class="bgw" id="{sid}-bg"><video id="{sid}-globe" class="clip" src="{GLOBE_VID}" muted playsinline '
                  f'data-start="0" data-duration="{f3(D)}" data-track-index="1"></video></div>')
    elif n not in OVER_FLIGHT or n == 7:
        hidden = ' style="opacity:0"' if n == 7 else ""
        bg.append(f'<div class="bgw" id="{sid}-bg"{hidden}><img id="{sid}-bgi" src="{f["bg"]}" alt="" /></div>')
        tl.append(bg_drift(n, sid, L, D))
        if n == 7:  # la dernière image du vol, en photo exacte, prend le relais quand la vidéo s'arrête
            tl.append(f'tl.set("#{sid}-bg", {{ opacity: 1 }}, {f3(FLIGHT_END - (f["start"] - L))});')
    if f.get("title"):
        bg.append(f'<div class="shade" id="{sid}-sh"></div>')
        if n == 14:  # le plan 13 (sans titre) n'a pas de voile : il se pose sur le raccord
            tl.append(f'tl.fromTo("#{sid}-sh", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3, ease: "power2.out" }}, {f3(L)});')

    # Titre et légende.
    if f.get("title"):
        txt += title_html(f, sid)
        tl += title_tweens(f, sid, L)
    if f.get("cap"):
        txt.append(f'<div class="cap" id="{sid}-cap"><i></i>{E(f["cap"])}</div>')
        cat = {6: L + 1.17, 7: L + BAR + 0.1}.get(n, L + (CAP_AT if n in CAP_SOUND else CAP_EARLY))
        tl.append(f'tl.fromTo("#{sid}-cap", {{ opacity: 0, x: -24 }}, {{ opacity: 1, x: 0, duration: 0.45, ease: "expo.out" }}, {f3(cat)});')

    if n in CARRY_CAP:  # la légende du plan précédent reste posée, puis cède la place
        txt.insert(0, f'<div class="cap" id="{sid}-cap0"><i></i>{E(FB[n - 1]["cap"])}</div>')
        tl.append(f'tl.to("#{sid}-cap0", {{ opacity: 0, filter: "blur(8px)", duration: 0.15, ease: "power2.in" }}, {f3(L + BAR - 0.05)});')

    # Téléphones.
    prev_last = None
    if ent == "stage":
        prev_seq = SEQ.get(n - 1) or [[(s, 0, None)] for s in FB[n - 1].get("shots", [])]
        prev_last = prev_seq[-1][-1][0]
    for j, (seq, (x, y)) in enumerate(zip(seqs, places)):
        pid, cid = f"{sid}-p{j}", f"{sid}-p{j}-cam"
        media, ids = "", []
        if n == 5:
            media += (f'<video id="{sid}-rec" class="clip" src="{REC}" muted playsinline data-start="0" data-duration="{f3(D)}" '
                      f'data-media-start="{REC_START}" data-playback-rate="{REC_RATE}" data-track-index="1"></video>')
        if n == 6:  # le même enregistrement continue, sans saut, jusqu'à l'écran « Je lis ta phrase »
            ms = REC_START + (FB[6]["start"] - L - (FB[5]["start"] - LEAD[5])) * REC_RATE
            media += (f'<video id="{sid}-rec" class="clip" src="{REC}" muted playsinline data-start="0" data-duration="{f3(L + 0.47 + 0.2)}" '
                      f'data-media-start="{ms:.4f}" data-playback-rate="{REC_RATE}" data-track-index="1"></video>')
            ids.append(f"{sid}-rec")
        if n == 12:  # le chrono avance vraiment (vidéo du 17/11)
            media += (f'<video id="{sid}-live" class="clip" src="{LIVE}" muted playsinline data-start="0" data-duration="{f3(D)}" '
                      f'data-media-start="0" data-track-index="1"></video>')
            seq = []
        if prev_last:  # raccord immobile : l'écran du plan précédent, puis le nouveau
            media += f'<img id="{pid}-i0p" src="{prev_last}" alt="" />'
            ids.append(f"{pid}-i0p")
        for k, (src, at, how) in enumerate(seq if n != 5 else []):
            iid = f"{pid}-i{k}"
            style = ' style="opacity:0"' if how else ""
            media += f'<img id="{iid}" src="{src}" alt=""{style} />'
            if how:
                tl += swap_tween(iid, ids[-1] if ids else None, L + at, how)
            ids.append(iid)
            if n == 7 and k == 0:  # les trois refuges sur les temps 2-4 (sous l'écran du jour 2)
                for m, (u, v) in enumerate(W_STEPS):
                    mid = f"{sid}-mk{m}"
                    media += f'<div class="mk" id="{mid}" style="left:{u * SW - 27:.1f}px; top:{v * SH - 27:.1f}px"></div>'
                    tl.append(f'tl.fromTo("#{mid}", {{ opacity: 0, scale: 1.8 }}, {{ opacity: 1, scale: 1, duration: 0.25, ease: "expo.out" }}, {f3(L + (m + 1) * BEAT - 0.03)});')
        phone = f'<div class="phone" id="{pid}" style="left:{x}px; top:{y}px"><div class="screen"><div class="cam" id="{cid}">{media}</div></div></div>'
        if punch:
            px, py = PUNCH_XY
            # La boîte du cadre (overflow hidden) bouge avec le plan : le haut du téléphone, hors
            # champ, ne réapparaît jamais pendant le fouet.
            phone = (f'<div class="frm" style="position:absolute; inset:0; overflow:hidden">'
                     f'<div class="pz" style="left:{px}px; top:{py:.0f}px; transform: scale({PUNCH})">'
                     f'<div class="phone" id="{pid}" style="left:0; top:0"><div class="screen"><div class="cam" id="{cid}">{media}</div></div></div></div></div>')
        fg.append(phone)

        # Arrivée du téléphone.
        if n == 22 and j == 1:  # le Japon monte quand le globe arrive au Japon (vidéo ≈ 3,9 s)
            tl.append(f'tl.fromTo("#{pid}", {{ y: 1100 }}, {{ y: 0, duration: 0.75, ease: "expo.out" }}, {f3(L + 2 * BAR - 0.15)});')
        elif ent == "grow":
            tl.append(f'tl.fromTo("#{pid}", {{ scale: 1.08 }}, {{ scale: 1, duration: 0.6, ease: "expo.out" }}, {f3(0.1)});')
        elif ent == "rise" and not punch:  # (messagerie : le plan monte seul, la liste reste hors champ)
            tl.append(f'tl.fromTo("#{pid}", {{ y: 200 }}, {{ y: 0, duration: 0.75, ease: "expo.out" }}, {f3(0.05 + 0.1 * j)});')
        elif ent == "whip":  # le téléphone traîne derrière le fouet, puis se pose
            tl.append(f'tl.fromTo("#{pid}", {{ x: 200, filter: "blur(6px)" }}, {{ x: 0, filter: "blur(0px)", duration: 0.75, ease: "expo.out" }}, {f3(0.05 + 0.1 * j)});')
        # stage, iris, dip, plan 01 : le téléphone est déjà là, immobile.

    # Le doigt.
    if n == 5:
        touch(fg, tl, f"{sid}-tap", ARROW[0], ARROW[1], L + 1.62)
    elif f.get("tap"):
        tx, ty = f["tap"]
        x, y = places[-1]
        cx, cy = screen_xy(x, y, tx, ty)
        touch(fg, tl, f"{sid}-tap", cx, cy, L + BAR - 0.35)
    if n == 10:
        x, y = places[0]
        for k, (u, v) in enumerate(KIT_TAPS):
            cx, cy = screen_xy(x, y, u, v)
            touch(fg, tl, f"{sid}-tap{k}", cx, cy, L + BAR + k * BEAT + 0.04, show=0.12)
    return bg, fg, txt, tl


def sunrise_scene(f, sid, L, D):
    """Temps fort 2 : la photo seule, plein cadre, une mesure entière ; puis le fil monte et défile."""
    (x, y), = PHONES[16]
    bg = [f'<div class="bgw" id="{sid}-bg"><img id="{sid}-bgi" src="{f["bg"]}" alt="" /></div>']
    media, tl, ids = "", [], []
    for k, (src, at, how) in enumerate(SEQ[16][0]):
        iid = f"{sid}-p0-i{k}"
        media += f'<img id="{iid}" src="{src}" alt=""{" style=\"opacity:0\"" if how else ""} />'
        if how:
            tl += swap_tween(iid, ids[-1], L + at, how)
        ids.append(iid)
    fg = [f'<div class="phone" id="{sid}-p0" style="left:{x}px; top:{y}px"><div class="screen"><div class="cam" id="{sid}-p0-cam">{media}</div></div></div>']
    tl = [f'tl.fromTo("#{sid}-bgi", {{ scale: 1.1 }}, {{ scale: 1.0, duration: {f3(D)}, ease: "power2.out" }}, 0);',
          f'tl.fromTo("#{sid}-p0", {{ y: 1100 }}, {{ y: 0, duration: 0.8, ease: "expo.out" }}, {f3(L + BAR)});'] + tl
    return bg, fg, [], tl


def end_scene(f, sid, L, D):
    bg = ['<div class="bgw" id="e-bg"><img id="e-bgi" src="assets/img/lkdv-bg-landscape.webp" alt="" /></div>',
          '<div class="shade" style="background: rgba(11,31,23,0.55)"></div>']
    fg = ['<img id="e-badge" src="assets/img/lkdv-badge.png" alt="" style="position:absolute; left:300px; top:290px; width:500px; height:500px" />',
          f'<div id="e-name" style="position:absolute; left:880px; top:410px; color:#faf8f5; font-weight:800; font-size:110px; letter-spacing:-0.03em">{words("Le Kit du", "e-n1")} <em style="font-family:\'EB Garamond\', serif; font-weight:500">{words("Voyageur", "e-n2")}</em></div>',
          '<div id="e-tag" style="position:absolute; left:888px; top:560px; color:#dfe8dc; font-weight:700; font-size:34px; letter-spacing:0.14em; text-transform:uppercase">Préparer · Explorer · Partager</div>']
    hit = L + 0.2  # impact du son (film_audio : barre 23 + 0,2 s)
    tl = [f'tl.fromTo("#e-bgi", {{ scale: 1.06 }}, {{ scale: 1.0, duration: {f3(L + 3.0)}, ease: "power2.out" }}, 0);',
          # La boussole tombe et se cale pile sur l'impact (fin d'un ease-in), puis l'aiguille s'amortit.
          f'tl.fromTo("#e-badge", {{ scale: 1.5, opacity: 0, rotation: -28 }}, {{ scale: 1, opacity: 1, duration: {f3(hit - L)}, ease: "power3.in" }}, {f3(L)});',
          f'tl.fromTo("#e-badge", {{ rotation: -28 }}, {{ rotation: 0, duration: 1.4, ease: "elastic.out(1, 0.45)", immediateRender: false }}, {f3(hit)});',
          f'tl.fromTo(".e-n1", {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.14, stagger: 0.08, ease: "power2.out" }}, {f3(L + 2 * BEAT)});',
          f'tl.fromTo(".e-n2", {{ opacity: 0, color: "#9fb59a" }}, {{ opacity: 1, color: "#faf8f5", duration: 0.25, ease: "power1.out" }}, {f3(L + 3 * BEAT)});',
          f'tl.fromTo("#e-tag", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power2.out" }}, {f3(L + 4 * BEAT)});']
    return bg, fg, [], tl


def transitions(n, sid, L, D):
    """Entrée du plan n et sortie vers le plan n+1 (tweens sur #sid-ri / #sid-fg / #sid-txt)."""
    tl, ri_style = [], ""
    ent = ENTRY.get(n)
    if ent == "whip":
        tl.append(f'tl.fromTo("#{sid}-ri", {{ x: 1920, filter: "blur(16px)" }}, {{ x: 0, filter: "blur(0px)", duration: {f3(L + 0.04)}, ease: "power3.inOut" }}, 0);')
    elif ent == "rise":
        tl.append(f'tl.fromTo("#{sid}-ri", {{ y: 1080, filter: "blur(14px)" }}, {{ y: 0, filter: "blur(0px)", duration: {f3(L + 0.04)}, ease: "power3.inOut" }}, 0);')
    elif ent == "grow":  # le rectangle touché (dans le téléphone du plan précédent) devient le cadre
        src, u0, v0, u1, v1, r = GROW_FROM[n]
        px, py = (PHONES.get(src) or ONE)[-1]
        x0, y0 = screen_xy(px, py, u0, v0)
        x1, y1 = screen_xy(px, py, u1, v1)
        tl.append(f'tl.fromTo("#{sid}-ri", {{ clipPath: "inset({y0:.0f}px {W - x1:.0f}px {H - y1:.0f}px {x0:.0f}px round {r}px)" }}, '
                  f'{{ clipPath: "inset(0px 0px 0px 0px round 0px)", duration: 0.45, ease: "power3.inOut" }}, 0);')
        tl.append(f'tl.fromTo(["#{sid}-fg", "#{sid}-txt"], {{ opacity: 0, filter: "blur(10px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.25, ease: "power2.out" }}, 0.28);')
    nxt = ENTRY.get(n + 1)
    if nxt == "whip":
        tl.append(f'tl.to("#{sid}-ri", {{ x: -600, filter: "blur(10px)", duration: 0.3, ease: "power3.in" }}, {f3(D - 0.3)});')
    elif nxt == "rise":
        tl.append(f'tl.to("#{sid}-ri", {{ y: -420, filter: "blur(10px)", duration: 0.3, ease: "power3.in" }}, {f3(D - 0.3)});')
    elif nxt == "grow":  # ce qui entoure l'objet touché se brouille
        tl.append(f'tl.to("#{sid}-ri", {{ filter: "blur(14px)", duration: {f3(LEAD[n + 1])}, ease: "power2.in" }}, {f3(D - LEAD[n + 1])});')
    elif nxt == "stage":  # seul le texte s'en va ; le téléphone reste immobile pour le raccord
        keep = n + 1 in CARRY_CAP
        sel = f'["#{sid}-ch", "#{sid}-ti"]' if keep else f'"#{sid}-txt"'
        tl.append(f'tl.to({sel}, {{ opacity: 0, filter: "blur(8px)", duration: 0.2, ease: "power2.in" }}, {f3(D - 0.2)});')
    elif nxt == "dip":  # trois images qui s'assombrissent avant la coupe franche
        tl.append(f'tl.to("#{sid}-dip", {{ opacity: 1, duration: 0.1, ease: "none" }}, {f3(D - 0.1)});')
    elif nxt == "iris":  # un seul trou, depuis la flèche touchée ; dessous, le même téléphone et le vol
        ri_style = ("--iris: 0px; -webkit-mask-image: radial-gradient(circle at {x:.0f}px {y:.0f}px, transparent var(--iris), #000 var(--iris)); "
                    "mask-image: radial-gradient(circle at {x:.0f}px {y:.0f}px, transparent var(--iris), #000 var(--iris));").format(x=ARROW[0], y=ARROW[1])
        tl.append(f'tl.fromTo("#{sid}-ri", {{ "--iris": "0px" }}, {{ "--iris": "1900px", duration: {f3(D - (L + 1.62))}, ease: "power2.in" }}, {f3(L + 1.62)});')
    return tl, ri_style


def scene_html(f):
    sid = f"s{f['n']:02d}"
    L = LEAD[f["n"]]
    D = L + (f["end"] - f["start"])
    if f["name"] == "Le lever de soleil":
        bg, fg, txt, tl = sunrise_scene(f, sid, L, D)
    elif f["kind"] == "still":
        bg, fg, txt, tl = end_scene(f, sid, L, D)
    else:
        bg, fg, txt, tl = phone_scene(f, sid, L, D)
    tt, ri_style = transitions(f["n"], sid, L, D)
    dip = f'\n      <div class="dip" id="{sid}-dip"></div>' if ENTRY.get(f["n"] + 1) == "dip" else ""
    tls = "\n      ".join(tl + tt)
    nl = "\n"
    return f"""<template>
  <style>{CSS}  </style>
  <div id="root" data-composition-id="{sid}" data-width="1920" data-height="1080" data-layout-allow-overflow data-layout-allow-overlap>
    <div class="ri" id="{sid}-ri"{f' style="{ri_style}"' if ri_style else ""}>
      {nl.join("      " + b for b in bg).lstrip()}
      <div class="txt" id="{sid}-txt">
        {nl.join("        " + x for x in txt).lstrip()}
      </div>
      <div class="fg" id="{sid}-fg">
        {nl.join("        " + x for x in fg).lstrip()}
      </div>{dip}
    </div>
  </div>
  <script>
    (function () {{
      const tl = gsap.timeline({{ paused: true }});
      {tls}
      window.__timelines["{sid}"] = tl;
    }})();
  </script>
</template>
"""


def main():
    os.makedirs(os.path.join(ROOT, "compositions", "film"), exist_ok=True)
    hosts = []
    zs = {}
    for i, f in enumerate(FRAMES):
        sid = f"s{f['n']:02d}"
        with open(os.path.join(ROOT, "compositions", "film", f"{sid}.html"), "w") as fh:
            fh.write(scene_html(f))
        L = LEAD[f["n"]]
        start = round(f["start"] - L, 4)
        dur = round(f["end"] - f["start"] + L, 4)
        # Ordre d'empilement : le plan entrant passe au-dessus du sortant ; le plan 05 (iris)
        # passe au-dessus du 06 et du vol, qu'il découvre par son trou.
        z = 100 if f["n"] == 5 else 10 + 2 * i
        zs[f["n"]] = z
        hosts.append(f'      <div id="{sid}" class="clip" data-composition-id="{sid}" data-composition-src="compositions/film/{sid}.html" '
                     f'data-start="{start}" data-duration="{dur}" data-track-index="{1 + i % 2}" data-track-kind="graphics" '
                     f'data-width="1920" data-height="1080" style="z-index: {z}"></div>')
    flight_start = FB[6]["start"] - LEAD[6]
    flight_dur = FB[7]["end"] - flight_start
    # Le vol (5 s) démarre avec l'iris, à vitesse réelle ; le plan 07 prend ensuite le relais avec
    # la photo exacte de la fin (FLIGHT_END).
    flight = (f'      <video id="flight" class="clip" src="assets/map/w-patagonie.mp4" muted playsinline data-start="{flight_start:.3f}" '
              f'data-duration="{flight_dur:.3f}" data-track-index="5" style="position:absolute; inset:0; width:1920px; height:1080px; object-fit:cover; z-index: {zs[6] - 1}"></video>')
    index = f"""<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>LKDV — Le W (film 60 s)</title>
    <script src="assets/lib/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #0b1f17; }}
      #root {{ position: relative; width: 1920px; height: 1080px; overflow: hidden; background: #0b1f17; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="60" data-width="1920" data-height="1080">
{flight}
{chr(10).join(hosts)}
{chr(10).join(audio_clips(FRAMES, AUDIO_LEAD))}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
    with open(os.path.join(ROOT, "index.html"), "w") as fh:
        fh.write(index)
    print("ok", len(FRAMES), "plans ; flèche du Compas à", tuple(round(c) for c in ARROW))


if __name__ == "__main__":
    main()
