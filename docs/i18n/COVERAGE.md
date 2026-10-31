# Rapport de couverture i18n — P6

Généré le 2026-10-31 par `node scripts/i18n/coverage.mjs`.

## 1. Portée et méthode

- **FR reste la langue source.** L'anglais ne couvre que les surfaces listées en §3 ; les autres composants restent en français.
- Dossiers scannés : `src/app`, `src/components` (fichiers `.ts`/`.tsx`).
- Heuristique : segments JSX texte et littéraux de chaînes contenant un caractère accentué ou un mot français courant. Faux positifs/négatifs possibles (chaînes courtes sans accent non détectées).

## 2. Chiffres clés

- Fichiers scannés : **744**
- Fichiers contenant au moins un segment français évident : **529**
- Segments français détectés : **5813**
- Clés du dictionnaire FR : **250** — clés EN : **250** — parité FR/EN : **oui**

| Section | Clés |
| --- | ---: |
| accessibility | 2 |
| account | 17 |
| affiliation | 11 |
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

**529 fichiers sur 744** contiennent encore des chaînes françaises évidentes. Liste complète (triée par volume) :

| Fichier | Segments |
| --- | ---: |
| `src/components/clubs/ClubLiquidGlassV8.tsx` | 196 |
| `src/components/progression/MaProgressionView.tsx` | 157 |
| `src/app/api/seed/route.ts` | 154 |
| `src/app/admin/page.tsx` | 110 |
| `src/app/admin/produits/AdminProductsManager.tsx` | 108 |
| `src/components/clubs/drawer/ClubDrawerHost.tsx` | 91 |
| `src/components/compte/CompteLiquidGlassV8.tsx` | 84 |
| `src/components/compte/map/CompteMap.tsx` | 70 |
| `src/components/carnets/CreateCarnetView.tsx` | 69 |
| `src/components/clubs/CreateClubView.tsx` | 69 |
| `src/components/carnet/profile/__tests__/CarnetCard.test.tsx` | 68 |
| `src/app/api/pays/[code]/route.ts` | 67 |
| `src/components/communaute/CommunityPostCard.tsx` | 67 |
| `src/components/compte/drawer/cards/KitCard.tsx` | 61 |
| `src/components/compte/drawer/__tests__/ProfileSettings.test.tsx` | 60 |
| `src/components/compte/drawer/__tests__/LoansSlot.test.tsx` | 56 |
| `src/components/compte/create/CreateDrawer.tsx` | 54 |
| `src/components/compte/drawer/ProfileSettingsSheet.tsx` | 52 |
| `src/components/compte/drawer/compte/SettingsPane.tsx` | 52 |
| `src/components/groupes/EquipementCard.tsx` | 51 |
| `src/components/messaging/MessagesScreen.tsx` | 51 |
| `src/components/pays/BouteilleALaMer.tsx` | 51 |
| `src/app/checkout/page.tsx` | 50 |
| `src/app/mentions-legales/__tests__/dataSources.test.tsx` | 47 |
| `src/app/mentions-legales/DataSources.tsx` | 46 |
| `src/components/legal/PrivacyPolicySections.tsx` | 46 |
| `src/components/dev/glass/GlassLab.tsx` | 45 |
| `src/components/compte/drawer/__tests__/VitrineEmpreinte.test.tsx` | 44 |
| `src/components/compte/drawer/compte/EditProfilePane.tsx` | 44 |
| `src/app/carbone/page.tsx` | 43 |
| `src/app/page.tsx` | 43 |
| `src/app/mentions-legales/page.tsx` | 42 |
| `src/app/voyages/actions.ts` | 41 |
| `src/components/compte/__tests__/ProfileDrawerBootstrap.test.tsx` | 41 |
| `src/components/map/UnifiedExplorerMap.tsx` | 41 |
| `src/app/politique-confidentialite/__tests__/privacyPolicy.test.tsx` | 39 |
| `src/components/ui/GlobalSearchModal.tsx` | 39 |
| `src/app/voyages/kit-actions.ts` | 36 |
| `src/components/communaute/CommunityStoriesBar.tsx` | 34 |
| `src/components/compte/drawer/slots/VitrineSlot.tsx` | 33 |
| `src/components/groupes/TachesCard.tsx` | 33 |
| `src/components/compte/drawer/sortie/SortieDrawer.tsx` | 32 |
| `src/components/map/InteractiveMap.tsx` | 32 |
| `src/components/compte/drawer/__tests__/CommunityClubs.test.tsx` | 31 |
| `src/components/compte/drawer/__tests__/CommunityClubsPersist.test.tsx` | 31 |
| `src/components/compte/drawer/__tests__/MemoriesSlot.test.tsx` | 31 |
| `src/app/api/adventure/generate/route.ts` | 30 |
| `src/app/voyages/budget-actions.ts` | 30 |
| `src/components/carnet/profile/__tests__/CarnetFinitions.test.ts` | 30 |
| `src/components/compte/drawer/compte/HighlightEditDrawer.tsx` | 29 |
| `src/app/voyages/completion-actions.ts` | 28 |
| `src/components/carnet/profile/__tests__/CarnetPages.test.tsx` | 28 |
| `src/components/compte/drawer/__tests__/InvitationsSheet.test.tsx` | 28 |
| `src/components/compte/drawer/slots/LoansSlot.tsx` | 28 |
| `src/components/compte/overlay/DetailDrawers.tsx` | 28 |
| `src/app/connexion/page.tsx` | 27 |
| `src/components/compte/drawer/ClubDrawer.tsx` | 27 |
| `src/components/compte/drawer/compte/OrdersPane.tsx` | 27 |
| `src/components/carnet/profile/__tests__/CarnetScreen.test.tsx` | 26 |
| `src/components/compte/drawer/InvitationsSheet.tsx` | 25 |
| `src/components/dev/style/StyleShowcase.tsx` | 25 |
| `src/components/mobile-nav/navigation/useNavigationPlateau.ts` | 25 |
| `src/components/clubs/ClubDiscussionCard.tsx` | 24 |
| `src/app/api/kits/[id]/sheet/route.ts` | 23 |
| `src/app/panier/page.tsx` | 23 |
| `src/app/pro/page.tsx` | 22 |
| `src/components/compte/drawer/compte/SharePane.tsx` | 22 |
| `src/components/pays/MobileCountryDetailView.tsx` | 22 |
| `src/components/profile/PublicMobileProfileView.tsx` | 22 |
| `src/components/compte/drawer/__tests__/VitrineBadges.test.tsx` | 21 |
| `src/components/compte/drawer/cards/LoanCard.tsx` | 21 |
| `src/components/mobile-nav/navigation/NavigationPlateau.tsx` | 21 |
| `src/app/manifeste/page.tsx` | 20 |
| `src/components/carnet/profile/__tests__/CarnetStatsPane.test.tsx` | 20 |
| `src/components/compte/drawer/compte/NotificationsPane.tsx` | 20 |
| `src/components/groupes/DiscussionCard.tsx` | 20 |
| `src/components/mobile-nav/destinationRegistry.ts` | 20 |
| `src/components/mobile-nav/navigation/__tests__/hub-adventures-drawer.test.tsx` | 20 |
| `src/components/carnet/profile/__tests__/CarnetPostSheet.test.tsx` | 19 |
| `src/components/carnets/MobileCarnetsHub.tsx` | 19 |
| `src/components/compte/drawer/__tests__/VitrineStats.test.tsx` | 19 |
| `src/components/compte/drawer/sortie/OutingSummary.tsx` | 19 |
| `src/components/groupes/VoyageursCard.tsx` | 19 |
| `src/app/api/terrain/reports/route.ts` | 18 |
| `src/components/clubs/MobileClubsHub.tsx` | 18 |
| `src/components/compte/drawer/__tests__/CommunityChallenges.test.tsx` | 18 |
| `src/components/ui/ReportBlockModal.tsx` | 18 |
| `src/components/compte/drawer/__tests__/CommunityCordee.test.tsx` | 17 |
| `src/app/auth/__tests__/callback.test.ts` | 16 |
| `src/components/clubs/feed/ClubInlineFeed.tsx` | 16 |
| `src/app/api/stripe/webhook/route.ts` | 15 |
| `src/components/clubs/ClubGroupsTab.tsx` | 15 |
| `src/components/compte/drawer/__tests__/VitrineRepost.test.tsx` | 15 |
| `src/components/compte/drawer/reseau/ReseauDrawer.tsx` | 15 |
| `src/app/api/adventure/[id]/group/route.ts` | 14 |
| `src/app/api/explorer/osm/routes/route.ts` | 14 |
| `src/app/contact/page.tsx` | 14 |
| `src/app/explorer/layout.tsx` | 14 |
| `src/app/pays/[code]/page.tsx` | 14 |
| `src/components/Header.tsx` | 14 |
| `src/components/mobile-nav/__tests__/native-navigation-lifecycle.test.tsx` | 14 |
| `src/components/profile/PublicProfileV2.tsx` | 14 |
| `src/app/api/cron/process-ai-jobs/route.ts` | 13 |
| `src/app/api/terrain/conditions/route.ts` | 13 |
| `src/app/layout.tsx` | 13 |
| `src/app/pays/layout.tsx` | 13 |
| `src/components/carnet/profile/__tests__/CarnetCommentsPane.test.tsx` | 13 |
| `src/components/communaute/StoriesArchiveSheet.tsx` | 13 |
| `src/components/compte/drawer/__tests__/KitInventory.test.tsx` | 13 |
| `src/components/compte/drawer/__tests__/MemoriesHighlights.test.tsx` | 13 |
| `src/components/compte/drawer/__tests__/useHighlightViewer.test.ts` | 13 |
| `src/components/groupes/DecisionsCard.tsx` | 13 |
| `src/components/groupes/DepensesCard.tsx` | 13 |
| `src/components/progression/ProgressionCompactCard.tsx` | 13 |
| `src/components/social-kit/inventory.ts` | 13 |
| `src/app/api/adventure/[id]/trek/route.ts` | 12 |
| `src/app/api/explorer/osm/route/[id]/route.ts` | 12 |
| `src/app/api/materiel/optimize/route.ts` | 12 |
| `src/app/pays/[code]/CountryDetailClient.tsx` | 12 |
| `src/app/voyages/collab-actions.ts` | 12 |
| `src/app/voyages/document-actions.ts` | 12 |
| `src/app/voyages/poi-actions.ts` | 12 |
| `src/components/carnet/profile/__tests__/CarnetGeometry.test.ts` | 12 |
| `src/components/communaute/CommentItem.tsx` | 12 |
| `src/components/compte/drawer/__tests__/MemoriesHighlightsViewer.test.tsx` | 12 |
| `src/components/compte/drawer/__tests__/PrivateAccount.test.tsx` | 12 |
| `src/components/compte/drawer/sortie/OutingTrace.tsx` | 12 |
| `src/components/compte/map/__tests__/CompteMapState.test.tsx` | 12 |
| `src/components/identity/OrientationCard.tsx` | 12 |
| `src/app/api/cron/daily/__tests__/route.test.ts` | 11 |
| `src/app/api/explorer/osm/materialize/route.ts` | 11 |
| `src/app/api/explorer/osm/pois/route.ts` | 11 |
| `src/app/lieux/actions.ts` | 11 |
| `src/app/robots.ts` | 11 |
| `src/components/CookieConsentBanner.tsx` | 11 |
| `src/components/carnet/profile/__tests__/CarnetLikesPane.test.tsx` | 11 |
| `src/components/carnet/profile/panes/CarnetManagePane.tsx` | 11 |
| `src/components/clubs/MobileClubDetailView.tsx` | 11 |
| `src/components/compte/drawer/ProfileDrawerHost.tsx` | 11 |
| `src/components/compte/drawer/shell/__tests__/DrawerShell.test.tsx` | 11 |
| `src/components/mobile-nav/MobileDrawer.tsx` | 11 |
| `src/components/pays/PaysLeftSidebar.tsx` | 11 |
| `src/components/progression/PassportSection.tsx` | 11 |
| `src/app/api/checkout/route.ts` | 10 |
| `src/app/api/hike-sessions/[id]/narrative/route.ts` | 10 |
| `src/app/api/kit-report/convert-inventory/route.ts` | 10 |
| `src/app/api/notifications/process/route.ts` | 10 |
| `src/app/dev/compas-v5-carte/sample.ts` | 10 |
| `src/components/Footer.tsx` | 10 |
| `src/components/carnet/profile/__tests__/traceGeometry.test.ts` | 10 |
| `src/components/compte/map/CompteMapState.tsx` | 10 |
| `src/components/compte/onboarding/FirstRunJourney.tsx` | 10 |
| `src/components/groupes/ProgressionCard.tsx` | 10 |
| `src/components/mobile-nav/__tests__/native-account-routes.test.ts` | 10 |
| `src/app/api/compte/highlights/[id]/route.ts` | 9 |
| `src/app/api/terrain/reports/[id]/confirm/route.ts` | 9 |
| `src/app/profil/[id]/__tests__/page.test.tsx` | 9 |
| `src/components/carnet/profile/CarnetPages.tsx` | 9 |
| `src/components/carnet/profile/CarnetScreen.tsx` | 9 |
| `src/components/carnet/profile/__tests__/CarnetTopBar.test.tsx` | 9 |
| `src/components/carnet/profile/panes/CarnetStatsPane.tsx` | 9 |
| `src/components/compte/drawer/__tests__/LensPager.test.tsx` | 9 |
| `src/components/compte/drawer/sortie/OutingGear.tsx` | 9 |
| `src/components/compte/drawer/sortie/shared.tsx` | 9 |
| `src/components/explorer/types.ts` | 9 |
| `src/components/map/engine/poiTooltip.ts` | 9 |
| `src/components/pays/PaysHeroOverview.tsx` | 9 |
| `src/app/api/hike-sessions/route.ts` | 8 |
| `src/app/api/progression/preferences/route.ts` | 8 |
| `src/app/api/progression/territory/route.ts` | 8 |
| `src/app/api/trip-assistant/route.ts` | 8 |
| `src/components/compte/drawer/__tests__/format.test.ts` | 8 |
| `src/components/compte/drawer/cards/format.ts` | 8 |
| `src/components/compte/drawer/compte/CompteDrawer.tsx` | 8 |
| `src/components/compte/drawer/slots/CommunitySlot.tsx` | 8 |
| `src/components/profile/__tests__/publicProfilePayload.test.ts` | 8 |
| `src/components/social/CommentsSheet.tsx` | 8 |
| `src/app/api/admin/progression/simulate/route.ts` | 7 |
| `src/app/api/compte/compte/profile/route.ts` | 7 |
| `src/app/api/demo-login/route.ts` | 7 |
| `src/app/api/explorer/v2/trips/route.ts` | 7 |
| `src/app/api/materiel/export/route.ts` | 7 |
| `src/app/api/progression/missions/route.ts` | 7 |
| `src/app/cookies/page.tsx` | 7 |
| `src/app/explorer/page.tsx` | 7 |
| `src/app/voyages/share-actions.ts` | 7 |
| `src/components/carnet/profile/CarnetPostSheet.tsx` | 7 |
| `src/components/carnet/profile/__tests__/CarnetDrawer.test.tsx` | 7 |
| `src/components/carnet/profile/__tests__/CarnetLens.test.ts` | 7 |
| `src/components/communaute/StoriesViewer.tsx` | 7 |
| `src/components/groupes/HeroVoyage.tsx` | 7 |
| `src/components/messaging/__tests__/messagesModel.test.ts` | 7 |
| `src/components/ui/Icon/instagram.generated.ts` | 7 |
| `src/app/api/admin/orders/confirm/route.ts` | 6 |
| `src/app/api/admin/rewards/route.ts` | 6 |
| `src/app/api/adventure/[id]/select/route.ts` | 6 |
| `src/app/api/ai/jobs/route.ts` | 6 |
| `src/app/api/compte/invitations/route.ts` | 6 |
| `src/app/api/kit-report/generate/route.ts` | 6 |
| `src/app/api/materiel/catalog-lookup/route.ts` | 6 |
| `src/app/api/og-preview/route.ts` | 6 |
| `src/app/api/progression/answers/accept/route.ts` | 6 |
| `src/app/api/progression/leaderboard/route.ts` | 6 |
| `src/app/api/progression/route.ts` | 6 |
| `src/app/cgu/page.tsx` | 6 |
| `src/app/cgv/page.tsx` | 6 |
| `src/app/communaute/page.tsx` | 6 |
| `src/app/not-found.tsx` | 6 |
| `src/components/activity/LiveActivityFeed.tsx` | 6 |
| `src/components/carnet/profile/__tests__/CarnetMapCard.test.tsx` | 6 |
| `src/components/carnet/profile/__tests__/CarnetMoreMenu.test.tsx` | 6 |
| `src/components/carnet/profile/panes/CarnetCommentsPane.tsx` | 6 |
| `src/components/carnet/profile/panes/CarnetLikesPane.tsx` | 6 |
| `src/components/carnet/profile/panes/CarnetNaturePane.tsx` | 6 |
| `src/components/carnets/CarnetVerticalTabs.tsx` | 6 |
| `src/components/compte/drawer/__tests__/KitSlot.test.tsx` | 6 |
| `src/components/compte/drawer/__tests__/ProfileDrawerHostViewer.test.tsx` | 6 |
| `src/components/compte/drawer/slots/MemoriesSlot.tsx` | 6 |
| `src/components/compte/map/CompteMapHud.tsx` | 6 |
| `src/components/compte/map/__tests__/CompteMapHud.test.tsx` | 6 |
| `src/components/dev/glass/glassLabPolicy.ts` | 6 |
| `src/components/groupes/ParcoursCard.tsx` | 6 |
| `src/components/map/UnifiedCountryGlobe.tsx` | 6 |
| `src/components/mobile-nav/navigation/adventuresDrawerModel.ts` | 6 |
| `src/components/pays/PaysPratiqueView.tsx` | 6 |
| `src/components/pays/PaysRightSidebar.tsx` | 6 |
| `src/components/social/ReportSheet.tsx` | 6 |
| `src/components/ui/Icon/registry.generated.ts` | 6 |
| `src/components/ui/__tests__/ActionPill.test.tsx` | 6 |
| `src/components/ui/__tests__/CapsuleTabs.test.tsx` | 6 |
| `src/app/api/account/delete/route.ts` | 5 |
| `src/app/api/adventure/[id]/monitoring/route.ts` | 5 |
| `src/app/api/affiliate/travelpayouts/route.ts` | 5 |
| `src/app/api/carnet/identify-species/route.ts` | 5 |
| `src/app/api/compte/map/__tests__/route.test.ts` | 5 |
| `src/app/api/compte/reseau/cordee/route.ts` | 5 |
| `src/app/api/cron/process-hike-sessions/route.ts` | 5 |
| `src/app/api/kits/[id]/field-report/route.ts` | 5 |
| `src/app/api/materiel/items/[id]/route.ts` | 5 |
| `src/app/api/materiel/items/route.ts` | 5 |
| `src/app/api/materiel/kits/[id]/route.ts` | 5 |
| `src/app/api/materiel/kits/route.ts` | 5 |
| `src/app/api/materiel/scan/route.ts` | 5 |
| `src/app/api/materiel/share/route.ts` | 5 |
| `src/app/api/user/export/route.ts` | 5 |
| `src/app/compte/layout.tsx` | 5 |
| `src/app/connexion/layout.tsx` | 5 |
| `src/app/inscription/layout.tsx` | 5 |
| `src/app/profil/[id]/page.tsx` | 5 |
| `src/components/carnets/CarnetHubHero.tsx` | 5 |
| `src/components/carnets/MobileCarnetCard.tsx` | 5 |
| `src/components/clubs/ClubPrivatePostsPanel.tsx` | 5 |
| `src/components/clubs/MobileClubCard.tsx` | 5 |
| `src/components/compte/drawer/__tests__/SlotSelectorAria.test.tsx` | 5 |
| `src/components/compte/drawer/cards/ClubCard.tsx` | 5 |
| `src/components/explorer/ExplorerMap.tsx` | 5 |
| `src/components/groupes/TabsGroupe.tsx` | 5 |
| `src/components/identity/SignatureVisibilityControl.tsx` | 5 |
| `src/components/mobile-nav/__tests__/TabSwipeNavigator.test.tsx` | 5 |
| `src/components/mobile-nav/navigation/__tests__/bottom-nav-reservation.test.ts` | 5 |
| `src/components/pays/PaysActivitesView.tsx` | 5 |
| `src/components/produit/InventoryEntryButton.tsx` | 5 |
| `src/components/produit/__tests__/InventoryEntryButton.test.tsx` | 5 |
| `src/components/profile/PublicProfilePostsGrid.tsx` | 5 |
| `src/components/social/CommunityHubNav.tsx` | 5 |
| `src/components/ui/__tests__/custom-cursor.test.ts` | 5 |
| `src/app/api/account/export/route.ts` | 4 |
| `src/app/api/adventure/offline/sync/route.ts` | 4 |
| `src/app/api/ai/ping/route.ts` | 4 |
| `src/app/api/compte/highlights/route.ts` | 4 |
| `src/app/api/compte/sorties/[id]/participants/route.ts` | 4 |
| `src/app/api/cron/process-adventure-events/route.ts` | 4 |
| `src/app/api/dev/generate-country-blocks/route.ts` | 4 |
| `src/app/api/explorer/v2/content/route.ts` | 4 |
| `src/app/api/explorer/v2/place/route.ts` | 4 |
| `src/app/api/explorer/v2/reports/near/route.ts` | 4 |
| `src/app/api/explorer/v2/search/route.ts` | 4 |
| `src/app/api/explorer/v2/weather/route.ts` | 4 |
| `src/app/api/progression/discoveries/route.ts` | 4 |
| `src/app/api/progression/history/route.ts` | 4 |
| `src/app/api/progression/passport/route.ts` | 4 |
| `src/app/api/progression/suggestions/route.ts` | 4 |
| `src/app/api/rewards/claim/route.ts` | 4 |
| `src/app/api/trips/[tripId]/checklist/complete/route.ts` | 4 |
| `src/app/api/users/search/route.ts` | 4 |
| `src/app/checkout/layout.tsx` | 4 |
| `src/app/communaute/layout.tsx` | 4 |
| `src/app/contact/layout.tsx` | 4 |
| `src/app/pro/layout.tsx` | 4 |
| `src/components/carnet/profile/CarnetCard.tsx` | 4 |
| `src/components/carnet/profile/CarnetDayHeader.tsx` | 4 |
| `src/components/carnet/profile/CarnetMapCard.tsx` | 4 |
| `src/components/carnets/CarnetHubCard.tsx` | 4 |
| `src/components/carnets/CarnetRightSidebar.tsx` | 4 |
| `src/components/clubs/ClubHero.tsx` | 4 |
| `src/components/communaute/StoryViewsSheet.tsx` | 4 |
| `src/components/compte/drawer/__tests__/LensHorizontalScroll.test.tsx` | 4 |
| `src/components/compte/drawer/__tests__/SlotShell.test.tsx` | 4 |
| `src/components/compte/drawer/cards/WearGauge.tsx` | 4 |
| `src/components/compte/drawer/compte/shared.tsx` | 4 |
| `src/components/compte/drawer/memories/memoriesModel.ts` | 4 |
| `src/components/compte/drawer/memories/useHighlightViewer.ts` | 4 |
| `src/components/compte/drawer/reseau/UserRow.tsx` | 4 |
| `src/components/compte/drawer/slots/KitSlot.tsx` | 4 |
| `src/components/compte/drawer/sortie/OutingComments.tsx` | 4 |
| `src/components/compte/drawer/sortie/OutingPhotos.tsx` | 4 |
| `src/components/compte/map/CompteMapFallback.tsx` | 4 |
| `src/components/compte/overlay/CompteOverlayHost.tsx` | 4 |
| `src/components/compte/overlay/PostDrawer.tsx` | 4 |
| `src/components/messaging/messagesModel.ts` | 4 |
| `src/components/mobile-nav/navigation/DayPlateau.tsx` | 4 |
| `src/components/pays/PaysCommunauteView.tsx` | 4 |
| `src/components/pays/PaysDestinationsView.tsx` | 4 |
| `src/components/pays/PaysHebergementsView.tsx` | 4 |
| `src/components/produit/ProductBuyBar.tsx` | 4 |
| `src/components/search/SearchOverlay.tsx` | 4 |
| `src/components/ui/Icon/registry.ts` | 4 |
| `src/app/admin/progression/page.tsx` | 3 |
| `src/app/api/adventure/[id]/cockpit/route.ts` | 3 |
| `src/app/api/adventure/[id]/offline-pack/route.ts` | 3 |
| `src/app/api/adventure/[id]/route.ts` | 3 |
| `src/app/api/ai/chat-completion/route.ts` | 3 |
| `src/app/api/ai/country-guide/[code]/route.ts` | 3 |
| `src/app/api/compte/sorties/[id]/gear/route.ts` | 3 |
| `src/app/api/compte/sorties/[id]/gpx/route.ts` | 3 |
| `src/app/api/compte/sorties/[id]/photos/route.ts` | 3 |
| `src/app/api/cron/expire-terrain-reports/route.ts` | 3 |
| `src/app/api/cron/progression-outbox/route.ts` | 3 |
| `src/app/api/cron/run-adventure-shadows/route.ts` | 3 |
| `src/app/api/discovery/search/route.ts` | 3 |
| `src/app/api/explorer/v2/activity/finish/route.ts` | 3 |
| `src/app/api/explorer/v2/countries/route.ts` | 3 |
| `src/app/api/explorer/v2/reports/confirm/route.ts` | 3 |
| `src/app/api/explorer/v2/reports/route.ts` | 3 |
| `src/app/api/explorer/v2/sos/route.ts` | 3 |
| `src/app/api/guides/[country]/ask/route.ts` | 3 |
| `src/app/api/hikes/[id]/route.ts` | 3 |
| `src/app/api/kits/my-royalties/route.ts` | 3 |
| `src/app/api/materiel/calendar/route.ts` | 3 |
| `src/app/api/materiel/fork/route.ts` | 3 |
| `src/app/api/progression/challenge/replace/route.ts` | 3 |
| `src/app/api/stories/[id]/media/route.ts` | 3 |
| `src/app/api/support/tickets/[id]/route.ts` | 3 |
| `src/app/api/support/tickets/route.ts` | 3 |
| `src/app/api/voyages/[slug]/gpx/route.ts` | 3 |
| `src/app/carbone/layout.tsx` | 3 |
| `src/app/carte-interactive/layout.tsx` | 3 |
| `src/app/dev/compas-v5-carte/LiveMapLab.tsx` | 3 |
| `src/app/hub/[section]/error.tsx` | 3 |
| `src/app/hub/error.tsx` | 3 |
| `src/app/hub/layout.tsx` | 3 |
| `src/components/WeightGauge.tsx` | 3 |
| `src/components/carnet/profile/CarnetTopBar.tsx` | 3 |
| `src/components/carnet/profile/__tests__/fixtures.ts` | 3 |
| `src/components/clubs/ClubAboutCard.tsx` | 3 |
| `src/components/clubs/ClubFeaturedEventCard.tsx` | 3 |
| `src/components/communaute/CommunityVideo.tsx` | 3 |
| `src/components/compte/drawer/cards/RepostCard.tsx` | 3 |
| `src/components/compte/drawer/sortie/OutingParticipants.tsx` | 3 |
| `src/components/compte/map/CompteMapCallout.tsx` | 3 |
| `src/components/compte/map/__tests__/CompteMapCallout.test.tsx` | 3 |
| `src/components/compte/overlay/OverlaySheet.tsx` | 3 |
| `src/components/map/hooks/useViewportData.ts` | 3 |
| `src/components/mobile-nav/OfflineBanner.tsx` | 3 |
| `src/components/mobile-nav/nativeNavigationPerformance.ts` | 3 |
| `src/components/pays/PaysGastronomieView.tsx` | 3 |
| `src/components/social-kit/__tests__/likeUnique.test.ts` | 3 |
| `src/app/api/billing/entitlements/route.ts` | 2 |
| `src/app/api/carnets/[id]/publish/route.ts` | 2 |
| `src/app/api/compte/loans/route.ts` | 2 |
| `src/app/api/compte/onboarding/route.ts` | 2 |
| `src/app/api/compte/reseau/follow/route.ts` | 2 |
| `src/app/api/compte/reseau/followers/route.ts` | 2 |
| `src/app/api/compte/reseau/requests/route.ts` | 2 |
| `src/app/api/compte/sorties/[id]/comments/route.ts` | 2 |
| `src/app/api/compte/sorties/[id]/kudos/route.ts` | 2 |
| `src/app/api/compte/sorties/[id]/route.ts` | 2 |
| `src/app/api/cron/aggregate-segments/route.ts` | 2 |
| `src/app/api/cron/leaderboard-refresh/route.ts` | 2 |
| `src/app/api/cron/purge-stories/route.ts` | 2 |
| `src/app/api/cron/refresh-country-guides/route.ts` | 2 |
| `src/app/api/elevation/route.ts` | 2 |
| `src/app/api/hike-sessions/[id]/route.ts` | 2 |
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
| `src/app/checkout/error.tsx` | 2 |
| `src/app/compte/error.tsx` | 2 |
| `src/app/connexion/nouveau-mot-de-passe/page.tsx` | 2 |
| `src/app/cookies/layout.tsx` | 2 |
| `src/app/explorer/error.tsx` | 2 |
| `src/app/messagerie/layout.tsx` | 2 |
| `src/app/panier/layout.tsx` | 2 |
| `src/app/politique-confidentialite/page.tsx` | 2 |
| `src/app/profil/layout.tsx` | 2 |
| `src/app/profil/page.tsx` | 2 |
| `src/app/sitemap.ts` | 2 |
| `src/components/ErrorBoundaryWrapper.tsx` | 2 |
| `src/components/ReactQueryProvider.tsx` | 2 |
| `src/components/carnet/profile/CarnetMoreMenu.tsx` | 2 |
| `src/components/carnet/profile/__tests__/CarnetSecurite.test.tsx` | 2 |
| `src/components/carnet/profile/panes/CarnetKitPane.tsx` | 2 |
| `src/components/carnet/profile/panes/CarnetParcoursPane.tsx` | 2 |
| `src/components/clubs/ClubTeamCard.tsx` | 2 |
| `src/components/clubs/ClubVerticalTabs.tsx` | 2 |
| `src/components/compte/drawer/PrivateAccountLock.tsx` | 2 |
| `src/components/compte/drawer/SlotSelector.tsx` | 2 |
| `src/components/compte/drawer/cards/CompanionRow.tsx` | 2 |
| `src/components/compte/drawer/shell/DrawerAuthRequired.tsx` | 2 |
| `src/components/compte/map/useCompteMapContext.ts` | 2 |
| `src/components/identity/UserFieldSignature.tsx` | 2 |
| `src/components/kits/ProductLineageCard.tsx` | 2 |
| `src/components/map/engine/icons.ts` | 2 |
| `src/components/mobile-nav/FloatingLiquidTabBar.tsx` | 2 |
| `src/components/mobile-nav/MobileNavWrapper.tsx` | 2 |
| `src/components/mobile-nav/nativeAccountRoutes.ts` | 2 |
| `src/components/pays/PaysClubsList.tsx` | 2 |
| `src/components/pays/PaysCultureView.tsx` | 2 |
| `src/components/shell/AppShellDesktop.tsx` | 2 |
| `src/components/social-kit/CommentItem.tsx` | 2 |
| `src/components/ui/EmptyState.tsx` | 2 |
| `src/components/ui/LkvIcon.tsx` | 2 |
| `src/components/ui/StepIndicator.tsx` | 2 |
| `src/app/api/carnets/[id]/route.ts` | 1 |
| `src/app/api/compte/bootstrap/route.ts` | 1 |
| `src/app/api/compte/clubs/route.ts` | 1 |
| `src/app/api/compte/compte/notifications/route.ts` | 1 |
| `src/app/api/compte/compte/orders/route.ts` | 1 |
| `src/app/api/compte/compte/share/route.ts` | 1 |
| `src/app/api/compte/map/route.ts` | 1 |
| `src/app/api/compte/posts/[id]/comments/route.ts` | 1 |
| `src/app/api/compte/reseau/following/route.ts` | 1 |
| `src/app/api/cron/cleanup-ephemeral-groups/route.ts` | 1 |
| `src/app/api/cron/cleanup-solo-crews/route.ts` | 1 |
| `src/app/api/cron/expire-live-positions/route.ts` | 1 |
| `src/app/api/cron/finalize-kit-attributions/route.ts` | 1 |
| `src/app/api/cron/progression-awards/route.ts` | 1 |
| `src/app/api/cron/refresh-atlas-density/route.ts` | 1 |
| `src/app/api/cron/refresh-kit-scores/route.ts` | 1 |
| `src/app/api/csp-report/route.ts` | 1 |
| `src/app/api/hikes/geojson/route.ts` | 1 |
| `src/app/api/indexnow/route.ts` | 1 |
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
| `src/app/carnets/[id]/loading.tsx` | 1 |
| `src/app/carnets/[id]/page.tsx` | 1 |
| `src/app/carte-interactive/CarteClient.tsx` | 1 |
| `src/app/carte-interactive/page.tsx` | 1 |
| `src/app/checkout/loading.tsx` | 1 |
| `src/app/compas/page.tsx` | 1 |
| `src/app/compte/page.tsx` | 1 |
| `src/app/global-error.tsx` | 1 |
| `src/app/go/[slug]/route.ts` | 1 |
| `src/app/hub/[section]/page.tsx` | 1 |
| `src/app/hub/loading.tsx` | 1 |
| `src/app/hub/page.tsx` | 1 |
| `src/app/inscription/page.tsx` | 1 |
| `src/app/messagerie/page.tsx` | 1 |
| `src/app/panier/loading.tsx` | 1 |
| `src/app/pays/[code]/error.tsx` | 1 |
| `src/app/pays/[code]/loading.tsx` | 1 |
| `src/app/pays/loading.tsx` | 1 |
| `src/app/progression/route.ts` | 1 |
| `src/components/account/AccountAuthorPill.tsx` | 1 |
| `src/components/account/AccountMoreMenu.tsx` | 1 |
| `src/components/carnet/profile/CarnetDrawer.tsx` | 1 |
| `src/components/carnet/profile/CarnetMediaViewer.tsx` | 1 |
| `src/components/carnet/profile/CarnetStates.tsx` | 1 |
| `src/components/carnet/profile/downloadGpx.ts` | 1 |
| `src/components/carnet/profile/panes/CarnetDayRow.tsx` | 1 |
| `src/components/carnet/profile/panes/CarnetEtapesPane.tsx` | 1 |
| `src/components/carnet/profile/panes/CarnetSharePane.tsx` | 1 |
| `src/components/clubs/ClubProCard.tsx` | 1 |
| `src/components/compte/MobileCompteV2.tsx` | 1 |
| `src/components/compte/drawer/SlotShell.tsx` | 1 |
| `src/components/compte/drawer/cards/BadgeTile.tsx` | 1 |
| `src/components/compte/drawer/cards/ChallengeRow.tsx` | 1 |
| `src/components/compte/drawer/cards/HighlightCard.tsx` | 1 |
| `src/components/compte/drawer/cards/OutingCard.tsx` | 1 |
| `src/components/compte/drawer/cards/StampTile.tsx` | 1 |
| `src/components/compte/drawer/cards/productImage.ts` | 1 |
| `src/components/compte/drawer/memories/YearFilter.tsx` | 1 |
| `src/components/explorer/TrailLayer.tsx` | 1 |
| `src/components/hiking/ElevationProfileChart.tsx` | 1 |
| `src/components/legal/MarketplacePrivacyNotice.tsx` | 1 |
| `src/components/legal/MarketplaceTermsNotice.tsx` | 1 |
| `src/components/map/engine/camera.ts` | 1 |
| `src/components/mobile-nav/TabSwipeNavigator.tsx` | 1 |
| `src/components/mobile-nav/__tests__/native-navigation-performance.test.ts` | 1 |
| `src/components/pays/PaysCarnetsList.tsx` | 1 |
| `src/components/profile/publicProfilePayload.ts` | 1 |
| `src/components/shell/AppShell.tsx` | 1 |
| `src/components/shell/RouteLoading.tsx` | 1 |
| `src/components/system/PresenceTracker.tsx` | 1 |
| `src/components/ui/HeaderBackButton.tsx` | 1 |
| `src/components/ui/LoadingState.tsx` | 1 |
| `src/components/ui/Modal.tsx` | 1 |
| `src/components/ui/NotificationBell.tsx` | 1 |
| `src/components/ui/Sheet.tsx` | 1 |
| `src/components/ui/SmartImage.tsx` | 1 |
| `src/components/ui/Spinner.tsx` | 1 |
| `src/components/ui-layouts/number-stat.tsx` | 1 |

