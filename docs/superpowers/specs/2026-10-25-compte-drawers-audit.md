# Audit — 10 améliorations par drawer et sous-drawer du Compte

**Date :** 2026-10-25
**Statut :** audit de conception, aucun code
**Méthode :** `ui-ux-pro-max` (accessibilité, touch, performance, glass, typographie, focus) + `apple-ui-designer` (HIG, feuilles, safe areas, motion, clarté).
**Captures :** `docs/communaute/audit-compte-main.png`, `audit-profile-drawer.png`, `audit-slot-*.png`.

> Le design-system générique retourné par l’outil (navy/or, Playfair/Karla) ne correspond pas à LKDV. **Aucune palette ni typographie externe n’est appliquée** : on conserve les tokens verts et la typographie système existants. Les recommandations ci-dessous viennent des règles UX vérifiées (contraste 4.5:1, cibles 44×44, focus visible, reduced-motion, coût du blur) et de la HIG.

## Mesures terrain

- Drawer Profil : `406×517`, `top=72`.
- 5 slots : Vitrine, Kit, Prêts, Souvenirs, Communauté.
- 3 lentilles par slot ; capsule basse de `38 px` par icône.
- Textes secondaires : `9–10,5 px` ; contraste insuffisant sur le verre clair.
- Grandes zones vides en verre ; carte visible dessous.
- Certains slots injectent du CSS dans le contenu du slot (`style` + `.lkdv-kit-slot{...}`).
- Les captures montrent un rendu glass très clair, sans titre de feuille ni repère de profondeur.

## Priorités transverses

- **P0** : contraste, tailles 44 px, focus/Échap, blur unique, textes ≥12 px, images dimensionnées.
- **P1** : états vides utiles, skeletons, segmentation avec compteurs, détents/gestes.
- **P2** : analytics, personnalisation, virtualisation avancée.

---

## 1. Drawer Profil — coquille + Vitrine

1. **V** — Ajouter un vrai titre de feuille « Profil » + sous-titre, au lieu d’un simple grabber.
2. **V** — Poser un voile de contenu (`rgba(255,255,255,.55)`) derrière les empty states : le verre actuel laisse la carte parasiter la lecture.
3. **V** — Textes secondaires ≥12 px et contraste 4.5:1 ; les aides actuelles en 10 px sont trop faibles.
4. **V** — Donner un libellé aux 5 slots (ou un tooltip long-press) : les icônes seules sont ambiguës.
5. **V** — Ancrer la capsule de lentilles au bas de la feuille avec une marge safe-area, pas en flottant au-dessus de la carte.
6. **T** — Une seule couche `backdrop-filter` par feuille ; désactiver le blur pendant le drag et sous `prefers-reduced-motion`.
7. **T** — Mémoïser les slots et ne monter que la lentille active ; les 5 slots montés en permanence coûtent cher.
8. **F** — États vides spécifiques par lentille (Stats/Republication/Trophées) avec une action unique et un lien secondaire.
9. **A** — Focus trap, Échap, restitution du focus, `aria-modal`, fond `inert`.
10. **P** — Détents 50/90 %, drag-to-dismiss, transition 280–360 ms ; réduire le coût du blur pendant l’animation.

## 2. Sous-drawer Kit — Kits / Inventaire

1. **V** — Empty state avec visuel de kit et CTA « Créer un kit », pas un simple point gris.
2. **V** — Segmented Kits/Inventaire avec compteurs et libellés, pas seulement deux icônes.
3. **V** — Cartes kit : cover 16:9, nom, poids, saison, nombre d’objets ; hiérarchie en 2 niveaux.
4. **V** — Inventaire : lignes 56 px, photo 40, poids aligné à droite, catégories.
5. **T** — Supprimer le CSS injecté dans le slot ; le déplacer dans `create-shared.css`/`compte-drawers.css`.
6. **T** — `loading="lazy"`, `decoding="async"`, `width/height` sur toutes les images.
7. **P** — Virtualiser l’inventaire au-delà de 50 objets ; `content-visibility:auto` sur les cartes.
8. **F** — Recherche et filtre saison/catégorie ; action « Ajouter » persistante.
9. **F** — Squelettes de cartes et erreur avec « Réessayer ».
10. **A** — Chaque carte est un bouton avec nom accessible ; focus visible ; pas de hover-only.

## 3. Sous-drawer Prêts — Je prête / J’emprunte / Confiance

