import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Settings, Save, Search } from 'lucide-react';

const ThresholdManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  
  const [thresholds, setThresholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDeptId) {
      fetchThresholds();
    }
  }, [selectedDeptId]);

  const fetchDepartments = async () => {
    setLoading(true);
    const { data } = await supabase.from('departments').select('*').order('name');
    
    // Add central store (NULL department)
    const allDepts = [{ id: 'central', name: 'Central Store (Main)' }, ...(data || [])];
    setDepartments(allDepts);
    setSelectedDeptId('central');
    setLoading(false);
  };

  const fetchThresholds = async () => {
    setLoading(true);
    const deptId = selectedDeptId === 'central' ? null : selectedDeptId;
    
    // Fetch all consumable items
    const { data: items } = await supabase
      .from('items')
      .select('id, name, category, unit')
      .eq('is_consumable', true)
      .order('name');
      
    // Fetch existing thresholds
    let query = supabase.from('department_thresholds').select('*');
    if (deptId === null) {
      query = query.is('department_id', null);
    } else {
      query = query.eq('department_id', deptId);
    }
    
    const { data: existingData } = await query;
    const existingMap = {};
    if (existingData) {
      existingData.forEach(t => {
        existingMap[t.item_id] = t;
      });
    }
    
    const combined = (items || []).map(item => ({
      item,
      id: existingMap[item.id]?.id || null,
      low_threshold: existingMap[item.id]?.low_threshold ?? 0,
      high_threshold: existingMap[item.id]?.high_threshold ?? '',
      is_dirty: false
    }));

    setThresholds(combined);
    setLoading(false);
  };

  const handleValChange = (index, field, value) => {
    const updated = [...thresholds];
    updated[index][field] = value === '' ? '' : parseFloat(value);
    updated[index].is_dirty = true;
    setThresholds(updated);
  };

  const saveThresholds = async () => {
    const dirty = thresholds.filter(t => t.is_dirty);
    if (dirty.length === 0) return;
    
    setSaving(true);
    const deptId = selectedDeptId === 'central' ? null : selectedDeptId;
    
    try {
      for (const t of dirty) {
        const payload = {
          department_id: deptId,
          item_id: t.item.id,
          low_threshold: t.low_threshold || 0,
          high_threshold: t.high_threshold === '' ? null : t.high_threshold
        };
        
        if (t.id) {
          // Update
          await supabase.from('department_thresholds').update(payload).eq('id', t.id);
        } else {
          // Insert
          await supabase.from('department_thresholds').insert([payload]);
        }
      }
      alert('Thresholds saved successfully.');
      await fetchThresholds();
    } catch (error) {
      alert('Error saving thresholds: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = thresholds.filter(t => t.item.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-content">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Threshold Management</h2>
          <p className="text-gray-500">Configure low (reorder) and high (overstock) limits per department.</p>
        </div>
        <div className="flex gap-4">
          <select 
            className="form-select"
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
          >
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button 
            className="btn btn-primary" 
            onClick={saveThresholds} 
            disabled={saving || !thresholds.some(t => t.is_dirty)}
          >
            <Save size={18} className="mr-2" /> 
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50" style={{ backgroundColor: 'var(--bg-color)' }}>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search items..." 
              className="form-input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <Settings size={16} /> Par Levels Configuration
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center"><div className="spinner"></div></div>
        ) : (
          <div className="overflow-x-auto max-h-[600px]">
            <table className="data-table w-full">
              <thead className="bg-white sticky top-0 shadow-sm z-10">
                <tr>
                  <th>Item Details</th>
                  <th>Category</th>
                  <th className="text-right">Low Threshold (Reorder)</th>
                  <th className="text-right">High Threshold (Max)</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, idx) => {
                  const originalIdx = thresholds.findIndex(th => th.item.id === t.item.id);
                  return (
                    <tr key={t.item.id} className={t.is_dirty ? 'bg-indigo-50/30' : ''}>
                      <td>
                        <div className="font-medium text-gray-900">{t.item.name}</div>
                        <div className="text-xs text-gray-500">{t.item.unit}</div>
                      </td>
                      <td>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{t.item.category}</span>
                      </td>
                      <td className="text-right">
                        <input 
                          type="number" 
                          className="form-input w-24 text-right inline-block"
                          value={t.low_threshold}
                          onChange={(e) => handleValChange(originalIdx, 'low_threshold', e.target.value)}
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="text-right">
                        <input 
                          type="number" 
                          className="form-input w-24 text-right inline-block"
                          value={t.high_threshold}
                          onChange={(e) => handleValChange(originalIdx, 'high_threshold', e.target.value)}
                          min="0"
                          step="0.01"
                          placeholder="No limit"
                        />
                      </td>
                      <td className="text-center">
                        {t.is_dirty ? (
                          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Unsaved</span>
                        ) : (
                          <span className="text-xs text-gray-400">Saved</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThresholdManagement;
