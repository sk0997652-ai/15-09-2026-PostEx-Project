import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSelfTestAndAudit() {
  console.log('=== 1. AUDITING LIVE DATABASE COUNTS ===');

  const countChecks = [
    'candidates',
    'applications',
    'application_steps',
    'documents',
    'verification_remarks',
    'hr_decisions',
    'employees',
    'candidate_otps',
    'zones',
    'branches',
    'departments',
    'designations',
    'staff_profiles',
    'roles',
    'permissions',
    'role_permissions',
    'form_templates',
    'form_sections',
    'form_fields',
    'organization_settings',
    'audit_logs',
  ];

  const counts: Record<string, number | null> = {};
  for (const table of countChecks) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`Error counting ${table}:`, error.message);
    }
    counts[table] = count;
  }

  const { data: authData } = await supabase.auth.admin.listUsers();
  counts['auth_users'] = authData?.users?.length || 0;

  console.log('Live Database Counts:', JSON.stringify(counts, null, 2));

  // Assert expected counts
  if (counts['candidates'] !== 0) throw new Error('Expected 0 candidates, got ' + counts['candidates']);
  if (counts['applications'] !== 0) throw new Error('Expected 0 applications, got ' + counts['applications']);
  if (counts['zones'] !== 0) throw new Error('Expected 0 zones, got ' + counts['zones']);
  if (counts['branches'] !== 0) throw new Error('Expected 0 branches, got ' + counts['branches']);
  if (counts['departments'] !== 0) throw new Error('Expected 0 departments, got ' + counts['departments']);
  if (counts['designations'] !== 0) throw new Error('Expected 0 designations, got ' + counts['designations']);
  if (counts['staff_profiles'] !== 1) throw new Error('Expected 1 staff_profile (Super Admin), got ' + counts['staff_profiles']);
  if (counts['auth_users'] !== 1) throw new Error('Expected 1 auth_user (Super Admin), got ' + counts['auth_users']);

  console.log('\n=== 2. TESTING SUPER ADMIN LOGIN & API DASHBOARD METRICS ===');
  const anonClient = createClient(url, process.env.VITE_SUPABASE_ANON_KEY || key);
  const { data: loginData, error: loginError } = await anonClient.auth.signInWithPassword({
    email: 'admin@postex.pk',
    password: 'PostExAdmin2026!',
  });

  if (loginError) {
    throw new Error('Super Admin login failed: ' + loginError.message);
  }

  const token = loginData.session.access_token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
  };

  // 1. Dashboard Metrics
  const metricsRes = await fetch('http://localhost:3000/api/admin/metrics', { headers });
  const metricsJson = await metricsRes.json();
  console.log('Metrics endpoint status:', metricsRes.status);
  console.log('Metrics payload:', JSON.stringify(metricsJson, null, 2));

  if (!metricsJson.success) throw new Error('Metrics API returned success: false');
  if (metricsJson.metrics.totalCandidates !== 0) throw new Error('Dashboard totalCandidates is not 0');
  if (metricsJson.metrics.pendingApplications !== 0) throw new Error('Dashboard pendingApplications is not 0');
  if (metricsJson.metrics.approvedApplications !== 0) throw new Error('Dashboard approvedApplications is not 0');
  if (metricsJson.metrics.totalEmployees !== 0) throw new Error('Dashboard totalEmployees is not 0');
  if (metricsJson.metrics.totalZones !== 0) throw new Error('Dashboard totalZones is not 0');
  if (metricsJson.metrics.totalBranches !== 0) throw new Error('Dashboard totalBranches is not 0');
  if (metricsJson.metrics.totalStaff !== 1) throw new Error('Dashboard totalStaff is not 1');

  // 2. Organization Structure Empty Lists
  console.log('\n=== 3. TESTING ORGANIZATION STRUCTURE EMPTY STATES ===');
  const orgRes = await fetch('http://localhost:3000/api/admin/org-structure', { headers });
  const orgJson = await orgRes.json();
  console.log('Org structure status:', orgRes.status);
  console.log('Zones count:', orgJson.zones?.length);
  console.log('Branches count:', orgJson.branches?.length);
  console.log('Departments count:', orgJson.departments?.length);
  console.log('Designations count:', orgJson.designations?.length);
  console.log('System roles count (preserved):', orgJson.roles?.length);

  if (orgJson.zones?.length !== 0) throw new Error('Expected 0 zones in org structure');
  if (orgJson.branches?.length !== 0) throw new Error('Expected 0 branches in org structure');
  if (orgJson.departments?.length !== 0) throw new Error('Expected 0 departments in org structure');
  if (orgJson.designations?.length !== 0) throw new Error('Expected 0 designations in org structure');
  if (orgJson.roles?.length !== 5) throw new Error('Expected 5 system roles preserved');

  // Staff check
  const staffRes = await fetch('http://localhost:3000/api/admin/staff', { headers });
  const staffJson = await staffRes.json();
  console.log('Staff list status:', staffRes.status, 'Total staff count:', staffJson.staff?.length);
  console.log('Remaining staff user:', staffJson.staff?.[0]?.email, staffJson.staff?.[0]?.name);
  if (staffJson.staff?.length !== 1 || staffJson.staff?.[0]?.email !== 'admin@postex.pk') {
    throw new Error('Expected only admin@postex.pk in staff list');
  }

  // 3. Sanity check: Create a brand new Zone from API (as done by the Super Admin UI)
  console.log('\n=== 4. SANITY CHECK: CREATING A REAL ZONE VIA SUPER ADMIN ENDPOINT ===');
  const createZoneRes = await fetch('http://localhost:3000/api/admin/org/zones', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Punjab Central Zone' }),
  });
  const createdZone = await createZoneRes.json();
  console.log('Create Zone response status:', createZoneRes.status);
  console.log('Create Zone payload:', createdZone);

  if (!createdZone.success || !createdZone.data?.id) {
    throw new Error('Zone creation failed: ' + JSON.stringify(createdZone));
  }

  // Check list now has 1 zone
  const orgWithZone = await (await fetch('http://localhost:3000/api/admin/org-structure', { headers })).json();
  console.log('Zones count after adding zone:', orgWithZone.zones?.length);
  if (orgWithZone.zones?.length !== 1) {
    throw new Error('Expected 1 zone after creation');
  }

  // Delete the test zone to leave database completely pristine for user
  console.log('Removing sanity check zone to leave database in pristine clean state...');
  const deleteZoneRes = await fetch(`http://localhost:3000/api/admin/org/zones/${createdZone.data.id}`, {
    method: 'DELETE',
    headers,
  });
  const deleteJson = await deleteZoneRes.json();
  console.log('Delete zone status:', deleteZoneRes.status, deleteJson);

  // Final check
  const finalOrg = await (await fetch('http://localhost:3000/api/admin/org-structure', { headers })).json();
  console.log('Final zones count (clean state restored):', finalOrg.zones?.length);
  if (finalOrg.zones?.length !== 0) {
    throw new Error('Failed to clean up test zone');
  }

  // 5. Sequence verification
  console.log('\n=== 5. VERIFYING AUTO-GENERATED ID SEQUENCES (STARTING AT 1) ===');
  const currentYear = new Date().getFullYear();
  const { count: candCount } = await supabase
    .from('candidates')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${currentYear}-01-01T00:00:00.000Z`);
  const nextJoiningId = `PX-${currentYear}-${String((candCount || 0) + 1).padStart(6, '0')}`;
  console.log(`Next Candidate Joining ID will be: ${nextJoiningId}`);

  const { count: empCount } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true });
  const nextEmpId = `EMP-HQ01-${String((empCount || 0) + 1).padStart(5, '0')}`;
  console.log(`Next Employee ID will be: ${nextEmpId}`);

  if (nextJoiningId !== `PX-${currentYear}-000001`) {
    throw new Error(`Expected next joining ID to be PX-${currentYear}-000001, got ${nextJoiningId}`);
  }
  if (nextEmpId !== 'EMP-HQ01-00001') {
    throw new Error(`Expected next emp ID to be EMP-HQ01-00001, got ${nextEmpId}`);
  }

  console.log('\n>>> SUCCESS: ALL DATA CLEANUP CRITERIA & SELF-TESTS PASSED PERFECTLY! <<<');
}

runSelfTestAndAudit().catch((err) => {
  console.error('Self-test error:', err);
  process.exit(1);
});
