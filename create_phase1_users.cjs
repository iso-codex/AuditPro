const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nsajpyqmmgkrejdojmrs.supabase.co';
const serviceRoleKey = 'removed_for_security';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  // 1. Get Take Out department
  const { data: dept } = await supabase.from('departments').select('id').eq('name', 'Take Out').single();
  console.log('Take Out Dept ID:', dept.id);

  // 2. Create Take Out Staff
  let { data: staffUser, error: staffErr } = await supabase.auth.admin.createUser({
    email: 'takeout@auditpro.com',
    password: 'password123',
    email_confirm: true,
    user_metadata: { full_name: 'Takeout Staff' }
  });
  if (staffErr && !staffErr.message.includes('already been registered')) {
    console.error('Staff error:', staffErr);
  } else if (staffUser?.user) {
    await supabase.from('profiles').upsert({
      id: staffUser.user.id,
      full_name: 'Takeout Staff',
      role: 'department_staff',
      department_id: dept.id,
      department: 'Take Out'
    });
    console.log('Created takeout@auditpro.com');
  }

  // 3. Create Records Keeper
  let { data: rkUser, error: rkErr } = await supabase.auth.admin.createUser({
    email: 'recordskeeper@auditpro.com',
    password: 'password123',
    email_confirm: true,
    user_metadata: { full_name: 'Records Keeper' }
  });
  if (rkErr && !rkErr.message.includes('already been registered')) {
    console.error('RK error:', rkErr);
  } else if (rkUser?.user) {
    await supabase.from('profiles').upsert({
      id: rkUser.user.id,
      full_name: 'Records Keeper',
      role: 'records_keeper',
      department_id: null,
      department: null
    });
    console.log('Created recordskeeper@auditpro.com');
  }

  console.log('Done!');
}

main().catch(console.error);
