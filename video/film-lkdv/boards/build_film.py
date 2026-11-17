#!/usr/bin/env python3
"""Génère le film animé (index.html + compositions/film/sNN.html) depuis boards/frames.py.

Écrans réels uniquement (assets/app). 128 BPM : 1 temps = 0,46875 s, 1 mesure = 1,875 s.
Mouvements : arrivées longues (expo.out), sorties courtes (power3.in) en fouet vers la gauche,
titres mot par mot en flou, un iris depuis le clic du Compas (plan 05 → 06), le vol satellite
réel sous les plans 06-07, une demi-mesure de silence avant le lever de soleil (plan 16)."""
import html
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from frames import FRAMES, BAR  # noqa: E402
from film_audio import audio_clips  # noqa: E402

E = html.escape
BEAT = BAR / 4
A = "assets/app/"

# Séquences d'écrans réels dans un même téléphone : [(image, temps d'apparition dans le plan)].
SEQ = {
    1: [[(A + "feed-1.jpg", 0), (A + "feed-3.jpg", 1.9)], [(A + "feed-2.jpg", 0), (A + "feed-4.jpg", 2.35)]],
    5: [[(A + "compas-vide.jpg", 0), (A + "compas-phrase.jpg", 0.42)]],
    6: [[(A + "compas-clic.jpg", 0), (A + "compas-prep.jpg", 0.47), (A + "compas-pret.jpg", 1.17)]],
    22: [[(A + "explorer-chili.jpg", 0)], [(A + "explorer-japon.jpg", 0)]],
}
# Plans posés sur le vol satellite (fond transparent).
OVER_FLIGHT = {6, 7}
# Lead : le plan commence avant la barre pour une transition (iris).
LEAD = {6: 0.35}

CSS = """
    #root { position: absolute; inset: 0; overflow: hidden; font-family: "Inter", sans-serif; }
    .bgw { position: absolute; inset: -40px; }
    .bgw img { width: 2000px; height: 1160px; object-fit: cover; }
    .shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(11,31,23,0.78) 0%, rgba(11,31,23,0.45) 50%, rgba(11,31,23,0.12) 100%); }
    .chapter { position: absolute; left: 124px; top: 232px; color: #dfe8dc; font-weight: 700; font-size: 28px; letter-spacing: 0.14em; text-transform: uppercase; }
    .title { position: absolute; left: 120px; top: 280px; width: 820px; color: #faf8f5; font-weight: 800; font-size: 100px; line-height: 1.02; letter-spacing: -0.03em; }
    .title em { font-family: "EB Garamond", serif; font-style: italic; font-weight: 500; }
    .w { display: inline-block; }
    .cap { position: absolute; left: 124px; top: 606px; display: flex; align-items: center; gap: 16px; padding: 16px 28px; border-radius: 999px; background: rgba(250,248,245,0.92); color: #17402c; font-size: 32px; font-weight: 700; box-shadow: 0 16px 40px rgba(11,31,23,0.25); }
    .cap i { width: 14px; height: 14px; border-radius: 50%; background: #5b7f55; }
    .phone { position: absolute; width: 444px; height: 940px; border-radius: 70px; background: #0b1f17; padding: 16px; box-shadow: 0 40px 90px rgba(11,31,23,0.55); }
    .screen { position: relative; width: 412px; height: 908px; border-radius: 56px; overflow: hidden; background: #faf8f5; }
    .screen img { position: absolute; inset: 0; width: 412px; height: 908px; object-fit: cover; object-position: top; }
    .tap { position: absolute; width: 84px; height: 84px; border-radius: 50%; background: rgba(250,248,245,0.6); border: 4px solid #faf8f5; box-shadow: 0 8px 24px rgba(11,31,23,0.35); opacity: 0; }
    .end-bg img { filter: none; }
"""


def words(text, cls):
    return " ".join(f'<span class="w {cls}">{E(t)}</span>' for t in text.split())


