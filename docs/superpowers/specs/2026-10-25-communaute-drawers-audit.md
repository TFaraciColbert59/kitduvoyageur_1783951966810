# Audit — 10 améliorations par drawer et sous-drawer de Communauté

**Date :** 2026-10-25
**Périmètre :** `/communaute` uniquement. **Aucun fichier Compte modifié.**
**Méthode :** `ui-ux-pro-max` (contraste, touch 44, focus, performance, glass) + `apple-ui-designer` (HIG, safe areas, feuilles, motion).
**Contrainte :** ne pas ajouter de titre ni de sous-titre.

## Mesures et constats

- Feed : carte post `406×406` à `x=12` ; header pillule `139,8×44` ; close `38×38`.
- Commentaires/partage : panneau plein cadre `406×406`, image conservée.
- Stories : viewer plein écran, composer + like/partage en capsule ; bottom bar masquée.
- Création : drawer `406×466`, footer `69`, formulaires scrollables.
- Problèmes récurrents : textes `9–11 px`, cibles `38 px`, verre très transparent, blur empilé, empty states pauvres, images sans dimensions, focus/Échap inégal.

## 1. Feed + rail Stories

1. **V** — Espacement vertical du feed : 12 px entre cartes, 16 px après le rail.
2. **V** — Header de page compact et sticky, sans titre/sous-titre ajouté.
3. **V** — Ring story : 58 px, anneau 2 px, contraste non-vu/visité.
4. **T** — Cibles rail story 44×44 ; label 11 px lisible.
5. **T** — Images de cartes : `width/height`, `loading=lazy`, `decoding=async`.
6. **P** — `content-visibility:auto` sur les cartes hors viewport ; limiter les blur.
7. **P** — Précharger la première story et les 2 cartes suivantes seulement.
8. **F** — Pull-to-refresh avec feedback ; skeleton feed.
9. **F** — Erreur réseau avec retry et conservation du scroll.
10. **A** — Ordre de tabulation, focus visible, `aria-label` des stories.

## 2. Story viewer

1. **V** — Barre de progression fine, contraste sur images claires.
2. **V** — Composer pleine largeur en verre, texte saisi sombre et visible.
3. **V** — Capsule like + partage à droite, 44×44 de cible, sans débordement.
4. **T** — Préchargement du slide suivant ; poster vidéo.
5. **T** — Pause/reprise au focus, visibilité onglet, reduced-motion.
6. **P** — Une seule couche de blur ; pas de blur pendant le swipe.
7. **F** — Swipe horizontal/vertical avec seuils et retour.
8. **F** — Envoi de réponse optimiste avec retry.
9. **A** — Focus trap, Échap, labels, alt/caption.
10. **A** — Ne pas masquer le focus derrière la capsule.

## 3. Story options + vues

1. **V** — Rail d’icônes 38→44 px, espacement 8 px.
2. **V** — Icônes identiques au post (bookmark/link/repeat/flag/trash).
3. **T** — `role=menu`, focus roving, Échap, retour focus.
4. **T** — Vues : liste virtualisée, avatars lazy.
5. **F** — Compteur de vues cliquable, état vide.
6. **F** — Copier le lien avec toast.
7. **F** — Signaler/bloquer avec confirmation.
8. **P** — Charger les vues à l’ouverture seulement.
9. **A** — Libellés accessibles sur chaque icône.
10. **A** — Contraste des icônes sur verre.

## 4. Carte post

1. **V** — Ratio carré stable, image plein cadre, pas de CLS.
2. **V** — Pillule header compacte 44 px ; `···`/`X` alignés.
3. **V** — Actions 46×31 visuelles, cible 44×44.
4. **T** — `srcset`, sizes, décodage async, préchargement voisin.
5. **T** — Double-tap like accessible avec `aria-pressed`.
6. **P** — Pas de re-render complet à chaque like.
7. **F** — Gestion média cassé + retry.
8. **F** — Panneaux commentaires/partage plein cadre.
9. **A** — Alt text, focus, ordre des actions.
10. **A** — Reduced-motion sur les animations de like.

## 5. Commentaires

1. **V** — Lignes 12 px minimum, timestamps contrastés.
2. **V** — Composer 44 px au-dessus du clavier/safe-area.
3. **V** — Réponses limitées à 2 niveaux, « Voir la suite ».
4. **T** — Envoi optimiste + retry sans perdre le texte.
5. **P** — Virtualiser au-delà de 50 commentaires.
6. **F** — Pagination et état vide.
7. **F** — Modifier/supprimer/signaler avec confirmation.
8. **A** — `aria-live` sur l’envoi, labels.
9. **A** — Focus input et retour au panneau.
10. **A** — Contraste des actions secondaires.

