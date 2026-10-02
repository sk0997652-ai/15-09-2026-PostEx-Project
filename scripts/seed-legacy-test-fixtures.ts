import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedLegacyFixtures() {
  const northZoneId = '11111111-1111-1111-1111-111111111111';
  const centralZoneId = '22222222-2222-2222-2222-222222222222';
  const lahoreBranchId = '44444444-4444-4444-4444-444444444441';
  const islamabadBranchId = '44444444-4444-4444-4444-444444444442';
  const seedCandId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  await supabaseAdmin.from('zones').upsert([
    { id: northZoneId, name: 'North Zone', zone_code: 'ZN-NORTH', region: 'Punjab', is_active: true },
    { id: centralZoneId, name: 'Central Zone', zone_code: 'ZN-CENTRAL', region: 'Punjab', is_active: true },
  ]);

  await supabaseAdmin.from('branches').upsert([
    {
      id: lahoreBranchId,
      name: 'Lahore Main Hub',
      branch_code: 'BR-LHR',
      zone_id: centralZoneId,
      branch_type: 'Hub',
      city_address: 'Lahore',
      address: 'Lahore',
      is_active: true,
    },
    {
      id: islamabadBranchId,
      name: 'Islamabad Hub',
      branch_code: 'BR-ISB',
      zone_id: northZoneId,
      branch_type: 'Hub',
      city_address: 'Islamabad',
      address: 'Islamabad',
      is_active: true,
    },
  ]);

  await supabaseAdmin.from('candidate_otps').delete().eq('candidate_id', seedCandId);
  const { error: candErr } = await supabaseAdmin.from('candidates').upsert({
    id: seedCandId,
    joining_id: 'PEX-2026-001',
    full_name: 'Muhammad Ali',
    cnic: '35201-1234567-1',
    mobile: '03001234567',
    email: 'muhammad.ali@example.com',
    zone_id: centralZoneId,
    branch_id: lahoreBranchId,
    created_by: '7ffcc843-aa37-4484-a37a-171125380d05',
  });
  if (candErr) {
    console.error('Candidate upsert error:', candErr);
  }

  const { data: existingApp } = await supabaseAdmin
    .from('applications')
    .select('id')
    .eq('candidate_id', seedCandId)
    .maybeSingle();

  if (!existingApp) {
    await supabaseAdmin.from('applications').insert({
      candidate_id: seedCandId,
      status: 'draft',
      track: 'executive',
    });
  }
}

seedLegacyFixtures().catch((err) => {
  console.error(err);
  process.exit(1);
});
