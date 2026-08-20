# Mon Matériel — Guide d'utilisation (cockpit LKDV)

> Route : `/mon-materiel` · Branche : `feat/mon-materiel-clean-rebuild-v3`

## Ouverture du cockpit

Le cockpit affiche **6 cartes** en grille (3 colonnes desktop / 1 colonne mobile) :
À ne pas oublier · Alertes & fiabilité · Mes kits · Prochain départ · Inventaire & catalogue · Disponibilité.

Chaque carte montre une métrique principale, des badges, une progression et un bouton
**Agrandir** (`aria-label="Agrandir la carte …"`) qui ouvre le plein écran correspondant.

- **Drag & drop** : faites glisser la poignée `⠿` en haut à droite d'une carte pour la
  réordonner. La position est persistée dans `localStorage` (`lkdv_cockpit_widget_order`)
  et restaurée au prochain chargement.
- **Escape / focus trap** : chaque plein écran se ferme avec `Échap`, le focus est piégé
  dans l'overlay puis restauré sur la carte d'origine.

## Les 6 vues plein écran

### À ne pas oublier (`NotToForgetFullscreen`)
Checklist intelligente générée depuis vos données (kit assigné, alertes entretien/péremption/
prêt/usure, météo) + règles génériques explicitement marquées.
- Filtres par niveau : Tous / Bloquants / À vérifier / Conseillé / Déjà prêt.
- Coche persistée (`lkdv_forget_checked`), poids restant, compagnons, répartition du sac.
- Boutons « Valider ma préparation » (snapshot) et **Exporter CSV** de la checklist.

### Prochain départ (`NextDepartureFullscreen`)
Compte à rebours J-X, score de préparation (Prêt / À vérifier / Bloqué), météo, consommables,
kit recommandé, checklist condensée, participants, historique des sorties, assignation de kit.

### Alertes & fiabilité (`AlertsReliabilityFullscreen`)
Score de fiabilité global, onglets (Entretien / Péremption / Prêts / État / Conflits / Toutes),
mini-calendrier des péremptions à 30 jours, usure moyenne, top 3 à surveiller, fiches à compléter,
tendance saisonnière, alertes résolues repliables.

### Mes kits (`MyKitsFullscreen`)
Onglets Mes kits / Kit du prochain départ / Corbeille. Recherche, tri (Récents / Utilisation /
Poids / Nom), barres de complétude par kit, détail (répartition par catégorie, manquants,
substituts, indisponibles), dupliquer, assigner au départ, corbeille (restaurer / supprimer).

### Inventaire & catalogue (`InventoryCatalogFullscreen`)
Onglets Mon inventaire / Catalogue / En commande / Corbeille.
- Inventaire : recherche, tri, favoris, badges d'usage, poids/valeur, fiches à compléter,
  doublons, **Exporter CSV**.
- Catalogue : données réelles `shop_products`, filtre par catégorie, **Ajouter à l'équipement**
  (Cas A : possédé → kit ; Cas B : indisponible → conflit ; Cas C : à acheter → panier + destination).
- En commande : **Confirmer la réception** → l'article rejoint l'inventaire (+ kit si mémorisé).

### Disponibilité (`AvailabilityFullscreen`)
Synthèse (indisponibles, valeur hors domicile, conflits, prêts), donut dispo/engagé/prêté,
fenêtre Semaine/Mois (7/30 j), retour le plus urgent, objets dormants (action « Vendre »),
onglets Prêté par moi / Emprunté par moi / Engagé dans un départ, timeline par objet,
actions « Marquer rendu » / « Relancer » / « Ouvrir la fiche ».

## Drawer « Tout voir »

Bouton en haut du cockpit → 4 onglets : **Inventaire · Prêts & Alertes · Réglages · Actions**
(assistance IA, navigation, objectif de poids 5–20 kg, réinitialisation de la disposition).

## Exports

| Export | Où | Format |
|---|---|---|
| Checklist de préparation | Plein écran « À ne pas oublier » | CSV |
| Inventaire complet | Onglet « Mon inventaire » | CSV |

Les exports sont tracés dans `inventory_exports` / `kit_export_logs` (tables M8/M9, best-effort).

## Raccourcis notables

- `Échap` ferme un plein écran ; `Tab` reste dans l'overlay.
- Le fond animé (vidéo `mm-ambient.mp4` / image Ken Burns) se fige avec
  `prefers-reduced-motion: reduce`.