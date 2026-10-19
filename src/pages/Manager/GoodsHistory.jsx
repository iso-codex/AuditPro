import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Filter, History, Eye, Receipt } from 'lucide-react';
import ReceiptViewerModal from '../../components/ReceiptViewerModal';

const GoodsHistory = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_log')
        .select(`
          *,
          profiles (full_name),
          departments (name)
        `)
        .in('action_type', ['Received', 'Dispatched', 'Damage Written Off'])
        .order('created_at', { ascending: false });
        
      if (filter) query = query.eq('action_type', filter);

      const { data, error } = await query;
      if (error) throw error;
      
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching goods history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [filter]);

  return (
    <div className="goods-history-page">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2>Goods History</h2>
          <p>Records of all received stock, dispatched goods, and adjustments.</p>
        </div>
        
        <div className="flex gap-4 items-center bg-white p-2 rounded-lg border" style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
          <Filter size={18} className="text-gray-400" />
          <select 
            className="form-select border-0 bg-transparent py-1" 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All Records</option>
            <option value="Received">Received Goods</option>
            <option value="Dispatched">Dispatched Goods</option>
            <option value="Damage Written Off">Damages</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="flex justify-center p-10"><div className="spinner"></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Record Type</th>
                <th>Performed By</th>
                <th>Department</th>
                <th>Details</th>
                <th>Receipt / Evidence</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const receiptUrl = log.new_data?.receipt_url;
                const badgeColor = 
                  log.action_type === 'Received' 
                    ? 'bg-green-100 text-green-800' 
                    : log.action_type === 'Dispatched' 
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-red-100 text-red-800';

                return (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className={`font-medium px-2 py-1 rounded text-xs ${badgeColor}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td>{log.profiles?.full_name || 'System'}</td>
                    <td>{log.departments?.name || (log.action_type === 'Received' || log.new_data?.location_type === 'store' ? 'Central Store' : '-')}</td>
                    <td className="text-sm text-gray-600" style={{ color: 'var(--text-secondary)' }}>
                      {log.notes}
                    </td>
                    <td>
                      {receiptUrl ? (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          onClick={() => setSelectedReceipt(receiptUrl)}
                          title="View Receipt Image"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <ReceiptViewerModal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        imageUrl={selectedReceipt}
        title="Stock Movement Receipt"
      />
    </div>
  );
};

export default GoodsHistory;
