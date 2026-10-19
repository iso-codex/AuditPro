import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  FileText, Download, Filter, RefreshCw,
  AlertCircle, FileSpreadsheet, X, Search,
  Building2, PieChart, Layers, Eye, Trash2
} from 'lucide-react';
import { formatRole } from '../../utils/formatters';
import ReceiptViewerModal from '../../components/ReceiptViewerModal';
import './ReportGeneration.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTION_TYPES = ['All', 'Received', 'Dispatched', 'Requisition Raised', 'Approved', 'Rejected', 'Confirmed', 'Discrepancy'];
const REQ_STATUSES = ['All', 'Pending_Manager', 'Pending_Store', 'Dispatched', 'Rejected', 'Completed'];
const DAMAGE_STAGES = ['All', 'Before production', 'After production'];

const REPORT_TYPES = [
  { id: 'movements', label: 'Goods Movements', description: 'All stock in/out events from the audit trail' },
  { id: 'requisitions', label: 'Requisition Status', description: 'All requisitions with current status & approvals' },
  { id: 'damages', label: 'Damages Register', description: 'Write-offs, damaged stock portions, and photo evidence' },
  { id: 'discrepancies', label: 'Discrepancy Report', description: 'Items where dispatched \u2260 confirmed quantity' },
  { id: 'variances', label: 'Stock Variances', description: 'Variances from weekly stock counts' },
  { id: 'price_history', label: 'Price History', description: 'Purchase price changes over time' },
];

const today = () => new Date().toISOString().split('T')[0];
const yearAgo = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString() : '-';
const fmtDateShort = (iso) => iso ? new Date(iso).toLocaleDateString() : '-';

