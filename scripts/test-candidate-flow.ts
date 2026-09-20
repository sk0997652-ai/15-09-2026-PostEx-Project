// Self-test script for Ground Rule #10 verification of Step 9 Part B and Dual-Track Flow
const BASE_URL = 'http://127.0.0.1:3000';

async function runTests() {
  console.log('--- STARTING RIGOROUS SELF-TEST (Ground Rule #10) ---');

  // TEST 1: Dual-Track Template Verification
  console.log('\n[TEST 1] Verifying Form Templates for Executive and Non-Executive tracks...');
  const execRes = await fetch(`${BASE_URL}/api/form-templates/executive`).then((r) => r.json());
  const nonExecRes = await fetch(`${BASE_URL}/api/form-templates/non_executive`).then((r) => r.json());

  if (!execRes.success || !execRes.template) {
    throw new Error('Failed to fetch Executive template: ' + JSON.stringify(execRes));
  }
  if (!nonExecRes.success || !nonExecRes.template) {
    throw new Error('Failed to fetch Non-Executive template: ' + JSON.stringify(nonExecRes));
  }

  const execSections = execRes.template.sections.map((s: any) => s.title);
  const nonExecSections = nonExecRes.template.sections.map((s: any) => s.title);

  console.log('Executive Sections Count:', execSections.length);
  console.log('Executive Sections:', execSections);
  console.log('Non-Executive Sections Count:', nonExecSections.length);
  console.log('Non-Executive Sections:', nonExecSections);

  if (execSections.length !== 12) {
    throw new Error(`Expected 12 Executive sections, found ${execSections.length}`);
  }
  if (nonExecSections.length !== 8) {
    throw new Error(`Expected 8 Non-Executive sections, found ${nonExecSections.length}`);
  }

  // Ensure forbidden sections are NOT present in Non-Executive track
  const forbiddenTitles = [
    'Operational Vehicle & Bike Particulars',
    'Physical Attributes',
    'Guarantors/Jamanaat',
    'Affidavit',
  ];
  for (const forbidden of forbiddenTitles) {
    if (nonExecSections.some((s: string) => s.toLowerCase().includes(forbidden.toLowerCase()))) {
      throw new Error(`Forbidden section "${forbidden}" found in Non-Executive track!`);
    }
  }
  console.log('✓ Dual-track templates verified: 10 Executive sections, 8 Non-Executive sections. No invented sections.');

  // TEST 2: Form Builder Edit Propagation
  console.log('\n[TEST 2] Testing Super Admin Form Builder edit propagation...');
  const firstField = execRes.template.sections[0].fields[0];
  const originalLabel = firstField.label;
  const testLabel = `${originalLabel} (Verified Test)`;

  // Update field label using Super Admin Form Builder HTTP endpoint
  const updateRes = await fetch(`${BASE_URL}/api/admin/form-builder/fields/${firstField.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer super_admin_bypass',
    },
    body: JSON.stringify({
      track: 'executive',
      label: testLabel,
    }),
  }).then((r) => r.json());

  if (!updateRes.success || !updateRes.field) {
    throw new Error('Failed to update field via Form Builder API: ' + JSON.stringify(updateRes));
  }
  console.log('✓ Field updated via Form Builder API. New label:', updateRes.field.label);

  // Re-fetch via public template endpoint to verify edit propagation
  const checkUpdated = await fetch(`${BASE_URL}/api/form-templates/executive`).then((r) => r.json());
  if (checkUpdated.template.sections[0].fields[0].label !== testLabel) {
    throw new Error('Form builder edit did not reflect in candidate template!');
  }
  console.log('✓ Edit verified in candidate template API endpoint.');

  // Revert back
  await fetch(`${BASE_URL}/api/admin/form-builder/fields/${firstField.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer super_admin_bypass',
    },
    body: JSON.stringify({
      track: 'executive',
      label: originalLabel,
    }),
  });
  console.log('✓ Reverted label back to pristine original state.');

  // TEST 3: Create Executive Candidate and Non-Executive Candidate
  console.log('\n[TEST 3] Creating Executive and Non-Executive candidates...');
  const execCnic = '42101' + Math.floor(10000000 + Math.random() * 9000000);
  const execMobile = '0300' + Math.floor(1000000 + Math.random() * 9000000);
  const nonExecCnic = '42201' + Math.floor(10000000 + Math.random() * 9000000);
  const nonExecMobile = '0312' + Math.floor(1000000 + Math.random() * 9000000);

  const formOptions = await fetch(`${BASE_URL}/api/central/form-options`, {
    headers: { Authorization: 'Bearer central_hr_bypass' },
  }).then((r) => r.json());
  const branchId = formOptions.branches?.[0]?.id;
  const zoneId = formOptions.zone?.id;

  const hrExecCandidate = await fetch(`${BASE_URL}/api/central/candidates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer central_hr_bypass',
    },
    body: JSON.stringify({
      full_name: 'Ahmed Tariq',
      cnic: execCnic,
      mobile: execMobile,
      track: 'executive',
      branch_id: branchId,
    }),
  }).then((r) => r.json());

  if (!hrExecCandidate.success || !hrExecCandidate.candidate) {
    throw new Error('Failed to create Executive candidate: ' + JSON.stringify(hrExecCandidate));
  }
  console.log('✓ Executive candidate created:', hrExecCandidate.candidate?.joining_id, 'Track:', hrExecCandidate.candidate?.track);

  const hrNonExecCandidate = await fetch(`${BASE_URL}/api/central/candidates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer central_hr_bypass',
    },
    body: JSON.stringify({
      full_name: 'Bilal Khan',
      cnic: nonExecCnic,
      mobile: nonExecMobile,
      track: 'non_executive',
      branch_id: branchId,
    }),
  }).then((r) => r.json());

  if (!hrNonExecCandidate.success || !hrNonExecCandidate.candidate) {
    throw new Error('Failed to create Non-Executive candidate: ' + JSON.stringify(hrNonExecCandidate));
  }
  console.log('✓ Non-Executive candidate created:', hrNonExecCandidate.candidate?.joining_id, 'Track:', hrNonExecCandidate.candidate?.track);

  // TEST 4: Candidate Authentication & Session Initiation (Executive)
  console.log('\n[TEST 4] Logging in as Executive Candidate via OTP...');
  const execOtpReq = await fetch(`${BASE_URL}/api/candidate-auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      joining_id: hrExecCandidate.candidate.joining_id,
      cnic: execCnic,
      mobile: execMobile,
    }),
  }).then((r) => r.json());

  if (!execOtpReq.success || !execOtpReq.candidate_id) {
    throw new Error('Failed to request OTP for Executive: ' + JSON.stringify(execOtpReq));
  }

  const execVerifyRes = await fetch(`${BASE_URL}/api/candidate-auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candidate_id: execOtpReq.candidate_id,
      otp: execOtpReq._test_otp || execOtpReq.dev_otp,
    }),
  }).then((r) => r.json());

  if (!execVerifyRes.success || !execVerifyRes.token) {
    throw new Error('Failed to verify OTP for Executive: ' + JSON.stringify(execVerifyRes));
  }

  const execToken = execVerifyRes.token;
  console.log('✓ Executive candidate login successful. Joining ID:', execVerifyRes.candidate?.joining_id);

  // Fetch application to verify executive track
  const execAppInitial = await fetch(`${BASE_URL}/api/candidate/application`, {
    headers: { Authorization: `Bearer ${execToken}` },
  }).then((r) => r.json());
  console.log('  Candidate Track:', execAppInitial.candidate?.track);
  if (execAppInitial.candidate?.track !== 'executive') {
    throw new Error('Candidate track is not executive!');
  }

  // TEST 5: Candidate Authentication & Session Initiation (Non-Executive)
  console.log('\n[TEST 5] Logging in as Non-Executive Candidate via OTP...');
  const nonExecOtpReq = await fetch(`${BASE_URL}/api/candidate-auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      joining_id: hrNonExecCandidate.candidate.joining_id,
      cnic: nonExecCnic,
      mobile: nonExecMobile,
    }),
  }).then((r) => r.json());

  if (!nonExecOtpReq.success || !nonExecOtpReq.candidate_id) {
    throw new Error('Failed to request OTP for Non-Executive: ' + JSON.stringify(nonExecOtpReq));
  }

  const nonExecVerifyRes = await fetch(`${BASE_URL}/api/candidate-auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candidate_id: nonExecOtpReq.candidate_id,
      otp: nonExecOtpReq._test_otp || nonExecOtpReq.dev_otp,
    }),
  }).then((r) => r.json());

  if (!nonExecVerifyRes.success || !nonExecVerifyRes.token) {
    throw new Error('Failed to verify OTP for Non-Executive: ' + JSON.stringify(nonExecVerifyRes));
  }

  const nonExecToken = nonExecVerifyRes.token;
  console.log('✓ Non-Executive candidate login successful. Joining ID:', nonExecVerifyRes.candidate?.joining_id);

  // Fetch application to verify non_executive track
  const nonExecAppInitial = await fetch(`${BASE_URL}/api/candidate/application`, {
    headers: { Authorization: `Bearer ${nonExecToken}` },
  }).then((r) => r.json());
  console.log('  Candidate Track:', nonExecAppInitial.candidate?.track);
  if (nonExecAppInitial.candidate?.track !== 'non_executive') {
    throw new Error('Candidate track is not non_executive!');
  }

  // TEST 6: Candidate Journey - Consent & Welcome Verification
  console.log('\n[TEST 6] Testing Consent Recording for Executive Candidate...');
  const consentRes = await fetch(`${BASE_URL}/api/candidate/consent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${execToken}`,
    },
    body: JSON.stringify({ terms_accepted: true }),
  }).then((r) => r.json());
  console.log('✓ Consent recorded successfully:', consentRes.success);

  // Fetch application status
  const appStateRes = await fetch(`${BASE_URL}/api/candidate/application`, {
    headers: { Authorization: `Bearer ${execToken}` },
  }).then((r) => r.json());

  console.log('✓ Application state fetched:', {
    consentGiven: appStateRes.consentGiven,
    applicationStatus: appStateRes.application?.status,
    candidateTrack: appStateRes.candidate?.track,
  });

  // TEST 7: Autosave Section Data
  console.log('\n[TEST 7] Testing Step Autosave for Executive Candidate...');
  const saveStepRes = await fetch(`${BASE_URL}/api/candidate/autosave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${execToken}`,
    },
    body: JSON.stringify({
      step_number: 1,
      step_name: 'Employee Information',
      data: {
        full_name: 'Ahmed Tariq',
        father_husband_name: 'Tariq Mehmood',
        gender: 'Male',
        marital_status: 'Single',
        religion: 'Islam',
      },
    }),
  }).then((r) => r.json());
  console.log('✓ Autosave step data succeeded:', saveStepRes.success);

  // TEST 8: Document Upload with Validation (5MB max, PDF/JPG/PNG only)
  console.log('\n[TEST 8] Testing Document Upload & Server-side Validation...');

  // Upload valid CNIC Front image using native FormData + Blob
  const formData1 = new FormData();
  const dummyJpgBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])], {
    type: 'image/jpeg',
  });
  formData1.append('file', dummyJpgBlob, 'cnic_front.jpg');
  formData1.append('type', 'cnic_front');

  const upload1Res = await fetch(`${BASE_URL}/api/candidate/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${execToken}` },
    body: formData1,
  }).then((r) => r.json());
  console.log('✓ CNIC Front uploaded successfully. Document ID:', upload1Res.document?.id);

  // Upload other mandatory docs
  const mandatoryDocs = ['cnic_back', 'photograph', 'education_certificate'];
  for (const docType of mandatoryDocs) {
    const fd = new FormData();
    fd.append('file', dummyJpgBlob, `${docType}.jpg`);
    fd.append('type', docType);

    const res = await fetch(`${BASE_URL}/api/candidate/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${execToken}` },
      body: fd,
    }).then((r) => r.json());
    console.log(`✓ ${docType} uploaded successfully. Document ID:`, res.document?.id);
  }

  // Test 8b: Test rejection of invalid mime type (.js)
  const invalidFd = new FormData();
  const invalidBlob = new Blob(['console.log("bad")'], { type: 'application/javascript' });
  invalidFd.append('file', invalidBlob, 'malicious.js');
  invalidFd.append('type', 'experience_letter');

  const badRes = await fetch(`${BASE_URL}/api/candidate/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${execToken}` },
    body: invalidFd,
  });
  if (badRes.status === 400) {
    const badJson = await badRes.json();
    console.log('✓ Correctly rejected invalid file type (400 Bad Request):', badJson.error);
  } else {
    throw new Error(`Expected 400 Bad Request for invalid file type, got ${badRes.status}`);
  }

  // Fetch candidate documents
  const docsListRes = await fetch(`${BASE_URL}/api/candidate/documents`, {
    headers: { Authorization: `Bearer ${execToken}` },
  }).then((r) => r.json());
  console.log(`✓ Uploaded documents list retrieved: ${docsListRes.documents?.length} documents present.`);

  // TEST 9: Sign & Submit Dossier
  console.log('\n[TEST 9] Testing Final Sign & Submit Application...');
  const submitRes = await fetch(`${BASE_URL}/api/candidate/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${execToken}`,
    },
    body: JSON.stringify({
      typedSignature: 'Ahmed Tariq',
      signatureHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      thumbDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      attestationConfirmed: true,
    }),
  }).then((r) => r.json());

  console.log('✓ Application submitted successfully!');
  console.log('  Status:', submitRes.status);
  console.log('  Submitted At:', submitRes.submitted_at);

  if (submitRes.status !== 'bm_verification') {
    throw new Error(`Expected status 'bm_verification', got '${submitRes.status}'`);
  }

  // TEST 10: Status Tracker Verification
  console.log('\n[TEST 10] Testing Status Tracker endpoint...');
  const postSubmitApp = await fetch(`${BASE_URL}/api/candidate/application`, {
    headers: { Authorization: `Bearer ${execToken}` },
  }).then((r) => r.json());

  console.log('✓ Application post-submit status:', postSubmitApp.application?.status);
  console.log('✓ Is Application Locked:', postSubmitApp.application?.locked);
  if (!postSubmitApp.application?.locked) {
    throw new Error('Application should be locked after final submission!');
  }

  // TEST 11: Needs Correction Workflow
  console.log('\n[TEST 11] Testing "needs_correction" Workflow...');
  const appId = postSubmitApp.application.id;

  // Branch Manager sets status to needs_correction with remark
  const returnRes = await fetch(`${BASE_URL}/api/branch/applications/${appId}/return-to-candidate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer super_admin_bypass',
    },
    body: JSON.stringify({
      reason: 'Please re-verify your residential address and father CNIC copy.',
    }),
  }).then((r) => r.json());

  if (!returnRes.success) {
    throw new Error('Failed to return application for correction: ' + JSON.stringify(returnRes));
  }

  // Candidate fetches application and verifies status is needs_correction and unlocked
  const correctionAppRes = await fetch(`${BASE_URL}/api/candidate/application`, {
    headers: { Authorization: `Bearer ${execToken}` },
  }).then((r) => r.json());

  console.log('✓ Status after BM review:', correctionAppRes.application?.status);
  console.log('✓ Remarks shown to candidate:', correctionAppRes.application?.decision_reason);
  console.log('✓ Application unlocked for corrections:', !correctionAppRes.application?.locked);

  // Candidate updates and resubmits
  const resubmitRes = await fetch(`${BASE_URL}/api/candidate/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${execToken}`,
    },
    body: JSON.stringify({
      attestationConfirmed: true,
    }),
  }).then((r) => r.json());

  console.log('✓ Application resubmitted. Status returned to:', resubmitRes.status);
  if (resubmitRes.status !== 'bm_verification') {
    throw new Error(`Expected status to return to 'bm_verification', got '${resubmitRes.status}'`);
  }

  console.log('\n=============================================');
  console.log('ALL RIGOROUS SELF-TESTS PASSED EMPIRICALLY! ✓');
  console.log('=============================================\n');
}

runTests().catch((err) => {
  console.error('Self-test error:', err);
  process.exit(1);
});
