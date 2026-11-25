# Contenu de chaque chapitre de « Pas pour moi » : écrans de l'app, repères, HUD du terrain.
# Horaires = horaires du film, calés sur les phrases de la voix (phrase('début du texte')['debut']).
import os
from ui import Comp, Phone, MapView, header, tabs, row, ico, esc, P

# lieux (WGS84)
ANNECY = (6.129, 45.899); TALLOIRES = (6.213, 45.841); CHAMONIX = (6.869, 45.924); FLEGERE = (6.888, 45.961)
LAC_BLANC = (6.889, 45.981); MONT_BLANC = (6.865, 45.833); ARGENTIERE = (6.926, 45.983)
TRAIN = [ANNECY, (6.31, 46.065), (6.58, 46.06), (6.633, 45.936), (6.70, 45.906), (6.80, 45.905), CHAMONIX]
KAYAK = [(6.168, 45.872), (6.19, 45.855), (6.213, 45.843), (6.205, 45.833), (6.185, 45.846), (6.168, 45.872)]
RANDO = [FLEGERE, (6.884, 45.968), (6.889, 45.972), (6.886, 45.977), LAC_BLANC]
FERRATA = (6.905, 45.935)

def hud(c, kind, html, x, y, t_in, t_out, extra='', hid=None):
    i = hid or c.u('hud'); cls = 'hud' + (f' {kind}' if kind else '')
    c.add(f'<div id="{i}" class="{cls}" style="left:{x}px;top:{y}px;{extra}">{html}</div>')
    c.show(f'#{i}', t_in, t_out, d=0.45, y=16)
    return i

def call(c, html, x, y, t_in, t_out, dark=False, extra='', cid=None, sc=0.9):
    i = cid or c.u('call')
    c.add(f'<div id="{i}" class="call{" dark" if dark else ""}" style="left:{x}px;top:{y}px;{extra}">{html}</div>')
    c.show(f'#{i}', t_in, t_out, d=0.5, y=24, sc=sc, ease='back.out(1.8)')
    return i

# ================================================================ 0. ouverture à froid
def ch0(R, ch, ph):
    t0, t1 = ch['debut'], ch['fin']; c = Comp('ch0', t0, t1)
    # suivi en direct, de nuit
    hud(c, '', f'<span style="width:14px;height:14px;border-radius:7px;background:#E07A5F;display:inline-block"></span><span class="lb">En direct</span><span class="mono" id="ch0-chrono">3:41:08</span>', 60, 150, 0.3, 5.3)
    hud(c, '', f'{ico("mountain")}<span class="mono" id="ch0-alt">2 291 m</span>', 700, 150, 0.5, 5.3)
    c.count('ch0-alt', 2291, 2318, 0.5, 4.6, suffix=' m')
    c.count('ch0-chrono', 0, 4, 0.3, 4.8, prefix='3:41:0')
    # la voix de l'app : guidage
    hud(c, 'light', f'{ico("turnl")}<span>200 m</span><span style="font-weight:500;color:#5E6B63">· à gauche</span>', 300, 1330, 0.55, 3.0, extra='font-size:40px;padding:22px 34px')
    # cinq heures douze
    c.add('<div id="ch0-h" class="kick" style="top:330px;font-size:64px;letter-spacing:0.08em;color:#FAF8F5">05:12</div>')
    c.show('#ch0-h', ph('Cinq heures')['debut'] - 0.1, 5.4, d=0.4, y=16)
    # l'aube : le lac, le Mont-Blanc
    def label(txt, sub, x, y, t, tout, side='down', lid=None):
        i = lid or c.u('lab')
        stem = '<div style="width:3px;height:70px;background:linear-gradient(#FAF8F5,rgba(250,248,245,0))"></div>'
        body = f'<div class="hud light" style="position:relative;opacity:1;left:0;top:0;font-size:32px">{ico("pin")}<span>{txt}</span><span class="mono" style="font-size:24px;color:#7E5A30">{sub}</span></div>'
        inner = (body + stem) if side == 'down' else (stem.replace('linear-gradient(#FAF8F5,rgba(250,248,245,0))', 'linear-gradient(rgba(250,248,245,0),#FAF8F5)') + body)
        c.add(f'<div id="{i}" style="position:absolute;left:{x}px;top:{y}px;display:flex;flex-direction:column;align-items:center;transform:translateX(-50%);opacity:0;z-index:30">{inner}</div>')
        c.show(f'#{i}', t, tout, d=0.5, y=20)
    label('Lac Blanc', '2 352 m', 520, 1180, ph('Le Lac Blanc')['debut'], 12.3, side='up')
    label('Mont-Blanc', '4 806 m', 760, 360, ph('En face, le Mont-Blanc')['debut'], 12.3)
    # il y a six mois… pas pour moi.
    c.add('<div id="ch0-six" class="kick" style="top:760px">Il y a six mois</div>')
    c.show('#ch0-six', ph('Il y a six mois')['debut'], 16.0, d=0.5, y=10)
    p = ph('pas pour moi')
    txt = c.typing('Pas pour moi.', p['debut'] + 0.02, cps=16, caret=False)
    c.add(f'<div id="ch0-ppm" class="big" style="top:840px;font-size:150px;opacity:1">{txt}</div>')
    c.to('#ch0-ppm', 16.05, d=0.5, ease='power3.inOut', y=-260, scale=0.62)
    # l'accueil de l'app : la promesse
    c.add('<div id="ch0-wm" style="position:absolute;left:0;right:0;top:930px;text-align:center;font:700 64px/1 Inter, sans-serif;letter-spacing:0.18em;color:#FAF8F5;opacity:0">LE KIT DU VOYAGEUR</div>')
    c.add('<div id="ch0-tag" class="big" style="top:1020px;font-size:56px;color:#D0A070">Là où la carte se termine.</div>')
    c.show('#ch0-wm', 16.2, t1 - 0.05, d=0.45, y=14, d_out=0.25)
    c.show('#ch0-tag', 16.45, t1 - 0.05, d=0.45, y=14, d_out=0.25)
    c.to('#ch0-ppm', t1 - 0.3, d=0.25, ease='power2.in', opacity=0)
    c.write(os.path.join(R, 'compositions', 'ch0.html'))
    return ('ch0', t0, t1)

# ================================================================ I. je ne suis pas sportif
def ch1(R, ch, ph):
    t0, t1 = ch['debut'], ch['fin']; c = Comp('ch1', t0, t1)
    # les sorties s'empilent (Explorer « Démarrer » → Bilan)
    acts = [('Un dimanche', 'steps', 'Balade', '4,0 km', '1 h 05', ph('Un dimanche')['debut'] + 0.6),
            ('Puis huit', 'mountain', 'Randonnée', '8,2 km', '+210 m', ph('Puis huit')['debut'] - 0.05),
            ('Puis douze', 'mountain', 'Randonnée', '12,1 km', '+480 m', ph('Puis huit')['debut'] + 0.75)]
    for k, (_, icn, kind, km, sub, t) in enumerate(acts):
        y = 1420 - k * 132
        i = c.u('act')
        c.add(f'<div id="{i}" class="hud light" style="left:300px;top:{y}px;width:640px;justify-content:flex-start;font-size:30px;padding:18px 26px">'
              f'{ico(icn)}<span class="lb" style="color:#5E6B63">Bilan · {kind}</span><span class="sp" style="flex:1"></span><span class="mono" style="color:#0B1F17;font-size:34px">{km}</span><span class="mono" style="color:#7E5A30;font-size:24px">{sub}</span></div>')
        c.show(f'#{i}', t, 26.0, d=0.5, x=60, d_out=0.35)
    c.add(f'<div id="ch1-dem" class="hud" style="left:60px;top:300px">{ico("nav")}<span>Démarrer</span><span class="lb">Explorer</span></div>')
    c.show('#ch1-dem', ph('Alors tu as commencé')['debut'] + 0.2, 24.0, d=0.45, y=16)
    # la montre a tout retenu
    hud(c, '', f'{ico("watch")}<span class="lb">Montre synchronisée</span>', 60, 300, ph('Ta montre')['debut'], 31.2)
    hud(c, '', f'{ico("heart")}<span class="mono">142</span><span class="lb">bpm</span>', 90, 560, ph('Le souffle')['debut'], 31.2)
    hud(c, '', f'{ico("mountain")}<span class="mono">+480 m</span><span class="lb">dénivelé</span>', 600, 680, ph('Le souffle')['debut'] + 0.75, 31.2)
    # un premier badge
    pb = ph('Un premier badge')['debut']
    c.add(f'<div id="ch1-bdg" style="position:absolute;left:370px;top:900px;width:340px;height:340px;border-radius:170px;background:radial-gradient(circle,#FAF8F5 0%,#EDE6DA 70%);box-shadow:0 30px 80px rgba(6,18,12,.55);opacity:0;z-index:40;display:flex;align-items:center;justify-content:center"><img src="assets/img/badge-anneau.png" style="width:290px;height:290px" alt=""></div>')
    c.add('<div id="ch1-bdt" class="kick" style="top:1270px;color:#FAF8F5;text-shadow:0 2px 12px rgba(6,18,12,.8)">Premier badge · 10 km</div>')
    c.tw(f'tl.fromTo("#ch1-bdg", {{opacity:0, scale:0.3, rotation:-40}}, {{opacity:1, scale:1, rotation:0, duration:0.7, ease:"back.out(2)"}}, {c.L(pb - 0.05)});')
    c.show('#ch1-bdt', pb + 0.3, 31.25, d=0.4, y=10)
    c.to('#ch1-bdg', 31.0, d=0.3, ease='power2.in', opacity=0, scale=0.8)
    # Compte : les sorties, la carte, la zone de confidentialité
    p = Phone(c, 32.7, t1 - 0.1)
    acts_rows = (row('mountain', 'Randonnée · Semnoz', 'Samedi · +480 m · 3 h 50', '12,1 km') + row('mountain', 'Randonnée · Mont Veyrier', 'Mardi · +210 m', '8,2 km') + row('steps', 'Balade · bord du lac', 'Dimanche · 1 h 05', '4,0 km'))
    prof = (f'<div style="display:flex;align-items:center;gap:18px"><div class="av" style="width:84px;height:84px;font-size:32px;background:#17402C">J</div>'
            f'<div><div class="h2">Julien</div><div class="sub">3 sorties · 24,3 km · 1 badge</div></div></div>')
    stats = ''.join(f'<div style="flex:1;text-align:center"><div class="mono" style="font:700 34px/1 JetBrains Mono;color:#0B1F17">{a}</div><div class="lbl" style="margin-top:8px">{b}</div></div>' for a, b in [('24,3', 'km'), ('+690', 'm'), ('3', 'sorties')])
    pg1 = (header('Compte', ('sun', 'menu')) + f'<div class="body">{prof}<div class="card" style="margin-top:24px;display:flex">{stats}</div>'
           f'<div class="lbl" style="margin:30px 0 8px 6px">Activités</div><div class="card" style="padding:4px 24px">{acts_rows}</div>'
           f'<div class="card" style="margin-top:20px;display:flex;align-items:center;gap:14px">{ico("watch")}<div class="k" style="font:600 22px Inter">Montre connectée</div><div class="sp" style="flex:1"></div><span class="chip ok">synchronisée</span></div>'
           f'<div class="lbl" style="margin:30px 0 8px 6px">Badges · défis</div><div class="card" style="display:flex;align-items:center;gap:18px"><img src="assets/img/badge-anneau.png" style="width:86px;height:86px" alt=""><div style="flex:1"><div class="k" style="font:600 23px Inter;color:#0B1F17">Premier défi</div><div class="v" style="font:500 19px Inter;color:#5E6B63;margin-top:4px">3 sorties ce mois-ci</div></div><span class="chip dark">{ico("check","ico","width:20px;height:20px")} réussi</span></div></div>' + tabs(4))
    p.page(pg1, 32.9, ph('Ta maison')['debut'] - 0.1, trans='fade')
    # la carte : les tracés s'allongent, la maison reste un blanc
    m = MapView(c, 'z12', 614, 1362, (6.135, 45.875, 2.0))
    home = (6.112, 45.905)
    for pts, w in [([home, (6.115, 45.895), (6.13, 45.885), (6.14, 45.872), (6.135, 45.86)], 7),
                   ([home, (6.10, 45.89), (6.105, 45.86), (6.115, 45.83), (6.11, 45.80), (6.125, 45.79)], 7),
                   ([home, (6.14, 45.91), (6.17, 45.905), (6.19, 45.9), (6.205, 45.885), (6.21, 45.87)], 7)]:
        rid = m.path(pts, '#D0A070', w / 2.2)
        m.draw(rid, ph('Ta maison')['debut'] + 0.3, 1.6)
    X, Y = P(*home)
    m.svg.append(f'<circle id="ch1-zone" cx="{X:.1f}" cy="{Y:.1f}" r="26" fill="#F3F1EB" stroke="#17402C" stroke-width="2" stroke-dasharray="6 5" opacity="0"/>')
    c.tw(f'tl.fromTo("#ch1-zone", {{opacity:0, attr:{{r:10}}}}, {{opacity:0.96, attr:{{r:26}}, duration:0.6, ease:"back.out(2)"}}, {c.L(ph("Ta maison")["debut"] + 1.4)});')
    m.cam(ph('Ta maison')['debut'], 3.5, (6.13, 45.88, 2.3))
    zone = (f'<div id="ch1-zl" class="card" style="position:absolute;left:26px;right:26px;bottom:150px;display:flex;align-items:center;gap:16px;opacity:0">'
            f'<div class="ic" style="width:54px;height:54px;border-radius:27px;background:rgba(23,64,44,.1);display:flex;align-items:center;justify-content:center;color:#17402C">{ico("eyeoff")}</div>'
            f'<div><div class="k" style="font:600 23px Inter;color:#0B1F17">Zone de confidentialité</div><div class="v" style="font:500 19px Inter;color:#5E6B63;margin-top:4px">Ton domicile n\'apparaît jamais sur tes tracés.</div></div></div>')
    pg2 = m.html() + header('Mes tracés', ('layers',)) + zone + tabs(1)
    p.page(pg2, ph('Ta maison')['debut'], None, trans='fade')
    c.show('#ch1-zl', ph('Ta maison')['debut'] + 1.6, None, d=0.45, y=30)
    c.add(p.html())
    c.write(os.path.join(R, 'compositions', 'ch1.html'))
    return ('ch1', t0, t1)

