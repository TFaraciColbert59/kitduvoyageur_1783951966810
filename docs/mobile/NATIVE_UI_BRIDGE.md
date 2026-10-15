# LKDV — Native UI bridge (SwiftUI + Next.js)

## Architecture en production web / build iOS

- `ios/App/App/SceneDelegate.swift`: `LKDVNativeTabBarHost` conserve **une unique** `CAPBridgeViewController` pour toute la durée de navigation. La tab bar UIKit existante reste en place.
- `LKDVNativeUIPlugin`: plugin Capacitor à contrat stable, qui présente les vues SwiftUI **au-dessus** de la WebView persistante.
- `src/lib/native/ui.ts`: seul client du plugin côté Next.js. Il valide les entrées, détecte le runtime et retourne un état explicite pour le fallback.
- `NativeAppBootstrap`: transmet les routes Next.js avec `revision` monotone; le plugin ne gère **jamais** la navigation Web.
- Le contenu des écrans, les politiques Supabase RLS, l'authentification, la publication et les actions métiers restent dans Next.js.

## API et sémantique (P0/P1)

| API JS | Comportement iOS | Fallback |
| --- | --- | --- |
| `syncNativeUIRoute(path, revision)` | Enregistre la route; clôt les feuilles devenues obsolètes | No-op |
| `presentNativeActions({title,message?,actions})` | Feuille d'actions SwiftUI avec detents, fermeture et rôles destructifs | Menu React existant |
| `lkvConfirm(options)` | Confirmation via feuille SwiftUI | `ConfirmHost` Radix |
| `lkvPromptAsync(options)` | Formulaire de saisie SwiftUI | `PromptHost` Radix |
| `shareNativeURL(httpsURL)` | Feuille système de partage UIKit | Comportement React existant |
| `hasNativeDatePicker()` | Capabilities réelles, évite le faux positif des anciens shells | `false` |
| `presentNativeDate(title, YYYY-MM-DD)` | `DatePicker` graphique SwiftUI | Champ natif HTML `type=date` |
| `NativeDateField` | **Un seul contrôle** visible sur iOS capable | Champ HTML sur Android/Web/anciens iOS |
| `hasNativeChoices()` / `presentNativeChoices()` | Feuille SwiftUI avec recherche de kits/carnets et coche de sélection | Liste HTML <select> |
| `NativeSelect` | Un seul sélecteur affiché; conserve l'état Next.js et les ID sélectionnés | Contrôle HTML accessible |
| `hasNativePhotos()` / `pickNativePhotos()` | `PhotosPicker` iOS 16+ avec limite 6 images / 8 Mo chacune / 20 Mo par sélection, transfère en `File[]` | Champ fichier web |
| Création publication Communauté | Photos natives ajoutées au même staging et au même upload authentifié que le formulaire web | Champs images/vidéos web d'origine |

Une feuille d'actions, un prompt ou une date retourne trois états : `undefined` = plugin absent/erreur (déclencher l'UI web), `null` = annulation native (ne rien faire), valeur non nulle = choix confirmé. **Ne jamais interpréter une annulation comme une indisponibilité.**

`/compas` (y compris sous-routes) est exclu explicitement côté JS **et** côté natif. Ne pas ajouter de fichiers sous `src/features/compas` ni de modifications d'interface /compas.

Le code à servir dans WKWebView reste Next.js distant; une modification de `SceneDelegate.swift` **exige une nouvelle build iOS**. Une mise en production Vercel seule ne modifie pas un ancien shell installé sur iPhone; le fallback est essentiel.

## Processus de validation sans service payant

1. Test local : `npx vitest run tests/native` et `npm run type-check`.
2. GitHub Actions `LKDV Unified Quality Gates` : qualité, unités, migrations PostgreSQL éphémères, E2E /compas.
3. GitHub Actions `iOS Capacitor Build` : Capacitor sync + `xcodebuild` unsigned; la compilation confirme la compatibilité SDK, pas les gestes physiques.
4. Vérifier les captures GitHub Actions `Visual Regression` (responsive mobile et web).
5. iPhone réel : installer depuis Xcode, ouvrir les routes Compte, Communauté, matériel, voyages, puis /compas; vérifier qu'aucune page ne recharge la WebView.
6. Tap et appui long sur post : feuille SwiftUI unique; enregistrer/masquer/signaler/partager ; ouverture et fermeture sans perte de scroll ou état.
7. Confirmer/supprimer sur une route réelle : SwiftUI, annuler, puis vérifier la conservation des données. Mode web/Android = Radix.
8. Création événement Communauté : `NativeDateField` unique sur iPhone mis à jour, calendrier SwiftUI ; sur ancienne app / Safari / Android, contrôle web.
9. Tester VoiceOver, clavier, paysage, retour et safes areas; suivre les erreurs réseau hors-ligne.
11. Avec une nouvelle build iOS, sélectionner un kit et un carnet via la recherche native, annuler sans changer le brouillon; ancienne build, Safari et Android doivent garder le select HTML.
12. Sélectionner plusieurs images via PhotosPicker, vérifier que les fichiers restent privés jusqu'à confirmation, que les métadonnées image sont retirées avant upload, qu'une audience club/abonnés interdit les médias publics et que la vidéo conserve son fallback web.
10. Aucun envoi TestFlight ni fusion sur `main` avant réussite des checks nécessaires.

## Limites : futurs lots, pas de fausse promesse

- Toolbar par route : passer à SwiftUI progressivement après mesure safe areas iPhone; ne pas masquer les contrôles web avant disponibilité confirmée.
- `PhotosPicker` photo : **intégré au formulaire Communauté** pour les images sous 8 Mo, sans upload avant confirmation. La vidéo et les images volumineuses utilisent le sélecteur web. La migration de tous les écrans utilisant des médias, la capture vidéo native et la gestion plus efficace des transferts binaires volumineux restent à faire.
- Immersion stories/Reels : le visualiseur web reste la source de vérité; transitions `matchedGeometryEffect` uniquement entre **deux** vues SwiftUI. `navigationTransition(.zoom)` ne sait pas animer directement un élément HTML.
- MapLibre principale reste web. MapKit/LookAround uniquement dans des fiches ciblées et après mesure disponibilité géographique.
- Widgets/Live Activities/Shortcuts : extensions natives supplémentaires, provisioning et tests sur appareil. **Pas activés** dans cette PR.
- Aucun coût ajouté (pas de nouvelle branche Supabase, pas de produit Apple supplémentaire commandé).
