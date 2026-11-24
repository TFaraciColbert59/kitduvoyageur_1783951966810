# La Terre de « Jusqu'où » : une piste continue de 30 s, visible du premier photogramme au logo.
# Système repris du conducteur LKDV (« Il en manque un. ») :
#  - le globe traverse toute la largeur, le sommet de sa courbure reste à 62 % de la hauteur (y = 1190) à toutes les échelles ;
#  - relief mat, mer bleu encre, filet de lumière discret sur la courbure ;
#  - le détail régional (Patagonie, puis le W) entre dans le globe par un agrandissement cartographique progressif ;
#  - pointillé = trajet prévu, trait plein = chemin parcouru, un point respire à la position du voyage.
# Imagerie : Sentinel-2 cloudless 2016 (EOX, CC BY 4.0). Tracé du W : OpenStreetMap, relation 2203617 (ODbL).
# Usage : python tools/earth.py <dossier des mosaïques m4/m7/m10/m13 .npy> <w.xml>   → assets/earth/earth.mp4
import sys, os, math, json, heapq, subprocess
import xml.etree.ElementTree as ET
import numpy as np, cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOS, WXML = sys.argv[1], sys.argv[2]
OUT = os.path.join(ROOT, 'assets', 'earth'); os.makedirs(OUT, exist_ok=True)
W, H, FPS, DUR = 1080, 1920, 30, 30.0
Y0 = 1190            # sommet de la courbure (62 % de 1920)
RS = 1500            # rayon d'écran de la courbure (fixe)
Y_TOP = 1040         # on ne calcule la Terre que sous cette ligne (le halo commence au-dessus de la courbure)
RE = 6371.0
B = 60 / 90          # un temps de la musique

# ---------- mosaïques ----------
mos = {}
for z in (4, 7, 10, 13):
    M = np.load(os.path.join(MOS, f'm{z}.npy')); x0, y0 = map(int, open(os.path.join(MOS, f'm{z}.txt')).read().split())
    mos[z] = (M, x0 * 256, y0 * 256)
def merc(lon, lat, z):
    s = 256 * 2 ** z; x = (lon + 180) / 360 * s
    la = np.clip(np.radians(lat), -1.48, 1.48); y = (1 - np.log(np.tan(la) + 1 / np.cos(la)) / math.pi) / 2 * s
    return x, y
def sample(z, lon, lat):
    M, ox, oy = mos[z]; x, y = merc(lon, lat, z); x = (x - ox - 0.5).astype(np.float32); y = (y - oy - 0.5).astype(np.float32)
    h, w, _ = M.shape
    ok = np.clip(np.minimum(np.minimum(x, y), np.minimum(w - 1 - x, h - 1 - y)) / 96.0, 0, 1)   # bords fondus : pas de couture entre mosaïques
    n = x.size; m = -(-n // 1024) * 1024                     # cv2.remap : cartes de moins de 32 767 lignes
    xp = np.zeros(m, np.float32); yp = np.zeros(m, np.float32); xp[:n] = x; yp[:n] = y
    c = cv2.remap(M, xp.reshape(-1, 1024), yp.reshape(-1, 1024), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).reshape(-1, 3)[:n].astype(np.float32)
    return c, ok

def grade(c):
    """Relief mat et mer bleu encre : l'eau est détectée par sa teinte, la terre est désaturée et assourdie."""
    r, g, b = c[:, 0], c[:, 1], c[:, 2]; lum = c.mean(1)
    water = np.clip(((b - r) - 6) / 22, 0, 1) * np.clip((150 - lum) / 60, 0, 1)
    turq = np.clip(((g - r) - 18) / 30, 0, 1) * np.clip(((b - r) - 10) / 30, 0, 1)
    water = np.maximum(water, turq * 0.85)
    land = lum[:, None] + (c - lum[:, None]) * 0.55          # désaturée
    land = land * 0.82 + np.array([6, 4, 0], np.float32)       # assourdie, un peu chaude
    snow = np.clip((lum - 165) / 60, 0, 1)[:, None] * 0.85
    land = land * (1 - snow) + (np.array([178, 180, 176], np.float32) * (0.85 + 0.15 * lum[:, None] / 255)) * snow
    ink = np.array([14, 30, 50], np.float32) + (lum[:, None] - 60) * np.array([0.10, 0.16, 0.24], np.float32)
    w = water[:, None]
    return land * (1 - w) + ink * w

def unit(lon, lat):
    lo, la = np.radians(lon), np.radians(lat)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)
