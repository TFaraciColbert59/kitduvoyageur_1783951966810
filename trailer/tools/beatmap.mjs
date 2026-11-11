// Carte des temps du trailer LKDV 60 s — source unique (BEATMAP.md et l'animatique en sont générés).
// 120 BPM : temps = 0,5 s, croche = 0,25 s, double-croche = 0,125 s, mesure = 2 s.
// Référence : storyboard/LKDV — Trailer 60 s.md §4, amendé par CLAUDE.md §4 (images v3).
// Décisions de l'utilisateur du 2026-11-10 : storyboard gardé tel quel pour les fonctions (balise, montre, batterie,
// double confirmation, anneau de confiance, itinéraire recalculé, points chiffrés) ; plans au sol créés par nous ;
// partition synthétisée originale. Logo seul à 0:53 et mots tapés conservés (défauts de CLAUDE.md §5).

export const FPS = 60;
export const DURATION = 60;
export const BPM = 120;

// Hôtes de la composition racine. z : ordre de peinture. Un fichier = un agent.
export const SCENES = [
  { id: "gnd-iceland", start: 10.5, dur: 19.5, z: 10, owner: "landscape-director A", role: "Plans au sol 01–07 : mer de nuages, Islande, van, port, Landmannalaugar, rivière chaude, arrivée plage" },
  { id: "gnd-relay", start: 30.0, dur: 14.0, z: 10, owner: "landscape-director B", role: "Plans au sol 07–20 : feu de camp, K2, Lyon, Bourgogne, rafale mondiale, train, sentier" },
  { id: "gnd-return", start: 44.0, dur: 3.5, z: 10, owner: "landscape-director A", role: "Plan 04 : retour au port, puis arrachement vertical" },
  { id: "gnd-finale", start: 54.0, dur: 4.5, z: 10, owner: "landscape-director B", role: "Noir du bouton, plan 21 Norvège, bascule vers le ciel" },
  { id: "cosmos", start: 0, dur: 60, z: 20, owner: "cosmos-vfx", role: "Seul contexte WebGL : nébuleuse, système solaire, Terre, descente, voiles de nuages, orbite et traces, convergence du logo, aurore → nébuleuse. Transparent hors de ses plages." },
  { id: "ui-a1", start: 3.5, dur: 2.75, z: 30, owner: "ui-builder", role: "Barre de saisie IA, mots tapés, pictos, bouton d'envoi" },
  { id: "ui-a2", start: 6.0, dur: 6.0, z: 31, owner: "ui-builder", role: "Réticule orbital, altimètre, pile de pictos cochés, chiffres de génération" },
  { id: "ui-a3", start: 13.0, dur: 11.0, z: 30, owner: "ui-builder", role: "Hub, bouteille à la mer, colonnes de profil, grille des 38 objets, anneau" },
  { id: "ui-a4", start: 24.0, dur: 6.0, z: 30, owner: "ui-builder", role: "Anneau de confiance, double coche, objets connectés, hors réseau, cockpit, alerte vent" },
  { id: "ui-a5", start: 30.0, dur: 14.0, z: 30, owner: "ui-builder", role: "Carnet, fil, plongées par l'écran, îlots, kit en éventail, pictos de rafale" },
  { id: "ui-a6", start: 44.0, dur: 4.0, z: 30, owner: "ui-builder", role: "Double coche du retour, carnet fermé, 8 écrans en surimpression" },
  { id: "ui-a7", start: 52.0, dur: 5.0, z: 30, owner: "ui-builder", role: "Badge final, téléphone du bouton, carte de la nouvelle bouteille" },
  { id: "fx", start: 0, dur: 60, z: 40, owner: "orchestrateur", role: "Flashs des chocs, grain et vignette communs" },
  { id: "animatic", start: 0, dur: 60, z: 50, owner: "orchestrateur", role: "P1 seulement : timecode, idée de la seconde, témoin de temps. Masqué (data-hidden) au rendu final." },
];

