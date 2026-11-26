# Bible du film LKDV

## Les 5 principes

1. **Le résultat d'abord.**
   - En moins de 2 s, une phrase tapée devient un voyage prêt.
   - Pas de logo d'ouverture, pas de mise en place.
2. **Une idée et un vrai élément de l'app par plan.**
   - Chaque fonction a un nom (en capitales, laiton) et une seule phrase d'explication.
   - Le texte reste à l'écran le temps de le lire : au moins 1,6 s pour une légende, 0,2 s par mot pour une ligne rythmée.
3. **Un élément en entraîne un autre.**
   - Il n'y a jamais de coupe sèche entre deux chapitres : on passe par un raccord de forme, de direction ou de couleur.
   - Le fil conducteur est **le tracé**, une ligne laiton : un tracé de randonnée qui devient le bord d'un tiroir, puis une capsule d'onglet, puis l'anneau du logo.
4. **Le rythme suit la musique, sans mitraillette.**
   - Un événement par temps, et une nouvelle composition au plus toutes les 2 s.
   - Deux respirations : un arrêt dans le blanc au milieu, un silence d'un temps avant le drop.
5. **De l'humain et des récompenses.**
   - Des visages (les plans de vie) et des messages réels de la messagerie de démo.
   - De vrais chiffres qui montent (170 km, +10 000 m, 11 espèces) et tout qui se met en place au drop.

## Palette

| Rôle | Couleur |
|---|---|
| Forêt (scènes sombres, en dégradé, jamais en aplat d'encre) | `#17402C` |
| Sauge | `#5B7F55` |
| Pierre (scènes claires) | `#FAF8F5` |
| Encre (texte seulement) | `#0B1F17` |
| **Laiton** (accent unique : le fil, le curseur, les noms de fonctions) | `#D0A070` |
| Ombres | `rgba(11,31,23,α)`, jamais `rgba(0,0,0)` |

**Interdits :** `#E4501C`, `#1C2620`, `#A3C4A3`, `#2D6B4A`, `#0B1F17` en aplat de fond.

**Règle Apple :** la seule couleur vive est sur l'écran de l'app ; tout le reste est pierre, forêt ou laiton.

## Typographie

Les polices sont dans `assets/fonts`, toutes libres.

| Usage | Police et taille |
|---|---|
| Titres | Inter SemiBold et Bold, 96–128 px en 1080×1920, interlignage serré, une à quatre lignes |
| Emphase poétique | italique EB Garamond (Georgia en secours), sur un ou deux mots par phrase |
| Noms de fonctions | Inter Medium en capitales, 26–30 px, tracking 0,14 em, laiton |
| Chiffres | Inter Bold, chiffres tabulaires ; JetBrains Mono pour les petites mesures |

**Ton :** court, concret, poétique sans emphase.
- **Mots du produit :** lignée, kit souche, éprouvé, part créateur.
- **Jamais :** de vocabulaire génétique ni « l'app sauve des vies ».

## Vocabulaire de mouvement

**Ressorts fermés**, en fonction pure du temps :
- amortissement critique, ou dépassement ≤ 4 % ;
- jamais de rebond mou.

**Gestes et traversées**
- **Masques :** le texte monte de sa ligne de base, mot à mot.
- **Traversée :** la caméra entre dans un élément réel (une tuile, une carte, le globe) et ressort sur l'écran suivant.
- **Tiroir réel :** les ouvertures de tiroir viennent des enregistrements, retimés par rampes de vitesse pour tomber sur le temps.
- **Pression :** curseur laiton, enfoncement de 0,12 s, anneau qui s'ouvre, son au pic.

**Image**
- **Profondeur :** trois plans au plus. Le passage en 3D (globe, sac) est réservé aux moments-clés.
- **Flou de mouvement** par sous-images. Grain léger.
- Pas de fuite de lumière tape-à-l'œil, pas de glitch.

## Grille sonore

**Piste**
- 120 à 124 BPM, mineure, construite en montée puis drop.
- Mesurée avec numpy : tempo, temps, drop, tonalité.
- À défaut d'une piste sous licence vérifiée, composition originale.

**Points de calage**

| Instant | Son |
|---|---|
| 0,0 s | Impact sourd et une note de la gamme : le hook |
| Chaque geste | Effet placé au pic mesuré : clic, touche, souffle de tiroir, tic de compteur |
| Traversées | Souffle avec 0,15 s d'amorce |
| Avant le drop | Silence d'un temps |
| Drop | Sur le moment-clé : « Démarrer le voyage », puis le monde qui s'ouvre |

**Effets tonals** dans la gamme de la piste.

**Mix :** −14 LUFS intégrés, crête vraie < −1 dBTP.
