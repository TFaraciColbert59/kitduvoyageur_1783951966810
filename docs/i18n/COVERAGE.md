# Rapport de couverture i18n — P6

Généré le 2026-10-17 par `node scripts/i18n/coverage.mjs`.

## 1. Portée et méthode

- **FR reste la langue source.** L'anglais ne couvre que les surfaces listées en §3 ; les autres composants restent en français.
- Dossiers scannés : `src/app`, `src/components` (fichiers `.ts`/`.tsx`).
- Heuristique : segments JSX texte et littéraux de chaînes contenant un caractère accentué ou un mot français courant. Faux positifs/négatifs possibles (chaînes courtes sans accent non détectées).

## 2. Chiffres clés

- Fichiers scannés : **660**
- Fichiers contenant au moins un segment français évident : **457**
- Segments français détectés : **5377**
- Clés du dictionnaire FR : **239** — clés EN : **239** — parité FR/EN : **oui**

| Section | Clés |
| --- | ---: |
| accessibility | 2 |
| account | 17 |
| auth | 46 |
| common | 15 |
| crews | 6 |
| nav | 5 |
| navigation | 6 |
| progression | 132 |
| trips | 10 |

## 3. Surfaces couvertes par l’anglais (P6)

| Surface | Fichier(s) | Détail |
| --- | --- | --- |
| Navigation mobile (libellés) | `src/components/mobile-nav/destinationRegistry.ts` | Helper `getDestinationLabel(id, locale)` sur les libellés FR/EN existants (barre inférieure non modifiée). |
| Connexion / inscription / mot de passe oublié | `src/app/connexion/page.tsx` | Titres, champs, placeholders, boutons, erreurs, toasts, aria de mot de passe. |
| Ma progression | `src/components/progression/MaProgressionView.tsx` | En-tête, compétences, classement (5 filtres), défis, distinctions, gains, solde, états chargement/vide/erreur. |
| Entrées du compte | `src/components/compte/TabsCompte.tsx`, `src/components/compte/CompteLeftSidebar.tsx`, `src/app/compte/page.tsx` | Entrées « Ma progression », « Gains & Récompenses », « Paramètres », navigation, titres d’état connecté. |
| États communs | `src/lib/i18n/translations/{fr,en}.ts` | chargement, vide, erreur, hors-ligne, indisponible, réessayer. |

## 4. Chaînes françaises restantes

**457 fichiers sur 660** contiennent encore des chaînes françaises évidentes. Liste complète (triée par volume) :

