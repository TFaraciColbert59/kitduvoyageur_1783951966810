# DPA sous-traitants et transferts internationaux

> **À VALIDER PAR UN HUMAIN HABILITÉ — BROUILLON.** Aucun DPA n'est signé ni
> vérifié ici. Aucune conclusion sur la licéité des transferts n'est apportée.

**Date du brouillon :** 2026-09-12

## 1. Sous-traitants identifiés dans l'architecture (à confirmer)

| Sous-traitant | Rôle | Données concernées | DPA signé ? |
|---|---|---|---|
| Supabase | Base Postgres/PostGIS, auth, stockage | comptes, contenus, géodonnées | `INSUFFICIENT_DATA` |
| Vercel | Hébergement Next.js, logs | requêtes, IP, logs techniques | `INSUFFICIENT_DATA` |
| Stripe | Paiement | identifiants de paiement, e-mails de facturation | `INSUFFICIENT_DATA` |
| Upstash (optionnel) | Rate limiting distribué | clés techniques (ID utilisateur/IP), TTL court | `INSUFFICIENT_DATA` |
| Travelpayouts (affiliation) | Postbacks de conversion | identifiants de conversion, montants | `INSUFFICIENT_DATA` |
| Fournisseurs IA / tuiles (selon configuration) | Enrichissement | selon les prompts (à cartographier) | `INSUFFICIENT_DATA` |

> Les fournisseurs IA effectivement activés dépendent des clés d'environnement
> (aucune clé vérifiée dans ce worktree) : cartographie à compléter par un humain.

## 2. Points à trancher par un humain habilité

1. **Localisation des données** : région Supabase, région Vercel, région Upstash,
   région des sauvegardes → identifier chaque transfert hors UE.
2. **Mécanismes de transfert** : décision d'adéquation, clauses contractuelles
   types (CCT) versionnées, mesures supplémentaires (chiffrement, minimisation).
3. **Sous-traitants ultérieurs** : chaque fournisseur autorise-t-il la
   sous-traitance ultérieure ? Notification en cas de changement ?
4. **Registre des DPA** : conserver les DPA signés, dates, versions, annexes.
5. **Minimisation** : vérifier que les payloads envoyés aux tiers (IA, tuiles,
   affiliation) ne contiennent aucune donnée personnelle non nécessaire.

## 3. Faits techniques utiles (vérifiés)

- Les clés prestataires sont pilotées par variables d'environnement ; leur
  absence produit un état dégradé explicite (fail-safe), jamais un appel.
- `stripe_events` ne contient **aucune PII** (id d'événement, type, objet).
- Le hash de session affiliée est déjà tronqué/haché (`hashSessionForRgpd`).
- L'export RGPD (`/api/account/export`) n'envoie rien à un tiers.

## 4. Livrables attendus (humain)

- [ ] Tableau définitif sous-traitants × pays × mécanisme de transfert.
- [ ] Copies des DPA signés.
- [ ] Mise à jour de la politique de confidentialité (liens vers les DPA).
- [ ] Décision écrite sur chaque transfert hors UE.

**Aucune validation juridique n'est simulée.**
