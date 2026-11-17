#!/usr/bin/env python3
"""Film « Le W » v7 — un film, pas un diaporama (SPEC-V7.md). Génère index.html et
compositions/film/sNN.html depuis boards/frames.py (grille, durées et texte de référence).

Principe : le monde d'abord, l'app dedans. Vraies vidéos (assets/footage, vol satellite, globe),
vraie 3D (sous-compositions kit3dTaille / kit3dCouleur, écrites par un autre agent), vrais écrans
(assets/app) et éléments d'interface réels découpés au pixel près (assets/cut, boards/make_cuts.py).

Mise en scène (une idée par plan, voir PLANS plus bas) et transitions causées :
  plongée  01→02 : la caméra avance dans le téléphone sorti du paysage (même composition s01) ;
  grow     02→03 : la carte touchée devient le plan ; 21→22 : la carte de l'empreinte devient le globe ;
  fouet    03→04, 11→12, 14→15, 16→17, 18→19 (horizontal) ;
  montée   04→05, 07→08, 10→11, 17→18, 20→21 (vertical, le plan entrant monte) ;
  iris     05→06 : depuis la flèche touchée, sur le vol satellite ;
  porté    06→07 : le même téléphone glisse au bord ; 13→14 : la story se range dans la grille ;
  marée    08→09 : la couleur monte depuis l'anneau du sac ;
  retrait  09→10, 19→20 : le plan s'arrache et découvre la 3D qui tourne déjà dessous ;
  noir     12→13, 15→16, 22→23 : trois images qui s'assombrissent, coupe franche.
Jamais de fondu enchaîné entre deux mondes, jamais de fond nu : le plan entrant recouvre le
sortant, ou le sortant s'arrache d'un plan déjà présent dessous.

Le son (boards/film_audio.py, non modifié) : audio_clips(FRAMES, AUDIO_LEAD), AUDIO_LEAD = {6: 0,35}.
`python3 boards/build_film.py --events` imprime tous les instants visibles pour le monteur son."""
import html
import json
import os
import sys
import time

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from frames import FRAMES, BAR  # noqa: E402

for _try in range(10):  # film_audio.py peut être en cours d'écriture par le monteur son
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
C = "assets/cut/"
W, H = 1920, 1080
SW, SH, PAD = 412, 896, 16          # écran = capture 1206 × 2622 à la largeur exacte
PW, PH = SW + 2 * PAD, SH + 2 * PAD  # boîtier 444 × 928
FB = {f["n"]: f for f in FRAMES}
EVENTS = []
AUDIO_LEAD = {6: 0.35}
CAP_AT = 0.35
PERSP = 1800

FOREST, SAGE, STONE, INK = "#17402c", "#5b7f55", "#faf8f5", "#0b1f17"


def bar(n):
    return FB[n]["start"]


def ev(t, n, what):
    EVENTS.append((round(t, 3), n, what))


_SIZES = {}


def size_of(src):
    if src not in _SIZES:
        with Image.open(os.path.join(ROOT, src)) as im:
            _SIZES[src] = im.size
    return _SIZES[src]


def js(v):
    if isinstance(v, dict):
        return "{ " + ", ".join(f"{k if k.isidentifier() else json.dumps(k)}: {js(x)}" for k, x in v.items()) + " }"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return f"{v:.4f}".rstrip("0").rstrip(".") if isinstance(v, float) else str(v)
    if isinstance(v, (list, tuple)):
        return "[" + ", ".join(js(x) for x in v) + "]"
    return json.dumps(v, ensure_ascii=False)


CSS = """
    #root { position: absolute; inset: 0; overflow: hidden; font-family: "Inter", sans-serif; }
    .ri { position: absolute; inset: 0; overflow: hidden; }
    .lay { position: absolute; inset: 0; }
    .full { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; object-fit: cover; }
    .vw { position: absolute; inset: 0; overflow: hidden; }
    .wash { position: absolute; inset: 0; }
    .pw { position: absolute; width: 444px; height: 928px; }
    .phone { position: absolute; inset: 0; border-radius: 64px; background: #0b1f17; padding: 16px; box-shadow: 0 40px 90px rgba(11,31,23,0.55); }
    .screen { position: relative; width: 412px; height: 896px; border-radius: 50px; overflow: hidden; background: #faf8f5; }
    .cam { position: absolute; left: 0; top: 0; width: 412px; height: 896px; }
    .screen img, .screen video { position: absolute; left: 0; top: 0; width: 412px; height: 896px; object-fit: cover; object-position: center top; }
    .gc { position: absolute; padding: 10px; border-radius: 32px; background: rgba(250,248,245,0.30); border: 1px solid rgba(255,255,255,0.62); box-shadow: 0 30px 80px rgba(11,31,23,0.38); backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4); }
    .gc img { display: block; border-radius: 22px; }
    .mc { position: absolute; width: 300px; height: 300px; border-radius: 24px; overflow: hidden; box-shadow: 0 26px 60px rgba(11,31,23,0.45); }
    .mc img { position: absolute; left: 0; top: 0; width: 300px; height: 300px; }
    .panel { position: absolute; overflow: hidden; border-radius: 30px; box-shadow: 0 40px 90px rgba(11,31,23,0.5); background: #0b1f17; }
    .panel .pv { position: absolute; inset: 0; }
    .panel video { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; }
    .ttl { position: absolute; font-weight: 800; letter-spacing: -0.03em; line-height: 1.04; color: #faf8f5; white-space: nowrap; }
    .ttl em { font-family: "EB Garamond", serif; font-style: italic; font-weight: 500; letter-spacing: -0.01em; }
    .ttl.sh { text-shadow: 0 4px 24px rgba(11,31,23,0.45); }
    .chap { position: absolute; font-weight: 700; font-size: 28px; letter-spacing: 0.14em; text-transform: uppercase; color: #dfe8dc; }
    .w { display: inline-block; }
    .cap { position: absolute; display: flex; align-items: center; gap: 16px; padding: 14px 26px; border-radius: 999px; background: rgba(250,248,245,0.94); color: #17402c; font-size: 30px; font-weight: 700; box-shadow: 0 16px 40px rgba(11,31,23,0.25); white-space: nowrap; }
    .cap i { width: 14px; height: 14px; border-radius: 50%; background: #5b7f55; }
    .touch { position: absolute; width: 40px; height: 40px; border-radius: 50%; border: 3px solid #faf8f5; background: rgba(250,248,245,0.22); box-shadow: 0 4px 14px rgba(11,31,23,0.4); opacity: 0; }
    .dip { position: absolute; inset: 0; background: rgba(11,31,23,0.5); opacity: 0; }
    .credit { position: absolute; padding: 6px 12px; border-radius: 8px; background: rgba(11,31,23,0.55); color: #dfe8dc; font-size: 16px; font-weight: 400; }
"""


