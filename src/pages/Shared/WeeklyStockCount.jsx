import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { List, CheckCircle, AlertTriangle, Save, Play, Search, XCircle } from 'lucide-react';

const WeeklyStockCount = () => {
  const { profile } = useAuth();
  const isManager = ['manager', 'admin'].includes(profile?.role);
  const isAuditor = profile?.role === 'auditor';
  const isStore = profile?.role === 'store';

  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  
  const [activeCycle, setActiveCycle] = useState(null);
  const [stockLines, setStockLines] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDeptId) {
      fetchActiveCycle();
    } else {
      setActiveCycle(null);
      setStockLines([]);
    }
  }, [selectedDeptId]);

  const fetchDepartments = async () => {
    setLoading(true);
    const { data } = await supabase.from('departments').select('*').order('name');
    setDepartments(data || []);
    
    // Default to user's department or first one
    if (profile?.department_id) {
      setSelectedDeptId(profile.department_id);
    } else if (data && data.length > 0) {
      setSelectedDeptId(data[0].id);
    }
    setLoading(false);
  };

  const fetchActiveCycle = async () => {
    setLoading(true);
    try {
      // Look for open or submitted cycle
      let { data: cycleData } = await supabase
        .from('stock_count_cycles')
        .select(`
          *,
          submitted_user:submitted_by(full_name),
          approved_user:approved_by(full_name)
        `)
        .eq('department_id', selectedDeptId)
        .in('status', ['open', 'submitted'])
        .single();
        
      // If no active cycle and user is store, they can start one. But for now, we just show empty state
      setActiveCycle(cycleData || null);

      if (cycleData) {
        // Fetch lines with item details
        const { data: linesData } = await supabase
          .from('stock_count_lines')
          .select(`
            *,
            item:items(id, name, unit, unit_cost)
          `)
          .eq('cycle_id', cycleData.id)
          .order('item(name)');
          
        setStockLines(linesData || []);
      } else {
        setStockLines([]);
      }
    } catch (error) {
      if (error.code !== 'PGRST116') { // PGRST116 is not found
        console.error('Error fetching cycle:', error);
      }
      setActiveCycle(null);
      setStockLines([]);
    } finally {
      setLoading(false);
    }
  };

  const startNewCycle = async () => {
    setSaving(true);
    try {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      // Create cycle
      const { data: newCycle, error: cycleError } = await supabase
        .from('stock_count_cycles')
        .insert({
          department_id: selectedDeptId,
          start_date: today.toISOString().split('T')[0],
          end_date: nextWeek.toISOString().split('T')[0],
          status: 'open'
        })
        .select()
        .single();

      if (cycleError) throw cycleError;

      // Generate lines from vw_department_stock_movement
      const { data: movementData, error: moveError } = await supabase
        .from('vw_department_stock_movement')
        .select('*')
        .eq('department_id', selectedDeptId);

      if (moveError) throw moveError;

      if (movementData && movementData.length > 0) {
        const linesToInsert = movementData.map(m => ({
          cycle_id: newCycle.id,
          item_id: m.item_id,
          opening_qty: m.opening_qty,
          // For simplicity in this demo, issues and receipts are assumed zero unless calculated
          // In a real scenario, you'd calculate receipts and issues within the date range
          receipts_qty: 0,
          issues_qty: 0,
          expected_closing_qty: m.current_qty // current_qty is the live expectation
        }));

        const { error: lineError } = await supabase
          .from('stock_count_lines')
          .insert(linesToInsert);

        if (lineError) throw lineError;
      }

      await fetchActiveCycle();
    } catch (error) {
      console.error('Error starting cycle:', error);
      alert('Failed to start cycle: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleQtyChange = (id, value) => {
    if (!isStore || activeCycle?.status !== 'open') return;
    
    setStockLines(stockLines.map(line => {
      if (line.id === id) {
        const counted = value === '' ? null : parseFloat(value);
        const expected = parseFloat(line.expected_closing_qty);
        const varianceQty = counted !== null ? counted - expected : null;
        const varianceValue = varianceQty !== null ? varianceQty * parseFloat(line.item.unit_cost || 0) : null;
        
        return { 
          ...line, 
          counted_qty: counted,
          variance_qty: varianceQty,
          variance_value: varianceValue
        };
      }
      return line;
    }));
  };

  const handleReasonChange = (id, reason) => {
    if (!isStore || activeCycle?.status !== 'open') return;
    setStockLines(stockLines.map(line => line.id === id ? { ...line, reason_code: reason } : line));
  };

  const saveCounts = async () => {
    setSaving(true);
    try {
      for (const line of stockLines) {
        await supabase
          .from('stock_count_lines')
          .update({
            counted_qty: line.counted_qty,
            variance_qty: line.variance_qty,
            variance_value: line.variance_value,
            reason_code: line.reason_code,
            comment: line.comment
          })
          .eq('id', line.id);
      }
      alert('Counts saved successfully.');
    } catch (error) {
      alert('Error saving counts: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const submitCycle = async () => {
    if (!window.confirm('Are you sure you want to submit this count? You will not be able to edit it.')) return;
    setSaving(true);
    try {
      await saveCounts(); // ensure latest changes are saved
      await supabase
        .from('stock_count_cycles')
        .update({ status: 'submitted', submitted_by: profile.id, submitted_at: new Date().toISOString() })
        .eq('id', activeCycle.id);
      
      await fetchActiveCycle();
    } catch (error) {
      alert('Error submitting cycle: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const approveCycle = async () => {
    if (!window.confirm('Approve this stock count? This action cannot be undone.')) return;
    
    // Check for variances that need reasons (example tolerance: variance_value > 50 or < -50)
    const invalidLines = stockLines.filter(l => l.variance_value && Math.abs(l.variance_value) > 50 && !l.reason_code);
    if (invalidLines.length > 0) {
      alert('Cannot approve: Missing reason codes for significant variances.');
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from('stock_count_cycles')
        .update({ status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString() })
        .eq('id', activeCycle.id);
        
      // In a full implementation, approval would also post reversing entries to actual department_inventory if there are variances.
      
      setActiveCycle(null);
      setStockLines([]);
    } catch (error) {
      alert('Error approving cycle: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredLines = stockLines.filter(l => 
    l.item?.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading && !departments.length) return <div className="page-content flex justify-center"><div className="spinner"></div></div>;

  return (
    <div className="page-content">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Weekly Stock Count</h2>
          <p className="text-gray-500">Record and approve physical inventory counts.</p>
        </div>
        <div className="flex gap-4">
          <select 
            className="form-select"
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            disabled={!!profile?.department_id}
          >
            <option value="" disabled>Select Department</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* Header Actions */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50" style={{ backgroundColor: 'var(--bg-color)' }}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search items..." 
                className="form-input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            {activeCycle && (
              <div className="flex gap-2 text-sm">
                <span className={`px-2 py-1 rounded font-medium ${
                  activeCycle.status === 'open' ? 'bg-blue-100 text-blue-800' :
                  activeCycle.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {activeCycle.status.toUpperCase()}
                </span>
                {activeCycle.submitted_user && (
                  <span className="text-gray-500">Submitted by: {activeCycle.submitted_user.full_name}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!activeCycle && isStore && (
              <button className="btn btn-primary" onClick={startNewCycle} disabled={saving}>
                <Play size={18} className="mr-2" /> Start New Cycle
              </button>
            )}
            
            {activeCycle?.status === 'open' && isStore && (
              <>
                <button className="btn btn-outline" onClick={saveCounts} disabled={saving}>
                  <Save size={18} className="mr-2" /> Save Progress
                </button>
                <button className="btn btn-primary" onClick={submitCycle} disabled={saving}>
                  <CheckCircle size={18} className="mr-2" /> Submit Count
                </button>
              </>
            )}

            {activeCycle?.status === 'submitted' && isManager && (
              <button className="btn btn-primary" onClick={approveCycle} disabled={saving}>
                <CheckCircle size={18} className="mr-2" /> Approve Count
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {!activeCycle ? (
          <div className="p-12 text-center text-gray-500">
            <List size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-600">No active stock count cycle.</p>
            {isStore && <p className="mt-2">Start a new cycle to begin counting.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Opening Qty</th>
                  <th className="text-right">Expected Qty</th>
                  <th className="text-right">Counted Qty</th>
                  <th className="text-right">Variance Qty</th>
                  <th className="text-right">Variance Value (GHS)</th>
                  <th>Reason Code</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-4">No items found.</td></tr>
                ) : (
                  filteredLines.map(line => {
                    const hasVariance = line.variance_qty && Math.abs(line.variance_qty) > 0;
                    const requiresReason = line.variance_value && Math.abs(line.variance_value) > 50;

                    return (
                      <tr key={line.id} className={requiresReason && !line.reason_code ? 'bg-red-50' : ''}>
                        <td>
                          <div className="font-medium text-gray-900">{line.item?.name}</div>
                          <div className="text-xs text-gray-500">{line.item?.unit} | Cost: {line.item?.unit_cost}</div>
                        </td>
                        <td className="text-right text-gray-500">{line.opening_qty}</td>
                        <td className="text-right font-medium">{line.expected_closing_qty}</td>
                        <td className="text-right">
                          <input 
                            type="number" 
                            className={`form-input w-24 text-right inline-block ${hasVariance ? 'border-orange-300' : ''}`}
                            value={line.counted_qty === null ? '' : line.counted_qty}
                            onChange={(e) => handleQtyChange(line.id, e.target.value)}
                            disabled={!isStore || activeCycle.status !== 'open'}
                            step="0.01"
                          />
                        </td>
                        <td className={`text-right font-medium ${
                          line.variance_qty > 0 ? 'text-green-600' : 
                          line.variance_qty < 0 ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {line.variance_qty || 0}
                        </td>
                        <td className="text-right">
                          {line.variance_value?.toFixed(2) || '0.00'}
                        </td>
                        <td>
                          {hasVariance ? (
                            <select
                              className={`form-select text-sm ${requiresReason && !line.reason_code ? 'border-red-500' : ''}`}
                              value={line.reason_code || ''}
                              onChange={(e) => handleReasonChange(line.id, e.target.value)}
                              disabled={!isStore || activeCycle.status !== 'open'}
                            >
                              <option value="">Select Reason...</option>
                              <option value="SPOILAGE">Spoilage/Damage</option>
                              <option value="THEFT">Suspected Theft</option>
                              <option value="NOT_ENTERED">Sales Not Entered</option>
                              <option value="MEASUREMENT">Measurement Error</option>
                            </select>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                          {requiresReason && !line.reason_code && (
                            <div className="text-xs text-red-500 mt-1 flex items-center">
                              <AlertTriangle size={12} className="mr-1" /> Required
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyStockCount;
