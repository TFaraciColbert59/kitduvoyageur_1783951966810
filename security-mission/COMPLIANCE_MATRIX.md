# COMPLIANCE_MATRIX.md — applicabilité UE/FR (2026-10-09)

Statuts : `applicable_to_confirm` · `conditional` · `unverified` · `not_applicable_justified`.
Aucune décision juridique finale — matières préparées pour D2. Dates à revalider au run de release.

| Cadre | Déclencheur à vérifier | Faits LKDV observés | Statut | Pièces nécessaires |
| --- | --- | --- | --- | --- |
| RGPD / loi FR | personnes identifiables, comptes, messages, GPS, achats | comptes Supabase, messages, GPS, paiements, logs | applicable_to_confirm | registre (PRIVACY_REGISTER), bases légales, informations, DPA |
| Transferts (art. 46) | entités, pays d'accès des sous-traitants (IA US ?) | OpenRouter/NVIDIA/Gemini, Resend, Stripe, Vercel | conditional | cartographie des flux + AITD (démarche CEPD 01/2020) |
| ePrivacy / traceurs | cookies/SDK/identifiants | consentement cookie local, GA conditionnel, session cookies | applicable_to_confirm | preuve blocage préalable + retrait |
| GPS (CNIL) | suivi, partage live, inférences | live positions avec expiration, kit anonymisé massif | applicable_to_confirm | information dédiée, réglages visibilité |
| AIPD (art. 35) | échelle, croisement, suivi systématique, publics vulnérables | GPS + réputation + IA + social | conditional (évaluer sur listes CNIL) | décision motivée, AIPD si requise |
| DPO (art. 37) | suivi régulier et systématique à grande échelle ? | à qualifier | conditional | décision documentée |
| Mineurs | cible/âge, consentement services SI | non déterminé | unverified | politique d'âge si applicable |
| AI Act | usages, transparence art. 50 (depuis 02/08/2026), haut risque (reports 12/2027-08/2028) | assistants (chat, guides, kit, narration) | conditional | inventaire systèmes, mentions transparence IA |
| CRA | app distribuée + solution distante | app Capacitor + backend | conditional (art. 14 depuis 11/09/2026 : vulnérabilités exploitées/incidents — canaux à qualifier) | qualification produit/backend, processus vulnérabilités |
| NIS2 | secteur/taille ; transposition FR en cours (dossier) | marketplace/social possibles | unverified | revalider droit FR au run |
| DSA | hébergement de contenu utilisateur, marketplace | posts, clubs, avis, boutique | conditional (exemptions micro/petites ciblées) | signalement/modération, art. 15/19/29 |
| PCI / PSD2 / SCA | parcours carte Stripe redirect/embedded | Checkout Stripe (redirection) | conditional | scope SAQ adapté, SCA via Stripe |
| Autres (conso, tourisme, prospection) | vente/location/revente, forfaits, emails marketing | boutique, marketplace, notifications | unverified | qualification par activité |

## Repères temporels (à revalider)

- AI Act modifié par (UE) 2026/1744 (en vigueur 27/07/2026) ; art. 50 depuis 02/08/2026 ;
  haut risque annexe III 02/12/2027 / annexe I 02/08/2028 (transitions à vérifier).
- CRA : art. 14 depuis 11/09/2026 ; application principale 11/12/2027.
- NIS2 FR : transposition en cours selon dossier — ne pas présumer d'obligations.
- Omnibus données 2025/0360(COD) : proposition, pas de droit applicable.

## Incidents — seuils distincts à préparer

| Régime | Déclencheur | Délai | Destinataire |
| --- | --- | --- | --- |
| RGPD | violation susceptible de risque | 72 h (conditions art. 33) | CNIL ; information des personnes selon seuil |
| CRA art. 14 (si dans le champ) | vulnérabilité activement exploitée / incident grave | selon acte | ENISA/CSIRT — canaux à confirmer |
| NIS2 (si assujetti) | incident significatif | selon droit national | ANSSI — statut FR à revalider |

Aucune notification ne doit être déclenchée sur un simple candidat d'audit.
