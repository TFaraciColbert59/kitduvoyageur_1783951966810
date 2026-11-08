# 01 — Spécification produit

Deux sources font foi, dans cet ordre :
1. **La maquette** `annexes/maquette-communaute.html` (Chrome, fichier local). Panneau démo à droite : ouvrir chaque volet et chaque type, rôle connecté ou invité, états (chargement, vide, erreur, hors ligne), réinitialiser, liste des gestes.
2. **Le document de refonte** `annexes/D-document-refonte.md` : constat, 5 principes et **20 améliorations numérotées par volet** (Recherche, Carnets, Clubs, Sorties, Publication, Story, Carnet, Sortie, Kit, Club). Chaque numéro est une exigence. Cite-les dans tes commits et dans le rapport sous la forme `Clubs#6`.

Ce fichier donne la structure, les comportements transverses et les points que le document ne fixe pas.

---

## 1. Page `/communaute` (inchangée sauf déclencheurs)

Barre haute (« Explorer », loupe, `+`), barre des stories (bulle `+`), fil, tab bar : rendu actuel conservé. Quand un tiroir est ouvert, tout le fond est `inert` (comme `/compte`).

| Déclencheur | Ouvre |
|---|---|
| Bouton « Explorer » | Explorer, volet mémorisé (défaut Carnets) |
| Loupe | Explorer › Recherche, champ focalisé |
| `+` de la barre haute | Création › Publication |
| `+` de la barre des stories | Création › Story |
| CTA d'un état vide (« Créer mon premier carnet », « Organiser une sortie », « Créer un club ») | Création sur le type correspondant |
| « Organiser la première sortie » (fin de Club) | Création › Sortie, préremplie avec le club |
| « Utiliser pour une sortie » (fin de Kit) | Création › Sortie, préremplie avec le kit |

