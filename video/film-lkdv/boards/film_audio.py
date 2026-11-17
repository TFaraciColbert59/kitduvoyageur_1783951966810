"""Bande-son du film « Le W » : musique + bruitages, calés sur boards/frames.py.

audio_clips(FRAMES, LEAD) renvoie les balises <audio> que build_film.py pose dans index.html.
Passe 2 (17/11, frames.py v5 + montage « mouvement 2 ») : instants tirés des tweens de build_film.py.
128 BPM : 1 temps = 0,46875 s, 1 mesure = 1,875 s. Fichiers : assets/audio/.

Mesures faites sur les fichiers (ffmpeg, enveloppes RMS 2-20 ms, flux spectral) le 17/11/2026 :
- ambient-uplift.mp3 : grille des temps du fichier = k × 0,46875 s (écart médian des attaques
  −4 ms) ; le lift (entrée de la grosse caisse, bande < 150 Hz de −33 à −11 dB) est à 26,25 s,
  sur la mesure 14 du fichier. Lecture à partir de 15,000 s (= 32 temps) : le lift tombe à 11,25 s
  du film et chaque temps de la piste tombe sur un temps du film (15,015 décalait de 15 ms).
- Attaques (silence de tête, seuil −30 dB sous la crête) : click-soft 0,04 · key-press 0,07 ·
  pop 0,11 · whoosh-short 0,07 (crête 0,16) · typing 0,43 · impact 0,05 (crête 0,14) ·
  whoosh-cinematic : souffle de 1,5 s, crête 2,44-2,90 s, fin 4,35 s · riser : monte de 1,2 s
  (−42 dB) à 3,0 s et s'arrête net à 4,155 s (c'est cette coupure qui doit tomber sur le plan 23).
- sfx-whoosh.mp3 et sfx-whoosh-short.mp3 sont le même fichier (même md5) : une seule prise.
"""
BAR = 1.875
BEAT = BAR / 4
END = 60.0
FRAME = 1 / 30

MUSIC_IN = 15.0          # position dans la piste lue à t = 0 du film (lift fichier 26,25 → film 11,25)
SILENCE = BAR / 2        # demi-mesure de silence avant le plan 16
# Gain commun : les volumes ci-dessous sont relatifs (musique 0,8) ; ce facteur ramène le mixage
# de contrôle vers −14 LUFS et sa crête vraie sous −1 dBTP avant normalisation.
MIX_GAIN = 0.62

# Durées décodées (la plus courte entre ffprobe et le décodage réel) : un clip ne les dépasse jamais.
FILE_LEN = {
    "ambient-uplift.mp3": 183.82,
    "sfx-click-soft.mp3": 0.365,
    "sfx-pop.mp3": 0.72,
    "sfx-typing.mp3": 1.50,
    "sfx-key-press.mp3": 0.40,
    "sfx-whoosh.mp3": 0.574,
    "sfx-whoosh-short.mp3": 0.574,
    "sfx-whoosh-cinematic.mp3": 5.544,
    "sfx-riser.mp3": 10.032,
    "sfx-impact-bass-1.mp3": 2.115,
}
# Instant de l'attaque dans le fichier (s) et fin utile du son.
ONSET = {"sfx-click-soft.mp3": 0.04, "sfx-key-press.mp3": 0.07, "sfx-pop.mp3": 0.11,
         "sfx-whoosh-short.mp3": 0.16, "sfx-typing.mp3": 0.43, "sfx-impact-bass-1.mp3": 0.05}
# Pré-roll gardé avant l'attaque (le whoosh garde sa montée : sa crête, 0,16 s, sert de repère).
PRE = {"sfx-whoosh-short.mp3": 0.12}
TAIL = {"sfx-click-soft.mp3": 0.25, "sfx-key-press.mp3": 0.25, "sfx-pop.mp3": 0.45,
        "sfx-whoosh-short.mp3": 0.45, "sfx-typing.mp3": 1.50, "sfx-impact-bass-1.mp3": 2.115}

MUSIC_TRACK = 20
SFX_TRACKS = (21, 22, 23, 24)


