// ==============================================================================
// Step 11B: Workflow Tracker Tabs & User Performance Tracker Self-Test
// Tests:
// 1. Live performance endpoint (GET /api/performance/hr)
// 2. Metrics accuracy against manually calculated values:
//    - On-time rate = items provided on or before joining_date + target day
//      (code 0, machine 1, login 1, sim 2, idcard 3, docs_to_ho 5)
//    - Overdue items = items not provided where today is past target day
//    - Joiner emails sent out of joiners (email_status 'sent')
//    - Average days from joining date to the day all 6 items were provided
// 3. Flag thresholds:
//    - 85%+ -> "On track"
//    - 65% to 84% -> "Watch"
//    - < 65% -> "Needs action"
//    - < 4 joiners -> "Low volume"
// 4. Role-based scoping & access control:
//    - Super Admin: full access across all zones/branches
//    - Zonal HR Manager: strictly scoped to their assigned zone (out-of-zone 403)
//    - Branch Manager: 403 Forbidden
//    - Central HR: 403 Forbidden
// 5. Empty data filtering returns clean zeroed KPI metrics, not errors
// 6. Strict cleanup of temporary test entities (audit_logs strictly preserved)
// ==============================================================================

import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const sbUrl = process.env.VITE_SUPABASE_URL!;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sbAdmin = createClient(sbUrl, sbKey);
const authClient = createClient(sbUrl, process.env.VITE_SUPABASE_ANON_KEY!);
const BASE_URL = 'http://localhost:3000';