Exemples (15 fichiers les plus denses) :

- `src/components/clubs/ClubLiquidGlassV8.tsx`
  - L10 : « @/lib/progression-award-requests »
  - L13 : « ../compte/compte-v8.css »
  - L14 : « ../compte/compte-apple-hig.css »
- `src/components/progression/MaProgressionView.tsx`
  - L12 : « @/features/progression/server/discoveries »
  - L20 : « @/features/progression/domain/types »
  - L31 : « progression.skill.explorer »
- `src/app/api/seed/route.ts`
  - L140 : « Découvreur »
  - L141 : « Découvreur »
  - L142 : « Léa Roux »
- `src/app/admin/page.tsx`
  - L14 : « progression »
  - L21 : « Catégories »
  - L24 : « Pages Pays »
- `src/app/admin/produits/AdminProductsManager.tsx`
  - L111 : « Recommandé »
  - L112 : « enchère »
  - L122 : « Équipement du sac »
- `src/components/clubs/drawer/ClubDrawerHost.tsx`
  - L43 : « @/components/compte/drawer/shell/DrawerShell »
  - L76 : « Guide & Sécurité »
  - L226 : « Léa (@lea.fontaine) »
- `src/components/compte/CompteLiquidGlassV8.tsx`
  - L11 : « @/lib/progression-award-requests »
  - L13 : « ./compte-liquid-glass-v8-runtime »
  - L31 : « [compte-map] »