# --------------------------------------------------------------------------- une composition
class Shot:
    def __init__(self, n, sid=None, lead=0.0, tail=0.0, last=None, z=None):
        self.n = n
        self.sid = sid or f"s{n:02d}"
        self.bar = bar(n)
        self.L, self.T = lead, tail
        self.t0 = self.bar - lead
        self.end = FB[last or n]["end"] + tail
        self.D = self.end - self.t0
        self.html, self.tl = [], []
        self.ri_style = ""
        self.seen = set()
        self.z = z

    def loc(self, t):
        return round(t - self.t0, 4)

    def _ir(self, sel, to):
        if js(sel) in self.seen and "immediateRender" not in to:
            to = dict(to, immediateRender=False)
        self.seen.add(js(sel))
        return to

    def ft(self, sel, frm, to, t):
        to = self._ir(sel, to)
        self.tl.append(f"tl.fromTo({js(sel)}, {js(frm)}, {js(to)}, {self.loc(t)});")

    def to(self, sel, to, t):
        self.seen.add(js(sel))
        self.tl.append(f"tl.to({js(sel)}, {js(to)}, {self.loc(t)});")

    def set(self, sel, v, t):
        self.seen.add(js(sel))
        self.tl.append(f"tl.set({js(sel)}, {js(v)}, {self.loc(t)});")

    def add(self, h):
        self.html.append(h)

    # ---------------------------------------------------------------- briques
    def bg_img(self, src, wash=None, push=(1.06, 1.0), bid="bg"):
        i = f"{self.sid}-{bid}"
        w = f'<div class="wash" style="background:{wash}"></div>' if wash else ""
        self.add(f'<div class="vw"><img id="{i}" class="full" src="{src}" alt="" /></div>{w}')
        if push:
            self.ft(f"#{i}", {"scale": push[0]}, {"scale": push[1], "duration": self.D, "ease": "none"}, self.t0)

    def bg_solid(self, css):
        self.add(f'<div class="wash" style="background:{css}"></div>')

    def video_full(self, vid, src, media_start, rate=1.0, push=(1.0, 1.06), start=None, dur=None):
        start = self.t0 if start is None else start
        dur = self.D if dur is None else dur
        r = f' data-playback-rate="{rate}"' if rate != 1.0 else ""
        self.add(f'<div class="vw" id="{self.sid}-{vid}w"><video id="{self.sid}-{vid}" class="clip full" src="{src}" muted playsinline '
                 f'data-start="{self.loc(start)}" data-duration="{round(dur, 4)}" data-media-start="{media_start}"{r} data-track-index="1"></video></div>')
        if push:
            self.ft(f"#{self.sid}-{vid}w", {"scale": push[0]}, {"scale": push[1], "duration": self.D, "ease": "none"}, self.t0)

    def panel(self, pid, src, x, y, scale=1.1, parts=((0.0, None, 0.0, 1.0),), push=(1.0, 1.05)):
        """Panneau vertical (540 × 960 → ≤ 594 × 1056) ; parts : (début, durée, media-start, vitesse)."""
        w, h = round(540 * scale), round(960 * scale)
        vids = ""
        for k, (st, du, ms, rate) in enumerate(parts):
            du = self.D - st if du is None else du
            r = f' data-playback-rate="{rate}"' if rate != 1.0 else ""
            vids += (f'<video id="{self.sid}-{pid}-v{k}" class="clip" src="{src}" muted playsinline data-start="{round(st, 4)}" '
                     f'data-duration="{round(du, 4)}" data-media-start="{round(ms, 4)}"{r} data-track-index="{2 + k}"></video>')
        self.add(f'<div class="panel" id="{self.sid}-{pid}" style="left:{x}px; top:{y}px; width:{w}px; height:{h}px">'
                 f'<div class="pv" id="{self.sid}-{pid}-pv">{vids}</div></div>')
        if push:
            self.ft(f"#{self.sid}-{pid}-pv", {"scale": push[0]}, {"scale": push[1], "duration": self.D, "ease": "none"}, self.t0)
        return w, h

    def card(self, cid, src, x, y, w, glass=True):
        sw, sh = size_of(src)
        h = round(w * sh / sw)
        if glass:
            self.add(f'<div class="gc" id="{self.sid}-{cid}" style="left:{x}px; top:{y}px"><img src="{src}" alt="" style="width:{w}px; height:{h}px" /></div>')
        else:
            self.add(f'<img id="{self.sid}-{cid}" src="{src}" alt="" style="position:absolute; left:{x}px; top:{y}px; width:{w}px; height:{h}px; border-radius:20px; box-shadow:0 24px 60px rgba(11,31,23,0.35)" />')
        return w, h

    def phone(self, pid, x, y, inner):
        self.add(f'<div class="pw" id="{self.sid}-{pid}" style="left:{x}px; top:{y}px"><div class="phone"><div class="screen">'
                 f'<div class="cam" id="{self.sid}-{pid}-cam">{inner}</div></div></div></div>')
        return f"#{self.sid}-{pid}"

    def pstate(self, sel, t, **kw):
        st = {"transformOrigin": "50% 50%", "transformPerspective": PERSP}
        st.update(kw)
        self.set(sel, st, t)

    def title(self, tid, x, y, l1, em, size, color=STONE, emcolor=None, chap=None, chapcolor=None, one_line=False, shadow=True, align="left"):
        sid = f"{self.sid}-{tid}"
        w1 = " ".join(f'<span class="w {sid}-a">{E(t)}</span>' for t in l1.split())
        w2 = " ".join(f'<span class="w {sid}-b">{E(t)}</span>' for t in em.split())
        ec = f' style="color:{emcolor}"' if emcolor else ""
        br = " " if one_line else "<br />"
        al = "text-align:center; transform-origin: 50% 50%;" if align == "center" else ""
        left = f"left:{x}px;" if align != "center" else "left:0; width:1920px;"
        if chap:
            cc = f"color:{chapcolor};" if chapcolor else ""
            self.add(f'<div class="chap" id="{sid}-ch" style="left:{x + 4}px; top:{y - 46}px; {cc}">{E(chap)}</div>')
        self.add(f'<div class="ttl{" sh" if shadow else ""}" id="{sid}" style="{left} top:{y}px; font-size:{size}px; color:{color}; {al}">'
                 f'{w1}{br}<em{ec}>{w2}</em></div>')
        return sid

    def title_in(self, sid, t, style=0, chap=False):
        """Trois entrées (mots flous, ligne floue, gris → encre) ; 2e ligne posée avant t + 0,3 s."""
        if chap:
            self.ft(f"#{sid}-ch", {"opacity": 0, "filter": "blur(8px)"}, {"opacity": 1, "filter": "blur(0px)", "duration": 0.15, "ease": "power2.out"}, t - 0.05)
        for k, cls in enumerate((f".{sid}-a", f".{sid}-b")):
            at = t + 0.11 * k
            s = (style + k) % 3
            if s == 0:
                self.ft(cls, {"opacity": 0, "filter": "blur(6px)"}, {"opacity": 1, "filter": "blur(0px)", "duration": 0.13, "stagger": 0.05, "ease": "power2.out"}, at)
            elif s == 1:
                self.ft(cls, {"opacity": 0, "filter": "blur(10px)"}, {"opacity": 1, "filter": "blur(0px)", "duration": 0.16, "ease": "power2.out"}, at)
            else:
                self.ft(cls, {"opacity": 0, "color": "#9fb59a"}, {"opacity": 1, "color": "inherit", "duration": 0.14, "stagger": 0.04, "ease": "power1.out"}, at)

    def title_out(self, sid, t, chap=False):
        sels = [f".{sid}-a", f".{sid}-b"] + ([f"#{sid}-ch"] if chap else [])
        self.to(sels, {"opacity": 0, "filter": "blur(8px)", "duration": 0.18, "stagger": 0.02, "ease": "power2.in"}, t)

    def cap(self, cid, text, x, y, t, dx=-24):
        i = f"{self.sid}-{cid}"
        self.add(f'<div class="cap" id="{i}" style="left:{x}px; top:{y}px"><i></i>{E(text)}</div>')
        self.ft(f"#{i}", {"opacity": 0, "x": dx}, {"opacity": 1, "x": 0, "duration": 0.45, "ease": "expo.out"}, t - 0.03)
        ev(t, self.n, f"légende « {text} »")

    def touch(self, tid, x, y, press, show=0.2):
        i = f"{self.sid}-{tid}"
        self.add(f'<div class="touch" id="{i}" style="left:{x - 20:.0f}px; top:{y - 20:.0f}px"></div>')
        self.ft(f"#{i}", {"opacity": 0, "scale": 1.3}, {"opacity": 1, "scale": 1, "duration": round(show - 0.06, 3), "ease": "power2.out"}, press - show)
        self.to(f"#{i}", {"scale": 0.8, "duration": 0.08, "ease": "power2.in"}, press - 0.04)
        self.to(f"#{i}", {"opacity": 0, "scale": 1, "duration": 0.14, "ease": "power2.out"}, press + 0.08)

    def swap(self, new, prev, t, how="swap"):
        if how == "scroll":
            self.to(f"#{prev}", {"y": -SH, "duration": 0.35, "ease": "power3.inOut"}, t)
            self.ft(f"#{new}", {"y": SH, "opacity": 1}, {"y": 0, "opacity": 1, "duration": 0.35, "ease": "power3.inOut"}, t)
            return
        if prev:
            self.ft(f"#{prev}", {"filter": "blur(0px)"}, {"filter": "blur(8px)", "duration": 0.05, "ease": "power1.in", "immediateRender": False}, t - 0.05)
        self.ft(f"#{new}", {"opacity": 0, "filter": "blur(8px)"}, {"opacity": 1, "filter": "blur(8px)", "duration": 0.001, "ease": "none"}, t)
        self.to(f"#{new}", {"filter": "blur(0px)", "duration": 0.08, "ease": "power2.out"}, t + 0.001)

    def credit(self, text, x, y):
        self.add(f'<div class="credit" data-layout-ignore style="left:{x}px; top:{y}px">{E(text)}</div>')

    # ---------------------------------------------------------------- transitions génériques
    def enter(self, kind):
        ri = f"#{self.sid}-ri"
        if kind == "whip":
            self.ft(ri, {"x": 1920, "filter": "blur(16px)"}, {"x": 0, "filter": "blur(0px)", "duration": self.L + 0.04, "ease": "power3.inOut"}, self.t0)
        elif kind == "rise":
            self.ft(ri, {"y": 1080, "filter": "blur(14px)"}, {"y": 0, "filter": "blur(0px)", "duration": self.L + 0.04, "ease": "power3.inOut"}, self.t0)
        ev(self.t0, self.n, f"coupe : {kind} (le plan entrant part {self.L:.2f} s avant la barre)" if self.L else f"coupe : {kind} (sur la barre)")

    def leave(self, kind, nxt_lead=0.3):
        ri = f"#{self.sid}-ri"
        e = self.end
        if kind == "whip":
            self.to(ri, {"x": -600, "filter": "blur(10px)", "duration": nxt_lead, "ease": "power3.in"}, e - nxt_lead)
        elif kind == "rise":
            self.to(ri, {"y": -420, "filter": "blur(10px)", "duration": nxt_lead, "ease": "power3.in"}, e - nxt_lead)
        elif kind == "dip":
            self.add(f'<div class="dip" id="{self.sid}-dip"></div>')
            self.ft(f"#{self.sid}-dip", {"opacity": 0}, {"opacity": 1, "duration": 0.1, "ease": "none"}, e - 0.1)
        elif kind == "blur":
            self.to(ri, {"filter": "blur(14px)", "duration": nxt_lead, "ease": "power2.in"}, e - nxt_lead)

    def render(self):
        tls = "\n      ".join(self.tl)
        inner = "\n      ".join(self.html)
        st = f' style="{self.ri_style}"' if self.ri_style else ""
        return f"""<template>
  <style>{CSS}  </style>
  <div id="root" data-composition-id="{self.sid}" data-width="1920" data-height="1080" data-layout-allow-overflow data-layout-allow-overlap>
    <div class="ri" id="{self.sid}-ri"{st}>
      {inner}
    </div>
  </div>
  <script>
    (function () {{
      const tl = gsap.timeline({{ paused: true }});
      {tls}
      window.__timelines["{self.sid}"] = tl;
    }})();
  </script>
</template>
"""


