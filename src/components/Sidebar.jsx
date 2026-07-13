import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, 
  Package, 
  Inbox, 
  Layers, 
  History, 
  FilePlus, 
  List, 
  LayoutDashboard, 
  ShieldAlert, 
  FileText,
  Users,
  Database,
  Globe,
  Truck,
  ShoppingCart,
  Settings,
  DollarSign
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ mobileOpen, setMobileOpen }) => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeSidebar = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  // Define links based on role
  const getLinks = () => {
    if (!profile) return [];
    
    switch (profile.role) {
      case 'store_manager':
        return [
          { to: '/manager/purchase-orders', icon: <ShoppingCart size={20} />, label: 'Purchase Orders' },
          { to: '/manager/receive', icon: <Package size={20} />, label: 'Receive Goods' },
          { to: '/manager/inbox', icon: <Inbox size={20} />, label: 'Requisition Inbox' },
          { to: '/manager/stock', icon: <Layers size={20} />, label: 'Stock Levels' },
          { to: '/manager/dispatch', icon: <History size={20} />, label: 'Dispatch History' },
        ];
      case 'department_staff':
        return [
          { to: '/staff/raise', icon: <FilePlus size={20} />, label: 'Raise Requisition' },
          { to: '/staff/my-requisitions', icon: <List size={20} />, label: 'My Requisitions' },
          { to: '/staff/inventory', icon: <Layers size={20} />, label: 'Dept Inventory' },
        ];
      case 'auditor':
        return [
          { to: '/auditor/overview', icon: <LayoutDashboard size={20} />, label: 'Overview' },
          { to: '/auditor/logs', icon: <FileText size={20} />, label: 'Audit Log' },
          { to: '/auditor/discrepancies', icon: <ShieldAlert size={20} />, label: 'Discrepancies' },
        ];
      case 'manager':
        return [
          { to: '/admin/users', icon: <Users size={20} />, label: 'User Management' },
          { to: '/manager-role/requisitions', icon: <Globe size={20} />, label: 'Approve Requisitions' },
        ];
      case 'store':
        return [
          { to: '/store-role/inbox', icon: <Inbox size={20} />, label: 'Requisition Inbox' },
        ];
      case 'mis':
        return [
          { to: '/mis/sales', icon: <DollarSign size={20} />, label: 'Sales Entry' },
        ];
      case 'admin':
        return [
          { to: '/admin/users', icon: <Users size={20} />, label: 'User Management' },
          { to: '/admin/catalog', icon: <Database size={20} />, label: 'Catalog Management' },
          { to: '/admin/requisitions', icon: <Globe size={20} />, label: 'All Requisitions' },
          { to: '/admin/suppliers', icon: <Truck size={20} />, label: 'Supplier Management' },
          // Store Manager capabilities
          { to: '/manager/purchase-orders', icon: <ShoppingCart size={20} />, label: 'Purchase Orders' },
          { to: '/manager/receive', icon: <Package size={20} />, label: 'Receive Goods' },
          { to: '/manager/inbox', icon: <Inbox size={20} />, label: 'Requisition Inbox' },
          { to: '/manager/stock', icon: <Layers size={20} />, label: 'Stock Levels' },
          { to: '/manager/dispatch', icon: <History size={20} />, label: 'Dispatch History' },
        ];
      default:
        return [];
    }
  };

  const links = [...getLinks(), { to: '/profile', icon: <Settings size={20} />, label: 'Profile Settings' }];

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <ShieldAlert className="logo-icon" size={28} />
          <h2>AuditPro</h2>
        </div>
        <div className="user-info">
          <p className="user-name">{profile?.full_name}</p>
          <p className="user-role">{profile?.role?.replace('_', ' ')} {profile?.department ? `• ${profile.department}` : ''}</p>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink 
            key={link.to} 
            to={link.to}
            onClick={closeSidebar}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="logout-btn">
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
