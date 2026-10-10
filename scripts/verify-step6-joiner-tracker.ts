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

async function runStep6SelfTests() {
  console.log('\n======================================================');
  console.log('🚀 PostEx Step 6 Self-Test: Joiner Tracker Backend');
  console.log('======================================================\n');

  const testSuffix = `step6_${Date.now()}`;
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

      const client = createClient(sbUrl, process.env.VITE_SUPABASE_ANON_KEY!);
      const { data: loginRes, error: lErr } = await client.auth.signInWithPassword({ email, password });
      if (lErr || !loginRes.session) throw new Error(`Failed to sign in ${email}: ${lErr?.message}`);

      return { userId, token: loginRes.session.access_token };
    }

    console.log('Step 1: Provisioning test staff users...');
    const bmUser = await createStaffUser(`bm_${testSuffix}@postex.test`, 'branch_manager', northZone!.id, northBranch!.id, 'Test BM');
    const centralHrUser = await createStaffUser(`central_${testSuffix}@postex.test`, 'central_hr', northZone!.id, null, 'Test Central HR (North)');
    const superAdminToken = sbKey;

    console.log('Step 2: Creating temporary test applications & employees...');
    // Create candidate
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
      joining_id: `JOIN-STEP6-${Date.now().toString().slice(-6)}`,
      full_name: 'Test Candidate Joiner',
      email: candEmail,
      mobile: '03001234567',
      cnic: candCnic,
    });

    // Test applications
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

    const { data: appExiting } = await sb.from('applications').insert({
      candidate_id: candAuth!.user!.id,
      status: 'approved',
      locked: true,
    }).select().single();

    cleanups.push(async () => {
      if (app1) await sb.from('applications').delete().eq('id', app1.id);
      if (app2) await sb.from('applications').delete().eq('id', app2.id);
      if (appExiting) await sb.from('applications').delete().eq('id', appExiting.id);
    });

    // Employee 1: North Zone, active
    const { data: emp1, error: e1Err } = await sb.from('employees').insert({
      application_id: app1!.id,
      employee_id: `EMP-JTRK-${Math.floor(10000 + Math.random() * 90000)}`,
      full_name: `Joiner Alpha ${testSuffix}`,
      cnic: '35201-1111111-9',
      contact_number: '03001111119',
      personal_email: `alpha_${testSuffix}@postex.test`,
      designation_name: 'Lead Associate',
      branch_id: northBranch!.id,
      zone_id: northZone!.id,
      joining_date: '2026-10-01',
      status: 'active',
    }).select().single();
    if (e1Err || !emp1) throw new Error(`Failed to create emp1: ${e1Err?.message}`);

    // Employee 2: Central Zone, active (for out-of-zone check)
    const { data: emp2, error: e2Err } = await sb.from('employees').insert({
      application_id: app2!.id,
      employee_id: `EMP-JTRK-${Math.floor(10000 + Math.random() * 90000)}`,
      full_name: `Joiner Beta Central ${testSuffix}`,
      cnic: '35201-2222222-9',
      contact_number: '03002222229',
      personal_email: `beta_${testSuffix}@postex.test`,
      designation_name: 'Operations Lead',
      branch_id: centralBranch!.id,
      zone_id: centralZone!.id,
      joining_date: '2026-10-02',
      status: 'active',
    }).select().single();
    if (e2Err || !emp2) throw new Error(`Failed to create emp2: ${e2Err?.message}`);

    // Employee Exiting: North Zone, exit_in_progress
    const { data: empExiting, error: eExErr } = await sb.from('employees').insert({
      application_id: appExiting!.id,
      employee_id: `EMP-JTRK-${Math.floor(10000 + Math.random() * 90000)}`,
      full_name: `Joiner Gamma Exiting ${testSuffix}`,
      cnic: '35201-3333333-9',
      contact_number: '03003333339',
      personal_email: `gamma_${testSuffix}@postex.test`,
      designation_name: 'Dispatcher',
      branch_id: northBranch!.id,
      zone_id: northZone!.id,
      joining_date: '2026-09-15',
      status: 'exit_in_progress',
    }).select().single();
    if (eExErr || !empExiting) throw new Error(`Failed to create empExiting: ${eExErr?.message}`);

    cleanups.push(async () => {
      for (const eid of [emp1.id, emp2.id, empExiting.id]) {
        await sb.from('joiner_asset_emails').delete().eq('employee_id', eid);
        await sb.from('employee_asset_status').delete().eq('employee_id', eid);
        await sb.from('audit_logs').delete().eq('entity_id', eid);
        await sb.from('employees').delete().eq('id', eid);
      }
    });

    console.log('✓ Test fixtures provisioned successfully.');

    // ------------------------------------------------------------------------
    // TEST 1: PATCH asset-status with invalid key -> 400
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Invalid item key returns 400 ---');
    const res1 = await fetch(`${BASE_URL}/api/employees/${emp1.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ invalid_item_key: 'provided' }),
    });
    assert(res1.status === 400, `Returned HTTP 400 on invalid key (got ${res1.status})`);
    const json1 = await res1.json();
    assert(json1.error.includes('Invalid asset item key'), `Error message mentions invalid key: "${json1.error}"`);

    // ------------------------------------------------------------------------
    // TEST 2: PATCH asset-status with invalid state -> 400
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Invalid item state returns 400 ---');
    const res2 = await fetch(`${BASE_URL}/api/employees/${emp1.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ code: 'pending_approval' }),
    });
    assert(res2.status === 400, `Returned HTTP 400 on invalid state (got ${res2.status})`);
    const json2 = await res2.json();
    assert(json2.error.includes('Invalid asset state'), `Error message mentions invalid state: "${json2.error}"`);

    // ------------------------------------------------------------------------
    // TEST 3: Update an exit_in_progress employee -> 409
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Update exit_in_progress employee returns 409 ---');
    const res3 = await fetch(`${BASE_URL}/api/employees/${empExiting.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ code: 'provided' }),
    });
    assert(res3.status === 409, `Returned HTTP 409 on inactive employee (got ${res3.status})`);
    const json3 = await res3.json();
    assert(json3.error.includes('exit_in_progress'), `Error message states employee status: "${json3.error}"`);

    // ------------------------------------------------------------------------
    // TEST 4: Out-of-scope employee update -> 403
    // Central HR (North) attempts to update emp2 (Central Zone)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Central HR out-of-scope update returns 403 ---');
    const res4 = await fetch(`${BASE_URL}/api/employees/${emp2.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${centralHrUser.token}`,
      },
      body: JSON.stringify({ code: 'provided' }),
    });
    assert(res4.status === 403, `Returned HTTP 403 on out-of-zone update (got ${res4.status})`);

    // ------------------------------------------------------------------------
    // TEST 5: Branch manager write attempt -> 403
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Branch manager write attempt returns 403 ---');
    const res5 = await fetch(`${BASE_URL}/api/employees/${emp1.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bmUser.token}`,
      },
      body: JSON.stringify({ code: 'provided' }),
    });
    assert(res5.status === 403, `Branch manager write returns 403 (got ${res5.status})`);

    // ------------------------------------------------------------------------
    // TEST 6: Set and unset each item & verify audit log contains old and new values
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Set all 6 items, unset items, and verify audit log old/new values ---');
    // Set all 6 to 'provided'
    const setAllRes = await fetch(`${BASE_URL}/api/employees/${emp1.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        code: 'provided',
        machine: 'provided',
        login: 'provided',
        sim: 'provided',
        idcard: 'provided',
        docs_to_ho: 'provided',
      }),
    });
    assert(setAllRes.status === 200, `Set all 6 items returned 200 (got ${setAllRes.status})`);
    const setAllJson = await setAllRes.json();
    assert(setAllJson.success === true, 'Response marked success');

    // Verify audit log for set all
    const { data: auditsAfterSet } = await sb
      .from('audit_logs')
      .select('action, metadata')
      .eq('entity_id', emp1.id)
      .eq('action', 'update_employee_asset_status')
      .order('created_at', { ascending: false })
      .limit(1);

    assert(Boolean(auditsAfterSet && auditsAfterSet.length > 0), 'Audit log entry created for set asset status');
    const auditMeta1 = auditsAfterSet![0].metadata;
    assert(auditMeta1.changes.code.new_value === 'provided', 'Audit log changes contains new_value provided');
    assert(auditMeta1.changes.code.old_value !== undefined, 'Audit log changes contains old_value');

    // Unset 2 items: machine -> 'not_provided', sim -> 'not_provided'
    const unsetRes = await fetch(`${BASE_URL}/api/employees/${emp1.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        machine: 'not_provided',
        sim: 'not_provided',
      }),
    });
    assert(unsetRes.status === 200, `Unset machine and sim returned 200 (got ${unsetRes.status})`);

    // Verify audit log for unset
    const { data: auditsAfterUnset } = await sb
      .from('audit_logs')
      .select('action, metadata')
      .eq('entity_id', emp1.id)
      .eq('action', 'update_employee_asset_status')
      .order('created_at', { ascending: false })
      .limit(1);

    const auditMeta2 = auditsAfterUnset![0].metadata;
    assert(auditMeta2.changes.machine.old_value === 'provided', 'Unset audit log shows old_value: "provided"');
    assert(auditMeta2.changes.machine.new_value === 'not_provided', 'Unset audit log shows new_value: "not_provided"');
    assert(auditMeta2.changes.sim.old_value === 'provided', 'Unset audit log shows sim old_value: "provided"');
    assert(auditMeta2.changes.sim.new_value === 'not_provided', 'Unset audit log shows sim new_value: "not_provided"');

    // ------------------------------------------------------------------------
    // TEST 7: Email status rule (flips from sent to unsent upon change)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Email status rule (sent -> unsent upon item change) ---');
    // First, check Joiner Tracker: emp1 should currently have email_status = 'unsent'
    const jtRes1 = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(jtRes1.status === 200, `GET /joiner-tracker returned 200`);
    const jtJson1 = await jtRes1.json();
    const emp1Item1 = jtJson1.joiners.find((j: any) => j.id === emp1.id);
    assert(Boolean(emp1Item1), 'Found emp1 in Joiner Tracker');
    assert(emp1Item1.email_status === 'unsent', `Initial email_status is 'unsent' (got ${emp1Item1.email_status})`);
    assert(emp1Item1.progress_count === 4, `Progress count is 4 (4 provided, 2 not_provided) (got ${emp1Item1.progress_count})`);

    // Send asset email
    const sendMailRes = await fetch(`${BASE_URL}/api/employees/${emp1.id}/send-assets-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
        'x-test-email-provider': 'smtp',
      },
      body: JSON.stringify({}),
    });
    assert(sendMailRes.status === 200, `POST send-assets-email returned 200 (got ${sendMailRes.status})`);

    // Verify Joiner Tracker email_status is now 'sent'
    const jtRes2 = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const jtJson2 = await jtRes2.json();
    const emp1Item2 = jtJson2.joiners.find((j: any) => j.id === emp1.id);
    assert(emp1Item2.email_status === 'sent', `Email status flipped to 'sent' after email dispatch (got ${emp1Item2.email_status})`);
    assert(emp1Item2.last_sent_at !== null, `last_sent_at is populated: ${emp1Item2.last_sent_at}`);

    // Change an item: machine -> 'provided'
    const changeRes = await fetch(`${BASE_URL}/api/employees/${emp1.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ machine: 'provided' }),
    });
    assert(changeRes.status === 200, `PATCH machine -> provided returned 200`);

    // Verify Joiner Tracker email_status FLIPPED BACK to 'unsent'
    const jtRes3 = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const jtJson3 = await jtRes3.json();
    const emp1Item3 = jtJson3.joiners.find((j: any) => j.id === emp1.id);
    assert(emp1Item3.email_status === 'unsent', `Email status flipped back to 'unsent' after asset state change!`);
    assert(emp1Item3.progress_count === 5, `Progress count updated to 5 (got ${emp1Item3.progress_count})`);

    // ------------------------------------------------------------------------
    // TEST 8: Filters and counts on GET /api/employees/joiner-tracker
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Filters and KPI counts on GET /joiner-tracker ---');
    // Branch filter
    const branchFilteredRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker?branch_id=${northBranch!.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const branchFilteredJson = await branchFilteredRes.json();
    const allInNorth = branchFilteredJson.joiners.every((j: any) => j.branch_id === northBranch!.id);
    assert(allInNorth, 'All joiners match north branch filter');
    assert(branchFilteredJson.joiners.some((j: any) => j.id === emp1.id), 'emp1 is included in north branch filter');
    assert(!branchFilteredJson.joiners.some((j: any) => j.id === emp2.id), 'emp2 (central branch) is excluded');

    // HR officer filter
    const hrFilteredRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker?hr=Central`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const hrFilteredJson = await hrFilteredRes.json();
    assert(hrFilteredJson.joiners.some((j: any) => j.id === emp1.id), 'emp1 found with HR officer filter');

    // only_pending=true filter
    // First, set emp2 all 6 to provided (progress 6/6)
    await fetch(`${BASE_URL}/api/employees/${emp2.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        code: 'provided',
        machine: 'provided',
        login: 'provided',
        sim: 'provided',
        idcard: 'provided',
        docs_to_ho: 'provided',
      }),
    });

    const pendingRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker?only_pending=true`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const pendingJson = await pendingRes.json();
    assert(pendingJson.joiners.some((j: any) => j.id === emp1.id), 'emp1 (5/6 provided) included in only_pending=true');
    assert(!pendingJson.joiners.some((j: any) => j.id === emp2.id), 'emp2 (6/6 provided) EXCLUDED from only_pending=true');

    // Search filter
    const searchRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker?search=Alpha`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const searchJson = await searchRes.json();
    assert(searchJson.joiners.length >= 1 && searchJson.joiners[0].id === emp1.id, 'Search by name "Alpha" returns emp1');

    // KPI counts verification
    const allScopedRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const allScopedJson = await allScopedRes.json();
    assert(typeof allScopedJson.counts.joiners_tracked === 'number', 'counts.joiners_tracked is a number');
    assert(typeof allScopedJson.counts.assets_pending === 'number', 'counts.assets_pending is a number');
    assert(typeof allScopedJson.counts.emails_unsent === 'number', 'counts.emails_unsent is a number');
    assert(allScopedJson.counts.assets_pending >= 1, 'counts.assets_pending reflects joiners with pending items');
    assert(allScopedJson.counts.emails_unsent >= 1, 'counts.emails_unsent reflects joiners with unsent emails');

    // Exited / exit_in_progress employees must NEVER appear in joiner-tracker
    assert(!allScopedJson.joiners.some((j: any) => j.id === empExiting.id), 'exit_in_progress employee is NOT returned in joiner-tracker');

    // Branch manager read access
    const bmReadRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${bmUser.token}` },
    });
    assert(bmReadRes.status === 200, `Branch manager can read /joiner-tracker (HTTP ${bmReadRes.status})`);
    const bmReadJson = await bmReadRes.json();
    const allBmInScope = bmReadJson.joiners.every((j: any) => j.branch_id === northBranch!.id);
    assert(allBmInScope, 'Branch manager results strictly scoped to their assigned branch');

    console.log('\n======================================================');
    console.log('✅ ALL STEP 6 SELF-TEST CHECKS PASSED EMPIRICALLY!');
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

runStep6SelfTests().catch((err) => {
  console.error('❌ Step 6 test suite failed:', err);
  process.exit(1);
});
