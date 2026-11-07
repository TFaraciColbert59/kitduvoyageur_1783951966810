# 01 — Spécification produit de la fiche carnet v2

La maquette `annexes/maquette-fiche-carnet.html` est la spécification exécutable : ouvre-la dans Chrome (panneau de démo à gauche, rôle Participant / Visiteur, jours, états), manipule chaque élément, et lis son JavaScript quand un comportement n'est pas décrit ici. Ce document liste **ce que la fiche doit faire**. `02-DESIGN-ET-COMPOSANTS.md` dit **comment** (composants réels de `/compte`).

## 1. Écran

Grille identique à `/compte` : zone haute (`calc(69% - 46px)`) + carte fixe en bas (`1fr`). Poignée de carte : glisser > 20 px ou toucher → carte agrandie (`144px 1fr`, 0,55 s), ce qui ferme un tiroir ouvert sans animation.

### 1.1 Barre haute (`.ig-top`)
- Gauche : pastille titre du carnet (verre). Toucher → menu morph : participant = « Modifier le carnet » (bascule le mode modification), « Partager… », « Copier le lien » ; visiteur = « Suivre le carnet », « Partager… », « Copier le lien », « Signaler ».
- Droite, boutons ronds 34 px : `+` (participant seulement) → feuille « Créer » (9 types de moment), soleil → popover Affichage (Plein soleil, Réduire les animations), curseurs → tiroir Carnet (§ 4).

### 1.2 Carte du carnet (`#card`, style carte profil `/compte`)
- Couverture ronde 66 px avec anneau conique (anneau animé si le carnet est « En route »). **Toucher → stories des voyageurs** (§ 6).
- 3 statistiques : jours, km, D+ (toucher → tiroir Chiffres sur la lentille correspondante).
- Titre, sous-titre (lieu de départ · mois année · n voyageurs).
- Ligne d'état « En route · J4 sur 4 » (point vert pulsé) → tiroir Équipage › Suivre ; visiteur : « · massif des Écrins » (position grossière). Bouton « Ouvrir le carnet » → tiroir Fil de bord. En mode modification : bouton « Terminer ».
- Rangée « À la une » (5 pastilles : voyageurs et étapes clés). Toucher voyageur → fiche participant ; étape → Route › Étapes + focus carte. Appui long 500 ms (participant) → tiroir d'édition (renommer, retirer avec confirmation).
- **Vue du jour** (`.ig-swipe-view`) : Résumé = 4 cartes-jour (voyage-card) ; J1…Jn = en-tête du jour (date, durée, km, D+, météo) + grille 3 colonnes des moments (photo, vidéo, note vocale, texte, rencontre, dépense, objet du kit, espèce, incident ; pastille de type, heure, épingle).
  - Glisser horizontal ±60 px (suivi `dx×0,45`, sortie 0,18 s, entrée 0,32 s) change de jour **dans les deux sens** (le runtime `/compte` ne teste que `dx<0` : bug à ne pas reproduire). Flèches ← → au clavier.
  - Mini-capsule flottante en bas à droite : Résumé, 1…n.
  - Toucher une tuile → **post** (§ 5). Appui long 460 ms → aperçu (Lire, Voir sur la carte, Épingler/Désépingler, Fermer).

### 1.3 Carte du bas
- Fond carte réel `CompteMap variant="carnet"` (MapLibre + tuiles OpenFreeMap, un seul contexte WebGL). Traces des jours (blanc 6 / sauge 7 / forêt 3), départ/arrivée, marqueurs de moments (21 px), POI/étapes (20 px), nuits, position en direct.
- Le jour affiché est mis en avant (autres traces atténuées) et recadré (fitBounds animé). Toucher la trace d'un jour → change de jour.
- Tiroir ouvert : carte en « mode contexte » (`saturate(.6) brightness(.97)`), badge du jour, couches réduites au tiroir actif (Fil → moments, Route → étapes/nuits, Sac → moments « objet du kit », Équipage → position).
- Contrôles à droite (zoom ±, recentrer), masqués quand un tiroir est ouvert.
- Participant : point de position exacte pulsé. Visiteur : zone floue de 60 px au niveau du massif, différée (§ 3 de `03-DONNEES-SUPABASE.md`).

### 1.4 Île dynamique
Toute confirmation passe par l'île (titre, sous-titre, bouton Annuler si réversible, 3,8 s, `aria-live`), Ctrl/⌘+Z annule. Pas de modale, sauf la confirmation de retrait d'une pastille « À la une ».

## 2. Tiroirs (5 slots, un seul snap « card » clippé dans la carte du carnet)

Ouverture 0,72 s ease-out ; fermeture : poignée vers le bas (rubber-band après 35 %, seuil 30 % ou 0,55 px/ms) ou Échap ; fond inerte, piège de focus, focus rendu à l'ouvrant. Capsule 56 px en tête (icônes seules), mini-capsule 30 px en bas à droite + glisser horizontal entre lentilles (verrou d'axe 8 px, seuil 48 px). Squelette au premier affichage d'un slot. Contenu filtré par le jour courant (Résumé = tout le carnet).

