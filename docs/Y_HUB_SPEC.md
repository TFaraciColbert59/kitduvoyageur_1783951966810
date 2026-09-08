# Y_HUB_SPEC — Spécification de positionnement du hub voyage (Y0.3)

Fige la Partie 4 de `unification.md`, amendée par `Y_DECISIONS.md`.
Toutes les valeurs numériques ont été revérifiées dans le code le 07/09/2026.

---

## 1. Les quatre zones invariantes

| Zone | Contenu exclusif | Desktop | Mobile |
|---|---|---|---|
| **En-tête** | Identité + état global : `ActiveTripSwitcher`, `TripNetworkStatus`, partage. Rien de contextuel. | `Header` global, hauteur `pt-14 sm:pt-[62px]` (vérifié `AppShellDesktop.tsx:66`) | Même header ; sheet sections via bouton ≥ 44 px |
| **Colonne gauche 260 px** | Navigation uniquement : fil d'Ariane `/voyages`, carte identité, bascule Activer, partage, nav registre, `TripSectionPicker`, pied. Zéro métrique. | `w-[260px] shrink-0 h-full` (vérifié `AppShellDesktop.tsx:71`) | `GlassSheet` déclenché depuis l'en-tête |
| **Centre flex-1** | Travail en cours : `TripHero` (overview) **ou** `TripCompactHeader` (autres), vue de section. Max 3 infos de synthèse en tête. | `flex-1 h-full overflow-y-auto no-scrollbar px-1 pb-6` | Pleine largeur |
| **Colonne droite 300 px** | Contexte non navigable : widgets du registre, sans en-têtes de section. | `w-[300px] shrink-0 h-full` | Bande défilante horizontale sous l'en-tête de section **ou** `GlassSheet` bas |

Structure 3 colonnes : `pt-14 sm:pt-[62px] pb-4 px-4 sm:px-6 lg:px-8 max-w-[1680px] w-full mx-auto` → `flex items-start gap-5 h-full` (recette `AppShellDesktop` vérifiée).

---

## 2. Les dix sections (registre `tripSectionRegistry`)

Arbitrage 5 : la carte est un **mode** de `itinerary`, pas une section → 10 entrées.

| # | id | segment | libellé | phases | permission | compteur | statut |
|---|---|---|---|---|---|---|---|
| 1 | `overview` | *(racine)* | Aperçu | prepare, live, recount | — | — | existe |
| 2 | `itinerary` | `itineraire` | Itinéraire | prepare, live | — | `steps.length` | existe |
| 3 | `gear` | `kit` | Équipement | prepare | — | `items.length` | existe |
| 4 | `team` | `equipage` | Équipage | prepare, live | — | `collaborators+1` | existe |
| 5 | `budget` | `budget` | Budget | prepare, recount | `canManageBudget` ⚠️ à appliquer (incohérence §4.2 du doc) | `expenses.length` | existe |
| 6 | `docs` | `documents` | Documents | prepare, live | `canViewDocuments` | `documents.length` | existe |
| 7 | `checklist` | `checklist` | Checklist départ | prepare | — | non cochés | existe |
| 8 | `safety` | `securite` | Sécurité | prepare, live | — | checkpoints `pending` | 🆕 |
| 9 | `journal` | `journal` | Journal | live, recount | — | `notes.length` | 🆕 |
| 10 | `export` | `export` | Export | prepare, recount | — | — | existe (route dédiée) |

Liens : uniquement via `tripSectionHref(slug, sectionId)` (règle Y-D80 n°11).

---

## 3. Les douze widgets (registre `tripWidgetRegistry`)

| id | contenu | phases | condition profil | priorité | source |
|---|---|---|---|---|---|
| `countdown` | `J-N` / Aujourd'hui / Jour N | prepare, live | `hasDates` | 100 | `start_date` |
| `primary-action` | CTA de la section active | toutes | toutes | 95 | registre |
| `alerts` | alertes bloquantes | toutes | toutes | 90 | agrégat |
| `next-step` | prochaine étape, transport, distance | live | `steps>0` | 85 | `steps` |
| `safety-next` | prochain checkpoint + appel | prepare, live | `autonomy≠serviced` | 84 | `safety_checkpoints` |
| `kit-balance` | poids, emballés, %, barre | prepare | `items>0` | 80 | `useKitCounters` |
| `budget-burn` | dépensé/estimé, par tête si groupe | prepare, recount | `hasBudget` | 75 | `expenses` |
| `group-presence` | avatars, rôles, invitation | prepare, live | `party≠solo` | 70 | `collaborators` |
| `trip-context` | altitude max, durée, difficulté | prepare | `scale≠day` | 65 | `TripKitAnalysis` |
| `country-card` | drapeau, lien `/pays/[code]` | prepare | `country_code` | 60 | unification |
| `docs-expiry` | documents expirant avant départ | prepare | `documents>0` | 58 | `expires_at` |
| `offline-toggle` | « Garder hors-ligne » + état | toutes | toutes | 20 | ex-`TripOfflineBar` |

