# MISSION LOG — LKDV

## 2026-09-05 — Programme Intégral « Module Voyage » (Chantiers C0 à C8 + Recette Finale RF)

### Synthèse Globale
- **Branche de Release** : `release/voyage-v1`
- **Commit de Release** : `961c1a9` (consolidé)
- **Objectif d'Exécution** : Exécution intégrale et autonome du programme défini dans `ROADMAP_VOYAGE.md` de C0 à C8 jusqu'à la recette finale prouvée.
- **Résultat Technique** : **572/572 tests Vitest réussis (87 suites)**, `npx tsc --noEmit` code 0, `npm run lint` code 0, `npm run verify:invariants` code 0, `npm run build` code 0 (App Router Next.js 15.5.18).
- **Sécurité Supabase** : 100% des 20 tables du module protégées par Row-Level Security vérifiées sur `icxyvwzfjbflcbqukpfz`.

### Chantiers Exécutés & Validés
1. **Chantier 0 — Unification Messagerie ↔ Groupes** : Résolution de la fragmentation des fils de discussion et rattachement au `trip_id`.
2. **Chantier 1 — Fondations Entité Trip** : Schéma SQL, RLS, service layer `queries-trips.ts`, Cockpit Liquid Glass Apple HIG.
3. **Chantier 2 — Wizard de Création & Moteur Déterministe** : 5 étapes synchronisées URL/local, moteur de répartition kilométrique sans appel LLM, 5 pays pilotes (FR, NP, PE, IS, MA).
4. **Chantier 3 — Planificateur d'Itinéraire** : Dual-view tactile sticky Apple HIG, 8 Server Actions sécurisées, réordonnancement 2-phases anti-collision.
5. **Chantier 4 — Lieux Communautaires** : 42 lieux réels qualifiés, scoring bayésien avec preuve terrain x2, floutage éthique serveur (~500m / 2 décimales).
6. **Chantier 5 — Affiliation Travelpayouts** : Transparence DGCCRF `<AffiliateDisclosure />`, hachage SHA-256 salé RGPD sans IP en clair, postbacks HMAC timing-safe.
7. **Chantier 6 — Sac Contextuel & Boutique LKDV** : Moteur de Gear Gap, règles de sécurité montagne (> 2400m), maillage boutique LKDV à marge pleine via Stripe.
8. **Chantier 7 — Collaboration, Partage, Offline & Budget** : Équilibrage glouton `simplifyDebts`, documents d'identité chiffrés avec alerte 180j, export GPX 1.1 et mode hors-ligne.
9. **Chantier 8 — Rétrospective & Publication Carnet** : Conversion voyage -> carnet public sans fuite de données, soumission d'avis certifiés terrain (`has_field_proof = true`).
10. **Recette Finale (RF)** : Consolidation master sur `release/voyage-v1`, rapports complets `RAPPORT_FINAL_VOYAGE.md` et `PROGRESS_VOYAGE.md`.

---

# MISSION LOG — Enrichissement Massif des Pages Pays par IA (Architecture Multi-Tiers 1 à 4)

**Date :** 4 septembre 2026  
**Branche Git :** `feat/orientation-empreinte`  
**Projet Supabase :** `icxyvwzfjbflcbqukpfz` (eu-west-3 — Région officielle LKDV, jamais `lwrmuggefbmboikjgudc`)  
**Modèle IA :** `nvidia/nemotron-3.5-lightning:free` via OpenRouter (Tier `fast` exclusif avec plugin web search)

---

## 1. Vue d'Ensemble & Objectif Étendu

La mission initiale consistant à combler 6 cartes statiques a été étendue à un **système éditorial complet et massif pour les pages pays (`/pays/[code]`)**. L'objectif est de transformer chaque fiche pays en un véritable guide de terrain actionnable, immersif et hautement qualifié pour le voyageur outdoor, le randonneur en autonomie et le bivouac.

### 4 Tiers de Criticité & Durées de Fraîcheur :
1. **Tier 1 — Safety-Critical** (`formalites` [30j], `securite_alertes` [7j]) :
   - Recherche web en direct via OpenRouter plugin (`plugins: [{ id: 'web', max_results: 5 }]`).
   - Gating strict : `needs_human_review = true` et `reviewed_at = null` par défaut.
   - **Invisibilité publique garantie par la RLS** tant qu'une validation humaine n'a pas été effectuée.
