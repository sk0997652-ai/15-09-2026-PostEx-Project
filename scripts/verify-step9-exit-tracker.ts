import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sbUrl = process.env.VITE_SUPABASE_URL!;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sbAdmin = createClient(sbUrl, sbKey);
const authClient = createClient(sbUrl, process.env.VITE_SUPABASE_ANON_KEY!);
const BASE_URL = 'http://localhost:3000';

async function runStep9Verification() {
  console.log('================================================================');
  console.log('  STARTING STEP 9: EXIT TRACKER & CLEARANCE FORM VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       Details: ${details}`);
      failed++;
    }
  }

  // Step 1: Sign in as test users
  console.log('--- Step 1: Authenticating Test Personas ---');
  const { data: adminAuth, error: aErr } = await authClient.auth.signInWithPassword({
    email: 'admin@postex.pk',
    password: 'PostExAdmin2026!',
  });
  if (aErr || !adminAuth.session) throw new Error(`Super admin login failed: ${aErr?.message}`);
  const adminToken = adminAuth.session.access_token;

  const { data: zonalNorthAuth, error: zErr } = await authClient.auth.signInWithPassword({
    email: 'zonal.north@postex.pk',
    password: 'PostExAdmin2026!',
  });
  if (zErr || !zonalNorthAuth.session) throw new Error(`Zonal HR North login failed: ${zErr?.message}`);
  const zonalNorthToken = zonalNorthAuth.session.access_token;

  const { data: bmLahoreAuth, error: bmErr } = await authClient.auth.signInWithPassword({
    email: 'bm.lahore@postex.pk',
    password: 'PostExAdmin2026!',
  });
  if (bmErr || !bmLahoreAuth.session) throw new Error(`BM Lahore login failed: ${bmErr?.message}`);
  const bmLahoreToken = bmLahoreAuth.session.access_token;

  // Step 2: Fetch branches
  console.log('--- Step 2: Resolving Branches & Zones ---');
  const { data: branches } = await sbAdmin
    .from('branches')
    .select('id, name, zone_id, zones(id, name)');
  const lahoreBranch = branches?.find((b) => b.name.includes('Lahore')) || branches?.[0];
  const islamabadBranch = branches?.find((b) => b.name.includes('Islamabad')) || branches?.[1];

  // Step 3: Create temporary test employees & initiate exits
  console.log('--- Step 3: Provisioning Temporary Test Employees & Exits ---');

  // Candidate 1 in Lahore (Central Zone)
  const candId1 = crypto.randomUUID();
  const appId1 = crypto.randomUUID();
  const empId1 = crypto.randomUUID();
  const exitId1 = crypto.randomUUID();

  await sbAdmin.from('candidates').insert({
    id: candId1,
    full_name: 'TEST Central Exit Candidate',
    cnic: `35201-${Math.floor(1000000 + Math.random() * 9000000)}-1`,
    mobile: `0300${Math.floor(1000000 + Math.random() * 9000000)}`,
    email: `test.exit1.${Date.now()}@postex.pk`,
    joining_id: `PX-EX1-${Math.floor(100000 + Math.random() * 900000)}`,
    branch_id: lahoreBranch.id,
    zone_id: lahoreBranch.zone_id,
  });

  await sbAdmin.from('applications').insert({
    id: appId1,
    candidate_id: candId1,
    status: 'approved',
    current_step: 3,
  });

  await sbAdmin.from('employees').insert({
    id: empId1,
    application_id: appId1,
    employee_id: `EMP-TEST-EX1-${Math.floor(1000 + Math.random() * 9000)}`,
    full_name: 'TEST Central Exit Employee',
    cnic: `35201-${Math.floor(1000000 + Math.random() * 9000000)}-1`,
    contact_number: '03001234567',
    personal_email: 'test.exit1@example.com',
    designation_name: 'Courier Rider',
    branch_id: lahoreBranch.id,
    zone_id: lahoreBranch.zone_id,
    joining_date: '2026-01-10',
    status: 'exit_in_progress',
  });

  await sbAdmin.from('employee_exits').insert({
    id: exitId1,
    employee_id: empId1,
    exit_type: 'resignation',
    last_working_date: '2026-03-31',
    reason: 'Career transition and personal reasons.',
    notes: 'Handover in progress.',
    status: 'in_progress',
    initiated_by_name: 'PostEx Super Admin HR',
    initiated_at: new Date().toISOString(),
  });

  // Seed 6 default pending clearance items for exit 1
  const initialClearanceKeys = ['office_files', 'keys', 'mobile_sim', 'id_card', 'company_car', 'others'];
  await sbAdmin.from('exit_clearance_items').insert(
    initialClearanceKeys.map((k) => ({
      exit_id: exitId1,
      item_key: k,
      status: 'pending',
      detail: null,
    }))
  );

  // Candidate 2 in Islamabad (North Zone)
  const candId2 = crypto.randomUUID();
  const appId2 = crypto.randomUUID();
  const empId2 = crypto.randomUUID();
  const exitId2 = crypto.randomUUID();

  await sbAdmin.from('candidates').insert({
    id: candId2,
    full_name: 'TEST North Exit Candidate',
    cnic: `35201-${Math.floor(1000000 + Math.random() * 9000000)}-2`,
    mobile: `0300${Math.floor(1000000 + Math.random() * 9000000)}`,
    email: `test.exit2.${Date.now()}@postex.pk`,
    joining_id: `PX-EX2-${Math.floor(100000 + Math.random() * 900000)}`,
    branch_id: islamabadBranch.id,
    zone_id: islamabadBranch.zone_id,
  });

  await sbAdmin.from('applications').insert({
    id: appId2,
    candidate_id: candId2,
    status: 'approved',
    current_step: 3,
  });

  await sbAdmin.from('employees').insert({
    id: empId2,
    application_id: appId2,
    employee_id: `EMP-TEST-EX2-${Math.floor(1000 + Math.random() * 9000)}`,
    full_name: 'TEST North Exit Employee',
    cnic: `35201-${Math.floor(1000000 + Math.random() * 9000000)}-2`,
    contact_number: '03007654321',
    personal_email: 'test.exit2@example.com',
    designation_name: 'Operations Assistant',
    branch_id: islamabadBranch.id,
    zone_id: islamabadBranch.zone_id,
    joining_date: '2026-02-01',
    status: 'exit_in_progress',
  });

  await sbAdmin.from('employee_exits').insert({
    id: exitId2,
    employee_id: empId2,
    exit_type: 'termination',
    last_working_date: '2026-04-15',
    reason: 'Contract completion.',
    status: 'in_progress',
    initiated_by_name: 'North Zonal HR Manager',
    initiated_at: new Date().toISOString(),
  });

  await sbAdmin.from('exit_clearance_items').insert(
    initialClearanceKeys.map((k) => ({
      exit_id: exitId2,
      item_key: k,
      status: 'pending',
      detail: null,
    }))
  );

  console.log(`Created test exits: Central Exit (${exitId1}), North Exit (${exitId2})\n`);

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Invalid item key returns 400
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Invalid item key returns 400 ---');
    const badKeyRes = await fetch(`${BASE_URL}/api/exits/${exitId1}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [{ item_key: 'invalid_checkpoint_name', status: 'received' }],
      }),
    });
    const badKeyJson = await badKeyRes.json();
    assert(badKeyRes.status === 400, 'Invalid item key returns HTTP 400');
    assert(badKeyJson.success === false, 'Invalid item key returns success: false');
    assert(
      badKeyJson.error && badKeyJson.error.includes('Invalid clearance item key'),
      'Clear error message describing allowed keys'
    );

    // ------------------------------------------------------------------------
    // TEST 2: 'pending' sent by client returns 400
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: "pending" status sent by client returns 400 ---');
    const pendingRes = await fetch(`${BASE_URL}/api/exits/${exitId1}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [{ item_key: 'office_files', status: 'pending' }],
      }),
    });
    const pendingJson = await pendingRes.json();
    assert(pendingRes.status === 400, 'Sending "pending" status returns HTTP 400');
    assert(pendingJson.success === false, 'Sending "pending" returns success: false');
    assert(
      pendingJson.error && pendingJson.error.includes('pending'),
      'Error message explicitly states "pending" cannot be submitted'
    );

    // ------------------------------------------------------------------------
    // TEST 3: Detail on a key that does not allow it returns 400
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Detail on non-allowed key returns 400 ---');
    const badDetailRes = await fetch(`${BASE_URL}/api/exits/${exitId1}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [{ item_key: 'office_files', status: 'received', detail: 'Stationery notes' }],
      }),
    });
    const badDetailJson = await badDetailRes.json();
    assert(badDetailRes.status === 400, 'Detail on office_files returns HTTP 400');
    assert(
      badDetailJson.error && badDetailJson.error.includes('Detail text is not permitted'),
      'Error message states detail is not permitted for this key'
    );

    // Test detail > 200 chars on mobile_sim returns 400
    const longDetailRes = await fetch(`${BASE_URL}/api/exits/${exitId1}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [{ item_key: 'mobile_sim', status: 'received', detail: 'A'.repeat(201) }],
      }),
    });
    const longDetailJson = await longDetailRes.json();
    assert(longDetailRes.status === 400, 'Detail exceeding 200 chars returns HTTP 400');
    assert(
      longDetailJson.error && longDetailJson.error.includes('200 characters'),
      'Error message states maximum length of 200 characters'
    );

    // ------------------------------------------------------------------------
    // TEST 4: Candidate token rejected with 401 or 403
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Candidate token rejected with 401/403 ---');
    const candRes = await fetch(`${BASE_URL}/api/exits/${exitId1}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid_or_candidate_token_xyz',
      },
      body: JSON.stringify({
        items: [{ item_key: 'office_files', status: 'received' }],
      }),
    });
    assert(candRes.status === 401 || candRes.status === 403, 'Unauthorized token returns 401 or 403');

    // ------------------------------------------------------------------------
    // TEST 5: Branch Manager write returns 403, read returns 200
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Branch Manager permissions (write: 403, read: 200) ---');
    const bmWriteRes = await fetch(`${BASE_URL}/api/exits/${exitId1}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bmLahoreToken}`,
      },
      body: JSON.stringify({
        items: [{ item_key: 'office_files', status: 'received' }],
      }),
    });
    assert(bmWriteRes.status === 403, 'Branch Manager write attempt returns HTTP 403');

    const bmReadRes = await fetch(`${BASE_URL}/api/exits?status=in_progress`, {
      headers: { Authorization: `Bearer ${bmLahoreToken}` },
    });
    const bmReadJson = await bmReadRes.json();
    assert(bmReadRes.status === 200, 'Branch Manager read GET /api/exits returns HTTP 200');
    const bmSeesCentral = bmReadJson.exits?.some((e: any) => e.id === exitId1);
    const bmSeesNorth = bmReadJson.exits?.some((e: any) => e.id === exitId2);
    assert(bmSeesCentral === true, 'Branch Manager sees exit from own branch (Lahore)');
    assert(bmSeesNorth === false, 'Branch Manager cannot see exit from other branch (Islamabad)');

    // ------------------------------------------------------------------------
    // TEST 6: Out-of-scope exit update returns 403
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Out-of-scope exit update returns 403 ---');
    const outOfScopeRes = await fetch(`${BASE_URL}/api/exits/${exitId1}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zonalNorthToken}`, // North Zonal HR trying to update Central exit
      },
      body: JSON.stringify({
        items: [{ item_key: 'office_files', status: 'received' }],
      }),
    });
    assert(outOfScopeRes.status === 403, 'Zonal HR updating exit outside zone returns HTTP 403');

    // ------------------------------------------------------------------------
    // TEST 7: Save partial clearance succeeds & audit log contains old and new values
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Save partial clearance & audit log verification ---');
    const partialRes = await fetch(`${BASE_URL}/api/exits/${exitId1}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [
          { item_key: 'office_files', status: 'received' },
          { item_key: 'keys', status: 'received' },
          { item_key: 'mobile_sim', status: 'received', detail: '0300-9876543' },
        ],
      }),
    });
    const partialJson = await partialRes.json();
    assert(partialRes.status === 200, 'Partial clearance update returns HTTP 200');
    assert(partialJson.success === true, 'Response returns success: true');

    // Verify GET /api/exits?status=in_progress clearance count
    const listRes1 = await fetch(`${BASE_URL}/api/exits?status=in_progress`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listJson1 = await listRes1.json();
    const centralExitRow1 = listJson1.exits?.find((e: any) => e.id === exitId1);
    assert(centralExitRow1?.clearance_filled === 3, 'Clearance count reflects 3/6 non-pending items');

    // Verify GET /api/exits/:id returns 6 items with updated values
    const getRes1 = await fetch(`${BASE_URL}/api/exits/${exitId1}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const getJson1 = await getRes1.json();
    assert(getRes1.status === 200, 'GET /api/exits/:id returns HTTP 200');
    assert(getJson1.exit?.clearance_items?.length === 6, 'GET /api/exits/:id returns all 6 items');
    const simItem = getJson1.exit?.clearance_items?.find((ci: any) => ci.item_key === 'mobile_sim');
    assert(simItem?.status === 'received', 'mobile_sim status is received');
    assert(simItem?.detail === '0300-9876543', 'mobile_sim detail matches saved phone number');

    // Verify audit log has old and new values
    const { data: auditLogs1 } = await sbAdmin
      .from('audit_logs')
      .select('*')
      .eq('entity_id', exitId1)
      .eq('action', 'exit_clearance_updated');

    assert((auditLogs1 || []).length >= 1, 'Audit log row created for exit_clearance_updated');
    const changes = auditLogs1?.[0]?.metadata?.changes || [];
    const simChange = changes.find((c: any) => c.item_key === 'mobile_sim');
    assert(simChange?.old_value === 'pending', 'Audit log records old_value: "pending"');
    assert(simChange?.new_value === 'received', 'Audit log records new_value: "received"');
    assert(simChange?.new_detail === '0300-9876543', 'Audit log records new_detail');

    // ------------------------------------------------------------------------
    // TEST 8: Save full clearance (6/6 items)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Save full clearance (6/6 items) ---');
    const fullRes = await fetch(`${BASE_URL}/api/exits/${exitId1}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [
          { item_key: 'office_files', status: 'received' },
          { item_key: 'keys', status: 'received' },
          { item_key: 'mobile_sim', status: 'received', detail: '0300-9876543' },
          { item_key: 'id_card', status: 'received' },
          { item_key: 'company_car', status: 'not_applicable' },
          { item_key: 'others', status: 'not_applicable' },
        ],
      }),
    });
    assert(fullRes.status === 200, 'Full clearance save returns HTTP 200');

    const listRes2 = await fetch(`${BASE_URL}/api/exits?status=in_progress`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listJson2 = await listRes2.json();
    const centralExitRow2 = listJson2.exits?.find((e: any) => e.id === exitId1);
    assert(centralExitRow2?.clearance_filled === 6, 'Clearance count reflects 6/6 items filled');

    // ------------------------------------------------------------------------
    // TEST 9: Completed exit returns 409
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 9: Completed exit returns 409 on update attempt ---');
    await sbAdmin.from('employee_exits').update({ status: 'completed' }).eq('id', exitId1);

    const completedRes = await fetch(`${BASE_URL}/api/exits/${exitId1}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [{ item_key: 'office_files', status: 'received' }],
      }),
    });
    const completedJson = await completedRes.json();
    assert(completedRes.status === 409, 'Updating completed exit returns HTTP 409');
    assert(
      completedJson.error && completedJson.error.includes('in_progress'),
      'Conflict error specifies only in_progress exits can be modified'
    );

    // ------------------------------------------------------------------------
    // TEST 10: Scope filtering on GET /api/exits
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 10: Scope filtering across Super Admin & Zonal HR ---');
    // North Zonal HR update to North exit succeeds
    const northUpdateRes = await fetch(`${BASE_URL}/api/exits/${exitId2}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zonalNorthToken}`,
      },
      body: JSON.stringify({
        items: [
          { item_key: 'office_files', status: 'received' },
          { item_key: 'company_car', status: 'received', detail: 'ISB-2026-4411' },
        ],
      }),
    });
    assert(northUpdateRes.status === 200, 'North Zonal HR update to in-zone exit returns HTTP 200');

    // North Zonal HR query to GET /api/exits returns ONLY North exit
    const zonalNorthListRes = await fetch(`${BASE_URL}/api/exits?status=in_progress`, {
      headers: { Authorization: `Bearer ${zonalNorthToken}` },
    });
    const zonalNorthListJson = await zonalNorthListRes.json();
    assert(zonalNorthListRes.status === 200, 'North Zonal HR GET /api/exits returns HTTP 200');
    const zonalSeesCentral = zonalNorthListJson.exits?.some((e: any) => e.id === exitId1);
    const zonalSeesNorth = zonalNorthListJson.exits?.some((e: any) => e.id === exitId2);
    assert(zonalSeesCentral === false, 'North Zonal HR cannot see Central exit');
    assert(zonalSeesNorth === true, 'North Zonal HR sees North exit');

  } finally {
    // Cleanup temporary test fixtures (never delete audit_logs rows!)
    console.log('\n--- Cleaning up temporary test fixtures (preserving audit logs) ---');
    await sbAdmin.from('exit_clearance_items').delete().in('exit_id', [exitId1, exitId2]);
    await sbAdmin.from('employee_exits').delete().in('id', [exitId1, exitId2]);
    await sbAdmin.from('employees').delete().in('id', [empId1, empId2]);
    await sbAdmin.from('applications').delete().in('id', [appId1, appId2]);
    await sbAdmin.from('candidates').delete().in('id', [candId1, candId2]);
    console.log('Cleanup complete.');
  }

  console.log('\n================================================================');
  console.log(`  STEP 9 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep9Verification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
