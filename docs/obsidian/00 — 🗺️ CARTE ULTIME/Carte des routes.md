---
title: Carte Exhaustive des Routes & Pages LKDV
aliases:
  - Carte des routes
  - Routes de l'application
  - App Router Map
tags:
  - routes
  - nextjs
  - app-router
updated: 2026-08-17
---

# 🗺️ CARTE EXHAUSTIVE DES ROUTES LKDV

> [!info] **Cartographie des 68+ routes actives du Next.js App Router**
> Chaque route listée ci-dessous correspond à un fichier `page.tsx` réellement présent dans `src/app/`, avec son statut vérifié, son mode de rendu et ses dépendances Supabase.

---

## 🧭 1. Exploration, Cartes & Randonnée

| Route URL | Mode | Authentification | Composants Clés | Tables Supabase / APIs | Statut |
| :--- | :---: | :---: | :--- | :--- | :---: |
| `/` | SSR | Public | Redirection serveur 302 vers `/explorer` | — | 🟢 |
| `/explorer` | SSR (RSC) | Public | `InteractiveMap`, `TrailCard`, `TrailFilters` | `hiking_routes`, `trail_segments`, `explore_trails` | 🟢 |
| `/carte-interactive` | Client | Public | `MapboxGL` / `LeafletMap`, `LayerSelector` | `trail_segments`, `trail_pois`, `geo_places` | 🟢 |
| `/randonnee-active` | Client | Requis | `ActiveHikeTracker`, `ElevationChart`, `SOSButton` | `hike_sessions`, `trail_segments`, `/api/hikes` | 🟢 |
| `/boussole` | Client | Public | `DigitalCompass`, `BearingIndicator` | Capteurs GPS / Magnétomètre navigateur | 🟢 |
| `/terrain` | Client | Public | `TerrainMap`, `OfflineIndicator` | Cache local `IndexedDB`, PostGIS | 🟢 |
| `/preparer-randonnee` | SSR | Requis | `HikePlannerForm`, `WeatherWidget` | `hiking_routes`, `gear_items` | 🟢 |

---

## 🎒 2. Équipement, Inventaire & Boutique

| Route URL | Mode | Authentification | Composants Clés | Tables Supabase / APIs | Statut |
| :--- | :---: | :---: | :--- | :--- | :---: |
| `/mon-materiel` | Client | Requis / Invité | `GearGrid`, `BaseWeightMeter`, `ItemHeroModal` | `gear_items`, `shop_products`, `useEquipment` | 🟢 |
| `/boutique` | SSR 308 | Public | Redirection permanente vers `/mon-materiel` | Métadonnées SEO unifiées, Schema.org | 🟢 |
| `/produit/[slug]` | SSR (ISR) | Public | `ProductDetailView`, `AffiliateButton`, `StockBadge` | `shop_products`, `affiliate_offers`, `reviews` | 🟢 |
| `/kits` | SSR | Public | `KitsShowcase`, `KitCategoryTabs` | `kits`, `kit_items`, `shop_products` | 🟢 |
| `/kits/[slug]` | SSR | Public | `KitCustomizer`, `WeightBreakdown` | `kits`, `kit_items`, `shop_products` | 🟢 |
| `/ai-configurator` | Client | Public / Requis | `KitConfiguratorWizard`, `AIRecommendation` | `kit_reports`, `/api/kit-report/generate` | 🟢 |
| `/rapport-kit` | Client | Requis | `KitReportSummary`, `ExportPdfButton` | `kit_reports`, `/api/kit-report/save` | 🟢 |
| `/panier` | Client | Public | `CartItemList`, `CheckoutSummary` | LocalStorage + Stripe Checkout | 🟢 |
| `/checkout` | Client | Requis | `StripePaymentForm`, `AddressForm` | `/api/checkout`, `orders`, `order_items` | 🟢 |
| `/occasion` | SSR | Public | `OccasionListingGrid`, `ConditionBadge` | `occasion_listings`, `gear_items` | 🟢 |
| `/location` | SSR | Public | `RentalGrid`, `CalendarRangePicker` | `rental_items`, `shop_products` | 🟢 |
| `/encheres` | SSR | Requis | `AuctionCard`, `LiveBidStream` | `auction_listings`, `auction_bids` | 🟢 |

---

## 📸 3. Carnets de Voyage & Médias

| Route URL | Mode | Authentification | Composants Clés | Tables Supabase / APIs | Statut |
| :--- | :---: | :---: | :--- | :--- | :---: |
| `/carnets` | SSR | Public | `CarnetFeed`, `FeaturedExpedition` | `carnets`, `user_profiles`, `carnet_moments` | 🟢 |
| `/carnets/nouveau` | Client | Requis | `CarnetEditor`, `MediaUploader`, `GPSPicker` | `carnets`, Supabase Storage `carnet-media` | 🟢 |
| `/carnets/[id]` | SSR | Public / Privé | `CarnetTimeline`, `MomentCard`, `SpeciesViewer` | `carnets`, `carnet_moments`, `/api/carnet/[id]` | 🟢 |
| `/mes-aventures` | Client | Requis | `UserAdventuresList`, `DraftCarnets` | `carnets`, `hike_sessions` | 🟢 |

