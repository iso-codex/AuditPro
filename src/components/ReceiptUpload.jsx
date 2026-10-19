import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Upload, Camera, Eye, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import ReceiptViewerModal from './ReceiptViewerModal';

const ReceiptUpload = ({
  value,
  onChange,
  folder = 'general',
  disabled = false,
  required = false,
  label = 'Receipt Image',
  helpText = 'Upload a clear JPEG or PNG receipt image or capture via camera.'
}) => {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileSelected = async (file) => {
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB.');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const userId = profile?.id || 'anonymous';
      const filePath = `${folder}/${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      const url = publicUrlData.publicUrl;
      onChange(url);
    } catch (err) {
      console.error('Receipt upload error:', err);
      setError(err.message || 'Failed to upload receipt.');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    if (disabled || uploading) return;
    onChange('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="receipt-upload-component">
      {label && (
        <label className="form-label flex items-center justify-between mb-1">
          <span>
            {label} {required && <span className="text-red-500">*</span>}
          </span>
          {value && (
            <span className="text-xs text-green-600 flex items-center gap-1 font-normal">
              <CheckCircle size={14} /> Attached
            </span>
          )}
        </label>
      )}

      {error && (
        <div className="mb-2 p-2 rounded text-sm flex items-center gap-2 bg-red-50 text-red-700">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelected(e.target.files[0]);
          }
        }}
        disabled={disabled || uploading}
      />
      
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelected(e.target.files[0]);
          }
        }}
        disabled={disabled || uploading}
      />

      {value ? (
        <div 
          className="receipt-preview-card"
          style={{
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '6px',
            padding: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            backgroundColor: '#fff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
            <img
              src={value}
              alt="Receipt Thumbnail"
              style={{
                width: '54px',
                height: '54px',
                objectFit: 'cover',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                cursor: 'pointer'
              }}
              onClick={() => setViewerOpen(true)}
              title="Click to view full image"
            />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                Receipt Attached
              </div>
              <button
                type="button"
                className="btn btn-link p-0 text-xs"
                style={{ color: 'var(--accent-color, #2563eb)', textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer' }}
                onClick={() => setViewerOpen(true)}
              >
                View full image
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ padding: '0.4rem 0.6rem' }}
              onClick={() => setViewerOpen(true)}
              title="View full receipt"
            >
              <Eye size={16} />
            </button>
            {!disabled && (
              <button
                type="button"
                className="btn btn-outline text-red-500"
                style={{ padding: '0.4rem 0.6rem', color: 'var(--danger-color, #ef4444)' }}
                onClick={handleClear}
                title="Remove receipt"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="receipt-upload-dropzone"
          style={{
            border: '2px dashed var(--border-color, #cbd5e1)',
            borderRadius: '8px',
            padding: '1.25rem',
            textAlign: 'center',
            backgroundColor: 'var(--surface-color, #f8fafc)',
            transition: 'border-color 0.2s ease'
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center justify-center py-2">
              <div className="spinner mb-2"></div>
              <span className="text-sm text-gray-500">Uploading receipt image...</span>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Upload size={16} />
                  <span>Choose Image</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={disabled}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Camera size={16} />
                  <span>Take Photo</span>
                </button>
              </div>
              {helpText && <p className="text-xs text-gray-500 mb-0">{helpText}</p>}
            </div>
          )}
        </div>
      )}

      {/* Full Screen Image Modal */}
      <ReceiptViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        imageUrl={value}
        title={label || 'Receipt Preview'}
      />
    </div>
  );
};

export default ReceiptUpload;
