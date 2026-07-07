import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Save, AlertCircle, Search, CheckCircle } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';

const ReceiveGoods = () => {
  const { profile } = useAuth();
  const [pos, setPos] = useState([]);
  const [selectedPo, setSelectedPo] = useState(null);
  const [poItems, setPoItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchActivePOs();
  }, []);

  const fetchActivePOs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(name)')
        .in('status', ['Pending', 'Partial'])
        .order('date_ordered', { ascending: true });
        
      if (error) throw error;
      setPos(data || []);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Failed to load active purchase orders.' });
    } finally {
      setLoading(false);
    }
  };

  const loadPoDetails = async (poId) => {
    if (!poId) {
      setSelectedPo(null);
      setPoItems([]);
      return;
    }
    
    setLoading(true);
    try {
      const po = pos.find(p => p.id === poId);
      setSelectedPo(po);
      
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('*, items(name, unit, quantity_in_store)')
        .eq('po_id', poId);
        
      if (error) throw error;
      
      // Initialize state for receiving goods
      const itemsToReceive = data.map(item => ({
        ...item,
        receiving_now: '', // blank initially
        actual_cost: item.unit_cost || ''
      }));
      setPoItems(itemsToReceive);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Failed to load PO items.' });
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (id, field, value) => {
    setPoItems(poItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const itemsBeingReceived = poItems.filter(item => parseFloat(item.receiving_now) > 0);
    if (itemsBeingReceived.length === 0) {
      setMessage({ type: 'error', text: 'Please enter received quantities for at least one item.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      let allItemsFullyReceived = true;
      const receiptRecords = [];
      let auditLogNotes = `Received PO ${selectedPo.id.substring(0,8)} from ${selectedPo.suppliers?.name}: `;

      for (const item of poItems) {
        const currentlyReceived = item.receiving_now ? parseFloat(item.receiving_now) : 0;
        const totalReceived = parseFloat(item.quantity_received) + currentlyReceived;
        const cost = item.actual_cost ? parseFloat(item.actual_cost) : 0;
        
        if (totalReceived < parseFloat(item.quantity_ordered)) {
          allItemsFullyReceived = false;
        }

        if (currentlyReceived > 0) {
          // 1. Update PO Item
          await supabase.from('purchase_order_items')
            .update({ quantity_received: totalReceived })
            .eq('id', item.id);

          // 2. Prepare Goods Receipt Record
          receiptRecords.push({
            po_id: selectedPo.id,
            supplier_id: selectedPo.supplier_id,
            item_id: item.item_id,
            quantity_received: currentlyReceived,
            received_by: profile.id,
            date_received: new Date().toISOString().split('T')[0],
            unit_cost: cost
          });

          // 3. Update Global Item Stock & Latest Cost
          const newStock = parseFloat(item.items.quantity_in_store) + currentlyReceived;
          await supabase.from('items')
            .update({ quantity_in_store: newStock, unit_cost: cost })
            .eq('id', item.item_id);
            
          auditLogNotes += `${currentlyReceived}x ${item.items.name}, `;
        }
      }

      // 4. Insert Goods Receipts
      if (receiptRecords.length > 0) {
        await supabase.from('goods_receipts').insert(receiptRecords);
      }

      // 5. Update PO Status
      const newStatus = allItemsFullyReceived ? 'Completed' : 'Partial';
      await supabase.from('purchase_orders')
        .update({ status: newStatus })
        .eq('id', selectedPo.id);

      // 6. Audit Log
      await supabase.from('audit_log').insert([{
        action_type: 'Received',
        actor_id: profile.id,
        notes: auditLogNotes.slice(0, -2) // remove trailing comma
      }]);

      setMessage({ type: 'success', text: `Successfully received goods for PO ${selectedPo.id.substring(0,8)}.` });
      
      // Refresh
      await fetchActivePOs();
      setSelectedPo(null);
      setPoItems([]);
      
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: error.message || 'Failed to process receipt.' });
    } finally {
      setSubmitting(false);
    }
  };

  const getDiscrepancyStyle = (item) => {
    const receivedNow = item.receiving_now ? parseFloat(item.receiving_now) : 0;
    const remaining = parseFloat(item.quantity_ordered) - parseFloat(item.quantity_received);
    
    if (!item.receiving_now) return {};
    
    if (receivedNow > remaining) return { color: 'var(--danger-color)', fontWeight: 'bold' }; // Overshipment
    if (receivedNow < remaining && receivedNow > 0) return { color: 'var(--warning-color)', fontWeight: 'bold' }; // Undershipment
    return { color: 'var(--success-color)', fontWeight: 'bold' }; // Perfect match
  };

  if (loading && !selectedPo) return <div className="spinner mt-10 mx-auto"></div>;

  return (
    <div className="receive-goods-page">
      <div className="mb-6">
        <h2>Receive Goods</h2>
        <p className="text-gray-500">Log incoming deliveries against active Purchase Orders.</p>
      </div>

      <div className="card mb-6">
        <div className="form-group mb-0">
          <label className="form-label flex items-center gap-2"><Search size={16} /> Select Purchase Order</label>
          <select 
            className="form-select" 
            value={selectedPo?.id || ''} 
            onChange={(e) => loadPoDetails(e.target.value)}
          >
            <option value="">-- Choose an active PO --</option>
            {pos.map(po => (
              <option key={po.id} value={po.id}>
                PO {po.id.substring(0,8)} - {po.suppliers?.name} (Ordered: {po.date_ordered}) - {po.status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`} style={{ backgroundColor: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: message.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)' }}>
          {message.type === 'error' ? <AlertCircle size={20} className="mt-0.5" /> : <CheckCircle size={20} className="mt-0.5" />}
          <div>
            <h4 className="font-bold mb-1">{message.type === 'error' ? 'Error' : 'Success'}</h4>
            <p className="text-sm">{message.text}</p>
          </div>
        </div>
      )}

      {selectedPo && (
        <div className="card">
          <div className="flex justify-between items-start mb-6 pb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div>
              <h3 className="mb-1">Receiving: PO #{selectedPo.id.substring(0,8)}</h3>
              <p className="text-sm text-gray-500">Supplier: <strong className="text-gray-700">{selectedPo.suppliers?.name}</strong></p>
            </div>
            <StatusBadge status={selectedPo.status} />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="table-container mb-6">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-center">Ordered</th>
                    <th className="text-center">Prev. Received</th>
                    <th className="text-center">Pending</th>
                    <th style={{ width: '120px' }}>Receiving Now</th>
                    <th style={{ width: '130px' }}>Actual Unit Cost ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {poItems.map(item => {
                    const remaining = parseFloat(item.quantity_ordered) - parseFloat(item.quantity_received);
                    const isFullyReceived = remaining <= 0;
                    
                    return (
                      <tr key={item.id} className={isFullyReceived ? 'opacity-50 bg-gray-50' : ''}>
                        <td className="font-medium">{item.items?.name}</td>
                        <td className="text-center">{item.quantity_ordered}</td>
                        <td className="text-center">{item.quantity_received}</td>
                        <td className="text-center font-bold" style={{ color: remaining > 0 ? 'var(--primary-color)' : 'inherit' }}>
                          {remaining > 0 ? remaining : 0}
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="form-input text-center" 
                            placeholder="0"
                            value={item.receiving_now}
                            onChange={(e) => handleItemChange(item.id, 'receiving_now', e.target.value)}
                            min="0"
                            step="0.1"
                            disabled={isFullyReceived}
                            style={getDiscrepancyStyle(item)}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="form-input text-right" 
                            placeholder="0.00"
                            value={item.actual_cost}
                            onChange={(e) => handleItemChange(item.id, 'actual_cost', e.target.value)}
                            min="0"
                            step="0.01"
                            disabled={isFullyReceived}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Processing...' : <><Save size={18} /> Confirm Receipt</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ReceiveGoods;