| Fichier | Segments |
| --- | ---: |
| `src/app/api/seed/route.ts` | 154 |
| `src/components/progression/MaProgressionView.tsx` | 154 |
| `src/app/outils/[slug]/page.tsx` | 148 |
| `src/app/admin/page.tsx` | 110 |
| `src/app/admin/produits/AdminProductsManager.tsx` | 106 |
| `src/app/clubs/page.tsx` | 104 |
| `src/app/communaute/publier/page.tsx` | 85 |
| `src/components/compte/ParametresCompteCard.tsx` | 85 |
| `src/components/compte/EditProfileView.tsx` | 80 |
| `src/components/compte/FideliteTab.tsx` | 71 |
| `src/components/carnets/CreateCarnetView.tsx` | 69 |
| `src/components/clubs/CreateClubView.tsx` | 69 |
| `src/app/api/pays/[code]/route.ts` | 67 |
| `src/app/nouveau-groupe/page.tsx` | 65 |
| `src/app/carnets/page.tsx` | 63 |
| `src/components/compte/CommandesTab.tsx` | 59 |
| `src/components/communaute/CommunityPostCard.tsx` | 58 |
| `src/app/rapport-expedition/page.tsx` | 55 |
| `src/app/fidelite/page.tsx` | 52 |
| `src/components/groupes/EquipementCard.tsx` | 51 |
| `src/components/pays/BouteilleALaMer.tsx` | 51 |
| `src/app/checkout/page.tsx` | 50 |
| `src/components/explorer/ExplorerClient.tsx` | 49 |
| `src/app/outils/page.tsx` | 46 |
| `src/app/outils/[slug]/layout.tsx` | 45 |
| `src/components/dev/glass/GlassLab.tsx` | 45 |
| `src/components/legal/PrivacyPolicySections.tsx` | 45 |
| `src/app/mentions-legales/__tests__/dataSources.test.tsx` | 44 |
| `src/app/clubs/[id]/page.tsx` | 43 |
| `src/app/voyages/actions.ts` | 43 |
| `src/components/compte/ClubsTab.tsx` | 43 |
| `src/app/mentions-legales/page.tsx` | 42 |
| `src/app/blog/page.tsx` | 41 |
| `src/app/materiel/page.tsx` | 41 |
| `src/app/carbone/page.tsx` | 40 |
| `src/components/map/UnifiedExplorerMap.tsx` | 40 |
| `src/app/politique-confidentialite/__tests__/privacyPolicy.test.tsx` | 39 |
| `src/app/recompenses/page.tsx` | 38 |
| `src/components/compte/AventuresTab.tsx` | 38 |
| `src/components/explorer/TrailDetailPanel.tsx` | 38 |
| `src/app/abonnements/page.tsx` | 37 |
| `src/app/evenements/page.tsx` | 37 |
| `src/app/page.tsx` | 37 |
| `src/app/mentions-legales/DataSources.tsx` | 36 |
| `src/app/voyages/kit-actions.ts` | 36 |
| `src/app/communaute/page.tsx` | 35 |
| `src/components/compte/CarnetsTab.tsx` | 34 |
| `src/components/ui/GlobalSearchModal.tsx` | 34 |
| `src/app/produit/[slug]/ProductDetailClient.tsx` | 33 |
| `src/app/robots.ts` | 33 |
| `src/components/groupes/TachesCard.tsx` | 33 |
| `src/components/map/InteractiveMap.tsx` | 32 |
| `src/app/ai-configurator/components/KitConfiguratorWizard.tsx` | 31 |
| `src/app/connexion/page.tsx` | 31 |
| `src/app/faq/page.tsx` | 31 |
| `src/app/api/adventure/generate/route.ts` | 30 |
| `src/app/voyages/budget-actions.ts` | 30 |
| `src/app/avis/page.tsx` | 28 |
| `src/app/voyages/completion-actions.ts` | 28 |
| `src/components/mobile-nav/navigation/useNavigationPlateau.ts` | 26 |
| `src/components/dev/style/StyleShowcase.tsx` | 25 |
| `src/app/kits/[slug]/KitDetailPage.tsx` | 24 |
| `src/components/clubs/ClubDiscussionCard.tsx` | 24 |
| `src/components/carnet/MobileCarnetDetailView.tsx` | 23 |
| `src/app/pro/page.tsx` | 22 |
| `src/components/pays/MobileCountryDetailView.tsx` | 22 |
| `src/components/communaute/CommunityStoriesBar.tsx` | 21 |
| `src/components/mobile-nav/destinationRegistry.ts` | 21 |
| `src/components/mobile-nav/navigation/NavigationPlateau.tsx` | 21 |
| `src/app/blog/BlogClient.tsx` | 20 |
| `src/app/feed/page.tsx` | 20 |
| `src/components/groupes/DiscussionCard.tsx` | 20 |
| `src/components/mobile-nav/navigation/__tests__/hub-adventures-drawer.test.tsx` | 20 |
| `src/components/carnets/MobileCarnetsHub.tsx` | 19 |
| `src/components/communaute/MobileCommunityHub.tsx` | 19 |
| `src/components/groupes/VoyageursCard.tsx` | 19 |
| `src/app/api/terrain/reports/route.ts` | 18 |
| `src/app/manifeste/page.tsx` | 18 |
| `src/app/panier/page.tsx` | 18 |
| `src/app/profil/[id]/page.tsx` | 18 |
| `src/components/clubs/MobileClubsHub.tsx` | 18 |
| `src/components/ui/ReportBlockModal.tsx` | 18 |
| `src/app/auth/__tests__/callback.test.ts` | 16 |
| `src/components/profile/PublicMobileProfileView.tsx` | 16 |
| `src/components/carnet/CarnetHero.tsx` | 15 |
| `src/components/clubs/ClubGroupsTab.tsx` | 15 |
| `src/components/compte/CompteLiquidGlassV8.tsx` | 15 |
| `src/app/api/adventure/[id]/group/route.ts` | 14 |
| `src/app/api/explorer/osm/routes/route.ts` | 14 |
| `src/app/contact/page.tsx` | 14 |
| `src/app/explorer/layout.tsx` | 14 |
| `src/app/pays/[code]/page.tsx` | 14 |
| `src/components/Header.tsx` | 14 |
| `src/app/api/cron/process-ai-jobs/route.ts` | 13 |
| `src/app/api/stripe/webhook/route.ts` | 13 |
| `src/app/api/terrain/conditions/route.ts` | 13 |
| `src/app/kits/page.tsx` | 13 |
| `src/app/layout.tsx` | 13 |
| `src/app/pays/layout.tsx` | 13 |
| `src/components/groupes/DecisionsCard.tsx` | 13 |
| `src/components/groupes/DepensesCard.tsx` | 13 |
| `src/components/identity/TravellerCard.tsx` | 13 |
| `src/components/progression/ProgressionCompactCard.tsx` | 13 |
| `src/app/api/adventure/[id]/trek/route.ts` | 12 |
| `src/app/api/explorer/osm/route/[id]/route.ts` | 12 |
| `src/app/api/materiel/optimize/route.ts` | 12 |
| `src/app/compte/garder-mon-essai/page.tsx` | 12 |
| `src/app/lieux/actions.ts` | 12 |
| `src/app/pays/[code]/CountryDetailClient.tsx` | 12 |
| `src/app/voyages/collab-actions.ts` | 12 |
| `src/app/voyages/document-actions.ts` | 12 |
| `src/app/voyages/poi-actions.ts` | 12 |
| `src/components/communaute/CommentItem.tsx` | 12 |
| `src/components/identity/OrientationCard.tsx` | 12 |
| `src/app/api/cron/daily/__tests__/route.test.ts` | 11 |
| `src/app/api/explorer/osm/materialize/route.ts` | 11 |
| `src/app/api/explorer/osm/pois/route.ts` | 11 |
| `src/app/api/notifications/process/route.ts` | 11 |
| `src/app/createurs/page.tsx` | 11 |
| `src/app/inscription/page.tsx` | 11 |
| `src/components/clubs/MobileClubDetailView.tsx` | 11 |
| `src/components/compte/ProchainVoyageCard.tsx` | 11 |
| `src/components/mobile-nav/MobileDrawer.tsx` | 11 |
| `src/components/pays/PaysLeftSidebar.tsx` | 11 |
| `src/components/progression/PassportSection.tsx` | 11 |
| `src/app/api/hike-sessions/[id]/narrative/route.ts` | 10 |
| `src/app/api/kit-report/convert-inventory/route.ts` | 10 |
| `src/app/boutique/page.tsx` | 10 |
| `src/components/communaute/CommunityLeftSidebar.tsx` | 10 |
| `src/components/Footer.tsx` | 10 |
| `src/components/groupes/ProgressionCard.tsx` | 10 |
| `src/app/api/terrain/reports/[id]/confirm/route.ts` | 9 |
| `src/app/copilote/page.tsx` | 9 |
| `src/app/preparer-sentier/apercu/page.tsx` | 9 |
| `src/app/preparer-sentier/[id]/page.tsx` | 9 |
| `src/components/explorer/types.ts` | 9 |
| `src/components/map/engine/poiTooltip.ts` | 9 |
| `src/components/pays/PaysHeroOverview.tsx` | 9 |
| `src/app/api/checkout/route.ts` | 8 |
| `src/app/api/hike-sessions/route.ts` | 8 |
| `src/app/api/progression/preferences/route.ts` | 8 |
| `src/app/api/progression/territory/route.ts` | 8 |
| `src/app/api/trip-assistant/route.ts` | 8 |
| `src/app/guides/page.tsx` | 8 |
| `src/app/hors-ligne/page.tsx` | 8 |
| `src/app/rejoindre/[slug]/page.tsx` | 8 |
| `src/components/compte/CommandesCard.tsx` | 8 |
| `src/components/explorer/ExplorerFilterPanel.tsx` | 8 |
| `src/components/social/CommentsSheet.tsx` | 8 |
| `src/app/api/admin/progression/simulate/route.ts` | 7 |
| `src/app/api/materiel/export/route.ts` | 7 |
| `src/app/api/progression/missions/route.ts` | 7 |
| `src/app/cookies/page.tsx` | 7 |
| `src/app/invitation/[token]/page.tsx` | 7 |
| `src/app/kits/[slug]/page.tsx` | 7 |
| `src/app/voyages/share-actions.ts` | 7 |
| `src/components/CookieConsentBanner.tsx` | 7 |
| `src/components/groupes/HeroVoyage.tsx` | 7 |
| `src/app/api/admin/orders/confirm/route.ts` | 6 |
| `src/app/api/admin/rewards/route.ts` | 6 |
| `src/app/api/adventure/[id]/select/route.ts` | 6 |
| `src/app/api/ai/jobs/route.ts` | 6 |
| `src/app/api/kit-report/generate/route.ts` | 6 |
| `src/app/api/materiel/catalog-lookup/route.ts` | 6 |
| `src/app/api/og-preview/route.ts` | 6 |
| `src/app/api/progression/answers/accept/route.ts` | 6 |
| `src/app/api/progression/leaderboard/route.ts` | 6 |
| `src/app/api/progression/route.ts` | 6 |
| `src/app/cgu/page.tsx` | 6 |
| `src/app/cgv/page.tsx` | 6 |
| `src/app/compte/modifier/page.tsx` | 6 |
| `src/app/copilote/layout.tsx` | 6 |
| `src/app/guides/[slug]/GuideDetailClient.tsx` | 6 |
| `src/components/activity/LiveActivityFeed.tsx` | 6 |
| `src/components/carnet/CarnetDetailRightSidebar.tsx` | 6 |
| `src/components/carnet/CarnetMap.tsx` | 6 |
| `src/components/carnet/CarnetView.tsx` | 6 |
| `src/components/carnet/KitSouvenirCard.tsx` | 6 |
| `src/components/carnets/CarnetVerticalTabs.tsx` | 6 |
| `src/components/compte/CompteRightSidebar.tsx` | 6 |
| `src/components/compte/HeroProfil.tsx` | 6 |
| `src/components/dev/glass/glassLabPolicy.ts` | 6 |
| `src/components/groupes/ParcoursCard.tsx` | 6 |
| `src/components/map/UnifiedCountryGlobe.tsx` | 6 |
| `src/components/mobile-nav/navigation/adventuresDrawerModel.ts` | 6 |
| `src/components/pays/PaysPratiqueView.tsx` | 6 |
| `src/components/pays/PaysRightSidebar.tsx` | 6 |
| `src/components/social/ReportSheet.tsx` | 6 |
| `src/components/ui/Icon/registry.generated.ts` | 6 |
| `src/app/api/account/delete/route.ts` | 5 |
| `src/app/api/adventure/[id]/monitoring/route.ts` | 5 |
| `src/app/api/affiliate/travelpayouts/route.ts` | 5 |
| `src/app/api/carnet/identify-species/route.ts` | 5 |
| `src/app/api/cron/process-hike-sessions/route.ts` | 5 |
| `src/app/api/kits/[id]/field-report/route.ts` | 5 |
| `src/app/api/materiel/items/route.ts` | 5 |
| `src/app/api/materiel/items/[id]/route.ts` | 5 |
| `src/app/api/materiel/kits/route.ts` | 5 |
| `src/app/api/materiel/kits/[id]/route.ts` | 5 |
| `src/app/api/materiel/scan/route.ts` | 5 |
| `src/app/api/materiel/share/route.ts` | 5 |
| `src/app/carnets/[id]/page.tsx` | 5 |
| `src/app/compte/layout.tsx` | 5 |
| `src/app/compte/voyageur/page.tsx` | 5 |
| `src/app/connexion/layout.tsx` | 5 |
| `src/app/experts/page.tsx` | 5 |
| `src/app/inscription/layout.tsx` | 5 |
| `src/app/not-found.tsx` | 5 |
| `src/components/carnet/CarnetDetailVerticalTabs.tsx` | 5 |
| `src/components/carnets/CarnetHubHero.tsx` | 5 |
| `src/components/carnets/LocalCarnetRenderer.tsx` | 5 |
| `src/components/carnets/MobileCarnetCard.tsx` | 5 |
| `src/components/clubs/MobileClubCard.tsx` | 5 |
| `src/components/compte/ActiviteCard.tsx` | 5 |
| `src/components/compte/CompteLeftSidebar.tsx` | 5 |
| `src/components/compte/MesAventuresCard.tsx` | 5 |
| `src/components/compte/TabsCompte.tsx` | 5 |
| `src/components/explorer/ExplorerMap.tsx` | 5 |
| `src/components/explorer/ExplorerMobileHikeCarousel.tsx` | 5 |
| `src/components/groupes/TabsGroupe.tsx` | 5 |
| `src/components/identity/SignatureVisibilityControl.tsx` | 5 |
| `src/components/mobile-nav/navigation/__tests__/bottom-nav-reservation.test.ts` | 5 |
| `src/components/pays/PaysActivitesView.tsx` | 5 |
| `src/components/produit/__tests__/InventoryEntryButton.test.tsx` | 5 |
| `src/components/social/CommunityHubNav.tsx` | 5 |
| `src/components/ui/__tests__/custom-cursor.test.ts` | 5 |
| `src/app/abonnements/layout.tsx` | 4 |
| `src/app/ambassadeurs/layout.tsx` | 4 |
| `src/app/api/adventure/offline/sync/route.ts` | 4 |
| `src/app/api/ai/ping/route.ts` | 4 |
| `src/app/api/cron/process-adventure-events/route.ts` | 4 |
| `src/app/api/dev/generate-country-blocks/route.ts` | 4 |
| `src/app/api/progression/discoveries/route.ts` | 4 |
| `src/app/api/progression/history/route.ts` | 4 |
| `src/app/api/progression/passport/route.ts` | 4 |
| `src/app/api/progression/suggestions/route.ts` | 4 |
| `src/app/api/rewards/claim/route.ts` | 4 |
| `src/app/api/trips/[tripId]/checklist/complete/route.ts` | 4 |
| `src/app/api/users/search/route.ts` | 4 |
| `src/app/carnets/layout.tsx` | 4 |
| `src/app/checkout/layout.tsx` | 4 |
| `src/app/communaute/layout.tsx` | 4 |
| `src/app/contact/layout.tsx` | 4 |
| `src/app/guides/[slug]/page.tsx` | 4 |
| `src/app/pro/layout.tsx` | 4 |
| `src/app/produit/[slug]/page.tsx` | 4 |
| `src/app/rejoindre/[slug]/accepter/route.ts` | 4 |
| `src/app/voyages/[slug]/not-found.tsx` | 4 |
| `src/components/carnets/CarnetHubCard.tsx` | 4 |
| `src/components/carnets/CarnetRightSidebar.tsx` | 4 |
| `src/components/clubs/ClubHero.tsx` | 4 |
| `src/components/communaute/CommunityRightSidebar.tsx` | 4 |
| `src/components/compte/CompteFooter.tsx` | 4 |
| `src/components/mobile-nav/navigation/DayPlateau.tsx` | 4 |
| `src/components/mobile-nav/navigation/__tests__/tab-item-labels.test.tsx` | 4 |
| `src/components/pays/PaysCommunauteView.tsx` | 4 |
| `src/components/pays/PaysDestinationsView.tsx` | 4 |
| `src/components/pays/PaysHebergementsView.tsx` | 4 |
| `src/components/produit/ProductBuyBar.tsx` | 4 |
| `src/components/ui/Icon/registry.ts` | 4 |
| `src/app/admin/progression/page.tsx` | 3 |
| `src/app/ambassadeurs/page.tsx` | 3 |
| `src/app/api/account/export/route.ts` | 3 |
| `src/app/api/adventure/[id]/cockpit/route.ts` | 3 |
| `src/app/api/adventure/[id]/offline-pack/route.ts` | 3 |
| `src/app/api/adventure/[id]/route.ts` | 3 |
| `src/app/api/ai/chat-completion/route.ts` | 3 |
| `src/app/api/ai/country-guide/[code]/route.ts` | 3 |
| `src/app/api/cron/expire-terrain-reports/route.ts` | 3 |
| `src/app/api/cron/progression-outbox/route.ts` | 3 |
| `src/app/api/cron/run-adventure-shadows/route.ts` | 3 |
| `src/app/api/discovery/search/route.ts` | 3 |
| `src/app/api/guides/[country]/ask/route.ts` | 3 |
| `src/app/api/hikes/[id]/route.ts` | 3 |
| `src/app/api/kits/my-royalties/route.ts` | 3 |
| `src/app/api/materiel/calendar/route.ts` | 3 |
| `src/app/api/materiel/fork/route.ts` | 3 |
| `src/app/api/progression/challenge/replace/route.ts` | 3 |
| `src/app/api/support/tickets/route.ts` | 3 |
| `src/app/api/support/tickets/[id]/route.ts` | 3 |
| `src/app/api/voyages/[slug]/gpx/route.ts` | 3 |
| `src/app/avis/layout.tsx` | 3 |
| `src/app/carbone/layout.tsx` | 3 |
| `src/app/carte-interactive/layout.tsx` | 3 |
| `src/app/communaute-pro/layout.tsx` | 3 |
| `src/app/entraide/layout.tsx` | 3 |
| `src/app/evenements/layout.tsx` | 3 |
| `src/app/faq/layout.tsx` | 3 |
| `src/app/feed/layout.tsx` | 3 |
| `src/app/fidelite/layout.tsx` | 3 |
| `src/app/go/[slug]/route.ts` | 3 |
| `src/app/guides/layout.tsx` | 3 |
| `src/app/hub/error.tsx` | 3 |
| `src/app/hub/[section]/error.tsx` | 3 |
| `src/app/k/[token]/page.tsx` | 3 |
| `src/app/lieux/page.tsx` | 3 |
| `src/app/location/layout.tsx` | 3 |
| `src/app/nouveau-groupe/layout.tsx` | 3 |
| `src/app/occasion/layout.tsx` | 3 |
| `src/app/pays/loading.tsx` | 3 |
| `src/app/publier/layout.tsx` | 3 |
| `src/app/sitemap.ts` | 3 |
| `src/app/trajectoire/page.tsx` | 3 |
| `src/app/voyages/error.tsx` | 3 |
| `src/app/voyages/[slug]/page.tsx` | 3 |
| `src/components/carnet/RandonneesSouvenirCard.tsx` | 3 |
| `src/components/carnet/SpeciesIdentifier.tsx` | 3 |
| `src/components/clubs/ClubAboutCard.tsx` | 3 |
| `src/components/clubs/ClubFeaturedEventCard.tsx` | 3 |
| `src/components/communaute/MobileCommunityHeader.tsx` | 3 |
| `src/components/compte/MesCarnetsCard.tsx` | 3 |
| `src/components/explorer/OsmPoiSheet.tsx` | 3 |
| `src/components/map/hooks/useViewportData.ts` | 3 |
| `src/components/mobile-nav/MobileNavWrapper.tsx` | 3 |
| `src/components/mobile-nav/OfflineBanner.tsx` | 3 |
| `src/components/pays/PaysGastronomieView.tsx` | 3 |
| `src/components/produit/InventoryEntryButton.tsx` | 3 |
| `src/components/WeightGauge.tsx` | 3 |
| `src/app/api/billing/entitlements/route.ts` | 2 |
| `src/app/api/carnets/[id]/publish/route.ts` | 2 |
| `src/app/api/cron/aggregate-segments/route.ts` | 2 |
| `src/app/api/cron/leaderboard-refresh/route.ts` | 2 |
| `src/app/api/cron/refresh-country-guides/route.ts` | 2 |
| `src/app/api/elevation/route.ts` | 2 |
| `src/app/api/hub/dashboard/route.ts` | 2 |
| `src/app/api/identity/signature/route.ts` | 2 |
| `src/app/api/kit-report/save/route.ts` | 2 |
| `src/app/api/kits/discovery/route.ts` | 2 |
| `src/app/api/marketplace/listings/route.ts` | 2 |
| `src/app/api/materiel/alerts/[id]/route.ts` | 2 |
| `src/app/api/materiel/items/[id]/transition/route.ts` | 2 |
| `src/app/api/materiel/kit-items/[id]/route.ts` | 2 |
| `src/app/api/materiel/kits/[id]/history/route.ts` | 2 |
| `src/app/api/materiel/loans/[id]/route.ts` | 2 |
| `src/app/api/materiel/participants/route.ts` | 2 |
| `src/app/api/materiel/search/route.ts` | 2 |
| `src/app/api/notifications/digest/route.ts` | 2 |
| `src/app/api/orders/cancel/route.ts` | 2 |
| `src/app/api/orders/route.ts` | 2 |
| `src/app/api/produit/trust-score-check/route.ts` | 2 |
| `src/app/api/rewards/withdraw/route.ts` | 2 |
| `src/app/api/route/route.ts` | 2 |
| `src/app/auth/callback/route.ts` | 2 |
| `src/app/carnets/[id]/error.tsx` | 2 |
| `src/app/carte-interactive/page.tsx` | 2 |
| `src/app/checkout/error.tsx` | 2 |
| `src/app/clubs/nouveau/page.tsx` | 2 |
| `src/app/communaute-pro/page.tsx` | 2 |
| `src/app/compte/error.tsx` | 2 |
| `src/app/connexion/nouveau-mot-de-passe/page.tsx` | 2 |
| `src/app/cookies/layout.tsx` | 2 |
| `src/app/createurs/layout.tsx` | 2 |
| `src/app/experts/layout.tsx` | 2 |
| `src/app/explorer/error.tsx` | 2 |
| `src/app/explorer/loading.tsx` | 2 |
| `src/app/explorer/page.tsx` | 2 |
| `src/app/hub/layout.tsx` | 2 |
| `src/app/lieux/[slug]/page.tsx` | 2 |
| `src/app/messagerie/layout.tsx` | 2 |
| `src/app/messagerie/page.tsx` | 2 |
| `src/app/panier/layout.tsx` | 2 |
| `src/app/politique-confidentialite/page.tsx` | 2 |
| `src/app/preparer-randonnee/layout.tsx` | 2 |
| `src/app/produit/[slug]/error.tsx` | 2 |
| `src/app/profil/layout.tsx` | 2 |
| `src/app/profil/page.tsx` | 2 |
| `src/app/randonnee-active/layout.tsx` | 2 |
| `src/app/rapport-expedition/layout.tsx` | 2 |
| `src/app/recompenses/layout.tsx` | 2 |
| `src/app/voyages/[slug]/error.tsx` | 2 |
| `src/components/carnet/MomentCard.tsx` | 2 |
| `src/components/clubs/ClubTeamCard.tsx` | 2 |
| `src/components/clubs/ClubVerticalTabs.tsx` | 2 |
| `src/components/compte/AbonnementCard.tsx` | 2 |
| `src/components/compte/BadgesCard.tsx` | 2 |
| `src/components/compte/ConstanceCard.tsx` | 2 |
| `src/components/compte/EditProfileModal.tsx` | 2 |
| `src/components/compte/StatsBandeau.tsx` | 2 |
| `src/components/compte/StatsGrid.tsx` | 2 |
| `src/components/ErrorBoundaryWrapper.tsx` | 2 |
| `src/components/identity/UserFieldSignature.tsx` | 2 |
| `src/components/kits/ProductLineageCard.tsx` | 2 |
| `src/components/map/engine/icons.ts` | 2 |
| `src/components/pays/PaysClubsList.tsx` | 2 |
| `src/components/pays/PaysCultureView.tsx` | 2 |
| `src/components/ReactQueryProvider.tsx` | 2 |
| `src/components/search/SearchOverlay.tsx` | 2 |
| `src/components/shell/AppShellDesktop.tsx` | 2 |
| `src/components/ui/EmptyState.tsx` | 2 |
| `src/components/ui/LkvIcon.tsx` | 2 |
| `src/components/ui/StepIndicator.tsx` | 2 |
| `src/app/ai-configurator/page.tsx` | 1 |
| `src/app/api/carnets/[id]/route.ts` | 1 |
| `src/app/api/cron/cleanup-ephemeral-groups/route.ts` | 1 |
| `src/app/api/cron/cleanup-solo-crews/route.ts` | 1 |
| `src/app/api/cron/expire-live-positions/route.ts` | 1 |
| `src/app/api/cron/finalize-kit-attributions/route.ts` | 1 |
| `src/app/api/cron/progression-awards/route.ts` | 1 |
| `src/app/api/cron/refresh-atlas-density/route.ts` | 1 |
| `src/app/api/cron/refresh-kit-scores/route.ts` | 1 |
| `src/app/api/csp-report/route.ts` | 1 |
| `src/app/api/hike-sessions/[id]/route.ts` | 1 |
| `src/app/api/hikes/geojson/route.ts` | 1 |
| `src/app/api/indexnow/route.ts` | 1 |
| `src/app/api/kits/[id]/sheet/route.ts` | 1 |
| `src/app/api/loyalty/earn/route.ts` | 1 |
| `src/app/api/loyalty/redeem/route.ts` | 1 |
| `src/app/api/loyalty/refund/route.ts` | 1 |
| `src/app/api/loyalty/spend/route.ts` | 1 |
| `src/app/api/marketplace/moderation/route.ts` | 1 |
| `src/app/api/marketplace/reviews/route.ts` | 1 |
| `src/app/api/notifications/subscribe/route.ts` | 1 |
| `src/app/api/notifications/vapid/route.ts` | 1 |
| `src/app/api/pays/[code]/recommendations/route.ts` | 1 |
| `src/app/api/pays/[code]/trails/route.ts` | 1 |
| `src/app/api/pays/[code]/weather/route.ts` | 1 |
| `src/app/api/voyages/route.ts` | 1 |
| `src/app/carnets/loading.tsx` | 1 |
| `src/app/communaute/loading.tsx` | 1 |
| `src/app/compas/page.tsx` | 1 |
| `src/app/compte/loading.tsx` | 1 |
| `src/app/compte/page.tsx` | 1 |
| `src/app/compte/[userId]/page.tsx` | 1 |
| `src/app/entraide/page.tsx` | 1 |
| `src/app/global-error.tsx` | 1 |
| `src/app/hub/loading.tsx` | 1 |
| `src/app/hub/page.tsx` | 1 |
| `src/app/hub/[section]/loading.tsx` | 1 |
| `src/app/hub/[section]/page.tsx` | 1 |
| `src/app/partir-librement/layout.tsx` | 1 |
| `src/app/partir-librement/page.tsx` | 1 |
| `src/app/pays/[code]/error.tsx` | 1 |
| `src/app/preparer-sentier/[id]/activer/route.ts` | 1 |
| `src/app/preparer-sentier/[id]/loading.tsx` | 1 |
| `src/app/progression/route.ts` | 1 |
| `src/app/randonnee-active/page.tsx` | 1 |
| `src/components/carnet/JourCard.tsx` | 1 |
| `src/components/communaute/StoriesViewer.tsx` | 1 |
| `src/components/compte/MesClubsCard.tsx` | 1 |
| `src/components/compte/MobileCompteV2.tsx` | 1 |
| `src/components/explorer/TrailLayer.tsx` | 1 |
| `src/components/hiking/ElevationProfileChart.tsx` | 1 |
| `src/components/legal/MarketplacePrivacyNotice.tsx` | 1 |
| `src/components/legal/MarketplaceTermsNotice.tsx` | 1 |
| `src/components/map/engine/camera.ts` | 1 |
| `src/components/mobile-nav/navigation/TabItem.tsx` | 1 |
| `src/components/mobile-nav/navigation/WebNavigationBar.tsx` | 1 |
| `src/components/pays/PaysCarnetsList.tsx` | 1 |
| `src/components/shell/AppShell.tsx` | 1 |
| `src/components/system/PresenceTracker.tsx` | 1 |
| `src/components/ui/HeaderBackButton.tsx` | 1 |
| `src/components/ui/LoadingState.tsx` | 1 |
| `src/components/ui/Modal.tsx` | 1 |
| `src/components/ui/Sheet.tsx` | 1 |
| `src/components/ui/SmartImage.tsx` | 1 |
| `src/components/ui/Spinner.tsx` | 1 |
| `src/components/ui-layouts/number-stat.tsx` | 1 |