def scr(st, u, v):
    """Point (u, v) de la capture → cadre, pour un téléphone à plat : st = (left, top, x, y, scale)."""
    left, top, x, y, s = st
    return (left + PW / 2 + x + s * (PAD + u * SW - PW / 2),
            top + PH / 2 + y + s * (PAD + v * SH - PH / 2))


def imgs(sid, pid, srcs):
    out = ""
    for k, s in enumerate(srcs):
        hidden = ' style="opacity:0"' if k else ""
        out += f'<img id="{sid}-{pid}-i{k}" src="{s}" alt=""{hidden} />'
    return out


# =========================================================================== les plans
# 01–02 · Ouverture sur le monde, puis plongée dans l'écran (une seule composition : aucune coupe).
S1_PH = (1080, 0)                      # base CSS du téléphone (droite du centre)
S1_UP = (0, 330, 0.82)                 # monté du paysage, incliné
TAP2 = (0.274, 0.484)                  # la carte « Bivouac dans les Hautes Fagnes » (capture)
GROW3 = (0.055, 0.30, 0.49, 0.645)     # son rectangle (capture)


def _plunge(tx, ty, sc):
    """Décalage (x, y) qui amène le point TAP2 de l'écran en (tx, ty) à l'échelle sc."""
    u, v = TAP2
    return (tx - (S1_PH[0] + PW / 2) - sc * (PAD + u * SW - PW / 2),
            ty - (S1_PH[1] + PH / 2) - sc * (PAD + v * SH - PH / 2), sc)


S1_IN = _plunge(640, 560, 2.0)         # plongé : la carte du carnet en (640, 560)


def s01():
    s = Shot(1, last=2)
    b2 = bar(2)
    s.video_full("sun", "assets/footage/sunrise-ridge.mp4", 0, push=None)
    s.ft("#s01-sunw", {"scale": 1.0}, {"scale": 1.05, "duration": b2, "ease": "none"}, 0)
    s.to("#s01-sunw", {"scale": 1.22, "duration": 0.85, "ease": "power2.inOut"}, b2)
    s.add('<div class="wash" id="s01-dk" style="background:#0b1f17; opacity:0"></div>')
    s.ft("#s01-dk", {"opacity": 0}, {"opacity": 0.62, "duration": 0.85, "ease": "power2.inOut"}, b2)
    ev(0, 1, "image 0 : lever de soleil réel plein cadre + titre posé")
    # Titre d'ouverture, posé dès l'image 0, centré dans le ciel.
    s.add('<div class="wash" style="background: linear-gradient(90deg, rgba(11,31,23,0.55) 0%, rgba(11,31,23,0.25) 40%, rgba(11,31,23,0) 62%)"></div>')
    t1 = s.title("t", 110, 520, "Là où la carte", "se termine.", 104)
    s.title_out(t1, 3.5)
    # Le téléphone monte du paysage (mesure 2), le fil réel de la Communauté y défile.
    srcs = [A + "feed-1.jpg", A + "feed-3.jpg", A + "carnet-semaine.jpg"]
    p = s.phone("p", *S1_PH, imgs("s01", "p", srcs))
    s.ft(p, {"x": 0, "y": 1180, "scale": S1_UP[2], "rotationX": 32, "transformOrigin": "50% 50%", "transformPerspective": PERSP},
         {"x": 0, "y": S1_UP[1], "scale": S1_UP[2], "rotationX": 10, "duration": 0.9, "ease": "expo.out"}, BAR)
    ev(BAR, 1, "un téléphone monte du bas du cadre, incliné (le fil de la Communauté)")
    s.swap("s01-p-i1", "s01-p-i0", 2.85, "scroll")
    ev(2.85, 1, "le fil défile (Chloé Fontan)")
    # 02 · plongée : l'écran passe sur les carnets, la caméra avance dans le téléphone.
    s.swap("s01-p-i2", "s01-p-i1", b2)
    s.to(p, {"x": S1_IN[0], "y": S1_IN[1], "scale": S1_IN[2], "rotationX": 0, "duration": 0.85, "ease": "power2.inOut"}, b2)
    ev(b2, 2, "écran : Explorer › Carnets (échange flou) ; la caméra plonge dans le téléphone (0,85 s)")
    t2 = s.title("t2", 1330, 400, "Un carnet,", "qui donne envie", 76, chap="Explorer")
    s.title_in(t2, b2 + 0.25, 0, chap=True)
    ev(b2 + 0.25, 2, "titre « Un carnet, qui donne envie »")
    s.cap("cap2", "Hautes Fagnes · 2 jours", 1334, 610, b2 + CAP_AT + 0.2)
    st = (S1_PH[0], S1_PH[1], *S1_IN)
    tx, ty = scr(st, *TAP2)
    s.touch("tap", tx, ty, b2 + BAR - 0.35)
    ev(b2 + BAR - 0.35, 2, "le doigt appuie sur la carte « Bivouac dans les Hautes Fagnes »")
    s.leave("blur", 0.35)
    return s


def grow_rect():
    st = (S1_PH[0], S1_PH[1], *S1_IN)
    u0, v0, u1, v1 = GROW3
    (x0, y0), (x1, y1) = scr(st, u0, v0), scr(st, u1, v1)
    return x0, y0, x1, y1


# 03 · La carte touchée devient le plan : la fiche du carnet et ses photos en profondeur.
def s03():
    s = Shot(3, lead=0.35)
    x0, y0, x1, y1 = grow_rect()
    s.ri_style = ""
    s.ft("#s03-ri", {"clipPath": f"inset({y0:.0f}px {W - x1:.0f}px {H - y1:.0f}px {x0:.0f}px round 24px)"},
         {"clipPath": "inset(0px 0px 0px 0px round 0px)", "duration": 0.45, "ease": "power3.inOut"}, s.t0)
    ev(s.t0, 3, "coupe : grow — la carte touchée s'agrandit jusqu'au cadre (0,45 s)")
    s.bg_img("assets/img/detail-hero.jpg", wash="linear-gradient(90deg, rgba(250,248,245,0.92) 0%, rgba(250,248,245,0.78) 46%, rgba(250,248,245,0.35) 100%)")
    s.add('<div class="lay" id="s03-fg">')
    s.card("ent", C + "carnet-entete.jpg", 110, 120, 760)
    s.card("voy", C + "carnet-voyageurs.jpg", 130, 480, 400)
    s.add("</div>")
    s.ft("#s03-fg", {"opacity": 0, "filter": "blur(10px)"}, {"opacity": 1, "filter": "blur(0px)", "duration": 0.25, "ease": "power2.out"}, s.t0 + 0.28)
    s.cap("cap", "3 voyageurs", 572, 518, s.bar + CAP_AT)
    t = s.title("t", 110, 720, "Deux jours,", "déjà racontés", 96, color=FOREST, shadow=False)
    s.title_in(t, s.bar + 0.05, 1)
    ev(s.bar + 0.05, 3, "titre « Deux jours, déjà racontés »")
    # Les 4 médias réels du carnet arrivent en profondeur, un par temps.
    spots = [(1010, 130, -6, -260), (1420, 96, 5, 0), (1130, 500, 3, 120), (1530, 540, -4, -120)]
    for k, (x, y, r, z) in enumerate(spots):
        i = f"m{k}"
        s.card(i, C + f"media-{k + 1}.jpg", x, y, 290)
        t_k = s.bar + k * BEAT
        s.ft(f"#s03-{i}", {"opacity": 0, "scale": 1.45, "rotation": r + 9, "y": -70, "z": z + 500, "filter": "blur(8px)", "transformPerspective": PERSP},
             {"opacity": 1, "scale": 1, "rotation": r, "y": 0, "z": z, "filter": "blur(0px)", "duration": 0.55, "ease": "expo.out"}, t_k - 0.05)
        ev(t_k, 3, f"photo du carnet {k + 1}/4 posée en profondeur")
    s.leave("whip")
    return s


