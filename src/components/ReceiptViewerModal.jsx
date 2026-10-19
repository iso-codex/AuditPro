import React from 'react';
import { X, ExternalLink, Download } from 'lucide-react';

const ReceiptViewerModal = ({ isOpen, onClose, imageUrl, title = 'Receipt Preview' }) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div 
      className="modal-backdrop" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div 
          className="modal-header"
          style={{
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a 
              href={imageUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-outline"
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
              title="Open in new tab"
            >
              <ExternalLink size={16} />
              <span className="hide-on-mobile">Full Tab</span>
            </a>
            <button 
              type="button" 
              onClick={onClose}
              className="btn btn-outline"
              style={{ padding: '0.35rem', border: 'none' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div 
          className="modal-body"
          style={{
            padding: '1rem',
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            minHeight: '200px'
          }}
        >
          <img 
            src={imageUrl} 
            alt="Receipt" 
            style={{
              maxWidth: '100%',
              maxHeight: '75vh',
              objectFit: 'contain',
              borderRadius: '4px'
            }} 
          />
        </div>
      </div>
    </div>
  );
};

export default ReceiptViewerModal;
