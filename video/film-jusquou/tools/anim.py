# Moteur d'animation des plans de « Jusqu'où » : chaque image fixe devient un plan vidéo vivant.
#  1. Caméra 2.5D : la carte de profondeur (assets/depth) décale chaque pixel selon sa distance
#     (travelling, plongée, montée, rotation, caméra à l'épaule) : l'avant-plan glisse plus vite que le fond.
#  2. Effets : brume et nuages qui dérivent, eau qui coule, vent sur les contours (cheveux, tissus, herbe),
#     pluie, embruns, vapeur, étoiles qui scintillent, lumières qui vacillent, paysage qui défile.
# Déterministe (graines fixes). Sortie : assets/shots/NN.mp4 en 1080×1920, 30 i/s.
# Usage : python tools/anim.py [NN ...]   (sans argument : tous les plans)
import os, sys, subprocess, math
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREP = os.path.join(ROOT, 'assets', 'prep'); DEP = os.path.join(ROOT, 'assets', 'depth')
OUT = os.path.join(ROOT, 'assets', 'shots'); os.makedirs(OUT, exist_ok=True)
W, H = 1188, 2112          # image préparée (1080×1920 + 10 % de marge)
OW, OH = 1080, 1920        # sortie
FPS = 30
ox, oy = (W - OW) // 2, (H - OH) // 2
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)

def ease(u): return 0.5 - 0.5 * math.cos(math.pi * min(1, max(0, u)))
def lerp(a, b, u): return a + (b - a) * u

