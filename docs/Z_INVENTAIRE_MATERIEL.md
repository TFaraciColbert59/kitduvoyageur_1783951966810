# Z0 — CARTOGRAPHIE ET INVENTAIRE DE VÉRITÉ DU PÉRIMÈTRE MATÉRIEL

- **Date d'exécution** : 8 septembre 2026
- **Branche** : `chantier/z-materiel-hub`
- **Point de départ** : commit `16a58c4a` (Merge PR #33 sur `main`)
- **Périmètre** : Cartographie, inventaire et preuves formelles en lecture seule. Zéro modification de code applicatif, zéro suppression.

---

## 1. Tableau des couches du périmètre matériel (tailles réelles relevées)

Relevé strict effectué par inspection système du système de fichiers (commandes Node.js `fs.statSync`). Les tailles sont en octets exacts (`bytes`).

### Récapitulatif global des couches

> [!NOTE]
> **Distinction CRLF (Windows) vs LF (Git Blob)** : Les tailles relevées via l'API système de fichiers Windows reflètent l'empreinte disque locale avec fins de ligne CRLF (`\r\n`). Les tailles git réelles (blobs LF relevés via `git ls-tree -r -l HEAD`) sont de 2 à 2,5 % inférieures sur les fichiers TS/TSX textuels. Pour `src/features/gear`, la taille git réelle est de **47 160 octets** (contre 47 944 en local).

| Couche | Rôle architectural | Nombre de fichiers | Taille Git LF (octets) | Taille disque CRLF | Statut |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `src/features/gear` | Implémentation isolée shakedown/audit sac | 8 | **47 160** | 47 944 | **Orphelin UI / Moteur testé** |
| `src/features/kits` | Lineage social, affiliations, commissions, preuves terrain | 8 | **28 544** | 28 544 | **Sanctuarisé (actif)** |
| `src/components/kits` | Cartes et découverte de kits communautaires/produits | 2 | **6 109** | 6 109 | **Sanctuarisé (actif)** |
| `src/features/materiel` | Source de vérité inventaire physique, départs, prêts, alertes | 110 | **561 820** | 573 984 | **Source de vérité active** |
| *Périmètres connexes identifiés* : | | | | | |
| `src/features/preparation` | Cockpit préparation rando, gaps équipement, charges | 16 | **114 960** | 117 523 | **Actif (`/materiel/preparation`)** |
| `src/app/materiel` | Routes et pages Next.js App Router matériel | 20 | **34 120** | 34 838 | **Actif (7 sous-routes)** |
| `src/lib/materiel` | Utilitaires BDD, conflits, comparateur matériel | 7 | **12 724** | 12 724 | **Actif (support)** |

---

### Détail couche 1 : `src/features/gear` (8 fichiers, 47 160 octets Git / 47 944 octets CRLF)

| Fichier | Taille Git LF (octets) | Taille disque CRLF | Description / Type |
| :--- | :---: | :---: | :--- |
| `src/features/gear/components/GearChecklist.tsx` | **8 622** | 8 831 | Composant UI checklist d'équipement |
| `src/features/gear/components/GearManager.tsx` | **9 674** | 9 911 | Composant UI principal de gestion équipement |
| `src/features/gear/components/ShakedownAuditView.tsx` | **7 828** | 8 026 | Composant UI d'affichage du rapport d'audit |
| `src/features/gear/components/WeightSummaryCard.tsx` | **5 764** | 5 904 | Composant UI carte de répartition de poids |
| `src/features/gear/index.ts` | **302** | 302 | Barrel d'export du module |
| `src/features/gear/services/shakedownEngine.ts` | **6 532** | 6 532 | **Moteur arithmétique de calcul de poids & vitaux** |
| `src/features/gear/stores/useGearStore.ts` | **6 232** | 6 232 | Store Zustand pour gear/shakedown |
| `src/features/gear/types/gear.types.ts` | **2 206** | 2 206 | Définitions TypeScript (GearItem, WeightBreakdown...) |

---

### Détail couche 2 : `src/features/kits` (8 fichiers, 28 544 octets)

| Fichier | Taille (octets) | Description / Type |
| :--- | :---: | :--- |
| `src/features/kits/components/KitSheetModal.tsx` | 11 231 | Modal / Bottom sheet de consultation d'un kit public |
| `src/features/kits/fieldProof.ts` | 1 644 | Preuves terrain & validation matériel éprouvé |
| `src/features/kits/kitRef.ts` | 2 602 | Signature et vérification des liens d'affiliation kits |
| `src/features/kits/KitSheetContext.tsx` | 1 668 | Contexte React global pour la modal kit |
| `src/features/kits/lineage.ts` | 2 714 | Traçabilité des forks et filiation des kits |
| `src/features/kits/royalty.ts` | 4 468 | Calcul des royalties créateurs (webhooks Stripe) |
| `src/features/kits/trust.ts` | 2 545 | Score de confiance et taux de survie matériel |
| `src/features/kits/types.ts` | 1 672 | Types TypeScript kits (Kits, Lineage, Royalties) |

---

### Détail couche 3 : `src/components/kits` (2 fichiers, 6 109 octets)

| Fichier | Taille (octets) | Description / Type |
| :--- | :---: | :--- |
| `src/components/kits/LineageDiscovery.tsx` | 3 732 | Découverte de la lignée d'un équipement/kit |
| `src/components/kits/ProductLineageCard.tsx` | 2 377 | Carte produit affichant la filiation |

---

### Détail couche 4 : `src/features/materiel` (110 fichiers, 573 984 octets)

#### Sous-dossier `actions/` (10 fichiers, 15 486 octets)
| Fichier | Taille (octets) | Rôle |
| :--- | :---: | :--- |
| `src/features/materiel/actions/addDepartItem.ts` | 2 131 | Action serveur : ajout item à un départ |
| `src/features/materiel/actions/addInventoryItem.ts` | 1 644 | Action serveur : ajout item à l'inventaire |
| `src/features/materiel/actions/createLoan.ts` | 1 675 | Action serveur : création d'un prêt de matériel |
| `src/features/materiel/actions/deleteDepartItem.ts` | 1 113 | Action serveur : suppression item d'un départ |
| `src/features/materiel/actions/deleteInventoryItem.ts` | 1 046 | Action serveur : suppression item inventaire |
| `src/features/materiel/actions/toggleKitItem.ts` | 2 093 | Action serveur : bascule statut item kit |
| `src/features/materiel/actions/updateDepartMeta.ts` | 1 569 | Action serveur : métadonnées départ |
| `src/features/materiel/actions/updateDepartStatus.ts` | 1 284 | Action serveur : statut d'un départ |
| `src/features/materiel/actions/updateItemQuantity.ts` | 1 220 | Action serveur : quantité item |
| `src/features/materiel/actions/updateLoanStatus.ts` | 1 653 | Action serveur : statut prêt |

#### Sous-dossier `components/alertes/` (10 fichiers, 16 646 octets)
| Fichier | Taille (octets) | Rôle |
| :--- | :---: | :--- |
| `src/features/materiel/components/alertes/AlertsTimeline.tsx` | 1 195 | Chronologie des alertes matérielles |
| `src/features/materiel/components/alertes/CategoryTabs.tsx` | 2 807 | Onglets par catégorie de matériel |
| `src/features/materiel/components/alertes/ExportShareBar.tsx` | 2 430 | Barre d'export et partage |
| `src/features/materiel/components/alertes/MaintenanceCalendar.tsx` | 1 897 | Calendrier de maintenance préventive |
| `src/features/materiel/components/alertes/OccasionMarketplace.tsx` | 1 488 | Suggestions d'achat d'occasion |
| `src/features/materiel/components/alertes/ReliabilityScore.tsx` | 970 | Jauge score de fiabilité globale |
| `src/features/materiel/components/alertes/SeasonalBanner.tsx` | 491 | Bannière d'entretien saisonnier |
| `src/features/materiel/components/alertes/ToCompleteList.tsx` | 1 558 | Liste des items incomplets ou à réviser |
| `src/features/materiel/components/alertes/TopAlertsAccordion.tsx` | 1 910 | Accordéon des alertes critiques |
| `src/features/materiel/components/alertes/WeatherRadar.tsx` | 885 | Radar météo vs matériel requis |

#### Sous-dossier `components/cards/` (8 fichiers, 33 977 octets)
| Fichier | Taille (octets) | Rôle |
| :--- | :---: | :--- |
| `src/features/materiel/components/cards/CountdownLive.tsx` | 1 777 | Décompte dynamique avant départ trek |
| `src/features/materiel/components/cards/GearCardAlertes.tsx` | 3 920 | Carte dashboard alertes |
| `src/features/materiel/components/cards/GearCardDepart.tsx` | 5 619 | Carte dashboard départ |
| `src/features/materiel/components/cards/GearCardDispo.tsx` | 3 857 | Carte dashboard disponibilité/prêts |
| `src/features/materiel/components/cards/GearCardForget.tsx` | 3 722 | Carte dashboard anti-oubli |
| `src/features/materiel/components/cards/GearCardInventaire.tsx` | 3 904 | Carte dashboard inventaire |
| `src/features/materiel/components/cards/GearCardKits.tsx` | 4 421 | Carte dashboard kits |
| `src/features/materiel/components/cards/GearCardSuivi.tsx` | 6 740 | Carte dashboard suivi |

#### Sous-dossier `components/depart/` (14 fichiers, 219 986 octets)
| Fichier | Taille (octets) | Rôle |
| :--- | :---: | :--- |
| `src/features/materiel/components/depart/DepartAlerts.tsx` | 11 424 | Alertes matérielles spécifiques au départ |
| `src/features/materiel/components/depart/DepartChecklist.tsx` | 41 247 | Checklist complète de sac et matériel |
| `src/features/materiel/components/depart/DepartCockpit.tsx` | 28 698 | Hub central du cockpit départ |
| `src/features/materiel/components/depart/DepartCockpitSkeleton.tsx` | 3 732 | Squelette de chargement cockpit |
| `src/features/materiel/components/depart/DepartEquipmentHub.tsx` | 49 692 | Hub d'équipement multi-catégories |
| `src/features/materiel/components/depart/DepartHeader.tsx` | 21 440 | En-tête départ avec météo et statut |
| `src/features/materiel/components/depart/DepartLeftSidebar.tsx` | 7 750 | Sidebar gauche navigation départ |
| `src/features/materiel/components/depart/DepartMap.tsx` | 13 367 | Carte géographique du tracé de départ |
| `src/features/materiel/components/depart/DepartParticipants.tsx` | 6 521 | Gestion des participants et attributions |
| `src/features/materiel/components/depart/DepartRightSidebar.tsx` | 5 028 | Sidebar droite (poids, décompte) |
| `src/features/materiel/components/depart/DepartureSheetModal.tsx` | 11 545 | Modal fiche récapitulative départ |
| `src/features/materiel/components/depart/DepartWeather.tsx` | 7 481 | Météo prévisionnelle de la zone |
| `src/features/materiel/components/depart/DepartWeightBreakdown.tsx` | 8 097 | Décomposition du poids du départ |
| `src/features/materiel/components/depart/KitSwitcher.tsx` | 3 187 | Sélecteur et bascule de kit associé |

#### Sous-dossier `components/disponibilite/` (10 fichiers, 17 076 octets)
| Fichier | Taille (octets) | Rôle |
| :--- | :---: | :--- |
| `src/features/materiel/components/disponibilite/AutoReminders.tsx` | 1 331 | Relances automatiques pour retours de prêt |
| `src/features/materiel/components/disponibilite/AvailabilityGauge.tsx` | 1 329 | Jauge de disponibilité du parc |
| `src/features/materiel/components/disponibilite/CollectiveActions.tsx` | 1 372 | Actions groupées sur prêts |
| `src/features/materiel/components/disponibilite/ConflictDetector.tsx` | 1 163 | Détecteur de conflits de réservation |
| `src/features/materiel/components/disponibilite/DigitalLoanContract.tsx` | 1 676 | Contrat numérique de prêt entre pairs |
| `src/features/materiel/components/disponibilite/DispoKpis.tsx` | 1 044 | Indicateurs clés de disponibilité |
| `src/features/materiel/components/disponibilite/DispoScore.tsx` | 782 | Score de rotation et disponibilité |
| `src/features/materiel/components/disponibilite/GanttTimeline.tsx` | 1 891 | Vue Gantt des emprunts et réservations |
| `src/features/materiel/components/disponibilite/LoanHeatmap.tsx` | 1 150 | Heatmap d'occupation du matériel |
| `src/features/materiel/components/disponibilite/LoanTabs.tsx` | 3 067 | Onglets prêts en cours / passés / demandes |

#### Sous-dossier `components/forget/` (3 fichiers, 4 043 octets)
| Fichier | Taille (octets) | Rôle |
| :--- | :---: | :--- |
| `src/features/materiel/components/forget/ForgetChecklist.tsx` | 1 699 | Checklist anti-oubli d'avant départ |
| `src/features/materiel/components/forget/ForgetChecklistItem.tsx` | 924 | Item individuel anti-oubli |
| `src/features/materiel/components/forget/ForgetWorkspace.tsx` | 1 420 | Espace de travail anti-oubli |

#### Sous-dossier `components/inventaire/` (7 fichiers, 26 397 octets)
| Fichier | Taille (octets) | Rôle |
| :--- | :---: | :--- |
| `src/features/materiel/components/inventaire/AiInsightBanner.tsx` | 902 | Conseils IA d'optimisation d'inventaire |
| `src/features/materiel/components/inventaire/CrossSellStrip.tsx` | 1 188 | Suggestions de matériel complémentaire |
| `src/features/materiel/components/inventaire/InventoryCard.tsx` | 1 367 | Carte individuelle d'item d'inventaire |
| `src/features/materiel/components/inventaire/InventoryOverview.tsx` | 1 459 | Vue globale de l'inventaire (KPIs) |
| `src/features/materiel/components/inventaire/InventoryVirtualGrid.tsx` | 1 449 | Grille virtualisée d'articles |
| `src/features/materiel/components/inventaire/InventoryWorkspace.tsx` | 17 305 | Espace interactif complet de l'inventaire |
| `src/features/materiel/components/inventaire/PurchasesInvest.tsx` | 2 727 | Suivi investissements & rentabilité matériel |

#### Sous-dossier `components/kits/` (15 fichiers, 107 433 octets)
| Fichier | Taille (octets) | Rôle |
| :--- | :---: | :--- |
| `src/features/materiel/components/kits/KitBuilder.tsx` | 34 595 | Constructeur de kit complet |
| `src/features/materiel/components/kits/KitComparator.tsx` | 3 333 | Comparateur côte-à-côte de kits |
| `src/features/materiel/components/kits/KitHistoryTimeline.tsx` | 1 573 | Historique des révisions d'un kit |
| `src/features/materiel/components/kits/KitManager.tsx` | 5 881 | Gestionnaire de kits utilisateur |
| `src/features/materiel/components/kits/KitOptimizer.tsx` | 4 556 | Optimiseur de kit par algorithme |
| `src/features/materiel/components/kits/KitOverviewCockpitCard.tsx` | 1 863 | Carte récapitulative kit cockpit |
| `src/features/materiel/components/kits/KitPreparationCockpitCard.tsx` | 4 351 | Carte préparation kit cockpit |
| `src/features/materiel/components/kits/KitProductSuggestions.tsx` | 9 768 | Suggestions produits affiliés pour kit |
| `src/features/materiel/components/kits/KitsActiveCockpitCard.tsx` | 5 443 | Carte kits actifs cockpit |
| `src/features/materiel/components/kits/KitsCockpit.tsx` | 9 800 | Cockpit principal de gestion des kits |
| `src/features/materiel/components/kits/KitsGrid.tsx` | 7 076 | Grille d'affichage des kits |
| `src/features/materiel/components/kits/KitsKpiBar.tsx` | 1 806 | Barre d'indicateurs kits |
| `src/features/materiel/components/kits/KitsKpiCockpitCard.tsx` | 3 552 | Carte KPIs kits cockpit |
| `src/features/materiel/components/kits/KitsMobileCockpit.tsx` | 4 842 | Cockpit mobile pour kits |
| `src/features/materiel/components/kits/TemplateStore.tsx` | 7 083 | Magasin de modèles / templates de kits |
| `src/features/materiel/components/kits/WeatherMatchScore.tsx` | 1 367 | Adéquation kit / météo |

#### Sous-dossier `components/mobile/` (4 fichiers, 29 279 octets)
| Fichier | Taille (octets) | Rôle |
| :--- | :---: | :--- |
| `src/features/materiel/components/mobile/MobileChecklistItem.tsx` | 8 496 | Item checklist tactile optimisé mobile |
| `src/features/materiel/components/mobile/MobileFloatingIsland.tsx` | 7 671 | Îlot flottant navigation mobile |
| `src/features/materiel/components/mobile/MobileVitalAlertBanner.tsx` | 5 671 | Bannière alerte vitaux mobile |
| `src/features/materiel/components/mobile/MobileWeightHeader.tsx` | 7 441 | En-tête poids compact pour mobile |

#### Composants racine `components/` (3 fichiers, 8 164 octets)
| Fichier | Taille (octets) | Rôle |
| :--- | :---: | :--- |
| `src/features/materiel/components/DemoLoginButton.tsx` | 1 381 | Bouton de connexion démo matériel |
| `src/features/materiel/components/MaterielGrid.module.css` | 360 | Styles CSS du dashboard matériel |
| `src/features/materiel/components/MaterielGrid.tsx` | 6 423 | Grille générale dashboard matériel |

#### Sous-dossiers transverses (domaine, hooks, offline, services, stores, types) (23 fichiers, 98 880 octets)
| Fichier | Taille (octets) | Rôle |
| :--- | :---: | :--- |
| `src/features/materiel/domain/departCalculations.ts` | 7 736 | Calculs de poids et ratios de départ |
| `src/features/materiel/hooks/useKits.ts` | 2 111 | Hook React pour manipulation des kits |
| `src/features/materiel/offline/departOfflineQueue.ts` | 3 163 | File d'attente offline pour départs |
| `src/features/materiel/services/departNotifications.ts` | 2 271 | Notifications départ |
| `src/features/materiel/services/estimateConsumables.ts` | 468 | Estimation consommables |
| `src/features/materiel/services/gearImageResolver.ts` | 8 077 | Résolveur d'images matériel |
| `src/features/materiel/services/generateSmartPrompts.ts` | 10 127 | Génération de prompts IA équipement |
| `src/features/materiel/services/getAlerts.ts` | 898 | Service récupération alertes |
| `src/features/materiel/services/getDepartDetail.ts` | 24 961 | Service chargement détail départ complet |
| `src/features/materiel/services/getForgetChecklist.ts` | 1 135 | Service checklist oublis |
| `src/features/materiel/services/getInventory.ts` | 1 238 | Service récupération inventaire |
| `src/features/materiel/services/getKitHistory.ts` | 964 | Service historique kits |
| `src/features/materiel/services/getKits.ts` | 5 145 | Service récupération kits |
| `src/features/materiel/services/getLoans.ts` | 1 027 | Service gestion des prêts |
| `src/features/materiel/services/getMaterielSummary.ts` | 9 320 | Synthèse KPIs module matériel |
| `src/features/materiel/services/getOccasionProducts.ts` | 1 041 | Produits seconde main |
| `src/features/materiel/services/getProductSuggestions.ts` | 1 210 | Suggestions de produits affiliés |
| `src/features/materiel/services/getPublicKits.ts` | 1 108 | Récupération kits publics |
| `src/features/materiel/services/getWeather.ts` | 5 145 | Données météo |
| `src/features/materiel/services/itemCategorizer.ts` | 4 643 | Catégorisation et normalisation d'items |
| `src/features/materiel/services/sync.ts` | 499 | Synchronisation données |
| `src/features/materiel/store/useDepartOrder.ts` | 1 083 | Ordre des items départ |
| `src/features/materiel/store/useKitsOrder.ts` | 1 062 | Ordre des kits |
| `src/features/materiel/store/useMaterielOrder.ts` | 1 303 | Ordre général matériel |
| `src/features/materiel/types/trekHub.ts` | 4 444 | Types trek et matériel |

---

## 2. Sorties brutes de chaque grep (y compris vides)

Les commandes ci-dessous ont été exécutées directement via `rg` (ripgrep) sur l'intégralité du dépôt. Aucune sortie n'est tronquée ou modifiée.

### Grep 1 : `@/features/gear`
```powershell
rg --no-heading -n "@/features/gear" src/ tests/
```
**Code retour** : `1`
**Sortie brute** :
```
(sortie vide — 0 résultat)
```

---

### Grep 2 : `features/gear`
```powershell
rg --no-heading -n "features/gear" src/ tests/
```
**Code retour** : `0`
**Sortie brute** :
```
tests/gear-shakedown.spec.ts:2:import { GearItem } from '../src/features/gear/types/gear.types';
tests/gear-shakedown.spec.ts:9:} from '../src/features/gear/services/shakedownEngine';
tests/gear-shakedown.spec.ts:10:import { useGearStore } from '../src/features/gear/stores/useGearStore';
```

---

### Grep 3 : `from '@/features/gear`
```powershell
rg --no-heading -n "from '@/features/gear" src/ tests/
```
**Code retour** : `1`
**Sortie brute** :
```
(sortie vide — 0 résultat)
```

---

### Grep 4 : Symbole `GearManager`
```powershell
rg --no-heading -n "GearManager" src/ tests/
```
**Code retour** : `0`
**Sortie brute** :
```
src/features\gear\index.ts:7:export * from './components/GearManager';
src/features\gear\components\GearManager.tsx:10:export const GearManager: React.FC = () => {
```

---

### Grep 5 : Symbole `useGearStore`
```powershell
rg --no-heading -n "useGearStore" src/ tests/
```
**Code retour** : `0`
**Sortie brute** :
```
tests/gear-shakedown.spec.ts:10:import { useGearStore } from '../src/features/gear/stores/useGearStore';
tests/gear-shakedown.spec.ts:182:    const store = useGearStore.getState();
src/features\gear\stores\useGearStore.ts:188:export const useGearStore = create<GearStoreState>((set, get) => {
src/features\gear\index.ts:3:export * from './stores/useGearStore';
src/features\gear\components\GearManager.tsx:4:import { useGearStore } from '../stores/useGearStore';
src/features\gear\components\GearManager.tsx:11:  const items = useGearStore((s) => s.items);
src/features\gear\components\GearManager.tsx:12:  const categoryFilter = useGearStore((s) => s.categoryFilter);
src/features\gear\components\GearManager.tsx:13:  const statusFilter = useGearStore((s) => s.statusFilter);
src/features\gear\components\GearManager.tsx:14:  const setCategoryFilter = useGearStore((s) => s.setCategoryFilter);
src/features\gear\components\GearManager.tsx:15:  const setStatusFilter = useGearStore((s) => s.setStatusFilter);
src/features\gear\components\GearManager.tsx:16:  const setItemStatus = useGearStore((s) => s.setItemStatus);
src/features\gear\components\GearManager.tsx:17:  const toggleItemWorn = useGearStore((s) => s.toggleItemWorn);
src/features\gear\components\GearManager.tsx:18:  const addItem = useGearStore((s) => s.addItem);
src/features\gear\components\GearManager.tsx:19:  const removeItem = useGearStore((s) => s.removeItem);
src/features\gear\components\GearManager.tsx:20:  const getWeightBreakdown = useGearStore((s) => s.getWeightBreakdown);
src/features\gear\components\GearManager.tsx:21:  const getShakedownReport = useGearStore((s) => s.getShakedownReport);
```

---

### Grep 6 : Symbole `ShakedownAudit`
```powershell
rg --no-heading -n "ShakedownAudit" src/ tests/
```
**Code retour** : `0`
**Sortie brute** :
```
src/features\gear\components\ShakedownAuditView.tsx:7:interface ShakedownAuditViewProps {
src/features\gear\components\ShakedownAuditView.tsx:11:export const ShakedownAuditView: React.FC<ShakedownAuditViewProps> = ({ report }) => {
src/features\gear\index.ts:6:export * from './components/ShakedownAuditView';
src/features\gear\components\GearManager.tsx:7:import { ShakedownAuditView } from './ShakedownAuditView';
src/features\gear\components\GearManager.tsx:117:        <ShakedownAuditView report={report} />
```

---

### Grep 7 : Symbole `WeightSummaryCard`
```powershell
rg --no-heading -n "WeightSummaryCard" src/ tests/
```
**Code retour** : `0`
**Sortie brute** :
```
src/features\gear\index.ts:4:export * from './components/WeightSummaryCard';
src/features\gear\components\WeightSummaryCard.tsx:6:interface WeightSummaryCardProps {
src/features\gear\components\WeightSummaryCard.tsx:10:export const WeightSummaryCard: React.FC<WeightSummaryCardProps> = ({ breakdown }) => {
src/features\gear\components\GearManager.tsx:5:import { WeightSummaryCard } from './WeightSummaryCard';
src/features\gear\components\GearManager.tsx:62:      <WeightSummaryCard breakdown={breakdown} />
```

---

### Grep 8 : Symbole `shakedownEngine`
```powershell
rg --no-heading -n "shakedownEngine" src/ tests/
```
**Code retour** : `0`
**Sortie brute** :
```
tests/gear-shakedown.spec.ts:9:} from '../src/features/gear/services/shakedownEngine';
src/features\gear\index.ts:2:export * from './services/shakedownEngine';
src/features\gear\stores\useGearStore.ts:3:import { calculateWeightBreakdown, generateShakedownReport } from '../services/shakedownEngine';
```

---

### Grep 9 : Symbole `GearChecklist`
```powershell
rg --no-heading -n "GearChecklist" src/ tests/
```
**Code retour** : `0`
**Sortie brute** :
```
src/features\gear\index.ts:5:export * from './components/GearChecklist';
src/features\gear\components\GearChecklist.tsx:6:interface GearChecklistProps {
src/features\gear\components\GearChecklist.tsx:29:export const GearChecklist: React.FC<GearChecklistProps> = ({
src/features\gear\components\GearManager.tsx:6:import { GearChecklist } from './GearChecklist';
src/features\gear\components\GearManager.tsx:106:        <GearChecklist
```

---

### Grep 10 : Symbole `ShakedownAuditView`
```powershell
rg --no-heading -n "ShakedownAuditView" src/ tests/
```
**Code retour** : `0`
**Sortie brute** :
```
src/features\gear\index.ts:6:export * from './components/ShakedownAuditView';
src/features\gear\components\ShakedownAuditView.tsx:7:interface ShakedownAuditViewProps {
src/features\gear\components\ShakedownAuditView.tsx:11:export const ShakedownAuditView: React.FC<ShakedownAuditViewProps> = ({ report }) => {
src/features\gear\components\GearManager.tsx:7:import { ShakedownAuditView } from './ShakedownAuditView';
src/features\gear\components\GearManager.tsx:117:        <ShakedownAuditView report={report} />
```

---

## 3. Statut particulier de `shakedownEngine.ts` : actif orphelin testé vs composant fantôme

### Pourquoi `shakedownEngine.ts` n'est PAS un simple fichier fantôme à supprimer
1. **Couverture de tests réelle** :
   Le fichier `tests/gear-shakedown.spec.ts` (201 lignes, 5 893 octets) contient **7 tests unitaires** qui s'exécutent avec succès (`vitest run tests/gear-shakedown.spec.ts` : 7 passed en 463ms).
   - `TEST-GEAR-01` : Calcul du Base Weight en excluant strictement les portés (`isWorn`), consommables (`isConsumable`) et non emballés (`status !== 'packed'`).
   - `TEST-GEAR-02` : Classification MUL (`ultralight`, `lightweight`, `traditional`).
   - `TEST-GEAR-03` : Détection des équipements de survie indispensables manquants (`REQUIRED_VITALS` : secours, couverture, frontale, filtre, sifflet).
   - `TEST-GEAR-04` : Détection des doublons redondants.
   - `TEST-GEAR-05` : Détection des articles lourds dépassant les seuils de référence (`HEAVY_THRESHOLDS`).
   - `TEST-GEAR-06` : Génération du rapport d'audit avec score global et potentiel de gain de poids.
   - `TEST-GEAR-07` : Mutations dynamiques du store Zustand (`toggleItemWorn`).

2. **Règle absolue de non-régression du compteur de tests** :
   Supprimer `src/features/gear` brutalement ferait perdre ces 7 tests, faisant baisser le compteur de 1049 tests à 1042, ce qui violerait directement la règle d'intégrité issue du Chantier Y.

3. **Découverte critique : relation avec `src/features/preparation/services/gearGapEngine.ts`** :
   La cartographie Z0 met en lumière l'existence de `src/features/preparation/services/gearGapEngine.ts` (8 269 o, 270 lignes).
   Ce fichier est une **évolution directe et enrichie** de `shakedownEngine.ts` :
   - Mêmes seuils `HEAVY_THRESHOLDS` (abris > 1.6kg, couchage > 1.2kg, popote > 450g...).
   - Même concept de checklist vitale, étendu avec `suggestedProduct` (produits de la boutique LKDV avec prix en euros et poids précis).
   - `src/features/preparation` possède ses propres tests : `tests/preparation/preparation-services.spec.ts` et `tests/preparation/preparation-store.spec.ts`.

4. **Verdict pour le plan Z1 / Z2** :
   - Les 4 composants UI de `features/gear` (`GearManager.tsx`, `GearChecklist.tsx`, `ShakedownAuditView.tsx`, `WeightSummaryCard.tsx`) sont orphelins (0 import dans tout `src/`).
   - Le moteur `shakedownEngine.ts` + `gear.types.ts` et ses 7 tests doivent faire l'objet d'une décision explicite en Z1 : soit migration/fusion dans la section équipement du hub voyage (`src/features/trips/engine/` ou `src/features/materiel/`), soit intégration avec le cockpit préparation sans perte d'aucun test.

---

## 4. Liste des routes rendant chaque composant (Grep entrants)

### Routes de `src/app/materiel/**`

| Route URL | Fichier Page/Layout | Composants importés & rendus |
| :--- | :--- | :--- |
| `/materiel` | `src/app/materiel/page.tsx` | `DepartCockpit`, `DepartCockpitSkeleton` (via `features/materiel/components/depart/`) |
| `/materiel/depart` | `src/app/materiel/depart/page.tsx` | `DepartCockpit`, `DepartCockpitSkeleton` |
| `/materiel/depart/[id]` | `src/app/materiel/depart/[id]/page.tsx` | `DepartCockpit`, `DepartCockpitSkeleton` |
| `/materiel/alertes` | `src/app/materiel/alertes/page.tsx` | 10 composants : `ReliabilityScore`, `TopAlertsAccordion`, `CategoryTabs`, `SeasonalBanner`, `AlertsTimeline`, `ToCompleteList`, `WeatherRadar`, `MaintenanceCalendar`, `OccasionMarketplace`, `ExportShareBar` |
| `/materiel/disponibilite` | `src/app/materiel/disponibilite/page.tsx` | 10 composants : `AvailabilityGauge`, `DispoKpis`, `GanttTimeline`, `LoanTabs`, `ConflictDetector`, `LoanHeatmap`, `DigitalLoanContract`, `AutoReminders`, `DispoScore`, `CollectiveActions` |
| `/materiel/forget` | `src/app/materiel/forget/page.tsx` | `ForgetWorkspace` (via `features/materiel/components/forget/`) |
| `/materiel/inventaire` | `src/app/materiel/inventaire/page.tsx` | 5 composants : `InventoryOverview`, `InventoryWorkspace`, `PurchasesInvest`, `AiInsightBanner`, `CrossSellStrip` |
| `/materiel/kits` | `src/app/materiel/kits/page.tsx` | `KitsCockpit` (via `features/materiel/components/kits/`) |
| `/materiel/preparation` | `src/app/materiel/preparation/page.tsx` | `PreparationCockpit` (via `features/preparation/components/PreparationCockpit.tsx`) |

### Greps entrants pour `src/features/kits`
- `src/app/layout.tsx` : `KitSheetProvider` englobe toute l'application.
- `src/app/api/stripe/webhook/route.ts` : imports `royalty.ts` pour répartition des commissions.
- `src/app/api/checkout/route.ts` : imports `kitRef.ts` pour traçabilité du panier.
- `src/app/api/kits/[id]/refer/route.ts` : imports `kitRef.ts`.
- `src/app/api/kits/[id]/field-report/route.ts` : imports `fieldProof.ts`.
- `src/app/api/kits/discovery/route.ts` : imports `trust.ts`.
- `src/app/api/materiel/fork/route.ts` & `src/app/api/materiel/kits/route.ts` : imports `lineage.ts`.
- `src/features/hiking/components/KitDebriefPanel.tsx` : imports `fieldProof.ts`.
- `src/features/hiking/components/KitCarrySelector.tsx` : imports `KitSheetContext.tsx`.
- `src/features/messaging/components/KitCard.tsx` : imports `KitSheetContext.tsx`.

### Greps entrants pour `src/components/kits`
- `src/app/communaute/page.tsx` : importe `LineageDiscovery`.
- `src/app/produit/[slug]/ProductDetailClient.tsx` : importe `ProductLineageCard`.

### Greps entrants pour `src/features/gear`
- `src/` : **0 import**.
- `tests/gear-shakedown.spec.ts` : unique consommateur de `shakedownEngine`, `useGearStore`, `gear.types`.

---

## 5. Confirmation de `inventory_item_id` dans `trip.types.ts` et contrat de données

Le pont d'intégration physique entre le Hub Voyages et l'inventaire matériel repose sur la propriété `inventory_item_id`.

### Preuve par numéro de ligne exact

- **Fichier** : `src/features/trips/types/trip.types.ts`
- **Ligne exacte** : **117**
```typescript
114:   is_packed: boolean;
115:   status: TripItemStatus;
116:   packed_by: string | null;
117:   inventory_item_id: string | null;
118:   affiliate_link_id: string | null;
```

### Autres preuves du contrat dans la codebase

1. **Validation Zod** :
   `src/features/trips/schemas/trip.schema.ts:184`
   ```typescript
   inventory_item_id: z.string().uuid().nullable().optional(),
   ```

2. **Requêtes Supabase / Kit** :
   `src/lib/queries-trip-kit.ts:128`
   ```typescript
   inventory_item_id: input.inventoryItemId || null,
   ```

3. **Server Actions de Kit de Voyage** :
   `src/app/voyages/kit-actions.ts:252`
   ```typescript
   // L'équipement personnel est seulement référencé via inventory_item_id dans trip_items.
   ```

4. **Composant UI Hub Voyage** :
   `src/features/trips/components/TripKitView.tsx:121` et `739`
   ```typescript
   inventory_item_id: item.id,
   // ...
   (i) => i.inventory_item_id === item.id || (i.item_name.toLowerCase() === item.name.toLowerCase() && i.source === 'inventory')
   ```

5. **Schéma de base de données PostgreSQL (Supabase Migration)** :
   `supabase/migrations/20260904050000_trips_core.sql:118`
   ```sql
   CREATE TABLE IF NOT EXISTS public.trip_items (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
     item_name TEXT NOT NULL,
     category TEXT,
     quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
     weight_grams NUMERIC(8,2) CHECK (weight_grams IS NULL OR weight_grams >= 0),
     is_packed BOOLEAN NOT NULL DEFAULT false,
     status public.trip_item_status NOT NULL DEFAULT 'needed',
     packed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
     inventory_item_id UUID,
     affiliate_link_id UUID,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```

**Conclusion formelle** : Le modèle de données est déjà conçu pour que `trip_items` ne duplique pas l'objet physique, mais référence l'article d'inventaire possédé par l'utilisateur via sa clé étrangère UUID `inventory_item_id`.

---

## 6. Comptage des violations Y-D80 sur les périmètres non couverts (anticipation Z5)

Le garde-fou `y-d80-guard.spec.ts` et le script `scripts/design/y-d80-count.mjs` ne surveillent actuellement que le périmètre Y (`src/features/trips`, `src/app/voyages`, `src/app/groupes`, `src/app/ai-configurator`), qui affiche un score parfait de **0 violation**.

Un audit en lecture seule a été exécuté sur les trois périmètres concernés par le Chantier Z :
1. `src/features/materiel`
2. `src/features/gear`
3. `src/app/materiel`

#### Résultats du scan brut

| Périmètre | Fichiers TS/TSX scannés | Violations totales | R1 (Tailwind color) | R2 (Hex non standard) | R6 (Touch target) | R7 (Input nu) | R8 (Network) | R10 (Aside) | R12 (Print) | Statut Z |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `src/features/materiel` | 109 | **775** | 29 | 717 | 2 | 15 | 7 | 3 | 2 | **Périmètre actif Z5** |
| `src/app/materiel` | 20 | **16** | 0 | 14 | 0 | 0 | 2 | 0 | 0 | **Périmètre actif Z5** |
| `src/features/gear` | 8 | *82* | *17* | *65* | 0 | 0 | 0 | 0 | 0 | *Code condamné (élagage Z2)* |
| **PÉRIMÈTRE ACTIF Z5** | **129** | **791** | **29** | **731** | **2** | **15** | **9** | **3** | **2** | **Cible réelle de remédiation** |
| *Total brut scanné* | *137* | *873* | *46* | *796* | *2* | *15* | *9* | *3* | *2* | *Inclut code voué à suppression* |

### Enseignements pour le chantier Z5
- **Le vrai chiffre à retenir pour le chantier Z5 est 791 violations actives** (775 sur `src/features/materiel` + 16 sur `src/app/materiel`).
- Les 82 violations de `src/features/gear` sont situées dans des composants orphelins voués à disparaître dès Z2 : les compter dans l'effort Z5 gonflerait artificiellement la charge de travail de mise en conformité.
- L'immense majorité des violations réelles (731 / 791, soit 92,4 %) provient de la **Règle 2 (couleurs hexadécimales en dur)**, héritage d'un style antérieur à la charte tokenisée Stone/Amber/Emerald.
- Pour `src/features/materiel` et `src/app/materiel`, un travail de tokenisation méthodique sera nécessaire au moment de la phase Z5 pour faire passer la porte de qualité Y-D80.

---

## 7. Section « Incertitudes et points d'attention »

1. **Existence non anticipée de `src/features/preparation`** :
   Ce module de 16 fichiers et 117 ko propose un cockpit de préparation de trek complet (`/materiel/preparation`), une distribution des charges (humains et chiens de bât), et son propre moteur d'analyse de sac (`gearGapEngine.ts`). Il existe un chevauchement partiel entre `/materiel/depart/[id]`, `/materiel/preparation` et la section équipement du hub `/voyages/[slug]`.
2. **Statut de protection de branche GitHub** :
   `main` n'a toujours pas de règle de protection de branche appliquée au niveau du serveur GitHub. La discipline repose sur les vérifications locales strictes avant chaque merge.
3. **Composants aux noms similaires mais rôles distincts** :
   - `CountdownLive.tsx` (`features/materiel/components/cards/`) est dédié au décompte matériel avant départ, alors que `CountdownWidget.tsx` (`features/trips/components/widgets/`) gère le décompte global du voyage en sidebar droite.
   - `WeightGauge.tsx` (`src/components/WeightGauge.tsx`) est un composant partagé vivant (utilisé sur 5 écrans), tandis que `WeightSummaryCard.tsx` (`src/features/gear/components/WeightSummaryCard.tsx`) est un composant orphelin non utilisé.
4. **Validation des clés étrangères en BDD** :
   Bien que `inventory_item_id` soit présent dans la table `trip_items` sous forme de colonne UUID, il faudra vérifier en Z1 si une contrainte formelle `REFERENCES inventory_items(id)` existe ou si elle est gérée applicativement.

---

*Fin du rapport d'inventaire Z0 — Document contractuel pour l'élaboration du plan Z1.*