Exemples (15 fichiers les plus denses) :

- `src/app/api/seed/route.ts`
  - L140 : « Découvreur »
  - L141 : « Découvreur »
  - L142 : « Léa Roux »
- `src/components/progression/MaProgressionView.tsx`
  - L12 : « @/features/progression/server/discoveries »
  - L20 : « @/features/progression/domain/types »
  - L31 : « progression.skill.explorer »
- `src/app/outils/[slug]/page.tsx`
  - L22 : « Vêtements »
  - L25 : « Sécurité »
  - L26 : « Électronique »
- `src/app/admin/page.tsx`
  - L14 : « progression »
  - L21 : « Catégories »
  - L24 : « Pages Pays »
- `src/app/admin/produits/AdminProductsManager.tsx`
  - L111 : « Recommandé »
  - L112 : « enchère »
  - L122 : « Équipement du sac »
- `src/app/clubs/page.tsx`
  - L9 : « @/components/compte/CompteBackground »
  - L32 : « pays »
  - L100 : « pays »
- `src/app/communaute/publier/page.tsx`
  - L39 : « image-plus »
  - L39 : « Photo / vidéo »
  - L39 : « Instantané ou galerie »
- `src/components/compte/ParametresCompteCard.tsx`
  - L10 : « @/lib/mock/compte-marceline »
  - L35 : « Randonnée & Bivouac »
  - L159 : « La taille du fichier ne doit pas dépasser 5 Mo. »
