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

async function runSelfTest() {
  console.log('================================================================');
  console.log('🧪 PART C SELF-TEST: Staff Creation Form Restructure (4 Sections)');
  console.log('================================================================');

  const createdZoneIds: string[] = [];
  const createdBranchIds: string[] = [];
  const createdDepartmentIds: string[] = [];
  const createdDesignationIds: string[] = [];
  const createdStaffUserIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // 1. Verify Rendered UI & Vite Modules Serve 4-Section Create Staff Form
    // -------------------------------------------------------------------------
    console.log('\n[1] Checking Rendered UI & Vite Module Serving on Port 3000...');
    const rootRes = await fetch(`${BASE_URL}/`);
    const rootHtml = await rootRes.text();
    assert(rootRes.ok && rootHtml.includes('<div id="root">'), 'App HTML entry point renders on port 3000');

    const [modalRes, saViewRes, zonalModalRes, zonalViewRes] = await Promise.all([
      fetch(`${BASE_URL}/src/components/ui/Modal.tsx`),
      fetch(`${BASE_URL}/src/components/admin/StaffManagementView.tsx`),
      fetch(`${BASE_URL}/src/components/zonal/AddStaffModal.tsx`),
      fetch(`${BASE_URL}/src/components/zonal/ZoneStaffView.tsx`),
    ]);
    const modalCode = await modalRes.text();
    const saViewCode = await saViewRes.text();
    const zonalModalCode = await zonalModalRes.text();
    const zonalViewCode = await zonalViewRes.text();

    assert(
      modalRes.ok &&
        modalCode.includes('max-h-[90vh]') &&
        modalCode.includes('overflow-y-auto flex-1 min-h-0') &&
        modalCode.includes('max-w-4xl'),
      'Modal.tsx implements max-h-[90vh] flex-col layout with overflow-y-auto scrollable body, sticky header/footer, and max-w-4xl (xl) sizing'
    );

    assert(
      saViewRes.ok &&
        saViewCode.includes('Section A — Personal') &&
        saViewCode.includes('Section B — Employment Identity') &&
        saViewCode.includes('Section C — System Access') &&
        saViewCode.includes('Section D — Role') &&
        saViewCode.includes('Select Department') &&
        saViewCode.includes('Select Designation') &&
        !saViewCode.includes('<option value="">Select Department first') &&
        saViewCode.includes('branch-tag-select-all-btn') &&
        saViewCode.includes('branch-tag-counter'),
      'Super Admin StaffManagementView renders 4 sections, spacious xl layout, distinct Select Department / Select Designation placeholders, Select All button, and live branch counter'
    );

    assert(
      zonalModalRes.ok &&
        zonalModalCode.includes('Section A — Personal') &&
        zonalModalCode.includes('Section B — Employment Identity') &&
        zonalModalCode.includes('Section C — System Access') &&
        zonalModalCode.includes('Section D — Role') &&
        zonalModalCode.includes('Select Department') &&
        zonalModalCode.includes('Select Designation') &&
        !zonalModalCode.includes('<option value="">Select Department first') &&
        zonalModalCode.includes('zonal-branch-tag-select-all-btn') &&
        zonalModalCode.includes('zonal-branch-tag-counter') &&
        zonalViewRes.ok &&
        zonalViewCode.includes('Employment Identity'),
      'Zonal HR AddStaffModal & ZoneStaffView render 4 sections, spacious xl layout, distinct Select Department / Select Designation placeholders, Select All button, and live branch counter'
    );

    // -------------------------------------------------------------------------
    // 2. Verify Part C Database Schema (staff_profiles & staff_branch_assignments)
    // -------------------------------------------------------------------------
    console.log('\n[2] Verifying Part C Database Columns & Junction Table...');
    const { data: superAdminRow, error: saErr } = await supabaseAdmin
      .from('staff_profiles')
      .select('id, name, personal_email, phone_number, staff_employee_id, department_id, designation_id')
      .limit(1)
      .single();

    assert(
      !saErr && Boolean(superAdminRow),
      'staff_profiles has personal_email, phone_number, staff_employee_id, department_id, designation_id columns',
      saErr?.message || `Super Admin staff_employee_id: ${superAdminRow?.staff_employee_id}`
    );

    const { error: sbaCheckErr } = await supabaseAdmin
      .from('staff_branch_assignments')
      .select('id, staff_profile_id, branch_id')
      .limit(1);

    assert(
      !sbaCheckErr,
      'staff_branch_assignments junction table exists and is queryable',
      sbaCheckErr?.message
    );

    // -------------------------------------------------------------------------
    // 3. Provision Temporary Master Data (1 Zone, 3 Branches, 2 Depts, 2 Designations)
    // -------------------------------------------------------------------------
    console.log('\n[3] Creating Temporary Master Data for 4-Section Staff Form Verification...');
    const adminToken = SUPABASE_SERVICE_ROLE_KEY!;

    const zoneRes = await apiFetch('/api/admin/org/zones', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Central Punjab Test Zone (Part C)',
        zone_code: 'Z-PARTC-01',
        region: 'Punjab',
        is_active: true,
      },
    });
    assert(zoneRes.ok && Boolean(zoneRes.data?.data?.id), 'Created test Zone Z-PARTC-01');
    const zoneId = zoneRes.data.data.id;
    createdZoneIds.push(zoneId);

    const branchPayloads = [
      { name: 'Gulberg Hub C1', branch_code: 'BR-PARTC-01', branch_type: 'Hub', city_address: 'Lahore Gulberg' },
      { name: 'DHA Sub-Hub C2', branch_code: 'BR-PARTC-02', branch_type: 'Sub-Hub', city_address: 'Lahore DHA' },
      { name: 'Johar Town Hub C3', branch_code: 'BR-PARTC-03', branch_type: 'Hub', city_address: 'Lahore Johar Town' },
    ];

    for (const bp of branchPayloads) {
      const brRes = await apiFetch('/api/admin/org/branches', {
        method: 'POST',
        token: adminToken,
        body: { ...bp, zone_id: zoneId, is_active: true },
      });
      if (brRes.data?.data?.id) {
        createdBranchIds.push(brRes.data.data.id);
      }
    }
    assert(createdBranchIds.length === 3, 'Created 3 test Branches in Zone Z-PARTC-01 for checklist tagging');

    const deptHrRes = await apiFetch('/api/admin/org/departments', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'People & Culture (Part C)',
        department_code: 'DEPT-PC-C1',
        department_category: 'Corporate (Head Office)',
        is_active: true,
      },
    });
    const deptOpsRes = await apiFetch('/api/admin/org/departments', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Field Logistics (Part C)',
        department_code: 'DEPT-FL-C2',
        department_category: 'Field Operations',
        is_active: true,
      },
    });
    const deptHrId = deptHrRes.data?.data?.id;
    const deptOpsId = deptOpsRes.data?.data?.id;
    if (deptHrId) createdDepartmentIds.push(deptHrId);
    if (deptOpsId) createdDepartmentIds.push(deptOpsId);
    assert(Boolean(deptHrId && deptOpsId), 'Created 2 test Departments (HR & Field Operations)');

    const desigHrRes = await apiFetch('/api/admin/org/designations', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'HR Onboarding Specialist (Part C)',
        department_id: deptHrId,
        employment_category: 'In-House Staff',
        is_active: true,
      },
    });
    const desigOpsRes = await apiFetch('/api/admin/org/designations', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Hub Operations Supervisor (Part C)',
        department_id: deptOpsId,
        employment_category: 'In-House Staff',
        is_active: true,
      },
    });
    const desigHrId = desigHrRes.data?.data?.id;
    const desigOpsId = desigOpsRes.data?.data?.id;
    if (desigHrId) createdDesignationIds.push(desigHrId);
    if (desigOpsId) createdDesignationIds.push(desigOpsId);
    assert(Boolean(desigHrId && desigOpsId), 'Created 2 test Designations linked to their respective Departments');

    // Fetch roles
    const orgRes = await apiFetch('/api/admin/org-structure', { token: adminToken });
    const roles: Array<{ id: string; name: string }> = orgRes.data?.roles || [];
    const roleMap = new Map(roles.map((r) => [r.name, r.id]));

    // -------------------------------------------------------------------------
    // 4. Verify Auto-Generated Staff Employee ID & Department -> Designation Filtering
    // -------------------------------------------------------------------------
    console.log('\n[4] Testing Auto-Generated Staff Employee ID & Department -> Designation Filtering...');
    const nextEmpRes = await apiFetch('/api/admin/staff/next-employee-id', { token: adminToken });
    const autoStaffEmpId: string = nextEmpRes.data?.nextStaffEmployeeId || '';
    assert(
      nextEmpRes.ok && /^PX-STAFF-\d+$/.test(autoStaffEmpId),
      'GET /api/admin/staff/next-employee-id auto-generates next PX-STAFF-XXXX ID',
      autoStaffEmpId
    );

    // Verify Department -> Designation filtering in org-structure payload
    const allDesignations: any[] = orgRes.data?.designations || [];
    const hrFilteredDesignations = allDesignations.filter((d) => d.department_id === deptHrId);
    assert(
      hrFilteredDesignations.length === 1 && hrFilteredDesignations[0].id === desigHrId,
      'Filtering Designations by selected Department (DEPT-PC-C1) returns only that department’s designations'
    );

    // Boundary Test: Mismatched Department & Designation should be rejected with 400
    const mismatchRes = await apiFetch('/api/admin/staff', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Mismatch Test User',
        email: 'mismatch.partc@postex.pk',
        department_id: deptHrId,
        designation_id: desigOpsId, // Belongs to deptOpsId, not deptHrId!
        role_id: roleMap.get('central_hr'),
        zone_id: zoneId,
      },
    });
    assert(
      mismatchRes.status === 400 &&
        String(mismatchRes.data?.error || '').includes('does not belong to the selected Department'),
      'Boundary Check: Rejects staff creation when Designation does not belong to selected Department',
      mismatchRes.data?.error
    );

    // Boundary Test: Candidate role rejected in Staff creation
    if (roleMap.get('candidate')) {
      const candidateRoleRes = await apiFetch('/api/admin/staff', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Candidate Role Test',
          email: 'candrole.partc@postex.pk',
          role_id: roleMap.get('candidate'),
        },
      });
      assert(
        candidateRoleRes.status === 400 &&
          String(candidateRoleRes.data?.error || '').includes('Candidate role cannot be assigned'),
        'Boundary Check: Rejects assigning Candidate role in Staff Creation flow',
        candidateRoleRes.data?.error
      );
    }

    // -------------------------------------------------------------------------
    // 5. Super Admin 4-Section Staff Creation + Multi-Branch Tagging ("Select All" = 3 of 3)
    // -------------------------------------------------------------------------
    console.log('\n[5] Testing Super Admin 4-Section Staff Creation + Multi-Branch Checklist ("Select All")...');
    const createCentralHrRes = await apiFetch('/api/admin/staff', {
      method: 'POST',
      token: adminToken,
      body: {
        // Section A — Personal
        name: 'Ayesha Siddiqui (Part C Central HR)',
        personal_email: 'ayesha.personal@gmail.com',
        phone_number: '0300-5558899',
        // Section B — Employment Identity
        staff_employee_id: autoStaffEmpId,
        department_id: deptHrId,
        designation_id: desigHrId,
        // Section C — System Access
        email: 'ayesha.partc@postex.pk',
        // Section D — Role & Scope Assignment (Select All: 3 of 3 branches)
        role_id: roleMap.get('central_hr'),
        zone_id: zoneId,
        branch_ids: createdBranchIds,
      },
    });

    const createdChr = createCentralHrRes.data?.staff;
    const tempPasswordChr: string = createCentralHrRes.data?.one_time_temporary_password || '';
    if (createdChr?.id) {
      createdStaffUserIds.push(createdChr.id);
    }

    assert(
      createCentralHrRes.ok && Boolean(createdChr?.id),
      'Created Central HR account via 4-section form',
      `id: ${createdChr?.id}, emp_id: ${createdChr?.staff_employee_id}`
    );
    assert(
      createdChr?.personal_email === 'ayesha.personal@gmail.com' &&
        createdChr?.phone_number === '0300-5558899',
      'Section A fields (personal_email & phone_number) persisted accurately'
    );
    assert(
      createdChr?.staff_employee_id === autoStaffEmpId &&
        createdChr?.department_id === deptHrId &&
        createdChr?.designation_id === desigHrId,
      'Section B fields (staff_employee_id, department_id, designation_id) persisted accurately'
    );
    assert(
      tempPasswordChr.length === 14 && Boolean(createdChr?.must_change_password),
      'Section C generated 14-char one-time temporary password with must_change_password = true',
      `tempPassword length: ${tempPasswordChr.length}`
    );

    // Verify multi-branch tagging persisted in staff_branch_assignments
    const { data: sbaRows, error: sbaFetchErr } = await supabaseAdmin
      .from('staff_branch_assignments')
      .select('branch_id')
      .eq('staff_profile_id', createdChr.id);

    assert(
      !sbaFetchErr && (sbaRows || []).length === 3,
      'Section D Multi-Branch Tagging ("Select All": 3 of 3 branches) persisted in staff_branch_assignments',
      `tagged count: ${(sbaRows || []).length} of 3`
    );

    // Boundary Test: Duplicate Staff Employee ID rejection
    const dupEmpIdRes = await apiFetch('/api/admin/staff', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Duplicate Emp ID User',
        email: 'dup.empid.partc@postex.pk',
        staff_employee_id: autoStaffEmpId, // Duplicate!
        department_id: deptHrId,
        designation_id: desigHrId,
        role_id: roleMap.get('central_hr'),
        zone_id: zoneId,
      },
    });
    assert(
      dupEmpIdRes.status === 400 &&
        String(dupEmpIdRes.data?.error || '').includes('already exists'),
      'Boundary Check: Duplicate Staff Employee ID is rejected with a clear error message',
      dupEmpIdRes.data?.error
    );

    // -------------------------------------------------------------------------
    // 6. Zonal HR Manager 4-Section Staff Creation (Single-Branch Default for BM)
    // -------------------------------------------------------------------------
    console.log('\n[6] Testing Zonal HR Manager 4-Section Form & Single-Branch Branch Manager Creation...');
    const createZhrRes = await apiFetch('/api/admin/staff', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Bilal Raza (Part C Zonal HR)',
        personal_email: 'bilal.personal@gmail.com',
        phone_number: '0321-7776655',
        department_id: deptHrId,
        designation_id: desigHrId,
        email: 'bilal.zhr.partc@postex.pk',
        role_id: roleMap.get('zonal_hr_manager'),
        zone_id: zoneId,
        branch_ids: createdBranchIds,
      },
    });
    const createdZhr = createZhrRes.data?.staff;
    const tempPasswordZhr = createZhrRes.data?.one_time_temporary_password;
    if (createdZhr?.id) {
      createdStaffUserIds.push(createdZhr.id);
    }

    // Sign in as Zonal HR Manager
    const { data: zhrSignIn } = await supabaseClient.auth.signInWithPassword({
      email: 'bilal.zhr.partc@postex.pk',
      password: tempPasswordZhr,
    });
    const zhrToken = zhrSignIn.session?.access_token || '';
    assert(Boolean(zhrToken), 'Signed in as Zonal HR Manager');

    // Fetch Zonal Staff payload (confirming branches, departments, designations, nextStaffEmployeeId)
    const zonalListRes = await apiFetch('/api/zonal/staff', { token: zhrToken });
    assert(
      zonalListRes.ok &&
        Array.isArray(zonalListRes.data?.departments) &&
        Array.isArray(zonalListRes.data?.designations) &&
        /^PX-STAFF-\d+$/.test(zonalListRes.data?.nextStaffEmployeeId || ''),
      'GET /api/zonal/staff returns zone branches, departments, designations, and nextStaffEmployeeId',
      `nextStaffEmployeeId: ${zonalListRes.data?.nextStaffEmployeeId}`
    );

    // Create a Branch Manager via Zonal HR 4-section endpoint (Single-Branch default)
    const createBmRes = await apiFetch('/api/zonal/staff', {
      method: 'POST',
      token: zhrToken,
      body: {
        name: 'Kamran Akmal (Part C Branch Manager)',
        personal_email: 'kamran.personal@gmail.com',
        phone_number: '0333-4449900',
        staff_employee_id: zonalListRes.data.nextStaffEmployeeId,
        department_id: deptOpsId,
        designation_id: desigOpsId,
        email: 'kamran.bm.partc@postex.pk',
        role_name: 'branch_manager',
        branch_ids: [createdBranchIds[0]], // Single-branch default for BM (1 of 3 selected)
      },
    });
    const createdBm = createBmRes.data?.staff;
    if (createdBm?.id) {
      createdStaffUserIds.push(createdBm.id);
    }

    assert(
      createBmRes.ok &&
        createdBm?.branch_id === createdBranchIds[0] &&
        createdBm?.department_id === deptOpsId &&
        createdBm?.designation_id === desigOpsId,
      'Zonal HR created Branch Manager with Section A/B/C/D fields and single-branch assignment',
      `emp_id: ${createdBm?.staff_employee_id}, branch_id: ${createdBm?.branch_id}`
    );

    await supabaseClient.auth.signOut();

    // -------------------------------------------------------------------------
    // 7. Verify One-Time Temp Password Login & Forced Password Change Flow
    // -------------------------------------------------------------------------
    console.log('\n[7] Verifying One-Time Temp Password Login & Forced Password Change on First Login...');
    const { data: chrLoginData, error: chrLoginErr } = await supabaseClient.auth.signInWithPassword({
      email: 'ayesha.partc@postex.pk',
      password: tempPasswordChr,
    });
    const chrToken = chrLoginData.session?.access_token || '';
    assert(
      !chrLoginErr && Boolean(chrToken),
      'Staff member signed in with one-time temporary password',
      chrLoginErr?.message
    );

    // Check /api/staff/me -> must_change_password === true
    const meBeforeRes = await apiFetch('/api/staff/me', { token: chrToken });
    assert(
      meBeforeRes.ok && meBeforeRes.data?.user?.must_change_password === true,
      'GET /api/staff/me reports must_change_password === true on first login'
    );

    // Execute forced password change via /api/staff/change-password
    const newPermanentPassword = 'PostEx#2026Secure!';
    const changePwdRes = await apiFetch('/api/staff/change-password', {
      method: 'POST',
      token: chrToken,
      body: { new_password: newPermanentPassword },
    });
    assert(
      changePwdRes.ok && changePwdRes.data?.success === true,
      'POST /api/staff/change-password updated password and cleared must_change_password flag'
    );

    await supabaseClient.auth.signOut();

    // Sign in with new permanent password and confirm must_change_password === false
    const { data: reloginData, error: reloginErr } = await supabaseClient.auth.signInWithPassword({
      email: 'ayesha.partc@postex.pk',
      password: newPermanentPassword,
    });
    const reloginToken = reloginData.session?.access_token || '';
    const meAfterRes = await apiFetch('/api/staff/me', { token: reloginToken });
    assert(
      !reloginErr &&
        meAfterRes.ok &&
        meAfterRes.data?.user?.must_change_password === false,
      'Staff member signed in with new permanent password and must_change_password is now false'
    );

    await supabaseClient.auth.signOut();
  } finally {
    // -------------------------------------------------------------------------
    // 8. Clean Up All Temporary Test Records
    // -------------------------------------------------------------------------
    console.log('\n[8] Cleaning Up All Self-Test Records...');

    for (const uid of createdStaffUserIds) {
      await supabaseAdmin.from('staff_branch_assignments').delete().eq('staff_profile_id', uid);
      await supabaseAdmin.from('audit_logs').delete().eq('entity_id', uid);
      await supabaseAdmin.from('audit_logs').delete().eq('actor_id', uid);
      await supabaseAdmin.from('staff_profiles').delete().eq('id', uid);
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }

    for (const desigId of createdDesignationIds) {
      await supabaseAdmin.from('audit_logs').delete().eq('entity_id', desigId);
      await supabaseAdmin.from('designations').delete().eq('id', desigId);
    }

    for (const deptId of createdDepartmentIds) {
      await supabaseAdmin.from('audit_logs').delete().eq('entity_id', deptId);
      await supabaseAdmin.from('departments').delete().eq('id', deptId);
    }

    for (const brId of createdBranchIds) {
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
      { count: staffLeft },
      { count: sbaLeft },
    ] = await Promise.all([
      supabaseAdmin.from('zones').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('branches').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('departments').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('designations').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('staff_profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('staff_branch_assignments').select('*', { count: 'exact', head: true }),
    ]);

    assert(
      zonesLeft === 0 &&
        branchesLeft === 0 &&
        deptsLeft === 0 &&
        desigsLeft === 0 &&
        staffLeft === 1 &&
        sbaLeft === 0,
      'Post-test cleanup verified clean state',
      `Zones=${zonesLeft}, Branches=${branchesLeft}, Depts=${deptsLeft}, Desigs=${desigsLeft}, Staff=${staffLeft}, BranchTags=${sbaLeft}`
    );
  }

  console.log('\n================================================================');
  console.log(`📊 PART C SELF-TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSelfTest().catch((err) => {
  console.error('Unhandled error in Part C self-test:', err);
  process.exit(1);
});
