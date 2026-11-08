# 07 — Recette et rapport final

Chaque case cochée l'est avec une preuve (capture, sortie de commande, lien de run CI) rangée dans `docs/audit/communaute-v2-<date>/` (CLAUDE.md § 1.4 : aucune case cochée sans preuve).

## A. Aperçu Vercel
- [ ] Explorer : chaque volet, chaque filtre, menu de tri (Carnets, Clubs), détails empilés — captures 390×844 côte à côte avec la maquette.
- [ ] Création : chaque étape des 6 types, avec aperçu vivant — captures côte à côte.
- [ ] Gestes : ouverture, poignée (rubber-band, seuil), Échap, capsule, mini-capsule, glisser entre filtres, appui long (Peek), pile et Retour, menu de tri (ouverture, choix, fermeture extérieure).
- [ ] Teintes : aucune couleur non verte hors danger (inspection des styles calculés des pastilles et décorations).
- [ ] Formulaires : erreurs une seule fois, Retour/Suivant, brouillon restauré, confirmation de fermeture, clavier (iPhone Safari).
- [ ] Atomicité (base locale ou branche) : couper le réseau au milieu d'une création de club et d'une sortie → ni club sans admin, ni annonce sans sortie.
- [ ] Invité : lecture seule, `requireAuth` partout ailleurs.
- [ ] 0 erreur console, 0 débordement 360/390/430, a11y sans critical/serious.

## B. Production
- [ ] Même liste qu'en A, en prod, avec le compte de démo et **dans les limites de `00` § 4.8** : en prod on ne crée que story `only_me`, carnet privé, kit privé, post `abonnies` sans abonnés, puis on les supprime ; création de sortie et de club recettée sur base locale ou branche (preuve jointe).
- [ ] Recherche : accents, fautes légères, ponctuation ; temps de réponse RPC < 300 ms au p95 (logs Supabase).
- [ ] Compteurs (membres, participants, j'aime) justes après rejoindre/quitter/s'inscrire/annuler, **uniquement sur des clubs et sorties de démo** (auteurs `is_demo`), jamais sur ceux de vrais utilisateurs ; état final identique à l'état initial.
- [ ] Drapeau à `false` testé une fois sur un déploiement d'aperçu (pas en prod) : anciens tiroirs OK.
- [ ] Non-régression : fil, stories, `/compte`, `/messagerie`, fiche carnet, `/clubs/[id]`, `/communaute?tab=evenements` (parcours rapide + e2e existants verts).
- [ ] 30 min de surveillance sans 5xx ni rapport CSP nouveau ; advisors Supabase sans nouvelle alerte.

## C. iPhone
- [ ] App installée via Xcode ; ouverture des deux tiroirs depuis la Communauté.
- [ ] Haptique sur capsules, mini-capsules, tri, rejoindre, envoi.
- [ ] Safe areas (encoche, indicateur d'accueil) ; clavier ne masque jamais le pied ni le champ actif.
- [ ] Caméra/photothèque (Publication, Story, Carnet) et géolocalisation (Près de moi, RDV) avec les textes d'autorisation en français.
- [ ] Flow Maestro `.maestro/communaute.yaml` vert.

## Modèle de `handoff/communaute-v2/RAPPORT.md`
```markdown
# Rapport — tiroirs de la Communauté v2
Statut : TERMINÉ | TERMINÉ SAUF <étape> (raison, commande pour reprendre)
Prérequis carnet-v2 : fusionné | non fusionné (conséquence : nuits du formulaire Carnet masquées)
PR : <lien> · Commit de fusion : <sha> · Déploiement prod : <url> · Drapeau NEXT_PUBLIC_COMMUNAUTE_V2 : true
Migrations appliquées en prod : <version → lot> · Sauvegarde : <id run db-backup>
RPC créées : <liste> · Colonnes ajoutées : <liste>
Portes qualité : <liens des runs CI> · Tests ajoutés : <nombre par type>
Couverture du document : <n>/200 faites ; reportées (01 § 6) : <liste> ; autres non faites : <numéro → raison>
Ajouts au-delà du document : <liste>
Recette A/B/C : <cases + lien du dossier de preuves>
iPhone : <modèle, iOS, résultat>
Écarts assumés vs maquette / /compte : <liste + raison>
Décisions prises seul : <renvoi au JOURNAL.md>
Retour arrière : <commandes exactes>
Suites proposées : retrait des tiroirs v1 et de `features/community/card/` (PR brouillon <lien>), lecture des clubs `secret` réservée aux membres (faille actuelle de `clubs_read`), référence morte `clubs.is_private` (`ClubLiquidGlassV8.tsx:896`), invitations (clubs, sorties), vidéo dans les publications, sondage/options/programmation des posts, rappels de sortie, occurrences récurrentes, scan code-barres, TestFlight
```