- `src/components/compte/EditProfileView.tsx`
  - L33 : « Français »
  - L34 : « Randonnée »
  - L51 : « Écrins »
- `src/components/compte/FideliteTab.tsx`
  - L7 : « @/lib/mock/compte-marceline »
  - L82 : « Gain pour Like »
  - L83 : « Gain pour Commentaire »
- `src/components/carnets/CreateCarnetView.tsx`
  - L9 : « @/components/compte/CompteBackground »
  - L11 : « @/lib/progression-award-requests »
  - L93 : « Refuge gardé »
- `src/components/clubs/CreateClubView.tsx`
  - L9 : « @/components/compte/CompteBackground »
  - L45 : « Tous niveaux bienvenus »
  - L60 : « Écrins »
- `src/app/api/pays/[code]/route.ts`
  - L105 : « saison »
  - L134 : « pays »
  - L137 : « niveau »
- `src/app/nouveau-groupe/page.tsx`
  - L11 : « @/components/compte/CompteBackground »
  - L30 : « Émeraude Sombre »
  - L42 : « Traversée de la Chartreuse (GR9) »
- `src/app/carnets/page.tsx`
  - L13 : « @/lib/progression-award-requests »
  - L19 : « @/components/compte/CompteBackground »
  - L108 : « Visible par tous »

