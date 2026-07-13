import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RefreshCw } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import RequisitionPanel from '../../components/RequisitionPanel';

const GlobalRequisitionsManager = () => {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);

  const fetchRequisitions = async () => {
    setLoading(true);
    try {
      // Manager only sees Pending_Manager requisitions
      const { data, error } = await supabase
        .from('requisitions')
        .select(`
          *,
          profiles (full_name),
          requisition_items (
            id, item_id, quantity_requested, quantity_approved, quantity_dispatched, quantity_confirmed, discrepancy_notes,
            items (name, unit, quantity_in_store, low_stock_threshold)
          )
        `)
        .eq('status', 'Pending_Manager')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequisitions(data || []);
    } catch (error) {
      console.error('Error fetching global requisitions for manager:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, []);

  return (
    <div className="admin-page relative h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>Approve Requisitions (Manager)</h2>
          <p>Review and approve requisitions before they go to the Store.</p>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-outline" onClick={fetchRequisitions} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spinner border-0' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

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
            {loading && requisitions.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8">
                  <div className="spinner mx-auto"></div>
                </td>
              </tr>
            ) : requisitions.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-500">
                  No pending requisitions require your approval.
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

export default GlobalRequisitionsManager;
