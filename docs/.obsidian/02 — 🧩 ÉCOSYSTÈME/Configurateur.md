---
title: Fiche Module — Configurateur de Kits IA
aliases:
  - Configurateur
  - AI Configurator
  - Générateur de Kits
tags:
  - module
  - configurator
  - ai
updated: 2026-08-17
status: 🟢 Fonctionnel
---

# ⚙️ FICHE MODULE — CONFIGURATEUR DE KITS IA

---

### 1. Objectif
Générer automatiquement une liste de matériel outdoor personnalisée, équilibrée et ultralégère selon les paramètres de l'expédition (climat, altitude, durée, autonomie alimentaire, niveau d'expérience), en évitant les surcharges et les oublis critiques.

---

### 2. UX & Ergonomie
- **Assistant en 4 étapes (Wizard) :** Destination/Saison -> Durée & Autonomie -> Style de bivouac -> Niveau de confort souhaité.
- **Visualisation dynamique du poids :** Barre de jauge de *Base Weight* mise à jour en direct avec codes couleurs (Vert < 5kg, Jaune 5-8kg, Rouge > 8kg).
- **Actions directes :** Bouton « Enregistrer dans Mon Matériel », « Télécharger en PDF » ou « Acheter les manquants ».

---

### 3. Pages & Routes
- `/ai-configurator` : Questionnaire interactif de configuration de kit.
- `/rapport-kit` : Page de restitution détaillée du rapport généré.
- `/rapport-expedition` : Vue synthétique orientée logistique et sécurité.

---

### 4. Composants
- `src/components/configurator/KitConfiguratorWizard.tsx` : Composant multi-étapes.
- `src/components/configurator/WeightGauge.tsx` : Jauge interactive du poids du sac.
- `src/components/configurator/KitReportView.tsx` : Affichage par catégories (Abri, Couchage, Cuisine, Vêtements, Sécurité).

---

### 5. Données & Schéma
- Modèle d'analyse prédictif combinant règles heuristiques d'alpinisme et enrichissement LLM.
- Format de sortie JSON structuré avec répartition par catégories, poids en grammes, niveau d'importance (Indispensable, Recommandé, Optionnel).

---

### 6. Tables Supabase
- `kit_reports` : Stockage persistant des rapports générés (ID utilisateur, paramètres d'entrée, JSON de recommandations, date).
- `shop_products` : Référence des produits réels pour lier les recommandations aux fiches matérielles.

---

### 7. RLS & Sécurité
- Les utilisateurs connectés peuvent insérer et lire leurs propres rapports (`user_id = auth.uid()`).
- Possibilité de génération anonyme avec stockage en session / localStorage avant création de compte.

---

### 8. API Routes
- `POST /api/kit-report/generate` : Moteur de calcul et génération du rapport IA.
- `POST /api/kit-report/save` : Sauvegarde du rapport en base Supabase.
- `POST /api/kit-report/convert-inventory` : Conversion automatique des items recommandés en équipements possédés dans `gear_items`.

---

### 9. Dépendances & Interactions
- **[[Inventaire]] :** Compare instantanément le kit généré avec le matériel déjà possédé par l'utilisateur.
- **[[Boutique]] :** Fournit les liens vers les produits manquants (neuf ou occasion).
- **[[Voyages]] :** Pré-remplit automatiquement le formulaire si l'utilisateur lance le configurateur depuis une fiche sentier.

---

### 10. Notifications Associées
- Email de récapitulatif du kit d'expédition avec checklist imprimable.

---

### 11. Points & Récompenses
- +20 XP lors de la première génération de kit réussie.

---

### 12. Problèmes Connus
- Aucun bug bloquant. (La table `kit_reports` manquante initialement a été déployée et validée par migration SQL).

---

### 13. État
🟢 **Fonctionnel & Déployé**.

---

### 14. Roadmap
- [ ] Ajustement dynamique de la liste selon les prévisions météo réelles à J-3 du départ.
