/** Two real PostgreSQL connections; requires an EMPTY disposable local database. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const target = process.env.LOCAL_TEST_DATABASE_URL;
let parsed;
try { parsed = new URL(target); } catch { throw new Error('LOCAL_TEST_DATABASE_URL is required'); }
if (!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
    !/^\/lkdv_[a-z0-9_]*(test|replay)[a-z0-9_]*$/.test(parsed.pathname)) {
  throw new Error('Only a named disposable LKDV test/replay database on loopback is allowed');
}
const root = fileURLToPath(new URL('../../', import.meta.url));
const children = new Set();
function client(input, options = {}) {
  const child = spawn('psql', [target, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
    ...(options.file ? ['-f', options.file] : [])], {
    cwd: root,
    env: { PATH: process.env.PATH, PGCONNECT_TIMEOUT: '5', PGOPTIONS: '-c statement_timeout=10000 -c lock_timeout=8000' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  children.add(child);
  let stdout = '', stderr = '';
  child.stdout.on('data', (part) => { stdout += part; });
  child.stderr.on('data', (part) => { stderr += part; });
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Local PostgreSQL test timed out')); }, 20000);
    child.on('error', (error) => { clearTimeout(timer); children.delete(child); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer); children.delete(child);
      if (code !== 0 && !options.expectFailure) reject(new Error(`Local SQL failed: ${stderr.slice(-1500)}`));
      else resolve({ stdout: stdout.trim(), stderr, code });
    });
  });
  // A held connection can fail before the controller reaches its final await.
  // Attach a handler immediately; the original promise still rejects on await.
  void done.catch(() => {});
  if (input) child.stdin.write(input);
  if (!options.hold) child.stdin.end();
  return { child, done };
}
const sql = async (input) => (await client(input).done).stdout;
async function waitFor(query) {
  const until = Date.now() + 7000;
  while (Date.now() < until) {
    if ((await sql(query)) === 't') return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('Expected PostgreSQL concurrency state was not observed');
}
const owner = '11111111-1111-4111-8111-111111111111';
const creator = '22222222-2222-4222-8222-222222222222';
const product = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const kit = '33333333-3333-4333-8333-333333333333';
const order = '55555555-5555-4555-8555-555555555555';
const lines = JSON.stringify([{ product_id: product, quantity: 2, total_cents: 2500 }]);
const resume = `SELECT public.resume_stripe_checkout('${order}','cs_concurrent','${lines}',2500,'{"plan":"explorer"}');`;
try {
  await client('', { file: fileURLToPath(new URL('./stripe-checkout-resume.sql', import.meta.url)) }).done;
  await sql(`INSERT INTO auth.users VALUES ('${owner}'), ('${creator}');
    INSERT INTO public.user_profiles SELECT id FROM auth.users;
    INSERT INTO public.shop_products(id,name,slug,stock) VALUES ('${product}','Concurrent','concurrent',10);
    INSERT INTO public.materiel_kits VALUES ('${kit}','${creator}','${kit}');
    INSERT INTO public.materiel_kit_items VALUES ('${kit}','${product}');
    INSERT INTO public.hike_sessions VALUES ('44444444-4444-4444-8444-444444444444','${kit}',2);
    INSERT INTO public.orders(id,user_id,order_number,stripe_session_id,payment_method)
      VALUES ('${order}','${owner}','concurrent','cs_concurrent','card');`);

  const first = client(`SET application_name='lkdv-checkout-owner'; BEGIN;
    SELECT id FROM public.orders WHERE id='${order}' FOR UPDATE;\n`, { hold: true });
  await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='lkdv-checkout-owner' AND state='idle in transaction');");
  const second = client(`SET application_name='lkdv-checkout-contender'; ${resume}\n`);
  await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='lkdv-checkout-contender' AND wait_event_type='Lock');");
  first.child.stdin.end(`${resume} COMMIT;\n`);
  await Promise.all([first.done, second.done]);
  const effects = await sql(`SELECT (SELECT stock FROM public.shop_products WHERE id='${product}') = 8
    AND (SELECT count(*) FROM public.order_items WHERE order_id='${order}') = 1
    AND (SELECT count(*) FROM public.stock_movements WHERE reference_id='${order}') = 1
    AND (SELECT count(*) FROM public.order_encashment_events WHERE order_id='${order}') = 1;`);
  if (effects !== 't') throw new Error('Concurrent retries duplicated checkout effects');

  // Refund commits while attribution waits on the same order. Without the
  // wrapper guard this creates a fresh commission after reversal finished.
  const refund = client("SET application_name='lkdv-refund-owner'; BEGIN; SELECT public.reverse_kit_attribution_by_session('cs_concurrent');\n", { hold: true });
  await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='lkdv-refund-owner' AND state='idle in transaction');");
  const attribution = client(`SET application_name='lkdv-attribution-contender';
    SELECT public.insert_kit_attribution('${kit}',
      (SELECT id FROM public.order_items WHERE order_id='${order}'), '${product}',2500,300,
      '[{"beneficiary_id":"${creator}","generation_gap":0,"share_cents":75}]','${owner}');\n`);
  await waitFor("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='lkdv-attribution-contender' AND wait_event_type='Lock');");
  refund.child.stdin.end('COMMIT;\n');
  await Promise.all([refund.done, attribution.done]);
  if (await sql('SELECT count(*) FROM public.kit_attributions;') !== '0') {
    throw new Error('A late attribution survived the refund barrier');
  }
  console.log('PASS: SQL replay, concurrent checkout retry, and refund-before-attribution ordering');
} finally {
  for (const child of children) child.kill('SIGKILL');
}
