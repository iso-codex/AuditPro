import React from 'react';
import { History, Clock, User, CheckCircle, FileEdit, PlusCircle, Lock } from 'lucide-react';

const ProcurementFormTimeline = ({ history = [] }) => {
  if (!history || history.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-3 text-center italic">
        No edit history recorded yet.
      </div>
    );
  }

  const getActionIcon = (action) => {
    switch (action) {
      case 'Created':
        return <PlusCircle size={16} className="text-blue-500" />;
      case 'Saved':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'Updated':
        return <FileEdit size={16} className="text-amber-500" />;
      case 'Completed':
        return <Lock size={16} className="text-purple-600" />;
      default:
        return <Clock size={16} className="text-gray-400" />;
    }
  };

  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'Created':
        return 'bg-blue-100 text-blue-800';
      case 'Saved':
        return 'bg-green-100 text-green-800';
      case 'Updated':
        return 'bg-amber-100 text-amber-800';
      case 'Completed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="procurement-timeline">
      <h4 className="flex items-center gap-2 mb-4 text-base font-semibold">
        <History size={18} /> Revision & Sign-off History
      </h4>

      <div style={{ position: 'relative', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border-color, #e2e8f0)' }}>
        {history.map((entry, idx) => {
          const timestamp = entry.created_at ? new Date(entry.created_at).toLocaleString() : '-';
          const userName = entry.profiles?.full_name || 'Staff';

          return (
            <div key={entry.id || idx} style={{ marginBottom: '1.25rem', position: 'relative' }}>
              {/* Dot */}
              <div 
                style={{ 
                  position: 'absolute', 
                  left: '-1.95rem', 
                  top: '0.1rem',
                  backgroundColor: '#fff',
                  borderRadius: '50%',
                  padding: '2px'
                }}
              >
                {getActionIcon(entry.action)}
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getActionBadgeClass(entry.action)}`}>
                  {entry.action}
                </span>
                <span className="text-sm font-medium">{userName}</span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock size={12} /> {timestamp}
                </span>
              </div>

              {entry.changes && (
                <div 
                  className="text-xs text-gray-600 mt-1 p-2 rounded"
                  style={{ backgroundColor: 'var(--surface-color, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}
                >
                  {typeof entry.changes === 'string' ? (
                    entry.changes
                  ) : entry.changes.summary ? (
                    <div>{entry.changes.summary}</div>
                  ) : (
                    <div>
                      {entry.changes.old && <div><strong>Previous:</strong> {JSON.stringify(entry.changes.old)}</div>}
                      {entry.changes.new && <div><strong>New:</strong> {JSON.stringify(entry.changes.new)}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProcurementFormTimeline;
