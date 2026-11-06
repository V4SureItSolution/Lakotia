import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE as CENTRAL_API_BASE } from "../config";

import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE = `${CENTRAL_API_BASE}/industrial_segmentation`; // Flask backend base URL


const IndustrySegmentationPage = () => {
  const [segments, setSegments] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "" });
  const [editId, setEditId] = useState(null);

  // ✅ Fetch all industry segments
  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/all`);
      setSegments(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch industry segments");
    }
  };

  // ✅ Handle input change
  const handleChange = (e) => setFormData({ name: e.target.value });

  // ✅ Add or update segment
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return toast.warning("Please enter a segment name");

    try {
      if (editId !== null) {
        // Update segment
        await axios.put(`${API_BASE}/update/${editId}`, formData);
        toast.success("Industry segment updated successfully!");
      } else {
        // Add new segment
        await axios.post(`${API_BASE}/add`, formData);
        toast.success("Industry segment added successfully!");
      }

      setFormData({ name: "" });
      setFormOpen(false);
      setEditId(null);
      fetchSegments();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error("Segment already exists");
      } else {
        toast.error("Operation failed. Please try again.");
      }
    }
  };

  // ✅ Delete segment
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this segment?")) return;
    try {
      await axios.delete(`${API_BASE}/delete/${id}`);
      toast.error("Industry segment deleted!");
      fetchSegments();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete segment");
    }
  };

  // ✅ Edit segment
  const handleEdit = (seg) => {
    setFormData({ name: seg.name });
    setEditId(seg.id);
    setFormOpen(true);
  };

  return (
    <div style={styles.container}>
      
      <h2 style={styles.heading}>Industry Segmentation</h2>

      <button style={styles.addButton} onClick={() => setFormOpen(true)}>
        <FaPlus style={{ marginRight: "6px", color: "#fff" }} /> Add Segment
      </button>

      {/* Modal Form */}
      {formOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>
              {editId ? "Edit Industry Segment" : "Add Industry Segment"}
            </h3>
            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>Segment Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter segment name"
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
              <th style={styles.th}>Created At</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {segments.length > 0 ? (
              segments.map((seg) => (
                <tr key={seg.id} style={styles.row}>
                  <td style={styles.td}>{seg.id}</td>
                  <td style={styles.td}>{seg.name}</td>
                  <td style={styles.td}>{seg.created_at}</td>
                  <td style={styles.td}>
                    <div style={styles.iconGroup}>
                      <button
                        onClick={() => handleEdit(seg)}
                        style={{ ...styles.actionButton, ...styles.editButton }}
                      >
                        <FaEdit />
                        <span style={styles.iconText}>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(seg.id)}
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
                <td colSpan="4" style={styles.noData}>
                  No industry segments added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ✅ Styles
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
    width: "80%",
    overflowX: "auto",
  },
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

export default IndustrySegmentationPage;
