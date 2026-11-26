# LKDV — la présentation complète en une seule vidéo (plan v1, à valider avant toute production)

Une seule vidéo qui fait le tour **de toute l'application**, en motion design, posée **uniquement sur de vraies images de l'app** : captures, enregistrements de gestes et composants recadrés. Aucun écran redessiné.

Référence du code : `origin/main` au 26/11/2026 (`d52a00641`, « club hierarchy, settings drawer, club inventory »). Avant de filmer, on revérifie le dernier commit de `main` et on l'écrit ici. Si `main` a bougé, on refilme ce qui a changé.

---

## 1. L'idée

**« Une aventure, de l'envie au retour. »** On suit un vrai compte de démo : Léa Fontaine, 24 sorties, 240 km. Avec elle, on traverse l'app dans l'ordre où on la vit :

> rêver → préparer → s'équiper → partir → raconter → partager → recommencer

Chaque étape correspond à une page réelle. La barre d'onglets réelle (Hub · Explorer · Communauté · Messages · Compte) sert de **sommaire vivant** : son onglet actif glisse d'un chapitre à l'autre.

**Un seul fil visuel relie tout : le fil laiton.**
- Il barre une hésitation, puis devient un tracé.
- Il se fait contour du téléphone, puis lien entre deux écrans.
- Il se referme enfin en anneau du logo.

C'est la grammaire de l'aperçu « vrais éléments », étendue à toute l'app.

## 2. Les données affichées (vraies, cohérentes)

| Ce qu'on montre | Donnée réelle du compte de démo |
|---|---|
| Le prochain voyage | **Vercors**, 5–7 juin, mixte, 1 392 € prévus, sac 2,8 kg, J-192 (Compas et Hub) |
| Le dernier voyage raconté | **Tour des Écrins** (carnet V2 : Refuge du Pigeonnier, Marc le berger, bouquetin, La Bérarde) |
| Le club | **Cordée des Alpes** (Chamonix · Mont-Blanc, 500 membres, Guide & Sécurité, Encadrant) |
| Le profil | lea.fontaine : 24 publications, 51 abonnés, 24 sorties, 240 km, 7,5 km D+ |

Le récit devient : « Léa prépare le Vercors ; son dernier carnet, c'est les Écrins ». Il n'y a plus de contradiction entre Annecy et les Écrins.

## 3. Le film, chapitre par chapitre (≈ 3 min 30)

Chaque chapitre a sa propre **transition signature** : un élément du chapitre précédent engendre le suivant. Chaque fonction montrée reçoit une **légende** : son vrai nom (petites capitales laiton) et ce qu'elle fait (une phrase).

