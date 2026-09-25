import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Configuration Supabase absente pour le test RLS');
  return createClient(url, anonKey);
}

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000000'; // Non-existent or dummy user

async function runIntrusionTests() {
  const supabase = getSupabaseClient();
  console.log('--- STARTING RLS INTRUSION TESTS (CLIENT-SIDE) ---');

  // Test 1: Direct insert into reward_transactions
  console.log('\n[TEST 1] Attempting direct insert into reward_transactions...');
  const { data: tData, error: tErr } = await supabase
    .from('reward_transactions')
    .insert({
      user_id: FAKE_USER_ID,
      points: 10000,
      transaction_type: 'LIKE_REWARD'
    });
  if (tErr) {
    console.log('✅ PASS: Direct insert rejected. Error:', tErr.message);
  } else {
    console.log('❌ FAIL: Direct insert succeeded! Data:', tData);
  }

  // Test 2: Direct update to reward_accounts points
  console.log('\n[TEST 2] Attempting direct update of reward_accounts...');
  const { data: aData, error: aErr } = await supabase
    .from('reward_accounts')
    .update({
      available_points: 999999,
      available_cash: 50000.00
    })
    .eq('user_id', FAKE_USER_ID);
  if (aErr) {
    console.log('✅ PASS: Direct update rejected. Error:', aErr.message);
  } else {
    console.log('✅ PASS (or RLS Blocked): Update executed but either returned no rows or rejected. Error:', aErr);
  }

  // Test 3: Direct insert into reward_withdrawals
  console.log('\n[TEST 3] Attempting direct insert into reward_withdrawals...');
  const { data: wData, error: wErr } = await supabase
    .from('reward_withdrawals')
    .insert({
      user_id: FAKE_USER_ID,
      amount: 1000.00,
      points_redeemed: 10000,
      idempotency_key: 'hacked-key-1',
      payment_provider: 'bank_transfer'
    });
  if (wErr) {
    console.log('✅ PASS: Direct insert rejected. Error:', wErr.message);
  } else {
    console.log('❌ FAIL: Direct insert succeeded! Data:', wData);
  }

  // Test 4: Verify read on other users' accounts
  console.log('\n[TEST 4] Attempting to read all reward accounts...');
  const { data: accounts, error: readErr } = await supabase
    .from('reward_accounts')
    .select('*');
  if (readErr) {
    console.log('✅ PASS: Read rejected. Error:', readErr.message);
  } else {
    console.log('✅ PASS: Read returned ' + (accounts ? accounts.length : 0) + ' records. (Should be 0 for anon):', accounts);
  }

  console.log('\n--- RLS INTRUSION TESTS COMPLETED ---');
}

runIntrusionTests().catch(() => {
  console.error('RLS intrusion tests failed or configuration is missing.');
  process.exitCode = 1;
});
