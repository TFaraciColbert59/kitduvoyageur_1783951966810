#!/usr/bin/env python3
"""Génère les poses du storyboard (compositions/frames/*.html + index.html posé),
STORYBOARD.md et boards/storyboard.html à partir de boards/frames.py."""
import html
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from frames import FRAMES  # noqa: E402

E = html.escape

BASE_CSS = """
    #root { position: absolute; inset: 0; overflow: hidden; font-family: "Inter", sans-serif; background: #17402c; }
    .bg { position: absolute; inset: 0; }
    .bg img { width: 1920px; height: 1080px; object-fit: cover; }
    .shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(11,31,23,0.74) 0%, rgba(11,31,23,0.42) 52%, rgba(11,31,23,0.12) 100%); }
    .chapter { position: absolute; left: 124px; top: 230px; color: #dfe8dc; font-weight: 700; font-size: 26px; letter-spacing: 0.14em; text-transform: uppercase; }
    .title { position: absolute; left: 120px; top: 276px; width: 900px; color: #faf8f5; font-weight: 800; font-size: 96px; line-height: 1.02; letter-spacing: -0.03em; }
    .title em { font-family: "EB Garamond", Georgia, serif; font-style: italic; font-weight: 500; }
    .cap { position: absolute; left: 124px; top: 600px; display: flex; align-items: center; gap: 16px; padding: 16px 28px; border-radius: 999px; background: rgba(250,248,245,0.9); color: #17402c; font-size: 32px; font-weight: 700; }
    .cap i { width: 14px; height: 14px; border-radius: 50%; background: #5b7f55; }
    .phone { position: absolute; left: 1180px; top: 70px; width: 444px; height: 940px; border-radius: 70px; background: #0b1f17; padding: 16px; box-shadow: 0 40px 90px rgba(11,31,23,0.55); }
    .screen { width: 412px; height: 908px; border-radius: 56px; overflow: hidden; background: #faf8f5; }
    .screen img { width: 412px; height: 908px; object-fit: cover; object-position: top; }
    .panel { position: absolute; right: 120px; top: 140px; width: 760px; padding: 34px 36px; border-radius: 36px; background: rgba(250,248,245,0.86); backdrop-filter: blur(24px) saturate(1.5); border: 1px solid rgba(255,255,255,0.85); box-shadow: 0 30px 70px rgba(11,31,23,0.35); color: #1f2a24; }
    .ptitle { font-size: 40px; font-weight: 800; color: #17402c; }
    .tabs { display: flex; gap: 6px; margin-top: 20px; padding: 6px; border-radius: 999px; background: rgba(31,42,36,0.06); }
    .tabs div { flex: 1; text-align: center; padding: 12px 0; border-radius: 999px; font-size: 24px; font-weight: 600; }
    .tabs .on { background: rgba(91,127,85,0.22); font-weight: 800; color: #17402c; }
    .row { display: flex; justify-content: space-between; gap: 20px; padding: 22px 4px; border-bottom: 1px solid rgba(31,42,36,0.1); font-size: 32px; }
    .row b { color: #17402c; }
    .row span { color: #4a5a51; font-weight: 600; }
    .foot { margin-top: 20px; font-size: 24px; color: #4a5a51; }
    .wall { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; padding: 40px; background: #17402c; }
    .wall div { border-radius: 22px; overflow: hidden; background: #0b1f17; }
    .wall img { width: 100%; height: 100%; object-fit: cover; object-position: top; opacity: 0.55; }
    .claim { position: absolute; left: 0; right: 0; top: 380px; text-align: center; color: #faf8f5; font-weight: 800; font-size: 132px; line-height: 1.02; letter-spacing: -0.035em; text-shadow: 0 8px 40px rgba(11,31,23,0.8); }
    .claim em { font-family: "EB Garamond", Georgia, serif; font-style: italic; font-weight: 500; }
    .feedbg { position: absolute; inset: 0; background: linear-gradient(180deg, #e9efe6 0%, #f4f1ea 100%); }
    .post { position: absolute; width: 520px; border-radius: 30px; background: #fff; box-shadow: 0 24px 60px rgba(11,31,23,0.18); overflow: hidden; }
    .post .ph { width: 520px; height: 560px; object-fit: cover; display: block; }
    .post .hd { display: flex; align-items: center; gap: 14px; padding: 18px 20px; }
    .av { width: 54px; height: 54px; border-radius: 50%; background: #5b7f55; color: #fff; font-weight: 800; font-size: 24px; display: flex; align-items: center; justify-content: center; }
    .post .who { font-size: 24px; font-weight: 800; color: #17402c; }
    .post .tx { padding: 0 20px 6px; font-size: 26px; font-weight: 700; color: #1f2a24; }
    .post .ft { display: flex; justify-content: space-between; padding: 10px 20px 20px; font-size: 22px; color: #5b6b61; font-weight: 600; }
    .post .chip { padding: 6px 14px; border-radius: 999px; background: rgba(91,127,85,0.18); color: #17402c; }
    .headline { position: absolute; left: 120px; top: 780px; color: #17402c; font-weight: 800; font-size: 104px; line-height: 1.0; letter-spacing: -0.035em; }
    .headline em { font-family: "EB Garamond", Georgia, serif; font-style: italic; font-weight: 500; }
    .tap { position: absolute; width: 90px; height: 90px; border-radius: 50%; background: rgba(250,248,245,0.55); border: 4px solid #faf8f5; box-shadow: 0 8px 24px rgba(11,31,23,0.3); }
    .chat { position: absolute; right: 160px; top: 170px; width: 640px; padding: 28px; border-radius: 40px; background: rgba(250,248,245,0.9); backdrop-filter: blur(24px); box-shadow: 0 30px 70px rgba(11,31,23,0.35); }
    .chat .h { font-size: 30px; font-weight: 800; color: #17402c; margin-bottom: 18px; }
    .bub { max-width: 470px; margin: 12px 0; padding: 18px 24px; border-radius: 28px; font-size: 30px; font-weight: 600; }
    .bub small { display: block; font-size: 20px; color: #5b6b61; font-weight: 700; margin-bottom: 4px; }
    .me { margin-left: auto; background: #17402c; color: #faf8f5; border-bottom-right-radius: 8px; }
    .me small { color: #cfe0cc; }
    .them { background: #fff; color: #1f2a24; border-bottom-left-radius: 8px; }
    .banner { position: absolute; right: 150px; top: 60px; display: flex; gap: 16px; align-items: center; width: 640px; padding: 18px 22px; border-radius: 28px; background: rgba(250,248,245,0.92); backdrop-filter: blur(24px); box-shadow: 0 18px 40px rgba(11,31,23,0.3); }
    .banner .av { width: 50px; height: 50px; font-size: 22px; flex: none; }
    .banner b { display: block; font-size: 22px; color: #17402c; }
    .banner span { font-size: 26px; color: #1f2a24; font-weight: 600; }
    .prod { position: absolute; right: 120px; top: 110px; width: 820px; border-radius: 36px; background: rgba(250,248,245,0.94); box-shadow: 0 30px 70px rgba(11,31,23,0.35); overflow: hidden; display: grid; grid-template-columns: 330px 1fr; }
    .prod img { width: 330px; height: 100%; object-fit: cover; }
    .prod .in { padding: 30px; }
    .prod .nm { font-size: 36px; font-weight: 800; color: #17402c; }
    .prod .sp { font-size: 24px; color: #4a5a51; margin: 8px 0 18px; }
    .off { display: flex; justify-content: space-between; padding: 16px 18px; margin-top: 10px; border-radius: 20px; background: #fff; font-size: 28px; }
    .off b { color: #17402c; }
    .off span { color: #4a5a51; font-weight: 600; }
    .dot { position: absolute; width: 64px; height: 64px; border-radius: 50%; background: #17402c; border: 5px solid #faf8f5; color: #faf8f5; font-weight: 800; font-size: 26px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 14px rgba(91,127,85,0.35); }
    .ovl { position: absolute; left: 120px; bottom: 150px; padding: 22px 30px; border-radius: 28px; background: rgba(250,248,245,0.92); box-shadow: 0 18px 40px rgba(11,31,23,0.3); }
    .ovl b { display: block; font-size: 24px; color: #5b7f55; letter-spacing: 0.08em; text-transform: uppercase; }
    .ovl span { font-size: 40px; font-weight: 800; color: #17402c; }
    .arcs { position: absolute; inset: 0; }
    .illus { position: absolute; right: 40px; bottom: 28px; padding: 6px 14px; border-radius: 999px; background: rgba(11,31,23,0.8); color: #faf8f5; font-size: 18px; font-weight: 600; letter-spacing: 0.06em; }
    .vision { position: absolute; left: 40px; top: 32px; padding: 8px 16px; border-radius: 999px; border: 2px dashed rgba(250,248,245,0.8); color: #faf8f5; font-size: 20px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; background: rgba(11,31,23,0.35); }
    .slot { width: 412px; height: 908px; border-radius: 56px; background: repeating-linear-gradient(135deg, #f4f1ea 0 22px, #ece7dd 22px 44px); display: flex; flex-direction: column; justify-content: center; gap: 18px; padding: 40px; color: #17402c; }
    .slot .lab { align-self: flex-start; padding: 6px 14px; border-radius: 999px; border: 2px dashed #a63d2f; color: #a63d2f; font-size: 18px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
    .slot b { font-size: 36px; line-height: 1.1; }
    .slot span { font-size: 26px; color: #4a5a51; font-weight: 600; }
    .compas { position: absolute; inset: 0; background: #faf8f5; }
    .compas .q { position: absolute; left: 240px; top: 230px; font-size: 92px; font-weight: 800; color: #17402c; letter-spacing: -0.03em; }
    .compas .q em { font-family: "EB Garamond", Georgia, serif; font-style: italic; font-weight: 500; }
    .compas .steps { position: absolute; left: 240px; top: 120px; display: flex; gap: 10px; }
    .compas .steps div { padding: 10px 22px; border-radius: 999px; font-size: 22px; font-weight: 700; color: #5b6b61; background: rgba(31,42,36,0.06); }
    .compas .steps .on { background: #17402c; color: #faf8f5; }
    .compas .field { position: absolute; left: 240px; top: 420px; width: 1440px; padding: 40px 44px; border-radius: 36px; background: #fff; box-shadow: 0 20px 50px rgba(11,31,23,0.12); font-size: 46px; font-weight: 600; color: #1f2a24; line-height: 1.25; }
    .compas .field i { display: inline-block; width: 4px; height: 52px; background: #17402c; vertical-align: -8px; margin-left: 4px; }
    .compas .go { position: absolute; left: 240px; top: 700px; padding: 30px 54px; border-radius: 999px; background: #17402c; color: #faf8f5; font-size: 38px; font-weight: 800; box-shadow: 0 0 0 12px rgba(91,127,85,0.25); }
    .checks { margin-top: 18px; }
    .chk { display: flex; align-items: center; gap: 18px; padding: 14px 4px; font-size: 34px; font-weight: 700; color: #17402c; }
    .chk i { width: 40px; height: 40px; border-radius: 50%; background: #5b7f55; color: #fff; font-style: normal; font-size: 26px; display: flex; align-items: center; justify-content: center; }
    .ok { margin-top: 18px; padding-top: 14px; border-top: 2px solid rgba(31,42,36,0.1); font-size: 22px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #5b7f55; }
    .pin { position: absolute; transform: translate(-50%, -50%); width: 26px; height: 26px; border-radius: 50%; background: #faf8f5; border: 6px solid #17402c; }
    .pinl { position: absolute; padding: 6px 14px; border-radius: 999px; background: rgba(250,248,245,0.92); color: #17402c; font-size: 22px; font-weight: 700; white-space: nowrap; }
    .line { position: absolute; left: 120px; top: 560px; padding: 18px 30px; border-radius: 28px; background: rgba(250,248,245,0.92); color: #17402c; font-size: 32px; font-weight: 700; }
    .pill { position: absolute; left: 124px; top: 560px; padding: 14px 26px; border-radius: 999px; background: rgba(250,248,245,0.92); color: #17402c; font-size: 28px; font-weight: 700; }
    .btn { margin-top: 24px; padding: 22px 0; text-align: center; border-radius: 999px; background: #17402c; color: #faf8f5; font-size: 32px; font-weight: 800; }
    .soon { display: inline-block; margin-left: 14px; padding: 6px 16px; border-radius: 999px; border: 2px dashed #17402c; font-size: 22px; vertical-align: 8px; }
    .stag { position: absolute; left: 120px; bottom: 120px; padding: 16px 28px; border-radius: 28px; background: rgba(250,248,245,0.92); color: #17402c; font-size: 32px; font-weight: 800; }
    .prev { display: flex; gap: 14px; align-items: center; margin-top: 10px; padding: 10px; border-radius: 20px; background: rgba(250,248,245,0.14); }
    .prev img { width: 120px; height: 84px; border-radius: 14px; object-fit: cover; }
    .prev span { font-size: 22px; font-weight: 700; }
"""


