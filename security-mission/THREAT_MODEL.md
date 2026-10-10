# THREAT_MODEL.md — LKDV (2026-10-09, référence `14d80de8`)

Méthode : STRIDE par frontière + scénarios d'abus produit/IA + scénarios privacy (dossier A.5).
Faits ancrés par `findings.json` (F-xxx), `hardening.json` (H-xxx), `evidence/*`.

## 1. Acteurs

| Acteur | Capacité |
| --- | --- |
| Anonyme Internet | appelle toutes les routes publiques, lit les buckets publics, tente des ids |
| Utilisateur A / B | compte légitime ; B sur le même appareil qu'A (scénario clé) |
| Membre exclu / invité / bloqué | droits résiduels après changement d'état |
| Admin plateforme | `is_admin()` ; UI /admin ; actions rewards |
| Appelant service/cron | Bearer CRON_SECRET (ou absence de contrôle — F-003) |
| Fournisseurs IA | reçoivent prompts/données ; renvoient du contenu non fiable |
| Partenaires (Stripe, Resend, Tripadvisor, Viator…) | webhooks/API externes |
| Chaîne d'approvisionnement | npm, GitHub Actions, actions non épinglées |
| Accès physique à l'appareil | stockage local, sauvegardes OS |

## 2. Actifs

Sessions/comptes · profils (emails) · messages + pièces jointes · traces GPS/live · documents
d'identité de voyage · **données médicales de participants (stockage local)** · serials d'inventaire ·
commandes/paiements/ledger/royalties · pouvoirs admin · budget IA · contenus communautaires/guides ·
secrets (service role, CRON, Stripe, clés IA).

## 3. Menaces par frontière (extraits ancrés)

| Frontière | Menace | État |
| --- | --- | --- |
| Client→API | BOLA/IDOR, mass assignment, méthodes alternatives, CSRF (cookies SameSite=None) | F-001 candidat ; 48 routes sans contrôle classées (H-010) |
| Client→API (jobs) | Déclenchement non autorisé de jobs service-role (emails/push) | **F-003 CONFIRMÉ** → corrigé (branche) |
| API→DB | Contournement RLS (SECDEF, service role, combinaison de policies) | statique fait (U-SDEF-01, H-011/H-012) ; tests réels manquants (H-003) |
| API→Externe | SSRF (og-preview), clés en URL/logs, redirections | F-010 candidat → corrigé rev2 ; DNS résiduel H-032 |
| IA | Injection indirecte (POI/messages/docs), cache cross-user, abus de coût | U-AI-01/H-021/H-022/H-028 ; pas de tool-calling dans le code |
| Storage | Bucket public (group-media), projection par permission | F-006 candidat ; H-017c |
| Offline/PWA | Rétention inter-comptes, purge perdue sans SW, stores Zustand en mémoire | **F-011 candidat** → rev2/rev3 ; réserves tracées |
| Paiements | Replay/duplicata, dérive stock, remboursements partiels | U-STRIPE-01 vérifié (idempotence solide) ; H-020 |
| Ledger | Double crédit, course, replay offline | claim/withdraw vérifiés ; RPC à valider en base (D1) |
| Plateforme | Actions non épinglées, deps critiques (Capacitor), absence de workflow backup, secrets | H-033, H-035 (audit : 2 critical/10 high prod), BACKUP_RESTORE.md |
| Identités | Credentials seedés publics | **F-008 CONFIRMÉ** → migration de remédiation prête (D1) |
| Privacy | Transfers hors UE (IA), rétention non définie, données médicales locales, mineurs | PRIVACY_REGISTER.md ; D2 |

## 4. Scénarios d'abus produit/IA (à exécuter en tests LKDV)

1. POI/document décrivant une action externe → l'assistant ne doit pas exécuter d'outil (aucun
   tool-calling trouvé ; à verrouiller par test de non-exécution).
2. Message d'un membre exclu → retrieval IA et lecture ne doivent pas l'inclure (ACL avant retrieval —
   à vérifier au cas par cas).
3. Description de produit cherchant à créditer un compte → `claim_reward_points` exige service_role et
   identité de session (vérifié) ; récompenses non déclenchées par contenu LLM.
4. Sortie LLM malformée → schémas stricts pour kit/itinerary/activity ; champs libres stockés sans
   schéma (H-028) — sanitize au rendu à confirmer.
5. Injection dans le template email (F-009) → échappement à ajouter.

## 5. Scénarios privacy

- Trace GPS + habitudes → inférence domicile (CNIL GPS) ; granularité kit = massif (OK), partage live à
  borner par destinataire/expiration (U-MOBILE-01).
- Données médicales de participants en localStorage non chiffré (F-011 rev2 les purge au changement de
  compte ; au repos : H-036 à décider — vault local existe pour la rando).
- Prompts envoyés aux fournisseurs IA (OpenRouter/NVIDIA/Google) → transferts à qualifier (D2).

## 6. Hypothèses et limites

Aucun accès production ; protections plateforme (WAF/Vercel) inconnues ; pas de test dynamique A→B ;
menaces physiques/appareils non testées ; ce modèle est un artefact de travail, pas une attestation.
