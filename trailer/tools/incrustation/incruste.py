#!/usr/bin/env python3
"""Incrustation des vraies captures de l'app sur les écrans verts des vidéos Flow (ours v3).

    python3 tools/incrustation/incruste.py p29.mp4 [p07.mp4 …] [--suivi-seul] [--preuves-seules]

Lancé depuis n'importe où : les chemins sont relatifs à trailer/. ffmpeg et ffprobe sont pris dans le PATH.
Réglages par source : tools/incrustation/plans.json. Pour chaque source :

1. Suivi (sur les plages du réglage = images montées ± 8) : score de vert s = g − max(r, b) ; pour chacun des
   quatre bords de l'écran, profils perpendiculaires au bord prévu (pas de 0,5 px) et position sous-pixel de la
   sortie du vert (moitié du niveau du vert) ; droite ajustée par moindres carrés totaux avec rejet itératif
   (les doigts et l'encoche créent des points hors droite, rejetés) ; les coins sont les intersections des
   droites (écran sans arrondi). Deux passes par image, départ = image précédente (première image : extrêmes du
   masque). Bord jamais visible (P17, bas hors champ) : coins posés sur les côtés prolongés (« bas_impose »).
   Lissage temporel : ajustement local quadratique symétrique (fenêtre 7, sans retard), coupé aux bornes des
   plages. Coins par image écrits dans tools/incrustation/suivi/<source>.json.
2. Incrustation : la capture (ou l'état du moment, avec glissements et fondus entre captures réelles) est
   déformée par homographie (sur-échantillonnage ×2, capture préréduite en Lanczos), puis flou de mise au
   point, flou de mouvement (moyenne de sous-images le long de la trajectoire des coins, obturateur 180°),
   gain, teinte et noir de la scène, ombrage repris du vert (ombre de pouce, dégradés), reflet de vitre fixe
   dans le monde, grain mesuré sur le vert. Alpha = vert de la source (doigts et cadre restent devant),
   limité à l'écran suivi élargi de quelques pixels ; débordement vert retiré autour.
3. Sortie : flow/clips/incrustes/<source>, mêmes images et même numérotation (hors plages : images d'origine
   réencodées), H.264 CRF 10 yuv420p, sans son, mêmes étiquettes de couleur que la source.
"""
import json, os, subprocess, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

TRAILER = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "plans.json")))
SRC_DIR = os.path.join(TRAILER, "flow/clips/plans")
OUT_DIR = os.path.join(TRAILER, "flow/clips/incrustes")
SCREENS = os.path.join(TRAILER, "assets/screens")
SUIVI = os.path.join(HERE, "suivi")
TMP = os.path.join(TRAILER, "qa/tmp/incrustation")
W, H = 1920, 1080
for d in (OUT_DIR, SUIVI, TMP):
    os.makedirs(d, exist_ok=True)


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, **kw)


def probe_frames(path):
    o = sh(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
            "stream=nb_read_packets", "-of", "csv=p=0", path], text=True).stdout
    return int(o.strip().split(",")[0])


def read_frames(path):
    """Générateur des images RGB uint8 (décodage BT.601 plage TV, comme la source)."""
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE)
    n = W * H * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3)
    p.wait()


def frames_in(cfg):
    s = set()
    for a, b in cfg["plages"]:
        s.update(range(a, b + 1))
    return s


# ---------------------------------------------------------------- suivi
def green_score(img):
    f = img.astype(np.float32)
    return f[..., 1] - np.maximum(f[..., 0], f[..., 2])


def bilinear(S, xs, ys):
    h, w = S.shape
    ok = (xs >= 0) & (xs <= w - 1.001) & (ys >= 0) & (ys <= h - 1.001)
    xs = np.clip(xs, 0, w - 1.001)
    ys = np.clip(ys, 0, h - 1.001)
    x0 = np.floor(xs).astype(int)
    y0 = np.floor(ys).astype(int)
    fx, fy = xs - x0, ys - y0
    v = (S[y0, x0] * (1 - fx) * (1 - fy) + S[y0, x0 + 1] * fx * (1 - fy) + S[y0 + 1, x0] * (1 - fx) * fy
         + S[y0 + 1, x0 + 1] * fx * fy)
    return np.where(ok, v, np.nan)


