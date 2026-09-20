import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const API_BASE = 'http://127.0.0.1:3000';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function postJson(path: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function putJson(path: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function getJson(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runTest() {
  console.log('================================================================');
  console.log('🚀 POSTEX ONBOARDING: DUAL-TRACK E2E VERIFICATION TEST');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // STEP 1: Log in as Central HR (Ali Raza)
  // --------------------------------------------------------------------------
  console.log('STEP 1: Authenticating Central HR (ali@postex.pk)...');
  const { data: centralAuth, error: centralAuthErr } = await supabase.auth.signInWithPassword({
    email: 'ali@postex.pk',
    password: 'Password123!@#',
  });
  assert(!centralAuthErr && centralAuth.session?.access_token, 'Central HR login succeeded with valid JWT');
  const centralToken = centralAuth.session!.access_token;

  // --------------------------------------------------------------------------
  // STEP 2: Create Executive Track Candidate via Central HR
  // --------------------------------------------------------------------------
  console.log('\nSTEP 2: Creating Executive-Track Candidate via Central HR...');
  const randomSuffix1 = Math.floor(1000000 + Math.random() * 9000000);
  const execCnic = `35201-${randomSuffix1.toString().slice(0, 7)}-1`;
  const execMobile = `0300${randomSuffix1.toString().slice(0, 7)}`;

  const execCandidatePayload = {
    full_name: 'Tariq Executive Candidate',
    cnic: execCnic,
    mobile: execMobile,
    email: `tariq.exec.${Date.now()}@postex.pk`,
    track: 'executive',
    branch_id: '44444444-4444-4444-4444-444444444443',
  };

  const { status: execStatus, data: execRes } = await postJson('/api/central/candidates', execCandidatePayload, centralToken);
  assert((execStatus === 200 || execStatus === 201) && execRes.success, `Candidate created: ${execRes.candidate?.full_name} (${execRes.candidate?.joining_id})`);
  assert(execRes.candidate.track === 'executive', `Candidate assigned track is strictly "executive"`);
  assert(execRes.application.status === 'draft', `Application auto-created with status "draft" for candidate self-fill`);

  const execJoiningId = execRes.candidate.joining_id;
  const execCandidateId = execRes.candidate.id;

  // --------------------------------------------------------------------------
  // STEP 3: Create Non-Executive Track Candidate via Central HR
  // --------------------------------------------------------------------------
  console.log('\nSTEP 3: Creating Non-Executive-Track Candidate via Central HR...');
  const randomSuffix2 = Math.floor(1000000 + Math.random() * 9000000);
  const nonExecCnic = `35201-${randomSuffix2.toString().slice(0, 7)}-2`;
  const nonExecMobile = `0300${randomSuffix2.toString().slice(0, 7)}`;

  const nonExecCandidatePayload = {
    full_name: 'Rashid NonExecutive Candidate',
    cnic: nonExecCnic,
    mobile: nonExecMobile,
    email: `rashid.nonexec.${Date.now()}@postex.pk`,
    track: 'non_executive',
    branch_id: '44444444-4444-4444-4444-444444444443',
  };

  const { status: nonExecStatus, data: nonExecRes } = await postJson('/api/central/candidates', nonExecCandidatePayload, centralToken);
  assert((nonExecStatus === 200 || nonExecStatus === 201) && nonExecRes.success, `Candidate created: ${nonExecRes.candidate?.full_name} (${nonExecRes.candidate?.joining_id})`);
  assert(nonExecRes.candidate.track === 'non_executive', `Candidate assigned track is strictly "non_executive"`);
  assert(nonExecRes.application.status === 'draft', `Application auto-created with status "draft" for candidate self-fill`);

  const nonExecJoiningId = nonExecRes.candidate.joining_id;
  const nonExecCandidateId = nonExecRes.candidate.id;

  // --------------------------------------------------------------------------
  // STEP 4: Candidate 1 (Executive) Login & Track Wizard Render Verification
  // --------------------------------------------------------------------------
  console.log('\nSTEP 4: Authenticating Executive Candidate & Verifying Wizard Sections...');
  // Request OTP
  const { status: otp1Status, data: otp1Res } = await postJson('/api/candidate-auth/request-otp', {
    joining_id: execJoiningId,
    cnic: execCnic,
    mobile: execMobile,
  });
  const execOtp = otp1Res.dev_otp || otp1Res._test_otp;
  assert(otp1Status === 200 && otp1Res.success && execOtp, `OTP requested for Executive Candidate (OTP: ${execOtp})`);

  // Verify OTP
  const { status: v1Status, data: v1Res } = await postJson('/api/candidate-auth/verify-otp', {
    candidate_id: execCandidateId,
    otp: execOtp,
  });
  assert(v1Status === 200 && v1Res.success && (v1Res.token || v1Res.session_token), 'Executive Candidate OTP verified & session token issued');
  const execSessionToken = v1Res.token || v1Res.session_token;

  // Fetch Candidate Application Context
  const { status: app1Status, data: app1Res } = await getJson('/api/candidate/application', execSessionToken);
  assert(app1Status === 200 && app1Res.success, 'Candidate application context fetched successfully');
  assert(app1Res.candidate.track === 'executive', `Candidate application track resolved to "executive"`);

  // Fetch Candidate Wizard Form Template for this track
  const { status: tmpl1Status, data: tmpl1Res } = await getJson(`/api/form-templates/${app1Res.candidate.track}`);
  assert(tmpl1Status === 200 && tmpl1Res.success, 'Executive Form Template fetched successfully');
  const execSections = tmpl1Res.template.sections;
  console.log(`  -> Executive Wizard rendered with ${execSections.length} sections:`);
  execSections.forEach((s: any, idx: number) => {
    console.log(`     ${idx + 1}. ${s.title} (${s.fields.length} fields)`);
  });

  assert(execSections.length === 12, 'Executive Wizard contains exactly 12 sections as specified');
  assert(execSections[0].title === 'Personal Information', 'Section 1 is Personal Information');
  assert(execSections[1].title === 'Spouse & Dependents', 'Section 2 is Spouse & Dependents');
  assert(execSections[2].title === 'Health Details', 'Section 3 is Health Details');
  assert(execSections[3].title === 'Academic Details', 'Section 4 is Academic Details');
  assert(execSections[4].title === 'Language Proficiency', 'Section 5 is Language Proficiency');
  assert(execSections[5].title === 'Employment History', 'Section 6 is Employment History');
  assert(execSections[6].title === 'Present Job Information', 'Section 7 is Present Job Information');
  assert(execSections[7].title === 'Work Preferences', 'Section 8 is Work Preferences');
  assert(execSections[8].title === 'Emergency Contact', 'Section 9 is Emergency Contact');
  assert(execSections[9].title === 'References', 'Section 10 is References');
  assert(execSections[10].title === 'Interests & Career Choice', 'Section 11 is Interests & Career Choice');
  assert(execSections[11].title.includes('Declaration'), 'Section 12 is Declaration');

  // --------------------------------------------------------------------------
  // STEP 5: Candidate 2 (Non-Executive) Login & Track Wizard Render Verification
  // --------------------------------------------------------------------------
  console.log('\nSTEP 5: Authenticating Non-Executive Candidate & Verifying Wizard Sections...');
  // Request OTP
  const { status: otp2Status, data: otp2Res } = await postJson('/api/candidate-auth/request-otp', {
    joining_id: nonExecJoiningId,
    cnic: nonExecCnic,
    mobile: nonExecMobile,
  });
  const nonExecOtp = otp2Res.dev_otp || otp2Res._test_otp;
  assert(otp2Status === 200 && otp2Res.success && nonExecOtp, `OTP requested for Non-Executive Candidate (OTP: ${nonExecOtp})`);

  // Verify OTP
  const { status: v2Status, data: v2Res } = await postJson('/api/candidate-auth/verify-otp', {
    candidate_id: nonExecCandidateId,
    otp: nonExecOtp,
  });
  assert(v2Status === 200 && v2Res.success && (v2Res.token || v2Res.session_token), 'Non-Executive Candidate OTP verified & session token issued');
  const nonExecSessionToken = v2Res.token || v2Res.session_token;

  // Fetch Candidate Application Context
  const { status: app2Status, data: app2Res } = await getJson('/api/candidate/application', nonExecSessionToken);
  assert(app2Status === 200 && app2Res.success, 'Candidate application context fetched successfully');
  assert(app2Res.candidate.track === 'non_executive', `Candidate application track resolved to "non_executive"`);

  // Fetch Candidate Wizard Form Template for this track
  const { status: tmpl2Status, data: tmpl2Res } = await getJson(`/api/form-templates/${app2Res.candidate.track}`);
  assert(tmpl2Status === 200 && tmpl2Res.success, 'Non-Executive Form Template fetched successfully');
  const nonExecSections = tmpl2Res.template.sections;
  console.log(`  -> Non-Executive Wizard rendered with ${nonExecSections.length} sections:`);
  nonExecSections.forEach((s: any, idx: number) => {
    console.log(`     ${idx + 1}. ${s.title} (${s.fields.length} fields)`);
  });

  assert(nonExecSections.length === 8, 'Non-Executive Wizard contains exactly 8 sections as specified');
  assert(nonExecSections[0].title === 'Employee Information', 'Section 1 is Employee Information');
  assert(nonExecSections[1].title === 'Address & Family', 'Section 2 is Address & Family');
  assert(nonExecSections[2].title === 'Experience', 'Section 3 is Experience');
  assert(nonExecSections[3].title === 'Academic Details', 'Section 4 is Academic Details');
  assert(nonExecSections[4].title === 'Employment Record', 'Section 5 is Employment Record');
  assert(nonExecSections[5].title === 'References', 'Section 6 is References');
  assert(nonExecSections[6].title === 'Current Job Information', 'Section 7 is Current Job Information');
  assert(nonExecSections[7].title.includes('Declaration'), 'Section 8 is Declaration');

  // Verify that Non-Executive form DOES NOT contain Vehicle, Physical Attributes, or Guarantors
  const allNonExecTitles = nonExecSections.map((s: any) => s.title.toLowerCase());
  assert(!allNonExecTitles.some((t: string) => t.includes('vehicle') || t.includes('bike') || t.includes('transit')), 'No vehicle section present');
  assert(!allNonExecTitles.some((t: string) => t.includes('physical') || t.includes('attributes') || t.includes('height')), 'No physical attributes section present');
  assert(!allNonExecTitles.some((t: string) => t.includes('guarantor') || t.includes('zamanat') || t.includes('affidavit')), 'No guarantors/affidavit section present');

  // --------------------------------------------------------------------------
  // STEP 6: Super Admin Form Builder Live Field Edit Verification
  // --------------------------------------------------------------------------
  console.log('\nSTEP 6: Verifying Super Admin Form Builder Live Field Edit & Real-Time Sync...');
  // Authenticate Super Admin
  const { data: adminAuth, error: adminAuthErr } = await supabase.auth.signInWithPassword({
    email: 'admin@postex.pk',
    password: 'PostExAdmin2026!',
  });
  assert(!adminAuthErr && adminAuth.session?.access_token, 'Super Admin login succeeded with valid JWT');
  const adminToken = adminAuth.session!.access_token;

  // Pick a field in the Executive Track: Section 9 (Emergency Contact) -> emergency_city
  const targetField = execSections[8].fields.find((f: any) => f.field_key === 'emergency_city');
  assert(targetField, `Found target field "${targetField?.label}" [id: ${targetField?.id}]`);

  const updatedLabel = 'City / District of Residence (Updated by Super Admin)';
  console.log(`  Editing field [${targetField.id}] label from "${targetField.label}" to "${updatedLabel}"...`);

  const { status: putStatus, data: putRes } = await putJson(
    `/api/admin/form-builder/fields/${targetField.id}`,
    {
      track: 'executive',
      label: updatedLabel,
      field_type: targetField.field_type,
      is_required: targetField.is_required,
    },
    adminToken
  );
  assert(putStatus === 200 && putRes.success, `Form Builder API returned success: updated field label to "${putRes.field?.label}"`);

  // Now verify as Candidate in the Wizard: fetch the template fresh (same call DynamicTrackWizard executes)
  const { data: wizardFresh } = await getJson('/api/form-templates/executive');
  const freshField = wizardFresh.template.sections[8].fields.find((f: any) => f.id === targetField.id);
  assert(freshField.label === updatedLabel, `Candidate Wizard immediately reflects updated label: "${freshField.label}"`);

  // Revert back to original label
  console.log(`  Restoring field [${targetField.id}] label back to "City"...`);
  const { status: revertStatus, data: revertRes } = await putJson(
    `/api/admin/form-builder/fields/${targetField.id}`,
    {
      track: 'executive',
      label: 'City',
      field_type: targetField.field_type,
      is_required: targetField.is_required,
    },
    adminToken
  );
  assert(revertStatus === 200 && revertRes.success, 'Field label reverted back cleanly to "City"');

  const { data: wizardReverted } = await getJson('/api/form-templates/executive');
  const revertedField = wizardReverted.template.sections[8].fields.find((f: any) => f.id === targetField.id);
  assert(revertedField.label === 'City', `Candidate Wizard confirmed restored to "City"`);

  console.log('\n================================================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('================================================================\n');
}

runTest().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
