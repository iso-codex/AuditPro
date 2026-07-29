import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('categories').select('*').limit(1);
  if (error) {
    console.log("Error querying categories:", error.message);
  } else {
    console.log("Categories table exists. Data:", data);
  }
}

run();
