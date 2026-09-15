// Supabase Edge Function: regenerate-password
// Generates a cryptographically secure temporary password conforming to [HARD RULE] policy,
// updates it via Supabase Auth Admin API (service role), and resets must_change_password = true.

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

// [HARD RULE] Password policy generator:
// Min 10 chars, at least 1 letter, at least 1 number.
function generateSecureTempPassword(length = 14): string {
  const lettersUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lettersLower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*()-_=+';
  const allChars = lettersUpper + lettersLower + digits + special;

  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  // Guarantee at least one uppercase, one lowercase, one digit, one special
  const pwdChars = [
    lettersUpper[randomValues[0] % lettersUpper.length],
    lettersLower[randomValues[1] % lettersLower.length],
    digits[randomValues[2] % digits.length],
    special[randomValues[3] % special.length],
  ];

  for (let i = 4; i < length; i++) {
    pwdChars.push(allChars[randomValues[i] % allChars.length]);
  }

  // Fisher-Yates shuffle
  for (let i = pwdChars.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [pwdChars[i], pwdChars[j]] = [pwdChars[j], pwdChars[i]];
  }

  return pwdChars.join('');
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase server configuration missing on Edge Function.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Admin Supabase Client (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Authorization header required.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { staff_profile_id } = await req.json();

    if (!staff_profile_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: staff_profile_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate new compliant temporary password
    const newTempPassword = generateSecureTempPassword(14);

    // Update Auth user password via Admin API
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      staff_profile_id,
      {
        password: newTempPassword,
        user_metadata: { must_change_password: true },
      }
    );

    if (updateAuthError) {
      return new Response(
        JSON.stringify({ error: `Failed to update credentials: ${updateAuthError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update staff_profiles table
    const { error: updateProfileError } = await supabaseAdmin
      .from('staff_profiles')
      .update({ must_change_password: true })
      .eq('id', staff_profile_id);

    if (updateProfileError) {
      console.error('Error updating staff_profiles table:', updateProfileError);
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      actor_type: 'staff',
      action: 'STAFF_PASSWORD_REGENERATED',
      entity_type: 'staff_profiles',
      entity_id: staff_profile_id,
      metadata: { initiated_by: user.id },
    });

    return new Response(
      JSON.stringify({
        success: true,
        temp_password: newTempPassword,
        must_change_password: true,
        message: 'New temporary password generated successfully. It must be changed upon next login.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
