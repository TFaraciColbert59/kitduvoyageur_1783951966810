# Chantier — Kit Studio : finir, consolider, brancher la 3D

Dossier de passation pour un agent travaillant en autonomie complète. Écrit le 7 novembre 2026.

---

## À lire avant la première ligne de code, dans cet ordre

1. `CLAUDE.md` à la racine du dépôt — règles dures, non négociables.
2. `AUDIT-2026-11-07.md` de ce bundle — **l'état réel du dépôt**.
3. `spec/moteur-3d-matieres.md` de ce bundle — le contrat 3D et matières.
4. `docs/kit-studio/REVIEW.md` du dépôt — la dette, à la ligne près.
5. `docs/kit-studio/RAPPORT-FINAL.md` et `LEDGER.md` du dépôt — ce qui a déjà été livré et prouvé.
6. `spec/dom-contract.md` et `spec/data-model.md` de ce bundle — toujours valables.
7. Dans `historique/` : les 14 constats **C1–C14** de `AUDIT-2026-11-05.md` (toujours valables, ce sont des décisions de portage) et la **Phase 5 — Vraies données** de `PLAN-2026-11-05.md` (c'est la spec de la phase P1 ci-dessous).

**Attention sur `historique/PLAN-2026-11-05.md`** : sa section « Architecture cible » et sa route `/materiel/studio` **ne correspondent pas au code livré**. L'agent qui a exécuté le bundle a dévié — `domain/` au lieu de `engine/`, `src/app/kit-studio/` au lieu de `src/app/materiel/studio/`, `three@0.186.0` au lieu de 0.149. Le code livré fait foi. De ce fichier, ne retiens que la Phase 5 et la Définition de « terminé ».

## Ce que tu ne dois pas faire

- **Ne reconstruis pas le Kit Studio.** Il existe : 133 fichiers, 27 438 lignes, 31 suites de tests, livré par la PR #142 et vérifié en production. L'`AUDIT.md` du bundle d'origine, daté du 5 novembre, dit le contraire — il est périmé.
- **Ne rétrograde pas `three`.** L'`AGENT_PROMPT.md` d'origine demande `0.149.0` ; le dépôt est en `0.186.0` et tout est écrit pour cette version.
- **Ne crée pas `/materiel/studio`.** La route livrée est `/kit-studio`. Une troisième route serait une régression.
- Ne « corrige » aucun comportement marqué « comportement de référence » dans `AUDIT.md` (C9, C10, C13, C14).
- Ne commite jamais un test rouge. Ne coche jamais une case sans preuve.

---

## Architecture cible

Aujourd'hui il y a **deux** Kit Studio, avec deux modèles de domaine incompatibles. C'est le vrai désordre à résoudre.

| | `/kit-studio` | `/hub?studio=1` |
| --- | --- | --- |
| Interface | `KitStudioClient` (livré, 27 k lignes, feuilles, deck, cartes, bilan, commande) | `KitStudioView` (1 087 lignes) |
| Scène | `createScene` → `bagBuilder.ts`, primitives construites par code | `BagScene` → `bag/loader.ts`, fichiers GLB |
| Domaine | `domain/catalog.ts` + `store/kitStore.ts` | `state/types.ts` + `state/useKitStudio.ts` |

**La cible n'est pas « supprimer l'un des deux ». C'est garder le produit d'un côté et la capacité de l'autre :**

- **Survit** : toute l'interface et le domaine de `/kit-studio`. C'est le produit, il est livré et vérifié.
- **Survit aussi** : la couche de chargement GLB — `scene/bag/loader.ts`, `scene/bag/parts.ts`, `scene/bag/fabricMaps.ts`, `tools/bag-generator/`. C'est elle qui recevra les modèles modélisés, et elle porte le modèle de manifeste (slots, points d'attache, ancrages d'insigne, capacité en litres) dont les modules LKDV ONE ont besoin.
- **Disparaît** : l'interface en double — `scene/BagScene.tsx`, `components/KitStudioView.tsx` — et le second modèle de domaine `state/types.ts` + `state/kitConfiguration.ts` + `state/useKitStudio.ts`, dont les concepts utiles sont repris dans `domain/`.
- `/hub?studio=1` continue d'exister comme point d'entrée, mais mène à la scène survivante.

Résultat : un seul studio, un seul modèle de domaine, et un chemin unique pour faire entrer un maillage.

---

## Phases

Chaque phase se termine par ses portes. Une phase n'est finie que si **toutes** ses portes passent, avec la sortie collée dans `docs/kit-studio/RAPPORT-CHANTIER.md`.

### P0 — Mesure de départ. Aucun code.

Lance et consigne :

```bash
npx tsc --noEmit -p .
npm run lint
npx vitest run src/features/kit-studio src/features/hub
npm run build
npm run perf:budget
```

Attendu au départ, mesuré le 7 novembre au commit `21a4b11` :

| Contrôle | Valeur de départ |
| --- | --- |
| `npx tsc --noEmit -p .` | 0 erreur |
| `npm run lint` | 0 erreur |
| `npx vitest run src/features/kit-studio src/features/hub` | **414 verts** |
| `npx vitest run` (suite complète) | **33 fichiers et 47 tests rouges**, 13 665 verts — tous hors kit-studio et hors hub (`tests/design/`, `tests/audit/`, `compte/map`, `carnet`). **Préexistants. Ne les cache pas, ne les corrige pas dans ce chantier.** |
| `npm run build` | vert |
| `npm run perf:budget` | `/hub` à 762 Ko pour un plafond de 590. **Dépassement préexistant.** Les huit autres surfaces sont dans leur budget |
| `bash scripts/verify-kit-studio.sh` | **ROUGE**, et il l'était déjà avant ce chantier : il lint avec `--max-warnings=0` et trouve 6 variables inutilisées dans `bag-scene-lifecycle.test.tsx`, `KitStudioView.tsx` et `OptionsDrawer.tsx`. Les deux premiers disparaissent en P3 ; traite le troisième en P4 |

Porte : les cinq sorties consignées. Toute mesure ultérieure se compare à celles-là.

### P1 — La couche de données. C'est le plus gros écart au « 100 % fonctionnel ».

Le mode Apparence, les coloris, les prix des pièces et la précommande tournent sur des données écrites dans le code. `CLAUDE.md` l'interdit (« Pas de données factices »).

**La spec détaillée existe déjà** : `historique/PLAN-2026-11-05.md` § « Phase 5 — Vraies données », plus la table de correspondance de `spec/data-model.md`. Suis-les, en remplaçant la route `/materiel/studio` par `/kit-studio`.

1. Applique `db/20261104010000_gear_taxonomy.sql`, puis `db/20261105010000_lkdv_one_studio.sql` — **à blanc d'abord**, chacune avec son rollback dans `supabase/migrations_down/`, advisors relancés après.
2. `getStudioData(userId, kitId?)` doit produire **exactement** les formes des constantes de démonstration actuelles, pour que l'interface ne bouge pas d'un pixel.
3. Actions serveur validées par `zod` : `saveBagConfig` (upsert `one_bag_configs`), `saveKitItemPlacement` (zone, slot, ordre dans `materiel_kit_items`), `placePreorder` (RPC `one_place_preorder`, **total recalculé en base**, jamais côté client).
4. Optimiste à l'écran, écriture différée de 600 ms, annulation sur erreur avec le HUD « Non enregistré · réessaie ».
5. RLS vérifiée sur chaque table neuve, isolation par `auth.uid()`.
6. Retire les constantes de démonstration du chemin de production. Garde-les comme jeu de test.

Portes :
- `node scripts/verify/hub_no_mockup.mjs` vert.
- Une requête en base qui montre le total de la précommande **recalculé côté serveur** : 148 € pour le corps 28 L avec les poches de ceinture, et une pièce inconnue refusée. Colle la sortie.
- Advisors Supabase sans nouvelle alerte de sécurité.
- Les cinq portes de P0, au même niveau ou mieux.

### P2 — Les UV en mètres sur la scène survivante. **FAITE le 7 novembre, commit `21a4b11`.**

Rien à faire. Conservée ici pour que la numérotation des phases reste stable.

`scene/uv.ts` expose `uvMeters(geometry)`, appliqué par `bagBuilder.add()` aux pièces de rôle
`fabric`, et `PHOTO_FABRIC_REPEAT` vaut désormais `FABRIC_REPEAT` (10). Le rapport d'échelle de trame
entre une grosse et une petite pièce est passé de 6,2 à 1,31, vérifié par six tests dans
`src/features/kit-studio/__tests__/uv.test.ts`. Détail en § 2.3 de `spec/moteur-3d-matieres.md`.

**Ce qui reste ouvert et que tu peux traiter en P3** : les objets du catalogue gardent des UV 0..1,
parce que leurs géométries sont partagées par clé entre objets de tailles différentes. Si tu
dé-partages, vérifie la mémoire et les tests de vignettes avant de conclure.

### P3 — Unifier. Un seul studio.

1. Dans `domain/`, étends le modèle pour porter ce que seul `state/types.ts` savait dire : slots, points d'attache, ancrages d'insigne, capacité déclarée.
2. Fais que la scène survivante sache charger un sac depuis un GLB **ou** le construire par code, selon que le modèle a un fichier ou non. Le repli procédural reste le défaut tant qu'aucun maillage n'existe.
3. Branche `scene/bag/fabricMaps.ts` sur la scène survivante, ou fusionne-le avec `scene/textures.ts` — un seul banc de textures à la fin.
4. Fais pointer les 8 appels de `handleEnterStudio` de `HubCampShell.tsx` et l'état `STUDIO` de `state/drawerMachine.ts` vers la scène survivante. `drawers/acquisition/acquisitionEngine.ts` construit une URL de retour vers `?studio=1` : elle doit continuer de marcher.
5. Supprime `scene/BagScene.tsx`, `components/KitStudioView.tsx`, `state/types.ts`, `state/kitConfiguration.ts`, `state/useKitStudio.ts` et leurs tests devenus sans objet.

Portes :
- Aucune référence restante aux fichiers supprimés : `grep -rn "BagScene\|KitStudioView\|useKitStudio" src/` ne renvoie rien.
- Les tests du hub restent verts, dont `src/features/hub/__tests__/drawerMachine.test.ts`.
- Un parcours E2E qui entre dans le studio **par le hub** et par `/kit-studio`, et obtient la même scène.
- `npm run perf:budget` : `/kit-studio` sous 520 Ko, et `/hub` **en baisse** (tu retires du code).

**Ajout du 7 novembre — la zone tissu d'un modèle texturé.** Les sacs Meshy arrivent désormais
avec leur atlas PBR (`base_color`, `normal`, `roughness`, `metallic`) ; la spécification le décrit
en § 4.6 de `spec/moteur-3d-matieres.md`. Le chargeur de l'étape 2 doit donc :

- consommer les cartes de l'atlas quand le GLB en porte, au lieu de les remplacer par un aplat ;
- teinter **la seule zone tissu**, désignée par un masque rangé à côté du GLB, en multipliant la
  luminance de l'atlas par la couleur du token — jamais en la remplaçant ;
- laisser la quincaillerie, les fermetures et l'écusson intacts ;
- annoncer la personnalisation de couleur indisponible pour un sac dont le masque manque, plutôt
  que de teindre l'atlas entier.

Porte supplémentaire : un test qui charge un GLB texturé, applique deux couleurs de token
différentes et vérifie que les texels hors masque sont **identiques** entre les deux rendus,
tandis que les texels du tissu changent. Sans ce test, l'étape n'est pas faite.

Le masque lui-même n'est pas à ta charge si aucun n'est présent dans `public/assets/bags/` : dans
ce cas tu implémentes le chemin complet, tu le vérifies sur un masque de test que tu fabriques, et
tu le signales dans le rapport.

### P4 — Fermer la dette de la revue indépendante.

`docs/kit-studio/REVIEW.md` donne pour chacun le fichier, la ligne et le correctif. T23 a fermé les 2 bloquants et 5 importants ; il reste :

**Important** — `domain/totals.ts:151` : expose `buyCents` / `rentCents` et convertis une seule fois, au lieu des quatre `×100` à la main (`BilanSheet.tsx:202`, `ItemSheet.tsx:83`, `BagSheet.tsx:63`, `cardsData.ts:121`).

**Mineurs, dont deux vrais défauts** — `domain/balance.ts:34` (`cog()` rend `NaN` sur un sac sans pièce pesée), `ui/kit-studio.css:365-368` (cible tactile décalée de 22 px et sous 44 px au-delà de 4 éléments, contre `CLAUDE.md`), puis `scene/thumbnails.ts:394-401`, `ui/Thumb.tsx:23-24`, `store/kitStore.ts:144`, `ui/sheets/OrderSheet.tsx:97-99`, `ui/Drawer/Grab.tsx:66-75`, et la remise à jour de `docs/kit-studio/A11Y-CHECKLIST.md:14`.

Portes :
- Un test de non-régression par point corrigé. Pour `cog()`, un sac sans pièce pesée ; pour la CSS, une mesure de la cible à 44 px au moins, avec 5 éléments.
- `scripts/verify-kit-studio.sh` vert.

### P5 — Le banc de parité, si la parité au pixel reste un objectif.

`tests/kit-studio/` et `reference/kit-studio.html` ne sont pas dans le dépôt : la parité annoncée par le bundle ne peut plus être rejouée. Installe le banc et la référence depuis le bundle, puis fais passer ses trois portes — valeurs du moteur égales, textes égaux, images à 1 % de pixels différents au plus.

**Attention** : la parité au pixel et les phases P1 à P3 tirent en sens inverse. La vraie donnée et l'unification changeront des valeurs que les goldens figent. Si un golden casse pour une raison légitime, **régénère-le et dis pourquoi dans le rapport** ; ne force jamais un seuil.

Si Tony préfère abandonner la parité au pixel maintenant que le studio est livré, saute cette phase et écris-le.

### P6 — Clôture.

Portes finales, toutes obligatoires :

```bash
npx tsc --noEmit -p .
npm run lint
npx vitest run src/features/kit-studio src/features/hub
npm run test:unit
npm run build
npm run perf:budget
node scripts/verify/hub_no_mockup.mjs
bash scripts/verify-kit-studio.sh
```

Et dans `docs/kit-studio/RAPPORT-CHANTIER.md` :

- La sortie de chaque commande, pas un résumé.
- Le tableau avant/après de `perf:budget` sur les neuf surfaces.
- Les performances mesurées sur appareil, ou **« non mesuré »** avec la raison. N'invente aucun chiffre.
- Les risques restants et la dette laissée ouverte, nommés.

---

## Comment savoir que c'est fini

Le chantier est à 100 % quand les six affirmations ci-dessous sont vraies **et prouvées** :

1. Plus aucune donnée de démonstration sur le chemin de production du studio ; `hub_no_mockup.mjs` le confirme.
2. Un seul Kit Studio dans le dépôt ; `grep` ne trouve plus les fichiers de l'interface en double.
3. Le tissage a la même échelle physique sur toutes les pièces ; capture jointe.
4. Un GLB produit hors du dépôt entre par `import-model.mjs`, se charge, et reçoit matière et couleur sans retouche ; capture jointe.
5. La dette de la revue T22 est fermée, chaque point avec son test.
6. Les huit portes de P6 sont vertes, et le rapport contient leurs sorties.

---

## Quand t'arrêter et demander

Trois cas seulement :

1. **La cohérence visuelle des objets.** 53 objets du catalogue sur 19 formes sont construits par code. Si les modules LKDV ONE deviennent des maillages photoréalistes, ils voisineront avec des primitives abstraites. Trois sorties possibles ; le choix appartient à Tony (voir `spec/moteur-3d-matieres.md` § 5.2).
2. **La route.** Le bundle visait `/materiel/studio`, le livré est `/kit-studio`. Ne renomme pas sans accord : il y a des liens, des redirections et une page `noindex` en jeu.
3. **Toute suppression de données irréversible**, et tout échec d'un contrôle de production — dans ce cas, retour arrière immédiat puis compte rendu, selon `CLAUDE.md`.

Pour tout le reste : prends la lecture la plus raisonnable, écris laquelle en tête de ton rapport, et continue.