Invité ou anonyme : Explorer s'ouvre en lecture ; toute action d'écriture (like, rejoindre, s'inscrire, ouvrir Création) passe par `requireAuth` existant.

## 2. Coque commune aux deux tiroirs

- Coque de `/compte` : un seul snap « card », clippé, entrée .72 s `cubic-bezier(.16,1,.3,1)`, sortie .56 s, poignée avec rubber-band (fermeture à 30 % ou 0,55 px/ms), **pas de voile**, fond `inert`, piège de focus, focus rendu au déclencheur, Échap (ordre : menu de tri → aperçu Peek → confirmation → détail empilé → tiroir).
- Matériaux : ceux du tiroir et des cartes de `/compte` (jetons à créer, `02` § 3 bis ; cartes rayon 14 à 20), marges et rayons de `/compte`.
- Capsule 56 px avec lentille animée (.42 s `cubic-bezier(.32,.72,0,1)`), toujours visible (y compris en Recherche).
- Mini-capsule 30 px en bas à droite, lentille .28 s spring. Glisser horizontal = LensPager (verrou d'axe 8 px, seuil 48 px, 420 ms). Le volet change seulement par la capsule.
- **Bouton de tri** (Carnets, Clubs) : à droite de la mini-capsule, voir `00` § 3.
- Pile de détails `pushSheet` avec `‹ Retour` et cascade `sheetRowIn` .45 s.
- Île dynamique de confirmation avec Annuler quand l'action est réversible ; `haptic()` aux mêmes moments que `/compte`.
- Peek & Pop : appui long 460 ms sur une tuile → aperçu + 3 actions (doc).
- États par volet : skeleton à la première ouverture (puis cache), vide avec action, erreur « … indisponible » avec Réessayer, hors ligne (bandeau + dernier contenu). Jamais « Aucun résultat » pour une erreur.
- `prefers-reduced-motion` : fondus courts à la place des glissements, comme `/compte`.
- Mémoire : volet, filtre, tri, requête et position de défilement conservés à la réouverture pendant la session (état en mémoire, pas de stockage).

## 3. Tiroir Explorer

| Volet (capsule) | Filtres (mini-capsule) | Tri (menu) |
|---|---|---|
| Recherche | Tout, Posts, Carnets, Clubs, Sorties, Membres | — |
| Carnets | Découvrir, Mes carnets, Suivis, Près de moi | Récents, Populaires, Proches, Durée |
| Clubs | Découvrir, Mes clubs, Près de moi (+ chips d'activité en tête) | Activité récente, Proches, Taille |
| Sorties | Découvrir, Mes sorties, Près de moi (+ bande agenda 14 jours en tête) | — (ordre chronologique fixe) |

« Près de moi » demande la position au premier usage (Capacitor Geolocation sur iOS, `navigator.geolocation` sur le web) ; refus = état explicatif avec bouton « Autoriser », jamais d'erreur muette. Les distances affichées viennent du serveur (RPC, `03`).

Détails empilés : carnet (navigue vers `/carnets/<id>` ; la transition partagée Carnets#13 est reportée), club (Clubs#7-10, glisser entre clubs Clubs#14), sortie (Sorties#9-11, 14, 15), membre (lien profil). Recherche : accueil (récents supprimables, tendances, lieux), résultats groupés avec en-têtes, terme surligné, « Sur la carte » (mini-carte MapLibre de la stack existante, pas de nouvelle origine CSP), clavier ↑ ↓ Entrée Échap, `aria-live`.

Signatures visuelles (doc, uniquement des verts) : tampon de visa et trace en filigrane (carnets), blason généré (clubs), billet daté et bande agenda (sorties).

## 4. Tiroir Création

### 4.1 Moteur commun
`CreateFormEngine` reste la base (react-hook-form + zod) mais devient le moteur V2 :
- étapes dans la mini-capsule 30 px (plus de capsule en portail z 2147483000, plus de barre inline) ;
- pied fixe avec **Retour** (masqué à l'étape 1) et **Suivant** ; dernière étape = action finale nommée (« Publier », « Publier la story », « Créer le carnet », « Créer la sortie », « Créer le kit », « Créer le club ») ; Suivant valide l'étape et amène le focus sur le premier champ fautif ;
- libellés visibles : les règles `display:none !important` de `community-feed.css` (≈ L2249-2282) masquent `label`, `hint`, `legend` et servent la v1 : **ne les supprime pas**. La V2 n'utilise pas les classes `lkdv-form-*`, `lkdv-create-engine`, `lkdv-field-required` (cette dernière porte la teinte interdite `#A05A3C`) ; elle a ses propres classes sous `.lkdv-communaute-v2` ;
- une erreur = un seul message, sous le champ (`aria-describedby`) ; après un Suivant ou un envoi raté, un compteur en tête (« 2 champs à corriger ») amène le focus sans répéter les messages ; l'erreur serveur s'affiche une fois, près du bouton ;
- brouillon pour les 6 types (dont Carnet), écrit à 400 ms, à la fermeture et à `pagehide`/`visibilitychange` ; bandeau « Brouillon restauré · Effacer » ;
- confirmation de fermeture existante (`CloseDraftConfirm`) avec piège de focus ;
- clavier : `visualViewport` (réutilise `src/hooks/useKeyboardInsets.ts`) → le pied reste au-dessus du clavier, champ actif ramené à l'écran ; les flèches ne changent pas d'étape quand le focus est dans un champ ;
- envoi : bouton occupé + progression ; succès = île « … publié(e) » avec action (Voir, Partager, Ouvrir la page) puis fermeture et rafraîchissement du fil ou des stories.

### 4.2 Étapes par type (contenu détaillé : doc + maquette)
| Type | Étapes |
|---|---|
| Publication | Format, Contenu, Diffusion |
| Story | Média, Édition, Diffusion (éditeur plein cadre 9:16, stickers lieu/altitude/météo/distance, texte déplaçable) |
| Carnet | Infos, Tracé, Jours, Partage |
| Sortie | Activité et lieu, Itinéraire, Participants, Sécurité |
| Kit | Inventaire, Compléter, Partager |
| Club | Identité, Univers, Adhésion, Publication |

### 4.3 Règles de données à respecter
- Publication : médias autorisés seulement si l'audience le permet → l'audience est choisie **avant** les médias et l'avertissement est immédiat (Publication#5). Le format « Événement » délègue au formulaire Sortie (Publication#12).
- Médias : images ≤ 10 Mo pour tous les types sauf Story (images ou vidéo ≤ 25 Mo, ≤ 60 s) ; refus dès la sélection avec un message clair.
- Story : bucket `stories-private`, URL signée ; rognage vidéo réel (début/fin stockés, voir `03`) ; audience « Amis proches » via `story_close_friends` existant.
- Carnet : photos de moments téléversées dans le bucket des carnets avant l'envoi ; couverture = une des photos ; visibilité Public/Amis/Privé (Privé par défaut) ; nuits seulement si `carnet_nights` existe (`00` § 2) ; récupère l'aide à l'écriture du récit de `CarnetCreateForm.tsx` puis supprime ce fichier orphelin (Carnet#18).
- Sortie : activité unique (chips), RDV sur mini-carte avec coordonnées, date **et** heure, vraies colonnes (niveau, distance, D+, RDV, capacité, liste d'attente, sécurité, récurrence) ; création + post d'annonce dans une seule RPC (Sortie#15).
- Kit : sélecteur de produit en sous-tiroir empilé (plus de dialogue dans le dialogue) ; poids total calculé en SQL ; visibilité Public / Privé en chips.
- Club : image facultative (blason généré sinon), slug vérifié en direct, création club + admin atomique (Club#15) ; adhésion Ouvert (`open`) / Sur validation (`closed`) ; questions d'adhésion stockées en `join_questions`, réponses en `club_join_requests.answers`.

### 4.4 Fiche sortie
Aucune route de fiche sortie n'existe (pas de `/evenements` ni `/sorties`, seulement l'onglet `/communaute?tab=evenements`) : crée `src/app/sorties/[id]/page.tsx` minimale au système `/compte` (billet daté, méta, RDV sur carte, participants, S'inscrire, Ajouter au calendrier .ics). Vérifie que le middleware ne la bloque pas pour un utilisateur connecté.

## 5. Accessibilité
Capsules et mini-capsules en `tablist` avec roving tabindex, flèches/Home/End ; pagers `aria-roledescription="carrousel"` ; menu de tri en `menu`/`menuitemradio` ; tuiles = un lien avec libellé complet, actions (j'aime, rejoindre) = boutons distincts hors du lien avec `aria-pressed` ; dates lues en entier ; formulaires en `fieldset`/`legend`, erreurs reliées ; cibles ≥ 44 px ; contraste AA sur le verre.

## 6. Reporté (ne pas faire dans cette PR, lister dans le rapport)
Ce sont les seules exceptions admises à « 200 faites » (`00` § 7).
- Vidéo dans les publications : le bucket `carnet-media` n'accepte que des images ≤ 10 Mo ; l'UI propose les photos seules (`03` § 7). Les stories gardent la vidéo (≤ 25 Mo, ≤ 60 s).
- Publication#11 (sondage), #13 (autoriser commentaires / j'aime), #14 (programmation) : ils exigent de modifier le composant post et la politique de lecture des posts. Masquer ces options dans la V2.
- Carnets#13 transition partagée vers la fiche carnet (ne pas toucher `/carnets/[id]`).
- Club#10 visibilité « privé / secret », Club#11 co-administrateurs, Club#12 inviter des membres, Sortie#11 inviter des amis ou un club : aucune table ni RPC d'invitation, et interdiction d'envoyer quoi que ce soit à de vrais comptes.
- Sorties#15 lien vers le carnet né de la sortie : aucune colonne `events → carnets`.
- Sorties#14 rappel la veille : seulement le fichier `.ics` ; le rappel par notification dépend du chantier notifications.
- Sortie#12 récurrence : stocker la règle (`recurrence`), ne pas générer les occurrences.
- Kit#14 visibilité « Amis » : `materiel_kits` n'a que `is_public` (Public / Privé seulement).
- Kit#3 scan de code-barres : seulement si une recherche de produit par code EAN existe déjà en base ; sinon bouton masqué.
- Météo (Sortie#7, Sorties#8, Story#5 sticker météo, Kit#9 suggestions météo) : seulement si une route API météo existe déjà dans le dépôt ; sinon reportée (aucune nouvelle origine CSP).

À faire (ne pas reporter) : Story#8 caméra directe, `@capacitor/camera` est déjà installé.
