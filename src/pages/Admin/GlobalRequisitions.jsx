import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RefreshCw, AlertCircle, Building2, Layers, CheckCircle2, Clock, Truck, ChevronRight } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import RequisitionPanel from '../../components/RequisitionPanel';

const GlobalRequisitions = () => {
  const [requisitions, setRequisitions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReq, setSelectedReq] = useState(null);
  const [filter, setFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [showDepartmentBreakdown, setShowDepartmentBreakdown] = useState(true);

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

  const fetchRequisitions = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('requisitions')
        .select(`
          *,
          profiles!requested_by(full_name),
          requisition_items (
            id, item_id, quantity_requested, quantity_approved, quantity_dispatched, quantity_confirmed, discrepancy_notes,
            items (name, unit, quantity_in_store, low_stock_threshold)
          )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'All') {
        query = query.eq('status', filter);
      }

      if (deptFilter !== 'All') {
        query = query.eq('department', deptFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequisitions(data || []);
    } catch (err) {
      console.error('Error fetching global requisitions:', err);
      setError(err.message || 'Failed to load requisitions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, [filter, deptFilter]);

  // Compute metrics per department across all fetched requisitions (or overall)
  const departmentMetrics = useMemo(() => {
    const deptMap = {};
    departments.forEach(d => {
      deptMap[d.name] = {
        name: d.name,
        total: 0,
        pendingManager: 0,
        pendingStore: 0,
        dispatched: 0,
        completed: 0,
      };
    });

    requisitions.forEach(req => {
      const dName = req.department || 'Other';
      if (!deptMap[dName]) {
        deptMap[dName] = {
          name: dName,
          total: 0,
          pendingManager: 0,
          pendingStore: 0,
          dispatched: 0,
          completed: 0,
        };
      }
      deptMap[dName].total += 1;
      if (req.status === 'Pending_Manager') deptMap[dName].pendingManager += 1;
      else if (req.status === 'Pending_Store') deptMap[dName].pendingStore += 1;
      else if (req.status === 'Dispatched') deptMap[dName].dispatched += 1;
      else if (['Received', 'Completed'].includes(req.status)) deptMap[dName].completed += 1;
    });

    return Object.values(deptMap);
  }, [departments, requisitions]);

  return (
    <div className="admin-page relative h-full flex flex-col">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h2>Global Requisitions</h2>
          <p className="text-gray-500">View and oversee requisitions across all departments with real-time metrics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-gray-400" />
            <select
              className="form-select"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              <option value="All">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select 
            className="form-select"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            <option value="All">All Statuses</option>
            <option value="Pending_Manager">Pending (Manager)</option>
            <option value="Pending_Store">Pending (Store)</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Received">Received</option>
            <option value="Partially Received">Partially Received</option>
            <option value="Rejected">Rejected</option>
            <option value="Pending">Legacy: Pending</option>
            <option value="Approved">Legacy: Approved</option>
          </select>

          <button 
            className="btn btn-outline" 
            onClick={() => setShowDepartmentBreakdown(!showDepartmentBreakdown)}
            title="Toggle by-department metrics"
          >
            <Layers size={18} />
            <span>{showDepartmentBreakdown ? 'Hide Metrics' : 'Dept Metrics'}</span>
          </button>

          <button className="btn btn-outline" onClick={fetchRequisitions} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spinner border-0' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* By-Department Metrics Cards */}
      {showDepartmentBreakdown && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              <span>Department Activity Overview</span>
              {deptFilter !== 'All' && (
                <span className="text-xs text-blue-600 cursor-pointer underline ml-2" onClick={() => setDeptFilter('All')}>
                  (Show all departments)
                </span>
              )}
            </h3>
            <span className="text-xs text-gray-400">Click a card to filter by department</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {departmentMetrics.map(dept => {
              const isSelected = deptFilter === dept.name;
              return (
                <div
                  key={dept.name}
                  onClick={() => setDeptFilter(isSelected ? 'All' : dept.name)}
                  className={`card p-3 cursor-pointer transition-all border ${
                    isSelected ? 'ring-2 ring-blue-500 bg-blue-50/40 border-blue-300' : 'hover:border-gray-300 bg-white'
                  }`}
                  style={{ borderRadius: '8px' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-gray-800 truncate" title={dept.name}>
                      {dept.name}
                    </span>
                    <span className="badge badge-primary text-xs font-bold">
                      {dept.total} req{dept.total === 1 ? '' : 's'}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span className="text-amber-700 flex items-center gap-1">
                        <Clock size={11} /> Pending Mgr:
                      </span>
                      <span className="font-semibold">{dept.pendingManager}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700 flex items-center gap-1">
                        <Clock size={11} /> Pending Store:
                      </span>
                      <span className="font-semibold">{dept.pendingStore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-indigo-700 flex items-center gap-1">
                        <Truck size={11} /> Dispatched:
                      </span>
                      <span className="font-semibold">{dept.dispatched}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Received:
                      </span>
                      <span className="font-semibold">{dept.completed}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 rounded-xl flex items-start gap-3" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger-color)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Failed to load requisitions</p>
            <p className="text-sm mt-1 opacity-80">{error}</p>
          </div>
        </div>
      )}

      <div className="table-container flex-1">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Department</th>
              <th>Requested By</th>
              <th>Date</th>
              <th>Items</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-8">
                  <div className="spinner mx-auto"></div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="6" className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                  Could not load data. See error above.
                </td>
              </tr>
            ) : requisitions.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-500">
                  No requisitions found{deptFilter !== 'All' ? ` for "${deptFilter}"` : ''}{filter !== 'All' ? ` with status "${filter}"` : ''}.
                </td>
              </tr>
            ) : requisitions.map(req => (
              <tr 
                key={req.id} 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setSelectedReq(req)}
              >
                <td className="font-mono text-sm">{req.id.split('-')[0]}</td>
                <td className="font-medium">
                  <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
                    {req.department}
                  </span>
                </td>
                <td>{req.profiles?.full_name || 'Unknown'}</td>
                <td>{new Date(req.created_at).toLocaleDateString()}</td>
                <td>{req.requisition_items?.length || 0} items</td>
                <td><StatusBadge status={req.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

export default GlobalRequisitions;
