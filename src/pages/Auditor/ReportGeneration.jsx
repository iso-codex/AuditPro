import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  FileText, Download, Filter, RefreshCw,
  AlertCircle, FileSpreadsheet, X, Search
} from 'lucide-react';
import './ReportGeneration.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEPARTMENTS = ['All', 'Kitchen', 'Bar', 'Byte', 'HQ', 'Maintenance'];
const ACTION_TYPES = ['All', 'Received', 'Dispatched', 'Requisition Raised', 'Approved', 'Rejected', 'Confirmed', 'Discrepancy'];
const REQ_STATUSES = ['All', 'Pending_Manager', 'Pending_Store', 'Dispatched', 'Rejected', 'Completed'];

const REPORT_TYPES = [
  { id: 'movements', label: 'Goods Movements', description: 'All stock in/out events from the audit trail' },
  { id: 'requisitions', label: 'Requisition Status', description: 'All requisitions with current status & approvals' },
  { id: 'discrepancies', label: 'Discrepancy Report', description: 'Items where dispatched \u2260 confirmed quantity' },
];

const today = () => new Date().toISOString().split('T')[0];
const monthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString() : '-';
const fmtDateShort = (iso) => iso ? new Date(iso).toLocaleDateString() : '-';

// ─── PDF Export ───────────────────────────────────────────────────────────────
const exportToPDF = async (reportType, filters, rows, columns) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text('AuditPro — Report', 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  const reportLabel = REPORT_TYPES.find(r => r.id === reportType)?.label || reportType;
  doc.text('Report Type: ' + reportLabel, 14, 26);
  doc.text('Period: ' + filters.dateFrom + ' to ' + filters.dateTo, 14, 32);

  const extras = [];
  if (filters.department !== 'All') extras.push('Department: ' + filters.department);
  if (filters.staffName) extras.push('Staff: ' + filters.staffName);
  if (reportType === 'movements' && filters.actionType !== 'All') extras.push('Action: ' + filters.actionType);
  if (reportType === 'requisitions' && filters.status !== 'All') extras.push('Status: ' + filters.status);
  if (extras.length) doc.text(extras.join('   |   '), 14, 38);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Generated: ' + new Date().toLocaleString() + '   |   Total rows: ' + rows.length, 14, 44);

  autoTable(doc, {
    startY: 50,
    head: [columns.map(c => c.header)],
    body: rows.map(r => columns.map(c => c.accessor(r))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  doc.save('AuditPro_' + reportLabel.replace(/\s+/g, '_') + '_' + today() + '.pdf');
};

// ─── XLS Export ───────────────────────────────────────────────────────────────
const exportToXLS = async (reportType, rows, columns) => {
  const XLSX = await import('xlsx');
  const reportLabel = REPORT_TYPES.find(r => r.id === reportType)?.label || reportType;

  const wsData = [
    columns.map(c => c.header),
    ...rows.map(r => columns.map(c => c.accessor(r)))
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, reportLabel.substring(0, 31));
  XLSX.writeFile(wb, 'AuditPro_' + reportLabel.replace(/\s+/g, '_') + '_' + today() + '.xlsx');
};

// ─── Column Definitions ───────────────────────────────────────────────────────
const COLUMNS = {
  movements: [
    { header: 'Timestamp',    accessor: r => fmtDate(r.created_at) },
    { header: 'Action',       accessor: r => r.action_type },
    { header: 'Performed By', accessor: r => r.profiles?.full_name || '-' },
    { header: 'Department',   accessor: r => r.department || '-' },
    { header: 'Notes',        accessor: r => r.notes || '-' },
  ],
  requisitions: [
    { header: 'Req ID',       accessor: r => r.id?.substring(0, 8) },
    { header: 'Department',   accessor: r => r.department },
    { header: 'Requested By', accessor: r => r.profiles?.full_name || '-' },
    { header: 'Date',         accessor: r => fmtDateShort(r.created_at) },
    { header: 'Status',       accessor: r => r.status },
    { header: 'Approved By',  accessor: r => r.approver_name || '-' },
    { header: 'Items',        accessor: r => r.requisition_items?.length ?? '-' },
    { header: 'Notes',        accessor: r => r.notes || '-' },
  ],
  discrepancies: [
    { header: 'Req ID',     accessor: r => r.requisitions?.id?.substring(0, 8) || '-' },
    { header: 'Department', accessor: r => r.requisitions?.department || '-' },
    { header: 'Item',       accessor: r => r.items?.name || '-' },
    { header: 'Dispatched', accessor: r => r.quantity_dispatched },
    { header: 'Confirmed',  accessor: r => r.quantity_confirmed },
    { header: 'Difference', accessor: r => {
      const diff = parseFloat(r.quantity_dispatched) - parseFloat(r.quantity_confirmed);
      return diff > 0 ? '-' + diff : '+' + Math.abs(diff);
    }},
    { header: 'Notes', accessor: r => r.discrepancy_notes || '-' },
  ],
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ReportGeneration = () => {
  const [reportType, setReportType] = useState('movements');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [allStaff, setAllStaff] = useState([]);
  const [exporting, setExporting] = useState(null);

  const [filters, setFilters] = useState({
    dateFrom: monthAgo(),
    dateTo: today(),
    department: 'All',
    staffId: '',
    staffName: '',
    actionType: 'All',
    status: 'All',
  });

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, role').order('full_name').then(({ data }) => {
      setAllStaff(data || []);
    });
  }, []);

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRows([]);

    try {
      if (reportType === 'movements') {
        let q = supabase
          .from('audit_log')
          .select('*, profiles!actor_id(full_name)')
          .gte('created_at', filters.dateFrom + 'T00:00:00')
          .lte('created_at', filters.dateTo + 'T23:59:59')
          .order('created_at', { ascending: false });

        if (filters.actionType !== 'All') q = q.eq('action_type', filters.actionType);
        if (filters.department !== 'All') q = q.eq('department', filters.department);
        if (filters.staffId) q = q.eq('actor_id', filters.staffId);

        const { data, error } = await q;
        if (error) throw error;
        setRows(data || []);

      } else if (reportType === 'requisitions') {
        let q = supabase
          .from('requisitions')
          .select('*, profiles!requested_by(full_name), requisition_items(id)')
          .gte('created_at', filters.dateFrom + 'T00:00:00')
          .lte('created_at', filters.dateTo + 'T23:59:59')
          .order('created_at', { ascending: false });

        if (filters.status !== 'All') q = q.eq('status', filters.status);
        if (filters.department !== 'All') q = q.eq('department', filters.department);
        if (filters.staffId) q = q.eq('requested_by', filters.staffId);

        const { data, error } = await q;
        if (error) throw error;
        setRows(data || []);

      } else if (reportType === 'discrepancies') {
        const { data, error } = await supabase
          .from('requisition_items')
          .select('id, quantity_dispatched, quantity_confirmed, discrepancy_notes, requisitions!inner(id, department, created_at), items(name, unit)')
          .not('quantity_confirmed', 'is', null);

        if (error) throw error;

        let filtered = (data || []).filter(i =>
          parseFloat(i.quantity_dispatched) !== parseFloat(i.quantity_confirmed)
        );

        // Client-side date + department filter for discrepancies
        const from = new Date(filters.dateFrom + 'T00:00:00');
        const to = new Date(filters.dateTo + 'T23:59:59');
        filtered = filtered.filter(i => {
          const d = new Date(i.requisitions?.created_at);
          return d >= from && d <= to;
        });
        if (filters.department !== 'All') {
          filtered = filtered.filter(i => i.requisitions?.department === filters.department);
        }
        setRows(filtered);
      }

      setHasGenerated(true);
    } catch (err) {
      console.error('Report error:', err);
      setError(err.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  }, [reportType, filters]);

  const handleExportPDF = async () => {
    setExporting('pdf');
    try { await exportToPDF(reportType, filters, rows, COLUMNS[reportType]); }
    catch (e) { alert('PDF export failed: ' + e.message); }
    finally { setExporting(null); }
  };

  const handleExportXLS = async () => {
    setExporting('xls');
    try { await exportToXLS(reportType, rows, COLUMNS[reportType]); }
    catch (e) { alert('XLS export failed: ' + e.message); }
    finally { setExporting(null); }
  };

  const columns = COLUMNS[reportType];

  return (
    <div className="report-generation-page">
      {/* Header */}
      <div className="report-header">
        <div>
          <h2>Report Generation</h2>
          <p>Filter, preview and export inventory movement reports.</p>
        </div>
        {hasGenerated && rows.length > 0 && (
          <div className="export-buttons">
            <button className="btn btn-outline export-btn" onClick={handleExportXLS} disabled={!!exporting}>
              {exporting === 'xls' ? <div className="spinner border-0" style={{ width: 16, height: 16 }} /> : <FileSpreadsheet size={16} />}
              Export XLS
            </button>
            <button className="btn btn-primary export-btn" onClick={handleExportPDF} disabled={!!exporting}>
              {exporting === 'pdf' ? <div className="spinner border-0" style={{ width: 16, height: 16 }} /> : <FileText size={16} />}
              Export PDF
            </button>
          </div>
        )}
      </div>

      <div className="report-layout">
        {/* Filter Panel */}
        <aside className="filter-panel">
          <div className="filter-section-title"><Filter size={14} /> Report Type</div>
          <div className="report-type-list">
            {REPORT_TYPES.map(rt => (
              <button
                key={rt.id}
                className={'report-type-btn' + (reportType === rt.id ? ' active' : '')}
                onClick={() => { setReportType(rt.id); setHasGenerated(false); setRows([]); }}
              >
                <span className="rt-label">{rt.label}</span>
                <span className="rt-desc">{rt.description}</span>
              </button>
            ))}
          </div>

          <div className="filter-divider" />
          <div className="filter-section-title"><Filter size={14} /> Date Range</div>

          <div className="filter-group">
            <label className="filter-label">From</label>
            <input type="date" className="form-input" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} />
          </div>
          <div className="filter-group">
            <label className="filter-label">To</label>
            <input type="date" className="form-input" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} />
          </div>

          <div className="preset-buttons">
            {[
              { label: 'Today', fn: () => { setFilter('dateFrom', today()); setFilter('dateTo', today()); } },
              {
                label: 'This Week', fn: () => {
                  const d = new Date(); d.setDate(d.getDate() - d.getDay());
                  setFilter('dateFrom', d.toISOString().split('T')[0]); setFilter('dateTo', today());
                }
              },
              {
                label: 'This Month', fn: () => {
                  const d = new Date();
                  setFilter('dateFrom', d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01');
                  setFilter('dateTo', today());
                }
              },
              { label: 'Last 30 Days', fn: () => { setFilter('dateFrom', monthAgo()); setFilter('dateTo', today()); } },
            ].map(p => (
              <button key={p.label} className="preset-btn" onClick={p.fn}>{p.label}</button>
            ))}
          </div>

          <div className="filter-divider" />
          <div className="filter-section-title"><Filter size={14} /> Filters</div>

          <div className="filter-group">
            <label className="filter-label">Department</label>
            <select className="form-select" value={filters.department} onChange={e => setFilter('department', e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Staff Member</label>
            <select className="form-select" value={filters.staffId}
              onChange={e => {
                const sel = allStaff.find(s => s.id === e.target.value);
                setFilter('staffId', e.target.value);
                setFilter('staffName', sel?.full_name || '');
              }}>
              <option value="">All Staff</option>
              {allStaff.map(s => (
                <option key={s.id} value={s.id}>{s.full_name} ({s.role?.replace('_', ' ')})</option>
              ))}
            </select>
          </div>

          {reportType === 'movements' && (
            <div className="filter-group">
              <label className="filter-label">Action Type</label>
              <select className="form-select" value={filters.actionType} onChange={e => setFilter('actionType', e.target.value)}>
                {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          {reportType === 'requisitions' && (
            <div className="filter-group">
              <label className="filter-label">Status</label>
              <select className="form-select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
                {REQ_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          )}

          <button className="btn btn-primary generate-btn" onClick={generateReport} disabled={loading}>
            {loading
              ? <><div className="spinner border-0" style={{ width: 16, height: 16 }} /> Generating…</>
              : <><Search size={16} /> Generate Report</>}
          </button>
        </aside>

        {/* Report Preview */}
        <div className="report-preview">
          {hasGenerated && (
            <div className="report-summary-bar">
              <div className="summary-chips">
                <span className="summary-chip primary">{REPORT_TYPES.find(r => r.id === reportType)?.label}</span>
                <span className="summary-chip">{filters.dateFrom} → {filters.dateTo}</span>
                {filters.department !== 'All' && <span className="summary-chip">{filters.department}</span>}
                {filters.staffName && <span className="summary-chip">{filters.staffName}</span>}
                {reportType === 'movements' && filters.actionType !== 'All' && <span className="summary-chip">{filters.actionType}</span>}
                {reportType === 'requisitions' && filters.status !== 'All' && <span className="summary-chip">{filters.status.replace('_', ' ')}</span>}
              </div>
              <span className="row-count">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {error && (
            <div className="report-error"><AlertCircle size={18} /><span>{error}</span></div>
          )}

          {loading ? (
            <div className="report-loading">
              <div className="spinner" style={{ width: 36, height: 36 }} />
              <p>Generating report…</p>
            </div>
          ) : !hasGenerated ? (
            <div className="report-empty-state">
              <div className="empty-icon-wrap"><FileText size={52} /></div>
              <h3>No report generated yet</h3>
              <p>Select your filters and click <strong>Generate Report</strong> to preview results.</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="report-empty-state">
              <div className="empty-icon-wrap" style={{ color: 'var(--warning-color)' }}><AlertCircle size={52} /></div>
              <h3>No records found</h3>
              <p>Try adjusting the filters or expanding the date range.</p>
            </div>
          ) : (
            <div className="table-container report-table-wrap">
              <table>
                <thead>
                  <tr>{columns.map(c => <th key={c.header}>{c.header}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isHighRisk = reportType === 'discrepancies' &&
                      Math.abs(parseFloat(row.quantity_dispatched) - parseFloat(row.quantity_confirmed)) > 5;
                    return (
                      <tr key={row.id || i} className={isHighRisk ? 'high-risk-row' : ''}>
                        {columns.map(c => <td key={c.header}>{c.accessor(row)}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportGeneration;
