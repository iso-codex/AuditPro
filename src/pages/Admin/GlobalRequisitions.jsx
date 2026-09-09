import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RefreshCw, AlertCircle } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import RequisitionPanel from '../../components/RequisitionPanel';

const GlobalRequisitions = () => {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReq, setSelectedReq] = useState(null);
  const [filter, setFilter] = useState('All');

  const fetchRequisitions = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('requisitions')
        .select(`
          *,
          profiles (full_name),
          requisition_items (
            id, item_id, quantity_requested, quantity_approved, quantity_dispatched, quantity_confirmed, discrepancy_notes,
            items (name, unit, quantity_in_store, low_stock_threshold)
          )
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'All') {
        query = query.eq('status', filter);
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
  }, [filter]);

  return (
    <div className="admin-page relative h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>Global Requisitions</h2>
          <p>View and override all requisitions across all departments.</p>
        </div>
        <div className="flex gap-4">
          <select 
            className="form-select"
            value={filter}
            onChange={e => setFilter(e.target.value)}
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
          <button className="btn btn-outline" onClick={fetchRequisitions} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spinner border-0' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

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
                <td colSpan="6" className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                  No requisitions found{filter !== 'All' ? ` with status "${filter}"` : ''}.
                </td>
              </tr>
            ) : requisitions.map(req => (
              <tr 
                key={req.id} 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setSelectedReq(req)}
              >
                <td className="font-mono text-sm">{req.id.split('-')[0]}</td>
                <td className="font-medium">{req.department}</td>
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
