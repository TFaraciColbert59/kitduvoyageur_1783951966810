#!/usr/bin/env python3
"""Suivi de caméra des apparitions du fil (v6) sur les images du montage, et mesure de l'écart de suivi.

python3 motion-lab/v6/track-v6.py <dossier-images (fNNNN.jpg)> <sortie.json>
Lit motion-lab/v6/geo-v6.json. Pour chaque plan : homographies réf → image n (flux optique LK + RANSAC,
chaînées), suivi du sujet (point LK), et CONTRÔLE : l'image de référence est déformée par H_n puis, autour de
chaque point du chemin projeté, un patch 41×41 de cette image déformée est recherché (NCC) dans l'image n à ±24 px.
Le déplacement du meilleur appariement = écart entre le trait posé et le décor réel à cet endroit (en px).
"""
import json, os, sys
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from track import step_h, track_point  # noqa: E402

def load(folder, n):
    im = cv2.imread(f"{folder}/f{n:04d}.jpg", cv2.IMREAD_GRAYSCALE)
    if im is None:
        raise SystemExit(f"image manquante {n}")
    return im

def resample(pts, step=40):
    pts = np.array(pts, float); out = [pts[0]]
    for a, b in zip(pts[:-1], pts[1:]):
        d = np.linalg.norm(b - a); k = max(1, int(d // step))
        for i in range(1, k + 1): out.append(a + (b - a) * i / k)
    return np.array(out)

def main():
    folder, out_path = sys.argv[1:3]
    only = sys.argv[3].split(",") if len(sys.argv) > 3 else None  # recalcul de quelques plans seulement
    geo = json.load(open(os.path.join(HERE, "geo-v6.json")))
    res = json.load(open(out_path)) if only and os.path.exists(out_path) else {}
    for key, g in geo.items():
        if not isinstance(g, dict) or "ref" not in g: continue
        if only and key not in only: continue
        a, b, r = g["a"], g["b"], g["ref"]
        ns = list(range(a, b + 1)); fr = [load(folder, n) for n in ns]
        mask = None
        if g.get("masque"):
            mask = np.zeros_like(fr[0]); cv2.fillPoly(mask, [np.array(g["masque"], np.int32)], 255)
        steps = [step_h(fr[k], fr[k + 1], mask)[0] for k in range(len(ns) - 1)]
        ri = ns.index(r); Hs = [None] * len(ns); Hs[ri] = np.eye(3)
        for k in range(ri + 1, len(ns)): Hs[k] = steps[k - 1] @ Hs[k - 1]
        for k in range(ri - 1, -1, -1): Hs[k] = np.linalg.inv(steps[k]) @ Hs[k + 1]
        # Affinage ECC (homographie) de chaque H_n contre l'image de référence, sur une bande de ±70 px autour du
        # chemin (dans le décor que le trait touche) : supprime la dérive du chaînage et la parallaxe du lointain.
        band = np.zeros_like(fr[0])
        P = np.array(g["chemin"], np.int32)
        cv2.polylines(band, [P], False, 255, thickness=int(g.get("bande", 140)))
        if g.get("bande_sous"):  # bande seulement sous le chemin (crête : pas de brouillard qui bouge)
            band[:] = 0
            poly = np.vstack([P, (P + [0, g["bande_sous"]])[::-1]])
            cv2.fillPoly(band, [poly.astype(np.int32)], 255)
        S = np.diag([0.5, 0.5, 1.0]); Si = np.linalg.inv(S)
        tpl = cv2.resize(fr[ri], None, fx=0.5, fy=0.5).astype(np.float32)
        bm = cv2.resize(band, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_NEAREST)
        for k in range(len(ns)):
            if k == ri: continue
            W = (S @ Hs[k] @ Si).astype(np.float32)
            img = cv2.resize(fr[k], None, fx=0.5, fy=0.5).astype(np.float32)
            try:
                _, W = cv2.findTransformECC(tpl, img, W, cv2.MOTION_HOMOGRAPHY, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), bm, 5)
                Hs[k] = Si @ W.astype(np.float64) @ S
            except cv2.error as e:
                print(key, "ECC échoue à l'image", ns[k], file=sys.stderr)
        suj = track_point(fr, ri, g["sujet"]) if g.get("sujet") else None
        ctrl = resample(g["chemin"], 40)
        ecarts = []
        for k, n in enumerate(ns):
            Hk = Hs[k] / Hs[k][2, 2]
            warped = cv2.warpPerspective(fr[ri], Hk, (1920, 1080))
            q = cv2.perspectiveTransform(ctrl.reshape(-1, 1, 2), Hk).reshape(-1, 2)
            e_im = []
            for (x, y) in q:
                x, y = int(round(x)), int(round(y)); h = 20; s = 24
                if not (h + s <= x < 1920 - h - s and h + s <= y < 1080 - h - s): continue
                tpl = warped[y - h:y + h + 1, x - h:x + h + 1]
                if tpl.std() < 6: continue
                win = fr[k][y - h - s:y + h + s + 1, x - h - s:x + h + s + 1]
                m = cv2.matchTemplate(win, tpl, cv2.TM_CCOEFF_NORMED)
                _, mx, _, loc = cv2.minMaxLoc(m)
                if mx < 0.5: continue
                e_im.append(float(np.hypot(loc[0] - s, loc[1] - s)))
            ecarts.append({"image": n, "points": len(e_im), "median": float(np.median(e_im)) if e_im else None, "max": float(max(e_im)) if e_im else None})
        vals = [e["median"] for e in ecarts if e["median"] is not None]
        mxs = [e["max"] for e in ecarts if e["max"] is not None]
        res[key] = {"a": a, "b": b, "ref": r, "H": [(h / h[2, 2]).flatten().tolist() for h in Hs], "sujet": suj, "controle": ecarts,
                    "resume": {"images": len(ns), "ecart_median_px": round(float(np.median(vals)), 2) if vals else None,
                               "ecart_p95_px": round(float(np.percentile(vals, 95)), 2) if vals else None,
                               "ecart_max_px": round(float(max(mxs)), 2) if mxs else None}}
        print(key, res[key]["resume"], file=sys.stderr)
    json.dump(res, open(out_path, "w"))

if __name__ == "__main__":
    main()
