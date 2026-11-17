#!/usr/bin/env python3
"""Génère le film animé (index.html + compositions/film/sNN.html) depuis boards/frames.py.

Écrans réels uniquement (assets/app). 128 BPM : 1 temps = 0,46875 s, 1 mesure = 1,875 s.
Chaque temps se calcule depuis son indice (k * BEAT), jamais par additions d'arrondis.

Montage (passe « mouvement ») :
- chaque plan est construit en trois couches : fond (bg), voile (shade), premier plan (fg) ;
- une coupe n'est jamais un fond nu : le plan entrant démarre avant la barre (LEAD) et couvre
  le sortant, qui tient son fond jusqu'à la barre ;
- entrées variées, chacune causée par l'image : fouet latéral (whip), montée par le bas (rise),
  l'écran touché grandit (grow, 02 → 03), iris depuis la flèche du Compas (05 → 06),
  fondu flou sur un même fond (swap, 06 → 07 → 08 sur le vol satellite), fondu flou sur place
  (blur), creux sombre de trois images avant le lever de soleil (dip, 15 → 16) ;
- dans un plan, l'écran vit : lent défilement de la capture (recadrage dans le téléphone),
  poussée vers le point touché, passages d'une capture à la suivante ;
- le plan 05 montre le vrai enregistrement du Compas (frappe de la phrase, accélérée) ;
- les titres, une fois posés, ne bougent plus.

Le son (boards/film_audio.py, autre agent) est calé sur les barres : on lui passe AUDIO_LEAD,
le seul décalage qu'il connaît (plan 06 : 0,35 s), et les gestes visibles tombent aux mêmes
instants (tap 02 à barre + 1,525 s, clic 05 à barre + 1,62 s, écrans 06 à + 0,47 / + 1,17 s,
clics 10 sur les quatre temps de la mesure 2, tap 17 à barre + 1,525 s, badge 23 à + 0,2 s)."""
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
SW, SH = 412, 908  # écran du téléphone

# --------------------------------------------------------------------------- montage
# Entrée de chaque plan (la sortie du plan précédent en découle).
ENTRY = {2: "whip", 3: "grow", 4: "whip", 5: "rise", 6: "iris", 7: "swap", 8: "swap", 9: "whip",
         10: "blur", 11: "whip", 12: "rise", 13: "whip", 14: "whip", 15: "whip", 16: "dip",
         17: "whip", 18: "whip", 19: "rise", 20: "whip", 21: "whip", 22: "blur", 23: "blur"}
LEADS = {"whip": 0.3, "rise": 0.3, "grow": 0.35, "iris": 0.35, "swap": 0.0, "blur": 0.4, "dip": 0.0, None: 0.0}
LEAD = {n: LEADS[ENTRY.get(n)] for n in range(1, len(FRAMES) + 1)}
AUDIO_LEAD = {6: LEAD[6]}  # le son ne connaît que l'avance de l'iris (inchangée : 0,35 s)

# Séquences d'écrans réels dans un même téléphone : [(image, temps depuis la barre)].
SEQ = {
    1: [[(A + "feed-1.jpg", 0), (A + "feed-3.jpg", 1.9)], [(A + "feed-2.jpg", 0), (A + "feed-4.jpg", 2.35)]],
    6: [[(A + "compas-prep.jpg", 0.47), (A + "compas-pret.jpg", 1.17)]],  # pops du son aux mêmes instants
    10: [[(A + "kit-studio-modules.jpg", 0)], [(A + "kit-studio-corps.jpg", 0), (A + "kit-studio-coloris.jpg", BAR + 3 * BEAT)]],
    22: [[(A + "explorer-chili.jpg", 0)], [(A + "explorer-japon.jpg", 0)]],
}
OVER_FLIGHT = {6, 7}  # plans posés sur le vol satellite (fond transparent)
NO_CAM = {5, 6, 10}   # écrans animés autrement (vidéo, iris, gros plans sur les temps)

