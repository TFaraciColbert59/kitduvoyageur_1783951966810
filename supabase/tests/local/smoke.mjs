// Smoke test des fonctions du plan de contrôle (base shim, aucune production).
import pg from './pg.mjs';

const c = new pg.Client({ host:'127.0.0.1', port:55432, user:'postgres', password:'postgres', database:'lkdv_shim' });
await c.connect();

const SA  = 'e0000000-0000-4000-8000-000000000001';
const SA2 = 'e0000000-0000-4000-8000-000000000002';
const MOD = 'e0000000-0000-4000-8000-000000000003';
const USER= 'e0000000-0000-4000-8000-000000000004';
const AG  = 'e0000000-0000-4000-8000-000000000005';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ', name); }
  else { fail++; console.log('  FAIL ', name, extra ?? ''); }
}
async function as(uid, aal, fn) {
  await c.query('begin');
  try {
    await c.query('set local role authenticated');
    await c.query(`set local "request.jwt.claims" = '${JSON.stringify({ sub: uid, role: 'authenticated', aal })}'`);
    const r = await fn();
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  }
}
async function err(fn) {
  try { await fn(); return null; } catch (e) { return e; }
}
async function fresh() {
  await c.query('rollback').catch(() => {});
}

// ── fixtures ───────────────────────────────────────────────────────────────
for (const [id, email, name] of [[SA,'sa@test','SA'],[SA2,'sa2@test','SA2'],[MOD,'mod@test','MOD'],[USER,'user@test','USER'],[AG,'agent@test','AGENT']]) {
  await c.query(`insert into auth.users (id,email,last_sign_in_at) values ($1,$2,now()) on conflict (id) do update set last_sign_in_at = now()`, [id, email]);
  await c.query(`insert into public.user_profiles (id,email,full_name) values ($1,$2,$3) on conflict (id) do nothing`, [id, email, name]);
}
await c.query(`insert into public.admin_roles (user_id, role) values ($1,'super_admin'),($2,'super_admin') on conflict (user_id) do update set role='super_admin'`, [SA, SA2]);
await c.query(`update public.user_profiles set role='admin' where id = any($1::uuid[])`, [[SA, SA2]]);
await c.query(`insert into admin.staff_memberships (user_id, pole_code, role) values ($1,'CONF','membre') on conflict (user_id, pole_code) do update set role='membre', revoked_at=null`, [MOD]);
await c.query(`insert into admin.agents (name, auth_user_id, pole_code, objective, tools, status) values ('agent_test',$1,'CONF','test',array['post_hide','member_view_360'],'active') on conflict (name) do update set auth_user_id=excluded.auth_user_id, status='active', tools=excluded.tools`, [AG]);
await c.query(`insert into public.community_posts (id, author_id, content, audience) values
  ('e1000000-0000-4000-8000-000000000001',$1,'[TEST CRM] a masquer','public'),
  ('e1000000-0000-4000-8000-000000000002',$1,'[TEST CRM] visible','public')
  on conflict (id) do nothing`, [USER]);

console.log('\n1. M02/M03 — rôles, catalogue');
const roleRes = await as(SA, 'aal2', () => c.query(`select admin.my_role() as r, admin.solo_mode() as solo`));
ok('my_role = super_admin', roleRes.rows[0].r === 'super_admin', roleRes.rows[0].r);
ok('solo_mode = false (3 comptes actifs)', roleRes.rows[0].solo === false, roleRes.rows[0].solo);

const aal1 = await as(SA, 'aal1', () => err(() => c.query(`select admin.inbox()`)));
ok('aal1 refusé sur inbox', aal1 && aal1.code === '42501' && aal1.hint === 'mfa_required', aal1 && aal1.hint);

const notStaff = await as(USER, 'aal2', () => err(() => c.query(`select admin.inbox()`)));
ok('non-équipe refusé', notStaff && notStaff.code === '42501', notStaff && notStaff.hint);

const cat = await as(SA, 'aal2', () => c.query(`select admin.commands_catalog() as j`));
const catJ = cat.rows[0].j;
ok('catalogue : 144 commandes', catJ.commands.length === 144, catJ.commands.length);
ok('catalogue : 7 pôles', catJ.poles.length === 7, catJ.poles.length);
ok('catalogue : 14 motifs', catJ.reasons.length === 14, catJ.reasons.length);

console.log('\n2. M13 — moteur de commande');
const hide = await as(MOD, 'aal2', () => c.query(`select admin.run_command('post_hide',$1::jsonb) as j`,
  [JSON.stringify({ target_id: 'e1000000-0000-4000-8000-000000000001', reason_code: 'spam' })]));
ok('post_hide ok', hide.rows[0].j.ok === true, JSON.stringify(hide.rows[0].j).slice(0,200));
ok('post_hide audit_id', typeof hide.rows[0].j.audit_id === 'number', hide.rows[0].j.audit_id);

