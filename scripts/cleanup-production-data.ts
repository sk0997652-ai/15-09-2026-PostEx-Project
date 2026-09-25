import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SUPER_ADMIN_EMAIL = 'admin@postex.pk';
const SUPER_ADMIN_ID = '7ffcc843-aa37-4484-a37a-171125380d05';

async function cleanupData() {
  console.log('=== STARTING PRODUCTION DATA CLEANUP ===\n');

  // 1. Delete notifications
  console.log('1. Clearing notifications table...');
  const { error: notifErr } = await supabase
    .from('notifications')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (notifErr) console.error('Error clearing notifications:', notifErr.message);
  else console.log('   Notifications cleared.');

  // 2. Candidate & Application tables (in dependency order)
  console.log('2. Deleting candidate and application tables...');

  // 2a. hr_decisions
  const { error: hrErr } = await supabase
    .from('hr_decisions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (hrErr) console.error('Error clearing hr_decisions:', hrErr.message);
  else console.log('   hr_decisions cleared.');

  // 2b. verification_remarks
  const { error: vrErr } = await supabase
    .from('verification_remarks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (vrErr) console.error('Error clearing verification_remarks:', vrErr.message);
  else console.log('   verification_remarks cleared.');

  // 2c. documents
  const { error: docErr } = await supabase
    .from('documents')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (docErr) console.error('Error clearing documents:', docErr.message);
  else console.log('   documents cleared.');

  // 2d. application_steps
  const { error: stepErr } = await supabase
    .from('application_steps')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (stepErr) console.error('Error clearing application_steps:', stepErr.message);
  else console.log('   application_steps cleared.');

  // 2e. employees (references applications ON DELETE RESTRICT)
  const { error: empErr } = await supabase
    .from('employees')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (empErr) console.error('Error clearing employees:', empErr.message);
  else console.log('   employees cleared.');

  // 2f. applications
  const { error: appErr } = await supabase
    .from('applications')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (appErr) console.error('Error clearing applications:', appErr.message);
  else console.log('   applications cleared.');

  // 2g. candidate_otps
  const { error: otpErr } = await supabase
    .from('candidate_otps')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (otpErr) console.error('Error clearing candidate_otps:', otpErr.message);
  else console.log('   candidate_otps cleared.');

  // 2h. candidates
  const { error: candErr } = await supabase
    .from('candidates')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (candErr) console.error('Error clearing candidates:', candErr.message);
  else console.log('   candidates cleared.');

  // 3. Storage bucket cleanup: candidate-documents
  console.log('3. Cleaning candidate-documents storage...');
  try {
    const { data: topList } = await supabase.storage.from('candidate-documents').list('applications');
    if (topList && topList.length > 0) {
      for (const item of topList) {
        const { data: subFiles } = await supabase.storage.from('candidate-documents').list('applications/' + item.name);
        if (subFiles && subFiles.length > 0) {
          const toRemove = subFiles.map(f => 'applications/' + item.name + '/' + f.name);
          await supabase.storage.from('candidate-documents').remove(toRemove);
        }
      }
      console.log('   Storage candidate-documents files removed.');
    } else {
      console.log('   Storage candidate-documents already empty.');
    }
  } catch (err: any) {
    console.error('   Storage cleanup notice:', err.message);
  }

  // 4. Test staff accounts and Supabase Auth users
  console.log('4. Deleting test staff accounts and Auth users...');
  const { data: authList, error: authListErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authListErr) {
    console.error('Error listing auth users:', authListErr.message);
  } else {
    const usersToDelete = authList.users.filter(
      u => u.email !== SUPER_ADMIN_EMAIL && u.id !== SUPER_ADMIN_ID
    );
    console.log(
      `   Found ${usersToDelete.length} test auth users to delete (preserving Super Admin: ${SUPER_ADMIN_EMAIL}).`
    );

    for (const u of usersToDelete) {
      // First delete permission overrides if any
      await supabase.from('user_permission_overrides').delete().eq('staff_profile_id', u.id);
      // Delete staff profile
      await supabase.from('staff_profiles').delete().eq('id', u.id);
      // Delete auth user
      const { error: delAuthErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delAuthErr) {
        console.error(`   Failed to delete auth user ${u.email}:`, delAuthErr.message);
      }
    }
    console.log('   Test staff accounts and Auth users successfully removed.');
  }

  // Ensure only super admin is left in staff_profiles
  const { error: staffCleanErr } = await supabase
    .from('staff_profiles')
    .delete()
    .neq('id', SUPER_ADMIN_ID);
  if (staffCleanErr) console.error('Staff profile cleanup extra check:', staffCleanErr.message);

  // 5. Organization Structure (Designations -> Departments, Branches -> Zones)
  console.log('5. Deleting test organization structure...');

  // 5a. designations
  const { error: desigErr } = await supabase
    .from('designations')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (desigErr) console.error('Error clearing designations:', desigErr.message);
  else console.log('   designations cleared.');

  // 5b. departments
  const { error: deptErr } = await supabase
    .from('departments')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (deptErr) console.error('Error clearing departments:', deptErr.message);
  else console.log('   departments cleared.');

  // 5c. branches
  const { error: branchErr } = await supabase
    .from('branches')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (branchErr) console.error('Error clearing branches:', branchErr.message);
  else console.log('   branches cleared.');

  // 5d. zones
  const { error: zoneErr } = await supabase
    .from('zones')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (zoneErr) console.error('Error clearing zones:', zoneErr.message);
  else console.log('   zones cleared.');

  console.log('\n=== FINAL VERIFICATION & LIVE COUNTS ===');
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

  const results: Record<string, any> = {};
  for (const table of countChecks) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    results[table] = count;
  }

  const { data: finalAuth } = await supabase.auth.admin.listUsers();
  results['auth_users'] = finalAuth?.users?.length;
  results['remaining_auth_emails'] = finalAuth?.users?.map(u => u.email);

  const { data: superAdminStaff } = await supabase
    .from('staff_profiles')
    .select('id, name, role_id, roles(name)');
  results['remaining_staff'] = superAdminStaff;

  console.log(JSON.stringify(results, null, 2));
}

cleanupData().catch(console.error);
