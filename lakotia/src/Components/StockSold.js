// StockSoldPage.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_COMPLETED_TASKS = `${API_BASE}/tasks/completed`;
const API_STOCK_SOLD = `${API_BASE}/stock_sold`;


// ❌ Fields to hide in View popup (due_date NOT removed)
const HIDDEN_FIELDS = [
  "hsn_sac",
  "invoice_remarks",
  "invoice_amount",
  "mrp",
  "material_type",
  "production_end_date",
  "production_start_date",
  "production_status",
  "quality_check",
  "thickness"
];

const ITEMS_PER_PAGE = 10;

const StockSoldPage = () => {
  const [items, setItems] = useState([]);
  const [viewItem, setViewItem] = useState(null);
  const [saveModal, setSaveModal] = useState(false);
  const [saveFormData, setSaveFormData] = useState({
    item_name: "",
    company_name: "",
    quantity: "",
    unit: "",
    sold_date: new Date().toISOString().split("T")[0],
    customer_name: "",
    sold_remarks: "",
    hsn_sac: "",
    invoice_remarks: "",
    invoice_amount: "",
    mrp: "",
    material_type: "",
    production_end_date: "",
    production_start_date: "",
    production_status: "",
    quality_check: "",
    thickness: "",
    due_date: ""
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    itemName: "",
    fromDate: "",
    toDate: "",
    customerName: ""
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showSoldTab, setShowSoldTab] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState({}); // Track auto-save status per item
  const [saveAllLoading, setSaveAllLoading] = useState(false);
  const [unsavedItems, setUnsavedItems] = useState([]); // Track unsaved items
  const [taskIdMap, setTaskIdMap] = useState({}); // Map task_id to item

  useEffect(() => {
    if (showSoldTab) {
      fetchSoldRecords();
    } else {
      fetchCompletedItems();
    }
  }, [currentPage, showSoldTab]);

  const fetchCompletedItems = async () => {
    try {
      setLoading(true);
      const res = await axios.get(API_COMPLETED_TASKS);
      if (res.data.success) {
        let filteredItems = res.data.data;
        
        // Apply search filters
        if (searchFilters.itemName) {
          filteredItems = filteredItems.filter(item =>
            item.item_name?.toLowerCase().includes(searchFilters.itemName.toLowerCase())
          );
        }
        
        if (searchFilters.customerName) {
          filteredItems = filteredItems.filter(item =>
            item.customer_name?.toLowerCase().includes(searchFilters.customerName.toLowerCase())
          );
        }
        
        if (searchFilters.fromDate) {
          filteredItems = filteredItems.filter(item => 
            item.due_date && item.due_date >= searchFilters.fromDate
          );
        }
        
        if (searchFilters.toDate) {
          filteredItems = filteredItems.filter(item =>
            item.due_date && item.due_date <= searchFilters.toDate
          );
        }
        
        setItems(filteredItems);
        
        // Create task_id mapping for checking saved status
        const idMap = {};
        filteredItems.forEach(item => {
          idMap[item._id || item.id] = item;
        });
        setTaskIdMap(idMap);
        
        // Check which items are already saved
        checkSavedStatus(filteredItems);
        
        const total = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
        setTotalPages(total > 0 ? total : 1);
      } else {
        toast.error("Failed to load sold items");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading sold items");
    } finally {
      setLoading(false);
    }
  };

  const fetchSoldRecords = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_STOCK_SOLD}/all`);
      if (res.data.success) {
        setItems(res.data.data);
        const total = Math.ceil(res.data.data.length / ITEMS_PER_PAGE);
        setTotalPages(total > 0 ? total : 1);
      } else {
        toast.error("Failed to load stock sold records");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading stock sold records");
    } finally {
      setLoading(false);
    }
  };

  // Check which completed tasks are already saved in stock sold
  const checkSavedStatus = async (completedItems) => {
    try {
      if (completedItems.length === 0) return;
      
      // Get all stock sold records to check against
      const soldRes = await axios.get(`${API_STOCK_SOLD}/all`);
      if (!soldRes.data.success) return;
      
      const soldRecords = soldRes.data.data;
      const unsaved = [];
      
      // For each completed item, check if it exists in stock sold
      completedItems.forEach(item => {
        const itemId = item._id || item.id;
        const isSaved = soldRecords.some(record => record.task_id === itemId);
        
        // Update autoSaving state
        setAutoSaving(prev => ({
          ...prev,
          [itemId]: isSaved ? 'already_saved' : 'not_saved'
        }));
        
        // Add to unsaved list if not saved
        if (!isSaved) {
          unsaved.push(item);
        }
      });
      
      setUnsavedItems(unsaved);
    } catch (error) {
      console.error("Error checking saved status:", error);
    }
  };

  // Function to auto-save a completed task to stock sold records
  const autoSaveToStockSold = async (item) => {
    try {
      const itemId = item._id || item.id;
      
      // Prepare data for auto-save
      const stockSoldData = {
        task_id: itemId, // Link to original task
        item_name: item.item_name || "",
        company_name: item.company_name || "",
        quantity: item.quantity || 0,
        unit: item.unit || "",
        sold_date: new Date().toISOString().split("T")[0],
        customer_name: item.customer_name || "",
        sold_remarks: `Auto-saved from completed tasks: ${item.remarks || ""}`,
        hsn_sac: item.hsn_sac || "",
        invoice_remarks: item.invoice_remarks || "",
        invoice_amount: item.invoice_amount || 0,
        mrp: item.mrp || 0,
        material_type: item.material_type || "",
        production_end_date: item.production_end_date || "",
        production_start_date: item.production_start_date || "",
        production_status: item.production_status || "",
        quality_check: item.quality_check || "",
        thickness: item.thickness || "",
        due_date: item.due_date || "",
        is_saved: true, // Always mark as saved
        saved_on: new Date().toISOString()
      };
      
      const response = await axios.post(`${API_STOCK_SOLD}/save`, stockSoldData);
      
      if (response.data.success) {
        // Update auto-save status for this item
        setAutoSaving(prev => ({
          ...prev,
          [itemId]: 'saved'
        }));
        
        // Update unsaved items list
        setUnsavedItems(prev => prev.filter(unsavedItem => 
          (unsavedItem._id || unsavedItem.id) !== itemId
        ));
        
        return { 
          success: true, 
          data: response.data.data
        };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error("Error auto-saving to stock sold:", error);
      return { success: false, message: error.message };
    }
  };

  // Handle Save Individual button click
  const handleSaveIndividual = async (item) => {
    const itemId = item._id || item.id;
    
    // Set loading state for this specific item
    setAutoSaving(prev => ({
      ...prev,
      [itemId]: 'saving'
    }));
    
    const result = await autoSaveToStockSold(item);
    
    if (result.success) {
      toast.success("Item saved to stock sold records!");
      setAutoSaving(prev => ({
        ...prev,
        [itemId]: 'saved'
      }));
    } else {
      toast.error(`Failed to save: ${result.message}`);
      setAutoSaving(prev => ({
        ...prev,
        [itemId]: 'error'
      }));
    }
  };

  // Handle Save All button click
  const handleSaveAll = async () => {
    if (unsavedItems.length === 0) {
      toast.info("All items are already saved!");
      return;
    }
    
    try {
      setSaveAllLoading(true);
      
      // Create an array of promises for all save operations
      const savePromises = unsavedItems.map(item => 
        autoSaveToStockSold(item)
      );
      
      // Execute all saves in parallel
      const results = await Promise.all(savePromises);
      
      // Count successful saves
      const successfulSaves = results.filter(result => result.success).length;
      const failedSaves = results.filter(result => !result.success).length;
      
      if (successfulSaves > 0) {
        toast.success(`Successfully saved ${successfulSaves} item(s) to stock sold records!`);
      }
      
      if (failedSaves > 0) {
        toast.error(`Failed to save ${failedSaves} item(s). Please try saving them individually.`);
      }
      
      // Clear unsaved items list
      setUnsavedItems([]);
      
      // Refresh the current view to update statuses
      if (!showSoldTab) {
        fetchCompletedItems();
      }
      
    } catch (error) {
      console.error("Error saving all items:", error);
      toast.error("Error saving all items. Please try again.");
    } finally {
      setSaveAllLoading(false);
    }
  };

  const handleSaveStockSold = async () => {
    try {
      setSaveLoading(true);
      
      // Validate required fields
      if (!saveFormData.item_name || !saveFormData.customer_name || !saveFormData.quantity) {
        toast.error("Please fill in required fields: Item Name, Customer Name, and Quantity");
        return;
      }
      
      const response = await axios.post(`${API_STOCK_SOLD}/save`, {
        ...saveFormData,
        is_saved: true, // Always mark as saved for manual entries
        saved_on: new Date().toISOString()
      });
      
      if (response.data.success) {
        toast.success("Stock sold record saved successfully!");
        setSaveModal(false);
        resetSaveForm();
        
        // Refresh the sold records list
        if (showSoldTab) {
          fetchSoldRecords();
        }
      } else {
        toast.error("Failed to save record: " + response.data.message);
      }
    } catch (error) {
      console.error("Error saving stock sold:", error);
      toast.error("Error saving record. Please try again.");
    } finally {
      setSaveLoading(false);
    }
  };

  const resetSaveForm = () => {
    setSaveFormData({
      item_name: "",
      company_name: "",
      quantity: "",
      unit: "",
      sold_date: new Date().toISOString().split("T")[0],
      customer_name: "",
      sold_remarks: "",
      hsn_sac: "",
      invoice_remarks: "",
      invoice_amount: "",
      mrp: "",
      material_type: "",
      production_end_date: "",
      production_start_date: "",
      production_status: "",
      quality_check: "",
      thickness: "",
      due_date: ""
    });
  };

  // Updated openSaveModal to pre-fill data from selected item
  const openSaveModal = (item = null) => {
    if (item) {
      // Pre-fill form with item data
      setSaveFormData({
        item_name: item.item_name || "",
        company_name: item.company_name || "",
        quantity: item.quantity || "",
        unit: item.unit || "",
        sold_date: new Date().toISOString().split("T")[0],
        customer_name: item.customer_name || "",
        sold_remarks: item.remarks || "",
        hsn_sac: item.hsn_sac || "",
        invoice_remarks: item.invoice_remarks || "",
        invoice_amount: item.invoice_amount || "",
        mrp: item.mrp || "",
        material_type: item.material_type || "",
        production_end_date: item.production_end_date || "",
        production_start_date: item.production_start_date || "",
        production_status: item.production_status || "",
        quality_check: item.quality_check || "",
        thickness: item.thickness || "",
        due_date: item.due_date || ""
      });
    }
    setSaveModal(true);
  };

  const handleSaveFormChange = (field, value) => {
    setSaveFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Get current page items
  const getCurrentPageItems = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return items.slice(startIndex, endIndex);
  };

  // Handle page change
  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // Generate page numbers
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const handleSearch = () => {
    setCurrentPage(1);
    if (showSoldTab) {
      fetchSoldRecords();
    } else {
      fetchCompletedItems();
    }
  };

  const handleResetFilters = () => {
    setSearchFilters({
      itemName: "",
      fromDate: "",
      toDate: "",
      customerName: ""
    });
    setCurrentPage(1);
    if (showSoldTab) {
      fetchSoldRecords();
    } else {
      fetchCompletedItems();
    }
  };

  const handleFilterChange = (field, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Function to get appropriate column data based on tab
  const getColumnData = (item, column) => {
    if (showSoldTab) {
      // For stock_sold records
      switch(column) {
        case 'item_name': return item.item_name || "-";
        case 'company_name': return item.company_name || "-";
        case 'customer_name': return item.customer_name || "-";
        case 'quantity': return item.quantity || item.sold_qty || 0;
        case 'unit': return item.unit || "-";
        case 'date': return item.sold_date || item.date || "-";
        case 'remarks': return item.sold_remarks || item.remarks || "-";
        case 'due_date': return item.due_date || "-";
        case 'is_saved': return item.is_saved ? '✅ Saved' : '❌ Not Saved';
        default: return item[column] || "-";
      }
    } else {
      // For completed tasks
      return item[column] || "-";
    }
  };

  // Get auto-save status for an item
  const getAutoSaveStatus = (item) => {
    const itemId = item._id || item.id;
    return autoSaving[itemId] || 'not_saved';
  };

  // Get button text based on status
  const getAutoSaveButtonText = (status) => {
    switch(status) {
      case 'saving': return '⏳ Saving...';
      case 'saved': return '✅ Saved';
      case 'already_saved': return '✅ Already Saved';
      case 'error': return '❌ Failed';
      default: return '💾 Save';
    }
  };

  // Get button style based on status
  const getAutoSaveButtonStyle = (status) => {
    const baseStyle = {
      padding: "6px 12px",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "500",
      marginRight: "8px",
      transition: "all 0.2s ease",
      display: "inline-flex",
      alignItems: "center",
      gap: "4px"
    };
    
    switch(status) {
      case 'saving':
        return { ...baseStyle, background: "#ffc107", color: "#212529" };
      case 'saved':
        return { ...baseStyle, background: "#28a745", color: "#fff", cursor: "default" };
      case 'already_saved':
        return { ...baseStyle, background: "#28a745", color: "#fff", cursor: "default" };
      case 'error':
        return { ...baseStyle, background: "#dc3545", color: "#fff" };
      default:
        return { ...baseStyle, background: "#007bff", color: "#fff" };
    }
  };

  // Check if button should be disabled
  const isSaveButtonDisabled = (status) => {
    return ['saving', 'saved', 'already_saved'].includes(status);
  };

  return (
    <div style={styles.page}>
      
      
      {/* HEADER WITH TABS */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          {showSoldTab ? "Stock Sold Records" : "Sold Items (Completed Tasks)"}
        </h2>
        
        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tabBtn,
              ...(!showSoldTab ? styles.activeTabBtn : {})
            }}
            onClick={() => {
              setShowSoldTab(false);
              setCurrentPage(1);
            }}
          >
            Sold Items
          </button>
          <button
            style={{
              ...styles.tabBtn,
              ...(showSoldTab ? styles.activeTabBtn : {})
            }}
            onClick={() => {
              setShowSoldTab(true);
              setCurrentPage(1);
            }}
          >
            Stock Sold Records
          </button>
        </div>
      </div>

      {/* ACTION BUTTONS SECTION */}
      <div style={styles.actionButtonsSection}>
        {/* SAVE ALL BUTTON - Shows in both tabs */}
        {(unsavedItems.length > 0 || showSoldTab) && (
          <button
            style={styles.saveAllButton}
            onClick={handleSaveAll}
            disabled={saveAllLoading || (showSoldTab && unsavedItems.length === 0)}
          >
            {saveAllLoading ? (
              <>
                <div style={styles.smallSpinner}></div>
                Saving All ({unsavedItems.length})...
              </>
            ) : (
              `💾 Save All${!showSoldTab ? ` (${unsavedItems.length} unsaved)` : ''}`
            )}
          </button>
        )}
        
        {/* ADD BUTTON - Only shows in Stock Sold Records tab */}
        {showSoldTab && (
          <button
            style={styles.addButton}
            onClick={() => openSaveModal()}
          >
            ➕ Add Stock Sold Record
          </button>
        )}
      </div>

      {/* UNSAVED ITEMS COUNTER - Only shows in Sold Items tab */}
      {!showSoldTab && unsavedItems.length > 0 && (
        <div style={styles.unsavedCounter}>
          <span style={styles.unsavedText}>
            📝 You have {unsavedItems.length} unsaved item(s) ready to be saved to Stock Sold Records
          </span>
        </div>
      )}

      {/* SEARCH FILTERS */}
      <div style={styles.filterContainer}>
        <div style={styles.filterHeader}>
          <h3 style={styles.filterTitle}>
            <span onClick={() => setShowFilters(!showFilters)} style={styles.filterToggle}>
              {showFilters ? "▼" : "▶"} Search Filters
            </span>
          </h3>
          {showFilters && (
            <button
              style={styles.resetBtn}
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
        
        {showFilters && (
          <div style={styles.filterGrid}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Item Name</label>
              <input
                type="text"
                style={styles.filterInput}
                value={searchFilters.itemName}
                onChange={(e) => handleFilterChange("itemName", e.target.value)}
                placeholder="Search by item name..."
              />
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>
                {showSoldTab ? "Customer Name" : "Company Name"}
              </label>
              <input
                type="text"
                style={styles.filterInput}
                value={searchFilters.customerName}
                onChange={(e) => handleFilterChange("customerName", e.target.value)}
                placeholder={showSoldTab ? "Search by customer..." : "Search by company..."}
              />
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>From Date</label>
              <input
                type="date"
                style={styles.filterInput}
                value={searchFilters.fromDate}
                onChange={(e) => handleFilterChange("fromDate", e.target.value)}
              />
            </div>
            
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>To Date</label>
              <input
                type="date"
                style={styles.filterInput}
                value={searchFilters.toDate}
                onChange={(e) => handleFilterChange("toDate", e.target.value)}
              />
            </div>
            
            <div style={styles.filterActions}>
              <button
                style={styles.searchBtn}
                onClick={handleSearch}
              >
                🔍 Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          Loading...
        </div>
      )}

      {/* TABLE */}
      {!loading && (
        <>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>S.No</th>
                  <th style={styles.th}>Item</th>
                  <th style={styles.th}>
                    {showSoldTab ? "Customer" : "Company"}
                  </th>
                  <th style={styles.th}>Qty</th>
                  <th style={styles.th}>Unit</th>
                  <th style={styles.th}>
                    {showSoldTab ? "Sold Date" : "Due Date"}
                  </th>
                  {showSoldTab && <th style={styles.th}>Save Status</th>}
                  {showSoldTab && <th style={styles.th}>Remarks</th>}
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={showSoldTab ? "9" : "7"} style={styles.empty}>
                      {showSoldTab ? "No stock sold records found" : "No sold items found"}
                    </td>
                  </tr>
                ) : (
                  getCurrentPageItems().map((item, i) => {
                    const serialNo = (currentPage - 1) * ITEMS_PER_PAGE + i + 1;
                    const autoSaveStatus = getAutoSaveStatus(item);
                    const isDisabled = isSaveButtonDisabled(autoSaveStatus);
                    
                    return (
                      <tr key={i}>
                        <td style={styles.td}>{serialNo}</td>
                        <td style={styles.td}>{getColumnData(item, 'item_name')}</td>
                        <td style={styles.td}>
                          {showSoldTab 
                            ? getColumnData(item, 'customer_name') 
                            : getColumnData(item, 'company_name')}
                        </td>
                        <td style={styles.td}>{getColumnData(item, 'quantity')}</td>
                        <td style={styles.td}>{getColumnData(item, 'unit')}</td>
                        <td style={styles.td}>
                          {showSoldTab 
                            ? getColumnData(item, 'date') 
                            : getColumnData(item, 'due_date')}
                        </td>
                        {showSoldTab && (
                          <td style={styles.td}>{getColumnData(item, 'is_saved')}</td>
                        )}
                        {showSoldTab && (
                          <td style={styles.td}>{getColumnData(item, 'remarks')}</td>
                        )}
                        <td style={styles.td}>
                          <div style={styles.actionButtons}>
                            {!showSoldTab && (
                              <button
                                style={getAutoSaveButtonStyle(autoSaveStatus)}
                                onClick={() => handleSaveIndividual(item)}
                                disabled={isDisabled}
                              >
                                {getAutoSaveButtonText(autoSaveStatus)}
                              </button>
                            )}
                            
                            <button
                              style={styles.viewBtn}
                              onClick={() => setViewItem(item)}
                            >
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {items.length > 0 && (
            <div style={styles.paginationContainer}>
              <div style={styles.paginationInfo}>
                Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, items.length)} to{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, items.length)} of {items.length} entries
                {!showSoldTab && unsavedItems.length > 0 && (
                  <span style={styles.unsavedPagination}>
                    • {unsavedItems.length} unsaved item(s)
                  </span>
                )}
              </div>
              
              <div style={styles.pagination}>
                <button
                  style={{
                    ...styles.pageBtn,
                    ...(currentPage === 1 ? styles.disabledBtn : {}),
                  }}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </button>

                {getPageNumbers().map((page, index) => (
                  page === "..." ? (
                    <span key={index} style={styles.ellipsis}>...</span>
                  ) : (
                    <button
                      key={index}
                      style={{
                        ...styles.pageBtn,
                        ...(currentPage === page ? styles.activePageBtn : {}),
                      }}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  )
                ))}

                <button
                  style={{
                    ...styles.pageBtn,
                    ...(currentPage === totalPages ? styles.disabledBtn : {}),
                  }}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* VIEW DETAILS POPUP */}
      {viewItem && (
        <div style={styles.overlay}>
          <div style={styles.popup}>
            <div style={styles.popupHeader}>
              <h3 style={{ margin: 0 }}>
                {showSoldTab ? "Stock Sold Details" : "Sold Item Details"}
              </h3>
              <button
                style={styles.closeIcon}
                onClick={() => setViewItem(null)}
              >
                ×
              </button>
            </div>

            <div style={styles.detailGrid}>
              {Object.entries(viewItem)
                .filter(([key]) => !HIDDEN_FIELDS.includes(key))
                .map(([key, value]) => {
                  // Format the key for display
                  const displayKey = key.replace(/_/g, " ").toUpperCase();
                  let displayValue = value ?? "-";
                  
                  // Special handling for different tabs
                  if (showSoldTab) {
                    // For stock_sold records, use appropriate field names
                    switch(key) {
                      case 'sold_date': 
                        displayValue = value || viewItem.date || "-";
                        break;
                      case 'sold_remarks':
                        displayValue = value || viewItem.remarks || "-";
                        break;
                      case 'sold_qty':
                        displayValue = value || viewItem.quantity || "-";
                        break;
                      case 'is_saved':
                        displayValue = value ? '✅ Saved' : '❌ Not Saved';
                        break;
                      case 'saved_on':
                        displayValue = value ? new Date(value).toLocaleString() : 'Not saved yet';
                        break;
                    }
                  }
                  
                  return (
                    <div key={key} style={styles.detailRow}>
                      <strong style={styles.detailLabel}>
                        {displayKey}
                      </strong>
                      <span style={styles.detailValue}>{displayValue}</span>
                    </div>
                  );
                })}
            </div>

            <div style={styles.popupFooter}>
              {!showSoldTab && (
                <button
                  style={styles.autoSaveBtn}
                  onClick={() => {
                    handleSaveIndividual(viewItem);
                    setViewItem(null);
                  }}
                >
                  💾 Save to Stock Sold
                </button>
              )}
              <button
                style={styles.closeBtn}
                onClick={() => setViewItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE MODAL POPUP */}
      {saveModal && (
        <div style={styles.overlay}>
          <div style={styles.savePopup}>
            <div style={styles.popupHeader}>
              <h3 style={{ margin: 0 }}>Add Stock Sold Record</h3>
              <button
                style={styles.closeIcon}
                onClick={() => {
                  setSaveModal(false);
                  resetSaveForm();
                }}
              >
                ×
              </button>
            </div>

            <div style={styles.saveForm}>
              <div style={styles.formGrid}>
                {/* Required Fields */}
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Item Name <span style={{color: 'red'}}>*</span>
                  </label>
                  <input
                    type="text"
                    style={styles.formInput}
                    value={saveFormData.item_name}
                    onChange={(e) => handleSaveFormChange("item_name", e.target.value)}
                    placeholder="Enter item name"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Customer Name <span style={{color: 'red'}}>*</span>
                  </label>
                  <input
                    type="text"
                    style={styles.formInput}
                    value={saveFormData.customer_name}
                    onChange={(e) => handleSaveFormChange("customer_name", e.target.value)}
                    placeholder="Enter customer name"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Quantity <span style={{color: 'red'}}>*</span>
                  </label>
                  <input
                    type="number"
                    style={styles.formInput}
                    value={saveFormData.quantity}
                    onChange={(e) => handleSaveFormChange("quantity", e.target.value)}
                    placeholder="Enter quantity"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Unit</label>
                  <input
                    type="text"
                    style={styles.formInput}
                    value={saveFormData.unit}
                    onChange={(e) => handleSaveFormChange("unit", e.target.value)}
                    placeholder="Enter unit (e.g., kg, pcs)"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Sold Date</label>
                  <input
                    type="date"
                    style={styles.formInput}
                    value={saveFormData.sold_date}
                    onChange={(e) => handleSaveFormChange("sold_date", e.target.value)}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Company Name</label>
                  <input
                    type="text"
                    style={styles.formInput}
                    value={saveFormData.company_name}
                    onChange={(e) => handleSaveFormChange("company_name", e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>HSN/SAC Code</label>
                  <input
                    type="text"
                    style={styles.formInput}
                    value={saveFormData.hsn_sac}
                    onChange={(e) => handleSaveFormChange("hsn_sac", e.target.value)}
                    placeholder="Enter HSN/SAC code"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>NBP</label>
                  <input
                    type="number"
                    step="0.01"
                    style={styles.formInput}
                    value={saveFormData.mrp}
                    onChange={(e) => handleSaveFormChange("mrp", e.target.value)}
                    placeholder="Enter NBP"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Invoice Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    style={styles.formInput}
                    value={saveFormData.invoice_amount}
                    onChange={(e) => handleSaveFormChange("invoice_amount", e.target.value)}
                    placeholder="Enter invoice amount"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Material Type</label>
                  <input
                    type="text"
                    style={styles.formInput}
                    value={saveFormData.material_type}
                    onChange={(e) => handleSaveFormChange("material_type", e.target.value)}
                    placeholder="Enter material type"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Thickness</label>
                  <input
                    type="text"
                    style={styles.formInput}
                    value={saveFormData.thickness}
                    onChange={(e) => handleSaveFormChange("thickness", e.target.value)}
                    placeholder="Enter thickness"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Production Start Date</label>
                  <input
                    type="date"
                    style={styles.formInput}
                    value={saveFormData.production_start_date}
                    onChange={(e) => handleSaveFormChange("production_start_date", e.target.value)}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Production End Date</label>
                  <input
                    type="date"
                    style={styles.formInput}
                    value={saveFormData.production_end_date}
                    onChange={(e) => handleSaveFormChange("production_end_date", e.target.value)}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Due Date</label>
                  <input
                    type="date"
                    style={styles.formInput}
                    value={saveFormData.due_date}
                    onChange={(e) => handleSaveFormChange("due_date", e.target.value)}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Quality Check</label>
                  <select
                    style={styles.formInput}
                    value={saveFormData.quality_check}
                    onChange={(e) => handleSaveFormChange("quality_check", e.target.value)}
                  >
                    <option value="">Select quality</option>
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Production Status</label>
                  <select
                    style={styles.formInput}
                    value={saveFormData.production_status}
                    onChange={(e) => handleSaveFormChange("production_status", e.target.value)}
                  >
                    <option value="">Select status</option>
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div style={{...styles.formGroup, gridColumn: '1 / -1'}}>
                  <label style={styles.formLabel}>Remarks</label>
                  <textarea
                    style={{...styles.formInput, minHeight: '80px'}}
                    value={saveFormData.sold_remarks}
                    onChange={(e) => handleSaveFormChange("sold_remarks", e.target.value)}
                    placeholder="Enter any remarks"
                  />
                </div>

                <div style={{...styles.formGroup, gridColumn: '1 / -1'}}>
                  <label style={styles.formLabel}>Invoice Remarks</label>
                  <textarea
                    style={{...styles.formInput, minHeight: '80px'}}
                    value={saveFormData.invoice_remarks}
                    onChange={(e) => handleSaveFormChange("invoice_remarks", e.target.value)}
                    placeholder="Enter invoice remarks"
                  />
                </div>
              </div>
            </div>

            <div style={styles.popupFooter}>
              <button
                style={styles.cancelBtn}
                onClick={() => {
                  setSaveModal(false);
                  resetSaveForm();
                }}
                disabled={saveLoading}
              >
                Cancel
              </button>
              <button
                style={styles.saveSubmitBtn}
                onClick={handleSaveStockSold}
                disabled={saveLoading}
              >
                {saveLoading ? (
                  <>
                    <div style={styles.smallSpinner}></div>
                    Saving...
                  </>
                ) : (
                  "Save Record"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* STYLES */
const styles = {
  page: {
    maxWidth: 1400,
    margin: "20px auto",
    padding: "0 16px",
  },
  header: {
    marginBottom: "16px",
    textAlign: "center",
  },
  title: {
    marginBottom: "16px",
    color: "#333",
    fontSize: "28px",
    fontWeight: "600",
  },
  tabs: {
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    marginBottom: "16px",
  },
  tabBtn: {
    padding: "10px 24px",
    background: "#f8f9fa",
    color: "#495057",
    border: "1px solid #dee2e6",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 0.2s ease",
  },
  activeTabBtn: {
    background: "#007bff",
    color: "#fff",
    borderColor: "#007bff",
  },
  actionButtonsSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "12px",
  },
  saveAllButton: {
    padding: "12px 24px",
    background: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(40, 167, 69, 0.3)",
  },
  addButton: {
    padding: "12px 24px",
    background: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.2s ease",
  },
  unsavedCounter: {
    background: "#fff3cd",
    border: "1px solid #ffeaa7",
    borderRadius: "6px",
    padding: "12px 16px",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#856404",
  },
  unsavedText: {
    fontSize: "14px",
    fontWeight: "500",
  },
  filterContainer: {
    background: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    marginBottom: "20px",
    overflow: "hidden",
  },
  filterHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #e9ecef",
    background: "#f8f9fa",
  },
  filterTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "600",
    color: "#495057",
  },
  filterToggle: {
    cursor: "pointer",
    userSelect: "none",
  },
  resetBtn: {
    padding: "6px 12px",
    background: "#6c757d",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    padding: "20px",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  filterLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#495057",
    textTransform: "uppercase",
  },
  filterInput: {
    padding: "8px 12px",
    border: "1px solid #ced4da",
    borderRadius: "4px",
    fontSize: "14px",
  },
  filterActions: {
    gridColumn: "1 / -1",
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "10px",
  },
  searchBtn: {
    padding: "10px 20px",
    background: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  loading: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px",
    color: "#666",
    fontSize: "16px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #007bff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "12px",
  },
  smallSpinner: {
    width: "16px",
    height: "16px",
    border: "2px solid #f3f3f3",
    borderTop: "2px solid #fff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginRight: "8px",
  },
  tableContainer: {
    background: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    overflow: "hidden",
    marginBottom: "20px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#fff",
  },
  th: {
    padding: "16px 12px",
    textAlign: "left",
    borderBottom: "2px solid #e9ecef",
    background: "#f8f9fa",
    fontWeight: "600",
    color: "#495057",
    fontSize: "14px",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #e9ecef",
    color: "#212529",
    fontSize: "14px",
  },
  empty: {
    textAlign: "center",
    padding: "48px 16px",
    color: "#6c757d",
    fontSize: "16px",
  },
  actionButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
  },
  viewBtn: {
    padding: "6px 12px",
    background: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500",
    transition: "all 0.2s ease",
  },
  paginationContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    padding: "20px",
    background: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  paginationInfo: {
    color: "#6c757d",
    fontSize: "14px",
  },
  unsavedPagination: {
    marginLeft: "12px",
    color: "#dc3545",
    fontWeight: "500",
    background: "#f8d7da",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pageBtn: {
    padding: "8px 14px",
    background: "#fff",
    color: "#007bff",
    border: "1px solid #dee2e6",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 0.2s ease",
    minWidth: "40px",
    textAlign: "center",
  },
  activePageBtn: {
    background: "#007bff",
    color: "#fff",
    borderColor: "#007bff",
  },
  disabledBtn: {
    opacity: 0.5,
    cursor: "not-allowed",
    background: "#f8f9fa",
    color: "#6c757d",
  },
  ellipsis: {
    padding: "8px",
    color: "#6c757d",
    fontSize: "14px",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: "20px",
  },
  popup: {
    width: "100%",
    maxWidth: "600px",
    maxHeight: "90vh",
    background: "#fff",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  },
  savePopup: {
    width: "100%",
    maxWidth: "900px",
    maxHeight: "90vh",
    background: "#fff",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  },
  popupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e9ecef",
    background: "#f8f9fa",
  },
  closeIcon: {
    background: "none",
    border: "none",
    fontSize: "24px",
    color: "#6c757d",
    cursor: "pointer",
    padding: "4px",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "16px",
    padding: "24px",
    overflowY: "auto",
    maxHeight: "calc(90vh - 140px)",
  },
  detailRow: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  detailLabel: {
    fontSize: "12px",
    color: "#6c757d",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  detailValue: {
    fontSize: "14px",
    color: "#212529",
    fontWeight: "500",
    padding: "8px 0",
    borderBottom: "1px dashed #e9ecef",
    wordBreak: "break-word",
  },
  saveForm: {
    padding: "24px",
    overflowY: "auto",
    maxHeight: "calc(90vh - 180px)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "16px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  formLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#495057",
    textTransform: "uppercase",
  },
  formInput: {
    padding: "10px 12px",
    border: "1px solid #ced4da",
    borderRadius: "4px",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
  },
  popupFooter: {
    padding: "16px 24px",
    borderTop: "1px solid #e9ecef",
    background: "#f8f9fa",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  closeBtn: {
    padding: "12px 20px",
    background: "#6c757d",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "500",
    transition: "all 0.2s ease",
    flex: 1,
  },
  autoSaveBtn: {
    padding: "12px 20px",
    background: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "500",
    transition: "all 0.2s ease",
    flex: 1,
  },
  cancelBtn: {
    padding: "12px 24px",
    background: "#6c757d",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    flex: 1,
    transition: "all 0.2s ease",
  },
  saveSubmitBtn: {
    padding: "12px 24px",
    background: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
  },
};

// Add CSS animation for spinner
const styleSheet = document.styleSheets[0];
styleSheet.insertRule(`
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`, styleSheet.cssRules.length);

export default StockSoldPage;