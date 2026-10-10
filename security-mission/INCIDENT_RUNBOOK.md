# INCIDENT_RUNBOOK.md — préparation et réponse (2026-10-09)

## 1. Rôles (à désigner — décision humaine)

| Rôle | Titulaire (à nommer) | Responsabilité |
| --- | --- | --- |
| Incident lead | TBD | décide, coordonne, tient la chronologie |
| Technique | TBD | confinement, correctif, preuves |
| Privacy/référent droits | TBD | qualification RGPD, information |
| Communication | TBD | messages internes/externes (aucun envoi automatique) |

## 2. Détection (sources)

Logs Supabase/Vercel, alertes GitHub (Dependabot/secret scanning), erreurs applicatives (5xx),
saturation rate-limit, jobs cron en échec/partiels, signalements utilisateurs, avis éditeurs.

## 3. Gradation et confinement (exemples liés aux constats)

| Événement | Confinement immédiat (sans destruction) |
| --- | --- |
| Job notifications abusé | Déployer F-003 ; si impossible : bloquer la route au niveau plateforme ; purger la file |
| Comptes seedés compromis | Appliquer la migration F-008 + révoquer les sessions ; surveiller les actions |
| Clé/secrets exposés | Révoquer/faire tourner (leçon Cloudflare 2023 : ne pas supposer un credential inutilisé) ; invalider les sessions ; vérifier les usages |
| Attachements publics F-006 | Restreindre le bucket / retirer les URLs exposées ; notifier si données personnelles |
| Abus SSRF | Désactiver og-preview (flag) ou allowlist ; examiner les logs de sortie |
| Dépendance critique exploitée | Patch ou retrait du composant ; évaluer la fenêtre d'exposition |

## 4. Notification — régimes distincts (ne pas confondre)

| Régime | Seuil | Délai | Autorité | Précondition |
| --- | --- | --- | --- | --- |
| RGPD | violation susceptible de risque | 72 h après connaissance | CNIL (+ personnes selon seuil) | qualification par le référent |
| CRA art. 14 (si champ) | vulnérabilité activement exploitée / incident grave | selon acte | canaux ENISA/CSIRT à confirmer | qualification produit |
| NIS2 (si assujetti) | incident significatif | selon droit FR | ANSSI | statut de transposition à revalider |

Aucune notification ne part sans décision humaine documentée.

## 5. Après incident

Chronologie + preuves bornées (pas de secrets/PII), cause racine (systematic-debugging), correctif +
test de non-régression, mise à jour du modèle de menace, exercice de suivi. Conserver les leçons :
un compte de service « inutilisé » reste révocable ; un secret en URL finit dans des logs (F-004).
