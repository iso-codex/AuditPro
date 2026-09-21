import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { FileText, Search, AlertTriangle, Eye } from 'lucide-react';

const SalesReconciliation = () => {
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  
  const [lines, setLines] = useState([]);
  const [unmappedSales, setUnmappedSales] = useState([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDeptId) {
      fetchData();
    }
  }, [selectedDeptId]);

  const fetchDepartments = async () => {
    setLoading(true);
    const { data } = await supabase.from('departments').select('*').order('name');
    setDepartments(data || []);
    if (data && data.length > 0) {
      setSelectedDeptId(data[0].id);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Fetch approved cycles for the department
    const { data: cycleData } = await supabase
      .from('stock_count_cycles')
      .select(`
        *,
        approved_user:approved_by(full_name)
      `)
      .eq('department_id', selectedDeptId)
      .eq('status', 'approved')
      .order('end_date', { ascending: false });
      
    setCycles(cycleData || []);
    setSelectedCycle(null);
    setLines([]);

    // 2. Fetch unmapped sales entries for this department
    // Unmapped: sold items that do NOT appear as a parent_item_id in item_recipes
    const { data: salesData } = await supabase
      .from('sales_entries')
      .select(`
        id, quantity_sold, created_at,
        item:items(id, name, unit)
      `)
      .eq('department_id', selectedDeptId)
      .order('created_at', { ascending: false })
      .limit(50);
      
    const { data: recipes } = await supabase.from('item_recipes').select('parent_item_id');
    const recipeParents = new Set((recipes || []).map(r => r.parent_item_id));
    
    const unmapped = (salesData || []).filter(s => !recipeParents.has(s.item.id));
    setUnmappedSales(unmapped);
    
    setLoading(false);
  };

  const loadCycleDetails = async (cycle) => {
    setSelectedCycle(cycle);
    
    const { data } = await supabase
      .from('stock_count_lines')
      .select(`
        *,
        item:items(name, unit, unit_cost)
      `)
      .eq('cycle_id', cycle.id)
      .order('item(name)');
      
    setLines(data || []);
  };

  return (
    <div className="page-content">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Sales vs Usage Reconciliation</h2>
          <p className="text-gray-500">Compare theoretical usage from POS sales against actual stock movement.</p>
        </div>
        <div className="flex gap-4">
          <select 
            className="form-select"
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
          >
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && !cycles.length ? (
        <div className="flex justify-center p-12"><div className="spinner"></div></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Cycles & Unmapped */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <AlertTriangle size={20} className="text-orange-500" />
                Unmapped Sales Alerts
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Recent sales of items without a recipe mapping. These will not deduct theoretical usage from raw ingredients.
              </p>
              
              {unmappedSales.length === 0 ? (
                <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm">
                  All recent sales are correctly mapped to recipes.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {unmappedSales.map(sale => (
                    <div key={sale.id} className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-900">{sale.item?.name}</div>
                        <div className="text-xs text-gray-500">{new Date(sale.created_at).toLocaleString()}</div>
                      </div>
                      <div className="font-bold text-orange-700">
                        {sale.quantity_sold} {sale.item?.unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h3 className="font-bold text-lg mb-4">Completed Count Cycles</h3>
              <div className="space-y-2">
                {cycles.length === 0 ? (
                  <p className="text-gray-500 text-sm">No approved count cycles yet.</p>
                ) : (
                  cycles.map(cycle => (
                    <div 
                      key={cycle.id}
                      onClick={() => loadCycleDetails(cycle)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedCycle?.id === cycle.id ? 'border-[var(--accent-color)] bg-indigo-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">
                          {new Date(cycle.start_date).toLocaleDateString()} - {new Date(cycle.end_date).toLocaleDateString()}
                        </span>
                        <Eye size={16} className="text-gray-400" />
                      </div>
                      <div className="text-xs text-gray-500">Approved by {cycle.approved_user?.full_name}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Cycle Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border h-full flex flex-col">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-lg">
                  {selectedCycle ? 'Reconciliation Details' : 'Select a cycle to view details'}
                </h3>
                {selectedCycle && (
                  <div className="text-sm text-gray-500">
                    {new Date(selectedCycle.start_date).toLocaleDateString()} to {new Date(selectedCycle.end_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              
              <div className="p-0 flex-1 overflow-auto">
                {!selectedCycle ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 p-12">
                    <FileText size={48} className="mb-4 opacity-50" />
                    <p>Select a completed count cycle from the list to view usage reconciliation.</p>
                  </div>
                ) : (
                  <table className="data-table w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th>Item</th>
                        <th className="text-right">Opening Qty</th>
                        <th className="text-right">Expected (Theoretical)</th>
                        <th className="text-right">Counted Qty</th>
                        <th className="text-right">Variance Qty</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr><td colSpan="6" className="text-center py-8">No lines recorded.</td></tr>
                      ) : (
                        lines.map(line => {
                          const hasVariance = line.variance_qty && Math.abs(line.variance_qty) > 0;
                          return (
                            <tr key={line.id} className={hasVariance ? 'bg-orange-50/50' : ''}>
                              <td>
                                <div className="font-medium text-gray-900">{line.item?.name}</div>
                                <div className="text-xs text-gray-500">{line.item?.unit}</div>
                              </td>
                              <td className="text-right text-gray-500">{line.opening_qty}</td>
                              <td className="text-right font-medium">{line.expected_closing_qty}</td>
                              <td className="text-right font-medium text-blue-700">{line.counted_qty}</td>
                              <td className={`text-right font-bold ${
                                line.variance_qty > 0 ? 'text-green-600' : 
                                line.variance_qty < 0 ? 'text-red-600' : 'text-gray-500'
                              }`}>
                                {line.variance_qty || 0}
                              </td>
                              <td className="text-sm">
                                {line.reason_code ? (
                                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded">{line.reason_code}</span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default SalesReconciliation;
