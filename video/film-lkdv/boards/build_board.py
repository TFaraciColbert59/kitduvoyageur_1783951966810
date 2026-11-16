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
    .cap { position: absolute; left: 124px; top: 560px; display: flex; align-items: center; gap: 16px; padding: 16px 28px; border-radius: 999px; background: rgba(250,248,245,0.9); color: #17402c; font-size: 32px; font-weight: 700; }
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
"""


def frame_html(f):
    fid = f"f{f['n']:02d}"
    k = f["kind"]
    if k == "still":
        body = f'<div class="bg"><img src="{f["img"]}" alt="" /></div>'
    elif k == "phone":
        body = (
            f'<div class="bg"><img src="{f["bg"]}" alt="" /></div><div class="shade"></div>'
            f'<div class="chapter">{E(f["chapter"])}</div>'
            f'<div class="title">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>'
            f'<div class="cap"><i></i>{E(f["cap"])}</div>'
            f'<div class="phone"><div class="screen"><img src="{f["shot"]}" alt="" /></div></div>'
        )
    elif k == "glass":
        tabs = ""
        if f.get("tabs"):
            tabs = '<div class="tabs">' + "".join(
                f'<div class="{"on" if i == 0 else ""}">{E(t)}</div>' for i, t in enumerate(f["tabs"])) + "</div>"
        rows = "".join(f'<div class="row"><b>{E(a)}</b><span>{E(b)}</span></div>' for a, b in f["rows"])
        foot = f'<div class="foot">{E(f["foot"])}</div>' if f.get("foot") else ""
        body = (
            f'<div class="bg"><img src="{f["bg"]}" alt="" /></div><div class="shade"></div>'
            f'<div class="chapter">{E(f["chapter"])}</div>'
            f'<div class="title" style="width:780px">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>'
            f'<div class="panel"><div class="ptitle">{E(f["panel_title"])}</div>{tabs}{rows}{foot}</div>'
        )
    elif k == "wall":
        cells = "".join(f'<div><img src="{s}" alt="" /></div>' for s in f["shots"])
        body = (f'<div class="wall">{cells}</div>'
                f'<div class="claim">{E(f["title"])}<br /><em>{E(f["em"])}</em></div>')
    else:
        raise ValueError(k)
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