def _build_old(R, CH, PH, phrase):
    out = []
    for f, k in [(ch0, 0), (ch1, 1)]:
        out.append(f(R, CH[k], phrase))
    return out

# ---------------------------------------------------------------- aides communes
def cap(name, iid='', pos='top'):
    """Capture réelle de l'app, plein écran du téléphone."""
    i = f' id="{iid}"' if iid else ''
    return f'<img{i} src="assets/app/{name}.jpg" alt="" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:{pos}">'

def box(html, x, y, w=None, extra='', bid=None, c=None):
    i = f' id="{bid}"' if bid else ''
    ww = f'width:{w}px;' if w else ''
    return f'<div{i} style="position:absolute;left:{x}px;top:{y}px;{ww}{extra}">{html}</div>'

def chips(items, on=None):
    return '<div style="display:flex;gap:10px;flex-wrap:wrap">' + ''.join(f'<span class="chip{" dark" if k == on else ""}">{t}</span>' for k, t in enumerate(items)) + '</div>'

def name_tag(c, name, x, y, t, tout, color='#FAF8F5'):
    i = c.u('nm')
    c.add(f'<div id="{i}" class="hud light" style="left:{x}px;top:{y}px;transform:translateX(-50%);font-size:28px;padding:12px 22px">{esc(name)}</div>')
    c.show(f'#{i}', t, tout, d=0.4, y=14)

def seal_svg(size=260):
    # sceau d'empreinte : anneaux de courbes de niveau (encre + sauge), déterministe
    import math as m
    rings = []
    for k in range(9):
        r = 20 + k * 12; pts = []
        for a in range(0, 361, 8):
            t = m.radians(a); rr = r + 4 * m.sin(3 * t + k) + 3 * m.cos(5 * t - k * 0.7)
            pts.append(f'{130 + rr * m.cos(t):.1f},{130 + rr * m.sin(t):.1f}')
        col = '#5B7F55' if k % 3 == 0 else '#17402C'
        rings.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{col}" stroke-width="{2.2 if k % 3 == 0 else 1.4}" opacity="{0.9 - k * 0.05:.2f}"/>')
    return f'<svg width="{size}" height="{size}" viewBox="0 0 260 260" aria-hidden="true">{"".join(rings)}<circle cx="130" cy="130" r="6" fill="#D0A070"/></svg>'

# ================================================================ II. je ne saurais pas où aller
def ch2(R, ch, ph):
    t0, t1 = ch['debut'], ch['fin']; c = Comp('ch2', t0, t1)
    p = Phone(c, 40.97, 68.8)
    a = c.u('img')
    p.page(cap('Monde', a), 41.05, 43.1, trans='fade')
    c.tw(f'tl.fromTo("#{a}", {{scale:1, rotation:0}}, {{scale:1.18, rotation:-4, duration:2.2, ease:"power1.inOut"}}, {c.L(41.0)});')
    # l'arc alpin puis la vallée de Chamonix (deux mosaïques qui se relaient)
    m8 = MapView(c, 'z8', 614, 1362, (7.6, 46.1, 0.62))
    m8.cam(42.9, 1.5, (6.88, 45.94, 3.2), ease='power2.in')
    g8 = m8.html()
    pg8 = p.page(g8 + header('France › Haute-Savoie', ('search', 'layers')) + tabs(1), 42.95, 44.6, trans='fade')
    m = MapView(c, 'z12', 614, 1362, (6.88, 45.94, 0.2))
    m.cam(44.25, 1.4, (6.885, 45.935, 1.05), ease='power3.out')
    inv = 1 / 1.05
    m.path(RANDO, '#D0A070', 5 / 1.05)
    m.pin(CHAMONIX[0], CHAMONIX[1], 'Vallée de Chamonix', 'mountain', '#5B7F55', ph('Une vallée')['debut'] + 0.1, inv)
    m.pin(LAC_BLANC[0], LAC_BLANC[1], 'Refuge du Lac Blanc', 'bed', '#17402C', ph('Une vallée')['debut'] + 1.0, inv)
    m.pin(6.842, 45.957, "Point d'eau", 'drop', '#3E7CA8', ph('Une vallée')['debut'] + 2.1, inv)
    m.pin(6.952, 46.003, 'Bivouac', 'tent', '#5B7F55', ph('Ici, un bivouac')['debut'] + 0.25, inv)
    m.pin(6.83, 45.885, 'Danger · signalé hier', 'alert', '#B7791F', ph('Là, un danger')['debut'] + 0.5, inv)
    m.pin(MONT_BLANC[0], MONT_BLANC[1], 'Mont-Blanc', 'mountain', '#0B1F17', ph('Une vallée')['debut'] + 0.5, inv)
    p.page(m.html() + header('Chamonix-Mont-Blanc', ('search', 'layers')) + tabs(1), 44.4, 51.75, trans='fade')
    # les calques : la carte est vivante
    p.page(cap('Calques'), ph('La carte est vivante')['debut'] - 0.05, 54.6, trans='up')
    call(c, f'{ico("layers")}<span>Calques</span><span class="mono">itinéraires · eau · refuges · bivouacs</span>', 60, 1500, ph('La carte est vivante')['debut'] + 0.2, 54.45, extra='font-size:28px')
    cartes(c, p, ph)
    c.add(p.html())
    roles(c, ph)
    demain(c, ph)
    # le carnet d'un inconnu
    call(c, f'{ico("book")}<span>Carnet · Tour du Mont-Blanc</span><span class="mono">5 jours</span>', 60, 1420, ph('Et puis un carnet')['debut'], 99.933)
    call(c, f'{ico("user")}<span style="font-weight:500">par un voyageur que tu ne connais pas</span>', 60, 1530, ph("Celui d'un inconnu")['debut'], 99.933, extra='font-size:28px')
    for txt, sub, t, tout in [('Fil de bord', 'J1 · 6 h 40 · lac', 100.133, 101.783), ('Fil de bord', 'J2 · via ferrata', 101.933, 103.683), ('Fil de bord', 'J1 · kayak', 103.833, 105.783)]:
        call(c, f'{ico("camera")}<span>{txt}</span><span class="mono">{sub}</span>', 60, 300, t, tout, dark=True, extra='font-size:28px')
    # Préparer ce voyage
    p2 = Phone(c, 105.833, t1 - 0.1)
    kids = []
    btn = c.u('btn')
    kids.append(cap('carnet-tmb'))
    kids.append(f'<div id="{btn}" class="btn" style="position:absolute;left:26px;right:26px;bottom:150px;opacity:0">{ico("compass")} Préparer ce voyage</div>')
    p2.page(''.join(kids), 105.933, None, trans='fade')
    c.show(f'#{btn}', ph('Un bouton')['debut'] + 0.2, None, d=0.45, y=40)
    c.press(f'#{btn}', ph('Un bouton')['debut'] + 1.6)
    tp = []; c.tap(tp, 307, 1170, ph('Un bouton')['debut'] + 1.55); p2.kids.extend(tp)
    c.add(p2.html())
    c.write(os.path.join(R, 'compositions', 'ch2.html'))
    return ('ch2', t0, t1)

# ---------------------------------------------------------------- II bis : les cartes, les filtres, demain
SENTIERS = [[(6.835, 45.93), (6.86, 45.944), (6.875, 45.953), (6.888, 45.961), (6.905, 45.972), (6.925, 45.985)], RANDO,
            [(6.895, 45.906), (6.905, 45.915), (6.917, 45.929)], [(6.81, 45.89), (6.835, 45.905), (6.845, 45.93)],
            [(6.85, 45.91), (6.87, 45.925), (6.89, 45.94)], [(6.917, 45.929), (6.93, 45.94), (6.95, 45.952), (6.96, 45.97)]]
EAU = [(6.842, 45.957), (6.872, 45.968), (6.903, 45.975), (6.9, 45.913), (6.825, 45.92), (6.94, 45.945)]
REFUGES = [(6.889, 45.981), (6.888, 45.961), (6.895, 45.906), (6.917, 45.929), (6.835, 45.888), (6.837, 45.934)]
BIVOUACS = [(6.952, 46.003), (6.87, 45.99), (6.93, 45.958)]

def cartes(c, p, ph):
    """Plan, relief, satellite, 3D ; puis les filtres qui s'allument (dans le téléphone)."""
    V = (6.88, 45.945, 0.9)
    t_plan = ph('Plan. Relief')['debut']
    layers = []
    for k, src in enumerate(['plan-z12', 'relief-z12', 'alpes-z12']):
        mv = MapView(c, 'z12', 614, 1362, V, src=src, extra_style=f'opacity:{1 if k == 0 else 0}', att=(k == 0))
        layers.append(mv)
    # repères filtrés (posés sur la couche du dessus, pour suivre la 3D)
    top = layers[2]; inv = 1 / V[2]
    groups = {'s': [], 'e': [], 'r': [], 'b': []}
    for pts in SENTIERS:
        groups['s'].append(top.path(pts, '#D0A070', 6 / V[2]))
    for (lo, la), g, icn, col in [(q, 'e', 'drop', '#3E7CA8') for q in EAU] + [(q, 'r', 'bed', '#17402C') for q in REFUGES] + [(q, 'b', 'tent', '#5B7F55') for q in BIVOUACS]:
        groups[g].append(top.pin(lo, la, '', icn, col, None, inv))
    # les trois styles empilés dans un plan qui peut basculer en 3D
    stack = ''.join(mv.html() for mv in layers)
    seg_items = ['Plan', 'Relief', 'Satellite', '3D']
    seg = ('<div style="position:absolute;left:26px;right:26px;top:166px;height:64px;border-radius:32px;background:rgba(255,255,255,.82);box-shadow:0 6px 18px rgba(11,31,23,.12);display:flex;padding:6px;z-index:21">'
           '<div id="ch2-segk" style="position:absolute;left:6px;top:6px;width:calc((100% - 12px)/4);height:52px;border-radius:26px;background:#17402C"></div>'
           + ''.join(f'<div id="ch2-seg{k}" style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;font:600 21px Inter;color:{"#FAF8F5" if k == 0 else "#17402C"}">{t}</div>' for k, t in enumerate(seg_items)) + '</div>')
    rows = [('steps', 'Itinéraires', 'Sentiers balisés', 's'), ('drop', "Points d'eau", 'Sources, fontaines', 'e'), ('bed', 'Refuges', 'Gardés, non gardés', 'r'), ('tent', 'Bivouacs', 'Là où c\'est permis', 'b')]
    rh = ''
    for icn, k, v, g in rows:
        rh += (f'<div class="row"><div class="ic">{ico(icn)}</div><div class="tx"><div class="k">{k}</div><div class="v">{v}</div></div>'
               f'<div id="ch2-tg{g}" style="width:74px;height:44px;border-radius:22px;background:rgba(11,31,23,.14);position:relative"><div id="ch2-tk{g}" style="position:absolute;left:4px;top:4px;width:36px;height:36px;border-radius:18px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2)"></div></div></div>')
    sheet = (f'<div id="ch2-cal" class="card" style="position:absolute;left:14px;right:14px;bottom:136px;padding:18px 24px 6px;border-radius:30px;opacity:0;z-index:22">'
             f'<div style="display:flex;align-items:center"><div class="h2" style="font-size:28px">Calques</div><div class="sp" style="flex:1"></div><span id="ch2-sv" class="chip" style="opacity:0">Mes filtres · enregistrés</span></div>{rh}</div>')
    p.page(f'<div id="ch2-3d" style="position:absolute;inset:0;perspective:1100px"><div id="ch2-pl" style="position:absolute;inset:0;transform-style:preserve-3d">{stack}</div></div>'
           + header('Chamonix-Mont-Blanc', ('search', 'layers')) + seg + sheet + tabs(1), t_plan - 0.1, None, trans='fade')
    # bascule des styles
    marks = [t_plan, t_plan + 1.0, t_plan + 2.05, t_plan + 2.75]
    for k in (1, 2):
        c.tw(f'tl.to("#{layers[k].id}", {{opacity:1, duration:0.35, ease:"power1.inOut"}}, {c.L(marks[k])});')
    for k, t in enumerate(marks):
        c.tw(f'tl.to("#ch2-segk", {{x:{k * 140.5}, duration:0.35, ease:"power3.inOut"}}, {c.L(t)});')
        c.tw(f'tl.to("#ch2-seg{k}", {{color:"#FAF8F5", duration:0.2}}, {c.L(t + 0.1)});')
        if k: c.tw(f'tl.to("#ch2-seg{k - 1}", {{color:"#17402C", duration:0.2}}, {c.L(t + 0.1)});')
    # 3D : le plan bascule, puis tourne doucement
    t3 = marks[3]
    c.tw(f'tl.to("#ch2-pl", {{rotationX:52, scale:1.35, y:120, duration:1.2, ease:"power2.inOut"}}, {c.L(t3)});')
    c.tw(f'tl.to("#ch2-pl", {{rotationZ:-14, duration:2.6, ease:"sine.inOut"}}, {c.L(t3 + 1.2)});')
    # retour à plat, en plan, pour filtrer
    tf = ph('Tu filtres')['debut']
    c.tw(f'tl.to("#ch2-pl", {{rotationX:0, rotationZ:0, scale:1, y:0, duration:0.8, ease:"power3.inOut"}}, {c.L(tf - 0.6)});')
    c.tw(f'tl.to("#{layers[2].id}", {{opacity:0.0001, duration:0.4}}, {c.L(tf - 0.2)});')
    c.tw(f'tl.to("#{layers[1].id}", {{opacity:0, duration:0.4}}, {c.L(tf - 0.2)});')
    c.tw(f'tl.to("#ch2-segk", {{x:0, duration:0.35, ease:"power3.inOut"}}, {c.L(tf - 0.2)});')
    c.tw(f'tl.to("#ch2-seg3", {{color:"#17402C", duration:0.2}}, {c.L(tf - 0.1)}); tl.to("#ch2-seg0", {{color:"#FAF8F5", duration:0.2}}, {c.L(tf - 0.1)});')
    # l'image satellite s'efface mais ses repères restent : on rend l'image seule transparente
    c.tw(f'tl.to("#{layers[2].id} img", {{opacity:0, duration:0.01}}, {c.L(tf)}); tl.set("#{layers[2].id}", {{opacity:1}}, {c.L(tf + 0.02)}); tl.set("#{layers[2].id}", {{backgroundColor:"rgba(0,0,0,0)"}}, {c.L(tf)});')
    for g in groups:
        for pid in groups[g]:
            c.set(f'#{pid}', 0, opacity=0)
    c.show('#ch2-cal', tf, None, d=0.5, y=120)
    ts = ph('Les sentiers. L')['debut']
    for k, g in enumerate(['s', 'e', 'r', 'b']):
        t = ts + k * 0.92
        c.tw(f'tl.to("#ch2-tg{g}", {{backgroundColor:"#17402C", duration:0.2}}, {c.L(t)}); tl.to("#ch2-tk{g}", {{x:30, duration:0.25, ease:"back.out(2)"}}, {c.L(t)});')
        sel = ', '.join('#' + i for i in groups[g])
        if g == 's':
            c.tw(f'tl.fromTo("{sel}", {{opacity:0}}, {{opacity:1, duration:0.4, stagger:0.06}}, {c.L(t + 0.1)});')
        else:
            c.tw(f'tl.fromTo("{sel}", {{opacity:0, y:-16}}, {{opacity:1, y:0, duration:0.35, stagger:0.07, ease:"back.out(2.5)"}}, {c.L(t + 0.1)});')
    c.show('#ch2-sv', ph('Rien que ce qui')['debut'] + 0.2, None, d=0.35, sc=0.8)