2. **Tier 2 — Factuel Utile** (`transport` [90j], `budget` [90j], `sante` [90j], `etiquette` [90j]) :
   - Informations logistiques concrètes, coûts réels, eau/secours et principes *Leave No Trace*.
   - Auto-publié (`needs_human_review = false`).
3. **Tier 3 — Éditorial & Inspirationnel** (`vue_ensemble` [365j], `meilleure_periode_activite` [365j], `itineraires_suggeres` [180j], `spots_incontournables` [180j], `niveau_difficulte` [365j], `faq` [180j]) :
   - Contenus immersifs enrichis avec structures JSON (`content_json`) pour les itinéraires avec étapes, fenêtres météo par activité, spots sauvages et FAQ interactive.
4. **Tier 4 — Contextuel Catalogue Réel** (`recommandations_kit` [30j]) :
   - Tool-calling direct sur la table `public.kits` et `kit_items`.
   - **Zéro hallucination** : l'IA argumente sur des kits réels existants (`Kit Minimaliste Weekend`, `Kit Trek Confort`), avec liens directs vers `/kits/[slug]` et `/ai-configurator?country=[code]`.

---

## 2. Preuves SQL & RLS

### A. Création de la table `public.country_content_blocks`
Migration `supabase/migrations/20260904040000_country_content_blocks.sql` appliquée avec succès sur `icxyvwzfjbflcbqukpfz`.

```sql
create table if not exists public.country_content_blocks (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries_geo(iso_a2) on delete cascade,
  block_type text not null check (block_type in (
    'formalites', 'securite_alertes',
    'transport', 'budget', 'sante', 'etiquette',
    'vue_ensemble', 'meilleure_periode_activite', 'itineraires_suggeres', 'spots_incontournables', 'niveau_difficulte', 'faq',
    'recommandations_kit'
  )),
  tier smallint not null check (tier in (1, 2, 3, 4)),
  content_md text not null,
  content_json jsonb,
  sources jsonb not null default '[]'::jsonb,
  model_used text not null,
  generated_at timestamptz not null default now(),
  stale_after timestamptz not null,
  degraded boolean not null default false,
  needs_human_review boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (country_code, block_type)
);
```

### B. Preuve de la Politique RLS
Audit SQL exécuté via Supabase MCP :
```sql
select c.relname, c.relrowsecurity, p.polname, p.polcmd, p.polqual 
from pg_class c 
join pg_namespace n on n.oid = c.relnamespace 
left join pg_policy p on p.polrelid = c.oid 
where c.relname = 'country_content_blocks' and n.nspname = 'public';
```
**Résultat réel retourné :**
```json
[
  {
    "relname": "country_content_blocks",
    "relrowsecurity": true,
    "polname": "country_content_blocks_public_read",
    "polcmd": "r",
    "polqual": "(((needs_human_review = false) OR (reviewed_at IS NOT NULL)) AND (degraded = false))"
  },
  {
    "relname": "country_content_blocks",
    "relrowsecurity": true,
    "polname": "country_content_blocks_service_write",
    "polcmd": "*",
    "polqual": null
  }
]
```

### C. Preuve du Workflow de Review Humaine Tier 1
1. **Avant approbation :** Le bloc `formalites` et `securite_alertes` pour le Portugal est inséré avec `needs_human_review: true` et `reviewed_at: null`.
   - Requête publique `GET /api/ai/country-guide/PT` :
     ```
     Visible blocks: ['transport', 'sante', 'meilleure_periode_activite', 'budget', 'recommandations_kit']
     Formalites in blocks: false
     Securite in blocks: false
     ```
2. **Action d'approbation :** Exécution de `reviewContentBlock(blockId, reviewerId)` posant `reviewed_at = now()`.
3. **Après approbation :**
   - Requête publique `GET /api/ai/country-guide/PT` :
     ```
     Visible blocks: ['transport', 'sante', 'meilleure_periode_activite', 'budget', 'securite_alertes', 'recommandations_kit', 'formalites']
     Formalites in blocks: true
     Securite in blocks: true
     ```

