import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useReferenceData } from '../../context/ReferenceDataContext';
import { Save, AlertCircle, CheckCircle, Plus, Trash2, Camera } from 'lucide-react';
import { z } from 'zod';

const receiptSchema = z.array(z.object({
  item_id: z.string().uuid("Invalid item selection"),
  quantity: z.number().positive("Quantity must be greater than 0"),
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
  
  // State for file upload
  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReceiptFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setReceiptFile(null);
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setSubmitting(true);
    setMessage({ type: '', text: 'Processing...' });

    try {
      // 1. Zod Validation
      const rawPayload = receiptLines
        .filter(line => line.item_id && line.quantity)
        .map(line => ({
          item_id: line.item_id,
          quantity: parseFloat(line.quantity),
          unit_cost: line.unit_cost ? parseFloat(line.unit_cost) : 0
        }));

      const validatedPayload = receiptSchema.parse(rawPayload);
      let uploadedReceiptUrl = null;
      
      if (receiptFile) {
        setMessage({ type: '', text: 'Uploading receipt image...' });
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${profile.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, receiptFile);
          
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);
          
        uploadedReceiptUrl = publicUrlData.publicUrl;
      }

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
          p_receipt_url: uploadedReceiptUrl
        });

        if (rpcError) throw rpcError;
      }

      setMessage({ type: 'success', text: `Successfully added stock for ${validatedPayload.length} item(s).` });
      
      // Reset form
      setReceiptLines([{ id: Date.now(), item_id: '', quantity: '', unit_cost: '' }]);
      setReceiptFile(null);
      setPreviewUrl(null);
      
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
                  <th style={{ width: '20%' }}>Quantity Received</th>
                  <th style={{ width: '25%' }}>Unit Cost ($)</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {receiptLines.map((line, index) => (
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
                      <input 
                        type="number" 
                        className="form-input" 
                        placeholder="0"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(line.id, 'quantity', e.target.value)}
                        min="0.1"
                        step="0.1"
                        required
                      />
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
          
          <div className="mb-6 p-4 rounded-xl border bg-gray-50" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
            <h4 className="mb-3 flex items-center gap-2 font-semibold">
              <Camera size={18} /> Attach Receipt
            </h4>
            <div className="flex items-start gap-4 flex-col sm:flex-row">
              <div className="flex-1 w-full">
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="form-input w-full bg-white" 
                  onChange={handleFileChange}
                />
                <p className="text-xs text-gray-500 mt-2">Take a photo or upload an image of the physical receipt for auditing.</p>
              </div>
              {previewUrl && (
                <div className="w-24 h-24 rounded-lg border overflow-hidden flex-shrink-0 bg-white" style={{ borderColor: 'var(--border-color)' }}>
                  <img src={previewUrl} alt="Receipt preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Processing...' : <><Save size={18} /> Add Stock</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiveGoods;