# 04 · Le message seul : la bulle réelle, agrandie, flotte au centre.
def s04():
    s = Shot(4, lead=0.3)
    s.enter("whip")
    s.bg_img(C + "bg-flou-paysage.jpg", wash="rgba(11,31,23,0.28)")
    t = s.title("t", 330, 96, "Un message,", "un voyage", 88)
    s.title_in(t, s.bar - 0.04, 2)
    ev(s.bar, 4, "titre « Un message, un voyage » (arrivé avec le fouet)")
    s.card("cam", C + "msg-camille.jpg", 330, 340, 330, glass=False)
    s.ft("#s04-cam", {"opacity": 0, "y": 20}, {"opacity": 1, "y": 0, "duration": 0.4, "ease": "expo.out"}, s.bar - 0.1)
    s.card("bul", C + "msg-bulle.jpg", 330, 480, 1260)
    s.ft("#s04-bul", {"opacity": 0, "y": 260, "scale": 0.62, "rotationX": 34, "transformOrigin": "50% 100%", "transformPerspective": PERSP},
         {"opacity": 1, "y": 0, "scale": 1, "rotationX": 0, "duration": 0.75, "ease": "expo.out"}, s.bar - 0.02)
    ev(s.bar, 4, "la bulle réelle du message monte et se pose (0,75 s)")
    s.cap("cap", "Envoyé à Camille", 1240, 822, s.bar + CAP_AT + 0.1)
    s.leave("rise")
    return s


# 05 · La phrase : typographie cinétique au rythme de la vraie frappe ; le pouce touche la flèche.
S5_PH = (96, 76, 0, 0, 0.95)
REC = "assets/app/video/compas-creation-w-804.mp4"
REC_RATE = 1.5
TYPE_PTS = [(2.8, 0), (3.0, 7), (3.25, 19), (3.5, 31), (3.75, 42), (4.0, 55), (4.2, 61)]  # (s source, caractères)
PHRASE = ["Le W de Torres del Paine,", "5 jours à 3 en refuge,", "fin novembre"]


def rec_ms5(lead):
    return 2.8 - (lead + 0.05) * REC_RATE   # la frappe commence à barre + 0,05


def arrow_xy():
    left, top, x, y, sc = S5_PH
    u, v = 700 / 804, 1156 / 1748
    return scr((left, top, x, y, sc), u, v)


def char_time(k):
    for (s0, c0), (s1, c1) in zip(TYPE_PTS, TYPE_PTS[1:]):
        if c0 <= k < c1 or (k >= c1 and (s1, c1) == TYPE_PTS[-1]):
            k2 = min(k, c1)
            return s0 + (s1 - s0) * (k2 - c0) / max(1, c1 - c0)
    return TYPE_PTS[-1][0]


def s05():
    s = Shot(5, lead=0.3, z=100)
    s.enter("rise")
    s.bg_solid("radial-gradient(120% 120% at 70% 40%, #faf8f5 0%, #f1ede6 60%, #e4dfd6 100%)")
    ms = rec_ms5(s.L)
    p = s.phone("p", S5_PH[0], S5_PH[1],
                f'<video id="s05-rec" class="clip" src="{REC}" muted playsinline data-start="0" data-duration="{round(s.D, 4)}" '
                f'data-media-start="{round(ms, 4)}" data-playback-rate="{REC_RATE}" data-track-index="1"></video>')
    s.pstate(p, s.t0, scale=S5_PH[4])
    s.add(f'<div class="chap" style="left:644px; top:236px; color:{SAGE}">Compas · « Où veux-tu aller ? »</div>')
    # La phrase exacte, caractère par caractère, à l'instant où elle se tape dans l'enregistrement.
    lines, k = [], 0
    for li, line in enumerate(PHRASE):
        words = []
        for wd in line.split(" "):
            chs = ""
            for ch in wd:
                chs += f'<span class="s05-ch" id="s05-c{k}" style="opacity:0">{E(ch)}</span>'
                k += 1
            words.append(f'<span class="w">{chs}</span>')
            k += 1  # l'espace
        style = "" if li == 0 else f' style="font-family:\'EB Garamond\', serif; font-style:italic; font-weight:500; color:{SAGE}; letter-spacing:-0.01em"'
        lines.append(f"<div{style}>{' '.join(words)}</div>")
    s.add(f'<div class="ttl" style="left:640px; top:286px; font-size:88px; color:{FOREST}; line-height:1.12">{"".join(lines)}</div>')
    k = 0
    for line in PHRASE:
        for wd in line.split(" "):
            for _ch in wd:
                src_t = char_time(k)
                t = s.t0 + (src_t - ms) / REC_RATE
                s.ft(f"#s05-c{k}", {"opacity": 0, "y": 10}, {"opacity": 1, "y": 0, "duration": 0.06, "ease": "power2.out"}, t)
                k += 1
            k += 1
    t_first = s.t0 + (TYPE_PTS[0][0] - ms) / REC_RATE
    t_last = s.t0 + (TYPE_PTS[-1][0] - ms) / REC_RATE
    ev(t_first, 5, "la phrase s'écrit en grand, au rythme de la vraie frappe (61 caractères)")
    ev(t_last, 5, "la phrase est complète")
    ax, ay = arrow_xy()
    press = s.bar + 1.62
    s.touch("tap", ax, ay, press)
    ev(press, 5, "le doigt appuie sur la flèche du Compas")
    # Un seul iris, depuis la flèche, jusqu'à la barre du plan 06 : dessous, le même téléphone et le vol.
    s.ri_style = ("--iris: 0px; -webkit-mask-image: radial-gradient(circle at {x:.0f}px {y:.0f}px, transparent var(--iris), #000 var(--iris)); "
                  "mask-image: radial-gradient(circle at {x:.0f}px {y:.0f}px, transparent var(--iris), #000 var(--iris));").format(x=ax, y=ay)
    s.ft("#s05-ri", {"--iris": "0px"}, {"--iris": "2100px", "duration": round(s.end - press, 4), "ease": "power2.in"}, press)
    ev(press, 5, "l'iris s'ouvre depuis la flèche sur le vol satellite (jusqu'à 11,25 s)")
    return s


# 06–07 · Le vol satellite réel (racine) ; le téléphone continue, puis glisse au bord ; le tracé (wTrace).
FLIGHT_T0 = bar(6) - 0.35
FLIGHT_LEN = 5.0
S7_EDGE = dict(x=-30, y=36, scale=0.8, rotationY=16)


def s06():
    s = Shot(6, lead=0.35)
    ev(s.bar, 6, "coupe : iris terminé ; le vol satellite (vidéo réelle) plein cadre")
    ms = rec_ms5(0.3) + (s.t0 - (bar(5) - 0.3)) * REC_RATE
    t_prep, t_voy = s.bar + 0.47, s.bar + 1.17
    inner = (f'<video id="s06-rec" class="clip" src="{REC}" muted playsinline data-start="0" data-duration="{round(t_prep - s.t0 + 0.1, 4)}" '
             f'data-media-start="{round(ms, 4)}" data-playback-rate="{REC_RATE}" data-track-index="1"></video>'
             f'<img id="s06-p-i0" src="{A}compas-prep.jpg" alt="" style="opacity:0" />'
             f'<img id="s06-p-i1" src="{A}compas-voyage.jpg" alt="" style="opacity:0" />')
    p = s.phone("p", S5_PH[0], S5_PH[1], inner)
    s.pstate(p, s.t0, scale=S5_PH[4])
    s.swap("s06-p-i0", None, t_prep)
    s.swap("s06-p-i1", "s06-p-i0", t_voy)
    ev(t_prep, 6, "écran : « Je lis ta phrase… » (échange flou)")
    ev(t_voy, 6, "écran : le voyage prêt (5 jours · 61,5 km · 1 398 €)")
    s.add('<div class="wash" style="background: linear-gradient(90deg, rgba(11,31,23,0.0) 0%, rgba(11,31,23,0.35) 40%, rgba(11,31,23,0.0) 80%)"></div>')
    t = s.title("t", 660, 330, "Le Compas", "prépare tout", 104, chap="Compas")
    s.title_in(t, s.bar + 0.03, 0, chap=True)
    ev(s.bar + 0.03, 6, "titre « Le Compas prépare tout »")
    s.cap("cap", "5 jours · 61,5 km · 3 personnes", 664, 590, t_voy + 0.05)
    s.title_out(t, s.end - 0.2, chap=True)
    s.to(f"#{s.sid}-cap", {"opacity": 0, "filter": "blur(8px)", "duration": 0.18, "ease": "power2.in"}, s.end - 0.18)
    s.credit("Imagerie : Esri, Maxar, Earthstar Geographics", 1480, 1032)
    return s


