# Du code à l'iPhone 16 Pro (Kit Studio)

## À savoir d'abord
- L'app iOS est une coque **Capacitor** qui charge le site déployé (`CAPACITOR_SERVER_URL`). Le Kit Studio est une **route web** : une fois `/kit-studio` en production, une app déjà installée la montre **sans nouvelle build**. Xcode ne sert qu'à la première installation.
- Un agent ne peut ni brancher, ni déverrouiller, ni approuver la confiance d'un iPhone : tout est préparé ici, il reste les gestes physiques de Tony.
- Écran de référence : iPhone 16 Pro, 402 × 874 pt. Captures de recette : `docs/kit-studio/captures/kit-studio-402x874.png`.

## URL chargée par la coque
`koosmoweb.fr` est le domaine du projet, mais **il n'a aucun enregistrement DNS** au 05/11/2026 (whois : NS AFNIC par défaut ; vérification externe : `NO_RECORDS`). Tant que la zone n'existe pas, la coque doit pointer sur un domaine qui répond : le déploiement de production vérifié `https://kitduvoyageur-1783951966810-ekdumwy6i.vercel.app`.
Pour basculer sur le domaine : chez le registrar, `A @ → 76.76.21.21` et `CNAME www → cname.vercel-dns.com` (valeurs exactes affichées par Vercel ▸ Settings ▸ Domains), puis `CAPACITOR_SERVER_URL=https://koosmoweb.fr bash scripts/ios-install.sh`.

## Voie A — Mac avec Xcode (recommandée)
1. `export IOS_TEAM_ID=<Personal Team>` (Xcode ▸ Réglages ▸ Comptes, 10 caractères). Ne jamais committer cette valeur.
2. Brancher l'iPhone, le déverrouiller, toucher « Faire confiance ».
3. `npm run mobile:build` puis `npx cap run ios` (ou `scripts/ios-run.sh` s'il existe sur la machine).
4. Si la signature échoue : passer `IOS_TEAM_ID` et, au besoin, `IOS_BUNDLE_ID=com.lekitduvoyageur.app.dev`.

## Voie B — sans Mac
1. GitHub ▸ Actions ▸ « iOS Capacitor Build » ▸ Run workflow (ou push sur `main`) ; télécharger l'artefact `LKDV-iOS` (`LKDV-ios-unsigned.ipa`).
2. Installer avec Sideloadly (Windows) ou AltStore, se connecter avec l'identifiant Apple gratuit : l'outil signe et installe.
3. Renouveler tous les 7 jours (limite de la signature gratuite).

## Contrôle sur l'appareil (à noter avec « non testé » si absent)
1. Ouvrir l'app ▸ aller sur `/kit-studio` (lien « Ouvrir le Kit Studio » depuis le départ, ou l'URL directe).
2. Le sac s'affiche, le tiroir s'ouvre seul, trois cartes visibles, la pilule affiche le poids du kit.
3. Glisser le rail, changer de famille, glisser une carte vers le sac : le poids se met à jour.
4. Toucher la pilule : Bilan (4 pages) ; retour par la grille. Mode Apparence : changer de coloris ; bouton Commander dans le tiroir.
5. Fermer le tiroir par la poignée : la pilule remonte. Arrière-plan 30 s puis retour : la scène se réaffiche.
6. Mode avion : la scène et le dernier kit s'ouvrent.
7. Texte agrandi et Réduire les animations : aucune superposition.

## Ce qui a été vérifié en local
- 6 parcours Playwright **WebKit** à 402 × 874 (moteur Safari, pas le WKWebView de Capacitor).
- Captures aux quatre tailles (`docs/kit-studio/captures/`).
- Non vérifié : l'appareil physique, VoiceOver, contraste AA mesuré.