## 6. Partage

1. **V** — Sections Envoyer / Copier / Partager avec icônes + libellés.
2. **V** — Mini-sélecteur 3 boutons 44×44, plus 42×25.
3. **V** — Recherche 44 px, focus visible.
4. **T** — Toast de copie, fallback Web Share.
5. **T** — Désactiver les actions non supportées.
6. **P** — Virtualiser les destinataires.
7. **F** — Erreur d’envoi avec retry.
8. **F** — Confirmation avant partage externe.
9. **A** — Noms accessibles, focus trap.
10. **A** — Contraste et labels des icônes.

## 7. Options du post

1. **V** — Rail vertical 44 px, verre homogène.
2. **V** — Icônes seules avec tooltip/aria, pas de texte.
3. **T** — Focus roving, Échap, clic extérieur.
4. **T** — Action destructive en rouge + confirmation.
5. **F** — Copier le lien avec feedback.
6. **F** — Enregistrer/retirer avec état.
7. **P** — Éviter le blur pendant l’ouverture.
8. **A** — `role=menu`, `aria-checked`.
9. **A** — Cibles 44×44.
10. **A** — Retour focus au `···`.

## 8. Drawer Création — coquille

1. **V** — Sélecteur 6 types : 44×44, icônes contrastées.
2. **V** — Footer fixe 69 px, formulaire scrollable.
3. **V** — Surface plus opaque pour lisibilité.
4. **T** — Pager numéroté au-dessus du footer.
5. **T** — Brouillon local + confirmation de fermeture.
6. **P** — Ne monter que le formulaire actif.
7. **F** — Aperçu compact avant publication.
8. **F** — Erreur de validation avec focus d’étape.
9. **A** — Focus trap, Échap, labels.
10. **A** — Reduced-motion et safe-area.

## 9. Création — Publication

1. **V** — Segmented Photo/Billet/Question/Événement avec aperçu.
2. **V** — Dropzone média + cover + alt.
3. **V** — Compteur de caractères et tags chips.
4. **T** — Lieu en combobox (à venir), validation URL.
5. **T** — Date/heure/participants conditionnels.
6. **P** — Upload progressif et retry.
7. **F** — Aperçu carte feed.
8. **F** — Brouillon et reprise.
9. **A** — Labels, erreurs inline, focus.
10. **A** — Alt obligatoire pour image.

## 10. Création — Story / Carnet

1. **V** — Story : aperçu 9:16, overlays texte.
2. **V** — Carnet : cover, dates, visibilité.
3. **T** — Upload privé Story + progression.
4. **T** — Date range cohérent, validation.
5. **P** — Images lazy, pas de CLS.
6. **F** — Reply policy, brouillon.
7. **F** — Aperçu compact.
8. **F** — Erreur/retry.
9. **A** — Labels et focus.
10. **A** — Reduced-motion.

## 11. Création — Sortie / Kit / Club

1. **V** — Sortie : date, lieu, niveau, participants.
2. **V** — Kit : saison, poids, items.
3. **V** — Club : cover, catégorie, confidentialité.
4. **T** — Cover upload partout, plus d’URL brute.
5. **P** — Items Kit virtualisés/dnd-kit.
6. **F** — Brouillon et aperçu.
7. **F** — Erreurs inline.
8. **F** — Invitations/liste d’attente (P1).
9. **A** — Labels, focus.
10. **A** — Contraste des aides.

## 12. Feuilles secondaires — signalement, vues, erreurs

1. **V** — Header/close homogènes.
2. **V** — Textes 12 px+, contraste 4.5:1.
3. **T** — Focus trap, Échap, retour focus.
4. **T** — Une seule couche de blur.
5. **F** — Empty state, skeleton, retry.
6. **F** — Confirmation des actions destructives.
7. **P** — Chargement à l’ouverture uniquement.
8. **P** — Images lazy/dimensions.
9. **A** — Rôles, labels, focus.
10. **A** — Reduced-motion.

---

## Priorités

- **P0** : contraste 4.5:1, 12 px, 44 px, focus/Échap, blur unique, image dimensions, commentaires/partage.
- **P1** : empty states, skeletons, brouillon création, aperçu, options 44, story views.
- **P2** : virtualisation, analytics, combobox lieu, dnd-kit, invitations/liste d’attente.

## Critères d’acceptation

- Aucun texte <12 px.
- Cibles ≥44×44.
- Contraste 4.5:1.
- Une couche de blur par feuille.
- Focus trap + Échap + restitution.
- Aucune image sans dimensions/lazy.
- Aucun titre/sous-titre ajouté.
- Aucune modification du Compte.
