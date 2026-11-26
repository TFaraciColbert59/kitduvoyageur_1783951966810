# Bible de style — « La Chaîne »
Film vertical de 30 s pour LKDV (Le Kit du Voyageur) · v2, direction « nerveuse et percutante » demandée par Tony le 17/11/2026.

**Statut** : étape 2 (bible) et étape 3 (musique verrouillée) faites ; étape 4 (storyboard statique) dans `storyboard/`. **Rien n'est animé ni rendu** (l'étape 5 attend ton feu vert).

Sources : `research/REFERENCES.md` (14 références analysées), `research/POTENTIEL-APP.md` (212 fonctions visibles en production, chiffres réels), `research/MUSIQUE.md` + `audio/temps-forts.json` (analyse mathématique de la piste).

---

## 1. Cadrage
| | |
|---|---|
| Public | investisseurs et tout public |
| Durée | **30,000 s** |
| Format | **9:16, 1080 × 1920, 30 i/s** (le favori est à 30 images distinctes par seconde) |
| Langue | français ; aucune voix off, aucun sous-titre ; le texte à l'écran est de la typographie cinétique |
| But | un « wow » : faire sentir la puissance de l'app en suivant un vrai parcours d'utilisateur ; **aucun appel à l'action, aucune adresse** |
| Marque | **pas de logo affiché** ; la marque est **dissimulée** dans des éléments (voir § 6) |
| Musique | « No Church In The Wild » (fournie), retravaillée en 30 s : `audio/musique-30s.wav` |

## 2. L'histoire : « La Chaîne »
Un voyage en déclenche un autre. On suit un vrai parcours à travers les pages principales, et la chaîne passe d'une personne à l'autre :

