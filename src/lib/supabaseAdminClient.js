import { createClient } from '@supabase/supabase-js';

// IMPORTANT: This uses the service role key which bypasses RLS.
// In a production environment, this should never be exposed to the client-side bundle.
// This is strictly for rapid prototyping and local development.
export const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);
