import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Plus, Save, X, Trash2, AlertCircle, ShoppingCart } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';

const PurchaseOrders = () => {
  const { profile } = useAuth();
  const [pos, setPos] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // New PO State
  const [newPo, setNewPo] = useState({
    supplier_id: '',
    expected_date: ''
  });
  const [lineItems, setLineItems] = useState([
    { id: Date.now(), item_id: '', quantity_ordered: '', unit_cost: '' }
  ]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [posRes, supRes, itemRes] = await Promise.all([
        supabase.from('purchase_orders').select('*, suppliers(name), profiles(full_name)').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('items').select('*').order('name')
      ]);

      if (posRes.error) throw posRes.error;
      if (supRes.error) throw supRes.error;
      if (itemRes.error) throw itemRes.error;

      setPos(posRes.data || []);
      setSuppliers(supRes.data || []);
      setItems(itemRes.data || []);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Failed to load purchase orders.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLineItemChange = (id, field, value) => {
    setLineItems(lineItems.map(li => li.id === id ? { ...li, [field]: value } : li));
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { id: Date.now(), item_id: '', quantity_ordered: '', unit_cost: '' }]);
  };

  const removeLineItem = (id) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(li => li.id !== id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = lineItems.filter(li => li.item_id && parseFloat(li.quantity_ordered) > 0);
    
    if (validItems.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one valid item to the PO.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      // Create PO
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
          supplier_id: newPo.supplier_id,
          ordered_by: profile.id,
          expected_date: newPo.expected_date || null
        }])
        .select()
        .single();
      
      if (poError) throw poError;

      // Create PO Items
      const poItems = validItems.map(li => ({
        po_id: po.id,
        item_id: li.item_id,
        quantity_ordered: parseFloat(li.quantity_ordered),
        unit_cost: li.unit_cost ? parseFloat(li.unit_cost) : 0
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItems);
        
      if (itemsError) throw itemsError;

      setMessage({ type: 'success', text: 'Purchase Order created successfully!' });
      setIsCreating(false);
      setNewPo({ supplier_id: '', expected_date: '' });
      setLineItems([{ id: Date.now(), item_id: '', quantity_ordered: '', unit_cost: '' }]);
      await fetchInitialData();
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: error.message || 'Failed to create PO' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="spinner mt-10 mx-auto"></div>;

  return (
    <div className="purchase-orders">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>Purchase Orders</h2>
          <p className="text-gray-500">Manage procurement orders to suppliers.</p>
        </div>
        {!isCreating && (
          <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
            <Plus size={18} /> New PO
          </button>
        )}
      </div>

      {message.text && (
        <div className={`mb-4 p-3 rounded flex items-center gap-2 ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          <AlertCircle size={18} />
          <span>{message.text}</span>
        </div>
      )}

      {isCreating ? (
        <div className="card mb-6 border-l-4" style={{ borderLeftColor: 'var(--primary-color)' }}>
          <div className="flex justify-between items-center mb-4 pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <h3 className="flex items-center gap-2"><ShoppingCart size={20} /> Create Purchase Order</h3>
            <button className="btn btn-outline text-sm" onClick={() => setIsCreating(false)}><X size={16} /> Cancel</button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="form-group">
                <label className="form-label">Supplier</label>
                <select className="form-select" value={newPo.supplier_id} onChange={e => setNewPo({...newPo, supplier_id: e.target.value})} required>
                  <option value="" disabled>Select Supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expected Date</label>
                <input type="date" className="form-input" value={newPo.expected_date} onChange={e => setNewPo({...newPo, expected_date: e.target.value})} />
              </div>
            </div>

            <div className="mb-4">
              <h4 className="mb-2 text-sm uppercase tracking-wider font-semibold text-gray-500">Line Items</h4>
              {lineItems.map(li => (
                <div key={li.id} className="flex gap-2 mb-2 items-start">
                  <div className="flex-1">
                    <select className="form-select" value={li.item_id} onChange={e => handleLineItemChange(li.id, 'item_id', e.target.value)} required>
                      <option value="" disabled>Select Item...</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div style={{ width: '100px' }}>
                    <input type="number" className="form-input" placeholder="Qty" value={li.quantity_ordered} onChange={e => handleLineItemChange(li.id, 'quantity_ordered', e.target.value)} required min="0.1" step="0.1" />
                  </div>
                  <div style={{ width: '120px' }} className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input type="number" className="form-input" style={{ paddingLeft: '1.5rem' }} placeholder="Unit Cost" value={li.unit_cost} onChange={e => handleLineItemChange(li.id, 'unit_cost', e.target.value)} min="0" step="0.01" />
                  </div>
                  <button type="button" className="btn btn-outline text-red-500" onClick={() => removeLineItem(li.id)} disabled={lineItems.length === 1} style={{ padding: '0.5rem' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-text mt-1 text-sm font-semibold" onClick={addLineItem} style={{ color: 'var(--primary-color)' }}>+ Add Item</button>
            </div>

            <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Issue PO'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="table-container card">
        <table>
          <thead>
            <tr>
              <th>PO #</th>
              <th>Supplier</th>
              <th>Date Ordered</th>
              <th>Expected Date</th>
              <th>Ordered By</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-4 text-gray-500">No purchase orders found.</td></tr>
            ) : pos.map(po => (
              <tr key={po.id}>
                <td className="font-mono text-sm">{po.id.substring(0,8)}</td>
                <td className="font-medium">{po.suppliers?.name}</td>
                <td>{po.date_ordered}</td>
                <td>{po.expected_date || '-'}</td>
                <td>{po.profiles?.full_name}</td>
                <td><StatusBadge status={po.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PurchaseOrders;