async function runStep11BSelfTest() {
  console.log('================================================================');
  console.log('  STARTING STEP 11B: USER PERFORMANCE TRACKER SELF-TEST SUITE');
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

  // 1. Authenticate Personas
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
  if (zErr || !zonalNorthAuth.session) throw new Error(`Zonal North login failed: ${zErr?.message}`);
  const zonalNorthToken = zonalNorthAuth.session.access_token;

  const { data: bmLahoreAuth, error: bmErr } = await authClient.auth.signInWithPassword({
    email: 'bm.lahore@postex.pk',
    password: 'PostExAdmin2026!',
  });
  if (bmErr || !bmLahoreAuth.session) throw new Error(`BM Lahore login failed: ${bmErr?.message}`);
  const bmLahoreToken = bmLahoreAuth.session.access_token;

  // Provision a temporary Central HR user to test HTTP 403
  const testSuffix = Date.now().toString().slice(-6);
  const testChrEmail = `chr.test.${testSuffix}@postex.pk`;
  const { data: chrAuthUser, error: chrCreateErr } = await sbAdmin.auth.admin.createUser({
    email: testChrEmail,
    password: 'PostExAdmin2026!',
    email_confirm: true,
  });
  if (chrCreateErr || !chrAuthUser.user) throw new Error(`Failed to create temp CHR: ${chrCreateErr?.message}`);

  const { data: centralRole } = await sbAdmin.from('roles').select('id').eq('name', 'central_hr').single();
  const { error: chrProfErr } = await sbAdmin.from('staff_profiles').insert({
    id: chrAuthUser.user.id,
    name: `Temp Central HR ${testSuffix}`,
    role_id: centralRole!.id,
    is_active: true,
  });
  if (chrProfErr) throw new Error(`Failed to create temp CHR profile: ${chrProfErr?.message}`);

  const { data: chrLogin, error: chrLogErr } = await authClient.auth.signInWithPassword({
    email: testChrEmail,
    password: 'PostExAdmin2026!',
  });
  if (chrLogErr || !chrLogin.session) throw new Error(`Temp CHR login failed: ${chrLogErr?.message}`);
  const chrToken = chrLogin.session.access_token;

  // 2. Access Control / RBAC Tests
  console.log('\n--- Step 2: Access Control & Authorization (RBAC) ---');
  // Branch Manager -> 403
  const bmRes = await fetch(`${BASE_URL}/api/performance/hr`, {
    headers: { Authorization: `Bearer ${bmLahoreToken}` },
  });
  assert(bmRes.status === 403, 'Branch Manager gets HTTP 403 on GET /api/performance/hr');

  // Central HR -> 403
  const chrRes = await fetch(`${BASE_URL}/api/performance/hr`, {
    headers: { Authorization: `Bearer ${chrToken}` },
  });
  assert(chrRes.status === 403, 'Central HR gets HTTP 403 on GET /api/performance/hr');

  // Super Admin -> 200
  const saRes = await fetch(`${BASE_URL}/api/performance/hr`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(saRes.status === 200, 'Super Admin gets HTTP 200 on GET /api/performance/hr');

  // Zonal HR -> 200 for own zone
  const zRes = await fetch(`${BASE_URL}/api/performance/hr`, {
    headers: { Authorization: `Bearer ${zonalNorthToken}` },
  });
  assert(zRes.status === 200, 'Zonal HR gets HTTP 200 on GET /api/performance/hr');

  // Zonal HR accessing Central Zone -> 403
  const { data: zones } = await sbAdmin.from('zones').select('id, name');
  const centralZone = zones?.find((z) => z.name.toLowerCase().includes('central'));
  const zOutOfScopeRes = await fetch(`${BASE_URL}/api/performance/hr?zone=${centralZone?.id}`, {
    headers: { Authorization: `Bearer ${zonalNorthToken}` },
  });
  assert(
    zOutOfScopeRes.status === 403,
    'Zonal HR gets HTTP 403 when requesting data outside their assigned zone'
  );

  // 3. Test Empty Data filtering returns clean zeroed KPI metrics
  console.log('\n--- Step 3: Empty Filter Handling ---');
  const emptyRes = await fetch(`${BASE_URL}/api/performance/hr?start_date=2099-01-01&end_date=2099-01-02`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const emptyData = await emptyRes.json();
  assert(
    emptyRes.status === 200 &&
      emptyData.success === true &&
      emptyData.kpi.joiners_handled === 0 &&
      emptyData.kpi.on_time_rate === 0 &&
      emptyData.kpi.overdue_items === 0 &&
      emptyData.scorecard.officers.length === 0,
    'Empty date range returns clean zeroed metrics without errors'
  );

  // 4. Test Attribution & Controlled Calculation
  console.log('\n--- Step 4: Provisioning Controlled Test Dataset ---');
  const northZone = zones?.find((z) => z.name.toLowerCase().includes('north'));
  const { data: branches } = await sbAdmin.from('branches').select('id, name').eq('zone_id', northZone!.id);
  const testBranch = branches?.[0];

  const { data: candidates } = await sbAdmin.from('candidates').select('id').limit(1);
  const candId = candidates?.[0]?.id || 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  // We will create 4 joiners attributed to Temp Central HR to test exact math:
  // Joiner 1: Joining date 2026-01-10. All 6 items provided on day 0 (2026-01-10).
  //           All on time (6/6). Days to all provided: 0 days. Email sent: true.
  // Joiner 2: Joining date 2026-01-10.
  //           - code: provided 2026-01-10 (target day 0) -> on time
  //           - machine: provided 2026-01-11 (target day 1) -> on time
  //           - login: provided 2026-01-11 (target day 1) -> on time
  //           - sim: provided 2026-01-15 (target day 2, provided on day 5) -> late (not on time)
  //           - idcard: provided 2026-01-13 (target day 3) -> on time
  //           - docs_to_ho: provided 2026-01-15 (target day 5) -> on time
  //           Total provided: 6/6. On time: 5/6. Days to all provided: 5 days. Email sent: true.
  // Joiner 3: Joining date 2026-01-10.
  //           - code: provided on-time (1/1)
  //           - 5 items not provided. Since 2026-01-10 target days (D0, D1, D1, D2, D3, D5) are in the past,
  //             the 5 unprovided items are overdue.
  //           Total provided: 1/6. On time: 1/6. Overdue: 5. Days to all: null. Email sent: false.
  // Joiner 4: Joining date 2026-01-10.
  //           - code: provided on-time (1/1)
  //           - machine: provided on-time (1/1)
  //           - login, sim, idcard, docs_to_ho not provided -> overdue: 4.
  //           Total provided: 2/6. On time: 2/6. Overdue: 4. Days to all: null. Email sent: false.
  //
  // MANUAL CALCULATION SUMMARY:
  // Joiners: 4
  // Total items: 4 * 6 = 24
  // Items provided: 6 + 6 + 1 + 2 = 15
  // Items on-time: 6 + 5 + 1 + 2 = 14
  // On-time rate: (14 / 24) * 100 = 58.3%
  // Overdue items: 0 + 0 + 5 + 4 = 9
  // Emails sent: 2 / 4
  // Joiners with all 6 provided: Joiner 1 (0 days), Joiner 2 (5 days).
  // Average days to all provided: (0 + 5) / 2 = 2.5 days
  // Flag threshold for 4 joiners and 58.3% on-time: "Needs action" (< 65%)

  console.log('MANUAL CALCULATION EXPECTATIONS:');
  console.log('  Joiners: 4');
  console.log('  Total Items: 24');
  console.log('  Items Provided: 15');
  console.log('  Items On-Time: 14');
  console.log('  Expected On-Time Rate: 58.3%');
  console.log('  Expected Overdue Items: 9');
  console.log('  Expected Emails Sent: 2 / 4');
  console.log('  Expected Avg Days to all 6 provided: 2.5 days');
  console.log('  Expected Flag: "Needs action" (<65%)\n');

  const createdAppIds: string[] = [];
  const createdEmpIds: string[] = [];

  for (let i = 1; i <= 4; i++) {
    const { data: appRow } = await sbAdmin
      .from('applications')
      .insert({
        candidate_id: candId,
        status: 'approved',
        assigned_central_hr_id: chrAuthUser.user.id,
        locked: true,
        decided_at: '2026-01-10T00:00:00Z',
      })
      .select('id')
      .single();
    createdAppIds.push(appRow!.id);

    const { data: empRow } = await sbAdmin
      .from('employees')
      .insert({
        application_id: appRow!.id,
        employee_id: `PX-TEST-11B-${testSuffix}-${i}`,
        full_name: `Test 11B Joiner ${i} ${testSuffix}`,
        cnic: `35201-${testSuffix}-${i}`,
        contact_number: '03001234567',
        designation_name: 'Operations Agent',
        zone_id: northZone!.id,
        branch_id: testBranch!.id,
        joining_date: '2026-01-10',
        status: 'active',
      })
      .select('id')
      .single();
    createdEmpIds.push(empRow!.id);
  }

  // Set up asset records
  // Joiner 1: all 6 provided on 2026-01-10
  const assetKeys = ['code', 'machine', 'login', 'sim', 'idcard', 'docs_to_ho'];
  for (const k of assetKeys) {
    await sbAdmin.from('employee_asset_status').insert({
      employee_id: createdEmpIds[0],
      item_key: k,
      state: 'provided',
      updated_at: '2026-01-10T12:00:00Z',
    });
  }
  await sbAdmin.from('joiner_asset_emails').insert({
    employee_id: createdEmpIds[0],
    subject: 'Onboarding assets dispatch notification',
    snapshot: {},
    status: 'sent',
    recipient_email: 'test@postex.pk',
    sent_at: '2026-01-10T12:00:00Z',
  });

  // Joiner 2: 5 on-time, 1 late (sim provided 2026-01-15, target D2 2026-01-12)
  for (const k of assetKeys) {
    const updatedAt = k === 'sim' ? '2026-01-15T12:00:00Z' : '2026-01-10T12:00:00Z';
    await sbAdmin.from('employee_asset_status').insert({
      employee_id: createdEmpIds[1],
      item_key: k,
      state: 'provided',
      updated_at: updatedAt,
    });
  }
  await sbAdmin.from('joiner_asset_emails').insert({
    employee_id: createdEmpIds[1],
    subject: 'Onboarding assets dispatch notification',
    snapshot: {},
    status: 'sent',
    recipient_email: 'test@postex.pk',
    sent_at: '2026-01-10T12:00:00Z',
  });

  // Joiner 3: 1 provided on-time, 5 unprovided
  await sbAdmin.from('employee_asset_status').insert({
    employee_id: createdEmpIds[2],
    item_key: 'code',
    state: 'provided',
    updated_at: '2026-01-10T12:00:00Z',
  });
  for (const k of ['machine', 'login', 'sim', 'idcard', 'docs_to_ho']) {
    await sbAdmin.from('employee_asset_status').insert({
      employee_id: createdEmpIds[2],
      item_key: k,
      state: 'not_provided',
      updated_at: '2026-01-10T12:00:00Z',
    });
  }

  // Joiner 4: 2 provided on-time, 4 unprovided
  for (const k of ['code', 'machine']) {
    await sbAdmin.from('employee_asset_status').insert({
      employee_id: createdEmpIds[3],
      item_key: k,
      state: 'provided',
      updated_at: '2026-01-10T12:00:00Z',
    });
  }
  for (const k of ['login', 'sim', 'idcard', 'docs_to_ho']) {
    await sbAdmin.from('employee_asset_status').insert({
      employee_id: createdEmpIds[3],
      item_key: k,
      state: 'not_provided',
      updated_at: '2026-01-10T12:00:00Z',
    });
  }

  // 5. Query endpoint and verify computed metrics
  console.log('--- Step 5: Verifying Real Computed API Response ---');
  const testRes = await fetch(`${BASE_URL}/api/performance/hr?start_date=2026-01-10&end_date=2026-01-10`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const testData = await testRes.json();

  assert(testRes.status === 200 && testData.success === true, 'Performance query succeeds with HTTP 200');

  const officerRow = (testData.scorecard?.officers || []).find((o: any) => o.id === chrAuthUser.user.id);
  assert(Boolean(officerRow), `HR officer row found for attributed user ${testChrEmail}`);

  if (officerRow) {
    console.log('\nCOMPUTED API METRICS FOR TEST OFFICER:');
    console.log(`  Joiners: ${officerRow.joiners_count}`);
    console.log(`  Total Items: ${officerRow.total_items}`);
    console.log(`  Items Provided: ${officerRow.items_provided}`);
    console.log(`  Items On-Time: ${officerRow.on_time_items}`);
    console.log(`  On-Time Rate: ${officerRow.on_time_rate}%`);
    console.log(`  Overdue Items: ${officerRow.overdue_items}`);
    console.log(`  Emails Sent: ${officerRow.emails_sent}/${officerRow.emails_total}`);
    console.log(`  Avg Days: ${officerRow.avg_days}`);
    console.log(`  Flag: "${officerRow.flag}"\n`);

    assert(officerRow.joiners_count === 4, 'Officer joiners count matches expected (4)');
    assert(officerRow.total_items === 24, 'Officer total items matches expected (24)');
    assert(officerRow.items_provided === 15, 'Officer items provided matches expected (15)');
    assert(officerRow.on_time_items === 14, 'Officer on-time items matches expected (14)');
    assert(officerRow.on_time_rate === 58.3, `Officer on-time rate matches expected (58.3%), got ${officerRow.on_time_rate}%`);
    assert(officerRow.overdue_items === 9, `Officer overdue items matches expected (9), got ${officerRow.overdue_items}`);
    assert(officerRow.emails_sent === 2, `Officer emails sent matches expected (2), got ${officerRow.emails_sent}`);
    assert(officerRow.avg_days === 2.5, `Officer avg days matches expected (2.5), got ${officerRow.avg_days}`);
    assert(officerRow.flag === 'Needs action', `Officer flag matches expected "Needs action", got "${officerRow.flag}"`);
  }

  // 6. Test Flag Thresholds Logic Function (85/84, 65/64, and <4 joiners)
  console.log('\n--- Step 6: Testing Flag Thresholds Boundary Rules ---');
  const { computePerformanceFlag } = await import('../src/server/performanceRoutes');

  assert(computePerformanceFlag(3, 100).label === 'Low volume', '3 joiners, 100% on-time -> "Low volume"');
  assert(computePerformanceFlag(1, 40).label === 'Low volume', '1 joiner, 40% on-time -> "Low volume"');
  assert(computePerformanceFlag(4, 85).label === 'On track', '4 joiners, 85.0% on-time -> "On track"');
  assert(computePerformanceFlag(4, 95).label === 'On track', '4 joiners, 95.0% on-time -> "On track"');
  assert(computePerformanceFlag(4, 84.9).label === 'Watch', '4 joiners, 84.9% on-time -> "Watch"');
  assert(computePerformanceFlag(4, 65).label === 'Watch', '4 joiners, 65.0% on-time -> "Watch"');
  assert(computePerformanceFlag(4, 64.9).label === 'Needs action', '4 joiners, 64.9% on-time -> "Needs action"');
  assert(computePerformanceFlag(4, 30).label === 'Needs action', '4 joiners, 30.0% on-time -> "Needs action"');

  // 7. Cleanup
  console.log('\n--- Step 7: Cleaning up temporary test fixtures (audit logs preserved) ---');
  await sbAdmin.from('joiner_asset_emails').delete().in('employee_id', createdEmpIds);
  await sbAdmin.from('employee_asset_status').delete().in('employee_id', createdEmpIds);
  await sbAdmin.from('employees').delete().in('id', createdEmpIds);
  await sbAdmin.from('applications').delete().in('id', createdAppIds);
  await sbAdmin.from('staff_profiles').delete().eq('id', chrAuthUser.user.id);
  await sbAdmin.auth.admin.deleteUser(chrAuthUser.user.id);
  console.log('Test fixtures cleaned up.');

  console.log('\n================================================================');
  console.log(`  STEP 11B SELF-TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runStep11BSelfTest().catch((err) => {
  console.error('Self-test suite error:', err);
  process.exit(1);
});
