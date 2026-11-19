# Rapport final · Mission LKDV « Créateur d’itinéraires collaboratif 20/10 »

- **Branche** : `feat/itineraire-collaboratif-20-10`
- **Base de départ** : `hyd/integrated` (`26498948`), jalon initial `aa9e051c9f8d21c3fa1744da699fce661e17e278`
- **Architecture UI retenue** : Identique à `/explorer` — **strictement 2 éléments à l’écran** (carte plein écran `100vw × 100dvh` sans aucun bouton flottant + pilule 3 petits points `•••` ouvrant le **Tiroir Principal `ExplorerSheet`** et ses **11 Sous-Tiroirs**, avec interconnexion bidirectionnelle temps réel Carte ↔ Tiroir).

---

## 1. Inventaire complet du Tiroir Principal et des 11 Sous-Tiroirs

### Écran racine (`/compas/itineraire`)
1. **Carte plein écran** (`RouteCollabMap.tsx`, MapLibre GL) — clic libre = insertion d’un point en direct ; clic point = ouvre le sous-tiroir *Détail du point* ; clic tronçon = ouvre le sous-tiroir *Détail du tronçon* ; tracé routé vert / sélectionné or / manuel pointillé / variante indigo / curseur altimétrique rouge. En l’absence de WebGL, bascule automatique sur la surface liste accessible + ouverture du tiroir.
2. **Pilule 3 petits points en bas** (`.xp-sheet-pill-launcher` + `.xp-pill-dots`) — unique bouton visible lorsque le tiroir est fermé. Ouvre `ExplorerSheet`.

### Tiroir Principal (`ExplorerSheet`, 5 onglets)
- **Onglet 1 · `Tracer`** : métriques globales (distance, D+, D−, durée), profil (`Randonnée` / `Vélo`), forme (`Aller` / `Boucle` / `Aller-retour`), `Inverser le sens`, `Restaurer seq N-1`, liste interactive des Points (`+ Ajouter un point`), liste interactive des Tronçons, accès aux sous-tiroirs *Carte & Affichage*, *Importer / Exporter GPX*, *Variantes & Comparateur*.
- **Onglet 2 · `Étapes`** : liste des Journées & Nuitées (`Jour 1`, `Jour 2`, …), `+ Découper en N journées`, accès au sous-tiroir *Sac & Matériel du groupe* avec compteur d’articles à revalider.
- **Onglet 3 · `Analyser`** : profil altimétrique SVG synchronisé avec le marqueur rouge sur la carte (ou mention honnête si altitude absente), diagnostic qualité (sections, manuelles, alertes), accès aux sous-tiroirs *Météo, Eau & Terrain*, *Variantes & Comparateur*, *Importer / Exporter GPX*.
- **Onglet 4 · `Équipe`** : présence en direct (qui édite/consulte quelle étape), accès aux sous-tiroirs *Commentaires & Propositions*, *Membres, Droits & Partage*, *Matériel commun & Attribution*, et carte versionnée pour Hub / Club / Messagerie.
- **Onglet 5 · `Départ`** : état de publication (`vN`) vs pack vérifié localement (`vM`) vs réseau (`En ligne` / `Avion`), actions directes `Publier vN` et `Télécharger le pack`, accès aux sous-tiroirs *Hors ligne, Activité & Carnet*, *Checklist du sac*, *Carte & Mode liste*.

### Les 11 Sous-Tiroirs (`onBack` → Tiroir Principal, `onClose` → Pilule `•••`)
1. **Détail du point** (`point`) : coordonnées, altitude, version d’entité, déplacer, supprimer, commentaires ancrés + ajout de commentaire.
2. **Détail du tronçon** (`section`) : mode (`Routé` / `Manuel` / `Trace importée`), recalcul réel **Valhalla `/api/route` + DEM `/api/elevation`** protégé par empreinte d’entrée, bascule `Routé ↔ Manuel`, métriques, provenance et alertes.
3. **Détail d’étape** (`stage`) : distance/D+/durée de la journée, sélecteur de nuitée (`Journée` / `Refuge` / `Bivouac` / `Gîte`) déclenchant le graphe d’impact sur le sac, déplacement de la coupure de fin d’étape, notes, export GPX de l’étape.
4. **Carte & Affichage** (`map-settings`) : fond de carte (`Plan OSM` / `Relief Topo` / `Satellite`) avec licence, `Recentrer sur l’itinéraire`, bascule `Mode liste sans carte`.
5. **Importer / Exporter GPX** (`gpx`) : export GPX 1.1 complet et par étape, import GPX avec case `Garder ma trace` (préserve le XML original et la géométrie importée).
6. **Variantes & Comparateur** (`variants`) : création d’un détour, comparaison distance / D+ / durée / % surface connue / provenance, `Superposer sur carte` / `Masquer sur carte` (tracé indigo live), `Appliquer`.
7. **Sac & Matériel** (`kit`) : distinction personnel / commun, attribution par membre, badges `À revalider` avec motif précis et confirmation sélective (`Confirmer`).
8. **Météo, Eau & Terrain** (`terrain`) : météo datée par lieu & créneau + fournisseur, points d’eau (`Coule` / `À sec` / `Inconnu`, potabilité, date), dangers datés avec expiration et inconnues affichées sans invention.
9. **Commentaires & Propositions** (`proposals`) : commentaires ancrés avec bouton `Repositionner` pour les orphelins (`needs_relocation`), propositions avec motif et aperçu, vote Pour/Contre, Accepter / Refuser avec vérification `expectedHeadSeq`.
10. **Membres, Droits & Partage** (`sharing`) : membres, rôles (`Responsable`, `Coorganisateur`, `Éditeur`, `Contributeur`, `Participant`), présence en direct, lien lecture seule révocable (48 h, zone de départ privée masquée).
11. **Hors ligne, Activité & Carnet** (`offline-carnet`) : manifeste pack (version, taille, checksum, éléments présents/indisponibles), `Télécharger le pack`, `Simuler coupure pack`, `Simuler mode avion`, file d’opérations locales en attente + `Synchroniser`, `Démarrer l’activité`, `Terminer et ouvrir le carnet`, Bilan Carnet immuable + `Reprendre cette sortie`.

