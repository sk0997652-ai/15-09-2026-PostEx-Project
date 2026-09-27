import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required Supabase environment variables.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${label}${detail ? ` (${detail})` : ''}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function apiFetch(
  path: string,
  options: { method?: string; token?: string; body?: any } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data: json };
}

async function runPartDSelfTest() {
  console.log('======================================================================');
  console.log('🧪 PART D SELF-TEST: Dashboard Overview Redesign (All 4 Staff Roles)');
  console.log('======================================================================');

  const createdZoneIds: string[] = [];
  const createdBranchIds: string[] = [];
  const createdDepartmentIds: string[] = [];
  const createdDesignationIds: string[] = [];
  const createdStaffUserIds: string[] = [];
  const createdCandidateIds: string[] = [];
  const createdApplicationIds: string[] = [];
  const createdEmployeeIds: string[] = [];
  const createdHeadcountIds: string[] = [];

  const [
    { count: baseZones },
    { count: baseBranches },
    { count: baseDepts },
    { count: baseDesigs },
    { count: baseHc },
    { count: baseEmps },
    { count: baseCands },
    { count: baseStaff },
  ] = await Promise.all([
    supabaseAdmin.from('zones').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('branches').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('departments').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('designations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('branch_designation_headcount').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('employees').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('candidates').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('staff_profiles').select('*', { count: 'exact', head: true }),
  ]);

  try {
    // -------------------------------------------------------------------------
    // 1. Verify Rendered UI Modules for All 4 Overview Screens on Port 3000
    // -------------------------------------------------------------------------
    console.log('\n[1] Verifying Rendered UI Modules & Shared Components on Port 3000...');
    const [sharedRes, saRes, zonalRes, centralRes, bmRes] = await Promise.all([
      fetch(`${BASE_URL}/src/components/common/OverviewHeadcountShared.tsx`),
      fetch(`${BASE_URL}/src/components/admin/OverviewMetricsView.tsx`),
      fetch(`${BASE_URL}/src/components/zonal/ZoneOverviewView.tsx`),
      fetch(`${BASE_URL}/src/components/central/CentralOverviewView.tsx`),
      fetch(`${BASE_URL}/src/components/branch/BranchOverviewView.tsx`),
    ]);

    const [sharedCode, saCode, zonalCode, centralCode, bmCode] = await Promise.all([
      sharedRes.text(),
      saRes.text(),
      zonalRes.text(),
      centralRes.text(),
      bmRes.text(),
    ]);

    assert(
      sharedRes.ok &&
        sharedCode.includes('FillRateStatusBadge') &&
        sharedCode.includes('TrendIndicator') &&
        sharedCode.includes('OverviewRowDetailModal') &&
        sharedCode.includes('overview-historical-chart'),
      'OverviewHeadcountShared.tsx serves FillRateStatusBadge, TrendIndicator, and OverviewRowDetailModal with Historical Chart'
    );

    assert(
      saRes.ok &&
        saCode.includes('super-admin-zone-headcount-table') &&
        saCode.includes('super-admin-branch-headcount-table') &&
        saCode.includes('super-admin-designation-headcount-table') &&
        saCode.includes('OverviewRowDetailModal'),
      'Super Admin OverviewMetricsView.tsx renders Zone, Branch, and Designation headcount rollup tables + row-click Detail Modal'
    );

    assert(
      zonalRes.ok &&
        zonalCode.includes('zonal-branch-headcount-table') &&
        zonalCode.includes('zonal-designation-headcount-table') &&
        zonalCode.includes('OverviewRowDetailModal'),
      'Zonal HR ZoneOverviewView.tsx renders Zone Branch and Designation headcount rollup tables + row-click Detail Modal'
    );

    assert(
      centralRes.ok &&
        centralCode.includes('central-branch-headcount-table') &&
        centralCode.includes('central-designation-headcount-table') &&
        centralCode.includes('OverviewRowDetailModal'),
      'Central HR CentralOverviewView.tsx renders Scoped Branch and Designation headcount rollup tables + row-click Detail Modal'
    );

    assert(
      bmRes.ok &&
        bmCode.includes('branch-manager-designation-headcount-table') &&
        bmCode.includes('OverviewRowDetailModal'),
      'Branch Manager BranchOverviewView.tsx renders Branch Designation headcount table + row-click Detail Modal'
    );

    // -------------------------------------------------------------------------
    // 2. Provision Master Data Fixture (2 Zones, 3 Branches, 1 Dept, 2 Designations)
    // -------------------------------------------------------------------------
    console.log('\n[2] Provisioning Master Data Fixture (Zones, Branches, Dept, Rider & In-House Designations)...');
    const adminToken = SUPABASE_SERVICE_ROLE_KEY!;

    const z1Res = await apiFetch('/api/admin/org/zones', {
      method: 'POST',
      token: adminToken,
      body: { name: 'Part D North Zone', zone_code: 'ZD-NORTH-01', region: 'Punjab', is_active: true },
    });
    const z2Res = await apiFetch('/api/admin/org/zones', {
      method: 'POST',
      token: adminToken,
      body: { name: 'Part D South Zone', zone_code: 'ZD-SOUTH-02', region: 'Sindh', is_active: true },
    });
    const zone1Id = z1Res.data?.data?.id;
    const zone2Id = z2Res.data?.data?.id;
    if (zone1Id) createdZoneIds.push(zone1Id);
    if (zone2Id) createdZoneIds.push(zone2Id);
    assert(Boolean(zone1Id && zone2Id), 'Created 2 test Zones (ZD-NORTH-01, ZD-SOUTH-02)');

    const b1Res = await apiFetch('/api/admin/org/branches', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Lahore Main Hub D1',
        branch_code: 'BRD-LHE-01',
        zone_id: zone1Id,
        branch_type: 'Hub',
        city_address: 'Lahore Gulberg',
        is_active: true,
      },
    });
    const b2Res = await apiFetch('/api/admin/org/branches', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Lahore Defense Sub-Hub D2',
        branch_code: 'BRD-LHE-02',
        zone_id: zone1Id,
        branch_type: 'Sub-Hub',
        city_address: 'Lahore DHA',
        is_active: true,
      },
    });
    const b3Res = await apiFetch('/api/admin/org/branches', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Karachi Korangi Hub D3',
        branch_code: 'BRD-KHI-01',
        zone_id: zone2Id,
        branch_type: 'Hub',
        city_address: 'Karachi Korangi',
        is_active: true,
      },
    });
    const branch1Id = b1Res.data?.data?.id;
    const branch2Id = b2Res.data?.data?.id;
    const branch3Id = b3Res.data?.data?.id;
    if (branch1Id) createdBranchIds.push(branch1Id);
    if (branch2Id) createdBranchIds.push(branch2Id);
    if (branch3Id) createdBranchIds.push(branch3Id);
    assert(Boolean(branch1Id && branch2Id && branch3Id), 'Created 3 test Branches across 2 Zones');

    const deptRes = await apiFetch('/api/admin/org/departments', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Part D Fleet & Hub Ops',
        department_code: 'DEPT-D-OPS',
        department_category: 'Field Operations',
        is_active: true,
      },
    });
    const deptId = deptRes.data?.data?.id;
    if (deptId) createdDepartmentIds.push(deptId);

    const desigRiderRes = await apiFetch('/api/admin/org/designations', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Part D Courier Rider',
        department_id: deptId,
        employment_category: 'Rider',
        is_active: true,
      },
    });
    const desigInHouseRes = await apiFetch('/api/admin/org/designations', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Part D Hub Supervisor',
        department_id: deptId,
        employment_category: 'In-House Staff',
        is_active: true,
      },
    });
    const desigRiderId = desigRiderRes.data?.data?.id;
    const desigInHouseId = desigInHouseRes.data?.data?.id;
    if (desigRiderId) createdDesignationIds.push(desigRiderId);
    if (desigInHouseId) createdDesignationIds.push(desigInHouseId);
    assert(
      Boolean(desigRiderId && desigInHouseId),
      'Created Rider and In-House Staff designations'
    );

    // -------------------------------------------------------------------------
    // 3. Configure Headcount Targets to Test Fill-Rate Thresholds:
    //    - Branch 1: Rider Approved = 10, In-House Approved = 1 (Total = 11)
    //    - Branch 2: Rider Approved = 1, In-House Approved = 0 (Total = 1)
    //    - Branch 3: Rider Approved = 5, In-House Approved = 2 (Total = 7)
    // -------------------------------------------------------------------------
    console.log('\n[3] Setting Headcount Targets & Enrolling Employees to Test Shared Definitions...');
    const hc1 = await apiFetch(`/api/headcount/branches/${branch1Id}`, {
      method: 'POST',
      token: adminToken,
      body: { designation_id: desigRiderId, approved_count: 10 },
    });
    const hc2 = await apiFetch(`/api/headcount/branches/${branch1Id}`, {
      method: 'POST',
      token: adminToken,
      body: { designation_id: desigInHouseId, approved_count: 1 },
    });
    const hc3 = await apiFetch(`/api/headcount/branches/${branch2Id}`, {
      method: 'POST',
      token: adminToken,
      body: { designation_id: desigRiderId, approved_count: 1 },
    });
    const hc4 = await apiFetch(`/api/headcount/branches/${branch3Id}`, {
      method: 'POST',
      token: adminToken,
      body: { designation_id: desigRiderId, approved_count: 5 },
    });

    for (const h of [hc1, hc2, hc3, hc4]) {
      if (h.data?.data?.id) createdHeadcountIds.push(h.data.data.id);
    }

    // Before any employees exist in Zone 1: verify Trend is "—" (no fabricated data) and Fill-Rate is Critical (0%)
    const initialOverview = await apiFetch(`/api/headcount/overview?zoneId=${zone1Id}`, { token: adminToken });
    assert(
      initialOverview.ok &&
        initialOverview.data?.summary?.total?.approved === 12 &&
        initialOverview.data?.summary?.total?.active === 0 &&
        initialOverview.data?.summary?.total?.vacancy === 12 &&
        initialOverview.data?.summary?.total?.fill_rate_status === 'Critical' &&
        initialOverview.data?.summary?.total?.trend?.display === '—' &&
        initialOverview.data?.summary?.total?.trend?.has_historical_data === false,
      'With 0 employees in Zone 1: Approved=12, Active=0, Vacancy=12, Status=Critical (0%), Trend="—" (zero fabricated historical data)'
    );

    // Helper to enrol a candidate + application + employee in a branch & designation
    let seq = 1;
    async function enrolTestEmployee(params: {
      branchId: string;
      zoneId: string;
      designationId: string;
      enrolledAtIso: string;
    }) {
      const idx = seq++;
      const cnic = `35202999999${String(idx).padStart(2, '0')}`;
      const joiningId = `PX-2026-9999${String(idx).padStart(2, '0')}`;
      const { data: cand } = await supabaseAdmin
        .from('candidates')
        .insert({
          full_name: `Part D Test Employee ${idx}`,
          cnic,
          mobile: `030099999${String(idx).padStart(2, '0')}`,
          joining_id: joiningId,
          branch_id: params.branchId,
          zone_id: params.zoneId,
          designation_id: params.designationId,
          track: 'non_executive',
        })
        .select()
        .single();
      createdCandidateIds.push(cand.id);

      const { data: app } = await supabaseAdmin
        .from('applications')
        .insert({
          candidate_id: cand.id,
          status: 'approved',
          current_step: 6,
          locked: true,
          submitted_at: params.enrolledAtIso,
          decided_at: params.enrolledAtIso,
        })
        .select()
        .single();
      createdApplicationIds.push(app.id);

      const { data: emp, error: empErr } = await supabaseAdmin
        .from('employees')
        .insert({
          application_id: app.id,
          employee_id: `EMP-PARTD-${String(idx).padStart(5, '0')}`,
        })
        .select()
        .single();
      if (empErr || !emp) {
        throw new Error(`Failed to insert test employee: ${empErr?.message}`);
      }
      createdEmployeeIds.push(emp.id);
    }

    // Enrol 9 Riders in Branch 1:
    // - 5 enrolled LAST MONTH (to test real historical data + ▲ emerald trend)
    // - 4 enrolled THIS MONTH (so Branch 1 Rider = 9/10 = 90% -> "Understaffed", Trend = ▲ +4)
    const now = new Date();
    const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)).toISOString();
    const thisMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 2)).toISOString();

    for (let i = 0; i < 5; i++) {
      await enrolTestEmployee({
        branchId: branch1Id,
        zoneId: zone1Id,
        designationId: desigRiderId,
        enrolledAtIso: lastMonthDate,
      });
    }
    for (let i = 0; i < 4; i++) {
      await enrolTestEmployee({
        branchId: branch1Id,
        zoneId: zone1Id,
        designationId: desigRiderId,
        enrolledAtIso: thisMonthDate,
      });
    }

    // Enrol 1 In-House Staff in Branch 1 THIS MONTH (1/1 = 100% -> "On Target", no prior month history -> Trend = "—")
    await enrolTestEmployee({
      branchId: branch1Id,
      zoneId: zone1Id,
      designationId: desigInHouseId,
      enrolledAtIso: thisMonthDate,
    });

    // Enrol 2 Riders in Branch 2 THIS MONTH (Approved=1, Active=2 -> Vacancy floored at 0, Fill Rate = 200% -> "On Target")
    for (let i = 0; i < 2; i++) {
      await enrolTestEmployee({
        branchId: branch2Id,
        zoneId: zone1Id,
        designationId: desigRiderId,
        enrolledAtIso: thisMonthDate,
      });
    }

    // -------------------------------------------------------------------------
    // 4. Verify Super Admin Overview Calculations & Thresholds
    // -------------------------------------------------------------------------
    console.log('\n[4] Verifying Super Admin Overview Rollup, Fill-Rate Badges, Vacancy Floor, and Historical Trend...');
    const saOverviewRes = await apiFetch('/api/headcount/overview', { token: adminToken });
    const saData = saOverviewRes.data;

    const b1Row = saData.branch_rows.find((b: any) => b.branch_id === branch1Id);
    const b2Row = saData.branch_rows.find((b: any) => b.branch_id === branch2Id);
    const b3Row = saData.branch_rows.find((b: any) => b.branch_id === branch3Id);

    assert(
      b1Row?.rider?.approved === 10 &&
        b1Row?.rider?.active === 9 &&
        b1Row?.rider?.vacancy === 1 &&
        b1Row?.rider?.fill_rate_pct === 90 &&
        b1Row?.rider?.fill_rate_status === 'Understaffed' &&
        b1Row?.rider?.trend?.direction === 'up' &&
        b1Row?.rider?.trend?.display === '▲' &&
        b1Row?.rider?.trend?.delta === 4,
      'Branch 1 Rider Rollup: 9/10 Active (90% -> Understaffed), Vacancy=1, Trend="▲ +4" (5 last month -> 9 this month)',
      `status=${b1Row?.rider?.fill_rate_status}, trend=${b1Row?.rider?.trend?.display} +${b1Row?.rider?.trend?.delta}`
    );

    assert(
      b1Row?.in_house?.approved === 1 &&
        b1Row?.in_house?.active === 1 &&
        b1Row?.in_house?.vacancy === 0 &&
        b1Row?.in_house?.fill_rate_pct === 100 &&
        b1Row?.in_house?.fill_rate_status === 'On Target' &&
        b1Row?.in_house?.trend?.display === '—',
      'Branch 1 In-House Rollup: 1/1 Active (100% -> On Target), Vacancy=0, Trend="—" (no prior month history)'
    );

    assert(
      b2Row?.rider?.approved === 1 &&
        b2Row?.rider?.active === 2 &&
        b2Row?.rider?.vacancy === 0 &&
        b2Row?.rider?.fill_rate_status === 'On Target',
      'Branch 2 Vacancy Floor at 0: Approved=1, Active=2 -> Vacancy=0 (floored at 0), Status=On Target'
    );

    assert(
      b3Row?.total?.approved === 5 &&
        b3Row?.total?.active === 0 &&
        b3Row?.total?.vacancy === 5 &&
        b3Row?.total?.fill_rate_status === 'Critical' &&
        b3Row?.total?.trend?.display === '—',
      'Branch 3 Critical Fill-Rate: Approved=5, Active=0 -> 0% Critical, Trend="—"'
    );

    assert(
      b1Row?.has_prior_months_history === true &&
        Array.isArray(b1Row?.historical_series) &&
        b1Row.historical_series.length >= 2,
      'Branch 1 row detail payload includes multi-month historical_series for the modal chart',
      `months=${b1Row?.historical_series?.map((m: any) => `${m.month_label}:${m.total_active}`).join(', ')}`
    );

    // -------------------------------------------------------------------------
    // 5. Verify Role Scoping for Zonal HR, Central HR (with Branch Tagging), and Branch Manager
    // -------------------------------------------------------------------------
    console.log('\n[5] Verifying Role-Scoped Overview Endpoints (Zonal HR, Central HR, Branch Manager)...');
    const { data: roles } = await supabaseAdmin.from('roles').select('id, name');
    const roleMap = new Map<string, string>((roles || []).map((r: any) => [r.name, r.id]));

    // Create Zonal HR Manager for Zone 1
    const zhrRes = await apiFetch('/api/admin/staff', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Part D Zonal HR',
        email: 'zhr.partd@postex.pk',
        department_id: deptId,
        designation_id: desigInHouseId,
        role_id: roleMap.get('zonal_hr_manager'),
        zone_id: zone1Id,
        branch_ids: [branch1Id, branch2Id],
      },
    });
    const zhrUser = zhrRes.data?.staff;
    const zhrPwd = zhrRes.data?.one_time_temporary_password;
    if (zhrUser?.id) createdStaffUserIds.push(zhrUser.id);

    // Create Central HR for Zone 1 tagged ONLY to Branch 1 (testing Part C + Part D integration!)
    const chrRes = await apiFetch('/api/admin/staff', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Part D Central HR (Tagged B1)',
        email: 'chr.partd@postex.pk',
        department_id: deptId,
        designation_id: desigInHouseId,
        role_id: roleMap.get('central_hr'),
        zone_id: zone1Id,
        branch_ids: [branch1Id],
      },
    });
    const chrUser = chrRes.data?.staff;
    const chrPwd = chrRes.data?.one_time_temporary_password;
    if (chrUser?.id) createdStaffUserIds.push(chrUser.id);

    // Create Branch Manager for Branch 1
    const bmCreateRes = await apiFetch('/api/admin/staff', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Part D Branch Manager B1',
        email: 'bm.partd@postex.pk',
        department_id: deptId,
        designation_id: desigInHouseId,
        role_id: roleMap.get('branch_manager'),
        zone_id: zone1Id,
        branch_ids: [branch1Id],
      },
    });
    const bmUser = bmCreateRes.data?.staff;
    const bmPwd = bmCreateRes.data?.one_time_temporary_password;
    if (bmUser?.id) createdStaffUserIds.push(bmUser.id);

    // Test Zonal HR Overview
    const { data: zhrAuth } = await supabaseClient.auth.signInWithPassword({
      email: 'zhr.partd@postex.pk',
      password: zhrPwd,
    });
    const zhrOverview = await apiFetch('/api/headcount/overview', {
      token: zhrAuth.session?.access_token,
    });
    await supabaseClient.auth.signOut();

    assert(
      zhrOverview.ok &&
        zhrOverview.data?.zone_rows?.length === 1 &&
        zhrOverview.data?.zone_rows?.[0]?.zone_id === zone1Id &&
        zhrOverview.data?.branch_rows?.length === 2,
      'Zonal HR Manager overview is strictly scoped to Zone 1 (2 branches, excludes Zone 2)'
    );

    // Test Central HR Overview (tagged to Branch 1)
    const { data: chrAuth } = await supabaseClient.auth.signInWithPassword({
      email: 'chr.partd@postex.pk',
      password: chrPwd,
    });
    const chrOverview = await apiFetch('/api/headcount/overview', {
      token: chrAuth.session?.access_token,
    });
    await supabaseClient.auth.signOut();

    assert(
      chrOverview.ok &&
        chrOverview.data?.branch_rows?.length === 1 &&
        chrOverview.data?.branch_rows?.[0]?.branch_id === branch1Id &&
        chrOverview.data?.summary?.rider?.active === 9 &&
        chrOverview.data?.summary?.in_house?.active === 1,
      'Central HR overview respects Zone + Branch Tagging scope (Branch 1: 9 Riders, 1 In-House Staff)'
    );

    // Test Branch Manager Overview (scoped to Branch 1)
    const { data: bmAuth } = await supabaseClient.auth.signInWithPassword({
      email: 'bm.partd@postex.pk',
      password: bmPwd,
    });
    const bmOverview = await apiFetch('/api/headcount/overview', {
      token: bmAuth.session?.access_token,
    });
    await supabaseClient.auth.signOut();

    assert(
      bmOverview.ok &&
        bmOverview.data?.branch_rows?.length === 1 &&
        bmOverview.data?.branch_rows?.[0]?.branch_id === branch1Id &&
        bmOverview.data?.designation_rows?.length === 2,
      'Branch Manager overview is strictly scoped to Branch 1 with 2 Designation rows (Courier Rider & Hub Supervisor)'
    );
  } finally {
    // -------------------------------------------------------------------------
    // 6. Clean Up All Temporary Test Records
    // -------------------------------------------------------------------------
    console.log('\n[6] Cleaning Up All Self-Test Records...');

    for (const empId of createdEmployeeIds) {
      await supabaseAdmin.from('employees').delete().eq('id', empId);
    }
    for (const appId of createdApplicationIds) {
      await supabaseAdmin.from('audit_logs').delete().eq('entity_id', appId);
      await supabaseAdmin.from('applications').delete().eq('id', appId);
    }
    for (const candId of createdCandidateIds) {
      await supabaseAdmin.from('candidates').delete().eq('id', candId);
    }
    for (const hcId of createdHeadcountIds) {
      await supabaseAdmin.from('audit_logs').delete().eq('entity_id', hcId);
      await supabaseAdmin.from('branch_designation_headcount').delete().eq('id', hcId);
    }
    for (const uid of createdStaffUserIds) {
      await supabaseAdmin.from('staff_branch_assignments').delete().eq('staff_profile_id', uid);
      await supabaseAdmin.from('audit_logs').delete().eq('entity_id', uid);
      await supabaseAdmin.from('audit_logs').delete().eq('actor_id', uid);
      await supabaseAdmin.from('staff_profiles').delete().eq('id', uid);
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }
    for (const desigId of createdDesignationIds) {
      await supabaseAdmin.from('branch_designation_headcount').delete().eq('designation_id', desigId);
      await supabaseAdmin.from('audit_logs').delete().eq('entity_id', desigId);
      await supabaseAdmin.from('designations').delete().eq('id', desigId);
    }
    for (const deptId of createdDepartmentIds) {
      await supabaseAdmin.from('audit_logs').delete().eq('entity_id', deptId);
      await supabaseAdmin.from('departments').delete().eq('id', deptId);
    }
    for (const brId of createdBranchIds) {
      await supabaseAdmin.from('branch_designation_headcount').delete().eq('branch_id', brId);
      await supabaseAdmin.from('staff_branch_assignments').delete().eq('branch_id', brId);
      await supabaseAdmin.from('audit_logs').delete().eq('entity_id', brId);
      await supabaseAdmin.from('branches').delete().eq('id', brId);
    }
    for (const zId of createdZoneIds) {
      await supabaseAdmin.from('audit_logs').delete().eq('entity_id', zId);
      await supabaseAdmin.from('zones').delete().eq('id', zId);
    }

    const [
      { count: zonesLeft },
      { count: branchesLeft },
      { count: deptsLeft },
      { count: desigsLeft },
      { count: hcLeft },
      { count: empsLeft },
      { count: candsLeft },
      { count: staffLeft },
    ] = await Promise.all([
      supabaseAdmin.from('zones').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('branches').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('departments').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('designations').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('branch_designation_headcount').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('employees').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('candidates').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('staff_profiles').select('*', { count: 'exact', head: true }),
    ]);

    assert(
      zonesLeft === baseZones &&
        branchesLeft === baseBranches &&
        deptsLeft === baseDepts &&
        desigsLeft === baseDesigs &&
        hcLeft === baseHc &&
        empsLeft === baseEmps &&
        candsLeft === baseCands &&
        staffLeft === baseStaff,
      'Post-test cleanup verified exact baseline database state restored (zero test records left behind)',
      `Zones=${zonesLeft}/${baseZones}, Branches=${branchesLeft}/${baseBranches}, Depts=${deptsLeft}/${baseDepts}, Desigs=${desigsLeft}/${baseDesigs}, HC=${hcLeft}/${baseHc}, Emps=${empsLeft}/${baseEmps}, Cands=${candsLeft}/${baseCands}, Staff=${staffLeft}/${baseStaff}`
    );
  }

  console.log('\n======================================================================');
  console.log(`📊 PART D SELF-TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPartDSelfTest().catch((err) => {
  console.error('Unhandled error in Part D self-test:', err);
  process.exit(1);
});
