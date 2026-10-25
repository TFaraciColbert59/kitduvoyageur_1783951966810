# Compas — reprise dans Claude Code

> État au 1ᵉʳ octobre 2026. À lire en entier avant de toucher au code.
> Objectif : rendre le Compas (préparateur ultime, `/compas`) utilisable et fonctionnel à 100 %, sur le design v8 validé.

## 1. Où travailler

| Quoi | Valeur |
|---|---|
| Dépôt | `TFaraciColbert59/kitduvoyageur_1783951966810` |
| Branche | `feat/compas-preparateur` (dernier commit : `c299cab`, poussé) |
| Copie de travail à utiliser | `C:\Users\Tony\Desktop\kitduvoyageur-compas` (worktree propre, sur la branche) |
| **Copie à ne JAMAIS toucher** | `C:\Users\Tony\Desktop\kitduvoyageur` (branche `feat/mon-materiel-smart-cockpit-final`, ~57 changements non commités de Tony) |
| Serveur de dev | `npm run dev -- -p 4000` dans le worktree → `http://localhost:4000/compas` |
| Compte démo | identifiants dans `C:\Users\Tony\Desktop\compas-transfert\compte-demo-compas.txt` (ne jamais les recopier ailleurs) |
| Supabase actif | `icxyvwzfjbflcbqukpfz` (migrations autorisées directement) |
| Supabase fantôme | `lwrmuggefbmboikjgudc` — **interdit**, jamais de migration |

Depuis le PC, Claude Code peut faire `git push` directement : plus besoin des bundles du bac à sable.

## 2. Règles non négociables