def post_card(p, x, y, w=520, h=560, style=""):
    ini, who, tx, img, chip, likes = p
    return (f'<div class="post" style="left:{x}px; top:{y}px; width:{w}px;{style}"><div class="hd"><div class="av">{E(ini)}</div><div class="who">{E(who)}</div></div>'
            f'<img class="ph" src="{img}" alt="" style="width:{w}px; height:{h}px" /><div class="tx">{E(tx)}</div>'
            f'<div class="ft"><span class="chip">{E(chip)}</span><span>♥ {E(likes)}</span></div></div>')


def w_svg(f):
    from frames import W_PATH, W_PINS
    pts = " ".join(f"{x},{y}" for x, y in W_PATH)
    s = (f'<svg class="arcs" viewBox="0 0 1920 1080"><polyline points="{pts}" fill="none" stroke="#faf8f5" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.9" />'
         f'<polyline points="{pts}" fill="none" stroke="#17402c" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" /></svg>')
    if f.get("pins"):
        for name, x, y, (dx, dy) in W_PINS:
            s += f'<div class="pin" style="left:{x}px; top:{y}px"></div><div class="pinl" style="left:{x + dx}px; top:{y + dy}px">{E(name)}</div>'
    return s


def extra_kind(f):
    k = f["kind"]
    if k == "feed":
        body = '<div class="feedbg"></div>'
        a, b = f["side"]
        body += post_card(a, 1140, -560, style="opacity:0.85")
        body += post_card(f["center"], 1140, 150)
        body += post_card(b, 1140, 1000, style="opacity:0.85")
        body += f'<div class="headline" style="top:380px; width:900px">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>'
        return body
    if k == "phoneslot":
        lines = f["slot"]
        slot = (f'<div class="slot"><div class="lab" data-layout-ignore>Capture à faire</div><b>{E(lines[0])}</b>'
                + "".join(f"<span>{E(t)}</span>" for t in lines[1:]) + "</div>")
        return (f'<div class="bg"><img src="{f["bg"]}" alt="" /></div><div class="shade"></div>'
                f'<div class="chapter">{E(f["chapter"])}</div>'
                f'<div class="title">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>'
                f'<div class="cap"><i></i>{E(f["cap"])}</div>'
                f'<div class="phone" style="top:{150 if f.get("msg") else 70}px">{slot}</div>')
    if k == "compas":
        steps = "".join(f'<div class="{"on" if i == 0 else ""}">{s}</div>' for i, s in enumerate(["Où", "Nous", "Résa", "Verdict", "Kit"]))
        return (f'<div class="compas"><div class="steps">{steps}</div><div class="q">Où veux-tu <em>aller ?</em></div>'
                f'<div class="field">{E(f["phrase"])}<i></i></div><div class="go">Préparer mon aventure</div>'
                f'<div class="tap" style="left:640px; top:700px"></div></div>')
    if k == "prep":
        checks = "".join(f'<div class="chk"><i>✓</i>{E(c)}</div>' for c in f["checks"])
        rows = "".join(f'<div class="row"><b>{E(a)}</b><span>{E(b)}</span></div>' for a, b in f["rows"])
        return (f'<div class="bg"><img src="{f["bg"]}" alt="" /></div><div class="shade"></div>'
                f'<div class="chapter">{E(f["chapter"])}</div><div class="title" style="width:780px">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>'
                f'<div class="panel"><div class="ptitle">Préparation</div><div class="checks">{checks}</div>'
                f'<div class="ok">Voici ce que j\'ai compris</div>{rows}</div>')
    if k == "map":
        from frames import MAP
        body = f'<div class="bg"><img src="{MAP}" alt="" /></div><div class="shade" style="opacity:0.7"></div>'
        if f.get("path"):
            body += w_svg(f)
        for l, x, y in f.get("dots", []):
            body += f'<div class="dot" style="left:{x - 32}px; top:{y - 32}px">{E(l)}</div>'
        body += (f'<div class="chapter" style="top:180px">{E(f["chapter"])}</div>'
                 f'<div class="title" style="top:226px; width:780px">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>')
        if f.get("line"):
            body += f'<div class="line" style="left:1120px; top:960px">{E(f["line"])}</div>'
        if f.get("pill"):
            body += f'<div class="pill" style="left:1120px; top:960px">{E(f["pill"])}</div>'
        return body
    if k == "sunrise":
        return f'<div class="bg"><img src="{f["img"]}" alt="" /></div>'
    if k == "globe":
        import math
        def proj(lon, lat, lon0=-35.0, lat0=8.0, R=252, cx=960, cy=540):
            l, p, l0, p0 = map(math.radians, (lon, lat, lon0, lat0))
            x = cx + R * math.cos(p) * math.sin(l - l0)
            y = cy - R * (math.cos(p0) * math.sin(p) - math.sin(p0) * math.cos(p) * math.cos(l - l0))
            return round(x), round(y)
        pts = {"Québec": proj(-71.2, 46.8), "Lyon": proj(4.85, 45.76), "Le W": proj(-73.0, -51.0), "Osaka →": (1300, 330)}
        arcs = ""
        for a, b in [("Québec", "Le W"), ("Lyon", "Le W"), ("Lyon", "Osaka →")]:
            (x1, y1), (x2, y2) = pts[a], pts[b]
            arcs += f'<path d="M{x1} {y1} Q {(x1 + x2) // 2 + 140} {(y1 + y2) // 2 - 120} {x2} {y2}" fill="none" stroke="#faf8f5" stroke-width="4" stroke-opacity="0.9" stroke-linecap="round" stroke-dasharray="2 12" />'
        lab = ""
        for n, (x, y) in pts.items():
            arcs += f'<circle cx="{x}" cy="{y}" r="10" fill="#faf8f5" />'
            lab += f'<div class="pinl" style="left:{x + 18}px; top:{y - 50}px">{E(n)}</div>'
        return (f'<div class="bg"><img src="{f["bg"]}" alt="" /></div>'
                f'<svg class="arcs" viewBox="0 0 1920 1080">{arcs}</svg>{lab}'
                f'<div class="claim" style="top:850px; font-size:84px">{E(f["title"])} <em>{E(f["em"])}</em></div>')
    raise ValueError(k)


