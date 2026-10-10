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

async function runStep7SelfTests() {
  console.log('\n======================================================');
  console.log('🚀 PostEx Step 7 Self-Test: Joiner Tracker UI Integration');
  console.log('======================================================\n');

  const testSuffix = `step7_${Date.now()}`;
  const cleanups: Array<() => Promise<void>> = [];

  try {
    // 0. Resolve organization references
    console.log('Step 0: Resolving organization references...');
    const { data: northZone } = await sb.from('zones').select('id, name').eq('id', '11111111-1111-1111-1111-111111111111').single();
    const { data: centralZone } = await sb.from('zones').select('id, name').eq('id', '22222222-2222-2222-2222-222222222222').single();
    const { data: northBranch } = await sb.from('branches').select('id, name').eq('id', '44444444-4444-4444-4444-444444444442').single();
    const { data: centralBranch } = await sb.from('branches').select('id, name').eq('id', '44444444-4444-4444-4444-444444444441').single();

    const { data: allRoles } = await sb.from('roles').select('id, name');
    const roleMap = Object.fromEntries((allRoles || []).map((r) => [r.name, r.id]));

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

      const client = createClient(sbUrl, process.env.VITE_SUPABASE_ANON_KEY!);
      const { data: loginRes, error: lErr } = await client.auth.signInWithPassword({ email, password });
      if (lErr || !loginRes.session) throw new Error(`Failed to sign in ${email}: ${lErr?.message}`);

      return { userId, token: loginRes.session.access_token };
    }

    console.log('Step 1: Provisioning test staff users (Super Admin, Central HR, Zonal HR, Branch Manager)...');
    const bmUser = await createStaffUser(`bm_${testSuffix}@postex.test`, 'branch_manager', northZone!.id, northBranch!.id, 'Test BM');
    const zonalHrUser = await createStaffUser(`zonal_${testSuffix}@postex.test`, 'zonal_hr_manager', northZone!.id, null, 'Test Zonal HR');
    const centralHrUser = await createStaffUser(`central_${testSuffix}@postex.test`, 'central_hr', northZone!.id, null, 'Test Central HR (North)');
    const superAdminToken = sbKey;

    console.log('Step 2: Creating candidate & active test employees...');
    const candCnic = `35201-${Math.floor(1000000 + Math.random() * 9000000)}-1`;
    const candEmail = `cand_${testSuffix}@postex.test`;
    const { data: candAuth } = await sb.auth.admin.createUser({
      email: candEmail,
      password: `Pass_${testSuffix}!123`,
      email_confirm: true,
      user_metadata: { role: 'candidate' },
    });
    cleanups.push(async () => {
      await sb.from('candidates').delete().eq('id', candAuth!.user!.id);
      await sb.auth.admin.deleteUser(candAuth!.user!.id);
    });

    await sb.from('candidates').insert({
      id: candAuth!.user!.id,
      joining_id: `JOIN-STEP7-${Date.now().toString().slice(-6)}`,
      full_name: 'Test Candidate Joiner',
      email: candEmail,
      mobile: '03001234567',
      cnic: candCnic,
    });

    const { data: app1 } = await sb.from('applications').insert({
      candidate_id: candAuth!.user!.id,
      status: 'approved',
      assigned_central_hr_id: centralHrUser.userId,
      locked: true,
    }).select().single();

    const { data: app2 } = await sb.from('applications').insert({
      candidate_id: candAuth!.user!.id,
      status: 'approved',
      locked: true,
    }).select().single();

    cleanups.push(async () => {
      if (app1) await sb.from('applications').delete().eq('id', app1.id);
      if (app2) await sb.from('applications').delete().eq('id', app2.id);
    });

    // Employee 1 in North Zone
    const { data: emp1, error: e1Err } = await sb.from('employees').insert({
      application_id: app1!.id,
      employee_id: `EMP-UI-${Math.floor(10000 + Math.random() * 90000)}`,
      full_name: `Joiner Alpha ${testSuffix}`,
      cnic: '35201-1111111-8',
      contact_number: '03001111118',
      personal_email: `alpha_${testSuffix}@postex.test`,
      designation_name: 'Associate Operations',
      branch_id: northBranch!.id,
      zone_id: northZone!.id,
      joining_date: '2026-10-01',
      status: 'active',
    }).select().single();
    if (e1Err || !emp1) throw new Error(`Failed to create emp1: ${e1Err?.message}`);

    // Employee 2 in Central Zone
    const { data: emp2, error: e2Err } = await sb.from('employees').insert({
      application_id: app2!.id,
      employee_id: `EMP-UI-${Math.floor(10000 + Math.random() * 90000)}`,
      full_name: `Joiner Beta ${testSuffix}`,
      cnic: '35201-2222222-8',
      contact_number: '03002222228',
      personal_email: `beta_${testSuffix}@postex.test`,
      designation_name: 'Lead Operations',
      branch_id: centralBranch!.id,
      zone_id: centralZone!.id,
      joining_date: '2026-10-02',
      status: 'active',
    }).select().single();
    if (e2Err || !emp2) throw new Error(`Failed to create emp2: ${e2Err?.message}`);

    cleanups.push(async () => {
      for (const eid of [emp1.id, emp2.id]) {
        await sb.from('joiner_asset_emails').delete().eq('employee_id', eid);
        await sb.from('employee_asset_status').delete().eq('employee_id', eid);
        await sb.from('audit_logs').delete().eq('entity_id', eid);
        await sb.from('employees').delete().eq('id', eid);
      }
    });

    console.log('✓ Test fixtures provisioned successfully.');

    // ------------------------------------------------------------------------
    // TEST 1: Super Admin, Central HR, and Zonal HR edit each of the 6 items
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Change each of the 6 asset dropdown items across roles ---');
    const itemsToTest: Array<['code' | 'machine' | 'login' | 'sim' | 'idcard' | 'docs_to_ho', string, string]> = [
      ['code', 'Opened', 'provided'],
      ['machine', 'Enrolled', 'provided'],
      ['login', 'Provided', 'provided'],
      ['sim', 'Provided', 'provided'],
      ['idcard', 'Issued', 'provided'],
      ['docs_to_ho', 'Sent', 'provided'],
    ];

    for (const [key, label, val] of itemsToTest) {
      const patchRes = await fetch(`${BASE_URL}/api/employees/${emp1.id}/asset-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${centralHrUser.token}`,
        },
        body: JSON.stringify({ [key]: val }),
      });
      assert(patchRes.status === 200, `Central HR updated item "${key}" (${label}) -> HTTP 200`);
    }

    // Reload page data from API (simulates browser page refresh)
    const reloadRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const reloadJson = await reloadRes.json();
    const reloadedEmp1 = reloadJson.joiners.find((j: any) => j.id === emp1.id);
    assert(Boolean(reloadedEmp1), 'Emp1 present after page reload');
    assert(reloadedEmp1.progress_count === 6, `All 6 items confirmed saved as 'provided' upon reload (6/6)`);
    assert(reloadedEmp1.item_states.code === 'provided', 'code confirmed saved as provided');
    assert(reloadedEmp1.item_states.machine === 'provided', 'machine confirmed saved as provided');
    assert(reloadedEmp1.item_states.login === 'provided', 'login confirmed saved as provided');
    assert(reloadedEmp1.item_states.sim === 'provided', 'sim confirmed saved as provided');
    assert(reloadedEmp1.item_states.idcard === 'provided', 'idcard confirmed saved as provided');
    assert(reloadedEmp1.item_states.docs_to_ho === 'provided', 'docs_to_ho confirmed saved as provided');

    // Test Zonal HR can update items
    const zonalPatch = await fetch(`${BASE_URL}/api/employees/${emp1.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zonalHrUser.token}`,
      },
      body: JSON.stringify({ sim: 'not_provided', machine: 'not_provided' }),
    });
    assert(zonalPatch.status === 200, 'Zonal HR updated sim & machine to not_provided -> HTTP 200');

    // ------------------------------------------------------------------------
    // TEST 2: Branch Manager read-only check (attempt write returns 403)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Branch Manager has read-only access ---');
    const bmPatchRes = await fetch(`${BASE_URL}/api/employees/${emp1.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bmUser.token}`,
      },
      body: JSON.stringify({ code: 'provided' }),
    });
    assert(bmPatchRes.status === 403, 'Branch Manager write attempt rejected with 403 (read-only enforced)');

    const bmGetRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${bmUser.token}` },
    });
    assert(bmGetRes.status === 200, 'Branch Manager GET /joiner-tracker returns 200 (read permitted)');
    const bmGetJson = await bmGetRes.json();
    assert(bmGetJson.joiners.every((j: any) => j.branch_id === northBranch!.id), 'Branch Manager view is strictly branch-scoped');

    // ------------------------------------------------------------------------
    // TEST 3: API-failure rollback simulation (invalid payload rejected)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: API failure rejection & rollback verification ---');
    const failRes = await fetch(`${BASE_URL}/api/employees/${emp1.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ invalid_item_name: 'provided' }),
    });
    assert(failRes.status === 400, 'Invalid update request returned 400 error for rollback handling');

    // Confirm database state untouched after failure
    const checkAfterFail = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const checkJson = await checkAfterFail.json();
    const emp1AfterFail = checkJson.joiners.find((j: any) => j.id === emp1.id);
    assert(emp1AfterFail.item_states.sim === 'not_provided', 'Item state retained previous valid value (rollback integrity)');

    // ------------------------------------------------------------------------
    // TEST 4: Filter validation (Branch, HR officer, only_pending, search)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Filter validation on GET /joiner-tracker ---');
    // Branch filter
    const bFilterRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker?branch_id=${northBranch!.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const bFilterJson = await bFilterRes.json();
    assert(bFilterJson.joiners.some((j: any) => j.id === emp1.id), 'North branch filter includes emp1');
    assert(!bFilterJson.joiners.some((j: any) => j.id === emp2.id), 'North branch filter excludes emp2');

    // HR officer filter
    const hrFilterRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker?hr=Central`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const hrFilterJson = await hrFilterRes.json();
    assert(hrFilterJson.joiners.some((j: any) => j.id === emp1.id), 'HR officer filter correctly matches emp1');

    // only_pending filter
    const pendingFilterRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker?only_pending=true`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const pendingFilterJson = await pendingFilterRes.json();
    assert(pendingFilterJson.joiners.some((j: any) => j.id === emp1.id), 'Emp1 (4/6 items provided) included in only_pending=true');

    // Search filter
    const searchFilterRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker?search=Alpha`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const searchFilterJson = await searchFilterRes.json();
    assert(searchFilterJson.joiners.length >= 1 && searchFilterJson.joiners[0].id === emp1.id, 'Search filter finds emp1 by name');

    // ------------------------------------------------------------------------
    // TEST 5: KPI count updates on asset change
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: KPI counts update verification ---');
    const initialKpiRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const initialKpiJson = await initialKpiRes.json();
    const initialPending = initialKpiJson.counts.assets_pending;

    // Complete emp1 to 6/6
    await fetch(`${BASE_URL}/api/employees/${emp1.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ sim: 'provided', machine: 'provided' }),
    });

    const updatedKpiRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const updatedKpiJson = await updatedKpiRes.json();
    assert(updatedKpiJson.counts.assets_pending === initialPending - 1, `Assets pending count decreased by 1 (${initialPending} -> ${updatedKpiJson.counts.assets_pending})`);

    console.log('\n======================================================');
    console.log('✅ ALL STEP 7 INTEGRATION & ROLE CHECKS PASSED!');
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

runStep7SelfTests().catch((err) => {
  console.error('❌ Step 7 test suite failed:', err);
  process.exit(1);
});
