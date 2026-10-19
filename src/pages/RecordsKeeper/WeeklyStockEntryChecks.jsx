import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { 
  CheckSquare, 
  Calendar, 
  Eye, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  ShieldCheck, 
  UserCheck, 
  ChevronRight,
  FileText,
  Lock
} from 'lucide-react';
import ReceiptViewerModal from '../../components/ReceiptViewerModal';

const WeeklyStockEntryChecks = () => {
  const { profile } = useAuth();
  const [weeks, setWeeks] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [entries, setEntries] = useState([]);
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  
  // Sign-off modal state
  const [showSignModal, setShowSignModal] = useState(false);
  const [signComment, setSignComment] = useState('');
  const [submittingSign, setSubmittingSign] = useState(false);
  const [signError, setSignError] = useState(null);
  const [signSuccess, setSignSuccess] = useState(null);

  // 1. Fetch weeks
  const fetchWeeks = async () => {
    setLoadingWeeks(true);
    try {
      const { data, error } = await supabase
        .from('stock_entry_weekly_checks')
        .select(`
          *,
          records_keeper:records_keeper_id(full_name),
          manager:manager_id(full_name),
          auditor:auditor_id(full_name)
        `)
        .order('week_start_date', { ascending: false });

      if (error) throw error;

      setWeeks(data || []);
      if (data && data.length > 0) {
        if (!selectedWeekId || !data.some(w => w.id === selectedWeekId)) {
          setSelectedWeekId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching weekly check queues:', err);
    } finally {
      setLoadingWeeks(false);
    }
  };

  useEffect(() => {
    fetchWeeks();
  }, []);

  const activeWeek = useMemo(() => {
    return weeks.find(w => w.id === selectedWeekId) || weeks[0] || null;
  }, [weeks, selectedWeekId]);

  // 2. Fetch goods receipts for selected week
  const fetchEntriesForWeek = async (week) => {
    if (!week) return;
    setLoadingEntries(true);
    try {
      const { data, error } = await supabase
        .from('goods_receipts')
        .select(`
          id,
          quantity_received,
          unit_cost,
          created_at,
          date_received,
          receipt_url,
          items (name, unit, category),
          profiles:received_by (full_name)
        `)
        .gte('date_received', week.week_start_date)
        .lte('date_received', week.week_end_date)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error('Error fetching entries for week:', err);
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    if (activeWeek) {
      fetchEntriesForWeek(activeWeek);
    }
  }, [activeWeek?.id]);

  // Check if current user can sign off the current stage
  const canUserSign = useMemo(() => {
    if (!activeWeek || !profile?.role) return false;
    const role = profile.role;
    const status = activeWeek.status;

    if (status === 'Awaiting Records Keeper') {
      return role === 'records_keeper' || role === 'admin';
    }
    if (status === 'Awaiting Manager') {
      return role === 'manager' || role === 'admin';
    }
    if (status === 'Awaiting Auditor') {
      return role === 'auditor' || role === 'admin';
    }
    return false;
  }, [activeWeek, profile]);

  const currentRequiredRole = useMemo(() => {
    if (!activeWeek) return '';
    switch (activeWeek.status) {
      case 'Awaiting Records Keeper':
        return 'Records Keeper';
      case 'Awaiting Manager':
        return 'Manager';
      case 'Awaiting Auditor':
        return 'Auditor';
      default:
        return 'None (Fully Checked)';
    }
  }, [activeWeek]);

  // Handle Sign-off submission
  const handleConfirmSignOff = async (e) => {
    e.preventDefault();
    if (!activeWeek) return;

    setSubmittingSign(true);
    setSignError(null);
    setSignSuccess(null);

    try {
      const { data, error } = await supabase.rpc('sign_off_weekly_check_rpc', {
        p_week_start: activeWeek.week_start_date,
        p_comment: signComment.trim() || null
      });

      if (error) throw error;

      setSignSuccess(`Successfully signed off! Week progressed to: ${data?.new_status || 'Next Stage'}`);
      setSignComment('');
      setShowSignModal(false);
      // Refresh weeks and current selection
      await fetchWeeks();
    } catch (err) {
      console.error('Error signing off weekly check:', err);
      setSignError(err.message || 'Failed to sign off weekly check.');
    } finally {
      setSubmittingSign(false);
    }
  };

  const totals = useMemo(() => {
    const totalQty = entries.reduce((acc, curr) => acc + (Number(curr.quantity_received) || 0), 0);
    const totalCost = entries.reduce((acc, curr) => acc + ((Number(curr.quantity_received) || 0) * (Number(curr.unit_cost) || 0)), 0);
    const missingReceipts = entries.filter(e => !e.receipt_url).length;
    return { totalQty, totalCost, missingReceipts, count: entries.length };
  }, [entries]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="weekly-checks-page">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2>Weekly Stock Entry Verification</h2>
          <p className="text-gray-500">
            Mandatory 3-step sequential verification chain for central store stock entries.
          </p>
        </div>
        <button 
          className="btn btn-outline" 
          onClick={() => { fetchWeeks(); if (activeWeek) fetchEntriesForWeek(activeWeek); }} 
          disabled={loadingWeeks || loadingEntries}
        >
          <RefreshCw size={18} className={(loadingWeeks || loadingEntries) ? 'spinner border-0' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {signSuccess && (
        <div className="p-4 mb-4 rounded bg-green-50 text-green-700 border border-green-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} />
            <span>{signSuccess}</span>
          </div>
          <button className="text-sm underline" onClick={() => setSignSuccess(null)}>Dismiss</button>
        </div>
      )}

      {signError && (
        <div className="p-4 mb-4 rounded bg-red-50 text-red-700 border border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} />
            <span>{signError}</span>
          </div>
          <button className="text-sm underline" onClick={() => setSignError(null)}>Dismiss</button>
        </div>
      )}

      {/* Week Selector Bar */}
      <div className="card mb-6" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar size={22} className="text-blue-600" />
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Select Audit Week (Monday – Sunday)
              </label>
              <select
                className="form-input mt-1 font-medium"
                style={{ minWidth: '260px' }}
                value={selectedWeekId}
                onChange={(e) => setSelectedWeekId(e.target.value)}
                disabled={loadingWeeks}
              >
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    Week {formatDate(w.week_start_date)} – {formatDate(w.week_end_date)} ({w.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeWeek && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Current Status:</span>
              <span
                className="badge"
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  backgroundColor:
                    activeWeek.status === 'Fully checked' ? '#dcfce7' :
                    activeWeek.status === 'Awaiting Auditor' ? '#f3e8ff' :
                    activeWeek.status === 'Awaiting Manager' ? '#dbeafe' : '#fef3c7',
                  color:
                    activeWeek.status === 'Fully checked' ? '#15803d' :
                    activeWeek.status === 'Awaiting Auditor' ? '#7e22ce' :
                    activeWeek.status === 'Awaiting Manager' ? '#1d4ed8' : '#b45309',
                }}
              >
                {activeWeek.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Re-check Warning Banner if new entries arrived during check */}
      {activeWeek?.has_recheck_warning && (
        <div className="card mb-6" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900" style={{ margin: 0 }}>
                Re-verification Required
              </h4>
              <p className="text-sm text-amber-800 mt-1" style={{ margin: 0 }}>
                New stock entries were received after this week's check began. The review chain has been reset to <strong>Awaiting Records Keeper</strong> to ensure all newly received items and mandatory receipts are verified.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3-Step Verification Chain Progression */}
      {activeWeek && (
        <div className="card mb-6">
          <h3 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-600" />
            <span>Sequential Sign-Off Chain</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1: Records Keeper */}
            <div 
              className="p-4 rounded-lg border transition-all"
              style={{
                backgroundColor: activeWeek.records_keeper_signed_at ? '#f0fdf4' : activeWeek.status === 'Awaiting Records Keeper' ? '#fffbeb' : '#f8fafc',
                borderColor: activeWeek.records_keeper_signed_at ? '#86efac' : activeWeek.status === 'Awaiting Records Keeper' ? '#fde047' : '#e2e8f0'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Step 1</span>
                {activeWeek.records_keeper_signed_at ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                    <CheckCircle2 size={16} /> Signed
                  </span>
                ) : activeWeek.status === 'Awaiting Records Keeper' ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-700">
                    <Clock size={16} /> Awaiting Sign-off
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Pending</span>
                )}
              </div>
              <h4 className="font-semibold text-gray-800" style={{ margin: 0 }}>Records Keeper</h4>
              
              {activeWeek.records_keeper_signed_at ? (
                <div className="mt-2 text-xs text-gray-600">
                  <p className="font-medium text-gray-900 mb-0.5">
                    {activeWeek.records_keeper?.full_name || 'Records Keeper'}
                  </p>
                  <p className="text-gray-500 mb-1">{formatDateTime(activeWeek.records_keeper_signed_at)}</p>
                  {activeWeek.records_keeper_comment && (
                    <p className="italic bg-white p-2 rounded border border-gray-100 text-gray-700">
                      "{activeWeek.records_keeper_comment}"
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  Verifies portion counts and receipt uploads for all deliveries.
                </p>
              )}
            </div>

            {/* Step 2: Manager */}
            <div 
              className="p-4 rounded-lg border transition-all"
              style={{
                backgroundColor: activeWeek.manager_signed_at ? '#f0fdf4' : activeWeek.status === 'Awaiting Manager' ? '#eff6ff' : '#f8fafc',
                borderColor: activeWeek.manager_signed_at ? '#86efac' : activeWeek.status === 'Awaiting Manager' ? '#93c5fd' : '#e2e8f0'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Step 2</span>
                {activeWeek.manager_signed_at ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                    <CheckCircle2 size={16} /> Signed
                  </span>
                ) : activeWeek.status === 'Awaiting Manager' ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-blue-700">
                    <Clock size={16} /> Awaiting Sign-off
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Lock size={12} /> Locked
                  </span>
                )}
              </div>
              <h4 className="font-semibold text-gray-800" style={{ margin: 0 }}>Store / General Manager</h4>

              {activeWeek.manager_signed_at ? (
                <div className="mt-2 text-xs text-gray-600">
                  <p className="font-medium text-gray-900 mb-0.5">
                    {activeWeek.manager?.full_name || 'Manager'}
                  </p>
                  <p className="text-gray-500 mb-1">{formatDateTime(activeWeek.manager_signed_at)}</p>
                  {activeWeek.manager_comment && (
                    <p className="italic bg-white p-2 rounded border border-gray-100 text-gray-700">
                      "{activeWeek.manager_comment}"
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  Reviews pricing, supplier rates, and store stock intake approval.
                </p>
              )}
            </div>

            {/* Step 3: Auditor */}
            <div 
              className="p-4 rounded-lg border transition-all"
              style={{
                backgroundColor: activeWeek.auditor_signed_at ? '#f0fdf4' : activeWeek.status === 'Awaiting Auditor' ? '#faf5ff' : '#f8fafc',
                borderColor: activeWeek.auditor_signed_at ? '#86efac' : activeWeek.status === 'Awaiting Auditor' ? '#d8b4fe' : '#e2e8f0'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Step 3</span>
                {activeWeek.auditor_signed_at ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                    <CheckCircle2 size={16} /> Fully Checked
                  </span>
                ) : activeWeek.status === 'Awaiting Auditor' ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-purple-700">
                    <Clock size={16} /> Awaiting Sign-off
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Lock size={12} /> Locked
                  </span>
                )}
              </div>
              <h4 className="font-semibold text-gray-800" style={{ margin: 0 }}>Internal Auditor</h4>

              {activeWeek.auditor_signed_at ? (
                <div className="mt-2 text-xs text-gray-600">
                  <p className="font-medium text-gray-900 mb-0.5">
                    {activeWeek.auditor?.full_name || 'Auditor'}
                  </p>
                  <p className="text-gray-500 mb-1">{formatDateTime(activeWeek.auditor_signed_at)}</p>
                  {activeWeek.auditor_comment && (
                    <p className="italic bg-white p-2 rounded border border-gray-100 text-gray-700">
                      "{activeWeek.auditor_comment}"
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  Final independent audit check closing the stock entry week.
                </p>
              )}
            </div>
          </div>

          {/* Action / CTA Bar */}
          <div className="mt-6 pt-4 border-t flex flex-wrap items-center justify-between gap-4">
            <div>
              {activeWeek.status === 'Fully checked' ? (
                <span className="text-sm font-semibold text-green-700 flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  Week is fully verified and locked by all three departments.
                </span>
              ) : canUserSign ? (
                <span className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                  <UserCheck size={18} />
                  You are authorized to sign off the current stage ({activeWeek.status}).
                </span>
              ) : (
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Lock size={16} />
                  Currently waiting for {currentRequiredRole} sign-off (Your role: {profile?.role || 'user'}).
                </span>
              )}
            </div>

            {canUserSign && (
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => setShowSignModal(true)}
              >
                <CheckSquare size={18} />
                <span>Sign Off Week as {profile?.role === 'admin' ? `Admin (${currentRequiredRole})` : currentRequiredRole}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Week Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card text-center py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total Entries</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{totals.count}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase">Portions Received</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{totals.totalQty.toLocaleString()}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total Value</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">${totals.totalCost.toFixed(2)}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase">Receipts Compliance</p>
          <p className={`text-2xl font-bold mt-1 ${totals.missingReceipts > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {totals.count === 0 ? '100%' : `${Math.round(((totals.count - totals.missingReceipts) / totals.count) * 100)}%`}
          </p>
        </div>
      </div>

      {/* Goods Receipts Table for Selected Week */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-700" style={{ margin: 0 }}>
            Deliveries Received (Week {activeWeek ? `${formatDate(activeWeek.week_start_date)} – ${formatDate(activeWeek.week_end_date)}` : ''})
          </h3>
          <span className="text-xs text-gray-500">
            {entries.length} recorded delivery item{entries.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="table-container" style={{ margin: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Date Received</th>
                <th>Item & Category</th>
                <th>Portions</th>
                <th>Unit Cost</th>
                <th>Total Value</th>
                <th>Received By</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {loadingEntries ? (
                <tr>
                  <td colSpan="7" className="text-center py-8">
                    <div className="spinner mx-auto mb-2"></div>
                    <span className="text-sm text-gray-500">Loading stock entries...</span>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">
                    No stock entries recorded for this week.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const lineTotal = (Number(entry.quantity_received) || 0) * (Number(entry.unit_cost) || 0);
                  return (
                    <tr key={entry.id}>
                      <td>
                        <div className="font-medium text-gray-900">
                          {entry.date_received ? formatDate(entry.date_received) : '-'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {entry.created_at ? new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium text-gray-900">{entry.items?.name || 'Unknown item'}</div>
                        <div className="text-xs text-gray-500">{entry.items?.category || 'General'}</div>
                      </td>
                      <td>
                        <span className="badge badge-primary" style={{ fontWeight: 600 }}>
                          {entry.quantity_received} {entry.items?.unit || 'portions'}
                        </span>
                      </td>
                      <td>${Number(entry.unit_cost || 0).toFixed(2)}</td>
                      <td className="font-medium text-emerald-700">${lineTotal.toFixed(2)}</td>
                      <td>{entry.profiles?.full_name || 'Staff'}</td>
                      <td>
                        {entry.receipt_url ? (
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ 
                              padding: '0.3rem 0.6rem', 
                              fontSize: '0.8rem', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.35rem' 
                            }}
                            onClick={() => setSelectedReceipt(entry.receipt_url)}
                          >
                            <Eye size={14} className="text-blue-600" />
                            <span>View Receipt</span>
                          </button>
                        ) : (
                          <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                            <AlertTriangle size={12} /> Missing
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sign-off Confirmation Modal */}
      {showSignModal && activeWeek && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="font-semibold text-lg text-gray-800" style={{ margin: 0 }}>
                Confirm Weekly Stock Verification
              </h3>
              <button 
                type="button" 
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowSignModal(false)}
                disabled={submittingSign}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSignOff}>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
                <p className="font-semibold mb-1">
                  You are signing off for:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Week:</strong> {formatDate(activeWeek.week_start_date)} to {formatDate(activeWeek.week_end_date)}</li>
                  <li><strong>Stage:</strong> {activeWeek.status}</li>
                  <li><strong>Sign-off Role:</strong> {profile?.role}</li>
                  <li><strong>Total Entries Checked:</strong> {totals.count} ({totals.totalQty} portions, ${totals.totalCost.toFixed(2)})</li>
                </ul>
              </div>

              <div className="form-group mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reviewer Notes / Verification Comment (Optional)
                </label>
                <textarea
                  className="form-input w-full"
                  rows={3}
                  placeholder="e.g., Verified all portion quantities against supplier delivery notes and store ledger."
                  value={signComment}
                  onChange={(e) => setSignComment(e.target.value)}
                  disabled={submittingSign}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowSignModal(false)}
                  disabled={submittingSign}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingSign}
                >
                  {submittingSign ? (
                    <>
                      <span className="spinner"></span>
                      <span>Signing Off...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirm & Sign Off</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Viewer Modal */}
      <ReceiptViewerModal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        imageUrl={selectedReceipt}
        title="Stock Entry Receipt"
      />
    </div>
  );
};

export default WeeklyStockEntryChecks;