def roles(c, ph):
    """Chaque carte et son rôle : un carrousel de cinq écrans sur fond d'encre."""
    t_in, t_out = 68.85, 81.25
    items = [('Le globe', 'pour rêver', 'Le globe', 'img:Monde'), ("L'exploration", 'pour choisir', "L'exploration", 'img:Calques'),
             ('Le Compas', 'pour préparer', 'Le Compas', 'map'), ('Le terrain', 'pour avancer', 'Le terrain', 'img:live'), ('Le carnet', 'pour te souvenir', 'Le carnet', 'img:carnet-tmb-jours')]
    W_, H_, STEP = 400, 868, 470
    tiles = ''
    for k, (nm, role, key, src) in enumerate(items):
        if src == 'map':
            mv = MapView(c, 'z10', W_ - 16, H_ - 16, (6.52, 45.93, 0.62))
            s = 0.62
            mv.path(TRAIN, '#FAF8F5', 3 / s, dash=f'{6 / s:.1f} {7 / s:.1f}'); mv.path(KAYAK, '#7FC4D9', 6 / s); mv.path(RANDO, '#D0A070', 7 / s)
            mv.pin(TALLOIRES[0], TALLOIRES[1], 'J1', 'waves', '#3E7CA8', None, 1 / s); mv.pin(CHAMONIX[0], CHAMONIX[1], 'J2', 'rope', '#B7791F', None, 1 / s); mv.pin(LAC_BLANC[0], LAC_BLANC[1] + 0.01, 'J3', 'bed', '#17402C', None, 1 / s)
            inner = mv.html().replace('class="pin" style="', 'class="pin" style="opacity:1;')
        else:
            inner = f'<img src="assets/app/{src[4:]}.jpg" alt="" style="width:100%;height:100%;object-fit:cover;object-position:top">'
        tiles += (f'<div id="ch2-r{k}" style="position:absolute;left:{k * STEP}px;top:0;width:{W_}px;height:{H_}px;border-radius:54px;background:#0A0F0C;padding:8px;box-shadow:0 40px 90px rgba(0,0,0,.5)">'
                  f'<div style="position:relative;width:100%;height:100%;border-radius:46px;overflow:hidden;background:#EEF1EC">{inner}</div></div>')
    c.add(f'<div id="ch2-car" style="position:absolute;left:{540 - W_ // 2}px;top:420px;width:{W_}px;height:{H_}px;opacity:0;z-index:30">{tiles}</div>')
    c.add('<div id="ch2-rk" class="kick" style="top:300px">Une carte pour chaque moment</div>')
    for k, (nm, role, key, src) in enumerate(items):
        c.add(f'<div id="ch2-rt{k}" class="big" style="top:1330px;font-size:84px"><span style="font-family:Inter;font-style:normal;font-weight:700;font-size:62px;color:#FAF8F5">{esc(nm)}</span><br><span style="color:#D0A070">{esc(role)}</span></div>')
    c.show('#ch2-car', t_in, t_out, d=0.6, y=80)
    c.show('#ch2-rk', t_in + 0.2, t_out, d=0.5, y=10)
    keys = ['Le globe, pour', "L'exploration, pour", 'Le Compas, pour', 'Le terrain, pour', 'Le carnet, pour']
    for k, kk in enumerate(keys):
        t = ph(kk)['debut'] - 0.15
        nxt = ph(keys[k + 1])['debut'] - 0.3 if k + 1 < len(keys) else t_out
        c.tw(f'tl.to("#ch2-car > div", {{x:{-k * STEP}, duration:0.6, ease:"power3.inOut"}}, {c.L(t - 0.35)});')
        for j in range(5):
            c.tw(f'tl.to("#ch2-r{j}", {{scale:{1 if j == k else 0.82}, opacity:{1 if j == k else 0.35}, duration:0.6, ease:"power3.inOut"}}, {c.L(t - 0.35)});')
        c.show(f'#ch2-rt{k}', t, nxt, d=0.45, y=24, d_out=0.25)

def demain(c, ph):
    """Les couches de demain, en plein écran sur l'arc alpin (vision : données ouvertes, pas encore dans l'app)."""
    t_in, t_out = 81.2, 95.85
    V = (7.4, 45.75, 1.32)
    def S(lon, lat):
        X, Y = P(lon, lat, 'z8'); Xc, Yc = P(V[0], V[1], 'z8')
        return (X - Xc) * V[2] + 540, (Y - Yc) * V[2] + 960
    bases = []
    for k, src in enumerate(['alpes-z8', 'alpes-z8', 'nuit-z8']):
        mv = MapView(c, 'z8', 1080, 1920, V, src=src, att=(k == 0)); bases.append(mv)
    planes = []   # (id, html) : chaque couche est un plan à part, pour l'éclaté 3D final
    for k, mv in enumerate(bases):
        planes.append((f'ch2-b{k}', f'<div id="ch2-b{k}" class="pl" style="opacity:{1 if k == 0 else 0}">{mv.html()}{"<div style=&quot;position:absolute;inset:0;background:rgba(6,18,12,.55)&quot;></div>".replace("&quot;", chr(34)) if k == 0 else ""}</div>'))
    import math
    # couloirs aériens : arcs entre grandes villes, pointillés qui filent
    cities = [(2.35, 48.86), (4.85, 45.76), (6.14, 46.2), (8.55, 47.45), (9.19, 45.46), (11.25, 43.77), (12.33, 45.44), (5.37, 43.3), (11.58, 48.14)]
    arcs = ''
    for a, b in [(0, 4), (1, 7), (2, 6), (3, 5), (8, 1), (0, 6), (2, 7), (3, 4)]:
        x1, y1 = S(*cities[a]); x2, y2 = S(*cities[b]); mx, my = (x1 + x2) / 2, (y1 + y2) / 2 - 0.18 * math.hypot(x2 - x1, y2 - y1)
        arcs += f'<path d="M{x1:.0f} {y1:.0f} Q{mx:.0f} {my:.0f} {x2:.0f} {y2:.0f}" fill="none" stroke="#FAF8F5" stroke-width="3" stroke-dasharray="14 12" opacity=".9"/>'
    planes.append(('ch2-air', f'<div id="ch2-air" class="pl" style="opacity:0"><svg width="1080" height="1920"><g id="ch2-airg">{arcs}</g></svg></div>'))
    # feux de forêt : foyers qui palpitent (Provence, Ligurie)
    fires = ''
    for k, (lo, la) in enumerate([(5.9, 43.45), (6.3, 43.55), (6.55, 43.35), (5.6, 43.7), (8.1, 44.05), (7.0, 43.75), (6.1, 43.9)]):
        x, y = S(lo, la)
        fires += f'<circle class="ch2-fire" cx="{x:.0f}" cy="{y:.0f}" r="18" fill="#FF6A2B" opacity=".9"/><circle cx="{x:.0f}" cy="{y:.0f}" r="44" fill="url(#ch2-fg)"/>'
    planes.append(('ch2-fire', '<div id="ch2-fire" class="pl" style="opacity:0"><svg width="1080" height="1920"><defs><radialGradient id="ch2-fg"><stop offset="0" stop-color="#FF8A3D" stop-opacity=".7"/><stop offset="1" stop-color="#FF8A3D" stop-opacity="0"/></radialGradient></defs>' + fires + '</svg></div>'))
    # avalanche : massifs colorés par niveau de risque
    av = ''
    for lo, la, rx, ry, col, lv in [(6.9, 45.88, 70, 50, '#F59E0B', '3'), (6.75, 45.4, 90, 60, '#FACC15', '2'), (6.3, 44.92, 90, 70, '#F59E0B', '3'), (7.6, 46.05, 110, 60, '#EA580C', '4'), (8.0, 46.55, 100, 55, '#FACC15', '2'), (7.2, 45.65, 60, 45, '#FACC15', '2')]:
        x, y = S(lo, la)
        av += f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{rx}" ry="{ry}" fill="{col}" opacity=".55" stroke="{col}" stroke-width="3"/><text x="{x:.0f}" y="{y + 14:.0f}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="40" fill="#FAF8F5" stroke="#0B1F17" stroke-width="7" paint-order="stroke">{lv}</text>'
    planes.append(('ch2-ava', f'<div id="ch2-ava" class="pl" style="opacity:0"><svg width="1080" height="1920">{av}</svg></div>'))
    # qualité de l'air : nappes douces
    air = '<defs>' + ''.join(f'<radialGradient id="ch2-a{k}"><stop offset="0" stop-color="{col}" stop-opacity=".42"/><stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient>' for k, col in enumerate(['#F59E0B', '#84CC16', '#FACC15'])) + '</defs>'
    for lo, la, r, k in [(9.6, 45.25, 330, 0), (4.85, 45.76, 200, 2), (6.4, 46.3, 220, 1), (7.3, 45.2, 260, 1), (11.3, 45.4, 260, 2)]:
        x, y = S(lo, la); air += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="url(#ch2-a{k})"/>'
    planes.append(('ch2-air2', f'<div id="ch2-air2" class="pl" style="opacity:0"><svg width="1080" height="1920">{air}</svg></div>'))
    # crues : rivières surlignées
    rivers = [[(6.87, 45.92), (6.7, 45.905), (6.58, 46.06), (6.3, 46.15), (6.15, 46.2)], [(6.15, 46.2), (5.8, 46.1), (5.4, 45.85), (4.85, 45.76), (4.82, 45.2), (4.8, 44.5), (4.7, 43.7)],
              [(7.0, 45.6), (6.4, 45.5), (5.9, 45.25), (5.3, 45.05), (4.85, 44.95)], [(7.6, 45.0), (8.6, 45.1), (9.6, 45.05), (10.8, 45.05), (12.3, 44.97)]]
    rv = ''
    for k, r in enumerate(rivers):
        d = 'M' + ' L'.join(f'{S(*q)[0]:.0f} {S(*q)[1]:.0f}' for q in r)
        rv += f'<path d="{d}" fill="none" stroke="{"#F59E0B" if k == 2 else "#38BDF8"}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>'
    planes.append(('ch2-crue', f'<div id="ch2-crue" class="pl" style="opacity:0"><svg width="1080" height="1920">{rv}</svg></div>'))
    # ciel étoilé : étoiles au-dessus des zones les plus noires
    import random
    rnd = random.Random(7); stars = ''
    for k in range(70):
        lo, la = 6.0 + rnd.random() * 5.5, 45.0 + rnd.random() * 2.0
        x, y = S(lo, la); stars += f'<circle class="ch2-st" cx="{x:.0f}" cy="{y:.0f}" r="{1.5 + rnd.random() * 2.5:.1f}" fill="#FFF7E0"/>'
    planes.append(('ch2-sky', f'<div id="ch2-sky" class="pl" style="opacity:0"><svg width="1080" height="1920">{stars}</svg></div>'))
    c.style('.pl { position:absolute; left:0; top:0; width:1080px; height:1920px; }')
    c.add(f'<div id="ch2-fs" style="position:absolute;inset:0;opacity:0;z-index:35;perspective:1600px;overflow:hidden;background:#06120C"><div id="ch2-st" style="position:absolute;inset:0;transform-style:preserve-3d">{"".join(h for _, h in planes)}</div></div>')
    # légende « bientôt »
    L = [('nav', 'Couloirs aériens', 'Les couloirs'), ('flame', 'Feux de forêt', 'Les feux'), ('snow', "Risque d'avalanche", 'Le risque'), ('leaf', "Qualité de l'air", 'La qualité'), ('waves', 'Crues', 'Les crues'), ('star', 'Ciel étoilé', 'Le ciel')]
    lg = ''.join(f'<div id="ch2-lg{k}" style="display:flex;align-items:center;gap:12px;margin-top:12px;opacity:0">{ico(i, "ico", "width:28px;height:28px;color:#17402C")}<span style="font:600 24px Inter;color:#0B1F17">{n}</span></div>' for k, (i, n, _) in enumerate(L))
    c.add(f'<div id="ch2-leg" class="card" style="position:absolute;left:50px;top:210px;width:420px;opacity:0;z-index:40;background:rgba(250,248,245,.94)">'
          f'<div style="display:flex;align-items:center;gap:10px"><span class="lbl">Couches</span><span class="chip" style="background:#D0A070;color:#0B1F17;height:36px;font-size:17px">bientôt</span></div>{lg}'
          f'<div class="sub" style="font-size:16px;margin-top:14px">Vision : données publiques et ouvertes.</div></div>')
    for k, (i, n, key) in enumerate(L):
        c.add(f'<div id="ch2-lb{k}" class="call dark" style="left:50%;top:1560px;transform:translateX(-50%);font-size:44px;padding:22px 36px">{ico(i)}<span>{n}</span></div>')
    c.add('<div id="ch2-dk" class="kick" style="top:760px;z-index:41">Bientôt · données ouvertes</div>')
    c.add('<div id="ch2-dt" class="big" style="top:820px;font-size:104px;z-index:41;text-shadow:0 4px 30px rgba(6,18,12,.8)">Et demain, <span style="color:#D0A070">bien plus.</span></div>')
    c.add('<div id="ch2-one" class="big" style="top:1500px;font-size:80px;z-index:41;text-shadow:0 4px 30px rgba(6,18,12,.9)">sur une <span style="color:#D0A070">seule</span> carte.</div>')
    td = ph('Et demain')['debut']
    c.show('#ch2-fs', t_in, t_out, d=0.6, d_out=0.45)
    c.tw(f'tl.fromTo("#ch2-st", {{scale:1.12}}, {{scale:1.0, duration:{t_out - t_in}, ease:"none"}}, {c.L(t_in)});')
    c.show('#ch2-dk', td - 0.1, ph('Les couloirs')['debut'] - 0.1, d=0.5, y=10, d_out=0.3)
    c.show('#ch2-dt', td, ph('Les couloirs')['debut'] - 0.1, d=0.6, y=24, d_out=0.3)
    c.show('#ch2-leg', ph('Les couloirs')['debut'] - 0.1, ph('Tout ce que')['debut'] - 0.2, d=0.5, x=-40)
    c.to('#ch2-b0', ph('Les couloirs')['debut'] - 0.2, d=0.01)
    c.tw(f'tl.to("#ch2-b1", {{opacity:1, duration:0.5}}, {c.L(ph("Les couloirs")["debut"] - 0.3)});')
    order = ['ch2-air', 'ch2-fire', 'ch2-ava', 'ch2-air2', 'ch2-crue', 'ch2-sky']
    for k, ((i, n, key), pid) in enumerate(zip(L, order)):
        t = ph(key)['debut']; nxt = ph(L[k + 1][2])['debut'] if k + 1 < len(L) else ph('Tout ce que')['debut']
        c.tw(f'tl.fromTo("#{pid}", {{opacity:0}}, {{opacity:1, duration:0.4}}, {c.L(t - 0.1)});')
        c.show(f'#ch2-lg{k}', t - 0.05, None, d=0.3, x=-20)
        c.show(f'#ch2-lb{k}', t - 0.05, nxt - 0.1, d=0.35, y=20, d_out=0.2)
    # mouvements propres à chaque couche
    c.tw(f'tl.fromTo("#ch2-airg path", {{strokeDashoffset:0}}, {{strokeDashoffset:-260, duration:{t_out - 83.4:.2f}, ease:"none"}}, {c.L(83.4)});')
    c.tw(f'tl.fromTo(".ch2-fire", {{attr:{{r:12}}}}, {{attr:{{r:22}}, duration:0.45, repeat:20, yoyo:true, ease:"sine.inOut"}}, {c.L(ph("Les feux")["debut"])});')
    c.tw(f'tl.fromTo(".ch2-st", {{opacity:0.2}}, {{opacity:1, duration:0.4, stagger:{{each:0.02, repeat:9, yoyo:true}}, ease:"sine.inOut"}}, {c.L(ph("Le ciel")["debut"])});')
    # la nuit : Black Marble remplace le satellite
    c.tw(f'tl.to("#ch2-b2", {{opacity:1, duration:0.6}}, {c.L(ph("Le ciel")["debut"] - 0.2)});')
    # éclaté 3D : toutes les couches se séparent, puis se referment en une seule carte
    te = ph('Tout ce que')['debut']
    ids = [p for p, _ in planes]
    c.tw(f'tl.to("#ch2-st", {{rotationX:58, rotationZ:-18, scale:0.62, y:120, duration:1.3, ease:"power3.inOut"}}, {c.L(te - 0.1)});')
    for k, pid in enumerate(ids):
        c.tw(f'tl.to("#{pid}", {{z:{k * 70}, opacity:{0.85 if k > 2 else (1 if k == 2 else 0.9)}, duration:1.3, ease:"power3.inOut"}}, {c.L(te - 0.1)});')
        c.tw(f'tl.to("#{pid}", {{z:0, duration:0.9, ease:"power3.inOut"}}, {c.L(ph("sur une seule")["debut"] - 0.3)});')
    c.tw(f'tl.to("#ch2-st", {{rotationX:0, rotationZ:0, scale:1, y:0, duration:0.9, ease:"power3.inOut"}}, {c.L(ph("sur une seule")["debut"] - 0.3)});')
    c.show('#ch2-one', ph('sur une seule')['debut'], t_out, d=0.5, y=20, d_out=0.35)

