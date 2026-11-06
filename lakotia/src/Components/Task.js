import React, { useState, useEffect, useMemo } from "react";
import { Modal, Button, Form, Table, Spinner, Alert, Badge, Pagination, Card, Row, Col } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import { API_BASE } from "../config";
import { notifyDataChange, subscribeToDataSync } from "../utils/syncUtils";

const API_URL = `${API_BASE}/tasks`;
const API_EMPLOYEES = `${API_BASE}/employee/all`;
const API_QUOTATIONS = `${API_BASE}/quotations`;

const TaskPage = () => {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [approvedItems, setApprovedItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState(null);
  const [showReworkModal, setShowReworkModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [reworkNote, setReworkNote] = useState("");
  
  // ✅ Search and Pagination states
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [tasksPerPage] = useState(10);
  
  // ✅ Status filter states
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");

  // ✅ New states for view modal and invoice modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedViewTask, setSelectedViewTask] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    invoice_number: ""
  });

  // ✅ Logged in user info
  const loggedInUser = localStorage.getItem("username") || "Admin User";
  const loggedInEmail = localStorage.getItem("email") || "admin@example.com";

  // ✅ Updated form state with po_number instead of title
  const [formData, setFormData] = useState({
    po_number: "", // ✅ Replaces title
    description: "",
    priority: "Medium",
    dueDate: "",
    assignedTo: "",
    quotation_id: "",
    quotation_number: "",
    company_name: "",
    company_address: "", // ✅ NEW
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
    status: "Pending",
    note: "",
  });

  // ✅ Fetch Employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axios.get(API_EMPLOYEES);
        setUsers(res.data);
      } catch (err) {
        console.error("Error fetching employees:", err);
        setError("Failed to load employees");
      }
    };
    fetchEmployees();
  }, []);

  // ✅ Fetch Approved Items from Completed Quotations - UPDATED FOR BRAND/BATCH
  useEffect(() => {
    const fetchApprovedItems = async () => {
      if (!showModal) return;
      
      setLoadingItems(true);
      setError(null);
      try {
        // Try direct approved-items API endpoint first
        let fetchedItems = [];
        try {
          const res = await axios.get(`${API_BASE}/tasks/approved-items`);
          if (res.data && res.data.success && Array.isArray(res.data.data)) {
            fetchedItems = res.data.data;
          }
        } catch (apiErr) {
          console.warn("Direct approved-items endpoint failed, using fallback loop:", apiErr);
        }

        if (fetchedItems.length === 0) {
          let page = 1;
          let hasMore = true;
          
          while (hasMore) {
            const quoteRes = await axios.get(
              `${API_QUOTATIONS}?status=Approved,Completed,approved,completed&page=${page}&per_page=50`
            );
            
            if (quoteRes.data.success && quoteRes.data.data) {
              const quotationsList = quoteRes.data.data;
              const eligibleQuotations = quotationsList.filter(q => 
                q.status && ["approved", "completed"].includes(q.status.toString().trim().toLowerCase())
              );
              
              for (const quotation of eligibleQuotations) {
                if (quotation.items && quotation.items.length > 0) {
                  const approvedItemsFromQuote = quotation.items
                    .filter(item => item.item_status && item.item_status.toString().trim().toLowerCase() === "approved")
                    .map(item => {
                      let brand_code = "";
                      let customer_description = "";
                      let description = item.description || "";
                      
                      if (description && description.includes('[BRAND_CODE:')) {
                        const brandCodeMatch = description.match(/\[BRAND_CODE:(.*?)\]/);
                        const customerDescMatch = description.match(/\[CUSTOMER_DESC:(.*?)\]/);
                        if (brandCodeMatch) brand_code = brandCodeMatch[1];
                        if (customerDescMatch) customer_description = customerDescMatch[1];
                        description = description.replace(/\[BRAND_CODE:.*?\]/, '').replace(/\[CUSTOMER_DESC:.*?\]/, '').trim();
                      }
                      
                      return {
                        ...item,
                        brand_code: brand_code || item.brand_code || "",
                        description: description,
                        customer_description: customer_description || item.customer_description || "",
                        quotation_id: quotation.id,
                        quotation_number: quotation.quote_number,
                        company_name: quotation.company_name,
                        company_address: quotation.company_address || "",
                        batch_no: item.batch_no || ""
                      };
                    });
                  
                  fetchedItems = [...fetchedItems, ...approvedItemsFromQuote];
                }
              }
              
              const pagination = quoteRes.data.pagination;
              if (pagination && pagination.pages && page < pagination.pages) {
                page++;
              } else {
                hasMore = false;
              }
            } else {
              hasMore = false;
            }
          }
        }
        
        // Filter out items that already have a task assigned/created
        const filteredApprovedItems = fetchedItems.filter(item => {
          const hasTask = tasks.some(task => 
            task.item_id && 
            task.item_id.toString() === item.id.toString() && 
            task.status_check !== "Cancelled"
          );
          
          return !hasTask;
        });
        
        setApprovedItems(filteredApprovedItems);
        console.log("✅ Approved items loaded:", filteredApprovedItems);
        
      } catch (err) {
        console.error("Error fetching approved items:", err);
        setError("Failed to load approved items from quotations");
      } finally {
        setLoadingItems(false);
      }
    };
    
    fetchApprovedItems();
  }, [showModal, tasks]);

  // ✅ Fetch Tasks (Filtered by logged-in email, active tasks only)
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await axios.get(API_URL);
        // 🔍 Filter active tasks assigned by current user (exclude finally completed tasks)
        const filtered = res.data.filter(
          (task) => task.assignedByEmail === loggedInEmail && !task.is_finally_completed
        );
        setTasks(filtered);
        setFilteredTasks(filtered);
        console.log("✅ Active tasks loaded in Task Management:", filtered.length);
      } catch (err) {
        console.error("Error fetching tasks:", err);
        setError("Failed to load tasks");
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();

    // Subscribe to automatic cross-tab data synchronization
    const unsubscribe = subscribeToDataSync(() => {
      fetchTasks();
    }, 5000);

    return () => unsubscribe();
  }, [loggedInEmail]);

  // ✅ Apply filters and search - UPDATED FOR PO_NUMBER
  useEffect(() => {
    let filtered = [...tasks];
    
    // Apply status filter
    if (statusFilter !== "All") {
      filtered = filtered.filter(task => task.status === statusFilter);
    }
    
    // Apply priority filter
    if (priorityFilter !== "All") {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }
    
    // Apply date filter
    if (dateFilter !== "All") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const weekFromNow = new Date(today);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      
      filtered = filtered.filter(task => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        
        switch(dateFilter) {
          case "Today":
            return dueDate.toDateString() === today.toDateString();
          case "Tomorrow":
            return dueDate.toDateString() === tomorrow.toDateString();
          case "This Week":
            return dueDate >= today && dueDate <= weekFromNow;
          case "Overdue":
            return dueDate < today;
          default:
            return true;
        }
      });
    }
    
    // Apply search term - UPDATED FOR PO_NUMBER
    if (searchTerm.trim() !== "") {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(task =>
        task.po_number?.toLowerCase().includes(searchLower) || // ✅ Now using po_number
        task.item_name?.toLowerCase().includes(searchLower) ||
        task.supplier_part_no?.toLowerCase().includes(searchLower) ||
        task.brand_code?.toLowerCase().includes(searchLower) ||
        task.batch_no?.toLowerCase().includes(searchLower) ||
        task.quotation_number?.toLowerCase().includes(searchLower) ||
        task.company_name?.toLowerCase().includes(searchLower) ||
        task.assignedTo?.toLowerCase().includes(searchLower) ||
        task.status?.toLowerCase().includes(searchLower) ||
        task.priority?.toLowerCase().includes(searchLower) ||
        task.invoice_number?.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredTasks(filtered);
    setCurrentPage(1);
  }, [tasks, searchTerm, statusFilter, priorityFilter, dateFilter]);

  // ✅ Calculate statistics
  const taskStats = useMemo(() => {
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === "Pending").length,
      inProgress: tasks.filter(t => t.status === "In Progress").length,
      completed: tasks.filter(t => t.status === "Completed").length,
      highPriority: tasks.filter(t => t.priority === "High").length,
      overdue: tasks.filter(t => {
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return dueDate < today && t.status !== "Completed";
      }).length
    };
    return stats;
  }, [tasks]);

  // ✅ Pagination calculations
  const indexOfLastTask = currentPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = useMemo(() => {
    return filteredTasks.slice(indexOfFirstTask, indexOfLastTask);
  }, [filteredTasks, indexOfFirstTask, indexOfLastTask]);
  
  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ✅ Handle item selection - UPDATED WITH PO_NUMBER AUTO-GENERATION
  const handleItemSelect = (e) => {
    const selectedItemId = e.target.value;
    if (selectedItemId) {
      const selectedItem = approvedItems.find(item => item.id.toString() === selectedItemId);
      if (selectedItem) {
        console.log("✅ Selected item with brand/batch data:", selectedItem);
        
        // Auto-generate PO number
        const timestamp = new Date().getTime().toString().slice(-8);
        const quotePart = selectedItem.quotation_number?.slice(-4) || "0000";
        const autoPoNumber = `PO-${timestamp}-${quotePart}`;
        
        setFormData(prev => ({
          ...prev,
          po_number: autoPoNumber, // ✅ Auto-generated PO number
          item_id: selectedItem.id,
          quotation_id: selectedItem.quotation_id,
          quotation_number: selectedItem.quotation_number,
          company_name: selectedItem.company_name,
          company_address: selectedItem.company_address || "",
          item_name: selectedItem.item_name || "",
          supplier_part_no: selectedItem.supplier_part_no || "",
          description: selectedItem.description || "",
          cut_width: selectedItem.cut_width || "",
          length: selectedItem.length || "",
          quantity: selectedItem.quantity || "",
          brand_code: selectedItem.brand_code || "",
          batch_no: selectedItem.batch_no || "",
          mrp: selectedItem.mrp || "",
          hsn_sac: selectedItem.hsn_sac || "",
          unit: selectedItem.unit || "",
          note: `From Quotation: ${selectedItem.quotation_number || "N/A"} - ${selectedItem.company_name || "Company"}`
        }));
      }
    } else {
      // Reset if no item selected
      setFormData(prev => ({
        ...prev,
        po_number: "", // Reset PO number
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
      }));
    }
  };

  // ✅ Create new Task - UPDATED WITH PO_NUMBER AND BRAND/BATCH
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      console.log("📤 Submitting form data with PO number and brand/batch:", formData);
      
      // Create task data with PO number and new fields
      const taskData = {
        po_number: formData.po_number, // ✅ PO number instead of title
        description: formData.description,
        priority: formData.priority,
        dueDate: formData.dueDate,
        assignedTo: formData.assignedTo,
        assignedBy: loggedInUser,
        assignedByEmail: loggedInEmail,
        
        // Quotation and item info
        quotation_id: formData.quotation_id,
        quotation_number: formData.quotation_number,
        company_name: formData.company_name,
        company_address: formData.company_address || approvedItems.find(item => item.id.toString() === formData.item_id)?.company_address,
        
        // Item details
        item_id: formData.item_id,
        item_name: formData.item_name,
        supplier_part_no: formData.supplier_part_no,
        cut_width: formData.cut_width,
        length: formData.length,
        quantity: formData.quantity,
        
        // ✅ Brand and batch details
        brand_code: formData.brand_code,
        batch_no: formData.batch_no,
        mrp: formData.mrp,
        hsn_sac: formData.hsn_sac,
        unit: formData.unit,
        
        // Status
        status: "Pending",
        note: formData.note,
      };
      
      console.log("📤 Sending to backend with PO number and brand/batch:", taskData);
      
      const response = await axios.post(API_URL, taskData);
      console.log("✅ Task created response:", response.data);
      
      alert("✅ Task created successfully with PO number!");
      setShowModal(false);
      
      // Reset form
      setFormData({
        po_number: "",
        description: "",
        priority: "Medium",
        dueDate: "",
        assignedTo: "",
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
        status: "Pending",
        note: "",
      });
      
      // Refresh tasks
      const res = await axios.get(API_URL);
      const filtered = res.data.filter(
        (task) => task.assignedByEmail === loggedInEmail && !task.is_finally_completed
      );
      setTasks(filtered);
      notifyDataChange("TASK_UPDATED");
    } catch (err) {
      console.error("❌ Error saving task:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to save task");
      alert(`❌ Failed to save task: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ✅ Handle Status Check Change in Task Management
  const handleStatusCheckChange = async (task, value) => {
    if (!value) return;
    if (task.is_finally_completed) {
      alert("⚠️ This task is finally completed and locked. Status cannot be changed.");
      return;
    }

    if (value === "Completed") {
      if (!task.invoice_number || !task.invoice_number.trim()) {
        setSelectedTask(task);
        setShowInvoiceModal(true);
        return;
      }
    }

    try {
      const res = await axios.patch(`${API_URL}/${task.id}/status`, {
        status: value,
        status_check: value,
        is_creator_action: true,
        updated_by: loggedInUser
      });
      if (res.data && res.data.success) {
        setTasks(prev => prev.map(t => t.id === task.id ? res.data.task : t));
        notifyDataChange("TASK_UPDATED");
        alert(`✅ Status updated to ${value}`);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  // ✅ Handle Rework Submit
  const handleReworkSubmit = async () => {
    try {
      if (!reworkNote.trim()) {
        alert("Please enter a rework note!");
        return;
      }

      const response = await axios.put(`${API_URL}/${selectedTask.id}`, {
        status: "Pending",
        note: reworkNote,
        status_check: "Rework",
      });

      console.log("✅ Rework updated:", response.data);

      const updatedTasks = tasks.map((task) =>
        task.id === selectedTask.id
          ? { ...task, status: "Pending", note: reworkNote, status_check: "Rework" }
          : task
      );
      
      setTasks(updatedTasks);

      setShowReworkModal(false);
      setReworkNote("");
      setSelectedTask(null);
      alert("🔁 Task moved to Pending with Rework note.");
    } catch (err) {
      console.error("Error updating task for rework:", err);
      setError("❌ Failed to mark as Rework!");
      alert("❌ Failed to mark as Rework!");
    }
  };

  // ✅ Handle Invoice Submit (By Task Creator)
  const handleInvoiceSubmit = async () => {
    try {
      if (!invoiceData.invoice_number.trim()) {
        alert("Please enter an invoice number!");
        return;
      }

      // Add invoice details
      const response = await axios.put(`${API_URL}/${selectedTask.id}/invoice`, {
        invoice_number: invoiceData.invoice_number.trim(),
        user_email: loggedInEmail
      });
      
      // Also ensure status is Completed if creator is submitting invoice
      const statusRes = await axios.patch(`${API_URL}/${selectedTask.id}/status`, {
        status: "Completed",
        status_check: "Completed",
        is_creator_action: true,
        updated_by: loggedInUser
      });

      if (statusRes.data && statusRes.data.success) {
        const updatedTask = statusRes.data.task;
        if (updatedTask.is_finally_completed) {
          // Remove from Task Management active tasks list
          setTasks(prev => prev.filter(t => t.id !== updatedTask.id));
          setFilteredTasks(prev => prev.filter(t => t.id !== updatedTask.id));
        } else {
          setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          setFilteredTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        }
        setShowInvoiceModal(false);
        setInvoiceData({ invoice_number: "" });
        setSelectedTask(null);
        notifyDataChange("TASK_UPDATED");
        alert("✅ Task is now finally completed! Moved to Admin Task Report.");
      }
    } catch (err) {
      console.error("Error adding invoice details:", err);
      setError("❌ Failed to add invoice details!");
      alert(`❌ Failed to add invoice details: ${err.response?.data?.message || err.message}`);
    }
  };

  // ✅ Handle View Task Details
  const handleViewTask = (task) => {
    console.log("View button clicked for task:", task);
    setSelectedViewTask(task);
    setShowViewModal(true);
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // ✅ Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // ✅ Generate pagination items
  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let number = 1; number <= totalPages; number++) {
        items.push(
          <Pagination.Item
            key={number}
            active={number === currentPage}
            onClick={() => handlePageChange(number)}
          >
            {number}
          </Pagination.Item>
        );
      }
    } else {
      const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      if (startPage > 1) {
        items.push(
          <Pagination.Item key={1} onClick={() => handlePageChange(1)}>
            1
          </Pagination.Item>
        );
        if (startPage > 2) {
          items.push(<Pagination.Ellipsis key="start-ellipsis" />);
        }
      }
      
      for (let number = startPage; number <= endPage; number++) {
        items.push(
          <Pagination.Item
            key={number}
            active={number === currentPage}
            onClick={() => handlePageChange(number)}
          >
            {number}
          </Pagination.Item>
        );
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          items.push(<Pagination.Ellipsis key="end-ellipsis" />);
        }
        items.push(
          <Pagination.Item key={totalPages} onClick={() => handlePageChange(totalPages)}>
            {totalPages}
          </Pagination.Item>
        );
      }
    }
    
    return items;
  };

  // ✅ Reset all filters
  const resetFilters = () => {
    setStatusFilter("All");
    setPriorityFilter("All");
    setDateFilter("All");
    setSearchTerm("");
  };

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>📋 Task Management</h2>
        <Button onClick={() => setShowModal(true)} variant="warning">
          + Create Task
        </Button>
      </div>

      {/* ✅ Status Cards */}
      <Row className="mb-4">
        <Col md={2} sm={6} className="mb-3">
          <Card className="text-center h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="text-primary fs-4">{taskStats.total}</Card.Title>
              <Card.Text className="text-muted mb-0">Total Tasks</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2} sm={6} className="mb-3">
          <Card className="text-center h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="text-warning fs-4">{taskStats.pending}</Card.Title>
              <Card.Text className="text-muted mb-0">Pending</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2} sm={6} className="mb-3">
          <Card className="text-center h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="text-info fs-4">{taskStats.inProgress}</Card.Title>
              <Card.Text className="text-muted mb-0">In Progress</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2} sm={6} className="mb-3">
          <Card className="text-center h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="text-success fs-4">{taskStats.completed}</Card.Title>
              <Card.Text className="text-muted mb-0">Completed</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2} sm={6} className="mb-3">
          <Card className="text-center h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="text-danger fs-4">{taskStats.highPriority}</Card.Title>
              <Card.Text className="text-muted mb-0">High Priority</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2} sm={6} className="mb-3">
          <Card className="text-center h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="text-danger fs-4">{taskStats.overdue}</Card.Title>
              <Card.Text className="text-muted mb-0">Overdue</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ✅ Search and Filters */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Row>
            {/* Search Bar - UPDATED FOR PO_NUMBER */}
            <Col md={4} className="mb-3">
              <Form.Group controlId="searchTasks">
                <Form.Label className="small fw-bold">Search Tasks</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Search by PO number, item, brand, batch, quotation, etc..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Form.Group>
            </Col>
            
            {/* Status Filter */}
            <Col md={2} className="mb-3">
              <Form.Group controlId="statusFilter">
                <Form.Label className="small fw-bold">Status</Form.Label>
                <Form.Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="No Stock">No Stock</option>
                  <option value="Completed">Completed</option>
                </Form.Select>
              </Form.Group>
            </Col>
            
            {/* Priority Filter */}
            <Col md={2} className="mb-3">
              <Form.Group controlId="priorityFilter">
                <Form.Label className="small fw-bold">Priority</Form.Label>
                <Form.Select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="All">All Priority</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </Form.Select>
              </Form.Group>
            </Col>
            
            {/* Date Filter */}
            <Col md={2} className="mb-3">
              <Form.Group controlId="dateFilter">
                <Form.Label className="small fw-bold">Due Date</Form.Label>
                <Form.Select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  <option value="All">All Dates</option>
                  <option value="Today">Today</option>
                  <option value="Tomorrow">Tomorrow</option>
                  <option value="This Week">This Week</option>
                  <option value="Overdue">Overdue</option>
                </Form.Select>
              </Form.Group>
            </Col>
            
            {/* Reset Button */}
            <Col md={2} className="mb-3 d-flex align-items-end">
              <Button
                variant="outline-secondary"
                onClick={resetFilters}
                className="w-100"
              >
                Reset Filters
              </Button>
            </Col>
          </Row>
          
          {/* Results Summary */}
          <div className="d-flex justify-content-between align-items-center mt-2">
            <Badge bg="info" className="p-2">
              Showing {currentTasks.length} of {filteredTasks.length} tasks
              {searchTerm && ` (filtered from ${tasks.length} total)`}
            </Badge>
            <small className="text-muted">
              {statusFilter !== "All" && <span className="me-2">Status: {statusFilter}</span>}
              {priorityFilter !== "All" && <span className="me-2">Priority: {priorityFilter}</span>}
              {dateFilter !== "All" && <span>Due: {dateFilter}</span>}
            </small>
          </div>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center my-4">
          <Spinner animation="border" variant="primary" />
          <p>Loading tasks...</p>
        </div>
      ) : (
        <>
          {/* ✅ Updated Table with PO Number, Brand Code and Batch No columns */}
          <Table striped bordered hover responsive className="shadow-sm">
            <thead style={{ backgroundColor: "#ffeb99" }}>
              <tr>
                <th>#</th>
                <th>PO Number</th> {/* ✅ Changed from Title to PO Number */}
                <th>Item Name</th>
                <th>Brand Code</th>
                <th>Batch No</th>
                <th>Company</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Status Check</th>
                <th>Invoice No</th>
                <th>Assigned To</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentTasks.length > 0 ? (
                currentTasks.map((task, index) => (
                  <tr
                    key={task.id}
                    style={
                      task.status_check === "Completed"
                        ? { backgroundColor: "#fff6b3" }
                        : {}
                    }
                  >
                    <td>{(currentPage - 1) * tasksPerPage + index + 1}</td>
                    <td>
                      <strong>{task.po_number}</strong> {/* ✅ Now showing PO Number */}
                    </td>
                    <td>{task.item_name}</td>
                    <td>
                      {task.brand_code ? (
                        <Badge bg="primary">{task.brand_code}</Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {task.batch_no ? (
                        <Badge bg="secondary">{task.batch_no}</Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{task.company_name}</td>
                    <td>
                      <Badge bg={
                        task.priority === "High" ? "danger" :
                        task.priority === "Medium" ? "warning" : "secondary"
                      }>
                        {task.priority}
                      </Badge>
                    </td>
                    <td>
                      {task.dueDate ? (
                        new Date(task.dueDate) < new Date() && task.status !== "Completed" ? (
                          <span className="text-danger fw-bold">{task.dueDate} ⚠️</span>
                        ) : (
                          task.dueDate
                        )
                      ) : "-"}
                    </td>
                    <td>
                      <Badge bg={
                        task.is_finally_completed ? "success" :
                        task.status === "Completed" ? "warning" :
                        task.status === "No Stock" ? "danger" :
                        task.status === "In Progress" ? "info" : "warning"
                      }>
                        {task.status === "Completed" && (!task.invoice_number || !task.invoice_number.trim())
                          ? "Completed (Pending Invoice)"
                          : (task.status || "Pending")}
                      </Badge>
                    </td>
                    <td>
                      {task.is_finally_completed ? (
                        <Badge bg="success">Completed (Final)</Badge>
                      ) : (
                        <Form.Select
                          value={task.status_check || task.status || "Pending"}
                          onChange={(e) =>
                            handleStatusCheckChange(task, e.target.value)
                          }
                          size="sm"
                          style={{ minWidth: "120px" }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </Form.Select>
                      )}
                    </td>
                    <td>
                      {task.invoice_number ? (
                        <Badge bg="success">{task.invoice_number}</Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{task.assignedTo}</td>
                    <td>{formatDateTime(task.createdAt)}</td>
                    <td>
                      <Button
                        variant="info"
                        size="sm"
                        onClick={() => handleViewTask(task)}
                        className="me-1"
                      >
                        👁️ View
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="15" className="text-center py-4">
                    <div className="text-muted">
                      <i className="bi bi-inbox fs-1"></i>
                      <p className="mt-2">
                        {searchTerm || statusFilter !== "All" || priorityFilter !== "All" || dateFilter !== "All" 
                          ? "No tasks found matching your filters. Try adjusting your search criteria." 
                          : "No tasks found for your account."}
                      </p>
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={resetFilters}
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>

          {/* ✅ Pagination */}
          {filteredTasks.length > tasksPerPage && (
            <div className="d-flex justify-content-center mt-3">
              <Pagination>
                <Pagination.Prev
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                />
                {renderPaginationItems()}
                <Pagination.Next
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                />
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* ✅ Create Task Modal - UPDATED WITH PO NUMBER TEXTAREA */}
      <Modal show={showModal} onHide={() => {
        setShowModal(false);
        setFormData({
          po_number: "",
          description: "",
          priority: "Medium",
          dueDate: "",
          assignedTo: "",
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
          status: "Pending",
          note: "",
        });
      }} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Create Task from Approved Items</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Select Approved Item *</Form.Label>
              <Form.Select
                name="item_id"
                value={formData.item_id}
                onChange={handleItemSelect}
                required
                disabled={loadingItems}
              >
                <option value="">-- Select Approved Item from Quotation --</option>
                {approvedItems.length > 0 ? (
                  approvedItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.quotation_number} | {item.item_name}
                      {item.brand_code ? ` | ${item.brand_code}` : ""}
                      {item.batch_no ? ` | Batch: ${item.batch_no}` : ""}
                      {item.quantity ? ` | Qty: ${item.quantity} ${item.unit || ''}` : ""}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    {loadingItems ? "Loading approved items..." : "No approved items available for task creation"}
                  </option>
                )}
              </Form.Select>
              {approvedItems.length === 0 && !loadingItems && (
                <Alert variant="warning" className="mt-2">
                  <strong>No approved items available for task creation!</strong><br />
                  Please check if:
                  <ul className="mb-0 mt-1">
                    <li>Quotations are marked as "Approved" or "Completed"</li>
                    <li>Items within quotations have status "approved"</li>
                    <li>Items don't already have tasks created for them</li>
                  </ul>
                </Alert>
              )}
            </Form.Group>

            {formData.item_id && (
              <>
                {/* Display selected item details */}
                <div className="mb-3 p-3 border rounded" style={{ backgroundColor: "#f8f9fa" }}>
                  <h6>Selected Item & Quotation Details:</h6>
                  <div className="row">
                    <div className="col-md-6">
                      <p><strong>Quotation No:</strong> {formData.quotation_number}</p>
                      <p><strong>Company:</strong> {formData.company_name}</p>
                      <p><strong>Item Name:</strong> {formData.item_name}</p>
                      <p><strong>Brand Code:</strong> {formData.brand_code || "N/A"}</p>
                      <p><strong>Batch No:</strong> {formData.batch_no || "N/A"}</p>
                    </div>
                    <div className="col-md-6">
                      <p><strong>Supplier Part No:</strong> {formData.supplier_part_no || "N/A"}</p>
                      <p><strong>Cut Width:</strong> {formData.cut_width || "N/A"}</p>
                      <p><strong>Length:</strong> {formData.length || "N/A"}</p>
                      <p><strong>Quantity:</strong> {formData.quantity || "N/A"}</p>
                      <p><strong>MRP:</strong> {formData.mrp ? `₹${formData.mrp}` : "N/A"}</p>
                    </div>
                  </div>
                  {formData.company_address && (
                    <p><strong>Company Address:</strong> {formData.company_address}</p>
                  )}
                  <p><strong>Description:</strong> {formData.description || "N/A"}</p>
                </div>

                {/* ✅ PO Number as Textarea */}
                <Form.Group className="mb-3">
                  <Form.Label>PO Number *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={1}
                    name="po_number"
                    value={formData.po_number}
                    onChange={handleChange}
                    required
                    placeholder="Enter PO number (auto-generated)"
                    style={{ resize: 'vertical' }}
                  />
                  <Form.Text className="text-muted">
                    PO number is auto-generated but can be edited if needed.
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Additional Description (Optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Add any additional task details..."
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Assign To *</Form.Label>
                  <Form.Select
                    name="assignedTo"
                    value={formData.assignedTo}
                    onChange={handleChange}
                    required
                  >
                    <option value="">-- Select Employee --</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.email}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <Form.Label>Priority</Form.Label>
                    <Form.Select
                      name="priority"
                      value={formData.priority}
                      onChange={handleChange}
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </Form.Select>
                  </div>

                  <div className="col-md-6 mb-3">
                    <Form.Label>Due Date</Form.Label>
                    <Form.Control
                      type="date"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <Form.Group className="mb-3">
                  <Form.Label>Note (Optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    name="note"
                    value={formData.note}
                    onChange={handleChange}
                    placeholder="Add any task-specific instructions..."
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Assigned By</Form.Label>
                  <Form.Control type="text" value={loggedInUser} readOnly />
                </Form.Group>
              </>
            )}

            <div className="d-flex justify-content-end mt-3">
              <Button 
                variant="secondary" 
                onClick={() => setShowModal(false)}
                className="me-2"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="warning" 
                disabled={saving || !formData.item_id || loadingItems}
              >
                {saving ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Saving...
                  </>
                ) : (
                  "Save Task"
                )}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* ✅ View Task Details Modal - UPDATED WITH PO NUMBER */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} centered size="lg">
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>📋 Task Details</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {selectedViewTask && (
            <div className="row">
              {/* Basic Information Card - UPDATED WITH PO NUMBER */}
              <div className="col-md-6 mb-3">
                <Card className="h-100 shadow-sm">
                  <Card.Header className="bg-primary text-white">
                    <h6 className="mb-0">Basic Information</h6>
                  </Card.Header>
                  <Card.Body>
                    <table className="table table-sm table-borderless mb-0">
                      <tbody>
                        <tr>
                          <th width="40%" className="text-muted">PO Number:</th>
                          <td><strong className="text-primary">{selectedViewTask.po_number}</strong></td>
                        </tr>
                        <tr>
                          <th className="text-muted">Description:</th>
                          <td>{selectedViewTask.description || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Status:</th>
                          <td>
                            <Badge bg={
                              selectedViewTask.status === "Pending" ? "warning" :
                              selectedViewTask.status === "In Progress" ? "info" : "success"
                            }>
                              {selectedViewTask.status}
                            </Badge>
                          </td>
                        </tr>
                        <tr>
                          <th className="text-muted">Priority:</th>
                          <td>
                            <Badge bg={
                              selectedViewTask.priority === "High" ? "danger" :
                              selectedViewTask.priority === "Medium" ? "warning" : "secondary"
                            }>
                              {selectedViewTask.priority}
                            </Badge>
                          </td>
                        </tr>
                        <tr>
                          <th className="text-muted">Due Date:</th>
                          <td>{selectedViewTask.dueDate || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Assigned To:</th>
                          <td>{selectedViewTask.assignedTo}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Assigned By:</th>
                          <td>{selectedViewTask.assignedBy}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Created At:</th>
                          <td>{formatDateTime(selectedViewTask.createdAt)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </div>
              
              {/* Quotation Details Card */}
              <div className="col-md-6 mb-3">
                <Card className="h-100 shadow-sm">
                  <Card.Header className="bg-info text-white">
                    <h6 className="mb-0">Quotation Details</h6>
                  </Card.Header>
                  <Card.Body>
                    <table className="table table-sm table-borderless mb-0">
                      <tbody>
                        <tr>
                          <th width="40%" className="text-muted">Quotation No:</th>
                          <td><Badge bg="info">{selectedViewTask.quotation_number}</Badge></td>
                        </tr>
                        <tr>
                          <th className="text-muted">Company:</th>
                          <td>{selectedViewTask.company_name}</td>
                        </tr>
                        {selectedViewTask.company_address && (
                          <tr>
                            <th className="text-muted">Company Address:</th>
                            <td className="small">{selectedViewTask.company_address}</td>
                          </tr>
                        )}
                        <tr>
                          <th className="text-muted">Invoice Number:</th>
                          <td>
                            {selectedViewTask.invoice_number ? (
                              <Badge bg="success">{selectedViewTask.invoice_number}</Badge>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                        {selectedViewTask.invoice_date && (
                          <tr>
                            <th className="text-muted">Invoice Date:</th>
                            <td>{formatDateTime(selectedViewTask.invoice_date)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </div>
              
              {/* Item Details Card with Brand/Batch */}
              <div className="col-md-6 mb-3">
                <Card className="h-100 shadow-sm">
                  <Card.Header className="bg-warning text-dark">
                    <h6 className="mb-0">Item Details</h6>
                  </Card.Header>
                  <Card.Body>
                    <table className="table table-sm table-borderless mb-0">
                      <tbody>
                        <tr>
                          <th width="40%" className="text-muted">Item Name:</th>
                          <td>{selectedViewTask.item_name}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Brand Code:</th>
                          <td>
                            {selectedViewTask.brand_code ? (
                              <Badge bg="primary">{selectedViewTask.brand_code}</Badge>
                            ) : "-"}
                          </td>
                        </tr>
                        <tr>
                          <th className="text-muted">Batch No:</th>
                          <td>
                            {selectedViewTask.batch_no ? (
                              <Badge bg="secondary">{selectedViewTask.batch_no}</Badge>
                            ) : "-"}
                          </td>
                        </tr>
                        <tr>
                          <th className="text-muted">Part No:</th>
                          <td>{selectedViewTask.supplier_part_no || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Cut Width:</th>
                          <td>{selectedViewTask.cut_width || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Length:</th>
                          <td>{selectedViewTask.length || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Quantity:</th>
                          <td>{selectedViewTask.quantity || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Status Check:</th>
                          <td>
                            {selectedViewTask.status_check ? (
                              <Badge bg={
                                selectedViewTask.status_check === "Completed" ? "success" :
                                selectedViewTask.status_check === "Rework" ? "warning" : "secondary"
                              }>
                                {selectedViewTask.status_check}
                              </Badge>
                            ) : "-"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </div>
              
              {/* Additional Information Card */}
              <div className="col-md-6 mb-3">
                <Card className="h-100 shadow-sm">
                  <Card.Header className="bg-secondary text-white">
                    <h6 className="mb-0">Additional Information</h6>
                  </Card.Header>
                  <Card.Body>
                    <table className="table table-sm table-borderless mb-0">
                      <tbody>
                        <tr>
                          <th width="40%" className="text-muted">Note:</th>
                          <td>{selectedViewTask.note || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">HSN/SAC:</th>
                          <td>{selectedViewTask.hsn_sac || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Unit:</th>
                          <td>{selectedViewTask.unit || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">MRP:</th>
                          <td>{selectedViewTask.mrp ? `₹${selectedViewTask.mrp}` : "-"}</td>
                        </tr>
                        {selectedViewTask.material_type && (
                          <tr>
                            <th className="text-muted">Material Type:</th>
                            <td>{selectedViewTask.material_type}</td>
                          </tr>
                        )}
                        {selectedViewTask.thickness && (
                          <tr>
                            <th className="text-muted">Thickness:</th>
                            <td>{selectedViewTask.thickness}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </div>

              {/* Complete Status History Audit Trail */}
              <div className="col-md-12 mb-3">
                <Card className="shadow-sm">
                  <Card.Header className="bg-secondary text-white">
                    <h6 className="mb-0">📋 Complete Status History Audit Trail</h6>
                  </Card.Header>
                  <Card.Body className="p-0">
                    {selectedViewTask.status_history && selectedViewTask.status_history.length > 0 ? (
                      <Table striped bordered hover size="sm" className="mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>#</th>
                            <th>Date / Time</th>
                            <th>Previous Status</th>
                            <th>New Status</th>
                            <th>Remarks</th>
                            <th>Updated By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedViewTask.status_history.map((h, idx) => (
                            <tr key={h.id || idx}>
                              <td>{idx + 1}</td>
                              <td>{formatDateTime(h.created_at)}</td>
                              <td><Badge bg="secondary">{h.previous_status || "None"}</Badge></td>
                              <td>
                                <Badge bg={
                                  h.new_status === "Completed" ? "success" :
                                  h.new_status === "No Stock" ? "danger" :
                                  h.new_status === "In Progress" ? "info" : "warning"
                                }>
                                  {h.new_status}
                                </Badge>
                              </td>
                              <td>{h.remarks || "-"}</td>
                              <td>{h.updated_by || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <div className="p-3 text-muted text-center">No status history recorded yet.</div>
                    )}
                  </Card.Body>
                </Card>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ Rework Modal */}
      <Modal show={showReworkModal} onHide={() => setShowReworkModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>🔁 Rework Note</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Enter Rework Note *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reworkNote}
              onChange={(e) => setReworkNote(e.target.value)}
              placeholder="Describe what needs to be reworked..."
              required
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReworkModal(false)}>
            Cancel
          </Button>
          <Button variant="warning" onClick={handleReworkSubmit}>
            Submit Rework
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ Invoice Details Modal */}
      <Modal show={showInvoiceModal} onHide={() => {
        setShowInvoiceModal(false);
        setInvoiceData({
          invoice_number: ""
        });
      }} centered>
        <Modal.Header closeButton>
          <Modal.Title>💰 Invoice Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTask && (
            <div className="mb-3">
              <Alert variant="info">
                <strong>PO Number:</strong> {selectedTask.po_number}
                <br />
                <strong>Item:</strong> {selectedTask.item_name}
                {selectedTask.brand_code && <><br /><strong>Brand:</strong> {selectedTask.brand_code}</>}
                {selectedTask.batch_no && <><br /><strong>Batch:</strong> {selectedTask.batch_no}</>}
                <br />
                <strong>Quantity:</strong> {selectedTask.quantity}
              </Alert>
              
              <Form.Group className="mb-3">
                <Form.Label>Invoice Number *</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter invoice number"
                  value={invoiceData.invoice_number}
                  onChange={(e) => setInvoiceData(prev => ({
                    ...prev,
                    invoice_number: e.target.value
                  }))}
                  required
                />
                <Form.Text className="text-muted">
                  This will mark the task as completed.
                </Form.Text>
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowInvoiceModal(false);
            setInvoiceData({
              invoice_number: ""
            });
          }}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleInvoiceSubmit}>
            Mark as Completed
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TaskPage;