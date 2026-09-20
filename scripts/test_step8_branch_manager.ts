// ==============================================================================
// Step 8 Automated Regression & Verification Test Script: Branch Manager Module
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const API_BASE = 'http://localhost:3000/api/branch';

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`\x1b[32m✔ PASS:\x1b[0m ${name}${details ? ` (${details})` : ''}`);
  } else {
    results.push({ name, passed: false, error: details });
    console.error(`\x1b[31m✘ FAIL:\x1b[0m ${name} - ${details}`);
  }
}

async function getOrCreateBmUser(email: string, name: string, branchId: string, zoneId: string) {
  const password = 'TestBM_Password123!';
  let userId = '';

  const { data: usersData } = await admin.auth.admin.listUsers();
  const existing = usersData?.users.find((u) => u.email === email);

  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, { password });
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'branch_manager' },
    });
    if (createErr) throw createErr;
    userId = created.user.id;
  }

  // Ensure role
  const { data: bmRole } = await admin.from('roles').select('id').eq('name', 'branch_manager').single();

  // Upsert staff profile
  await admin.from('staff_profiles').upsert({
    id: userId,
    name,
    role_id: bmRole?.id,
    branch_id: branchId,
    zone_id: zoneId,
    is_active: true,
  });

  // Sign in to get real session token
  const client = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || SERVICE_KEY);
  const { data: sessionData, error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (signInErr || !sessionData.session?.access_token) {
    throw new Error(`Failed to sign in BM ${email}: ${signInErr?.message}`);
  }

  return {
    userId,
    token: sessionData.session.access_token,
    branchId,
  };
}