def clip_list(FRAMES, LEAD):
    """Liste de dicts (id, src, start, dur, vol, mstart, fin, fout, track), triée par temps.

    Les instants viennent des tweens de build_film.py (passe mouvement 2), comptés depuis la barre
    de chaque plan ; LEAD n'est plus utilisé (le son ne dépend que des barres)."""
    f = {fr["n"]: fr for fr in FRAMES}
    s = {n: fr["start"] for n, fr in f.items()}          # barre du plan
    cap = 0.80                                            # légende sonore (build_film CAP_AT) ; le son suit d'une image
    clips = []

    def add(cid, src, start, dur, vol, mstart=0.0, fin=None, fout=None, role=None):
        dur = min(dur, FILE_LEN[src] - mstart)
        clips.append(dict(id=cid, src=src, start=round(start, 3), dur=round(dur, 3), vol=vol,
                          mstart=round(mstart, 3), fin=fin, fout=fout, role=role, vol_rel=vol))
        clips[-1]["vol"] = round(vol * MIX_GAIN, 3)

    def hit(cid, src, at, vol, fout=None, dur=None, late=FRAME):
        """Attaque du son à at + late (par défaut une image : la lumière arrive avant le son)."""
        on = ONSET[src]
        ms = max(0.0, on - PRE.get(src, 0.01))
        start = at + late - (on - ms)
        length = (TAIL[src] - ms) if dur is None else dur
        add(cid, src, start, length, vol, ms, fout=fout)

    def whip(cid, bar, vol):
        """Fouet : le plan entrant traverse le cadre de barre − 0,3 à barre + 0,04 (power3.inOut),
        le sortant part de barre − 0,3 (power3.in) : la crête du whoosh (0,16 s) tombe à barre − 0,1."""
        hit(cid, "sfx-whoosh-short.mp3", bar - 0.1, vol, late=0.0)

    # ---------------------------------------------------------------- musique
    cut = s[16] - SILENCE                                # 32,8125 : la musique s'arrête (fondu court)
    add("music", "ambient-uplift.mp3", 0.0, cut, 0.8, MUSIC_IN, fin=0.3, fout=0.25, role="music")
    # Reprise PLEINE sur la barre du plan 16, à la même position de piste que sans la coupure.
    add("music2", "ambient-uplift.mp3", s[16], END - s[16], 0.8, MUSIC_IN + s[16], fin=0.03, fout=1.8, role="music")

    # ---------------------------------------------------------------- bruitages (un par action visible)
    # 01 · le fil défile (SEQ « scroll » à 1,9 et 2,35 s) : un tic par écran qui monte
    hit("t-scroll1-a", "sfx-key-press.mp3", s[1] + 1.90, 1.6)
    hit("t-scroll1-b", "sfx-key-press.mp3", s[1] + 2.35, 1.4)
    # 02 · le pouce s'enfonce à barre + 1,525 (5,275 s)
    hit("t-tap2", "sfx-click-soft.mp3", s[2] + BAR - 0.35, 0.9)
    # 02 → 03 · la carte touchée devient le monde (clip-path 0,45 s depuis barre − 0,35, power3.inOut) :
    # souffle doux, tranche du whoosh cinématique (crête 2,44 s du fichier à barre − 0,1)
    add("t-grow3", "sfx-whoosh-cinematic.mp3", s[3] - 0.1 - (2.44 - 2.15), 3.0 - 2.15, 0.22, 2.15, fin=0.06, fout=0.35)
    # 04 · « Envoyé à Camille » : la légende se pose (barre + 0,80)
    hit("t-send4", "sfx-pop.mp3", s[4] + cap, 0.4)
    # 05 · frappe de la phrase (de + 0,05 ; le fichier n'a que 1,07 s de frappe), clic sur la flèche à + 1,62
    add("t-typing5", "sfx-typing.mp3", s[5] + 0.05 + FRAME, 1.50 - 0.40, 1.4, 0.40, fout=0.08)
    hit("t-click5", "sfx-click-soft.mp3", s[5] + 1.62, 1.0)
    # 05 → 06 · l'iris part du clic (10,995 s) et s'ouvre jusqu'à la barre (11,25) : la crête du souffle
    # (fichier 2,44 s) tombe une image après l'ouverture complète
    t_iris = s[5] + 1.62
    m_iris = 2.44 - (s[6] + FRAME - t_iris)
    add("t-iris6", "sfx-whoosh-cinematic.mp3", t_iris, 4.35 - m_iris, 0.5, m_iris, fin=0.05, fout=0.4)
    # 06 · « Je lis ta phrase » (+ 0,47) puis le voyage prêt (+ 1,17)
    for k, at in enumerate((0.47, 1.17)):
        hit(f"t-pop6-{k}", "sfx-pop.mp3", s[6] + at, 0.30 if k else 0.24)
    # 07 · trois anneaux posés sur les refuges aux temps 2, 3, 4 de la 1re mesure (rien sur le jour 2 : raccord)
    for k in range(3):
        hit(f"t-pop7-{k}", "sfx-pop.mp3", s[7] + (k + 1) * BEAT, (0.45, 0.5, 0.55)[k])
    # 08 · « 1 objet vital manque » : tic sur la légende
    hit("t-tick8", "sfx-key-press.mp3", s[8] + cap, 1.8)
    # 09 · « 1 398 € par personne » : clic sur la légende
    hit("t-click9", "sfx-click-soft.mp3", s[9] + cap, 1.1)
    # 09 → 10 · fouet horizontal (temps fort 1)
    whip("t-whip10", s[10], 0.3)
    # 10 · le doigt s'enfonce sur chaque temps de la 2e mesure (+ 0,04) : 60 L, 80 L, Sauge, Pierre
    for k in range(4):
        hit(f"t-click10-{k}", "sfx-click-soft.mp3", s[10] + BAR + k * BEAT + 0.04, (1.3, 1.15, 1.2, 1.1)[k], late=0.0)
    # 11 pluie, 12 bip, 13 crépitement : aucun fichier dans assets/audio (et pas de son synthétisé) → rien.
    # 11 → 12 · fouet horizontal vers le suivi en direct
    whip("t-whip12", s[12], 0.24)
    # 14 · les médias arrivent sur le même téléphone (barre + 0,05)
    hit("t-pop14", "sfx-pop.mp3", s[14] + 0.05, 0.45)
    # 15 · « Prochains départs » : clic sur la légende, coupé avant la demi-mesure de silence
    at15 = s[15] + cap
    hit("t-click15", "sfx-click-soft.mp3", at15, 0.6, fout=0.03,
        dur=min(TAIL["sfx-click-soft.mp3"] - 0.03, cut - 0.005 - (at15 + FRAME - 0.01)))
    # 17 · tap sur « Explorateurs du Japon » à barre + 1,525 (40,9 s)
    hit("t-tap17", "sfx-click-soft.mp3", s[17] + BAR - 0.35, 1.2)
    # 17 → 18 · fouet vertical : la trace part dans la messagerie (son de message)
    whip("t-whip18", s[18], 0.3)
    # 19 · « sur-mesure » se pose à barre + 0,80 (em_at du montage) : pop
    hit("t-pop19", "sfx-pop.mp3", s[19] + 0.80, 0.5)
    # 20 · « 2,0 kg · 541 € » : clic sur la légende
    hit("t-click20", "sfx-click-soft.mp3", s[20] + cap, 1.1)
    # 21 · l'empreinte : notification = pop sur la légende
    hit("t-pop21", "sfx-pop.mp3", s[21] + cap, 0.45)
    # 22 · montée : le riser part quand le téléphone Japon monte (barre + 2 mesures − 0,15 = 52,35 s)
    # et se coupe net (fichier 4,155 s) pile sur la coupe franche vers le plan 23
    r_cut = 4.155
    r_start = s[22] + 2 * BAR - 0.15
    add("t-riser", "sfx-riser.mp3", r_start, s[23] - r_start + 0.03, 0.4, r_cut - (s[23] - r_start), fin=0.2, fout=0.03)
    # 23 · impact : attaque exactement quand le badge se cale (barre + 0,2 = 54,575 s)
    hit("t-impact", "sfx-impact-bass-1.mp3", s[23] + 0.2, 0.4, fout=0.5, late=0.0)

    clips.sort(key=lambda c: (c["start"], c["id"]))
    # Pistes Studio : musique seule sur 20 ; chaque bruitage sur la plus basse piste 21-24 libre.
    busy = {t: [] for t in SFX_TRACKS}
    for c in clips:
        if c["role"] == "music":
            c["track"] = MUSIC_TRACK
            continue
        for t in SFX_TRACKS:
            if all(c["start"] >= e - 1e-6 or c["start"] + c["dur"] <= b + 1e-6 for b, e in busy[t]):
                busy[t].append((c["start"], c["start"] + c["dur"]))
                c["track"] = t
                break
        else:
            raise ValueError(f"plus de piste libre pour {c['id']}")
    return clips


