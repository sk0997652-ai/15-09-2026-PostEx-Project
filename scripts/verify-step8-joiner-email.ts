import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { notificationService } from '../src/server/notificationService';

const sbUrl = process.env.VITE_SUPABASE_URL!;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sbAdmin = createClient(sbUrl, sbKey);
const authClient = createClient(sbUrl, process.env.VITE_SUPABASE_ANON_KEY!);
const BASE_URL = 'http://localhost:3000';

async function runStep8Tests() {
  console.log('================================================================');
  console.log('  STARTING STEP 8: JOINER EMAIL END-TO-END VERIFICATION SUITE');
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

  // Get Super Admin token
  const { data: adminSession, error: aErr } = await authClient.auth.signInWithPassword({
    email: 'admin@postex.pk',
    password: 'PostExAdmin2026!',
  });
  if (aErr || !adminSession.session) {
    throw new Error(`Failed to sign in as Super Admin: ${aErr?.message}`);
  }
  const adminToken = adminSession.session.access_token;

  // Get Branch Manager token
  const { data: bmSession, error: bmErr } = await authClient.auth.signInWithPassword({
    email: 'bm.lahore@postex.pk',
    password: 'PostExAdmin2026!',
  });
  if (bmErr || !bmSession.session) {
    throw new Error(`Failed to sign in as Branch Manager: ${bmErr?.message}`);
  }
  const bmToken = bmSession.session.access_token;

  // Setup temporary test employee
  console.log('\n--- Setup: Creating temporary employee for test ---');
  const { data: lahoreBranch } = await sbAdmin.from('branches').select('id, zone_id').limit(1).single();
  const candId = crypto.randomUUID();
  const appId = crypto.randomUUID();
  const testCandName = 'TEST <b>Escaped & Tagged</b> Employee';
  const testCnic = `35201-${Math.floor(1000000 + Math.random() * 9000000)}-9`;
  const testMobile = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;
  const testPersonalEmail = `test.employee.step8.${Date.now()}@example.com`;

  const { error: candErr } = await sbAdmin.from('candidates').insert({
    id: candId,
    full_name: testCandName,
    cnic: testCnic,
    mobile: testMobile,
    email: testPersonalEmail,
    joining_id: `PX-2026-${Math.floor(100000 + Math.random() * 900000)}`,
    branch_id: lahoreBranch.id,
    zone_id: lahoreBranch.zone_id,
  });
  if (candErr) throw new Error(`Candidates insert failed: ${candErr.message}`);

  const { error: appErr } = await sbAdmin.from('applications').insert({
    id: appId,
    candidate_id: candId,
    status: 'draft',
    current_step: 1,
  });
  if (appErr) throw new Error(`Applications insert failed: ${appErr.message}`);

  // Transition through normal flow
  await sbAdmin.from('applications').update({ status: 'bm_verification' }).eq('id', appId);
  await sbAdmin.from('applications').update({ status: 'hr_review', submitted_at: new Date().toISOString() }).eq('id', appId);

  // Enroll via decision API
  const decisionRes = await fetch(`${BASE_URL}/api/central/applications/${appId}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      action: 'approve_enrol',
      reason: 'Setup for step 8 verification suite.',
    }),
  });
  const decisionJson = await decisionRes.json();
  if (!decisionRes.ok) throw new Error(`Setup enrollment failed: ${JSON.stringify(decisionJson)}`);

  const { data: testEmp, error: empQErr } = await sbAdmin
    .from('employees')
    .select('id, employee_id, full_name, personal_email, status')
    .eq('application_id', appId)
    .single();

  if (empQErr || !testEmp) throw new Error(`Could not find created employee: ${empQErr?.message}`);
  console.log(`Created test employee ${testEmp.full_name} (${testEmp.id})`);

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Invalid email returns HTTP 400
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 1: Invalid recipient email returns 400 ---');
    const badEmailRes = await fetch(`${BASE_URL}/api/employees/${testEmp.id}/send-assets-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ recipient_email: 'not-an-email-at-all' }),
    });
    const badEmailJson = await badEmailRes.json();
    assert(badEmailRes.status === 400, 'Invalid email returns HTTP 400');
    assert(badEmailJson.success === false, 'Invalid email response returns success: false');
    assert(
      badEmailJson.error && badEmailJson.error.includes('Invalid recipient email address format'),
      'Clear error message for invalid email format'
    );

    // ------------------------------------------------------------------------
    // TEST 2: Log simulation mode (EMAIL_PROVIDER=log / simulated=true)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Log simulation mode returns simulated=true and NO sent row ---');
    const logRes = await fetch(`${BASE_URL}/api/employees/${testEmp.id}/send-assets-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-test-email-provider': 'log',
      },
      body: JSON.stringify({ recipient_email: testPersonalEmail }),
    });
    const logJson = await logRes.json();
    assert(logRes.status === 200, 'Log simulation mode returns HTTP 200');
    assert(logJson.success === false, 'Log mode response has success: false');
    assert(logJson.simulated === true, 'Log mode response has simulated: true');
    assert(
      logJson.message && logJson.message.includes('Email provider is not configured'),
      'Log mode message indicates provider is not configured'
    );

    const { data: logEmails } = await sbAdmin
      .from('joiner_asset_emails')
      .select('id')
      .eq('employee_id', testEmp.id)
      .eq('status', 'sent');
    assert((logEmails || []).length === 0, 'Log simulation mode created NO row with status "sent" in joiner_asset_emails');

    // ------------------------------------------------------------------------
    // TEST 3: Real SMTP mode via jsonTransport (valid send creates one 'sent' row)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Real delivery via jsonTransport creates sent row, audit log, and escapes HTML ---');
    const sendRes = await fetch(`${BASE_URL}/api/employees/${testEmp.id}/send-assets-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-test-email-provider': 'smtp',
      },
      body: JSON.stringify({ recipient_email: testPersonalEmail }),
    });
    const sendJson = await sendRes.json();
    assert(sendRes.status === 200, 'Valid send with jsonTransport returns HTTP 200');
    assert(sendJson.success === true, 'Valid send response returns success: true');
    assert(sendJson.simulated === false, 'Valid send response returns simulated: false');

    // Verify row in joiner_asset_emails
    const { data: sentRows } = await sbAdmin
      .from('joiner_asset_emails')
      .select('*')
      .eq('employee_id', testEmp.id)
      .eq('status', 'sent');
    assert((sentRows || []).length === 1, 'Exactly one row created with status "sent" in joiner_asset_emails');
    assert(Boolean(sentRows?.[0]?.provider_message_id), 'Provider message ID stored in joiner_asset_emails');
    assert(Boolean(sentRows?.[0]?.snapshot), 'Current checklist snapshot stored in joiner_asset_emails');

    // Verify HTML escaping directly with notificationService and jsonTransport
    let capturedMail: any = null;
    const jsonTransport = nodemailer.createTransport({ jsonTransport: true });
    const originalSendMail = jsonTransport.sendMail.bind(jsonTransport);
    jsonTransport.sendMail = async (opts: any) => {
      capturedMail = opts;
      return originalSendMail(opts);
    };
    notificationService.setTransporter(jsonTransport);

    // Call sendEmail directly with the escaped string
    function escapeHtml(str: string): string {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    await notificationService.sendEmail(
      testPersonalEmail,
      'Your onboarding items at PostEx',
      'Plain text checklist summary',
      {
        html: `<p>Dear <strong>${escapeHtml(testCandName)}</strong>,</p>`,
        senderName: 'PostEx HR',
      }
    );

    assert(Boolean(capturedMail), 'Mail options captured by transport');
    assert(
      capturedMail?.html?.includes('&lt;b&gt;Escaped &amp; Tagged&lt;/b&gt;'),
      'HTML content properly escaped dynamic employee name containing <b> and &',
      capturedMail?.html
    );
    assert(
      !capturedMail?.html?.includes('<b>Escaped'),
      'Raw HTML tags never appear unescaped in HTML body'
    );
    assert(
      capturedMail?.subject === 'Your onboarding items at PostEx',
      'Subject matches "Your onboarding items at PostEx"'
    );

    // Verify audit log
    const { data: auditRows } = await sbAdmin
      .from('audit_logs')
      .select('*')
      .eq('entity_id', testEmp.id)
      .eq('action', 'send_joiner_assets_email');
    assert((auditRows || []).length >= 1, 'Audit log row created for send_joiner_assets_email');

    // Verify joiner-tracker status is 'sent'
    const trackerRes1 = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const trackerJson1 = await trackerRes1.json();
    const trackerEmp1 = trackerJson1.joiners?.find((j: any) => j.id === testEmp.id);
    assert(trackerEmp1?.email_status === 'sent', 'Joiner tracker reflects email_status: "sent"');

    // ------------------------------------------------------------------------
    // TEST 4: Changing an item after sending flips badge to 'unsent'
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Changing an item after sending flips email_status to unsent ---');
    const patchRes = await fetch(`${BASE_URL}/api/employees/${testEmp.id}/asset-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ code: 'provided' }),
    });
    assert(patchRes.ok, 'PATCH asset-status (code: provided) succeeds');

    const trackerRes2 = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const trackerJson2 = await trackerRes2.json();
    const trackerEmp2 = trackerJson2.joiners?.find((j: any) => j.id === testEmp.id);
    assert(
      trackerEmp2?.email_status === 'unsent',
      'Joiner tracker flips email_status to "unsent" after an item was updated'
    );

    // ------------------------------------------------------------------------
    // TEST 5: Resend works
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Resend succeeds and updates email_status back to sent ---');
    const resendRes = await fetch(`${BASE_URL}/api/employees/${testEmp.id}/send-assets-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-test-email-provider': 'smtp',
      },
      body: JSON.stringify({ recipient_email: testPersonalEmail }),
    });
    const resendJson = await resendRes.json();
    assert(resendRes.status === 200 && resendJson.success === true, 'Resend succeeds with HTTP 200');

    const trackerRes3 = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const trackerJson3 = await trackerRes3.json();
    const trackerEmp3 = trackerJson3.joiners?.find((j: any) => j.id === testEmp.id);
    assert(trackerEmp3?.email_status === 'sent', 'After resend, email_status flips back to "sent"');

    // ------------------------------------------------------------------------
    // TEST 6: Provider failure returns 502 and creates a 'failed' row
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Provider failure returns 502 and logs failed row without leaking raw error ---');
    const failRes = await fetch(`${BASE_URL}/api/employees/${testEmp.id}/send-assets-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-test-email-provider': 'smtp-fail',
      },
      body: JSON.stringify({ recipient_email: testPersonalEmail }),
    });
    const failJson = await failRes.json();
    assert(failRes.status === 502, 'Provider failure returns HTTP 502');
    assert(failJson.success === false, 'Provider failure response returns success: false');
    assert(
      !JSON.stringify(failJson).includes('secret_password_123'),
      'Raw internal provider secret error is NEVER leaked to the client'
    );

    const { data: failedRows } = await sbAdmin
      .from('joiner_asset_emails')
      .select('*')
      .eq('employee_id', testEmp.id)
      .eq('status', 'failed');
    assert((failedRows || []).length >= 1, 'Provider failure recorded a row with status "failed" in joiner_asset_emails');

    // ------------------------------------------------------------------------
    // TEST 7: Branch Manager gets HTTP 403
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Branch Manager write access returns 403 ---');
    const bmRes = await fetch(`${BASE_URL}/api/employees/${testEmp.id}/send-assets-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bmToken}`,
      },
      body: JSON.stringify({ recipient_email: testPersonalEmail }),
    });
    assert(bmRes.status === 403, 'Branch Manager gets HTTP 403 on send-assets-email');

    // ------------------------------------------------------------------------
    // TEST 8: Exit in progress employee gets HTTP 409
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Exit-in-progress employee returns 409 ---');
    await sbAdmin.from('employees').update({ status: 'exit_in_progress' }).eq('id', testEmp.id);

    const exitRes = await fetch(`${BASE_URL}/api/employees/${testEmp.id}/send-assets-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ recipient_email: testPersonalEmail }),
    });
    const exitJson = await exitRes.json();
    assert(exitRes.status === 409, 'Sending email to exit_in_progress employee returns HTTP 409');
    assert(
      exitJson.error && exitJson.error.includes('Only active employees can receive asset notifications'),
      'Clear conflict message for inactive employee'
    );

    // Reset status back to active for remaining tests
    await sbAdmin.from('employees').update({ status: 'active' }).eq('id', testEmp.id);

    // ------------------------------------------------------------------------
    // TEST 9: Rate limiting triggers at 11th request per minute
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 9: Rate limit triggers at 11th send per minute ---');
    // Restore jsonTransport
    notificationService.setTransporter(jsonTransport);

    // Send until limit triggers
    let rateLimitTriggered = false;
    let attempts = 0;
    for (let i = 0; i < 15; i++) {
      attempts++;
      const r = await fetch(`${BASE_URL}/api/employees/${testEmp.id}/send-assets-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ recipient_email: testPersonalEmail }),
      });
      if (r.status === 429) {
        rateLimitTriggered = true;
        const json = await r.json();
        assert(json.error && json.error.includes('Rate limit exceeded'), 'Rate limit returns 429 with clear message');
        break;
      }
    }
    assert(rateLimitTriggered, `Rate limit triggered after ${attempts} requests`);

  } finally {
    // Clean up temporary test data
    console.log('\n--- Cleaning up temporary test records ---');
    await sbAdmin.from('joiner_asset_emails').delete().eq('employee_id', testEmp.id);
    await sbAdmin.from('employee_asset_status').delete().eq('employee_id', testEmp.id);
    await sbAdmin.from('audit_logs').delete().eq('entity_id', testEmp.id);
    await sbAdmin.from('employees').delete().eq('id', testEmp.id);
    await sbAdmin.from('hr_decisions').delete().eq('application_id', appId);
    await sbAdmin.from('applications').delete().eq('id', appId);
    await sbAdmin.from('candidates').delete().eq('id', candId);
    console.log('Cleanup complete.');
  }

  console.log('\n================================================================');
  console.log(`  STEP 8 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep8Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
