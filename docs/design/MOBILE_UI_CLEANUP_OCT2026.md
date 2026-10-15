# LKDV — Nettoyage global mobile : correctifs, risques et vérifications

**Périmètre :** toutes les interfaces web / PWA / iPhone sauf `/compas` et `/compas/*`. Ne modifier ni code ni expérience Compas. La bottom bar native UIKit continue à être gérée par un vrai build iOS.

## Symptômes vérifiés sur les trois captures iPhone (15 octobre 2026)

- [x] Une barre web différente revient après connexion : bug de révisions Capacitor périmées suite aux remontages Next.js. Corrigé par une horloge globale monotone, reprise d'application et pont monté sur routes sans barre. Test sur appareil obligatoire.
- [x] Communauté : deux barres de catégories (dans la page + au-dessus de la bottom bar). Le plateau flottant est désactivé sur le hub `/communaute`, avec calcul de réserve cohérent côté shell et web.
- [x] Plus/recherche flottants sur la photo, près de la status bar. Ils sont intégrés dans un header sticky à flux normal et safe-area explicite.
- [x] Stories placées après les filtres ; les stories sont désormais avant les catégories, sans grosse carte supplémentaire.
- [x] Story composer derrière les couches de verre et le contenu actif : rendu en portal `document.body`, masque UIKit, verrouille le scroll, place le focus, gère Escape et restaure le focus.
- [x] La carte Explorer affiche une alerte dans l'alignement des boutons. Alerte décalée sous le dock, recherche de zone décalée à son tour et priorité donnée à l'alerte active.
- [x] L'offset Explorer utilise la hauteur réelle UIKit au lieu de `--nav-height` fixe quand la barre native est affichée.
- [x] Le fond image est dupliqué depuis le layout racine et les shells : un gate unique masque la toile globale hors Compas ; fond sobre et lisible sur les pages sans arrière-plan explicitement demandé.
- [x] Si un ancien IPA ne sait pas répondre au pont Swift, la barre web de secours garde une géométrie iPhone plus homogène (reste une imitation ; vrai Liquid Glass = build signé iOS).
- [x] Le test ancien qui imposait le squelette de la barre web a été remplacé par un contrat anti-double-barre.

## Cohérence UI/UX à poursuivre après ce lot (priorité réelle)

### Priorité A — vérifier iPhone réel avant production
- [ ] Installer le dernier IPA signé avec SDK Apple iOS 26+ et version Next.js compatible.
- [ ] Login → logout → login : même barre Apple, même sélection, aucun clignotement de fallback.
- [ ] 393×852 et 430×932 : zéro élément couvrant une commande ou une information critique, à 100 % et 125 % de texte iOS.
- [ ] Tester portraits/paysages, clavier, statuts de permission, 4G lente, absence réseau, voix VoiceOver.
- [ ] Ouvrir/annuler/publier une story (photo/vidéo), switch app, retour/onglets, focus clavier ; jamais de second rail au-dessus du bas.
- [ ] Explorer : boutons de zoom, recherche de zone, erreurs réseau et sortie entre amis actionnables sans obstacle.
- [ ] Régressions `/compas` et `/compas/*` sans changement de rendu ou de navigation.

### Priorité B — homogénéisation de l'ensemble des écrans
- [ ] Unifier les intitulés, barres hautes, boutons de retour, filtres, cartes, recherches et CTA dans Hub, Voyages, Matériel, Boutique, Explorer, Messages, Compte.
- [ ] Revoir tous les overlays, drawers, sheets et formulaires : portail, focus, fond inert, fermeture Escape, clavier, safe area.
- [ ] Découpler les contrôles de carte des éléments qui touchent le home indicator.
- [ ] Éliminer doublons de titre et indicateurs de chargement répétitifs.
- [ ] Cartes très vitrées et ombres excessives : enlever progressivement selon l'usage, plutôt qu'un override global qui masquerait des boutons importants.
- [ ] Optimiser grandes images, animations, previews, skeletons et transitions au swipe. Mesurer INP/CLS/LCP sur iPhone avant de déclarer « instantané ».
- [ ] Vérifier toutes les pages à l'état vide, avec 1 contenu et 100 contenus.

### Priorité C — refonte Communauté indépendante
La PR **#103** contient la refonte Instagram-like (fil, profils, carnets, clubs, Reels, import de kits). Elle modifie en partie les mêmes composants que cette PR : **rebaser/intégrer les deux branches et exécuter de nouveau tous les tests avant de fusionner l'une puis l'autre**. Ne pas écraser la nouvelle source des stories et de l'en-tête.

## Contrats techniques

- 1 bottom bar principale, 5 destinations. Compas : comportement propre inchangé.
- 1 source de calcul des plateaux ; zéro second plateau sur `/communaute`.
- 1 fond global visible par route seulement quand voulu ; aucun `CompteBackground` répété par défaut.
- 1 plan de z-index/touch targets ; modales en dernier niveau DOM quand les stacking contexts sont nombreux.
- Aucune modification de Supabase, données utilisateur, permissions, paiement ni base.
- Aucune fusion vers `main` sans builds web + iOS verts, revue captures et tests sur appareil.