---

## 2. Les 5 passes d’audit, correction et validation exécutées

| Passe | Périmètre vérifié | Preuves & Corrections apportées | Résultat |
| :--- | :--- | :--- | :--- |
| **Passe 1 · Socle, TS, Lint, Build, Garde-fous** | `type-check`, `eslint`, `next build`, tests préexistants en échec | Découplage `server-only` (`sortiesParsing.ts`), fix hook conditionnel `OutingTrace.tsx`, restauration 4 fixtures E2E (`ephemeralDbGuards.spec.ts` 12/12), localisation raccourcis Android (`nativeLocalizations.test.ts` 15/15), heap 6144 Mo (`package.json`). | **PASS** (`tsc` 0 err, `eslint` 0 err, `build` exit 0, 38/38 Vitest) |
| **Passe 2 · Migration Supabase & RLS sur PostgreSQL 17.6** | `supabase/migrations/20261118120000_route_collab_20_10.sql` + `route_collab_20_10_rls.test.sql` | Exécution réelle sur PostgreSQL 17.6 dans une transaction `BEGIN; ... ROLLBACK;` (0 effet en prod) : 64 trips / 141 hike_sessions / 91 carnets préservés, fix `geography(..., 4326)` non qualifié, RPC `apply_route_operation_tx` (`FOR UPDATE`, idempotence, mismatch rejeté, participant refusé, révocation immédiate) et `publish_route_revision_tx` (blocage séquence périmée). | **PASS** (100 % assertions SQL) |
| **Passe 3 · Coédition multi-sessions, Routage réel & Explorer D1.5** | `/api/explorer/v2/search?q=Lille`, `/api/route` (Valhalla) + `/api/elevation` (DEM), 3 sessions authentifiées + anonyme | Recherche `Lille` sans GPS -> `{ lat: 50.6365654, lon: 3.0635282, provider: 'photon' }` + 5 candidats + 5 traces ; fix format `legs[0].geometry` Valhalla (`Array<[lon, lat]>`) ; recalcul réel 3,33 km / 168 pts / D+ 29 m ; éditions parallèles J1/J2 propagées < 2 s ; conflit 409 sur même point ; révocation 403 immédiate ; anonyme 401 + écran refusé. | **PASS** (Playwright + Live QA) |
| **Passe 4 · Hors-ligne réel avec fermeture & redémarrage navigateur + Sans WebGL** | `launchPersistentContext` (`--disable-webgl`), coupure pack v2, mode avion, Activité → Carnet, file locale + replay | Publication v1 + téléchargement Pack v1 → publication v2 + coupure simulée (v1 intact) → fermeture complète Chromium → redémarrage sur profil disque → mode avion → Pack v1 vérifié, activité v1 + kit figé, carnet immuable, ajout point hors ligne → reconnexion → `Synchroniser (1)` = `1 appliquée(s)`. | **PASS** (Chromium & WebKit) |
| **Passe 5 · Refonte UX identique à `/explorer` & QA Visuelle** | Design strict 2 éléments (Carte + Pilule `•••` + Tiroir/11 Sous-Tiroirs), Desktop + Mobile Chromium + Mobile WebKit | Suppression totale des boutons flottants/topbars/colonnes ; alignement 100 % sur `explorer-v2.css` + `ExplorerSheet` ; correction padding bas pour bannière RGPD (`--cookie-banner-h`) ; correction sélecteur Suspense streaming WebKit ; vérification visuelle par capture d’écran (`final_step_47.png`). | **PASS** (6/6 Playwright + Capture vérifiée) |

---

## 3. Matrice complète des exigences validées