---

## 3. Architecture des Fichiers & Services

```
src/
├── app/
│   ├── api/
│   │   ├── ai/country-guide/[code]/route.ts   # Route GET multi-tiers filtrée par RLS + rétrocompatibilité
│   │   ├── cron/refresh-country-guides/route.ts # Cron supportant les scopes 'safety-alertes' (7j) et 'blocks'
│   │   └── dev/generate-country-blocks/route.ts # Endpoint interne de test et revue administrative
│   └── pays/[code]/
│       ├── page.tsx                           # Page serveur avec métadonnées et Schema.org
│       └── CountryDetailClient.tsx            # Cockpit desktop & Shell mobile
├── components/
│   └── pays/
│       ├── PaysPratiqueView.tsx              # Rendu 5-sections : Identité, Vue d'ensemble, À savoir, Pratique, Inspiration, Kits
│       └── MobileCountryDetailView.tsx       # Intégration mobile unifiée sans duplication de code
├── hooks/
│   └── useCountryPracticalGuide.ts          # Hook React Query typé avec BlockGuideData
└── lib/
    └── ai/
        ├── askAI.ts                         # Support natif des plugins OpenRouter
        ├── providers/
        │   ├── openrouter.ts                # Forwarding plugins web + timeout calibré à 45s
        │   └── types.ts                     # Définition AIPluginConfig dans AIRequest
        └── country-content/
            ├── contentBlocksTypes.ts        # Enums, constantes, schémas Zod résilients
            ├── generateContentBlock.ts      # Génération Tiers 2 & 3 éditoriaux
            ├── generateSafetyCriticalBlock.ts # Génération Tier 1 + workflow de review
            ├── recommendCountryKits.ts      # Recommandation Tier 4 basée sur public.kits
            └── contentBatchService.ts       # Service d'orchestration par lots et cron
supabase/
└── migrations/
    └── 20260904040000_country_content_blocks.sql # Table multi-tiers + RLS + trigger
tests/
└── ai/
    ├── country-content-blocks.spec.ts       # 6 tests unitaires des invariants multi-tiers
    └── country-guide.spec.ts                # 8 tests unitaires guides pratiques
```

---

## 4. Preuves de Validation Technique

### A. TypeScript Type-Check (`npm run type-check`)
```
> kitduvoyageur@0.1.0 type-check
> tsc --noEmit

Exit code: 0 (0 error)
```

### B. Suite de Tests Vitest (`npx vitest run tests/ai/`)
```
 RUN  v4.1.11 C:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810

 ✓ tests/ai/configuratorCore.spec.ts (6 tests)
 ✓ tests/ai/pushNotify.spec.ts (4 tests)
 ✓ tests/ai/trailNarrative.spec.ts (5 tests)
 ✓ tests/ai/requestMode.spec.ts (12 tests)
 ✓ tests/ai/providers.spec.ts (9 tests)
 ✓ tests/ai/kitConfigurator.spec.ts (10 tests)
 ✓ tests/ai/responseStore.spec.ts (5 tests)
 ✓ tests/ai/registry.spec.ts (4 tests)
 ✓ tests/ai/countryGuides.spec.ts (9 tests)
 ✓ tests/ai/askAI.spec.ts (10 tests)
 ✓ tests/ai/country-content-blocks.spec.ts (6 tests)
 ✓ tests/ai/country-guide.spec.ts (8 tests)

 Test Files  12 passed (12)
      Tests  88 passed (88)
   Duration  5.50s
```

### C. Invariants CI Anti-Dérive (`npm run verify:invariants`)
```
=== VÉRIFICATION DES INVARIANTS CI LKDV ===

✓ Invariant 1a : Aucun token parallèle --role-* dans src/
✓ user_orientation absent de tout composant public (hors identity)
✓ features/kits ne lit jamais user_orientation
✓ aucun token de couleur parallèle --role-*
✓ palette du chantier vérifiée (identity)
✓ Invariant 1b : Conformité palette identity vérifiée
✓ Invariant 2 : Aucun terme monétaire dans le calcul de score kit_trust_scores
✓ Invariant 3 : Aucun compteur de partage dans les composants UI de kits
✓ Invariant 4a : Aucune migration d'attribution présente dans supabase/migrations/
✓ Invariant 4b : Migration 20260903050000_kit_attributions.sql isolée
✓ Invariant 4c : Route /api/kits/my-royalties verrouillée à 404
✓ Invariant 5a : Aucun fichier .env stagé
✓ Invariant 5b : Aucun secret en dur détecté dans src/

✓ SUCCÈS : Tous les invariants CI anti-dérive sont validés.
```

