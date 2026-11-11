# BEATMAP — LKDV Trailer 60 s

Généré par `node tools/gen-animatic.mjs` depuis `tools/beatmap.mjs` (source unique). Ne pas éditer à la main.

- 120 BPM · temps = 0,5 s (30 images) · croche = 0,25 s (15 images) · double-croche = 0,125 s (7,5 images : arrondir `Math.round(i * 7.5)` depuis l'index, jamais par cumul) · mesure = 2 s
- 60 s · 60 i/s · 3600 images · image n = n / 60 s
- Chocs : 0:06, 0:12, 0:46 · silences d'un demi-temps : 0:11,5, 0:37,0, 0:45,5 · respirations sans interface : 0:12,0–0:12,5, 0:32,5–0:33,0, 0:50

## Hôtes de la composition racine

| id | fichier | début | fin | z | agent | rôle |
| --- | --- | --- | --- | --- | --- | --- |
| `gnd-iceland` | `compositions/gnd-iceland.html` | 10.5 | 30 | 10 | landscape-director A | Plans au sol 01–07 : mer de nuages, Islande, van, port, Landmannalaugar, rivière chaude, arrivée plage |
| `gnd-relay` | `compositions/gnd-relay.html` | 30 | 44 | 10 | landscape-director B | Plans au sol 07–20 : feu de camp, K2, Lyon, Bourgogne, rafale mondiale, train, sentier |
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

Le temps local d'une scène = temps du film − début de son hôte.

## Marqueurs

| Temps | Image | Nature | Note |
| --- | --- | --- | --- |
| 0:00,75 | 45 | onde | Onde dans la nébuleuse, début de l'effondrement |
| 0:01,5 | 90 | impact | Naissance du Soleil (flash) — ce point sera le point du logo |
| 0:02,25 | 135 | impact | Impact géant, la Lune s'arrache |
| 0:03 | 180 | logo | Logo dans l'aurore, 0,75 s (3,00–3,75) · signature 3 notes · la pulsation démarre |
| 0:05,5 | 330 | geste | Bouton d'envoi enfoncé, le globe pivote |
| 0:05,9000000000000004 | 354 | coupe-son | Riser coupé net |
| 0:06 | 360 | choc | CHOC 1 : flash 3 images, le zoom démarre |
| 0:11,5 | 690 | silence | Silence total 11,5–12,0 |
| 0:12 | 720 | choc | CHOC 2 + respiration 1 (12,0–12,5, ralenti 40 %, aucune interface) · logo dans la crête 0,5 s |
| 0:14 | 840 | logo | LKDV moulé dans le verre de la bouteille, 0,5 s |
| 0:22 | 1320 | héros | Porte du van : plan le plus long (1 s), ralenti, aucune interface |
| 0:25 | 1500 | logo | Étiquette cousue de la housse de tente, 0,5 s |
| 0:32 | 1920 | plongée | Plongée 1 : traversée de l'écran en 0,5 s |
| 0:32,5 | 1950 | respiration | Respiration 2 (32,5–33,0) : Nora, ralenti, seul le vent |
| 0:35 | 2100 | logo | Crête et soleil levant refont le logo, 0,75 s, cadrage de 0:12 |
| 0:36 | 2160 | plongée | Plongée 2, en sortie : la bulle retombe sur le téléphone de Tom (0,25 s) |
| 0:37 | 2220 | silence | Silence 37,0–37,5 puis un seul coup sec |
| 0:38 | 2280 | logo | La trace de Tom épouse la ligne des montagnes, 0,5 s |
| 0:40 | 2400 | plongée | Plongée 3 (0,25 s) |
| 0:41 | 2460 | rafale | Rafale mondiale : plans 11 à 18, coupes franches voulues |
| 0:45 | 2700 | logo | Logo en creux sur la couverture du carnet, 1 s |
| 0:45,5 | 2730 | silence | Silence 45,5–46,0 |
| 0:46 | 2760 | choc | CHOC 3 : arrachement vertical, drop final |
| 0:50 | 3000 | respiration | Respiration 3 : le globe seul |
| 0:51 | 3060 | logo | Les traces convergent et redessinent les montagnes, 1 s |
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
| 0:03 | 1 | **La Terre d'aujourd'hui ; le logo dans l'aurore** | Lumières des villes, lever de soleil ; aurore sage = 3 montagnes 3,00–3,75, Soleil sur le limbe = point ; puis l'aurore ondule | — | — | Signature 3 notes ; pulsation |
| 0:04 | 1 | **Quelques mots tapés sur le verre** | La Terre tourne derrière le verre | — | Barre de saisie IA (pilule de verre, ressort 250 ms), avatar L, frappe « Islande · van · 10 jours · 4 » à 40 car./s | Clavier feutré en doubles-croches |
| 0:05 | 1 | **Les mots deviennent des pictos ; envoi** | À 5,5 le globe pivote d'un coup sec et centre l'Islande | — | 4 pastilles-pictos, une par double-croche : map-pin sur l'île, van, calendar « 10 », users ×4 ; bouton send enfoncé à 5,5 ; Spinner | Pops cristallins ; riser coupé net à 5,9 |
| 0:06 | 2 | **CHOC 1 : un point sage tombe sur l'Islande** | Point sage et traînée, zoom exponentiel (log de l'altitude) | — | Les pastilles fusionnent en un point ; réticule : 4 coins qui se verrouillent ; altimètre qui dégringole depuis 408 | Impact + sub, batterie |
| 0:07 | 2 | **La route se trace autour de l'île** | 3 satellites génériques en flou, faisceau ; ligne sage autour de l'île, 9 étapes s'allument | — | Picto route coché dans la pile ; « 1 322 km » | Tick sage |
| 0:08 | 2 | **La météo se peint** | Milliers de traits de vent bleu → sage ; bandes nuageuses | — | Picto météo coché ; frise de 10 pictos sun / cloud / cloud-rain | Vent filtré, tick |
| 0:09 | 2 | **Les nuits s'allument** | Avion générique sous la caméra, sa traînée se confond avec la route ; lueurs ambre aux étapes | — | Picto moon coché ; 7 vans et 2 tentes miniatures | Doppler, tick |
| 0:10 | 2 | **38 objets pleuvent ; le budget se remplit** | 38 silhouettes en pluie d'étoiles filantes ; montgolfière Forest et Paper dorée | 01 (à partir de 10,5, sous le voile) | Picto backpack coché ; barre de budget à 98 % | Cascade de ticks, brûleur |
| 0:11 | 2 | **Plongée dans la mer de nuages ; silence** | Vol d'oies en V ; voile de nuages, gouttelettes ; opaque et blanc de 11,5 à 12,0 | 01 mer de nuages et montgolfières (11,0–11,5) | La pile se replie en un point ; grande coche sage 0,5 s ; tout se dissout en particules à 11,5 | Passe-bas ; silence total à 11,5 |
| 0:12 | 3 | **CHOC 2 : le nuage se déchire sur le fjord** | Le voile se déchire (alpha), transparent à 12,5 | 02 Islande, Route 1 : ralenti 40 % 12,0–12,5, logo dans la crête 0,5 s (filet de lumière), rampe vers le van | — (respiration 1) | Drop, cordes |
| 0:13 | 3 | **Le Hub du groupe s'ouvre au-dessus du van** | — | 02 | Carte de verre : silhouette de l'île + route + point au tiers ; avatars L, S, I + cercle en pointillés ; 3 anneaux ; capsule de navigation | Ticks |
| 0:14 | 3 | **Le cercle vide devient une bouteille à la mer** | — | 02 défocalisé → océan au crépuscule (fond de 02 ou 07) | Bouteille de verre, « LKDV » moulé révélé par un reflet 0,5 s ; papier roulé : van + 3 avatars + 1 vide | Vague, bouchon |
| 0:15 | 3 | **La bouteille part ; une bulle revient ; ils sont quatre** | — | balayage filé → 03 | Sillage = ligne sage ; mini-globe de points ; la bulle remplit le cercle ; îlot : avatar H en sage | Glissando, swoosh |
| 0:16 | 3 | **Une colonne de verre par personne** | — | 03 intérieur du van, de dos | 4 colonnes : L cloud-snow ; S (appareil photo), sunrise ; I leaf, « 1 » ; H footprints | Arpège montant |
| 0:17 | 3 | **Le kit se réordonne ; le trait sage explique** | — | 03 | Trait sage du flocon de Léa au sac de couchage qui monte en tête ; 10 points dont 8 pleins | Ticks |
| 0:18 | 3 | **38 objets : 6 allumés, 32 fantômes** | — | 03 défocalisé | Grille de 38 silhouettes ; « 6 / 38 » | Musique retenue |
| 0:19 | 3 | **Sage, poignée de main : la tente arrive de M** | — | 03 défocalisé | Vague de pastilles sage (handshake) ; avatar M ; « 2,1 km » | Pop par pastille |
| 0:20 | 3 | **Ambre, bleu, Stone : trois vagues** | — | 03 défocalisé | recycle ambre (chaussures, sac étanche) ; calendar bleu (doudoune) ; tag Stone (batterie) | Pops en cascade |
| 0:21 | 3 | **La grille est entièrement allumée** | — | 03 défocalisé | Onde de lumière ; « 38 / 38 » | Montée |
| 0:22 | 3 | **HÉROS : la porte du van ouverte sur l'océan** | — | 03 plein cadre, ralenti, 1 s | — (étiquettes de couleur discrètes sur le matériel, sans texte) | Grosse caisse, vent |
| 0:23 | 3 | **L'étiquette sage devient un anneau** | — | 03 → flou | Étiquette qui tourne → anneau qui grossit vers la caméra | Riser court |
| 0:24 | 4 | **L'anneau de confiance de Marc se remplit** | — | 04 port, heure ambre, derrière le verre | Tiroir mi-hauteur ; avatar M au centre ; « 96 » ; 12 petites coches sage | Note tenue, chaude |
| 0:25 | 4 | **La tente change de mains** | — | 04 gros plan sur la remise ; étiquette cousue au logo 0,5 s | Deux téléphones se touchent : double coche sage ; 4 barres à pictos (compass, backpack, plume, handshake), la dernière monte ; « +25 » | Double tick, carillon |
| 0:26 | 4 | **Chaque objet émet une onde sage** | — | 03 intérieur, lumière ambre | Une onde sage par croche sur la balise, la montre, la batterie ; pastilles de verre : picto satellite ; « 14,2 km » ; jauge 82 % | Trois pings |
| 0:27 | 4 | **Plus de réseau : la carte reste vivante** | — | 03 / 06 | Trois fils de lumière vers le téléphone ; wifi-off ; 4 points d'avatars qui bougent toujours sur la carte | Grésillement coupé net |
| 0:28 | 4 | **La trace avance avec les marcheurs** | — | 05 Landmannalaugar | Carte en relief dans un tiroir bas ; « 6,8 km », « +412 m » ; picto source chaude qui pulse | Pas sur gravier |
| 0:29 | 4 | **Le vent arrive : la route se redessine** | — | 06 rivière chaude, ciel qui se charge → time-lapse 0,5 s → 07 plage | wind ambre ; ancien tracé en pointillés, nouveau en sage plein | Bourrasque, puis calme |
| 0:30 | 5 | **Le carnet s'écrit tout seul au feu de camp** | — | 07 feu de camp, soleil de minuit | Page Paper : photos qui tombent en place, écriture = texture | Crépitement, guitare sèche |
| 0:31 | 5 | **Publié ; le pouce s'arrête sur une photo** | — | 07 | send coché ; carte du fil : avatar N + photo du plan 08 | Tick, swipe |
| 0:32 | 5 | **PLONGÉE 1 : à travers l'écran, chez Nora** | — | 08 Karakoram, K2 : traversée 32,0–32,5 (réfraction), ralenti, Nora minuscule | — (respiration 2 : 32,5–33,0) | Le feu devient vent |
| 0:33 | 5 | **Son kit se déplie en éventail** | — | 08, rampe vers le sac | Éventail de silhouettes aux 4 couleurs ; « 9,8 kg » ; la balise pulse, 2 fils de lumière vers 2 avatars | Cliquetis de bâtons |
| 0:34 | 5 | **Son carnet : 5 pages en 5 flips** | — | 08 (fonds de pages tirés des plans disponibles) | 5 flips ; mini-carte de la trace qui s'allonge | Pages en rythme |
| 0:35 | 5 | **Bras ouverts au sommet ; la crête refait le logo** | — | 08 ralenti 50 %, cadrage de 0:12, logo 0,75 s | La photo part vers le haut en bulle de verre | Envolée de cordes |
| 0:36 | 5 | **PLONGÉE 2 : la bulle retombe chez Tom** | — | 09 Lyon, bord du Rhône, aube | Îlot : avatar N + vignette du sommet ; picto course, « 5,2 km », pause | Souffle, ville au loin |
| 0:37 | 5 | **Silence ; il sourit, se lève** | — | 09 plan serré | pause → play | Silence 37,0–37,5, un coup sec |
| 0:38 | 5 | **Sa trace dessine les montagnes du logo** | — | 09 vue du ciel (trace sur le fleuve, 0,5 s) | « 8,0 km » ; barre compass qui monte ; « +40 » | Foulées sur le tempo |
| 0:39 | 5 | **Il partage ; le club montre des vélos** | — | 09 | bike ; grappe de 12 avatars | Tick |
| 0:40 | 5 | **PLONGÉE 3 : le peloton dans les vignes** | — | 10 Bourgogne, automne (traversée 0,25 s) | 12 avatars cochés ; « 42 km » ; barre handshake qui monte ; « +60 » | Roue libre, rires |
| 0:41 | 5 | **RAFALE : le monde entier** | — | 11 Sahara · 12 Amazonie · 13 Uyuni · 14 Baïkal · 15 Raja Ampat · 16 Antelope · 17 Népal · 18 Atacama — 0,125 s chacun (double-croche) | — | Un coup par double-croche |
| 0:42 | 5 | **Tous les voyages, tous les publics** | — | 19 train de nuit (42,0–42,5) · 20 sentier accessible (42,5–43,0) | train ; picto accessibilité | Un plan par temps |
| 0:43 | 5 | **Inès garde le carnet de Nora, lève les yeux** | — | 07 même cadrage qu'à 0:30 | bookmark qui se remplit | Retour du crépitement |
| 0:44 | 6 | **La tente est rendue, accolade** | — | 04 port, heure ambre | Double coche ; l'anneau de Léa gagne un cran, « 88 » → « 91 » | Piano seul |
| 0:45 | 6 | **Le carnet terminé se referme** | — | 04 défocalisé | Couverture Paper, logo en creux 1 s ; au dos : île, « 1 322 km », grille des 38 objets | Accord tenu ; silence à 45,5 |
| 0:46 | 6 | **CHOC 3 : arrachement vertical** | Voile de nuages qui monte (opaque à 47,0) | 04 → vue qui s'éloigne à la verticale | 4 écrans en surimpression, 0,25 s chacun : carte des sentiers · globe des pays · capsule d'étapes du Compas · fiche d'un objet | Drop final, un flash par croche |
| 0:47 | 6 | **À travers les nuages, vers le haut** | Traversée des nuages, sortie en orbite à 48,0 | — | 4 écrans, 0,25 s chacun : messages du groupe · sortie de club · profil et saison · kit en 3D | Souffle inversé |
| 0:48 | 6 | **Les traces du film s'allument sur le globe** | Orbite ; une trace par croche : Islande, Karakoram, Lyon, Bourgogne ; avatar au bout de chaque trace | — | — (avatars dessinés par cosmos, ancrés au globe) | Quatre notes |
| 0:49 | 6 | **Des milliers d'autres traces ; les prêts scintillent** | Traces sage sur tous les continents ; points ambre | — | — | Tutti |
| 0:50 | 6 | **RESPIRATION 3 : le globe seul** | Globe entier, lever de soleil sur le limbe | — | — | Tenue |
| 0:51 | 6 | **Les traces redessinent les montagnes du logo** | Les traces quittent le globe, convergent ; le Soleil vient se placer : le point (logo 1 s) | — | — | Montée finale |
| 0:52 | 7 | **Le badge complet s'assemble** | Terre en fond flouté | — | Badge LKDV autour des montagnes (seul texte depuis 0:04) | Signature 3 notes |
| 0:53 | 7 | **Le logo respire** | Terre en fond flouté | — | Logo seul (pas d'adresse) | Dernier accord |
| 0:54 | 7 | **LE BOUTON : noir sec, un téléphone s'allume** | — | fond encre (54,0–56,5) | Rien de 54,0 à 54,5 ; à 54,5 le téléphone s'allume : îlot avec avatar H + picto bouteille | Silence 54,0–54,5, un ping à 54,5 |
| 0:55 | 7 | **Une nouvelle bouteille : fjord sous l'aurore** | — | 21 dans la carte | Carte de verre : photo, avatars H, S, I, cercle en pointillés | Respiration |
| 0:56 | 7 | **Le pouce touche le cercle : il se remplit** | — | 21 s'agrandit, plongée | Avatar L qui s'allume | Tick, la pulsation reprend |
| 0:57 | 7 | **Norvège : l'aurore emplit le ciel** | Gaz d'aurore par-dessus le ciel du plan dès 57,5 | 21 plein cadre, bascule vers le haut | — | Cordes, une mesure |
| 0:58 | 7 | **On monte dans l'aurore** | Voiles d'aurore → voiles de gaz, étoiles | — | — | Le chœur revient |
| 0:59 | 7 | **L'aurore est redevenue la nébuleuse** | Réglages interpolés vers ceux de 0:00 ; image 3599 ≈ image 0 | — | — | Note grave du début |

## Raccords entre fichiers

| Temps | De | Vers | État exact au raccord |
| --- | --- | --- | --- |
| 6,00–6,25 | ui-a1 | ui-a2 + cosmos | ui-a1 fusionne les 4 pastilles en un point sage (rayon 7 px) au centre (960, 540) à 6,00 et le fait disparaître à 6,125 ; cosmos fait partir son point sage de (960, 540) à 6,00 ; le réticule de ui-a2 se verrouille autour de (960, 540). |
| 10,5–12,5 | cosmos | gnd-iceland | cosmos peint le voile de nuages au-dessus des plans : 10,9–11,1 le monde vu d'en haut cède au voile troué (plan 01 dessous) ; 11,5–12,0 voile opaque blanc Stone ; 12,0–12,5 déchirure du centre vers les bords ; alpha nul à 12,5. gnd-iceland tient le plan 02 en place dès 11,5. |
| 23,0–24,0 | ui-a3 | ui-a4 | À 24,00 l'anneau est centré en (960, 468), rayon 150 px, trait 14 px sage-500, vide (0 %). ui-a3 l'amène à cet état en fin de slot (23,98) ; ui-a4 part exactement de cet état, pose le tiroir dessous et le remplit à 96 %. |
| 29,5–30,0 | gnd-iceland | gnd-relay | gnd-iceland finit sur le plan 07 (plage, van garé) en balayage filé vers la droite ; gnd-relay ouvre sur le plan 07 cadré feu de camp, même sens de balayage, vitesse égale. |
| 43,5–44,0 | gnd-relay | gnd-return | Balayage filé vers la gauche (retour) ; vitesse et sens identiques des deux côtés. |
| 46,0–48,0 | gnd-return | cosmos | gnd-return s'éloigne à la verticale 46,0–47,0 (échelle décroissante, flou) ; cosmos fait monter le voile de nuages : alpha 0 à 46,25, opaque à 47,0 ; sortie en orbite à 48,0. |
| 51,0–52,0 | cosmos | ui-a7 | À 52,00 les montagnes du logo (logo-mark.svg, viewBox 32) occupent la boîte LKDV.LOGO_MARK (centre 960, 520 ; largeur 420 px) en trait Paper. ui-a7 fait naître le badge (assets/brand/lkdv-badge-1024.png, masque circulaire) autour de cette boîte ; cosmos garde la Terre floutée derrière jusqu'à 54,0. |
| 54,0 | cosmos + ui-a7 | gnd-finale | Coupe franche voulue : gnd-finale peint un fond encre (ink-900, pas de noir pur) plein cadre de 54,0 à 56,5 ; cosmos devient transparent à 54,0. |
| 56,0–57,0 | ui-a7 | gnd-finale | La photo de la carte (plan 21) grandit jusqu'à couvrir le cadre à 57,0 ; ui-a7 tient la carte, gnd-finale tient le plan plein cadre dessous avec le même cadrage à 57,0. |
| 57,0–58,5 | gnd-finale | cosmos | gnd-finale bascule vers le haut (le sol sort par le bas) ; cosmos fait entrer le gaz d'aurore par-dessus le ciel : alpha 0 à 57,5, opaque à 58,25. |
