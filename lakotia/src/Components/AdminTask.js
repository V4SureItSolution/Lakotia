import React, { useState, useEffect, useMemo } from "react";
import { Table, Button, Form, Spinner, Alert, Badge, Pagination, Card, Row, Col, Modal } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import { API_BASE } from "../config";
import { subscribeToDataSync } from "../utils/syncUtils";

const API_URL = `${API_BASE}/tasks`;

const AdminTaskPage = () => {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [tasksPerPage] = useState(10);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  
  // View modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedViewTask, setSelectedViewTask] = useState(null);

  // Fetch all finally completed tasks for Admin Task Report
  const fetchCompletedTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      // Try dedicated admin-report API
      let completedList = [];
      try {
        const res = await axios.get(`${API_BASE}/tasks/admin-report`);
        if (res.data && res.data.success && Array.isArray(res.data.data)) {
          completedList = res.data.data;
        }
      } catch (e) {
        console.warn("admin-report endpoint failed, using fallback query:", e);
      }

      if (completedList.length === 0) {
        const res = await axios.get(API_URL);
        completedList = (res.data || []).filter(t => t.is_finally_completed || (t.status === "Completed" && t.invoice_number && t.invoice_number.trim() !== ""));
      }

      setTasks(completedList);
      setFilteredTasks(completedList);
      console.log("✅ Admin Task Report loaded:", completedList.length);
    } catch (err) {
      console.error("Error fetching admin task report:", err);
      setError("Failed to load admin task report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompletedTasks();

    const unsubscribe = subscribeToDataSync(() => {
      fetchCompletedTasks();
    }, 5000);

    return () => unsubscribe();
  }, []);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...tasks];
    
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
        task.company_address?.toLowerCase().includes(searchLower) ||
        task.assignedTo?.toLowerCase().includes(searchLower) ||
        task.assignedBy?.toLowerCase().includes(searchLower) ||
        task.assignedByEmail?.toLowerCase().includes(searchLower) ||
        task.invoice_number?.toLowerCase().includes(searchLower) ||
        task.note?.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredTasks(filtered);
    setCurrentPage(1);
  }, [tasks, searchTerm, priorityFilter, dateFilter]);

  // Calculate statistics
  const taskStats = useMemo(() => {
    const stats = {
      total: tasks.length,
      highPriority: tasks.filter(t => t.priority === "High").length,
      mediumPriority: tasks.filter(t => t.priority === "Medium").length,
      lowPriority: tasks.filter(t => t.priority === "Low").length,
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

  const handleViewTask = (task) => {
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

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const resetFilters = () => {
    setPriorityFilter("All");
    setDateFilter("All");
    setSearchTerm("");
  };

  const getTaskNumber = (index) => {
    return (currentPage - 1) * tasksPerPage + index + 1;
  };

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>📊 Admin Task Report - Final Completed Tasks</h2>
        <Badge bg="success" className="p-2 fs-6">
          {tasks.length} Completed Tasks Archived
        </Badge>
      </div>

      {/* Status Cards */}
      <Row className="mb-4">
        <Col md={3} sm={6} className="mb-3">
          <Card className="text-center h-100 shadow-sm border-success">
            <Card.Body className="p-3">
              <Card.Title className="text-success fs-4">{taskStats.total}</Card.Title>
              <Card.Text className="text-muted mb-0">Total Final Completed</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card className="text-center h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="text-danger fs-4">{taskStats.highPriority}</Card.Title>
              <Card.Text className="text-muted mb-0">High Priority Completed</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card className="text-center h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="text-warning fs-4">{taskStats.mediumPriority}</Card.Title>
              <Card.Text className="text-muted mb-0">Medium Priority Completed</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <Card className="text-center h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="text-secondary fs-4">{taskStats.lowPriority}</Card.Title>
              <Card.Text className="text-muted mb-0">Low Priority Completed</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filter and Search Section */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Row>
            <Col md={5} className="mb-3">
              <Form.Group controlId="searchTasks">
                <Form.Label className="small fw-bold">Search Completed Report</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Search by PO number, item, brand, batch, invoice, company, user..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Form.Group>
            </Col>
            
            <Col md={3} className="mb-3">
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
              Page {currentPage} of {totalPages || 1} | Showing {currentTasks.length} of {filteredTasks.length} completed tasks
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
          <p>Loading Admin Task Report...</p>
        </div>
      ) : tasks.length === 0 ? (
        <Card className="text-center shadow-sm">
          <Card.Body className="py-5">
            <i className="bi bi-inbox fs-1 text-muted mb-3"></i>
            <h5 className="text-muted">No completed tasks in report yet</h5>
            <p className="text-muted">Tasks will automatically move here once they reach final completion (Status = Completed + Invoice No entered).</p>
          </Card.Body>
        </Card>
      ) : (
        <>
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
                <th>Final Status</th>
                <th>Invoice No</th>
                <th>Assigned To</th>
                <th>Created By</th>
                <th>Created At</th>
                <th>Completed At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentTasks.length > 0 ? (
                currentTasks.map((task, index) => {
                  return (
                    <tr key={task.id} style={{ backgroundColor: "#fff6b3" }}>
                      <td>{getTaskNumber(index)}</td>
                      <td>
                        <strong>{task.po_number || task.title || "-"}</strong>
                      </td>
                      <td>{task.item_name || "-"}</td>
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
                      <td>{task.company_name || "N/A"}</td>
                      <td>
                        <Badge bg={
                          task.priority === "High" ? "danger" :
                          task.priority === "Medium" ? "warning" : "secondary"
                        }>
                          {task.priority || "Medium"}
                        </Badge>
                      </td>
                      <td>{task.dueDate || "-"}</td>
                      <td>
                        <Badge bg="success">Completed (Final)</Badge>
                      </td>
                      <td>
                        {task.invoice_number ? (
                          <Badge bg="success">{task.invoice_number}</Badge>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{task.assignedTo || "-"}</td>
                      <td>{task.assignedBy || "-"}</td>
                      <td>{formatDateTime(task.createdAt)}</td>
                      <td>{formatDateTime(task.completedAt || task.updatedAt)}</td>
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
                  <td colSpan="15" className="text-center py-4">
                    <div className="text-muted">
                      <p className="mt-2">No completed tasks found matching your filters.</p>
                      <Button variant="outline-primary" size="sm" onClick={resetFilters}>
                        Clear Filters
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>

          {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-4">
              <Pagination>
                <Pagination.First onClick={() => handlePageChange(1)} disabled={currentPage === 1} />
                <Pagination.Prev onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} />
                <Pagination.Next onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} />
                <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} />
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* View Task Details Modal with Status History */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-success text-white">
          <Modal.Title className="fs-5">Completed Task Report - {selectedViewTask?.po_number}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "75vh", overflowY: "auto" }}>
          {selectedViewTask && (
            <Row>
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
                          <td><strong className="text-primary">{selectedViewTask.po_number || selectedViewTask.title}</strong></td>
                        </tr>
                        <tr>
                          <th className="text-muted">Description:</th>
                          <td>{selectedViewTask.description || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Final Status:</th>
                          <td><Badge bg="success">Completed (Final)</Badge></td>
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
                          <th className="text-muted">Created By:</th>
                          <td>{selectedViewTask.assignedBy} ({selectedViewTask.assignedByEmail})</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Created At:</th>
                          <td>{formatDateTime(selectedViewTask.createdAt)}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Completed At:</th>
                          <td>{formatDateTime(selectedViewTask.completedAt || selectedViewTask.updatedAt)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </Col>

              <Col md={6} className="mb-3">
                <Card className="h-100 shadow-sm">
                  <Card.Header className="bg-warning text-dark">
                    <h6 className="mb-0">Item & Invoice Details</h6>
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
                          <th className="text-muted">Company:</th>
                          <td>{selectedViewTask.company_name || "-"}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">Invoice No:</th>
                          <td><Badge bg="success">{selectedViewTask.invoice_number || "-"}</Badge></td>
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

export default AdminTaskPage;