def fbm(h, w, seed, cell=180, octaves=4):
    """Bruit fractal lisse dans [0,1] (somme d'octaves de bruit agrandi)."""
    r = np.random.default_rng(seed); out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        c = max(4, int(cell / (2 ** o)))
        g = r.random((h // c + 3, w // c + 3)).astype(np.float32)
        out += amp * cv2.resize(g, (w + 3 * c, h + 3 * c), interpolation=cv2.INTER_CUBIC)[c:c + h, c:c + w]
        tot += amp; amp *= 0.5
    out /= tot
    return (out - out.min()) / (out.max() - out.min() + 1e-6)

def soft(mask, k=41):
    k = k | 1
    return cv2.GaussianBlur(mask.astype(np.float32), (k, k), 0)

def box(x0, y0, x1, y1, feather=60):
    """Masque rectangulaire adouci, coordonnées en fraction de l'image préparée."""
    m = np.zeros((H, W), np.float32); m[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = 1
    return soft(m, feather)

def ellipse(cx, cy, rx, ry, feather=60):
    m = (((XX / W - cx) / rx) ** 2 + ((YY / H - cy) / ry) ** 2 <= 1).astype(np.float32)
    return soft(m, feather)

class Shot:
    def __init__(self, n):
        self.n = n
        self.img = np.asarray(Image.open(os.path.join(PREP, f'{n:02d}.jpg')).convert('RGB')).astype(np.float32) / 255
        d = np.asarray(Image.open(os.path.join(DEP, f'{n:02d}.png'))).astype(np.float32) / 65535
        self.depth = d
        # profondeur « gonflée » vers l'avant-plan pour que les bords proches s'étirent au lieu de se déchirer
        dw = cv2.dilate(d, np.ones((9, 9), np.uint8)); self.dwarp = cv2.GaussianBlur(dw, (21, 21), 0)
        gx = cv2.Sobel(cv2.GaussianBlur(d, (7, 7), 0), cv2.CV_32F, 1, 0); gy = cv2.Sobel(cv2.GaussianBlur(d, (7, 7), 0), cv2.CV_32F, 0, 1)
        e = np.sqrt(gx * gx + gy * gy); self.edges = soft(np.clip(e / (np.percentile(e, 99) + 1e-6), 0, 1), 31)
        self.far = np.clip(1 - d * 1.6, 0, 1)

    # --- caméra 2.5D -------------------------------------------------------
    def warp(self, frame, tx, ty, z, k, rot, gx, gy):
        cx, cy = W / 2, H / 2
        c, s = math.cos(math.radians(-rot)), math.sin(math.radians(-rot))
        sx, sy = XX.copy(), YY.copy()
        for _ in range(3):   # inversion approchée du modèle direct p = c + R·(src−c)·z(1+k·d) + (tx,ty)·d + g
            d = cv2.remap(self.dwarp, sx, sy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            qx = XX - cx - tx * d - gx; qy = YY - cy - ty * d - gy
            rx = c * qx - s * qy; ry = s * qx + c * qy
            sc = z * (1 + k * d)
            sx = (cx + rx / sc).astype(np.float32); sy = (cy + ry / sc).astype(np.float32)
        out = cv2.remap(frame, sx, sy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        return out, sx, sy

def displace(frame, dx, dy):
    return cv2.remap(frame, (XX + dx).astype(np.float32), (YY + dy).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

# --- effets (chaque effet reçoit le plan, l'image courante et le temps en secondes) ---------------
class Mist:
    """Nappes de brume qui dérivent, plus denses au loin (masque × fond)."""
    def __init__(self, sh, mask, color=(0.86, 0.88, 0.9), strength=0.45, speed=(60, 0), cell=260, seed=1, thr=0.42):
        t = fbm(H + 400, W + 1400, seed, cell); k = (int(cell * 0.35) | 1)
        self.tex = cv2.GaussianBlur(t, (k, k), 0); self.tex = (self.tex - self.tex.min()) / (self.tex.max() - self.tex.min() + 1e-6)
        self.mask = mask; self.col = np.array(color, np.float32)
        self.st, self.sp, self.thr = strength, speed, thr
    def __call__(self, sh, f, t):
        x0 = int(700 + self.sp[0] * t); y0 = int(200 + self.sp[1] * t)
        n = self.tex[y0:y0 + H, x0:x0 + W]
        a = (np.clip((n - self.thr) * 2.6, 0, 1) * self.mask * self.st)[..., None]
        return f * (1 - a) + self.col * a

class Flow:
    """Déplacement fluide dans une zone : eau qui coule, nuages qui bouillonnent, tissu ou cheveux au vent."""
    def __init__(self, sh, mask, amp=6, speed=(0, 80), cell=90, seed=2, wobble=0.0):
        self.tx = fbm(H + 600, W + 600, seed, cell, 3) - 0.5; self.ty = fbm(H + 600, W + 600, seed + 50, cell, 3) - 0.5
        self.mask, self.amp, self.sp, self.wob = mask, amp, speed, wobble
    def __call__(self, sh, f, t):
        x0 = int(300 - self.sp[0] * t) % 600; y0 = int(300 - self.sp[1] * t) % 600
        a = self.amp * (1 + self.wob * math.sin(t * 9))
        dx = self.tx[y0:y0 + H, x0:x0 + W] * 2 * a * self.mask; dy = self.ty[y0:y0 + H, x0:x0 + W] * 2 * a * self.mask
        return displace(f, dx, dy)

class Scroll:
    """Fait défiler une zone (paysage derrière une vitre, nuages derrière un hublot) avec flou de vitesse."""
    def __init__(self, sh, mask, speed=(-900, 0), blur=0):
        self.mask, self.sp, self.blur = mask[..., None], speed, blur
    def __call__(self, sh, f, t):
        g = displace(f, np.full((H, W), -self.sp[0] * t, np.float32), np.full((H, W), -self.sp[1] * t, np.float32))
        if self.blur: g = cv2.blur(g, (self.blur, 1))
        return f * (1 - self.mask) + g * self.mask

class Rain:
    """Pluie ou bruine : traits fins, légèrement inclinés, qui tombent."""
    def __init__(self, sh, n=900, speed=2600, length=38, angle=12, alpha=0.18, seed=3, color=(0.92, 0.94, 0.96), area=None):
        r = np.random.default_rng(seed); self.p = r.random((n, 3)); self.n = n
        self.sp, self.len, self.ang, self.al, self.col, self.area = speed, length, math.radians(angle), alpha, color, area
    def __call__(self, sh, f, t):
        ov = np.zeros((H, W), np.float32)
        dx, dy = math.sin(self.ang), math.cos(self.ang)
        for i in range(self.n):
            px, py, ph = self.p[i]
            v = self.sp * (0.7 + 0.6 * ph)
            y = (py * (H + 400) + v * t) % (H + 400) - 200; x = px * (W + 400) - 200 + dx / dy * (y + 200)
            L = self.len * (0.6 + 0.8 * ph)
            cv2.line(ov, (int(x), int(y)), (int(x + dx * L), int(y + dy * L)), 0.6 + 0.4 * ph, 1, cv2.LINE_AA)
        ov = cv2.GaussianBlur(ov, (3, 3), 0) * self.al
        if self.area is not None: ov *= self.area
        return f + (np.array(self.col, np.float32) - f) * ov[..., None]

class Spray:
    """Gouttelettes projetées (embruns, éclaboussures) qui partent d'une zone et retombent."""
    def __init__(self, sh, origin, n=220, vel=(500, -900), spread=600, grav=1800, size=3, alpha=0.7, seed=4, period=0.9):
        r = np.random.default_rng(seed); self.p = r.random((n, 5)); self.n = n
        self.o, self.v, self.spr, self.g, self.sz, self.al, self.per = origin, vel, spread, grav, size, alpha, period
    def __call__(self, sh, f, t):
        ov = np.zeros((H, W), np.float32)
        for i in range(self.n):
            a, b, c, d, e = self.p[i]
            tt = (t + a * self.per) % self.per
            x0 = self.o[0] * W + (b - 0.5) * self.spr; y0 = self.o[1] * H + (c - 0.5) * 120
            vx = self.v[0] * (0.5 + d); vy = self.v[1] * (0.6 + 0.8 * e)
            x = x0 + vx * tt; y = y0 + vy * tt + 0.5 * self.g * tt * tt
            x2 = x - vx * 0.012; y2 = y - (vy + self.g * tt) * 0.012
            cv2.line(ov, (int(x), int(y)), (int(x2), int(y2)), 1.0, max(1, int(self.sz * (0.5 + e))), cv2.LINE_AA)
        ov = cv2.GaussianBlur(ov, (5, 5), 0) * self.al
        return f + (0.95 - f) * ov[..., None]

class Steam:
    """Vapeur qui monte en volutes au-dessus d'une source."""
    def __init__(self, sh, cx, cy, width=0.25, height=0.3, strength=0.35, speed=220, seed=5, color=(0.93, 0.9, 0.86)):
        self.tex = cv2.GaussianBlur(fbm(H + 1200, W + 200, seed, 90, 4), (21, 21), 0)
        cone = np.clip(1 - np.abs((XX / W - cx) / (width * (0.4 + 1.6 * np.clip((cy - YY / H) / height, 0, 1)))), 0, 1)
        vert = np.clip((cy - YY / H) / 0.03, 0, 1) * np.clip(1 - (cy - YY / H) / height, 0, 1)
        self.mask = soft(cone * vert, 61); self.st, self.sp, self.col = strength, speed, np.array(color, np.float32)
    def __call__(self, sh, f, t):
        y0 = int(1000 - self.sp * t) % 1000; x0 = int(100 + 30 * math.sin(t * 2.2))
        n = self.tex[y0:y0 + H, x0:x0 + W]
        a = (np.clip((n - 0.45) * 3, 0, 1) * self.mask * self.st)[..., None]
        return f * (1 - a) + self.col * a

class Twinkle:
    """Étoiles qui scintillent (points brillants isolés dans une zone)."""
    def __init__(self, sh, area, thr=0.12, amp=0.8, seed=6):
        L = sh.img.mean(-1); top = L - cv2.GaussianBlur(L, (15, 15), 0)
        st = ((top > thr) * area > 0.5).astype(np.uint8)
        nl, lab = cv2.connectedComponents(st)
        r = np.random.default_rng(seed); ph = r.random(nl + 1) * 6.28; fr = 3 + r.random(nl + 1) * 7
        self.lab, self.ph, self.fr, self.amp = lab, ph.astype(np.float32), fr.astype(np.float32), amp
        self.m = cv2.GaussianBlur(st.astype(np.float32), (5, 5), 0)
    def __call__(self, sh, f, t):
        g = (1 + self.amp * np.sin(self.ph[self.lab] + self.fr[self.lab] * t)) * (self.lab > 0)
        g = cv2.GaussianBlur(g.astype(np.float32), (5, 5), 0)
        return np.clip(f * (1 + (g * self.m)[..., None] * 0.9), 0, 1)

class Flicker:
    """Lumière qui vacille (fenêtre, lampe, frontale, écran)."""
    def __init__(self, sh, mask, amp=0.12, rate=1.0, warm=(1.0, 0.95, 0.85), seed=7):
        r = np.random.default_rng(seed); self.w = r.random(4) * 10 + 4; self.ph = r.random(4) * 6.28
        self.mask, self.amp, self.rate, self.warm = mask[..., None], amp, rate, np.array(warm, np.float32)
    def __call__(self, sh, f, t):
        v = sum(math.sin(self.ph[i] + self.w[i] * t * self.rate) for i in range(4)) / 4
        return np.clip(f * (1 + self.mask * self.amp * v * self.warm), 0, 1)

class Glow:
    """Lumière qui monte (soleil qui touche les sommets) : éclaircissement chaud progressif dans une zone."""
    def __init__(self, sh, mask, start=0.0, end=0.25, color=(1.0, 0.72, 0.62), dur=1.0):
        self.mask, self.s, self.e, self.col, self.dur = mask[..., None], start, end, np.array(color, np.float32), dur
    def __call__(self, sh, f, t):
        k = lerp(self.s, self.e, ease(t / self.dur))
        return np.clip(f + (self.col - f) * self.mask * k * f.mean(-1, keepdims=True), 0, 1)

class Sweep:
    """Bande de lumière douce qui traverse l'image (soleil, rayon par la fenêtre)."""
    def __init__(self, sh, angle=-25, width=0.25, strength=0.18, x0=-0.4, x1=1.3, dur=1.0, color=(1.0, 0.92, 0.8)):
        a = math.radians(angle); self.u = (XX / W) * math.cos(a) + (YY / H) * math.sin(a)
        self.w, self.st, self.x0, self.x1, self.dur, self.col = width, strength, x0, x1, dur, np.array(color, np.float32)
    def __call__(self, sh, f, t):
        c = lerp(self.x0, self.x1, t / self.dur)
        g = np.exp(-((self.u - c) / self.w) ** 2) * self.st
        return np.clip(f + (self.col - f) * g[..., None] * 0.6, 0, 1)

class Rotate:
    """Fait osciller une zone circulaire (le cadran de la boussole qui cherche le nord)."""
    def __init__(self, sh, cx, cy, r, amp=4.0, freq=5.0, feather=30):
        self.c = (cx * W, cy * H); self.amp, self.fr = amp, freq
        self.mask = soft((((XX - self.c[0]) ** 2 + (YY - self.c[1]) ** 2) <= (r * W) ** 2).astype(np.float32), feather)[..., None]
    def __call__(self, sh, f, t):
        ang = self.amp * math.sin(t * self.fr) * math.exp(-t * 1.2) + 0.6 * math.sin(t * 13)
        M = cv2.getRotationMatrix2D(self.c, ang, 1.0)
        g = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        return f * (1 - self.mask) + g * self.mask

# --- caméra à l'épaule ----------------------------------------------------
def handheld(t, amp, seed, hz=1.0):
    u = t * hz + seed
    return (amp * (0.6 * math.sin(u * 1.7) + 0.4 * math.sin(u * 3.3)), amp * (0.6 * math.sin(u * 1.3 + 1) + 0.4 * math.sin(u * 2.9)),
            amp * 0.03 * math.sin(u * 1.1))

# --- réglages des plans ---------------------------------------------------
# cam : clés (tx, ty, z, k, rot) de début et de fin, interpolées en douceur ; hh = amplitude « à l'épaule » (px).
def shots():
    S = {}
    def add(n, dur, cam, fx, hh=4, hz=1.0, mblur=1):
        S[n] = dict(dur=dur, cam=cam, fx=fx, hh=hh, hz=hz, mblur=mblur)
    # 01 Jusqu'où — montée de grue face aux parois, la brume traverse la vallée
    add(1, 1.4, dict(tx=(0, 0), ty=(70, -70), z=(1.02, 1.05), k=(0.0, 0.04), rot=(0, 0)),
        lambda s: [Mist(s, s.far * box(0, 0.12, 1, 0.8, 200), strength=0.55, speed=(140, -10), cell=300, seed=11),
                   Mist(s, s.far * box(0, 0.3, 1, 0.9, 200), strength=0.35, speed=(-90, 0), cell=180, seed=12, thr=0.5)], hh=3)
    # 02 irais-tu — léger travelling, mèches et cheveux dans le vent
    add(2, 1.4, dict(tx=(-26, 26), ty=(0, -8), z=(1.02, 1.05), k=(0.0, 0.05), rot=(0, 0)),
        lambda s: [Flow(s, np.clip(s.edges * 1.6, 0, 1) * box(0, 0, 1, 0.9, 80), amp=5, speed=(160, 40), cell=40, seed=21, wobble=0.3),
                   Flow(s, s.far, amp=4, speed=(40, 0), cell=200, seed=22)], hh=3)
    # 03 si — on fonce sur la boussole, le cadran oscille et cherche le nord
    add(3, 0.75, dict(tx=(0, 0), ty=(0, -10), z=(1.02, 1.08), k=(0.02, 0.1), rot=(0, 0)),
        lambda s: [Rotate(s, 0.5, 0.663, 0.235, amp=7, freq=11)], hh=6, hz=1.6)
    # 04 rien — on avance sur le sentier, le brouillard dérive, l'herbe frissonne
    add(4, 1.4, dict(tx=(0, 0), ty=(0, 10), z=(1.02, 1.04), k=(0.0, 0.16), rot=(0, 0)),
        lambda s: [Mist(s, box(0, 0, 1, 0.82, 260), strength=0.22, speed=(80, 0), cell=420, seed=41, thr=0.45),
                   Flow(s, box(0, 0.72, 1, 1, 100), amp=3, speed=(120, 0), cell=30, seed=42, wobble=0.4)], hh=2)
    # 05 ne — la frontale bouge sur la carte, la toile frémit
    add(5, 0.75, dict(tx=(10, -10), ty=(6, -6), z=(1.03, 1.08), k=(0.0, 0.06), rot=(0, 0.6)),
        lambda s: [Flicker(s, ellipse(0.62, 0.55, 0.35, 0.18, 120), amp=0.18, rate=1.4),
                   Flow(s, box(0, 0, 1, 0.35, 120), amp=5, speed=(60, 30), cell=120, seed=51, wobble=0.5)], hh=5, hz=1.4)
    # 06 manquait ? — bruine, cheveux au vent, la caméra glisse
    add(6, 3.4, dict(tx=(-30, 30), ty=(10, -10), z=(1.02, 1.07), k=(0.0, 0.05), rot=(-0.4, 0.4)),
        lambda s: [Flow(s, np.clip(s.edges * 1.6, 0, 1), amp=5, speed=(220, 30), cell=36, seed=61, wobble=0.4),
                   Flow(s, s.far * box(0, 0, 1, 0.45, 120), amp=8, speed=(80, 0), cell=220, seed=62),
                   Rain(s, n=700, speed=2200, length=30, angle=18, alpha=0.16, seed=63)], hh=5)
    # 07 bus — la steppe défile derrière la vitre, le bus vibre
    add(7, 1.1, dict(tx=(0, 0), ty=(0, 0), z=(1.02, 1.04), k=(0, 0.02), rot=(0, 0)),
        lambda s: [Scroll(s, soft(np.clip((1 - s.depth * 2.2), 0, 1), 41) * box(0.3, 0.22, 1, 1, 60), speed=(-700, 0), blur=41)], hh=3, hz=3.0)
    # 08 catamaran — le sillage bouillonne, embruns, le bateau tangue
    add(8, 1.1, dict(tx=(0, 0), ty=(0, 0), z=(1.03, 1.06), k=(0, 0.03), rot=(-1.2, 1.0)),
        lambda s: [Flow(s, box(0, 0.52, 1, 0.88, 80) * soft(np.clip(1 - s.depth * 2.4, 0, 1), 21), amp=9, speed=(0, 260), cell=50, seed=81, wobble=0.3),
                   Flow(s, s.far * box(0, 0, 1, 0.42, 120), amp=6, speed=(90, 0), cell=200, seed=82),
                   Spray(s, (0.7, 0.66), n=120, vel=(300, -900), spread=700, grav=2600, size=1.6, alpha=0.5, seed=83, period=0.8)], hh=7, hz=1.3)
    # 09 refuge — la fenêtre vacille, la brume passe dans la forêt
    add(9, 1.1, dict(tx=(-14, 14), ty=(0, -6), z=(1.03, 1.06), k=(0, 0.05), rot=(0, 0)),
        lambda s: [Flicker(s, box(0.3, 0.43, 0.78, 0.65, 40), amp=0.16, rate=1.6),
                   Mist(s, s.far * box(0, 0, 1, 0.45, 160), color=(0.45, 0.52, 0.66), strength=0.35, speed=(60, 0), cell=220, seed=91)], hh=3)
    # 10 source — l'eau coule dans la gourde, gouttes qui sautent
    add(10, 0.75, dict(tx=(-10, 10), ty=(0, 0), z=(1.03, 1.07), k=(0, 0.06), rot=(0, 0)),
        lambda s: [Flow(s, box(0.48, 0.05, 0.85, 0.52, 40), amp=7, speed=(-120, 420), cell=24, seed=101),
                   Spray(s, (0.58, 0.5), n=120, vel=(160, -500), spread=180, grav=2600, size=2, alpha=0.8, seed=102, period=0.5)], hh=4)
    # 11 météo — le nuage lenticulaire évolue, la toile de la tente claque
    add(11, 0.75, dict(tx=(0, 0), ty=(-8, 8), z=(1.03, 1.06), k=(0, 0.05), rot=(0, 0)),
        lambda s: [Flow(s, box(0.15, 0.08, 0.95, 0.42, 100), amp=6, speed=(90, 0), cell=160, seed=111),
                   Flow(s, np.clip(s.depth * 1.4 - 0.3, 0, 1) * box(0, 0, 1, 0.78, 60), amp=7, speed=(120, 60), cell=70, seed=112, wobble=0.6)], hh=4)
    # 12 passeport — les nuages filent derrière le hublot, un rayon traverse la tablette
    add(12, 1.1, dict(tx=(12, -12), ty=(0, 0), z=(1.03, 1.06), k=(0, 0.05), rot=(0, 0)),
        lambda s: [Scroll(s, soft(box(0.45, 0.0, 1.0, 0.3, 30) * (1 - np.clip(s.depth * 2 - 0.6, 0, 1)), 31), speed=(-160, 0), blur=9),
                   Sweep(s, angle=-30, width=0.12, strength=0.22, x0=-0.2, x1=1.2, dur=1.1)], hh=3)
    # 13 sac — plongée qui tourne lentement, la lumière de la fenêtre glisse
    add(13, 0.75, dict(tx=(0, 0), ty=(0, 0), z=(1.04, 1.08), k=(0, 0.02), rot=(-1.6, 1.6)),
        lambda s: [Sweep(s, angle=-35, width=0.18, strength=0.16, x0=0.1, x1=0.6, dur=0.75)], hh=2)
    # 14 tasses — vapeur qui monte, la lampe vacille
    add(14, 0.6, dict(tx=(0, 0), ty=(10, -10), z=(1.04, 1.1), k=(0, 0.06), rot=(0, 0)),
        lambda s: [Steam(s, 0.5, 0.46, width=0.22, height=0.35, strength=0.32, speed=420, seed=141, color=(0.9, 0.88, 0.85)),
                   Flicker(s, ellipse(0.85, 0.28, 0.2, 0.12, 80), amp=0.22, rate=2.0)], hh=5)
    # 15 tente — les étoiles scintillent, la tente respire
    add(15, 0.45, dict(tx=(0, 0), ty=(-6, 6), z=(1.03, 1.06), k=(0, 0.04), rot=(0, 0)),
        lambda s: [Twinkle(s, box(0, 0, 1, 0.65, 40), thr=0.1, amp=1.0), Flicker(s, ellipse(0.39, 0.82, 0.1, 0.04, 60), amp=0.25, rate=2.5)], hh=2)
    # 16 maman — la vapeur du café monte, la lueur de l'écran vacille
    add(16, 0.95, dict(tx=(0, 0), ty=(0, -6), z=(1.03, 1.06), k=(0, 0.04), rot=(0, 0)),
        lambda s: [Steam(s, 0.3, 0.86, width=0.14, height=0.3, strength=0.45, speed=260, seed=161),
                   Flicker(s, ellipse(0.5, 0.5, 0.2, 0.12, 120), amp=0.08, rate=1.2, warm=(0.9, 0.95, 1.0))], hh=3)
    # 17 guanaco — la laine ondule, la steppe glisse derrière
    add(17, 0.45, dict(tx=(-24, 24), ty=(0, 0), z=(1.03, 1.06), k=(0, 0.05), rot=(0, 0)),
        lambda s: [Flow(s, np.clip(s.edges * 1.8, 0, 1), amp=4, speed=(240, 0), cell=24, seed=171, wobble=0.5)], hh=4)
    # 18 condor — on file le long de la falaise (fort décalage de profondeur), la brume passe
    add(18, 0.45, dict(tx=(60, -60), ty=(40, -30), z=(1.04, 1.07), k=(0, 0.06), rot=(-1.0, 1.0)),
        lambda s: [Mist(s, s.far * box(0, 0, 1, 0.5, 160), strength=0.3, speed=(240, 0), cell=200, seed=181)], hh=5)
    # 19 Torres — on s'élève derrière eux, le lac fume, la lumière rose gagne les sommets
    add(19, 1.4, dict(tx=(0, 0), ty=(60, -40), z=(1.02, 1.06), k=(0.02, 0.08), rot=(0, 0)),
        lambda s: [Mist(s, box(0, 0.4, 1, 0.75, 200) * s.far, strength=0.38, speed=(80, -6), cell=300, seed=191, thr=0.45),
                   Mist(s, box(0, 0.05, 1, 0.45, 200) * s.far, strength=0.3, speed=(-50, 0), cell=300, seed=192, thr=0.45),
                   Glow(s, soft(cv2.dilate(np.clip((s.img[..., 0] - s.img[..., 2] - 0.03) * 10, 0, 1), np.ones((25, 25), np.uint8)), 51) * box(0, 0, 1, 0.32, 40), start=0.0, end=0.45, dur=1.4)], hh=3)
    return S

def render(n, spec):
    sh = Shot(n); fx = spec['fx'](sh); cam = spec['cam']
    nf = int(round(spec['dur'] * FPS))
    path = os.path.join(OUT, f'{n:02d}.mp4')
    ff = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OW}x{OH}',
                           '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
                           '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', path],
                          stdin=subprocess.PIPE)
    for i in range(nf):
        t = i / FPS; u = ease(t / spec['dur'])
        f = sh.img
        for e in fx: f = e(sh, f, t)
        p = {k: lerp(v[0], v[1], u) for k, v in cam.items()}
        gx, gy, gr = handheld(t, spec['hh'], n * 1.7, spec['hz'])
        f, _, _ = sh.warp(f, p['tx'], p['ty'], p['z'], p['k'], p['rot'] + gr, gx, gy)
        o = (np.clip(f[oy:oy + OH, ox:ox + OW], 0, 1) * 255 + 0.5).astype(np.uint8)
        ff.stdin.write(o.tobytes())
    ff.stdin.close(); ff.wait()
    print(f'{n:02d} {nf} images -> {os.path.relpath(path, ROOT)}', flush=True)

if __name__ == '__main__':
    S = shots(); only = [int(a) for a in sys.argv[1:]] or sorted(S)
    for n in only: render(n, S[n])
