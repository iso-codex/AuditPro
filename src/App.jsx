import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import NotificationBell from './components/NotificationBell';

// Store Manager Pages
import ReceiveGoods from './pages/StoreManager/ReceiveGoods';
import RequisitionInbox from './pages/StoreManager/RequisitionInbox';
import StockLevels from './pages/StoreManager/StockLevels';
import DispatchHistory from './pages/StoreManager/DispatchHistory';

// Department Staff Pages
import RaiseRequisition from './pages/DepartmentStaff/RaiseRequisition';
import MyRequisitions from './pages/DepartmentStaff/MyRequisitions';

// Auditor Pages
import AuditorOverview from './pages/Auditor/Overview';
import AuditLog from './pages/Auditor/AuditLog';
import DiscrepancyReport from './pages/Auditor/DiscrepancyReport';

// Admin Pages
import UserManagement from './pages/Admin/UserManagement';
import CatalogManagement from './pages/Admin/CatalogManagement';
import GlobalRequisitions from './pages/Admin/GlobalRequisitions';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, profile, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) return <div className="page-content flex items-center justify-center"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    return <Navigate to="/login" replace />; // Redirect unauthorized
  }

  return (
    <div className="app-container">
      <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)}></div>
      )}

      <main className="main-content">
        <div className="mobile-header">
          <div className="flex items-center gap-2 font-bold text-lg" style={{ color: 'var(--accent-color)' }}>
            <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--accent-color)', borderRadius: '4px' }}></div>
            AuditPro
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <button className="btn btn-outline hide-on-desktop" style={{ padding: '0.5rem' }} onClick={() => setMobileMenuOpen(true)}>
              <Menu size={20} />
            </button>
          </div>
        </div>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* Store Manager Routes (Admins also get access) */}
      <Route element={<ProtectedRoute allowedRoles={['store_manager', 'admin']} />}>
        <Route path="/manager/receive" element={<ReceiveGoods />} />
        <Route path="/manager/inbox" element={<RequisitionInbox />} />
        <Route path="/manager/stock" element={<StockLevels />} />
        <Route path="/manager/dispatch" element={<DispatchHistory />} />
      </Route>

      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/catalog" element={<CatalogManagement />} />
        <Route path="/admin/requisitions" element={<GlobalRequisitions />} />
      </Route>

      {/* Department Staff Routes */}
      <Route element={<ProtectedRoute allowedRoles={['department_staff']} />}>
        <Route path="/staff/raise" element={<RaiseRequisition />} />
        <Route path="/staff/my-requisitions" element={<MyRequisitions />} />
      </Route>

      {/* Auditor Routes */}
      <Route element={<ProtectedRoute allowedRoles={['auditor']} />}>
        <Route path="/auditor/overview" element={<AuditorOverview />} />
        <Route path="/auditor/logs" element={<AuditLog />} />
        <Route path="/auditor/discrepancies" element={<DiscrepancyReport />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
