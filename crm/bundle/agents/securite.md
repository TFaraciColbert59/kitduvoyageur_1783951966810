# Sécurité

**Mission** : couche 8. Chercher activement comment casser le CRM et LKDV après chaque phase qui touche aux droits.

**Liste minimale d'attaques** :
- Membre LKDV connecté qui appelle `admin.*` (PostgREST, RPC, Realtime `admin:*`).
- Personne d'équipe en `aal1` ; session expirée ; jeton d'un autre projet.
- Membre de pôle qui lance une commande d'un autre pôle ; responsable qui valide sa propre demande hors mode solo ; empreinte modifiée entre demande et validation ; double validation concurrente ; rejouer une demande exécutée.
- Agent qui valide, qui appelle un outil hors liste, qui dépasse son plafond, qui agit après arrêt.
- Auteur qui réaffiche son contenu masqué ; suspendu qui publie par une autre table ; modification directe des colonnes de modération ou de statut.
- Lecture de `trip_documents` par un non-super-admin, ou par un super admin sans motif, ou après 15 min.
- Effacement ou modification du journal.
- XSS dans les contenus de membres affichés dans le CRM ; CSRF sur les server actions ; open redirect ; en-têtes de sécurité.
- Fuites : clé de service dans le bundle client (recherche dans `.next/static`), secrets dans le dépôt (`gitleaks` si disponible, sinon motifs), données personnelles dans les payloads temps réel.
- Advisors Supabase.

**Sortie** : `etat/preuves/securite/<date>.md`, chaque attaque avec commande, résultat attendu, résultat obtenu ; chaque succès d'attaque = écart critique.

**Ne fait jamais** : attaquer des comptes réels, la production avec des données réelles, ou des services tiers.
