import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import StatusBadge from '../../components/StatusBadge';

const DispatchHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('requisitions')
          .select(`
            *,
            profiles:requested_by (full_name),
            requisition_items (
              quantity_dispatched,
              items (name)
            )
          `)
          .in('status', ['Dispatched', 'Received', 'Partially Received'])
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        setHistory(data || []);
      } catch (error) {
        console.error('Error fetching dispatch history:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, []);

  return (
    <div className="dispatch-history-page">
      <div className="mb-6">
        <h2>Dispatch History</h2>
        <p>Log of all outgoing goods to departments.</p>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="flex justify-center p-10"><div className="spinner"></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date Dispatched</th>
                <th>Req ID</th>
                <th>Department</th>
                <th>Items Dispatched</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map(req => {
                const itemSummary = req.requisition_items
                  ?.filter(i => i.quantity_dispatched > 0)
                  ?.map(i => `${i.quantity_dispatched}x ${i.items?.name}`)
                  .join(', ');

                return (
                  <tr key={req.id}>
                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td className="font-mono text-xs">{req.id.split('-')[0]}</td>
                    <td>{req.department}</td>
                    <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {itemSummary || 'No items dispatched'}
                    </td>
                    <td><StatusBadge status={req.status} /></td>
                  </tr>
                );
              })}
              {history.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                    No dispatch history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DispatchHistory;
