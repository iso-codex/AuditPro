import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { 
  AlertTriangle, 
  Trash2, 
  Calendar, 
  Building2, 
  Layers, 
  Eye, 
  PlusCircle, 
  CheckCircle2, 
  RefreshCw, 
  Filter, 
  PackageMinus,
  FileText
} from 'lucide-react';
import ReceiptUpload from '../../components/ReceiptUpload';
import ReceiptViewerModal from '../../components/ReceiptViewerModal';

const STAGES = ['Before production', 'After production'];

const DamagesRegister = () => {
  const { profile } = useAuth();
  const isDeptStaff = profile?.role === 'department_staff';
  const isStoreRole = ['store_manager', 'store', 'admin', 'manager'].includes(profile?.role);

  // Form State
  const [locationType, setLocationType] = useState(isDeptStaff ? 'department' : 'store');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [stage, setStage] = useState('Before production');
  const [reason, setReason] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

  // Data State
  const [departments, setDepartments] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [deptItems, setDeptItems] = useState([]);
  const [damages, setDamages] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  // Filters for History Table
  const [filterLocation, setFilterLocation] = useState('All');
  const [filterStage, setFilterStage] = useState('All');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Load departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('id, name')
          .order('name');
        if (error) throw error;
        setDepartments(data || []);

        // Pre-select department if dept staff
        if (isDeptStaff) {
          if (profile?.department_id) {
            setSelectedDeptId(profile.department_id);
          } else if (profile?.department) {
            const found = data.find(d => d.name.toLowerCase() === profile.department.toLowerCase());
            if (found) setSelectedDeptId(found.id);
          }
        } else if (data.length > 0 && !selectedDeptId) {
          setSelectedDeptId(data[0].id);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
    };
    fetchDepartments();
  }, [profile, isDeptStaff]);

  // Load available stock items based on location
  const fetchAvailableItems = async () => {
    setLoadingItems(true);
    try {
      if (locationType === 'store') {
        const { data, error } = await supabase
          .from('items')
          .select('id, name, unit, quantity_in_store, unit_cost, category')
          .gt('quantity_in_store', 0)
          .order('name');
        if (error) throw error;
        setStoreItems(data || []);
      } else if (locationType === 'department' && selectedDeptId) {
        const { data, error } = await supabase
          .from('department_inventory')
          .select(`
            id,
            quantity,
            item_id,
            items (id, name, unit, unit_cost, category)
          `)
          .eq('department_id', selectedDeptId)
          .gt('quantity', 0);
        if (error) throw error;
        setDeptItems(data || []);
      }
    } catch (err) {
      console.error('Error fetching available items for damages:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    setSelectedItemId('');
    fetchAvailableItems();
  }, [locationType, selectedDeptId]);

  // Load damages history
  const fetchDamagesHistory = async () => {
    setLoadingHistory(true);
    try {
      let q = supabase
        .from('damages')
        .select(`
          id,
          quantity,
          location_type,
          stage,
          reason,
          receipt_url,
          recorded_at,
          items (id, name, unit, unit_cost),
          departments (id, name),
          profiles:recorded_by (full_name, role)
        `)
        .order('recorded_at', { ascending: false });

      if (isDeptStaff && selectedDeptId) {
        q = q.eq('department_id', selectedDeptId);
      }

      const { data, error } = await q;
      if (error) throw error;
      setDamages(data || []);
    } catch (err) {
      console.error('Error fetching damages history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchDamagesHistory();
  }, [selectedDeptId, isDeptStaff]);

  // Current selected item detail
  const currentItemInfo = useMemo(() => {
    if (!selectedItemId) return null;
    if (locationType === 'store') {
      const item = storeItems.find(i => i.id === selectedItemId);
      return item ? { name: item.name, unit: item.unit, available: item.quantity_in_store, unitCost: item.unit_cost } : null;
    } else {
      const row = deptItems.find(i => i.item_id === selectedItemId);
      return row ? { name: row.items?.name, unit: row.items?.unit, available: row.quantity, unitCost: row.items?.unit_cost } : null;
    }
  }, [selectedItemId, locationType, storeItems, deptItems]);

  // Form Submission
  const handleSubmitDamage = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const qtyNum = parseInt(quantity, 10);
    if (!qtyNum || qtyNum <= 0) {
      setFormError('Please enter a valid positive whole number of portions.');
      return;
    }

    if (!currentItemInfo || qtyNum > currentItemInfo.available) {
      setFormError(`Cannot write off ${qtyNum} portion(s). Only ${currentItemInfo?.available || 0} portions available in stock.`);
      return;
    }

    if (!receiptUrl || !receiptUrl.trim()) {
      setFormError('Photo evidence or damage write-off receipt image is strictly required.');
      return;
    }

    if (!reason || !reason.trim()) {
      setFormError('Please describe the cause of damage/spoilage.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('record_damage_rpc', {
        p_item_id: selectedItemId,
        p_quantity: qtyNum,
        p_location_type: locationType,
        p_department_id: locationType === 'department' ? selectedDeptId : null,
        p_stage: stage,
        p_reason: reason.trim(),
        p_receipt_url: receiptUrl.trim()
      });

      if (error) throw error;

      setFormSuccess(`Successfully written off ${qtyNum} portion(s) of ${data?.item_name || 'item'}. Stock balance updated!`);
      // Reset form fields
      setQuantity('');
      setReason('');
      setReceiptUrl('');
      setSelectedItemId('');

      // Refresh items and history
      await fetchAvailableItems();
      await fetchDamagesHistory();
    } catch (err) {
      console.error('Error submitting damage:', err);
      setFormError(err.message || 'Failed to record damage.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered list
  const filteredDamages = useMemo(() => {
    return damages.filter(d => {
      if (filterLocation !== 'All' && d.location_type !== filterLocation) return false;
      if (filterStage !== 'All' && d.stage !== filterStage) return false;
      return true;
    });
  }, [damages, filterLocation, filterStage]);

  // Metrics
  const summaryMetrics = useMemo(() => {
    const totalIncidents = damages.length;
    const totalPortions = damages.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
    const storeCount = damages.filter(d => d.location_type === 'store').length;
    const deptCount = damages.filter(d => d.location_type === 'department').length;
    return { totalIncidents, totalPortions, storeCount, deptCount };
  }, [damages]);

  return (
    <div className="damages-page pb-12">
      {/* Page Title */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h2>Damages & Spoilage Register</h2>
          <p className="text-gray-500">
            Record damaged, expired, or spoiled goods with whole-portion counts and photo proof.
          </p>
        </div>
        <button 
          className="btn btn-outline" 
          onClick={() => { fetchAvailableItems(); fetchDamagesHistory(); }}
          disabled={loadingItems || loadingHistory}
        >
          <RefreshCw size={18} className={(loadingItems || loadingHistory) ? 'spinner border-0' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card text-center py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Incidents</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{summaryMetrics.totalIncidents}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Portions Lost</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{summaryMetrics.totalPortions.toLocaleString()}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Store Incidents</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{summaryMetrics.storeCount}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dept Incidents</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{summaryMetrics.deptCount}</p>
        </div>
      </div>

      {/* Main Grid: Form + History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Record Damage Form */}
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <PackageMinus size={20} className="text-red-600" />
              <span>Record New Damage</span>
            </h3>

            {formSuccess && (
              <div className="p-3 mb-4 rounded bg-green-50 text-green-700 border border-green-200 text-sm flex items-start gap-2">
                <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            {formError && (
              <div className="p-3 mb-4 rounded bg-red-50 text-red-700 border border-red-200 text-sm flex items-start gap-2">
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitDamage} className="space-y-4">
              {/* Location Type */}
              {isStoreRole && (
                <div className="form-group">
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Damage Location
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`btn text-sm ${locationType === 'store' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setLocationType('store')}
                    >
                      Central Store
                    </button>
                    <button
                      type="button"
                      className={`btn text-sm ${locationType === 'department' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setLocationType('department')}
                    >
                      Department
                    </button>
                  </div>
                </div>
              )}

              {/* Department Selector (if department location) */}
              {locationType === 'department' && (
                <div className="form-group">
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Department
                  </label>
                  <select
                    className="form-select w-full"
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    disabled={isDeptStaff}
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Item Selector */}
              <div className="form-group">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Damaged Item
                </label>
                <select
                  className="form-select w-full"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  disabled={loadingItems}
                  required
                >
                  <option value="">-- Select Item with Stock --</option>
                  {locationType === 'store' ? (
                    storeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.quantity_in_store} {item.unit || 'portions'} in store)
                      </option>
                    ))
                  ) : (
                    deptItems.map((di) => (
                      <option key={di.item_id} value={di.item_id}>
                        {di.items?.name} ({di.quantity} {di.items?.unit || 'portions'} in dept)
                      </option>
                    ))
                  )}
                </select>
                {currentItemInfo && (
                  <p className="text-xs text-gray-500 mt-1">
                    Current stock available: <strong>{currentItemInfo.available} {currentItemInfo.unit || 'portions'}</strong>
                  </p>
                )}
              </div>

              {/* Quantity in Portions (Whole Numbers Only) */}
              <div className="form-group">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Quantity (Portions Only)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max={currentItemInfo ? currentItemInfo.available : 9999}
                  className="form-input w-full font-semibold"
                  placeholder="e.g. 5"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === '.' || e.key === 'e' || e.key === '-') e.preventDefault();
                  }}
                  required
                />
                <span className="text-xs text-gray-400 mt-1 block">
                  Only whole numbers in portions allowed. No decimals.
                </span>
              </div>

              {/* Stage: Before production vs After production */}
              <div className="form-group">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Production Stage
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STAGES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`btn text-xs py-2 ${stage === s ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setStage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div className="form-group">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Reason for Damage / Loss
                </label>
                <textarea
                  className="form-input w-full text-sm"
                  rows={2}
                  placeholder="e.g. Broken packaging during transport, freezer burn, or burnt during grilling..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              {/* Mandatory Photo / Receipt Upload */}
              <div className="form-group">
                <ReceiptUpload
                  label="Damage Photo / Disposal Proof (Mandatory)"
                  value={receiptUrl}
                  onChange={(url) => setReceiptUrl(url)}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary w-full mt-4"
                disabled={submitting || !receiptUrl || !selectedItemId || !quantity}
              >
                {submitting ? (
                  <>
                    <span className="spinner"></span>
                    <span>Recording Write-off...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Confirm Stock Write-off</span>
                  </>
                )}
              </button>

              {!receiptUrl && (
                <p className="text-xs text-amber-700 text-center font-medium">
                  ⚠️ Image proof is required before writing off stock.
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Recent Damages List */}
        <div className="lg:col-span-2">
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex flex-wrap justify-between items-center gap-3">
              <h3 className="text-base font-semibold text-gray-800" style={{ margin: 0 }}>
                Damages Log
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                {/* Location Filter */}
                <select
                  className="form-select text-xs py-1"
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                >
                  <option value="All">All Locations</option>
                  <option value="store">Central Store</option>
                  <option value="department">Departments</option>
                </select>

                {/* Stage Filter */}
                <select
                  className="form-select text-xs py-1"
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value)}
                >
                  <option value="All">All Stages</option>
                  <option value="Before production">Before production</option>
                  <option value="After production">After production</option>
                </select>
              </div>
            </div>

            <div className="table-container" style={{ margin: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th>Portions</th>
                    <th>Stage</th>
                    <th>Location</th>
                    <th>Reason</th>
                    <th>Reported By</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingHistory ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8">
                        <div className="spinner mx-auto mb-2"></div>
                        <span className="text-xs text-gray-500">Loading damage records...</span>
                      </td>
                    </tr>
                  ) : filteredDamages.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-gray-500">
                        No damage records found.
                      </td>
                    </tr>
                  ) : (
                    filteredDamages.map((dmg) => (
                      <tr key={dmg.id}>
                        <td>
                          <div className="text-xs font-medium text-gray-900">
                            {new Date(dmg.recorded_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(dmg.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="font-medium text-gray-900">
                          {dmg.items?.name || 'Unknown Item'}
                        </td>
                        <td>
                          <span className="badge badge-danger font-semibold">
                            -{dmg.quantity} {dmg.items?.unit || 'portions'}
                          </span>
                        </td>
                        <td>
                          <span
                            className="badge text-xs"
                            style={{
                              backgroundColor: dmg.stage === 'Before production' ? '#fef3c7' : '#f3e8ff',
                              color: dmg.stage === 'Before production' ? '#92400e' : '#6b21a8'
                            }}
                          >
                            {dmg.stage}
                          </span>
                        </td>
                        <td>
                          {dmg.location_type === 'store' ? (
                            <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                              Central Store
                            </span>
                          ) : (
                            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
                              {dmg.departments?.name || 'Dept'}
                            </span>
                          )}
                        </td>
                        <td className="text-xs text-gray-600 max-w-xs truncate" title={dmg.reason}>
                          {dmg.reason}
                        </td>
                        <td className="text-xs text-gray-700">
                          {dmg.profiles?.full_name || 'Staff'}
                        </td>
                        <td>
                          {dmg.receipt_url ? (
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              onClick={() => setSelectedReceipt(dmg.receipt_url)}
                            >
                              <Eye size={13} className="text-blue-600" />
                              <span>View</span>
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Viewer Modal */}
      <ReceiptViewerModal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        imageUrl={selectedReceipt}
        title="Damage Evidence Photo"
      />
    </div>
  );
};

export default DamagesRegister;