# ================================================================ III. c'est trop compliqué
def ch3(R, ch, ph):
    t0, t1 = ch['debut'], ch['fin']; c = Comp('ch3', t0, t1)
    p = Phone(c, 114.833, t1 - 0.1)
    # Où
    q = '5 jours dans les Alpes, rando, via ferrata et kayak, en juillet'
    typed = c.typing(q, 115.183, cps=16)
    go = c.u('go')
    where = (header('Nouvelle aventure', ('sun', 'menu')) +
             f'<div class="body" style="top:520px"><div class="h1" style="font-size:52px;margin-bottom:30px">Où veux-tu <span class="em" style="font-size:58px">aller</span> ?</div>'
             f'<div class="input" style="height:auto;min-height:80px;padding:16px 12px 16px 28px;align-items:flex-end"><div style="flex:1;line-height:1.3">{typed}</div><div id="{go}" class="go">{ico("send")}</div></div>'
             f'<div style="margin-top:22px">{chips(["Vercors, 3 jours à 4", "Le Vercors en solo"])}</div>'
             f'<div class="sub" style="margin-top:28px;font-size:19px">Une IA peut t\'aider à lire ta demande et proposer des étapes. Ce qu\'elle propose est vérifié sur la carte.</div></div>' + tabs(1))
    tp = []
    p.page(where + ''.join(tp), 114.933, 121.283, trans='fade')
    c.press(f'#{go}', 120.183); c.tap(p.kids, 533, 690, 120.133)
    # Voici ce que j'ai compris
    rows = [('mountain', 'Activités', 'Randonnée · Via ferrata · Kayak'), ('pin', 'Lieu', 'Alpes du Nord · Annecy → Chamonix'),
            ('cal', 'Durée', '5 jours · 4 nuits'), ('sun', 'Quand', 'Juillet'), ('bed', 'Nuits', 'Gîte · refuge'), ('euro', 'Budget', 'à préciser')]
    rh = ''
    rids = []
    for k, (icn, kk, vv) in enumerate(rows):
        rid = c.u('rw'); rids.append(rid); rh += row(icn, kk, vv, rid=rid).replace('class="row"', 'class="row" style="opacity:0"')
    prog = c.u('pr')
    understood = (header('Nouvelle aventure', ('sun', 'menu')) +
                  f'<div class="body"><div class="lbl">Ta demande</div><div class="sub" style="margin:10px 0 24px;font-size:22px;color:#0B1F17">« {esc(q)} »</div>'
                  f'<div class="h2" style="margin-bottom:12px">Voici ce que <span class="em">j\'ai compris</span></div><div class="card" style="padding:4px 24px">{rh}</div>'
                  f'<div class="card" style="margin-top:20px;display:flex;align-items:center;gap:16px">{ico("compass")}<div style="flex:1"><div class="k" style="font:600 22px Inter;color:#0B1F17">Le Compas prépare tout…</div>'
                  f'<div style="height:8px;border-radius:4px;background:rgba(23,64,44,.12);margin-top:10px;overflow:hidden"><div id="{prog}" style="height:100%;width:100%;background:#17402C;transform-origin:0 50%"></div></div></div></div></div>' + tabs(1))
    p.page(understood, 121.283, 123.733, trans='slide'); c.set(f'#{prog}', 0, scaleX=0)
    for k, rid in enumerate(rids): c.show(f'#{rid}', 121.433 + k * 0.22, None, d=0.35, x=30)
    c.to(f'#{prog}', 122.633, d=1.0, ease='power1.inOut', scaleX=1)
    # la carte : vrais sentiers, vrais refuges, le train
    m = MapView(c, 'z10', 614, 1362, (6.56, 45.95, 0.85))
    s = 0.85
    m.path(TRAIN, '#FAF8F5', 3 / s, dash=f'{6 / s:.1f} {7 / s:.1f}', pid='ch3-train', opacity=0.95)
    k1 = m.path(KAYAK, '#7FC4D9', 6 / s); k2 = m.path(RANDO, '#D0A070', 7 / s)
    m.draw(k1, 124.033, 0.9); m.draw(k2, 125.033, 1.0)
    c.tw(f'tl.fromTo("#ch3-train", {{opacity:0}}, {{opacity:0.95, duration:0.6}}, {c.L(124.333)});')
    m.pin(TALLOIRES[0], TALLOIRES[1], 'J1 · Kayak', 'waves', '#3E7CA8', 124.033, 1 / s)
    m.pin(FERRATA[0] - 0.04, FERRATA[1] - 0.01, 'J2 · Via ferrata', 'rope', '#B7791F', 124.733, 1 / s)
    m.pin(LAC_BLANC[0], LAC_BLANC[1] + 0.01, 'J3 · Refuge du Lac Blanc', 'bed', '#17402C', 125.333, 1 / s)
    m.cam(123.733, 9.0, (6.57, 45.945, 0.9), ease='none')
    sheet = c.u('sh'); met = c.u('met'); res = c.u('res'); bud = c.u('bud')
    hours = [('7 h', 'sun', '9°'), ('10 h', 'cloudsun', '14°'), ('13 h', 'cloudsun', '17°'), ('16 h', 'storm', '15°'), ('19 h', 'cloud', '12°')]
    meteo = ''.join(f'<div style="flex:1;text-align:center"><div class="lbl" style="letter-spacing:.06em">{h}</div><div style="margin:10px 0;color:{"#B7791F" if i == "storm" else "#17402C"}">{ico(i)}</div><div class="mono" style="font:600 22px JetBrains Mono;color:#0B1F17">{tt}</div></div>' for h, i, tt in hours)
    resv = [('train', 'Train Annecy → Chamonix', 'J2 · 8 h 12', '18,40 €'), ('bed', 'Refuge du Lac Blanc', 'J3 · demi-pension', '62,00 €'), ('waves', 'Kayak · 2 heures', 'J1 · Talloires', '30,00 €')]
    rr = ''; rrid = []
    for icn, kk, vv, pr in resv:
        i = c.u('rv'); rrid.append(i); rr += row(icn, kk, vv, pr, rid=i).replace('class="row"', 'class="row" style="opacity:0"')
    tot = c.u('tot')
    panel = (f'<div id="{sheet}" class="card" style="position:absolute;left:18px;right:18px;bottom:140px;padding:20px 24px;border-radius:30px">'
             f'<div id="{met}" style="opacity:0"><div style="display:flex;align-items:center;gap:10px"><div class="lbl">Météo · J3 · heure par heure</div><div class="sp" style="flex:1"></div><span class="lbl" style="letter-spacing:.06em">MET Norway</span></div><div style="display:flex;margin-top:16px">{meteo}</div></div>'
             f'<div id="{res}" style="opacity:0;position:absolute;left:24px;right:24px;top:20px"><div class="lbl">Réservations</div>{rr}</div></div>')
    budget = (f'<div id="{bud}" class="card" style="position:absolute;left:18px;right:18px;top:170px;display:flex;align-items:center;gap:16px;opacity:0">{ico("euro")}<div style="flex:1"><div class="lbl">Total des réservations</div>'
              f'<div class="sub" style="font-size:17px;margin-top:6px">Offres : le classement n\'est jamais influencé par la commission.</div></div><div id="{tot}" class="mono" style="font:700 34px JetBrains Mono;color:#17402C">0 €</div></div>')
    p.page(m.html() + header('Alpes du Nord · 5 jours', ('layers', 'menu')) + panel + budget + tabs(1), 123.733, 135.433, trans='fade')
    c.show(f'#{sheet}', 127.333, None, d=0.5, y=80)
    c.show(f'#{met}', 127.433, 130.033, d=0.4, d_out=0.25)
    c.tw(f'tl.to("#{sheet}", {{height:440, duration:0.45, ease:"power3.inOut"}}, {c.L(129.883)});')
    c.show(f'#{res}', 130.033, None, d=0.3)
    for k, i in enumerate(rrid): c.show(f'#{i}', ph('Le train')['debut'] + k * 0.85, None, d=0.35, x=30)
    c.show(f'#{bud}', ph('Chaque réservation')['debut'], None, d=0.45, y=-30)
    c.count(tot, 0, 110, ph('Chaque réservation')['debut'] + 0.3, 1.4, suffix=',40 €')
    call(c, f'{ico("bed")}<span>Refuge du Lac Blanc</span><span class="mono">2 352 m · 40 places</span>', 70, 1480, ph('De vrais sentiers')['debut'] + 0.9, 127.433)
    # le verdict
    axes = [('Physique', 'mountain', 'Prêt', 'ok', 'Marche de 5 à 6 h, 1 000 m de dénivelé : dans tes cordes.', ph('La marche')['debut'] + 0.7),
            ('Technique', 'rope', 'Vigilance', 'amber', 'Via ferrata, première fois : une sortie encadrée est conseillée.', ph('Vigilance')['debut'] - 0.05),
            ('Conjoncturel', 'storm', 'À surveiller', 'amber', 'Orage possible le J3 après 15 h.', ph('Pas une note')['debut'] + 0.6)]
    ah = ''; aid = []
    for nm, icn, st, cl, tx, t in axes:
        i = c.u('ax'); aid.append((i, st, cl, t))
        ah += (f'<div class="card" style="margin-top:16px"><div style="display:flex;align-items:center;gap:14px"><div class="ic" style="width:54px;height:54px;border-radius:27px;background:rgba(91,127,85,.14);display:flex;align-items:center;justify-content:center;color:#17402C">{ico(icn)}</div>'
               f'<div class="k" style="font:600 25px Inter;color:#0B1F17;flex:1">{nm}</div><span class="chip" id="{i}n" style="background:rgba(11,31,23,.06);color:#5E6B63">non évalué</span>'
               f'<span class="chip {cl}" id="{i}s" style="display:none">{st}</span></div><div class="sub" id="{i}t" style="margin-top:12px;font-size:20px;opacity:0">{tx}</div></div>')
    verdict = (header('Verdict', ('sun', 'menu')) + f'<div class="body"><div class="h1">Prêt à <span class="em" style="font-size:46px">partir</span> ?</div>'
               f'<div style="margin:18px 0 6px">{chips(["Risques", "Météo", "Signaux vérifiables · sans score"], on=2)}</div>{ah}</div>' + tabs(1))
    p.page(verdict, ph('Puis le verdict')['debut'] - 0.1, None, trans='slide')
    for i, st, cl, t in aid:
        c.set(f'#{i}n', t, display='none'); c.set(f'#{i}s', t, display='inline-flex')
        c.tw(f'tl.fromTo("#{i}s", {{scale:0.6, opacity:0}}, {{scale:1, opacity:1, duration:0.4, ease:"back.out(3)"}}, {c.L(t)});')
        c.show(f'#{i}t', t + 0.15, None, d=0.35, y=10)
    call(c, f'{ico("alert")}<span>Technique</span><span class="chip amber" style="font-size:26px;height:52px">Vigilance</span>', 120, 1480, ph('Vigilance')['debut'] + 0.1, t1 - 0.2, extra='font-size:34px')
    c.add(p.html())
    c.write(os.path.join(R, 'compositions', 'ch3.html'))
    return ('ch3', t0, t1)

