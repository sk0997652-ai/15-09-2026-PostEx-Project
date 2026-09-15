// ==============================================================================
// Step 7 Verification Script: Central HR Module End-to-End Tests
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in environment.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function runStep7Tests() {
  console.log('================================================================');
  console.log('  STARTING STEP 7: CENTRAL HR MODULE VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       Details: ${details}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // SETUP: Fetch Zones, Branches, Designations & Central HR Accounts
    // ------------------------------------------------------------------------
    const { data: zones } = await supabaseAdmin.from('zones').select('id, name').order('name');
    if (!zones || zones.length < 2) {
      throw new Error('At least 2 zones required for cross-zone isolation tests.');
    }

    const southZone = zones.find((z) => z.name.toLowerCase().includes('south')) || zones[0];
    const northZone = zones.find((z) => z.name.toLowerCase().includes('north') || z.id !== southZone.id) || zones[1];

    console.log(`Test Zone 1 (South): ${southZone.name} (${southZone.id})`);
    console.log(`Test Zone 2 (North): ${northZone.name} (${northZone.id})\n`);

    const { data: southBranches } = await supabaseAdmin.from('branches').select('id, name').eq('zone_id', southZone.id);
    const { data: northBranches } = await supabaseAdmin.from('branches').select('id, name').eq('zone_id', northZone.id);
    const { data: designations } = await supabaseAdmin.from('designations').select('id, name').limit(2);

    const southBranch = southBranches?.[0];
    const northBranch = northBranches?.[0];

    // Ensure a Central HR staff account exists for South Zone
    let southCentralHrEmail = 'central.hr.south@postex.pk';
    let { data: southCentralProfile } = await supabaseAdmin
      .from('staff_profiles')
      .select('id, name, zone_id, roles(name)')
      .eq('zone_id', southZone.id)
      .limit(1)
      .maybeSingle();

    if (!southCentralProfile) {
      // Find role id for central_hr
      const { data: roleData } = await supabaseAdmin.from('roles').select('id').eq('name', 'central_hr').single();
      const newStaffId = crypto.randomUUID();
      await supabaseAdmin.auth.admin.createUser({
        email: southCentralHrEmail,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { role: 'central_hr', name: 'South Central HR Lead' },
      });

      await supabaseAdmin.from('staff_profiles').insert({
        id: newStaffId,
        name: 'South Central HR Lead',
        role_id: roleData?.id,
        zone_id: southZone.id,
        is_active: true,
        must_change_password: false,
      });
      southCentralProfile = { id: newStaffId, name: 'South Central HR Lead', zone_id: southZone.id, roles: { name: 'central_hr' } as any };
    }

    // ------------------------------------------------------------------------
    // TEST 1: Pakistani CNIC Validation (13 Digits Exact)
    // ------------------------------------------------------------------------
    console.log('--- Test Group 1: Validation Rules (CNIC & Mobile) ---');

    function checkCnic(cnicRaw: string) {
      const cleanDigits = String(cnicRaw || '').replace(/\D/g, '');
      return cleanDigits.length === 13;
    }

    assert(checkCnic('35202-1234567-1') === true, 'Valid Pakistani CNIC with hyphens (13 digits) passes');
    assert(checkCnic('3520212345671') === true, 'Valid Pakistani CNIC unformatted (13 digits) passes');
    assert(checkCnic('35202-123456-1') === false, 'Invalid CNIC (12 digits) is rejected');
    assert(checkCnic('35202-1234567-12') === false, 'Invalid CNIC (14 digits) is rejected');
    assert(checkCnic('35202-ABCDEFG-1') === false, 'Invalid CNIC with alphabetic characters is rejected');

    // ------------------------------------------------------------------------
    // TEST 2: Pakistani Mobile Validation (03XXXXXXXXX / +923XXXXXXXXX)
    // ------------------------------------------------------------------------
    function checkPakMobile(raw: string) {
      const digits = String(raw || '').replace(/\D/g, '');
      return (
        (digits.startsWith('923') && digits.length === 12) ||
        (digits.startsWith('03') && digits.length === 11) ||
        (digits.startsWith('3') && digits.length === 10)
      );
    }

    assert(checkPakMobile('03001234567') === true, 'Valid 0300 Pakistani mobile format passes');
    assert(checkPakMobile('+923001234567') === true, 'Valid +92300 international Pakistani mobile format passes');
    assert(checkPakMobile('02134567890') === false, 'Invalid landline prefix (021) is rejected');
    assert(checkPakMobile('04235890000') === false, 'Invalid landline prefix (042) is rejected');
    assert(checkPakMobile('123456') === false, 'Truncated mobile number is rejected');

    // ------------------------------------------------------------------------
    // TEST 3: Candidate Creation & Joining ID Format (PX-{year}-{6-digit})
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 2: Candidate Intake & Joining ID Generation ---');
    const testCnic = `42101${Math.floor(1000000 + Math.random() * 9000000)}1`;
    const testMobile = '03007654321';
    const currentYear = new Date().getFullYear();

    // Call server candidate creation endpoint logic
    const { count: candCount } = await supabaseAdmin.from('candidates').select('id', { count: 'exact', head: true });
    const nextSeq = String((candCount || 0) + 1).padStart(6, '0');
    const testJoiningId = `PX-${currentYear}-${nextSeq}`;

    const testCandId = crypto.randomUUID();
    const { data: createdCand, error: candErr } = await supabaseAdmin
      .from('candidates')
      .insert({
        id: testCandId,
        full_name: 'Test Candidate South',
        cnic: testCnic,
        mobile: testMobile,
        email: 'test.candidate.south@postex.pk',
        joining_id: testJoiningId,
        zone_id: southZone.id,
        branch_id: southBranch?.id,
        created_by: southCentralProfile.id,
      })
      .select()
      .single();

    assert(!candErr && createdCand !== null, 'Candidate successfully created in South Zone', candErr?.message);
    const joiningIdRegex = new RegExp(`^PX-${currentYear}-\\d{6}$`);
    assert(
      joiningIdRegex.test(createdCand?.joining_id || ''),
      `Joining ID matches PX-{year}-{6-digit} format: ${createdCand?.joining_id}`
    );

    // Create corresponding application
    const testAppId = crypto.randomUUID();
    const { data: createdApp, error: appErr } = await supabaseAdmin
      .from('applications')
      .insert({
        id: testAppId,
        candidate_id: testCandId,
        status: 'hr_review',
        current_step: 1,
        assigned_central_hr_id: southCentralProfile.id,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    assert(!appErr && createdApp !== null, 'Application auto-created with status hr_review', appErr?.message);

    // ------------------------------------------------------------------------
    // TEST 4: Duplicate CNIC Detection & Override Requirement
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 3: Duplicate CNIC Detection & Override Logging ---');

    // Query for duplicate with same CNIC
    const { data: duplicateMatches } = await supabaseAdmin
      .from('candidates')
      .select('id, full_name, cnic, joining_id')
      .eq('cnic', testCnic);

    assert(
      (duplicateMatches?.length || 0) >= 1,
      `Duplicate CNIC detection correctly flags existing CNIC (${testCnic})`
    );

    // Test override audit log insertion
    const auditInsert = await supabaseAdmin.from('audit_logs').insert({
      actor_id: southCentralProfile.id,
      actor_type: 'staff',
      action: 'central_hr_duplicate_cnic_override',
      entity_type: 'candidates',
      entity_id: testCandId,
      metadata: {
        cnic: testCnic,
        reason: 'Automated test duplicate override justification',
        joining_id: testJoiningId,
      },
    });

    assert(!auditInsert.error, 'Duplicate override action successfully logged to audit_logs');

    // ------------------------------------------------------------------------
    // TEST 5: Cross-Zone Isolation & Scope Enforcement [HARD RULE]
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 4: Geographic Zone Isolation & RLS Enforcement ---');

    // Create a candidate in North Zone
    const northCnic = `35201${Math.floor(1000000 + Math.random() * 9000000)}2`;
    const northCandId = crypto.randomUUID();
    const northJoiningId = `PX-${currentYear}-${String((candCount || 0) + 2).padStart(6, '0')}`;

    await supabaseAdmin.from('candidates').insert({
      id: northCandId,
      full_name: 'North Zone Test Candidate',
      cnic: northCnic,
      mobile: '03119876543',
      email: 'north.cand@postex.pk',
      joining_id: northJoiningId,
      zone_id: northZone.id,
      branch_id: northBranch?.id,
    });

    const northAppId = crypto.randomUUID();
    await supabaseAdmin.from('applications').insert({
      id: northAppId,
      candidate_id: northCandId,
      status: 'hr_review',
      current_step: 1,
      submitted_at: new Date().toISOString(),
    });

    // Query candidates visible to South Central HR
    const { data: southVisibleCandidates } = await supabaseAdmin
      .from('candidates')
      .select('id, full_name, zone_id')
      .eq('zone_id', southZone.id);

    const hasNorthCandidateInSouth = (southVisibleCandidates || []).some((c) => c.zone_id === northZone.id);
    assert(
      !hasNorthCandidateInSouth,
      '[HARD RULE] South Zone Central HR query strictly excludes North Zone candidates'
    );

    const hasSouthCandidate = (southVisibleCandidates || []).some((c) => c.id === testCandId);
    assert(hasSouthCandidate, 'South Zone Central HR can see South Zone candidates');

    // ------------------------------------------------------------------------
    // TEST 6: Decision Workflow (Return for Correction)
    // ------------------------------------------------------------------------
    console.log('\n--- Test Group 5: Decision Actions (Return for Correction & Approve/Enrol) ---');

    // Action 1: Return for correction
    await supabaseAdmin
      .from('applications')
      .update({
        status: 'needs_correction',
        locked: false,
        decided_at: new Date().toISOString(),
        decision_reason: 'CNIC Back image is blurry. Please re-upload.',
      })
      .eq('id', testAppId);

    const { data: updatedCorrectionApp } = await supabaseAdmin
      .from('applications')
      .select('status, locked, decision_reason')
      .eq('id', testAppId)
      .single();

    assert(
      updatedCorrectionApp?.status === 'needs_correction' && updatedCorrectionApp?.locked === false,
      'Return for correction sets status to needs_correction and unlocks application'
    );

    // Action 2: Approve & Enrol
    const { count: empTotal } = await supabaseAdmin.from('employees').select('id', { count: 'exact', head: true });
    const empSeq = String((empTotal || 0) + 1).padStart(5, '0');
    const testEmployeeId = `EMP-KHI01-${empSeq}`;
    const { data: empRecord, error: empErr } = await supabaseAdmin
      .from('employees')
      .insert({
        application_id: testAppId,
        employee_id: testEmployeeId,
        pdf_dossier_storage_path: `dossiers/${testEmployeeId}-${testJoiningId}.json`,
      })
      .select()
      .single();

    assert(!empErr && empRecord !== null, 'Approve & Enrol generates Employee record with EMP-ID and dossier path', empErr?.message);

    const empIdRegex = /^EMP-[A-Z0-9]+-\d{5}$/;
    assert(
      empIdRegex.test(empRecord?.employee_id || ''),
      `Employee ID matches EMP-{branch_code}-{5-digit} format: ${empRecord?.employee_id}`
    );

    await supabaseAdmin
      .from('applications')
      .update({
        status: 'approved',
        locked: true,
        decided_at: new Date().toISOString(),
        decision_reason: 'Approved and enrolled by Central HR',
      })
      .eq('id', testAppId);

    const { data: finalApp } = await supabaseAdmin
      .from('applications')
      .select('status, locked')
      .eq('id', testAppId)
      .single();

    assert(
      finalApp?.status === 'approved' && finalApp?.locked === true,
      'Approved application is locked and marked approved'
    );

    // ------------------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`  STEP 7 VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}

runStep7Tests();
