#!/usr/bin/env python3
"""Suivi de caméra pour les essais de motion design (proposition, hors montage).

Pour un plan [a, b] du film, calcule l'homographie H_n qui envoie les coordonnées de l'image de
référence r vers l'image n (chaînage de flux optique Lucas-Kanade image à image + RANSAC), et suit
quelques points « sujets » (marcheurs, coureur) qui bougent par rapport au décor.

Usage : python3 track.py <dossier-images> <sortie.json> <spec.json>
spec.json : {"shots": [{"id": "p26", "a": 589, "b": 630, "ref": 600,
                         "mask": [[x, y], ...]   (polygone des zones fiables, facultatif),
                         "points": {"marcheurs": [x, y]}}]}
Les images sont lues sous <dossier>/fNNNN.png.
"""
import json
import sys

import cv2
import numpy as np


def load(folder, n):
    im = cv2.imread(f"{folder}/f{n:04d}.png", cv2.IMREAD_GRAYSCALE)
    if im is None:
        raise SystemExit(f"image manquante : {folder}/f{n:04d}.png")
    return im


def step_h(prev, cur, mask):
    pts = cv2.goodFeaturesToTrack(prev, maxCorners=1500, qualityLevel=0.005, minDistance=12, mask=mask)
    nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, cur, pts, None, winSize=(31, 31), maxLevel=4)
    back, st2, _ = cv2.calcOpticalFlowPyrLK(cur, prev, nxt, None, winSize=(31, 31), maxLevel=4)
    ok = (st[:, 0] == 1) & (st2[:, 0] == 1) & (np.linalg.norm(back - pts, axis=2)[:, 0] < 0.8)
    H, inl = cv2.findHomography(pts[ok], nxt[ok], cv2.RANSAC, 1.5)
    return H, int(ok.sum()), int(inl.sum()) if inl is not None else 0


def track_point(frames, ref_idx, p0):
    """Suit un point dans les deux sens depuis l'image de référence (fenêtre petite : sujets minuscules)."""
    out = {ref_idx: list(map(float, p0))}
    for direction in (1, -1):
        p = np.array([[p0]], np.float32)
        i = ref_idx
        while 0 <= i + direction < len(frames):
            j = i + direction
            q, st, err = cv2.calcOpticalFlowPyrLK(frames[i], frames[j], p, None, winSize=(25, 25), maxLevel=3)
            if st[0, 0] != 1:
                q = p
            p = q
            out[j] = [float(p[0, 0, 0]), float(p[0, 0, 1])]
            i = j
    return [out[k] for k in range(len(frames))]


def main():
    folder, out_path, spec_path = sys.argv[1:4]
    spec = json.load(open(spec_path))
    result = {}
    for shot in spec["shots"]:
        a, b, r = shot["a"], shot["b"], shot["ref"]
        ns = list(range(a, b + 1))
        frames = [load(folder, n) for n in ns]
        mask = None
        if shot.get("mask"):
            mask = np.zeros_like(frames[0])
            cv2.fillPoly(mask, [np.array(shot["mask"], np.int32)], 255)
        # H_step[k] : image k -> image k+1
        steps = []
        stats = []
        for k in range(len(ns) - 1):
            H, nok, ninl = step_h(frames[k], frames[k + 1], mask)
            steps.append(H)
            stats.append(ninl)
        ri = ns.index(r)
        Hs = [None] * len(ns)
        Hs[ri] = np.eye(3)
        for k in range(ri + 1, len(ns)):
            Hs[k] = steps[k - 1] @ Hs[k - 1]
        for k in range(ri - 1, -1, -1):
            Hs[k] = np.linalg.inv(steps[k]) @ Hs[k + 1]
        pts = {name: track_point(frames, ri, p) for name, p in (shot.get("points") or {}).items()}
        result[shot["id"]] = {
            "a": a,
            "b": b,
            "ref": r,
            "H": [(h / h[2, 2]).flatten().tolist() for h in Hs],
            "points": pts,
            "inliersMin": min(stats) if stats else None,
        }
        print(shot["id"], "images", len(ns), "inliers min", min(stats) if stats else "-", file=sys.stderr)
    json.dump(result, open(out_path, "w"))


if __name__ == "__main__":
    main()
