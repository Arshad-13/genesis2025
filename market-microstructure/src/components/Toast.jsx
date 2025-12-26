import { useEffect } from 'react';

export default function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: { bg: '#10b981', border: '#059669' },
    error: { bg: '#ef4444', border: '#dc2626' },
    info: { bg: '#3b82f6', border: '#2563eb' },
    warning: { bg: '#f59e0b', border: '#d97706' }
  };

  const color = colors[type] || colors.info;

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: '20px',
      backgroundColor: color.bg,
      color: '#ffffff',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      border: `2px solid ${color.border}`,
      zIndex: 10000,
      animation: 'slideIn 0.3s ease-out',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: '200px',
      maxWidth: '400px'
    }}>
      <span style={{ fontSize: '16px' }}>
        {type === 'success' && '\u2705'}
        {type === 'error' && '\u274c'}
        {type === 'info' && '\u2139\ufe0f'}
        {type === 'warning' && '\u26a0\ufe0f'}
      </span>
      <span style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#ffffff',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '0 4px'
        }}
      >
        \u00d7
      </button>
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
