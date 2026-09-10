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

const admin = createClient(readEnv('NEXT_PUBLIC_SUPABASE_URL'), readEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

const { data, error } = await admin
  .from('group_tasks')
  .update({ due_date: null })
  .eq('group_id', '00000000-0000-4000-8000-000000000001')
  .eq('title', 'Réserver les refuges')
  .select('id,title,due_date,status');
console.log(error ?? data);
process.exit(0);