- `src/components/compte/map/CompteMap.tsx`
  - L20 : « @/features/compte/map/camera »
  - L21 : « @/features/compte/map/modes »
  - L22 : « @/features/compte/map/geometry »
- `src/components/carnets/CreateCarnetView.tsx`
  - L9 : « @/components/compte/CompteBackground »
  - L11 : « @/lib/progression-award-requests »
  - L93 : « Refuge gardé »
- `src/components/clubs/CreateClubView.tsx`
  - L9 : « @/components/compte/CompteBackground »
  - L45 : « Tous niveaux bienvenus »
  - L60 : « Écrins »
- `src/components/carnet/profile/__tests__/CarnetCard.test.tsx`
  - L49 : « ouvre le carnet au clic sur le mini tracé »
  - L56 : « remplace la photo de couverture par un mini tracé »
  - L61 : « points »
- `src/app/api/pays/[code]/route.ts`
  - L105 : « saison »
  - L134 : « pays »
  - L137 : « niveau »
- `src/components/communaute/CommunityPostCard.tsx`
  - L68 : « À l’instant »
  - L144 : « Connectez-vous pour importer un kit. »
  - L157 : « Kit importé dans votre matériel. »
- `src/components/compte/drawer/cards/KitCard.tsx`
  - L241 : « disponible »
  - L241 : « Disponible »
  - L244 : « Retiré »