# Plan 05 : vrai enregistrement. compas-creation-w-804.mp4 = 13 → 23 s de compas-creation-w.mp4,
# 30 i/s, sans autre retouche que ceci : la source alterne des images pleines (804 × 1748) et des
# images où l'écran n'occupe que le quart haut-gauche (402 × 874, reste gris) ; celles-ci sont
# agrandies ×2 pour remplir le cadre (143 images sur 300). Frappe de la phrase : 2,75 → 4,5 s ;
# clic : ~7 s ; « Je crée ton aventure… » : 7,5 s et après.
REC = "assets/app/video/compas-creation-w-804.mp4"
REC_RATE = 1.5
REC_START = 2.2
REC_AFTER_CLICK = 8.0
# Flèche « > » du Compas dans l'enregistrement : (702, 1155) sur 804 × 1748 ; écran 412 × 908
# en object-fit: cover → échelle 908/1748, décalage horizontal (412 - 804*s)/2.
_s = SH / 1748
ARROW = (round(16 + 702 * _s + (SW - 804 * _s) / 2), round(16 + 1155 * _s))  # dans le téléphone

CSS = """
    #root { position: absolute; inset: 0; overflow: hidden; font-family: "Inter", sans-serif; }
    .ri { position: absolute; inset: 0; }
    .fg { position: absolute; inset: 0; }
    .bgw { position: absolute; inset: 0; overflow: hidden; }
    .bgw img { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; object-fit: cover; }
    .shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(11,31,23,0.80) 0%, rgba(11,31,23,0.50) 48%, rgba(11,31,23,0.14) 100%); }
    .dip { position: absolute; inset: 0; background: rgba(11,31,23,0.5); opacity: 0; }
    .chapter { position: absolute; left: 124px; top: 232px; color: #dfe8dc; font-weight: 700; font-size: 28px; letter-spacing: 0.14em; text-transform: uppercase; }
    .title { position: absolute; left: 120px; top: 280px; width: 820px; color: #faf8f5; font-weight: 800; font-size: 100px; line-height: 1.02; letter-spacing: -0.03em; }
    .title em { font-family: "EB Garamond", serif; font-style: italic; font-weight: 500; }
    .w { display: inline-block; }
    .cap { position: absolute; left: 124px; top: 606px; display: flex; align-items: center; gap: 16px; padding: 16px 28px; border-radius: 999px; background: rgba(250,248,245,0.94); color: #17402c; font-size: 32px; font-weight: 700; box-shadow: 0 16px 40px rgba(11,31,23,0.25); }
    .cap i { width: 14px; height: 14px; border-radius: 50%; background: #5b7f55; }
    .phone { position: absolute; width: 444px; height: 940px; border-radius: 70px; background: #0b1f17; padding: 16px; box-shadow: 0 40px 90px rgba(11,31,23,0.55); }
    .screen { position: relative; width: 412px; height: 908px; border-radius: 56px; overflow: hidden; background: #faf8f5; }
    .cam { position: absolute; left: 0; top: 0; width: 412px; height: 908px; }
    .screen img, .screen video { position: absolute; left: 0; top: 0; width: 412px; height: 908px; object-fit: cover; object-position: top; }
    .tap { position: absolute; width: 84px; height: 84px; border-radius: 50%; background: rgba(250,248,245,0.6); border: 4px solid #faf8f5; box-shadow: 0 8px 24px rgba(11,31,23,0.35); opacity: 0; }
"""


def f3(x):
    return f"{x:.3f}"


def words(text, cls):
    return " ".join(f'<span class="w {cls}">{E(t)}</span>' for t in text.split())


def bg_layer(sid, src, dur, mode="drift", xform=None):
    """Fond plein cadre. drift : lente dérive qui se pose ; push : poussée depuis l'image exacte
    (raccord avec le vol satellite) ; xform : cadrage fixe (scale, x0, x1)."""
    fill = ' style="background: rgb(2,3,8)"' if xform else ""  # le noir exact des bords de la photo
    out = f'<div class="bgw" id="{sid}-bg"{fill}><img id="{sid}-bgi" src="{src}" alt="" /></div>'
    if xform:
        s, x0, x1, y = xform
        tl = f'tl.fromTo("#{sid}-bgi", {{ scale: {s}, x: {x0}, y: {y} }}, {{ scale: {s}, x: {x1}, y: {y}, duration: {f3(dur)}, ease: "none" }}, 0);'
    elif mode == "push":
        tl = f'tl.fromTo("#{sid}-bgi", {{ scale: 1.0 }}, {{ scale: 1.05, duration: {f3(dur)}, ease: "none" }}, 0);'
    else:
        tl = f'tl.fromTo("#{sid}-bgi", {{ x: -30, scale: 1.06 }}, {{ x: 0, scale: 1.0, duration: {f3(dur)}, ease: "none" }}, 0);'
    return out, tl