def tangents(lon, lat):
    lo, la = math.radians(lon), math.radians(lat)
    east = np.array([-math.sin(lo), math.cos(lo), 0.0]); north = np.array([-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la)])
    return east, north
def latlon(P):
    return np.degrees(np.arctan2(P[..., 1], P[..., 0])), np.degrees(np.arcsin(np.clip(P[..., 2], -1, 1)))
def slerp(a, b, u):
    a, b = np.asarray(a, float), np.asarray(b, float); d = math.acos(max(-1, min(1, a @ b)))
    if d < 1e-9: return a
    return (math.sin((1 - u) * d) * a + math.sin(u * d) * b) / math.sin(d)
def hav(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1]); dl = math.radians(b[0] - a[0]); dp = la2 - la1
    return 2 * RE * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dl / 2) ** 2))

# ---------- le trajet (lon, lat) ----------
def gc(a, b, n=80):
    A, Bv = unit(*a), unit(*b); return [tuple(latlon(slerp(A, Bv, i / n))) for i in range(n + 1)]
PARIS = (2.55, 49.01); SCL = (-70.79, -33.39); PUQ = (-70.85, -53.00); NATALES = (-72.51, -51.73)
CASTILLO = (-72.47, -51.27); AMARGA = (-72.84, -50.97); PUDETO = (-72.97, -51.09); PGRANDE = (-73.0947591, -51.0724863)
GREY = (-73.1813250, -51.0021595); ITALIANO = (-73.040, -51.036); BRITANICO = (-73.032, -50.985)
CUERNOS = (-72.9853709, -51.0238463); CHILENO = (-72.9106479, -50.9572451); TORRES = (-72.9496630, -50.9426680)
# sentiers du W (graphe OpenStreetMap), plus court chemin entre étapes
t = ET.parse(WXML).getroot()
nodes = {n.get('id'): (float(n.get('lon')), float(n.get('lat'))) for n in t.iter('node')}
ways = {w.get('id'): [nd.get('ref') for nd in w.iter('nd')] for w in t.iter('way')}
rel = [r for r in t.iter('relation')][0]; mem = [m.get('ref') for m in rel.iter('member') if m.get('type') == 'way']
G = {}
for w in mem:
    r = ways[w]
    for i in range(len(r) - 1):
        a, b = r[i], r[i + 1]; d = hav(nodes[a], nodes[b]); G.setdefault(a, []).append((b, d)); G.setdefault(b, []).append((a, d))
def near(p): return min(G, key=lambda n: hav(nodes[n], p))
def path(a, b):
    s, e = near(a), near(b); dist = {s: 0}; prev = {}; pq = [(0, s)]
    while pq:
        d, n = heapq.heappop(pq)
        if n == e: break
        if d > dist[n]: continue
        for m, w in G[n]:
            if d + w < dist.get(m, 1e18): dist[m] = d + w; prev[m] = n; heapq.heappush(pq, (d + w, m))
    out = [e]
    while out[-1] != s: out.append(prev[out[-1]])
    return [nodes[n] for n in out[::-1]]
# segments horodatés : (début, fin, points) — le point du voyage parcourt chaque segment pendant son créneau
SEG = [
    (14.667, 15.50, gc(PARIS, SCL, 120) + gc(SCL, PUQ, 40)[1:]),                      # le vol (passeport)
    (15.667, 16.60, [PUQ, (-71.6, -52.6), NATALES, CASTILLO, AMARGA, PUDETO]),        # le bus
    (16.667, 17.55, [PUDETO, (-73.03, -51.09), PGRANDE]),                              # le catamaran
    (17.667, 18.60, path(PGRANDE, GREY)),                                              # vers le refuge Grey
    (18.667, 19.30, path(GREY, PGRANDE)),                                              # retour, la source
    (19.333, 20.60, path(PGRANDE, ITALIANO)),                                          # météo, sac
    (21.167, 21.62, path(ITALIANO, BRITANICO)),                                        # le condor (Británico)
    (21.667, 21.98, path(BRITANICO, ITALIANO) + path(ITALIANO, CUERNOS)[1:]),          # guanacos
    (22.000, 22.32, path(CUERNOS, CHILENO)),                                           # la tente
    (23.000, 23.70, path(CHILENO, TORRES)),                                            # les Torres
]
def cum(pts):
    d = [0.0]
    for i in range(1, len(pts)): d.append(d[-1] + hav(pts[i - 1], pts[i]))
    return d
