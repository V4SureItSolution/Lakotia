// CasualLabourSalaryReport.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "../config";


const API_FETCH_EMP = `${API_BASE}/employee/all`;
const API_FETCH_ATT = `${API_BASE}/attendance/summary`;
const API_FETCH_ADVANCE = `${API_BASE}/advance`; // Your advance API endpoint


// 🔥 UPDATED API — SAVE CASUAL SALARY
const API_SAVE_SALARY = `${API_BASE}/casual/save`;


// 🔥 UPDATED API — FETCH PRE-SAVED REPORT
const API_GET_SAVED = `${API_BASE}/casual/fetch`;


// Helper function to create month-year key
const getMonthYearKey = (month, year) => {
  if (!month || !year) return "";
  return `${year}-${String(month).padStart(2, '0')}`;
};

// Format month as "MM/YYYY" for schedule comparison
const formatDeductMonth = (month, year) => {
  if (!month || !year) return "";
  return `${String(month).padStart(2, '0')}/${year}`;
};

// Format as "YYYY-MM" for deduction_start comparison
const formatDeductionStart = (month, year) => {
  if (!month || !year) return "";
  return `${year}-${String(month).padStart(2, '0')}`;
};

const CasualLabourSalaryReport = () => {
  const [records, setRecords] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);

  // Store salary inputs by month-year key
  const [salaryInputs, setSalaryInputs] = useState({});
  const [graceDays, setGraceDays] = useState({});
  const [loans, setLoans] = useState({}); // Store loans by employee email for current month
  
  // Track current month-year key
  const [currentMonthKey, setCurrentMonthKey] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  // Helper to get salary for current month
  const getCurrentSalary = (email) => {
    if (!currentMonthKey || !salaryInputs[currentMonthKey]) {
      return "";
    }
    return salaryInputs[currentMonthKey][email] || "";
  };

  // Helper to set salary for current month
  const setCurrentSalary = (email, value) => {
    if (!currentMonthKey) return;
    
    setSalaryInputs(prev => {
      const newSalaries = {
        ...prev,
        [currentMonthKey]: {
          ...(prev[currentMonthKey] || {}),
          [email]: parseFloat(value) || 0
        }
      };
      return newSalaries;
    });
  };

  // -------------------------------------------------------------
  // Fetch loans for selected month - FIXED LOGIC
  // -------------------------------------------------------------
  const fetchLoansForMonth = async () => {
    if (!month || !year) {
      // If no month selected, set loans to 0 for all employees
      const zeroLoans = {};
      records.forEach(emp => {
        if (emp.email) zeroLoans[emp.email] = 0;
      });
      setLoans(zeroLoans);
      return;
    }

    try {
      const monthStr = String(month).padStart(2, '0');
      const selectedMonthYear = `${year}-${monthStr}`; // Format: YYYY-MM
      const selectedScheduleKey = `${monthStr}/${year}`; // Format: MM/YYYY for schedule
      
      console.log(`[Casual] Fetching loans for: ${selectedMonthYear}`);
      
      // Fetch ALL advances
      const res = await axios.get(API_FETCH_ADVANCE);
      console.log("[Casual] All advances fetched:", res.data.length);
      
      // Initialize loans to 0 for all employees
      const loanData = {};
      records.forEach(emp => {
        if (emp.email) loanData[emp.email] = 0;
      });

      // Filter and calculate loans
      res.data.forEach((advance) => {
        // Skip if not active
        if (advance.status !== 'active') {
          return;
        }

        // Skip if no email
        if (!advance.email) {
          return;
        }

        // Check if advance has a deduction schedule
        if (advance.deduction_schedule && Array.isArray(advance.deduction_schedule)) {
          // Look for schedule item for this month
          const scheduleItem = advance.deduction_schedule.find(item => 
            item.date_format === selectedScheduleKey && item.status === 'pending'
          );
          
          if (scheduleItem) {
            // Found a pending deduction for this month
            const amount = parseFloat(scheduleItem.amount) || 0;
            loanData[advance.email] = (loanData[advance.email] || 0) + amount;
          }
        } 
        // Fallback: If no schedule but has deduction_start, check if this is the start month
        else if (advance.deduction_start === selectedMonthYear) {
          // This is the first deduction month
          const amount = parseFloat(advance.per_month_deduction) || 
                         parseFloat(advance.amount) / (advance.split_months || 1);
          loanData[advance.email] = (loanData[advance.email] || 0) + amount;
        }
        // Fallback: Check if deduction_start is before selected month
        else if (advance.deduction_start && advance.deduction_start < selectedMonthYear) {
          // Simple check: if deduction started before this month and not completed
          const totalMonths = advance.total_deduction_months || advance.split_months || 1;
          const startDate = new Date(advance.deduction_start + '-01');
          const currentDate = new Date(selectedMonthYear + '-01');
          
          // Calculate month difference
          const monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                           (currentDate.getMonth() - startDate.getMonth());
          
          // Check if within deduction period and not completed
          if (monthsDiff >= 0 && monthsDiff < totalMonths && 
              advance.amount_remaining > 0) {
            const amount = parseFloat(advance.per_month_deduction) || 
                           parseFloat(advance.amount) / totalMonths;
            loanData[advance.email] = (loanData[advance.email] || 0) + amount;
          }
        }
      });

      console.log("[Casual] Loan data after calculation:", loanData);
      setLoans(loanData);
      
    } catch (error) {
      console.error("[Casual] Error fetching loans:", error);
      // On error, set loans to 0 for all employees
      const zeroLoans = {};
      records.forEach(emp => {
        if (emp.email) zeroLoans[emp.email] = 0;
      });
      setLoans(zeroLoans);
    }
  };

  // -------------------------------------------------------------
  // FETCH SAVED CASUAL SALARY REPORT
  // -------------------------------------------------------------
  const fetchSavedReport = async () => {
    if (!month || !year) return;
    
    const monthKey = getMonthYearKey(month, year);
    setCurrentMonthKey(monthKey);
    
    try {
      const res = await axios.get(API_GET_SAVED, {
        params: { month, year },
      });

      if (res.data.length > 0) {
        setRecords(res.data);
        setCalculated(true);
        
        // Extract and store salaries from saved report for this month
        const savedSalaries = {};
        res.data.forEach(rec => {
          if (rec.email && rec.salaryInput) {
            savedSalaries[rec.email] = parseFloat(rec.salaryInput) || 0;
          }
        });
        
        // Store salaries under current month key
        setSalaryInputs(prev => ({
          ...prev,
          [monthKey]: savedSalaries
        }));
      } else {
        // No saved report found, initialize with employee default salaries
        setCalculated(false);
      }
    } catch (e) {
      console.log("[Casual] No saved report found for", month, year);
      setCalculated(false);
    }
  };

  // -------------------------------------------------------------
  // Fetch Casual Labour Employees
  // -------------------------------------------------------------
  const fetchCasualEmployees = async () => {
    try {
      setLoading(true);
      const res = await axios.get(API_FETCH_EMP);
      const filtered = res.data.filter(
        (emp) => emp.esiPfStatus === "Casual Labour"
      );

      setRecords(filtered);
      setLoading(false);
    } catch (error) {
      console.error("[Casual] Error fetching employees:", error);
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Fetch Attendance Summary
  // -------------------------------------------------------------
  const fetchAttendanceSummary = async () => {
    if (!month || !year) return;
    try {
      const res = await axios.get(API_FETCH_ATT, {
        params: { month, year },
      });
      const leaveData = res.data.map((a) => ({
        email: a.email,
        leave: a.absent || 0,
      }));
      setAttendanceData(leaveData);
    } catch (error) {
      console.error("[Casual] Error fetching attendance summary:", error);
    }
  };

  // -------------------------------------------------------------
  // EFFECTS
  // -------------------------------------------------------------
  useEffect(() => {
    fetchCasualEmployees();
  }, []);

  // When month/year changes, fetch attendance, loans and saved report
  useEffect(() => {
    if (month && year) {
      const monthKey = getMonthYearKey(month, year);
      setCurrentMonthKey(monthKey);
      fetchAttendanceSummary();
      fetchLoansForMonth(); // Fetch loans for selected month
      fetchSavedReport();
    } else {
      // When no month selected, set loans to 0
      const zeroLoans = {};
      records.forEach(emp => {
        if (emp.email) zeroLoans[emp.email] = 0;
      });
      setLoans(zeroLoans);
    }
  }, [month, year]);

  // When records change, update loans if month is selected
  useEffect(() => {
    if (month && year && records.length > 0) {
      fetchLoansForMonth();
    }
  }, [records]);

  // -------------------------------------------------------------
  // Input Handlers
  // -------------------------------------------------------------
  const handleSalaryInput = (email, value) => {
    setCurrentSalary(email, value);
  };
  
  const handleGraceInput = (email, value) => {
    setGraceDays((prev) => ({ ...prev, [email]: parseFloat(value) || 0 }));
  };

  // -------------------------------------------------------------
  // Month/Year Change Handlers
  // -------------------------------------------------------------
  const handleMonthChange = (value) => {
    setMonth(value);
  };

  const handleYearChange = (value) => {
    setYear(value);
  };

  // -------------------------------------------------------------
  // Main Calculation
  // -------------------------------------------------------------
  const calculateSalaries = () => {
    if (!month || !year) {
      alert("Please select month and year");
      return;
    }

    const updated = records.map((rec) => {
      const leaveObj = attendanceData.find((a) => a.email === rec.email);
      let leave = leaveObj ? Number(leaveObj.leave) : 0;

      const grace = Number(graceDays[rec.email] || 0);
      leave = Math.max(0, leave - grace);

      const workingDays = 30;
      const presentDays = workingDays - leave;

      // Get salary from current month's data, fallback to employee's default salary
      const currentSalary = getCurrentSalary(rec.email);
      const salaryInput = currentSalary !== "" ? Number(currentSalary) : Number(rec.salary || 0);
      
      const salaryPayable = (presentDays / workingDays) * salaryInput;

      // LOAN LOGIC: Get loan for current month from state
      // This will be 0 if no month selected or if no advances for selected month
      const loan = Number(loans[rec.email] || 0);
      const netSalary = salaryPayable - loan;

      return {
        ...rec,
        leave,
        grace,
        workingDays,
        presentDays,
        salaryInput: salaryInput.toFixed(2),
        salaryPayable: salaryPayable.toFixed(2),
        loan: loan.toFixed(2), // This will be 0 for non-matching months
        netSalary: netSalary.toFixed(2),
      };
    });

    setRecords(updated);
    setCalculated(true);
    setCurrentPage(1); // Reset to first page after calculation
  };

  // -------------------------------------------------------------
  // Save Salary Report
  // -------------------------------------------------------------
  const saveReport = async () => {
    try {
      // Ensure we save current month's salary inputs
      if (currentMonthKey) {
        const currentSalaries = {};
        records.forEach(rec => {
          if (rec.email && rec.salaryInput) {
            currentSalaries[rec.email] = parseFloat(rec.salaryInput) || 0;
          }
        });
        
        // Update salary inputs for current month
        setSalaryInputs(prev => ({
          ...prev,
          [currentMonthKey]: currentSalaries
        }));
      }

      const payload = {
        month,
        year,
        records,
      };

      await axios.post(API_SAVE_SALARY, payload);
      alert("Salary report saved successfully!");
    } catch (error) {
      console.error("[Casual] Save error:", error);
      alert("Failed to save salary report");
    }
  };

  /* -----------------------------------------------------------
     PAGINATION LOGIC
  ----------------------------------------------------------- */
  
  // Get current records for the current page
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = records.slice(indexOfFirstRecord, indexOfLastRecord);
  
  // Calculate total pages
  const totalPages = Math.ceil(records.length / recordsPerPage);
  
  // Generate page numbers
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  // Pagination handlers
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handlePageClick = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>👷 Casual Labour Salary Report</h2>

      {/* Header Section */}
      <div style={styles.headerSection}>
        <div style={styles.controls}>
          <div>
            <label style={styles.label}>Month</label>
            <select
              style={styles.select}
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
            >
              <option value="">Select Month</option>
              {[
                "January","February","March","April","May","June",
                "July","August","September","October","November","December",
              ].map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>Year</label>
            <select
              style={styles.select}
              value={year}
              onChange={(e) => handleYearChange(e.target.value)}
            >
              <option value="">Select Year</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, alignSelf: "flex-end" }}>
            <button style={styles.calcBtn} onClick={calculateSalaries} disabled={loading}>
              Calculate
            </button>

            {calculated && (
              <button style={styles.saveBtn} onClick={saveReport}>
                Save Report
              </button>
            )}
          </div>
        </div>

        {/* Loan Information Banner */}
        {month && year && (
          <div style={styles.loanInfo}>
            📅 <strong>Loan Deduction for:</strong> {month}/{year} 
            <span style={{ marginLeft: '20px', fontSize: '14px' }}>
              (Advances will be deducted based on deduction schedule or deduction_start)
            </span>
          </div>
        )}
      </div>

      {calculated ? (
        <>
          {/* Records Count */}
          <div style={styles.recordsInfo}>
            Showing {indexOfFirstRecord + 1} - {Math.min(indexOfLastRecord, records.length)} of {records.length} records
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>S.No</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Leave</th>
                  <th style={styles.th}>Grace (+)</th>
                  <th style={styles.th}>Working Days</th>
                  <th style={styles.th}>Present Days</th>
                  <th style={styles.th}>Salary</th>
                  <th style={styles.th}>Salary Payable</th>
                  <th style={styles.th}>Loan</th>
                  <th style={styles.th}>Net Salary</th>
                </tr>
              </thead>

              <tbody>
                {currentRecords.map((rec, idx) => {
                  const actualIndex = indexOfFirstRecord + idx;
                  const loanAmount = parseFloat(rec.loan) || 0;
                  const hasLoan = loanAmount > 0;
                  
                  return (
                    <tr key={rec.email || idx} style={styles.tr}>
                      <td style={styles.tdCenter}>{actualIndex + 1}</td>
                      <td style={styles.td}>{rec.name}</td>
                      <td style={styles.td}>{rec.email}</td>
                      <td style={styles.tdCenter}>{rec.leave ?? 0}</td>

                      <td style={styles.tdCenter}>
                        <input
                          type="number"
                          value={graceDays[rec.email] ?? ""}
                          onChange={(e) => handleGraceInput(rec.email, e.target.value)}
                          style={styles.smallInput}
                          placeholder="0"
                        />
                      </td>

                      <td style={styles.tdCenter}>{rec.workingDays ?? 30}</td>
                      <td style={styles.tdCenter}>{rec.presentDays ?? (30 - (rec.leave || 0))}</td>

                      <td style={styles.tdCenter}>
                        <input
                          type="number"
                          value={getCurrentSalary(rec.email)}
                          onChange={(e) => handleSalaryInput(rec.email, e.target.value)}
                          style={styles.smallInput}
                          placeholder={rec.salary || "0.00"}
                        />
                      </td>

                      <td style={styles.tdRight}>{rec.salaryPayable ?? "-"}</td>
                      
                      {/* Loan Column - Only shows amount if month matches */}
                      <td style={{
                        ...styles.tdRight,
                        color: hasLoan ? "#e74c3c" : "#95a5a6",
                        fontWeight: hasLoan ? "bold" : "normal",
                        backgroundColor: hasLoan ? "#fff5f5" : "transparent"
                      }}>
                        {rec.loan}
                        {hasLoan && (
                          <div style={{ 
                            fontSize: "10px", 
                            color: "#e74c3c",
                            fontStyle: "italic"
                          }}>
                            ({month}/{year})
                          </div>
                        )}
                      </td>
                      
                      <td style={{ ...styles.tdRight, color: "#1b8f3b", fontWeight: 700 }}>
                        {rec.netSalary ?? "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {records.length > recordsPerPage && (
            <div style={styles.pagination}>
              <button 
                onClick={handlePrevPage} 
                disabled={currentPage === 1}
                style={{
                  ...styles.pageBtn,
                  ...(currentPage === 1 ? styles.disabledBtn : {})
                }}
              >
                Previous
              </button>
              
              <div style={styles.pageNumbers}>
                {pageNumbers.map(number => (
                  <button
                    key={number}
                    onClick={() => handlePageClick(number)}
                    style={{
                      ...styles.pageNumberBtn,
                      ...(currentPage === number ? styles.activePageBtn : {})
                    }}
                  >
                    {number}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={handleNextPage} 
                disabled={currentPage === totalPages}
                style={{
                  ...styles.pageBtn,
                  ...(currentPage === totalPages ? styles.disabledBtn : {})
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={styles.hint}>
          <div style={{ marginBottom: '10px' }}>
            Select month & year, enter salary and grace days, then click <b>Calculate</b>.
          </div>
          {month && year ? (
            <div style={styles.loanHint}>
              ✅ Loan deduction will be applied for active advances with:<br/>
              1. Deduction schedule for {formatDeductMonth(month, year)} OR<br/>
              2. deduction_start = {formatDeductionStart(month, year)}<br/>
              🔄 Other months will have <b>loan = 0</b>
            </div>
          ) : (
            <div style={styles.loanHint}>
              ⏳ Select a month to see loan deductions
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------ Styles ------------ */
const styles = {
  page: {
    padding: 24,
    background: "#f5f7fb",
    minHeight: "100vh",
  },
  title: {
    textAlign: "center",
    marginBottom: 18,
    color: "#243447",
  },
  headerSection: {
    marginBottom: 18,
  },
  controls: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    alignItems: "flex-end",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  recordsInfo: {
    textAlign: "center",
    marginBottom: 10,
    color: "#666",
    fontSize: "14px",
    fontWeight: "500",
  },
  loanInfo: {
    background: "#e8f4fc",
    border: "1px solid #3498db",
    borderRadius: "6px",
    padding: "10px 15px",
    textAlign: "center",
    color: "#2c3e50",
    fontSize: "15px",
    marginTop: "10px",
  },
  label: { display: "block", marginBottom: 6, fontSize: 13 },
  select: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #d0d6de",
    minWidth: 160,
    background: "#fff",
  },
  calcBtn: {
    padding: "10px 18px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  saveBtn: {
    padding: "10px 18px",
    borderRadius: 8,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  tableWrap: {
    overflowX: "auto",
    background: "#fff",
    borderRadius: 10,
    padding: 12,
    boxShadow: "0 8px 24px rgba(35,54,90,0.06)",
    marginBottom: 20,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1100,
  },
  th: {
    padding: "10px 12px",
    background: "#0f1724",
    color: "#fff",
    textAlign: "center",
  },
  tr: {
    borderBottom: "1px solid #eef2f6",
    '&:hover': {
      backgroundColor: "#f9f9f9",
    },
  },
  td: { padding: "10px 12px" },
  tdCenter: { padding: "10px 12px", textAlign: "center" },
  tdRight: { padding: "10px 12px", textAlign: "right" },
  smallInput: {
    width: 90,
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    textAlign: "right",
  },
  hint: { 
    textAlign: "center", 
    color: "#475569",
    marginTop: 16,
    padding: "20px",
    background: "#fff",
    borderRadius: "8px",
    border: "1px solid #e2e8f0"
  },
  loanHint: {
    marginTop: "15px",
    padding: "12px",
    background: "#f8f9fa",
    borderRadius: "6px",
    borderLeft: "4px solid #3498db",
    fontSize: "14px",
    color: "#2c3e50",
    lineHeight: "1.5",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 15,
    marginTop: 20,
  },
  pageBtn: {
    padding: "8px 16px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: "500",
    minWidth: 80,
  },
  disabledBtn: {
    background: "#ccc",
    cursor: "not-allowed",
  },
  pageNumbers: {
    display: "flex",
    gap: 5,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pageNumberBtn: {
    padding: "8px 12px",
    background: "#f1f1f1",
    color: "#333",
    border: "1px solid #ddd",
    borderRadius: 4,
    cursor: "pointer",
    minWidth: 40,
    textAlign: "center",
  },
  activePageBtn: {
    background: "#2563eb",
    color: "white",
    borderColor: "#2563eb",
  },
};

export default CasualLabourSalaryReport;