def title_block(f, sid, t0, n, line2_at=None):
    out, tl = [], []
    out.append(f'<div class="chapter" id="{sid}-ch">{E(f.get("chapter", ""))}</div>')
    out.append(f'<div class="title" id="{sid}-ti">{words(f["title"], sid + "-t1")}<br /><em>{words(f["em"], sid + "-t2")}</em></div>')
    tl.append(f'tl.fromTo("#{sid}-ch", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.18, ease: "power2.out" }}, {f3(t0)});')
    variant = n % 3
    if variant == 0:  # mot par mot, flou → net
        tl.append(f'tl.fromTo(".{sid}-t1", {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.14, stagger: 0.067, ease: "power2.out" }}, {f3(t0 + 0.1)});')
    elif variant == 1:  # la ligne entière sort du flou
        tl.append(f'tl.fromTo(".{sid}-t1", {{ opacity: 0, filter: "blur(10px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power2.out" }}, {f3(t0 + 0.1)});')
    else:  # mot par mot, du gris clair à l'encre
        tl.append(f'tl.fromTo(".{sid}-t1", {{ opacity: 0, color: "#9fb59a" }}, {{ opacity: 1, color: "#faf8f5", duration: 0.16, stagger: 0.08, ease: "power1.out" }}, {f3(t0 + 0.1)});')
    at2 = t0 + 0.42 if line2_at is None else line2_at
    tl.append(f'tl.fromTo(".{sid}-t2", {{ opacity: 0, color: "#9fb59a" }}, {{ opacity: 1, color: "#faf8f5", duration: 0.2, stagger: 0.09, ease: "power1.out" }}, {f3(at2)});')
    return out, tl


def cam_tweens(n, cid, pos, start, dur, tap=None):
    """Vie d'un écran fixe : la capture défile lentement dans le téléphone."""
    if tap:  # poussée vers le point touché : le point reste immobile, le tap reste juste
        tx, ty = tap
        return [f'tl.fromTo("#{cid}", {{ scale: 1.0, transformOrigin: "{tx * 100:.1f}% {ty * 100:.1f}%" }}, {{ scale: 1.07, duration: {f3(dur)}, ease: "sine.inOut" }}, {f3(start)});']
    if pos == "bottom":  # on se rapproche du bas de la conversation (le haut de la liste sort du cadre)
        return [f'tl.fromTo("#{cid}", {{ scale: 1.15, x: -31, y: -136, transformOrigin: "0% 0%" }}, {{ scale: 1.3, x: -62, y: -272, duration: {f3(dur)}, ease: "sine.inOut" }}, {f3(start)});']
    return [f'tl.fromTo("#{cid}", {{ scale: 1.06, x: -12, y: 0, transformOrigin: "0% 0%" }}, {{ y: -54, duration: {f3(dur)}, ease: "sine.inOut" }}, {f3(start)});']


