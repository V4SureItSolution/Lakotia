import React, { useState, useEffect, useMemo } from "react";
import { FaPlus, FaEye, FaCalendarAlt, FaPercentage, FaCalendarCheck, FaCalculator } from "react-icons/fa";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "bootstrap/dist/css/bootstrap.min.css";

import { API_BASE } from "../config";

const API_ADVANCE = `${API_BASE}/advance`;
const API_EMPLOYEE = `${API_BASE}/employee/all`;
const PAGE_SIZE = 10;

const AdvancePage = () => {
  const [advances, setAdvances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    department: "",
    amount: "",
    reason: "",
    split_percentage: "50", // Default to 50%
    deduction_start: "", // Month when deduction should start (YYYY-MM)
  });

  useEffect(() => {
    fetchEmployees();
    fetchAdvances();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(API_EMPLOYEE);
      setEmployees(res.data);
    } catch {
      toast.error("Failed to fetch employees");
    }
  };

  const fetchAdvances = async () => {
    try {
      const res = await axios.get(API_ADVANCE);
      setAdvances(res.data);
    } catch {
      toast.error("Failed to fetch advances");
    }
  };

  const handleEmailChange = (e) => {
    const email = e.target.value;
    const emp = employees.find((x) => x.email === email);

    setFormData((p) => ({
      ...p,
      email,
      name: emp?.name || "",
      department: emp?.department || "",
    }));
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔥 SIMPLIFIED CALCULATION: Calculate based on percentage only
  const calculateDeductionSchedule = () => {
    const amount = parseFloat(formData.amount);
    const percentage = parseFloat(formData.split_percentage) / 100;
    
    if (!amount || !percentage) return [];
    
    // Calculate how many months needed based on percentage
    const splitMonths = Math.ceil(1 / percentage);
    
    let startDate;
    if (formData.deduction_start) {
      const [year, month] = formData.deduction_start.split('-');
      startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    } else {
      const currentDate = new Date();
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }
    
    const deductions = [];
    let remainingAmount = amount;
    
    // Calculate regular deduction amount
    const regularDeduction = Math.round((amount * percentage) * 100) / 100;
    
    for (let i = 0; i < splitMonths; i++) {
      const deductionDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      
      // Calculate amount for this deduction
      let deductionAmount;
      if (i < splitMonths - 1) {
        // For all months except last: use regular deduction
        deductionAmount = regularDeduction;
        remainingAmount -= deductionAmount;
      } else {
        // Last month: use remaining amount
        deductionAmount = Math.round(remainingAmount * 100) / 100;
      }
      
      // Ensure no negative amounts
      if (deductionAmount < 0) deductionAmount = 0;
      
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      
      deductions.push({
        month: monthNames[deductionDate.getMonth()],
        year: deductionDate.getFullYear(),
        month_number: deductionDate.getMonth() + 1,
        year_number: deductionDate.getFullYear(),
        amount: deductionAmount.toFixed(2),
        date_string: `${monthNames[deductionDate.getMonth()]}/${deductionDate.getFullYear()}`,
        date_format: `${(deductionDate.getMonth() + 1).toString().padStart(2, '0')}/${deductionDate.getFullYear()}`,
        status: "pending",
        percentage: ((deductionAmount / amount) * 100).toFixed(1)
      });
    }
    
    return deductions;
  };

  // Calculate summary
  const calculateSummary = () => {
    const schedule = calculateDeductionSchedule();
    const amount = parseFloat(formData.amount) || 0;
    const splitPercentage = parseFloat(formData.split_percentage) || 50;
    
    const perMonthAmount = (amount * (splitPercentage / 100));
    const totalMonths = Math.ceil(100 / splitPercentage);
    
    return {
      totalAmount: amount,
      perMonthDeduction: perMonthAmount.toFixed(2),
      totalMonths: totalMonths,
      startMonth: schedule[0] ? `${schedule[0].month} ${schedule[0].year}` : "-",
      endMonth: schedule[schedule.length - 1] ? `${schedule[schedule.length - 1].month} ${schedule[schedule.length - 1].year}` : "-"
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const deductionSchedule = calculateDeductionSchedule();
      const summary = calculateSummary();
      
      // Validate calculations
      const totalScheduleAmount = deductionSchedule.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      const originalAmount = parseFloat(formData.amount);
      
      if (Math.abs(totalScheduleAmount - originalAmount) > 0.01) {
        toast.error(`Calculation error: Sum ${totalScheduleAmount} doesn't match original ${originalAmount}`);
        return;
      }
      
      const advanceData = {
        email: formData.email,
        name: formData.name,
        department: formData.department,
        amount: originalAmount,
        reason: formData.reason,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        
        split_percentage: parseFloat(formData.split_percentage),
        split_months: summary.totalMonths, // Automatically calculated
        deduction_start: formData.deduction_start || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 7),
        
        deduction_schedule: deductionSchedule,
        per_month_deduction: summary.perMonthDeduction,
        total_deduction_months: summary.totalMonths,
        deduction_start_month: summary.startMonth,
        deduction_end_month: summary.endMonth,
        
        status: "active",
        amount_deducted: 0,
        amount_remaining: originalAmount,
        deductions_completed: 0
      };

      await axios.post(API_ADVANCE, advanceData);

      toast.success("Advance added successfully with split deduction");
      setShowForm(false);
      setFormData({
        email: "",
        name: "",
        department: "",
        amount: "",
        reason: "",
        split_percentage: "50",
        deduction_start: ""
      });
      fetchAdvances();
    } catch (error) {
      toast.error("Submit failed: " + (error.response?.data?.message || error.message));
    }
  };

  // Search functionality
  const filtered = useMemo(() => {
    return advances.filter(
      (a) =>
        a.email?.toLowerCase().includes(search.toLowerCase()) ||
        a.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.department?.toLowerCase().includes(search.toLowerCase()) ||
        a.reason?.toLowerCase().includes(search.toLowerCase())
    );
  }, [advances, search]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Percentage options as dropdown options
  const percentageOptions = [
    { value: "100", label: "100% - Full in one month", months: 1 },
    { value: "50", label: "50% - Half each month (2 months)", months: 2 },
    { value: "33", label: "33% - One third each month (3 months)", months: 3 },
    { value: "25", label: "25% - Quarter each month (4 months)", months: 4 },
    { value: "20", label: "20% - Fifth each month (5 months)", months: 5 },
    { value: "10", label: "10% - Tenth each month (10 months)", months: 10 }
  ];

  // Calculate example for better understanding
  const getCalculationExample = () => {
    const amount = parseFloat(formData.amount) || 1000;
    const percentage = parseFloat(formData.split_percentage) || 50;
    const months = Math.ceil(100 / percentage);
    
    const monthlyDeduction = (amount * (percentage / 100));
    
    return {
      exampleAmount: amount,
      examplePercentage: percentage,
      exampleMonths: months,
      monthlyDeduction: monthlyDeduction.toFixed(2),
      totalMonthsText: `${months} month${months > 1 ? 's' : ''}`,
      calculation: `${percentage}% of ₹${amount} = ₹${monthlyDeduction.toFixed(2)} per month`
    };
  };

  return (
    <div className="container mt-4">
      

      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold text-warning">💰 Employee Advance Management</h4>
          <p className="text-muted mb-0">Percentage-based automatic deduction calculation</p>
        </div>
        <button
          className="btn btn-warning text-dark fw-semibold shadow-sm"
          onClick={() => setShowForm(true)}
        >
          <FaPlus className="me-2" /> Add New Advance
        </button>
      </div>

      {/* STATS CARD */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card border-warning bg-light">
            <div className="card-body">
              <h6 className="text-muted">Total Advances</h6>
              <h4 className="fw-bold text-warning">{advances.length}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-info bg-light">
            <div className="card-body">
              <h6 className="text-muted">Active Advances</h6>
              <h4 className="fw-bold text-info">{advances.filter(a => a.status === 'active').length}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-success bg-light">
            <div className="card-body">
              <h6 className="text-muted">Total Amount</h6>
              <h4 className="fw-bold text-success">
                ₹{advances.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0).toLocaleString('en-IN')}
              </h4>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-primary bg-light">
            <div className="card-body">
              <h6 className="text-muted">Pending Deductions</h6>
              <h4 className="fw-bold text-primary">
                ₹{advances
                  .filter(a => a.status === 'active')
                  .reduce((sum, a) => sum + parseFloat(a.amount_remaining || a.amount || 0), 0)
                  .toLocaleString('en-IN')}
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="input-group">
            <span className="input-group-text bg-warning border-warning">
              <FaEye />
            </span>
            <input
              className="form-control"
              placeholder="Search by email, name, department, or reason..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="card shadow rounded-4 border-0 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-warning">
              <tr>
                <th className="ps-4">#</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Advance Amount</th>
                <th>Deduction Plan</th>
                <th>Status</th>
                <th>Remaining</th>
                <th className="text-center pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((a, i) => (
                <tr key={a.id || i} className={a.status === 'completed' ? 'table-light' : ''}>
                  <td className="ps-4 fw-semibold">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td>
                    <div className="d-flex flex-column">
                      <strong>{a.name}</strong>
                      <small className="text-muted">{a.email}</small>
                    </div>
                  </td>
                  <td>
                    <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25">
                      {a.department}
                    </span>
                  </td>
                  <td>
                    <div className="fw-bold text-primary fs-5">₹{parseFloat(a.amount).toLocaleString('en-IN')}</div>
                    <small className="text-muted">{a.date}</small>
                  </td>
                  <td>
                    {a.split_percentage < 100 ? (
                      <div className="d-flex flex-column">
                        <span className="badge bg-warning bg-opacity-25 text-dark mb-1">
                          {a.split_months || Math.ceil(100 / a.split_percentage)} months @ {a.split_percentage}%
                        </span>
                        <small className="text-muted">
                          ₹{parseFloat(a.per_month_deduction || (a.amount * a.split_percentage / 100)).toFixed(2)}/month
                        </small>
                      </div>
                    ) : (
                      <span className="badge bg-secondary">Single month</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${a.status === 'active' ? 'bg-success' : a.status === 'completed' ? 'bg-secondary' : 'bg-warning'}`}>
                      {a.status?.toUpperCase() || 'ACTIVE'}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex flex-column">
                      <strong className="text-success">₹{parseFloat(a.amount_remaining || a.amount).toLocaleString('en-IN')}</strong>
                      <small className="text-muted">
                        {a.deductions_completed || 0}/{a.total_deduction_months || Math.ceil(100 / (a.split_percentage || 100))} months
                      </small>
                    </div>
                  </td>
                  <td className="text-center pe-4">
                    <button
                      className="btn btn-sm btn-outline-warning"
                      onClick={() => setViewItem(a)}
                    >
                      <FaEye className="me-1" /> Details
                    </button>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center py-5">
                    <div className="text-muted">
                      <FaEye className="fs-1 mb-3" />
                      <h5>No advance records found</h5>
                      <p>Try changing your search or add a new advance</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center align-items-center gap-3 mt-4">
          <button
            className="btn btn-outline-warning"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            ← Previous
          </button>
          <div className="d-flex gap-2">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                className={`btn ${page === i + 1 ? 'btn-warning' : 'btn-outline-warning'} btn-sm`}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            className="btn btn-outline-warning"
            disabled={page === totalPages || totalPages === 0}
            onClick={() => setPage(page + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* ADD FORM MODAL */}
      {showForm && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content rounded-4 shadow-lg border-0">
              <form onSubmit={handleSubmit}>
                <div className="modal-header bg-gradient-warning text-white rounded-top-4">
                  <h5 className="fw-bold mb-0">
                    <FaPlus className="me-2" /> Add New Employee Advance
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowForm(false)}
                  />
                </div>

                <div className="modal-body p-4">
                  <div className="row g-4">
                    {/* Left Column - Employee Details */}
                    <div className="col-lg-6">
                      <div className="card border-warning h-100">
                        <div className="card-header bg-warning bg-opacity-10 border-warning">
                          <h6 className="mb-0"><FaEye className="me-2" /> Employee Information</h6>
                        </div>
                        <div className="card-body">
                          <div className="mb-3">
                            <label className="form-label fw-semibold">Employee Email *</label>
                            <select
                              className="form-select border-warning"
                              value={formData.email}
                              onChange={handleEmailChange}
                              required
                            >
                              <option value="">Select Employee Email</option>
                              {employees.map((e) => (
                                <option key={e.id} value={e.email}>
                                  {e.email} - {e.name} ({e.department})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="row g-3">
                            <div className="col-md-6">
                              <label className="form-label fw-semibold">Full Name</label>
                              <input
                                className="form-control border-warning"
                                value={formData.name}
                                readOnly
                                placeholder="Auto-filled"
                              />
                            </div>
                            <div className="col-md-6">
                              <label className="form-label fw-semibold">Department</label>
                              <input
                                className="form-control border-warning"
                                value={formData.department}
                                readOnly
                                placeholder="Auto-filled"
                              />
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="form-label fw-semibold">Advance Amount (₹) *</label>
                            <div className="input-group">
                              <span className="input-group-text bg-warning border-warning">₹</span>
                              <input
                                className="form-control border-warning"
                                type="number"
                                name="amount"
                                value={formData.amount}
                                onChange={handleChange}
                                required
                                min="1"
                                step="0.01"
                                placeholder="Enter amount"
                              />
                            </div>
                            {formData.amount && (
                              <small className="text-muted">
                                Amount: ₹{parseFloat(formData.amount || 0).toLocaleString('en-IN')}
                              </small>
                            )}
                          </div>

                          <div className="mt-3">
                            <label className="form-label fw-semibold">Reason for Advance *</label>
                            <textarea
                              className="form-control border-warning"
                              name="reason"
                              value={formData.reason}
                              onChange={handleChange}
                              required
                              rows="3"
                              placeholder="Enter reason for advance"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Deduction Settings */}
                    <div className="col-lg-6">
                      <div className="card border-info h-100">
                        <div className="card-header bg-info bg-opacity-10 border-info">
                          <h6 className="mb-0"><FaCalculator className="me-2" /> Automatic Deduction Calculation</h6>
                        </div>
                        <div className="card-body">
                          <div className="mb-4">
                            <label className="form-label fw-semibold">
                              <FaPercentage className="me-2" /> Monthly Deduction Percentage *
                            </label>
                            <p className="text-muted small mb-3">
                              Choose what percentage of the advance to deduct each month. The system will automatically calculate how many months are needed.
                            </p>
                            
                            {/* 🔥 CHANGED TO DROPDOWN SELECT BOX */}
                            <select
                              className="form-select border-info"
                              name="split_percentage"
                              value={formData.split_percentage}
                              onChange={handleChange}
                              required
                            >
                              <option value="">Select Deduction Percentage</option>
                              {percentageOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            
                            {formData.split_percentage && (
                              <div className="mt-2">
                                <small className="text-muted">
                                  Selected: {formData.split_percentage}% per month = {Math.ceil(100 / parseFloat(formData.split_percentage))} month{Math.ceil(100 / parseFloat(formData.split_percentage)) > 1 ? 's' : ''} total
                                </small>
                              </div>
                            )}
                          </div>

                          <div className="mb-3">
                            <label className="form-label fw-semibold">
                              <FaCalendarCheck className="me-2" /> Start Deduction From (Optional)
                            </label>
                            <input
                              type="month"
                              className="form-control border-info"
                              name="deduction_start"
                              value={formData.deduction_start}
                              onChange={handleChange}
                              min={new Date().toISOString().slice(0, 7)}
                            />
                            <small className="text-muted mt-1 d-block">
                              Leave empty to start from next month. Format: YYYY-MM
                            </small>
                          </div>

                          {/* CALCULATION SUMMARY */}
                          {formData.amount && formData.split_percentage && (
                            <div className="card border-success mt-4">
                              <div className="card-header bg-success bg-opacity-10 border-success">
                                <h6 className="mb-0">📊 Deduction Summary</h6>
                              </div>
                              <div className="card-body">
                                <div className="row text-center">
                                  <div className="col-md-4">
                                    <p className="mb-1 text-muted">Total Amount</p>
                                    <h4 className="text-primary">₹{parseFloat(formData.amount).toLocaleString('en-IN')}</h4>
                                  </div>
                                  <div className="col-md-4">
                                    <p className="mb-1 text-muted">Monthly Deduction</p>
                                    <h4 className="text-success">₹{getCalculationExample().monthlyDeduction}</h4>
                                  </div>
                                  <div className="col-md-4">
                                    <p className="mb-1 text-muted">Duration</p>
                                    <h4 className="text-warning">{getCalculationExample().exampleMonths} month{getCalculationExample().exampleMonths > 1 ? 's' : ''}</h4>
                                  </div>
                                </div>
                                <div className="mt-3">
                                  <p className="mb-0 text-muted small">
                                    <FaCalculator className="me-1" />
                                    <strong>Calculation:</strong> {getCalculationExample().calculation} for {getCalculationExample().totalMonthsText}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* DEDUCTION SCHEDULE PREVIEW */}
                    {formData.amount && formData.split_percentage && (
                      <div className="col-12">
                        <div className="card border-primary">
                          <div className="card-header bg-primary bg-opacity-10 border-primary">
                            <div className="d-flex justify-content-between align-items-center">
                              <h6 className="mb-0">📅 Deduction Schedule Preview</h6>
                              <div>
                                <span className="badge bg-primary me-2">
                                  {getCalculationExample().exampleMonths} month{getCalculationExample().exampleMonths > 1 ? 's' : ''}
                                </span>
                                <span className="badge bg-primary">
                                  Total: ₹{parseFloat(formData.amount).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="card-body">
                            <div className="alert alert-info">
                              <FaCalculator className="me-2" />
                              <strong>Automatic Calculation:</strong> {formData.split_percentage}% of ₹{formData.amount} = ₹{(parseFloat(formData.amount) * parseFloat(formData.split_percentage) / 100).toFixed(2)} per month
                            </div>
                            
                            <div className="table-responsive">
                              <table className="table table-bordered">
                                <thead className="table-light">
                                  <tr>
                                    <th>Month</th>
                                    <th>Salary Month</th>
                                    <th>Amount to Deduct</th>
                                    <th>Percentage</th>
                                    <th>Cumulative</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {calculateDeductionSchedule().map((deduction, index) => {
                                    const runningTotal = calculateDeductionSchedule()
                                      .slice(0, index + 1)
                                      .reduce((sum, item) => sum + parseFloat(item.amount), 0);
                                    
                                    return (
                                      <tr key={index}>
                                        <td className="fw-semibold">
                                          <span className="badge bg-primary">
                                            Month {index + 1}
                                          </span>
                                        </td>
                                        <td>
                                          <div>
                                            <strong>{deduction.month}</strong>
                                            <div className="text-muted small">{deduction.year}</div>
                                          </div>
                                        </td>
                                        <td>
                                          <div className="fw-bold fs-5 text-primary">
                                            ₹{deduction.amount}
                                          </div>
                                          {index === calculateDeductionSchedule().length - 1 && (
                                            <small className="text-warning">(Final balance)</small>
                                          )}
                                        </td>
                                        <td>
                                          <span className="badge bg-info bg-opacity-25 text-info">
                                            {deduction.percentage}%
                                          </span>
                                        </td>
                                        <td className="fw-semibold">
                                          ₹{runningTotal.toFixed(2)}
                                          <div className="progress mt-1" style={{ height: '5px' }}>
                                            <div 
                                              className="progress-bar bg-success" 
                                              style={{ 
                                                width: `${(runningTotal / parseFloat(formData.amount) * 100)}%` 
                                              }}
                                            ></div>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot className="table-warning">
                                  <tr>
                                    <td colSpan="4" className="text-end fw-bold">Total Advance Amount:</td>
                                    <td className="fw-bold fs-5 text-success">
                                      ₹{parseFloat(formData.amount).toFixed(2)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer bg-light rounded-bottom-4">
                  <button type="submit" className="btn btn-warning fw-semibold px-4 py-2">
                    <FaPlus className="me-2" /> Submit Advance
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-4 py-2"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewItem && (
        <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 shadow-lg border-0">
              <div className="modal-header bg-gradient-warning text-white rounded-top-4">
                <h5 className="fw-bold mb-0">
                  <FaEye className="me-2" /> Advance Details - {viewItem.name}
                </h5>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => setViewItem(null)}
                />
              </div>
              
              <div className="modal-body p-4">
                <div className="row g-4">
                  {/* Employee Details */}
                  <div className="col-md-6">
                    <div className="card border-warning h-100">
                      <div className="card-header bg-warning bg-opacity-10">
                        <h6 className="mb-0">Employee Information</h6>
                      </div>
                      <div className="card-body">
                        <table className="table table-borderless">
                          <tbody>
                            <tr>
                              <th width="40%" className="text-muted">Employee:</th>
                              <td><strong>{viewItem.name}</strong></td>
                            </tr>
                            <tr>
                              <th className="text-muted">Email:</th>
                              <td>{viewItem.email}</td>
                            </tr>
                            <tr>
                              <th className="text-muted">Department:</th>
                              <td>
                                <span className="badge bg-info">{viewItem.department}</span>
                              </td>
                            </tr>
                            <tr>
                              <th className="text-muted">Reason:</th>
                              <td>{viewItem.reason}</td>
                            </tr>
                            <tr>
                              <th className="text-muted">Date Given:</th>
                              <td>{viewItem.date} at {viewItem.time}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Advance Details */}
                  <div className="col-md-6">
                    <div className="card border-info h-100">
                      <div className="card-header bg-info bg-opacity-10">
                        <h6 className="mb-0">Advance Summary</h6>
                      </div>
                      <div className="card-body">
                        <table className="table table-borderless">
                          <tbody>
                            <tr>
                              <th width="50%" className="text-muted">Total Amount:</th>
                              <td className="fs-5 fw-bold text-primary">
                                ₹{parseFloat(viewItem.amount).toLocaleString('en-IN')}
                              </td>
                            </tr>
                            <tr>
                              <th className="text-muted">Status:</th>
                              <td>
                                <span className={`badge ${viewItem.status === 'active' ? 'bg-success' : viewItem.status === 'completed' ? 'bg-secondary' : 'bg-warning'}`}>
                                  {viewItem.status?.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <th className="text-muted">Remaining Amount:</th>
                              <td className="fw-bold text-success">
                                ₹{parseFloat(viewItem.amount_remaining || viewItem.amount).toLocaleString('en-IN')}
                              </td>
                            </tr>
                            <tr>
                              <th className="text-muted">Monthly Deduction:</th>
                              <td>
                                <div className="fw-semibold">
                                  ₹{parseFloat(viewItem.per_month_deduction || (viewItem.amount * (viewItem.split_percentage || 100) / 100)).toLocaleString('en-IN')}
                                </div>
                                <small className="text-muted">
                                  {viewItem.split_percentage || 100}% per month
                                </small>
                              </td>
                            </tr>
                            <tr>
                              <th className="text-muted">Progress:</th>
                              <td>
                                <div className="progress" style={{ height: '8px' }}>
                                  <div 
                                    className="progress-bar bg-success" 
                                    style={{ 
                                      width: `${((viewItem.deductions_completed || 0) / (viewItem.total_deduction_months || Math.ceil(100 / (viewItem.split_percentage || 100))) * 100)}%` 
                                    }}
                                  ></div>
                                </div>
                                <small className="text-muted mt-1 d-block">
                                  {viewItem.deductions_completed || 0} of {viewItem.total_deduction_months || Math.ceil(100 / (viewItem.split_percentage || 100))} months completed
                                </small>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Deduction Schedule */}
                  {viewItem.deduction_schedule && Array.isArray(viewItem.deduction_schedule) && (
                    <div className="col-12">
                      <div className="card border-primary">
                        <div className="card-header bg-primary bg-opacity-10">
                          <h6 className="mb-0">📅 Deduction Schedule</h6>
                        </div>
                        <div className="card-body">
                          <div className="table-responsive">
                            <table className="table table-bordered">
                              <thead className="table-light">
                                <tr>
                                  <th>#</th>
                                  <th>Month</th>
                                  <th>Year</th>
                                  <th>Amount (₹)</th>
                                  <th>Percentage</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {viewItem.deduction_schedule.map((deduction, index) => (
                                  <tr key={index}>
                                    <td className="fw-semibold">{index + 1}</td>
                                    <td>{deduction.month || deduction.date_string?.split('/')[0]}</td>
                                    <td>{deduction.year || deduction.date_string?.split('/')[1]}</td>
                                    <td className="fw-bold">₹{deduction.amount}</td>
                                    <td>
                                      <span className="badge bg-info bg-opacity-25">
                                        {deduction.percentage || ((deduction.amount / viewItem.amount * 100).toFixed(1))}%
                                      </span>
                                    </td>
                                    <td>
                                      <span className={`badge ${deduction.status === 'completed' ? 'bg-success' : 'bg-warning'}`}>
                                        {deduction.status?.toUpperCase() || 'PENDING'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer bg-light rounded-bottom-4">
                <button
                  className="btn btn-outline-warning"
                  onClick={() => setViewItem(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancePage;