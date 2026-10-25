# Recette — fiche carnet sur Workers

- URL : https://kitduvoyageur.faracitonyp.workers.dev/carnets/9ba890ca-e071-5ab8-8624-6bd8a471a6c1
- Worktree : `lkdv-cf-carnet`, branche `cf/carnet`
- Version Worker : `80832455-c1b5-4c11-ac89-1f0c011f7aa7`
- Build + déploiement : `npm run deploy:vinext` (build inclus), 70 tests verts.

## Mesures live (430 × 932)

| Bloc | Fiche | /compte (référence) |
|---|---|---|
| Carte | 12 / 48 / 406 / 541 | 12 / 48 / 406 / 541 |
| Carte du monde | 0 / 597 / 430 / 335 | 0 / 597 / 430 / 335 |
| Barre basse | 14 / 868 / 402 / 48 | 14 / 868 / 402 / 48 |
| Boutons du haut | 3 | 3 |
| Scroll de page | aucun | aucun |

Compteurs : `J’aime 23` et `Commenter 3` = valeurs réelles de la base
(`carnet_likes` 23 lignes, `carnet_comments` 3 lignes).

Drawer : 7 onglets propriétaire + 4 sous-onglets ; la carte du monde reste
affichée dessous et passe en vue trace (contrôles couches / localisation / zoom).

## Corrections de cette passe

1. **Compteur de commentaires faux** (23 au lieu de 3) : la requête de comptage
   `carnet_likes` était dupliquée dans le `Promise.all` de `getCarnetDetail`,
   si bien que `commentsCount` recevait le total des j'aime. Doublon supprimé.
2. **Bundle serveur périmé au premier déploiement** : le Worker servait l'ancienne
   fiche (`ckp-shell`) alors que les assets client étaient neufs. Un rebuild forcé
   (changement de source) a produit `ckp-screen` ; cause = cache de build vinext.

## Réserves

- En session anonyme, la carte du monde affiche le panneau « Connecte-toi pour
  voir ta carte » du composant du Compte : comportement de la référence.
- Le comptage des commentaires n'a pas de test unitaire dédié (régression
  possible). À couvrir.
- Écran non revu à 1440 (timeout réseau pendant la capture) ; 768 vérifié sans
  scroll horizontal ni vertical.
