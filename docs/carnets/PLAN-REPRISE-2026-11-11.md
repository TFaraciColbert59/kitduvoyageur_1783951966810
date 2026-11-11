# Reprise du chantier Carnets de bord — plan de lots (2026-11-11)

Session précédente : `claude/kind-bell-bfyt69` (finition Communauté v2 + fiche Carnet v2 livrée,
banc `tests/fidelity/` vert sur les scénarios joués). Ce qui restait ouvert, d'après la session
précédente elle-même :

- la **page `/carnets` n'existe toujours pas** (route absente, composants du hub orphelins) ;
- le **suivi pendant le voyage** est incomplet : la position différée/floutée existe
  (`carnet_public_position`, 3 h + arrondi 5 km), mais il manque les battements, le résumé du
  soir, la progression et le statut lisible ;
- le **point RGPD** `hike_sessions_select_owner_or_public_carnet` expose à un anonyme les
  `positions_geojson` / `positions_timed` bruts des sorties d'un carnet public : décision et
  correctif non faits ;
- la migration `supabase/migrations/20261110100100_carnet_etapes.sql` est **écrite, testée
  (pgTAP 9/9) mais non appliquée en production** (commit `440458cd` : « à appliquer en
  production AVANT de déployer ce code »).

Sources de référence : `docs/carnets/maquette-carnets-de-bord.html` (écran 1 = hub, n° 1-12 ;
écran 3 = suivi, n° 37-46), `docs/carnets/PROPOSITION-UI.md` (66 propositions, ordre des lots
l. 510-517), `src/styles/tokens.css`, `src/components/carnet/v2/` (fiche v2 : ne pas refaire).

## Objectif

Terminer **uniquement** ce qui n'était pas fait, sans retoucher la fiche Carnet v2 livrée :
1. la page `/carnets` du hub (lot 1 visuel, sans migration) ;
2. le suivi « carnet en route » côté fiche (lot 2, additif : battements, résumé du soir,
   progression, statut) + correctif RGPD préparé et testé ;
3. la migration `carnet_etapes` appliquée en production, les portes qualité rejouées,
   commit/push sur la branche.

## Référence

- Maquette hub : `docs/carnets/maquette-carnets-de-bord.html` L285-313 (écran 1) et L510-534.
- Grammaire : `/compte` (verre, carte 406, capsule), `/communaute` (shell B : colonne 430-520,
  en-tête sticky), primitives `@/components/ui`, tokens `--lkv-*` / `--account-*`.
- Typo : `--font-serif` (Instrument Serif italique) pour le titre de couverture, `--font-mono`
  pour les métriques, capitales trackées `0.14em` pour les surtitres.
- Données réelles en production (vérifiées par SQL) : `carnets` 87 lignes dont 85 publiques,
  `carnet_moments` 276, `carnet_likes` 600, `user_follows` 1 034, `public_profiles` 170.
  Colonnes disponibles : `country_iso`, `live_sharing`, `map_points` (trace), `distance_km`,
  `denivele_m`, `nb_nuits`, `nb_voyageurs`, `likes_count`, `comments_count`.
- RPC `community_carnets_feed` **absente en production** : le hub lit les tables directement
  sous RLS (jamais de clé de service), pas la RPC Communauté v2.

## Lots

| Lot | Contenu | Fichiers (périmètre d'écriture) | Test | Preuve |
|---|---|---|---|---|
| L1 · Hub `/carnets` | Route serveur + chargeur RLS + écran client : capsule de filtres (En route · Suivis · Monde · Les miens), bande « En route maintenant », cartes 4/5 avec tracé filigrane, tampon pays, pastille vivante « En route · J4 sur 9 », métriques mono, avatars, j'aime 44 px, squelettes, états vides/erreur, CTA « Créer un carnet » | `src/app/carnets/page.tsx`, `src/features/carnet/hub/**`, `src/components/carnets/hub/**`, `src/styles/carnets-hub.css` | Vitest loader + écran | captures 390/430 + clair/sombre, tests |
| L2 · Suivi en route | Composants additifs : `CarnetProgression` (statut dérivé + J n/N + km), `CarnetBeats` (un trait par moment), `CarnetEveningSummary` (résumé du soir J-1). Intégration dans la lentille « Suivre » de la fiche par le Lead (pas de réécriture du tiroir) | `src/components/carnet/v2/CarnetSuivi*.tsx`, `src/styles/carnet-suivi.css` | Vitest composants | tests + capture lentille Suivre |
| L3 · RGPD + migration | Migration de fermeture de l'exposition brute des positions (vue publique simplifiée + politique resserrée, rollback + pgTAP) ; adaptation du chargeur de fiche (visiteur = vue publique) ; application en production de `carnet_etapes` | `supabase/migrations/**`, `supabase/migrations_down/**`, `supabase/tests/database/**`, `src/features/carnet/detail/getCarnetDetail.ts` | pgTAP local, requête anon de contrôle | table + politique vérifiées en prod, rollback prêt |
| L4 · Vérification | `tsc`, lint, Vitest, build fixtures, banc de fidélité Carnet (non-régression), recette Playwright du hub (390/430, clair/sombre, états), captures | `tests/fidelity/**`, `tests/e2e/**`, `scripts/**` | portes complètes | rapports + captures |

## Hors périmètre

- Ne pas refaire la fiche Carnet v2, la Communauté v2 ni le banc existant : le travail committé
  est la référence ; les seules retouches autorisées sont **additives** et listées ci-dessus.
- Pas de déploiement en production du code de la branche : la Communauté v2 et le dragueur
  `NEXT_PUBLIC_COMMUNAUTE_V2` ne sont pas activés en prod, les migrations Communauté v2 ne sont
  pas appliquées. La migration `carnet_etapes` est appliquée car additive et sans effet sur le
  code actuellement en prod.
- Le correctif RGPD n'est **pas** appliqué en prod cette fois : il casserait la carte publique
  du code actuellement déployé (qui lit la table brute à la clé anon). Il est écrit, testé,
  livré sur la branche, et son application est liée au déploiement du code adapté.
- Médias privés / liens signés (audio-vidéo), vidéo courte, rencontres, budget par moment
  (lot 3 de la maquette) : restent au backlog, documentés en fin de suivi.
- Les couleurs littérales de `carnet-profile.css` (fiche **v1** legacy, proposition n° 65) ne
  sont pas reprises : la v2 est le défaut, le fichier appartient au travail déjà livré.

## Critères de sortie

- [ ] `/carnets` rend la liste réelle sous RLS, sans erreur console ni requête 4xx/5xx.
- [ ] Filtres, j'aime, ouverture d'un carnet, états vide/erreur/chargement joués au clic.
- [ ] Bande « En route » seulement avec des carnets réellement en cours ; statut dérivé des dates.
- [ ] Zéro couleur littérale dans le CSS du hub, cibles ≥ 44 px, contraste AA, reduced-motion.
- [ ] Lentille « Suivre » : progression, battements, résumé du soir intégrés sans casser les
      tests existants de la fiche.
- [ ] `tsc` 0, lint 0 erreur, Vitest concernés verts, build fixtures vert, banc Carnet sans
      nouvelle régression.
- [ ] Migration `carnet_etapes` présente en production + advisors relancés.
- [ ] Commit atomique + push sur `claude/kind-bell-bfyt69`, suivi écrit, liste honnête du reste.