const hidden = await c.query(`select moderation_state, moderated_by from public.community_posts where id='e1000000-0000-4000-8000-000000000001'`);
ok('contenu masqué en base', hidden.rows[0].moderation_state === 'hidden', hidden.rows[0].moderation_state);

const noReason = await as(MOD, 'aal2', () => err(() => c.query(`select admin.run_command('post_hide',$1::jsonb)`,
  [JSON.stringify({ target_id: 'e1000000-0000-4000-8000-000000000002' })])));
ok('motif manquant refusé', noReason && noReason.hint === 'reason_required', noReason && noReason.hint);

const agentOnOther = await as(AG, 'aal2', () => err(() => c.query(`select admin.run_command('member_ban',$1::jsonb)`,
  [JSON.stringify({ target_id: USER, reason_code: 'spam' })])));
ok('agent hors liste refusé', agentOnOther && ['agent_not_allowed','not_allowed'].includes(agentOnOther.hint), agentOnOther && agentOnOther.hint);

const memberOnResp = await as(MOD, 'aal2', () => err(() => c.query(`select admin.run_command('post_remove',$1::jsonb)`,
  [JSON.stringify({ target_id: 'e1000000-0000-4000-8000-000000000002', reason_code: 'spam' })])));
ok('membre (role_min resp.) refusé', memberOnResp && memberOnResp.hint === 'role_too_low', memberOnResp && memberOnResp.hint);

console.log('\n3. M04/M13 — demandes à deux personnes');
const req = await as(SA, 'aal2', () => c.query(`select admin.run_command('member_ban',$1::jsonb) as j`,
  [JSON.stringify({ target_id: USER, reason_code: 'spam' })]));
const reqJ = req.rows[0].j;
ok('member_ban crée une demande', reqJ.ok === true && !!reqJ.request_id, JSON.stringify(reqJ).slice(0,200));
const reqId = reqJ.request_id;
const fp = await c.query(`select left(fingerprint,8) as conf from admin.requests where id=$1`, [reqId]);

const selfApprove = await as(SA, 'aal2', () => err(() => c.query(`select admin.approve_request($1,$2)`, [reqId, fp.rows[0].conf])));
ok('auto-validation refusée hors solo', selfApprove && selfApprove.hint === 'self_approval', selfApprove && selfApprove.hint);

const badConf = await as(SA2, 'aal2', () => err(() => c.query(`select admin.approve_request($1,'xxxxxxxx')`, [reqId])));
ok('confirmation fausse refusée', badConf && badConf.hint === 'fingerprint_mismatch', badConf && badConf.hint);

const agentApprove = await as(AG, 'aal2', () => err(() => c.query(`select admin.approve_request($1,$2)`, [reqId, fp.rows[0].conf])));
ok('agent ne valide jamais', agentApprove && agentApprove.hint === 'agent_cannot_validate', agentApprove && agentApprove.hint);

const okApprove = await as(SA2, 'aal2', () => c.query(`select admin.approve_request($1,$2) as j`, [reqId, fp.rows[0].conf]));
ok('second humain valide', ['executed','approved'].includes(okApprove.rows[0].j.status), JSON.stringify(okApprove.rows[0].j).slice(0,200));
// member_ban a un effet externe (bannissement Auth) : la route clôt la demande.
const closed = await as(SA2, 'aal2', () => c.query(`select admin.complete_request($1, '{"ok":true}'::jsonb) as j`, [reqId]));
ok('complete_request clôt', closed.rows[0].j.status === 'executed', JSON.stringify(closed.rows[0].j).slice(0,160));
const banned = await c.query(`select account_status from public.user_profiles where id=$1`, [USER]);
ok('bannissement appliqué', banned.rows[0].account_status === 'banned', banned.rows[0].account_status);

console.log('\n4. M05 — verrou de modération');
const authorRetry = await as(USER, 'aal2', () => err(() => c.query(`update public.community_posts set moderation_state='visible' where id='e1000000-0000-4000-8000-000000000001'`)));
ok('auteur ne peut pas se réafficher', authorRetry && authorRetry.code === '42501', authorRetry && authorRetry.hint);

const authorEdit = await as(USER, 'aal2', () => err(() => c.query(`update public.community_posts set content='edite' where id='e1000000-0000-4000-8000-000000000002'`)));
ok('auteur édite son contenu visible', authorEdit === null, authorEdit && authorEdit.message);

console.log('\n5. M13 — annulation 10 s');
const undoId = hide.rows[0].j.audit_id;
const undo = await as(MOD, 'aal2', () => c.query(`select admin.undo($1) as j`, [undoId]));
ok('undo ok', undo.rows[0].j.ok === true, JSON.stringify(undo.rows[0].j).slice(0,200));
const restored = await c.query(`select moderation_state from public.community_posts where id='e1000000-0000-4000-8000-000000000001'`);
ok('état restauré', restored.rows[0].moderation_state === 'visible', restored.rows[0].moderation_state);

