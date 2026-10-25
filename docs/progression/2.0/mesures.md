# Mesure produit (T46)

## Baseline et différences

- **Total XP** : projection d'événements confirmés (`user_progression.lifetime_points`) — ne mesure JAMAIS la qualité ni la compréhension.
- **Réalisation** : nombre de réalisations sources distinctes (événements par action) — la vraie unité d'activité.
- **Qualité** : contributions acceptées (rapports, réponses, médias) — jamais déduite des likes ni du volume.
- Une hausse des points seule n'est **pas** un succès (`analyticsDoctrine()` l'encode).

## Événements instrumentés (minimaux, sans contenu privé)

`PROGRESSION_ANALYTICS_EVENTS` : carte vue/erreur, gain confirmé vu, gain
pending vu, mission choisie/terminée, page d'historique, passeport ouvert,
rythme, pause, suggestion montrée.

`sanitizeAnalyticsPayload` retire toute clé suspecte (trace, position,
conversation, document, santé, email…) et neutralise les valeurs
email/coordonnée — testé (`analyticsPayload.spec`).

## Pilote de compréhension (condition de lancement)

Cible proposée : ≥ 8 personnes sur 10 expliquent leur dernier gain et la
prochaine action possible. **Aucun résultat inventé** : ce pilote n'a pas été
exécuté (population réelle requise).

## Garde-fous

- Refus et coûts suivis séparément (plafonds, marge, pool) — toute alerte devise
  bloque l'émission commerciale, jamais l'accès aux fonctions.
- Cohortes : la comparaison se fait par cohorte (opt-in compétition), démos
  exclues.