// Marqueurs musicaux et de direction.
export const MARKS = [
  { t: 0.75, kind: "onde", note: "Onde dans la nébuleuse, début de l'effondrement" },
  { t: 1.5, kind: "impact", note: "Naissance du Soleil (flash) — ce point sera le point du logo" },
  { t: 2.25, kind: "impact", note: "Impact géant, la Lune s'arrache" },
  { t: 3.0, kind: "logo", note: "Logo dans l'aurore, 0,75 s (3,00–3,75) · signature 3 notes · la pulsation démarre" },
  { t: 5.5, kind: "geste", note: "Bouton d'envoi enfoncé, le globe pivote" },
  { t: 5.9, kind: "coupe-son", note: "Riser coupé net" },
  { t: 6.0, kind: "choc", note: "CHOC 1 : flash 3 images, le zoom démarre" },
  { t: 11.5, kind: "silence", note: "Silence total 11,5–12,0" },
  { t: 12.0, kind: "choc", note: "CHOC 2 + respiration 1 (12,0–12,5, ralenti 40 %, aucune interface) · logo dans la crête 0,5 s" },
  { t: 14.0, kind: "logo", note: "LKDV moulé dans le verre de la bouteille, 0,5 s" },
  { t: 22.0, kind: "héros", note: "Porte du van : plan le plus long (1 s), ralenti, aucune interface" },
  { t: 25.0, kind: "logo", note: "Étiquette cousue de la housse de tente, 0,5 s" },
  { t: 32.0, kind: "plongée", note: "Plongée 1 : traversée de l'écran en 0,5 s" },
  { t: 32.5, kind: "respiration", note: "Respiration 2 (32,5–33,0) : Nora, ralenti, seul le vent" },
  { t: 35.0, kind: "logo", note: "Crête et soleil levant refont le logo, 0,75 s, cadrage de 0:12" },
  { t: 36.0, kind: "plongée", note: "Plongée 2, en sortie : la bulle retombe sur le téléphone de Tom (0,25 s)" },
  { t: 37.0, kind: "silence", note: "Silence 37,0–37,5 puis un seul coup sec" },
  { t: 38.0, kind: "logo", note: "La trace de Tom épouse la ligne des montagnes, 0,5 s" },
  { t: 40.0, kind: "plongée", note: "Plongée 3 (0,25 s)" },
  { t: 41.0, kind: "rafale", note: "Rafale mondiale : plans 11 à 18, coupes franches voulues" },
  { t: 45.0, kind: "logo", note: "Logo en creux sur la couverture du carnet, 1 s" },
  { t: 45.5, kind: "silence", note: "Silence 45,5–46,0" },
  { t: 46.0, kind: "choc", note: "CHOC 3 : arrachement vertical, drop final" },
  { t: 50.0, kind: "respiration", note: "Respiration 3 : le globe seul" },
  { t: 51.0, kind: "logo", note: "Les traces convergent et redessinent les montagnes, 1 s" },
  { t: 52.0, kind: "logo", note: "Badge complet, 2 s · signature 3 notes" },
  { t: 54.0, kind: "coupe", note: "Noir sec (coupe franche voulue) : silence 54,0–54,5" },
  { t: 54.5, kind: "ping", note: "Le téléphone s'allume dans le noir, un seul ping (54,5)" },
  { t: 59.0, kind: "boucle", note: "L'aurore est redevenue la nébuleuse ; image 3599 ≈ image 0" },
];

