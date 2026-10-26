# Création de contenu — refonte Instagram/X, Kit, Carnet, Sortie, Club

**Date :** 2026-10-26
**Statut :** design à valider — aucun code
**Périmètre :** six sous-drawers de création Communauté.
**Contraintes :** pas de titre, sous-titre ou libellé de structure visible ; noms accessibles en `aria-label` ; aucun code Compte.

---

## 1. Recherche produit

### Instagram — création d’un post
Le parcours natif est **media-first** :
1. sélection d’un ou plusieurs médias (carrousel) ;
2. édition/crop, cover vidéo, tags de personnes, lieu, alt text ;
3. légende, hashtags, mentions, collaborateurs ;
4. options avancées : commentaires, likes, partage Facebook, planification ;
5. aperçu puis publication.

Sources : [Instagram Help Center](https://help.instagram.com/1631821640426723), [Instagram Features](https://about.instagram.com/features).

### X — composer
Le composer X est **texte-first**, avec :
- compteur de caractères, threads ;
- médias, alt text, sondage, GIF ;
- lieu, audience/réponses, planification ;
- aperçu et publication immédiate.

Source : [X Help — How to post](https://help.x.com/en/using-x/how-to-post) (page protégée par anti-bot au moment de la recherche ; parcours repris depuis l’interface publique).

### Décision LKDV
- **Post** = hybride : média-first pour Photo/Carrousel/Reel, texte-first pour Billet/Question/Sondage.
- **Story** = média-first, édition rapide.
- **Kit** = inventaire-first, puis complétion intelligente.
- **Carnet** = récit structuré, itinéraire et logistique.
- **Sortie** = événement/plan d’aventure avec inscription.
- **Club** = identité, univers, adhésion, publication.

---

## 2. Architecture partagée

```
CreateFormEngine (RHF + Zod)
  StepPager
  Draft/autosave
  Validation par étape + focus
  Preview
  PublishBar

Primitives
  MediaStudio (upload, crop, cover, alt, ordre)
  InventoryPicker (gear_items)
  KitCompletion (suggestions + items custom)
  PlaceCombobox
  DateRangeField
  AudienceField
  PeoplePicker (mentions/collaborateurs)
  PollEditor
  StageEditor (carnet)
  RouteField (GPX/carte)
  RegistrationEditor (sortie)
  ClubRulesEditor
```

### Règles de chrome
- Aucun titre, sous-titre ou label de section visible.
- Contrôles icon-only avec `aria-label`.
- Les champs gardent un label accessible mais masqué visuellement ; placeholders visibles.
- Les messages d’erreur, d’état vide et de statut restent visibles.
- Une seule couche de verre par feuille ; blur coupé pendant les gestes.

---

## 3. Inventaire des formulaires

| Formulaire | Étapes | Données principales | Tables |
|---|---|---|---|
| Post | 4 | type, médias, édition, légende, lieu, tags, personnes, audience, options, planification | `community_posts`, `community_post_drafts`, `post_*` |
| Story | 3 | média, overlays, audience, réponse, partage | `post_stories` |
| Kit | 4 | inventaire, complétion, structure, partage | `kits`, `kit_items`, `gear_items` |
| Carnet | 5 | identité, itinéraire, logistique, récit, partage | `carnets`, `carnet_*` |
| Sortie | 4 | type, lieu/date, itinéraire, participants, sécurité | nouvelle `community_outings` + inscriptions |
| Club | 4 | identité, univers, adhésion, publication | `clubs`, `club_members`, `club_events` |

---

## 4. Post — 4 étapes

### Étape 1 — Format
- Photo, Carrousel, Reel/Vidéo, Billet, Question, Sondage, Événement.
- Segmented icon-only ; aperçu du format.
- Billet : compteur de caractères (280/2000 selon config).
- Sondage : 2–4 options.
- Événement : titre, date/heure, lieu, participants.

### Étape 2 — Médias & édition
- 1–10 médias, réorganisation, cover, crop/aspect.
- Alt text obligatoire pour image.
- Tags de personnes, collaborateurs, lieu.
- Trim vidéo, cover, durée.
- Fallback image cassée, retry.

### Étape 3 — Détails
- Légende/texte, mentions, hashtags.
- Audience : public, abonnés, club.
- Commentaires on/off, likes masqués, partage.
- Lien kit/carnet.
- Planification (optionnelle).

### Étape 4 — Aperçu & publication
- Aperçu réel carte feed.
- Brouillon, planifier, publier.
- Erreurs par étape, focus, conservation du brouillon.

---

## 5. Story — 3 étapes

1. **Média** : caméra/galerie, 9:16, trim, cover.
2. **Édition** : texte, fond, alignement, mentions, lieu, lien, stickers.
3. **Diffusion** : audience, reply policy, allow reshare, durée 24 h, partage.

---

## 6. Kit — 4 étapes (inventaire-first)

### Étape 1 — Inventaire
- Liste scrollable de `gear_items` : **photo, nom, usure** uniquement.
- Recherche, filtre catégorie, tri poids/usure.
- Sélection multiple ; compteur ; poids cumulé.
- Badge usure : `wear_percentage` (0–100), texte + jauge.
- Actions : tout sélectionner, désélectionner, ajouter un produit absent.

### Étape 2 — Compléter
- Moteur de complétion par **template** : day hike, bivouac, alpine, ski, vélo, eau.
- Catégories requises : portage, abri, sommeil, cuisine, eau, nutrition, vêtements, sécurité, navigation, hygiène, réparation.
- Compare l’inventaire sélectionné aux catégories requises.
- Propose les **manquants** ; ajout custom : nom, catégorie, poids, quantité, photo.
- Marqueurs : essentiel, porté, consommable, partagé.
- Score de complétude + avertissements.

### Étape 3 — Structure
- Grouper par catégorie, réordonner (dnd-kit).
- Totaux : base, porté, consommable, total.
- Objectif de poids et écart.
- Saison, activité, difficulté.
- Nom, description, cover, tags.

### Étape 4 — Partage
- Visibilité, cloneable, attribution.
- Lien carnet/sortie.
- Aperçu carte kit, publier.

### Données
- `kit_items` : ajouter `gear_item_id`, `worn`, `consumable`, `shared`, `photo_url`.
- `kits` : `template_id`, `base_weight_g`, `worn_weight_g`, `consumable_weight_g`, `visibility`, `cloneable`.
- Les items custom restent dans `kit_items` sans `gear_item_id`.

---

## 7. Carnet — 5 étapes

### Étape 1 — Identité
Titre, destination, pays, dates, nb de nuits, voyageurs, cover, description, tags, visibilité.

### Étape 2 — Itinéraire
- Étapes/jours : titre, date, départ, arrivée, distance, D+, difficulté, type (rando, bivouac, vélo, train, bateau).
- Carte/GPX, points d’intérêt, refuges, bivouacs, transport.
- Table `carnet_stages` (nouvelle) ou `map_points` enrichi.

### Étape 3 — Logistique
- Budget, kit lié (`carnet_kit_items`), matériel (`carnet_gear_links`), nourriture/eau, permis, météo, contacts d’urgence, risques.

### Étape 4 — Récit
- Moments (`carnet_moments`), photos (`carnet_media`), légendes, espèces, citations, liens.

### Étape 5 — Partage
- Collaborateurs (`carnet_collaborators`), commentaires, visibilité, lien kit, publier.

---

## 8. Sortie — 4 étapes

### Étape 1 — Type & lieu
Activité (rando, bivouac, alpinisme, ski, vélo, eau), titre, date/heure/fuseau, durée, lieu de rendez-vous, destination, visibilité/club.

### Étape 2 — Itinéraire & difficulté
GPX/carte, distance, D+, altitude, difficulté, terrain, eau, dangers, équipement requis.

### Étape 3 — Participants
Max, liste d’attente, date limite, approbation, prix, questions, expérience minimale.

### Étape 4 — Sécurité & publication
Contact d’urgence, météo, règles, disclaimer, cover, aperçu, publier.

### Données
Nouvelle table `community_outings` + `community_outing_registrations` (statut, réponses, waitlist). `club_events` reste pour les événements de club.

---

## 9. Club — 4 étapes

### Étape 1 — Identité
Nom, slug, catégorie/type, lieu, langue, cover, logo, emoji, description.

### Étape 2 — Univers
Purpose, règles, tags, activités, post d’accueil, kit lié, événement featured.

### Étape 3 — Adhésion
Confidentialité (public/privé/invitation), mode d’adhésion, questions, rôles, approbation, lien d’invitation, limite de membres, modération.

### Étape 4 — Aperçu & publication
Aperçu carte club, publier, inviter.

### Données
`clubs` : ajouter `rules`, `join_mode`, `join_questions` jsonb, `member_limit`, `welcome_post`, `logo_image`.
Nouvelle table `club_join_requests` si approbation.

---

## 10. États, validation, performance

- Chaque étape : chargement, vide, erreur, retry.
- Validation Zod par étape, focus sur la première erreur.
- Brouillon local + reprise.
- Médias : dimensions, lazy, alt, upload progress.
- Listes longues : virtualisation (inventaire, destinataires, membres).
- Une seule couche de blur ; reduced-motion.
- 44×44 minimum ; contraste 4.5:1 ; textes ≥12 px.

---

## 11. Décisions à valider

1. **Sortie** = nouvelle entité publique `community_outings`, distincte de `club_events`.
2. **Kit** = `kit_items.gear_item_id` nullable + items custom.
3. **Carnet** = nouvelle table `carnet_stages` ; `carnet_moments` conservé pour le récit.
4. **Club** = champs additifs + `club_join_requests`.
5. **Post** = `community_posts` existant, enrichi par `snapshot_payload`/`media_urls` ; pas de nouvelle table.
6. **Chrome** = aucun titre/sous-titre/label visible ; aria-only.

## 12. Hors périmètre

- Modification du Compte.
- Messagerie.
- Paiement réel des sorties.
- Modération avancée.

## 13. Critères d’acceptation

- Six formulaires avec les étapes ci-dessus.
- Kit : étape 1 inventaire photo/nom/usure, sélection, complétion, poids, partage.
- Carnet : itinéraire + logistique + récit + partage.
- Sortie : inscription/liste d’attente.
- Club : adhésion et invitations.
- Aucun titre/sous-titre/label de structure visible.
- Tests, build, déploiement, captures 430/768/1440.
