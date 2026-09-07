# Cartographie des Interconnexions du Voyage Actif — LKDV (Phase 6)
Date : 2026-09-07
Référence : Phase 6 — Contexte de voyage actif & interconnexions

---

## 1. Contexte & Architecture du Voyage Actif (`ActiveTripProvider`)

Le contexte de voyage actif est géré via un cookie **httpOnly** sécurisé `lkv_active_trip`, garantissant :
- **Sécurité** : Aucun jeton sensible ni mot de passe stocké (`id`, `slug`, `title` uniquement, validés par `activeTripSchema` Zod).
- **SSR-Friendly** : Hydraté directement côté serveur par `getActiveTrip()`, évitant les sursauts visuels (FOUC).
- **Réactivité Client** : Diffusé à l'ensemble de l'arbre React via `<ActiveTripProvider>` et le hook `useActiveTrip()`.
- **Visibilité Cross-Module** : Affichage automatique de la bannière contextuelle `<ActiveTripBanner />` sur les modules connectés.

---

## 2. Matrice d'Interconnexion des Modules

| Module / Route | Statut Interconnexion | Comportement avec Voyage Actif |
|---|---|---|
| **/voyages/[slug]** | **Connecté (Cœur)** | Source de vérité, bouton d'activation/désactivation du voyage actif, synchronisation temps réel des 3 phases. |
| **/materiel** | **Connecté** | Bannière contextuelle, synchronisation de l'inventaire et du sac sur le déficit d'équipement de l'expédition active. |
| **/carte-interactive** | **Connecté** | Bannière active, centrage et focus sur le massif/tracé du voyage actif. |
| **/copilote** | **Connecté** | Injection automatique du titre et du contexte d'expédition dans les prompts du copilote IA avec garde-fous stricts (pas de certitude médicale, renvoi 112/114). |
| **/carnets** | **Connecté** | Débouché direct de la phase *Raconter*, export et valorisation du carnet de bord du voyage actif. |
| **/carbone** | **Connecté** | Récupération des modes de transport de l'itinéraire du voyage actif pour estimer le bilan carbone global. |
| **/alertes** | **Connecté** | Vigilance météo et alertes locales ciblées sur la zone géographique de l'expédition en cours. |
| **/equipages** | **Connecté** | Rattachement de l'expédition à l'équipage hôte (`crew_id`), partage automatique du sac et des dépenses. |
| **/encheres** | **Hors Périmètre** | Place de marché C2C d'enchères de matériel d'occasion : autonome, sans dépendance directe avec un voyage planifié. |
| **/clubs & /ambassadeurs** | **Hors Périmètre** | Fédérations et collectifs de marque rattachés au profil utilisateur et aux équipages publics, indépendamment d'un voyage précis. |
| **/entraide** | **Hors Périmètre** | Forum d'entraide communautaire global transversal. |
| **/fidelite & /recompenses** | **Hors Périmètre** | Programme de fidélité et gamification rattaché au compte utilisateur global (`auth.users`), pas à une expédition spécifique. |
