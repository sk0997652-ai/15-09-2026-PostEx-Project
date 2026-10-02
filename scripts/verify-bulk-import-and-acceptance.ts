import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = 'http://localhost:3000';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string, detail?: string) {
  if (cond) {
    passed++;
    console.log(`✔ [PASS] ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`✖ [FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
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
  return { status: res.status, ok: res.ok, data: json };
}

async function runAcceptanceTests() {
  console.log('==============================================================================');
  console.log('BULK IMPORT, LEADING ZEROS, SKIP/UPDATE MODES, CANDIDATE & ZONAL HR ACCEPTANCE');
  console.log('==============================================================================\n');

  const createdStaffIds: string[] = [];
  let createdCandidateId: string | null = null;
  let createdAppId: string | null = null;
  const importedBranchCodes: string[] = [];

  try {
    // 1. Check Routing in superAdminRoutes.ts
    const routesCode = fs.readFileSync('src/server/superAdminRoutes.ts', 'utf8');
    const bulkValidateIdx = routesCode.indexOf("router.post('/org/:entity/bulk-validate'");
    const bulkImportIdx = routesCode.indexOf("router.post('/org/:entity/bulk-import'");
    const genericEntityIdx = routesCode.indexOf("router.post('/org/:entity'");
    const hasForwardingHack = routesCode.includes("if (entity === 'bulk-import')");

    assert(
      bulkValidateIdx > 0 &&
        bulkImportIdx > 0 &&
        genericEntityIdx > bulkValidateIdx &&
        genericEntityIdx > bulkImportIdx &&
        !hasForwardingHack,
      '1. Routing: POST /org/bulk-validate and /org/bulk-import registered BEFORE /org/:entity without forwarding workaround'
    );

    // 2. Authenticate as Super Admin
    const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
      email: 'admin@postex.pk',
      password: 'PostExAdmin2026!',
    });
    if (authErr || !authData.session) {
      throw new Error(`Super Admin login failed: ${authErr?.message}`);
    }
    const adminToken = authData.session.access_token;
    assert(true, '2. Authenticated as Super Admin (admin@postex.pk)');

    // 3. Bulk Import Step 1: Zones ("01" | "CENTRAL", "02" | "SOUTH")
    const zoneRows = [
      { 'Zone Code*': '01', 'Zone Name*': 'CENTRAL', Region: 'Punjab' },
      { 'Zone Code*': '02', 'Zone Name*': 'SOUTH', Region: 'Sindh' },
    ];
    const zoneVal = await apiCall(
      '/api/admin/org/zones/bulk-validate',
      'POST',
      { rows: zoneRows, mode: 'update' },
      adminToken
    );
    assert(
      zoneVal.ok && zoneVal.data.summary?.errors === 0,
      '3a. Bulk Validate Zones (POST /api/admin/org/zones/bulk-validate)',
      `total=${zoneVal.data.summary?.total}, errors=${zoneVal.data.summary?.errors}`
    );

    const zoneImp = await apiCall(
      '/api/admin/org/zones/bulk-import',
      'POST',
      { rows: zoneRows, mode: 'update' },
      adminToken
    );
    assert(
      zoneImp.ok && zoneImp.data.summary?.failed === 0,
      '3b. Bulk Import Zones (POST /api/admin/org/zones/bulk-import)',
      `added=${zoneImp.data.summary?.added}, updated=${zoneImp.data.summary?.updated}`
    );

    // 4. Bulk Import Step 2: Cities ("045" | "SUKKUR", "012" | "LAHORE")
    const cityRows = [
      { 'City Code*': '045', 'City Name*': 'SUKKUR' },
      { 'City Code*': '012', 'City Name*': 'LAHORE' },
    ];
    const cityImp = await apiCall(
      '/api/admin/org/cities/bulk-import',
      'POST',
      { rows: cityRows, mode: 'update' },
      adminToken
    );
    assert(
      cityImp.ok && cityImp.data.summary?.failed === 0,
      '4. Bulk Import Cities ("045 | SUKKUR", "012 | LAHORE")',
      `added=${cityImp.data.summary?.added}, updated=${cityImp.data.summary?.updated}`
    );

    // 5. Bulk Import Step 3: Departments ("001" | "OPERATIONS")
    const deptRows = [
      { 'Department Code*': '001', 'Department Name*': 'OPERATIONS', 'Department Category': 'Field Operations' },
    ];
    const deptImp = await apiCall(
      '/api/admin/org/departments/bulk-import',
      'POST',
      { rows: deptRows, mode: 'update' },
      adminToken
    );
    assert(
      deptImp.ok && deptImp.data.summary?.failed === 0,
      '5. Bulk Import Departments ("001 | OPERATIONS") with leading zeros preserved',
      `added=${deptImp.data.summary?.added}, updated=${deptImp.data.summary?.updated}`
    );

    // 6. Bulk Import Step 4: Designations ("0151" | "AREA MANAGER" linked to Department Code "001")
    const desigRows = [
      {
        'Designation Code*': '0151',
        'Designation Name*': 'AREA MANAGER',
        'Department Code*': '001',
        'Employment Category': 'In-House Staff',
      },
    ];
    const desigImp = await apiCall(
      '/api/admin/org/designations/bulk-import',
      'POST',
      { rows: desigRows, mode: 'update' },
      adminToken
    );
    assert(
      desigImp.ok && desigImp.data.summary?.failed === 0,
      '6. Bulk Import Designations ("0151 | AREA MANAGER" -> Dept "001")',
      `added=${desigImp.data.summary?.added}, updated=${desigImp.data.summary?.updated}`
    );

    // 7. Bulk Import Step 5: 100 Branches (codes "0001".."0100", including "0053" -> "SKZ")
    const branchRows100: Array<Record<string, string>> = [];
    for (let i = 1; i <= 100; i++) {
      const code = String(i).padStart(4, '0');
      importedBranchCodes.push(code);
      const is0053 = code === '0053';
      branchRows100.push({
        'Branch Code*': code,
        'Branch Name*': is0053 ? 'SKZ' : `BRANCH HUB ${code}`,
        'Zone Code*': is0053 || i > 50 ? '02' : '01',
        'City Code*': is0053 || i > 50 ? '045' : '012',
        'Branch Type': 'Hub',
        Address: is0053 ? '' : `Street ${code}`, // Empty address on 0053 tests auto-fill from City name ("SUKKUR")!
        'Contact Number': `0300-${code}000`,
      });
    }

    const branchVal = await apiCall(
      '/api/admin/org/branches/bulk-validate',
      'POST',
      { rows: branchRows100, mode: 'update' },
      adminToken
    );
    assert(
      branchVal.ok && branchVal.data.summary?.total === 100 && branchVal.data.summary?.errors === 0,
      '7a. Dry-Run Validate 100 Branches (POST /api/admin/org/branches/bulk-validate)',
      `total=${branchVal.data.summary?.total}, valid=${branchVal.data.summary?.valid}, duplicates=${branchVal.data.summary?.duplicates}, errors=${branchVal.data.summary?.errors}`
    );

    const branchImp = await apiCall(
      '/api/admin/org/branches/bulk-import',
      'POST',
      { rows: branchRows100, mode: 'update' },
      adminToken
    );
    assert(
      branchImp.ok &&
        (branchImp.data.summary?.added + branchImp.data.summary?.updated) === 100 &&
        branchImp.data.summary?.failed === 0,
      '7b. Bulk Import 100 Branches (POST /api/admin/org/branches/bulk-import)',
      `added=${branchImp.data.summary?.added}, updated=${branchImp.data.summary?.updated}, failed=${branchImp.data.summary?.failed}`
    );

    // Verify leading zeros in DB ("0053", "0001", "001")
    const { data: dbBranch0053 } = await supabaseAdmin
      .from('branches')
      .select('id, branch_code, name, zone_id, city_address')
      .eq('branch_code', '0053')
      .single();
    const { data: dbBranch0001 } = await supabaseAdmin
      .from('branches')
      .select('id, branch_code, name')
      .eq('branch_code', '0001')
      .single();
    const { data: dbDept001 } = await supabaseAdmin
      .from('departments')
      .select('id, department_code, name')
      .eq('department_code', '001')
      .single();

    assert(
      dbBranch0053?.branch_code === '0053' &&
        dbBranch0053?.name === 'SKZ' &&
        dbBranch0053?.city_address === 'SUKKUR' &&
        dbBranch0001?.branch_code === '0001' &&
        dbDept001?.department_code === '001',
      '7c. Leading zeros preserved in database ("0053", "0001", "001") and empty city_address auto-filled from City ("SUKKUR")',
      `branch_code="${dbBranch0053?.branch_code}", name="${dbBranch0053?.name}", city_address="${dbBranch0053?.city_address}"`
    );

    const original0053Uuid = dbBranch0053!.id;

    // 8. Re-upload the same 100-branch file in SKIP mode -> 0 changes
    const skipImp = await apiCall(
      '/api/admin/org/branches/bulk-import',
      'POST',
      { rows: branchRows100, mode: 'skip' },
      adminToken
    );
    assert(
      skipImp.ok &&
        skipImp.data.summary?.added === 0 &&
        skipImp.data.summary?.updated === 0 &&
        skipImp.data.summary?.skipped === 100,
      '8a. Re-uploading the same 100 branches in Skip mode makes 0 changes',
      `added=${skipImp.data.summary?.added}, updated=${skipImp.data.summary?.updated}, skipped=${skipImp.data.summary?.skipped}`
    );

    // 9. Re-upload the 100-branch file in UPDATE mode -> names updated, UUIDs preserved
    const updatedBranchRows100 = branchRows100.map((r) =>
      r['Branch Code*'] === '0053' ? { ...r, 'Branch Name*': 'SKZ REGIONAL HUB' } : r
    );
    const updateImp = await apiCall(
      '/api/admin/org/branches/bulk-import',
      'POST',
      { rows: updatedBranchRows100, mode: 'update' },
      adminToken
    );
    const { data: dbBranch0053After } = await supabaseAdmin
      .from('branches')
      .select('id, branch_code, name')
      .eq('branch_code', '0053')
      .single();

    assert(
      updateImp.ok &&
        updateImp.data.summary?.added === 0 &&
        updateImp.data.summary?.updated === 100 &&
        dbBranch0053After?.id === original0053Uuid &&
        dbBranch0053After?.name === 'SKZ REGIONAL HUB',
      '8b. Re-uploading in Update mode updates names in-place while preserving UUIDs',
      `UUID before=${original0053Uuid}, UUID after=${dbBranch0053After?.id}, updated name="${dbBranch0053After?.name}"`
    );

    // Restore "0053" name back to "SKZ" via Update mode
    await apiCall(
      '/api/admin/org/branches/bulk-import',
      'POST',
      { rows: branchRows100, mode: 'update' },
      adminToken
    );

    // 10. Create a Joiner using imported Branch ("0053 | SKZ") and Designation ("0151 | AREA MANAGER")
    //     and confirm the full candidate workflow works end-to-end!
    const orgRes = await apiCall('/api/admin/org-structure', 'GET', null, adminToken);
    const desig0151 = (orgRes.data.designations || []).find(
      (d: any) => d.designation_code === '0151' || d.name === 'AREA MANAGER'
    );
    const zone02 = (orgRes.data.zones || []).find((z: any) => z.zone_code === '02');
    const zone01 = (orgRes.data.zones || []).find((z: any) => z.zone_code === '01');

    // Provision a Central HR user in Zone 02 to create the joiner and review
    const { data: roles } = await supabaseAdmin.from('roles').select('id, name');
    const roleMap = new Map((roles || []).map((r: any) => [r.name, r.id]));

    const chrEmail = `chr.acceptance.${Date.now()}@postex.pk`;
    const chrCreate = await apiCall(
      '/api/admin/staff',
      'POST',
      {
        name: 'Central HR Acceptance Tester',
        email: chrEmail,
        role_id: roleMap.get('central_hr'),
        zone_id: zone02.id,
        department_id: dbDept001!.id,
        designation_id: desig0151.id,
        branch_ids: [original0053Uuid],
      },
      adminToken
    );
    const chrStaffId = chrCreate.data?.staff?.id;
    if (chrStaffId) createdStaffIds.push(chrStaffId);

    const { data: chrAuth } = await supabaseClient.auth.signInWithPassword({
      email: chrEmail,
      password: chrCreate.data.one_time_temporary_password,
    });
    const chrToken = chrAuth.session!.access_token;

    // Also create a Branch Manager for Branch 0053
    const bmEmail = `bm.acceptance.${Date.now()}@postex.pk`;
    const bmCreate = await apiCall(
      '/api/admin/staff',
      'POST',
      {
        name: 'Branch Manager 0053 Tester',
        email: bmEmail,
        role_id: roleMap.get('branch_manager'),
        zone_id: zone02.id,
        department_id: dbDept001!.id,
        designation_id: desig0151.id,
        branch_ids: [original0053Uuid],
      },
      adminToken
    );
    const bmStaffId = bmCreate.data?.staff?.id;
    if (bmStaffId) createdStaffIds.push(bmStaffId);

    const { data: bmAuth } = await supabaseClient.auth.signInWithPassword({
      email: bmEmail,
      password: bmCreate.data.one_time_temporary_password,
    });
    const bmToken = bmAuth.session!.access_token;

    // Create joiner via POST /api/central/joiners using imported branch & designation
    const uniqueCnic = `35202-${String(Date.now()).slice(-7)}-1`;
    const createJoinerRes = await apiCall(
      '/api/central/joiners',
      'POST',
      {
        full_name: 'Tariq Mahmood Joiner',
        cnic: uniqueCnic,
        mobile: '03001112233',
        email: 'tariq.joiner@example.com',
        designation_id: desig0151.id,
        branch_id: original0053Uuid,
        track: 'executive',
      },
      chrToken
    );

    createdCandidateId = createJoinerRes.data?.candidate?.id || null;
    createdAppId = createJoinerRes.data?.application?.id || null;

    assert(
      createJoinerRes.ok && Boolean(createdCandidateId) && Boolean(createdAppId),
      '9a. Created Joiner using imported Branch ("0053 | SKZ") and Designation ("0151 | AREA MANAGER")',
      `joining_id=${createJoinerRes.data?.candidate?.joining_id}, branch_id=${original0053Uuid}`
    );

    // Candidate requests OTP, verifies OTP, and submits application
    const otpReq = await fetch(`${BASE_URL}/api/candidate-auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        joining_id: createJoinerRes.data.candidate.joining_id,
        cnic: uniqueCnic,
        mobile: '03001112233',
      }),
    }).then((r) => r.json());

    const otpVerify = await fetch(`${BASE_URL}/api/candidate-auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_id: createdCandidateId,
        otp: otpReq._test_otp,
      }),
    }).then((r) => r.json());

    const candToken = otpVerify.token;
    assert(Boolean(candToken), '9b. Candidate authenticated via OTP and received scoped JWT');

    // Save Step 1..6 and Submit Application
    for (let s = 1; s <= 6; s++) {
      await apiCall(
        `/api/candidate/application/step/${s}`,
        'PUT',
        { data: { test_field: `Step ${s} completed` }, is_completed: true },
        candToken
      );
    }
    const submitRes = await apiCall('/api/candidate/application/submit', 'POST', {}, candToken);
    assert(
      submitRes.ok && submitRes.data?.status === 'submitted',
      '9c. Candidate submitted application (status -> submitted)'
    );

    // Branch Manager verifies & forwards to Central HR
    const bmVerifyRes = await apiCall(
      `/api/bm/applications/${createdAppId}/verify`,
      'POST',
      { general_remarks: 'Verified at SKZ Branch 0053' },
      bmToken
    );
    assert(
      bmVerifyRes.ok,
      '9d. Branch Manager of imported Branch 0053 verified application'
    );

    // Central HR approves application -> generates employee record
    const chrApproveRes = await apiCall(
      `/api/central/applications/${createdAppId}/decision`,
      'POST',
      { decision: 'approved', remarks: 'Approved for SKZ 0053 Area Manager' },
      chrToken
    );
    assert(
      chrApproveRes.ok && Boolean(chrApproveRes.data?.employee?.employee_id),
      '9e. Central HR approved application and generated Employee ID end-to-end',
      `employee_id=${chrApproveRes.data?.employee?.employee_id}`
    );

    // 11. Create a Zonal HR user with a zone (Zone 02) and tagged branches, and confirm they ONLY see branches of their own zone
    const zhrEmail = `zhr.acceptance.${Date.now()}@postex.pk`;
    const zhrCreate = await apiCall(
      '/api/admin/staff',
      'POST',
      {
        name: 'Zonal HR South Zone 02',
        email: zhrEmail,
        role_id: roleMap.get('zonal_hr_manager'),
        zone_id: zone02.id,
        department_id: dbDept001!.id,
        designation_id: desig0151.id,
        branch_ids: [original0053Uuid],
      },
      adminToken
    );
    const zhrStaffId = zhrCreate.data?.staff?.id;
    if (zhrStaffId) createdStaffIds.push(zhrStaffId);

    const { data: zhrAuth } = await supabaseClient.auth.signInWithPassword({
      email: zhrEmail,
      password: zhrCreate.data.one_time_temporary_password,
    });
    const zhrToken = zhrAuth.session!.access_token;

    const zonalStaffRes = await apiCall('/api/zonal/staff', 'GET', null, zhrToken);
    const zonalBranches: any[] = zonalStaffRes.data?.branches || [];
    const hcContextRes = await apiCall('/api/headcount/context', 'GET', null, zhrToken);
    const hcBranches: any[] = hcContextRes.data?.branches || [];

    const allZonalBranchesInZone02 =
      zonalBranches.length > 0 &&
      zonalBranches.every((b) => !b.zone_id || b.zone_id === zone02.id) &&
      !zonalBranches.some((b) => b.branch_code === '0001'); // 0001 is in Zone 01!

    const allHcBranchesInZone02 =
      hcBranches.length > 0 &&
      hcBranches.every((b) => b.zone_id === zone02.id) &&
      !hcBranches.some((b) => b.zone_id === zone01.id);

    assert(
      allZonalBranchesInZone02 && allHcBranchesInZone02,
      '10. Zonal HR user assigned to Zone 02 with tagged branches ONLY sees branches of their own zone',
      `zonal/staff branches=${zonalBranches.length} (0 from Zone 01), headcount/context branches=${hcBranches.length} (all in Zone 02)`
    );
  } finally {
    // Clean up test artifacts created during this run so we leave DB clean
    if (createdAppId) {
      await supabaseAdmin.from('employees').delete().eq('application_id', createdAppId);
      await supabaseAdmin.from('hr_decisions').delete().eq('application_id', createdAppId);
      await supabaseAdmin.from('verification_remarks').delete().eq('application_id', createdAppId);
      await supabaseAdmin.from('application_steps').delete().eq('application_id', createdAppId);
      await supabaseAdmin.from('applications').delete().eq('id', createdAppId);
    }
    if (createdCandidateId) {
      await supabaseAdmin.from('candidate_otps').delete().eq('candidate_id', createdCandidateId);
      await supabaseAdmin.from('candidates').delete().eq('id', createdCandidateId);
    }
    for (const sid of createdStaffIds) {
      await supabaseAdmin.from('staff_branch_assignments').delete().eq('staff_profile_id', sid);
      await supabaseAdmin.from('staff_profiles').delete().eq('id', sid);
      await supabaseAdmin.auth.admin.deleteUser(sid).catch(() => {});
    }
    if (importedBranchCodes.length > 0) {
      await supabaseAdmin.from('branches').delete().in('branch_code', importedBranchCodes);
    }
  }

  console.log('\n==============================================================================');
  console.log(`ACCEPTANCE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==============================================================================');
  if (failed > 0) process.exit(1);
}

runAcceptanceTests().catch((err) => {
  console.error('Fatal error in acceptance tests:', err);
  process.exit(1);
});
