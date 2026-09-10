import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { DollarSign, Plus, Trash2 } from 'lucide-react';

const DEPARTMENTS = ['Kitchen', 'Bar', 'Byte'];

const SalesEntry = () => {
  const { profile } = useAuth();
  const [department, setDepartment] = useState('Bar');
  const [items, setItems] = useState([]);
  
  const [salesLines, setSalesLines] = useState([{ id: Date.now(), item_id: '', quantity: '' }]);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('items').select('*').order('name');
      if (error) throw error;
      setItems(data || []);
      if (data && data.length > 0) {
        setSalesLines([{ id: Date.now(), item_id: data[0].id, quantity: '' }]);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => {
    setSalesLines([...salesLines, { id: Date.now(), item_id: items[0]?.id || '', quantity: '' }]);
  };

  const removeLine = (id) => {
    if (salesLines.length === 1) return;
    setSalesLines(salesLines.filter(line => line.id !== id));
  };

  const updateLine = (id, field, value) => {
    setSalesLines(salesLines.map(line => line.id === id ? { ...line, [field]: value } : line));
  };

  const handleEntry = async (e) => {
    e.preventDefault();
    const validLines = salesLines.filter(line => line.item_id && line.quantity && parseFloat(line.quantity) > 0);
    
    if (validLines.length === 0) return alert('Please add at least one valid item with a quantity greater than 0.');
    
    setSubmitting(true);
    setMessage('');
    
    try {
      // 1. Enter sales records
      const salesRecords = validLines.map(line => ({
        department,
        item_id: line.item_id,
        quantity_sold: line.quantity,
        entered_by: profile.id
      }));

      const { error: salesError } = await supabase.from('sales_entries').insert(salesRecords);
      if (salesError) throw salesError;

      // 2. Deduct from department inventory
      for (const line of validLines) {
        const { data: invData, error: invError } = await supabase
          .from('department_inventory')
          .select('*')
          .eq('department', department)
          .eq('item_id', line.item_id)
          .single();
          
        if (invError && invError.code !== 'PGRST116') { // PGRST116 is not found
          throw invError;
        }

        if (invData) {
          const newQty = parseFloat(invData.quantity) - parseFloat(line.quantity);
          await supabase
            .from('department_inventory')
            .update({ quantity: newQty, last_updated: new Date().toISOString() })
            .eq('id', invData.id);
        } else {
          // If not found, log it as negative.
          await supabase
            .from('department_inventory')
            .insert([{
              department,
              item_id: line.item_id,
              quantity: -parseFloat(line.quantity)
            }]);
        }
      }

      setMessage(`Successfully logged sales for ${validLines.length} item(s) in ${department}.`);
      setSalesLines([{ id: Date.now(), item_id: items[0]?.id || '', quantity: '' }]);
    } catch (error) {
      console.error('Error entering sales:', error);
      alert('Failed to enter sales: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold mb-2">Sales Entry (MIS)</h2>
          <p className="text-gray-500">Log daily sales to deduct from department inventories.</p>
        </div>
        <div className="w-48">
          <label className="form-label text-sm text-gray-500">Department</label>
          <select 
            className="form-select w-full"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={submitting}
          >
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        {message && <div className="bg-green-50 text-green-700 p-3 rounded mb-6 text-sm font-medium">{message}</div>}

        <form onSubmit={handleEntry}>
          
          <div className="mb-4">
            <div className="grid grid-cols-12 gap-4 mb-2 px-2">
              <div className="col-span-7"><label className="form-label mb-0 text-xs text-gray-500 uppercase tracking-wider font-semibold">Item</label></div>
              <div className="col-span-4"><label className="form-label mb-0 text-xs text-gray-500 uppercase tracking-wider font-semibold">Qty Sold</label></div>
              <div className="col-span-1"></div>
            </div>
            
            <div className="space-y-3">
              {salesLines.map((line, index) => (
                <div key={line.id} className="grid grid-cols-12 gap-4 items-center bg-gray-50 p-2 rounded-lg border border-gray-100" style={{ backgroundColor: 'var(--bg-color)' }}>
                  <div className="col-span-7">
                    <select 
                      className="form-select w-full border-gray-200"
                      value={line.item_id}
                      onChange={(e) => updateLine(line.id, 'item_id', e.target.value)}
                      required
                      disabled={loading || submitting}
                    >
                      {loading ? <option>Loading...</option> : items.map(item => (
                        <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="col-span-4">
                    <input 
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input w-full border-gray-200"
                      placeholder="0.00"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <button 
                      type="button" 
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      onClick={() => removeLine(line.id)}
                      disabled={salesLines.length === 1 || submitting}
                      title="Remove row"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={addLine}
              disabled={submitting}
            >
              <Plus size={18} /> Add Another Item
            </button>

            <button type="submit" className="btn btn-primary px-8" disabled={submitting}>
              {submitting ? <div className="spinner border-0" style={{ width: '16px', height: '16px' }}></div> : <DollarSign size={18} />}
              <span className="ml-2">Log Sales & Deduct</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalesEntry;
