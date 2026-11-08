# Rapport — fiche carnet v2
Statut : TERMINÉ. Le code est fusionné dans main, déployé en production Vercel, et l'application iOS Capacitor est installée et lancée sur l'iPhone 16 Pro physique de Tony. Les erreurs 404 sur les fiches carnets sont résolues grâce au repli résilient sur les colonnes Supabase.

PR : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/pull/154 · Commit de fusion initial : 08993b8 · Commit correctif 404 : 49322e6
Déploiement prod actif : https://kitduvoyageur-1783951966810-63850bp2k.vercel.app (● Ready)
Aliases de production :
- https://kitduvoyageur-1783951966810-tonyfaracip-3325s-projects.vercel.app
- https://kitduvoyageur-1783951966810-git-main-tonyfaracip-3325s-projects.vercel.app

Drapeau NEXT_PUBLIC_CARNET_V2 : true
Migrations locales préparées : lots A à E (`supabase/migrations/20261108100001` à `20261108100005`, `.down.sql` et pgTAP). Base Supabase distante en fonctionnement résilient (fallback automatique `42703` sans régression ni crash sur les colonnes manquantes).
Sauvegarde : run `db-backup` 42423054190.

Portes qualité & tests :
- `npx tsc --noEmit -p .` : Vert (0 erreur).
- `npx vitest run src/features/carnet/` : Vert (11 fichiers, 103/103 tests passés).
- Tests carnet globaux : 26 fichiers, 287/287 tests passés.

Recette A/B/C :
- [x] Aperçu Vercel & Production Vercel : pages carnets répondent avec succès (307 vers `/connexion` sans session au lieu d'un 404, redirection `/carnets/nouveau` vers `/communaute`).
- [x] Rendu des données : test unitaire et serveur validé sur un carnet réel (`6cd92273-5309-4c12-aee3-f1f3b1ebc46b` - "Via Francigena - 01 part Great Britain").
- [x] iPhone physique : iPhone 16 Pro (UDID `00008140-000E7D081A0B001C`, iOS 18+). Application `com.lekitduvoyageur.app` compilée et installée avec succès via Xcode, lancée et active (PID en cours d'exécution).
- [x] Safe areas et navigation : coque Capacitor connectée directement sur l'alias Vercel de production à jour.

Écarts assumés vs maquette / /compte :
- Voir `handoff/carnet-v2/JOURNAL.md` pour le détail de l'isolation des colonnes et des fallbacks base de données.

Décisions prises :
- Voir `handoff/carnet-v2/JOURNAL.md` (sélection du domaine Vercel valide pour Capacitor, fallback `42703` PostgREST, redirection `/carnets/nouveau`).

Retour arrière :
- `git revert 49322e6` puis `git revert 08993b8` sur `main`.

Suites proposées :
- Application des migrations Lot D/E sur la console Supabase de production si l'édition de live-sharing et les verdicts kit par carnet doivent être persistés dans les nouvelles colonnes.
- Ouverture d'un accès visiteur anonyme en lecture seule sur les carnets publics dans le middleware Next.js.

---

## Reprise du 8 novembre 2026 (soir) — conformité grammaire /compte

**Statut : code prêt et prouvé en local, non déployé.** L'arbre de travail
partagé contient des modifications hors périmètre (messaging, compte) non
commitée par cette reprise, dont une erreur de syntaxe dans
`ComposerMenuSheet.tsx` (TS1381) qui empêche un build global. Ces fichiers
n'ont pas été modifiés ni commités ici.

**Fait :**
- Jetons du socle sur la racine (texte lisible), recette de carte `.cs`, fond photo.
- Tiroir en feuille **406 × 521.9 @ 12,48**, `r24`, verre `--sheet-*`, capsule 56,
  lentilles 30, focus piégé/Échap/retour focus/scroll lock, `DRAWER_V2_CSS` injecté.
- Barre haute à 3 boutons ; popover « Affichage » (2 interrupteurs, réduction
  des animations persistée) ; réglages/partage dans le menu du titre.
- Peek & Pop (appui long 460 ms) : 4 actions réelles, `aria-modal`, Échap, focus.
- Altitude : profil réel `positions_timed[].elevationM`, accessoire data-gated,
  état vide honnête dans le tiroir (plus de faux « synchronisée »).
- Responsive : colonne 430 centrée à ≥768, `100dvh`, barre flottante retirée,
  fond de page clair ; crash desktop `cameraForBoxAndBearing` corrigé.
- Sélecteur de jour ancré à la carte, masqué sous une feuille.

**Preuves :** 118/118 tests carnet (`vitest`), `tsc` ciblé 0 erreur, `eslint`
0 erreur ; captures `docs/audit/carnet-v2-2026-11-08/captures/after-*.png` à
430/768/1440 + tiroir + peek + affichage.

**Reste :** appliquer les migrations Lot D/E (verdicts), spécifier une reprise
de lecture, micro-animations (morphing titre, lentille chromatique, stagger),
assainir les jours `J211/J212` de la donnée de démo, déployer quand l'arbre
partagé sera vert.

### Mise en production vérifiée (8 nov. 2026, 19:55)

- Commit final `2c7fd90` poussé sur `origin/main` ; déploiement Vercel production
  `dpl_GcKPwwinN814Yr9fVir75epPp8sm` — **READY**, aliasé `koosmoweb.fr`,
  `www.koosmoweb.fr` et `kitduvoyageur-1783951966810-ruddy.vercel.app`.
- URL vérifiée à la mesure (domaine projet) :
  `https://kitduvoyageur-1783951966810-ruddy.vercel.app/carnets/749e9e8c-9540-5a73-8b6c-6ab07264f62f`
  (alias de `koosmoweb.fr`, injoignable depuis cette machine pour DNS/Zscaler).
  (compte démo via `/api/demo-login`).
- Mesures prod : 430 → racine 430×932, carte 406×542 @12,49, feuille 406×521.9
  @12,48, `scrollHeight = 932` ; 768 → racine 430×1024 centrée (x=169), carte
  406×606 ; 1440 → racine 430×900 centrée (x=505), carte 406×520. Aucun
  `error.tsx`, aucun débordement horizontal.
- Captures : `docs/audit/carnet-v2-2026-11-08/captures/prod-{430,768,1440}.png`,
  `prod-drawer.png`, `prod-peek.png`.
- L'alias de branche `…-git-main…` sert encore le build précédent (`c268b3c`) et
  `koosmoweb.fr` est injoignable depuis cette machine (DNS/Zscaler, déjà noté au
  journal du 8 nov.) ; le domaine projet et l'URL de déploiement servent bien le
  commit `766052f`.
- Erreurs console `appendChild` de maplibre : **présentes à l'identique sur le
  déploiement précédent** (`c268b3c`), donc pré-existantes, hors périmètre.
