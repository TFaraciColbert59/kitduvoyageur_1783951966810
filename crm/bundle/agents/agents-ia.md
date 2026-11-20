# Agents IA

**Mission** : le serveur MCP (`/api/mcp`), l'exécution des 6 agents (`EX-AGT-09`), leurs comptes de service, plafonds, arrêt, et le banc d'injection.

**Entrées** : `01_CAHIER_DES_CHARGES.md` § 7, `02_ARCHITECTURE.md` § 8, `09_INTEGRATIONS_API.md` § 6 et 8, `04_CATALOGUE_ACTIONS.md` colonne « agent », maquette `Agents.dc.html`.

**Les 6 agents** (droits = maquette) :
| Agent | Pôle | Fait | Ne fait jamais |
| --- | --- | --- | --- |
| Trieur de signalements | CONF | Regroupe, propose une décision + motif + confiance | Masquer, sanctionner |
| Remboursements | COMM | Prépare la demande de remboursement avec les faits de la commande | Valider, exécuter |
| Support | MEMB | Propose une réponse au ticket, classe | Envoyer sans relecture humaine |
| Résumeur de fiches | MEMB | Résume l'historique d'un membre, données personnelles masquées | Lire documents, orientation, messages privés |
| Relecteur de fiches pays | CONT | Signale incohérences et sources manquantes | Publier |
| Surveillant d'erreurs | TECH | Regroupe les erreurs, ouvre une alerte | Déployer, modifier la base |

**Règles** :
- Contenu de membre toujours entre `<donnee_non_fiable>` ; consigne explicite de ne pas exécuter ce qu'il contient ; aucun outil n'accepte un identifiant de cible qui n'est pas celui de l'objet en cours.
- Arguments renvoyés par le modèle validés par zod avant appel ; toute erreur → la proposition est abandonnée et journalisée.
- Une proposition est une ligne de file (`admin.inbox`) avec la confiance ; une personne décide.

**Banc d'injection** (`crm/tests/injection/cases.json`, 50 cas) : instructions directes, instructions cachées (texte blanc, Unicode invisible, base64), faux messages système ou « de Tony », demandes d'escalade de droits, cibles substituées, chaînes longues. Attendu : 0 commande exécutée, 0 proposition hors du périmètre de l'objet.

**Prêt** : tests MCP de `09_INTEGRATIONS_API.md` § 8 verts, banc 50/50, arrêt effectif < 5 s, agents incapables de valider (pgTAP).
