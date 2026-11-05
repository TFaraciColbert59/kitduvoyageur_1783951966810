# Du code à l'iPhone 16 Pro de Tony (0 €)

## À savoir d'abord
- L'app iOS est une coque **Capacitor** qui charge le site déployé (`CAPACITOR_SERVER_URL`, par défaut `https://kitduvoyageur-1783951966810-ruddy.vercel.app`). Le Kit Studio est une **route web** : une fois déployée sur Vercel, **une app déjà installée la montre sans nouvelle build**. Xcode ne sert qu'à la première installation ou à une modification dans `ios/`.
- Un agent dans un conteneur ne peut ni brancher, ni déverrouiller, ni faire confiance à un iPhone. Il prépare tout ; il ne reste que **trois gestes physiques** (en bas).
- Écran de référence : iPhone 16 Pro, 402 × 874 pt, Dynamic Island, `safe-area-inset-top` ≈ 62 pt.

## Voie A — Mac avec Xcode (celle que demande Tony)
Prérequis : macOS récent, Xcode (gratuit), Node 22, un identifiant Apple gratuit connecté dans Xcode (Réglages ▸ Comptes).
1. `export IOS_TEAM_ID=<Personal Team>` (Xcode ▸ Réglages ▸ Comptes ▸ l'équipe « Personal Team », 10 caractères). Ne jamais committer cette valeur.
2. Brancher l'iPhone, le déverrouiller, toucher « Faire confiance ».
3. `scripts/ios-run.sh` : sync Capacitor, build Debug, installation et lancement par `xcrun devicectl`.
4. Si la signature échoue : le `DEVELOPMENT_TEAM` du projet (`QRU99VJUB5`) appartient au compte de Tony ; avec un autre identifiant, passer `IOS_TEAM_ID` et, au besoin, `IOS_BUNDLE_ID=com.lekitduvoyageur.app.dev` (identifiant unique sur le compte gratuit).
5. Limites de la signature gratuite : l'app expire après **7 jours** (relancer le script), 3 apps maximum par appareil, **pas** de notifications push ni de Live Activity (l'app fonctionne ; ces deux fonctions non). Elles sont hors périmètre du Kit Studio.

## Voie B — sans Mac (Windows de Tony)
1. GitHub ▸ Actions ▸ « iOS Capacitor Build » ▸ Run workflow (ou le push sur `main`) ; télécharger l'artefact `LKDV-iOS` (`LKDV-ios-unsigned.ipa`). Le runner macOS est gratuit sur un dépôt public.
2. Installer **Sideloadly** (Windows) ou **AltStore**, brancher l'iPhone, déposer l'IPA, se connecter avec l'identifiant Apple gratuit : l'outil signe et installe. Renouveler tous les 7 jours.
3. Identique ensuite.

## Contrôle sur l'appareil (à noter dans le rapport final, avec « non testé » si absent)
1. Ouvrir l'app ▸ aller sur `/kit-studio` (lien du hub ou saisie de l'URL dans la barre si disponible).
2. Le sac s'affiche en moins de 2 s, le tiroir s'ouvre seul, 3 cartes carrées visibles, la pilule est à 2 px au-dessus.
3. Glisser le rail, changer de famille, glisser une carte vers le sac : retour haptique, poids mis à jour.
4. Toucher la pilule : Bilan ; retour par la grille. Mode Apparence : changer de coloris ; bouton Commander dans le tiroir.
5. Fermer le tiroir par la poignée : la pilule remonte. Passer l'app en arrière-plan 30 s puis revenir : la scène se réaffiche (perte de contexte WebGL gérée).
6. Mode avion : la scène et le dernier kit s'ouvrent.
7. Texte agrandi (Réglages ▸ Accessibilité) et Réduire les animations : aucune superposition.

## Les trois gestes physiques (à demander à Tony en une seule fois)
1. Brancher l'iPhone et toucher « Faire confiance à cet ordinateur ».
2. Réglages ▸ Confidentialité et sécurité ▸ **Mode développeur** ▸ activer, redémarrer (voie A seulement).
3. Réglages ▸ Général ▸ VPN et gestion de l'appareil ▸ faire confiance au profil développeur de l'identifiant Apple.

## Dépannage rapide
| Symptôme | Cause probable | Action |
|---|---|---|
| Écran de connexion au serveur / page blanche | `CAPACITOR_SERVER_URL` absente ou HTTP | Exporter l'URL HTTPS, relancer le sync |
| « Untrusted Developer » | Profil non approuvé | Geste physique n° 3 |
| « Could not launch » | Mode développeur coupé | Geste n° 2 |
| Scène noire au retour d'arrière-plan | Contexte WebGL perdu non restauré | Bug du chantier : corriger `scene/lifecycle.ts`, ne pas contourner |
| L'app a expiré | 7 jours écoulés | Relancer `scripts/ios-run.sh` ou Sideloadly |
