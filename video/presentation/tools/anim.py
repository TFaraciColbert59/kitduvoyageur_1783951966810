# Moteur d'animation des plans de « Pas pour moi » (repris de « Jusqu'où ») : chaque image fixe devient un plan vivant.
#  1. Caméra 2.5D : la carte de profondeur (assets/depth) décale chaque pixel selon sa distance
#     (travelling, montée, poussée, caméra à l'épaule) : l'avant-plan glisse plus vite que le fond.
#  2. Effets : brume qui dérive, eau qui coule, vent sur les contours, étoiles, lumières qui vacillent, vapeur, lueur de l'aube.
# Les horaires viennent de tools/montage.py (piste de fond). Déterministe. Sortie : assets/shots/<id>.mp4, 1080×1920, 30 i/s.
# Usage : python tools/anim.py [id ...]   (sans argument : tous les plans dont l'image est arrivée)
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

# --- caméra à l'épaule ----------------------------------------------------
def handheld(t, amp, seed, hz=1.0):
    u = t * hz + seed
    return (amp * (0.6 * math.sin(u * 1.7) + 0.4 * math.sin(u * 3.3)), amp * (0.6 * math.sin(u * 1.3 + 1) + 0.4 * math.sin(u * 2.9)),
            amp * 0.03 * math.sin(u * 1.1))

# --- réglages des plans ---------------------------------------------------
# cam : (début, fin) de tx, ty (px de décalage à profondeur 1), z (zoom), k (zoom lié à la profondeur), rot (degrés).
def C(tx=(0, 0), ty=(0, 0), z=(1.02, 1.05), k=(0.0, 0.05), rot=(0, 0)): return dict(tx=tx, ty=ty, z=z, k=k, rot=rot)
def far_mist(s, y0=0.0, y1=0.6, st=0.3, sp=(70, 0), seed=1): return Mist(s, s.far * box(0, y0, 1, y1, 200), strength=st, speed=sp, cell=280, seed=seed, thr=0.45)
def wind(s, amp=4, seed=2, sp=(160, 30)): return Flow(s, np.clip(s.edges * 1.6, 0, 1), amp=amp, speed=sp, cell=40, seed=seed, wobble=0.3)
def pink(s, y1=0.4, end=0.4, dur=6.0):
    m = soft(cv2.dilate(np.clip((s.img[..., 0] - s.img[..., 2] + 0.02) * 8, 0, 1) * (s.img.mean(-1) > 0.45), np.ones((25, 25), np.uint8)), 51)
    return Glow(s, m * box(0, 0, 1, y1, 40), start=0.0, end=end, dur=dur)