# ================================================================ IV. personne avec qui partir
def ch4(R, ch, ph):
    t0, t1 = ch['debut'], ch['fin']; c = Comp('ch4', t0, t1)
    p = Phone(c, 149.693, 157.333)
    slots = ''.join('<div style="width:76px;height:76px;border-radius:38px;border:2px dashed rgba(23,64,44,.3)"></div>' for _ in range(3))
    bt = c.u('bt')
    nous = (header('Nous', ('sun', 'menu')) + f'<div class="body"><div class="h1">Équipe</div><div class="sub" style="margin-top:6px">Qui part avec toi ?</div>'
            f'<div class="card" style="margin-top:24px;display:flex;align-items:center;gap:18px"><div class="av" style="width:76px;height:76px;font-size:30px;background:#17402C">J</div>{slots}</div>'
            f'<div class="card" style="margin-top:20px;padding:4px 24px">{row("userplus", "Inviter quelqu&#39;un", "Un lien, un QR code")}{row("users", "Rejoindre un club", "Sorties encadrées près de toi")}</div>'
            f'<div id="{bt}" class="card" style="margin-top:20px;display:flex;align-items:center;gap:16px;background:#17402C;color:#FAF8F5">{ico("bottle", "ico", "width:40px;height:40px;color:#D0A070")}'
            f'<div style="flex:1"><div style="font:600 25px Inter">Bouteille</div><div style="font:500 19px Inter;opacity:.8;margin-top:4px">Lance une annonce, des voyageurs répondent</div></div>{ico("chev")}</div></div>' + tabs(2))
    p.page(nous, 149.783, 154.483, trans='fade')
    c.press(f'#{bt}', ph('Alors tu lances')['debut'] + 0.3); c.tap(p.kids, 307, 905, ph('Alors tu lances')['debut'] + 0.25)
    r1 = c.u('rp'); r2 = c.u('rp')
    bub = lambda who, col, txt, rid: (f'<div id="{rid}" class="card" style="margin-top:18px;display:flex;gap:16px;opacity:0"><div class="av" style="background:{col}">{who[0]}</div>'
                                      f'<div><div class="k" style="font:600 22px Inter;color:#0B1F17">{who}</div><div class="sub" style="margin-top:4px;color:#0B1F17">{txt}</div></div></div>')
    bottle = (header('Bouteille', ('menu',)) + f'<div class="body"><div class="card" style="background:#0B1F17;color:#FAF8F5;padding:28px">'
              f'<div style="display:flex;align-items:center;gap:12px;color:#D0A070">{ico("bottle")}<span class="lbl" style="color:#D0A070">Ta bouteille · lancée</span></div>'
              f'<div class="em" style="color:#FAF8F5;font-size:40px;line-height:1.2;margin-top:16px">Via ferrata à Chamonix, en juillet. Première fois. Qui vient ?</div>'
              f'<div style="margin-top:18px"><span class="chip" style="background:rgba(250,248,245,.12);color:#FAF8F5">30 km autour de Chamonix</span></div></div>'
              f'<div class="lbl" style="margin:28px 0 0 6px">Réponses</div>{bub("Sofia", "#B84A32", "Partante pour la via ferrata !", r1)}{bub("Marc", "#5B7F55", "Le club sort le 12 juillet, encadré par une guide.", r2)}</div>' + tabs(2))
    p.page(bottle, 154.483, None, trans='slide')
    c.show(f'#{r1}', ph('Deux réponses')['debut'], None, d=0.45, y=30)
    c.show(f'#{r2}', ph('Deux réponses')['debut'] + 0.55, None, d=0.45, y=30)
    c.add(p.html())
    # le club, la sortie
    call(c, f'{ico("users")}<span>Club · Alpinistes du dimanche</span>', 60, 300, ph('Puis un club')['debut'], 160.433)
    so = c.u('so')
    c.add(f'<div id="{so}" class="card" style="position:absolute;left:70px;right:70px;top:1330px;display:flex;align-items:center;gap:18px;opacity:0;z-index:40">'
          f'<div style="width:96px;height:96px;border-radius:20px;background:#17402C;color:#FAF8F5;display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="lbl" style="color:#D0A070">sam.</div><div style="font:700 40px Inter">12</div><div class="lbl" style="color:#FAF8F5;letter-spacing:.06em">juil.</div></div>'
          f'<div style="flex:1"><div class="k" style="font:600 28px Inter;color:#0B1F17">Via ferrata découverte</div><div style="margin-top:10px;display:flex;gap:8px"><span class="chip">encadrée</span><span class="chip">Facile</span><span class="chip">4 places</span></div></div></div>')
    c.show(f'#{so}', ph('Une via ferrata')['debut'], 160.483, d=0.5, y=40)
    call(c, f'{ico("shield")}<span>Espace Pro · Claire</span><span class="mono">guide de haute montagne</span>', 60, 300, ph('Un guide')['debut'], 163.933, extra='font-size:28px')
    ins = c.u('ins'); okk = c.u('ok')
    c.add(f'<div id="{ins}" class="btn" style="position:absolute;left:220px;width:640px;top:1450px;opacity:0;z-index:40;font-size:30px">{ico("plus")} S\'inscrire</div>')
    c.add(f'<div id="{okk}" class="btn" style="position:absolute;left:220px;width:640px;top:1450px;opacity:0;z-index:41;font-size:30px;background:#FAF8F5;color:#17402C">{ico("check")} Inscrit · 12 juillet</div>')
    c.show(f'#{ins}', ph('Un guide')['debut'] + 0.9, None, d=0.4, y=30)
    c.press(f'#{ins}', ph("Tu t'inscris")['debut'] + 0.1)
    c.show(f'#{okk}', ph("Tu t'inscris")['debut'] + 0.3, 163.983, d=0.3, sc=0.9)
    c.to(f'#{ins}', ph("Tu t'inscris")['debut'] + 0.25, d=0.1, opacity=0)
    # des inconnus, puis des prénoms
    tn = ph('Des inconnus')['debut'] + 0.6
    for k, (nm, x) in enumerate([('Julien', 120), ('Sofia', 300), ('Marc', 680), ('Claire', 905)]):
        name_tag(c, nm, x, 560 if k != 1 else 540, tn + k * 0.3, 168.333)
    hud(c, 'light', f'{ico("steps")}<span>Le groupe marche à <span class="em" style="font-size:34px">ton</span> rythme</span><span class="mono" style="color:#7E5A30;font-size:26px">3,2 km/h</span>', 120, 1420, ph('Le groupe marche')['debut'], 168.333)
    # messages, qui doit quoi
    p2 = Phone(c, 168.433, t1 - 0.1)
    msgs = [('Sofia', '#B84A32', 'Covoiturage depuis Annecy, 7 h ?', False), ('Toi', '#17402C', 'Je prends le pain !', True), ('Claire', '#7E5A30', 'Rendez-vous parking des Granges, 8 h 30.', False), ('Marc', '#5B7F55', '📷 Photo · la météo est bonne', False)]
    mh = ''; mid = []
    for who, col, txt, me in msgs:
        i = c.u('m'); mid.append(i)
        al = 'flex-end' if me else 'flex-start'
        bg = '#17402C;color:#FAF8F5' if me else 'rgba(255,255,255,.9);color:#0B1F17'
        av = '' if me else f'<div class="av" style="background:{col};width:46px;height:46px;font-size:18px">{who[0]}</div>'
        mh += (f'<div id="{i}" style="display:flex;justify-content:{al};gap:10px;margin-top:16px;opacity:0">{av}<div style="max-width:430px;padding:16px 20px;border-radius:24px;background:{bg};font:500 21px/1.35 Inter;box-shadow:0 4px 12px rgba(11,31,23,.08)">'
               f'{"" if me else f"<div style=&quot;font:600 16px Inter;color:#5B7F55;margin-bottom:4px&quot;>{who}</div>".replace("&quot;", chr(34))}{txt.replace("📷 ", "")}</div></div>')
    p2.page(header('Via ferrata · 12 juillet', ('users',)) + f'<div class="body">{mh}</div>' + tabs(3), 168.483, ph('Et qui doit quoi')['debut'] + 0.05, trans='fade')
    for k, i in enumerate(mid): c.show(f'#{i}', 168.583 + k * 0.38, None, d=0.35, y=24)
    debts = [('Sofia', '#B84A32', 'Toi', '12,50 €'), ('Toi', '#17402C', 'Marc', '8,00 €'), ('Claire', '#7E5A30', 'Sofia', '4,20 €')]
    dh = ''; did = []
    for a, col, b, v in debts:
        i = c.u('d'); did.append(i)
        dh += (f'<div id="{i}" class="row" style="opacity:0"><div class="av" style="background:{col};width:50px;height:50px;font-size:20px">{a[0]}</div><div class="tx"><div class="k">{a} {"dois" if a == "Toi" else "doit"} à {b}</div></div><div class="r mono" style="font:600 24px JetBrains Mono">{v}</div></div>')
    p2.page(header('Budget', ('menu',)) + f'<div class="body"><div class="h1">Qui doit <span class="em" style="font-size:46px">quoi</span>, à qui</div>'
            f'<div class="card" style="margin-top:22px;display:flex;align-items:center"><div style="flex:1"><div class="lbl">Dépenses partagées</div><div class="mono" style="font:700 40px JetBrains Mono;color:#0B1F17;margin-top:8px">236,80 €</div></div><span class="chip ok">4 personnes</span></div>'
            f'<div class="card" style="margin-top:18px;padding:4px 24px">{dh}</div><div style="margin-top:18px">{chips(["Équilibré en 3 virements"])}</div></div>' + tabs(1),
            ph('Et qui doit quoi')['debut'], None, trans='slide')
    for k, i in enumerate(did): c.show(f'#{i}', ph('Et qui doit quoi')['debut'] + 0.3 + k * 0.3, None, d=0.35, x=30)
    c.add(p2.html())
    c.write(os.path.join(R, 'compositions', 'ch4.html'))
    return ('ch4', t0, t1)

