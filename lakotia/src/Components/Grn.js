import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { API_BASE } from "../config";
import { 
  FaEye, FaSearch, FaFileInvoice, FaBuilding, FaUser, 
  FaBox, FaTag, FaBarcode, FaRulerCombined, FaRupeeSign,
  FaHashtag, FaReceipt, FaCopy, FaCalendarAlt,
  FaCheckCircle, FaFileAlt, FaClipboardCheck, FaExternalLinkAlt,
  FaTruck, FaPercent, FaPlus, FaMinus, FaSync
} from "react-icons/fa";

const GRNPage = () => {
  const todayDate = new Date().toISOString().slice(0, 10);
  
  const [poNumber, setPoNumber] = useState("");
  const [poDetails, setPoDetails] = useState(null);
  const [grnList, setGrnList] = useState([]);
  const [openPopup, setOpenPopup] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterInvoice, setFilterInvoice] = useState("");
  const [mobileView, setMobileView] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [existingBatchCodes, setExistingBatchCodes] = useState(new Set());
  
  // State for POs ready for GRN (only completed status)
  const [posReadyForGRN, setPosReadyForGRN] = useState([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [pendingReceipts, setPendingReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  
  // Check if mobile view on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setMobileView(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Fetch POs ready for GRN and GRN list on component mount
  useEffect(() => {
    fetchPosReadyForGRN();
    fetchGRN();
    fetchAllBatchCodes();
  }, []);
  
  // Fetch all existing batch codes to prevent duplicates
  const fetchAllBatchCodes = async () => {
    try {
      const res = await axios.get(`${API_BASE}/grn/all-batch-codes`);
      if (res.data.success) {
        setExistingBatchCodes(new Set(res.data.data));
      }
    } catch (err) {
      console.log("Error fetching batch codes", err);
    }
  };
  
  // Fetch POs ready for GRN (status = completed and not fully processed)
  const fetchPosReadyForGRN = async () => {
    setLoadingPOs(true);
    try {
      // Fetch POs with status "completed" that are ready for GRN
      const res = await axios.get(`${API_BASE}/grn/ready-for-grn?status=completed`);
      if (res.data.success) {
        setPosReadyForGRN(res.data.data);
      }
    } catch (err) {
      console.log("Error loading POs ready for GRN", err);
      toast.error("Error loading purchase orders");
    } finally {
      setLoadingPOs(false);
    }
  };
  
  // Fetch GRN records
  const fetchGRN = async () => {
    try {
      const res = await axios.get(`${API_BASE}/grn/all`);
      if (res.data.success) setGrnList(res.data.data);
    } catch (err) {
      console.log("Error loading GRN", err);
      toast.error("Error loading GRN records");
    }
  };
  
  // Handle PO selection from buttons
  const handlePOSelect = (poNumber) => {
    setPoNumber(poNumber);
    fetchPODetails(poNumber);
  };
  
  // Generate unique batch code with duplicate prevention
  const generateUniqueBatchCode = async (brand, date, index, retryCount = 0) => {
    const brandPrefix = (brand || "GEN").substring(0, 3).toUpperCase();
    const formattedDate = date.replace(/-/g, "");
    let sequence = String(index + 1).padStart(3, '0');
    
    // Add random suffix for uniqueness if retrying
    if (retryCount > 0) {
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      sequence = `${sequence}${randomSuffix}`;
    }
    
    let batchCode = `${brandPrefix}-${formattedDate}-${sequence}`;
    
    // Limit sequence length if too long
    if (batchCode.length > 50) {
      batchCode = batchCode.substring(0, 50);
    }
    
    // Check if batch code already exists
    if (existingBatchCodes.has(batchCode) || batchCodeExistsInCurrentItems(batchCode)) {
      if (retryCount < 10) {
        // Recursively try with incremented retry count
        return generateUniqueBatchCode(brand, date, index + 100, retryCount + 1);
      } else {
        // Fallback with timestamp
        const timestamp = Date.now().toString().slice(-6);
        batchCode = `${brandPrefix}-${formattedDate}-${timestamp}`;
      }
    }
    
    return batchCode;
  };
  
  // Check if batch code exists in current selected items
  const batchCodeExistsInCurrentItems = (batchCode) => {
    return selectedItems.some(item => item.batch_code === batchCode);
  };
  
  // Generate batch codes for all selected items automatically
  const generateBatchCodesAutomatically = async () => {
    const today = todayDate;
    const brandCounts = {};
    const updatedItems = [...selectedItems];
    
    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      if (!item.selected || !item.received_quantity || item.received_quantity <= 0) continue;
      
      const brand = item.brand || "GENERIC";
      const brandKey = `${brand}_${today}`;
      
      if (!brandCounts[brandKey]) {
        brandCounts[brandKey] = 0;
      }
      brandCounts[brandKey]++;
      
      const batchNumber = brandCounts[brandKey];
      const batchCode = await generateUniqueBatchCode(brand, today, batchNumber - 1);
      
      updatedItems[i].batch_code = batchCode;
    }
    
    setSelectedItems(updatedItems);
  };
  
  // Auto-generate batch codes when items change
  useEffect(() => {
    if (selectedItems.length > 0 && openPopup) {
      const hasEmptyBatchCodes = selectedItems.some(
        item => item.selected && item.received_quantity > 0 && !item.batch_code
      );
      if (hasEmptyBatchCodes) {
        generateBatchCodesAutomatically();
      }
    }
  }, [selectedItems, openPopup]);
  
  // Fetch PO details by PO number
  const fetchPODetails = async (poNum = null) => {
    const poToFetch = poNum || poNumber;
    
    if (!poToFetch.trim()) {
      toast.error("Please enter or select a PO Number");
      return;
    }
    
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/grn/get-po/${poToFetch}`);
      if (!res.data.success) {
        toast.error(res.data.message || "PO not found");
        setPoDetails(null);
        return;
      }
      const poData = res.data.data;
      
      setPoDetails(poData);
      
      // Get pending receipts list
      const receipts = poData.pending_receipts || [];
      setPendingReceipts(receipts);
      
      if (receipts.length === 0) {
        toast.error("No pending receipts found for this PO");
        setPoDetails(null);
        return;
      }
      
      if (receipts.length === 1) {
        selectReceiptForGRN(receipts[0], poData);
      } else {
        setSelectedReceipt(null);
        setSelectedItems([]);
        setOpenPopup(true);
        toast.info(`This PO has ${receipts.length} pending receipts available.`);
      }
    } catch (err) {
      toast.error("Error fetching PO details");
      console.error("Error fetching PO:", err);
      setPoDetails(null);
    } finally {
      setLoading(false);
    }
  };
  
  // Select a specific pending receipt to generate GRN
  const selectReceiptForGRN = (receipt, poData = poDetails) => {
    setSelectedReceipt(receipt);
    
    if (receipt && receipt.items) {
      const itemsWithBatch = receipt.items.map((item, index) => ({
        ...item,
        selected: true,
        batch_code: "",
        hsn_code: item.hsn_code || "",
        brand_description: item.brand_description || "",
        buy_price: item.buy_price || 0,
        brand: item.brand || "",
        brand_code: item.brand_code || "",
        index: index,
        received_quantity: item.received_quantity || 0,
        delivered_quantity: item.received_quantity || 0, // set max available limit
        original_quantity: item.original_quantity || item.quantity,
        item_name: item.item_name
      }));
      
      setSelectedItems(itemsWithBatch);
      setOpenPopup(true);
    }
  };
  
  // Manual batch code generation for specific item
  const regenerateItemBatchCode = async (index) => {
    const item = selectedItems[index];
    if (!item.brand) {
      toast.error("Please enter brand name for this item first");
      return;
    }
    
    const today = todayDate;
    const batchCode = await generateUniqueBatchCode(item.brand, today, index);
    
    const updatedItems = [...selectedItems];
    updatedItems[index].batch_code = batchCode;
    setSelectedItems(updatedItems);
    toast.success("Batch code regenerated successfully!");
  };
  
  // Toggle item selection
  const toggleItemSelection = (index) => {
    const updatedItems = [...selectedItems];
    if (updatedItems[index].received_quantity > 0) {
      updatedItems[index].selected = !updatedItems[index].selected;
      if (!updatedItems[index].selected) {
        updatedItems[index].batch_code = "";
      } else if (!updatedItems[index].batch_code) {
        regenerateItemBatchCode(index);
      }
    } else {
      toast.warning("No received quantity for this item");
    }
    setSelectedItems(updatedItems);
  };
  
  // Select all items with received quantity
  const selectAllItems = () => {
    const updatedItems = selectedItems.map(item => ({
      ...item,
      selected: (item.received_quantity || 0) > 0
    }));
    setSelectedItems(updatedItems);
    
    // Generate batch codes for newly selected items
    setTimeout(() => {
      generateBatchCodesAutomatically();
    }, 100);
  };
  
  // Deselect all items
  const deselectAllItems = () => {
    const updatedItems = selectedItems.map(item => ({
      ...item,
      selected: false,
      batch_code: ""
    }));
    setSelectedItems(updatedItems);
  };
  
  // Handle item field changes
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...selectedItems];
    updatedItems[index][field] = value;
    
    // If brand changes, regenerate batch code
    if (field === 'brand' && updatedItems[index].selected && updatedItems[index].received_quantity > 0) {
      setTimeout(() => {
        regenerateItemBatchCode(index);
      }, 100);
    }
    
    setSelectedItems(updatedItems);
  };
  
  // Copy batch code to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success("Batch code copied to clipboard!"))
      .catch(() => toast.error("Failed to copy"));
  };
  
  // Submit GRN and update PO status
  const handleSubmitGRN = async () => {
    // Filter selected items that are selected and have received quantity > 0
    const itemsToSubmit = selectedItems
      .filter(item => item.selected && item.received_quantity > 0)
      .map(item => {
        const { selected, index, ...itemData } = item;
        return {
          ...itemData,
          quantity: item.received_quantity,
          batch_code: item.batch_code,
          hsn_code: item.hsn_code || "",
          brand_description: item.brand_description || "",
          buy_price: parseFloat(item.buy_price) || 0,
          length: item.length || "",
          width: item.width || ""
        };
      });
    
    if (itemsToSubmit.length === 0) {
      toast.error("Please select at least one item to generate GRN");
      return;
    }
    
    // Validate batch codes
    const itemsWithoutBatch = itemsToSubmit.filter(item => !item.batch_code);
    if (itemsWithoutBatch.length > 0) {
      toast.error(`Please generate batch codes for: ${itemsWithoutBatch.map(i => i.item_name).join(", ")}`);
      return;
    }
    
    // Check for duplicate batch codes
    const batchCodes = itemsToSubmit.map(item => item.batch_code);
    const uniqueBatchCodes = new Set(batchCodes);
    
    if (batchCodes.length !== uniqueBatchCodes.size) {
      const duplicates = batchCodes.filter((code, idx) => batchCodes.indexOf(code) !== idx);
      toast.error(`Duplicate batch codes detected: ${[...new Set(duplicates)].join(", ")}`);
      return;
    }
    
    // A GRN is partial if we're submitting less than the available quantity for any selected item,
    // or if some items are not selected but still have available quantity.
    const isGRNPartial = selectedItems.some(item => {
      if (item.selected) {
        return item.received_quantity < (item.delivered_quantity || 0);
      }
      return (item.delivered_quantity || 0) > 0;
    });

    try {
      const payload = {
        po_number: poNumber,
        items: itemsToSubmit,
        is_partial: isGRNPartial,
        receipt_id: selectedReceipt ? selectedReceipt.receipt_id : null
      };
      
      const res = await axios.post(`${API_BASE}/grn/save-from-po`, payload);
      
      if (res.data.success) {
        toast.success(res.data.message);
        setInvoiceNumber(res.data.invoice_number);
        
        // Update existing batch codes set
        itemsToSubmit.forEach(item => {
          if (item.batch_code) {
            setExistingBatchCodes(prev => new Set([...prev, item.batch_code]));
          }
        });
        
        // Refresh data
        await fetchPosReadyForGRN();
        await fetchGRN();
        
        // Reset and close
        setTimeout(() => {
          setOpenPopup(false);
          setPoDetails(null);
          setPoNumber("");
          setSelectedItems([]);
          setInvoiceNumber("");
          setSelectedReceipt(null);
          setPendingReceipts([]);
        }, 2000);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || "Error creating GRN");
      console.error("Error submitting GRN:", err);
    }
  };
  
  // View GRN details by invoice
  const viewGRNByInvoice = async (invoiceNumber) => {
    try {
      const res = await axios.get(`${API_BASE}/grn/invoice/${invoiceNumber}`);
      
      if (res.data.success) {
        setViewData(res.data.data);
      }
    } catch (err) {
      toast.error("Error loading GRN details");
      console.error(err);
    }
  };
  
  // Filter GRN list
  const filteredGRNList = grnList.filter(item => {
    const matchesSearch = searchTerm ? 
      item.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batch_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.hsn_code?.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    
    const matchesInvoice = filterInvoice ? 
      item.invoice_number === filterInvoice : true;
    
    return matchesSearch && matchesInvoice;
  });
  
  // Get unique invoice numbers
  const uniqueInvoices = [...new Set(grnList.map(item => item.invoice_number))].sort();
  
  // Group GRN by invoice
  const groupedGRN = filteredGRNList.reduce((acc, item) => {
    if (!acc[item.invoice_number]) {
      acc[item.invoice_number] = {
        invoice_number: item.invoice_number,
        invoice_date: item.invoice_date,
        po_number: item.po_number,
        company_name: item.company_name,
        customer_name: item.customer_name,
        gst_number: item.gst_number,
        items: [],
        total_amount: 0,
        item_count: 0,
        is_partial: item.is_partial || false
      };
    }
    acc[item.invoice_number].items.push(item);
    acc[item.invoice_number].total_amount += (item.quantity * item.buy_price);
    acc[item.invoice_number].item_count++;
    if (item.is_partial) acc[item.invoice_number].is_partial = true;
    return acc;
  }, {});
  
  // Mobile Card View for GRN List
  const MobileGRNCard = ({ invoice }) => {
    const isExpanded = expandedInvoice === invoice.invoice_number;
    
    return (
      <div className="card mb-3 border-primary">
        <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <FaFileInvoice className="text-primary" />
            <span className="fw-bold text-primary">{invoice.invoice_number}</span>
            {invoice.is_partial && (
              <span className="badge bg-warning text-dark">
                <FaPercent size={10} /> Partial
              </span>
            )}
          </div>
          <span className="badge bg-secondary">{invoice.item_count} items</span>
        </div>
        
        <div className="card-body py-2">
          <div className="row g-2">
            <div className="col-6">
              <small className="text-muted d-block">
                <FaCalendarAlt className="me-1" size={12} />
                {invoice.invoice_date}
              </small>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">
                <FaReceipt className="me-1" size={12} />
                {invoice.po_number}
              </small>
            </div>
            <div className="col-12">
              <small className="text-muted d-block">
                <FaBuilding className="me-1" size={12} />
                {invoice.company_name}
              </small>
            </div>
            <div className="col-12">
              <small className="text-muted d-block">
                <FaUser className="me-1" size={12} />
                {invoice.customer_name}
              </small>
            </div>
            <div className="col-8">
              <small className="fw-bold text-success">
                <FaRupeeSign className="me-1" />
                {parseFloat(invoice.total_amount).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </small>
            </div>
            <div className="col-4 text-end">
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => viewGRNByInvoice(invoice.invoice_number)}
              >
                <FaEye /> View
              </button>
            </div>
          </div>
          
          <button
            className="btn btn-link btn-sm text-decoration-none p-0 mt-2"
            onClick={() => setExpandedInvoice(isExpanded ? null : invoice.invoice_number)}
          >
            {isExpanded ? '▲ Show less' : '▼ Show items'}
          </button>
          
          {isExpanded && (
            <div className="mt-2 border-top pt-2">
              {invoice.items.map((item, idx) => (
                <div key={idx} className="mb-2 pb-2 border-bottom">
                  <div className="fw-bold small">{item.item_name}</div>
                  <div className="row g-1 mt-1">
                    <div className="col-6">
                      <small className="text-muted d-block">
                        <FaTag className="me-1" size={10} />
                        {item.brand || 'N/A'}
                      </small>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">
                        <FaHashtag className="me-1" size={10} />
                        {item.hsn_code || 'N/A'}
                      </small>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">
                        Qty: {item.quantity}
                      </small>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">
                        <FaRupeeSign className="me-1" size={10} />
                        {(item.quantity * item.buy_price).toFixed(2)}
                      </small>
                    </div>
                    <div className="col-12">
                      <small className="badge bg-dark text-white">
                        Batch: {item.batch_code}
                      </small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="container-fluid mt-2 mt-md-4 px-2 px-md-3">
      
      <div className="card shadow border-0">
        <div className="card-header bg-primary text-white py-2 py-md-3 d-flex justify-content-between align-items-center">
          <h3 className="mb-0 fs-5 fs-md-3">
            <FaFileInvoice className="me-2" />
            {mobileView ? "GRN Records" : "GRN Records (Goods Receipt Note)"}
          </h3>
          <a href="/grn" className="btn btn-warning btn-sm fw-bold">
            <FaTruck className="me-1" /> + Create New GRN
          </a>
        </div>
        
        <div className="card-body p-2 p-md-3">
          {/* PO Search Section */}
          <div className="row mb-3">
            <div className="col-12">
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <FaSearch />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder={mobileView ? "Enter PO Number" : "Enter PO Number (e.g., PO-202401-001)"}
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && fetchPODetails()}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => fetchPODetails()}
                  disabled={loading || !poNumber.trim()}
                  style={{ whiteSpace: mobileView ? 'nowrap' : 'normal' }}
                >
                  {loading ? "..." : mobileView ? "Fetch" : "Fetch PO"}
                </button>
              </div>
            </div>
          </div>
          
          {/* POs Ready for GRN Section - Only Completed POs */}
          <div className="card mb-4 border-primary">
            <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold text-primary fs-6">
                <FaTruck className="me-2" />
                {mobileView ? "Completed POs Ready for GRN" : "Completed Purchase Orders Ready for GRN"}
              </h5>
              <span className="badge bg-success">
                {posReadyForGRN.length}
              </span>
            </div>
            <div className="card-body p-2">
              {loadingPOs ? (
                <div className="text-center py-3">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 small">Loading...</p>
                </div>
              ) : posReadyForGRN.length === 0 ? (
                <div className="text-center py-4">
                  <FaFileAlt className="text-muted mb-2" size={32} />
                  <h6 className="text-muted small">No completed POs ready for GRN</h6>
                  <p className="text-muted small">Only POs with status 'Completed' will appear here</p>
                </div>
              ) : (
                <div className="row g-2">
                  {posReadyForGRN.map((po) => (
                    <div key={po.id} className="col-12 col-md-6 col-lg-4 mb-2">
                      <div className={`card h-100 ${po.delivery_status === 'partial' ? 'border-warning' : 'border-success'}`}>
                        <div className="card-body p-2">
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <h6 className="card-title fw-bold small text-truncate mb-0">
                              <FaReceipt className="me-1" />
                              {mobileView ? po.po_number.slice(0, 8) + '...' : po.po_number}
                            </h6>
                            <span className="badge bg-success small">
                              Completed
                            </span>
                          </div>
                          
                          <div className="mb-1">
                            <p className="mb-0 small">
                              <FaBuilding className="me-1" size={10} />
                              {mobileView ? po.company_name.slice(0, 10) + '...' : po.company_name}
                            </p>
                            <p className="mb-0 small">
                              <FaBox className="me-1" size={10} />
                              {po.received_items?.length || 0} items received
                            </p>
                            {po.delivery_status === 'partial' && po.remaining_amount && (
                              <p className="mb-0 small text-warning">
                                <FaRupeeSign className="me-1" size={10} />
                                Pending: ₹{parseFloat(po.remaining_amount).toLocaleString('en-IN')}
                              </p>
                            )}
                          </div>
                          
                          <button
                            className="btn btn-success btn-sm w-100"
                            onClick={() => handlePOSelect(po.po_number, po)}
                          >
                            <FaClipboardCheck className="me-1" size={10} />
                            Generate GRN
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Success Message with Invoice Number */}
          {invoiceNumber && (
            <div className="alert alert-success alert-dismissible fade show py-2">
              <small>
                <strong>Success!</strong> GRN: <strong>{invoiceNumber}</strong>
              </small>
              <button type="button" className="btn-close btn-close-sm" onClick={() => setInvoiceNumber("")}></button>
            </div>
          )}
          
          {/* GRN List Section */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-light py-2">
              <h5 className="mb-0 fw-bold fs-6">
                <FaFileInvoice className="me-2" />
                GRN Records
              </h5>
            </div>
            <div className="card-body p-2">
              {/* GRN Search and Filters */}
              <div className="row mb-3 g-2">
                <div className="col-12 col-md-4">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white">
                      <FaSearch />
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={mobileView ? "Search..." : "Search Invoice, PO, Customer..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-8 col-md-3">
                  <select 
                    className="form-select form-select-sm" 
                    value={filterInvoice}
                    onChange={(e) => setFilterInvoice(e.target.value)}
                  >
                    <option value="">All Invoices</option>
                    {uniqueInvoices.map(invoice => (
                      <option key={invoice} value={invoice}>
                        {mobileView ? invoice.slice(0, 8) + '...' : invoice}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-4 col-md-5 text-end">
                  <small className="text-muted">
                    {mobileView ? (
                      <>{Object.keys(groupedGRN).length} invoices</>
                    ) : (
                      <>Total: {grnList.length} | Invoices: {Object.keys(groupedGRN).length}</>
                    )}
                  </small>
                </div>
              </div>
              
              {/* GRN List - Mobile Card View */}
              {mobileView ? (
                <div className="grn-mobile-list">
                  {Object.keys(groupedGRN).length === 0 ? (
                    <div className="text-center py-4">
                      <FaFileInvoice className="text-muted mb-2" size={32} />
                      <p className="text-muted small">No GRN records found</p>
                    </div>
                  ) : (
                    Object.values(groupedGRN).map((invoice) => (
                      <MobileGRNCard key={invoice.invoice_number} invoice={invoice} />
                    ))
                  )}
                </div>
              ) : (
                /* Desktop Table View */
                <div className="table-responsive">
                  <table className="table table-hover table-bordered table-sm">
                    <thead className="table-dark">
                      <tr>
                        <th>Invoice No</th>
                        <th>Date</th>
                        <th>PO Number</th>
                        <th>Company</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Batch Codes</th>
                        <th>Total Amount</th>
                        <th>Type</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(groupedGRN).length === 0 ? (
                        <tr>
                          <td colSpan="10" className="text-center py-4">
                            <div className="text-muted">
                              <FaFileInvoice className="fa-2x mb-2" />
                              <p>No GRN records found</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        Object.values(groupedGRN).map((invoice) => (
                          <tr key={invoice.invoice_number}>
                            <td className="fw-bold text-primary">
                              <FaFileInvoice className="me-1" />
                              {invoice.invoice_number}
                            </td>
                            <td>
                              <FaCalendarAlt className="me-1 text-secondary" />
                              {invoice.invoice_date}
                            </td>
                            <td>
                              <FaReceipt className="me-1 text-secondary" />
                              {invoice.po_number}
                            </td>
                            <td>
                              <FaBuilding className="me-1" />
                              {invoice.company_name}
                            </td>
                            <td>
                              <FaUser className="me-1" />
                              {invoice.customer_name}
                            </td>
                            <td>
                              <span className="badge bg-secondary">
                                <FaBox className="me-1" />
                                {invoice.item_count} items
                              </span>
                            </td>
                            <td>
                              <div className="batch-codes">
                                {invoice.items.slice(0, 2).map((item, idx) => (
                                  <div key={idx} className="text-truncate" style={{ maxWidth: '120px' }}>
                                    <small className="badge bg-info text-dark">
                                      {item.batch_code}
                                    </small>
                                  </div>
                                ))}
                                {invoice.item_count > 2 && (
                                  <div className="text-muted">
                                    <small>+ {invoice.item_count - 2} more</small>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="fw-bold">
                              <FaRupeeSign className="me-1 text-success" />
                              {parseFloat(invoice.total_amount).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                            <td>
                              {invoice.is_partial ? (
                                <span className="badge bg-warning text-dark">
                                  <FaPercent className="me-1" size={10} />
                                  Partial
                                </span>
                              ) : (
                                <span className="badge bg-success">
                                  <FaCheckCircle className="me-1" size={10} />
                                  Full
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => viewGRNByInvoice(invoice.invoice_number)}
                                title="View Details"
                              >
                                <FaEye />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* CREATE GRN POPUP MODAL */}
      {openPopup && poDetails && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-scrollable modal-fullscreen-md-down modal-xl">
            <div className="modal-content">
              <div className="modal-header bg-success text-white py-2">
                <h5 className="modal-title fs-6">
                  <FaFileInvoice className="me-2" />
                  {selectedReceipt 
                    ? (mobileView ? `GRN: ${poNumber}` : `Generate GRN for Receipt - ${poNumber}`) 
                    : (mobileView ? `Select: ${poNumber}` : `Select Receipt Batch for GRN - ${poNumber}`)}
                </h5>
                <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setOpenPopup(false)}></button>
              </div>
              
              <div className="modal-body p-2">
                {/* PO Information */}
                <div className="card mb-3">
                  <div className="card-header bg-light py-2">
                    <h6 className="mb-0 fw-bold small">PO Information</h6>
                  </div>
                  <div className="card-body p-2">
                    <div className="row g-1">
                      <div className="col-6">
                        <small className="text-muted">PO Number:</small>
                        <div className="fw-bold small">{poDetails.po_number}</div>
                      </div>
                      <div className="col-6">
                        <small className="text-muted">Date:</small>
                        <div className="small">{poDetails.po_date?.slice(0, 10)}</div>
                      </div>
                      <div className="col-12">
                        <small className="text-muted">Company:</small>
                        <div className="small">{poDetails.company_name}</div>
                      </div>
                      <div className="col-12">
                        <small className="text-muted">Customer:</small>
                        <div className="small">{poDetails.customer_name}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {!selectedReceipt ? (
                  /* RECEIPT SELECTION VIEW */
                  <div className="card mb-3 border-primary shadow-sm">
                    <div className="card-header bg-primary text-white py-2">
                      <h6 className="mb-0 fw-bold small">
                        <FaTruck className="me-2" />
                        Select Receipt Batch to Process
                      </h6>
                    </div>
                    <div className="card-body p-2">
                      <p className="small text-muted mb-3">
                        This purchase order has multiple pending receipt batches. Please select a batch to generate its GRN document:
                      </p>
                      <div className="list-group">
                        {pendingReceipts.map((receipt, rIdx) => {
                          const dateStr = receipt.date ? new Date(receipt.date).toLocaleString('en-IN') : 'Unknown Date';
                          const totalQty = receipt.items.reduce((sum, i) => sum + i.received_quantity, 0);
                          return (
                            <button
                              key={receipt.receipt_id}
                              className="list-group-item list-group-item-action p-3 text-start border-primary mb-2 rounded shadow-sm"
                              onClick={() => selectReceiptForGRN(receipt)}
                            >
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-bold text-primary small">
                                  Receipt Batch #{rIdx + 1} ({receipt.receipt_id.slice(-14)})
                                </span>
                                <span className="badge bg-success">{totalQty} units</span>
                              </div>
                              <div className="small text-muted mb-2">
                                <FaCalendarAlt size={10} className="me-1" /> {dateStr}
                              </div>
                              {receipt.remarks && (
                                <div className="small text-muted mb-2 italic">
                                  <strong>Remarks:</strong> "{receipt.remarks}"
                                </div>
                              )}
                              <div className="small text-secondary bg-light p-2 rounded">
                                <strong>Items:</strong> {receipt.items.map(i => `${i.item_name} (Qty: ${i.received_quantity})`).join(", ")}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* NORMAL GRN CREATION INPUTS */
                  <>
                    {pendingReceipts.length > 1 && (
                      <button 
                        className="btn btn-outline-secondary btn-sm mb-3"
                        onClick={() => setSelectedReceipt(null)}
                      >
                        ← Back to Receipt Batches
                      </button>
                    )}
                    
                    {/* Info Alert */}
                    <div className="alert alert-info py-2 mb-3">
                      <small>
                        <FaTruck className="me-1" />
                        <strong>Received Items:</strong> The items below have already been received. Generate GRN to create official documentation.
                      </small>
                    </div>
                    
                    {/* Batch Code Info */}
                    <div className="card mb-3">
                      <div className="card-header bg-light py-2">
                        <h6 className="mb-0 fw-bold small">
                          <FaBarcode className="me-1" />
                          Batch Codes (Auto-generated)
                        </h6>
                      </div>
                      <div className="card-body p-2">
                        <div className="alert alert-success py-1 px-2 mb-0">
                          <small>
                            <FaSync className="me-1" />
                            Batch codes are automatically generated with duplicate prevention.
                            Format: BRAND-YYYYMMDD-001 (unique suffix added if duplicate)
                          </small>
                        </div>
                      </div>
                    </div>
                    
                    {/* Items Selection */}
                    <div className="card mb-3">
                      <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center">
                        <h6 className="mb-0 fw-bold small">
                          Received Items ({selectedItems.filter(i => i.selected && i.received_quantity > 0).length} selected)
                        </h6>
                        <div>
                          <button className="btn btn-sm btn-outline-success me-1" onClick={selectAllItems}>
                            Select All
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={deselectAllItems}>
                            Clear All
                          </button>
                        </div>
                      </div>
                      <div className="card-body p-2">
                        {selectedItems.map((item, index) => (
                          <div 
                            key={index} 
                            className={`card mb-2 ${item.selected && item.received_quantity > 0 ? 'border-success' : ''}`}
                            style={{ backgroundColor: item.selected && item.received_quantity > 0 ? '#f0fff4' : 'white' }}
                          >
                            <div className="card-body p-2">
                              <div className="d-flex justify-content-between align-items-start mb-1">
                                <div className="d-flex align-items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={item.selected && item.received_quantity > 0}
                                    onChange={() => toggleItemSelection(index)}
                                    className="form-check-input mt-0"
                                  />
                                  <span className="fw-bold small">{item.item_name}</span>
                                </div>
                                <span className="badge bg-secondary">
                                  Ordered: {item.original_quantity || item.quantity}
                                </span>
                              </div>
                              
                              {/* Received Quantity Display */}
                              <div className="mb-2">
                                <div className="d-flex justify-content-between small text-muted">
                                  <span>Total Received in Stock:</span>
                                  <span className="fw-bold text-success">{item.od_received_quantity || 0}</span>
                                </div>
                                <div className="progress" style={{ height: '4px' }}>
                                  <div 
                                    className="progress-bar bg-success" 
                                    style={{ width: `${((item.od_received_quantity || 0) / (item.original_quantity || item.quantity)) * 100}%` }}
                                  />
                                </div>
                              </div>
                              
                              <div className="row g-1 mt-1">
                                <div className="col-6">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.brand || ""}
                                    onChange={(e) => handleItemChange(index, 'brand', e.target.value)}
                                    placeholder="Brand"
                                    size="10"
                                  />
                                </div>
                                <div className="col-6">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.brand_code || ""}
                                    onChange={(e) => handleItemChange(index, 'brand_code', e.target.value)}
                                    placeholder="Code"
                                  />
                                </div>
                                <div className="col-6">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.hsn_code || ""}
                                    onChange={(e) => handleItemChange(index, 'hsn_code', e.target.value)}
                                    placeholder="HSN"
                                  />
                                </div>
                                <div className="col-6">
                                  <div className="d-flex">
                                    <input
                                      type="text"
                                      className="form-control form-control-sm me-1"
                                      value={item.length || ""}
                                      onChange={(e) => handleItemChange(index, 'length', e.target.value)}
                                      placeholder="L (M)"
                                    />
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      value={item.width || ""}
                                      onChange={(e) => handleItemChange(index, 'width', e.target.value)}
                                      placeholder="W (mm)"
                                    />
                                  </div>
                                </div>
                                <div className="col-8">
                                  <div className="input-group input-group-sm">
                                    <span className="input-group-text">
                                      <FaRupeeSign size={10} />
                                    </span>
                                    <input
                                      type="number"
                                      className="form-control"
                                      value={item.buy_price || ""}
                                      onChange={(e) => handleItemChange(index, 'buy_price', e.target.value)}
                                      placeholder="Price"
                                    />
                                  </div>
                                </div>
                                <div className="col-4">
                                  <div className="fw-bold text-success small text-end">
                                    <FaRupeeSign size={8} />
                                    {(item.received_quantity * (parseFloat(item.buy_price) || 0)).toFixed(0)}
                                  </div>
                                </div>
                                
                                {/* GRN Quantity - Editable */}
                                <div className="col-12">
                                  <label className="small text-muted mb-1 fw-bold">Quantity for this GRN</label>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={item.received_quantity || ""}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      const maxVal = item.delivered_quantity || 0;
                                      
                                      if (isNaN(val)) {
                                        handleItemChange(index, 'received_quantity', 0);
                                      } else if (val > maxVal) {
                                        toast.warning(`Cannot exceed available quantity to GRN (${maxVal})`);
                                        handleItemChange(index, 'received_quantity', maxVal);
                                      } else if (val < 0) {
                                        handleItemChange(index, 'received_quantity', 0);
                                      } else {
                                        handleItemChange(index, 'received_quantity', val);
                                      }
                                    }}
                                    min="0"
                                    max={item.delivered_quantity || 0}
                                    step="any"
                                  />
                                  <div className="d-flex justify-content-between mt-1">
                                    <small className="text-muted">Already GRNed: {item.already_grned_quantity || 0}</small>
                                    <small className="text-primary fw-bold">Available: {item.delivered_quantity || 0}</small>
                                  </div>
                                </div>
                                
                                <div className="col-12">
                                  <div className="d-flex gap-1">
                                    <input
                                      type="text"
                                      className="form-control form-control-sm flex-grow-1"
                                      value={item.batch_code || ""}
                                      onChange={(e) => handleItemChange(index, 'batch_code', e.target.value.toUpperCase())}
                                      placeholder="Batch Code (Auto-generated)"
                                      readOnly={!item.batch_code}
                                      style={{ backgroundColor: item.batch_code ? '#f8f9fa' : 'white' }}
                                    />
                                    {item.batch_code && (
                                      <>
                                        <button
                                          className="btn btn-sm btn-outline-info"
                                          onClick={() => regenerateItemBatchCode(index)}
                                          title="Regenerate"
                                        >
                                          <FaSync size={10} />
                                        </button>
                                        <button
                                          className="btn btn-sm btn-outline-secondary"
                                          onClick={() => copyToClipboard(item.batch_code)}
                                          title="Copy"
                                        >
                                          <FaCopy size={10} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  {!item.batch_code && item.selected && item.received_quantity > 0 && (
                                    <small className="text-muted">Generating batch code...</small>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <div className="alert alert-warning mt-2 py-1 px-2">
                          <small>
                            <strong>Note:</strong> 
                            <br />- Only items with received quantity are shown
                            <br />- Batch codes are automatically generated with duplicate prevention
                            <br />- Select items you want to include in GRN and click "Generate GRN"
                            <br />- After GRN generation, PO status will be automatically updated to "Completed"
                          </small>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="modal-footer py-2">
                {selectedReceipt && (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={handleSubmitGRN}
                    disabled={selectedItems.filter(item => item.selected && item.received_quantity > 0 && item.batch_code).length === 0}
                  >
                    <FaFileInvoice className="me-2" size={12} />
                    Generate GRN
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setOpenPopup(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* VIEW GRN DETAILS MODAL */}
      {viewData && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-scrollable modal-fullscreen-md-down modal-xl">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white py-2">
                <h5 className="modal-title fs-6">
                  <FaFileInvoice className="me-2" />
                  {mobileView ? `GRN: ${viewData[0]?.invoice_number}` : `GRN Details - ${viewData[0]?.invoice_number}`}
                </h5>
                <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setViewData(null)}></button>
              </div>
              
              <div className="modal-body p-2">
                <div className="card border-0 shadow-sm">
                  <div className="card-body p-2">
                    {/* Desktop View */}
                    <div className="row mb-4">
                      <div className="col-md-6">
                        <h4 className="text-primary fw-bold">
                          <FaFileInvoice className="me-2" />
                          {viewData[0]?.invoice_number}
                          {viewData[0]?.is_partial && (
                            <span className="badge bg-warning text-dark ms-2">
                              <FaPercent className="me-1" size={12} />
                              Partial Delivery
                            </span>
                          )}
                        </h4>
                        <p>
                          <strong>PO Number:</strong> 
                          <span className="badge bg-secondary ms-2">{viewData[0]?.po_number}</span>
                        </p>
                        <p>
                          <strong>Invoice Date:</strong> 
                          <FaCalendarAlt className="me-1 ms-2" />
                          {viewData[0]?.invoice_date}
                        </p>
                        <p>
                          <strong><FaBuilding className="me-1" /> Company:</strong> {viewData[0]?.company_name}
                        </p>
                        <p><strong>GST:</strong> {viewData[0]?.gst_number || 'N/A'}</p>
                      </div>
                      <div className="col-md-6">
                        <p>
                          <strong><FaUser className="me-1" /> Customer:</strong> {viewData[0]?.customer_name}
                        </p>
                        <p><strong>Mobile:</strong> {viewData[0]?.customer_mobile}</p>
                        <p><strong>Email:</strong> {viewData[0]?.customer_email}</p>
                        <p><strong>Created:</strong> {viewData[0]?.created_on?.slice(0, 16)}</p>
                      </div>
                    </div>
                    
                    <div className="border-top pt-3">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="fw-bold mb-0">
                          <FaBox className="me-2" />
                          Items ({viewData.length})
                        </h6>
                        <div className="text-muted">
                          Total Amount: 
                          <span className="fw-bold text-success ms-2">
                            <FaRupeeSign className="me-1" />
                            {viewData.reduce((total, item) => total + (item.quantity * item.buy_price), 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered">
                          <thead className="table-light">
                            <tr>
                              <th>#</th>
                              <th>Item Name</th>
                              <th>Brand</th>
                              <th>HSN</th>
                              <th>Size (L[M]×W[mm])</th>
                              <th>Qty</th>
                              <th>Buy Price</th>
                              <th>Total</th>
                              <th>Batch Code</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewData.map((item, index) => (
                              <tr key={index}>
                                <td>{index + 1}</td>
                                <td className="fw-bold">{item.item_name}</td>
                                <td>{item.brand}</td>
                                <td>{item.hsn_code || '-'}</td>
                                <td>
                                  {item.length || item.width
                                    ? `${item.length || ''}${item.width ? '×' + item.width : ''}`
                                    : '-'
                                  }
                                </td>
                                <td>{item.quantity}</td>
                                <td>₹{parseFloat(item.buy_price).toFixed(2)}</td>
                                <td className="fw-bold text-success">
                                  ₹{(item.quantity * item.buy_price).toFixed(2)}
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <span className="badge bg-dark fw-bold">
                                      {item.batch_code}
                                    </span>
                                    <button
                                      className="btn btn-sm btn-outline-info ms-2"
                                      onClick={() => copyToClipboard(item.batch_code)}
                                      title="Copy batch code"
                                    >
                                      <FaCopy />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="table-secondary">
                            <tr>
                              <td colSpan="8" className="text-end fw-bold">Total Amount:</td>
                              <td className="fw-bold text-success">
                                <FaRupeeSign className="me-1" />
                                {viewData.reduce((total, item) => total + (item.quantity * item.buy_price), 0).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="modal-footer py-2">
                <button className="btn btn-secondary btn-sm" onClick={() => setViewData(null)}>
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

export default GRNPage;