| # | Chapitre | Pages et tiroirs réels | Mouvement signature |
|---|---|---|---|
| 0 | **Ouverture** (0:00–0:12) | — | Un point de lumière dans le noir. Le fil laiton écrit « Là où la carte se termine. » puis se courbe en horizon de la Terre. |
| 1 | **Le Hub : ton aventure d'un coup d'œil** (0:12–0:35) | `/hub` : tuiles Météo, Budget, Carte, Étapes, Carnet, Kits, Paperasse, Groupe ; tiroirs Météo (MET Norway, vigilances), Paperasse, Étapes | Le téléphone naît du contour tracé par le fil. Les huit tuiles s'en détachent une à une en grille flottante, puis se rangent. |
| 2 | **Explorer : rêver** (0:35–1:05) | `/explorer` : globe « Le monde », recherche, menu Explorer, **Couches & fonds** (Relief 3D · Satellite · Plan), calques ; puis les couches **« bientôt »** (couloirs aériens, feux de forêt, avalanches, qualité de l'air, crues, ciel étoilé), marquées comme telles | Le globe de l'intro tourne et plonge dans l'écran. Les fonds de carte se superposent en feuillets 3D qui s'écartent puis se referment. |
| 3 | **Le Compas : préparer** (1:05–1:40) | `/compas` : « Où veux-tu aller ? », phrase libre, bandeau « Je prépare ton aventure… » ou « Je réadapte… », carte du voyage, Solo · Budget · Sac · À prévoir · Vérifs, tiroir Vérifs (« signaux vérifiables, chacun avec sa source ») | La phrase tapée se détache du champ et devient le bandeau. Celui-ci se résorbe en point laiton qui pose les étapes sur la carte. |
| 4 | **S'équiper** (1:40–2:00) | `/kit-studio` (sac 3D réel, 1,2 kg, tente Hubba 2P, matelas), Hub **Kits**, club **Sac et coffre matériel** | Le sac tourne. Les objets du kit tombent en cartes et la jauge de poids se remplit. |
| 5 | **Partir** (2:00–2:25) | `/compte/suivi-en-direct` (Partage · Contacts · Montre), page `/live/[token]` (« position partagée temporairement »), `/compte/montres`, bouton **SOS** de l'Explorer (montré, jamais déclenché) | La route pointillée (prévue) devient pleine (parcourue). Un lien de suivi part du téléphone vers un second écran : celui d'un proche. |
| 6 | **Raconter** (2:25–2:55) | `/carnets` (En route · Suivis · Monde · Les miens), `/carnets/[id]` (carnet V2 : fil de bord Rencontre, Pokédex, Refuge, Performance, Kit, Incident, Dépense ; tiroirs Chiffres, Équipage, Pokédex, Sac, Route), tiroir **Créer un carnet** de la Communauté | Les cartes du fil s'empilent en marchant : chaque nouvelle carte pousse la précédente. Le Pokédex se déplie en planche d'espèces. |
| 7 | **Ensemble** (2:55–3:15) | `/communaute` (stories, fil, explorer et rechercher, notifications), `/communaute/reels`, `/clubs/[id]` (Sorties programmées, Membres et cordée, Salons, Statistiques, Réglages), `/sorties/[id]`, `/messagerie` (groupes « Dolomites — août », demandes, nouvelle discussion) | Les vraies lignes de membres sortent de la liste et se relient par le fil, comme une cordée. Un message part vers la messagerie. |
| 8 | **Toi** (3:15–3:25) | `/compte` (trace globale, sorties par massif, carte d'empreinte), « Personnaliser la carte d'empreinte », `/compte/activites` | La trace de toutes les sorties se dessine sur la carte d'empreinte. |
| 9 | **Fin** (3:25–3:35) | La vraie barre d'onglets | Le fil se referme en anneau, puis vient le logo : « LE KIT DU VOYAGEUR · Là où la carte se termine. » |

Pages laissées de côté, sauf avis contraire :
- `/pro` (offres B2B) : possible en bonus de 5 s ;
- `/developpeurs` : console hors navigation publique ;
- les pages légales ;
- `/connexion` et `/inscription`.

## 4. Langage de motion design

1. **Le téléphone est la scène.** Les vraies vidéos de l'app vivent dans un écran masqué. On change d'écran par une poussée iOS ou par un tiroir réel qui s'ouvre.
2. **Le détail sort de l'écran.** Le composant réel utile (capture recadrée à 3×) se détache, agrandi, avec une ombre douce. Il est expliqué, puis il rentre.
3. **Un élément en engendre un autre.** Jamais de coupe sèche : chaque transition naît d'un objet du plan précédent (point, trait, carte, phrase).
4. **Sobre « à la Apple ».** Grille stricte, marges de 96 px, texte masqué qui monte mot à mot, une idée par plan. Couleurs : forêt, pierre, laiton.
5. **Le rythme suit la musique** sans en être l'esclave : les gestes tombent sur les temps forts, les textes restent assez longtemps pour être lus (contrôle `line_unread`).
6. **Ce qui n'existe pas encore est écrit « bientôt »** à l'écran, jamais présenté comme disponible.

## 5. Son

- Une musique originale composée en local (orgue, cordes, chœur à l'aube), sur la grille des chapitres, à -14 LUFS. Budget 0 €.
- **Sans voix off par défaut.** Le texte animé porte le récit, et la vidéo se comprend sans le son.

## 6. Production, dans l'ordre (rien ne démarre avant ta validation de ce plan)

1. **Données de démo**, avec ton accord : retirer les contenus de test visibles sur la Communauté (club « efzfzefzz », posts « ezfererferf », « vdfvdfvdf »). Rien n'est supprimé sans ton accord.
2. **Tournage** sur l'app locale lancée depuis le dernier `main`, au compte de démo :
   - enregistrement de chaque geste (tiroirs, recherche, saisie du Compas, carnet, club) ;
   - composants recadrés à 3× ;
   - aucune validation, publication ni création réelle (on n'appuie jamais sur « Préparer », « Publier » ou SOS).
3. **Planche contact** de toutes les images par chapitre, envoyée pour contrôle.
4. **Animatique du chapitre 1** (30 s, rendu final) pour valider le style avant de lancer le reste.
5. Construction des chapitres 0 à 9, contrôle HyperFrames, captures de vérification.
6. Rendu, mixage, commit sur `claude/great-galileo-i6majd`, envoi.

## 7. Décisions qui t'appartiennent

1. **Format** : 16:9 (1920×1080, présentation, site, YouTube) avec une coupe 9:16 dérivée — *recommandé* — ou 9:16 seul.
2. **Voix off** : sans voix (*recommandé*, texte animé seul) ou avec une voix de synthèse provisoire.
3. **Nettoyage des données de démo** listées au point 6.1 : oui ou non.
4. **Durée** : ≈ 3 min 30 (*recommandé*, toute l'app) ou une version resserrée de 2 min.
