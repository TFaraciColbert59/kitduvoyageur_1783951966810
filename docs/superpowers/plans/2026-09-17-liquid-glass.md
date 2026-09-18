# LKDV — Unification Liquid Glass

**Objectif :** appliquer le cahier des charges utilisateur du 17 septembre 2026 sans modifier les données ni les règles métier.
**Architecture :** `GlassCard` et la classe sémantique `.glass` partagent une recette CSS et les tokens de `tokens.css`. Garder les éléments HTML existants (liens, articles, panneaux), sans wrapper généralisé. Les six variantes sont base, elevated, interactive, selected, overlay, critical. Le premium est un prototype isolé tant que la validation sur matériel réel manque.
**Stack :** Next 15.5.25, React 19.0.3, TypeScript, CSS, Vitest, Playwright, axe.

## Contraintes communes

- Mobile 320×568, 390×844, 430×932 ; tablette dans les deux orientations ; desktop.
- Aucun changement métier, aucun accès en écriture aux données distantes.
- Tokens partagés, pas de recette par route ; aucun blur de sous-surface imbriqué.
- Cibles interactives 44×44 ; clavier, contraste AA, reduced motion/transparency et fallback sans backdrop.
- Réfraction avancée jamais activée globalement avant mesures comparables et validation mobile réelle.
- Ne pas mettre à jour les snapshots existants pour accepter des régressions.

## Séquence et preuves

- [x] Rechercher Apple officiel et inspecter les sources des deux bibliothèques.
- [ ] Produire inventaire automatique des routes/surfaces et captures avant (`docs/visual/liquid-glass`).
- [ ] Tests comportementaux RED du contrat GlassCard : SSR, activation, disabled, variantes, contenu conservé.
- [ ] Ajouter tokens communs dans `src/styles/tokens.css`, recette et adaptateurs dans `src/styles/liquid-glass.css`, supprimer uniquement les recettes remplacées avec preuve d'usage.
- [ ] Prototype isolé sur trois cards et captures des trois routes représentatives ; comparer standard/rdev/samasante.
- [ ] Migrer contrôles et panneaux partagés ; préserver focus trap, handlers, safe areas et géométrie.
- [ ] Migrer les styles concurrents identifiés, inventorier explicitement toute exception restante.
- [ ] Exécuter tests ciblés, typecheck, build si disponible, captures après et axe ; contrôler erreurs, overflow, nesting et scroll.
- [ ] Revue indépendante des modifications, correction des régressions, rapport de validation et limites.

## Décision visuelle

Une surface standard teintée stone laisse passer le fond tout en protégeant la lecture. Bord extérieur discret, reflet supérieur fin, ombre courte et rayon commun. Les sous-surfaces utilisent un remplissage sans nouveau backdrop. Overlay augmente la protection du texte. Selected et critical ajoutent un signal de bordure, sans recolorer les données. Les états tactiles utilisent uniquement transform/opacity, sans boucle JavaScript par card.

## Validation

Vitest exerce le rendu serveur et les handlers réels des primitives. Playwright vérifie les styles calculés, les préférences d'accessibilité et le clavier dans le prototype, puis les routes accessibles sans authentification. Le harness archive les captures séparément des golden snapshots. Mesures dev/headless = observations de laboratoire, pas preuve de FPS mobile, GPU ou batterie. Les routes authentifiées et appareils physiques restent des portes d'acceptation explicites si indisponibles.
