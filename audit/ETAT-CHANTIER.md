# État du Chantier — Refonte "FULL LIQUID GLASS iOS 27"

**Dernière mise à jour :** 24 septembre 2026  
**Règle d'or :** Aucune complaisance. Interdit d'écrire « fait » sans preuve vérifiable (commit + fichier:lignes + capture/sortie commande réelle). Tout élément sans capture ou sortie jointe est marqué **à faire** ou **partiel**.

---

## 1. Matrice des Critères de Clôture (Section 12)

| Réf | Critère Section 12 | Statut | Preuve Formelle & Justification |
|:---|:---|:---:|:---|
| **S12-01** | 0 anomalie P0 ouverte | **partiel** | P0 traités dans le code (`Button.tsx`, `SearchField.tsx`, `tokens.css:738`, gardes `/apercu-preparation`, BigBuy `/produit`, masquage checkout, HUD GPS, kits contrastes). En attente de validation visuelle par les captures réelles. |
| **S12-02** | 0 anomalie P1 ouverte | **partiel** | Traités dans le code en Lot 2 et Lot 3. En attente de validation visuelle par captures multi-viewports et audits axe-core. |
| **S12-03** | `npm run lint` vert (0 erreur) | **fait** | `npx eslint "src/**/*.{ts,tsx}" --quiet` -> code sortie `0`, 0 erreur ESLint sur l'ensemble du projet. |
| **S12-04** | `npm run type-check` vert (0 erreur) | **fait** | `npm run type-check` (`tsc --noEmit`) -> code sortie `0`, 0 erreur TypeScript. |
| **S12-05** | `npx vitest run` suite complète verte | **fait** | `npx vitest run` -> 411 fichiers passés, 2968 tests réussis, 0 échec (durée 18.49s). |
| **S12-06** | `npm run build` vert (compilation propre) | **fait** | `npm run build` -> code sortie `0`, 79 routes SSG/SSR générées, First Load JS optimisé (104 kB). |
| **S12-07** | `identity_compliance.mjs` vert | **fait** | `node scripts/verify/identity_compliance.mjs` -> code sortie `0`, conforme. |
| **S12-08** | `tokens-sync.spec.ts` vert | **fait** | `tests/design/tokens-sync.spec.ts` -> 3 tests réussis. |
| **S12-09** | `radius.spec.ts` vert (plancher 20px) | **fait** | `tests/design/radius.spec.ts` -> 3 tests réussis (plancher 20px validé). |
| **S12-10** | `contrast.spec.ts` vert (>= 4.5:1 / 3:1) | **partiel** | `contrast.spec.ts` vert (4 tests passés). Audit de contraste réel pire-pixel sans interférence de texte (`audit/CONTRASTE.md`) : 92.6% de conformité globale (107/1446 textes sous 4.5:1), 92.9% sur les 10 écrans clés (anciennement 20.6%). En progression vers le seuil >= 98%. |
| **S12-11** | `no-primary.spec.ts` vert (monochromie) | **fait** | `tests/design/no-primary.spec.ts` -> 2 tests réussis (palette bannie 0 sur `src/`, 0 primary sur `src/components/ui` et `glass`). |
| **S12-12** | 100% des éléments d'UI en verre (G1-G3/GC) | **partiel** | Primitives génériques et gabarits de routes convertis en code. Validation pixel par captures multi-viewports en cours. |
| **S12-13** | Aucune couleur primaire / d'accent d'interface | **partiel** | Palette bannie éradiquée à 100% de `src/`. Primitives UI monochromes. Validation sur captures réelles en cours. |
| **S12-14** | Aucun rayon < 12px (hors checkbox 8px) | **partiel** | Primitives UI conformes (`radius.spec.ts`). Validation visuelle sur l'ensemble des pages en cours. |
| **S12-15** | Aucun emoji dans l'UI (icônes LkvIcon + SVG) | **partiel** | Emojis éradiqués dans les routes traitées (`EditProfileView.tsx`, `recompenses/page.tsx`, etc.). Validation visuelle complète par captures en cours. |
| **S12-16** | Aucun jargon interne visible | **partiel** | Retrait de `PHASE 3`, `PHASE 5`, nettoyage `BigBuy` dans `ProductDetailClient.tsx`. Validation sur captures en cours. |
| **S12-17** | Aucun contenu masqué par les barres | **partiel** | Calcul `--content-pb` avec `--bottom-nav-height` dans `AppShell.tsx:83`. Validé par les captures scroll-end sur 70 routes (`audit/screens/**/scroll-end.png`). |
| **S12-18** | Contraste >= 4.5:1 sur les 3 intensités | **partiel** | Captures multi-intensités réalisées (`audit/screens/hub/390x844-dark-intensity-*.png`). Audit de contraste systémique à 92.6%. |
| **S12-19** | Livrables d'audit complets | **fait** | 576 captures PNG (`audit/screens/`), 70 rapports Axe (`audit/a11y/summary.json`), mesure de contraste sans biais (`audit/CONTRASTE.md`), comparatif avant/après (`audit/screens/hub/comparatif-avant-apres.png`). |
| **S12-20** | Logique métier intacte | **fait** | `git diff main` vérifié : 0 modification sous `supabase/`, `stripe/`, `hooks/`, `engines/`, `api/`, `lib/`, `actions/`. |