// Une ligne par seconde. plate = image de assets/footage (jeu v3). layers = qui dessine quoi.
// ui : formes, pictos (noms de assets/icons/sf), chiffres. Aucune phrase.
export const SECONDS = [
  // ───── Acte 1 — Ouverture
  { t: 0, act: 1, idea: "Nébuleuse plein cadre, déjà en mouvement", cosmos: "Nébuleuse 3 couches en parallaxe, caméra vers l'avant ; onde à 0,75", ui: "—", son: "Note grave, souffle de chœur" },
  { t: 1, act: 1, idea: "Le nuage s'effondre en disque, le Soleil naît", cosmos: "Effondrement en rotation, disque ambre, flash du Soleil à 1,5, sillons", ui: "—", son: "Riser, impact à 1,5" },
  { t: 2, act: 1, idea: "La Terre se forme et refroidit", cosmos: "Spirale vers l'intérieur, Saturne et Jupiter en flou ; impact lunaire à 2,25 ; lave → océans → continents → vert", ui: "—", son: "Impact sec à 2,25, montée" },
  { t: 3, act: 1, idea: "La Terre d'aujourd'hui ; le logo dans l'aurore", cosmos: "Lumières des villes, lever de soleil ; aurore sage = 3 montagnes 3,00–3,75, Soleil sur le limbe = point ; puis l'aurore ondule", ui: "—", son: "Signature 3 notes ; pulsation" },
  { t: 4, act: 1, idea: "Quelques mots tapés sur le verre", cosmos: "La Terre tourne derrière le verre", ui: "Barre de saisie IA (pilule de verre, ressort 250 ms), avatar L, frappe « Islande · van · 10 jours · 4 » à 40 car./s", son: "Clavier feutré en doubles-croches" },
  { t: 5, act: 1, idea: "Les mots deviennent des pictos ; envoi", cosmos: "À 5,5 le globe pivote d'un coup sec et centre l'Islande", ui: "4 pastilles-pictos, une par double-croche : map-pin sur l'île, van, calendar « 10 », users ×4 ; bouton send enfoncé à 5,5 ; Spinner", son: "Pops cristallins ; riser coupé net à 5,9" },
  // ───── Acte 2 — Descente
  { t: 6, act: 2, idea: "CHOC 1 : un point sage tombe sur l'Islande", cosmos: "Point sage et traînée, zoom exponentiel (log de l'altitude)", ui: "Les pastilles fusionnent en un point ; réticule : 4 coins qui se verrouillent ; altimètre qui dégringole depuis 408", son: "Impact + sub, batterie" },
  { t: 7, act: 2, idea: "La route se trace autour de l'île", cosmos: "3 satellites génériques en flou, faisceau ; ligne sage autour de l'île, 9 étapes s'allument", ui: "Picto route coché dans la pile ; « 1 322 km »", son: "Tick sage" },
  { t: 8, act: 2, idea: "La météo se peint", cosmos: "Milliers de traits de vent bleu → sage ; bandes nuageuses", ui: "Picto météo coché ; frise de 10 pictos sun / cloud / cloud-rain", son: "Vent filtré, tick" },
  { t: 9, act: 2, idea: "Les nuits s'allument", cosmos: "Avion générique sous la caméra, sa traînée se confond avec la route ; lueurs ambre aux étapes", ui: "Picto moon coché ; 7 vans et 2 tentes miniatures", son: "Doppler, tick" },
  { t: 10, act: 2, idea: "38 objets pleuvent ; le budget se remplit", cosmos: "38 silhouettes en pluie d'étoiles filantes ; montgolfière Forest et Paper dorée", plate: "01 (à partir de 10,5, sous le voile)", ui: "Picto backpack coché ; barre de budget à 98 %", son: "Cascade de ticks, brûleur" },
  { t: 11, act: 2, idea: "Plongée dans la mer de nuages ; silence", cosmos: "Vol d'oies en V ; voile de nuages, gouttelettes ; opaque et blanc de 11,5 à 12,0", plate: "01 mer de nuages et montgolfières (11,0–11,5)", ui: "La pile se replie en un point ; grande coche sage 0,5 s ; tout se dissout en particules à 11,5", son: "Passe-bas ; silence total à 11,5" },
  // ───── Acte 3 — Le groupe
  { t: 12, act: 3, idea: "CHOC 2 : le nuage se déchire sur le fjord", cosmos: "Le voile se déchire (alpha), transparent à 12,5", plate: "02 Islande, Route 1 : ralenti 40 % 12,0–12,5, logo dans la crête 0,5 s (filet de lumière), rampe vers le van", ui: "— (respiration 1)", son: "Drop, cordes" },
  { t: 13, act: 3, idea: "Le Hub du groupe s'ouvre au-dessus du van", plate: "02", ui: "Carte de verre : silhouette de l'île + route + point au tiers ; avatars L, S, I + cercle en pointillés ; 3 anneaux ; capsule de navigation", son: "Ticks" },
  { t: 14, act: 3, idea: "Le cercle vide devient une bouteille à la mer", plate: "02 défocalisé → océan au crépuscule (fond de 02 ou 07)", ui: "Bouteille de verre, « LKDV » moulé révélé par un reflet 0,5 s ; papier roulé : van + 3 avatars + 1 vide", son: "Vague, bouchon" },
  { t: 15, act: 3, idea: "La bouteille part ; une bulle revient ; ils sont quatre", plate: "balayage filé → 03", ui: "Sillage = ligne sage ; mini-globe de points ; la bulle remplit le cercle ; îlot : avatar H en sage", son: "Glissando, swoosh" },
  { t: 16, act: 3, idea: "Une colonne de verre par personne", plate: "03 intérieur du van, de dos", ui: "4 colonnes : L cloud-snow ; S (appareil photo), sunrise ; I leaf, « 1 » ; H footprints", son: "Arpège montant" },
  { t: 17, act: 3, idea: "Le kit se réordonne ; le trait sage explique", plate: "03", ui: "Trait sage du flocon de Léa au sac de couchage qui monte en tête ; 10 points dont 8 pleins", son: "Ticks" },
  { t: 18, act: 3, idea: "38 objets : 6 allumés, 32 fantômes", plate: "03 défocalisé", ui: "Grille de 38 silhouettes ; « 6 / 38 »", son: "Musique retenue" },
  { t: 19, act: 3, idea: "Sage, poignée de main : la tente arrive de M", plate: "03 défocalisé", ui: "Vague de pastilles sage (handshake) ; avatar M ; « 2,1 km »", son: "Pop par pastille" },
  { t: 20, act: 3, idea: "Ambre, bleu, Stone : trois vagues", plate: "03 défocalisé", ui: "recycle ambre (chaussures, sac étanche) ; calendar bleu (doudoune) ; tag Stone (batterie)", son: "Pops en cascade" },
  { t: 21, act: 3, idea: "La grille est entièrement allumée", plate: "03 défocalisé", ui: "Onde de lumière ; « 38 / 38 »", son: "Montée" },
  { t: 22, act: 3, idea: "HÉROS : la porte du van ouverte sur l'océan", plate: "03 plein cadre, ralenti, 1 s", ui: "— (étiquettes de couleur discrètes sur le matériel, sans texte)", son: "Grosse caisse, vent" },
  { t: 23, act: 3, idea: "L'étiquette sage devient un anneau", plate: "03 → flou", ui: "Étiquette qui tourne → anneau qui grossit vers la caméra", son: "Riser court" },
  // ───── Acte 4 — Confiance et terrain
  { t: 24, act: 4, idea: "L'anneau de confiance de Marc se remplit", plate: "04 port, heure ambre, derrière le verre", ui: "Tiroir mi-hauteur ; avatar M au centre ; « 96 » ; 12 petites coches sage", son: "Note tenue, chaude" },
  { t: 25, act: 4, idea: "La tente change de mains", plate: "04 gros plan sur la remise ; étiquette cousue au logo 0,5 s", ui: "Deux téléphones se touchent : double coche sage ; 4 barres à pictos (compass, backpack, plume, handshake), la dernière monte ; « +25 »", son: "Double tick, carillon" },
  { t: 26, act: 4, idea: "Chaque objet émet une onde sage", plate: "03 intérieur, lumière ambre", ui: "Une onde sage par croche sur la balise, la montre, la batterie ; pastilles de verre : picto satellite ; « 14,2 km » ; jauge 82 %", son: "Trois pings" },
  { t: 27, act: 4, idea: "Plus de réseau : la carte reste vivante", plate: "03 / 06", ui: "Trois fils de lumière vers le téléphone ; wifi-off ; 4 points d'avatars qui bougent toujours sur la carte", son: "Grésillement coupé net" },
  { t: 28, act: 4, idea: "La trace avance avec les marcheurs", plate: "05 Landmannalaugar", ui: "Carte en relief dans un tiroir bas ; « 6,8 km », « +412 m » ; picto source chaude qui pulse", son: "Pas sur gravier" },
  { t: 29, act: 4, idea: "Le vent arrive : la route se redessine", plate: "06 rivière chaude, ciel qui se charge → time-lapse 0,5 s → 07 plage", ui: "wind ambre ; ancien tracé en pointillés, nouveau en sage plein", son: "Bourrasque, puis calme" },
  // ───── Acte 5 — Le relais
  { t: 30, act: 5, idea: "Le carnet s'écrit tout seul au feu de camp", plate: "07 feu de camp, soleil de minuit", ui: "Page Paper : photos qui tombent en place, écriture = texture", son: "Crépitement, guitare sèche" },
  { t: 31, act: 5, idea: "Publié ; le pouce s'arrête sur une photo", plate: "07", ui: "send coché ; carte du fil : avatar N + photo du plan 08", son: "Tick, swipe" },
  { t: 32, act: 5, idea: "PLONGÉE 1 : à travers l'écran, chez Nora", plate: "08 Karakoram, K2 : traversée 32,0–32,5 (réfraction), ralenti, Nora minuscule", ui: "— (respiration 2 : 32,5–33,0)", son: "Le feu devient vent" },
  { t: 33, act: 5, idea: "Son kit se déplie en éventail", plate: "08, rampe vers le sac", ui: "Éventail de silhouettes aux 4 couleurs ; « 9,8 kg » ; la balise pulse, 2 fils de lumière vers 2 avatars", son: "Cliquetis de bâtons" },
  { t: 34, act: 5, idea: "Son carnet : 5 pages en 5 flips", plate: "08 (fonds de pages tirés des plans disponibles)", ui: "5 flips ; mini-carte de la trace qui s'allonge", son: "Pages en rythme" },
  { t: 35, act: 5, idea: "Bras ouverts au sommet ; la crête refait le logo", plate: "08 ralenti 50 %, cadrage de 0:12, logo 0,75 s", ui: "La photo part vers le haut en bulle de verre", son: "Envolée de cordes" },
  { t: 36, act: 5, idea: "PLONGÉE 2 : la bulle retombe chez Tom", plate: "09 Lyon, bord du Rhône, aube", ui: "Îlot : avatar N + vignette du sommet ; picto course, « 5,2 km », pause", son: "Souffle, ville au loin" },
  { t: 37, act: 5, idea: "Silence ; il sourit, se lève", plate: "09 plan serré", ui: "pause → play", son: "Silence 37,0–37,5, un coup sec" },
  { t: 38, act: 5, idea: "Sa trace dessine les montagnes du logo", plate: "09 vue du ciel (trace sur le fleuve, 0,5 s)", ui: "« 8,0 km » ; barre compass qui monte ; « +40 »", son: "Foulées sur le tempo" },
  { t: 39, act: 5, idea: "Il partage ; le club montre des vélos", plate: "09", ui: "bike ; grappe de 12 avatars", son: "Tick" },
  { t: 40, act: 5, idea: "PLONGÉE 3 : le peloton dans les vignes", plate: "10 Bourgogne, automne (traversée 0,25 s)", ui: "12 avatars cochés ; « 42 km » ; barre handshake qui monte ; « +60 »", son: "Roue libre, rires" },
  { t: 41, act: 5, idea: "RAFALE : le monde entier", plate: "11 Sahara · 12 Amazonie · 13 Uyuni · 14 Baïkal · 15 Raja Ampat · 16 Antelope · 17 Népal · 18 Atacama — 0,125 s chacun (double-croche)", ui: "—", son: "Un coup par double-croche" },
  { t: 42, act: 5, idea: "Tous les voyages, tous les publics", plate: "19 train de nuit (42,0–42,5) · 20 sentier accessible (42,5–43,0)", ui: "train ; picto accessibilité", son: "Un plan par temps" },
  { t: 43, act: 5, idea: "Inès garde le carnet de Nora, lève les yeux", plate: "07 même cadrage qu'à 0:30", ui: "bookmark qui se remplit", son: "Retour du crépitement" },
  // ───── Acte 6 — Retour et envol
  { t: 44, act: 6, idea: "La tente est rendue, accolade", plate: "04 port, heure ambre", ui: "Double coche ; l'anneau de Léa gagne un cran, « 88 » → « 91 »", son: "Piano seul" },
  { t: 45, act: 6, idea: "Le carnet terminé se referme", plate: "04 défocalisé", ui: "Couverture Paper, logo en creux 1 s ; au dos : île, « 1 322 km », grille des 38 objets", son: "Accord tenu ; silence à 45,5" },
  { t: 46, act: 6, idea: "CHOC 3 : arrachement vertical", cosmos: "Voile de nuages qui monte (opaque à 47,0)", plate: "04 → vue qui s'éloigne à la verticale", ui: "4 écrans en surimpression, 0,25 s chacun : carte des sentiers · globe des pays · capsule d'étapes du Compas · fiche d'un objet", son: "Drop final, un flash par croche" },
  { t: 47, act: 6, idea: "À travers les nuages, vers le haut", cosmos: "Traversée des nuages, sortie en orbite à 48,0", ui: "4 écrans, 0,25 s chacun : messages du groupe · sortie de club · profil et saison · kit en 3D", son: "Souffle inversé" },
  { t: 48, act: 6, idea: "Les traces du film s'allument sur le globe", cosmos: "Orbite ; une trace par croche : Islande, Karakoram, Lyon, Bourgogne ; avatar au bout de chaque trace", ui: "— (avatars dessinés par cosmos, ancrés au globe)", son: "Quatre notes" },
  { t: 49, act: 6, idea: "Des milliers d'autres traces ; les prêts scintillent", cosmos: "Traces sage sur tous les continents ; points ambre", ui: "—", son: "Tutti" },
  { t: 50, act: 6, idea: "RESPIRATION 3 : le globe seul", cosmos: "Globe entier, lever de soleil sur le limbe", ui: "—", son: "Tenue" },
  { t: 51, act: 6, idea: "Les traces redessinent les montagnes du logo", cosmos: "Les traces quittent le globe, convergent ; le Soleil vient se placer : le point (logo 1 s)", ui: "—", son: "Montée finale" },
  // ───── Acte 7 — Signature
  { t: 52, act: 7, idea: "Le badge complet s'assemble", cosmos: "Terre en fond flouté", ui: "Badge LKDV autour des montagnes (seul texte depuis 0:04)", son: "Signature 3 notes" },
  { t: 53, act: 7, idea: "Le logo respire", cosmos: "Terre en fond flouté", ui: "Logo seul (pas d'adresse)", son: "Dernier accord" },
  { t: 54, act: 7, idea: "LE BOUTON : noir sec, un téléphone s'allume", plate: "fond encre (54,0–56,5)", ui: "Rien de 54,0 à 54,5 ; à 54,5 le téléphone s'allume : îlot avec avatar H + picto bouteille", son: "Silence 54,0–54,5, un ping à 54,5" },
  { t: 55, act: 7, idea: "Une nouvelle bouteille : fjord sous l'aurore", plate: "21 dans la carte", ui: "Carte de verre : photo, avatars H, S, I, cercle en pointillés", son: "Respiration" },
  { t: 56, act: 7, idea: "Le pouce touche le cercle : il se remplit", plate: "21 s'agrandit, plongée", ui: "Avatar L qui s'allume", son: "Tick, la pulsation reprend" },
  { t: 57, act: 7, idea: "Norvège : l'aurore emplit le ciel", cosmos: "Gaz d'aurore par-dessus le ciel du plan dès 57,5", plate: "21 plein cadre, bascule vers le haut", ui: "—", son: "Cordes, une mesure" },
  { t: 58, act: 7, idea: "On monte dans l'aurore", cosmos: "Voiles d'aurore → voiles de gaz, étoiles", ui: "—", son: "Le chœur revient" },
  { t: 59, act: 7, idea: "L'aurore est redevenue la nébuleuse", cosmos: "Réglages interpolés vers ceux de 0:00 ; image 3599 ≈ image 0", ui: "—", son: "Note grave du début" },
];

