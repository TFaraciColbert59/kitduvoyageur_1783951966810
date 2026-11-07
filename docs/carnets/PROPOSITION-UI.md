# Carnets de bord — proposition de refonte (2026-11-07)

Mémoire de travail validée par Tony. Maquette visuelle : `docs/carnets/maquette-carnets-de-bord.html` (artifact privé https://claude.ai/artifact/AQXeh8mXkCQWTYvLuaeTGS). Rien n'est encore implémenté.

## 1. État constaté du code (07/11/2026)

- La liste `/carnets` n'existe pas : seule la fiche `src/app/carnets/[id]/page.tsx`. `MobileCarnetsHub`, `CarnetHubCard`, `CarnetHubHero`, `CarnetVerticalTabs`, `CarnetRightSidebar`, `CreateCarnetView` sont orphelins ; `CarnetScreen.tsx:157-158` pousse vers `/carnets` et `/carnets/nouveau` (inexistants).
- Un moment (`carnet_moments`) = citation + `image_url` + lieu texte + heure + jour. Ni type, ni vidéo, ni son, ni géoloc propre. Bucket `carnet-media` public sans contrôle MIME ni taille.
- Aucun statut de carnet (préparation / en route / rentré) : seule `visibility`.
- `identified_species` est écrit (`/api/carnet/identify-species`) mais jamais lu par le détail.
- `src/styles/carnet-profile.css` : aucune variable `--lkv-*`, couleurs littérales (`#C13B34`, `#dfe8dc`, `#6B7A70`…).
- Budget : absent du détail ; accessible via `carnets.trip_id` → `trip_expenses`.

## 2. Hiérarchie Visiteur / Participant (décision de Tony, 07/11/2026)

- Deux rôles vus depuis la fiche : **Participant** (peut modifier) et **Visiteur** (constate ce qu'il est autorisé à voir).
- Le mode édition s'ouvre par un **petit crayon en haut à gauche**, même style de bouton que la cloche de notification (`.gbtn` 38 px de `CarnetTopBar`). Le visiteur ne voit pas le crayon.
- Un carnet est « le bébé » d'un **groupe** ou d'un **voyageur seul** : il est toujours rattaché à l'un des deux. Les participants se suivent sur les deux (groupe ↔ carnet).

Voir la section 4 pour le modèle proposé et les failles à corriger d'abord.

## 3. Les 66 propositions

### Le hub /carnets (12)

Donner envie d'ouvrir un carnet avant d'avoir lu un mot. Aujourd'hui la route n'existe pas : les composants du hub sont orphelins.

1. **Créer la page /carnets** — Monter MobileCarnetsHub et CarnetHubCard (aujourd'hui orphelins) dans une vraie route, sur la grammaire Compte v3 : zéro scroll de page, scroll interne. _(correctif, P1)_
2. **Couverture plein visuel 4/5** — Photo pleine carte, voile encre en bas, titre en Instrument Serif italique, trois métriques mono : jours, km, D+. _(données existantes, P1)_
3. **Tracé en filigrane** — Le parcours en pointillé blanc dessiné sur la photo de couverture, à partir de la trace déjà calculée par CarnetCard. _(données existantes, P1)_
4. **Bande « En route maintenant »** — Carrousel en tête des carnets en cours, pastille vivante « J4 · il y a 2 h ». _(petite colonne, P2)_
5. **Couverture sans photo qui reste belle** — Mosaïque des trois dernières photos de moments ; sans photo du tout, carte topographique du tracé (courbes de niveau) au lieu de l'initiale. _(données existantes, P1)_
6. **Capsule de filtres** — En route · Suivis · Monde · Les miens, puis milieu (montagne, côte, désert, ville), durée et saison en sous-capsule. _(données existantes, P2)_
7. **Grille en mosaïque** — Desktop : colonnes de hauteurs variées selon le format de couverture. Mobile : une colonne, cartes 406 px. _(données existantes, P2)_
8. **Carte du monde des carnets** — Vue MapLibre avec points regroupés par massif, jamais par coordonnée. Un seul contexte WebGL (WebGLArbiter). _(données existantes, P2)_
9. **Feuilleter du doigt** — Glisser horizontalement sur une couverture fait défiler ses photos, comme on feuillette un carnet papier. _(données existantes, P2)_
10. **Tampon de pays** — Cachet rond en pointillé, incliné, avec massif, code pays et année : le visa du carnet. _(données existantes, P1)_
11. **Pastilles de non-lu sur les suivis** — Compteur de nouveaux moments depuis ma dernière visite sur les carnets que je suis (user_follows). _(petite colonne, P2)_
12. **Squelettes à la forme des cartes** — Chargement en silhouettes 4/5 au lieu d'un spinner centré au milieu d'une grille vide. _(données existantes, P1)_

### La couverture du carnet (8)

La première carte de la fiche doit dire où, quand, avec qui, et à quel point c'était dur, en un coup d'œil.

13. **Hero immersif dans la carte 406** — Photo (ou vidéo muette en boucle, lot 3) plein cadre, titre en surimpression sur voile encre. _(données existantes, P1)_
14. **Bandeau d'identité du voyage** — Dates, durée, avatars empilés des compagnons, tampon de pays, type d'aventure en icônes LkvIcon. _(données existantes, P1)_
15. **Chiffres du bord** — Quatre sous-cartes mono : km, D+, nuits, poids du sac, chacune avec une mini-courbe par jour. _(données existantes, P1)_
16. **Carte 3D qui se dessine** — Split 60/40 MapLibre ; le tracé se trace en 1,2 s à l'ouverture (statique si mouvement réduit). _(données existantes, P1)_
17. **Profil altimétrique synchronisé** — Sous la carte ; toucher un point surligne le jour et le moment correspondants. _(données existantes, P1)_
18. **Barre d'avancement** — Pour un carnet en cours : J4 sur 9, km faits sur km prévus (trip lié via trip_id). _(petite colonne, P2)_
19. **Citation d'ouverture** — Le premier moment avec citation, en serif italique sous le titre. _(données existantes, P2)_
20. **Suivre le carnet, pas seulement la personne** — Bouton distinct, avec le choix de notification au même endroit. _(nouveau schéma, P2)_

### Le fil de bord, jour par jour (9)

Chaque jour devient un chapitre, chaque moment a une forme selon ce qu'il raconte.

21. **Chapitres de jour** — Grand numéro mono, étape départ → arrivée, photo dominante du jour, stats du jour en pied. _(données existantes, P1)_
22. **Moments typés, une forme chacun** — Photo, vidéo, note vocale, texte, rencontre, dépense, objet du kit, espèce, bivouac, incident. Colonne kind sur carnet_moments. _(petite colonne, P1)_
23. **Ligne horaire du jour** — Les moments posés sur l'heure réelle, fond qui va de l'aube au crépuscule (lever et coucher calculés). _(données existantes, P2)_
24. **Météo du jour** — Pictogramme et température, depuis groupe_etapes.meteo et temperature_c, déjà lus. _(données existantes, P1)_
25. **Carte de nuit** — Refuge, bivouac ou hôtel avec icône de lune, altitude et nom d'hébergement (groupe_hebergements). _(données existantes, P2)_
26. **Mini-carte du jour** — Au swipe entre jours (existant), la carte zoome sur la portion du tracé de ce jour. _(données existantes, P1)_
27. **Carte postale du jour** — Un moment phare par jour, choisi par l'auteur ou le plus apprécié, mis en grand. _(petite colonne, P2)_
28. **Mode récit plein écran** — Une photo par écran, texte en surimpression, défilement vertical. Le plaisir de lecture d'une story, la durée en moins. _(données existantes, P2)_
29. **Sommaire de jours collant** — Pastilles J1 à J9 avec vignettes en haut du fil ; le jour courant en forest. _(données existantes, P1)_

### Photo, vidéo, son (6)

Aujourd'hui un moment ne porte qu'une image. Le bucket carnet-media n'a ni contrôle de type ni plafond de taille.

30. **Galerie plein écran tactile** — Swipe, pincer pour zoomer, légende, heure et lieu ; fermeture par glissement vers le bas. _(données existantes, P1)_
31. **Vidéos courtes** — 60 s max, lecture muette en boucle dans le fil, son au toucher. Colonne media_type, contrôle MIME et taille sur le bucket. _(nouveau schéma, P2)_
32. **Notes vocales et sons d'ambiance** — Forme d'onde dessinée dans une capsule, bouton 44 px, transcription affichée sous l'onde. _(nouveau schéma, P2)_
33. **Diaporama d'une journée** — Lecture enchaînée des photos du jour, avec la mini-carte qui suit. _(données existantes, P2)_
34. **Mosaïque adaptative** — Par jour : une grande et deux petites, ou trois en bande selon les formats ; fini la grille uniforme. _(données existantes, P1)_
35. **Détails de prise de vue** — Heure et altitude sous la photo, jamais de coordonnées. _(petite colonne, P2)_

### Suivre pendant le voyage (10)

Un suivi qui n'est pas un flux en continu : des signaux espacés, différés et choisis par le voyageur.

36. **Statut du carnet** — En préparation, en route, rentré. Pastille vivante sur l'avatar et la couverture. Colonne carnets.status. _(petite colonne, P1)_
37. **Signal de bord** — Publier en deux gestes depuis /randonnee-active : une photo et une ligne, rangées dans le jour courant. _(petite colonne, P1)_
38. **Position différée et floutée** — « Dernier signal : massif des Écrins, il y a 3 h ». Délai au choix (2 h minimum), cercle de zone, jamais de point. _(petite colonne, P1)_
39. **Battements** — Un trait par moment sur la journée : on voit le rythme du voyage sans rien lire. _(données existantes, P2)_
40. **Résumé du soir** — Généré à la fin de la journée : km, D+, photo phare, nuit. Envoyé aux suiveurs qui l'ont choisi. _(nouveau schéma, P1)_
41. **Choix de notification par suiveur** — À chaque moment, résumé du soir, ou seulement départ, sommets et arrivée. Tables notification_preferences existantes. _(nouveau schéma, P1)_
42. **Encouragements groupés** — Les réactions reçues pendant le voyage arrivent en un lot le soir, pour ne pas déranger sur le sentier. _(nouveau schéma, P2)_
43. **Compte à rebours de départ** — Pour un carnet en préparation lié à un voyage du Compas : J-12, avec le kit qui se remplit. _(données existantes, P2)_
44. **File d'attente hors ligne** — « 3 moments en attente d'envoi », envoyés au retour du réseau (useOfflineCache). _(données existantes, P2)_
45. **« Je vais bien »** — Pointage de sécurité visible des seuls proches, branché sur trip_safety_checkpoints. _(données existantes, P2)_

### Kit, objets, quincaillerie (6)

Le sac est un personnage du carnet. On doit voir ce qui a servi, et pouvoir le reprendre.

46. **Le sac en vue éclatée** — Objets en vignettes visuelles groupées par catégorie, poids total en grande métrique mono. _(données existantes, P1)_
47. **Verdict terrain par objet** — Essentiel, utile, jamais servi, défaillant, manquait : pastilles depuis kit_field_reports. _(données existantes, P1)_
48. **L'objet du jour** — Lier un moment à un objet (« la frontale m'a sauvé ») ; la carte objet apparaît dans le fil. _(petite colonne, P2)_
49. **Anneau du poids** — Répartition par catégorie : dormir, cuisiner, s'habiller, technique, eau. _(données existantes, P2)_
50. **Reprendre ce kit** — Ajouter à mon Compas ou forker, avec le vocabulaire public : lignée, kit souche, éprouvé. _(données existantes, P1)_
51. **Badge quincaillerie technique** — Corde, crampons, piolet, baudrier marqués à part, avec l'usage réel noté. _(petite colonne, P2)_

### Rencontres, budget, nature (6)

Ce qui fait qu'on se souvient d'un voyage, au-delà des kilomètres.

52. **Carte rencontre** — Portrait seulement avec consentement (sinon silhouette), prénom, lieu au niveau du village ou du massif, citation. _(nouveau schéma, P2)_
53. **Compagnons de route** — Avatars, rôle, jours partagés, depuis carnet_collaborators et hike_session_participants. _(données existantes, P1)_
54. **Le budget en reçu** — Carte façon ticket : total, par jour, par personne, barres par catégorie. trip_expenses via trip_id. _(données existantes, P2)_
55. **Coût par jour dans la frise** — Mini-barre de dépense sur chaque chapitre de jour. _(données existantes, P2)_
56. **Herbier et bestiaire** — Planche naturaliste des espèces identifiées. identified_species est déjà écrit en base mais jamais affiché. _(données existantes, P1)_
57. **Ciel et lumière** — Lever et coucher du soleil, phase de lune pour chaque nuit, calculés à partir de la date et du massif. _(données existantes, P2)_

### Engagement et finitions (9)

Ce qui rend la page sûre, accessible et cohérente avec le design système.

58. **Réactions sur chaque moment** — Les cinq réactions existantes (utile, sécurité, sac, feu, cœur) en pastilles verre, plus seulement sur le carnet. _(petite colonne, P2)_
59. **Commentaires ancrés** — Un commentaire rattaché à un moment, ouvert dans le tiroir à trois hauteurs. _(petite colonne, P2)_
60. **Préparer cette aventure** — Bouton qui ouvre le Compas avec la destination et la durée du carnet. _(données existantes, P1)_
61. **Livre de bord à imprimer** — Export A4 visuel : couverture, carte, un jour par double page, sans données privées. _(données existantes, P2)_
62. **États vides illustrés** — Sac vide dessiné, carte vierge à courbes de niveau, avec l'action pour remplir. _(données existantes, P1)_
63. **Haptique** — Retour léger au changement de jour, au j'aime et à l'envoi d'un signal (useHapticFeedback). _(données existantes, P2)_
64. **Accessibilité** — Texte alternatif sur chaque photo, transcription des notes vocales, voile encre pour un contraste AA sur photo, cibles 44 px. _(données existantes, P1)_
65. **Tokens au lieu des littéraux** — carnet-profile.css n'utilise aucune variable --lkv-* : remplacer #C13B34, #dfe8dc, #6B7A70 et les autres par des tokens. _(correctif, P1)_
66. **Mouvement sobre** — Animer seulement transform et opacity, tracé et pulsations coupés sous prefers-reduced-motion. _(données existantes, P1)_

## 4. Modèle de rôles proposé (réflexion du 07/11/2026, à valider)

**Constats dans le code et la base**
- `isOwner` = auteur seulement (`buildCarnetDetail.ts:171`) ; l'onglet Gérer est réservé à l'auteur (`CarnetPages.tsx:51`). Les collaborateurs ne peuvent rien modifier dans l'UI.
- Deux systèmes de groupes : `carnets.groupe_id` pointe vers l'ancien `groupes` (français), dont la dépréciation est préparée dans `supabase/migrations_deferred/20260923010000_deprecate_legacy_groupes.sql` ; le système actuel est `travel_groups` + `group_members` (rôle `group_member_role`, statut). `getCarnetDetail` lit encore `groupe_etapes` / `groupe_hebergements`.
- **Faille 1** : policy `carnet_collab_manage` (FOR ALL, `user_id = auth.uid()`) : tout utilisateur connecté peut s'inscrire lui-même dans `carnet_collaborators` de n'importe quel carnet, avec le rôle `owner`. Si les droits d'édition s'appuient sur cette table sans correction, c'est une élévation de privilège.
- **Faille 2** : policy `auth_manage_carnet_moments` (baseline prod) : `WITH CHECK (auth.uid() = auteur_id)` sans vérifier l'appartenance au carnet : un utilisateur connecté peut ajouter un moment dans le carnet d'un autre.
- **RGPD** : `hike_sessions_select_owner_or_public_carnet` expose à un anonyme les positions brutes des sorties d'un carnet public.

**Modèle**
- Rattachement exclusif : `carnets.travel_group_id` (groupe) **ou** `carnets.owner_id` seul (voyageur seul), contrainte CHECK « exactement un propriétaire ».
- Fonction unique `carnet_role(carnet_id, uid) → 'owner' | 'participant' | 'visitor'`, `SECURITY DEFINER STABLE`, `search_path` verrouillé : owner = auteur ; participant = membre actif du groupe rattaché, ou collaborateur `contributor` invité par l'owner ; sinon visitor. Les policies d'écriture (`carnets`, `carnet_moments`, `carnet_kit_items`, médias) appellent `can_edit_carnet()` ; lecture = `can_read_carnet()` (visibilité + rôle).
- Inscription dans `carnet_collaborators` : seulement par l'owner (ou admin du groupe), jamais par soi-même ; acceptation d'invitation via RPC.
- Côté UI : `detail.viewerRole` remplace `isOwner` ; crayon `.gbtn` en haut à gauche si `viewerRole !== 'visitor'` ; le crayon bascule la fiche en mode édition (chaque carte montre ses actions) ; l'auteur garde en plus l'onglet Gérer (rôles, visibilité, suppression).
- Ce que voit le visiteur : réglé par l'owner par chapitre (budget et position différée privés par défaut ; documents jamais).
- Suivi croisé : la fiche du groupe liste ses carnets et l'activité de chaque participant ; le carnet affiche les participants du groupe avec leurs contributions (moments par personne).

## 5. Architecture de la fiche (décision de Tony, 07/11/2026)

**Principe** : on garde l'unique fiche existante `/carnets/[id]` (`CarnetScreen`). Pas de nouvelle page.
- **En haut, la carte qui glisse** : page 0 = Résumé global, puis J1, J2… (`useDaySwipe`, déjà en place). Seule la partie haute change.
- **En bas, la carte 3D fixe** (`CarnetMapCard` → `CompteMap`) : elle ne bouge jamais de place ; seuls ses éléments changent pour concorder avec la page du haut. Résumé = tracé entier + repères de nuit ; jour n = tracé entier atténué, tracé du jour en avant, départ/arrivée, caméra cadrée sur le jour.
- **Un seul état de jour**, porté par `CarnetScreen` : il survit à l'ouverture d'un tiroir ; carte, tiroirs et capsule lisent la même valeur. Glisser à l'horizontale = changer de jour, partout (y compris dans un tiroir) ; changer de sous-tiroir = un toucher.

**Capsule du bas de la carte : 5 tiroirs (icônes seules), chacun avec sa sous-capsule 30 px.** Sur le Résumé un tiroir montre tout le voyage ; sur un jour, uniquement ce jour.

| Tiroir | Sous-tiroirs | Résumé | Jour |
|---|---|---|---|
| Fil de bord | Moments · Médias · Rencontres · Nature | carte postale de chaque jour | frise horaire du jour |
| Route | Étapes · Altitude · Nuit · Météo et ciel | toutes les étapes + GPX | étape du jour ; toucher une étape fait voler la carte |
| Sac | Kit · Verdicts · Poids | kit entier, « Reprendre ce kit » | objets cités ce jour |
| Chiffres | Distance · Dénivelé · Durée · Budget | barres par jour | valeurs du jour vs moyenne |
| Équipage | Participants · J'aime · Commentaires · Suivre | tout l'équipage | qui était là, échanges du jour |

- **Crayon** `.gbtn` 38 px en haut à gauche (style de la cloche), participants seulement : bascule la fiche en mode modification.
- **Menu ···** : Enregistrer, Partager, Copier le lien, Signaler ; propriétaire : Gérer (rôles, visibilité, export, suppression). La page Gérer et le volet Partage quittent le carrousel.
- **Visiteur** : un sous-tiroir non autorisé est masqué (pas grisé) ; documents jamais, budget et position privés par défaut.
- Correspondance avec l'existant : pages du carrousel Posts/Parcours/Étapes/Matériel/Nature/J'aime/Commentaires/Gérer et tiroir Stats/Partage → redistribués dans les 5 tiroirs ci-dessus.
