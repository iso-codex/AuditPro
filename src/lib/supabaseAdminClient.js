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

// IMPORTANT: This uses the service role key which bypasses RLS.
// In a production environment, this should NEVER be exposed to the client-side bundle.
// Use a secure server-side API route instead.
export const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  activeKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);

