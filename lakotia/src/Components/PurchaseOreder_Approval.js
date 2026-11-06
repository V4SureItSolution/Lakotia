import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { 
  FaEye, FaCheck, FaTimes, FaEdit, FaTrash, FaPlus, 
  FaSearch, FaFilter, FaBuilding, FaUser, FaCalendarAlt,
  FaBox, FaRupeeSign, FaTag, FaBarcode, FaRulerCombined,
  FaComment, FaClipboardCheck, FaHashtag, FaReceipt,
  FaChevronLeft, FaChevronRight, FaTruck, FaCalculator
} from "react-icons/fa";

const API_BASE_URL = `${API_BASE}/purchase-orders`;
const STOCK_API_URL = `${API_BASE}/stock/all`;
const COMPANY_API_URL = `${API_BASE}/company`;


const PurchaseOrderPage = () => {
  const todayDate = new Date().toISOString().slice(0, 10);

  // State declarations
  const [formData, setFormData] = useState({
    po_date: todayDate,
    company_id: "",
    company_name: "",
    company_address: "",
    customer_name: "",
    customer_mobile: "",
    customer_email: "",
    department: "",
    gst_number: "",
    supplier_part_no: "",
    supplier_description: "",
    status: "pending",
    item_name: "",
    brand: "",
    brand_code: "",
    brand_description: "",
    hsn_code: "",
    length: "",
    width: "",
    unit: "PCS",
    buy_price: "",
    quantity: "",
    mrp: "",
  });

  const [stockData, setStockData] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [tempItems, setTempItems] = useState([]);
  const [openPopup, setOpenPopup] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [currentPoId, setCurrentPoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("created_on");
  const [sortOrder, setSortOrder] = useState("desc");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    completed: 0
  });
  
  // New state for approval/rejection remarks
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [pendingActionPO, setPendingActionPO] = useState(null);

  // New state for Complete (Receive) action
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedPOForComplete, setSelectedPOForComplete] = useState(null);
  const [completeReceivingData, setCompleteReceivingData] = useState({});
  const [completeRemarks, setCompleteRemarks] = useState({});
  const [submittingComplete, setSubmittingComplete] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Fetch stock data, companies, and purchase orders
  useEffect(() => {
    fetchStock();
    fetchCompanies();
    fetchPurchaseOrders();
    fetchStats();
  }, [currentPage, itemsPerPage]);

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stats`);
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };

  // Fetch stock items
  const fetchStock = async () => {
    try {
      const res = await axios.get(STOCK_API_URL);
      if (res.data.success) {
        setStockData(res.data.data);
      }
    } catch (err) {
      toast.error("Error loading stock items");
      console.error("Error loading stock:", err);
    }
  };

  // Fetch companies
  const fetchCompanies = async () => {
    try {
      const res = await axios.get(COMPANY_API_URL);
      if (Array.isArray(res.data)) {
        setCompanies(res.data);
      }
    } catch (err) {
      console.error("Error loading companies:", err);
    }
  };

  // Fetch purchase orders with pagination
  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/all`, {
        params: {
          page: currentPage,
          limit: itemsPerPage
        }
      });
      if (res.data.success) {
        setPurchaseOrders(res.data.data);
        setTotalItems(res.data.total || res.data.data.length);
      }
    } catch (err) {
      toast.error("Error loading purchase orders");
      console.error("Error loading purchase orders:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort purchase orders
  const filteredPOs = useCallback(() => {
    let filtered = [...purchaseOrders];

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter(po => {
        if (filterStatus === 'approved') {
          return po.status === 'approved' || po.status === 'partially_received';
        }
        if (filterStatus === 'completed') {
          return po.status === 'completed' || po.status === 'converted_to_grn';
        }
        return po.status === filterStatus;
      });
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(po => 
        po.po_number?.toLowerCase().includes(term) ||
        po.company_name?.toLowerCase().includes(term) ||
        po.customer_name?.toLowerCase().includes(term) ||
        po.supplier_part_no?.toLowerCase().includes(term) ||
        po.customer_mobile?.includes(term) ||
        po.gst_number?.toLowerCase().includes(term) ||
        po.rejection_remarks?.toLowerCase().includes(term)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      if (sortBy === "po_date" || sortBy === "created_on" || sortBy === "approved_date" || sortBy === "delivery_date") {
        aVal = new Date(a[sortBy] || 0);
        bVal = new Date(b[sortBy] || 0);
      } else if (sortBy === "total_amount") {
        aVal = parseFloat(a[sortBy] || 0);
        bVal = parseFloat(b[sortBy] || 0);
      } else {
        aVal = a[sortBy] || "";
        bVal = b[sortBy] || "";
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [purchaseOrders, filterStatus, searchTerm, sortBy, sortOrder]);

  // Handle company search/typing with autocomplete
  const handleCompanyTyping = async (e) => {
    const value = e.target.value;
    setFormData({ 
      ...formData, 
      company_name: value,
      company_id: "",
      company_address: "",
      customer_name: "",
      customer_mobile: "",
      customer_email: "",
      department: "",
      gst_number: ""
    });

    if (!value) {
      setFilteredCompanies([]);
      return;
    }

    // Filter from already loaded companies
    const results = companies.filter(company => 
      company.companyName?.toLowerCase().includes(value.toLowerCase()) ||
      company.customerName?.toLowerCase().includes(value.toLowerCase()) ||
      company.customerMobile?.includes(value) ||
      company.gstNumber?.toLowerCase().includes(value)
    ).slice(0, 10);

    setFilteredCompanies(results);
  };

  // Handle company suggestion selection
  const handleCompanySelect = (company) => {
    setFormData({
      ...formData,
      company_id: company.id,
      company_name: company.companyName,
      company_address: company.companyAddress,
      customer_name: company.customerName,
      customer_mobile: company.customerMobile,
      customer_email: company.customerEmail,
      department: company.department,
      gst_number: company.gstNumber || ""
    });
    setFilteredCompanies([]);
  };

  // Handle item name typing with autocomplete
  const handleItemTyping = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, item_name: value });

    if (!value) {
      setFilteredItems([]);
      return;
    }

    const results = stockData.filter((x) =>
      x["Item Name"]?.toLowerCase().includes(value.toLowerCase()) ||
      x["Brand"]?.toLowerCase().includes(value.toLowerCase()) ||
      x["Brand Description"]?.toLowerCase().includes(value.toLowerCase()) ||
      x["HSN"]?.toLowerCase().includes(value)
    ).slice(0, 10);
    setFilteredItems(results);
  };

  // Handle item suggestion selection
  const handleSuggestionSelect = (item) => {
    // Extract values from the selected item
    const length = parseFloat(item.Length || item.length || 0);
    const width = parseFloat(item.Width || item.width || 0);
    const mrp = parseFloat(item["MRP"] || item.mrp || item["Buy Price"] || item.buy_price || 0);
    
    let buyPrice = mrp;
    
    // Calculate Price/Unit = MRP × Length × Width
    if (length > 0 && width > 0 && mrp > 0) {
      buyPrice = mrp * length * width;
    }
    
    setFormData({
      ...formData,
      item_name: item["Item Name"] || "",
      brand: item.Brand || "",
      brand_code: item["Brand Code"] || item.brand_code || "",
      brand_description: item["Brand Description"] || item.brand_description || "",
      hsn_code: item.HSN || item.hsn_code || "",
      length: length || "",
      width: width || "",
      unit: item.Unit || item.unit || "PCS",
      buy_price: buyPrice.toFixed(2),
      mrp: mrp.toFixed(2),
    });
    setFilteredItems([]);
  };

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    
    // Recalculate buy_price when length, width, or mrp changes
    if (name === 'length' || name === 'width' || name === 'mrp') {
      const length = parseFloat(name === 'length' ? value : formData.length) || 0;
      const width = parseFloat(name === 'width' ? value : formData.width) || 0;
      const mrp = parseFloat(name === 'mrp' ? value : formData.mrp) || 0;
      
      if (length > 0 && width > 0 && mrp > 0) {
        // Price/Unit = MRP × Length × Width
        newFormData.buy_price = (mrp * length * width).toFixed(2);
      } else if (mrp > 0) {
        // If no dimensions, use MRP as buy price
        newFormData.buy_price = mrp.toFixed(2);
      }
    }
    
    setFormData(newFormData);
  };

  // Calculate count for an item: Length × Width × Quantity
  const calculateCount = (length, width, quantity) => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const qty = parseFloat(quantity) || 0;
    
    if (l > 0 && w > 0 && qty > 0) {
      return (l * w * qty).toFixed(2);
    }
    return 0;
  };

  // Calculate price per unit: MRP × Length × Width
  const calculatePricePerUnit = (mrp, length, width) => {
    const m = parseFloat(mrp) || 0;
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    
    if (m > 0 && l > 0 && w > 0) {
      return (m * l * w).toFixed(2);
    }
    return m > 0 ? m.toFixed(2) : "0.00";
  };

  // Add item to temporary list
  const handleAddItem = () => {
    if (!formData.item_name || !formData.quantity || !formData.buy_price) {
      toast.error("Item Name, Quantity, and Buy Price are required!");
      return;
    }

    if (parseFloat(formData.quantity) <= 0 || parseFloat(formData.buy_price) <= 0) {
      toast.error("Quantity and Buy Price must be greater than 0!");
      return;
    }

    // Calculate count and total price
    const length = parseFloat(formData.length) || 0;
    const width = parseFloat(formData.width) || 0;
    const quantity = parseFloat(formData.quantity);
    const buyPrice = parseFloat(formData.buy_price);
    const mrp = parseFloat(formData.mrp) || buyPrice;
    
    let count = 0;
    let totalPrice = buyPrice * quantity;
    
    if (length > 0 && width > 0) {
      // Count = Length × Width × Quantity
      count = length * width * quantity;
    }

    const itemWithId = {
      item_name: formData.item_name,
      brand: formData.brand,
      brand_code: formData.brand_code,
      brand_description: formData.brand_description,
      hsn_code: formData.hsn_code,
      length: formData.length,
      width: formData.width,
      unit: formData.unit,
      quantity: quantity,
      buy_price: buyPrice,
      mrp: mrp,
      count: count,
      total_price: totalPrice,
      id: Date.now() + Math.random(),
    };

    setTempItems([...tempItems, itemWithId]);

    // Reset item-specific fields only
    setFormData({
      ...formData,
      item_name: "",
      brand: "",
      brand_code: "",
      brand_description: "",
      hsn_code: "",
      length: "",
      width: "",
      unit: "PCS",
      buy_price: "",
      quantity: "",
      mrp: "",
    });
  };

  // Remove item from temporary list
  const removeItem = (id) => {
    setTempItems(tempItems.filter(item => item.id !== id));
  };

  // Calculate total amount
  const calculateTotal = useCallback(() => {
    return tempItems.reduce((total, item) => {
      return total + (parseFloat(item.total_price) || 0);
    }, 0);
  }, [tempItems]);

  // Submit purchase order
  const handleSubmitPO = async () => {
    if (tempItems.length === 0) {
      toast.error("No items added!");
      return;
    }

    if (!formData.company_name || !formData.customer_name) {
      toast.error("Company Name and Customer Name are required!");
      return;
    }

    try {
      const itemsToSend = tempItems.map(({ id, ...rest }) => rest);
      const payload = {
        po_date: formData.po_date,
        company_id: formData.company_id,
        company_name: formData.company_name,
        company_address: formData.company_address,
        customer_name: formData.customer_name,
        customer_mobile: formData.customer_mobile,
        customer_email: formData.customer_email,
        department: formData.department,
        gst_number: formData.gst_number || "",
        supplier_part_no: formData.supplier_part_no,
        supplier_description: formData.supplier_description,
        status: formData.status,
        items: itemsToSend,
        total_amount: calculateTotal(),
      };

      if (editMode && currentPoId) {
        // Update existing PO
        await axios.put(`${API_BASE_URL}/update/${currentPoId}`, payload);
        toast.success("Purchase Order Updated Successfully!");
      } else {
        // Create new PO
        await axios.post(`${API_BASE_URL}/create`, payload);
        toast.success("Purchase Order Created Successfully!");
      }

      // Reset form and refresh data
      resetForm();
      fetchPurchaseOrders();
      fetchStats();
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Error saving Purchase Order";
      toast.error(errorMsg);
      console.error(err);
    }
  };

  // Reset form to initial state
  const resetForm = () => {
    setFormData({
      po_date: todayDate,
      company_id: "",
      company_name: "",
      company_address: "",
      customer_name: "",
      customer_mobile: "",
      customer_email: "",
      department: "",
      gst_number: "",
      supplier_part_no: "",
      supplier_description: "",
      status: "pending",
      item_name: "",
      brand: "",
      brand_code: "",
      brand_description: "",
      hsn_code: "",
      length: "",
      width: "",
      unit: "PCS",
      buy_price: "",
      quantity: "",
      mrp: "",
    });
    setTempItems([]);
    setFilteredCompanies([]);
    setFilteredItems([]);
    setEditMode(false);
    setCurrentPoId(null);
    setOpenPopup(false);
  };

  // Handle approval action (without remarks)
  const handleApproveClick = async (po) => {
    if (!window.confirm(`Are you sure you want to approve PO: ${po.po_number}?`)) {
      return;
    }

    try {
      await axios.put(`${API_BASE_URL}/update-status/${po.id}`, {
        status: 'approved'
      });
      
      toast.success("PO Approved Successfully!");
      fetchPurchaseOrders();
      fetchStats();
      if (viewData && viewData.id === po.id) {
        setViewData(null);
      }
    } catch (err) {
      toast.error("Error approving PO");
      console.error(err);
    }
  };

  // Handle rejection action (with remarks)
  const handleRejectClick = (po) => {
    setPendingActionPO(po);
    setRejectionRemarks("");
    setShowRejectionModal(true);
    if (viewData && viewData.id === po.id) {
      setViewData(null);
    }
  };

  // Submit rejection with remarks
  const submitRejection = async () => {
    if (!rejectionRemarks.trim()) {
      toast.error("Please enter rejection remarks");
      return;
    }

    try {
      await axios.put(`${API_BASE_URL}/update-status/${pendingActionPO.id}`, {
        status: 'rejected',
        rejection_remarks: rejectionRemarks
      });
      
      toast.success("PO Rejected Successfully!");
      setShowRejectionModal(false);
      setRejectionRemarks("");
      setPendingActionPO(null);
      fetchPurchaseOrders();
      fetchStats();
    } catch (err) {
      toast.error("Error rejecting PO");
      console.error(err);
    }
  };

  // Handle Complete click - opens modal to input received quantities
  const handleCompleteClick = (po) => {
    setSelectedPOForComplete(po);
    const initialReceivingData = {};
    const initialRemarks = {};
    
    if (po.items) {
      po.items.forEach((item, index) => {
        const deliveredQty = item.delivered_quantity || 0;
        const remainingQty = item.quantity - deliveredQty;
        initialReceivingData[index] = remainingQty > 0 ? remainingQty : 0;
        initialRemarks[index] = "";
      });
    }
    
    setCompleteReceivingData(initialReceivingData);
    setCompleteRemarks(initialRemarks);
    setShowCompleteModal(true);
  };

  // Submit the receipt and generate GRN
  const submitCompleteReceipt = async () => {
    const hasReceipts = Object.values(completeReceivingData).some(qty => qty > 0);
    
    if (!hasReceipts) {
      toast.error("Please enter at least one item quantity to receive");
      return;
    }
    
    setSubmittingComplete(true);
    try {
      const receivedQuantities = selectedPOForComplete.items.map((item, index) => ({
        item_index: index,
        received_quantity: completeReceivingData[index] || 0,
        remarks: completeRemarks[index] || ""
      })).filter(item => item.received_quantity > 0);
      
      const response = await axios.post(`${API_BASE_URL}/receive-items/${selectedPOForComplete.id}`, {
        received_quantities: receivedQuantities
      });
      
      if (response.data.success) {
        toast.success(response.data.message || "Items received and GRN generated successfully!");
        setShowCompleteModal(false);
        setCompleteReceivingData({});
        setCompleteRemarks({});
        setSelectedPOForComplete(null);
        fetchPurchaseOrders();
        fetchStats();
        if (viewData && viewData.id === selectedPOForComplete.id) {
          setViewData(null);
        }
      } else {
        toast.error(response.data.error || "Error receiving items");
      }
    } catch (err) {
      console.error("Error receiving items:", err);
      toast.error(err.response?.data?.error || "Error receiving items");
    } finally {
      setSubmittingComplete(false);
    }
  };

  // Delete purchase order
  const deletePurchaseOrder = async (poId, poNumber) => {
    if (!window.confirm(`Are you sure you want to delete PO: ${poNumber}?`)) {
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/delete/${poId}`);
      toast.success("Purchase Order deleted successfully!");
      fetchPurchaseOrders();
      fetchStats();
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Error deleting Purchase Order";
      toast.error(errorMsg);
      console.error(err);
    }
  };

  // Edit purchase order
  const handleEdit = (po) => {
    setEditMode(true);
    setCurrentPoId(po.id);
    setOpenPopup(true);
    
    // Populate form data
    setFormData({
      po_date: po.po_date?.slice(0, 10) || todayDate,
      company_id: po.company_id || "",
      company_name: po.company_name || "",
      company_address: po.company_address || "",
      customer_name: po.customer_name || "",
      customer_mobile: po.customer_mobile || "",
      customer_email: po.customer_email || "",
      department: po.department || "",
      gst_number: po.gst_number || "",
      supplier_part_no: po.supplier_part_no || "",
      supplier_description: po.supplier_description || "",
      status: po.status,
      item_name: "",
      brand: "",
      brand_code: "",
      brand_description: "",
      hsn_code: "",
      length: "",
      width: "",
      unit: "PCS",
      buy_price: "",
      quantity: "",
      mrp: "",
    });

    // Populate items with temporary IDs
    const itemsWithIds = po.items?.map(item => ({
      ...item,
      id: Date.now() + Math.random(),
    })) || [];
    
    setTempItems(itemsWithIds);
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return 'bg-warning text-dark';
      case 'approved': return 'bg-success text-white';
      case 'rejected': return 'bg-danger text-white';
      case 'completed': return 'bg-info text-white';
      default: return 'bg-secondary text-white';
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const displayedPOs = filteredPOs();
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div className="container-fluid mt-4">
      

      <div className="card shadow border-0">
        <div className="card-header bg-primary text-white">
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="mb-0">
              <i className="fas fa-file-invoice me-2"></i>
              Purchase Order Management
            </h3>
            <button
              className="btn btn-light"
              onClick={() => setOpenPopup(true)}
            >
              <FaPlus className="me-2" />
              Create Purchase Order
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="card-body bg-light">
          <div className="row g-3 mb-4">
            <div className="col-md-2">
              <div className="card bg-white shadow-sm">
                <div className="card-body text-center">
                  <h6 className="text-muted">Total POs</h6>
                  <h3 className="fw-bold text-primary">{stats.total}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card bg-white shadow-sm">
                <div className="card-body text-center">
                  <h6 className="text-muted">Pending</h6>
                  <h3 className="fw-bold text-warning">{stats.pending}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card bg-white shadow-sm">
                <div className="card-body text-center">
                  <h6 className="text-muted">Approved</h6>
                  <h3 className="fw-bold text-success">
                    {(stats.approved || 0) + (stats.partially_received || 0)}
                  </h3>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card bg-white shadow-sm">
                <div className="card-body text-center">
                  <h6 className="text-muted">Rejected</h6>
                  <h3 className="fw-bold text-danger">{stats.rejected}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card bg-white shadow-sm">
                <div className="card-body text-center">
                  <h6 className="text-muted">Completed</h6>
                  <h3 className="fw-bold text-info">
                    {(stats.completed || 0) + (stats.converted_to_grn || 0)}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="row mb-3 g-2">
            <div className="col-md-3">
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <FaSearch />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search PO #, Company, GST, Rejection Remarks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-2">
              <select 
                className="form-select" 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="col-md-2">
              <select 
                className="form-select" 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="created_on">Sort by Created Date</option>
                <option value="po_date">Sort by PO Date</option>
                <option value="approved_date">Sort by Approval Date</option>
                <option value="delivery_date">Sort by Delivery Date</option>
                <option value="total_amount">Sort by Total Amount</option>
                <option value="po_number">Sort by PO Number</option>
              </select>
            </div>
            <div className="col-md-2">
              <select 
                className="form-select" 
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div className="col-md-2">
              <select 
                className="form-select" 
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value="5">5 per page</option>
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
              </select>
            </div>
          </div>

          {/* Purchase Orders Table */}
          <div className="table-responsive">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading purchase orders...</p>
              </div>
            ) : (
              <>
                <table className="table table-hover table-bordered">
                  <thead className="table-dark">
                    <tr>
                      <th>PO Number</th>
                      <th>Date</th>
                      <th>Delivery Date</th>
                      <th>Company / Customer</th>
                      <th>Items</th>
                      <th>Total Amount</th>
                      <th>Status</th>
                      <th>Rejection Remarks</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPOs.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center py-4">
                          <div className="text-muted">
                            <i className="fas fa-inbox fa-2x mb-2"></i>
                            <p>No purchase orders found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayedPOs.map((po) => (
                        <tr key={po.id}>
                          <td className="fw-bold text-primary">{po.po_number}</td>
                          <td>
                            <FaCalendarAlt className="me-1 text-secondary" />
                            {po.po_date?.slice(0, 10)}
                          </td>
                          <td>
                            {po.delivery_date ? (
                              <>
                                <FaTruck className="me-1 text-secondary" />
                                {po.delivery_date?.slice(0, 10)}
                              </>
                            ) : (
                              <span className="text-muted">Not delivered</span>
                            )}
                          </td>
                          <td>
                            <div>
                              <strong>
                                <FaBuilding className="me-1" />
                                {po.company_name}
                              </strong>
                              <small className="d-block text-muted">
                                <FaUser className="me-1" />
                                {po.customer_name}
                              </small>
                              {po.gst_number && (
                                <small className="d-block">
                                  <strong>GST:</strong> {po.gst_number}
                                </small>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-secondary">
                              <FaBox className="me-1" />
                              {po.items?.length || 0} items
                            </span>
                            <div className="mt-1">
                              <small className="text-muted">
                                {po.items?.slice(0, 2).map((item, idx) => (
                                  <div key={idx} className="text-truncate" style={{ maxWidth: '150px' }}>
                                    • {item.item_name}
                                    {item.count > 0 && (
                                      <span className="ms-2 badge bg-info">
                                        Count: {item.count}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {po.items?.length > 2 && (
                                  <div className="text-muted">+ {po.items.length - 2} more</div>
                                )}
                              </small>
                            </div>
                          </td>
                          <td className="fw-bold">
                            <FaRupeeSign className="me-1 text-success" />
                            {parseFloat(po.total_amount || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </td>
                          <td>
                            <span className={`badge ${getStatusBadgeClass(po.status)}`}>
                              {po.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {po.rejection_remarks ? (
                              <small className="text-danger">
                                <FaComment className="me-1" />
                                {po.rejection_remarks}
                              </small>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-primary"
                                onClick={() => setViewData(po)}
                                title="View"
                              >
                                <FaEye />
                              </button>
                              {po.status === 'pending' && (
                                <>
                                  <button
                                    className="btn btn-outline-success"
                                    onClick={() => handleApproveClick(po)}
                                    title="Approve"
                                  >
                                    <FaCheck />
                                  </button>
                                  <button
                                    className="btn btn-outline-danger"
                                    onClick={() => handleRejectClick(po)}
                                    title="Reject"
                                  >
                                    <FaTimes />
                                  </button>
                                  <button
                                    className="btn btn-outline-warning"
                                    onClick={() => handleEdit(po)}
                                    title="Edit"
                                  >
                                    <FaEdit />
                                  </button>
                                </>
                              )}
                              {po.status === 'pending' && (
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => deletePurchaseOrder(po.id, po.po_number)}
                                  title="Delete"
                                >
                                  <FaTrash />
                                </button>
                              )}
                              {(po.status === 'approved' || po.status === 'partially_received') && (
                                <button
                                  className="btn btn-outline-info"
                                  onClick={() => handleCompleteClick(po)}
                                  title="Receive & Complete"
                                >
                                  Complete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <div className="text-muted">
                      Showing {startIndex} to {endIndex} of {totalItems} entries
                    </div>
                    <nav>
                      <ul className="pagination mb-0">
                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                          <button
                            className="page-link"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            <FaChevronLeft />
                          </button>
                        </li>
                        
                        {/* Show first page */}
                        <li className={`page-item ${currentPage === 1 ? 'active' : ''}`}>
                          <button className="page-link" onClick={() => handlePageChange(1)}>
                            1
                          </button>
                        </li>
                        
                        {/* Show ellipsis if needed */}
                        {currentPage > 3 && (
                          <li className="page-item disabled">
                            <span className="page-link">...</span>
                          </li>
                        )}
                        
                        {/* Show page numbers around current page */}
                        {Array.from({ length: Math.min(3, totalPages - 2) }, (_, i) => {
                          const pageNum = currentPage - 1 + i;
                          if (pageNum > 1 && pageNum < totalPages) {
                            return (
                              <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                                <button className="page-link" onClick={() => handlePageChange(pageNum)}>
                                  {pageNum}
                                </button>
                              </li>
                            );
                          }
                          return null;
                        })}
                        
                        {/* Show ellipsis if needed */}
                        {currentPage < totalPages - 2 && (
                          <li className="page-item disabled">
                            <span className="page-link">...</span>
                          </li>
                        )}
                        
                        {/* Show last page */}
                        {totalPages > 1 && (
                          <li className={`page-item ${currentPage === totalPages ? 'active' : ''}`}>
                            <button className="page-link" onClick={() => handlePageChange(totalPages)}>
                              {totalPages}
                            </button>
                          </li>
                        )}
                        
                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                          <button
                            className="page-link"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                          >
                            <FaChevronRight />
                          </button>
                        </li>
                      </ul>
                    </nav>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* CREATE/EDIT POPUP MODAL */}
      {openPopup && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  {editMode ? `Edit Purchase Order: ${currentPoId}` : 'Create New Purchase Order'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={resetForm}></button>
              </div>

              <div className="modal-body">
                {/* Header Information */}
                <div className="card mb-4">
                  <div className="card-header bg-light">
                    <h6 className="mb-0 fw-bold">Order Information</h6>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-md-3">
                        <label className="form-label fw-bold">PO Date *</label>
                        <input
                          type="date"
                          className="form-control"
                          name="po_date"
                          value={formData.po_date}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="col-md-4 position-relative">
                        <label className="form-label fw-bold">Company Name *</label>
                        <input
                          type="text"
                          className="form-control"
                          name="company_name"
                          value={formData.company_name}
                          onChange={handleCompanyTyping}
                          required
                          placeholder="Search company..."
                          autoComplete="off"
                        />
                        {filteredCompanies.length > 0 && (
                          <div className="autocomplete-dropdown">
                            {filteredCompanies.map((company, i) => (
                              <div
                                key={i}
                                className="autocomplete-item"
                                onClick={() => handleCompanySelect(company)}
                              >
                                <strong>{company.companyName}</strong>
                                <small className="text-muted d-block">
                                  <FaUser className="me-1" />
                                  {company.customerName} | {company.customerMobile}
                                </small>
                                {company.gstNumber && (
                                  <small className="text-muted d-block">
                                    <strong>GST:</strong> {company.gstNumber}
                                  </small>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="col-md-3">
                        <label className="form-label fw-bold">Customer Name *</label>
                        <input
                          type="text"
                          className="form-control"
                          name="customer_name"
                          value={formData.customer_name}
                          onChange={handleChange}
                          required
                          readOnly={!!formData.company_id}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold">GST Number</label>
                        <input
                          type="text"
                          className="form-control"
                          name="gst_number"
                          value={formData.gst_number}
                          onChange={handleChange}
                          readOnly={!!formData.company_id}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold">Company Address</label>
                        <input
                          type="text"
                          className="form-control"
                          name="company_address"
                          value={formData.company_address}
                          onChange={handleChange}
                          readOnly={!!formData.company_id}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label fw-bold">Customer Mobile</label>
                        <input
                          type="text"
                          className="form-control"
                          name="customer_mobile"
                          value={formData.customer_mobile}
                          onChange={handleChange}
                          readOnly={!!formData.company_id}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label fw-bold">Department</label>
                        <input
                          type="text"
                          className="form-control"
                          name="department"
                          value={formData.department}
                          onChange={handleChange}
                          readOnly={!!formData.company_id}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold">Supplier Part No</label>
                        <input
                          type="text"
                          className="form-control"
                          name="supplier_part_no"
                          value={formData.supplier_part_no}
                          onChange={handleChange}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold">Supplier Description</label>
                        <input
                          type="text"
                          className="form-control"
                          name="supplier_description"
                          value={formData.supplier_description}
                          onChange={handleChange}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add Items Section */}
                <div className="card mb-4">
                  <div className="card-header bg-light">
                    <h6 className="mb-0 fw-bold">Add Items</h6>
                  </div>
                  <div className="card-body">
                    <div className="row g-3 mb-3">
                      <div className="col-md-3 position-relative">
                        <label className="form-label fw-bold">Item Name *</label>
                        <input
                          type="text"
                          className="form-control"
                          name="item_name"
                          value={formData.item_name}
                          onChange={handleItemTyping}
                          placeholder="Search item..."
                          autoComplete="off"
                        />
                        {filteredItems.length > 0 && (
                          <div className="autocomplete-dropdown">
                            {filteredItems.map((item, i) => (
                              <div
                                key={i}
                                className="autocomplete-item"
                                onClick={() => handleSuggestionSelect(item)}
                              >
                                <strong>{item["Item Name"]}</strong>
                                <small className="text-muted d-block">
                                  {item.Brand} | ₹{item["MRP"] || item["Buy Price"]}
                                </small>
                                {item.HSN && (
                                  <small className="text-muted d-block">
                                    <strong>HSN:</strong> {item.HSN}
                                  </small>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold">
                          <FaTag className="me-1" /> Brand
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          name="brand"
                          value={formData.brand}
                          onChange={handleChange}
                          placeholder="Brand"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold">
                          <FaBarcode className="me-1" /> Brand Code
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          name="brand_code"
                          value={formData.brand_code}
                          onChange={handleChange}
                          placeholder="Brand code"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold">
                          <FaHashtag className="me-1" /> HSN Code
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          name="hsn_code"
                          value={formData.hsn_code}
                          onChange={handleChange}
                          placeholder="HSN Code"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label fw-bold">Brand Description</label>
                        <input
                          type="text"
                          className="form-control"
                          name="brand_description"
                          value={formData.brand_description}
                          onChange={handleChange}
                          placeholder="Brand Description"
                        />
                      </div>
                      <div className="col-md-1">
                        <label className="form-label fw-bold">
                          <FaRulerCombined className="me-1" /> Length (M)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          name="length"
                          value={formData.length}
                          onChange={handleChange}
                          placeholder="L"
                        />
                      </div>
                      <div className="col-md-1">
                        <label className="form-label fw-bold">Width (mm)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          name="width"
                          value={formData.width}
                          onChange={handleChange}
                          placeholder="W"
                        />
                      </div>
                      <div className="col-md-1">
                        <label className="form-label fw-bold">Unit</label>
                        <select
                          className="form-select"
                          name="unit"
                          value={formData.unit}
                          onChange={handleChange}
                        >
                          <option value="PCS">PCS</option>
                          <option value="MTR">MTR</option>
                          <option value="KG">KG</option>
                          <option value="SET">SET</option>
                          <option value="BOX">BOX</option>
                          <option value="SQFT">SQFT</option>
                          <option value="SQM">SQM</option>
                        </select>
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold">NBP (Per Unit)</label>
                        <div className="input-group">
                          <span className="input-group-text">
                            <FaRupeeSign />
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control"
                            name="mrp"
                            value={formData.mrp}
                            onChange={handleChange}
                            placeholder="NBP"
                          />
                        </div>
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold">Quantity *</label>
                        <input
                          type="number"
                          className="form-control"
                          name="quantity"
                          value={formData.quantity}
                          onChange={handleChange}
                          min="1"
                          step="1"
                          required
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold">
                          <FaCalculator className="me-1" /> Buy Price *
                        </label>
                        <div className="input-group">
                          <span className="input-group-text">
                            <FaRupeeSign />
                          </span>
                          <input
                            type="number"
                            className="form-control"
                            name="buy_price"
                            value={formData.buy_price}
                            onChange={handleChange}
                            min="0.01"
                            step="0.01"
                            required
                            readOnly={formData.length && formData.width && formData.mrp}
                          />
                        </div>
                        <small className="text-muted">
                          {formData.length && formData.width && formData.mrp ? 
                            `Calculated: NBP (${formData.mrp}) × L (${formData.length}) × W (${formData.width})` : 
                            "Enter NBP, Length & Width to auto-calculate"}
                        </small>
                      </div>
                      <div className="col-md-1 d-flex align-items-end">
                        <button 
                          className="btn btn-primary w-100"
                          onClick={handleAddItem}
                          title="Add Item"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Calculation Preview */}
                    {formData.length && formData.width && formData.quantity && (
                      <div className="alert alert-info mb-3">
                        <div className="row">
                          <div className="col-md-4">
                            <strong>Count Calculation:</strong>
                            <div>Length (M) × Width (mm) × Quantity</div>
                            <div>= {formData.length} × {formData.width} × {formData.quantity}</div>
                            <div className="fw-bold">
                              = {calculateCount(formData.length, formData.width, formData.quantity)}
                            </div>
                          </div>
                          <div className="col-md-4">
                            <strong>Price/Unit Calculation:</strong>
                            <div>NBP × Length (M) × Width (mm)</div>
                            {formData.mrp && (
                              <>
                                <div>= {formData.mrp} × {formData.length} × {formData.width}</div>
                                <div className="fw-bold">
                                  = ₹{calculatePricePerUnit(formData.mrp, formData.length, formData.width)}
                                </div>
                              </>
                            )}
                          </div>
                          <div className="col-md-4">
                            <strong>Total Price:</strong>
                            <div>Buy Price × Quantity</div>
                            {formData.buy_price && formData.quantity && (
                              <>
                                <div>= {formData.buy_price} × {formData.quantity}</div>
                                <div className="fw-bold">
                                  = ₹{(parseFloat(formData.buy_price) * parseFloat(formData.quantity)).toFixed(2)}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Preview Items */}
                    <div className="mt-4">
                      <h6 className="fw-bold border-bottom pb-2">
                        <FaBox className="me-2" />
                        Order Items ({tempItems.length})
                      </h6>
                      {tempItems.length > 0 ? (
                        <div className="table-responsive">
                          <table className="table table-sm table-bordered">
                            <thead className="table-light">
                              <tr>
                                <th>#</th>
                                <th>Item Name</th>
                                <th>Brand</th>
                                <th>Code</th>
                                <th>Description</th>
                                <th>HSN</th>
                                <th>Size (L×W)</th>
                                <th>Unit</th>
                                <th>Qty</th>
                                <th>NBP</th>
                                <th>Count</th>
                                <th>Buy Price</th>
                                <th>Total</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tempItems.map((item, index) => (
                                <tr key={item.id}>
                                  <td>{index + 1}</td>
                                  <td className="fw-bold">{item.item_name}</td>
                                  <td>{item.brand}</td>
                                  <td>{item.brand_code || '-'}</td>
                                  <td>{item.brand_description || '-'}</td>
                                  <td>
                                    {item.hsn_code ? (
                                      <span className="badge bg-info text-dark">
                                        {item.hsn_code}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td>
                                    {item.length || item.width
                                      ? `${item.length || ''}${item.width ? '×' + item.width : ''}`
                                      : '-'
                                    }
                                  </td>
                                  <td>{item.unit}</td>
                                  <td>{item.quantity}</td>
                                  <td>
                                    <FaRupeeSign className="me-1" />
                                    {parseFloat(item.mrp || item.buy_price).toFixed(2)}
                                  </td>
                                  <td className="fw-bold text-primary">
                                    {item.count > 0 ? (
                                      <>
                                        <FaCalculator className="me-1" />
                                        {item.count}
                                      </>
                                    ) : '-'}
                                  </td>
                                  <td>
                                    <FaRupeeSign className="me-1" />
                                    {parseFloat(item.buy_price).toFixed(2)}
                                  </td>
                                  <td className="fw-bold text-success">
                                    <FaRupeeSign className="me-1" />
                                    {parseFloat(item.total_price || (item.quantity * item.buy_price)).toFixed(2)}
                                  </td>
                                  <td>
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => removeItem(item.id)}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="table-secondary">
                              <tr>
                                <td colSpan="12" className="text-end fw-bold">Grand Total:</td>
                                <td colSpan="2" className="fw-bold text-success">
                                  <FaRupeeSign className="me-1" />
                                  {calculateTotal().toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <div className="alert alert-info text-center">
                          <i className="fas fa-shopping-cart me-2"></i>
                          No items added yet. Add items above.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-success"
                  onClick={handleSubmitPO}
                  disabled={tempItems.length === 0 || !formData.company_name || !formData.customer_name}
                >
                  <FaCheck className="me-2" />
                  {editMode ? 'Update Purchase Order' : 'Submit Purchase Order'}
                </button>
                <button className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL (Only rejection needs remarks) */}
      {showRejectionModal && pendingActionPO && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-md">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  <FaTimes className="me-2" />
                  Reject Purchase Order
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowRejectionModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <p className="fw-bold">PO Number: <span className="text-primary">{pendingActionPO.po_number}</span></p>
                  <p>Company: {pendingActionPO.company_name}</p>
                  <p>Customer: {pendingActionPO.customer_name}</p>
                  <p>Total Amount: ₹{parseFloat(pendingActionPO.total_amount || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">
                    <FaComment className="me-1" />
                    Rejection Remarks *
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Enter rejection remarks..."
                    value={rejectionRemarks}
                    onChange={(e) => setRejectionRemarks(e.target.value)}
                    required
                  />
                  <small className="text-muted">Please provide reason for rejection</small>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-danger" onClick={submitRejection} disabled={!rejectionRemarks.trim()}>
                  <FaTimes className="me-2" />
                  Reject PO
                </button>
                <button className="btn btn-secondary" onClick={() => setShowRejectionModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE QUANTITIES & COMPLETE MODAL */}
      {showCompleteModal && selectedPOForComplete && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">
                  <i className="fas fa-truck me-2"></i>
                  Receive Items & Generate GRN (PO: {selectedPOForComplete.po_number})
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCompleteModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="alert alert-light border mb-4 bg-light bg-opacity-50">
                  <div className="row">
                    <div className="col-md-6 mb-2 mb-md-0">
                      <strong>Company:</strong> <span className="text-secondary">{selectedPOForComplete.company_name}</span>
                    </div>
                    <div className="col-md-6">
                      <strong>Customer:</strong> <span className="text-secondary">{selectedPOForComplete.customer_name}</span>
                    </div>
                  </div>
                </div>
                
                <div className="table-responsive">
                  <table className="table table-bordered table-hover align-middle">
                    <thead className="table-dark">
                      <tr>
                        <th>Item Name</th>
                        <th className="text-center" style={{ width: '90px' }}>Ordered</th>
                        <th className="text-center" style={{ width: '90px' }}>Received</th>
                        <th className="text-center" style={{ width: '90px' }}>Remaining</th>
                        <th className="text-center" style={{ width: '130px' }}>Receive Now</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPOForComplete.items?.map((item, index) => {
                        const deliveredQty = item.delivered_quantity || 0;
                        const remainingQty = item.quantity - deliveredQty;
                        
                        return (
                          <tr key={index}>
                            <td>
                              <span className="fw-bold text-dark">{item.item_name}</span>
                              {item.length && item.width && (
                                <small className="d-block text-muted">
                                  Size: {item.length} × {item.width}
                                </small>
                              )}
                            </td>
                            <td className="text-center text-secondary">{item.quantity}</td>
                            <td className="text-center text-success fw-semibold">{deliveredQty}</td>
                            <td className="text-center text-warning fw-bold">{remainingQty}</td>
                            <td>
                              <input
                                type="number"
                                className="form-control text-center border-info fw-bold"
                                value={completeReceivingData[index] ?? 0}
                                min="0"
                                max={remainingQty}
                                disabled={remainingQty === 0}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (val < 0) return;
                                  if (val > remainingQty) {
                                    toast.warning(`Cannot receive more than remaining (${remainingQty})`);
                                    setCompleteReceivingData({
                                      ...completeReceivingData,
                                      [index]: remainingQty
                                    });
                                  } else {
                                    setCompleteReceivingData({
                                      ...completeReceivingData,
                                      [index]: val
                                    });
                                  }
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Optional remarks..."
                                value={completeRemarks[index] || ""}
                                disabled={remainingQty === 0}
                                onChange={(e) => {
                                  setCompleteRemarks({
                                    ...completeRemarks,
                                    [index]: e.target.value
                                  });
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer bg-light border-0">
                <button 
                  className="btn btn-info text-white px-4 fw-semibold shadow-sm" 
                  onClick={submitCompleteReceipt} 
                  disabled={submittingComplete || !Object.values(completeReceivingData).some(qty => qty > 0)}
                >
                  {submittingComplete ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save me-2"></i>
                      Receive & Generate GRN
                    </>
                  )}
                </button>
                <button className="btn btn-secondary px-4" onClick={() => setShowCompleteModal(false)} disabled={submittingComplete}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW POPUP MODAL - ENHANCED VERSION */}
      {viewData && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title">
                  <i className="fas fa-file-invoice me-2"></i>
                  Purchase Order Details - {viewData.po_number}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setViewData(null)}></button>
              </div>
              <div className="modal-body">
                <div className="card border-0 shadow-sm">
                  <div className="card-body">
                    {/* Order Summary Section */}
                    <div className="row mb-4">
                      <div className="col-md-6">
                        <h4 className="text-primary fw-bold mb-3">{viewData.po_number}</h4>
                        <div className="card bg-light p-3">
                          <h6 className="fw-bold border-bottom pb-2">Company Details</h6>
                          <p className="mb-1">
                            <strong>
                              <FaBuilding className="me-1 text-secondary" />
                              Company:
                            </strong> {viewData.company_name}
                          </p>
                          <p className="mb-1">
                            <strong>
                              <FaUser className="me-1 text-secondary" />
                              Customer:
                            </strong> {viewData.customer_name}
                          </p>
                          <p className="mb-1">
                            <strong>Address:</strong> {viewData.company_address || 'N/A'}
                          </p>
                          {viewData.gst_number && (
                            <p className="mb-1">
                              <strong>GST:</strong> {viewData.gst_number}
                            </p>
                          )}
                          <p className="mb-1">
                            <strong>Mobile:</strong> {viewData.customer_mobile || 'N/A'}
                          </p>
                          {viewData.customer_email && (
                            <p className="mb-1">
                              <strong>Email:</strong> {viewData.customer_email}
                            </p>
                          )}
                          <p className="mb-1">
                            <strong>Department:</strong> {viewData.department || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card bg-light p-3">
                          <h6 className="fw-bold border-bottom pb-2">Order Details</h6>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="fw-bold">Status:</span>
                            <span className={`badge ${getStatusBadgeClass(viewData.status)} fs-6`}>
                              {viewData.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="mb-1">
                            <strong>
                              <FaCalendarAlt className="me-1 text-secondary" />
                              PO Date:
                            </strong> {viewData.po_date?.slice(0, 10)}
                          </p>
                          {viewData.delivery_date && (
                            <p className="mb-1">
                              <strong>
                                <FaTruck className="me-1 text-secondary" />
                                Delivery Date:
                              </strong> {viewData.delivery_date?.slice(0, 10)}
                            </p>
                          )}
                          <p className="mb-1">
                            <strong>Created On:</strong> {new Date(viewData.created_on).toLocaleString('en-IN')}
                          </p>
                          {viewData.approved_date && (
                            <p className="mb-1">
                              <strong>Approved On:</strong> {new Date(viewData.approved_date).toLocaleString('en-IN')}
                            </p>
                          )}
                          {viewData.rejection_remarks && (
                            <div className="mt-2 p-2 bg-danger bg-opacity-10 rounded">
                              <strong className="text-danger">
                                <FaComment className="me-1" />
                                Rejection Remarks:
                              </strong>
                              <p className="mb-0 text-danger mt-1">{viewData.rejection_remarks}</p>
                            </div>
                          )}
                          {viewData.supplier_part_no && (
                            <p className="mb-1 mt-2">
                              <strong>Part No:</strong> {viewData.supplier_part_no}
                            </p>
                          )}
                          {viewData.supplier_description && (
                            <p className="mb-1">
                              <strong>Description:</strong> {viewData.supplier_description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="border-top pt-3">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="fw-bold mb-0">
                          <FaBox className="me-2 text-primary" />
                          Item-wise Details ({viewData.items?.length || 0} Items)
                        </h5>
                        <span className="text-muted">
                          Total Quantity: {viewData.items?.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                        </span>
                      </div>
                      
                      <div className="table-responsive">
                        <table className="table table-bordered table-hover">
                          <thead className="table-dark">
                            <tr>
                              <th>#</th>
                              <th>Item Name</th>
                              <th>Brand</th>
                              <th>Brand Code</th>
                              <th>Brand Description</th>
                              <th>HSN Code</th>
                              <th>Dimensions</th>
                              <th>Unit</th>
                              <th>Qty</th>
                              <th>NBP/Unit</th>
                              <th>Count (L×W×Qty)</th>
                              <th>Buy Price/Unit</th>
                              <th>Total Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewData.items?.map((item, index) => {
                              const count = calculateCount(item.length, item.width, item.quantity);
                              const totalPrice = item.quantity * item.buy_price;
                              
                              return (
                                <tr key={index}>
                                  <td className="fw-bold text-center">{index + 1}</td>
                                  <td>
                                    <span className="fw-bold">{item.item_name}</span>
                                  </td>
                                  <td>{item.brand || '-'}</td>
                                  <td>
                                    {item.brand_code ? (
                                      <span className="badge bg-secondary">{item.brand_code}</span>
                                    ) : '-'}
                                  </td>
                                  <td>
                                    <small>{item.brand_description || '-'}</small>
                                  </td>
                                  <td>
                                    {item.hsn_code ? (
                                      <span className="badge bg-info text-dark">
                                        <FaHashtag className="me-1" size={10} />
                                        {item.hsn_code}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="text-center">
                                    {item.length && item.width ? (
                                      <span className="badge bg-light text-dark border">
                                        {item.length} × {item.width}
                                      </span>
                                    ) : item.length ? (
                                      <span className="badge bg-light text-dark border">
                                        L: {item.length}
                                      </span>
                                    ) : item.width ? (
                                      <span className="badge bg-light text-dark border">
                                        W: {item.width}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="text-center">
                                    <span className="badge bg-secondary">
                                      {item.unit || 'PCS'}
                                    </span>
                                  </td>
                                  <td className="text-center fw-bold">
                                    {item.quantity}
                                  </td>
                                  <td className="text-end">
                                    <FaRupeeSign className="me-1 text-muted" size={12} />
                                    {parseFloat(item.mrp || item.buy_price).toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                  <td className="text-center fw-bold text-primary">
                                    {count > 0 ? (
                                      <>
                                        <FaCalculator className="me-1" size={12} />
                                        {parseFloat(count).toLocaleString('en-IN', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })}
                                      </>
                                    ) : '-'}
                                  </td>
                                  <td className="text-end">
                                    <FaRupeeSign className="me-1 text-muted" size={12} />
                                    {parseFloat(item.buy_price).toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                  <td className="text-end fw-bold text-success">
                                    <FaRupeeSign className="me-1" size={12} />
                                    {totalPrice.toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="table-secondary">
                            <tr>
                              <td colSpan="12" className="text-end fw-bold fs-5">
                                Grand Total:
                              </td>
                              <td className="text-end fw-bold fs-5 text-success">
                                <FaRupeeSign className="me-1" />
                                {parseFloat(viewData.total_amount || 0).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Summary Cards */}
                      <div className="row mt-4">
                        <div className="col-md-3">
                          <div className="card bg-primary bg-opacity-10 border-primary">
                            <div className="card-body py-3">
                              <small className="text-primary text-uppercase fw-bold">Total Items</small>
                              <h4 className="mb-0 fw-bold">{viewData.items?.length || 0}</h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="card bg-info bg-opacity-10 border-info">
                            <div className="card-body py-3">
                              <small className="text-info text-uppercase fw-bold">Total Quantity</small>
                              <h4 className="mb-0 fw-bold">
                                {viewData.items?.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                              </h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="card bg-warning bg-opacity-10 border-warning">
                            <div className="card-body py-3">
                              <small className="text-warning text-uppercase fw-bold">Total Count</small>
                              <h4 className="mb-0 fw-bold">
                                {viewData.items?.reduce((sum, item) => {
                                  const count = calculateCount(item.length, item.width, item.quantity);
                                  return sum + (parseFloat(count) || 0);
                                }, 0).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="card bg-success bg-opacity-10 border-success">
                            <div className="card-body py-3">
                              <small className="text-success text-uppercase fw-bold">Total Amount</small>
                              <h4 className="mb-0 fw-bold text-success">
                                <FaRupeeSign className="me-1" size={18} />
                                {parseFloat(viewData.total_amount || 0).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </h4>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                {/* Action buttons based on status */}
                {viewData.status === 'pending' && (
                  <>
                    <button 
                      className="btn btn-success"
                      onClick={() => handleApproveClick(viewData)}
                    >
                      <FaCheck className="me-2" />
                      Approve
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => handleRejectClick(viewData)}
                    >
                      <FaTimes className="me-2" />
                      Reject
                    </button>
                  </>
                )}
                {(viewData.status === 'approved' || viewData.status === 'partially_received') && (
                  <button 
                    className="btn btn-info text-white"
                    onClick={() => {
                      setViewData(null);
                      handleCompleteClick(viewData);
                    }}
                  >
                    Receive & Complete
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => setViewData(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS for autocomplete dropdown */}
      <style jsx>{`
        .autocomplete-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          max-height: 200px;
          overflow-y: auto;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          z-index: 1000;
        }
        .autocomplete-item {
          padding: 8px 12px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
        }
        .autocomplete-item:hover {
          background-color: #f8f9fa;
        }
        .autocomplete-item:last-child {
          border-bottom: none;
        }
        
        .page-item.active .page-link {
          background-color: #0d6efd;
          border-color: #0d6efd;
        }
        
        .table td, .table th {
          vertical-align: middle;
        }
      `}</style>
    </div>
  );
};

export default PurchaseOrderPage;