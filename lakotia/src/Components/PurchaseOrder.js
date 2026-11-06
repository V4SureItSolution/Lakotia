import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { 
  FaEye, FaCheck, FaTimes, FaEdit, FaTrash, FaPlus, 
  FaSearch, FaFilter, FaBuilding, FaUser, FaCalendarAlt,
  FaBox, FaRupeeSign, FaTag, FaBarcode, FaRulerCombined,
  FaHashtag, FaReceipt, FaCalculator, FaTimesCircle,
  FaTruck, FaPercent, FaFileInvoice
} from "react-icons/fa";
import { API_BASE } from "../config";

const API_BASE_URL = `${API_BASE}/purchase-orders`;
const STOCK_API_URL = `${API_BASE}/stock/all`;
const COMPANY_API_URL = `${API_BASE}/company`;

const PurchaseOrderPage = () => {
  const todayDate = new Date().toISOString().slice(0, 10);

  // State declarations
  const [formData, setFormData] = useState({
    po_date: todayDate,
    delivery_date: "",
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
    completed: 0,
    partially_received: 0,
    partially_converted_to_grn: 0
  });

  // Fetch stock data, companies, and purchase orders
  useEffect(() => {
    fetchStock();
    fetchCompanies();
    fetchPurchaseOrders();
  }, []);

  // Update stats when purchaseOrders change
  useEffect(() => {
    updateStats();
  }, [purchaseOrders]);

  // Update statistics based on purchase orders
  const updateStats = () => {
    const total = purchaseOrders.length;
    const pending = purchaseOrders.filter(po => po.status === 'pending').length;
    const approved = purchaseOrders.filter(po => po.status === 'approved').length;
    const rejected = purchaseOrders.filter(po => po.status === 'rejected').length;
    const completed = purchaseOrders.filter(po => po.status === 'completed').length;
    const partiallyConverted = purchaseOrders.filter(po => 
      po.status === 'approved' && getDeliveryStatus(po) === 'partially_converted_to_grn'
    ).length;
    
    setStats({
      total,
      pending,
      approved,
      rejected,
      completed,
      partially_received: partiallyConverted,
      partially_converted_to_grn: partiallyConverted
    });
  };

  // Fetch statistics from API (fallback)
  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stats`);
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error("Error loading stats:", err);
      updateStats();
    }
  };

  // Fetch stock items with brand description
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

  // Fetch purchase orders
  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/all`);
      if (res.data.success) {
        console.log("Fetched POs:", res.data.data); // Debug log
        setPurchaseOrders(res.data.data);
      }
    } catch (err) {
      toast.error("Error loading purchase orders");
      console.error("Error loading purchase orders:", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total ordered quantity for a PO
  const calculateTotalOrdered = (items) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  };

  // Calculate total received quantity for a PO - Uses delivered_quantity from items
  const calculateTotalReceived = (items) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => {
      const receivedQty = parseFloat(item.delivered_quantity || item.received_quantity || 0);
      return sum + receivedQty;
    }, 0);
  };

  // Calculate total pending quantity for a PO
  const calculateTotalPending = (items) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => {
      const pendingQty = parseFloat(item.remaining_quantity || 0);
      return sum + (pendingQty > 0 ? pendingQty : 0);
    }, 0);
  };

  // Get delivery status for a PO - Enhanced to use your data structure
  const getDeliveryStatus = (po) => {
    // If PO is not approved, return the status
    if (po.status !== 'approved') {
      return po.status;
    }
    
    // For approved POs, check delivery status from items
    if (!po.items || po.items.length === 0) {
      return 'pending_delivery';
    }
    
    const totalOrdered = calculateTotalOrdered(po.items);
    const totalReceived = calculateTotalReceived(po.items);
    
    console.log(`Delivery Status Check for ${po.po_number}:`, {
      totalOrdered,
      totalReceived,
      items: po.items.map(i => ({
        quantity: i.quantity,
        delivered: i.delivered_quantity,
        remaining: i.remaining_quantity
      }))
    });
    
    if (totalReceived === 0) {
      return 'pending_delivery';
    } else if (totalReceived > 0 && totalReceived < totalOrdered) {
      return 'partially_converted_to_grn';
    } else if (totalReceived === totalOrdered && totalOrdered > 0) {
      return 'fully_received';
    }
    
    return 'approved';
  };

  // Get status badge class for delivery status
  const getDeliveryStatusBadgeClass = (status, po) => {
    const deliveryStatus = getDeliveryStatus(po);
    
    if (po.status !== 'approved') {
      switch (po.status) {
        case 'pending': return 'bg-warning text-dark';
        case 'rejected': return 'bg-danger text-white';
        case 'completed': return 'bg-info text-white';
        default: return 'bg-secondary text-white';
      }
    }
    
    switch (deliveryStatus) {
      case 'pending_delivery': return 'bg-warning text-dark';
      case 'partially_converted_to_grn': return 'bg-info text-white';
      case 'fully_received': return 'bg-success text-white';
      default: return 'bg-primary text-white';
    }
  };

  // Get status text for delivery status
  const getDeliveryStatusText = (po) => {
    if (po.status !== 'approved') {
      return po.status.toUpperCase();
    }
    
    const deliveryStatus = getDeliveryStatus(po);
    switch (deliveryStatus) {
      case 'pending_delivery': return 'PENDING DELIVERY';
      case 'partially_converted_to_grn': return 'PARTIALLY CONVERTED TO GRN';
      case 'fully_received': return 'FULLY RECEIVED';
      default: return 'APPROVED';
    }
  };

  // Calculate receipt progress percentage
  const getReceiptProgress = (po) => {
    if (po.status !== 'approved') return 0;
    
    const totalOrdered = calculateTotalOrdered(po.items);
    const totalReceived = calculateTotalReceived(po.items);
    
    if (totalOrdered === 0) return 0;
    return (totalReceived / totalOrdered) * 100;
  };

  // Filter and sort purchase orders
  const filteredPOs = useCallback(() => {
    let filtered = [...purchaseOrders];

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter(po => {
        if (filterStatus === "partially_converted_to_grn") {
          return getDeliveryStatus(po) === "partially_converted_to_grn";
        } else if (filterStatus === "pending_delivery") {
          return getDeliveryStatus(po) === "pending_delivery";
        } else if (filterStatus === "fully_received") {
          return getDeliveryStatus(po) === "fully_received";
        } else {
          return po.status === filterStatus;
        }
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
        po.gst_number?.includes(term)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      if (sortBy === "po_date" || sortBy === "created_on" || sortBy === "delivery_date") {
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

    const results = companies.filter(company => 
      company.companyName?.toLowerCase().includes(value.toLowerCase()) ||
      company.customerName?.toLowerCase().includes(value.toLowerCase()) ||
      company.customerMobile?.includes(value) ||
      company.gstNumber?.includes(value)
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
      x["brand"]?.toLowerCase().includes(value.toLowerCase()) ||
      x["Brand"]?.toLowerCase().includes(value.toLowerCase()) ||
      x["hsn_code"]?.includes(value) ||
      x["HSN"]?.includes(value)
    ).slice(0, 10);
    setFilteredItems(results);
  };

  // Handle item suggestion selection
  const handleSuggestionSelect = (item) => {
    const length = parseFloat(item.Length || item.length || 0);
    const width = parseFloat(item.Width || item.width || 0);
    const quantity = parseFloat(formData.quantity || 1);
    const mrp = parseFloat(item["MRP"] || item.mrp || item["Buy Price"] || item.buy_price || 0);
    
    let count = 0;
    let buyPrice = mrp;
    
    if (length > 0 && width > 0) {
      count = length * width * quantity;
      buyPrice = mrp * length * width;
    }
    
    setFormData({
      ...formData,
      item_name: item["Item Name"] || item.item_name || "",
      brand: item.Brand || item.brand || "",
      brand_code: item["Brand Code"] || item.brand_code || "",
      brand_description: item["Brand Description"] || item.brand_description || item.description || "",
      hsn_code: item.HSN || item.hsn_code || item.hsn || "",
      length: item.Length || item.length || "",
      width: item.Width || item.width || "",
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
    
    if (name === 'length' || name === 'width' || name === 'mrp') {
      const length = parseFloat(name === 'length' ? value : formData.length) || 0;
      const width = parseFloat(name === 'width' ? value : formData.width) || 0;
      const mrp = parseFloat(name === 'mrp' ? value : formData.mrp) || 0;
      
      if (length > 0 && width > 0 && mrp > 0) {
        newFormData.buy_price = (mrp * length * width).toFixed(2);
      }
    }
    
    setFormData(newFormData);
  };

  // Calculate count for an item
  const calculateCount = (length, width, quantity) => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const qty = parseFloat(quantity) || 0;
    
    if (l > 0 && w > 0 && qty > 0) {
      return (l * w * qty).toFixed(2);
    }
    return 0;
  };

  // Calculate price per unit
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

    const length = parseFloat(formData.length) || 0;
    const width = parseFloat(formData.width) || 0;
    const quantity = parseFloat(formData.quantity);
    const buyPrice = parseFloat(formData.buy_price);
    const mrp = parseFloat(formData.mrp) || buyPrice;
    
    let count = 0;
    let totalPrice = buyPrice * quantity;
    
    if (length > 0 && width > 0) {
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
        delivery_date: formData.delivery_date || null,
        company_id: formData.company_id || null,
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
        await axios.put(`${API_BASE_URL}/update/${currentPoId}`, payload);
        toast.success("Purchase Order Updated Successfully!");
      } else {
        await axios.post(`${API_BASE_URL}/create`, payload);
        toast.success("Purchase Order Created Successfully!");
      }

      resetForm();
      fetchPurchaseOrders();
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
      delivery_date: "",
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

  // Update PO status
  const updatePOStatus = async (poId, newStatus, remarks = "") => {
    if (!window.confirm(`Are you sure you want to ${newStatus} this purchase order?`)) {
      return;
    }

    try {
      await axios.put(`${API_BASE_URL}/update-status/${poId}`, {
        status: newStatus,
        approval_remarks: newStatus === 'approved' ? remarks : undefined,
        rejection_remarks: newStatus === 'rejected' ? remarks : undefined
      });
      
      toast.success(`PO ${newStatus} successfully!`);
      fetchPurchaseOrders();
    } catch (err) {
      toast.error("Error updating status");
      console.error(err);
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
    
    setFormData({
      po_date: po.po_date?.slice(0, 10) || todayDate,
      delivery_date: po.delivery_date?.slice(0, 10) || "",
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

    const itemsWithIds = po.items?.map(item => ({
      ...item,
      id: Date.now() + Math.random(),
    })) || [];
    
    setTempItems(itemsWithIds);
  };

  // Get item row background color
  const getItemRowClass = (index) => {
    return index % 2 === 0 ? '' : 'table-warning';
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
                  <h3 className="fw-bold text-success">{stats.approved}</h3>
                </div>
              </div>
            </div>
            <div className="col-md-2">
              <div className="card bg-white shadow-sm">
                <div className="card-body text-center">
                  <h6 className="text-muted">Partially Converted to GRN</h6>
                  <h3 className="fw-bold text-info">{stats.partially_converted_to_grn || 0}</h3>
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
                  <h3 className="fw-bold text-secondary">{stats.completed}</h3>
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
                  placeholder="Search PO #, Company, Customer, GST..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
              <select 
                className="form-select" 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="partially_converted_to_grn">Partially Converted to GRN</option>
                <option value="pending_delivery">Pending Delivery</option>
                <option value="fully_received">Fully Received</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="col-md-3">
              <select 
                className="form-select" 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="created_on">Sort by Created Date</option>
                <option value="po_date">Sort by PO Date</option>
                <option value="delivery_date">Sort by Delivery Date</option>
                <option value="total_amount">Sort by Total Amount</option>
                <option value="po_number">Sort by PO Number</option>
              </select>
            </div>
            <div className="col-md-3">
              <select 
                className="form-select" 
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
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
              <table className="table table-hover table-bordered">
                <thead className="table-dark">
                  <tr>
                    <th>PO Number</th>
                    <th>PO Date</th>
                    <th>Delivery Date</th>
                    <th>Company / Customer</th>
                    <th>Items</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPOs().length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-4">
                        <div className="text-muted">
                          <i className="fas fa-inbox fa-2x mb-2"></i>
                          <p>No purchase orders found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPOs().map((po) => {
                      const deliveryStatus = getDeliveryStatus(po);
                      
                      return (
                        <tr key={po.id}>
                          <td className="fw-bold text-primary">{po.po_number}</td>
                          <td>
                            <FaCalendarAlt className="me-1 text-secondary" />
                            {po.po_date?.slice(0, 10)}
                          </td>
                          <td>
                            {po.delivery_date ? (
                              <>
                                <FaCalendarAlt className="me-1 text-secondary" />
                                {po.delivery_date?.slice(0, 10)}
                              </>
                            ) : (
                              <span className="text-muted">Not set</span>
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
                              {po.customer_mobile && (
                                <small className="d-block">
                                  <strong>Mobile:</strong> {po.customer_mobile}
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
                                    {item.delivered_quantity > 0 && (
                                      <span className="ms-2 badge bg-success">
                                        Rec: {item.delivered_quantity}
                                      </span>
                                    )}
                                    {item.remaining_quantity > 0 && item.remaining_quantity < item.quantity && (
                                      <span className="ms-2 badge bg-warning">
                                        Rem: {item.remaining_quantity}
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
                            <span className={`badge ${getDeliveryStatusBadgeClass(po.status, po)}`}>
                              {getDeliveryStatusText(po)}
                            </span>
                            {po.status === 'approved' && deliveryStatus === 'partially_converted_to_grn' && (
                              <div className="mt-1">
                                <small className="text-info">
                                  <FaFileInvoice className="me-1" />
                                  GRN created for partial items
                                </small>
                              </div>
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
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
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
                      <div className="col-md-3">
                        <label className="form-label fw-bold">Delivery Date</label>
                        <input
                          type="date"
                          className="form-control"
                          name="delivery_date"
                          value={formData.delivery_date}
                          onChange={handleChange}
                          min={formData.po_date}
                        />
                      </div>
                      <div className="col-md-6 position-relative">
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
                      <div className="col-md-4">
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
                      <div className="col-md-4">
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
                      <div className="col-md-4">
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
                      <div className="col-md-8">
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
                      <div className="col-md-4">
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
                                <strong>{item["Item Name"] || item.item_name}</strong>
                                <small className="text-muted d-block">
                                  {item.Brand || item.brand} | ₹{item["MRP"] || item.mrp || item["Buy Price"] || item.buy_price}
                                </small>
                                {(item.HSN || item.hsn_code) && (
                                  <small className="text-muted d-block">
                                    <strong>HSN:</strong> {item.HSN || item.hsn_code}
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
                          <option value="LTR">LTR</option>
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
                            <div>Length × Width × Quantity</div>
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
                                <tr key={item.id} className={getItemRowClass(index)}>
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
                                      <FaTimesCircle />
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

      {/* VIEW POPUP MODAL */}
      {viewData && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
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
                    <div className="row mb-4">
                      <div className="col-md-6">
                        <h4 className="text-primary fw-bold">{viewData.po_number}</h4>
                        <p className="mb-1">
                          <strong>
                            <FaBuilding className="me-1" />
                            Company:
                          </strong> {viewData.company_name}
                        </p>
                        <p className="mb-1">
                          <strong>
                            <FaUser className="me-1" />
                            Customer:
                          </strong> {viewData.customer_name}
                        </p>
                        <p className="mb-1">
                          <strong>Address:</strong> {viewData.company_address}
                        </p>
                        {viewData.gst_number && (
                          <p className="mb-1">
                            <strong>GST:</strong> {viewData.gst_number}
                          </p>
                        )}
                        <p className="mb-1">
                          <strong>Mobile:</strong> {viewData.customer_mobile}
                        </p>
                        <p className="mb-1">
                          <strong>Email:</strong> {viewData.customer_email}
                        </p>
                        <p className="mb-1">
                          <strong>Department:</strong> {viewData.department}
                        </p>
                        {viewData.supplier_part_no && (
                          <p className="mb-1">
                            <strong>Supplier Part No:</strong> {viewData.supplier_part_no}
                          </p>
                        )}
                        {viewData.supplier_description && (
                          <p className="mb-1">
                            <strong>Supplier Description:</strong> {viewData.supplier_description}
                          </p>
                        )}
                      </div>
                      <div className="col-md-6 text-end">
                        <span className={`badge ${getDeliveryStatusBadgeClass(viewData.status, viewData)} fs-6`}>
                          {getDeliveryStatusText(viewData)}
                        </span>
                        <p className="mt-2 mb-1">
                          <strong>
                            <FaCalendarAlt className="me-1" />
                            PO Date:
                          </strong> {viewData.po_date?.slice(0, 10)}
                        </p>
                        {viewData.delivery_date && (
                          <p className="mb-1">
                            <strong>
                              <FaCalendarAlt className="me-1" />
                              Delivery Date:
                            </strong> {viewData.delivery_date?.slice(0, 10)}
                          </p>
                        )}
                        <p className="mb-1">
                          <strong>Created:</strong> {viewData.created_on?.slice(0, 16)}
                        </p>
                        {viewData.updated_on && (
                          <p className="mb-1">
                            <strong>Updated:</strong> {viewData.updated_on?.slice(0, 16)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-top pt-3">
                      <h6 className="fw-bold">
                        <FaBox className="me-2" />
                        Items ({viewData.items?.length || 0})
                      </h6>
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
                              <th>Ordered Qty</th>
                              <th>Received Qty</th>
                              <th>Pending Qty</th>
                              <th>NBP</th>
                              <th>Count</th>
                              <th>Buy Price</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewData.items?.map((item, index) => {
                              const count = calculateCount(item.length, item.width, item.quantity);
                              const receivedQty = parseFloat(item.delivered_quantity || 0);
                              const pendingQty = parseFloat(item.remaining_quantity || (item.quantity - receivedQty));
                              
                              return (
                                <tr key={index} className={getItemRowClass(index)}>
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
                                  <td className="fw-bold">{item.quantity}</td>
                                  <td className="text-success fw-bold">{receivedQty}</td>
                                  <td className="text-warning fw-bold">{pendingQty}</td>
                                  <td>
                                    <FaRupeeSign className="me-1" />
                                    {parseFloat(item.mrp || item.buy_price).toFixed(2)}
                                  </td>
                                  <td className="fw-bold text-primary">
                                    {count > 0 ? (
                                      <>
                                        <FaCalculator className="me-1" />
                                        {count}
                                      </>
                                    ) : '-'}
                                  </td>
                                  <td>
                                    <FaRupeeSign className="me-1" />
                                    {parseFloat(item.buy_price).toFixed(2)}
                                  </td>
                                  <td className="fw-bold text-success">
                                    <FaRupeeSign className="me-1" />
                                    {(item.quantity * item.buy_price).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="table-secondary">
                            <tr>
                              <td colSpan="13" className="text-end fw-bold">Total Amount:</td>
                              <td colSpan="2" className="fw-bold text-success">
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
                    </div>

                    {/* Approval/Rejection Remarks */}
                    {viewData.approval_remarks && (
                      <div className="mt-3 border-top pt-3">
                        <h6 className="fw-bold text-success">
                          <FaCheck className="me-2" />
                          Approval Remarks
                        </h6>
                        <p className="mb-0">{viewData.approval_remarks}</p>
                        {viewData.approved_date && (
                          <small className="text-muted">
                            Approved on: {viewData.approved_date?.slice(0, 16)}
                          </small>
                        )}
                      </div>
                    )}

                    {viewData.rejection_remarks && (
                      <div className="mt-3 border-top pt-3">
                        <h6 className="fw-bold text-danger">
                          <FaTimes className="me-2" />
                          Rejection Remarks
                        </h6>
                        <p className="mb-0">{viewData.rejection_remarks}</p>
                        {viewData.rejected_date && (
                          <small className="text-muted">
                            Rejected on: {viewData.rejected_date?.slice(0, 16)}
                          </small>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                {viewData.status === 'pending' && (
                  <>
                    <button 
                      className="btn btn-success"
                      onClick={() => {
                        updatePOStatus(viewData.id, 'approved');
                        setViewData(null);
                      }}
                    >
                      <FaCheck className="me-2" />
                      Approve
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => {
                        updatePOStatus(viewData.id, 'rejected');
                        setViewData(null);
                      }}
                    >
                      <FaTimes className="me-2" />
                      Reject
                    </button>
                  </>
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
        
        /* Yellow background for alternate rows */
        .table-warning {
          background-color: #fff3cd !important;
        }
        
        .progress {
          background-color: #e9ecef;
          border-radius: 10px;
        }
        .progress-bar {
          transition: width 0.3s ease;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default PurchaseOrderPage;