console.log('\n6. M07/M09/M11/M14 — vues');
const inbox = await as(SA, 'aal2', () => c.query(`select admin.inbox() as j`));
ok('inbox rend des items', Array.isArray(inbox.rows[0].j.items), JSON.stringify(inbox.rows[0].j).slice(0,160));
const m360 = await as(SA, 'aal2', () => c.query(`select admin.member_360($1) as j`, [USER]));
ok('member_360 ok', m360.rows[0].j.profile.id === USER, JSON.stringify(m360.rows[0].j).slice(0,160));
const mask = await as(SA, 'aal2', () => c.query(`select admin.member_360($1) as j`, [USER]));
ok('email masqué', (mask.rows[0].j.profile.emailMasked || '').includes('***'), mask.rows[0].j.profile.emailMasked);
const pii = await as(SA, 'aal2', () => c.query(`select admin.reveal_pii($1,'controle de test') as j`, [USER]));
ok('reveal_pii journalisé', pii.rows[0].j.audit_id > 0, JSON.stringify(pii.rows[0].j).slice(0,160));
const poles = await as(SA, 'aal2', () => c.query(`select admin.poles_summary() as j`));
ok('poles_summary 7 pôles', poles.rows[0].j.poles.length === 7, poles.rows[0].j.poles.length);
const tech = await as(SA, 'aal2', () => c.query(`select admin.technique_status() as j`));
ok('technique_status ok', tech.rows[0].j && tech.rows[0].j.realtime, JSON.stringify(tech.rows[0].j).slice(0,160));
const agents = await as(SA, 'aal2', () => c.query(`select admin.agents_overview() as j`));
ok('agents_overview liste les agents', agents.rows[0].j.agents.length >= 6, agents.rows[0].j.agents.length);
const auditp = await as(SA, 'aal2', () => c.query(`select admin.audit_page(null, 5, '{}'::jsonb) as j`));
ok('audit_page pagine', Array.isArray(auditp.rows[0].j.rows), JSON.stringify(auditp.rows[0].j).slice(0,160));

console.log('\n7. M08 — recours');
// Décision rendue sur le MEMBRE (ban) : c'est l'entrée d'audit que le membre contestera.
const banAudit = await c.query(`select id from admin.audit_log where action='member_ban' and second_approver_id is not null order by id asc limit 1`);
const appeal = await as(USER, 'aal2', () => err(() => c.query(`select admin.appeal_submit($1,'je conteste ce bannissement')`, [banAudit.rows[0].id])));
ok('recours déposé par la personne visée', appeal === null, appeal && appeal.message);
// L'auteur de la décision (SA) ne peut pas trancher.
const appealSelf = await as(SA, 'aal2', () => err(() => c.query(`select admin.appeal_decide((select id from admin.appeals limit 1),'rejected','maintenu')`)));
ok('décideur ne tranche pas son recours', appealSelf && appealSelf.hint === 'self_approval', appealSelf && appealSelf.hint);
// Un autre humain tranche.
const appealOther = await as(SA2, 'aal2', () => c.query(`select admin.appeal_decide((select id from admin.appeals limit 1),'accepted','reexamen') as j`));
ok('un autre humain tranche', appealOther.rows[0].j.status === 'accepted', JSON.stringify(appealOther.rows[0].j));
// Un contenu modéré : l'auteur peut contester.
const hideAudit = await c.query(`select id from admin.audit_log where action='post_hide' order by id desc limit 1`);
const appealContent = await as(USER, 'aal2', () => err(() => c.query(`select admin.appeal_submit($1,'mon contenu etait conforme')`, [hideAudit.rows[0].id])));
ok('auteur du contenu modéré peut contester', appealContent === null, appealContent && appealContent.message);

console.log('\n8. M14 — agents');
const authz = await as(AG, 'aal2', () => c.query(`select admin.agent_authorize('post_hide') as j`));
ok('agent_authorize ok', authz.rows[0].j.ok === true, JSON.stringify(authz.rows[0].j).slice(0,160));
const rate = await c.query(`select count(*)::int as n from admin.agent_rate`);
ok('plafond consommé', rate.rows[0].n >= 1, rate.rows[0].n);

console.log('\n9. M11 — purge (service)');
await c.query(`set local role service_role`);
const purge = await c.query(`select admin.purge_logs(90) as j`).catch(e => ({ rows: [{ j: { error: e.message } }] }));
await c.query('reset role');
ok('purge_logs exécutable', purge.rows[0].j && purge.rows[0].j.ok === true, JSON.stringify(purge.rows[0].j).slice(0,200));

console.log('\n10. M06 — statut de compte');
const beforeWrite = await c.query(`select public.account_can_write() as w`);
ok('hors session : account_can_write faux', beforeWrite.rows[0].w === false, beforeWrite.rows[0].w);
const modWrite = await as(MOD, 'aal2', () => c.query(`select public.account_can_write() as w`));
ok('compte actif : écriture possible', modWrite.rows[0].w === true, modWrite.rows[0].w);

console.log(`\n${pass} ok, ${fail} échec(s)`);
await c.end();
process.exit(fail ? 1 : 0);
