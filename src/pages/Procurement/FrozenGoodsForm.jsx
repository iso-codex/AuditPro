import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Plus, Trash2, Save, CheckCircle, Lock, AlertCircle, Clock, Truck, Eye, RefreshCw } from 'lucide-react';
import ProcurementFormTimeline from '../../components/ProcurementFormTimeline';
import { FORM_STAGES, MANAGER_AUDITOR_VISIBLE_FORM_STATUSES } from '../../utils/procurementConstants';
import { formatRole } from '../../utils/formatters';

const FrozenGoodsForm = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const formIdParam = searchParams.get('id');

  const isProcurementOrAdmin = ['procurement', 'admin'].includes(profile?.role);
  const isReadOnly = !isProcurementOrAdmin;

  const [formsList, setFormsList] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState(FORM_STAGES.CREATED);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([
    { id: Date.now(), item_id: '', quantity: '', item_date: new Date().toISOString().split('T')[0] }
  ]);
  const [formMeta, setFormMeta] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchInitialData();
  }, [profile?.role]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      let formsQuery = supabase
        .from('procurement_forms')
        .select(`
          *,
          suppliers (name),
          created_user:created_by (full_name)
        `)
        .eq('form_type', 'frozen_goods')
        .order('created_at', { ascending: false });

      // If manager or auditor, only query visible statuses
      if (isReadOnly) {
        formsQuery = formsQuery.in('status', MANAGER_AUDITOR_VISIBLE_FORM_STATUSES);
      }

      const [itemsRes, suppliersRes, formsRes] = await Promise.all([
        supabase.from('items').select('*').order('name'),
        supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
        formsQuery
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (formsRes.error) throw formsRes.error;

      const loadedForms = formsRes.data || [];
      setItems(itemsRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setFormsList(loadedForms);

      // Determine form to select initially
      let targetId = formIdParam;
      if (!targetId && isReadOnly && loadedForms.length > 0) {
        targetId = loadedForms[0].id;
      }

      if (targetId) {
        await handleSelectForm(targetId);
      }
    } catch (err) {
      console.error('Error loading frozen goods data:', err);
      setMessage({ type: 'error', text: 'Failed to load initial data.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectForm = async (formId) => {
    if (!formId) {
      if (isReadOnly) return; // Read-only users cannot reset to blank new form
      setSelectedFormId(null);
      setFormDate(new Date().toISOString().split('T')[0]);
      setSupplierId('');
      setStatus(FORM_STAGES.CREATED);
      setNotes('');
      setLineItems([{ id: Date.now(), item_id: '', quantity: '', item_date: new Date().toISOString().split('T')[0] }]);
      setFormMeta(null);
      setHistory([]);
      return;
    }

    setLoading(true);
    setSelectedFormId(formId);
    try {
      const [formRes, itemsRes, historyRes] = await Promise.all([
        supabase.from('procurement_forms').select('*').eq('id', formId).single(),
        supabase.from('procurement_form_items').select('*').eq('form_id', formId),
        supabase
          .from('procurement_form_history')
          .select(`*, profiles:changed_by (full_name)`)
          .eq('form_id', formId)
          .order('created_at', { ascending: false })
      ]);

      if (formRes.error) throw formRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const f = formRes.data;
      setFormMeta(f);
      setFormDate(f.form_date);
      setSupplierId(f.supplier_id || '');
      setStatus(f.status);
      setNotes(f.notes || '');

      if (itemsRes.data && itemsRes.data.length > 0) {
        setLineItems(itemsRes.data.map(i => ({
          id: i.id,
          item_id: i.item_id,
          quantity: i.quantity,
          item_date: i.item_date || f.form_date
        })));
      } else {
        setLineItems([{ id: Date.now(), item_id: '', quantity: '', item_date: f.form_date }]);
      }

      setHistory(historyRes.data || []);
    } catch (err) {
      console.error('Error fetching form details:', err);
      setMessage({ type: 'error', text: 'Failed to load form details.' });
    } finally {
      setLoading(false);
    }
  };

  const addLineItem = () => {
    if (isReadOnly || isFormLocked) return;
    setLineItems([
      ...lineItems,
      { id: Date.now(), item_id: '', quantity: '', item_date: formDate }
    ]);
  };

  const removeLineItem = (id) => {
    if (isReadOnly || isFormLocked) return;
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(i => i.id !== id));
    }
  };

  const updateLineItem = (id, field, value) => {
    if (isReadOnly || isFormLocked) return;
    setLineItems(lineItems.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSave = async (isCompleting = false) => {
    if (isReadOnly) {
      alert('Read-only access: You cannot save or edit procurement forms.');
      return;
    }

    if (status === FORM_STAGES.COMPLETED) {
      alert('This form is Completed and locked against modifications.');
      return;
    }

    if (!supplierId) {
      setMessage({ type: 'error', text: 'Please select a supplier from the dropdown.' });
      return;
    }

    const validItems = lineItems.filter(li => li.item_id && Number(li.quantity) > 0);
    if (validItems.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one valid item with a quantity.' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const now = new Date().toISOString();
      let targetFormId = selectedFormId;
      let newStatus = status;

      if (isCompleting) {
        newStatus = FORM_STAGES.COMPLETED;
      } else if (!selectedFormId || status === FORM_STAGES.CREATED) {
        newStatus = FORM_STAGES.SAVED;
      } else {
        newStatus = FORM_STAGES.UPDATED;
      }

      const actionName = isCompleting 
        ? 'Completed' 
        : (!selectedFormId || status === FORM_STAGES.CREATED) 
        ? 'Saved' 
        : 'Updated';

      if (!targetFormId) {
        targetFormId = crypto.randomUUID();
        const { error: insertError } = await supabase
          .from('procurement_forms')
          .insert([{
            id: targetFormId,
            form_type: 'frozen_goods',
            status: newStatus,
            form_date: formDate,
            supplier_id: supplierId,
            notes: notes,
            created_by: profile.id,
            created_at: now,
            first_saved_by: profile.id,
            first_saved_at: now,
            completed_by: isCompleting ? profile.id : null,
            completed_at: isCompleting ? now : null
          }]);

        if (insertError) throw insertError;
      } else {
        const updatePayload = {
          form_date: formDate,
          supplier_id: supplierId,
          notes: notes,
          status: newStatus,
          last_updated_by: profile.id,
          last_updated_at: now
        };

        if (isCompleting) {
          updatePayload.completed_by = profile.id;
          updatePayload.completed_at = now;
        }

        const { error: updateError } = await supabase
          .from('procurement_forms')
          .update(updatePayload)
          .eq('id', targetFormId);

        if (updateError) throw updateError;
      }

      // Sync items
      await supabase.from('procurement_form_items').delete().eq('form_id', targetFormId);
      const itemsPayload = validItems.map(li => ({
        form_id: targetFormId,
        item_id: li.item_id,
        quantity: parseFloat(li.quantity),
        item_date: li.item_date || formDate
      }));
      const { error: itemsError } = await supabase
        .from('procurement_form_items')
        .insert(itemsPayload);

      if (itemsError) throw itemsError;

      // History
      const selectedSup = suppliers.find(s => s.id === supplierId);
      const changeSummary = `${actionName} with ${validItems.length} item(s) from supplier ${selectedSup?.name || 'Unknown'}.`;
      await supabase.from('procurement_form_history').insert([{
        form_id: targetFormId,
        changed_by: profile.id,
        action: actionName,
        changes: { summary: changeSummary, count: validItems.length },
        created_at: now
      }]);

      // Audit Log
      await supabase.from('audit_log').insert([{
        action_type: `Frozen Goods Form ${actionName}`,
        actor_id: profile.id,
        table_name: 'procurement_forms',
        record_id: targetFormId,
        notes: `Frozen Goods Form ${targetFormId.substring(0, 8)} ${actionName.toLowerCase()} by ${profile.full_name}`
      }]);

      setMessage({ type: 'success', text: `Frozen Goods Form successfully ${actionName.toLowerCase()}!` });
      await fetchInitialData();
      await handleSelectForm(targetFormId);

    } catch (err) {
      console.error('Frozen goods save error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save form.' });
    } finally {
      setSaving(false);
    }
  };

  const isFormLocked = status === FORM_STAGES.COMPLETED || isReadOnly;

  const totalPortions = lineItems.reduce((acc, curr) => acc + (parseFloat(curr.quantity) || 0), 0);
  const currentSupplier = suppliers.find(s => s.id === supplierId);

  return (
    <div className="frozen-goods-page" style={{ maxWidth: '1000px' }}>
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h2>Frozen Goods Form {isReadOnly ? '(Read-Only Review)' : ''}</h2>
          <p className="text-gray-500">
            {isReadOnly 
              ? 'Review registered supplier frozen goods intake and delivery dates in read-only mode.' 
              : 'Record frozen goods procurement from registered suppliers.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isReadOnly && selectedFormId && (
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => handleSelectForm(null)}
            >
              <Plus size={16} /> New Form
            </button>
          )}

          <select 
            className="form-select font-medium" 
            style={{ minWidth: '240px' }}
            value={selectedFormId || ''} 
            onChange={(e) => handleSelectForm(e.target.value || null)}
          >
            {!isReadOnly && <option value="">-- Create New Form --</option>}
            {isReadOnly && formsList.length === 0 && (
              <option value="" disabled>-- No Saved Forms Available --</option>
            )}
            {isReadOnly && formsList.length > 0 && !selectedFormId && (
              <option value="" disabled>-- Select a Frozen Goods Form --</option>
            )}
            {formsList.map(f => (
              <option key={f.id} value={f.id}>
                {f.form_date} - {f.status} ({f.suppliers?.name || 'No Supplier'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {message.text && (
        <div 
          className={`mb-4 p-3 rounded flex items-center gap-2 ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
          style={{ backgroundColor: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }}
        >
          <AlertCircle size={18} />
          <span>{message.text}</span>
        </div>
      )}

      {/* Read-Only Notice for Manager / Auditor */}
      {isReadOnly && (
        <div className="mb-4 p-3 rounded-lg flex items-center gap-2 bg-blue-50 text-blue-900 border border-blue-200">
          <Eye size={18} className="text-blue-600 flex-shrink-0" />
          <span className="text-sm">
            <strong>Read-Only Mode:</strong> You are viewing this Frozen Goods Form as <strong>{formatRole(profile?.role)}</strong>. Creating, editing, and completing procurement forms is restricted to Procurement and Admin.
          </span>
        </div>
      )}

      {status === FORM_STAGES.COMPLETED && !isReadOnly && (
        <div className="mb-4 p-3 rounded flex items-center gap-2 bg-purple-50 text-purple-800 border border-purple-200">
          <Lock size={18} />
          <span>This Frozen Goods Form is <strong>Completed</strong> and locked. It cannot be modified.</span>
        </div>
      )}

      {isReadOnly && !selectedFormId && formsList.length === 0 ? (
        <div className="card text-center py-12">
          <Clock size={40} className="mx-auto text-gray-400 mb-3" />
          <h3 className="text-gray-700">No Frozen Goods Forms Available</h3>
          <p className="text-sm text-gray-500 mt-1">
            No frozen goods forms have been saved or updated yet.
          </p>
        </div>
      ) : (
        <div className="card mb-6">
          <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div className="form-group" style={{ minWidth: '180px' }}>
              <label className="form-label">Form Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={formDate} 
                onChange={(e) => setFormDate(e.target.value)} 
                disabled={isFormLocked}
                required
              />
            </div>

            <div className="form-group flex-1" style={{ minWidth: '220px' }}>
              <label className="form-label flex items-center gap-1">
                <Truck size={14} /> Registered Supplier {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <select 
                className="form-select" 
                value={supplierId} 
                onChange={(e) => setSupplierId(e.target.value)} 
                disabled={isFormLocked}
                required
              >
                <option value="" disabled>Select Registered Supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.contact_person || 'Supplier'})</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ minWidth: '140px' }}>
              <label className="form-label">Current Stage</label>
              <div className="pt-2">
                <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                  status === 'Completed' ? 'bg-purple-100 text-purple-800' :
                  status === 'Updated' ? 'bg-amber-100 text-amber-800' :
                  status === 'Saved' ? 'bg-green-100 text-green-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {status}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 style={{ margin: 0 }}>Frozen Items & Batch Intake Dates</h3>
              <span className="text-sm font-semibold text-blue-700">
                Total Intake: {totalPortions} portion(s)/unit(s)
              </span>
            </div>

            {lineItems.map((lineItem, idx) => {
              const selectedItem = items.find(i => i.id === lineItem.item_id);
              return (
                <div key={lineItem.id || idx} className="flex gap-3 mb-3 items-center flex-wrap sm:flex-nowrap">
                  <div className="flex-1" style={{ minWidth: '220px' }}>
                    <select 
                      className="form-select" 
                      value={lineItem.item_id}
                      onChange={(e) => updateLineItem(lineItem.id, 'item_id', e.target.value)}
                      disabled={isFormLocked}
                      required
                    >
                      <option value="" disabled>Select Catalogue Good</option>
                      {items.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1" style={{ width: '90px' }}>
                    <span className="text-sm text-gray-500 w-full text-center">
                      {selectedItem ? selectedItem.unit : 'unit'}
                    </span>
                  </div>

                  <div style={{ width: '120px' }}>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="Qty"
                      value={lineItem.quantity}
                      onChange={(e) => updateLineItem(lineItem.id, 'quantity', e.target.value)}
                      min="0.01"
                      step="0.01"
                      disabled={isFormLocked}
                      required
                    />
                  </div>

                  <div style={{ width: '160px' }}>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={lineItem.item_date}
                      onChange={(e) => updateLineItem(lineItem.id, 'item_date', e.target.value)}
                      disabled={isFormLocked}
                      title="Batch / Intake Date"
                      required
                    />
                  </div>

                  {!isFormLocked && !isReadOnly && (
                    <button 
                      type="button" 
                      className="btn btn-outline text-red-500" 
                      style={{ padding: '0.5rem', color: 'var(--danger-color)' }}
                      onClick={() => removeLineItem(lineItem.id)}
                      disabled={lineItems.length === 1}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              );
            })}

            {!isFormLocked && !isReadOnly && (
              <button type="button" className="btn btn-outline mt-2 text-sm" onClick={addLineItem}>
                <Plus size={16} /> Add Another Item
              </button>
            )}
          </div>

          <div className="form-group mb-6">
            <label className="form-label">Notes & Storage Conditions</label>
            <textarea 
              className="form-input" 
              rows="3" 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isReadOnly ? 'No storage notes provided.' : 'Freezer temperature, delivery condition, batch notes...'}
              disabled={isFormLocked}
            ></textarea>
          </div>

          {!isFormLocked && !isReadOnly && (
            <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => handleSave(false)} 
                disabled={saving}
              >
                <Save size={18} />
                <span>{saving ? 'Saving...' : status === FORM_STAGES.CREATED ? 'Save Draft' : 'Save Changes'}</span>
              </button>

              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  if (window.confirm('Are you sure you want to Complete this form? Completed forms are final and permanently locked.')) {
                    handleSave(true);
                  }
                }} 
                disabled={saving}
              >
                <Lock size={18} />
                <span>Complete & Lock Form</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Revision History & Timeline */}
      {selectedFormId && (
        <div className="card">
          <ProcurementFormTimeline history={history} />
        </div>
      )}
    </div>
  );
};

export default FrozenGoodsForm;