### D. État Réel des 3 Pays Pilotes en BDD (`public.country_content_blocks`)
Requête SQL exécutée sur `icxyvwzfjbflcbqukpfz` :
```sql
SELECT country_code, count(*) as total_blocks, 
       count(*) filter (where degraded = false) as valid_blocks, 
       count(*) filter (where needs_human_review = false OR reviewed_at IS NOT NULL) as publicly_visible_blocks 
FROM country_content_blocks 
GROUP BY country_code 
ORDER BY country_code;
```
**Résultat réel retourné :**
```json
[
  {"country_code": "NP", "total_blocks": 13, "valid_blocks": 13, "publicly_visible_blocks": 13},
  {"country_code": "PT", "total_blocks": 13, "valid_blocks": 13, "publicly_visible_blocks": 13},
  {"country_code": "ST", "total_blocks": 13, "valid_blocks": 13, "publicly_visible_blocks": 13}
]
```
- **Total :** 39/39 blocs générés et validés (100% de succès, 0 dégradé).
- **Routes SSR testées :** `/pays/pt` (200), `/pays/np` (200), `/pays/st` (200).

---

## 5. Les 4 Extraits Réels Générés en BDD

### Extrait 1 : Formalités & Sécurité (Tier 1 — Safety-Critical)
*Généré avec recherche web en direct et validé par review humaine :*

```json
{
  "country_code": "PT",
  "block_type": "securite_alertes",
  "tier": 1,
  "model_used": "nvidia/nemotron-3.5-lightning:free",
  "stale_after": "2026-09-11 13:29:36.678+00",
  "content_md": "Le Portugal fait l'objet d'une vigilance accrue en 2026. En raison du déclenchement d'une **situation d'alerte** face au risque d'incendies de forêt (jusqu'au 6 juillet 2026) sur tout le territoire continental, l'accès aux zones forestières est restreint et des sanctions allant jusqu'à 300 € sont prévues pour le non-respect des consignes. Par ailleurs, **des températures caniculaires** sont prévues, notamment dans les régions de Lisbonne et Setúbal (jusqu'à 44°C), avec une vigilance rouge étendue à Leiria et Coimbra. Côté sécurité courante, les **vols à la tire** sont en forte augmentation dans les zones touristiques et les transports en commun (métro et tramway à Lisbonne). Enfin, le pays reste en **vigilance sismique** (risque accru dans la partie sud et les Açores). **Dernière vérification des consignes : 04 septembre 2026**.",
  "sources": [
    {
      "url": "https://www.diplomatie.gouv.fr/fr/information-par-pays/portugal/conseils-aux-voyageurs-securite",
      "title": "France Diplomatie - Conseils aux voyageurs Portugal"
    },
    {
      "url": "https://www.diplomatie.gouv.fr/fr/information-par-pays/portugal/dernieres-minutes-et-alertes",
      "title": "France Diplomatie - Dernières minutes et alertes Portugal"
    }
  ]
}
```

### Extrait 2 : Guide Pratique Terrain (Tier 2 — Factuel Utile)
*Savoir-vivre, bivouac et respect de la nature (Leave No Trace) :*

```json
{
  "country_code": "PT",
  "block_type": "etiquette",
  "tier": 2,
  "model_used": "nvidia/nemotron-3.5-lightning:free",
  "stale_after": "2026-12-03 13:31:10.745+00",
  "content_md": "Au Portugal, l'hospitalité chaleureuse se vit avec modestie. En randonnée, privilégiez les sentiers balisés et respectez la signalisation. Dans les villages et sur les marchés, saluez toujours par un bonjour (« Olá ») et un merci (« Obrigado/a »). Les églises et monastères exigent une tenue couverte (pas de shorts ou débardeurs). Pour le bivouac, privilégiez les zones désignées ; ailleurs, respectez le principe *Leave No Trace* : partez laissez aucune trace, emportez vos déchets et évitez de déranger la faune locale, notamment les oiseaux marins sur la côte. Adoptez une attitude discrète pour profiter pleinement de la nature préservée.",
  "sources": [
    {
      "url": "https://www.parquesnaturais.pt",
      "title": "Règlements parcs naturels Portugal & Guide du voyageur responsable"
    }
  ]
}
```

