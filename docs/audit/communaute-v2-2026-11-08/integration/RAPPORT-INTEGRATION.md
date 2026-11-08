# Rapport d'intégration visuelle — Communauté v2

Passe d'intégration sur les **vrais composants** (`NEXT_PUBLIC_COMMUNAUTE_V2=true`),
harnais Playwright `docs/audit/communaute-v2-2026-11-08/integration/capture.mjs`.
Tout le réseau est simulé (`page.route` : PostgREST, GoTrue, Storage, origines
externes ; session synthétique par cookie `sb-fixture-auth-token`, fixtures
conformes à `handoff/communaute-v2/RPC-CONTRACTS.md`) : **aucune donnée réelle,
aucune écriture, aucun appel réseau sortant**.

- Build de recette : `CIRCLE_NODE_TOTAL=1`, `NEXT_PUBLIC_COMMUNAUTE_V2=true`,
  `NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co`, servi par
  `next start` sur `http://127.0.0.1:4028`.
- Captures 390×844 : `integration/captures/` (19 PNG).
- Rapports machine : `integration/console-report.json`, `network-report.json`.
- Référence : maquette `annexes/maquette-communaute.html` + captures
  `../audit-communaute-v2/maquette/*.png`, et le système `/compte`.

## Résultat de la passe finale

| Indicateur | Valeur |
|---|---|
| Scénarios | **19/19** réussis (`_failures.json` vide) |
| Captures | 19 PNG 390×844 |
| Erreurs JS (`pageerror`) | **0** |
| Erreurs console | 38 × 401 (`/api/compte/.../notifications`, `/api/telemetry/hub` non mockés), 8 × 500 = scénarios « erreur » volontaires, 38 warnings « Service Worker blocked by Playwright », 4 warnings WebGL (headless). Aucune erreur applicative. |
| Contraste verre clair | titres `--lkv-text-primary` #172B24 (≈13:1), méta #56665D (≈5,5:1), pastilles `--type-*` 4,8–11,6:1 — AA |

## Captures (preuves)

