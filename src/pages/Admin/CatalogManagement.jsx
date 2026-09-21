import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Edit2, Trash2, Save, X, RefreshCw, ChevronLeft, Package, FolderPlus, ArrowRight, Upload, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import './CatalogManagement.css';

const UNITS = ['kg', 'litres', 'pieces', 'bags', 'cartons', 'boxes'];

const CatalogManagement = () => {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Category Add State
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Item Edit State
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Item Add State
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', unit: 'pieces' });

  // Bulk Upload State
  const fileInputRef = useRef(null);
  const [previewData, setPreviewData] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catsRes, itemsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('items').select('*').order('name')
      ]);
      
      if (catsRes.error && catsRes.error.code !== '42P01') {
        throw catsRes.error;
      }
      
      const fetchedCats = catsRes.data || [];
      if (fetchedCats.length === 0) {
        const uniqueCatNames = [...new Set((itemsRes.data || []).map(i => i.category))].filter(Boolean);
        setCategories(uniqueCatNames.map(name => ({ id: name, name })));
      } else {
        setCategories(fetchedCats);
      }
      
      setItems(itemsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return alert('Category name is required');
    setIsSaving(true);
    try {
      const { data, error } = await supabase.from('categories').insert([{ name: newCategoryName.trim() }]).select();
      if (error) {
        if (error.code === '42P01') {
           const newCat = { id: crypto.randomUUID(), name: newCategoryName.trim() };
           setCategories([...categories, newCat].sort((a, b) => a.name.localeCompare(b.name)));
           setIsAddingCategory(false);
           setNewCategoryName('');
           return;
        }
        throw error;
      }
      if (data) {
        setCategories([...categories, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setIsAddingCategory(false);
      setNewCategoryName('');
    } catch (error) {
      alert('Error adding category: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!addForm.name) return alert('Name is required');
    setIsSaving(true);
    try {
      const newItem = { ...addForm, category: selectedCategory.name };
      const { data, error } = await supabase.from('items').insert([newItem]).select();
      if (error) throw error;
      if (data) {
        setItems([...items, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setIsAdding(false);
      setAddForm({ name: '', unit: 'pieces' });
    } catch (error) {
      alert('Error adding item: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ ...item });
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
          unit: editForm.unit
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

  const handleDeleteItem = async (id, name) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      alert('Error deleting item: ' + error.message);
    }
  };

  // --- BULK UPLOAD LOGIC ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        
        // Map data based on expected columns: Category, Name, Unit, Quantity
        const mappedData = data.map((row, idx) => {
          const getVal = (keys) => {
            const key = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim()));
            return key ? String(row[key]).trim() : '';
          };
          
          return {
            _rowId: idx + 1,
            category: getVal(['category', 'cat']),
            name: getVal(['name', 'item', 'item name', 'product']),
            unit: getVal(['unit', 'uom', 'measure']) || 'pieces',
            quantity: parseFloat(getVal(['quantity', 'qty', 'stock'])) || 0
          };
        });
        
        // Filter out empty rows
        const validData = mappedData.filter(r => r.category || r.name);
        setPreviewData(validData);
        setShowPreviewModal(true);
      } catch (err) {
        alert('Error reading Excel file: ' + err.message);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const confirmUpload = async () => {
    const invalid = previewData.filter(r => !r.name || !r.category);
    if (invalid.length > 0) {
      return alert(`Found ${invalid.length} row(s) missing a Name or Category. Please fix the file and try again.`);
    }

    setIsUploading(true);
    try {
      // 1. Process Categories (Auto-create missing)
      const uniqueCats = [...new Set(previewData.map(r => r.category))];
      const existingCats = categories.map(c => c.name);
      const newCats = uniqueCats.filter(c => !existingCats.includes(c));
      
      if (newCats.length > 0) {
        const { error: catError } = await supabase
          .from('categories')
          .insert(newCats.map(name => ({ name })));
        if (catError && catError.code !== '42P01') throw catError;
      }

      // 2. Process Items
      const itemsToInsert = previewData.map(r => ({
        name: r.name,
        category: r.category,
        unit: r.unit,
        quantity_in_store: r.quantity,
        is_consumable: true // Default for catalog uploads
      }));

      const { error: itemError } = await supabase
        .from('items')
        .insert(itemsToInsert);
        
      if (itemError) throw itemError;

      alert(`Successfully uploaded ${itemsToInsert.length} items!`);
      setShowPreviewModal(false);
      setPreviewData([]);
      await fetchData(); 
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const categoryItems = selectedCategory 
    ? items.filter(item => item.category === selectedCategory.name)
    : [];

  const getItemCount = (categoryName) => {
    return items.filter(item => item.category === categoryName).length;
  };

  const renderCategoryGrid = () => (
    <div className="catalog-grid">
      {categories.map(cat => (
        <div 
          key={cat.id} 
          onClick={() => setSelectedCategory(cat)}
          className="category-card group"
        >
          <div className="top-right-decoration"></div>
          
          <div className="category-card-header">
            <div className="category-icon-wrapper">
              <Package size={24} />
            </div>
            <span className="category-count">
              {getItemCount(cat.name)} Items
            </span>
          </div>
          <div className="category-card-body">
            <h3 className="category-card-title">{cat.name}</h3>
            <div className="category-card-action">
              View Products <ArrowRight size={16} className="ml-1" />
            </div>
          </div>
        </div>
      ))}
      
      {isAddingCategory ? (
        <div className="add-category-form-card">
          <input 
            autoFocus
            type="text" 
            placeholder="Category Name" 
            className="form-input mb-4"
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
          />
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" style={{padding: '0.5rem'}} onClick={handleAddCategory} disabled={isSaving}>
              {isSaving ? <div className="spinner border-0" style={{width:'16px', height:'16px'}}></div> : 'Save'}
            </button>
            <button className="btn btn-outline" style={{padding: '0.5rem 1rem'}} onClick={() => setIsAddingCategory(false)} disabled={isSaving}>
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div 
          onClick={() => setIsAddingCategory(true)}
          className="add-category-card"
        >
          <div className="add-category-icon">
             <FolderPlus size={28} />
          </div>
          <span style={{fontWeight: 600}}>Add Category</span>
        </div>
      )}
    </div>
  );

  const renderProductList = () => (
    <div className="fade-enter">
      <div className="category-header-bar">
        <button 
          onClick={() => setSelectedCategory(null)}
          className="back-button"
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="category-header-title">
            <h2 style={{ margin: 0 }}>{selectedCategory.name}</h2>
            <span className="category-badge">Category</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>Manage products in this category</p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)} disabled={isAdding}>
            <Plus size={18} /> Add Product
          </button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{width: '40%'}}>Name</th>
              <th>Unit</th>
              <th style={{textAlign: 'right'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                <td>
                  <input autoFocus className="form-input" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="Product name" />
                </td>
                <td>
                  <select className="form-select" value={addForm.unit} onChange={e => setAddForm({...addForm, unit: e.target.value})}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td style={{textAlign: 'right'}}>
                  <div className="flex gap-2" style={{justifyContent: 'flex-end'}}>
                    <button className="btn btn-primary" style={{padding: '0.5rem'}} onClick={handleAddItem} disabled={isSaving}>
                      {isSaving ? <div className="spinner border-0" style={{width:'16px', height:'16px'}}></div> : <Save size={16} />}
                    </button>
                    <button className="btn btn-outline" style={{padding: '0.5rem'}} onClick={() => setIsAdding(false)} disabled={isSaving}>
                      <X size={16} style={{color: 'var(--danger-color)'}} />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {categoryItems.length === 0 && !isAdding ? (
              <tr>
                <td colSpan="4">
                  <div className="empty-state">
                    <div className="empty-state-icon">
                       <Package size={48} />
                    </div>
                    <p style={{fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem'}}>No products found</p>
                    <p>Click 'Add Product' to create one in this category.</p>
                  </div>
                </td>
              </tr>
            ) : categoryItems.map(item => (
              <tr key={item.id}>
                {editingId === item.id ? (
                  <>
                    <td><input className="form-input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                    <td>
                      <select className="form-select" value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={{textAlign: 'right'}}>
                      <div className="flex gap-2" style={{justifyContent: 'flex-end'}}>
                        <button className="btn btn-primary" style={{padding: '0.5rem'}} onClick={handleSaveEdit} disabled={isSaving}><Save size={16} /></button>
                        <button className="btn btn-outline" style={{padding: '0.5rem'}} onClick={() => setEditingId(null)} disabled={isSaving}><X size={16} style={{color: 'var(--danger-color)'}} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{fontWeight: 500}}>{item.name}</td>
                    <td>
                      <span className="badge" style={{backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)'}}>{item.unit}</span>
                    </td>
                    <td style={{textAlign: 'right'}}>
                      <div className="flex gap-2" style={{justifyContent: 'flex-end'}}>
                        <button className="btn btn-outline" style={{padding: '0.5rem', color: 'var(--accent-color)'}} onClick={() => handleEdit(item)}>
                          <Edit2 size={16} />
                        </button>
                        <button className="btn btn-outline" style={{padding: '0.5rem', color: 'var(--danger-color)'}} onClick={() => handleDeleteItem(item.id, item.name)}>
                          <Trash2 size={16} />
                        </button>
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

  return (
    <div className="admin-page" style={{padding: '2rem 0'}}>
      {!selectedCategory && (
        <div className="flex justify-between items-center mb-6" style={{borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem'}}>
          <div>
            <h2>Catalog Management</h2>
            <p>Organize and manage your store's categories and products.</p>
          </div>
          <div className="flex gap-3">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
            />
            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              <Upload size={18} />
              Import Excel
            </button>
            <button className="btn btn-outline" onClick={fetchData} disabled={loading}>
              <RefreshCw size={18} className={loading ? 'spinner border-0' : ''} />
              Refresh
            </button>
          </div>
        </div>
      )}

      {loading && items.length === 0 && categories.length === 0 ? (
        <div style={{display: 'flex', justifyContent: 'center', padding: '4rem 0'}}>
          <div className="spinner"></div>
        </div>
      ) : (
        selectedCategory ? renderProductList() : renderCategoryGrid()
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <>
          <div className="side-panel-overlay" onClick={() => !isUploading && setShowPreviewModal(false)}></div>
          <div className="side-panel flex flex-col" style={{ maxWidth: '600px' }}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Upload size={24} /> Import Preview
              </h2>
              <button className="btn btn-outline p-2 rounded-full" onClick={() => setShowPreviewModal(false)} disabled={isUploading}>
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4 text-sm text-gray-600">
              <p>Review the {previewData.length} items parsed from your Excel file.</p>
              <p className="mt-1 flex items-center gap-1 text-orange-600">
                <AlertCircle size={14} /> Missing categories will be auto-created. Opening stock quantities will be applied directly.
              </p>
            </div>

            <div className="flex-1 overflow-auto border rounded mb-6">
              <table style={{ width: '100%', fontSize: '0.875rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-color)', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Category</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Item Name</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Unit</th>
                    <th style={{ padding: '0.5rem 1rem', textAlign: 'right', borderBottom: '1px solid var(--border-color)' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => {
                    const hasError = !row.name || !row.category;
                    return (
                      <tr key={idx} style={{ backgroundColor: hasError ? 'rgba(239, 68, 68, 0.1)' : 'transparent', borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.5rem 1rem', color: row.category ? 'inherit' : 'var(--danger-color)' }}>{row.category || 'Missing!'}</td>
                        <td style={{ padding: '0.5rem 1rem', color: row.name ? 'inherit' : 'var(--danger-color)' }}>{row.name || 'Missing!'}</td>
                        <td style={{ padding: '0.5rem 1rem' }}>{row.unit}</td>
                        <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>{row.quantity}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button 
              className="btn btn-primary w-full" 
              onClick={confirmUpload} 
              disabled={isUploading || previewData.filter(r => !r.name || !r.category).length > 0}
            >
              {isUploading ? <div className="spinner border-0" style={{ width: 18, height: 18 }}></div> : <Save size={18} />}
              Confirm Upload
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CatalogManagement;
