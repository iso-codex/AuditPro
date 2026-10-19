import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Filter, Eye, RefreshCw, Calendar, Truck, Clock, ShieldCheck, X, ExternalLink } from 'lucide-react';
import { MANAGER_AUDITOR_VISIBLE_FORM_STATUSES, formatFormType } from '../../utils/procurementConstants';
import ProcurementFormTimeline from '../../components/ProcurementFormTimeline';

const ProcurementFormsReview = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [formTypeFilter, setFormTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected Detail Modal
  const [selectedForm, setSelectedForm] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchForms();
  }, [formTypeFilter, statusFilter, dateFrom, dateTo]);

  const fetchForms = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('procurement_forms')
        .select(`
          *,
          suppliers (name),
          profiles:created_by (full_name)
        `)
        .order('created_at', { ascending: false });

      // Manager and Auditor only see allowed statuses per the constant
      if (['manager', 'auditor'].includes(profile?.role)) {
        query = query.in('status', MANAGER_AUDITOR_VISIBLE_FORM_STATUSES);
      }

      if (formTypeFilter !== 'All') {
        query = query.eq('form_type', formTypeFilter);
      }

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      if (dateFrom) {
        query = query.gte('form_date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('form_date', dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      setForms(data || []);
    } catch (err) {
      console.error('Error fetching procurement forms:', err);
    } finally {
      setLoading(false);
    }
  };

  const openFormDetails = async (form) => {
    setSelectedForm(form);
    setLoadingDetail(true);
    try {
      const [itemsRes, historyRes] = await Promise.all([
        supabase
          .from('procurement_form_items')
          .select(`*, items (name, unit)`)
          .eq('form_id', form.id),
        supabase
          .from('procurement_form_history')
          .select(`*, profiles:changed_by (full_name)`)
          .eq('form_id', form.id)
          .order('created_at', { ascending: false })
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (historyRes.error) throw historyRes.error;

      setSelectedItems(itemsRes.data || []);
      setSelectedHistory(historyRes.data || []);
    } catch (err) {
      console.error('Error loading form detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const allowedStatuses = ['manager', 'auditor'].includes(profile?.role)
    ? MANAGER_AUDITOR_VISIBLE_FORM_STATUSES
    : ['All', 'Saved', 'Updated', 'Completed'];

  return (
    <div className="procurement-forms-review-page">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>Procurement Forms Review</h2>
          <p>
            {['manager', 'auditor'].includes(profile?.role)
              ? 'Read-only review of Saved and Updated Market and Frozen Goods forms.'
              : 'Review and audit procurement form submissions.'}
          </p>
        </div>
        <button className="btn btn-outline" onClick={fetchForms} disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spinner border-0' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div 
        className="card mb-6"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          backgroundColor: 'var(--surface-color)',
          border: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm font-semibold">Filter By:</span>
        </div>

        <div style={{ minWidth: '160px' }}>
          <select 
            className="form-select" 
            value={formTypeFilter} 
            onChange={(e) => setFormTypeFilter(e.target.value)}
          >
            <option value="All">All Form Types</option>
            <option value="market">Market Form</option>
            <option value="frozen_goods">Frozen Goods Form</option>
          </select>
        </div>

        <div style={{ minWidth: '150px' }}>
          <select 
            className="form-select" 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            {allowedStatuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label className="text-xs text-gray-500">From:</label>
          <input 
            type="date" 
            className="form-input py-1 text-sm" 
            value={dateFrom} 
            onChange={(e) => setDateFrom(e.target.value)} 
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label className="text-xs text-gray-500">To:</label>
          <input 
            type="date" 
            className="form-input py-1 text-sm" 
            value={dateTo} 
            onChange={(e) => setDateTo(e.target.value)} 
          />
        </div>
      </div>

      {/* Table List */}
      <div className="table-container">
        {loading ? (
          <div className="flex justify-center p-10"><div className="spinner"></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Form Type</th>
                <th>Status</th>
                <th>Supplier (If Frozen)</th>
                <th>Created By</th>
                <th>Created At (Local)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {forms.map(form => (
                <tr key={form.id}>
                  <td>{form.form_date}</td>
                  <td className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {form.form_type === 'frozen_goods' ? <Truck size={15} className="text-blue-500" /> : <Calendar size={15} className="text-green-500" />}
                      {formatFormType(form.form_type)}
                    </span>
                  </td>
                  <td>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      form.status === 'Completed' ? 'bg-purple-100 text-purple-800' :
                      form.status === 'Updated' ? 'bg-amber-100 text-amber-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {form.status}
                    </span>
                  </td>
                  <td>{form.suppliers?.name || '-'}</td>
                  <td>{form.profiles?.full_name || 'Staff'}</td>
                  <td>{form.created_at ? new Date(form.created_at).toLocaleString() : '-'}</td>
                  <td>
                    <button 
                      type="button" 
                      className="btn btn-outline" 
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      onClick={() => openFormDetails(form)}
                    >
                      <Eye size={15} />
                      <span>Review</span>
                    </button>
                  </td>
                </tr>
              ))}
              {forms.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    No procurement forms matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail & History Modal */}
      {selectedForm && (
        <div 
          className="modal-backdrop" 
          onClick={() => setSelectedForm(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}
          >
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <div>
                <h3 style={{ margin: 0 }}>
                  {formatFormType(selectedForm.form_type)} — {selectedForm.form_date}
                </h3>
                <span className="text-xs text-gray-500">ID: {selectedForm.id}</span>
              </div>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ padding: '0.35rem', border: 'none' }}
                onClick={() => setSelectedForm(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm bg-gray-50 p-3 rounded" style={{ backgroundColor: '#f8fafc' }}>
              <div><strong>Status:</strong> {selectedForm.status}</div>
              <div><strong>Created By:</strong> {selectedForm.profiles?.full_name || 'Staff'}</div>
              <div><strong>Created At:</strong> {selectedForm.created_at ? new Date(selectedForm.created_at).toLocaleString() : '-'}</div>
              <div><strong>First Saved:</strong> {selectedForm.first_saved_at ? new Date(selectedForm.first_saved_at).toLocaleString() : '-'}</div>
              {selectedForm.supplier_id && (
                <div className="col-span-2"><strong>Supplier:</strong> {selectedForm.suppliers?.name || 'Registered Supplier'}</div>
              )}
              {selectedForm.notes && (
                <div className="col-span-2"><strong>Notes:</strong> {selectedForm.notes}</div>
              )}
            </div>

            {/* Line items table */}
            <h4 className="text-base font-semibold mb-2">Form Items</h4>
            {loadingDetail ? (
              <div className="flex justify-center py-4"><div className="spinner"></div></div>
            ) : (
              <table className="mb-6">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    {selectedForm.form_type === 'market' && <th>Unit Cost</th>}
                    {selectedForm.form_type === 'frozen_goods' && <th>Intake Date</th>}
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="font-medium">{item.items?.name || 'Item'}</td>
                      <td>{item.quantity}</td>
                      <td>{item.items?.unit || '-'}</td>
                      {selectedForm.form_type === 'market' && <td>${Number(item.unit_cost || 0).toFixed(2)}</td>}
                      {selectedForm.form_type === 'frozen_goods' && <td>{item.item_date || '-'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Full Edit History Timeline */}
            <ProcurementFormTimeline history={selectedHistory} />

            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => {
                  const targetRoute = selectedForm.form_type === 'market' 
                    ? `/procurement/market-form?id=${selectedForm.id}` 
                    : `/procurement/frozen-goods?id=${selectedForm.id}`;
                  navigate(targetRoute);
                }}
              >
                <ExternalLink size={15} />
                <span>Open Dedicated View (Read-Only)</span>
              </button>

              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setSelectedForm(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcurementFormsReview;
