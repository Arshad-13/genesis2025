import { useState } from 'react';

export default function Sidebar({ isOpen, onClose }) {
  const menuItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', active: true },
    { id: 'analytics', icon: '📈', label: 'Analytics', active: false },
    { id: 'reports', icon: '📄', label: 'Reports', active: false },
    { id: 'settings', icon: '⚙️', label: 'Settings', active: false },
  ];

  const [activeItem, setActiveItem] = useState('dashboard');

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
          }}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '280px',
          backgroundColor: '#1e293b',
          borderRight: '2px solid #334155',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease-in-out',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isOpen ? '4px 0 12px rgba(0, 0, 0, 0.3)' : 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#3b82f6',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}
            >
              📉
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#e2e8f0',
                }}
              >
                Trading Hub
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#94a3b8',
                }}
              >
                Market Analytics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#334155';
              e.currentTarget.style.color = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            ✕
          </button>
        </div>

        {/* Navigation Menu */}
        <div
          style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              marginBottom: '20px',
            }}
          >
            <p
              style={{
                margin: '0 0 8px 12px',
                fontSize: '11px',
                fontWeight: '600',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Navigation
            </p>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveItem(item.id)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor:
                    activeItem === item.id ? '#334155' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: activeItem === item.id ? '#3b82f6' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: activeItem === item.id ? '600' : '500',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  borderLeft:
                    activeItem === item.id
                      ? '3px solid #3b82f6'
                      : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (activeItem !== item.id) {
                    e.currentTarget.style.backgroundColor = '#2d3748';
                    e.currentTarget.style.color = '#cbd5e1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeItem !== item.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
              >
                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Stats */}
          <div
            style={{
              marginTop: '24px',
              padding: '16px',
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              border: '1px solid #334155',
            }}
          >
            <p
              style={{
                margin: '0 0 12px 0',
                fontSize: '11px',
                fontWeight: '600',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Quick Stats
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                  Active Signals
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#ef4444',
                  }}
                >
                  3
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                  Market Status
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#10b981',
                    padding: '2px 8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '12px',
                  }}
                >
                  LIVE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
            }}
          >
            👤
          </div>
          <div style={{ flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: '600',
                color: '#e2e8f0',
              }}
            >
              Trader User
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                color: '#64748b',
              }}
            >
              trader@market.com
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
