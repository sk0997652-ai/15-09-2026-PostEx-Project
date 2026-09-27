import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface TestResult {
  step: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(step: string, passed: boolean, details: string) {
  results.push({ step, passed, details });
  if (passed) {
    console.log(`✔ [PASS] ${step} — ${details}`);
  } else {
    console.error(`✖ [FAIL] ${step} — ${details}`);
  }
}

async function apiCall(path: string, method: string, body: any, token: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

async function runPartBSelfTest() {
  console.log('==============================================================================');
  console.log('HEADCOUNT MANAGEMENT MODULE (PART B OF 4) — LIVE END-TO-END & UI SELF-TEST');
  console.log('==============================================================================\n');

  let zone1Id: string | null = null;
  let zone2Id: string | null = null;
  let branch1Id: string | null = null;
  let branch2Id: string | null = null;
  let deptId: string | null = null;
  let desigRiderId: string | null = null;
  let desigAssistantId: string | null = null;

  let centralStaffId: string | null = null;
  let zonalStaffId: string | null = null;
  let bmStaffId: string | null = null;

  let testCandidateId: string | null = null;
  let testApplicationId: string | null = null;
  let testEmployeeId: string | null = null;

  try {
    // 1. Verify Rendered UI Modules Served by Vite on Port 3000
    const hcModuleRes = await fetch(`${BASE_URL}/src/components/common/HeadcountManagementView.tsx`);
    const hcModuleText = await hcModuleRes.text();
    record(
      '1. Rendered HeadcountManagementView Module',
      hcModuleRes.status === 200 &&
        hcModuleText.includes('headcount-add-entry-btn') &&
        hcModuleText.includes('headcount-readonly-notice') &&
        hcModuleText.includes('headcount-modal-designation-select') &&
        hcModuleText.includes('headcount-modal-approved-count-input'),
      `HTTP ${hcModuleRes.status}, Headcount Management UI component compiled & served cleanly`
    );

    const [saRes, zhRes, chRes, bmRes] = await Promise.all([
      fetch(`${BASE_URL}/src/components/SuperAdminDashboard.tsx`).then((r) => r.text()),
      fetch(`${BASE_URL}/src/components/ZonalHrDashboard.tsx`).then((r) => r.text()),
      fetch(`${BASE_URL}/src/components/CentralHrDashboard.tsx`).then((r) => r.text()),
      fetch(`${BASE_URL}/src/components/BranchManagerDashboard.tsx`).then((r) => r.text()),
    ]);

    record(
      '2. Sidebar Navigation Wired Across All 4 Dashboards',
      saRes.includes('nav-btn-headcount') &&
        zhRes.includes('zonal-tab-headcount') &&
        chRes.includes('central-nav-headcount') &&
        bmRes.includes('bm-nav-headcount'),
      'Verified "Headcount Management" sidebar tab in Super Admin, Zonal HR, Central HR, and Branch Manager dashboards'
    );

    // 2. Authenticate as Super Admin (admin@postex.pk)
    const { data: saAuth, error: saErr } = await supabaseClient.auth.signInWithPassword({
      email: 'admin@postex.pk',
      password: 'PostExAdmin2026!',
    });
    if (saErr || !saAuth.session) {
      throw new Error(`Super Admin login failed: ${saErr?.message}`);
    }
    const superAdminToken = saAuth.session.access_token;
    record('3. Super Admin Authenticated', true, 'Logged in as admin@postex.pk');

    // 3. Create Master Data Fixture (2 Zones, 2 Branches, 1 Dept, 2 Designations)
    const z1Res = await apiCall(
      '/api/admin/org/zones',
      'POST',
      { name: 'HC Test Central Zone', zone_code: 'HC-ZN-01', region: 'Punjab', is_active: true },
      superAdminToken
    );
    zone1Id = z1Res.data?.data?.id;

    const z2Res = await apiCall(
      '/api/admin/org/zones',
      'POST',
      { name: 'HC Test South Zone', zone_code: 'HC-ZN-02', region: 'Sindh', is_active: true },
      superAdminToken
    );
    zone2Id = z2Res.data?.data?.id;

    const b1Res = await apiCall(
      '/api/admin/org/branches',
      'POST',
      {
        name: 'HC Lahore Hub',
        branch_code: 'HC-LHE-01',
        zone_id: zone1Id,
        branch_type: 'Hub',
        city_address: 'Gulberg III, Lahore',
        contact_number: '042-111222333',
        is_active: true,
      },
      superAdminToken
    );
    branch1Id = b1Res.data?.data?.id;

    const b2Res = await apiCall(
      '/api/admin/org/branches',
      'POST',
      {
        name: 'HC Karachi Hub',
        branch_code: 'HC-KHI-01',
        zone_id: zone2Id,
        branch_type: 'Hub',
        city_address: 'Shahrah-e-Faisal, Karachi',
        contact_number: '021-111222333',
        is_active: true,
      },
      superAdminToken
    );
    branch2Id = b2Res.data?.data?.id;

    const deptRes = await apiCall(
      '/api/admin/org/departments',
      'POST',
      {
        name: 'HC Operations Dept',
        department_code: 'HC-DEPT-01',
        department_category: 'Field Operations',
        is_active: true,
      },
      superAdminToken
    );
    deptId = deptRes.data?.data?.id;

    const desig1Res = await apiCall(
      '/api/admin/org/designations',
      'POST',
      {
        name: 'HC Delivery Rider',
        department_id: deptId,
        employment_category: 'Rider',
        is_active: true,
      },
      superAdminToken
    );
    desigRiderId = desig1Res.data?.data?.id;

    const desig2Res = await apiCall(
      '/api/admin/org/designations',
      'POST',
      {
        name: 'HC Branch Assistant',
        department_id: deptId,
        employment_category: 'In-House Staff',
        is_active: true,
      },
      superAdminToken
    );
    desigAssistantId = desig2Res.data?.data?.id;

    record(
      '4. Master Data Fixture Created',
      Boolean(zone1Id && zone2Id && branch1Id && branch2Id && deptId && desigRiderId && desigAssistantId),
      `Zones(2), Branches(2), Dept(1), Designations(2: Rider & Branch Assistant)`
    );

    // =========================================================================
    // SECTION A: SUPER ADMIN — Add/Edit Headcount Entry & Verify Active/Vacancy
    // =========================================================================
    console.log('\n--- Testing Super Admin Headcount Creation & Boundary Validation ---');

    // Boundary check: negative approved_count
    const negRes = await apiCall(
      `/api/headcount/branches/${branch1Id}`,
      'POST',
      { designation_id: desigRiderId, approved_count: -5 },
      superAdminToken
    );
    record(
      '5. Boundary Check — Negative Approved Count Rejected',
      negRes.status === 400 && negRes.data.error?.includes('non-negative whole number'),
      `HTTP ${negRes.status}: "${negRes.data.error}"`
    );

    // Super Admin adds headcount entry for Rider (approved_count = 5)
    const addRiderHc = await apiCall(
      `/api/headcount/branches/${branch1Id}`,
      'POST',
      { designation_id: desigRiderId, approved_count: 5 },
      superAdminToken
    );
    record(
      '6. Super Admin — Add Headcount Entry (HC Delivery Rider = 5)',
      addRiderHc.status === 200 &&
        addRiderHc.data.success === true &&
        addRiderHc.data.data.approved_count === 5,
      `Saved headcount entry ID=${addRiderHc.data?.data?.id}, approved_count=5`
    );

    // Super Admin adds second headcount entry for Branch Assistant (approved_count = 2)
    const addAssistantHc = await apiCall(
      `/api/headcount/branches/${branch1Id}`,
      'POST',
      { designation_id: desigAssistantId, approved_count: 2 },
      superAdminToken
    );
    record(
      '7. Super Admin — Add Second Headcount Entry (HC Branch Assistant = 2)',
      addAssistantHc.status === 200 &&
        addAssistantHc.data.success === true &&
        addAssistantHc.data.data.approved_count === 2,
      `Saved headcount entry ID=${addAssistantHc.data?.data?.id}, approved_count=2`
    );

    // Verify GET /api/headcount/branches/:branchId before any employee is enrolled
    const hcListInitial = await apiCall(`/api/headcount/branches/${branch1Id}`, 'GET', null, superAdminToken);
    const riderEntry0 = (hcListInitial.data.entries || []).find((e: any) => e.designation_id === desigRiderId);
    const asstEntry0 = (hcListInitial.data.entries || []).find((e: any) => e.designation_id === desigAssistantId);

    record(
      '8. Super Admin — Initial Active Count (0) & Vacancy Computation (5 & 2)',
      hcListInitial.status === 200 &&
        hcListInitial.data.canEdit === true &&
        riderEntry0?.approved_count === 5 &&
        riderEntry0?.active_count === 0 &&
        riderEntry0?.vacancy === 5 &&
        asstEntry0?.approved_count === 2 &&
        asstEntry0?.active_count === 0 &&
        asstEntry0?.vacancy === 2 &&
        hcListInitial.data.summary.totalApproved === 7 &&
        hcListInitial.data.summary.totalActive === 0 &&
        hcListInitial.data.summary.totalVacancy === 7,
      `Rider(Approved=5, Active=0, Vacancy=5), Branch Assistant(Approved=2, Active=0, Vacancy=2)`
    );

    // =========================================================================
    // SECTION B: LIVE ACTIVE COUNT & VACANCY COMPUTATION WITH ENROLLED EMPLOYEE
    // =========================================================================
    console.log('\n--- Testing Live Active Count & Vacancy from Enrolled Employee Linked to Designation ---');

    // Provision a temporary Central HR user in Zone 1 to test Central HR intake + direct headcount edit
    const { data: roles } = await supabaseAdmin.from('roles').select('id, name');
    const centralRoleId = roles?.find((r) => r.name === 'central_hr')?.id;
    const zonalRoleId = roles?.find((r) => r.name === 'zonal_hr_manager')?.id;
    const bmRoleId = roles?.find((r) => r.name === 'branch_manager')?.id;

    const ts = Date.now();
    const centralEmail = `hc_central_${ts}@postex.pk`;
    const createCentralRes = await apiCall(
      '/api/admin/staff',
      'POST',
      {
        name: 'HC Central HR Tester',
        email: centralEmail,
        role_id: centralRoleId,
        zone_id: zone1Id,
      },
      superAdminToken
    );
    centralStaffId = createCentralRes.data?.staff?.id;
    const centralTempPass = createCentralRes.data?.one_time_temporary_password;
    await supabaseAdmin.from('staff_profiles').update({ must_change_password: false }).eq('id', centralStaffId);

    const { data: centralAuth } = await supabaseClient.auth.signInWithPassword({
      email: centralEmail,
      password: centralTempPass,
    });
    const centralToken = centralAuth.session!.access_token;

    // Central HR creates a New Joiner selecting `desigRiderId` from the Designation dropdown
    const joinerRes = await apiCall(
      '/api/central/candidates',
      'POST',
      {
        full_name: 'HC Enrolled Rider Candidate',
        cnic: '35202-7654321-9',
        mobile: '03009988776',
        email: 'hcrider@postex.pk',
        designation_id: desigRiderId,
        branch_id: branch1Id,
        track: 'non_executive',
      },
      centralToken
    );
    testCandidateId = joinerRes.data?.candidate?.id || null;
    testApplicationId = joinerRes.data?.application?.id || null;

    // Verify candidate row in DB has designation_id FK stored
    const { data: candCheck } = await supabaseAdmin
      .from('candidates')
      .select('id, designation_id, branch_id')
      .eq('id', testCandidateId)
      .single();

    record(
      '9. Prerequisite Check — Candidate Intake Persists designation_id FK',
      joinerRes.status === 201 && candCheck?.designation_id === desigRiderId,
      `Candidate ID=${testCandidateId} linked to designation_id=${candCheck?.designation_id}`
    );

    // Simulate enrolled employee linked to this candidate/application and designation_id
    const { data: empRow, error: empErr } = await supabaseAdmin
      .from('employees')
      .insert({
        application_id: testApplicationId,
        employee_id: 'EMP-HCLHE-9001',
        designation_id: desigRiderId,
      })
      .select()
      .single();

    if (empErr) throw new Error(`Failed to insert test employee: ${empErr.message}`);
    testEmployeeId = empRow.id;

    // Fetch branch headcount again and confirm Active Count = 1 and Vacancy = 4 (5 - 1)
    const hcListAfterEnroll = await apiCall(`/api/headcount/branches/${branch1Id}`, 'GET', null, superAdminToken);
    const riderEntry1 = (hcListAfterEnroll.data.entries || []).find((e: any) => e.designation_id === desigRiderId);

    record(
      '10. Live Active Count & Vacancy After Employee Enrollment',
      riderEntry1?.approved_count === 5 &&
        riderEntry1?.active_count === 1 &&
        riderEntry1?.vacancy === 4 &&
        hcListAfterEnroll.data.summary.totalActive === 1 &&
        hcListAfterEnroll.data.summary.totalVacancy === 6,
      `Rider(Approved=${riderEntry1?.approved_count}, Active=${riderEntry1?.active_count}, Vacancy=${riderEntry1?.vacancy})`
    );

    // =========================================================================
    // SECTION C: CENTRAL HR — Direct Edit Without Any Approval Step + Scope Enforcement
    // =========================================================================
    console.log('\n--- Testing Central HR Direct Edit & Zone Scope Enforcement ---');

    // Central HR directly edits Rider approved_count from 5 -> 8 via PUT /api/headcount/entries/:entryId
    const centralEditRes = await apiCall(
      `/api/headcount/entries/${riderEntry1.id}`,
      'PUT',
      { approved_count: 8, designation_id: desigRiderId },
      centralToken
    );
    const hcAfterCentralEdit = await apiCall(`/api/headcount/branches/${branch1Id}`, 'GET', null, centralToken);
    const riderEntryAfterCentral = (hcAfterCentralEdit.data.entries || []).find(
      (e: any) => e.designation_id === desigRiderId
    );

    record(
      '11. Central HR — Direct Edit Headcount Entry (5 -> 8) Without Approval Step',
      centralEditRes.status === 200 &&
        centralEditRes.data.success === true &&
        riderEntryAfterCentral?.approved_count === 8 &&
        riderEntryAfterCentral?.active_count === 1 &&
        riderEntryAfterCentral?.vacancy === 7 &&
        riderEntryAfterCentral?.updated_by_name === 'HC Central HR Tester',
      `Approved updated immediately to ${riderEntryAfterCentral?.approved_count}, Vacancy=${riderEntryAfterCentral?.vacancy}, Last Updated By="${riderEntryAfterCentral?.updated_by_name}"`
    );

    // Test Vacancy floor at 0 when Approved (0) < Active (1)
    await apiCall(
      `/api/headcount/entries/${riderEntry1.id}`,
      'PUT',
      { approved_count: 0, designation_id: desigRiderId },
      centralToken
    );
    const hcFloorCheck = await apiCall(`/api/headcount/branches/${branch1Id}`, 'GET', null, centralToken);
    const riderFloorEntry = (hcFloorCheck.data.entries || []).find((e: any) => e.designation_id === desigRiderId);
    record(
      '12. Vacancy Floor at 0 When Active Count Exceeds Approved Count',
      riderFloorEntry?.approved_count === 0 &&
        riderFloorEntry?.active_count === 1 &&
        riderFloorEntry?.vacancy === 0,
      `Approved=0, Active=1 -> Vacancy=${riderFloorEntry?.vacancy} (floored at 0)`
    );

    // Restore Rider approved_count to 8
    await apiCall(
      `/api/headcount/entries/${riderEntry1.id}`,
      'PUT',
      { approved_count: 8, designation_id: desigRiderId },
      centralToken
    );

    // Central HR attempts to access or edit Branch 2 (in Zone 2 — outside their assigned zone)
    const centralOutScopeRes = await apiCall(
      `/api/headcount/branches/${branch2Id}`,
      'POST',
      { designation_id: desigRiderId, approved_count: 10 },
      centralToken
    );
    record(
      '13. Central HR — Out-of-Scope Zone Branch Rejected (403)',
      centralOutScopeRes.status === 403,
      `HTTP ${centralOutScopeRes.status}: "${centralOutScopeRes.data.error}"`
    );

    // =========================================================================
    // SECTION D: ZONAL HR MANAGER — Direct Edit Within Assigned Zone
    // =========================================================================
    console.log('\n--- Testing Zonal HR Manager Direct Edit ---');

    const zonalEmail = `hc_zonal_${ts}@postex.pk`;
    const createZonalRes = await apiCall(
      '/api/admin/staff',
      'POST',
      {
        name: 'HC Zonal HR Tester',
        email: zonalEmail,
        role_id: zonalRoleId,
        zone_id: zone1Id,
      },
      superAdminToken
    );
    zonalStaffId = createZonalRes.data?.staff?.id;
    const zonalTempPass = createZonalRes.data?.one_time_temporary_password;
    await supabaseAdmin.from('staff_profiles').update({ must_change_password: false }).eq('id', zonalStaffId);

    const { data: zonalAuth } = await supabaseClient.auth.signInWithPassword({
      email: zonalEmail,
      password: zonalTempPass,
    });
    const zonalToken = zonalAuth.session!.access_token;

    const zonalEditRes = await apiCall(
      `/api/headcount/branches/${branch1Id}`,
      'POST',
      { designation_id: desigAssistantId, approved_count: 4 },
      zonalToken
    );
    record(
      '14. Zonal HR Manager — Direct Edit Headcount Within Assigned Zone',
      zonalEditRes.status === 200 && zonalEditRes.data.data.approved_count === 4,
      `Zonal HR updated Branch Assistant approved_count to ${zonalEditRes.data?.data?.approved_count}`
    );

    // =========================================================================
    // SECTION E: BRANCH MANAGER — Read-Only View of Own Branch Only (Cannot Edit)
    // =========================================================================
    console.log('\n--- Testing Branch Manager Read-Only Access & Write Rejection ---');

    const bmEmail = `hc_bm_${ts}@postex.pk`;
    const createBmRes = await apiCall(
      '/api/admin/staff',
      'POST',
      {
        name: 'HC Branch Manager Tester',
        email: bmEmail,
        role_id: bmRoleId,
        zone_id: zone1Id,
        branch_id: branch1Id,
      },
      superAdminToken
    );
    bmStaffId = createBmRes.data?.staff?.id;
    const bmTempPass = createBmRes.data?.one_time_temporary_password;
    await supabaseAdmin.from('staff_profiles').update({ must_change_password: false }).eq('id', bmStaffId);

    const { data: bmAuth } = await supabaseClient.auth.signInWithPassword({
      email: bmEmail,
      password: bmTempPass,
    });
    const bmToken = bmAuth.session!.access_token;

    // 1. Branch Manager fetches context -> sees ONLY their own branch and canEdit === false
    const bmCtxRes = await apiCall('/api/headcount/context', 'GET', null, bmToken);
    record(
      '15. Branch Manager — Context Scoped Strictly to Own Branch & canEdit=false',
      bmCtxRes.status === 200 &&
        bmCtxRes.data.user.canEdit === false &&
        bmCtxRes.data.branches.length === 1 &&
        bmCtxRes.data.branches[0].id === branch1Id,
      `Branches visible=${bmCtxRes.data.branches?.length} (${bmCtxRes.data.branches?.[0]?.name}), canEdit=${bmCtxRes.data.user?.canEdit}`
    );

    // 2. Branch Manager views their own branch headcount -> 200 OK with entries
    const bmViewRes = await apiCall(`/api/headcount/branches/${branch1Id}`, 'GET', null, bmToken);
    record(
      '16. Branch Manager — Read-Only View of Own Branch Headcount Succeeds',
      bmViewRes.status === 200 &&
        bmViewRes.data.canEdit === false &&
        bmViewRes.data.entries.length === 2,
      `Viewed ${bmViewRes.data.entries?.length} headcount entries (Total Approved=${bmViewRes.data.summary?.totalApproved}, Active=${bmViewRes.data.summary?.totalActive}, Vacancy=${bmViewRes.data.summary?.totalVacancy})`
    );

    // 3. Branch Manager attempts to view another branch -> 403 Forbidden
    const bmOtherBranchRes = await apiCall(`/api/headcount/branches/${branch2Id}`, 'GET', null, bmToken);
    record(
      '17. Branch Manager — Viewing Another Branch Rejected (403)',
      bmOtherBranchRes.status === 403,
      `HTTP ${bmOtherBranchRes.status}: "${bmOtherBranchRes.data.error}"`
    );

    // 4. Branch Manager attempts POST (create/upsert), PUT (edit), and DELETE -> all rejected with 403 Forbidden
    const bmPostAttempt = await apiCall(
      `/api/headcount/branches/${branch1Id}`,
      'POST',
      { designation_id: desigRiderId, approved_count: 99 },
      bmToken
    );
    const bmPutAttempt = await apiCall(
      `/api/headcount/entries/${riderEntry1.id}`,
      'PUT',
      { approved_count: 99 },
      bmToken
    );
    const bmDeleteAttempt = await apiCall(
      `/api/headcount/entries/${riderEntry1.id}`,
      'DELETE',
      null,
      bmToken
    );
    record(
      '18. Branch Manager — All Create/Edit/Delete Mutations Strictly Rejected (403)',
      bmPostAttempt.status === 403 && bmPutAttempt.status === 403 && bmDeleteAttempt.status === 403,
      `POST=${bmPostAttempt.status}, PUT=${bmPutAttempt.status}, DELETE=${bmDeleteAttempt.status} ("${bmPostAttempt.data.error}")`
    );

    // 5. Also verify Supabase RLS directly for Branch Manager JWT (anon client with BM session)
    const { error: rlsWriteErr } = await supabaseClient
      .from('branch_designation_headcount')
      .update({ approved_count: 50 })
      .eq('id', riderEntry1.id);
    // Note: under RLS, an unauthorized UPDATE either errors or affects 0 rows; let's verify approved_count is still 8
    const { data: verifyUnchanged } = await supabaseAdmin
      .from('branch_designation_headcount')
      .select('approved_count')
      .eq('id', riderEntry1.id)
      .single();
    record(
      '19. Database RLS — Branch Manager Direct DB Write Blocked',
      verifyUnchanged?.approved_count === 8 && (!rlsWriteErr || Boolean(rlsWriteErr)),
      `Database row approved_count remained unchanged at ${verifyUnchanged?.approved_count}`
    );
  } finally {
    // Clean up all self-test data so database remains clean for user's real production data entry
    console.log('\n--- Cleaning up all Part B self-test records ---');

    if (testEmployeeId) {
      await supabaseAdmin.from('employees').delete().eq('id', testEmployeeId);
    }
    if (testApplicationId) {
      await supabaseAdmin.from('application_steps').delete().eq('application_id', testApplicationId);
      await supabaseAdmin.from('applications').delete().eq('id', testApplicationId);
    }
    if (testCandidateId) {
      await supabaseAdmin.from('candidates').delete().eq('id', testCandidateId);
    }

    if (branch1Id) {
      await supabaseAdmin.from('branch_designation_headcount').delete().eq('branch_id', branch1Id);
    }
    if (branch2Id) {
      await supabaseAdmin.from('branch_designation_headcount').delete().eq('branch_id', branch2Id);
    }

    for (const staffId of [bmStaffId, zonalStaffId, centralStaffId]) {
      if (staffId) {
        await supabaseAdmin.from('staff_profiles').delete().eq('id', staffId);
        await supabaseAdmin.auth.admin.deleteUser(staffId);
      }
    }

    if (desigRiderId) await supabaseAdmin.from('designations').delete().eq('id', desigRiderId);
    if (desigAssistantId) await supabaseAdmin.from('designations').delete().eq('id', desigAssistantId);
    if (deptId) await supabaseAdmin.from('departments').delete().eq('id', deptId);
    if (branch1Id) await supabaseAdmin.from('branches').delete().eq('id', branch1Id);
    if (branch2Id) await supabaseAdmin.from('branches').delete().eq('id', branch2Id);
    if (zone1Id) await supabaseAdmin.from('zones').delete().eq('id', zone1Id);
    if (zone2Id) await supabaseAdmin.from('zones').delete().eq('id', zone2Id);

    const [hcCount, zCount, bCount, dCount, dsCount, staffCount] = await Promise.all([
      supabaseAdmin.from('branch_designation_headcount').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('zones').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('branches').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('departments').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('designations').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('staff_profiles').select('*', { count: 'exact', head: true }),
    ]);

    record(
      '20. Post-Test Cleanup Verification',
      hcCount.count === 0 &&
        zCount.count === 0 &&
        bCount.count === 0 &&
        dCount.count === 0 &&
        dsCount.count === 0 &&
        staffCount.count === 1,
      `Headcount=${hcCount.count}, Zones=${zCount.count}, Branches=${bCount.count}, Depts=${dCount.count}, Designations=${dsCount.count}, Staff=${staffCount.count} (Super Admin only)`
    );
  }

  const failed = results.filter((r) => !r.passed).length;
  console.log('\n==============================================================================');
  console.log(`PART B SELF-TEST SUMMARY: ${results.length - failed}/${results.length} PASSED`);
  console.log('==============================================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

runPartBSelfTest().catch((err) => {
  console.error('Fatal error in Part B self-test:', err);
  process.exit(1);
});
