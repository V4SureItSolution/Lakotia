import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { API_BASE } from "../config";

export default function StockUploadPage() {
  // Updated column order with Brand included
  const fixedHeaders = [
    "ID",
    "Item Name",
    "Brand",
    "Length",
    "Width",
    "Qty",
    "AutoCalculate Count",
    "Buy Price",
    "Batch Code",
    "Brand Code",
    "Brand Description",
    "HSN",
    "MRP",
    "Unit",
    "GST"
  ];

  // Configuration for duplicate detection - NOW INCLUDES BATCH CODE
  const duplicateDetectionFields = [
    "Item Name",
    "Batch Code",
    "HSN"
  ];

  // For batch-based uniqueness - if batch is different, it's a unique item
  const uniqueIdentifierFields = [
    "Item Name",
    "Batch Code"
  ];

  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [grnItems, setGrnItems] = useState([]);
  const [soldItems, setSoldItems] = useState([]);
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [existingStockMap, setExistingStockMap] = useState({});
  const [deductionStatus, setDeductionStatus] = useState({});
  const [mobileView, setMobileView] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);

  // Loading states
  const [loadingStock, setLoadingStock] = useState(false);
  const [loadingGrn, setLoadingGrn] = useState(false);
  const [loadingSold, setLoadingSold] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  const fileInputRef = useRef(null);

  // Check if mobile view on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setMobileView(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate count whenever length, width, or qty changes
  const calculateCount = (length, width, qty) => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const q = parseFloat(qty) || 0;
    return (l * w * q).toString();
  };

  // Update count when length, width, or qty changes
  const updateCell = (id, key, value) => {
    setRows((prev) => {
      return prev.map((r) => {
        if (r._id === id) {
          const updatedRow = { ...r, [key]: value };
          
          if (key === "Length" || key === "Width" || key === "Qty") {
            const length = key === "Length" ? value : r["Length"];
            const width = key === "Width" ? value : r["Width"];
            const qty = key === "Qty" ? value : r["Qty"];
            updatedRow["AutoCalculate Count"] = calculateCount(length, width, qty);
          }
          
          return updatedRow;
        }
        return r;
      });
    });
  };

  // -------------------------
  // Deduct sold quantity from matching stock and mark as deducted
  // -------------------------
  const deductFromStock = async (soldItem) => {
    if (!soldItem._hasMatch) {
      alert("No matching stock found for this item. Cannot deduct.");
      return;
    }

    // Find the matching stock item in current rows
    const matchingStockItem = findMatchingStockItemInRows(soldItem);
    
    if (!matchingStockItem) {
      alert("Matching stock item not found in current table.");
      return;
    }

    const soldQty = parseFloat(soldItem["Qty"]) || 0;
    const stockQty = parseFloat(matchingStockItem["Qty"]) || 0;
    
    if (stockQty < soldQty) {
      const confirmProceed = window.confirm(
        `Warning: Sold quantity (${soldQty}) is greater than available stock (${stockQty}).\n` +
        `Do you want to proceed with deduction?`
      );
      
      if (!confirmProceed) {
        return;
      }
    }

    // Calculate new quantity
    const newQty = Math.max(0, stockQty - soldQty);
    
    // Update the stock row
    setRows(prev => 
      prev.map(row => {
        if (row._id === matchingStockItem._id) {
          const updatedRow = { 
            ...row, 
            "Qty": newQty.toString(),
            "AutoCalculate Count": calculateCount(
              row["Length"],
              row["Width"],
              newQty
            )
          };
          return updatedRow;
        }
        return row;
      })
    );

    // Mark this sold item as deducted in the backend
    try {
      const response = await fetch(`${API_BASE}/stock_sold/mark_deducted/${soldItem._originalId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const result = await response.json();
      
      if (result.success) {
        // Update local state
        setDeductionStatus(prev => ({
          ...prev,
          [soldItem._id]: {
            deducted: true,
            stockItemId: matchingStockItem._id,
            originalQty: stockQty,
            soldQty: soldQty,
            newQty: newQty,
            deductedOn: new Date().toISOString()
          }
        }));

        // Remove deducted item from soldItems list
        setSoldItems(prev => prev.filter(item => item._id !== soldItem._id));

        setSuccess(`Deducted ${soldQty} from "${soldItem["Item Name"]}" (Batch: ${soldItem["Batch Code"] || "N/A"}). New quantity: ${newQty}. Item marked as deducted.`);
      } else {
        alert(`Failed to mark item as deducted: ${result.message}`);
      }
    } catch (error) {
      console.error("Error marking item as deducted:", error);
      alert("Failed to mark item as deducted. Please try again.");
    }
  };

  // -------------------------
  // Helper: Find matching stock item in current rows (MUST match BATCH CODE as well)
  // -------------------------
  const findMatchingStockItemInRows = (soldItem) => {
    const itemName = (soldItem["Item Name"] || "").toLowerCase().trim();
    const brandCode = (soldItem["Brand Code"] || "").toLowerCase().trim();
    const brand = (soldItem["Brand"] || "").toLowerCase().trim();
    const batchCode = (soldItem["Batch Code"] || "").toLowerCase().trim();
    
    // Try to find in current rows - BATCH CODE IS CRITICAL FOR MATCHING
    for (const row of rows) {
      let match = false;
      const rowBatchCode = (row["Batch Code"] || "").toLowerCase().trim();
      
      // If sold item has batch code, we must match by batch code first
      if (batchCode) {
        if (rowBatchCode === batchCode) {
          // Batch code matches, now check other fields
          if (itemName && (row["Item Name"] || "").toLowerCase().trim() === itemName) {
            match = true;
          } else if (brandCode && (row["Brand Code"] || "").toLowerCase().trim() === brandCode) {
            match = true;
          } else if (brand && (row["Brand"] || "").toLowerCase().trim() === brand) {
            match = true;
          }
        }
      } else {
        // No batch code on sold item, match by other fields
        if (itemName && (row["Item Name"] || "").toLowerCase().trim() === itemName) {
          match = true;
        } else if (brandCode && (row["Brand Code"] || "").toLowerCase().trim() === brandCode) {
          match = true;
        } else if (brand && (row["Brand"] || "").toLowerCase().trim() === brand) {
          match = true;
        }
      }
      
      if (match) {
        return row;
      }
    }
    
    return null;
  };

  // -------------------------
  // Utility: Excel download
  // -------------------------
  const downloadExcel = (data, filename = "unmatched_brands.xlsx", sheetName = "Unmatched") => {
    if (!data || data.length === 0) {
      alert("No data to download");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  };

  // ----------------------------------------------------
  // Utility: Duplicate checker - IMPROVED BATCH CODE AWARE
  // ----------------------------------------------------
  const checkForDuplicates = (newRows, existingRows, checkFields = duplicateDetectionFields) => {
    const duplicates = [];
    const uniqueNewRows = [];

    for (const newRow of newRows) {
      let isDuplicate = false;
      const newItemName = String(newRow["Item Name"] || "").trim().toLowerCase();
      const newBatchCode = String(newRow["Batch Code"] || "").trim().toLowerCase();
      const newHSN = String(newRow["HSN"] || "").trim().toLowerCase();
      
      for (const existingRow of existingRows) {
        const existingItemName = String(existingRow["Item Name"] || "").trim().toLowerCase();
        const existingBatchCode = String(existingRow["Batch Code"] || "").trim().toLowerCase();
        const existingHSN = String(existingRow["HSN"] || "").trim().toLowerCase();
        
        // CRITICAL: Different batch codes mean different items - NEVER duplicates
        if (newBatchCode && existingBatchCode && newBatchCode !== existingBatchCode) {
          continue; // Skip this existing row, it's a different batch
        }
        
        // Check if batch codes match or both are missing
        const batchCodeMatches = (
          (newBatchCode && existingBatchCode && newBatchCode === existingBatchCode) ||
          (!newBatchCode && !existingBatchCode)
        );
        
        // Only check duplicates if batch codes are compatible
        if (batchCodeMatches) {
          // Check if all duplicate detection fields match
          let allMatch = true;
          
          for (const field of checkFields) {
            const newValue = String(newRow[field] || "").trim().toLowerCase();
            const existingValue = String(existingRow[field] || "").trim().toLowerCase();
            
            // For Item Name and HSN, empty values don't count as matches
            if (field === "Item Name") {
              if (newValue !== existingValue || !newValue) {
                allMatch = false;
                break;
              }
            } else if (field === "Batch Code") {
              if (newValue !== existingValue) {
                allMatch = false;
                break;
              }
            } else {
              // For other fields, they need to match (can be empty)
              if (newValue !== existingValue) {
                allMatch = false;
                break;
              }
            }
          }

          if (allMatch) {
            isDuplicate = true;
            duplicates.push({
              ...newRow,
              duplicateOf: existingRow,
              duplicateFields: checkFields,
              reason: `Duplicate with same ${checkFields.join(", ")}${newBatchCode ? ` and Batch Code: ${newBatchCode}` : ""}`
            });
            break;
          }
        }
      }

      if (!isDuplicate) {
        uniqueNewRows.push(newRow);
      }
    }

    return { duplicates, uniqueNewRows };
  };

  // ----------------------------------------------------
  // Check if item exists based on Item Name AND Batch Code combination
  // ----------------------------------------------------
  const isItemWithBatchExists = (itemName, batchCode, existingRows) => {
    const normalizedItemName = (itemName || "").toLowerCase().trim();
    const normalizedBatchCode = (batchCode || "").toLowerCase().trim();
    
    return existingRows.some(row => {
      const rowItemName = (row["Item Name"] || "").toLowerCase().trim();
      const rowBatchCode = (row["Batch Code"] || "").toLowerCase().trim();
      
      // If batch code is provided, match exactly with batch code
      if (normalizedBatchCode) {
        return rowItemName === normalizedItemName && rowBatchCode === normalizedBatchCode;
      }
      
      // If no batch code, only match items that also have no batch code
      return rowItemName === normalizedItemName && !rowBatchCode;
    });
  };

  // ----------------------------------------------------
  // Create a lookup map for existing stock items - KEYED BY ITEM NAME + BATCH CODE
  // ----------------------------------------------------
  const createStockLookupMap = (stockRows) => {
    const map = {};
    
    stockRows.forEach(row => {
      const itemName = (row["Item Name"] || "").toLowerCase().trim();
      const batchCode = (row["Batch Code"] || "").toLowerCase().trim();
      const brandCode = (row["Brand Code"] || "").toLowerCase().trim();
      const brand = (row["Brand"] || "").toLowerCase().trim();
      
      // Create composite key with batch code (most specific)
      if (itemName && batchCode) {
        const key = `${itemName}|${batchCode}`;
        if (!map[key]) map[key] = [];
        map[key].push(row);
      }
      
      // For matching without batch code (fallback)
      if (itemName) {
        if (!map[itemName]) map[itemName] = [];
        map[itemName].push(row);
      }
      
      if (brandCode) {
        const key = `brandcode:${brandCode}`;
        if (!map[key]) map[key] = [];
        map[key].push(row);
      }
      
      if (brand) {
        const key = `brand:${brand}`;
        if (!map[key]) map[key] = [];
        map[key].push(row);
      }
    });
    
    return map;
  };

  // ----------------------------------------------------
  // Find matching stock item for a GRN/Sold item - BATCH CODE AWARE
  // ----------------------------------------------------
  const findMatchingStockItem = (importItem) => {
    const itemName = (importItem["Item Name"] || "").toLowerCase().trim();
    const batchCode = (importItem["Batch Code"] || "").toLowerCase().trim();
    const brandCode = (importItem["Brand Code"] || "").toLowerCase().trim();
    const brand = (importItem["Brand"] || "").toLowerCase().trim();
    
    // Try exact match with Item Name + Batch Code first (most accurate)
    if (itemName && batchCode) {
      const compositeKey = `${itemName}|${batchCode}`;
      if (existingStockMap[compositeKey] && existingStockMap[compositeKey].length > 0) {
        const match = existingStockMap[compositeKey].find(item => 
          item["Length"] && item["Width"] && 
          (parseFloat(item["Length"]) > 0 || parseFloat(item["Width"]) > 0)
        );
        if (match) return match;
        // If no match with dimensions, return first match
        return existingStockMap[compositeKey][0];
      }
    }
    
    // Try by Item Name only (without batch) - careful with this
    if (itemName && existingStockMap[itemName]) {
      // First try to find with matching batch code if available
      if (batchCode) {
        const exactBatchMatch = existingStockMap[itemName].find(item => 
          (item["Batch Code"] || "").toLowerCase().trim() === batchCode
        );
        if (exactBatchMatch) return exactBatchMatch;
      }
      
      // Otherwise find any match with dimensions
      const match = existingStockMap[itemName].find(item => 
        item["Length"] && item["Width"] && 
        (parseFloat(item["Length"]) > 0 || parseFloat(item["Width"]) > 0)
      );
      if (match) return match;
    }
    
    // Try by Brand Code
    if (brandCode && existingStockMap[`brandcode:${brandCode}`]) {
      const match = existingStockMap[`brandcode:${brandCode}`].find(item => 
        item["Length"] && item["Width"] && 
        (parseFloat(item["Length"]) > 0 || parseFloat(item["Width"]) > 0)
      );
      if (match) return match;
    }
    
    // Try by Brand
    if (brand && existingStockMap[`brand:${brand}`]) {
      const match = existingStockMap[`brand:${brand}`].find(item => 
        item["Length"] && item["Width"] && 
        (parseFloat(item["Length"]) > 0 || parseFloat(item["Width"]) > 0)
      );
      if (match) return match;
    }
    
    return null;
  };

  // ----------------------------------------------------
  // Fetch GRN items with intelligent matching - BATCH AWARE
  // ----------------------------------------------------
  const fetchGrnItems = async () => {
    try {
      setLoadingGrn(true);
      const res = await fetch(`${API_BASE}/grn/all?status=active`);
      const data = await res.json();
      
      if (data && data.success && Array.isArray(data.data)) {
        const mappedGrnItems = data.data.map((grn, index) => {
          const baseItem = {
            "ID": `GRN${Date.now()}${index}`,
            "Item Name": grn.item_name || "",
            "Brand": grn.brand || "",
            "Length": grn.length || 0,
            "Width": grn.width || 0,
            "Qty": grn.quantity || 0,
            "AutoCalculate Count": calculateCount(grn.length || 0, grn.width || 0, grn.quantity || 0),
            "Buy Price": grn.buy_price || 0,
            "Batch Code": grn.batch_code || "",
            "Brand Code": grn.brand_code || "",
            "Brand Description": grn.brand_description || "",
            "HSN": "",
            "MRP": 0,
            "Unit": grn.unit || "PCS",
            "GST": 0,
            _id: `grn_${index}_${Math.random().toString(36).slice(2, 9)}`,
            _source: "grn",
            _invoice: grn.invoice_number,
            _po: grn.po_number,
            _grnId: grn.id,
            _status: grn.status,
            _hasMatch: false,
            _matchReason: ""
          };
          
          const matchingStockItem = findMatchingStockItem(baseItem);
          
          if (matchingStockItem) {
            baseItem["Length"] = matchingStockItem["Length"] || grn.length || 0;
            baseItem["Width"] = matchingStockItem["Width"] || grn.width || 0;
            baseItem["AutoCalculate Count"] = calculateCount(
              baseItem["Length"],
              baseItem["Width"],
              baseItem["Qty"]
            );
            baseItem._hasMatch = true;
            baseItem._matchReason = matchingStockItem["Item Name"] || "Matching item found";
            if (matchingStockItem["Batch Code"] !== baseItem["Batch Code"]) {
              baseItem._matchReason += " (Different batch - will create new row)";
            }
          }
          
          return baseItem;
        });
        
        setGrnItems(mappedGrnItems);
      } else {
        setGrnItems([]);
      }
    } catch (error) {
      console.error("Error fetching GRN items:", error);
      setGrnItems([]);
    } finally {
      setLoadingGrn(false);
    }
  };

  // ----------------------------------------------------
  // Update GRN status to "done" when imported
  // ----------------------------------------------------
  const updateGrnStatusToDone = async (grnIds) => {
    try {
      if (!grnIds || grnIds.length === 0) return;
      
      const response = await fetch(`${API_BASE}/grn/update-status-bulk`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          grn_ids: grnIds,
          status: "done"
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`Updated ${grnIds.length} GRN items status to 'done'`);
        fetchGrnItems();
      } else {
        console.error("Failed to update GRN status:", result.message);
      }
    } catch (error) {
      console.error("Error updating GRN status:", error);
    }
  };

  // ----------------------------------------------------
  // Fetch Stock Sold items with intelligent matching - BATCH AWARE
  // ----------------------------------------------------
  const fetchSoldItems = async () => {
    try {
      setLoadingSold(true);
      const res = await fetch(`${API_BASE}/stock_sold/not_deducted`);
      const data = await res.json();
      
      if (data && data.success && Array.isArray(data.data)) {
        const mappedSoldItems = data.data.map((sold, index) => {
          const baseItem = {
            "ID": `SOLD${sold.id || Date.now()}${index}`,
            "Item Name": sold.item_name || "",
            "Brand": sold.company_name || "",
            "Length": 0,
            "Width": 0,
            "Qty": sold.quantity || 0,
            "AutoCalculate Count": calculateCount(0, 0, sold.quantity || 0),
            "Buy Price": 0,
            "Batch Code": sold.batch_code || "",
            "Brand Code": "",
            "Brand Description": "",
            "HSN": sold.hsn_sac || "",
            "MRP": sold.mrp || 0,
            "Unit": sold.unit || "PCS",
            "GST": 0,
            _id: `sold_${index}_${Math.random().toString(36).slice(2, 9)}`,
            _originalId: sold.id,
            _source: "stock_sold",
            _customer: sold.customer_name,
            _soldDate: sold.sold_date,
            _taskId: sold.task_id,
            _remarks: sold.sold_remarks,
            _hasMatch: false,
            _matchReason: "",
            _stockDeducted: sold.stock_deducted || "No"
          };
          
          const matchingStockItem = findMatchingStockItem(baseItem);
          
          if (matchingStockItem) {
            baseItem["Length"] = matchingStockItem["Length"] || 0;
            baseItem["Width"] = matchingStockItem["Width"] || 0;
            baseItem["AutoCalculate Count"] = calculateCount(
              baseItem["Length"],
              baseItem["Width"],
              baseItem["Qty"]
            );
            baseItem["Batch Code"] = matchingStockItem["Batch Code"] || baseItem["Batch Code"];
            baseItem["Brand Code"] = matchingStockItem["Brand Code"] || "";
            baseItem["Brand Description"] = matchingStockItem["Brand Description"] || "";
            baseItem._hasMatch = true;
            baseItem._matchReason = matchingStockItem["Item Name"] || "Matching item found";
          }
          
          return baseItem;
        });
        
        setSoldItems(mappedSoldItems);
      } else {
        setSoldItems([]);
      }
    } catch (error) {
      console.error("Error fetching Stock Sold items:", error);
      setSoldItems([]);
    } finally {
      setLoadingSold(false);
    }
  };

  // ----------------------------------------------------
  // Load GRN items into stock table - ALWAYS ADD AS NEW ROW (batch aware)
  // ----------------------------------------------------
  const loadGrnItemsToStock = async (selectedItems = []) => {
    let itemsToAdd;
    let grnIdsToUpdate = [];
    
    if (selectedItems.length === 0) {
      itemsToAdd = grnItems.map(item => ({
        ...item,
        _id: Math.random().toString(36).slice(2, 9),
        _source: "grn_imported"
      }));
      grnIdsToUpdate = grnItems.map(item => item._grnId).filter(id => id);
    } else {
      itemsToAdd = selectedItems.map(item => ({
        ...item,
        _id: Math.random().toString(36).slice(2, 9),
        _source: "grn_imported"
      }));
      grnIdsToUpdate = selectedItems.map(item => item._grnId).filter(id => id);
    }
    
    const matchedItems = itemsToAdd.filter(item => item._hasMatch).length;
    const newBatches = itemsToAdd.filter(item => {
      const exists = isItemWithBatchExists(item["Item Name"], item["Batch Code"], rows);
      return !exists;
    }).length;
    
    setRows(prev => [...prev, ...itemsToAdd]);
    
    if (grnIdsToUpdate.length > 0) {
      await updateGrnStatusToDone(grnIdsToUpdate);
    }
    
    setSuccess(`Added ${itemsToAdd.length} items from GRN to stock table. ${matchedItems > 0 ? `(${matchedItems} items have matched dimensions)` : ''} ${newBatches > 0 ? `${newBatches} new batch records created.` : ''}`);
    
    setShowGrnModal(false);
  };

  // ----------------------------------------------------
  // Load Stock Sold items into stock table - ALWAYS ADD AS NEW ROW
  // ----------------------------------------------------
  const loadSoldItemsToStock = (selectedItems = []) => {
    let itemsToAdd;
    
    if (selectedItems.length === 0) {
      itemsToAdd = soldItems.map(item => ({
        ...item,
        _id: Math.random().toString(36).slice(2, 9),
        _source: "sold_imported"
      }));
    } else {
      itemsToAdd = selectedItems.map(item => ({
        ...item,
        _id: Math.random().toString(36).slice(2, 9),
        _source: "sold_imported"
      }));
    }
    
    const matchedItems = itemsToAdd.filter(item => item._hasMatch).length;
    const newBatches = itemsToAdd.filter(item => {
      const exists = isItemWithBatchExists(item["Item Name"], item["Batch Code"], rows);
      return !exists;
    }).length;
    
    setRows(prev => [...prev, ...itemsToAdd]);
    setSuccess(`Added ${itemsToAdd.length} items from Stock Sold to stock table. ${matchedItems > 0 ? `(${matchedItems} items have matched dimensions)` : ''} ${newBatches > 0 ? `${newBatches} new batch records created.` : ''}`);
    
    setShowSoldModal(false);
  };

  // ----------------------------------------------------
  // Search functionality
  // ----------------------------------------------------
  const handleSearch = (term) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setFilteredRows(rows);
      setCurrentPage(1);
      return;
    }
    
    const searchLower = term.toLowerCase();
    const filtered = rows.filter(row => {
      return fixedHeaders.some(header => {
        const value = row[header];
        return value && String(value).toLowerCase().includes(searchLower);
      });
    });
    
    setFilteredRows(filtered);
    setCurrentPage(1);
  };

  // Update filtered rows when rows change
  useEffect(() => {
    setFilteredRows(rows);
  }, [rows]);

  // ----------------------------------------------------
  // Update existing stock map when rows change
  // ----------------------------------------------------
  useEffect(() => {
    if (rows.length > 0) {
      const map = createStockLookupMap(rows);
      setExistingStockMap(map);
    }
  }, [rows]);

  // ----------------------------------------------------
  // Pagination calculations
  // ----------------------------------------------------
  const displayRows = searchTerm ? filteredRows : rows;
  const totalPages = Math.ceil(displayRows.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = displayRows.slice(indexOfFirstRow, indexOfLastRow);

  // ----------------------------------------------------
  // Pagination handlers
  // ----------------------------------------------------
  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const handleFirstPage = () => goToPage(1);
  const handleLastPage = () => goToPage(totalPages);
  const handlePrevPage = () => goToPage(currentPage - 1);
  const handleNextPage = () => goToPage(currentPage + 1);

  // Reset to first page when rows change
  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length, searchTerm]);

  // ----------------------------------------------------
  // Add multiple empty rows
  // ----------------------------------------------------
  const handleAddRows = () => {
    const count = prompt("Enter number of rows to add:");
    if (!count) return;
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) {
      alert("Enter a valid positive number");
      return;
    }
    const emptyRows = Array.from({ length: n }).map((_, index) => {
      const row = {};
      fixedHeaders.forEach((h) => {
        if (h === "ID") {
          row[h] = `ID${Date.now()}${index}`;
        } else if (h === "AutoCalculate Count") {
          row[h] = "0";
        } else {
          row[h] = "";
        }
      });
      return { ...row, _id: Math.random().toString(36).slice(2, 9) };
    });
    setRows((prev) => [...prev, ...emptyRows]);
  };

  // ----------------------------------------------------
  // Fetch stock (initial load)
  // ----------------------------------------------------
  useEffect(() => {
    const fetchStock = async () => {
      try {
        setLoadingStock(true);
        setError("");
        const res = await fetch(`${API_BASE}/stock/all`);
        const data = await res.json();
        
        if (data && data.success && Array.isArray(data.data)) {
          const finalRows = data.data.map((row, index) => {
            const updatedRow = {
              "ID": row.ID || row.stock_id || "",
              "Item Name": row["Item Name"] || row.item_name || "",
              "Brand": row["Brand"] || row.brand || "",
              "Length": row.Length || row.length || 0,
              "Width": row.Width || row.width || 0,
              "Qty": row.Qty || row.quantity || 0,
              "AutoCalculate Count": row["AutoCalculate Count"] || row.auto_calculate_count || 0,
              "Buy Price": row["Buy Price"] || row.buy_price || 0,
              "Batch Code": row["Batch Code"] || row.batch_code || "",
              "Brand Code": row["Brand Code"] || row.brand_code || "",
              "Brand Description": row["Brand Description"] || row.brand_description || "",
              "HSN": row.HSN || row.hsn || "",
              "MRP": row.MRP || row.mrp || 0,
              "Unit": row.Unit || row.unit || "",
              "GST": row.GST || row.gst || 0,
              _id: index + "_" + Math.random().toString(36).slice(2, 7),
            };
            
            if (!updatedRow["AutoCalculate Count"] || updatedRow["AutoCalculate Count"] === 0) {
              updatedRow["AutoCalculate Count"] = calculateCount(
                updatedRow["Length"],
                updatedRow["Width"],
                updatedRow["Qty"]
              );
            }
            
            if (!updatedRow["ID"]) {
              updatedRow["ID"] = `ID${Date.now()}${index}`;
            }
            
            return updatedRow;
          });
          
          setRows(finalRows);
          setFilteredRows(finalRows);
          
          const map = createStockLookupMap(finalRows);
          setExistingStockMap(map);
          
        } else {
          setRows([]);
          setFilteredRows([]);
          if (data && !data.success) {
            setError(data.message || "Failed to load stock data");
          }
        }
      } catch (e) {
        console.error("Error loading stock:", e);
        setError("Error loading stock data. Check if server is running.");
      } finally {
        setLoadingStock(false);
      }
    };

    fetchStock();
    fetchGrnItems();
  }, []);

  // ----------------------------------------------------
  // Handle Excel upload - IMPROVED BATCH AWARE DUPLICATE DETECTION
  // ----------------------------------------------------
  const handleFile = (e) => {
    setError("");
    setSuccess("");
    setUnmatched([]);
    setSearchTerm("");

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!Array.isArray(json) || json.length === 0) {
          setError("Excel file is empty.");
          return;
        }

        // Normalize keys
        const finalRows = json.map((rawRow, idx) => {
          const lookup = {};
          Object.keys(rawRow).forEach((k) => {
            if (!k) return;
            lookup[k.trim().toLowerCase()] = rawRow[k];
          });

          const mapped = {};
          for (const header of fixedHeaders) {
            const keyLower = header.toLowerCase();
            const altKey1 = keyLower.replace(/ /g, "");
            const altKey2 = keyLower.replace(/[-_]/g, "");
            
            if (header === "AutoCalculate Count") {
              const length = lookup["length"] || lookup["len"] || "";
              const width = lookup["width"] || lookup["wid"] || "";
              const qty = lookup["qty"] || lookup["quantity"] || "";
              
              if (lookup[keyLower] || lookup[altKey1] || lookup[altKey2]) {
                mapped[header] = lookup[keyLower] || lookup[altKey1] || lookup[altKey2] || "";
              } else if (length && width && qty) {
                mapped[header] = calculateCount(length, width, qty);
              } else {
                mapped[header] = "";
              }
            } else if (header === "ID" && !lookup[keyLower] && !lookup[altKey1] && !lookup[altKey2]) {
              mapped[header] = `ID${Date.now()}${idx}`;
            } else {
              mapped[header] =
                lookup[keyLower] ??
                lookup[altKey1] ??
                lookup[altKey2] ??
                "";
            }
          }

          return {
            ...mapped,
            _id: idx + "_" + Math.random().toString(36).slice(2, 7),
          };
        });

        // Duplicate detection with batch awareness
        const existingRows = rows;
        const { duplicates, uniqueNewRows } = checkForDuplicates(finalRows, existingRows);

        if (duplicates.length > 0) {
          const batchInfo = duplicates.some(dup => dup["Batch Code"]) 
            ? "\n\nNOTE: Items with DIFFERENT Batch Codes are ALWAYS added as new rows, even if other details match." 
            : "";
            
          const shouldSkipDuplicates = window.confirm(
            `Found ${duplicates.length} duplicate row(s) based on:\n` +
            `${duplicateDetectionFields.join(", ")}\n\n` +
            `Do you want to skip duplicates and add only ${uniqueNewRows.length} unique rows?\n\n` +
            `Click OK to skip duplicates\n` +
            `Click Cancel to add all ${finalRows.length} rows (including duplicates)${batchInfo}`
          );

          if (shouldSkipDuplicates) {
            setRows(prev => [...prev, ...uniqueNewRows]);
            setSuccess(`Added ${uniqueNewRows.length} unique rows. Skipped ${duplicates.length} duplicate(s).`);
            
            const duplicateDisplay = duplicates.map(dup => ({
              Item: dup["Item Name"] || "(No Item Name)",
              Brand: dup["Brand"] || "(No Brand)",
              Batch: dup["Batch Code"] || "(No Batch)",
              HSN: dup.HSN || "(No HSN)",
              MRP: dup.MRP || "(No MRP)",
              Status: `Duplicate - Skipped (Same ${duplicateDetectionFields.join(", ")})`
            }));
            
            setUnmatched(prev => [...prev, ...duplicateDisplay]);
          } else {
            setRows(prev => [...prev, ...finalRows]);
            setSuccess(`Added all ${finalRows.length} rows (including ${duplicates.length} duplicates).`);
          }
        } else {
          setRows(prev => [...prev, ...finalRows]);
          setSuccess(`Added ${finalRows.length} unique rows successfully.`);
        }

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

      } catch (err) {
        console.error(err);
        setError("Invalid Excel file. Upload a valid .xlsx/.xls file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ----------------------------------------------------
  // Download unmatched Excel
  // ----------------------------------------------------
  const handleDownloadUnmatched = () => {
    if (unmatched.length === 0) {
      alert("No issues to download.");
      return;
    }
    downloadExcel(unmatched, "issues_found.xlsx", "Issues");
  };

  // ----------------------------------------------------
  // Intelligent Save Function
  // ----------------------------------------------------
  const saveToBackend = async () => {
    if (rows.length === 0) {
      setError("No data to save.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // Clean data
      const cleaned = rows.map((r) => {
        const copy = { ...r };
        delete copy._id;
        delete copy._source;
        delete copy._invoice;
        delete copy._po;
        delete copy._customer;
        delete copy._soldDate;
        delete copy._taskId;
        delete copy._remarks;
        delete copy._hasMatch;
        delete copy._matchReason;
        delete copy._deducted;
        delete copy._deductionInfo;
        delete copy._grnId;
        delete copy._status;
        
        const numericFields = ["Length", "Width", "Qty", "Buy Price", "MRP", "GST"];
        numericFields.forEach(field => {
          if (copy[field] !== undefined && copy[field] !== null && copy[field] !== "") {
            copy[field] = parseFloat(copy[field]) || 0;
          }
        });
        
        if ((!copy["AutoCalculate Count"] || copy["AutoCalculate Count"] === 0) && 
            copy["Length"] && copy["Width"] && copy["Qty"]) {
          copy["AutoCalculate Count"] = calculateCount(copy["Length"], copy["Width"], copy["Qty"]);
        }
        
        return copy;
      });

      // Check for existing items - now including batch code in uniqueness check
      const uniqueIdentifiers = cleaned.map(r => ({
        item_name: r["Item Name"],
        batch_code: r["Batch Code"] || null,
        brand_code: r["Brand Code"]
      })).filter(id => id.item_name);
      
      if (uniqueIdentifiers.length === 0) {
        const saveRes = await fetch(`${API_BASE}/stock/bulk-save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: cleaned }),
        });
        
        const saveData = await saveRes.json();
        if (saveData && saveData.success) {
          const savedCount = saveData.saved || cleaned.length;
          setSuccess(`Successfully saved ${savedCount} new items.`);
          
          if (saveData.duplicates && saveData.duplicates.length > 0) {
            setUnmatched(prev => [
              ...prev,
              ...saveData.duplicates.map(dup => ({
                Item: "Duplicate",
                Brand: "",
                Batch: dup,
                HSN: "",
                MRP: "",
                Status: "Duplicate - Skipped"
              }))
            ]);
          }
          
          // Refresh data
          const refreshRes = await fetch(`${API_BASE}/stock/all`);

          const refreshData = await refreshRes.json();
          if (refreshData && refreshData.success && Array.isArray(refreshData.data)) {
            const refreshedRows = refreshData.data.map((row, index) => ({
              "ID": row.ID || row.stock_id || "",
              "Item Name": row["Item Name"] || row.item_name || "",
              "Brand": row["Brand"] || row.brand || "",
              "Length": row.Length || row.length || 0,
              "Width": row.Width || row.width || 0,
              "Qty": row.Qty || row.quantity || 0,
              "AutoCalculate Count": row["AutoCalculate Count"] || row.auto_calculate_count || 0,
              "Buy Price": row["Buy Price"] || row.buy_price || 0,
              "Batch Code": row["Batch Code"] || row.batch_code || "",
              "Brand Code": row["Brand Code"] || row.brand_code || "",
              "Brand Description": row["Brand Description"] || row.brand_description || "",
              "HSN": row.HSN || row.hsn || "",
              "MRP": row.MRP || row.mrp || 0,
              "Unit": row.Unit || row.unit || "",
              "GST": row.GST || row.gst || 0,
              _id: index + "_" + Math.random().toString(36).slice(2, 7),
            }));
            setRows(refreshedRows);
            setFilteredRows(refreshedRows);
          }
        } else {
          setError(saveData?.message || "Failed to save items.");
        }
        return;
      }

      const checkExistingRes = await fetch(`${API_BASE}/stock/check-batch-unique`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: uniqueIdentifiers }),
      });
      
      const checkData = await checkExistingRes.json();
      
      if (!checkData || !checkData.success) {
        setError("Failed to check existing items.");
        return;
      }
      
      // Filter items based on Item Name + Batch Code combination
      const existingKeys = new Set(checkData.existing?.map(item => `${item.item_name}|${item.batch_code || ""}`) || []);
      const newItems = cleaned.filter(item => {
        const key = `${item["Item Name"]}|${item["Batch Code"] || ""}`;
        return !existingKeys.has(key);
      });
      
      const existingItems = cleaned.filter(item => {
        const key = `${item["Item Name"]}|${item["Batch Code"] || ""}`;
        return existingKeys.has(key);
      });

      let savedNewCount = 0;
      let updatedCount = 0;
      let errors = [];

      // Save new items
      if (newItems.length > 0) {
        const saveRes = await fetch(`${API_BASE}/stock/bulk-save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: newItems }),
        });
        
        const saveData = await saveRes.json();
        if (saveData && saveData.success) {
          savedNewCount = saveData.saved || newItems.length;
          
          if (saveData.duplicates && saveData.duplicates.length > 0) {
            setUnmatched(prev => [
              ...prev,
              ...saveData.duplicates.map(dup => ({
                Item: "Duplicate",
                Brand: "",
                Batch: dup,
                HSN: "",
                MRP: "",
                Status: "Duplicate - Skipped"
              }))
            ]);
          }
        } else {
          errors.push(`Failed to save new items: ${saveData?.message || "Unknown error"}`);
        }
      }

      // Update existing items (same Item Name & Batch Code combination)
      if (existingItems.length > 0) {
        const updateRes = await fetch(`${API_BASE}/stock/update`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: existingItems }),
        });
        
        const updateData = await updateRes.json();
        if (updateData && updateData.success) {
          updatedCount = updateData.updated || existingItems.length;
          
          if (updateData.not_found && updateData.not_found.length > 0) {
            const notFoundDisplay = updateData.not_found.map(item => ({
              Item: "Not Found",
              Brand: "",
              Batch: item,
              HSN: "",
              MRP: "",
              Status: "Not Found in Database"
            }));
            setUnmatched(prev => [...prev, ...notFoundDisplay]);
          }
        } else {
          errors.push(`Failed to update existing items: ${updateData?.message || "Unknown error"}`);
        }
      }

      if (errors.length === 0) {
        let message = "Stock data processed successfully!";
        if (savedNewCount > 0) message += ` Added ${savedNewCount} new items (unique by Item Name & Batch Code).`;
        if (updatedCount > 0) message += ` Updated ${updatedCount} existing items.`;
        
        const deductedItems = Object.keys(deductionStatus).length;
        if (deductedItems > 0) {
          message += ` ${deductedItems} sold items deducted from stock.`;
          
          // Clear deduction status after successful save
          setDeductionStatus({});
          
          // Refresh sold items to hide deducted ones
          fetchSoldItems();
        }
        
        setSuccess(message);
        
        // Refresh stock data
        const refreshRes = await fetch(`${API_BASE}/stock/all`);

        const refreshData = await refreshRes.json();
        if (refreshData && refreshData.success && Array.isArray(refreshData.data)) {
          const refreshedRows = refreshData.data.map((row, index) => ({
            "ID": row.ID || row.stock_id || "",
            "Item Name": row["Item Name"] || row.item_name || "",
            "Brand": row["Brand"] || row.brand || "",
            "Length": row.Length || row.length || 0,
            "Width": row.Width || row.width || 0,
            "Qty": row.Qty || row.quantity || 0,
            "AutoCalculate Count": row["AutoCalculate Count"] || row.auto_calculate_count || 0,
            "Buy Price": row["Buy Price"] || row.buy_price || 0,
            "Batch Code": row["Batch Code"] || row.batch_code || "",
            "Brand Code": row["Brand Code"] || row.brand_code || "",
            "Brand Description": row["Brand Description"] || row.brand_description || "",
            "HSN": row.HSN || row.hsn || "",
            "MRP": row.MRP || row.mrp || 0,
            "Unit": row.Unit || row.unit || "",
            "GST": row.GST || row.gst || 0,
            _id: index + "_" + Math.random().toString(36).slice(2, 7),
          }));
          setRows(refreshedRows);
          setFilteredRows(refreshedRows);
        }
      } else {
        setError(errors.join(" "));
      }

    } catch (err) {
      console.error("Save error:", err);
      setError("Backend error. Check API connection and make sure server is running.");
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------
  // DELETE FUNCTION
  // ----------------------------------------------------
  const deleteRow = async (id, rowData) => {
    if (!window.confirm("Are you sure you want to delete this item?")) {
      return;
    }

    try {
      const deleteData = {};
      if (rowData["ID"] && rowData["ID"].trim()) {
        deleteData.ID = rowData["ID"];
      }
      if (rowData["Brand Code"] && rowData["Brand Code"].trim()) {
        deleteData["Brand Code"] = rowData["Brand Code"];
      }
      if (rowData["Batch Code"] && rowData["Batch Code"].trim()) {
        deleteData["Batch Code"] = rowData["Batch Code"];
      }

      if (!deleteData.ID && !deleteData["Brand Code"] && !deleteData["Batch Code"]) {
        setError("Cannot delete item: No ID, Brand Code, or Batch Code found");
        return;
      }

      const res = await fetch(`${API_BASE}/stock/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deleteData),
      });

      const data = await res.json();
      
      if (data && data.success) {
        setRows(prev => prev.filter((r) => r._id !== id));
        setSuccess("Item deleted successfully!");
        
        const refreshRes = await fetch(`${API_BASE}/stock/all`);
        const refreshData = await refreshRes.json();
        if (refreshData && refreshData.success && Array.isArray(refreshData.data)) {
          const refreshedRows = refreshData.data.map((row, index) => ({
            "ID": row.ID || row.stock_id || "",
            "Item Name": row["Item Name"] || row.item_name || "",
            "Brand": row["Brand"] || row.brand || "",
            "Length": row.Length || row.length || 0,
            "Width": row.Width || row.width || 0,
            "Qty": row.Qty || row.quantity || 0,
            "AutoCalculate Count": row["AutoCalculate Count"] || row.auto_calculate_count || 0,
            "Buy Price": row["Buy Price"] || row.buy_price || 0,
            "Batch Code": row["Batch Code"] || row.batch_code || "",
            "Brand Code": row["Brand Code"] || row.brand_code || "",
            "Brand Description": row["Brand Description"] || row.brand_description || "",
            "HSN": row.HSN || row.hsn || "",
            "MRP": row.MRP || row.mrp || 0,
            "Unit": row.Unit || row.unit || "",
            "GST": row.GST || row.gst || 0,
            _id: index + "_" + Math.random().toString(36).slice(2, 7),
          }));
          setRows(refreshedRows);
          setFilteredRows(refreshedRows);
        }
      } else {
        setError(data?.message || "Failed to delete item.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      setError("Backend error during deletion.");
    }
  };

  // ----------------------------------------------------
  // Export current data to Excel
  // ----------------------------------------------------
  const exportToExcel = () => {
    if (rows.length === 0) {
      alert("No data to export.");
      return;
    }

    const exportData = rows.map(row => {
      const exportRow = {};
      fixedHeaders.forEach(header => {
        exportRow[header] = row[header] || "";
      });
      return exportRow;
    });

    downloadExcel(exportData, "stock_data.xlsx", "Stock");
    setSuccess(`Exported ${exportData.length} rows to Excel.`);
  };

  // ----------------------------------------------------
  // Refresh GRN items
  // ----------------------------------------------------
  const refreshGrnItems = () => {
    fetchGrnItems();
    setSuccess("GRN items refreshed.");
  };

  // ----------------------------------------------------
  // Refresh Sold items
  // ----------------------------------------------------
  const refreshSoldItems = () => {
    fetchSoldItems();
    setSuccess("Stock Sold items refreshed.");
  };

  // ----------------------------------------------------
  // Simple inline spinner style
  // ----------------------------------------------------
  const spinnerStyle = {
    display: "inline-block",
    width: 14,
    height: 14,
    border: "2px solid rgba(0,0,0,0.2)",
    borderTopColor: "rgba(0,0,0,0.6)",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    marginLeft: 8,
  };

  // Add keyframes via style tag for spinner animation
  const Keyframes = () => (
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  );

  // ----------------------------------------------------
  // Render page numbers
  // ----------------------------------------------------
  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = mobileView ? 3 : 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) pageNumbers.push("...");
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageNumbers.push("...");
        pageNumbers.push(totalPages);
      }
    }

    return pageNumbers;
  };

  // ----------------------------------------------------
  // GRN Modal Component
  // ----------------------------------------------------
  const GrnModal = () => {
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchGrnTerm, setSearchGrnTerm] = useState("");

    const filteredGrnItems = grnItems.filter(item => {
      if (!searchGrnTerm) return true;
      const term = searchGrnTerm.toLowerCase();
      return (
        (item["Item Name"] || "").toLowerCase().includes(term) ||
        (item["Brand"] || "").toLowerCase().includes(term) ||
        (item["Batch Code"] || "").toLowerCase().includes(term) ||
        (item["Brand Code"] || "").toLowerCase().includes(term) ||
        (item._invoice || "").toLowerCase().includes(term) ||
        (item._po || "").toLowerCase().includes(term)
      );
    });

    const toggleSelectItem = (id) => {
      setSelectedItems(prev => 
        prev.includes(id) 
          ? prev.filter(itemId => itemId !== id)
          : [...prev, id]
      );
    };

    const selectAll = () => {
      if (selectedItems.length === filteredGrnItems.length) {
        setSelectedItems([]);
      } else {
        setSelectedItems(filteredGrnItems.map(item => item._id));
      }
    };

    const handleLoadSelected = async () => {
      const itemsToLoad = filteredGrnItems.filter(item => selectedItems.includes(item._id));
      await loadGrnItemsToStock(itemsToLoad);
    };

    const handleLoadAll = async () => {
      await loadGrnItemsToStock();
    };

    const modalStyle = {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      padding: mobileView ? "10px" : "0",
    };

    const modalContentStyle = {
      backgroundColor: "white",
      padding: mobileView ? "15px" : "20px",
      borderRadius: "8px",
      maxWidth: mobileView ? "100%" : "90%",
      maxHeight: "90%",
      overflow: "auto",
      width: mobileView ? "100%" : "1200px",
    };

    return (
      <div style={modalStyle}>
        <div style={modalContentStyle}>
          <div style={{ 
            display: "flex", 
            flexDirection: mobileView ? "column" : "row",
            justifyContent: "space-between", 
            alignItems: mobileView ? "flex-start" : "center",
            gap: mobileView ? "12px" : "0",
            marginBottom: "20px" 
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: mobileView ? "18px" : "24px" }}>Import Items from GRN</h3>
              <p style={{ margin: "5px 0 0 0", color: "#666", fontSize: mobileView ? "12px" : "14px" }}>
                Items with matching stock entries will automatically get Length & Width values.<br/>
                <strong>Note: Items with different Batch Codes are treated as unique entries.</strong>
              </p>
            </div>
            <button 
              onClick={() => setShowGrnModal(false)}
              style={{ 
                background: "#dc3545", 
                color: "white", 
                border: "none", 
                padding: mobileView ? "6px 12px" : "8px 16px", 
                borderRadius: "4px", 
                cursor: "pointer",
                width: mobileView ? "100%" : "auto",
                fontSize: mobileView ? "14px" : "16px"
              }}
            >
              Close
            </button>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <div style={{ 
              display: "flex", 
              flexDirection: mobileView ? "column" : "row", 
              gap: "10px", 
              marginBottom: "10px" 
            }}>
              <input
                type="text"
                placeholder="Search GRN items..."
                value={searchGrnTerm}
                onChange={(e) => setSearchGrnTerm(e.target.value)}
                style={{ 
                  flex: 1, 
                  padding: mobileView ? "10px" : "8px", 
                  border: "1px solid #ddd", 
                  borderRadius: "4px",
                  fontSize: mobileView ? "16px" : "14px"
                }}
              />
              <button
                onClick={refreshGrnItems}
                disabled={loadingGrn}
                style={{ 
                  background: "#17a2b8", 
                  color: "white", 
                  border: "none", 
                  padding: mobileView ? "10px" : "8px 16px", 
                  borderRadius: "4px", 
                  cursor: "pointer",
                  width: mobileView ? "100%" : "auto",
                  fontSize: mobileView ? "16px" : "14px"
                }}
              >
                {loadingGrn ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            
            <div style={{ 
              display: "flex", 
              flexDirection: mobileView ? "column" : "row",
              justifyContent: "space-between", 
              alignItems: mobileView ? "flex-start" : "center",
              gap: mobileView ? "10px" : "0",
            }}>
              <div style={{ 
                color: "#666", 
                fontSize: mobileView ? "13px" : "14px",
                marginBottom: mobileView ? "10px" : "0"
              }}>
                Found {filteredGrnItems.length} active items • Selected {selectedItems.length} items • 
                <span style={{ color: "#28a745", fontWeight: "bold", marginLeft: "10px" }}>
                  {filteredGrnItems.filter(item => item._hasMatch).length} matched
                </span>
              </div>
              <div style={{ 
                display: "flex", 
                flexDirection: mobileView ? "column" : "row",
                gap: "10px",
                width: mobileView ? "100%" : "auto"
              }}>
                <button
                  onClick={selectAll}
                  style={{ 
                    background: "#6c757d", 
                    color: "white", 
                    border: "none", 
                    padding: mobileView ? "10px" : "8px 16px", 
                    borderRadius: "4px", 
                    cursor: "pointer",
                    width: mobileView ? "100%" : "auto",
                    fontSize: mobileView ? "14px" : "13px"
                  }}
                >
                  {selectedItems.length === filteredGrnItems.length ? "Deselect All" : "Select All"}
                </button>
                <button
                  onClick={handleLoadSelected}
                  disabled={selectedItems.length === 0}
                  style={{ 
                    background: selectedItems.length > 0 ? "#28a745" : "#ccc", 
                    color: "white", 
                    border: "none", 
                    padding: mobileView ? "10px" : "8px 16px", 
                    borderRadius: "4px", 
                    cursor: selectedItems.length > 0 ? "pointer" : "default",
                    width: mobileView ? "100%" : "auto",
                    fontSize: mobileView ? "14px" : "13px"
                  }}
                >
                  Load Selected ({selectedItems.length})
                </button>
                <button
                  onClick={handleLoadAll}
                  disabled={filteredGrnItems.length === 0}
                  style={{ 
                    background: filteredGrnItems.length > 0 ? "#007bff" : "#ccc", 
                    color: "white", 
                    border: "none", 
                    padding: mobileView ? "10px" : "8px 16px", 
                    borderRadius: "4px", 
                    cursor: filteredGrnItems.length > 0 ? "pointer" : "default",
                    width: mobileView ? "100%" : "auto",
                    fontSize: mobileView ? "14px" : "13px"
                  }}
                >
                  Load All ({filteredGrnItems.length})
                </button>
              </div>
            </div>
          </div>

          {loadingGrn ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div style={spinnerStyle}></div>
              <p>Loading GRN items...</p>
            </div>
          ) : filteredGrnItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
              No active GRN items found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ 
                width: "100%", 
                borderCollapse: "collapse",
                fontSize: mobileView ? "12px" : "14px"
              }}>
                <thead style={{ background: "#f3f3f3" }}>
                  <tr>
                    <th style={{ width: "40px", padding: mobileView ? "8px 4px" : "8px" }}>
                      <input
                        type="checkbox"
                        checked={selectedItems.length === filteredGrnItems.length && filteredGrnItems.length > 0}
                        onChange={selectAll}
                        disabled={filteredGrnItems.length === 0}
                      />
                    </th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>Item</th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>Brand</th>
                    {!mobileView && (
                      <>
                        <th style={{ padding: "8px" }}>Brand Code</th>
                        <th style={{ padding: "8px" }}>Batch</th>
                      </>
                    )}
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>Qty</th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>Price</th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>L/W</th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGrnItems.map((item) => (
                    <tr key={item._id} style={{ 
                      background: selectedItems.includes(item._id) ? "#e3f2fd" : "white",
                      borderLeft: item._hasMatch ? "4px solid #28a745" : "1px solid #ddd"
                    }}>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px" }}>
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item._id)}
                          onChange={() => toggleSelectItem(item._id)}
                        />
                      </td>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px" }}>
                        {mobileView ? (
                          <div>
                            <div style={{ fontWeight: "bold" }}>{item["Item Name"]}</div>
                            <div style={{ fontSize: "10px", color: "#666" }}>
                              {item["Brand Code"]} • {item["Batch Code"]}
                            </div>
                          </div>
                        ) : (
                          item["Item Name"]
                        )}
                      </td>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px" }}>{item["Brand"]}</td>
                      {!mobileView && (
                        <>
                          <td style={{ padding: "8px" }}>{item["Brand Code"]}</td>
                          <td style={{ padding: "8px", fontWeight: "bold", color: "#007bff" }}>{item["Batch Code"]}</td>
                        </>
                      )}
                      <td style={{ padding: mobileView ? "8px 4px" : "8px" }}>{item["Qty"]}</td>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px" }}>{item["Buy Price"]}</td>
                      <td style={{ 
                        padding: mobileView ? "8px 4px" : "8px",
                        background: item._hasMatch ? "#d4edda" : "transparent"
                      }}>
                        {mobileView ? (
                          <div>
                            <div>L:{item["Length"]}</div>
                            <div>W:{item["Width"]}</div>
                          </div>
                        ) : (
                          `${item["Length"]}/${item["Width"]}`
                        )}
                      </td>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px" }}>
                        <span style={{
                          background: item._hasMatch ? "#28a745" : "#6c757d",
                          color: "white",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: mobileView ? "10px" : "12px",
                          display: "inline-block",
                          whiteSpace: "nowrap"
                        }}>
                          {item._hasMatch ? "✓" : "No"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // Stock Sold Modal Component
  // ----------------------------------------------------
  const SoldModal = () => {
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchSoldTerm, setSearchSoldTerm] = useState("");

    const filteredSoldItems = soldItems.filter(item => {
      if (!searchSoldTerm) return true;
      const term = searchSoldTerm.toLowerCase();
      return (
        (item["Item Name"] || "").toLowerCase().includes(term) ||
        (item["Brand"] || "").toLowerCase().includes(term) ||
        (item["HSN"] || "").toLowerCase().includes(term) ||
        (item._customer || "").toLowerCase().includes(term) ||
        (item._taskId || "").toLowerCase().includes(term) ||
        (item._remarks || "").toLowerCase().includes(term)
      );
    });

    const toggleSelectItem = (id) => {
      setSelectedItems(prev => 
        prev.includes(id) 
          ? prev.filter(itemId => itemId !== id)
          : [...prev, id]
      );
    };

    const selectAll = () => {
      if (selectedItems.length === filteredSoldItems.length) {
        setSelectedItems([]);
      } else {
        setSelectedItems(filteredSoldItems.map(item => item._id));
      }
    };

    const handleLoadSelected = () => {
      const itemsToLoad = filteredSoldItems.filter(item => selectedItems.includes(item._id));
      loadSoldItemsToStock(itemsToLoad);
    };

    const handleLoadAll = () => {
      loadSoldItemsToStock();
    };

    const modalStyle = {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      padding: mobileView ? "10px" : "0",
    };

    const modalContentStyle = {
      backgroundColor: "white",
      padding: mobileView ? "15px" : "20px",
      borderRadius: "8px",
      maxWidth: mobileView ? "100%" : "90%",
      maxHeight: "90%",
      overflow: "auto",
      width: mobileView ? "100%" : "1200px",
    };

    return (
      <div style={modalStyle}>
        <div style={modalContentStyle}>
          <div style={{ 
            display: "flex", 
            flexDirection: mobileView ? "column" : "row",
            justifyContent: "space-between", 
            alignItems: mobileView ? "flex-start" : "center",
            gap: mobileView ? "12px" : "0",
            marginBottom: "20px" 
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: mobileView ? "18px" : "24px" }}>Import from Stock Sold</h3>
              <p style={{ margin: "5px 0 0 0", color: "#666", fontSize: mobileView ? "12px" : "14px" }}>
                Click "Deduct" to subtract sold quantity from current stock.<br/>
                <strong>Note: Deductions require matching Item Name AND Batch Code.</strong>
              </p>
            </div>
            <button 
              onClick={() => setShowSoldModal(false)}
              style={{ 
                background: "#dc3545", 
                color: "white", 
                border: "none", 
                padding: mobileView ? "6px 12px" : "8px 16px", 
                borderRadius: "4px", 
                cursor: "pointer",
                width: mobileView ? "100%" : "auto",
                fontSize: mobileView ? "14px" : "16px"
              }}
            >
              Close
            </button>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <div style={{ 
              display: "flex", 
              flexDirection: mobileView ? "column" : "row", 
              gap: "10px", 
              marginBottom: "10px" 
            }}>
              <input
                type="text"
                placeholder="Search items..."
                value={searchSoldTerm}
                onChange={(e) => setSearchSoldTerm(e.target.value)}
                style={{ 
                  flex: 1, 
                  padding: mobileView ? "10px" : "8px", 
                  border: "1px solid #ddd", 
                  borderRadius: "4px",
                  fontSize: mobileView ? "16px" : "14px"
                }}
              />
              <button
                onClick={refreshSoldItems}
                disabled={loadingSold}
                style={{ 
                  background: "#17a2b8", 
                  color: "white", 
                  border: "none", 
                  padding: mobileView ? "10px" : "8px 16px", 
                  borderRadius: "4px", 
                  cursor: "pointer",
                  width: mobileView ? "100%" : "auto",
                  fontSize: mobileView ? "16px" : "14px"
                }}
              >
                {loadingSold ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            
            <div style={{ 
              display: "flex", 
              flexDirection: mobileView ? "column" : "row",
              justifyContent: "space-between", 
              alignItems: mobileView ? "flex-start" : "center",
              gap: mobileView ? "10px" : "0",
            }}>
              <div style={{ 
                color: "#666", 
                fontSize: mobileView ? "13px" : "14px",
                marginBottom: mobileView ? "10px" : "0"
              }}>
                Found {filteredSoldItems.length} items • Selected {selectedItems.length} • 
                <span style={{ color: "#28a745", fontWeight: "bold", marginLeft: "10px" }}>
                  {filteredSoldItems.filter(item => item._hasMatch).length} can deduct
                </span>
              </div>
              <div style={{ 
                display: "flex", 
                flexDirection: mobileView ? "column" : "row",
                gap: "10px",
                width: mobileView ? "100%" : "auto"
              }}>
                <button
                  onClick={selectAll}
                  style={{ 
                    background: "#6c757d", 
                    color: "white", 
                    border: "none", 
                    padding: mobileView ? "10px" : "8px 16px", 
                    borderRadius: "4px", 
                    cursor: "pointer",
                    width: mobileView ? "100%" : "auto",
                    fontSize: mobileView ? "14px" : "13px"
                  }}
                >
                  {selectedItems.length === filteredSoldItems.length ? "Deselect All" : "Select All"}
                </button>
                <button
                  onClick={handleLoadSelected}
                  disabled={selectedItems.length === 0}
                  style={{ 
                    background: selectedItems.length > 0 ? "#28a745" : "#ccc", 
                    color: "white", 
                    border: "none", 
                    padding: mobileView ? "10px" : "8px 16px", 
                    borderRadius: "4px", 
                    cursor: selectedItems.length > 0 ? "pointer" : "default",
                    width: mobileView ? "100%" : "auto",
                    fontSize: mobileView ? "14px" : "13px"
                  }}
                >
                  Load Selected ({selectedItems.length})
                </button>
                <button
                  onClick={handleLoadAll}
                  disabled={filteredSoldItems.length === 0}
                  style={{ 
                    background: filteredSoldItems.length > 0 ? "#007bff" : "#ccc", 
                    color: "white", 
                    border: "none", 
                    padding: mobileView ? "10px" : "8px 16px", 
                    borderRadius: "4px", 
                    cursor: filteredSoldItems.length > 0 ? "pointer" : "default",
                    width: mobileView ? "100%" : "auto",
                    fontSize: mobileView ? "14px" : "13px"
                  }}
                >
                  Load All ({filteredSoldItems.length})
                </button>
              </div>
            </div>
          </div>

          {loadingSold ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div style={spinnerStyle}></div>
              <p>Loading Stock Sold items...</p>
            </div>
          ) : filteredSoldItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
              No Stock Sold items found that need deduction.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ 
                width: "100%", 
                borderCollapse: "collapse",
                fontSize: mobileView ? "12px" : "14px"
              }}>
                <thead style={{ background: "#f3f3f3" }}>
                  <tr>
                    <th style={{ width: "40px", padding: mobileView ? "8px 4px" : "8px" }}>
                      <input
                        type="checkbox"
                        checked={selectedItems.length === filteredSoldItems.length && filteredSoldItems.length > 0}
                        onChange={selectAll}
                        disabled={filteredSoldItems.length === 0}
                      />
                    </th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>Item</th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>Brand</th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>Batch</th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>Qty</th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>L/W</th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>Status</th>
                    <th style={{ padding: mobileView ? "8px 4px" : "8px" }}>Action</th>
                   </tr>
                </thead>
                <tbody>
                  {filteredSoldItems.map((item) => (
                    <tr key={item._id} style={{ 
                      background: selectedItems.includes(item._id) ? "#e3f2fd" : "white",
                      borderLeft: item._hasMatch ? "4px solid #28a745" : "1px solid #ddd"
                    }}>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px" }}>
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item._id)}
                          onChange={() => toggleSelectItem(item._id)}
                        />
                      </td>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px" }}>
                        {mobileView ? (
                          <div>
                            <div style={{ fontWeight: "bold" }}>{item["Item Name"]}</div>
                            <div style={{ fontSize: "10px", color: "#666" }}>
                              {item._customer || ""}
                            </div>
                          </div>
                        ) : (
                          item["Item Name"]
                        )}
                      </td>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px" }}>{item["Brand"]}</td>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px", fontWeight: "bold", color: "#007bff" }}>{item["Batch Code"]}</td>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px", fontWeight: "bold" }}>{item["Qty"]}</td>
                      <td style={{ 
                        padding: mobileView ? "8px 4px" : "8px",
                        background: item._hasMatch ? "#d4edda" : "transparent"
                      }}>
                        {mobileView ? (
                          <div>
                            <div>L:{item["Length"]}</div>
                            <div>W:{item["Width"]}</div>
                          </div>
                        ) : (
                          `${item["Length"]}/${item["Width"]}`
                        )}
                      </td>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px" }}>
                        <span style={{
                          background: item._hasMatch ? "#28a745" : "#6c757d",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "12px",
                          fontSize: mobileView ? "10px" : "12px",
                          display: "inline-block",
                          whiteSpace: "nowrap"
                        }}>
                          {item._hasMatch ? "✓" : "No"}
                        </span>
                      </td>
                      <td style={{ padding: mobileView ? "8px 4px" : "8px" }}>
                        {item._hasMatch ? (
                          <button
                            onClick={() => deductFromStock(item)}
                            style={{
                              background: "#ff9800",
                              color: "white",
                              border: "none",
                              padding: mobileView ? "6px 10px" : "6px 12px",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: mobileView ? "11px" : "12px",
                              fontWeight: "bold",
                              width: mobileView ? "100%" : "auto",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {mobileView ? "Deduct" : "Deduct from Stock"}
                          </button>
                        ) : (
                          <span style={{ color: "#999", fontSize: "12px" }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {Object.keys(deductionStatus).length > 0 && (
            <div style={{
              marginTop: "20px",
              padding: mobileView ? "12px" : "15px",
              backgroundColor: "#e8f4fd",
              border: "1px solid #b6d4fe",
              borderRadius: "6px"
            }}>
              <div style={{ fontWeight: "bold", marginBottom: "10px", color: "#0c63e4" }}>
                ⚠️ Pending Deductions ({Object.keys(deductionStatus).length})
              </div>
              <div style={{ fontSize: mobileView ? "12px" : "14px", marginBottom: "10px" }}>
                {mobileView ? "Save to update database." : "Click 'Save All Items' to permanently update database."}
              </div>
              <div style={{ 
                display: "flex", 
                flexWrap: "wrap", 
                gap: mobileView ? "5px" : "10px" 
              }}>
                {Object.entries(deductionStatus).map(([itemId, status]) => (
                  <div key={itemId} style={{
                    background: "white",
                    padding: mobileView ? "6px 8px" : "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #86b7fe",
                    fontSize: mobileView ? "11px" : "13px"
                  }}>
                    {mobileView ? (
                      <span>{status.originalQty}→{status.newQty} (-{status.soldQty})</span>
                    ) : (
                      <><strong>Deducted:</strong> {status.originalQty} → {status.newQty} (-{status.soldQty})</>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // Mobile Card View Component
  // ----------------------------------------------------
  const MobileCardView = () => {
    return (
      <div style={{ marginTop: "16px" }}>
        {currentRows.map((row, idx) => {
          const hasDeduction = Object.values(deductionStatus).some(
            status => status.stockItemId === row._id
          );
          const isExpanded = expandedCard === row._id;
          
          return (
            <div
              key={row._id || idx}
              style={{
                backgroundColor: hasDeduction ? "#f8f9e6" : "white",
                border: hasDeduction ? "2px solid #ff9800" : "1px solid #ddd",
                borderRadius: "8px",
                marginBottom: "12px",
                padding: "12px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}
            >
              {/* Card Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
                paddingBottom: "8px",
                borderBottom: "1px solid #eee"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    backgroundColor: "#f3f3f3",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    fontSize: "12px"
                  }}>
                    #{indexOfFirstRow + idx + 1}
                  </span>
                  <span style={{
                    backgroundColor: hasDeduction ? "#ff9800" : "#007bff",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px"
                  }}>
                    ID: {row["ID"] || "New"}
                  </span>
                </div>
                <button
                  onClick={() => deleteRow(row._id, row)}
                  style={{
                    background: "#e74c3c",
                    color: "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  Delete
                </button>
              </div>

              {/* Main Info */}
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "4px" }}>
                  {row["Item Name"] || "No Item Name"}
                </div>
                <div style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>
                  {row["Brand"] || "No Brand"}
                </div>
                {row["Batch Code"] && (
                  <div style={{ fontSize: "12px", color: "#007bff", fontWeight: "bold", marginBottom: "4px" }}>
                    Batch: {row["Batch Code"]}
                  </div>
                )}
                {row["Brand Code"] && (
                  <div style={{ fontSize: "12px", color: "#888" }}>
                    Code: {row["Brand Code"]}
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px",
                marginBottom: "12px"
              }}>
                <div style={{
                  backgroundColor: "#f5f5f5",
                  padding: "6px",
                  borderRadius: "4px",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "10px", color: "#666" }}>Qty</div>
                  <div style={{ fontWeight: "bold", fontSize: "14px" }}>{row["Qty"] || "0"}</div>
                </div>
                <div style={{
                  backgroundColor: "#f5f5f5",
                  padding: "6px",
                  borderRadius: "4px",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "10px", color: "#666" }}>L×W</div>
                  <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                    {row["Length"] || "0"}×{row["Width"] || "0"}
                  </div>
                </div>
                <div style={{
                  backgroundColor: "#f5f5f5",
                  padding: "6px",
                  borderRadius: "4px",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "10px", color: "#666" }}>Price</div>
                  <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                    ₹{row["Buy Price"] || "0"}
                  </div>
                </div>
              </div>

              {/* Expand/Collapse Button */}
              <button
                onClick={() => setExpandedCard(isExpanded ? null : row._id)}
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #dee2e6",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  marginBottom: isExpanded ? "12px" : "0"
                }}
              >
                {isExpanded ? "▲ Show Less" : "▼ Show All Fields"}
              </button>

              {/* Expanded Fields */}
              {isExpanded && (
                <div style={{
                  marginTop: "12px",
                  borderTop: "1px dashed #dee2e6",
                  paddingTop: "12px"
                }}>
                  {fixedHeaders.filter(h => 
                    !["ID", "Item Name", "Brand", "Qty", "Length", "Width", "Buy Price"].includes(h)
                  ).map(header => (
                    <div key={header} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: "1px solid #f0f0f0"
                    }}>
                      <span style={{ fontSize: "12px", color: "#666" }}>
                        {header === "AutoCalculate Count" ? "Count" : header}:
                      </span>
                      {header === "AutoCalculate Count" ? (
                        <span style={{
                          backgroundColor: "#e8f4fd",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "bold"
                        }}>
                          {row[header] || "0"}
                        </span>
                      ) : (
                        <input
                          value={row[header] ?? ""}
                          onChange={(e) => updateCell(row._id, header, e.target.value)}
                          style={{
                            width: "60%",
                            padding: "4px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            fontSize: "12px"
                          }}
                          placeholder="—"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {hasDeduction && (
                <div style={{
                  marginTop: "8px",
                  padding: "6px",
                  backgroundColor: "#fff3cd",
                  border: "1px solid #ffeeba",
                  borderRadius: "4px",
                  fontSize: "11px",
                  color: "#856404",
                  textAlign: "center"
                }}>
                  ⚠️ Pending deduction - Save to update
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ----------------------------------------------------
  // Render UI
  // ----------------------------------------------------
  return (
    <div style={{ 
      width: "100%", 
      padding: mobileView ? "10px" : "20px", 
      fontFamily: "Segoe UI, Arial",
      maxWidth: "100%",
      overflowX: "hidden"
    }}>
      <Keyframes />

      {/* Issues box */}
      {unmatched.length > 0 && (
        <div
          style={{
            background: "#fff8e1",
            padding: mobileView ? "10px" : "12px",
            marginBottom: "18px",
            borderRadius: "6px",
            border: "1px solid #ffcc80",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: mobileView ? "14px" : "16px", marginBottom: "8px" }}>
            Issues Found ({unmatched.length})
          </div>

          {!mobileView ? (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ minWidth: 180, fontWeight: 600 }}>Item</div>
                <div style={{ minWidth: 120, fontWeight: 600 }}>Brand</div>
                <div style={{ minWidth: 120, fontWeight: 600 }}>Batch</div>
                <div style={{ minWidth: 80, fontWeight: 600 }}>HSN</div>
                <div style={{ minWidth: 80, fontWeight: 600 }}>MRP</div>
                <div style={{ minWidth: 120, fontWeight: 600 }}>Status</div>
              </div>

              <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                {unmatched.map((u, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "4px 0" }}>
                    <div style={{ minWidth: 180, color: u.Status?.includes('Duplicate') ? "#d84315" : "#0288d1" }}>
                      {u.Item || "(No Item)"}
                    </div>
                    <div style={{ minWidth: 120, color: u.Status?.includes('Duplicate') ? "#d84315" : "#0288d1" }}>
                      {u.Brand || "(No Brand)"}
                    </div>
                    <div style={{ minWidth: 120 }}>{u.Batch}</div>
                    <div style={{ minWidth: 80 }}>{u.HSN}</div>
                    <div style={{ minWidth: 80 }}>{u.MRP}</div>
                    <div style={{ 
                      minWidth: 120, 
                      color: u.Status?.includes('Duplicate') ? "#d84315" : "#0288d1",
                      fontWeight: 600 
                    }}>
                      {u.Status}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            // Mobile view for unmatched items
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {unmatched.map((u, i) => (
                <div key={i} style={{
                  padding: "8px",
                  marginBottom: "6px",
                  backgroundColor: "white",
                  borderRadius: "4px",
                  border: "1px solid #ffcc80"
                }}>
                  <div style={{ fontWeight: "bold", fontSize: "13px" }}>{u.Item || "(No Item)"}</div>
                  <div style={{ fontSize: "12px", marginTop: "4px" }}>
                    <span style={{ color: "#666" }}>Brand:</span> {u.Brand || "(No Brand)"}
                  </div>
                  <div style={{ fontSize: "12px" }}>
                    <span style={{ color: "#666" }}>Batch:</span> {u.Batch}
                  </div>
                  <div style={{ 
                    fontSize: "12px", 
                    fontWeight: "bold",
                    color: u.Status?.includes('Duplicate') ? "#d84315" : "#0288d1",
                    marginTop: "4px"
                  }}>
                    Status: {u.Status}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ 
            marginTop: 10, 
            display: 'flex', 
            flexDirection: mobileView ? "column" : "row",
            gap: mobileView ? "8px" : "8px" 
          }}>
            <button
              onClick={handleDownloadUnmatched}
              style={{
                background: "#ff5722",
                color: "#fff",
                border: "none",
                padding: mobileView ? "10px" : "8px 12px",
                borderRadius: 5,
                cursor: "pointer",
                width: mobileView ? "100%" : "auto",
                fontSize: mobileView ? "14px" : "13px"
              }}
            >
              Download Issues
            </button>
            
            <button
              onClick={() => setUnmatched([])}
              style={{
                background: "#78909c",
                color: "#fff",
                border: "none",
                padding: mobileView ? "10px" : "8px 12px",
                borderRadius: 5,
                cursor: "pointer",
                width: mobileView ? "100%" : "auto",
                fontSize: mobileView ? "14px" : "13px"
              }}
            >
              Clear Issues
            </button>
          </div>
        </div>
      )}
      
      {/* Deduction status box */}
      {Object.keys(deductionStatus).length > 0 && (
        <div
          style={{
            background: "#d1ecf1",
            padding: mobileView ? "10px" : "12px",
            marginBottom: "18px",
            borderRadius: "6px",
            border: "1px solid #bee5eb",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: mobileView ? "14px" : "16px", marginBottom: "8px", color: "#0c5460" }}>
            📊 Stock Deductions Pending ({Object.keys(deductionStatus).length})
          </div>
          <div style={{ marginBottom: "10px", color: "#0c5460", fontSize: mobileView ? "12px" : "14px" }}>
            {mobileView ? "Save to update database." : "Click 'Save All Items' to permanently update stock quantities."}
          </div>
          <div style={{ display: 'flex', flexDirection: mobileView ? "column" : "row", gap: mobileView ? "8px" : "8px" }}>
            <button
              onClick={saveToBackend}
              style={{
                background: "green",
                color: "#fff",
                border: "none",
                padding: mobileView ? "10px" : "8px 16px",
                borderRadius: 5,
                cursor: "pointer",
                fontWeight: "bold",
                width: mobileView ? "100%" : "auto",
                fontSize: mobileView ? "14px" : "13px"
              }}
            >
              💾 Save All Items
            </button>
            <button
              onClick={() => {
                setDeductionStatus({});
                fetchSoldItems();
              }}
              style={{
                background: "#6c757d",
                color: "#fff",
                border: "none",
                padding: mobileView ? "10px" : "8px 16px",
                borderRadius: 5,
                cursor: "pointer",
                width: mobileView ? "100%" : "auto",
                fontSize: mobileView ? "14px" : "13px"
              }}
            >
              Clear Deductions
            </button>
          </div>
        </div>
      )}

      {/* Header + actions */}
      <div style={{ 
        display: "flex", 
        flexDirection: mobileView ? "column" : "row",
        justifyContent: "space-between", 
        alignItems: mobileView ? "stretch" : "center", 
        gap: mobileView ? "12px" : "12px", 
        marginBottom: "16px" 
      }}>
        <h2 style={{ margin: 0, fontSize: mobileView ? "20px" : "24px" }}>Stock Bulk Upload</h2>

        <div style={{ 
          display: "flex", 
          flexDirection: mobileView ? "column" : "row",
          gap: mobileView ? "8px" : "8px",
          alignItems: mobileView ? "stretch" : "center",
          width: mobileView ? "100%" : "auto"
        }}>
          <button
            onClick={handleAddRows}
            style={{ 
              background: "#009688", 
              color: "#fff", 
              padding: mobileView ? "10px" : "8px 12px", 
              borderRadius: 6, 
              border: "none", 
              cursor: "pointer",
              fontSize: mobileView ? "14px" : "13px",
              width: mobileView ? "100%" : "auto"
            }}
            disabled={loadingStock || saving}
            title="Add empty rows"
          >
            + Add Row
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              background: "#1e73e8", 
              color: "#fff", 
              padding: mobileView ? "10px" : "8px 12px", 
              borderRadius: 6, 
              border: "none", 
              cursor: "pointer",
              fontSize: mobileView ? "14px" : "13px",
              width: mobileView ? "100%" : "auto"
            }}
            disabled={loadingStock || saving}
          >
            Bulk Upload
            {loadingStock && <span style={spinnerStyle} />}
          </button>

          <button
            onClick={() => setShowGrnModal(true)}
            style={{ 
              background: "#ff9800", 
              color: "#fff", 
              padding: mobileView ? "10px" : "8px 12px", 
              borderRadius: 6, 
              border: "none", 
              cursor: "pointer",
              fontSize: mobileView ? "14px" : "13px",
              width: mobileView ? "100%" : "auto"
            }}
            disabled={loadingGrn}
          >
            {mobileView ? "GRN" : "Import from GRN"}
            {loadingGrn && <span style={spinnerStyle} />}
          </button>

          <button
            onClick={() => {
              setShowSoldModal(true);
              fetchSoldItems();
            }}
            style={{ 
              background: "#9c27b0", 
              color: "#fff", 
              padding: mobileView ? "10px" : "8px 12px", 
              borderRadius: 6, 
              border: "none", 
              cursor: "pointer",
              fontSize: mobileView ? "14px" : "13px",
              width: mobileView ? "100%" : "auto",
              position: "relative"
            }}
            disabled={loadingSold}
          >
            {mobileView ? "Sold" : "Import from Sold"}
            {loadingSold && <span style={spinnerStyle} />}
            {Object.keys(deductionStatus).length > 0 && (
              <span style={{
                background: "#dc3545",
                color: "white",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: "bold",
                marginLeft: "5px"
              }}>
                {Object.keys(deductionStatus).length}
              </span>
            )}
          </button>

          <button
            onClick={saveToBackend}
            style={{ 
              background: Object.keys(deductionStatus).length > 0 ? "#28a745" : "green", 
              color: "#fff", 
              padding: mobileView ? "10px" : "8px 16px", 
              borderRadius: 6, 
              border: "none", 
              cursor: "pointer",
              fontWeight: Object.keys(deductionStatus).length > 0 ? "bold" : "normal",
              fontSize: mobileView ? "14px" : "13px",
              width: mobileView ? "100%" : "auto"
            }}
            disabled={saving}
          >
            {saving ? "Processing..." : mobileView ? "Save" : Object.keys(deductionStatus).length > 0 ? `Save (${Object.keys(deductionStatus).length})` : "Save All"}
            {saving && <span style={spinnerStyle} />}
          </button>

          <button
            onClick={exportToExcel}
            style={{ 
              background: "#673ab7", 
              color: "#fff", 
              padding: mobileView ? "10px" : "8px 12px", 
              borderRadius: 6, 
              border: "none", 
              cursor: "pointer",
              fontSize: mobileView ? "14px" : "13px",
              width: mobileView ? "100%" : "auto"
            }}
            disabled={rows.length === 0 || saving}
          >
            {mobileView ? "Export" : "Export Excel"}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ 
          display: "flex", 
          flexDirection: mobileView ? "column" : "row",
          alignItems: mobileView ? "stretch" : "center", 
          gap: mobileView ? "8px" : "8px",
          backgroundColor: "#f8f9fa",
          padding: mobileView ? "12px" : "12px 16px",
          borderRadius: "6px",
          border: "1px solid #dee2e6"
        }}>
          {!mobileView && <div style={{ fontWeight: 600, minWidth: 100 }}>Search:</div>}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={mobileView ? "Search items..." : "Search in all columns..."}
            style={{
              flex: 1,
              padding: mobileView ? "10px" : "8px 12px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontSize: mobileView ? "16px" : "14px"
            }}
          />
          <div style={{ 
            color: "#6c757d", 
            fontSize: mobileView ? "13px" : "14px",
            textAlign: mobileView ? "left" : "right",
            padding: mobileView ? "0 4px" : "0"
          }}>
            {searchTerm ? `Found: ${filteredRows.length}` : `Total: ${rows.length}`}
          </div>
          {searchTerm && (
            <button
              onClick={() => handleSearch("")}
              style={{
                background: "#6c757d",
                color: "#fff",
                border: "none",
                padding: mobileView ? "10px" : "8px 12px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: mobileView ? "14px" : "14px",
                width: mobileView ? "100%" : "auto"
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFile} />

      {/* Status messages */}
      <div style={{ marginTop: "12px" }}>
        {loadingStock && (
          <div style={{ color: "#333", marginBottom: 6, fontSize: mobileView ? "14px" : "16px" }}>
            Loading stock...
            <span style={spinnerStyle} />
          </div>
        )}
        {error && (
          <div style={{ color: "red", fontWeight: 700, marginBottom: 6, fontSize: mobileView ? "14px" : "16px" }}>{error}</div>
        )}
        {success && (
          <div style={{ color: "green", fontWeight: 700, marginBottom: 6, fontSize: mobileView ? "14px" : "16px" }}>{success}</div>
        )}
      </div>

      {/* Pagination info and controls - TOP */}
      {displayRows.length > 0 && (
        <div style={{ 
          display: "flex", 
          flexDirection: mobileView ? "column" : "row",
          justifyContent: "space-between", 
          alignItems: mobileView ? "flex-start" : "center", 
          gap: mobileView ? "12px" : "0",
          margin: "16px 0", 
          padding: mobileView ? "12px" : "12px 16px",
          backgroundColor: "#f8f9fa",
          borderRadius: "6px",
          border: "1px solid #dee2e6"
        }}>
          <div style={{ fontWeight: 600, fontSize: mobileView ? "13px" : "14px" }}>
            {mobileView ? (
              <>Page {currentPage} of {totalPages} ({displayRows.length} items)</>
            ) : (
              <>Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, displayRows.length)} of {displayRows.length} entries</>
            )}
            {searchTerm && <span style={{ color: "#007bff", marginLeft: 8 }}>(Filtered)</span>}
            {Object.keys(deductionStatus).length > 0 && (
              <span style={{ color: "#28a745", marginLeft: 8 }}>• {Object.keys(deductionStatus).length} pending</span>
            )}
          </div>
          
          {!mobileView && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button onClick={handleFirstPage} disabled={currentPage === 1} style={pageButtonStyle(currentPage === 1)}>«</button>
              <button onClick={handlePrevPage} disabled={currentPage === 1} style={pageButtonStyle(currentPage === 1)}>‹</button>
              {renderPageNumbers().map((page, index) => (
                page === "..." ? (
                  <span key={`ellipsis-${index}`} style={{ padding: "0 8px" }}>...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    style={{
                      ...pageButtonStyle(false),
                      background: currentPage === page ? "#007bff" : "#fff",
                      color: currentPage === page ? "#fff" : "#333",
                      fontWeight: currentPage === page ? "bold" : "normal"
                    }}
                  >
                    {page}
                  </button>
                )
              ))}
              <button onClick={handleNextPage} disabled={currentPage === totalPages} style={pageButtonStyle(currentPage === totalPages)}>›</button>
              <button onClick={handleLastPage} disabled={currentPage === totalPages} style={pageButtonStyle(currentPage === totalPages)}>»</button>
            </div>
          )}
        </div>
      )}

      {/* Table or Mobile Card View */}
      {mobileView ? (
        <MobileCardView />
      ) : (
        <div style={{ overflowX: "auto", marginTop: displayRows.length > 0 ? 0 : 16 }}>
          <table border="1" cellPadding="6" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f3f3f3", position: "sticky", top: 0 }}>
              <tr>
                <th style={{ minWidth: 36 }}>#</th>
                {fixedHeaders.map((h) => (
                  <th key={h} style={{ minWidth: h === "Batch Code" ? 120 : 100 }}>
                    {h === "AutoCalculate Count" ? "Count" : h}
                  </th>
                ))}
                <th style={{ minWidth: 120 }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {currentRows.length > 0 ? (
                currentRows.map((row, idx) => {
                  const hasDeduction = Object.values(deductionStatus).some(
                    status => status.stockItemId === row._id
                  );
                  
                  return (
                    <tr key={row._id || idx} style={{
                      background: hasDeduction ? "#f8f9e6" : "transparent",
                      borderLeft: hasDeduction ? "4px solid #ff9800" : "1px solid #ddd"
                    }}>
                      <td style={{ width: 36 }}>{indexOfFirstRow + idx + 1}</td>

                      {fixedHeaders.map((h) => (
                        <td key={h}>
                          {h === "AutoCalculate Count" ? (
                            <div style={{ 
                              width: "100%", 
                              boxSizing: "border-box", 
                              padding: 6,
                              backgroundColor: "#f5f5f5",
                              border: "1px solid #ddd",
                              borderRadius: "3px",
                              textAlign: "center",
                              fontWeight: "bold"
                            }}>
                              {row[h] || "0"}
                            </div>
                          ) : h === "Batch Code" ? (
                            <input
                              value={row[h] ?? ""}
                              onChange={(e) => updateCell(row._id, h, e.target.value)}
                              style={{ 
                                width: "100%", 
                                boxSizing: "border-box", 
                                padding: 6,
                                border: "1px solid #007bff",
                                borderRadius: "3px",
                                backgroundColor: "#f0f8ff",
                                fontWeight: "bold"
                              }}
                              placeholder="Batch Code"
                              title="Different batch codes create new unique items"
                            />
                          ) : (
                            <input
                              value={row[h] ?? ""}
                              onChange={(e) => updateCell(row._id, h, e.target.value)}
                              style={{ 
                                width: "100%", 
                                boxSizing: "border-box", 
                                padding: 6,
                                border: "1px solid #ddd",
                                borderRadius: "3px"
                              }}
                              placeholder={h === "ID" ? "Auto" : ""}
                              readOnly={h === "ID" && typeof row[h] === "string" && row[h].startsWith("ID")}
                            />
                          )}
                        </td>
                      ))}

                      <td>
                        <button
                          onClick={() => deleteRow(row._id, row)}
                          style={{ 
                            background: "#e74c3c", 
                            color: "#fff", 
                            border: "none", 
                            padding: "6px 10px", 
                            borderRadius: 6, 
                            cursor: "pointer" 
                          }}
                        >
                          Delete
                        </button>
                        {hasDeduction && (
                          <div style={{
                            fontSize: "11px",
                            color: "#ff9800",
                            marginTop: "4px",
                            fontWeight: "bold"
                          }}>
                            ⚠️ Pending
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={fixedHeaders.length + 2} style={{ textAlign: "center", padding: 12 }}>
                    {loadingStock 
                      ? "Loading stock..." 
                      : searchTerm 
                      ? `No results found for "${searchTerm}"` 
                      : "No data uploaded."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Pagination */}
      {mobileView && displayRows.length > 0 && totalPages > 1 && (
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          marginTop: "20px", 
          gap: "8px",
          flexWrap: "wrap"
        }}>
          <button onClick={handleFirstPage} disabled={currentPage === 1} style={mobilePageButtonStyle(currentPage === 1)}>«</button>
          <button onClick={handlePrevPage} disabled={currentPage === 1} style={mobilePageButtonStyle(currentPage === 1)}>‹</button>
          
          {renderPageNumbers().map((page, index) => (
            page === "..." ? (
              <span key={`ellipsis-${index}`} style={{ padding: "0 4px", fontSize: "14px" }}>...</span>
            ) : (
              <button
                key={page}
                onClick={() => goToPage(page)}
                style={{
                  ...mobilePageButtonStyle(false),
                  background: currentPage === page ? "#007bff" : "#f8f9fa",
                  color: currentPage === page ? "#fff" : "#333",
                  fontWeight: currentPage === page ? "bold" : "normal",
                  minWidth: "36px"
                }}
              >
                {page}
              </button>
            )
          ))}
          
          <button onClick={handleNextPage} disabled={currentPage === totalPages} style={mobilePageButtonStyle(currentPage === totalPages)}>›</button>
          <button onClick={handleLastPage} disabled={currentPage === totalPages} style={mobilePageButtonStyle(currentPage === totalPages)}>»</button>
        </div>
      )}

      {/* GRN Modal */}
      {showGrnModal && <GrnModal />}
      
      {/* Stock Sold Modal */}
      {showSoldModal && <SoldModal />}
    </div>
  );
}

// Helper styles
const pageButtonStyle = (disabled) => ({
  padding: "6px 12px",
  border: "1px solid #ddd",
  background: disabled ? "#f5f5f5" : "#fff",
  color: disabled ? "#999" : "#333",
  cursor: disabled ? "default" : "pointer",
  borderRadius: "4px"
});

const mobilePageButtonStyle = (disabled) => ({
  padding: "8px 12px",
  border: "1px solid #ddd",
  background: disabled ? "#f5f5f5" : "#fff",
  color: disabled ? "#999" : "#333",
  cursor: disabled ? "default" : "pointer",
  borderRadius: "4px",
  fontSize: "14px",
  minWidth: "40px"
});