# ================================================================ V. pas le matériel
def ch5(R, ch, ph):
    t0, t1 = ch['debut'], ch['fin']; c = Comp('ch5', t0, t1)
    p = Phone(c, 179.133, 184.733)
    items = [('steps', 'Chaussures de randonnée', 'ok'), ('pack', 'Sac 30 L', 'ok'), ('lamp', 'Frontale', 'ok'), ('cloud', 'Veste imperméable', 'ok'),
             ('rope', 'Baudrier', 'no'), ('link', 'Longes de via ferrata', 'no'), ('helmet', 'Casque', 'no')]
    ih = ''; marks = []
    for icn, nm, st in items:
        i = c.u('it'); marks.append((i, st))
        ok = f'<span id="{i}a" class="chip ok" style="opacity:0">{ico("check", "ico", "width:20px;height:20px")} déjà</span>'
        no = f'<span id="{i}b" class="chip red" style="opacity:0;position:absolute;right:0">manque</span>'
        ih += f'<div class="row"><div class="ic">{ico(icn)}</div><div class="tx"><div class="k">{nm}</div></div><div style="position:relative;min-width:120px;display:flex;justify-content:flex-end">{ok if st == "ok" else no}</div></div>'
    p.page(header('Kit · Alpes du Nord', ('menu',)) + f'<div class="body"><div class="h1">Ton <span class="em" style="font-size:46px">inventaire</span></div>'
           f'<div class="sub" style="margin-top:6px">Ce que tu as déjà, ce qu\'il te manque.</div><div class="card" style="margin-top:20px;padding:4px 24px">{ih}</div></div>' + tabs(0), 179.233, None, trans='fade')
    k_ok = [i for i, s in marks if s == 'ok']; k_no = [i for i, s in marks if s == 'no']
    for k, i in enumerate(k_ok): c.tw(f'tl.fromTo("#{i}a", {{opacity:0, scale:0.6}}, {{opacity:1, scale:1, duration:0.35, ease:"back.out(3)"}}, {c.L(ph("ceci, tu")["debut"] + k * 0.25)});')
    for k, i in enumerate(k_no): c.tw(f'tl.fromTo("#{i}b", {{opacity:0, scale:0.6}}, {{opacity:1, scale:1, duration:0.35, ease:"back.out(3)"}}, {c.L(ph("Ceci, il te")["debut"] + k * 0.25)});')
    c.add(p.html())
    call(c, f'{ico("alert")}<span>1 vital à trouver</span><span class="mono">baudrier · longes</span>', 140, 1480, ph('Ceci, il te')['debut'] + 0.6, 184.683)
    call(c, f'{ico("repeat")}<span>Prêté par Léa</span><span class="mono">baudrier</span>', 60, 300, ph('Le baudrier, Léa')['debut'] + 0.3, 187.033)
    # Trouver
    p2 = Phone(c, 187.133, t1 - 0.1)
    finds = [('rope', 'Baudrier', 'Prêt · Léa', 'ok', '0 €', 187.233), ('link', 'Longes de via ferrata', 'Location · 3 jours', '', '12 €', ph('Les longes')['debut']),
             ('helmet', 'Casque', 'Occasion · très bon état', '', '18 €', ph('Le reste se trouve')['debut']), ('drop', 'Gourde filtrante', 'Boutique · liens partenaires', '', '34 €', ph('ou s\'achète')['debut'])]
    fh = ''; fid = []
    for icn, nm, how, cl, pr, t in finds:
        i = c.u('f'); fid.append((i, t))
        fh += f'<div id="{i}" class="row" style="opacity:0"><div class="ic">{ico(icn)}</div><div class="tx"><div class="k">{nm}</div><div class="v">{how}</div></div><div class="r mono" style="font:600 23px JetBrains Mono">{pr}</div></div>'
    cart = c.u('cart')
    p2.page(header('Kit · Trouver', ('menu',)) + f'<div class="body"><div style="margin-bottom:18px">{chips(["Conseils", "Mes kits", "Inventaire", "Trouver", "Emballer", "Sac", "Eau"], on=3)}</div>'
            f'<div class="card" style="padding:4px 24px">{fh}</div><div id="{cart}" class="btn" style="margin-top:24px;opacity:0">{ico("cart")} Panier · 1 article · 34 €</div></div>' + tabs(0), 187.233, 192.733, trans='fade')
    for i, t in fid: c.show(f'#{i}', t, None, d=0.4, x=40)
    c.show(f'#{cart}', ph("ou s'achète")['debut'] + 0.7, None, d=0.4, y=20)
    # Kit Studio (vidéo réelle posée au-dessus, dans index.html) — ici l'image fixe du même écran
    p2.page(cap('kit-studio-sauge'), 192.703, 195.733, trans='fade')
    # la lignée
    dots = ''.join(f'<div id="ch5-p{k}" style="width:40px;height:40px;border-radius:20px;background:{"#17402C" if k < 8 else "rgba(23,64,44,.15)"};opacity:.15"></div>' for k in range(10))
    tree = ('<svg width="560" height="250" viewBox="0 0 560 250" aria-hidden="true"><g stroke="#5B7F55" stroke-width="3" fill="none">'
            '<path id="ch5-l1" d="M280 40 C280 90 140 90 140 130"/><path id="ch5-l2" d="M280 40 C280 90 420 90 420 130"/><path id="ch5-l3" d="M140 130 C140 170 80 170 80 210"/><path id="ch5-l4" d="M140 130 C140 170 200 170 200 210"/><path id="ch5-l5" d="M420 130 C420 170 360 170 360 210"/><path id="ch5-l6" d="M420 130 C420 170 480 170 480 210"/></g>'
            '<g fill="#17402C"><circle cx="280" cy="40" r="18" fill="#D0A070"/><circle cx="140" cy="130" r="14"/><circle cx="420" cy="130" r="14"/><circle cx="80" cy="210" r="11"/><circle cx="200" cy="210" r="11"/><circle cx="360" cy="210" r="11"/><circle cx="480" cy="210" r="11"/></g></svg>')
    lin = (header('Lignée du kit', ('menu',)) + f'<div class="body"><div class="lbl">Kit souche</div><div class="h1" style="margin-top:8px">Via ferrata · <span class="em" style="font-size:46px">Alpes, été</span></div>'
           f'<div style="margin-top:14px">{chips(["kit souche", "éprouvé", "23 sorties GPS"])}</div><div class="card" style="margin-top:22px;display:flex;justify-content:center">{tree}</div>'
           f'<div class="card" style="margin-top:20px"><div class="k" style="font:600 25px Inter;color:#0B1F17">Gardé par <span id="ch5-n">8</span> voyageurs sur 10</div><div style="display:flex;gap:12px;margin-top:16px">{dots}</div>'
           f'<div class="sub" style="margin-top:12px;font-size:19px">Ce qu\'on garde d\'une génération à l\'autre, mesuré sur le terrain.</div></div></div>' + tabs(0))
    p2.page(lin, ph('Ce kit a une lignée')['debut'], ph('Quatorze')['debut'] - 0.1, trans='slide')
    c.tw(f'tl.to("#ch5-p0, #ch5-p1, #ch5-p2, #ch5-p3, #ch5-p4, #ch5-p5, #ch5-p6, #ch5-p7, #ch5-p8, #ch5-p9", {{opacity:1, duration:0.2, stagger:0.12}}, {c.L(ph("Gardé par huit")["debut"])});')
    # 14 % → prêt
    R0 = 170; L0 = 2 * 3.14159 * R0
    ring = (f'<svg width="420" height="420" viewBox="0 0 420 420" aria-hidden="true"><circle cx="210" cy="210" r="{R0}" fill="none" stroke="rgba(23,64,44,.12)" stroke-width="26"/>'
            f'<circle id="ch5-ring" cx="210" cy="210" r="{R0}" fill="none" stroke="#B7791F" stroke-width="26" stroke-linecap="round" transform="rotate(-90 210 210)" stroke-dasharray="{L0:.1f} {L0:.1f}" stroke-dashoffset="{L0 * 0.86:.1f}"/></svg>')
    pc = (header('Kit · Alpes du Nord', ('menu',)) + f'<div class="body" style="text-align:center"><div style="position:relative;width:420px;height:420px;margin:60px auto 0">{ring}'
          f'<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="mono" style="font:700 92px JetBrains Mono;color:#0B1F17"><span id="ch5-pc">14</span><span style="font-size:48px"> %</span></div></div></div>'
          f'<div id="ch5-st1" class="h2" style="margin-top:36px">Pas encore prêt</div><div id="ch5-st2" class="h1" style="margin-top:-38px;opacity:0;color:#17402C">Prêt</div>'
          f'<div class="sub" id="ch5-st3" style="margin-top:14px">1 vital à trouver</div></div>' + tabs(0))
    p2.page(pc, ph('Quatorze')['debut'] - 0.1, None, trans='fade')
    tp = ph('Puis prêt')['debut'] - 0.1
    c.tw(f'tl.to("#ch5-ring", {{attr:{{"stroke-dashoffset":0}}, stroke:"#17402C", duration:1.1, ease:"power2.inOut"}}, {c.L(tp)});')
    c.count('ch5-pc', 14, 100, tp, 1.1)
    c.to('#ch5-st1', tp + 0.5, d=0.25, opacity=0); c.to('#ch5-st3', tp + 0.5, d=0.25, opacity=0)
    c.tw(f'tl.fromTo("#ch5-st2", {{opacity:0, scale:0.7}}, {{opacity:1, scale:1, duration:0.45, ease:"back.out(2.5)"}}, {c.L(tp + 0.7)});')
    c.add(p2.html())
    c.write(os.path.join(R, 'compositions', 'ch5.html'))
    return ('ch5', t0, t1)

# ================================================================ VI. et si j'oublie
def ch6(R, ch, ph):
    t0, t1 = ch['debut'], ch['fin']; c = Comp('ch6', t0, t1)
    p = Phone(c, 209.233, t1 - 0.1)
    ys = [0.302 + k * 0.0778 for k in range(6)]
    ck = ''.join(f'<div id="ch6-c{k}" style="position:absolute;left:{59 - 16}px;top:{y * 1362 - 16:.0f}px;width:32px;height:32px;border-radius:16px;background:#17402C;display:flex;align-items:center;justify-content:center;color:#FAF8F5;opacity:0">{ico("check", "ico", "width:20px;height:20px")}</div>' for k, y in enumerate(ys))
    p.page(cap('hub-checklist') + ck, 209.333, ph('Les cartes')['debut'] - 0.05, trans='fade')
    c.tw(f'tl.fromTo("#ch6-c0, #ch6-c1, #ch6-c2, #ch6-c3, #ch6-c4, #ch6-c5", {{opacity:0, scale:0.4}}, {{opacity:1, scale:1, duration:0.25, stagger:0.18, ease:"back.out(3)"}}, {c.L(209.433)});')
    call(c, f'{ico("lock")}<span>Papiers</span><span class="mono">visibles de toi seul</span>', 60, 1480, ph('Les papiers')['debut'], 211.283)
    # hors ligne
    dl = c.u('dl')
    prog = (f'<div id="{dl}" class="card" style="position:absolute;left:26px;right:26px;top:{0.72 * 1362:.0f}px;opacity:0;display:flex;align-items:center;gap:16px">{ico("download")}'
            f'<div style="flex:1"><div class="k" style="font:600 22px Inter;color:#0B1F17">Chamonix · zoom 10 → 15</div><div style="height:8px;border-radius:4px;background:rgba(23,64,44,.12);margin-top:10px;overflow:hidden"><div id="ch6-bar" style="height:100%;background:#17402C;transform-origin:0 50%"></div></div></div>'
            f'<div class="mono" style="font:600 24px JetBrains Mono;color:#17402C"><span id="ch6-pct">0</span> %</div></div>')
    tl0 = ph('Les cartes')['debut']
    p.page(cap('hors-ligne') + prog, tl0 - 0.05, ph('Un lien')['debut'] - 0.05, trans='slide')
    c.tap(p.kids, 307, 0.643 * 1362, tl0 + 0.5)
    c.show(f'#{dl}', tl0 + 0.7, None, d=0.35, y=20); c.set('#ch6-bar', 0, scaleX=0)
    c.to('#ch6-bar', tl0 + 0.8, d=1.2, ease='power1.inOut', scaleX=1); c.count('ch6-pct', 0, 100, tl0 + 0.8, 1.2)
    call(c, f'{ico("nowifi")}<span>Hors ligne</span><span class="mono">264 tuiles · prêtes</span>', 60, 1480, tl0 + 1.6, 213.783)
    # le lien de suivi
    durs = ''.join(f'<span id="ch6-d{k}" class="chip" style="height:56px;font-size:21px">{d}</span>' for k, d in enumerate(['6 h', '24 h', "Jusqu'au retour"]))
    live = (header('Suivi en direct', ('menu',)) + f'<div class="body"><div class="h1">Pour ceux qui <span class="em" style="font-size:46px">t\'attendent</span></div>'
            f'<div class="card" style="margin-top:24px;display:flex;align-items:center;gap:16px">{ico("share")}<div style="flex:1"><div class="k" style="font:600 24px Inter;color:#0B1F17">Partager ma position</div><div class="v" style="font:500 19px Inter;color:#5E6B63">Un lien, sans compte</div></div>'
            f'<div style="width:78px;height:46px;border-radius:23px;background:#17402C;position:relative"><div style="position:absolute;right:5px;top:5px;width:36px;height:36px;border-radius:18px;background:#fff"></div></div></div>'
            f'<div class="card" style="margin-top:18px;display:flex;align-items:center;gap:14px">{ico("link")}<span class="mono" style="font:500 21px JetBrains Mono;color:#17402C">lkdv.app/live/7f3k…</span></div>'
            f'<div class="lbl" style="margin:28px 0 12px 6px">Jusqu\'à quand ?</div><div style="display:flex;gap:12px">{durs}</div>'
            f'<div class="card" style="margin-top:22px;padding:4px 24px">{row("user", "Maman", "Recevra le lien")}{row("shield", "Révocable à tout moment", "Tu coupes, le lien s&#39;éteint")}</div></div>' + tabs(0))
    p.page(live, ph('Un lien')['debut'], None, trans='slide')
    tq = ph('Toi seul')['debut'] + 0.5
    c.tw(f'tl.to("#ch6-d1", {{backgroundColor:"#17402C", color:"#FAF8F5", duration:0.25}}, {c.L(tq)});')
    c.tap(p.kids, 160, 760, tq - 0.05)
    c.add(p.html())
    c.write(os.path.join(R, 'compositions', 'ch6.html'))
    return ('ch6', t0, t1)

