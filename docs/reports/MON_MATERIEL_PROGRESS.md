# 🧭 MON MATÉRIEL — Mémoire de Chantier & Architecture

*Dernière mise à jour : 17 Août 2026*

---

## 1. 🔍 Architecture Découverte & Consolidée

### Base de données & Supabase
- **`public.gear_items`** :
  - Données d'inventaire, métriques de poids, prix, état, statut de prêt, compartiments, alertes d'entretien et historique d'usure (`usage_count`, `last_used_date`, `sorties_count`).
- **`public.custom_kits` & `public.custom_kit_items`** :
  - Support multi-kits complet : un équipement peut appartenir à plusieurs kits.
  - Cycle de vie intelligent : Récents/Favoris → Actifs → Corbeille 10 jours (`status = 'trash'`, `deleted_at`) → Suppression définitive via RPC `cleanup_expired_trash_kits`.
  - Sources unifiées : `configurator` (IA), `manuel` (création utilisateur), `auto_prepared` (généré automatiquement pour une sortie).
  - Tri prioritaire : kits issus du Configurateur IA toujours affichés en premier.
- **`public.hiking_routes` & `public.hike_sessions`** :
  - Tracés d'itinéraires réels et suivi de sessions d'expédition avec enregistrement automatique post-randonnée de l'usage du matériel via RPC `record_hike_gear_usage`.
- **`public.shop_products` & Panier** :
  - Catalogue unifié et panier connectés avec gestion préventive des délais de livraison vs date de départ planifiée.

### Moteur de Calcul & Préparation
- **`src/lib/preparation/SmartDepartureEngine.ts`** :
  - Auto-sélection du kit le plus adapté ou génération automatique d'un kit sur-mesure si score < 65%.
  - Calcul dynamique et précis des consommables : eau (en L avec prise en compte du dénivelé, de la température et des points d'eau disponibles pour alléger le sac), repas & rations, gaz (g), électrolytes, sécurité.
  - Checklist interactive en 4 zones claires : *Dans le sac & Prêt*, *Consommables à charger*, *Points d'attention & Sécurité*, *Éléments conseillés / Manquants*.
- **`src/hooks/useUserKits.ts`** :
  - Gestion unifiée des kits (CRUD, corbeille 10 jours, restauration en 1 tap, auto-substitution si un équipement est supprimé ou indisponible).

---

## 2. 🎯 Fonctionnalités Réalisées

1. **Configurateur IA Outil N°1 en tête de page (`AIConfiguratorHeroCard.tsx`)** :
   - 4 Presets 1-clic instantanés (*Trek Alpin 3j*, *Journée Estivale*, *Bivouac Forêt 2j*, *Ultra-Light 48h*).
   - Saisie libre en une phrase avec génération immédiate sans aucun effort.
2. **Expérience Unifiée sur Page Unique (`src/app/mon-materiel/page.tsx`)** :
   - Zéro sous-onglets bloquants : tout est accessible sur une seule page fluide et continue.
   - En-tête avec poids global du sac et répartition visuelle par famille.
   - Prochain départ planifié avec météo en direct, score de préparation et checklist 4-zones.
3. **Gestion Anti-Conflit Délais de Livraison (`EquipmentUnifiedList.tsx`)** :
   - Choix immédiat sur les articles manquants : *« + J'ai déjà cet équipement »* ou *« 🛒 Mettre dans le panier (Livraison 48h) »*.
   - Alerte préventive automatique si le départ a lieu dans $\le 3$ jours pour éviter les livraisons trop tardives.
4. **Mes Kits : IA en premier & édition simple (`KitsManagerView.tsx`)** :
   - Tri automatique garantissant les kits IA en tête de liste.
   - Sélection d'équipements possédés en 1 tap et corbeille 10 jours.
5. **Inventaire & Matériel : Toggle Simple « Tout / Possédé » & Rangement par Catégories** :
   - Toggle minimaliste remplaçant tous les filtres complexes.
   - Regroupement automatique par catégories avec sous-totaux de poids calculés en direct.

---

## 3. 📋 Tâches Terminées

- [x] Inspection complète de la base et du code existant.
- [x] Migration SQL `20260821000000_intelligent_kits_and_departure_system.sql`.
- [x] Hook `useUserKits.ts` avec support complet Supabase & mode invité.
- [x] Moteur intelligent `SmartDepartureEngine.ts`.
- [x] Composant vedette `AIConfiguratorHeroCard.tsx` (Outil N°1 mis en avant).
- [x] Gestionnaire de randonnées planifiées `plannedHikes.ts` et modale date de départ.
- [x] Vue `EquipmentUnifiedList.tsx` avec anti-conflit de livraison et 2 boutons explicites.
- [x] Vue `KitsManagerView.tsx` avec tri prioritaire configurateur IA.
- [x] Section Inventaire & Matériel avec toggle Tout/Possédé et rangement par catégories.
- [x] Redirections 308 permanentes dans `next.config.mjs`.
- [x] Documentation complète [`MON_MATERIEL_FONCTIONNEMENT.md`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/MON_MATERIEL_FONCTIONNEMENT.md).
