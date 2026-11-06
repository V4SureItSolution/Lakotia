import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const USER_TYPES_API = `${API_BASE}/usertype`;
const ACCESS_SAVE_API = `${API_BASE}/access-control`;
const ACCESS_GET_API = `${API_BASE}/access-control`;


export default function AccessControlPage() {
  const [userTypes, setUserTypes] = useState([]);
  const [selectedUserTypes, setSelectedUserTypes] = useState([]);
  const [accessAllowed, setAccessAllowed] = useState(false);

  useEffect(() => {
    loadUserTypes();
    loadSavedAccessControl(); // 🔥 Load saved settings
  }, []);

  // Load all user types
  const loadUserTypes = async () => {
    try {
      const res = await axios.get(USER_TYPES_API);
      if (res.data.success) {
        setUserTypes(res.data.data);
      }
    } catch (err) {
      toast.error("Failed to load user types!");
    }
  };

  // Load saved access control from DB
  const loadSavedAccessControl = async () => {
    try {
      const res = await axios.get(ACCESS_GET_API);

      if (res.data.success) {
        const saved = res.data.data;

        // Get only allowed user types
        const allowedUserTypes = saved
          .filter((x) => x.allow_access === true)
          .map((x) => x.user_type_id);

        setSelectedUserTypes(allowedUserTypes);

        // If at least one is allowed, set the main checkbox to true
        setAccessAllowed(allowedUserTypes.length > 0);
      }
    } catch (err) {
      toast.error("Failed to load saved access permissions!");
    }
  };

  // Checkbox toggle
  const handleCheckboxChange = (id) => {
    if (selectedUserTypes.includes(id)) {
      setSelectedUserTypes(selectedUserTypes.filter((u) => u !== id));
    } else {
      setSelectedUserTypes([...selectedUserTypes, id]);
    }
  };

  // Save access control
  const saveAccess = async () => {
    if (selectedUserTypes.length === 0) {
      toast.error("Select at least one user type!");
      return;
    }

    try {
      await axios.post(ACCESS_SAVE_API, {
        user_type_ids: selectedUserTypes,
        allow_access: accessAllowed ? 1 : 0,
      });

      toast.success("Access control saved!");
    } catch (err) {
      toast.error("Failed to save access control!");
    }
  };

  return (
    <div style={styles.container}>
      

      <h2 style={styles.heading}>User Type Access Control</h2>

      <div style={styles.card}>
        <label style={styles.label}>Select User Types</label>
        <div style={styles.checkboxGrid}>
          {userTypes.map((u) => (
            <label key={u.id} style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={selectedUserTypes.includes(u.id)}
                onChange={() => handleCheckboxChange(u.id)}
                style={styles.checkbox}
              />
              {u.name}
            </label>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <label style={styles.checkboxContainer}>
          <input
            type="checkbox"
            checked={accessAllowed}
            onChange={(e) => setAccessAllowed(e.target.checked)}
            style={styles.checkbox}
          />
          Allow Access for Selected User Types
        </label>

        <button style={styles.saveButton} onClick={saveAccess}>
          Save Access
        </button>
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    padding: "30px",
    minHeight: "100vh",
    backgroundColor: "#fdfdfd",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  heading: {
    marginBottom: "20px",
    color: "#333",
    fontSize: "22px",
    fontWeight: "600",
  },
  card: {
    width: "70%",
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "8px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
    marginBottom: "20px",
  },
  label: {
    fontWeight: "600",
    marginBottom: "10px",
    display: "block",
    color: "#333",
  },
  checkboxGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "10px",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    fontWeight: "500",
    fontSize: "14px",
  },
  checkbox: {
    marginRight: "10px",
    transform: "scale(1.2)",
  },
  checkboxContainer: {
    display: "flex",
    alignItems: "center",
    fontWeight: "600",
    marginBottom: "15px",
  },
  saveButton: {
    padding: "10px 20px",
    borderRadius: "6px",
    backgroundColor: "#f5c518",
    color: "#333",
    fontWeight: "600",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
  },
};
