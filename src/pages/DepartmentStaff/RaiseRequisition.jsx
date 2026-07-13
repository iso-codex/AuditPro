import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Send, AlertCircle, Save, Download } from 'lucide-react';

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
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [itemsRes, templatesRes] = await Promise.all([
          supabase.from('items').select('*').order('name'),
          supabase.from('requisition_templates').select('*').eq('department', profile?.department || '').order('name')
        ]);
        if (itemsRes.error) throw itemsRes.error;
        if (templatesRes.error) throw templatesRes.error;
        
        setItems(itemsRes.data || []);
        setTemplates(templatesRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    if (profile?.department) {
      fetchInitialData();
    }
  }, [profile]);

  const loadTemplate = async (templateId) => {
    if (!templateId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('requisition_template_items')
        .select('*')
        .eq('template_id', templateId);
      
      if (error) throw error;
      if (data && data.length > 0) {
        setLineItems(data.map(item => ({
          id: crypto.randomUUID(),
          item_id: item.item_id,
          quantity: item.quantity
        })));
        setMessage({ type: 'success', text: 'Template loaded successfully.' });
      } else {
        setMessage({ type: 'error', text: 'Template is empty.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load template.' });
    } finally {
      setLoading(false);
    }
  };

  const saveAsTemplate = async () => {
    const validItems = lineItems.filter(li => li.item_id && li.quantity > 0);
    if (validItems.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one valid item to save as a template.' });
      return;
    }

    const templateName = prompt("Enter a name for this template:");
    if (!templateName) return;

    setSavingTemplate(true);
    try {
      const templateId = crypto.randomUUID();
      const { error: templateError } = await supabase
        .from('requisition_templates')
        .insert([{
          id: templateId,
          name: templateName,
          department: profile.department,
          created_by: profile.id
        }]);
        
      if (templateError) throw templateError;

      const templateItemsData = validItems.map(li => ({
        template_id: templateId,
        item_id: li.item_id,
        quantity: parseFloat(li.quantity)
      }));

      const { error: itemsError } = await supabase
        .from('requisition_template_items')
        .insert(templateItemsData);

      if (itemsError) throw itemsError;

      setTemplates([...templates, { id: templateId, name: templateName, department: profile.department }]);
      setMessage({ type: 'success', text: `Template "${templateName}" saved successfully!` });
    } catch (error) {
      console.error('Template save error:', error);
      setMessage({ type: 'error', text: 'Failed to save template.' });
    } finally {
      setSavingTemplate(false);
    }
  };

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
        status: 'Pending_Manager'
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

      // 4. Notify Store Managers and Auditors
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['store_manager', 'auditor']);
        
      if (managers && managers.length > 0) {
        const notificationsData = managers.map(m => ({
          user_id: m.id,
          title: 'New Requisition',
          message: `New requisition raised by ${profile.department} department.`,
          link: '/manager/inbox'
        }));
        await supabase.from('notifications').insert(notificationsData);

        // 5. Trigger Web Push Notifications
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('subscription')
          .in('user_id', managers.map(m => m.id));

        if (subscriptions && subscriptions.length > 0) {
          for (const sub of subscriptions) {
            // Non-blocking invocation
            supabase.functions.invoke('send-push', {
              body: {
                subscription: sub.subscription,
                payload: {
                  title: 'New Requisition',
                  message: `New requisition raised by ${profile.department} department.`,
                  link: '/manager/inbox'
                }
              }
            }).catch(e => console.error('Push error:', e));
          }
        }
      }

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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>Raise a Requisition</h2>
          <p>Request supplies from the company store for your department.</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            className="form-select" 
            value={selectedTemplate} 
            onChange={(e) => {
              setSelectedTemplate(e.target.value);
              loadTemplate(e.target.value);
            }}
            style={{ width: '200px' }}
          >
            <option value="">Load Template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
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

          <div className="flex justify-between pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button type="button" className="btn btn-outline" onClick={saveAsTemplate} disabled={savingTemplate || submitting}>
              {savingTemplate ? <div className="spinner border-0" style={{width: '16px', height: '16px'}}></div> : <Save size={18} />}
              <span>Save as Template</span>
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || savingTemplate}>
              {submitting ? <div className="spinner border-0" style={{width: '16px', height: '16px'}}></div> : <Send size={18} />}
              <span>Submit Requisition</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RaiseRequisition;
