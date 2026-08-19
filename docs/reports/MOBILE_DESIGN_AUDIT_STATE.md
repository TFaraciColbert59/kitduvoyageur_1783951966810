# MOBILE DESIGN AUDIT STATE — LE KIT DU VOYAGEUR

## 1. LES 4 INVARIANTS ABSOLUS

1. **Zéro régression fonctionnelle.** Chaque bouton, formulaire, navigation, appel API, interaction (haptique, drag, swipe) qui fonctionne aujourd'hui doit fonctionner identiquement après. Le changement est **visuel uniquement** : classes CSS, styles inline, structure de mise en page, espacement, typographie, couleurs — jamais la logique JS, les props de données, les appels Supabase, les routes API.
2. **Ce chantier ne touche QUE la vue mobile.** Toute section marquée desktop (`hidden md:block` et son contenu) reste intouchée. On ne touche qu'à ce qui est dans `block md:hidden` / rendu via `MobilePageShell`.
3. **`CLAUDE.md` est la source de vérité du design system, pas ta mémoire ni ton jugement esthétique.** Palette (Foreground/Sage/Stone/Ink), typographie (Söhne/Inter, Georgia italique pour emphase, JetBrains Mono pour données), le pattern glassmorphism, les conventions de fallback image — tout vient de ce fichier. Si `CLAUDE.md` ne couvre pas un cas rencontré, documente-le dans `MOBILE_DESIGN_AUDIT_STATE.md` comme decision à prendre, ne l'invente pas silencieusement.
4. **`#E4501C` (orange) reste interdit**, comme déjà spécifié dans `CLAUDE.md`. Si tu le trouves quelque part en mobile, c'est une non-conformité à corriger avec `foreground-800 #17402C`.

---

## 2. ÉTAPES ET PROGRÈS DES PAGES À AUDITER

| # | Page / Chemin | Fichier Source | Statut |
|---|---|---|---|
| 1 | Accueil | `src/components/mobile-nav/MobileHomePage.tsx` | ✅ Complété (spacer ajouté) |
| 2 | Explorer | `src/app/explorer/page.tsx` | ✅ Complété (loader/error/empty et radius harmonisés) |
| 3 | Fiche Produit | `src/app/produit/[slug]/ProductDetailClient.tsx` | ✅ Complété (refactorisation totale en inline styles) |
| 4 | Panier | `src/app/panier/page.tsx` | ✅ Complété (déjà conforme en inline styles) |
| 5 | Checkout | `src/app/checkout/page.tsx` | ✅ Complété (spacer ajouté, styles conformes) |
| 6 | Communauté | `src/app/communaute/page.tsx` | ✅ Complété (spacer ajouté, hover orange corrigé) |
| 7 | Admin | `src/app/admin/page.tsx` | ✅ Complété (contraste de couleur corrigé sur la barre supérieure) |
| 8 | Carnet de voyage (Fiche) | `src/app/carnets/[id]/page.tsx` | ✅ Complété (déjà conforme en inline styles dans CarnetView) |
| 9 | Terrain (Hub) | `src/app/terrain/page.tsx` | ✅ Complété (déjà conforme en inline styles dans TerrainHub) |
| 10 | ~~Jumeau 3D~~ (supprimé) | ~~`src/app/jumeau-3d/page.tsx`~~ | ❌ Page supprimée définitivement (mission refonte Mon Matériel v3) — la fiche de la mission interdit toute référence restante |
| 11 | Rapport Kit | `src/app/rapport-kit/page.tsx` | ✅ Complété (contraste corrigé, spacer rendu inconditionnel) |
| 12 | Rapport Expédition | `src/app/rapport-expedition/page.tsx` | ✅ Complété (déjà conforme en inline styles) |
| 13 | Boutique (Index) | `src/app/boutique/page.tsx` | ✅ Complété (spinner refactorisé, spacer ajouté dans BoutiqueClient) |
| 14 | Groupes (Fiche) | `src/app/groupes/[groupId]/page.tsx` | ✅ Complété (sans couleur orange, structure conforme) |
| 15 | Clubs (Index) | `src/app/clubs/page.tsx` | ✅ Complété (spacer ajouté, styles conformes) |
| 16 | Clubs (Fiche) | `src/app/clubs/[id]/page.tsx` | ✅ Complété (spacer ajouté, styles conformes) |
| 17 | Événements (Index) | `src/app/evenements/page.tsx` | ✅ Complété (spinner refactorisé, spacer ajouté) |
| 18 | Messagerie (Index) | `src/app/messagerie/page.tsx` | ✅ Complété (spacer ajouté, styles conformes) |
| 19 | Compte (Dashboard) | `src/app/compte/page.tsx` | ✅ Complété (déjà conforme en inline styles dans MobileCompteV2) |
| 20 | Pays (Index) | `src/app/pays/page.tsx` | ✅ Complété (responsive natif, conforme sans orange) |
| 21 | Pays (Fiche Guide) | `src/app/pays/[code]/page.tsx` | ✅ Complété (déjà 100% en inline styles) |
| 22 | Alertes | `src/app/alertes/page.tsx` | ✅ Complété (spinner refactorisé, styles conformes) |
| 23 | Avis | `src/app/avis/page.tsx` | ✅ Complété (modal refactorisé en inline styles) |
| 24 | Mes-aventures | `src/app/mes-aventures/page.tsx` | ✅ Complété (spinner refactorisé, styles conformes) |

---

## 3. DÉCISIONS DE DESIGN PRISES

- *À documenter à chaque étape.*

---

## 4. ⚠️ TENTATIONS DE SCOPE-CREEP ÉVITÉES

- *À documenter à chaque étape.*
