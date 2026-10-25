# Rapport de couverture i18n — P6

Généré le 2026-09-20 par `node scripts/i18n/coverage.mjs`.

## 1. Portée et méthode

- **FR reste la langue source.** L'anglais ne couvre que les surfaces listées en §3 ; les autres composants restent en français.
- Dossiers scannés : `src/app`, `src/components` (fichiers `.ts`/`.tsx`).
- Heuristique : segments JSX texte et littéraux de chaînes contenant un caractère accentué ou un mot français courant. Faux positifs/négatifs possibles (chaînes courtes sans accent non détectées).

## 2. Chiffres clés

- Fichiers scannés : **668**
- Fichiers contenant au moins un segment français évident : **459**
- Segments français détectés : **5535**
- Clés du dictionnaire FR : **198** — clés EN : **198** — parité FR/EN : **oui**

| Section | Clés |
| --- | ---: |
| accessibility | 2 |
| account | 17 |
| auth | 46 |
| common | 15 |
| crews | 6 |
| nav | 5 |
| navigation | 6 |
| progression | 91 |
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

**459 fichiers sur 668** contiennent encore des chaînes françaises évidentes. Liste complète (triée par volume) :

| Fichier | Segments |
| --- | ---: |
| `src/app/api/seed/route.ts` | 154 |
| `src/app/outils/[slug]/page.tsx` | 138 |
| `src/components/progression/MaProgressionView.tsx` | 111 |
| `src/app/admin/produits/AdminProductsManager.tsx` | 106 |
| `src/app/admin/page.tsx` | 102 |
| `src/app/clubs/page.tsx` | 95 |
| `src/app/communaute/publier/page.tsx` | 78 |
| `src/components/compte/ParametresCompteCard.tsx` | 74 |
| `src/app/api/pays/[code]/route.ts` | 67 |
| `src/components/clubs/CreateClubView.tsx` | 67 |
| `src/components/compte/FideliteTab.tsx` | 67 |
| `src/components/compte/MobileCompteV2.tsx` | 65 |
| `src/app/nouveau-groupe/page.tsx` | 64 |
| `src/components/compte/EditProfileView.tsx` | 62 |
| `src/app/carnets/page.tsx` | 59 |
| `src/components/carnets/CreateCarnetView.tsx` | 59 |
| `src/components/compte/CommandesTab.tsx` | 56 |
| `src/app/occasion/page.tsx` | 54 |
| `src/components/pays/BouteilleALaMer.tsx` | 51 |
| `src/app/ai-configurator/components/ConfiguratorWizard.tsx` | 50 |
| `src/components/groupes/MobileGroupesV2.tsx` | 50 |
| `src/components/OccasionProductZone.tsx` | 50 |
| `src/app/location/page.tsx` | 49 |
| `src/components/mobile-nav/BottomTabBar.tsx` | 48 |
| `src/app/outils/page.tsx` | 46 |
| `src/components/groupes/EquipementCard.tsx` | 46 |
| `src/app/fidelite/page.tsx` | 45 |
| `src/app/outils/[slug]/layout.tsx` | 45 |
| `src/components/dev/glass/GlassLab.tsx` | 45 |
| `src/components/compte/ClubsTab.tsx` | 44 |
| `src/app/rapport-expedition/page.tsx` | 43 |
| `src/app/voyages/actions.ts` | 43 |
| `src/app/cgu/page.tsx` | 42 |
| `src/components/communaute/CommunityPostCard.tsx` | 42 |
| `src/app/blog/page.tsx` | 41 |
| `src/app/checkout/page.tsx` | 41 |
| `src/app/mentions-legales/page.tsx` | 40 |
| `src/components/explorer/ExplorerClient.tsx` | 40 |
| `src/app/abonnements/page.tsx` | 38 |
| `src/app/politique-confidentialite/page.tsx` | 38 |
| `src/app/recompenses/page.tsx` | 38 |
| `src/app/carbone/page.tsx` | 36 |
| `src/app/cgv/page.tsx` | 36 |
| `src/app/materiel/page.tsx` | 36 |
| `src/app/page.tsx` | 36 |
| `src/app/voyages/kit-actions.ts` | 36 |
| `src/components/map/UnifiedExplorerMap.tsx` | 36 |
| `src/app/clubs/[id]/page.tsx` | 35 |
| `src/app/compte/page.tsx` | 34 |
| `src/app/evenements/page.tsx` | 34 |
| `src/components/compte/AventuresTab.tsx` | 34 |
| `src/components/NewProductZone.tsx` | 34 |
| `src/components/ui/GlobalSearchModal.tsx` | 34 |
| `src/app/communaute/page.tsx` | 33 |
| `src/app/faq/page.tsx` | 33 |
| `src/app/robots.ts` | 33 |
| `src/components/groupes/TachesCard.tsx` | 33 |
| `src/components/compte/CarnetsTab.tsx` | 32 |
| `src/components/map/InteractiveMap.tsx` | 32 |
| `src/app/api/adventure/generate/route.ts` | 30 |
| `src/app/cookies/page.tsx` | 30 |
| `src/app/voyages/budget-actions.ts` | 30 |
| `src/app/inscription/page.tsx` | 29 |
| `src/app/ai-configurator/components/KitConfiguratorWizard.tsx` | 28 |
| `src/app/voyages/completion-actions.ts` | 28 |
| `src/app/connexion/page.tsx` | 26 |
| `src/app/feed/page.tsx` | 26 |
| `src/app/produit/[slug]/ProductDetailClient.tsx` | 26 |
| `src/app/avis/page.tsx` | 25 |
| `src/app/contact/page.tsx` | 25 |
| `src/components/dev/style/StyleShowcase.tsx` | 25 |
| `src/app/kits/[slug]/KitDetailPage.tsx` | 23 |
| `src/components/carnet/MobileCarnetDetailView.tsx` | 22 |
| `src/components/clubs/ClubDiscussionCard.tsx` | 22 |
| `src/components/groupes/VoyageursCard.tsx` | 22 |
| `src/components/pays/MobileCountryDetailView.tsx` | 22 |
| `src/app/pro/page.tsx` | 21 |
| `src/components/ui/ProductCard.tsx` | 21 |
| `src/components/carnets/MobileCarnetsHub.tsx` | 20 |
| `src/components/communaute/MobileCommunityHub.tsx` | 20 |
| `src/components/mobile-nav/destinationRegistry.ts` | 20 |
| `src/app/blog/BlogClient.tsx` | 19 |
| `src/components/clubs/MobileClubsHub.tsx` | 19 |
| `src/components/groupes/MobileGroupesHub.tsx` | 19 |
| `src/app/api/terrain/reports/route.ts` | 18 |
| `src/app/manifeste/page.tsx` | 18 |
| `src/app/preparer-randonnee/components/MobilePreparationView.tsx` | 18 |
| `src/components/groupes/DepensesCard.tsx` | 18 |
| `src/components/mobile-nav/MobileProfilePage.tsx` | 18 |
| `src/components/ui/ReportBlockModal.tsx` | 18 |
| `src/app/components/home/HomepagePressTestimonialsSection.tsx` | 16 |
| `src/app/preparer-randonnee/components/DesktopPreparationView.tsx` | 16 |
| `src/app/profil/[id]/page.tsx` | 16 |
| `src/components/groupes/DecisionsCard.tsx` | 16 |
| `src/components/groupes/DiscussionCard.tsx` | 16 |
| `src/app/panier/page.tsx` | 15 |
| `src/components/carnet/CarnetHero.tsx` | 15 |
| `src/app/api/adventure/[id]/group/route.ts` | 14 |
| `src/app/explorer/layout.tsx` | 14 |
| `src/app/pays/[code]/page.tsx` | 14 |
| `src/components/Header.tsx` | 14 |
| `src/app/api/cron/process-ai-jobs/route.ts` | 13 |
| `src/app/api/terrain/conditions/route.ts` | 13 |
| `src/app/kits/page.tsx` | 13 |
| `src/app/layout.tsx` | 13 |
| `src/app/pays/layout.tsx` | 13 |
| `src/components/communaute/CommentItem.tsx` | 13 |
| `src/components/explorer/TrailDetailPanel.tsx` | 13 |
| `src/app/api/adventure/[id]/trek/route.ts` | 12 |
| `src/app/api/materiel/optimize/route.ts` | 12 |
| `src/app/components/home/HomepageDestinationsSection.tsx` | 12 |
| `src/app/lieux/actions.ts` | 12 |
| `src/app/pays/[code]/CountryDetailClient.tsx` | 12 |
| `src/app/voyages/collab-actions.ts` | 12 |
| `src/app/voyages/document-actions.ts` | 12 |
| `src/app/voyages/poi-actions.ts` | 12 |
| `src/components/carnet/CarnetFooter.tsx` | 12 |
| `src/components/communaute/EventDetailModal.tsx` | 12 |
| `src/components/home/BentoGrid.tsx` | 12 |
| `src/components/identity/OrientationCard.tsx` | 12 |
| `src/components/communaute/CommunityLeftSidebar.tsx` | 11 |
| `src/components/compte/ProchainVoyageCard.tsx` | 11 |
| `src/components/home/QuickStartQuiz.tsx` | 11 |
| `src/components/mobile-nav/MobileDrawer.tsx` | 11 |
| `src/components/pays/PaysLeftSidebar.tsx` | 11 |
| `src/app/api/hike-sessions/[id]/narrative/route.ts` | 10 |
| `src/app/api/kit-report/convert-inventory/route.ts` | 10 |
| `src/app/api/notifications/process/route.ts` | 10 |
| `src/app/api/stripe/webhook/route.ts` | 10 |
| `src/app/boutique/page.tsx` | 10 |
| `src/app/createurs/page.tsx` | 10 |
| `src/components/clubs/ClubGroupsTab.tsx` | 10 |
| `src/components/Footer.tsx` | 10 |
| `src/components/groupes/ProgressionCard.tsx` | 10 |
| `src/components/profile/PublicMobileProfileView.tsx` | 10 |
| `src/components/social/CommentsSheet.tsx` | 10 |
| `src/app/api/terrain/reports/[id]/confirm/route.ts` | 9 |
| `src/app/components/home/HomepageFAQSection.tsx` | 9 |
| `src/app/preparer-sentier/[id]/page.tsx` | 9 |
| `src/app/progression/page.tsx` | 9 |
| `src/components/carnet/GroupeToCarnetCTA.tsx` | 9 |
| `src/components/explorer/ExplorerFilterPanel.tsx` | 9 |
| `src/components/pays/PaysHeroOverview.tsx` | 9 |
| `src/app/api/checkout/route.ts` | 8 |
| `src/app/api/hike-sessions/route.ts` | 8 |
| `src/app/api/trip-assistant/route.ts` | 8 |
| `src/app/components/home/HomepageHeroSection.tsx` | 8 |
| `src/app/components/home/HomepageHowItWorksSection.tsx` | 8 |
| `src/app/copilote/page.tsx` | 8 |
| `src/app/guides/page.tsx` | 8 |
| `src/app/rejoindre/[slug]/page.tsx` | 8 |
| `src/components/carnet/CarnetDetailRightSidebar.tsx` | 8 |
| `src/components/clubs/MobileClubDetailView.tsx` | 8 |
| `src/components/compte/CommandesCard.tsx` | 8 |
| `src/components/groupes/MobileGroupeView.tsx` | 8 |
| `src/app/api/materiel/export/route.ts` | 7 |
| `src/app/api/og-preview/route.ts` | 7 |
| `src/app/api/progression/territory/route.ts` | 7 |
| `src/app/components/home/HomepageAIDemoSection.tsx` | 7 |
| `src/app/kits/[slug]/page.tsx` | 7 |
| `src/app/not-found.tsx` | 7 |
| `src/app/preparer-randonnee/PreparationClient.tsx` | 7 |
| `src/app/preparer-sentier/apercu/page.tsx` | 7 |
| `src/app/voyages/share-actions.ts` | 7 |
| `src/components/carnet/CarnetMap.tsx` | 7 |
| `src/components/CookieConsentBanner.tsx` | 7 |
| `src/components/groupes/HeroVoyage.tsx` | 7 |
| `src/components/home/TrustCounters.tsx` | 7 |
| `src/components/PrefetchRoutes.tsx` | 7 |
| `src/components/progression/ProgressionCompactCard.tsx` | 7 |
| `src/app/api/admin/rewards/route.ts` | 6 |
| `src/app/api/adventure/[id]/select/route.ts` | 6 |
| `src/app/api/ai/jobs/route.ts` | 6 |
| `src/app/api/kit-report/generate/route.ts` | 6 |
| `src/app/api/kits/[id]/field-report/route.ts` | 6 |
| `src/app/copilote/layout.tsx` | 6 |
| `src/components/activity/LiveActivityFeed.tsx` | 6 |
| `src/components/carnet/CarnetView.tsx` | 6 |
| `src/components/carnet/KitSouvenirCard.tsx` | 6 |
| `src/components/carnets/CarnetVerticalTabs.tsx` | 6 |
| `src/components/compte/CompteLeftSidebar.tsx` | 6 |
| `src/components/compte/CompteRightSidebar.tsx` | 6 |
| `src/components/compte/HeroProfil.tsx` | 6 |
| `src/components/compte/ProfileStats.tsx` | 6 |
| `src/components/dev/glass/glassLabPolicy.ts` | 6 |
| `src/components/groupes/ParcoursCard.tsx` | 6 |
| `src/components/groupes/SafetyReminderCard.tsx` | 6 |
| `src/components/pays/PaysPratiqueView.tsx` | 6 |
| `src/components/pays/PaysRightSidebar.tsx` | 6 |
| `src/components/social/ReportSheet.tsx` | 6 |
| `src/components/ui/Icon/registry.generated.ts` | 6 |
| `src/components/ui/MediaUpload.tsx` | 6 |
| `src/app/api/account/delete/route.ts` | 5 |
| `src/app/api/adventure/[id]/monitoring/route.ts` | 5 |
| `src/app/api/affiliate/travelpayouts/route.ts` | 5 |
| `src/app/api/carnet/identify-species/route.ts` | 5 |
| `src/app/api/cron/process-hike-sessions/route.ts` | 5 |
| `src/app/api/materiel/items/route.ts` | 5 |
| `src/app/api/materiel/items/[id]/route.ts` | 5 |
| `src/app/api/materiel/kits/route.ts` | 5 |
| `src/app/api/materiel/kits/[id]/route.ts` | 5 |
| `src/app/api/materiel/scan/route.ts` | 5 |
| `src/app/api/materiel/share/route.ts` | 5 |
| `src/app/api/progression/leaderboard/route.ts` | 5 |
| `src/app/carnets/[id]/page.tsx` | 5 |
| `src/app/components/home/HomepageFeaturedProductsSection.tsx` | 5 |
| `src/app/components/home/HomepageFinalCTASection.tsx` | 5 |
| `src/app/compte/layout.tsx` | 5 |
| `src/app/compte/modifier/page.tsx` | 5 |
| `src/app/connexion/layout.tsx` | 5 |
| `src/app/entraide/page.tsx` | 5 |
| `src/app/hors-ligne/page.tsx` | 5 |
| `src/app/hub/nouveau/page.tsx` | 5 |
| `src/app/inscription/layout.tsx` | 5 |
| `src/app/preparer-randonnee/components/EquipmentUnifiedList.tsx` | 5 |
| `src/app/preparer-randonnee/components/PreparationSafety.tsx` | 5 |
| `src/components/carnet/CarnetDetailVerticalTabs.tsx` | 5 |
| `src/components/carnet/HikeTimeline.tsx` | 5 |
| `src/components/carnets/CarnetHubHero.tsx` | 5 |
| `src/components/carnets/CarnetRightSidebar.tsx` | 5 |
| `src/components/carnets/MobileCarnetCard.tsx` | 5 |
| `src/components/clubs/MobileClubCard.tsx` | 5 |
| `src/components/communaute/CommunityStoriesBar.tsx` | 5 |
| `src/components/compte/tabs/TabActivite.tsx` | 5 |
| `src/components/explorer/ExplorerMobileHikeCarousel.tsx` | 5 |
| `src/components/groupes/TabsGroupe.tsx` | 5 |
| `src/components/home/FinalCTA.tsx` | 5 |
| `src/components/home/Hero.tsx` | 5 |
| `src/components/home/QuickGrid.tsx` | 5 |
| `src/components/identity/SignatureVisibilityControl.tsx` | 5 |
| `src/components/map/UnifiedCountryGlobe.tsx` | 5 |
| `src/components/pays/PaysActivitesView.tsx` | 5 |
| `src/components/search/SearchOverlay.tsx` | 5 |
| `src/components/social/CommunityHubNav.tsx` | 5 |
| `src/app/abonnements/layout.tsx` | 4 |
| `src/app/ai-configurator/page.tsx` | 4 |
| `src/app/ambassadeurs/layout.tsx` | 4 |
| `src/app/api/adventure/offline/sync/route.ts` | 4 |
| `src/app/api/ai/ping/route.ts` | 4 |
| `src/app/api/cron/process-adventure-events/route.ts` | 4 |
| `src/app/api/dev/generate-country-blocks/route.ts` | 4 |
| `src/app/api/progression/route.ts` | 4 |
| `src/app/api/rewards/claim/route.ts` | 4 |
| `src/app/api/trips/[id]/checklist/complete/route.ts` | 4 |
| `src/app/carnets/layout.tsx` | 4 |
| `src/app/checkout/layout.tsx` | 4 |
| `src/app/communaute/layout.tsx` | 4 |
| `src/app/communaute-pro/page.tsx` | 4 |
| `src/app/components/home/HomepageSocialProofSection.tsx` | 4 |
| `src/app/contact/layout.tsx` | 4 |
| `src/app/experts/page.tsx` | 4 |
| `src/app/guides/[slug]/GuideDetailClient.tsx` | 4 |
| `src/app/guides/[slug]/page.tsx` | 4 |
| `src/app/preparer-randonnee/components/PreparationScore.tsx` | 4 |
| `src/app/preparer-randonnee/components/StartDock.tsx` | 4 |
| `src/app/pro/layout.tsx` | 4 |
| `src/app/produit/[slug]/page.tsx` | 4 |
| `src/app/rejoindre/[slug]/accepter/route.ts` | 4 |
| `src/components/carnets/CarnetHubCard.tsx` | 4 |
| `src/components/carnets/LocalCarnetRenderer.tsx` | 4 |
| `src/components/clubs/ClubHero.tsx` | 4 |
| `src/components/communaute/MobileCommunityHeader.tsx` | 4 |
| `src/components/compte/ActiviteCard.tsx` | 4 |
| `src/components/compte/CompteFooter.tsx` | 4 |
| `src/components/compte/MesAventuresCard.tsx` | 4 |
| `src/components/compte/ProfileHeader.tsx` | 4 |
| `src/components/compte/ProfileTabs.tsx` | 4 |
| `src/components/compte/tabs/TabCarnets.tsx` | 4 |
| `src/components/compte/tabs/TabVoyages.tsx` | 4 |
| `src/components/compte/TabsCompte.tsx` | 4 |
| `src/components/explorer/ExplorerMap.tsx` | 4 |
| `src/components/explorer/ExplorerMobileSheet.tsx` | 4 |
| `src/components/groupes/ActiviteCard.tsx` | 4 |
| `src/components/groupes/AProposCard.tsx` | 4 |
| `src/components/home/TrailOfTheDay.tsx` | 4 |
| `src/components/pays/PaysCommunauteView.tsx` | 4 |
| `src/components/pays/PaysDestinationsView.tsx` | 4 |
| `src/components/pays/PaysHebergementsView.tsx` | 4 |
| `src/components/produit/ProductBuyBar.tsx` | 4 |
| `src/components/profile/HikingProfileCard.tsx` | 4 |
| `src/components/social/PostCard.tsx` | 4 |
| `src/components/social/ShareSheet.tsx` | 4 |
| `src/components/terrain/TerrainHub.tsx` | 4 |
| `src/components/ui/Icon/registry.ts` | 4 |
| `src/components/ui/StartDistanceModal.tsx` | 4 |
| `src/app/ambassadeurs/page.tsx` | 3 |
| `src/app/api/account/export/route.ts` | 3 |
| `src/app/api/adventure/[id]/cockpit/route.ts` | 3 |
| `src/app/api/adventure/[id]/offline-pack/route.ts` | 3 |
| `src/app/api/adventure/[id]/route.ts` | 3 |
| `src/app/api/ai/chat-completion/route.ts` | 3 |
| `src/app/api/ai/country-guide/[code]/route.ts` | 3 |
| `src/app/api/cron/expire-terrain-reports/route.ts` | 3 |
| `src/app/api/cron/run-adventure-shadows/route.ts` | 3 |
| `src/app/api/discovery/search/route.ts` | 3 |
| `src/app/api/guides/[country]/ask/route.ts` | 3 |
| `src/app/api/hikes/[id]/route.ts` | 3 |
| `src/app/api/kits/my-royalties/route.ts` | 3 |
| `src/app/api/materiel/calendar/route.ts` | 3 |
| `src/app/api/materiel/fork/route.ts` | 3 |
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
| `src/app/k/[token]/page.tsx` | 3 |
| `src/app/lieux/page.tsx` | 3 |
| `src/app/location/layout.tsx` | 3 |
| `src/app/messagerie/page.tsx` | 3 |
| `src/app/nouveau-groupe/layout.tsx` | 3 |
| `src/app/occasion/layout.tsx` | 3 |
| `src/app/preparer-randonnee/components/EquipmentGearItem.tsx` | 3 |
| `src/app/preparer-randonnee/components/PreparationIcons.tsx` | 3 |
| `src/app/publier/layout.tsx` | 3 |
| `src/app/sitemap.ts` | 3 |
| `src/app/voyages/[slug]/page.tsx` | 3 |
| `src/components/carnet/SpeciesIdentifier.tsx` | 3 |
| `src/components/clubs/ClubAboutCard.tsx` | 3 |
| `src/components/communaute/CommunityRightSidebar.tsx` | 3 |
| `src/components/compte/MesCarnetsCard.tsx` | 3 |
| `src/components/explorer/types.ts` | 3 |
| `src/components/groupes/MobileGroupCard.tsx` | 3 |
| `src/components/map/hooks/useViewportData.ts` | 3 |
| `src/components/mobile-nav/InstallPrompt.tsx` | 3 |
| `src/components/mobile-nav/OfflineBanner.tsx` | 3 |
| `src/components/pays/PaysGastronomieView.tsx` | 3 |
| `src/components/ui/EmptyState.tsx` | 3 |
| `src/components/WeightGauge.tsx` | 3 |
| `src/app/api/billing/entitlements/route.ts` | 2 |
| `src/app/api/carnets/[id]/publish/route.ts` | 2 |
| `src/app/api/cron/aggregate-segments/route.ts` | 2 |
| `src/app/api/cron/leaderboard-refresh/route.ts` | 2 |
| `src/app/api/cron/progression-outbox/route.ts` | 2 |
| `src/app/api/cron/refresh-country-guides/route.ts` | 2 |
| `src/app/api/hub/dashboard/route.ts` | 2 |
| `src/app/api/identity/signature/route.ts` | 2 |
| `src/app/api/kit-report/save/route.ts` | 2 |
| `src/app/api/kits/discovery/route.ts` | 2 |
| `src/app/api/materiel/alerts/[id]/route.ts` | 2 |
| `src/app/api/materiel/kit-items/[id]/route.ts` | 2 |
| `src/app/api/materiel/kits/[id]/history/route.ts` | 2 |
| `src/app/api/materiel/loans/[id]/route.ts` | 2 |
| `src/app/api/materiel/participants/route.ts` | 2 |
| `src/app/api/materiel/search/route.ts` | 2 |
| `src/app/api/notifications/digest/route.ts` | 2 |
| `src/app/api/produit/trust-score-check/route.ts` | 2 |
| `src/app/api/progression/challenge/replace/route.ts` | 2 |
| `src/app/api/rewards/withdraw/route.ts` | 2 |
| `src/app/auth/callback/route.ts` | 2 |
| `src/app/carte-interactive/page.tsx` | 2 |
| `src/app/clubs/nouveau/page.tsx` | 2 |
| `src/app/compte/error.tsx` | 2 |
| `src/app/cookies/layout.tsx` | 2 |
| `src/app/createurs/layout.tsx` | 2 |
| `src/app/experts/layout.tsx` | 2 |
| `src/app/explorer/loading.tsx` | 2 |
| `src/app/explorer/page.tsx` | 2 |
| `src/app/global-error.tsx` | 2 |
| `src/app/hub/layout.tsx` | 2 |
| `src/app/lieux/[slug]/page.tsx` | 2 |
| `src/app/messagerie/layout.tsx` | 2 |
| `src/app/panier/layout.tsx` | 2 |
| `src/app/pays/loading.tsx` | 2 |
| `src/app/preparer-randonnee/components/PreparationHero.tsx` | 2 |
| `src/app/preparer-randonnee/layout.tsx` | 2 |
| `src/app/profil/layout.tsx` | 2 |
| `src/app/profil/page.tsx` | 2 |
| `src/app/randonnee-active/layout.tsx` | 2 |
| `src/app/rapport-expedition/layout.tsx` | 2 |
| `src/app/recompenses/layout.tsx` | 2 |
| `src/components/carnet/RandonneesSouvenirCard.tsx` | 2 |
| `src/components/clubs/ClubFeaturedEventCard.tsx` | 2 |
| `src/components/clubs/ClubTeamCard.tsx` | 2 |
| `src/components/clubs/ClubVerticalTabs.tsx` | 2 |
| `src/components/compte/AbonnementCard.tsx` | 2 |
| `src/components/compte/BadgesCard.tsx` | 2 |
| `src/components/compte/ConstanceCard.tsx` | 2 |
| `src/components/compte/EditProfileModal.tsx` | 2 |
| `src/components/compte/StatsBandeau.tsx` | 2 |
| `src/components/compte/StatsGrid.tsx` | 2 |
| `src/components/compte/tabs/TabEquipement.tsx` | 2 |
| `src/components/ErrorBoundary.tsx` | 2 |
| `src/components/ErrorBoundaryWrapper.tsx` | 2 |
| `src/components/groupes/CarnetCTACard.tsx` | 2 |
| `src/components/groupes/CountdownCard.tsx` | 2 |
| `src/components/home/HomeHeroSection.tsx` | 2 |
| `src/components/identity/UserFieldSignature.tsx` | 2 |
| `src/components/kits/ProductLineageCard.tsx` | 2 |
| `src/components/map/engine/icons.ts` | 2 |
| `src/components/pays/PaysClubsList.tsx` | 2 |
| `src/components/pays/PaysCultureView.tsx` | 2 |
| `src/components/shell/AppShell.tsx` | 2 |
| `src/components/shell/AppShellDesktop.tsx` | 2 |
| `src/components/social/SocialActions.tsx` | 2 |
| `src/components/ui/BackButton.tsx` | 2 |
| `src/components/ui/GlassCommand.tsx` | 2 |
| `src/components/ui/LkvIcon.tsx` | 2 |
| `src/app/api/carnets/[id]/route.ts` | 1 |
| `src/app/api/cron/cleanup-ephemeral-groups/route.ts` | 1 |
| `src/app/api/cron/cleanup-solo-crews/route.ts` | 1 |
| `src/app/api/cron/expire-live-positions/route.ts` | 1 |
| `src/app/api/cron/finalize-kit-attributions/route.ts` | 1 |
| `src/app/api/cron/refresh-atlas-density/route.ts` | 1 |
| `src/app/api/cron/refresh-kit-scores/route.ts` | 1 |
| `src/app/api/hike-sessions/[id]/route.ts` | 1 |
| `src/app/api/hikes/geojson/route.ts` | 1 |
| `src/app/api/indexnow/route.ts` | 1 |
| `src/app/api/kits/[id]/sheet/route.ts` | 1 |
| `src/app/api/notifications/subscribe/route.ts` | 1 |
| `src/app/api/notifications/vapid/route.ts` | 1 |
| `src/app/api/pays/[code]/recommendations/route.ts` | 1 |
| `src/app/api/pays/[code]/trails/route.ts` | 1 |
| `src/app/api/pays/[code]/weather/route.ts` | 1 |
| `src/app/api/voyages/route.ts` | 1 |
| `src/app/carnets/loading.tsx` | 1 |
| `src/app/checkout/error.tsx` | 1 |
| `src/app/communaute/error.tsx` | 1 |
| `src/app/communaute/loading.tsx` | 1 |
| `src/app/compte/loading.tsx` | 1 |
| `src/app/compte/[userId]/page.tsx` | 1 |
| `src/app/explorer/error.tsx` | 1 |
| `src/app/hub/error.tsx` | 1 |
| `src/app/hub/loading.tsx` | 1 |
| `src/app/hub/page.tsx` | 1 |
| `src/app/hub/[section]/error.tsx` | 1 |
| `src/app/hub/[section]/loading.tsx` | 1 |
| `src/app/hub/[section]/page.tsx` | 1 |
| `src/app/pays/[code]/error.tsx` | 1 |
| `src/app/preparer-randonnee/components/PreparationConditions.tsx` | 1 |
| `src/app/preparer-sentier/[id]/activer/route.ts` | 1 |
| `src/app/preparer-sentier/[id]/loading.tsx` | 1 |
| `src/app/produit/[slug]/error.tsx` | 1 |
| `src/app/randonnee-active/page.tsx` | 1 |
| `src/app/voyages/[slug]/not-found.tsx` | 1 |
| `src/components/carnet/JourCard.tsx` | 1 |
| `src/components/carnet/MomentCard.tsx` | 1 |
| `src/components/clubs/ClubProCard.tsx` | 1 |
| `src/components/compte/MesClubsCard.tsx` | 1 |
| `src/components/explorer/TrailLayer.tsx` | 1 |
| `src/components/hiking/ElevationProfileChart.tsx` | 1 |
| `src/components/home/EditorialCard.tsx` | 1 |
| `src/components/home/HeroMapBackground.tsx` | 1 |
| `src/components/home/StatsRow.tsx` | 1 |
| `src/components/home/StripCTA.tsx` | 1 |
| `src/components/icons/index.ts` | 1 |
| `src/components/mobile-nav/MobileHomePage.tsx` | 1 |
| `src/components/pays/PaysCarnetsList.tsx` | 1 |
| `src/components/social/MoreMenuSheet.tsx` | 1 |
| `src/components/ui/GlassSheet.tsx` | 1 |
| `src/components/ui/LkvButton.tsx` | 1 |
| `src/components/ui/SmartImage.tsx` | 1 |
| `src/components/ui-layouts/number-stat.tsx` | 1 |

