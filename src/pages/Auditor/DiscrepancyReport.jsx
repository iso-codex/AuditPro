import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AlertOctagon } from 'lucide-react';

const DiscrepancyReport = () => {
  const [discrepancies, setDiscrepancies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiscrepancies = async () => {
      try {
        const { data, error } = await supabase
          .from('requisition_items')
          .select(`
            id, quantity_dispatched, quantity_confirmed, discrepancy_notes,
            requisitions (id, department, date_requested),
            items (name)
          `)
          .not('quantity_confirmed', 'is', null);

        if (error) throw error;

        // Filter only those with differences
        const diffs = data?.filter(i => parseFloat(i.quantity_dispatched) !== parseFloat(i.quantity_confirmed)) || [];
        setDiscrepancies(diffs);
      } catch (error) {
        console.error('Error fetching discrepancies:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDiscrepancies();
  }, []);

  return (
    <div className="discrepancy-report-page">
      <div className="mb-6">
        <h2>Discrepancy Report</h2>
        <p>Line items where confirmed receipt quantities differ from dispatched quantities.</p>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="flex justify-center p-10"><div className="spinner"></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Req ID</th>
                <th>Department</th>
                <th>Item</th>
                <th>Dispatched</th>
                <th>Confirmed</th>
                <th>Diff</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {discrepancies.map(item => {
                const diff = parseFloat(item.quantity_dispatched) - parseFloat(item.quantity_confirmed);
                const isHighRisk = Math.abs(diff) > 5;

                return (
                  <tr key={item.id} className={isHighRisk ? 'bg-red-50' : ''} style={{ backgroundColor: isHighRisk ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                    <td className="font-mono text-xs">{item.requisitions?.id.split('-')[0]}</td>
                    <td>{item.requisitions?.department}</td>
                    <td className="font-medium">{item.items?.name}</td>
                    <td>{item.quantity_dispatched}</td>
                    <td>{item.quantity_confirmed}</td>
                    <td>
                      <span className={`font-bold flex items-center gap-1 ${isHighRisk ? 'text-red-600' : 'text-orange-500'}`} style={{ color: isHighRisk ? 'var(--danger-color)' : '#f97316' }}>
                        {isHighRisk && <AlertOctagon size={14} />}
                        {diff > 0 ? `-${diff}` : `+${Math.abs(diff)}`}
                      </span>
                    </td>
                    <td className="text-sm text-gray-600 italic">"{item.discrepancy_notes}"</td>
                  </tr>
                );
              })}
              {discrepancies.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                    No discrepancies found. All good!
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

export default DiscrepancyReport;