Contrainte : somme des hauteurs estimées ≤ 2 × fenêtre (1440×900) ; au-delà, widgets
de priorité < 60 repliés dans « Plus de détails ». Vérifié par test (Y1.4).

---

## 4. Matrice profil → sections

`O` = affiché, `·` = masqué activable (`TripSectionPicker`, choix persisté dans `Trip.metadata`).

| Section | day/solo | day/group | short/solo | short/group | long/solo | long/group | exped/solo | exped/group |
|---|---|---|---|---|---|---|---|---|
| overview | O | O | O | O | O | O | O | O |
| itinerary | O | O | O | O | O | O | O | O |
| gear | O | O | O | O | O | O | O | O |
| team | · | O | · | O | · | O | · | O |
| budget | · | · | · | O | O | O | O | O |
| docs | · | · | · | · | O | O | O | O |
| checklist | · | O | O | O | O | O | O | O |
| safety | O | O | O | O | O | O | O | O |
| journal | · | · | · | · | O | O | O | O |
| export | · | O | O | O | O | O | O | O |

`safety` toujours affichée (choix de sécurité assumé). Modulations par activité :
`roadtrip` ⇒ force `budget` ; `bivouac`/`bushcraft` ⇒ `trip-context` + `safety-next`
priorité 90 ; `cultural` ⇒ masque `trip-context` ; `mixed` ⇒ union de l'échelle.
Densité : `compact` si `scale=day`, `comfortable` sinon — espacements uniquement,
jamais tailles de police ni cibles tactiles.

---

## 5. Recettes de classes canoniques (annexe copiable)

**État vérifié après l'unification Liquid Glass de la branche X (commit `6581a6ec`)** —
⚠️ diverge de §0.7 du doc sur l'item inactif : les fonds `bg-white/80` opaques ont
été remplacés par le verre. Le code actuel fait foi.

Conteneur colonne gauche :
```
h-full max-h-full w-full flex-1 flex flex-col justify-between glass
rounded-[var(--lkv-radius-card)] p-3.5 text-[var(--lkv-text-primary)]
font-sans overflow-hidden border border-white/40 shadow-sm select-none
```

Item de navigation :
```
base     w-full px-3 py-2.5 rounded-[var(--lkv-radius-md)] font-bold text-xs
         transition-all flex items-center justify-between group cursor-pointer border
actif    bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm
inactif  glass-sub-card border border-white/60 text-[var(--lkv-text-primary)] hover:bg-white shadow-2xs
```

Sur-titre :
```
text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)]
```

Compteur :
```
actif    text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-white/20 text-white
inactif  text-[9px] px-1.5 py-0.5 rounded-full font-mono text-[var(--lkv-text-muted)]
```

Pied : `text-[8.5px] font-mono text-[var(--lkv-text-secondary)] tracking-wider uppercase`

Colonne droite : `w-full shrink-0 h-full overflow-y-auto no-scrollbar flex flex-col gap-3 pb-6 font-sans`
+ cartes `GlassCard` `p-3.5 space-y-2.5` (scrollbar tranché : arbitrage 6).

Boutons : tout CTA = `GlassCapsuleBtn` (`variant` primary/default, tailles default/sm/xs).
Inputs : `glass-input`. Pills : `GlassPill` / `glass-pill`.

---

## 6. Motion, z-index, accessibilité (valeurs revérifiées `tokens.css:156-192`)

| Token | Valeur |
|---|---|
| `--dur-xfast / fast / med / slow` | 120 / 180 / 280 / 420 ms |
| `--ease-glass` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--z-sticky / drawer / sheet / toast` | 20 / 40 / 50 / 70 |
| `--elevation-1` | `0 2px 8px rgba(23,64,44,0.04), 0 1px 2px rgba(23,64,44,0.03)` |

Règles : animer uniquement `transform`/`opacity` ; `prefers-reduced-motion` →
transitions ≤ 1 ms (déjà géré dans `liquid-glass.css`) ; `prefers-reduced-transparency`
→ verre remplacé par `--bg-primary` (déjà géré). Cibles tactiles ≥ `--lkv-touch-min`
(44 px). Un seul `<h1>` par surface. Un seul indicateur réseau (`TripNetworkStatus`).
