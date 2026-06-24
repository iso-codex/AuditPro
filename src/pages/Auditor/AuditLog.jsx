import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Filter } from 'lucide-react';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action_type: '',
    department: ''
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_log')
        .select(`
          *,
          profiles (full_name)
        `)
        .order('created_at', { ascending: false });
        
      if (filters.action_type) query = query.eq('action_type', filters.action_type);
      if (filters.department) query = query.eq('department', filters.department);

      const { data, error } = await query;
      if (error) throw error;
      
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="audit-log-page">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2>Full Audit Log</h2>
          <p>Complete traceability of all system actions.</p>
        </div>
        
        <div className="flex gap-4 items-center bg-white p-2 rounded-lg border" style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
          <Filter size={18} className="text-gray-400" />
          <select className="form-select border-0 bg-transparent py-1" name="action_type" value={filters.action_type} onChange={handleFilterChange}>
            <option value="">All Actions</option>
            <option value="Received">Received</option>
            <option value="Requisition Raised">Requisition Raised</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Discrepancy">Discrepancy</option>
          </select>
          
          <div className="w-px h-6 bg-gray-200" style={{ backgroundColor: 'var(--border-color)', width: '1px', height: '24px' }}></div>
          
          <select className="form-select border-0 bg-transparent py-1" name="department" value={filters.department} onChange={handleFilterChange}>
            <option value="">All Departments</option>
            <option value="Kitchen">Kitchen</option>
            <option value="Bar">Bar</option>
            <option value="Byte">Byte</option>
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
                <th>Timestamp</th>
                <th>Action Type</th>
                <th>Actor</th>
                <th>Department</th>
                <th>Items / Qty</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span className="font-medium px-2 py-1 bg-gray-100 rounded text-xs" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
                      {log.action_type}
                    </span>
                  </td>
                  <td>{log.profiles?.full_name}</td>
                  <td>{log.department || '-'}</td>
                  <td>
                    {log.item_names ? (
                      <span className="text-sm">{log.item_names} <span className="text-gray-500">({log.quantity})</span></span>
                    ) : '-'}
                  </td>
                  <td className="text-sm text-gray-600 max-w-xs truncate" style={{ color: 'var(--text-secondary)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.notes}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    No logs match the selected filters.
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

export default AuditLog;
