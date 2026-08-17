# MISSION_APPLE_PERFECT_MON_MATERIEL.md

## Statut : À FAIRE — Passe 2 (raffinement, pas reconstruction)
## Portée : 100% visuelle/interaction. Zéro hook, zéro route, zéro logique métier touchée.

---

# INIT — À charger avant toute mission

## Skills à lire intégralement avant d'écrire une seule ligne
- `.agents/skills/lkdv-development/SKILL.md`
- `.agents/skills/supabase-postgis/SKILL.md`
- `.agents/skills/ux-mobile/SKILL.md`
- `.agents/skills/nextjs-performance/SKILL.md`
- `.agents/skills/security-audit/SKILL.md`
- `.agents/skills/testing-qa/SKILL.md`

(Cette mission est purement visuelle/interaction — pas de skill map-geospatial ni SEO nécessaire ici. Ignorer les 25 skills `seo-*` génériques.)

## Fichiers à lire avant toute modification
- `docs/MISSION_LOG.md` — ne pas répéter un travail déjà fait ou rejeté lors de la Passe 1
- `docs/ETAT_DES_LIEUX_GLOBAL.md`
- `docs/reports/` — relire le rapport de preuve de la Passe 1 précédente (fond/cartes glass/accent) s'il existe, pour ne pas défaire ce qui a déjà été validé
- `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/types.ts`
- `src/app/mon-materiel/page.tsx` — **le lire EN ENTIER, les 1005 lignes, colonne 3 et drawers inclus**, dans son état réel actuel sur disque, jamais depuis mémoire/résumé d'une session précédente
- `src/components/inventaire/AddEditGearModal.tsx`, `GearDetailDrawer.tsx`, `KitCockpitDrawer.tsx`, `LendItemModal.tsx`
- `src/hooks/useEquipment.ts`, `src/hooks/useUserKits.ts`, `src/hooks/useHapticFeedback.ts` — **lecture seule**, comprendre leur contrat (props/retours) sans les modifier
- `tailwind.config.js` — avant de créer des classes utilitaires custom (niveaux d'élévation), vérifier ce qui existe déjà pour éviter les doublons

## Règles non négociables
1. Ne jamais inventer de table, colonne, fonction ou route. Vérifier via requête SQL directe sur le projet Supabase `icxyvwzfjbflcbqukpfz` (eu-west-3) — jamais via l'historique de migrations seul.
2. Le projet fantôme `lwrmuggefbmboikjgudc` n'existe plus / n'est pas la cible — ignorer si un outil MCP le propose.
3. Ne PAS toucher à `useEquipment.ts` ni `useUserKits.ts`. Lecture seule strictement.
4. Chaque AXE ci-dessous doit être traité et coché dans ce fichier au fur et à mesure — ne pas déclarer un AXE fait sans preuve tangible (extrait de code, ligne exacte).
5. Travail 100% autonome, pas de boucle de confirmation — utiliser `docs/MISSION_LOG.md` comme canal asynchrone de compte-rendu.
6. Toute mission se termine par un fichier de preuve dans `docs/reports/` (voir section finale) — aucune déclaration "terminé" sans lui.

---

## Contexte
La Passe 1 a posé les bonnes fondations : fond net, cartes glass `rgba(255,255,255,0.12)` + `backdrop-blur(24px) saturate(180%)`, accent `#D4F973` discipliné sur nav/CTA. **C'est un bon début, pas fini.** Comparé à un vrai produit Apple (Apple.com, Apple Card, macOS Control Center), il manque la couche de finition qui fait la différence entre "joli" et "parfait" : hiérarchie de profondeur, micro-interactions physiques, cohérence systématique, états manquants, accessibilité.

---

## AXE 1 — Hiérarchie de profondeur (elevation system)
Actuellement tous les panneaux glass utilisent EXACTEMENT la même recette (`0.12` opacité, `blur(24px)`, même ombre). Un vrai système Apple a 3-4 niveaux d'élévation distincts :

- **Niveau 0 (fond)** : image nette, aucun changement.
- **Niveau 1 (panneaux de structure — dock, colonnes, header)** : `rgba(255,255,255,0.10)`, `blur(20px)`, ombre `0 8px 32px rgba(0,0,0,0.18)`.
- **Niveau 2 (cartes internes — item de la liste, combo cards, bulle IA)** : `rgba(255,255,255,0.16)`, `blur(16px)`, ombre plus courte `0 4px 16px rgba(0,0,0,0.15)` — doit paraître visuellement "posée sur" le niveau 1, pas au même plan.
- **Niveau 3 (élément sélectionné/actif, modals, drawers)** : `rgba(255,255,255,0.24)`, ombre portée plus large et plus sombre `0 12px 40px rgba(0,0,0,0.35)` + `scale(1.01)` — doit clairement "flotter" au-dessus de tout le reste.

Créer ces 4 niveaux comme constantes Tailwind réutilisables (ex. `glass-1`, `glass-2`, `glass-3` dans `tailwind.config.js` sous forme de classes utilitaires custom ou de composant `<GlassPanel level={1|2|3}>`) plutôt que de dupliquer le style inline partout — actuellement le style inline `rgba(...)` est répété identique à 6+ endroits, ce qui est fragile et incohérent dès qu'on veut ajuster.

## AXE 2 — Micro-interactions (le detail qui fait "vivant")
- Toutes les transitions doivent utiliser une courbe d'easing Apple, pas le easing par défaut de Tailwind : `transition-[all] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`.
- `whileHover`/`whileTap` (déjà utilisé via framer-motion sur les cartes item) doit être étendu à TOUS les éléments cliquables : boutons du dock, capsule nav, combo cards, bouton "+Ajouter", CTA. Actuellement seules les cartes de la colonne 1 l'ont.
- Ajouter un état `whileTap={{ scale: 0.96 }}` cohérent partout (actuellement seulement `0.99` sur les cartes item — trop subtil pour être perçu, remonter à `0.96-0.97`).
- Le badge "connecté" (`bg-[#D4F973] animate-pulse`) doit utiliser une animation de pulse plus douce et organique, pas le `animate-pulse` Tailwind par défaut (trop mécanique) : définir un keyframe custom `@keyframes glow-pulse` avec variation d'opacity ET de box-shadow sur 2s, ease-in-out.
- Ajouter un effet de "press" physique sur le dock : au clic, léger `translateY(1px)` en plus du scale, pour simuler un vrai bouton physique.

## AXE 3 — Cohérence systématique (le detail qui fait "agence")
- **Rayons de bordure** : actuellement mélange de `rounded-[20px]`, `rounded-[16px]`, `rounded-[14px]`, `rounded-[12px]`, `rounded-xl`, `rounded-full` sans règle apparente. Définir une échelle stricte et documentée en commentaire en haut du fichier : `4px` (chips), `12px` (miniatures image), `16px` (cartes internes), `20px` (panneaux structure), `full` (pills/avatars) — et l'appliquer strictement, plus aucune valeur hors échelle.
- **Espacements** : vérifier que tous les `gap-*`, `p-*`, `space-y-*` suivent une grille de 4px (2, 2.5, 3, 3.5 — actuellement déjà proche, à auditer et corriger les écarts comme `pb-2.5` vs `pb-2` utilisés sans logique apparente entre sections similaires).
- **Typographie** : les tailles de texte (`text-[9.5px]`, `text-[10px]`, `text-[11px]`, `text-[12.5px]`, `text-xs`, `text-sm`) doivent être réduites à une échelle de 4-5 paliers maximum, pas des valeurs arbitraires au pixel près répétées différemment à chaque endroit.
- **Icônes** : uniformiser `strokeWidth` (actuellement 2 et 2.2 mélangés) et les tailles (13, 17, 18px) sur une échelle cohérente selon le contexte (16px icônes dock, 14px icônes inline, 12px icônes micro).

## AXE 4 — États manquants (le detail qui fait "produit fini")
Actuellement le fichier ne montre aucune gestion de :
- [ ] **État vide** : si `filteredEquipment.length === 0` (recherche sans résultat, catégorie vide) → afficher un empty state avec icône, message ("Aucun équipement trouvé pour « {searchQuery} »") et CTA pour réinitialiser les filtres. Vérifier si ce cas est géré ailleurs dans le fichier (ligne >600) ; sinon l'ajouter.
- [ ] **État de chargement** : pendant le chargement initial de `useEquipment()`/`useUserKits()` (avant que les données Supabase arrivent), afficher un skeleton loader glass (rectangles pulsants `bg-white/10 animate-pulse`) au lieu d'un flash de liste vide.
- [ ] **État `activeItem === null`** (aucun équipement du tout, compte neuf) : la colonne 3 (hero produit) doit avoir un fallback explicite ("Ajoutez votre premier équipement pour commencer"), pas planter ou afficher un vide silencieux.
- [ ] **Focus visible clavier** : chaque bouton/input doit avoir un `focus-visible:ring-2 focus-visible:ring-[#D4F973] focus-visible:ring-offset-2 focus-visible:ring-offset-black/20` — actuellement seul l'input recherche a un focus ring, aucun bouton n'en a. Nécessaire pour l'accessibilité clavier ET pour le rendu "premium" (Apple soigne toujours l'état focus).