def phone_scene(f, sid, dur):
    n = f["n"]
    seqs = SEQ.get(n) or [[(s, 0)] for s in f.get("shots", [])]
    pos = "bottom" if f.get("pos") == "bottom" else "top"
    if len(seqs) == 1:
        xs, ys = [1190], [70]
    else:
        xs, ys = [980, 1430], [110, 40]
    out, tl = [], []
    # Fond : le vol satellite passe dessous pour 06-07 ; sinon une image qui dérive.
    if n not in OVER_FLIGHT:
        out.append(f'<div class="bgw" id="{sid}-bg"><img src="{f["bg"]}" alt="" /></div>')
        tl.append(f'tl.fromTo("#{sid}-bg", {{ x: -36, scale: 1.04 }}, {{ x: 0, scale: 1.0, duration: {dur:.3f}, ease: "none" }}, 0);')
    if f.get("title"):
        out.append('<div class="shade"></div>')
    lead = LEAD.get(n, 0.0)
    t0 = lead + 0.08
    if f.get("title"):
        out.append(f'<div class="chapter" id="{sid}-ch">{E(f.get("chapter", ""))}</div>')
        out.append(f'<div class="title" id="{sid}-ti">{words(f["title"], sid + "-t1")}<br /><em>{words(f["em"], sid + "-t2")}</em></div>')
        tl.append(f'tl.fromTo("#{sid}-ch", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.18, ease: "power2.out" }}, {t0:.3f});')
        tl.append(f'tl.fromTo(".{sid}-t1", {{ opacity: 0, filter: "blur(6px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.14, stagger: 0.067, ease: "power2.out" }}, {t0 + 0.12:.3f});')
        tl.append(f'tl.fromTo(".{sid}-t2", {{ opacity: 0.25, color: "#9fb59a" }}, {{ opacity: 1, color: "#faf8f5", duration: 0.2, stagger: 0.09, ease: "power1.out" }}, {t0 + 0.42:.3f});')
    if f.get("cap"):
        out.append(f'<div class="cap" id="{sid}-cap"><i></i>{E(f["cap"])}</div>')
        tl.append(f'tl.fromTo("#{sid}-cap", {{ opacity: 0, x: -24 }}, {{ opacity: 1, x: 0, duration: 0.55, ease: "expo.out" }}, {t0 + 0.75:.3f});')
    for j, (seq, x, y) in enumerate(zip(seqs, xs, ys)):
        pid = f"{sid}-p{j}"
        imgs = ""
        for k, (src, at) in enumerate(seq):
            iid = f"{pid}-i{k}"
            imgs += f'<img id="{iid}" src="{src}" alt="" style="object-position:{pos}" />'
            if k > 0:
                tl.append(f'tl.fromTo("#{iid}", {{ opacity: 0, filter: "blur(8px)" }}, {{ opacity: 1, filter: "blur(0px)", duration: 0.16, ease: "power2.out" }}, {lead + at:.3f});')
        out.append(f'<div class="phone" id="{pid}" style="left:{x}px; top:{y}px"><div class="screen">{imgs}</div></div>')
        arrive = lead + 0.02 + 0.12 * j
        if n == 3:  # match cut : l'écran touché arrive un peu grand et se pose
            tl.append(f'tl.fromTo("#{pid}", {{ scale: 1.14, opacity: 0.4 }}, {{ scale: 1, opacity: 1, duration: 0.6, ease: "expo.out" }}, {arrive:.3f});')
        else:
            tl.append(f'tl.fromTo("#{pid}", {{ x: 280, opacity: 0, filter: "blur(10px)" }}, {{ x: 0, opacity: 1, filter: "blur(0px)", duration: 0.6, ease: "expo.out" }}, {arrive:.3f});')
        if f.get("tap") and j == len(seqs) - 1:
            tx, ty = f["tap"]
            tid = f"{sid}-tap"
            out.append(f'<div class="tap" id="{tid}" style="left:{x + 16 + round(412 * tx) - 42}px; top:{y + 16 + round(908 * ty) - 42}px"></div>')
            at = lead + dur - lead - 0.55 if n != 5 else lead + 1.42
            tl.append(f'tl.fromTo("#{tid}", {{ opacity: 0, scale: 1.25 }}, {{ opacity: 1, scale: 1, duration: 0.18, ease: "power2.out" }}, {at:.3f});')
            tl.append(f'tl.to("#{tid}", {{ scale: 0.82, duration: 0.09, ease: "power2.in" }}, {at + 0.2:.3f});')
            tl.append(f'tl.to("#{tid}", {{ opacity: 0, scale: 1, duration: 0.12, ease: "power2.out" }}, {at + 0.3:.3f});')
    # Sortie en fouet (sauf avant l'iris, le lever de soleil et la fin).
    end = lead + dur
    if n not in (5, 15, 22):
        tl.append(f'tl.to("#{sid}-root-inner", {{ x: -300, opacity: 0, filter: "blur(12px)", duration: 0.22, ease: "power3.in" }}, {end - 0.22:.3f});')
    return out, tl


def sunrise_scene(f, sid, dur):
    out = [f'<div class="bgw" id="{sid}-bg"><img src="{f["bg"]}" alt="" /></div>',
           f'<div class="phone" id="{sid}-p0" style="left:1190px; top:70px"><div class="screen"><img src="{A}feed-1.jpg" alt="" /></div></div>',
           f'<div class="cap" id="{sid}-cap" style="top:860px"><i></i>{E(f["cap"])}</div>']
    tl = [f'tl.fromTo("#{sid}-bg", {{ scale: 1.12 }}, {{ scale: 1.0, duration: {dur:.3f}, ease: "power2.out" }}, 0);',
          f'tl.fromTo("#{sid}-p0", {{ y: 1100 }}, {{ y: 0, duration: 0.8, ease: "expo.out" }}, {BAR + 0.05:.3f});',
          f'tl.fromTo("#{sid}-cap", {{ opacity: 0, x: -24 }}, {{ opacity: 1, x: 0, duration: 0.55, ease: "expo.out" }}, {BAR + 0.5:.3f});',
          f'tl.to("#{sid}-root-inner", {{ x: -300, opacity: 0, filter: "blur(12px)", duration: 0.22, ease: "power3.in" }}, {dur - 0.22:.3f});']
    return out, tl


