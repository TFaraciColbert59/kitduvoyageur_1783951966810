"""Bande-son du film « Le W » : musique + bruitages, calés sur boards/frames.py.

audio_clips(FRAMES, LEAD) renvoie les balises <audio> que build_film.py pose dans index.html.
128 BPM : 1 temps = 0,46875 s, 1 mesure = 1,875 s. Fichiers : assets/audio/."""
BAR = 1.875
BEAT = BAR / 4


def audio_clips(FRAMES, LEAD):
    a = []

    def add(aid, src, start, dur, vol, mstart=None, extra=""):
        ms = f' data-media-start="{mstart}"' if mstart is not None else ""
        a.append(f'      <audio id="{aid}" class="clip" src="assets/audio/{src}" data-start="{start:.3f}" data-duration="{dur:.3f}"{ms} '
                 f'data-track-index="{20 + len(a) % 4}" data-volume="{vol}"{extra}></audio>')
    # Musique : la piste s'ouvre à 11,25 s (fichier 26,265 s) ; coupure d'une demi-mesure avant le lever de soleil.
    cut = 33.75 - BAR / 2
    add("music", "ambient-uplift.mp3", 0, cut, 0.8, 15.015, ' data-timeline-role="music" data-fade-in="0.3" data-fade-out="0.35"')
    add("music2", "ambient-uplift.mp3", 33.75, 60 - 33.75, 0.85, round(15.015 + 33.75, 3), ' data-timeline-role="music" data-fade-in="0.05" data-fade-out="1.8"')
    starts = {f["n"]: f["start"] - LEAD.get(f["n"], 0) for f in FRAMES}
    add("t-tap1", "sfx-click-soft.mp3", starts[2] + BAR - 0.55 + 0.2, 0.36, 0.8)
    add("t-typing", "sfx-typing.mp3", starts[5] + 0.05, 1.3, 0.4)
    add("t-click", "sfx-click-soft.mp3", starts[5] + 1.62, 0.36, 0.9)
    add("t-whoosh-iris", "sfx-whoosh-cinematic.mp3", starts[6], 2.2, 0.45, 1.9)
    for k, at in enumerate([0.47, 1.17]):
        add(f"t-pop6-{k}", "sfx-pop.mp3", starts[6] + 0.35 + at, 0.7, 0.25)
    for k in range(4):
        add(f"t-pop7-{k}", "sfx-pop.mp3", starts[7] + 0.4 + k * BEAT * 2, 0.7, 0.18)
    for k in range(4):
        add(f"t-click10-{k}", "sfx-click-soft.mp3", starts[10] + BAR + k * BEAT, 0.36, 0.7)
    for n in (4, 9, 12, 18, 21):
        add(f"t-whoosh{n}", "sfx-whoosh-short.mp3", starts[n] - 0.1, 0.57, 0.3)
    add("t-tap17", "sfx-click-soft.mp3", starts[17] + BAR - 0.55 + 0.2, 0.36, 0.8)
    add("t-riser", "sfx-riser.mp3", starts[23] - 2.0, 2.2, 0.4, 1.2)
    add("t-impact", "sfx-impact-bass-1.mp3", starts[23] + 0.2, 2.1, 0.8)
    return a
