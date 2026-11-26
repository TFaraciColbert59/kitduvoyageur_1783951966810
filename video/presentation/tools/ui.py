# Petite bibliothèque pour écrire les compositions HyperFrames de « Pas pour moi » en Python :
# éléments HTML de l'app (téléphone, pages, lignes, carte satellite) + tweens GSAP aux horaires du film.
# Tous les horaires passés aux fonctions sont des horaires DU FILM ; la composition les convertit en horaires locaux.
import json, math, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Pictogrammes au trait (dessin d'après Lucide, licence ISC), viewBox 24.
ICONS = {
    'home': '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    'compass': '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    'users': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.8c2 .7 3.3 2.5 3.6 5.2"/>',
    'send': '<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4 4-6.5 8-6.5s7.3 2.5 8 6.5"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
    'pin': '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    'drop': '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    'tent': '<path d="M3 20 12 4l9 16"/><path d="M12 4v16"/><path d="m8.5 20 3.5-6 3.5 6"/><path d="M2 20h20"/>',
    'alert': '<path d="M12 3 2 20h20z"/><path d="M12 9v5"/><path d="M12 17.2v.3"/>',
    'check': '<path d="m5 12.5 4.5 4.5L19 7"/>',
    'x': '<path d="M6 6l12 12M18 6 6 18"/>',
    'bag': '<path d="M6 8h12l1 13H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    'pack': '<path d="M7 7a5 5 0 0 1 10 0v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/><path d="M10 4V3h4v1"/>',
    'mountain': '<path d="m3 20 6.5-11 4 6.5 2.5-4L21 20z"/>',
    'waves': '<path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
    'train': '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14"/><path d="m8 21 2-4M16 21l-2-4"/><circle cx="9" cy="14" r=".6"/><circle cx="15" cy="14" r=".6"/>',
    'bed': '<path d="M3 19V6"/><path d="M3 15h18v4"/><path d="M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="2"/>',
    'euro': '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5"/><path d="M4 10h9M4 14h8"/>',
    'star': '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    'download': '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    'link': '<path d="M10 14a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3"/><path d="M14 10a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'nowifi': '<path d="M2 8.5a15 15 0 0 1 6-3.2M22 8.5a15 15 0 0 0-8.6-3.9"/><path d="M5 12a10 10 0 0 1 4-2.3M19 12a10 10 0 0 0-2.7-1.8"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><path d="M12 19.5v.1"/><path d="M3 3l18 18"/>',
    'heart': '<path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20z"/>',
    'camera': '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    'flower': '<circle cx="12" cy="9" r="2.5"/><path d="M12 6.5a3 3 0 1 1 3 3 3 3 0 1 1-3 3 3 3 0 1 1-3-3 3 3 0 1 1 3-3"/><path d="M12 12v9"/><path d="M12 17c-2 0-3.5-1-4-3M12 18c2 0 3.5-1 4-3"/>',
    'paw': '<circle cx="7" cy="9" r="1.8"/><circle cx="17" cy="9" r="1.8"/><circle cx="10" cy="5.5" r="1.8"/><circle cx="14" cy="5.5" r="1.8"/><path d="M12 12c-3 0-5.5 3-5.5 5.5 0 1.7 1.5 2.5 3 2 1-.3 1.6-.6 2.5-.6s1.5.3 2.5.6c1.5.5 3-.3 3-2C17.5 15 15 12 12 12z"/>',
    'chev': '<path d="m9 6 6 6-6 6"/>',
    'search': '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    'layers': '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    'doc': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
    'shield': '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    'storm': '<path d="M7 16a5 5 0 1 1 1.5-9.8A6 6 0 0 1 19.5 9 4 4 0 0 1 18 16"/><path d="m13 12-3 5h4l-3 5"/>',
    'nav': '<path d="m12 2 7 19-7-4-7 4z"/>',
    'turnl': '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v6"/>',
    'msg': '<path d="M4 5h16v11H9l-5 4z"/>',
    'globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    'spark': '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    'steps': '<path d="M5 16c-1-4 0-8 2.5-8S10 12 9 16z"/><path d="M15 12c-1-4 0-8 2.5-8S20 8 19 12z"/><path d="M5.5 19.5h3M15.5 15.5h3"/>',
    'watch': '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6 9.5 2h5L15 6M9 18l.5 4h5l.5-4"/><path d="M12 9.5V12l1.5 1"/>',
    'pulse': '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    'award': '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8"/>',
    'sunrise': '<path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 3v5M5 9.5l1.5 1.5M19 9.5 17.5 11"/><path d="m9.5 5.5 2.5-2.5 2.5 2.5"/>',
    'share': '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
    'book': '<path d="M3 5c3-1 6-1 9 1v15c-3-2-6-2-9-1z"/><path d="M21 5c-3-1-6-1-9 1v15c3-2 6-2 9-1z"/>',
    'cart': '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.5h11L21 7H6"/>',
    'repeat': '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    'userplus': '<circle cx="9" cy="8" r="4"/><path d="M2 21c.7-4 3.5-6.5 7-6.5s6.3 2.5 7 6.5"/><path d="M19 8v6M16 11h6"/>',
    'cal': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    'eyeoff': '<path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3 3.6M6.6 7.6C4.2 9.3 3 12 3 12s4 6 9 6a9 9 0 0 0 4.4-1.2"/>',
    'phone': '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18.5h2"/>',
    'rope': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M20 12h2"/>',
    'helmet': '<path d="M4 16a8 8 0 0 1 16 0z"/><path d="M3 16h18v2H3z"/><path d="M12 8v3"/>',
    'lamp': '<path d="M5 9h8l3-3v12l-3-3H5z"/><path d="M18.5 9.5 21 8.5M18.5 12H21.5M18.5 14.5l2.5 1"/>',
    'leaf': '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z"/><path d="M5 19 13 11"/>',
    'mug': '<path d="M5 8h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2"/>',
    'glove': '<path d="M7 21v-7l-2-3c-.8-1.2.8-2.4 1.8-1.4L8 11V4.5a1.2 1.2 0 0 1 2.4 0V10V3.2a1.2 1.2 0 0 1 2.4 0V10V4a1.2 1.2 0 0 1 2.4 0v6.5V6.2a1.2 1.2 0 0 1 2.4 0V15a6 6 0 0 1-2 4.5V21z"/>',
    'flame': '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-1.5-2-1.5-3C7 10 6 12.5 6 15a6 6 0 0 0 6 6z"/>',
    'map': '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    'bottle': '<path d="M10 2h4v3l2 3v13H8V8l2-3z"/><path d="M8 12h8"/>',
    'sos': '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.2v.3"/>',
    'thermo': '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>',
    'snow': '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/>',
    'cloud': '<path d="M7 18a5 5 0 1 1 1.5-9.8A6 6 0 0 1 19.5 11 3.5 3.5 0 0 1 18 18z"/>',
    'cloudsun': '<path d="M8 4.5V3M3.5 8H2M4.5 4.5 5.5 5.5"/><path d="M5.3 10.5A3.5 3.5 0 1 1 11 7"/><path d="M8 20a4 4 0 1 1 1.2-7.8A5 5 0 0 1 18.5 14 3 3 0 0 1 18 20z"/>',
    'rain': '<path d="M7 15a5 5 0 1 1 1.5-9.8A6 6 0 0 1 19.5 8 3.5 3.5 0 0 1 18 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
}
def ico(n, cls='ico', style=''):
    st = f' style="{style}"' if style else ''
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true"{st}>{ICONS[n]}</svg>'

def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

# --- projection des fonds satellite (Web Mercator, comme les tuiles) ---
_AM = None
def alps_meta():
    global _AM
    if _AM is None: _AM = json.load(open(os.path.join(ROOT, 'assets', 'img', 'alpes.json')))
    return _AM
def P(lon, lat, key='z12'):
    m = alps_meta()[key]; n = 256 * 2 ** m['z']
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x - m['ox'], y - m['oy']


class Comp:
    """Une composition (un chapitre). t0/t1 : horaires du film."""
    def __init__(self, cid, t0, t1, title=''):
        self.cid, self.t0, self.t1, self.title = cid, t0, t1, title
        self.h, self.j, self.css, self.k = [], [], [], 0
    def u(self, p='e'):
        self.k += 1; return f'{self.cid}-{p}{self.k}'
    def L(self, t): return round(max(0.0, t - self.t0), 3)
    def add(self, html): self.h.append(html); return html
    def tw(self, code): self.j.append(code)
    def style(self, css): self.css.append(css)

    # --- apparitions ---
    def show(self, sel, t_in, t_out=None, d=0.4, y=0, x=0, sc=None, ease='power3.out', d_out=0.3, y_out=None, blur=False):
        a = {'opacity': 0}; b = {'opacity': 1, 'duration': d, 'ease': ease}
        if y: a['y'] = y; b['y'] = 0
        if x: a['x'] = x; b['x'] = 0
        if sc is not None: a['scale'] = sc; b['scale'] = 1
        self.tw(f'tl.fromTo("{sel}", {json.dumps(a)}, {json.dumps(b)}, {self.L(t_in)});')
        if t_out is not None:
            c = {'opacity': 0, 'duration': d_out, 'ease': 'power2.in'}
            if y_out is not None: c['y'] = y_out
            self.tw(f'tl.to("{sel}", {json.dumps(c)}, {self.L(t_out - d_out)});')
    def to(self, sel, t, d=0.4, ease='power2.inOut', **props):
        p = dict(props); p['duration'] = d; p['ease'] = ease
        self.tw(f'tl.to("{sel}", {json.dumps(p)}, {self.L(t)});')
    def set(self, sel, t, **props):
        self.tw(f'tl.set("{sel}", {json.dumps(props)}, {self.L(t)});')
    def tap(self, parent_html_list, x, y, t):
        """Toucher : un cercle qui s'ouvre à (x, y) dans le repère du conteneur."""
        i = self.u('tap'); parent_html_list.append(f'<div id="{i}" class="tap" style="left:{x}px;top:{y}px"></div>')
        self.tw(f'tl.fromTo("#{i}", {{opacity:0, scale:0.4}}, {{opacity:1, scale:1, duration:0.12, ease:"power2.out"}}, {self.L(t)});')
        self.tw(f'tl.to("#{i}", {{opacity:0, scale:1.7, duration:0.4, ease:"power2.out"}}, {self.L(t + 0.14)});')
    def press(self, sel, t):
        self.tw(f'tl.to("{sel}", {{scale:0.95, duration:0.1, ease:"power2.out"}}, {self.L(t)});')
        self.tw(f'tl.to("{sel}", {{scale:1, duration:0.25, ease:"back.out(3)"}}, {self.L(t + 0.1)});')
    def typing(self, text, t, cps=22, caret=True, cls=''):
        """Texte qui se tape lettre à lettre : renvoie le HTML (spans), programme l'apparition."""
        i = self.u('ty'); spans = ''.join(f'<span class="{i}c" style="opacity:0">{esc(c)}</span>' for c in text)
        cr = f'<span id="{i}k" class="caret"></span>' if caret else ''
        self.tw(f'tl.to(".{i}c", {{opacity:1, duration:0.01, stagger:{round(1 / cps, 4)}, ease:"none"}}, {self.L(t)});')
        if caret:
            end = t + len(text) / cps
            self.tw(f'tl.fromTo("#{i}k", {{opacity:0}}, {{opacity:1, duration:0.01}}, {self.L(t)});')
            self.tw(f'tl.to("#{i}k", {{opacity:0, duration:0.01, repeat:5, yoyo:true, repeatDelay:0.25}}, {self.L(end + 0.2)});')
        return f'<span id="{i}" class="{cls}" style="white-space:pre-wrap">{spans}{cr}</span>'
    def count(self, eid, a, b, t, d, fmt='int', suffix='', prefix=''):
        """Compteur (seek-safe : la valeur dépend seulement de la progression du tween)."""
        f = {'int': 'Math.round(v).toLocaleString("fr-FR").replace(/\\u202f/g, "\\u2009")', 'f1': 'v.toFixed(1).replace(".", ",")'}[fmt]
        self.tw(f'(function(){{const o={{v:{a}}}; const el=document.getElementById("{eid}"); tl.to(o, {{v:{b}, duration:{d}, ease:"power2.out", onUpdate:()=>{{const v=o.v; el.textContent="{prefix}"+{f}+"{suffix}";}}}}, {self.L(t)});}})();')

    def write(self, path, W=1080, H=1920):
        html = '\n'.join(self.h); js = '\n      '.join(self.j); css = '\n    '.join(self.css)
        out = f'''<template>
  <style>
    #{self.cid} {{ position:absolute; inset:0; overflow:hidden; }}
    {css}
  </style>
  <div id="{self.cid}" data-composition-id="{self.cid}" data-width="{W}" data-height="{H}">
{html}
  </div>
  <script>
    (function () {{
      const tl = gsap.timeline({{ paused: true }});
      {js}
      window.__timelines = window.__timelines || {{}};
      window.__timelines["{self.cid}"] = tl;
    }})();
  </script>
</template>
'''
        open(path, 'w').write(out)


class Phone:
    """Téléphone qui entre à t_in et sort à t_out ; contient des pages qui se succèdent."""
    def __init__(self, c, t_in, t_out, x=220, y=236, enter='up', exit='down'):
        self.c, self.t_in, self.t_out = c, t_in, t_out
        self.id = c.u('ph'); self.kids = []; self.x, self.y = x, y
        if enter == 'up':
            c.tw(f'tl.fromTo("#{self.id}", {{opacity:0, y:160, scale:0.94}}, {{opacity:1, y:0, scale:1, duration:0.7, ease:"power3.out"}}, {c.L(t_in)});')
        else:
            c.tw(f'tl.fromTo("#{self.id}", {{opacity:0}}, {{opacity:1, duration:0.35}}, {c.L(t_in)});')
        if t_out is not None:
            if exit == 'down':
                c.tw(f'tl.to("#{self.id}", {{opacity:0, y:120, scale:0.96, duration:0.45, ease:"power2.in"}}, {c.L(t_out - 0.45)});')
            else:
                c.tw(f'tl.to("#{self.id}", {{opacity:0, duration:0.35}}, {c.L(t_out - 0.35)});')
    def page(self, inner, t_in, t_out=None, trans='slide', bg=None):
        c = self.c; i = c.u('pg'); st = f' style="background:{bg}"' if bg else ''
        self.kids.append(f'<div id="{i}" class="pg"{st}>{inner}</div>')
        if trans == 'slide':
            c.tw(f'tl.fromTo("#{i}", {{opacity:0, x:70}}, {{opacity:1, x:0, duration:0.45, ease:"power3.out"}}, {c.L(t_in)});')
        elif trans == 'up':
            c.tw(f'tl.fromTo("#{i}", {{opacity:0, y:90}}, {{opacity:1, y:0, duration:0.5, ease:"power3.out"}}, {c.L(t_in)});')
        else:
            c.tw(f'tl.fromTo("#{i}", {{opacity:0}}, {{opacity:1, duration:0.35, ease:"power2.out"}}, {c.L(t_in)});')
        if t_out is not None:
            c.tw(f'tl.to("#{i}", {{opacity:0, x:-50, duration:0.3, ease:"power2.in"}}, {c.L(t_out - 0.3)});')
        return i
    def html(self):
        return f'<div id="{self.id}" class="ph" style="left:{self.x}px;top:{self.y}px"><div class="scr">{"".join(self.kids)}</div><div class="island"></div></div>'


def header(title, right=('plus', 'sun', 'menu'), chev=True):
    r = ''.join(f'<div class="rbtn">{ico(n)}</div>' for n in right)
    ch = ico('chev', 'ico', 'width:20px;height:20px;transform:rotate(90deg)') if chev else ''
    return f'<div class="hdr"><div class="pill">{esc(title)}{ch}</div><div class="sp"></div>{r}</div>'

def tabs(on=0):
    names = ['home', 'compass', 'users', 'send', 'user']
    return '<div class="tabs">' + ''.join(f'<div class="t{" on" if k == on else ""}">{ico(n)}</div>' for k, n in enumerate(names)) + '</div>'

def row(icon, k, v='', r='', rid='', ic_style=''):
    ri = f' id="{rid}"' if rid else ''
    vv = f'<div class="v">{v}</div>' if v else ''
    rr = f'<div class="r">{r}</div>' if r else ''
    st = f' style="{ic_style}"' if ic_style else ''
    return f'<div class="row"{ri}><div class="ic"{st}>{ico(icon)}</div><div class="tx"><div class="k">{k}</div>{vv}</div>{rr}</div>'


class MapView:
    """Fond satellite (mosaïque Sentinel-2) cadré par (lon, lat, échelle) ; la caméra se déplace par tweens."""
    def __init__(self, c, key, w, h, view, x=0, y=0, extra_style='', src=None, att=True):
        self.c, self.key, self.w, self.h = c, key, w, h; self.src = src or f'alpes-{key}'; self.show_att = att
        self.id = c.u('map'); self.inner = self.id + 'i'; self.svg = []; self.pins = []
        self.view = view; self.view0 = view
        m = alps_meta()[key]; self.mw, self.mh = m['w'], m['h']
        self.x, self.y, self.extra = x, y, extra_style
    def tf(self, view):
        lon, lat, s = view; X, Y = P(lon, lat, self.key)
        return round(self.w / 2 - X * s, 2), round(self.h / 2 - Y * s, 2), s
    def cam(self, t, d, view, ease='power2.inOut'):
        x, y, s = self.tf(view); self.view = view
        self.c.tw(f'tl.to("#{self.inner}", {{x:{x}, y:{y}, scale:{s}, duration:{d}, ease:"{ease}"}}, {self.c.L(t)});')
    def path(self, pts, color='#D0A070', width=6, dash=None, pid=None, opacity=1):
        pid = pid or self.c.u('rt')
        d = 'M' + ' L'.join(f'{P(lo, la, self.key)[0]:.1f} {P(lo, la, self.key)[1]:.1f}' for lo, la in pts)
        da = f' stroke-dasharray="{dash}"' if dash else ''
        self.svg.append(f'<path id="{pid}" d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"{da} opacity="{opacity}"/>')
        return pid
    def draw(self, pid, t, d, ease='power1.inOut'):
        self.c.tw(f'(function(){{const p=document.getElementById("{pid}"); const L=p.getTotalLength(); p.style.strokeDasharray=L+" "+L; tl.fromTo(p, {{strokeDashoffset:L}}, {{strokeDashoffset:0, duration:{d}, ease:"{ease}"}}, {self.c.L(t)});}})();')
    def pin(self, lon, lat, label, icon='pin', color='#17402C', t=None, inv=1.0, pid=None):
        X, Y = P(lon, lat, self.key); pid = pid or self.c.u('pn')
        lab = f'<span>{esc(label)}</span>' if label else ''
        pad = '' if label else ' style="padding:0 8px"'
        self.pins.append(f'<div id="{pid}" class="pin" style="left:{X:.1f}px;top:{Y:.1f}px"><div style="transform:scale({inv});transform-origin:50% 100%;display:flex;flex-direction:column;align-items:center"><div class="b"{pad}><div class="d" style="background:{color}">{ico(icon)}</div>{lab}</div><div class="stem"></div></div></div>')
        if t is not None:
            self.c.tw(f'tl.fromTo("#{pid}", {{opacity:0, y:-20}}, {{opacity:1, y:0, duration:0.4, ease:"back.out(2.5)"}}, {self.c.L(t)});')
        return pid
    def html(self):
        x, y, s = self.tf(self.view0)
        self.c.tw(f'tl.set("#{self.inner}", {{x:{x}, y:{y}, scale:{s}}}, 0);')
        att = '<div class="att">' + ('Sentinel-2 cloudless · EOX · CC BY 4.0' if self.src.startswith('alpes') else ('Black Marble · NASA · EOX' if 'nuit' in self.src else '© OpenStreetMap · EOX')) + '</div>'
        if not self.show_att: att = ''
        return (f'<div id="{self.id}" class="map" style="left:{self.x}px;top:{self.y}px;width:{self.w}px;height:{self.h}px;{self.extra}">'
                f'<div id="{self.inner}" class="in" style="width:{self.mw}px;height:{self.mh}px">'
                f'<img src="assets/img/{self.src}.jpg" width="{self.mw}" height="{self.mh}" alt="">'
                f'<svg width="{self.mw}" height="{self.mh}" viewBox="0 0 {self.mw} {self.mh}">{"".join(self.svg)}</svg>{"".join(self.pins)}</div>{att}</div>')
