# Rapport d'Exploration — Lot 4 : Coque Unifiée Profile6040Shell & Sous-Surfaces Compte

## 1. Observation

### A. Coque 60/40 & Parité `/compte` ↔ `/profil/[id]`
1. **Implémentation `/compte` (`src/app/compte/page.tsx` & `src/components/compte/CompteLiquidGlassV8.tsx`)** :
   - `/compte` monte `MobileCompteV2.tsx` (l. 22-27), qui monte `CompteLiquidGlassV8.tsx`.
   - `CompteLiquidGlassV8` injecte `COMPTE_V8_HTML` dans un conteneur vanilla (`CompteLiquidGlassV8.tsx:374`), composé de deux sections maîtresses :
     - `<section class="top" id="top"></section>` : 60% supérieur contenant avatar, Sceau d'empreinte, compteurs, bio, highlights et onglets de contenu (`.ig-tabs`).
     - `<section class="mapzone" id="mapzone">` : 40% inférieur intégrant la carte 3D MapLibre (`#maplibre-compte-canvas`, injectée via `createPortal(<CompteMap />, mapRoot)` l. 1673-1694).
   - Ce gabarit 60/40 Liquid Glass n'existait que sur `/compte` et pour l'utilisateur connecté (`tony_frc` ou session locale).

2. **Implémentation `/profil/[id]` (`src/app/profil/[id]/page.tsx` & `src/components/profile/PublicProfileV2.tsx`)** :
   - `/profil/[id]` monte `PublicProfileV2.tsx` (l. 211).
   - `PublicProfileV2.tsx` (l. 179-290) affiche un conteneur pleine hauteur vertical classique (`.lkdv-public-profile-frame`), un en-tête d'identité (`.lkdv-public-head`), puis un tiroir `<ProfileDrawerHost activeSlot="vitrine" />`.
   - **Absence totale de la carte 3D** : `/profil/[id]` ne disposait d'aucune carte d'empreinte en bas, rompant la promesse de parité visuelle et d'expérience avec `/compte`.
   - `src/app/profil/[id]/page.tsx` contient l'alias obsolète `author-thomas-alps` (l. 110) :
     ```ts
     if (!byHandle && (cleanParam === 'thomas_mountains' || cleanParam === 'author-thomas-alps')) {
     ```

3. **Mocks & Calculs Réels (`_MOCK_HIGHLIGHTS`, `TONY_AVATAR`, km / D+)** :
   - Dans `src/components/compte/compte-liquid-glass-v8-runtime.js` :
     - `TONY_AVATAR` est injecté en dur en base64 (l. 45) et utilisé comme avatar de repli à travers tout le profil (l. 3202, 3847, 4191, 4506).
     - `_MOCK_HIGHLIGHTS` est défini en dur (l. 411-470) avec de fausses stories : `Dolomites` (Tre Cime, Lago di Braies), `Bivouac Vercors` (Hauts Plateaux, Grand Veymont), `Lacs & refuges` (Lac Blanc, Couvercle), `GR20` (Bavella), `Sac 780 g`.
     - `HIGHLIGHTS` est initialisé avec ces mocks (l. 473) et rechargé lors de `sealzoom` ou du lecteur de story (l. 3093-3124).
     - Le même `_MOCK_HIGHLIGHTS` se trouve dupliqué dans `src/components/clubs/club-liquid-glass-v8-runtime.js` (l. 194).
   - Dans `src/lib/supabase/queries-compte.ts` :
     - `fetchFullProfile(userId)` (l. 225-245) compte les sorties depuis la table obsolète `activities` (`supabase.from('activities').select(...)`), qui ne contient pas les données réelles ou omet l'élévation.
     - L'élévation est renvoyée en dur sous forme de texte statique : `elevation_gain: { value: '—', detail: 'Données à venir' }` (l. 270).
     - La distance annuelle `totalKmThisYear` (l. 240-245) ne cumule que si `year === currentYear`, renvoyant `0 km` pour tout compte dont les traces sont antérieures ou datées hors année glissante.
   - Dans `src/components/profile/publicProfilePayload.ts` :
     - `outings: [] as unknown[]` (l. 135) est initialisé vide et jamais rempli.
     - `yearMonths: monthCounts` (l. 112) utilise `Array(12).fill(0)` qui reste à 0.
     - En conséquence, sur la capture iPhone réelle `06-compte.png`, le profil affiche : `20 sorties · 0 km · 0 k m D+` alors que 20 sorties réelles existent.

