import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RefreshCw, UserCheck, UserX, Save } from 'lucide-react';

const ROLES = ['store_manager', 'department_staff', 'auditor', 'admin'];
const DEPARTMENTS = ['Kitchen', 'Bar', 'Byte', 'HQ', 'Maintenance', 'None'];

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

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

  return (
    <div className="admin-page">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>User Management</h2>
          <p>Manage roles and departments for all users.</p>
        </div>
        <button className="btn btn-outline" onClick={fetchUsers} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spinner border-0' : ''} />
          <span>Refresh</span>
        </button>
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
                  {user.isDirty && (
                    <button 
                      className="btn btn-primary p-1 text-sm" 
                      onClick={() => saveUser(user)}
                      disabled={saving === user.id}
                    >
                      {saving === user.id ? <div className="spinner border-0" style={{width: '16px', height: '16px'}}></div> : <Save size={16} />}
                      <span>Save</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
