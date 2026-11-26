# Présentation LKDV — v5 « Une phrase, une aventure » (20 s, 9:16). Génère index.html ; le mouvement est dans assets/film.js
# (une fonction pure du temps, ressorts fermés, une seule forme jamais coupée). Grille : 122,3 BPM, un temps = 0,4908 s,
# piste « Mountains » (Mixkit, licence Mixkit) de 37,40 s à 57,40 s : le drop de la piste tombe sur b20 = 9,816 s.
import os
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = 0.4908
def b(n): return round(n * B, 4)
D = 20.0
STONE, INK, BRASS, FOREST, SAGE = '#FAF8F5', '#0B1F17', '#D0A070', '#17402C', '#5B7F55'
SANS = "font-family:Inter,sans-serif"
ANTON = "font-family:Anton,Inter,sans-serif;font-weight:400"
GAR = "font-family:'EB Garamond Italic',Georgia,serif;font-style:italic;font-weight:400"
SHD = 'text-shadow:0 4px 34px rgba(0,0,0,.45)'

track = [1]
def vclip(id_, src, t0, t1, ms):
    track[0] = track[0] % 5 + 1
    return (f'<video id="{id_}" class="clip layer" src="assets/video/{src}.mp4" muted playsinline data-start="{t0}" data-duration="{round(t1 - t0, 4)}" '
            f'data-media-start="{ms}" data-track-index="{track[0]}" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;opacity:0"></video>')
def iclip(id_, src, pos='center'):
    return f'<img id="{id_}" class="layer" src="{src}" alt="" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:{pos};opacity:0">'
def txt(id_, y, html, style):
    return f'<div id="{id_}" style="position:absolute;left:0;right:0;top:{y}px;text-align:center;white-space:nowrap;z-index:60;opacity:0;{style}">{html}</div>'

