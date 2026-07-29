import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogIn, AlertCircle, ClipboardCheck, Search, FileText, BarChart2, CheckCircle } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const { login, user, profile, profileError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2900); // Coordinates with 2.5s delay + 0.4s fade out
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'store_manager') navigate('/manager/stock');
      else if (profile.role === 'department_staff') navigate('/staff/my-requisitions');
      else if (profile.role === 'auditor') navigate('/auditor/overview');
      else if (profile.role === 'admin') navigate('/admin/users');
      else if (profile.role === 'manager') navigate('/manager-role/requisitions');
      else if (profile.role === 'store') navigate('/store-role/inbox');
      else if (profile.role === 'mis') navigate('/mis/sales');
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
    <>
      {showSplash && (
        <div className="splash-container">
          <div className="floating-icons">
            <ClipboardCheck size={48} className="floating-icon icon-1" />
            <Search size={40} className="floating-icon icon-2" />
            <FileText size={56} className="floating-icon icon-3" />
            <BarChart2 size={44} className="floating-icon icon-4" />
            <CheckCircle size={36} className="floating-icon icon-5" />
          </div>
          <div className="splash-logo">
            <ShieldAlert size={48} strokeWidth={2.5} />
          </div>
          <h1 className="splash-text">AuditPro</h1>
          <p className="splash-subtitle">Inventory & Auditing System</p>
        </div>
      )}
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


        
        {user && profile && !['store_manager', 'department_staff', 'auditor', 'admin', 'manager', 'store', 'mis'].includes(profile.role) && (
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
    </>
  );
};

export default Login;
