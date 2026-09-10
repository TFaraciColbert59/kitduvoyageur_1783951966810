import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

function readEnv(name) {
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

const sb = createServerClient(readEnv('NEXT_PUBLIC_SUPABASE_URL'), readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
  cookies: { getAll: () => [], setAll: () => {} },
});

const { data: auth } = await sb.auth.signInWithPassword({
  email: 'y-demo@lekitduvoyageur.fr',
  password: 'Ydemo!2026',
});
const userId = auth?.user?.id;
console.log('user', userId);

const { data: memberships } = await sb
  .from('group_members')
  .select('group_id, role, status, group:travel_groups(id,name,invite_code,departure_date,optimization_score)')
  .eq('user_id', userId);
console.log('memberships', JSON.stringify(memberships, null, 2));

const { data: profiles } = await sb.from('user_profiles').select('id,full_name').limit(15);
console.log('profiles (user rls)', JSON.stringify(profiles, null, 1));

const admin = createClient(readEnv('NEXT_PUBLIC_SUPABASE_URL'), readEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});
const { data: adminProfiles, error: adminErr } = await admin.from('user_profiles').select('id,full_name').limit(15);
console.log('profiles (admin err)', JSON.stringify(adminErr));
console.log('profiles (admin)', JSON.stringify(adminProfiles, null, 1));

for (const m of memberships ?? []) {
  const gid = m.group_id;
  const [{ data: members }, { data: tasks }, { data: expenses }, { data: kit }] = await Promise.all([
    sb.from('group_members').select('user_id, role, status, profile:user_profiles!group_members_user_id_fkey(full_name)').eq('group_id', gid),
    sb.from('group_tasks').select('id,title,status,due_date,assigned_to').eq('group_id', gid),
    sb.from('group_expenses').select('id,title,amount,status,paid_by,split_between').eq('group_id', gid),
    sb.from('group_kit_items').select('id,name,assigned_to,is_shared').eq('group_id', gid),
  ]);
  console.log(`\nGROUP ${gid}`, (m.group && m.group.name) || '');
  console.log(' members:', JSON.stringify(members, null, 1));
  console.log(' tasks:', JSON.stringify(tasks));
  console.log(' expenses:', JSON.stringify(expenses));
  console.log(' kit:', JSON.stringify(kit));
}
process.exit(0);
