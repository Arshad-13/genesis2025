import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, TrendingDown, X, User, Home, FileText } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { LogOut } from "lucide-react";
import Toast from './Toast';

export default function Sidebar({ isOpen, onClose, activePage = "home" }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const menuItems = [
    { id: "home", icon: Home, label: "Home", path: "/", active: true },
    {
      id: "dashboard",
      icon: BarChart3,
      label: "Dashboard",
      path: "/dashboard",
      active: false,
    },
    {
      id: "predict",
      icon: TrendingDown,
      label: "Market Predict",
      path: "/market-predict",
      active: false,
    },
    {
      id: "reports",
      icon: FileText,
      label: "Reports",
      path: "/reports",
      active: false,
    },
  ];

  const [activeItem, setActiveItem] = useState(activePage);
  const [toast, setToast] = useState(null);

  const handleItemClick = (item) => {
    setActiveItem(item.id);
    navigate(item.path);
  };

  const handleLogout = () => {
    setToast({ message: "Logged out successfully", type: "success" });
    setTimeout(() => {
      logout();
      navigate("/auth");
      onClose();
    }, 800);
  };

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            background: `
              radial-gradient(circle at 30% 70%, rgba(0, 255, 127, 0.05) 0%, transparent 50%),
              radial-gradient(circle at 70% 30%, rgba(0, 255, 127, 0.03) 0%, transparent 50%),
              rgba(0, 0, 0, 0.8)
            `
          }}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "280px",
          backgroundColor: "rgba(0, 20, 0, 0.95)",
          borderRight: "2px solid rgba(0, 255, 127, 0.3)",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          boxShadow: isOpen ? "4px 0 20px rgba(0, 255, 127, 0.2)" : "none",
          backdropFilter: "blur(12px)",
          fontFamily: "'Rajdhani', sans-serif",
          backgroundImage: `
            linear-gradient(135deg, rgba(0, 255, 127, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 20% 80%, rgba(0, 255, 127, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(0, 255, 127, 0.02) 0%, transparent 50%),
            linear-gradient(0deg, rgba(0, 255, 127, 0.01) 0px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 127, 0.01) 0px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 200px 200px, 150px 150px, 20px 20px, 20px 20px",
          backgroundPosition: "0 0, 0 0, 100% 0, 0 0, 0 0",
          backgroundRepeat: "no-repeat, no-repeat, no-repeat, repeat, repeat"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid rgba(0, 255, 127, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            background: "linear-gradient(135deg, rgba(0, 255, 127, 0.05) 0%, transparent 100%)"
          }}
        >
          {/* Subtle animated line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "2px",
              background: "linear-gradient(90deg, transparent, #00ff7f, transparent)",
              opacity: 0.4,
              animation: "cyber-scan 3s linear infinite"
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "rgba(0, 255, 127, 0.2)",
                border: "1px solid rgba(0, 255, 127, 0.4)",
                borderRadius: "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                boxShadow: "0 0 15px rgba(0, 255, 127, 0.3)",
                position: "relative",
                overflow: "hidden"
              }}
            >
              {/* Inner glow effect */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "60%",
                  height: "60%",
                  background: "radial-gradient(circle, rgba(0, 255, 127, 0.3) 0%, transparent 70%)",
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%"
                }}
              />
              <TrendingDown size={20} color="#00ff7f" />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#00ff7f",
                  fontFamily: "'Orbitron', monospace",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  textShadow: "0 0 10px rgba(0, 255, 127, 0.3)"
                }}
              >
                Trading Hub
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "rgba(0, 255, 127, 0.7)",
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Market Intelligence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "6px",
              backgroundColor: "transparent",
              border: "1px solid rgba(0, 255, 127, 0.3)",
              borderRadius: "0",
              color: "#00ff7f",
              cursor: "pointer",
              fontSize: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              position: "relative",
              overflow: "hidden"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0, 255, 127, 0.1)";
              e.currentTarget.style.borderColor = "#00ff7f";
              e.currentTarget.style.boxShadow = "0 0 15px rgba(0, 255, 127, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.borderColor = "rgba(0, 255, 127, 0.3)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Menu */}
        <div
          style={{
            flex: 1,
            padding: "16px",
            overflowY: "auto",
            position: "relative"
          }}
        >
          {/* Subtle background pattern */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `
                linear-gradient(45deg, rgba(0, 255, 127, 0.01) 25%, transparent 25%),
                linear-gradient(-45deg, rgba(0, 255, 127, 0.01) 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, rgba(0, 255, 127, 0.01) 75%),
                linear-gradient(-45deg, transparent 75%, rgba(0, 255, 127, 0.01) 75%)
              `,
              backgroundSize: "30px 30px",
              backgroundPosition: "0 0, 0 15px, 15px -15px, -15px 0px",
              opacity: 0.3,
              pointerEvents: "none"
            }}
          />

          <div
            style={{
              marginBottom: "20px",
              position: "relative",
              zIndex: 1
            }}
          >
            <p
              style={{
                margin: "0 0 8px 12px",
                fontSize: "11px",
                fontWeight: "700",
                color: "#00ff7f",
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontFamily: "'Orbitron', monospace"
              }}
            >
              Navigation
            </p>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  marginBottom: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  backgroundColor:
                    activeItem === item.id ? "rgba(0, 255, 127, 0.15)" : "transparent",
                  border: activeItem === item.id ? "1px solid rgba(0, 255, 127, 0.3)" : "1px solid transparent",
                  borderRadius: "0",
                  color: activeItem === item.id ? "#00ff7f" : "rgba(0, 255, 127, 0.7)",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: activeItem === item.id ? "700" : "600",
                  fontFamily: "'Rajdhani', sans-serif",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  textAlign: "left",
                  borderLeft:
                    activeItem === item.id
                      ? "3px solid #00ff7f"
                      : "3px solid transparent",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: activeItem === item.id ? "0 0 15px rgba(0, 255, 127, 0.2)" : "none"
                }}
                onMouseEnter={(e) => {
                  if (activeItem !== item.id) {
                    e.currentTarget.style.backgroundColor = "rgba(0, 255, 127, 0.08)";
                    e.currentTarget.style.color = "#00ff7f";
                    e.currentTarget.style.borderColor = "rgba(0, 255, 127, 0.2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeItem !== item.id) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "rgba(0, 255, 127, 0.7)";
                    e.currentTarget.style.borderColor = "transparent";
                  }
                }}
              >
                {/* Hover effect overlay */}
                {activeItem === item.id && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: "-100%",
                      width: "100%",
                      height: "100%",
                      background: "linear-gradient(90deg, transparent, rgba(0, 255, 127, 0.1), transparent)",
                      animation: "cyber-scan 2s linear infinite"
                    }}
                  />
                )}
                <span style={{ fontSize: "18px", position: "relative", zIndex: 1 }}>
                  <item.icon size={18} />
                </span>
                <span style={{ position: "relative", zIndex: 1 }}>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Stats */}
          <div
            style={{
              marginTop: "24px",
              padding: "16px",
              backgroundColor: "rgba(0, 20, 0, 0.8)",
              borderRadius: "0",
              border: "1px solid rgba(0, 255, 127, 0.3)",
              position: "relative",
              overflow: "hidden",
              backdropFilter: "blur(8px)"
            }}
          >
            {/* Animated border effect */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                background: "linear-gradient(90deg, transparent, #00ff7f, transparent)",
                opacity: 0.6,
                animation: "cyber-scan 4s linear infinite"
              }}
            />

            <p
              style={{
                margin: "0 0 12px 0",
                fontSize: "11px",
                fontWeight: "700",
                color: "#00ff7f",
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontFamily: "'Orbitron', monospace"
              }}
            >
              System Status
            </p>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "13px", color: "rgba(0, 255, 127, 0.8)", fontFamily: "'Rajdhani', sans-serif", fontWeight: "600" }}>
                  Active Signals
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#ff3232",
                    fontFamily: "'Orbitron', monospace",
                    textShadow: "0 0 8px rgba(255, 50, 50, 0.5)"
                  }}
                >
                  3
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "13px", color: "rgba(0, 255, 127, 0.8)", fontFamily: "'Rajdhani', sans-serif", fontWeight: "600" }}>
                  Market Status
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#00ff7f",
                    padding: "2px 8px",
                    backgroundColor: "rgba(0, 255, 127, 0.15)",
                    borderRadius: "0",
                    border: "1px solid rgba(0, 255, 127, 0.3)",
                    fontFamily: "'Orbitron', monospace",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    boxShadow: "0 0 10px rgba(0, 255, 127, 0.2)"
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
            borderTop: "1px solid rgba(0, 255, 127, 0.2)",
            background: "linear-gradient(135deg, rgba(0, 255, 127, 0.03) 0%, transparent 100%)",
            position: "relative"
          }}
        >
          {/* Subtle footer glow */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "80%",
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(0, 255, 127, 0.5), transparent)",
              opacity: 0.6
            }}
          />
          {/* User Info */}
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                backgroundColor: "rgba(0, 255, 127, 0.2)",
                border: "1px solid rgba(0, 255, 127, 0.4)",
                borderRadius: "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "700",
                color: "#00ff7f",
                fontFamily: "'Orbitron', monospace",
                boxShadow: "0 0 15px rgba(0, 255, 127, 0.3)",
                position: "relative",
                overflow: "hidden"
              }}
            >
              {/* Inner pulse effect */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "80%",
                  height: "80%",
                  background: "radial-gradient(circle, rgba(0, 255, 127, 0.2) 0%, transparent 70%)",
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%",
                  animation: "pulse 2s infinite"
                }}
              />
              <span style={{ position: "relative", zIndex: 1 }}>
                {user ? getInitials(user.name) : "U"}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#00ff7f",
                  fontFamily: "'Rajdhani', sans-serif",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textShadow: "0 0 8px rgba(0, 255, 127, 0.3)"
                }}
              >
                {user?.name || "Guest User"}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "rgba(0, 255, 127, 0.7)",
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: "600",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user?.email || "No email"}
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <div style={{ padding: "0 16px 16px 16px" }}>
            <button
              onClick={handleLogout}
              style={{
                width: "100%",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                backgroundColor: "transparent",
                border: "1px solid rgba(255, 50, 50, 0.3)",
                borderRadius: "0",
                color: "#ff3232",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "700",
                fontFamily: "'Rajdhani', sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                overflow: "hidden"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 50, 50, 0.1)";
                e.currentTarget.style.borderColor = "#ff3232";
                e.currentTarget.style.boxShadow = "0 0 15px rgba(255, 50, 50, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor = "rgba(255, 50, 50, 0.3)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
