# Kit Studio : liste de contrôle accessibilité

Source : `kit-studio-bundle/spec/SPEC-DRAWER.md` §Accessibilité et `SPEC-PRODUIT.md` §Textes.
Une case n'est cochée que si le point est vérifié dans le code (référence fichier:ligne, lignes du dépôt à la date de T17). Une case non cochée signifie « non vérifié » ou « non conforme », précisé en note.

Les chaînes proviennent de `src/features/kit-studio/ui/strings.ts` (objet `S`).

## Règles transverses

- [x] Rôles : tiroir `role="dialog"` non modal (`Drawer/Dock.tsx:53-54`), capsules `tablist`/`radiogroup` (`Drawer/Capsule.tsx:61`), pages `group` (`Drawer/Pager.tsx:40-42`).
- [x] Chaque bouton icône porte un `aria-label` : poignée (`Drawer/Grab.tsx:52`), bouton flottant (`Drawer/Grab.tsx:71`), onglets (`Drawer/Capsule.tsx:76`), pilule (`Pill.tsx:61`).
- [x] Pictos décoratifs masqués (`icons.tsx:30`, `Pill.tsx:62`).
- [ ] Contrastes AA : non mesurés. Le contour de focus utilise `--ks-on` (`kit-studio.css:7`), contraste à calculer sur fond `--ks-paper` avant de cocher.
- [x] Pages de la maquette montées après la revue T22 : cartes (`cards/CardsView.tsx`), Bilan et Fiche (`sheets/BilanSheet.tsx`, `ItemSheet.tsx`), Sac et Commande (`sheets/BagSheet.tsx`, `OrderSheet.tsx`), deck (`sheets/DeckSheet.tsx`), toutes montées par `ui/SheetHost.tsx` dans le tiroir. Vérifiées par `tests/e2e-kit-studio/kit-studio.spec.ts` sur WebKit mobile.

## Composants existants

### Tiroir (`Drawer/Dock.tsx`)
- [x] Nom accessible de la vue : `aria-label={label}` (`Dock.tsx:55`).
- [x] Non modal : `aria-modal="false"` (`Dock.tsx:54`).
- [x] Focus déplacé à l'ouverture (`Dock.tsx:30-35`), rendu au déclencheur à la fermeture (`Dock.tsx:37-39`).
- [x] Échap ferme (`Dock.tsx:42-47`).
- [x] Tiroir fermé inerte (`Dock.tsx:58`).
- [ ] Ordre de focus poignée → contenu → barre basse : la poignée est rendue en premier (`Dock.tsx:62`, puis `children` à `Dock.tsx:63`). La position de la barre basse dépend de l'intégration et n'est pas encore vérifiable.

### Poignée (`Drawer/Grab.tsx`)
- [x] Libellé « Fermer le tiroir » via `S.drawer.grab` (`Grab.tsx:52`, défaut `ui/strings.ts`).
- [x] Clavier : clic synthétique (`detail === 0`) ferme (`Grab.tsx:58-60`).
- [x] Cible tactile ≥ 44 px : la zone de 18 px est étendue par `::after` (`kit-studio.css:273-277`, `inset: 0 0 -26px`), soit 44 px de hauteur, pleine largeur.
- [x] Bouton flottant « Ouvrir le tiroir » (`Grab.tsx:71`), retiré de la tabulation quand le tiroir est ouvert (`Grab.tsx:73`).

### Capsules (`Drawer/Capsule.tsx`)
- [x] Rôle `tablist`/`radiogroup` et libellé du groupe (`Capsule.tsx:61-62`), `aria-selected` ou `aria-checked` (`Capsule.tsx:75`).
- [x] Flèches, Début et Fin (`Capsule.tsx:42-55`).
- [x] Tabulation itinérante, un seul `tabIndex=0` (`Capsule.tsx:77`).
- [x] Cible ≥ 44 px : le visuel reste à 38-44 px, la zone de toucher fait `max(44px, --bw)` × 44 px par `::after` (`kit-studio.css:344-353`), sans déplacer la lentille ni chevaucher le bouton voisin (corrigé en T23).

### Pilule (`Pill.tsx`)
- [x] Bouton à libellé fourni par l'appelant (`Pill.tsx:61`), libellé type `S.pill.open` (« Ouvrir le bilan »).
- [x] Cible 44 px (`kit-studio.css:101`, `height: 44px`).
- [x] Pastille d'alertes annoncée : `role="img"` avec libellé `alertsText` (`Pill.tsx:68`). Modifié par T17, auparavant masquée.
- [ ] Le libellé complet (poids et alertes) est fourni par l'appelant : `pillLabel()` existe dans `strings.ts` mais n'est pas branché tant que l'appelant ne l'utilise pas.

### Pages (`Drawer/Pager.tsx`)
- [x] Groupe et libellé de pages : `aria-label={label}` (`Pager.tsx:40`), page « Page i sur n » (`Pager.tsx:42`).
- [x] Défilement sans animation si `prefers-reduced-motion` (`Pager.tsx:24`).

### Barre basse (`Drawer/Strip.tsx`)
- [x] Conteneur sans interaction propre, aucun rôle à définir.

### Pictos (`icons.tsx`)
- [x] `aria-hidden="true"` et `focusable="false"` (`icons.tsx:30`).

## Transverses CSS

- [x] Focus visible : contour 2 px (`kit-studio.css:432-435`). Contraste : voir ci-dessus.
- [x] `prefers-reduced-motion` : transitions réduites pour tiroir, pilule, capsules, anneau et poignée (`kit-studio.css:437-451`) ; le défilement des pages passe par `Pager.tsx:24`.
- [x] `prefers-reduced-transparency` et `prefers-contrast: more` : fond opaque (`kit-studio.css:452-465`, `--ks-paper` = `#FAF9F5`, `kit-studio.css:11`). Contour renforcé (`kit-studio.css:466-471`).
- [ ] Bloc « Vue 3D du sac » : la chaîne `S.a11y.bag3d` existe, aucun composant ne la consomme encore.
