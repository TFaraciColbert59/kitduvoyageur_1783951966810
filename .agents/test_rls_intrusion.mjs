import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const FAKE_USER_ID = '00000000-0000-0000-0000-000000000000'; // Non-existent or dummy user

async function runIntrusionTests() {
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

runIntrusionTests();
