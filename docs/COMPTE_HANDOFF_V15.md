# Transmission de flambeau — Compte iOS 27 v15

**Date :** 2026-10-20  
**Branche :** `main`  
**Dernier commit :** `a4a870cb` — `feat(compte): refonte v15 selecteur superpose, drawers alignes sur la card et post minimal`  
**État Git :** arbre propre, synchronisé avec `origin/main`.

---

## 1. État de production

- Déploiement Vercel : `dpl_Hw9vHZiqyja8XD5Xfs1eVW4fPgjH` — **READY**, target **production**.
- Commit déployé : `a4a870cb`.
- URL vérifiée HTTP 200 + chunk **v15** :
  `https://kitduvoyageur-1783951966810-git-main-tonyfaracip-3325s-projects.vercel.app/compte`
- URL du déploiement :
  `https://kitduvoyageur-1783951966810-j646t55fi.vercel.app/compte`
- `koosmoweb.fr` : **DNS encore misconfigured** chez Vercel (HTTP 000). Ajouter chez le registrar :
  - `A` → `216.198.79.1`
  - `A` → `64.29.17.1`
  - ou `CNAME` → `cname.vercel-dns.com`.
- Déploiement systématique : après validation, commit + push `main`, puis vérifier le déploiement Vercel. Si le webhook GitHub ne déclenche rien, créer le déploiement via `vercel_create_deployment` avec `gitSource { type: "github", org: "TFaraciColbert59", repo: "kitduvoyageur_1783951966810", ref: "main" }`, `target: "production"`.

---

## 2. Invariants à ne jamais casser

1. **ZÉRO modification** dans `src/app/compas/**` et `src/features/compas/**`.
2. **Référence design officielle** :
   - `docs/compas/DESIGN_REFERENCE.md`
   - `docs/adr/ADR-015-liquid-glass-system.md`
   - `docs/DESIGN_TRUTH.md`
   - La card principale `.card.cs` est la référence de transparence.
3. **Liquid Glass iOS 27 clair** : verre translucide, reflets internes, ombres ink, aucune couleur primaire pleine sur les boutons de drawer.
4. **Sélecteurs de drawers : icônes uniquement, jamais de texte**, même capsule que la référence profil.
5. **Drawers et post drawer épousent exactement les bords de la card** via les variables `--card-*`.
6. **Aucune modification du flux Compas** ni de la carte 3D hors Contrôles carte.
7. **Méthode** : plan complet + validation avant tout lot important.

---

## 3. Architecture actuelle de la page Compte

### Card principale

- Markup runtime : `card()` dans `src/components/compte/compte-liquid-glass-v8-runtime.js`.
- Structure :
  ```html
  <div class="card cs" id="card">
    <div class="card-scroll">…header, bio, stories, contenu…</div>
    <div class="ig-tabs-float">
      <div class="ig-tabs">…Grille / Sorties…</div>
    </div>
  </div>
  ```
- `#card` : `position: relative`, `overflow: hidden`.
- `.card-scroll` : seule couche scrollable, `padding-bottom: 56px`, `scroll-padding-bottom: 56px`.
- `.ig-tabs-float` : sélecteur **superposé aux posts**, `bottom` calculé dynamiquement par `positionIgTabsFloat()` pour se poser sur le bas du contenu.
- `syncCardBounds()` calcule et injecte sur `.phone` :
  `--card-top`, `--card-left`, `--card-right`, `--card-bottom`, `--card-radius`.
- Appels : fin de `renderTop()`, `openSheet()`, `pushSheet()`, `openPostModal()`, resize, et `setTimeout(..., 620)` après la transition `mapbig`.

### Drawers

- `openSheet()` normalise toute ouverture en detent `"card"` (sauf fermeture).
- `.sw-wrap[data-det="card"] .sheet` et `.post-modal-instagram` utilisent strictement les variables `--card-*`.
- Le sheet est rendu inerte (`inert = true`) quand fermé, réactivé à l’ouverture.
- Focus : `sheetOpener` / `sheetOpenerSel` restaurent le focus à la fermeture ; `renderSheet()` restaure aussi le focus interne.
- Tous les sélecteurs de drawers partagent le même socle CSS :
  `.flow`, `.segc`, `.reseau-toggle`, `.ig-sub` → capsule verre, lentille, icônes 19 px.

### Post drawer

