# Jeux de validation du Compas (PLAN-100, phase 7)

Trois jeux de demandes écrites comme on les tape sur un téléphone, rejouées sur un déploiement par
`scripts/compas/validate-online.mjs`, contrôlées en base par `check.sql`, jugées par `compare.mjs`.

| Jeu | Demandes | Contenu |
|---|---|---|
| `reels-20.json` | 20 | Les parcours déjà joués (ETAT.md, audit du 7 oct.) : à comparer aux résultats passés |
| `nouvelles-50.json` | 50 | France et Europe, jamais jouées : 10 activités × 5, durées, groupes, budgets, départs, contraintes, noms difficiles |
| `monde-50.json` | 50 | Hors Europe : hémisphère sud, écritures non latines, voyageurs non français, sans départ, Fidji, haute altitude, déserts, îles, parcs nationaux |

## Ordre d'exécution

Depuis la racine du dépôt, `node_modules` installé. Le passage ne s'adresse qu'au déploiement qu'on lui
donne ; `check.sql` ne lit que (une seule requête `SELECT`).

```bash
BASE=https://kitduvoyageur-1783951966810-ruddy.vercel.app   # koosmoweb.fr ne résout plus depuis le 13 oct.
SET=reels-20                                                # ou nouvelles-50, monde-50
RUN=proof/compas/$SET-$(date -u +%Y-%m-%d-%H%M)             # proof/ n'est pas versionné
```

### 1. Le passage en ligne

```bash
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node scripts/compas/validate-online.mjs "$BASE" scripts/compas/validation/$SET.json "$RUN"
```

- `/opt/pw-browsers/chromium` est un lien vers ce même binaire (`chromium-1194/chrome-linux/chrome`) ;
  les deux chemins marchent. Le script doit rester dans le dépôt (ici `scripts/compas/`) : hors du
  dépôt, l'import de `@playwright/test` échoue.
- Pour `monde-50`, ajouter `NO_GPS=1` devant la commande : le navigateur n'a alors aucune position
  (sinon il se trouve à Annecy, permission accordée). C'est le cas « sans GPS » du jeu.
- Un seul jeu à la fois. Chaque demande est séparée de la précédente de 125 s (limite : 6
  préparations par 10 minutes et par personne). Une demande qui dure plus de 125 s fait partir la
  suivante aussitôt.
