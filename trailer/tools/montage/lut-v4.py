#!/usr/bin/env python3
"""LUT commune de l'ours v4 (look « film doux ») : montage/luts/lkdv-v4.cube.

    python3 tools/montage/lut-v4.py [--verifier]

Ne pas éditer le .cube à la main : il est la sortie exacte de ce script (--verifier compare le fichier versionné
à une nouvelle génération et sort en erreur s'ils diffèrent). Valeurs codées sRGB/Rec.709 (pas de linéarisation),
grille 33³, appliquée par ffmpeg lut3d (interpolation tétraédrique) dans tools/montage/etalonnage.mjs.

Ce que fait la LUT, dans l'ordre :
  1. Courbe de film par canal (spline monotone) : pied doux qui relève le noir à ≈ 11/255, milieu à peine plus
     contrasté, épaule qui roule les hautes lumières jusqu'à ≈ 245/255 (rien ne claque au blanc pur).
  2. Saturation tenue : légère baisse globale, puis compression douce (genou) des chromas forts, pour que les
     mélèzes, le feu et le turquoise restent francs sans devenir fluo ; les peaux (chroma faible) ne bougent pas.
  3. Noirs encre : les ombres presque neutres glissent vers la teinte de l'encre #0B1F17 (multiplicatif, donc
     proportionnel à la luminance) ; les ombres colorées (ciel de nuit bleu, braises) sont protégées.
  4. Hautes lumières crème : les blancs presque neutres tirent vers #FAF8F5, un peu plus chaud que le papier.
Aucune étape ne tourne les teintes : un orangé reste où il est (rien n'est poussé vers #E4501C).
"""
import os, sys
import numpy as np

TRAILER = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(TRAILER, "montage", "luts", "lkdv-v4.cube")
N = 33

PARAMS = {
    # courbe (entrée → sortie), valeurs codées 0–1
    "courbe": [(0.0, 0.040), (0.05, 0.068), (0.15, 0.150), (0.30, 0.292), (0.50, 0.505), (0.70, 0.712),
               (0.85, 0.846), (0.95, 0.920), (1.0, 0.952)],
    "saturation": 0.96,          # facteur global sur la chrominance
    "genou": 0.20,               # chroma (norme de R'G'B' − Y') au-delà de laquelle on comprime
    "plafond": 0.50,             # asymptote de la compression
    "encre": (0x0B / 255, 0x1F / 255, 0x17 / 255),
    "encre_force": 0.42,         # part de la teinte d'encre au noir (0 = neutre, 1 = rapport de l'encre)
    "encre_fin": 0.24,           # luminance où la teinte d'encre a disparu
    "creme": (1.0, 0.988, 0.962),  # rapport des canaux visé pour le blanc (crème chaude, #FAF8F5 ≈ 1, 0,992, 0,980)
    "creme_debut": 0.62,         # luminance où la crème commence
    "creme_force": 0.85,
}
KR, KG, KB = 0.2126, 0.7152, 0.0722


def pchip(xs, ys):
    """Spline cubique monotone (Fritsch–Carlson) : renvoie une fonction vectorisée."""
    xs, ys = np.asarray(xs, float), np.asarray(ys, float)
    h = np.diff(xs)
    d = np.diff(ys) / h
    m = np.zeros_like(ys)
    m[0], m[-1] = d[0], d[-1]
    for k in range(1, len(xs) - 1):
        if d[k - 1] * d[k] <= 0:
            m[k] = 0
        else:
            w1, w2 = 2 * h[k] + h[k - 1], h[k] + 2 * h[k - 1]
            m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k])

    def f(x):
        x = np.clip(x, xs[0], xs[-1])
        k = np.clip(np.searchsorted(xs, x, side="right") - 1, 0, len(xs) - 2)
        t = (x - xs[k]) / h[k]
        h00, h10, h01, h11 = 2 * t**3 - 3 * t**2 + 1, t**3 - 2 * t**2 + t, -2 * t**3 + 3 * t**2, t**3 - t**2
        return h00 * ys[k] + h10 * h[k] * m[k] + h01 * ys[k + 1] + h11 * h[k] * m[k + 1]
    return f


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def look(rgb, P=PARAMS):
    rgb = np.asarray(rgb, float)
    # 1. courbe par canal
    c = pchip(*zip(*P["courbe"]))(rgb)
    # 2. saturation tenue
    y = c @ np.array([KR, KG, KB])
    ch = c - y[..., None]
    m = np.sqrt((ch**2).sum(-1))
    k, L = P["genou"], P["plafond"]
    mc = np.where(m > k, k + (L - k) * np.tanh((m - k) / (L - k)), m)
    scale = np.where(m > 1e-9, mc / np.maximum(m, 1e-9), 1.0) * P["saturation"]
    c = y[..., None] + ch * scale[..., None]
    m = m * scale
    # 3. noirs encre (ombres presque neutres seulement)
    ink = np.array(P["encre"])
    ratio = ink / (ink @ np.array([KR, KG, KB]))
    rel = m / (y + 0.03)
    w = (1 - smooth(0.0, P["encre_fin"], y)) * (1 - smooth(0.10, 0.40, rel)) * P["encre_force"]
    c = c * (1 + w[..., None] * (ratio - 1))
    # 4. hautes lumières crème (blancs presque neutres)
    y = c @ np.array([KR, KG, KB])
    wh = smooth(P["creme_debut"], 1.0, y) * (1 - smooth(0.06, 0.22, m)) * P["creme_force"]
    cream = np.array(P["creme"]) / (np.array(P["creme"]) @ np.array([KR, KG, KB]))
    c = c * (1 + wh[..., None] * (cream - 1))
    return np.clip(c, 0, 1)


def cube_text():
    g = np.linspace(0, 1, N)
    # ordre .cube : R varie le plus vite, puis G, puis B
    b, gg, r = np.meshgrid(g, g, g, indexing="ij")
    out = look(np.stack([r, gg, b], -1).reshape(-1, 3))
    lines = ['TITLE "LKDV ours v4 - look commun"',
             "# Genere par trailer/tools/montage/lut-v4.py - ne pas editer a la main.",
             "# Courbe de film douce, noirs encre #0B1F17, blancs creme, saturation tenue (genou), teintes inchangees.",
             f"LUT_3D_SIZE {N}", "DOMAIN_MIN 0.0 0.0 0.0", "DOMAIN_MAX 1.0 1.0 1.0"]
    lines += [f"{v[0]:.6f} {v[1]:.6f} {v[2]:.6f}" for v in out]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    txt = cube_text()
    if "--verifier" in sys.argv:
        ok = os.path.exists(OUT) and open(OUT).read() == txt
        print("lkdv-v4.cube conforme au script" if ok else "lkdv-v4.cube DIFFÉRENT du script")
        sys.exit(0 if ok else 1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w").write(txt)
    probe = {"noir": (0, 0, 0), "blanc": (1, 1, 1), "gris 18 %": (0.46, 0.46, 0.46), "peau": (0.85, 0.62, 0.50),
             "orange feu": (1.0, 0.55, 0.15), "#E4501C": (0xE4 / 255, 0x50 / 255, 0x1C / 255),
             "turquoise": (0.25, 0.75, 0.78), "nuit bleue": (0.05, 0.08, 0.14), "ombre neutre": (0.08, 0.08, 0.08)}
    for k, v in probe.items():
        o = look(np.array(v))
        print(f"{k:12s} {'#%02X%02X%02X' % tuple(int(round(x * 255)) for x in v)} → {'#%02X%02X%02X' % tuple(int(round(x * 255)) for x in o)}")
    print("→", os.path.relpath(OUT, TRAILER))
