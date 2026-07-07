import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const { data, error } = await supabase.auth.signUp({
    email: 'admin@auditpro.com',
    password: 'password123'
  });
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Created user:', data.user.id);
  }
}

createAdmin();
