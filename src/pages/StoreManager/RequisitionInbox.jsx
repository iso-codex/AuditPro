import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import StatusBadge from '../../components/StatusBadge';
import RequisitionPanel from '../../components/RequisitionPanel';

const RequisitionInbox = () => {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);

  const fetchRequisitions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('requisitions')
        .select(`
          *,
          profiles:requested_by (full_name),
          requisition_items (
            id, item_id, quantity_requested, quantity_approved, quantity_dispatched, quantity_confirmed, unit_cost,
            items (name, unit, quantity_in_store, unit_cost)
          )
        `)
        .order('date_requested', { ascending: false });
        
      if (error) throw error;
      setRequisitions(data || []);
    } catch (error) {
      console.error('Error fetching requisitions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, []);

  return (
    <div className="requisition-inbox-page">
      <div className="mb-6">
        <h2>Requisition Inbox</h2>
        <p>Manage requests from internal departments.</p>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="flex justify-center p-10"><div className="spinner"></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Department</th>
                <th>Requested By</th>
                <th>Items Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map(req => (
                <tr key={req.id} onClick={() => setSelectedReq(req)} style={{ cursor: 'pointer' }}>
                  <td className="font-mono text-xs">{req.id.split('-')[0]}</td>
                  <td>{req.date_requested}</td>
                  <td>{req.department}</td>
                  <td>{req.profiles?.full_name}</td>
                  <td>{req.requisition_items?.length}</td>
                  <td><StatusBadge status={req.status} /></td>
                </tr>
              ))}
              {requisitions.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                    No requisitions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
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

export default RequisitionInbox;