def fit_line(P):
    """Moindres carrés totaux avec rejet itératif. Retourne (point, direction, inliers)."""
    keep = np.ones(len(P), bool)
    for _ in range(5):
        Q = P[keep]
        if len(Q) < 6:
            return None
        c = Q.mean(0)
        u, s, vt = np.linalg.svd(Q - c, full_matrices=False)
        d = vt[0]
        nrm = np.array([-d[1], d[0]])
        r = (P - c) @ nrm
        mad = np.median(np.abs(r[keep] - np.median(r[keep]))) * 1.4826
        thr = max(0.8, 2.5 * mad)
        new = np.abs(r) < thr
        if (new == keep).all():
            break
        keep = new
    return c, d, keep


def intersect(l1, l2):
    (p, d), (q, e) = l1, l2
    A = np.array([d, -e]).T
    t = np.linalg.solve(A, q - p)
    return p + t[0] * d


def scan_side(S, quad, i, R, frac, thr):
    p0, p1 = quad[i], quad[(i + 1) % 4]
    L = np.linalg.norm(p1 - p0)
    d = (p1 - p0) / L
    n = np.array([d[1], -d[0]])  # normale sortante (ordre horaire, y vers le bas)
    N = int(max(20, min(160, L / 3)))
    ts = np.linspace(frac, 1 - frac, N)
    us = np.arange(-R, R + 0.25, 0.5)
    base = p0[None, :] + ts[:, None] * (p1 - p0)[None, :]
    X = base[:, None, 0] + us[None, :] * n[0]
    Y = base[:, None, 1] + us[None, :] * n[1]
    prof = bilinear(S, X, Y)
    pts = []
    for k in range(N):
        pr = prof[k]
        if np.isnan(pr).any():
            valid = ~np.isnan(pr)
            if valid.sum() < len(pr) * 0.9:
                continue
        a = pr[:-1] >= thr
        b = pr[1:] < thr
        idx = np.nonzero(a & b)[0]
        if len(idx) == 0:
            continue
        j = idx[-1]  # sortie du vert la plus extérieure
        v0, v1 = pr[j], pr[j + 1]
        u = us[j] + (v0 - thr) / (v0 - v1 + 1e-6) * 0.5
        pts.append(base[k] + u * n)
    return np.array(pts)


def initial_quad(S, thr):
    ys, xs = np.nonzero(S > thr)
    if len(xs) < 200:
        raise RuntimeError("pas de vert")
    s1, s2 = xs + ys, xs - ys
    return np.array([[xs[s1.argmin()], ys[s1.argmin()]], [xs[s2.argmax()], ys[s2.argmax()]],
                     [xs[s1.argmax()], ys[s1.argmax()]], [xs[s2.argmin()], ys[s2.argmin()]]], float)