- `src/components/compte/drawer/__tests__/ProfileSettings.test.tsx`
  - L8 : « @/features/compte/data/accountVisibility »
  - L90 : « Réglages du profil »
  - L109 : « Réglages du profil propriétaire »

## 5. Préparation RTL

**Règle permanente** : pour tout nouveau composant ou toute modification, utiliser les propriétés logiques Tailwind `ms-*` / `me-*` / `ps-*` / `pe-*` (et `start-*` / `end-*`) au lieu de `ml-*` / `mr-*` / `pl-*` / `pr-*` / `left-*` / `right-*`. Aucune feuille `src/styles/**` n’est modifiée par P6.

Vérification des fichiers touchés par P6 (classes physiques `ml-/mr-/pl-/pr-`) :

| Fichier P6 | Occurrences |
| --- | ---: |
| `src/app/connexion/page.tsx` | 2 |
| `src/app/compte/page.tsx` | 0 |
| `src/components/progression/MaProgressionView.tsx` | 0 |
| `src/components/mobile-nav/destinationRegistry.ts` | 0 |

Les occurrences restantes ailleurs dans le dépôt constituent une dette RTL documentée, hors périmètre P6 — à convertir lors des prochaines refontes.

## 6. Limites honnêtes

- L’expansion pseudo-localisée (+40 %) est testée au niveau des données (`tests/i18n/pseudo-localization.spec.ts`) : longueurs, parité et placeholders. Aucun rendu pixel ni mesure de troncature visuelle n’est revendiqué.
- La traduction EN ne prétend pas couvrir les 400+ composants : seules les surfaces listées en §3 sont garanties. Le reste est listé en §4.
- Certaines chaînes visibles proviennent de données serveur (titres de niveau, noms de badges, descriptions de défis, alias de classement) : elles restent en français tant que les données ne sont pas traduites.
- L’heuristique de détection (§1) sous-estime probablement le volume réel (chaînes sans accent ni mot-clé) et peut surévaluer certains fichiers (libellés techniques).
- Aucun audit de rendu réel (390×844, 430×932, etc.) n’a été exécuté pour P6 : le test de pseudo-localisation est un test de données, pas un test visuel.
