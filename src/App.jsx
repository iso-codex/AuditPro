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
import PurchaseOrders from './pages/StoreManager/PurchaseOrders';

// Department Staff Pages
import RaiseRequisition from './pages/DepartmentStaff/RaiseRequisition';
import MyRequisitions from './pages/DepartmentStaff/MyRequisitions';

// Auditor Pages
import AuditorOverview from './pages/Auditor/Overview';
import AuditLog from './pages/Auditor/AuditLog';
import DiscrepancyReport from './pages/Auditor/DiscrepancyReport';
import ReportGeneration from './pages/Auditor/ReportGeneration';

// Admin Pages
import UserManagement from './pages/Admin/UserManagement';
import CatalogManagement from './pages/Admin/CatalogManagement';
import GlobalRequisitions from './pages/Admin/GlobalRequisitions';
import SupplierManagement from './pages/Admin/SupplierManagement';

// New Roles Pages
import ProfileSettings from './pages/ProfileSettings';
import GlobalRequisitionsManager from './pages/Manager/GlobalRequisitionsManager';
import GoodsHistory from './pages/Manager/GoodsHistory';
import RequisitionInboxStore from './pages/Store/RequisitionInboxStore';
import DepartmentInventory from './pages/DepartmentStaff/DepartmentInventory';
import SalesEntry from './pages/MIS/SalesEntry';

// New Feature Pages
import WeeklyStockCount from './pages/Shared/WeeklyStockCount';
import DepartmentStock from './pages/Manager/DepartmentStock';
import SalesReconciliation from './pages/MIS/SalesReconciliation';
import ThresholdManagement from './pages/Manager/ThresholdManagement';
import ProcurementWorkspace from './pages/Procurement/ProcurementWorkspace';

import ErrorBoundary from './components/ErrorBoundary';

import OfflineSync from './components/OfflineSync';

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
      <OfflineSync />
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
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
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
        <Route path="/manager/purchase-orders" element={<PurchaseOrders />} />
      </Route>

      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/catalog" element={<CatalogManagement />} />
        <Route path="/admin/requisitions" element={<GlobalRequisitions />} />
        <Route path="/admin/suppliers" element={<SupplierManagement />} />
        <Route path="/admin/thresholds" element={<ThresholdManagement />} />
      </Route>

      {/* Department Staff Routes */}
      <Route element={<ProtectedRoute allowedRoles={['department_staff']} />}>
        <Route path="/staff/raise" element={<RaiseRequisition />} />
        <Route path="/staff/my-requisitions" element={<MyRequisitions />} />
      </Route>

      {/* Auditor Routes */}
      <Route element={<ProtectedRoute allowedRoles={['auditor']} />}>
        <Route path="/auditor/overview" element={<AuditorOverview />} />
        <Route path="/auditor/requisitions" element={<GlobalRequisitions />} />
        <Route path="/auditor/stock" element={<StockLevels />} />
        <Route path="/auditor/logs" element={<AuditLog />} />
        <Route path="/auditor/discrepancies" element={<DiscrepancyReport />} />
        <Route path="/auditor/reports" element={<ReportGeneration />} />
        <Route path="/auditor/counts" element={<WeeklyStockCount />} />
        <Route path="/auditor/thresholds" element={<ThresholdManagement />} />
      </Route>

      {/* New Manager Routes */}
      <Route element={<ProtectedRoute allowedRoles={['manager']} />}>
        <Route path="/manager-role/requisitions" element={<GlobalRequisitionsManager />} />
        <Route path="/manager-role/counts" element={<WeeklyStockCount />} />
        <Route path="/manager-role/stock" element={<DepartmentStock />} />
        <Route path="/manager-role/thresholds" element={<ThresholdManagement />} />
      </Route>

      {/* Shared Routes (Store & Store Manager) */}
      <Route element={<ProtectedRoute allowedRoles={['store_manager', 'store', 'manager', 'auditor', 'admin']} />}>
        <Route path="/shared/history" element={<GoodsHistory />} />
      </Route>

      {/* New Store Routes */}
      <Route element={<ProtectedRoute allowedRoles={['store']} />}>
        <Route path="/store-role/inbox" element={<RequisitionInboxStore />} />
        <Route path="/store-role/count" element={<WeeklyStockCount />} />
        <Route path="/store-role/sales" element={<SalesEntry />} />
        <Route path="/store-role/reconciliation" element={<SalesReconciliation />} />
      </Route>

      {/* New MIS Routes */}
      <Route element={<ProtectedRoute allowedRoles={['mis']} />}>
        <Route path="/mis/sales" element={<SalesEntry />} />
        <Route path="/mis/reconciliation" element={<SalesReconciliation />} />
      </Route>

      {/* Procurement Routes */}
      <Route element={<ProtectedRoute allowedRoles={['procurement', 'admin']} />}>
        <Route path="/procurement/workspace" element={<ProcurementWorkspace />} />
        <Route path="/procurement/suppliers" element={<SupplierManagement />} />
        <Route path="/procurement/purchase-orders" element={<PurchaseOrders />} />
      </Route>

      {/* Profile Settings (All authenticated users) */}
      <Route element={<ProtectedRoute allowedRoles={['store_manager', 'department_staff', 'auditor', 'admin', 'store', 'manager', 'mis', 'procurement']} />}>
        <Route path="/profile" element={<ProfileSettings />} />
      </Route>

      {/* Department Staff Extended */}
      <Route element={<ProtectedRoute allowedRoles={['department_staff']} />}>
        <Route path="/staff/inventory" element={<DepartmentInventory />} />
      </Route>
    </Routes>
  );
};

import { ReferenceDataProvider } from './context/ReferenceDataContext';

function App() {
  return (
    <AuthProvider>
      <ReferenceDataProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ReferenceDataProvider>
    </AuthProvider>
  );
}

export default App;
