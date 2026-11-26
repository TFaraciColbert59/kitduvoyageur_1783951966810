# Écrit compositions/texte.html : bandeau de chapitre (façon code) et sous-titres mot par mot calés sur la voix.
# Les mots entre *astérisques* sont mis en valeur (italique serif vert forêt).
# Horaires de la voix : assets/audio/voix.json (début et fin de chaque réplique, parole seule).
import os, json, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = {d['i']: d for d in json.load(open(os.path.join(ROOT, 'assets', 'audio', 'voix.json')))}
CAP = {1: "Cinq jours en *Patagonie*. Rien *oublié*.", 2: "Tu écris une *phrase*…", 3: "et le *Kit du Voyageur* prépare *tout*.",
       4: "L’*itinéraire*, jour par jour.", 5: "Quatre *refuges*, réservés.", 6: "La *météo*, au bon moment.",
       7: "Le *sac*, au gramme près.", 8: "Le *budget*, partagé à trois.", 9: "La *carte*, même sans *réseau*.",
       10: "Et ta *mère* te suit, en *direct*.", 11: "Toi, tu n’as plus qu’à *partir*."}
GROUPS = [[1], [2, 3], [4], [5], [6], [7], [8], [9], [10], [11]]
# chapitres : (début, texte gauche)
CHAP = [(0.0, '01 · l’envie'), (3.3, '02 · le compas'), (7.3, '03 · l’itinéraire'), (10.667, '04 · le W'), (13.333, '05 · les refuges'),
        (15.4, '06 · la météo'), (16.9, '07 · le sac'), (18.35, '08 · le budget'), (20.1, '09 · hors ligne'), (21.9, '10 · les proches'),
        (24.333, '11 · le départ'), (28.0, '12 · lkdv')]

def words(line):
    """Mots séparés par des espaces ; la ponctuation reste collée ; les passages entre *…* sont en italique."""
    out = []; emph = False
    for chunk in line.split():
        html = ''; buf = ''; any_em = False
        for ch in chunk:
            if ch == '*':
                if buf: html += f'<em>{buf}</em>' if emph else buf
                buf = ''; emph = not emph; continue
            buf += ch
            any_em = any_em or emph
        if buf: html += f'<em>{buf}</em>' if emph else buf
        out.append((html, chunk.replace('*', '')))
    return out

blocks, js = [], []
for g, grp in enumerate(GROUPS):
    t_show = V[grp[0]]['start'] - 0.05
    nxt = V[GROUPS[g + 1][0]]['start'] - 0.12 if g + 1 < len(GROUPS) else 27.7
    t_hide = min(nxt, V[grp[-1]]['end'] + 1.2)
    spans = []; k = 0
    for i in grp:
        ws = words(CAP[i]); s0, s1 = V[i]['start'], V[i]['end']
        wt = [len(raw) + 2 for _, raw in ws]; tot = sum(wt); acc = 0
        for (h, raw), wl in zip(ws, wt):
            t = s0 + (s1 - s0) * acc / tot; acc += wl
            spans.append(f'<span id="c{g}-{k}" class="c-w">{h}</span>')
            js.append(f'      tl.fromTo("#c{g}-{k}", {{ opacity: 0, y: 12, filter: "blur(10px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.22, ease: "power2.out" }}, {t - 0.04:.3f});')
            k += 1
    blocks.append(f'    <div id="cg{g}" class="clip c-line" data-start="{t_show:.3f}" data-duration="{t_hide - t_show:.3f}" data-track-index="{2 + g % 2}" data-layout-allow-safe-zone>{" ".join(spans)}</div>')
    js.append(f'      tl.to("#cg{g}", {{ opacity: 0, y: -14, filter: "blur(8px)", duration: 0.18, ease: "power2.in" }}, {t_hide - 0.18:.3f});')

chap = []
for j, (t, txt) in enumerate(CHAP):
    t1 = CHAP[j + 1][0] if j + 1 < len(CHAP) else 30.0
    chap.append(f'    <div id="h{j}" class="clip h-left" data-start="{t:.3f}" data-duration="{t1 - t:.3f}" data-track-index="1"><span class="h-sl">//</span> {txt}</div>')
    js.append(f'      tl.fromTo("#h{j}", {{ opacity: 0, x: -14 }}, {{ opacity: 1, x: 0, duration: 0.25, ease: "power2.out" }}, {t + 0.02:.3f});')

html = f'''<template>
  <style>
    #root {{ position:absolute; inset:0; overflow:hidden; pointer-events:none; }}
    #root .h-left {{ position:absolute; left:64px; top:236px; font-family:"JetBrains Mono",monospace; font-size:22px; letter-spacing:0.02em; color:#5F6E64; text-transform:lowercase; white-space:nowrap; }}
    #root .h-sl {{ color:#7E5A30; }}
    #h-right {{ position:absolute; right:64px; top:236px; font-family:"JetBrains Mono",monospace; font-size:22px; letter-spacing:0.08em; color:#5F6E64; white-space:nowrap; }}
    #h-right b {{ color:#7E5A30; font-weight:400; }}
    #root .c-line {{ position:absolute; left:64px; right:64px; top:290px; font-family:"Inter",sans-serif; font-weight:800; font-size:54px; line-height:1.18; letter-spacing:-0.01em; color:#0B1F17; }}
    #root .c-w {{ display:inline-block; opacity:0; margin-right:0.22em; }}
    #root .c-w em {{ font-family:"EB Garamond Italic","EB Garamond",serif; font-style:italic; font-weight:500; font-size:62px; color:#17402C; letter-spacing:0; }}
  </style>
  <div id="root" data-composition-id="texte" data-width="1080" data-height="1920">
    <div id="h-right">JUSQU’OÙ <b>·</b> LKDV</div>
{chr(10).join(chap)}
{chr(10).join(blocks)}
  </div>
  <script>
    (function () {{
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
      window.__timelines = window.__timelines || {{}};
      window.__timelines["texte"] = tl;
    }})();
  </script>
</template>
'''
open(os.path.join(ROOT, 'compositions', 'texte.html'), 'w').write(html)
print('texte.html', len(GROUPS), 'sous-titres,', len(CHAP), 'chapitres')
