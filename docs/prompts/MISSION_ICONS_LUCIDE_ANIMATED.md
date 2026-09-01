# MISSION : Migration Icônes → lucide-animated

## Contexte

LKDV utilise actuellement `lucide-react` (icônes statiques). Objectif : remplacer les icônes de l'app par leurs équivalents animés de https://lucide-animated.com (lib open-source basée sur Lucide + Motion, composants copiés localement via shadcn CLI, PAS un package npm monolithique).

**Contraintes non négociables :**
- LKDV est en plein audit de performance mobile (First Load JS ≤170 KB, LCP ≤2.0s). `CustomCursor.tsx` est déjà identifié comme le pire offender (rAF infini 60fps). Cette mission NE DOIT PAS régresser ces métriques.
- L'app est mobile-first (BottomTabBar, MobilePageShell). Les icônes lucide-animated s'animent par défaut au **hover** — comportement desktop qui n'existe pas au doigt. Chaque icône installée doit être vérifiée pour un trigger alternatif compatible tactile (tap, animation au montage, ou déclenchement programmatique via ref).
- INTERDICTION d'installer les 350+ icônes de la lib en bloc. Seules les icônes réellement utilisées dans le code sont candidates.

## Phase 0 — Audit (obligatoire avant toute installation)

1. `grep -rn "from ['\"]lucide-react['\"]" src/ --include="*.tsx" --include="*.ts"` pour lister tous les fichiers important depuis lucide-react.
2. Extraire la liste **dédupliquée** des noms d'icônes réellement importés (pas juste le nombre d'occurrences).
3. Pour chaque icône, noter : fichier(s) d'usage, contexte (bouton interactif, décoratif statique, icône de nav, icône de statut/état).
4. Classer chaque icône en 3 catégories :
   - **Interactive** (bouton, nav, action tap) → candidate à l'animation au tap/montage
   - **Décorative statique** (label de carte, indicateur passif) → animation optionnelle, à évaluer au cas par cas
   - **Critique perf** (rendue en boucle, listes longues, ex. items du Parc Matériel) → NE PAS animer, garder `lucide-react` statique pour éviter le coût Motion répété
5. Produire ce tableau dans `MISSION_LOG.md` avant de continuer.

**Gate de validation** : ce tableau doit être soumis avant la Phase 1. Pas d'installation sans audit complet.

## Phase 1 — Vérification de compatibilité Motion

1. Vérifier si `motion` (ou `framer-motion`) est déjà une dépendance du projet (probable si le travail sur le fond animé/couche animée LKDV en cours l'utilise déjà). Si oui, aucun coût marginal de dépendance. Si non, peser l'ajout au bundle avec `npx next build` avant/après sur une icône témoin.
2. Installer UNE icône témoin (ex. `bell`) via `npx shadcn@latest add "https://lucide-animated.com/r/bell.json"`.
3. Mesurer le delta de bundle (`next build` output, comparer First Load JS avant/après) et documenter dans `MISSION_LOG.md`.
4. Si le delta dépasse un seuil raisonnable (à définir : proposition 5 KB gzip pour l'ensemble de la migration), **stop et remonter à Tony** avant de continuer.

## Phase 2 — Migration ciblée

Pour chaque icône de la catégorie **Interactive** validée en Phase 0 :

1. Installer via `npx shadcn@latest add "https://lucide-animated.com/r/<nom>.json"`.
2. Remplacer l'import `lucide-react` par l'import local `@/components/icons/<nom>`.
3. Adapter le trigger : si l'icône est dans un élément cliquable/tappable mobile, câbler l'animation sur l'event `onClick`/`onTouchStart` plutôt que de compter sur `:hover`, ou utiliser la ref exposée par le composant pour déclencher l'animation manuellement si la lib le permet — vérifier au cas par cas dans le code du composant généré.
4. NE PAS toucher aux icônes classées **Critique perf** en Phase 0 — elles restent en `lucide-react` statique.

## Phase 3 — Preuves obligatoires (format standard LKDV)

Dans `MISSION_LOG.md`, pour chaque icône migrée :
- Diff du fichier concerné
- `grep -rn "from ['\"]lucide-react['\"]" src/` → preuve que l'ancien import a disparu pour cette icône
- Capture ou description du comportement testé sur mobile (tap fonctionne, pas seulement hover)

Global, en fin de mission :
- `npm run build` (ou `next build`) qui passe sans erreur, log complet en preuve
- Comparatif First Load JS avant/après migration complète
- Comparatif LCP mobile avant/après (si Lighthouse/PageSpeed disponible dans l'environnement de l'agent)
- Liste finale : X icônes migrées / Y icônes laissées en `lucide-react` volontairement (avec justification issue de la Phase 0)

**Aucune tâche n'est déclarée "terminée" sans ces preuves.** Une déclaration de complétion sans grep/build/comparatif est rejetée et la tâche est renvoyée à l'agent.

## Critère de succès final

- Zéro régression sur First Load JS et LCP mesurés
- Icônes interactives animées et fonctionnelles au tap sur mobile (pas seulement en hover desktop)
- Icônes critique-perf (listes, boucles) intactes en `lucide-react`
- `MISSION_LOG.md` complet avec tableau d'audit Phase 0 + preuves Phase 3
