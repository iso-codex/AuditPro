import { createClient } from '@supabase/supabase-js';

const url = 'https://nsajpyqmmgkrejdojmrs.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zYWpweXFtbWdrcmVqZG9qbXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTg1MDYsImV4cCI6MjA5Nzg3NDUwNn0.eJXoyEfZd7sObFQdm_0UkVryJXHAZeCLvyRzANXRvLg';

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase
    .from('audit_log')
    .select(`*, profiles (full_name)`)
    .in('action_type', ['Received', 'Dispatched'])
    .order('created_at', { ascending: false });

  console.log("Error:", error);
  console.log("Data count:", data?.length);
  if (data?.length > 0) {
    console.log("Sample:", data[0]);
  }
}

test();