| Domaine / Exigence | Implémentation clé | Preuve de validation | Statut |
| :--- | :--- | :--- | :--- |
| **D1.5** · Recherche « Lille » sans GPS + « Préparer avec ce tracé » | `src/app/api/explorer/v2/search/route.ts`, `src/features/explorer-v2/sheet/SheetContent.tsx` | `GET /api/explorer/v2/search?q=Lille` -> `50.6365, 3.0635` (Photon), 5 traces, lien `/compas?from=explorer&routeId=...` | **Validé** |
| **Reprise brouillon après `/connexion`** | `src/features/compas/engine/pendingDraft.ts`, `V5Start.tsx`, `CompasStart.tsx` | Sauvegarde/reprise sessionStorage du brouillon avant redirection `/connexion` | **Validé** |
| **Étape 1** · Brouillon vide / Explorer / GPX / Activité + « garder ma trace » + provenance | `engine.ts` (`parseGpxToWorkspaceEntities`, `exportWorkspaceGpx`), `RouteCollabWorkspace.tsx` (`gpx` subdrawer) | Import GPX préserve `originalGpxXml` + géométrie `imported_preserved`, export GPX 1.1 complet & par étape validé (`HTTP 200`, `<gpx version="1.1"`) | **Validé** |
| **Étape 1** · Identifiants stables, boucle/aller/aller-retour, inversion, manuel/routé, profils marche/vélo | `engine.ts`, `types.ts`, `RouteCollabWorkspace.tsx` (`tracer`, `point`, `section`) | Tests unitaires `routeCollabEngine.test.ts` + E2E + Live QA | **Validé** |
| **Étape 1** · Empreinte d’entrée anti-écrasement tardif + recalcul Valhalla + DEM | `computeRoutingFingerprint`, `apply_routing_result`, `handleRealRouteSection` | Test unitaire rejet recalcul périmé (`stale_routing_discarded`) + Live QA recalcul Valhalla 168 pts + DEM D+ 29 m | **Validé** |
| **Étape 1** · Découpage journées, coupures, notes, nuits, profil altimétrique synchronisé, variantes, météo/eau/accès honnêtes | `RouteCollabWorkspace.tsx` (`etapes`, `stage`, `analyser`, `variants`, `terrain`) | Live QA + Playwright : variante indigo sur carte, profil SVG synchronisé, inconnues affichées sans invention | **Validé** |
| **Étape 1** · Design identique Explorer (Carte + Pilule `•••` + Tiroir) + Fallback sans WebGL | `RouteCollabMap.tsx`, `RouteCollabWorkspace.tsx`, `ExplorerSheet` | Playwright asserte `visibleButtons === 1` tiroir fermé + `--disable-webgl` mode liste + capture `final_step_47.png` | **Validé** |
| **Étape 2** · Rôles (responsable, coorganisateur, éditeur, contributeur, participant), clubs RSVP sans écriture | `permissions.ts`, `integrations.ts`, `20261118120000_route_collab_20_10.sql` | pgTAP/SQL PG 17.6 + `integrationsAndFeatures.test.ts` | **Validé** |
| **Étape 2** · Présence, commentaires ancrés + repositionnement orphelins, propositions avant/après + vote + vérification `headSeq`, historique & restauration | `serverStore.ts`, `engine.ts`, `/api/routes/[id]/*`, `proposals` & `sharing` subdrawers | Tests unitaires + API routes + Playwright | **Validé** |
| **Étape 2** · Journal d’opérations, versions par entité, transaction courte `FOR UPDATE`, idempotence, fusion indépendante, conflits 409, révocation immédiate | `apply_route_operation_tx`, `publish_route_revision_tx`, `serverStore.ts` | PG 17.6 (`already_applied`, `idempotency_payload_mismatch`, `403` après révocation) + Playwright 3 sessions (`200` parallèles, `409` conflit, `403` révoqué) | **Validé** |
| **Étape 3** · Graphe d’impact (km, durée, horaires, météo, eau, nuit, sac) + Inventaire & matériel commun + revalidation sélective + publication exacte `expectedHeadSeq` + ponts Clubs/Messagerie/Hub | `computeRouteImpact`, `integrations.ts`, `TrailCard.tsx`, `kit` subdrawer | Refuge → Bivouac déclenche bandeau d’impact et marque uniquement les articles liés à revalider ; publication bloquée si `headSeq` a avancé | **Validé** |
| **Étape 4** · Pack versionné avec manifeste/checksum, staging atomique v2 sans casser v1, fermeture/redémarrage navigateur en mode avion, file locale + replay causal, Activité → Carnet immuable + « Reprendre cette sortie » | `offlinePackStore.ts`, `public/sw-v18.js`, `/compas/itineraire/offline`, `offline-carnet` subdrawer | Playwright `launchPersistentContext` fermeture + redémarrage complet, mode avion, Pack v1 intact après coupure v2, Carnet v1 immuable, replay file hors ligne `1 appliquée(s)` | **Validé** |
| **Étape 5** · Migrations additives compatibles, droits 2+ comptes & anonyme, robustesse (GPX invalide, traces volumineuses, sans WebGL, mobile & desktop), types/lint/build/tests | `supabase/migrations/20261118120000_route_collab_20_10.sql`, `tests/e2e/route-collab-20-10.spec.ts` | PG 17.6 (0 régression données existantes), `tsc` 0 err, `eslint` 0 err, `next build` exit 0, Vitest 38/38, Playwright 6/6 | **Validé** |
