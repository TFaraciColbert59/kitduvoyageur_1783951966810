# 02 — Design et composants : réutiliser `/compte`, ne rien réinventer

Règle : **chercher la primitive avant de créer un composant** (DESIGN_SYSTEM.md § 6). La maquette est en HTML vanilla pour la démonstration ; en production tu utilises les composants React existants listés ici. Les annexes A, B et C donnent chaque valeur avec `fichier:ligne`.

## 1. Sources de vérité, par priorité
1. Code réel de `/compte` : `src/components/compte/**`, `compte-v8.css` puis `compte-apple-hig.css` (les `!important` de la dernière couche v17–v20 l'emportent), `src/styles/{tokens,liquid-*,drawer-selectors-tabbar,floating-liquid-tabbar}.css`.
2. `annexes/A-design-visuel-compte.md` (tokens, typographie, verre, composants), `annexes/B-interactions-compte.md` (tiroir, sélecteurs, gestes, animations, haptique, accessibilité), `annexes/C-contenus-compte.md` (carte, contenus, microcopy).
3. La maquette (comportement et contenus de la fiche carnet).

Valeurs clés à respecter (extraits) : tiroir entrée `.72s cubic-bezier(.16,1,.3,1)`, sortie `.56s` ; capsule 56 px lentille `.42s cubic-bezier(.32,.72,0,1)` ; mini-capsule 30 px lentille `.28s cubic-bezier(.34,1.56,.64,1)` ; LensPager 420 ms `ease-glass`, verrou d'axe 8 px, seuil 48 px ; appuis `scale(.96)` `.12s` spring ; cascade de lignes `.45s` délais 0/.03/.06/.09/.1 ; fond tiroir `--sheet-*` (HIG L2930-2942) ; cartes de tiroir `--drawer-card-*` (HIG L2943-2952 : `linear-gradient(180deg,rgba(255,255,255,.58),rgba(255,255,255,.44))`, `blur(18px) saturate(1.7)`, `inset 0 1px 0 rgba(255,255,255,.8),0 2px 8px rgba(23,43,36,.04)`).

## 2. Correspondance maquette → composants réels

| Élément de la maquette | Composant à utiliser | Notes |
|---|---|---|
| Page | `src/app/carnets/[id]/page.tsx` (Server Component, `force-dynamic`, `generateMetadata` + `notFound()`, JSON-LD) | Garder le contrat ; rendre `CarnetScreenV2` si `NEXT_PUBLIC_CARNET_V2 === 'true'`, sinon `CarnetScreen` actuel. |
| Données | `getCarnetDetail` + `buildCarnetDetail`, `days.ts`, `stats.ts`, `place.ts`, `trace.ts`, `format.ts` | Étendre `CarnetDetail` (nouveaux champs optionnels), ne pas casser les tests existants. |
| Tiroir 5 slots + lentilles | `SlotShell` (`src/components/compte/drawer/SlotShell.tsx`), `CapsuleTabs` (`src/components/ui/CapsuleTabs.tsx`, `size` default 48→56 final / `sm` 30), `LensPager` | Choisir **une** copie : `src/components/ui/drawer/*` (primitive). Si son comportement diffère de celle de `/compte` (seuil 30 vs 48), aligner la primitive sur `/compte` et ajouter un test. |
| Tiroir Carnet (onglets lazy) | `DrawerShell` (`src/components/ui/drawer/DrawerShell.tsx`) + `DrawerSkeleton/Error/Empty` | |
| Post | `CarnetPostSheet` → `PostSheet` + `CommunityFeedPost` (+ `PostGlassPanel`, `PostReplyComposer`, `CommentItem`) | Déjà au bon style : brancher les j'aime/commentaires **par moment** (§ 3 de `03`). |
| Stories | `src/components/communaute/StoriesViewer.tsx` (types `StoryUser`, `StorySlide`) | Construire les `StoryUser` à partir des médias du carnet groupés par auteur ; réponse via messagerie (`src/lib/stories/reply.ts` comme modèle). |
| Grille de posts (jour, participant) | Grille du profil `/compte` (`.ig-grid`, `.ig-tile` du runtime) | Pas de primitive React existante : créer `CarnetPostGrid` **une fois**, avec les valeurs exactes (3 col, gap 2, rayon 2, pastille de type, appui `.96`, appui long 460 ms), réutilisé par la vue du jour et la fiche participant. |
| Carte | `CarnetMapCard` → `CompteMap variant="carnet"` (+ `CompteMapCallout`, `CompteMapHud`) | Ajouter les props nécessaires (jour actif, couche contexte, focus étape/nuit/moment, position live/zone). Un seul contexte WebGL (ADR-002). Corriger au passage `CompteMap.tsx:749` (`window.location.assign` → `router.push`, règle CLAUDE.md). |
| Haptique | `useHapticFeedback()` / `triggerNativeHaptic` | Correspondance des durées web → styles natifs : 4 → `selection`, 6–8 → `light`, 10–12 → `medium`, 14–15 → `rigid`, motifs j'aime → `success`. |
| Île dynamique | Celle du runtime `/compte` si exposée ; sinon composant `CarnetIsland` (verre noir, 3,8 s, Annuler, `aria-live`) | Pas de toast générique. |
| Pilule « Reprendre » | Même matière que la mini-capsule (`.ig-tabs` claire 28 px) | Position `left:10px; bottom:10px` du tiroir Sac et de la fiche objet. |
| Signalement | `ReportSheet` + `comment_reports` / `post_reports` | |
| Back, safe areas, z-index | `HeaderBackButton`, tokens/AppShell, échelle `--z-*` / `src/lib/ui/zIndex.ts` | Jamais `env(safe-area-inset-*)` directement dans une page (DESIGN_SYSTEM). |

## 3. Interdits
- Aucune couleur littérale hors `src/styles/tokens.css` ; ajoute les jetons manquants (`--sheet-*`, `--drawer-card-*`, `--post-*`) dans le fichier de jetons avec la source en commentaire.
- Aucune police hors jetons (`--font-sans/display/mono`).
- Couleurs interdites : `#E4501C`, `#1C2620`, `#A3C4A3`, `#0B1F17`, `#2D6B4A`.
- Pas de nouveau composant si une primitive existe ; pas de deuxième implémentation du post ou des stories.
- Animer `transform`/`opacity` uniquement ; `prefers-reduced-motion` respecté partout.
- Skills obligatoires pour toute décision UI mobile : `apple-ui-designer` et `interaction-design` (AGENTS.md).