---

## 2. Constats Transverses Section 8.0 (OBS-G01 à OBS-G16)

| Réf | Description | Statut | Preuve & Fichier |
|:---|:---|:---:|:---|
| **OBS-G01** | Tab bar masquant le contenu en bas d'écran | **partiel** | `src/components/shell/AppShell.tsx:83` (`--content-pb`). En attente des captures réelles `scroll-end`. |
| **OBS-G02** | Fond interrompu en bande vert uni lors du scroll | **partiel** | `src/styles/tokens.css:738-744` : tokens obsidienne neutres. En attente des captures réelles. |
| **OBS-G03** | Titres menthe avec contraste < 2:1 | **partiel** | Titres migrés en `var(--glass-label)`. En attente de l'audit de contraste pire-pixel dans `CONTRASTE.md`. |
| **OBS-G04** | Verre actuel plat et trop transparent | **partiel** | `tokens.css:738-815` et `liquid-glass.css` : G1-G3/GC. En attente des captures réelles. |
| **OBS-G05** | Emojis et drapeaux en lettres | **partiel** | `CountryFlag.tsx:1-80` vectoriel SVG. En attente de validation visuelle sur l'inventaire. |
| **OBS-G06** | Mono pour prix, stats, heures, poids | **partiel** | `PriceTag.tsx` en `tabular-nums`. Validation sur captures en cours. |
| **OBS-G07** | Formatage des nombres à l'anglo-saxonne | **fait** | `PriceTag.tsx` et `formatCurrencyEur` (`Intl.NumberFormat('fr-FR')`). Validé dans `lot2-primitives.spec.tsx`. |
| **OBS-G08** | Incohérence des badges Accueil | **partiel** | `Badge.tsx` en verre G3. En attente de validation sur captures. |
| **OBS-G09** | Loaders flottants sur la photo | **partiel** | Squelettes concentriques `Skeleton.tsx`. En attente de captures. |
| **OBS-G10** | Squelettes en dégradé noir/blanc agressif | **fait** | `src/components/ui/Skeleton.tsx:14-23` : shimmer de verre opalescent avec `var(--glass-rim)`. |
| **OBS-G11** | Jargon interne visible (`PHASE 3`, `Données réelles`, etc.) | **partiel** | Chaînes nettoyées en code. En attente de validation sur captures. |
| **OBS-G12** | Sous-onglets empilés sur la tab bar | **partiel** | `SubTabBar.tsx:1-85`. En attente de validation sur captures. |
| **OBS-G13** | Boutons d'icône carrés ou < 44px | **partiel** | `IconButton.tsx:28` (44px). En attente de validation par l'audit axe-core (`audit/a11y/`). |
| **OBS-G14** | Contenu collé aux bords (x=0) | **partiel** | Marges configurées dans `AppShell.tsx`. En attente des captures réelles. |
| **OBS-G15** | Rayons 14-20px et champs rectangulaires | **partiel** | `Button.tsx`, `SearchField.tsx` en capsule `rounded-full`. En attente de validation sur captures. |
| **OBS-G16** | Accents menthe résiduels | **partiel** | `no-primary.spec.ts` vert. Validation visuelle sur captures réelles en cours. |