1. **Léa voit un post** (le W de Torres del Paine, carnet de Maya) → ouvre le **carnet** → touche **« Reprendre le kit »**.
2. Elle écrit à ses amis (**messagerie**) → écrit **une phrase** dans le **Compas** → le globe plonge vers la Patagonie, **le W se trace**, le voyage se monte tout seul (itinéraire, météo réelle, budget, groupe, sac, papiers d'entrée) → son sac prend forme en **vraie 3D** (Kit Studio).
3. **Cassure** : tout se réduit à un point — le point GPS du départ.
4. **Drop** : la montagne en **suivi en direct** (chrono, dénivelé, SOS) ; le **carnet s'écrit** pendant la marche ; elle le **publie** — et ça se propage.
5. **Tom**, ailleurs, le voit. Il lance une **bouteille à la mer** dans un **club**, trois personnes répondent : un groupe naît. Il **reprend le kit de Léa** (lignée : « Kit souche : Léa »). En route, la **story** d'une amie d'un autre groupe annonce une **sortie** sur son parcours → il s'**inscrit** → les deux groupes **se rencontrent** sur la carte.
6. Dézoom brutal : la Terre, couverte de traces. **367 747 lieux · 246 pays · 18 176 400 aventures possibles.** Silence. Tout se replie en **une aiguille de boussole** — et l'image finale.

Chaque lien de cette chaîne existe dans l'app (vérifié dans `POTENTIEL-APP.md` §5), sauf deux raccourcis assumés comme ellipses de montage : le carnet ne porte pas de bouton « refaire ce voyage » (on passe par « Reprendre le kit », qui existe) ; les photos prises en route n'alimentent pas le carnet automatiquement (on montre le carnet qu'on écrit).

## 3. Ton
Nerveux, épique, sombre puis lumineux. **Rien n'est jamais figé** : chaque image a au moins un mouvement de caméra et un élément qui vit. Ça part dans tous les sens, mais **une seule idée lisible à la fois** : le chaos est chorégraphié sur la grille musicale. Trois énergies : **construction** (acte I-II, le pont qui monte) → **implosion** (cassure) → **déflagration** (drop) → **vertige** (le monde) → **coup final**.

## 4. Palette (codes exacts)
| Rôle | Nom | HEX | Source |
|---|---|---|---|
| Fond des actes « interface » | Stone | `#FAF8F5` | jeton `--lkv-stone-50` |
| Fond des actes « préparation » | Forest | `#17402C` | `--lkv-forest-900` |
| Fond de la cassure et de la nuit | Forêt profonde | `#06120C` | `--lkv-forest-950` |
| Accent unique et constant | **Laiton** | `#D0A070` | relevé sur le badge LKDV (lettres et anneau) |
| Accent sombre | Bronze | `#9E7243` | anneau du badge |
| Secondaire | Sage | `#5B7F55` | `--lkv-sage-500` |
| Vert action | Action | `#226148` | `--lkv-action` |
| Alerte (SOS uniquement) | Brique | `#A8443A` | `--lkv-danger` |
| Ombres | Encre | `rgba(11,31,23,α)` | règle de la charte |

Une couleur de fond **pleine par acte** (comme le favori) : Stone (I) → Forest (II) → Forêt profonde (cassure) → photo/carte réelle + Sage (drop) → nuit + satellite (fin). Le **laiton** est le seul accent, présent dans chaque plan (un mot, un point, un trait, un flash). Interdits : `#E4501C`, `#1C2620`, `#A3C4A3`, `#2D6B4A`, `#0B1F17` en aplat, dégradés violets, néons.

## 5. Typographie
| Usage | Police | Graisse | Taille (1080 × 1920) | Interlettrage | Couleur |
|---|---|---|---|---|---|
| **Mot qui claque** | Inter | **900** | 180 à 300 px, jusqu'à 90 % de la largeur | −4 % | Stone sur foncé, Forest sur clair, laiton pour le mot-clé |
| Second plan, contrepoint | EB Garamond italique | 500 | 56 à 84 px (≈ 1/4 du mot) | 0 | Stone / Sage |
| Chiffres qui défilent | Inter 900, chiffres tabulaires | 900 | 140 à 240 px | −2 % | laiton |
| Interface reconstruite | Inter | 600 à 800 | à l'échelle de l'app × 2,5 à 4 | 0 | celles de l'app |

**Règles de claque** (mot par mot ou syllabe par syllabe, toujours sur un temps, une croche 0,323 s ou une double-croche 0,162 s) :
- entrée : échelle **1,45 → 1** en **3 images** avec dépassement à **0,93** puis retour à 1 en 4 images (ressort ζ ≈ 0,42, ω ≈ 30 rad/s), opacité 0 → 1 en **1 image**, **2 images de fantôme** (copie décalée à 35 % d'opacité) ;
- variante « coup de poing » : chute depuis +140 px avec rotation −6° → 0, même ressort ;
- sortie : échelle 1 → 0,82 + flou 10 px en **3 images** (accélérée), ou explosion des lettres (chaque lettre part sur sa trajectoire en 5 images) ;
- **un seul mot plein écran à la fois** ; le point final en laiton ;
- jamais de fondu-montée, jamais de mot qui dérive après s'être posé (il tremble au plus 1 image sur un coup de grosse caisse).

## 6. La marque, dissimulée
Aucun logo plaqué. Le **badge LKDV** (`public/logo.png`, 1024 px, la version la plus aboutie : montagne, boussole, sac, « Le Kit du Voyageur ») n'apparaît **jamais en entier** ; on le **devine** :
- **le sac 3D** porte la vraie pièce cousue « LKDV » (maillage réel) — gros plan à 11,627 s ;
- **la boussole** du badge devient l'aiguille finale (28,140 → 28,448 s) ;
- **l'anneau laiton** du badge s'allume 0,4 s à l'impact final, sous les mots, à 18 % d'opacité ;
- **la montagne du pictogramme** (`logo-mark.svg`) sert d'épingle sur la carte (2,586 s, 15,517 s).

**Vrais logos de marques tierces** : uniquement les services **réellement utilisés en production** (vérifié : `POTENTIEL-APP.md` §7), en SVG officiels propres (Simple Icons, ou le SVG officiel du service) : **OpenStreetMap, MET Norway, NASA, Esri, GeoNames, Wikimedia Commons** (données de la carte, de la météo, des lieux) et **NVIDIA** (l'IA qui lit la phrase). **Exclus** : Garmin, Strava, Suunto, Polar, Wahoo, Apple Health, Stripe, Booking… (code présent mais non branché : les montrer ferait croire à un partenariat). Aucune icône générique : les pictogrammes d'interface sont ceux de l'app.

## 7. Règles de mouvement
**Caméra virtuelle 3D partout** (perspective 1 400 px, origine au centre de l'élément visé) :
- **zoom agressif dans l'interface** : ×1 → ×3,2 en **6 images**, `expo.in`, flou de mouvement radial jusqu'à 18 px à l'image la plus rapide ; on traverse un bouton ou une carte pour entrer dans le plan suivant ;
- **dézoom brusque** : ×3 → ×1 en **5 images** `expo.out` avec dépassement à 0,97 ;
- **rotations légères** : ±4 à 8° en Z, ±10 à 18° en X/Y sur les bentos, jamais au-delà ;
- **parallaxe** : trois plans de profondeur (fond ×0,6, milieu ×1, premier plan ×1,4) ;
- **dérive permanente** : aucune image fixe ; minimum 3 %/s d'échelle ou 30 px/s de translation, la caméra ne s'arrête jamais (sauf le silence de 28,14 s, voulu) ;
- **secousse** sur les impacts majeurs : 4 images, amplitude 14 px puis 6 px, amortie.

**Courbes** : arrivées `expo.out` / ressort ζ 0,4–0,5 ; sorties `power3.in` (40 % plus courtes que l'entrée) ; mouvements de caméra `power4.inOut` ; linéaire seulement pour les compteurs et les tracés à vitesse constante.

**Durées de référence à 30 i/s** (mesurées sur les références) : claque de mot 1 + 2 images ; morph 4 images ; fouet 5 images ; iris/flash 3 à 4 images ; trajectoire en arc 9 images ; explosion 3 images + 4 images de respiration.

**Transitions** (aucune coupe simple ; aucun fondu enchaîné) :
- **whip pan** : 5 images, flou directionnel 40 px, le plan entrant arrive flou et se fixe en 2 images ;
- **match cut** : un élément (photo, tuile, bouton, point) grandit jusqu'à devenir le fond du plan suivant (rayon 32 → 0 px) ;
- **zoom-through** : on plonge dans un élément ;
- **explosion** : l'élément se brise en 8 à 24 éclats (photos, avatars, logos, lettres) qui partent vers la caméra ;
- **implosion** : tout est aspiré vers un point (8 images, `expo.in`) ;
- **iris** depuis un bouton touché ;
- **flash laiton** de 2 images sur le drop et l'impact final.

**Densité** : ≈ 56 changements visuels par minute dans le favori → ici **≈ 44 événements visuels en 30 s** (plus nerveux), dont **22 changements de plan**.

## 8. Musique et grille (étape 3, verrouillée)
- Piste : `audio/musique-30s.wav` (48 kHz, 24 bits, −14 LUFS, crête vraie −2,75 dBTP) — montage de « No Church In The Wild » : 0–5,172 s (source 170,661 s, le beat repart), 5,172–25,862 s (source 139,627 → 160,316 s : sommet du pont, cassure, drop, couplet), 25,862–28,448 s (cassure a cappella + silence), 28,448 s impact final + réverbération jusqu'à 30,000 s.
- **Tempo 92,80 BPM fixe** : 1 temps = **0,646545 s** ; croche 0,323 s ; double-croche 0,162 s ; 1 mesure = 2,586 s. Temps n = n × 0,646545 s ; mesures à 0 · 2,586 · 5,172 · 7,759 · 10,345 · 12,931 · 15,517 · 18,103 · 20,690 · 23,276 · 25,862 · 28,448.
- **Temps forts verrouillés** (extrait de `audio/temps-forts.json`, 204 au total) :

| Film (s) | Nature | Force | Événement visuel verrouillé |
|---|---|---|---|
| 0,000 | impact (retour du beat) | 0,90 | image 0 : dézoom brusque de la photo du post + « UN » |
| 0,657 | caisse claire | 0,82 | double-tap : explosion du cœur |
| 1,282 | grosse caisse | 0,96 | match cut : la photo devient le carnet |
| 3,243 | caisse claire | 0,84 | appui sur « Reprendre le kit » |
| 3,773 | grosse caisse | 0,89 | le bouton explose en objets du kit |
| 5,009 / 5,172 | grosse caisse / raccord | 0,84 / 0,60 | zoom-through dans le « ? » → acte II, premier mot de la phrase |
| 6,452 | grosse caisse | 0,91 | « À 3 » |
| 7,115 | grosse caisse | 0,91 | appui sur la flèche → iris |
| 7,759 | mesure | — | **explosion des logos des sources de données** |
| 9,041 | grosse caisse | 0,92 | budget 4 194 € claque |
| 10,345 | mesure | — | match cut : la tuile « Sac » devient le Kit Studio 3D |
| 10,994 · 11,627 | grosses caisses | 0,81 · 0,81 | les deux modules se clipsent |
| 12,931 | mesure | — | « PRÊT. » |
| **13,577** | **cassure** | 0,90 | **implosion vers le point GPS** |
| 13,955 → 14,255 | quasi-silence | 0,80 | le point seul |
| **15,518** | **DROP** | **1,00** | **flash laiton + carte en direct qui explose** |
| 16,164 · 16,799 · 17,461 | grosses caisses | 0,82–0,92 | une photo tombe sur la carte à chaque coup |
| 18,745 | grosse caisse | 0,89 | appui « Publier » |
| **19,278** | grosse caisse | **1,00** | **explosion des avatars : ça se propage** |
| 20,047 | grosse caisse | 0,81 | la bouteille est lancée |
| 21,344 | caisse claire | 0,85 | « Kit souche : Léa » |
| 23,276 | mesure | — | la story d'une amie surgit |
| **24,565** | **caisse claire** | **1,00** | **les deux groupes se rencontrent : onde de choc** |
| **26,508** | **cassure** | 0,85 | **dézoom brutal vers la Terre** |
| 27,801 | caisse claire | 0,83 | « 18 176 400 » |
| 28,140 → 28,447 | **silence** | 0,80 | tout se fige, se replie en aiguille |
| **28,448** | **IMPACT FINAL** | **1,00** | **l'aiguille claque, l'anneau s'allume, « LÀ OÙ LA CARTE SE TERMINE. »** |

## 9. Les plans (timings à la milliseconde, sur la grille)
Écrans : **interface réelle de l'app**, reconstruite à l'identique en grand (mêmes textes, mêmes chiffres, mêmes pictogrammes, d'après les captures de production) ou extraite des captures ; chiffres réels uniquement. ★ = contenu de démo **à créer dans l'app** avant les captures (carte blanche de Tony) : carnet « Le W » de Maya (photos libres Wikimedia Commons, crédits), compte de Tom, sa bouteille à la mer dans un club, sa lignée de kit depuis celui de Léa, la story et la sortie.

| # | Début → fin (s) | Calé sur | Visuel (ce qu'on voit, ce qui bouge, la caméra) | Texte à l'écran | Transition de sortie |
|---|---|---|---|---|---|
| **ACTE I · L'ÉTINCELLE** — fond Stone `#FAF8F5`, encre Forest | | | | | |
| 01 | 0,000 → 0,647 | impact 0,000 | **Accroche, image 0 pleine** : la photo du post (lever de soleil sur les Torres) remplit l'écran à ×2,6 et **recule brutalement** (5 images, `expo.out`, dépassement 0,97) dans sa carte de post (fil Communauté réel), inclinée de 8° qui se redresse ; deux autres posts glissent en parallaxe au-dessus et en dessous | « UN » claque à 0,000, « POST. » à 0,323 (point laiton) | — |
| 02 | 0,647 → 1,282 | caisse claire 0,657 | **Double-tap** : cœur laiton qui explose en 12 éclats ; compteur ♥ qui défile 1 → **1 284** ; secousse 4 images ; caméra qui pousse de 4 % | compteur | match cut |
| 03 | 1,282 → 2,586 | grosse caisse 1,282 | **Match cut** : la photo grandit (rayon 32 → 0) et devient le fond du **carnet** de Maya ★ ; les tuiles réelles du carnet (J1 → J5, km, D+, équipage) arrivent en bento 3D (rotation X 14°, parallaxe 3 plans), une par croche | « 5 JOURS » claque à 1,940 (laiton) | zoom-through |
| 04 | 2,586 → 3,879 | mesure 2,586 ; caisse claire 3,243 ; grosse caisse 3,773 | **Zoom agressif** ×3,2 dans le tiroir « Sac » du carnet : verdicts réels (« essentiel », « utile ») qui défilent ; la caméra pique sur **« Reprendre le kit »** : appui à 3,243 (écrasement 0,9) → à 3,773 le bouton **explose** en 10 puces d'objets qui volent vers la caméra ; l'épingle-montagne (pictogramme) traverse le cadre | — | whip pan vers le haut |
| 05 | 3,879 → 5,172 | croches | **Messagerie** réelle : la bulle de Léa claque mot par mot « On / le / fait / ? » (3,879 · 4,202 · 4,526 · 4,849) ; deux avatars répondent en ressort (« Go » · « J'en suis ») ; à 5,009 la caméra plonge dans le « ? » | les mots de la bulle | zoom-through vers Forest |
| **ACTE II · UNE PHRASE** — fond Forest `#17402C`, texte Stone, accent laiton | | | | | |
| 06 | 5,172 → 7,112 | raccord 5,172 ; 5,819 ; 6,452 | **Le Compas**, barre de saisie réelle géante qui traverse le cadre en diagonale (rotation −6°) : la phrase claque par blocs **sur les temps** : « LE W » (5,172) · « 5 JOURS » (5,819) · « À 3 » (6,452) · « FIN NOVEMBRE » (6,788) ; la pastille **NVIDIA** (l'IA qui lit) s'allume dans le coin à 6,465 ; caméra qui avance en continu | la phrase | appui flèche 7,115 → **iris** |
| 07 | 7,112 → 8,405 | grosse caisse 7,115 ; mesure 7,759 | **Iris** depuis la flèche → **vrai globe satellite** qui plonge vers la Patagonie (1,3 s, très rapide) ; à **7,759 explosion des logos réels** des sources (OpenStreetMap, MET Norway, NASA, Esri, GeoNames, Wikimedia) qui jaillissent du globe en couronne et partent hors cadre en 8 images ; le **W se trace** (sentier OpenStreetMap réel, 4 étapes) de 7,9 à 8,4 | « LE W » en Garamond italique sur la carte | dézoom brusque |
| 08 | 8,405 → 10,345 | croches ; grosse caisse 9,041 | **Bento du voyage** : dézoom brusque, la carte devient une tuile et les autres claquent autour, une par croche, en perspective (rotation Y 16° qui balaye) : **61,5 km** · **Averses 4–8°** (MET Norway) · **4 194 €** (compteur, claque à 9,041) · **3 voyageurs** · **2,9 kg** · **Papiers ✓** ; la caméra survole la mosaïque | les chiffres des tuiles | **match cut** : la tuile « 2,9 kg » devient le fond |
| 09 | 10,345 → 12,931 | mesure 10,345 ; grosses caisses 10,994 · 11,627 ; temps 12,284 | **Kit Studio, vraie 3D** (maillages publiés) sur fond Forest : le sac LKDV ONE 45 L tourne vite (orbite qui décélère) ; **M04** se clipse à 10,994, **M13** à 11,627 (gros plan sur la pièce cousue **LKDV** à 11,627) ; le corps passe **45 → 60 L** à 12,284 ; secousse sur chaque clip | « TON » (10,345) « SAC. » (10,668) ; Garamond : « 1 244 sacs possibles » | — |
| 10 | 12,931 → 13,577 | mesure 12,931 | **« PRÊT. »** plein écran en laiton, secousse ; derrière, la tuile réelle « Prêt à partir » | « PRÊT. » | **implosion** |
| **CASSURE** — fond Forêt profonde `#06120C` | | | | | |
| 11 | 13,577 → 14,224 | cassure 13,577 ; silence 13,955 | **Implosion** : tout est aspiré en 8 images vers **un point laiton** (le point GPS) ; pendant le quasi-silence, le point seul, net, et une ligne fine qui naît | — | — |
| 12 | 14,224 → 15,517 | nappe qui monte | La **trace** s'allonge dans le noir, la caméra accélère derrière elle ; lettres qui claquent en double-croches, crescendo : « E-N-R-O-U-T-E » (14,870 → 15,355) | « EN ROUTE » | **flash laiton 2 images** |
| **ACTE III · LE DROP** — carte réelle, Sage et Stone | | | | | |
| 13 | 15,517 → 16,810 | **DROP 15,518** ; 16,164 | **Déflagration** : flash, puis la **carte 3D réelle** (Explorer, relief) explose en plein cadre avec la trace qui file ; les tuiles du **suivi en direct** claquent (chrono qui défile, D+, vitesse, **SOS** brique) ; rotation Z 8° et zoom ×1,3 sur 16,164 | chrono | — |
| 14 | 16,810 → 18,103 | grosses caisses 16,799 · 17,461 · 18,103 | **Le carnet s'écrit** : à chaque coup une photo réelle tombe sur la carte à sa position puis se replie en carte de jour (J1 · J2 · J3) qui s'empile | « UN RÉCIT. » (17,457) | whip pan vers le haut |
| 15 | 18,103 → 19,396 | 18,745 ; **19,278** | Appui **« Publier »** à 18,745 ; le carnet vole dans le **fil Communauté** ; compteurs ♥ et partages qui défilent ; à **19,278 explosion de 16 avatars réels** (comptes de démo) | « PUBLIÉ. » | zoom-through dans un avatar |
| **ACTE IV · LA CHAÎNE** | | | | | |
| 16 | 19,396 → 20,690 | 20,047 ; double-croches | **Tom** ★ (ailleurs) : dans un **club** réel, il lance une **bouteille à la mer** ★ — la carte-bouteille part en arc (9 images, rotation 360°) à 20,047 ; trois réponses claquent en ressort | « BOU-TEILLE À LA MER. » syllabe par syllabe | match cut sur le groupe |
| 17 | 20,690 → 22,629 | mesure 20,690 ; caisse claire 21,344 | Les trois avatars se soudent en **groupe** ; la tuile **lignée** ★ claque : « **Kit souche : Léa · génération 2** » (21,344) puis « Reprendre ce kit » ; replay éclair du Compas (phrase → carte en 6 images) | « KIT SOUCHE : LÉA » | whip pan à droite |
| 18 | 22,629 → 24,565 | mesure 23,276 ; 23,922 | En route : la **story** ★ d'une amie d'un autre groupe surgit plein écran (anneau laiton) : « Sortie demain 5 h · mirador » ; appui « S'inscrire » à 23,922 ; sur la carte, **deux points** (Forest et laiton) accélèrent l'un vers l'autre | « S'INSCRIRE » | — |
| 19 | 24,565 → 25,862 | **caisse claire 24,565** ; 24,904 ; 25,290 | **Rencontre** : collision des deux points → **onde de choc** blanche 2 images + éclats de photos ; secousse maximale | « UNE » (24,565) « RENCONTRE. » (24,904) | **dézoom brutal** |
| **ACTE V · LE MONDE** — nuit, satellite réel | | | | | |
| 20 | 25,862 → 28,140 | **cassure 26,508** ; 27,155 ; 27,801 | Du point de rencontre à **la Terre** en 0,65 s ; le globe réel tourne vite et **s'allume de milliers de points** (les vrais lieux : 367 747) ; les chiffres réels claquent | « 367 747 LIEUX » (26,508) · « 246 PAYS » (27,155) · « 18 176 400 AVENTURES » (27,801) | — |
| 21 | 28,140 → 28,448 | **silence** | **Tout se fige** (seul arrêt du film) puis se replie en **aiguille de boussole** laiton (celle du badge) | — | — |
| 22 | 28,448 → 30,000 | **IMPACT FINAL 28,448** | L'aiguille **claque** et se cale (ressort, 8 images), l'**anneau du badge** s'allume 0,4 s en laiton à 18 % ; les mots finaux claquent et **tiennent ≥ 1,2 s** ; caméra qui pousse de 2 % jusqu'à la fin | « LÀ OÙ LA CARTE » (28,448) / « SE TERMINE. » (28,771) | fin à 30,000 (la réverbération s'éteint) |

## 10. Faisabilité et honnêteté
- **Tout est vrai** : écrans de l'app (reconstruits à l'identique ou extraits), chiffres lus en base ou dans le code, carte satellite et sentier réels, 3D réelle, logos des seuls services utilisés.
- ★ **À créer dans le compte de démo** avant les captures (étape 5) : carnet « Le W » de Maya (photos Wikimedia Commons libres, crédits en fin de dossier), Tom, sa bouteille à la mer et son club, la lignée « Kit souche : Léa », la story et la sortie. Les lignées n'ont jamais servi en production : on en crée une vraie.
- **À ne pas montrer** : le Kit Studio n'enregistre pas en production (on filme la 3D) ; le paiement n'est pas branché ; SOS filmé en mode simulé (`window.__xpSimulateSos = true`), jamais un vrai appel.
- **Droits** : la musique est commerciale ; une licence de synchronisation est à prévoir avant toute diffusion publique (réseaux), à ta charge. Les logos tiers restent la propriété de leurs marques.
