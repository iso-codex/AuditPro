import { createClient } from '@supabase/supabase-js';

const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error(
    '[supabaseAdmin] VITE_SUPABASE_SERVICE_ROLE_KEY is not set. ' +
    'Admin operations (create user, reset password) will fail. ' +
    'Add it to your .env.local file and restart the dev server.'
  );
}

// IMPORTANT: This uses the service role key which bypasses RLS.
// In a production environment, this should NEVER be exposed to the client-side bundle.
// Use a secure server-side API route instead.
export const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);
