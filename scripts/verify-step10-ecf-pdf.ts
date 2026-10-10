// ==============================================================================
// Step 10: ECF Template Upload and PDF Generation Verification Suite
// Tests all template constraints, file signatures, permissions, and PDF generation
// ==============================================================================

import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';

const sbUrl = process.env.VITE_SUPABASE_URL!;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sbAdmin = createClient(sbUrl, sbKey);
const authClient = createClient(sbUrl, process.env.VITE_SUPABASE_ANON_KEY!);
const BASE_URL = 'http://localhost:3000';

async function runStep10Verification() {
  console.log('================================================================');
  console.log('  STARTING STEP 10: ECF TEMPLATE & PDF GENERATION VERIFICATION');
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

  // --------------------------------------------------------------------------
  // Step 1: Authenticate personas
  // --------------------------------------------------------------------------
  console.log('--- Step 1: Authenticating Test Personas ---');
  const { data: adminAuth, error: aErr } = await authClient.auth.signInWithPassword({
    email: 'admin@postex.pk',
    password: 'PostExAdmin2026!',
  });
  if (aErr || !adminAuth.session) throw new Error(`Super admin login failed: ${aErr?.message}`);
  const adminToken = adminAuth.session.access_token;

  const { data: zonalNorthAuth, error: zErr } = await authClient.auth.signInWithPassword({
    email: 'zonal.north@postex.pk',
    password: 'PostExAdmin2026!',
  });
  if (zErr || !zonalNorthAuth.session) throw new Error(`Zonal HR North login failed: ${zErr?.message}`);
  const zonalNorthToken = zonalNorthAuth.session.access_token;

  const { data: bmLahoreAuth, error: bmErr } = await authClient.auth.signInWithPassword({
    email: 'bm.lahore@postex.pk',
    password: 'PostExAdmin2026!',
  });
  if (bmErr || !bmLahoreAuth.session) throw new Error(`BM Lahore login failed: ${bmErr?.message}`);
  const bmLahoreToken = bmLahoreAuth.session.access_token;

  // --------------------------------------------------------------------------
  // Step 2: Prepare sample valid files
  // --------------------------------------------------------------------------
  console.log('--- Step 2: Creating Test Assets (PNG, JPG, PDF) ---');

  // Minimal 1x1 valid PNG (binary)
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, // IEND chunk
    0x42, 0x60, 0x82,
  ]);

  // Minimal valid JPG (binary)
  const validJpgBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c,
    0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00,
    0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
    0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
    0x3f, 0x00, 0xbf, 0x80, 0xff, 0xd9, // EOI
  ]);

  // Valid minimal PDF document generated using pdf-lib
  const samplePdfDoc = await PDFDocument.create();
  const samplePage = samplePdfDoc.addPage([595.28, 841.89]);
  samplePage.drawRectangle({
    x: 40,
    y: 841.89 - 60,
    width: 515.28,
    height: 40,
  });
  const validPdfBytes = await samplePdfDoc.save();
  const validPdfBuffer = Buffer.from(validPdfBytes);

  // Helper to send multipart upload
  async function uploadTemplate(buffer: Buffer, filename: string, mimeType: string, token: string) {
    const fd = new FormData();
    fd.append('template', new Blob([buffer], { type: mimeType }), filename);
    return await fetch(`${BASE_URL}/api/admin/ecf-template`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 1: Super Admin upload valid PNG template
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 1: Super Admin Upload Valid PNG Template ---');
  let res = await uploadTemplate(validPngBuffer, 'test-letterhead.png', 'image/png', adminToken);
  let json = (await res.json()) as any;
  assert(res.status === 200, 'Super admin valid PNG upload returns HTTP 200');
  assert(json.success === true, 'Upload response returns success: true');
  assert(json.template?.mime_type === 'image/png', 'Template mime_type is image/png');
  const pngTemplateId = json.template?.id;

  // --------------------------------------------------------------------------
  // TEST 2: GET /api/admin/ecf-template reads active template
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: GET /api/admin/ecf-template Reads Active Template ---');
  res = await fetch(`${BASE_URL}/api/admin/ecf-template`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  json = (await res.json()) as any;
  assert(res.status === 200, 'GET /api/admin/ecf-template returns HTTP 200');
  assert(json.success === true, 'GET response returns success: true');
  assert(json.template?.id === pngTemplateId, 'Returns active template matching uploaded PNG');
  assert(typeof json.signed_url === 'string' && json.signed_url.includes('http'), 'Returns valid signed URL');

  // Any authenticated staff can read (e.g. Branch Manager)
  res = await fetch(`${BASE_URL}/api/admin/ecf-template`, {
    headers: { Authorization: `Bearer ${bmLahoreToken}` },
  });
  assert(res.status === 200, 'Branch manager can read active template via GET');

  // --------------------------------------------------------------------------
  // TEST 3: Replace keeps exactly one active template (Upload JPG)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Replace Template with Valid JPG (Single Active Enforced) ---');
  res = await uploadTemplate(validJpgBuffer, 'test-letterhead.jpg', 'image/jpeg', adminToken);
  json = (await res.json()) as any;
  assert(res.status === 200, 'Super admin JPG upload returns HTTP 200');
  assert(json.template?.mime_type === 'image/jpeg', 'Template replaced with image/jpeg');
  const jpgTemplateId = json.template?.id;

  // Verify DB contains EXACTLY 1 active template
  const { data: activeTemplates } = await sbAdmin
    .from('ecf_templates')
    .select('id, is_active')
    .eq('is_active', true);
  assert(activeTemplates?.length === 1, `Exactly one active template in database (found: ${activeTemplates?.length})`);
  assert(activeTemplates?.[0]?.id === jpgTemplateId, 'Currently active template is the new JPG');

  // --------------------------------------------------------------------------
  // TEST 4: Replace with Valid PDF Template
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Replace Template with Valid PDF Template ---');
  res = await uploadTemplate(validPdfBuffer, 'official-ecf-bg.pdf', 'application/pdf', adminToken);
  json = (await res.json()) as any;
  assert(res.status === 200, 'Super admin PDF template upload returns HTTP 200');
  assert(json.template?.mime_type === 'application/pdf', 'Template is application/pdf');
  const pdfTemplateId = json.template?.id;

  // --------------------------------------------------------------------------
  // TEST 5: Oversize file rejected with 400
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Oversize File (> 5 MB) Upload Rejected with 400 ---');
  const oversizeBuffer = Buffer.alloc(5.2 * 1024 * 1024); // 5.2 MB
  res = await uploadTemplate(oversizeBuffer, 'oversize.png', 'image/png', adminToken);
  json = (await res.json()) as any;
  assert(res.status === 400, `Oversize upload returns HTTP 400 (got ${res.status})`);
  assert(json.success === false, 'Oversize upload returns success: false');

  // --------------------------------------------------------------------------
  // TEST 6: Wrong type / fake file / text file renamed to .png rejected with 400
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Text File Renamed to .png (Magic Bytes Check) Rejected with 400 ---');
  const fakePngBuffer = Buffer.from('This is a plain text file pretending to be a PNG letterhead.');
  res = await uploadTemplate(fakePngBuffer, 'fake-letterhead.png', 'image/png', adminToken);
  json = (await res.json()) as any;
  assert(res.status === 400, 'Fake PNG with text magic bytes returns HTTP 400');
  assert(json.success === false, 'Fake file upload returns success: false');

  // Text file with text/plain mime type
  res = await uploadTemplate(Buffer.from('Plain text contents'), 'notes.txt', 'text/plain', adminToken);
  assert(res.status === 400, 'Plain text file returns HTTP 400');

  // --------------------------------------------------------------------------
  // TEST 7: Non-admin upload rejected with 403
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Non-Admin Upload Attempt Rejected with 403 ---');
  res = await uploadTemplate(validPngBuffer, 'test.png', 'image/png', bmLahoreToken);
  json = (await res.json()) as any;
  assert(res.status === 403, 'Branch manager upload returns HTTP 403');
  assert(json.success === false, 'Branch manager upload rejected');

  // --------------------------------------------------------------------------
  // TEST 8: Delete template deactivates active template
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Super Admin Delete ECF Template ---');
  res = await fetch(`${BASE_URL}/api/admin/ecf-template/${pdfTemplateId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  json = (await res.json()) as any;
  assert(res.status === 200, 'DELETE template returns HTTP 200');
  assert(json.success === true, 'DELETE returns success: true');

  // Check GET returns null template
  res = await fetch(`${BASE_URL}/api/admin/ecf-template`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  json = (await res.json()) as any;
  assert(json.template === null, 'Active template is null after deletion');
  assert(json.signed_url === null, 'Signed URL is null after deletion');

  // --------------------------------------------------------------------------
  // Step 3: Provision temporary test employee & exits for PDF tests
  // --------------------------------------------------------------------------
  console.log('\n--- Step 3: Provisioning Temporary Test Employee & Exit Records ---');
  const { data: branches } = await sbAdmin
    .from('branches')
    .select('id, name, zone_id, zones(id, name)');
  const lahoreBranch = branches?.find((b: any) => b.name.includes('Lahore')) || branches?.[0];

  const candId = crypto.randomUUID();
  const appId = crypto.randomUUID();
  const empId = crypto.randomUUID();
  const exitId = crypto.randomUUID();
  const testEmpCode = `EMP-TEST-PDF-${Math.floor(1000 + Math.random() * 9000)}`;

  const randCnic1 = `35201-${Math.floor(1000000 + Math.random() * 9000000)}-${Math.floor(1 + Math.random() * 9)}`;
  const randMob1 = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;

  const { error: c1Err } = await sbAdmin.from('candidates').insert({
    id: candId,
    full_name: 'TEST Clearance Candidate',
    cnic: randCnic1,
    mobile: randMob1,
    email: `test.pdf.${Date.now()}@postex.pk`,
    joining_id: `PX-PDF-${Math.floor(100000 + Math.random() * 900000)}`,
    branch_id: lahoreBranch.id,
    zone_id: lahoreBranch.zone_id,
  });
  if (c1Err) throw new Error(`Candidate 1 insert failed: ${c1Err.message}`);

  const { error: a1Err } = await sbAdmin.from('applications').insert({
    id: appId,
    candidate_id: candId,
    status: 'approved',
    current_step: 3,
  });
  if (a1Err) throw new Error(`Application 1 insert failed: ${a1Err.message}`);

  const { error: e1Err } = await sbAdmin.from('employees').insert({
    id: empId,
    application_id: appId,
    employee_id: testEmpCode,
    full_name: 'TEST Muhammad Tariq',
    cnic: randCnic1,
    contact_number: randMob1,
    personal_email: 'test.clearance@example.com',
    designation_name: 'Warehouse Lead',
    branch_id: lahoreBranch.id,
    zone_id: lahoreBranch.zone_id,
    joining_date: '2025-06-01',
    status: 'exit_in_progress',
  });
  if (e1Err) throw new Error(`Employee 1 insert failed: ${e1Err.message}`);

  const { error: x1Err } = await sbAdmin.from('employee_exits').insert({
    id: exitId,
    employee_id: empId,
    exit_type: 'resignation',
    last_working_date: '2026-11-15',
    reason: 'Career progression opportunity',
    status: 'in_progress',
  });
  if (x1Err) throw new Error(`Exit 1 insert failed: ${x1Err.message}`);

  // --------------------------------------------------------------------------
  // TEST 9: PDF Generation when all 6 items pending returns 400
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9: PDF Generation with All 6 Items Pending Returns 400 ---');
  res = await fetch(`${BASE_URL}/api/exits/${exitId}/pdf`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  json = (await res.json()) as any;
  assert(res.status === 400, 'PDF generation with all items pending returns HTTP 400');
  assert(json.success === false, 'Response returns success: false');
  assert(json.error?.includes('All 6 clearance items are still pending'), 'Error mentions all 6 items pending');

  // --------------------------------------------------------------------------
  // TEST 10: Branch Manager attempt returns 403
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 10: Branch Manager PDF Generation Attempt Returns 403 ---');
  res = await fetch(`${BASE_URL}/api/exits/${exitId}/pdf`, {
    headers: { Authorization: `Bearer ${bmLahoreToken}` },
  });
  json = (await res.json()) as any;
  assert(res.status === 403, 'Branch manager PDF generation attempt returns HTTP 403');
  assert(json.success === false, 'Branch manager denied access to generate PDF');

  // --------------------------------------------------------------------------
  // TEST 11: Out-of-Scope attempt returns 403 (North Zonal HR accessing Central exit)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 11: Out-of-Scope PDF Generation Attempt Returns 403 ---');
  res = await fetch(`${BASE_URL}/api/exits/${exitId}/pdf`, {
    headers: { Authorization: `Bearer ${zonalNorthToken}` },
  });
  json = (await res.json()) as any;
  assert(res.status === 403, 'North Zonal HR accessing Central exit returns HTTP 403');

  // --------------------------------------------------------------------------
  // TEST 12: Partially filled clearance + No template (Fallback Header)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 12: Partially Filled Clearance with No Template (Fallback Header) ---');
  // Fill 2 clearance items
  const partialItems = [
    { item_key: 'office_files', status: 'received' },
    { item_key: 'keys', status: 'not_applicable' },
  ];
  await fetch(`${BASE_URL}/api/exits/${exitId}/clearance`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ items: partialItems }),
  });

  res = await fetch(`${BASE_URL}/api/exits/${exitId}/pdf`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(res.status === 200, 'Partially filled clearance PDF returns HTTP 200');
  assert(res.headers.get('content-type')?.includes('application/pdf') || false, 'Content-Type is application/pdf');
  const partialPdfBuffer = Buffer.from(await res.arrayBuffer());
  assert(partialPdfBuffer.slice(0, 4).toString() === '%PDF', 'Binary stream starts with valid PDF magic bytes %PDF');

  // Verify DB updated with pdf_generated_at and audit log
  const { data: exitRowAfterPdf } = await sbAdmin
    .from('employee_exits')
    .select('pdf_generated_at, pdf_generated_by_id')
    .eq('id', exitId)
    .single();
  assert(Boolean(exitRowAfterPdf?.pdf_generated_at), 'pdf_generated_at recorded on exit record');

  const { data: pdfAuditLogs } = await sbAdmin
    .from('audit_logs')
    .select('*')
    .eq('action', 'exit_pdf_generated')
    .eq('entity_id', exitId);
  assert((pdfAuditLogs?.length || 0) >= 1, 'Audit log row created for exit_pdf_generated');

  // Verify GET /api/exits shows pdf_generated_at (triggers blue "PDF downloaded" badge in frontend)
  const exitsListRes = await fetch(`${BASE_URL}/api/exits?status=in_progress`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const exitsListJson = (await exitsListRes.json()) as any;
  const matchInList = exitsListJson.exits?.find((e: any) => e.id === exitId);
  assert(Boolean(matchInList?.pdf_generated_at), 'GET /api/exits includes pdf_generated_at for badge display');

  // --------------------------------------------------------------------------
  // TEST 13: Full clearance with Image Template (Header Rendered)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 13: Full Clearance (6/6) with Image Template (PNG Header) ---');
  // Upload PNG template
  await uploadTemplate(validPngBuffer, 'postex-header.png', 'image/png', adminToken);

  // Fill all 6 clearance items with details
  const fullItems = [
    { item_key: 'office_files', status: 'received' },
    { item_key: 'keys', status: 'not_applicable' },
    { item_key: 'mobile_sim', status: 'received', detail: '0300-9876543' },
    { item_key: 'id_card', status: 'received' },
    { item_key: 'company_car', status: 'not_applicable' },
    { item_key: 'others', status: 'received', detail: 'Laptop bag and security fob' },
  ];
  await fetch(`${BASE_URL}/api/exits/${exitId}/clearance`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ items: fullItems }),
  });

  res = await fetch(`${BASE_URL}/api/exits/${exitId}/pdf`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(res.status === 200, 'Full clearance PDF generation with image template returns HTTP 200');
  const imgPdfBuffer = Buffer.from(await res.arrayBuffer());
  assert(imgPdfBuffer.slice(0, 4).toString() === '%PDF', 'Image template PDF starts with %PDF');

  // --------------------------------------------------------------------------
  // TEST 14: PDF Generation with PDF Template (Background Rendered)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 14: PDF Generation with PDF Template (Background Rendered) ---');
  await uploadTemplate(validPdfBuffer, 'corporate-letterhead.pdf', 'application/pdf', adminToken);

  res = await fetch(`${BASE_URL}/api/exits/${exitId}/pdf`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(res.status === 200, 'PDF generation with PDF template returns HTTP 200');
  const bgPdfBuffer = Buffer.from(await res.arrayBuffer());
  assert(bgPdfBuffer.slice(0, 4).toString() === '%PDF', 'PDF background document generated successfully');

  // --------------------------------------------------------------------------
  // TEST 15: Employee with Non-ASCII / Urdu Characters in Name
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 15: Non-ASCII Characters in Name (Does Not Crash, Handled Safely) ---');
  const urduCandId = crypto.randomUUID();
  const urduAppId = crypto.randomUUID();
  const urduEmpId = crypto.randomUUID();
  const urduExitId = crypto.randomUUID();

  const randCnic2 = `35201-${Math.floor(1000000 + Math.random() * 9000000)}-${Math.floor(1 + Math.random() * 9)}`;
  const randMob2 = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;

  const { error: cuErr } = await sbAdmin.from('candidates').insert({
    id: urduCandId,
    full_name: 'محمد طارق فاروق',
    cnic: randCnic2,
    mobile: randMob2,
    email: `urdu.test.${Date.now()}@postex.pk`,
    joining_id: `PX-URDU-${Math.floor(100000 + Math.random() * 900000)}`,
    branch_id: lahoreBranch.id,
    zone_id: lahoreBranch.zone_id,
  });
  if (cuErr) throw new Error(`Urdu candidate insert failed: ${cuErr.message}`);

  const { error: auErr } = await sbAdmin.from('applications').insert({
    id: urduAppId,
    candidate_id: urduCandId,
    status: 'approved',
    current_step: 3,
  });
  if (auErr) throw new Error(`Urdu application insert failed: ${auErr.message}`);

  const { error: euErr } = await sbAdmin.from('employees').insert({
    id: urduEmpId,
    application_id: urduAppId,
    employee_id: `EMP-URDU-${Math.floor(1000 + Math.random() * 9000)}`,
    full_name: 'محمد طارق فاروق (Tariq Farooq)',
    cnic: randCnic2,
    contact_number: randMob2,
    personal_email: 'urdu.test@example.com',
    designation_name: 'Rider Supervisor',
    branch_id: lahoreBranch.id,
    zone_id: lahoreBranch.zone_id,
    joining_date: '2025-01-01',
    status: 'exit_in_progress',
  });
  if (euErr) throw new Error(`Urdu employee insert failed: ${euErr.message}`);

  const { error: xuErr } = await sbAdmin.from('employee_exits').insert({
    id: urduExitId,
    employee_id: urduEmpId,
    exit_type: 'resignation',
    last_working_date: '2026-12-01',
    reason: 'ذاتی مصروفیات (Personal reasons)',
    status: 'in_progress',
  });
  if (xuErr) throw new Error(`Urdu exit insert failed: ${xuErr.message}`);

  // Fill clearance
  await fetch(`${BASE_URL}/api/exits/${urduExitId}/clearance`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      items: [{ item_key: 'office_files', status: 'received' }],
    }),
  });

  res = await fetch(`${BASE_URL}/api/exits/${urduExitId}/pdf`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(res.status === 200, 'Employee with Urdu/non-ASCII characters generates PDF without crashing');
  const urduPdfBuffer = Buffer.from(await res.arrayBuffer());
  assert(urduPdfBuffer.slice(0, 4).toString() === '%PDF', 'Non-ASCII PDF starts with %PDF magic bytes');

  // --------------------------------------------------------------------------
  // Cleanup test data (excluding audit logs)
  // --------------------------------------------------------------------------
  console.log('\n--- Cleaning Up Temporary Test Fixtures (Audit Logs Preserved) ---');
  try {
    await sbAdmin.from('exit_clearance_items').delete().in('exit_id', [exitId, urduExitId]);
    await sbAdmin.from('employee_exits').delete().in('id', [exitId, urduExitId]);
    await sbAdmin.from('employees').delete().in('id', [empId, urduEmpId]);
    await sbAdmin.from('applications').delete().in('id', [appId, urduAppId]);
    await sbAdmin.from('candidates').delete().in('id', [candId, urduCandId]);

    // Deactivate test templates
    await sbAdmin.from('ecf_templates').update({ is_active: false }).eq('is_active', true);
  } catch (cleanErr) {
    console.warn('Cleanup notice:', cleanErr);
  }

  console.log('Cleanup completed successfully.');
  console.log('\n================================================================');
  console.log(`  STEP 10 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep10Verification().catch((err) => {
  console.error('Step 10 test execution crashed:', err);
  process.exit(1);
});
