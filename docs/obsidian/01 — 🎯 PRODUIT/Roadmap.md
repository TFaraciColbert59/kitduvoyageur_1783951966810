---
title: Roadmap & Jalons de Développement LKDV
aliases:
  - Roadmap
  - Plan de développement
  - Jalons
tags:
  - product
  - roadmap
  - milestones
updated: 2026-08-17
---

# 🗺️ ROADMAP & JALONS DE DÉVELOPPEMENT

> [!abstract] **Trajectoire technique et produit classée par paliers de faisabilité**
> Chaque palier regroupe des objectifs précis avec critères d'acceptation et statuts réels.

---

## 🏆 TIER A — Sécurité, Robustesse & Socle BDD (Complété ✅)

- [x] **A.1** Activer RLS et verrouiller les 7 tables de sentiers contre les écritures anonymes (`trail_segments`, `hiking_routes`, `trail_metadata`, etc.).
- [x] **A.2** Passer les vues SQL (`explore_trails`, `featured_hiking_routes`) en `SECURITY INVOKER`.
- [x] **A.3** Fixer le `search_path` sur toutes les fonctions PL/pgSQL pour contrer les injections.
- [x] **A.4** Créer la table `kit_reports` et sécuriser la génération des rapports IA.
- [x] **A.5** Recalculer obligatoirement le prix des commandes côté serveur dans `/api/checkout`.
- [x] **A.6** Unifier définitivement « Mon Matériel » et la « Boutique » en supprimant le code mort.

---

## 🚀 TIER B — Expérience Terrain & Fluidité Mobile (Complété ✅)

- [x] **B.1** Écran `/randonnee-active` avec calculs métriques (Haversine) et affichage 60fps.
- [x] **B.2** Détection temps réel des écarts d'itinéraire (> 50m) avec retour haptique.
- [x] **B.3** **Optimisation LCP Mobile :** Réduction du temps de rendu LCP à < 2.5s (optimisation des bundles, élimination du render-blocking, `PremiumBottomSheet` natif).
- [x] **B.4** **Mode Hors-Ligne Vectoriel Avancé :** Téléchargement préalable d'une zone géographique (`useOfflineDownload`, traces + tuiles OSM z=14 en IndexedDB via `offlineStorage`).
- [x] **B.5** **Intégration Pull-to-Refresh & Gestes Apple :** Déploiement unifié des hooks de gestes tactiles (`usePullToRefresh`, `useDragDismiss`, `PremiumBottomSheet`) sur les hubs `/communaute`, `/carnets`, `/clubs`, `/groupes`, `/feed`, et modals de kits.
- [x] **B.6** **Lignées de Kits & Épreuve du Terrain :** Filiation relationnelle (`materiel_kits`), preuves de terrain anonymisées, score de conservation sans métrique monétaire.
- [x] **B.7** **Orientation & Empreinte de Terrain (ADR-010) :** Profil d'orientation intime étanche (RLS stricte), sceau mathématique FieldSeal sans GPS ni PII.

---

## 🌟 TIER C — Intelligence Artificielle & Automatisation (Prochaine étape 🔵)

- [x] **C.1** Reconnaissance visuelle faune / flore dans les carnets de voyage (`/api/carnet/identify-species`).
- [ ] **C.2** **Copilote Météo Prédictif :** Alertes orages et gel nocturne basées sur les coordonnées GPS exactes du bivouac.
- [ ] **C.3** **Génération Automatique de Récits de Trek :** Synthèse intelligente des étapes de la journée en un paragraphe poétique ou technique prêt à publier.
- [ ] **C.4** **Recommandation Dynamique de Matériel Manquant :** Analyse de la météo à J-3 pour suggérer l'ajout de crampons légers ou d'un filtre à eau supplémentaire.

---

## 📈 TIER D — Écosystème & Monétisation Globale (Roadmap 2027 ⚪)

- [ ] **D.1** Ouverture de la phase de retrait monétaire réel (KYC Stripe Connect pour les créateurs de carnets).
- [ ] **D.2** Application Mobile Native (Packaging Capacitor / React Native avec synchronisation GPS en tâche de fond sous écran verrouillé).
- [ ] **D.3** Intégration de partenariats logistiques pour la vérification physique du matériel d'occasion haut de gamme.

---

> [!tip] **Pour poursuivre :**
> - Consulter les détails d'architecture : [[Architecture globale]]
> - Examiner les bugs à résoudre en priorité : [[Bugs]]