1. **V** — La rangée 0/0/0 doit respirer : séparateurs, libellés 12 px, valeur 20 px.
2. **V** — Empty state « Aucun prêt » avec CTA principal + lien « Comment ça marche ».
3. **V** — Segmented avec compteurs et état actif clair ; actuellement trois icônes flottantes.
4. **V** — Cartes prêt : objet, personne, échéance, statut ; l’échéance en texte + couleur, jamais couleur seule.
5. **T** — Confiance : jauge avec valeur textuelle et `aria-valuenow` ; pas seulement une barre.
6. **T** — Optimistic update avec rollback visible et toast ; éviter le double clic.
7. **P** — Virtualiser l’historique ; limiter les requêtes au viewport.
8. **F** — Filtres « En cours / En retard / Cette année » réellement interactifs.
9. **F** — Squelettes et erreur réseau avec retry.
10. **A** — Cibles 44×44 pour les actions de prêt ; focus et libellés complets.

## 4. Sous-drawer Souvenirs — Timeline / Passeport / Souvenirs

1. **V** — Trois empty states distincts (timeline, passeport, albums), pas un même bloc générique.
2. **V** — Timeline groupée par mois avec en-têtes sticky et points de repère.
3. **V** — Passeport : carte/mappemonde utile, légende, compteurs pays/massifs.
4. **V** — Albums : grille 3 colonnes, ratios réservés, cover et titre.
5. **T** — Images lazy + dimensions ; éviter le CLS sur la grille.
6. **P** — Virtualiser la timeline et `content-visibility` sur les albums.
7. **F** — Filtres année/lieu et recherche.
8. **F** — Actions partager/exporter/privacy sur chaque souvenir.
9. **F** — Squelettes et état vide avec CTA « Créer un carnet ».
10. **A** — Alt text des photos, focus, ordre de lecture chronologique.

## 5. Sous-drawer Communauté — Défis / Clubs

1. **V** — Empty state Défis avec illustration et CTA ; le point gris actuel est trop faible.
2. **V** — Cartes club : cover, nom, membres, prochain événement, rôle ; 2 niveaux de lecture.
3. **V** — Segmented Défis/Clubs avec compteurs.
4. **V** — Badge « Membre actif » lisible, contraste et taille ≥12 px.
5. **T** — Ouvrir le ClubDrawer dans une feuille native (detent) et non un panneau imbriqué opaque.
6. **T** — Optimistic join/RSVP avec rollback et message.
7. **P** — Virtualiser la liste des clubs ; images lazy.
8. **F** — Recherche/filtre clubs ; état vide avec « Découvrir ».
9. **F** — Squelettes et erreurs.
10. **A** — Noms accessibles, focus trap du ClubDrawer, Échap.

## 6. Sous-drawer Club

1. **V** — En-tête cover + logo + nom + rôle ; actuellement trop textuel.
2. **V** — Prochain événement : date, lieu, places, RSVP en boutons 44 px.
3. **V** — Membres : compteur et avatars, sans données privées.
4. **V** — Kits recommandés en cartes horizontales.
5. **V** — Règles/sécurité en section repliable, pas un pavé.
6. **T** — Focus trap, Échap, retour focus, `aria-modal`.
7. **T** — Optimistic membership/RSVP avec rollback.
8. **P** — Images lazy + ratios ; éviter le blur sur toute la feuille.
9. **F** — Partage du club et invitation.
10. **A** — Cibles 44×44, libellés, contraste.

## 7. Drawer Post

1. **V** — Ratio média réservé (1:1 ou 4:5) pour zéro CLS ; cover et blurhash.
2. **V** — Header compact, pillule et `···`/`X` alignés à 44 px de cible.
3. **V** — Actions 46×31 visuelles mais zone tactile 44×44.
4. **V** — Panneaux commentaires/partage plein cadre, verre plus opaque pour le texte.
5. **T** — `srcset`, `sizes`, `loading`, `decoding` ; précharger le média suivant.
6. **T** — Une seule couche de blur ; la couper pendant le swipe.
7. **F** — Double-tap like avec bouton accessible et état `aria-pressed`.
8. **F** — Erreur média avec retry et fallback.
9. **A** — Focus trap, Échap, restitution, alt text.
10. **P** — Carrousel sans jank, images décodées hors main thread.

## 8. Sous-drawer Commentaires

