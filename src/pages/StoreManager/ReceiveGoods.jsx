import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Save, AlertCircle, CheckCircle, Plus, Trash2, Camera } from 'lucide-react';

const ReceiveGoods = () => {
  const { profile } = useAuth();
  const [availableItems, setAvailableItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // State for dynamic rows
  const [receiptLines, setReceiptLines] = useState([
    { id: Date.now(), item_id: '', quantity: '', unit_cost: '' }
  ]);
  
  // State for file upload
  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setAvailableItems(data || []);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Failed to load catalog items.' });
    } finally {
      setLoading(false);
    }
  };

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
    
    // Filter out empty rows
    const validLines = receiptLines.filter(line => line.item_id && parseFloat(line.quantity) > 0);
    
    if (validLines.length === 0) {
      setMessage({ type: 'error', text: 'Please complete at least one valid stock entry.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: 'Processing...' });

    try {
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

      const receiptRecords = [];
      let auditLogNotes = `Ad-hoc Stock Receipt by ${profile.full_name}: `;

      for (const line of validLines) {
        const qty = parseFloat(line.quantity);
        const cost = line.unit_cost ? parseFloat(line.unit_cost) : 0;
        const itemObj = availableItems.find(i => i.id === line.item_id);
        
        if (!itemObj) continue;

        // 1. Prepare Goods Receipt Record
        receiptRecords.push({
          item_id: line.item_id,
          quantity_received: qty,
          received_by: profile.id,
          date_received: new Date().toISOString().split('T')[0],
          unit_cost: cost,
          receipt_url: uploadedReceiptUrl
        });

        // 2. Update Global Item Stock & Latest Cost
        const newStock = parseFloat(itemObj.quantity_in_store || 0) + qty;
        await supabase.from('items')
          .update({ quantity_in_store: newStock, unit_cost: cost || itemObj.unit_cost })
          .eq('id', line.item_id);
          
        auditLogNotes += `${qty}x ${itemObj.name}, `;
      }

      // 3. Insert Goods Receipts
      if (receiptRecords.length > 0) {
        await supabase.from('goods_receipts').insert(receiptRecords);
      }

      // 4. Audit Log
      await supabase.from('audit_log').insert([{
        action_type: 'Received',
        actor_id: profile.id,
        notes: auditLogNotes.slice(0, -2) // remove trailing comma
      }]);

      setMessage({ type: 'success', text: `Successfully added stock for ${validLines.length} item(s).` });
      
      // Reset form
      setReceiptLines([{ id: Date.now(), item_id: '', quantity: '', unit_cost: '' }]);
      setReceiptFile(null);
      setPreviewUrl(null);
      
      // Refresh items to get updated stock
      await fetchItems();
      
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: error.message || 'Failed to process receipt.' });
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