def s07():
    s = Shot(7)
    p = s.phone("p", S5_PH[0], S5_PH[1], f'<img src="{A}compas-voyage.jpg" alt="" />')
    s.ft(p, {"x": 0, "y": 0, "scale": S5_PH[4], "rotationY": 0, "transformOrigin": "50% 50%", "transformPerspective": PERSP},
         dict(S7_EDGE, duration=0.6, ease="power3.inOut"), s.bar)
    ev(s.bar, 7, "porté : le même téléphone glisse au bord gauche et se tourne vers la carte (0,6 s)")
    s.add('<div id="s07-tg" style="position:absolute; left:540px; top:70px; padding:14px 30px 18px; border-radius:26px; '
          'background:rgba(11,31,23,0.55); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px)"></div>')
    t = s.title("t", 570, 80, "Le W,", "jour par jour", 64, one_line=True, shadow=False)
    s.ft("#s07-tg", {"opacity": 0}, {"opacity": 1, "duration": 0.2, "ease": "power2.out"}, s.bar + 0.05)
    s.title_in(t, s.bar + 0.08, 1)
    ev(s.bar + 0.08, 7, "titre « Le W, jour par jour » (sur pastille sombre)")
    ev(13.375, 7, "wTrace : Refugio Chileno, puis le W se dessine (voir w-trace.html)")
    ev(13.375 + 1.40625, 7, "wTrace : Hostería Pehoé")
    ev(13.375 + 1.875, 7, "wTrace : Villa Monzino")
    ev(13.375 + 2.34375, 7, "wTrace : Torres del Paine")
    s.credit("Imagerie : Esri, Maxar, Earthstar Geographics", 1480, 1032)
    s.leave("rise")
    return s


# 08 · Le sac : le tiroir réel extrait, ses lignes tombent sur les temps.
ANNEAU_C = (130 + 170, 380 + 169)


def s08():
    s = Shot(8, lead=0.3)
    s.enter("rise")
    s.bg_solid("radial-gradient(120% 120% at 30% 40%, #faf8f5 0%, #efebe4 55%, #e2ddd3 100%)")
    k = 0.9
    s.add('<div class="gc" id="s08-box" style="left:110px; top:260px; width:1017px; height:470px; padding:0"></div>')
    s.ft("#s08-box", {"opacity": 0, "scale": 0.94}, {"opacity": 1, "scale": 1, "duration": 0.5, "ease": "expo.out"}, s.bar - 0.1)
    s.card("ent", C + "sac-entete.jpg", 130, 280, round(1085 * k), glass=False)
    s.card("ann", C + "sac-anneau.jpg", 130, 380, round(378 * k), glass=False)
    s.ft("#s08-ent", {"opacity": 0}, {"opacity": 1, "duration": 0.25, "ease": "power2.out"}, s.bar - 0.05)
    s.ft("#s08-ann", {"opacity": 0, "scale": 0.82}, {"opacity": 1, "scale": 1, "duration": 0.5, "ease": "expo.out"}, s.bar + 0.02)
    ev(s.bar, 8, "le tiroir « Ton sac » réel, extrait : en-tête puis anneau 2,9 kg")
    names = ["Porter 1,7 kg", "Vêtements 100 g", "Sécurité 842 g", "Eau et repas 200 g", "Autre 100 g"]
    for i in range(5):
        y = 400 + i * 62
        s.card(f"l{i}", C + f"sac-l{i + 1}.jpg", 486, y, round(690 * k), glass=False)
        t_i = s.bar + 0.1 + i * 0.75 * BEAT
        s.ft(f"#s08-l{i}", {"opacity": 0, "y": -46, "filter": "blur(6px)"}, {"opacity": 1, "y": 0, "filter": "blur(0px)", "duration": 0.35, "ease": "expo.out"}, t_i)
        ev(t_i, 8, f"ligne du sac : {names[i]}")
    t = s.title("t", 1210, 330, "Ton sac,", "2,9 kg pour 5 jours", 76, color=FOREST, shadow=False, chap="Sac", chapcolor=SAGE)
    s.title_in(t, s.bar - 0.04, 0, chap=True)
    ev(s.bar, 8, "titre « Ton sac, 2,9 kg pour 5 jours »")
    s.cap("cap", "14 objets", 1214, 540, s.bar + CAP_AT)
    return s


# 09 · Le budget : le chiffre compte jusqu'à sa vraie valeur, le tiroir réel à côté.
def s09():
    s = Shot(9, lead=0.35, tail=0.3)
    cx, cy = ANNEAU_C
    s.ft("#s09-ri", {"clipPath": f"circle(0px at {cx}px {cy}px)"}, {"clipPath": f"circle(2300px at {cx}px {cy}px)", "duration": 0.45, "ease": "power2.inOut"}, s.t0)
    ev(s.t0, 9, "coupe : marée — le vert monte depuis l'anneau du sac (0,45 s)")
    s.bg_solid(f"radial-gradient(120% 120% at 30% 45%, #1f4f37 0%, {FOREST} 45%, {INK} 100%)")
    s.add(f'<div class="chap" id="s09-ch" style="left:118px; top:236px; color:#b9cdb3">À trois,</div>')
    s.ft("#s09-ch", {"opacity": 0}, {"opacity": 1, "duration": 0.2, "ease": "power2.out"}, s.bar - 0.05)
    s.add('<div id="s09-num" style="position:absolute; left:104px; top:262px; color:#faf8f5; font-weight:800; font-size:236px; '
          'letter-spacing:-0.04em; font-variant-numeric: tabular-nums; white-space:nowrap; line-height:1">0 €</div>')
    s.add('<div id="s09-pre" style="position:absolute; left:120px; top:520px; color:#b9cdb3; font-family:\'EB Garamond\', serif; '
          'font-style:italic; font-size:104px; line-height:1">prévus</div>')
    s.ft("#s09-pre", {"opacity": 0, "filter": "blur(8px)"}, {"opacity": 1, "filter": "blur(0px)", "duration": 0.18, "ease": "power2.out"}, s.bar + 0.1)
    t_c0, t_c1 = s.bar + 0.05, s.bar + 1.35
    s.tl.append("const cnt = { v: 0 }; const num = document.querySelector('#s09-num');"
                " const fmt = (v) => String(Math.round(v)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '\\u202f') + ' €';")
    s.tl.append(f'tl.fromTo(cnt, {{ v: 0 }}, {{ v: 4194, duration: {round(t_c1 - t_c0, 3)}, ease: "power3.out", '
                f'onUpdate: () => {{ num.textContent = fmt(cnt.v); }} }}, {s.loc(t_c0)});')
    ev(t_c0, 9, "le compteur monte de 0 à 4 194 € (1,3 s, power3.out)")
    ev(t_c1, 9, "4 194 € atteint")
    s.cap("cap", "1 398 € par personne", 120, 690, s.bar + CAP_AT)
    s.card("bud", C + "budget.jpg", 1100, 360, 700)
    s.ft("#s09-bud", {"opacity": 0, "x": 260, "rotationY": -30, "transformPerspective": PERSP},
         {"opacity": 1, "x": 0, "rotationY": -14, "duration": 0.7, "ease": "expo.out"}, s.bar + 0.1)
    ev(s.bar + 0.1, 9, "le tiroir budget réel arrive de la droite")
    # Retrait : le plan s'arrache vers la gauche et découvre le sac 3D (kit3dTaille) qui tourne déjà.
    s.to("#s09-ri", {"x": -1920, "filter": "blur(20px)", "duration": 0.3, "ease": "power3.in"}, bar(10))
    ev(bar(10), 10, "coupe : retrait — le budget s'arrache à gauche, la 3D (kit3dTaille) est dessous")
    return s


