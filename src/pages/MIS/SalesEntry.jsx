import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useReferenceData } from '../../context/ReferenceDataContext';
import { DollarSign, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';

const salesSchema = z.array(z.object({
  item_id: z.string().uuid("Invalid item selection"),
  qty: z.number().positive("Quantity must be greater than 0")
})).min(1, "Please add at least one valid item with a quantity greater than 0.");

const DEPARTMENTS = ['Kitchen', 'Bar', 'Byte'];

const SalesEntry = () => {
  const { profile } = useAuth();
  const { items, departments, loading } = useReferenceData();
  const [department, setDepartment] = useState('');
  
  useEffect(() => {
    if (departments.length > 0 && !department) {
      setDepartment(departments[0].name);
    }
  }, [departments]);

  
  const [salesLines, setSalesLines] = useState([{ id: Date.now(), item_id: '', quantity: '' }]);
  
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (items.length > 0 && salesLines[0].item_id === '') {
      setSalesLines([{ id: Date.now(), item_id: items[0].id, quantity: '' }]);
    }
  }, [items]);

  const addLine = () => {
    setSalesLines([...salesLines, { id: Date.now(), item_id: items[0]?.id || '', quantity: '' }]);
  };

  const removeLine = (id) => {
    if (salesLines.length === 1) return;
    setSalesLines(salesLines.filter(line => line.id !== id));
  };

  const updateLine = (id, field, value) => {
    setSalesLines(salesLines.map(line => line.id === id ? { ...line, [field]: value } : line));
  };

  const handleEntry = async (e) => {
    e.preventDefault();
    
    setSubmitting(true);
    setMessage('');
    
    try {
      // 1. Zod Validation
      const salesPayloadRaw = salesLines
        .filter(line => line.item_id && line.quantity)
        .map(line => ({
          item_id: line.item_id,
          qty: parseFloat(line.quantity)
        }));

      const salesPayload = salesSchema.parse(salesPayloadRaw);

      // 2. Department ID Lookup
      const deptData = departments.find(d => d.name === department);
      if (!deptData) throw new Error('Department not found');

      // 3. RPC Call
      const clientUuid = crypto.randomUUID();
      const { error: rpcError } = await supabase.rpc('process_sales_entry_rpc', {
        p_client_uuid: clientUuid,
        p_department_id: deptData.id,
        p_sales: salesPayload
      });

      if (rpcError) throw rpcError;

      setMessage(`Successfully logged sales for ${salesPayload.length} item(s) in ${department}.`);
      setSalesLines([{ id: Date.now(), item_id: items[0]?.id || '', quantity: '' }]);
    } catch (error) {
      console.error('Error entering sales:', error);
      
      // Check if it's a network error or generic fetch failure
      if (!navigator.onLine || error.message?.includes('fetch') || error.message?.includes('Failed to fetch') || error.code === 'TypeError') {
        try {
          const { enqueueOfflineSale } = await import('../../lib/offlineQueue');
          
          // Re-generate variables if needed, though they exist in scope
          const salesPayloadRaw = salesLines
            .filter(line => line.item_id && line.quantity)
            .map(line => ({ item_id: line.item_id, qty: parseFloat(line.quantity) }));
          
          const deptData = departments.find(d => d.name === department);
          
          await enqueueOfflineSale({
            id: crypto.randomUUID(), // client_uuid
            department_id: deptData.id,
            sales_payload: salesPayloadRaw
          });
          
          setMessage(`Network offline. Saved ${salesPayloadRaw.length} item(s) locally. Will sync when online.`);
          setSalesLines([{ id: Date.now(), item_id: items[0]?.id || '', quantity: '' }]);
          return;
        } catch (queueErr) {
          console.error("Failed to queue offline:", queueErr);
        }
      }

      if (error instanceof z.ZodError) {
        alert('Validation Error: ' + error.errors.map(e => e.message).join(', '));
      } else {
        alert('Failed to enter sales: ' + error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold mb-2">Sales Entry (MIS)</h2>
          <p className="text-gray-500">Log daily sales to deduct from department inventories.</p>
        </div>
        <div className="w-48">
          <label className="form-label text-sm text-gray-500">Department</label>
          <select 
            className="form-select w-full"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={submitting}
          >
            {departments.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        {message && <div className="bg-green-50 text-green-700 p-3 rounded mb-6 text-sm font-medium">{message}</div>}

        <form onSubmit={handleEntry}>
          
          <div className="mb-4">
            <div className="grid grid-cols-12 gap-4 mb-2 px-2">
              <div className="col-span-7"><label className="form-label mb-0 text-xs text-gray-500 uppercase tracking-wider font-semibold">Item</label></div>
              <div className="col-span-4"><label className="form-label mb-0 text-xs text-gray-500 uppercase tracking-wider font-semibold">Qty Sold</label></div>
              <div className="col-span-1"></div>
            </div>
            
            <div className="space-y-3">
              {salesLines.map((line, index) => (
                <div key={line.id} className="grid grid-cols-12 gap-4 items-center bg-gray-50 p-2 rounded-lg border border-gray-100" style={{ backgroundColor: 'var(--bg-color)' }}>
                  <div className="col-span-7">
                    <select 
                      className="form-select w-full border-gray-200"
                      value={line.item_id}
                      onChange={(e) => updateLine(line.id, 'item_id', e.target.value)}
                      required
                      disabled={loading || submitting}
                    >
                      {loading ? <option>Loading...</option> : items.map(item => (
                        <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="col-span-4">
                    <input 
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input w-full border-gray-200"
                      placeholder="0.00"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <button 
                      type="button" 
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      onClick={() => removeLine(line.id)}
                      disabled={salesLines.length === 1 || submitting}
                      title="Remove row"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={addLine}
              disabled={submitting}
            >
              <Plus size={18} /> Add Another Item
            </button>

            <button type="submit" className="btn btn-primary px-8" disabled={submitting}>
              {submitting ? <div className="spinner border-0" style={{ width: '16px', height: '16px' }}></div> : <DollarSign size={18} />}
              <span className="ml-2">Log Sales & Deduct</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalesEntry;
