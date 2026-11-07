# Kit Studio : liste de contrôle accessibilité

Source : `kit-studio-bundle/spec/SPEC-DRAWER.md` §Accessibilité et `SPEC-PRODUIT.md` §Textes.
Une case n'est cochée que si le point est vérifié dans le code (référence fichier:ligne, arbre du chantier P4, 7 novembre 2026). Une case non cochée signifie « non vérifié » ou « non conforme », précisé en note.
Les chemins sont relatifs à `src/features/kit-studio/` (les fichiers de test sont cités en clair). Les chaînes proviennent de `ui/strings.ts` (objet `S`).

## Règles transverses

- [x] Rôles : tiroir `role="dialog"` non modal (`ui/Drawer/Dock.tsx:53-54`), capsules `tablist`/`radiogroup` (`ui/Drawer/Capsule.tsx:61`), pages `group` (`ui/Drawer/Pager.tsx:40-42`).
- [x] Chaque bouton icône porte un `aria-label` : poignée (`ui/Drawer/Grab.tsx:52`), bouton flottant (`ui/Drawer/Grab.tsx:71`), onglets (`ui/Drawer/Capsule.tsx:76`), pilule (`ui/Pill.tsx:61`).
- [x] Pictos décoratifs masqués (`ui/icons.tsx:30`, `ui/Pill.tsx:62`).
- [ ] Contrastes AA : non mesurés. Le contour de focus utilise `--ks-on` (`ui/kit-studio.css:447-450`), contraste à calculer sur fond `--ks-paper` avant de cocher.
- [x] Pages de la maquette livrées et montées : cartes (`ui/cards/CardsView.tsx:58`, montées par `ui/KitStudioClient.tsx:212`), Bilan (`ui/sheets/BilanSheet.tsx`), Fiche (`ui/sheets/ItemSheet.tsx`), Sac (`ui/sheets/BagSheet.tsx`), Commande (`ui/sheets/OrderSheet.tsx`) et deck (`ui/sheets/DeckSheet.tsx`), feuilles montées par `ui/SheetHost.tsx:64-152` dans le tiroir. Parcours vérifiés par `tests/e2e-kit-studio/kit-studio.spec.ts` sur WebKit mobile (hors portes unitaires).

## Composants existants

### Tiroir (`ui/Drawer/Dock.tsx`)
- [x] Nom accessible de la vue : `aria-label={label}` (`ui/Drawer/Dock.tsx:55`).
- [x] Non modal : `aria-modal="false"` (`ui/Drawer/Dock.tsx:54`).
- [x] Focus déplacé à l'ouverture (`ui/Drawer/Dock.tsx:30-35`), rendu au déclencheur à la fermeture (`ui/Drawer/Dock.tsx:37-39`).
- [x] Échap ferme (`ui/Drawer/Dock.tsx:42-47`).
- [x] Tiroir fermé inerte (`ui/Drawer/Dock.tsx:58`).
- [ ] Ordre de focus poignée → contenu → barre basse : la poignée est rendue en premier (`ui/Drawer/Dock.tsx:62`, puis `children` à `ui/Drawer/Dock.tsx:63`). La position de la barre basse dépend de l'intégration et n'est pas encore vérifiable.

### Poignée et Grabber (`ui/Drawer/Grab.tsx`)
- [x] Libellé « Fermer le tiroir » via `S.drawer.grab` (`ui/Drawer/Grab.tsx:52`, défaut `ui/strings.ts`).
- [x] Clavier : clic synthétique (`detail === 0`) ferme (`ui/Drawer/Grab.tsx:58-60`).
- [x] Cible tactile ≥ 44 px de la poignée : zone visuelle de 18 px étendue par `::after` (`ui/kit-studio.css:282-286`, `inset: 0 0 -26px`), soit 44 px de hauteur, pleine largeur.
- [x] Bouton flottant « Ouvrir le tiroir » (`ui/Drawer/Grab.tsx:66-77`) : visuel 140 × 30 px (`ui/kit-studio.css:158-177`) étendu à 44 px de hauteur par `::after` (`ui/kit-studio.css:178-186`), retiré de la tabulation quand le tiroir est ouvert (`ui/Drawer/Grab.tsx:73`). Verrouillé par test depuis P4.

### Capsules (`ui/Drawer/Capsule.tsx`)
- [x] Rôle `tablist`/`radiogroup` et libellé du groupe (`ui/Drawer/Capsule.tsx:61-62`), `aria-selected` ou `aria-checked` (`ui/Drawer/Capsule.tsx:75`).
- [x] Flèches, Début et Fin (`ui/Drawer/Capsule.tsx:42-55`).
- [x] Tabulation itinérante, un seul `tabIndex=0` (`ui/Drawer/Capsule.tsx:77`).
- [x] Cible ≥ 44 px : le visuel reste à 38-44 px, la zone de toucher fait `max(44px, --bw)` × 44 px par `::after` (`ui/kit-studio.css:344-353`), centrée sur le bouton (`left: 50%`, `translate(-50%, -50%)`), sans déplacer la lentille ni chevaucher le bouton voisin. La règle fautive `inset: -10px 0` qui écrasait `left: 50%` a été supprimée (T23) ; avec 5 éléments (`--bw = 38`, `ui/Drawer/Capsule.tsx:26`) la cible reste à 44 px (verrouillé par test P4).

### Pilule (`ui/Pill.tsx`)
- [x] Bouton à libellé fourni par l'appelant (`ui/Pill.tsx:61`), libellé type `S.pill.open` (« Ouvrir le bilan »).
- [x] Cible 44 px (`ui/kit-studio.css:101`, `height: 44px`).
- [x] Pastille d'alertes annoncée : `role="img"` avec libellé `alertsText` (`ui/Pill.tsx:68`). Modifié par T17, auparavant masquée.
- [x] Le libellé complet (poids et alertes) est fourni par l'appelant : `pillLabel()` (`ui/strings.ts:43`) est branché sur la pilule (`ui/KitStudioClient.tsx:177`). Constat de la revue T22 fermé.

### Pages (`ui/Drawer/Pager.tsx`)
- [x] Groupe et libellé de pages : `aria-label={label}` (`ui/Drawer/Pager.tsx:40`), page « Page i sur n » (`ui/Drawer/Pager.tsx:42`).
- [x] Défilement sans animation si `prefers-reduced-motion` (`ui/Drawer/Pager.tsx:24-25`).

### Barre basse (`ui/Drawer/Strip.tsx`)
- [x] Conteneur sans interaction propre, aucun rôle à définir (`ui/Drawer/Strip.tsx`).

### Pictos (`ui/icons.tsx`)
- [x] `aria-hidden="true"` et `focusable="false"` (`ui/icons.tsx:30`).

## Transverses CSS

- [x] Focus visible : contour 2 px (`ui/kit-studio.css:447-450`). Contraste : voir ci-dessus.
- [x] `prefers-reduced-motion` : transitions réduites pour tiroir, pilule, capsules, anneau et poignée (`ui/kit-studio.css:452-466`) ; le défilement des pages passe par `ui/Drawer/Pager.tsx:24-25`.
- [x] `prefers-reduced-transparency` et `prefers-contrast: more` : fond opaque (`ui/kit-studio.css:467-480`, `--ks-paper` = `#FAF9F5`, `ui/kit-studio.css:11`). Contour renforcé (`ui/kit-studio.css:481-486`).
- [x] Bloc « Vue 3D du sac » : la chaîne `S.a11y.bag3d` est consommée par le canvas `role="img"` de la scène (`scene/SceneView.tsx:49`). Constat de la revue T22 fermé.
