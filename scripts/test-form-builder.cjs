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

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

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
    if (payload) req.write(payload);
    req.end();
  });
}

async function testFormBuilderAuthAndAudit() {
  console.log('================================================================');
  console.log('Testing Super Admin Form Builder: Auth Header & Audit Logs');
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

  // 1. Sign in as Super Admin
  console.log('\n--- 1. Authenticating as Super Admin ---');
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: 'admin@postex.pk',
    password: 'PostExAdmin2026!',
  });
  assert(!authError && authData?.session?.access_token, 'Super Admin authenticated and got JWT');
  const token = authData.session.access_token;
  const adminId = authData.user.id;

  // 2. Test without Authorization Header -> Must return 401
  console.log('\n--- 2. Unauthenticated Form Builder Edit Request ---');
  const unauthRes = await apiRequest('/api/admin/form-builder/fields/test-field', 'PUT', {
    track: 'executive',
    label: 'Test Without Token',
  });
  assert(unauthRes.status === 401, `Unauthenticated request correctly rejected with 401 (got ${unauthRes.status})`);
  assert(unauthRes.data?.error?.includes('Authorization header required'), 'Returns "Authorization header required" error');

  // 3. Fetch active template for Executive Track
  console.log('\n--- 3. Fetch Executive Track Template ---');
  const tmplRes = await apiRequest('/api/form-templates/executive', 'GET');
  assert(tmplRes.status === 200 && tmplRes.data?.success, 'Fetched Executive Track template');
  const template = tmplRes.data.template;
  const personalInfoSec = template.sections.find((s) => s.title.includes('Personal'));
  assert(personalInfoSec && personalInfoSec.fields.length > 0, 'Found Personal Information section with fields');
  const targetField = personalInfoSec.fields[0];
  console.log(`Target field for edit test: "${targetField.label}" (id: ${targetField.id})`);

  // 4. Test authenticated field edit WITH Bearer token (The original bug report!)
  console.log('\n--- 4. Authenticated Field Edit with Bearer Token ---');
  const originalLabel = targetField.label;
  const updatedLabel = `${originalLabel} (Verified)`;
  const updateRes = await apiRequest(`/api/admin/form-builder/fields/${targetField.id}`, 'PUT', {
    track: 'executive',
    label: updatedLabel,
    is_required: targetField.is_required,
    field_type: targetField.field_type,
    reason: 'Verified Form Builder edit under Step 10 audit',
  }, token);

  assert(updateRes.status === 200, `Authenticated field update returned HTTP 200 (got ${updateRes.status})`);
  assert(updateRes.data?.success && updateRes.data?.field?.label === updatedLabel, 'Field label updated successfully');

  // Revert label back
  await apiRequest(`/api/admin/form-builder/fields/${targetField.id}`, 'PUT', {
    track: 'executive',
    label: originalLabel,
    is_required: targetField.is_required,
    field_type: targetField.field_type,
    reason: 'Reverting test label change',
  }, token);
  console.log('Label reverted back to original value.');

  // 5. Check Audit Log for form_builder_update_field
  console.log('\n--- 5. Verify Audit Log for Field Update ---');
  const { data: updateAuditLogs } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .eq('action', 'form_builder_update_field')
    .eq('entity_id', targetField.id)
    .order('created_at', { ascending: false })
    .limit(1);

  assert(updateAuditLogs && updateAuditLogs.length > 0, 'Audit log entry created for form_builder_update_field');
  assert(updateAuditLogs[0].metadata?.reason === 'Reverting test label change' || updateAuditLogs[0].metadata?.reason?.includes('Verified Form Builder'), 'Audit log contains non-empty reason and metadata');

  // 6. Test Add Field + Delete Field with Audit Logging
  console.log('\n--- 6. Test Add Field and Delete Field with Reason Logging ---');
  const testFieldKey = `test_field_${Date.now()}`;
  const addRes = await apiRequest('/api/admin/form-builder/fields', 'POST', {
    track: 'executive',
    section_id: personalInfoSec.id,
    field_key: testFieldKey,
    label: 'Temporary Test Field',
    field_type: 'text',
    is_required: false,
    reason: 'Automated test field addition',
  }, token);

  assert(addRes.status === 200 && addRes.data?.success, 'New field added successfully');
  const addedFieldId = addRes.data.field.id;

  // Delete with reason
  const deleteReason = 'Clean up temporary test field per automated test suite';
  const delRes = await apiRequest(`/api/admin/form-builder/fields/${addedFieldId}?track=executive`, 'DELETE', {
    track: 'executive',
    reason: deleteReason,
  }, token);

  assert(delRes.status === 200 && delRes.data?.success, 'Field deleted successfully with reason');

  // Verify deletion audit log
  const { data: deleteAuditLogs } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .eq('action', 'form_builder_delete_field')
    .eq('entity_id', addedFieldId)
    .limit(1);

  assert(deleteAuditLogs && deleteAuditLogs.length > 0, 'Audit log entry created for form_builder_delete_field');
  assert(deleteAuditLogs[0].metadata?.reason === deleteReason, 'Audit log recorded exact deletion reason');

  console.log('\n================================================================');
  console.log(`Form Builder Tests Completed: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

testFormBuilderAuthAndAudit().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
