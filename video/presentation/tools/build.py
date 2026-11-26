# Génère le film « Pas pour moi » : index.html (piste de fond + compositions + bande-son) et compositions/*.html.
# Horaires : audio/timeline.json (voix) et tools/montage.py (fonds). Écrans de l'app : tools/chapitres.py.
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ui import Comp, esc, ico
from montage import BG, XF
import chapitres
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open(os.path.join(ROOT, 'audio', 'timeline.json')))
D = T['duree']
CH = T['chapitres']; PH = T['phrases']
os.makedirs(os.path.join(ROOT, 'compositions'), exist_ok=True)

def phrase(txt):
    for p in PH:
        if p['texte'].startswith(txt): return p
    raise KeyError(txt)

# ---------------------------------------------------------------- fonds (dans index.html)
def fonds():
    h, j = [], []
    for k, (kind, sid, img, t0, t1) in enumerate(BG):
        first = k == 0
        dur = round(t1 - t0 + (XF if k + 1 < len(BG) else 0), 3)
        z = 1 + k; track = k % 2
        i = f'bg-{sid}'
        shot = os.path.join(ROOT, 'assets', 'shots', f'{sid}.mp4')
        if kind == 'plan' and os.path.exists(shot) and os.path.getsize(shot) > 10000:
            h.append(f'<video id="{i}" class="clip" src="assets/shots/{sid}.mp4" muted playsinline data-start="{t0}" data-duration="{dur}" data-track-index="{track}" style="position:absolute;left:0;top:0;width:1080px;height:1920px;object-fit:cover;z-index:{z}"></video>')
        elif kind in ('plan', 'flou'):
            src = f'assets/prep/{img:02d}.jpg' if kind == 'plan' else f'assets/prep/{img:02d}-flou.jpg'
            h.append(f'<img id="{i}" class="clip" src="{src}" alt="" data-start="{t0}" data-duration="{dur}" data-track-index="{track}" style="position:absolute;left:-54px;top:-96px;width:1188px;height:2112px;object-fit:cover;z-index:{z}">')
            # lente dérive (flou) ou poussée (plan en attente)
            j.append(f'tl.fromTo("#{i}", {{scale:1.0, x:-18}}, {{scale:1.06, x:18, duration:{dur}, ease:"none"}}, {t0});')
        else:
            h.append(f'<div id="{i}" class="clip encre" data-start="{t0}" data-duration="{dur}" data-track-index="{track}" style="z-index:{z}"></div>')
        if not first:
            j.append(f'tl.fromTo("#{i}", {{opacity:0}}, {{opacity:1, duration:{XF}, ease:"power1.inOut"}}, {t0});')
    return h, j

# ---------------------------------------------------------------- excuses (pensées écrites puis barrées)
def excuses():
    c = Comp('excuses', 0, D)
    c.style('.ex { position:absolute; left:60px; right:60px; top:820px; text-align:center; transform-origin:50% 50%; }'
            '.ex .w { position:relative; display:inline-block; white-space:nowrap; font-family:"EB Garamond Italic", Georgia, serif; font-style:italic; font-size:96px; line-height:1.1; color:#FAF8F5; }'
            '.ex .bar { position:absolute; left:-2%; right:-2%; top:56%; height:7px; background:#D0A070; transform-origin:0 50%; border-radius:4px; }'
            '.exh { position:absolute; left:50%; top:88px; height:84px; transform:translateX(-50%); border-radius:42px; background:rgba(6,18,12,0.55); border:1px solid rgba(208,160,112,0.28); opacity:0; }'
            '.exk { position:absolute; left:0; right:0; top:700px; text-align:center; font:500 24px/1 "JetBrains Mono", monospace; letter-spacing:0.2em; color:#D0A070; opacity:0; }')
    roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
    for k, ch in enumerate(CH):
        e = ch['excuse']
        if not e: continue
        i = c.u('ex'); n = ch['bloc']
        txt = c.typing(e['texte'], e['debut'] + 0.25, cps=20, caret=False)
        fs = min(96, int(930 / (len(e['texte']) * 0.42)))
        width = int(len(e['texte']) * 96 * 0.42 * 0.42 + 80)
        c.add(f'<div id="{i}h" class="exh" style="width:{width}px"></div>')
        c.add(f'<div id="{i}k" class="exk">{roman[n]}</div>')
        c.add(f'<div id="{i}" class="ex"><span class="w" style="font-size:{fs}px">{txt}<span id="{i}b" class="bar"></span></span></div>')
        c.set(f'#{i}b', 0, scaleX=0)
        c.show(f'#{i}k', e['debut'] + 0.1, e['fin'] - 0.3, d=0.4, y=12)
        c.set(f'#{i}', 0, opacity=1)
        # l'excuse monte en tête d'écran et y reste pendant le chapitre
        c.to(f'#{i}', e['fin'] - 0.45, d=0.6, ease='power3.inOut', y=-742, scale=round(0.42 * 96 / fs, 3))
        c.show(f'#{i}h', e['fin'] - 0.15, None, d=0.3)
        # le fil laiton la barre à la fin du chapitre
        fin = ch['fin']
        c.to(f'#{i}b', fin - 1.5, d=0.55, ease='power2.inOut', scaleX=1)
        c.to(f'#{i}', fin - 0.45, d=0.4, ease='power2.in', opacity=0)
        c.to(f'#{i}h', fin - 0.45, d=0.4, ease='power2.in', opacity=0)
    c.write(os.path.join(ROOT, 'compositions', 'excuses.html'))

