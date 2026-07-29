import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Filter, History } from 'lucide-react';

const GoodsHistory = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_log')
        .select(`
          *,
          profiles (full_name)
        `)
        .in('action_type', ['Received', 'Dispatched'])
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
          <p>Records of all received stock and dispatched goods.</p>
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
                <th>Department (If Dispatch)</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span className={`font-medium px-2 py-1 rounded text-xs ${log.action_type === 'Received' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {log.action_type}
                    </span>
                  </td>
                  <td>{log.profiles?.full_name}</td>
                  <td>{log.department || '-'}</td>
                  <td className="text-sm text-gray-600" style={{ color: 'var(--text-secondary)' }}>
                    {log.notes}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-500">
                    No records found.
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

export default GoodsHistory;