SEGC = [(a, b, p, cum(p)) for a, b, p in SEG]
ALLPTS = [p for _, _, ps in SEG for p in ps]
STOPS = [PARIS, PGRANDE, GREY, ITALIANO, BRITANICO, CUERNOS, CHILENO, TORRES]

def ease(u): u = min(1, max(0, u)); return u * u * (3 - 2 * u)
def progress(t):
    """Points parcourus jusqu'au temps t et position courante."""
    done = []; cur = PARIS
    for a, b, p, c in SEGC:
        if t <= a: break
        if t >= b: done += p; cur = p[-1]; continue
        u = ease((t - a) / (b - a)); L = c[-1] * u
        k = 1
        while k < len(p) and c[k] < L: k += 1
        if k >= len(p): done += p; cur = p[-1]; continue
        f = (L - c[k - 1]) / max(1e-9, c[k] - c[k - 1])
        q = (p[k - 1][0] + (p[k][0] - p[k - 1][0]) * f, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * f)
        done += p[:k] + [q]; cur = q; break
    return done, cur

# ---------- caméra : cible T, cap (azimut du haut de l'écran), rayon du globe Rg, glissement vers le centre ----------
W_CENTER = (-73.03, -51.02)
KEYS = [  # (t, lon, lat, cap°, Rg)
    (0.0,   4.0, 47.0, 0, 1500), (10.4, 1.0, 45.5, 0, 1500),                     # la question : l'Europe, presque immobile
    (13.33, -68.0, -40.0, 196, 1650),                                               # respiration : la Terre tourne vers l'Amérique du Sud
    (14.6, -70.6, -44.0, 190, 1700), (15.6, -71.4, -50.6, 186, 2600),               # le vol
    (16.6, -72.7, -51.15, 60, 26000),                                               # le bus : agrandissement vers la Patagonie
    (17.6, -73.03, -51.01, 0, 170000),                                              # le catamaran : le W entre dans le globe, nord en haut
    (30.0, -73.03, -51.01, 0, 170000)]                                              # le W tenu jusqu'au logo
def camera(t):
    for i in range(len(KEYS) - 1):
        if KEYS[i][0] <= t <= KEYS[i + 1][0]: k0, k1 = KEYS[i], KEYS[i + 1]; break
    else: k0 = k1 = KEYS[-1]
    u = ease((t - k0[0]) / max(1e-6, k1[0] - k0[0]))
    P = slerp(unit(k0[1], k0[2]), unit(k1[1], k1[2]), u); lon, lat = latlon(P)
    dpsi = ((k1[3] - k0[3] + 180) % 360) - 180; psi = k0[3] + dpsi * u
    rg = math.exp(math.log(k0[4]) * (1 - u) + math.log(k1[4]) * u)
    return float(lon), float(lat), psi, rg

DT = 380  # la cible se place 380 px sous la courbure
def basis(t):
    lon, lat, psi, rg = camera(t)
    T = unit(lon, lat); e, n = tangents(lon, lat); h = math.cos(math.radians(psi)) * n + math.sin(math.radians(psi)) * e
    wgt = ease((math.log(rg) - math.log(1500)) / (math.log(9000) - math.log(1500)))   # glissement : la cible va vers le centre du disque
    shift = (rg - DT) * wgt
    cy = Y0 + rg - shift
    vT = (cy - (Y0 + DT)) / rg; zT = math.sqrt(max(0, 1 - vT * vT))
    S = zT * T - vT * h; N = vT * T + zT * h; E = np.cross(N, S)
    return S, N, E, rg, cy, lat

