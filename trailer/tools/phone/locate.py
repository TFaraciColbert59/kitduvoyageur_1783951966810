# Localise l'écran dans une image du plan : échelle par balayage + translation par corrélation FFT (rotation négligée).
import sys, json, numpy as np
from PIL import Image
def gray(im, f):
    im = im.convert('L'); return np.asarray(im.resize((im.size[0]//f, im.size[1]//f), Image.BILINEAR), dtype=np.float32)
def locate(frame_path, src_path, corners, f=4):
    fr = gray(Image.open(frame_path), f); fr = fr - fr.mean()
    src = Image.open(src_path)
    best = None
    for S in np.arange(1.0, 2.6, 0.02):
        w, h = int(1920*S/f), int(1080*S/f)
        s = np.asarray(src.convert('L').resize((w, h), Image.BILINEAR), dtype=np.float32); s = s - s.mean()
        H, W = fr.shape
        # corrélation : position du cadre dans l'image source agrandie
        P = np.zeros((h + H, w + W), np.float32); P[:h, :w] = s
        Q = np.zeros_like(P); Q[:H, :W] = fr
        c = np.fft.irfft2(np.fft.rfft2(P) * np.conj(np.fft.rfft2(Q)), s=P.shape)
        c = c[:h - H + 1, :w - W + 1] if h >= H and w >= W else c
        idx = np.unravel_index(np.argmax(c), c.shape); v = c[idx] / (np.linalg.norm(fr) * np.linalg.norm(s[idx[0]:idx[0]+H, idx[1]:idx[1]+W]) + 1e-6)
        if best is None or v > best[0]: best = (v, S, idx[1]*f, idx[0]*f)
    v, S, ox, oy = best
    pts = [((x*S) - ox, (y*S) - oy) for x, y in corners]
    return v, S, pts
if __name__ == '__main__':
    v, S, pts = locate(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]))
    print(json.dumps({'score': round(float(v), 3), 'S': round(float(S), 2), 'pts': [[round(a), round(b)] for a, b in pts]}))
