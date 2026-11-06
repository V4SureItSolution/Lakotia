import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE } from "../config";

const DepartmentPage = () => {
  const [departments, setDepartments] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "" });
  const [editId, setEditId] = useState(null);

  // ✅ Fetch all departments from Flask API
  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${API_BASE}/department/all`);
      setDepartments(response.data);
    } catch (error) {
      console.error("Error fetching departments:", error);
      toast.error("Failed to load departments");
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // ✅ Handle form input
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ✅ Add or Update Department
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Department name is required!");
      return;
    }

    try {
      let url = `${API_BASE}/department/add`;
      let method = "POST";

      if (editId) {
        url = `${API_BASE}/department/update/${editId}`;
        method = "PUT";
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          editId ? "Department updated successfully!" : "Department added successfully!"
        );
        fetchDepartments();
        setFormData({ name: "" });
        setEditId(null);
        setFormOpen(false);
      } else {
        toast.error(data.message || "Operation failed");
      }
    } catch (error) {
      console.error("Error saving department:", error);
      toast.error("Something went wrong!");
    }
  };

  // ✅ Edit Department
  const handleEdit = (dep) => {
    setFormData({ name: dep.name });
    setEditId(dep.id);
    setFormOpen(true);
  };

  // ✅ Delete Department
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this department?")) return;

    try {
      const response = await fetch(`${API_BASE}/department/delete/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (response.ok) {
        toast.success("Department deleted successfully!");
        fetchDepartments();
      } else {
        toast.error(data.message || "Failed to delete department");
      }
    } catch (error) {
      console.error("Error deleting department:", error);
      toast.error("Something went wrong!");
    }
  };

  return (
    <div style={styles.container}>
      
      <h2 style={styles.heading}>Departments</h2>

      <button style={styles.addButton} onClick={() => setFormOpen(true)}>
        <FaPlus style={{ marginRight: "6px", color: "#fff" }} /> Add Department
      </button>

      {/* ✅ Modal Form */}
      {formOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>
              {editId ? "Edit Department" : "Add Department"}
            </h3>
            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>Department Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter department name"
                style={styles.input}
                required
              />

              <div style={styles.buttonGroup}>
                <button type="submit" style={styles.submitButton}>
                  {editId ? "Update" : "Add"}
                </button>
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={() => {
                    setFormOpen(false);
                    setFormData({ name: "" });
                    setEditId(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ Department Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.length > 0 ? (
              departments.map((dep) => (
                <tr key={dep.id} style={styles.row}>
                  <td style={styles.td}>{dep.id}</td>
                  <td style={styles.td}>{dep.name}</td>
                  <td style={styles.td}>
                    <div style={styles.iconGroup}>
                      <button
                        onClick={() => handleEdit(dep)}
                        style={{ ...styles.actionButton, ...styles.editButton }}
                      >
                        <FaEdit />
                        <span style={styles.iconText}>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(dep.id)}
                        style={{
                          ...styles.actionButton,
                          ...styles.deleteButton,
                        }}
                      >
                        <FaTrash />
                        <span style={styles.iconText}>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" style={styles.noData}>
                  No departments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ✅ Inline Styles
const styles = {
  container: {
    padding: "30px",
    backgroundColor: "#fdfdfd",
    minHeight: "100vh",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "13px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  heading: {
    marginBottom: "20px",
    color: "#333",
    fontWeight: "600",
    fontSize: "22px",
  },
  addButton: {
    display: "flex",
    alignItems: "center",
    padding: "8px 16px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#f5c518",
    color: "#fff",
    fontWeight: "500",
    cursor: "pointer",
    marginBottom: "20px",
    fontSize: "14px",
    transition: "0.3s",
    boxShadow: "0 3px 6px rgba(0,0,0,0.15)",
  },
  tableWrapper: { width: "80%", overflowX: "auto" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#fff",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
  },
  th: {
    padding: "12px",
    backgroundColor: "#fff",
    fontWeight: "600",
    textAlign: "center",
    borderBottom: "2px solid #f5c518",
    fontSize: "13px",
  },
  td: {
    padding: "12px",
    textAlign: "center",
    borderBottom: "1px solid #f0f0f0",
    fontSize: "13px",
  },
  noData: { textAlign: "center", padding: "15px", color: "#999" },
  iconGroup: { display: "flex", justifyContent: "center", gap: "8px" },
  actionButton: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 12px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontSize: "12px",
  },
  editButton: { backgroundColor: "#f5c518", color: "#333" },
  deleteButton: { backgroundColor: "#ff7f50", color: "#fff" },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0,0,0,0.25)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  modal: {
    backgroundColor: "#fff",
    padding: "25px 30px",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
    width: "380px",
  },
  modalTitle: {
    marginBottom: "15px",
    color: "#333",
    fontWeight: "600",
    fontSize: "16px",
  },
  form: { display: "flex", flexDirection: "column" },
  label: { marginBottom: "5px", fontWeight: "500", color: "#555" },
  input: {
    padding: "8px",
    marginBottom: "15px",
    borderRadius: "6px",
    border: "1px solid #f5c518",
  },
  buttonGroup: { display: "flex", justifyContent: "space-between" },
  submitButton: {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#f5c518",
    color: "#333",
    fontWeight: "500",
    cursor: "pointer",
  },
  cancelButton: {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#ffcc5c",
    color: "#333",
    fontWeight: "500",
    cursor: "pointer",
  },
};

export default DepartmentPage;
