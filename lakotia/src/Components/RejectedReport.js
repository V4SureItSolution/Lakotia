// RejectedItemsPage.js
import React, { useState, useEffect } from "react";
import { API_BASE } from "../config";

import axios from "axios";
import { toast } from "react-toastify";
import { 
  Modal, 
  Button, 
  Table, 
  Spinner, 
  Alert, 
  Badge, 
  Pagination, 
  Card, 
  Row, 
  Col,
  Container,
  InputGroup,
  FormControl,
  Form,
  Dropdown
} from "react-bootstrap";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Import export libraries
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function RejectedItemsPage() {
  // Issuer static details
  const issuer = {
    name: "Lakhotia",
    address: "64/3A Sidco Industrial Estate, Ambatur, Chennai",
    phone: "7845663338",
    email: "vivek@lakhotia.net",
    gstin: "33AABFL9981E1Z7",
    stateCode: "33-Tamil Nadu",
    placeOfSupply: "33-Tamil Nadu",
  };

  // Helper function to safely format numbers
  const safeToFixed = (value, decimals = 2) => {
    if (value === null || value === undefined || value === "") return "0.00";
    const num = parseFloat(value);
    return isNaN(num) ? "0.00" : num.toFixed(decimals);
  };

  // State variables
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRejectedItem, setSelectedRejectedItem] = useState(null);
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  // Rejected items state
  const [rejectedItems, setRejectedItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [allRejectedItems, setAllRejectedItems] = useState([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Search filters
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  // Statistics
  const [rejectedStats, setRejectedStats] = useState({
    total: 0,
    byMonth: [],
    byCompany: []
  });

  // Stock cache for buy prices
  const [stockCache, setStockCache] = useState({});

  // Reason for rejection modal
  const [showRejectionReasonModal, setShowRejectionReasonModal] = useState(false);
  const [rejectionReasonData, setRejectionReasonData] = useState({
    item_id: "",
    item_name: "",
    quotation_number: "",
    brand_code: "",
    customer_description: "",
    buy_price: 0,
    rejection_reason: "",
    rejected_by: "",
    rejected_date: ""
  });

  // Helper functions for extracting data from description
  const extractBrandCode = (description) => {
    if (!description) return "";
    try {
      if (description.includes('[BRAND_CODE:')) {
        const match = description.match(/\[BRAND_CODE:(.*?)\]/);
        return match ? match[1] : "";
      }
    } catch (e) {
      console.error("Error extracting brand code:", e);
    }
    return "";
  };

  const extractCustomerDescription = (description) => {
    if (!description) return "";
    try {
      if (description.includes('[CUSTOMER_DESC:')) {
        const match = description.match(/\[CUSTOMER_DESC:(.*?)\]/);
        return match ? match[1] : "";
      }
    } catch (e) {
      console.error("Error extracting customer description:", e);
    }
    return "";
  };

  const cleanDescription = (description) => {
    if (!description) return "";
    try {
      return description
        .replace(/\[BRAND_CODE:.*?\]/g, '')
        .replace(/\[CUSTOMER_DESC:.*?\]/g, '')
        .trim();
    } catch (e) {
      console.error("Error cleaning description:", e);
      return description;
    }
  };

  // Fetch bulk buy prices
  const fetchBulkBuyPrices = async (brandCodes) => {
    if (!brandCodes || brandCodes.length === 0) return {};
    
    try {
      const response = await axios.post(`${API_BASE}/stock/bulk-buy-prices`, {
        brand_codes: brandCodes
      });
      
      if (response.data.success) {
        const priceMap = {};
        response.data.data.forEach(item => {
          priceMap[item.brand_code] = parseFloat(item.buy_price) || 0;
        });
        
        setStockCache(prev => ({ ...prev, ...priceMap }));
        
        return priceMap;
      }
    } catch (err) {
      console.error("Error fetching bulk buy prices:", err);
    }
    return {};
  };

  // Fetch rejected items from backend
  useEffect(() => {
    fetchRejectedItems();
    fetchRejectedStats();
  }, [currentPage, searchTerm, dateFrom, dateTo]);

  // Fetch rejected items with pagination - FIXED API ENDPOINT
  const fetchRejectedItems = async () => {
    setLoadingItems(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('per_page', itemsPerPage);
      params.append('status', 'rejected'); // Changed from 'completed' to 'rejected'
      
      if (searchTerm.trim()) {
        params.append('q', searchTerm.trim());
      }
      
      if (dateFrom) {
        params.append('date_from', dateFrom);
      }
      
      if (dateTo) {
        params.append('date_to', dateTo);
      }
      
      console.log('Fetching rejected items with params:', params.toString());
      
      // Updated API endpoint - removed /api prefix as it might be handled by config
      const response = await axios.get(`${API_BASE}/quotations/rejected-items?${params.toString()}`);
      
      console.log('Response:', response.data);
      
      if (response.data.success) {
        const fetchedItems = response.data.data || [];
        const pagination = response.data.pagination || {};
        
        // Extract brand codes for buy price lookup
        const allBrandCodes = [];
        fetchedItems.forEach(item => {
          const brandCode = extractBrandCode(item.description || "");
          if (brandCode) {
            allBrandCodes.push(brandCode);
          }
        });
        
        const buyPriceMap = await fetchBulkBuyPrices([...new Set(allBrandCodes)]);
        
        const transformedItems = fetchedItems.map(item => {
          const brandCode = extractBrandCode(item.description || "");
          const customerDescription = extractCustomerDescription(item.description || "");
          const cleanDesc = cleanDescription(item.description || "");
          
          const buyPrice = brandCode ? (buyPriceMap[brandCode] || 0) : 0;
          
          return {
            ...item,
            brand_code: brandCode || "",
            customer_description: customerDescription || "",
            description: cleanDesc,
            buy_price: parseFloat(buyPrice) || 0,
            count: parseInt(item.count) || 1,
            packing_charges: parseFloat(item.packing_charges) || 0,
            other_charges: parseFloat(item.other_charges) || 0,
            price_per_unit: parseFloat(item.price_per_unit) || 0,
            amount_after_discount: parseFloat(item.amount_after_discount) || 0,
            rejection_reason: item.rejection_reason || "Not specified",
            rejected_by: item.rejected_by || "Unknown",
            rejected_date: item.rejected_date || item.updated_at || ""
          };
        });
        
        setRejectedItems(transformedItems);
        setTotalItems(pagination.total || transformedItems.length);
        setTotalPages(pagination.pages || Math.ceil((pagination.total || transformedItems.length) / itemsPerPage) || 1);
      } else {
        throw new Error(response.data.message || "API response unsuccessful");
      }
    } catch (err) {
      console.error("Error loading rejected items:", err);
      // Try alternative endpoint if first one fails
      try {
        console.log('Trying alternative endpoint...');
        const response = await axios.get(`${API_BASE}/quotations/items/rejected`, {
          params: {
            page: currentPage,
            per_page: itemsPerPage,
            status: 'rejected'
          }
        });
        
        if (response.data.success) {
          const fetchedItems = response.data.data || [];
          const pagination = response.data.pagination || {};
          
          const allBrandCodes = [];
          fetchedItems.forEach(item => {
            const brandCode = extractBrandCode(item.description || "");
            if (brandCode) {
              allBrandCodes.push(brandCode);
            }
          });
          
          const buyPriceMap = await fetchBulkBuyPrices([...new Set(allBrandCodes)]);
          
          const transformedItems = fetchedItems.map(item => {
            const brandCode = extractBrandCode(item.description || "");
            const customerDescription = extractCustomerDescription(item.description || "");
            const cleanDesc = cleanDescription(item.description || "");
            
            const buyPrice = brandCode ? (buyPriceMap[brandCode] || 0) : 0;
            
            return {
              ...item,
              brand_code: brandCode || "",
              customer_description: customerDescription || "",
              description: cleanDesc,
              buy_price: parseFloat(buyPrice) || 0,
              count: parseInt(item.count) || 1,
              packing_charges: parseFloat(item.packing_charges) || 0,
              other_charges: parseFloat(item.other_charges) || 0,
              price_per_unit: parseFloat(item.price_per_unit) || 0,
              amount_after_discount: parseFloat(item.amount_after_discount) || 0,
              rejection_reason: item.rejection_reason || "Not specified",
              rejected_by: item.rejected_by || "Unknown",
              rejected_date: item.rejected_date || item.updated_at || ""
            };
          });
          
          setRejectedItems(transformedItems);
          setTotalItems(pagination.total || transformedItems.length);
          setTotalPages(pagination.pages || Math.ceil((pagination.total || transformedItems.length) / itemsPerPage) || 1);
        } else {
          throw new Error(response.data.message || "Alternative API also failed");
        }
      } catch (altErr) {
        console.error("Both endpoints failed:", altErr);
        setRejectedItems([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } finally {
      setLoadingItems(false);
    }
  };

  // Fetch all rejected items for export
  const fetchAllRejectedItemsForExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('status', 'rejected');
      params.append('per_page', 10000);
      
      if (searchTerm.trim()) {
        params.append('q', searchTerm.trim());
      }
      
      if (dateFrom) {
        params.append('date_from', dateFrom);
      }
      
      if (dateTo) {
        params.append('date_to', dateTo);
      }
      
      const response = await axios.get(`${API_BASE}/quotations/rejected-items?${params.toString()}`);
      
      if (response.data.success) {
        const fetchedItems = response.data.data || [];
        
        const allBrandCodes = [];
        fetchedItems.forEach(item => {
          const brandCode = extractBrandCode(item.description || "");
          if (brandCode) {
            allBrandCodes.push(brandCode);
          }
        });
        
        const buyPriceMap = await fetchBulkBuyPrices([...new Set(allBrandCodes)]);
        
        const transformedItems = fetchedItems.map(item => {
          const brandCode = extractBrandCode(item.description || "");
          const customerDescription = extractCustomerDescription(item.description || "");
          const cleanDesc = cleanDescription(item.description || "");
          
          const buyPrice = brandCode ? (buyPriceMap[brandCode] || 0) : 0;
          
          return {
            ...item,
            brand_code: brandCode || "",
            customer_description: customerDescription || "",
            description: cleanDesc,
            buy_price: parseFloat(buyPrice) || 0,
            count: parseInt(item.count) || 1,
            packing_charges: parseFloat(item.packing_charges) || 0,
            other_charges: parseFloat(item.other_charges) || 0,
            price_per_unit: parseFloat(item.price_per_unit) || 0,
            amount_after_discount: parseFloat(item.amount_after_discount) || 0,
            rejection_reason: item.rejection_reason || "Not specified",
            rejected_by: item.rejected_by || "Unknown",
            rejected_date: item.rejected_date || item.updated_at || ""
          };
        });
        
        setAllRejectedItems(transformedItems);
        return transformedItems;
      }
    } catch (err) {
      console.error("Error loading rejected items for export:", err);
      return [];
    }
  };

  // Fetch rejected items statistics
  const fetchRejectedStats = async () => {
    try {
      // Try multiple endpoints for stats
      let response;
      try {
        response = await axios.get(`${API_BASE}/quotations/rejected-items/stats`);
      } catch (err) {
        console.log('Stats endpoint 1 failed, trying alternative...');
        response = await axios.get(`${API_BASE}/quotations/items/rejected/stats`);
      }
      
      if (response.data.success) {
        setRejectedStats(response.data.data || {
          total: 0,
          byMonth: [],
          byCompany: []
        });
      }
    } catch (err) {
      console.error("Error loading rejected stats:", err);
      // Set default stats
      setRejectedStats({
        total: 0,
        byMonth: [],
        byCompany: []
      });
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Export to Excel
  const exportToExcel = async () => {
    setExportLoading(true);
    try {
      const items = await fetchAllRejectedItemsForExport();
      
      const excelData = items.map((item, index) => ({
        'S.No': index + 1,
        'Item Name': item.item_name || '',
        'Brand Code': item.brand_code || '',
        'Customer Description': item.customer_description || '',
        'Description': item.description || '',
        'Buy Price': item.buy_price || 0,
        'Quotation No': item.quotation_number || item.quote_number || '',
        'Company': item.company_name || item.billTo || '',
        'Contact Person': item.contact_person || '',
        'Quantity': item.quantity || 1,
        'Unit': item.unit || 'pcs',
        'Price per Unit': item.price_per_unit || 0,
        'Total Amount': item.amount_after_discount || 0,
        'Margin': item.buy_price > 0 ? 
          (((item.amount_after_discount - item.buy_price) / item.buy_price * 100).toFixed(2) + '%') : '0%',
        'Supplier Part No': item.supplier_part_no || '',
        'HSN Code': item.hsn_sac || '',
        'GST Rate': (item.tax_rate || 18) + '%',
        'Date': item.date || '',
        'Rejection Reason': item.rejection_reason || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rejected Items");
      
      const fileName = `Rejected_Items_${dateFrom || 'all'}_to_${dateTo || 'all'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      alert(`Exported ${items.length} items to Excel`);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      alert("Failed to export to Excel");
    } finally {
      setExportLoading(false);
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    setExportLoading(true);
    try {
      const items = await fetchAllRejectedItemsForExport();
      
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Rejected Items Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 14, 22);
      doc.text(`Date Range: ${dateFrom || 'All'} to ${dateTo || 'All'}`, 14, 28);
      doc.text(`Total Items: ${items.length}`, 14, 34);
      
      const headers = [
        ['S.No', 'Item Name', 'Brand Code', 'Quotation No', 'Company', 'Quantity', 'Amount', 'Buy Price', 'Margin']
      ];
      
      const tableData = items.map((item, index) => [
        index + 1,
        item.item_name?.substring(0, 20) || '',
        item.brand_code || '',
        item.quotation_number?.substring(0, 10) || '',
        item.company_name?.substring(0, 15) || '',
        `${item.quantity || 1} ${item.unit || 'pcs'}`,
        `₹${safeToFixed(item.amount_after_discount)}`,
        `₹${safeToFixed(item.buy_price)}`,
        item.buy_price > 0 ? 
          `${((item.amount_after_discount - item.buy_price) / item.buy_price * 100).toFixed(2)}%` : '0%'
      ]);
      
      doc.autoTable({
        head: [headers[0]],
        body: tableData,
        startY: 40,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [255, 193, 7] }
      });
      
      const finalY = doc.lastAutoTable.finalY || 40;
      doc.setFontSize(10);
      doc.text(`Summary:`, 14, finalY + 10);
      doc.text(`Total Items: ${items.length}`, 14, finalY + 16);
      doc.text(`Total Amount: ₹${items.reduce((sum, item) => sum + (item.amount_after_discount || 0), 0).toFixed(2)}`, 14, finalY + 22);
      doc.text(`Total Buy Price: ₹${items.reduce((sum, item) => sum + (item.buy_price || 0), 0).toFixed(2)}`, 14, finalY + 28);
      
      const fileName = `Rejected_Items_${dateFrom || 'all'}_to_${dateTo || 'all'}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      alert(`Exported ${items.length} items to PDF`);
    } catch (err) {
      console.error("Error exporting to PDF:", err);
      alert("Failed to export to PDF");
    } finally {
      setExportLoading(false);
    }
  };

  // View rejected item details - FIXED API CALL
  const viewRejectedItem = async (item) => {
    try {
      // First try to get the quotation
      let quotation = null;
      let quotationId = item.quotation_id || item.quote_id;
      
      if (!quotationId) {
        // Try to find quotation by number
        const quoteNumber = item.quotation_number || item.quote_number;
        if (quoteNumber) {
          try {
            const searchResponse = await axios.get(`${API_BASE}/quotations/search`, {
              params: { q: quoteNumber }
            });
            if (searchResponse.data.success && searchResponse.data.data.length > 0) {
              quotation = searchResponse.data.data[0];
              quotationId = quotation.id;
            }
          } catch (e) {
            console.log('Search by quote number failed:', e);
          }
        }
      }
      
      if (quotationId) {
        try {
          const response = await axios.get(`${API_BASE}/quotations/${quotationId}`);
          if (response.data.success) {
            quotation = response.data.data;
          }
        } catch (e) {
          console.log('Fetch quotation by ID failed:', e);
        }
      }
      
      // If we have a quotation, find the specific item
      if (quotation) {
        const specificItem = (quotation.items || []).find(i => i.id === item.id || i.item_name === item.item_name);
        
        if (specificItem) {
          const brandCode = extractBrandCode(specificItem.description || "");
          const customerDescription = extractCustomerDescription(specificItem.description || "");
          const cleanDesc = cleanDescription(specificItem.description || "");
          
          let buyPrice = 0;
          if (brandCode) {
            if (stockCache[brandCode] !== undefined) {
              buyPrice = stockCache[brandCode];
            } else {
              const priceMap = await fetchBulkBuyPrices([brandCode]);
              buyPrice = priceMap[brandCode] || 0;
            }
          }
          
          const transformedItem = {
            ...specificItem,
            brand_code: brandCode || "",
            customer_description: customerDescription || "",
            description: cleanDesc,
            price_per_unit: parseFloat(specificItem.price_per_unit) || 0,
            amount_after_discount: parseFloat(specificItem.amount_after_discount) || 0,
            buy_price: buyPrice,
            rejection_reason: specificItem.rejection_reason || item.rejection_reason || "Not specified",
            rejected_by: specificItem.rejected_by || item.rejected_by || "Unknown",
            rejected_date: specificItem.rejected_date || specificItem.updated_at || item.rejected_date || ""
          };
          
          setSelectedRejectedItem(transformedItem);
          setSelectedQuotation(quotation);
          setShowViewModal(true);
          return;
        }
      }
      
      // If we couldn't get the full quotation, use the item data we have
      const brandCode = extractBrandCode(item.description || "");
      const customerDescription = extractCustomerDescription(item.description || "");
      const cleanDesc = cleanDescription(item.description || "");
      
      let buyPrice = 0;
      if (brandCode) {
        if (stockCache[brandCode] !== undefined) {
          buyPrice = stockCache[brandCode];
        } else {
          const priceMap = await fetchBulkBuyPrices([brandCode]);
          buyPrice = priceMap[brandCode] || 0;
        }
      }
      
      const transformedItem = {
        ...item,
        brand_code: brandCode || "",
        customer_description: customerDescription || "",
        description: cleanDesc,
        buy_price: buyPrice,
        rejection_reason: item.rejection_reason || "Not specified",
        rejected_by: item.rejected_by || "Unknown",
        rejected_date: item.rejected_date || item.updated_at || ""
      };
      
      // Create a minimal quotation object
      const minimalQuotation = {
        quote_number: item.quotation_number || item.quote_number || "N/A",
        date: item.date || new Date().toISOString().split('T')[0],
        company_name: item.company_name || item.billTo || "N/A",
        contact_person: item.contact_person || "N/A"
      };
      
      setSelectedRejectedItem(transformedItem);
      setSelectedQuotation(minimalQuotation);
      setShowViewModal(true);
      
    } catch (err) {
      console.error("Error fetching item details:", err);
      alert("Failed to load item details");
    }
  };

  // View rejection reason
  const viewRejectionReason = (item) => {
    setRejectionReasonData({
      item_id: item.id,
      item_name: item.item_name,
      quotation_number: item.quotation_number || item.quote_number || "N/A",
      brand_code: item.brand_code || "N/A",
      customer_description: item.customer_description || "N/A",
      buy_price: item.buy_price || 0,
      rejection_reason: item.rejection_reason || "Not specified",
      rejected_by: item.rejected_by || "Unknown",
      rejected_date: item.rejected_date || "Unknown date"
    });
    setShowRejectionReasonModal(true);
  };

  // Update item status - FIXED API CALL
  const updateItemStatus = async (itemId, newStatus) => {
    if (!window.confirm(`Change item status to "${newStatus}"?`)) {
      return;
    }
    
    try {
      const response = await axios.put(
        `${API_BASE}/quotations/items/${itemId}/status`,
        {
          status: newStatus,
          updated_by: localStorage.getItem("username") || "Admin",
          rejection_reason: newStatus === "rejected" ? "Rejected by admin" : null
        }
      );
      
      if (response.data.success) {
        toast.success(`Item status updated to "${newStatus}"`);
        await fetchRejectedItems();
        
        if (selectedRejectedItem && selectedRejectedItem.id === itemId) {
          setShowViewModal(false);
          setSelectedRejectedItem(null);
        }
      } else {
        throw new Error(response.data.message || "Failed to update item status");
      }
    } catch (err) {
      console.error("Error updating item status:", err);
      const errMsg = err.response?.data?.message || err.message || "Failed to update item status";
      toast.error(errMsg);
    }
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

  // Print rejected item details
  const printRejectedItem = (item, quotation) => {
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rejected Item Report - ${item.item_name}</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
          .report-header { border-bottom: 2px solid #dc3545; padding-bottom: 15px; margin-bottom: 20px; }
          .rejected-badge { background-color: #dc3545; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.9em; }
          .data-row { border-bottom: 1px solid #eee; padding: 8px 0; }
          .data-label { font-weight: 600; color: #495057; }
          .data-value { color: #212529; }
          .brand-code { background-color: #e7f1ff; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
          h1 { font-size: 24px; }
          h2 { font-size: 20px; }
          h5 { font-size: 14px; }
          p { font-size: 12px; margin-bottom: 3px; }
          .container { max-width: 100%; }
        </style>
      </head>
      <body>
        <div class="container mt-3">
          <div class="report-header">
            <div class="row">
              <div class="col-8">
                <h1 class="mb-1">${issuer.name}</h1>
                <p class="mb-1">${issuer.address}</p>
                <p class="mb-1">Phone: ${issuer.phone} | Email: ${issuer.email}</p>
              </div>
              <div class="col-4 text-end">
                <span class="rejected-badge">REJECTED ITEM REPORT</span>
                <p class="mb-1 mt-2"><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
          
          <div class="row mb-4">
            <div class="col-6">
              <h5>Quotation Details:</h5>
              <div class="data-row">
                <span class="data-label">Quotation No:</span>
                <span class="data-value ms-2">${quotation.quote_number || quotation.quoteNo || quotation.quotation_number || "N/A"}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Date:</span>
                <span class="data-value ms-2">${quotation.date || quotation.date || "N/A"}</span>
              </div>
              <div class="data-row">
                <span class="data-label">Company:</span>
                <span class="data-value ms-2">${quotation.company_name || quotation.billTo || "N/A"}</span>
              </div>
            </div>
          </div>
          
          <div class="card border-danger mb-4">
            <div class="card-header bg-danger text-white">
              <h5 class="mb-0">Item Details</h5>
            </div>
            <div class="card-body">
              <div class="row mb-3">
                <div class="col-12">
                  <div class="data-row">
                    <span class="data-label">Brand Code:</span>
                    <span class="brand-code ms-2">${item.brand_code || "N/A"}</span>
                  </div>
                </div>
              </div>
              
              <div class="row mb-3">
                <div class="col-12">
                  <div class="data-row">
                    <span class="data-label">Customer Description:</span>
                    <span class="data-value ms-2">${item.customer_description || "N/A"}</span>
                  </div>
                </div>
              </div>
              
              <div class="row mb-3">
                <div class="col-12">
                  <div class="data-row">
                    <span class="data-label">Buy Price:</span>
                    <span class="data-value ms-2 text-success">₹${safeToFixed(item.buy_price)}</span>
                  </div>
                </div>
              </div>
              
              <div class="row">
                <div class="col-4">
                  <div class="mb-2">
                    <label class="form-label text-muted small mb-0">Item Name</label>
                    <p class="mb-1 fw-bold">${item.item_name}</p>
                  </div>
                </div>
                <div class="col-4">
                  <div class="mb-2">
                    <label class="form-label text-muted small mb-0">Supplier Part No</label>
                    <p class="mb-1">${item.supplier_part_no || "N/A"}</p>
                  </div>
                </div>
                <div class="col-4">
                  <div class="mb-2">
                    <label class="form-label text-muted small mb-0">Quantity</label>
                    <p class="mb-1">${item.quantity || 1} ${item.unit || 'pcs'}</p>
                  </div>
                </div>
              </div>
              
              <div class="row">
                <div class="col-6">
                  <div class="mb-2">
                    <label class="form-label text-muted small mb-0">Price per Unit</label>
                    <p class="mb-1">₹${safeToFixed(item.price_per_unit)}</p>
                  </div>
                </div>
                <div class="col-6">
                  <div class="mb-2">
                    <label class="form-label text-muted small mb-0">Total Amount</label>
                    <p class="mb-1 fw-bold text-danger">₹${safeToFixed(item.amount_after_discount)}</p>
                  </div>
                </div>
              </div>
              
              <div class="mb-2">
                <label class="form-label text-muted small mb-0">Description</label>
                <div class="bg-light p-2 rounded">
                  <p class="mb-0">${item.description || "No description"}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="card border-info mb-4">
            <div class="card-header bg-info text-white">
              <h5 class="mb-0">Price Comparison</h5>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-6">
                  <div class="mb-2">
                    <label class="form-label text-muted small mb-0">Selling Price</label>
                    <p class="mb-1 fw-bold">₹${safeToFixed(item.amount_after_discount)}</p>
                  </div>
                </div>
                <div class="col-6">
                  <div class="mb-2">
                    <label class="form-label text-muted small mb-0">Buy Price</label>
                    <p class="mb-1 fw-bold text-success">₹${safeToFixed(item.buy_price)}</p>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-12">
                  <div class="mb-2">
                    <label class="form-label text-muted small mb-0">Margin</label>
                    ${(() => {
                      const sellingPrice = parseFloat(item.amount_after_discount) || 0;
                      const buyPrice = parseFloat(item.buy_price) || 0;
                      const margin = buyPrice > 0 ? ((sellingPrice - buyPrice) / buyPrice * 100) : 0;
                      const marginClass = margin >= 0 ? 'text-success' : 'text-danger';
                      const marginText = margin >= 0 ? 'Profit' : 'Loss';
                      return `
                        <p class="mb-1 fw-bold ${marginClass}">
                          ${margin >= 0 ? '+' : ''}${margin.toFixed(2)}% (${marginText})
                        </p>
                      `;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-4 p-2 bg-light rounded">
            <h5>Technical Specifications:</h5>
            <div class="row">
              <div class="col-3">
                <p class="mb-1"><strong>Cut Width (mm):</strong> ${item.cut_width || "N/A"}</p>
              </div>
              <div class="col-3">
                <p class="mb-1"><strong>Cut Length (M):</strong> ${item.length || "N/A"}</p>
              </div>
              <div class="col-3">
                <p class="mb-1"><strong>Count:</strong> ${item.count || 1}</p>
              </div>
              <div class="col-3">
                <p class="mb-1"><strong>HSN Code:</strong> ${item.hsn_sac || "N/A"}</p>
              </div>
            </div>
            <div class="row mt-2">
              <div class="col-6">
                <p class="mb-1"><strong>Brand Code:</strong> <span class="brand-code">${item.brand_code || "N/A"}</span></p>
              </div>
              <div class="col-6">
                <p class="mb-1"><strong>GST Rate:</strong> ${item.tax_rate || 18}%</p>
              </div>
            </div>
          </div>
          
          <div class="no-print mt-4 text-center">
            <button onclick="window.print()" class="btn btn-primary btn-sm me-2">
              <i class="bi bi-printer me-1"></i>Print
            </button>
            <button onclick="window.close()" class="btn btn-secondary btn-sm">
              <i class="bi bi-x-circle me-1"></i>Close
            </button>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Container fluid className="py-4">
      {/* Header Section with Yellow Background */}
      <div className="mb-4">
        <Card className="border-0 shadow-sm">
          <Card.Header>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h1 className="h2 mb-1">Rejected Items</h1>
                <p className="mb-0">View and manage rejected items</p>
              </div>
              <div>
                <Badge bg="dark" className="fs-6">
                  <i className="bi bi-x-circle me-1"></i>
                  Total: {rejectedStats.total}
                </Badge>
              </div>
            </div>
          </Card.Header>
          <Card.Body className="p-4">
            <Row>
              <Col md={4} className="text-center">
                <div className="d-flex flex-column align-items-center">
                  <div className="rounded-circle bg-light border border-warning d-flex align-items-center justify-content-center text-warning mb-3" 
                       style={{ width: '70px', height: '70px' }}>
                    <i className="bi bi-x-circle display-5"></i>
                  </div>
                  <div>
                    <div className="text-muted small">Total Rejected Items</div>
                    <div className="h2 mb-0 text-warning">{rejectedStats.total}</div>
                  </div>
                </div>
              </Col>
              <Col md={8}>
                <Row>
                  <Col md={6}>
                    <div className="mb-3">
                      <div className="text-muted small">Avg Buy Price</div>
                      <div className="h4 mb-0">
                        ₹{(() => {
                          const itemsWithBuyPrice = rejectedItems.filter(item => item.buy_price > 0);
                          const total = itemsWithBuyPrice.reduce((sum, item) => sum + item.buy_price, 0);
                          return itemsWithBuyPrice.length > 0 ? (total / itemsWithBuyPrice.length).toFixed(2) : '0.00';
                        })()}
                      </div>
                      <small className="text-muted">Average purchase cost</small>
                    </div>
                  </Col>
                </Row>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </div>

      {/* Search and Filter Section */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Header className="bg-light">
          <h5 className="mb-0">
            <i className="bi bi-funnel me-2"></i>
            Search & Filter
          </h5>
        </Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Search</Form.Label>
                <InputGroup>
                  <FormControl
                    placeholder="Search by quotation no, item name, brand code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && fetchRejectedItems()}
                  />
                  {searchTerm && (
                    <Button variant="outline-secondary" onClick={() => setSearchTerm("")} title="Clear">
                      <i className="bi bi-x-circle"></i>
                    </Button>
                  )}
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Date From</Form.Label>
                <Form.Control
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Date To</Form.Label>
                <Form.Control
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={2} className="d-flex align-items-end">
              <div className="d-flex gap-2 w-100">
                <Button variant="outline-secondary" onClick={resetFilters} className="flex-grow-1">
                  <i className="bi bi-x-circle me-1"></i>Reset
                </Button>
                <Button variant="warning" onClick={fetchRejectedItems} className="flex-grow-1">
                  <i className="bi bi-search me-1"></i>Search
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Rejection Reason Modal */}
      <Modal show={showRejectionReasonModal} onHide={() => setShowRejectionReasonModal(false)} centered>
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title>
            <i className="bi bi-x-circle me-2"></i>
            Rejection Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="mb-3">
                <label className="form-label text-muted small mb-0">Brand Code</label>
                <div className="d-flex align-items-center">
                  <code className="bg-light p-2 rounded flex-grow-1">
                    {rejectionReasonData.brand_code || "N/A"}
                  </code>
                  {rejectionReasonData.brand_code && (
                    <Badge bg="info" className="ms-2">Extracted</Badge>
                  )}
                </div>
              </div>
              
              <div className="mb-3">
                <label className="form-label text-muted small mb-0">Customer Description</label>
                <Card className="bg-light">
                  <Card.Body>
                    <p className="mb-0">{rejectionReasonData.customer_description || "No customer description"}</p>
                  </Card.Body>
                </Card>
              </div>
              
              <div className="mb-3">
                <label className="form-label text-muted small mb-0">Buy Price</label>
                <Alert variant="success" className="mb-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Purchase Cost:</span>
                    <strong>₹{safeToFixed(rejectionReasonData.buy_price)}</strong>
                  </div>
                </Alert>
              </div>
              
              <div className="mb-3">
                <label className="form-label text-muted small mb-0">Item Name</label>
                <p className="mb-2 fw-bold">{rejectionReasonData.item_name}</p>
              </div>
              
              <div className="mb-3">
                <label className="form-label text-muted small mb-0">Quotation Number</label>
                <p className="mb-2">{rejectionReasonData.quotation_number}</p>
              </div>
              
              <div className="mb-0">
                <label className="form-label text-muted small mb-0">Rejection Reason</label>
                <Card className="bg-warning bg-opacity-10">
                  <Card.Body>
                    <p className="mb-0">{rejectionReasonData.rejection_reason}</p>
                  </Card.Body>
                </Card>
              </div>
            </Card.Body>
          </Card>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectionReasonModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View Item Details Modal */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg">
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title>
            <i className="bi bi-x-circle me-2"></i>
            Rejected Item Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {selectedRejectedItem && selectedQuotation && (
            <>
              <Alert variant="warning" className="mb-3">
                <i className="bi bi-exclamation-triangle me-2"></i>
                This item has been rejected
              </Alert>

              <Card className="mb-3 border-0 shadow-sm">
                <Card.Header className="bg-info text-white">
                  <h6 className="mb-0">
                    <i className="bi bi-database me-2"></i>
                    Extracted Information
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={4}>
                      <div className="mb-3">
                        <label className="form-label text-muted small mb-0">Brand Code</label>
                        <div className="d-flex align-items-center">
                          <code className="bg-light p-2 rounded flex-grow-1">
                            {selectedRejectedItem.brand_code || "N/A"}
                          </code>
                          {selectedRejectedItem.brand_code && (
                            <Badge bg="success" className="ms-2">Extracted</Badge>
                          )}
                        </div>
                      </div>
                    </Col>
                    <Col md={8}>
                      <div className="mb-3">
                        <label className="form-label text-muted small mb-0">Customer Description</label>
                        <Card className="bg-light">
                          <Card.Body className="p-2">
                            <p className="mb-0">{selectedRejectedItem.customer_description || "No customer description"}</p>
                          </Card.Body>
                        </Card>
                      </div>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label text-muted small mb-0">Buy Price</label>
                        <Alert variant="success" className="mb-0">
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Purchase Cost:</span>
                            <strong>₹{safeToFixed(selectedRejectedItem.buy_price)}</strong>
                          </div>
                        </Alert>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-3">
                        <label className="form-label text-muted small mb-0">Selling Price</label>
                        <Alert variant="warning" className="mb-0">
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Quoted Price:</span>
                            <strong>₹{safeToFixed(selectedRejectedItem.amount_after_discount)}</strong>
                          </div>
                        </Alert>
                      </div>
                    </Col>
                  </Row>
                  
                  {selectedRejectedItem.buy_price > 0 && (
                    <Row>
                      <Col md={12}>
                        <div className="mb-0">
                          <label className="form-label text-muted small mb-0">Margin Analysis</label>
                          <Card className="bg-light">
                            <Card.Body className="p-2">
                              <div className="row">
                                <div className="col-4 text-center">
                                  <div className="text-muted small">Buy Price</div>
                                  <div className="h6 text-success">₹{safeToFixed(selectedRejectedItem.buy_price)}</div>
                                </div>
                                <div className="col-4 text-center">
                                  <div className="text-muted small">Sell Price</div>
                                  <div className="h6 text-warning">₹{safeToFixed(selectedRejectedItem.amount_after_discount)}</div>
                                </div>
                                <div className="col-4 text-center">
                                  <div className="text-muted small">Margin</div>
                                  {(() => {
                                    const sellingPrice = parseFloat(selectedRejectedItem.amount_after_discount) || 0;
                                    const buyPrice = parseFloat(selectedRejectedItem.buy_price) || 0;
                                    const margin = buyPrice > 0 ? ((sellingPrice - buyPrice) / buyPrice * 100) : 0;
                                    const marginClass = margin >= 0 ? 'text-success' : 'text-danger';
                                    return `
                                      <div className="h6 ${marginClass}">
                                        ${margin >= 0 ? '+' : ''}${margin.toFixed(2)}%
                                      </div>
                                      <div className="text-muted small">${margin >= 0 ? 'Profit' : 'Loss'}</div>
                                    `;
                                  })()}
                                </div>
                              </div>
                            </Card.Body>
                          </Card>
                        </div>
                      </Col>
                    </Row>
                  )}
                </Card.Body>
              </Card>

              <Card className="mb-3 border-0 shadow-sm">
                <Card.Header className="bg-light">
                  <h6 className="mb-0">
                    <i className="bi bi-file-text me-2"></i>
                    Quotation Information
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <div className="mb-2">
                        <label className="form-label text-muted small mb-0">Quotation Number</label>
                        <p className="mb-1 fw-bold">{selectedQuotation.quote_number || selectedQuotation.quoteNo || selectedQuotation.quotation_number || "N/A"}</p>
                      </div>
                      <div className="mb-2">
                        <label className="form-label text-muted small mb-0">Date</label>
                        <p className="mb-1">{selectedQuotation.date || selectedQuotation.date || "N/A"}</p>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-2">
                        <label className="form-label text-muted small mb-0">Company</label>
                        <p className="mb-1">{selectedQuotation.company_name || selectedQuotation.billTo || "N/A"}</p>
                      </div>
                      <div className="mb-2">
                        <label className="form-label text-muted small mb-0">Contact Person</label>
                        <p className="mb-1">{selectedQuotation.contact_person || selectedQuotation.contactPerson || "N/A"}</p>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Card className="mb-3 border-0 shadow-sm">
                <Card.Header className="bg-warning">
                  <h6 className="mb-0">
                    <i className="bi bi-box me-2"></i>
                    Item Details
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <div className="mb-2">
                        <label className="form-label text-muted small mb-0">Item Name</label>
                        <p className="mb-1 fw-bold">{selectedRejectedItem.item_name}</p>
                      </div>
                      <div className="mb-2">
                        <label className="form-label text-muted small mb-0">Supplier Part No</label>
                        <p className="mb-1">{selectedRejectedItem.supplier_part_no || "N/A"}</p>
                      </div>
                      <div className="mb-2">
                        <label className="form-label text-muted small mb-0">Quantity</label>
                        <p className="mb-1">{selectedRejectedItem.quantity || 1} {selectedRejectedItem.unit || 'pcs'}</p>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-2">
                        <label className="form-label text-muted small mb-0">Price per Unit</label>
                        <p className="mb-1">₹{safeToFixed(selectedRejectedItem.price_per_unit)}</p>
                      </div>
                      <div className="mb-2">
                        <label className="form-label text-muted small mb-0">Total Amount</label>
                        <p className="mb-1 fw-bold text-warning">₹{safeToFixed(selectedRejectedItem.amount_after_discount)}</p>
                      </div>
                    </Col>
                  </Row>
                  
                  <div className="mb-2">
                    <label className="form-label text-muted small mb-0">Description</label>
                    <Card className="bg-light">
                      <Card.Body>
                        <p className="mb-0">{selectedRejectedItem.description || "No description"}</p>
                      </Card.Body>
                    </Card>
                  </div>
                </Card.Body>
              </Card>
              
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-light">
                  <h6 className="mb-0">
                    <i className="bi bi-gear me-2"></i>
                    Technical Specifications
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <div className="col-3">
                      <p className="mb-1"><strong>Cut Width (mm):</strong> {selectedRejectedItem.cut_width || "N/A"}</p>
                    </div>
                    <div className="col-3">
                      <p className="mb-1"><strong>Cut Length (M):</strong> {selectedRejectedItem.length || "N/A"}</p>
                    </div>
                    <div className="col-3">
                      <p className="mb-1"><strong>Count:</strong> {selectedRejectedItem.count || 1}</p>
                    </div>
                    <div className="col-3">
                      <p className="mb-1"><strong>HSN Code:</strong> {selectedRejectedItem.hsn_sac || "N/A"}</p>
                    </div>
                    <div className="col-6">
                      <p className="mb-1"><strong>GST Rate:</strong> {selectedRejectedItem.tax_rate || 18}%</p>
                    </div>
                    <div className="col-6">
                      <p className="mb-1"><strong>Batch No:</strong> {selectedRejectedItem.batch_no || "N/A"}</p>
                    </div>
                  </Row>
                </Card.Body>
              </Card>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewModal(false)}>
            <i className="bi bi-x-circle me-1"></i>Close
          </Button>
          <Button 
            variant="warning"
            onClick={() => updateItemStatus(selectedRejectedItem?.id, "pending")}
            disabled={!selectedRejectedItem}
          >
            <i className="bi bi-arrow-counterclockwise me-1"></i>Move to Pending
          </Button>
          <Button 
            variant="info"
            onClick={() => viewRejectionReason(selectedRejectedItem)}
            disabled={!selectedRejectedItem}
          >
            <i className="bi bi-chat-left-text me-1"></i>View Reason
          </Button>
          <Button 
            variant="warning" 
            onClick={() => printRejectedItem(selectedRejectedItem, selectedQuotation)}
            disabled={!selectedRejectedItem}
          >
            <i className="bi bi-printer me-1"></i>Print
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Rejected Items Table with Yellow Header */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-light">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <i className="bi bi-list me-2"></i>
              Rejected Items List
              <span className="ms-2">
                <Badge bg="warning" className="ms-2">Total: {totalItems}</Badge>
                {(searchTerm || dateFrom || dateTo) && (
                  <Badge bg="info" className="ms-1">Filtered: {rejectedItems.length}</Badge>
                )}
              </span>
            </h5>
            <div className="d-flex gap-2">
              <Dropdown>
                <Dropdown.Toggle variant="success" size="sm" disabled={exportLoading}>
                  {exportLoading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-1" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-download me-1"></i>Export
                    </>
                  )}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={exportToExcel}>
                    <i className="bi bi-file-earmark-excel text-success me-2"></i>
                    Export to Excel
                  </Dropdown.Item>
                  <Dropdown.Item onClick={exportToPDF}>
                    <i className="bi bi-file-earmark-pdf text-danger me-2"></i>
                    Export to PDF
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <Button variant="outline-primary" size="sm" onClick={fetchRejectedItems} disabled={loadingItems} title="Refresh">
                <i className="bi bi-arrow-clockwise"></i>
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {loadingItems ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="warning" />
              <p className="mt-2 text-muted">Loading...</p>
            </div>
          ) : rejectedItems.length > 0 ? (
            <>
              <Table hover responsive className="mb-0">
                <thead className="table-warning">
                  <tr>
                    <th width="50">#</th>
                    <th>Item Name</th>
                    <th>Brand Code</th>
                    <th>Customer Description</th>
                    <th>Buy Price</th>
                    <th>Quotation No</th>
                    <th>Company</th>
                    <th>Quantity</th>
                    <th>Amount</th>
                    <th width="180">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedItems.map((item, index) => (
                    <tr key={item.id || index}>
                      <td>{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                      <td>
                        <strong>{item.item_name}</strong><br/>
                        <small className="text-muted">{item.description?.substring(0, 30)}...</small>
                      </td>
                      <td>
                        {item.brand_code ? (
                          <Badge bg="info" className="mb-1">
                            {item.brand_code}
                          </Badge>
                        ) : (
                          <span className="text-muted">N/A</span>
                        )}
                      </td>
                      <td>
                        {item.customer_description ? (
                          <div className="text-truncate" style={{ maxWidth: '150px' }} title={item.customer_description}>
                            {item.customer_description}
                          </div>
                        ) : (
                          <span className="text-muted">N/A</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex flex-column">
                          <strong className="text-success">₹{safeToFixed(item.buy_price)}</strong>
                          {item.buy_price > 0 && (
                            <small className="text-muted">Cost</small>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong>{item.quotation_number || item.quote_number || "N/A"}</strong><br/>
                        <small className="text-muted">{item.date || ""}</small>
                      </td>
                      <td>
                        {item.company_name || item.billTo || "N/A"}<br/>
                        <small className="text-muted">{item.contact_person || "N/A"}</small>
                      </td>
                      <td>
                        {item.quantity || 1} {item.unit || 'pcs'}
                      </td>
                      <td>
                        <strong className="text-warning">
                          ₹{safeToFixed(item.amount_after_discount)}
                        </strong><br/>
                        <small className="text-muted">Unit: ₹{safeToFixed(item.price_per_unit)}</small>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <Button
                            variant="outline-info"
                            onClick={() => viewRejectedItem(item)}
                            title="View Details"
                          >
                            <i className="bi bi-eye"></i>
                          </Button>
                          <Button
                            variant="outline-warning"
                            onClick={() => viewRejectionReason(item)}
                            title="View Rejection Reason"
                          >
                            <i className="bi bi-chat-left-text"></i>
                          </Button>
                          <Button
                            variant="outline-success"
                            onClick={() => updateItemStatus(item.id, "pending")}
                            title="Move to Pending"
                          >
                            <i className="bi bi-arrow-counterclockwise"></i>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              
              {/* PAGINATION */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <div className="text-muted">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                  </div>
                  <Pagination size="sm" className="mb-0">
                    <Pagination.Prev 
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    />
                    
                    {getPaginationItems().map((pageNum, index) => (
                      <Pagination.Item
                        key={index}
                        active={pageNum === currentPage}
                        onClick={() => typeof pageNum === 'number' ? handlePageChange(pageNum) : null}
                        disabled={pageNum === '...'}
                      >
                        {pageNum}
                      </Pagination.Item>
                    ))}
                    
                    <Pagination.Next 
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    />
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-5">
              <div className="mb-3">
                <i className="bi bi-check-circle display-1 text-success"></i>
              </div>
              <h5 className="text-muted">No rejected items</h5>
              <p className="text-muted">
                {searchTerm || dateFrom || dateTo ? 'Try removing filters' : 'No rejected items found.'}
              </p>
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}      