
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Simple TOTP implementation
function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  return secret;
}

function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  
  for (const char of encoded.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
  }
  
  return bytes;
}

async function generateTOTP(secret: string, timeStep = 30): Promise<string> {
  const key = base32Decode(secret);
  const time = Math.floor(Date.now() / 1000 / timeStep);
  
  const timeBuffer = new ArrayBuffer(8);
  const timeView = new DataView(timeBuffer);
  timeView.setUint32(4, time, false);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
  const signatureArray = new Uint8Array(signature);
  
  const offset = signatureArray[19] & 0xf;
  const code = (
    ((signatureArray[offset] & 0x7f) << 24) |
    ((signatureArray[offset + 1] & 0xff) << 16) |
    ((signatureArray[offset + 2] & 0xff) << 8) |
    (signatureArray[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

function generateBackupCodes(): string[] {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    let code = '';
    for (let j = 0; j < 8; j++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    codes.push(code);
  }
  return codes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { action, code, backupCode } = await req.json();

    if (action === 'setup') {
      const secret = generateSecret();
      const backupCodes = generateBackupCodes();
      
      // Store MFA settings
      await supabase.from('user_mfa').upsert({
        user_id: user.id,
        secret_key: secret,
        is_enabled: false,
        backup_codes: backupCodes
      });

      const qrCodeUrl = `otpauth://totp/SecureTalk:${user.email}?secret=${secret}&issuer=SecureTalk`;

      return new Response(JSON.stringify({
        secret,
        qrCodeUrl,
        backupCodes
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'enable') {
      // Verify the provided code
      const { data: mfaData } = await supabase
        .from('user_mfa')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!mfaData) {
        throw new Error('MFA not set up');
      }

      const expectedCode = await generateTOTP(mfaData.secret_key);
      
      if (code !== expectedCode) {
        throw new Error('Invalid verification code');
      }

      // Enable MFA
      await supabase
        .from('user_mfa')
        .update({ is_enabled: true })
        .eq('user_id', user.id);

      // Log audit event
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        event_type: 'mfa_enabled',
        event_data: {},
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'verify') {
      const { data: mfaData } = await supabase
        .from('user_mfa')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!mfaData?.is_enabled) {
        throw new Error('MFA not enabled');
      }

      let isValid = false;

      if (code) {
        const expectedCode = await generateTOTP(mfaData.secret_key);
        isValid = code === expectedCode;
      } else if (backupCode && mfaData.backup_codes?.includes(backupCode)) {
        isValid = true;
        // Remove used backup code
        const updatedCodes = mfaData.backup_codes.filter(c => c !== backupCode);
        await supabase
          .from('user_mfa')
          .update({ backup_codes: updatedCodes })
          .eq('user_id', user.id);
      }

      // Log audit event
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        event_type: isValid ? 'mfa_success' : 'mfa_failed',
        event_data: { backup_code_used: !!backupCode },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });

      return new Response(JSON.stringify({ valid: isValid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'disable') {
      await supabase
        .from('user_mfa')
        .update({ is_enabled: false })
        .eq('user_id', user.id);

      // Log audit event
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        event_type: 'mfa_disabled',
        event_data: {},
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'status') {
      const { data: mfaData } = await supabase
        .from('user_mfa')
        .select('is_enabled')
        .eq('user_id', user.id)
        .single();

      return new Response(JSON.stringify({ 
        enabled: mfaData?.is_enabled || false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('MFA error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
