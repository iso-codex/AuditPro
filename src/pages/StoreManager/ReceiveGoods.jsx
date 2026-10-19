import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useReferenceData } from '../../context/ReferenceDataContext';
import { Save, AlertCircle, CheckCircle, Plus, Trash2, Camera } from 'lucide-react';
import { z } from 'zod';
import ReceiptUpload from '../../components/ReceiptUpload';

const receiptSchema = z.array(z.object({
  item_id: z.string().uuid("Invalid item selection"),
  quantity: z.number().int("Quantity must be a whole number in portions").positive("Quantity must be greater than 0"),
  unit_cost: z.number().nonnegative("Unit cost cannot be negative").default(0)
})).min(1, "Please complete at least one valid stock entry.");

const ReceiveGoods = () => {
  const { profile } = useAuth();
  const { items: availableItems, loading } = useReferenceData();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // State for dynamic rows
  const [receiptLines, setReceiptLines] = useState([
    { id: Date.now(), item_id: '', quantity: '', unit_cost: '' }
  ]);
  
  // State for receipt upload
  const [receiptUrl, setReceiptUrl] = useState('');

  // Using ReferenceDataContext for items

  const handleLineChange = (id, field, value) => {
    setReceiptLines(lines => 
      lines.map(line => line.id === id ? { ...line, [field]: value } : line)
    );
  };

  const addLine = () => {
    setReceiptLines([...receiptLines, { id: Date.now(), item_id: '', quantity: '', unit_cost: '' }]);
  };

  const removeLine = (id) => {
    setReceiptLines(lines => lines.filter(line => line.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!receiptUrl) {
      setMessage({ type: 'error', text: 'A receipt image is strictly required for every stock entry. Please attach a receipt.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: 'Processing...' });

    try {
      // 1. Zod Validation (Portions only)
      const rawPayload = receiptLines
        .filter(line => line.item_id && line.quantity)
        .map(line => ({
          item_id: line.item_id,
          quantity: parseInt(line.quantity, 10),
          unit_cost: line.unit_cost ? parseFloat(line.unit_cost) : 0
        }));

      const validatedPayload = receiptSchema.parse(rawPayload);

      for (const line of validatedPayload) {
        const qty = line.quantity;
        const cost = line.unit_cost;
        const itemObj = availableItems.find(i => i.id === line.item_id);
        
        if (!itemObj) continue;

        const { error: rpcError } = await supabase.rpc('receive_goods_rpc', {
          p_item_id: line.item_id,
          p_quantity: qty,
          p_unit_cost: cost,
          p_supplier_id: null,
          p_receipt_url: receiptUrl || null
        });

        if (rpcError) throw rpcError;
      }

      setMessage({ type: 'success', text: `Successfully added stock for ${validatedPayload.length} item(s).` });
      
      // Reset form
      setReceiptLines([{ id: Date.now(), item_id: '', quantity: '', unit_cost: '' }]);
      setReceiptUrl('');
      
    } catch (error) {
      console.error(error);
      if (error instanceof z.ZodError) {
        setMessage({ type: 'error', text: 'Validation Error: ' + error.errors.map(e => e.message).join(', ') });
      } else {
        setMessage({ type: 'error', text: error.message || 'Failed to process receipt.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && availableItems.length === 0) return <div className="spinner mt-10 mx-auto"></div>;

  return (
    <div className="receive-goods-page">
      <div className="mb-6">
        <h2>Receive Goods (Direct Stock Entry)</h2>
        <p className="text-gray-500">Manually add received items to the store inventory.</p>
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

      <div className="card">
        <div className="flex justify-between items-start mb-6 pb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <h3 className="mb-1">New Stock Receipt</h3>
            <p className="text-sm text-gray-500">
              Receiver: <strong className="text-gray-700">{profile?.full_name}</strong> | 
              Date: <strong className="text-gray-700">{new Date().toISOString().split('T')[0]}</strong>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="table-container mb-6">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Item</th>
                  <th style={{ width: '25%' }}>Quantity (Portions Only)</th>
                  <th style={{ width: '20%' }}>Unit Cost ($)</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {receiptLines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <select 
                        className="form-select"
                        value={line.item_id}
                        onChange={(e) => handleLineChange(line.id, 'item_id', e.target.value)}
                        required
                      >
                        <option value="">-- Select Item --</option>
                        {availableItems.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name} (Current Stock: {item.quantity_in_store})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          className="form-input" 
                          placeholder="Portions (whole number)"
                          value={line.quantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || (!val.includes('.') && parseInt(val, 10) >= 0)) {
                              handleLineChange(line.id, 'quantity', val);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === '.' || e.key === 'e' || e.key === '+' || e.key === '-') {
                              e.preventDefault();
                            }
                          }}
                          min="1"
                          step="1"
                          required
                        />
                        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">portions</span>
                      </div>
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className="form-input" 
                        placeholder="0.00 (Optional)"
                        value={line.unit_cost}
                        onChange={(e) => handleLineChange(line.id, 'unit_cost', e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {receiptLines.length > 1 && (
                        <button 
                          type="button"
                          className="btn btn-outline" 
                          style={{ padding: '0.4rem', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mb-6">
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={addLine}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Add Another Item
            </button>
          </div>
          
          <div className="mb-6">
            <ReceiptUpload
              value={receiptUrl}
              onChange={setReceiptUrl}
              folder="stock-entries"
              label="Attach Receipt Image"
              helpText="Take a photo or upload an image of the physical receipt for auditing. Required to submit."
              required={true}
            />
          </div>
          
          <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
            {!receiptUrl && (
              <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
                <AlertCircle size={14} /> Receipt image required to submit stock entry
              </span>
            )}
            <div className="ml-auto">
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={submitting || !receiptUrl}
                title={!receiptUrl ? 'Attach a receipt to enable submission' : 'Add Stock'}
              >
                {submitting ? 'Processing...' : <><Save size={18} /> Add Stock</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiveGoods;
