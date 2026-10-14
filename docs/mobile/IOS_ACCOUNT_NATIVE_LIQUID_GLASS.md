# LKDV — Vrai Liquid Glass iOS (Communauté et Compte)

## Ce qui est implémenté

Le build iPhone sur **iOS 26+** peut utiliser une **UITabBar UIKit native** (matériau Liquid Glass fourni par iOS). L'interface Next.js et Supabase restent tels quels, avec **une seule WebView**. UIKit gère l'affichage des cinq destinations, et un petit plugin Capacitor gère le dialogue navigation iOS ↔ Next.js.

- Communauté : /communaute, /communaute-pro, /clubs, /carnets, /entraide, /createurs, /experts, /evenements, /feed **et leurs sous-pages**.
- Compte : /compte, /profil, /progression **et leurs sous-pages**.
- Cinq boutons Apple : Hub, Communauté, Explorer, Messages, Compte. Seul l'onglet de la route actuelle est sélectionné.
- La sous-navigation web de Communauté (Fil, Carnets, Clubs, etc.) reste utilisable juste au-dessus de la barre native.
- Cas particuliers UX conservés : /communaute/publier (éditeur plein écran sans barre), /connexion, /inscription et /checkout (sans navigation).
- Les routes hors Communauté/Compte, iOS avant 26, iPad, Android, PWA et Web conservent la barre React existante.
- Échec du pont/plugin : repli web automatique ; pas de barre native fantôme.

## Contrôles indispensables avant mise en production

1. CI GitHub : `npm run type-check`, tests unitaires, build Next, sync Capacitor, **Xcode iOS sans signature** : tous verts.
2. Sur iPhone iOS 26 ou plus récent : vérifier **exactement une barre**, vraie transparence Apple, changement d'onglet, haptique système si native et VoiceOver.
3. Sur Compte et Communauté : ouvrir les sous-pages, vérifier l'onglet sélectionné, sous-navigation Communauté, panneaux, écrans plein écran.
4. Toucher Compte depuis Communauté puis l'inverse, et toucher Explorer : jamais d'écran vide, aucune nouvelle WebView, historique Next.js préservé.
5. Tester rechargement complet, liaison lente, mode sombre, taille de police élevée, clavier, rotation, offline, retours, deep links, session authentifiée et non authentifiée.
6. Tester iOS 25, iPad, Android, navigateur : absence de changement visuel et fonctionnel.
7. Rétrocompatibilité : `NATIVE_TABBAR_ENABLED = false` ramène le rendu web après reconstruction de l'app native.

## Distribution

### Build technique non signé
GitHub Actions `.github/workflows/ios.yml` s'exécute automatiquement sur chaque PR. Il compile Xcode et publie un artifact `LKDV-iOS` contenant `LKDV-ios-unsigned.ipa`. **Cet IPA ne peut pas être directement installé sur un iPhone standard**.

### TestFlight signé
Le workflow `.github/workflows/ios-testflight.yml` prépare un envoi **manuel**, après fusion sur la branche par défaut et validation de la PR, vers TestFlight **sans publication sur l'App Store**. Prérequis Apple Developer Program, application existante dans App Store Connect pour `com.lekitduvoyageur.app`, et secrets GitHub de l'environnement `testflight` :

- `APPLE_TEAM_ID`
- `IOS_DISTRIBUTION_CERTIFICATE_BASE64` (certificat Apple Distribution au format P12)
- `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`
- `IOS_APP_STORE_PROVISIONING_PROFILE_BASE64` (profil App Store Connect, app ID exact)
- `APPSTORE_CONNECT_KEY_ID`
- `APPSTORE_CONNECT_ISSUER_ID`
- `APPSTORE_CONNECT_PRIVATE_KEY_BASE64` (contenu P8 encodé en Base64)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, et `CAPACITOR_SERVER_URL` HTTPS correct.

**Ne jamais commiter les clés, certificats ou tokens**. Le workflow exige également que l'URL HTTPS publiée expose le marqueur de compatibilité `/.well-known/lkdv-ios-native-glass.json` avec la version `community-account-v1` avant de signer : le nouveau conteneur ne peut pas pointer vers une ancienne version de Next.js. Après ce contrôle, il signe dans un trousseau éphémère, exporte l'IPA et l'envoie via fastlane pilot.

L'accès des testeurs requiert également l'état de traitement TestFlight et les validations demandées par Apple. L'application ne peut pas être distribuée sur simple déploiement Next.js/Vercel.

## Principaux fichiers

- `ios/App/App/SceneDelegate.swift` : hôte UIKit `LKDVNativeTabBarHost`, plugin Capacitor.
- `src/components/mobile-nav/NavigationBar.tsx` : sélection des onglets, fallback, rail secondaire.
- `src/components/mobile-nav/nativeAccountRoutes.ts` : choix de route.
- `src/components/mobile-nav/destinationRegistry.ts` : registre canonique.
- `src/styles/native-account-tabbar.css` : réservations de bas de page.
- `src/components/mobile-nav/__tests__/native-account-routes.test.ts` : tests routes.
- `tests/design/lot2-shell.spec.ts` : contrat d'absence de régression du shell.

## Extension globale — exception absolue Compas

La barre Liquid Glass iOS 26+ couvre **toutes les routes où MobileNavWrapper affiche déjà une barre** : Hub, préparation, voyages, matériel, boutique, outils, carte, Explorer, messagerie, communauté et compte. Les pages qui ne sont pas associées à un onglet principal conservent la barre sans sélection forcée. Les autres plateformes conservent la barre React.

**/compas et /compas/** restent toujours sur l'ancienne barre web. Aucun fichier sous src/app/compas, ni logique propre au Compas, n'a été modifié. Les écrans connexion/inscription/checkout/communaute/publier restent sans barre, et les événements plein écran conservent leur priorité.

La WebView est maintenue en plein écran sous la UITabBar native pour que la matière Liquid Glass puisse réellement traiter le contenu sous-jacent. Une réserve CSS basée sur la hauteur UIKit empêche les CTA d'être cachés. La sous-navigation React (plateau de section et rail de jours) reste au-dessus du tab bar natif.

Le marqueur frontend requis pour TestFlight est **all-except-compas-v1**. Il doit être en ligne avant signature de l'IPA. Vérifier notamment /compas ⇄ /hub, /compas/*, /preparer-randonnee, /boutique, /voyages et /messagerie, retour/avancer, rotation, clavier et VoiceOver.

**Ne pas fusionner ni distribuer tant que les derniers builds iOS et tests réels n'ont pas réussi.**