def track_frame(S, prev, cfg, first):
    gl = np.median(S[S > 60]) if (S > 60).sum() > 100 else 120.0
    thr = 0.5 * gl
    quad = prev.copy()
    lines_ok = [True] * 4
    for it in range(3 if first else 2):
        R = (40 if first and it == 0 else 14) * cfg.get("rayon_recherche", 1.0)
        lines, pts, fr = [], [], []
        for i in range(4):
            if cfg.get("bas_impose") and i == 2:
                lines.append(None)
                pts.append(None)
                fr.append(0)
                continue
            frac = cfg.get("marge_coins", [0.2, 0.1, 0.2, 0.1])[i]
            P = scan_side(S, quad, i, R, frac, thr)
            fl = fit_line(P) if len(P) >= 8 else None
            pts.append(P)
            if fl is None or fl[2].sum() < max(6, 0.25 * len(P)):
                lines.append(None)
                fr.append(0)
                lines_ok[i] = False
            else:
                lines.append((fl[0], fl[1]))
                fr.append(fl[2].mean())
                lines_ok[i] = True
        # Bord en partie caché (pouce, main) : une occlusion ne fait que rentrer le bord vers l'intérieur. Si la
        # droite libre n'est pas parallèle (à tol près) au bord opposé, ou mal soutenue, on garde la direction du
        # bord opposé et on pose la droite sur les points les plus extérieurs (médiane du quart extérieur).
        tol = cfg.get("tolerance_parallele", 1.5)
        if tol:
            new = list(lines)
            for i in range(4):
                j = (i + 2) % 4
                if lines[j] is None or pts[i] is None or len(pts[i]) < 6:
                    continue
                dj = -lines[j][1]
                if lines[i] is not None and i not in cfg.get("parallele_force", []):
                    cr = lines[i][1][0] * dj[1] - lines[i][1][1] * dj[0]
                    ang = math.degrees(math.asin(min(1.0, abs(cr))))
                    if ang <= tol and fr[i] >= 0.6:
                        continue
                    if fr[j] < fr[i]:  # jamais les deux bords opposés : on corrige le moins soutenu
                        continue
                nrm = np.array([dj[1], -dj[0]])  # sortante pour le bord i (même sens que scan_side)
                pr = pts[i] @ nrm
                k = max(3, len(pr) // 4)
                top = np.sort(pr)[-k:]
                off = np.median(top)
                p0 = pts[i][np.argsort(pr)[-k:]].mean(0)
                p0 = p0 + (off - p0 @ nrm) * nrm
                new[i] = (p0, dj)
                lines_ok[i] = "parallele"
            lines = new
        # Bords manquants : droite de l'image précédente.
        for i in range(4):
            if lines[i] is None and not (cfg.get("bas_impose") and i == 2):
                p0, p1 = prev[i], prev[(i + 1) % 4]
                lines[i] = (p0, (p1 - p0) / np.linalg.norm(p1 - p0))
        if cfg.get("bas_impose"):
            yb = cfg["bas_impose"]
            q = np.zeros((4, 2))
            q[0] = intersect(lines[3], lines[0])
            q[1] = intersect(lines[0], lines[1])
            for k, li in ((2, lines[1]), (3, lines[3])):
                p, d = li
                t = (yb - p[1]) / d[1]
                q[k] = p + t * d
            quad = q
        else:
            quad = np.array([intersect(lines[(i + 3) % 4], lines[i]) for i in range(4)])
    return quad, gl, [ (round(float(fr[i]), 2) if lines_ok[i] is True else lines_ok[i]) for i in range(4)]


def _q(v):
    return v if isinstance(v, float) else (0.5 if v == "parallele" else (0.0 if v is False else 1.0))


def enforce_aspect(raw, oks, axis, bord=None, rapport=None):
    """Proportions de l'écran tenues : le rapport côté long / côté court mesuré sur les images où les quatre
    bords sont bien vus (médiane) est imposé aux images qui s'en écartent de plus de 3 px ; on déplace le bord
    court le moins soutenu (doigts, main) le long des côtés longs."""
    if axis == "vertical":
        short = [(0, 1), (3, 2)]  # haut, bas
        moves = {0: (0, 1, 3, 2), 2: (3, 2, 0, 1)}  # bord : (coin a, coin b, ancre a, ancre b)
    else:
        short = [(0, 3), (1, 2)]  # gauche, droite
        moves = {3: (3, 0, 2, 1), 1: (1, 2, 0, 3)}
    def ratio(q):
        w = (np.linalg.norm(q[short[0][1]] - q[short[0][0]]) + np.linalg.norm(q[short[1][1]] - q[short[1][0]])) / 2
        if axis == "vertical":
            l = (np.linalg.norm(q[3] - q[0]) + np.linalg.norm(q[2] - q[1])) / 2
        else:
            l = (np.linalg.norm(q[1] - q[0]) + np.linalg.norm(q[2] - q[3])) / 2
        return l / w, w
    good = [ratio(raw[f])[0] for f in raw if min(_q(v) for v in oks[f]) >= 0.8]
    if rapport is None and len(good) < 3:
        return raw, {}
    rm = float(rapport) if rapport else float(np.median(good))
    out, corr = {}, {}
    for f, q in raw.items():
        r, w = ratio(q)
        q = q.copy()
        if abs(r - rm) * w > 3:
            sides = list(moves)
            side = bord if bord is not None else min(sides, key=lambda i: _q(oks[f][i]))
            a, b, aa, ab = moves[side]
            wref = np.linalg.norm(q[ab] - q[aa])
            for c, anc in ((a, aa), (b, ab)):
                u = (q[c] - q[anc]) / np.linalg.norm(q[c] - q[anc])
                q[c] = q[anc] + u * rm * wref
            corr[f] = int(side)
        out[f] = q
    return out, corr


def smooth(track, idxs, win=7):
    """Ajustement local quadratique symétrique, sans franchir un trou dans la suite des images."""
    out = {}
    segs, cur = [], [idxs[0]]
    for f in idxs[1:]:
        if f == cur[-1] + 1:
            cur.append(f)
        else:
            segs.append(cur)
            cur = [f]
    segs.append(cur)
    h = win // 2
    for seg in segs:
        A = np.array([track[f] for f in seg])  # (n,4,2)
        n = len(seg)
        # rejet des valeurs aberrantes isolées (coin caché un instant) : écart > 2,5 px à la médiane sur 5 images
        if n >= 5 and win > 1:
            M = np.array([np.median(A[max(0, k - 2):k + 3], axis=0) for k in range(n)])
            bad = np.abs(A - M) > 2.5
            A = np.where(bad, M, A)
        for k in range(n):
            a, b = max(0, k - h), min(n, k + h + 1)
            # fenêtre symétrique autant que possible
            r = min(k - a, b - 1 - k)
            a, b = k - r, k + r + 1
            if r == 0:
                out[seg[k]] = A[k]
                continue
            t = np.arange(a, b) - k
            deg = 2 if r >= 2 else 1
            V = np.vander(t, deg + 1)
            Y = A[a:b].reshape(b - a, -1)
            coef, *_ = np.linalg.lstsq(V, Y, rcond=None)
            out[seg[k]] = coef[-1].reshape(4, 2)
    return out


def run_tracking(name, cfg):
    src = os.path.join(SRC_DIR, name)
    want = frames_in(cfg)
    raw, gls, oks = {}, {}, {}
    prev = None
    prev_c = None
    last = -10
    for f, img in enumerate(read_frames(src)):
        if f not in want:
            continue
        S = green_score(img)
        first = prev is None or f != last + 1
        if first:
            q0 = np.array(cfg["quad_init"], float) if cfg.get("quad_init") else initial_quad(S, 60)
            prev = q0
        else:
            # grand mouvement (caméra à l'épaule) : départ décalé du déplacement du centre du vert
            x0, y0 = np.maximum(0, prev.min(0) - 150).astype(int)
            x1, y1 = np.minimum([W, H], prev.max(0) + 150).astype(int)
            ys, xs = np.nonzero(S[y0:y1, x0:x1] > 60)
            if len(xs) > 200 and prev_c is not None:
                c = np.array([xs.mean() + x0, ys.mean() + y0])
                sh_ = c - prev_c
                if np.abs(sh_).max() > 4:
                    prev = prev + sh_
        q, gl, ok = track_frame(S, prev, cfg, first)
        if first:  # deuxième départ depuis le résultat pour stabiliser
            q, gl, ok = track_frame(S, q, cfg, False)
        raw[f], gls[f], oks[f] = q, gl, ok
        prev, last = q, f
        x0, y0 = np.maximum(0, q.min(0) - 150).astype(int)
        x1, y1 = np.minimum([W, H], q.max(0) + 150).astype(int)
        ys, xs = np.nonzero(S[y0:y1, x0:x1] > 60)
        prev_c = np.array([xs.mean() + x0, ys.mean() + y0]) if len(xs) > 200 else None
    idxs = sorted(raw)
    corr = {}
    if cfg.get("axe_long"):
        raw, corr = enforce_aspect(raw, oks, cfg["axe_long"], cfg.get("bord_mobile"), cfg.get("rapport_impose"))
    sm = smooth(raw, idxs, cfg.get("lissage", 7))
    data = {"source": f"flow/clips/plans/{name}", "ordre_coins": "haut-gauche, haut-droit, bas-droit, bas-gauche (image)",
            "plages": cfg["plages"],
            "images": {str(f): {"brut": np.round(raw[f], 2).tolist(), "lisse": np.round(sm[f], 2).tolist(),
                                "niveau_vert": round(float(gls[f]), 1), "bords_vus": oks[f],
                                **({"corrige_proportions": corr[f]} if f in corr else {})} for f in idxs}}
    json.dump(data, open(os.path.join(SUIVI, name.replace(".mp4", ".json")), "w"), indent=0)
    return data


# ---------------------------------------------------------------- écrans
_cache = {}


def screen_img(key, hpx, rot):
    """Capture préréduite (Lanczos) à la hauteur utile, tournée si besoin."""
    k = (key, hpx, rot)
    if k in _cache:
        return _cache[k]
    h = int(min(2796, max(64, hpx)))
    if key.startswith("PHOTO:"):
        im = photo_screen(key[6:], h)
    else:
        fn = next(f for f in os.listdir(SCREENS) if f.startswith(key + "-") or f.startswith(key + "."))
        im = Image.open(os.path.join(SCREENS, fn)).convert("RGB")
        im = im.resize((round(1290 * h / 2796), h), Image.LANCZOS)
    if rot:
        im = im.rotate(rot, expand=True)
    _cache[k] = im
    return im


# Photo ouverte en grand (P07) : image d'une vidéo (« video:image », ex. flow/clips/plans/p10.mp4:30), posée en
# pleine largeur au centre d'un écran noir (photo plein écran, aucune interface). PHOTO_FRAC = hauteur de la photo
# rapportée à celle de l'écran (16:9 dans un écran 1290 × 2796).
PHOTO_FRAC = (1290 * 9 / 16) / 2796


def photo_source(spec):
    vid, n = spec.rsplit(":", 1)
    out = os.path.join(TMP, f"{os.path.basename(vid).replace('.mp4', '')}_img{int(n):03d}.png")
    if not os.path.exists(out):
        sh(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(TRAILER, vid), "-vf", f"select=eq(n\\,{int(n)})",
            "-frames:v", "1", out])
    return Image.open(out).convert("RGB")


