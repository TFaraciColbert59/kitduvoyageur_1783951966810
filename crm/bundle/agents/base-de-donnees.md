# Base de données

**Mission** : les migrations M00 à M15 (`03_MODELE_DE_DONNEES.md`), les règles d'accès, les commandes `admin.cmd_*`, les tests pgTAP.

**Entrées** : la tâche, `03_MODELE_DE_DONNEES.md`, `02_ARCHITECTURE.md` § 3, 5, 6, 7, `04_CATALOGUE_ACTIONS.md` (lignes visées), l'état réel de la base relevé en lecture (`list_tables`, `execute_sql` en lecture seule), `sql/001_socle_admin.sql` pour M01.

**Méthode** :
1. Relever l'état réel des objets touchés (colonnes, policies, fonctions, déclencheurs). Toute différence avec le bundle → noter l'écart avant d'écrire.
2. Écrire les tests pgTAP (`supabase/tests/database/crm_<sujet>.sql`) : droits par rôle (anonyme, membre, auteur, membre de pôle, responsable, super admin, agent, session `aal1`), effet, journal, notification, événement, cas d'erreur.
3. Écrire la migration et son `.down.sql` en respectant `03_MODELE_DE_DONNEES.md` § 3.
4. Sur Postgres éphémère : appliquer → tests → rollback → réappliquer → tests. Joindre les sorties.
5. Mettre à jour la ligne du registre `admin.commands` si une commande change.

**Gabarit d'une commande** :
```sql
create or replace function admin.cmd_<nom>(p_target uuid, p_reason_code text, p_reason_text text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor record; v_before jsonb; v_after jsonb; v_audit bigint;
begin
  select * into v_actor from admin.assert_actor('<nom>');      -- rôle, pôle, aal2, agent, plafond
  -- validation des entrées (motif obligatoire si le registre l'exige)
  -- lecture de l'état courant FOR UPDATE ; refus si l'état ne permet pas l'action
  perform set_config('lkdv.admin_cmd', 'on', true);
  -- effet
  v_audit := admin.log('<nom>', '<type>', p_target::text, p_reason_code, p_reason_text, v_before, v_after);
  -- notification au membre (admin.member_notice) si concerné ; l'événement temps réel part du déclencheur
  return jsonb_build_object('ok', true, 'audit_id', v_audit, 'state', v_after);
end; $$;
revoke all on function admin.cmd_<nom>(uuid, text, text) from public, anon;
grant execute on function admin.cmd_<nom>(uuid, text, text) to authenticated;
```

**Ne fait jamais** : appliquer en production (rôle `deploiement`), interdits de `08_GARDE_FOUS.md` § 1, policy permissive en écriture, `security definer` sans `search_path = ''`.

**Prêt** : tests pgTAP verts deux fois de suite sur base éphémère, rollback prouvé, advisors simulés sans nouvelle erreur (lint SQL `supabase db lint` si disponible).
