# PRIVACY_REGISTER.md — registre des traitements (brouillon à valider, 2026-10-09)

Statut global : **à qualifier par le responsable compétent (D2)**. Aucune conformité n'est attestée.
Bases légales indiquées « à qualifier » : ne pas présumer du consentement pour tout traitement.

## 1. Catégories de données → traitements

| Donnée | Finalité | Base (à qualifier) | Stockage | Destinataires | Conservation actuelle |
| --- | --- | --- | --- | --- | --- |
| Email, identité de compte | compte, notifications | contrat | Supabase (eu-west-3) | Supabase, Resend | non définie (gap) |
| Profil (nom, bio, localisation déclarée, gamification) | vie sociale, affichage | contrat/intérêt légitime | Supabase + vue `public_profiles` (sans email) | public | non définie |
| Messages + pièces jointes | messagerie | contrat | Supabase + bucket privé `message-attachments` (signé 24 h) | membres conversation | non définie |
| Médias de groupes/clubs | partage communautaire | contrat | bucket `group-media` **public par URL** (F-006) | porteurs d'URL | non définie |
| GPS live/positions | sécurité terrain, partage choisi | consentement/permission OS (distincts) | Supabase, purge `expire-live-positions` | destinataires choisis | expiration live gérée ; historique à définir |
| Sessions rando/traces | carnet, preuve terrain | contrat | Supabase + local (vault chiffré ou repli clair documenté) | soi + partage kit anonymisé | non définie |
| Documents de voyage (identité) | organisation voyage | contrat | bucket privé `user-documents` (signé 365 j) | propriétaire uniquement (viewerCanReadDocs=false) | non définie |
| Inventaire/serials | gestion matériel | contrat | Supabase + Dexie local | soi (+ partage token) | non définie |
| Commandes/paiements | exécution du contrat | contrat + obligations comptables | Supabase + Stripe | Stripe | factures : conservation légale (ne pas effacer arbitrairement) |
| Rewards/royalties/store credit | fidélité, part créateur | contrat | Supabase | soi/admin | non définie |
| **Données médicales de participants** (groupe sanguin, allergies, ICE) | sécurité des sorties | consentement explicite à qualifier (art. 9 ?) | **localStorage local, non chiffré** | appareil | purge au changement de compte (F-011) ; au repos : H-036 |
| Télémétrie hub | amélioration produit | intérêt légitime/consentement selon traceur | Supabase | interne | non définie |
| Prompts/contextes IA | fonctionnalités | contrat/intérêt légitime | cache `ai_response_cache` (TTL par feature) + fournisseurs | OpenRouter/NVIDIA/Google (US probables → AITD) | cache TTL défini ; fournisseurs à qualifier |
| Logs/erreurs | sécurité, exploitation | intérêt légitime | plateformes | interne | non définie (gap) |

## 2. Droits des personnes

- Export : `GET /api/account/export` (test local A14 documenté).
- Effacement : `DELETE /api/account/delete` avec phrase de confirmation (test local A14 documenté) ;
  à compléter : caches/index/fournisseurs, copies Storage, politique backups.
- Consentement traceurs : `lkdv_cookie_consent` présent ; GA4 seulement si
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` renseigné (aucun traceur sinon — à vérifier au déploiement).

## 3. Transferts et sous-traitants (à qualifier — AITD)

Supabase (eu-west-3 ; support/télémétrie hors UE possible), Vercel (hébergement), Stripe,
Resend (emails), Upstash (rate-limit), OpenRouter/NVIDIA/Google Gemini (IA), Tripadvisor/Terra,
Viator/RouteStack, Klook/Travelpayouts, GitHub. **La région UE du projet ne prouve pas l'absence de
transfert** : démarche CEPD 01/2020 à appliquer (cartographie, instrument, mesures supplémentaires).

## 4. Points d'attention immédiats

1. F-008 : comptes de démo connectables → suppression/rotation = aussi un sujet privacy (usurpation).
2. F-006 : médias de groupes publics par URL.
3. Données médicales locales (H-036) : chiffrement local (vault existant) ou réduction de collecte.
4. Rétention : quasi toutes « non définie » → RETENTION.md propose des valeurs à valider.
5. Mineurs : âge/cible non déterminés ; seuil FR 15 ans (régime consentement services société de
   l'information) — à qualifier si le service cible des mineurs.
6. AIPD : GPS + croisements (terrain, réputation, IA) → évaluer sur les critères CNIL ; DPO : art. 37
   à documenter (suivi systématique à grande échelle ?).

## 5. Ce qui reste humain

Désignation DPO/référent, décisions de bases légales, AIPD, AITD, informations aux personnes,
contrats (DPA), réponse aux autorités. L'agent a préparé la matière, pas les décisions.