| Tiroir | Lentilles (ordre) | Contenu |
|---|---|---|
| **Fil de bord** | Moments · Médias · Rencontres · Nature | Résumé : une carte postale par jour ; jour : chronologie des moments (cartes par type, note vocale lisible, dépense, objet, espèce, incident). Médias : grille 3 col → post. Rencontres : citations. Nature : planche d'espèces. |
| **Route** | Étapes · Altitude · Nuit · Météo et ciel | Étapes : liste par jour, toucher = focus carte + callout « Voir la fiche » → fiche étape empilée. Altitude : profil avec curseur glissable (haptique à chaque point) synchronisé avec un curseur sur la carte. **Nuit : cartes cliquables → focus carte + fiche nuit empilée** (type, altitude, infos, moments à proximité, « Voir sur la carte »). Météo : conditions, arc du soleil, lune. |
| **Sac** | Kit · Verdicts · Poids | Kit : poids total + tuiles par catégorie → fiche objet. Verdicts : filtres Essentiel/Utile/Jamais servi/Défaillant/Manquait. Poids : anneau par catégorie. **Pilule « Reprendre » en bas à gauche** (signet, enregistre le kit dans le Compas de l'utilisateur, annulable). |
| **Chiffres** | Distance · Dénivelé · Durée · Budget | Total ou jour vs moyenne (barres). Budget (participant seulement) : reçu, par personne, par jour, par catégorie, détail. |
| **Équipage** | Participants · **Réactions** · Suivre | Participants : rôle, jours partagés, nb de moments → **fiche participant = en-tête + grille de posts de ses moments**. **Réactions : j'aime du jour (ou du carnet en Résumé) + commentaires du jour + champ d'envoi**, suppression de son propre commentaire (annulable). Suivre : dernier signal, avancement, préférence de notifications. |

Pile de sous-niveaux (fiche étape, nuit, objet, participant) : bouton ‹ Retour, réarmement 0,72 s, cascade des lignes 0,45 s.

## 3. Mode modification (participant)
Activé par le menu de la pastille titre. Fait apparaître en place : « + Ajouter … » (moment, étape, nuit, objet, verdict, dépense, rencontre, espèce, médias, voyageur), pilules « Modifier » sur chaque carte, tuile `+` dans la grille du jour. Chaque action écrit réellement en base (moments, étapes, nuits, kit, verdicts) avec retour île + annulation.

## 4. Tiroir Carnet (bouton curseurs) — onglets chargés à la demande et conservés
Notifications (filtres Tout/Moments/Équipage/Système, « Tout lire ») · Partage (QR, lien `/carnets/{id}`, « Trace GPS vérifiée », vues 7/30 j, visibilité) · Paramètres (confidentialité public/privé, position en direct, notifications, unités métrique/impérial, parcours de découverte) · **Gérer (participant propriétaire seulement)** : titre, description (160 car.), visibilité, export GPX/PDF, suppression avec confirmation en place.

## 5. Post (photo, vidéo et tout moment)
Composant post de `/compte` **à l'identique** (`CarnetPostSheet` → `PostSheet` + `CommunityFeedPost`) : feuille de verre, poignée (toucher ou glisser > 80 px / > 500 px/s ferme), pilule auteur (→ fiche participant), bouton ··· avec rail d'options (Enregistrer, Copier le lien, Signaler), capsule d'actions (J'aime avec compteur animé, Commenter, Partager), j'aime par tap/double tap sur la photo, glisser à gauche → commentaires, à droite → partage, panneau commentaires (tri récents/anciens, `CommentItem`, `PostReplyComposer`), panneau partage (copier, partager, WhatsApp, X, Facebook, e-mail, lien), flèches précédent/suivant entre les médias du jour. Les moments sans photo utilisent la variante texte du post.

## 6. Stories du carnet (toucher la couverture)
Visualiseur `StoriesViewer` de l'app **à l'identique** : un groupe par voyageur (ses médias du carnet), barres de 5 s, maintien = pause, focus du champ = pause, tap 30 %/70 % = précédent/suivant, glisser horizontal 48 px = groupe suivant/précédent, glisser vers le bas 80 px = ferme, pilule auteur (→ fiche participant), ··· (copier le lien, partager, signaler), dock « Envoyer un message… » + j'aime + partage. **Envoyer = message privé à l'auteur du slide** via la messagerie existante (`replyToStory`-like, `metadata.carnet_moment_reply`), en respectant blocages, demandes de message et `reply_policy` ; île « Message envoyé à {prénom} ».

## 7. Rôles

| | Participant (auteur, collaborateur, participant de sortie) | Visiteur (connecté, non participant) |
|---|---|---|
| Lecture | Tout | Carnet public uniquement (privé → 404 actuel conservé) |
| Position | Exacte, en direct | Zone floue au niveau du massif, différée ≥ 3 h |
| Budget | Oui | Lentille absente |
| Gérer, `+`, mode modification, appui long « À la une » | Oui | Non |
| J'aime, commentaires, réponses aux stories, suivre | Oui | Oui (selon la visibilité et les blocages) |

## 8. États
Chargement (voile scintillant 1,4 s comme `/compte`, squelettes de slot et d'onglet), vide (« Aucun moment publié. » + CTA participant), erreur de slot (« Impossible de charger ce carnet. » + Réessayer), erreur d'une lentille isolée (les autres restent disponibles), carte indisponible, hors ligne. Textes exacts : maquette et `annexes/C-contenus-compte.md` § 9 (tutoiement, majuscule en début de libellé).

## 9. Accessibilité et mouvement
Tout `annexes/B-interactions-compte.md` § 7 : tablists, roving tabindex, carrousel, `aria-live`, cibles 44 px, focus visible, `prefers-reduced-motion`, `prefers-reduced-transparency`, mode plein soleil.