# ---------------------------------------------------------------- sous-titres
def texte():
    c = Comp('texte', 0, D)
    c.style('.st { position:absolute; left:70px; right:70px; top:1690px; text-align:center; font:600 44px/1.22 Inter, sans-serif; color:#FAF8F5; '
            'text-shadow:0 2px 14px rgba(6,18,12,0.85), 0 0 3px rgba(6,18,12,0.6); opacity:0; }'
            '.st.app { font:500 38px/1.2 "JetBrains Mono", monospace; color:#F1D3AE; letter-spacing:0.02em; }')
    for k, p in enumerate(PH):
        if p['debut'] >= 317.933: continue   # l'épilogue s'écrit en grand à l'écran
        i = c.u('s'); nxt = PH[k + 1]['debut'] if k + 1 < len(PH) else D
        out = min(p['fin'] + 1.4, nxt - 0.05)
        cls = 'st app' if p['app'] else 'st'
        txt = ('« ' + p['texte'] + ' »') if p['app'] else p['texte']
        c.add(f'<div id="{i}" class="{cls}">{esc(txt)}</div>')
        c.show(f'#{i}', p['debut'] - 0.05, out, d=0.22, y=10, d_out=0.2)
    c.write(os.path.join(ROOT, 'compositions', 'texte.html'))

# ---------------------------------------------------------------- index
def index(comps):
    bh, bj = fonds()
    ch = []
    for k, (cid, t0, t1) in enumerate(comps):
        ch.append(f'<div id="{cid}" class="clip" data-composition-id="{cid}" data-composition-src="compositions/{cid}.html" data-start="{t0}" data-duration="{round(t1 - t0, 3)}" data-track-index="{4 + k % 2}" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:{200 + k}"></div>')
    html = f'''<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>LKDV — « Pas pour moi », présentation de l'app (9:16)</title>
    <script src="assets/lib/gsap.min.js"></script>
    <link rel="stylesheet" href="assets/fonts.css" />
    <link rel="stylesheet" href="assets/ui.css" />
    <style>
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ width:1080px; height:1920px; overflow:hidden; background:#06120C; }}
      #root {{ position:relative; width:1080px; height:1920px; overflow:hidden; background:#06120C; }}
      #vig {{ position:absolute; inset:0; pointer-events:none; background: radial-gradient(130% 90% at 50% 45%, rgba(0,0,0,0) 55%, rgba(6,18,12,0.55) 100%),
              linear-gradient(180deg, rgba(6,18,12,0.35) 0%, rgba(6,18,12,0) 14%, rgba(6,18,12,0) 76%, rgba(6,18,12,0.55) 100%); }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="1080" data-height="1920">
      {chr(10).join('      ' + x for x in bh).strip()}
      <div id="vig" class="clip" data-start="0" data-duration="{D}" data-track-index="2" style="z-index:150"></div>
      {chr(10).join('      ' + x for x in ch).strip()}
      <video id="kitstudio" class="clip" src="assets/app/kit-studio-coloris.mp4" muted playsinline data-start="192.833" data-duration="2.9" data-track-index="6" style="position:absolute;left:233px;top:249px;width:614px;height:1362px;object-fit:cover;object-position:top;border-radius:63px;z-index:300"></video>
      <div id="excuses" class="clip" data-composition-id="excuses" data-composition-src="compositions/excuses.html" data-start="0" data-duration="{D}" data-track-index="8" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:400"></div>
      <div id="texte" class="clip" data-composition-id="texte" data-composition-src="compositions/texte.html" data-start="0" data-duration="{D}" data-track-index="9" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:500"></div>
      <audio id="bande" class="clip" src="audio/bande-son.wav" data-start="0" data-duration="{D}" data-track-index="20" data-volume="1" data-timeline-role="music"></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      {chr(10).join('      ' + x for x in bj).strip()}
      tl.fromTo("#kitstudio", {{opacity:0}}, {{opacity:1, duration:0.3}}, 192.833);
      tl.to("#kitstudio", {{opacity:0, duration:0.3}}, 195.433);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''
    open(os.path.join(ROOT, 'index.html'), 'w').write(html)

if __name__ == '__main__':
    excuses(); texte()
    comps = chapitres.build(ROOT, CH, PH, phrase)
    index(comps)
    print('ok :', len(comps), 'chapitres,', len(BG), 'fonds, durée', D)
