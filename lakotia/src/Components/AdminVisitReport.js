import React, { useState, useEffect } from "react";
import {
  FaEye,
  FaPaperclip,
  FaStickyNote,
  FaSearch,
  FaFileExcel,
  FaFilePdf,
} from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import { API_BASE } from "../config";

// Excel + PDF
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const VisitReportPage = () => {
  const [reports, setReports] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // ✅ Search filters
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ✅ Fetch all reports initially
  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/visitreport`);
      setReports(res.data);
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to fetch reports");
    }
  };

  // ✅ Search by date range
  const handleDateSearch = async () => {
    if (!startDate || !endDate) {
      toast.warning("⚠️ Please select both dates");
      return;
    }
    try {
      const res = await axios.get(
        `${API_BASE}/visitreport/search?start_date=${startDate}&end_date=${endDate}`
      );
      setReports(res.data);
      if (res.data.length === 0) toast.info("ℹ️ No records found in this date range");
    } catch (err) {
      console.error(err);
      toast.error("❌ Error searching by date");
    }
  };

  // ✅ Search by name or keyword
  const handleNameSearch = async () => {
    if (!searchTerm.trim()) {
      toast.warning("⚠️ Please enter a name or keyword");
      return;
    }
    try {
      const res = await axios.get(
        `${API_BASE}/visitreport/searchname?term=${encodeURIComponent(searchTerm)}`
      );
      setReports(res.data);
      if (res.data.length === 0) toast.info("ℹ️ No records found for this name");
    } catch (err) {
      console.error(err);
      toast.error("❌ Error searching by name");
    }
  };

  // ✅ Export to Excel
  const exportToExcel = () => {
    if (!reports.length) return toast.error("No data to export");

    const data = reports.map((r) => ({
      "Customer Name": r.customer_name,
      "Company Name": r.company_name,
      "Mobile": r.customer_mobile,
      "Notes": r.notes,
      "Created By": r.created_by,
      "Created At": new Date(r.created_at).toLocaleDateString(),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VisitReports");

    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "Visit_Reports.xlsx"
    );
  };

  // ✅ Export to PDF
  const exportToPDF = () => {
    if (!reports.length) return toast.error("No data to export");

    const doc = new jsPDF("landscape", "pt", "a4");

    const columns = [
      "Customer Name",
      "Company Name", 
      "Mobile",
      "Notes",
      "Created By",
      "Created At"
    ];

    const rows = reports.map((item) => [
      item.customer_name,
      item.company_name,
      item.customer_mobile,
      item.notes,
      item.created_by,
      new Date(item.created_at).toLocaleDateString(),
    ]);

    autoTable(doc, {
      head: [columns],
      body: rows,
      styles: { fontSize: 8 },
      margin: { top: 20, left: 10, right: 10 },
    });

    doc.save("Visit_Reports.pdf");
  };

  const openModal = (report = null) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedReport(null);
  };

  return (
    <div className="container py-2 py-md-4">
      

      {/* Header Section */}
      <div
        className="d-flex flex-wrap justify-content-between align-items-center mb-3 p-2 p-md-3 rounded-3 shadow-sm"
        style={{ backgroundColor: "#fff9c4" }}
      >
        <h3 className="fw-bold text-dark mb-2 mb-md-0 fs-5 fs-md-3">📋 Visit Report</h3>

        <div className="d-flex flex-wrap gap-2 align-items-center w-100 w-md-auto">
          {/* Export Buttons */}
          <div className="d-flex gap-2 w-100 w-md-auto">
            <button className="btn btn-success btn-sm flex-fill flex-md-grow-0" onClick={exportToExcel}>
              <FaFileExcel /> Excel
            </button>

            <button className="btn btn-danger btn-sm flex-fill flex-md-grow-0" onClick={exportToPDF}>
              <FaFilePdf /> PDF
            </button>
          </div>

          {/* 🔍 Search by Name - Mobile Optimized */}
          <div className="d-flex flex-column flex-md-row align-items-stretch align-items-md-center gap-2 w-100">
            <div className="d-flex gap-2 w-100">
              <input
                type="text"
                className="form-control form-control-sm border-warning"
                placeholder="Search name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                className="btn btn-warning text-dark fw-semibold d-flex align-items-center gap-2 shadow-sm px-3"
                onClick={handleNameSearch}
              >
                <FaSearch /> 
                <span className="d-none d-md-inline">Search</span>
              </button>
            </div>

            {/* 📅 Date range search - Mobile Optimized */}
            <div className="d-flex flex-column flex-sm-row align-items-stretch gap-2 w-100 mt-2 mt-md-0">
              <div className="d-flex gap-2 w-100">
                <div className="flex-fill">
                  <input
                    type="date"
                    className="form-control form-control-sm border-warning"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="From"
                  />
                </div>
                <div className="flex-fill">
                  <input
                    type="date"
                    className="form-control form-control-sm border-warning"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="To"
                  />
                </div>
              </div>
              <button
                className="btn btn-warning text-dark fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm w-100 w-sm-auto"
                onClick={handleDateSearch}
              >
                <FaSearch /> Filter
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table - Mobile Optimized with Card Layout */}
      <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
        <div className="d-block d-md-none">
          {/* Mobile Card View */}
          {reports.length > 0 ? (
            reports.map((r) => (
              <div key={r.id} className="border-bottom p-3 hover-bg-light">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-warning text-dark">#{r.id}</span>
                    <FaEye
                      className="text-info"
                      title="View Details"
                      style={{ cursor: "pointer", fontSize: "1.2rem" }}
                      onClick={() => openModal(r)}
                    />
                  </div>
                  <small className="text-muted">{new Date(r.created_at).toLocaleDateString()}</small>
                </div>
                
                <div className="mb-2">
                  <div className="fw-bold">{r.customer_name}</div>
                  <div className="small text-muted">{r.company_name}</div>
                </div>
                
                <div className="d-flex justify-content-between align-items-center">
                  <div className="small">
                    <span className="text-muted">📞</span> {r.customer_mobile}
                  </div>
                  <div className="d-flex gap-3">
                    {r.attachment && (
                      <a
                        href={`${API_BASE}/visit_reports/${r.attachment}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary text-decoration-none small"
                      >
                        <FaPaperclip /> File
                      </a>
                    )}
                    {r.notes && (
                      <span className="text-muted small" title={r.notes}>
                        <FaStickyNote className="text-warning" /> Note
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mt-2 small">
                  <span className="text-muted">Created by:</span> {r.created_by}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-muted">
              No visit reports available.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="d-none d-md-block">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ backgroundColor: "#fff59d" }}>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Mobile</th>
                  <th>Created By</th>
                  <th>Created At</th>
                  <th>Attachment</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.length > 0 ? (
                  reports.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.customer_name}</td>
                      <td>{r.company_name}</td>
                      <td>{r.customer_mobile}</td>
                      <td>{r.created_by}</td>
                      <td>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>
                        {r.attachment ? (
                          <a
                            href={`${API_BASE}/visit_reports/${r.attachment}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary d-flex align-items-center gap-1 text-decoration-none"
                          >
                            <FaPaperclip /> View
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        {r.notes ? (
                          <span className="text-muted" title={r.notes}>
                            <FaStickyNote className="me-1 text-warning" />
                            {r.notes.length > 30 ? r.notes.slice(0, 30) + "..." : r.notes}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center">
                          <FaEye
                            className="text-info mx-2"
                            title="View Details"
                            style={{ cursor: "pointer", fontSize: "1.2rem" }}
                            onClick={() => openModal(r)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="text-center py-3 text-muted">
                      No visit reports available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Modal - Mobile Optimized */}
      {showModal && selectedReport && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            background: "rgba(0,0,0,0.6)",
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-sm modal-md">
            <div
              className="modal-content border-0 shadow-lg rounded-4"
              style={{ backgroundColor: "#fffde7" }}
            >
              <div className="modal-header bg-warning text-dark py-2 px-3">
                <h5 className="modal-title fw-bold fs-6 fs-md-5">View Visit Report</h5>
                <button
                  type="button"
                  className="btn-close btn-close-sm"
                  onClick={closeModal}
                ></button>
              </div>

              <div className="modal-body p-2 p-md-3">
                <ul className="list-group list-group-flush">
                  <li className="list-group-item d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center px-2 py-2">
                    <strong className="small">Customer Name:</strong> 
                    <span className="small">{selectedReport.customer_name || "-"}</span>
                  </li>
                  <li className="list-group-item d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center px-2 py-2">
                    <strong className="small">Company Name:</strong> 
                    <span className="small">{selectedReport.company_name || "-"}</span>
                  </li>
                  <li className="list-group-item d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center px-2 py-2">
                    <strong className="small">Mobile:</strong> 
                    <span className="small">{selectedReport.customer_mobile || "-"}</span>
                  </li>
                  <li className="list-group-item d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center px-2 py-2">
                    <strong className="small">Created By:</strong> 
                    <span className="small">{selectedReport.created_by || "-"}</span>
                  </li>
                  <li className="list-group-item d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center px-2 py-2">
                    <strong className="small">Created At:</strong> 
                    <span className="small">
                      {selectedReport.created_at 
                        ? new Date(selectedReport.created_at).toLocaleString() 
                        : "-"
                      }
                    </span>
                  </li>
                  <li className="list-group-item px-2 py-2">
                    <strong className="small d-block mb-1">Notes:</strong>
                    <div className="p-2 bg-light rounded small">
                      {selectedReport.notes || "-"}
                    </div>
                  </li>
                  <li className="list-group-item px-2 py-2">
                    <strong className="small d-block mb-1">Attachment:</strong>
                    <div className="mt-1">
                      {selectedReport.attachment ? (
                        <a
                          href={`${API_BASE}/visit_reports/${selectedReport.attachment}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline-primary w-100 w-sm-auto"
                        >
                          <FaPaperclip className="me-1" />
                          View Attachment
                        </a>
                      ) : (
                        <span className="text-muted small">No attachment</span>
                      )}
                    </div>
                  </li>
                </ul>
              </div>

              <div className="modal-footer bg-light py-2 px-3">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm w-100 w-sm-auto"
                  onClick={closeModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add these styles for better mobile experience */}
      <style jsx>{`
        @media (max-width: 767px) {
          .hover-bg-light:active {
            background-color: #f8f9fa;
          }
          .btn {
            white-space: nowrap;
          }
          .modal-dialog {
            margin: 0.5rem;
          }
        }
        @media (max-width: 575px) {
          .container {
            padding-left: 0.5rem;
            padding-right: 0.5rem;
          }
          .modal-dialog {
            margin: 0.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default VisitReportPage;