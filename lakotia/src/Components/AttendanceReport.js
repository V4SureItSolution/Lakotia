import React, { useState, useEffect } from "react";
import { API_BASE } from "../config";

const API_ATTENDANCE = `${API_BASE}/attendance`;
const API_EMPLOYEES = `${API_BASE}/employee/all`;
const API_SAVE_SUMMARY = `${API_BASE}/attendance/summary`;

// holidays endpoints (note trailing slash)
const API_GET_HOLIDAYS = `${API_BASE}/holidays`;
const API_SAVE_HOLIDAYS = `${API_BASE}/holidays/`;

const AttendanceReport = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calendar popup & holidays
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedHolidays, setSelectedHolidays] = useState([]);

  // fetch attendance
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_ATTENDANCE);
      const data = await res.json();
      if (res.ok) setAttendanceData(data);
      else setAttendanceData([]);
    } catch (err) {
      console.error("Error fetching attendance:", err);
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };

  // fetch employees
  const fetchEmployees = async () => {
    try {
      const res = await fetch(API_EMPLOYEES);
      const data = await res.json();
      if (res.ok) setEmployees(data);
      else setEmployees([]);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setEmployees([]);
    }
  };

  // fetch holidays for month/year
  const fetchHolidays = async () => {
    try {
      const res = await fetch(`${API_GET_HOLIDAYS}?month=${month}&year=${year}`);
      const data = await res.json();
      if (res.ok && data.holidays) {
        setSelectedHolidays(data.holidays);
      } else {
        setSelectedHolidays([]);
      }
    } catch (err) {
      console.error("Error fetching holidays:", err);
      setSelectedHolidays([]);
    }
  };

  useEffect(() => {
    fetchAttendance();
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchHolidays(); // reload holidays when month/year changes
  }, [month, year]);

  // Save holidays for current month/year
  const saveHolidays = async (optionalHolidays) => {
    try {
      const payload = {
        month,
        year,
        holidays: optionalHolidays ?? selectedHolidays,
      };
      const res = await fetch(API_SAVE_HOLIDAYS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("Save holidays failed", await res.text());
      } else {
        // refresh back-end data
        fetchHolidays();
      }
    } catch (err) {
      console.error("Error saving holidays:", err);
    }
  };

  // date formatting as YYYY-MM-DD
  const formatLocalDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  // summary calculation (keeps your original logic)
  const calculateSummary = () => {
    if (!attendanceData.length || !employees.length) return;

    const totalDays = new Date(year, month, 0).getDate();

    const holidays = selectedHolidays.map((date) => ({
      month: new Date(date).getMonth() + 1,
      day: new Date(date).getDate(),
    }));

    const report = employees.map((emp) => {
      const userRecords = attendanceData.filter(
        (rec) =>
          rec.email === emp.email &&
          new Date(rec.date).getMonth() + 1 === Number(month) &&
          new Date(rec.date).getFullYear() === Number(year)
      );

      let present = 0;
      let absent = 0;
      const records = [];

      for (let day = 1; day <= totalDays; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dateStr = formatLocalDate(currentDate);

        const dayRecords = userRecords.filter((r) => {
          const recDate = new Date(r.date);
          return formatLocalDate(recDate) === dateStr;
        });

        const isSunday = currentDate.getDay() === 0;
        const isHoliday = holidays.some((h) => h.month === month && h.day === day);

        if (isSunday || isHoliday) {
          present += 1;
          records.push({ day, status: "✅" });
          continue;
        }

        // Sum hours across all sessions on this day
        let totalHours = 0;
        dayRecords.forEach((rec) => {
          const dVal = rec?.duration;
          if (typeof dVal === "number") {
            totalHours += dVal;
          } else if (typeof dVal === "string") {
            const match = dVal.match(/(\d+)h\s*(\d*)m?/);
            const hr = match ? parseInt(match[1]) : 0;
            const min = match && match[2] ? parseInt(match[2]) : 0;
            totalHours += hr + min / 60;
          }
        });

        if (totalHours >= 8) {
          present += 1;
          records.push({ day, status: "✅" });
        } else if (totalHours >= 4) {
          present += 0.5;
          absent += 0.5;
          records.push({ day, status: "🌓" });
        } else {
          absent += 1;
          records.push({ day, status: "❌" });
        }
      }

      return {
        name: emp.name,
        email: emp.email,
        records,
        present: present.toFixed(1),
        absent: absent.toFixed(1),
        totalDays,
        month,
        year,
      };
    });

    setSummary(report);
    saveSummaryToBackend(report);
  };

  // Save summary back to backend (unchanged)
  const saveSummaryToBackend = async (report) => {
    try {
      setSaving(true);
      const res = await fetch(API_SAVE_SUMMARY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) {
        console.error("Failed to save summary", await res.text());
      }
    } catch (err) {
      console.error("Error saving summary:", err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    calculateSummary();
  }, [attendanceData, employees, month, year, selectedHolidays]);

  const handlePrint = () => window.print();
  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

  // Calendar popup handlers
  const handleCloseCalendar = async () => {
    // save then close
    await saveHolidays();
    setShowCalendar(false);
    // recalc summary after saving
    fetchHolidays();
  };

  const renderCalendarPopup = () => {
    const days = new Date(year, month, 0).getDate();

    return (
      <div style={popupOverlay}>
        <div style={popupBox}>
          <h3>Select Holidays</h3>
          <div style={calendarGrid}>
            {[...Array(days).keys()].map((d) => {
              const date = `${year}-${String(month).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
              const checked = selectedHolidays.includes(date);
              return (
                <label key={d} style={dayCell}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedHolidays((s) => [...s, date]);
                      else setSelectedHolidays((s) => s.filter((x) => x !== date));
                    }}
                  />
                  {d + 1}
                </label>
              );
            })}
          </div>

          <button style={closeBtn} onClick={handleCloseCalendar}>
            Done
          </button>
        </div>
      </div>
    );
  };

  // page UI (kept same as your style)
  return (
    <div style={pageWrapper}>
      <div className="print-area" style={reportBox}>
        <h2 style={title}>📅 Monthly Attendance Report - {monthName} {year}</h2>

        <div className="no-print" style={topControls}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={selectBox}>
            {[...Array(12).keys()].map((m) => <option key={m+1} value={m+1}>{new Date(0,m).toLocaleString("default",{month:'long'})}</option>)}
          </select>

          <input type="number" value={year} min="2000" max="2100" onChange={(e) => setYear(Number(e.target.value))} style={yearBox} />

          <button onClick={() => setShowCalendar(true)} style={holidayBtn}>📅 Select Holidays</button>

          <button onClick={calculateSummary} disabled={loading || saving} style={calculateBtn}>
            {loading ? "Loading..." : saving ? "Saving..." : "View & Save Report"}
          </button>

          <button onClick={handlePrint} className="no-print" style={printBtn}>🖨️ Print Report</button>
        </div>

        {summary.length > 0 ? (
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead style={{ backgroundColor: "#fef3c7" }}>
                <tr>
                  <th style={thStyle}>Employee Name</th>
                  <th style={thStyle}>Email</th>
                  {[...Array(new Date(year, month, 0).getDate()).keys()].map((day) => <th key={day+1} style={thStyle}>{day+1}</th>)}
                  <th style={{...thStyle, color:'green'}}>Present</th>
                  <th style={{...thStyle, color:'red'}}>Absent</th>
                  <th style={thStyle}>Total Days</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((user, i) => (
                  <tr key={i}>
                    <td style={tdNameStyle}>{user.name}</td>
                    <td style={tdStyle}>{user.email}</td>
                    {user.records.map((r, idx) => <td key={idx} style={tdStatusStyle}>{r.status}</td>)}
                    <td style={{...tdStyle, color:'green'}}>{user.present}</td>
                    <td style={{...tdStyle, color:'red'}}>{user.absent}</td>
                    <td style={tdStyle}>{user.totalDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={noData}>No data available.</p>
        )}
      </div>

      {showCalendar && renderCalendarPopup()}

      <style>{`@media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .no-print { display: none !important; } .print-area { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
    </div>
  );
};

/* ---------- styles (same as yours) ---------- */

const pageWrapper = { padding:"24px", maxWidth:"1200px", margin:"0 auto", backgroundColor:"#f9fafb", minHeight:"100vh" };
const reportBox = { backgroundColor:"#fff", boxShadow:"0 4px 12px rgba(0,0,0,0.1)", borderRadius:"16px", padding:"24px" };
const title = { fontSize:"28px", fontWeight:"700", textAlign:"center", marginBottom:"32px" };
const topControls = { display:"flex", gap:"16px", flexWrap:"wrap", justifyContent:"center", marginBottom:"24px" };
const selectBox = { padding:"8px", borderRadius:"8px" };
const yearBox = { padding:"8px", width:"100px", borderRadius:"8px" };
const holidayBtn = { backgroundColor:"#3b82f6", color:"#fff", padding:"8px 16px", borderRadius:"8px", border:"none" };
const calculateBtn = { backgroundColor:"#f59e0b", color:"#fff", padding:"8px 16px", borderRadius:"8px", border:"none" };
const printBtn = { backgroundColor:"#10b981", color:"#fff", padding:"8px 16px", borderRadius:"8px", border:"none" };
const tableWrapper = { overflowX:"auto", borderRadius:"8px" };
const tableStyle = { width:"100%", borderCollapse:"collapse", textAlign:"center" };
const thStyle = { padding:"8px", border:"1px solid #d1d5db", fontWeight:"600" };
const tdStyle = { padding:"6px", border:"1px solid #e5e7eb" };
const tdNameStyle = { ...tdStyle, fontWeight:"600" };
const tdStatusStyle = { ...tdStyle, fontSize:"16px" };
const noData = { textAlign:"center", marginTop:"20px", color:"#6b7280" };

const popupOverlay = { position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 };
const popupBox = { background:"#fff", padding:"20px", borderRadius:"12px", width:"350px" };
const calendarGrid = { display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:"10px", marginTop:"10px" };
const dayCell = { padding:"6px", border:"1px solid #ddd", borderRadius:"6px", textAlign:"center" };
const closeBtn = { marginTop:"15px", padding:"8px 16px", backgroundColor:"#2563eb", color:"#fff", border:"none", borderRadius:"8px", width:"100%" };

export default AttendanceReport;
