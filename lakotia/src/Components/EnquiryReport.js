import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import dayjs from "dayjs";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Bootstrap CSS and Icons
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

export default function EnquiryModal() {
  const idRef = useRef(1000);

  // ADD: User type check states
  const [isCompanyUser, setIsCompanyUser] = useState(false);
  const [companyUserDetails, setCompanyUserDetails] = useState(null);
  const [isLoadingUserCheck, setIsLoadingUserCheck] = useState(false);

  // ADD: Get user info from localStorage
  const [userInfo, setUserInfo] = useState({
    email: '',
    username: ''
  });

  // Helper to create item - ADDED brand field
  function createEmptyItem(seq) {
    idRef.current += 1;
    return {
      id: idRef.current,
      item_name: "",
      hsn_sac: "",
      supplier_part_no: "",
      description: "",
      brand: "", // ADDED brand field
      cut_width: 1,
      length: 1,
      quantity: 1,
      batch_no: `B-${Date.now().toString().slice(-6)}-${seq}`,
      brand_code: "",
      unit: "pcs",
      customer_description: "",
      customer_requirements: "",
    };
  }

  // Issuer static details
  const issuer = {
    name: "Lakhotia",
    address: "64/3A Sidco Industrial Estate, Ambatur, Chennai",
    phone: "7845663338",
    email: "vivek@lakhotia.net",
    gstin: "33AABFL9981E1Z7",
    stateCode: "33-Tamil Nadu",
  };

  // Logo path
  const companyLogo = "/Asset/Name1.jpg";

  // State variables
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [companyError, setCompanyError] = useState(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [billTo, setBillTo] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyPincode, setCompanyPincode] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactMob, setContactMob] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactEmailSame, setContactEmailSame] = useState(false);

  // Company search dropdown state
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [filteredCompanies, setFilteredCompanies] = useState([]);

  // Items state - Start with empty array
  const [items, setItems] = useState([]);

  // Stock items for autocomplete
  const [stockItems, setStockItems] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockError, setStockError] = useState(null);

  // Popup modal states for item selection
  const [showItemPopup, setShowItemPopup] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [newItemCutWidth, setNewItemCutWidth] = useState("");
  const [newItemLength, setNewItemLength] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("1");
  const [newItemBatchCode, setNewItemBatchCode] = useState("");
  const [availableBatchCodes, setAvailableBatchCodes] = useState([]);
  const [newItemCustomerDescription, setNewItemCustomerDescription] = useState("");
  const [newItemCustomerRequirements, setNewItemCustomerRequirements] = useState("");
  const [newItemSupplierPartNo, setNewItemSupplierPartNo] = useState("");
  const [newItemBrandCode, setNewItemBrandCode] = useState("");
  const [newItemBrand, setNewItemBrand] = useState(""); // ADDED brand state

  // View enquiry modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEnquiryId, setDeleteEnquiryId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Modal states for multi-step flow
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Saved enquiries state
  const [savedEnquiries, setSavedEnquiries] = useState([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  // Statistics
  const [enquiryCounts, setEnquiryCounts] = useState({
    all: 0,
    draft: 0,
    converted: 0,
    lost: 0
  });

  // DOM ref for enquiry content
  const enquiryRef = useRef(null);

  // NEW: Export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [exportEndDate, setExportEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [exportStatus, setExportStatus] = useState('all'); // all, draft, converted, lost
  const [exporting, setExporting] = useState(false);
  const [exportData, setExportData] = useState([]);

  // =============== UPDATED: API Configuration ===============
  // Removed hardcoded API_BASE_URL


  // Create a custom axios instance with better error handling
  const api = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    withCredentials: false,
  });

  // Fetch saved enquiries from backend on component mount
  useEffect(() => {
    // Get user info from localStorage
    const userEmail = localStorage.getItem("email") || localStorage.getItem("userEmail") || '';
    const userName = localStorage.getItem("username") || localStorage.getItem("userName") || '';

    setUserInfo({
      email: userEmail,
      username: userName
    });

    // Initialize
    const initialize = async () => {
      await checkUserType();
      await fetchEnquiries();
      await fetchEnquiryCounts();
    };

    initialize();
  }, [currentPage, searchTerm]);

  // Function to check user type and fetch company details
  const checkUserType = async () => {
    setIsLoadingUserCheck(true);

    const userType = localStorage.getItem("usertype");
    const companyCustomerName = localStorage.getItem("company_customer_name");
    const companyLoginEmail = localStorage.getItem("company_login_email");

    if (userType === "Customer" || userType === "company" || companyCustomerName || companyLoginEmail) {
      setIsCompanyUser(true);

      try {
        const response = await api.get('/company');

        let companiesData = [];

        if (Array.isArray(response.data)) {
          companiesData = response.data;
        } else if (response.data && typeof response.data === 'object') {
          if (Array.isArray(response.data.data)) {
            companiesData = response.data.data;
          } else if (response.data.companies) {
            companiesData = response.data.companies;
          }
        }

        let foundCompany = null;
        if (companyLoginEmail) {
          foundCompany = companiesData.find(company =>
            (company.customer_email || company.customerEmail || "").toLowerCase() ===
            companyLoginEmail.toLowerCase()
          );
        }

        if (!foundCompany && companyCustomerName) {
          foundCompany = companiesData.find(company =>
            (company.customer_name || company.customerName || "").toLowerCase() ===
            companyCustomerName.toLowerCase()
          );
        }

        if (foundCompany) {
          setCompanyUserDetails(foundCompany);
        }
      } catch (err) {
        console.error("Error checking company user:", err);
      }
    }

    setIsLoadingUserCheck(false);
  };

  // Fetch enquiry counts by status
  const fetchEnquiryCounts = async () => {
    try {
      const response = await api.get('/enquiries/statistics');
      if (response.data.success) {
        const counts = {
          all: response.data.data.total || 0,
          draft: response.data.data.status_counts?.draft || 0,
          converted: response.data.data.status_counts?.converted || 0,
          lost: response.data.data.status_counts?.lost || 0
        };
        setEnquiryCounts(counts);
      }
    } catch (err) {
      console.error("Error loading enquiry counts:", err);
      // Fallback to localStorage if needed
      const saved = localStorage.getItem("savedEnquiries");
      if (saved) {
        try {
          const allEnquiries = JSON.parse(saved);
          const draftCount = allEnquiries.filter(e => e.status === 'draft').length;
          const convertedCount = allEnquiries.filter(e => e.status === 'converted').length;
          const lostCount = allEnquiries.filter(e => e.status === 'lost').length;

          setEnquiryCounts({
            all: allEnquiries.length,
            draft: draftCount,
            converted: convertedCount,
            lost: lostCount
          });
        } catch (e) {
          console.error("Error parsing localStorage:", e);
        }
      }
    }
  };

  // =============== UPDATED: Fetch saved enquiries with pagination ===============
  const fetchEnquiries = async () => {
    setLoadingEnquiries(true);

    try {
      const params = {
        page: currentPage,
        per_page: itemsPerPage
      };

      if (searchTerm.trim()) {
        params.q = searchTerm.trim();
      }

      const response = await api.get('/enquiries', { params });

      if (response.data.success) {
        const fetchedEnquiries = response.data.data || [];
        const pagination = response.data.pagination || {};

        // Fetch items for each enquiry
        const enquiriesWithItems = await Promise.all(
          fetchedEnquiries.map(async (enquiry) => {
            try {
              const itemsResponse = await api.get(`/enquiries/${enquiry.id}/items`);
              const items = itemsResponse.data.success ? itemsResponse.data.data : [];

              const parsedItems = items.map(item => {
                const cut_width = parseFloat(item.cut_width) || 1;
                const length = parseFloat(item.length) || 1;
                const quantity = parseFloat(item.quantity) || 1;
                const count = Math.round(cut_width * length * quantity);

                return {
                  ...item,
                  count: count,
                  cut_width: cut_width,
                  length: length,
                  brand: item.brand || "", // ADDED brand field
                  customer_description: item.customer_description || "",
                  customer_requirements: item.customer_requirements || "",
                  brand_code: item.brand_code || ""
                };
              });

              return {
                ...enquiry,
                items: parsedItems,
                total_items: parsedItems.length,
                total_quantity: parsedItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)
              };
            } catch (err) {
              console.error(`Error fetching items for enquiry ${enquiry.id}:`, err);
              return { ...enquiry, items: [], total_items: 0, total_quantity: 0 };
            }
          })
        );

        setSavedEnquiries(enquiriesWithItems);
        setTotalItems(pagination.total || fetchedEnquiries.length);
        setTotalPages(pagination.pages || Math.ceil((pagination.total || fetchedEnquiries.length) / itemsPerPage) || 1);
      } else {
        throw new Error(response.data.message || "API response unsuccessful");
      }
    } catch (err) {
      console.error("Error loading enquiries from API:", err);
      loadFromLocalStorage();
    } finally {
      setLoadingEnquiries(false);
    }
  };

  // Load from localStorage with pagination
  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem("savedEnquiries");
    if (saved) {
      try {
        const allEnquiries = JSON.parse(saved);

        let filteredData = allEnquiries;

        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          filteredData = filteredData.filter(enquiry => {
            const enquiryNo = (enquiry.enquiry_number || enquiry.enquiryNo || "").toLowerCase();
            const companyName = (enquiry.company_name || enquiry.billTo || "").toLowerCase();
            const contactPersonName = (enquiry.contact_person || enquiry.contactPerson || "").toLowerCase();
            const contactEmail = (enquiry.contact_email || enquiry.contactEmail || "").toLowerCase();

            return enquiryNo.includes(term) ||
              companyName.includes(term) ||
              contactPersonName.includes(term) ||
              contactEmail.includes(term);
          });
        }

        filteredData.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.date || 0);
          const dateB = new Date(b.createdAt || b.date || 0);
          return dateB - dateA;
        });

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        const enquiriesWithItemStatus = paginatedData.map(enquiry => ({
          ...enquiry,
          items: enquiry.items || []
        }));

        setSavedEnquiries(enquiriesWithItemStatus);
        setTotalItems(filteredData.length);
        setTotalPages(Math.ceil(filteredData.length / itemsPerPage));
      } catch (e) {
        console.error("Error loading from localStorage:", e);
        setSavedEnquiries([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } else {
      setSavedEnquiries([]);
      setTotalItems(0);
      setTotalPages(1);
    }
  };

  // Delete enquiry
  const deleteEnquiry = async (enquiryId) => {
    setDeleting(true);
    try {
      const response = await api.delete(`/enquiries/${enquiryId}`);

      if (response.data.success) {
        await fetchEnquiries();
        await fetchEnquiryCounts();
        setShowDeleteModal(false);
        setDeleteEnquiryId(null);
        alert("Enquiry deleted successfully");
      } else {
        throw new Error(response.data.message || "Failed to delete enquiry");
      }
    } catch (err) {
      console.error("Delete enquiry failed:", err);
      alert("Failed to delete enquiry. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // Reset search function
  const resetSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Generate pagination items
  const getPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) items.push(i);
        items.push("...");
        items.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        items.push(1);
        items.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) items.push(i);
      } else {
        items.push(1);
        items.push("...");
        items.push(currentPage - 1);
        items.push(currentPage);
        items.push(currentPage + 1);
        items.push("...");
        items.push(totalPages);
      }
    }

    return items;
  };

  // Fetch companies when company modal opens
  useEffect(() => {
    if (!showCompanyModal) return;

    const fetchCompanies = async () => {
      setLoadingCompanies(true);
      setCompanyError(null);
      try {
        const response = await api.get('/company');

        let companiesData = [];

        if (Array.isArray(response.data)) {
          companiesData = response.data;
        } else if (response.data && typeof response.data === 'object') {
          if (Array.isArray(response.data.data)) {
            companiesData = response.data.data;
          } else if (response.data.companies) {
            companiesData = response.data.companies;
          } else {
            companiesData = Object.values(response.data);
          }
        }

        if (companiesData.length > 0) {
          setCompanies(companiesData);
          setCompanyError(null);

          if (isCompanyUser && companyUserDetails && !billTo.trim()) {
            const company = companyUserDetails;
            const companyId = company.id || company.ID || company.company_id || "";
            const companyName = company.companyName || company.company_name || "";
            const companyAddr = company.companyAddress || company.company_address || "";
            const companyPincode = company.pinCode || company.pin_code || "";
            const companyGst = company.gstNumber || company.gst_number || "";
            const customerName = company.customerName || company.customer_name || "";
            const customerMobile = company.customerMobile || company.customer_mobile || "";
            const customerEmail = company.customerEmail || company.customer_email || "";

            setSelectedCompanyId(companyId.toString());
            setSelectedCompany(company);
            setBillTo(companyName);
            setCompanyAddress(companyAddr);
            setCompanyPincode(companyPincode);
            setCompanyGstin(companyGst);
            setContactPerson(customerName);
            setContactMob(customerMobile);
            if (!contactEmailSame) {
              setContactEmail(customerEmail);
            }
          }
        } else {
          setCompanies([]);
          setCompanyError("No companies found in database.");
        }

      } catch (err) {
        console.error("Fetch companies failed:", err);
        setCompanies([]);
        setCompanyError("Failed to load companies. Please check your connection.");
      } finally {
        setLoadingCompanies(false);
      }
    };

    fetchCompanies();
  }, [showCompanyModal]);

  // Fetch stock items when items modal opens
  useEffect(() => {
    if (!showItemsModal) return;

    const fetchStockItems = async () => {
      setLoadingStock(true);
      setStockError(null);
      try {
        const response = await api.get('/stock/all');

        let stockData = [];

        if (response.data.success && Array.isArray(response.data.data)) {
          stockData = response.data.data;
        } else if (Array.isArray(response.data)) {
          stockData = response.data;
        }

        const uniqueStockData = Array.from(
          new Map(stockData.map(item => [item["Brand Code"], item])).values()
        );

        setStockItems(uniqueStockData);

        if (uniqueStockData.length === 0) {
          setStockError("No stock items found.");
        }

      } catch (err) {
        console.error("Fetch stock failed:", err);
        setStockItems([]);
        setStockError("Failed to load stock items. Please check your connection.");
      } finally {
        setLoadingStock(false);
      }
    };

    fetchStockItems();
  }, [showItemsModal]);

  // Handle bill to search (company name search)
  const handleBillToSearch = (searchTerm) => {
    setBillTo(searchTerm);

    if (searchTerm.trim() === "") {
      setFilteredCompanies([]);
      setShowCompanyDropdown(false);
      return;
    }

    const term = searchTerm.toLowerCase();
    const results = companies.filter(company => {
      const companyName = (company.companyName || company.company_name || "").toLowerCase();
      const customerName = (company.customerName || company.customer_name || "").toLowerCase();
      const customerMobile = (company.customerMobile || company.customer_mobile || "").toString().toLowerCase();
      const companyGst = (company.gstNumber || company.gst_number || "").toLowerCase();
      const companyAddress = (company.companyAddress || company.company_address || "").toLowerCase();

      return (
        companyName.includes(term) ||
        customerName.includes(term) ||
        customerMobile.includes(term) ||
        companyGst.includes(term) ||
        companyAddress.includes(term)
      );
    }).slice(0, 5);

    setFilteredCompanies(results);
    setShowCompanyDropdown(results.length > 0);
  };

  // Handle contact mobile number input - lookup company details
  const handleContactMobChange = (mobile) => {
    const cleaned = mobile.replace(/\D/g, '').slice(0, 10);
    setContactMob(cleaned);

    if (cleaned.length >= 10) {
      const foundCompany = companies.find(company => {
        const custMob = (company.customerMobile || company.customer_mobile || company.contact_mobile || "").toString().replace(/\D/g, '');
        return custMob && custMob.length >= 10 && custMob === cleaned;
      });

      if (foundCompany) {
        selectCompanyFromSearch(foundCompany);
        setContactMob(cleaned);
      }
    }
  };

  // Convert enquiry to quotation
  const convertEnquiryToQuotation = async (enquiry) => {
    if (!enquiry || !enquiry.id) return;
    if (!window.confirm(`Are you sure you want to convert Enquiry ${enquiry.enquiry_number || enquiry.enquiryNo} to a Quotation?`)) {
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/enquiries/${enquiry.id}/convert`, {
        created_by: userInfo.username || userInfo.email || "User"
      });
      if (res.data.success) {
        alert(`Enquiry ${enquiry.enquiry_number || enquiry.enquiryNo} converted to quotation and transferred to Quotation Management!`);
        if (typeof fetchEnquiries === 'function') fetchEnquiries();
        if (typeof fetchEnquiryCounts === 'function') fetchEnquiryCounts();
        setShowViewModal(false);
      }
    } catch (err) {
      console.error("Error converting enquiry:", err);
      alert("Failed to convert enquiry: " + (err.response?.data?.message || err.message));
    }
  };

  // Select company from search results
  const selectCompanyFromSearch = (company) => {
    const companyId = company.id || company.ID || company.company_id || "";
    const companyName = company.companyName || company.company_name || "";
    const companyAddr = company.companyAddress || company.company_address || "";
    const companyPincode = company.pinCode || company.pin_code || "";
    const companyGst = company.gstNumber || company.gst_number || "";
    const customerName = company.customerName || company.customer_name || company.contact_person || "";
    const customerMobile = company.customerMobile || company.customer_mobile || company.contact_mobile || "";
    const customerEmail = company.customerEmail || company.customer_email || company.contact_email || "";

    setSelectedCompanyId(companyId.toString());
    setSelectedCompany(company);
    setBillTo(companyName);
    setCompanyAddress(companyAddr);
    setCompanyPincode(companyPincode);
    setCompanyGstin(companyGst);
    setContactPerson(customerName);
    setContactMob(customerMobile);
    if (!contactEmailSame) {
      setContactEmail(customerEmail);
    }

    setShowCompanyDropdown(false);
    setFilteredCompanies([]);
  };

  // Extract pincode from address (fallback function)
  const extractPincode = (address) => {
    if (!address) return "";
    const pincodeMatch = address.match(/\b\d{6}\b/);
    return pincodeMatch ? pincodeMatch[0] : "";
  };

  // Start new enquiry flow
  const startNewEnquiry = () => {
    setItems([]);
    setSelectedCompanyId("");
    setSelectedCompany(null);
    setBillTo("");
    setCompanyAddress("");
    setCompanyGstin("");
    setCompanyPincode("");
    setContactPerson("");
    setContactMob("");
    setContactEmail("");
    setContactEmailSame(false);

    setFilteredCompanies([]);
    setShowCompanyDropdown(false);

    setShowItemPopup(false);
    setItemSearchTerm("");
    setSearchResults([]);
    setShowResults(false);
    setSelectedStockItem(null);
    setNewItemCutWidth("");
    setNewItemLength("");
    setNewItemQuantity("1");
    setNewItemBatchCode("");
    setAvailableBatchCodes([]);
    setNewItemCustomerDescription("");
    setNewItemCustomerRequirements("");
    setNewItemSupplierPartNo("");
    setNewItemBrandCode("");
    setNewItemBrand(""); // ADDED reset brand

    setShowCompanyModal(true);
  };

  // Handle item field changes
  function handleItemChange(index, field, value) {
    setItems(prevItems => {
      const updatedItems = [...prevItems];
      let newValue = value;

      if (["cut_width", "length", "quantity"].includes(field)) {
        newValue = parseFloat(value) || 0;
      }

      updatedItems[index] = {
        ...updatedItems[index],
        [field]: newValue
      };

      // Calculate count when width, length, or quantity changes
      if (["cut_width", "length", "quantity"].includes(field)) {
        const width = parseFloat(updatedItems[index].cut_width) || 0;
        const length = parseFloat(updatedItems[index].length) || 0;
        const quantity = parseFloat(updatedItems[index].quantity) || 0;
        updatedItems[index].count = Math.round(width * length * quantity);
      }

      return updatedItems;
    });
  }

  // Add new item using popup
  function addItemViaPopup() {
    setShowItemPopup(true);
  }

  // Remove item
  function removeItem(index) {
    setItems(prevItems => prevItems.filter((_, i) => i !== index));
  }

  // Calculate count (Width × Length × Quantity)
  const calculateCount = (item) => {
    const width = parseFloat(item.cut_width) || 0;
    const length = parseFloat(item.length) || 0;
    const quantity = parseFloat(item.quantity) || 0;
    return Math.round(width * length * quantity);
  };

  // Calculate all totals
  const calculateTotals = () => {
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
    const totalCount = items.reduce((sum, item) => sum + calculateCount(item), 0);

    return {
      totalItems: totalItems,
      totalQuantity: parseFloat(totalQuantity.toFixed(2)),
      totalCount: totalCount
    };
  };

  // Export to PDF
  async function exportPdf() {
    if (!enquiryRef.current) {
      alert("Enquiry content not found!");
      return;
    }

    try {
      const element = enquiryRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`enquiry-${billTo.replace(/\s+/g, '-')}-${dayjs().format('YYYY-MM-DD')}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF. See console for details.");
    }
  }

  // =============== UPDATED: Save enquiry to backend ===============
  async function saveEnquiry() {
    if (!billTo.trim()) {
      alert("Please enter Company Name!");
      return;
    }

    if (items.length === 0) {
      alert("Please add at least one item!");
      return;
    }

    // Check all items have names
    if (items.some(item => !item.item_name.trim())) {
      alert("Please add item name for all items!");
      return;
    }

    setSaving(true);

    const totals = calculateTotals();

    // Prepare items - ADDED brand field
    const preparedItems = items.map(item => {
      return {
        item_name: item.item_name || '',
        hsn_sac: item.hsn_sac || '',
        supplier_part_no: item.supplier_part_no || '',
        description: item.description || '',
        brand: item.brand || '', // ADDED brand field
        cut_width: parseFloat(item.cut_width) || 1,
        length: parseFloat(item.length) || 1,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit || 'pcs',
        brand_code: item.brand_code || '',
        batch_no: item.batch_no || '',
        customer_description: item.customer_description || '',
        customer_requirements: item.customer_requirements || '',
      };
    });

    // Prepare enquiry data - Match backend model
    const enquiryData = {
      company_name: billTo || '',
      company_address: companyAddress || '',
      company_pincode: companyPincode || '',
      company_gstin: companyGstin || '',
      contact_person: contactPerson || '',
      contact_mobile: contactMob || '',
      contact_email: contactEmail || userInfo.email || '',
      status: 'draft',
      created_by: userInfo.username || 'User',
      updated_by: userInfo.username || 'User',
      items: preparedItems
    };

    // Add company_id if available and valid
    if (selectedCompanyId && selectedCompanyId !== "" && !isNaN(parseInt(selectedCompanyId))) {
      enquiryData.company_id = parseInt(selectedCompanyId);
    }

    try {
      // Use fetch instead of axios to avoid CORS preflight issues
      const response = await fetch(`${API_BASE}/enquiries/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(enquiryData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

      if (responseData.success) {
        const enquiryNo = responseData.data?.enquiry_number || 'N/A';
        alert(`✅ Enquiry saved successfully!\n\nCompany: ${billTo}\nItems: ${totals.totalItems}\nEnquiry No: ${enquiryNo}`);

        // Refresh data
        await fetchEnquiries();
        await fetchEnquiryCounts();

        // Close ALL modals first
        setShowPreviewModal(false);
        setShowItemsModal(false);
        setShowCompanyModal(false);
        setShowItemPopup(false);

        // Reset form data without reopening modal
        setTimeout(() => {
          setItems([]);
          setSelectedCompanyId("");
          setSelectedCompany(null);
          setBillTo("");
          setCompanyAddress("");
          setCompanyGstin("");
          setCompanyPincode("");
          setContactPerson("");
          setContactMob("");
          setContactEmail("");
          setContactEmailSame(false);

          setFilteredCompanies([]);
          setShowCompanyDropdown(false);

          setItemSearchTerm("");
          setSearchResults([]);
          setShowResults(false);
          setSelectedStockItem(null);
          setNewItemCutWidth("");
          setNewItemLength("");
          setNewItemQuantity("1");
          setNewItemBatchCode("");
          setAvailableBatchCodes([]);
          setNewItemCustomerDescription("");
          setNewItemCustomerRequirements("");
          setNewItemSupplierPartNo("");
          setNewItemBrandCode("");
          setNewItemBrand("");
        }, 300);

      } else {
        throw new Error(responseData.message || "Failed to save enquiry");
      }

    } catch (err) {
      console.error("❌ Save enquiry failed:", err);

      let errorMessage = "Failed to save enquiry to backend.";

      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorMessage = "Network error. The backend might not be running or is blocking the request.\n\nTrying to save locally instead...";

        // Save to localStorage as fallback
        const enquiryToSave = {
          ...enquiryData,
          id: Date.now(),
          billTo: billTo,
          contactPerson: contactPerson,
          contactMob: contactMob,
          contactEmail: contactEmail,
          company_pincode: companyPincode,
          totals: totals,
          items: items.map(item => ({
            ...item,
            count: calculateCount(item)
          })),
          date: dayjs().format("YYYY-MM-DD"),
          time: dayjs().format("HH:mm:ss"),
          enquiry_number: `LOCAL-ENQ-${Date.now().toString().slice(-6)}`,
          is_company_user: isCompanyUser,
          raw_items: items
        };

        const saved = localStorage.getItem("savedEnquiries");
        const existingEnquiries = saved ? JSON.parse(saved) : [];
        const updatedEnquiries = [enquiryToSave, ...existingEnquiries];
        localStorage.setItem("savedEnquiries", JSON.stringify(updatedEnquiries));

        loadFromLocalStorage();
        fetchEnquiryCounts();

        // Close ALL modals first
        setShowPreviewModal(false);
        setShowItemsModal(false);
        setShowCompanyModal(false);
        setShowItemPopup(false);

        // Reset form data without reopening modal
        setTimeout(() => {
          setItems([]);
          setSelectedCompanyId("");
          setSelectedCompany(null);
          setBillTo("");
          setCompanyAddress("");
          setCompanyGstin("");
          setCompanyPincode("");
          setContactPerson("");
          setContactMob("");
          setContactEmail("");
          setContactEmailSame(false);

          setFilteredCompanies([]);
          setShowCompanyDropdown(false);

          setItemSearchTerm("");
          setSearchResults([]);
          setShowResults(false);
          setSelectedStockItem(null);
          setNewItemCutWidth("");
          setNewItemLength("");
          setNewItemQuantity("1");
          setNewItemBatchCode("");
          setAvailableBatchCodes([]);
          setNewItemCustomerDescription("");
          setNewItemCustomerRequirements("");
          setNewItemSupplierPartNo("");
          setNewItemBrandCode("");
          setNewItemBrand("");
        }, 300);

        alert("✅ Enquiry saved locally (backend unavailable)");
        return;
      }

      alert(`❌ ${errorMessage}\n\nCheck browser console for details.`);

    } finally {
      setSaving(false);
    }
  }

  // View enquiry details in modal
  function viewEnquiry(enquiry) {
    const parsedEnquiry = { ...enquiry };

    if (enquiry.items && enquiry.items.length > 0) {
      parsedEnquiry.items = enquiry.items;
    } else if (enquiry.raw_items) {
      parsedEnquiry.items = enquiry.raw_items;
    }

    setSelectedEnquiry(parsedEnquiry);
    setShowViewModal(true);
  }

  // Print enquiry
  function printEnquiry(enquiry) {
    const printWindow = window.open('', '_blank');

    const items = enquiry.items || [];
    const companyPincode = enquiry.company_pincode || extractPincode(enquiry.company_address || "");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Enquiry - ${enquiry.enquiry_number || ''}</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
        <style>
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
            .table { font-size: 11px; }
            .summary-table { font-size: 11px; }
          }
          .invoice-header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
          .total-row { font-weight: bold; }
          .table th { background-color: #f8f9fa; font-size: 11px; padding: 5px 8px; }
          .table td { padding: 5px 8px; font-size: 11px; }
          .text-primary { color: #0d6efd !important; }
          .text-danger { color: #dc3545 !important; }
          .text-success { color: #198754 !important; }
          .summary-table th, .summary-table td { padding: 3px 5px; }
          h1 { font-size: 24px; }
          h2 { font-size: 20px; }
          h5 { font-size: 14px; }
          p { font-size: 12px; margin-bottom: 3px; }
          .container { max-width: 100%; }
          .company-logo { max-width: 120px; max-height: 120px; object-fit: contain; }
          .pincode-badge { background-color: #e9ecef; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
          .status-badge { padding: 2px 8px; border-radius: 12px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="container mt-3">
          <div class="invoice-header">
            <div class="row">
              <div class="col-2">
                <img src="${companyLogo}" alt="Company Logo" class="company-logo">
              </div>
              <div class="col-5">
                <h1 class="mb-1">${issuer.name}</h1>
                <p class="mb-1">${issuer.address}</p>
                <p class="mb-1">Phone: ${issuer.phone} | Email: ${issuer.email}</p>
                <p class="mb-1">GSTIN: ${issuer.gstin} | State: ${issuer.stateCode}</p>
              </div>
              <div class="col-5 text-end">
                <h2 class="text-primary mb-2">ENQUIRY</h2>
                ${enquiry.enquiry_number ? `<p class="mb-1"><strong>Enquiry No:</strong> ${enquiry.enquiry_number}</p>` : ''}
                <p class="mb-1"><strong>Date:</strong> ${enquiry.date || 'N/A'}</p>
                <p class="mb-1"><strong>Time:</strong> ${enquiry.time || 'N/A'}</p>
                <p class="mb-0">
                  <span class="status-badge ${enquiry.status === 'draft' ? 'bg-secondary' :
        enquiry.status === 'converted' ? 'bg-success' :
          enquiry.status === 'lost' ? 'bg-danger' : 'bg-secondary'}">
                    ${enquiry.status || 'draft'}
                  </span>
                </p>
              </div>
            </div>
          </div>
          
          <div class="row mb-3">
            <div class="col-6">
              <h5>Company Details:</h5>
              <p class="mb-1"><strong>${enquiry.company_name || enquiry.billTo || 'N/A'}</strong></p>
              <p class="mb-1">${enquiry.company_address || ''}</p>
              ${companyPincode ? `<p class="mb-1">Pincode: <span class="pincode-badge">${companyPincode}</span></p>` : ''}
              <p class="mb-1">GSTIN: ${enquiry.company_gstin || ''}</p>
            </div>
            <div class="col-6">
              <h5>Contact Details:</h5>
              <p class="mb-1"><strong>${enquiry.contact_person || enquiry.contactPerson || 'N/A'}</strong></p>
              <p class="mb-1">Phone: ${enquiry.contact_mobile || enquiry.contactMob || ''}</p>
              <p class="mb-1">Email: ${enquiry.contact_email || enquiry.contactEmail || ''}</p>
            </div>
          </div>
          
          <div class="table-responsive">
            <table class="table table-bordered table-sm">
              <thead class="table-light">
                <tr>
                  <th>#</th>
                  <th>Item Name</th>
                  <th>Brand</th>
                  <th>Brand Code</th>
                  <th>Cut Width (mm)</th>
                  <th>Cut Length (M)</th>
                  <th>Quantity</th>
                  <th>Customer Part No</th>
                  <th>Customer Description</th>
                  <th>Customer Requirements</th>
                  <th>Batch No</th>
                  <th>Count (L×W×Q)</th>
                  <th>UoM</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item, index) => {
            const width = parseFloat(item.cut_width) || 0;
            const length = parseFloat(item.length) || 0;
            const quantity = parseFloat(item.quantity) || 0;
            const count = Math.round(width * length * quantity);

            return `
                    <tr>
                      <td>${index + 1}</td>
                      <td><strong>${item.item_name || 'N/A'}</strong></td>
                      <td>${item.brand || ''}</td>
                      <td>${item.brand_code || ''}</td>
                      <td>${width}</td>
                      <td>${length}</td>
                      <td>${quantity}</td>
                      <td>${item.supplier_part_no || ''}</td>
                      <td>${item.customer_description || ''}</td>
                      <td>${item.customer_requirements || ''}</td>
                      <td>${item.batch_no || ''}</td>
                      <td><strong>${count}</strong></td>
                      <td>${item.unit || 'pcs'}</td>
                    </tr>
                  `;
          }).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="row mt-3">
            <div class="col-8">
              <div class="card border-0">
                <div class="card-body p-2">
                  <h5 class="card-title">Summary</h5>
                  <div class="row">
                    <div class="col-6">
                      <p class="mb-1"><strong>Total Items:</strong> ${items.length}</p>
                      <p class="mb-1"><strong>Total Quantity:</strong> ${items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0).toFixed(2)}</p>
                    </div>
                    <div class="col-6">
                      <p class="mb-1"><strong>Total Count:</strong> ${items.reduce((sum, item) => {
            const width = parseFloat(item.cut_width) || 0;
            const length = parseFloat(item.length) || 0;
            const quantity = parseFloat(item.quantity) || 0;
            return sum + Math.round(width * length * quantity);
          }, 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="no-print mt-3 text-center">
            <button onclick="window.print()" class="btn btn-primary btn-sm me-2">
              <i class="bi bi-printer me-1"></i>Print
            </button>
            <button onclick="window.close()" class="btn btn-secondary btn-sm">
              <i class="bi bi-x-circle me-1"></i>Close
            </button>
          </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  // Navigation functions
  const goToItems = () => {
    if (!billTo.trim()) {
      alert("Please enter Company Name!");
      return;
    }
    setShowCompanyModal(false);
    setShowItemsModal(true);
  };

  const goToPreview = () => {
    if (items.length === 0) {
      alert("Please add at least one item!");
      return;
    }
    if (items.some(item => !item.item_name.trim())) {
      alert("Please add item name for all items!");
      return;
    }
    setShowItemsModal(false);
    setShowPreviewModal(true);
  };

  const goBackToCompany = () => {
    setShowItemsModal(false);
    setShowCompanyModal(true);
  };

  const goBackToItems = () => {
    setShowPreviewModal(false);
    setShowItemsModal(true);
  };

  const cancelEnquiry = () => {
    if (window.confirm("Are you sure you want to cancel this enquiry? All unsaved data will be lost.")) {
      // Close all modals
      setShowCompanyModal(false);
      setShowItemsModal(false);
      setShowPreviewModal(false);
      setShowItemPopup(false);
      setShowViewModal(false);

      // Reset form data
      setTimeout(() => {
        setItems([]);
        setSelectedCompanyId("");
        setSelectedCompany(null);
        setBillTo("");
        setCompanyAddress("");
        setCompanyGstin("");
        setCompanyPincode("");
        setContactPerson("");
        setContactMob("");
        setContactEmail("");
        setContactEmailSame(false);

        setFilteredCompanies([]);
        setShowCompanyDropdown(false);

        setItemSearchTerm("");
        setSearchResults([]);
        setShowResults(false);
        setSelectedStockItem(null);
        setNewItemCutWidth("");
        setNewItemLength("");
        setNewItemQuantity("1");
        setNewItemBatchCode("");
        setAvailableBatchCodes([]);
        setNewItemCustomerDescription("");
        setNewItemCustomerRequirements("");
        setNewItemSupplierPartNo("");
        setNewItemBrandCode("");
        setNewItemBrand("");
      }, 300);
    }
  };

  // Handle search for enquiries
  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  // =============== NEW: Export Functions ===============
  const fetchExportData = async () => {
    setExporting(true);
    try {
      const params = {
        start_date: exportStartDate,
        end_date: exportEndDate,
        status: exportStatus === 'all' ? '' : exportStatus
      };

      const response = await api.get('/enquiries/export', { params });

      if (response.data.success) {
        setExportData(response.data.data || []);

        if (response.data.data.length === 0) {
          alert("No data found for the selected date range and status.");
          return [];
        }

        return response.data.data;
      } else {
        throw new Error(response.data.message || "Failed to fetch export data");
      }
    } catch (err) {
      console.error("Export fetch error:", err);
      alert("Failed to fetch data for export. Using local data as fallback.");

      // Fallback to localStorage
      const saved = localStorage.getItem("savedEnquiries");
      if (saved) {
        try {
          const allEnquiries = JSON.parse(saved);
          const filtered = allEnquiries.filter(enquiry => {
            const enquiryDate = dayjs(enquiry.date || enquiry.createdAt);
            const isDateInRange = enquiryDate.isAfter(dayjs(exportStartDate).subtract(1, 'day')) &&
              enquiryDate.isBefore(dayjs(exportEndDate).add(1, 'day'));
            const isStatusMatch = exportStatus === 'all' || enquiry.status === exportStatus;
            return isDateInRange && isStatusMatch;
          });

          setExportData(filtered);
          return filtered;
        } catch (e) {
          console.error("Error parsing localStorage:", e);
          return [];
        }
      }
      return [];
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async () => {
    const data = await fetchExportData();

    if (data.length === 0) {
      return;
    }

    // Prepare Excel data
    const excelData = data.map((enquiry, index) => {
      const items = enquiry.items || [];
      const totalItems = items.length;
      const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
      const totalCount = items.reduce((sum, item) => {
        const width = parseFloat(item.cut_width) || 0;
        const length = parseFloat(item.length) || 0;
        const quantity = parseFloat(item.quantity) || 0;
        return sum + Math.round(width * length * quantity);
      }, 0);

      return {
        'S.No': index + 1,
        'Enquiry No': enquiry.enquiry_number || enquiry.enquiryNo || 'N/A',
        'Date': enquiry.date || enquiry.createdAt?.split('T')[0] || 'N/A',
        'Time': enquiry.time || enquiry.createdAt?.split('T')[1]?.split('.')[0] || 'N/A',
        'Company Name': enquiry.company_name || enquiry.billTo || 'N/A',
        'Contact Person': enquiry.contact_person || enquiry.contactPerson || 'N/A',
        'Contact Mobile': enquiry.contact_mobile || enquiry.contactMob || 'N/A',
        'Contact Email': enquiry.contact_email || enquiry.contactEmail || 'N/A',
        'Status': enquiry.status || 'draft',
        'Total Items': totalItems,
        'Total Quantity': totalQuantity,
        'Total Count': totalCount,
        'Created By': enquiry.created_by || 'User',
        'Created At': enquiry.createdAt || 'N/A'
      };
    });

    // Create CSV content
    const headers = Object.keys(excelData[0]);
    const csvContent = [
      headers.join(','),
      ...excelData.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `enquiries_${exportStartDate}_to_${exportEndDate}_${exportStatus}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`Exported ${data.length} enquiries to CSV successfully!`);
    setShowExportModal(false);
  };

  const exportToPDF = async () => {
    const data = await fetchExportData();

    if (data.length === 0) {
      return;
    }

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      let yPos = 20;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Add header
      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Enquiries Report', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Date Range: ${exportStartDate} to ${exportEndDate}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
      pdf.text(`Status: ${exportStatus === 'all' ? 'All Statuses' : exportStatus}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);

      // Add summary
      pdf.setFontSize(11);
      pdf.text(`Total Enquiries: ${data.length}`, margin, yPos);
      yPos += 10;

      // Create table headers
      const headers = [
        { header: 'S.No', width: 10 },
        { header: 'Enquiry No', width: 30 },
        { header: 'Date', width: 25 },
        { header: 'Company', width: 40 },
        { header: 'Contact', width: 30 },
        { header: 'Items', width: 15 },
        { header: 'Status', width: 20 }
      ];

      const colWidths = headers.map(h => h.width);
      const colPositions = [margin];
      for (let i = 0; i < colWidths.length - 1; i++) {
        colPositions.push(colPositions[i] + colWidths[i]);
      }

      // Draw table headers
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
      pdf.setTextColor(0, 0, 0);
      pdf.setFont(undefined, 'bold');

      headers.forEach((header, index) => {
        pdf.text(header.header, colPositions[index], yPos + 7);
      });

      yPos += 12;
      pdf.setFont(undefined, 'normal');

      // Add table rows
      data.forEach((enquiry, index) => {
        // Check if we need a new page
        if (yPos > pageHeight - 20) {
          pdf.addPage();
          yPos = 20;

          // Redraw headers on new page
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
          pdf.setTextColor(0, 0, 0);
          pdf.setFont(undefined, 'bold');

          headers.forEach((header, i) => {
            pdf.text(header.header, colPositions[i], yPos + 7);
          });

          yPos += 12;
          pdf.setFont(undefined, 'normal');
        }

        const items = enquiry.items || [];
        const totalItems = items.length;

        const rowData = [
          (index + 1).toString(),
          enquiry.enquiry_number || enquiry.enquiryNo || 'N/A',
          enquiry.date || enquiry.createdAt?.split('T')[0] || 'N/A',
          (enquiry.company_name || enquiry.billTo || 'N/A').substring(0, 20),
          (enquiry.contact_person || enquiry.contactPerson || 'N/A').substring(0, 15),
          totalItems.toString(),
          enquiry.status || 'draft'
        ];

        // Set status color
        if (enquiry.status === 'converted') {
          pdf.setTextColor(0, 128, 0);
        } else if (enquiry.status === 'lost') {
          pdf.setTextColor(255, 0, 0);
        } else {
          pdf.setTextColor(0, 0, 0);
        }

        rowData.forEach((cell, cellIndex) => {
          pdf.text(cell, colPositions[cellIndex], yPos + 7);
        });

        pdf.setTextColor(0, 0, 0);
        yPos += 10;
      });

      // Add footer
      yPos += 10;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Report generated on: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`, pageWidth / 2, yPos, { align: 'center' });

      // Save PDF
      pdf.save(`enquiries_report_${exportStartDate}_to_${exportEndDate}.pdf`);

      alert(`Exported ${data.length} enquiries to PDF successfully!`);
      setShowExportModal(false);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export PDF. Please try again.");
    }
  };

  const totals = calculateTotals();

  return (
    <div className="container-fluid py-4">
      {/* Mobile Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          .container-fluid {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          
          .mobile-stack {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          
          .mobile-full-width {
            width: 100% !important;
          }
          
          .mobile-btn-group {
            display: flex;
            flex-direction: column;
            width: 100%;
            gap: 8px;
          }
          
          .mobile-btn-group .btn {
            width: 100%;
            margin: 0 !important;
          }
          
          .mobile-table {
            display: block;
            overflow-x: auto;
            white-space: nowrap;
            -webkit-overflow-scrolling: touch;
          }
          
          .mobile-hide {
            display: none !important;
          }
          
          .mobile-card {
            margin-bottom: 12px;
            border-radius: 8px;
          }
          
          .mobile-pagination {
            flex-direction: column;
            gap: 12px;
            align-items: center;
          }
          
          .modal-dialog {
            margin: 10px !important;
            max-width: calc(100% - 20px) !important;
          }
          
          .modal-body {
            padding: 16px !important;
          }
          
          .mobile-grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          
          .mobile-text-small {
            font-size: 12px !important;
          }
          
          .mobile-badge-stack {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
          }
          
          .mobile-stat-card {
            margin-bottom: 8px;
          }
          
          .mobile-row {
            flex-direction: column;
          }
          
          .mobile-row > [class*="col-"] {
            width: 100%;
            margin-bottom: 8px;
          }
          
          .mobile-search-container {
            width: 100%;
            margin-top: 8px;
          }
          
          .mobile-search-input {
            width: 100% !important;
          }
          
          .mobile-export-buttons {
            flex-direction: column;
            width: 100%;
          }
          
          .mobile-export-buttons .btn {
            width: 100%;
            margin: 0 !important;
          }
          
          .mobile-invoice-header {
            flex-direction: column;
            text-align: center;
          }
          
          .mobile-invoice-header .col-2,
          .mobile-invoice-header .col-5,
          .mobile-invoice-header .col-5 {
            width: 100%;
            text-align: center !important;
          }
          
          .mobile-invoice-header img {
            margin: 0 auto 12px;
          }
          
          .mobile-quick-summary {
            flex-direction: column;
          }
          
          .mobile-quick-summary > div {
            width: 100%;
            margin-bottom: 8px;
          }
          
          .mobile-filter-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          
          .mobile-filter-buttons .btn {
            width: 100%;
          }
        }
        
        @media (max-width: 576px) {
          h1.h2 {
            font-size: 1.5rem !important;
          }
          
          .mobile-grid-2 {
            grid-template-columns: 1fr;
          }
          
          .mobile-filter-buttons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Header with New Enquiry Button */}
      <div className="d-flex justify-content-between align-items-center mb-4 mobile-stack">
        <div className="mobile-full-width">
          <h1 className="h2 mb-1">Enquiry Management</h1>
          <p className="text-muted mb-0 mobile-text-small">
            {isCompanyUser ? "Create enquiries for your company" : "Create, manage, and track your customer enquiries"}
          </p>
        </div>
        <div className="d-flex gap-2 mobile-full-width mobile-btn-group">
          {/* NEW: Export Button */}
          <button
            className="btn btn-warning mobile-full-width"
            onClick={() => setShowExportModal(true)}
          >
            <i className="bi bi-download me-2"></i>Export
          </button>
          <button
            className="btn btn-primary mobile-full-width"
            onClick={startNewEnquiry}
          >
            <i className="bi bi-plus-circle me-2"></i>New Enquiry
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="row mb-4">
        <div className="col-12 mb-3">
          <div className="card mobile-card">
            <div className="card-body p-3">
              <h6 className="card-title mb-3">Enquiry Overview</h6>
              <div className="row mobile-grid-2">
                <div className="col-md mb-2">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white me-3" style={{ width: '40px', height: '40px' }}>
                      <i className="bi bi-question-circle"></i>
                    </div>
                    <div>
                      <div className="text-muted small">Total Enquiries</div>
                      <div className="h4 mb-0">{enquiryCounts.all}</div>
                    </div>
                  </div>
                </div>
                <div className="col-md mb-2">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white me-3" style={{ width: '40px', height: '40px' }}>
                      <i className="bi bi-file-earmark"></i>
                    </div>
                    <div>
                      <div className="text-muted small">Draft</div>
                      <div className="h4 mb-0">{enquiryCounts.draft}</div>
                    </div>
                  </div>
                </div>
                <div className="col-md mb-2">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-success d-flex align-items-center justify-content-center text-white me-3" style={{ width: '40px', height: '40px' }}>
                      <i className="bi bi-check-circle"></i>
                    </div>
                    <div>
                      <div className="text-muted small">Converted</div>
                      <div className="h4 mb-0">{enquiryCounts.converted}</div>
                    </div>
                  </div>
                </div>
                <div className="col-md mb-2">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-danger d-flex align-items-center justify-content-center text-white me-3" style={{ width: '40px', height: '40px' }}>
                      <i className="bi bi-x-circle"></i>
                    </div>
                    <div>
                      <div className="text-muted small">Lost</div>
                      <div className="h4 mb-0">{enquiryCounts.lost}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Export Modal */}
      {showExportModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-warning text-white">
                <h5 className="modal-title">
                  <i className="bi bi-download me-2"></i>Export Enquiries
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowExportModal(false)}></button>
              </div>

              <div className="modal-body">
                <div className="alert alert-info mb-3 mobile-text-small">
                  <i className="bi bi-info-circle me-2"></i>
                  Select date range and status to export enquiries. Data will be exported in CSV or PDF format.
                </div>

                <div className="row mb-3 mobile-row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Start Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        max={exportEndDate}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">End Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        min={exportStartDate}
                        max={dayjs().format('YYYY-MM-DD')}
                      />
                    </div>
                  </div>
                </div>

                <div className="row mb-4">
                  <div className="col-md-12">
                    <label className="form-label">Status Filter</label>
                    <div className="mobile-filter-buttons">
                      {['all', 'draft', 'converted', 'lost'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`btn ${exportStatus === status ? 'btn-primary' : 'btn-outline-primary'}`}
                          onClick={() => setExportStatus(status)}
                        >
                          {status === 'all' ? 'All Statuses' :
                            status === 'draft' ? 'Draft' :
                              status === 'converted' ? 'Converted' : 'Lost'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-12">
                    <div className="card">
                      <div className="card-body">
                        <h6 className="card-title">Export Summary</h6>
                        <div className="row mobile-row">
                          <div className="col-md-4">
                            <div className="mb-2">
                              <strong>Date Range:</strong>
                              <div className="text-muted mobile-text-small">{exportStartDate} to {exportEndDate}</div>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-2">
                              <strong>Status:</strong>
                              <div className="text-muted mobile-text-small">
                                {exportStatus === 'all' ? 'All Statuses' :
                                  exportStatus === 'draft' ? 'Draft' :
                                    exportStatus === 'converted' ? 'Converted' : 'Lost'}
                              </div>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-2">
                              <strong>Days:</strong>
                              <div className="text-muted mobile-text-small">
                                {dayjs(exportEndDate).diff(dayjs(exportStartDate), 'day') + 1} days
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer mobile-btn-group">
                <button type="button" className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                  <i className="bi bi-x-circle me-1"></i>Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={exportToExcel}
                  disabled={exporting}
                >
                  {exporting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-file-earmark-excel me-1"></i>Export to Excel
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={exportToPDF}
                  disabled={exporting}
                >
                  {exporting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-file-pdf me-1"></i>Export to PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Details Modal */}
      {showCompanyModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  Step 1: Company Details
                  {isCompanyUser && <span className="badge bg-info ms-2">Company User</span>}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={cancelEnquiry}></button>
              </div>

              <div className="modal-body">
                {/* Progress Steps - Mobile Optimized */}
                <div className="d-flex justify-content-between align-items-center mb-4 mobile-stack">
                  <div className={`d-flex align-items-center ${billTo.trim() ? 'text-success' : ''}`}>
                    <div className={`rounded-circle ${billTo.trim() ? 'bg-success' : 'bg-primary'} text-white d-flex align-items-center justify-content-center`} style={{ width: '30px', height: '30px' }}>
                      {billTo.trim() ? <i className="bi bi-check"></i> : '1'}
                    </div>
                    <span className="ms-2 mobile-text-small">Company</span>
                  </div>
                  <div className="flex-grow-1 border-top mx-2 mobile-hide"></div>
                  <div className="d-flex align-items-center text-muted">
                    <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>2</div>
                    <span className="ms-2 mobile-text-small">Items</span>
                  </div>
                  <div className="flex-grow-1 border-top mx-2 mobile-hide"></div>
                  <div className="d-flex align-items-center text-muted">
                    <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>3</div>
                    <span className="ms-2 mobile-text-small">Preview</span>
                  </div>
                </div>

                {/* Company User Notice */}
                {isCompanyUser && companyUserDetails && (
                  <div className="alert alert-info mb-3 mobile-text-small">
                    <i className="bi bi-info-circle me-2"></i>
                    Your company details have been auto-filled from your account.
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label">
                    Company Name
                    {isCompanyUser && <span className="text-muted mobile-text-small"> (Auto-filled)</span>}
                  </label>
                  <div className="position-relative">
                    <input
                      type="text"
                      className="form-control"
                      placeholder={isCompanyUser && companyUserDetails ? "Your company is auto-selected" : "Type company name or contact..."}
                      value={billTo}
                      onChange={(e) => handleBillToSearch(e.target.value)}
                      onFocus={() => filteredCompanies.length > 0 && setShowCompanyDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                      readOnly={isCompanyUser && companyUserDetails}
                      style={isCompanyUser && companyUserDetails ? { backgroundColor: '#f8f9fa' } : {}}
                    />

                    {showCompanyDropdown && filteredCompanies.length > 0 && (
                      <div className="position-absolute w-100 bg-white border rounded shadow-sm" style={{ zIndex: 1060, maxHeight: '200px', overflowY: 'auto' }}>
                        {filteredCompanies.map((company, index) => (
                          <div
                            key={company.id || index}
                            className={`p-2 border-bottom ${selectedCompanyId === (company.id || company.ID)?.toString() ? 'bg-light' : ''}`}
                            style={{ cursor: 'pointer' }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectCompanyFromSearch(company);
                            }}
                          >
                            <div className="fw-bold mobile-text-small">{company.companyName || company.company_name}</div>
                            <div className="text-muted small mobile-text-small">
                              {company.customerName || company.customer_name} • {company.customerMobile || company.customer_mobile}
                            </div>
                            {(company.pinCode || company.pin_code) && (
                              <div className="text-muted small mt-1 mobile-badge-stack">
                                <span className="badge bg-info text-white me-1">Pincode: {company.pinCode || company.pin_code}</span>
                                {company.gstNumber || company.gst_number ? (
                                  <span className="badge bg-secondary">GST: {company.gstNumber || company.gst_number}</span>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {loadingCompanies && <div className="alert alert-info mt-2 py-2 mobile-text-small">Loading companies...</div>}
                  {companyError && <div className="alert alert-warning mt-2 py-2 mobile-text-small">{companyError}</div>}
                </div>

                <div className="row mobile-row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Contact Person</label>
                      <input
                        type="text"
                        className="form-control"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        readOnly={isCompanyUser && companyUserDetails}
                        style={isCompanyUser && companyUserDetails ? { backgroundColor: '#f8f9fa' } : {}}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Contact Mobile</label>
                      <input
                        type="text"
                        className="form-control"
                        value={contactMob}
                        onChange={(e) => handleContactMobChange(e.target.value)}
                        placeholder="Type mobile to auto-fill"
                        maxLength="10"
                        readOnly={isCompanyUser && companyUserDetails}
                        style={isCompanyUser && companyUserDetails ? { backgroundColor: '#f8f9fa' } : {}}
                      />
                    </div>
                  </div>
                </div>

                <div className="row mobile-row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Company Address</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        readOnly={isCompanyUser && companyUserDetails}
                        style={isCompanyUser && companyUserDetails ? { backgroundColor: '#f8f9fa' } : {}}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Pincode</label>
                      <input
                        type="text"
                        className="form-control"
                        value={companyPincode}
                        onChange={(e) => setCompanyPincode(e.target.value)}
                        placeholder="Enter pincode"
                        readOnly={isCompanyUser && companyUserDetails}
                        style={isCompanyUser && companyUserDetails ? { backgroundColor: '#f8f9fa' } : {}}
                      />
                      {!isCompanyUser && extractPincode(companyAddress) && companyPincode !== extractPincode(companyAddress) && (
                        <div className="form-text text-info mobile-text-small">
                          <i className="bi bi-info-circle me-1"></i>
                          Found pincode: {extractPincode(companyAddress)}.
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-info ms-2"
                            onClick={() => setCompanyPincode(extractPincode(companyAddress))}
                          >
                            Copy
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="row mobile-row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Company GSTIN</label>
                      <input
                        type="text"
                        className="form-control"
                        value={companyGstin}
                        onChange={(e) => setCompanyGstin(e.target.value)}
                        placeholder="Enter GST number"
                        readOnly={isCompanyUser && companyUserDetails}
                        style={isCompanyUser && companyUserDetails ? { backgroundColor: '#f8f9fa' } : {}}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Contact Email</label>
                      <div className="input-group">
                        <input
                          type="email"
                          className="form-control"
                          value={contactEmail}
                          onChange={(e) => {
                            setContactEmail(e.target.value);
                            if (e.target.value !== issuer.email) {
                              setContactEmailSame(false);
                            }
                          }}
                          readOnly={isCompanyUser && companyUserDetails}
                          style={isCompanyUser && companyUserDetails ? { backgroundColor: '#f8f9fa' } : {}}
                        />
                        <div className="input-group-text">
                          <input
                            className="form-check-input me-1"
                            type="checkbox"
                            id="sameEmail"
                            checked={contactEmailSame}
                            onChange={(e) => setContactEmailSame(e.target.checked)}
                            disabled={isCompanyUser && companyUserDetails}
                          />
                          <label className="form-check-label small" htmlFor="sameEmail">
                            Use issuer email
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer mobile-btn-group">
                  <button type="button" className="btn btn-secondary" onClick={cancelEnquiry}>
                    <i className="bi bi-x-circle me-1"></i>Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={goToItems} disabled={!billTo.trim()}>
                    Next: Add Items <i className="bi bi-arrow-right ms-1"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items Modal */}
      {showItemsModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">Step 2: Add Items</h5>
                <button type="button" className="btn-close btn-close-white" onClick={cancelEnquiry}></button>
              </div>

              <div className="modal-body">
                {/* Progress Steps - Mobile Optimized */}
                <div className="d-flex justify-content-between align-items-center mb-4 mobile-stack">
                  <div className="d-flex align-items-center text-success">
                    <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>
                      <i className="bi bi-check"></i>
                    </div>
                    <span className="ms-2 mobile-text-small">Company</span>
                  </div>
                  <div className="flex-grow-1 border-top mx-2 mobile-hide"></div>
                  <div className="d-flex align-items-center text-primary">
                    <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>2</div>
                    <span className="ms-2 mobile-text-small">Items</span>
                  </div>
                  <div className="flex-grow-1 border-top mx-2 mobile-hide"></div>
                  <div className="d-flex align-items-center text-muted">
                    <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>3</div>
                    <span className="ms-2 mobile-text-small">Preview</span>
                  </div>
                </div>

                {/* Company Info Summary Card */}
                <div className="card mb-4 border-info mobile-card">
                  <div className="card-header bg-info text-white py-2">
                    <h6 className="mb-0"><i className="bi bi-building me-2"></i>Company Information</h6>
                  </div>
                  <div className="card-body py-3">
                    <div className="row mobile-row">
                      <div className="col-md-4">
                        <div className="mb-2">
                          <strong>Company:</strong>
                          <div className="text-muted mobile-text-small">{billTo || 'Not specified'}</div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mb-2">
                          <strong>Contact:</strong>
                          <div className="text-muted mobile-text-small">{contactPerson || 'Not specified'}</div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mb-2">
                          <strong>Mobile:</strong>
                          <div className="text-muted mobile-text-small">{contactMob || 'Not specified'}</div>
                        </div>
                      </div>
                    </div>
                    <div className="row mobile-row">
                      <div className="col-md-8">
                        <div className="mb-2">
                          <strong>Address:</strong>
                          <div className="text-muted mobile-text-small">{companyAddress || 'Not specified'}</div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mb-2">
                          <strong>Pincode:</strong>
                          <div className="text-muted mobile-text-small">{companyPincode || 'Not specified'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Section */}
                <div className="card mb-4 mobile-card">
                  <div className="card-header bg-light">
                    <div className="d-flex justify-content-between align-items-center mobile-stack">
                      <h6 className="mb-0">Items List {items.length > 0 && <span className="badge bg-primary ms-2">{items.length} items</span>}</h6>
                      <button className="btn btn-sm btn-success mobile-full-width mt-2" onClick={addItemViaPopup}>
                        <i className="bi bi-plus-circle me-1"></i>Add Item
                      </button>
                    </div>
                  </div>
                  <div className="card-body p-0">
                    {items.length === 0 ? (
                      <div className="text-center py-5">
                        <i className="bi bi-box display-1 text-muted mb-3"></i>
                        <h5 className="text-muted">No items added</h5>
                        <p className="text-muted mobile-text-small">Click "Add Item" to start adding items to your enquiry</p>
                      </div>
                    ) : (
                      <div className="mobile-table">
                        <table className="table table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th width="50">#</th>
                              <th>Item Name</th>
                              <th width="120">Brand</th>
                              <th width="120">Brand Code</th>
                              <th width="120">Part No</th>
                              <th width="80">Width</th>
                              <th width="80">Length</th>
                              <th width="80">Quantity</th>
                              <th width="100">Count</th>
                              <th width="80">Unit</th>
                              <th width="80">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, index) => (
                              <tr key={item.id}>
                                <td>{index + 1}</td>
                                <td>
                                  <div className="fw-bold mobile-text-small">{item.item_name}</div>
                                  <div className="text-muted small">{item.customer_description?.substring(0, 20) || item.description?.substring(0, 20)}...</div>
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.brand}
                                    onChange={(e) => handleItemChange(index, "brand", e.target.value)}
                                    placeholder="Brand"
                                  />
                                </td>
                                <td>{item.brand_code || ''}</td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.supplier_part_no}
                                    onChange={(e) => handleItemChange(index, "supplier_part_no", e.target.value)}
                                    placeholder="Part No"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    min="1"
                                    step="0.1"
                                    value={item.cut_width}
                                    onChange={(e) => handleItemChange(index, "cut_width", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    min="1"
                                    step="0.1"
                                    value={item.length}
                                    onChange={(e) => handleItemChange(index, "length", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                    placeholder="Qty"
                                  />
                                </td>
                                <td className="text-center">
                                  <strong>{calculateCount(item)}</strong>
                                  <div className="text-muted small mobile-text-small">
                                    {item.cut_width}×{item.length}×{item.quantity}
                                  </div>
                                </td>
                                <td>{item.unit}</td>
                                <td>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => removeItem(index)}
                                    title="Delete"
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="row mobile-row">
                  <div className="col-md-4">
                    <div className="card mobile-card">
                      <div className="card-body">
                        <h6 className="card-title">Quick Summary</h6>
                        <div className="d-flex justify-content-between mb-2">
                          <span className="mobile-text-small">Items:</span>
                          <strong className="mobile-text-small">{totals.totalItems}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span className="mobile-text-small">Total Quantity:</span>
                          <strong className="mobile-text-small">{totals.totalQuantity}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span className="mobile-text-small">Total Count:</span>
                          <strong className="mobile-text-small">{totals.totalCount}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer mobile-btn-group">
                  <button type="button" className="btn btn-secondary" onClick={goBackToCompany}>
                    <i className="bi bi-arrow-left me-1"></i>Back to Company
                  </button>
                  <button type="button" className="btn btn-primary" onClick={goToPreview} disabled={items.length === 0 || items.some(item => !item.item_name.trim())}>
                    Next: Preview <i className="bi bi-arrow-right ms-1"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Selection Popup Modal - ADDED brand field */}
      {showItemPopup && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">Add Item from Stock</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowItemPopup(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Search Stock Items</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by item name, brand code, or description..."
                    value={itemSearchTerm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setItemSearchTerm(value);
                      if (value.trim().length > 1) {
                        const searchTerm = value.toLowerCase();
                        const filtered = stockItems.filter(item =>
                          item["Item Name"]?.toLowerCase().includes(searchTerm) ||
                          item["Brand Code"]?.toLowerCase().includes(searchTerm) ||
                          item["Brand Description"]?.toLowerCase().includes(searchTerm)
                        ).slice(0, 10);
                        setSearchResults(filtered);
                        setShowResults(true);
                      } else {
                        setSearchResults([]);
                        setShowResults(false);
                      }
                    }}
                  />

                  {showResults && searchResults.length > 0 && (
                    <div className="border rounded mt-1 bg-white" style={{ maxHeight: '300px', overflowY: 'auto', zIndex: 1070 }}>
                      {searchResults.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className={`p-3 border-bottom ${selectedStockItem?.id === item.id ? 'bg-light' : ''}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedStockItem(item);
                            setItemSearchTerm(item["Item Name"] || "");
                            setNewItemBrandCode(item["Brand Code"] || "");
                            setNewItemBrand(item["Brand"] || ""); // ADDED brand
                            setShowResults(false);
                            const allBatchCodes = stockItems
                              .filter(stockItem => stockItem["Brand Code"] === item["Brand Code"])
                              .map(stockItem => stockItem["Batch Code"])
                              .filter(Boolean);
                            setAvailableBatchCodes(Array.from(new Set(allBatchCodes)));
                            setNewItemSupplierPartNo(item["Brand Code"] || "");
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-start mb-2 mobile-stack">
                            <div>
                              <div className="fw-bold mb-1 mobile-text-small">{item["Item Name"]}</div>
                              <div className="mb-1">
                                <span className="badge bg-primary me-1">Brand</span>
                                <strong className="mobile-text-small">{item["Brand"] || "N/A"}</strong>
                              </div>
                              <div className="mb-1">
                                <span className="badge bg-secondary me-1">Code</span>
                                <strong className="text-dark mobile-text-small">{item["Brand Code"]}</strong>
                              </div>
                            </div>
                          </div>

                          {item["Brand Description"] && (
                            <div className="small text-muted mobile-text-small" style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>
                              <span className="badge bg-light text-dark me-1"> Brand Description</span>
                              {item["Brand Description"]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedStockItem && (
                  <div className="card mt-3 mobile-card">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">Item Details</h6>
                    </div>
                    <div className="card-body">
                      <div className="row mobile-row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Item Name</label>
                            <input type="text" className="form-control" value={selectedStockItem["Item Name"] || ""} readOnly />
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="mb-3">
                            <label className="form-label">Brand</label>
                            <input
                              type="text"
                              className="form-control"
                              value={newItemBrand}
                              onChange={(e) => setNewItemBrand(e.target.value)}
                              placeholder="Brand"
                            />
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="mb-3">
                            <label className="form-label">Brand Code</label>
                            <input type="text" className="form-control" value={selectedStockItem["Brand Code"] || ""} readOnly />
                          </div>
                        </div>
                      </div>

                      <div className="row mobile-row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">HSN/SAC Code</label>
                            <input
                              type="text"
                              className="form-control"
                              value={selectedStockItem["HSN"] || ""}
                              placeholder="HSN/SAC"
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Batch Code</label>
                            <select className="form-select" value={newItemBatchCode} onChange={(e) => setNewItemBatchCode(e.target.value)}>
                              <option value="">-- Select --</option>
                              {availableBatchCodes.map((code, idx) => (
                                <option key={idx} value={code}>{code}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="row mobile-row">
                        <div className="col-md-4">
                          <div className="mb-3">
                            <label className="form-label">Customer Part No</label>
                            <input
                              type="text"
                              className="form-control"
                              value={newItemSupplierPartNo}
                              onChange={(e) => setNewItemSupplierPartNo(e.target.value)}
                              placeholder="Supplier part number..."
                            />
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="mb-3">
                            <label className="form-label">Unit</label>
                            <input type="text" className="form-control" value={selectedStockItem["Unit"] || "pcs"} readOnly />
                          </div>
                        </div>
                      </div>

                      <div className="row mobile-row">
                        <div className="col-md-4">
                          <div className="mb-3">
                            <label className="form-label">Cut Width (mm)</label>
                            <input
                              type="number"
                              className="form-control"
                              step="0.1"
                              value={newItemCutWidth}
                              onChange={(e) => setNewItemCutWidth(e.target.value)}
                              placeholder="Width"
                            />
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="mb-3">
                            <label className="form-label">Cut Length (M)</label>
                            <input
                              type="number"
                              className="form-control"
                              step="0.1"
                              value={newItemLength}
                              onChange={(e) => setNewItemLength(e.target.value)}
                              placeholder="Length"
                            />
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="mb-3">
                            <label className="form-label">Quantity</label>
                            <input
                              type="number"
                              className="form-control"
                              min="1"
                              value={newItemQuantity}
                              onChange={(e) => setNewItemQuantity(e.target.value)}
                              placeholder="Enter quantity"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="row mobile-row">
                        <div className="col-md-12">
                          <div className="mb-3">
                            <label className="form-label">Customer Description</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={newItemCustomerDescription}
                              onChange={(e) => setNewItemCustomerDescription(e.target.value)}
                              placeholder="Enter customer description here..."
                            />
                          </div>
                        </div>
                      </div>

                      <div className="row mobile-row">
                        <div className="col-md-12">
                          <div className="mb-3">
                            <label className="form-label">Customer Requirements</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={newItemCustomerRequirements}
                              onChange={(e) => setNewItemCustomerRequirements(e.target.value)}
                              placeholder="Enter customer requirements here..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="card-footer">
                      <div className="d-flex justify-content-end gap-2 mobile-btn-group">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowItemPopup(false)}>
                          <i className="bi bi-x-circle me-1"></i>Cancel
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => {
                          if (!selectedStockItem) {
                            alert("Please select an item first!");
                            return;
                          }

                          const width = parseFloat(newItemCutWidth) || parseFloat(selectedStockItem["Width"]) || 1;
                          const length = parseFloat(newItemLength) || parseFloat(selectedStockItem["Length"]) || 1;
                          const quantity = parseFloat(newItemQuantity) || 1;
                          const count = Math.round(width * length * quantity);

                          const newItem = {
                            id: idRef.current + 1,
                            item_name: selectedStockItem["Item Name"] || "",
                            hsn_sac: selectedStockItem["HSN"] || "",
                            supplier_part_no: newItemSupplierPartNo || "",
                            description: selectedStockItem["Brand Description"] || "",
                            brand: newItemBrand || selectedStockItem["Brand"] || "", // ADDED brand field
                            cut_width: width,
                            length: length,
                            quantity: quantity,
                            count: count,
                            batch_no: newItemBatchCode || `B-${Date.now().toString().slice(-6)}-${items.length + 1}`,
                            brand_code: newItemBrandCode || selectedStockItem["Brand Code"] || "",
                            unit: selectedStockItem["Unit"] || "pcs",
                            customer_description: newItemCustomerDescription,
                            customer_requirements: newItemCustomerRequirements,
                          };

                          setItems(prev => [...prev, newItem]);
                          idRef.current = idRef.current + 1;
                          setSelectedStockItem(null);
                          setItemSearchTerm("");
                          setNewItemCutWidth("");
                          setNewItemLength("");
                          setNewItemQuantity("1");
                          setNewItemBatchCode("");
                          setNewItemCustomerDescription("");
                          setNewItemCustomerRequirements("");
                          setNewItemSupplierPartNo("");
                          setNewItemBrandCode("");
                          setNewItemBrand(""); // ADDED reset brand
                          setShowItemPopup(false);
                          setShowResults(false);
                        }}>
                          <i className="bi bi-plus-circle me-1"></i>Add to Enquiry
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">Step 3: Preview & Save</h5>
                <button type="button" className="btn-close btn-close-white" onClick={cancelEnquiry}></button>
              </div>
              <div className="modal-body">
                <div ref={enquiryRef}>
                  <div className="container">
                    <div className="invoice-header border-bottom pb-3 mb-3 mobile-invoice-header">
                      <div className="row align-items-center">
                        <div className="col-2 d-flex align-items-center justify-content-center">
                          <img
                            src={companyLogo}
                            alt="Company Logo"
                            className="img-fluid"
                            style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="col-5">
                          <h1 className="mb-1 mobile-text-small">{issuer.name}</h1>
                          <p className="mb-1 mobile-text-small">{issuer.address}</p>
                          <p className="mb-1 mobile-text-small">Phone: {issuer.phone} | Email: {issuer.email}</p>
                          <p className="mb-1 mobile-text-small">GSTIN: {issuer.gstin} | State: {issuer.stateCode}</p>
                        </div>
                        <div className="col-5 text-end">
                          <h2 className="text-primary mb-3">ENQUIRY</h2>
                          <p className="mb-1 mobile-text-small"><strong>Date:</strong> {dayjs().format("YYYY-MM-DD")}</p>
                          <p className="mb-1 mobile-text-small"><strong>Time:</strong> {dayjs().format("HH:mm:ss")}</p>
                          <p className="mb-0">
                            <span className="badge bg-secondary">draft</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="row mb-4 mobile-row">
                      <div className="col-6">
                        <h5>Company Details:</h5>
                        <p className="mb-1 mobile-text-small"><strong>{billTo}</strong></p>
                        <p className="mb-1 mobile-text-small">{companyAddress}</p>
                        {companyPincode && (
                          <p className="mb-1">
                            Pincode: <span className="badge bg-info text-white">{companyPincode}</span>
                          </p>
                        )}
                        <p className="mb-1 mobile-text-small">GSTIN: {companyGstin}</p>
                      </div>
                      <div className="col-6">
                        <h5>Contact Details:</h5>
                        <p className="mb-1 mobile-text-small"><strong>{contactPerson}</strong></p>
                        <p className="mb-1 mobile-text-small">Phone: {contactMob}</p>
                        <p className="mb-1 mobile-text-small">Email: {contactEmail}</p>
                      </div>
                    </div>

                    <div className="mobile-table">
                      <table className="table table-bordered">
                        <thead className="table-light">
                          <tr>
                            <th>#</th>
                            <th>Item Name</th>
                            <th>Brand</th>
                            <th>Brand Code</th>
                            <th>Width (mm)</th>
                            <th>Length (M)</th>
                            <th>Quantity</th>
                            <th>Part No</th>
                            <th>Batch No</th>
                            <th>Count</th>
                            <th>UoM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => {
                            const count = calculateCount(item);
                            return (
                              <tr key={item.id}>
                                <td>{index + 1}</td>
                                <td><strong className="mobile-text-small">{item.item_name}</strong></td>
                                <td>{item.brand || ''}</td>
                                <td>{item.brand_code || ''}</td>
                                <td>{item.cut_width}</td>
                                <td>{item.length}</td>
                                <td>{item.quantity}</td>
                                <td>{item.supplier_part_no}</td>
                                <td>{item.batch_no}</td>
                                <td><strong>{count}</strong><br /><small className="text-muted">{item.cut_width}×{item.length}×{item.quantity}</small></td>
                                <td>{item.unit}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="row mt-4 mobile-row">
                      <div className="col-8">
                        <div className="card border-0 mobile-card">
                          <div className="card-body">
                            <h5 className="card-title">Summary</h5>
                            <div className="row">
                              <div className="col-6">
                                <p className="mb-1 mobile-text-small"><strong>Total Items:</strong> {totals.totalItems}</p>
                                <p className="mb-1 mobile-text-small"><strong>Total Quantity:</strong> {totals.totalQuantity}</p>
                              </div>
                              <div className="col-6">
                                <p className="mb-1 mobile-text-small"><strong>Total Count:</strong> {totals.totalCount}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer mt-3 mobile-btn-group">
                  <button type="button" className="btn btn-secondary" onClick={goBackToItems}>
                    <i className="bi bi-arrow-left me-1"></i>Back to Items
                  </button>
                  <button type="button" className="btn btn-info" onClick={exportPdf}>
                    <i className="bi bi-file-pdf me-1"></i>Export PDF
                  </button>
                  <button type="button" className="btn btn-success" onClick={saveEnquiry} disabled={saving}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-save me-1"></i>Save Enquiry
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-md">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">Delete Enquiry</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="text-center mb-3">
                  <i className="bi bi-exclamation-triangle text-danger display-4"></i>
                </div>
                <h5 className="text-center mb-3">Are you sure you want to delete this enquiry?</h5>
                <p className="text-center text-muted mobile-text-small">
                  This action cannot be undone. All items associated with this enquiry will also be deleted.
                </p>
              </div>
              <div className="modal-footer mobile-btn-group">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => deleteEnquiry(deleteEnquiryId)}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash me-1"></i>
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Enquiry Modal */}
      {showViewModal && selectedEnquiry && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">Enquiry Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowViewModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="container">
                  <div className="invoice-header border-bottom pb-3 mb-3 mobile-invoice-header">
                    <div className="row align-items-center">
                      <div className="col-2 d-flex align-items-center justify-content-center">
                        <img
                          src={companyLogo}
                          alt="Company Logo"
                          className="img-fluid"
                          style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="col-5">
                        <h1 className="mb-1 mobile-text-small">{issuer.name}</h1>
                        <p className="mb-1 mobile-text-small">{issuer.address}</p>
                        <p className="mb-1 mobile-text-small">Phone: {issuer.phone} | Email: {issuer.email}</p>
                        <p className="mb-1 mobile-text-small">GSTIN: {issuer.gstin} | State: {issuer.stateCode}</p>
                      </div>
                      <div className="col-5 text-end">
                        <h2 className="text-info mb-3">ENQUIRY</h2>
                        {selectedEnquiry.enquiry_number && (
                          <p className="mb-1 mobile-text-small"><strong>Enquiry No:</strong> {selectedEnquiry.enquiry_number}</p>
                        )}
                        <p className="mb-1 mobile-text-small"><strong>Date:</strong> {selectedEnquiry.date || 'N/A'}</p>
                        <p className="mb-1 mobile-text-small"><strong>Time:</strong> {selectedEnquiry.time || 'N/A'}</p>
                        <p className="mb-0">
                          <span className={`badge ${selectedEnquiry.status === 'draft' ? 'bg-secondary' :
                              selectedEnquiry.status === 'converted' ? 'bg-success' :
                                selectedEnquiry.status === 'lost' ? 'bg-danger' : 'bg-secondary'
                            }`}>
                            {selectedEnquiry.status || 'draft'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="row mb-4 mobile-row">
                    <div className="col-6">
                      <h5>Company Details:</h5>
                      <p className="mb-1 mobile-text-small"><strong>{selectedEnquiry.company_name || selectedEnquiry.billTo || 'N/A'}</strong></p>
                      <p className="mb-1 mobile-text-small">{selectedEnquiry.company_address || ''}</p>
                      {(selectedEnquiry.company_pincode || extractPincode(selectedEnquiry.company_address || '')) && (
                        <p className="mb-1">
                          Pincode: <span className="badge bg-info text-white">{selectedEnquiry.company_pincode || extractPincode(selectedEnquiry.company_address || '')}</span>
                        </p>
                      )}
                      <p className="mb-1 mobile-text-small">GSTIN: {selectedEnquiry.company_gstin || ''}</p>
                    </div>
                    <div className="col-6">
                      <h5>Contact Details:</h5>
                      <p className="mb-1 mobile-text-small"><strong>{selectedEnquiry.contact_person || selectedEnquiry.contactPerson || 'N/A'}</strong></p>
                      <p className="mb-1 mobile-text-small">Phone: {selectedEnquiry.contact_mobile || selectedEnquiry.contactMob || ''}</p>
                      <p className="mb-1 mobile-text-small">Email: {selectedEnquiry.contact_email || selectedEnquiry.contactEmail || ''}</p>
                    </div>
                  </div>

                  <div className="mobile-table">
                    <table className="table table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Item Name</th>
                          <th>Brand</th>
                          <th>Brand Code</th>
                          <th>Width (mm)</th>
                          <th>Length (M)</th>
                          <th>Quantity</th>
                          <th>Part No</th>
                          <th>Batch No</th>
                          <th>Count</th>
                          <th>UoM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedEnquiry.items || []).map((item, index) => {
                          const width = parseFloat(item.cut_width) || 0;
                          const length = parseFloat(item.length) || 0;
                          const quantity = parseFloat(item.quantity) || 0;
                          const count = Math.round(width * length * quantity);

                          return (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td><strong className="mobile-text-small">{item.item_name || 'N/A'}</strong></td>
                              <td>{item.brand || ''}</td>
                              <td>{item.brand_code || ''}</td>
                              <td>{width}</td>
                              <td>{length}</td>
                              <td>{quantity}</td>
                              <td>{item.supplier_part_no}</td>
                              <td>{item.batch_no}</td>
                              <td><strong>{count}</strong><br /><small className="text-muted">{width}×{length}×{quantity}</small></td>
                              <td>{item.unit || 'pcs'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="row mt-4 mobile-row">
                    <div className="col-8">
                      <div className="card border-0 mobile-card">
                        <div className="card-body">
                          <h5 className="card-title">Summary</h5>
                          <div className="row">
                            <div className="col-6">
                              <p className="mb-1 mobile-text-small"><strong>Total Items:</strong> {(selectedEnquiry.items || []).length}</p>
                              <p className="mb-1 mobile-text-small"><strong>Total Quantity:</strong> {(selectedEnquiry.items || []).reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0).toFixed(2)}</p>
                            </div>
                            <div className="col-6">
                              <p className="mb-1 mobile-text-small"><strong>Total Count:</strong> {(selectedEnquiry.items || []).reduce((sum, item) => {
                                const width = parseFloat(item.cut_width) || 0;
                                const length = parseFloat(item.length) || 0;
                                const quantity = parseFloat(item.quantity) || 0;
                                return sum + Math.round(width * length * quantity);
                              }, 0)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer mobile-btn-group">
                <button type="button" className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                  <i className="bi bi-x-circle me-1"></i>Close
                </button>
                {selectedEnquiry && selectedEnquiry.status !== 'converted' && (
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => convertEnquiryToQuotation(selectedEnquiry)}
                  >
                    <i className="bi bi-arrow-right-square me-1"></i>Convert to Quotation
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    setDeleteEnquiryId(selectedEnquiry.id);
                    setShowDeleteModal(true);
                    setShowViewModal(false);
                  }}
                >
                  <i className="bi bi-trash me-1"></i>Delete
                </button>
                <button type="button" className="btn btn-primary" onClick={() => printEnquiry(selectedEnquiry)}>
                  <i className="bi bi-printer me-1"></i>Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Enquiries Section */}
      <div className="card mobile-card">
        <div className="card-header bg-light">
          <div className="d-flex justify-content-between align-items-center mobile-stack">
            <h5 className="mb-0">
              Saved Enquiries
              <span className="ms-2">
                <span className="badge bg-primary">Total: {totalItems}</span>
              </span>
            </h5>
            <div className="d-flex gap-2 mobile-full-width mobile-stack">
              <input
                type="text"
                className="form-control form-control-sm mobile-full-width"
                style={{ width: '250px' }}
                placeholder="Search enquiries..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searchTerm && (
                <button className="btn btn-sm btn-outline-danger" onClick={resetSearch} title="Clear search">
                  <i className="bi bi-x-circle"></i>
                </button>
              )}
              <button className="btn btn-sm btn-outline-primary" onClick={fetchEnquiries} disabled={loadingEnquiries} title="Refresh">
                <i className="bi bi-arrow-clockwise"></i>
              </button>
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          {loadingEnquiries ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2 text-muted mobile-text-small">Loading enquiries...</p>
            </div>
          ) : savedEnquiries.length > 0 ? (
            <>
              <div className="mobile-table">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Enquiry No</th>
                      <th>Date</th>
                      <th>Company</th>
                      <th>Contact</th>
                      <th>Items</th>
                      <th>Status</th>
                      <th width="180">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedEnquiries.map((enquiry, index) => (
                      <tr key={enquiry.id}>
                        <td>{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                        <td>
                          {enquiry.enquiry_number || enquiry.enquiryNo || 'N/A'}
                        </td>
                        <td>
                          {enquiry.date || enquiry.date}<br />
                          <small className="text-muted">{enquiry.time || enquiry.time}</small>
                        </td>
                        <td>
                          {enquiry.company_name || enquiry.billTo}<br />
                          <small className="text-muted">{enquiry.contact_email || enquiry.contactEmail}</small>
                        </td>
                        <td>
                          {enquiry.contact_person || enquiry.contactPerson}<br />
                          <small className="text-muted">{enquiry.contact_mobile || enquiry.contactMob}</small>
                        </td>
                        <td>
                          {enquiry.total_items || (enquiry.items || []).length} items<br />
                          <small className="text-muted">Qty: {enquiry.total_quantity || enquiry.totals?.totalQuantity || 0}</small>
                        </td>
                        <td>
                          <span className={`badge ${enquiry.status === 'draft' ? 'bg-secondary' :
                            enquiry.status === 'converted' ? 'bg-success' :
                              enquiry.status === 'lost' ? 'bg-danger' : 'bg-secondary'}`}>
                            {enquiry.status || 'draft'}
                          </span>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button
                              className="btn btn-outline-info"
                              onClick={() => viewEnquiry(enquiry)}
                              title="View"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            {enquiry.status !== 'converted' && (
                              <button
                                className="btn btn-outline-success"
                                onClick={() => convertEnquiryToQuotation(enquiry)}
                                title="Convert to Quotation"
                              >
                                <i className="bi bi-arrow-right-square"></i>
                              </button>
                            )}
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => printEnquiry(enquiry)}
                              title="Print"
                            >
                              <i className="bi bi-printer"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top mobile-pagination">
                  <div className="text-muted mobile-text-small">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
                  </div>
                  <nav aria-label="Page navigation">
                    <ul className="pagination pagination-sm mb-0">
                      <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <i className="bi bi-chevron-left"></i>
                        </button>
                      </li>

                      {getPaginationItems().map((pageNum, index) => (
                        <li key={index} className={`page-item ${pageNum === currentPage ? 'active' : ''} ${pageNum === '...' ? 'disabled' : ''}`}>
                          {pageNum === '...' ? (
                            <span className="page-link">...</span>
                          ) : (
                            <button
                              className="page-link"
                              onClick={() => handlePageChange(pageNum)}
                            >
                              {pageNum}
                            </button>
                          )}
                        </li>
                      ))}

                      <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          <i className="bi bi-chevron-right"></i>
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-5">
              <div className="mb-3">
                <i className="bi bi-question-circle display-1 text-muted"></i>
              </div>
              <h5 className="text-muted">No enquiries found</h5>
              <p className="text-muted mobile-text-small">
                {searchTerm ? 'Try a different search term or ' : ''}
                Create your first enquiry to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}