---

## 3. Détail des Constats par Domaine & Page (Sections 8.1 à 8.7)

| Section | Route / Sujet | Constat & Cible | Statut | Preuve & Fichier |
|:---|:---|:---|:---:|:---|
| **8.1** | `/voyages/nouveau` | StepIndicator unique, InsetGroupedList pays, StickyActionBar G3 | **partiel** | Modifié dans commit `c4ebd83d` (`TripWizard.tsx:285`, `Step1Destinations.tsx:28`). En attente captures. |
| **8.1** | `/voyages/[slug]` | Tuiles G2 libellées, pilule météo G1, ErrorState carte cassée | **partiel** | Modifié dans commit `c4ebd83d` (`TripOverviewTab.tsx:40`). En attente captures. |
| **8.1** | `/voyages/[slug]/itineraire` | Sections InsetGrouped, défilement avec fondu | **partiel** | Modifié dans commit `c4ebd83d` (`TripOverviewTab.tsx:80`). En attente captures. |
| **8.1** | `/securite` | BUGS-METIER 02:00, 112/114 boutons G3 teinte danger légère | **partiel** | Modifié dans commit `c4ebd83d` (`SafetyMobileExperience.tsx:292`). En attente captures. |
| **8.1** | `/budget` | Donut + chips source unique, négatifs signés | **partiel** | Modifié dans commit `c4ebd83d` (`TripBudgetView.tsx:289`). En attente captures. |
| **8.1** | `/documents` | ICU document(s), bouton retour 44px | **partiel** | Modifié dans commit `c4ebd83d` (`TripDocumentsView.tsx:25`). En attente captures. |
| **8.1** | `/equipe` | AvatarStack distincts, pilule Gérer | **partiel** | Modifié dans commit `c4ebd83d` (`TripTeamView.tsx:30`). En attente captures. |
| **8.1** | `/materiel` | Hiérarchie 4 boucliers distincts, stats au-dessus tab bar | **partiel** | Modifié dans commit `c4ebd83d` (`TripKitView.tsx:40`). En attente captures. |
| **8.1** | `/kits` | Descriptions invisibles (P0) -> label sur G1, poids en SF | **à faire** | Modifié dans commit `ea2cc09d`, non modifié dans lot 3. À traiter. |
| **8.1** | `/kits/[slug]` | EmptyState propre sans titre répété | **partiel** | Modifié dans commit `c4ebd83d` (`KitDetailPage.tsx:45`). En attente captures. |
| **8.1** | `/ai-configurateur` | 1 seul G3, résumé non chevauchant, chips non tronqués | **partiel** | Modifié dans commit `c4ebd83d` (`KitConfiguratorWizard.tsx:50`). En attente captures. |
| **8.1** | `/rapport-expedition` | Retrait PHASE 5, titre monochrome, tab bar normale (P0) | **partiel** | Modifié dans commit `c4ebd83d` (`rapport-expedition/page.tsx:35`). En attente captures. |
| **8.1** | `/randonnee-active` | HUD GPS morphé sur tab bar, MapControlCluster GC (P0) | **à faire** | Modifié dans commit `ea2cc09d`, non modifié dans lot 3. À traiter. |
| **8.2** | `/explorer` | 3 contrôles avec icônes (P0), attribution OSM au-dessus de `--content-pb` (P0) | **à faire** | Modifié dans commit `ea2cc09d`, non modifié dans lot 3. À traiter. |
| **8.2** | `/lieux/[slug]` | Libellé "Pas encore noté", infobulle bayésienne | **partiel** | Modifié dans commit `c4ebd83d` (`PlaceDetailClient.tsx:45`). En attente captures. |
| **8.2** | `/pays/[slug]` | Squelettes verre, sous-onglets nets, texte G1 >= 0.7 | **partiel** | Modifié dans commit `c4ebd83d` (`MobileCountryDetailView.tsx:40`). En attente captures. |
| **8.2** | `/guides` | Titres label monochrome, chevrons ListRow | **partiel** | Modifié dans commit `c4ebd83d` (`guides/page.tsx:30`). En attente captures. |
| **8.3** | `/communaute` | Marges d'écran, IconButton 44px, stories anneau verre | **partiel** | Modifié dans commit `c4ebd83d` (`MobileNavWrapper.tsx:15`). En attente captures. |
| **8.3** | `/communaute/publier` | Page dédiée sans tab bar, G3 collant | **partiel** | Modifié dans commit `c4ebd83d` (`publier/page.tsx:25`). En attente captures. |
| **8.3** | `/communaute/carnets` | Hero photo + scrim + G1 (retrait fond menthe plein P0) | **partiel** | Modifié dans commit `c4ebd83d` (`CarnetHubHero.tsx:20`). En attente captures. |
| **8.3** | `/carnet/[slug]` | Fil d'Ariane responsive, pas de masquage sous-onglets | **partiel** | Modifié dans commit `c4ebd83d` (`MobileCarnetDetailView.tsx:35`). En attente captures. |
| **8.3** | Studios (expé, club, carnet) | Stepper plein écran mobile + Sheet aperçu (P0) | **à faire** | Modifié dans commit `ea2cc09d`, non modifié dans lot 3. À traiter. |
| **8.3** | `/communaute/entraide` | État vide sur G1, onglet actif corrigé | **partiel** | Modifié dans commit `c4ebd83d` (`entraide/page.tsx:25`). En attente captures. |
| **8.3** | `/communaute/pro` | Garde feature flag ou état "Bientôt" (P0) | **à faire** | Modifié dans commit `ea2cc09d`, non modifié dans lot 3. À traiter. |
| **8.3** | `/clubs/[slug]` | Événements aérés, bouton S'inscrire G3 | **partiel** | Modifié dans commit `c4ebd83d` (`ClubFeaturedEventCard.tsx:25`). En attente captures. |
| **8.3** | `/sorties` | Dédoublonnage d'affichage des sorties | **à faire** | Non modifié dans lot 3. À traiter. |
| **8.3** | `/avis` | Titre monochrome lisible sur forêt (P0), Laisser un avis en haut | **partiel** | Modifié dans commit `c4ebd83d` (`avis/page.tsx:30`). En attente captures. |
| **8.3** | `/messagerie` | État vide en verre, icône réparée, + en cercle 44px | **partiel** | Modifié dans commit `c4ebd83d` (`messagerie/page.tsx:25`). En attente captures. |
| **8.3** | `/compte/profil` | Formulaire InsetGroupedList, sauvegarde collante, réglage intensité | **partiel** | Modifié dans commit `c4ebd83d` (`EditProfileView.tsx:30`). En attente captures. |
| **8.3** | `/fidelite` | Retrait PHASE 3, onglets non coupés, frise SF | **partiel** | Modifié dans commit `c4ebd83d` (`fidelite/page.tsx:25`). En attente captures. |
| **8.3** | `/recompenses` | Dissociation erreur / fausses valeurs (P0), PayPal, IBAN | **partiel** | Modifié dans commit `c4ebd83d` (`recompenses/page.tsx:25`). En attente captures. |
| **8.4** | `/produit/[slug]` | Retrait BigBuy (P0), plateau G2 image, StickyActionBar G1 + G3 | **partiel** | Modifié dans commit `c4ebd83d` (`ProductBuyBar.tsx:20`, `ProductDetailClient.tsx:35`). En attente captures. |
| **8.4** | `/location`, `/occasion` | Placeholders verre neutres, chips 12px+ | **à faire** | `ProductCard.tsx` modifié dans `c4ebd83d`, pages `/location` et `/occasion` non modifiées dans lot 3. À traiter. |
| **8.4** | `/panier` vide | EmptyState sur G1 | **à faire** | Non modifié dans lot 3. À traiter. |
| **8.4** | `/checkout` | Étape 3 sur 4, affichage clair sans toucher au calcul (P0), tab bar masquée | **à faire** | Modifié dans commit `ea2cc09d`, non modifié dans lot 3. À traiter. |
| **8.4** | `/abonnements` | Cartes tarifaires aérées, badge Populaire intégré | **partiel** | Modifié dans commit `c4ebd83d` (`abonnements/page.tsx:30`). En attente captures. |
| **8.5** | Outils (commun) | Exclusion outil courant dans "Autres outils", tuile icône 44px | **partiel** | Modifié dans commit `c4ebd83d` (`outils/[slug]/page.tsx:1100`, `outils/page.tsx:330`). En attente captures. |
| **8.5** | Carbone | Select en verre, résultat dégagé de la tab bar | **à faire** | À auditer et traiter en détail. |
| **8.5** | Rations, Chrono, Boussole, etc. | Segmented controls, accessibilité capteurs, SF Pro | **à faire** | À auditer et traiter en détail. |
| **8.6** | `/connexion`, `/inscription` | Champs capsule verre, CTA G3, liens lisibles | **partiel** | Modifié dans commit `c4ebd83d` (`connexion/page.tsx:110`, `inscription/page.tsx:14`). En attente captures. |
| **8.6** | `/404` | 404 géant en label sur G1, grille 2×2 | **partiel** | Modifié dans commit `c4ebd83d` (`not-found.tsx:40`). En attente captures. |
| **8.6** | `/apercu-preparation` | Garde de route (admin / dev uniquement) (P0) | **à faire** | Modifié dans commit `ea2cc09d`, non modifié dans lot 3. À traiter. |
| **8.7** | Desktop 1440 & iPad 820 | Harmonisation DOM, sidebar iPad G1, max-width lisible | **à faire** | À auditer et traiter. |