def phone_scene(f, sid, L, D):
    """L : avance (la barre tombe à t = L dans le plan) ; D : durée totale du plan."""
    n = f["n"]
    ent = ENTRY.get(n)
    seqs = SEQ.get(n) or [[(s, 0)] for s in f.get("shots", [])]
    pos = "bottom" if f.get("pos") == "bottom" else "top"
    if len(seqs) == 1:
        xs, ys = [1190], [70]
    else:
        xs, ys = [980, 1430], [110, 40]
    bg, fg, tl = [], [], []

    # Fond.
    if n not in OVER_FLIGHT:
        mode = "push" if ent == "swap" else "drift"
        xform = (0.9, -470, -500, 252) if n == 22 else None  # le globe, sous le titre, à gauche des téléphones
        o, t = bg_layer(sid, f["bg"], D, mode, xform)
        bg.append(o)
        tl.append(t)
    if n == 7:  # la dernière image du vol, en photo exacte, prend le relais quand la vidéo s'arrête
        bg.append(f'<div class="bgw" id="{sid}-bg" style="opacity:0"><img src="{f["bg"]}" alt="" /></div>')
        tl.append(f'tl.set("#{sid}-bg", {{ opacity: 1 }}, {f3(10.9 + 4.9 - (f["start"] - L))});')
    if f.get("title"):
        bg.append('<div class="shade"></div>')

    # Titre.
    if f.get("title"):
        if n == 1:  # image 0 complète : titre déjà posé
            fg.append(f'<div class="chapter" id="{sid}-ch">{E(f["chapter"])}</div>')
            fg.append(f'<div class="title" id="{sid}-ti">{words(f["title"], sid + "-t1")}<br /><em>{words(f["em"], sid + "-t2")}</em></div>')
        else:
            line2 = L + BAR - 0.05 if n == 22 else None
            o, t = title_block(f, sid, L + 0.08, n, line2)
            fg += o
            tl += t

    # Légende.
    if f.get("cap"):
        fg.append(f'<div class="cap" id="{sid}-cap"><i></i>{E(f["cap"])}</div>')
        cat = L + 1.24 if n == 7 else L + 0.3
        tl.append(f'tl.fromTo("#{sid}-cap", {{ opacity: 0, x: -24 }}, {{ opacity: 1, x: 0, duration: 0.45, ease: "expo.out" }}, {f3(cat)});')

    # Téléphones.
    for j, (seq, x, y) in enumerate(zip(seqs, xs, ys)):
        pid, cid = f"{sid}-p{j}", f"{sid}-p{j}-cam"
        media = ""
        if n == 5:
            media += (f'<video id="{sid}-rec" class="clip" src="{REC}" muted playsinline data-start="0" data-duration="{f3(D)}" '
                      f'data-media-start="{REC_START}" data-playback-rate="{REC_RATE}" data-track-index="1" style="object-position: center top"></video>')
        if n == 6:  # l'enregistrement continue après le clic : « Je crée ton aventure… »
            media += (f'<video id="{sid}-rec" class="clip" src="{REC}" muted playsinline data-start="0" data-duration="{f3(L + 0.6)}" '
                      f'data-media-start="{REC_AFTER_CLICK}" data-track-index="1" style="object-position: center top"></video>')
        for k, (src, at) in enumerate(seq if n != 5 else []):
            iid = f"{pid}-i{k}"
            hidden = n == 6 or k > 0
            media += f'<img id="{iid}" src="{src}" alt="" style="object-position:{pos}{"; opacity:0" if hidden else ""}" />'
            if hidden:
                tl.append(f'tl.fromTo("#{iid}", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.16, ease: "power2.out" }}, {f3(L + at)});')
        fg.append(f'<div class="phone" id="{pid}" style="left:{x}px; top:{y}px"><div class="screen"><div class="cam" id="{cid}">{media}</div></div></div>')

        # Arrivée du téléphone.
        if n == 1 or ent == "iris":
            pass  # déjà là (image 0 ; ou même téléphone qu'au plan 05)
        elif n == 7:
            at = L + (0.25 if j == 0 else 2.1)
            tl.append(f'tl.fromTo("#{pid}", {{ opacity: 0, filter: "blur(12px)", scale: 1.04 }}, {{ opacity: 1, filter: "blur(0px)", scale: 1, duration: 0.35, ease: "power2.out" }}, {f3(at)});')
        elif n == 10:
            if j == 1:
                tl.append(f'tl.fromTo("#{pid}", {{ x: 320, opacity: 0, filter: "blur(8px)" }}, {{ x: 0, opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }}, {f3(L + 2 * BEAT - 0.12)});')
        elif n == 22:
            if j == 1:
                tl.append(f'tl.fromTo("#{pid}", {{ y: 1100 }}, {{ y: 0, duration: 0.75, ease: "expo.out" }}, {f3(L + BAR - 0.15)});')
        elif ent == "grow":
            tl.append(f'tl.fromTo("#{pid}", {{ scale: 1.14 }}, {{ scale: 1, duration: 0.6, ease: "expo.out" }}, {f3(L - 0.1)});')
        elif ent == "rise":
            tl.append(f'tl.fromTo("#{pid}", {{ y: 260 }}, {{ y: 0, duration: 0.75, ease: "expo.out" }}, {f3(0.05 + 0.1 * j)});')
        elif ent == "swap":
            tl.append(f'tl.fromTo("#{pid}", {{ opacity: 0, filter: "blur(12px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.3, ease: "power2.out" }}, {f3(L + 0.05 + 0.12 * j)});')
        else:  # whip : le téléphone traîne derrière le fouet, puis se pose
            tl.append(f'tl.fromTo("#{pid}", {{ x: 260, filter: "blur(6px)" }}, {{ x: 0, filter: "blur(0px)", duration: 0.75, ease: "expo.out" }}, {f3(0.05 + 0.1 * j)});')

        # Vie de l'écran.
        if n == 10 and j == 0:
            # Mesure 2, sur les quatre temps : gros plan sur les modules montés, un module par temps.
            b0 = L + BAR
            tl.append(f'tl.fromTo("#{cid}", {{ scale: 1, x: 0, y: 0, transformOrigin: "0% 0%" }}, {{ scale: 2, x: 0, y: -900, duration: 0.42, ease: "expo.out" }}, {f3(b0)});')
            tl.append(f'tl.to("#{cid}", {{ x: -206, duration: 0.32, ease: "power3.inOut" }}, {f3(b0 + 1 * BEAT - 0.05)});')
            tl.append(f'tl.to("#{cid}", {{ x: -412, duration: 0.32, ease: "power3.inOut" }}, {f3(b0 + 2 * BEAT - 0.05)});')
        elif n == 10 and j == 1:
            tl.append(f'tl.fromTo("#{cid}", {{ scale: 1.06, x: -12, y: 0, transformOrigin: "0% 0%" }}, {{ y: -54, duration: {f3(D - L)}, ease: "sine.inOut" }}, {f3(L)});')
        elif n not in NO_CAM:
            start = L + 2.1 if (n == 7 and j == 1) else 0
            tl += cam_tweens(n, cid, pos, start, D - start, f.get("tap") if j == len(seqs) - 1 else None)

        # Le pouce.
        if (f.get("tap") or n == 5) and j == len(seqs) - 1:
            if n == 5:
                cx, cy = x + ARROW[0], y + ARROW[1]
                at = L + 1.42
            else:
                tx, ty = f["tap"]
                cx, cy = x + 16 + round(SW * tx), y + 16 + round(SH * ty)
                at = L + BAR - 0.55
            tid = f"{sid}-tap"
            fg.append(f'<div class="tap" id="{tid}" style="left:{cx - 42}px; top:{cy - 42}px"></div>')
            tl.append(f'tl.fromTo("#{tid}", {{ opacity: 0, scale: 1.25 }}, {{ opacity: 1, scale: 1, duration: 0.18, ease: "power2.out" }}, {f3(at)});')
            tl.append(f'tl.to("#{tid}", {{ scale: 0.82, duration: 0.09, ease: "power2.in" }}, {f3(at + 0.2)});')
            tl.append(f'tl.to("#{tid}", {{ opacity: 0, scale: 1, duration: 0.12, ease: "power2.out" }}, {f3(at + 0.3)});')
    return bg, fg, tl


