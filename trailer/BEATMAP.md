# BEATMAP — LKDV Trailer 60 s

Généré par `node tools/gen-animatic.mjs` depuis `tools/beatmap.mjs` (source unique). Ne pas éditer à la main.

- 120 BPM · temps = 0,5 s (30 images) · croche = 0,25 s (15 images) · double-croche = 0,125 s (7,5 images : arrondir `Math.round(i * 7.5)` depuis l'index, jamais par cumul) · mesure = 2 s
- 60 s · 60 i/s · 3600 images · image n = n / 60 s
- Chocs : 0:06, 0:12, 0:46 · silences d'un demi-temps : 0:11,5, 0:37,0, 0:45,5 · respirations sans interface : 0:12,0–0:12,5, 0:32,5–0:33,0, 0:50

## Hôtes de la composition racine

| id | fichier | début | fin | z | agent | rôle |
| --- | --- | --- | --- | --- | --- | --- |
| `gnd-iceland` | `compositions/gnd-iceland.html` | 10.5 | 30 | 10 | landscape-director A | Plans au sol 01–07 et 22 : mer de nuages, Islande, océan de la bouteille, van, port, Landmannalaugar, rivière chaude, arrivée plage |
| `gnd-relay` | `compositions/gnd-relay.html` | 30 | 44 | 10 | landscape-director B | Plans au sol 07–20 et 23 : feu de camp, K2, Lyon, vue du ciel du Rhône, Bourgogne, mosaïque mondiale, train, sentier |
| `gnd-return` | `compositions/gnd-return.html` | 44 | 47.5 | 10 | landscape-director A | Plan 04 : retour au port, puis arrachement vertical |
| `gnd-finale` | `compositions/gnd-finale.html` | 54 | 58.5 | 10 | landscape-director B | Noir du bouton, plan 21 Norvège, bascule vers le ciel |
| `cosmos` | `compositions/cosmos.html` | 0 | 60 | 20 | cosmos-vfx | Seul contexte WebGL : nébuleuse, système solaire, Terre, descente, voiles de nuages, orbite et traces, convergence du logo, aurore → nébuleuse. Transparent hors de ses plages. |
| `ui-a1` | `compositions/ui-a1.html` | 3.5 | 6.25 | 30 | ui-builder | Barre de saisie IA, mots tapés, pictos, bouton d'envoi |
| `ui-a2` | `compositions/ui-a2.html` | 6 | 12 | 31 | ui-builder | Réticule orbital, altimètre, pile de pictos cochés, chiffres de génération |
| `ui-a3` | `compositions/ui-a3.html` | 13 | 24 | 30 | ui-builder | Hub, bouteille à la mer, colonnes de profil, grille des 38 objets, anneau |
| `ui-a4` | `compositions/ui-a4.html` | 24 | 30 | 30 | ui-builder | Anneau de confiance, double coche, objets connectés, hors réseau, cockpit, alerte vent |
| `ui-a5` | `compositions/ui-a5.html` | 30 | 44 | 30 | ui-builder | Carnet, fil, plongées par l'écran, îlots, kit en éventail, pictos de rafale |
| `ui-a6` | `compositions/ui-a6.html` | 44 | 48 | 30 | ui-builder | Double coche du retour, carnet fermé, 8 écrans en surimpression |
| `ui-a7` | `compositions/ui-a7.html` | 52 | 57 | 30 | ui-builder | Badge final, téléphone du bouton, carte de la nouvelle bouteille |
| `fx` | `compositions/fx.html` | 0 | 60 | 40 | orchestrateur | Flashs des chocs, grain et vignette communs |
| `animatic` | `compositions/animatic.html` | 0 | 60 | 50 | orchestrateur | P1 seulement : timecode, idée de la seconde, témoin de temps. Masqué (data-hidden) au rendu final. |

L'hôte `animatic` n'est pas dans `index.html` : il vit dans `animatic/index.html` (même projet, liens vers `assets/` et `compositions/`).

Le temps local d'une scène = temps du film − début de son hôte.

## Marqueurs

| Temps | Image | Nature | Note |
| --- | --- | --- | --- |
| 0:00,75 | 45 | onde | Onde dans la nébuleuse, début de l'effondrement |
| 0:01,5 | 90 | impact | Naissance du Soleil (flash) — ce point sera le point du logo |
| 0:02,25 | 135 | impact | Impact géant, la Lune s'arrache |
| 0:03 | 180 | logo | Logo dans l'aurore, 0,75 s (3,00–3,75) · signature 3 notes · la pulsation démarre |
| 0:05,5 | 330 | geste | Bouton d'envoi enfoncé, le globe pivote |
| 0:05,9 | 354 | coupe-son | Riser coupé net |
| 0:06 | 360 | choc | CHOC 1 : flash 3 images, le zoom démarre |
| 0:11,5 | 690 | silence | Silence total 11,5–12,0 |
| 0:12 | 720 | choc | CHOC 2 + respiration 1 (12,0–12,5, ralenti 40 %, aucune interface) |
| 0:12,25 | 735 | logo | Logo dans la crête du fjord, filet de lumière, 12,25–12,75 |
| 0:14,25 | 855 | logo | LKDV moulé dans le verre de la bouteille, 14,25–14,75 |
| 0:22 | 1320 | héros | Porte du van : plan le plus long (1 s), ralenti, aucune interface |
| 0:25 | 1500 | logo | Étiquette cousue de la housse de tente, 25,0–25,5 |
| 0:32 | 1920 | plongée | Plongée 1 : traversée de l'écran en 0,5 s |
| 0:32,5 | 1950 | respiration | Respiration 2 (32,5–33,0) : Nora, ralenti, seul le vent |
| 0:35 | 2100 | logo | Crête et soleil levant refont le logo, 35,0–35,75, cadrage de 0:12 |
| 0:36 | 2160 | plongée | Plongée 2, en sortie : la bulle retombe sur le téléphone de Tom (0,25 s) |
| 0:37 | 2220 | silence | Silence 37,0–37,5 puis un seul coup sec |
| 0:38 | 2280 | logo | La trace de Tom épouse le tracé du logo, 38,0–38,5 |
| 0:40 | 2400 | plongée | Plongée 3 (0,25 s) |
| 0:41 | 2460 | rafale | Rafale mondiale en mosaïque : 8 bandes, une par double-croche ; puis train (42,0) et sentier (42,5) en coupes franches voulues |
| 0:45 | 2700 | logo | Logo en creux sur la couverture du carnet, 45,0–46,0 |
| 0:45,5 | 2730 | silence | Silence 45,5–46,0 |
| 0:46 | 2760 | choc | CHOC 3 : arrachement vertical, drop final |
| 0:50 | 3000 | respiration | Respiration 3 : le globe seul |
| 0:51 | 3060 | logo | Les traces convergent et redessinent le tracé du logo, 51,0–52,0 |
| 0:52 | 3120 | logo | Badge complet, 2 s · signature 3 notes |
| 0:54 | 3240 | coupe | Noir sec (coupe franche voulue) : silence 54,0–54,5 |
| 0:54,5 | 3270 | ping | Le téléphone s'allume dans le noir, un seul ping (54,5) |
| 0:59 | 3540 | boucle | L'aurore est redevenue la nébuleuse ; image 3599 ≈ image 0 |

## Seconde par seconde

| T | Acte | Idée unique | Cosmos (WebGL) | Plan au sol | Interface (sans phrases) | Son |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00 | 1 | **Nébuleuse plein cadre, déjà en mouvement** | Nébuleuse 3 couches en parallaxe, caméra vers l'avant ; onde à 0,75 | — | — | Note grave, souffle de chœur |
| 0:01 | 1 | **Le nuage s'effondre en disque, le Soleil naît** | Effondrement en rotation, disque ambre, flash du Soleil à 1,5, sillons | — | — | Riser, impact à 1,5 |
| 0:02 | 1 | **La Terre se forme et refroidit** | Spirale vers l'intérieur, Saturne et Jupiter en flou ; impact lunaire à 2,25 ; lave → océans → continents → vert | — | — | Impact sec à 2,25, montée |
| 0:03 | 1 | **La Terre d'aujourd'hui ; le logo dans l'aurore** | Lumières des villes, lever de soleil ; l'aurore sage trace les montagnes du logo 3,00–3,75 (tracé réel : deux sommets et la base), Soleil sur le limbe = point ; puis l'aurore ondule | — | — | Signature 3 notes ; pulsation |
| 0:04 | 1 | **Quelques mots tapés sur le verre** | La Terre tourne derrière le verre | — | Barre de saisie IA (pilule de verre, ressort 250 ms), avatar L, frappe « Islande · van · 10 jours · 4 » à 40 car./s | Clavier feutré en doubles-croches |
| 0:05 | 1 | **Les mots deviennent des pictos ; envoi** | À 5,5 le globe pivote d'un coup sec et centre l'Islande | — | 4 pastilles-pictos, une par double-croche : map-pin sur l'île, van, calendar « 10 », users ×4 ; bouton send enfoncé à 5,5 ; Spinner | Pops cristallins ; riser coupé net à 5,9 |
| 0:06 | 2 | **CHOC 1 : un point sage tombe sur l'Islande** | Point sage et traînée, zoom exponentiel (log de l'altitude) | — | Les pastilles fusionnent en un point ; réticule : 4 coins qui se verrouillent ; altimètre qui dégringole depuis 408 | Impact + sub, batterie |
| 0:07 | 2 | **La route se trace autour de l'île** | 3 satellites génériques en flou, faisceau ; ligne sage autour de l'île, 9 étapes s'allument | — | Picto route coché dans la pile ; « 1 322 km » | Tick sage |
| 0:08 | 2 | **La météo se peint** | Milliers de traits de vent bleu → sage ; bandes nuageuses | — | Picto météo coché ; frise de 10 pictos sun / cloud / cloud-rain | Vent filtré, tick |
| 0:09 | 2 | **Les nuits s'allument** | Avion générique sous la caméra, sa traînée se confond avec la route ; lueurs ambre aux étapes | — | Picto moon coché ; 7 vans et 2 tentes miniatures | Doppler, tick |
| 0:10 | 2 | **38 objets pleuvent ; le budget se remplit** | 38 silhouettes en pluie d'étoiles filantes ; montgolfière Forest et Paper dorée | 01 (à partir de 10,5, sous le voile) | Picto backpack coché ; barre de budget à 98 % | Cascade de ticks, brûleur |
| 0:11 | 2 | **Plongée dans la mer de nuages ; silence** | Vol d'oies en V ; voile de nuages troué dès 10,75, gouttelettes ; opaque et blanc de 11,5 à 12,0 | 01 mer de nuages et montgolfières (10,75–11,5, sous le voile) | La pile se replie en un point ; grande coche sage 11,0–11,5 ; tout se dissout en particules à 11,5 ; plus rien à 11,75 | Passe-bas ; silence total à 11,5 |
| 0:12 | 3 | **CHOC 2 : le nuage se déchire sur le fjord** | Le voile se déchire en découvrant d'abord la crête (haut du cadre), transparent à 12,5 | 02 Islande, Route 1 : ralenti 40 % 12,0–12,5 ; la crête et le soleil forment le logo, filet de lumière sage 12,25–12,75 ; rampe vers le van 12,5–13,0 | — (respiration 1) | Drop, cordes |
| 0:13 | 3 | **Le Hub du groupe s'ouvre au-dessus du van** | — | 02 | Carte de verre : silhouette de l'île + route + point au tiers ; avatars L, S, I + cercle en pointillés ; 3 anneaux ; capsule de navigation | Ticks |
| 0:14 | 3 | **Le cercle vide devient une bouteille à la mer** | — | 22 océan au crépuscule (poussée avec flou 13,75–14,0 depuis 02, arrivée à 14,0) | Bouteille de verre ; « LKDV » moulé révélé par un reflet 14,25–14,75 ; papier roulé : van + 3 avatars + 1 vide | Vague, bouchon |
| 0:15 | 3 | **La bouteille part ; une bulle revient ; ils sont quatre** | — | 22 ; balayage filé 15,75–16,0 → 03 | 15,0 la bouteille part, sillage = ligne sage, mini-globe de points ; 15,5 la bulle remplit le cercle (H) ; 15,75 balayage ; îlot : avatar H en sage | Glissando, swoosh |
| 0:16 | 3 | **Une colonne de verre par personne** | — | 03 intérieur du van, de dos | 4 colonnes : L snowflake ; S camera, sunrise ; I leaf, « 1 » ; H sneaker | Arpège montant |
| 0:17 | 3 | **Le kit se réordonne ; le trait sage explique** | — | 03 | Trait sage du flocon de Léa au sac de couchage qui monte en tête ; 10 points dont 8 pleins | Ticks |
| 0:18 | 3 | **38 objets : 6 allumés, 32 fantômes** | — | 03 défocalisé | Grille de 38 silhouettes ; « 6 / 38 » | Musique retenue |
| 0:19 | 3 | **Sage, poignée de main : la tente arrive de M** | — | 03 défocalisé | Vague de pastilles sage (handshake) sur les croches 19,0–19,75 ; avatar M ; « 2,1 km » | Pops de la vague sage seule |
| 0:20 | 3 | **Ambre, bleu, Stone : trois vagues** | — | 03 défocalisé | 20,0 recycle ambre (chaussures, sac étanche) ; 20,25 calendar bleu (doudoune) ; 20,5 tag Stone (batterie) ; 20,75 libre | 3 vagues de pops : 20,0 / 20,25 / 20,5 |
| 0:21 | 3 | **La grille est entièrement allumée** | — | 03 défocalisé | Onde de lumière ; « 38 / 38 » | Montée |
| 0:22 | 3 | **HÉROS : la porte du van ouverte sur l'océan** | — | 03 plein cadre, ralenti, 1 s ; étiquettes de couleur physiques sur le matériel, dans le plan (pas d'interface) | — | Grosse caisse, vent |
| 0:23 | 3 | **L'étiquette sage devient un anneau** | — | 03 qui se défocalise ; balayage filé 23,75–24,0 → 04 | Étiquette qui tourne → anneau qui grossit vers la caméra | Riser court |
| 0:24 | 4 | **L'anneau de confiance de Marc se remplit** | — | 04 port, heure ambre, derrière le verre | Tiroir mi-hauteur ; avatar M au centre ; « 96 » ; 12 petites coches sage | Note tenue, chaude |
| 0:25 | 4 | **La tente change de mains** | — | 04 : poussée sur la housse, étiquette cousue au logo 25,0–25,5 ; balayage filé 25,75–26,0 → 03 | Rien de 25,0 à 25,5 ; à 25,5 deux téléphones se touchent, double coche sage, 4 barres à pictos (compass, backpack, feather, handshake), la dernière monte, « +25 » | Double tick, carillon |
| 0:26 | 4 | **Chaque objet émet une onde sage** | — | 03 intérieur, lumière ambre | Une onde sage par croche sur la balise, la montre, la batterie ; pastilles de verre : picto satellite ; « 14,2 km » ; jauge 82 % | Trois pings |
| 0:27 | 4 | **Plus de réseau : la carte reste vivante** | — | 03, cadré sur la porte ouverte et le dehors (poussée continue depuis 26, pas de coupe) ; traversée de l'écran 27,75–28,0 → 05 | Trois fils de lumière vers le téléphone ; wifi-off ; 4 points d'avatars qui bougent toujours sur la carte | Grésillement coupé net |
| 0:28 | 4 | **La trace avance avec les marcheurs** | — | 05 Landmannalaugar ; balayage filé 28,75–29,0 → 06 dans le sens de la marche | Carte en relief dans un tiroir bas ; « 6,8 km », « +412 m » ; picto hot-spring qui pulse | Pas sur gravier |
| 0:29 | 4 | **Le vent arrive : la route se redessine** | — | 06 rivière chaude, ciel qui se charge 29,0–29,5 ; time-lapse 29,5–30,0 → 07 plage, le van se gare | 29,0–29,5 : wind ambre ; ancien tracé en pointillés, nouveau en sage plein ; plus rien à 29,5 | Bourrasque, puis calme |
| 0:30 | 5 | **Le carnet s'écrit tout seul au feu de camp** | — | 07 feu de camp, soleil de minuit | Téléphone en main (Inès) ; page Paper au-dessus de l'écran : photos qui tombent en place, écriture = texture | Crépitement, guitare sèche |
| 0:31 | 5 | **Publié ; le pouce s'arrête sur une photo** | — | 07 | send coché ; carte du fil : avatar N + photo du plan 08 | Tick, swipe |
| 0:32 | 5 | **PLONGÉE 1 : à travers l'écran, chez Nora** | — | 08 Karakoram, K2 : dessous dès 32,25, plein cadre et ralenti à 32,5, Nora minuscule | 32,0–32,5 : la photo de la carte grandit jusqu'à couvrir le cadre (réfraction du verre) ; rien de 32,5 à 33,0 (respiration 2) | Le feu devient vent |
| 0:33 | 5 | **Son kit se déplie en éventail** | — | 08, rampe vers le sac | Éventail de silhouettes aux 4 couleurs ; « 9,8 kg » ; la balise pulse, 2 fils de lumière vers 2 avatars | Cliquetis de bâtons |
| 0:34 | 5 | **Son carnet : 5 pages en 5 flips** | — | 08 | 5 flips (photos 08b : glacier, camp, gué, vallée, crête) ; mini-carte de la trace qui s'allonge | Pages en rythme |
| 0:35 | 5 | **Bras ouverts au sommet ; la crête refait le logo** | — | 08 ralenti 50 %, cadrage de 0:12, la crête et le soleil forment le logo 35,0–35,75 ; balayage vertical 35,75–36,0 → 09 | 35,5 la photo part vers le haut en bulle de verre | Envolée de cordes |
| 0:36 | 5 | **PLONGÉE 2 : la bulle retombe chez Tom** | — | 09 Lyon, bord du Rhône, aube (arrivée du balayage vertical 36,0–36,25) | 36,0–36,25 la bulle retombe sur le téléphone ; îlot : avatar N + vignette du sommet ; picto run, « 5,2 km », pause | Souffle, ville au loin |
| 0:37 | 5 | **Silence ; il sourit, se lève** | — | 09, poussée rapide avec flou 37,0–37,25 (même plan, pas de coupe) | 37,5 pause → play | Silence 37,0–37,5, un coup sec |
| 0:38 | 5 | **Sa trace dessine les montagnes du logo** | — | 23 vue du ciel du Rhône (la caméra s'élève : balayage vertical 37,75–38,0) ; retour 38,75–39,0 → 09 | La trace sage le long du fleuve épouse le tracé du logo 38,0–38,5 ; « 8,0 km » ; barre compass qui monte ; « +40 » | Foulées sur le tempo |
| 0:39 | 5 | **Il partage ; le club montre des vélos** | — | 09 | bike ; grappe de 12 avatars | Tick |
| 0:40 | 5 | **PLONGÉE 3 : le peloton dans les vignes** | — | 10 Bourgogne, automne : dessous dès 40,125, plein cadre à 40,25 | 40,0–40,25 la carte du club grandit jusqu'à couvrir le cadre ; 40,25 « 42 km » et 12 avatars cochés ; 40,5 barre handshake qui monte, « +60 » | Roue libre, rires |
| 0:41 | 5 | **RAFALE : le monde entier** | — | Mosaïque qui se remplit : 8 bandes verticales (horizontales en 9:16), une par double-croche (41,0 / 41,125 / … / 41,875) : 11 Sahara · 12 Amazonie · 13 Uyuni · 14 Baïkal · 15 Raja Ampat · 16 Antelope · 17 Népal · 18 Atacama ; chaque bande entre en coupe franche et garde un lent mouvement ; aucun changement plein cadre | — | Un coup par double-croche (8) |
| 0:42 | 5 | **Tous les voyages, tous les publics** | — | 19 train de nuit (42,0–42,5, coupe franche) · 20 sentier accessible (42,5–43,0, coupe franche) ; balayage filé 42,75–43,0 → 07 | train (42,0) ; wheelchair (42,5) | Un plan par temps |
| 0:43 | 5 | **Inès garde le carnet de Nora, lève les yeux** | — | 07 même cadrage qu'à 0:30 | bookmark qui se remplit | Retour du crépitement |
| 0:44 | 6 | **La tente est rendue, accolade** | — | 04 port, heure ambre (arrivée du balayage 44,0–44,25) | 44,0 deux téléphones se touchent, double coche ; 44,5 l'anneau de Léa gagne un cran, « 88 » → « 91 » | Piano seul |
| 0:45 | 6 | **Le carnet terminé se referme** | — | 04 défocalisé | 44,75 le carnet entre ouvert sur sa dernière page (île, « 1 322 km », grille des 38 objets aux 4 couleurs) ; 45,0 il se referme : couverture Paper, photo du groupe de dos, logo en creux tenu 45,0–46,0 | Accord tenu ; silence à 45,5 |
| 0:46 | 6 | **CHOC 3 : arrachement vertical** | Voile de nuages qui monte (opaque à 47,0) | 04 → vue qui s'éloigne à la verticale | 4 écrans en surimpression, 0,25 s chacun : carte des sentiers · globe des pays · capsule d'étapes du Compas · fiche d'un objet | Drop final, un flash par croche |
| 0:47 | 6 | **À travers les nuages, vers le haut** | Traversée des nuages, sortie en orbite à 48,0 | — | 4 écrans, 0,25 s chacun : messages du groupe · sortie de club · profil et saison · kit en 3D | Souffle inversé |
| 0:48 | 6 | **Les traces du film s'allument sur le globe** | Orbite ; une trace par croche : Islande, Karakoram, Lyon, Bourgogne ; avatar au bout de chaque trace | — | — (avatars dessinés par cosmos, ancrés au globe) | Quatre notes |
| 0:49 | 6 | **Des milliers d'autres traces ; les prêts scintillent** | Traces sage sur tous les continents ; points ambre | — | — | Tutti |
| 0:50 | 6 | **RESPIRATION 3 : le globe seul** | Globe entier, lever de soleil sur le limbe | — | — | Tenue |
| 0:51 | 6 | **Les traces redessinent les montagnes du logo** | Les traces quittent le globe, convergent ; le Soleil vient se placer : le point (logo 1 s) | — | — | Montée finale |
| 0:52 | 7 | **Le badge complet s'assemble** | Terre en fond flouté ; tracé du logo tenu jusqu'à 52,25 | — | Le badge LKDV naît autour du tracé (le sommet du tracé posé sur le sommet du badge), disque masqué en cercle ; seul texte depuis 0:04 : celui du logo | Signature 3 notes, piano seul |
| 0:53 | 7 | **Le logo respire** | Terre en fond flouté | — | Logo seul (pas d'adresse) | Dernier accord |
| 0:54 | 7 | **LE BOUTON : noir sec, un téléphone s'allume** | — | fond encre (54,0–56,5) | Rien de 54,0 à 54,5 ; à 54,5 le téléphone s'allume : îlot avec avatar H + picto bouteille | Silence 54,0–54,5, un ping à 54,5 |
| 0:55 | 7 | **Une nouvelle bouteille : fjord sous l'aurore** | — | fond encre ; 21 dans la carte | Carte de verre : photo, avatars H, S, I, cercle en pointillés | Respiration |
| 0:56 | 7 | **Le pouce touche le cercle : il se remplit** | — | fond encre jusqu'à 57,0 | 56,0 avatar L qui s'allume ; 56,5–57,0 la photo de la carte grandit jusqu'à couvrir le cadre | Tick, la pulsation reprend |
| 0:57 | 7 | **Norvège : l'aurore emplit le ciel** | Gaz d'aurore par-dessus le ciel du plan dès 57,5 | 21 plein cadre, bascule vers le haut | — | Cordes, une mesure |
| 0:58 | 7 | **On monte dans l'aurore** | Voiles d'aurore → voiles de gaz, étoiles | — | — | Le chœur revient |
| 0:59 | 7 | **L'aurore est redevenue la nébuleuse** | Réglages interpolés vers ceux de 0:00 ; image 3599 ≈ image 0 | — | — | Note grave du début |

## Raccords entre fichiers

| Temps | De | Vers | État exact au raccord |
| --- | --- | --- | --- |
| 6,00–6,125 | ui-a1 | ui-a2 + cosmos | ui-a1 fusionne les 4 pastilles en un point sage (rayon 7 px) au centre du cadre à 6,00 et le fait disparaître à 6,125 ; cosmos fait partir son point sage du centre à 6,00 ; le réticule de ui-a2 se verrouille autour du centre. L'altimètre lit LKDV.altitude(t), la même loi que la caméra du globe. |
| 10,5–12,5 | cosmos | gnd-iceland | cosmos peint le voile de nuages au-dessus des plans : 10,75–11,0 le monde vu d'en haut cède au voile troué (plan 01 dessous) ; 11,5–12,0 voile opaque blanc Stone ; 12,0–12,5 déchirure qui découvre d'abord la crête (tiers haut du cadre), puis les bords ; alpha nul à 12,5. gnd-iceland tient le plan 02 en place dès 11,5, immobile à 40 % de vitesse jusqu'à 12,5. |
| 13,75–14,0 | gnd-iceland (02) | gnd-iceland (22) + ui-a3 | Poussée avec flou sur 02 pendant que la carte du Hub grossit autour du cercle vide ; à 14,00 le plan 22 est en place, net, et le cercle est devenu l'ouverture de la bouteille. |
| 15,75–16,0 | gnd-iceland (22) | gnd-iceland (03) + ui-a3 | Balayage filé vers la droite, même vitesse des deux côtés ; l'interface sort dans le même sens. |
| 23,0–24,0 | ui-a3 | ui-a4 | À 24,00 l'anneau est centré en (960, 468), rayon 150 px, trait 14 px sage-500, vide (0 %). ui-a3 l'amène à cet état en fin de slot (23,98) ; ui-a4 part exactement de cet état, pose le tiroir dessous et le remplit à 96 %. Dessous, gnd-iceland passe de 03 à 04 par un balayage filé 23,75–24,0. |
| 27,75–28,0 | ui-a4 + gnd-iceland (03) | gnd-iceland (05) | Traversée de l'écran : la carte du téléphone grandit jusqu'à couvrir le cadre et son relief devient le paysage du plan 05, en place dessous à 27,875. |
| 29,5–30,0 | gnd-iceland | gnd-relay | gnd-iceland finit sur le time-lapse et le plan 07 (plage, van garé) ; gnd-relay ouvre à 30,00 sur le plan 07 cadré feu de camp : même image, même cadrage, vitesse de caméra égale au raccord (pas de coupe visible). |
| 32,0–32,5 | ui-a5 | gnd-relay (08) | PLONGÉE 1. ui-a5 porte sa propre image du plan 08 dans la carte du fil et la fait grandir ; à 32,50 elle couvre exactement le cadre en « cover », centrée sur le point focal du plan (assets/footage/plates.json), puis disparaît. gnd-relay tient le plan 08 dessous dès 32,25, avec ce même cadrage à 32,50. |
| 35,5–36,25 | ui-a5 + gnd-relay (08) | gnd-relay (09) | PLONGÉE 2. La bulle de verre monte (35,5–36,0) pendant un balayage vertical 35,75–36,0 (08 sort par le bas) ; le plan 09 arrive par le haut et se pose à 36,25 pendant que la bulle retombe sur le téléphone. |
| 37,75–39,0 | gnd-relay (09) | gnd-relay (23) | La caméra s'élève : balayage vertical 37,75–38,0 vers la vue du ciel (23) ; retour au sol 38,75–39,0, même sens inversé. |
| 40,0–40,25 | ui-a5 | gnd-relay (10) | PLONGÉE 3. Même règle que la plongée 1, en 0,25 s : l'image du plan 10 portée par la carte du club couvre le cadre en « cover » à 40,25 ; gnd-relay tient le plan 10 dessous dès 40,125. |
| 42,75–44,25 | gnd-relay | gnd-return | Balayage filé 42,75–43,0 vers le plan 07 (même cadrage qu'à 0:30) ; balayage filé vers la gauche 43,75–44,0 (gnd-relay) prolongé 44,0–44,25 par gnd-return sur le plan 04 : même sens, même vitesse. |
| 46,0–48,0 | gnd-return + ui-a6 | cosmos | À 46,00 le carnet tombe hors du cadre ; gnd-return s'éloigne à la verticale 46,0–47,0 (échelle décroissante, flou radial) ; cosmos fait monter le voile de nuages : alpha 0 à 46,25, opaque à 47,0 ; sortie en orbite à 48,0. |
| 51,0–52,25 | cosmos | ui-a7 | À 52,00 le tracé du logo (logo-mark.svg, trait Paper) occupe la boîte LKDV.LOGO_MARK : son sommet le plus haut tombe sur le sommet de la montagne du badge. ui-a7 fait naître le badge (assets/brand/lkdv-badge-1024.png, masque circulaire LKDV.LOGO_BADGE) autour de ce tracé de 52,0 à 52,5 ; cosmos tient le tracé jusqu'à 52,25 puis le fond, et garde la Terre floutée derrière jusqu'à 54,0. Après 52,25 un seul calque porte la montagne : le badge. |
| 54,0 | cosmos + ui-a7 | gnd-finale | Coupe franche voulue : gnd-finale peint un fond encre (ink-900, pas de noir pur) plein cadre de 54,0 à 57,0 ; cosmos devient transparent à 54,0 ; rien à l'image de 54,0 à 54,5. |
| 56,5–57,0 | ui-a7 | gnd-finale | PLONGÉE FINALE. ui-a7 porte sa propre image du plan 21 dans la carte et la fait grandir ; à 57,00 elle couvre le cadre en « cover » sur le point focal du plan, puis l'hôte ui-a7 finit. gnd-finale remplace le fond encre par le plan 21 plein cadre à 57,00 exactement, même cadrage. |
| 57,0–58,5 | gnd-finale | cosmos | gnd-finale bascule vers le haut (le sol sort par le bas) ; cosmos fait entrer le gaz d'aurore par-dessus le ciel : alpha 0 à 57,5, opaque à 58,25. |

## Plans au sol ajoutés au jeu v3

| Fichier | Emploi | Contenu |
| --- | --- | --- |
| `22_ocean_dusk` | 0:14–0:15, fond de la bouteille à la mer | Océan au crépuscule, horizon bas, houle lente, aucun personnage |
| `23_rhone_aerial_dawn` | 0:38, vue du ciel sur le Rhône | Vue à la verticale d'un fleuve et de ses quais à l'aube, brume ambre ; le tracé du logo se pose sur la berge |
| `08b_page_1…5` | 0:34, les 5 pages du carnet de Nora | Petites photos : glacier bleu, camp, rivière à gué, vallée, crête |

## Mouvement des plans au sol

Plans fixes en 2,5D : parallaxe par carte de profondeur, particules, caméra en rampe de vitesse ; gestes = pose atteinte + caméra.

## Éléments d'interface qui durent plus de 1,5 s (prévus par le storyboard)

Le réticule et l'altimètre (6,0–11,5 : instrument de caméra, seul élément inventé), la pile de pictos (7,0–11,0 : un picto de plus par seconde), la grille des 38 objets (18,0–21,75 : change d'état à chaque temps), le suivi de Tom (36,0–39,0 : pause, lecture, distance qui monte). Chacun doit changer visiblement au moins une fois par temps ; aucun autre élément ne reste plus de 1,5 s.
