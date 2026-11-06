import React, { useState, useEffect, useMemo } from "react";
import { Table, Button, Form, Spinner, Alert, Badge, Pagination, Card, Row, Col, Modal } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import { API_BASE } from "../config";
import { notifyDataChange, subscribeToDataSync } from "../utils/syncUtils";

const API_URL = `${API_BASE}/tasks`;

const TaskPage = () => {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [tasksPerPage] = useState(10);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  
  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedViewTask, setSelectedViewTask] = useState(null);

  // Status Update Modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedTaskForStatus, setSelectedTaskForStatus] = useState(null);
  const [targetStatus, setTargetStatus] = useState("Pending");
  const [statusRemarks, setStatusRemarks] = useState("");
  const [statusError, setStatusError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Invoice entry state in View Modal
  const [invoiceInput, setInvoiceInput] = useState("");
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [invoiceMsg, setInvoiceMsg] = useState(null);

  // Get logged-in user's email
  const loggedInEmail = localStorage.getItem("email") || "";

  // Fetch tasks assigned to the logged-in user
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await axios.get(API_URL);
      const allTasks = res.data;

      // Filter: tasks assigned to user (exclude finally completed tasks: Status=Completed AND Invoice exists)
      const userTasks = allTasks.filter(
        (task) =>
          task.assignedTo &&
          loggedInEmail &&
          task.assignedTo.toLowerCase() === loggedInEmail.toLowerCase() &&
          !task.is_finally_completed
      );

      setTasks(userTasks);
      setFilteredTasks(userTasks);
      console.log("✅ My assigned tasks loaded:", userTasks.length);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    const unsubscribe = subscribeToDataSync(() => {
      fetchTasks();
    }, 5000);

    return () => unsubscribe();
  }, [loggedInEmail]);

  // Apply filters and search
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
    
    // Apply search term
    if (searchTerm.trim() !== "") {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(task =>
        task.po_number?.toLowerCase().includes(searchLower) ||
        task.title?.toLowerCase().includes(searchLower) ||
        task.item_name?.toLowerCase().includes(searchLower) ||
        task.supplier_part_no?.toLowerCase().includes(searchLower) ||
        task.brand_code?.toLowerCase().includes(searchLower) ||
        task.batch_no?.toLowerCase().includes(searchLower) ||
        task.company_name?.toLowerCase().includes(searchLower) ||
        task.priority?.toLowerCase().includes(searchLower) ||
        task.status?.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredTasks(filtered);
    setCurrentPage(1);
  }, [tasks, searchTerm, statusFilter, priorityFilter, dateFilter]);

  // Calculate statistics
  const taskStats = useMemo(() => {
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === "Pending").length,
      inProgress: tasks.filter(t => t.status === "In Progress").length,
      noStock: tasks.filter(t => t.status === "No Stock").length,
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

  // Pagination calculations
  const indexOfLastTask = currentPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = useMemo(() => {
    return filteredTasks.slice(indexOfFirstTask, indexOfLastTask);
  }, [filteredTasks, indexOfFirstTask, indexOfLastTask]);
  
  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);

  // Open Status Update Modal
  const openStatusUpdateModal = (task, newStatus) => {
    setSelectedTaskForStatus(task);
    setTargetStatus(newStatus || task.status || "Pending");
    setStatusRemarks("");
    setStatusError(null);
    setShowStatusModal(true);
  };

  // Submit Status Update with Remarks (Assigned User Action - No Invoice Required)
  const handleSaveStatus = async () => {
    if (!selectedTaskForStatus) return;
    setStatusError(null);

    setUpdatingStatus(true);
    try {
      const payload = {
        status: targetStatus,
        status_check: targetStatus,
        remarks: statusRemarks,
        note: statusRemarks,
        updated_by: loggedInEmail || "User",
        is_creator_action: false
      };

      const res = await axios.patch(`${API_URL}/${selectedTaskForStatus.id}/status`, payload);
      if (res.data && res.data.success) {
        const updatedTask = res.data.task;
        if (updatedTask.is_finally_completed) {
          setTasks(prev => prev.filter(t => t.id !== updatedTask.id));
          setFilteredTasks(prev => prev.filter(t => t.id !== updatedTask.id));
        } else {
          setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          setFilteredTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        }
        if (selectedViewTask && selectedViewTask.id === updatedTask.id) {
          setSelectedViewTask(updatedTask);
        }
        setShowStatusModal(false);
        notifyDataChange("TASK_UPDATED");
      } else {
        setStatusError(res.data.message || "Failed to update status");
      }
    } catch (err) {
      console.error("Error updating status:", err);
      setStatusError(err.response?.data?.message || err.message || "Failed to update task status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Open View Task Modal
  const handleViewTask = (task) => {
    setSelectedViewTask(task);
    setInvoiceInput(task.invoice_number || "");
    setInvoiceMsg(null);
    setShowViewModal(true);
  };

  // Save Invoice No (by Task Creator)
  const handleSaveInvoice = async () => {
    if (!selectedViewTask || !invoiceInput.trim()) {
      setInvoiceMsg({ type: 'danger', text: 'Invoice number is required' });
      return;
    }
    setSavingInvoice(true);
    setInvoiceMsg(null);
    try {
      const res = await axios.put(`${API_URL}/${selectedViewTask.id}/invoice`, {
        invoice_number: invoiceInput.trim(),
        user_email: loggedInEmail
      });
      if (res.data && res.data.success) {
        const updatedTask = res.data.task;
        if (updatedTask.is_finally_completed) {
          // Remove from My Assigned Tasks if finally completed
          setTasks(prev => prev.filter(t => t.id !== updatedTask.id));
          setFilteredTasks(prev => prev.filter(t => t.id !== updatedTask.id));
          setShowViewModal(false);
        } else {
          setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          setFilteredTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          setSelectedViewTask(updatedTask);
        }
        setInvoiceMsg({ type: 'success', text: 'Invoice No saved successfully!' });
        notifyDataChange("TASK_UPDATED");
      } else {
        setInvoiceMsg({ type: 'danger', text: res.data.message || 'Failed to save invoice' });
      }
    } catch (err) {
      setInvoiceMsg({ type: 'danger', text: err.response?.data?.message || err.message || 'Failed to save invoice' });
    } finally {
      setSavingInvoice(false);
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const resetFilters = () => {
    setStatusFilter("All");
    setPriorityFilter("All");
    setDateFilter("All");
    setSearchTerm("");
  };

  const getTaskNumber = (index) => {
    return (currentPage - 1) * tasksPerPage + index + 1;
  };

  const isCreator = (task) => {
    if (!task) return false;
    const creatorEmail = (task.assignedByEmail || task.assignedBy || "").toLowerCase();
    return loggedInEmail && creatorEmail && loggedInEmail.toLowerCase() === creatorEmail;
  };

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>📋 My Assigned Tasks</h2>
        <Badge bg="info" className="p-2">
          {tasks.length} Active Tasks
        </Badge>
      </div>

      {/* Status Cards */}
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
          <Card className="text-center h-100 shadow-sm border-danger">
            <Card.Body className="p-3">
              <Card.Title className="text-danger fs-4">{taskStats.noStock}</Card.Title>
              <Card.Text className="text-muted mb-0">No Stock</Card.Text>
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
              <Card.Title className="text-danger fs-4">{taskStats.overdue}</Card.Title>
              <Card.Text className="text-muted mb-0">Overdue</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filter and Search Section */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Row>
            <Col md={4} className="mb-3">
              <Form.Group controlId="searchTerm">
                <Form.Label className="small fw-bold">Search Tasks</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Search by PO number, item, brand, batch..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Form.Group>
            </Col>
            
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
          
          <div className="d-flex justify-content-between align-items-center mt-2">
            <Badge bg="info" className="p-2">
              Page {currentPage} of {totalPages || 1} | Showing {currentTasks.length} of {filteredTasks.length} tasks
            </Badge>
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
          <p>Loading your tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <Card className="text-center shadow-sm">
          <Card.Body className="py-5">
            <h5 className="text-muted">No active tasks assigned to you</h5>
            <p className="text-muted">You'll see tasks here when they are assigned to you.</p>
          </Card.Body>
        </Card>
      ) : (
        <>
          {/* My Assigned Tasks Table */}
          <Table striped bordered hover responsive className="shadow-sm">
            <thead style={{ backgroundColor: "#ffeb99" }}>
              <tr>
                <th>#</th>
                <th>PO Number</th>
                <th>Item Name</th>
                <th>Brand Code</th>
                <th>Batch No</th>
                <th>Company</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Quantity</th>
                <th>Assigned By</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentTasks.length > 0 ? (
                currentTasks.map((task, index) => {
                  const isCompleted = task.status === "Completed";
                  return (
                    <tr
                      key={task.id}
                      style={isCompleted ? { backgroundColor: "#fff6b3" } : {}}
                    >
                      <td>{getTaskNumber(index)}</td>
                      <td>
                        <strong>{task.po_number || task.title}</strong>
                      </td>
                      <td>{task.item_name}</td>
                      <td>
                        {task.brand_code ? (
                          <Badge bg="primary">{task.brand_code}</Badge>
                        ) : "-"}
                      </td>
                      <td>
                        {task.batch_no ? (
                          <Badge bg="secondary">{task.batch_no}</Badge>
                        ) : "-"}
                      </td>
                      <td>{task.company_name || "N/A"}</td>
                      <td>
                        <Badge bg={
                          task.priority === "High" ? "danger" :
                          task.priority === "Medium" ? "warning" : "secondary"
                        }>
                          {task.priority || "Medium"}
                        </Badge>
                      </td>
                      <td>
                        {task.dueDate ? (
                          new Date(task.dueDate) < new Date() && task.status !== "Completed" ? (
                            <span className="text-danger fw-bold">{task.dueDate} ⚠️</span>
                          ) : (
                            task.dueDate
                          )
                        ) : "Not set"}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <Badge bg={
                            task.status === "Completed" && (!task.invoice_number || !task.invoice_number.trim()) ? "warning" :
                            task.status === "Completed" ? "success" :
                            task.status === "No Stock" ? "danger" :
                            task.status === "In Progress" ? "info" : "warning"
                          }>
                            {task.status === "Completed" && (!task.invoice_number || !task.invoice_number.trim())
                              ? "Completed - Awaiting Invoice"
                              : (task.status || "Pending")}
                          </Badge>
                          <Button
                            variant="outline-dark"
                            size="sm"
                            style={{ fontSize: "0.75rem", padding: "0.1rem 0.4rem" }}
                            onClick={() => openStatusUpdateModal(task, task.status)}
                          >
                            Edit
                          </Button>
                        </div>
                      </td>
                      <td>{task.quantity || "N/A"}</td>
                      <td>
                        <div>
                          <div>{task.assignedBy || "N/A"}</div>
                        </div>
                      </td>
                      <td>{formatDateTime(task.createdAt)}</td>
                      <td>
                        <Button
                          variant="info"
                          size="sm"
                          onClick={() => handleViewTask(task)}
                        >
                          👁️ View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="13" className="text-center py-4">
                    <div className="text-muted">
                      <i className="bi bi-inbox fs-1"></i>
                      <p className="mt-2">No tasks found matching your filters.</p>
                      <Button variant="outline-primary" size="sm" onClick={resetFilters}>
                        Clear Filters
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </>
      )}

      {/* ✅ Status Update Modal with Remarks */}
      <Modal show={showStatusModal} onHide={() => setShowStatusModal(false)} centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="fs-6">Update Task Status & Enter Remarks</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTaskForStatus && (
            <div>
              <p className="mb-2">
                <strong>PO Number:</strong> {selectedTaskForStatus.po_number}<br />
                <strong>Item Name:</strong> {selectedTaskForStatus.item_name}
              </p>

              {statusError && <Alert variant="danger">{statusError}</Alert>}

              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">New Status *</Form.Label>
                <Form.Select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="No Stock">No Stock</option>
                  <option value="Completed">Completed</option>
                </Form.Select>
                {targetStatus === "No Stock" && (
                  <Form.Text className="text-danger d-block mt-1">
                    Note: Selecting 'No Stock' requires entering remarks. You can change this status later.
                  </Form.Text>
                )}
                {targetStatus === "Completed" && (
                  <Form.Text className="text-info d-block mt-1">
                    Note: Completing this task requires an Invoice No saved by the creator.
                  </Form.Text>
                )}
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">Remarks for Status Change *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Enter remarks explaining why the status was updated..."
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                />
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowStatusModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleSaveStatus} disabled={updatingStatus}>
            {updatingStatus ? "Updating..." : "Update Status"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ View Task & Status History Audit Trail Modal */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="fs-5">Task Details & Status History</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "75vh", overflowY: "auto" }}>
          {selectedViewTask && (
            <Row>
              {/* Basic Information Card */}
              <Col md={6} className="mb-3">
                <Card className="h-100 shadow-sm">
                  <Card.Header className="bg-primary text-white">
                    <h6 className="mb-0">Basic Information</h6>
                  </Card.Header>
                  <Card.Body>
                    <table className="table table-sm table-borderless mb-0">
                      <tbody>
                        <tr>
                          <th width="40%" className="text-muted">PO Number:</th>
                          <td><strong>{selectedViewTask.po_number || selectedViewTask.title}</strong></td>
                        </tr>
                        <tr>
                          <th className="text-muted">Status:</th>
                          <td>
                            <Badge bg={
                              selectedViewTask.status === "Completed" ? "success" :
                              selectedViewTask.status === "No Stock" ? "danger" :
                              selectedViewTask.status === "In Progress" ? "info" : "warning"
                            }>
                              {selectedViewTask.status}
                            </Badge>
                          </td>
                        </tr>
                        <tr>
                          <th className="text-muted">Assigned By:</th>
                          <td>{selectedViewTask.assignedBy} ({selectedViewTask.assignedByEmail})</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Created At:</th>
                          <td>{formatDateTime(selectedViewTask.createdAt)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </Col>

              {/* Item Details Card */}
              <Col md={6} className="mb-3">
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
                          <th className="text-muted">Batch No:</th>
                          <td>
                            {selectedViewTask.batch_no ? (
                              <Badge bg="secondary">{selectedViewTask.batch_no}</Badge>
                            ) : "-"}
                          </td>
                        </tr>
                        <tr>
                          <th className="text-muted">Company:</th>
                          <td>{selectedViewTask.company_name || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Quantity:</th>
                          <td>{selectedViewTask.quantity || "-"} {selectedViewTask.unit || ""}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </Col>

              {/* Invoice Section for Task Creator */}
              <Col md={12} className="mb-3">
                <Card className="shadow-sm border-info">
                  <Card.Header className="bg-info text-white">
                    <h6 className="mb-0">Invoice Information</h6>
                  </Card.Header>
                  <Card.Body>
                    {invoiceMsg && (
                      <Alert variant={invoiceMsg.type} onClose={() => setInvoiceMsg(null)} dismissible>
                        {invoiceMsg.text}
                      </Alert>
                    )}
                    <Row className="align-items-center">
                      <Col md={6}>
                        <p className="mb-1"><strong>Invoice Number:</strong> {selectedViewTask.invoice_number ? <Badge bg="success">{selectedViewTask.invoice_number}</Badge> : <span className="text-danger fw-bold">Not Entered</span>}</p>
                      </Col>
                      <Col md={6}>
                        {isCreator(selectedViewTask) ? (
                          <div className="input-group input-group-sm">
                            <Form.Control
                              type="text"
                              placeholder="Enter Invoice No (Creator Only)"
                              value={invoiceInput}
                              onChange={(e) => setInvoiceInput(e.target.value)}
                            />
                            <Button variant="primary" onClick={handleSaveInvoice} disabled={savingInvoice}>
                              {savingInvoice ? "Saving..." : "Save Invoice"}
                            </Button>
                          </div>
                        ) : (
                          <small className="text-muted">Only task creator ({selectedViewTask.assignedByEmail || selectedViewTask.assignedBy}) can enter Invoice No.</small>
                        )}
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>

              {/* Complete Status History Audit Trail */}
              <Col md={12} className="mb-3">
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
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowViewModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TaskPage;