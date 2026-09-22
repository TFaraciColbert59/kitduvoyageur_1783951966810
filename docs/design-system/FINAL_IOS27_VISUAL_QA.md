# FINAL iOS 27 — Visual QA (refinement mobile)

> Skills appliqués : **apple-ui-designer**, **browser-qa**, **verification-before-completion** (`ui-designer` et `test-engineer` n'existent pas dans cet environnement — non inventés).
> App réelle inspectée sur `http://localhost:4028` (build de production local, captures Playwright + sondes DOM).

---

## 1. Fait dans cette itération

### Verre neutre (fin du verre vert)
- Tokens convergés vers **UN matériau neutre blanc** (`tokens.css`) :
  `--glass-bg-light 0.07` · `--glass-bg-medium 0.10` · `--glass-bg-strong 0.14` · `--glass-border 0.20` · `--glass-border-strong 0.30` · `--glass-highlight 0.36` · `--glass-shadow-final` · `--glass-blur 26px` · `--glass-saturation 1.10` · `--card-saturate 110%`.
- **Recette canonique unique** `.lkv-glass` + `.lkv-glass-interactive` (gradient blanc 0.14 → 0.075, bord blanc, ombre + rim, blur 26 px) dans `tailwind.css` — utilisée par `Card`, `Button`, `IconButton`, `Chip`, `Tabs`, `HeaderBackButton`, `.lkv-material-bar`.
- Voile de fond allégé : vert `rgba(46,92,66,0.26)` (le paysage reste la source principale de vert).

### Contrôles flottants (fin des barres pleine largeur)
- `PageHeader` refondu : **plus aucune barre pleine largeur**. Contrôles **flottants** `fixed` en haut (`top: calc(var(--safe-top) + 8px)`, 16 px de marge, gap 8, verre neutre 44×44), **titre dans la couche contenu** (variantes inline/large + `subtitleLines` 1/2/3 conservé). Compatibilité d'API conservée (`back`, `actions`, `sticky`, `transparent`, `scrollAware`).
- `HeaderBackButton` : contrôle canonique 44×44 en verre neutre.

### Navigation locale (accessoire de la barre principale)
- `NavigationPlateau` compacté : hauteur **48 → 40 px**, plus de chevauchement (`marginBottom: -8 → 0`), même matériau verre neutre que la barre principale, même anatomie d'onglet.

### Bottom bar principale
- Icônes seules, glyphes SF-like (tent / compass / backpack / users / user), **indicateur de sélection = capsule** 64×40 en verre (iOS 26/27 : « the selected capsule is the system-standard visual indicator »), matériau neutre.

### Vérifications visuelles
- Captures réelles : `docs/qa/final-ios27/communaute/` (4 gabarits). Délai de capture porté à 2,8 s pour éviter les états skeleton.
- Inspection de `/communaute` : contrôles flottants ✅, titre en contenu ✅, verre neutre ✅, plateau compact ✅, post réel (Tony, texte) rendu ✅, console sans erreur produit ✅.

## 2. Tests (état final)

`type-check` ✅ 0 · `lint` ✅ 0 · `vitest` ✅ **2 947 tests** · `tests/design` ✅ 162 · `verify:invariants` ✅ 6/6 · `build` ✅ 14,2 s. Contrats recablés : `lot2-shell` (PageHeader flottant), `p5-direction-tokens` (fond + thème sombre).

## 3. NON fait — reste de la mission (honnête)

La boucle QA autonome complète demandée (9 destinations × toutes leurs sections × ≥2 passes visuelles, formulaires, purge primary, centralisation d'icônes, `LocalSectionBar` nommé, `FloatingPageControls` nommé, script `audit-final-ui.mjs`, garde-fous) **n'est pas terminée**. Restent notamment :

1. **Renommer/exposer** les primitives demandées : `FloatingPageControls`, `LocalSectionBar`, `FormSection` (les comportements existent sous `PageHeader`/`NavigationPlateau`/layouts mais pas sous ces noms ni dans `@/design`).
2. **Formulaires** : `/carnets/nouveau` et `/groupes/nouveau` non audités/corrigés ; audit global des formulaires non fait.
3. **Purge primary/green** : ~72 usages live restants (dataviz/statuts conservés + à reclasser), non traités.
4. **Icônes** : `Icon` non étendu au contrat `IconName` sémantique ; couleurs d'icônes non purgées (`icon color classes`).
5. **Pages non revues visuellement** : Home, Matériel, Voyages, Explorer, Messagerie, Profil, Boutique, secondaires, sections locales (feed/carnets/clubs/groupes/sorties/entraide) — captures `docs/qa/final-ios27/<famille>/` non produites.
6. **Script** `scripts/design/audit-final-ui.mjs` non créé ; invariants additionnels (A-I) non ajoutés.
7. `tests/visual/glass-contract.spec.ts` référence encore l'ancienne variante pleine.

## 4. Exceptions conservées
`Badge` (statuts), `Switch` (piste iOS), couleurs de données (dataviz, Leaflet, avatars), back-office `admin/**`, `dev/**`.

## 5. Commit
Voir `git log -1` — arbre git propre, aucun test supprimé, aucune logique métier modifiée.
