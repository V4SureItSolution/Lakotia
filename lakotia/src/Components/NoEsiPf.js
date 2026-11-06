import { API_BASE } from "../config";
import axios from "axios";
import { useState,useEffect } from "react";
const API_SAVE = `${API_BASE}/salary/noesi/save`;
const API_FETCH = `${API_BASE}/salary/noesi`;
const API_ADVANCE = `${API_BASE}/advance`; // Your advance API endpoint

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

const NoESIPFSalaryReport = () => {
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

  // Helper to get grace days for current month
  const getCurrentGrace = (email) => {
    if (!currentMonthKey || !graceDays[currentMonthKey]) {
      return "";
    }
    return graceDays[currentMonthKey][email] || "";
  };

  // Helper to set grace days for current month
  const setCurrentGrace = (email, value) => {
    if (!currentMonthKey) return;
    
    setGraceDays(prev => {
      const newGraceDays = {
        ...prev,
        [currentMonthKey]: {
          ...(prev[currentMonthKey] || {}),
          [email]: parseFloat(value) || 0
        }
      };
      return newGraceDays;
    });
  };

  /* -----------------------------------------------------------
     NEW FUNCTION: Get Previous Month
  ----------------------------------------------------------- */
  const getPreviousMonth = (m, y) => {
    if (m === 1) return { month: 12, year: y - 1 };
    return { month: m - 1, year: y };
  };

  /* -----------------------------------------------------------
     Fetch nearest previous month salary (for initial display)
  ----------------------------------------------------------- */
  const fetchPreviousMonthSalary = async (selectedMonth, selectedYear) => {
    const monthKey = getMonthYearKey(selectedMonth, selectedYear);
    
    // Check if we already have data for current month (from saved report)
    if (salaryInputs[monthKey] && Object.keys(salaryInputs[monthKey]).length > 0) {
      console.log("Already have saved data for current month:", monthKey);
      return;
    }
    
    let m = Number(selectedMonth);
    let y = Number(selectedYear);

    for (let i = 0; i < 12; i++) {
      const { month: prevMonth, year: prevYear } = getPreviousMonth(m, y);
      const prevMonthKey = getMonthYearKey(prevMonth, prevYear);

      try {
        const res = await axios.get(API_FETCH, {
          params: { month: prevMonth, year: prevYear },
        });

        if (res.data.length > 0) {
          console.log("Found previous salary in:", prevMonth, prevYear, "for initial display");

          // Extract salaries from previous month
          const prevMonthSalaries = {};
          const prevMonthGrace = {};
          
          res.data.forEach((row) => {
            if (row.email) {
              if (row.salaryInput || row.salary) {
                prevMonthSalaries[row.email] = parseFloat(row.salaryInput || row.salary) || 0;
              }
              if (row.grace) {
                prevMonthGrace[row.email] = parseFloat(row.grace) || 0;
              }
            }
          });

          // Store previous month's data under its own key
          setSalaryInputs(prev => ({
            ...prev,
            [prevMonthKey]: prevMonthSalaries
          }));

          setGraceDays(prev => ({
            ...prev,
            [prevMonthKey]: prevMonthGrace
          }));

          // Use previous month's salary as initial value for current month
          // ONLY if current month doesn't already have data
          setSalaryInputs(prev => ({
            ...prev,
            [monthKey]: {
              ...(prev[monthKey] || {}),
              ...prevMonthSalaries
            }
          }));

          // Use previous month's grace as initial value
          setGraceDays(prev => ({
            ...prev,
            [monthKey]: {
              ...(prev[monthKey] || {}),
              ...prevMonthGrace
            }
          }));

          return; // Stop searching further
        }
      } catch (e) {
        console.error("Error fetching previous salary", e);
      }

      m = prevMonth;
      y = prevYear;
    }
  };

  // ---------------------------------------------------------
  // Fetch loans for selected month - FIXED LOGIC
  // ---------------------------------------------------------
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
      
      console.log(`[No ESI/PF] Fetching loans for: ${selectedMonthYear}`);
      
      // Fetch ALL advances
      const res = await axios.get(API_ADVANCE);
      console.log("[No ESI/PF] All advances fetched:", res.data.length);
      
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

      console.log("[No ESI/PF] Loan data after calculation:", loanData);
      setLoans(loanData);
      
    } catch (error) {
      console.error("[No ESI/PF] Error fetching loans:", error);
      // On error, set loans to 0 for all employees
      const zeroLoans = {};
      records.forEach(emp => {
        if (emp.email) zeroLoans[emp.email] = 0;
      });
      setLoans(zeroLoans);
    }
  };

  /* -----------------------------------------------------------
     Fetch employees - No ESI/PF
  ----------------------------------------------------------- */
  const fetchNoESIPFEmployees = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/employee/all`);

      const filtered = res.data.filter(
        (emp) => emp.esiPfStatus === "No ESI/PF"
      );

      setRecords(filtered);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setLoading(false);
    }
  };

  /* -----------------------------------------------------------
     Fetch attendance summary
  ----------------------------------------------------------- */
  const fetchAttendanceSummary = async () => {
    if (!month || !year) return;
    try {
      const res = await axios.get(
        `${API_BASE}/attendance/summary`,
        {
          params: { month, year },
        }
      );

      const leaveData = res.data.map((a) => ({
        email: a.email,
        leave: a.absent || 0,
      }));

      setAttendanceData(leaveData);
    } catch (error) {
      console.error("Error fetching attendance summary:", error);
    }
  };

  /* -----------------------------------------------------------
     ON PAGE LOAD
  ----------------------------------------------------------- */
  useEffect(() => {
    fetchNoESIPFEmployees();
  }, []);

  /* -----------------------------------------------------------
     ON MONTH/YEAR CHANGE
  ----------------------------------------------------------- */
  useEffect(() => {
    if (month && year) {
      const monthKey = getMonthYearKey(month, year);
      setCurrentMonthKey(monthKey);
      fetchAttendanceSummary();
      fetchLoansForMonth(); // Fetch loans for selected month
      
      // First try to load saved report for current month
      loadSavedReportForCurrentMonth();
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

  /* -----------------------------------------------------------
     Load saved report for current month (auto on month change)
  ----------------------------------------------------------- */
  const loadSavedReportForCurrentMonth = async () => {
    if (!month || !year) return;

    try {
      const res = await axios.get(API_FETCH, { params: { month, year } });

      if (res.data.length > 0) {
        console.log("Found saved report for current month:", month, year);
        setRecords(res.data);
        setCalculated(true);

        // Extract and store salaries and grace days from saved report
        const monthKey = getMonthYearKey(month, year);
        const savedSalaries = {};
        const savedGraceDays = {};
        
        res.data.forEach(row => {
          if (row.email) {
            if (row.salaryInput || row.salary) {
              savedSalaries[row.email] = parseFloat(row.salaryInput || row.salary) || 0;
            }
            if (row.grace) {
              savedGraceDays[row.email] = parseFloat(row.grace) || 0;
            }
          }
        });

        // Store under current month key
        setSalaryInputs(prev => ({
          ...prev,
          [monthKey]: savedSalaries
        }));

        setGraceDays(prev => ({
          ...prev,
          [monthKey]: savedGraceDays
        }));
      } else {
        // No saved report found, try to get previous month's data as initial value
        console.log("No saved report, fetching previous month as initial value");
        setCalculated(false);
        fetchPreviousMonthSalary(month, year);
      }
    } catch (error) {
      console.error("Error loading saved report:", error);
      setCalculated(false);
      // On error, try to get previous month's data
      fetchPreviousMonthSalary(month, year);
    }
  };

  /* -----------------------------------------------------------
     Input Handlers
  ----------------------------------------------------------- */
  const handleSalaryInput = (email, value) => {
    setCurrentSalary(email, value);
  };

  const handleGraceInput = (email, value) => {
    setCurrentGrace(email, value);
  };

  /* -----------------------------------------------------------
     Calculate Salaries
  ----------------------------------------------------------- */
  const calculateSalaries = () => {
    if (!month || !year) {
      alert("Please select month and year");
      return;
    }

    const updated = records.map((rec) => {
      const leaveObj = attendanceData.find((a) => a.email === rec.email);
      let leave = leaveObj ? Number(leaveObj.leave) : 0;

      const grace = Number(getCurrentGrace(rec.email) || 0);
      leave = Math.max(0, leave - grace);

      const workingDays = 32;
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

  /* -----------------------------------------------------------
     SAVE REPORT
  ----------------------------------------------------------- */
  const saveReport = async () => {
    if (!calculated) return alert("Please calculate first!");
    if (!month || !year) return alert("Select month & year!");

    try {
      // First save current month's salary inputs to state
      if (currentMonthKey) {
        const currentSalaries = {};
        const currentGraceDays = {};
        
        records.forEach(rec => {
          if (rec.email) {
            if (rec.salaryInput) {
              currentSalaries[rec.email] = parseFloat(rec.salaryInput) || 0;
            }
            if (rec.grace) {
              currentGraceDays[rec.email] = parseFloat(rec.grace) || 0;
            }
          }
        });
        
        // Update salary inputs and grace days for current month
        setSalaryInputs(prev => ({
          ...prev,
          [currentMonthKey]: currentSalaries
        }));
        
        setGraceDays(prev => ({
          ...prev,
          [currentMonthKey]: currentGraceDays
        }));
      }

      // Save to API
      await axios.post(API_SAVE, { month, year, records });
      alert("Report saved successfully!");
    } catch (error) {
      console.error("Save error:", error);
      alert("Error saving report");
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
      <h2 style={styles.title}>👷 No ESI/PF Salary Report</h2>

      {/* Header Section */}
      <div style={styles.headerSection}>
        <div style={styles.controls}>
          {/* Month */}
          <div>
            <label style={styles.label}>Month</label>
            <select
              style={styles.select}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="">Select Month</option>
              {[
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
              ].map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label style={styles.label}>Year</label>
            <select
              style={styles.select}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, alignSelf: "flex-end" }}>
            <button style={styles.calcBtn} onClick={calculateSalaries} disabled={loading}>
              Calculate
            </button>

            <button style={styles.saveBtn} onClick={saveReport}>
              Save Report
            </button>
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
                    <tr key={actualIndex} style={styles.tr}>
                      <td style={styles.tdCenter}>{actualIndex + 1}</td>
                      <td style={styles.td}>{rec.name}</td>
                      <td style={styles.td}>{rec.email}</td>
                      <td style={styles.tdCenter}>{rec.leave}</td>

                      <td style={styles.tdCenter}>
                        <input
                          type="number"
                          value={getCurrentGrace(rec.email)}
                          onChange={(e) =>
                            handleGraceInput(rec.email, e.target.value)
                          }
                          style={styles.smallInput}
                          placeholder="0"
                        />
                      </td>

                      <td style={styles.tdCenter}>{rec.workingDays}</td>
                      <td style={styles.tdCenter}>{rec.presentDays}</td>

                      <td style={styles.tdCenter}>
                        <input
                          type="number"
                          value={getCurrentSalary(rec.email)}
                          onChange={(e) =>
                            handleSalaryInput(rec.email, e.target.value)
                          }
                          style={styles.smallInput}
                          placeholder={rec.salary || "0.00"}
                        />
                      </td>

                      <td style={styles.tdRight}>{rec.salaryPayable}</td>
                      
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
                      
                      <td
                        style={{
                          ...styles.tdRight,
                          color: "green",
                          fontWeight: 700,
                        }}
                      >
                        {rec.netSalary}
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
            Select month & year then click Calculate.
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

/* ------------ STYLES ------------ */
const styles = {
  page: {
    padding: 24,
    background: "#f6f7fb",
    minHeight: "100vh",
    fontFamily: "Inter",
  },
  title: {
    textAlign: "center",
    marginBottom: 15,
  },
  headerSection: {
    marginBottom: 20,
  },
  controls: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    alignItems: "flex-end",
    flexWrap: "wrap",
    marginBottom: 12,
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
  recordsInfo: {
    textAlign: "center",
    marginBottom: 10,
    color: "#666",
    fontSize: "14px",
    fontWeight: "500",
  },
  label: { marginBottom: 6, fontSize: 13 },
  select: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #ccc",
  },
  calcBtn: {
    padding: "10px 18px",
    background: "#2563eb",
    color: "white",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
  },
  saveBtn: {
    padding: "10px 18px",
    background: "green",
    color: "white",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
  },
  tableWrap: {
    background: "#fff",
    padding: 12,
    borderRadius: 8,
    overflowX: "auto",
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  table: { 
    width: "100%", 
    borderCollapse: "collapse",
    minWidth: 1100,
  },
  th: {
    padding: 12,
    background: "#1a1a1a",
    color: "white",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  td: {
    padding: 10,
    borderBottom: "1px solid #eee",
  },
  tdCenter: {
    padding: 10,
    textAlign: "center",
    borderBottom: "1px solid #eee",
  },
  tdRight: {
    padding: 10,
    textAlign: "right",
    borderBottom: "1px solid #eee",
  },
  tr: {
    '&:hover': {
      backgroundColor: "#f9f9f9",
    },
  },
  smallInput: {
    width: 90,
    padding: 6,
    borderRadius: 4,
    border: "1px solid #ccc",
    textAlign: "right",
    fontSize: "14px",
  },
  hint: { 
    textAlign: "center", 
    marginTop: 15,
    padding: "20px",
    background: "#fff",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
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

export default NoESIPFSalaryReport;