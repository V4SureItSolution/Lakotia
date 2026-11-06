// ✅ SettingsMatrix.js - UPDATED VERSION
import React, { useState, useEffect } from "react";
import { API_BASE } from "../config";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { menuItems } from "./Sidebar"; // ✅ Static modules from Sidebar.js

const USER_TYPE_API = `${API_BASE}/usertype`;
const PERMISSION_API = `${API_BASE}/permissions`;


// ✅ Helper to get ALL modules from menuItems
const getAllModules = () => {
  const allModules = [];
  menuItems.forEach(category => {
    category.items.forEach(item => {
      allModules.push({
        name: item.name,
        category: category.category,
        path: item.path
      });
    });
  });
  return allModules;
};

const SettingsMatrix = () => {
  const [userTypes, setUserTypes] = useState([]);
  const [modules, setModules] = useState([]);
  const [accessMatrix, setAccessMatrix] = useState({});
  const [loading, setLoading] = useState(true);

  // ✅ Fetch user types & modules initially
  useEffect(() => {
    fetchUserTypes();
    const allModules = getAllModules();
    setModules(allModules);
    console.log("All modules loaded:", allModules); // Debug log
  }, []);

  // ✅ Fetch all user types
  const fetchUserTypes = async () => {
    try {
      setLoading(true);
      const res = await fetch(USER_TYPE_API);
      const data = await res.json();

      if (data.success) {
        setUserTypes(data.data);
        initializeMatrix(data.data);
        fetchPermissions(data.data);
      } else {
        toast.error("Failed to load user types!");
      }
    } catch (error) {
      console.error("UserType Fetch Error:", error);
      toast.error("Error loading user types!");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Initialize empty access matrix
  const initializeMatrix = (userTypesList) => {
    const initialMatrix = {};
    const allModules = getAllModules();
    
    userTypesList.forEach((ut) => {
      initialMatrix[ut.id] = {};
      allModules.forEach((mod) => {
        initialMatrix[ut.id][mod.name] = false;
      });
    });
    setAccessMatrix(initialMatrix);
  };

  // ✅ Fetch permissions and update matrix
  const fetchPermissions = async (userTypesList) => {
    try {
      const res = await fetch(PERMISSION_API);
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        const updatedMatrix = {};
        const allModules = getAllModules();
        
        userTypesList.forEach((ut) => {
          updatedMatrix[ut.id] = {};
          allModules.forEach((mod) => {
            const permission = data.data.find(
              (p) =>
                p.user_type_id === ut.id && p.module_name === mod.name
            );
            updatedMatrix[ut.id][mod.name] = permission
              ? permission.can_view === true || permission.can_view === 1
              : false;
          });
        });
        setAccessMatrix(updatedMatrix);
        console.log("Permissions matrix updated:", updatedMatrix); // Debug log
      } else {
        toast.error("Failed to load permissions!");
      }
    } catch (error) {
      console.error("Permission Fetch Error:", error);
      toast.error("Error loading permissions!");
    }
  };

  // ✅ Handle checkbox toggle
  const handleCheckboxChange = (userTypeId, moduleName) => {
    setAccessMatrix((prev) => ({
      ...prev,
      [userTypeId]: {
        ...prev[userTypeId],
        [moduleName]: !prev[userTypeId][moduleName],
      },
    }));
  };

  // ✅ Save settings to backend
  const handleSave = async () => {
    const updates = [];
    const allModules = getAllModules();

    Object.entries(accessMatrix).forEach(([userTypeId, modulesAccess]) => {
      Object.entries(modulesAccess).forEach(([moduleName, hasAccess]) => {
        // Only include modules that exist in our list
        if (allModules.find(m => m.name === moduleName)) {
          updates.push({
            user_type_id: parseInt(userTypeId),
            module_name: moduleName,
            can_view: hasAccess ? 1 : 0,
          });
        }
      });
    });

    console.log("Saving updates:", updates); // Debug log

    try {
      const res = await fetch(`${PERMISSION_API}/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Settings updated successfully!");
      } else {
        toast.error("Failed to update settings!");
      }
    } catch (error) {
      console.error("Save Error:", error);
      toast.error("Error saving settings!");
    }
  };

  // ✅ Group modules by category for better display
  const modulesByCategory = modules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {});

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      
      <h2 style={styles.heading}>Settings</h2>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>User Type</th>
              {Object.entries(modulesByCategory).map(([category, catModules]) => (
                <th key={category} colSpan={catModules.length} style={styles.categoryHeader}>
                  {category}
                </th>
              ))}
            </tr>
            <tr>
              <th style={styles.th}></th>
              {modules.map((mod, index) => (
                <th key={index} style={styles.moduleHeader} title={mod.path}>
                  {mod.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {userTypes.map((ut) => (
              <tr key={ut.id}>
                <td style={{...styles.td, fontWeight: "bold"}}>{ut.name}</td>
                {modules.map((mod, index) => (
                  <td key={index} style={styles.td}>
                    <input
                      type="checkbox"
                      checked={accessMatrix[ut.id]?.[mod.name] || false}
                      onChange={() => handleCheckboxChange(ut.id, mod.name)}
                      style={styles.checkbox}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.buttonContainer}>
        <button style={styles.saveButton} onClick={handleSave}>
          💾 Save Settings
        </button>
        <button 
          style={styles.refreshButton} 
          onClick={fetchUserTypes}
          title="Refresh data from server"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

// ✅ Styles
const styles = {
  container: {
    padding: "20px",
    backgroundColor: "#f5f7fa",
    minHeight: "100vh",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontSize: "18px",
    color: "#666",
  },
  heading: {
    marginBottom: "10px",
    color: "#2c3e50",
    fontWeight: "600",
    fontSize: "24px",
  },
  subtitle: {
    marginBottom: "25px",
    color: "#7f8c8d",
    fontSize: "14px",
  },
  tableWrapper: {
    width: "100%",
    overflowX: "auto",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    borderRadius: "8px",
    backgroundColor: "#fff",
    marginBottom: "20px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1200px",
  },
  th: {
    padding: "12px 15px",
    backgroundColor: "#f8f9fa",
    color: "#495057",
    fontWeight: "600",
    textAlign: "center",
    fontSize: "13px",
    border: "1px solid #dee2e6",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  categoryHeader: {
    padding: "12px 5px",
    backgroundColor: "#e3f2fd",
    color: "#1565c0",
    fontWeight: "600",
    textAlign: "center",
    fontSize: "14px",
    border: "1px solid #bbdefb",
  },
  moduleHeader: {
    padding: "10px 8px",
    backgroundColor: "#f8f9fa",
    color: "#495057",
    fontWeight: "500",
    textAlign: "center",
    fontSize: "12px",
    border: "1px solid #dee2e6",
    minWidth: "100px",
    maxWidth: "150px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  td: {
    padding: "10px 8px",
    textAlign: "center",
    border: "1px solid #dee2e6",
    fontSize: "13px",
    backgroundColor: "#fff",
  },
  checkbox: {
    transform: "scale(1.2)",
    cursor: "pointer",
  },
  buttonContainer: {
    display: "flex",
    gap: "15px",
    justifyContent: "center",
  },
  saveButton: {
    backgroundColor: "#28a745",
    border: "none",
    padding: "12px 30px",
    borderRadius: "6px",
    fontWeight: "600",
    cursor: "pointer",
    color: "white",
    fontSize: "14px",
    transition: "background-color 0.2s",
  },
  refreshButton: {
    backgroundColor: "#6c757d",
    border: "none",
    padding: "12px 30px",
    borderRadius: "6px",
    fontWeight: "600",
    cursor: "pointer",
    color: "white",
    fontSize: "14px",
    transition: "background-color 0.2s",
  },
};

export default SettingsMatrix;