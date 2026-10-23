# Plan d'Implémentation LKDV : Refonte Compte v10 (Photo Profil, Sélecteurs, Modale Profil & Drawers 5 Écrans)

Ce plan fait suite à l'analyse approfondie des retours utilisateurs et des 3 captures d'écran mobiles iPhone transmises le 18 octobre 2026.
Il détaille les spécifications, l'architecture, les composants et les étapes d'exécution pour métamorphoser l'expérience utilisateur du profil et des tiroirs, en conformité absolue avec le design system **Apple iOS 27 Liquid Glass** de LKDV.

---

## 🎯 Objectifs & Périmètre

1. **Photo de Profil Agrandie & Mise en Valeur** :
   - Agrandir l'avatar du profil de 52px à **84px** sur mobile (et **96px** sur tablette/desktop).
   - Anneau Liquid Glass biseauté avec reflet spéculaire et micro-ombre portée douce.
   - Repositionnement soigné de la note supérieure (`.ig-note`) et du sceau d'empreinte déterministe (`.ig-seal-bdg`) au format haute définition.

2. **Sélecteur Principal à 2 Onglets Pures Icônes (Style Bottom Bar)** :
   - Réduire le sélecteur `.ig-tabs` à **strictement 2 onglets** : `Grille` (publications) et `Sorties` (activités/voyages GPS).
   - Retirer les onglets `Réseau` et `Matériel` de cette barre centrale.
   - Aligner l'esthétique sur la bottom bar : capsule flottante en verre dépoli (`backdrop-filter: blur(28px) saturate(190%)`), bordure `0.5px solid rgba(255,255,255,0.6)`, indicateur coulissant dynamique (`#17402C`), icônes vectorielles SVG pures sans aucun texte.

3. **Abonnements & Abonnés Dédiés au Clic sur les Chiffres** :
   - Clic sur `1 080 followers` ➔ ouverture directe du sheet dédié avec l'onglet **Abonnés** actif.
   - Clic sur `142 suivi(e)s` ➔ ouverture directe du sheet dédié avec l'onglet **Abonnements** actif.
   - Interface dédiée avec commutateur segmenté, recherche instantanée de randonneurs, fiches profil et boutons de suivi interactifs.

4. **Navigation Profil Universelle sur Tous les Pseudos et Avatars** :
   - Rendre chaque photo de profil et chaque pseudo (`@handle`) cliquable dans toute l'interface (followers, commentaires, cordée, stories, fiches de sorties).
   - Clic ➔ déclenche l'ouverture de la fiche profil du randonneur concerné (`user_profile_preview`) avec ses statistiques, massifs explorés, et lien direct vers son profil complet.

5. **Refonte Majeure de la Feuille "Modifier le Profil"** :
   - Remplacement complet des formulaires rudimentaires par une expérience **Apple Inset Grouped** en verre Liquid Glass.
   - En-tête natif iOS : `Annuler` (gauche), titre centré `Modifier le profil`, `Enregistrer` (droite en vert accentué `#17402C`).
   - Carte Avatar : Grand avatar centré avec badge caméra interactif pour changer la photo ou sélectionner parmi les avatars d'expédition.
   - Carte Identité : Nom complet, `@handle`, bio & démarche avec compteur de caractères.
   - Carte Allure de Marche : Slider Apple sur-mesure avec affichage live de la vitesse (`4,2 km/h`), archétype dynamique ("Randonneur régulier", "Fast-hiker") et encart d'impact sur le Compas.
   - Carte Pratique : Sélecteurs de pills segmentés pour le terrain et l'autonomie.
   - Carte Localisation : Ville de domicile avec visualisation de la zone de confidentialité de 1 km.

6. **Refonte Complète du Drawer Identité & ses 5 Écrans** :
   - Remplacement des onglets tronqués (`Pr...`, `Voy...`, `Em...`, `Tribu`, `Vie ...`) par une barre de capsules horizontales fluides avec intitulés complets :
     1. `🧭 Pratique` : Allure, impact Compas, terrains de prédilection, degré d'autonomie, priorité de sac.
     2. `🌍 Voyageur` : Nationalités (formalités/visas), ville de départ (cercle de flou 1 km RLS), devise.
     3. `🏔️ Empreinte` : Sceau déterministe agrandi, massifs vérifiés GPS (km réels et D+), plancher 3 sorties.
     4. `👥 Cordée` : Membres de la cordée de confiance, gestion des prêts de matériel avec rappels, clubs rejoints.
     5. `🛡️ Vie privée & Sécurité` : Matrice de visibilité (Moi / Cordée / Public), coffre biométrique Face ID, export d'archive RGPD Art. 20 (JSON / GPX).
   - Suppression définitive de la pagination artificielle `< 1 / 3 >` et de la barre audio encombrante au profit d'un défilement vertical fluide.

