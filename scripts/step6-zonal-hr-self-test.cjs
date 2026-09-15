/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * STEP 6 SELF-TEST SUITE: Zonal HR Manager Module
 * Tests:
 * 1. Zonal HR Authentication & Scope Resolution
 * 2. Zonal Metrics API (Zone Isolation & Turnaround Calculation)
 * 3. Cross-Zone Isolation Test (Denies access to other zones)
 * 4. Zone Staff Creation (Central HR & Branch Manager only)
 * 5. Scope Enforcement (Forbidden from creating Super Admin or Zonal HR)
 * 6. Temporary Password Regeneration & Policy Compliance
 * 7. Paginated Candidate Application Retrieval & CNIC Masking
 * 8. Central HR Application Reassignment with Audit Trail
 * 9. Zonal HR Override-Decision Hook (Approve/Reject/Correction) with Audit Trail
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

async function runStep6TestSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING STEP 6 SELF-TEST: ZONAL HR MANAGER MODULE');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------
    // Setup: Get or create 2 distinct zones and roles
    // -------------------------------------------------------------
    console.log('--- Phase 1: Environment & Multi-Zone Topology Setup ---');
    let { data: zones } = await supabaseAdmin
      .from('zones')
      .select('id, name')
      .order('name', { ascending: true });

    if (!zones || zones.length < 2) {
      console.log('  Seeding default zones for multi-zone test...');
      const { data: z1 } = await supabaseAdmin
        .from('zones')
        .upsert({ name: 'North Zone' }, { onConflict: 'name' })
        .select()
        .single();
      const { data: z2 } = await supabaseAdmin
        .from('zones')
        .upsert({ name: 'South Zone' }, { onConflict: 'name' })
        .select()
        .single();
      
      const { data: refreshedZones } = await supabaseAdmin
        .from('zones')
        .select('id, name')
        .order('name', { ascending: true });
      zones = refreshedZones || [z1, z2];
    }

    const zoneNorth = zones[0];
    const zoneSouth = zones[1];
    console.log(`  Zone A (Assigned): ${zoneNorth.name} (${zoneNorth.id})`);
    console.log(`  Zone B (Target/Cross-Zone): ${zoneSouth.name} (${zoneSouth.id})`);

    const { data: roles } = await supabaseAdmin.from('roles').select('id, name');
    const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id]));

    // Find branches in Zone A & Zone B
    let { data: branchesNorth } = await supabaseAdmin
      .from('branches')
      .select('id, name, zone_id')
      .eq('zone_id', zoneNorth.id);

    if (!branchesNorth || branchesNorth.length === 0) {
      const { data: newBr } = await supabaseAdmin
        .from('branches')
        .insert({ name: `${zoneNorth.name} Main Branch`, zone_id: zoneNorth.id, address: 'Lahore Hub' })
        .select()
        .single();
      branchesNorth = [newBr];
    }
    const branchA = branchesNorth[0];

    // Create or get Zonal HR Manager for Zone A
    const zonalEmail = `zonal.mgr.test.${Date.now()}@postex.pk`;
    const zonalPassword = 'ZonalTest#2026Password';

    const { data: zonalAuth, error: zonalAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: zonalEmail,
      password: zonalPassword,
      email_confirm: true,
      user_metadata: {
        name: 'Zonal HR Manager North',
        role: 'zonal_hr_manager',
        zone_id: zoneNorth.id,
      },
    });

    if (zonalAuthErr || !zonalAuth.user) {
      throw new Error('Failed to create test Zonal HR auth user: ' + zonalAuthErr?.message);
    }
    const zonalUserId = zonalAuth.user.id;

    await supabaseAdmin.from('staff_profiles').upsert({
      id: zonalUserId,
      name: 'Zonal HR Manager North',
      role_id: roleMap['zonal_hr_manager'],
      zone_id: zoneNorth.id,
      is_active: true,
      must_change_password: false,
    });

    // Obtain access token for Zonal HR Manager
    const anonClient = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: loginData, error: loginErr } = await anonClient.auth.signInWithPassword({
      email: zonalEmail,
      password: zonalPassword,
    });

    if (loginErr || !loginData.session) {
      throw new Error('Failed to login as Zonal HR user: ' + loginErr?.message);
    }
    const zonalToken = loginData.session.access_token;
    assert(Boolean(zonalToken), 'Zonal HR Manager authenticated successfully and acquired session token');

    // -------------------------------------------------------------
    // Test 1 & 2: Zonal Metrics API & Turnaround
    // -------------------------------------------------------------
    console.log('\n--- Phase 2: Zonal Metrics API & Zone Scoping ---');
    const PORT = 3000;
    const metricsRes = await fetch(`http://localhost:${PORT}/api/zonal/metrics`, {
      headers: {
        Authorization: `Bearer ${zonalToken}`,
      },
    });
    const metricsJson = await metricsRes.json();

    assert(metricsRes.status === 200 && metricsJson.success, 'GET /api/zonal/metrics returned 200 OK');
    assert(metricsJson.metrics.zoneId === zoneNorth.id, `Metrics are strictly scoped to Zone A (${zoneNorth.name})`);
    assert(typeof metricsJson.metrics.avgTurnaroundHours === 'string', 'Turnaround time calculation is present in metric payload');
    assert(Array.isArray(metricsJson.metrics.branches), 'Branches list for the zone is returned');

    // -------------------------------------------------------------
    // Test 3: Cross-Zone Isolation Test (RLS boundary check)
    // -------------------------------------------------------------
    console.log('\n--- Phase 3: Cross-Zone Isolation / Anti-Tampering ---');
    const crossZoneRes = await fetch(`http://localhost:${PORT}/api/zonal/metrics?zone_id=${zoneSouth.id}`, {
      headers: {
        Authorization: `Bearer ${zonalToken}`,
      },
    });
    const crossZoneJson = await crossZoneRes.json();
    assert(
      crossZoneRes.status === 403,
      `Cross-zone access denied (HTTP 403) when Zone A manager attempts to query Zone B (${crossZoneJson.error})`
    );

    // -------------------------------------------------------------
    // Test 4: Zone Staff Creation (Central HR & Branch Manager)
    // -------------------------------------------------------------
    console.log('\n--- Phase 4: Staff Creation Scoped to Zone ---');
    const centralHrEmail1 = `central.hr1.${Date.now()}@postex.pk`;
    const createStaffRes1 = await fetch(`http://localhost:${PORT}/api/zonal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zonalToken}`,
      },
      body: JSON.stringify({
        email: centralHrEmail1,
        name: 'Central HR Reviewer 1',
        role_name: 'central_hr',
        phone: '03001234567',
      }),
    });
    const createStaffJson1 = await createStaffRes1.json();
    assert(createStaffRes1.status === 201 && createStaffJson1.success, 'Central HR account created successfully in Zone A');
    assert(
      createStaffJson1.staff.zone_id === zoneNorth.id,
      'Central HR account is automatically bound to Zonal HR assigned zone'
    );
    assert(
      createStaffJson1.one_time_temporary_password &&
      createStaffJson1.one_time_temporary_password.length >= 10 &&
      /[A-Za-z]/.test(createStaffJson1.one_time_temporary_password) &&
      /[0-9]/.test(createStaffJson1.one_time_temporary_password),
      'Temporary password satisfies corporate policy (min 10 chars, letter + number)'
    );
    assert(createStaffJson1.staff.must_change_password === true, 'Account has must_change_password flag enabled');
    const centralHr1Id = createStaffJson1.staff.id;

    // Create 2nd Central HR in Zone A for reassignment testing
    const centralHrEmail2 = `central.hr2.${Date.now()}@postex.pk`;
    const createStaffRes2 = await fetch(`http://localhost:${PORT}/api/zonal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zonalToken}`,
      },
      body: JSON.stringify({
        email: centralHrEmail2,
        name: 'Central HR Reviewer 2',
        role_name: 'central_hr',
      }),
    });
    const createStaffJson2 = await createStaffRes2.json();
    assert(createStaffRes2.status === 201, 'Second Central HR created for workload reassignment tests');
    const centralHr2Id = createStaffJson2.staff.id;

    // Create Branch Manager in Zone A
    const bmEmail = `bm.test.${Date.now()}@postex.pk`;
    const createBmRes = await fetch(`http://localhost:${PORT}/api/zonal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zonalToken}`,
      },
      body: JSON.stringify({
        email: bmEmail,
        name: 'Branch Manager North 1',
        role_name: 'branch_manager',
        branch_id: branchA.id,
      }),
    });
    const createBmJson = await createBmRes.json();
    assert(createBmRes.status === 201 && createBmJson.staff.branch_id === branchA.id, 'Branch Manager created and bound to branch in Zone A');

    // -------------------------------------------------------------
    // Test 5: Role Escalation Prevention
    // -------------------------------------------------------------
    console.log('\n--- Phase 5: Role Escalation Prevention ---');
    const escalateRes = await fetch(`http://localhost:${PORT}/api/zonal/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zonalToken}`,
      },
      body: JSON.stringify({
        email: `fake.admin.${Date.now()}@postex.pk`,
        name: 'Unauthorized Admin Attempt',
        role_name: 'super_admin',
      }),
    });
    assert(
      escalateRes.status === 403,
      'Zonal HR is strictly forbidden from creating Super Admin or unauthorized roles (HTTP 403)'
    );

    // -------------------------------------------------------------
    // Test 5B: Strict Subordinate Staff List Filtering & Peer Isolation
    // -------------------------------------------------------------
    console.log('\n--- Phase 5B: Subordinate Staff List Filtering (Peer Isolation) ---');
    // Create a 2nd peer Zonal HR Manager in Zone A to test peer exclusion
    const peerZonalEmail = `peer.zonal.${Date.now()}@postex.pk`;
    const { data: peerAuth } = await supabaseAdmin.auth.admin.createUser({
      email: peerZonalEmail,
      password: 'PeerZonalTest#2026',
      email_confirm: true,
      user_metadata: { name: 'Peer Zonal HR', role: 'zonal_hr_manager', zone_id: zoneNorth.id },
    });
    const peerZonalId = peerAuth.user.id;
    await supabaseAdmin.from('staff_profiles').insert({
      id: peerZonalId,
      name: 'Peer Zonal HR',
      role_id: roleMap['zonal_hr_manager'],
      zone_id: zoneNorth.id,
      is_active: true,
    });

    const staffListRes = await fetch(`http://localhost:${PORT}/api/zonal/staff`, {
      headers: { Authorization: `Bearer ${zonalToken}` },
    });
    const staffListJson = await staffListRes.json();
    assert(staffListRes.status === 200 && staffListJson.success, 'GET /api/zonal/staff returned 200 OK');

    const foundSelf = staffListJson.staff.find((s) => s.id === zonalUserId);
    const foundPeer = staffListJson.staff.find((s) => s.id === peerZonalId);
    const nonSubordinates = staffListJson.staff.filter(
      (s) => !['central_hr', 'branch_manager'].includes(s.roles?.name)
    );

    assert(!foundSelf, '[HARD RULE] Zonal HR Manager themselves is EXCLUDED from subordinate staff list');
    assert(!foundPeer, '[HARD RULE] Peer Zonal HR Manager in same zone is EXCLUDED from subordinate staff list');
    assert(nonSubordinates.length === 0, '[HARD RULE] Staff list contains ZERO non-subordinate roles (no super_admin or zonal_hr_manager)');
    assert(
      staffListJson.staff.some((s) => s.id === centralHr1Id) && staffListJson.staff.some((s) => s.id === createBmJson.staff.id),
      'Staff list properly returns all Central HR and Branch Manager accounts in the zone'
    );

    // -------------------------------------------------------------
    // Test 6: Password Regeneration & Peer Protection
    // -------------------------------------------------------------
    console.log('\n--- Phase 6: Password Regeneration Flow & Peer Guard ---');
    // Attempting to regenerate password for peer Zonal HR MUST BE DENIED
    const peerRegenRes = await fetch(`http://localhost:${PORT}/api/zonal/staff/${peerZonalId}/regenerate-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${zonalToken}` },
    });
    assert(
      peerRegenRes.status === 403,
      '[HARD RULE] Zonal HR is strictly DENIED from regenerating password for peer Zonal HR (HTTP 403)'
    );

    // Valid subordinate Central HR password regeneration
    const regenRes = await fetch(`http://localhost:${PORT}/api/zonal/staff/${centralHr1Id}/regenerate-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${zonalToken}`,
      },
    });
    const regenJson = await regenRes.json();
    assert(regenRes.status === 200 && regenJson.success, 'POST /api/zonal/staff/:id/regenerate-password succeeds for Central HR');
    assert(
      regenJson.temporary_password && regenJson.temporary_password.length >= 10,
      'Regenerated password meets 10+ char policy requirements'
    );

    // -------------------------------------------------------------
    // Test 7: Paginated Applications & CNIC Masking
    // -------------------------------------------------------------
    console.log('\n--- Phase 7: Application Pipeline & CNIC Masking ---');
    // Create a candidate in Zone A and Zone B
    const rand7 = Math.floor(1000000 + Math.random() * 9000000);
    const candidateCnicNorth = `35201-${rand7}-1`;
    const candidateNorthId = crypto.randomUUID();
    const joiningIdNorth = `JID-N-${Date.now()}`;

    const { error: insNorthErr } = await supabaseAdmin.from('candidates').insert({
      id: candidateNorthId,
      full_name: 'Candidate North Test',
      cnic: candidateCnicNorth,
      mobile: '03009998877',
      email: `candidate.north.${Date.now()}@gmail.com`,
      joining_id: joiningIdNorth,
      zone_id: zoneNorth.id,
      branch_id: branchA.id,
    });
    if (insNorthErr) console.warn('Warning inserting north cand:', insNorthErr.message);

    const rand7S = Math.floor(1000000 + Math.random() * 9000000);
    const candidateSouthId = crypto.randomUUID();
    const { error: insSouthErr } = await supabaseAdmin.from('candidates').insert({
      id: candidateSouthId,
      full_name: 'Candidate South Test',
      cnic: `42101-${rand7S}-1`,
      mobile: '03219998877',
      email: `candidate.south.${Date.now()}@gmail.com`,
      joining_id: `JID-S-${Date.now()}`,
      zone_id: zoneSouth.id,
    });
    if (insSouthErr) console.warn('Warning inserting south cand:', insSouthErr.message);

    // Create applications for both
    const appNorthId = crypto.randomUUID();
    await supabaseAdmin.from('applications').insert({
      id: appNorthId,
      candidate_id: candidateNorthId,
      status: 'hr_review',
      current_step: 3,
      assigned_central_hr_id: centralHr1Id,
      submitted_at: new Date().toISOString(),
    });

    const appSouthId = crypto.randomUUID();
    await supabaseAdmin.from('applications').insert({
      id: appSouthId,
      candidate_id: candidateSouthId,
      status: 'hr_review',
      current_step: 3,
      submitted_at: new Date().toISOString(),
    });

    // Fetch applications as Zonal HR
    const appsRes = await fetch(`http://localhost:${PORT}/api/zonal/applications?limit=100`, {
      headers: {
        Authorization: `Bearer ${zonalToken}`,
      },
    });
    const appsJson = await appsRes.json();
    assert(appsRes.status === 200 && appsJson.success, 'GET /api/zonal/applications returned 200 OK');
    
    const foundNorth = appsJson.applications.find((a) => a.id === appNorthId);
    const foundSouth = appsJson.applications.find((a) => a.id === appSouthId);

    assert(Boolean(foundNorth), 'Zonal HR can see applications submitted within Zone A');
    assert(!foundSouth, 'Zonal HR CANNOT see applications belonging to other zones (RLS/Scoping enforced)');
    assert(
      foundNorth.candidate.masked_cnic === '35201-*****43-1' || foundNorth.candidate.masked_cnic.includes('*****'),
      `CNIC is properly masked for data privacy (${foundNorth.candidate.masked_cnic})`
    );

    // -------------------------------------------------------------
    // Test 8: Reassignment Action between Central HRs
    // -------------------------------------------------------------
    console.log('\n--- Phase 8: Central HR Reassignment Action ---');
    const reassignRes = await fetch(`http://localhost:${PORT}/api/zonal/applications/${appNorthId}/reassign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zonalToken}`,
      },
      body: JSON.stringify({
        new_central_hr_id: centralHr2Id,
        reason: 'Workload optimization for reviewer 1',
      }),
    });
    const reassignJson = await reassignRes.json();
    assert(reassignRes.status === 200 && reassignJson.success, 'POST /api/zonal/applications/:id/reassign succeeded');

    const { data: updatedApp } = await supabaseAdmin
      .from('applications')
      .select('assigned_central_hr_id')
      .eq('id', appNorthId)
      .single();

    assert(updatedApp.assigned_central_hr_id === centralHr2Id, 'Application assigned_central_hr_id updated to Central HR 2');

    const { data: reassignLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('entity_id', appNorthId)
      .eq('action', 'zonal_reassigned_reviewer');

    assert(reassignLogs && reassignLogs.length > 0, 'Permanent audit log recorded for the reviewer reassignment');

    // -------------------------------------------------------------
    // Test 9: Override Decision Hook (Approve with reason)
    // -------------------------------------------------------------
    console.log('\n--- Phase 9: Zonal HR Override-Decision Hook ---');
    const overrideReason = 'Zonal HR fast-track verified after priority client escalation';
    const overrideRes = await fetch(`http://localhost:${PORT}/api/zonal/applications/${appNorthId}/override-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${zonalToken}`,
      },
      body: JSON.stringify({
        decision: 'approved',
        reason: overrideReason,
      }),
    });
    const overrideJson = await overrideRes.json();
    assert(overrideRes.status === 200 && overrideJson.success, 'POST /api/zonal/applications/:id/override-decision succeeded');

    const { data: decidedApp } = await supabaseAdmin
      .from('applications')
      .select('status, locked, decided_at, decision_reason')
      .eq('id', appNorthId)
      .single();

    assert(decidedApp.status === 'approved', 'Application status transitioned to approved via override');
    assert(decidedApp.locked === true, 'Application is locked from candidate tampering');
    assert(decidedApp.decision_reason === overrideReason, 'Override decision reason persisted on application');
    assert(Boolean(decidedApp.decided_at), 'decided_at timestamp recorded');

    const { data: overrideLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('entity_id', appNorthId)
      .eq('action', 'zonal_hr_override_approved');

    assert(overrideLogs && overrideLogs.length > 0, 'Permanent audit trail entry created for Zonal HR override decision');

    // Clean up test users / candidates
    console.log('\n--- Teardown: Clean up test artifacts ---');
    await supabaseAdmin.from('applications').delete().in('id', [appNorthId, appSouthId]);
    await supabaseAdmin.from('candidates').delete().in('id', [candidateNorthId, candidateSouthId]);
    await supabaseAdmin.from('staff_profiles').delete().in('id', [zonalUserId, peerZonalId, centralHr1Id, centralHr2Id, createBmJson.staff.id]);
    await supabaseAdmin.auth.admin.deleteUser(zonalUserId);
    await supabaseAdmin.auth.admin.deleteUser(peerZonalId);
    await supabaseAdmin.auth.admin.deleteUser(centralHr1Id);
    await supabaseAdmin.auth.admin.deleteUser(centralHr2Id);
    await supabaseAdmin.auth.admin.deleteUser(createBmJson.staff.id);
    console.log('  ✓ Cleaned up test database entities');

  } catch (err) {
    console.error('Test execution exception:', err);
    failedTests++;
  }

  console.log('\n================================================================');
  console.log(`STEP 6 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runStep6TestSuite();
