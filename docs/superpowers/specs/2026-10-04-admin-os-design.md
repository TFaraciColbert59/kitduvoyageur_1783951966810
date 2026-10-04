# Admin OS — Design Spec (MagicPath « LKDV Admin OS — Liquid Glass V2 Final »)

Source : projet MagicPath `457568374801727488`, composant `quiet-breeze-9371`
(TSX intégral récupéré + preview PNG vue). V1 (`cozy-time-4507`) morte
(`Resource not found`) — ignorée.

## Intentions conservées du design
- Shell plein viewport sur fond photo montagne + verre : sidebar, topbar,
  hero contextuel par route, pills période, 4 KPI, double panneau filtrable,
  inspecteur Copilot, Dynamic Island, palette ⌘K.
- 10 routes FR : overview, users, community, compas, gear, market,
  moderation, support, analytics, system. + `securite` (MFA, existant LKDV,
  11e item, icône `lock` ajoutée au set — seule extension).
- Iconographie `Symbol` 24 glyphes (paths exacts repris du TSX).
- États : période, outdoor (variante lisibilité), inspecteur on/off,
  palette, recherche filtrante du panneau droit.

## Décisions (divergences assumées, anti-mock)
- **Zéro mock** : chaque valeur vient d'une query RLS/serveur. Les microcopies
  chiffrées du design (« 4,7× », « 42 680 ») sont remplacées par des valeurs
  réelles calculées ; là où le design spécule, l'inspecteur affiche le signal
  réel (ex. « 3 retraits en attente, plus ancien : 2 j »).
- CTA « Demander à l'IA » → « Exporter le rapport » (CSV réel du dataset de
  section). Pas de backend IA : pas de bouton IA.
- Période Aujourd'hui/7j/30j/Personnaliser = vrais filtres `created_at`
  (audit, commandes, produits, utilisateurs). Agrégats « vs période
  précédente » calculés quand les données le permettent, sinon delta masqué
  (jamais inventé).
- Thème : shell light forcé par variables scopées (pas de mutation document).
- Responsive : sidebar → drawer overlay <lg, panneaux empilés, inspecteur →
  overlay ; pas de hash-routing (vraies routes Next `/admin/*`).
- CTA par route → vraies destinations (création ou page concernée).

## Mapping routes → données LKDV
| Route | Source |
|---|---|
| overview | `getOverviewCounts` + `getPriorityQueue` + `getCopilotSignal` (nouveau) |
| users | `listUsersPage` (existant) |
| community | `getCommunityStats` (nouveau : clubs, membres, carnets, club_reports) |
| compas | `getCompasStats` (nouveau : table `trips` — DDL à vérifier en implémentation) |
| gear | `listProductsPage` + stock/mouvements (existant) |
| market | `listOrdersPage` + retraits (existant) |
| moderation | `listModerationQueue` (existant) |
| support | `getSupportInbox` (nouveau : union modération critique + retraits + stocks bas, sans table) |
| analytics | `getAnalytics` (nouveau : agrégats calculés, funnel documenté) |
| system | `getSystemStatus` (nouveau : ping DB, version build, présence clés redacted) |
| securite | existant MFA, restylé |

Badges : community = `club_reports` en attente ; support = taille inbox ;
system = services dégradés. Compte sidebar : utilisateur réel
(`Tony / Super Admin · MFA actif` calculé : rôle réel + facteur MFA réel).

## Système visuel
- Fond : `/assets/images/app-background.jpg` + scrim (à valider visuellement).
- Verres : 4 niveaux repris du design (`regular` sidebar/topbar/inspecteur/
  palette, `interactive` boutons/search, `tint` CTA/orbe, `clear` KPI/pills/
  chips) en variables scopées `.admin-os`.
- Primitives LKDV réutilisées où possible (Button/Spinner/EmptyState) ;
  styles Admin OS en `admin-os.css` (pas de `<button>` brut : tout passe par
  Button ou classes shell dédiées).
- Tons sémantiques `good/info/warn/danger` mappés sur `--lkv-*`.

## Non-objectifs
- Parité pixel-parfaite du CSS MagicPath (non livré) : fidélité visuelle
  validée par screenshots Playwright vs preview.
- Notifications temps réel, IA Copilot conversationnelle, multi-environnement
  (pastille Production statique + doc).