def photo_rect(w, h):
    ph = w * 9 / 16
    return (0.0, (h - ph) / 2, float(w), (h + ph) / 2)


def photo_screen(spec, h):
    w = round(1290 * h / 2796)
    im = Image.new("RGB", (w, h), (0, 0, 0))
    x0, y0, x1, y1 = photo_rect(w, h)
    im.paste(photo_source(spec).resize((w, round(y1 - y0)), Image.LANCZOS), (0, round(y0)))
    return im


def open_photo(A, spec, src_rect, t):
    """Ouverture de la photo touchée : la vignette (src_rect, normalisé) grandit jusqu'au cadre plein écran,
    son contenu passe à la photo, le fond s'assombrit vers le noir."""
    w, h = A.size
    a = np.asarray(A, np.float32) * (1 - t)
    im = Image.fromarray(a.astype(np.uint8))
    fx0, fy0, fx1, fy1 = photo_rect(w, h)
    sx0, sy0, sx1, sy1 = src_rect[0] * w, src_rect[1] * h, src_rect[2] * w, src_rect[3] * h
    r = [sx0 + (fx0 - sx0) * t, sy0 + (fy0 - sy0) * t, sx1 + (fx1 - sx1) * t, sy1 + (fy1 - sy1) * t]
    rw, rh = max(2, round(r[2] - r[0])), max(2, round(r[3] - r[1]))
    thumb = A.crop((round(sx0), round(sy0), round(sx1), round(sy1))).resize((rw, rh), Image.LANCZOS)
    ph = photo_source(spec)
    # recadrage « remplir » de la photo au format du rectangle courant
    pw, phh = ph.size
    ar = rw / rh
    if ar < pw / phh:
        cw = phh * ar
        ph = ph.crop((round((pw - cw) / 2), 0, round((pw + cw) / 2), phh))
    else:
        ch = pw / ar
        ph = ph.crop((0, round((phh - ch) / 2), pw, round((phh + ch) / 2)))
    ph = ph.resize((rw, rh), Image.LANCZOS)
    im.paste(Image.blend(thumb, ph, min(1.0, t * 1.6)), (round(r[0]), round(r[1])))
    return im