### B. Sous-surfaces Compte à Corriger
1. **Contraste `ConsentSettingsSheet` (`shots/10-compte-gerer.png`)** :
   - Capture `10-compte-gerer.png` : dans la carte de consentement « Tu gardes la main » et les lignes « Performance personnelle », le texte est blanc sur fond blanc dépoli translucide (`rgba(255,255,255,0.56)`), devenant presque 100% invisible.
   - Code dans `src/components/compte/drawer/compte/ConsentSettingsSheet.tsx` (l. 265-284) :
     - `.lkdv-consent-body` utilise `color: var(--label);`.
     - `.lkdv-consent-hero b` n'a aucune couleur explicite ; `.lkdv-consent-hero p` utilise `color: var(--label2);`.
     - `.lkdv-consent-line b` utilise `color: var(--label);`.
     - Lorsque la feuille est injectée dans `document.body` via `OverlaySheet.tsx`, `--label`, `--label2` et `--label3` ne sont pas définis au niveau de la feuille ou reçoivent les valeurs par défaut sombres/blanches des classes `.dark` / `--glass-text: #F1F5F1` de `tokens.css:696`.

2. **Tiroir Visibilité Vide (`shots/17-compte-visibilite.png`, événement `lkdv:open-outing-bulk`)** :
   - Capture `17-compte-visibilite.png` : une feuille de verre vide sans aucun titre ni contenu apparaît au-dessus de la carte 3D.
   - Code dans `src/components/compte/compte-liquid-glass-v8-runtime.js` (l. 5129-5148) :
     - `openOutingBulk` vérifie `if (S.profile && (S.profile.isDemo || S.profile.isGuest)) { island(...); return; }`.
     - L'événement `lkdv:open-outing-bulk` est émis via `window.dispatchEvent(new CustomEvent('lkdv:open-outing-bulk', { detail: { items } }))`.
     - Dans `CompteLiquidGlassV8.tsx` (l. 1517-1522) :
       ```ts
       const onOpenBulk = (event: Event) => {
         if (!user) return;
         ...
       };
       ```
     - Si `user` n'est pas encore présent ou lors d'une session non persistée, `onOpenBulk` retourne silencieusement sans ouvrir le `OutingBulkAudienceSheet`. Parallèlement, l'action déclenche l'ouverture d'un panneau `#sheet` dans le runtime vanilla sans contenu React injecté, produisant ce tiroir translucide vide.

3. **Hauteur Modifier le Profil (56dvh) & Double `[×]` (`shots/11-compte-edit.png`)** :
   - Capture `11-compte-edit.png` :
     - Deux boutons ronds `[×]` apparaissent simultanément sur l'image de couverture : un en haut à gauche et un en haut à droite à côté de l'icône appareil photo.
     - La feuille est tronquée à mi-hauteur d'écran (56dvh), au ras de la carte 3D, masquant la bio, la localisation, les liens et le bouton Enregistrer sous le pli.
   - Code dans `src/components/compte/drawer/compte/EditProfilePane.tsx` (l. 164-216) & `CompteDrawer.tsx` (l. 287-302) :
     - Top-left : `.lkdv-compte-edit-avatar-clear` (l. 214) avec icône `<X />` est positionné en `position: absolute; left: 8px; top: 8px;` sur la couverture.
     - Top-right : `.lkdv-compte-edit-hero-tools` (l. 171) affiche `<ActionPill label="Retirer la couverture" icon={<X />} />` en `position: absolute; right: 8px; top: 8px;`.
     - L'utilisateur perçoit deux boutons de fermeture `[×]` sur le même panneau alors que l'un est destiné à l'avatar et l'autre à la bannière.
     - Hauteur 56dvh : dans `src/components/compte/compte-apple-hig.css` (l. 2137-2145), `.sw-wrap[data-det="card"] .sheet` force `top: 48px !important; bottom: calc(31% + 46px) !important;`, bloquant la feuille au format "card" sans extension possible pour un formulaire d'édition complet.

