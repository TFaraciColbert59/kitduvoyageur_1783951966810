# PROMPT — Claude Code réalise LE film de présentation de LKDV (Le Kit du Voyageur)

> **Comment l'utiliser.** Ouvre Claude Code à la racine du dépôt `kitduvoyageur` et colle :
> « Lis `video/presentation-complete/PROMPT-CLAUDE-CODE.md` en entier et exécute-le de bout en bout, en autonomie. »
> Tout ce dont tu as besoin est dans ce fichier et dans le dépôt.

---

## 1. Ta mission

Réalise **le film de présentation complet de l'application LKDV**. C'est une seule vidéo qui fait le tour de **toute** l'app, en **motion design** et avec les **vraies images de l'app**. Elle doit être au niveau des meilleures vidéos de lancement d'Instagram, de TikTok et de X : on ne décroche pas une seconde.

| | |
|---|---|
| **Format principal** | 9:16, 1080×1920, 60 i/s |
| **Durée** | 60 à 90 s, selon ton jugement : chaque seconde doit mériter sa place |
| **Coupes dérivées** | un hook de 15 s pour les réseaux et un 16:9 de 1920×1080 pour le site |
| **Son** | vraie musique produite et sous licence + effets sonores sur chaque geste, à −14 LUFS |
| **Sous-titres** | le film se comprend sans le son : texte à l'écran, pas de voix off sauf si tu prouves qu'elle apporte plus |

**Tu es le réalisateur.** Tony (le fondateur) te laisse carte blanche. Tu imagines le concept, l'histoire, la direction artistique, le rythme et le son, **tout seul**, à partir de tes références (section 6).
- Ne lui demande pas son avis sur des choix créatifs. Décide, note chaque décision dans `DECISIONS.md` et livre.
- Ne t'arrête que pour ce qui lui appartient vraiment : supprimer des données réelles, un secret, un mot de passe.

**Ne fais pas comme le Claude d'avant.** Le dossier contient ses essais (v1 à v5, section 8). Ils servent de **plancher** et de **liste d'erreurs à ne pas refaire**, pas de modèle. Tony a jugé la v5 « pas assez bon ». Tu dois faire nettement mieux et différemment.

---

## 2. Ce que Tony a dit (verbatim ou presque, dans l'ordre). C'est ton cahier des charges

1. « Met en avant tous les types de cartes et leurs utilités, ainsi que les filtres. Va même plus loin : à la fin il y aura les couloirs aériens, les feux de forêt, etc. (filtres via API gratuites) — anticipe. » → ce qui n'existe pas encore est montré comme **« bientôt »**, jamais comme disponible.
2. « Arrête-toi quand tu sais pas. Tu viens de gâcher mes crédits pour une **ancienne version** de l'app. » → **vérifie toujours que tu montres la dernière version de `main`**.
3. « Le préparateur, c'est **/compas** ; "crée un carnet", c'est le **tiroir de création de carnet** dans /communaute. Montre les **tiroirs de chaque page**. » « Messagerie : tu peux, c'est de la démo. »
4. « Fusionne toutes les idées pour la vidéo ultime. »
5. « Je veux que ce soit **beaucoup plus dynamique**, beaucoup moins sage. »
6. « Fais suivre les actions **au rythme du son**. »
7. « Trouve un juste milieu. C'est pas assez beau, **compréhensible, lisible** ; le texte n'est pas assez travaillé, **pas assez immersif, poétique**. »
8. « Les éléments se disposent n'importe comment. Je veux que ce soit **à la Apple, sobre et élégant**, que les éléments se suivent avec un sens du motion design : **un élément en entraîne un autre**, de manière différente et originale. Aie un **œil critique**. Mets-y ton maximum. »
9. « Quand tu dis des noms, explique : c'est des rencontres, c'est quoi… **pour tous les trucs de l'app**. » → chaque fonction montrée est **nommée et expliquée** en une phrase.
10. « **Ça doit être les vrais éléments de l'app.** » → aucune interface redessinée.
11. « Ça manque beaucoup de contenu. Le rythme est bon mais le format est mauvais. **Le son doit percuter en rythme** avec les actions. Il faut **un vrai hook au démarrage**. »
12. « Trop **répétitif**, on ne change jamais de scène, c'est chiant, on n'est **pas stimulé**. »
13. « On n'est pas des robots, on est des humains, **on a besoin de dopamine**. »
14. « Carte blanche, tu fais ce que tu veux, tu es libre et pleinement autonome. »
15. (Ce prompt) « Je veux qu'il **imagine et fasse tout seul** en fonction des **références vidéo Insta, TikTok, X**. »

