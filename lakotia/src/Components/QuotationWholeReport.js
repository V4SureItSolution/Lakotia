import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE } from "../config";

import dayjs from "dayjs";
import { 
  Modal, 
  Button, 
  Form, 
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
  Collapse
} from "react-bootstrap";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

export default function QuotationModal() {
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

  // State variables
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  // Saved quotations state
  const [savedQuotations, setSavedQuotations] = useState([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  // Statistics
  const [quotationCounts, setQuotationCounts] = useState({
    all: 0,
    draft: 0,
    requote: 0,
    completed: 0,
  });

  // Stock cache for buy prices
  const [stockCache, setStockCache] = useState({});

  // Expanded rows for showing items
  const [expandedRows, setExpandedRows] = useState({});

  // NEW: Export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [exportEndDate, setExportEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [exportStatus, setExportStatus] = useState('completed'); // Only completed for quotations
  const [exporting, setExporting] = useState(false);
  const [exportData, setExportData] = useState([]);

  // API base URL
  // Removed hardcoded API_BASE_URL


  // Fetch saved quotations from backend on component mount
  useEffect(() => {
    fetchQuotations();
    fetchQuotationCounts();
  }, [currentPage, searchTerm]);

  // Fetch buy prices in bulk for brand codes
  const fetchBulkBuyPrices = async (brandCodes) => {
    if (!brandCodes || brandCodes.length === 0) return {};
    
    try {
      const response = await axios.post(`${API_BASE}/stock/bulk-buy-prices`, {
        brand_codes: brandCodes
      });
      
      if (response.data.success) {
        const priceMap = {};
        response.data.data.forEach(item => {
          priceMap[item.brand_code] = item.buy_price || 0;
        });
        
        // Update cache
        setStockCache(prev => ({ ...prev, ...priceMap }));
        
        return priceMap;
      }
    } catch (err) {
      console.error("Error fetching bulk buy prices:", err);
    }
    return {};
  };

  // Extract brand code from description
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

  // Extract customer description
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

  // Extract batch number from description or use item data
  const extractBatchNo = (item) => {
    // First check if batch_no exists directly in item
    if (item.batch_no) return item.batch_no;
    
    // Then check description for batch information
    if (item.description && item.description.includes('[BATCH:')) {
      try {
        const match = item.description.match(/\[BATCH:(.*?)\]/);
        return match ? match[1] : "";
      } catch (e) {
        console.error("Error extracting batch no from description:", e);
      }
    }
    
    return "";
  };

  // Extract MRP from item
  const extractMRP = (item) => {
    return item.mrp || item.price_per_unit || 0;
  };

  // Extract HSN/SAC from item
  const extractHsnSac = (item) => {
    return item.hsn_sac || "";
  };

  // Clean description by removing metadata markers
  const cleanDescription = (description) => {
    if (!description) return "";
    
    try {
      return description
        .replace(/\[BRAND_CODE:.*?\]/g, '')
        .replace(/\[CUSTOMER_DESC:.*?\]/g, '')
        .replace(/\[BATCH:.*?\]/g, '')
        .trim();
    } catch (e) {
      console.error("Error cleaning description:", e);
      return description;
    }
  };

  // Fetch quotation counts by status
  const fetchQuotationCounts = async () => {
    try {
      const response = await axios.get(`${API_BASE}/quotations/statistics`);
      if (response.data.success) {
        const counts = {
          all: response.data.data.total || 0,
          draft: response.data.data.status_counts?.draft || 0,
          requote: response.data.data.status_counts?.requote || 0,
          completed: response.data.data.status_counts?.completed || 0,
        };
        setQuotationCounts(counts);
      }
    } catch (err) {
      console.error("Error loading quotation counts:", err);
    }
  };

  // Fetch saved quotations with pagination - ONLY COMPLETED
  const fetchQuotations = async () => {
    setLoadingQuotations(true);
    try {
      const params = {
        page: currentPage,
        per_page: itemsPerPage,
        status: 'completed'
      };
      
      if (searchTerm.trim()) {
        params.q = searchTerm.trim();
      }
      
      const response = await axios.get(`${API_BASE}/quotations`, { params });
      
      if (response.data.success) {
        const fetchedQuotations = response.data.data || [];
        const pagination = response.data.pagination || {};
        
        // Extract all unique brand codes from all quotations
        const allBrandCodes = [];
        fetchedQuotations.forEach(quotation => {
          (quotation.items || []).forEach(item => {
            const brandCode = extractBrandCode(item.description || "");
            if (brandCode) {
              allBrandCodes.push(brandCode);
            }
          });
        });
        
        // Fetch buy prices in bulk for all brand codes
        const buyPriceMap = await fetchBulkBuyPrices([...new Set(allBrandCodes)]);
        
        // Transform quotations with buy prices
        const quotationsWithBuyPrices = fetchedQuotations.map(quotation => {
          const transformedItems = (quotation.items || []).map(item => {
            const brandCode = extractBrandCode(item.description || "");
            const customerDescription = extractCustomerDescription(item.description || "");
            const cleanDesc = cleanDescription(item.description || "");
            const batchNo = extractBatchNo(item);
            const mrp = extractMRP(item);
            const hsnSac = extractHsnSac(item);
            
            const buyPrice = brandCode ? (buyPriceMap[brandCode] || 0) : 0;
            
            return {
              ...item,
              sales_order_item_status: item.sales_order_item_status || "not_created",
              brand_code: brandCode || "",
              customer_description: customerDescription || "",
              description: cleanDesc,
              buy_price: buyPrice,
              count: item.count || 1,
              packing_charges: item.packing_charges || 0,
              other_charges: item.other_charges || 0,
              batch_no: batchNo,
              mrp: mrp,
              hsn_sac: hsnSac,
              unit: item.unit || "",
              cut_width: item.cut_width || "",
              length: item.length || ""
            };
          });
          
          return {
            ...quotation,
            items: transformedItems
          };
        });
        
        setSavedQuotations(quotationsWithBuyPrices);
        setTotalItems(pagination.total || fetchedQuotations.length);
        setTotalPages(pagination.pages || Math.ceil((pagination.total || fetchedQuotations.length) / itemsPerPage) || 1);
      } else {
        throw new Error(response.data.message || "API response unsuccessful");
      }
    } catch (err) {
      console.error("Error loading quotations from API:", err);
      setSavedQuotations([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoadingQuotations(false);
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (quotationId) => {
    setExpandedRows(prev => ({
      ...prev,
      [quotationId]: !prev[quotationId]
    }));
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

  // View quotation details in modal
  const viewQuotation = (quotation) => {
    setSelectedQuotation(quotation);
    setShowViewModal(true);
  };

  // Print quotation
  const printQuotation = (quotation) => {
    const printWindow = window.open('', '_blank');
    
    const items = quotation.items || [];
    const totals = {
      subtotal: quotation.subtotal || quotation.totals?.subtotal || 0,
      totalDiscount: quotation.total_discount || quotation.totals?.totalDiscount || 0,
      totalPacking: quotation.total_packing || quotation.totals?.totalPacking || 0,
      totalOther: quotation.total_other || quotation.totals?.totalOther || 0,
      totalGST: quotation.total_tax || quotation.totals?.totalGST || 0,
      grandTotal: quotation.grand_total || quotation.totals?.grandTotal || 0
    };
    
    const taxSummary = {};
    items.forEach(item => {
      const taxRate = item.tax_rate || 18;
      const taxAmount = item.tax_amount || 0;
      if (!taxSummary[taxRate]) {
        taxSummary[taxRate] = 0;
      }
      taxSummary[taxRate] += taxAmount;
    });
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quotation ${quotation.quote_number || quotation.quoteNo}</title>
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
          .company-logo { max-width: 120px; max-height: 120px; }
        </style>
      </head>
      <body>
        <div class="container mt-3">
          <div class="invoice-header">
            <div class="row">
              <div class="col-2">
                <img src="E:/Lakotia/lakotia/src/Components/Name1.jpg" alt="Company Logo" class="company-logo">
              </div>
              <div class="col-5">
                <h1 class="mb-1">${issuer.name}</h1>
                <p class="mb-1">${issuer.address}</p>
                <p class="mb-1">Phone: ${issuer.phone} | Email: ${issuer.email}</p>
                <p class="mb-1">GSTIN: ${issuer.gstin} | State: ${issuer.stateCode}</p>
              </div>
              <div class="col-5 text-end">
                <h2 class="text-primary mb-2">QUOTATION</h2>
                <p class="mb-1"><strong>Quote No:</strong> ${quotation.quote_number || quotation.quoteNo}</p>
                <p class="mb-1"><strong>Date:</strong> ${quotation.date || quotation.date}</p>
              </div>
            </div>
          </div>
          
          <div class="row mb-3">
            <div class="col-6">
              <h5>Bill To:</h5>
              <p class="mb-1"><strong>${quotation.company_name || quotation.billTo}</strong></p>
              <p class="mb-1">${quotation.company_address || ''}</p>
              <p class="mb-1">GSTIN: ${quotation.company_gstin || ''}</p>
            </div>
            <div class="col-6">
              <h5>Contact Details:</h5>
              <p class="mb-1"><strong>${quotation.contact_person || quotation.contactPerson}</strong></p>
              <p class="mb-1">Phone: ${quotation.contact_mobile || quotation.contactMob}</p>
              <p class="mb-1">Email: ${quotation.contact_email || quotation.contactEmail}</p>
            </div>
          </div>
          
          <div class="table-responsive">
            <table class="table table-bordered table-sm">
              <thead class="table-light">
                <tr>
                  <th>#</th>
                  <th>Item Name</th>
                  <th>Brand Code</th>
                  <th>Batch No</th>
                  <th>Cut Width (mm)</th>
                  <th>Cut Length (M)</th>
                  <th>Count</th>
                  <th>Supplier Part No</th>
                  <th>Customer Description</th>
                  <th>HSN</th>
                  <th>Qty</th>
                  <th>UoM</th>
                  <th>Price/Unit</th>
                  <th>NBP</th>
                  <th>Buy Price</th>
                  <th>GST %</th>
                  <th>Amount</th>
                  <th>Sales Order Status</th>
                  <th>Rejection Reason</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item, index) => {
                  const statusBadge = item.sales_order_item_status === 'ordered' ? 'success' :
                                    item.sales_order_item_status === 'rejected' ? 'danger' :
                                    item.sales_order_item_status === 'in_production' ? 'info' :
                                    item.sales_order_item_status === 'ready' ? 'primary' :
                                    item.sales_order_item_status === 'dispatched' ? 'warning' :
                                    item.sales_order_item_status === 'delivered' ? 'success' : 'secondary';
                  
                  const statusText = item.sales_order_item_status === 'not_created' ? 'Not Created' :
                                   item.sales_order_item_status === 'ordered' ? 'Ordered' :
                                   item.sales_order_item_status === 'in_production' ? 'In Production' :
                                   item.sales_order_item_status === 'ready' ? 'Ready' :
                                   item.sales_order_item_status === 'dispatched' ? 'Dispatched' :
                                   item.sales_order_item_status === 'delivered' ? 'Delivered' :
                                   item.sales_order_item_status === 'rejected' ? 'Rejected' : 'Unknown';
                  
                  return `
                    <tr>
                      <td>${index + 1}</td>
                      <td><strong>${item.item_name}</strong></td>
                      <td>${item.brand_code || ''}</td>
                      <td>${item.batch_no || ''}</td>
                      <td>${item.cut_width || ''}</td>
                      <td>${item.length || ''}</td>
                      <td>${item.count || ''}</td>
                      <td>${item.supplier_part_no || ''}</td>
                      <td>${item.customer_description || ''}</td>
                      <td>${item.hsn_sac || ''}</td>
                      <td>${item.quantity || ''}</td>
                      <td>${item.unit || ''}</td>
                      <td>₹${(item.price_per_unit || 0).toFixed(2)}</td>
                      <td>₹${(item.mrp || item.price_per_unit || 0).toFixed(2)}</td>
                      <td>₹${(item.buy_price || 0).toFixed(2)}</td>
                      <td>${item.tax_rate || 18}%</td>
                      <td><strong>₹${(item.amount_after_discount || 0).toFixed(2)}</strong></td>
                      <td>
                        <span class="badge bg-${statusBadge}">
                          ${statusText}
                        </span>
                      </td>
                      <td>${item.rejection_reason || ''}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="row mt-3">
            <div class="col-7">
              <h5 class="mb-2">Tax Summary:</h5>
              <table class="table table-bordered table-sm summary-table">
                <thead class="table-light">
                  <tr>
                    <th>GST %</th>
                    <th>Taxable Amount</th>
                    <th>Tax Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(taxSummary).map(([rate, amount]) => `
                    <tr>
                      <td>${rate}%</td>
                      <td>₹${(amount / (parseFloat(rate) / 100)).toFixed(2)}</td>
                      <td>₹${amount.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="col-5">
              <div class="card border-0">
                <div class="card-body p-2">
                  <h5 class="card-title mb-2">Total Summary</h5>
                  <div class="d-flex justify-content-between mb-1">
                    <span>Subtotal:</span>
                    <strong>₹${totals.subtotal.toFixed(2)}</strong>
                  </div>
                  <div class="d-flex justify-content-between mb-1">
                    <span>Discount:</span>
                    <strong class="text-danger">- ₹${totals.totalDiscount.toFixed(2)}</strong>
                  </div>
                  ${totals.totalPacking > 0 ? `
                    <div class="d-flex justify-content-between mb-1">
                      <span>Packing:</span>
                      <strong>₹${totals.totalPacking.toFixed(2)}</strong>
                    </div>
                  ` : ''}
                  ${totals.totalOther > 0 ? `
                    <div class="d-flex justify-content-between mb-1">
                      <span>Other Charges:</span>
                      <strong>₹${totals.totalOther.toFixed(2)}</strong>
                    </div>
                  ` : ''}
                  <div class="d-flex justify-content-between mb-1">
                    <span>Total Tax:</span>
                    <strong>₹${totals.totalGST.toFixed(2)}</strong>
                  </div>
                  <hr class="my-1"/>
                  <div class="d-flex justify-content-between total-row">
                    <span>Grand Total:</span>
                    <strong class="text-primary">₹${totals.grandTotal.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-3 p-2 bg-light rounded">
            <h5>Notes:</h5>
            <p class="mb-0">${quotation.notes || 'Please process this quote as per the terms mentioned. All prices are in INR and inclusive of GST. Delivery within 7-10 business days.'}</p>
            <p class="mb-0 mt-1"><strong>Valid for 30 days from the date of issue.</strong></p>
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
  };

  // Handle search for quotations
  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  // Get badge color for sales order item status
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'not_created': return 'secondary';
      case 'ordered': return 'info';
      case 'in_production': return 'primary';
      case 'ready': return 'warning';
      case 'dispatched': return 'success';
      case 'delivered': return 'success';
      case 'rejected': return 'danger';
      default: return 'secondary';
    }
  };

  // Get display text for sales order item status
  const getStatusDisplayText = (status) => {
    switch (status) {
      case 'not_created': return 'Not Created';
      case 'ordered': return 'Ordered';
      case 'in_production': return 'In Production';
      case 'ready': return 'Ready';
      case 'dispatched': return 'Dispatched';
      case 'delivered': return 'Delivered';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  // =============== NEW: Export Functions ===============
  const fetchExportData = async () => {
    setExporting(true);
    try {
      const params = {
        start_date: exportStartDate,
        end_date: exportEndDate,
        status: exportStatus
      };
      
      const response = await axios.get(`${API_BASE}/quotations/export`, { params });
      
      if (response.data.success) {
        const fetchedQuotations = response.data.data || [];
        
        // Extract all unique brand codes from all quotations
        const allBrandCodes = [];
        fetchedQuotations.forEach(quotation => {
          (quotation.items || []).forEach(item => {
            const brandCode = extractBrandCode(item.description || "");
            if (brandCode) {
              allBrandCodes.push(brandCode);
            }
          });
        });
        
        // Fetch buy prices in bulk for all brand codes
        const buyPriceMap = await fetchBulkBuyPrices([...new Set(allBrandCodes)]);
        
        // Transform quotations with buy prices
        const quotationsWithBuyPrices = fetchedQuotations.map(quotation => {
          const transformedItems = (quotation.items || []).map(item => {
            const brandCode = extractBrandCode(item.description || "");
            const customerDescription = extractCustomerDescription(item.description || "");
            const cleanDesc = cleanDescription(item.description || "");
            const batchNo = extractBatchNo(item);
            const mrp = extractMRP(item);
            const hsnSac = extractHsnSac(item);
            
            const buyPrice = brandCode ? (buyPriceMap[brandCode] || 0) : 0;
            
            return {
              ...item,
              sales_order_item_status: item.sales_order_item_status || "not_created",
              brand_code: brandCode || "",
              customer_description: customerDescription || "",
              description: cleanDesc,
              buy_price: buyPrice,
              count: item.count || 1,
              packing_charges: item.packing_charges || 0,
              other_charges: item.other_charges || 0,
              batch_no: batchNo,
              mrp: mrp,
              hsn_sac: hsnSac,
              unit: item.unit || "",
              cut_width: item.cut_width || "",
              length: item.length || ""
            };
          });
          
          return {
            ...quotation,
            items: transformedItems
          };
        });
        
        setExportData(quotationsWithBuyPrices);
        
        if (quotationsWithBuyPrices.length === 0) {
          alert("No data found for the selected date range.");
          return [];
        }
        
        return quotationsWithBuyPrices;
      } else {
        throw new Error(response.data.message || "Failed to fetch export data");
      }
    } catch (err) {
      console.error("Export fetch error:", err);
      alert("Failed to fetch data for export.");
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
    
    // Prepare Excel data - summary level
    const excelData = data.map((quotation, index) => {
      const items = quotation.items || [];
      const totalItems = items.length;
      const orderedItems = items.filter(item => item.sales_order_item_status === "ordered").length;
      const notCreatedItems = items.filter(item => item.sales_order_item_status === "not_created").length;
      const rejectedItems = items.filter(item => item.sales_order_item_status === "rejected").length;
      
      // Calculate profit
      const totalBuyPrice = items.reduce((sum, item) => sum + (parseFloat(item.buy_price) || 0) * (parseFloat(item.quantity) || 1), 0);
      const totalSellPrice = parseFloat(quotation.subtotal || quotation.totals?.subtotal || 0);
      const profit = totalSellPrice - totalBuyPrice;
      const profitMargin = totalBuyPrice > 0 ? ((profit / totalBuyPrice) * 100).toFixed(2) : 0;
      
      return {
        'S.No': index + 1,
        'Quote No': quotation.quote_number || quotation.quoteNo || 'N/A',
        'Date': quotation.date || quotation.createdAt?.split('T')[0] || 'N/A',
        'Company Name': quotation.company_name || quotation.billTo || 'N/A',
        'Contact Person': quotation.contact_person || quotation.contactPerson || 'N/A',
        'Contact Mobile': quotation.contact_mobile || quotation.contactMob || 'N/A',
        'Contact Email': quotation.contact_email || quotation.contactEmail || 'N/A',
        'Total Items': totalItems,
        'Ordered Items': orderedItems,
        'Not Created Items': notCreatedItems,
        'Rejected Items': rejectedItems,
        'Subtotal': parseFloat(quotation.subtotal || quotation.totals?.subtotal || 0).toFixed(2),
        'Total Discount': parseFloat(quotation.total_discount || quotation.totals?.totalDiscount || 0).toFixed(2),
        'Total Tax': parseFloat(quotation.total_tax || quotation.totals?.totalGST || 0).toFixed(2),
        'Grand Total': parseFloat(quotation.grand_total || quotation.totals?.grandTotal || 0).toFixed(2),
        'Total Buy Price': totalBuyPrice.toFixed(2),
        'Profit': profit.toFixed(2),
        'Profit Margin %': profitMargin,
        'Status': quotation.status || 'completed',
        'Created By': quotation.created_by || 'User',
        'Created At': quotation.createdAt || 'N/A'
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
    link.setAttribute('download', `completed_quotations_${exportStartDate}_to_${exportEndDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`Exported ${data.length} completed quotations to CSV successfully!`);
    setShowExportModal(false);
  };

  const exportToPDF = async () => {
    const data = await fetchExportData();
    
    if (data.length === 0) {
      return;
    }
    
    // Dynamically load jsPDF and autoTable
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    
    try {
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape mode for better table view
      let yPos = 20;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      
      // Add header
      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Completed Quotations Report', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Date Range: ${exportStartDate} to ${exportEndDate}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
      pdf.text(`Status: Completed`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;
      
      // Add summary
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Total Quotations: ${data.length}`, margin, yPos);
      yPos += 10;
      
      // Calculate totals
      const totals = {
        grandTotal: data.reduce((sum, q) => sum + parseFloat(q.grand_total || q.totals?.grandTotal || 0), 0),
        profit: data.reduce((sum, quotation) => {
          const totalBuyPrice = (quotation.items || []).reduce((s, item) => 
            s + (parseFloat(item.buy_price) || 0) * (parseFloat(item.quantity) || 1), 0);
          const totalSellPrice = parseFloat(quotation.subtotal || quotation.totals?.subtotal || 0);
          return sum + (totalSellPrice - totalBuyPrice);
        }, 0)
      };
      
      // Summary table
      const summaryData = [
        ['Total Quotations', data.length],
        ['Total Grand Total', `₹${totals.grandTotal.toFixed(2)}`],
        ['Total Estimated Profit', `₹${totals.profit.toFixed(2)}`]
      ];
      
      pdf.autoTable({
        startY: yPos,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [70, 130, 180] }, // Steel blue
        margin: { left: margin, right: margin }
      });
      
      yPos = pdf.lastAutoTable.finalY + 15;
      
      // Check if we need a new page
      if (yPos > pageHeight - 50) {
        pdf.addPage();
        yPos = 20;
      }
      
      // Main quotations table
      const tableData = data.map((quotation, index) => {
        const items = quotation.items || [];
        const orderedItems = items.filter(item => item.sales_order_item_status === "ordered").length;
        const rejectedItems = items.filter(item => item.sales_order_item_status === "rejected").length;
        
        // Calculate profit for this quotation
        const totalBuyPrice = items.reduce((sum, item) => sum + (parseFloat(item.buy_price) || 0) * (parseFloat(item.quantity) || 1), 0);
        const totalSellPrice = parseFloat(quotation.subtotal || quotation.totals?.subtotal || 0);
        const profit = totalSellPrice - totalBuyPrice;
        const profitMargin = totalBuyPrice > 0 ? ((profit / totalBuyPrice) * 100).toFixed(2) : 0;
        
        return [
          index + 1,
          quotation.quote_number || quotation.quoteNo || 'N/A',
          quotation.date || 'N/A',
          (quotation.company_name || quotation.billTo || 'N/A').substring(0, 20),
          items.length,
          orderedItems,
          rejectedItems,
          `₹${parseFloat(quotation.grand_total || quotation.totals?.grandTotal || 0).toFixed(2)}`,
          `₹${profit.toFixed(2)}`,
          `${profitMargin}%`
        ];
      });
      
      pdf.autoTable({
        startY: yPos,
        head: [
          ['S.No', 'Quote No', 'Date', 'Company', 'Items', 'Ordered', 'Rejected', 'Grand Total', 'Profit', 'Margin %']
        ],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [34, 139, 34] }, // Forest green
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 25 },
          2: { cellWidth: 20 },
          3: { cellWidth: 30 },
          4: { cellWidth: 15 },
          5: { cellWidth: 15 },
          6: { cellWidth: 15 },
          7: { cellWidth: 25 },
          8: { cellWidth: 25 },
          9: { cellWidth: 20 }
        },
        margin: { left: margin, right: margin }
      });
      
      // Add footer
      const finalY = pdf.lastAutoTable.finalY + 10;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Report generated on: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`, pageWidth / 2, finalY, { align: 'center' });
      
      // Save PDF
      pdf.save(`completed_quotations_report_${exportStartDate}_to_${exportEndDate}.pdf`);
      
      alert(`Exported ${data.length} completed quotations to PDF successfully!`);
      setShowExportModal(false);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export PDF. Please try again.");
    }
  };

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h2 mb-1">Completed Quotations</h1>
          <p className="text-muted mb-0">View completed quotations</p>
        </div>
        {/* NEW: Export Button */}
        <div>
          <Button
            variant="warning"
            onClick={() => setShowExportModal(true)}
            className="me-2"
          >
            <i className="bi bi-download me-2"></i>Export
          </Button>
        </div>
      </div>

      {/* NEW: Export Modal */}
      <Modal show={showExportModal} onHide={() => setShowExportModal(false)} size="lg">
        <Modal.Header closeButton className="bg-warning text-white">
          <Modal.Title>
            <i className="bi bi-download me-2"></i>Export Completed Quotations
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="mb-3">
            <i className="bi bi-info-circle me-2"></i>
            Select date range to export completed quotations. Data will be exported in CSV or PDF format.
            <br />
            <small className="text-muted">Note: Only completed quotations are available for export.</small>
          </Alert>
          
          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Start Date</Form.Label>
                <Form.Control
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  max={exportEndDate}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>End Date</Form.Label>
                <Form.Control
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  min={exportStartDate}
                  max={dayjs().format('YYYY-MM-DD')}
                />
              </Form.Group>
            </Col>
          </Row>
          
          <Row className="mb-3">
            <Col md={12}>
              <Form.Group>
                <Form.Label>Status</Form.Label>
                <div>
                  <Badge bg="success" className="p-2 me-2">Completed Only</Badge>
                  <small className="text-muted">(Only completed quotations are shown in this module)</small>
                </div>
              </Form.Group>
            </Col>
          </Row>
          
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Export Summary</Card.Title>
              <Row>
                <Col md={4}>
                  <div className="mb-2">
                    <strong>Date Range:</strong>
                    <div className="text-muted">{exportStartDate} to {exportEndDate}</div>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="mb-2">
                    <strong>Status:</strong>
                    <div className="text-muted">Completed</div>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="mb-2">
                    <strong>Days:</strong>
                    <div className="text-muted">
                      {dayjs(exportEndDate).diff(dayjs(exportStartDate), 'day') + 1} days
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
          
          <Alert variant="primary">
            <i className="bi bi-lightbulb me-2"></i>
            <strong>Export includes:</strong> Quote numbers, dates, company details, item counts, sales order statuses, financial totals, and profit calculations.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowExportModal(false)}>
            <i className="bi bi-x-circle me-1"></i>Cancel
          </Button>
          <Button 
            variant="success" 
            onClick={exportToExcel}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Processing...
              </>
            ) : (
              <>
                <i className="bi bi-file-earmark-excel me-1"></i>Export to Excel (CSV)
              </>
            )}
          </Button>
          <Button 
            variant="danger" 
            onClick={exportToPDF}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Processing...
              </>
            ) : (
              <>
                <i className="bi bi-file-pdf me-1"></i>Export to PDF
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Statistics Cards */}
      <Row className="mb-4">
        <Col md={12}>
          <Card>
            <Card.Body className="p-3">
              <h6 className="card-title mb-3">Completed Quotations Overview</h6>
              <div className="row">
                <Col md={12}>
                  <div className="d-flex align-items-center justify-content-center">
                    <div className="rounded-circle bg-success d-flex align-items-center justify-content-center text-white me-3" style={{ width: '60px', height: '60px' }}>
                      <i className="bi bi-check-circle display-6"></i>
                    </div>
                    <div className="text-center">
                      <div className="text-muted small">Total Completed Quotations</div>
                      <div className="h1 mb-0">{quotationCounts.completed}</div>
                    </div>
                  </div>
                </Col>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* View Quotation Modal */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="xl">
        <Modal.Header closeButton className="bg-info text-white">
          <Modal.Title>Quotation Details</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {selectedQuotation && (
            <Container>
              <div className="invoice-header border-bottom pb-3 mb-3">
                <Row>
                  <Col md={2}>
                    <img 
                      src="E:/Lakotia/lakotia/src/Components/Name1.jpg" 
                      alt="Company Logo" 
                      className="img-fluid"
                      style={{ maxWidth: '120px', maxHeight: '120px' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </Col>
                  <Col md={5}>
                    <h1 className="mb-1">{issuer.name}</h1>
                    <p className="mb-1">{issuer.address}</p>
                    <p className="mb-1">Phone: {issuer.phone} | Email: {issuer.email}</p>
                    <p className="mb-1">GSTIN: {issuer.gstin} | State: {issuer.stateCode}</p>
                  </Col>
                  <Col md={5} className="text-end">
                    <h2 className="text-info mb-3">QUOTATION</h2>
                    <p className="mb-1"><strong>Quote No:</strong> {selectedQuotation.quote_number || selectedQuotation.quoteNo}</p>
                    <p className="mb-1"><strong>Date:</strong> {selectedQuotation.date || selectedQuotation.date}</p>
                  </Col>
                </Row>
              </div>
              
              <Row className="mb-4">
                <Col md={6}>
                  <h5>Bill To:</h5>
                  <p className="mb-1"><strong>{selectedQuotation.company_name || selectedQuotation.billTo}</strong></p>
                  <p className="mb-1">{selectedQuotation.company_address || ''}</p>
                  <p className="mb-1">GSTIN: {selectedQuotation.company_gstin || ''}</p>
                </Col>
                <Col md={6}>
                  <h5>Contact Details:</h5>
                  <p className="mb-1"><strong>{selectedQuotation.contact_person || selectedQuotation.contactPerson}</strong></p>
                  <p className="mb-1">Phone: {selectedQuotation.contact_mobile || selectedQuotation.contactMob}</p>
                  <p className="mb-1">Email: {selectedQuotation.contact_email || selectedQuotation.contactEmail}</p>
                </Col>
              </Row>
              
              <Table bordered responsive>
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Item Name</th>
                    <th>Brand Code</th>
                    <th>Batch No</th>
                    <th>Cut Width (mm)</th>
                    <th>Cut Length (M)</th>
                    <th>Count</th>
                    <th>Supplier Part No</th>
                    <th>Customer Description</th>
                    <th>HSN</th>
                    <th>Qty</th>
                    <th>UoM</th>
                    <th>Price/Unit</th>
                    <th>NBP</th>
                    <th>Buy Price</th>
                    <th>GST %</th>
                    <th>Amount</th>
                    <th>Sales Order Status</th>
                    <th>Rejection Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedQuotation.items || []).map((item, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td><strong>{item.item_name}</strong></td>
                      <td>
                        {item.brand_code ? (
                          <Badge bg="primary">{item.brand_code}</Badge>
                        ) : ''}
                      </td>
                      <td>
                        {item.batch_no ? (
                          <Badge bg="secondary">{item.batch_no}</Badge>
                        ) : ''}
                      </td>
                      <td>{item.cut_width || ''}</td>
                      <td>{item.length || ''}</td>
                      <td>{item.count || ''}</td>
                      <td>{item.supplier_part_no}</td>
                      <td>{item.customer_description || ''}</td>
                      <td>{item.hsn_sac}</td>
                      <td>{item.quantity}</td>
                      <td>{item.unit}</td>
                      <td>₹{(item.price_per_unit || 0).toFixed(2)}</td>
                      <td>₹{(item.mrp || item.price_per_unit || 0).toFixed(2)}</td>
                      <td><strong className="text-success">₹{(item.buy_price || 0).toFixed(2)}</strong></td>
                      <td>{item.tax_rate || 18}%</td>
                      <td><strong>₹{(item.amount_after_discount || 0).toFixed(2)}</strong></td>
                      <td>
                        <Badge bg={getStatusBadgeColor(item.sales_order_item_status || "not_created")}>
                          {getStatusDisplayText(item.sales_order_item_status || "not_created")}
                        </Badge>
                      </td>
                      <td className="small">
                        {item.rejection_reason ? (
                          <span className="text-danger">
                            <i className="bi bi-exclamation-triangle"></i> {item.rejection_reason}
                          </span>
                        ) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              
              <Row className="mt-4">
                <Col md={7}>
                  <h5 className="mb-2">Tax Summary:</h5>
                  <Table bordered size="sm">
                    <thead className="table-light">
                      <tr>
                        <th>GST %</th>
                        <th>Taxable Amount</th>
                        <th>Tax Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const taxSummary = {};
                        (selectedQuotation.items || []).forEach(item => {
                          const taxRate = item.tax_rate || 18;
                          const taxAmount = item.tax_amount || 0;
                          if (!taxSummary[taxRate]) {
                            taxSummary[taxRate] = 0;
                          }
                          taxSummary[taxRate] += taxAmount;
                        });
                        
                        return Object.entries(taxSummary).map(([rate, amount]) => (
                          <tr key={rate}>
                            <td>{rate}%</td>
                            <td>₹{(amount / (parseFloat(rate) / 100)).toFixed(2)}</td>
                            <td>₹{amount.toFixed(2)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </Table>
                </Col>
                <Col md={5}>
                  <Card className="border-0">
                    <Card.Body>
                      <h5 className="card-title">Total Summary</h5>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Subtotal:</span>
                        <strong>₹{(selectedQuotation.subtotal || selectedQuotation.totals?.subtotal || 0).toFixed(2)}</strong>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Discount:</span>
                        <strong className="text-danger">- ₹{(selectedQuotation.total_discount || selectedQuotation.totals?.totalDiscount || 0).toFixed(2)}</strong>
                      </div>
                      {(selectedQuotation.total_packing || selectedQuotation.totals?.totalPacking || 0) > 0 && (
                        <div className="d-flex justify-content-between mb-2">
                          <span>Packing:</span>
                          <strong>₹{(selectedQuotation.total_packing || selectedQuotation.totals?.totalPacking || 0).toFixed(2)}</strong>
                        </div>
                      )}
                      {(selectedQuotation.total_other || selectedQuotation.totals?.totalOther || 0) > 0 && (
                        <div className="d-flex justify-content-between mb-2">
                          <span>Other Charges:</span>
                          <strong>₹{(selectedQuotation.total_other || selectedQuotation.totals?.totalOther || 0).toFixed(2)}</strong>
                        </div>
                      )}
                      <div className="d-flex justify-content-between mb-2">
                        <span>Total Tax:</span>
                        <strong>₹{(selectedQuotation.total_tax || selectedQuotation.totals?.totalGST || 0).toFixed(2)}</strong>
                      </div>
                      <hr/>
                      <div className="d-flex justify-content-between total-row">
                        <span>Grand Total:</span>
                        <strong className="text-primary">₹{(selectedQuotation.grand_total || selectedQuotation.totals?.grandTotal || 0).toFixed(2)}</strong>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Container>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewModal(false)}>
            <i className="bi bi-x-circle me-1"></i>Close
          </Button>
          <Button variant="primary" onClick={() => printQuotation(selectedQuotation)}>
            <i className="bi bi-printer me-1"></i>Print
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Saved Quotations Section */}
      <Card>
        <Card.Header className="bg-light">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              Completed Quotations 
              <span className="ms-2">
                <Badge bg="success">Total: {totalItems}</Badge>
                {searchTerm && (
                  <Badge bg="info" className="ms-1">Search Results: {savedQuotations.length}</Badge>
                )}
              </span>
            </h5>
            <div className="d-flex gap-2">
              <InputGroup size="sm" style={{ width: '250px' }}>
                <FormControl
                  placeholder="Search completed quotations..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {searchTerm && (
                  <Button variant="outline-danger" onClick={resetSearch} title="Clear search">
                    <i className="bi bi-x-circle"></i>
                  </Button>
                )}
              </InputGroup>
              <Button variant="outline-primary" size="sm" onClick={fetchQuotations} disabled={loadingQuotations} title="Refresh">
                <i className="bi bi-arrow-clockwise"></i>
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {loadingQuotations ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Loading completed quotations...</p>
            </div>
          ) : savedQuotations.length > 0 ? (
            <>
              <Table hover responsive className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th width="50">#</th>
                    <th width="70"></th>
                    <th>Quote No</th>
                    <th>Date</th>
                    <th>Company</th>
                    <th>Contact Person</th>
                    <th>Items</th>
                    <th>Sales Order Status</th>
                    <th>Grand Total</th>
                    <th>Quotation Status</th>
                    <th width="120">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedQuotations.map((quote, index) => {
                    const notCreatedItems = (quote.items || []).filter(item => 
                      (item.sales_order_item_status || "not_created") === "not_created").length;
                    const orderedItems = (quote.items || []).filter(item => 
                      item.sales_order_item_status === "ordered").length;
                    const rejectedItems = (quote.items || []).filter(item => 
                      item.sales_order_item_status === "rejected").length;
                    const isExpanded = expandedRows[quote.id];
                    
                    return (
                      <React.Fragment key={quote.id || index}>
                        {/* Main Row */}
                        <tr className={isExpanded ? "table-primary" : ""}>
                          <td>{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                          <td>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => toggleRowExpansion(quote.id)}
                              className="p-0"
                            >
                              <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                            </Button>
                          </td>
                          <td>
                            <strong>{quote.quote_number || quote.quoteNo}</strong>
                          </td>
                          <td>
                            {quote.date || quote.date}
                          </td>
                          <td>
                            {quote.company_name || quote.billTo}<br/>
                            <small className="text-muted">{quote.contact_email || quote.contactEmail}</small>
                          </td>
                          <td>
                            {quote.contact_person || quote.contactPerson}<br/>
                            <small className="text-muted">{quote.contact_mobile || quote.contactMob}</small>
                          </td>
                          <td>{(quote.items || []).length} items</td>
                          <td>
                            <div className="d-flex flex-column">
                              {orderedItems > 0 && (
                                <Badge bg="info" className="mb-1">{orderedItems} ordered</Badge>
                              )}
                              {notCreatedItems > 0 && (
                                <Badge bg="secondary" className="mb-1">{notCreatedItems} not created</Badge>
                              )}
                              {rejectedItems > 0 && (
                                <Badge bg="danger">{rejectedItems} rejected</Badge>
                              )}
                            </div>
                          </td>
                          <td>
                            <strong className="text-primary">
                              ₹{((quote.grand_total || quote.totals?.grandTotal) || 0).toFixed(2)}
                            </strong>
                          </td>
                          <td>
                            <Badge bg="success">
                              {quote.status || 'completed'}
                            </Badge>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <Button
                                variant="outline-info"
                                onClick={() => viewQuotation(quote)}
                                title="View Details"
                              >
                                <i className="bi bi-eye"></i>
                              </Button>
                              <Button
                                variant="outline-primary"
                                onClick={() => printQuotation(quote)}
                                title="Print"
                              >
                                <i className="bi bi-printer"></i>
                              </Button>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded Row for Items */}
                        {isExpanded && (
                          <tr>
                            <td colSpan="11" className="p-0">
                              <Collapse in={isExpanded}>
                                <div className="p-3 bg-light border-top">
                                  <h6 className="mb-3">
                                    <i className="bi bi-list-check me-2"></i>
                                    Items in Quotation #{quote.quote_number || quote.quoteNo}
                                  </h6>
                                  
                                  <Table bordered hover size="sm" className="mb-0">
                                    <thead className="table-secondary">
                                      <tr>
                                        <th width="50">#</th>
                                        <th>Item Name</th>
                                        <th>Brand Code</th>
                                        <th>Batch No</th>
                                        <th>Part No</th>
                                        <th>Qty</th>
                                        <th>Unit</th>
                                        <th>Price/Unit</th>
                                        <th>NBP</th>
                                        <th>Buy Price</th>
                                        <th>Amount</th>
                                        <th width="120">Sales Order Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(quote.items || []).map((item, itemIndex) => (
                                        <tr key={item.id || itemIndex}>
                                          <td>{itemIndex + 1}</td>
                                          <td>
                                            <div className="fw-bold">{item.item_name}</div>
                                            <small className="text-muted">{item.description?.substring(0, 60)}...</small>
                                          </td>
                                          <td>
                                            {item.brand_code ? (
                                              <Badge bg="primary">{item.brand_code}</Badge>
                                            ) : 'N/A'}
                                          </td>
                                          <td>
                                            {item.batch_no ? (
                                              <Badge bg="secondary">{item.batch_no}</Badge>
                                            ) : 'N/A'}
                                          </td>
                                          <td>{item.supplier_part_no || 'N/A'}</td>
                                          <td>{item.quantity || 1}</td>
                                          <td>{item.unit || 'pcs'}</td>
                                          <td>₹{(item.price_per_unit || 0).toFixed(2)}</td>
                                          <td>₹{(item.mrp || item.price_per_unit || 0).toFixed(2)}</td>
                                          <td>
                                            <strong className="text-success">
                                              ₹{(item.buy_price || 0).toFixed(2)}
                                            </strong>
                                          </td>
                                          <td>
                                            <strong>₹{(item.amount_after_discount || 0).toFixed(2)}</strong>
                                          </td>
                                          <td>
                                            <Badge bg={getStatusBadgeColor(item.sales_order_item_status || "not_created")}>
                                              {getStatusDisplayText(item.sales_order_item_status || "not_created")}
                                            </Badge>
                                            {item.rejection_reason && (
                                              <div className="small text-danger mt-1">
                                                <i className="bi bi-exclamation-triangle"></i> {item.rejection_reason}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="table-light">
                                      <tr>
                                        <td colSpan="10" className="text-end fw-bold">Subtotal:</td>
                                        <td colSpan="2" className="fw-bold">
                                          ₹{((quote.subtotal || quote.totals?.subtotal) || 0).toFixed(2)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </Table>
                                  
                                  <div className="mt-3 d-flex justify-content-between align-items-center">
                                    <div className="text-muted small">
                                      View-only mode - No editing allowed
                                    </div>
                                    <Button
                                      variant="outline-secondary"
                                      size="sm"
                                      onClick={() => toggleRowExpansion(quote.id)}
                                    >
                                      <i className="bi bi-chevron-up me-1"></i> Collapse
                                    </Button>
                                  </div>
                                </div>
                              </Collapse>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
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
                <i className="bi bi-file-earmark-check display-1 text-muted"></i>
              </div>
              <h5 className="text-muted">No completed quotations found</h5>
              <p className="text-muted">
                {searchTerm ? 'Try a different search term' : 'There are no completed quotations available.'}
              </p>
            </div>
          )}
        </Card.Body>
      </Card> 
    </Container>
  );
}