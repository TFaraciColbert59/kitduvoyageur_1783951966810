---
name: ks-ios-device-run
description: Use to put the app on Tony's iPhone 16 Pro via Xcode (Mac) or, without a Mac, via the CI IPA and a free-Apple-ID sideloader.
---
# Mettre l'app sur l'iPhone 16 Pro

Lire `ios/RUN-ON-IPHONE.md` (procédure complète). Résumé de décision :

1. **La route Kit Studio est web** : après déploiement Vercel, une app déjà installée la voit sans nouvelle build. Vérifier d'abord si l'app est déjà sur l'iPhone ; sinon installer.
2. Mac avec Xcode disponible : `scripts/ios-run.sh` (sync Capacitor, build, installation sur l'appareil par `xcrun devicectl`).
3. Pas de Mac : récupérer l'artefact `LKDV-iOS` de `.github/workflows/ios.yml`, installer avec Sideloadly ou AltStore (identifiant Apple gratuit, validité 7 jours).
4. L'agent ne peut pas brancher ni déverrouiller l'iPhone : lister dans le message final les trois gestes physiques (brancher et faire confiance, Mode Développeur, faire confiance au profil), jamais plus.
5. Signature gratuite : pas de notifications push ni de Live Activity ; ne pas committer d'équipe ni de profil personnels.
