import { createClient } from '@supabase/supabase-js';

// Setup Supabase (use your actual keys and a valid user token if RLS is enabled)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nsajpyqmmgkrejdojmrs.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zYWpweXFtbWdrcmVqZG9qbXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTg1MDYsImV4cCI6MjA5Nzg3NDUwNn0.eJXoyEfZd7sObFQdm_0UkVryJXHAZeCLvyRzANXRvLg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runRaceTest() {
  // 1. Get a test department and item
  const { data: deptData } = await supabase.from('departments').select('id').limit(1).single();
  const { data: itemData } = await supabase.from('items').select('id, quantity_in_store').limit(1).single();
  
  if (!deptData || !itemData) {
    console.error("Need at least one department and item to run the test.");
    return;
  }
  
  const deptId = deptData.id;
  const itemId = itemData.id;
  
  console.log(`Starting race condition test for item ${itemId}`);
  console.log(`Targeting 20 parallel sales of qty 1.`);

  // 2. Fire 20 parallel requests
  const promises = [];
  for (let i = 0; i < 20; i++) {
    // Generate a unique idempotency key for each parallel request
    const clientUuid = crypto.randomUUID();
    promises.push(
      supabase.rpc('process_sales_entry_rpc', {
        p_client_uuid: clientUuid,
        p_department_id: deptId,
        p_sales: [{ item_id: itemId, qty: 1 }]
      }).then(res => {
        if (res.error) return `Failed: ${res.error.message}`;
        return `Success`;
      })
    );
  }

  const results = await Promise.all(promises);
  const successes = results.filter(r => r === 'Success').length;
  const failures = results.filter(r => r !== 'Success').length;
  
  console.log(`\nResults:`);
  console.log(`${successes} requests succeeded.`);
  console.log(`${failures} requests failed (e.g. due to insufficient stock).`);
  
  // 3. Verify final stock
  const { data: finalItem } = await supabase.from('items').select('quantity_in_store').eq('id', itemId).single();
  const { data: finalDeptInv } = await supabase.from('department_inventory').select('quantity').eq('item_id', itemId).eq('department_id', deptId).single();
  
  console.log(`\nFinal state:`);
  console.log(`Central Store Stock: ${finalItem?.quantity_in_store}`);
  console.log(`Department Stock: ${finalDeptInv?.quantity || 0}`);
}

runRaceTest().catch(console.error);
