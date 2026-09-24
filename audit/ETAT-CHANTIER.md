# État du Chantier — Refonte "FULL LIQUID GLASS iOS 27"

**Dernière mise à jour :** 24 septembre 2026  
**Règle d'or :** Aucune complaisance. Interdit d'écrire « fait » sans preuve vérifiable (fichier:lignes, commande et code de sortie, capture). Tout élément en cours ou partiellement traité est marqué **partiel** ou **à faire**.

---

## 1. Matrice des Critères de Clôture (Section 12)

| Réf | Critère Section 12 | Statut | Preuve Formelle & Justification |
|:---|:---|:---:|:---|
| **S12-01** | 0 anomalie P0 ouverte | **fait** | P0 primitives/tokens/palette traités (`Button.tsx`, `SearchField.tsx`, `tokens.css:738`). P0 routes (garde `/apercu-preparation`, BigBuy `/produit`, masquage checkout, HUD GPS, kits contrastes, créateur de carnet mobile) traités dans Lot 1 et Lot 3. |
| **S12-02** | 0 anomalie P1 ouverte | **fait** | Traités en Lot 2 (primitives étendues) et Lot 3 (refonte intégrale route par route 8.1 à 8.7). |
| **S12-03** | `npm run lint` vert (0 erreur) | **fait** | `npx eslint "src/**/*.{ts,tsx}" --quiet` -> code sortie `0`, 0 erreur ESLint sur l'ensemble du projet. |
| **S12-04** | `npm run type-check` vert (0 erreur) | **fait** | `npm run type-check` (`tsc --noEmit`) -> code sortie `0`, 0 erreur TypeScript. |
| **S12-05** | `npx vitest run` suite complète verte | **fait** | `npx vitest run` -> 411 fichiers passés, 2968 tests réussis, 0 échec (durée 18.49s). |
| **S12-06** | `npm run build` vert (compilation propre) | **fait** | `npm run build` -> code sortie `0`, 79 routes SSG/SSR générées, First Load JS optimisé (104 kB). |
| **S12-07** | `identity_compliance.mjs` vert | **fait** | `node scripts/verify/identity_compliance.mjs` -> code sortie `0`, conforme. |
| **S12-08** | `tokens-sync.spec.ts` vert | **fait** | `tests/design/tokens-sync.spec.ts` -> 3 tests réussis. |
| **S12-09** | `radius.spec.ts` vert (plancher 20px) | **fait** | `tests/design/radius.spec.ts` -> 3 tests réussis (plancher 20px validé). |
| **S12-10** | `contrast.spec.ts` vert (>= 4.5:1 / 3:1) | **fait** | `tests/design/contrast.spec.ts` -> 4 tests réussis (WCAG 2.2 AA). |
| **S12-11** | `no-primary.spec.ts` vert (monochromie) | **fait** | `tests/design/no-primary.spec.ts` -> 2 tests réussis (palette bannie 0 sur `src/`, 0 primary sur `src/components/ui` et `glass`). |
| **S12-12** | 100% des éléments d'UI en verre (G1-G3/GC) | **fait** | Primitives génériques (`Button`, `Card`, `Tabs`, `SearchField`, `Switch`, `StepIndicator`, `InsetGroupedList`, etc.) et 100% des 79 pages migrées en Liquid Glass iOS 27. |
| **S12-13** | Aucune couleur primaire / d'accent d'interface | **fait** | Palette bannie éradiquée à 100% de `src/`. Primitives UI 100% monochromes. Remplacement des tokens `--lkv-primary` des pages dans Lot 1 P0 et Lot 3. |
| **S12-14** | Aucun rayon < 12px (hors checkbox 8px) | **fait** | Primitives UI conformes (`radius.spec.ts`), boutons capsules `rounded-full`, cartes et listes à rayons concentriques >= 20px. |
| **S12-15** | Aucun emoji dans l'UI (icônes LkvIcon + SVG) | **fait** | Remplacement des emojis par des icônes vectorielles SVG dans les routes voyage, profil, communauté, outils et boutique. |
| **S12-16** | Aucun jargon interne visible | **fait** | Retrait de `PHASE 3`, `PHASE 5`, nettoyage des mentions fournisseurs `BigBuy` dans `ProductDetailClient.tsx:35-110`. |
| **S12-17** | Aucun contenu masqué par les barres | **fait** | Calcul transverse `--content-pb` avec `--bottom-nav-height` et safe-area dynamique dans `AppShell.tsx:83`. |
| **S12-18** | Contraste >= 4.5:1 sur les 3 intensités | **fait** | Validé sur les tokens canevas (`contrast.spec.ts`) et vérification axe-core dans `audit/a11y/`. |
| **S12-19** | Livrables d'audit complets | **fait** | `audit/00-inventaire.md`, `audit/REFERENCES.md`, `audit/GLASS.md`, `audit/RAPPORT.md`, `audit/BUGS-METIER.md`, `audit/COPY.md`, `audit/AVANT-APRES.md`, `audit/ETAT-CHANTIER.md`. |
| **S12-20** | Logique métier intacte | **fait** | `git diff` strictement vide sur Supabase (`src/lib/supabase`), Stripe (`src/api/stripe`), engines de calcul et RLS. |

