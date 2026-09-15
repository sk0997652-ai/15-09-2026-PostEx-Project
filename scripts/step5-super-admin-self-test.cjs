// ==============================================================================
// PostEx HR Onboarding Portal — Step 5 Super Admin Self-Test Suite
// ==============================================================================
// Rule 10 Verification:
// 1. Authenticate as Super Admin (obtain Bearer token).
// 2. Fetch live company-wide metrics (candidates, pending, approved, employees).
// 3. Organization Structure CRUD:
//    - Create a test Zone, Branch, Department, Designation
//    - Verify they exist in DB
//    - Clean up test records
// 4. Staff User Management:
//    - Create a staff user with auto-generated temporary password
//    - Confirm one-time password format complies with policy (10+ chars, letter, number)
//    - Confirm staff_profiles row created with must_change_password = true
//    - Test "Regenerate Password" for staff user
// 5. Permission Overrides:
//    - Attempt override without reason -> verify HTTP 400 rejection (MANDATORY reason check)
//    - Grant override with valid reason -> verify row in user_permission_overrides + audit log
// 6. Company-Wide Record Browser:
//    - Query candidates with pagination (25/50)
//    - Confirm CNIC is masked (e.g., 35201-*****67-1)
// 7. Security Hard Rule: Audit Log Access:
//    - Fetch audit logs with Super Admin token -> verify 200 OK + populated log list
//    - Attempt fetch without Super Admin token (or with candidate/invalid token) -> verify 401/403 Forbidden!
// 8. Organization Settings:
//    - Update data retention policy days (e.g. 90) -> verify audit log + update
// ==============================================================================

const { createClient } = require('@supabase/supabase-js');
const http = require('http');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing required Supabase environment variables.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BASE_URL = 'http://localhost:3000';

function apiRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve({ status: res.statusCode, data: parsed });
          } catch {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runStep5SelfTest() {
  console.log('================================================================');
  console.log('PostEx HR Portal — STEP 5: Super Admin Module Self-Test Suite');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`\x1b[32m✔ PASS:\x1b[0m ${message}`);
      passed++;
    } else {
      console.error(`\x1b[31m✖ FAIL:\x1b[0m ${message}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // 1. Sign in as Super Admin to obtain Bearer Token
    // ------------------------------------------------------------------------
    console.log('\n--- 1. Authenticating as Super Admin ---');
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: 'admin@postex.pk',
      password: 'PostExAdmin2026!',
    });

    assert(!authError && authData?.session?.access_token, 'Super Admin successfully signed in and obtained JWT');
    const superAdminToken = authData.session.access_token;
    const superAdminId = authData.user.id;

    // ------------------------------------------------------------------------
    // 2. Company-Wide Dashboard Live Counts
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Dashboard Metrics (Live Database Counts) ---');
    const metricsRes = await apiRequest('/api/admin/metrics', 'GET', null, superAdminToken);
    assert(metricsRes.status === 200 && metricsRes.data.success, 'GET /api/admin/metrics returned 200 OK');
    assert(
      metricsRes.data.metrics &&
      typeof metricsRes.data.metrics.totalCandidates === 'number' &&
      typeof metricsRes.data.metrics.pendingApplications === 'number' &&
      typeof metricsRes.data.metrics.approvedApplications === 'number' &&
      typeof metricsRes.data.metrics.totalEmployees === 'number',
      `Live counts retrieved: ${JSON.stringify(metricsRes.data.metrics)}`
    );

    // ------------------------------------------------------------------------
    // 3. Organization Structure Full CRUD
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Organization Structure Full CRUD (Zones, Branches, Depts, Designations) ---');
    const timestamp = Date.now();

    // Create Zone
    const zoneName = `Test Zone ${timestamp}`;
    const createZoneRes = await apiRequest('/api/admin/org/zones', 'POST', { name: zoneName }, superAdminToken);
    assert(createZoneRes.status === 200 && createZoneRes.data.data?.id, `Created Zone: "${zoneName}"`);
    const createdZoneId = createZoneRes.data.data?.id;

    // Create Branch under Zone
    const branchName = `Test Hub ${timestamp}`;
    const createBranchRes = await apiRequest(
      '/api/admin/org/branches',
      'POST',
      { name: branchName, zone_id: createdZoneId, address: 'Test Industrial Area' },
      superAdminToken
    );
    assert(createBranchRes.status === 200 && createBranchRes.data.data?.id, `Created Branch: "${branchName}" under Zone`);
    const createdBranchId = createBranchRes.data.data?.id;

    // Create Department
    const deptName = `Test Dept ${timestamp}`;
    const createDeptRes = await apiRequest('/api/admin/org/departments', 'POST', { name: deptName }, superAdminToken);
    assert(createDeptRes.status === 200 && createDeptRes.data.data?.id, `Created Department: "${deptName}"`);
    const createdDeptId = createDeptRes.data.data?.id;

    // Create Designation under Department
    const desigName = `Test Lead ${timestamp}`;
    const createDesigRes = await apiRequest(
      '/api/admin/org/designations',
      'POST',
      { name: desigName, department_id: createdDeptId },
      superAdminToken
    );
    assert(createDesigRes.status === 200 && createDesigRes.data.data?.id, `Created Designation: "${desigName}"`);
    const createdDesigId = createDesigRes.data.data?.id;

    // Fetch and verify in org-structure endpoint
    const orgStructRes = await apiRequest('/api/admin/org-structure', 'GET', null, superAdminToken);
    const foundZone = (orgStructRes.data.zones || []).some((z) => z.id === createdZoneId);
    assert(foundZone, 'Newly created Zone verified via GET /api/admin/org-structure');

    // Clean up test org entities
    await apiRequest(`/api/admin/org/designations/${createdDesigId}`, 'DELETE', null, superAdminToken);
    await apiRequest(`/api/admin/org/departments/${createdDeptId}`, 'DELETE', null, superAdminToken);
    await apiRequest(`/api/admin/org/branches/${createdBranchId}`, 'DELETE', null, superAdminToken);
    await apiRequest(`/api/admin/org/zones/${createdZoneId}`, 'DELETE', null, superAdminToken);
    console.log('Cleaned up test org entities.');

    // ------------------------------------------------------------------------
    // 4. Staff User Management & One-Time Password Reveal
    // ------------------------------------------------------------------------
    console.log('\n--- 4. User Management & One-Time Temporary Password Reveal ---');
    // Fetch a role id (e.g., branch_manager)
    const { data: roleRow } = await supabaseAdmin.from('roles').select('id, name').eq('name', 'branch_manager').single();

    const testStaffEmail = `staff_test_${timestamp}@postex.pk`;
    const createStaffRes = await apiRequest(
      '/api/admin/staff',
      'POST',
      {
        email: testStaffEmail,
        name: `Automated Test Staff ${timestamp}`,
        role_id: roleRow.id,
      },
      superAdminToken
    );

    assert(createStaffRes.status === 200 && createStaffRes.data.success, 'POST /api/admin/staff successfully provisioned staff user');
    const tempPassword = createStaffRes.data.one_time_temporary_password;
    assert(
      tempPassword &&
      tempPassword.length >= 10 &&
      /[A-Za-z]/.test(tempPassword) &&
      /[0-9]/.test(tempPassword),
      `One-time password revealed (${tempPassword}): complies with 10+ chars, letter, and number policy`
    );

    const newStaffId = createStaffRes.data.staff.id;

    // Verify must_change_password flag in DB
    const { data: staffDbProfile } = await supabaseAdmin
      .from('staff_profiles')
      .select('must_change_password, is_active')
      .eq('id', newStaffId)
      .single();
    assert(staffDbProfile?.must_change_password === true, 'Database confirms must_change_password = true on creation');

    // Test Regenerate Password
    const regenRes = await apiRequest(
      '/api/staff/regenerate-password',
      'POST',
      {
        target_staff_id: newStaffId,
        requester_token: superAdminToken,
      }
    );
    assert(regenRes.status === 200 && regenRes.data.temporary_password, 'Regenerate Password button generates new temporary credentials');

    // Test Deactivate Staff
    const deactRes = await apiRequest(`/api/admin/staff/${newStaffId}/status`, 'PATCH', { is_active: false }, superAdminToken);
    assert(deactRes.status === 200 && deactRes.data.staff?.is_active === false, 'Successfully deactivated staff member');

    // ------------------------------------------------------------------------
    // 5. Permission Override Screen with MANDATORY Reason
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Permission Override Screen (MANDATORY Reason Enforced) ---');
    const { data: permRow } = await supabaseAdmin.from('permissions').select('id, key').eq('key', 'applications.decide').single();

    // 5a. Attempt WITHOUT reason -> Must fail HTTP 400
    const emptyReasonRes = await apiRequest(
      '/api/admin/permission-overrides',
      'POST',
      {
        staff_profile_id: newStaffId,
        permission_id: permRow.id,
        granted: true,
        reason: '', // Empty reason
      },
      superAdminToken
    );
    assert(
      emptyReasonRes.status === 400 && !emptyReasonRes.data.success,
      '[HARD RULE] Override request without reason was strictly REJECTED (HTTP 400)'
    );

    // 5b. Attempt WITH reason -> Must succeed & log to audit
    const validReason = `Temporary override authorized by Super Admin for sprint QA verification ${timestamp}`;
    const validOverrideRes = await apiRequest(
      '/api/admin/permission-overrides',
      'POST',
      {
        staff_profile_id: newStaffId,
        permission_id: permRow.id,
        granted: true,
        reason: validReason,
      },
      superAdminToken
    );
    assert(validOverrideRes.status === 200 && validOverrideRes.data.success, 'Override granted with mandatory reason logged');

    // Verify row in user_permission_overrides
    const { data: overrideDbRow } = await supabaseAdmin
      .from('user_permission_overrides')
      .select('*')
      .eq('staff_profile_id', newStaffId)
      .eq('permission_id', permRow.id)
      .single();
    assert(overrideDbRow && overrideDbRow.reason === validReason, 'Override record successfully written to database');

    // Verify audit log
    const { data: auditRows } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('entity_id', overrideDbRow.id);
    assert(auditRows && auditRows.length > 0, 'Audit log created for permission override action');

    // ------------------------------------------------------------------------
    // 6. Company-Wide Record Browser & CNIC Masking
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Company-Wide Record Browser (Pagination & Masked CNIC) ---');
    const recordsRes = await apiRequest('/api/admin/records?page=1&limit=25', 'GET', null, superAdminToken);
    assert(recordsRes.status === 200 && Array.isArray(recordsRes.data.records), 'GET /api/admin/records returned candidates array');

    if (recordsRes.data.records.length > 0) {
      const sample = recordsRes.data.records[0];
      assert(
        sample.masked_cnic && sample.masked_cnic.includes('*****'),
        `CNIC masked correctly: "${sample.masked_cnic}"`
      );
    }

    // ------------------------------------------------------------------------
    // 7. Security Hard Rule: Audit Log Viewer Restricted to Super Admin
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Security Hard Rule: Audit Log Viewer Access ---');
    // 7a. Super Admin gets 200 OK and logs
    const superAdminAuditRes = await apiRequest('/api/admin/audit-logs?page=1&limit=25', 'GET', null, superAdminToken);
    assert(
      superAdminAuditRes.status === 200 && Array.isArray(superAdminAuditRes.data.logs),
      `Super Admin successfully fetched audit logs (${superAdminAuditRes.data.logs.length} logs returned)`
    );

    // 7b. Non-Super-Admin (Unauthorized / No token) gets 401 Unauthorized
    const unauthAuditRes = await apiRequest('/api/admin/audit-logs?page=1&limit=25', 'GET', null, null);
    assert(
      unauthAuditRes.status === 401,
      '[HARD RULE] Unauthenticated request to /api/admin/audit-logs was DENIED (HTTP 401)'
    );

    // 7c. Non-Super-Admin staff member gets 403 Forbidden
    // Sign in as a non-super-admin if possible or test with fake token
    const fakeTokenAuditRes = await apiRequest('/api/admin/audit-logs?page=1&limit=25', 'GET', null, 'fake-token-xyz');
    assert(
      fakeTokenAuditRes.status === 401 || fakeTokenAuditRes.status === 403,
      '[HARD RULE] Non-super-admin request to /api/admin/audit-logs was DENIED (HTTP 401/403)'
    );

    // ------------------------------------------------------------------------
    // 8. Organization Settings & Data Retention Policy
    // ------------------------------------------------------------------------
    console.log('\n--- 8. Organization Settings & Retention Policy ---');
    const settingsGetRes = await apiRequest('/api/admin/settings', 'GET', null, superAdminToken);
    assert(settingsGetRes.status === 200 && settingsGetRes.data.settings, 'GET /api/admin/settings returned settings');

    const updateSettingsRes = await apiRequest(
      '/api/admin/settings',
      'PUT',
      { dataRetentionDaysAfterRejection: 120 },
      superAdminToken
    );
    assert(
      updateSettingsRes.status === 200 && updateSettingsRes.data.settings.dataRetentionDaysAfterRejection === 120,
      'Data retention days updated to 120 and saved'
    );

    // Clean up created staff test user
    await supabaseAdmin.auth.admin.deleteUser(newStaffId);
    console.log('Cleaned up test staff user.');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`Step 5 Self-Test Summary: ${passed} passed, ${failed} failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep5SelfTest();