def audio_clips(FRAMES, LEAD):
    out = []
    for c in clip_list(FRAMES, LEAD):
        extra = f' data-media-start="{c["mstart"]:.3f}"' if c["mstart"] else ""
        if c["role"]:
            extra += f' data-timeline-role="{c["role"]}"'
        if c["fin"]:
            extra += f' data-fade-in="{c["fin"]}"'
        if c["fout"]:
            extra += f' data-fade-out="{c["fout"]}"'
        out.append(f'      <audio id="{c["id"]}" class="clip" src="assets/audio/{c["src"]}" data-start="{c["start"]:.3f}" '
                   f'data-duration="{c["dur"]:.3f}"{extra} data-track-index="{c["track"]}" data-volume="{c["vol"]}"></audio>')
    return out


if __name__ == "__main__":
    import os
    import subprocess
    import sys

    HERE = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, HERE)
    from frames import FRAMES  # noqa: E402
    LEAD = {6: 0.35}
    AUDIO = os.path.join(HERE, "..", "assets", "audio")

    clips = clip_list(FRAMES, LEAD)
    print(f"{'id':16s} {'fichier':26s} {'début':>8s} {'durée':>7s} {'m-start':>8s} {'vol':>5s} piste")
    for c in clips:
        print(f"{c['id']:16s} {c['src']:26s} {c['start']:8.3f} {c['dur']:7.3f} {c['mstart']:8.3f} {c['vol']:5} {c['track']}")

    real = {}
    for src in {c["src"] for c in clips}:
        p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                            os.path.join(AUDIO, src)], capture_output=True, text=True, check=True)
        real[src] = float(p.stdout.strip())
    ids = [c["id"] for c in clips]
    assert len(ids) == len(set(ids)), "ids en double"
    for c in clips:
        assert c["dur"] > 0, c["id"]
        assert c["mstart"] + c["dur"] <= real[c["src"]] + 1e-6, f"{c['id']} dépasse son fichier ({real[c['src']]:.3f} s)"
        assert c["mstart"] + c["dur"] <= FILE_LEN[c["src"]] + 1e-6, f"{c['id']} dépasse la durée décodée"
        assert c["start"] >= 0 and c["start"] + c["dur"] <= END + 1e-6, f"{c['id']} sort du film"
    for t in {c["track"] for c in clips}:
        on = sorted((c["start"], c["start"] + c["dur"], c["id"]) for c in clips if c["track"] == t)
        for (b1, e1, i1), (b2, e2, i2) in zip(on, on[1:]):
            assert b2 >= e1 - 1e-6, f"chevauchement piste {t} : {i1} / {i2}"
    m1, m2 = clips[0], next(c for c in clips if c["id"] == "music2")
    assert abs((m2["mstart"] - m2["start"]) - (m1["mstart"] - m1["start"])) < 1e-6, "reprise hors phase"
    assert abs(m2["start"] + m2["dur"] - END) < 1e-6, "la musique doit finir à 60 s"
    silent = (m1["start"] + m1["dur"], m2["start"])
    for c in clips:
        if c["role"] != "music":
            assert c["start"] + c["dur"] <= silent[0] + 1e-6 or c["start"] >= silent[1] - 1e-6, f"{c['id']} dans le silence"
    print(f"\n{len(clips)} clips · contrôles OK · silence {silent[0]:.4f} → {silent[1]:.4f} s")