---

## 👥 4. Groupes, Clubs & Communauté

| Route URL | Mode | Authentification | Composants Clés | Tables Supabase / APIs | Statut |
| :--- | :---: | :---: | :--- | :--- | :---: |
| `/communaute` | Client | Public | `CommunityFeed`, `PostCard`, `ActivityStream` | `posts`, `comments`, `likes`, `user_profiles` | 🟢 |
| `/communaute/publier` | Client | Requis | `PostComposer`, `AttachmentPicker` | `posts`, Supabase Storage | 🟢 |
| `/clubs` | SSR | Public | `ClubsGrid`, `ClubCategoryFilter`, `ClubModal` | `travel_groups` (type club), `club_members` | 🟢 |
| `/clubs/nouveau` | Client | Requis | `CreateClubForm`, `CoverUploader` | `travel_groups`, `club_members` | 🟢 |
| `/clubs/[id]` | SSR | Membre / Public | `ClubHero`, `TopicList`, `JoinRequestModal` | `travel_groups`, `club_topics`, `club_members` | 🟢 |
| `/groupes` | Client | Requis | `GroupsDashboard`, `ActiveExpeditionCard` | `travel_groups`, `group_members` | 🟢 |
| `/groupes/[groupId]` | Client | Membre | `GroupChat`, `ExpenseSplitter`, `PollList` | `group_messages`, `group_expenses`, `group_polls` | 🟢 |
| `/nouveau-groupe` | Client | Requis | `CreateGroupWizard`, `InviteMembers` | `travel_groups`, `group_members` | 🟢 |
| `/entraide` | SSR | Public | `QnAForum`, `AskQuestionModal` | `community_questions`, `community_answers` | 🟢 |
| `/evenements` | SSR | Public | `EventsCalendar`, `RSVPButton` | `events`, `event_participants` | 🟢 |

---

## 👤 5. Compte, Récompenses, Alertes & Admin

| Route URL | Mode | Authentification | Composants Clés | Tables Supabase / APIs | Statut |
| :--- | :---: | :---: | :--- | :--- | :---: |
| `/compte` | Client | Requis | `ProfileHeader`, `GearStats`, `RewardBalance` | `user_profiles`, `reward_accounts` | 🟢 |
| `/compte/modifier` | Client | Requis | `EditProfileForm`, `AvatarUploader` | `user_profiles`, Supabase Storage `avatars` | 🟢 |
| `/profil/[id]` | SSR | Public | `PublicProfileView`, `BadgesList`, `CarnetsGrid` | `user_profiles`, `carnets`, `user_badges` | 🟢 |
| `/alertes` | Client | Requis | `NotificationSettings`, `SOSAlertList` | `notification_deliveries`, `user_preferences` | 🟢 |
| `/recompenses` | Client | Requis | `RewardDashboard`, `WithdrawalModal`, `ReferralTree` | `reward_accounts`, `reward_transactions` | 🟢 |
| `/fidelite` | Client | Requis | `LoyaltyStatus`, `TierProgress` | `user_profiles`, `loyalty_tiers` | 🟢 |
| `/gamification` | Client | Requis | `XPBar`, `BadgesGallery`, `Leaderboard` | `user_xp`, `badges`, `leaderboards` | 🟢 |
| `/connexion` | Client | Public | `LoginForm`, `MagicLinkAuth`, `SocialOAuth` | Supabase Auth | 🟢 |
| `/inscription` | Client | Public | `RegisterForm`, `ReferralCodeInput` | Supabase Auth, `reward_accounts` | 🟢 |
| `/admin` | SSR | **Admin** | `AdminDashboard`, `RewardSim`, `UserManagement` | Toutes tables (protégé par middleware) | 🟢 |
| `/admin/produits` | SSR | **Admin** | `ProductInventoryTable`, `StockEditor` | `shop_products`, `inventory_logs` | 🟢 |

---

## 🌍 6. Contenu Éditorial, Géodonnées & SEO

| Route URL | Mode | Authentification | Composants Clés | Tables Supabase / APIs | Statut |
| :--- | :---: | :---: | :--- | :--- | :---: |
| `/pays` | SSR | Public | `CountryGlobe`, `ContinentAccordion` | `geo_countries`, `geo_regions` | 🟢 |
| `/pays/[code]` | SSR (ISR) | Public | `CountryHero`, `LocalHikes`, `GearRecommendations` | `geo_countries`, `hiking_routes`, `shop_products` | 🟢 |
| `/guides` | SSR | Public | `GuidesCatalog`, `SearchFilter` | `guides`, `guides_categories` | 🟢 |
| `/guides/[slug]` | SSR (ISR) | Public | `ArticleRenderer`, `TableOfContents`, `KitEmbed` | `guides`, `user_profiles` | 🟢 |
| `/blog` | SSR | Public | `BlogPostsList`, `NewsletterSignup` | `blog_posts`, `blog_tags` | 🟢 |

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir le schéma complet des tables : [[Tables]]
> - Explorer le catalogue de composants : [[Composants]]
> - Voir les décisions d'architecture : [[Architecture globale]]