4. **Bandeau `"18 sortie(s)..."` sous la TabBar & Callout de Carte Coupé (`shots/06-compte.png`)** :
   - Capture `06-compte.png` : la pilule/bandeau blanche `"18 sortie(s) enregistrée(s)... Les sorties sans trace..."` est affichée en bas à droite de la carte, directement chevauchée et masquée par la `TabBar` native.
   - Code dans `src/components/compte/map/compte-map.css` (l. 435-439) :
     ```css
     .phone.mapbig .lkdv-map-state,
     .lkdv-map-root[data-map-empty='true'] .lkdv-map-state {
       top: 50%;
       transform: none; /* BUG CRITIQUE : annule translate(-50%, -50%) */
     }
     ```
     - Initialement, `.lkdv-map-state` est centré par `left: 50%; top: 50%; transform: translate(-50%, -50%);`.
     - L'écrasement avec `transform: none;` place le coin supérieur gauche du bandeau au centre de la zone de carte 40%, décalant l'intégralité du composant dans le quart inférieur droit, en collision frontale sous la TabBar.
   - Callout carte coupé : dans `src/components/compte/map/compte-map.css` (l. 313-330), `.lkdv-map-callout-anchor` utilise `transform: translate(-50%, calc(-100% - 14px))`. Lorsqu'un repère est cliqué près du bord haut de la carte ou sur les flancs latéraux, le callout déborde de la vue carte et est tronqué sans repositionnement dynamique.

5. **Onglet Sorties — Rectangle Vert Vide (`shots/15-compte-mountain.png`)** :
   - Capture `15-compte-mountain.png` : lors du clic sur l'icône Montagne dans le sélecteur Grille/Montagne, un grand rectangle vert sombre s'affiche avec la puce "Sortie enregistrée" et "2000 m", mais sans courbe altimétrique ni données textuelles visibles.
   - Code dans `src/components/compte/compte-liquid-glass-v8-runtime.js` (l. 3435-3455) & `compte-apple-hig.css` (l. 3145-3170) :
     - Pour les sorties sans image (`photo === ''`), le runtime génère `.voyage-cover-fallback` avec un dégradé vert opaque.
     - `.voyage-info` est positionné en absolu `bottom: 8px` avec des variables `--bar-glass-*` qui s'effacent ou sont masquées par le sélecteur `.ig-tabs` et l'absence de tracé SVG de profil altimétrique (sparkline).

---

## 2. Logic Chain