CAMFX = {
    # 01 nuit : la frontale vacille, on suit Julien qui monte ; étoiles
    'a01': (C(ty=(40, -30), z=(1.02, 1.07), k=(0.0, 0.08)), lambda s: [Flicker(s, ellipse(0.45, 0.45, 0.3, 0.25, 120), amp=0.16, rate=1.6), Twinkle(s, box(0, 0, 1, 0.3, 40), thr=0.08), wind(s, 3, 11)], 4, 1.2),
    'j01': (C(tx=(-30, 30), ty=(0, -20), z=(1.04, 1.08), k=(0.02, 0.1)), lambda s: [Flicker(s, ellipse(0.45, 0.45, 0.3, 0.25, 120), amp=0.2, rate=1.8), Twinkle(s, box(0, 0, 1, 0.3, 40), thr=0.08), wind(s, 3, 12)], 5, 1.3),
    # 02 l'aube : grue lente, brume sur le lac, le rose gagne les sommets
    'a02': (C(ty=(60, -40), z=(1.02, 1.06), k=(0.02, 0.07)), lambda s: [far_mist(s, 0.35, 0.62, 0.3, (50, -4), 21), pink(s, 0.42, 0.45, 7.7), Flow(s, box(0, 0.5, 1, 0.8, 80), amp=3, speed=(30, 0), cell=120, seed=22)], 3, 0.8),
    'j02': (C(z=(1.0, 1.08), k=(0.02, 0.1)), lambda s: [far_mist(s, 0.35, 0.62, 0.35, (60, -4), 23), pink(s, 0.42, 0.6, 6.5), Flow(s, box(0, 0.5, 1, 0.8, 80), amp=3, speed=(30, 0), cell=120, seed=24)], 2, 0.7),
    # 03 dimanche : caméra qui marche avec lui, herbe et feuilles au vent
    'b03': (C(tx=(-20, 20), z=(1.02, 1.05), k=(0.0, 0.06)), lambda s: [wind(s, 4, 31), Flow(s, box(0, 0.7, 1, 1, 100), amp=3, speed=(120, 0), cell=30, seed=32, wobble=0.4)], 6, 1.6),
    # 04 la montre : macro, légère respiration
    'b04': (C(z=(1.03, 1.08), k=(0.0, 0.04), rot=(-0.6, 0.6)), lambda s: [Sweep(s, angle=-30, width=0.18, strength=0.12, x0=-0.2, x1=1.2, dur=5.7)], 3, 0.8),
    # 05 premier belvédère : vent dans l'herbe, brume lointaine
    'b05': (C(tx=(-30, 10), z=(1.02, 1.05), k=(0.0, 0.07)), lambda s: [wind(s, 4, 51), far_mist(s, 0.2, 0.55, 0.25, (60, 0), 52)], 3, 1.0),
    # 06 le canapé : la lueur de l'écran vacille sur son visage, la lampe
    'c06': (C(ty=(0, -10), z=(1.03, 1.08), k=(0.0, 0.05)), lambda s: [Flicker(s, ellipse(0.5, 0.62, 0.35, 0.25, 140), amp=0.1, rate=1.1, warm=(0.9, 0.95, 1.0)), Flicker(s, ellipse(0.85, 0.38, 0.15, 0.1, 80), amp=0.08, rate=0.8)], 2, 0.8),
    # 07 le lac et le kayak : brume qui glisse sous les falaises, l'eau ondule
    'c07': (C(tx=(20, -20), z=(1.02, 1.05), k=(0.0, 0.05)), lambda s: [far_mist(s, 0.15, 0.5, 0.35, (60, 0), 71), Flow(s, box(0, 0.5, 1, 1, 80), amp=3, speed=(40, 0), cell=90, seed=72)], 2, 0.7),
    'c07b': (C(z=(1.08, 1.16), k=(0.02, 0.08)), lambda s: [far_mist(s, 0.15, 0.5, 0.3, (70, 0), 73), Flow(s, box(0, 0.5, 1, 1, 80), amp=3, speed=(40, 0), cell=90, seed=74)], 2, 0.7),
    # 17 via ferrata : le vide, la vallée qui respire en contrebas
    'j17': (C(tx=(20, -20), ty=(20, -10), z=(1.03, 1.07), k=(0.02, 0.1), rot=(0.8, -0.6)), lambda s: [far_mist(s, 0.3, 0.9, 0.25, (80, 0), 171), wind(s, 3, 172)], 5, 1.4),
    # 18 le visage contre la paroi : souffle, très léger
    'j18': (C(z=(1.04, 1.09), k=(0.0, 0.05)), lambda s: [wind(s, 3, 181)], 3, 1.1),
    # 19 le groupe dans la nuit bleue : frontales et étoiles
    'j19': (C(ty=(30, -30), z=(1.02, 1.06), k=(0.0, 0.07)), lambda s: [Twinkle(s, box(0, 0, 1, 0.35, 40), thr=0.08), Flicker(s, box(0, 0.3, 1, 0.9, 120), amp=0.1, rate=1.7), far_mist(s, 0.2, 0.6, 0.2, (50, 0), 191)], 3, 1.0),
    # 20 la mère : la lueur du téléphone vacille sur son visage
    'j20': (C(z=(1.03, 1.08), k=(0.0, 0.05)), lambda s: [Flicker(s, ellipse(0.5, 0.5, 0.4, 0.3, 140), amp=0.1, rate=1.0, warm=(0.92, 0.96, 1.0))], 2, 0.7),
    # 21 marmotte, 22 fleur : vent dans le pelage, dans l'herbe
    'k21': (C(tx=(-10, 10), z=(1.03, 1.07), k=(0.0, 0.05)), lambda s: [wind(s, 4, 211), far_mist(s, 0.0, 0.4, 0.2, (60, 0), 212)], 3, 1.2),
    'k22': (C(z=(1.03, 1.08), k=(0.0, 0.06)), lambda s: [wind(s, 3, 221), Sweep(s, angle=-30, width=0.2, strength=0.12, x0=-0.2, x1=1.2, dur=2.6)], 3, 0.9),
    # 23 le baudrier rendu, 24 le retour : lumière chaude
    'm23': (C(tx=(-15, 15), z=(1.02, 1.05), k=(0.0, 0.05)), lambda s: [wind(s, 2, 231)], 3, 1.0),
    'm24': (C(z=(1.02, 1.07), k=(0.0, 0.05)), lambda s: [Flicker(s, box(0, 0, 1, 1, 200), amp=0.05, rate=0.6)], 2, 0.7),
    # 25 l'inconnue : lumières de la ville qui défilent sur la vitre, l'écran éclaire son visage
    'n25': (C(z=(1.02, 1.08), k=(0.0, 0.06)), lambda s: [Flicker(s, ellipse(0.5, 0.55, 0.4, 0.3, 140), amp=0.1, rate=1.2, warm=(0.92, 0.96, 1.0)), Sweep(s, angle=-20, width=0.12, strength=0.14, x0=1.3, x1=-0.4, dur=4.0)], 3, 0.8),
}
DEFAULT = (C(tx=(-16, 16), ty=(10, -10), z=(1.02, 1.06), k=(0.0, 0.06)), lambda s: [far_mist(s, 0.0, 0.5, 0.22, (60, 0), 99), wind(s, 3, 98)], 3, 1.0)

