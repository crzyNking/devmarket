import React from 'react';

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', type = 'info' }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>
          {type === 'danger' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}
        </div>
        <h3 style={{ marginBottom: '8px', color: 'var(--gray-800)' }}>{title}</h3>
        <p style={{ color: 'var(--gray-500)', marginBottom: '24px', lineHeight: '1.6' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn-primary"
            onClick={onConfirm}
            style={{ background: type === 'danger' ? 'var(--danger)' : 'var(--primary)' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}