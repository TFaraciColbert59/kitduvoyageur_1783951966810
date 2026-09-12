# Protocole — explorer mobile natif (géolocalisation + service worker)

**Date :** 2026-09-13
**Périmètre :** valider sur téléphones réels la géolocalisation native (E2/E3) et
l'absence de service worker dans l'app Capacitor (E4/E5), après les correctifs
`fix(explorer): geoloc native + repli globe sans GPS` et
`fix(native): pas de SW dans l'app Capacitor + config server.url documentee`.
**Statut :** protocole **manuel** — items humains (appareils physiques requis).

---

## 1. Prérequis de build — `CAPACITOR_SERVER_URL` obligatoire

`capacitor.config.ts` lit `CAPACITOR_SERVER_URL` à la synchronisation :

- **présente** → `server.url` est écrit dans la config native ; l'app charge le
  site déployé (comportement attendu).
- **absente** → aucune `server.url` ; l'app embarquée sert `public/index.html`
  (écran « Chargement… » avec message d'aide) — **ce n'est pas un build
  testable**.

Séquence exacte (PowerShell, racine du dépôt) :

```powershell
$env:CAPACITOR_SERVER_URL = "https://<domaine-de-test>"
npm run build
npx cap sync android   # et/ou : npx cap sync ios
```

Vérification après sync (la `server.url` doit être présente) :

```powershell
Select-String -Path android\app\src\main\assets\capacitor.config.json -Pattern "server"
```

> Sans `CAPACITOR_SERVER_URL`, **ne pas tester** : l'app n'affiche que le
> placeholder local (`public/index.html`).

## 2. Matrice de test

| # | Plateforme | Cas | Attendu |
|---|---|---|---|
| 1 | iOS | Permission « Lorsque l'app est active » accordée | Carte centrée sur la position (zoom ~14), marqueur bleu visible, requête `/api/hikes` bornée autour de la position |
| 2 | iOS | Permission refusée (Réglages → LKDV → Position : Jamais) | Aucun crash ; globe affiché ; tap « Explorer ma zone » → pill glass « Position indisponible — déplacez la carte ou activez la localisation » ; carte toujours déplaçable |
| 3 | Android | Permission précise accordée (Boîte de dialogue système) | Idem cas 1 |
| 4 | Android | Permission refusée (Paramètres → Applications → LKDV → Autorisations → Position : Refuser) | Idem cas 2 |
| 5 | iOS/Android | Permission refusée + `lkdv_last_location` déjà en localStorage | Tap « Explorer ma zone » → vol direct vers la dernière position connue (zoom 12), pas de message |
| 6 | iOS/Android | Service worker | `navigator.serviceWorker.getRegistrations()` ne renvoie **aucune** registration `/sw.js` (l'app native ne doit jamais enregistrer de SW) |

## 3. Déroulé par cas

> Tous les cas 1–5 s'exécutent sur `/explorer?atlas=1` : `?atlas=1` est requis
> pour forcer le moteur unifié (ATLAS) — le flag global est désactivé par défaut
> en code et `/explorer` seul peut servir le moteur legacy.

### Cas 1/3 — permission accordée

1. Installer la build (`adb install` de l'APK, ou TestFlight/Xcode pour iOS).
2. Ouvrir `/explorer?atlas=1`.
3. Accepter la demande système de localisation.
4. **Attendu :** la carte se centre sur la position, le marqueur utilisateur
   apparaît, la bbox requêtée correspond à la zone de l'utilisateur.
5. Taper « Explorer ma zone » après un dézoom globe : le vol revient sur la
   position (zoom 12).

### Cas 2/4 — permission refusée

1. Révoquer la permission avant ouverture (chemins au §2).
2. Ouvrir `/explorer?atlas=1` : aucune boucle de demande, carte sur le globe.
3. Taper « Explorer ma zone ».
4. **Attendu :** la vue **reste sur le globe** (pas de plongée vers Chamonix) ;
   le message glass non bloquant apparaît ; après ~6 s il disparaît seul ; la
   carte reste interactive (pan/zoom).

### Cas 5 — dernière position mémorisée

1. Avec permission accordée, faire au moins un fix réussi (ouvrir `/explorer?atlas=1`).
2. Révoquer la permission dans les réglages, relancer l'app.
3. Taper « Explorer ma zone ».
4. **Attendu :** vol vers la dernière position (marqueur + bbox locale), sans
   message d'indisponibilité.

### Cas 6 — service worker

1. Activer l'inspection distante (Safari Web Inspector / `chrome://inspect`).
2. Dans la console : `navigator.serviceWorker.getRegistrations().then(r => console.log(r.length))`.
3. **Attendu :** `0` dans l'app Capacitor ; sur le site web en production, le SW
   reste enregistré (comportement inchangé).

## 4. Preuves reproductibles (desktop, sans téléphone)

Le cul-de-sac et son correctif sont reproduits sans appareil par
`scripts/atlas/repro-e2-geoloc-fallback.mjs` (serveur dev requis, permission de
géolocalisation refusée) :

```powershell
npm run dev
node scripts/atlas/repro-e2-geoloc-fallback.mjs --phase=avant
node scripts/atlas/repro-e2-geoloc-fallback.mjs --phase=apres
```

Artefacts JSON/PNG : `docs/explorer-mobile/e2-avant.*`, `e2-apres.*`.

## 5. Journal de campagne (à remplir)

| Cas | Appareil / OS | Build (SHA) | Résultat | Notes |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
