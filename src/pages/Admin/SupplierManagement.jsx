import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Edit2, Save, X, Plus, AlertCircle } from 'lucide-react';

const SupplierManagement = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setMessage({ type: 'error', text: 'Failed to load suppliers.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (supplier) => {
    setEditingId(supplier.id);
    setFormData(supplier);
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({});
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    
    try {
      if (isAdding) {
        const { error } = await supabase.from('suppliers').insert([{
          name: formData.name,
          contact: formData.contact,
          email: formData.email,
          phone: formData.phone,
          lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : null,
          reliability_score: formData.reliability_score ? parseFloat(formData.reliability_score) : null
        }]);
        if (error) throw error;
        setMessage({ type: 'success', text: 'Supplier added successfully.' });
      } else {
        const { error } = await supabase.from('suppliers').update({
          name: formData.name,
          contact: formData.contact,
          email: formData.email,
          phone: formData.phone,
          lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : null,
          reliability_score: formData.reliability_score ? parseFloat(formData.reliability_score) : null
        }).eq('id', editingId);
        if (error) throw error;
        setMessage({ type: 'success', text: 'Supplier updated successfully.' });
      }
      
      await fetchSuppliers();
      setEditingId(null);
      setIsAdding(false);
    } catch (error) {
      console.error('Error saving supplier:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="spinner mt-10 mx-auto"></div>;

  return (
    <div className="supplier-management">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>Supplier Management</h2>
          <p className="text-gray-500">Manage vendors, contact information, and performance ratings.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setIsAdding(true); setFormData({}); setEditingId('new'); }}>
          <Plus size={18} /> Add Supplier
        </button>
      </div>

      {message.text && (
        <div className={`mb-4 p-3 rounded flex items-center gap-2 ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          <AlertCircle size={18} />
          <span>{message.text}</span>
        </div>
      )}

      <div className="table-container card">
        <table>
          <thead>
            <tr>
              <th>Supplier Name</th>
              <th>Contact Person</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Lead Time (Days)</th>
              <th>Reliability (0-100)</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isAdding && editingId === 'new' && (
              <tr>
                <td><input className="form-input" name="name" value={formData.name || ''} onChange={handleChange} placeholder="Company Name" /></td>
                <td><input className="form-input" name="contact" value={formData.contact || ''} onChange={handleChange} placeholder="Contact Person" /></td>
                <td><input className="form-input" name="email" value={formData.email || ''} onChange={handleChange} placeholder="Email" /></td>
                <td><input className="form-input" name="phone" value={formData.phone || ''} onChange={handleChange} placeholder="Phone" /></td>
                <td><input className="form-input" type="number" name="lead_time_days" value={formData.lead_time_days || ''} onChange={handleChange} /></td>
                <td><input className="form-input" type="number" step="0.1" name="reliability_score" value={formData.reliability_score || ''} onChange={handleChange} /></td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem' }} onClick={handleSave} disabled={submitting}><Save size={16} /></button>
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem' }} onClick={handleCancel}><X size={16} /></button>
                  </div>
                </td>
              </tr>
            )}
            
            {suppliers.map(supplier => (
              <tr key={supplier.id}>
                {editingId === supplier.id ? (
                  <>
                    <td><input className="form-input" name="name" value={formData.name || ''} onChange={handleChange} /></td>
                    <td><input className="form-input" name="contact" value={formData.contact || ''} onChange={handleChange} /></td>
                    <td><input className="form-input" name="email" value={formData.email || ''} onChange={handleChange} /></td>
                    <td><input className="form-input" name="phone" value={formData.phone || ''} onChange={handleChange} /></td>
                    <td><input className="form-input" type="number" name="lead_time_days" value={formData.lead_time_days || ''} onChange={handleChange} /></td>
                    <td><input className="form-input" type="number" step="0.1" name="reliability_score" value={formData.reliability_score || ''} onChange={handleChange} /></td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem' }} onClick={handleSave} disabled={submitting}><Save size={16} /></button>
                        <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem' }} onClick={handleCancel}><X size={16} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="font-medium">{supplier.name}</td>
                    <td>{supplier.contact || '-'}</td>
                    <td>{supplier.email || '-'}</td>
                    <td>{supplier.phone || '-'}</td>
                    <td>{supplier.lead_time_days ? `${supplier.lead_time_days} days` : '-'}</td>
                    <td>
                      {supplier.reliability_score ? (
                        <div className="flex items-center gap-2">
                          <div style={{ width: '50px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${supplier.reliability_score}%`, height: '100%', backgroundColor: supplier.reliability_score >= 80 ? 'var(--success-color)' : supplier.reliability_score >= 50 ? 'var(--warning-color)' : 'var(--danger-color)' }}></div>
                          </div>
                          <span className="text-sm">{supplier.reliability_score}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="text-right">
                      <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleEdit(supplier)}>
                        <Edit2 size={16} /> Edit
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupplierManagement;
