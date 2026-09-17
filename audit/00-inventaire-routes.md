# Inventaire des routes — LKDV Opération Zéro Défaut

**Date:** 2026-09-17
**Branche:** `chantier/zero-defaut` (base: `perf/instant-feel` @ 70ad037a)
**Total pages:** 76 (75 pages App Router `page.tsx` + 1 route handler critique `/auth/callback`)

## Synthèse de la répartition

- **P0 (Chemin critique, 14 routes) :** Flux d'atterrissage, auth, hub, navigation pays, catalogue & fiches, compte utilisateur.
- **P1 (Fréquent, 20 routes) :** Communauté, carnets, clubs, messagerie, boutique, occasion, panier, checkout, voyages, lieux, blog.
- **P2 (Secondaire / utilitaire / légal, 42 routes) :** Admin, outils spécialisés, guides, simulateurs, pages légales et redirections.

---

## Routes par priorité

| # | Route | Fichier | Priorité | Auth | Statut |
|---|---|---|---|---|---|
| 1 | `/` | `src/app/page.tsx` | P0 | non | à tester |
| 2 | `/inscription` | `src/app/inscription/page.tsx` | P0 | oui | à tester |
| 3 | `/connexion` | `src/app/connexion/page.tsx` | P0 | oui | à tester |
| 4 | `/auth/callback` | `src/app/auth/callback/route.ts` | P0 | oui | à tester |
| 5 | `/explorer` | `src/app/explorer/page.tsx` | P0 | non | à tester |
| 6 | `/pays/[code]` | `src/app/pays/[code]/page.tsx` | P0 | non | à tester |
| 7 | `/hub` | `src/app/hub/page.tsx` | P0 | non | à tester |
| 8 | `/hub/[section]` | `src/app/hub/[section]/page.tsx` | P0 | non | à tester |
| 9 | `/hub/nouveau` | `src/app/hub/nouveau/page.tsx` | P0 | non | à tester |
| 10 | `/compte` | `src/app/compte/page.tsx` | P0 | oui | à tester |
| 11 | `/compte/modifier` | `src/app/compte/modifier/page.tsx` | P0 | oui | à tester |
| 12 | `/profil/[id]` | `src/app/profil/[id]/page.tsx` | P0 | non | à tester |
| 13 | `/kits` | `src/app/kits/page.tsx` | P0 | non | à tester |
| 14 | `/produit/[slug]` | `src/app/produit/[slug]/page.tsx` | P0 | non | à tester |
| 15 | `/communaute` | `src/app/communaute/page.tsx` | P1 | oui | à tester |
| 16 | `/communaute/publier` | `src/app/communaute/publier/page.tsx` | P1 | oui | à tester |
| 17 | `/carnets` | `src/app/carnets/page.tsx` | P1 | oui | à tester |
| 18 | `/carnets/[id]` | `src/app/carnets/[id]/page.tsx` | P1 | non | à tester |
| 19 | `/carnets/nouveau` | `src/app/carnets/nouveau/page.tsx` | P1 | oui | à tester |
| 20 | `/clubs` | `src/app/clubs/page.tsx` | P1 | oui | à tester |
| 21 | `/clubs/[id]` | `src/app/clubs/[id]/page.tsx` | P1 | oui | à tester |
| 22 | `/clubs/nouveau` | `src/app/clubs/nouveau/page.tsx` | P1 | oui | à tester |
| 23 | `/messagerie` | `src/app/messagerie/page.tsx` | P1 | oui | à tester |
| 24 | `/nouveau-groupe` | `src/app/nouveau-groupe/page.tsx` | P1 | oui | à tester |
| 25 | `/boutique` | `src/app/boutique/page.tsx` | P1 | non | à tester |
| 26 | `/occasion` | `src/app/occasion/page.tsx` | P1 | oui | à tester |
| 27 | `/panier` | `src/app/panier/page.tsx` | P1 | oui | à tester |
| 28 | `/checkout` | `src/app/checkout/page.tsx` | P1 | oui | à tester |
| 29 | `/voyages/[slug]` | `src/app/voyages/[slug]/page.tsx` | P1 | oui | à tester |
| 30 | `/voyages/[slug]/[section]` | `src/app/voyages/[slug]/[section]/page.tsx` | P1 | non | à tester |
| 31 | `/feed` | `src/app/feed/page.tsx` | P1 | non | à tester |
| 32 | `/lieux` | `src/app/lieux/page.tsx` | P1 | oui | à tester |
| 33 | `/lieux/[slug]` | `src/app/lieux/[slug]/page.tsx` | P1 | oui | à tester |
| 34 | `/blog` | `src/app/blog/page.tsx` | P1 | non | à tester |
| 35 | `/abonnements` | `src/app/abonnements/page.tsx` | P2 | non | à tester |
| 36 | `/admin` | `src/app/admin/page.tsx` | P2 | oui | à tester |
| 37 | `/admin/produits` | `src/app/admin/produits/page.tsx` | P2 | oui | à tester |
| 38 | `/ai-configurator` | `src/app/ai-configurator/page.tsx` | P2 | non | à tester |
| 39 | `/ambassadeurs` | `src/app/ambassadeurs/page.tsx` | P2 | oui | à tester |
| 40 | `/avis` | `src/app/avis/page.tsx` | P2 | oui | à tester |
| 41 | `/carbone` | `src/app/carbone/page.tsx` | P2 | non | à tester |
| 42 | `/carte-interactive` | `src/app/carte-interactive/page.tsx` | P2 | non | à tester |
| 43 | `/cgu` | `src/app/cgu/page.tsx` | P2 | non | à tester |
| 44 | `/cgv` | `src/app/cgv/page.tsx` | P2 | non | à tester |
| 45 | `/communaute-pro` | `src/app/communaute-pro/page.tsx` | P2 | non | à tester |
| 46 | `/compte/[userId]` | `src/app/compte/[userId]/page.tsx` | P2 | non | à tester |
| 47 | `/contact` | `src/app/contact/page.tsx` | P2 | non | à tester |
| 48 | `/cookies` | `src/app/cookies/page.tsx` | P2 | non | à tester |
| 49 | `/copilote` | `src/app/copilote/page.tsx` | P2 | non | à tester |
| 50 | `/createurs` | `src/app/createurs/page.tsx` | P2 | non | à tester |
| 51 | `/entraide` | `src/app/entraide/page.tsx` | P2 | non | à tester |
| 52 | `/evenements` | `src/app/evenements/page.tsx` | P2 | oui | à tester |
| 53 | `/experts` | `src/app/experts/page.tsx` | P2 | oui | à tester |
| 54 | `/faq` | `src/app/faq/page.tsx` | P2 | non | à tester |
| 55 | `/fidelite` | `src/app/fidelite/page.tsx` | P2 | oui | à tester |
| 56 | `/guides` | `src/app/guides/page.tsx` | P2 | non | à tester |
| 57 | `/guides/[slug]` | `src/app/guides/[slug]/page.tsx` | P2 | non | à tester |
| 58 | `/hors-ligne` | `src/app/hors-ligne/page.tsx` | P2 | non | à tester |
| 59 | `/k/[token]` | `src/app/k/[token]/page.tsx` | P2 | non | à tester |
| 60 | `/kits/[slug]` | `src/app/kits/[slug]/page.tsx` | P2 | non | à tester |
| 61 | `/location` | `src/app/location/page.tsx` | P2 | oui | à tester |
| 62 | `/manifeste` | `src/app/manifeste/page.tsx` | P2 | non | à tester |
| 63 | `/mentions-legales` | `src/app/mentions-legales/page.tsx` | P2 | non | à tester |
| 64 | `/outils` | `src/app/outils/page.tsx` | P2 | non | à tester |
| 65 | `/outils/[slug]` | `src/app/outils/[slug]/page.tsx` | P2 | non | à tester |
| 66 | `/politique-confidentialite` | `src/app/politique-confidentialite/page.tsx` | P2 | non | à tester |
| 67 | `/preparer-randonnee` | `src/app/preparer-randonnee/page.tsx` | P2 | non | à tester |
| 68 | `/preparer-sentier/[id]` | `src/app/preparer-sentier/[id]/page.tsx` | P2 | oui | à tester |
| 69 | `/preparer-sentier/apercu` | `src/app/preparer-sentier/apercu/page.tsx` | P2 | non | à tester |
| 70 | `/pro` | `src/app/pro/page.tsx` | P2 | non | à tester |
| 71 | `/profil` | `src/app/profil/page.tsx` | P2 | non | à tester |
| 72 | `/publier` | `src/app/publier/page.tsx` | P2 | oui | à tester |
| 73 | `/randonnee-active` | `src/app/randonnee-active/page.tsx` | P2 | non | à tester |
| 74 | `/rapport-expedition` | `src/app/rapport-expedition/page.tsx` | P2 | oui | à tester |
| 75 | `/recompenses` | `src/app/recompenses/page.tsx` | P2 | oui | à tester |
| 76 | `/rejoindre/[slug]` | `src/app/rejoindre/[slug]/page.tsx` | P2 | oui | à tester |
