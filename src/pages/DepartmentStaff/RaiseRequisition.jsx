import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Send, AlertCircle } from 'lucide-react';

const RaiseRequisition = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([
    { id: Date.now(), item_id: '', quantity: '' }
  ]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const { data, error } = await supabase.from('items').select('*').order('name');
        if (error) throw error;
        setItems(data || []);
      } catch (error) {
        console.error('Error fetching items:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  const addLineItem = () => {
    setLineItems([...lineItems, { id: Date.now(), item_id: '', quantity: '' }]);
  };

  const removeLineItem = (id) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id, field, value) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const validItems = lineItems.filter(li => li.item_id && li.quantity > 0);
    if (validItems.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one valid item.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      // 1. Create requisition
      const reqId = crypto.randomUUID();
      const insertPayload = {
        id: reqId,
        department: profile.department,
        requested_by: profile.id,
        date_requested: new Date().toISOString().split('T')[0],
        notes: notes,
        status: 'Pending'
      };
      
      const { error: reqError } = await supabase
        .from('requisitions')
        .insert([insertPayload]);

      if (reqError) {
        console.error("Requisition insert error details:", reqError);
        throw reqError;
      }

      // 2. Create line items
      const reqItemsData = validItems.map(li => ({
        requisition_id: reqId,
        item_id: li.item_id,
        quantity_requested: parseFloat(li.quantity)
      }));

      const { error: itemsError } = await supabase
        .from('requisition_items')
        .insert(reqItemsData);

      if (itemsError) throw itemsError;

      // 3. Audit Log
      await supabase.from('audit_log').insert([{
        action_type: 'Requisition Raised',
        actor_id: profile.id,
        department: profile.department,
        notes: `Raised requisition ${reqId.split('-')[0]} with ${validItems.length} items.`
      }]);

      setMessage({ type: 'success', text: `Requisition submitted successfully!` });
      setLineItems([{ id: Date.now(), item_id: '', quantity: '' }]);
      setNotes('');
    } catch (error) {
      console.error('Submission error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to submit requisition.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="spinner mt-10 mx-auto"></div>;

  return (
    <div className="raise-requisition-page" style={{ maxWidth: '800px' }}>
      <div className="mb-6">
        <h2>Raise a Requisition</h2>
        <p>Request supplies from the company store for your department.</p>
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
          <div className="flex flex-col-mobile gap-4 mb-6">
            <div className="form-group flex-1">
              <label className="form-label">Department</label>
              <input type="text" className="form-input bg-gray-50 text-gray-500" value={profile?.department || ''} readOnly disabled />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">Requested By</label>
              <input type="text" className="form-input bg-gray-50 text-gray-500" value={profile?.full_name || ''} readOnly disabled />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">Date</label>
              <input type="text" className="form-input bg-gray-50 text-gray-500" value={new Date().toLocaleDateString()} readOnly disabled />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="mb-3">Items</h3>
            {lineItems.map((lineItem, index) => {
              const selectedItem = items.find(i => i.id === lineItem.item_id);
              return (
                <div key={lineItem.id} className="flex gap-3 mb-3 items-start">
                  <div className="flex-1">
                    <select 
                      className="form-select" 
                      value={lineItem.item_id}
                      onChange={(e) => updateLineItem(lineItem.id, 'item_id', e.target.value)}
                      required
                    >
                      <option value="" disabled>Select Item</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2" style={{ width: '120px' }}>
                    <span className="text-sm text-gray-500 w-16 text-right">
                      {selectedItem ? selectedItem.unit : '-'}
                    </span>
                  </div>

                  <div style={{ width: '120px' }}>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="Qty"
                      value={lineItem.quantity}
                      onChange={(e) => updateLineItem(lineItem.id, 'quantity', e.target.value)}
                      min="0.1"
                      step="0.1"
                      required
                    />
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-outline text-red-500" 
                    style={{ padding: '0.5rem', color: 'var(--danger-color)' }}
                    onClick={() => removeLineItem(lineItem.id)}
                    disabled={lineItems.length === 1}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
            
            <button type="button" className="btn btn-outline mt-2 text-sm" onClick={addLineItem}>
              <Plus size={16} /> Add Item
            </button>
          </div>

          <div className="form-group mb-6">
            <label className="form-label">Notes</label>
            <textarea 
              className="form-input" 
              rows="3" 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional instructions or context..."
            ></textarea>
          </div>

          <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <div className="spinner border-0"></div> : <Send size={18} />}
              <span>Submit Requisition</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RaiseRequisition;
