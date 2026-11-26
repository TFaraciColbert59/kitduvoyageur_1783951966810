# Contrôle qualité et rendu — « La Chaîne » (30 s, 9:16)

## Rendu final (étape 6, 18/11/2026)
- `renders/LKDV-la-chaine-30s.mp4` : H.264 yuv420p, 1080 × 1920, 30 i/s, 30,000 s, 47 Mo, AAC ; sonie −13,9 LUFS, crête −2,7 dB.
- `renders/LKDV-la-chaine-30s-partage.mp4` : même film, encodage plus léger (19 Mo) pour l'envoi.
- Les rendus ne sont pas versionnés (`renders/` ignoré) ; on les refait avec `node /root/.claude/skills/hyperframes/scripts/plugin-cli.mjs render --quality delivery -o renders/LKDV-la-chaine-30s.mp4` depuis `video/film-30s`.

## Contrôle (étape 5)
- `check` : **0 erreur** ; restent des avertissements de lecture (`line_unread`), assumés au rythme d'un mot par croche, et quelques débordements pendant les claques et leurs fantômes.
- Chaque monteur a relu ses plans à l'entrée, au milieu, sur chaque temps fort et à la fin, et chaque couture image par image (01→02 … 21→22) ; 3D vérifiée sans image vide, y compris en accès à froid.
- Relecture d'ensemble du rendu de contrôle à 4 i/s (120 images) puis des passages fragiles en pleine résolution.
- Corrigé au contrôle d'ensemble : contraste de « LÉA » (laiton → bronze `#9E7243`, 2,2:1 → lisible) ; plan 15 trop vide (carnet agrandi ×1,5 puis poussée vers « Publier ») ; plan 17 trop vide (avatars ×2,4 + « UN GROUPE. » sur la mesure 20,690) ; couture 15→16 (halo laiton prématuré, avatar de Tom plein cadre) ; avant cela, chaque monteur a corrigé ses propres défauts (voir leurs comptes rendus).

## Ce qui reste imparfait (connu)
- Plan 07 : le globe zoomé à ×9 est un peu mou (couvert par le flou de vitesse) ; les logos des sources ne sont pleinement lisibles qu'environ 3 images, en couronne.
- Plan 20 : pendant ~4 images du dézoom vers la Terre, le globe très agrandi paraît flou ; la rotation du globe est dans le plan, pas une vraie 3D.
- Plan 21 : le repli des particules en aiguille reste un peu désordonné.
- Raccord 15→16 : léger saut d'échelle sur le visage de Tom, qui se lit comme le début du recul.
- Contenus ★ (Maya, son carnet « Le W », Tom, la bouteille et ses réponses, la lignée Léa → Tom, la story d'Anna et la sortie, le carnet publié de Léa) : reconstruits fidèlement avec les composants et libellés réels de l'app, mais **pas encore créés dans l'app** : à créer dans le compte de démo pour que tout ce que montre le film existe réellement.
- Musique : morceau commercial (« No Church In The Wild ») — licence de synchronisation nécessaire avant diffusion publique.
