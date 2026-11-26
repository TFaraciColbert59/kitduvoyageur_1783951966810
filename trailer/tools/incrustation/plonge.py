#!/usr/bin/env python3
"""Plongée P09 : la caméra fonce dans l'écran du téléphone de P07 jusqu'à ce que la photo du lac remplisse le cadre.

    python3 tools/incrustation/plonge.py

Entrées : flow/clips/incrustes/p07.mp4 (P07 incrusté, photo du lac plein écran à partir de n°48), coins de l'écran
tools/incrustation/suivi/p07.json, vidéo source flow/clips/plans/p07.mp4 (pour garder les doigts devant),
photo = image 30 de flow/clips/plans/p10.mp4 (première image montée de P10).
Sortie : flow/clips/rendus/p09-plongee.mp4, 27 images (6 de marge = p07 n°58–63 telles quelles, puis les 21 images
de la plongée sur p07 n°64–84), 1920×1080, 24 i/s, H.264 CRF 10, sans son. La dernière image est exactement
l'image 30 de p10 (posée telle quelle).

Caméra : homographie B(t) qui envoie le rectangle de la photo (dans l'écran suivi) vers C(t). C(t) = similitude
(zoom z = Z^(t^2,2), accélération continue ; rotation qui redresse l'écran ; centre de la photo amené au centre du
cadre au rythme du zoom) + résidu de perspective qui s'annule à l'arrivée. Fond (téléphone, mains, fenêtre) =
image incrustée déformée par B(t) ; photo nette par-dessus (rendue depuis p10 n°30, pas agrandie depuis la vidéo),
qui passe du rendu « écran » à la photo brute ; doigts devant (vert de la source). Flou de vitesse : moyenne de
sous-images sur l'obturateur (180°) le long de la trajectoire de la caméra, donc flou de zoom radial qui grandit
avec la vitesse ; obturateur ramené à 0 sur les deux dernières images pour arriver net sur la photo.
"""
import json, math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import incruste as I  # noqa: E402

N_MARGE, N = 6, 21
SRC0 = 64  # première image p07 de la plongée
OUT = os.path.join(I.TRAILER, "flow/clips/rendus/p09-plongee.mp4")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
W, H = I.W, I.H
F = np.array([[0, 0], [W, 0], [W, H], [0, H]], float)
EXP = 2.2


def photo_quad(q):
    """Rectangle de la photo (plein largeur, 16:9, centré) dans l'écran suivi q."""
    a = (1 - I.PHOTO_FRAC) / 2
    Hm = I.homography([(0, 0), (1, 0), (1, 1), (0, 1)], q)
    P = np.array([[0, a, 1], [1, a, 1], [1, 1 - a, 1], [0, 1 - a, 1]], float) @ Hm.T
    return P[:, :2] / P[:, 2:]


def similarity(A, B):
    """Similitude (échelle, angle, translation) qui envoie au mieux A vers B."""
    ca, cb = A.mean(0), B.mean(0)
    a, b = A - ca, B - cb
    za = a[:, 0] + 1j * a[:, 1]
    zb = b[:, 0] + 1j * b[:, 1]
    k = (np.conj(za) @ zb) / (np.conj(za) @ za)
    return abs(k), math.atan2(k.imag, k.real), ca, cb


def target(Q, t, Z, th):
    """Coins d'arrivée C(t) du rectangle de la photo Q (source) à l'instant t ∈ [0, 1]."""
    z = Z ** (t ** EXP)
    g = (z - 1) / (Z - 1)
    c = Q.mean(0)
    p = c + (F.mean(0) - c) * g
    ang = th * g
    R = np.array([[math.cos(ang), -math.sin(ang)], [math.sin(ang), math.cos(ang)]])
    C = p + (z * (Q - c)) @ R.T
    # résidu de perspective vers le cadre exact, nul au départ
    Zf, thf = Z, th
    Rf = np.array([[math.cos(thf), -math.sin(thf)], [math.sin(thf), math.cos(thf)]])
    C1 = F.mean(0) + (Zf * (Q - c)) @ Rf.T
    return C + (F - C1) * g ** 2, g


def warp_img(img, Hm, out_size=(W, H)):
    co = np.linalg.inv(Hm)
    co = (co / co[2, 2]).ravel()[:8]
    return img.transform(out_size, Image.PERSPECTIVE, tuple(co), Image.BICUBIC, fillcolor=0 if img.mode == "L" else (0, 0, 0))


