# SPEC — Trailer LKDV « Une phrase suffit »

GOAL:    à la fin, le spectateur sait que LKDV prépare une aventure entière à partir d'une phrase (parcours, groupe, kit, sac, terrain, carnet, communauté) et retient le badge et lekitduvoyageur.fr.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps.
TIME:    65,7 s x 30 = 1 971 images. Musique 128 BPM : 14,0625 images par temps, 56,25 par mesure.
         Piste lue à partir de 14,565 s du fichier ; mesures du film (temps forts mesurés) :
         0,45 · 2,32 · 4,19 · 6,07 · 7,95 · 9,82 · 11,70 (la piste s'ouvre) · 13,58 · 15,45 · 17,32 · 19,20 · 21,07 · 22,95 · 24,82 · 26,70 ·
         28,58 · 30,44 · 32,32 · 34,20 · 36,07 · 37,95 · 39,82 · 41,69 · 43,58 · 45,45 · 47,32 · 49,20 · 51,07 · 52,95 · 54,82 · 56,70 ·
         58,58 · 60,44 · 62,32 · 64,20 (fondu de sortie 1,5 s).

LOOK:    le Liquid Glass du Compas, sur les vraies photos de la marque.
         - sol : photo pleine image (`lkdv-bg-landscape`, brume et forêt) ou imagerie satellite Esri ; jamais de vide sombre.
         - verre : rgba(250,248,245,0.66), `backdrop-filter: blur(24px) saturate(1.5)`, bord 1 px rgba(255,255,255,0.7), rayon 28 px,
           ombre 0 24 60 rgba(11,31,23,0.22). Rangées `.cp-row` : texte encre #17402C / #1F2A24, sous-texte #5B6B61.
         - encre : forest #17402C (tout ce qui se lit sur fond clair) ; sage #5B7F55 (barres, pastilles) ; stone #FAF8F5.
         - accent rationné : un seul mot par titre en italique EB Garamond (substitut libre de Georgia), stone sur photo, forest sur verre.
         - titres : Inter 800, 92 px (8,5 % de la hauteur), interlettrage -2,5 %, deux lignes au plus, toujours dans la zone 80 %.
           Petites capitales de section : Inter 700, 22 px, +14 %.
         - lumière : ombre portée seulement sous le verre et le téléphone ; vignette 0 ; grain 0 (la photo porte la matière).
OBJECTS: - la carte arrondie de photo (rayon 36 px) des montages de voyage ;
         - le panneau du Compas (capsule d'étapes Où/Nous/Résa/Verdict/Kit, champ « Où veux-tu aller ? », bouton « Préparer mon aventure ») ;
         - la carte satellite avec puces d'étapes (Gavarnie, Cabane des Sarradets, Refuge de Bayssellance, Cirque de Troumouse) et tracé forest 7 px ;
         - le sac LKDV ONE 45 L : le vrai maillage `.glb` du Kit Studio, rendu en Three.js, sol clair, ombre de contact ;
         - le téléphone : coque noire 18 px, rayon 64 px, écran = captures réelles de l'app ;
         - le badge LKDV (fichier `public/logo.png`, détouré en cercle, jamais redessiné).
MOTION:  arrivées `expo.out` 0,7 s ; déplacements de caméra et de couleur `power2.inOut` 0,6 s ; sorties et zooms traversants `power3.in` 0,35 s ;
         ressorts amortis 0,8 (`back.out(1.2)`) seulement sur la position des puces et des cartes ; mots par mots 0,07 s d'écart, flou 6 → 0 px ;
         sorties 40 % plus courtes que les entrées ; tout titre posé reste immobile.
SHOTS:
  1  0,00–6,07   Montage : six photos en cartes arrondies, une par temps, qui glissent à gauche avec flou horizontal ; « Partir » puis
                 « quelque part, » / « *autrement.* » posés mot à mot. Son : piste calme. Sortie : la dernière carte devient le fond.
  2  6,07–9,36   Les questions : des pastilles de verre (« Quel parcours ? », « Combien de nuits ? », « Qui porte le réchaud ? », « Quel budget ? »,
                 « Il fera quel temps ? », « Et si l'un de nous marche moins vite ? »…) arrivent une par temps et encombrent l'image. Son : pop doux.
                 Sortie : un balayage de verre les emporte et révèle le panneau du Compas.
  3  9,36–12,10  Compas « Où veux-tu aller ? » à 1,7×. La phrase se tape (tic de touches), le curseur clique « Préparer mon aventure » à 11,62 ;
                 le bouton grandit jusqu'à couvrir l'image (zoom traversant), la musique s'ouvre à 11,70.
  4  11,95–19,20 Globe satellite → Pyrénées → Gavarnie (vol cuit). Pendant l'arrêt : tracé qui se dessine d'étape en étape, puces qui tombent
                 une par temps, pastille « D+ 2 750 m · 44 km ». Titre « Un parcours sur de *vrais* lieux ».
  5  19,20–26,70 Panneau « Nous » : Tony, Léa, Noé ; « Le groupe marche au rythme de Noé (3,6 km/h à plat). » s'éclaire ; barres de charge.
                 22,95 : le panneau se replie en ligne de préparation « Pas encore prêt · 14 % » ; « Trouver : réchaud — Objet vital pour ce parcours »
                 s'ouvre en trois offres réelles du jeu de démo (location Jetboil 6 €/jour, Trangia 39 €, MSR d'occasion 22 €).
                 Titre « Ce qui manque, *avant* de partir ».
  6  26,70–37,95 PAYOFF Kit Studio : le sac 3D tombe en place, tourne de 200°, change de coloris sur les mesures (forêt → sauge → pierre),
                 la poche multifonction puis le porte-piolets se fixent ; étiquettes réelles « LKDV ONE 45 L », « 10,3 kg », « Commander · 5 pièces · 471 € ».
                 Titre « Ton sac, *pièce* par pièce ».
  7  37,95–47,32 Terrain : le téléphone entre, écran « Randonnée · 42:05 », puis SOS, Hors ligne (264 tuiles), profil 9,1 km.
                 Titre « Sur le sentier, *même* sans réseau ».
  8  47,32–56,70 Partager : le téléphone montre le carnet « Tour du Mont-Blanc en autonomie complète », puis les carnets en route,
                 les sorties (« Traversée du Vercors ») et les clubs (« Vercors Alpin »). Titre « Raconte. Rejoins. *Repars.* »
  9  56,70–65,70 « Une phrase. » / « Tout le *voyage.* » sur la photo de brume ; 59,6 le badge arrive en tournant comme une boussole qui se cale,
                 le nom « Le Kit du Voyageur » s'essuie à droite, « Préparer · Explorer · Partager », puis « lekitduvoyageur.fr ». Impact à 59,6.
BANNED:  vide sombre ; lueurs, néons, particules ; dégradés violets ; tout centré ; tout qui glisse vers le haut en fondu ; titres qui dérivent ;
         trois cartes en rangée ; logo docké en coin ; interface produit inclinée en 3D ; boutons ou chiffres inventés.
QA:      0,3 (première image lisible, pas noire) · 4,2 (titre posé) · 8,8 (questions) · 11,4 (phrase entière) · 11,8 (zoom traversant) ·
         17,8 (tracé + puces) · 21,5 (rythme de Noé) · 25,5 (réchaud) · 31,0 et 36,5 (sac 3D, coloris, modules) · 41,0 (42:05) · 51,0 (carnet) ·
         58,0 (claim) · 63,0 (badge + URL).
