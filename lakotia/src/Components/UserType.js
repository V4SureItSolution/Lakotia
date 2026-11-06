import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaEdit, FaTrash, FaPlus, FaFilePdf, FaFileExcel } from "react-icons/fa";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE } from "../config";

const DEFAULT_USER_TYPE = "Customer";

const UserTypePage = () => {
  const [userTypes, setUserTypes] = useState([]);
  const [filteredUserTypes, setFilteredUserTypes] = useState([]);
  const [paginatedUserTypes, setPaginatedUserTypes] = useState([]);

  const [search, setSearch] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "" });
  const [editId, setEditId] = useState(null);

  const [loading, setLoading] = useState(false);

  // ✅ Fetch all user types on mount
  useEffect(() => {
    fetchUserTypes();
  }, []);

  useEffect(() => {
    handleSearch();
  }, [search, userTypes]);

  useEffect(() => {
    updatePagination();
  }, [filteredUserTypes, currentPage]);

  const fetchUserTypes = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/usertype`);
      const data = Array.isArray(res.data.data) ? res.data.data : [];
      setUserTypes(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load user types!");
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({ name: e.target.value });
  };

  const handleSearch = () => {
    const value = search.toLowerCase();
    const filtered = userTypes.filter(
      (ut) =>
        ut.name?.toLowerCase().includes(value) ||
        ut.id?.toString().includes(value)
    );
    setFilteredUserTypes(filtered);
    setCurrentPage(1);
  };

  const updatePagination = () => {
    const total = filteredUserTypes.length;
    const pages = Math.ceil(total / itemsPerPage);
    setTotalPages(pages || 1);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedUserTypes(filteredUserTypes.slice(startIndex, endIndex));
  };

  const resetForm = () => {
    setFormData({ name: "" });
    setEditId(null);
    setFormOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter user type name");
      return;
    }

    try {
      let res;
      if (editId !== null) {
        res = await axios.put(`${API_BASE}/usertype/${editId}`, formData);
      } else {
        res = await axios.post(`${API_BASE}/usertype`, formData);
      }

      if (res.data.success) {
        toast.success(res.data.message);
        fetchUserTypes();
        resetForm();
      } else {
        toast.error(res.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error submitting data!");
    }
  };

  const handleDelete = async (ut) => {
    if (ut.name === DEFAULT_USER_TYPE) {
      toast.warning("Default user type cannot be deleted");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this user type?")) return;

    try {
      const res = await axios.delete(`${API_BASE}/usertype/${ut.id}`);
      if (res.data.success) {
        toast.success("User type deleted!");
        fetchUserTypes();
      } else {
        toast.error(res.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error deleting user type!");
    }
  };

  const handleEdit = (ut) => {
    if (ut.name === DEFAULT_USER_TYPE) {
      toast.info("Default user type cannot be edited");
      return;
    }
    setFormData({ name: ut.name });
    setEditId(ut.id);
    setFormOpen(true);
  };

  // ---------------------- EXPORTS --------------------------

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredUserTypes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "User Types");
    XLSX.writeFile(wb, "user_types.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("User Types List", 14, 15);

    autoTable(doc, {
      head: [["ID", "User Type Name"]],
      body: filteredUserTypes.map((ut) => [ut.id, ut.name]),
      startY: 25,
    });

    doc.save("user_types.pdf");
  };

  // Internal CSS styles
  const styles = {
    container: {
      maxWidth: "1200px",
      margin: "2rem auto",
      padding: "0 1rem",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    },
    headerSection: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "1.5rem"
    },
    pageTitle: {
      fontWeight: "bold",
      fontSize: "1.5rem",
      margin: 0,
      color: "#333"
    },
    btn: {
      display: "inlineFlex",
      alignItems: "center",
      padding: "0.5rem 1rem",
      border: "none",
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
      fontWeight: 500,
      cursor: "pointer",
      transition: "all 0.2s ease"
    },
    btnPrimary: {
      backgroundColor: "#ffc107",
      color: "#000"
    },
    btnSuccess: {
      backgroundColor: "#28a745",
      color: "#fff"
    },
    btnDanger: {
      backgroundColor: "#dc3545",
      color: "#fff"
    },
    btnSecondary: {
      backgroundColor: "#6c757d",
      color: "#fff"
    },
    btnIcon: {
      marginRight: "0.5rem"
    },
    btnIconOnly: {
      background: "none",
      border: "none",
      padding: "0.5rem",
      cursor: "pointer",
      borderRadius: "0.25rem",
      transition: "all 0.2s ease",
      fontSize: "1rem"
    },
    btnWarningIcon: {
      color: "#ffc107",
      backgroundColor: "transparent"
    },
    btnDangerIcon: {
      color: "#dc3545",
      backgroundColor: "transparent"
    },
    searchSection: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "1.5rem",
      gap: "1rem",
      flexWrap: "wrap"
    },
    searchWrapper: {
      flex: 1,
      maxWidth: "400px"
    },
    searchInput: {
      width: "100%",
      padding: "0.5rem 0.75rem",
      border: "1px solid #ddd",
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
      transition: "border-color 0.2s ease"
    },
    exportButtons: {
      display: "flex",
      gap: "0.5rem"
    },
    tableResponsive: {
      overflowX: "auto",
      marginBottom: "1.5rem"
    },
    dataTable: {
      width: "100%",
      borderCollapse: "collapse",
      backgroundColor: "#fff",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
    },
    tableHead: {
      backgroundColor: "#fff3cd"
    },
    tableHeader: {
      padding: "0.75rem",
      textAlign: "center",
      fontWeight: 600,
      color: "#333",
      borderBottom: "2px solid #dee2e6"
    },
    tableCell: {
      padding: "0.75rem",
      borderBottom: "1px solid #dee2e6"
    },
    textCenter: {
      textAlign: "center"
    },
    emptyState: {
      textAlign: "center",
      color: "#6c757d",
      padding: "2rem"
    },
    badge: {
      display: "inlineBlock",
      padding: "0.25rem 0.5rem",
      fontSize: "0.75rem",
      fontWeight: 600,
      borderRadius: "0.25rem",
      marginLeft: "0.5rem"
    },
    badgeDefault: {
      backgroundColor: "#6c757d",
      color: "#fff"
    },
    actionButtons: {
      display: "flex",
      gap: "0.5rem",
      justifyContent: "center"
    },
    paginationSection: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: "1rem",
      flexWrap: "wrap",
      gap: "1rem"
    },
    paginationInfo: {
      color: "#6c757d",
      fontSize: "0.875rem"
    },
    paginationControls: {
      display: "flex",
      gap: "0.5rem",
      flexWrap: "wrap"
    },
    paginationPage: {
      padding: "0.5rem 0.75rem",
      border: "1px solid #dee2e6",
      backgroundColor: "#fff",
      cursor: "pointer",
      borderRadius: "0.25rem",
      transition: "all 0.2s ease"
    },
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000
    },
    modalContent: {
      backgroundColor: "#fff",
      borderRadius: "0.5rem",
      width: "90%",
      maxWidth: "500px",
      maxHeight: "90vh",
      overflowY: "auto"
    },
    modalHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "1rem 1.5rem",
      borderBottom: "1px solid #dee2e6"
    },
    modalTitle: {
      margin: 0,
      fontSize: "1.25rem",
      fontWeight: 600,
      color: "#333"
    },
    modalClose: {
      background: "none",
      border: "none",
      fontSize: "1.5rem",
      cursor: "pointer",
      color: "#999",
      transition: "color 0.2s ease"
    },
    modalBody: {
      padding: "1.5rem"
    },
    formGroup: {
      marginBottom: "1rem"
    },
    formLabel: {
      display: "block",
      marginBottom: "0.5rem",
      fontWeight: 500,
      color: "#333"
    },
    formInput: {
      width: "100%",
      padding: "0.5rem 0.75rem",
      border: "1px solid #ddd",
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
      transition: "border-color 0.2s ease"
    },
    modalActions: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "0.5rem",
      marginTop: "1.5rem"
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerSection}>
        <h3 style={styles.pageTitle}>User Types Management</h3>
        <button
          style={{ ...styles.btn, ...styles.btnPrimary }}
          onClick={() => setFormOpen(true)}
          onMouseEnter={(e) => e.target.style.backgroundColor = "#e0a800"}
          onMouseLeave={(e) => e.target.style.backgroundColor = "#ffc107"}
        >
          <FaPlus style={styles.btnIcon} /> Add User Type
        </button>
      </div>

      <div style={styles.searchSection}>
        <div style={styles.searchWrapper}>
          <input
            type="text"
            style={styles.searchInput}
            placeholder="Search user types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => e.target.style.outline = "none"}
          />
        </div>

        <div style={styles.exportButtons}>
          <button
            style={{ ...styles.btn, ...styles.btnSuccess }}
            onClick={exportExcel}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#218838"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#28a745"}
          >
            <FaFileExcel style={styles.btnIcon} /> Excel
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnDanger }}
            onClick={exportPDF}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#c82333"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#dc3545"}
          >
            <FaFilePdf style={styles.btnIcon} /> PDF
          </button>
        </div>
      </div>

      <div style={styles.tableResponsive}>
        <table style={styles.dataTable}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.tableHeader}>ID</th>
              <th style={styles.tableHeader}>User Type Name</th>
              <th style={styles.tableHeader}>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUserTypes.length === 0 && (
              <tr>
                <td colSpan="3" style={styles.emptyState}>
                  No user types found
                </td>
              </tr>
            )}

            {paginatedUserTypes.map((ut) => (
              <tr key={ut.id}>
                <td style={{ ...styles.tableCell, ...styles.textCenter }}>{ut.id}</td>
                <td style={styles.tableCell}>
                  {ut.name}
                  {ut.name === DEFAULT_USER_TYPE && (
                    <span style={{ ...styles.badge, ...styles.badgeDefault }}>Default</span>
                  )}
                </td>
                <td style={styles.tableCell}>
                  <div style={styles.actionButtons}>
                    <button
                      style={{ ...styles.btnIconOnly, ...styles.btnWarningIcon }}
                      disabled={ut.name === DEFAULT_USER_TYPE}
                      onClick={() => handleEdit(ut)}
                      title="Edit"
                      onMouseEnter={(e) => {
                        if (!e.target.disabled) {
                          e.target.style.backgroundColor = "#fff3cd";
                          e.target.style.color = "#e0a800";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "transparent";
                        e.target.style.color = "#ffc107";
                      }}
                    >
                      <FaEdit />
                    </button>
                    <button
                      style={{ ...styles.btnIconOnly, ...styles.btnDangerIcon }}
                      disabled={ut.name === DEFAULT_USER_TYPE}
                      onClick={() => handleDelete(ut)}
                      title="Delete"
                      onMouseEnter={(e) => {
                        if (!e.target.disabled) {
                          e.target.style.backgroundColor = "#f8d7da";
                          e.target.style.color = "#c82333";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "transparent";
                        e.target.style.color = "#dc3545";
                      }}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredUserTypes.length > 0 && (
        <div style={styles.paginationSection}>
          <div style={styles.paginationInfo}>
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredUserTypes.length)} of{" "}
            {filteredUserTypes.length} entries
          </div>
          <div style={styles.paginationControls}>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                style={{
                  ...styles.paginationPage,
                  ...(i + 1 === currentPage && {
                    backgroundColor: "#ffc107",
                    borderColor: "#ffc107",
                    color: "#000"
                  })
                }}
                onClick={() => setCurrentPage(i + 1)}
                onMouseEnter={(e) => {
                  if (i + 1 !== currentPage) {
                    e.target.style.backgroundColor = "#f8f9fa";
                    e.target.style.borderColor = "#ffc107";
                  }
                }}
                onMouseLeave={(e) => {
                  if (i + 1 !== currentPage) {
                    e.target.style.backgroundColor = "#fff";
                    e.target.style.borderColor = "#dee2e6";
                  }
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FORM MODAL */}
      {formOpen && (
        <div style={styles.modalOverlay} onClick={resetForm}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h4 style={styles.modalTitle}>{editId ? "Edit User Type" : "Add User Type"}</h4>
              <button
                style={styles.modalClose}
                onClick={resetForm}
                onMouseEnter={(e) => e.target.style.color = "#333"}
                onMouseLeave={(e) => e.target.style.color = "#999"}
              >
                ×
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>User Type Name</label>
                <input
                  type="text"
                  style={styles.formInput}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter user type name"
                  required
                  onFocus={(e) => e.target.style.outline = "none"}
                />
              </div>
              <div style={styles.modalActions}>
                <button
                  style={{ ...styles.btn, ...styles.btnSecondary }}
                  onClick={resetForm}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#5a6268"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#6c757d"}
                >
                  Cancel
                </button>
                <button
                  style={{ ...styles.btn, ...styles.btnPrimary }}
                  onClick={handleSubmit}
                  onMouseEnter={(e) => e.target.style.backgroundColor = "#e0a800"}
                  onMouseLeave={(e) => e.target.style.backgroundColor = "#ffc107"}
                >
                  {editId ? "Update" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
};

export default UserTypePage;