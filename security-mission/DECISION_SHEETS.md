# DECISION_SHEETS.md — fiches de décision (D2, D4, D5, D7, D8)

Chaque fiche : contexte factuel, options, recommandation de l'agent, impact, réversibilité,
preuves, décision à signer. L'agent ne signe ni conformité ni risque.

---

## D2 — Juridique (RGPD, transferts, AIPD, DPO, mineurs)

**Contexte** : traitements réels identifiés (comptes, messages, GPS live/historique, documents
d'identité de voyage, données médicales de participants en local, paiements, prompts IA).
Sous-traitants hors UE probables (OpenRouter/NVIDIA/Google, Resend, Stripe, Vercel, Upstash).

**Options** :
1. Traiter en interne avec les artefacts préparés (PRIVACY_REGISTER, COMPLIANCE_MATRIX, RETENTION).
2. Engager un conseil (recommandé avant lancement public) sur : bases légales, DPA, AITD,
   AIPD GPS/profilage, DPO art. 37, politique mineurs, notices.

**Recommandation** : option 2 pour la revue finale ; option 1 pour préparer les brouillons
(déjà faits). Points durs : AITD providers IA (démarche CEPD 01/2020), AIPD (GPS + inférences),
DPA Stripe/Supabase/Vercel, information géolocalisation, politique d'âge.

**Impact** : documents + éventuels changements produit (réglages de visibilité, minimisation).
**Réversibilité** : n/a (décisions juridiques). **Preuves** : PRIVACY_REGISTER.md,
COMPLIANCE_MATRIX.md, RETENTION.md. **Signature** : ________ (responsable).

---

## D4 — Purge client à la déconnexion seule

**Contexte** : la purge inter-comptes (F-011 rev2/rev3) se déclenche UNIQUEMENT sur changement
d'utilisateur (A→B, A→logout→B) ; une déconnexion seule laisse le stockage d'A en place jusqu'à la
prochaine connexion (choix documenté pour ne pas détruire les brouillons d'un même utilisateur).

**Options** :
1. Statu quo (recommandé pour les données de travail : brouillons, panier).
2. Purger AUSSI les caches du service worker à la déconnexion (images/HTML runtime) — le stockage
   privé reste, mais rien de servable par cache ne subsiste pour un invité.

**Recommandation** : option 2 (coût faible, gain de propreté) + documenter la fenêtre résiduelle
(stockage local accessible uniquement via outils développeur sur l'appareil).
**Impact** : re-téléchargement de quelques images à la reconnexion. **Réversibilité** : 1 commit.
**Preuves** : fixes.json FIX-002/005, revue indépendante rev2/rev3. **Signature** : ________.

---

## D5 — og-preview (SSRF résiduel + abus)

**Contexte** : garde SSRF durcie (rev2) + rate-limit 20/min ajouté ; résidu documenté : un nom DNS
public peut résoudre vers une IP privée (nip.io & co) — aucune résolution DNS vérifiée.

**Options** :
1. Statu quo durci (recommandé court terme) : garde + rate-limit + surveillance.
2. Allowlist de domaines (configurable) pour la preview — supprime le résidu DNS mais réduit la
   fonctionnalité aux domaines approuvés.
3. Supprimer la preview d'URL arbitraire.

**Recommandation** : option 1 + réévaluation ; option 2 si la preview est peu utilisée.
**Impact** : option 2 = liste de domaines à maintenir. **Réversibilité** : code uniquement.
**Preuves** : findings F-010, evidence wave3 §2, tests og-preview-ssrf (13 cas). **Signature** : ________.

---

## D7 — group-media : phase 2 (bucket privé + URLs signées)

**Contexte** : phase 1 livrée (politiques d'appartenance SELECT/INSERT/DELETE — les uploads
deviennent gouvernés ; le bucket reste `public` pour ne pas casser les URLs historiques des
messages). F-006 non totalement fermé tant que le bucket est public.

**Options** :
1. Phase 2 complète (recommandé avant lancement public) : bucket `public=false`, passage des
   nouveaux uploads en `createSignedUrl`, réécriture/migration des URLs historiques des messages
   (job de migration des contenus), purge du cache image SW associé.
2. Statu quo phase 1 : les objets restent lisibles par URL (fuite résiduelle si URL diffusée).

**Impact option 1** : migration de contenus (messages), rendu des pièces jointes à adapter
(URLs signées à la volée), test E2E groupes. **Réversibilité** : partielle (URLs réécrites).
**Preuves** : findings F-006, migration 20261010120000, evidence wave1 §2. **Signature** : ________.

---

## D8 — Rétention (valeurs + jobs de purge)

**Contexte** : quasi toutes les durées sont indéfinies (RETENTION.md propose des valeurs).
Priorités : données médicales locales (chiffrer/réduire — H-036), logs 30 j, TTL cache IA alignés
sur la finalité, fenêtre de sauvegarde ≤ 30 j + re-suppression post-restauration.

**Options** :
1. Adopter la table RETENTION.md telle quelle (recommandé comme base de discussion).
2. Ajuster par exception documentée (obligations comptables 10 ans pour commandes/factures).

**Recommandation** : adopter 1 + exceptions 2, puis créer les jobs de purge avec preuve (test)
et trace. **Impact** : stockage réduit, obligations respectées. **Réversibilité** : valeurs
ajustables ; ne jamais supprimer un ordre/facture pour verdir un test.
**Preuves** : RETENTION.md, routes account/export & delete (tests locaux A14). **Signature** : ________.
