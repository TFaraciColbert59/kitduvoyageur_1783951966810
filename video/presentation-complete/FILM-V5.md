# « Une phrase, une aventure » — v5 (20 s, 9:16, 60 i/s)

**Concept.** Une seule forme, jamais coupée. Elle passe d'un point de lumière à une fenêtre sur la montagne, puis au champ du Compas, au bandeau « Je prépare ton aventure… » et à l'écran du Hub, d'où les tuiles jaillissent. Elle devient ensuite le bouton « Démarrer le voyage » : au DROP, elle explose en plein cadre. La suite alterne plein cadre et cartes réelles (carnet, Suivi en direct, Rencontre), puis tout revient au point, à l'anneau et au logo.

**Musique.** « Mountains », Mixkit n° 187, licence Mixkit (usage commercial permis), source : https://assets.mixkit.co/music/187/187.mp3 (non versionnée).
- Extrait utilisé : de 37,40 s à 57,40 s. Le drop mesuré de la piste, à 47,22 s, tombe à 9,816 s dans le film.
- Tempo mesuré : 122,3 BPM (un temps = 0,4908 s). Tonalité estimée : la mineur.
- Effets synthétisés et placés sur les gestes (`tools/mix.py`). Niveau final : −14 LUFS.

**Vrai ou inventé.**
- Vrais : tous les éléments d'interface. Ce sont des captures ou un enregistrement du compte de démo sur `main`, sans aucune validation :
  - saisie dans le Compas ;
  - bandeau de préparation ;
  - Hub et ses tuiles ;
  - « Démarrer le voyage » ;
  - carnet du Tour des Écrins (4 jours, 72 km, +4 520 m D+) ;
  - Suivi en direct ;
  - carte Rencontre « Marc, berger ».
- Inventés : les plans de vie, qui sont les images animées de « Pas pour moi » ; les titres ; le curseur « Toi ».

**Construction.** `tools/build.py` génère `index.html`. Le mouvement est dans `assets/film.js`, en fonction pure du temps avec des ressorts fermés. Le son se fabrique avec `tools/mix.py <mountains.mp3>`.
