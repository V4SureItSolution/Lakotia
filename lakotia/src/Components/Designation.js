import React, { useState, useEffect } from "react";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE } from "../config";

const API_URL = `${API_BASE}/designations`;

const DesignationPage = () => {
  const [designations, setDesignations] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "" });
  const [editId, setEditId] = useState(null);

  // Fetch all designations
  const fetchDesignations = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setDesignations(data);
    } catch (err) {
      toast.error("Error fetching designations");
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDesignations();
  }, []);

  // Handle input change
  const handleChange = (e) => setFormData({ name: e.target.value });

  // Add or update designation
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return toast.warning("Please enter a designation name");

    try {
      if (editId !== null) {
        // Update existing designation
        const res = await fetch(`${API_URL}/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();

        if (res.ok) {
          toast.success("Designation updated successfully!");
          fetchDesignations();
        } else {
          toast.error(data.error || "Error updating designation");
        }
      } else {
        // Add new designation
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();

        if (res.ok) {
          toast.success("Designation added successfully!");
          fetchDesignations();
        } else {
          toast.error(data.error || "Error adding designation");
        }
      }

      setFormData({ name: "" });
      setFormOpen(false);
      setEditId(null);
    } catch (err) {
      toast.error("Server error");
      console.error(err);
    }
  };

  // Delete designation
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this designation?"))
      return;

    try {
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        toast.error("Designation deleted!");
        fetchDesignations();
      } else {
        toast.error(data.error || "Error deleting designation");
      }
    } catch (err) {
      toast.error("Server error");
      console.error(err);
    }
  };

  // Edit designation
  const handleEdit = (d) => {
    setFormData({ name: d.name });
    setEditId(d.id);
    setFormOpen(true);
  };

  return (
    <div style={styles.container}>
      
      <h2 style={styles.heading}>Designations</h2>

      <button style={styles.addButton} onClick={() => setFormOpen(true)}>
        <FaPlus style={{ marginRight: "6px", color: "#fff" }} /> Add Designation
      </button>

      {/* Modal Form */}
      {formOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>
              {editId ? "Edit Designation" : "Add Designation"}
            </h3>
            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>Designation Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter designation name"
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

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {designations.length > 0 ? (
              designations.map((d) => (
                <tr key={d.id} style={styles.row}>
                  <td style={styles.td}>{d.id}</td>
                  <td style={styles.td}>{d.name}</td>
                  <td style={styles.td}>
                    <div style={styles.iconGroup}>
                      <button
                        onClick={() => handleEdit(d)}
                        style={{ ...styles.actionButton, ...styles.editButton }}
                      >
                        <FaEdit />
                        <span style={styles.iconText}>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
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
                  No designations added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Styles
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
  tableWrapper: {
    width: "70%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#fff",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
    transition: "transform 0.2s",
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
    transition: "background 0.2s",
  },
  row: {
    cursor: "default",
  },
  noData: {
    textAlign: "center",
    padding: "15px",
    color: "#999",
  },
  iconGroup: {
    display: "flex",
    justifyContent: "center",
    gap: "8px",
  },
  actionButton: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 12px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontSize: "12px",
    transition: "0.3s",
  },
  editButton: {
    backgroundColor: "#f5c518",
    color: "#333",
  },
  deleteButton: {
    backgroundColor: "#ff7f50",
    color: "#fff",
  },
  iconText: {
    fontSize: "12px",
    fontWeight: "500",
  },
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
    transition: "transform 0.2s",
  },
  modalTitle: {
    marginBottom: "15px",
    color: "#333",
    fontWeight: "600",
    fontSize: "16px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    marginBottom: "5px",
    fontWeight: "500",
    color: "#555",
    fontSize: "13px",
  },
  input: {
    padding: "8px",
    marginBottom: "15px",
    borderRadius: "6px",
    border: "1px solid #f5c518",
    fontSize: "13px",
  },
  buttonGroup: {
    display: "flex",
    justifyContent: "space-between",
  },
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

export default DesignationPage;
