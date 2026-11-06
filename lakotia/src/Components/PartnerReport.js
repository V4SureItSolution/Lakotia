import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  FaEdit, 
  FaTrash, 
  FaPlus, 
  FaEye, 
  FaFilePdf, 
  FaFileExcel, 
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaKey,
  FaLock
} from "react-icons/fa";
import { toast } from "react-toastify";
import { Table, Button, Modal, Form, Row, Col, InputGroup, Pagination, Alert } from "react-bootstrap";
import * as XLSX from "xlsx";

// ✅ FIXED IMPORTS
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { API_BASE } from "../config";

// Validation functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateMobile = (mobile) => {
  const mobileRegex = /^[6-9]\d{9}$/; // Indian mobile numbers starting with 6-9
  return mobileRegex.test(mobile);
};

const validateGST = (gst) => {
  if (!gst) return true; // Optional field
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst);
};

const validatePinCode = (pincode) => {
  if (!pincode) return true; // Optional field
  const pincodeRegex = /^[1-9][0-9]{5}$/;
  return pincodeRegex.test(pincode);
};

const validatePassword = (password) => {
  if (!password) return false;
  return password.length >= 6; // Minimum 6 characters
};

const CompanyPage = () => {
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [paginatedCompanies, setPaginatedCompanies] = useState([]);

  const [industryOptions, setIndustryOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);

  const [search, setSearch] = useState("");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const [step, setStep] = useState(1);
  
  // Validation errors state
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    companyName: "",
    companyAddress: "",
    pinCode: "",
    industrySegment: "",
    customerName: "",
    customerMobile: "",
    customerEmail: "",
    department: "",
    personalMobile: "",
    personalEmail: "",
    gstNumber: "",
    password: "", // ✅ Added password field
    confirmPassword: "" // ✅ Added confirm password
  });

  // Login form state
  const [loginData, setLoginData] = useState({
    email: "",
    password: ""
  });

  const [editId, setEditId] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [loggedInCompany, setLoggedInCompany] = useState(null);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    fetchCompanies();
    fetchIndustrySegments();
    fetchDepartments();
    // Check if company is already logged in from localStorage
    const savedCompany = localStorage.getItem("loggedInCompany");
    if (savedCompany) {
      setLoggedInCompany(JSON.parse(savedCompany));
    }
  }, []);

  useEffect(() => {
    handleSearch();
  }, [search, companies]);

  useEffect(() => {
    updatePagination();
  }, [filteredCompanies, currentPage]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/company`);
      const data = Array.isArray(res.data) ? res.data : [];
      setCompanies(data);
    } catch {
      toast.error("Failed to load companies");
    }
    setLoading(false);
  };

  const fetchIndustrySegments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/industrial_segmentation/all`);
      setIndustryOptions(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load Industry Segments");
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/department/all`);
      setDepartmentOptions(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load Departments");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const finalValue = (name === "customerMobile" || name === "personalMobile") ? value.replace(/\D/g, "").slice(0, 10) : value;
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    
    // Validate specific fields on change
    if (name === "customerEmail" || name === "personalEmail") {
      if (finalValue && !validateEmail(finalValue)) {
        setErrors((prev) => ({ ...prev, [name]: "Invalid email format" }));
      }
    }
    
    if (name === "customerMobile" || name === "personalMobile") {
      if (finalValue && !validateMobile(finalValue)) {
        setErrors((prev) => ({ ...prev, [name]: "Invalid mobile number (10 digits starting with 6-9)" }));
      }
    }
    
    if (name === "gstNumber") {
      if (value && !validateGST(value)) {
        setErrors((prev) => ({ ...prev, [name]: "Invalid GST format (e.g., 27ABCDE1234F1Z5)" }));
      }
    }
    
    if (name === "pinCode") {
      if (value && !validatePinCode(value)) {
        setErrors((prev) => ({ ...prev, [name]: "Invalid PIN code (6 digits)" }));
      }
    }

    // ✅ Validate password
    if (name === "password") {
      if (value && !validatePassword(value)) {
        setErrors((prev) => ({ ...prev, [name]: "Password must be at least 6 characters" }));
      }
    }

    // ✅ Validate confirm password
    if (name === "confirmPassword") {
      if (value !== formData.password) {
        setErrors((prev) => ({ ...prev, [name]: "Passwords do not match" }));
      } else if (errors.confirmPassword) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    }
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const nextStep = () => {
    // Validate step 1 fields before proceeding
    if (step === 1) {
      const step1Errors = {};
      
      if (!formData.companyName.trim()) {
        step1Errors.companyName = "Company name is required";
      }
      
      if (!formData.companyAddress.trim()) {
        step1Errors.companyAddress = "Company address is required";
      }
      
      if (formData.gstNumber && !validateGST(formData.gstNumber)) {
        step1Errors.gstNumber = "Invalid GST format";
      }
      
      if (formData.pinCode && !validatePinCode(formData.pinCode)) {
        step1Errors.pinCode = "Invalid PIN code";
      }
      
      if (Object.keys(step1Errors).length > 0) {
        setErrors(step1Errors);
        return;
      }
    }
    
    setStep((s) => Math.min(3, s + 1)); // Changed to 3 steps
  };
  
  const prevStep = () => setStep((s) => Math.max(1, s - 1));

  const handleSearch = () => {
    const value = search.toLowerCase().trim();
    
    if (!value) {
      setFilteredCompanies(companies);
      setCurrentPage(1);
      return;
    }

    const filtered = companies.filter((c) => {
      return (
        (c.companyName && c.companyName.toLowerCase().includes(value)) ||
        (c.customerName && c.customerName.toLowerCase().includes(value)) ||
        (c.industrySegment && c.industrySegment.toLowerCase().includes(value)) ||
        (c.pinCode && c.pinCode.toString().includes(value)) ||
        (c.companyAddress && c.companyAddress.toLowerCase().includes(value)) ||
        (c.customerMobile && c.customerMobile.includes(value)) ||
        (c.customerEmail && c.customerEmail.toLowerCase().includes(value)) ||
        (c.department && c.department.toLowerCase().includes(value)) ||
        (c.personalMobile && c.personalMobile.includes(value)) ||
        (c.personalEmail && c.personalEmail.toLowerCase().includes(value)) ||
        (c.gstNumber && c.gstNumber.toLowerCase().includes(value))
      );
    });
    
    setFilteredCompanies(filtered);
    setCurrentPage(1);
  };

  const updatePagination = () => {
    const total = filteredCompanies.length;
    const pages = Math.ceil(total / itemsPerPage);
    setTotalPages(pages || 1);
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filteredCompanies.slice(startIndex, endIndex);
    setPaginatedCompanies(paginatedData);
  };

  const resetForm = () => {
    setFormData({
      companyName: "",
      companyAddress: "",
      pinCode: "",
      industrySegment: "",
      customerName: "",
      customerMobile: "",
      customerEmail: "",
      department: "",
      personalMobile: "",
      personalEmail: "",
      gstNumber: "",
      password: "",
      confirmPassword: ""
    });
    setEditId(null);
    setStep(1);
    setErrors({});
    setFormOpen(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const checkDuplicates = () => {
    const duplicates = {};
    
    // Check duplicate customer mobile
    if (formData.customerMobile) {
      const duplicateMobile = companies.find(company => 
        company.customerMobile === formData.customerMobile && 
        company.id !== editId
      );
      if (duplicateMobile) {
        duplicates.customerMobile = "Mobile number already exists for another company";
      }
    }
    
    // Check duplicate customer email
    if (formData.customerEmail) {
      const duplicateEmail = companies.find(company => 
        company.customerEmail === formData.customerEmail && 
        company.id !== editId
      );
      if (duplicateEmail) {
        duplicates.customerEmail = "Email already exists for another company";
      }
    }
    
    // Check duplicate personal mobile
    if (formData.personalMobile) {
      const duplicatePersonalMobile = companies.find(company => 
        company.personalMobile === formData.personalMobile && 
        company.id !== editId
      );
      if (duplicatePersonalMobile) {
        duplicates.personalMobile = "Personal mobile already exists for another company";
      }
    }
    
    // Check duplicate personal email
    if (formData.personalEmail) {
      const duplicatePersonalEmail = companies.find(company => 
        company.personalEmail === formData.personalEmail && 
        company.id !== editId
      );
      if (duplicatePersonalEmail) {
        duplicates.personalEmail = "Personal email already exists for another company";
      }
    }
    
    // Check duplicate GST number
    if (formData.gstNumber) {
      const duplicateGST = companies.find(company => 
        company.gstNumber === formData.gstNumber && 
        company.id !== editId
      );
      if (duplicateGST) {
        duplicates.gstNumber = "GST number already exists for another company";
      }
    }
    
    return duplicates;
  };

  const validateAllFields = () => {
    const newErrors = {};
    
    // Required fields
    if (!formData.companyName.trim()) {
      newErrors.companyName = "Company name is required";
    }
    
    if (!formData.companyAddress.trim()) {
      newErrors.companyAddress = "Company address is required";
    }
    
    // Email validations
    if (formData.customerEmail && !validateEmail(formData.customerEmail)) {
      newErrors.customerEmail = "Invalid email format";
    }
    
    if (formData.personalEmail && !validateEmail(formData.personalEmail)) {
      newErrors.personalEmail = "Invalid email format";
    }
    
    // Mobile validations
    if (formData.customerMobile && !validateMobile(formData.customerMobile)) {
      newErrors.customerMobile = "Invalid mobile number (10 digits starting with 6-9)";
    }
    
    if (formData.personalMobile && !validateMobile(formData.personalMobile)) {
      newErrors.personalMobile = "Invalid mobile number (10 digits starting with 6-9)";
    }
    
    // GST validation
    if (formData.gstNumber && !validateGST(formData.gstNumber)) {
      newErrors.gstNumber = "Invalid GST format (e.g., 27ABCDE1234F1Z5)";
    }
    
    // PIN code validation
    if (formData.pinCode && !validatePinCode(formData.pinCode)) {
      newErrors.pinCode = "Invalid PIN code (6 digits)";
    }

    // ✅ Password validation (only for new company, not for edit unless changing)
    if (!editId) {
      if (!validatePassword(formData.password)) {
        newErrors.password = "Password must be at least 6 characters";
      }
      
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    } else if (formData.password && !validatePassword(formData.password)) {
      // If editing and password is provided, validate it
      newErrors.password = "Password must be at least 6 characters";
    }
    
    // Check for duplicates
    const duplicateErrors = checkDuplicates();
    Object.assign(newErrors, duplicateErrors);
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all fields
    const validationErrors = validateAllFields();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fix the errors in the form");
      return;
    }

    try {
      const submitData = { ...formData };
      
      // Remove confirmPassword before sending to API
      delete submitData.confirmPassword;
      
      // If editing and password is empty, remove it (keep existing)
      if (editId && !submitData.password) {
        delete submitData.password;
      }

      if (editId) {
        await axios.put(`${API_BASE}/company/${editId}`, submitData);
        toast.success("Company updated successfully");
      } else {
        await axios.post(`${API_BASE}/company`, submitData);
        toast.success("Company added successfully");
      }
      fetchCompanies();
      resetForm();
    } catch (err) {
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error("Failed to save company");
      }
    }
  };

  // ✅ LOGIN FUNCTION
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!loginData.email || !loginData.password) {
      toast.error("Please enter both email and password");
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/company/login`, loginData);
      
      if (res.data.success) {
        const companyData = res.data.company;
        setLoggedInCompany(companyData);
        localStorage.setItem("loggedInCompany", JSON.stringify(companyData));
        toast.success(res.data.message);
        setLoginOpen(false);
        setLoginData({ email: "", password: "" });
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    }
  };

  // ✅ LOGOUT FUNCTION
  const handleLogout = () => {
    setLoggedInCompany(null);
    localStorage.removeItem("loggedInCompany");
    toast.success("Logged out successfully");
  };

  const handleEdit = (comp) => {
    setFormData({ 
      ...comp,
      password: "", // Clear password for security
      confirmPassword: "" 
    });
    setEditId(comp.id);
    setStep(1);
    setErrors({});
    setFormOpen(true);
  };

  const handleDelete = async (comp) => {
    if (!window.confirm("Are you sure you want to delete this company?")) return;

    try {
      await axios.delete(`${API_BASE}/company/${comp.id}`);
      toast.success("Company deleted successfully");
      fetchCompanies();
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleView = async (comp) => {
    try {
      const res = await axios.get(`${API_BASE}/company/${comp.id}`);
      setViewData(res.data);
      setViewOpen(true);
    } catch {
      toast.error("Failed to fetch details");
    }
  };

  // Handle Enter key press for search
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearch("");
  };

  // Pagination handlers
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Previous button
    items.push(
      <Pagination.Prev 
        key="prev" 
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
      />
    );

    // First page
    if (startPage > 1) {
      items.push(
        <Pagination.Item key={1} onClick={() => goToPage(1)}>
          1
        </Pagination.Item>
      );
      if (startPage > 2) {
        items.push(<Pagination.Ellipsis key="ellipsis1" />);
      }
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <Pagination.Item 
          key={i} 
          active={i === currentPage}
          onClick={() => goToPage(i)}
        >
          {i}
        </Pagination.Item>
      );
    }

    // Last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<Pagination.Ellipsis key="ellipsis2" />);
      }
      items.push(
        <Pagination.Item 
          key={totalPages} 
          onClick={() => goToPage(totalPages)}
        >
          {totalPages}
        </Pagination.Item>
      );
    }

    // Next button
    items.push(
      <Pagination.Next 
        key="next" 
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
      />
    );

    return items;
  };

  // ---------------------- EXPORTS --------------------------

  const exportExcel = () => {
    if (filteredCompanies.length === 0) {
      toast.warning("No data to export");
      return;
    }
    
    const ws = XLSX.utils.json_to_sheet(filteredCompanies);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Companies");
    XLSX.writeFile(wb, "companies.xlsx");
  };

  const exportPDF = () => {
    if (filteredCompanies.length === 0) {
      toast.warning("No data to export");
      return;
    }
    
    const doc = new jsPDF();

    doc.text("Company List", 14, 15);

    const tableColumn = ["Company Name", "GST Number", "Industry", "Customer", "Mobile", "Department", "Pin Code", "Address"];

    const tableRows = filteredCompanies.map((c) => [
      c.companyName || "",
      c.gstNumber || "",
      c.industrySegment || "",
      c.customerName || "",
      c.customerMobile || "",
      c.department || "",
      c.pinCode || "",
      c.companyAddress ? c.companyAddress.substring(0, 25) + "..." : "",
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 25,
      headStyles: {
        fillColor: [255, 243, 205],
        textColor: [0, 0, 0],
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 30 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
        4: { cellWidth: 18 },
        5: { cellWidth: 22 },
        6: { cellWidth: 15 },
        7: { cellWidth: 35 },
      },
    });

    doc.save("companies.pdf");
  };

  return (
    <div className="container mt-4">
      {/* Login/Logout Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold">Partner Management</h3>
        
        <div className="d-flex gap-2">
        </div>
      </div>

      <Row className="mb-3">
        <Col md={8}>
          <InputGroup>
            <InputGroup.Text style={{ background: "#fff3cd", borderColor: "#ffc107" }}>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              placeholder="Search by company, customer, GST, mobile, email, etc."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={handleKeyPress}
              style={{ borderColor: "#ffc107" }}
            />
            {search && (
              <Button 
                variant="outline-secondary" 
                onClick={handleClearSearch}
                title="Clear search"
              >
                ✕
              </Button>
            )}
            <Button 
              variant="warning" 
              onClick={handleSearch}
              style={{ borderColor: "#ffc107" }}
            >
              Search
            </Button>
          </InputGroup>
        </Col>

        <Col md="auto" className="mt-2 mt-md-0">
          <Button variant="success" className="me-2" onClick={exportExcel} disabled={filteredCompanies.length === 0}>
            <FaFileExcel className="me-1" /> Excel
          </Button>

          <Button variant="danger" onClick={exportPDF} disabled={filteredCompanies.length === 0}>
            <FaFilePdf className="me-1" /> PDF
          </Button>
        </Col>
      </Row>

      {/* Search Results Info */}
      {search && (
        <div className="alert alert-warning py-2 mb-3" role="alert">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <FaSearch className="me-2" />
              Found <strong>{filteredCompanies.length}</strong> companies matching "<strong>{search}</strong>"
              {filteredCompanies.length === 0 && " - Try a different search term"}
            </div>
            {filteredCompanies.length > 0 && (
              <Button 
                variant="outline-warning" 
                size="sm" 
                onClick={handleClearSearch}
              >
                Clear Search
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="table-responsive">
        <Table bordered hover striped>
          <thead style={{ background: "#fff3cd" }}>
            <tr className="text-center">
              <th>Partner Name</th>
              <th>GST Number</th>
              <th>Industry</th>
              <th>Customer Name</th>
              <th>Mobile</th>
              <th>Department</th>
              <th>Pin Code</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center">
                  <div className="spinner-border text-warning" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedCompanies.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center text-muted py-4">
                  {search ? "No companies match your search criteria" : "No companies found"}
                </td>
              </tr>
            ) : (
              paginatedCompanies.map((c) => (
                <tr key={c.id} className="text-center">
                  <td>
                    <div className="fw-semibold">{c.companyName}</div>
                    <small className="text-muted">{c.companyAddress ? c.companyAddress.substring(0, 40) + "..." : ""}</small>
                  </td>
                  <td>
                    <span className="badge bg-info text-dark">{c.gstNumber || "N/A"}</span>
                  </td>
                  <td>{c.industrySegment}</td>
                  <td>
                    <div>{c.customerName}</div>
                    <small className="text-muted">{c.customerEmail}</small>
                  </td>
                  <td>{c.customerMobile}</td>
                  <td>{c.department}</td>
                  <td>
                    <span className="badge bg-light text-dark">{c.pinCode}</span>
                  </td>
                  <td>
                    <div className="d-flex justify-content-center">
                      <Button size="sm" variant="outline-info" className="me-2" onClick={() => handleView(c)} title="View Details">
                        <FaEye />
                      </Button>

                      <Button size="sm" variant="outline-warning" className="me-2" onClick={() => handleEdit(c)} title="Edit">
                        <FaEdit />
                      </Button>

                      <Button size="sm" variant="outline-danger" onClick={() => handleDelete(c)} title="Delete">
                        <FaTrash />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* Pagination */}
      {filteredCompanies.length > 0 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <div className="text-muted">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredCompanies.length)} of {filteredCompanies.length} entries
            {search && " (filtered)"}
          </div>
          <Pagination className="mb-0">
            {renderPaginationItems()}
          </Pagination>
        </div>
      )}

      {/* ADD/EDIT COMPANY MODAL */}
      <Modal show={formOpen} onHide={() => setFormOpen(false)} centered size="lg">
        <Modal.Header closeButton style={{ background: "#fff3cd" }}>
          <Modal.Title>{editId ? "Edit Company" : "Add Company"} — Step {step} of 3</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {step === 1 && (
            <>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Company Name <span className="text-danger">*</span></Form.Label>
                    <Form.Control 
                      name="companyName" 
                      value={formData.companyName} 
                      onChange={handleChange} 
                      required 
                      placeholder="Enter company name"
                      isInvalid={!!errors.companyName}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.companyName}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">GST Number</Form.Label>
                    <Form.Control 
                      name="gstNumber"
                      value={formData.gstNumber} 
                      onChange={handleChange} 
                      placeholder="Enter GST number (e.g., 27ABCDE1234F1Z5)"
                      isInvalid={!!errors.gstNumber}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.gstNumber}
                    </Form.Control.Feedback>
                    <Form.Text className="text-muted">
                      Format: 2-digit state code + 10-digit PAN + 1-digit entity + 1-digit checksum
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Pin Code</Form.Label>
                    <Form.Control 
                      name="pinCode" 
                      value={formData.pinCode} 
                      onChange={handleChange} 
                      placeholder="Enter 6-digit pin code"
                      isInvalid={!!errors.pinCode}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.pinCode}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Industry Segment</Form.Label>
                    <Form.Select name="industrySegment" value={formData.industrySegment} onChange={handleChange}>
                      <option value="">Select Industry Segment</option>
                      {industryOptions.map((i) => (
                        <option key={i.id} value={i.name}>
                          {i.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Company Address <span className="text-danger">*</span></Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={3}
                  name="companyAddress" 
                  value={formData.companyAddress} 
                  onChange={handleChange} 
                  required 
                  placeholder="Enter full address"
                  isInvalid={!!errors.companyAddress}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.companyAddress}
                </Form.Control.Feedback>
              </Form.Group>

              <div className="d-flex justify-content-end">
                <Button className="px-4" variant="warning" onClick={nextStep}>
                  Next <FaChevronRight className="ms-1" />
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h6 className="mb-3 fw-semibold">Customer Details</h6>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Customer Name</Form.Label>
                    <Form.Control 
                      name="customerName" 
                      value={formData.customerName} 
                      onChange={handleChange} 
                      placeholder="Enter customer name"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Customer Mobile</Form.Label>
                    <Form.Control 
                      name="customerMobile" 
                      value={formData.customerMobile} 
                      onChange={handleChange} 
                      placeholder="Enter 10-digit mobile number"
                      maxLength="10"
                      isInvalid={!!errors.customerMobile}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.customerMobile}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Customer Email</Form.Label>
                <Form.Control 
                  type="email"
                  name="customerEmail" 
                  value={formData.customerEmail} 
                  onChange={handleChange} 
                  placeholder="Enter email address"
                  isInvalid={!!errors.customerEmail}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.customerEmail}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">Department</Form.Label>
                <Form.Select name="department" value={formData.department} onChange={handleChange}>
                  <option value="">Select Department</option>
                  {departmentOptions.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <h6 className="mb-3 fw-semibold mt-4">Personal Details</h6>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Personal Mobile</Form.Label>
                    <Form.Control 
                      name="personalMobile" 
                      value={formData.personalMobile} 
                      onChange={handleChange} 
                      placeholder="Enter 10-digit mobile number"
                      maxLength="10"
                      isInvalid={!!errors.personalMobile}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.personalMobile}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Personal Email</Form.Label>
                    <Form.Control 
                      type="email"
                      name="personalEmail" 
                      value={formData.personalEmail} 
                      onChange={handleChange} 
                      placeholder="Enter email address"
                      isInvalid={!!errors.personalEmail}
                    />
                    <Form.Control.Feedback type="invalid">
                      {errors.personalEmail}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-flex justify-content-between mt-4">
                <Button variant="outline-secondary" onClick={prevStep}>
                  <FaChevronLeft className="me-1" /> Previous
                </Button>

                <Button className="px-4" variant="warning" onClick={nextStep}>
                  Next <FaChevronRight className="ms-1" />
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h6 className="mb-3 fw-semibold">Account Credentials</h6>
              
              {editId && (
                <Alert variant="info" className="mb-3">
                  <FaKey className="me-2" />
                  Leave password fields empty to keep current password
                </Alert>
              )}

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">
                  Password {!editId && <span className="text-danger">*</span>}
                  <small className="text-muted ms-2">(Min. 6 characters)</small>
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={editId ? "Enter new password (optional)" : "Enter password"}
                    isInvalid={!!errors.password}
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Button>
                  <Form.Control.Feedback type="invalid">
                    {errors.password}
                  </Form.Control.Feedback>
                </InputGroup>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold">
                  Confirm Password {!editId && <span className="text-danger">*</span>}
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm password"
                    isInvalid={!!errors.confirmPassword}
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </Button>
                  <Form.Control.Feedback type="invalid">
                    {errors.confirmPassword}
                  </Form.Control.Feedback>
                </InputGroup>
              </Form.Group>

              <div className="d-flex justify-content-between mt-4">
                <Button variant="outline-secondary" onClick={prevStep}>
                  <FaChevronLeft className="me-1" /> Previous
                </Button>

                <div>
                  <Button variant="outline-secondary" className="me-2" onClick={() => setFormOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="warning" onClick={handleSubmit}>
                    {editId ? "Update Company" : "Add Company"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* LOGIN MODAL */}
      <Modal show={loginOpen} onHide={() => setLoginOpen(false)} centered>
        <Modal.Header closeButton style={{ background: "#d1ecf1" }}>
          <Modal.Title><FaKey className="me-2" /> Company Login</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleLogin}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Email Address <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={loginData.email}
                onChange={handleLoginChange}
                placeholder="Enter registered email"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Password <span className="text-danger">*</span></Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  placeholder="Enter password"
                  required
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </Button>
              </InputGroup>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setLoginOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              <FaKey className="me-2" /> Login
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* VIEW MODAL */}
      <Modal show={viewOpen} onHide={() => setViewOpen(false)} centered size="lg">
        <Modal.Header closeButton style={{ background: "#fff3cd" }}>
          <Modal.Title>Company Details</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {viewData && (
            <Row>
              <Col md={6}>
                <div className="mb-3">
                  <h6 className="fw-semibold text-warning">Company Information</h6>
                  <p><strong>Company Name:</strong> {viewData.companyName || "N/A"}</p>
                  <p><strong>GST Number:</strong> {viewData.gstNumber || "N/A"}</p>
                  <p><strong>Address:</strong> {viewData.companyAddress || "N/A"}</p>
                  <p><strong>Pin Code:</strong> {viewData.pinCode || "N/A"}</p>
                  <p><strong>Industry Segment:</strong> {viewData.industrySegment || "N/A"}</p>
                </div>
              </Col>
              <Col md={6}>
                <div className="mb-3">
                  <h6 className="fw-semibold text-warning">Customer Information</h6>
                  <p><strong>Customer Name:</strong> {viewData.customerName || "N/A"}</p>
                  <p><strong>Mobile:</strong> {viewData.customerMobile || "N/A"}</p>
                  <p><strong>Email:</strong> {viewData.customerEmail || "N/A"}</p>
                  <p><strong>Department:</strong> {viewData.department || "N/A"}</p>
                </div>
              </Col>
              <Col md={12}>
                <div className="mb-3">
                  <h6 className="fw-semibold text-warning">Personal Information</h6>
                  <p><strong>Personal Mobile:</strong> {viewData.personalMobile || "N/A"}</p>
                  <p><strong>Personal Email:</strong> {viewData.personalEmail || "N/A"}</p>
                </div>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setViewOpen(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      
    </div>
  );
};

export default CompanyPage;