def sunrise_scene(f, sid, L, D):
    """Temps fort 2 : la photo seule, plein cadre, une mesure entière ; puis le téléphone monte."""
    bg = [f'<div class="bgw" id="{sid}-bg"><img id="{sid}-bgi" src="{f["bg"]}" alt="" /></div>']
    fg = [f'<div class="phone" id="{sid}-p0" style="left:1190px; top:70px"><div class="screen"><div class="cam" id="{sid}-p0-cam"><img src="{A}feed-1.jpg" alt="" /></div></div></div>',
          f'<div class="cap" id="{sid}-cap" style="top:860px"><i></i>{E(f["cap"])}</div>']
    tl = [f'tl.fromTo("#{sid}-bgi", {{ scale: 1.1 }}, {{ scale: 1.0, duration: {f3(D)}, ease: "power2.out" }}, 0);',
          f'tl.fromTo("#{sid}-p0", {{ y: 1100 }}, {{ y: 0, duration: 0.8, ease: "expo.out" }}, {f3(L + BAR)});',
          f'tl.fromTo("#{sid}-p0-cam", {{ scale: 1.06, x: -12, y: 0, transformOrigin: "0% 0%" }}, {{ y: -54, duration: {f3(D - L - BAR - 0.3)}, ease: "sine.inOut" }}, {f3(L + BAR + 0.3)});',
          f'tl.fromTo("#{sid}-cap", {{ opacity: 0, x: -24 }}, {{ opacity: 1, x: 0, duration: 0.45, ease: "expo.out" }}, {f3(L + BAR + 2 * BEAT)});']
    return bg, fg, tl


