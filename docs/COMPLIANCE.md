# Conformité Légale, RGPD & Éthique Commerciale — LKDV

## 1. Loi Influence Commerciale n° 2023-451 (9 juin 2023)
Conformément aux exigences légales françaises relatives aux contenus d'affiliation et partenariats rémunérés :
- Tout lien partenaire ou produit d'affiliation affiché dans un kit de voyage ou une recommandation comporte la mention permanente et non masquée **« Sponsorisé »** (ou « Collaboration commerciale »).
- Tous les liens sortants affiliés portent les attributs `rel="sponsored nofollow"` et `target="_blank"`.
- Protection stricte anti-Open Redirect : validation d'URL cible stricte (`isValidAffiliateTargetUrl`) n'autorisant que HTTPS et bloquant tout protocole malveillant (`javascript:`, `data:`, schémas relatifs).

---

## 2. Minimisation RGPD & Vie Privée
- **Hachage des sessions** : Aucune adresse IP brute ni User-Agent n'est stocké en base pour le tracking d'affiliation. La fonction `hashSessionForRgpd` applique un sel cryptographique et un hachage SHA-256 irréversible.
- **Rétention des logs** : Les événements du bus `lkv_events` ont une date d'expiration légale de 13 mois (`expires_at`), purgée automatiquement par cron / fonction SQL.
- **Documents d'identité** : Les numéros de pièces d'identité sont masqués automatiquement à l'affichage et dans les logs (`maskSensitiveIdentityNumber`). Les fichiers sont protégés par URLs signées HMAC courtes (15 minutes).

---

## 3. Sécurité des Webhooks & Signatures HMAC
- Les retours de commission d'affiliation et conversions partenaires sont signés cryptographiquement via HMAC SHA-256.
- La vérification côté serveur est exécutée en temps constant (`crypto.timingSafeEqual`) pour immuniser l'API contre les attaques par canal auxiliaire (timing attacks).