## AXE 5 — Colonne 3 (hero produit) — à vérifier et compléter
Lire la fin du fichier (probablement lignes 400-1005) et confirmer/compléter :
- [ ] Ellipse d'ombre floue sous l'objet (`radial-gradient` noir + `blur(20px)`, positionnée en `absolute bottom-0`).
- [ ] Halo lumineux haut-gauche (`radial-gradient` blanc/vert-clair 8-10% opacité).
- [ ] Le panneau du hero doit être Niveau 2 de l'AXE 1 (pas un blanc plat résiduel).
- [ ] Boutons d'action sur l'item actif (favoris, prêt, fiche complète, ajouter au panier) : vérifier qu'ils suivent la même discipline d'accent (AXE couleur, un seul CTA vert vif, le reste neutre).
- [ ] Transition douce (`AnimatePresence` + `motion.div` avec `key={activeItem.id}`) lors du changement d'item sélectionné — un fade+slide léger (`initial={{opacity:0, x:8}}`), pas un changement brutal.

## AXE 6 — Combo Cards IA & reste du fichier (lignes non encore auditées)
Continuer la lecture au-delà de la colonne 2 (bulle IA) : les "Mini Combo Cards" (`AI_PRESET_COMBOS`), puis colonne 3, dock bar bas éventuel, drawers (`GearDetailDrawer`, `KitCockpitDrawer`, `AddEditGearModal`, `LendItemModal`). Vérifier qu'ils respectent TOUS la même charte (AXE 1-4) — un cockpit "parfait" n'a pas une zone soignée et une autre négligée. Documenter dans le rapport final l'état de chaque zone auditée.

