# Relecture 2 (17/11/2026) — `renders/film-lkdv-v2.mp4` — 6,5/10

Relecteur indépendant. Les défauts techniques de la relecture 1 sont presque tous réglés et les légendes sont honnêtes ; reste un « diaporama soigné » : même gabarit partout, plans d'une mesure trop denses, seconde moitié qui se dissout.

## Réglé par le contenu (frames.py v6)
- Plans d'une mesure trop denses (titre + légende + 2e écran en 1,875 s) → un seul écran aux plans 8 (le sac : 2,9 kg, 14 objets), 9 (budget), 11 (météo).
- Données absurdes lisibles sous « Le W, jour par jour » (jour 2 : 36,2 km, 10 h 07 ; verdict « 4 nuits sans hébergement ») → plan 7 = la carte satellite seule ; le verdict n'est plus montré.
- Titre du plan 05 sans « en refuge » → phrase exacte : « Le W de Torres del Paine, / 5 jours à 3 en refuge, fin novembre ».
- Plan 19 à moitié flou (`hub-kits`, « 0 % ») → « À six, un autre carnet » (`carnet-tmb.jpg`, 5 jours, 6 voyageurs).
- « Sa version, en 80 L » incompréhensible et répété → « Ta couleur, ton sac » (Sauge puis Pierre).
- Kit Studio qui repassait en 45 L au changement de couleur → plan 10 = tailles seulement (45 → 60 → 80 L), les couleurs au plan 20.
- Tap sur « Explorateurs du Japon » qui ne mène à rien → plus de tap au plan 17.
- Médias du carnet des Hautes Fagnes sur fond de Chamonix (lu comme le W) → fond neutre aux plans 13–14.

## À régler par le mouvement (build_film.py)
- P1 Légendes ≈ 0,8 s : les poser à barre + 0,35 s ; deuxième ligne du titre dans les 0,3 s.
- P1 Plan 3 : « Chamonix-Mont-Blanc → Chamonix-Mont-Blanc » lisible sous un carnet belge → cadrer la capture pour que ce bandeau ne se lise pas (téléphone agrandi et cadré, comme la messagerie), ou flou de profondeur.
- P1 Gabarit unique (17 plans sur 23 : titre en haut à gauche, téléphone fixe à droite) → 3 ou 4 plans autrement (téléphone en grand, à gauche, ou centré sans titre) : 6, 7, 12, 17 proposés ; l'interface qui agit (défilement, carte qui glisse).
- P2 Anneaux blancs dessinés sur les repères de la carte (13,6–14,5 s) → les retirer.
- P2 Kit Studio : fondu d'une image (deux sacs superposés) → échange flou de 0,13 s.
- P2 Plan 21 → 22 : rectangle noir à angles vifs qui déborde du téléphone → transition propre.
- P2 54,40–54,47 s : 3 images de fond nu avant le badge.
- P2 Globe déjà sur l'Asie pendant que le téléphone montre le Chili ; titre sur le bord du globe.
- P2 Story (plan 13) prévue presque plein cadre.

## Son
−14,2 LUFS, crête −3,7 dBTP, vrai silence 32,85–33,70 s, impact calé sur le badge. À faire : garder 2 ou 3 sons de légende seulement (pop/tic/clic sur des légendes aux plans 4, 8, 9, 15, 19, 20, 21) ; plan 10 : un clic par changement de taille seulement.

## Laissé tel quel (décision)
- « Léa : Le bruit de l'eau… » dans la messagerie : Léa Fontaine est la persona de démonstration (aussi au plan 3, à la story et au compte), pas une personne réelle.
- Pas d'adresse ni de store à la fin : en attente de la confirmation de Tony.
- Club : départs du 8 et du 15 novembre déjà passés ; « Solo » une fraction de seconde dans l'écran intermédiaire du Compas ; carte du suivi en direct pâle : ce sont les vrais écrans.
