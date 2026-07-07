import React, { useState } from 'react';
import { X, Check, XCircle, Send } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';

const RequisitionPanel = ({ requisition, onClose, onUpdate }) => {
  const { profile } = useAuth();
  const [items, setItems] = useState(requisition.requisition_items || []);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleQtyApprovedChange = (id, value) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, quantity_approved: value } : item
    ));
  };

  const processApprove = async () => {
    setSubmitting(true);
    try {
      // Validate
      for (const item of items) {
        if (item.quantity_approved > item.items.quantity_in_store) {
          throw new Error(`Cannot approve more than stock for ${item.items.name}`);
        }
      }

      // Update line items
      for (const item of items) {
        await supabase
          .from('requisition_items')
          .update({ quantity_approved: item.quantity_approved || item.quantity_requested })
          .eq('id', item.id);
      }

      // Update requisition status
      await supabase
        .from('requisitions')
        .update({ status: 'Approved' })
        .eq('id', requisition.id);

      // Audit Log
      await supabase.from('audit_log').insert([{
        action_type: 'Approved',
        actor_id: profile.id,
        department: requisition.department,
        notes: `Requisition ${requisition.id.split('-')[0]} approved`
      }]);

      // Notify requester
      if (requisition.requested_by) {
        await supabase.from('notifications').insert([{
          user_id: requisition.requested_by,
          title: 'Requisition Approved',
          message: `Your requisition #${requisition.id.split('-')[0]} has been approved.`,
          link: '/staff/my-requisitions'
        }]);
      }

      onUpdate();
      onClose();
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const processReject = async () => {
    if (!rejectReason) return alert("Please provide a rejection reason.");
    setSubmitting(true);
    try {
      await supabase
        .from('requisitions')
        .update({ status: 'Rejected', rejection_reason: rejectReason })
        .eq('id', requisition.id);
      
      await supabase.from('audit_log').insert([{
        action_type: 'Rejected',
        actor_id: profile.id,
        department: requisition.department,
        notes: `Requisition ${requisition.id.split('-')[0]} rejected. Reason: ${rejectReason}`
      }]);

      // Notify requester
      if (requisition.requested_by) {
        await supabase.from('notifications').insert([{
          user_id: requisition.requested_by,
          title: 'Requisition Rejected',
          message: `Your requisition #${requisition.id.split('-')[0]} has been rejected.`,
          link: '/staff/my-requisitions'
        }]);
      }

      onUpdate();
      onClose();
    } catch (error) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const processDispatch = async () => {
    setSubmitting(true);
    try {
      let lowStockAlerts = [];

      for (const item of items) {
        // deduct from store
        const newStock = parseFloat(item.items.quantity_in_store) - parseFloat(item.quantity_approved);
        if (newStock < 0) throw new Error(`Insufficient stock for ${item.items.name}`);

        await supabase
          .from('items')
          .update({ quantity_in_store: newStock })
          .eq('id', item.item_id);

        await supabase
          .from('requisition_items')
          .update({ quantity_dispatched: item.quantity_approved })
          .eq('id', item.id);

        if (newStock <= item.items.low_stock_threshold) {
          lowStockAlerts.push(item.items.name);
        }
      }

      await supabase
        .from('requisitions')
        .update({ status: 'Dispatched' })
        .eq('id', requisition.id);

      await supabase.from('audit_log').insert([{
        action_type: 'Dispatched',
        actor_id: profile.id,
        department: requisition.department,
        notes: `Requisition ${requisition.id.split('-')[0]} dispatched`
      }]);

      // Notify requester
      if (requisition.requested_by) {
        await supabase.from('notifications').insert([{
          user_id: requisition.requested_by,
          title: 'Requisition Dispatched',
          message: `Your requisition #${requisition.id.split('-')[0]} has been dispatched.`,
          link: '/staff/my-requisitions'
        }]);
      }

      // Notify Store Managers of low stock
      if (lowStockAlerts.length > 0) {
        const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'store_manager');
        if (managers && managers.length > 0) {
          const alerts = managers.map(m => ({
            user_id: m.id,
            title: 'Low Stock Alert',
            message: `The following items are low on stock: ${lowStockAlerts.join(', ')}`,
            link: '/manager/stock'
          }));
          await supabase.from('notifications').insert(alerts);
        }
      }

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
      <div className="side-panel flex flex-col">
        <div className="flex justify-between items-center mb-6 pb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '700', color: 'var(--text-primary)' }}>
              Req #{requisition.id.split('-')[0]}
            </h2>
            <p className="text-sm text-gray-500 mt-1" style={{ color: 'var(--text-secondary)' }}>
              Requisition Details
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
            <StatusBadge status={requisition.status} />
          </div>
          {requisition.rejection_reason && (
            <div className="col-span-2 sm:col-span-4 mt-2 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <span className="text-xs uppercase tracking-wider font-semibold mb-1 text-red-500 block">Rejection Reason</span>
              <span className="font-medium text-sm text-red-600">{requisition.rejection_reason}</span>
            </div>
          )}
        </div>

        <div className="mb-4">
          <p className="form-label">Notes</p>
          <p className="text-sm bg-gray-50 p-3 rounded border" style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)' }}>
            {requisition.notes || 'No notes provided.'}
          </p>
        </div>

        <div className="table-container mb-6 flex-1">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Stock</th>
                <th>Req</th>
                <th>Approve</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.items?.name}</td>
                  <td className={item.items?.quantity_in_store < item.quantity_requested ? 'text-red-500 font-semibold' : ''}>
                    {item.items?.quantity_in_store}
                  </td>
                  <td>{item.quantity_requested}</td>
                  <td>
                    {requisition.status === 'Pending' ? (
                      <input 
                        type="number"
                        className="form-input"
                        style={{ padding: '0.25rem', width: '60px' }}
                        value={item.quantity_approved !== null ? item.quantity_approved : item.quantity_requested}
                        onChange={(e) => handleQtyApprovedChange(item.id, e.target.value)}
                        min="0"
                        max={item.items?.quantity_in_store}
                      />
                    ) : (
                      <span>{item.quantity_approved}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-auto border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
          {requisition.status === 'Pending' && !isRejecting && (
            <div className="flex gap-3 justify-end">
              <button className="btn btn-danger" onClick={() => setIsRejecting(true)}>Reject</button>
              <button className="btn btn-primary" onClick={processApprove} disabled={submitting}>
                <Check size={18} /> Approve
              </button>
            </div>
          )}

          {requisition.status === 'Pending' && isRejecting && (
            <div className="flex flex-col gap-3">
              <textarea 
                className="form-input" 
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <button className="btn btn-outline" onClick={() => setIsRejecting(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={processReject} disabled={submitting}>
                  <XCircle size={18} /> Confirm Reject
                </button>
              </div>
            </div>
          )}

          {requisition.status === 'Approved' && (
            <div className="flex justify-end gap-3">
              <button className="btn btn-primary" onClick={processDispatch} disabled={submitting}>
                <Send size={18} /> Mark as Dispatched
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RequisitionPanel;
