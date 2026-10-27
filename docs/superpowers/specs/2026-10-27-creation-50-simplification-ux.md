# Création — 50 simplifications UI/UX

**Date :** 2026-10-27
**Périmètre :** drawer Création + sous-drawers Publication, Story, Carnet, Sortie, Kit, Club.
**Objectif :** moins de champs, moins d’étapes, moins de décisions, mêmes capacités.
**Règles :** `ui-ux-pro-max` (labels visibles, feedback de soumission, claviers mobiles, divulgation progressive), `apple-ui-designer` (clarté, défauts, suppression avant ajout), `ux-mobile` (charge cognitive, état préservé, cibles tactiles).

## Principe directeur

> **Le chemin court est le chemin par défaut.**
> Toute information qui peut être déduite, reportée ou masquée ne doit pas être demandée au premier passage.

---

## A. Coquille Création (1–10)

1. **Mode Rapide / Complet** — Rapide = 3 champs essentiels ; Complet = options avancées. *Un seul choix au départ.*
2. **Supprimer l’étape « Format »** — le sélecteur de type est déjà en haut ; le format se déduit du média ou du texte.
3. **3 étapes maximum** — fusionner les étapes de contenu, puis une étape de vérification.
4. **« Plus d’options »** — replier audience avancée, planification, sondage, événement, confidentialité.
5. **Défauts intelligents** — audience publique, commentaires et likes actifs, dates préremplies, visibilité publique.
6. **Une colonne** — les paires de champs ne restent que si les deux valeurs se lisent ensemble (dates, météo).
7. **Avance automatique** — un choix unique (type, audience, difficulté) passe à l’étape suivante sans « Continuer ».
8. **Validation au blur** — l’erreur apparaît au champ ; le résumé global seulement à la soumission.
9. **Brouillon silencieux** — auto-save + restauration du scroll, sans modale de confirmation si le brouillon est vide.
10. **Un seul CTA** — l’action finale reste fixe ; le sélecteur d’étapes ne sert qu’à naviguer.

## B. Publication (11–20)

11. **Média dès le premier écran** — supprimer l’étape Médias séparée.
12. **Format auto-détecté** — photo si média, billet si texte, question si point d’interrogation, événement si date.
13. **Sondage replié** — n’apparaître qu’après « Ajouter un sondage ».
14. **Événement replié** — date/durée/places uniquement si format événement.
15. **Lieu optionnel replié** — champ adresse visible seulement sur demande.
16. **Tags optionnels repliés** — aucun suggestion, un seul champ.
17. **Audience par défaut** — « Tout le monde » ; le choix avancé dans « Plus d’options ».
18. **Planification repliée** — publication immédiate par défaut.
19. **Titre fusionné avec le texte pour les billets** — un seul champ de récit.
20. **Aperçu à la demande** — bouton « Voir l’aperçu », pas de carte permanente.

## C. Story (21–27)

21. **Un seul écran** — média, texte, audience ; plus de 3 étapes.
22. **Légende optionnelle** — placeholder + compteur, pas de champ obligatoire.
23. **Texte superposé replié** — bouton « Ajouter du texte ».
24. **Lien replié** — bouton « Ajouter un lien ».
25. **Audience et réponses par défaut** — options avancées seulement.
26. **Recadrage 9:16 automatique** — un toggle « Ajuster », pas un éditeur.
27. **Publier depuis le média** — action finale unique.

## D. Carnet (28–36)

28. **3 étapes** — Identité + itinéraire, logistique, récit/partage.
29. **Nuits calculées** — depuis les dates ; supprimer le stepper Nuits.
30. **Distance/D+ masqués sans trace** — visibles seulement si GPX/import.
31. **Météo optionnelle** — « Non renseignée » par défaut ; par jour seulement si dates.
32. **Tags optionnels** — un champ, aucune suggestion.
33. **Logistique repliée** — voyageurs, météo, note dans « Plus d’options ».
34. **Couverture optionnelle** — une image suffit ; pas de mosaïque obligatoire.
35. **Récit + IA repliés** — texte global, bouton IA seulement après écriture.
36. **Visibilité par défaut publique** — avancé dans « Plus d’options ».

## E. Sortie (37–43)

37. **Fusion Type + Lieu + Dates** — un premier écran.
38. **Durée calculée** — depuis les dates ; supprimer le champ Durée.
39. **Niveau par défaut Moyen** — modifiable, pas demandé au premier passage.
40. **Capacité avancée** — 10 places par défaut, réglage replié.
41. **Rendez-vous optionnel** — adresse seulement si activé.
42. **Sécurité repliée** — consignes dans « Plus d’options ».
43. **Couverture déduite du lieu** — image optionnelle, pas un bloc initial.

## F. Kit (44–48)

44. **Un seul écran** — inventaire + résumé ; supprimer les 3 étapes.
45. **Modèle optionnel** — aucun modèle par défaut ; suggestion seulement.
46. **Poids calculé** — depuis les objets ; supprimer le poids manuel.
47. **Objets custom repliés** — bouton « Ajouter un objet ».
48. **Visibilité avancée** — public par défaut.

## G. Club (49–50)

49. **Un seul écran Identité + Adhésion** — nom, catégorie, lieu, mode.
50. **Règles/questions/invitation repliées** — lien généré après création, pas dans le formulaire.

---

## Priorité

| Priorité | Points | Raison |
|---|---|---|
| **P0** | 1, 2, 3, 5, 10, 11, 17, 21, 28, 37, 44, 49 | Réduit immédiatement le nombre d’écrans/décisions. |
| **P1** | 4, 6, 8, 9, 12, 13, 14, 18, 22, 29, 30, 38, 39, 45, 46 | Réduit les champs et la charge cognitive. |
| **P2** | 7, 15, 16, 19, 20, 23–27, 31–36, 40–43, 47, 48, 50 | Polish, options avancées et cas secondaires. |

## Garde-fous

- **Ne pas supprimer les labels visibles** : la simplification vient du nombre de champs, pas de leur lisibilité.
- **Ne pas masquer une information obligatoire** : si un champ est requis, il reste dans le chemin court.
- **Ne pas inventer de valeurs** : les défauts sont des choix produits assumés, pas des données.
- **Conserver le brouillon et le scroll** à chaque retour.
- **Une action = un verbe** : Publier, Créer le carnet, Créer la sortie.
- **Vérifier à 430×932** : une colonne, clavier mobile, cibles 44×44, focus visible.
