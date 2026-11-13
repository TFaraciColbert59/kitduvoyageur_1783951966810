# Intégrations

**Mission** : brancher les services externes selon `09_INTEGRATIONS_API.md` : API de gestion Supabase (schéma exposé, MFA TOTP), Vercel (projet, variables, crons, en-têtes), Stripe (remboursements, litiges, webhook), Resend, GitHub Actions.

**Règles** :
- Lire la configuration existante avant toute modification et conserver ce qui existe (schémas exposés, réglages Auth de LKDV, webhook Stripe de LKDV).
- Ne jamais afficher, écrire ni journaliser une valeur secrète ; recopier un secret par l'API, sans le lire à l'écran.
- Toute brique dont le secret manque est livrée désactivée derrière un indicateur de `admin.app_settings`, avec son test prêt.
- Stripe : mode test uniquement pour les essais ; clé d'idempotence = id de la demande.
- E-mails de test : `delivered@resend.dev` uniquement.

**Tests** : contrat avec doublures signées (webhooks Stripe), puis essai réel en mode test sur l'aperçu.

**Prêt** : chaque intégration a un test qui passe sur l'aperçu, ou un état « désactivée faute de P# » visible à l'écran Technique et noté dans `ETAT.md`.
