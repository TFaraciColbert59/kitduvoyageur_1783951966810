# Refonte des tiroirs Explorer

Nov 8, 2026 · @Tony

## Constat

Les deux tiroirs de la Communauté n'utilisent aucune primitive de `/compte` : 34 écarts relevés (12 communs, 10 dans Explorer, 12 dans Création), plus des défauts qui font perdre des saisies. Périmètre retenu : le tiroir Explorer (recherche, carnets, clubs, sorties) et le tiroir Création (6 formulaires) de `/communaute`.

| Tiroir | Volet | Problème principal |
| --- | --- | --- |
| Les deux | Coque | Tiroir maison : pas de sortie animée, voile qui ferme au moindre tap, fermeture à 80 px sans vitesse, aucun haptique, capsule 48 px au lieu de 56 |
| Explorer | Recherche | Hauteur 80 % écrasée par une règle CSS, champ en 13 px (zoom iOS), erreur réseau affichée comme « Aucun résultat » |
| Explorer | Carnets | Teintes hors palette, aucun état vide, « Créer » et « Tout voir » ramènent à la page courante |
| Explorer | Clubs | Bouton Rejoindre de 30 px, double envoi possible, détail sans retour |
| Explorer | Sorties | Aucun lien vers la fiche, pas d'état « complet » |
| Création | Publication | Une seule étape empilée, médias refusés seulement à l'envoi si l'audience n'est pas publique |
| Création | Story | Capsule d'étapes en portail à part, pas de recadrage 9:16 |
| Création | Carnet | Aucun brouillon : fermer détruit tracé, jours et photos ; photos jamais téléversées ; bouton ✓ de 44×30 |
| Création | Sortie | Activité choisie deux fois, rendez-vous sans coordonnées, erreur de date affichée deux fois |
| Création | Kit | Champ couverture sans interface, sélecteur produit en fenêtre dans la fenêtre |
| Création | Club | Image obligatoire, club créé même si l'adhésion de l'admin échoue |

Défauts communs aux 6 formulaires : tous les libellés sont masqués en CSS (placeholders seuls, dates et listes sans aucun texte), champs en 13 px, bouton « Continuer » masqué et « Retour » jamais affiché, cinq façons différentes de naviguer entre les étapes.

## Principes de la refonte

Cinq règles valent pour les deux tiroirs ; les 200 améliorations qui suivent les déclinent volet par volet.

1. **Une seule coque, celle de `/compte`.** `SlotShell`, `DrawerShell`, `LensPager` et `OverlaySheet` remplacent `CommunityDrawer`. Entrée en 0,72 s, sortie en 0,56 s, poignée avec rubber-band (seuil 30 % ou 0,55 px/ms), fond inerte, haptique, pas de fermeture au tap hors du tiroir.
2. **Une seule grammaire de navigation.** La capsule de 56 px choisit le volet ou le type de création. La mini-capsule de 30 px, en bas à droite, choisit le filtre ou l'étape. Le glisser horizontal suit le doigt. Les détails s'empilent avec un bouton ‹ Retour.
3. **Une originalité tirée du voyage, dans les jetons.** Chaque volet a sa signature : tampon de visa pour les carnets, blason pour les clubs, billet daté pour les sorties, aperçu vivant pour les formulaires. Ces signatures n'utilisent aucune couleur hors de `tokens.css`. Teintes : uniquement des verts, aucune teinte jaune ni ocre.
4. **Des formulaires d'app native.** Un seul moteur pour les 6 types : étapes visibles avec Suivant et Retour, libellés visibles, champs en 16 px de 44 à 48 px de haut, erreurs en ligne affichées une seule fois, brouillon partout avec un bandeau « Brouillon restauré », clavier géré avec `visualViewport`.
5. **Toujours un état lisible.** Skeleton au chargement, état vide avec une action, erreur avec Réessayer, confirmation par l'île dynamique avec Annuler. Cibles de 44 px minimum et `prefers-reduced-motion` respecté partout.

## Tiroir Explorer

Le tiroir devient un tiroir à 4 slots de `/compte` (Recherche, Carnets, Clubs, Sorties). La capsule reste toujours visible, et les filtres de chaque volet passent dans la mini-capsule.

### Recherche

