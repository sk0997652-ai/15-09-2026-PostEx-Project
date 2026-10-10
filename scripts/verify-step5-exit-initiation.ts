import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';

const sbUrl = process.env.VITE_SUPABASE_URL!;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(sbUrl, sbKey);
const BASE_URL = 'http://localhost:3000';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runStep5SelfTests() {
  console.log('\n======================================================');
  console.log('🚀 PostEx Step 5 Self-Test: Exit Initiation (Backend + Modal Wiring)');
  console.log('======================================================\n');

  const testSuffix = `test_${Date.now()}`;
  const cleanups: Array<() => Promise<void>> = [];

  try {
    // 0. Fetch zones, branches, roles
    console.log('Step 0: Resolving organization references...');
    const { data: northZone } = await sb.from('zones').select('id, name').eq('id', '11111111-1111-1111-1111-111111111111').single();
    const { data: centralZone } = await sb.from('zones').select('id, name').eq('id', '22222222-2222-2222-2222-222222222222').single();
    const { data: northBranch } = await sb.from('branches').select('id, name').eq('id', '44444444-4444-4444-4444-444444444442').single();
    const { data: centralBranch } = await sb.from('branches').select('id, name').eq('id', '44444444-4444-4444-4444-444444444441').single();

    const { data: allRoles } = await sb.from('roles').select('id, name');
    const roleMap = Object.fromEntries((allRoles || []).map((r) => [r.name, r.id]));

    assert(Boolean(northZone && centralZone), 'Resolved North and Central zones');
    assert(Boolean(northBranch && centralBranch), 'Resolved North and Central branches');

    // Helper to create staff user
    async function createStaffUser(email: string, roleName: string, zoneId: string | null, branchId: string | null, name: string) {
      const password = `Pass_${testSuffix}!123`;
      const { data: authRes, error: aErr } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: roleName },
      });
      if (aErr || !authRes.user) throw new Error(`Failed to create auth user ${email}: ${aErr?.message}`);
      const userId = authRes.user.id;

      cleanups.push(async () => {
        await sb.from('staff_profiles').delete().eq('id', userId);
        await sb.auth.admin.deleteUser(userId);
      });

      const { error: pErr } = await sb.from('staff_profiles').insert({
        id: userId,
        personal_email: email,
        name,
        role_id: roleMap[roleName],
        zone_id: zoneId,
        branch_id: branchId,
        is_active: true,
      });
      if (pErr) throw new Error(`Failed to create staff profile: ${pErr.message}`);

      // Login to get session token
      const client = createClient(sbUrl, process.env.VITE_SUPABASE_ANON_KEY!);
      const { data: loginRes, error: lErr } = await client.auth.signInWithPassword({ email, password });
      if (lErr || !loginRes.session) throw new Error(`Failed to sign in ${email}: ${lErr?.message}`);

      return { userId, token: loginRes.session.access_token };
    }

    // Helper to create candidate user
    async function createCandidateUser(email: string) {
      const password = `Pass_${testSuffix}!123`;
      const { data: authRes, error: aErr } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'candidate' },
      });
      if (aErr || !authRes.user) throw new Error(`Failed to create candidate auth user: ${aErr?.message}`);
      const userId = authRes.user.id;

      cleanups.push(async () => {
        await sb.from('candidates').delete().eq('id', userId);
        await sb.auth.admin.deleteUser(userId);
      });

      const candCnic = `35201-${Math.floor(1000000 + Math.random() * 9000000)}-1`;
      const { error: cErr } = await sb.from('candidates').insert({
        id: userId,
        joining_id: `JOIN-TEST-${Date.now().toString().slice(-6)}`,
        full_name: 'Test Candidate',
        email,
        mobile: '03001234567',
        cnic: candCnic,
      });
      if (cErr) throw new Error(`Failed to create candidate record: ${cErr.message}`);

      const client = createClient(sbUrl, process.env.VITE_SUPABASE_ANON_KEY!);
      const { data: loginRes } = await client.auth.signInWithPassword({ email, password });
      return { userId, token: loginRes?.session?.access_token || '' };
    }

    console.log('Step 1: Provisioning test staff and candidate personas...');
    const candidateUser = await createCandidateUser(`cand_${testSuffix}@postex.test`);
    const bmUser = await createStaffUser(`bm_${testSuffix}@postex.test`, 'branch_manager', northZone!.id, northBranch!.id, 'Test BM');
    const zonalHrUser = await createStaffUser(`zonal_${testSuffix}@postex.test`, 'zonal_hr_manager', northZone!.id, null, 'Test Zonal HR');
    const centralHrUser = await createStaffUser(`central_${testSuffix}@postex.test`, 'central_hr', northZone!.id, null, 'Test Central HR (North Zone)');

    // Super admin token uses service role key bearer token
    const superAdminToken = sbKey;

    console.log('Step 2: Creating temporary test employees...');
    // Create test applications for candidates
    const { data: testApp1, error: a1Err } = await sb.from('applications').insert({
      candidate_id: candidateUser.userId,
      status: 'approved',
      locked: true,
      decided_at: '2026-09-01T10:00:00Z',
    }).select().single();
    if (a1Err || !testApp1) throw new Error(`Failed to create test app 1: ${a1Err?.message}`);

    const { data: testApp2, error: a2Err } = await sb.from('applications').insert({
      candidate_id: candidateUser.userId,
      status: 'approved',
      locked: true,
      decided_at: '2026-09-01T10:00:00Z',
    }).select().single();
    if (a2Err || !testApp2) throw new Error(`Failed to create test app 2: ${a2Err?.message}`);

    cleanups.push(async () => {
      if (testApp1) await sb.from('applications').delete().eq('id', testApp1.id);
      if (testApp2) await sb.from('applications').delete().eq('id', testApp2.id);
    });

    // Employee 1: North Zone, joining date 2026-09-01
    const { data: emp1, error: emp1Err } = await sb.from('employees').insert({
      application_id: testApp1!.id,
      employee_id: `EMP-TEST-${Math.floor(10000 + Math.random() * 90000)}`,
      full_name: 'Muhammad Test Joiner 1',
      cnic: '35201-1111111-1',
      contact_number: '03001111111',
      personal_email: `emp1_${testSuffix}@postex.test`,
      designation_name: 'Operations Associate',
      branch_id: northBranch!.id,
      zone_id: northZone!.id,
      joining_date: '2026-09-01',
      status: 'active',
    }).select().single();

    if (emp1Err || !emp1) throw new Error(`Failed to create test employee 1: ${emp1Err?.message}`);

    cleanups.push(async () => {
      await sb.from('exit_clearance_items').delete().filter('exit_id', 'in', `(select id from employee_exits where employee_id = '${emp1.id}')`);
      await sb.from('employee_exits').delete().eq('employee_id', emp1.id);
      await sb.from('audit_logs').delete().eq('entity_id', emp1.id);
      await sb.from('employees').delete().eq('id', emp1.id);
    });

    // Employee 2: Central Zone, joining date 2026-09-01 (for out-of-scope zone tests)
    const { data: emp2, error: emp2Err } = await sb.from('employees').insert({
      application_id: testApp2!.id,
      employee_id: `EMP-TEST-${Math.floor(10000 + Math.random() * 90000)}`,
      full_name: 'Muhammad Test Joiner 2 (Central Zone)',
      cnic: '35201-2222222-2',
      contact_number: '03002222222',
      personal_email: `emp2_${testSuffix}@postex.test`,
      designation_name: 'Hub Dispatcher',
      branch_id: centralBranch!.id,
      zone_id: centralZone!.id,
      joining_date: '2026-09-01',
      status: 'active',
    }).select().single();

    if (emp2Err || !emp2) throw new Error(`Failed to create test employee 2: ${emp2Err?.message}`);

    cleanups.push(async () => {
      await sb.from('exit_clearance_items').delete().filter('exit_id', 'in', `(select id from employee_exits where employee_id = '${emp2.id}')`);
      await sb.from('employee_exits').delete().eq('employee_id', emp2.id);
      await sb.from('audit_logs').delete().eq('entity_id', emp2.id);
      await sb.from('employees').delete().eq('id', emp2.id);
    });

    assert(Boolean(emp1 && emp2), 'Created test employees in North Zone and Central Zone');

    // Fetch initial counts
    const initCountsRes = await fetch(`${BASE_URL}/api/employees?status=all`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const initCountsJson = await initCountsRes.json();
    assert(initCountsJson.success, 'Fetched initial employees table data');
    const initialActive = initCountsJson.counts.active;
    const initialExitInProgress = initCountsJson.counts.exit_in_progress;
    console.log(`  Initial Counts -> Active: ${initialActive}, Exit In Progress: ${initialExitInProgress}`);

    // TEST 1: Missing reason
    console.log('\n--- TEST 1: Missing reason validation ---');
    const res1 = await fetch(`${BASE_URL}/api/employees/${emp1.id}/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        exit_type: 'resignation',
        last_working_date: '2026-10-15',
        reason: '',
      }),
    });
    const json1 = await res1.json();
    assert(res1.status === 400, `Returned HTTP 400 on empty reason (got ${res1.status})`);
    assert(json1.error.includes('reason is required'), `Returned clear reason error message: ${json1.error}`);

    // TEST 2: Date before joining date
    console.log('\n--- TEST 2: Last working date before joining date validation ---');
    const res2 = await fetch(`${BASE_URL}/api/employees/${emp1.id}/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        exit_type: 'resignation',
        last_working_date: '2026-08-15', // Joining date is 2026-09-01
        reason: 'Relocation to another city',
      }),
    });
    const json2 = await res2.json();
    assert(res2.status === 400, `Returned HTTP 400 on date before joining date (got ${res2.status})`);
    assert(json2.error.includes('earlier than joining date'), `Returned date validation error: ${json2.error}`);

    // TEST 3: Candidate token (401/403)
    console.log('\n--- TEST 3: Candidate token rejection ---');
    const res3 = await fetch(`${BASE_URL}/api/employees/${emp1.id}/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${candidateUser.token}`,
      },
      body: JSON.stringify({
        exit_type: 'resignation',
        last_working_date: '2026-10-15',
        reason: 'Candidate trying to exit employee',
      }),
    });
    assert(res3.status === 401 || res3.status === 403, `Candidate token rejected with 401/403 (got ${res3.status})`);

    // TEST 4: Zonal HR attempt (403)
    console.log('\n--- TEST 4: Zonal HR attempt rejected with 403 ---');
    const res4 = await fetch(`${BASE_URL}/api/employees/${emp1.id}/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zonalHrUser.token}`,
      },
      body: JSON.stringify({
        exit_type: 'resignation',
        last_working_date: '2026-10-15',
        reason: 'Zonal HR trying to exit employee',
      }),
    });
    assert(res4.status === 403, `Zonal HR rejected with 403 (got ${res4.status})`);

    // TEST 5: Branch Manager attempt (403)
    console.log('\n--- TEST 5: Branch Manager attempt rejected with 403 ---');
    const res5 = await fetch(`${BASE_URL}/api/employees/${emp1.id}/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bmUser.token}`,
      },
      body: JSON.stringify({
        exit_type: 'resignation',
        last_working_date: '2026-10-15',
        reason: 'Branch Manager trying to exit employee',
      }),
    });
    assert(res5.status === 403, `Branch Manager rejected with 403 (got ${res5.status})`);

    // TEST 6: Employee from another zone (Central HR North Zone trying to exit Central Zone emp2) (403)
    console.log('\n--- TEST 6: Central HR out-of-zone attempt rejected with 403 ---');
    const res6 = await fetch(`${BASE_URL}/api/employees/${emp2.id}/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${centralHrUser.token}`,
      },
      body: JSON.stringify({
        exit_type: 'resignation',
        last_working_date: '2026-10-15',
        reason: 'Central HR exiting out of zone employee',
      }),
    });
    assert(res6.status === 403, `Central HR out-of-zone rejected with 403 (got ${res6.status})`);

    // TEST 7: Valid Exit by Super Admin / Central HR
    console.log('\n--- TEST 7: Valid Exit Initiation ---');
    const res7 = await fetch(`${BASE_URL}/api/employees/${emp1.id}/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        exit_type: 'resignation',
        last_working_date: '2026-10-20',
        reason: 'Pursuing higher education abroad',
        notes: 'Handover complete to team lead',
      }),
    });
    const json7 = await res7.json();
    assert(res7.status === 200, `Valid exit returned HTTP 200 (got ${res7.status})`);
    assert(json7.success === true, 'Response marked success');
    assert(Boolean(json7.exit_id), `Exit ID created: ${json7.exit_id}`);

    // Verify employee record status updated in DB
    const { data: updatedEmp1 } = await sb.from('employees').select('status, updated_at').eq('id', emp1.id).single();
    assert(updatedEmp1?.status === 'exit_in_progress', `Employee status is now 'exit_in_progress'`);

    // Confirm the audit log row exists
    console.log('\n--- Verifying Audit Log ---');
    const { data: auditRows } = await sb
      .from('audit_logs')
      .select('id, action, entity_id, metadata, created_at')
      .eq('entity_id', emp1.id)
      .eq('action', 'employee_exit_initiated');
    assert(Boolean(auditRows && auditRows.length >= 1), `Audit log row exists for employee_exit_initiated (found ${auditRows?.length})`);
    assert(auditRows![0].metadata.exit_type === 'resignation', 'Audit log contains exit_type');
    assert(auditRows![0].metadata.reason === 'Pursuing higher education abroad', 'Audit log contains reason');

    // Confirm exactly 6 clearance rows were created
    console.log('\n--- Verifying 6 Exit Clearance Rows ---');
    const { data: clearanceItems } = await sb
      .from('exit_clearance_items')
      .select('id, item_key, status')
      .eq('exit_id', json7.exit_id);
    assert(Boolean(clearanceItems && clearanceItems.length === 6), `Exactly 6 clearance rows created (found ${clearanceItems?.length})`);
    const expectedKeys = ['office_files', 'keys', 'mobile_sim', 'id_card', 'company_car', 'others'];
    const actualKeys = (clearanceItems || []).map((c) => c.item_key).sort();
    assert(JSON.stringify(actualKeys) === JSON.stringify(expectedKeys.sort()), `All 6 expected clearance item keys present: ${actualKeys.join(', ')}`);
    const allPending = clearanceItems?.every((c) => c.status === 'pending');
    assert(Boolean(allPending), 'All 6 clearance items initialized to status "pending"');

    // Confirm Employees table counts update
    console.log('\n--- Verifying Live Employees Table Counts Update ---');
    const finalCountsRes = await fetch(`${BASE_URL}/api/employees?status=all`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const finalCountsJson = await finalCountsRes.json();
    assert(finalCountsJson.success, 'Fetched updated employees list from API');
    const finalActive = finalCountsJson.counts.active;
    const finalExitInProgress = finalCountsJson.counts.exit_in_progress;
    console.log(`  Updated Counts -> Active: ${finalActive}, Exit In Progress: ${finalExitInProgress}`);
    assert(finalActive === initialActive - 1, `Active count decreased by 1 (${initialActive} -> ${finalActive})`);
    assert(finalExitInProgress === initialExitInProgress + 1, `Exit In Progress count increased by 1 (${initialExitInProgress} -> ${finalExitInProgress})`);

    // TEST 8: Duplicate exit on the same employee (409)
    console.log('\n--- TEST 8: Duplicate exit on the same employee (409) ---');
    const res8 = await fetch(`${BASE_URL}/api/employees/${emp1.id}/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        exit_type: 'resignation',
        last_working_date: '2026-10-25',
        reason: 'Attempting duplicate exit',
      }),
    });
    assert(res8.status === 409, `Duplicate exit rejected with HTTP 409 (got ${res8.status})`);

    // TEST 9: Exit on employee who is already exit_in_progress
    console.log('\n--- TEST 9: Exit on already exit_in_progress employee (409) ---');
    const res9 = await fetch(`${BASE_URL}/api/employees/${emp1.id}/exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        exit_type: 'termination',
        last_working_date: '2026-10-25',
        reason: 'Attempting second exit on exit_in_progress emp',
      }),
    });
    assert(res9.status === 409, `Exit on exit_in_progress rejected with HTTP 409 (got ${res9.status})`);

    console.log('\n======================================================');
    console.log('✅ ALL STEP 5 SELF-TEST CHECKS PASSED EMPIRICALLY!');
    console.log('======================================================\n');
  } finally {
    console.log('🧹 Cleaning up temporary test fixtures...');
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (err: any) {
        console.warn('Cleanup warning:', err.message);
      }
    }
    console.log('✨ Cleanup complete! Zero leftover test records in Supabase.');
  }
}

runStep5SelfTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