Exemples (15 fichiers les plus denses) :

- `src/app/api/seed/route.ts`
  - L140 : « Découvreur »
  - L141 : « Découvreur »
  - L142 : « Léa Roux »
- `src/app/outils/[slug]/page.tsx`
  - L22 : « Vêtements »
  - L25 : « Sécurité »
  - L26 : « Électronique »
- `src/components/progression/MaProgressionView.tsx`
  - L17 : « @/features/progression/domain/types »
  - L27 : « progression.skill.explorer »
  - L28 : « progression.skill.preparer »
- `src/app/admin/produits/AdminProductsManager.tsx`
  - L110 : « Recommandé »
  - L111 : « enchère »
  - L121 : « Équipement du sac »
- `src/app/admin/page.tsx`
  - L20 : « Catégories »
  - L23 : « Pages Pays »
  - L27 : « Modération »
- `src/app/clubs/page.tsx`
  - L9 : « @/components/compte/CompteBackground »
  - L20 : « pays »
  - L88 : « pays »
- `src/app/communaute/publier/page.tsx`
  - L45 : « Récit dans ${initialClubName} »
  - L161 : « La géolocalisation n\'est pas supportée par votre navigateur. »
  - L169 : « 📍 GPS (${lat}, ${lng}) · Position détectée »
