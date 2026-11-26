# Écrit compositions/acteB.html (13,333 → 24,333 s) : les six preuves, une fiche d'interface LKDV chacune.
# Refuges, météo, sac, budget, hors ligne, proches. Temps locaux (0 = 13,333 s).
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SC = [  # (id, début, fin) en temps local
    ('b1', 0.0, 2.067), ('b2', 2.067, 3.567), ('b3', 3.567, 5.017), ('b4', 5.017, 6.767), ('b5', 6.767, 8.567), ('b6', 8.567, 11.0)]
T = {k: (a, b) for k, a, b in SC}
CHECK = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 12.5 L10 17 L19 7" fill="none" stroke="#FAF8F5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'

REF = [('Refugio Grey', 'Jour 1'), ('Campamento Italiano', 'Jour 2'), ('Los Cuernos', 'Jour 3'), ('Chileno', 'Jour 4')]
ref_rows = ''.join(f'<div id="b1-r{i}" class="b-row"><div class="b-num">{i + 1}</div><div class="b-rt"><b>{n}</b><span>{d} · 1 nuit</span></div><div id="b1-c{i}" class="b-ok">{CHECK}</div><div id="b1-p{i}" class="b-chip">Réservé</div></div>' for i, (n, d) in enumerate(REF))
SUN = '<svg width="46" height="46" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#D0A070"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="#D0A070" stroke-width="2" stroke-linecap="round"/></svg>'
CLOUD = '<svg width="46" height="46" viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9a4.5 4.5 0 0 1 0 9z" fill="#9AA79E"/></svg>'
RAIN = '<svg width="46" height="46" viewBox="0 0 24 24"><path d="M7 14a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 5a4.5 4.5 0 0 1 0 9z" fill="#7F8F86"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#7AAABE" stroke-width="2" stroke-linecap="round"/></svg>'
JOURS = [('Lun', CLOUD, '55'), ('Mar', SUN, '40'), ('Mer', CLOUD, '60'), ('Jeu', RAIN, '70'), ('Ven', CLOUD, '50')]
days = ''.join(f'<div id="b2-d{i}" class="b-day{" on" if i == 1 else ""}"><span>{d}</span><i>{ic}</i><em>{v} km/h</em></div>' for i, (d, ic, v) in enumerate(JOURS))
SAC = [('Tente 2 places', '1,9 kg'), ('Duvet −5 °C', '1,1 kg'), ('Réchaud + popote', '0,6 kg'), ('Veste de pluie', '0,4 kg'), ('Nourriture 5 j', '3,2 kg'), ('Eau, frontale, trousse…', '2,2 kg')]
sac_rows = ''.join(f'<div id="b3-r{i}" class="b-srow"><span>{n}</span><b>{w}</b></div>' for i, (n, w) in enumerate(SAC))
GENS = [('L', 'Léa', '#17402C'), ('T', 'Tom', '#D0A070'), ('M', 'Maya', '#5B7F55')]
gens = ''.join(f'<div id="b4-p{i}" class="b-person"><div class="b-av" style="background:{c}">{l}</div><b>{n}</b><span id="b4-v{i}">0 €</span></div>' for i, (l, n, c) in enumerate(GENS))