layers = [
    vclip('L_j01', 'j01', 0.0, b(1), 2.2), vclip('L_j17', 'j17', b(1), b(2), 0.6), vclip('L_g12a', 'g12', b(2), b(3), 1.0), vclip('L_a02a', 'a02', b(3), b(4), 1.0),
    f'<video id="L_compas" class="clip layer" src="assets/video/compas-saisie.mp4" muted playsinline data-start="{b(4) - 0.02}" data-duration="{round(b(10.2) - b(4) + 0.02, 4)}" '
    f'data-media-start="{round(1.326 - B - 0.02, 4)}" data-track-index="6" style="position:absolute;left:0;top:0;object-fit:fill;opacity:0"></video>',
    iclip('L_prep', 'assets/real/compas-prepare.png'), iclip('L_hub', 'assets/screens/hub.png', 'top'), iclip('L_etapes', 'assets/real/tiroir-etapes.png'),
    vclip('L_dawn', 'a02', b(20), b(24) + 0.4, 2.5), iclip('L_carnet', 'assets/real/carnet-ecrins.png'), vclip('L_night', 'j19', b(26), b(28) + 0.4, 2.0),
    iclip('L_beacon', 'assets/real/suivi-beacon.png'), vclip('L_mother', 'j20', b(30), b(32), 2.5), vclip('L_refuge', 'g12', b(32), b(34) + 0.4, 2.0),
]
texts = [
    txt('T_w1', 1450, 'Partir.', f'{ANTON};font-size:190px;line-height:1;color:{STONE};{SHD}'),
    txt('T_w2', 1450, 'Grimper.', f'{ANTON};font-size:190px;line-height:1;color:{STONE};{SHD}'),
    txt('T_w3', 1450, 'Partager.', f'{ANTON};font-size:190px;line-height:1;color:{STONE};{SHD}'),
    txt('T_w4', 1450, 'Arriver.', f'{ANTON};font-size:190px;line-height:1;color:{BRASS};{SHD}'),
    txt('T_ceye', 250, 'LE COMPAS', f'{SANS};font-weight:600;font-size:30px;letter-spacing:.3em;color:{SAGE}'),
    txt('T_chead', 300, 'Dis-le<br>avec tes mots.', f'{SANS};font-weight:700;font-size:104px;line-height:1.05;letter-spacing:-.03em;color:{INK}'),
    txt('T_phead', 700, 'Le Compas<br><span style="color:{FOREST}">prépare tout.</span>', f'{SANS};font-weight:700;font-size:96px;line-height:1.05;letter-spacing:-.03em;color:{INK}'),
    txt('T_heye', 150, 'LE HUB', f'{SANS};font-weight:600;font-size:30px;letter-spacing:.3em;color:{SAGE}'),
    txt('T_hhead', 196, 'Tout est là.', f'{SANS};font-weight:700;font-size:110px;line-height:1;letter-spacing:-.03em;color:{INK}'),
    txt('T_pret', 560, 'Prêt ?', f'{ANTON};font-size:300px;line-height:1;color:{INK}'),
    txt('T_toi', 240, 'Toi. <span style="color:#7E5A30">Ici.</span>', f'{GAR};font-size:210px;line-height:1.1;color:{INK}'),
    txt('T_keye', 260, 'TON CARNET · TOUR DES ÉCRINS', f'{SANS};font-weight:600;font-size:30px;letter-spacing:.26em;color:{SAGE}'),
    txt('T_ens', 1480, 'Ensemble.', f'{GAR};font-size:170px;line-height:1.1;color:{STONE};{SHD}'),
    txt('T_bhead1', 640, 'Tes proches savent', f'{SANS};font-weight:700;font-size:88px;line-height:1.05;letter-spacing:-.03em;color:{INK}'),
    txt('T_bhead2', 740, 'où tu es.', f'{SANS};font-weight:700;font-size:88px;line-height:1.05;letter-spacing:-.03em;color:{FOREST}'),
    txt('T_pren', 230, 'Des prénoms.', f'{GAR};font-size:160px;line-height:1.1;color:{STONE};{SHD}'),
    txt('T_brand', 1050, 'LE KIT DU VOYAGEUR', f'{SANS};font-weight:700;font-size:66px;letter-spacing:.2em;color:{STONE}'),
    txt('T_tag', 1150, 'Là où la carte se termine.', f'{GAR};font-size:84px;line-height:1.2;color:{BRASS}'),
]
odo = ''.join(
    f'<div id="O{k + 1}w" style="position:absolute;left:{x - 220}px;width:440px;top:330px;text-align:center;z-index:60;opacity:0">'
    f'<div id="O{k + 1}" style="{ANTON};font-size:{180 if k < 2 else 150}px;line-height:1;height:190px;display:flex;align-items:flex-end;justify-content:center;color:{FOREST};font-variant-numeric:tabular-nums">0</div>'
    f'<div style="{SANS};font-weight:600;font-size:30px;letter-spacing:.24em;color:{SAGE};margin-top:16px">{u}</div></div>'
    for k, (x, u) in enumerate([(190, 'JOURS'), (540, 'KM'), (890, 'M D+')]))
TORD = ['meteo', 'budget', 'carte', 'etapes', 'carnet', 'kits', 'paperasse', 'groupe']
TW = {'meteo': 300, 'budget': 300, 'carte': 228, 'etapes': 168, 'carnet': 300, 'kits': 300, 'paperasse': 520, 'groupe': 520}
tiles = ''.join(f'<img id="tile_{n}" src="assets/real/hub-{n}.png" alt="" style="position:absolute;left:0;top:0;width:{TW[n]}px;height:auto;border-radius:{round(22 * TW[n] / 182)}px;'
                f'box-shadow:0 24px 60px rgba(11,31,23,.28),0 0 0 1px rgba(255,255,255,.6);transform-origin:50% 50%;z-index:{40 + k};opacity:0">' for k, n in enumerate(TORD))
cursor = (f'<div id="cursor" style="position:absolute;left:0;top:0;z-index:90;transform-origin:0 0">'
          f'<svg width="54" height="64" viewBox="0 0 54 64" style="position:absolute;left:-4px;top:-3px;filter:drop-shadow(0 6px 14px rgba(11,31,23,.35))" aria-hidden="true">'
          f'<path d="M4 3 L4 52 L17 40 L26 60 L35 56 L26 37 L44 37 Z" fill="{FOREST}" stroke="{STONE}" stroke-width="3.5" stroke-linejoin="round"/></svg>'
          f'<div style="position:absolute;left:40px;top:50px;padding:8px 18px;border-radius:22px;background:{BRASS};{SANS};font-weight:700;font-size:26px;color:{INK};white-space:nowrap">Toi</div></div>')
