# Formulaires de création — 20 améliorations par formulaire

**Date :** 2026-10-25
**Statut :** proposition à valider — aucun code
**Périmètre :** Publication, Story, Carnet, Sortie, Kit, Club.
**Base visuelle :** drawer création `406×466`, footer `69 px`, primitives du drawer Compte.

---

## 1. Contexte

Les captures `docs/communaute/create2-*.png` montrent :
- une coquille lisible mais des formulaires encore très « formulaire brut » ;
- un pager multi-étapes uniquement sur Publication ;
- des champs média par URL pour Carnet/Sortie/Kit/Club ;
- des dates en `input type=date`, pas de sélection de plage ;
- des lieux/catégories en texte libre ;
- pas de brouillon, pas de prévisualisation, pas de reprise après fermeture ;
- pas de validation par étape ni de résumé d’erreurs ;
- une expérience mobile correcte mais sans gestes riches.

## 2. Trois approches

### A. Polissage minimal
CSS, libellés, états vides, quelques composants. Rapide, mais ne règle ni les données, ni les parcours, ni la reprise de brouillon.

### B. Socle de formulaire partagé + formulaires enrichis — **recommandé**
Un moteur commun (React Hook Form + Zod), un `StepPager` commun, des contrôles partagés (média, lieu, dates, chips, combobox), puis les 20 améliorations de chaque formulaire. Réutilise la grammaire Compte et les composants existants.

### C. B. + brouillons serveur, collaboration et publication programmée
Très complet, mais lourd : tables de brouillons, conflits, permissions, jobs. À garder pour un lot ultérieur.

**Recommandation :** B, avec brouillon local dans un premier temps, puis brouillon serveur si le besoin est confirmé.

## 3. Socle partagé (commun aux six formulaires)

1. **Un moteur unique** React Hook Form + Zod, schémas par type.
2. **Validation par étape** et résumé d’erreurs cliquable.
3. **Pager d’étapes** pour les six types, pas seulement Publication.
4. **Brouillon local autosauvegardé** (localStorage versionné) + restauration.
5. **Confirmation de fermeture** si contenu non vide.
6. **Aperçu réel** de la carte/story avant publication.
7. **Média picker** avec upload, preview, alt, cover, réorganisation.
8. **Combobox lieu** (recherche + suggestions + carte).
9. **Date range picker** pour Carnet/Sortie.
10. **Chips** pour tags, équipement, catégories.
11. **Stepper** accessible pour participants/poids.
12. **Toast + undo** après création (Sonner).
13. **États loading/error/retry** sur chaque étape.
14. **Focus management** et labels ARIA.
15. **Réduction des animations** (`prefers-reduced-motion`).
16. **Safe areas** et clavier mobile.
17. **Compteurs de caractères** et limites visibles.
18. **Defaults intelligents** (lieu, audience, dates).
19. **Analytics** étape/abandon/publication.
20. **Tests visuels + E2E** par formulaire.

---

## 4. Publication — 20 améliorations

### Visuel
1. Segmented control Photo / Billet / Question / Événement avec icônes et aperçu.
2. Zone média drag & drop avec vignettes, cover, réorganisation.
3. Composer texte avec mentions/hashtags et compteur.
4. Lieu en combobox avec mini-carte.
5. Tags en chips.
6. Audience avec explication et aperçu de visibilité.
7. Club en combobox recherchable.
8. Événement : date/heure, durée, fuseau, participants en stepper.
9. Aperçu carte feed/Compte en direct.
10. Footer sticky avec étape et action.

### Technique
11. Schéma Zod conditionnel par type.
12. Validation par étape + erreurs inline.
13. Upload avec progression/retry.
14. Autosave local.
15. Alt text obligatoire pour les images.
16. Limites taille/type/durée.
17. Brouillon restauré après fermeture.
18. Analytics étape/abandon.
19. Accessibilité clavier/ARIA.
20. Tests unitaires + E2E publication.

### Fonctionnel
- publication immédiate ou brouillon ;
- édition d’un brouillon ;
- aperçu avant envoi ;
- gestion d’erreur réseau sans perte de saisie.

---

## 5. Story — 20 améliorations

### Visuel
1. Picker plein écran caméra/galerie.
2. Aperçu 9:16 avec zones sûres.
3. Réorganisation des slides par drag.
4. Légende + overlays texte.
5. Styles de texte (fond, alignement, taille).
6. Miniatures des slides.
7. Progression d’upload.
8. Aperçu audience/réponse.

### Technique
9. Compression/validation image/vidéo.
10. Duration vidéo + poster.
11. Permissions caméra/micro avec fallback.
12. Autosave brouillon.
13. Reprise d’un média existant.
14. Reply policy (tous/abonnés/désactivé).
15. Alt text/captions.
16. Pager multi-slides.
17. Retry upload.
18. Analytics.
19. Accessibilité.
20. Tests E2E story.

### Fonctionnel
- publier 24 h ;
- partager vers story ;
- supprimer/archiver ;
- aperçu avant publication.

---