1. **Un volet à part entière** : la loupe devient le premier slot de la capsule, qui reste visible au lieu de disparaître.
2. **Hauteur réelle** : un seul snap « card » comme `/compte`. La règle 50 dvh qui annule les 80 % est supprimée.
3. **Champ natif** : 48 px en verre de barre, texte en 16 px (plus de zoom iOS), loupe en 20 px, bouton Effacer de 44 px.
4. **Accueil non vide** : recherches récentes en chips supprimables, tendances de la semaine, lieux populaires.
5. **Filtres en mini-capsule** (Tout, Posts, Carnets, Clubs, Sorties, Membres), qui remplacent le `scope` orphelin.
6. **En-têtes de groupe visibles** : eyebrow 600 en 10,5 px, compteur et « Voir tout ».
7. **Teintes par type en jetons** (`--type-carnet`, `--type-club`…) uniquement dans les verts de la palette (forêt, sauge, mousse, menthe) : plus aucune teinte jaune, ocre ou terre cuite. Pastille en 10,5 px minimum au lieu de 8,5 px.
8. **Terme surligné** dans le titre et le texte de chaque résultat.
9. **Recherche tolérante** via une RPC (`unaccent` + trigrammes) : accents et fautes acceptés, virgules et parenthèses ne cassent plus le filtre.
10. **Erreur distincte** : « Recherche indisponible » avec Réessayer, et non plus « Aucun résultat ».
11. **Zéro résultat utile** : orthographe suggérée, mots proches, et « Créer une sortie “X” ».
12. **Skeleton de lignes** avec la cascade `sheetRowIn` au lieu du texte « Recherche… ».
13. **Liens profonds corrects** : membre vers `/profil/<handle>`, sortie vers sa fiche (aujourd'hui `/communaute`).
14. **Appui long → aperçu** (Peek & Pop) d'un résultat : Ouvrir, Enregistrer, Partager.
15. **Originalité, « Sur la carte »** : une bascule affiche les carnets et sorties trouvés sur une mini-carte topo dans le tiroir.
16. **Originalité, chips de contexte** : « Ce week-end », « Facile », « Moins de 2 h », « Près de moi », combinables avec le texte.
17. **Près de moi** : géolocalisation à la demande, avec distance affichée sur chaque résultat.
18. **Haptique** : sélection au changement de filtre, léger à l'ouverture d'un résultat.
19. **Clavier et lecteurs d'écran** : ↑ ↓ parcourent les résultats, Entrée ouvre, Échap efface puis ferme, nombre de résultats annoncé en `aria-live`.
20. **Mémoire** : requête, filtre et position de défilement conservés à la réouverture du tiroir.

### Carnets

1. **Tuiles au verre de `/compte`** (`--drawer-card-*`, rayon 14 à 20) au lieu du dégradé foncé hors palette.
2. **Originalité, tampon de visa** : un bandeau en bas de couverture affiche pays, jours et km dans un cartouche tamponné.
3. **Mosaïque éditoriale** : un « carnet de la semaine » en pleine largeur, puis la grille de 2 colonnes.
4. **Carnets vivants** : anneau conique animé et pastille « En route », comme sur la fiche carnet v2.
5. **Originalité, trace en filigrane** : le tracé du parcours en SVG fin sur la couverture.
6. **Filtres en mini-capsule** : Découvrir, Mes carnets, Suivis, Près de moi.
7. **Tri dans un menu discret** : un bouton rond de 30 px tout à droite de la mini-capsule du bas ouvre un petit menu (récents, populaires, proches, durée) ; un point vert signale un tri autre que « récents ».
8. **J'aime de `/compte`** : cible de 44 px, couleur `--like`, animation pop, haptique.
9. **Voyageurs empilés** : 3 avatars maximum sur la tuile, avec « +n ».
10. **Titre et méta harmonisés** : 600 en 14 px aligné à gauche, méta en 10,5 px (lieu · jours · km).
11. **Badge « Trace GPS vérifiée »** pour les carnets issus d'une sortie enregistrée.
12. **Appui long → aperçu** : Lire, Enregistrer, Partager.
13. **Transition partagée** : la couverture de la tuile se transforme en couverture de la fiche carnet.
14. **Pagination infinie** au lieu des 12 carnets fixes.
15. **Compteurs côté serveur** : fin du chargement de 5 000 lignes de likes et commentaires comptées dans le navigateur.
16. **Skeleton** de tuiles 4/5.
17. **État vide « Mes carnets »** avec une illustration et « Créer mon premier carnet », qui ouvre Création sur le type Carnet.
18. **Erreur avec Réessayer**, branchée sur le `reload` déjà exposé.
19. **« Créer » et « Tout voir » réparés** : Création sur le type Carnet, et hub des carnets filtré.
20. **Accessibilité** : la tuile est un seul lien avec un libellé complet, j'aime et commentaires sont des boutons distincts hors du lien.

## Tiroir Création

Les 6 types passent dans la capsule de 56 px avec sa lentille animée (aujourd'hui masquée), et partagent un seul moteur de formulaire. Les étapes sont dans la mini-capsule en bas à droite, avec des boutons Suivant et Retour toujours visibles et un aperçu vivant en tête.

### Publication

1. **Vraies étapes** : Format, Contenu, Diffusion, au lieu d'une seule page empilée.
2. **Libellés visibles** (600 en 10 px majuscules, comme `/compte`), avec les placeholders en exemples.
3. **Champs natifs** : 16 px, 44 à 48 px de haut, rayon et verre de `/compte`.
4. **Originalité, aperçu vivant** : le vrai composant post (`CommunityFeedPost`) se remplit pendant la saisie, tel qu'il apparaîtra dans le fil.
5. **Audience avant les médias**, ou avertissement immédiat si l'audience choisie interdit les médias, au lieu d'un refus à l'envoi.
6. **Médias au doigt** : réordonner par glisser tactile, supprimer avec un bouton visible de 44 px (fin du double-clic).
7. **Recadrage** en 4:5, 1:1 ou original, avec une grille de cadrage.
8. **Rappel doux** quand le texte alternatif manque, sans bloquer.
9. **Mentions @ et hashtags #** avec suggestions.
10. **Lieu « Ma position »** par géolocalisation, avec coordonnées enregistrées pour la carte.
11. **Sondage** : options de 44 px, glisser pour réordonner, durée du sondage.
12. **Événement délégué au formulaire Sortie**, ce qui supprime la double insertion événement + post sans retour arrière.
13. **Options exposées** : autoriser les commentaires et les j'aime (déjà dans le schéma).
14. **Programmation** : sélecteur date et heure en verre, avec libellé et fuseau.
15. **Compteur de caractères** discret, qui change de couleur à l'approche de la limite.
16. **Bandeau « Brouillon restauré · Effacer »**, avec une sauvegarde aussi à `pagehide`.
17. **Erreur serveur affichée une seule fois**, près du bouton Publier.
18. **Publier avec progression** : le bouton reste désactivé tant que les médias s'envoient, avec un message clair.
19. **Confirmation par l'île** « Publié » avec « Voir », au lieu d'un toast générique.
20. **Clavier mobile** : pied de formulaire au-dessus du clavier (`visualViewport`) et champ actif ramené à l'écran.

### Story

1. **Capsule d'étapes à sa place** dans le tiroir, en bas à droite, au lieu d'un portail fixe en z-index 2147483000.
2. **Originalité, éditeur plein cadre** : on compose directement dans le visualiseur de stories, en 9:16, avec les mêmes barres et le même dock.
3. **Cadrage 9:16* par pincement et glisser.
4. **Texte posé libre** : déplaçable, redimensionnable et pivotable au doigt, en 3 styles issus des jetons.
5. **Originalité, stickers voyage** alimentés par les données : lieu, altitude, météo, distance du jour.
6. **Lien en sticker**, validé en direct.
7. **Rognage vidéo réel** (`StoryTrim`) avec lecture de l'extrait.
8. **Caméra directe** via Capacitor, en plus de la galerie.
9. **Audience « Amis proches »** (la table `story_close_friends` existe déjà).
10. **Réponses** : libellés clairs alignés sur `reply_policy`.
11. **Lier à un carnet** : rattacher la story à un jour de carnet.
12. **Aperçu final exact** avant de publier.
13. **Libellés visibles** et champs en 16 px.
14. **Suivant et Retour visibles**.
15. **Envoi lisible** : progression sur la vignette, réessai, compression avant l'envoi.
16. **Bandeau de brouillon** (le média déjà envoyé est conservé).
17. **Erreurs en ligne et en direct**, par exemple un lien invalide.
18. **Haptique** à chaque étape et à la publication.
19. **Confirmation par l'île** « Story publiée » avec « Voir ».
20. **Accessibilité** : texte alternatif de la story et ordre de focus logique dans l'éditeur.

## Priorisation

Trois lots, dans cet ordre : d'abord ce qui fait perdre des données ou casse l'usage, ensuite l'harmonisation, enfin l'originalité.

1. **Lot 1, socle et correctifs.** Coque `/compte` commune aux deux tiroirs, capsule de 56 px et mini-capsule. Moteur de formulaire unique avec libellés visibles, champs en 16 px, Suivant et Retour, erreurs affichées une fois. Brouillon et photos réellement envoyées pour le Carnet. Liens profonds réparés, Réessayer partout, cibles de 44 px.
2. **Lot 2, harmonisation des volets.** Verre, typographie et jetons de `/compte` sur toutes les tuiles. Détails empilés, états vides, skeletons, île de confirmation, haptique. Données fiabilisées (RPC atomiques, compteurs serveur, vraies colonnes pour les sorties).
3. **Lot 3, originalité.** Tampon de visa, trace en filigrane, blason, billet daté, bande agenda, aperçus vivants, éditeur de story plein cadre avec stickers voyage, scan d'objets, recherche sur la carte.

Prochaine étape proposée : une maquette navigable des deux tiroirs, comme pour la fiche carnet, puis un bundle d'implémentation pour l'agent.

Question ouverte : faut-il garder un voile qui ferme le tiroir au tap sur la Communauté, ou s'aligner strictement sur `/compte`, qui n'en a pas ?

### Clubs

1. **Tuiles au verre de `/compte`** avec méta en 10,5 px et titre 600 en 14 px.
2. **Originalité, blason** : sans image, un écusson est généré à partir de l'initiale et de l'icône de l'activité, avec une teinte en jeton.
3. **Carte « Club du mois »** en pleine largeur en tête de volet.
4. **Bouton Rejoindre en pilule de 44 px**, avec des états clairs : Rejoindre, Demande envoyée, Membre ✓. Quitter passe dans un menu.
5. **Adhésion sur validation visible** : cadenas sur la tuile, et l'action envoie une demande au lieu d'une adhésion directe.
6. **Fiabilité** : bouton occupé pendant l'envoi (pas de double clic), `members_count` tenu par une RPC atomique au lieu de deux requêtes côté client.
7. **Détail empilé** avec ‹ Retour et cascade d'entrée, au lieu de remplacer la liste sur place.
8. **Détail riche** : prochaines sorties du club, membres en avatars, règles, dernières publications.
9. **Signal d'activité** : sorties du mois et dernière publication, plutôt que le seul nombre de membres.
10. **Membres en commun** : « 3 amis sont membres », avec leurs avatars.
11. **Filtres en mini-capsule** : Découvrir, Mes clubs, Près de moi.
12. **Chips d'activité** (rando, ski, vélo, escalade…) pour filtrer la grille.
13. **Tri** par activité récente, proximité ou taille, dans le même menu à droite de la mini-capsule du bas.
14. **Glisser entre clubs dans le détail** en suivant le doigt (`LensPager`) au lieu d'un saut sans animation.
15. **Appui long → aperçu** : Voir, Rejoindre, Partager.
16. **Confirmation par l'île** « Club rejoint » avec Annuler, plus un haptique de succès.
17. **État vide « Mes clubs »** avec « Créer un club » et « Explorer par activité ».
18. **Erreur avec Réessayer** et skeleton de tuiles.
19. **« Voir la page »** en bouton secondaire clair, avec un lien par slug.
20. **Accessibilité** : `aria-pressed` et libellé complet sur Rejoindre, changement d'état annoncé.

### Sorties

1. **Originalité, billet daté** : grand cartouche jour et mois à gauche, façon tampon de billet, et topo de la sortie à droite.
2. **Originalité, bande agenda** : en tête, les 14 prochains jours sont marqués d'un point par sortie. Toucher un jour filtre la liste.
3. **Liste chronologique** groupée en « Ce week-end », « La semaine prochaine » et « Plus tard », en alternative à la grille.
4. **Jauge de places** (`CapacityGauge`), avec les états Complet et Liste d'attente réellement gérés.
5. **Bouton S'inscrire de 44 px** avec les états Inscrit ✓, Liste d'attente et Complet.
6. **Lien vers la fiche de la sortie**, au lieu de `/communaute`.
7. **Chips de méta** : niveau, distance, D+, durée.
8. **Météo prévue** du jour J sur la tuile, à partir de J-7.
9. **Rendez-vous sur mini-carte** dans le détail, avec « Itinéraire ».
10. **Organisateur mis en avant** avec la pilule auteur de `/compte`.
11. **Participants et amis inscrits** en avatars empilés.
12. **Filtres en mini-capsule** : Découvrir, Mes sorties, Près de moi.
13. **Détail empilé** avec ‹ Retour.
14. **Ajouter au calendrier** (fichier .ics partagé) et rappel la veille, selon les préférences de notifications.
15. **Sorties passées** : récap et lien vers le carnet né de la sortie.
16. **Confirmation par l'île** « Inscription confirmée » avec Annuler, plus un haptique.
17. **État vide** avec « Organiser une sortie », qui ouvre Création sur le type Sortie.
18. **Erreur avec Réessayer**, bouton occupé pendant l'envoi, skeleton.
19. **Tuiles harmonisées** : verre de `/compte`, titre 600 en 14 px, plus de bouton d'action de 30 px.
20. **Accessibilité** : date lue en entier (« samedi 14 novembre »), places restantes annoncées.

### Carnet

1. **Brouillon et confirmation de fermeture** : fermer, glisser la poignée ou toucher à côté ne détruit plus le tracé, les jours ni les moments.
2. **Photos des moments téléversées** : aujourd'hui ce sont des `blob:` locaux, retirés à l'envoi.
3. **Couverture** choisie parmi les photos, la première par défaut (aujourd'hui envoyée vide).
4. **Visibilité choisie** (Public, Amis, Privé), Privé par défaut comme en base, au lieu d'un Public imposé sans champ.
5. **Même grammaire que les autres** : étapes Infos, Tracé, Jours, Partage dans la mini-capsule, avec le moteur commun.
6. **Deux points de départ** : tracer sur la carte, ou importer un GPX ou une sortie déjà enregistrée (`hike_sessions`).
7. **« Ma position »** pour centrer la carte et commencer le tracé.
8. **Tracé éditable** : annuler et rétablir, points déplaçables, segment supprimable.
9. **Profil d'altitude en direct** sous la carte pendant le tracé.
10. **Originalité, aperçu fiche** : la carte du carnet telle qu'elle apparaîtra (couverture, stats, tracé), qui se remplit au fil de la saisie.
11. **Jours en mini-capsule**, avec glisser entre les jours qui suit le doigt.
12. **Moments typés** comme dans la fiche carnet v2 : photo, rencontre, nuit, dépense, objet, espèce.
13. **Nuits et refuges par jour**, cohérents avec la table `carnet_nights` du bundle.
14. **Voyageurs** : inviter des participants (collaborateurs) dès la création.
15. **Dates cohérentes** : libellés visibles, nombre de jours proposé à partir des dates, et inversement.
16. **Erreurs en ligne par champ**, au lieu d'un seul bandeau avec la première erreur.
17. **Bouton « Créer le carnet » en pilule libellée** de 44 px, au lieu d'une icône ✓ de 44×30.
18. **Aide à l'écriture du récit** reprise du formulaire orphelin `CarnetCreateForm`, puis suppression de ce fichier mort.
19. **Hors ligne** : tracé et saisie conservés sans réseau, envoi à la reconnexion.
20. **Accessibilité** : jours en `tablist` complet, carte dotée d'une alternative (liste des points) et champs en 16 px.

### Sortie

1. **Un seul choix d'activité** : chips icônes (rando, trail, ski de rando, vélo, escalade, autre), qui remplacent le doublon recherche + liste.
2. **Suivant et Retour visibles**, libellés visibles, champs en 16 px.
3. **Rendez-vous sur mini-carte** avec une épingle déplaçable et des coordonnées enregistrées (aujourd'hui aucune).
4. **Date et heure du rendez-vous** (aujourd'hui la date seule).
5. **Itinéraire importé** depuis une trace, un carnet ou un itinéraire existant, avec distance et D+ calculés.
6. **Échelle de difficulté tactile** (`DifficultyLadder`) de 44 px, avec la définition de chaque niveau.
7. **Originalité, météo en direct** : les prévisions du jour choisi s'affichent des que la date et le lieu sont connus.
8. **Capacité** : stepper de 44 px et liste d'attente, avec la jauge en ouvert.
9. **Matériel requis tiré d'un kit** : choisir un kit existant ou cocher des objets.
10. **Check-list de sécurité en chips** (DVA, pelle, sonde, frontale, eau) plus un champ libre.
11. **Inviter des amis ou un club** dès la création.
12. **Récurrence** : « chaque samedi » ou « chaque mois ».
13. **Originalité, aperçu billet** : la tuile billet daté de l'Explorer se remplit en direct.
14. **Vraies colonnes en base** : niveau, distance, D+ et rendez-vous ne sont plus encodés dans la description.
15. **Envoi fiable** : la publication qui annonce la sortie part dans la même transaction, ou n'est pas créée.
16. **Erreur de date affichée une seule fois**, au lieu de deux.
17. **Bandeau de brouillon**.
18. **Confirmation par l'île** « Sortie créée » avec « Partager ».
19. **Clavier** : les flèches ne changent plus d'étape quand le curseur est dans un champ.
20. **Accessibilité** : groupes de champs avec `fieldset` et `legend` visibles, et erreurs reliées par `aria-describedby`.

### Kit

1. **Couverture** : un champ ajouté, ou une mosaïque générée avec les photos des objets (le schéma prévoit `cover`, sans interface aujourd'hui).
2. **Sélecteur de produit en sous-tiroir empilé** avec ‹ Retour, au lieu d'une fenêtre ouverte dans une fenêtre.
3. **Originalité, scan** : ajout d'un objet par code-barres avec la caméra.
4. **Partir d'un kit existant** : son propre kit, un kit « Repris » depuis un carnet, ou un modèle.
5. **Originalité, sac en couches** : vue du sac remplie par catégorie, avec un anneau de poids animé (`KitRing`).
6. **Poids total en direct** avec une jauge d'objectif (ultraléger, léger, standard).
7. **Quantités par objet**, par exemple 2 × chaussettes.
8. **Glisser pour classer** un objet d'une catégorie à l'autre et le réordonner.
9. **Suggestions contextuelles** selon le modèle, la saison et la météo du lieu.
10. **Objets personnalisés** : champs libellés en 16 px, poids avec stepper, catégorie en chips.
11. **Mode préparation** : check-list « emporté » à cocher avant le départ.
12. **Lien avec les Prêts** de `/compte` : indiquer les objets empruntés.
13. **Nom proposé automatiquement**, par exemple « Kit bivouac été · 7,5 kg », modifiable.
14. **Visibilité** Public, Amis ou Privé, en chips visibles et non plus dans un repli.
15. **Unités** métriques ou impériales selon les préférences du compte.
16. **Erreur « Ajoute au moins un objet avec un poids » en ligne** dès l'étape Inventaire, et non plus à l'envoi.
17. **Originalité, aperçu** : la `KitCard` de `/compte` se remplit en direct.
18. **Suivant et Retour visibles**, libellés visibles.
19. **Bandeau de brouillon**.
20. **Confirmation par l'île** « Kit créé » avec « Partager » et « Utiliser pour une sortie ».

### Club

1. **Originalité, blason généré** : sans image, un écusson est généré à partir du nom et de l'activité. L'image n'est plus bloquante.
2. **Image** : recadrage carré pour l'avatar et 3:1 pour la bannière.
3. **Activités en chips icônes**, plusieurs possibles, au lieu d'un champ de recherche libre.
4. **Zone d'activité** : lieu sur mini-carte avec un rayon.
5. **Adresse du club** : disponibilité du slug vérifiée en direct, avec l'aperçu de l'URL.
6. **Modération en ligne** pendant la saisie, et non plus à l'envoi.
7. **Adhésion en cartes explicatives** : « Ouvert » ou « Sur validation », chacune avec ce que cela implique.
8. **Questions d'adhésion** : lignes de 44 px, réordonnables, 3 au maximum.
9. **Modèles de charte** prêts à adapter (randonnée, alpinisme, vélo).
10. **Visibilité du club** : public, privé ou secret.
11. **Co-administrateurs** choisis dès la création.
12. **Inviter des membres** parmi ses abonnés ou par lien.
13. **Post d'accueil** avec un aperçu modifiable.
14. **Enchaînement** : à la fin, « Organiser la première sortie » ouvre Création sur le type Sortie, prérempli avec le club.
15. **Création atomique** : club et administrateur créés par une seule RPC, sans club orphelin si l'adhésion échoue.
16. **Originalité, aperçu** : la tuile club avec son blason se remplit en direct.
17. **Suivant et Retour visibles**, libellés visibles, champs en 16 px.
18. **Bandeau de brouillon**.
19. **Confirmation par l'île** « Club créé » avec ouverture de la page du club.
20. **Accessibilité** : cartes d'adhésion en `radiogroup`, erreurs reliées aux champs, ordre de focus logique.
