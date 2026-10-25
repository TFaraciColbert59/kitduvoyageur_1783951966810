# Contrat de refonte — Communauté

**Date :** 2026-10-25
**Périmètre :** `/communaute` uniquement. **Compte non modifié.**
**Règle absolue :** aucun titre, aucun sous-titre, aucun libellé visible dans le chrome des drawers. Les noms restent en `aria-label` pour l’accessibilité.

## 1. Intention

Ramener les drawers Communauté à la grammaire mesurée du Compte : feuille en place, verre unique, contenu scrollable, capsules icon-only, footer stable, zéro texte de structure.

## 2. Référence mesurée

- Référence : `/compte`, viewport `430×932`.
- Carte : `12 / 48 / 406×541`, rayon 24.
- Drawer : feuille `406×541`, capsule 48, barre basse sortie quand ouvert.
- Sélecteurs : capsules 30 px, lentille 25 px, cibles tactiles 44.
- Typo de contenu : 14 px de base ; aucun texte <12 px.
- Matière : une seule couche `backdrop-filter` ; reduced-motion respecté.

## 3. État actuel Communauté

| Zone | Aujourd’hui | Écart |
|---|---|---|
| Feed | cartes `406×406` | hauteur non alignée sur la référence 541 |
| Stories | viewer plein écran, capsule like/partage | cibles 46×31, labels absents |
| Post | header pillule 44, close 38 | cible close <44 |
| Commentaires | panneau plein cadre | textes 9–11 px |
| Partage | capsule 3 boutons 42×25 | cible <44 |
| Création | drawer `406×466`, 6 types icon-only | pas de grammaire unique |
| Feuilles | titres/sous-titres visibles | à supprimer |

## 4. Anatomie cible

```
Feed
  top bar (sans titre)
  rail Stories
  carte post (ratio réservé)
  barre basse
Drawers
  poignée
  contenu scrollable
  capsules icon-only
  footer stable
Sous-drawers
  commentaires | partage | options
  story viewer | options | vues
  création (6 types)
  signalement / erreurs
```

## 5. Règle de texte

- **Aucun titre, sous-titre ou libellé de structure visible.**
- Les contrôles sont icon-only, avec `aria-label`.
- Les seuls textes visibles sont :
  - le contenu utilisateur (nom, post, commentaire, valeur) ;
  - les placeholders de saisie ;
  - les messages d’erreur/vide indispensables.
- Pas de « Envoyer », « Copier », « Partager », « Options » visibles : icônes + aria.
- Pas de titre de feuille, pas de sous-titre, pas de label de section.

## 6. Lots

1. **Socle** : feuille, verre unique, focus/Échap, cibles 44, reduced-motion.
2. **Feed + Stories** : ratio, lazy, skeletons, rail.
3. **Post + Commentaires + Partage + Options** : panneaux plein cadre, icônes 44, textes 12+.
4. **Story viewer + Options + Vues** : capsule, focus, vues.
5. **Création** : coquille + 6 sous-drawers, footer, scroll, brouillon.
6. **Feuilles secondaires** : signalement, vues, erreurs.
7. **Recette** : 430/768/1440, tous états, prod.

## 7. Hors périmètre

- Compte, Profil, Map, Carnet, Messagerie.
- Nouvelles fonctionnalités métier.
- Titres/sous-titres/libellés visibles.

## 8. Preuves attendues

- `design:fidelity` sur les routes Communauté concernées.
- `scrollHeight = innerHeight` sur les écrans verrouillés.
- Drawer ouvert : `406×541`, barre basse sortie.
- Captures avant/après 430/768/1440.
- `tsc`, tests, build, déploiement Cloudflare, capture prod.

## 9. Go

Le montage ne démarre qu’après un **go explicite**. Aucun fichier UI Communauté n’est modifié avant ce go.