def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def screen_at(cfg, f, hpx):
    """État de l'écran à l'image f : capture, glissement ou fondu entre deux captures réelles."""
    rot = cfg.get("rotation", 0)
    ev = cfg["etats"]
    cur = ev[0]["ecran"]
    for e in ev[1:]:
        a, dur = e["a"], e.get("duree", 4)
        if f < a:
            break
        if f < a + dur:
            t = ease((f - a + 1) / (dur + 1))
            A = screen_img(cur, hpx, 0)
            B = screen_img(e["ecran"], hpx, 0)
            if e.get("mode") == "ouvre_photo":
                im = open_photo(A, e["ecran"][6:], e["depuis"], t)
            elif e.get("mode", "fondu") == "fondu":
                im = Image.blend(A, B, t)
            else:  # glissement vertical (défilement) : haut = le nouveau monte depuis le bas
                w, h = A.size
                off = int(round(t * h))
                im = Image.new("RGB", (w, h))
                if e["mode"] == "glisse_haut":
                    im.paste(A, (0, -off))
                    im.paste(B, (0, h - off))
                else:
                    im.paste(A, (0, off))
                    im.paste(B, (0, off - h))
            return im.rotate(rot, expand=True) if rot else im
        cur = e["ecran"]
    return screen_img(cur, hpx, rot)