7. **Amélioration du Drawer Compte & Activité (Bouton Sliders en Haut à Droite)** :
   - Onglet Commandes : Vraies cartes de commandes et réservations de refuges avec miniatures, badges d'état (Livrée, Confirmée, En transit) et actions de suivi.
   - Onglet Notifications : Alertes terrain (Météo, Cordée, Droits d'auteur matériel, Alertes de sécurité) avec pastilles non-lues et marquage instantané.
   - Onglet Paramètres : Carte Inset Grouped avec commutateurs Apple (Mode haute luminosité, Coffre biométrique, Purge du cache hors-ligne, Déconnexion sécurisée).

8. **Invariants Stricts LKDV** :
   - **STRICTEMENT 0 MODIFICATION DANS `/compas`** (`src/app/compas/**`, `src/features/compas/**`).
   - **Règle Icône Pure** : Aucun texte dans le sélecteur principal à 2 onglets.
   - **Règle Zéro Dialogue Natif** : Aucun appel à `alert()`, `prompt()` ou `confirm()` (test de gouvernance `U-D63`).
   - **100% Tests Passants** sur la suite de design (`tests/design/*`).

---

## 📐 Architecture & Fichiers Concernés

1. `src/components/compte/CompteLiquidGlassV8.tsx` :
   - Styles CSS intégrés (`COMPTE_V8_APPLE_HIG_CSS`) :
     - Agrandissement de `.ig-avi-wrap` (84px sur mobile, 96px sur desktop).
     - Refonte de `.ig-tabs` en capsule flottante Liquid Glass identique à la bottom bar (grille 2 colonnes, indicateur coulissant 50%).
     - Styles Inset Grouped pour les feuilles de profil (`.apple-grouped-card`, `.apple-input-row`, `.apple-range-slider`).
     - Styles de la barre d'onglets du drawer identité 5 écrans (`.flow-tabs-capsule`).
     - Masquage des barres audio ou paginations résiduelles.

2. `src/components/compte/compte-liquid-glass-v8-runtime.js` :
   - Mise à jour du balisage `.ig-header` avec le nouvel avatar agrandi.
   - Mise à jour de `.ig-tabs` pour n'inclure que 2 onglets : Grille (`igtab:0`) et Sorties (`igtab:1`).
   - Câblage des boutons statistiques :
     - `openFollowers` ➔ ouvre la feuille dédiée réseau avec `mode = 'followers'`.
     - `openFollowing` ➔ ouvre la feuille dédiée réseau avec `mode = 'following'`.
   - Fonction universelle `openUserProfile(handle)` : attachée à chaque pseudo et photo d'utilisateur.
   - Refonte complète de la fonction `defs().edit_profile_full` : formulaire Inset Grouped, barre de navigation iOS, slider fluide, gestion du changement de photo.
   - Refonte complète du tiroir `defs().step` (5 écrans) :
     - Remplacement des flow buttons tronqués par une barre horizontale soignée.
     - Suppression de la pagination `per: [...]` pour laisser le contenu défiler librement dans un container unifié.
     - Contenus enrichis pour Pratique, Voyageur, Empreinte, Cordée, Vie privée.
   - Refonte du tiroir `defs().account_drawer` : Commandes enrichies, Notifications interactives, Paramètres clairs.

3. `tests/design/compte-refonte-v10.spec.ts` :
   - Création de la suite de tests automatisés Vitest validant l'ensemble des nouveaux critères fonctionnels et esthétiques.

---

## 📋 Étapes d'Exécution

### Phase 1 : Tests Automatisés & Spécifications (TDD)
- Créer le fichier `tests/design/compte-refonte-v10.spec.ts`.
- Valider les invariants :
  - Taille de l'avatar >= 80px sur mobile.
  - Sélecteur principal limité à 2 onglets sans texte.
  - Clic sur followers / following ouvrant le sheet réseau dédié.
  - Pseudos et photos dotés d'actions de profil.
  - Modale modifier profil avec composants Inset Grouped et slider Apple.
  - Drawer identité 5 écrans sans troncature ni pagination `< 1 / 3 >`.
  - Zéro modification dans `/compas`.

### Phase 2 : Refonte CSS & Design Tokens Apple iOS 27
- Éditer `src/components/compte/CompteLiquidGlassV8.tsx` :
  - Ajuster `.ig-avi-wrap` et ses éléments internes.
  - Styliser `.ig-tabs` pour émuler à la perfection la bottom bar (capsule Liquid Glass, 2 onglets, slide spring).
  - Ajouter les classes Inset Grouped pour les formulaires et les tiroirs.

### Phase 3 : Refonte Runtime JavaScript & Comportements
- Éditer `src/components/compte/compte-liquid-glass-v8-runtime.js` :
  - Mettre à jour `renderProfileHeader()` et `renderTop()`.
  - Configurer `.ig-tabs` avec uniquement 2 boutons SVG.
  - Implémenter le routeur de clic profil utilisateur (`openUserProfile`).
  - Réécrire `edit_profile_full` avec l'expérience Inset Grouped et le sélecteur de photo.
  - Réécrire le drawer 5 écrans `S.step === 0` avec onglets capsules fluides et défilement continu.
  - Enrichir `account_drawer` (commandes, notifications, paramètres).

### Phase 4 : Vérification, Validation Visuelle & Déploiement
- Exécuter la suite complète `npx vitest run tests/design/` (254+ tests).
- Compiler avec `npm run build` pour vérifier 0 erreur TypeScript/Webpack.
- Lancer un script Playwright pour capturer les 8 nouveaux écrans mobiles de validation.
- Commit propre et push sur la branche `main`.