html = f'''<template>
  <style>
    #root {{ position:absolute; inset:0; overflow:hidden; }}
    #root .b-card {{ position:absolute; left:60px; width:960px; top:520px; background:#FFFFFF; border-radius:36px; box-shadow:0 26px 60px rgba(11,31,23,0.16), 0 2px 8px rgba(11,31,23,0.08); border:1px solid rgba(11,31,23,0.06); padding:34px 36px; font-family:"Inter",sans-serif; color:#0B1F17; }}
    #root .b-h {{ display:flex; justify-content:space-between; align-items:center; font-weight:800; font-size:32px; margin-bottom:22px; }}
    #root .b-h small {{ font-weight:700; font-size:22px; color:#17402C; background:#E4EADF; padding:6px 16px; border-radius:14px; }}
    #root .b-stk {{ position:absolute; padding:10px 26px 14px; background:#B84A32; color:#FAF8F5; border-radius:14px; box-shadow:0 10px 24px rgba(11,31,23,0.22); font-family:"Anton",sans-serif; font-size:72px; line-height:1; text-transform:uppercase; opacity:0; }}
    #root .b-stk.ink {{ background:#0B1F17; }}
    /* refuges */
    #root .b-row {{ display:flex; align-items:center; gap:20px; padding:18px 0; border-top:1px solid #ECE7DD; position:relative; }}
    #root .b-num {{ width:52px; height:52px; border-radius:16px; background:#F3F0EA; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:26px; color:#5F6E64; }}
    #root .b-rt b {{ display:block; font-size:32px; }} #root .b-rt span {{ font-size:22px; color:#5F6E64; font-weight:600; }}
    #root .b-ok {{ margin-left:auto; width:46px; height:46px; border-radius:23px; background:#17402C; display:flex; align-items:center; justify-content:center; opacity:0; }}
    #root .b-chip {{ position:absolute; right:64px; top:30px; padding:6px 14px; border-radius:12px; background:#E4EADF; color:#17402C; font-weight:700; font-size:20px; opacity:0; }}
    /* météo */
    #b2-days {{ display:flex; gap:12px; }}
    #root .b-day {{ flex:1; border-radius:22px; background:#F3F0EA; padding:16px 0; text-align:center; font-weight:700; font-size:22px; color:#5F6E64; }}
    #root .b-day i {{ display:block; font-style:normal; height:46px; margin:8px 0; }}
    #root .b-day em {{ font-style:normal; font-size:18px; }}
    #root .b-day.on {{ background:#17402C; color:#FAF8F5; }}
    #b2-big {{ margin-top:28px; display:flex; align-items:center; gap:24px; }}
    #b2-big b {{ font-family:"Anton",sans-serif; font-size:120px; line-height:1; font-weight:400; }}
    #b2-big span {{ font-size:28px; font-weight:700; color:#17402C; line-height:1.3; }}
    #b2-sun {{ position:absolute; right:60px; top:420px; width:120px; height:120px; border-radius:60px; background:#D0A070; box-shadow:0 0 0 18px rgba(208,160,112,0.25); }}
    /* sac */
    #root .b-srow {{ display:flex; justify-content:space-between; padding:13px 0; border-top:1px solid #ECE7DD; font-size:28px; font-weight:600; opacity:0; }}
    #root .b-srow b {{ font-weight:800; color:#17402C; }}
    #b3-tot {{ display:flex; align-items:flex-end; justify-content:space-between; margin-top:20px; }}
    #b3-tot b {{ font-family:"Anton",sans-serif; font-size:110px; line-height:0.95; font-weight:400; }}
    #b3-bar {{ height:22px; border-radius:11px; background:#ECE7DD; margin-top:14px; overflow:hidden; }}
    #b3-fill {{ height:100%; width:100%; background:linear-gradient(90deg,#5B7F55,#17402C); transform-origin:0 50%; }}
    /* budget */
    #b4-total {{ font-size:26px; font-weight:700; color:#5F6E64; }}
    #b4-total b {{ display:block; font-family:"Anton",sans-serif; font-size:120px; line-height:1; font-weight:400; color:#0B1F17; margin-top:6px; }}
    #b4-people {{ display:flex; gap:18px; margin-top:26px; }}
    #root .b-person {{ flex:1; border-radius:26px; background:#F3F0EA; padding:22px 10px; text-align:center; opacity:0; }}
    #root .b-av {{ width:84px; height:84px; border-radius:42px; margin:0 auto 12px; display:flex; align-items:center; justify-content:center; color:#FAF8F5; font-weight:800; font-size:38px; }}
    #root .b-person b {{ display:block; font-size:28px; }} #root .b-person span {{ display:block; font-size:34px; font-weight:800; color:#17402C; margin-top:6px; }}
    /* hors ligne */
    #b5-phone {{ position:absolute; left:290px; top:500px; width:500px; height:900px; background:#0B1F17; border-radius:70px; padding:14px; box-shadow:0 34px 70px rgba(11,31,23,0.32); }}
    #b5-screen {{ position:relative; width:472px; height:872px; border-radius:58px; overflow:hidden; background:#E2D8C0; }}
    #b5-screen img {{ position:absolute; left:-230px; top:80px; width:940px; height:715px; }}
    #b5-ban {{ position:absolute; left:20px; right:20px; top:60px; padding:16px 18px; border-radius:22px; background:#0B1F17; color:#FAF8F5; font-family:"Inter",sans-serif; font-weight:700; font-size:24px; display:flex; align-items:center; gap:12px; }}
    #b5-dot {{ position:absolute; left:250px; top:430px; width:34px; height:34px; border-radius:17px; background:#17402C; border:6px solid #FAF8F5; box-shadow:0 0 0 10px rgba(23,64,44,0.25); }}
    /* proches */
    #b6-map {{ position:absolute; left:60px; top:520px; width:960px; height:560px; border-radius:36px; overflow:hidden; box-shadow:0 26px 60px rgba(11,31,23,0.16); }}
    #b6-map img {{ position:absolute; left:-10px; top:-80px; width:980px; height:745px; }}
    #b6-me {{ position:absolute; left:640px; top:210px; width:30px; height:30px; border-radius:15px; background:#E07A5F; border:6px solid #FAF8F5; }}
    #root .b6-ring {{ position:absolute; left:625px; top:195px; width:60px; height:60px; border-radius:30px; border:4px solid #E07A5F; opacity:0; }}
    #b6-notif {{ position:absolute; left:90px; top:1120px; width:900px; padding:26px 30px; border-radius:30px; background:#FFFFFF; box-shadow:0 22px 50px rgba(11,31,23,0.18); display:flex; align-items:center; gap:22px; font-family:"Inter",sans-serif; opacity:0; }}
    #b6-av {{ width:90px; height:90px; border-radius:45px; background:#5B7F55; color:#FAF8F5; font-weight:800; font-size:40px; display:flex; align-items:center; justify-content:center; flex:none; }}
    #b6-notif b {{ display:block; font-size:32px; color:#0B1F17; }} #b6-notif span {{ font-size:24px; color:#5F6E64; font-weight:600; }}
    #b6-live {{ margin-left:auto; padding:8px 16px; border-radius:14px; background:#E07A5F; color:#FAF8F5; font-weight:800; font-size:22px; }}
    #root .b6-heart {{ position:absolute; font-size:54px; opacity:0; }}
  </style>
  <div id="root" data-composition-id="acteB" data-width="1080" data-height="1920">
    <div id="b1" class="clip" data-start="{T['b1'][0]}" data-duration="{T['b1'][1] - T['b1'][0]:.3f}" data-track-index="1">
      <div id="b1-card" class="b-card"><div class="b-h">Refuges · Le W <small>4 nuits</small></div>{ref_rows}</div>
      <div id="b1-stk" class="b-stk" style="left:760px; top:470px">4/4</div>
    </div>
    <div id="b2" class="clip" data-start="{T['b2'][0]}" data-duration="{T['b2'][1] - T['b2'][0]:.3f}" data-track-index="2">
      <div id="b2-card" class="b-card"><div class="b-h">Météo · Torres del Paine <small>fiable à 3 jours</small></div><div id="b2-days">{days}</div>
        <div id="b2-big"><b>MAR. 6:00</b><span>Fenêtre idéale<br>pour les Torres</span></div></div>
      <div id="b2-sun"></div>
      <div id="b2-stk" class="b-stk ink" style="left:90px; top:1150px">Départ 6 h</div>
    </div>
    <div id="b3" class="clip" data-start="{T['b3'][0]}" data-duration="{T['b3'][1] - T['b3'][0]:.3f}" data-track-index="1">
      <div id="b3-card" class="b-card"><div class="b-h">Mon sac <small>Kit Studio</small></div>{sac_rows}
        <div id="b3-tot"><b><span id="b3-kg">0,0</span> KG</b><span style="font-size:24px;font-weight:700;color:#5F6E64">objectif ≤ 10 kg</span></div><div id="b3-bar"><div id="b3-fill"></div></div></div>
      <div id="b3-stk" class="b-stk" style="left:700px; top:470px">au gramme</div>
    </div>
    <div id="b4" class="clip" data-start="{T['b4'][0]}" data-duration="{T['b4'][1] - T['b4'][0]:.3f}" data-track-index="2">
      <div id="b4-card" class="b-card"><div class="b-h">Budget partagé <small>3 voyageurs</small></div>
        <div id="b4-total">Total du voyage<b><span id="b4-tv">0</span> €</b></div><div id="b4-people">{gens}</div></div>
      <div id="b4-stk" class="b-stk" style="left:740px; top:480px">÷ 3</div>
    </div>
    <div id="b5" class="clip" data-start="{T['b5'][0]}" data-duration="{T['b5'][1] - T['b5'][0]:.3f}" data-track-index="1">
      <div id="b5-phone"><div id="b5-screen"><img src="assets/img/carte-w.png" alt="Carte du W hors ligne"><div id="b5-dot"></div>
        <div id="b5-ban"><svg width="30" height="30" viewBox="0 0 24 24"><path d="M3 9.5a13 13 0 0 1 18 0M6.5 13a8 8 0 0 1 11 0M10 16.5a3 3 0 0 1 4 0M4 4l16 16" fill="none" stroke="#E07A5F" stroke-width="2.2" stroke-linecap="round"/></svg>Hors ligne · carte disponible</div></div></div>
      <div id="b5-stk" class="b-stk ink" style="left:110px; top:1300px">0 réseau</div>
    </div>
    <div id="b6" class="clip" data-start="{T['b6'][0]}" data-duration="{T['b6'][1] - T['b6'][0]:.3f}" data-track-index="2">
      <div id="b6-map"><img src="assets/img/carte-w.png" alt="Position partagée sur la carte du W"><div class="b6-ring" id="b6-r0"></div><div class="b6-ring" id="b6-r1"></div><div class="b6-ring" id="b6-r2"></div><div id="b6-me"></div></div>
      <div id="b6-notif"><div id="b6-av">H</div><div><b>Hélène suit ton trajet</b><span>Lyon · à 13 000 km</span></div><div id="b6-live">EN DIRECT</div></div>
      <div class="b6-heart" id="b6-h0" style="left:820px; top:1080px"><svg width="56" height="56" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.2 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.7 0 5.9 3.7 4.4 7.3C19.5 16.4 12 21 12 21z" fill="#E07A5F"/></svg></div><div class="b6-heart" id="b6-h1" style="left:900px; top:1110px"><svg width="56" height="56" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.2 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.7 0 5.9 3.7 4.4 7.3C19.5 16.4 12 21 12 21z" fill="#E07A5F"/></svg></div><div class="b6-heart" id="b6-h2" style="left:760px; top:1120px"><svg width="56" height="56" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.2 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.7 0 5.9 3.7 4.4 7.3C19.5 16.4 12 21 12 21z" fill="#E07A5F"/></svg></div>
      <div id="b6-stk" class="b-stk" style="left:600px; top:470px">en direct</div>
    </div>
  </div>
  <script>
    (function () {{
      const tl = gsap.timeline({{ paused: true }});
      const pop = (sel, t, from = {{ scale: 0.4 }}) => tl.fromTo(sel, {{ opacity: 0, ...from }}, {{ opacity: 1, scale: 1, rotation: 0, y: 0, x: 0, duration: 0.42, ease: "back.out(2.2)" }}, t);
      const stk = (sel, t, r) => {{ pop(sel, t, {{ scale: 2.2, rotation: r * 3 }}); tl.to(sel, {{ rotation: r, duration: 0.18 }}, t + 0.42); }};
      const out = (sel, t) => tl.to(sel, {{ y: -160, opacity: 0, scale: 0.9, duration: 0.2, ease: "power2.in" }}, t);
      const count = (id, a, b, t, d, fmt) => {{ const o = {{ v: a }}; tl.to(o, {{ v: b, duration: d, ease: "power2.out", onUpdate: () => {{ document.getElementById(id).textContent = fmt(o.v); }} }}, t); }};
      const fr = (v) => Math.round(v).toString().replace(/\\B(?=(\\d{{3}})+(?!\\d))/g, " ");
      // refuges : les quatre lignes se cochent une à une
      pop("#b1-card", 0.0, {{ scale: 0.8, y: 140 }});
      for (let i = 0; i < 4; i++) {{ pop("#b1-c" + i, 0.45 + i * 0.22, {{ scale: 0 }}); pop("#b1-p" + i, 0.5 + i * 0.22, {{ scale: 0.5, x: 30 }}); }}
      stk("#b1-stk", 1.35, 8); out(["#b1-card", "#b1-stk"], {T['b1'][1] - 0.2:.3f});
      // météo : le mardi s'allume, le soleil se lève
      pop("#b2-card", {T['b2'][0]:.3f}, {{ scale: 0.8, y: 140 }});
      tl.fromTo("#b2-d1", {{ scale: 1 }}, {{ scale: 1.12, duration: 0.25, ease: "back.out(3)", yoyo: true, repeat: 1 }}, {T['b2'][0] + 0.35:.3f});
      tl.fromTo("#b2-sun", {{ y: 200, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }}, {T['b2'][0] + 0.3:.3f});
      stk("#b2-stk", {T['b2'][0] + 0.7:.3f}, -6); out(["#b2-card", "#b2-sun", "#b2-stk"], {T['b2'][1] - 0.2:.3f});
      // sac : les affaires s'ajoutent, le poids monte jusqu'à 9,4 kg
      pop("#b3-card", {T['b3'][0]:.3f}, {{ scale: 0.8, y: 140 }});
      for (let i = 0; i < 6; i++) tl.fromTo("#b3-r" + i, {{ opacity: 0, x: -60 }}, {{ opacity: 1, x: 0, duration: 0.2, ease: "power2.out" }}, {T['b3'][0] + 0.2:.3f} + i * 0.1);
      count("b3-kg", 0, 9.4, {T['b3'][0] + 0.2:.3f}, 0.8, (v) => v.toFixed(1).replace(".", ","));
      tl.fromTo("#b3-fill", {{ scaleX: 0 }}, {{ scaleX: 0.94, duration: 0.8, ease: "power2.out" }}, {T['b3'][0] + 0.2:.3f});
      stk("#b3-stk", {T['b3'][0] + 0.75:.3f}, 7); out(["#b3-card", "#b3-stk"], {T['b3'][1] - 0.2:.3f});
      // budget : 4 194 € se partagent en trois
      pop("#b4-card", {T['b4'][0]:.3f}, {{ scale: 0.8, y: 140 }});
      count("b4-tv", 0, 4194, {T['b4'][0] + 0.15:.3f}, 0.6, fr);
      for (let i = 0; i < 3; i++) {{ pop("#b4-p" + i, {T['b4'][0] + 0.6:.3f} + i * 0.12, {{ scale: 0.5, y: 60 }}); count("b4-v" + i, 0, 1398, {T['b4'][0] + 0.7:.3f} + i * 0.12, 0.6, (v) => fr(v) + " €"); }}
      stk("#b4-stk", {T['b4'][0] + 0.95:.3f}, -8); out(["#b4-card", "#b4-stk"], {T['b4'][1] - 0.2:.3f});
      // hors ligne : le téléphone, la bannière, le point qui reste sur la carte
      tl.fromTo("#b5-phone", {{ y: 900, rotation: 8 }}, {{ y: 0, rotation: -2, duration: 0.55, ease: "back.out(1.4)" }}, {T['b5'][0]:.3f});
      tl.fromTo("#b5-ban", {{ y: -120, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.35, ease: "back.out(2)" }}, {T['b5'][0] + 0.35:.3f});
      tl.fromTo("#b5-dot", {{ scale: 0 }}, {{ scale: 1, duration: 0.3, ease: "back.out(3)" }}, {T['b5'][0] + 0.5:.3f});
      stk("#b5-stk", {T['b5'][0] + 0.8:.3f}, -7);
      tl.to("#b5-phone", {{ y: 1000, rotation: 10, duration: 0.25, ease: "power2.in" }}, {T['b5'][1] - 0.22:.3f}); out("#b5-stk", {T['b5'][1] - 0.2:.3f});
      // proches : la position pulse, la notification d'Hélène arrive, des cœurs montent
      pop("#b6-map", {T['b6'][0]:.3f}, {{ scale: 0.85, y: 120 }});
      for (let k = 0; k < 6; k++) tl.fromTo("#b6-r" + (k % 3), {{ opacity: 0.9, scale: 0.4 }}, {{ opacity: 0, scale: 3, duration: 0.9, ease: "sine.out" }}, {T['b6'][0] + 0.3:.3f} + k * 0.35);
      tl.fromTo("#b6-notif", {{ y: 200, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.8)" }}, {T['b6'][0] + 0.45:.3f});
      for (let i = 0; i < 3; i++) tl.fromTo("#b6-h" + i, {{ opacity: 0, y: 0, scale: 0.4 }}, {{ opacity: 1, y: -260 - i * 40, x: (i - 1) * 40, scale: 1, duration: 0.8, ease: "power2.out" }}, {T['b6'][0] + 1.0:.3f} + i * 0.2);
      for (let i = 0; i < 3; i++) tl.to("#b6-h" + i, {{ opacity: 0, duration: 0.3 }}, {T['b6'][0] + 2.25:.3f});
      stk("#b6-stk", {T['b6'][0] + 0.9:.3f}, 6);
      tl.to(["#b6-map", "#b6-notif", "#b6-stk"], {{ opacity: 0, duration: 0.25, ease: "power2.in" }}, {T['b6'][1] - 0.25:.3f});
      window.__timelines = window.__timelines || {{}};
      window.__timelines["acteB"] = tl;
    }})();
  </script>
</template>
'''
open(os.path.join(ROOT, 'compositions', 'acteB.html'), 'w').write(html)
print('acteB.html ok')