---

## CONTRAINTES TECHNIQUES (inchangées)
- Ne pas toucher `useEquipment.ts`, `useUserKits.ts`, aucun hook, aucune route.
- `next/image` + `priority` conservés pour le fond.
- Respecter `prefers-reduced-motion` : toutes les nouvelles animations (pulse, halo, transitions de sélection) doivent avoir une variante statique si `prefers-reduced-motion: reduce`.
- Tester le rendu à 3 largeurs : 390px (mobile), 768px (tablette — colonnes 2/3 masquées selon le code actuel `hidden md:flex`), 1440px (desktop).

---

## PROTOCOLE DE VÉRIFICATION — obligatoire après CHAQUE axe, pas seulement à la fin
Pour chaque AXE 1 à 6, avant de passer au suivant :
1. Relire le fichier modifié dans son état réel sur disque (jamais se fier à ce qui a été écrit en mémoire de la session).
2. `npm run lint` et `npm run type-check` doivent passer sans nouvelle erreur introduite.
3. Grep de contrôle : vérifier qu'aucune classe hors échelle (AXE 3) ne subsiste — ex. `grep -rn "rounded-\[1[0-9]px\]" src/app/mon-materiel/page.tsx` doit ne retourner que les valeurs de l'échelle validée.
4. Confirmer par une recherche que `useEquipment.ts` et `useUserKits.ts` n'ont pas été modifiés (`git diff --stat` doit les exclure).
5. Noter le résultat de ces 4 contrôles dans `docs/MISSION_LOG.md` avant de continuer à l'axe suivant.

## VÉRIFICATION FINALE OBLIGATOIRE
Créer/mettre à jour `docs/reports/MON_MATERIEL_APPLE_PERFECT_STATE.md` avec :
1. Tableau des 4 niveaux d'élévation définis + où chacun est appliqué (fichier:ligne).
2. Liste des états vides/loading/focus ajoutés + preuve (extrait de code).
3. Audit complet AXE 6 : chaque zone du fichier (au-delà de la colonne 2) listée avec statut conforme/à corriger.
4. Résultat `npm run lint` + `npm run type-check` (sortie complète ou résumé avec 0 erreur confirmé).
5. `git diff --stat` complet de la mission, confirmant l'absence de modification sur les hooks/routes.
6. Capture AVANT/APRÈS ou description précise si capture impossible.

**Ne pas déclarer la mission terminée sans ce rapport complet et sans les 6 points cochés.**