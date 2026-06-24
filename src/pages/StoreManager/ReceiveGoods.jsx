import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { PackagePlus, Save, AlertCircle } from 'lucide-react';

const ReceiveGoods = () => {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    supplier_id: '',
    item_id: '',
    quantity_received: '',
    date_received: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suppliersRes, itemsRes] = await Promise.all([
          supabase.from('suppliers').select('*').order('name'),
          supabase.from('items').select('*').order('name')
        ]);
        
        if (suppliersRes.error) throw suppliersRes.error;
        if (itemsRes.error) throw itemsRes.error;
        
        setSuppliers(suppliersRes.data || []);
        setItems(itemsRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setMessage({ type: 'error', text: 'Failed to load form data.' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      // 1. Insert into goods_receipts
      const { data: receipt, error: receiptError } = await supabase
        .from('goods_receipts')
        .insert([{
          supplier_id: formData.supplier_id,
          item_id: formData.item_id,
          quantity_received: parseFloat(formData.quantity_received),
          received_by: profile.id,
          date_received: formData.date_received
        }])
        .select()
        .single();

      if (receiptError) throw receiptError;

      // 2. Fetch current item stock
      const { data: item, error: itemFetchError } = await supabase
        .from('items')
        .select('quantity_in_store, name')
        .eq('id', formData.item_id)
        .single();
        
      if (itemFetchError) throw itemFetchError;

      const newQuantity = parseFloat(item.quantity_in_store) + parseFloat(formData.quantity_received);

      // 3. Update items table
      const { error: itemUpdateError } = await supabase
        .from('items')
        .update({ quantity_in_store: newQuantity })
        .eq('id', formData.item_id);

      if (itemUpdateError) throw itemUpdateError;

      // 4. Log to audit_log
      const { error: auditError } = await supabase
        .from('audit_log')
        .insert([{
          action_type: 'Received',
          actor_id: profile.id,
          item_names: item.name,
          quantity: parseFloat(formData.quantity_received),
          notes: `Received from supplier ID: ${formData.supplier_id}`
        }]);

      if (auditError) throw auditError;

      setMessage({ type: 'success', text: `Successfully received ${formData.quantity_received} units of ${item.name}.` });
      setFormData(prev => ({ ...prev, item_id: '', quantity_received: '' }));
      
    } catch (error) {
      console.error('Submission error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to process receipt.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="spinner mt-10 mx-auto"></div>;

  return (
    <div className="receive-goods-page" style={{ maxWidth: '600px' }}>
      <div className="mb-6">
        <h2>Receive Goods</h2>
        <p>Log incoming deliveries from suppliers.</p>
      </div>

      <div className="card">
        {message.text && (
          <div className={`mb-4 p-3 rounded flex items-center gap-2 ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`} 
               style={{ backgroundColor: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: message.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)' }}>
            <AlertCircle size={18} />
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Supplier</label>
            <select 
              className="form-select" 
              name="supplier_id" 
              value={formData.supplier_id} 
              onChange={handleChange}
              required
            >
              <option value="" disabled>Select Supplier</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Item</label>
            <select 
              className="form-select" 
              name="item_id" 
              value={formData.item_id} 
              onChange={handleChange}
              required
            >
              <option value="" disabled>Select Item</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="form-group flex-1">
              <label className="form-label">Quantity Received</label>
              <input 
                type="number" 
                className="form-input" 
                name="quantity_received"
                value={formData.quantity_received}
                onChange={handleChange}
                min="0.1" 
                step="0.1"
                required 
              />
            </div>

            <div className="form-group flex-1">
              <label className="form-label">Date Received</label>
              <input 
                type="date" 
                className="form-input" 
                name="date_received"
                value={formData.date_received}
                onChange={handleChange}
                required 
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <div className="spinner border-0"></div> : <Save size={18} />}
              <span>Save Receipt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiveGoods;