## 6. Carnet — 20 améliorations

### Visuel
1. Cover upload/crop avec aperçu.
2. Titre + destination avec suggestions.
3. Date range picker + nombre de nuits.
4. Description avec compteur.
5. Visibilité avec explication.
6. Aperçu carte carnet.
7. Étapes Infos / Dates / Visibilité.
8. Footer sticky.

### Technique
9. Zod : dates cohérentes (fin ≥ début).
10. Upload cover + alt.
11. Autosave.
12. Validation par étape.
13. Brouillon.
14. Import d’un carnet existant.
15. Modèles de carnet.
16. Analytics.
17. Accessibilité.
18. Tests unitaires.
19. E2E.
20. Gestion d’erreur.

### Fonctionnel
- créer un carnet vide puis compléter ;
- dupliquer ;
- brouillon ;
- publication privée/publique.

---

## 7. Sortie — 20 améliorations

### Visuel
1. Titre + suggestions.
2. Date/heure/fuseau + durée.
3. Lieu combobox + carte.
4. Niveau/difficulté.
5. Participants max en stepper.
6. Description structurée (programme, matériel, niveau).
7. Cover upload.
8. Aperçu carte sortie.

### Technique
9. Validation date future.
10. Places restantes.
11. Liste d’attente.
12. Point de rendez-vous.
13. Checklist matériel.
14. Visibilité.
15. Autosave.
16. Étapes.
17. Analytics.
18. Accessibilité.
19. Tests.
20. Erreurs réseau.

### Fonctionnel
- inscription/attente ;
- modification ;
- annulation ;
- partage.

---

## 8. Kit — 20 améliorations

### Visuel
1. Nom + modèle de kit.
2. Saison en segmented.
3. Poids avec unité et validation.
4. Description.
5. Cover upload.
6. Visibilité.
7. Éditeur d’items (recherche, ajout, suppression, ordre).
8. Total poids calculé.
9. Répartition par catégorie.
10. Aperçu kit.

### Technique
11. dnd-kit pour les items.
12. Validation poids > 0.
13. Import d’un kit existant.
14. Autosave.
15. Étapes.
16. Analytics.
17. Accessibilité.
18. Tests.
19. Erreurs réseau.
20. E2E.

### Fonctionnel
- kit vide ;
- duplication ;
- partage ;
- brouillon.

---

## 9. Club — 20 améliorations

### Visuel
1. Nom + catégorie combobox.
2. Lieu combobox.
3. Description.
4. Cover/logo upload + crop.
5. Confidentialité (public/privé/invitation).
6. Règles d’adhésion.
7. Aperçu carte club.
8. Étapes.

### Technique
9. Validation nom/catégorie.
10. Upload cover/logo.
11. Invitation link.
12. Autosave.
13. Analytics.
14. Accessibilité.
15. Tests.
16. E2E.
17. Erreurs réseau.
18. Brouillon.
19. Modèles.
20. Modération.

### Fonctionnel
- créer un club ;
- inviter ;
- approuver les demandes ;
- partager.

---

## 10. Inspirations libraries

- **shadcn/ui** — Form/Field, Combobox, Date Picker, Command, Drawer, Carousel : https://ui.shadcn.com/docs/forms
- **Radix UI** — primitives accessibles (dialog, popover, tabs) : https://www.radix-ui.com/
- **TanStack Form** — état de formulaire typé : https://tanstack.com/form/latest
- **React Hook Form** — performance et validation : https://react-hook-form.com/
- **Zod** — schémas : https://zod.dev/
- **Vaul** — drawers gestuels : https://vaul.emilkowal.ski/
- **cmdk** — combobox/command palette : https://cmdk.paco.me/
- **Sonner** — toasts : https://sonner.emilkowal.ski/
- **react-dropzone** — dépôt de fichiers : https://react-dropzone.js.org/
- **Uppy** — uploads robustes : https://uppy.io/
- **dnd-kit** — réorganisation : https://dndkit.com/
- **react-day-picker** — dates/plages : https://daypicker.dev/
- **Embla Carousel** — carrousels : https://www.embla-carousel.com/
- **Framer Motion** — transitions : https://motion.dev/
- **AutoAnimate** — micro-animations : https://auto-animate.formkit.com/
- **Ark UI / Park UI** — composants headless : https://ark-ui.com/ , https://park-ui.com/

## 11. Priorités

- **P0** : moteur/validation, pager 6 types, upload média, lieu/dates, brouillon local, aperçu.
- **P1** : items kit, invitations club, listes d’attente sortie, overlays story.
- **P2** : analytics, modèles, brouillon serveur, collaboration.

## 12. Critères d’acceptation

- 20 améliorations livrées par formulaire, avec P0 complet.
- Aucune perte de saisie à la fermeture (brouillon).
- Validation par étape et erreurs accessibles.
- Médias uploadés (plus d’URL brute) pour Carnet/Sortie/Kit/Club.
- Aperçu réel avant publication.
- Tests visuels/E2E au vert et déploiement Cloudflare.
