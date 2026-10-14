# LKDV Communauté Social First — design inspiré Instagram, métiers LKDV préservés

## Intentions
L'expérience doit immédiatement être comprise par quelqu'un qui connaît Instagram : photos en premier, stories en haut, avatars ronds, en-têtes de publication, boutons j'aime/commenter/partager/enregistrer sous le média, légende en dessous, profils en grille verticale 3:4. La marque, le contenu et les fonctions spécifiques restent LKDV. Aucun code, image ou marque Instagram n'est repris.

Statuts : [x] = code modifié dans cette PR, [~] = fonctionnalité existante conservée, [ ] = travail restant, à valider ou implémenter.

## Fil et publications — /communaute
- [x] Interface neutre, immersive et resserrée. Fil desktop central et image 4:5.
- [x] Auteur, image, actions et texte ordonnés à la manière d'un réseau social photo.
- [x] Boutons sauvegarder/partager/j'aime/commenter explicites et accessibles sous la photo.
- [~] Pagination, récupération Supabase, vrais auteurs, deep links et états d'erreur.
- [~] Double-tap, j'aime optimiste, favoris, masquer, signaler, menu avancé.
- [~] Commentaires imbriqués, réponses, édition, suppression, likes et pièces jointes.
- [~] Instantané figé du carnet lié, avec destination, description et couverture.
- [ ] Tester post texte, photo, erreurs média, grands commentaires, likes, partage et hors ligne.
- [ ] Vidéos/miniatures/carrousels : auditer les modèles existants avant d'implémenter.
- [ ] Infinite scroll/virtualisation : mesurer avant d'alourdir le réseau.

## Stories
- [x] Rail compact prioritaire au-dessus des catégories.
- [~] Anneaux lu/non lu, créateur, lecture immersive, photos/vidéos, slides et archives.
- [~] Audience, réponses, suivi des vues, suppression, limites média.
- [ ] QA tactile : avancer/reculer, pause, audio, changement auteur, sortie, erreurs.
- [ ] Améliorer la composition visuelle et le contrôle de l'audience sans supprimer les règles existantes.

## Profil public — /profil/[id]
- [x] Cadre plus neutre et vignettes verticales 3:4 plutôt que carrées.
- [~] Avatar, présence réelle, statistiques, carnets, clubs, points, badges.
- [~] Partage, signalement, blocage, highlights et écrans vides.
- [ ] Vérifier la persistance réelle du bouton suivre, permissions et blocages.
- [ ] Finir l'harmonisation de l'en-tête, compteurs et cartes secondaires.

## Clubs, carnets, groupes, sorties et entraide
- [x] Cartes et surfaces mobiles Carnets et Clubs plus sobres ; photos en 4:5.
- [~] Filtres, recherche, création, adhésion, partage, favoris, notes, commentaires.
- [ ] Revoir détails de clubs, carnets, groupes, événements, discussions et entraide une page après l'autre ; couvrir tous états et permissions.
- [ ] Conserver le registre de navigation canonique : certaines routes groupes relèvent du Hub.

## Création et messages
- [x] Barre d'actions mobile donnant accès à publier un post, carnet, recherche, messagerie.
- [x] Editeur publication et messagerie : conteneurs visuellement plus sobres.
- [~] Brouillon local, audience, tags, photos, lieu, carnet lié, messages, pièces jointes et APIs inchangés.
- [ ] Harmoniser l'intérieur des formulaires, aperçus et boutons de publication.
- [ ] QA iPhone clavier, upload, auth, conversations, demandes, groupes et notifications.

## La différence LKDV — reproduction de contenu
- [~] Les publications savent conserver un instantané d'un carnet lié ; rien supprimé.
- [ ] Uniquement si données structurées réutilisables existantes : petite icône Liquid Glass en bas à gauche de l'image, sans label par défaut.
- [ ] Au clic : choix des seuls éléments réellement présents et autorisés (kit, parcours, voyage, checklist).
- [ ] Prévisualiser puis importer sans écraser les données du lecteur. Attribution, RLS, idempotence, sécurité et annulation.
- [ ] Si le contenu est uniquement une photo, une vidéo ou du texte sans données, aucune icône.

## Explorer, Reels, découverte et réputation
- [~] Recherche, catalogue et réputation LKDV existants non réécrits.
- [ ] Grille Explorer en 3:4, recherche par lieu/activité/niveau, vidéos plein écran si réellement présentes.
- [ ] Analyse de liens Instagram/Reels vers des parcours : chantier dédié sans toucher à /compas dans cette PR ; incertitude explicitée.
- [ ] Badges, points, modération, prévention spam, confidentialité, gestion utilisateur, RGPD.

## Critères de qualité et non-régression
- [ ] CI du dernier commit : TypeScript, ESLint, tests unitaires, build Next et iOS sans erreurs.
- [ ] Photos et contrôles vérifiés à 393×852, 430×932, 768×1024, 1024 et 1440, thèmes clair et sombre.
- [ ] Cibles tactiles au moins 44×44, VoiceOver, focus clavier, contrastes, texte agrandi et réduction d'animations.
- [ ] Performance : tap perçu sous 100 ms ; pas de saut de layout ; lazy loading médias sous le premier écran ; mesurer LCP/CLS/INP et réseau réel, sans prétendre à un résultat sans mesure.
- [ ] Parcours tests : créer, consulter, liker, sauvegarder, commenter/répondre, signaler, accéder à un auteur, retrouver carnet/club, voir/publier une story, gérer erreurs.
- [ ] Contrôler confidentialité, permissions et RLS avant toute diffusion.
- [ ] Captures visuelles inspectées sur les vraies pages, avec des données réelles et des états vides/chargement.
- [ ] Rien dans /compas, ni la navigation native iOS, ne doit changer par la refonte.

## Fichiers principaux
src/styles/community-social.css ; src/app/communaute/page.tsx ;
src/components/communaute/MobileCommunityHeader.tsx, MobileCommunityHub.tsx,
CommunityStoriesBar.tsx, CommunityPostCard.tsx ;
src/components/profile/PublicMobileProfileView.tsx ;
src/components/carnets/MobileCarnetsHub.tsx et MobileCarnetCard.tsx ;
src/components/clubs/MobileClubsHub.tsx et MobileClubCard.tsx ;
routes profil public, carnets, clubs, publication, messagerie.

Ne pas fusionner tant que les contrôles, captures et tests réels n'ont pas été validés.
