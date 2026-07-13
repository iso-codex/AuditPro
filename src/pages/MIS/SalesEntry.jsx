import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { DollarSign, Save } from 'lucide-react';

const DEPARTMENTS = ['Kitchen', 'Bar', 'Byte'];

const SalesEntry = () => {
  const { profile } = useAuth();
  const [department, setDepartment] = useState('Bar');
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState('');
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
      if (data && data.length > 0) setSelectedItem(data[0].id);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEntry = async (e) => {
    e.preventDefault();
    if (!selectedItem || !quantity || quantity <= 0) return alert('Please provide valid inputs');
    
    setSubmitting(true);
    setMessage('');
    
    try {
      // 1. Enter sales record
      const { error: salesError } = await supabase.from('sales_entries').insert([{
        department,
        item_id: selectedItem,
        quantity_sold: quantity,
        entered_by: profile.id
      }]);
      if (salesError) throw salesError;

      // 2. Deduct from department inventory
      // First, get current inventory
      const { data: invData, error: invError } = await supabase
        .from('department_inventory')
        .select('*')
        .eq('department', department)
        .eq('item_id', selectedItem)
        .single();
        
      if (invError && invError.code !== 'PGRST116') { // PGRST116 is not found
        throw invError;
      }

      if (invData) {
        const newQty = parseFloat(invData.quantity) - parseFloat(quantity);
        await supabase
          .from('department_inventory')
          .update({ quantity: newQty, last_updated: new Date().toISOString() })
          .eq('id', invData.id);
      } else {
        // If not found, it means they sold something they didn't officially receive? 
        // We log it as negative.
        await supabase
          .from('department_inventory')
          .insert([{
            department,
            item_id: selectedItem,
            quantity: -parseFloat(quantity)
          }]);
      }

      setMessage(`Successfully logged sale of ${quantity} units for ${department}.`);
      setQuantity('');
    } catch (error) {
      console.error('Error entering sales:', error);
      alert('Failed to enter sales: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Sales Entry (MIS)</h2>
        <p className="text-gray-500">Log daily sales to deduct from department inventories.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        {message && <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm font-medium">{message}</div>}

        <form onSubmit={handleEntry} className="space-y-4">
          <div>
            <label className="form-label">Department</label>
            <select 
              className="form-select w-full"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            >
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Item Sold</label>
            <select 
              className="form-select w-full"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              required
              disabled={loading}
            >
              {loading ? <option>Loading...</option> : items.map(item => (
                <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Quantity Sold</label>
            <input 
              type="number"
              step="0.01"
              min="0.01"
              className="form-input w-full"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-full mt-4" disabled={submitting}>
            {submitting ? <div className="spinner border-0" style={{ width: '16px', height: '16px' }}></div> : <DollarSign size={18} />}
            <span>Log Sale & Deduct Inventory</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default SalesEntry;