**Ce qui en découle, et qui n'est pas négociable :**
- un hook dans la première seconde ;
- un changement visuel au moins toutes les 1 à 2 s ;
- du son sur chaque geste ;
- de l'humain et de l'émotion ;
- des récompenses (chiffres qui montent, tout qui se met en place, drop) ;
- de la lisibilité : temps de lecture suffisant, une idée par plan ;
- de l'élégance « Apple » : grille, typographie et ressorts, sans gadget.

---

## 3. Règles dures

1. **Vrais éléments uniquement.** Tout ce qui ressemble à l'app est une capture, un enregistrement ou une découpe de l'app réelle, tournée sur **la dernière version de `main`**. Avant de filmer :
   - `git fetch origin main` ;
   - note le SHA dans `DECISIONS.md` ;
   - lance l'app depuis ce commit.

   Si une fonction n'existe pas, elle est écrite **« bientôt »**, ou absente.
2. **Ne rien créer, publier ni valider pendant les tournages.** On ne clique jamais « Préparer », « Publier », « Envoyer », ni sur le **SOS**. Taper dans un champ sans valider est permis.
3. **Confidentialité.**
   - Aucune donnée personnelle de Tony à l'écran : la messagerie de démo affiche un pseudo tiré de son e-mail, à **flouter ou écarter**.
   - Jamais de document d'identité, ni de coordonnées précises d'un domicile.
4. **Données de démo sales.** La Communauté affiche des contenus de test : club « efzfzefzz », posts « ezfererferf », « vdfvdfvdf ».
   - Ne les montre pas.
   - Les supprimer demande **l'accord écrit de Tony** : demande-le une fois, en une ligne, puis contourne en attendant (autre écran, recadrage).
5. **Licences.**
   - Musique et images libres pour un usage commercial, vérifiées une par une : Mixkit (attention aux éléments « Restricted »), Pixabay, Uppbeat gratuit, Free Music Archive en CC-BY…
   - Les vidéos de référence Insta, TikTok et X servent **seulement à étudier** le style ; jamais un pixel ni une note n'en sort.
6. **Budget : 0 €.** Seulement des outils gratuits.
7. **Secrets.**
   - Le mot de passe du compte de démo (`demo@lkdv.app`) n'est jamais écrit dans un fichier versionné. Demande-le à Tony ou utilise un fichier hors dépôt (`PWFILE`).
   - La session Playwright va dans `tools/capture/.session/`, qui est ignoré par git.
8. **Vocabulaire et charte LKDV** (`CLAUDE.md`, `DESIGN_SYSTEM.md`, `src/styles/tokens.css`) :
   - **Couleurs :** Forest `#17402C`, Sage `#5B7F55`, Stone `#FAF8F5`, encre `#0B1F17`, laiton `#D0A070` (accent des films).
   - **Interdits :** `#E4501C`, `#1C2620`, `#A3C4A3`, `#0B1F17` en aplat de fond, `#2D6B4A`.
   - **Typographie :** Inter ; italique d'emphase Georgia ou EB Garamond.
   - **Mots du produit :** « lignée », « kit souche », « éprouvé », « part créateur ». Jamais de vocabulaire génétique, jamais « l'app sauve des vies ».
9. **Git.**
   - Travaille sur une branche `claude/…` ; commits en français.
   - Trailer `Co-Authored-By: Claude <noreply@anthropic.com>`.
   - Pas de vidéos de référence dans le dépôt ; pas de MP3 de musique tierce (note la source à la place).

---

## 4. Installation

```bash
bash video/presentation-complete/tools/setup.sh
```

