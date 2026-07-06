import { useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Toast from "../components/Toast";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [toast, setToast] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (isLogin) {
      if (!formData.email || !formData.password) {
        setError("Please fill in all fields");
        setIsLoading(false);
        return;
      }

      const result = await login(formData.email, formData.password);

      if (result.success) {
        setToast({
          message: "Login successful! Redirecting...",
          type: "success",
        });
        setTimeout(() => {
          navigate("/dashboard");
        }, 1000); // Small delay for user to see the toast
      } else {
        setError(result.error || "Login failed");
        setToast({ message: result.error || "Login failed", type: "error" });
      }
    } else {
      if (
        !formData.name ||
        !formData.email ||
        !formData.password ||
        !formData.confirmPassword
      ) {
        setError("Please fill in all fields");
        setIsLoading(false);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        setToast({ message: "Passwords do not match", type: "error" });
        setIsLoading(false);
        return;
      }
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters");
        setToast({
          message: "Password must be at least 6 characters",
          type: "error",
        });
        setIsLoading(false);
        return;
      }

      const result = await register(
        formData.name,
        formData.email,
        formData.password
      );

      if (result.success) {
        setToast({
          message: "Account created successfully! Redirecting...",
          type: "success",
        });
        setTimeout(() => {
          navigate("/dashboard");
        }, 1000); // Small delay for user to see the toast
      } else {
        setError(result.error || "Registration failed");
        setToast({
          message: result.error || "Registration failed",
          type: "error",
        });
      }
    }

    setIsLoading(false);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0f0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "'Rajdhani', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          height: "600px",
          position: "relative",
          backgroundColor: "rgba(0, 20, 0, 0.8)",
          borderRadius: "0",
          border: "1px solid rgba(0, 255, 127, 0.3)",
          boxShadow: "0 0 40px rgba(0, 255, 127, 0.1)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        {/* Sliding Overlay Panel */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: isLogin ? "50%" : "0",
            width: "50%",
            height: "100%",
            background: "linear-gradient(135deg, #009b4eff 0%, #038343ff 100%)",
            transition: "left 0.6s ease-in-out",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          {/* Abstract Background Graphics */}
          <div
            style={{
              position: "absolute",
              top: "-20%",
              right: "-10%",
              width: "200px",
              height: "200px",
              border: "2px solid rgba(255, 255, 255, 0.25)",
              borderRadius: "0",
              transform: "rotate(45deg)",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-15%",
              left: "-15%",
              width: "150px",
              height: "150px",
              border: "3px solid rgba(255, 255, 255, 0.3)",
              borderRadius: "0",
              transform: "rotate(30deg)",
              opacity: 0.5,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "20%",
              left: "-5%",
              width: "100px",
              height: "100px",
              background: "rgba(255, 255, 255, 0.15)",
              transform: "rotate(60deg)",
              opacity: 0.7,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "30%",
              right: "-8%",
              width: "80px",
              height: "80px",
              border: "2px solid rgba(255, 255, 255, 0.35)",
              transform: "rotate(15deg)",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "10%",
              right: "20%",
              width: "60px",
              height: "60px",
              background: "rgba(255, 255, 255, 0.1)",
              transform: "rotate(75deg)",
              opacity: 0.5,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "10%",
              left: "15%",
              width: "40px",
              height: "40px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              transform: "rotate(90deg)",
              opacity: 0.8,
            }}
          />
          
          <div
            style={{
              width: "80px",
              height: "80px",
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "24px",
              backdropFilter: "blur(10px)",
              position: "relative",
              zIndex: 2,
            }}
          >
            <BarChart3 size={40} color="white" />
          </div>

          <h2
            style={{
              fontSize: "32px",
              fontWeight: "700",
              margin: "0 0 16px 0",
              textShadow: "0 2px 4px rgba(0,0,0,0.1)",
              fontFamily: "'Orbitron', monospace",
              letterSpacing: "1px",
            }}
          >
            {isLogin ? "New to Trading Hub?" : "Welcome Back!"}
          </h2>

          <p
            style={{
              fontSize: "15px",
              margin: "0 0 32px 0",
              opacity: 0.9,
              lineHeight: "1.6",
              padding: "40px",
            }}
          >
            {isLogin
              ? "Create an account and start your trading journey with advanced market analytics"
              : "Sign in to continue your trading journey and access real-time market insights"}
          </p>

          <button
            onClick={toggleMode}
            style={{
              padding: "12px 32px",
              backgroundColor: "transparent",
              border: "2px solid white",
              borderRadius: "25px",
              color: "white",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.3s",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "white";
              e.currentTarget.style.color = "#00ff7f";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "white";
            }}
          >
            {isLogin ? "Sign Up" : "Sign In"}
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Login Form */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "50%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // padding: "20px 20px",
            opacity: isLogin ? 1 : 0,
            pointerEvents: isLogin ? "auto" : "none",
            transition: "opacity 0.6s ease-in-out",
          }}
        >
          <div style={{ width: "100%", maxWidth: "360px" }}>
            <h2
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#e2e8f0",
                margin: "0 0 8px 0",
              }}
            >
              Sign In
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#94a3b8",
                margin: "0 0 28px 0",
              }}
            >
              Enter your credentials to access your account
            </p>

            {error && (
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "0",
                  color: "#fca5a5",
                  fontSize: "13px",
                  marginBottom: "20px",
                }}
              >
                {error}
              </div>
            )}

            {/* Email Input */}
            <div style={{ marginBottom: "18px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                Email Address
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={18}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="username@email.com"
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 40px",
                    backgroundColor: "rgba(0, 20, 0, 0.6)",
                    border: "1px solid rgba(0, 255, 127, 0.3)",
                    borderRadius: "0",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#1a4d3a")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(0, 255, 127, 0.3)")}
                />
              </div>
            </div>

            {/* Password Input */}
            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={18}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "12px 40px",
                    backgroundColor: "rgba(0, 20, 0, 0.6)",
                    border: "1px solid rgba(0, 255, 127, 0.3)",
                    borderRadius: "0",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#1a4d3a")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(0, 255, 127, 0.3)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: "#029e65ff",
                border: "none",
                borderRadius: "0",
                color: "white",
                fontSize: "15px",
                fontWeight: "600",
                cursor: isLoading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: isLoading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLoading)
                  e.currentTarget.style.backgroundColor = "#027444ff";
              }}
              onMouseLeave={(e) => {
                if (!isLoading)
                  e.currentTarget.style.backgroundColor = "#029e65ff";
              }}
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </button>

            {/* Test Credentials Card */}
            <div
              onClick={() => setFormData(f => ({
                ...f,
                email: "test@example.com",
                password: "password123"
              }))}
              style={{
                marginTop: "20px",
                padding: "10px 12px",
                border: "1px dashed rgba(0, 255, 127, 0.4)",
                background: "rgba(0, 255, 127, 0.05)",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                gap: "2px"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0, 255, 127, 0.1)";
                e.currentTarget.style.borderColor = "#00ff7f";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0, 255, 127, 0.05)";
                e.currentTarget.style.borderColor = "rgba(0, 255, 127, 0.4)";
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#00ff7f", fontFamily: "'Orbitron', monospace", letterSpacing: "0.5px" }}>
                CLICK TO AUTOFILL DEMO ACCOUNT
              </div>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                test@example.com / password123
              </div>
            </div>
          </div>
        </div>

        {/* Register Form */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "50%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // padding: "60px 50px",
            opacity: !isLogin ? 1 : 0,
            pointerEvents: !isLogin ? "auto" : "none",
            transition: "opacity 0.6s ease-in-out",
          }}
        >
          <div style={{ width: "100%", maxWidth: "360px" }}>
            <h2
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#e2e8f0",
                margin: "0 0 8px 0",
              }}
            >
              Create Account
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#94a3b8",
                margin: "0 0 24px 0",
              }}
            >
              Sign up to start your trading journey
            </p>

            {error && (
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "0",
                  color: "#fca5a5",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {error}
              </div>
            )}

            {/* Name Input */}
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                Full Name
              </label>
              <div style={{ position: "relative" }}>
                <User
                  size={18}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 40px",
                    backgroundColor: "rgba(0, 20, 0, 0.6)",
                    border: "1px solid rgba(0, 255, 127, 0.3)",
                    borderRadius: "0",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#1a4d3a")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(0, 255, 127, 0.3)")}
                />
              </div>
            </div>

            {/* Email Input */}
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                Email Address
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={18}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="username@email.com"
                  style={{
                    width: "100%",
                    padding: "12px 12px 12px 40px",
                    backgroundColor: "rgba(0, 20, 0, 0.6)",
                    border: "1px solid rgba(0, 255, 127, 0.3)",
                    borderRadius: "0",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#1a4d3a")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(0, 255, 127, 0.3)")}
                />
              </div>
            </div>

            {/* Password Input */}
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={18}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "12px 40px",
                    backgroundColor: "rgba(0, 20, 0, 0.6)",
                    border: "1px solid rgba(0, 255, 127, 0.3)",
                    borderRadius: "0",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#1a4d3a")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(0, 255, 127, 0.3)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                Confirm Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={18}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "12px 40px",
                    backgroundColor: "rgba(0, 20, 0, 0.6)",
                    border: "1px solid rgba(0, 255, 127, 0.3)",
                    borderRadius: "0",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#1a4d3a")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(0, 255, 127, 0.3)")}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: "#029e65ff",
                border: "none",
                borderRadius: "0",
                color: "white",
                fontSize: "15px",
                fontWeight: "600",
                cursor: isLoading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: isLoading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLoading)
                  e.currentTarget.style.backgroundColor = "#00784cff";
              }}
              onMouseLeave={(e) => {
                if (!isLoading)
                  e.currentTarget.style.backgroundColor = "#029e65ff";
              }}
            >
              {isLoading ? "Creating Account..." : "Sign Up"}
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
    </div>
  );
}