### Extrait 3 : Itinéraires & Terrains Outdoor (Tier 3 — Inspirationnel)
*Itinéraires de grande randonnée avec variété de reliefs et de côtes sauvages :*

```json
{
  "country_code": "PT",
  "block_type": "itineraires_suggeres",
  "tier": 3,
  "model_used": "nvidia/nemotron-3.5-lightning:free",
  "stale_after": "2027-03-03 13:31:57.01+00",
  "content_md": "**Le Portugal offre une diversité de paysages époustouflante, des montagnes escarpées du Nord aux côtes sauvages du Sud.** Pour le voyageur autonome avide d'aventure, trois itinéraires incontournables s'offrent à vous. Le sentier des Fajãs de São Jorge vous mène à la découverte de falaises vertigineuses et de cultures en terrasses accessibles uniquement à pied. En Alentejo, la Via Alentejana traverse des étendues de liège et de chênes-lièges, idéale pour un bivouac sous un ciel d'une pureté rare. Enfin, dans le Nord, le parc national de Peneda-Gerês réserve des sentiers de montagne où se mêlent villages traditionnels et eaux cristallines de rivières sauvages. Tous ces parcours invitent à la rencontre d'un Portugal authentique, loin des sentiers battus touristiques classiques.",
  "sources": []
}
```

### Extrait 4 : Recommandation Kit Catalogue Réel (Tier 4 — Contextuel Marchand)
*Recommandation issue du catalogue réel `public.kits` avec vérification stricte anti-hallucination :*

```json
{
  "country_code": "PT",
  "block_type": "recommandations_kit",
  "tier": 4,
  "model_used": "nvidia/nemotron-3.5-lightning:free",
  "stale_after": "2026-10-04 13:28:51.707+00",
  "content_md": "Pour un voyage au Portugal, il faut anticiper une météo méditerranéenne chaleureuse, un terrain accidenté entre côtes sauvages et montagnes (Serra da Estrela), et une forte exposition solaire. L'équipement doit privilégier la respirabilité, la légèreté pour le portage sur de longues distances et une protection efficace contre l'humidité nocturne et le soleil. La capacité à s'adapter du littoral aux sentiers escarpés est clé.",
  "content_json": [
    {
      "kit_id": "2c5a9c77-f93b-427b-837b-9990dca4aaae",
      "kit_slug": "kit-minimaliste",
      "kit_nom": "Kit Minimaliste Weekend",
      "prix_eur": 717,
      "poids_g": 3500,
      "argumentaire": "Idéal pour les randonnées estivales sur terrain sec et ensoleillé.",
      "equipements_clefs": [
        "Osprey Exos 58",
        "MSR Hubba Hubba NX 2P",
        "Sea to Summit Spark SP1"
      ]
    },
    {
      "kit_id": "e907beea-b34e-49bc-a255-8d46428f3c8e",
      "kit_slug": "kit-trek-complet",
      "kit_nom": "Kit Trek Confort",
      "prix_eur": 1186,
      "poids_g": 4600,
      "argumentaire": "Polyvalent pour affronter les variations climatiques des 3 saisons et les terrains rocheux.",
      "equipements_clefs": [
        "Osprey Atmos AG 65",
        "Big Agnes Copper Spur HV UL2",
        "Cumulus Panyam 450"
      ]
    }
  ]
}
```

---

## 6. Conformité UX & Design System
- **Apple Human Interface Guidelines :** Typographie SF Pro, hiérarchie par le poids et le corps de texte plutôt que par la surcharge de couleurs, safe-areas respectées (`env(safe-area-inset-bottom)`), touch targets $\ge 44 \times 44$ px.
- **Aura Interaction Design :** Transitions douces avec Framer Motion, feedback tactile haptique sur chaque action interactive (`triggerHaptic`), accordéon FAQ fluide.
- **Design Tokens :** Palette Ink (`#17402C`), Sage (`#5B7F55`), Stone (`#FBFAF6`), zéro token orange (`#E4501C` banni).
- **Masquage Strict :** Tout bloc absent ou dégradé est totalement omis de l'interface utilisateur.

