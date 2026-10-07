import { createClient } from '@supabase/supabase-js';

const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const activeKey = serviceRoleKey || anonKey;

if (!serviceRoleKey) {
  console.warn(
    '[supabaseAdmin] VITE_SUPABASE_SERVICE_ROLE_KEY is not set. ' +
    'Falling back to anon key — admin operations like Create User and Reset Password will fail. ' +
    'Add the service role key to your .env.local and restart the dev server.'
  );
}

export const supabaseAdmin = new Proxy({}, {
  get: function(target, prop) {
    throw new Error(
      "supabaseAdminClient is deprecated and strictly forbidden in the frontend bundle. " +
      "Use Supabase Edge Functions for admin operations."
    );
  }
});