// ─── PDF Export ───────────────────────────────────────────────────────────────
const exportToPDF = async (reportType, filters, rows, columns, departmentBreakdown) => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235);
  doc.text('AuditPro — Auditor Report', 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  const reportLabel = REPORT_TYPES.find(r => r.id === reportType)?.label || reportType;
  doc.text('Report Type: ' + reportLabel, 14, 26);
  doc.text('Period: ' + filters.dateFrom + ' to ' + filters.dateTo, 14, 32);

  const extras = [];
  if (filters.department !== 'All') extras.push('Department: ' + filters.department);
  else extras.push('Scope: All Departments (with Department Breakdown)');
  if (filters.staffName) extras.push('Staff: ' + filters.staffName);
  if (reportType === 'movements' && filters.actionType !== 'All') extras.push('Action: ' + filters.actionType);
  if (reportType === 'requisitions' && filters.status !== 'All') extras.push('Status: ' + filters.status);
  if (reportType === 'damages' && filters.stage !== 'All') extras.push('Stage: ' + filters.stage);
  if (extras.length) doc.text(extras.join('   |   '), 14, 38);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Generated: ' + new Date().toLocaleString() + '   |   Total records: ' + rows.length, 14, 44);

  let currentY = 50;

  // Render Department Breakdown if All Departments
  if (filters.department === 'All' && departmentBreakdown && departmentBreakdown.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Department Breakdown Summary', 14, currentY);
    currentY += 4;

    autoTable(doc, {
      startY: currentY,
      head: [['Department', 'Records', 'Share (%)', 'Key Activity / Details']],
      body: departmentBreakdown.map(d => [d.name, d.count, d.pct + '%', d.details]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });

    currentY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Detailed Audit Records', 14, currentY);
    currentY += 4;
  }

  autoTable(doc, {
    startY: currentY,
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
const exportToXLS = async (reportType, rows, columns, departmentBreakdown, filters) => {
  const XLSX = await import('xlsx');
  const reportLabel = REPORT_TYPES.find(r => r.id === reportType)?.label || reportType;
  const wb = XLSX.utils.book_new();

  // Add breakdown sheet if All Departments
  if (filters.department === 'All' && departmentBreakdown && departmentBreakdown.length > 0) {
    const summaryData = [
      ['Department', 'Records', 'Share (%)', 'Key Details'],
      ...departmentBreakdown.map(d => [d.name, d.count, d.pct + '%', d.details])
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Department Breakdown');
  }

  const wsData = [
    columns.map(c => c.header),
    ...rows.map(r => columns.map(c => c.accessor(r)))
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
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
  damages: [
    { header: 'Date',         accessor: r => fmtDateShort(r.recorded_at) },
    { header: 'Item',         accessor: r => r.items?.name || '-' },
    { header: 'Portions',     accessor: r => `-${r.quantity} ${r.items?.unit || 'portions'}` },
    { header: 'Loss Value',   accessor: r => `$${((Number(r.quantity) || 0) * (Number(r.items?.unit_cost) || 0)).toFixed(2)}` },
    { header: 'Stage',        accessor: r => r.stage },
    { header: 'Location',     accessor: r => r.location_type === 'store' ? 'Central Store' : (r.departments?.name || 'Department') },
    { header: 'Reason',       accessor: r => r.reason || '-' },
    { header: 'Recorded By',  accessor: r => r.profiles?.full_name || '-' },
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
  variances: [
    { header: 'Date', accessor: r => fmtDateShort(r.stock_count_cycles?.end_date) },
    { header: 'Department', accessor: r => r.stock_count_cycles?.departments?.name || '-' },
    { header: 'Item', accessor: r => r.items?.name || '-' },
    { header: 'Expected Qty', accessor: r => r.expected_closing_qty },
    { header: 'Counted Qty', accessor: r => r.counted_qty },
    { header: 'Variance Qty', accessor: r => r.variance_qty },
    { header: 'Variance Value', accessor: r => r.variance_value },
    { header: 'Reason', accessor: r => r.reason_code || '-' },
  ],
  price_history: [
    { header: 'Date', accessor: r => fmtDateShort(r.created_at) },
    { header: 'Item', accessor: r => r.items?.name || '-' },
    { header: 'Supplier', accessor: r => r.suppliers?.name || '-' },
    { header: 'Quantity', accessor: r => r.quantity },
    { header: 'Unit Cost (GHS)', accessor: r => parseFloat(r.unit_cost).toFixed(2) },
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
  const [departments, setDepartments] = useState(['All']);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [exporting, setExporting] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const [filters, setFilters] = useState({
    dateFrom: yearAgo(),
    dateTo: today(),
    department: 'All',
    staffId: '',
    staffName: '',
    actionType: 'All',
    status: 'All',
    stage: 'All',
  });

  // Fetch staff and departments dynamically
  useEffect(() => {
    supabase.from('profiles').select('id, full_name, role').order('full_name').then(({ data }) => {
      setAllStaff(data || []);
    });

    supabase.from('departments').select('id, name').order('name').then(({ data }) => {
      if (data && data.length > 0) {
        setDepartmentsList(data);
        setDepartments(['All', ...data.map(d => d.name), 'Central Store']);
      }
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
          .select('id, created_at, action_type, department, notes, profiles(full_name)')
          .gte('created_at', filters.dateFrom + 'T00:00:00')
          .lte('created_at', filters.dateTo + 'T23:59:59')
          .order('created_at', { ascending: false })
          .limit(1000);

        if (filters.actionType !== 'All') q = q.eq('action_type', filters.actionType);
        if (filters.department !== 'All') q = q.eq('department', filters.department);
        if (filters.staffId) q = q.eq('actor_id', filters.staffId);

        const { data, error } = await q;
        if (error) throw error;
        setRows(data || []);

      } else if (reportType === 'requisitions') {
        let q = supabase
          .from('requisitions')
          .select('id, department, created_at, status, approver_name, notes, profiles!requested_by(full_name), requisition_items(id)')
          .gte('created_at', filters.dateFrom + 'T00:00:00')
          .lte('created_at', filters.dateTo + 'T23:59:59')
          .order('created_at', { ascending: false })
          .limit(1000);

        if (filters.status !== 'All') q = q.eq('status', filters.status);
        if (filters.department !== 'All') q = q.eq('department', filters.department);
        if (filters.staffId) q = q.eq('requested_by', filters.staffId);

        const { data, error } = await q;
        if (error) throw error;
        setRows(data || []);

      } else if (reportType === 'damages') {
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
            profiles:recorded_by (full_name)
          `)
          .gte('recorded_at', filters.dateFrom + 'T00:00:00')
          .lte('recorded_at', filters.dateTo + 'T23:59:59')
          .order('recorded_at', { ascending: false })
          .limit(1000);

        if (filters.stage !== 'All') q = q.eq('stage', filters.stage);
        if (filters.department !== 'All') {
          if (filters.department === 'Central Store') {
            q = q.eq('location_type', 'store');
          } else {
            const dObj = departmentsList.find(d => d.name === filters.department);
            if (dObj) q = q.eq('department_id', dObj.id);
          }
        }
        if (filters.staffId) q = q.eq('recorded_by', filters.staffId);

        const { data, error } = await q;
        if (error) throw error;
        setRows(data || []);

      } else if (reportType === 'discrepancies') {
        const { data, error } = await supabase
          .from('requisition_items')
          .select('id, quantity_dispatched, quantity_confirmed, discrepancy_notes, requisitions!inner(id, department, created_at), items(name, unit)')
          .not('quantity_confirmed', 'is', null)
          .limit(1000);

        if (error) throw error;

        let filtered = (data || []).filter(i =>
          parseFloat(i.quantity_dispatched) !== parseFloat(i.quantity_confirmed)
        );

        // Date + department filter for discrepancies
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

      } else if (reportType === 'variances') {
        let q = supabase
          .from('stock_count_lines')
          .select('id, expected_closing_qty, counted_qty, variance_qty, variance_value, reason_code, stock_count_cycles!inner(end_date, status, departments(name)), items(name)')
          .gte('stock_count_cycles.end_date', filters.dateFrom)
          .lte('stock_count_cycles.end_date', filters.dateTo)
          .eq('stock_count_cycles.status', 'approved')
          .limit(1000);
        
        const { data, error } = await q;
        if (error) throw error;
        
        let filtered = data || [];
        if (filters.department !== 'All') {
          filtered = filtered.filter(r => r.stock_count_cycles?.departments?.name === filters.department);
        }
        setRows(filtered.filter(r => r.variance_qty && Math.abs(r.variance_qty) > 0));

      } else if (reportType === 'price_history') {
        let q = supabase
          .from('purchase_price_history')
          .select('id, created_at, quantity, unit_cost, items(name), suppliers(name)')
          .gte('created_at', filters.dateFrom + 'T00:00:00')
          .lte('created_at', filters.dateTo + 'T23:59:59')
          .order('created_at', { ascending: false })
          .limit(1000);

        const { data, error } = await q;
        if (error) throw error;
        setRows(data || []);
      }

      setHasGenerated(true);
    } catch (err) {
      console.error('Report error:', err);
      setError(err.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  }, [reportType, filters, departmentsList]);

  // Compute department breakdown summary when "All" departments is selected
  const departmentBreakdown = useMemo(() => {
    if (filters.department !== 'All' || rows.length === 0) return [];

    const deptMap = {};
    departments.filter(d => d !== 'All').forEach(d => {
      deptMap[d] = { count: 0, detailsMap: {}, totalPortions: 0, totalLoss: 0 };
    });

    rows.forEach(r => {
      let dept = 'Other / Central Store';
      if (reportType === 'movements') dept = r.department || 'Central Store';
      else if (reportType === 'requisitions') dept = r.department || 'Unknown';
      else if (reportType === 'damages') dept = r.location_type === 'store' ? 'Central Store' : (r.departments?.name || 'Department');
      else if (reportType === 'discrepancies') dept = r.requisitions?.department || 'Unknown';
      else if (reportType === 'variances') dept = r.stock_count_cycles?.departments?.name || 'Unknown';
      else if (reportType === 'price_history') dept = 'Central Store';

      if (!deptMap[dept]) deptMap[dept] = { count: 0, detailsMap: {}, totalPortions: 0, totalLoss: 0 };
      deptMap[dept].count += 1;

      if (reportType === 'movements') {
        const act = r.action_type || 'Event';
        deptMap[dept].detailsMap[act] = (deptMap[dept].detailsMap[act] || 0) + 1;
      } else if (reportType === 'requisitions') {
        const st = (r.status || 'Other').replace('_', ' ');
        deptMap[dept].detailsMap[st] = (deptMap[dept].detailsMap[st] || 0) + 1;
      } else if (reportType === 'damages') {
        const qty = Number(r.quantity) || 0;
        const loss = qty * (Number(r.items?.unit_cost) || 0);
        deptMap[dept].totalPortions += qty;
        deptMap[dept].totalLoss += loss;
        const stg = r.stage || 'General';
        deptMap[dept].detailsMap[stg] = (deptMap[dept].detailsMap[stg] || 0) + qty;
      }
    });

    const total = rows.length;
    return Object.keys(deptMap).map(name => {
      const item = deptMap[name];
      const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
      let details = '';
      if (reportType === 'damages') {
        details = `${item.totalPortions} portions lost ($${item.totalLoss.toFixed(2)})`;
      } else if (Object.keys(item.detailsMap).length > 0) {
        details = Object.entries(item.detailsMap)
          .map(([k, v]) => `${k} (${v})`)
          .join(', ');
      } else {
        details = `${item.count} recorded record(s)`;
      }
      return { name, count: item.count, pct, details };
    }).sort((a, b) => b.count - a.count);
  }, [rows, filters.department, reportType, departments]);

  const handleExportPDF = async () => {
    setExporting('pdf');
    try { 
      await exportToPDF(reportType, filters, rows, COLUMNS[reportType], departmentBreakdown); 
    } catch (e) { 
      alert('PDF export failed: ' + e.message); 
    } finally { 
      setExporting(null); 
    }
  };

  const handleExportXLS = async () => {
    setExporting('xls');
    try { 
      await exportToXLS(reportType, rows, COLUMNS[reportType], departmentBreakdown, filters); 
    } catch (e) { 
      alert('XLS export failed: ' + e.message); 
    } finally { 
      setExporting(null); 
    }
  };

  const columns = COLUMNS[reportType];

  return (
    <div className="report-generation-page">
      {/* Header */}
      <div className="report-header">
        <div>
          <h2>Auditor Report Generation</h2>
          <p>Filter, analyze by department (single vs all with breakdown), and export reports.</p>
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
              { label: 'Last 12 Months', fn: () => { setFilter('dateFrom', yearAgo()); setFilter('dateTo', today()); } },
            ].map(p => (
              <button key={p.label} className="preset-btn" onClick={p.fn}>{p.label}</button>
            ))}
          </div>

          <div className="filter-divider" />
          <div className="filter-section-title"><Building2 size={14} /> Department Scope</div>

          <div className="filter-group">
            <label className="filter-label">Department</label>
            <select className="form-select" value={filters.department} onChange={e => setFilter('department', e.target.value)}>
              <option value="All">All Departments (with Breakdown)</option>
              {departments.filter(d => d !== 'All').map(d => (
                <option key={d} value={d}>{d === 'Central Store' ? 'Central Store' : `Single Dept: ${d}`}</option>
              ))}
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
                <option key={s.id} value={s.id}>{s.full_name} ({formatRole(s.role)})</option>
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

          {reportType === 'damages' && (
            <div className="filter-group">
              <label className="filter-label">Production Stage</label>
              <select className="form-select" value={filters.stage} onChange={e => setFilter('stage', e.target.value)}>
                {DAMAGE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
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
                <span className="summary-chip">
                  {filters.department === 'All' ? 'Scope: All Departments (Breakdown)' : `Dept: ${filters.department}`}
                </span>
                {filters.staffName && <span className="summary-chip">{filters.staffName}</span>}
                {reportType === 'movements' && filters.actionType !== 'All' && <span className="summary-chip">{filters.actionType}</span>}
                {reportType === 'requisitions' && filters.status !== 'All' && <span className="summary-chip">{filters.status.replace('_', ' ')}</span>}
                {reportType === 'damages' && filters.stage !== 'All' && <span className="summary-chip">{filters.stage}</span>}
              </div>
              <span className="row-count">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {error && (
            <div className="report-error"><AlertCircle size={18} /><span>{error}</span></div>
          )}

          {/* Department Breakdown Section when "All" departments is chosen */}
          {hasGenerated && filters.department === 'All' && departmentBreakdown.length > 0 && (
            <div className="card mb-6" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2" style={{ margin: 0 }}>
                  <PieChart size={16} className="text-blue-600" />
                  <span>Department Breakdown Summary ({rows.length} total records)</span>
                </h3>
                <span className="text-xs text-gray-500">Included in PDF & Excel exports</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {departmentBreakdown.slice(0, 6).map(item => (
                  <div key={item.name} className="p-3 bg-white rounded border border-gray-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-sm text-gray-800">{item.name}</span>
                      <span className="badge badge-primary text-xs font-bold">{item.count} ({item.pct}%)</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate" title={item.details}>{item.details}</p>
                  </div>
                ))}
              </div>

              <div className="table-container" style={{ margin: 0, maxHeight: '200px' }}>
                <table style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Records</th>
                      <th>Share</th>
                      <th>Details / Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentBreakdown.map(item => (
                      <tr key={item.name}>
                        <td className="font-medium text-gray-900">{item.name}</td>
                        <td>{item.count}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span>{item.pct}%</span>
                            <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${item.pct}%`, height: '100%', background: '#3b82f6' }} />
                            </div>
                          </div>
                        </td>
                        <td className="text-xs text-gray-600">{item.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
                  <tr>
                    {columns.map(c => <th key={c.header}>{c.header}</th>)}
                    {reportType === 'damages' && <th>Evidence</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isHighRisk = reportType === 'discrepancies' &&
                      Math.abs(parseFloat(row.quantity_dispatched) - parseFloat(row.quantity_confirmed)) > 5;
                    return (
                      <tr key={row.id || i} className={isHighRisk ? 'high-risk-row' : ''}>
                        {columns.map(c => <td key={c.header}>{c.accessor(row)}</td>)}
                        {reportType === 'damages' && (
                          <td>
                            {row.receipt_url ? (
                              <button
                                type="button"
                                className="btn btn-outline"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                onClick={() => setSelectedReceipt(row.receipt_url)}
                              >
                                <Eye size={12} className="text-blue-600" />
                                <span>View</span>
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ReceiptViewerModal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        imageUrl={selectedReceipt}
        title="Damage Evidence Photo"
      />
    </div>
  );
};

export default ReportGeneration;
