import React, { useState, useRef, useEffect } from "react";
import { FaBars } from "react-icons/fa";

const Header = ({ onLogout, onToggleSidebar }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [user, setUser] = useState({ username: "User", email: "No email", id: "" });
  const dropdownRef = useRef();

  // ✅ Load user details from localStorage (updated)
  useEffect(() => {
    const username = localStorage.getItem("username");
    const email = localStorage.getItem("email");
    const id = localStorage.getItem("user_id");

    setUser({
      username: username || "User",
      email: email || "No email",
      id: id || "",
    });
  }, []);

  // ✅ Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Handle logout
  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.removeItem("is_authenticated");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.removeItem("user_id");
    localStorage.removeItem("login_type");
    localStorage.removeItem("usertype");
    localStorage.removeItem("user_type_id");
    if (onLogout) onLogout();
  };

  return (
    <header style={styles.header}>
      {/* Left Section */}
      <div style={styles.leftSection}>
        <button
          style={styles.toggleButton}
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <FaBars />
        </button>
        <div style={styles.brand}>Lakhotia WorkFlow</div>
      </div>

      {/* Right Section */}
      <div style={styles.userSection} ref={dropdownRef}>
        <div
          style={styles.profileCircle}
          onClick={() => setShowDropdown(!showDropdown)}
        >
          {user.username ? user.username.charAt(0).toUpperCase() : "U"}
        </div>

        {showDropdown && (
          <div style={styles.dropdown}>
            <div style={styles.userInfoDropdown}>
              <div style={styles.userName}>{user.username}</div>
              <div style={styles.userEmail}>{user.email}</div>
            </div>
            <button style={styles.logoutButton} onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

// 🎨 Styling
const styles = {
  header: {
    backgroundColor: "#fff8dc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    height: "60px",
    padding: "0 25px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    position: "sticky",
    top: 0,
    zIndex: 100,
    fontFamily: "'Poppins', sans-serif",
  },
  leftSection: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  toggleButton: {
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    color: "#333",
    padding: "6px",
    borderRadius: "6px",
    transition: "background 0.3s",
  },
  brand: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#222",
    letterSpacing: "0.5px",
  },
  userSection: {
    position: "relative",
    cursor: "pointer",
  },
  profileCircle: {
    backgroundColor: "#3b82f6",
    color: "#fff",
    fontWeight: "bold",
    borderRadius: "50%",
    width: "36px",
    height: "36px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "16px",
    transition: "transform 0.2s",
  },
  dropdown: {
    position: "absolute",
    top: "45px",
    right: "0",
    backgroundColor: "#fff",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    borderRadius: "10px",
    padding: "12px",
    zIndex: 30,
    minWidth: "180px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  userInfoDropdown: {
    borderBottom: "1px solid #eee",
    paddingBottom: "8px",
  },
  userName: {
    fontWeight: "600",
    color: "#333",
    fontSize: "15px",
  },
  userEmail: {
    fontSize: "13px",
    color: "#555",
  },
  logoutButton: {
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    padding: "8px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px",
    transition: "background 0.3s",
  },
};

export default Header;
