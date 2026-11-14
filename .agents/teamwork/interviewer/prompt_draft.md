L'équipe utilisera des sous-agents selon la difficulté de la tâche avec ajustement de leur taux d'effort, pour réaliser le chantier en autonomie complète. Extraire et implémenter les composants et tokens officiels exacts fournis par Apple (Swift natif via le bridge iOS Capacitor et primitives CSS/WebKit officielles du design system Apple), adaptés dans la palette verte LKDV sans aucun noir pur. Appliquer ces composants à la page Messagerie (`/messagerie`) et ses tiroirs en corrigeant toutes les anomalies identifiées dans l'audit iPhone, puis valider sur l'iPhone 16 Pro physique avec captures réelles avant de poursuivre sur le reste de l'application.

Working directory: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference
Integrity mode: development

## Verification Resources
- Physical device: Connected iPhone 16 Pro via USB / XCUITest / Appium (UDID `00008140-000E7D081A0B001C`, Bundle ID `com.lekitduvoyageur.app`).
- Complete iPhone Audit Report: `/Users/fr168256/.gemini/antigravity/brain/25ed2e40-8086-4101-9dbd-3687f6e94b76/audit_complet_iphone.md` (Section 5: `/messagerie`).
- Existing baseline screenshots: `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/audit-shots/05-messagerie/` (`01-messagerie-main.png` à `13-*.png`).
- Appium / QA scripts: `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/`.
- External Skills resource: `https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md` (via `npx skills`).

## Requirements

### R1. Banque de variables et composants exacts Apple (teintes vertes LKDV, sans noir pur)
Ne pas approximer ni réinventer les composants Apple en partant de zéro. Rechercher, extraire et implémenter les spécifications, tokens et composants officiels exacts fournis par Apple :
- **Composants natifs Swift** : Exploiter les composants natifs iOS (`UIKit` / `SwiftUI`) via le bridge Capacitor (`ios/App/App`) dès que applicable.
- **Primitives WebKit / CSS officielles Apple** : Utiliser les primitives système officielles iOS/WebKit (`font: -apple-system-body`, `-apple-system-headline`, `-apple-system-title1..3`, `-apple-system-subheadline`, `-apple-system-footnote`, `-apple-system-caption1..2`, métriques exactes de l'iOS Kit Apple Design Resources, rayons de courbure continus *continuous corners / squircle*, spécifications de flou et saturation matière `UIVisualEffectView`, métriques `UISegmentedControl`, `UISearchTextField`, `UISheetPresentationController` avec poignée grabber `36×5pt` et detents, `UIContextMenuInteraction`, listes `UICollectionViewListCell` inset grouped).
- **Nuances LKDV** : Mapper ces composants et styles avec la palette verte LKDV en éliminant tout noir pur `#000000` et les fonds sombres non désirés au profit des nuances de vert.
Centraliser ces variables dans une banque unique et réutilisable pour toute l'application.

### R2. Installation et intégration proactive de compétences externes (skills)
Utiliser les compétences locales disponibles et installer proactivement via `npx skills` toutes les compétences externes pertinentes (notamment depuis `https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md` et les dépôts associés) pour assister le développement, le design system iOS/React et l'automatisation.

### R3. Correction et refonte intégrale de la Page Messagerie (`/messagerie`)
Appliquer le design system Apple / LKDV et corriger l'ensemble des anomalies ergonomiques et visuelles répertoriées dans la section 5 de l'audit iPhone :
- **Vue principale (split 40/60)** : Empêcher les boutons du header ("Messages" et cloche "Notifications") de quitter la messagerie vers `/compte` avec flash noir ; repositionner la pastille flottante `Toutes ▾` pour supprimer tout chevauchement avec les lignes de conversation ; ajuster la poignée de tirage et l'en-tête de la zone de conversation inférieure (60%) pour ne pas tronquer le nom du contact ni masquer le premier message.
- **Filtres et états vides (`Demandes`, etc.)** : Supprimer l'affichage simultané des états vides en double ; rendre le bouton "Nouvelle discussion" parfaitement lisible (texte contrasté sans noir sur vert sombre) et fonctionnel (ouverture du sélecteur de contacts).
- **Conversations de groupe** : Éliminer la disparition ou le gel sur squelettes gris lors de l'ouverture d'un groupe ; corriger les cartes "Publication indisponible".
- **Tiroirs `ComposerMenuSheet` (`+`) et `ConversationOptionsSheet` (`...`)** : Ouvrir ces menus en bas de l'écran (bottom sheet) au lieu du haut (`y=114..386`), ajouter les marges intérieures nécessaires (`padding-left`) et empêcher toute coupure des options inférieures.
- **Menu contextuel de réactions** : Afficher la barre d'emojis de réaction sans coupure par le haut du volet de conversation.

### R4. Validation physique sur iPhone 16 Pro avant déploiement global
Reconstruire / synchroniser l'application sur l'iPhone 16 Pro physique connecté (UDID `00008140-000E7D081A0B001C`), exécuter les scripts de capture Appium pour générer les captures d'écran réelles de `/messagerie` et de tous ses états/tiroirs corrigés, et soumettre ces images réelles pour validation de l'utilisateur avant d'étendre le travail aux autres pages de l'application.

## Acceptance Criteria

### Design System Apple & Palette LKDV
- [ ] Les composants et tokens ne sont pas des approximations artisanales : les spécifications, primitives CSS système Apple (`-apple-system-*`, métriques officielles Apple Design Resources, grabber de sheet `36×5pt`, continuous corner radii) et composants Swift natifs via le bridge Capacitor sont fidèlement extraits et implémentés.
- [ ] Une banque centrale de tokens/variables pour l'ensemble des éléments d'interface (boutons, listes inset grouped, inputs, sheets, typographie, ombres) est créée et réutilisable par toutes les pages.
- [ ] La palette respecte scrupuleusement les nuances vertes LKDV, avec élimination du noir pur `#000000` et des fonds sombres accidentels.

### Page Messagerie (`/messagerie`)
- [ ] Les clics sur le titre "Messages" et la cloche de notifications ne déclenchent aucune redirection intempestive vers `/compte` ni aucun flash noir `#0d1117`.
- [ ] La pastille de filtre `Toutes ▾` ne chevauche aucune ligne de la liste des conversations.
- [ ] L'en-tête de la conversation (zone 60%) et la poignée de redimensionnement ne masquent ni le nom du contact ni le premier message échangé.
- [ ] L'onglet `Demandes` n'affiche qu'un seul état vide cohérent ; son bouton d'action est lisible (contraste conforme) et ouvre la création de conversation.
- [ ] Les conversations de groupe s'ouvrent sans bloquer sur des squelettes gris et sans cartes d'erreur "Publication indisponible".
- [ ] Le tiroir d'ajout (`+`) et le menu d'options (`...`) s'ouvrent en bottom sheet avec un padding latéral correct et sans troncature des boutons du bas.
- [ ] La barre d'émojis lors d'un appui long sur un message est visible sans rognage par le haut du conteneur.

### Vérification physique & Déploiement
- [ ] L'application tourne sur l'iPhone 16 Pro physique (`00008140-000E7D081A0B001C`).
- [ ] Les captures d'écran Appium de `/messagerie` (vue principale, filtres, chat de groupe, menus `+` et `...`, réactions) sont capturées sur l'appareil physique et sauvegardées dans les dossiers de QA.
- [ ] Les images réelles sont présentées pour validation avant tout engagement sur les autres pages.