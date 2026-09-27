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

async function runPartASelfTest() {
  console.log('==============================================================================');
  console.log('MASTER DATA SETUP (PART A OF 4) — LIVE END-TO-END & UI FLOW SELF-TEST');
  console.log('==============================================================================\n');

  let createdZoneId: string | null = null;
  let createdZone2Id: string | null = null;
  let createdBranchId: string | null = null;
  let createdDeptId: string | null = null;
  let createdDesigId: string | null = null;
  let createdDesig2Id: string | null = null;
  let superAdminToken = '';

  try {
    // 1. Verify Rendered Frontend HTML & Bundle Serve Cleanly on Port 3000
    const htmlRes = await fetch(`${BASE_URL}/`);
    const htmlText = await htmlRes.text();
    record(
      '1. Rendered App Entry Point (GET /)',
      htmlRes.status === 200 && htmlText.includes('<div id="root">'),
      `HTTP ${htmlRes.status}, HTML root mounted`
    );

    const moduleRes = await fetch(`${BASE_URL}/src/components/admin/OrganizationStructureView.tsx`);
    const moduleText = await moduleRes.text();
    record(
      '2. Rendered OrganizationStructureView Module',
      moduleRes.status === 200 &&
        moduleText.includes('org-input-zone-code') &&
        moduleText.includes('org-input-branch-code') &&
        moduleText.includes('org-input-department-code') &&
        moduleText.includes('org-select-designation-employment-category'),
      `HTTP ${moduleRes.status}, all 4 enhanced entity forms compiled & served by Vite`
    );

    // 2. Authenticate as Super Admin (admin@postex.pk)
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: 'admin@postex.pk',
      password: 'PostExAdmin2026!',
    });

    if (authError || !authData.session) {
      throw new Error(`Super Admin authentication failed: ${authError?.message}`);
    }
    superAdminToken = authData.session.access_token;
    record('3. Super Admin Login (admin@postex.pk)', true, 'Authenticated and obtained valid Bearer JWT');

    // =========================================================================
    // SECTION A: ZONE — Create, Manual Code, Region Dropdown, Status, Duplicate Rejection
    // =========================================================================
    console.log('\n--- Testing 1. ZONE (Name, Manual Zone Code, Region/Province, Status) ---');

    // Boundary check: missing Zone Code
    const zoneMissingCode = await apiCall(
      '/api/admin/org/zones',
      'POST',
      { name: 'Central Punjab Zone', zone_code: '   ', region: 'Punjab', is_active: true },
      superAdminToken
    );
    record(
      '4. Zone Validation — Empty Zone Code Rejected',
      zoneMissingCode.status === 400 && zoneMissingCode.data.error === 'Zone Code is required.',
      `HTTP ${zoneMissingCode.status}: "${zoneMissingCode.data.error}"`
    );

    // Boundary check: missing Region
    const zoneMissingRegion = await apiCall(
      '/api/admin/org/zones',
      'POST',
      { name: 'Central Punjab Zone', zone_code: 'ZN-CPB-01', region: '', is_active: true },
      superAdminToken
    );
    record(
      '5. Zone Validation — Empty Region Rejected',
      zoneMissingRegion.status === 400 && zoneMissingRegion.data.error === 'Region/Province is required.',
      `HTTP ${zoneMissingRegion.status}: "${zoneMissingRegion.data.error}"`
    );

    // Create Real Zone
    const zoneCreate = await apiCall(
      '/api/admin/org/zones',
      'POST',
      {
        name: 'Central Punjab Zone',
        zone_code: 'ZN-CPB-01',
        region: 'Punjab',
        is_active: true,
      },
      superAdminToken
    );
    createdZoneId = zoneCreate.data?.data?.id || null;
    record(
      '6. Zone Create — Real Zone with Manual Code & Region',
      zoneCreate.status === 200 &&
        zoneCreate.data.success === true &&
        zoneCreate.data.data.zone_code === 'ZN-CPB-01' &&
        zoneCreate.data.data.region === 'Punjab' &&
        zoneCreate.data.data.is_active === true,
      `Created Zone ID=${createdZoneId}, code="${zoneCreate.data?.data?.zone_code}", region="${zoneCreate.data?.data?.region}", is_active=${zoneCreate.data?.data?.is_active}`
    );

    // Duplicate Zone Code Rejection (Uniqueness enforced at DB level + formatted error)
    const zoneDupCode = await apiCall(
      '/api/admin/org/zones',
      'POST',
      {
        name: 'Another Punjab Zone',
        zone_code: 'ZN-CPB-01',
        region: 'Sindh',
        is_active: true,
      },
      superAdminToken
    );
    record(
      '7. Zone Uniqueness — Duplicate Zone Code Rejected',
      zoneDupCode.status === 400 &&
        zoneDupCode.data.error === 'Zone Code "ZN-CPB-01" already exists. Please enter a unique Zone Code.',
      `HTTP ${zoneDupCode.status}: "${zoneDupCode.data.error}"`
    );

    // Edit Zone (toggle Status to Inactive & back to Active)
    const zoneEdit = await apiCall(
      `/api/admin/org/zones/${createdZoneId}`,
      'PUT',
      {
        name: 'Central Punjab Zone',
        zone_code: 'ZN-CPB-01',
        region: 'Punjab',
        is_active: false,
      },
      superAdminToken
    );
    record(
      '8. Zone Edit — Status Toggle (Active -> Inactive)',
      zoneEdit.status === 200 && zoneEdit.data?.data?.is_active === false,
      `Updated Zone is_active=${zoneEdit.data?.data?.is_active}`
    );

    // Restore Zone to Active
    await apiCall(
      `/api/admin/org/zones/${createdZoneId}`,
      'PUT',
      { is_active: true },
      superAdminToken
    );

    // =========================================================================
    // SECTION B: BRANCH — Create, Manual Code, Zone, Branch Type, City/Address, Contact, Status, Duplicate Rejection
    // =========================================================================
    console.log('\n--- Testing 2. BRANCH (Name, Manual Branch Code, Zone, Type, City/Address, Contact, Status) ---');

    // Boundary check: missing Branch Type
    const branchMissingType = await apiCall(
      '/api/admin/org/branches',
      'POST',
      {
        name: 'Lahore Main Hub',
        branch_code: 'LHE-HUB-01',
        zone_id: createdZoneId,
        branch_type: '',
        city_address: '14-B Industrial Area, Gulberg III, Lahore',
      },
      superAdminToken
    );
    record(
      '9. Branch Validation — Missing Branch Type Rejected',
      branchMissingType.status === 400 && branchMissingType.data.error === 'Branch Type is required.',
      `HTTP ${branchMissingType.status}: "${branchMissingType.data.error}"`
    );

    // Create Real Branch with all new fields
    const branchCreate = await apiCall(
      '/api/admin/org/branches',
      'POST',
      {
        name: 'Lahore Main Hub',
        branch_code: 'LHE-HUB-01',
        zone_id: createdZoneId,
        branch_type: 'Hub',
        city_address: '14-B Industrial Area, Gulberg III, Lahore',
        contact_number: '042-35761999',
        is_active: true,
      },
      superAdminToken
    );
    createdBranchId = branchCreate.data?.data?.id || null;
    record(
      '10. Branch Create — Real Branch with Manual Code, Type, City/Address & Contact',
      branchCreate.status === 200 &&
        branchCreate.data.success === true &&
        branchCreate.data.data.branch_code === 'LHE-HUB-01' &&
        branchCreate.data.data.branch_type === 'Hub' &&
        branchCreate.data.data.city_address === '14-B Industrial Area, Gulberg III, Lahore' &&
        branchCreate.data.data.contact_number === '042-35761999' &&
        branchCreate.data.data.is_active === true,
      `Created Branch ID=${createdBranchId}, code="${branchCreate.data?.data?.branch_code}", type="${branchCreate.data?.data?.branch_type}", contact="${branchCreate.data?.data?.contact_number}"`
    );

    // Duplicate Branch Code Rejection
    const branchDupCode = await apiCall(
      '/api/admin/org/branches',
      'POST',
      {
        name: 'Lahore Secondary Sub-Hub',
        branch_code: 'LHE-HUB-01',
        zone_id: createdZoneId,
        branch_type: 'Sub-Hub',
        city_address: 'Johar Town, Lahore',
        contact_number: '',
        is_active: true,
      },
      superAdminToken
    );
    record(
      '11. Branch Uniqueness — Duplicate Branch Code Rejected',
      branchDupCode.status === 400 &&
        branchDupCode.data.error === 'Branch Code "LHE-HUB-01" already exists. Please enter a unique Branch Code.',
      `HTTP ${branchDupCode.status}: "${branchDupCode.data.error}"`
    );

    // =========================================================================
    // SECTION C: DEPARTMENT — Create, Manual Code, Category, Status, Duplicate Rejection
    // =========================================================================
    console.log('\n--- Testing 3. DEPARTMENT (Name, Manual Department Code, Category, Status) ---');

    // Boundary check: missing Department Code
    const deptMissingCode = await apiCall(
      '/api/admin/org/departments',
      'POST',
      {
        name: 'Last Mile Fleet Operations',
        department_code: '',
        department_category: 'Field Operations',
        is_active: true,
      },
      superAdminToken
    );
    record(
      '12. Department Validation — Missing Department Code Rejected',
      deptMissingCode.status === 400 && deptMissingCode.data.error === 'Department Code is required.',
      `HTTP ${deptMissingCode.status}: "${deptMissingCode.data.error}"`
    );

    // Create Real Department
    const deptCreate = await apiCall(
      '/api/admin/org/departments',
      'POST',
      {
        name: 'Last Mile Fleet Operations',
        department_code: 'DEPT-LM-01',
        department_category: 'Field Operations',
        is_active: true,
      },
      superAdminToken
    );
    createdDeptId = deptCreate.data?.data?.id || null;
    record(
      '13. Department Create — Real Department with Manual Code & Category',
      deptCreate.status === 200 &&
        deptCreate.data.success === true &&
        deptCreate.data.data.department_code === 'DEPT-LM-01' &&
        deptCreate.data.data.department_category === 'Field Operations' &&
        deptCreate.data.data.is_active === true,
      `Created Department ID=${createdDeptId}, code="${deptCreate.data?.data?.department_code}", category="${deptCreate.data?.data?.department_category}"`
    );

    // Duplicate Department Code Rejection
    const deptDupCode = await apiCall(
      '/api/admin/org/departments',
      'POST',
      {
        name: 'Corporate Finance',
        department_code: 'DEPT-LM-01',
        department_category: 'Corporate (Head Office)',
        is_active: true,
      },
      superAdminToken
    );
    record(
      '14. Department Uniqueness — Duplicate Department Code Rejected',
      deptDupCode.status === 400 &&
        deptDupCode.data.error === 'Department Code "DEPT-LM-01" already exists. Please enter a unique Department Code.',
      `HTTP ${deptDupCode.status}: "${deptDupCode.data.error}"`
    );

    // =========================================================================
    // SECTION D: DESIGNATION — Create, Department Filter, Employment Category (Rider / In-House Staff), Status
    // =========================================================================
    console.log('\n--- Testing 4. DESIGNATION (Title, Department, Employment Category, Status) ---');

    // Boundary check: missing Employment Category
    const desigMissingCat = await apiCall(
      '/api/admin/org/designations',
      'POST',
      {
        name: 'Delivery Rider',
        department_id: createdDeptId,
        employment_category: '',
        is_active: true,
      },
      superAdminToken
    );
    record(
      '15. Designation Validation — Missing Employment Category Rejected',
      desigMissingCat.status === 400 && desigMissingCat.data.error === 'Employment Category is required.',
      `HTTP ${desigMissingCat.status}: "${desigMissingCat.data.error}"`
    );

    // Create Real Designation (Rider)
    const desigCreateRider = await apiCall(
      '/api/admin/org/designations',
      'POST',
      {
        name: 'Delivery Rider',
        department_id: createdDeptId,
        employment_category: 'Rider',
        is_active: true,
      },
      superAdminToken
    );
    createdDesigId = desigCreateRider.data?.data?.id || null;
    record(
      '16. Designation Create (Rider) — Real Designation with Department & Employment Category',
      desigCreateRider.status === 200 &&
        desigCreateRider.data.success === true &&
        desigCreateRider.data.data.employment_category === 'Rider' &&
        desigCreateRider.data.data.department_id === createdDeptId &&
        desigCreateRider.data.data.is_active === true,
      `Created Designation ID=${createdDesigId}, title="${desigCreateRider.data?.data?.name}", employment_category="${desigCreateRider.data?.data?.employment_category}"`
    );

    // Create Second Designation (In-House Staff) & test Edit
    const desigCreateInHouse = await apiCall(
      '/api/admin/org/designations',
      'POST',
      {
        name: 'Hub Operations Supervisor',
        department_id: createdDeptId,
        employment_category: 'In-House Staff',
        is_active: true,
      },
      superAdminToken
    );
    createdDesig2Id = desigCreateInHouse.data?.data?.id || null;
    record(
      '17. Designation Create (In-House Staff) — Real Designation with Employment Category',
      desigCreateInHouse.status === 200 &&
        desigCreateInHouse.data.success === true &&
        desigCreateInHouse.data.data.employment_category === 'In-House Staff' &&
        desigCreateInHouse.data.data.is_active === true,
      `Created Designation ID=${createdDesig2Id}, title="${desigCreateInHouse.data?.data?.name}", employment_category="${desigCreateInHouse.data?.data?.employment_category}"`
    );

    // Verify GET /api/admin/org-structure returns all new columns for the UI tables
    const orgStruct = await apiCall('/api/admin/org-structure', 'GET', null, superAdminToken);
    const zoneRow = (orgStruct.data.zones || []).find((z: any) => z.id === createdZoneId);
    const branchRow = (orgStruct.data.branches || []).find((b: any) => b.id === createdBranchId);
    const deptRow = (orgStruct.data.departments || []).find((d: any) => d.id === createdDeptId);
    const desigRow = (orgStruct.data.designations || []).find((ds: any) => ds.id === createdDesigId);

    record(
      '18. GET /api/admin/org-structure — Full Payload Verification for UI Table Rendering',
      Boolean(
        zoneRow?.zone_code === 'ZN-CPB-01' &&
          zoneRow?.region === 'Punjab' &&
          branchRow?.branch_code === 'LHE-HUB-01' &&
          branchRow?.branch_type === 'Hub' &&
          branchRow?.city_address === '14-B Industrial Area, Gulberg III, Lahore' &&
          branchRow?.contact_number === '042-35761999' &&
          branchRow?.zones?.name === 'Central Punjab Zone' &&
          deptRow?.department_code === 'DEPT-LM-01' &&
          deptRow?.department_category === 'Field Operations' &&
          desigRow?.employment_category === 'Rider' &&
          desigRow?.departments?.name === 'Last Mile Fleet Operations'
      ),
      `Verified Zone(${zoneRow?.zone_code}), Branch(${branchRow?.branch_code}), Dept(${deptRow?.department_code}), Desig(${desigRow?.employment_category}) in org-structure response`
    );
  } finally {
    // Clean up test records so database stays clean for user's real production data entry
    console.log('\n--- Cleaning up self-test records to preserve clean production database state ---');
    if (createdDesig2Id) {
      await supabaseAdmin.from('designations').delete().eq('id', createdDesig2Id);
    }
    if (createdDesigId) {
      await supabaseAdmin.from('designations').delete().eq('id', createdDesigId);
    }
    if (createdDeptId) {
      await supabaseAdmin.from('departments').delete().eq('id', createdDeptId);
    }
    if (createdBranchId) {
      await supabaseAdmin.from('branches').delete().eq('id', createdBranchId);
    }
    if (createdZone2Id) {
      await supabaseAdmin.from('zones').delete().eq('id', createdZone2Id);
    }
    if (createdZoneId) {
      await supabaseAdmin.from('zones').delete().eq('id', createdZoneId);
    }

    // Confirm counts are back to 0
    const [zCount, bCount, dCount, dsCount] = await Promise.all([
      supabaseAdmin.from('zones').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('branches').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('departments').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('designations').select('*', { count: 'exact', head: true }),
    ]);
    record(
      '19. Post-Test Cleanup Verification',
      zCount.count === 0 && bCount.count === 0 && dCount.count === 0 && dsCount.count === 0,
      `Zones=${zCount.count}, Branches=${bCount.count}, Departments=${dCount.count}, Designations=${dsCount.count}`
    );
  }

  const failedCount = results.filter((r) => !r.passed).length;
  console.log('\n==============================================================================');
  console.log(`SELF-TEST SUMMARY: ${results.length - failedCount}/${results.length} PASSED`);
  console.log('==============================================================================');
  if (failedCount > 0) {
    process.exit(1);
  }
}

runPartASelfTest().catch((err) => {
  console.error('Fatal self-test error:', err);
  process.exit(1);
});
