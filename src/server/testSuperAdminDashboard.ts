import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mock-supabase.postex.pk';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const BASE_URL = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runSuperAdminVerification() {
  console.log('================================================================');
  console.log('SUPER ADMIN DASHBOARD EMPIRICAL SELF-TESTING SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Super Admin bypass auth token for API calls
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer super_admin_bypass',
  };

  // TEST 1: Metrics
  console.log('--- TEST 1: Operational Metrics Endpoint ---');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/metrics`, { headers });
    const json = (await res.json()) as any;
    assert(res.ok && json.success === true, 'GET /api/admin/metrics returns HTTP 200 and success: true');
    assert(typeof json.metrics?.totalCandidates === 'number', 'Metrics includes totalCandidates count');
    assert(typeof json.metrics?.totalStaff === 'number', 'Metrics includes totalStaff count');
  } catch (err: any) {
    assert(false, `GET /api/admin/metrics failed: ${err.message}`);
  }

  // TEST 2: Org Structure
  console.log('\n--- TEST 2: Organization Structure Endpoint ---');
  let roleId = '';
  try {
    const res = await fetch(`${BASE_URL}/api/admin/org-structure`, { headers });
    const json = (await res.json()) as any;
    assert(res.ok && json.success === true, 'GET /api/admin/org-structure returns HTTP 200');
    assert(Array.isArray(json.zones) && json.zones.length > 0, 'Org structure contains zones');
    assert(Array.isArray(json.branches), 'Org structure contains branches');
    assert(Array.isArray(json.roles) && json.roles.length > 0, 'Org structure contains system roles');
    roleId = json.roles[0]?.id || '';
  } catch (err: any) {
    assert(false, `GET /api/admin/org-structure failed: ${err.message}`);
  }

  // TEST 3: Staff List & Provisioning
  console.log('\n--- TEST 3: Staff Account Provisioning with Temporary Password ---');
  let testStaffId = '';
  const testEmail = `test.staff.${Date.now()}@postex.pk`;
  try {
    const res = await fetch(`${BASE_URL}/api/admin/staff`, { headers });
    const json = (await res.json()) as any;
    assert(res.ok && json.success === true, 'GET /api/admin/staff returns HTTP 200');
    assert(Array.isArray(json.staff), 'Staff endpoint returns list of staff');

    // Create staff
    const createRes = await fetch(`${BASE_URL}/api/admin/staff`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: testEmail,
        name: 'Verification Staff Member',
        role_id: roleId,
      }),
    });
    const createJson = (await createRes.json()) as any;
    console.log('Create Staff API Response:', createRes.status, createJson);
    assert(createRes.ok && createJson.success === true, 'POST /api/admin/staff provisions new staff');
    assert(Boolean(createJson.one_time_temporary_password), 'One-time temporary password returned');
    assert(createJson.one_time_temporary_password.length >= 10, 'Temporary password meets minimum length requirement (>= 10 chars)');
    testStaffId = createJson.staff?.id;
  } catch (err: any) {
    assert(false, `Staff management test failed: ${err.message}`);
  }

  // TEST 4: Password Regeneration
  console.log('\n--- TEST 4: Credential Regeneration Endpoint ---');
  if (testStaffId) {
    try {
      const regenRes = await fetch(`${BASE_URL}/api/admin/staff/${testStaffId}/regenerate-password`, {
        method: 'POST',
        headers,
      });
      const regenJson = (await regenRes.json()) as any;
      assert(regenRes.ok && regenJson.success === true, 'POST /api/admin/staff/:id/regenerate-password succeeds');
      assert(Boolean(regenJson.temporary_password), 'Regenerated temporary password returned');
    } catch (err: any) {
      assert(false, `Password regeneration failed: ${err.message}`);
    }
  }

  // TEST 5: User Permissions & Overrides
  console.log('\n--- TEST 5: Granular User Permissions with Mandatory Reason ---');
  if (testStaffId) {
    try {
      const permRes = await fetch(`${BASE_URL}/api/admin/permission-overrides/${testStaffId}`, { headers });
      const permJson = (await permRes.json()) as any;
      assert(permRes.ok && permJson.success === true, 'GET /api/admin/permission-overrides/:id succeeds');
      assert(Array.isArray(permJson.allPermissions), 'All permissions list returned');

      // Save user permissions with mandatory reason
      const saveRes = await fetch(`${BASE_URL}/api/admin/user-permissions/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          staff_profile_id: testStaffId,
          permissionsState: { candidate_create: true, cnic_override_duplicate: true },
          reason: 'Automated empirical verification test for Super Admin permissions',
        }),
      });
      const saveJson = (await saveRes.json()) as any;
      assert(saveRes.ok && saveJson.success === true, 'POST /api/admin/user-permissions/save succeeds with mandatory justification');

      // Test validation failure without reason
      const failRes = await fetch(`${BASE_URL}/api/admin/user-permissions/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          staff_profile_id: testStaffId,
          permissionsState: { candidate_create: true },
          reason: '   ', // Blank reason
        }),
      });
      assert(failRes.status === 400, 'POST /api/admin/user-permissions/save rejects blank justification reason with HTTP 400');
    } catch (err: any) {
      assert(false, `User permissions test failed: ${err.message}`);
    }
  }

  // TEST 6: Candidate Records Browser
  console.log('\n--- TEST 6: Candidate Records Directory Browser ---');
  try {
    const recRes = await fetch(`${BASE_URL}/api/admin/records?page=1&limit=10`, { headers });
    const recJson = (await recRes.json()) as any;
    assert(recRes.ok && recJson.success === true, 'GET /api/admin/records returns HTTP 200');
    assert(Array.isArray(recJson.records), 'Records array returned with pagination');
    assert(typeof recJson.pagination?.total === 'number', 'Pagination metadata returned');
  } catch (err: any) {
    assert(false, `Records browser test failed: ${err.message}`);
  }

  // TEST 7: Audit Logs
  console.log('\n--- TEST 7: System Audit Logs Trail ---');
  try {
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs?page=1&limit=10`, { headers });
    const auditJson = (await auditRes.json()) as any;
    assert(auditRes.ok && auditJson.success === true, 'GET /api/admin/audit-logs returns HTTP 200');
    assert(Array.isArray(auditJson.logs), 'Audit logs list returned');
    assert(typeof auditJson.pagination?.total === 'number', 'Audit pagination metadata returned');
  } catch (err: any) {
    assert(false, `Audit log test failed: ${err.message}`);
  }

  // TEST 8: Organization Settings & Data Retention
  console.log('\n--- TEST 8: Organization Settings & Data Retention ---');
  try {
    const setRes = await fetch(`${BASE_URL}/api/admin/settings`, { headers });
    const setJson = (await setRes.json()) as any;
    assert(setRes.ok && setJson.success === true, 'GET /api/admin/settings returns HTTP 200');
    assert(typeof setJson.settings?.dataRetentionDaysAfterRejection === 'number', 'Settings includes data retention days');

    const cleanRes = await fetch(`${BASE_URL}/api/admin/data-retention/run-cleanup`, {
      method: 'POST',
      headers,
    });
    const cleanJson = (await cleanRes.json()) as any;
    assert(cleanRes.ok && cleanJson.success === true, 'POST /api/admin/data-retention/run-cleanup executes successfully');
  } catch (err: any) {
    assert(false, `Settings test failed: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`SUPER ADMIN TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuperAdminVerification().catch((err) => {
  console.error('Fatal error in test script:', err);
  process.exit(1);
});