# ================================================================ VII. et si je me perds
def ch7(R, ch, ph):
    t0, t1 = ch['debut'], ch['fin']; c = Comp('ch7', t0, t1)
    dot = '<span style="width:14px;height:14px;border-radius:7px;background:#E07A5F;display:inline-block"></span>'
    hud(c, '', f'{dot}<span>Démarrer · Kayak</span><span class="lb">lac d\'Annecy · 6 h 41</span>', 60, 300, 221.833, 223.683)
    hud(c, '', f'{dot}<span>Démarrer · Escalade</span><span class="lb">via ferrata · Claire devant</span>', 60, 300, 223.883, 226.083)
    c.add('<div id="ch7-h" class="kick" style="top:330px;font-size:64px;letter-spacing:0.08em;color:#FAF8F5">05:12</div>')
    c.show('#ch7-h', ph('Cinq heures douze')['debut'] - 0.1, 232.233, d=0.4, y=16)
    hud(c, '', f'{ico("nowifi")}<span>Hors ligne</span>', 60, 150, ph('Plus de réseau')['debut'], 242.233)
    hud(c, 'light', f'{ico("map")}<span>Carte hors ligne · Chamonix</span>{ico("check")}', 200, 1380, ph('Plus de réseau')['debut'] + 1.4, 235.383)
    hud(c, 'light', f'{ico("turnl")}<span>200 m</span><span style="font-weight:500;color:#5E6B63">· à gauche</span>', 300, 1330, ph('Dans deux cents')['debut'], 239.833, extra='font-size:40px;padding:22px 34px')
    hud(c, 'light', f'{ico("drop")}<span>Point d\'eau</span><span class="mono" style="color:#7E5A30;font-size:26px">20 min</span>', 300, 1330, ph("Le point d'eau")['debut'], 242.283, extra='font-size:36px;padding:20px 30px')
    # suivi en direct : alerte, écart, retour
    p = Phone(c, 242.333, 253.433)
    m = MapView(c, 'z12', 614, 1362, (6.887, 45.972, 3.2))
    s = 3.2
    m.path(RANDO, '#D0A070', 7 / s, dash=f'{3 / s:.2f} {9 / s:.2f}')
    me = c.u('me'); X, Y = P(6.8855, 45.969)
    m.pins.append(f'<div id="{me}" style="position:absolute;left:{X:.1f}px;top:{Y:.1f}px;width:0;height:0"><div class="dot" style="left:0;top:0;transform:scale({1 / s:.3f})"></div></div>')
    X0, Y0 = X, Y
    al = c.u('al'); de = c.u('de'); bk = c.u('bk')
    banner = lambda bid, cls, icn, a, b: (f'<div id="{bid}" class="card" style="position:absolute;left:18px;right:18px;top:170px;display:flex;align-items:center;gap:16px;opacity:0;{cls}">{ico(icn, "ico", "width:40px;height:40px")}'
                                          f'<div><div class="k" style="font:600 25px Inter">{a}</div><div class="v" style="font:500 19px Inter;margin-top:4px;opacity:.8">{b}</div></div></div>')
    stats = (f'<div class="card" style="position:absolute;left:18px;right:18px;bottom:140px;display:flex;align-items:center;gap:10px">'
             + ''.join(f'<div style="flex:1;text-align:center"><div class="mono" style="font:700 30px JetBrains Mono;color:#0B1F17">{a}</div><div class="lbl" style="margin-top:6px">{b}</div></div>' for a, b in [('3:58', 'temps'), ('6,4', 'km'), ('+812', 'm')])
             + '<div style="width:84px;height:84px;border-radius:42px;background:#C2412D;color:#fff;display:flex;align-items:center;justify-content:center;font:700 24px Inter">SOS</div></div>')
    p.page(m.html() + banner(al, 'color:#8A5A12', 'storm', 'Alerte météo', 'Orage possible vers 15 h · redescendre avant')
           + banner(de, 'color:#C2412D', 'alert', 'Écart au tracé · 60 m', 'Le sentier est sur ta gauche')
           + banner(bk, 'color:#17402C', 'check', 'De retour sur le tracé', 'Refuge du Lac Blanc · 35 min') + stats + tabs(1), 242.433, ph('Si tout bascule')['debut'] - 0.1, trans='fade')
    ta = ph('Le ciel change')['debut'] + 0.9
    c.show(f'#{al}', ta, ph('Tu t\'écartes')['debut'], d=0.4, y=-40, d_out=0.2)
    X2, Y2 = P(6.8805, 45.9705); X3, Y3 = P(6.8875, 45.9735)
    td = ph("Tu t'écartes")['debut']
    c.tw(f'tl.to("#{me}", {{x:{X2 - X0:.1f}, y:{Y2 - Y0:.1f}, duration:1.2, ease:"power1.inOut"}}, {c.L(td - 0.3)});')
    c.show(f'#{de}', td + 0.4, ph('Il te le dit')['debut'] + 0.9, d=0.35, y=-40, d_out=0.2)
    c.tw(f'tl.to("#{me}", {{x:{X3 - X0:.1f}, y:{Y3 - Y0:.1f}, duration:1.0, ease:"power1.inOut"}}, {c.L(ph("Il te le dit")["debut"] + 0.4)});')
    c.show(f'#{bk}', ph('Il te le dit')['debut'] + 0.95, None, d=0.35, y=-40)
    # SOS : la vraie page de suivi, le bouton rouge (on ne déclenche jamais)
    sx, sy = 0.904 * 614, 0.887 * 1362
    sos = (f'<svg style="position:absolute;left:{sx - 70:.0f}px;top:{sy - 70:.0f}px" width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">'
           f'<circle id="ch7-sr" cx="70" cy="70" r="60" fill="none" stroke="#C2412D" stroke-width="8" stroke-linecap="round" transform="rotate(-90 70 70)" stroke-dasharray="377 377" stroke-dashoffset="377"/></svg>'
           f'<div id="ch7-st" class="card" style="position:absolute;left:26px;right:26px;top:{sy - 300:.0f}px;opacity:0;text-align:center"><div class="k" style="font:600 24px Inter;color:#C2412D">Maintiens le bouton rouge 1,5 s</div><div class="v" style="font:500 19px Inter;color:#5E6B63;margin-top:6px">Tes contacts et ta position partent ensemble</div></div>')
    tsb = ph('Si tout bascule')['debut']
    p.page(cap('live') + sos, tsb - 0.1, None, trans='fade')
    c.show('#ch7-st', tsb + 0.3, 253.033, d=0.35, y=20)
    c.tw(f'tl.to("#ch7-sr", {{attr:{{"stroke-dashoffset":150}}, duration:1.2, ease:"none"}}, {c.L(tsb + 0.9)});')
    c.tw(f'tl.to("#ch7-sr", {{attr:{{"stroke-dashoffset":377}}, duration:0.4, ease:"power2.out"}}, {c.L(tsb + 2.2)});')
    c.add(p.html())
    # très loin, un téléphone s'allume
    lm = MapView(c, 'z12', 560, 340, (6.889, 45.977, 2.4))
    X, Y = P(*LAC_BLANC)
    lm.pins.append(f'<div class="dot" style="left:{X:.1f}px;top:{Y:.1f}px;transform:scale({1 / 2.4:.3f})"></div>')
    lc = c.u('lv')
    c.add(f'<div id="{lc}" class="card" style="position:absolute;left:220px;width:640px;top:1100px;opacity:0;z-index:40;padding:22px">'
          f'<div style="display:flex;align-items:center;gap:12px">{ico("pin")}<div class="k" style="font:600 24px Inter;color:#0B1F17;flex:1">Position partagée temporairement par un voyageur</div></div>'
          f'<div style="position:relative;height:340px;margin-top:16px;border-radius:18px;overflow:hidden">{lm.html().replace("left:0px;top:0px", "left:0;top:0")}</div>'
          f'<div style="display:flex;align-items:center;gap:10px;margin-top:14px"><span class="chip ok">Lac Blanc · 2 352 m</span><span class="sp" style="flex:1"></span><span class="lbl" style="letter-spacing:.06em">il y a 3 min</span></div></div>')
    c.show(f'#{lc}', ph('Ta mère voit')['debut'] - 0.2, None, d=0.6, y=60)
    c.to(f'#{lc}', t1 - 0.4, d=0.35, opacity=0)
    c.write(os.path.join(R, 'compositions', 'ch7.html'))
    return ('ch7', t0, t1)

# ================================================================ VIII. raconter
def ch8(R, ch, ph):
    t0, t1 = ch['debut'], ch['fin']; c = Comp('ch8', t0, t1)
    p = Phone(c, 266.733, 273.533)
    cr = c.u('cr')
    p.page(header('Carnets', ('plus', 'search')) + f'<div class="body"><div style="margin-bottom:22px">{chips(["Monde", "En route", "Les miens"], on=2)}</div>'
           f'<div class="card" style="text-align:center;padding:50px 24px"><div style="color:#17402C">{ico("book", "ico", "width:60px;height:60px")}</div><div class="h2" style="margin-top:14px">Ton premier carnet</div>'
           f'<div class="sub" style="margin-top:8px">Tes tracés, tes photos et tes rencontres sont déjà là.</div><div id="{cr}" class="btn" style="margin-top:26px">{ico("plus")} Créer un carnet</div></div></div>' + tabs(0), 266.833, 268.333, trans='fade')
    c.press(f'#{cr}', 267.633); c.tap(p.kids, 307, 700, 267.583)
    thumbs = [('16', 'J1 · le lac'), ('17', 'J2 · l\'échelle'), ('12', 'J3 · le refuge')]
    th = ''; tid = []
    for img, lab in thumbs:
        i = c.u('th'); tid.append(i)
        th += (f'<div id="{i}" style="flex:1;opacity:0"><div style="height:250px;border-radius:18px;background:url(assets/prep/{img}.jpg) center/cover"></div><div class="lbl" style="margin-top:10px;letter-spacing:.06em">{lab}</div></div>')
    stat = ''.join(f'<div style="flex:1;text-align:center"><div class="mono" style="font:700 30px JetBrains Mono;color:#0B1F17">{a}</div><div class="lbl" style="margin-top:6px">{b}</div></div>' for a, b in [('5', 'jours'), ('38', 'km'), ('+2 940', 'm D+')])
    fiche = (f'<div style="position:absolute;left:0;right:0;top:0;height:470px;background:url(assets/prep/02.jpg) center 40%/cover"></div>'
             f'<div style="position:absolute;left:0;right:0;top:250px;height:220px;background:linear-gradient(rgba(243,241,235,0),#F3F1EB)"></div>' + header('Carnet', ('share',))
             + f'<div class="body" style="top:330px"><div class="h1" style="font-size:46px">Cinq jours dans <span class="em" style="font-size:50px">les Alpes</span></div><div class="lbl" style="margin-top:20px">Chiffres</div>'
             f'<div class="card" style="margin-top:10px;display:flex">{stat}</div><div class="lbl" style="margin:24px 0 10px">Fil de bord</div><div style="display:flex;gap:12px">{th}</div></div>' + tabs(0))
    p.page(fiche, 268.333, None, trans='up')
    for k, i in enumerate(tid): c.show(f'#{i}', ph('Le lac. L')['debut'] + k * 0.85, None, d=0.4, y=30)
    c.add(p.html())
    call(c, f'{ico("paw")}<span>Marmotte des Alpes</span><span class="mono">Marmota marmota</span>', 60, 300, ph('Une marmotte')['debut'], 274.833, extra='font-size:30px')
    call(c, f'{ico("flower")}<span>Gentiane de Koch</span><span class="mono">Gentiana acaulis</span>', 60, 300, ph('Une fleur')['debut'] + 0.6, 277.083, extra='font-size:30px')
    p2 = Phone(c, 277.133, t1 - 0.1)
    crew = [('Julien', '#17402C', 'J'), ('Sofia', '#B84A32', 'S'), ('Marc', '#5B7F55', 'M'), ('Claire', '#7E5A30', 'C')]
    cw = ''.join(f'<div id="ch8-c{k}" style="text-align:center;opacity:0"><div class="av" style="width:90px;height:90px;font-size:34px;background:{col};margin:0 auto">{a}</div><div class="k" style="font:600 21px Inter;color:#0B1F17;margin-top:10px">{n}</div></div>' for k, (n, col, a) in enumerate(crew))
    pub = c.u('pub'); done = c.u('dn')
    p2.page(header('Carnet', ('share',)) + f'<div class="body"><div class="lbl">Équipage</div><div class="card" style="margin-top:10px;display:flex;justify-content:space-around;padding:26px 10px">{cw}</div>'
            f'<div class="card" style="margin-top:18px;display:flex;align-items:center;gap:12px">{ico("heart")}<span class="k" style="font:600 22px Inter;color:#0B1F17">12 réactions</span><span class="sp" style="flex:1"></span>{chips(["Route", "Sac"])}</div>'
            f'<div style="position:relative;margin-top:26px"><div id="{pub}" class="btn">{ico("globe")} Publier</div><div id="{done}" class="btn light" style="position:absolute;inset:0;opacity:0">{ico("check")} Publié · Monde · En route</div></div></div>' + tabs(0), 277.233, None, trans='fade')
    c.tw(f'tl.fromTo("#ch8-c0, #ch8-c1, #ch8-c2, #ch8-c3", {{opacity:0, y:20}}, {{opacity:1, y:0, duration:0.35, stagger:0.25, ease:"back.out(2)"}}, {c.L(ph("Les prénoms")["debut"])});')
    tpub = ph('Le carnet s')['debut'] + 0.3
    c.press(f'#{pub}', tpub); c.tap(p2.kids, 307, 760, tpub - 0.05); c.show(f'#{done}', tpub + 0.3, None, d=0.3); c.to(f'#{pub}', tpub + 0.28, d=0.1, opacity=0)
    c.add(p2.html())
    c.write(os.path.join(R, 'compositions', 'ch8.html'))
    return ('ch8', t0, t1)

