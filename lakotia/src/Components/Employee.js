import React, { useState, useEffect } from "react";
import { FaEdit, FaTrash, FaPlus, FaTimes, FaEye, FaPaperclip, FaDownload, FaSearch, FaFileExcel, FaFilePdf, FaEyeSlash, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE, FILE_BASE } from "../config";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const EmployeePage = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [editId, setEditId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loggedUser, setLoggedUser] = useState("");
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [userTypes, setUserTypes] = useState([]);
  
  // State for showing/hiding passwords
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showViewPassword, setShowViewPassword] = useState(false);

  // Validation errors state
  const [errors, setErrors] = useState({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const API_URL = `${API_BASE}/employee`;

  // ESI/PF Status Options (Matches Backend)
  const esiPfOptions = [
    { value: "ESI/PF", label: "ESI/PF" },
    { value: "No ESI/PF", label: "No ESI/PF" },
    { value: "Casual Labour", label: "Casual Labour" }
  ];

  // Validation functions
  const validateEmail = (email) => {
    if (!email) return true; // Optional during editing
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateMobile = (mobile) => {
    if (!mobile) return true;
    const mobileRegex = /^[6-9]\d{9}$/;
    return mobileRegex.test(mobile);
  };

  const validateAadhar = (aadhar) => {
    if (!aadhar) return true;
    const aadharRegex = /^\d{12}$/;
    return aadharRegex.test(aadhar);
  };

  const validatePAN = (pan) => {
    if (!pan) return true;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  };

  const validatePassword = (password) => {
    if (!password) return true; // Optional during edit
    if (password.length < 6) return false;
    return true;
  };

  const validateDate = (date) => {
    if (!date) return true;
    const selectedDate = new Date(date);
    const today = new Date();
    return selectedDate <= today;
  };

  const validateDOJvsDOB = (dob, doj) => {
    if (!dob || !doj) return true;
    const dobDate = new Date(dob);
    const dojDate = new Date(doj);
    return dojDate >= dobDate;
  };

  // ✅ Load user details from localStorage
  useEffect(() => {
    const username = localStorage.getItem("username");
    const email = localStorage.getItem("email");
    const id = localStorage.getItem("user_id");

    const userDisplayName = username || email || "User";
    setLoggedUser(userDisplayName);

    // Fetch Departments
    fetch(`${API_BASE}/department/all`)
      .then((res) => res.json())
      .then((data) => setDepartments(data))
      .catch(() => toast.error("Error fetching departments"));

    // Fetch Designations
    fetch(`${API_BASE}/designations`)
      .then((res) => res.json())
      .then((data) => setDesignations(data))
      .catch(() => toast.error("Error fetching designations"));

    // Fetch User Types
    fetch(`${API_BASE}/usertype`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUserTypes(data.data);
      })
      .catch(() => toast.error("Error fetching user types"));

    // Fetch Employees
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter employees based on search term
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredEmployees(employees);
    } else {
      const filtered = employees.filter(emp => 
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.mobile?.includes(searchTerm) ||
        emp.esiPfStatus?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.pan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.aadhar?.includes(searchTerm)
      );
      setFilteredEmployees(filtered);
    }
    setCurrentPage(1); // Reset to first page when searching
  }, [searchTerm, employees]);

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEmployees = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  // Pagination functions
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const [formData, setFormData] = useState({
    photo: null,
    photoPreview: null,
    name: "",
    dob: "",
    gender: "",
    email: "",
    address: "",
    department: "",
    designation: "",
    doj: "",
    userType: "",
    mobile: "",
    altContact: "",
    pan: "",
    aadhar: "",
    panAttachment: null,
    aadharAttachment: null,
    password: "",
    confirmPassword: "",
    esiPfStatus: "",
  });

  // Handle input with validation
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;
    if (name === "mobile" || name === "altContact") {
      newValue = (newValue || "").replace(/\D/g, "").slice(0, 10);
    }
    
    setFormData({ 
      ...formData, 
      [name]: newValue 
    });
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
    
    // Real-time validation
    let error = "";
    
    if (name === "email" && newValue && !validateEmail(newValue)) {
      error = "Invalid email format";
    } else if ((name === "mobile" || name === "altContact") && newValue && !validateMobile(newValue)) {
      error = "Invalid mobile number (10 digits starting with 6-9)";
    } else if (name === "aadhar" && newValue && !validateAadhar(newValue)) {
      error = "Invalid Aadhar number (12 digits)";
    } else if (name === "pan" && newValue && !validatePAN(newValue)) {
      error = "Invalid PAN format (e.g., ABCDE1234F)";
    } else if (name === "password" && newValue && !validatePassword(newValue)) {
      error = "Password must be at least 6 characters";
    } else if ((name === "dob" || name === "doj") && newValue && !validateDate(newValue)) {
      error = "Date cannot be in the future";
    }
    
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        toast.error("Please upload a valid image (JPEG, PNG, GIF)");
        return;
      }
      
      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size should be less than 2MB");
        return;
      }
      
      setFormData({
        ...formData,
        photo: file,
        photoPreview: URL.createObjectURL(file),
      });
    }
  };

  const handlePanAttachmentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type and size
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        toast.error("Please upload PDF or image files only");
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size should be less than 5MB");
        return;
      }
      
      setFormData({
        ...formData,
        panAttachment: file,
      });
    }
  };

  const handleAadharAttachmentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type and size
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        toast.error("Please upload PDF or image files only");
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size should be less than 5MB");
        return;
      }
      
      setFormData({
        ...formData,
        aadharAttachment: file,
      });
    }
  };

  const validateStep = (stepNumber) => {
    const newErrors = {};
    
    if (stepNumber === 1) {
      if (!formData.name.trim()) {
        newErrors.name = "Full name is required";
      }
      if (!formData.dob) {
        newErrors.dob = "Date of birth is required";
      } else if (!validateDate(formData.dob)) {
        newErrors.dob = "Date of birth cannot be in the future";
      }
      if (!formData.gender) {
        newErrors.gender = "Gender is required";
      }
    } else if (stepNumber === 2) {
      if (!formData.email) {
        newErrors.email = "Email is required";
      } else if (!validateEmail(formData.email)) {
        newErrors.email = "Invalid email format";
      }
      
      if (!formData.mobile) {
        newErrors.mobile = "Mobile number is required";
      } else if (!validateMobile(formData.mobile)) {
        newErrors.mobile = "Invalid mobile number (10 digits starting with 6-9)";
      }
      
      if (formData.altContact && !validateMobile(formData.altContact)) {
        newErrors.altContact = "Invalid alternate contact number";
      }
      
      if (!formData.address) {
        newErrors.address = "Address is required";
      }
      
      if (!editId && !formData.password) {
        newErrors.password = "Password is required for new employees";
      } else if (formData.password && !validatePassword(formData.password)) {
        newErrors.password = "Password must be at least 6 characters";
      }
      
      if (!editId && formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      } else if (editId && formData.password && formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    } else if (stepNumber === 3) {
      if (formData.aadhar && !validateAadhar(formData.aadhar)) {
        newErrors.aadhar = "Invalid Aadhar number (12 digits)";
      }
      if (formData.pan && !validatePAN(formData.pan)) {
        newErrors.pan = "Invalid PAN format (e.g., ABCDE1234F)";
      }
      if (formData.dob && formData.doj && !validateDOJvsDOB(formData.dob, formData.doj)) {
        newErrors.doj = "Date of joining cannot be before date of birth";
      }
    }
    
    return newErrors;
  };

  const nextStep = () => {
    const stepErrors = validateStep(step);
    
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      toast.error("Please fix the errors before proceeding");
      return;
    }
    
    // Check duplicates before proceeding to step 2
    if (step === 1 && formData.email) {
      const duplicateErrors = checkDuplicates();
      if (Object.keys(duplicateErrors).length > 0) {
        setErrors(prev => ({ ...prev, ...duplicateErrors }));
        toast.error("Duplicate information found");
        return;
      }
    }
    
    setStep((s) => Math.min(s + 1, 3));
  };
  
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  // Check for duplicates (email, mobile, PAN, Aadhar)
  const checkDuplicates = () => {
    const duplicateErrors = {};
    
    // Check duplicate email
    if (formData.email) {
      const duplicateEmail = employees.find(emp => 
        emp.email.toLowerCase() === formData.email.toLowerCase() && 
        emp.id !== editId
      );
      if (duplicateEmail) {
        duplicateErrors.email = `Email already exists for employee: ${duplicateEmail.name}`;
      }
    }
    
    // Check duplicate mobile
    if (formData.mobile) {
      const duplicateMobile = employees.find(emp => 
        emp.mobile === formData.mobile && 
        emp.id !== editId
      );
      if (duplicateMobile) {
        duplicateErrors.mobile = `Mobile number already exists for employee: ${duplicateMobile.name}`;
      }
    }
    
    // Check duplicate alternate mobile
    if (formData.altContact) {
      const duplicateAltContact = employees.find(emp => 
        (emp.mobile === formData.altContact || emp.altContact === formData.altContact) && 
        emp.id !== editId
      );
      if (duplicateAltContact) {
        duplicateErrors.altContact = `Alternate contact already exists for employee: ${duplicateAltContact.name}`;
      }
    }
    
    // Check duplicate PAN
    if (formData.pan) {
      const duplicatePAN = employees.find(emp => 
        emp.pan && emp.pan.toUpperCase() === formData.pan.toUpperCase() && 
        emp.id !== editId
      );
      if (duplicatePAN) {
        duplicateErrors.pan = `PAN already exists for employee: ${duplicatePAN.name}`;
      }
    }
    
    // Check duplicate Aadhar
    if (formData.aadhar) {
      const duplicateAadhar = employees.find(emp => 
        emp.aadhar === formData.aadhar && 
        emp.id !== editId
      );
      if (duplicateAadhar) {
        duplicateErrors.aadhar = `Aadhar number already exists for employee: ${duplicateAadhar.name}`;
      }
    }
    
    return duplicateErrors;
  };

  // Submit Form to Backend (handles both add and update)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all steps
    const step1Errors = validateStep(1);
    const step2Errors = validateStep(2);
    const step3Errors = validateStep(3);
    const allErrors = { ...step1Errors, ...step2Errors, ...step3Errors };
    
    // Check for duplicates
    const duplicateErrors = checkDuplicates();
    Object.assign(allErrors, duplicateErrors);
    
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      toast.error("Please fix all errors before submitting");
      return;
    }

    // Validate password match
    if (!editId && formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    if (editId && formData.password && formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }

    const fd = new FormData();
    for (const key in formData) {
      if (formData[key] !== null && key !== "photoPreview" && key !== "confirmPassword") {
        // Only append fields that backend expects
        if (key === "password" && editId && !formData.password) {
          // If editing and password is empty, skip sending it
          continue;
        }
        fd.append(key, formData[key]);
      }
    }
    
    fd.append("createdBy", loggedUser);

    try {
      if (editId) {
        // Update existing
        const res = await fetch(`${API_URL}/update/${editId}`, {
          method: "PUT",
          body: fd,
        });
        const data = await res.json();
        if (data.success) {
          toast.success("Employee updated successfully!");
          fetchEmployees();
          resetForm();
        } else {
          toast.error(data.message || "Update failed");
        }
      } else {
        // Add new
        const response = await fetch(`${API_URL}/add`, {
          method: "POST",
          body: fd,
        });
        const data = await response.json();
        if (data.success) {
          toast.success("Employee added successfully!");
          fetchEmployees(); // Refresh list
          resetForm();
        } else {
          toast.error(data.message || "Failed to add employee");
        }
      }
    } catch (err) {
      toast.error("Error connecting to server");
    }
  };

  // Fetch all employees
  const fetchEmployees = async () => {
    try {
      const res = await fetch(API_URL + "/all");
      const data = await res.json();
      setEmployees(data);
      setFilteredEmployees(data);
    } catch {
      toast.error("Error loading employees");
    }
  };

  // Delete employee
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;

    try {
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        toast.success("Employee deleted successfully!");
        fetchEmployees();
      } else {
        toast.error(data.message || "Delete failed");
      }
    } catch {
      toast.error("Error deleting employee");
    }
  };

  // View employee (open card)
  const handleView = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      
      setSelectedEmployee(data);
      setViewOpen(true);
    } catch {
      toast.error("Error fetching employee details");
    }
  };

  // Edit employee - fetch data and populate form
  const handleEdit = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      // populate form fields
      setFormData({
        photo: null,
        photoPreview: data.photo
          ? `${FILE_BASE}/api/employee/uploads/${data.photo}`
          : null,
        name: data.name || "",
        dob: data.dob || "",
        gender: data.gender || "",
        email: data.email || "",
        address: data.address || "",
        department: data.department || "",
        designation: data.designation || "",
        doj: data.doj || "",
        userType: data.userType || "",
        mobile: data.mobile || "",
        altContact: data.altContact || "",
        pan: data.pan || "",
        aadhar: data.aadhar || "",
        panAttachment: null,
        aadharAttachment: null,
        password: "", // Don't pre-fill password for security
        confirmPassword: "", // Don't pre-fill confirm password
        esiPfStatus: data.esiPfStatus || "",
      });
      setEditId(id);
      setStep(1);
      setErrors({});
      setFormOpen(true);
    } catch {
      toast.error("Error loading employee for edit");
    }
  };

  // View attachment in new tab
  const handleViewAttachment = (attachmentName) => {
    if (attachmentName) {
      window.open(`${FILE_BASE}/api/employee/uploads/${attachmentName}`, '_blank');
    }
  };

  // Download attachment
  const handleDownloadAttachment = (attachmentName, documentType) => {
    if (attachmentName) {
      const link = document.createElement('a');
      link.href = `${FILE_BASE}/api/employee/uploads/${attachmentName}`;
      link.download = `${documentType}_${selectedEmployee?.name || 'document'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!filteredEmployees || filteredEmployees.length === 0) {
      toast.warning("No data to export!");
      return;
    }

    try {
      const dataRows = filteredEmployees.map((emp, index) => ({
        "S.No": index + 1,
        "Employee ID": emp.id || "-",
        "Employee Name": emp.name || "N/A",
        "Department": emp.department || "N/A",
        "Designation": emp.designation || "N/A",
        "Email": emp.email || "N/A",
        "Mobile": emp.mobile || "N/A",
        "ESI/PF Status": emp.esiPfStatus || "N/A",
        "Date of Joining": emp.doj || "N/A",
        "Created By": emp.createdBy || "N/A",
        "Created At": emp.createdAt || "N/A"
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataRows);

      worksheet["!cols"] = [
        { wch: 6 },  // S.No
        { wch: 12 }, // Employee ID
        { wch: 22 }, // Name
        { wch: 18 }, // Department
        { wch: 18 }, // Designation
        { wch: 28 }, // Email
        { wch: 15 }, // Mobile
        { wch: 14 }, // ESI/PF Status
        { wch: 15 }, // DOJ
        { wch: 15 }, // Created By
        { wch: 20 }  // Created At
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Employee Report");

      const fileName = `Employee_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Excel report downloaded successfully!");
    } catch (error) {
      console.error("Excel Export Error:", error);
      toast.error("Failed to generate Excel file.");
    }
  };

  // Export to PDF
  const exportToPDF = () => {
    if (!filteredEmployees || filteredEmployees.length === 0) {
      toast.warning("No data to export!");
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      // Title & Header Styling
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(13, 110, 253);
      doc.text("LAKHOTIA ERP SOLUTIONS", 14, 15);

      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text("Employee Master Report", 14, 22);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated On: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString()}`, 14, 27);
      doc.text(`Total Records: ${filteredEmployees.length}`, 220, 27);

      // Decorative divider line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(14, 30, 283, 30);

      const tableHeaders = [["#", "ID", "Name", "Department", "Designation", "Email", "Mobile", "ESI/PF Status", "DOJ", "Created By"]];
      const tableData = filteredEmployees.map((emp, idx) => [
        idx + 1,
        emp.id || "-",
        emp.name || "N/A",
        emp.department || "N/A",
        emp.designation || "N/A",
        emp.email || "N/A",
        emp.mobile || "N/A",
        emp.esiPfStatus || "N/A",
        emp.doj || "N/A",
        emp.createdBy || "N/A"
      ]);

      autoTable(doc, {
        startY: 34,
        head: tableHeaders,
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [13, 110, 253],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
          halign: "center"
        },
        bodyStyles: {
          fontSize: 8.5,
          cellPadding: 2.5,
          textColor: [33, 37, 41]
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { halign: "center", cellWidth: 14 },
          2: { cellWidth: 35 },
          3: { cellWidth: 30 },
          4: { cellWidth: 30 },
          5: { cellWidth: 50 },
          6: { halign: "center", cellWidth: 28 },
          7: { halign: "center", cellWidth: 22 },
          8: { halign: "center", cellWidth: 22 },
          9: { cellWidth: 28 }
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            data.settings.margin.left,
            doc.internal.pageSize.height - 8
          );
          doc.text(
            "Confidential - Lakhotia ERP Solutions",
            doc.internal.pageSize.width - 65,
            doc.internal.pageSize.height - 8
          );
        }
      });

      const fileName = `Employee_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
      toast.success("PDF report downloaded successfully!");
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast.error("Failed to generate PDF file.");
    }
  };

  const resetForm = () => {
    setFormData({
      photo: null,
      photoPreview: null,
      name: "",
      dob: "",
      gender: "",
      email: "",
      address: "",
      department: "",
      designation: "",
      doj: "",
      userType: "",
      mobile: "",
      altContact: "",
      pan: "",
      aadhar: "",
      panAttachment: null,
      aadharAttachment: null,
      password: "",
      confirmPassword: "",
      esiPfStatus: "",
    });
    setStep(1);
    setFormOpen(false);
    setEditId(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setErrors({});
  };

  // Handle Enter key for search
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Search is already handled by useEffect
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Employee Management</h2>

      {/* Search and Export Section */}
      <div style={styles.toolbar}>
        <div style={styles.searchContainer}>
          <FaSearch style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by name, email, department, designation, mobile, PAN, or Aadhar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")} 
              style={styles.clearSearchButton}
            >
              <FaTimes />
            </button>
          )}
        </div>
        
        <div style={styles.buttonGroup}>                    
          <button
            style={styles.addButton}
            onClick={() => {
              resetForm();
              setFormOpen(true);
            }}
            title="Add New Employee"
          >
            <FaPlus style={{ marginRight: 6 }} /> Add Employee
          </button>
        </div>
      </div>

      {/* Results Count */}
      {searchTerm && (
        <div style={styles.resultsCount}>
          Found {filteredEmployees.length} employees matching "{searchTerm}"
          {filteredEmployees.length === 0 && " - Try a different search term"}
          {filteredEmployees.length > 0 && (
            <button 
              onClick={() => setSearchTerm("")} 
              style={styles.clearResultsButton}
            >
              Clear Search
            </button>
          )}
        </div>
      )}

      {/* Form Modal (Add / Edit) */}
      {formOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editId ? `Edit Employee (ID: ${editId}) - Step ${step}` : `Add Employee - Step ${step}`}
              </h3>
              <FaTimes
                onClick={() => {
                  resetForm();
                }}
                style={styles.closeIcon}
              />
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              {/* Step 1 */}
              {step === 1 && (
                <div style={styles.gridForm}>
                  <div style={styles.gridItemFull}>
                    <label style={styles.label}>Upload Photo (JPEG/PNG, max 2MB)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      style={styles.input}
                    />
                    {formData.photoPreview && (
                      <img
                        src={formData.photoPreview}
                        alt="Preview"
                        style={styles.previewPhoto}
                      />
                    )}
                  </div>
                  <div>
                    <label style={styles.label}>Full Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      style={{...styles.input, borderColor: errors.name ? "#ff4d4d" : "#ddd"}}
                      required
                      placeholder="Enter full name"
                    />
                    {errors.name && <div style={styles.errorText}>{errors.name}</div>}
                  </div>
                  <div>
                    <label style={styles.label}>Date of Birth *</label>
                    <input
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      style={{...styles.input, borderColor: errors.dob ? "#ff4d4d" : "#ddd"}}
                      required
                    />
                    {errors.dob && <div style={styles.errorText}>{errors.dob}</div>}
                  </div>
                  <div>
                    <label style={styles.label}>Gender *</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      style={{...styles.input, borderColor: errors.gender ? "#ff4d4d" : "#ddd"}}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                    {errors.gender && <div style={styles.errorText}>{errors.gender}</div>}
                  </div>
                  <div style={styles.buttonGroupStep}>
                    <button type="button" style={styles.nextButton} onClick={nextStep}>
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div style={styles.gridForm}>
                  <div>
                    <label style={styles.label}>Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      style={{...styles.input, borderColor: errors.email ? "#ff4d4d" : "#ddd"}}
                      required
                      placeholder="example@company.com"
                    />
                    {errors.email && <div style={styles.errorText}>{errors.email}</div>}
                  </div>
                  <div>
                    <label style={styles.label}>Mobile *</label>
                    <input
                      type="text"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleChange}
                      style={{...styles.input, borderColor: errors.mobile ? "#ff4d4d" : "#ddd"}}
                      required
                      maxLength="10"
                      placeholder="10-digit mobile number"
                    />
                    {errors.mobile && <div style={styles.errorText}>{errors.mobile}</div>}
                  </div>
                  <div>
                    <label style={styles.label}>Alternate Contact</label>
                    <input
                      type="text"
                      name="altContact"
                      value={formData.altContact}
                      onChange={handleChange}
                      style={{...styles.input, borderColor: errors.altContact ? "#ff4d4d" : "#ddd"}}
                      maxLength="10"
                      placeholder="10-digit alternate number"
                    />
                    {errors.altContact && <div style={styles.errorText}>{errors.altContact}</div>}
                  </div>
                  <div style={styles.gridItemFull}>
                    <label style={styles.label}>Address *</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      style={{...styles.textarea, borderColor: errors.address ? "#ff4d4d" : "#ddd"}}
                      required
                      placeholder="Full address"
                    />
                    {errors.address && <div style={styles.errorText}>{errors.address}</div>}
                  </div>
                  
                  {/* Password Field with Eye Icon */}
                  <div>
                    <label style={styles.label}>
                      Password {editId ? "(leave blank to keep current)" : "*"}
                    </label>
                    <div style={styles.passwordContainer}>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        style={{
                          ...styles.input, 
                          paddingRight: "40px",
                          borderColor: errors.password ? "#ff4d4d" : "#ddd"
                        }}
                        required={!editId}
                        placeholder={editId ? "Enter new password or leave blank" : "Minimum 6 characters"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={styles.eyeButton}
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    {errors.password && <div style={styles.errorText}>{errors.password}</div>}
                  </div>
                  
                  {/* Confirm Password Field with Eye Icon */}
                  <div>
                    <label style={styles.label}>Confirm Password {!editId && "*"}</label>
                    <div style={styles.passwordContainer}>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        style={{
                          ...styles.input, 
                          paddingRight: "40px",
                          borderColor: errors.confirmPassword ? "#ff4d4d" : "#ddd"
                        }}
                        required={!editId}
                        placeholder={editId ? "Leave blank to keep current" : "Confirm password"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeButton}
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    {errors.confirmPassword && <div style={styles.errorText}>{errors.confirmPassword}</div>}
                  </div>
                  
                  <div style={styles.buttonGroupStep}>
                    <button type="button" style={styles.prevButton} onClick={prevStep}>
                      Previous
                    </button>
                    <button type="button" style={styles.nextButton} onClick={nextStep}>
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {step === 3 && (
                <div style={styles.gridForm}>
                  <div>
                    <label style={styles.label}>Department</label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      style={styles.input}
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.name}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Designation</label>
                    <select
                      name="designation"
                      value={formData.designation}
                      onChange={handleChange}
                      style={styles.input}
                    >
                      <option value="">Select Designation</option>
                      {designations.map((des) => (
                        <option key={des.id} value={des.name}>
                          {des.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Date of Joining</label>
                    <input
                      type="date"
                      name="doj"
                      value={formData.doj}
                      onChange={handleChange}
                      style={{...styles.input, borderColor: errors.doj ? "#ff4d4d" : "#ddd"}}
                    />
                    {errors.doj && <div style={styles.errorText}>{errors.doj}</div>}
                  </div>

                  <div>
                    <label style={styles.label}>User Type</label>
                    <select
                      name="userType"
                      value={formData.userType}
                      onChange={handleChange}
                      style={styles.input}
                    >
                      <option value="">Select User Type</option>
                      {userTypes.map((ut) => (
                        <option key={ut.id} value={ut.name}>
                          {ut.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>PAN Number</label>
                    <input
                      type="text"
                      name="pan"
                      value={formData.pan}
                      onChange={handleChange}
                      style={{...styles.input, borderColor: errors.pan ? "#ff4d4d" : "#ddd", textTransform: 'uppercase'}}
                      placeholder="ABCDE1234F"
                    />
                    {errors.pan && <div style={styles.errorText}>{errors.pan}</div>}
                  </div>

                  <div>
                    <label style={styles.label}>PAN Attachment (PDF/Image, max 5MB)</label>
                    <div style={styles.fileInputContainer}>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handlePanAttachmentChange}
                        style={styles.fileInput}
                      />
                      <FaPaperclip style={styles.attachmentIcon} />
                      <span style={styles.fileInputText}>
                        {formData.panAttachment ? formData.panAttachment.name : "Choose file"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={styles.label}>Aadhar Number</label>
                    <input
                      type="text"
                      name="aadhar"
                      value={formData.aadhar}
                      onChange={handleChange}
                      style={{...styles.input, borderColor: errors.aadhar ? "#ff4d4d" : "#ddd"}}
                      placeholder="12-digit number"
                    />
                    {errors.aadhar && <div style={styles.errorText}>{errors.aadhar}</div>}
                  </div>

                  <div>
                    <label style={styles.label}>Aadhar Attachment (PDF/Image, max 5MB)</label>
                    <div style={styles.fileInputContainer}>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleAadharAttachmentChange}
                        style={styles.fileInput}
                      />
                      <FaPaperclip style={styles.attachmentIcon} />
                      <span style={styles.fileInputText}>
                        {formData.aadharAttachment ? formData.aadharAttachment.name : "Choose file"}
                      </span>
                    </div>
                  </div>

                  {/* ✅ ESI/PF Dropdown */}
                  <div>
                    <label style={styles.label}>ESI/PF Status</label>
                    <select
                      name="esiPfStatus"
                      value={formData.esiPfStatus}
                      onChange={handleChange}
                      style={styles.input}
                    >
                      <option value="">Select ESI/PF Status</option>
                      {esiPfOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.buttonGroupStep}>
                    <button type="button" style={styles.prevButton} onClick={prevStep}>
                      Previous
                    </button>
                    <button type="submit" style={styles.submitButton}>
                      {editId ? "Update Employee" : "Add Employee"}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* View Card Modal */}
      {viewOpen && selectedEmployee && (
        <div style={styles.modalOverlay}>
          <div style={styles.viewModal}>
            <div style={styles.viewHeader}>
              <h3 style={{ margin: 0, fontSize: "18px" }}>{selectedEmployee.name}</h3>
              <FaTimes
                onClick={() => {
                  setViewOpen(false);
                  setSelectedEmployee(null);
                  setShowViewPassword(false);
                }}
                style={styles.closeIcon}
              />
            </div>

            <div style={styles.viewContent}>
              <div style={styles.viewLeft}>
                {selectedEmployee.photo ? (
                  <img
                    src={`${FILE_BASE}/api/employee/uploads/${selectedEmployee.photo}`}

                    alt="emp"
                    style={styles.viewPhoto}
                  />
                ) : (
                  <div style={styles.noPhoto}>No Photo</div>
                )}
              </div>

              <div style={styles.viewRight}>
                <div style={styles.viewRow}>
                  <strong>Full Name:</strong> <span>{selectedEmployee.name}</span>
                </div>
                <div style={styles.viewRow}>
                  <strong>Email:</strong> <span>{selectedEmployee.email}</span>
                </div>
                <div style={styles.viewRow}>
                  <strong>Mobile:</strong> <span>{selectedEmployee.mobile}</span>
                </div>
                <div style={styles.viewRow}>
                  <strong>Alternate Contact:</strong> <span>{selectedEmployee.altContact || "N/A"}</span>
                </div>
                <div style={styles.viewRow}>
                  <strong>Department:</strong> <span>{selectedEmployee.department}</span>
                </div>
                <div style={styles.viewRow}>
                  <strong>Designation:</strong> <span>{selectedEmployee.designation}</span>
                </div>
                <div style={styles.viewRow}>
                  <strong>Gender:</strong> <span>{selectedEmployee.gender}</span>
                </div>
                <div style={styles.viewRow}>
                  <strong>DOB:</strong> <span>{selectedEmployee.dob}</span>
                </div>
                <div style={styles.viewRow}>
                  <strong>DOJ:</strong> <span>{selectedEmployee.doj}</span>
                </div>
                <div style={styles.viewRow}>
                  <strong>User Type:</strong> <span>{selectedEmployee.userType}</span>
                </div>
                <div style={styles.viewRow}>
                  <strong>ESI/PF Status:</strong> 
                  <span style={{ 
                    color: selectedEmployee.esiPfStatus && selectedEmployee.esiPfStatus !== "None" ? 'green' : 'red',
                    fontWeight: 'bold'
                  }}>
                    {selectedEmployee.esiPfStatus || "Not Specified"}
                  </span>
                </div>
                <div style={styles.viewRow}>
                  <strong>PAN:</strong> <span>{selectedEmployee.pan || "N/A"}</span>
                </div>
                
                {/* PAN Attachment Section */}
                {selectedEmployee.pan && selectedEmployee.panAttachment && (
                  <div style={styles.viewRow}>
                    <strong>PAN Attachment:</strong> 
                    <div style={styles.attachmentActions}>
                      <button
                        onClick={() => handleViewAttachment(selectedEmployee.panAttachment)}
                        style={styles.viewAttachmentButton}
                      >
                        <FaEye style={{ marginRight: 4 }} /> View
                      </button>
                      <button
                        onClick={() => handleDownloadAttachment(selectedEmployee.panAttachment, "PAN")}
                        style={styles.downloadAttachmentButton}
                      >
                        <FaDownload style={{ marginRight: 4 }} /> Download
                      </button>
                    </div>
                  </div>
                )}

                <div style={styles.viewRow}>
                  <strong>Aadhar:</strong> <span>{selectedEmployee.aadhar || "N/A"}</span>
                </div>
                
                {/* Aadhar Attachment Section */}
                {selectedEmployee.aadhar && selectedEmployee.aadharAttachment && (
                  <div style={styles.viewRow}>
                    <strong>Aadhar Attachment:</strong> 
                    <div style={styles.attachmentActions}>
                      <button
                        onClick={() => handleViewAttachment(selectedEmployee.aadharAttachment)}
                        style={styles.viewAttachmentButton}
                      >
                        <FaEye style={{ marginRight: 4 }} /> View
                      </button>
                      <button
                        onClick={() => handleDownloadAttachment(selectedEmployee.aadharAttachment, "Aadhar")}
                        style={styles.downloadAttachmentButton}
                      >
                        <FaDownload style={{ marginRight: 4 }} /> Download
                      </button>
                    </div>
                  </div>
                )}

                <div style={styles.viewRow}>
                  <strong>Address:</strong> <span>{selectedEmployee.address}</span>
                </div>
                
                <div style={styles.viewRow}>
                  <strong>Created By:</strong> <span>{selectedEmployee.createdBy}</span>
                </div>
                <div style={styles.viewRow}>
                  <strong>Created At:</strong> <span>{selectedEmployee.createdAt}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Photo</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Department</th>
              <th style={styles.th}>Designation</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Mobile</th>
              <th style={styles.th}>ESI/PF Status</th>
              <th style={styles.th}>Created By</th>
              <th style={styles.th}>Created At</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentEmployees.length ? (
              currentEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td style={styles.td}>{emp.id}</td>
                  <td style={styles.td}>
                    {emp.photo ? (
                      <img
                        src={`${FILE_BASE}/api/employee/uploads/${emp.photo}`}

                        alt="emp"
                        style={styles.tablePhoto}
                      />
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td style={styles.td}>{emp.name}</td>
                  <td style={styles.td}>{emp.department}</td>
                  <td style={styles.td}>{emp.designation}</td>
                  <td style={styles.td}>{emp.email}</td>
                  <td style={styles.td}>{emp.mobile}</td>
                  <td style={styles.td}>
                    <span style={{
                      color: emp.esiPfStatus && emp.esiPfStatus !== "None" ? 'green' : 'red',
                      fontWeight: 'bold'
                    }}>
                      {emp.esiPfStatus || "Not Specified"}
                    </span>
                  </td>
                  <td style={styles.td}>{emp.createdBy}</td>
                  <td style={styles.td}>{emp.createdAt}</td>
                  <td style={styles.td}>
                    <button
                      title="View"
                      onClick={() => handleView(emp.id)}
                      style={{ ...styles.actionButton, color: "#2b7cff", marginRight: 6 }}
                    >
                      <FaEye />
                    </button>

                    <button
                      title="Edit"
                      onClick={() => handleEdit(emp.id)}
                      style={{ ...styles.actionButton, color: "#ffa500", marginRight: 6 }}
                    >
                      <FaEdit />
                    </button>

                    <button
                      title="Delete"
                      onClick={() => handleDelete(emp.id)}
                      style={{ ...styles.actionButton, color: "#ff4d4d" }}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="11" style={styles.noData}>
                  {searchTerm ? `No employees found for "${searchTerm}"` : "No employees found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredEmployees.length > itemsPerPage && (
        <div style={styles.paginationContainer}>
          <div style={styles.paginationInfo}>
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredEmployees.length)} of {filteredEmployees.length} entries
          </div>
          
          <div style={styles.paginationControls}>
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              style={{
                ...styles.paginationButton,
                opacity: currentPage === 1 ? 0.5 : 1,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <FaChevronLeft />
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = i + 1;
              } else if (currentPage <= 3) {
                pageNumber = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = currentPage - 2 + i;
              }
              
              return pageNumber <= totalPages ? (
                <button
                  key={pageNumber}
                  onClick={() => goToPage(pageNumber)}
                  style={{
                    ...styles.paginationButton,
                    backgroundColor: currentPage === pageNumber ? '#f5c518' : '#f0f0f0',
                    color: currentPage === pageNumber ? '#333' : '#666',
                    fontWeight: currentPage === pageNumber ? 'bold' : 'normal'
                  }}
                >
                  {pageNumber}
                </button>
              ) : null;
            })}
            
            <button
              onClick={nextPage}
              disabled={currentPage === totalPages}
              style={{
                ...styles.paginationButton,
                opacity: currentPage === totalPages ? 0.5 : 1,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              <FaChevronRight />
            </button>
          </div>
        </div>
      )}

      
    </div>
  );
};

// Updated Styles with improved mobile view for the employee details modal
const styles = {
  container: { 
    padding: "30px", 
    fontFamily: "Poppins, sans-serif", 
    background: "#fff",
    "@media (max-width: 768px)": {
      padding: "15px"
    }
  },
  heading: { 
    marginBottom: "20px",
    "@media (max-width: 768px)": {
      fontSize: "20px",
      textAlign: "center"
    }
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "15px"
  },
  searchContainer: {
    position: "relative",
    flex: 1,
    minWidth: "300px",
    maxWidth: "500px",
    "@media (max-width: 768px)": {
      minWidth: "100%",
      maxWidth: "100%"
    }
  },
  searchIcon: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#666",
    fontSize: "16px"
  },
  searchInput: {
    width: "100%",
    padding: "10px 40px 10px 40px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.3s",
    "@media (max-width: 768px)": {
      fontSize: "16px",
      padding: "12px 40px 12px 40px"
    }
  },
  clearSearchButton: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#999",
    fontSize: "14px",
    padding: "0"
  },
  buttonGroup: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    "@media (max-width: 768px)": {
      width: "100%"
    }
  },
  excelButton: {
    background: "#217346",
    color: "white",
    padding: "10px 20px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    fontSize: "14px",
    opacity: 1,
    transition: "opacity 0.3s"
  },
  pdfButton: {
    background: "#ff4d4d",
    color: "white",
    padding: "10px 20px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    fontSize: "14px",
    opacity: 1,
    transition: "opacity 0.3s"
  },
  addButton: {
    background: "#f5c518",
    padding: "10px 20px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    "@media (max-width: 768px)": {
      width: "100%",
      justifyContent: "center",
      padding: "12px"
    }
  },
  resultsCount: {
    marginBottom: "15px",
    color: "#666",
    fontSize: "14px",
    fontStyle: "italic",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    backgroundColor: "#fff8d6",
    borderRadius: "6px",
    "@media (max-width: 768px)": {
      flexDirection: "column",
      alignItems: "flex-start",
      fontSize: "13px"
    }
  },
  clearResultsButton: {
    background: "transparent",
    border: "1px solid #f5c518",
    color: "#f5c518",
    padding: "4px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    marginLeft: "10px",
    "@media (max-width: 768px)": {
      marginLeft: "0",
      marginTop: "5px"
    }
  },
  table: { width: "100%", borderCollapse: "collapse", marginBottom: "20px" },
  th: { 
    background: "#fff8d6", 
    padding: "12px", 
    borderBottom: "2px solid #f5c518",
    textAlign: "left",
    whiteSpace: "nowrap",
    "@media (max-width: 768px)": {
      padding: "8px",
      fontSize: "12px"
    }
  },
  td: { 
    padding: "12px", 
    textAlign: "left", 
    borderBottom: "1px solid #eee",
    verticalAlign: "middle",
    "@media (max-width: 768px)": {
      padding: "8px",
      fontSize: "12px"
    }
  },
  tablePhoto: { 
    width: "45px", 
    height: "45px", 
    borderRadius: "50%",
    objectFit: "cover",
    "@media (max-width: 768px)": {
      width: "35px",
      height: "35px"
    }
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
    padding: "16px",
    "@media (max-width: 768px)": {
      padding: "10px"
    }
  },
  modal: {
    background: "#fff",
    padding: "20px",
    borderRadius: "12px",
    width: "720px",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
    "@media (max-width: 768px)": {
      padding: "15px",
      width: "100%"
    }
  },
  viewModal: {
    background: "#fff",
    padding: "20px",
    borderRadius: "16px",
    width: "760px",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
    "@media (max-width: 768px)": {
      padding: "16px",
      width: "100%",
      borderRadius: "20px"
    }
  },
  viewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: "2px solid #f5c518",
    "@media (max-width: 768px)": {
      marginBottom: "12px",
      paddingBottom: "8px"
    }
  },
  viewContent: {
    display: "flex",
    gap: "24px",
    "@media (max-width: 768px)": {
      flexDirection: "column",
      gap: "16px"
    }
  },
  viewLeft: { 
    width: "160px", 
    display: "flex", 
    justifyContent: "center", 
    alignItems: "center",
    "@media (max-width: 768px)": {
      width: "100%",
      marginBottom: "8px"
    }
  },
  viewRight: { 
    flex: 1,
    "@media (max-width: 768px)": {
      width: "100%"
    }
  },
  viewPhoto: { 
    width: "140px", 
    height: "140px", 
    borderRadius: "16px", 
    objectFit: "cover",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    "@media (max-width: 768px)": {
      width: "120px",
      height: "120px",
      borderRadius: "60px"
    }
  },
  noPhoto: {
    width: "140px",
    height: "140px",
    borderRadius: "16px",
    background: "#f0f0f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#888",
    fontSize: "14px",
    "@media (max-width: 768px)": {
      width: "120px",
      height: "120px",
      borderRadius: "60px"
    }
  },
  viewRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px dashed #eee",
    "@media (max-width: 768px)": {
      flexDirection: "column",
      alignItems: "flex-start",
      padding: "8px 0",
      gap: "4px"
    }
  },
  attachmentActions: {
    display: "flex",
    gap: "10px",
    "@media (max-width: 768px)": {
      width: "100%",
      justifyContent: "flex-start",
      marginTop: "4px"
    }
  },
  viewAttachmentButton: {
    background: "#2b7cff",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    fontWeight: "500",
    transition: "all 0.2s",
    "@media (max-width: 768px)": {
      padding: "10px 16px",
      fontSize: "14px",
      flex: "1",
      justifyContent: "center"
    }
  },
  downloadAttachmentButton: {
    background: "#4CAF50",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    fontWeight: "500",
    transition: "all 0.2s",
    "@media (max-width: 768px)": {
      padding: "10px 16px",
      fontSize: "14px",
      flex: "1",
      justifyContent: "center"
    }
  },
  gridForm: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "15px 20px",
    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
      gap: "12px"
    }
  },
  gridItemFull: { 
    gridColumn: "1 / span 2",
    "@media (max-width: 768px)": {
      gridColumn: "1"
    }
  },
  label: { 
    fontWeight: "500", 
    display: "block", 
    marginBottom: "6px",
    fontSize: "14px",
    "@media (max-width: 768px)": {
      fontSize: "13px"
    }
  },
  input: { 
    width: "100%", 
    padding: "10px", 
    borderRadius: "6px", 
    border: "1px solid #ddd",
    fontSize: "14px",
    boxSizing: "border-box",
    "@media (max-width: 768px)": {
      fontSize: "16px",
      padding: "12px"
    }
  },
  textarea: {
    width: "100%",
    borderRadius: "6px",
    border: "1px solid #ddd",
    padding: "10px",
    minHeight: "70px",
    fontSize: "14px",
    boxSizing: "border-box",
    resize: "vertical",
    "@media (max-width: 768px)": {
      fontSize: "16px",
      padding: "12px"
    }
  },
  fileInputContainer: {
    position: "relative",
    width: "100%",
    border: "1px solid #ddd",
    borderRadius: "6px",
    padding: "10px",
    background: "#f9f9f9",
    cursor: "pointer",
    minHeight: "42px",
    display: "flex",
    alignItems: "center"
  },
  fileInput: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
  },
  fileInputText: {
    color: "#666",
    fontSize: "14px",
    marginLeft: "8px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  attachmentIcon: {
    marginRight: "8px",
    color: "#666",
  },
  previewPhoto: {
    width: "80px",
    height: "80px",
    borderRadius: "8px",
    marginTop: "10px",
    objectFit: "cover",
    border: "1px solid #ddd"
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    paddingBottom: "10px",
    borderBottom: "1px solid #eee"
  },
  modalTitle: { 
    margin: 0,
    fontSize: "18px",
    "@media (max-width: 768px)": {
      fontSize: "16px"
    }
  },
  closeIcon: { 
    cursor: "pointer", 
    color: "#ff4d4d",
    fontSize: "20px",
    "@media (max-width: 768px)": {
      fontSize: "22px"
    }
  },
  buttonGroupStep: {
    gridColumn: "1 / span 2",
    display: "flex",
    justifyContent: "space-between",
    marginTop: "20px",
    paddingTop: "15px",
    borderTop: "1px solid #eee",
    "@media (max-width: 768px)": {
      gridColumn: "1"
    }
  },
  prevButton: {
    background: "#f0f0f0",
    border: "none",
    padding: "10px 25px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    color: "#333",
    "@media (max-width: 768px)": {
      padding: "12px 20px",
      fontSize: "14px",
      flex: "1",
      marginRight: "8px"
    }
  },
  nextButton: {
    background: "#f5c518",
    border: "none",
    padding: "10px 25px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    color: "#333",
    "@media (max-width: 768px)": {
      padding: "12px 20px",
      fontSize: "14px",
      flex: "1",
      marginLeft: "8px"
    }
  },
  submitButton: {
    background: "#4CAF50",
    color: "#fff",
    border: "none",
    padding: "10px 25px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    "@media (max-width: 768px)": {
      padding: "12px 20px",
      fontSize: "14px",
      flex: "1"
    }
  },
  noData: { 
    textAlign: "center", 
    padding: "30px", 
    color: "#888",
    fontSize: "16px"
  },
  actionButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "18px",
    margin: "0 5px",
    padding: "5px",
    borderRadius: "4px",
    transition: "background-color 0.2s",
    "@media (max-width: 768px)": {
      fontSize: "20px",
      padding: "8px",
      margin: "0 3px"
    }
  },
  // New styles for password fields with eye icons
  passwordContainer: {
    position: "relative",
    width: "100%"
  },
  eyeButton: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#666",
    fontSize: "16px",
    padding: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
    height: "30px"
  },
  // Error text style
  errorText: {
    color: "#ff4d4d",
    fontSize: "12px",
    marginTop: "4px",
    fontStyle: "italic"
  },
  // Pagination styles
  paginationContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "20px",
    padding: "15px",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    flexWrap: "wrap",
    gap: "10px",
    "@media (max-width: 768px)": {
      flexDirection: "column",
      padding: "12px"
    }
  },
  paginationInfo: {
    color: "#666",
    fontSize: "14px",
    "@media (max-width: 768px)": {
      fontSize: "13px"
    }
  },
  paginationControls: {
    display: "flex",
    gap: "5px",
    alignItems: "center",
    "@media (max-width: 768px)": {
      flexWrap: "wrap",
      justifyContent: "center"
    }
  },
  paginationButton: {
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    backgroundColor: "#f0f0f0",
    color: "#666",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "36px",
    height: "36px",
    transition: "all 0.2s",
    "@media (max-width: 768px)": {
      padding: "10px 14px",
      minWidth: "40px",
      height: "40px"
    }
  }
};

export default EmployeePage;