```
[Observation 1A: /compte a une coque 60/40 avec carte 3D, mais /profil/[id] a un simple scroll vertical sans carte]
   ──> Unification requise : Créer Profile6040Shell.tsx utilisable à la fois par /compte (mode owner) et /profil/[id] (mode visitor).
   ──> En mode visitor, la coque injecte CompteMap en mode public avec RLS signature_visibility (carte floutée ou masquée si confidentielle).

[Observation 1B: _MOCK_HIGHLIGHTS (Dolomites, GR20...) et TONY_AVATAR codés en dur dans le runtime]
   ──> Eradication : Remplacer _MOCK_HIGHLIGHTS par HIGHLIGHTS = [] et alimenter exclusivement à partir des carnets réels de l'utilisateur.
   ──> Remplacer TONY_AVATAR par un composant d'initiales ou SVG neutre clair (#DDEBD8 / #17402C).

[Observation 1C: Données km / D+ à 0 malgré 20 sorties réelles]
   ──> queries-compte.ts interroge la table activities (non alimentée) au lieu de hike_sessions.
   ──> Corriger queries-compte.ts pour agréger distance_km et elevation_gain_m depuis hike_sessions.
   ──> Remplir outings, massifs, countries et yearMonths dans publicProfilePayload.ts.

[Observation 2A: ConsentSettingsSheet texte blanc sur fond clair dans 10-compte-gerer.png]
   ──> OverlaySheet est injecté dans document.body où --label hérite de valeurs blanches de tokens.css ou est indéfini.
   ──> Appliquer explicitement les jetons banque Liquid Glass (--label: #172B24; --label2: #56665D; --label3: #6A786F) sur .lkdv-consent-sheet.

[Observation 2B: 11-compte-edit.png a un double [×] et une hauteur de 56dvh]
   ──> Retirer .lkdv-compte-edit-avatar-clear du coin supérieur gauche de la couverture et intégrer l'action de suppression sur l'avatar.
   ──> Autoriser l'extension de la feuille à 92dvh (mode large) pour Modifier le profil.

[Observation 2C: 06-compte.png a le bandeau "18 sorties..." décalé sous la TabBar]
   ──> transform: none dans compte-map.css supprime le centrage translate(-50%, -50%).
   ──> Rétablir translate(-50%, -50%) et ajouter bottom: calc(var(--bottom-nav-height, 64px) + env(safe-area-inset-bottom, 0px) + 16px).

[Observation 2D: 17-compte-visibilite.png tiroir vide]
   ──> openOutingBulk dans le runtime ouvre un tiroir vide quand le composant React OutingBulkAudienceSheet n'est pas encore monté ou bloqué par le check guest/demo.
   ──> Aligner le déclenchement pour que seul OutingBulkAudienceSheet s'affiche avec la liste des sorties et leurs interrupteurs d'audience.
```

---

## 3. Caveats

1. **Rétrocompatibilité des tests Vitest (`tests/design/compte-liquid-glass-v8.spec.ts`)** :
   - Le test `tests/design/compte-liquid-glass-v8.spec.ts` effectue des assertions textuelles directes sur le contenu concaténé de `CompteLiquidGlassV8.tsx`, `compte-v8.css`, `compte-apple-hig.css` et `compte-liquid-glass-v8-runtime.js`.
   - Les chaînes de contrat suivantes **doivent être impérativement conservées** dans les fichiers :
     - `__lkdvHydrateCompte`, `__lkdvOnMutate`, `__lkdvOnAction`, `__lkdvScanLookup`, `__lkdvCompteAct`
     - `href="/compte/modifier"` (lien sentinelle E2E)
     - `#17402C`, `#5B7F55` (zéro `#E4501C`)
     - `Story à la une`, `visiteur`, `Hiver`, `kitsim`, `Face ID`, `NameDrop`
2. **Confidentialité RLS `signature_visibility`** :
   - Sur `/profil/[id]`, un visiteur tiers ne doit JAMAIS recevoir les coordonnées GPS brutes d'une sortie privée ou marquée `prive`. Seules les sorties publiques (`visibility === 'public'` ou `'collective_anonymized'`) doivent être projetées sur la carte 3D.
3. **Comptes Démo `/connexion` (`demo@lkdv.app`)** :
   - Ne jamais supprimer le compte démo complet officiel utilisé par `/api/demo-login` ; l'éradication des mocks concerne le code client en dur (Dolomites, GR20...), pas les données SQL du compte démo légitime.

---

## 4. Conclusion & Plan d'Implémentation Recommandé pour le Worker

