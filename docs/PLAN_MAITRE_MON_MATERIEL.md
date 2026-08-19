📋 PLAN MAÎTRE — CORRECTION TOTALE COCKPIT « MON MATÉRIEL »
Branche : feat/mon-materiel-smart-cockpit-final  
Base : feat/mon-materiel-six-cards-final (PR #23 merged)  
Objectif : Conformité 100% au prompt maître — cockpit 6 cards premium, état produit unifié, animation cinématique, zéro régression.
🏗️ ARCHITECTURE DES DÉPENDANCES
PHASE 0 : FONDATIONS (doit être fait en premier)
    ↓
PHASE 1 : MOTEUR DONNÉES UNIFIÉ (branche partout)
    ↓
PHASE 2 : ANIMATION CINÉMATIQUE (dépend de PHASE 0)
    ↓
PHASE 3 : DESIGN SYSTEM & TYPO (dépend de PHASE 0)
    ↓
PHASE 4 : WIDGETS ENRICHIS (dépendent PHASE 1+2+3)
    ↓
PHASE 5 : WORKFLOW ACHAT→RÉCEPTION (dépend PHASE 1)
    ↓
PHASE 6 : NETTOYAGE & VALIDATION (final)
📦 PHASE 0 — FONDATIONS (1-2h)
0.1 Nettoyer page.tsx — supprimer code mort résiduel
Fichiers : src/app/mon-materiel/page.tsx
- Vérifier qu'aucun buildHikeContext local ne reste
- Imports propres : uniquement hooks, widgets, utils
- Supprimer formatWeight/daysUntil locaux (utilise @/lib/utils/format)
0.2 Purger composants morts identifiés
Fichiers : src/components/inventaire/
- Supprimer : DeparturePlannerView.tsx, KitsManagerView.tsx, MobileInventaireView.tsx, KitsAssemblersCard.tsx, InventaireHero.tsx, CategorySection.tsx, ConsumablesSidebar.tsx
- Vérifier qu'aucun import ne les référence (grep -r)
0.3 Valider useWidgetOrder — robustesse cross-tab
Fichiers : src/hooks/useWidgetOrder.ts
- Ajouter validation au chargement : array length=6, tous IDs uniques, tous dans DEFAULT_ORDER
- Ajouter version dans localStorage pour migration future
- Test : ouvrir 2 onglets, réordonner dans l'un → sync dans l'autre
Critères validation :
- localStorage.getItem('lkdv_cockpit_order_v2') → JSON valide, 6 items
- Cross-tab sync fonctionne
- Reset défaut si corrompu
📦 PHASE 1 — MOTEUR DONNÉES UNIFIÉ (3-4h)
1.1 Brancher ProductStateEngine dans TOUS les widgets
Fichiers : 6 widgets + page.tsx
Modifications par widget :
Widget	Import à ajouter	Utilisation
ProchainDepartWidget	calculateDepartureReadiness, calculateUnifiedProductState	Remplacer hikeReadiness local par calculateDepartureReadiness(kit, hike, equipment, plan)
MesKitsWidget	calculateUnifiedProductState	Dans fullscreen : pour chaque item du kit, calculer état unifié (possédé/prêté/abîmé/etc.)
OublierWidget	calculateUnifiedProductState, getRecommendedAction	Générer checklist depuis états unifiés + actions recommandées
InventaireWidget	calculateUnifiedProductState	Remplacer filtres gearPossessionFilter par dimension ownership + availability
DisponibiliteWidget	calculateUnifiedProductState	Regrouper par catégorie PUIS par disponibilité (pas l'inverse)
AlertesWidget	calculateUnifiedProductState	Alertes = produits où isCritical === true ou isActionable === true
Dans page.tsx :
// Calcul unique partagé pour tous les widgets
const allProductStates = useMemo(() => 
  equipment.map(e => ProductStateEngine.calculateUnifiedProductState(
    e, findCatalogMatch(e, catalogProducts), kits, activeHike, departurePlan, cartItems, equipment
  )), [equipment, catalogProducts, kits, activeHike, departurePlan, cartItems]
);

// Passer aux widgets via props
<ProchainDepartWidget productStates={allProductStates} ... />
<MesKitsWidget productStates={allProductStates} ... />
// etc.
1.2 Étendre useEquipment pour workflow achat→réception
Fichiers : src/hooks/useEquipment.ts, src/lib/cart.ts
Ajouts :
// Dans useEquipment return
addToInventoryAndCart: async (product: UnifiedProduct) => {
  // 1. Ajouter à l'inventaire avec ownership='en_attente_achat'
  // 2. Ajouter au panier (cart.ts)
  // 3. Retourner acquisitionIntentId
},

confirmReceipt: async (acquisitionIntentId: string) => {
  // 1. Passer ownership: 'en_attente_achat' → 'possede'
  // 2. availability: 'indisponible' → 'disponible'
  // 3. Retirer du panier
  // 4. Recalculer tous les états dérivés
},

getProductState: (productId: string) => UnifiedProductState // selector pour widgets
1.3 Étendre useUserKits pour compatibilité départ
Fichiers : src/hooks/useUserKits.ts
Ajouts :
getKitProductsByCategory: (kitId: string) => Record<string, KitItemWithState[]>
kitCompatibilityWithDeparture: (kitId: string, hike: PlannedHike) => { compatible: boolean; missing: string[]; score: number }
kitEstimatedWeightWithConsumables: (kitId: string, departurePlan: DeparturePreparationPlan) => number
📦 PHASE 2 — ANIMATION CINÉMATIQUE (2-3h)
2.1 useWidgetExpansion — Shared Layout Réel
Fichiers : src/hooks/useWidgetExpansion.ts, src/components/cockpit/FullscreenOverlay.tsx
Spécifications exactes :
- layoutId unique par widget : card-container-{widgetId} + card-header-{widgetId}
- Durée ouverture : 500ms (spring stiffness 280, damping 28)
- Durée fermeture : 400ms (spring stiffness 300, damping 30)
- Stagger contenu : 80ms par groupe (header → titre → valeur → listes → actions)
- prefers-reduced-motion : durée 0, pas de stagger, focus direct
- Focus trap dans fullscreen (Tab/Shift+Tab boucle)
- Escape → ferme + restore focus sur bouton Agrandir d'origine
- Scroll lock body pendant fullscreen
- Drag & drop désactivé si isAnimating OU expandedCard !== null
FullscreenOverlay : wrapper motion.div avec layoutId reçu en prop, pas de AnimatePresence interne (géré par parent).
2.2 Intégration dans page.tsx
- expandedCard state unique
- expandCard(id) / collapseCard() uniques
- Passer layoutId et headerLayoutId à chaque widget + FullscreenOverlay
- isDragDisabled={expandedCard !== null || isAnimating} sur Draggable
📦 PHASE 3 — DESIGN SYSTEM & TYPO (2h)
3.1 Appliquer tokens.css partout
Fichiers : 6 widgets, FullscreenOverlay.tsx, page.tsx
Remplacements systématiques :
Avant	Après (classe token)
text-[9px] text-[10px] text-[11px]	text-label (12px) ou text-body-sm (13px)
text-xl text-2xl pour valeurs	text-display (24px) / text-display-sm (18px)
text-3xl text-4xl text-5xl pour héros	text-hero (56px) / text-hero-sm (40px)
bg-white/5 bg-white/10	.glass-card + variants
border-white/10	.glass-card border via border-image
text-white/50 text-white/60 text-white/70	.text-muted / .text-subtle / text-white/80
text-[#E76F51] etc.	.text-critical .text-warning .text-success .text-info
animate-pulse sur glow	.glass-card--critical etc. (box-shadow)
3.2 Fond cockpit — uni, sans photo
Fichiers : src/styles/tokens.css + page.tsx
/* Dans tokens.css */
.cockpit-root {
  background: var(--color-fg-900); /* #0B1F17 uni */
  /* Supprimer tout background-image, gradient photo montagne */
}
3.3 Glow FONCTIONNEL SEULEMENT
- .glass-card par défaut : pas de glow
- .glass-card--critical : box-shadow: var(--shadow-lg), var(--shadow-glow-critical)
- .glass-card--warning : glow amber
- .glass-card--success : glow sage
- .glass-card--info : glow bleu
- Appliquer conditionnellement : className={alerts.length > 0 ? 'glass-card glass-card--critical' : 'glass-card'}
3.4 Typo minimums
- Aucun texte < 12px (text-xs minimum)
- Labels : text-label (12px, uppercase, tracking-wide, semibold)
- Corps : text-body-sm (13px) / text-body (14px)
- Valeurs dominantes : text-hero (56px) / text-hero-sm (40px) / text-display (24px)
- Mono pour métriques : .text-metric (JetBrains Mono, tabular-nums)
📦 PHASE 4 — WIDGETS ENRICHIS (4-5h)
4.1 ProchainDepartWidget — Cerveau complet
Fichiers : src/components/cockpit/widgets/ProchainDepartWidget.tsx
Compact (card fermée) :
- J-X dominant (text-hero-sm)
- Nom rando + kit recommandé + readiness %
- Une seule action contextuelle : "Résoudre maintenant" / "Prêt à partir" / "Planifier"
- Glow si critique (départ ≤3j + manquant)
Fullscreen — 7 sections ordonnées :
1. Le départ : date, lieu, difficulté, durée, météo (temp, pluie, vent), UV
2. Kit recommandé : pourquoi lui, poids, compatibilité, bouton "Changer"
3. Indispensables : équipements requis (sécurité) — badges état unifié
4. À ne pas oublier : consommables (gaz, eau, repas), météo (pluie, froid, UV), autonomie
5. Disponibilité : prêtés, réparations, entretien, alternatives (depuis états unifiés)
6. Poids estimé : kit + consommables + marge vs objectif
7. Logistique & Validation : docs (ID, assurance, réservation, espèces, GPS, carte papier), bouton "Générer fiche départ"
Priorisation visuelle :
- 🔴 Rouge : sécurité (eau, abri, nav, lumière, secours)
- 🟠 Ambre : dispo (prêté, cassé, entretien)
- 🟡 Jaune : contextuel (gaz, filtre, vêtement météo)
- 🟢 Vert : prêt
- ⚪ Gris : confort (optionnel)
4.2 OublierWidget — Checklist proactive priorisée
Fichiers : src/components/cockpit/widgets/OublierWidget.tsx
Sources fusionnées :
- États unifiés isActionable + suggestedAction
- departurePlan.consumables
- alertes (maintenance, péremption, prêt)
- Règles Obsidian (météo, saison, oublis fréquents)
- Kit actif + départ actif
Fullscreen — 6 catégories avec badges priorité :
Catégorie	Icône	Couleur	Priorité
Sécurité	🔴	Rouge	1
Consommables	🟡	Ambre	2
Météo/Saison	🔵	Bleu	3
Oublis fréquents	🟣	Violet	4
Documents	🟢	Vert	5
Confort	⚪	Gris	6
Chaque item : label + raison courte + action contextuelle (bouton unique : +Panier / +Inventaire / Marquer OK / Voir alternative)
4.3 InventaireWidget — Catalogue 9 catégories + workflow achat
Fichiers : src/components/cockpit/widgets/InventaireWidget.tsx
Compact : stats + top 4 catégories (count)
Fullscreen — Onglets :
- Tous | Possédés | À compléter | Indisponibles | Dans le panier | Commandés | À réceptionner
- Recherche temps réel (debounce 200ms)
- Grille par catégorie (9) → cards produit avec badge état unifié
États visuels par card :
État	Badge	Couleur	Action principale
Possédé · disponible	Possédé	Vert	Voir / Ajouter au kit
Possédé · hors kit	Hors kit	Bleu	Ajouter au kit
Prêté	Prêté jusqu'au…	Ambre	Voir le prêt
Abîmé / À réparer	À vérifier	Rouge	Déclarer action
En réparation	En réparation	Bleu	Suivre
Entretien requis	Entretien	Ambre	Planifier
Perdu	Indisponible	Gris	Retrouver / Remplacer
Non possédé	Non possédé	Ambre	+ Inventaire
En attente d'achat	En attente	Bleu	Voir panier
Commandé	Commandé	Bleu	Suivre réception
À réceptionner	À réceptionner	Vert	Confirmer réception
Alternative dispo	Alternative	Vert	Utiliser l'alternative
Workflow achat intégré :
1. Clic + Inventaire sur non-possédé → addToInventoryAndCart() → ownership=en_attente_achat + panier
2. Clic + Au panier → panier seulement
3. Webhook Stripe (existant) → confirmReceipt() → ownership=possede + availability=disponible
4.4 DisponibiliteWidget — Par catégorie + actions
Fichiers : src/components/cockpit/widgets/DisponibiliteWidget.tsx
Compact : 58 prêts · 3 indisponibles (1 prêté · 1 réparation · 1 à charger)
Fullscreen — Accordéons par CATÉGORIE (9) :
Chaque catégorie → liste items avec état dispo + action contextuelle
Groupe	Action bouton
Prêtés	Marquer rendu → loan_status: disponible
En réparation	Réparation finie → condition: bon + availability: disponible
Entretien	Valider entretien → last_maintenance: now + next_maintenance: +1an
À charger	Marquer chargé → preparation: pret
À remplacer	Voir alternatives → ouvre modal alternative
Perdus	Retrouver / Remplacer → availability: disponible OU addToInventoryAndCart
4.5 AlertesWidget — Centre trié par gravité
Fichiers : src/components/cockpit/widgets/AlertesWidget.tsx
Compact : 2 critiques · 1 attention + top alerte
Fullscreen — Filtres + Tri :
- Onglets : Toutes | Critiques | Maintenance | Péremption | Prêt | Remplacement | Poids | Manquant
- Tri : Gravité (défaut) | Date | Catégorie
- Chaque alerte : cause + élément + action corrective unique
- Marquer traitée si cohérent (ex: maintenance validée, prêt récupéré)
4.6 MesKitsWidget — Répertoire + détail par catégorie
Fichiers : src/components/cockpit/widgets/MesKitsWidget.tsx
Compact : Kit recommandé en premier + 24 items · 7.4kg · 2 manquants
Fullscreen :
- Grille kits (tous) → clic = sélection
- Kit sélectionné → détail par catégorie (9) avec états unifiés par item
- Badges par item : ✓ Prêt | ⚠ Prêté | 🔧 Réparation | 🔄 À remplacer | ○ Manquant | 🔁 Alternative
- Actions : Assigner au départ | Dupliquer | Archiver | Comparer
📦 PHASE 5 — WORKFLOW ACHAT→RÉCEPTION (2h)
5.1 cart.ts — Types acquisition
Fichiers : src/lib/cart.ts, src/hooks/useEquipment.ts
// CartItem étendu
interface CartItem {
  // ... existant
  acquisitionIntentId?: string; // lien vers inventaire
  source: 'manual' | 'from_inventory_widget' | 'from_departure_prep';
}
5.2 Webhook Stripe → confirmReceipt
Fichiers : src/app/api/stripe/webhook/route.ts (existant)
- Détecter acquisitionIntentId dans metadata
- Appeler useEquipment.confirmReceipt(acquisitionIntentId) côté client via event ou polling
- Toast "✓ Produit reçu et ajouté à l'inventaire"
5.2 États Ownership complets dans UI
État	Label	Couleur	Transition auto
non_possede	—	—	—
en_attente_achat	En attente d'achat	Bleu	Clic +Inventaire
dans_panier	Dans le panier	Bleu	Voir panier
commande	Commandé	Bleu	Suivre
a_receptionner	À réceptionner	Vert	Confirmer réception
possede	Possédé	Vert	—
archive	Archivé	Gris	—
📦 PHASE 6 — NETTOYAGE & VALIDATION (1-2h)
6.1 Purge composants morts
Fichiers : src/components/inventaire/
- rm DeparturePlannerView.tsx KitsManagerView.tsx MobileInventaireView.tsx KitsAssemblersCard.tsx InventaireHero.tsx CategorySection.tsx ConsumablesSidebar.tsx
- grep -r "DeparturePlannerView\|KitsManagerView\|MobileInventaireView" src/ → 0 résultat
6.2 Supprimer boutons génériques
Fichiers : 6 widgets
- Remplacer Voir le détail → action contextuelle
- Remplacer Gérer les indisponibilités → Résoudre maintenant (si critique) / Voir (si info)
- Remplacer Ouvrir le Studio Kits → Créer un kit / Assigner au départ
- Remplacer Tout voir / Voir tout / Tout résoudre → supprimés
6.3 Build + Lint + TypeCheck
npm run build      # 0 erreur TS, 0 erreur ESLint
npm run lint       # 0 warning
npm run typecheck  # si script existe
6.4 Tests manuels complets (checklist)
Test	Critère
6 cards exactement	Grille 3+3 asymétrique, 4 larges + 2 compactes
Zéro scroll global	body overflow hidden, seul scroll interne
Drag & drop	Réordonne, persiste localStorage, sync cross-tab
Expansion 6 widgets	Ouvre/ferme, 500ms/400ms, stagger, Escape, focus restore
Données réelles	0 mock, Supabase connecté, états unifiés
Achat→Inventaire	+Inventaire → panier → réception → possédé auto
Prochain départ	Météo, docs, alternatives, priorisation visuelle
À ne pas oublier	6 catégories, priorités, actions contextuelles
Inventaire	9 cat, 11 états, workflow achat
Disponibilité	Par catégorie, 7 groupes, actions
Alertes	Tri gravité, filtres, marquer traitée
Kits	Répertoire, détail par cat, états unifiés
Contraste WCAG AA	Tous textes sur tous fonds (axe DevTools)
Typo ≥12px	Aucun text-[9px] [10px] [11px]
Glow fonctionnel	Uniquement si critique/warning/success/info
Mobile	Cibles 44px, pas compression desktop
prefers-reduced-motion	Animations désactivées, focus direct
Aucune régression	Autres routes (/, /explorer, /boutique, /preparer-randonnee) OK
6.4 Mise à jour PROGRESS-mon-materiel.md final
- Toutes tâches cochées
- Décisions documentées
- Bugs/fixes listés
6.5 Commit final + Push + PR
git add -A
git commit -m "feat(mon-materiel): cockpit smart final complet — 6 widgets, état unifié, animation cinématique, workflow achat, design tokens"
git push origin feat/mon-materiel-smart-cockpit-final
# Créer PR via GitHub UI vers main
⚠️ RISQUES & MITIGATION
Risque	Probabilité	Impact	Mitigation
ProductStateEngine trop lent (3000+ produits)	Moyenne	Perf	Memoize calculateUnifiedProductState, batch par widget, virtualiser listes
Animation Framer Motion bug sur layoutId	Faible	UX	Test isolation, fallback prefers-reduced-motion
Drag & drop @hello-pangea/dnd + Framer Motion conflit	Moyenne	UX	`isDragDisabled={expandedCard
Supabase RLS sur nouveaux champs	Faible	Data	Vérifier policies gear_items (owner = auth.uid())
Webhook Stripe race condition	Faible	Data	Idempotency key sur confirmReceipt
Mobile layout cassé	Moyenne	UX	Test Chrome DevTools device toolbar + vrai mobile
📁 FICHIERS CIBLES RÉSUMÉ
Phase	Fichiers à créer/modifier
0	page.tsx (nettoyage), useWidgetOrder.ts (robustesse), inventaire/ (purge)
1	useEquipment.ts, useUserKits.ts, lib/cart.ts, 6 widgets (import ProductStateEngine), page.tsx (calcul partagé)
2	useWidgetExpansion.ts, FullscreenOverlay.tsx, page.tsx (intégration)
3	tokens.css (complet), 6 widgets (classes tokens), page.tsx (fond uni)
4	6 widgets (refactor complet logique + fullscreen)
5	cart.ts, useEquipment.ts (workflow), stripe/webhook (exist)
6	Purge, nettoyage boutons, build, tests, PR
✅ CRITÈRES DE FIN — "DONE" = TOUT VERT
- npm run build → 0 erreur
- npm run lint → 0 warning
- 6 widgets fonctionnels sans aucun mock
- Animation 500ms/400ms + stagger 80ms mesurée (Performance tab)
- Contraste WCAG AA validé (axe DevTools → 0 violation)
- Typo ≥12px partout (grep text-\[9\], text-\[10\], text-\[11\] → 0)
- Glow uniquement .glass-card--critical|warning|success|info
- Drag & drop persiste + cross-tab sync
- Expansion focus trap + Escape + focus restore + scroll lock
- Workflow achat→réception→possédé auto testé
- Mobile cibles 44px + pas compression desktop
- prefers-reduced-motion animations off + focus direct
- Aucune régression sur /, /explorer, /boutique, /preparer-randonnee
- Composants morts purgés
- Boutons génériques supprimés
- PR créée vers main avec description complète
🎯 ORDRE D'EXÉCUTION RECOMMANDÉ (SÉQUENTIEL)
1. PHASE 0 (fondations) → commit
2. PHASE 1 (moteur données) → commit
3. PHASE 2 (animation) → commit
4. PHASE 3 (design tokens) → commit
5. PHASE 4.1 ProchainDépart → commit
6. PHASE 4.2 Oublier → commit
7. PHASE 4.3 Inventaire → commit
8. PHASE 4.4 Disponibilité → commit
9. PHASE 4.5 Alertes → commit
10. PHASE 4.6 MesKits → commit
11. PHASE 5 (workflow achat) → commit
12. PHASE 6 (nettoyage + validation + build) → commit final
13. Push + PR
🚀 PRÊT À EXÉCUTER ?
Je peux attaquer la PHASE 0 maintenant (nettoyage page.tsx, robustesse useWidgetOrder, purge composants morts). 
Confirme "GO PHASE 0" et j'exécute en autonomie totale — chaque phase commitée, PROGRESS mis à jour, validation avant suivant.
▣  Build · Nemotron 3 Ultra 550B A55B · 2m 42s
avant de commencer; réfléchit aussi au pure design des card; le liquid glass n'est pas assez pro et beau et le fond remplace le par lui et ajoute un voile blur par dessus léger subtile mes magnifique; reflechit a tout les détail de ce genre ne laisse rien passée voici le background : C:\Users\Tony\Downloads\artplayer.org_upscaled_1787066844926.mp4
Incorrect API key provided: none. You can find your API key at https://platform.openai.com/account/api-keys.
avant de commencer; réfléchit aussi au pure design des card; le liquid glass n'est pas assez pro et beau et le fond remplace le par lui et ajoute un voile blur par dessus léger subtile mes magnifique; reflechit a tout les détail de ce genre ne laisse rien passée voici le background : C:\Users\Tony\Downloads\artplayer.org_upscaled_1787066844926.mp4
+ Thought: 5.5s
Je ne peux pas lire le fichier vidéo local. Cependant, en me basant sur les références Polestar/automobile premium du prompt maître et l'exigence d'un fond vidéo + voile blur subtil, voici ma spécification design complète pour validation avant implémentation.
🎨 SPÉCIFICATION DESIGN — COCKPIT PREMIUM
1. FOND — VIDÉO AMBIANTE + VOILE BLUR
Propriété	Valeur
Source	<video autoplay loop muted playsinline> — ton fichier artplayer.org_upscaled_1787066844926.mp4
Couverture	object-fit: cover; width: 100%; height: 100dvh; position: fixed; inset: 0; z-index: -2;
Voile de base	background: linear-gradient(180deg, rgba(11,31,23,0.85) 0%, rgba(11,31,23,0.92) 100%); — foncé pour lisibilité
Blur subtil	backdrop-filter: blur(1.5px) saturate(1.1); sur un overlay ::before du .cockpit-root
Vignette	radial-gradient(ellipse at center, transparent 40%, rgba(11,31,23,0.35) 100%) — focus centre
Pas de parallaxe	Statique (performance + reduced-motion)
Fallback	Si vidéo fail → couleur unie #0B1F17 + grain SVG subtil
Raison : La vidéo donne vie/immersion (montagne, météo, mouvement lent), le voile assure contraste WCAG AA sur toutes les cards, le blur 1.5px fond les artefacts de compression sans flouter le contenu.
2. CARDS — LIQUID GLASS « AUTOMOBILE PREMIUM »
2.1 Structure visuelle (3 couches)
┌─────────────────────────────────────────────────────┐
│  LAYER 1 : CONTAINER (layoutId)                     │
│  - border-radius: 24px (--radius-3xl)               │
│  - overflow: hidden                                 │
│  - transform: translateZ(0) (GPU)                   │
├─────────────────────────────────────────────────────┤
│  LAYER 2 : GLASS SURFACE (::before)                 │
│  - background: rgba(255,255,255,0.035)              │
│  - backdrop-filter: blur(28px) saturate(1.15)       │
│  - border: 1px solid transparent                    │
│  - border-image: linear-gradient(135deg,            │
│      rgba(255,255,255,0.28) 0%,                     │
│      rgba(255,255,255,0.06) 35%,                    │
│      transparent 65%,                               │
│      rgba(255,255,255,0.02) 100%) 1                 │
│  - box-shadow:                                       │
│      0 4px 24px rgba(0,0,0,0.28),                   │
│      0 0 0 1px rgba(255,255,255,0.03) inset,       │
│      0 1px 0 rgba(255,255,255,0.08) inset          │
│  - transition: all 400ms cubic-bezier(0.16,1,0.3,1) │
├─────────────────────────────────────────────────────┤
│  LAYER 3 : SPECULAR HIGHLIGHT (::after)             │
│  - content: ""                                      │
│  - position: absolute; top: 0; left: 0; right: 0    │
│  - height: 1px                                      │
│  - background: linear-gradient(90deg,               │
│      transparent 0%,                                │
│      rgba(255,255,255,0.35) 20%,                    │
│      rgba(255,255,255,0.15) 80%,                    │
│      transparent 100%)                              │
│  - opacity: 0.6                                     │
└─────────────────────────────────────────────────────┘
2.2 États interactifs
État	Modifications
Default	Comme ci-dessus
Hover	background: rgba(255,255,255,0.055) ; border-image opacity +15% ; box-shadow + 0 8px 32px rgba(0,0,0,0.35) ; transform: translateY(-1px)
Focus-visible	border-image: linear-gradient(135deg, #17402C, #2D6B4A, #17402C) 1 ; box-shadow add 0 0 0 2px #17402C
Dragging	opacity: 0.85 ; transform: scale(1.01) rotate(0.5deg) ; z-index: 100 ; box-shadow: 0 20px 60px rgba(0,0,0,0.5)
Expanding	transition: transform 500ms cubic-bezier(0.22,1,0.36,1), border-radius 500ms, box-shadow 500ms ; border-radius → 32px (fullscreen)
Glow CRITICAL	box-shadow add 0 0 32px rgba(231,111,81,0.35) ; border-image tint #E76F51
Glow WARNING	box-shadow add 0 0 24px rgba(233,196,106,0.28) ; border-image tint #E9C46A
Glow SUCCESS	box-shadow add 0 0 20px rgba(163,196,163,0.22) ; border-image tint #A3C4A3
Glow INFO	box-shadow add 0 0 20px rgba(107,163,214,0.22) ; border-image tint #6BA3D6
2.3 Micro-détails « luxe »
Détail	Implémentation
Grain subtil	background-image: url("data:image/svg+xml,<svg>...<filter><feTurbulence baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter></svg>") sur .glass-card::before — opacity: 0.02
Inner shadow top	box-shadow: inset 0 1px 0 rgba(255,255,255,0.08) — donne l'épaisseur du verre
Corner catch-lights	4 pseudo-elements ::before/::after sur coins (4px radius) avec gradient radial blanc 15% → transparent — simule la réfraction du verre aux angles
Depth layering	Cards compactes z-index: 10 ; fullscreen z-index: 700 ; backdrop z-index: 600 ; header z-index: 300
Reduced-motion	Toutes transitions duration: 0.01ms ; transform: none ; pas de stagger
3. TYPOGRAPHIE — HIÉRARCHIE AUTOMOBILE
Rôle	Token	Taille	Poids	Tracking
Hero value (J-X, poids, %)	--text-hero	56px / 3.5rem	900 (Black)	-0.02em
Hero value SM (kit weight)	--text-hero-sm	40px / 2.5rem	800	-0.01em
Section title	--text-display	24px / 1.5rem	700	-0.01em
Body	--text-body	14px / 0.875rem	400	0
Body SM	--text-body-sm	13px / 0.8125rem	400	0
Label/Meta	--text-label	12px / 0.75rem	600	+0.05em
Metric/Number	--text-metric (JetBrains Mono)	selon contexte	600	0
Caption	11px	400	0	#FBFAF6 / 0.4
Règle : Aucun texte < 12px. text-[9px] text-[10px] text-[11px] interdits.
4. ESPACEMENT & GRILLE — PRÉCISION
Élément	Valeur
Gap grille	24px (--space-6)
Padding card compact	20px (--space-5)
Padding card large	24px (--space-6)
Padding fullscreen	32px (--space-8) desktop / 24px mobile
Border-radius card	24px (--radius-3xl)
Border-radius fullscreen	32px (--radius-4xl — nouveau token)
Header height	56px fixe (aligné sur Header global)
Safe area bottom	env(safe-area-inset-bottom) + 16px
5. ANIMATION EXPANSION — CINÉMATIQUE
Phase	Durée	Courbe	Détails
Backdrop fade-in	200ms	ease-out	opacity 0→1, backdrop-blur 0→1.5px
Container expand	500ms	cubic-bezier(0.22,1,0.36,1)	transform: scale(0.96)→1, translateY(8px)→0, border-radius 24→32px, width/height vers viewport
Header slide	400ms	ease-out	translateY(-4px)→0, opacity 0→1
Content stagger	80ms/group	ease-out	Groupes : [Titre+Value] → [Métriques] → [Liste/Actions] → [CTA]
Close	400ms	cubic-bezier(0.55,0,1,0.45)	Inverse exact, focus restore sur bouton Agrandir
Reduced-motion : Tout instantané, pas de stagger, focus direct.
6. COULEURS SÉMANTIQUES — GLOW FONCTIONNEL ONLY
Sémantique	Couleur	Usage
Critical	#E76F51	Départ ≤3j + bloquant, maintenance dépassée, item manquant sécurité
Warning	#E9C46A	Consommables, météo, entretien proche, prêté
Success	#A3C4A3	Prêt, validé, réception confirmée, kit complet
Info	#6BA3D6	Départ actif, documents, navigation
Neutre	#FBFAF6 / 0.55	Texte secondaire, labels, bordures par défaut
Pas de glow décoratif. Si alerts.length === 0 → card neutre (pas de vert).
7. INTERACTIONS TACTILES / MOBILE
Interaction	Spécification
Cible tactile	Min 48×48px (boutons), 44×44px (autres)
Drag handle	32×32px zone, cursor: grab → grabbing
Expand btn	36×36px, aria-label, focus visible
Scroll interne	scrollbar-width: thin, thumb #2D6B4A, track transparent
Swipe close	Bas→haut sur fullscreen = close (mobile uniquement)
Haptique	triggerHaptic('selection') sur drag start/end, expand, checkbox, boutons primaires---

## 🛠️ SKILLS & ICON AGENTS PAR PHASE

| Phase | Skills | Icon Agents (Pods) | Review Gate |
|-------|--------|-------------------|-------------|
| **0. FONDATIONS** | lkdv-development, code-quality, github-workflow | Programming: Torvalds, Carmack, Liskov, Lamport | — |
| **1. MOTEUR DONNÉES** | lkdv-development, supabase-postgis, nextjs-performance | Programming: Hickey, Kay, Beck, Knuth | Data & AI: Ng, Hinton, LeCun | — |
| **2. ANIMATION CINÉMATIQUE** | interaction-design, ux-mobile, nextjs-performance | Design: Ive, Kare, Norman, Rams | Programming: Carmack, Hickey | — |
| **3. DESIGN SYSTEM & TYPO** | interaction-design, ux-mobile, lkdv-development | Design Pod complet (8): Rams, Norman, Tufte, Ive, Kare, Nielsen, Holmes, Downe | 🎨 /icon-design-review |
| **4. WIDGETS ENRICHIS** | lkdv-development, ux-mobile, interaction-design, supabase-postgis | Product & Policy: Cagan, Zhuo, Horowitz | Design: Norman, Holmes, Downe | Data & AI: Ng, Li, Kozyrkov | — |
| **5. WORKFLOW ACHAT→RÉCEPTION** | lkdv-development, supabase-postgis, security-audit | Programming: Torvalds, Beck, Liskov, Lamport | Security: Schneier, Moussouris, Marlinspike | 💻 /icon-programming-review |
| **6. NETTOYAGE & VALIDATION** | testing-qa, code-quality, ux-mobile, security-audit, nextjs-performance | Platform & Ops: Vogels, Fowler, Gregg, Hightower, Frazelle | TOUS 64 experts | 🏁 /icon-review final |

## 🤖 ICON AGENT REVIEW GATES (Obligatoires)
- 🎨 Design Review → Après PHASE 3 → /icon-design-review → Design Pod (8)
- 💻 Programming Review → Après PHASE 5 → /icon-programming-review → Programming Pod (8)
- 🏁 Final Review → Avant merge → /icon-review → Tous les 64 experts (8 pods x 8)
