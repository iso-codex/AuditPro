import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { 
  RefreshCw, 
  Building2, 
  Clock, 
  CheckCircle2, 
  Truck, 
  PackageCheck, 
  Search, 
  X, 
  ChevronRight, 
  Layers, 
  AlertCircle, 
  Eye, 
  ShieldCheck, 
  Calendar, 
  Filter, 
  ArrowUpDown,
  ShoppingBag
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import RequisitionPanel from '../../components/RequisitionPanel';

const GlobalRequisitionsManager = () => {
  const [requisitions, setRequisitions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReq, setSelectedReq] = useState(null);
  
  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('Pending_Manager'); // Default to action-required
  const [deptFilter, setDeptFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'items_count'
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('id, name')
          .order('name');
        if (error) throw error;
        setDepartments(data || []);
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
    };
    fetchDepartments();
  }, []);

  // Fetch all requisitions so the manager can see pending, in-store, completed, and overall history
  const fetchRequisitions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('requisitions')
        .select(`
          *,
          departments:department_id (id, name),
          profiles!requested_by(full_name, role),
          requisition_items (
            id, item_id, quantity_requested, quantity_approved, quantity_dispatched, quantity_confirmed, discrepancy_notes,
            items (name, unit, quantity_in_store, low_stock_threshold)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Ensure department name is populated on each requisition object
      const formatted = (data || []).map(r => ({
        ...r,
        department: r.departments?.name || r.department || 'General'
      }));

      setRequisitions(formatted);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error fetching global requisitions for manager:', err);
      setError(err.message || 'Failed to load requisitions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, []);

  // Calculate real-time KPI metrics
  const metrics = useMemo(() => {
    let pendingManager = 0;
    let pendingStore = 0;
    let dispatched = 0;
    let completed = 0;
    let rejected = 0;

    requisitions.forEach(r => {
      if (r.status === 'Pending_Manager') pendingManager++;
      else if (r.status === 'Pending_Store') pendingStore++;
      else if (r.status === 'Dispatched') dispatched++;
      else if (['Received', 'Completed'].includes(r.status)) completed++;
      else if (r.status === 'Rejected') rejected++;
    });

    return {
      pendingManager,
      pendingStore,
      dispatched,
      completed,
      rejected,
      total: requisitions.length
    };
  }, [requisitions]);

  // Filter and sort requisitions
  const filteredRequisitions = useMemo(() => {
    return requisitions
      .filter(r => {
        // Status Filter
        if (statusFilter === 'Pending_Manager' && r.status !== 'Pending_Manager') return false;
        if (statusFilter === 'Pending_Store' && r.status !== 'Pending_Store') return false;
        if (statusFilter === 'Dispatched' && r.status !== 'Dispatched') return false;
        if (statusFilter === 'Completed' && !['Received', 'Completed'].includes(r.status)) return false;
        if (statusFilter === 'Rejected' && r.status !== 'Rejected') return false;
        // 'All' shows all

        // Department Filter
        if (deptFilter !== 'All' && r.department !== deptFilter) return false;

        // Search Query (ID, requester name, department, or item names)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const idMatch = r.id.toLowerCase().includes(q);
          const deptMatch = (r.department || '').toLowerCase().includes(q);
          const requesterMatch = (r.profiles?.full_name || '').toLowerCase().includes(q);
          const itemMatch = (r.requisition_items || []).some(item => 
            (item.items?.name || '').toLowerCase().includes(q)
          );
          if (!idMatch && !deptMatch && !requesterMatch && !itemMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.created_at || b.date_requested) - new Date(a.created_at || a.date_requested);
        } else if (sortBy === 'oldest') {
          return new Date(a.created_at || a.date_requested) - new Date(b.created_at || b.date_requested);
        } else if (sortBy === 'items_count') {
          return (b.requisition_items?.length || 0) - (a.requisition_items?.length || 0);
        }
        return 0;
      });
  }, [requisitions, statusFilter, deptFilter, searchQuery, sortBy]);

  // Helper to format relative date
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) return 'Today';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="w-full h-full flex flex-col gap-6" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)' }}>
                Manager Portal
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500 font-medium">Requisition Approvals</span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', margin: 0 }}>
              Approve Requisitions
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Review department demand, authorize stock allocations, and oversee fulfillment.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:inline-block">
              Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button 
              className="btn btn-outline flex items-center gap-2 text-sm shadow-sm"
              onClick={fetchRequisitions}
              disabled={loading}
              title="Refresh requisitions"
            >
              <RefreshCw size={16} className={loading ? 'spinner border-0' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Interactive KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          
          {/* Card 1: Pending Approval */}
          <div 
            onClick={() => setStatusFilter('Pending_Manager')}
            className={`card cursor-pointer transition-all p-4 flex flex-col justify-between ${
              statusFilter === 'Pending_Manager' 
                ? 'ring-2 ring-amber-500' 
                : 'hover:border-amber-300'
            }`}
            style={{ 
              borderRadius: '12px',
              backgroundColor: statusFilter === 'Pending_Manager' ? 'rgba(245, 158, 11, 0.05)' : 'var(--surface-color)',
              borderColor: statusFilter === 'Pending_Manager' ? '#f59e0b' : 'var(--border-color)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#d97706' }}>
                Action Required
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>
                <Clock size={16} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                {metrics.pendingManager}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {metrics.pendingManager === 1 ? 'Requisition needs approval' : 'Requisitions need approval'}
              </p>
            </div>
          </div>

          {/* Card 2: Approved / In Store */}
          <div 
            onClick={() => setStatusFilter('Pending_Store')}
            className={`card cursor-pointer transition-all p-4 flex flex-col justify-between ${
              statusFilter === 'Pending_Store' 
                ? 'ring-2 ring-blue-500' 
                : 'hover:border-blue-300'
            }`}
            style={{ 
              borderRadius: '12px',
              backgroundColor: statusFilter === 'Pending_Store' ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface-color)',
              borderColor: statusFilter === 'Pending_Store' ? '#3b82f6' : 'var(--border-color)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#2563eb' }}>
                In Store
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#2563eb' }}>
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                {metrics.pendingStore}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Approved; awaiting dispatch
              </p>
            </div>
          </div>

          {/* Card 3: Dispatched */}
          <div 
            onClick={() => setStatusFilter('Dispatched')}
            className={`card cursor-pointer transition-all p-4 flex flex-col justify-between ${
              statusFilter === 'Dispatched' 
                ? 'ring-2 ring-purple-500' 
                : 'hover:border-purple-300'
            }`}
            style={{ 
              borderRadius: '12px',
              backgroundColor: statusFilter === 'Dispatched' ? 'rgba(139, 92, 246, 0.05)' : 'var(--surface-color)',
              borderColor: statusFilter === 'Dispatched' ? '#8b5cf6' : 'var(--border-color)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7c3aed' }}>
                Dispatched
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#7c3aed' }}>
                <Truck size={16} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                {metrics.dispatched}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Dispatched to departments
              </p>
            </div>
          </div>

          {/* Card 4: Completed / Received */}
          <div 
            onClick={() => setStatusFilter('Completed')}
            className={`card cursor-pointer transition-all p-4 flex flex-col justify-between ${
              statusFilter === 'Completed' 
                ? 'ring-2 ring-emerald-500' 
                : 'hover:border-emerald-300'
            }`}
            style={{ 
              borderRadius: '12px',
              backgroundColor: statusFilter === 'Completed' ? 'rgba(16, 185, 129, 0.05)' : 'var(--surface-color)',
              borderColor: statusFilter === 'Completed' ? '#10b981' : 'var(--border-color)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#059669' }}>
                Completed
              </span>
              <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>
                <PackageCheck size={16} />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                {metrics.completed}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Received by department staff
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="card p-4" style={{ borderRadius: '12px' }}>
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Segmented Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)' }}>
            {[
              { id: 'Pending_Manager', label: 'Needs Approval', count: metrics.pendingManager, color: '#f59e0b' },
              { id: 'Pending_Store', label: 'In Store', count: metrics.pendingStore, color: '#3b82f6' },
              { id: 'Dispatched', label: 'Dispatched', count: metrics.dispatched, color: '#8b5cf6' },
              { id: 'Completed', label: 'Received', count: metrics.completed, color: '#10b981' },
              { id: 'All', label: 'All Requests', count: metrics.total, color: 'var(--text-secondary)' }
            ].map(tab => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    active ? 'shadow-sm' : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: active ? 'var(--surface-color)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: active ? '1px solid var(--border-color)' : '1px solid transparent'
                  }}
                >
                  <span>{tab.label}</span>
                  <span 
                    className="px-1.5 py-0.2 rounded-full text-xs" 
                    style={{ 
                      backgroundColor: active ? `${tab.color}20` : 'rgba(0,0,0,0.06)', 
                      color: tab.color,
                      fontWeight: 700
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Department Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="Search req #, user, item..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input text-xs"
                style={{ paddingLeft: '2rem', paddingRight: searchQuery ? '2rem' : '0.75rem', height: '36px' }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5">
              <Building2 size={16} className="text-gray-400" />
              <select 
                value={deptFilter} 
                onChange={e => setDeptFilter(e.target.value)}
                className="form-select text-xs"
                style={{ height: '36px', minWidth: '140px' }}
              >
                <option value="All">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={15} className="text-gray-400" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="form-select text-xs"
                style={{ height: '36px' }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="items_count">Most Items</option>
              </select>
            </div>

          </div>

        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Unable to fetch requisitions</p>
            <p className="opacity-80 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Requisitions Table */}
      <div className="table-container flex-1 shadow-sm border border-gray-100" style={{ borderRadius: '12px', minHeight: '320px' }}>
        <table className="w-full">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>Requisition</th>
              <th>Department</th>
              <th>Requested By</th>
              <th>Items Demanded</th>
              <th>Date</th>
              <th>Status</th>
              <th className="text-right" style={{ width: '150px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-12">
                  <div className="spinner mx-auto mb-2"></div>
                  <span className="text-xs text-gray-500">Loading requisitions...</span>
                </td>
              </tr>
            ) : filteredRequisitions.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-12">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--accent-color)' }}>
                      <CheckCircle2 size={32} />
                    </div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      No requisitions found
                    </p>
                    <p className="text-xs max-w-sm text-gray-500">
                      {statusFilter === 'Pending_Manager' 
                        ? 'You have approved all incoming requisitions! Select "In Store" or "All Requests" to inspect fulfilled demand.'
                        : 'No records match the current filters or search terms.'}
                    </p>
                    {(searchQuery || deptFilter !== 'All' || statusFilter !== 'Pending_Manager') && (
                      <button 
                        className="btn btn-outline btn-sm mt-2 text-xs"
                        onClick={() => {
                          setSearchQuery('');
                          setDeptFilter('All');
                          setStatusFilter('Pending_Manager');
                        }}
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredRequisitions.map(req => {
                const isPendingManager = req.status === 'Pending_Manager';
                const itemsCount = req.requisition_items?.length || 0;
                const itemsPreview = (req.requisition_items || [])
                  .slice(0, 2)
                  .map(i => i.items?.name)
                  .filter(Boolean)
                  .join(', ');
                const hasMoreItems = itemsCount > 2;

                return (
                  <tr 
                    key={req.id} 
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedReq(req)}
                  >
                    {/* Requisition ID & Urgency */}
                    <td>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold" style={{ color: 'var(--accent-color)' }}>
                          #{req.id.split('-')[0]}
                        </span>
                        {isPendingManager && (
                          <span className="text-xs font-medium" style={{ color: '#d97706', fontSize: '0.7rem' }}>
                            Needs review
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Department */}
                    <td>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--text-primary)' }}>
                        <Building2 size={13} className="text-blue-500" />
                        <span>{req.department}</span>
                      </div>
                    </td>

                    {/* Requested By */}
                    <td>
                      <div className="flex items-center gap-2">
                        <div 
                          className="flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
                          style={{ width: '28px', height: '28px', backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
                        >
                          {(req.profiles?.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-xs text-gray-900" style={{ color: 'var(--text-primary)' }}>
                            {req.profiles?.full_name || 'Anonymous Staff'}
                          </span>
                          <span className="text-xs text-gray-400" style={{ fontSize: '0.7rem' }}>
                            {req.profiles?.role ? req.profiles.role.replace('_', ' ') : 'Staff'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Items Demanded Preview */}
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="badge badge-primary text-xs" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                            {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                        {itemsPreview && (
                          <span className="text-xs text-gray-500 truncate max-w-xs" title={itemsPreview}>
                            {itemsPreview}{hasMoreItems ? ` +${itemsCount - 2} more` : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date Requested */}
                    <td>
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Calendar size={13} className="text-gray-400" />
                        <span>{formatDisplayDate(req.date_requested || req.created_at)}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <StatusBadge status={req.status} />
                    </td>

                    {/* Action Button */}
                    <td className="text-right">
                      {isPendingManager ? (
                        <button 
                          className="btn btn-primary text-xs flex items-center gap-1.5 ml-auto shadow-sm"
                          style={{ padding: '0.4rem 0.75rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReq(req);
                          }}
                        >
                          <ShieldCheck size={14} />
                          <span>Review & Decide</span>
                        </button>
                      ) : (
                        <button 
                          className="btn btn-outline text-xs flex items-center gap-1 ml-auto"
                          style={{ padding: '0.4rem 0.65rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReq(req);
                          }}
                        >
                          <Eye size={13} />
                          <span>Details</span>
                        </button>
                      )}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over Requisition Review Panel */}
      {selectedReq && (
        <RequisitionPanel 
          requisition={selectedReq} 
          onClose={() => setSelectedReq(null)}
          onUpdate={fetchRequisitions}
        />
      )}

    </div>
  );
};

export default GlobalRequisitionsManager;