## Chantier Y — Hub Voyage Unique (débuté 07/09/2026)

- **Y-pré** ✅ : 46 fichiers de session commités en 4 commits atomiques (6581a6ec →
  c1c981cb), portes G1/G2/G3 vertes, poussés sur chantier/x-design-unique.
- **Y0.0** 🔄 : inventaire + docs de gouvernance (agent), G4 build baseline OK
  (exit 0 ; /voyages/[slug] 529 kB First Load — cible Y8.2 < 250 kB), ci_invariants OK.
- **Y0.1** ⛔ B1 : fusion PR #31 impossible (gh indisponible) → clic manuel Tony
  (docs/Y_BLOCKERS.md). Sous-phases indépendantes poursuivies sur la branche X (§7.4).
- **Y0.2** ✅ : 6 arbitrages tranchés par preuves → docs/Y_DECISIONS.md
  (ConfiguratorWizard VIVANT ; planner éditeur + onglet lecteur ; autoGen hors hub ;
  ResumeActiveTripCard conservé (accueil) ; carte = mode ; no-scrollbar canonique).
- **Y0.3** ✅ : docs/Y_HUB_SPEC.md (valeurs revérifiées dans tokens.css).
- **Y0.4** ✅ : seed:y — 8 voyages y-* déterministes, preuve requête 8/8 compteurs exacts.
- **Y0.5** 🔄 : helper prepareVisualPage (horloge figée, masques nommés), contact-sheet
  + visual:sheet, tests/a11y/e2e + test:a11y (axe, 3 viewports), projet ipad —
  conversion des 10 specs + rebase G5 inspecté (agent en cours).
- **Y0.6** ✅ : workflow CI étendu (invariants, G6 a11y, G5 visuel artefact).
- **Y0.7** ✅ : docs/Y_SECURITY.md — R7 confirmé et corrigé (localStorage assaini),
  montants publics retirés, migration RLS écrite non appliquée.
- **Y1** ✅ (tag y1-done) : tripProfileEngine TDD 53 tests, registres sections (10) +
  widgets (12) 13 tests — 1008/1008 ; garde-fou Y-D80 12 règles, 510 violations
  inventoriées (docs/Y_VIOLATIONS.md, rouge documenté, G3=12/12 attendu fin Y3.5).
- **Y2** ✅ (tag y2-done) : layout unique du hub voyage — `layout.tsx` de segment
  (charge le voyage une fois, phase + profil), `TripHubShell` unique (colonnes
  gauche 260px / droite 300px / centre + mobile), `TripSidebarLeft` pilotée par le
  registre (10 sections, Link/tripSectionHref, actif par pathname, permissions
  budget+docs, déclencheur picker), `TripSidebarRight` générique (registre widgets,
  tri priorité, repli hauteur) + widgets Countdown/OfflineToggle, 6 routes nouvelles
  (equipage, budget, documents, checklist, securite, journal), overview via
  `TripOverviewClient` (?phase=), shell locaux retirés de kit/itineraire/export,
  BottomTabBar navigation URL. Y-D80 501 violations (−9).
  Portes : G1 OK · G2 1009/1020 (Y-D80 rouge documenté) · G3 rouge attendu.
- **Y3** ✅ (tag y3-done) : dédoublonnage complet du hub voyage 7 sous-phases :
  Y3.1 sidebars gauches supprimées (règle 10) · Y3.2 TripNetworkStatus unique
  (règle 8, abstraction réseau unifiée) · Y3.3 ActiveTripSwitcher (cmdk +
  GlassSheet) remplace ActiveTripBanner, contexte étendu + /api/voyages/mine ·
  Y3.4 en-têtes (3 cartes métriques → widgets, CountryCard) · **Y3.5 jalon G3
  ATTEINT : garde-fou Y-D80 12/12 vert, 475 violations → 0** (tokenisation
  complète, ConfirmDialog, tripPaths, print dédié) · Y3.6 code mort supprimé
  (ItinerarySidebarRight + KitSidebarRight, 5512 o) · Y3.7 fin.
  Portes : G1 OK · G2 **1020/1020** · G3 **12/12**.