**Ce que le script installe :**
- **Node 20+** et **ffmpeg**, qu'il vérifie seulement (installe-les toi-même s'ils manquent) ;
- le **CLI HyperFrames** et ses skills, via `npx hyperframes skills update` : `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `reverse-any-video`, `style-sampling` ;
- **Playwright** et Chromium ;
- un environnement Python avec **numpy**, **scipy** et **Pillow** ;
- **yt-dlp**.

Si les skills HyperFrames ne s'installent pas ainsi, suis le README du dépôt `heygen-com/hyperframes`, qui propose un plugin Claude Code.

**Lancer l'app** à la racine du dépôt, sur le dernier `main` :

```bash
NODE_OPTIONS=--max-old-space-size=6144 npx next dev -p 3000
```

`.env.local` contient la clé publique Supabase (anon), qui n'est pas secrète. Le serveur de développement meurt parfois : relance-le et vérifie que `/connexion` renvoie 200.

**Ouvrir la session de démo**, une seule fois :

```bash
PWFILE=/chemin/hors-depot/mdp.txt node video/presentation-complete/tools/capture/caps-login.cjs video/presentation-complete/tools/capture/.session
```

---

## 5. Skills et outils à utiliser (charge-les avant d'agir)

| Skill / outil | Quand |
|---|---|
| **`hyperframes`** (+ `hyperframes-cli`) | Toujours en premier : règles de rendu, `check`, `snapshot`, `render`. Lis `references/` (motion, sound, look, story, review). |
| **`hyperframes-registry`** | Avant de coder à la main une transition, un effet de texte, un grain ou un overlay : environ 450 blocs prêts. |
| **`media-use`** | Musique, effets, étalonnage et traitements des plans (jamais de filtres CSS sur la vidéo). |
| **`reverse-any-video`** | Décortiquer une vidéo de référence plan par plan : rythme, transitions, typographie. |
| **`style-sampling`** | Reprendre un style éprouvé sur ton sujet. |
| **`.claude/skills/product-launch-motion`** (dans le dépôt) | **Obligatoire.** C'est la direction des films de lancement : une forme jamais coupée, ressorts fermés, curseur qui clique, chiffres réels, son placé au pic mesuré, rendu en sous-images avec flou de mouvement. Lis `references/technique.md` et `references/prompts.md`. |
| `.agents/skills/interaction-design/SKILL.md` (« Aura ») | Pour la justesse des gestes d'interface. |
| Skills GSAP (`gsap-core`, `gsap-timeline`, `gsap-plugins`), `motion-design`, `motion-effects`, `launch-video`, `reel-export`, `reference-to-motion`, `animated-chart`, `milestone-reveal` | S'ils sont installés chez toi : ils ont de bonnes recettes (morphing, chiffres, export Reels/TikTok). Sinon, les règles de `product-launch-motion` suffisent. |
| **Playwright** | Captures (`locator.screenshot` à 3×) et **enregistrements de gestes** en screencast CDP, viewport 393×852. Voir `tools/capture/`. |
| **ffmpeg** | Montage, `tmix` (flou de mouvement), mesure du volume (`ebur128`), contrôle image par image. |
| **numpy / scipy** | Analyse de la musique : tempo, grille de temps, drop, tonalité. |
| **yt-dlp** | Récupérer les références pour **les étudier en local** (dossier `refs/`, jamais versionné). |
| Recherche web | Trouver les références et les musiques libres. |

---

## 6. Les références : c'est toi qui les trouves, les étudies, puis tu inventes

1. **Les références de Tony.** S'il a déposé des liens ou des fichiers dans `video/presentation-complete/refs/` (`liens.txt`, vidéos), commence par eux.
2. **Tes propres références, au moins 12**, sur Instagram Reels, TikTok et X, plus YouTube Shorts si utile. Vise des vidéos récentes, très vues et très partagées dans ces familles :
   - lancements d'apps : Apple, Linear, Arc, Raycast, Notion, Duolingo… ;
   - apps outdoor et voyage : Strava, Komoot, AllTrails, Polarsteps… ;
   - « app promo » et UI motion récentes, à fort taux de rétention ;
   - montages d'aventure et de voyage très dynamiques (montage au beat, *speed ramps*, raccords) ;
   - motion design typographique.
3. **Pour chacune**, avec `reverse-any-video` ou à la main en extrayant les images avec ffmpeg, note dans `REFERENCES.md` :
   - le hook des 2 premières secondes et pourquoi il retient ;
   - le nombre de coupes ou d'événements par seconde ;
   - les transitions utilisées ;
   - la place et le style du texte ;
   - l'usage de la musique (drop, silence, *build*) ;
   - les récompenses (chiffres, révélations) ;
   - ce que LKDV peut en tirer sans copier.
4. **Synthèse** : une « bible » d'une page dans `BIBLE.md`, avec :
   - les 5 principes que tu retiens ;
   - la palette ;
   - la typographie ;
   - le vocabulaire de mouvement ;
   - la grille sonore.

   Ensuite seulement, invente **ton** concept.

---

## 7. L'app à couvrir (100 %) : routes de `main` à vérifier et compléter

Fais d'abord l'inventaire toi-même : `git ls-tree -r --name-only origin/main src/app | grep page.tsx`, puis les registres de tiroirs. La liste ci-dessous vient de l'état au 26/11/2026.

**Navigation.** Barre d'onglets réelle : Hub · Explorer · Communauté · Messages · Compte.

**Explorer** (`/explorer`, SOS inclus dans `explorer-v2`) :
- le globe, le tiroir « Le monde · Le globe s'ouvre sur toi », la recherche ;
- **Couches & fonds** : Relief 3D · Satellite · Plan ;
- les calques et filtres ;
- les couches à venir, écrites **« bientôt »** : couloirs aériens, feux de forêt, avalanches, qualité de l'air, crues, ciel étoilé ;
- le bouton SOS, montré mais jamais déclenché.

**Compas** (`/compas`), le préparateur :
- « Où veux-tu aller ? », une phrase libre ;
- « Je prépare ton aventure… · Nuits, trajet, kit et budget » ;
- la carte du voyage ;
- les boutons Solo · Budget · Sac · À prévoir · Vérifs ;
- les tiroirs (À réserver, Vérifs : « signaux vérifiables, chacun avec sa source ») ;
- « Presque prêt », J-191.

**Hub** (`/hub`, `/hub/[section]`) :
- les tuiles et tiroirs Météo (MET Norway, frise horaire), Budget (rythme, projection, marge), Carte (pack hors ligne), Étapes (« Démarrer le voyage »), Carnet (moments, notes, récit), Kits (checklist), Paperasse (Documents · À réserver · Urgences) et Groupe (membres, Positions & Sécurité) ;
- les sections : inventaire, kit, préparation, départ, disponibilité, alertes, « À ne pas oublier », aperçu, itinéraire, équipement, groupe, budget, documents, checklist, sécurité, journal, export, invitations, voyages liés.

**Communauté** (`/communaute`, `/communaute/reels`, `/communaute/post/[id]`) :
- les stories, le fil, les notifications, la recherche ;
- le tiroir **Créer → Carnet**.

**Carnets** (`/carnets`, `/carnets/[id]`, carnet V2) :
- les onglets En route · Suivis · Monde · Les miens ;
- le fil de bord : Rencontre, Pokédex, Refuge et bivouac, Performance, Kit, Incident, Dépense ;
- les tiroirs Chiffres, Équipage, Pokédex, Sac, Route ;
- « Reprendre dans le Compas ».

**Clubs et sorties** (`/clubs/[id]`, `/sorties/[id]`) :
- Cordée des Alpes : sorties programmées, membres et cordée (Guide & Sécurité, Encadrant), salons, statistiques, sac et coffre matériel, réglages.

**Messagerie** (`/messagerie`) :
- groupes, demandes, nouvelle discussion ;
- en écartant ou floutant le pseudo personnel.

**Compte** (`/compte`) :
- trace globale, sorties par massif, carte d'empreinte, « Personnaliser la carte d'empreinte » ;
- les sous-pages `/compte/suivi-en-direct` (Partage · Contacts · Montre), `/compte/montres`, `/compte/sensors`, `/compte/activites`.

**Autres pages :**
- **Kit Studio** (`/kit-studio`) : sac en 3D réel, uniquement des `.glb` publiés ;
- **Live** (`/live/[token]`) : la page qu'un proche ouvre ;
- **Pro** (`/pro`), en bonus éventuel ;
- **Manifeste** (`/manifeste`), pour le ton.

**Le récit des données.** Les données de démo sont réelles et cohérentes : voyage Vercors 5–7 juin, solo (Compas, Hub) ; carnet du Tour des Écrins (4 jours, 72 km, +4 520 m, Camille et Léo) ; club Cordée des Alpes (500 membres) ; profil lea.fontaine. Garde ce fil : « Léa prépare le Vercors ; son dernier carnet, c'est les Écrins ».

---

## 8. Le matériel déjà prêt dans le dépôt

`video/presentation-complete/` :

| Chemin | Contenu |
|---|---|
| `assets/screens/` | Captures 393×852 à 3× (1179×2556) : `hub.png`, `explorer.png`, `compas.png`, `ecrans/*.png` (carnets, communaute, compte, suivi en direct, kit-studio, carnet V2, messagerie retirée pour confidentialité), `tiroirs/hub-*.png` (8 tiroirs du Hub) |
| `assets/real/` | Composants réels découpés : tuiles du Hub, détails de tiroirs, cartes budget, bandeau Compas, carte carnet, carte Suivi en direct, carte Rencontre |
| `assets/video/` | Les **25 plans animés** de l'histoire « Pas pour moi » (Julien, Alpes ; 1080×1920) et `compas-saisie.mp4` (vraie saisie dans le Compas, un mot par 0,5 s) |
| `../presentation/assets/gen/` | Les 25 images sources ; `../presentation/STORYBOARD-ULTIME.md`, `TEXTE-PRESENTATION.md` |
| `tools/capture/` | `caps-login.cjs`, `caps-routes.cjs` (pages), `caps-drawers852.cjs` (tiroirs, enchaînements `"A > B"`), `crops.cjs` (composants), `rec.cjs` + `frames2mp4.py` (enregistrement de gestes calés sur le temps) |
| `tools/synth.py`, `tools/mix.py` | Synthèse d'effets sonores et mixage avec une piste |
| `PLAN.md`, `FILM-V5.md` | Le plan initial et la v5 |
| `index.html` + `assets/film.js` | La v5 : moteur en fonction pure du temps, ressorts fermés, une forme qui se transforme |

**Musique déjà analysée** : « Mountains », Mixkit n° 187, https://assets.mixkit.co/music/187/187.mp3.

| Mesure | Valeur |
|---|---|
| Tempo | 122,3 BPM (un temps = 0,4908 s) |
| Tonalité | la mineur |
| Montée | de 33 à 47 s (charlestons en doubles croches) |
| Drop | 47,22 s |

Tu peux en choisir une meilleure. Le film complet demande sans doute une piste plus longue, ou deux pistes raccordées sur un temps.

**Historique des versions, à dépasser :**

| Version | Ce que c'était | Ce qui n'allait pas |
|---|---|---|
| v1 16:9 | Ouverture lente | Mauvais format, trop peu de contenu |
| v2 | Téléphone central | Répétitif |
| v3 | 12 scènes | Liste de fonctions sans émotion |
| v4 | L'humain (Julien) | Montage de cartons |
| v5 | Une forme continue, vraie musique | « Pas assez bon » |

---

## 9. Méthode de fabrication

1. **Inventaire** de `main` (routes, tiroirs) → `INVENTAIRE.md`, avec le SHA.
2. **Références** → `REFERENCES.md` et `BIBLE.md` (section 6).
3. **Concept et scénario** → `SCENARIO.md` :
   - l'idée en une phrase ;
   - l'arc émotionnel : hook → tension → récompenses → drop → final ;
   - chaque scène avec sa minute, son état visuel, la fonction réelle montrée (son nom et sa phrase d'explication), sa transition, son son ;
   - le tout sur la **grille de temps de la musique choisie**, analysée avec numpy.
4. **Tournage** sur l'app locale :
   - captures et découpes à 3× ;
   - **enregistrements de vrais gestes** : ouvrir un tiroir, glisser, taper sans valider, faire défiler, changer de fond de carte, tourner le globe, tourner le sac du Kit Studio ;
   - calés sur les temps si possible (`rec.cjs`).

   Tout geste animé à l'écran doit venir d'un enregistrement ou d'une capture réelle. Aucune interface redessinée.
5. **Planche de vérification** de tous les éléments réels : regarde-les, écarte les données sales.
6. **Construction** HyperFrames :
   - une sous-composition par scène ;
   - moteur en fonction pure du temps (`seek(t)`) ;
   - ressorts fermés ;
   - une forme ou un fil conducteur qui relie les scènes : à toi de l'inventer ;
   - curseur et pression sur chaque action ;
   - caméra qui cadre pour que chaque état remplisse l'image.
7. **Son** :
   - la piste ;
   - les effets synthétisés ou libres, chacun placé **à son pic mesuré** sur le geste (clics, touches, souffles, impacts, tics de compteur, montées) ;
   - les effets tonals dans la gamme de la piste ;
   - un mix à −14 LUFS et moins de −1 dBTP.
8. **Contrôles avant le rendu complet** :
   - une image par temps en planche ;
   - les transitions à ±0,1 s ;
   - un **brouillon basse définition regardé à vitesse normale** ;
   - `npx hyperframes check` sans erreur.
9. **Rendu** à 60 i/s, avec flou de mouvement : sous-images puis `tmix`, comme dans `product-launch-motion` ; ou le rendu HyperFrames à `--fps 60`.
10. **Contrôle du MP4 lui-même** :
    - une planche à une image par seconde ;
    - un balayage des différences entre images : les grands sauts ne doivent tomber que sur des coupes voulues, sans image vide ni fondu raté ;
    - la vérification que le son est synchronisé (pics mesurés contre les gestes).
11. **Autocritique sans complaisance** :
    - regarde-le comme quelqu'un qui scrolle sur TikTok : à quelle seconde est-ce qu'il partirait ? Corrige, puis recommence ;
    - fais relire par un sous-agent « directeur artistique », avec un regard neuf, sur la base de `BIBLE.md` et des citations de Tony (section 2).
12. **Livraison** :
    - `renders/LKDV-presentation-complete.mp4` (9:16), `-hook-15s.mp4` et `-16x9.mp4` ;
    - `storyboard.png` ;
    - `DECISIONS.md` : tes choix, ce qui est réel et ce qui est mis en scène, les licences, et ce qui est « bientôt » ;
    - un commit et un push.
    - Dis honnêtement si tu as **écouté** le son ou seulement **mesuré** ses niveaux.

---

## 10. La barre de qualité (ta liste de contrôle « dopamine »)

- [ ] **0–1 s :** un hook visuel **et** émotionnel. On comprend tout de suite qu'il y a quelque chose à gagner à rester.
- [ ] Un événement visuel **à chaque temps** ; une **nouvelle composition** au moins toutes les 2 s. Jamais deux scènes de suite avec la même mise en page.
- [ ] **Des humains :** visages, gestes, émotions (les plans de Julien, de la mère, de la tablée…). L'app est le déclencheur de moments de vie.
- [ ] **Des récompenses :** chiffres réels qui défilent, tout qui se met en place, un **drop** musical sur le moment-clé, un **silence** juste avant.
- [ ] **Chaque fonction est nommée et expliquée** en une phrase courte, lisible le temps qu'il faut.
- [ ] **100 % de l'app** : les cinq onglets, le Compas, les cartes et les couches (avec les « bientôt »), les carnets, les clubs, la messagerie, le compte, le Kit Studio, le suivi en direct. Chaque fois avec un **vrai** élément.
- [ ] **Élégance :** grille stricte, une idée par plan, ressorts sans rebond excessif, typographie travaillée et poétique (Inter + italique), palette LKDV.
- [ ] **Son :** il frappe sur chaque geste, et le drop tombe sur le grand moment.
- [ ] **Zéro** image vide, élément coupé, texte qui se chevauche, donnée sale, donnée personnelle ou ancienne version de l'app.
- [ ] Le final : logo LKDV, « Là où la carte se termine. », et un appel à l'action clair.

Vas-y. Imagine, tourne, monte, critique, recommence. Livre le meilleur film que tu puisses faire.
