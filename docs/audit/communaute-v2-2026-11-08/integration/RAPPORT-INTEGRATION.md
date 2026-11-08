# Rapport d'intégration visuelle — Communauté v2

Passe d'intégration sur les **vrais composants** (`NEXT_PUBLIC_COMMUNAUTE_V2=true`),
harnais Playwright `docs/audit/communaute-v2-2026-11-08/integration/capture.mjs`.
Tout le réseau est simulé (PostgREST/GoTrue/Storage interceptés, session synthétique,
fixtures conformes à `handoff/communaute-v2/RPC-CONTRACTS.md`) : aucune donnée réelle,
aucune écriture.

- Base de capture : `http://127.0.0.1:4028` (`next start`, build recette).
- Captures : `docs/audit/communaute-v2-2026-11-08/integration/captures/` (390×844).
- Maquette de référence : `http://127.0.0.1:8765/maquette-communaute.html` et
  `../audit-communaute-v2/maquette/*.png`.

## Statut

| Étape | État |
|---|---|
| Harnais + fixtures + session synthétique | prêt (`integration/README.md`) |
| Build de recette | **bloqué hors périmètre** : erreur de type dans `tests/e2e/communaute-v2.fixtures.ts:584` (à corriger par Tests/Recette — signalé au Lead) |
| Correctif CSS préalable (Lead) | fait : `detail*/back` fermait le commentaire CSS (cssnano `Unexpected '/'`, CI iOS/Vercel) |
| Captures Explorer + coque | en attente du build/serveur |
| Captures Création | en attente (formulaires encore en finition côté Création) |

## Écarts par gravité

> À compléter après la première capture des deux tiroirs. Format :
> **gravité** — fichier:ligne — constat — action (corrigé par Fondations / routé).

### Bloquants

_(à remplir)_

### Majeurs

_(à remplir)_

### Mineurs

_(à remplir)_

## Corrections appliquées (périmètre fondations)

- `src/styles/communaute-v2.css` : en-tête sans séquence `*/` (correctif Lead), en-tête
  documentaire des classes à jour, ajout `.lkdv-cv2-crop--wide`, `.lkdv-cv2-form-footer`,
  `.lkdv-cv2-send-fail`, `.lkdv-cv2-search`, `.lkdv-cv2-group`, `.lkdv-cv2-rail`,
  `.lkdv-cv2-grid`, `.lkdv-cv2-sr`, verre direct sur `.lkdv-cv2-field` (input/textarea/select).
- `src/styles/tokens.css` : `--type-*` (contrastes AA recalculés) et `--cv2-*` (dont
  `--cv2-field-blur`, `--cv2-z-island: 70`).
- Primitives : `data-testid="cv2-sort-button"`, `cv2-sort-menu`, `cv2-island` ;
  `ClubCrest.size` accepte 52/64 (tuiles larges) en plus des canoniques 28/44/72 ;
  `EventTicket.onOpen` pour ouvrir le détail empilé en gardant le `href` de repli.
- Peek & Pop : boîte opaque (`--glass-bg-strong`) pour la lisibilité sur le scrim flouté.

## Écarts hors périmètre (routés)

- **build** `tests/e2e/communaute-v2.fixtures.ts:584` : `row.author_id` absent du type
  inféré de `rows` (mock `community_carnets_feed`) → build `next build` en échec.
- **Divers** : rien d'autre relevé avant capture.
