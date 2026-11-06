// Login.js
import React, { useState } from "react";
import { FaUserCircle, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Logo from "./Name1.jpg";
import { API_BASE } from "../config";

const Login = ({ onLogin }) => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔐 MAIN LOGIN FUNCTION
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      // 1️⃣ EMPLOYEE LOGIN
      const empResponse = await fetch(
        `${API_BASE}/employee/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );
      const empData = await empResponse.json();

      if (empResponse.ok && empData.success) {
        handleSuccessfulLogin(empData.user, "common");
        return;
      }

      // 2️⃣ AUTH LOGIN
      const authResponse = await fetch(
        `${API_BASE}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );
      const authData = await authResponse.json();

      if (authResponse.ok && authData.success) {
        handleSuccessfulLogin(authData.user, "common");
        return;
      }

      // 3️⃣ COMPANY LOGIN
      const companyResponse = await fetch(
        `${API_BASE}/company/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );
      const companyData = await companyResponse.json();

      if (companyResponse.ok && companyData.success) {
        handleSuccessfulLogin(companyData.company, "company", "Customer");
        return;
      }

      // ❌ ALL FAILED
      alert(
        empData.message ||
          authData.message ||
          companyData.message ||
          "Login failed. Try again."
      );
    } catch (error) {
      console.error("Login Error:", error);
      alert(`Unable to connect to backend server (${API_BASE}). Please ensure backend (python run.py) is running.\n\nError: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 🎯 SAVE LOGIN DETAILS + REDIRECT
  const handleSuccessfulLogin = (
    user,
    loginType,
    forcedUserType = null
  ) => {
    alert("Login successful!");

    // ✅ FIXED: camelCase keys
    const displayName =
      user.username ||
      user.name ||
      user.fullname ||
      user.customerName ||
      "Unknown User";

    const userType =
      forcedUserType ||
      user.userType ||
      user.user_type ||
      user.usertype ||
      user.role ||
      "Common";

    const userTypeId =
      user.user_type_id ||
      user.userTypeId ||
      user.usertype_id ||
      0;

    const userId = user.id || user.company_id || 0;
    const userEmail = user.email || user.customerEmail || "";

    // 💾 SESSION & COMMON STORAGE
    sessionStorage.setItem("is_authenticated", "true");
    sessionStorage.setItem("user_id", userId);
    sessionStorage.setItem("username", displayName);
    sessionStorage.setItem("email", userEmail);
    sessionStorage.setItem("login_type", loginType);
    sessionStorage.setItem("usertype", userType);
    sessionStorage.setItem("user_type_id", userTypeId);

    localStorage.removeItem("is_authenticated");
    localStorage.setItem("user_id", userId);
    localStorage.setItem("username", displayName);
    localStorage.setItem("email", userEmail);
    localStorage.setItem("login_type", loginType);
    localStorage.setItem("usertype", userType);
    localStorage.setItem("user_type_id", userTypeId);

    // ✅ COMPANY-SPECIFIC STORAGE (FIXED)
    if (loginType === "company") {
      localStorage.setItem(
        "company_customer_name",
        user.customerName || ""
      );
      localStorage.setItem(
        "company_login_email",
        user.customerEmail || ""
      );
    }

    // 🚀 FINAL REDIRECT
    if (loginType === "company") {
      navigate("/company-dashboard", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }

    if (onLogin) onLogin(userEmail);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img src={Logo} alt="Logo" style={styles.logo} />
          <p style={styles.subtitle}>Please sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* EMAIL */}
          <div style={styles.inputGroup}>
            <FaUserCircle style={styles.icon} />
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
            />
          </div>

          {/* PASSWORD */}
          <div style={styles.inputGroup}>
            <FaLock style={styles.icon} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
            />
            <span
              style={styles.eyeIcon}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

// 🎨 STYLES
const styles = {
  container: {
    height: "100vh",
    backgroundColor: "#fff8dc",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Poppins, sans-serif",
  },
  card: {
    background: "white",
    padding: "50px 40px",
    borderRadius: "20px",
    boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
    width: "380px",
    textAlign: "center",
  },
  header: { marginBottom: "25px" },
  logo: { width: "200px", marginBottom: "15px" },
  subtitle: { color: "#666", fontSize: "14px" },
  form: { display: "flex", flexDirection: "column", gap: "20px" },
  inputGroup: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#fafafa",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "10px",
  },
  icon: { marginRight: "10px", color: "#f5c518" },
  eyeIcon: { cursor: "pointer", color: "#999" },
  input: {
    border: "none",
    outline: "none",
    width: "100%",
    background: "transparent",
    fontSize: "15px",
  },
  button: {
    marginTop: "10px",
    padding: "12px",
    backgroundColor: "#f5c518",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "16px",
  },
};

export default Login;
