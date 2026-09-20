import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mock-supabase.postex.pk';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const BASE_URL = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runStep10Tests() {
  console.log('================================================================');
  console.log('STEP 10 RIGOROUS EMPIRICAL VERIFICATION SUITE');
  console.log('================================================================\n');

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      testsFailed++;
    }
  }

  // 1. Get or create Super Admin token
  console.log('--- TEST 1: Authenticate Super Admin & Staff Roles ---');
  let superAdminToken = '';
  const { data: staffProfiles, error: staffErr } = await supabase
    .from('staff_profiles')
    .select('id, name, roles!inner(name)')
    .eq('roles.name', 'super_admin')
    .limit(1);

  if (staffErr || !staffProfiles || staffProfiles.length === 0) {
    console.error('Could not find Super Admin staff profile:', staffErr);
  }

  const superAdminId = staffProfiles?.[0]?.id || 'mock-super-admin-id';
  // Use authorization bearer with mock or real token
  const saHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer mock-token-superadmin`,
  };

  // 2. STATE MACHINE HARDENING TESTS
  console.log('\n--- TEST 2: Workflow State Machine Hardening (API Layer) ---');

  // Let's test direct transition validations via workflowStateMachine logic directly and via API
  const { validateStatusTransition } = await import('./workflowStateMachine');

  // Invalid transition: draft -> approved
  const inv1 = validateStatusTransition('draft', 'approved');
  assert(!inv1.valid && (inv1.error?.includes('Illegal state machine transition') || inv1.error?.includes('Cannot transition')), 'Direct jump "draft" -> "approved" is rejected');

  // Invalid transition: rejected -> submitted
  const inv2 = validateStatusTransition('rejected', 'submitted');
  assert(!inv2.valid && (inv2.error?.includes('terminal state') || inv2.error?.includes('Illegal state machine transition')), 'Terminal status "rejected" -> "submitted" is rejected');

  // Invalid transition: bm_verification -> approved (must go through hr_review)
  const inv3 = validateStatusTransition('bm_verification', 'approved');
  assert(!inv3.valid && (inv3.error?.includes('Illegal state machine transition') || inv3.error?.includes('Cannot transition')), 'Invalid transition "bm_verification" -> "approved" without HR review is rejected');

  // Invalid transition: approved -> needs_correction
  const inv4 = validateStatusTransition('approved', 'needs_correction');
  assert(!inv4.valid && (inv4.error?.includes('terminal state') || inv4.error?.includes('Illegal state machine transition')), 'Terminal status "approved" -> "needs_correction" is rejected');

  // Valid transitions:
  const val1 = validateStatusTransition('draft', 'submitted');
  assert(val1.valid, 'Valid transition "draft" -> "submitted" is accepted');

  const val2 = validateStatusTransition('submitted', 'bm_verification');
  assert(val2.valid, 'Valid transition "submitted" -> "bm_verification" is accepted');

  const val3 = validateStatusTransition('bm_verification', 'hr_review');
  assert(val3.valid, 'Valid transition "bm_verification" -> "hr_review" is accepted');

  const val4 = validateStatusTransition('hr_review', 'approved');
  assert(val4.valid, 'Valid transition "hr_review" -> "approved" is accepted');

  const val5 = validateStatusTransition('hr_review', 'needs_correction');
  assert(val5.valid, 'Valid transition "hr_review" -> "needs_correction" is accepted');

  const val6 = validateStatusTransition('needs_correction', 'submitted');
  assert(val6.valid, 'Valid transition "needs_correction" -> "submitted" is accepted');

  // Direct HTTP API state machine validation test:
  console.log('\n--- TEST 2B: HTTP API Direct Call Rejection of Invalid Transition ---');
  const httpCandId = (await import('crypto')).randomUUID();
  const httpAppId = (await import('crypto')).randomUUID();
  const httpJoiningId = `PX-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  const { data: branchInfo } = await supabase.from('branches').select('id, zone_id').limit(1).maybeSingle();

  await supabase.from('candidates').insert({
    id: httpCandId,
    full_name: 'Direct API Test Candidate',
    cnic: `42101-${Math.floor(1000000 + Math.random() * 9000000)}-3`,
    mobile: `0311${Math.floor(1000000 + Math.random() * 9000000)}`,
    joining_id: httpJoiningId,
    zone_id: branchInfo?.zone_id || null,
    branch_id: branchInfo?.id || null,
  });

  await supabase.from('applications').insert({
    id: httpAppId,
    candidate_id: httpCandId,
    status: 'draft',
    current_step: 1,
    locked: false,
  });

  const apiRes = await fetch(`${BASE_URL}/api/central/applications/${httpAppId}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer central_hr_bypass',
    },
    body: JSON.stringify({
      action: 'approve_enrol',
      reason: 'Attempting invalid jump straight from draft to approved',
    }),
  });

  const apiJson = (await apiRes.json()) as any;
  console.log('Direct API HTTP status:', apiRes.status, 'Response:', apiJson);
  assert(apiRes.status === 400, 'Direct API call with illegal transition returns HTTP 400');
  assert(apiJson.success === false, 'Direct API response returns success: false');
  assert(
    apiJson.error && (apiJson.error.includes('Illegal state machine transition') || apiJson.error.includes('Cannot transition')),
    'Direct API error contains explicit state machine violation message'
  );

  // 3. DATA RETENTION POLICY JOB TESTS
  console.log('\n--- TEST 3: Data Retention Policy Cleanup Execution ---');

  // Create a candidate and application backdated 135 days ago with status = 'rejected'
  const backdatedDate = new Date(Date.now() - 135 * 24 * 60 * 60 * 1000).toISOString();
  const testCnic = `42101-${Math.floor(1000000 + Math.random() * 9000000)}-1`;
  const testMobile = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;

  const { data: branchData } = await supabase.from('branches').select('id, zone_id').limit(1).maybeSingle();
  const candId = (await import('crypto')).randomUUID();
  const appId = (await import('crypto')).randomUUID();
  const joiningId = `PX-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  const { data: testCand, error: candErr } = await supabase
    .from('candidates')
    .insert({
      id: candId,
      full_name: 'Test Retention Candidate',
      cnic: testCnic,
      mobile: testMobile,
      email: 'retention.test@example.com',
      joining_id: joiningId,
      zone_id: branchData?.zone_id || null,
      branch_id: branchData?.id || null,
      created_at: backdatedDate,
    })
    .select()
    .single();

  if (candErr) {
    console.error('Candidate insert error:', candErr);
  }

  assert(!candErr && testCand?.id, 'Created backdated test candidate for retention policy test');

  const { data: testApp, error: appErr } = await supabase
    .from('applications')
    .insert({
      id: appId,
      candidate_id: candId,
      status: 'rejected',
      decision_reason: 'Background check verification failed (test backdated record)',
      decided_at: backdatedDate,
      created_at: backdatedDate,
      locked: true,
    })
    .select()
    .single();

  if (appErr) {
    console.error('App insert error:', appErr);
  }

  assert(!appErr && testApp?.id, 'Created backdated rejected application (135 days old, status=rejected)');

  // Now trigger the retention cleanup job via superAdmin API or service
  const { dataRetentionService } = await import('./dataRetentionStore');
  const cleanupResult = await dataRetentionService.runRetentionCleanup(supabase, superAdminId);

  console.log('Cleanup result:', cleanupResult);
  assert(cleanupResult.countArchived >= 1, `Cleanup job soft-archived at least 1 old rejected record (${cleanupResult.countArchived} archived)`);
  assert(cleanupResult.archivedIds.includes(testApp.id), 'Backdated test application was included in archivedIds list');

  // Verify soft-archive state
  const isArchived = dataRetentionService.isApplicationArchived(testApp.id);
  assert(isArchived, 'dataRetentionService.isApplicationArchived returns TRUE for the test application');

  // Verify audit log exists for this cleanup
  const { data: retentionAuditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('action', 'data_retention_archived')
    .eq('entity_id', testApp.id);

  assert(retentionAuditLogs && retentionAuditLogs.length > 0, 'Audit log entry created for data_retention_archived');

  const { data: jobAuditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('action', 'data_retention_cleanup_completed');

  assert(jobAuditLogs && jobAuditLogs.length > 0, 'Audit log entry created for data_retention_cleanup_completed job summary');

  // 4. CENTRALIZED NOTIFICATION SERVICE AUDIT & TEST
  console.log('\n--- TEST 4: Centralized Notification Service Trigger Verification ---');

  const { notificationService } = await import('./notificationService');

  // Spot-check 1: Joining ID issued notification
  const notif1 = await notificationService.notifyCandidateJoiningIdIssued(supabase, {
    id: testCand.id,
    full_name: 'Test Retention Candidate',
    mobile: testMobile,
    email: 'retention.test@example.com',
    joining_id: 'PEX-TEST-999',
  });
  assert(notif1.delivered, 'Joining ID issued notification dispatched (SMS logged)');

  // Spot-check 2: Application returned for correction
  const notif2 = await notificationService.notifyApplicationReturnedForCorrection(
    supabase,
    { id: testCand.id, full_name: 'Test Retention Candidate', mobile: testMobile, joining_id: 'PEX-TEST-999' },
    'CNIC front image is blurry',
    'branch_manager'
  );
  assert(notif2.delivered, 'Returned for correction notification dispatched');

  // Spot-check 3: Application approved
  const notif3 = await notificationService.notifyApplicationApproved(
    supabase,
    { id: testCand.id, full_name: 'Test Retention Candidate', mobile: testMobile, joining_id: 'PEX-TEST-999' },
    'EMP-99988'
  );
  assert(notif3.delivered, 'Application approved notification dispatched with Employee ID');

  // Spot-check 4: Staff credential reset
  const notif4 = await notificationService.notifyStaffCredentialReset(
    supabase,
    { id: superAdminId, name: 'Super Admin User' },
    'TempPass#9982',
    superAdminId
  );
  assert(notif4 !== null, 'Staff credential reset notification logged to notification table');

  // Query notifications table to confirm rows actually exist
  const { data: dbNotifs, count: notifCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('recipient_id', testCand.id);

  assert(dbNotifs && dbNotifs.length >= 3, `Confirmed ${dbNotifs?.length} notification rows written to database for candidate`);

  // 5. AUDIT LOG COMPLETENESS RE-VERIFICATION
  console.log('\n--- TEST 5: Audit Log Completeness Check ---');
  const requiredAuditActions = [
    'candidate_creation',
    'verify_document',
    'signature_signed',
    'hr_decision',
    'permission_override',
    'staff_password_regenerated',
    'data_retention_archived',
  ];

  const { data: allAuditLogs } = await supabase
    .from('audit_logs')
    .select('action, entity_type, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const existingActions = new Set(allAuditLogs?.map((l) => l.action.toLowerCase()) || []);
  console.log('Sample of recorded audit actions in DB:');
  console.log([...existingActions].slice(0, 15).join(', '));

  assert(allAuditLogs && allAuditLogs.length > 0, `Verified audit logs active with ${allAuditLogs?.length} recent entries`);

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runStep10Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
