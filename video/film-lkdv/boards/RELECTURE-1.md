# Relecture 1 du brouillon (17/11/2026) — 5/10

Relecteur indépendant, sur `renders/film-lkdv-brouillon.mp4` (v4). Ce qui est traité où.

## Réglé par le contenu (frames.py v5 + nouvelles captures du 17/11)
- Le carnet touché (8 j) n'était pas le carnet ouvert (5 j) → même carnet partout : « Bivouac dans les Hautes Fagnes », 2 jours, 3 voyageurs (`carnet-semaine.jpg` → `carnet-ouvert.jpg`).
- Club de test « zefezfze » en « Club du mois » → `clubs.jpg` refait, club de test hors cadre.
- « Ton aventure est prête » au-dessus de « Pas encore d'itinéraire » → le plan 06 finit sur `compas-voyage.jpg` (voyage calculé : 5 jours, 61,5 km, photos, tracé).
- « refuge par refuge » démenti (4 nuits sans hébergement) → « Le W, jour par jour ».
- « Prêté » sur « 0 prêt », « Un kit qui a fait ses preuves » sur « 0 % » → plan 09 = groupe + budget réels (4 194 €, 1 398 € par personne) ; plan 19 = « Tes kits, sur-mesure ».
- Plan 14 rejouait la fiche du plan 07 ; plan 13 = carnet du Mont-Blanc → plan 13 = story plein écran (sans titre), plan 14 = médias du carnet.
- Lever de soleil « Publié dans la Communauté » sans publication → pastille retirée.
- Plan 20 répétait le plan 10 (45 L) → « Sa version, en 80 L » (`kit-studio-80.jpg`).
- Globe immobile au plan 22 → globe cuit qui tourne du Chili au Japon (`assets/map/globe-chili-japon.mp4`, 6 s, 1920×1080).
- Adresse « lekitduvoyageur.fr » non confirmée → retirée du plan 23 jusqu'à confirmation de Tony.
- Décors faux (cabane des Tetons, lac de Braies pour le Japon) → fonds changés aux plans 09, 17, 19, 20.
- « Hub », « checklist » → « Départ », « la liste du départ ».
- Suivi en direct en bouillie → `live.jpg` + `video/live.mp4` refaits (carte lisible, chrono, SOS).
- Checklist à moitié floue → `hub-checklist.jpg` refait (feuille presque plein écran, 9 tâches). `hub-disponibilite.jpg` n'est plus utilisé ; `hub-kits.jpg` garde sa moitié haute floue (tiroir fixé à 56 % dans l'app : `HubCampShell.tsx`).

## À régler par le mouvement (build_film.py)
- P0 La phrase du Compas illisible (≈15 px, défile) → la phrase en grand comme titre du plan 05 (`title_size` 68), lisible d'un bloc ≥ 1,5 s.
- P0 Captures coupées sur les côtés (avatars, « éponse rapide », « andonnée ») → chaque capture à la largeur exacte de l'écran, pas de zoom qui rogne les bords.
- P1 Kit Studio sans geste visible → le sac change sur les temps (45 → 60 → 80 L → Sauge → Pierre → Forêt) avec les images `kit-studio-*.jpg` et/ou la vidéo `video/kit-studio.mp4`.
- P1 Montage répétitif (18 volets sur 22 coupes, même gabarit) → volet sur 6 à 8 coupes au plus ; raccords sur le téléphone immobile (07→08, 13→14) ; 1 ou 2 plans sans titre (13, 16) ; entrées de titres variées.
- P1 Titres trop courts à l'écran (0,8–1,3 s) → mots qui entrent dès +0,1 s, tenue ≥ 0,5 s + 0,3 s/mot.
- P1 Fondu à double exposition 16,7–17,0 s (téléphones en transparence sur la carte) → pas de fondu entre deux mondes.
- P1 Deux iris à la fois 11,05–11,15 s, saut de ~30 px du champ → un seul iris.
- P2 Pouce = disque blanc translucide (rond de clic) qui masque le texte → geste plus discret, ne cache pas le texte.
- P2 Téléphone gauche à y≈1045 (hors 90 % de zone sûre) aux plans 1, 7–9, 11, 22 ; « Chili »/« Japon » coupés par la coque.
- P2 Impact 4 images avant que le badge se cale → caler le badge sur l'impact.

## Reste (défauts de l'app, hors film)
- Kit Studio : tout enregistrement refusé en production (« pièce inconnue du catalogue », « Non enregistré · réessaie ») ; l'onglet Corps sélectionne tout seul le 60 L. Les images du film montrent l'état affiché juste après le geste.
- Compas : W proposé avec une étape de 36,2 km, « 4 nuits sans hébergement », étapes numérotées 1-2-4-5.
- Données de démo : « Le lac leman · Amiens », « Catégorie BigBuy », « 39,861 km · +0 m », Hautes Fagnes nommées « Chamonix-Mont-Blanc », clubs à « 0 sortie ce mois ».
- Suivi en direct : la barre de session recouvre les tuiles de mesure.