def render(sid, img, dur):
    cam, fxf, hh, hz = CAMFX.get(sid, DEFAULT)
    sh = Shot(img); fx = fxf(sh)
    nf = int(round(dur * FPS))
    path = os.path.join(OUT, f'{sid}.mp4')
    ff = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OW}x{OH}',
                           '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
                           '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', path],
                          stdin=subprocess.PIPE)
    for i in range(nf):
        t = i / FPS; u = ease(t / dur)
        f = sh.img
        for e in fx: f = e(sh, f, t)
        p = {k: lerp(v[0], v[1], u) for k, v in cam.items()}
        gx, gy, gr = handheld(t, hh, img * 1.7 + len(sid), hz)
        f, _, _ = sh.warp(f, p['tx'], p['ty'], p['z'], p['k'], p['rot'] + gr, gx, gy)
        o = (np.clip(f[oy:oy + OH, ox:ox + OW], 0, 1) * 255 + 0.5).astype(np.uint8)
        ff.stdin.write(o.tobytes())
    ff.stdin.close(); ff.wait()
    print(f'{sid} ({img:02d}) {nf} images', flush=True)

if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from montage import BG, XF
    want = set(sys.argv[1:])
    for kind, sid, img, t0, t1 in BG:
        if kind != 'plan' or (want and sid not in want): continue
        if os.path.exists(os.path.join(PREP, f'{img:02d}.jpg.attente')) or not os.path.exists(os.path.join(DEP, f'{img:02d}.png')):
            print(f'{sid} ({img:02d}) image absente'); continue
        if not want and os.path.exists(os.path.join(OUT, f'{sid}.mp4')): continue
        render(sid, img, round(t1 - t0 + XF, 3))