# ---------- pixels de la bande Terre ----------
YS, XS = np.mgrid[Y_TOP:H, 0:W].astype(np.float32)
ARC = Y0 + RS - np.sqrt(np.maximum(RS * RS - (XS - W / 2) ** 2, 0))      # courbure fixe à l'écran
inside = YS >= ARC
d_arc = (YS - ARC)                                                         # distance verticale sous la courbure
rng = np.random.default_rng(5)
STARS = np.zeros((H, W), np.float32); k = rng.integers(0, H * W, 1800); STARS.flat[k] = rng.uniform(0.2, 1, 1800) ** 3
STARS = cv2.GaussianBlur(STARS, (3, 3), 0) * 2.2
SUN = np.array([0.35, 0.55, 0.76])  # lumière en vue (droite, haut, face)

def frame(t):
    S, N, E, rg, cy, latc = basis(t)
    u = (XS - W / 2) / rg; v = (cy - YS) / rg; rr = u * u + v * v
    hit = inside & (rr < 1)
    z = np.sqrt(np.maximum(0, 1 - rr))
    P = u[..., None] * E + v[..., None] * N + z[..., None] * S
    lon, lat = latlon(P)
    img = np.zeros((H - Y_TOP, W, 3), np.float32)
    idx = np.nonzero(hit)
    lo, la = lon[idx], lat[idx]
    kmpp = RE / rg
    zf = math.log2(156543.0 * max(0.2, math.cos(math.radians(latc))) / max(kmpp * 1000, 1e-3))
    col = np.zeros((len(lo), 3), np.float32)
    for zz in (4, 7, 10, 13):
        if zz > 4 and zz > zf + 1.2: break
        c, ok = sample(zz, lo, la); a = np.clip(zf - zz + 1.0, 0, 1) if zz > 4 else 1.0
        m = (ok * a)[:, None]; col = col * (1 - m) + c * m
    col = grade(col)
    # relief mat : ombrage doux (lambert) et assombrissement vers le bas du cadre
    nrm = np.stack([u[idx], v[idx], z[idx]], -1)
    lam = np.clip(nrm @ SUN, 0, 1) * 0.35 + 0.72
    col *= lam[:, None]
    img[idx] = col
    # filet de lumière sur la courbure + halo bleu très discret au-dessus
    rim = np.exp(-np.abs(d_arc) / 2.2) * 0.75 + np.exp(-np.maximum(d_arc, 0) / 18) * 0.18
    halo = np.exp(-np.maximum(-d_arc, 0) / 26) * (d_arc < 0) * 0.32
    img += rim[..., None] * np.array([235, 232, 220], np.float32) * inside[..., None] * 0.6
    img += halo[..., None] * np.array([90, 130, 190], np.float32)
    img += (STARS[Y_TOP:] * (d_arc < -30) * 160)[..., None]
    full = np.zeros((H, W, 3), np.float32); full[Y_TOP:] = img
    full[:Y_TOP] = (STARS[:Y_TOP] * 160)[..., None]
    return full, (S, N, E, rg, cy)

def project(pts, cam):
    S, N, E, rg, cy = cam
    P = unit(np.array([p[0] for p in pts]), np.array([p[1] for p in pts]))
    x = W / 2 + rg * (P @ E); y = cy - rg * (P @ N); front = (P @ S) > 0
    return np.stack([x, y], -1), front

def visible(xy, front):
    arc = Y0 + RS - np.sqrt(np.maximum(RS * RS - (xy[:, 0] - W / 2) ** 2, 0))
    return front & (xy[:, 1] > arc + 3) & (xy[:, 1] < H + 50) & (xy[:, 0] > -50) & (xy[:, 0] < W + 50)