- Sortie dans `$RUN` : `results.jsonl` (une ligne par demande : `id`, `startedAt`, `endedAt`,
  `seconds`, texte de l'écran, ou `error`) et une capture par demande.

| Jeu | Demandes | Durée du passage à 125 s d'écart |
|---|---|---|
| `reels-20` | 20 | environ 42 min (19 × 125 s + la dernière préparation, connexion comprise) |
| `nouvelles-50` | 50 | environ 1 h 45 (49 × 125 s + la dernière) |
| `monde-50` | 50 | environ 1 h 45 |
| les trois | 120 | environ 4 h 10 |

### 2. Le contrôle en base

La personne qui a lancé le passage est un compte d'essai créé au début du passage (ou le compte démo
partagé tant que l'essai sans compte n'est pas ouvert : son identifiant se lit alors dans
`trips.user_id` d'un voyage de la fenêtre). Trouver l'identifiant du compte d'essai (lecture seule),
avec l'heure de la première ligne de `results.jsonl` :

```sql
select id, created_at from auth.users
 where is_anonymous and created_at >= '2026-10-14T08:00:00Z'   -- startedAt de la 1re ligne, moins 5 min
 order by created_at limit 5;
```

Puis `check.sql`, sur une connexion en lecture seule. Fenêtre : `since` = `startedAt` de la première
ligne moins 1 minute ; `until` = `endedAt` de la dernière ligne plus 6 minutes (une préparation peut
finir 5 minutes après l'écran).

```bash
psql "$DATABASE_URL" -X -q --csv \
  -c "set default_transaction_read_only = on" \
  -c "set lkdv.check_user_id = '<uuid de la personne>'" \
  -c "set lkdv.check_since   = '2026-10-14T08:59:00Z'" \
  -c "set lkdv.check_until   = '2026-10-14T11:10:00Z'" \
  -f scripts/compas/validation/check.sql > "$RUN/check.csv"
```

- Autre voie : `lkdv.check_trip_ids = 'uuid,uuid,…'` à la place de la fenêtre.
- Éditeur SQL du tableau de bord ou connecteur (instructions seules, pas de `psql`) : mettre les
  `set lkdv.check_… = '…';` en tête du script, exporter le résultat en JSON (tableau d'objets) dans
  `$RUN/check.json`. `compare.mjs` lit les deux formats.
- Sans paramètre complet, `check.sql` ne rend aucune ligne (jamais « tous les voyages »).
- Une ligne par voyage : titre, destination, pays, activité, dates, jours, groupe, départ, étapes
  (sans nom de lieu, sans coordonnées, au même lieu que la précédente, hors du rayon, proposées par
  l'IA), objets de kit, lignes de budget, durée de préparation, journal `ops_preparation_events`,
  erreurs `app_errors` pendant la préparation.

### 3. La comparaison

```bash
node scripts/compas/validation/compare.mjs \
  --run "$RUN" --check "$RUN/check.csv" --set scripts/compas/validation/$SET.json \
  --json "$RUN/rapport.json"
```

Affiche, par demande, `prête`, `partielle` (avec ce qui manque) ou `échec`, puis le taux de
réussite. `--min-rate 95` fait sortir en code 1 sous 95 % (critère « monde » du plan).
`--max-seconds` (60 par défaut) et `--skew-seconds` (20, écart d'horloge toléré entre le poste et la
base pour ranger un voyage sous sa demande) se règlent.

## Les verdicts

- **prête** : la préparation a réussi en moins de 60 s et rien n'est manqué ;
- **partielle** : préparée, mais une attente de `expect`, la durée ou un invariant est manqué (la
  liste est donnée) ;
- **échec** : aucun voyage en base, préparation en échec, ou jamais finie (aucune issue écrite) ;
- **non joué** : ni ligne du journal ni voyage ; compté à part, hors du taux.

Taux de réussite = prêtes / jouées ; le taux de préparation (prêtes + partielles) est donné aussi.

Invariants, toujours vérifiés (préfixe `[invariant]`) : au moins une étape, aucune étape sans
coordonnées ni sans nom de lieu, au moins un objet de kit et une ligne de budget, aucune erreur
serveur (`app_errors`) pendant la préparation. Mises en garde (`!`), qui ne changent pas le
verdict : étapes hors du rayon de la destination, aucune ancre, étapes proposées par l'IA, phrase de
départ restée rangée, plusieurs voyages pour une demande, deux étapes de suite au même lieu (sauf
pour un parcours dit linéaire, où c'est un manque).

La durée est celle de la base : de la création du voyage (clic sur « Préparer mon aventure ») à
l'heure de l'issue écrite par le serveur ; à défaut, celle vue par le passage.

## Format d'un jeu

Un tableau de `{ id, phrase, expect }` ; `id` : `r01…` (réels), `n01…` (nouvelles), `m01…` (monde).
`expect` ne contient que ce qui se vérifie en base, avec des tolérances prudentes, et jamais un nom
de lieu que la phrase ne dit pas :

| Clé | Sens | Vérifié sur |
|---|---|---|
| `country` | code ISO alpha-2, ou liste (l'un d'eux) | `trips.destination_country_code` |
| `activity` | valeur de `trip_activity_type`, ou liste | `trips.primary_activity` |
| `days` | nombre, ou `[min, max]` (« quelques jours » : `[2, 10]`) | `end_date - start_date + 1`, sinon dernier jour d'étape |
| `party` | personnes dites | `trips.party_size` |
| `origin` | départ dit (texte), ou `null` si aucun | `metadata.compas.origin.name` |
| `carFree` | « sans voiture » | `metadata.compas.prefs.carFree` |
| `nights` | `refuge` ou `bivouac` | `metadata.compas.prefs.nights` |
| `budget`, `perPersonBudget` | montant dit (× groupe si par personne) | `trips.estimated_budget` (exact dans la devise du voyage, ordre de grandeur dans une autre) |
| `startMonth`, `startMonthDay`, `startOffsetDays` | mois, jour « MM-JJ », jours depuis la création | `trips.start_date` |
| `hemisphere` | `"S"` : toutes les étapes au sud de l'équateur | latitudes des étapes (sinon l'ancre) |
| `linearRoute` | descente de rivière, parcours en ligne : jamais deux étapes de suite au même lieu | étapes |

## À savoir

- `trip_steps` n'a pas de colonne `place_id` : le lieu d'une étape est son nom (`location_name`,
  sinon la fin du titre « Jour N · nom »). `steps_no_place` compte les étapes sans nom.
- Aucune table ne garde le début et la fin d'une préparation par voyage : `ops_preparation_events`
  (heure et genre d'issue, sans voyage) et `app_errors` (sans voyage) ne font que corroborer ; la
  durée vient de `trips.created_at` et de `metadata.compas.autofill_result.at`. Les erreurs
  serveur sont rangées sous un voyage par l'heure : exact tant que les demandes sont espacées.
- Un voyage est rangé sous sa demande par l'heure (`startedAt` / `endedAt` du journal) : le passage
  doit être celui de ce dépôt (il écrit ces heures) et l'horloge du poste proche de celle de la base.
- Les attentes sur `activity` sont larges quand la phrase le permet (« raquettes » : `ski` ou
  `hiking`, car les règles du Compas rangent les raquettes avec le ski). Un « city break » attend
  `citytrip` ou `cultural` : les règles du Compas (hors IA) ne reconnaissent que « city trip » ; si
  l'IA ne tranche pas non plus, ces demandes sortent en `partielle` avec `mixed`.
- Le taux de change d'un budget en devise étrangère n'est pas connu du contrôle : seul l'ordre de
  grandeur est vérifié.