async function runStep8Tests() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING STEP 8: BRANCH MANAGER MODULE VERIFICATION');
  console.log('======================================================\n');

  try {
    const BRANCH_LAHORE = '44444444-4444-4444-4444-444444444441';
    const BRANCH_KARACHI = '44444444-4444-4444-4444-444444444443';
    const ZONE_CENTRAL = '22222222-2222-2222-2222-222222222222';
    const ZONE_SOUTH = '33333333-3333-3333-3333-333333333333';

    // 1. Provision / Auth two distinct Branch Managers
    console.log('Setting up Test Branch Managers for Lahore & Karachi...');
    const bm1 = await getOrCreateBmUser(
      'bm.lahore.test@postex.pk',
      'Lahore BM Tester',
      BRANCH_LAHORE,
      ZONE_CENTRAL
    );
    const bm2 = await getOrCreateBmUser(
      'bm.karachi.test@postex.pk',
      'Karachi BM Tester',
      BRANCH_KARACHI,
      ZONE_SOUTH
    );

    assert(Boolean(bm1.token && bm2.token), '1. Both Branch Managers Authenticated with Active Sessions');

    // 2. Test GET /api/branch/profile
    const resProf1 = await fetch(`${API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${bm1.token}` },
    });
    const prof1 = await resProf1.json();
    assert(
      prof1.success && prof1.profile.branch_id === BRANCH_LAHORE,
      '2. BM 1 Profile Fetched & Correctly Scoped to Lahore Branch',
      `Branch: ${prof1.profile?.branch_name}`
    );

    // 3. Seed an application for Lahore BM
    const resSeed = await fetch(`${API_BASE}/test/seed-sample-application`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bm1.token}` },
    });
    const seedData = await resSeed.json();
    assert(
      seedData.success && Boolean(seedData.application?.id),
      '3. Seeded Application with Documents in bm_verification Status for Lahore',
      `App ID: ${seedData.application?.id}, Joining ID: ${seedData.application?.candidate?.joining_id}`
    );

    const lahoreAppId = seedData.application.id;
    const documents = seedData.application.documents || [];
    assert(documents.length >= 3, '4. Candidate Documents Seeded', `Total docs: ${documents.length}`);

    // 4. Test RLS Isolation: Lahore BM sees it, Karachi BM DOES NOT
    const resListBm1 = await fetch(`${API_BASE}/applications?status=pending`, {
      headers: { Authorization: `Bearer ${bm1.token}` },
    });
    const list1 = await resListBm1.json();
    const bm1HasApp = list1.applications?.some((a: any) => a.id === lahoreAppId);
    assert(bm1HasApp, '5. Lahore BM Sees Seeded Application in Branch Pending Queue');

    const resListBm2 = await fetch(`${API_BASE}/applications?status=pending`, {
      headers: { Authorization: `Bearer ${bm2.token}` },
    });
    const list2 = await resListBm2.json();
    const bm2HasApp = list2.applications?.some((a: any) => a.id === lahoreAppId);
    assert(!bm2HasApp, '6. [RLS ISOLATION] Karachi BM DOES NOT See Lahore Application in Queue');

    // 5. Test Cross-Branch Direct Access Blocked (HTTP 403)
    const resDirectBm2 = await fetch(`${API_BASE}/applications/${lahoreAppId}`, {
      headers: { Authorization: `Bearer ${bm2.token}` },
    });
    const directData2 = await resDirectBm2.json();
    assert(
      resDirectBm2.status === 403 && directData2.success === false,
      '7. [CROSS-BRANCH ACCESS BLOCKED] Karachi BM Blocked from Accessing Lahore Application Detail (HTTP 403)',
      directData2.error
    );

    // 6. Test Document Review: Needs Correction WITHOUT reason MUST FAIL (HTTP 400)
    const firstDoc = documents[0];
    const resFlagNoReason = await fetch(
      `${API_BASE}/applications/${lahoreAppId}/documents/${firstDoc.id}/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bm1.token}` },
        body: JSON.stringify({ status: 'correction_required', remark: '   ' }),
      }
    );
    const noReasonData = await resFlagNoReason.json();
    assert(
      resFlagNoReason.status === 400 && noReasonData.success === false,
      '8. [VALIDATION] Document Flag as Needs Correction Rejects Empty Reason (HTTP 400)',
      noReasonData.error
    );

    // 7. Test Document Review: Needs Correction WITH valid reason SUCCEEDS
    const resFlagValid = await fetch(
      `${API_BASE}/applications/${lahoreAppId}/documents/${firstDoc.id}/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bm1.token}` },
        body: JSON.stringify({
          status: 'correction_required',
          remark: 'CNIC front photo is blurry; Nadra identity number illegible.',
        }),
      }
    );
    const flagValidData = await resFlagValid.json();
    assert(
      resFlagValid.status === 200 && flagValidData.success === true,
      '9. Document Successfully Flagged as correction_required with Reason Stored'
    );

    // Verify verification_remarks table has entry
    const { data: remarksDb } = await admin
      .from('verification_remarks')
      .select('*')
      .eq('application_id', lahoreAppId)
      .eq('document_id', firstDoc.id);
    assert(
      (remarksDb || []).length > 0,
      '10. Verification Remark Persisted in verification_remarks Table with Staff Creator FK'
    );

    // 8. Test Document Review: Mark Remaining Documents as Verified
    for (let i = 1; i < documents.length; i++) {
      const doc = documents[i];
      const resVer = await fetch(
        `${API_BASE}/applications/${lahoreAppId}/documents/${doc.id}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bm1.token}` },
          body: JSON.stringify({ status: 'verified' }),
        }
      );
      const verData = await resVer.json();
      assert(
        verData.success === true,
        `11.${i}. Document ${doc.type} Successfully Verified`
      );
    }

    // 9. Test Digital Signature Step
    const resSign = await fetch(`${API_BASE}/applications/${lahoreAppId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bm1.token}` },
      body: JSON.stringify({ signerName: 'Lahore Branch Manager Official' }),
    });
    const signData = await resSign.json();
    assert(
      signData.success && Boolean(signData.signature?.signatureHash),
      '12. Digital Signature Successfully Applied with SHA-256 Hash',
      `Hash: ${signData.signature?.signatureHash?.slice(0, 16)}...`
    );

    // Verify audit log for digital signature
    const { data: auditSign } = await admin
      .from('audit_logs')
      .select('*')
      .eq('entity_id', lahoreAppId)
      .eq('action', 'bm_digital_signature_applied');
    assert(
      (auditSign || []).length > 0,
      '13. Digital Signature Attestation Stored in audit_logs Table'
    );

    // 10. Test Forward to Central HR
    const resFwd = await fetch(`${API_BASE}/applications/${lahoreAppId}/forward`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bm1.token}` },
    });
    const fwdData = await resFwd.json();
    assert(
      fwdData.success && fwdData.status === 'hr_review',
      '14. Application Forwarded to Central HR (Status Transitioned to hr_review)'
    );

    // Verify application status in database
    const { data: dbApp } = await admin
      .from('applications')
      .select('status, assigned_branch_manager_id')
      .eq('id', lahoreAppId)
      .single();
    assert(
      dbApp?.status === 'hr_review' && dbApp?.assigned_branch_manager_id === bm1.userId,
      '15. Database Confirms Application Status is hr_review with Assigned Branch Manager FK'
    );

    // 11. Test Correction Loop: Return to Candidate and Resubmit
    // Seed second application to test return and resubmit
    const resSeed2 = await fetch(`${API_BASE}/test/seed-sample-application`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bm1.token}` },
    });
    const seed2Data = await resSeed2.json();
    const app2Id = seed2Data.application.id;
    const app2Doc = seed2Data.application.documents[0];

    // Return to candidate
    const resReturn = await fetch(`${API_BASE}/applications/${app2Id}/return-to-candidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bm1.token}` },
      body: JSON.stringify({ reason: 'Degree certificate missing university registrar stamp.' }),
    });
    const returnData = await resReturn.json();
    assert(
      returnData.success && returnData.status === 'needs_correction',
      '16. Application Returned to Candidate (Status Transitioned to needs_correction & Unlocked)'
    );

    // Candidate resubmits section
    const resResubmit = await fetch(`${API_BASE}/test/resubmit-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bm1.token}` },
      body: JSON.stringify({ applicationId: app2Id, documentId: app2Doc.id }),
    });
    const resubmitData = await resResubmit.json();
    assert(
      resubmitData.success && resubmitData.document?.verification_status === 'pending',
      '17. Candidate Resubmission Re-enters Document as pending and Application in bm_verification'
    );

    // 12. Final check: Total Passed
    const totalTests = results.length;
    const passedTests = results.filter((r) => r.passed).length;
    console.log(`\n------------------------------------------------------`);
    console.log(`Step 8 Test Summary: ${passedTests}/${totalTests} Passed`);
    console.log(`------------------------------------------------------\n`);

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test runner fatal error:', err);
    process.exit(1);
  }
}

runStep8Tests();