def end_scene(f, sid, L, D):
    bg = ['<div class="bgw" id="e-bg"><img id="e-bgi" src="assets/img/lkdv-bg-landscape.webp" alt="" /></div>',
          '<div class="shade" style="background: rgba(11,31,23,0.55)"></div>']
    fg = ['<img id="e-badge" src="assets/img/lkdv-badge.png" alt="" style="position:absolute; left:300px; top:290px; width:500px; height:500px" />',
          f'<div id="e-name" style="position:absolute; left:880px; top:400px; color:#faf8f5; font-weight:800; font-size:110px; letter-spacing:-0.03em">{words("Le Kit du", "e-n1")} <em style="font-family:\'EB Garamond\', serif; font-weight:500">{words("Voyageur", "e-n2")}</em></div>',
          '<div id="e-tag" style="position:absolute; left:888px; top:545px; color:#dfe8dc; font-weight:700; font-size:34px; letter-spacing:0.14em; text-transform:uppercase">Préparer · Explorer · Partager</div>',
          '<div class="cap" id="e-url" style="left:888px; top:640px">lekitduvoyageur.fr</div>']
    # Tout est posé avant 58 s (le plan commence à 54,375 s) : dernier mouvement fini à L + 3,0 s.
    tl = [f'tl.fromTo("#e-bgi", {{ scale: 1.06 }}, {{ scale: 1.0, duration: {f3(L + 3.0)}, ease: "power2.out" }}, 0);',
          # La boussole se cale : arrivée nette (impact du son à barre + 0,2 s), puis l'aiguille amortie.
          f'tl.fromTo("#e-badge", {{ scale: 0.72, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.45, ease: "expo.out" }}, {f3(L - 0.25)});',
          f'tl.fromTo("#e-badge", {{ rotation: -32 }}, {{ rotation: 0, duration: 1.5, ease: "elastic.out(1, 0.42)" }}, {f3(L - 0.25)});',
          f'tl.fromTo(".e-n1", {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.14, stagger: 0.08, ease: "power2.out" }}, {f3(L + 4 * BEAT * 0.5)});',
          f'tl.fromTo(".e-n2", {{ opacity: 0, color: "#9fb59a" }}, {{ opacity: 1, color: "#faf8f5", duration: 0.25, ease: "power1.out" }}, {f3(L + 3 * BEAT)});',
          f'tl.fromTo("#e-tag", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power2.out" }}, {f3(L + 4 * BEAT)});',
          f'tl.fromTo("#e-url", {{ opacity: 0, x: -24 }}, {{ opacity: 1, x: 0, duration: 0.55, ease: "expo.out" }}, {f3(L + 5 * BEAT)});']
    return bg, fg, tl