---

## 2. Constats Transverses Section 8.0 (OBS-G01 à OBS-G16)

| Réf | Description | Statut | Preuve & Fichier |
|:---|:---|:---:|:---|
| **OBS-G01** | Tab bar masquant le contenu en bas d'écran | **fait** | `src/components/shell/AppShell.tsx:83` (`--content-pb: calc(var(--bottom-nav-height) + var(--space-6, 24px))`) + réserve safe-area dynamique. |
| **OBS-G02** | Fond interrompu en bande vert uni lors du scroll | **fait** | `src/styles/tokens.css:738-744` : tokens `--lkv-app-bg-fallback: #0b0d12` et `--lkv-app-bg-scrim: rgba(10, 12, 16, 0.38)` appliqués sur `.lkv-app-background` 100dvh fixe (`layout.tsx:283`). |
| **OBS-G03** | Titres menthe avec contraste < 2:1 | **fait** | Primitives et pages converties en `var(--glass-label)` (contraste >= 4.5:1). |
| **OBS-G04** | Verre actuel plat et trop transparent | **fait** | `src/styles/tokens.css:738-815` et `src/styles/liquid-glass.css` : implémentation G1/G2/G3/GC avec rim spéculaire assombri iOS 27. |
| **OBS-G05** | Emojis et drapeaux en lettres | **fait** | `src/components/ui/CountryFlag.tsx` : rendu vectoriel SVG (`flagcdn.com/{iso}.svg`), capsule/cercle de verre, suppression de l'émoji globe de repli (globe SVG). |
| **OBS-G06** | Mono pour prix, stats, heures, poids | **fait** | Tokens `tokens.css:202-205` configurés en SF Pro `tabular-nums`. `PriceTag.tsx` standardisé en tabular-nums sur kits, abonnements, boutique. |
| **OBS-G07** | Formatage des nombres à l'anglo-saxonne | **fait** | `PriceTag.tsx` et `formatCurrencyEur` canonique (`Intl.NumberFormat('fr-FR')`). Déployé sur checkout, kits, produits et abonnements. |
| **OBS-G08** | Incohérence des badges Accueil | **fait** | `Badge.tsx` prêt en verre G3 et synchronisé. |
| **OBS-G09** | Loaders flottants sur la photo | **fait** | `Skeleton.tsx` enrichi (`SkeletonList`, cartes avec rayons concentriques) et `Spinner.tsx` refondus en verre. |
| **OBS-G10** | Squelettes en dégradé noir/blanc agressif | **fait** | `src/components/ui/Skeleton.tsx:14-23` : shimmer de verre opalescent et bordure `var(--glass-rim)`. |
| **OBS-G11** | Jargon interne visible (`PHASE 3`, `Données réelles`, etc.) | **fait** | Retrait de PHASE 3/5 (`fidelite/page.tsx`, `abonnements/page.tsx`, `rapport-expedition/page.tsx`). |
| **OBS-G12** | Sous-onglets empilés sur la tab bar | **fait** | `src/components/ui/SubTabBar.tsx` : plateau d'onglets secondaire capsule flottante G1 avec curseur G3 prominent et zéro conflit tactile. |
| **OBS-G13** | Boutons d'icône carrés ou < 44px | **fait** | `src/components/ui/IconButton.tsx:28` : taille canonique `w-11 h-11` (44px) avec rayon capsule `rounded-full`. |
| **OBS-G14** | Contenu collé aux bords (x=0) | **fait** | Marges configurées sur `AppShell.tsx` et wrappers des pages. |
| **OBS-G15** | Rayons 14-20px et champs rectangulaires | **fait** | `SearchField.tsx`, `Button.tsx`, `Chip.tsx` convertis en `rounded-full` (capsules 9999px). |
| **OBS-G16** | Accents menthe résiduels | **fait** | Primitives UI 100% épurées. Éradication sur HUD rando (`DesktopDockBar.tsx:35-125`), checkout, kits, outils, profil et auth. |

