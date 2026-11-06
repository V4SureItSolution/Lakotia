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
  FormControl
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
  const [selectedItemForView, setSelectedItemForView] = useState(null);
  const [mobileView, setMobileView] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);

  // Saved quotations state
  const [savedQuotations, setSavedQuotations] = useState([]);
  const [flattenedItems, setFlattenedItems] = useState([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
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

  // Item status update state
  const [updatingItemStatus, setUpdatingItemStatus] = useState(false);
  const [itemStatusUpdates, setItemStatusUpdates] = useState({});
  const [itemRejectionReasons, setItemRejectionReasons] = useState({});
  const [showItemStatusModal, setShowItemStatusModal] = useState(false);
  const [quotationForStatusUpdate, setQuotationForStatusUpdate] = useState(null);
  const [currentItemForStatusUpdate, setCurrentItemForStatusUpdate] = useState(null);

  // Rejection reason modal
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [currentRejectionItem, setCurrentRejectionItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Convert to Task state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedItemForTask, setSelectedItemForTask] = useState(null);
  const [isUpdatingExistingTask, setIsUpdatingExistingTask] = useState(false);
  const [existingTaskId, setExistingTaskId] = useState(null);
  const [taskFormData, setTaskFormData] = useState({
    po_number: "",
    description: "",
    priority: "Medium",
    dueDate: "",
    assignedTo: "",
    note: "",
    quotation_id: "",
    quotation_number: "",
    company_name: "",
    company_address: "",
    item_id: "",
    item_name: "",
    supplier_part_no: "",
    cut_width: "",
    length: "",
    quantity: "",
    brand_code: "",
    batch_no: "",
    mrp: "",
    hsn_sac: "",
    unit: "",
  });
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskError, setTaskError] = useState(null);
  
  // Employees for task assignment
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Stock cache for buy prices
  const [stockCache, setStockCache] = useState({});

  // Filter state
  const [statusFilter, setStatusFilter] = useState("all");

  // API base URLs
  // Removed hardcoded API_BASE_URL
  const API_TASKS = `${API_BASE}/tasks`;
  const API_EMPLOYEES = `${API_BASE}/employee/all`;


  // Check if mobile view on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setMobileView(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch saved quotations from backend on component mount
  useEffect(() => {
    fetchQuotations();
    fetchQuotationCounts();
    fetchEmployees();
  }, [currentPage, searchTerm]);

  // Fetch employees for task assignment
  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await axios.get(API_EMPLOYEES);
      setEmployees(response.data || []);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

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
    if (item.batch_no) return item.batch_no;
    
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

  // Auto-generate PO number
  const generatePONumber = (quotationNumber) => {
    const timestamp = new Date().getTime().toString().slice(-8);
    const quotePart = quotationNumber?.slice(-4) || "0000";
    return `PO-${timestamp}-${quotePart}`;
  };

  // Fetch existing task for an item
  const fetchExistingTaskForItem = async (itemId) => {
    try {
      const response = await axios.get(`${API_BASE}/tasks/by-item/${itemId}`);
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch (err) {
      console.error("Error fetching existing task:", err);
      return null;
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

  // Flatten quotations into items array
  const flattenQuotationsToItems = (quotations) => {
    const items = [];
    
    quotations.forEach(quotation => {
      (quotation.items || []).forEach(item => {
        items.push({
          ...item,
          quotation_id: quotation.id,
          quotation_number: quotation.quote_number || quotation.quoteNo,
          quotation_date: quotation.date || quotation.date,
          quotation_time: quotation.time || quotation.time,
          company_name: quotation.company_name || quotation.billTo,
          company_address: quotation.company_address || "",
          company_gstin: quotation.company_gstin || "",
          contact_person: quotation.contact_person || quotation.contactPerson,
          contact_mobile: quotation.contact_mobile || quotation.contactMob,
          contact_email: quotation.contact_email || quotation.contactEmail,
          quotation_status: quotation.status || 'completed',
          quotation_grand_total: quotation.grand_total || quotation.totals?.grandTotal || 0
        });
      });
    });
    
    return items;
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
        
        // Flatten quotations to items array
        const flattened = flattenQuotationsToItems(quotationsWithBuyPrices);
        setFlattenedItems(flattened);
        
        setTotalItems(pagination.total || fetchedQuotations.length);
        setTotalPages(pagination.pages || Math.ceil((pagination.total || fetchedQuotations.length) / itemsPerPage) || 1);
      } else {
        throw new Error(response.data.message || "API response unsuccessful");
      }
    } catch (err) {
      console.error("Error loading quotations from API:", err);
      setSavedQuotations([]);
      setFlattenedItems([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoadingQuotations(false);
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
    const maxVisiblePages = mobileView ? 3 : 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) items.push(i);
        if (!mobileView) items.push("...");
        items.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        items.push(1);
        if (!mobileView) items.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) items.push(i);
      } else {
        items.push(1);
        if (!mobileView) items.push("...");
        items.push(currentPage - 1);
        items.push(currentPage);
        items.push(currentPage + 1);
        if (!mobileView) items.push("...");
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

  // View item details in modal
  const viewItemDetails = (item) => {
    setSelectedItemForView(item);
    // Find the full quotation for this item
    const quotation = savedQuotations.find(q => q.id === item.quotation_id);
    if (quotation) {
      setSelectedQuotation(quotation);
      setShowViewModal(true);
    }
  };

  // Open item status update modal for individual item
  const openSingleItemStatusModal = (item) => {
    const quotation = savedQuotations.find(q => q.id === item.quotation_id);
    if (!quotation) return;
    
    setQuotationForStatusUpdate(quotation);
    setCurrentItemForStatusUpdate(item);
    
    // Initialize status updates for this single item
    const initialUpdates = {};
    const initialRejectionReasons = {};
    initialUpdates[item.id] = item.sales_order_item_status || "not_created";
    initialRejectionReasons[item.id] = item.rejection_reason || "";
    
    setItemStatusUpdates(initialUpdates);
    setItemRejectionReasons(initialRejectionReasons);
    setShowItemStatusModal(true);
  };

  // Handle item status change
  const handleItemStatusChange = async (itemId, newStatus) => {
    if (newStatus === "rejected") {
      setCurrentRejectionItem({
        id: itemId,
        newStatus: newStatus
      });
      setShowRejectionModal(true);
    } else {
      setItemStatusUpdates(prev => ({
        ...prev,
        [itemId]: newStatus
      }));
    }
  };

  // Handle rejection reason submission
  const handleRejectionSubmit = async () => {
    if (!currentRejectionItem || !rejectionReason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }

    const { id, newStatus } = currentRejectionItem;
    
    try {
      const loggedInUser = localStorage.getItem("username") || "Admin User";
      
      const response = await axios.patch(
        `${API_BASE}/quotations/items/${id}/rejection-reason`,
        {
          rejection_reason: rejectionReason,
          updated_by: loggedInUser
        }
      );
      
      if (response.data.success) {
        setItemStatusUpdates(prev => ({
          ...prev,
          [id]: newStatus
        }));
        
        setItemRejectionReasons(prev => ({
          ...prev,
          [id]: rejectionReason
        }));
        
        setShowRejectionModal(false);
        setCurrentRejectionItem(null);
        setRejectionReason("");
        
        console.log("✅ Item rejected with reason:", rejectionReason);
      } else {
        throw new Error(response.data.message || "Failed to update rejection reason");
      }
    } catch (err) {
      console.error("❌ Error updating rejection reason:", err);
      alert("Failed to update rejection reason. Please try again.");
    }
  };

  // Update item statuses
  const updateItemStatuses = async () => {
    if (!quotationForStatusUpdate) return;
    
    setUpdatingItemStatus(true);
    
    try {
      const loggedInUser = localStorage.getItem("username") || "Admin User";
      
      const updates = [];
      
      for (const [itemId, salesOrderItemStatus] of Object.entries(itemStatusUpdates)) {
        const updateData = {
          id: parseInt(itemId),
          sales_order_item_status: salesOrderItemStatus
        };
        
        if (salesOrderItemStatus === "rejected" && itemRejectionReasons[itemId]) {
          updateData.rejection_reason = itemRejectionReasons[itemId];
        }
        
        if (salesOrderItemStatus === "ordered") {
          updateData.sales_order_created = true;
        }
        
        updates.push(updateData);
      }
      
      const response = await axios.put(
        `${API_BASE}/quotations/${quotationForStatusUpdate.id}/items/status`,
        {
          item_updates: updates,
          updated_by: loggedInUser
        }
      );
      
      if (response.data.success) {
        alert(`✅ Item statuses updated successfully!`);
        
        const refreshedResponse = await axios.get(`${API_BASE}/quotations/${quotationForStatusUpdate.id}`);
        if (refreshedResponse.data.success) {
          setSelectedQuotation(refreshedResponse.data.data);
          await fetchQuotations();
        }
        
        setShowItemStatusModal(false);
        setQuotationForStatusUpdate(null);
        setCurrentItemForStatusUpdate(null);
        setItemStatusUpdates({});
        setItemRejectionReasons({});
      } else {
        throw new Error(response.data.message || "Failed to update item statuses");
      }
    } catch (err) {
      console.error("Update item statuses failed:", err);
      alert("Failed to update item statuses. Please try again.");
    } finally {
      setUpdatingItemStatus(false);
    }
  };

  // Open Task Creation/Update Modal
  const openTaskModal = async (item, quotation) => {
    const loggedInUser = localStorage.getItem("username") || "Admin User";
    const loggedInEmail = localStorage.getItem("email") || "admin@example.com";
    
    const existingTask = await fetchExistingTaskForItem(item.id);
    
    setSelectedItemForTask({
      ...item,
      quotation_id: quotation.id,
      quotation_number: quotation.quote_number || quotation.quoteNo,
      company_name: quotation.company_name || quotation.billTo,
      company_address: quotation.company_address || "",
      contact_person: quotation.contact_person || quotation.contactPerson
    });
    
    if (existingTask) {
      setIsUpdatingExistingTask(true);
      setExistingTaskId(existingTask.id);
      
      setTaskFormData({
        po_number: existingTask.po_number || generatePONumber(quotation.quote_number || quotation.quoteNo),
        description: existingTask.description || item.description || "",
        priority: existingTask.priority || "Medium",
        dueDate: existingTask.dueDate ? existingTask.dueDate.split('T')[0] : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        assignedTo: existingTask.assignedTo || "",
        note: existingTask.note || `From Quotation: ${quotation.quote_number || "N/A"} - ${quotation.company_name || "Company"}`,
        quotation_id: quotation.id,
        quotation_number: quotation.quote_number || quotation.quoteNo,
        company_name: quotation.company_name || quotation.billTo,
        company_address: quotation.company_address || "",
        item_id: item.id,
        item_name: item.item_name,
        supplier_part_no: item.supplier_part_no || existingTask.supplier_part_no || "",
        cut_width: item.cut_width || existingTask.cut_width || "",
        length: item.length || existingTask.length || "",
        quantity: item.quantity || existingTask.quantity || 1,
        brand_code: item.brand_code || existingTask.brand_code || "",
        batch_no: item.batch_no || existingTask.batch_no || "",
        mrp: item.mrp || item.price_per_unit || existingTask.mrp || "",
        hsn_sac: item.hsn_sac || existingTask.hsn_sac || "",
        unit: item.unit || existingTask.unit || "",
      });
    } else {
      setIsUpdatingExistingTask(false);
      setExistingTaskId(null);
      
      const poNumber = generatePONumber(quotation.quote_number || quotation.quoteNo);
      
      setTaskFormData({
        po_number: poNumber,
        description: item.description || "",
        priority: "Medium",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        assignedTo: "",
        note: `From Quotation: ${quotation.quote_number || "N/A"} - ${quotation.company_name || "Company"}`,
        quotation_id: quotation.id,
        quotation_number: quotation.quote_number || quotation.quoteNo,
        company_name: quotation.company_name || quotation.billTo,
        company_address: quotation.company_address || "",
        item_id: item.id,
        item_name: item.item_name,
        supplier_part_no: item.supplier_part_no || "",
        cut_width: item.cut_width || "",
        length: item.length || "",
        quantity: item.quantity || 1,
        brand_code: item.brand_code || "",
        batch_no: item.batch_no || "",
        mrp: item.mrp || item.price_per_unit || "",
        hsn_sac: item.hsn_sac || "",
        unit: item.unit || "",
      });
    }
    
    setShowTaskModal(true);
  };

  // Handle task form change
  const handleTaskFormChange = (e) => {
    const { name, value } = e.target;
    setTaskFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Create new Task (Sales Order)
  const createTask = async () => {
    if (!taskFormData.assignedTo) {
      alert("Please assign the task to an employee.");
      return;
    }
    
    setCreatingTask(true);
    setTaskError(null);
    
    try {
      const loggedInUser = localStorage.getItem("username") || "Admin User";
      const loggedInEmail = localStorage.getItem("email") || "admin@example.com";
      
      const taskData = {
        po_number: taskFormData.po_number,
        description: taskFormData.description,
        priority: taskFormData.priority,
        dueDate: taskFormData.dueDate,
        assignedTo: taskFormData.assignedTo,
        assignedBy: loggedInUser,
        assignedByEmail: loggedInEmail,
        
        quotation_id: taskFormData.quotation_id,
        quotation_number: taskFormData.quotation_number,
        company_name: taskFormData.company_name,
        company_address: taskFormData.company_address,
        
        item_id: taskFormData.item_id,
        item_name: taskFormData.item_name,
        supplier_part_no: taskFormData.supplier_part_no,
        cut_width: taskFormData.cut_width,
        length: taskFormData.length,
        quantity: taskFormData.quantity,
        
        brand_code: taskFormData.brand_code,
        batch_no: taskFormData.batch_no,
        mrp: taskFormData.mrp,
        hsn_sac: taskFormData.hsn_sac,
        unit: taskFormData.unit,
        
        status: "Pending",
        note: taskFormData.note,
      };
      
      let response;
      
      if (isUpdatingExistingTask && existingTaskId) {
        console.log("📤 Updating existing sales order (task) with data:", taskData);
        response = await axios.put(`${API_TASKS}/${existingTaskId}`, taskData);
      } else {
        console.log("📤 Creating sales order (task) with data:", taskData);
        response = await axios.post(API_TASKS, taskData);
      }
      
      if (response.data) {
        alert(`✅ Sales Order ${isUpdatingExistingTask ? 'updated' : 'created'} successfully with PO number!`);
        
        try {
          await axios.patch(
            `${API_BASE}/quotations/items/${taskFormData.item_id}/sales-order-status`,
            {
              sales_order_item_status: "ordered",
              updated_by: loggedInUser
            }
          );
          
          await axios.patch(
            `${API_BASE}/quotations/items/${taskFormData.item_id}/mark-sales-order`,
            {
              remark: `Sales order ${isUpdatingExistingTask ? 'updated' : 'created'} with PO: ${taskFormData.po_number}`,
              updated_by: loggedInUser
            }
          );
          
          console.log(`✅ Item sales order status updated to 'ordered'`);
        } catch (statusErr) {
          console.error("❌ Error updating item sales order status:", statusErr);
        }
        
        setShowTaskModal(false);
        setSelectedItemForTask(null);
        setIsUpdatingExistingTask(false);
        setExistingTaskId(null);
        setTaskFormData({
          po_number: "",
          description: "",
          priority: "Medium",
          dueDate: "",
          assignedTo: "",
          note: "",
          quotation_id: "",
          quotation_number: "",
          company_name: "",
          company_address: "",
          item_id: "",
          item_name: "",
          supplier_part_no: "",
          cut_width: "",
          length: "",
          quantity: "",
          brand_code: "",
          batch_no: "",
          mrp: "",
          hsn_sac: "",
          unit: "",
        });
        
        await fetchQuotations();
        
        if (selectedQuotation && selectedQuotation.id === taskFormData.quotation_id) {
          const refreshedResponse = await axios.get(`${API_BASE}/quotations/${taskFormData.quotation_id}`);
          if (refreshedResponse.data.success) {
            setSelectedQuotation(refreshedResponse.data.data);
          }
        }
      } else {
        throw new Error(`Failed to ${isUpdatingExistingTask ? 'update' : 'create'} sales order`);
      }
    } catch (err) {
      console.error(`❌ Error ${isUpdatingExistingTask ? 'updating' : 'creating'} sales order:`, err.response?.data || err.message);
      setTaskError(err.response?.data?.message || `Failed to ${isUpdatingExistingTask ? 'update' : 'create'} sales order. Please try again.`);
      alert(`❌ Failed to ${isUpdatingExistingTask ? 'update' : 'create'} sales order: ${err.response?.data?.message || err.message}`);
    } finally {
      setCreatingTask(false);
    }
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
            .table { font-size: 11px; }
            .summary-table { font-size: 11px; }
          }
          @media (max-width: 768px) {
            .invoice-header { padding: 10px; }
            h1 { font-size: 20px; }
            h2 { font-size: 18px; }
            .table { font-size: 10px; }
            .summary-table { font-size: 10px; }
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

  // Filter items by status
  const getFilteredItems = () => {
    if (statusFilter === "all") {
      return flattenedItems;
    }
    return flattenedItems.filter(item => 
      (item.sales_order_item_status || "not_created") === statusFilter
    );
  };

  // Mobile Card View for Items
  const MobileItemCard = ({ item, index }) => {
    const itemStatus = item.sales_order_item_status || "not_created";
    const isExpanded = expandedItem === `${item.quotation_id}-${item.id}`;
    
    return (
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Header className={`bg-light py-2 d-flex justify-content-between align-items-center ${itemStatus === 'rejected' ? 'border-danger' : ''}`}>
          <div className="d-flex align-items-center gap-2">
            <Badge bg="secondary" className="me-2">{((currentPage - 1) * itemsPerPage) + index + 1}</Badge>
            <div>
              <div className="fw-bold small">{item.quotation_number}</div>
              <small className="text-muted">{item.quotation_date}</small>
            </div>
          </div>
          <Badge bg={getStatusBadgeColor(itemStatus)}>
            {getStatusDisplayText(itemStatus)}
          </Badge>
        </Card.Header>
        <Card.Body className="p-3">
          <div className="mb-2">
            <div className="fw-bold">{item.item_name}</div>
            <small className="text-muted">{item.description?.substring(0, 60)}...</small>
          </div>
          
          <div className="row g-2 mb-2">
            <div className="col-6">
              <small className="text-muted d-block">Company</small>
              <div className="small">{item.company_name}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Contact</small>
              <div className="small">{item.contact_person}</div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Brand Code</small>
              <div>
                {item.brand_code ? (
                  <Badge bg="primary">{item.brand_code}</Badge>
                ) : '-'}
              </div>
            </div>
            <div className="col-6">
              <small className="text-muted d-block">Batch No</small>
              <div>
                {item.batch_no ? (
                  <Badge bg="secondary">{item.batch_no}</Badge>
                ) : '-'}
              </div>
            </div>
            <div className="col-4">
              <small className="text-muted d-block">Qty</small>
              <div className="fw-bold">{item.quantity || 1}</div>
            </div>
            <div className="col-4">
              <small className="text-muted d-block">Unit</small>
              <div>{item.unit || 'pcs'}</div>
            </div>
            <div className="col-4">
              <small className="text-muted d-block">Price</small>
              <div className="fw-bold">₹{(item.price_per_unit || 0).toFixed(2)}</div>
            </div>
          </div>
          
          <button
            className="btn btn-link btn-sm text-decoration-none p-0 mb-2"
            onClick={() => setExpandedItem(isExpanded ? null : `${item.quotation_id}-${item.id}`)}
          >
            {isExpanded ? '▲ Show less' : '▼ Show more details'}
          </button>
          
          {isExpanded && (
            <div className="border-top pt-2 mt-1">
              <div className="row g-2">
                <div className="col-6">
                  <small className="text-muted">Part No:</small>
                  <div className="small">{item.supplier_part_no || '-'}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Amount:</small>
                  <div className="fw-bold text-success">₹{(item.amount_after_discount || 0).toFixed(2)}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Buy Price:</small>
                  <div className="small text-success">₹{(item.buy_price || 0).toFixed(2)}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">NBP:</small>
                  <div className="small">₹{(item.mrp || 0).toFixed(2)}</div>
                </div>
                {item.rejection_reason && (
                  <div className="col-12">
                    <small className="text-muted">Rejection:</small>
                    <div className="small text-danger">{item.rejection_reason}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card.Body>
        <Card.Footer className="bg-white py-2">
          <div className="d-flex gap-2 justify-content-end">
            <Button
              variant="outline-info"
              size="sm"
              onClick={() => viewItemDetails(item)}
            >
              <i className="bi bi-eye"></i> View
            </Button>
            <Button
              variant="outline-success"
              size="sm"
              onClick={() => openSingleItemStatusModal(item)}
            >
              <i className="bi bi-check-circle"></i> Status
            </Button>
            {itemStatus !== "rejected" && (
              <Button
                variant={itemStatus === "ordered" ? "outline-primary" : "outline-warning"}
                size="sm"
                onClick={() => {
                  const quotation = savedQuotations.find(q => q.id === item.quotation_id);
                  if (quotation) openTaskModal(item, quotation);
                }}
              >
                <i className="bi bi-clipboard-check"></i> SO
              </Button>
            )}
          </div>
        </Card.Footer>
      </Card>
    );
  };

  // Rejection Reason Modal
  const renderRejectionModal = () => (
    <Modal show={showRejectionModal} onHide={() => {
      setShowRejectionModal(false);
      setCurrentRejectionItem(null);
      setRejectionReason("");
    }} centered size={mobileView ? "sm" : "md"}>
      <Modal.Header closeButton className="bg-danger text-white">
        <Modal.Title className="fs-6">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Rejection Reason
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="warning" className="mb-3 py-2">
          <small>
            <i className="bi bi-info-circle me-2"></i>
            You are marking an item as <strong>Rejected</strong>. Please provide a reason.
          </small>
        </Alert>
        
        <Form.Group>
          <Form.Label className="fw-bold small">Rejection Reason *</Form.Label>
          <Form.Control
            as="textarea"
            rows={mobileView ? 2 : 3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Enter reason for rejection..."
            required
            size={mobileView ? "sm" : undefined}
          />
        </Form.Group>
        
        {currentRejectionItem && (
          <Alert variant="info" className="mt-3 py-2">
            <small>
              <i className="bi bi-box me-2"></i>
              <strong>Item:</strong> {flattenedItems.find(item => item.id === currentRejectionItem.id)?.item_name}
            </small>
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button 
          variant="secondary" 
          size={mobileView ? "sm" : undefined}
          onClick={() => {
            setShowRejectionModal(false);
            setCurrentRejectionItem(null);
            setRejectionReason("");
          }}
        >
          Cancel
        </Button>
        <Button 
          variant="danger" 
          size={mobileView ? "sm" : undefined}
          onClick={handleRejectionSubmit}
          disabled={!rejectionReason.trim()}
        >
          <i className="bi bi-check-circle me-1"></i>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );

  // Task Creation/Update Modal
  const renderTaskModal = () => (
    <Modal show={showTaskModal} onHide={() => {
      setShowTaskModal(false);
      setSelectedItemForTask(null);
      setIsUpdatingExistingTask(false);
      setExistingTaskId(null);
      setTaskFormData({
        po_number: "",
        description: "",
        priority: "Medium",
        dueDate: "",
        assignedTo: "",
        note: "",
        quotation_id: "",
        quotation_number: "",
        company_name: "",
        company_address: "",
        item_id: "",
        item_name: "",
        supplier_part_no: "",
        cut_width: "",
        length: "",
        quantity: "",
        brand_code: "",
        batch_no: "",
        mrp: "",
        hsn_sac: "",
        unit: "",
      });
    }} centered size={mobileView ? "fullscreen" : "lg"}>
      <Modal.Header closeButton className="bg-warning text-dark py-2">
        <Modal.Title className="fs-6">
          <i className="bi bi-clipboard-check me-2"></i>
          {isUpdatingExistingTask ? 'Update Sales Order' : 'Create Sales Order'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-2">
        {selectedItemForTask && (
          <>
            <Alert variant={isUpdatingExistingTask ? "info" : "success"} className="mb-3 py-2">
              <small>
                <i className="bi bi-info-circle me-2"></i>
                {isUpdatingExistingTask 
                  ? `Updating sales order for: ${selectedItemForTask.item_name}`
                  : 'Creating sales order - will mark item as "ordered"'}
              </small>
            </Alert>

            <Card className="mb-3">
              <Card.Header className="bg-light py-1">
                <h6 className="mb-0 small fw-bold">Item Details</h6>
              </Card.Header>
              <Card.Body className="p-2">
                <div className="row g-2">
                  <div className="col-12">
                    <small className="text-muted">Item:</small>
                    <div className="fw-bold small">{selectedItemForTask.item_name}</div>
                  </div>
                  <div className="col-6">
                    <small className="text-muted">Quotation:</small>
                    <div className="small">{selectedItemForTask.quotation_number}</div>
                  </div>
                  <div className="col-6">
                    <small className="text-muted">Company:</small>
                    <div className="small">{selectedItemForTask.company_name}</div>
                  </div>
                  <div className="col-4">
                    <small className="text-muted">Qty:</small>
                    <div className="small">{selectedItemForTask.quantity || 1}</div>
                  </div>
                  <div className="col-4">
                    <small className="text-muted">Brand Code:</small>
                    <div className="small">{selectedItemForTask.brand_code || 'N/A'}</div>
                  </div>
                  <div className="col-4">
                    <small className="text-muted">Batch:</small>
                    <div className="small">{selectedItemForTask.batch_no || 'N/A'}</div>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card className="mb-3">
              <Card.Header className="bg-light py-1">
                <h6 className="mb-0 small fw-bold">Sales Order Details</h6>
              </Card.Header>
              <Card.Body className="p-2">
                <Form.Group className="mb-2">
                  <Form.Label className="fw-bold small">PO NUMBER *</Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    name="po_number"
                    value={taskFormData.po_number}
                    onChange={handleTaskFormChange}
                    required
                    placeholder="PO number"
                  />
                </Form.Group>
                
                <Form.Group className="mb-2">
                  <Form.Label className="fw-bold small">Assign To *</Form.Label>
                  <Form.Select
                    size="sm"
                    name="assignedTo"
                    value={taskFormData.assignedTo}
                    onChange={handleTaskFormChange}
                    required
                    disabled={loadingEmployees}
                  >
                    <option value="">-- Select Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.email}>
                        {emp.name} ({emp.email})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                
                <Row className="mb-2 g-2">
                  <Col xs={6}>
                    <Form.Group>
                      <Form.Label className="fw-bold small">Priority</Form.Label>
                      <Form.Select
                        size="sm"
                        name="priority"
                        value={taskFormData.priority}
                        onChange={handleTaskFormChange}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xs={6}>
                    <Form.Group>
                      <Form.Label className="fw-bold small">Due Date *</Form.Label>
                      <Form.Control
                        type="date"
                        size="sm"
                        name="dueDate"
                        value={taskFormData.dueDate}
                        onChange={handleTaskFormChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {taskError && (
              <Alert variant="danger" className="mb-2 py-2">
                <small>
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {taskError}
                </small>
              </Alert>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => {
            setShowTaskModal(false);
            setSelectedItemForTask(null);
            setIsUpdatingExistingTask(false);
            setExistingTaskId(null);
          }}
          disabled={creatingTask}
        >
          Cancel
        </Button>
        <Button 
          variant={isUpdatingExistingTask ? "primary" : "warning"} 
          size="sm"
          onClick={createTask}
          disabled={creatingTask || !taskFormData.assignedTo || !taskFormData.dueDate || !taskFormData.po_number}
        >
          {creatingTask ? (
            <>
              <Spinner animation="border" size="sm" className="me-1" />
              {isUpdatingExistingTask ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>
              <i className="bi bi-clipboard-check me-1"></i>
              {isUpdatingExistingTask ? 'Update' : 'Create'}
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );

  return (
    <Container fluid className="py-2 py-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3">
        <div>
          <h1 className="h4 h2-md mb-1">
            {mobileView ? "Completed Quotations" : "Completed Quotations - Item Wise View"}
          </h1>
          <p className="text-muted mb-0 small">
            {mobileView ? `${flattenedItems.length} total items` : "View and manage individual items across all completed quotations"}
          </p>
        </div>
      </div>

      {/* Statistics Cards - Mobile Optimized */}
      <Row className="mb-3 g-2">
        <Col xs={4} md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex flex-column align-items-center text-center">
                <div className="rounded-circle bg-success bg-opacity-10 p-2 p-md-3 mb-1 mb-md-2">
                  <i className="bi bi-check-circle text-success fs-6 fs-md-4"></i>
                </div>
                <div className="small text-muted">Total</div>
                <div className="h6 h5-md mb-0">{quotationCounts.completed}</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={4} md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex flex-column align-items-center text-center">
                <div className="rounded-circle bg-info bg-opacity-10 p-2 p-md-3 mb-1 mb-md-2">
                  <i className="bi bi-box-seam text-info fs-6 fs-md-4"></i>
                </div>
                <div className="small text-muted">Items</div>
                <div className="h6 h5-md mb-0">{flattenedItems.length}</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={4} md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex flex-column align-items-center text-center">
                <div className="rounded-circle bg-warning bg-opacity-10 p-2 p-md-3 mb-1 mb-md-2">
                  <i className="bi bi-truck text-warning fs-6 fs-md-4"></i>
                </div>
                <div className="small text-muted">Pending</div>
                <div className="h6 h5-md mb-0">
                  {flattenedItems.filter(item => 
                    (item.sales_order_item_status || "not_created") === "not_created"
                  ).length}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Rejection Reason Modal */}
      {renderRejectionModal()}

      {/* Item Status Update Modal */}
      <Modal show={showItemStatusModal} onHide={() => {
        setShowItemStatusModal(false);
        setQuotationForStatusUpdate(null);
        setCurrentItemForStatusUpdate(null);
        setItemStatusUpdates({});
        setItemRejectionReasons({});
      }} size={mobileView ? "fullscreen" : "lg"}>
        <Modal.Header closeButton className="bg-success text-white py-2">
          <Modal.Title className="fs-6">
            <i className="bi bi-check-circle me-2"></i>
            Update Item Status
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-2">
          {currentItemForStatusUpdate && (
            <>
              <Alert variant="info" className="mb-3 py-2">
                <small>
                  <i className="bi bi-info-circle me-2"></i>
                  Updating status for: <strong>{currentItemForStatusUpdate.item_name}</strong>
                  <br/>
                  Quotation: {currentItemForStatusUpdate.quotation_number}
                </small>
              </Alert>

              <Card>
                <Card.Body className="p-2">
                  <div className="mb-2">
                    <div className="fw-bold small">{currentItemForStatusUpdate.item_name}</div>
                    <small className="text-muted">{currentItemForStatusUpdate.description?.substring(0, 60)}...</small>
                  </div>
                  
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <small className="text-muted">Brand Code:</small>
                      <div>{currentItemForStatusUpdate.brand_code || '-'}</div>
                    </div>
                    <div className="col-6">
                      <small className="text-muted">Batch No:</small>
                      <div>{currentItemForStatusUpdate.batch_no || '-'}</div>
                    </div>
                    <div className="col-6">
                      <small className="text-muted">Current Status:</small>
                      <div>
                        <Badge bg={getStatusBadgeColor(currentItemForStatusUpdate.sales_order_item_status || "not_created")}>
                          {getStatusDisplayText(currentItemForStatusUpdate.sales_order_item_status || "not_created")}
                        </Badge>
                      </div>
                    </div>
                    <div className="col-12 mt-2">
                      <Form.Group>
                        <Form.Label className="fw-bold small">New Status</Form.Label>
                        <Form.Select
                          size="sm"
                          value={itemStatusUpdates[currentItemForStatusUpdate.id] || currentItemForStatusUpdate.sales_order_item_status || "not_created"}
                          onChange={(e) => handleItemStatusChange(currentItemForStatusUpdate.id, e.target.value)}
                          disabled={updatingItemStatus}
                        >
                          <option value="not_created">⬜ Not Created</option>
                          <option value="ordered">🟢 Ordered</option>
                          <option value="rejected">🔴 Rejected</option>
                        </Form.Select>
                      </Form.Group>
                      
                      {itemStatusUpdates[currentItemForStatusUpdate.id] === "rejected" && itemRejectionReasons[currentItemForStatusUpdate.id] && (
                        <div className="mt-2 p-2 bg-danger bg-opacity-10 rounded">
                          <small className="text-danger">
                            <i className="bi bi-chat-left-text me-1"></i>
                            {itemRejectionReasons[currentItemForStatusUpdate.id]}
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => {
              setShowItemStatusModal(false);
              setQuotationForStatusUpdate(null);
              setCurrentItemForStatusUpdate(null);
              setItemStatusUpdates({});
              setItemRejectionReasons({});
            }}
            disabled={updatingItemStatus}
          >
            Cancel
          </Button>
          <Button 
            variant="success" 
            size="sm"
            onClick={updateItemStatuses}
            disabled={updatingItemStatus}
          >
            {updatingItemStatus ? (
              <>
                <Spinner animation="border" size="sm" className="me-1" />
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-save me-1"></i>Save
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Task Creation/Update Modal */}
      {renderTaskModal()}

      {/* View Quotation Modal */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size={mobileView ? "fullscreen" : "xl"}>
        <Modal.Header closeButton className="bg-info text-white py-2">
          <Modal.Title className="fs-6">
            Quotation - {selectedQuotation?.quote_number || selectedQuotation?.quoteNo}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-2" style={{ maxHeight: mobileView ? 'calc(100vh - 120px)' : '70vh', overflowY: 'auto' }}>
          {selectedQuotation && (
            <Container>
              <div className="invoice-header border-bottom pb-2 mb-2">
                <Row>
                  <Col xs={3} md={2}>
                    <img 
                      src="E:/Lakotia/lakotia/src/Components/Name1.jpg" 
                      alt="Company Logo" 
                      className="img-fluid"
                      style={{ maxWidth: mobileView ? '60px' : '120px' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </Col>
                  <Col xs={9} md={5}>
                    <h5 className="mb-0 fs-6 fw-bold">{issuer.name}</h5>
                    <p className="mb-0 small">{issuer.address.slice(0, 30)}...</p>
                    <p className="mb-0 small">GST: {issuer.gstin}</p>
                  </Col>
                  <Col xs={12} md={5} className="text-md-end mt-2 mt-md-0">
                    <h6 className="text-info mb-1">QUOTATION</h6>
                    <p className="mb-0 small"><strong>No:</strong> {selectedQuotation.quote_number || selectedQuotation.quoteNo}</p>
                    <p className="mb-0 small"><strong>Date:</strong> {selectedQuotation.date || selectedQuotation.date}</p>
                  </Col>
                </Row>
              </div>
              
              <Row className="mb-2">
                <Col xs={12}>
                  <h6 className="small fw-bold mb-1">Bill To:</h6>
                  <p className="small mb-0"><strong>{selectedQuotation.company_name || selectedQuotation.billTo}</strong></p>
                  <p className="small mb-0">{selectedQuotation.contact_person || selectedQuotation.contactPerson}</p>
                </Col>
              </Row>
              
              {/* Mobile Card View for Items in Modal */}
              {mobileView ? (
                (selectedQuotation.items || []).map((item, index) => (
                  <Card key={index} className="mb-2">
                    <Card.Body className="p-2">
                      <div className="fw-bold small">{item.item_name}</div>
                      <div className="row g-1 mt-1">
                        <div className="col-6">
                          <small className="text-muted">Qty:</small>
                          <div className="small">{item.quantity || 1}</div>
                        </div>
                        <div className="col-6">
                          <small className="text-muted">Price:</small>
                          <div className="small">₹{(item.price_per_unit || 0).toFixed(2)}</div>
                        </div>
                        <div className="col-6">
                          <small className="text-muted">Brand:</small>
                          <div className="small">{item.brand_code || '-'}</div>
                        </div>
                        <div className="col-6">
                          <small className="text-muted">Batch:</small>
                          <div className="small">{item.batch_no || '-'}</div>
                        </div>
                        <div className="col-12">
                          <Badge bg={getStatusBadgeColor(item.sales_order_item_status || "not_created")} className="mt-1">
                            {getStatusDisplayText(item.sales_order_item_status || "not_created")}
                          </Badge>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                ))
              ) : (
                <Table bordered responsive size="sm">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Item Name</th>
                      <th>Brand Code</th>
                      <th>Batch No</th>
                      <th>Part No</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedQuotation.items || []).map((item, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>
                          <div className="fw-bold small">{item.item_name}</div>
                          <small className="text-muted">{item.description?.substring(0, 30)}...</small>
                        </td>
                        <td>{item.brand_code || '-'}</td>
                        <td>{item.batch_no || '-'}</td>
                        <td>{item.supplier_part_no || '-'}</td>
                        <td>{item.quantity || 1}</td>
                        <td>₹{(item.price_per_unit || 0).toFixed(2)}</td>
                        <td>₹{(item.amount_after_discount || 0).toFixed(2)}</td>
                        <td>
                          <Badge bg={getStatusBadgeColor(item.sales_order_item_status || "not_created")}>
                            {getStatusDisplayText(item.sales_order_item_status || "not_created")}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              
              <Row className="mt-2">
                <Col xs={12}>
                  <Card className="border-0 bg-light">
                    <Card.Body className="p-2">
                      <div className="d-flex justify-content-end">
                        <div style={{ width: mobileView ? '100%' : '300px' }}>
                          <div className="d-flex justify-content-between mb-1">
                            <span className="small">Subtotal:</span>
                            <span className="small">₹{(selectedQuotation.subtotal || selectedQuotation.totals?.subtotal || 0).toFixed(2)}</span>
                          </div>
                          <div className="d-flex justify-content-between mb-1">
                            <span className="small">Tax:</span>
                            <span className="small">₹{(selectedQuotation.total_tax || selectedQuotation.totals?.totalGST || 0).toFixed(2)}</span>
                          </div>
                          <hr className="my-1"/>
                          <div className="d-flex justify-content-between">
                            <span className="fw-bold small">Grand Total:</span>
                            <span className="fw-bold text-primary small">₹{(selectedQuotation.grand_total || selectedQuotation.totals?.grandTotal || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Container>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setShowViewModal(false)}>
            <i className="bi bi-x-circle me-1"></i>Close
          </Button>
          <Button variant="primary" size="sm" onClick={() => printQuotation(selectedQuotation)}>
            <i className="bi bi-printer me-1"></i>Print
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Main Items View */}
      <Card>
        <Card.Header className="bg-light py-2">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
            <h5 className="mb-0 fs-6">
              <i className="bi bi-list-check me-2"></i>
              {mobileView ? 'Items' : 'All Items from Completed Quotations'}
              <Badge bg="secondary" className="ms-2">{flattenedItems.length}</Badge>
            </h5>
            <div className="d-flex flex-wrap gap-2 w-100 w-md-auto">
              {/* Status Filter */}
              <Form.Select 
                size="sm" 
                style={{ width: mobileView ? '100%' : '140px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="not_created">Not Created</option>
                <option value="ordered">Ordered</option>
                <option value="rejected">Rejected</option>
              </Form.Select>

              {/* Search */}
              <InputGroup size="sm" className="flex-grow-1">
                <FormControl
                  placeholder={mobileView ? "Search..." : "Search items..."}
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {searchTerm && (
                  <Button variant="outline-danger" onClick={resetSearch}>
                    <i className="bi bi-x-circle"></i>
                  </Button>
                )}
              </InputGroup>
              
              <Button variant="outline-primary" size="sm" onClick={fetchQuotations} disabled={loadingQuotations}>
                <i className="bi bi-arrow-clockwise"></i>
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-2 p-md-3">
          {loadingQuotations ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted small">Loading items...</p>
            </div>
          ) : getFilteredItems().length > 0 ? (
            <>
              {mobileView ? (
                // Mobile Card View
                <div className="items-mobile-view">
                  {getFilteredItems().map((item, index) => (
                    <MobileItemCard key={`${item.quotation_id}-${item.id}-${index}`} item={item} index={index} />
                  ))}
                </div>
              ) : (
                // Desktop Table View
                <div className="table-responsive">
                  <Table hover responsive className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th width="50">#</th>
                        <th>Quotation No</th>
                        <th>Date</th>
                        <th>Company</th>
                        <th>Item Name</th>
                        <th>Brand Code</th>
                        <th>Batch No</th>
                        <th>Part No</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th width="180">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredItems().map((item, index) => {
                        const itemStatus = item.sales_order_item_status || "not_created";
                        
                        return (
                          <tr key={`${item.quotation_id}-${item.id}-${index}`}>
                            <td>{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                            <td>
                              <span className="text-primary small fw-bold">{item.quotation_number}</span>
                            </td>
                            <td>
                              <small>{item.quotation_date}</small>
                            </td>
                            <td>
                              <div className="small fw-bold">{item.company_name}</div>
                              <small className="text-muted">{item.contact_person}</small>
                            </td>
                            <td>
                              <div className="small fw-bold">{item.item_name}</div>
                              <small className="text-muted">{item.description?.substring(0, 30)}...</small>
                            </td>
                            <td>{item.brand_code || '-'}</td>
                            <td>{item.batch_no || '-'}</td>
                            <td>{item.supplier_part_no || '-'}</td>
                            <td>{item.quantity || 1}</td>
                            <td>₹{(item.price_per_unit || 0).toFixed(2)}</td>
                            <td>
                              <span className="fw-bold">₹{(item.amount_after_discount || 0).toFixed(2)}</span>
                            </td>
                            <td>
                              <Badge bg={getStatusBadgeColor(itemStatus)}>
                                {getStatusDisplayText(itemStatus)}
                              </Badge>
                            </td>
                            <td>
                              <div className="btn-group btn-group-sm">
                                <Button
                                  variant="outline-info"
                                  size="sm"
                                  onClick={() => viewItemDetails(item)}
                                >
                                  <i className="bi bi-eye"></i>
                                </Button>
                                <Button
                                  variant="outline-success"
                                  size="sm"
                                  onClick={() => openSingleItemStatusModal(item)}
                                >
                                  <i className="bi bi-check-circle"></i>
                                </Button>
                                {itemStatus !== "rejected" && (
                                  <Button
                                    variant={itemStatus === "ordered" ? "outline-primary" : "outline-warning"}
                                    size="sm"
                                    onClick={() => {
                                      const quotation = savedQuotations.find(q => q.id === item.quotation_id);
                                      if (quotation) openTaskModal(item, quotation);
                                    }}
                                  >
                                    <i className="bi bi-clipboard-check"></i>
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-center p-2 p-md-3 border-top mt-2">
                  <div className="text-muted small mb-2 mb-md-0">
                    {mobileView ? (
                      <>Page {currentPage} of {totalPages}</>
                    ) : (
                      <>Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, getFilteredItems().length)} of {getFilteredItems().length} items</>
                    )}
                  </div>
                  <Pagination size="sm" className="mb-0">
                    <Pagination.Prev 
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    />
                    
                    {getPaginationItems().map((pageNum, idx) => (
                      <Pagination.Item
                        key={idx}
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
                <i className="bi bi-inbox display-1 text-muted"></i>
              </div>
              <h5 className="text-muted small">No items found</h5>
              <p className="text-muted small">
                {searchTerm ? 'Try a different search term' : 'No items available in completed quotations.'}
              </p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Mobile Styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          .modal-fullscreen-md-down {
            margin: 0;
          }
          .btn {
            white-space: nowrap;
          }
          .table-responsive {
            font-size: 0.75rem;
          }
          .card-header {
            padding: 0.5rem;
          }
          .card-body {
            padding: 0.5rem;
          }
        }
      `}</style>
    </Container>
  );
}