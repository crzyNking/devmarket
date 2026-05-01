import React, { useEffect } from 'react';

export function Toast({ notification, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(notification.id), 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  return (
    <div className={`toast toast-${notification.type || 'info'}`}>
      <div className="toast-content">
        <span className="toast-icon">{icons[notification.type] || '📢'}</span>
        <div className="toast-body">
          <p className="toast-message">{notification.message}</p>
          <span className="toast-time">{notification.time || new Date().toLocaleTimeString()}</span>
        </div>
      </div>
      <button className="toast-close" onClick={() => onClose(notification.id)}>×</button>
    </div>
  );
}