# ---------------------------------------------------------------- composition
def homography(src_pts, dst_pts):
    """H tel que dst ~ H · src."""
    A = []
    for (x, y), (u, v) in zip(src_pts, dst_pts):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(A, float))
    Hm = vt[-1].reshape(3, 3)
    return Hm / Hm[2, 2]


def warp(screen, quad, box, ss=2):
    """Capture posée sur quad (coords image), rendue dans box=(x0,y0,x1,y1), sur-échantillonnée ×ss."""
    x0, y0, x1, y1 = box
    w, h = screen.size
    dst = [((p[0] - x0) * ss, (p[1] - y0) * ss) for p in quad]
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    Hm = homography(dst, src)  # sortie → capture
    co = (Hm / Hm[2, 2]).ravel()[:8]
    size = ((x1 - x0) * ss, (y1 - y0) * ss)
    im = screen.transform(size, Image.PERSPECTIVE, tuple(co), Image.BICUBIC, fillcolor=(0, 0, 0))
    if ss != 1:
        im = im.resize((x1 - x0, y1 - y0), Image.BOX)
    return np.asarray(im, np.float32) / 255.0


def polymask(quad, box, grow=0.0, radius=0.0):
    """Masque du quadrilatère (agrandi de grow px, coins arrondis optionnels) dans box, sur-échantillonné."""
    x0, y0, x1, y1 = box
    ss = 4
    c = quad.mean(0)
    q = []
    for p in quad:
        v = p - c
        q.append(p + v / (np.linalg.norm(v) + 1e-6) * grow * 1.414)
    q = np.array(q)
    im = Image.new("L", ((x1 - x0) * ss, (y1 - y0) * ss), 0)
    dr = ImageDraw.Draw(im)
    if radius <= 0:
        dr.polygon([((p[0] - x0) * ss, (p[1] - y0) * ss) for p in q], fill=255)
    else:
        # arrondi : polygone échantillonné en coordonnées de l'écran (u, v) puis projeté
        w, h = 1.0, 2796 / 1290
        Hm = homography([(0, 0), (w, 0), (w, h), (0, h)], q)
        r = radius
        pts = []
        for cx, cy, a0 in ((w - r, r, -90), (w - r, h - r, 0), (r, h - r, 90), (r, r, 180)):
            for k in range(9):
                a = math.radians(a0 + k * 90 / 8)
                pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        P = np.array([[x, y, 1.0] for x, y in pts]) @ Hm.T
        P = P[:, :2] / P[:, 2:]
        dr.polygon([((p[0] - x0) * ss, (p[1] - y0) * ss) for p in P], fill=255)
    im = im.resize((x1 - x0, y1 - y0), Image.BOX)
    return np.asarray(im, np.float32) / 255.0


def disc_mask(quad, box, u, v, r):
    """Disque de rayon r (en largeurs d'écran) centré en (u, v) normalisés sur le quadrilatère, projeté."""
    x0, y0, x1, y1 = box
    ss = 4
    Hm = homography([(0, 0), (1, 0), (1, 1), (0, 1)], quad)
    asp = 1290 / 2796
    pts = [(u + r * math.cos(a), v + r * asp * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 32, endpoint=False)]
    P = np.array([[x, y, 1.0] for x, y in pts]) @ Hm.T
    P = P[:, :2] / P[:, 2:]
    im = Image.new("L", ((x1 - x0) * ss, (y1 - y0) * ss), 0)
    ImageDraw.Draw(im).polygon([((p[0] - x0) * ss, (p[1] - y0) * ss) for p in P], fill=255)
    return np.asarray(im.resize((x1 - x0, y1 - y0), Image.BOX), np.float32) / 255.0


def boxblur(a, r):
    if r < 1:
        return a
    k = 2 * r + 1
    p = np.pad(a, ((r + 1, r), (r + 1, r)), mode="edge")
    c = p.cumsum(0)
    c = (c[k:] - c[:-k])
    c = c.cumsum(1)
    return (c[:, k:] - c[:, :-k]) / (k * k)


