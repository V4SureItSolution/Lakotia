import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "bootstrap/dist/css/bootstrap.min.css";
import { API_BASE } from "../config";

const API_URL = `${API_BASE}/attendance`;

const AttendancePage = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);

  const [searchName, setSearchName] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // ---------------------------
  // ⭐ FETCH ALL ATTENDANCE
  // ---------------------------
  useEffect(() => {
    const fetchAllAttendance = async () => {
      const res = await fetch(API_URL);
      const data = await res.json();
      setAttendanceRecords(data);
      setFilteredRecords(data);
    };
    fetchAllAttendance();
  }, []);

  // ---------------------------
  // ⭐ APPLY FILTERS
  // ---------------------------
  useEffect(() => {
    let filtered = attendanceRecords;

    if (searchName.trim() !== "") {
      filtered = filtered.filter((rec) =>
        rec.username?.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    if (dateFilter !== "") {
      filtered = filtered.filter((rec) => rec.date === dateFilter);
    }

    if (statusFilter !== "") {
      filtered = filtered.filter(
        (rec) => rec.status?.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    setFilteredRecords(filtered);
  }, [searchName, dateFilter, statusFilter, attendanceRecords]);

  // ---------------------------
  // ⭐ EXPORT TO EXCEL
  // ---------------------------
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRecords);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    saveAs(new Blob([excelBuffer]), "AttendanceReport.xlsx");
  };

  // ---------------------------
  // ⭐ EXPORT TO PDF
  // ---------------------------
  const exportToPDF = () => {
    const doc = new jsPDF("landscape");

    doc.setFontSize(16);
    doc.text("Attendance Report", 14, 10);

    autoTable(doc, {
      head: [
        [
          "ID",
          "Username",
          "Date",
          "Check In",
          "Check Out",
          "Duration",
          "Status",
          "Device In",
          "Device Out",
          "Location In",
          "Location Out",
        ],
      ],

      body: filteredRecords.map((r) => [
        r.id,
        r.username,
        r.date,
        r.check_in || "-",
        r.check_out || "-",
        r.duration || "-",
        r.status || "-",
        JSON.stringify(r.device_in, null, 2),
        JSON.stringify(r.device_out, null, 2),
        JSON.stringify(r.location_in, null, 2),
        JSON.stringify(r.location_out, null, 2),
      ]),

      startY: 20,
      styles: {
        fontSize: 7,
        cellWidth: "wrap",
        overflow: "linebreak",
      },

      columnStyles: {
        7: { cellWidth: 35 },
        8: { cellWidth: 35 },
        9: { cellWidth: 35 },
        10: { cellWidth: 35 },
      },

      margin: { left: 5, right: 5 },
    });

    doc.save("AttendanceReport.pdf");
  };

  // ---------------------------
  // ⭐ STATUS BADGE
  // ---------------------------
  const statusChip = (status) => {
    if (status === "checked-in")
      return <span className="badge bg-warning text-dark">Checked-In</span>;

    if (status === "checked-out")
      return <span className="badge bg-info text-dark">Checked-Out</span>;

    return <span className="badge bg-danger">Unknown</span>;
  };

  return (
    <div className="container-fluid mt-3 attendance-container">

      <h2 className="text-center fw-bold mb-3 page-title">
        Attendance Records
      </h2>

      {/* FILTERS */}
      <div className="row g-2 mb-3">

        <div className="col-12 col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search by name..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>

        <div className="col-6 col-md-4">
          <input
            type="date"
            className="form-control"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        <div className="col-6 col-md-4">
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="checked-in">Checked-In</option>
            <option value="checked-out">Checked-Out</option>
          </select>
        </div>

      </div>

      {/* EXPORT BUTTONS */}
      <div className="d-flex flex-column flex-md-row gap-2 mb-3">

        <button
          className="btn btn-success w-100 w-md-auto"
          onClick={exportToExcel}
        >
          Export Excel
        </button>

        <button
          className="btn btn-danger w-100 w-md-auto"
          onClick={exportToPDF}
        >
          Export PDF
        </button>

      </div>

      {/* TABLE */}
      <div className="table-responsive shadow bg-white rounded p-2">

        <table className="table table-hover table-bordered table-sm attendance-table">

          <thead className="table-dark">
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Date</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Device In</th>
              <th>Device Out</th>
              <th>Location In</th>
              <th>Location Out</th>
            </tr>
          </thead>

          <tbody>

            {filteredRecords.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.username}</td>
                <td>{r.date}</td>
                <td>{r.check_in || "-"}</td>
                <td>{r.check_out || "-"}</td>
                <td>{r.duration || "-"}</td>
                <td>{statusChip(r.status)}</td>
                <td>{JSON.stringify(r.device_in)}</td>
                <td>{JSON.stringify(r.device_out)}</td>
                <td>{JSON.stringify(r.location_in)}</td>
                <td>{JSON.stringify(r.location_out)}</td>
              </tr>
            ))}

          </tbody>

        </table>

      </div>

      {/* MOBILE RESPONSIVE CSS */}
      <style>{`

      .attendance-table{
        font-size:14px;
      }

      @media (max-width:768px){

        .page-title{
          font-size:18px;
        }

        .attendance-table{
          font-size:11px;
        }

        .attendance-table th,
        .attendance-table td{
          padding:6px;
          white-space:nowrap;
        }

        .badge{
          font-size:10px;
        }

        input.form-control,
        select.form-select{
          font-size:13px;
          padding:6px;
        }

        .btn{
          font-size:13px;
          padding:6px 10px;
        }

      }

      `}</style>

    </div>
  );
};

export default AttendancePage;