- `src/components/compte/ParametresCompteCard.tsx`
  - L8 : « @/lib/mock/compte-marceline »
  - L33 : « Randonnée & Bivouac »
  - L155 : « La taille du fichier ne doit pas dépasser 5 Mo. »
- `src/app/api/pays/[code]/route.ts`
  - L104 : « saison »
  - L133 : « pays »
  - L136 : « niveau »
- `src/components/clubs/CreateClubView.tsx`
  - L10 : « @/components/compte/CompteBackground »
  - L36 : « Tous niveaux bienvenus »
  - L51 : « Écrins »
- `src/components/compte/FideliteTab.tsx`
  - L6 : « @/lib/mock/compte-marceline »
  - L81 : « Gain pour Like »
  - L82 : « Gain pour Commentaire »
- `src/components/compte/MobileCompteV2.tsx`
  - L13 : « @/features/progression/domain/rules »
  - L62 : « voyages »
  - L72 : « Maître »
- `src/app/nouveau-groupe/page.tsx`
  - L10 : « @/components/compte/CompteBackground »
  - L18 : « Émeraude Sombre »
  - L30 : « Traversée de la Chartreuse (GR9) »
- `src/components/compte/EditProfileView.tsx`
  - L30 : « Français »
  - L31 : « Randonnée »
  - L48 : « Écrins »
- `src/app/carnets/page.tsx`
  - L16 : « @/lib/progression-award-requests »
  - L22 : « @/components/compte/CompteBackground »
  - L100 : « Visible par tous »

## 5. Préparation RTL

**Règle permanente** : pour tout nouveau composant ou toute modification, utiliser les propriétés logiques Tailwind `ms-*` / `me-*` / `ps-*` / `pe-*` (et `start-*` / `end-*`) au lieu de `ml-*` / `mr-*` / `pl-*` / `pr-*` / `left-*` / `right-*`. Aucune feuille `src/styles/**` n’est modifiée par P6.

Vérification des fichiers touchés par P6 (classes physiques `ml-/mr-/pl-/pr-`) :

| Fichier P6 | Occurrences |
| --- | ---: |
| `src/app/connexion/page.tsx` | 0 |
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