def composite(img, f, quad_fn, cfg, gl, noise_sd, rng):
    q = quad_fn(f)
    lo = np.floor(q.min(0)).astype(int) - 24
    hi = np.ceil(q.max(0)).astype(int) + 24
    x0, y0 = max(0, lo[0]), max(0, lo[1])
    x1, y1 = min(W, hi[0]), min(H, hi[1])
    box = (x0, y0, x1, y1)
    src = img[y0:y1, x0:x1].astype(np.float32) / 255.0
    # hauteur utile de la capture (côté long projeté ×2 pour l'anti-crénelage)
    side = max(np.linalg.norm(q[3] - q[0]), np.linalg.norm(q[2] - q[1]), np.linalg.norm(q[1] - q[0]),
               np.linalg.norm(q[2] - q[3]))
    hpx = int(side * 2.2)
    rot = cfg.get("rotation", 0)
    # flou de mouvement : sous-images le long de la trajectoire (obturateur 180°)
    qa, qb = quad_fn(f - 0.25), quad_fn(f + 0.25)
    mv = float(np.abs(qb - qa).max())
    K = int(min(9, max(1, math.ceil(mv / 1.0))))
    scr = screen_at(cfg, f, hpx)
    acc = None
    for k in range(K):
        t = f - 0.25 + 0.5 * (k + 0.5) / K if K > 1 else f
        wq = quad_fn(t)
        im = warp(scr, wq, box)
        acc = im if acc is None else acc + im
    sc = acc / K
    cov = polymask(q, box, grow=0.0)  # zone couverte par la capture
    # flou de mise au point
    sg = cfg.get("flou", 0.0)
    if sg > 0:
        sc = np.asarray(Image.fromarray((np.clip(sc, 0, 1) * 255).astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(sg)), np.float32) / 255.0
    # lumière de la scène : gain, teinte, noir
    L = cfg.get("lumiere", {})
    gain = L.get("gain", 1.0)
    tint = np.array(L.get("teinte", [1, 1, 1]), np.float32)
    ta = L.get("teinte_force", 0.0)
    noir = L.get("noir", 0.0)
    sc = sc * gain
    sc = sc * (1 - ta) + sc * tint * ta
    sc = noir + (1 - noir) * sc
    # ombrage repris du vert (ombre du pouce, dégradé de la vitre)
    S = src[..., 1] * 255 - np.maximum(src[..., 0], src[..., 2]) * 255
    G = src[..., 1]
    inner = (S > 0.7 * gl)
    gref = np.median(G[inner]) if inner.sum() > 50 else 1.0
    m = np.clip(G / (gref + 1e-6), 0.55, 1.12)
    m = np.where(inner, m, 1.0)
    m = boxblur(boxblur(m, 3), 3)
    om = cfg.get("ombrage", 0.5)
    sc = sc * (1 - om + om * m[..., None])
    # reflet de vitre (fixe dans le monde : glisse quand le téléphone bouge)
    rf = cfg.get("reflet", {"force": 0.05, "angle": 35, "couleur": [1, 1, 1]})
    if rf.get("force", 0) > 0:
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        a = math.radians(rf.get("angle", 35))
        c0 = rf.get("centre", None)
        cx, cy = (c0 if c0 else q.mean(0))
        d = (xx - cx) * math.cos(a) + (yy - cy) * math.sin(a)
        wdt = max(8.0, side * rf.get("largeur", 0.35))
        band = np.exp(-(d / wdt) ** 2) * rf["force"] + rf.get("fond", 0.015)
        col = np.array(rf.get("couleur", [1, 1, 1]), np.float32)
        sc = 1 - (1 - sc) * (1 - band[..., None] * col)
    # grain mesuré sur le vert
    if noise_sd > 0:
        nz = rng.normal(0, noise_sd, sc.shape[:2]).astype(np.float32)
        sc = sc + nz[..., None] * 0.8 + rng.normal(0, noise_sd * 0.4, sc.shape).astype(np.float32)
    sc = np.clip(sc, 0, 1)
    # alpha : vert de la source, dans l'écran suivi (élargi de 3 px)
    zone = polymask(q, box, grow=cfg.get("marge_zone", 3.0))
    lo_, hi_ = cfg.get("seuils_alpha", [-0.05, 0.85])
    al = np.clip((S - lo_ * gl) / ((hi_ - lo_) * gl), 0, 1) * zone
    for (u, v, r) in cfg.get("zones_forcees", []):  # croix noires imprimées sur le vert (P16)
        al = np.maximum(al, disc_mask(q, box, u, v, r))
    if cfg.get("interieur_force"):  # P16 : croix noires dans le vert, rien ne passe devant l'écran
        inside = polymask(q, box, grow=-1.5, radius=cfg.get("rayon", 0.13))
        al = np.maximum(al, inside)
    # débordement vert retiré autour (doigts, cadre) dans l'écran élargi de 10 px
    # Démélange : on retire la part de vert (couleur du vert local × alpha) puis on ajoute la capture × alpha ;
    # le reste du débordement vert (reflets verts sur la peau, le cadre) est ramené à (r + b) / 2.
    dz = polymask(q, box, grow=10.0)
    gcol = np.median(src[inner], axis=0) if inner.sum() > 50 else np.array([0.15, 0.9, 0.1], np.float32)
    gloc = gcol[None, None, :] * m[..., None]
    fgp = np.clip(src - al[..., None] * gloc, 0, None)
    rb = 0.5 * (fgp[..., 0] + fgp[..., 2])  # limiteur « moyenne » : g ≤ (r + b) / 2
    spill = np.clip(fgp[..., 1] - rb, 0, None)
    fgp[..., 1] = fgp[..., 1] - spill * dz
    # alpha un peu fort au bord (vert retiré en trop) : pas de liseré magenta, g ≥ min(r, b) autour de l'écran
    gmin = np.minimum(fgp[..., 0], fgp[..., 2])
    fgp[..., 1] = np.where(dz > 0, np.maximum(fgp[..., 1], gmin), fgp[..., 1])
    full = al > 0.985
    out = np.where(full[..., None], sc, fgp + sc * al[..., None])
    res = img.copy()
    res[y0:y1, x0:x1] = np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8)
    return res, box


