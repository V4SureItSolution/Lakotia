import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { 
  FaReceipt, FaCheck, FaBox, FaCalendarAlt, FaBuilding, FaUser, 
  FaTruck, FaHistory, FaSave, FaRulerCombined, FaSync,
  FaSpinner, FaDownload, FaTimesCircle, FaInfoCircle,
  FaChartLine, FaFileInvoice, FaClipboardList, FaClock
} from "react-icons/fa";
import { API_BASE } from "../config";

const API_BASE_URL = `${API_BASE}/purchase-orders`;

const AllDeliveryItemsPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [receivingData, setReceivingData] = useState({});
  const [remarks, setRemarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptHistory, setReceiptHistory] = useState(null);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [expandedPO, setExpandedPO] = useState(null);

  // Fetch all purchase orders with complete details
  useEffect(() => {
    fetchAllPurchaseOrders();
  }, []);

  const fetchAllPurchaseOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all POs
      const res = await axios.get(`${API_BASE_URL}/all`);
      console.log("Response from /all:", res.data);
      
      if (res.data.success) {
        const pos = res.data.data;
        console.log("All POs:", pos);
        setPurchaseOrders(pos);
        
        // Extract all items with their delivery status
        const allItemsList = [];
        pos.forEach(po => {
          if (po.items && po.items.length > 0) {
            po.items.forEach((item, idx) => {
              const orderedQty = item.original_quantity || item.quantity || 0;
              const receivedQty = item.delivered_quantity || 0;
              const pendingQty = item.remaining_quantity || 0;
              const isFullyReceived = pendingQty === 0;
              
              // Get last received date from receipt history
              let lastReceivedDate = null;
              if (po.received_items && po.received_items.length > 0) {
                const receivedItem = po.received_items.find(ri => ri.item_index === idx);
                if (receivedItem && receivedItem.last_received_date) {
                  lastReceivedDate = receivedItem.last_received_date;
                } else if (receivedItem && receivedItem.receipt_history && receivedItem.receipt_history.length > 0) {
                  const lastReceipt = receivedItem.receipt_history[receivedItem.receipt_history.length - 1];
                  lastReceivedDate = lastReceipt.date;
                }
              }
              
              allItemsList.push({
                po_id: po.id,
                po_number: po.po_number,
                po_date: po.po_date,
                po_status: po.status,
                company_name: po.company_name,
                company_address: po.company_address,
                customer_name: po.customer_name,
                customer_mobile: po.customer_mobile,
                customer_email: po.customer_email,
                department: po.department,
                gst_number: po.gst_number,
                delivery_date: po.delivery_date,
                total_amount: po.total_amount,
                item_index: idx,
                item_name: item.item_name,
                item_description: item.item_description || '',
                ordered_quantity: orderedQty,
                received_quantity: receivedQty,
                pending_quantity: pendingQty,
                length: item.length,
                width: item.width,
                unit: item.unit || 'PCS',
                buy_price: item.buy_price || 0,
                total_value: orderedQty * (item.buy_price || 0),
                received_value: receivedQty * (item.buy_price || 0),
                pending_value: pendingQty * (item.buy_price || 0),
                is_fully_received: isFullyReceived,
                receipt_percentage: orderedQty > 0 ? (receivedQty / orderedQty) * 100 : 0,
                status: po.status,
                last_received_date: lastReceivedDate
              });
            });
          }
        });
        setAllItems(allItemsList);
        
        if (pos.length === 0) {
          // toast.info("No purchase orders found");
        } else {
          // toast.success(`Loaded ${pos.length} purchase order(s) with ${allItemsList.length} items`);
        }
      } else {
        setError("Failed to load purchase orders");
        toast.error("Failed to load purchase orders");
      }
    } catch (err) {
      console.error("Error loading purchase orders:", err);
      setError(err.response?.data?.error || "Error loading purchase orders");
      toast.error(err.response?.data?.error || "Error loading purchase orders");
    } finally {
      setLoading(false);
    }
  };

  // Calculate count for an item (Length × Width × Quantity)
  const calculateCount = (length, width, quantity) => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const qty = parseFloat(quantity) || 0;
    
    if (l > 0 && w > 0 && qty > 0) {
      return l * w * qty;
    }
    return 0;
  };

  // Format count for display
  const formatCount = (count) => {
    if (count === 0 || count === null || count === undefined) return '-';
    return count.toFixed(2);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Handle receiving items
  const handleReceiveItems = (po) => {
    setSelectedPO(po);
    
    const initialReceivingData = {};
    const initialRemarks = {};
    
    if (po.items) {
      po.items.forEach((_, index) => {
        initialReceivingData[index] = 0;
        initialRemarks[index] = "";
      });
    }
    
    setReceivingData(initialReceivingData);
    setRemarks(initialRemarks);
    setShowReceiptModal(true);
  };

  // Update receiving quantity for an item
  const updateReceivingQuantity = (itemIndex, value) => {
    const maxQty = getPendingQuantity(itemIndex);
    const newValue = parseFloat(value) || 0;
    
    if (newValue <= maxQty && newValue >= 0) {
      setReceivingData({
        ...receivingData,
        [itemIndex]: newValue
      });
    } else if (newValue > maxQty) {
      toast.warning(`Cannot receive more than ${maxQty} for this item`);
      setReceivingData({
        ...receivingData,
        [itemIndex]: maxQty
      });
    }
  };

  // Get pending quantity for an item
  const getPendingQuantity = (itemIndex) => {
    const item = selectedPO?.items[itemIndex];
    if (!item) return 0;
    return item.remaining_quantity || 0;
  };

  // Get received quantity for an item
  const getReceivedQuantity = (itemIndex) => {
    const item = selectedPO?.items[itemIndex];
    if (!item) return 0;
    return item.delivered_quantity || 0;
  };

  // Submit received items
  const submitReceipt = async () => {
    const hasReceipts = Object.values(receivingData).some(qty => qty > 0);
    
    if (!hasReceipts) {
      toast.error("Please enter at least one item quantity to receive");
      return;
    }
    
    setSubmitting(true);
    try {
      const receivedQuantities = selectedPO.items.map((item, index) => ({
        item_index: index,
        received_quantity: receivingData[index] || 0,
        remarks: remarks[index] || ""
      })).filter(item => item.received_quantity > 0);
      
      console.log("Submitting receipt:", receivedQuantities);
      
      const response = await axios.post(`${API_BASE_URL}/receive-items/${selectedPO.id}`, {
        received_quantities: receivedQuantities
      });
      
      if (response.data.success) {
        toast.success(response.data.message || "Items received successfully!");
        setShowReceiptModal(false);
        setReceivingData({});
        setRemarks({});
        await fetchAllPurchaseOrders();
      } else {
        toast.error(response.data.error || "Error receiving items");
      }
    } catch (err) {
      console.error("Error receiving items:", err);
      toast.error(err.response?.data?.error || "Error receiving items");
    } finally {
      setSubmitting(false);
    }
  };

  // View receipt history
  const viewReceiptHistory = async (po) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/receipt-history/${po.id}`);
      if (res.data.success) {
        setReceiptHistory(res.data.data);
      } else {
        toast.error("Failed to load receipt history");
      }
    } catch (err) {
      console.error("Error loading receipt history:", err);
      toast.error(err.response?.data?.error || "Error loading receipt history");
    }
  };

  // Refresh data
  const refreshData = () => {
    fetchAllPurchaseOrders();
    toast.info("Refreshing purchase orders...");
  };

  // Calculate totals for a PO
  const calculateTotalOrdered = (items) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.quantity) || parseFloat(item.original_quantity) || 0), 0);
  };

  const calculateTotalReceived = (items) => {
    if (!items) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.delivered_quantity) || 0), 0);
  };

  const calculateTotalPending = (items) => {
    if (!items) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item.remaining_quantity) || 0), 0);
  };

  const calculateTotalPendingValue = (items) => {
    if (!items) return 0;
    return items.reduce((sum, item) => sum + ((item.remaining_quantity || 0) * (item.buy_price || 0)), 0);
  };

  // Filter items based on selected status
  const getFilteredItems = () => {
    if (selectedStatus === "all") return allItems;
    
    // Status-based filters
    if (selectedStatus === "approved") return allItems.filter(item => item.status === "approved");
    if (selectedStatus === "completed") {
      return allItems.filter(item => 
        item.status === "completed" || 
        item.status === "converted_to_grn"
      );
    }
    
    // Delivery-based filters
    if (selectedStatus === "pending") {
      return allItems.filter(item => 
        item.pending_quantity > 0 || 
        item.status === "partially_received"
      );
    }
    if (selectedStatus === "fully_received") return allItems.filter(item => item.is_fully_received);
    
    return allItems;
  };

  // Filter POs based on status
  const getFilteredPOs = () => {
    let filtered = purchaseOrders;
    
    if (selectedStatus === "pending") {
      filtered = purchaseOrders.filter(po => 
        calculateTotalPending(po.items) > 0 || 
        po.status === "partially_received"
      );
    } else if (selectedStatus === "fully_received") {
      filtered = purchaseOrders.filter(po => calculateTotalPending(po.items) === 0);
    } else if (selectedStatus === "approved") {
      filtered = purchaseOrders.filter(po => po.status === "approved");
    } else if (selectedStatus === "completed") {
      filtered = purchaseOrders.filter(po => 
        po.status === "completed" || 
        po.status === "converted_to_grn"
      );
    }
    
    return filtered;
  };

  const filteredItems = getFilteredItems();
  const filteredPOs = getFilteredPOs();

  // Check if PO has any pending items that can be received
  const hasPendingItemsForReceipt = (po) => {
    if (!po.items) return false;
    return po.items.some(item => (item.remaining_quantity || 0) > 0);
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    const s = (status || "").toLowerCase();
    switch(s) {
      case 'approved': return 'bg-success';
      case 'pending': return 'bg-warning';
      case 'rejected': return 'bg-danger';
      case 'completed': 
      case 'converted_to_grn': return 'bg-info';
      case 'partially_received': return 'bg-primary';
      default: return 'bg-secondary';
    }
  };

  const getItemStatusBadge = (item) => {
    if (item.pending_quantity === 0) return 'bg-success';
    if (item.received_quantity === 0) return 'bg-danger';
    return 'bg-warning';
  };

  const getItemStatusText = (item) => {
    if (item.pending_quantity === 0) return 'Fully Received';
    if (item.received_quantity === 0) return 'Not Received';
    return 'Partially Received';
  };

  // Get status badge for PO
  const getPOStatusBadgeClass = (po) => {
    const totalReceived = calculateTotalReceived(po.items);
    const totalOrdered = calculateTotalOrdered(po.items);
    
    if (totalReceived === 0) return 'bg-secondary';
    if (totalReceived < totalOrdered) return 'bg-warning';
    if (po.status === 'completed') return 'bg-info';
    return getStatusBadgeClass(po.status);
  };

  const getPOStatusText = (po) => {
    if (!po) return '-';
    
    const totalReceived = calculateTotalReceived(po.items);
    const totalOrdered = calculateTotalOrdered(po.items);
    
    if (po.status === 'converted_to_grn') return 'Converted to GRN';
    if (po.status === 'partially_received') return 'Partially Received';
    
    if (totalReceived === 0) return 'Not Started';
    if (totalReceived < totalOrdered) return 'Partially Received';
    if (totalReceived === totalOrdered && totalOrdered > 0) return 'Fully Received';
    
    return po.status;
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['PO Number', 'PO Date', 'PO Status', 'Company', 'Customer', 
                     'Item Name', 'Ordered Qty', 'Received Qty', 'Pending Qty', 
                     'Unit', 'Buy Price', 'Pending Value', 'Item Status', 'Last Received Date'];
    
    const csvData = filteredItems.map(item => [
      item.po_number,
      item.po_date,
      item.po_status,
      item.company_name,
      item.customer_name,
      item.item_name,
      item.ordered_quantity,
      item.received_quantity,
      item.pending_quantity,
      item.unit,
      item.buy_price,
      item.pending_value,
      getItemStatusText(item),
      item.last_received_date ? new Date(item.last_received_date).toLocaleString() : ''
    ]);
    
    const csvContent = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_delivery_items_${new Date().toISOString().slice(0,19)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Export completed!");
  };

  // Calculate summary statistics
  const getSummary = () => {
    const totalPOs = purchaseOrders.length;
    const totalItems = allItems.length;
    const totalPendingItems = allItems.filter(item => item.pending_quantity > 0).length;
    const totalOrderedQty = allItems.reduce((sum, item) => sum + item.ordered_quantity, 0);
    const totalReceivedQty = allItems.reduce((sum, item) => sum + item.received_quantity, 0);
    const totalPendingQty = allItems.reduce((sum, item) => sum + item.pending_quantity, 0);
    const totalValue = allItems.reduce((sum, item) => sum + item.total_value, 0);
    const totalReceivedValue = allItems.reduce((sum, item) => sum + item.received_value, 0);
    const totalPendingValue = allItems.reduce((sum, item) => sum + item.pending_value, 0);
    const completionRate = totalOrderedQty > 0 ? (totalReceivedQty / totalOrderedQty) * 100 : 0;
    
    return { 
      totalPOs, totalItems, totalPendingItems, totalOrderedQty, totalReceivedQty, 
      totalPendingQty, totalValue, totalReceivedValue, totalPendingValue, completionRate 
    };
  };

  const summary = getSummary();

  // Toggle PO expansion
  const togglePOExpansion = (poId) => {
    if (expandedPO === poId) {
      setExpandedPO(null);
    } else {
      setExpandedPO(poId);
    }
  };

  return (
    <div className="container-fluid mt-4">
      

      <div className="card shadow border-0">
        <div className="card-header bg-primary text-white">
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="mb-0">
              <FaClipboardList className="me-2" />
              All Delivery Items - Complete Overview
            </h3>
            <div>
              <button 
                className="btn btn-light btn-sm me-2"
                onClick={refreshData}
                disabled={loading}
                title="Refresh"
              >
                {loading ? <FaSpinner className="spinner" /> : <FaSync className="me-1" />}
                Refresh
              </button>
              <button 
                className="btn btn-light btn-sm"
                onClick={exportToCSV}
                disabled={allItems.length === 0}
                title="Export to CSV"
              >
                <FaDownload className="me-1" />
                Export
              </button>
            </div>
          </div>
        </div>

        <div className="card-body">
          {/* Summary Cards */}
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card bg-primary text-white">
                <div className="card-body">
                  <h6 className="card-title">Total POs</h6>
                  <h2 className="mb-0">{summary.totalPOs}</h2>
                  <small>{filteredPOs.length} shown</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-info text-white">
                <div className="card-body">
                  <h6 className="card-title">Total Items</h6>
                  <h2 className="mb-0">{summary.totalItems}</h2>
                  <small>{summary.totalPendingItems} pending</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-success text-white">
                <div className="card-body">
                  <h6 className="card-title">Completion Rate</h6>
                  <h2 className="mb-0">{summary.completionRate.toFixed(1)}%</h2>
                  <small>{summary.totalReceivedQty} / {summary.totalOrderedQty} units</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-warning text-white">
                <div className="card-body">
                  <h6 className="card-title">Pending Value</h6>
                  <h2 className="mb-0">
                    ₹{summary.totalPendingValue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                  </h2>
                  <small>Out of ₹{summary.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</small>
                </div>
              </div>
            </div>
          </div>

          {/* Status Filter */}
          <div className="row mb-3">
            <div className="col-md-8">
              <div className="btn-group flex-wrap" role="group">
                <button 
                  className={`btn ${selectedStatus === 'all' ? 'btn-primary' : 'btn-outline-secondary'} mb-1`}
                  onClick={() => setSelectedStatus('all')}
                >
                  <FaChartLine className="me-1" />
                  All Items
                </button>
                <button 
                  className={`btn ${selectedStatus === 'approved' ? 'btn-primary' : 'btn-outline-secondary'} mb-1`}
                  onClick={() => setSelectedStatus('approved')}
                >
                  <FaFileInvoice className="me-1" />
                  Approved
                </button>
                <button 
                  className={`btn ${selectedStatus === 'pending' ? 'btn-primary' : 'btn-outline-secondary'} mb-1`}
                  onClick={() => setSelectedStatus('pending')}
                >
                  <FaBox className="me-1" />
                  Partially Received
                </button>
                <button 
                  className={`btn ${selectedStatus === 'fully_received' ? 'btn-primary' : 'btn-outline-secondary'} mb-1`}
                  onClick={() => setSelectedStatus('fully_received')}
                >
                  <FaCheck className="me-1" />
                  Fully Received
                </button>
                <button 
                  className={`btn ${selectedStatus === 'completed' ? 'btn-primary' : 'btn-outline-secondary'} mb-1`}
                  onClick={() => setSelectedStatus('completed')}
                >
                  <FaHistory className="me-1" />
                  Completed / GRN
                </button>
              </div>
            </div>
            <div className="col-md-4 text-end">
              <div className="btn-group" role="group">
                <button 
                  className={`btn ${viewMode === 'all' ? 'btn-success' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('all')}
                >
                  <FaBox className="me-1" />
                  All Items
                </button>
                <button 
                  className={`btn ${viewMode === 'pos' ? 'btn-success' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('pos')}
                >
                  <FaBuilding className="me-1" />
                  Group by PO
                </button>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              <strong>Error!</strong> {error}
              <button type="button" className="btn-close" onClick={() => setError(null)}></button>
            </div>
          )}

          {/* Content based on view mode */}
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">Loading purchase orders...</p>
            </div>
          ) : viewMode === 'pos' ? (
            /* Purchase Orders Grouped View */
            <div>
              {filteredPOs.length === 0 ? (
                <div className="text-center py-4">
                  <div className="text-muted">
                    <FaBox className="fa-2x mb-2" style={{ fontSize: '2rem' }} />
                    <p>No purchase orders found for the selected filter</p>
                  </div>
                </div>
              ) : (
                filteredPOs.map((po) => {
                  const totalOrderedQty = calculateTotalOrdered(po.items);
                  const totalReceivedQty = calculateTotalReceived(po.items);
                  const totalPendingQty = calculateTotalPending(po.items);
                  const totalPendingValue = calculateTotalPendingValue(po.items);
                  const receiptProgress = totalOrderedQty > 0 ? (totalReceivedQty / totalOrderedQty) * 100 : 0;
                  const isExpanded = expandedPO === po.id;
                  const canReceive = hasPendingItemsForReceipt(po);
                  
                  return (
                    <div key={po.id} className="card mb-3">
                      <div 
                        className="card-header bg-light cursor-pointer" 
                        onClick={() => togglePOExpansion(po.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="row align-items-center">
                          <div className="col-md-3">
                            <strong className="text-primary">
                              <FaFileInvoice className="me-2" />
                              {po.po_number}
                            </strong>
                          </div>
                          <div className="col-md-2">
                            <FaCalendarAlt className="me-1 text-secondary" />
                            {po.po_date?.slice(0, 10)}
                          </div>
                          <div className="col-md-3">
                            <FaBuilding className="me-1" />
                            {po.company_name}
                          </div>
                          <div className="col-md-2">
                            <span className={`badge ${getPOStatusBadgeClass(po)}`}>
                              {getPOStatusText(po)}
                            </span>
                          </div>
                          <div className="col-md-2 text-end">
                            <button
                              className="btn btn-sm btn-outline-success me-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReceiveItems(po);
                              }}
                              disabled={!canReceive}
                              title={!canReceive ? "No pending items" : "Receive Items"}
                            >
                              <FaTruck className="me-1" />
                              Receive
                            </button>
                            <button
                              className="btn btn-sm btn-outline-info"
                              onClick={(e) => {
                                e.stopPropagation();
                                viewReceiptHistory(po);
                              }}
                              title="View Receipt History"
                            >
                              <FaHistory />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="card-body">
                          {/* PO Details */}
                          <div className="row mb-3">
                            <div className="col-md-6">
                              <p className="mb-1"><strong>Customer:</strong> {po.customer_name}</p>
                              <p className="mb-1"><strong>Contact:</strong> {po.customer_mobile || '-'}</p>
                              <p className="mb-1"><strong>Email:</strong> {po.customer_email || '-'}</p>
                              {po.delivery_date && (
                                <p className="mb-1"><strong>Delivery Date:</strong> {po.delivery_date?.slice(0, 10)}</p>
                              )}
                            </div>
                            <div className="col-md-6">
                              <p className="mb-1"><strong>Total Amount:</strong> ₹{parseFloat(po.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                              <p className="mb-1"><strong>Receipt Progress:</strong></p>
                              <div className="progress" style={{ height: '8px' }}>
                                <div 
                                  className="progress-bar bg-success" 
                                  style={{ width: `${receiptProgress}%` }}
                                />
                              </div>
                              <small className="text-muted">
                                {totalReceivedQty} of {totalOrderedQty} units received
                              </small>
                            </div>
                          </div>
                          
                          {/* Items Table */}
                          <div className="table-responsive">
                            <table className="table table-bordered table-hover">
                              <thead className="table-dark">
                                <tr>
                                  <th>#</th>
                                  <th>Item Name</th>
                                  <th>Description</th>
                                  <th>Dimensions</th>
                                  <th>Ordered Qty</th>
                                  <th>Received Qty</th>
                                  <th>Pending Qty</th>
                                  <th>Unit</th>
                                  <th>Buy Price</th>
                                  <th>Pending Value</th>
                                  <th>Last Received</th>
                                  <th>Status</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {po.items.map((item, idx) => {
                                  const orderedQty = item.original_quantity || item.quantity || 0;
                                  const receivedQty = item.delivered_quantity || 0;
                                  const pendingQty = item.remaining_quantity || 0;
                                  const hasDimensions = item.length && item.width && 
                                    parseFloat(item.length) > 0 && parseFloat(item.width) > 0;
                                  
                                  // Get last received date for this item
                                  let lastReceivedDate = '-';
                                  if (po.received_items && po.received_items.length > 0) {
                                    const receivedItem = po.received_items.find(ri => ri.item_index === idx);
                                    if (receivedItem && receivedItem.last_received_date) {
                                      lastReceivedDate = formatDate(receivedItem.last_received_date);
                                    } else if (receivedItem && receivedItem.receipt_history && receivedItem.receipt_history.length > 0) {
                                      const lastReceipt = receivedItem.receipt_history[receivedItem.receipt_history.length - 1];
                                      lastReceivedDate = formatDate(lastReceipt.date);
                                    }
                                  }
                                  
                                  return (
                                    <tr key={idx}>
                                      <td className="text-center">{idx + 1}</td>
                                      <td className="fw-bold">{item.item_name}</td>
                                      <td>{item.item_description || '-'}</td>
                                      <td className="text-center">
                                        {hasDimensions ? (
                                          <span className="badge bg-info">
                                            {item.length} × {item.width}
                                          </span>
                                        ) : '-'}
                                      </td>
                                      <td className="text-center">{orderedQty}</td>
                                      <td className="text-center text-success">{receivedQty}</td>
                                      <td className="text-center fw-bold text-warning">{pendingQty}</td>
                                      <td className="text-center">{item.unit || 'PCS'}</td>
                                      <td className="text-end">₹{(item.buy_price || 0).toFixed(2)}</td>
                                      <td className="text-end text-danger">
                                        ₹{(pendingQty * (item.buy_price || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="text-center">
                                        {lastReceivedDate !== '-' ? (
                                          <span className="badge bg-info">
                                            <FaClock className="me-1" />
                                            {lastReceivedDate}
                                          </span>
                                        ) : '-'}
                                      </td>
                                      <td className="text-center">
                                        <span className={`badge ${getItemStatusBadge({ pendingQty, receivedQty })}`}>
                                          {getItemStatusText({ pendingQty, receivedQty })}
                                        </span>
                                      </td>
                                      <td className="text-center">
                                        {pendingQty > 0 && (
                                          <button
                                            className="btn btn-sm btn-outline-success"
                                            onClick={() => handleReceiveItems(po)}
                                          >
                                            <FaCheck className="me-1" />
                                            Receive
                                          </button>
                                        )}
                                        {pendingQty === 0 && (
                                          <span className="text-success">
                                            <FaCheck className="me-1" />
                                            Complete
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="table-light">
                                <tr className="fw-bold">
                                  <td colSpan="4" className="text-end">Totals:</td>
                                  <td className="text-center">{totalOrderedQty}</td>
                                  <td className="text-center text-success">{totalReceivedQty}</td>
                                  <td className="text-center text-warning">{totalPendingQty}</td>
                                  <td colSpan="2"></td>
                                  <td className="text-end text-danger">
                                    ₹{totalPendingValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td colSpan="2"></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* All Items List View */
            <div className="table-responsive">
              <table className="table table-hover table-bordered">
                <thead className="table-dark">
                  <tr>
                    <th>PO Number</th>
                    <th>PO Date</th>
                    <th>PO Status</th>
                    <th>Company</th>
                    <th>Customer</th>
                    <th>Item Name</th>
                    <th>Description</th>
                    <th>Dimensions</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>Pending</th>
                    <th>Unit</th>
                    <th>Buy Price</th>
                    <th>Pending Value</th>
                    <th>Last Received</th>
                    <th>Item Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="17" className="text-center py-4">
                        <div className="text-muted">
                          <FaBox className="fa-2x mb-2" style={{ fontSize: '2rem' }} />
                          <p>No items found for the selected filter</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const po = purchaseOrders.find(p => p.id === item.po_id);
                      const hasDimensions = item.length && item.width && 
                        parseFloat(item.length) > 0 && parseFloat(item.width) > 0;
                      const canReceiveItem = item.pending_quantity > 0;
                      
                      return (
                        <tr key={idx}>
                          <td className="fw-bold text-primary">{item.po_number}</td>
                          <td>{item.po_date?.slice(0, 10)}</td>
                          <td>
                            <span className={`badge ${getPOStatusBadgeClass(po)}`}>
                              {getPOStatusText(po)}
                            </span>
                          </td>
                          <td>{item.company_name}</td>
                          <td>{item.customer_name}</td>
                          <td className="fw-bold">{item.item_name}</td>
                          <td>{item.item_description || '-'}</td>
                          <td className="text-center">
                            {hasDimensions ? (
                              <span className="badge bg-info">
                                {item.length} × {item.width}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="text-center fw-bold">{item.ordered_quantity}</td>
                          <td className="text-center text-success">{item.received_quantity}</td>
                          <td className="text-center fw-bold text-warning">{item.pending_quantity}</td>
                          <td className="text-center">{item.unit}</td>
                          <td className="text-end">₹{item.buy_price.toFixed(2)}</td>
                          <td className="text-end text-danger">
                            ₹{item.pending_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-center">
                            {item.last_received_date ? (
                              <span className="badge bg-info">
                                <FaClock className="me-1" />
                                {formatDate(item.last_received_date)}
                              </span>
                            ) : '-'}
                           </td>
                          <td className="text-center">
                            <span className={`badge ${getItemStatusBadge(item)}`}>
                              {getItemStatusText(item)}
                            </span>
                          </td>
                          <td className="text-center">
                            {canReceiveItem ? (
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() => po && handleReceiveItems(po)}
                                title="Receive Items"
                              >
                                <FaCheck className="me-1" />
                                Receive
                              </button>
                            ) : item.pending_quantity === 0 ? (
                              <span className="text-success">
                                <FaCheck className="me-1" />
                                Complete
                              </span>
                            ) : (
                              <span className="text-muted" title="Cannot receive">
                                <FaTimesCircle className="me-1" />
                                Not Available
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="table-light">
                  <tr className="fw-bold">
                    <td colSpan="8" className="text-end">Totals:</td>
                    <td className="text-center">{filteredItems.reduce((sum, i) => sum + i.ordered_quantity, 0)}</td>
                    <td className="text-center text-success">{filteredItems.reduce((sum, i) => sum + i.received_quantity, 0)}</td>
                    <td className="text-center text-warning">{filteredItems.reduce((sum, i) => sum + i.pending_quantity, 0)}</td>
                    <td></td>
                    <td></td>
                    <td className="text-end text-danger">
                      ₹{filteredItems.reduce((sum, i) => sum + i.pending_value, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* RECEIPT MODAL */}
      {showReceiptModal && selectedPO && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <FaTruck className="me-2" />
                  Receive Items - {selectedPO.po_number}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowReceiptModal(false)}></button>
              </div>

              <div className="modal-body">
                {/* Order Summary */}
                <div className="card mb-4 border-success">
                  <div className="card-header bg-light">
                    <h6 className="mb-0 fw-bold">Order Summary</h6>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-6">
                        <p className="mb-1">
                          <strong>Company:</strong> {selectedPO.company_name}
                        </p>
                        <p className="mb-1">
                          <strong>Customer:</strong> {selectedPO.customer_name}
                        </p>
                        <p className="mb-1">
                          <strong>PO Date:</strong> {selectedPO.po_date?.slice(0, 10)}
                        </p>
                        {selectedPO.delivery_date && (
                          <p className="mb-1">
                            <strong>Delivery Date:</strong> {selectedPO.delivery_date?.slice(0, 10)}
                          </p>
                        )}
                      </div>
                      <div className="col-md-6">
                        <p className="mb-1">
                          <strong>Total Amount:</strong> 
                          <span className="text-success fw-bold ms-2">
                            ₹{parseFloat(selectedPO.total_amount || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        </p>
                        <p className="mb-1">
                          <strong>Status:</strong>
                          <span className={`badge ${getStatusBadgeClass(selectedPO.status)} ms-2`}>{selectedPO.status}</span>
                        </p>
                        <div className="mt-2">
                          <strong>Receipt Progress:</strong>
                          <div className="progress mt-1" style={{ height: '8px' }}>
                            <div 
                              className="progress-bar bg-success" 
                              style={{ width: `${(calculateTotalReceived(selectedPO.items) / calculateTotalOrdered(selectedPO.items)) * 100}%` }}
                            />
                          </div>
                          <small className="text-muted">
                            {calculateTotalReceived(selectedPO.items)} of {calculateTotalOrdered(selectedPO.items)} units received
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items to Receive */}
                <h6 className="fw-bold mb-3">
                  <FaBox className="me-2 text-success" />
                  Items to Receive
                </h6>
                
                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Item Name</th>
                        <th>Dimensions (L×W)</th>
                        <th>Ordered Qty</th>
                        <th>Already Received</th>
                        <th>Pending Qty</th>
                        <th>Unit</th>
                        <th>Receive Qty *</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items.map((item, index) => {
                        const pendingQty = getPendingQuantity(index);
                        const receivedQty = getReceivedQuantity(index);
                        const hasDimensions = item.length && item.width && 
                          parseFloat(item.length) > 0 && parseFloat(item.width) > 0;
                        
                        if (pendingQty === 0) return null;
                        
                        return (
                          <tr key={index}>
                            <td className="fw-bold text-center">{index + 1}</td>
                            <td className="fw-bold">
                              {item.item_name}
                              {item.item_description && (
                                <small className="d-block text-muted">{item.item_description}</small>
                              )}
                            </td>
                            <td className="text-center">
                              {hasDimensions ? (
                                <span className="badge bg-info">
                                  {item.length} × {item.width}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="text-center fw-bold">{item.quantity}</td>
                            <td className="text-center text-success">{receivedQty}</td>
                            <td className="text-center text-warning fw-bold">{pendingQty}</td>
                            <td className="text-center">{item.unit || 'PCS'}</td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                min="0"
                                max={pendingQty}
                                step="1"
                                value={receivingData[index] || 0}
                                onChange={(e) => updateReceivingQuantity(index, e.target.value)}
                                disabled={pendingQty === 0 || submitting}
                              />
                              {pendingQty > 0 && (
                                <small className="text-muted d-block">
                                  Max: {pendingQty}
                                </small>
                              )}
                              {hasDimensions && receivingData[index] > 0 && (
                                <small className="text-info d-block">
                                  Count: {formatCount(calculateCount(item.length, item.width, receivingData[index]))}
                                </small>
                              )}
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Optional remarks"
                                value={remarks[index] || ""}
                                onChange={(e) => setRemarks({...remarks, [index]: e.target.value})}
                                disabled={submitting}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Receipt Summary */}
                <div className="alert alert-info mt-3">
                  <div className="row">
                    <div className="col-md-4">
                      <strong>Total Ordered Qty:</strong> {calculateTotalOrdered(selectedPO.items)}
                    </div>
                    <div className="col-md-4">
                      <strong>Already Received Qty:</strong> {calculateTotalReceived(selectedPO.items)}
                    </div>
                    <div className="col-md-4">
                      <strong>Receiving Now Qty:</strong> 
                      <span className="text-success fw-bold ms-2">
                        {Object.values(receivingData).reduce((sum, qty) => sum + (parseFloat(qty) || 0), 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-success"
                  onClick={submitReceipt}
                  disabled={submitting || Object.values(receivingData).reduce((sum, qty) => sum + (parseFloat(qty) || 0), 0) === 0}
                >
                  {submitting ? <FaSpinner className="spinner me-2" /> : <FaSave className="me-2" />}
                  {submitting ? "Processing..." : "Confirm Receipt"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowReceiptModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT HISTORY MODAL */}
      {receiptHistory && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">
                  <FaHistory className="me-2" />
                  Receipt History - {receiptHistory.po_number}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setReceiptHistory(null)}></button>
              </div>

              <div className="modal-body">
                {receiptHistory.received_items && receiptHistory.received_items.length > 0 ? (
                  receiptHistory.received_items.map((item, idx) => {
                    return (
                      <div key={idx} className="card mb-3">
                        <div className="card-header bg-light">
                          <strong>{item.item_name}</strong>
                          <span className="float-end">
                            Ordered: {item.ordered_quantity} | 
                            Received: {item.received_quantity} | 
                            Pending: {item.pending_quantity}
                          </span>
                        </div>
                        <div className="card-body">
                          {item.receipt_history && item.receipt_history.length > 0 ? (
                            <div className="table-responsive">
                              <table className="table table-sm">
                                <thead>
                                  <tr>
                                    <th>Date & Time</th>
                                    <th>Quantity Received</th>
                                    <th>Remarks</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.receipt_history.map((history, hidx) => {
                                    return (
                                      <tr key={hidx}>
                                        <td>{formatDate(history.date)}</td>
                                        <td className="fw-bold text-success">{history.quantity}</td>
                                        <td>{history.remarks || '-'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-muted mb-0">No receipts recorded for this item</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="alert alert-info">
                    No receipts recorded for this purchase order yet.
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setReceiptHistory(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .progress {
          background-color: #e9ecef;
          border-radius: 10px;
        }
        .progress-bar {
          transition: width 0.3s ease;
          border-radius: 10px;
        }
        .table td, .table th {
          vertical-align: middle;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        .cursor-pointer {
          cursor: pointer;
        }
        .cursor-pointer:hover {
          background-color: #f8f9fa;
        }
        .btn-group {
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
};

export default AllDeliveryItemsPage;