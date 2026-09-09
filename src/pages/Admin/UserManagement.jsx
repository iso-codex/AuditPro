import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { supabaseAdmin } from '../../lib/supabaseAdminClient';
import { RefreshCw, Save, UserPlus, KeyRound, X } from 'lucide-react';

const ROLES = ['store_manager', 'department_staff', 'auditor', 'admin', 'store', 'manager', 'mis'];
const DEPARTMENTS = ['Kitchen', 'Bar', 'Byte', 'HQ', 'Maintenance', 'None'];

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Create User Form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDepartment, setNewDepartment] = useState('None');
  const [isCreating, setIsCreating] = useState(false);

  // Reset Password Form
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Failed to fetch users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateUser = async (id, field, value) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: value, isDirty: true } : u));
  };

  const saveUser = async (user) => {
    setSaving(user.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: user.role, department: user.department === 'None' ? null : user.department })
        .eq('id', user.id);
        
      if (error) throw error;
      
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isDirty: false } : u));
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsCreating(true);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    try {
      // 1. Create auth user via direct REST call to Supabase Admin API
      const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          email_confirm: true,
          user_metadata: { full_name: newFullName }
        })
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.message || createData.msg || 'Failed to create auth user');

      const newUserId = createData.id;

      // 2. Upsert profile (the Postgres trigger may auto-create it, we ensure role/dept are set)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: newUserId,
          full_name: newFullName,
          role: newRole,
          department: newDepartment === 'None' ? null : newDepartment
        });

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw new Error('User created in Auth, but Profile failed: ' + profileError.message);
      }

      alert('User created successfully!');
      setShowCreateModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('');
      setNewDepartment('None');
      fetchUsers();
    } catch (err) {
      alert('Failed to create user: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const openResetModal = (user) => {
    setSelectedUser(user);
    setResetPasswordVal('');
    setShowResetModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    setIsResetting(true);
    try {
      // Direct REST call to Supabase Admin API to update user password
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ password: resetPasswordVal })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || resData.msg || 'Failed to reset password');

      alert('Password reset successfully!');
      setShowResetModal(false);
      setSelectedUser(null);
    } catch (err) {
      alert('Failed to reset password: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h2>User Management</h2>
          <p>Manage roles, departments, create users, and reset passwords.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <UserPlus size={18} />
            <span>Create User</span>
          </button>
          <button className="btn btn-outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spinner border-0' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-4">
                  <div className="spinner mx-auto"></div>
                </td>
              </tr>
            ) : users.map(user => (
              <tr key={user.id}>
                <td className="font-medium">{user.full_name || 'Anonymous'}</td>
                <td>
                  <select 
                    className="form-select" 
                    style={{ padding: '0.25rem', width: '150px' }}
                    value={user.role || ''}
                    onChange={(e) => handleUpdateUser(user.id, 'role', e.target.value)}
                  >
                    <option value="" disabled>Select Role</option>
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r.replace('_', ' ')}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select 
                    className="form-select" 
                    style={{ padding: '0.25rem', width: '150px' }}
                    value={user.department || 'None'}
                    onChange={(e) => handleUpdateUser(user.id, 'department', e.target.value)}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </td>
                <td className="text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td>
                  <div className="flex gap-2">
                    {user.isDirty && (
                      <button 
                        className="btn btn-primary p-1 text-sm" 
                        onClick={() => saveUser(user)}
                        title="Save Role/Department"
                        disabled={saving === user.id}
                      >
                        {saving === user.id ? <div className="spinner border-0" style={{width: '16px', height: '16px'}}></div> : <Save size={16} />}
                      </button>
                    )}
                    <button 
                      className="btn btn-outline p-1 text-sm" 
                      onClick={() => openResetModal(user)}
                      title="Reset Password"
                    >
                      <KeyRound size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <>
          <div className="side-panel-overlay" onClick={() => setShowCreateModal(false)}></div>
          <div className="side-panel flex flex-col" style={{ maxWidth: '400px' }}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <h2 className="text-xl font-bold">Create New User</h2>
              <button className="btn btn-outline p-2 rounded-full" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4 flex-1">
              <div>
                <label className="form-label">Email Address</label>
                <input type="email" required className="form-input w-full" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Full Name</label>
                <input type="text" required className="form-input w-full" value={newFullName} onChange={e => setNewFullName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Password</label>
                <input type="password" required className="form-input w-full" minLength="6" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Role</label>
                <select className="form-select w-full" required value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="" disabled>Select Role...</option>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Department</label>
                <select className="form-select w-full" value={newDepartment} onChange={e => setNewDepartment(e.target.value)}>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary w-full mt-6" disabled={isCreating}>
                {isCreating ? <div className="spinner border-0" style={{width: '16px', height: '16px'}}></div> : <UserPlus size={18} />}
                <span>Create User</span>
              </button>
            </form>
          </div>
        </>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedUser && (
        <>
          <div className="side-panel-overlay" onClick={() => setShowResetModal(false)}></div>
          <div className="side-panel flex flex-col" style={{ maxWidth: '400px' }}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <h2 className="text-xl font-bold">Reset Password</h2>
              <button className="btn btn-outline p-2 rounded-full" onClick={() => setShowResetModal(false)}>
                <X size={20} />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Enter a new password for <strong>{selectedUser.full_name || 'this user'}</strong>.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="form-label">New Password</label>
                <input type="password" required className="form-input w-full" minLength="6" value={resetPasswordVal} onChange={e => setResetPasswordVal(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-danger w-full mt-6" disabled={isResetting}>
                {isResetting ? <div className="spinner border-0" style={{width: '16px', height: '16px'}}></div> : <KeyRound size={18} />}
                <span>Confirm Reset</span>
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default UserManagement;