### Architecture de la Coque Unifiée `Profile6040Shell.tsx`
Créer le composant `src/components/profile/Profile6040Shell.tsx` :
- **Entrées (Props)** :
  ```ts
  export interface Profile6040ShellProps {
    mode: 'owner' | 'visitor';
    profile: CompteUserProfile;
    carnets: CompteCarnet[];
    clubs: CompteClubItem[];
    badges: CompteBadgeItem[];
    activite: CompteActiviteItem[];
    outings?: PublicOutingItem[];
    targetUserId?: string;
    onShare?: () => void;
    onReport?: () => void;
    // Spécifique owner (/compte)
    onEditProfile?: () => void;
    onOpenSettings?: () => void;
    onOpenCreate?: () => void;
  }
  ```
- **Rendu Visuel 60/40** :
  - **Zone Supérieure 60% (`.lkdv-6040-top`)** :
    - En-tête : Avatar avec anneau Sceau d'empreinte, fallback initiales vert clair `#DDEBD8` / `#17402C` (aucun `TONY_AVATAR`), nom, `@handle`, badge Confiance (Trust Score), localisation/titre.
    - Compteurs : Publications, Abonnés, Abonnements avec liens interactifs.
    - Bio : Texte réel et statistiques calculées réelles (`X sorties · Y km · Z m D+`).
    - Actions :
      - En mode `owner` : Boutons "Modifier le profil", "Partager le profil", icône Réglages, icône Créer (+).
      - En mode `visitor` : Bouton "Suivre / Abonné" (`followClient.ts`), "Message" (`/messagerie?to=@handle`), "Partager", icône Signaler (`ReportBlockModal`), bouton Retour (`ArrowLeft`).
    - Highlights (Stories) : 100% réels basés sur les carnets de l'utilisateur avec photo. Si aucun carnet : masqué pour le visiteur, invitation discrète pour le propriétaire.
    - Onglets Grille / Sorties : Grille 3 colonnes pour carnets/photos, liste des sorties pour les randonnées.
  - **Zone Inférieure 40% (`.lkdv-6040-mapzone`)** :
    - Montage de `CompteMap` via portail ou sous-arborescence React.
    - Sélecteur d'échelle (Orbite / Massif / Sentier) et badge Relief 3D.
    - Respect strict de `signature_visibility` : si privé, affichage d'un état discret sans révéler de coordonnées.

### Modifications Ciblées par Fichier

#### 1. `src/lib/supabase/queries-compte.ts`
- Remplacer la requête sur `activities` par `hike_sessions` :
  ```ts
  const { data: hikeSessions } = await supabase
    .from('hike_sessions')
    .select('id, distance_km, elevation_gain_m, started_at, max_altitude_m, title, visibility')
    .eq('user_id', userId);
  ```
- Calculer :
  - `sorties = hikeSessions?.length ?? 0`
  - `totalKm = (hikeSessions ?? []).reduce((acc, h) => acc + Number(h.distance_km || 0), 0)`
  - `totalDplus = (hikeSessions ?? []).reduce((acc, h) => acc + Number(h.elevation_gain_m || 0), 0)`
- Assigner `stats.distance_2026.value = `${Math.round(totalKm)} km`` et `stats.elevation_gain.value = `${Math.round(totalDplus)} m D+`` (sans espace dans "km" ou "m").

#### 2. `src/components/profile/publicProfilePayload.ts`
- Remplir `outings` à partir des sessions réelles au format attendu par la vitrine.
- Peupler `yearMonths` (comptage par mois des dates `started_at`).
- Peupler `massifs` et `countries` par détection des toponymes connus.

#### 3. `src/components/compte/compte-liquid-glass-v8-runtime.js`
- Supprimer `_MOCK_HIGHLIGHTS` et `TONY_AVATAR`.
- Initialiser `HIGHLIGHTS = []` et peupler dynamiquement lors de `applyAccountBootstrap` depuis les carnets réels.
- Remplacer le fallback `TONY_AVATAR` par un conteneur initiales `(P.name || 'V').charAt(0).toUpperCase()` avec style `#DDEBD8` / `#17402C`.
- Dans `openOutingBulk`, supprimer toute référence d'ouverture `#sheet` orpheline et s'assurer que l'événement `lkdv:open-outing-bulk` transmet les sorties réelles.