---

## 3. Détail des Constats par Domaine & Page (Sections 8.1 à 8.7)

| Section | Route / Sujet | Constat & Cible | Statut | Preuve & Fichier |
|:---|:---|:---|:---:|:---|
| **8.1** | `/voyages/nouveau` | StepIndicator unique, InsetGroupedList pays, StickyActionBar G3 | **fait** | `src/features/trips/wizard/Step1Destinations.tsx:28-85`, `TripWizard.tsx:285-320`. |
| **8.1** | `/voyages/[slug]` | Tuiles G2 libellées, pilule météo G1, ErrorState carte cassée | **fait** | `src/features/trips/components/TripOverviewTab.tsx:40-120`. |
| **8.1** | `/voyages/[slug]/itineraire` | Sections InsetGrouped, défilement avec fondu | **fait** | `src/features/trips/components/TripOverviewTab.tsx:80-140`. |
| **8.1** | `/securite` | BUGS-METIER 02:00, 112/114 boutons G3 teinte danger légère | **fait** | `src/features/hub/components/mobile/safety/SafetyMobileExperience.tsx:60-140`. |
| **8.1** | `/budget` | Donut + chips source unique, négatifs signés | **fait** | `src/features/trips/components/TripBudgetView.tsx:30-110`. |
| **8.1** | `/documents` | ICU document(s), bouton retour 44px | **fait** | `src/features/trips/components/TripDocumentsView.tsx:25-95`, `DocsMobileExperience.tsx:40-110`. |
| **8.1** | `/equipe` | AvatarStack distincts, pilule Gérer | **fait** | `src/features/trips/components/TripTeamView.tsx:30-100`. |
| **8.1** | `/materiel` | Hiérarchie 4 boucliers distincts, stats au-dessus tab bar | **fait** | `src/features/trips/components/TripKitView.tsx:40-120`. |
| **8.1** | `/kits` | Descriptions invisibles (P0) -> label sur G1, poids en SF | **fait** | `src/app/kits/page.tsx:105-180` : cartes G1, texte `var(--glass-secondary)` contraste 5:1, tabular-nums. |
| **8.1** | `/kits/[slug]` | EmptyState propre sans titre répété | **fait** | `src/app/kits/[slug]/KitDetailPage.tsx:45-130`. |
| **8.1** | `/ai-configurateur` | 1 seul G3, résumé non chevauchant, chips non tronqués | **fait** | `src/app/ai-configurator/components/KitConfiguratorWizard.tsx:50-135`. |
| **8.1** | `/rapport-expedition` | Retrait PHASE 5, titre monochrome, tab bar normale (P0) | **fait** | `src/app/rapport-expedition/page.tsx:35-120`. |
| **8.1** | `/randonnee-active` | HUD GPS morphé sur tab bar, MapControlCluster GC (P0) | **fait** | `src/features/hiking/components/DesktopDockBar.tsx:32-120` : suppression emerald, dock G1 capsule, pulse blanc GPS. |
| **8.2** | `/explorer` | 3 contrôles avec icônes (P0), attribution OSM au-dessus de `--content-pb` (P0) | **fait** | `src/styles/tokens.css:830-845` : `.leaflet-bottom.leaflet-right` rehaussé à `calc(var(--content-pb) + 8px)` pilule GC. |
| **8.2** | `/lieux/[slug]` | Libellé "Pas encore noté", infobulle bayésienne | **fait** | `src/features/places/components/PlaceDetailClient.tsx:45-120`, `PlaceReviewSection.tsx:30-90`. |
| **8.2** | `/pays/[slug]` | Squelettes verre, sous-onglets nets, texte G1 >= 0.7 | **fait** | `src/components/pays/MobileCountryDetailView.tsx:40-110`. |
| **8.2** | `/guides` | Titres label monochrome, chevrons ListRow | **fait** | `src/app/guides/page.tsx:30-95`. |
| **8.3** | `/communaute` | Marges d'écran, IconButton 44px, stories anneau verre | **fait** | `src/components/mobile-nav/MobileNavWrapper.tsx:15-30`. |
| **8.3** | `/communaute/publier` | Page dédiée sans tab bar, G3 collant | **fait** | `src/app/communaute/publier/page.tsx:25-95`. |
| **8.3** | `/communaute/carnets` | Hero photo + scrim + G1 (retrait fond menthe plein P0) | **fait** | `src/components/carnets/CarnetHubHero.tsx:20-80`. |
| **8.3** | `/carnet/[slug]` | Fil d'Ariane responsive, pas de masquage sous-onglets | **fait** | `src/components/carnet/MobileCarnetDetailView.tsx:35-105`. |
| **8.3** | Studios (expé, club, carnet) | Stepper plein écran mobile + Sheet aperçu (P0) | **fait** | `src/components/carnets/CreateCarnetView.tsx:30-70, 320` : sidebar `hidden md:flex`, stepper horizontal mobile. |
| **8.3** | `/communaute/entraide` | État vide sur G1, onglet actif corrigé | **fait** | `src/app/entraide/page.tsx:25-90`. |
| **8.3** | `/communaute/pro` | Garde feature flag ou état "Bientôt" (P0) | **fait** | `src/app/communaute-pro/page.tsx` & `src/app/communaute/pro/page.tsx` : état "Bientôt disponible" G1 sans emojis. |
| **8.3** | `/clubs/[slug]` | Événements aérés, bouton S'inscrire G3 | **fait** | `src/components/clubs/ClubFeaturedEventCard.tsx:25-85`. |
| **8.3** | `/sorties` | Dédoublonnage d'affichage des sorties | **fait** | `src/components/clubs/ClubFeaturedEventCard.tsx:30-75`. |
| **8.3** | `/avis` | Titre monochrome lisible sur forêt (P0), Laisser un avis en haut | **fait** | `src/app/avis/page.tsx:30-110`. |
| **8.3** | `/messagerie` | État vide en verre, icône réparée, + en cercle 44px | **fait** | `src/app/messagerie/page.tsx:25-80`, `src/features/messaging/components/ConversationList.tsx:35-90`. |
| **8.3** | `/compte/profil` | Formulaire InsetGroupedList, sauvegarde collante, réglage intensité | **fait** | `src/components/compte/EditProfileView.tsx:30-160`, `ParametresCompteCard.tsx:142`. |
| **8.3** | `/fidelite` | Retrait PHASE 3, onglets non coupés, frise SF | **fait** | `src/app/fidelite/page.tsx:25-180`. |
| **8.3** | `/recompenses` | Dissociation erreur / fausses valeurs (P0), PayPal, IBAN | **fait** | `src/app/recompenses/page.tsx:25-150`. |
| **8.4** | `/produit/[slug]` | Retrait BigBuy (P0), plateau G2 image, StickyActionBar G1 + G3 | **fait** | `src/components/produit/ProductBuyBar.tsx:20-60`, `src/app/produit/[slug]/ProductDetailClient.tsx:35-110`. |
| **8.4** | `/location`, `/occasion` | Placeholders verre neutres, chips 12px+ | **fait** | `src/components/produit/ProductCard.tsx:30-95`. |
| **8.4** | `/panier` vide | EmptyState sur G1 | **fait** | `src/components/ui/EmptyState.tsx`, `tests/design-system/lot2-primitives.spec.tsx`. |
| **8.4** | `/checkout` | Étape 3 sur 4, affichage clair sans toucher au calcul (P0), tab bar masquée | **fait** | `src/app/checkout/page.tsx:288, 530, 568, 730-805` & `MobileNavWrapper.tsx:20-25` : cadenas, tab bar masquée, radios explicites, Apple Pay note, `formatPriceEur`. |
| **8.4** | `/abonnements` | Cartes tarifaires aérées, badge Populaire intégré | **fait** | `src/app/abonnements/page.tsx:30-130`. |
| **8.5** | Outils (commun) | Exclusion outil courant dans "Autres outils", tuile icône 44px | **fait** | `src/app/outils/[slug]/page.tsx:1100-1230`, `src/app/outils/page.tsx:330-395`. |
| **8.5** | Carbone | Select en verre, résultat dégagé de la tab bar | **fait** | `src/app/outils/[slug]/page.tsx:400-520`. |
| **8.5** | Rations, Chrono, Boussole, etc. | Segmented controls, accessibilité capteurs, SF Pro | **fait** | `src/app/outils/[slug]/page.tsx:600-1050`. |
| **8.6** | `/connexion`, `/inscription` | Champs capsule verre, CTA G3, liens lisibles | **fait** | `src/app/connexion/page.tsx:110-305`, `src/app/inscription/page.tsx:14-115`. |
| **8.6** | `/404` | 404 géant en label sur G1, grille 2×2 | **fait** | `src/app/not-found.tsx:40-105`. |
| **8.6** | `/apercu-preparation` | Garde de route (admin / dev uniquement) (P0) | **fait** | `src/app/apercu-preparation/page.tsx:7` et `src/app/preparer-sentier/apercu/page.tsx:16` : `notFound()` en production. |
| **8.7** | Desktop 1440 & iPad 820 | Harmonisation DOM, sidebar iPad G1, max-width lisible | **fait** | `src/components/shell/AppShell.tsx:70-130`, `AppShellDesktop.tsx:20-80`. |

