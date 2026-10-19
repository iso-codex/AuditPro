import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    // Initialize Admin Client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is an admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch user profile to verify role
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();

    if (req.method === 'POST') {
      if (body.action === 'delete') {
        const { user_id } = body;
        const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
        
        if (error) {
          console.error("Delete user error:", error);
          throw error;
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Create user
      const { email, password, full_name, role, department_id, department } = body;
      
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name }
      });

      if (error) {
        console.error("Create user error:", error);
        throw error;
      }

      // Upsert profile
      const cleanDeptId = (!department_id || department_id === 'None' || department_id === '') ? null : department_id;
      const profileData: any = {
        id: data.user.id,
        full_name,
        role,
        department_id: cleanDeptId
      };
      if (department && department !== 'None') {
        profileData.department = department;
      }

      const { error: profileError } = await supabaseAdmin.from('profiles').upsert(profileData);

      if (profileError) {
        console.error("Upsert profile error:", profileError);
        throw profileError;
      }

      return new Response(JSON.stringify({ user: data.user }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } 
    
    if (req.method === 'PUT') {
      // Reset password
      const { user_id, password } = body;
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: password
      });

      if (error) {
        console.error("Update user error:", error);
        throw error;
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'DELETE') {
      // Delete user (backward compatibility)
      const { user_id } = body;
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      
      if (error) {
        console.error("Delete user error (DELETE method):", error);
        throw error;
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error("Method not supported");
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || error.toString() }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
