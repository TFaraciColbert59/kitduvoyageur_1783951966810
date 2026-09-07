# Script de Démonstration Investisseur LKDV (7 minutes)

> **Objectif** : Prouver la puissance, la fluidité et l'unicité produit de la plateforme LKDV (Voyages & Équipages unifiés).
> **Jeu de données** : Exécuter au préalable `npm run seed:demo`.

---

## Chronogramme de Démonstration (7 min chrono)

### Minute 0:00 — 1:00 : Accueil & Contexte Actif Partagé (Cross-Module)
- **Action** : Ouvrir l'accueil (`/`).
- **Constat visuel** : Présence du bandeau discret « Expédition active ».
- **Message clé** : L'utilisateur ne perd jamais son contexte. Qu'il aille dans le catalogue de matériel, sur la carte interactive ou dans la messagerie, l'expédition en cours reste active et synchronisée.
- **Microinteraction** : Clic sur le bouton « Continuer la préparation » qui plonge directement dans le cockpit du voyage.

### Minute 1:00 — 2:15 : Moteur d'Itinéraire Automatique (28 jours sans trou)
- **Action** : Créer un nouveau voyage libre de 28 jours en France (`/voyages/nouveau`).
- **Constat visuel** : Génération instantanée d'un itinéraire de 28 étapes complètes avec dénivelé cumulé et attribution des nuits (bivouac / refuge).
- **Preuve technique** : Résolution formelle du défaut D1 : jamais d'itinéraire vide, badge de provenance certifié (« Squelette » ou « Paramétrique »).

### Minute 2:15 — 3:15 : Rattachement à un Équipage & Rôles
- **Action** : Rattacher ce voyage à un équipage existant (« Équipage du Mercantour ») ou inviter un coéquipier.
- **Constat visuel** : Génération d'un lien d'invitation signé HMAC. Affichage des badges de rôle unifiés (`owner`, `organizer`, `member`, `guest`).
- **Preuve technique** : Modèle de permissions unifié `lkv_can` : l'invité a les droits de consultation et d'ajout de dépenses sans pouvoir supprimer le voyage.

### Minute 3:15 — 4:15 : Équipement & Monétisation Éthique
- **Action** : Aller sur l'onglet Matériel du voyage.
- **Constat visuel** : Calcul en temps réel du poids de base (ex: 4.85 kg).
- **Déficit d'équipement** : Ajout d'un produit manquant qui renvoie vers la boutique intégrée.
- **Preuve légale** : Présence permanente du badge « Sponsorisé » conforme à la loi influence n° 2023-451.

### Minute 4:15 — 5:15 : Profil d'Altitude & Risques Climatiques Justifiés
- **Action** : Consultation du widget d'altitude et de saisonnalité.
- **Constat visuel** : Exactement 2 recommandations critiques (« Crampons légers » et « Veste Gore-Tex 3L » pour passage de col > 2500m).
- **Preuve technique** : Résolution formelle du défaut D2 & D7 : pas de 6 fausses offres haute montagne sur une basse vallée.

### Minute 5:15 — 6:00 : Export GPX 1.1 pour Montre GPS
- **Action** : Clic sur « Exporter GPX » (`/voyages/[slug]/export`).
- **Constat visuel** : Téléchargement instantané d'un fichier standardisé GPX 1.1 conforme, intégrant waypoints, profils de dénivelé et étapes.

### Minute 6:00 — 7:00 : Fin de Voyage, Mode Vivre & Boucle SEO Carnet Public
- **Action** : Démonstration rapide du mode Vivre (boutons de sécurité 112/114, saisie rapide hors-ligne) puis bascule sur « Raconter ».
- **Action** : Publication du carnet de voyage.
- **Constat visuel** : Page publique canonique indexable avec balises Schema.org (`TouristTrip`), OpenGraph et Twitter cards.
- **Conclusion investisseur** : Chaque aventure vécue génère du contenu SEO organique qui attire de nouveaux voyageurs. La boucle de croissance est complète et pérenne.
