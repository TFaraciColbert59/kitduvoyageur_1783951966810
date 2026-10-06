# Compas copilote — analyse et architecture du contexte projet

> Chantier du 2026-10-06. Objectif : « 1 phrase → projet entièrement contextualisé →
> personnalisation libre → mise à jour de tout ce qui dépend d'un changement → projet prêt ».

## 1. L'existant (ce qui est déjà juste et qu'on garde)

| Brique | Rôle | Fichier |
|---|---|---|
| Voyage | Ligne `trips` : activité, dates, nb de personnes, destination, budget | table `trips` |
| Réglages projet | `trips.metadata.compas` : `prefs` (rythme, nuits, envies, à éviter), `duration_h`, `planned_days`, `anchor` (destination retrouvée sur la carte), `autofill` / `autofill_pending` | `engine/meta.ts`, `server/compasServer.ts` |
| Préférences globales | `user_orientation` (terrain, autonomie, priorité, expérience) — privée, RLS `user_id = auth.uid()` | migration `20260904010000` |
| Compréhension | « Dis-le » : phrase → actions **proposées** (schéma fermé, ancrage dans la phrase, limites réelles), appliquées par un geste | `engine/intent.ts`, `components/CompasDisLe.tsx`, `components/compasApply.ts` |
| Génération | Préremplissage en deux temps : étapes (catalogue ou IA vérifiée sur la carte), puis nuits, trajet, kit, budget | `server/autofillActions.ts`, `engine/autofill.ts` |
| Dérivation | `buildCompasModel` : fonction pure qui produit TOUT ce que l'écran affiche (itinéraire jour par jour, sac, poids, équipe, budget, réservations, Verdict) depuis les lignes en base | `engine/compasModel.ts` |
| Hors ligne | Instantané du modèle sur l'appareil | `offline/snapshot.ts` |

Points forts à préserver :
- **Le Verdict, le Kit, le budget et la charge par membre sont déjà dérivés à la lecture**
  d'une seule source (les lignes du voyage). Ils restent synchronisés sans rien recalculer.
- Rien n'est inventé : une donnée absente reste absente et l'écran le dit.
- Une phrase ne fait que **proposer** ; l'application demande un geste.

## 2. Les manques par rapport à l'objectif

1. **Pas de provenance.** On ne sait pas si une valeur vient de la phrase, d'un réglage
   du projet, du profil ou d'un défaut. Impossible de dire « habituellement tu préfères X,
   mais pour ce projet Y ».
2. **Priorités implicites.** Le profil est lu au fil du code (`planNights` mélange réglage
   projet et `user_orientation`) ; le reste l'ignore (niveau, priorité légèreté…).
3. **Contraintes projet manquantes.** Rien pour « dormir dehors 3 nuits », « rester sous
   12 kg », « surtout de la montagne », ni pour surcharger l'autonomie, la priorité ou le
   niveau sur un seul projet.
4. **Génération à usage unique.** Le préremplissage refuse de repasser (« annule d'abord
   pour relancer ») : changer 7 → 10 jours ou Allemagne → Norvège ne recalcule rien de ce
   qui a été écrit (étapes, nuits, objets, dépenses).
5. **Sorties courtes mal servies.** Pas d'activité course à pied ni trail ; une sortie
   d'une heure passe par les mêmes modules qu'un trek (nuits, vol, réservations).
6. **Pas de meilleure période** quand aucune date n'est donnée.

## 3. La source de vérité unique

**Le projet = la ligne `trips` + `trips.metadata.compas`.** Rien n'est copié ailleurs :

- Les **préférences globales** (`user_orientation`) ne sont **jamais recopiées** dans le
  projet : elles sont lues et résolues à la volée. Changer son profil change les
  hypothèses des projets qui n'ont rien fixé, pas ceux qui ont choisi.
- Les **personnalisations projet** vivent dans `metadata.compas.prefs` (étendu : niveau,
  autonomie, priorité, poids max du sac, nuits dehors, terrain recherché).
- Le **contexte résolu** (`ProjectContext`, `engine/projectContext.ts`) est un calcul
  pur, jamais stocké : chaque champ porte sa valeur, sa **source** et, si besoin, une
  **adaptation** expliquée.

### Ordre de priorité (par champ)

1. `phrase` — demande explicite en cours (proposée par Dis-le, appliquée par un geste)
2. `projet` — réglage personnalisé de ce projet (`metadata.compas.prefs`)
3. `compas` — sélection active du voyage (activité, dates, nb de personnes sur `trips`)
4. `profil` — `user_orientation`
5. `defaut` — valeur proposée selon l'activité, la durée, la destination

Une fois l'ordre appliqué, un **contrôle de cohérence** peut **adapter** une valeur
héritée du profil ou d'un défaut quand elle devient incohérente ou dangereuse pour ce
projet (ex. profil « bivouac » + sortie d'une heure ; profil « journée » + 7 jours ;
profil « débutant » + haute montagne). Une valeur fixée par la phrase ou le projet n'est
**jamais** adaptée en silence : le Verdict signale le risque, l'utilisateur tranche.

## 4. Dépendances et recalcul ciblé

`engine/dependencies.ts` décrit, pour chaque champ du contexte, les **parties écrites**
qui en dépendent :

| Changement | Étapes | Nuits | Trajet | Sac | Budget |
|---|---|---|---|---|---|
| destination | ✔ | ✔ | ✔ | ✔ | ✔ |
| durée / dates | ✔ (redécoupe) | ✔ | — | ✔ (quantités) | ✔ |
| activité | ✔ | ✔ | — | ✔ | ✔ |
| nuits / nuits dehors | — | ✔ | — | ✔ | ✔ |
| nb de personnes | — | — | ✔ (voitures) | ✔ (collectif) | ✔ |
| poids max | — | — | — | ✔ (allègement) | — |
| hôtel d'une nuit | — | cette nuit | — | — | — |

Le Verdict, le Kit et l'affichage restent dérivés (`buildCompasModel`) : ils suivent
automatiquement.

**Conservation des choix** : seul ce que le préremplissage a écrit (identifiants tenus
dans `metadata.compas.autofill`) peut être remplacé, et seulement s'il n'a pas été
modifié depuis. Ce que l'utilisateur a ajouté ou retouché est conservé.

## 5. Modules selon la portée

`scope` ∈ `sortie` (moins d'une journée), `journee`, `sejour`. Une sortie n'affiche ni
nuits, ni hébergement, ni vol, ni réservations : parcours, allure, météo, tenue,
hydratation, sécurité.

## 6. Lots

1. **Contexte projet** : résolution + provenance + adaptations, personnalisations projet
   étendues, compréhension des contraintes (« 3 nuits dehors », « sous 12 kg »,
   « surtout de la montagne »), activités course à pied et trail, portée des modules,
   Verdict sur le poids max. Le préremplissage lit le contexte résolu.
2. **Recalcul ciblé** : relancer seulement les parties dépendantes d'un changement,
   en conservant les choix de l'utilisateur.
3. **Meilleure période** : sans date, une période proposée (saison, activité,
   destination), visible et modifiable.