def transitions(n, sid, L, D):
    """Entrée du plan n et sortie vers le plan n+1 (tweens sur #sid-ri / #sid-fg)."""
    tl, ri_style = [], ""
    ent = ENTRY.get(n)
    if ent == "whip":
        tl.append(f'tl.fromTo("#{sid}-ri", {{ x: 1920, filter: "blur(16px)" }}, {{ x: 0, filter: "blur(0px)", duration: {f3(L + 0.04)}, ease: "power3.inOut" }}, 0);')
    elif ent == "rise":
        tl.append(f'tl.fromTo("#{sid}-ri", {{ y: 1080, filter: "blur(14px)" }}, {{ y: 0, filter: "blur(0px)", duration: {f3(L + 0.04)}, ease: "power3.inOut" }}, 0);')
    elif ent == "grow":  # l'écran touché au plan 02 (x 1206-1618, y 86-994) grandit jusqu'au cadre
        tl.append(f'tl.fromTo("#{sid}-ri", {{ clipPath: "inset(86px 302px 86px 1206px round 56px)" }}, {{ clipPath: "inset(0px 0px 0px 0px round 0px)", duration: 0.45, ease: "power3.inOut" }}, 0);')
    elif ent == "blur":
        tl.append(f'tl.fromTo("#{sid}-ri", {{ opacity: 0, filter: "blur(20px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: {f3(L)}, ease: "power2.out" }}, 0);')
    nxt = ENTRY.get(n + 1)
    if nxt == "whip":
        tl.append(f'tl.to("#{sid}-ri", {{ x: -600, filter: "blur(10px)", duration: 0.3, ease: "power3.in" }}, {f3(D - 0.3)});')
    elif nxt == "rise":
        tl.append(f'tl.to("#{sid}-ri", {{ y: -420, filter: "blur(10px)", duration: 0.3, ease: "power3.in" }}, {f3(D - 0.3)});')
    elif nxt == "swap":
        tl.append(f'tl.to("#{sid}-fg", {{ opacity: 0, filter: "blur(8px)", duration: 0.2, ease: "power2.in" }}, {f3(D - 0.2)});')
    elif nxt == "blur":
        tl.append(f'tl.to("#{sid}-ri", {{ filter: "blur(10px)", duration: 0.4, ease: "power1.in" }}, {f3(D - 0.4)});')
    elif nxt == "dip":  # trois images qui s'assombrissent avant la coupe franche
        tl.append(f'tl.to("#{sid}-dip", {{ opacity: 1, duration: 0.1, ease: "none" }}, {f3(D - 0.1)});')
    elif nxt == "iris":  # un trou s'ouvre depuis la flèche touchée ; le plan 06 et le vol sont dessous
        ri_style = ("--iris: 0px; -webkit-mask-image: radial-gradient(circle at {x}px {y}px, transparent var(--iris), #000 var(--iris)); "
                    "mask-image: radial-gradient(circle at {x}px {y}px, transparent var(--iris), #000 var(--iris));").format(x=1190 + ARROW[0], y=70 + ARROW[1])
        tl.append(f'tl.fromTo("#{sid}-ri", {{ "--iris": "0px" }}, {{ "--iris": "1800px", duration: {f3(D - (L + 1.62))}, ease: "power2.in" }}, {f3(L + 1.62)});')
    return tl, ri_style


def scene_html(f):
    sid = f"s{f['n']:02d}"
    L = LEAD[f["n"]]
    D = L + (f["end"] - f["start"])
    if f["name"] == "Le lever de soleil":
        bg, fg, tl = sunrise_scene(f, sid, L, D)
    elif f["kind"] == "still":
        bg, fg, tl = end_scene(f, sid, L, D)
    else:
        bg, fg, tl = phone_scene(f, sid, L, D)
    tt, ri_style = transitions(f["n"], sid, L, D)
    dip = f'\n      <div class="dip" id="{sid}-dip"></div>' if ENTRY.get(f["n"] + 1) == "dip" else ""
    tls = "\n      ".join(tl + tt)
    return f"""<template>
  <style>{CSS}  </style>
  <div id="root" data-composition-id="{sid}" data-width="1920" data-height="1080" data-layout-allow-overflow data-layout-allow-overlap>
    <div class="ri" id="{sid}-ri"{f' style="{ri_style}"' if ri_style else ""}>
      {chr(10).join("      " + b for b in bg).lstrip()}
      <div class="fg" id="{sid}-fg">
        {chr(10).join("        " + x for x in fg).lstrip()}
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
    s6 = next(f for f in FRAMES if f["n"] == 6)
    s7 = next(f for f in FRAMES if f["n"] == 7)
    flight_start = s6["start"] - LEAD[6]
    flight_dur = s7["end"] - flight_start
    # Le vol (5 s) démarre avec l'iris, à vitesse réelle : il se pose (2,5 s de source) à 13,4 s,
    # quand « Le W » arrive ; le plan 07 prend ensuite le relais avec la photo exacte de la fin.
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
    print("ok", len(FRAMES), "plans ; flèche du Compas à", (1190 + ARROW[0], 70 + ARROW[1]))


if __name__ == "__main__":
    main()
