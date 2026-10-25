# Parcours de lancement — vérification i18n

Généré par `scripts/i18n/critical-paths.mjs`.

- FR (langue source) : `src/app/communaute/error.tsx`
- FR (langue source) : `src/app/communaute/loading.tsx`
- FR (langue source) : `src/app/communaute/page.tsx`
- FR (langue source) : `src/app/communaute/publier/page.tsx`
- FR (langue source) : `src/app/communaute-pro/page.tsx`
- FR (langue source) : `src/app/compte/error.tsx`
- FR (langue source) : `src/app/compte/layout.tsx`
- FR (langue source) : `src/app/compte/page.tsx`
- FR (langue source) : `src/app/connexion/layout.tsx`
- FR (langue source) : `src/app/connexion/page.tsx`
- FR (langue source) : `src/app/explorer/error.tsx`
- FR (langue source) : `src/app/explorer/layout.tsx`
- FR (langue source) : `src/app/explorer/loading.tsx`
- FR (langue source) : `src/app/explorer/page.tsx`
- FR (langue source) : `src/app/hub/error.tsx`
- FR (langue source) : `src/app/hub/layout.tsx`
- FR (langue source) : `src/app/hub/loading.tsx`
- FR (langue source) : `src/app/hub/nouveau/page.tsx`
- FR (langue source) : `src/app/hub/page.tsx`
- FR (langue source) : `src/app/hub/[section]/error.tsx`
- FR (langue source) : `src/app/hub/[section]/loading.tsx`
- FR (langue source) : `src/app/hub/[section]/page.tsx`
- FR (langue source) : `src/app/hub/[section]/sectionViews.client.tsx`
- FR (langue source) : `src/app/layout.tsx`
- FR (langue source) : `src/app/materiel/page.tsx`
- FR (langue source) : `src/app/progression/page.tsx`
- FR (langue source) : `src/components/compte/AbonnementCard.tsx`
- FR (langue source) : `src/components/compte/ActiviteCard.tsx`
- FR (langue source) : `src/components/compte/AventuresTab.tsx`
- FR (langue source) : `src/components/compte/BadgesCard.tsx`
- FR (langue source) : `src/components/compte/CarnetsTab.tsx`
- FR (langue source) : `src/components/compte/ClubsTab.tsx`
- FR (langue source) : `src/components/compte/CommandesCard.tsx`
- FR (langue source) : `src/components/compte/CommandesTab.tsx`
- FR (langue source) : `src/components/compte/CompteBackground.tsx`
- FR (langue source) : `src/components/compte/CompteFooter.tsx`
- FR (langue source) : `src/components/compte/CompteLeftSidebar.tsx`
- FR (langue source) : `src/components/compte/EditProfileView.tsx`
- FR (langue source) : `src/components/compte/FideliteTab.tsx`
- FR (langue source) : `src/components/compte/HeroProfil.tsx`
- FR (langue source) : `src/components/compte/MesAventuresCard.tsx`
- FR (langue source) : `src/components/compte/MesCarnetsCard.tsx`
- FR (langue source) : `src/components/compte/MesClubsCard.tsx`
- FR (langue source) : `src/components/compte/MobileCompteV2.tsx`
- FR (langue source) : `src/components/compte/ParametresCompteCard.tsx`
- FR (langue source) : `src/components/compte/ProchainVoyageCard.tsx`
- FR (langue source) : `src/components/compte/ProfileHeader.tsx`
- FR (langue source) : `src/components/compte/ProfileStats.tsx`
- FR (langue source) : `src/components/compte/ProfileTabs.tsx`
- FR (langue source) : `src/components/compte/tabs/TabActivite.tsx`
- FR (langue source) : `src/components/compte/tabs/TabCarnets.tsx`
- FR (langue source) : `src/components/compte/tabs/TabEquipement.tsx`
- FR (langue source) : `src/components/compte/tabs/TabVoyages.tsx`
- FR (langue source) : `src/components/mobile-nav/BottomTabBar.tsx`
- FR (langue source) : `src/components/mobile-nav/destinationRegistry.ts`
- FR (langue source) : `src/components/mobile-nav/InstallPrompt.tsx`
- FR (langue source) : `src/components/mobile-nav/MobileDrawer.tsx`
- FR (langue source) : `src/components/mobile-nav/MobileHomePage.tsx`
- FR (langue source) : `src/components/mobile-nav/MobilePageShell.tsx`
- FR (langue source) : `src/components/mobile-nav/MobileProfilePage.tsx`
- FR (langue source) : `src/components/mobile-nav/OfflineBanner.tsx`
- FR (langue source) : `src/components/progression/MaProgressionView.tsx`
- FR (langue source) : `src/components/progression/ProgressionCompactCard.tsx`
- FR (langue source) : `src/lib/i18n/context.tsx`
- FR (langue source) : `src/lib/i18n/format.ts`
- FR (langue source) : `src/lib/i18n/formatters.ts`
- FR (langue source) : `src/lib/i18n/locale.ts`
- FR (langue source) : `src/lib/i18n/translate.ts`
- FR (langue source) : `src/lib/i18n/translations/fr.ts`
- FR (langue source) : `src/lib/i18n/translations/index.ts`

Fichiers critiques scannés : 87
Fichiers critiques contenant du FR (langue source) : 70
Imports directs du dictionnaire EN hors infrastructure : 0

## Conclusion

- L'anglais est désactivé par défaut (`NEXT_PUBLIC_I18N_EN_ENABLED !== '1'`) : `resolveLocale` retourne toujours `fr`, aucune route servie ne peut afficher un mélange FR/EN.
- Le FR restant dans ces fichiers est la langue source assumée, pas une surface anglaise incomplète.
- Aucun composant de parcours critique n’importe directement le dictionnaire EN.
