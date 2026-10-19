import React from 'react';

const StatusBadge = ({ status }) => {
  const normalized = (status || '').toLowerCase().replace(/[\s-]/g, '_');
  let badgeClass = 'badge-pending';
  let label = status;

  switch (normalized) {
    case 'pending_manager':
      badgeClass = 'badge-pending';
      label = 'Pending Manager';
      break;
    case 'pending_store':
      badgeClass = 'badge-approved';
      label = 'Pending Store';
      break;
    case 'pending':
      badgeClass = 'badge-pending';
      label = 'Pending';
      break;
    case 'approved':
      badgeClass = 'badge-approved';
      label = 'Approved';
      break;
    case 'dispatched':
      badgeClass = 'badge-dispatched';
      label = 'Dispatched';
      break;
    case 'received':
    case 'completed':
      badgeClass = 'badge-received';
      label = status === 'Completed' ? 'Completed' : 'Received';
      break;
    case 'partially_received':
      badgeClass = 'badge-partially';
      label = 'Partially Received';
      break;
    case 'rejected':
      badgeClass = 'badge-rejected';
      label = 'Rejected';
      break;
    default:
      badgeClass = 'badge-pending';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
