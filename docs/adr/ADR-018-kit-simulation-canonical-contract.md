# ADR-018 — Contrat canonique de simulation de kit (masse, unités, inconnues, honnêteté)

**Date :** 2026-10-18
**Statut :** Accepté — décisions dérivées du dossier technique maître LKDV v1.0
(§§7, 10, 11, 14), déjà exécutées par le socle `src/features/kit-simulation/`
et vérifiées par les preuves EV-0002 à EV-0005.
**Décideurs :** Chantier kit-simulation (pipeline Ralph), sur source de vérité
`LKDV_Dossier_Technique_Maitre.md`, commit audité `61963cc9`.

---

## 1. Contexte

Cinq implémentations du poids de kit coexistaient (noyau naissant,
`shakedownEngine`, `departCalculations`, `contextualKitEngine`, `configuratorCore`).
La comparaison fantôme KIT-002 (`docs/kit-simulation/SHADOW-COMPARISON.md`,
11 tests exécutés) a mesuré les divergences réelles : quantités non multipliées
côté checklist, poids inconnu assimilé à zéro, deux barèmes de classification
MUL incompatibles, constante 1000 g/L inventée, prix en euros flottants.

Cette ADR fige le contrat cible pour toute migration d'appelant (dossier §8,
étapes 3–4). Elle n'autorise aucune réécriture simultanée des moteurs
historiques : la migration se fait par adaptateurs, après attribution des écarts.

## 2. Décisions

### A. Une seule sémantique de masse

- Fond de sac + consommables = **charge au dos** ; les objets portés restent
  séparés (`wornWeightG`) ; la possession, le prêt ou le paiement n'ont **aucune
  incidence sur les grammes** (écart E02 corrigé : un objet détenu pèse).
- La quantité multiplie masse et prix (écart C2 documenté) ; la quantité gérée
  en amont d'un appelant doit être résolue avant l'adaptation, pas ignorée.
- `shareMass` fournit une répartition entière qui **conserve exactement tous
  les grammes**, stable par identifiant — comptabilité de parts, pas division
  physique d'un objet indivisible.

### B. L'inconnu n'est jamais zéro

- Un poids, un volume ou des consommables non établis produisent `null`, jamais
  0 g « exact » : `packWeightG = null`, `knownPackWeightG` publie la somme des
  seules masses connues (écarts E03/E10 corrigés).
- Un zéro historique de `gear_items.weight_g` est traité comme **absence de
  mesure** (zéro par défaut de la migration initiale).
- L'interface dit « inconnue » et n'affiche ni barre de progression ni total
  exact factice (test E15).
- La fiabilité d'un ravitaillement est un état vérifié
  (`confirme` / `confirme_communaute`) ; une donnée fraîche porte
  `observed_at`, `valid_until`, `source_id` (dossier §7).

### C. Unités internes explicites

- Grammes, millilitres, mètres, secondes, degrés Celsius, **cents entiers**
  avec code devise ; jamais de flottant monétaire dans le noyau (KIT-002 C9).
- Devise non supportée refusée, jamais convertie silencieusement (test
  affiliate). Un prix d'achat, un loyer, une caution et une dépense nette sont
  quatre concepts distincts.
- Une pente extraite d'un GPX est convertie explicitement : `5 %` entre dans
  Pandolf comme `5`, jamais `0,05`.

### D. Aucun badge de sécurité, aucune classification implicite

- Les sorties n'exposent **aucun badge** « ultralight » / « biomécaniquement
  sûr » : couverture des besoins et exactitude des masses sont publiées
  séparément (dossier §10). Les barèmes MUL historiques divergent (prouvé
  KIT-002 C5) et ne sont pas recopiés.
- Une couverture « complète » signifie uniquement que tous les slots du modèle
  sont renseignés ; les préférences dépassées restent affichées
  (`constraintStatus: exceeded`).
- Les équipements critiques de sécurité (secours, signalisation) sont exclus de
  toute suggestion de suppression automatique (`removalAdviceAllowed: false`).

### E. Pandolf : estimation honnête, pas plafond

- `pandolfWatts` est une estimation énergétique bornée par des limites de
  **produit**, pas un domaine clinique ; descente et hors-bornes ⇒ `null`
  (« estimation non établie »), jamais un nombre fantaisiste.
- L'intégration se fait par segment (durée réelle en secondes), jamais sur une
  pente moyenne de boucle.
- Une préférence de charge personnelle reste une **préférence utilisateur
  réglable**, jamais une prescription médicale.

### F. Neutralité commerciale structurelle

- Les commissions ne sont **pas une entrée du schéma** de requête (test
  dédié) : le classement sécurité/utilité précède tout critère commercial.
- Le choix d'offre (dossier §14) applique disponibilité, fraîcheur, devise et
  prix livré (`bestPurchasable`, expiration refusée, GTIN syntaxique seulement).

### G. Taxonomie et identité produit

- La taxonomie livrée compte **14 racines** (`taxonomy.json`) ; elle organise
  l'affichage, elle n'est pas un système de typage. Le nom d'un produit
  (« sac ») ne détermine jamais son slot.
- Le mapping `GearCategory` est une **table révisable** ; `misc` ne se mappe
  jamais automatiquement (« à vérifier » explicite).
- L'ancre d'intégration produit est `shop_products.id` ; un SKU marchand
  identifie une offre, pas une variante universelle.

### H. Adaptateurs, jamais de réécriture simultanée

- Les moteurs historiques restent en lecture ; tout appelant migre derrière un
  adaptateur vers le contrat canonique après attribution des écarts (KIT-002).
- Toute activation d'interface passe par `KIT_SIMULATION_ENABLED` (défaut
  `false`) et un rollback par drapeau.

## 3. Conséquences

- Les tests de `tests/kit-simulation/` (79 exécutés au 2026-10-18) constituent
  la **non-régression exécutable** de ces décisions : toute évolution qui
  réintroduit un zéro silencieux, un badge implicite ou un flottant monétaire
  casse la suite.
- Les propositions SQL restent sous `supabase/proposals/` jusqu'au preflight
  (P0A-001) et à la revue RLS (KIT-003) : aucune table n'est migrée sur la foi
  de cette ADR seule.
- Le dossier §22 (capacité) et §26 (lots) restent les références pour la
  montée en échelle ; cette ADR ne préjuge d'aucune mesure de charge.

## 4. Références

- `LKDV_Dossier_Technique_Maitre.md` §§7, 10, 11, 14, 26 ; écarts E01–E18 §4.
- `docs/kit-simulation/SHADOW-COMPARISON.md` — tableau d'attribution KIT-002.
- `docs/autonomy/EVIDENCE.md` — EV-0001 à EV-0005, EV-0006.
- Tests : `tests/kit-simulation/kit-simulation.spec.ts`,
  `affiliate-feedback.spec.ts`, `shadow-comparison.spec.ts`, `route.spec.ts`,
  `cockpit-a11y.spec.tsx`.
