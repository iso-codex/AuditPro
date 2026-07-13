import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Save, Lock } from 'lucide-react';

const ProfileSettings = () => {
  const { profile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (newPassword.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      
      setMessage('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Profile Settings</h2>
        <p className="text-gray-500">Manage your account settings and update your password.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm mb-6">
        <h3 className="text-lg font-semibold border-b pb-3 mb-4">Account Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="block text-xs uppercase text-gray-500 font-semibold mb-1">Full Name</span>
            <span className="font-medium">{profile?.full_name}</span>
          </div>
          <div>
            <span className="block text-xs uppercase text-gray-500 font-semibold mb-1">Role</span>
            <span className="font-medium capitalize">{profile?.role?.replace('_', ' ')}</span>
          </div>
          {profile?.department && (
            <div>
              <span className="block text-xs uppercase text-gray-500 font-semibold mb-1">Department</span>
              <span className="font-medium">{profile?.department}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="text-lg font-semibold border-b pb-3 mb-4 flex items-center gap-2">
          <Lock size={18} /> Update Password
        </h3>
        
        {message && <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm">{message}</div>}
        {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="form-label">New Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Confirm New Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <div className="spinner border-0" style={{ width: '16px', height: '16px' }}></div> : <Save size={18} />}
            <span>Save Password</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;