#### 4. `src/components/compte/drawer/compte/ConsentSettingsSheet.tsx`
- Injecter les styles de contraste explicites dans `CONSENT_SHEET_CSS` :
  ```css
  .lkdv-consent-sheet {
    --label: #172B24 !important;
    --label2: #56665D !important;
    --label3: #6A786F !important;
    color: #172B24 !important;
  }
  .lkdv-consent-hero b, .lkdv-consent-line b { color: #172B24 !important; }
  .lkdv-consent-hero p { color: #56665D !important; }
  .lkdv-consent-copy small { color: #56665D !important; }
  .lkdv-consent-copy p { color: #6A786F !important; }
  .lkdv-consent-section-head h3 { color: #17402C !important; }
  ```

#### 5. `src/components/compte/drawer/compte/EditProfilePane.tsx` & `CompteDrawer.tsx`
- Supprimer `.lkdv-compte-edit-avatar-clear` du coin supérieur gauche de la couverture.
- Intégrer l'action de suppression sur la vignette avatar (`.lkdv-compte-edit-avatar-wrapper`).
- Dans `compte-apple-hig.css`, permettre à la feuille de profil (`data-det="large"`) de monter jusqu'à `top: calc(env(safe-area-inset-top, 12px) + 8px); bottom: calc(env(safe-area-inset-bottom, 0px) + 8px)` pour débloquer la contrainte de 56dvh.

#### 6. `src/components/compte/map/compte-map.css` & `CompteMapState.tsx`
- Supprimer la règle néfaste `transform: none` sur `.phone.mapbig .lkdv-map-state` et `.lkdv-map-root[data-map-empty='true'] .lkdv-map-state`.
- Maintenir `transform: translate(-50%, -50%) !important;` pour garantir le parfait centrage du bandeau.
- Ajouter un dégagement inférieur : `bottom: calc(var(--bottom-nav-height, 64px) + env(safe-area-inset-bottom, 0px) + 16px) !important;`.
- Ajuster `.lkdv-map-callout-anchor` avec décalage sécurisé pour ne pas tronquer les fiches en haut ou sur les bords d'iPhone.

#### 7. `src/app/profil/[id]/page.tsx`
- Supprimer le test obsolète `cleanParam === 'author-thomas-alps'`.
- Remplacer `PublicProfileV2` par `Profile6040Shell` avec `mode="visitor"`.

---

## 5. Verification Method

Pour valider de manière indépendante l'exécution de ces corrections :

1. **Tests Unitaires & Contrats de Design** :
   ```bash
   npx vitest run tests/design/compte-liquid-glass-v8.spec.ts
   npx vitest run tests/design/compte-profile-visibility.spec.ts
   npx vitest run tests/design/compte-real-data-v21.spec.ts
   npx vitest run src/components/profile/__tests__/publicProfilePayload.test.ts
   ```
   *Condition d'invalidation* : Tout test rouge ou assertion manquante sur les jetons ou contrats d'hydratation.

2. **Compilation TypeScript & Build Next.js** :
   ```bash
   npx tsc --noEmit
   npm run build
   ```
   *Condition d'invalidation* : Toute erreur de typage ou warning bloquant sur les routes `/compte` et `/profil/[id]`.

3. **Audit Visuel Vérité Terrain iPhone (Device / Web)** :
   - Exécuter la suite d'audit Playwright :
     ```bash
     node /Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/web-audit.mjs
     ```
   - Inspecter visuellement avec `read_file` les captures générées :
     - `webshots/compte.png` : vérifier l'absence de `Dolomites` / `GR20`, le calcul réel `km · D+`, et l'absence de chevauchement du bandeau sous la TabBar.
     - `webshots/profil-lea.png` : vérifier la présence de la coque 60/40 avec la carte 3D en bas et le respect de la visibilité.