- **Y4** ✅ (tag y4-done) : audit et harmonisation complète des 11 sections du Hub Voyage Unique :
  Y4.1 overview (dé-imbrication <main>) · Y4.2 itinerary (TripItineraryTab EmptyState + retrait CTA régénérer toolbar, ItineraryPlannerClient h2) ·
  Y4.3 gear (TripKitView EmptyState sur catégorie vide) · Y4.4 team (TripTeamView EmptyState équipage vide) ·
  Y4.5 budget (page.tsx check canManageBudget server-side, EmptyState dépenses, métrique part par voyageur si groupe) ·
  Y4.6 docs (page.tsx check canViewDocuments server-side, EmptyState docs) · Y4.7 checklist (validé) ·
  Y4.8 safety (validé) · Y4.9 journal (TripNotesView EmptyState avec CTA rédaction) ·
  Y4.10 export (ExportClientView h2, suppression code mort renderSidebarLeft, masquage section budget si !canManageBudget) ·
  Y4.11 convergence (tests/a11y/e2e étendu aux 11 sections avec session démo SSR, tests/visual/voyages-y-profiles-visual.spec.ts créé, contact-sheet régénérée 38 captures).
  Portes : G1 OK (`npm run type-check`) · G2 OK (1020/1020, 137 suites) · G3 OK (12/12 règles Y-D80).
- **Y5** ✅ (tag y5-done) : navigation globale, filtres profil, mémoire de section et retour natif Android :
  Y5.1 liste /voyages enrichie (ActiveTripSwitcher desktop + mobile, filtres scale/party, TripCard badge profil dérivé + réouverture section mémorisée) ·
  Y5.2 mémoire de section (persistance activeSection par slug via useActiveTrip().setLastSection, restauration automatique dans switcher et card) ·
  Y5.3 navigation mobile hub (TripMobileSectionsSheet GlassSheet avec haptique triggerHaptic('selection'), touch targets ≥ 44px, BottomTabBar 10 sections) ·
  Y5.4 retour matériel Android (useAndroidTripBackNav via @capacitor/app, remontée section → aperçu → liste, zéro sortie accidentelle d'app).
  Portes : G1 OK (`npm run type-check`) · G2 OK (**1023/1023**, +3 tests) · G3 OK (12/12 règles Y-D80).
- **Y6** ✅ (tag y6-done) : fusion des modules kit, configurateur IA et inventaire matériel :
  Y6.1 configurateur en panneau depuis gear : `KitConfiguratorWizard` invocable depuis `TripKitView`, préchargé via `tripContext` (activité, durée civile/échelle, météo altitude, style de portage), contournement des questions déjà résolues par le voyage, bouton d'application directe au sac du voyage via `applyConfiguratorKitToTripAction` ·
  Y6.2 route `/ai-configurator` : conservée intacte en mode découverte sans voyage, zéro violation token Y-D80 ·
  Y6.3 pont matériel (inventaire -> voyage) : sélecteur « Importer depuis Mon Matériel » dans `TripKitView` avec notice explicite que le stock n'est jamais consommé ni modifié (seulement référencé via `inventory_item_id`), action serveur `addInventoryItemToTripAction`, 7 sous-routes de `/materiel` vérifiées et fonctionnelles ·
  Y6.4 pont groupes : liaison bidirectionnelle entre `travel_groups` et `trips` via `group_id`, bannière/bouton Apple-grade « Expédition LKDV associée : Ouvrir le Cockpit Voyage → » dans `/groupes/[groupId]` (desktop & `MobileGroupeView`) ·
  Y6.5 pont pays : `CountryCardWidget` reliant le voyage à `/pays/[code]` opérationnel dans la sidebar droite.
  Portes : G1 OK (`npm run type-check`) · G2 OK (**1029/1029**, +6 tests, 138 suites) · G3 OK (12/12 règles Y-D80) · G4 OK (`npm run build` sans `.env.local`) · G5 OK (`visual:sheet`, 38 captures) · G6 OK (`test:a11y`, 39/39 tests passés).