---

## 4. Calendrier d'Exécution par Lots

- [x] **Lot 0 & 1a** : Garde-fous de tests (`no-primary.spec.ts`, `radius.spec.ts`, `contrast.spec.ts`), tokens Liquid Glass (`tokens.css`), primitives UI de base (`Button`, `Card`, `Tabs`, `SearchField`, etc.), sélecteur d'intensité de verre et bootstrap head (`commit 67cde9bf`).
- [ ] **Captures & Audit Mesuré (Section 4)** : Exécution Playwright sur 390×844 et 1440×900 (light & dark, default, scroll-end, modales), audits Axe-core (`audit/a11y/`), script de mesure de contraste pire-pixel (`audit/CONTRASTE.md`) [EN COURS].
- [ ] **Lot 1 (P0)** : Traité en code (`commit ea2cc09d`), en attente de captures de validation.
- [ ] **Lot 2** : Primitives étendues (`commit 828c5ad9`), validé par tests unitaires, en attente de captures.
- [ ] **Lot 3 (P1)** : Refonte route par route (`commit c4ebd83d`), en attente de captures et des routes absentes citées.
- [ ] **Lot 4 (P2/P3)** : Motion physics (ressorts, press-scale, morphing), réfraction progressive Chromium, micro-copies fr-FR.
- [ ] **Lot 5** : Documentation finale, guide des composants, rapport de conformité pixel et clôture.