def draw_route(img, t, cam):
    ov = np.zeros((H, W), np.float32); ovs = np.zeros((H, W), np.float32)
    # le trajet prévu apparaît pendant la respiration (10,7 s → 13,3 s)
    plan = ease((t - 10.7) / 2.4)
    if plan > 0:
        pts_plan = ALLPTS if t < 17.3 else ALLPTS[len(SEG[0][2]) + len(SEG[1][2]) - 1:]
        xy, fr = project(pts_plan, cam); vis = visible(xy, fr)
        acc = 0.0; nxt = 0.0; total = 0.0
        segs = [(xy[i], xy[i + 1]) for i in range(len(xy) - 1) if vis[i] and vis[i + 1]]
        lens = [float(np.hypot(*(b - a))) for a, b in segs]; total = sum(lens) * plan
        for (a, b), L in zip(segs, lens):
            if acc > total: break
            while nxt < acc + L and nxt <= total:
                f = (nxt - acc) / max(L, 1e-6); p = a + (b - a) * f
                cv2.circle(ov, (int(p[0] * 4), int(p[1] * 4)), 8, 1.0, -1, cv2.LINE_AA, 2)
                nxt += 15
            acc += L
    done, cur = progress(t)
    # le vol et le bus s'effacent quand le W entre dans le globe (sinon leurs grandes lignes barrent la carte)
    n_far = len(SEG[0][2]) + len(SEG[1][2])
    fade_far = 1 - ease((t - 17.3) / 0.7)
    for part, alpha in ((done[:n_far], fade_far), (done[n_far - 1:], 1.0)):
        if len(part) < 2 or alpha <= 0: continue
        xy, fr = project(part, cam); vis = visible(xy, fr)
        tmp = np.zeros((H, W), np.float32)
        for i in range(len(xy) - 1):
            if vis[i] and vis[i + 1]:
                cv2.line(tmp, (int(xy[i, 0] * 4), int(xy[i, 1] * 4)), (int(xy[i + 1, 0] * 4), int(xy[i + 1, 1] * 4)), 1.0, 7, cv2.LINE_AA, 2)
        ovs = np.maximum(ovs, tmp * alpha)
    img[:] = img * (1 - ov[..., None] * 0.0)
    a_dot = cv2.GaussianBlur(ov, (3, 3), 0)[..., None] * 0.75
    img[:] = img * (1 - a_dot) + np.array([238, 232, 216], np.float32) * a_dot
    glow = cv2.GaussianBlur(ovs, (0, 0), 6)[..., None] * 0.45
    a_sol = ovs[..., None]
    img[:] = img + glow * np.array([208, 160, 112], np.float32) * 0.6
    img[:] = img * (1 - a_sol) + np.array([226, 182, 128], np.float32) * a_sol
    # étapes atteintes + point du voyage qui respire
    for p in STOPS[:1] + [s for s in STOPS[1:] if any(abs(s[0] - q[0]) < 1e-6 and abs(s[1] - q[1]) < 1e-6 for q in done)]:
        xy, fr = project([p], cam)
        if visible(xy, fr)[0]: cv2.circle(img, (int(xy[0, 0] * 4), int(xy[0, 1] * 4)), 22, (250, 248, 245), -1, cv2.LINE_AA, 2)
    xy, fr = project([cur], cam)
    if visible(xy, fr)[0]:
        x, y = xy[0]; br = 0.5 + 0.5 * math.sin(t * 2 * math.pi / 1.6)
        halo = np.zeros((H, W), np.float32); cv2.circle(halo, (int(x * 4), int(y * 4)), int((22 + 26 * br) * 4), 1.0, -1, cv2.LINE_AA, 2)
        halo = cv2.GaussianBlur(halo, (0, 0), 6)[..., None] * (0.55 - 0.3 * br)
        img[:] = img + halo * np.array([226, 182, 128], np.float32)
        cv2.circle(img, (int(x * 4), int(y * 4)), 36, (250, 248, 245), -1, cv2.LINE_AA, 2)
        cv2.circle(img, (int(x * 4), int(y * 4)), 36, (208, 160, 112), 12, cv2.LINE_AA, 2)

def main():
    nf = int(DUR * FPS); path_out = os.path.join(OUT, 'earth.mp4')
    ff = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                           '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p',
                           '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', path_out],
                          stdin=subprocess.PIPE)
    only = [int(a) for a in sys.argv[3:]]
    for i in range(nf):
        if only and i not in only: continue
        t = i / FPS
        img, cam = frame(t)
        draw_route(img, t, cam)
        o = np.clip(img, 0, 255).astype(np.uint8)
        if only: cv2.imwrite(os.path.join(OUT, f'test-{i:04d}.jpg'), cv2.cvtColor(o, cv2.COLOR_RGB2BGR)); continue
        ff.stdin.write(o.tobytes())
        if i % 60 == 0: print(f'{t:.1f} s', flush=True)
    ff.stdin.close(); ff.wait(); print('ok', path_out)

if __name__ == '__main__':
    main()
