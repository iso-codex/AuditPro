import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const ConfirmReceiptPanel = ({ requisition, onClose, onUpdate }) => {
  const { profile } = useAuth();
  const [items, setItems] = useState(
    requisition.requisition_items.filter(i => i.quantity_dispatched > 0).map(i => ({
      ...i,
      quantity_confirmed: i.quantity_confirmed !== null ? i.quantity_confirmed : i.quantity_dispatched,
      discrepancy_notes: i.discrepancy_notes || ''
    }))
  );
  const [submitting, setSubmitting] = useState(false);

  const handleUpdate = (id, field, value) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const processConfirm = async () => {
    setSubmitting(true);
    try {
      let hasDiscrepancy = false;
      
      for (const item of items) {
        if (parseFloat(item.quantity_confirmed) !== parseFloat(item.quantity_dispatched)) {
          hasDiscrepancy = true;
        }

        await supabase
          .from('requisition_items')
          .update({ 
            quantity_confirmed: item.quantity_confirmed,
            discrepancy_notes: item.discrepancy_notes
          })
          .eq('id', item.id);

        // Update department inventory
        if (parseFloat(item.quantity_confirmed) > 0) {
          const { data: invData } = await supabase
            .from('department_inventory')
            .select('*')
            .eq('department', requisition.department)
            .eq('item_id', item.item_id)
            .single();

          if (invData) {
            await supabase
              .from('department_inventory')
              .update({ 
                quantity: parseFloat(invData.quantity) + parseFloat(item.quantity_confirmed), 
                last_updated: new Date().toISOString() 
              })
              .eq('id', invData.id);
          } else {
            await supabase
              .from('department_inventory')
              .insert([{
                department: requisition.department,
                item_id: item.item_id,
                quantity: parseFloat(item.quantity_confirmed)
              }]);
          }
        }
      }

      const finalStatus = hasDiscrepancy ? 'Partially Received' : 'Received';

      await supabase
        .from('requisitions')
        .update({ status: finalStatus })
        .eq('id', requisition.id);

      await supabase.from('audit_log').insert([{
        action_type: hasDiscrepancy ? 'Discrepancy' : 'Confirmed',
        actor_id: profile.id,
        department: requisition.department,
        notes: `Receipt confirmed for requisition ${requisition.id}. Status: ${finalStatus}`
      }]);

      onUpdate();
      onClose();
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose}></div>
      <div className="side-panel flex flex-col" style={{ maxWidth: '36rem' }}>
        <div className="flex justify-between items-center mb-6 pb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '700', color: 'var(--text-primary)' }}>
              Confirm Receipt: #{requisition.id.split('-')[0]}
            </h2>
            <p className="text-sm text-gray-500 mt-1" style={{ color: 'var(--text-secondary)' }}>
              Verify Received Quantities
            </p>
          </div>
          <button className="btn btn-outline" style={{ padding: '0.5rem', borderRadius: '50%' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl border" style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Department</span>
            <span className="font-medium text-sm">{requisition.department}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Requested By</span>
            <span className="font-medium text-sm">{requisition.profiles?.full_name || 'Unknown'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Date</span>
            <span className="font-medium text-sm">{requisition.date_requested}</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Status</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              {requisition.status}
            </span>
          </div>
          {requisition.rejection_reason && (
            <div className="col-span-2 sm:col-span-4 mt-2 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <span className="text-xs uppercase tracking-wider font-semibold mb-1 text-red-500 block">Rejection Reason</span>
              <span className="font-medium text-sm text-red-600">{requisition.rejection_reason}</span>
            </div>
          )}
        </div>

        <div className="bg-blue-50 p-4 rounded mb-6 text-sm" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)' }}>
          Please review the dispatched quantities and confirm receipt.
        </div>

        <div className="table-container mb-6 flex-1">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Dispatched & Received</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td className="font-medium">{item.items?.name}</td>
                  <td className="font-semibold">{item.quantity_dispatched}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-auto border-t pt-4 flex justify-end" style={{ borderColor: 'var(--border-color)' }}>
          <button className="btn btn-success" onClick={processConfirm} disabled={submitting} style={{ backgroundColor: 'var(--success-color)', color: 'white' }}>
            <CheckCircle size={18} /> Complete Confirmation
          </button>
        </div>
      </div>
    </>
  );
};

export default ConfirmReceiptPanel;
