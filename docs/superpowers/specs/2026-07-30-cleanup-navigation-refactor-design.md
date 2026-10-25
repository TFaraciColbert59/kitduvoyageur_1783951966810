---
name: Cleanup Navigation Refactor Design
description: Dead code removal, IA consolidation, and mobile navigation refactor for LKDV
type: spec
---

# Cleanup & Navigation Refactor — Design Spec

## Contexte
Nettoyage de code mort, consolidation des pages IA concurrentes, masquage des pages inachevées, et refonte du tiroir de navigation mobile pour éliminer les doublons et couvrir toutes les routes du site.

---

## ÉTAPE 1 — Supprimer les routes mortes (DÉJÀ FAIT)
- Routes `/shop`, `/catalogue`, `/configurateur` supprimées (fichiers déjà en `git rm`)
- Redirects 308 dans `next.config.mjs` déjà en place
- Sitemap déjà nettoyé

## ÉTAPE 2 — Supprimer le code mort des composants homepage
Supprimer les 13 fichiers dans `src/app/components/` — aucun n'est importé par la page d'accueil active (`src/app/page.tsx` qui est entièrement inline).
- `HeroSection.tsx`, `FeaturesSection.tsx`, `CategoriesSection.tsx`, `PopularKitsSection.tsx`
- `SocialProofSection.tsx`, `VerifiedReviewsSection.tsx`, `BelowFoldSections.tsx`
- `ConfiguratorTeaser.tsx`, `CountryTeaserSection.tsx`, `HomePageClient.tsx`
- `HomePageContent.tsx`, `HomePageDynamic.tsx`, `HomepageV1.tsx`

Ne pas toucher à `src/components/home/*` (version active, intacte).

## ÉTAPE 3 — Consolider les 3 fonctionnalités IA concurrentes
- `/ai-configurator` : unique point d'entrée IA visible dans toute la navigation
- `/copilote` : extraire le bouton flottant de `/naviguer` en composant réutilisable `<CopilotFAB />` ; retirer `/copilote` de toute navigation structurée mais laisser la page accessible par URL directe
- `/voyage-ia` : masquer de toute navigation (contenu inachevé, bloqué phase "intro") ; ne pas supprimer le fichier

## ÉTAPE 4 — Masquer les pages à contenu inachevé
- `/gamification` et `/communaute-pro` : retirer de toute navigation (drawer, liens internes)
- Accessibles uniquement par URL directe en attendant

## ÉTAPE 5 — Refonte de la navigation mobile

### BottomTabBar (inchangée — déjà correcte)
5 onglets : Accueil(/), Aventures(/explorer), Boutique(/boutique), Communauté(/communaute), Compte(/compte)

### MobileDrawer — Nouvelle structure

**Header :** Supprimer "Accueil" et "Paramètres" (doublons exacts de la barre basse)

**Section "Découvrir"** (renommer l'actuelle "Naviguer") :
- Carte interactive → `/carte-interactive`
- Carnets → `/carnets`
- Guides → `/guides`
- Blog → `/blog`
- Outils terrain → `/outils`
- Mode rando GPS/SOS → `/naviguer` (déplacé ici, actuellement orphelin)

**Section "Vie pro & occasion"** (nouvelle) :
- Location → `/location`
- Enchères → `/encheres`
- Espace Pro → `/pro`
- Ambassadeurs/Créateurs → `/ambassadeurs`, `/createurs`

**Section "Compte & légal"** (nouvelle) :
- Historique/Rapports → `/mes-aventures`, `/rapport-expedition`, `/rapport-kit`
- Aide → `/faq`, `/contact`
- Mentions légales → `/cgu`, `/cgv`, `/mentions-legales`, `/politique-confidentialite`

**Footer :** Conserver "Premium Voyageur" → `/abonnements`

Principe : chaque route du site atteignable en 2 taps max, aucun libellé en doublon entre la barre basse et le tiroir.

## ÉTAPE 6 — Vérification finale
- `npm run build` sans erreur
- Vérification manuelle des entrées de navigation
- Rapport final des fichiers supprimés/modifiés
