import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Layers, AlertCircle, Search } from 'lucide-react';

const DepartmentStock = () => {
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDeptId) {
      fetchInventory();
    }
  }, [selectedDeptId]);

  const fetchDepartments = async () => {
    setLoading(true);
    const { data } = await supabase.from('departments').select('*').order('name');
    setDepartments(data || []);
    if (data && data.length > 0) {
      setSelectedDeptId(data[0].id);
    }
    setLoading(false);
  };

  const fetchInventory = async () => {
    setLoading(true);
    
    // Fetch inventory
    const { data: invData } = await supabase
      .from('department_inventory')
      .select(`
        quantity,
        last_updated,
        item:items(id, name, category, unit, unit_cost)
      `)
      .eq('department_id', selectedDeptId);
      
    // Fetch thresholds
    const { data: thresholdData } = await supabase
      .from('department_thresholds')
      .select('item_id, low_threshold, high_threshold')
      .eq('department_id', selectedDeptId);
      
    const thresholdMap = {};
    if (thresholdData) {
      thresholdData.forEach(t => {
        thresholdMap[t.item_id] = t;
      });
    }
    
    // Combine
    const combined = (invData || []).map(inv => {
      const t = thresholdMap[inv.item.id] || { low_threshold: 0, high_threshold: null };
      
      let status = 'normal';
      if (inv.quantity <= t.low_threshold) status = 'low';
      else if (t.high_threshold && inv.quantity >= t.high_threshold) status = 'high';
      
      return {
        ...inv,
        thresholds: t,
        status
      };
    });
    
    // Sort by status (low first, then high, then normal) and then by name
    combined.sort((a, b) => {
      const order = { 'low': 1, 'high': 2, 'normal': 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.item.name.localeCompare(b.item.name);
    });

    setInventory(combined);
    setLoading(false);
  };

  const filteredInv = inventory.filter(i => 
    i.item.name.toLowerCase().includes(search.toLowerCase()) || 
    i.item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Department Stock</h2>
          <p className="text-gray-500">Live view of operating department inventories.</p>
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

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50" style={{ backgroundColor: 'var(--bg-color)' }}>
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
          
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1 text-red-600">
              <div className="w-3 h-3 rounded-full bg-red-100 border border-red-300"></div> Below Low
            </div>
            <div className="flex items-center gap-1 text-orange-600">
              <div className="w-3 h-3 rounded-full bg-orange-100 border border-orange-300"></div> Above High
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <div className="w-3 h-3 rounded-full bg-green-100 border border-green-300"></div> Normal
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center"><div className="spinner"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Item Details</th>
                  <th>Category</th>
                  <th className="text-right">Live Quantity</th>
                  <th className="text-right">Unit Value</th>
                  <th className="text-right">Total Value</th>
                  <th className="text-center">Thresholds (L - H)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInv.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-8 text-gray-500">No inventory found for this department.</td></tr>
                ) : (
                  filteredInv.map((inv, idx) => (
                    <tr key={idx} className={
                      inv.status === 'low' ? 'bg-red-50' : 
                      inv.status === 'high' ? 'bg-orange-50' : ''
                    }>
                      <td>
                        <div className="font-medium text-gray-900">{inv.item.name}</div>
                        <div className="text-xs text-gray-500">{inv.item.unit} | Last updated: {new Date(inv.last_updated).toLocaleDateString()}</div>
                      </td>
                      <td>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{inv.item.category}</span>
                      </td>
                      <td className="text-right font-bold text-lg">{parseFloat(inv.quantity).toFixed(2)}</td>
                      <td className="text-right text-gray-500">{(inv.item.unit_cost || 0).toFixed(2)}</td>
                      <td className="text-right font-medium">{((inv.item.unit_cost || 0) * inv.quantity).toFixed(2)}</td>
                      <td className="text-center text-gray-500 text-sm">
                        {inv.thresholds.low_threshold} - {inv.thresholds.high_threshold || '∞'}
                      </td>
                      <td>
                        {inv.status === 'low' && (
                          <span className="flex items-center text-red-600 text-sm font-medium">
                            <AlertCircle size={14} className="mr-1" /> Reorder
                          </span>
                        )}
                        {inv.status === 'high' && (
                          <span className="flex items-center text-orange-600 text-sm font-medium">
                            <AlertCircle size={14} className="mr-1" /> Overstock
                          </span>
                        )}
                        {inv.status === 'normal' && (
                          <span className="text-green-600 text-sm">OK</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentStock;