def end_scene(f, sid, dur):
    out = ['<div class="bgw end-bg" id="e-bg"><img src="assets/img/lkdv-bg-landscape.webp" alt="" /></div>',
           '<div class="shade" style="background: rgba(11,31,23,0.55)"></div>',
           '<img id="e-badge" src="assets/img/lkdv-badge.png" alt="" style="position:absolute; left:300px; top:290px; width:500px; height:500px" />',
           f'<div id="e-name" style="position:absolute; left:880px; top:400px; color:#faf8f5; font-weight:800; font-size:110px; letter-spacing:-0.03em">{words("Le Kit du", "e-n1")} <em style="font-family:\'EB Garamond\', serif; font-weight:500">{words("Voyageur", "e-n2")}</em></div>',
           '<div id="e-tag" style="position:absolute; left:888px; top:545px; color:#dfe8dc; font-weight:700; font-size:34px; letter-spacing:0.14em; text-transform:uppercase">Préparer · Explorer · Partager</div>',
           '<div class="cap" id="e-url" style="left:888px; top:640px">lekitduvoyageur.fr</div>']
    tl = ['tl.fromTo("#e-bg", { scale: 1.06 }, { scale: 1.0, duration: %.3f, ease: "power1.out" }, 0);' % dur,
          'tl.fromTo("#e-badge", { scale: 0.6, rotation: -28, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.9, ease: "elastic.out(1, 0.75)" }, 0.12);',
          'tl.fromTo(".e-n1", { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.14, stagger: 0.08, ease: "power2.out" }, 0.9);',
          'tl.fromTo(".e-n2", { opacity: 0.25, color: "#9fb59a" }, { opacity: 1, color: "#faf8f5", duration: 0.25, ease: "power1.out" }, 1.2);',
          'tl.fromTo("#e-tag", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "power2.out" }, 1.6);',
          'tl.fromTo("#e-url", { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.55, ease: "expo.out" }, 2.4);']
    return out, tl


def scene_html(f):
    sid = f"s{f['n']:02d}"
    lead = LEAD.get(f["n"], 0.0)
    dur = f["end"] - f["start"]
    if f["name"] == "Le lever de soleil":
        out, tl = sunrise_scene(f, sid, dur)
    elif f["kind"] == "still":
        out, tl = end_scene(f, sid, dur)
    else:
        out, tl = phone_scene(f, sid, dur)
    extra = ""
    if f["n"] == 6:  # iris depuis la flèche du Compas
        extra = 'tl.fromTo("#s06-root-inner", { clipPath: "circle(0px at 1567px 573px)" }, { clipPath: "circle(2300px at 1567px 573px)", duration: 0.35, ease: "power3.in" }, 0);'
    body = "\n      ".join(out)
    tls = "\n      ".join(tl + ([extra] if extra else []))
    return f"""<template>
  <style>{CSS}  </style>
  <div id="root" data-composition-id="{sid}" data-width="1920" data-height="1080" data-layout-allow-overflow>
    <div id="{sid}-root-inner" style="position:absolute; inset:0">
      {body}
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
    for i, f in enumerate(FRAMES):
        sid = f"s{f['n']:02d}"
        with open(os.path.join(ROOT, "compositions", "film", f"{sid}.html"), "w") as fh:
            fh.write(scene_html(f))
        lead = LEAD.get(f["n"], 0.0)
        start = round(f["start"] - lead, 4)
        dur = round(f["end"] - f["start"] + lead, 4)
        hosts.append(f'      <div id="{sid}" class="clip" data-composition-id="{sid}" data-composition-src="compositions/film/{sid}.html" '
                     f'data-start="{start}" data-duration="{dur}" data-track-index="{1 + i % 2}" data-track-kind="graphics" '
                     f'data-width="1920" data-height="1080" style="z-index: {10 + i}"></div>')
    s6 = next(f for f in FRAMES if f["n"] == 6)
    s7 = next(f for f in FRAMES if f["n"] == 7)
    flight_start = s6["start"] - LEAD[6]
    flight_dur = s7["end"] - flight_start
    # Le vol (5 s) est lu un peu plus lentement pour couvrir 06-07, puis tient sa dernière image.
    flight = (f'      <video id="flight" class="clip" src="assets/map/w-patagonie.mp4" muted playsinline data-start="{flight_start:.3f}" '
              f'data-duration="{flight_dur:.3f}" data-playback-rate="0.9" data-track-index="5" style="position:absolute; inset:0; width:1920px; height:1080px; object-fit:cover; z-index: 15"></video>')
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
{chr(10).join(audio_clips(FRAMES, LEAD))}
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
    print("ok", len(FRAMES), "plans")


if __name__ == "__main__":
    main()