# 11 · Météo : la brume réelle en panneau vertical, le tiroir météo réel à côté.
def s11():
    s = Shot(11, lead=0.3)
    s.enter("rise")
    s.bg_img(C + "bg-flou-matin.jpg", wash="rgba(11,31,23,0.42)")
    s.panel("pan", "assets/footage/freedom-4.mp4", 130, 12)
    t = s.title("t", 860, 76, "La météo,", "du 22 au 26 novembre", 72, chap=None)
    s.title_in(t, s.bar - 0.04, 1)
    ev(s.bar, 11, "titre « La météo, du 22 au 26 novembre » ; panneau vidéo (brume, freedom-4)")
    s.card("met", C + "meteo.jpg", 860, 270, 610)
    s.ft("#s11-met", {"opacity": 0, "y": 90}, {"opacity": 1, "y": 0, "duration": 0.6, "ease": "expo.out"}, s.bar + 0.0)
    ev(s.bar, 11, "le tiroir météo réel (MET Norway) monte")
    s.cap("cap", "Averses · 22 novembre", 1500, 300, s.bar + CAP_AT, dx=24)
    s.leave("whip")
    return s


# 12 · En route : le randonneur en grand panneau, le suivi en direct (vrai chrono) dans le téléphone.
def s12():
    s = Shot(12, lead=0.3)
    s.enter("whip")
    s.bg_img(C + "bg-flou-rando.jpg", wash="rgba(11,31,23,0.45)")
    s.panel("pan", "assets/footage/freedom-2.mp4", 1186, 12)
    p = s.phone("p", 690, 76, f'<video id="s12-live" class="clip" src="{A}video/live.mp4" muted playsinline data-start="0" '
                f'data-duration="{round(s.D, 4)}" data-media-start="0" data-track-index="3"></video>')
    s.ft(p, {"y": 260, "rotationY": 24, "scale": 0.95, "transformOrigin": "50% 50%", "transformPerspective": PERSP},
         {"y": 0, "rotationY": 12, "duration": 0.8, "ease": "expo.out"}, s.bar - 0.15)
    ev(s.bar, 12, "panneau vidéo (randonneur, freedom-2) ; le téléphone du suivi en direct monte, le chrono avance")
    t = s.title("t", 110, 330, "Suivi", "en direct", 104, chap="Terrain")
    s.title_in(t, s.bar - 0.04, 2, chap=True)
    s.cap("cap", "Chrono · SOS", 114, 590, s.bar + CAP_AT)
    s.leave("dip")
    return s


# 13 · La story : la vraie photo (feu de camp) presque plein cadre, son en-tête extrait. Sans titre.
STORY = (721, 20, 478, 1040)
STORY_PUSH = 1.04


def s13():
    s = Shot(13)
    ev(s.bar, 13, "coupe : noir (3 images) puis la story plein cadre, sans titre")
    s.bg_img(C + "bg-flou-feu.jpg", wash="rgba(11,31,23,0.30)", push=None)
    x, y, w, h = STORY
    s.add(f'<div id="s13-st" style="position:absolute; left:{x}px; top:{y}px; width:{w}px; height:{h}px; border-radius:28px; overflow:hidden; '
          f'box-shadow:0 40px 100px rgba(11,31,23,0.6)"><img src="{A}carnet-stories.jpg" alt="" style="position:absolute; left:0; top:0; width:{w}px; height:{h}px" /></div>')
    s.ft("#s13-st", {"scale": 1, "x": 0, "y": 0, "transformOrigin": "0px 0px"},
         {"scale": STORY_PUSH, "x": -(STORY_PUSH - 1) * w / 2, "y": -(STORY_PUSH - 1) * h / 2, "duration": s.D, "ease": "none"}, s.t0)
    s.card("lea", C + "story-lea.jpg", 470, 110, 416, glass=False)
    s.ft("#s13-lea", {"opacity": 0, "x": 268, "y": -66, "scale": 0.42, "transformOrigin": "0px 0px"},
         {"opacity": 1, "x": 0, "y": 0, "scale": 1, "duration": 0.6, "ease": "expo.out"}, s.bar + 0.3)
    ev(s.bar + 0.3, 13, "l'en-tête « Léa Fontaine » sort de la story et s'agrandit")
    return s


# 14 · Le carnet se remplit : la story se range dans la grille, les trois autres médias suivent.
SLOTS = [(880, 250), (1194, 250), (1508, 250), (880, 564)]


def s14():
    s = Shot(14)
    ev(s.bar, 14, "coupe : portée — la story se range dans la première case de la grille")
    s.bg_img(C + "bg-flou-feu.jpg", wash="rgba(11,31,23,0.30)", push=None)
    s.add('<div class="wash" id="s14-dk" style="background:rgba(11,31,23,0.3); opacity:0"></div>')
    s.ft("#s14-dk", {"opacity": 0}, {"opacity": 1, "duration": 0.5, "ease": "power2.inOut"}, s.bar)
    x, y, w, h = STORY
    s.add(f'<div id="s14-st" style="position:absolute; left:{x}px; top:{y}px; width:{w}px; height:{h}px; overflow:hidden; border-radius:28px; '
          f'box-shadow:0 40px 100px rgba(11,31,23,0.6)"><img src="{A}carnet-stories.jpg" alt="" style="position:absolute; left:0; top:0; width:{w}px; height:{h}px" /></div>')
    sq_top = 333
    sc = 300 / w
    sx, sy = SLOTS[0]
    s.ft("#s14-st", {"scale": STORY_PUSH, "x": -(STORY_PUSH - 1) * w / 2, "y": -(STORY_PUSH - 1) * h / 2, "transformOrigin": "0px 0px",
                     "clipPath": "inset(0px 0px 0px 0px round 28px)"},
         {"scale": sc, "x": sx - x, "y": sy - y - sc * sq_top, "clipPath": f"inset({sq_top}px 0px {h - sq_top - w}px 0px round {24 / sc:.0f}px)",
          "duration": 0.6, "ease": "power3.inOut"}, s.bar)
    for k, (mx, my) in enumerate(SLOTS):
        s.add(f'<div class="mc" id="s14-m{k}" style="left:{mx}px; top:{my}px; opacity:0"><img src="{C}media-{k + 1}.jpg" alt="" /></div>')
    t_land = s.bar + 0.6
    s.swap("s14-m0", None, t_land)
    s.set("#s14-st", {"opacity": 0}, t_land + 0.01)
    ev(t_land, 14, "la story devient le 1er média (13:59), échange flou")
    for k in range(1, 4):
        t_k = s.bar + k * BEAT + 0.12
        s.ft(f"#s14-m{k}", {"opacity": 0, "x": 240, "y": 140, "rotation": 9, "scale": 1.18, "filter": "blur(6px)"},
             {"opacity": 1, "x": 0, "y": 0, "rotation": 0, "scale": 1, "filter": "blur(0px)", "duration": 0.5, "ease": "expo.out"}, t_k)
        ev(t_k, 14, f"média {k + 1}/4 se range dans la grille")
    t = s.title("t", 110, 330, "Le carnet", "se remplit", 100, chap="Carnets")
    s.title_in(t, s.bar + 0.1, 0, chap=True)
    ev(s.bar + 0.1, 14, "titre « Le carnet se remplit »")
    s.cap("cap", "4 médias · photos et vidéos", 114, 580, s.bar + CAP_AT + 0.1)
    s.leave("whip")
    return s


# 15 · Un club : le kayak en panneau, la liste réelle des départs ; dernière demi-mesure au ralenti.
def s15():
    s = Shot(15, lead=0.3)
    s.enter("whip")
    s.bg_img(C + "bg-flou-lac.jpg", wash="rgba(11,31,23,0.40)", push=(1.06, 1.02))
    slow_at = bar(16) - BAR / 2
    a_dur = slow_at - s.t0
    s.panel("pan", "assets/footage/freedom-3.mp4", 240, 12,
            parts=((0.0, a_dur, 0.0, 1.0), (a_dur, s.D - a_dur, a_dur, 0.3)), push=None)
    s.ft("#s15-pan-pv", {"scale": 1.0}, {"scale": 1.04, "duration": a_dur, "ease": "none"}, s.t0)
    s.to("#s15-pan-pv", {"scale": 1.046, "duration": s.D - a_dur, "ease": "power2.out"}, slow_at)
    ev(slow_at, 15, "silence : le kayak passe au ralenti (×0,3), plus rien ne bouge")
    s.card("dep", C + "club-departs.jpg", 700, 560, 760)
    s.ft("#s15-dep", {"opacity": 0, "x": 120, "rotationY": -24, "transformPerspective": PERSP},
         {"opacity": 1, "x": 0, "rotationY": -8, "duration": 0.7, "ease": "expo.out"}, s.bar + 0.05)
    ev(s.bar + 0.05, 15, "la liste réelle « Prochains départs & covoiturage » arrive devant le panneau")
    t = s.title("t", 1000, 120, "Une sortie,", "en covoiturage", 84, chap="Clubs")
    s.title_in(t, s.bar - 0.04, 1, chap=True)
    s.cap("cap", "Prochains départs", 1004, 360, s.bar + CAP_AT)
    s.leave("dip")
    return s


