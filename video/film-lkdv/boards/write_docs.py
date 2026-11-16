#!/usr/bin/env python3
"""Écrit STORYBOARD.md (format HyperFrames) et boards/storyboard.html (autonome :
images incluses en JPEG réduit) à partir de boards/frames.py et des stills."""
import base64
import glob
import html
import io
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from frames import FRAMES  # noqa: E402

E = html.escape


def fmt(t):
    return f"{t:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def stills():
    files = sorted(glob.glob(os.path.join(HERE, "stills", "frame-*-at-*.png")))
    return files


def md():
    out = ["---",
           "format: 1920x1080",
           "duration: 60s",
           'message: "Une phrase suffit : LKDV accompagne tout le voyage, du rêve au récit."',
           "arc: Accroche → Rêver → Préparer → Équiper → Partir → Raconter → Partager → Tout le voyage → Marque",
           "audience: randonneurs, trekkeurs et voyageurs d'aventure francophones",
           "music: « Ambient Uplift » (Soundrider/Dope, CC BY 3.0), 128 BPM, lue à partir de 16,885 s : la piste s'ouvre à 9,38 s sur « Préparer mon aventure »",
           "---", "",
           "# Storyboard — film complet LKDV (60 s)", "",
           "Une mesure = 1,875 s. Chaque plan tient une idée, un mot de chapitre au plus, et l'écran réel de la fonction. "
           "Les plans marqués ❌ s'appuient sur des libellés réels reconstruits : leur capture est à refaire avec un compte de démo qui marche.", ""]
    act = None
    for f in FRAMES:
        if f["act"] != act:
            act = f["act"]
        out.append(f"## Frame {f['n']}: {f['name']} ({fmt(f['start'])}-{fmt(f['end'])}s)")
        out.append(f"- act: {f['act']}")
        out.append(f"- status: built")
        out.append(f"- realite: {f.get('status', 'reel')}")
        out.append(f"- duration: {fmt(f['end'] - f['start'])}s")
        out.append(f"- src: compositions/frames/f{f['n']:02d}.html")
        out.append(f"- poster: {fmt((f['start'] + f['end']) / 2)}")
        out.append(f"- scene: {f['scene']}")
        out.append(f"- reads: {f['reads']}")
        out.append(f"- sound: {f['sound']}")
        out.append(f"- source: {f['source']}")
        out.append("")
    with open(os.path.join(ROOT, "STORYBOARD.md"), "w") as fh:
        fh.write("\n".join(out))


def data_uri(path, width=720):
    im = Image.open(path).convert("RGB")
    h = round(im.size[1] * width / im.size[0])
    im = im.resize((width, h), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def board(inline):
    files = stills()
    assert len(files) == len(FRAMES), (len(files), len(FRAMES))
    parts = []
    act = None
    for f, p in zip(FRAMES, files):
        if f["act"] != act:
            act = f["act"]
            parts.append(f'<section class="act">{E(act)}</section>')
        src = data_uri(p) if inline else "stills/" + os.path.basename(p)
        lab = {"reel": ("réel", "ok"), "capture": ("capture à faire", "todo"), "partiel": ("partiel", "part"), "vision": ("vision", "vis")}[f.get("status", "reel")]
        todo = f'<span class="tag {lab[1]}">{lab[0]}</span>'
        parts.append(f"""<div class="frame">
  <img src="{src}" alt="" />
  <div class="title">{f['n']:02d}: {E(f['name'])} {todo}</div>
  <div class="time">{fmt(f['start'])} à {fmt(f['end'])} s</div>
  <p class="words">{E(f['scene'])}</p>
  <p class="meta"><b>À lire</b> {E(f['reads'])}<br /><b>Son</b> {E(f['sound'])}<br /><b>Source</b> {E(f['source'])}</p>
</div>""")
    page = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Storyboard LKDV</title>
<style>
  :root {{ --ink: #17402c; --sage: #5b7f55; --stone: #faf8f5; --muted: #5b6b61; --card: #ffffff; --line: rgba(23,64,44,.12); }}
  @media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --ink: #dfe8dc; --stone: #0f1a14; --muted: #9fb0a5; --card: #16231b; --line: rgba(223,232,220,.12); }} }}
  :root[data-theme="dark"] {{ --ink: #dfe8dc; --stone: #0f1a14; --muted: #9fb0a5; --card: #16231b; --line: rgba(223,232,220,.12); }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--stone); color: var(--ink); font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }}
  header {{ max-width: 1240px; margin: 0 auto; padding: 40px 16px 8px; }}
  h1 {{ font-size: 34px; margin: 0 0 8px; letter-spacing: -0.02em; }}
  h1 em {{ font-family: Georgia, serif; font-weight: 400; }}
  header p {{ color: var(--muted); max-width: 820px; line-height: 1.5; margin: 6px 0; }}
  main {{ max-width: 1240px; margin: 0 auto; padding: 8px 16px 64px; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 20px; }}
  .act {{ grid-column: 1 / -1; margin-top: 18px; font-size: 13px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--sage); }}
  .frame {{ background: var(--card); border: 1px solid var(--line); border-radius: 20px; overflow: hidden; }}
  .frame img {{ display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }}
  .title {{ padding: 14px 16px 0; font-weight: 800; font-size: 17px; }}
  .time {{ padding: 2px 16px 0; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }}
  .words {{ padding: 0 16px; margin: 8px 0; font-size: 14px; line-height: 1.45; }}
  .meta {{ padding: 0 16px 16px; margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--muted); }}
  .meta b {{ color: var(--ink); font-weight: 700; margin-right: 4px; }}
  .tag {{ display: inline-block; margin-left: 6px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; vertical-align: 2px; }}
  .tag.ok {{ background: rgba(91,127,85,.16); color: #3d6038; }}
  .tag.todo {{ background: rgba(166,61,47,.12); color: #a63d2f; }}
  .tag.part {{ background: rgba(201,144,44,.16); color: #8a5d0f; }}
  .tag.vis {{ background: rgba(23,64,44,.10); color: #17402c; border: 1px dashed rgba(23,64,44,.5); }}
  .todo {{ display: inline-block; margin-left: 6px; padding: 2px 8px; border-radius: 999px; background: rgba(166,61,47,.12); color: #a63d2f; font-size: 11px; font-weight: 700; vertical-align: 2px; }}
</style>
</head>
<body>
<header>
  <h1>LKDV — film complet, <em>60 secondes</em></h1>
  <p>24 plans, de « Rêver » à « Partager », calés sur « Ambient Uplift » (128 BPM, une mesure = 1,875 s). La piste s'ouvre à 9,38 s, sur le clic « Préparer mon aventure ». Deux temps forts : le sac 3D du Kit Studio (21,6 s) et le carnet de bord (39,4 s).</p>
  <p>Images fixes de travail : écrans réels quand une capture existe ; sinon panneau reconstruit avec les libellés exacts de l'application (marqué « capture à faire »). Les chiffres du voyage viennent du jeu de démonstration du Compas.</p>
</header>
<main>
{chr(10).join(parts)}
</main>
</body>
</html>
"""
    name = "storyboard-autonome.html" if inline else "storyboard.html"
    with open(os.path.join(HERE, name), "w") as fh:
        fh.write(page)


if __name__ == "__main__":
    md()
    board(inline=False)
    board(inline=True)
    print("ok")
