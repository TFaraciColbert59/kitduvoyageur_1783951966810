# Bilan — chantier « fidélité 100 % à la maquette » (Communauté v2)

**Date** : 2026-11-09 · **Branche** : `feat/fidelite-maquette` · **Base** : `main` (`9b68c63`, PR #155 fusionnée).
**Objectif client** : combler **tous** les écarts recensés entre les tiroirs livrés (Explorer,
Création, sous-tiroirs, formulaires, coque, design system) et la maquette, en suivant une checklist
par phases, avec vérification constante et sous-agents en parallèle.

## Résultat final

| Indicateur | Valeur |
|---|---|
| Items du backlog (`BACKLOG-100.md`) | **85** (P1 2 · P2 37 · P3 46 − 15 arbitrages) |
| **Items comblés et vérifiés** | **83 / 85 (97,6 %)** |
| Items partiels restants | **0** |
| Items bloqués externes | **2** — `FID-078` (données/drapeau prod) et `FID-083` (blocs conditionnels sur données réelles), tous deux **bloqués par J-08** (aucune migration prod sans sauvegarde vérifiée : `BACKUP_PASSPHRASE` absent) |
| Écarts « non-écarts » corrigés dans l'audit | 1 (`FID-008`, capsule en détail : la maquette ne la conserve pas) |
| Phases | 1 P1 · 2 transverses · 3 Explorer · 4 Création · 5 P3 · 6 exceptions · 7 vérification = **terminées** |

Suivi item par item : `CHECKLIST-100.md` (cases + journal) et `BACKLOG-100.md` (statut, preuve,
fichiers, correction attendue). Galerie des 82 captures appairées : `GALERIE.html`.

## Preuves de vérification (rejouées à chaque vague)

Commande unique : `bash docs/audit/communaute-v2-2026-11-08/ecarts-maquette/VERIFIER.sh`

| Porte | Résultat final |
|---|---|
| Build production (`NEXT_PUBLIC_COMMUNAUTE_V2=true`, backend simulé) | **vert** (`Compiled successfully`) |
| TypeScript strict (`tsc --noEmit -p .`) | **0 erreur** |
| Vitest v2 + drawer | **279 / 279** (34 fichiers) |
| e2e Explorer + Création + Invité, **Chromium** | **46 / 46** (3 sauts motivés) |
| e2e Explorer + Création + Invité, **WebKit** | **46 / 46** (3 sauts motivés) — parité |
| axe-core (a11y) | **4 / 4**, 0 violation critical/serious |
| Captures 390×844 (+ 360/430) | **82 / 82** (`MANIFEST.json` : 0 échec) |
| Références visuelles Playwright | **4 / 4** régénérées (macOS) |
| Contraste (`npm run audit:contrast`) | 42 / 42 |

## Ce qui a été corrigé (par domaine)

- **P1** : résultats de Recherche masqués par le repli de couverture (`.lkdv-cv2x-cover-fallback`
  échappé de sa vignette) + bascule « Sur la carte » interceptée → `position: relative` sur la
  vignette ; garde e2e `elementFromPoint` + helper anti-recouvrement générique (FID-001/074).
- **Coque / design system** : états vide/erreur séparés (teinte danger AA), focus sans écrasement de
  rayon, bandeau brouillon maquette, ombre d'île encrée, ochre retiré des usages v2, anneau inset du
  menu de tri, pilule « Mode invité · lecture seule », slot d'aperçu fixe 150 px, plaque de dialogue
  de fermeture (Continuer ghost / Fermer danger), Échap posé en layout effect (plus de frame sans
  gestionnaire), focus rendu après peek/détail.
- **Explorer** : badges de tuiles carnets inversés remis dans le bon sens, visa 2 lignes avec pays
  (`country_iso` : migration additive + feed + mapper) et anneau conique « En route », avatars
  1 lettre ; recherche accueil (tendance unique, lieux illustrés), résultats (cartes de groupe,
  pastilles de type, « Voir tout », « 1 repère ») ; clubs (blason nu + cadenas en coin, états
  d'adhésion, détail « Membre ✓ », prochaines sorties avec S'inscrire) ; sorties (action dans le
  pied du billet, doublon « Inscrit » supprimé, entête détail 68 px + corps en ligne, météo J-7 sur
  le billet et le détail) ; Peek `role=menu` + 4 actions dont Fermer ; états (squelette, vide,
  erreurs 3 volets, hors-ligne) ; 360/430 sans débordement ; gestes LensPager/Échap hiérarchisé.
- **Création** : réserve sous la mini-capsule (76 px), Retour visible et désactivé à l'étape 1,
  brouillon restauré **à l'étape quittée**, radio « Événement » + note + CTA « Créer dans Sortie »,
  sélecteur de club (plus de champ UUID), médias en lignes 44 px (alt/recadrage visibles, compteur
  dans le libellé, légende non obligatoire en Photo, 600 caractères), Story (aperçu compact +
  pilules Galerie/Caméra, scène 300 px en édition, zoom ±/Remplacer, rognage étape 1, « Aperçu final
  exact », lien carnet + jour, sticker météo), Carnet (aperçu vivant, stepper jours synchronisé aux
  dates, jours initialisés, chips d'amis + « Inviter par lien », tracé : 3 cartes de point de départ,
  édition par segments/points, undo/redo, glisser moments/nuitées entre jours), Sortie (5 niveaux +
  définitions, 6 chips sécurité, règle DVA ski, date/heure en étape 1, billet d'aperçu), Kit
  (« Partir de » 4 sources + modèles préremplissants, aperçu persistant + anneau de poids + sac en
  couches + objectif, suggestions « Ajouter », 6 catégories visibles, picker), Club (avatar carré +
  bannière 3:1, activités requises en Identité, rayon stepper 5-60, questions conditionnelles,
  réordonnancement au pointeur), moteur (« Réessayer » après erreur serveur, île puis fermeture,
  confirmation « Effacer le brouillon ? » et inter-types, diffusion conforme), P3 (cartes format,
  libellés, copies, erreurs texte rouge + rebond reduced-motion, densités, rayons 18/4:5/16:10).

## Bloqué externe (2 items) — reprise exacte

`FID-078` (fidélité sur données réelles + drapeau) et `FID-083` (blocs conditionnels RDV/météo/
filigrane/badge GPS/couvertures Storage sur données réelles) exigent la base de production migrée.
Blocage `J-08` : `BACKUP_PASSPHRASE` absent → aucune sauvegarde vérifiable → aucune migration prod,
`NEXT_PUBLIC_COMMUNAUTE_V2=false` en Production. Reprise : `handoff/communaute-v2/PROD-APPLICATION.md`
(sauvegarde → 8 migrations + la nouvelle migration `20261108190000` pour `carnets.country_iso` →
registre → advisors → drapeau), puis rejouer `VERIFIER.sh`, les captures sur données réelles et
`FID-083`.

## Limites assumées / non-écarts

- **Exceptions `01 § 6`** conservées : sondage, commentaires/j'aime réels, programmation (présentée
  comme la maquette, inerte, une seule mention), vidéo des publications (libellé « Photos » assumé),
  rappels de sortie, occurrences récurrentes, TestFlight. Documentées dans `JOURNAL.md` J-14.
- **iPhone / haptique / clavier natif** : installation et lancement vérifiés, interactions non
  automatisables (pas de Maestro CLI) — voir `recette/IPHONE.md`.
- **Références visuelles** : baselines `-darwin` ; la spec se saute en CI tant que les références
  Linux n'ont pas été produites (documenté dans la spec).
- **Chips 28 px** : fidélité maquette, dérogation documentée à la règle 44 px de `CLAUDE.md` (J-14).

## Commits du chantier

| Commit | Contenu |
|---|---|
| `a77970a` + `12dc3b5` | P1 Recherche + garde anti-recouvrement |
| `ec3d15d` puis `4359309` | backlog 85 items + checklist + FID-008 non-écart |
| `89364fc` + `22a7b65` | **vague 1** (coque/transverses, Explorer, Création, tests ; captures 82) |
| `80ebf55` | **vague 2** (kit/carnet/story/moteur ; météo, Peek 4 actions, focus, pays/anneau, densité) |
| `bca6fb9` | **vague 3** (aperçu fixe 150 px, tracé/jours, drag Club, météo Story, 3 cartes tracé) |
| `a28dae6` | captures 82 finales, BILAN/CHECKLIST/rapports, galerie |
| **PR #158** | fusion squash `c2d8077` → `main` (2026-11-09) · aperçu V2 vérifié (`preuves-preview/`) |

## Reproductibilité

```bash
# Build V2 simulé + serveur 4028, puis toutes les portes
bash docs/audit/communaute-v2-2026-11-08/ecarts-maquette/VERIFIER.sh

# Captures seules (galerie appairée)
NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key PW_BASE_URL=http://127.0.0.1:4028 \
npx playwright test --config=docs/audit/communaute-v2-2026-11-08/ecarts-maquette/playwright.capture.config.ts
```