# 16 · Temps fort 2 : le lever de soleil réel (autre passage, les oiseaux), deux mesures sans
# interface ; puis le fil de la Communauté remonte du paysage.
def s16():
    s = Shot(16)
    s.video_full("sun", "assets/footage/sunrise-ridge.mp4", 3.0, push=(1.0, 1.08))
    ev(s.bar, 16, "coupe franche : lever de soleil réel plein cadre (oiseaux de 34,75 à 36,75 s), la musique repart")
    t_up = s.bar + 2 * BAR
    p = s.phone("p", 1250, 76, imgs("s16", "p", [A + "feed-2.jpg", A + "feed-4.jpg"]))
    s.ft(p, {"y": 1150, "rotationX": 26, "rotationY": -12, "scale": 0.9, "transformOrigin": "50% 50%", "transformPerspective": PERSP},
         {"y": 20, "rotationX": 6, "rotationY": -12, "duration": 0.9, "ease": "expo.out"}, t_up)
    ev(t_up, 16, "le téléphone (fil de la Communauté) monte du paysage")
    s.swap("s16-p-i1", "s16-p-i0", t_up + 2 * BEAT + 0.05, "scroll")
    ev(t_up + 2 * BEAT + 0.05, 16, "le fil défile (Sarah Cohen)")
    s.leave("whip")
    return s


# 17 · Ailleurs : le téléphone posé à plat, la carte « Explorateurs du Japon » s'en détache.
def s17():
    s = Shot(17, lead=0.3)
    s.enter("whip")
    s.bg_solid(f"radial-gradient(120% 120% at 35% 70%, #24543b 0%, {FOREST} 45%, {INK} 100%)")
    p = s.phone("p", 300, 250, f'<img src="{A}clubs.jpg" alt="" />')
    s.ft(p, {"rotationX": 50, "rotation": -16, "scale": 1.0, "transformOrigin": "50% 50%", "transformPerspective": PERSP},
         {"rotationX": 50, "rotation": -9, "duration": s.D, "ease": "none"}, s.t0)
    s.card("jap", C + "club-japon.jpg", 1080, 200, 600)
    s.ft("#s17-jap", {"opacity": 0, "x": -560, "y": 300, "scale": 0.45, "rotationX": 50, "transformPerspective": PERSP},
         {"opacity": 1, "x": 0, "y": 0, "scale": 1, "rotationX": 0, "duration": 0.75, "ease": "expo.out"}, s.bar + 0.02)
    ev(s.bar + 0.02, 17, "la carte réelle « Explorateurs du Japon » se détache du téléphone posé à plat")
    s.card("ami", C + "club-japon-amis.jpg", 1150, 700, 470)
    s.ft("#s17-ami", {"opacity": 0, "y": 40}, {"opacity": 1, "y": 0, "duration": 0.45, "ease": "expo.out"}, s.bar + CAP_AT)
    ev(s.bar + CAP_AT, 17, "« 7 amis » (ligne réelle de la carte)")
    t = s.title("t", 110, 120, "Explorateurs", "du Japon", 92, chap="Clubs")
    s.title_in(t, s.bar - 0.04, 0, chap=True)
    s.leave("rise")
    return s


# 18 · Une trace partagée : la carte réelle « Mon repérage — Bavella » sortie de la conversation.
def s18():
    s = Shot(18, lead=0.3)
    s.enter("rise")
    s.bg_img(C + "bg-flou-paysage.jpg", wash="rgba(11,31,23,0.5)", push=(1.0, 1.06))
    s.card("cam", C + "msg-camille2.jpg", 840, 120, 300, glass=False)
    s.ft("#s18-cam", {"opacity": 0, "y": 20}, {"opacity": 1, "y": 0, "duration": 0.4, "ease": "expo.out"}, s.bar - 0.1)
    s.card("bav", C + "msg-bavella.jpg", 840, 240, 900)
    s.ft("#s18-bav", {"opacity": 0, "y": 260, "scale": 0.66, "rotationX": 30, "rotationY": 10, "transformOrigin": "50% 100%", "transformPerspective": PERSP},
         {"opacity": 1, "y": 0, "scale": 1, "rotationX": 0, "rotationY": 8, "duration": 0.75, "ease": "expo.out"}, s.bar - 0.05)
    s.to("#s18-bav", {"rotationY": -3, "duration": s.end - s.bar - 0.7, "ease": "sine.inOut"}, s.bar + 0.7)
    ev(s.bar, 18, "la carte réelle « Mon repérage — Bavella » monte et tourne doucement")
    t = s.title("t", 110, 380, "Une trace", "partagée", 104, chap="Messagerie")
    s.title_in(t, s.bar - 0.04, 2, chap=True)
    s.cap("cap", "Mon repérage — Bavella", 114, 640, s.bar + CAP_AT)
    s.leave("whip")
    return s


# 19 · À six : le carnet du Tour du Mont-Blanc tourne dans l'espace.
def s19():
    s = Shot(19, lead=0.3, tail=0.3)
    s.enter("whip")
    s.bg_img("assets/img/mountain-1.jpg", wash="linear-gradient(270deg, rgba(11,31,23,0.75) 0%, rgba(11,31,23,0.35) 60%, rgba(11,31,23,0.2) 100%)")
    p = s.phone("p", 330, 76, f'<img src="{A}carnet-tmb.jpg" alt="" />')
    s.ft(p, {"rotationY": 34, "scale": 0.95, "transformOrigin": "50% 50%", "transformPerspective": PERSP},
         {"rotationY": -10, "duration": s.D, "ease": "sine.inOut"}, s.t0)
    ev(s.bar, 19, "le carnet du Tour du Mont-Blanc tourne dans l'espace (34° → −10°)")
    t = s.title("t", 1010, 330, "À six,", "un autre carnet", 100, chap="Carnets")
    s.title_in(t, s.bar - 0.04, 1, chap=True)
    s.cap("cap", "6 voyageurs", 1014, 590, s.bar + CAP_AT)
    s.to("#s19-ri", {"y": -1080, "filter": "blur(20px)", "duration": 0.3, "ease": "power3.in"}, bar(20))
    ev(bar(20), 20, "coupe : retrait — le plan s'arrache vers le haut, la 3D (kit3dCouleur) est dessous")
    return s


# 21 · L'empreinte : le profil réel et la carte de ses massifs (qui va devenir le globe).
MAP21 = (1060, 300, 720)


def map21_rect():
    x, y, w = MAP21
    sw, sh = size_of(C + "compte-carte.jpg")
    return x + 10, y + 10, x + 10 + w, y + 10 + round(w * sh / sw)


def s21():
    s = Shot(21, lead=0.3)
    s.enter("rise")
    s.bg_solid(f"radial-gradient(120% 120% at 60% 50%, #23523a 0%, {FOREST} 45%, {INK} 100%)")
    t = s.title("t", 110, 96, "Ton", "empreinte", 92, one_line=True, chap=None)
    s.title_in(t, s.bar - 0.04, 0)
    ev(s.bar, 21, "titre « Ton empreinte »")
    s.card("ent", C + "compte-entete.jpg", 110, 250, 820)
    s.ft("#s21-ent", {"opacity": 0, "y": 70}, {"opacity": 1, "y": 0, "duration": 0.6, "ease": "expo.out"}, s.bar - 0.05)
    s.card("map", C + "compte-carte.jpg", MAP21[0], MAP21[1], MAP21[2])
    s.ft("#s21-map", {"opacity": 0, "y": 90}, {"opacity": 1, "y": 0, "duration": 0.6, "ease": "expo.out"}, s.bar + 0.15)
    ev(s.bar + 0.15, 21, "la carte réelle des massifs de Léa")
    s.cap("cap", "24 sorties · 307 km", 114, 790, s.bar + CAP_AT)
    s.leave("blur", 0.35)
    return s


# 22 · Le globe : la carte de l'empreinte devient le globe réel ; Chili puis Japon dans les téléphones.
CHILI_OUT, JAPAN_IN = 1.60, 3.95     # temps de la vidéo (= temps local du plan)


