import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogIn, AlertCircle } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, user, profile, profileError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'store_manager') navigate('/manager/stock');
      else if (profile.role === 'department_staff') navigate('/staff/my-requisitions');
      else if (profile.role === 'auditor') navigate('/auditor/overview');
      else if (profile.role === 'admin') navigate('/admin/users');
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    try {
      await login(email, password);
    } catch (err) {
      console.error("Login error:", err);
      let errMsg = 'Failed to login. Please check your credentials.';
      if (err instanceof Error && err.message) {
        errMsg = err.message;
      } else if (typeof err === 'object' && err !== null) {
        const str = JSON.stringify(err);
        if (str !== '{}') errMsg = str;
      } else if (typeof err === 'string') {
        errMsg = err;
      }
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <ShieldAlert size={40} className="logo-icon" />
          </div>
          <h1>Welcome to AuditPro</h1>
          <p>Inventory and Auditing System</p>
        </div>
        
        {error && (
          <div className="login-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {user && !profile && !isSubmitting && (
          <div className="login-error" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-color)', display: 'block', wordBreak: 'break-all', textAlign: 'left' }}>
            <AlertCircle size={18} />
            <span>Login successful, but no matching profile found in the database.</span>
            <br /><br />
            <strong>Profile Fetch Error:</strong>
            <pre style={{ fontSize: '11px', marginTop: '4px' }}>{profileError || "No error reported (0 rows found)"}</pre>
          </div>
        )}
        
        {user && profile && !['store_manager', 'department_staff', 'auditor', 'admin'].includes(profile.role) && (
          <div className="login-error">
            <AlertCircle size={18} />
            <span>Profile found, but role '{profile.role}' is not recognized.</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required 
            />
          </div>
          
          <div className="form-group mb-6">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
            ) : (
              <>
                <LogIn size={18} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
