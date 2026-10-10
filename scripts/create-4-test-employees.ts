import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sbUrl = process.env.VITE_SUPABASE_URL!;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(sbUrl, sbKey);
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('--- Step 1: Querying Branches and Roles ---');
  const { data: branches, error: bErr } = await sb
    .from('branches')
    .select('id, name, branch_code, zone_id, zones(name)');
  if (bErr || !branches || branches.length < 4) {
    throw new Error(`Branches error: ${bErr?.message || 'Fewer than 4 branches found'}`);
  }

  const { data: roles } = await sb.from('roles').select('id, name');
  const roleMap: Record<string, string> = {};
  for (const r of roles || []) {
    roleMap[r.name] = r.id;
  }

  console.log('Available branches:');
  for (const b of branches) {
    console.log(`- ${b.name} (${b.id}) in ${(b.zones as any)?.name} (${b.zone_id})`);
  }

  console.log('\n--- Step 1b: Signing in as Super Admin to get real session token ---');
  const { data: authSession, error: sErr } = await sb.auth.signInWithPassword({
    email: 'admin@postex.pk',
    password: 'PostExAdmin2026!',
  });
  if (sErr || !authSession.session) {
    throw new Error(`Failed to sign in as super admin: ${sErr?.message}`);
  }
  const adminToken = authSession.session.access_token;
  console.log('\n--- Step 1c: Cleaning any previous TEST employees from earlier run ---');
  const { data: oldTestEmps } = await sb
    .from('employees')
    .select('id, application_id')
    .ilike('full_name', 'TEST%');
  for (const oe of oldTestEmps || []) {
    await sb.from('joiner_asset_emails').delete().eq('employee_id', oe.id);
    await sb.from('employee_asset_status').delete().eq('employee_id', oe.id);
    await sb.from('employees').delete().eq('id', oe.id);
    if (oe.application_id) {
      await sb.from('hr_decisions').delete().eq('application_id', oe.application_id);
      const { data: appRow } = await sb.from('applications').select('candidate_id').eq('id', oe.application_id).maybeSingle();
      await sb.from('applications').delete().eq('id', oe.application_id);
      if (appRow?.candidate_id) {
        await sb.from('candidates').delete().eq('id', appRow.candidate_id);
      }
    }
  }
  const lahoreBranch = branches.find((b) => b.name.includes('Lahore')) || branches[0];
  const islamabadBranch = branches.find((b) => b.name.includes('Islamabad')) || branches[1];
  const karachiBranch = branches.find((b) => b.name.includes('Karachi')) || branches[2];
  const peshawarBranch = branches.find((b) => b.name.includes('Peshawar')) || branches[3];

  const targetBranches = [
    { branch: lahoreBranch, name: 'TEST Tariq Mahmood', type: 'all_not_provided' },
    { branch: islamabadBranch, name: 'TEST Hamza Tariq', type: 'partly_provided' },
    { branch: karachiBranch, name: 'TEST Zainab Bibi', type: 'all_provided' },
    { branch: peshawarBranch, name: 'TEST Bilal Farooq', type: 'email_sent' },
  ];

  console.log('\n--- Step 2: Creating and Approving 4 TEST Employees via Normal Approval Flow ---');
  const createdEmployees: any[] = [];

  for (let i = 0; i < targetBranches.length; i++) {
    const item = targetBranches[i];
    const candId = crypto.randomUUID();
    const appId = crypto.randomUUID();
    const randomDigits = Math.floor(1000000 + Math.random() * 9000000);
    const cnic = `35201-${randomDigits}-${(i % 9) + 1}`;
    const mobile = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;
    const email = `test.employee${i + 1}.${Date.now()}@postex.pk`;
    const joiningId = `PX-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    console.log(`\nCreating Candidate & Application for [${item.name}] in ${item.branch.name}...`);
    // 1. Insert candidate
    const { error: cErr } = await sb.from('candidates').insert({
      id: candId,
      full_name: item.name,
      cnic,
      mobile,
      email,
      joining_id: joiningId,
      branch_id: item.branch.id,
      zone_id: item.branch.zone_id,
    });
    if (cErr) throw new Error(`Failed to insert candidate: ${cErr.message}`);

    // 2. Insert application in 'draft' status
    const { error: aErr } = await sb.from('applications').insert({
      id: appId,
      candidate_id: candId,
      status: 'draft',
      current_step: 1,
      locked: false,
    });
    if (aErr) throw new Error(`Failed to insert application: ${aErr.message}`);

    // 3. Move application through normal workflow transitions: draft -> bm_verification -> hr_review
    const { error: t1Err } = await sb
      .from('applications')
      .update({ status: 'bm_verification' })
      .eq('id', appId);
    if (t1Err) throw new Error(`Failed transition to bm_verification: ${t1Err.message}`);

    const { error: t2Err } = await sb
      .from('applications')
      .update({ status: 'hr_review', submitted_at: new Date().toISOString() })
      .eq('id', appId);
    if (t2Err) throw new Error(`Failed transition to hr_review: ${t2Err.message}`);

    // 4. Execute decision via Central HR HTTP endpoint: POST /api/central/applications/:id/decision
    console.log(`Executing Central HR decision (approve_enrol) via API for application ${appId}...`);
    const decisionRes = await fetch(`${BASE_URL}/api/central/applications/${appId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        action: 'approve_enrol',
        reason: 'Candidate approved and enrolled through normal onboarding flow.',
      }),
    });

    const decisionJson = (await decisionRes.json()) as any;
    if (!decisionRes.ok || !decisionJson.success) {
      throw new Error(`Decision API failed (${decisionRes.status}): ${JSON.stringify(decisionJson)}`);
    }

    console.log(`-> Approved successfully! Response:`, {
      success: decisionJson.success,
      employeeId: decisionJson.employee?.employee_id || decisionJson.employeeId,
    });

    // 5. Fetch newly created employee record
    const { data: emp, error: empErr } = await sb
      .from('employees')
      .select('id, employee_id, full_name, branch_id, zone_id, status, joining_date, personal_email')
      .eq('application_id', appId)
      .single();

    if (empErr || !emp) {
      throw new Error(`Failed to query created employee: ${empErr?.message}`);
    }

    console.log(`-> Employee created: code = ${emp.employee_id}, id = ${emp.id}`);

    // 6. Adjust asset states per requirement:
    if (item.type === 'all_not_provided') {
      // Keep all 6 not_provided (default)
      console.log('-> Asset state: all not_provided (0/6)');
    } else if (item.type === 'partly_provided') {
      // 3 items provided (code, machine, login)
      console.log('-> Setting partly provided assets (code, machine, login)...');
      for (const k of ['code', 'machine', 'login']) {
        const patchRes = await fetch(`${BASE_URL}/api/employees/${emp.id}/asset-status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ [k]: 'provided' }),
        });
        const patchJson = await patchRes.json();
        if (!patchRes.ok) throw new Error(`Failed to patch asset ${k}: ${JSON.stringify(patchJson)}`);
      }
    } else if (item.type === 'all_provided') {
      // All 6 items provided
      console.log('-> Setting all 6 assets to provided...');
      for (const k of ['code', 'machine', 'login', 'sim', 'idcard', 'docs_to_ho']) {
        const patchRes = await fetch(`${BASE_URL}/api/employees/${emp.id}/asset-status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ [k]: 'provided' }),
        });
        const patchJson = await patchRes.json();
        if (!patchRes.ok) throw new Error(`Failed to patch asset ${k}: ${JSON.stringify(patchJson)}`);
      }
    } else if (item.type === 'email_sent') {
      // Set assets to provided (e.g. all 6 provided) and dispatch email
      console.log('-> Setting all 6 assets to provided and sending assets notification email...');
      for (const k of ['code', 'machine', 'login', 'sim', 'idcard', 'docs_to_ho']) {
        const patchRes = await fetch(`${BASE_URL}/api/employees/${emp.id}/asset-status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ [k]: 'provided' }),
        });
        const patchJson = await patchRes.json();
        if (!patchRes.ok) throw new Error(`Failed to patch asset ${k}: ${JSON.stringify(patchJson)}`);
      }

      const emailRes = await fetch(`${BASE_URL}/api/employees/${emp.id}/send-assets-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
          'x-test-email-provider': 'smtp',
        },
        body: JSON.stringify({
          recipient_email: emp.personal_email || 'test.employee4@postex.pk',
        }),
      });
      const emailJson = await emailRes.json();
      if (!emailRes.ok || !emailJson.success) throw new Error(`Failed to send email: ${JSON.stringify(emailJson)}`);
      console.log('-> Sent assets email successfully:', emailJson.message || emailJson);
    }

    createdEmployees.push({
      ...emp,
      branchName: item.branch.name,
      configType: item.type,
    });
  }

  console.log('\n--- Step 3: Setting Up Staff Logins for Role/Branch Isolation ---');
  // Update admin user so must_change_password is false
  await sb.auth.admin.updateUserById('7ffcc843-aa37-4484-a37a-171125380d05', {
    user_metadata: { must_change_password: false, role: 'super_admin', name: 'PostEx Super Admin HR' },
  });
  await sb.from('staff_profiles').update({ must_change_password: false }).eq('id', '7ffcc843-aa37-4484-a37a-171125380d05');

  // Create branch manager and zonal HR test logins if they don't already exist
  const staffAccountsToEnsure = [
    {
      email: 'bm.lahore@postex.pk',
      name: 'Lahore Branch Manager',
      role: 'branch_manager',
      branch_id: lahoreBranch.id,
      zone_id: lahoreBranch.zone_id,
    },
    {
      email: 'bm.islamabad@postex.pk',
      name: 'Islamabad Branch Manager',
      role: 'branch_manager',
      branch_id: islamabadBranch.id,
      zone_id: islamabadBranch.zone_id,
    },
    {
      email: 'bm.karachi@postex.pk',
      name: 'Karachi Branch Manager',
      role: 'branch_manager',
      branch_id: karachiBranch.id,
      zone_id: karachiBranch.zone_id,
    },
    {
      email: 'bm.peshawar@postex.pk',
      name: 'Peshawar Branch Manager',
      role: 'branch_manager',
      branch_id: peshawarBranch.id,
      zone_id: peshawarBranch.zone_id,
    },
    {
      email: 'zonal.north@postex.pk',
      name: 'North Zonal HR Manager',
      role: 'zonal_hr_manager',
      branch_id: null,
      zone_id: islamabadBranch.zone_id,
    },
  ];

  const { data: existingUsers } = await sb.auth.admin.listUsers();
  const existingUserMap = new Map((existingUsers?.users || []).map((u) => [u.email?.toLowerCase(), u]));

  for (const acc of staffAccountsToEnsure) {
    let authId: string;
    const existing = existingUserMap.get(acc.email.toLowerCase());
    if (existing) {
      authId = existing.id;
      await sb.auth.admin.updateUserById(authId, {
        password: 'PostExAdmin2026!',
        user_metadata: { must_change_password: false, role: acc.role, name: acc.name },
      });
    } else {
      const { data: newUser, error: uErr } = await sb.auth.admin.createUser({
        email: acc.email,
        password: 'PostExAdmin2026!',
        email_confirm: true,
        user_metadata: { must_change_password: false, role: acc.role, name: acc.name },
      });
      if (uErr) {
        console.warn(`Could not create auth user for ${acc.email}:`, uErr.message);
        continue;
      }
      authId = newUser.user.id;
    }

    await sb.from('staff_profiles').upsert(
      {
        id: authId,
        personal_email: acc.email,
        name: acc.name,
        role_id: roleMap[acc.role],
        branch_id: acc.branch_id,
        zone_id: acc.zone_id,
        is_active: true,
        must_change_password: false,
      },
      { onConflict: 'id' }
    );
    console.log(`Ensured login: ${acc.email} (${acc.role})`);
  }

  console.log('\n--- Step 4: Verification via GET /api/employees/joiner-tracker ---');
  // Check Super Admin view
  const trackerRes = await fetch(`${BASE_URL}/api/employees/joiner-tracker`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const trackerJson = await trackerRes.json();
  console.log('Joiner Tracker total count:', trackerJson.counts);

  console.log('\nCreated TEST Employees Summary:');
  for (const emp of createdEmployees) {
    const trackerRow = trackerJson.joiners?.find((j: any) => j.id === emp.id);
    console.log({
      code: emp.employee_id,
      name: emp.full_name,
      branch: emp.branchName,
      state_type: emp.configType,
      progress: `${trackerRow?.progress_count}/6`,
      email_status: trackerRow?.email_status,
      last_sent_at: trackerRow?.last_sent_at,
    });
  }
}

main().catch((err) => {
  console.error('Execution failed:', err);
  process.exit(1);
});
