import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import ConfirmReceiptPanel from '../../components/ConfirmReceiptPanel';

const MyRequisitions = () => {
  const { profile } = useAuth();
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);

  const fetchRequisitions = async () => {
    if (!profile?.department) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('requisitions')
        .select(`
          *,
          profiles:requested_by (full_name),
          requisition_items (
            id, quantity_requested, quantity_approved, quantity_dispatched, quantity_confirmed, discrepancy_notes,
            items (name, unit)
          )
        `)
        .eq('department', profile.department)
        .order('created_at', { ascending: false });
        
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
  }, [profile]);

  return (
    <div className="my-requisitions-page">
      <div className="mb-6">
        <h2>My Requisitions</h2>
        <p>Track your department's supply requests.</p>
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
                <th>Requested By</th>
                <th>Items</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map(req => (
                <tr key={req.id}>
                  <td className="font-mono text-xs">{req.id.split('-')[0]}</td>
                  <td>{req.date_requested}</td>
                  <td>{req.profiles?.full_name || 'Unknown'}</td>
                  <td>{req.requisition_items?.length}</td>
                  <td><StatusBadge status={req.status} /></td>
                  <td>
                    {req.status === 'Dispatched' ? (
                      <button 
                        className="btn" 
                        style={{ backgroundColor: 'var(--success-color)', color: 'white', padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => setSelectedReq(req)}
                      >
                        Confirm Receipt
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </td>
                </tr>
              ))}
              {requisitions.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                    No requisitions found for your department.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedReq && (
        <ConfirmReceiptPanel 
          requisition={selectedReq} 
          onClose={() => setSelectedReq(null)} 
          onUpdate={fetchRequisitions}
        />
      )}
    </div>
  );
};

export default MyRequisitions;
