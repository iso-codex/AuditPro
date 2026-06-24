import React from 'react';

const StatusBadge = ({ status }) => {
  let badgeClass = '';
  
  switch (status?.toLowerCase()) {
    case 'pending':
      badgeClass = 'badge-pending';
      break;
    case 'approved':
      badgeClass = 'badge-approved';
      break;
    case 'dispatched':
      badgeClass = 'badge-dispatched';
      break;
    case 'received':
      badgeClass = 'badge-received';
      break;
    case 'partially received':
      badgeClass = 'badge-partially';
      break;
    case 'rejected':
      badgeClass = 'badge-rejected';
      break;
    default:
      badgeClass = '';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
