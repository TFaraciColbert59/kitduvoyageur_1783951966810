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
- [x] Vidéos/Reels et galerie 1–10 médias : implémentés avec tests unitaires de classification et normalisation (QA réelle des codecs encore ouverte).
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
- [x] Si une publication ne référence aucun kit public vérifié, aucune icône de reproduction n'est affichée (les autres types ne sont pas encore importables).

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
- [x] Diff GitHub de la PR #103 vérifié : aucun fichier de /compas ou de sa navigation native iOS modifié (tests de non-régression complets encore nécessaires).

## Fichiers principaux
src/styles/community-social.css ; src/app/communaute/page.tsx ;
src/components/communaute/MobileCommunityHeader.tsx, MobileCommunityHub.tsx,
CommunityStoriesBar.tsx, CommunityPostCard.tsx ;
src/components/profile/PublicMobileProfileView.tsx ;
src/components/carnets/MobileCarnetsHub.tsx et MobileCarnetCard.tsx ;
src/components/clubs/MobileClubsHub.tsx et MobileClubCard.tsx ;
routes profil public, carnets, clubs, publication, messagerie.

Ne pas fusionner tant que les contrôles, captures et tests réels n'ont pas été validés.

## 2026-10-15 — Implémentations fonctionnelles du second lot

- [x] Reels réels : route /communaute/reels alimentée par les publications Supabase, vidéo plein écran, lecture/pause selon la visibilité, son désactivé par défaut, défilement vertical snap, bouton retour.
- [x] Actions Reels : j'aime via RPC existante, favoris durables via post_saves, partage natif/presse-papier, accès direct aux commentaires du post. Retour arrière si mutation refusée.
- [x] Galerie 1–10 médias sur les publications publiques : fichier multi-sélection, upload durable, aperçus vidéo, média principal et navigation précédent/suivant, type MP4/WebM/MOV reconnu.
- [x] Découverte : route /communaute/decouvrir connectée aux posts visibles par RLS, grille 3:4, filtres photos/vidéos/carnets, recherche parmi les éléments chargés, pagination et liens vers des pages de post individuelles.
- [x] Page post individuelle : route /communaute/post/[id], auteur issu de public_profiles, état réel like/favori, mêmes commentaires et actions que dans le fil.
- [x] Kit reproductible : sélection d'un kit PUBLIC du propriétaire lors de la publication, FK et vérification SQL, bouton Liquid Glass uniquement après vérification d'un kit public lisible, import via l'API /api/materiel/fork ; aucun écrasement des données existantes.
- [x] Suivi des profils : lecture réelle user_follows, insert/delete RLS, retour arrière sur erreur ; ancien bouton cosmétique remplacé.
- [x] Fond vidéo décoratif retiré de Communauté, Clubs et Carnets pour améliorer les performances.
- [x] Tests unitaires supplémentaires : classification vidéo, normalisation galerie, kit authentique, contrats SQL/RLS, routes Découvrir/Reels.
- [x] Scénarios Playwright de captures pour la Communauté, Découverte et Reels (la **réussite** reste à confirmer en CI).
- [ ] Reproduction autonome de parcours, voyages et checklists : ne pas afficher d'import tant qu'un pipeline idempotent, RLS et sans écrasement n'est pas démontré. /compas reste intact.
- [ ] QA tactile et vidéo sur iPhone réel, performances et formats codec, en mode Wi-Fi/4G.
- [ ] Vérifier l'import réel du kit et les 10 médias sur une base de **test** ayant reçu la migration, et les cas de refus RLS.
- [ ] Finaliser les panneaux d'édition/conversation/groupes dont l'ergonomie interne n'a pas encore été entièrement reprise.

### Déploiement ordonné (obligatoire)

1. Vérifier la migration 20261014221000 en **base de test**, sécurité RLS et absence de régression pgTAP.
2. Déployer la migration additive dans le schéma cible **avant** le frontend : elle ajoute community_posts.media_urls et linked_kit_id.
3. Fusionner seulement après CI du dernier commit (Next.js, TypeScript, unitaires, sécurité, visuel, iOS).
4. Déployer le web puis tester la version Capacitor compatible, sans toucher à /compas.
5. Annuler/masquer la fonctionnalité kit/galerie si la migration n'est pas appliquée : ne jamais afficher un faux succès.

