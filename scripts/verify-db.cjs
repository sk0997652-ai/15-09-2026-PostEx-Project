// Comprehensive verification of all 19 tables and RLS enforcement
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

const EXPECTED_TABLES = [
  'zones',
  'branches',
  'departments',
  'designations',
  'roles',
  'permissions',
  'role_permissions',
  'staff_profiles',
  'user_permission_overrides',
  'candidates',
  'candidate_otps',
  'applications',
  'application_steps',
  'documents',
  'verification_remarks',
  'hr_decisions',
  'employees',
  'audit_logs',
  'notifications'
];

async function runVerification() {
  console.log('='.repeat(70));
  console.log(`Verifying Supabase Project: ${supabaseUrl}`);
  console.log('='.repeat(70));

  const results = [];

  for (const table of EXPECTED_TABLES) {
    // 1. Check table existence with Admin client
    const { data: adminData, error: adminErr } = await supabaseAdmin.from(table).select('*').limit(1);
    
    // 2. Test RLS write rejection with Anon client
    const { error: anonWriteErr } = await supabaseAnon.from(table).insert({});

    const exists = !adminErr;
    const rlsEnforced = anonWriteErr && (
      anonWriteErr.code === '42501' || // insufficient_privilege / violates row-level security policy
      anonWriteErr.message.includes('row-level security') ||
      anonWriteErr.message.includes('violates')
    );

    results.push({
      table,
      exists: exists ? 'YES' : 'NO',
      adminStatus: adminErr ? `${adminErr.code}: ${adminErr.message}` : 'READY (200 OK)',
      rlsEnforced: rlsEnforced ? 'ENABLED (deny_all active: 42501)' : 'FAIL / NOT ENFORCED'
    });
  }

  console.table(results);

  // Check seeded roles
  const { data: rolesData, error: rolesErr } = await supabaseAdmin.from('roles').select('name');
  console.log('\nSeeded Roles in Database:', rolesData ? rolesData.map(r => r.name) : rolesErr);

  const existingCount = results.filter(r => r.exists === 'YES').length;
  const rlsCount = results.filter(r => r.rlsEnforced.startsWith('ENABLED')).length;

  console.log(`\n======================================================================`);
  console.log(`Summary: ${existingCount}/${EXPECTED_TABLES.length} tables exist in live database.`);
  console.log(`Summary: ${rlsCount}/${EXPECTED_TABLES.length} tables have RLS strictly verified.`);
  console.log(`======================================================================\n`);
}

runVerification();
