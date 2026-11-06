# Audit des versions — pages Hub et Kit Studio

Date : 2026-11-06. But : savoir quelle version sert chaque page, et pourquoi des versions ont disparu.

## Ce qui est servi (cible)

| Page | Version | Source de vérité | Accès |
|---|---|---|---|
| `/hub` | **Hub camp 3D — refonte du 3 novembre** (`bdadb4baf` : tiroirs 56/38 dvh, 6 tiroirs, focus, haptique) | `src/features/hub/components/HubCampShell.tsx` | connecté |
| `/hub?studio=1` | Studio intégré au hub (même vue que ci-dessous, mais dans la coquille du hub) | `src/features/kit-studio/components/KitStudioView.tsx` | connecté |
| `/kit-studio` | **Kit Studio du bundle** (livraison `0d6021b4d` : sac 3D vert forêt, tiroir 30 %, trois cartes, feuilles Bilan/Fiche/Sac/Commande, deck) | `src/features/kit-studio/ui/KitStudioClient.tsx` | public (état local) |

Le hub camp est piloté par le flag `hub_camp_v1` : ligne `public.feature_flags`, sinon
`DEFAULT_FLAGS.hub_camp_v1 = true`. Une ligne `enabled=false` dans la table coupe le camp
sans redéploiement.

## Le problème, et pourquoi les versions ont sauté

1. **Deux studios concurrents dans le même dossier.** La branche hub fournit sa propre vue
   (`components/KitStudioView.tsx`, 11 k lignes, scène GLB) ; le chantier du bundle fournit la
   sienne (`ui/KitStudioClient.tsx`, scène procédurale). Les deux ont coexisté sans que la route
   dise laquelle sert quoi.
2. **La route `/kit-studio` a été permutée trois fois** (bundle → vue du hub → bundle → refonte →
   bundle). Chaque permutation était un déploiement : d'où l'impression de perdre la version
   précédente à chaque essai.
3. **Le flag `hub_camp_v1` a été basculé deux fois** (false → true → false → true). Quand il est
   passé à `false`, le hub est revenu au V4 : la refonte du hub avait « disparu » alors qu'elle
   était toujours là, derrière le flag.
4. **Cache du WKWebView.** L'app Capacitor charge une URL distante ; après un déploiement, le
   WebView peut resservir l'ancienne page. Un `uninstall`/`install` de l'app vide ce cache — et
   réinitialise la confiance iOS (d'où la demande « Faire confiance » à chaque réinstallation).

## Règles pour ne plus perdre de version

- Une page = une source de vérité nommée ici. On ne permute plus `/kit-studio` sans mettre ce
  tableau à jour.
- Le hub camp reste **par défaut** ; le flag ne sert qu'à le couper en cas d'incident.
- Après chaque déploiement : vérifier `/hub` (307 sans session), `/kit-studio` (200), puis
  forcer un rechargement de l'app (force-quit ; réinstallation si le cache persiste).