def frame_html(f):
    fid = f"f{f['n']:02d}"
    k = f["kind"]
    if k == "still":
        if f.get("fit") == "contain":
            body = f'<div class="bg" style="background:#eeeae3"><img src="{f["img"]}" alt="" style="object-fit:contain" /></div>'
        else:
            body = f'<div class="bg"><img src="{f["img"]}" alt="" /></div>'
    elif k == "phone":
        shots = f.get("shots") or [f["shot"]]
        pos = "bottom" if f.get("pos") == "bottom" else "top"
        xs = [1190] if len(shots) == 1 else [980, 1430]
        ys = [70] if len(shots) == 1 else [110, 40]
        phones = ""
        for j, (sh, x, y) in enumerate(zip(shots, xs, ys)):
            tap = ""
            if f.get("tap") and j == len(shots) - 1:
                tx, ty = f["tap"]
                tap = f'<div class="tap" style="left:{x + 16 + round(412 * tx) - 45}px; top:{y + 16 + round(908 * ty) - 45}px"></div>'
            phones += (f'<div class="phone" style="left:{x}px; top:{y}px"><div class="screen"><img src="{sh}" alt="" '
                       f'style="object-position:{pos}" /></div></div>{tap}')
        head = ""
        if f.get("title"):
            head = (f'<div class="chapter">{E(f.get("chapter", ""))}</div>'
                    f'<div class="title" style="width:{820 if len(shots) == 1 else 760}px">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>')
        cap = f'<div class="cap"><i></i>{E(f["cap"])}</div>' if f.get("cap") else ""
        shade = '<div class="shade"></div>' if f.get("title") else ""
        body = f'<div class="bg"><img src="{f["bg"]}" alt="" /></div>{shade}{head}{cap}{phones}'
    elif k == "glass":
        tabs = ""
        if f.get("tabs"):
            tabs = '<div class="tabs">' + "".join(
                f'<div class="{"on" if i == 0 else ""}">{E(t)}</div>' for i, t in enumerate(f["tabs"])) + "</div>"
        rows = "".join(f'<div class="row"><b>{E(a)}</b><span>{E(b)}</span></div>' for a, b in f["rows"])
        foot = f'<div class="foot">{E(f["foot"])}</div>' if f.get("foot") else ""
        soon = f'<span class="soon">{E(f["pill"])}</span>' if f.get("pill") else ""
        btn = f'<div class="btn">{E(f["button"])}</div>' if f.get("button") else ""
        body = (
            f'<div class="bg"><img src="{f["bg"]}" alt="" /></div><div class="shade"></div>'
            f'<div class="chapter">{E(f.get("chapter", ""))}</div>'
            f'<div class="title" style="width:780px">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>'
            f'<div class="panel" style="top:{230 if f.get("msg") else 140}px"><div class="ptitle">{E(f["panel_title"])}{soon}</div>{tabs}{rows}{foot}{btn}</div>'
        )
    elif k == "wall":
        cells = "".join(f'<div><img src="{s}" alt="" /></div>' for s in f["shots"])
        body = (f'<div class="wall">{cells}</div>'
                f'<div class="claim">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>')
    elif k == "feed3":
        xs = [120, 700, 1280]
        cards = ""
        for (ini, who, tx, img, chip, likes), x, y in zip(f["posts"], xs, [60, 20, 80]):
            cards += (f'<div class="post" style="left:{x}px; top:{y}px"><div class="hd"><div class="av">{E(ini)}</div><div class="who">{E(who)}</div></div>'
                      f'<img class="ph" src="{img}" alt="" style="height:420px" /><div class="tx">{E(tx)}</div>'
                      f'<div class="ft"><span class="chip">{E(chip)}</span><span>♥ {E(likes)}</span></div></div>')
        body = (f'<div class="feedbg"></div>{cards}'
                f'<div class="headline" style="top:820px; color:#17402c">{E(f["title"])} <em>{E(f["em"])}</em></div>')
    elif k == "feed1":
        ini, who, tx, img, chip, likes = f["post"]
        body = (f'<div class="bg"><img src="{img}" alt="" style="filter: blur(30px)" /></div><div class="shade"></div>'
                f'<div class="post" style="left:700px; top:90px; width:560px"><div class="hd"><div class="av">{E(ini)}</div><div class="who">{E(who)}</div></div>'
                f'<img class="ph" src="{img}" alt="" style="width:560px; height:620px" /><div class="tx">{E(tx)}</div>'
                f'<div class="ft"><span class="chip">{E(chip)}</span><span>♥ {E(likes)}</span></div></div>'
                f'<div class="tap" style="left:{f.get("tapx", 940)}px; top:430px"></div>')
    elif k == "chat":
        bubs = ""
        for j, (w, t, c) in enumerate(f["msgs"]):
            pv = ""
            if j == 0 and f.get("preview"):
                pv = f'<div class="prev"><img src="{f["preview"][1]}" alt="" /><span>{E(f["preview"][0])}</span></div>'
            bubs += f'<div class="bub {c}"><small>{E(w)}</small>{E(t)}{pv}</div>'
        body = (f'<div class="bg"><img src="{f["bg"]}" alt="" /></div><div class="shade"></div>'
                f'<div class="title" style="width:760px">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>'
                f'<div class="chat"><div class="h">{E(f.get("head", ""))}</div>{bubs}</div>')
    elif k == "product":
        nm, sp = f["product"][:2]
        img = f["product"][2] if len(f["product"]) > 2 else None
        offs = "".join(f'<div class="off"><b>{E(a)}</b><span>{E(b)}</span></div>' for a, b in f["offers"])
        body = (f'<div class="bg"><img src="{f["bg"]}" alt="" /></div><div class="shade"></div>'
                f'<div class="chapter">{E(f["chapter"])}</div><div class="title" style="width:760px">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>'
                f'<div class="prod">{f'<img src="{img}" alt="" />' if img else '<div class="slot" style="width:330px; height:auto; border-radius:0; padding:28px"><div class="lab" data-layout-ignore>Photo produit à fournir</div></div>'}<div class="in"><div class="nm">{E(nm)}</div><div class="sp">{E(sp)}</div>{offs}</div></div>')
    elif k == "live":
        dots = "".join(f'<div class="dot" style="left:{x}px; top:{y}px">{E(l)}</div>' for l, x, y in f["dots"])
        body = (f'<div class="bg"><img src="{f["bg"]}" alt="" /></div><div class="shade"></div>{dots}'
                f'<div class="chapter">{E(f["chapter"])}</div><div class="title" style="width:760px">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>')
    elif k == "arcs":
        paths = "".join(f'<path d="M{a} {b} Q {(a+c)//2} {min(b,d)-260} {c} {d}" fill="none" stroke="#faf8f5" stroke-width="4" stroke-opacity="0.8" stroke-linecap="round" /><circle cx="{c}" cy="{d}" r="10" fill="#faf8f5" />'
                        for a, b, c, d in [(560, 860, 980, 420), (980, 420, 1500, 520), (1500, 520, 1700, 820), (980, 420, 300, 500), (560, 860, 1180, 760), (300, 500, 700, 300)])
        body = (f'<div class="bg"><img src="{f["bg"]}" alt="" style="filter: saturate(0.8) brightness(0.7)" /></div>'
                f'<svg class="arcs" viewBox="0 0 1920 1080">{paths}</svg>'
                f'<div class="claim" style="top:400px">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>')
    else:
        body = extra_kind(f)
    if f.get("tag"):
        body += f'<div class="stag">{E(f["tag"])}</div>'
    if f.get("overlay"):
        a, b = f["overlay"]
        body += f'<div class="ovl"><b>{E(a)}</b><span>{E(b)}</span></div>'
    if f.get("msg"):
        who, txt = f["msg"]
        body += f'<div class="banner"><div class="av">{E(who[0])}</div><div><b>{E(who)}</b><span>{E(txt)}</span></div></div>'
    if f.get("illus"):
        body += '<div class="illus" data-layout-ignore>Données illustratives</div>'
    if f.get("status") == "vision":
        body += '<div class="vision" data-layout-ignore>Vue imaginée</div>'

    return f"""<template>
  <style>{BASE_CSS}  </style>
  <div id="root" data-composition-id="{fid}" data-width="1920" data-height="1080">
    {body}
  </div>
  <script>
    window.__timelines["{fid}"] = gsap.timeline({{ paused: true }});
  </script>
</template>
"""


