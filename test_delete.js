import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nsajpyqmmgkrejdojmrs.supabase.co';
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'removed_for_security';

async function testDelete() {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // Create a dummy user
  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email: 'test_delete_dummy@example.com',
    password: 'password123',
    email_confirm: true
  });

  if (createError) {
    console.error('Create error:', createError);
    return;
  }
  
  const userId = createData.user.id;
  console.log('Created user:', userId);

  // Delete the user
  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('Delete error:', deleteError);
  } else {
    console.log('Deleted user successfully.');
  }
}

testDelete();