- Couleur `#E4501C` interdite partout.
- `/hub` est la seule source de vérité pour le groupe : jamais d'interface parallèle de gestion d'équipe (le Compas renvoie vers `/hub/groupe`).
- Zéro donnée inventée ou factice dans le produit : une valeur absente est dite absente (« à peser », « non renseigné »), jamais un zéro ou une estimation déguisée.
- L'IA explique et traduit, le moteur décide. Aucun chiffre écrit par l'IA s'il n'est pas dans l'entrée (voir l'ancrage dans `engine/intent.ts`).
- Stripe hors périmètre. RouteStack : mode désactivé tant que les clés manquent ; jamais de lien de paiement, de checkout ni de commande sans action explicite de l'utilisateur.
- Ne pas contourner un fetch web bloqué.
- Pas de variable CSS dont le nom contient `role` (invariant CI). Icônes : seulement les noms présents dans `public/icons/sf/*.svg` (`menu`, `list`, `maximize-2` n'existent pas).
- Tony veut des preuves avant « terminé » : tsc, eslint, invariants, tests, build, entrée dans `MISSION_LOG.md`.

## 3. Carte du code Compas

```
src/app/compas/page.tsx                    route (force-dynamic, AppShell sans vidéo)
src/features/compas/
  engine/                                  PUR, testé, sans réseau
    compasModel.ts   modèle complet (parcours, dayPlans, dates.hours, préférences, kit, sacs, budget, verdict, prochaine décision)
    weather.ts       lecture Open-Meteo, qualité heure/jour, calendrier, DIN 33466, heure de départ, isotherme
    intent.ts        « Dis-le » : schéma d'actions, lecteur de règles sans IA, ancrage, limites, plan d'application
    meta.ts          lecture de trips.metadata (route_id, compas.duration_h, compas.prefs)
    sun.ts format.ts lever/coucher local, formats, règle logarithmique (rulerPosition / hoursFromPosition / snapHours)
  server/
    getCompasData.ts chargeur unique (hub + inventaire + réservations + boutique + météo des vrais jours du voyage)
    weather.ts       Open-Meteo prévision 16 j + archives 5 ans (server-only, revalidate 30 min / 24 h)
    compasActions.ts toutes les actions serveur (zod + session + droit d'édition + RLS, 0 ligne = échec)
  components/
    CompasScreen.tsx  écran, contrôleur (open/replace/back/close/run), décision → tiroir
    CompasCards.tsx   cartes résumé des 5 étapes (OuCard utilise DurationRuler)
    CompasRuler.tsx   règle de durée interactive (glisser/clavier → ✓)
    CompasOuFlows.tsx Activité, Parcours (+ confirmation), Quand (calendrier, jour par jour), Envies
    CompasDisLe.tsx   « Dis-le » en bas de chaque tiroir d'étape
    compasApply.ts    exécute les opérations planifiées (dates, groupe, budget, préférences, activité, objet)
    CompasSheets.tsx  tous les autres tiroirs (objet, trouver, ajouter, sac, porteur, flux des étapes)
  compas.css        matériau Liquid Glass v8 (+ section « Lot 1 » en fin de fichier)
src/lib/ai/features/compasIntent.ts        feature IA « compas-intent » (fast, sans cache, repli = règles)
supabase/migrations/20261001090000_compas_routes.sql   RPC compas_search_routes, compas_route_stages (appliquée)
```

Données stockées par le Compas : `trips.start_date/end_date/primary_activity/party_size/estimated_budget`, `trips.metadata.route_id` (partagé avec le hub), `trips.metadata.compas.duration_h` (sortie de moins d'un jour), `trips.metadata.compas.prefs` (`pace`, `nights`, `avoid[]`, `wishes[]`).

## 4. Lot 1 « Où et quand » — livré dans `c299cab`

- Météo des **vrais jours du voyage** (avant : aujourd'hui + 5 jours du hub) : heure par heure, rafales, isotherme 0 °C, lever/coucher.
- Calendrier 6 semaines au départ : prévision 16 j puis tendance des 5 dernières années (cerclée, jamais confondue).
- Heure de départ conseillée, départ au plus tard, alerte lumière/orages ; temps de marche DIN 33466 au pas du plus lent, rythme appliqué.
- Règle de durée modifiable (15 min → 30 j ; pas de 15 min sous 1 j, 1 j au-delà) avec ✓/✕ ; sans date de départ, ✓ ouvre « Quand ».
- Parcours : étapes, autour du départ (80 km), recherche texte (500 km), mes randos (`hike_sessions`), compteur de sorties publiques ; choix → `metadata.route_id` + redécoupage non destructif des étapes.
- Activité (7 valeurs de l'enum `trips`), Envies (rythme, nuits, éviter, envies ; les envies sont des raccourcis de recherche).
- « Dis-le » : IA `compas-intent` + règles ; propositions cochables, refus expliqués, rien n'est écrit sans « Appliquer ».
- Nouvelle décision moteur : « Choisir un parcours » quand le voyage n'a ni étape ni tracé.
- Preuves (bac à sable) : `tsc` 0 erreur, `eslint src/features/compas` 0 avertissement, invariants CI OK, **74 tests** (`src/features/compas` + `src/lib/ai`), harnais Chromium 390×844 : 12 états, 0 débordement, 0 erreur console.

### Reste à faire pour clore le Lot 1 (tâche #35)

1. `npm run build` dans le worktree (impossible dans le bac à sable : Google Fonts bloqué).
2. Test réel sur `localhost:4000/compas` avec le compte démo :
   - Quand : le calendrier et le jour par jour affichent bien Open-Meteo (vrai réseau) ; changer les dates, vérifier la base.
   - Règle : glisser 4 j → 5 j, ✓, vérifier `trip_steps` redécoupées (le voyage démo a-t-il un `metadata.route_id` ? sinon choisir un parcours d'abord).
   - Parcours : « Autour », recherche « Vercors », « Mes randos », choisir un parcours.
   - Dis-le avec la clé Nemotron du `.env.local` : « 3 jours à 4 dans le Vercors, départ samedi, bivouac, tranquille ». Vérifier que l'IA est utilisée (mention « Compris par l'IA ») et qu'un nombre inventé est refusé.
3. À vérifier visuellement : dans le harnais, le tiroir « Où et quand » en hauteur moyenne avec la réponse de Dis-le dépasse de 12 px (`CLIP cp-sheet 478>466`) — forcer la grande hauteur quand Dis-le affiche des propositions, ou réduire l'espacement.
4. Ajouter l'entrée Lot 1 dans `MISSION_LOG.md` avec les preuves locales (build compris).
5. Bug existant hors Compas, non corrigé : `addInventoryItem` utilise par défaut `condition: 'tres_bon'`, refusé par la contrainte `product_ownership.condition ∈ {neuf, bon, use, a_remplacer, pour_pieces}`.

## 5. Lots suivants

Périmètre prévu, d'après `compas/LKDV_COMPAS_INTERCONNEXIONS.md` et `compas/LKDV_CONFIGURATEUR_ULTIME.md` (documents du projet claude.ai « LKDV »). À confirmer avec Tony au début de chaque lot.

| Lot | Contenu attendu |
|---|---|
| 2 · Nous | taille du groupe modifiable, niveau et allure par membre (`user_performance_profiles`), capacité de portage, partage des dépenses (`trip_expenses.split_type`), invitations et rôles **via `/hub/groupe` uniquement** |
| 3 · Réserver | nuits à trouver (`route.nightsToFind`) → hébergements, liens affiliés `/go`, Viator ; RouteStack en mode désactivé jusqu'aux clés ; conversion Frankfurter ; aucun paiement sans geste explicite |
| 4 · Verdict | signaux sourcés et datés, danger séparé en trois (physique, technique, conjoncturel), alertes officielles (Meteoalarm, Météo-France), explication IA avec validateur de nombres ; pas de score magique |
| 5 · Kit | appliquer un kit existant (`materiel_kits`) avec taux de compatibilité, règles météo (isotherme, pluie → couches), eau, poids de base / porté / consommables, emprunt dans le groupe |
| 6 · Carte | couches Perso / Tribu / Amis, POI `trail_pois` (eau, abris, points de vue), profil d'altitude en accessoire |
| 7 · Gestes iOS 27 | lentille au doigt, barre d'onglets qui se réduit, appui long avec aperçu de l'effet, îlot dynamique avec Annuler, trois hauteurs de tiroir |
| 8 · Échelles | Sortie → Journée → Raid → Expédition → Monde : grain des étapes, sources, sac type, pays et formalités pour « Monde » |
| 9 · Production | `/compas` remplace `/prepare`, build CI, performance, accessibilité, tests e2e, nettoyage `EXAMPLE_TRAIL` et repli « Marceline », MISSION_LOG |

## 6. Commandes de preuve

```powershell
cd C:\Users\Tony\Desktop\kitduvoyageur-compas
npx tsc --noEmit
npx eslint --max-warnings=0 src/features/compas src/app/compas src/lib/ai/features/compasIntent.ts
node scripts/verify/ci_invariants.mjs
node scripts/verify/identity_compliance.mjs
node scripts/verify/icon-names.mjs
npx vitest run src/features/compas src/lib/ai
npm run build
```

La suite complète a 24 échecs préexistants, identiques sur `main` : ne pas les attribuer au Compas, ne pas les « corriger » au passage.