def main():
    os.makedirs(os.path.join(ROOT, "compositions", "frames"), exist_ok=True)
    hosts = []
    for i, f in enumerate(FRAMES):
        fid = f"f{f['n']:02d}"
        with open(os.path.join(ROOT, "compositions", "frames", f"{fid}.html"), "w") as fh:
            fh.write(frame_html(f))
        d = round(f["end"] - f["start"], 4)
        hosts.append(
            f'      <div id="{fid}" data-composition-id="{fid}" data-composition-src="compositions/frames/{fid}.html" '
            f'data-start="{f["start"]}" data-duration="{d}" data-track-index="1" data-track-kind="graphics" '
            f'data-width="1920" data-height="1080" style="z-index: {i + 1}"></div>')
    total = FRAMES[-1]["end"]
    index = f"""<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>LKDV — film complet (storyboard posé)</title>
    <script src="assets/lib/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #17402c; }}
      #root {{ position: relative; width: 1920px; height: 1080px; overflow: hidden; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1920" data-height="1080">
{chr(10).join(hosts)}
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
    # snapshot times (milieu de chaque plan)
    times = [round((f["start"] + f["end"]) / 2, 3) for f in FRAMES]
    with open(os.path.join(HERE, "times.txt"), "w") as fh:
        fh.write(",".join(str(t) for t in times))
    print(",".join(str(t) for t in times))


if __name__ == "__main__":
    main()