// Raccords entre fichiers : état exact au temps du raccord (coordonnées 1920×1080).
export const SEAMS = [
  { t: "6,00–6,25", a: "ui-a1", b: "ui-a2 + cosmos", rule: "ui-a1 fusionne les 4 pastilles en un point sage (rayon 7 px) au centre (960, 540) à 6,00 et le fait disparaître à 6,125 ; cosmos fait partir son point sage de (960, 540) à 6,00 ; le réticule de ui-a2 se verrouille autour de (960, 540)." },
  { t: "10,5–12,5", a: "cosmos", b: "gnd-iceland", rule: "cosmos peint le voile de nuages au-dessus des plans : 10,9–11,1 le monde vu d'en haut cède au voile troué (plan 01 dessous) ; 11,5–12,0 voile opaque blanc Stone ; 12,0–12,5 déchirure du centre vers les bords ; alpha nul à 12,5. gnd-iceland tient le plan 02 en place dès 11,5." },
  { t: "23,0–24,0", a: "ui-a3", b: "ui-a4", rule: "À 24,00 l'anneau est centré en (960, 468), rayon 150 px, trait 14 px sage-500, vide (0 %). ui-a3 l'amène à cet état en fin de slot (23,98) ; ui-a4 part exactement de cet état, pose le tiroir dessous et le remplit à 96 %." },
  { t: "29,5–30,0", a: "gnd-iceland", b: "gnd-relay", rule: "gnd-iceland finit sur le plan 07 (plage, van garé) en balayage filé vers la droite ; gnd-relay ouvre sur le plan 07 cadré feu de camp, même sens de balayage, vitesse égale." },
  { t: "43,5–44,0", a: "gnd-relay", b: "gnd-return", rule: "Balayage filé vers la gauche (retour) ; vitesse et sens identiques des deux côtés." },
  { t: "46,0–48,0", a: "gnd-return", b: "cosmos", rule: "gnd-return s'éloigne à la verticale 46,0–47,0 (échelle décroissante, flou) ; cosmos fait monter le voile de nuages : alpha 0 à 46,25, opaque à 47,0 ; sortie en orbite à 48,0." },
  { t: "51,0–52,0", a: "cosmos", b: "ui-a7", rule: "À 52,00 les montagnes du logo (logo-mark.svg, viewBox 32) occupent la boîte LKDV.LOGO_MARK (centre 960, 520 ; largeur 420 px) en trait Paper. ui-a7 fait naître le badge (assets/brand/lkdv-badge-1024.png, masque circulaire) autour de cette boîte ; cosmos garde la Terre floutée derrière jusqu'à 54,0." },
  { t: "54,0", a: "cosmos + ui-a7", b: "gnd-finale", rule: "Coupe franche voulue : gnd-finale peint un fond encre (ink-900, pas de noir pur) plein cadre de 54,0 à 56,5 ; cosmos devient transparent à 54,0." },
  { t: "56,0–57,0", a: "ui-a7", b: "gnd-finale", rule: "La photo de la carte (plan 21) grandit jusqu'à couvrir le cadre à 57,0 ; ui-a7 tient la carte, gnd-finale tient le plan plein cadre dessous avec le même cadrage à 57,0." },
  { t: "57,0–58,5", a: "gnd-finale", b: "cosmos", rule: "gnd-finale bascule vers le haut (le sol sort par le bas) ; cosmos fait entrer le gaz d'aurore par-dessus le ciel : alpha 0 à 57,5, opaque à 58,25." },
];