fx = (f'<div id="ripple" style="position:absolute;left:-60px;top:-60px;width:120px;height:120px;border-radius:60px;border:4px solid {BRASS};z-index:85;opacity:0"></div>'
      f'<svg id="holdring" width="140" height="140" viewBox="-70 -70 140 140" style="position:absolute;left:-70px;top:-70px;z-index:84;opacity:0;overflow:visible" aria-hidden="true">'
      f'<circle r="60" fill="rgba(208,160,112,.18)"/><circle id="holdarc" r="60" fill="none" stroke="{BRASS}" stroke-width="8" stroke-linecap="round" stroke-dasharray="377" stroke-dashoffset="377" transform="rotate(-90)"/></svg>'
      f'<div id="prepbar" style="position:absolute;left:240px;top:1135px;width:600px;height:8px;border-radius:4px;background:rgba(23,64,44,.15);overflow:hidden;z-index:60;opacity:0">'
      f'<div id="prepfill" style="width:100%;height:100%;background:{BRASS};transform-origin:0 50%;transform:scaleX(0)"></div></div>'
      f'<img id="rencontre" src="assets/real/rencontre-marc.png" alt="" style="position:absolute;left:0;top:0;width:760px;height:auto;border-radius:56px;box-shadow:0 30px 80px rgba(0,0,0,.5);z-index:70;opacity:0">'
      f'<svg width="1080" height="1920" style="position:absolute;left:0;top:0;z-index:65;pointer-events:none" aria-hidden="true"><circle id="ring" cx="540" cy="800" r="14" fill="none" stroke="{BRASS}" stroke-width="5" opacity="0"/></svg>'
      f'<img id="logo" src="assets/img/badge-anneau.png" alt="" style="position:absolute;left:540px;top:800px;width:330px;height:330px;z-index:66;opacity:0">')
html = f'''<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>LKDV — Une phrase, une aventure</title>
    <script src="assets/lib/gsap.min.js"></script>
    <link rel="stylesheet" href="assets/fonts.css" />
    <style>
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ width:1080px; height:1920px; overflow:hidden; background:#F3EFE8; }}
      #root {{ position:relative; width:1080px; height:1920px; overflow:hidden; -webkit-font-smoothing:antialiased; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="1080" data-height="1920">
      <div id="canvas" style="position:absolute;inset:0;z-index:1;background:radial-gradient(60% 40% at 18% 22%,rgba(91,127,85,.18),rgba(91,127,85,0)),radial-gradient(55% 38% at 85% 78%,rgba(208,160,112,.2),rgba(208,160,112,0)),#F3EFE8"></div>
      <div id="canvas2" style="position:absolute;inset:0;z-index:2;opacity:0;background:radial-gradient(110% 70% at 50% 42%,#173D2B 0%,#06120C 72%)"></div>
      <div id="shape" style="position:absolute;left:527px;top:947px;width:26px;height:26px;border-radius:13px;overflow:hidden;z-index:30;background:#D0A070;box-shadow:0 40px 110px rgba(11,31,23,.35),0 0 0 1px rgba(255,255,255,.12)">
        {''.join(layers)}
      </div>
      {''.join(texts)}
      {odo}
      {tiles}
      {fx}
      {cursor}
      <div id="grain" style="position:absolute;left:-60px;top:-60px;width:1200px;height:2040px;background:url(assets/img/grain.png);opacity:.05;z-index:800;pointer-events:none;mix-blend-mode:overlay"></div>
      <div id="fin" style="position:absolute;inset:0;background:#06120C;z-index:900;opacity:0;pointer-events:none"></div>
      <audio id="son" class="clip" src="audio/bande-son.wav" data-start="0" data-duration="{D}" data-track-index="20" data-volume="1" data-timeline-role="music"></audio>
    </div>
    <script src="assets/film.js"></script>
  </body>
</html>
'''
open(os.path.join(HERE, 'index.html'), 'w').write(html)
print('ok')