- `renderPostModal()` dans le runtime.
- Minimal : image plein cadre, pillule profil (clic = fermer), 3 points options, pillule like/commenter/republier, légende compacte, composeur, grabber + swipe bas.
- Plus de panneau blanc de contenu.
- Commentaires : `openPostComments()` ferme le post et ouvre le drawer `post_comments` (même style que les autres drawers).
- `post_comments` est défini dans `EXK` ; `submitPostComment()` publie et re-render le sheet.
- Options : Enregistrer, Republier, Copier le lien, Signaler.

### Contrôles carte

- `map-scale-selector` et `mctl` reprennent le verre du sélecteur (blur 28, capsule, lentille active), sans aplat vert plein.
- `aria-pressed` est mis à jour par `mapscale`.

---

## 4. Fichiers centraux

| Fichier | Rôle |
|---|---|
| `src/components/compte/compte-liquid-glass-v8-runtime.js` | Markup runtime, état, drawers, post modal, carte |
| `src/components/compte/CompteLiquidGlassV8.tsx` | CSS `COMPTE_V8_CSS` + `COMPTE_V8_APPLE_HIG_CSS`, composant React |
| `tests/design/compte-refonte-v15.spec.ts` | Contrat v15 (sélecteur superposé, bounds card, post minimal) |
| `tests/design/compte-refonte-v14.spec.ts` | Contrat v14 (drawers carte, post immersif) |
| `tests/design/compte-refonte-v13.spec.ts` | Avatar, grille, sélecteurs universels |
| `tests/design/compte-refonte-v12.spec.ts` | Header, téléportation 3D, actions drawer |
| `tests/design/compte-profil-navigation-v8.spec.ts` | Navigation profil, drawers |
| `docs/compas/DESIGN_REFERENCE.md` | Référence design à suivre à la lettre |

---

## 5. Commandes utiles

```bash
npx vitest run tests/design/   # 322 tests attendus
npm run type-check             # tsc --noEmit
npm run build                  # Next.js, 337 pages
npm run verify:invariants      # anti-dérive
node --check src/components/compte/compte-liquid-glass-v8-runtime.js
```

Contrôle visuel mobile : 430×932, Playwright/Chrome DevTools.

---

## 6. État des tests

- `tests/design/` : **322/322 tests passés**, 31 fichiers.
- Build production : **OK**.
- Type-check : **OK**.
- Invariants CI : **OK**.
- Suite complète : **10 502 passés**, 8 échecs uniquement dans `tests/ops/ephemeralDbGuards.spec.ts` car les scripts invoquent `/bin/bash`/WSL absent de l’environnement Windows. Aucun rapport avec le Compte.

---

## 7. Points connus / dettes

1. **DNS `koosmoweb.fr`** : à corriger chez le registrar (voir §1).
2. **Accessibilité** :
   - focus trap / `aria-modal` non complets sur les drawers et le post drawer ;
   - cibles tactiles 44×44 non systématiques (sélecteur 30 px, contrôles carte 30–42 px) ;
   - `aria-controls`/`role=tabpanel` non ajoutés aux tablists ;
   - quick-nav masquée rendue `inert` mais à vérifier ;
   - région live mobile ajoutée (`#live-status`), à valider avec VoiceOver.
3. **`sheetAvail()`** utilise encore une géométrie approximative (hauteur 844 / 31 %), sans impact grâce au scroll interne.
4. **Post modal** : la légende est une pillule compacte ; les commentaires sont dans un drawer séparé.
5. **Pièces mortes** : `likesText`, `commentsList` restent calculés dans `renderPostModal` pour compatibilité de tests ; à nettoyer plus tard avec mise à jour des specs.
6. **Ne pas réintroduire** de panneau blanc de contenu dans le post drawer, ni de texte dans les sélecteurs compacts.

---

## 8. Prochaines priorités suggérées

1. Corriger le DNS `koosmoweb.fr`.
2. Finaliser l’accessibilité : focus trap, `aria-modal`, cibles 44×44, `aria-controls`.
3. Vérifier le rendu à 400 % de zoom et sur iPhone réel.
4. Nettoyer les variables mortes du post modal et ajuster les tests v8/v11.
5. Poursuivre l’harmonisation des autres drawers (identité, lignées) si un nouvel écran est ajouté.

---

## 9. Règle de passation

Tout nouvel agent doit :
1. Lire ce document, `docs/compas/DESIGN_REFERENCE.md`, `docs/adr/ADR-015-liquid-glass-system.md`.
2. Vérifier `git status` et le dernier déploiement Vercel.
3. Ne jamais toucher à `/compas`.
4. Proposer un plan avant toute modification importante.
5. Après validation : tests design, type-check, build, invariants, puis commit/push et vérification du déploiement Vercel.