Cette checklist distingue **code implémenté** et **preuves de fonctionnement**. Une case code cochée ne remplace pas un test exécuté.

## 2026-10-15 — Durcissement et validation complémentaires

- [x] Première CI du commit `d375a6c6` : TypeScript, ESLint, unitaires, build Next, Lighthouse, iOS compilés avec succès ; ancienne vérification visuelle verte. Cela ne vaut PAS pour les commits suivants.
- [x] Tests de responsive supplémentaires (en attente d'exécution sur le dernier commit) : 393, 430, 768, 1024 et 1440, thèmes clair/sombre, débordement horizontal, captures de pages Communauté, Découvrir, Reels, Carnets, Clubs et Événements ; contrôles clavier du menu « Créer ».
- [x] Accessibilité du menu Créer : focus initial, flèches haut/bas, Escape avec retour au déclencheur, labels.
- [x] Diagnostic réel en lecture seule du projet Supabase connecté : la table community_posts n'a pas encore les colonnes de la nouvelle PR (`media_urls`, `linked_kit_id`). Déploiement FRONTEND INTERDIT avant migration, même si un build iOS réussit.
- [x] Règles d'audience codées dans la migration `20261015220000_community_post_audience_rls.sql` : posts publics, abonnés et clubs, exclusion des utilisateurs bloqués, et lecture sécurisée des commentaires/likes liés.
- [x] Correctif de publication : `audience` et `club_id` réellement persistés et sélection vérifiée ; médias publics refusés pour une audience abonnés/club au lieu de simuler leur confidentialité.
- [x] Scénarios pgTAP ajoutés dans `supabase/tests/database/community_audience_rls.test.sql` : rôles anonyme/auteur/abonné/membre/tiers, blocage, liens de confidentialité. **À exécuter et valider en CI éphémère.**
- [ ] Les tests pgTAP des nouvelles migrations réussissent sur une base éphémère, avec preuve des checks de la dernière révision.
- [ ] Le stockage de photos/vidéos privées reçoit des URLs signées contrôlées et ne révèle jamais de média via `carnet-media` public ; le mode « abonnés/club » doit fonctionner aussi avec média.
- [ ] Les nouvelles migrations sont appliquées et validées d'abord sur un projet Supabase de TEST. Seul le projet principal apparaît actuellement comme connecté ; NE PAS toucher à la production avant cette porte.
- [ ] Visite QA iPhone réel (touches et gestes, Reels, perf, 4G/Wi-Fi, autorisations photos, caméra, clavier, VoiceOver) — impossible à certifier par Playwright Chromium ou Xcode unsigned.
- [ ] Enregistrement du résultat de la QA réelle et clôture des autres tâches métiers ci-dessus, avec captures et traces horodatées.

### Preuve ≠ promesse

Une checkbox **[x]** dans ce document signifie : code ou test créé / contrôle explicitement effectué. Elle ne signifie PAS « validé en production ». Une feature n'est finie que si sa QA, sa sécurité et son déploiement contrôlé sont aussi prouvés. Ne jamais cocher `QA iPhone réel` sans accès au dispositif.

### Sécurité critique : audience de publication

Le projet Supabase connecté a actuellement la politique `public_read_community_posts USING (true)`. La nouvelle migration la supprime et active une sélection basée sur l'audience avec un contrôle des relations de blocage ; elle doit être validée en base éphémère puis en base de test. Sur `carnet-media`, les URLs sont publiques : les médias destinés à une audience restreinte sont donc BLOQUÉS en attendant un stockage privé fiable, plutôt que publiés sans garde-fou.

### Ordre de livraison obligatoire

1. CI éphémère + tests unitaires/visuels/E2E verts **sur un même SHA**.
2. Projet Supabase de test actif avec toutes migrations et preuves RLS / contenu privé.
3. Reproduction kit, parcours, voyage, checklist : import transactionnel, vérification source publique et RLS, isolation, attribution, aucun écrasement ; ne pas créer d'action fictive.
4. Contrôles tactiles/accessibilité, photos/vidéos sur iPhone et réseau réel.
5. Migration contrôlée vers prod, déploiement web, puis binaire iOS signé ; rollback établi, mesures post-release.
