import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import dayjs from "dayjs";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { API_BASE } from "../config";


// Bootstrap CSS and Icons
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

export default function QuotationModal() {
  const idRef = useRef(1000);

  // Helper to create item
  function createEmptyItem(seq) {
    idRef.current += 1;
    return {
      id: idRef.current,
      item_name: "",
      hsn_sac: "",
      supplier_part_no: "",
      description: "",
      cut_width: 1,
      length: 1,
      count: 1,
      batch_no: `B-${Date.now().toString().slice(-6)}-${seq}`,
      mrp: 0,
      buy_price: 0,
      quantity: 1,
      unit: "pcs",
      profit_percentage: 20,
      packing_charges: 0,
      freight_charges: 0,
      customer_description: "",
      brand_code: ""
    };
  }

  // Current action mode
  const [actionMode, setActionMode] = useState('view');
  const [currentQuotationId, setCurrentQuotationId] = useState(null);

  // Quote metadata
  const [quoteNo, setQuoteNo] = useState("");
  const [date] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [time] = useState(() => dayjs().format("HH:mm:ss"));

  // Issuer static details - UPDATED ADDRESS
  const issuer = {
    name: "Lakhotia Enterprise",
    address: "64/3A Sidco Industrial Estate (N.P), 9th Street, Ambattur, Chennai 600 098, INDIA",
    phone: "+91 44 26251033",
    website: "www.lakhotia.in",
    email: "vivek@lakhotia.net",
    gstin: "33AABFL9981E1Z7",
    stateCode: "33-Tamil Nadu",
    placeOfSupply: "33-Tamil Nadu",
    bankDetails: {
      accountNo: "12378630000183",
      accountTitle: "LAKHOTIA ENTERPRISE",
      ifscCode: "HDFC0001237"
    }
  };

  // Logo and QR code paths
  const companyLogo = "/Asset/Name1.jpg";
  const qrCodeImage = "/Asset/lakhotia qr code.png";

  // State variables
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [companyError, setCompanyError] = useState(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [billTo, setBillTo] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactMob, setContactMob] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactEmailSame, setContactEmailSame] = useState(false);
  const [notes, setNotes] = useState("");
  const [requoteNote, setRequoteNote] = useState("");

  // Company search dropdown state
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [filteredCompanies, setFilteredCompanies] = useState([]);

  // Items state
  const [items, setItems] = useState(() => []);

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
  const [newItemCount, setNewItemCount] = useState("1");
  const [newItemQuantity, setNewItemQuantity] = useState("1");
  const [newItemBatchCode, setNewItemBatchCode] = useState("");
  const [availableBatchCodes, setAvailableBatchCodes] = useState([]);
  const [newItemProfitPercentage, setNewItemProfitPercentage] = useState("20");
  const [newItemPackingCharges, setNewItemPackingCharges] = useState("0");
  const [newItemFreightCharges, setNewItemFreightCharges] = useState("0");
  const [newItemCustomerDescription, setNewItemCustomerDescription] = useState("");
  const [newItemSupplierPartNo, setNewItemSupplierPartNo] = useState("");
  const [newItemBrandCode, setNewItemBrandCode] = useState("");

  // Quotation level charges & tax states
  const [quotationPacking, setQuotationPacking] = useState("0");
  const [quotationFreight, setQuotationFreight] = useState("0");
  const [quotationGstRate, setQuotationGstRate] = useState("18");

  // View quotation modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  // Modal states for multi-step flow
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Saved quotations state
  const [savedQuotations, setSavedQuotations] = useState([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  // Statistics
  const [statistics, setStatistics] = useState(null);

  // Stock cache for buy prices
  const [stockCache, setStockCache] = useState({});

  // DOM ref for quotation content
  const quotationRef = useRef(null);

  // API base URL
  // Removed hardcoded API_BASE_URL


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

  // Fetch saved quotations from backend on component mount
  useEffect(() => {
    fetchQuotations();
    fetchStatistics();
  }, [currentPage, searchTerm]);

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const response = await axios.get(`${API_BASE}/quotations/statistics`);
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (err) {
      console.error("Error loading statistics:", err);
    }
  };

  // Fetch saved quotations with pagination
  const fetchQuotations = async () => {
    setLoadingQuotations(true);
    try {
      const params = {
        page: currentPage,
        per_page: itemsPerPage
      };

      if (searchTerm.trim()) {
        params.q = searchTerm.trim();
      }

      const response = await axios.get(`${API_BASE}/quotations`, {
        params
      });

      if (response.data.success) {
        const fetchedQuotations = response.data.data || [];
        const pagination = response.data.pagination || {};

        const allBrandCodes = [];
        fetchedQuotations.forEach(quotation => {
          (quotation.items || []).forEach(item => {
            const brandCode = extractBrandCode(item.description || "");
            if (brandCode) {
              allBrandCodes.push(brandCode);
            }
          });
        });

        const buyPriceMap = await fetchBulkBuyPrices([...new Set(allBrandCodes)]);

        const transformedQuotations = fetchedQuotations.map(quotation => {
          const transformedItems = (quotation.items || []).map(item => {
            const brandCode = extractBrandCode(item.description || "");
            const customerDescription = extractCustomerDescription(item.description || "");
            const cleanDesc = cleanDescription(item.description || "");

            const buyPrice = brandCode ? (buyPriceMap[brandCode] || 0) : 0;

            return {
              ...item,
              brand_code: brandCode || "",
              customer_description: customerDescription || "",
              description: cleanDesc,
              buy_price: buyPrice,
              count: item.count || 1,
              packing_charges: item.packing_charges || 0,
              freight_charges: item.freight_charges || 0,
              profit_percentage: item.profit_percentage || 20
            };
          });

          return {
            ...quotation,
            items: transformedItems
          };
        });

        setSavedQuotations(transformedQuotations);
        setTotalItems(pagination.total || fetchedQuotations.length);
        setTotalPages(pagination.pages || Math.ceil((pagination.total || fetchedQuotations.length) / itemsPerPage) || 1);
      } else {
        throw new Error(response.data.message || "API response unsuccessful");
      }
    } catch (err) {
      console.error("Error loading quotations from API:", err);
      loadFromLocalStorage();
    } finally {
      setLoadingQuotations(false);
    }
  };

  // Load from localStorage with pagination
  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem("savedQuotations");
    if (saved) {
      try {
        const allQuotations = JSON.parse(saved);

        allQuotations.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.date || 0);
          const dateB = new Date(b.createdAt || b.date || 0);
          return dateB - dateA;
        });

        let filteredData = allQuotations;
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          filteredData = allQuotations.filter(quote => {
            const quoteNo = (quote.quote_number || quote.quoteNo || "").toLowerCase();
            const companyName = (quote.company_name || quote.billTo || "").toLowerCase();
            const contactPersonName = (quote.contact_person || quote.contactPerson || "").toLowerCase();
            const contactEmail = (quote.contact_email || quote.contactEmail || "").toLowerCase();

            return quoteNo.includes(term) ||
              companyName.includes(term) ||
              contactPersonName.includes(term) ||
              contactEmail.includes(term);
          });
        }

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        setSavedQuotations(paginatedData);
        setTotalItems(filteredData.length);
        setTotalPages(Math.ceil(filteredData.length / itemsPerPage));
      } catch (e) {
        console.error("Error loading from localStorage:", e);
        setSavedQuotations([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } else {
      setSavedQuotations([]);
      setTotalItems(0);
      setTotalPages(1);
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
        const response = await axios.get(`${API_BASE}/company`, {
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

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
        } else {
          setCompanies([]);
          setCompanyError("No companies found in database.");
        }

      } catch (err) {
        console.error("Fetch companies failed:", err);

        const mockCompanies = [
          {
            id: 1,
            company_name: "ABC Corporation",
            company_address: "123 Main St, Chennai",
            gstin: "33AAAAA0000A1Z5",
            customer_name: "John Doe",
            customer_mobile: "9876543210",
            customer_email: "john@abccorp.com"
          }
        ];

        setCompanies(mockCompanies);
        setCompanyError("Using mock data. API Error: " + (err.message || "Connection failed"));
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
        const response = await axios.get(`${API_BASE}/stock/all`, {
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

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
          const mockStock = [
            {
              "id": 1,
              "Item Name": "Premium Cutter Blade",
              "Brand": "Bosch",
              "Brand Code": "BOS-PCB-001",
              "Brand Description": "High precision cutting blade for metal",
              "HSN": "84659310",
              "Batch Code": "BATCH-2024-001",
              "MRP": 1250.00,
              "Buy Price": 850.00,
              "Width": 10,
              "Length": 200,
              "Unit": "pcs",
              "GST": 18.0
            }
          ];

          setStockItems(mockStock);
          setStockError("Using mock stock data. Real API failed.");
        }

      } catch (err) {
        console.error("Fetch stock failed:", err);

        const mockStock = [
          {
            "id": 1,
            "Item Name": "Premium Cutter Blade",
            "Brand": "Bosch",
            "Brand Code": "BOS-PCB-001",
            "Brand Description": "High precision cutting blade for metal",
            "HSN": "84659310",
            "Batch Code": "BATCH-2024-001",
            "MRP": 1250.00,
            "Buy Price": 850.00,
            "Width": 10,
            "Length": 200,
            "Unit": "pcs",
            "GST": 18.0
          }
        ];

        setStockItems(mockStock);
        setStockError("Using mock stock data. API Error: " + (err.message || "Connection failed"));
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
      const companyName = (company.company_name || company.companyName || "").toLowerCase();
      const customerName = (company.customer_name || company.customerName || "").toLowerCase();
      const customerMobile = (company.customer_mobile || company.customerMobile || "").toString().toLowerCase();
      const companyGst = (company.gstin || company.gst_no || "").toLowerCase();
      const companyAddress = (company.company_address || company.companyAddress || "").toLowerCase();

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
    setContactMob(mobile);

    if (mobile.length >= 10) {
      const foundCompany = companies.find(company => {
        const customerMobile = (company.customer_mobile || company.customerMobile || "").toString();
        return customerMobile.includes(mobile) || mobile.includes(customerMobile);
      });

      if (foundCompany) {
        selectCompanyFromSearch(foundCompany);
      }
    }
  };

  // Select company from search results
  const selectCompanyFromSearch = (company) => {
    const companyId = company.id || company.ID || company.company_id || "";
    const companyName = company.company_name || company.companyName || "";
    const companyAddr = company.company_address || company.companyAddress || "";
    const companyGst = company.gstin || company.gst_no || company.company_gstin || "";
    const customerName = company.customer_name || company.customerName || company.contact_person || "";
    const customerMobile = company.customer_mobile || company.customerMobile || company.contact_mobile || "";
    const customerEmail = company.customer_email || company.customerEmail || company.contact_email || "";

    setSelectedCompanyId(companyId.toString());
    setSelectedCompany(company);
    setBillTo(companyName);
    setCompanyAddress(companyAddr);
    setCompanyGstin(companyGst);
    setContactPerson(customerName);
    setContactMob(customerMobile);
    if (!contactEmailSame) {
      setContactEmail(customerEmail);
    }

    setShowCompanyDropdown(false);
    setFilteredCompanies([]);
  };

  // When company selected from dropdown, autofill data
  useEffect(() => {
    if (!selectedCompanyId) return;

    const company = companies.find(c => {
      const id = c.id || c.ID || c.company_id;
      return id && id.toString() === selectedCompanyId.toString();
    });

    if (!company) return;

    setSelectedCompany(company);
    const companyName = company.company_name || company.companyName || "";
    const companyAddr = company.company_address || company.companyAddress || "";
    const companyGst = company.gstin || company.gst_no || "";
    const customerName = company.customer_name || company.customerName || "";
    const customerMobile = company.customer_mobile || company.customerMobile || "";
    const customerEmail = company.customer_email || company.customerEmail || "";

    setBillTo(companyName);
    setCompanyAddress(companyAddr);
    setCompanyGstin(companyGst);
    setContactPerson(customerName);
    setContactMob(customerMobile);
    if (!contactEmailSame) {
      setContactEmail(customerEmail);
    }

  }, [selectedCompanyId, companies, contactEmailSame]);

  // Handle contact email same toggle
  useEffect(() => {
    if (contactEmailSame) {
      setContactEmail(issuer.email);
    }
  }, [contactEmailSame]);

  // Start editing a quotation
  const startEditQuotation = async (quotation) => {
    if (!quotation) return;
    if (quotation.status && quotation.status.toLowerCase() === 'completed') {
      alert("Completed quotations are non-editable.");
      return;
    }
    setActionMode('edit');
    setCurrentQuotationId(quotation.id);

    let fullQuotation = quotation;
    if (quotation.id) {
      try {
        const res = await axios.get(`${API_BASE}/quotations/${quotation.id}`);
        if (res.data && res.data.success && res.data.data) {
          fullQuotation = res.data.data;
        }
      } catch (e) {
        console.warn("Could not fetch full quotation details for edit, using row object:", e);
      }
    }

    const brandCodes = [];
    (fullQuotation.items || []).forEach(item => {
      const brandCode = extractBrandCode(item.description || "");
      if (brandCode) {
        brandCodes.push(brandCode);
      }
    });

    const buyPriceMap = await fetchBulkBuyPrices([...new Set(brandCodes)]);

    setQuoteNo(fullQuotation.quote_number || fullQuotation.quoteNo || "");
    setSelectedCompanyId(fullQuotation.company_id || "");
    setBillTo(fullQuotation.company_name || fullQuotation.billTo || "");
    setCompanyAddress(fullQuotation.company_address || "");
    setCompanyGstin(fullQuotation.company_gstin || "");
    setContactPerson(fullQuotation.contact_person || fullQuotation.contactPerson || "");
    setContactMob(fullQuotation.contact_mobile || fullQuotation.contactMob || "");
    setContactEmail(fullQuotation.contact_email || fullQuotation.contactEmail || "");
    setNotes(fullQuotation.notes || "");
    setRequoteNote(fullQuotation.requote_note || "");

    const itemsPacking = (fullQuotation.items || []).reduce((sum, i) => sum + (parseFloat(i.packing_charges) || 0), 0);
    const itemsFreight = (fullQuotation.items || []).reduce((sum, i) => sum + (parseFloat(i.freight_charges) || 0), 0);

    const packingVal = fullQuotation.total_packing !== undefined && fullQuotation.total_packing !== null
      ? fullQuotation.total_packing
      : (fullQuotation.totals?.totalPacking ?? itemsPacking ?? 0);

    const freightVal = fullQuotation.total_freight !== undefined && fullQuotation.total_freight !== null
      ? fullQuotation.total_freight
      : (fullQuotation.totals?.totalFreight ?? itemsFreight ?? 0);

    const gstVal = (fullQuotation.items?.[0]?.tax_rate !== undefined && fullQuotation.items?.[0]?.tax_rate !== null)
      ? fullQuotation.items[0].tax_rate
      : (fullQuotation.tax_rate ?? fullQuotation.taxRate ?? 18);

    setQuotationPacking(packingVal.toString());
    setQuotationFreight(freightVal.toString());
    setQuotationGstRate(gstVal.toString());

    const loadedItems = (fullQuotation.items || []).map(item => {
      const brandCode = extractBrandCode(item.description || "");
      const customerDescription = extractCustomerDescription(item.description || "");
      const cleanDesc = cleanDescription(item.description || "");

      const buyPrice = brandCode ? (buyPriceMap[brandCode] || 0) : 0;

      return {
        ...item,
        id: item.id || Date.now() + Math.random(),
        brand_code: brandCode || "",
        customer_description: customerDescription || "",
        description: cleanDesc,
        buy_price: buyPrice,
        count: item.count || 1,
        discount: item.discount ?? 0,
        discount_type: item.discount_type || "amount",
        tax_rate: item.tax_rate ?? gstVal,
        packing_charges: item.packing_charges || 0,
        freight_charges: item.freight_charges || 0,
        profit_percentage: item.profit_percentage ?? 20
      };
    });
    setItems(loadedItems);

    setShowCompanyModal(true);
  };

  // Create re-quote
  const startCreateReQuote = async (quotation) => {
    try {
      const requoteNote = prompt(
        "Enter re-quote reason:",
        `Re-quote created on ${new Date().toLocaleDateString()}`
      );

      if (!requoteNote) {
        alert("Re-quote cancelled!");
        return;
      }

      const originalQuoteNumber = quotation.quote_number || quotation.quoteNo || "";
      let newQuoteNumber = "";

      if (originalQuoteNumber.includes('-R')) {
        const parts = originalQuoteNumber.split('-R');
        if (parts.length > 1) {
          const base = parts[0];
          const currentCount = parseInt(parts[1]) || 0;
          newQuoteNumber = `${base}-R${currentCount + 1}`;
        } else {
          newQuoteNumber = `${originalQuoteNumber}-R1`;
        }
      } else {
        newQuoteNumber = `${originalQuoteNumber}-R1`;
      }

      const updateData = {
        quote_number: newQuoteNumber,
        requote_note: requoteNote,
        status: "requote",
        updated_by: "User"
      };

      const response = await axios.put(`${API_BASE}/quotations/${quotation.id}`, updateData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        alert(`✅ Quotation updated to re-quote!\nNew Quote Number: ${newQuoteNumber}`);
        await fetchQuotations();
        await fetchStatistics();
      } else {
        throw new Error(response.data.message || "Failed to update quotation");
      }

    } catch (error) {
      console.error("Error creating re-quote:", error);
      alert("Failed to create re-quote. Please try again.");
    }
  };

  // Create new quotation
  const startNewQuotation = () => {
    setActionMode('create');
    setCurrentQuotationId(null);

    setItems([]);
    setSelectedCompanyId("");
    setSelectedCompany(null);
    setBillTo("");
    setCompanyAddress("");
    setCompanyGstin("");
    setContactPerson("");
    setContactMob("");
    setContactEmail("");
    setContactEmailSame(false);
    setNotes("");
    setRequoteNote("");
    setQuotationPacking("0");
    setQuotationFreight("0");
    setQuotationGstRate("18");

    setFilteredCompanies([]);
    setShowCompanyDropdown(false);

    setShowItemPopup(false);
    setItemSearchTerm("");
    setSearchResults([]);
    setShowResults(false);
    setSelectedStockItem(null);
    setNewItemCutWidth("");
    setNewItemLength("");
    setNewItemCount("1");
    setNewItemQuantity("1");
    setNewItemBatchCode("");
    setAvailableBatchCodes([]);
    setNewItemProfitPercentage("20");
    setNewItemPackingCharges("0");
    setNewItemFreightCharges("0");
    setNewItemCustomerDescription("");
    setNewItemSupplierPartNo("");
    setNewItemBrandCode("");

    setQuoteNo(`Q-${Date.now().toString().slice(-8)}`);

    setShowCompanyModal(true);
  };

  // Handle item field changes
  function handleItemChange(index, field, value) {
    setItems(prevItems => {
      const updatedItems = [...prevItems];
      let newValue = value;

      if (["cut_width", "length", "count", "mrp", "buy_price", "quantity", "profit_percentage", "packing_charges", "freight_charges"].includes(field)) {
        newValue = parseFloat(value) || 0;
      }

      updatedItems[index] = {
        ...updatedItems[index],
        [field]: newValue
      };

      if (["cut_width", "length", "quantity"].includes(field)) {
        const width = updatedItems[index].cut_width || 1;
        const length = updatedItems[index].length || 1;
        const quantity = updatedItems[index].quantity || 1;
        updatedItems[index].count = parseFloat((width * length * quantity).toFixed(2)) || 1;
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

  // UPDATED CALCULATIONS
  const getProfitPercentage = (item) => {
    if (item && item.profit_percentage !== undefined && item.profit_percentage !== null && item.profit_percentage !== "") {
      const val = parseFloat(item.profit_percentage);
      return isNaN(val) ? 0 : val;
    }
    return 20;
  };

  const getTaxRate = (item, defaultGstRate) => {
    if (item && item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== "") {
      const val = parseFloat(item.tax_rate);
      return isNaN(val) ? 0 : val;
    }
    if (defaultGstRate !== undefined && defaultGstRate !== null && defaultGstRate !== "") {
      const val = parseFloat(defaultGstRate);
      return isNaN(val) ? 0 : val;
    }
    return 18;
  };

  const basePrice = (item) => {
    const mrp = parseFloat(item.mrp) || 0;
    const length = parseFloat(item.length) || 0;
    const width = parseFloat(item.cut_width) || 0;
    return mrp * length * width;
  };

  const profitAmount = (item) => {
    const base = basePrice(item);
    const profitPercent = getProfitPercentage(item);
    return base * (profitPercent / 100);
  };

  const pricePerUnit = (item) => {
    const base = basePrice(item);
    const profit = profitAmount(item);
    const priceWithProfit = base + profit;
    const discount = parseFloat(item.discount) || 0;

    let discountAmount = 0;
    if (item.discount_type === "percentage") {
      discountAmount = priceWithProfit * (discount / 100);
    } else {
      discountAmount = discount;
    }

    const price = priceWithProfit - discountAmount;
    return parseFloat(price.toFixed(2)) || 0;
  };

  const calculateTotal = (item) => {
    // Subtotal = Price/Unit * Quantity
    const pricePerUnitValue = pricePerUnit(item);
    const quantity = parseFloat(item.quantity) || 0;
    return parseFloat((pricePerUnitValue * quantity).toFixed(2)) || 0;
  };

  const calculateGrandTotal = (item) => {
    // Subtotal + Packing + Freight
    const subtotal = calculateTotal(item);
    const packing = parseFloat(item.packing_charges) || 0;
    const freight = parseFloat(item.freight_charges) || 0;
    return parseFloat((subtotal + packing + freight).toFixed(2));
  };

  const calculateItemTotal = (item) => {
    return calculateGrandTotal(item);
  };

  const calculateProfitAmount = (item) => {
    return parseFloat(profitAmount(item).toFixed(2));
  };

  const calculateTotalProfit = () => {
    return items.reduce((total, item) => {
      return total + (calculateProfitAmount(item) * (parseFloat(item.quantity) || 1));
    }, 0);
  };

  const calculateGSTAmount = (item) => {
    const grandTotal = calculateGrandTotal(item);
    const taxRate = getTaxRate(item, quotationGstRate);
    const gst = grandTotal * (taxRate / 100);
    return parseFloat(gst.toFixed(2));
  };

  const calculateTotalGST = () => {
    return items.reduce((sum, item) => sum + calculateGSTAmount(item), 0);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + calculateTotal(item), 0);
    const totalProfit = calculateTotalProfit();
    const itemPacking = items.reduce((sum, item) => sum + (parseFloat(item.packing_charges) || 0), 0);
    const itemFreight = items.reduce((sum, item) => sum + (parseFloat(item.freight_charges) || 0), 0);

    const packingVal = quotationPacking !== "" && quotationPacking !== null && quotationPacking !== undefined
      ? (parseFloat(quotationPacking) || 0)
      : itemPacking;

    const freightVal = quotationFreight !== "" && quotationFreight !== null && quotationFreight !== undefined
      ? (parseFloat(quotationFreight) || 0)
      : itemFreight;

    const gstRateVal = quotationGstRate !== "" && quotationGstRate !== null && quotationGstRate !== undefined
      ? (parseFloat(quotationGstRate) ?? 0)
      : (items[0] && items[0].tax_rate !== undefined && items[0].tax_rate !== null && items[0].tax_rate !== "" ? parseFloat(items[0].tax_rate) : 18);

    const taxable = subtotal + packingVal + freightVal;
    const totalGST = Math.round(taxable * (gstRateVal / 100));
    const grandTotalWithGST = Math.round(taxable + totalGST);

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalPricePerUnit: parseFloat(items.reduce((sum, item) => sum + pricePerUnit(item), 0).toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      totalPacking: parseFloat(packingVal.toFixed(2)),
      totalFreight: parseFloat(freightVal.toFixed(2)),
      grandTotal: parseFloat(taxable.toFixed(2)),
      totalBuyCost: parseFloat(items.reduce((sum, item) => sum + ((parseFloat(item.mrp) || 0) * (parseFloat(item.cut_width) || 0) * (parseFloat(item.length) || 0) * (parseFloat(item.quantity) || 1)), 0).toFixed(2)),
      totalGST: parseFloat(totalGST.toFixed(2)),
      grandTotalWithGST: parseFloat(grandTotalWithGST.toFixed(2)),
      profitMargin: 0
    };
  };

  // Export to PDF
  async function exportPdf() {
    if (!quotationRef.current) {
      alert("Quotation content not found!");
      return;
    }

    try {
      const element = quotationRef.current;
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
      pdf.save(`${quoteNo}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF. See console for details.");
    }
  }

  // Save or Update quotation to backend
  async function saveOrUpdateQuotation() {
    if (!selectedCompanyId) {
      alert("Please select a company first!");
      return;
    }

    if (!billTo.trim()) {
      alert("Please enter Bill To information!");
      return;
    }

    if (items.length === 0) {
      alert("Please add at least one item!");
      return;
    }

    const isUpdate = actionMode === 'edit' && currentQuotationId;

    if (isUpdate) {
      setUpdating(true);
    } else {
      setSaving(true);
    }

    const totals = calculateTotals();

    const preparedItems = items.map(item => {
      const enhancedDescription = [
        item.description || "",
        item.customer_description ? `[CUSTOMER_DESC:${item.customer_description}]` : "",
        item.brand_code ? `[BRAND_CODE:${item.brand_code}]` : ""
      ]
        .filter(part => part.trim() !== "")
        .join(" ");

      return {
        id: (item.id && typeof item.id === 'number' && item.id < 1000000000) ? item.id : undefined,
        item_name: item.item_name,
        hsn_sac: item.hsn_sac,
        supplier_part_no: item.supplier_part_no || item.brand_code || "",
        customer_part_no: item.customer_part_no || "",
        description: enhancedDescription,
        customer_description: item.customer_description || "",
        cut_width: item.cut_width,
        length: item.length,
        batch_no: item.batch_no,
        mrp: item.mrp,
        buy_price: item.buy_price || 0,
        quantity: item.quantity,
        unit: item.unit,
        discount: item.discount ?? 0,
        discount_type: item.discount_type || "amount",
        profit_percentage: (item.profit_percentage !== undefined && item.profit_percentage !== null && item.profit_percentage !== "") ? parseFloat(item.profit_percentage) : 20,
        tax_rate: (item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== "") ? parseFloat(item.tax_rate) : (quotationGstRate !== "" ? parseFloat(quotationGstRate) : 18),
        packing_charges: item.packing_charges || 0,
        freight_charges: item.freight_charges || 0,
        price_per_unit: pricePerUnit(item),
        total: calculateTotal(item),
        grand_total: calculateGrandTotal(item),
        tax_amount: calculateGSTAmount(item),
        item_total: calculateItemTotal(item) + calculateGSTAmount(item)
      };
    });

    const quotationData = {
      quote_number: quoteNo,
      date: date,
      time: time,
      issuer_details: issuer,
      company_id: selectedCompanyId,
      company_name: billTo,
      company_address: companyAddress,
      company_gstin: companyGstin,
      contact_person: contactPerson,
      contact_mobile: contactMob,
      contact_email: contactEmail,
      total_price_per_unit: totals.totalPricePerUnit,
      total_profit: totals.totalProfit,
      total_packing: totals.totalPacking,
      total_freight: totals.totalFreight,
      total_tax: totals.totalGST,
      grand_total: totals.grandTotal,
      grand_total_with_gst: totals.grandTotalWithGST,
      notes: notes || `Please process this quote as per the terms mentioned.\nAll prices are in INR.\nDelivery within 7-10 business days.`,
      requote_note: requoteNote,
      status: actionMode === 'edit' ? "draft" : "draft",
      items: preparedItems,
      created_by: "User",
      updated_by: "User"
    };

    try {
      if (isUpdate) {
        const response = await axios.put(`${API_BASE}/quotations/${currentQuotationId}`, quotationData, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.data.success) {
          alert(`✅ Quotation updated successfully!\n\nQuote: ${quoteNo}\nCompany: ${billTo}\nGrand Total: ₹${totals.grandTotalWithGST}`);

          await fetchQuotations();
          await fetchStatistics();

          setShowPreviewModal(false);
          setShowCompanyModal(false);
          setShowItemsModal(false);
          setActionMode('view');
        } else {
          throw new Error(response.data.message || "Failed to update quotation");
        }
      } else {
        const response = await axios.post(`${API_BASE}/quotations`, quotationData, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.data.success) {
          alert(`✅ Quotation saved successfully!\n\nQuote: ${quoteNo}\nCompany: ${billTo}\nGrand Total: ₹${totals.grandTotalWithGST}`);

          await fetchQuotations();
          await fetchStatistics();

          setShowPreviewModal(false);
          setShowCompanyModal(false);
          setShowItemsModal(false);
          setActionMode('view');
        } else {
          throw new Error(response.data.message || 'Failed to save quotation');
        }
      }

    } catch (err) {
      console.error("Save/Update quotation failed:", err);

      const quotationToSave = {
        ...quotationData,
        id: isUpdate ? currentQuotationId : Date.now(),
        quoteNo: quoteNo,
        billTo: billTo,
        contactPerson: contactPerson,
        contactMob: contactMob,
        contactEmail: contactEmail,
        totals: totals,
        items: items.map(item => ({
          ...item,
          price_per_unit: pricePerUnit(item),
          total: calculateTotal(item),
          grand_total: calculateGrandTotal(item),
          tax_amount: calculateGSTAmount(item),
          item_total: calculateItemTotal(item) + calculateGSTAmount(item)
        }))
      };

      const saved = localStorage.getItem("savedQuotations");
      const existingQuotations = saved ? JSON.parse(saved) : [];

      if (isUpdate) {
        const updatedQuotations = existingQuotations.map(q =>
          q.id === currentQuotationId ? quotationToSave : q
        );
        localStorage.setItem("savedQuotations", JSON.stringify(updatedQuotations));
      } else {
        const updatedQuotations = [quotationToSave, ...existingQuotations];
        localStorage.setItem("savedQuotations", JSON.stringify(updatedQuotations));
      }

      loadFromLocalStorage();

      alert(`✅ Quotation ${isUpdate ? 'updated' : 'saved'} to local storage!\n\nQuote: ${quoteNo}\nCompany: ${billTo}\nGrand Total: ₹${totals.grandTotalWithGST}\n\nNote: Backend API failed, using local storage.`);

      setShowPreviewModal(false);
      setShowCompanyModal(false);
      setShowItemsModal(false);
      setActionMode('view');
    } finally {
      setSaving(false);
      setUpdating(false);
    }
  }

  // Mark quotation as completed
  const markAsCompleted = async (quotationId) => {
    if (window.confirm("Are you sure you want to mark this quotation as completed? This action cannot be undone.")) {
      try {
        const response = await axios.patch(`${API_BASE}/quotations/${quotationId}/status`, {
          status: "completed",
          updated_by: "User"
        });

        if (response.data.success) {
          alert("✅ Quotation marked as completed!");
          await fetchQuotations();
          await fetchStatistics();
        } else {
          throw new Error(response.data.message || "Failed to update status");
        }
      } catch (err) {
        console.error("Mark as completed failed:", err);
        alert(err.response?.data?.message || err.message || "Failed to mark as completed. Please try again.");
      }
    }
  };

  // Update quotation status directly
  const updateQuotationStatus = async (quotationId, newStatus) => {
    try {
      const response = await axios.patch(`${API_BASE}/quotations/${quotationId}/status`, {
        status: newStatus,
        updated_by: "User"
      });

      if (response.data.success) {
        setSavedQuotations(prev => prev.map(q => q.id === quotationId ? { ...q, status: newStatus } : q));
        await fetchQuotations();
        await fetchStatistics();
      } else {
        alert(response.data.message || "Failed to update status");
      }
    } catch (err) {
      console.error("Update quotation status failed:", err);
      alert(err.response?.data?.message || err.message || "Failed to update status. Please try again.");
    }
  };

  // Delete saved quotation
  async function deleteQuotation(quoteId) {
    if (window.confirm("Are you sure you want to delete this quotation?")) {
      try {
        const response = await axios.delete(`${API_BASE}/quotations/${quoteId}`);

        if (response.data.success) {
          await fetchQuotations();
          await fetchStatistics();
        }
      } catch (err) {
        console.error("Delete failed, using localStorage:", err);
        const saved = localStorage.getItem("savedQuotations");
        if (saved) {
          const existingQuotations = JSON.parse(saved);
          const updatedQuotations = existingQuotations.filter(quote => quote.id !== quoteId);
          localStorage.setItem("savedQuotations", JSON.stringify(updatedQuotations));
          loadFromLocalStorage();
        }
      }
    }
  }

  // View quotation details in modal
  function viewQuotation(quotation) {
    setSelectedQuotation(quotation);
    setShowViewModal(true);
  }

  // Print quotation - UPDATED with tax on left and no profit
  function printQuotation(quotation) {
    const printWindow = window.open('', '_blank');

    const items = quotation.items || [];

    // Calculate tax summary
    const taxSummary = {};
    items.forEach(item => {
      const taxRate = (item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== "") ? parseFloat(item.tax_rate) : (quotation.tax_rate !== undefined && quotation.tax_rate !== null ? parseFloat(quotation.tax_rate) : 18);
      const taxAmount = parseFloat(item.tax_amount) || 0;
      const taxableValue = (parseFloat(item.tax_amount) > 0 && parseFloat(taxRate) > 0) ? (parseFloat(item.tax_amount) / (parseFloat(taxRate) / 100)) : (parseFloat(item.grand_total) || parseFloat(item.total) || 0);
      if (!taxSummary[taxRate]) {
        taxSummary[taxRate] = { taxAmount: 0, taxableValue: 0 };
      }
      taxSummary[taxRate].taxAmount += taxAmount;
      taxSummary[taxRate].taxableValue += taxableValue;
    });

    const totals = {
      subtotal: parseFloat(quotation.subtotal) || 0,
      totalDiscount: parseFloat(quotation.total_discount) || 0,
      totalPacking: parseFloat(quotation.total_packing) || items.reduce((sum, item) => sum + (parseFloat(item.packing_charges) || 0), 0),
      totalFreight: parseFloat(quotation.total_freight) || items.reduce((sum, item) => sum + (parseFloat(item.freight_charges) || 0), 0),
      totalTax: parseFloat(quotation.total_tax) || 0,
      grandTotal: parseFloat(quotation.grand_total) || 0
    };

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
          .text-warning { color: #ffc107 !important; }
          .summary-table th, .summary-table td { padding: 3px 5px; }
          h1 { font-size: 24px; }
          h2 { font-size: 20px; }
          h5 { font-size: 14px; }
          p { font-size: 12px; margin-bottom: 3px; }
          .container { max-width: 100%; }
          .company-logo { max-width: 120px; max-height: 120px; object-fit: contain; }
          .qr-code { max-width: 100px; max-height: 100px; object-fit: contain; }
          .bank-details { background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container mt-3">
          <div class="invoice-header">
            <div class="row">
              <div class="col-2">
                <img src="${companyLogo}" alt="Company Logo" class="company-logo" onerror="this.style.display='none'">
              </div>
              <div class="col-5">
                <h1 class="mb-1">${issuer.name}</h1>
                <p class="mb-1">${issuer.address}</p>
                <p class="mb-1">Phone: ${issuer.phone} | Web: ${issuer.website}</p>
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
                  <th>Customer Part No.</th>
                  <th>Customer Description</th>
                  <th>Cut Width (mm)</th>
                  <th>Cut Length (M)</th>
                  <th>Qty</th>
                  <th>UoM</th>
                  <th>Price/Unit</th>
                  <th>GST %</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item, index) => {
      const mrp = parseFloat(item.mrp) || 0;
      const width = parseFloat(item.cut_width) || 0;
      const length = parseFloat(item.length) || 0;
      const quantity = parseFloat(item.quantity) || 0;
      const profitPercent = parseFloat(item.profit_percentage) || 20;
      const discount = parseFloat(item.discount) || 0;

      const baseCost = mrp * width * length;
      const priceWithProfit = baseCost * (1 + profitPercent / 100);
      let discountAmt = item.discount_type === "percentage" ? (priceWithProfit * (discount / 100)) : discount;

      const pricePerUnitValue = priceWithProfit - discountAmt;
      const totalValue = pricePerUnitValue * quantity;
      const taxRate = parseFloat(item.tax_rate) || 18;

      return `
                    <tr>
                      <td>${index + 1}</td>
                      <td><strong>${item.item_name}</strong></td>
                      <td>${item.customer_part_no || item.supplier_part_no || ''}</td>
                      <td>${item.customer_description || ''}</td>
                      <td>${width}</td>
                      <td>${length}</td>
                      <td>${quantity}</td>
                      <td>${item.unit || ''}</td>
                      <td>₹${pricePerUnitValue.toFixed(2)}</td>
                      <td>${taxRate}%</td>
                      <td><strong>₹${totalValue.toFixed(2)}</strong></td>
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
                  ${Object.entries(taxSummary).map(([rate, data]) => `
                    <tr>
                      <td>${rate}%</td>
                      <td>₹${data.taxableValue.toFixed(2)}</td>
                      <td>₹${data.taxAmount.toFixed(2)}</td>
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
                    <span>Packing Charges:</span>
                    <strong>₹${totals.totalPacking.toFixed(2)}</strong>
                  </div>
                  <div class="d-flex justify-content-between mb-1">
                    <span>Freight Charges:</span>
                    <strong>₹${totals.totalFreight.toFixed(2)}</strong>
                  </div>
                  <div class="d-flex justify-content-between mb-1">
                    <span>Discount:</span>
                    <strong class="text-danger">- ₹${totals.totalDiscount.toFixed(2)}</strong>
                  </div>
                  <div class="d-flex justify-content-between mb-1">
                    <span>Total Tax:</span>
                    <strong>₹${totals.totalTax.toFixed(2)}</strong>
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
          
          <div class="row mt-3">
            <div class="col-8">
              <div class="bank-details">
                <h5>Bank Details:</h5>
                <p class="mb-1"><strong>Account No:</strong> ${issuer.bankDetails.accountNo}</p>
                <p class="mb-1"><strong>Account Title:</strong> ${issuer.bankDetails.accountTitle}</p>
                <p class="mb-1"><strong>IFSC Code:</strong> ${issuer.bankDetails.ifscCode}</p>
                <p class="mb-0"><strong>Bank:</strong> HDFC Bank</p>
              </div>
            </div>
            <div class="col-4 text-end">
              <img src="${qrCodeImage}" alt="QR Code" class="qr-code" onerror="this.style.display='none'">
              <p class="mt-1 small">Scan for payment</p>
            </div>
          </div>
          
          <div class="mt-3 p-2 bg-light rounded">
            <h5>Notes:</h5>
            <p class="mb-0">${quotation.notes || 'Please process this quote as per the terms mentioned. All prices are in INR. Delivery within 7-10 business days.'}</p>
            ${quotation.requote_note ? `
              <p class="mb-0 mt-1"><strong>Re-quote Note:</strong> ${quotation.requote_note}</p>
            ` : ''}
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
  }

  // Navigation functions
  const goToItems = () => {
    if (!billTo.trim()) {
      alert("Please enter Bill To information!");
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

  const cancelQuotation = () => {
    if (window.confirm("Are you sure you want to cancel? All unsaved changes will be lost.")) {
      setShowCompanyModal(false);
      setShowItemsModal(false);
      setShowPreviewModal(false);
      setShowItemPopup(false);
      setShowViewModal(false);
      setActionMode('view');
    }
  };

  // Handle search for quotations
  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const totals = calculateTotals();

  // Item Selection Popup Modal
  const renderItemPopup = () => {
    if (!showItemPopup) return null;

    return (
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
                  <div className="border rounded mt-1 bg-white" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {searchResults.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className={`p-3 border-bottom ${selectedStockItem?.id === item.id ? 'bg-light' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedStockItem(item);
                          setItemSearchTerm(item["Item Name"] || "");
                          setNewItemBrandCode(item["Brand Code"] || "");
                          setShowResults(false);
                          const allBatchCodes = stockItems
                            .filter(stockItem => stockItem["Brand Code"] === item["Brand Code"])
                            .map(stockItem => stockItem["Batch Code"])
                            .filter(Boolean);
                          setAvailableBatchCodes(Array.from(new Set(allBatchCodes)));
                          setNewItemSupplierPartNo(item["Brand Code"] || "");
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <div className="fw-bold mb-1">{item["Item Name"]}</div>
                            <div className="mb-1">
                              <span className="badge bg-primary me-1">Brand</span>
                              <strong>{item["Brand"] || "N/A"}</strong>
                            </div>
                            <div className="mb-1">
                              <span className="badge bg-secondary me-1">Code</span>
                              <strong className="text-dark">{item["Brand Code"]}</strong>
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="fw-bold text-success mb-1">NBP: ₹{parseFloat(item["MRP"] || 0).toFixed(2)}</div>
                            <div className="fw-bold text-info">Buy: ₹{parseFloat(item["Buy Price"] || 0).toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="row mb-2">
                          <div className="col-6">
                            {item["Width"] && item["Length"] && (
                              <div className="mb-1">
                                <span className="badge bg-light text-dark me-1">Dimensions</span>
                                {item["Width"]} × {item["Length"]} {item["Unit"] || "pcs"}
                              </div>
                            )}
                          </div>
                          <div className="col-6">
                            {item["Batch Code"] && (
                              <div className="mb-1">
                                <span className="badge bg-light text-dark me-1">Batch</span>
                                {item["Batch Code"]}
                              </div>
                            )}
                          </div>
                        </div>

                        {item["Brand Description"] && (
                          <div className="small text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>
                            <span className="badge bg-light text-dark me-1">Brand Description</span>
                            {item["Brand Description"]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedStockItem && (
                <div className="card mt-3">
                  <div className="card-header bg-light d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Item Details</h6>
                    <div className="text-end">
                      <span className="badge bg-success me-2">NBP: ₹{parseFloat(selectedStockItem["MRP"] || 0).toFixed(2)}</span>
                      <span className="badge bg-info">Buy: ₹{parseFloat(selectedStockItem["Buy Price"] || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Item Name</label>
                          <input type="text" className="form-control" value={selectedStockItem["Item Name"] || ""} readOnly />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="mb-3">
                          <label className="form-label">Brand</label>
                          <input type="text" className="form-control" value={selectedStockItem["Brand"] || ""} readOnly />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="mb-3">
                          <label className="form-label">Brand Code</label>
                          <input type="text" className="form-control" value={selectedStockItem["Brand Code"] || ""} readOnly />
                        </div>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-4">
                        <div className="mb-3">
                          <label className="form-label d-flex justify-content-between align-items-center">
                            <span>Batch Code</span>
                            {selectedStockItem && (selectedStockItem["Qty"] !== undefined || selectedStockItem["quantity"] !== undefined) && (
                              <span className="badge bg-success">
                                Avail Qty: {selectedStockItem["Qty"] ?? selectedStockItem["quantity"] ?? 0} {selectedStockItem["Unit"] || "pcs"}
                              </span>
                            )}
                          </label>
                          <select
                            className="form-select"
                            value={newItemBatchCode}
                            onChange={(e) => {
                              const selectedBatch = e.target.value;
                              setNewItemBatchCode(selectedBatch);
                              if (selectedBatch && selectedStockItem) {
                                const matchingStock = stockItems.find(
                                  s => s["Brand Code"] === selectedStockItem["Brand Code"] && s["Batch Code"] === selectedBatch
                                );
                                if (matchingStock) {
                                  setSelectedStockItem(matchingStock);
                                  if (matchingStock["Width"]) setNewItemCutWidth(matchingStock["Width"]);
                                  if (matchingStock["Length"]) setNewItemLength(matchingStock["Length"]);
                                }
                              }
                            }}
                          >
                            <option value="">-- Select --</option>
                            {(() => {
                              const batchMap = new Map();
                              stockItems
                                .filter(s => s["Brand Code"] === selectedStockItem["Brand Code"] && s["Batch Code"])
                                .forEach(s => {
                                  const code = s["Batch Code"];
                                  const availQty = s["Qty"] ?? s["quantity"] ?? s["Available Qty"] ?? s["Qty (Pcs)"] ?? 0;
                                  if (!batchMap.has(code)) {
                                    const dim = s["Width"] && s["Length"]
                                      ? `${s["Width"]} × ${s["Length"]} ${s["Unit"] || "mm"}`
                                      : "";
                                    batchMap.set(code, {
                                      code,
                                      availQty,
                                      label: dim ? `${code} (${dim} | Avail Qty: ${availQty})` : `${code} (Avail Qty: ${availQty})`
                                    });
                                  }
                                });
                              const options = Array.from(batchMap.values());
                              if (options.length === 0 && availableBatchCodes.length > 0) {
                                return availableBatchCodes.map((code, idx) => (
                                  <option key={idx} value={code}>{code}</option>
                                ));
                              }
                              return options.map((opt, idx) => (
                                <option key={idx} value={opt.code}>{opt.label}</option>
                              ));
                            })()}
                          </select>
                          {selectedStockItem && (selectedStockItem["Qty"] !== undefined || selectedStockItem["quantity"] !== undefined) && (
                            <div className="form-text text-success fw-bold mt-1">
                              <i className="bi bi-box-seam me-1"></i>Available Quantity in Stock: {selectedStockItem["Qty"] ?? selectedStockItem["quantity"] ?? 0} {selectedStockItem["Unit"] || "pcs"}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mb-3">
                          <label className="form-label">HSN Code</label>
                          <input type="text" className="form-control" value={selectedStockItem["HSN"] || ""} readOnly />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mb-3">
                          <label className="form-label">GST Rate</label>
                          <input type="text" className="form-control" value={`${selectedStockItem["GST"] || 18}%`} readOnly />
                        </div>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Customer Part No</label>
                          <input
                            type="text"
                            className="form-control"
                            value={newItemSupplierPartNo}
                            onChange={(e) => setNewItemSupplierPartNo(e.target.value)}
                            placeholder="Enter supplier part number..."
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Profit Percentage</label>
                          <input
                            type="number"
                            className="form-control"
                            min="0"
                            step="0.01"
                            value={newItemProfitPercentage}
                            onChange={(e) => setNewItemProfitPercentage(e.target.value)}
                            placeholder="Profit %"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-3">
                        <div className="mb-3">
                          <label className="form-label">Cut Width (mm)</label>
                          <input
                            type="number"
                            className="form-control"
                            step="0.1"
                            value={newItemCutWidth}
                            onChange={(e) => {
                              const width = parseFloat(e.target.value) || 0;
                              setNewItemCutWidth(e.target.value);
                              const length = parseFloat(newItemLength) || 0;
                              const quantity = parseFloat(newItemQuantity) || 1;
                              const count = width * length * quantity;
                              setNewItemCount(count.toFixed(2));
                            }}
                            placeholder="Width"
                          />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="mb-3">
                          <label className="form-label">Cut Length (M)</label>
                          <input
                            type="number"
                            className="form-control"
                            step="0.1"
                            value={newItemLength}
                            onChange={(e) => {
                              const length = parseFloat(e.target.value) || 0;
                              setNewItemLength(e.target.value);
                              const width = parseFloat(newItemCutWidth) || 0;
                              const quantity = parseFloat(newItemQuantity) || 1;
                              const count = width * length * quantity;
                              setNewItemCount(count.toFixed(2));
                            }}
                            placeholder="Length"
                          />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="mb-3">
                          <label className="form-label">Quantity</label>
                          <input
                            type="number"
                            className="form-control"
                            min="1"
                            value={newItemQuantity}
                            onChange={(e) => {
                              const quantity = parseFloat(e.target.value) || 1;
                              setNewItemQuantity(quantity.toString());
                              const width = parseFloat(newItemCutWidth) || 0;
                              const length = parseFloat(newItemLength) || 0;
                              const count = width * length * quantity;
                              setNewItemCount(count.toFixed(2));
                            }}
                            placeholder="Quantity"
                          />
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="mb-3">
                          <label className="form-label">Calculated Price/Unit</label>
                          <input type="text" className="form-control" value={
                            `₹${(parseFloat(selectedStockItem["MRP"] || 0) *
                              (parseFloat(newItemLength) || 1) *
                              (parseFloat(newItemCutWidth) || 1)).toFixed(2)}`
                          } readOnly />
                        </div>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Calculated Count</label>
                          <input
                            type="text"
                            className="form-control"
                            value={newItemCount}
                            readOnly
                          />
                          <small className="text-muted">Count = Width × Length × Quantity</small>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Customer Description</label>
                          <input
                            type="text"
                            className="form-control"
                            value={newItemCustomerDescription}
                            onChange={(e) => setNewItemCustomerDescription(e.target.value)}
                            placeholder="Enter customer description here..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer">
                    <div className="d-flex justify-content-end gap-2">
                      <button type="button" className="btn btn-secondary" onClick={() => setShowItemPopup(false)}>
                        <i className="bi bi-x-circle me-1"></i>Cancel
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => {
                        if (!selectedStockItem) {
                          alert("Please select an item first!");
                          return;
                        }

                        const mrp = parseFloat(selectedStockItem["MRP"]) || 0;
                        const width = parseFloat(newItemCutWidth) || parseFloat(selectedStockItem["Width"]) || 1;
                        const length = parseFloat(newItemLength) || parseFloat(selectedStockItem["Length"]) || 1;
                        const quantity = parseFloat(newItemQuantity) || 1;
                        const pricePerUnitValue = mrp * width * length;
                        const profitPercentage = (newItemProfitPercentage !== "" && newItemProfitPercentage !== null && newItemProfitPercentage !== undefined) ? (parseFloat(newItemProfitPercentage) ?? 0) : 20;
                        const totalValue = pricePerUnitValue + (pricePerUnitValue * (profitPercentage / 100));

                        const newItem = {
                          id: idRef.current + 1,
                          item_name: selectedStockItem["Item Name"] || "",
                          brand_code: newItemBrandCode || selectedStockItem["Brand Code"] || "",
                          hsn_sac: selectedStockItem["HSN"] || "",
                          supplier_part_no: newItemSupplierPartNo || "",
                          description: selectedStockItem["Brand Description"] || "",
                          cut_width: width,
                          length: length,
                          count: parseFloat(newItemCount) || 1,
                          batch_no: newItemBatchCode || `B-${Date.now().toString().slice(-6)}-${items.length + 1}`,
                          mrp: mrp,
                          buy_price: parseFloat(selectedStockItem["Buy Price"]) || 0,
                          quantity: quantity,
                          unit: selectedStockItem["Unit"] || "pcs",
                          profit_percentage: profitPercentage,
                          tax_rate: (quotationGstRate !== "" && quotationGstRate !== null && quotationGstRate !== undefined) ? (parseFloat(quotationGstRate) ?? 0) : 18,
                          packing_charges: 0,
                          freight_charges: 0,
                          customer_description: newItemCustomerDescription,
                          price_per_unit: pricePerUnitValue,
                          total: totalValue,
                          grand_total: totalValue
                        };

                        setItems(prev => [...prev, newItem]);
                        idRef.current = idRef.current + 1;
                        setSelectedStockItem(null);
                        setItemSearchTerm("");
                        setNewItemCutWidth("");
                        setNewItemLength("");
                        setNewItemCount("1");
                        setNewItemQuantity("1");
                        setNewItemBatchCode("");
                        setNewItemProfitPercentage("20");
                        setNewItemPackingCharges("0");
                        setNewItemFreightCharges("0");
                        setNewItemCustomerDescription("");
                        setNewItemSupplierPartNo("");
                        setNewItemBrandCode("");
                        setShowItemPopup(false);
                        setShowResults(false);
                      }}>
                        <i className="bi bi-plus-circle me-1"></i>Add to Quotation
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Preview Modal - UPDATED with tax on left
  const renderPreviewModal = () => {
    if (!showPreviewModal) return null;

    // Calculate tax summary for preview
    const taxSummary = {};
    items.forEach(item => {
      const taxRate = (item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== "") ? parseFloat(item.tax_rate) : (quotationGstRate !== "" && quotationGstRate !== null && quotationGstRate !== undefined ? parseFloat(quotationGstRate) : 18);
      const taxAmount = calculateGSTAmount(item);
      const taxableValue = calculateGrandTotal(item);
      if (!taxSummary[taxRate]) {
        taxSummary[taxRate] = { taxAmount: 0, taxableValue: 0 };
      }
      taxSummary[taxRate].taxAmount += taxAmount;
      taxSummary[taxRate].taxableValue += taxableValue;
    });

    return (
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
        <div className="modal-dialog modal-xl">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                {actionMode === 'edit' ? 'Preview & Update Quotation' : 'Step 3: Preview & Save'}
              </h5>
              <button type="button" className="btn-close btn-close-white" onClick={cancelQuotation}></button>
            </div>
            <div className="modal-body">
              <div ref={quotationRef}>
                <div className="container">
                  <div className="invoice-header border-bottom pb-3 mb-3">
                    <div className="row">
                      <div className="col-2">
                        <img
                          src={companyLogo}
                          alt="Company Logo"
                          className="img-fluid"
                          style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'contain' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="col-5">
                        <h1 className="mb-1">{issuer.name}</h1>
                        <p className="mb-1">{issuer.address}</p>
                        <p className="mb-1">Phone: {issuer.phone} | Web: {issuer.website}</p>
                        <p className="mb-1">GSTIN: {issuer.gstin} | State: {issuer.stateCode}</p>
                      </div>
                      <div className="col-5 text-end">
                        <h2 className="text-primary mb-3">QUOTATION</h2>
                        <p className="mb-1"><strong>Quote No:</strong> {quoteNo}</p>
                        <p className="mb-1"><strong>Date:</strong> {date}</p>
                      </div>
                    </div>
                  </div>

                  <div className="row mb-4">
                    <div className="col-6">
                      <h5>Bill To:</h5>
                      <p className="mb-1"><strong>{billTo}</strong></p>
                      <p className="mb-1">{companyAddress}</p>
                      <p className="mb-1">GSTIN: {companyGstin}</p>
                    </div>
                    <div className="col-6">
                      <h5>Contact Details:</h5>
                      <p className="mb-1"><strong>{contactPerson}</strong></p>
                      <p className="mb-1">Phone: {contactMob}</p>
                      <p className="mb-1">Email: {contactEmail}</p>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th>#</th>
                          <th>Item Name</th>
                          <th>Customer Part No</th>
                          <th>Customer Description</th>
                          <th>Cut Width (mm)</th>
                          <th>Cut Length (M)</th>
                          <th>Qty</th>
                          <th>HSN</th>
                          <th>UoM</th>
                          <th>NBP</th>
                          <th>Price/Unit</th>
                          <th>Total</th>
                          <th>Packing</th>
                          <th>Freight</th>
                          <th>Grand Total</th>
                          <th>GST %</th>
                          <th>Tax Amount</th>
                          <th>Amount (incl. Tax)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => {
                          const pricePerUnitValue = pricePerUnit(item);
                          const totalValue = calculateTotal(item);
                          const grandTotalValue = calculateGrandTotal(item);
                          const taxAmount = calculateGSTAmount(item);
                          const finalAmount = grandTotalValue + taxAmount;

                          return (
                            <tr key={item.id}>
                              <td>{index + 1}</td>
                              <td><strong>{item.item_name}</strong></td>
                              <td>{item.customer_part_no || item.supplier_part_no || ''}</td>
                              <td>{item.customer_description || ''}</td>
                              <td>{item.cut_width}</td>
                              <td>{item.length}</td>
                              <td>{item.quantity}</td>
                              <td>{item.hsn_sac}</td>
                              <td>{item.unit}</td>
                              <td>₹{parseFloat(item.mrp || 0).toFixed(2)}</td>
                              <td>₹{pricePerUnitValue.toFixed(2)}</td>
                              <td>₹{totalValue.toFixed(2)}</td>
                              <td>₹{parseFloat(item.packing_charges || 0).toFixed(2)}</td>
                              <td>₹{parseFloat(item.freight_charges || 0).toFixed(2)}</td>
                              <td>₹{grandTotalValue.toFixed(2)}</td>
                              <td>{(item.tax_rate !== undefined && item.tax_rate !== null ? item.tax_rate : (quotationGstRate !== "" ? quotationGstRate : 18))}%</td>
                              <td>₹{taxAmount.toFixed(2)}</td>
                              <td><strong>₹{finalAmount.toFixed(2)}</strong></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="row mt-4">
                    <div className="col-7">
                      <h5 className="mb-2">Tax Summary:</h5>
                      <table className="table table-bordered table-sm">
                        <thead className="table-light">
                          <tr>
                            <th>GST %</th>
                            <th>Taxable Amount</th>
                            <th>Tax Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(taxSummary).map(([rate, data]) => (
                            <tr key={rate}>
                              <td>{rate}%</td>
                              <td>₹{data.taxableValue.toFixed(2)}</td>
                              <td>₹{data.taxAmount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="col-5">
                      <div className="card border-0">
                        <div className="card-body">
                          <h5 className="card-title">Total Summary</h5>
                          <div className="d-flex justify-content-between mb-2">
                            <span>Subtotal:</span>
                            <strong>₹{(totals.totalPricePerUnit || 0).toFixed(2)}</strong>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>Packing Charges:</span>
                            <strong>₹{(parseFloat(quotationPacking) || totals.totalPacking || 0).toFixed(2)}</strong>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>Freight Charges:</span>
                            <strong>₹{(parseFloat(quotationFreight) || totals.totalFreight || 0).toFixed(2)}</strong>
                          </div>

                          <div className="d-flex justify-content-between mb-2">
                            <span>Total Tax:</span>
                            <strong>₹{(totals.totalGST || totals.totalTax || 0).toFixed(2)}</strong>
                          </div>
                          <hr />
                          <div className="d-flex justify-content-between total-row">
                            <span>Grand Total:</span>
                            <strong className="text-primary">₹{(
                              (totals.totalPricePerUnit || 0) +
                              (parseFloat(quotationPacking) || 0) +
                              (parseFloat(quotationFreight) || 0) +
                              ((totals.totalPricePerUnit + parseFloat(quotationPacking) + parseFloat(quotationFreight)) * ((parseFloat(quotationGstRate) || 18) / 100))
                            ).toFixed(2)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="row mt-4">
                    <div className="col-8">
                      <div className="p-3 bg-light rounded">
                        <h5>Bank Details:</h5>
                        <p className="mb-1"><strong>Account No:</strong> {issuer.bankDetails.accountNo}</p>
                        <p className="mb-1"><strong>Account Title:</strong> {issuer.bankDetails.accountTitle}</p>
                        <p className="mb-1"><strong>IFSC Code:</strong> {issuer.bankDetails.ifscCode}</p>
                        <p className="mb-0"><strong>Bank:</strong> HDFC Bank</p>
                      </div>
                    </div>
                    <div className="col-4 text-end">
                      <img
                        src={qrCodeImage}
                        alt="QR Code"
                        className="img-fluid"
                        style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'contain' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <p className="mt-2 small">Scan for payment</p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-light rounded">
                    <h5>Notes:</h5>
                    <p className="mb-0">{notes || 'Please process this quote as per the terms mentioned. All prices are in INR. Delivery within 7-10 business days.'}</p>
                    {requoteNote && (
                      <p className="mb-0 mt-2"><strong>Re-quote Note:</strong> {requoteNote}</p>
                    )}
                    <p className="mb-0 mt-2"><strong>Valid for 30 days from the date of issue.</strong></p>
                  </div>
                </div>
              </div>

              <div className="modal-footer mt-3">
                <button type="button" className="btn btn-secondary" onClick={goBackToItems}>
                  <i className="bi bi-arrow-left me-1"></i>Back to Items
                </button>
                <button type="button" className="btn btn-info" onClick={exportPdf}>
                  <i className="bi bi-file-pdf me-1"></i>Export PDF
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={saveOrUpdateQuotation}
                  disabled={saving || updating}
                >
                  {saving || updating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      {actionMode === 'edit' ? 'Updating...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-save me-1"></i>
                      {actionMode === 'edit' ? 'Update Quotation' : 'Save Quotation'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // View Quotation Modal - UPDATED with tax on left
  const renderViewModal = () => {
    if (!showViewModal || !selectedQuotation) return null;

    // Calculate tax summary for view
    const taxSummary = {};
    (selectedQuotation.items || []).forEach(item => {
      const taxRate = (item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== "") ? parseFloat(item.tax_rate) : (selectedQuotation.tax_rate !== undefined && selectedQuotation.tax_rate !== null ? parseFloat(selectedQuotation.tax_rate) : 18);
      const taxAmount = parseFloat(item.tax_amount) || 0;
      const taxableValue = (parseFloat(item.tax_amount) > 0 && parseFloat(taxRate) > 0) ? (parseFloat(item.tax_amount) / (parseFloat(taxRate) / 100)) : (parseFloat(item.grand_total) || parseFloat(item.total) || 0);
      if (!taxSummary[taxRate]) {
        taxSummary[taxRate] = { taxAmount: 0, taxableValue: 0 };
      }
      taxSummary[taxRate].taxAmount += taxAmount;
      taxSummary[taxRate].taxableValue += taxableValue;
    });

    return (
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
        <div className="modal-dialog modal-xl">
          <div className="modal-content">
            <div className="modal-header bg-info text-white">
              <h5 className="modal-title">Quotation Details</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setShowViewModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="container">
                <div className="invoice-header border-bottom pb-3 mb-3">
                  <div className="row">
                    <div className="col-2">
                      <img
                        src={companyLogo}
                        alt="Company Logo"
                        className="img-fluid"
                        style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'contain' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="col-5">
                      <h1 className="mb-1">{issuer.name}</h1>
                      <p className="mb-1">{issuer.address}</p>
                      <p className="mb-1">Phone: {issuer.phone} | Web: {issuer.website}</p>
                      <p className="mb-1">GSTIN: {issuer.gstin} | State: {issuer.stateCode}</p>
                    </div>
                    <div className="col-5 text-end">
                      <h2 className="text-info mb-3">QUOTATION</h2>
                      <p className="mb-1"><strong>Quote No:</strong> {selectedQuotation.quote_number || selectedQuotation.quoteNo}</p>
                      <p className="mb-1"><strong>Date:</strong> {selectedQuotation.date || selectedQuotation.date}</p>
                    </div>
                  </div>
                </div>

                <div className="row mb-4">
                  <div className="col-6">
                    <h5>Bill To:</h5>
                    <p className="mb-1"><strong>{selectedQuotation.company_name || selectedQuotation.billTo}</strong></p>
                    <p className="mb-1">{selectedQuotation.company_address || ''}</p>
                    <p className="mb-1">GSTIN: {selectedQuotation.company_gstin || ''}</p>
                  </div>
                  <div className="col-6">
                    <h5>Contact Details:</h5>
                    <p className="mb-1"><strong>{selectedQuotation.contact_person || selectedQuotation.contactPerson}</strong></p>
                    <p className="mb-1">Phone: {selectedQuotation.contact_mobile || selectedQuotation.contactMob}</p>
                    <p className="mb-1">Email: {selectedQuotation.contact_email || selectedQuotation.contactEmail}</p>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Item Name</th>
                        <th>Customer Part No</th>
                        <th>Customer Description</th>
                        <th>Cut Width (mm)</th>
                        <th>Cut Length (M)</th>
                        <th>Qty</th>
                        <th>HSN</th>
                        <th>UoM</th>
                        <th>NBP</th>
                        <th>Price/Unit</th>
                        <th>Total</th>
                        <th>Packing</th>
                        <th>Freight</th>
                        <th>Grand Total</th>
                        <th>GST %</th>
                        <th>Tax Amount</th>
                        <th>Amount (incl. Tax)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedQuotation.items || []).map((item, index) => {
                        const mrp = parseFloat(item.mrp) || 0;
                        const width = parseFloat(item.cut_width) || 0;
                        const length = parseFloat(item.length) || 0;
                        const quantity = parseFloat(item.quantity) || 0;
                        const profitPercent = parseFloat(item.profit_percentage) || 20;
                        const discount = parseFloat(item.discount) || 0;

                        const baseCost = mrp * width * length;
                        const priceWithProfit = baseCost * (1 + profitPercent / 100);
                        let discountAmt = item.discount_type === "percentage" ? (priceWithProfit * (discount / 100)) : discount;

                        const pricePerUnitValue = priceWithProfit - discountAmt;
                        const totalValue = pricePerUnitValue * quantity;
                        const packing = parseFloat(item.packing_charges) || 0;
                        const freight = parseFloat(item.freight_charges) || 0;
                        const grandTotalValue = totalValue + packing + freight;
                        const taxRate = parseFloat(item.tax_rate) || 18;
                        const taxAmount = parseFloat(item.tax_amount) || (grandTotalValue * taxRate / 100);
                        const finalAmount = grandTotalValue + taxAmount;

                        return (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td><strong>{item.item_name}</strong></td>
                            <td>{item.customer_part_no || item.supplier_part_no || ''}</td>
                            <td>{item.customer_description || ''}</td>
                            <td>{item.cut_width || ''}</td>
                            <td>{item.length || ''}</td>
                            <td>{quantity}</td>
                            <td>{item.hsn_sac || ''}</td>
                            <td>{item.unit || ''}</td>
                            <td>₹{mrp.toFixed(2)}</td>
                            <td>₹{pricePerUnitValue.toFixed(2)}</td>
                            <td>₹{totalValue.toFixed(2)}</td>
                            <td>₹{packing.toFixed(2)}</td>
                            <td>₹{freight.toFixed(2)}</td>
                            <td>₹{grandTotalValue.toFixed(2)}</td>
                            <td>{taxRate}%</td>
                            <td>₹{taxAmount.toFixed(2)}</td>
                            <td><strong>₹{finalAmount.toFixed(2)}</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="row mt-4">
                  <div className="col-7">
                    <h5 className="mb-2">Tax Summary:</h5>
                    <table className="table table-bordered table-sm">
                      <thead className="table-light">
                        <tr>
                          <th>GST %</th>
                          <th>Taxable Amount</th>
                          <th>Tax Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(taxSummary).map(([rate, data]) => (
                          <tr key={rate}>
                            <td>{rate}%</td>
                            <td>₹{data.taxableValue.toFixed(2)}</td>
                            <td>₹{data.taxAmount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="col-5">
                    <div className="card border-0">
                      <div className="card-body">
                        <h5 className="card-title">Total Summary</h5>
                        <div className="d-flex justify-content-between mb-2">
                          <span>Total Price/Unit:</span>
                          <strong>₹{(selectedQuotation.total_price_per_unit || 0).toFixed(2)}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span>Total Packing:</span>
                          <strong>₹{(selectedQuotation.total_packing || 0).toFixed(2)}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span>Total Freight:</span>
                          <strong>₹{(selectedQuotation.total_freight || 0).toFixed(2)}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span>Total Tax:</span>
                          <strong>₹{(selectedQuotation.total_tax || 0).toFixed(2)}</strong>
                        </div>
                        {(() => {
                          const totalBuyCost = (selectedQuotation.items || []).reduce((sum, item) => {
                            const mrp = parseFloat(item.mrp) || 0;
                            const width = parseFloat(item.cut_width) || 0;
                            const length = parseFloat(item.length) || 0;
                            const pricePerUnitValue = mrp * width * length;
                            return sum + pricePerUnitValue;
                          }, 0);

                          return (
                            <div className="d-flex justify-content-between mb-2">
                              <span>Total Buy Cost:</span>
                              <strong>₹{totalBuyCost.toFixed(2)}</strong>
                            </div>
                          );
                        })()}
                        <hr />
                        <div className="d-flex justify-content-between total-row">
                          <span>Grand Total (incl. Tax):</span>
                          <strong className="text-primary">₹{(selectedQuotation.grand_total_with_gst || selectedQuotation.grand_total).toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row mt-4">
                  <div className="col-8">
                    <div className="p-3 bg-light rounded">
                      <h5>Bank Details:</h5>
                      <p className="mb-1"><strong>Account No:</strong> {issuer.bankDetails.accountNo}</p>
                      <p className="mb-1"><strong>Account Title:</strong> {issuer.bankDetails.accountTitle}</p>
                      <p className="mb-1"><strong>IFSC Code:</strong> {issuer.bankDetails.ifscCode}</p>
                      <p className="mb-0"><strong>Bank:</strong> HDFC Bank</p>
                    </div>
                  </div>
                  <div className="col-4 text-end">
                    <img
                      src={qrCodeImage}
                      alt="QR Code"
                      className="img-fluid"
                      style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'contain' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <p className="mt-2 small">Scan for payment</p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-light rounded">
                  <h5>Notes:</h5>
                  <p className="mb-0">{selectedQuotation.notes || 'Please process this quote as per the terms mentioned. All prices are in INR. Delivery within 7-10 business days.'}</p>
                  {selectedQuotation.requote_note && (
                    <p className="mb-0 mt-2"><strong>Re-quote Note:</strong> {selectedQuotation.requote_note}</p>
                  )}
                  <p className="mb-0 mt-2"><strong>Valid for 30 days from the date of issue.</strong></p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                <i className="bi bi-x-circle me-1"></i>Close
              </button>
              <button type="button" className="btn btn-primary" onClick={() => printQuotation(selectedQuotation)}>
                <i className="bi bi-printer me-1"></i>Print
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Items Modal - UPDATED with tax rate field
  const renderItemsModal = () => {
    if (!showItemsModal) return null;

    return (
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
        <div className="modal-dialog modal-xl">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">Step 2: Add Items</h5>
              <button type="button" className="btn-close btn-close-white" onClick={cancelQuotation}></button>
            </div>

            <div className="modal-body">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex align-items-center text-success">
                  <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>
                    <i className="bi bi-check"></i>
                  </div>
                  <span className="ms-2">Company Details</span>
                </div>
                <div className="flex-grow-1 border-top mx-3"></div>
                <div className="d-flex align-items-center text-primary">
                  <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>2</div>
                  <span className="ms-2">Add Items</span>
                </div>
                <div className="flex-grow-1 border-top mx-3"></div>
                <div className="d-flex align-items-center text-muted">
                  <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>3</div>
                  <span className="ms-2">Preview</span>
                </div>
              </div>

              <div className="card mb-3 bg-light border-0 shadow-sm">
                <div className="card-body py-2 px-3">
                  <div className="row align-items-center text-dark">
                    <div className="col-md-3 border-end my-1">
                      <span className="text-muted small d-block">Quote Number</span>
                      <strong className="text-primary">{quoteNo || 'N/A'}</strong>
                    </div>
                    <div className="col-md-3 border-end my-1">
                      <span className="text-muted small d-block">Bill To / Company</span>
                      <strong className="text-dark">{billTo || 'N/A'}</strong>
                    </div>
                    <div className="col-md-3 border-end my-1">
                      <span className="text-muted small d-block">Contact Person</span>
                      <span className="fw-semibold">{contactPerson || 'N/A'}</span>
                      {contactMob && <span className="text-muted small ms-1">({contactMob})</span>}
                    </div>
                    <div className="col-md-3 d-flex justify-content-between align-items-center my-1">
                      <div>
                        <span className="text-muted small d-block">GSTIN</span>
                        <span className="fw-semibold">{companyGstin || 'N/A'}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={goBackToCompany}
                        title="Edit Company Details"
                      >
                        <i className="bi bi-pencil me-1"></i>Edit Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card mb-4">
                <div className="card-header bg-light">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Items List {items.length > 0 && <span className="badge bg-primary ms-2">{items.length} items</span>}</h6>
                    <button className="btn btn-sm btn-success" onClick={addItemViaPopup}>
                      <i className="bi bi-plus-circle me-1"></i>Add Item
                    </button>
                  </div>
                </div>
                <div className="card-body p-0">
                  {items.length === 0 ? (
                    <div className="text-center py-5">
                      <i className="bi bi-box display-1 text-muted mb-3"></i>
                      <h5 className="text-muted">No items added</h5>
                      <p className="text-muted">Click "Add Item" to start adding items to your quotation</p>
                    </div>
                  ) : (
                    <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table className="table table-hover mb-0 align-middle">
                        <thead className="table-light">
                          <tr>
                            <th style={{ minWidth: '40px' }}>#</th>
                            <th style={{ minWidth: '150px' }}>Item Name</th>
                            <th style={{ minWidth: '110px' }}>Cust Part No</th>
                            <th style={{ minWidth: '130px' }}>Cust Desc</th>
                            <th style={{ minWidth: '70px' }}>Width (mm)</th>
                            <th style={{ minWidth: '70px' }}>Length (M)</th>
                            <th style={{ minWidth: '75px' }}>Qty</th>
                            <th style={{ minWidth: '60px' }}>Unit</th>
                            <th style={{ minWidth: '90px' }}>NBP</th>
                            <th style={{ minWidth: '85px' }}>Profit %</th>
                            <th style={{ minWidth: '95px' }}>Price/Unit</th>
                            <th style={{ minWidth: '135px' }}>Discount</th>
                            <th style={{ minWidth: '95px' }}>Total</th>
                            <th style={{ minWidth: '50px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => {
                            const pricePerUnitValue = pricePerUnit(item);
                            const totalValue = calculateTotal(item);
                            const grandTotalValue = calculateGrandTotal(item);
                            const taxAmount = calculateGSTAmount(item);
                            const finalAmount = grandTotalValue + taxAmount;

                            return (
                              <tr key={item.id}>
                                <td>{index + 1}</td>
                                <td>
                                  <div className="fw-bold">{item.item_name}</div>
                                  {item.brand_code && <div className="text-muted small">Code: {item.brand_code}</div>}
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.customer_part_no || item.supplier_part_no || ''}
                                    onChange={(e) => {
                                      handleItemChange(index, "customer_part_no", e.target.value);
                                      handleItemChange(index, "supplier_part_no", e.target.value);
                                    }}
                                    placeholder="Part No"
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={item.customer_description || ''}
                                    onChange={(e) => handleItemChange(index, "customer_description", e.target.value)}
                                    placeholder="Cust Desc"
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
                                  />
                                </td>
                                <td>{item.unit}</td>
                                <td className="text-end">
                                  <input
                                    type="number"
                                    className="form-control form-control-sm text-end"
                                    min="0"
                                    step="0.01"
                                    value={item.mrp || 0}
                                    onChange={(e) => handleItemChange(index, "mrp", e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm text-end fw-bold"
                                    min="0"
                                    step="0.1"
                                    value={item.profit_percentage !== undefined && item.profit_percentage !== null ? item.profit_percentage : 20}
                                    onChange={(e) => handleItemChange(index, "profit_percentage", e.target.value)}
                                  />
                                </td>
                                <td className="text-end fw-bold">
                                  ₹{pricePerUnitValue.toFixed(2)}
                                </td>
                                <td>
                                  <div className="input-group input-group-sm">
                                    <input
                                      type="number"
                                      className="form-control"
                                      min="0"
                                      step="0.01"
                                      value={item.discount || 0}
                                      onChange={(e) => handleItemChange(index, "discount", e.target.value)}
                                    />
                                    <select
                                      className="form-select"
                                      style={{ width: '60px', padding: '0.25rem' }}
                                      value={item.discount_type || 'amount'}
                                      onChange={(e) => handleItemChange(index, "discount_type", e.target.value)}
                                    >
                                      <option value="amount">₹</option>
                                      <option value="percentage">%</option>
                                    </select>
                                  </div>
                                </td>
                                <td className="text-end fw-bold text-success">
                                  ₹{totalValue.toFixed(2)}
                                </td>
                                <td className="text-center">
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => removeItem(index)}
                                    title="Delete"
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-7">
                  <div className="card">
                    <div className="card-header bg-light">
                      <h6 className="mb-0 fw-bold"><i className="bi bi-calculator me-2"></i>Quotation Charges & Tax</h6>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-4 mb-2">
                          <label className="form-label fw-bold small">Packing Charges (₹)</label>
                          <input
                            type="number"
                            className="form-control"
                            min="0"
                            step="0.01"
                            value={quotationPacking}
                            onChange={(e) => setQuotationPacking(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-md-4 mb-2">
                          <label className="form-label fw-bold small">Freight Charges (₹)</label>
                          <input
                            type="number"
                            className="form-control"
                            min="0"
                            step="0.01"
                            value={quotationFreight}
                            onChange={(e) => setQuotationFreight(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-md-4 mb-2">
                          <label className="form-label fw-bold small">GST %</label>
                          <select
                            className="form-select"
                            value={quotationGstRate}
                            onChange={(e) => {
                              const rate = e.target.value;
                              setQuotationGstRate(rate);
                              const numericRate = parseFloat(rate) || 18;
                              setItems(prevItems => prevItems.map(item => ({ ...item, tax_rate: numericRate })));
                            }}
                          >
                            <option value="18">18%</option>
                            <option value="12">12%</option>
                            <option value="5">5%</option>
                            <option value="28">28%</option>
                            <option value="0">0%</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-5">
                  <div className="card">
                    <div className="card-body">
                      <h6 className="card-title fw-bold">Quick Summary</h6>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Items:</span>
                        <strong>{items.length}</strong>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Subtotal:</span>
                        <strong>₹{(totals.totalPricePerUnit || 0).toFixed(2)}</strong>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Packing Charges:</span>
                        <strong>₹{(parseFloat(quotationPacking) || 0).toFixed(2)}</strong>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Freight Charges:</span>
                        <strong>₹{(parseFloat(quotationFreight) || 0).toFixed(2)}</strong>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Total Tax ({quotationGstRate !== "" && quotationGstRate !== null && quotationGstRate !== undefined ? quotationGstRate : 18}%):</span>
                        <strong>₹{totals.totalGST.toFixed(2)}</strong>
                      </div>
                      <hr />
                      <div className="d-flex justify-content-between fw-bold">
                        <span>Grand Total:</span>
                        <strong className="text-primary">₹{totals.grandTotalWithGST.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
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
    );
  };

  // Company Details Modal - UPDATED (removed profit display)
  const renderCompanyModal = () => {
    if (!showCompanyModal) return null;

    return (
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                {actionMode === 'edit' ? 'Edit Quotation' : 'Step 1: Company Details'}
              </h5>
              <button type="button" className="btn-close btn-close-white" onClick={cancelQuotation}></button>
            </div>

            <div className="modal-body">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className={`d-flex align-items-center ${billTo.trim() ? 'text-success' : ''}`}>
                  <div className={`rounded-circle ${billTo.trim() ? 'bg-success' : 'bg-primary'} text-white d-flex align-items-center justify-content-center`} style={{ width: '30px', height: '30px' }}>
                    {billTo.trim() ? <i className="bi bi-check"></i> : '1'}
                  </div>
                  <span className="ms-2">Company Details</span>
                </div>
                <div className="flex-grow-1 border-top mx-3"></div>
                <div className="d-flex align-items-center text-muted">
                  <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>2</div>
                  <span className="ms-2">Add Items</span>
                </div>
                <div className="flex-grow-1 border-top mx-3"></div>
                <div className="d-flex align-items-center text-muted">
                  <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>3</div>
                  <span className="ms-2">Preview</span>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Search Company</label>
                <div className="position-relative">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type company name or contact..."
                    value={billTo}
                    onChange={(e) => handleBillToSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                  />

                  {showCompanyDropdown && filteredCompanies.length > 0 && (
                    <div className="position-absolute w-100 bg-white border rounded shadow-sm" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
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
                          <div className="fw-bold">{company.company_name || company.companyName}</div>
                          <div className="text-muted small">
                            {company.customer_name || company.customerName} • {company.customer_mobile || company.customerMobile}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {loadingCompanies && <div className="alert alert-info mt-2 py-2">Loading companies...</div>}
                {companyError && <div className="alert alert-warning mt-2 py-2">{companyError}</div>}
              </div>

              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Contact Person</label>
                    <input
                      type="text"
                      className="form-control"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
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
                    />
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Company Address</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                />
              </div>

              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Company GSTIN</label>
                    <input
                      type="text"
                      className="form-control"
                      value={companyGstin}
                      onChange={(e) => setCompanyGstin(e.target.value)}
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
                      />
                      <div className="input-group-text">
                        <input
                          className="form-check-input me-1"
                          type="checkbox"
                          id="sameEmail"
                          checked={contactEmailSame}
                          onChange={(e) => setContactEmailSame(e.target.checked)}
                        />
                        <label className="form-check-label small" htmlFor="sameEmail">
                          Use issuer email
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {actionMode === 'edit' && (
                <div className="mb-3">
                  <label className="form-label">Re-quote Note (if applicable)</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={requoteNote}
                    onChange={(e) => setRequoteNote(e.target.value)}
                    placeholder="Add note if this is a re-quote..."
                  />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes for the quotation..."
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cancelQuotation}>
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
    );
  };

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
          
          .modal-body .row {
            margin-left: -8px;
            margin-right: -8px;
          }
          
          .modal-body .row > [class*="col-"] {
            padding-left: 8px;
            padding-right: 8px;
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
          
          .table th, .table td {
            font-size: 11px;
            padding: 4px !important;
          }
          
          .btn-sm {
            padding: 0.25rem 0.4rem;
            font-size: 0.7rem;
          }
          
          .btn-group-sm > .btn {
            padding: 0.25rem 0.4rem;
            font-size: 0.7rem;
          }
          
          .badge {
            font-size: 0.65rem;
          }
          
          h1.h2 {
            font-size: 1.5rem !important;
          }
          
          .card-title {
            font-size: 0.9rem;
          }
        }
        
        @media (max-width: 576px) {
          h1.h2 {
            font-size: 1.3rem !important;
          }
          
          .mobile-grid-2 {
            grid-template-columns: 1fr;
          }
          
          .mobile-filter-buttons {
            grid-template-columns: 1fr;
          }
          
          .modal-footer {
            flex-direction: column;
            gap: 8px;
          }
          
          .modal-footer .btn {
            width: 100%;
            margin: 0 !important;
          }
          
          .d-flex.gap-2 {
            gap: 8px !important;
          }
          
          .input-group {
            flex-direction: column;
          }
          
          .input-group > .form-control,
          .input-group > .input-group-text {
            width: 100%;
            border-radius: 4px !important;
            margin-bottom: 4px;
          }
        }
      `}</style>

      {/* Header with Action Buttons */}
      <div className="d-flex justify-content-between align-items-center mb-4 mobile-stack">
        <div className="mobile-full-width">
          <h1 className="h2 mb-1">Quotation Approval</h1>
          <p className="text-muted mb-0 mobile-text-small">Manage and track your quotation approvals</p>
        </div>
        <div className="d-flex gap-2 mobile-full-width mobile-btn-group">
          <button className="btn btn-primary mobile-full-width" onClick={startNewQuotation}>
            <i className="bi bi-plus-circle me-1"></i>Create New Quotation
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="row mb-4">
          <div className="col-md-2 col-6 mb-3">
            <div className="card border-success mobile-card">
              <div className="card-body text-center">
                <div className="h3 text-success">{statistics.status_counts?.completed || 0}</div>
                <div className="text-muted mobile-text-small">Completed</div>
              </div>
            </div>
          </div>
          <div className="col-md-2 col-6 mb-3">
            <div className="card border-warning mobile-card">
              <div className="card-body text-center">
                <div className="h3 text-warning">{statistics.status_counts?.requote || 0}</div>
                <div className="text-muted mobile-text-small">Re-quote</div>
              </div>
            </div>
          </div>
          <div className="col-md-2 col-6 mb-3">
            <div className="card border-primary mobile-card">
              <div className="card-body text-center">
                <div className="h3 text-primary">{statistics.status_counts?.draft || 0}</div>
                <div className="text-muted mobile-text-small">Draft</div>
              </div>
            </div>
          </div>
          <div className="col-md-2 col-6 mb-3">
            <div className="card border-info mobile-card">
              <div className="card-body text-center">
                <div className="h3 text-info">{statistics.total || 0}</div>
                <div className="text-muted mobile-text-small">Total</div>
              </div>
            </div>
          </div>
          <div className="col-md-4 col-12 mb-3">
            <div className="card mobile-card">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div>
                    <div className="text-muted mobile-text-small">This Month</div>
                    <div className="h4 mobile-text-small">₹{(statistics.current_month_revenue || 0).toLocaleString()}</div>
                  </div>
                  <div className="align-self-center">
                    <i className="bi bi-graph-up text-success fs-3"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Render Modals */}
      {renderCompanyModal()}
      {renderItemsModal()}
      {renderItemPopup()}
      {renderPreviewModal()}
      {renderViewModal()}

      {/* Saved Quotations Section */}
      <div className="card mobile-card">
        <div className="card-header bg-light">
          <div className="d-flex justify-content-between align-items-center mobile-stack">
            <h5 className="mb-0 mobile-full-width">Saved Quotations</h5>
            <div className="d-flex gap-2 mobile-full-width mobile-stack">
              <input
                type="text"
                className="form-control form-control-sm mobile-full-width"
                style={{ width: '250px' }}
                placeholder="Search quotations..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searchTerm && (
                <button className="btn btn-sm btn-outline-danger" onClick={resetSearch} title="Clear search">
                  <i className="bi bi-x-circle"></i>
                </button>
              )}
              <button className="btn btn-sm btn-outline-primary" onClick={fetchQuotations} disabled={loadingQuotations} title="Refresh">
                <i className="bi bi-arrow-clockwise"></i>
              </button>
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          {loadingQuotations ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2 text-muted mobile-text-small">Loading quotations...</p>
            </div>
          ) : savedQuotations.length > 0 ? (
            <>
              <div className="mobile-table">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th width="50">#</th>
                      <th>Quote No</th>
                      <th>Date</th>
                      <th>Company</th>
                      <th>Contact</th>
                      <th>Items</th>
                      <th>Status</th>
                      <th>Total (incl. Tax)</th>
                      <th width="200">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedQuotations.map((quote, index) => {
                      const isCompleted = quote.status?.toLowerCase() === 'completed';
                      const isDraft = quote.status?.toLowerCase() === 'draft';
                      const isRequote = quote.status?.toLowerCase() === 'requote';
                      const totalWithGST = quote.grand_total_with_gst || quote.grand_total || 0;

                      return (
                        <tr key={quote.id}>
                          <td>{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                          <td>
                            <strong className="mobile-text-small">{quote.quote_number || quote.quoteNo}</strong>
                            {isRequote && <span className="badge bg-warning ms-1">R</span>}
                          </td>
                          <td>
                            <span className="mobile-text-small">{quote.date || quote.date}</span>
                          </td>
                          <td>
                            <span className="mobile-text-small">{quote.company_name || quote.billTo}</span><br />
                            <small className="text-muted">{quote.contact_email || quote.contactEmail}</small>
                          </td>
                          <td>
                            <span className="mobile-text-small">{quote.contact_person || quote.contactPerson}</span><br />
                            <small className="text-muted">{quote.contact_mobile || quote.contactMob}</small>
                          </td>
                          <td>{(quote.items || []).length}</td>
                          <td>
                            <select
                              className={`form-select form-select-sm fw-bold ${quote.status === 'completed' || quote.status === 'approved' || quote.status === 'accepted' ? 'text-success border-success' :
                                quote.status === 'requote' || quote.status === 'pending' ? 'text-warning border-warning' :
                                  quote.status === 'rejected' || quote.status === 'cancelled' ? 'text-danger border-danger' :
                                    'text-primary border-primary'
                                }`}
                              value={quote.status || 'draft'}
                              onChange={(e) => updateQuotationStatus(quote.id, e.target.value)}
                              disabled={isCompleted}
                              style={{ minWidth: '110px' }}
                            >
                              <option value="draft">Draft</option>
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="accepted">Accepted</option>
                              <option value="completed">Completed</option>
                              <option value="rejected">Rejected</option>
                              <option value="requote">Re-quote</option>
                            </select>
                          </td>
                          <td>
                            <strong className="text-primary mobile-text-small">
                              ₹{totalWithGST.toFixed(2)}
                            </strong>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-info"
                                onClick={() => viewQuotation(quote)}
                                title="View"
                              >
                                <i className="bi bi-eye"></i>
                              </button>

                              {!isCompleted && (
                                <button
                                  className="btn btn-outline-warning"
                                  onClick={() => startEditQuotation(quote)}
                                  title="Edit"
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                              )}

                              {!isCompleted && (
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={() => startCreateReQuote(quote)}
                                  title="Re-quote"
                                >
                                  <i className="bi bi-arrow-repeat"></i>
                                </button>
                              )}

                              {!isCompleted && (
                                <button
                                  className="btn btn-outline-success"
                                  onClick={() => markAsCompleted(quote.id)}
                                  title="Complete"
                                >
                                  <i className="bi bi-check-circle"></i>
                                </button>
                              )}

                              <button
                                className="btn btn-outline-secondary"
                                onClick={() => printQuotation(quote)}
                                title="Print"
                              >
                                <i className="bi bi-printer"></i>
                              </button>

                              {!isCompleted && (
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => deleteQuotation(quote.id)}
                                  title="Delete"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

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
                <i className="bi bi-file-earmark-text display-1 text-muted"></i>
              </div>
              <h5 className="text-muted">No quotations found</h5>
              <p className="text-muted mobile-text-small">
                {searchTerm ? 'Try a different search term or ' : ''}
                Create your first quotation to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}