def main():
    data = json.load(open(os.path.join(I.SUIVI, "p07.json")))["images"]
    sm = {int(k): np.array(v["lisse"]) for k, v in data.items()}
    gl = {int(k): v["niveau_vert"] for k, v in data.items()}
    need = set(range(SRC0 - N_MARGE, SRC0 + N))
    inc = {f: im for f, im in enumerate(I.read_frames(os.path.join(I.TRAILER, "flow/clips/incrustes/p07.mp4"))) if f in need}
    src = {f: im for f, im in enumerate(I.read_frames(os.path.join(I.SRC_DIR, "p07.mp4"))) if f in need}
    photo = I.photo_source("flow/clips/plans/p10.mp4:30")
    assert photo.size == (W, H)
    photo_np = np.asarray(photo, np.float32)
    # Z et angle d'arrivée calculés sur le rectangle de la photo à la dernière image de la plongée
    Zl, thl, _, _ = similarity(photo_quad(sm[SRC0 + N - 1]), F)
    print(f"zoom total ×{Zl:.2f}, rotation {math.degrees(thl):.2f}°")
    frames, log = [], []
    for f in range(SRC0 - N_MARGE, SRC0):
        frames.append(inc[f])
    pq_photo = np.array([[0, 0], [W, 0], [W, H], [0, H]], float)
    for k in range(N):
        f = SRC0 + k
        t1 = (k + 1) / N
        last = k == N - 1
        if last:
            frames.append(np.asarray(photo, np.uint8).copy())
            log.append({"image": N_MARGE + k, "p07": f, "zoom": round(Zl, 3), "sous_images": 0})
            continue
        shutter = 0.5 if k < N - 3 else (0.25 if k == N - 3 else 0.0)
        dt = shutter / N
        z_now = Zl ** (t1 ** EXP)
        z_prev = Zl ** (max(0, t1 - dt) ** EXP)
        K = 1 if dt == 0 else int(min(24, max(2, math.ceil(abs(z_now - z_prev) / z_now * 1100 / 2.0))))
        q = sm[f]
        Q = photo_quad(q)
        Z, th, _, _ = similarity(Q, F)
        Z, th = Zl, thl
        bg = Image.fromarray(inc[f])
        # doigts : alpha du vert de la source (1 = vert = écran visible)
        S = I.green_score(src[f])
        key = np.clip((S + 0.05 * gl[f]) / (0.9 * gl[f]), 0, 1)
        key_im = Image.fromarray((key * 255).astype(np.uint8))
        acc = np.zeros((H, W, 3), np.float32)
        for j in range(K):
            ts = t1 - dt * (j / max(1, K - 1)) if K > 1 else t1
            C, g = target(Q, ts, Z, th)
            Bm = I.homography(Q, C)  # source → sortie
            back = np.asarray(warp_img(bg, Bm), np.float32)
            Pm = I.homography(pq_photo, C)  # photo → sortie
            ph = np.asarray(warp_img(photo, Pm), np.float32)
            mask = np.asarray(warp_img(Image.new("L", (W, H), 255), Pm).convert("L"), np.float32) / 255
            kk = np.asarray(warp_img(key_im, Bm).convert("L"), np.float32) / 255
            # au départ, l'image incrustée contient déjà la photo (rendu « écran ») ; la photo nette prend le relais
            w_ph = (mask * kk * min(1.0, 1.5 * g))[..., None]
            acc += back * (1 - w_ph) + ph * w_ph
        out = np.clip(acc / K + 0.5, 0, 255).astype(np.uint8)
        frames.append(out)
        log.append({"image": N_MARGE + k, "p07": f, "zoom": round(z_now, 3), "sous_images": K})
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", "24", "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "10",
                            "-pix_fmt", "yuv420p", "-colorspace", "smpte170m", "-color_primaries", "bt709",
                            "-color_trc", "iec61966-2-1", "-color_range", "tv", "-movflags", "+faststart", OUT],
                           stdin=subprocess.PIPE)
    for fr in frames:
        enc.stdin.write(np.ascontiguousarray(fr).tobytes())
    enc.stdin.close()
    enc.wait()
    json.dump({"sortie": "flow/clips/rendus/p09-plongee.mp4", "images": len(frames), "marge": N_MARGE,
               "marge_p07": [SRC0 - N_MARGE, SRC0 - 1], "plongee_p07": [SRC0, SRC0 + N - 1],
               "derniere_image": "image 30 de flow/clips/plans/p10.mp4, posée telle quelle",
               "zoom_total": round(Zl, 3), "rotation_deg": round(math.degrees(thl), 2), "detail": log},
              open(os.path.join(I.SUIVI, "plongee-p09.json"), "w"), indent=1, ensure_ascii=False)
    print(f"{len(frames)} images → {os.path.relpath(OUT, I.TRAILER)}")


if __name__ == "__main__":
    main()