def quad_interp(sm):
    keys = sorted(sm)

    def fn(t):
        if t <= keys[0]:
            return np.array(sm[keys[0]])
        if t >= keys[-1]:
            return np.array(sm[keys[-1]])
        a = int(math.floor(t))
        b = a + 1
        if a not in sm or b not in sm:
            k = a if a in sm else b
            return np.array(sm[k])
        u = t - a
        return np.array(sm[a]) * (1 - u) + np.array(sm[b]) * u
    return fn


def measure_noise(img, quad):
    c = quad.mean(0).astype(int)
    r = int(max(6, min(np.ptp(quad[:, 0]), np.ptp(quad[:, 1])) * 0.12))
    g = img[c[1] - r:c[1] + r, c[0] - r:c[0] + r, 1].astype(np.float32) / 255
    hp = g - boxblur(g, 2)
    return max(0.003, float(np.std(hp)) * 1.2)  # plancher : vert saturé (g = 255) sans bruit mesurable


def run_composite(name, cfg, data):
    src = os.path.join(SRC_DIR, name)
    out = os.path.join(OUT_DIR, name)
    sm = {int(k): np.array(v["lisse"]) for k, v in data["images"].items()}
    gl = {int(k): v["niveau_vert"] for k, v in data["images"].items()}
    qfn = quad_interp(sm)
    want = frames_in(cfg)
    rng = np.random.default_rng(7)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", "24", "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "10",
                            "-pix_fmt", "yuv420p", "-colorspace", "smpte170m", "-color_primaries", "bt709",
                            "-color_trc", "iec61966-2-1", "-color_range", "tv", "-movflags", "+faststart", out],
                           stdin=subprocess.PIPE)
    noise = None
    n = 0
    boxes = {}
    for f, img in enumerate(read_frames(src)):
        if f in want:
            if noise is None:
                noise = measure_noise(img, sm[f]) * cfg.get("grain", 1.0)
            res, box = composite(img, f, qfn, cfg, gl[f], noise, rng)
            boxes[f] = box
        else:
            res = img
        enc.stdin.write(np.ascontiguousarray(res).tobytes())
        n += 1
    enc.stdin.close()
    enc.wait()
    print(f"{name}: {n} images écrites → {os.path.relpath(out, TRAILER)} (grain {noise:.4f})")
    return out


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    for name in args or [k for k in CFG if not k.startswith("_")]:
        cfg = CFG[name]
        if "--composition-seule" in sys.argv:
            data = json.load(open(os.path.join(SUIVI, name.replace(".mp4", ".json"))))
        else:
            data = run_tracking(name, cfg)
            print(f"{name}: suivi de {len(data['images'])} images")
        if "--suivi-seul" not in sys.argv:
            run_composite(name, cfg, data)