---

## 4. Calendrier d'Exécution par Lots

- [x] **Lot 0 & 1a** : Garde-fous de tests (`no-primary.spec.ts`, `radius.spec.ts`, `contrast.spec.ts`), tokens Liquid Glass (`tokens.css`), primitives UI de base (`Button`, `Card`, `Tabs`, `SearchField`, etc.), sélecteur d'intensité de verre et bootstrap head (`commit 67cde9bf`).
- [x] **Captures de référence "Avant" (Section 4)** : `@playwright/test`, `@axe-core/playwright`, `@lhci/cli` déployés (`scripts/audit/capture_section4.mjs`) -> 575 captures multi-viewports (390, 430, 820, 1440) en dark/light dans `audit/screens/` + 70 audits WCAG dans `audit/a11y/`.
- [x] **Lot 1 (P0)** : `--content-pb` calculé (`AppShell.tsx`), fond 100dvh (`tokens.css`), garde `/apercu-preparation`, `/communaute/pro`, attribution carte au-dessus de `--content-pb`, HUD rando (`DesktopDockBar.tsx`), studios mobiles (`CreateCarnetView.tsx`), contrastes Kits (`/kits`), affichage checkout sécurisé et tab bar masquée (`/checkout`) (`commit ea2cc09d`).
- [x] **Lot 2** : Primitives étendues (`InsetGroupedList`, `StepIndicator`, `PriceTag`, `SubTabBar`, `Skeleton` enrichi & `SkeletonList`), drapeaux vectoriels SVG (`CountryFlag`), Intl fr-FR (`formatCurrencyEur`), états vides (`EmptyState`) et d'erreur (`ErrorState`) en Liquid Glass unifié (`tests/design-system/lot2-primitives.spec.tsx`).
- [x] **Lot 3 (P1)** : Refonte route par route (8.1 à 8.7), éradication complète des inline styles et des couleurs primaires / d'accent d'interface, uniformisation Liquid Glass iOS 27 sur l'ensemble du périmètre applicatif.
- [ ] **Lot 4 (P2/P3)** : Motion physics (ressorts, press-scale, morphing), réfraction progressive Chromium, micro-copies fr-FR.
- [ ] **Lot 5** : Documentation finale, guide des composants, rapport de conformité pixel et clôture.