1. **V** — Composer au-dessus du clavier, safe-area, hauteur 44.
2. **V** — Lignes commentaire : 12 px minimum, timestamps contrastés, densité constante.
3. **V** — Réponses imbriquées limitées à 2 niveaux + « Voir la suite ».
4. **T** — Envoi optimiste + retry sans perdre le texte.
5. **P** — Pagination/virtualisation au-delà de 50 commentaires.
6. **F** — Menus 44 px, modération, signalement.
7. **F** — Squelettes et état vide.
8. **A** — `aria-live` pour l’envoi, labels, focus.
9. **A** — Contraste des actions Répondre/Modifier/Supprimer.
10. **P** — Éviter le re-render de toute la liste à chaque frappe.

## 9. Sous-drawer Partage + Options

1. **V** — Sections « Envoyer », « Copier », « Partager » avec icônes + libellés.
2. **V** — Mini-sélecteur 3 boutons 42×25 : porter la cible tactile à 44×44.
3. **V** — Recherche 44 px, focus visible.
4. **T** — Toast de copie et état désactivé si non supporté.
5. **T** — Web Share API avec fallback clipboard.
6. **F** — Confirmation pour action destructive (supprimer).
7. **P** — Virtualiser les destinataires.
8. **F** — Feedback d’échec avec retry.
9. **A** — Rail d’options : libellés accessibles, 44 px, focus.
10. **A** — Ordre de tabulation et Échap.

## 10. Drawer Réglages / Édition profil

1. **V** — Liste groupée iOS : sections, séparateurs, pas de cartes imbriquées.
2. **V** — Bouton Enregistrer sticky, désactivé tant que rien ne change.
3. **V** — Avatar avec crop/prévisualisation et fallback initiales.
4. **V** — Textes d’aide 12 px et contraste 4.5:1.
5. **T** — Validation inline, résumé d’erreurs, focus.
6. **T** — Confirmation de fermeture si modifications non enregistrées.
7. **F** — Explication de la visibilité et des notifications.
8. **F** — Squelettes et erreurs.
9. **A** — Labels, 44 px, focus.
10. **P** — Charger les sections lourdes à la demande.

## 11. Drawer Invitations

1. **V** — Empty state avec CTA « Inviter » et explication.
2. **V** — Sections En attente / Actifs avec compteurs.
3. **V** — Lignes avatar/nom/relation, 56 px.
4. **V** — Recherche 44 px.
5. **T** — Accepter/refuser optimiste + rollback.
6. **F** — Filtres et états vides.
7. **P** — Virtualiser.
8. **F** — Erreur réseau + retry.
9. **A** — Noms accessibles, focus.
10. **A** — Confidentialité et absence de données sensibles.

## 12. Feuilles secondaires — Badge / Matériel / Confiance / Empreinte / Enregistrements

1. **V** — Header et fermeture identiques à toutes les feuilles.
2. **V** — Textes ≥12 px, contraste 4.5:1.
3. **V** — Images lazy + ratio réservé.
4. **V** — Empty state et skeleton cohérents.
5. **T** — Focus trap, Échap, retour focus.
6. **T** — Une seule couche de blur.
7. **F** — Actions utiles (partager, fermer, retry).
8. **F** — Formatage des dates/nombres localisé.
9. **A** — Libellés, rôles, focus.
10. **P** — Rendu conditionnel et data fetching à l’ouverture.

---

## Ordre d’exécution recommandé

1. **P0 transverse** : contraste, 12 px, 44 px, focus/Échap, blur unique.
2. **P0 Profil/Vitrine** : titre, voile, empty state, lentilles ancrées.
3. **P0 Post/Commentaires/Partage** : 44 px, verre, clavier.
4. **P1 Kit/Prêts/Souvenirs/Communauté** : empty states, compteurs, skeletons.
5. **P1 Club/Réglages/Invitations** : focus trap, optimistic, erreurs.
6. **P2 secondaires** : virtualisation, analytics, personnalisation.

## Critères d’acceptation

- Aucun texte de moins de 12 px dans les drawers.
- Toute cible interactive ≥44×44 px.
- Contraste 4.5:1 sur les textes secondaires.
- Une seule couche de blur par feuille, désactivée pendant les gestes et en reduced-motion.
- Focus trap + Échap + restitution sur chaque feuille.
- Aucune image sans dimensions/lazy.
- Aucun CSS injecté dans le contenu d’un slot.
- Chaque drawer a un empty state, un skeleton et une erreur avec retry.