def s22():
    s = Shot(22, lead=0.35)
    x0, y0, x1, y1 = map21_rect()
    s.ft("#s22-ri", {"clipPath": f"inset({y0}px {W - x1}px {H - y1}px {x0}px round 22px)"},
         {"clipPath": "inset(0px 0px 0px 0px round 0px)", "duration": 0.5, "ease": "power3.inOut"}, s.t0)
    ev(s.t0, 22, "coupe : grow — la carte de l'empreinte s'ouvre sur le globe réel (0,5 s)")
    s.add('<div class="wash" style="background: rgb(3,4,9)"></div>')
    s.video_full("glo", "assets/map/globe-chili-japon.mp4", 0, push=None)
    s.ft("#s22-glow", {"scale": 1.12}, {"scale": 1.0, "duration": 0.5, "ease": "power3.out"}, s.t0)
    p1 = s.phone("p1", 120, 76, f'<img src="{A}explorer-chili.jpg" alt="" />')
    s.ft(p1, {"opacity": 0, "scale": 0.9, "rotationY": 16, "transformOrigin": "50% 50%", "transformPerspective": PERSP},
         {"opacity": 1, "duration": 0.25, "ease": "power2.out"}, s.t0 + 0.3)
    s.to(p1, {"x": -760, "rotationY": 40, "duration": 0.45, "ease": "power3.in"}, s.t0 + CHILI_OUT)
    ev(s.t0 + 0.3, 22, "téléphone Explorer › Chili")
    ev(s.t0 + CHILI_OUT + 0.45, 22, "le Chili sort par la gauche quand l'Amérique du Sud quitte la face du globe")
    t = s.title("t", 110, 380, "Chaque voyage", "en prépare un autre", 76, chap="Explorer")
    s.title_in(t, s.t0 + 2.0, 0, chap=True)
    s.title_out(t, s.t0 + 4.55, chap=True)
    ev(s.t0 + 2.0, 22, "titre « Chaque voyage en prépare un autre » (jusqu'à 52,95 s)")
    p2 = s.phone("p2", 1356, 76, f'<img src="{A}explorer-japon.jpg" alt="" />')
    s.ft(p2, {"y": 1150, "scale": 0.9, "rotationY": -16, "rotationX": 18, "transformOrigin": "50% 50%", "transformPerspective": PERSP},
         {"y": 0, "rotationX": 0, "duration": 0.75, "ease": "expo.out"}, s.t0 + JAPAN_IN)
    ev(s.t0 + JAPAN_IN + 0.2, 22, "téléphone Japon posé (monte dès − 0,2 s) quand le Japon est de face")
    s.leave("dip")
    return s


# 23 · La marque : le badge se cale sur l'impact (54,575 s).
def s23():
    s = Shot(23)
    s.bg_img("assets/img/lkdv-bg-landscape.webp", wash="rgba(11,31,23,0.58)", push=(1.06, 1.0))
    s.add('<img id="s23-badge" src="assets/img/lkdv-badge.png" alt="" style="position:absolute; left:300px; top:290px; width:500px; height:500px" />')
    s.add('<div id="s23-name" style="position:absolute; left:880px; top:410px; color:#faf8f5; font-weight:800; font-size:110px; letter-spacing:-0.03em; white-space:nowrap">'
          + " ".join(f'<span class="w s23-n1">{w}</span>' for w in ("Le", "Kit", "du"))
          + ' <em style="font-family:\'EB Garamond\', serif; font-weight:500"><span class="w s23-n2">Voyageur</span></em></div>')
    s.add('<div id="s23-tag" style="position:absolute; left:888px; top:560px; color:#dfe8dc; font-weight:700; font-size:34px; letter-spacing:0.14em; text-transform:uppercase">Préparer · Explorer · Partager</div>')
    hit = s.bar + 0.2
    s.ft("#s23-badge", {"scale": 1.6, "opacity": 1, "rotation": -28}, {"scale": 1, "duration": 0.2, "ease": "power3.in"}, s.bar)
    s.ft("#s23-badge", {"rotation": -28}, {"rotation": 0, "duration": 1.4, "ease": "elastic.out(1, 0.45)"}, hit)
    s.ft(".s23-n1", {"opacity": 0, "filter": "blur(6px)"}, {"opacity": 1, "filter": "blur(0px)", "duration": 0.14, "stagger": 0.08, "ease": "power2.out"}, s.bar + 2 * BEAT)
    s.ft(".s23-n2", {"opacity": 0, "color": "#9fb59a"}, {"opacity": 1, "color": "#faf8f5", "duration": 0.25, "ease": "power1.out"}, s.bar + 3 * BEAT)
    s.ft("#s23-tag", {"opacity": 0, "filter": "blur(8px)"}, {"opacity": 1, "filter": "blur(0px)", "duration": 0.2, "ease": "power2.out"}, s.bar + 4 * BEAT)
    ev(s.bar, 23, "coupe : noir ; le badge, en grand, tombe")
    ev(hit, 23, "le badge se cale (impact)")
    ev(s.bar + 2 * BEAT, 23, "« Le Kit du » mot à mot (0,08 s d'écart)")
    ev(s.bar + 3 * BEAT, 23, "« Voyageur »")
    ev(s.bar + 4 * BEAT, 23, "« Préparer · Explorer · Partager »")
    ev(s.bar + 3.0, 23, "tout est immobile jusqu'à 60 s")
    return s


SHOTS = [s01, s03, s04, s05, s06, s07, s08, s09, s11, s12, s13, s14, s15, s16, s17, s18, s19, s21, s22, s23]
# Sous-compositions des autres agents (lecture seule) : (fichier, id, début, durée, plan).
SUBS = [("kit3d-taille.html", "kit3dTaille", bar(10), 2 * BAR, 10),
        ("kit3d-couleur.html", "kit3dCouleur", bar(20), BAR, 20),
        ("w-trace.html", "wTrace", 13.375, 3.5, 7)]


def main():
    film = os.path.join(ROOT, "compositions", "film")
    os.makedirs(film, exist_ok=True)
    shots = [f() for f in SHOTS]
    keep = {f"{s.sid}.html" for s in shots} | {x[0] for x in SUBS}
    for fn in os.listdir(film):  # anciens plans devenus inutiles (02, 10, 20)
        if fn.startswith("s") and fn.endswith(".html") and fn not in keep:
            os.remove(os.path.join(film, fn))
    hosts = []
    for i, s in enumerate(shots):
        with open(os.path.join(film, f"{s.sid}.html"), "w") as fh:
            fh.write(s.render())
        z = s.z if s.z else 10 + 2 * s.n
        hosts.append(f'      <div id="{s.sid}" class="clip" data-composition-id="{s.sid}" data-composition-src="compositions/film/{s.sid}.html" '
                     f'data-start="{round(s.t0, 4)}" data-duration="{round(s.D, 4)}" data-track-index="{1 + i % 2}" data-track-kind="graphics" '
                     f'data-width="1920" data-height="1080" style="z-index: {z}"></div>')
    for fn, cid, st, du, n in SUBS:
        if not os.path.exists(os.path.join(film, fn)):
            print(f"ATTENTION : {fn} absent (sous-composition {cid}) — hôte non monté", file=sys.stderr)
            continue
        z = {10: 10 + 2 * 10 - 1, 20: 10 + 2 * 20 - 1, 7: 10 + 2 * 7 - 1}[n]
        hosts.append(f'      <div id="{cid}" class="clip" data-composition-id="{cid}" data-composition-src="compositions/film/{fn}" '
                     f'data-start="{round(st, 4)}" data-duration="{round(du, 4)}" data-track-index="3" data-track-kind="graphics" '
                     f'data-width="1920" data-height="1080" style="z-index: {z}"></div>')
        ev(st, n, f"sous-composition {cid} ({du:.3f} s)")
    z_fl = 10 + 2 * 6 - 3
    flight = (f'      <video id="flight" class="clip" src="assets/map/w-patagonie.mp4" muted playsinline data-start="{round(FLIGHT_T0, 4)}" '
              f'data-duration="{FLIGHT_LEN}" data-track-index="5" style="position:absolute; left:0; top:0; width:1920px; height:1080px; object-fit:cover; z-index: {z_fl}"></video>\n'
              f'      <img id="flight-end" class="clip" src="assets/map/w-patagonie-end.jpg" alt="" data-start="{round(FLIGHT_T0 + FLIGHT_LEN - 0.05, 4)}" '
              f'data-duration="{round(bar(8) - (FLIGHT_T0 + FLIGHT_LEN - 0.05), 4)}" data-track-index="6" style="position:absolute; left:0; top:0; width:1920px; height:1080px; object-fit:cover; z-index: {z_fl}" />')
    ev(FLIGHT_T0, 6, "le vol satellite réel démarre sous l'iris (5 s)")
    ev(FLIGHT_T0 + 2.5, 7, "le vol se pose sur Torres del Paine")
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
    print("ok", len(shots), "compositions ;", len(SUBS), "sous-compositions ; flèche du Compas à", tuple(round(c) for c in arrow_xy()))
    if "--events" in sys.argv:
        for t, n, what in sorted(EVENTS):
            print(f"{t:7.3f}  {n:02d}  {what}")


if __name__ == "__main__":
    main()