# ================================================================ IX. transmettre
def ch9(R, ch, ph):
    t0, t1 = ch['debut'], ch['fin']; c = Comp('ch9', t0, t1)
    p = Phone(c, 281.833, 299.533)
    its = [('lamp', 'Frontale', 'essentiel', 'ok', ph('Ceci a tout')['debut']), ('flame', 'Réchaud', 'jamais servi', '', ph("Ceci n'a jamais")['debut']),
           ('glove', 'Gants chauds', 'manquait', 'red', ph("Ceci t'a manqué")['debut']), ('rope', 'Baudrier · prêt de Léa', 'utile', 'ok', 288.333), ('link', 'Longes', 'essentiel', 'ok', 288.633)]
    ih = ''; iid = []
    for icn, nm, tag, cl, t in its:
        i = c.u('r'); iid.append((i, t))
        ih += f'<div class="row"><div class="ic">{ico(icn)}</div><div class="tx"><div class="k">{nm}</div></div><span id="{i}" class="chip {cl}" style="opacity:0">{tag}</span></div>'
    p.page(header('Rapport du kit', ('menu',)) + f'<div class="body"><div class="h1">Ton sac <span class="em" style="font-size:46px">parle</span></div><div class="sub" style="margin-top:6px">Objet par objet, après 5 jours sur le terrain.</div>'
           f'<div class="card" style="margin-top:20px;padding:4px 24px">{ih}</div></div>' + tabs(0), 281.933, ph('Ta réponse rejoint')['debut'] - 0.05, trans='fade')
    for i, t in iid: c.tw(f'tl.fromTo("#{i}", {{opacity:0, scale:0.6}}, {{opacity:1, scale:1, duration:0.35, ease:"back.out(3)"}}, {c.L(t)});')
    # la lignée s'étoffe, le kit s'allège
    tree = ('<svg width="560" height="330" viewBox="0 0 560 330" aria-hidden="true"><g stroke="#5B7F55" stroke-width="3" fill="none">'
            '<path d="M280 40 C280 90 140 90 140 130"/><path d="M280 40 C280 90 420 90 420 130"/><path d="M140 130 C140 170 80 170 80 210"/><path d="M140 130 C140 170 200 170 200 210"/><path d="M420 130 C420 170 360 170 360 210"/><path d="M420 130 C420 170 480 170 480 210"/>'
            '<path id="ch9-new" d="M360 210 C360 250 300 250 300 290" stroke="#D0A070" stroke-width="5"/></g>'
            '<g fill="#17402C"><circle cx="280" cy="40" r="18" fill="#D0A070"/><circle cx="140" cy="130" r="14"/><circle cx="420" cy="130" r="14"/><circle cx="80" cy="210" r="11"/><circle cx="200" cy="210" r="11"/><circle cx="360" cy="210" r="11"/><circle cx="480" cy="210" r="11"/></g>'
            '<circle id="ch9-me" cx="300" cy="290" r="16" fill="#D0A070" stroke="#fff" stroke-width="4"/></svg>')
    tl_ = ph('Ta réponse rejoint')['debut']
    p.page(header('Lignée du kit', ('menu',)) + f'<div class="body"><div class="lbl">Via ferrata · Alpes, été</div><div class="h1" style="margin-top:8px">Ta réponse <span class="em" style="font-size:46px">rejoint</span> la lignée</div>'
           f'<div class="card" style="margin-top:22px;display:flex;justify-content:center">{tree}</div>'
           f'<div class="card" style="margin-top:20px;display:flex;align-items:center"><div style="flex:1"><div class="lbl">Poids conseillé</div><div class="sub" style="margin-top:6px">Le réchaud sort du kit des suivants</div></div><div class="mono" style="font:700 36px JetBrains Mono;color:#17402C"><span id="ch9-kg">7,4</span> kg</div></div></div>' + tabs(0),
           tl_, ph('Quand quelqu')['debut'] - 0.05, trans='slide')
    c.tw(f'(function(){{const p=document.getElementById("ch9-new"); const L=80; p.style.strokeDasharray=L+" "+L; tl.fromTo(p, {{strokeDashoffset:L}}, {{strokeDashoffset:0, duration:0.7, ease:"power2.out"}}, {c.L(tl_ + 0.4)});}})();')
    c.tw(f'tl.fromTo("#ch9-me", {{scale:0, transformOrigin:"50% 50%"}}, {{scale:1, duration:0.4, ease:"back.out(3)"}}, {c.L(tl_ + 1.0)});')
    c.tw(f'(function(){{const o={{v:7.4}}; const el=document.getElementById("ch9-kg"); tl.to(o, {{v:6.9, duration:1.2, ease:"power2.out", onUpdate:()=>{{el.textContent=o.v.toFixed(1).replace(".", ",");}}}}, {c.L(ph("Les suivants")["debut"] + 0.2)});}})();')
    # la part créateur
    led = ''.join(row(i, a, b, v) for i, a, b, v in [('pack', 'Kit · Via ferrata, Alpes', 'Quelqu\'un s\'est équipé d\'après ton kit', '+4,20 €'), ('repeat', 'Versée en crédit boutique', 'après sa preuve terrain', '')])
    p.page(header('Part créateur', ('menu',)) + f'<div class="body"><div class="h1">Une part <span class="em" style="font-size:46px">te revient</span></div>'
           f'<div class="card" style="margin-top:24px;text-align:center;padding:36px"><div class="lbl">Crédit boutique</div><div class="mono" style="font:700 84px JetBrains Mono;color:#17402C;margin-top:14px"><span id="ch9-cr">0,00</span> €</div>'
           f'<div class="sub" style="margin-top:8px">Pour ton prochain départ</div></div><div class="card" style="margin-top:18px;padding:4px 24px">{led}</div></div>' + tabs(4), ph('Quand quelqu')['debut'], None, trans='slide')
    c.tw(f'(function(){{const o={{v:0}}; const el=document.getElementById("ch9-cr"); tl.to(o, {{v:4.2, duration:1.2, ease:"power2.out", onUpdate:()=>{{el.textContent=o.v.toFixed(2).replace(".", ",");}}}}, {c.L(ph("une part te")["debut"])});}})();')
    c.add(p.html())
    # le baudrier rentre
    call(c, f'{ico("repeat")}<span>Rendu à Léa</span><span class="mono">avec une histoire</span>', 60, 300, 300.033, 303.033)
    # l'empreinte
    em = c.u('emp')
    c.add(f'<div id="{em}" class="card" style="position:absolute;left:170px;width:740px;top:330px;opacity:0;z-index:40;display:flex;align-items:center;gap:26px;padding:30px">{seal_svg(220)}'
          f'<div><div class="lbl">Empreinte</div><div class="h2" style="margin-top:10px">Massif du <span class="em" style="font-size:34px">Mont-Blanc</span></div>'
          f'<div style="margin-top:14px;display:flex;gap:10px"><span class="chip">{ico("lock", "ico", "width:18px;height:18px")} Privée</span><span class="chip">4 sorties</span></div>'
          f'<div class="sub" style="margin-top:12px;font-size:19px">Pas un classement : la preuve que tu y étais.</div></div></div>')
    c.show(f'#{em}', ph('Ton empreinte')['debut'], t1 - 0.2, d=0.6, y=40, sc=0.95)
    c.write(os.path.join(R, 'compositions', 'ch9.html'))
    return ('ch9', t0, t1)

# ================================================================ épilogue
def ch10(R, ch, ph):
    t0, t1 = ch['debut'], ch['fin']; c = Comp('ch10', t0, t1)
    txt = c.typing('Pas pour moi.', 309.133, cps=14, caret=False)
    c.add(f'<div id="e-ppm" class="big" style="top:330px;font-size:110px;opacity:1"><span style="position:relative;display:inline-block">{txt}<span id="e-bar" style="position:absolute;left:-2%;right:-2%;top:56%;height:7px;background:#D0A070;border-radius:4px;transform-origin:0 50%"></span></span></div>')
    c.set('#e-bar', 0, scaleX=0)
    # elle ouvre ton carnet
    cc = c.u('cc'); bt = c.u('bt')
    c.add(f'<div id="{cc}" class="card" style="position:absolute;left:170px;width:740px;top:1060px;opacity:0;z-index:40;padding:0;overflow:hidden;background:#FAF8F5">'
          f'<div style="height:300px;background:url(assets/prep/02.jpg) center 40%/cover"></div><div style="padding:24px 28px">'
          f'<div class="lbl">Carnet · Julien</div><div class="h2" style="margin-top:8px">Cinq jours dans <span class="em" style="font-size:34px">les Alpes</span></div>'
          f'<div id="{bt}" class="btn" style="margin-top:20px">{ico("compass")} Préparer ce voyage</div></div></div>')
    c.show(f'#{cc}', ph('ouvre ton carnet')['debut'] - 0.2, 316.933, d=0.6, y=60)
    tt = ph('Il touche')['debut'] + 1.1
    c.press(f'#{bt}', tt); tp = []; c.tap(tp, 540, 1640, tt - 0.05); c.h.extend(tp)
    c.to('#e-bar', tt + 0.5, d=0.6, ease='power2.inOut', scaleX=1)
    c.to('#e-ppm', 316.833, d=0.4, ease='power2.in', opacity=0)
    # le fil laiton relie toutes les pages, puis se referme en anneau
    tiles = [('carnet-tmb', 270, 640), ('Calques', 700, 560), ('hub-checklist', 860, 980), ('kit-studio-sauge', 640, 1400), ('live', 260, 1420), ('10-fil-de-bord-moments', 120, 980)]
    names = ['Carnets', 'Explorer', 'Hub', 'Kit Studio', 'Terrain', 'Fil de bord']
    pts = []
    for k, ((img, x, y), nm) in enumerate(zip(tiles, names)):
        i = f'ch10-t{k}'; pts.append((x, y))
        c.add(f'<div id="{i}" style="position:absolute;left:{x - 95}px;top:{y - 190}px;width:190px;height:400px;border-radius:30px;overflow:hidden;opacity:0;box-shadow:0 20px 50px rgba(0,0,0,.45);border:4px solid #0A0F0C">'
              f'<img src="assets/app/{img}.jpg" style="width:100%;height:100%;object-fit:cover;object-position:top" alt=""></div>'
              f'<div id="{i}l" class="kick" style="left:{x - 150}px;right:auto;width:300px;top:{y + 225}px;font-size:22px">{nm}</div>')
        c.tw(f'tl.fromTo("#{i}", {{opacity:0, scale:0.7}}, {{opacity:1, scale:1, duration:0.45, ease:"back.out(2)"}}, {c.L(316.75 + k * 0.12)});')
        c.show(f'#{i}l', 316.9 + k * 0.12, 318.05, d=0.3, d_out=0.2)
        c.to(f'#{i}', 317.85, d=0.55, ease='power3.in', opacity=0, scale=0.3, x=540 - x, y=960 - y)
    d = 'M' + ' L'.join(f'{x} {y}' for x, y in pts + [pts[0]])
    c.add(f'<svg style="position:absolute;left:0;top:0;z-index:30" width="1080" height="1920" aria-hidden="true"><path id="ch10-th" d="{d}" fill="none" stroke="#D0A070" stroke-width="6" stroke-linejoin="round"/>'
          f'<circle id="ch10-rg" cx="540" cy="960" r="0" fill="none" stroke="#D0A070" stroke-width="6"/></svg>')
    c.tw(f'(function(){{const p=document.getElementById("ch10-th"); const L=p.getTotalLength(); p.style.strokeDasharray=L+" "+L; tl.fromTo(p, {{strokeDashoffset:L}}, {{strokeDashoffset:0, duration:1.05, ease:"power1.inOut"}}, {c.L(316.8)}); tl.to(p, {{opacity:0, duration:0.35}}, {c.L(317.85)});}})();')
    # anneau / logo
    c.tw(f'tl.fromTo("#ch10-rg", {{attr:{{r:0}}, opacity:0}}, {{attr:{{r:150}}, opacity:1, duration:0.6, ease:"power3.out"}}, {c.L(317.9)});')
    c.to('#ch10-rg', 318.35, d=0.4, opacity=0, attr={'r': 230})
    c.add('<div id="ch10-a" class="big" style="top:820px;font-size:96px">Un sac. Une carte.</div>')
    c.add('<div id="ch10-b" class="big" style="top:960px;font-size:96px;color:#D0A070">Le reste vient de toi.</div>')
    c.show('#ch10-a', ph('Un sac. Une')['debut'], 322.633, d=0.7, y=20, d_out=0.4)
    c.show('#ch10-b', ph('Le reste vient')['debut'], 322.633, d=0.7, y=20, d_out=0.4)
    c.add('<div id="ch10-logo" style="position:absolute;left:440px;top:520px;width:200px;height:200px;opacity:0"><img src="assets/img/badge-anneau.png" style="width:200px;height:200px" alt=""></div>')
    c.add('<div id="ch10-wm" style="position:absolute;left:0;right:0;top:800px;text-align:center;font:700 72px/1 Inter, sans-serif;letter-spacing:0.18em;color:#FAF8F5;opacity:0">LE KIT DU VOYAGEUR</div>')
    c.add('<div id="ch10-tag" class="big" style="top:900px;font-size:64px;color:#D0A070">Là où la carte se termine.</div>')
    c.add('<div id="ch10-mods" class="kick" style="top:1180px;font-size:24px;letter-spacing:0.1em;color:#FAF8F5;line-height:1.7">Explorer · Compas · Hub · Kit Studio<br>Communauté · Carnets · Messages</div>')
    c.add('<div id="ch10-pro" class="kick" style="top:1320px;font-size:20px;letter-spacing:0.12em;color:rgba(250,248,245,.6)">Espace Pro · Développeurs · Manifeste</div>')
    c.add('<div id="ch10-pf" class="kick" style="top:1400px;font-size:22px;letter-spacing:0.14em">Web · iPhone · Android · hors ligne</div>')
    c.add('<div id="ch10-cr" class="kick" style="top:1810px;font-size:14px;letter-spacing:0.06em;color:rgba(250,248,245,.45);text-transform:none">Images satellite : Sentinel-2 cloudless, EOX (CC BY 4.0) · voix de synthèse provisoire (Piper, voix Siwis, CC BY 4.0)</div>')
    tk = ph('Le Kit du Voyageur')['debut']
    c.tw(f'tl.fromTo("#ch10-logo", {{opacity:0, scale:0.6, rotation:-30}}, {{opacity:1, scale:1, rotation:0, duration:0.9, ease:"back.out(1.8)"}}, {c.L(tk - 0.3)});')
    c.show('#ch10-wm', tk, None, d=0.7, y=20)
    c.show('#ch10-tag', ph('Là où la carte')['debut'], None, d=0.8, y=16)
    for k, i in enumerate(['#ch10-mods', '#ch10-pro', '#ch10-pf', '#ch10-cr']): c.show(i, 327.033 + k * 0.35, None, d=0.6, y=10)
    c.tw(f'tl.to("#ch10", {{opacity:0, duration:0.8, ease:"power1.in"}}, {c.L(t1 - 0.85)});')
    c.write(os.path.join(R, 'compositions', 'ch10.html'))
    return ('ch10', t0, t1)

def build(R, CH, PH, phrase):
    fs = [ch0, ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ch9, ch10]
    def scoped(k):
        # une phrase est d'abord cherchée dans son propre chapitre (« Cinq heures douze » revient au VII)
        def ph(txt):
            for p in PH:
                if p['bloc'] == k and p['texte'].startswith(txt): return p
            return phrase(txt)
        return ph
    return [f(R, CH[k], scoped(k)) for k, f in enumerate(fs)]