## 5. Préparation RTL

**Règle permanente** : pour tout nouveau composant ou toute modification, utiliser les propriétés logiques Tailwind `ms-*` / `me-*` / `ps-*` / `pe-*` (et `start-*` / `end-*`) au lieu de `ml-*` / `mr-*` / `pl-*` / `pr-*` / `left-*` / `right-*`. Aucune feuille `src/styles/**` n’est modifiée par P6.

Vérification des fichiers touchés par P6 (classes physiques `ml-/mr-/pl-/pr-`) :

| Fichier P6 | Occurrences |
| --- | ---: |
| `src/app/connexion/page.tsx` | 2 |
| `src/app/compte/page.tsx` | 0 |
| `src/components/progression/MaProgressionView.tsx` | 0 |
| `src/components/compte/TabsCompte.tsx` | 0 |
| `src/components/compte/CompteLeftSidebar.tsx` | 0 |
| `src/components/mobile-nav/destinationRegistry.ts` | 0 |

Les occurrences restantes ailleurs dans le dépôt constituent une dette RTL documentée, hors périmètre P6 — à convertir lors des prochaines refontes.

## 6. Limites honnêtes

- L’expansion pseudo-localisée (+40 %) est testée au niveau des données (`tests/i18n/pseudo-localization.spec.ts`) : longueurs, parité et placeholders. Aucun rendu pixel ni mesure de troncature visuelle n’est revendiqué.
- La traduction EN ne prétend pas couvrir les 400+ composants : seules les surfaces listées en §3 sont garanties. Le reste est listé en §4.
- Certaines chaînes visibles proviennent de données serveur (titres de niveau, noms de badges, descriptions de défis, alias de classement) : elles restent en français tant que les données ne sont pas traduites.
- L’heuristique de détection (§1) sous-estime probablement le volume réel (chaînes sans accent ni mot-clé) et peut surévaluer certains fichiers (libellés techniques).
- Aucun audit de rendu réel (390×844, 430×932, etc.) n’a été exécuté pour P6 : le test de pseudo-localisation est un test de données, pas un test visuel.
