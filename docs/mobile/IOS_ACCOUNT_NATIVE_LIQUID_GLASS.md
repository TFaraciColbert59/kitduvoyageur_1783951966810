# iOS — bottom bar native Liquid Glass, pilote Compte

## Périmètre livré (branche expérimentale)

- **iPhone iOS 26+**, construit avec SDK iOS 26+ : barre système UIKit (UITabBarController) et matériau Liquid Glass géré par Apple.
- **Compte et ses sous-pages** : /compte, /compte/*, /profil/*, /progression/* selon getActiveDestinationId().
- **Hors Compte** : barre React actuelle (barre native masquée).
- **Web, PWA, Android, iPad et iOS antérieur à 26** : repli sur la barre existante.
- **Le contenu Compte reste Next.js** : ce pilote ne réécrit pas la page en SwiftUI.
- **Une seule WebView Capacitor** : taps natifs relayés à Next.js ; aucun changement de session ou d'historique par reconstruction de WebView.

## Fichiers

- ios/App/App/SceneDelegate.swift : hôte UIKit et plugin Capacitor local.
- src/components/mobile-nav/NavigationBar.tsx : activation iOS, navigation, fallback.
- src/components/mobile-nav/nativeAccountRoutes.ts : sélection des routes.
- src/styles/native-account-tabbar.css : correction de la réserve de bas de page.
- src/components/mobile-nav/__tests__/native-account-routes.test.ts : tests d'éligibilité.

## Vérifications avant production

1. GitHub Actions ios.yml : Next build, cap sync ios, Xcode Swift build OK.
2. Tester l'app compilée sur un vrai iPhone iOS 26+ (ni Safari ni PWA).
3. Sur /compte : une seule barre avec le matériau Apple et les cinq onglets.
4. Ouvrir les sous-pages Compte et les routes Profil, Progression : barre conservée.
5. Depuis Compte, toucher Hub, Communauté, Explorer ou Messages : navigation réelle, barre React en dehors de Compte.
6. Revenir sur Compte : barre native, session, retour et deep links intacts.
7. Tester clavier, scroll en bas de page, indicateur home, modal, thèmes clair/sombre, VoiceOver, chargement réseau lent.
8. Tester iOS 25, iPad, Android et navigateur : pas de régression.
9. En cas d'échec, désactiver NATIVE_TABBAR_ENABLED et reconstruire le conteneur iOS.

## Limites

- Minimisation native au scroll WebView non activée tant qu'elle n'est pas validée.
- Sous-navigation secondaire React non portée en natif : seuls les cinq onglets principaux sont natifs.
- **Un déploiement Next.js seul ne peut pas installer du code Swift sur un iPhone.**
- La validation réelle Xcode et sur appareil reste obligatoire avant tout lancement en production.
