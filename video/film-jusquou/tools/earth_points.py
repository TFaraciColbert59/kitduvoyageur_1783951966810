# Positions à l'écran des repères de la carte, calculées avec la même caméra que tools/earth.py.
#  - lieux fixes (refuges, source, mirador…) : position quand le W est tenu immobile (t ≥ 17,9 s) ;
#  - point du voyage : position image par image de 14,5 s à 18,0 s (pendant la plongée).
# Sortie : assets/earth/points.json   — usage : python tools/earth_points.py <mosaïques> <w.xml>
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'earth.py')).read().replace("if __name__ == '__main__':\n    main()", "")
exec(src)

def at(t, pts):
    S, N, E, rg, cy, _ = basis(t)
    xy, fr = project(pts, (S, N, E, rg, cy))
    return [[round(float(x), 1), round(float(y), 1), bool(v)] for (x, y), v in zip(xy, visible(xy, fr))]

def along(p, f):
    c = cum(p); L = c[-1] * f; k = 1
    while k < len(p) - 1 and c[k] < L: k += 1
    u = (L - c[k - 1]) / max(1e-9, c[k] - c[k - 1])
    return (p[k - 1][0] + (p[k][0] - p[k - 1][0]) * u, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * u)

PLACES = {
    'grey': GREY, 'pgrande': PGRANDE, 'italiano': ITALIANO, 'britanico': BRITANICO, 'cuernos': CUERNOS,
    'chileno': CHILENO, 'torres': TORRES, 'pudeto': PUDETO,
    'source': along(path(GREY, PGRANDE), 0.55),
    'guanacos': along(path(ITALIANO, CUERNOS), 0.6),
    'sac': along(path(PGRANDE, ITALIANO), 0.7),
}
names = list(PLACES)
fixed = dict(zip(names, at(25.0, [PLACES[n] for n in names])))
track = {}
for i in range(int(14.4 * FPS), int(18.1 * FPS)):
    t = i / FPS; _, cur = progress(t)
    track[f'{t:.3f}'] = at(t, [cur])[0]
json.dump({'fixed': fixed, 'track': track, 'horizon_y': Y0}, open(os.path.join(OUT, 'points.json'), 'w'), indent=1)
for n in names: print(n, fixed[n])
