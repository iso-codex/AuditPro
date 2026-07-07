import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Edit2, Trash2, Save, X, RefreshCw } from 'lucide-react';

const CATEGORIES = ['Food', 'Beverage', 'Dry Goods', 'Cleaning', 'Other'];
const UNITS = ['kg', 'litres', 'pieces', 'bags', 'cartons', 'boxes'];

const CatalogManagement = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', category: 'Food', unit: 'pieces', low_stock_threshold: 10 });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('items').select('*').order('name');
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      alert('Error fetching items: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!editForm.name) return alert('Name is required');
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('items')
        .update({
          name: editForm.name,
          category: editForm.category,
          unit: editForm.unit,
          low_stock_threshold: editForm.low_stock_threshold
        })
        .eq('id', editingId);

      if (error) throw error;
      
      setItems(prev => prev.map(item => item.id === editingId ? { ...item, ...editForm } : item));
      setEditingId(null);
    } catch (error) {
      alert('Error saving item: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!addForm.name) return alert('Name is required');
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .insert([addForm])
        .select();

      if (error) throw error;
      
      if (data) {
        setItems([...items, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setIsAdding(false);
      setAddForm({ name: '', category: 'Food', unit: 'pieces', low_stock_threshold: 10 });
    } catch (error) {
      alert('Error adding item: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete ${name}? This will fail if it's used in requisitions.`)) return;
    
    try {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      alert('Error deleting item: ' + error.message);
    }
  };

  return (
    <div className="admin-page">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>Catalog Management</h2>
          <p>Manage all items available in the store.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)} disabled={isAdding}>
            <Plus size={18} /> Add Item
          </button>
          <button className="btn btn-outline" onClick={fetchItems} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spinner border-0' : ''} />
          </button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Threshold</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr style={{ backgroundColor: 'rgba(59,130,246,0.05)' }}>
                <td>
                  <input className="form-input p-1" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="Item name" />
                </td>
                <td>
                  <select className="form-select p-1" value={addForm.category} onChange={e => setAddForm({...addForm, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <select className="form-select p-1" value={addForm.unit} onChange={e => setAddForm({...addForm, unit: e.target.value})}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td>
                  <input type="number" className="form-input p-1" style={{width: '60px'}} value={addForm.low_stock_threshold} onChange={e => setAddForm({...addForm, low_stock_threshold: e.target.value})} />
                </td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-primary p-1" onClick={handleAddItem} disabled={isSaving}>
                      {isSaving ? <div className="spinner border-0" style={{width:'16px', height:'16px'}}></div> : <Save size={16} />}
                    </button>
                    <button className="btn btn-outline p-1" onClick={() => setIsAdding(false)} disabled={isSaving}>
                      <X size={16} className="text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {loading && items.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-4">
                  <div className="spinner mx-auto"></div>
                </td>
              </tr>
            ) : items.map(item => (
              <tr key={item.id}>
                {editingId === item.id ? (
                  <>
                    <td><input className="form-input p-1" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                    <td>
                      <select className="form-select p-1" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="form-select p-1" value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td><input type="number" className="form-input p-1" style={{width: '60px'}} value={editForm.low_stock_threshold} onChange={e => setEditForm({...editForm, low_stock_threshold: e.target.value})} /></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-primary p-1" onClick={handleSaveEdit} disabled={isSaving}><Save size={16} /></button>
                        <button className="btn btn-outline p-1" onClick={handleCancelEdit} disabled={isSaving}><X size={16} className="text-red-500" /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="font-medium">{item.name}</td>
                    <td>{item.category}</td>
                    <td>{item.unit}</td>
                    <td>{item.low_stock_threshold}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-outline p-1 text-blue-500 border-0 hover:bg-blue-50" onClick={() => handleEdit(item)}><Edit2 size={16} /></button>
                        <button className="btn btn-outline p-1 text-red-500 border-0 hover:bg-red-50" onClick={() => handleDelete(item.id, item.name)}><Trash2 size={16} /></button>
                      </div>
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

export default CatalogManagement;