| Capture | Ce qu'elle prouve |
|---|---|
| `explorer-carnets` | volet Carnets : capsule 56, mini-capsule 30 + bouton de tri, mosaïque éditoriale, tuiles verre, visa, avatars empilés, j'aime/commentaires 44 px |
| `explorer-carnets-tri` | menu de tri `role=menu` ancré au-dessus du bouton : options 44 px, coche sage, verre clair opaque, point vert de tri modifié |
| `explorer-clubs` | chips d'activité, Club du mois + blason généré, cartes 2 col., états Rejoindre / Membre / Demande envoyée |
| `explorer-sorties` | bande agenda 14 jours (aujourd'hui, week-end, actif, points), billet daté avec **topo** à droite, jauges, états Complet / Liste d'attente / Inscrit |
| `explorer-recherche` | champ 48 px, chips de contexte, segmented, tendances, lieux populaires, mini-capsule 6 filtres |
| `explorer-detail` | fiche club empilée : `‹ Retour`, titre + `1 / 5`, crest 72, prochaines sorties, membres, règles |
| `explorer-peek` | Peek & Pop : scrim, boîte de détail, 3 actions 44 px |
| `explorer-etat-vide` | état vide : icône, titre, hint, CTA « Créer mon premier carnet » |
| `explorer-etat-erreur` | état erreur : « Carnets indisponibles » + Réessayer (distinct d'un vide) |
| `explorer-etat-chargement` | skeleton tuiles/lignes contrasté (shimmer) |
| `explorer-ile` | île dynamique « Club rejoint » + « Annuler » au-dessus du tiroir (z 70), tuile passée à Membre |
| `creation-publication` | capsule 6 types, aperçu vivant, étape Format (cartes), pied Suivant |
| `creation-story` | éditeur 9:16, Galerie/Caméra, média vide, capsule d'étapes |
| `creation-carnet` | champs 16 px libellés visibles, dates, stepper voyageurs, visibilité en cartes |
| `creation-sortie` | aperçu billet en direct, chips d'activité, lieu, RDV, pied |
| `creation-kit` | poids total + jauge objectif, inventaire vide, objets personnalisés |
| `creation-club` | aperçu blason en direct, slug, image facultative, étapes 1–4 |
| `creation-erreur` | « 2 champs à corriger » en tête + erreurs inline uniques + bordure champ invalide |
| `creation-brouillon` | bandeau « Brouillon restauré · Effacer » + valeurs restaurées dans l'aperçu |

## Écarts par gravité

### Bloquant — corrigé et vérifié

**B1. La matière sombre globale fuyait dans le tiroir clair** (captures de la
passe 1 : contenu blanc sur verre blanc, menu de tri translucide, badges/chips
illisibles). Cause : `html[data-liquid-ios27]` remappe `--lkv-text-*` (blanc),
`--card-tint`, `--glass-bg-medium/strong`, `--lkv-surface*`, `--lkv-border*`,
`--lkv-secondary`, les statuts et `--label` ; le tiroir v2, carte clippée du
Compte, n'avait pas de re-scope local, contrairement à `.lkdv-compte-v8`/
`.lkdv-cd`.
Correction fondations : `src/styles/communaute-v2.css` re-scope la matière
claire du Compte sur `.lkdv-communaute-v2` à partir de `--cv2-light-*` ajoutés
en fin de `src/styles/tokens.css` (valeurs Compte : compte-v8.css L27-37,
HIG L2706-2723), y compris la ré-dérivation des `--cv2-*` calculés sur `:root`
(`--cv2-menu-bg`, `--cv2-tile-border`, `--cv2-field-border`, `--cv2-list-sep*`)
et `--label/--label2/--label3`. Vérifié sur la passe finale : titres/métas/
chips/badges/menu de tri/île lisibles, AA.

### Majeurs — hors périmètre, routés

1. **Création — libellé « Point de rendez-vous » affiché deux fois**
   (`src/features/community/v2/create/forms/SortieFormV2.tsx:156` et défaut
   `src/features/community/v2/create/sortie/MeetingMapV2.tsx:36`) : le champ
   texte et la mini-carte portent le même libellé ; la carte vide (sans
   coordonnées) ressemble à un second champ inerte. → Création.
2. **Création — chevauchement capsule d'étapes / contenu** sur les étapes
   longues (Sortie, Kit, Story) : la capsule flottante `lkdv-cv2c-step-host`
   recouvre le bas du dernier champ (ex. bouton média de Story, dernière ligne
   de Kit). Cible 30 px conforme, mais le conteneur scrollable n'a pas de
   réserve basse suffisante (padding-bas du `.lkdv-cv2c-pane` à porter à
   ≈ 76 px comme `.lkdv-cv2-pane`). → Création.

### Mineurs — à confirmer/design

3. **Explorer — bouton d'adhésion « Membre ✓ »** en barre pleine largeur
   (`explore/explore-v2.css:230` `.lkdv-cv2x-join`) : cible 44 px OK, mais le
   rendu bandeau pâle se lit comme un état, pas comme une action ; à confirmer
   côté Explorer (peut rester tel quel).
4. **Explorer — rang des tendances** (`search/SearchHome.tsx:95`) : vérifié au
   navigateur, `#n` en `--lkv-text-secondary` sur verre clair (≈5,9:1) → **pas
   un écart AA** ; ne pas router.
5. **Création — dates natives** : `input[type=date]` s'affiche `mm/dd/yyyy`
   dans Chromium headless malgré `locale=fr-FR` (limite du harnais ; le
   navigateur réel/iOS affiche `jj/mm/aaaa`). Ce n'est pas un défaut code.

### Non-écarts (limites du harnais, documentées)

- **Couvertures absentes** : les fixtures n'ont pas d'URL Storage → aplats
  clairs sur les tuiles ; les replis (`AppImage`/cover fallback) sont corrects.
- **401 `/api/compte/.../notifications` et `/api/telemetry/hub`** : routes API
  de l'hôte non mockées (hors périmètre tiroirs) ; la page reste fonctionnelle.
- **Île de Création non capturée** : aucun scénario ne soumet une création
  (mutation RPC + upload) ; la capture visuelle des 6 formulaires suffit pour
  cette passe, l'île est prouvée côté Explorer (`explorer-ile`).
- Initiales des avatars de détail club (« VC VC VO ») = mock `public_profiles`
  incomplet, pas un bug de rendu.

## Corrections fondations de cette passe

- `src/styles/tokens.css` (ajouts en fin uniquement) : `--type-*` (AA documenté),
  matériaux `--cv2-*` (tuile, liste, menu, champ, skeleton, île, z-index),
  **matière claire** `--cv2-light-*` pour le re-scope du tiroir, squelette
  renforcé (`rgba(23,43,36,.10)` → `rgba(255,255,255,.92)`).
- `src/styles/communaute-v2.css` : re-scope clair complet (encres, surfaces,
  verres, statuts, `--cv2-*` dérivés) ; colonne **topo du billet** (76 px,
  contours + tracé déterministes de l'id, tokens uniquement) ; commentaire
  d'en-tête documentaire (classes `lkdv-cv2-*` pour Explorer/Création) ; plus
  aucune séquence `*/` dans un commentaire (bug cssnano `Unexpected '/'`).
- `src/features/community/v2/shared/EventTicket.tsx` : topo décoratif
  `aria-hidden` (variante tuile seulement) + tests ; `onOpen` conservé pour le
  détail empilé.
- Primitives : `data-testid="cv2-sort-button|menu"`, `cv2-island` ;
  `ClubCrest.size` accepte 28/44/52/64/72 ; `SortMenuButton` ancre flex dans
  `.lkdv-cv2-mini-slot` (Échap consommée, Tab rend le focus).
- Harnais : ordre des routes Playwright (LIFO) corrigé (RPC après tables),
  préflight CORS des fixtures, cookie de session conforme `@supabase/ssr`,
  scénarios île (cible non-membre) et erreur Création (Suivant ×2).

## Contrôles

- `npx vitest run src/components/ui/drawer src/features/community/v2/shared` :
  **104 tests verts** (dont `EventTicket` 13, `ClubCrest` 7, `AgendaStrip` 8,
  `SortMenuButton` 11, `DynamicIsland` 10, intégration coque 7, contrat CSS 12).
- Gardes design : `unification`, `motion-unique`, `no-primary`, `radius`,
  `contrast`, `tokens-sync`, `p5-direction-tokens` → **53 tests verts**.
- `postcss.parse` OK sur `tokens.css`, `communaute-v2.css`,
  `integration/primitives.css` et les CSS auto-injectées des primitives.
- `tsc` : mes fichiers sans erreur (le programme complet dépend des chantiers
  Explorer/Création en cours).

## Reproduire

```bash
# build de recette (une seule instance lourde à la fois, 8 Go de RAM)
CIRCLE_NODE_TOTAL=1 NODE_OPTIONS=--max-old-space-size=6144 \
NEXT_PUBLIC_COMMUNAUTE_V2=true \
NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key npm run build
npm run start   # 4028

# captures (19 scénarios, réseau entièrement simulé)
node docs/audit/communaute-v2-2026-11-08/integration/capture.mjs \
  --base http://127.0.0.1:4028
```

Verdict : **fondations prêtes pour la recette tests** ; 1 bloquant corrigé
(thème), 2 majeurs routés à Création, aucun écart AA restant sur le verre clair
des tiroirs.
