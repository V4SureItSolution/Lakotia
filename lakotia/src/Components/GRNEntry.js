import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Badge,
  InputGroup,
  Alert,
  Spinner,
} from "react-bootstrap";
import {
  FaTruckLoading,
  FaFileInvoice,
  FaBuilding,
  FaBox,
  FaRupeeSign,
  FaCalendarAlt,
  FaCheckCircle,
  FaSync,
  FaReceipt,
  FaTruck,
  FaInfoCircle,
  FaBarcode,
  FaHistory,
} from "react-icons/fa";
import { API_BASE } from "../config";

const GRNEntry = () => {
  const navigate = useNavigate();
  const todayDate = new Date().toISOString().slice(0, 10);

  // Pending POs list
  const [pendingPOs, setPendingPOs] = useState([]);
  const [loadingPOs, setLoadingPOs] = useState(false);

  // Selected PO & Auto fields
  const [selectedPoNumber, setSelectedPoNumber] = useState("");
  const [selectedPO, setSelectedPO] = useState(null);

  // Invoice level fields
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayDate);
  const [transportCharges, setTransportCharges] = useState(0);
  const [otherExpense, setOtherExpense] = useState(0);
  const [generalRemarks, setGeneralRemarks] = useState("");

  // Items to receive
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  // 1. Fetch pending POs on mount
  useEffect(() => {
    fetchPendingPOs();
  }, []);

  const fetchPendingPOs = async () => {
    setLoadingPOs(true);
    try {
      const res = await axios.get(`${API_BASE}/grn/pending-pos`);
      if (res.data.success) {
        setPendingPOs(res.data.data || []);
      }
    } catch (err) {
      console.error("Error loading pending POs:", err);
      toast.error("Failed to load pending purchase orders");
    } finally {
      setLoadingPOs(false);
    }
  };

  // Helper to generate a default batch code
  const makeBatchCode = (brand, itemIdx) => {
    const brandPrefix = (brand || "GEN").slice(0, 3).toUpperCase();
    const cleanDate = todayDate.replace(/-/g, "");
    const seq = String(itemIdx + 1).padStart(3, "0");
    return `${brandPrefix}-${cleanDate}-${seq}`;
  };

  // 2. When PO selection changes, auto-populate all fields
  const handlePOSelect = (poNum) => {
    setSelectedPoNumber(poNum);
    setSuccessInfo(null);

    if (!poNum) {
      setSelectedPO(null);
      setItems([]);
      return;
    }

    const po = pendingPOs.find((p) => p.po_number === poNum);
    if (!po) return;

    setSelectedPO(po);

    // Populate items with Auto fields and defaults for to-be-filled fields
    const newItems = (po.items || []).map((item, idx) => {
      const balance = Number(item.balance_qty) || 0;
      const poRate = Number(item.po_rate) || 0;
      return {
        selected: balance > 0,
        item_name: item.item_name,
        brand: item.brand || "GENERIC",
        brand_code: item.brand_code || "",
        brand_description: item.brand_description || "",
        length: item.length || "",
        width: item.width || "",
        unit: item.unit || "PCS",
        // Auto fields
        total_po_qty: Number(item.total_po_qty) || 0,
        partial_po_qty: Number(item.delivered_qty) || 0, // already delivered
        balance_qty: balance,
        po_rate: poRate,
        // Fields to be filled
        invoice_quantity: balance, // default to balance
        received_quantity: balance, // default to balance
        invoice_rate: poRate, // default to PO Rate
        batch_code: makeBatchCode(item.brand, idx),
        transport_charges: 0,
        other_expense: 0,
        remarks: "",
      };
    });

    setItems(newItems);
  };

  // 3. Handle item changes
  const handleItemFieldChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // 4. Toggle item selection
  const handleToggleSelect = (index) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        selected: !updated[index].selected,
      };
      return updated;
    });
  };

  // 5. Regenerate batch code for single item
  const handleRegenerateBatch = (index) => {
    const item = items[index];
    const newCode = makeBatchCode(item.brand, index + Math.floor(Math.random() * 900 + 100));
    handleItemFieldChange(index, "batch_code", newCode);
    toast.info(`Generated batch code: ${newCode}`);
  };

  // Calculations
  const selectedItems = items.filter((i) => i.selected);
  const totalReceivedQty = selectedItems.reduce(
    (sum, i) => sum + (Number(i.received_quantity) || 0),
    0
  );
  const totalInvoiceQty = selectedItems.reduce(
    (sum, i) => sum + (Number(i.invoice_quantity) || 0),
    0
  );
  const totalInvoiceAmount = selectedItems.reduce(
    (sum, i) =>
      sum + (Number(i.received_quantity) || 0) * (Number(i.invoice_rate) || 0),
    0
  );
  const grandTotal =
    totalInvoiceAmount +
    (Number(transportCharges) || 0) +
    (Number(otherExpense) || 0);

  // 6. Submit GRN
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedPO) {
      toast.error("Please select a Purchase Order!");
      return;
    }

    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to receive!");
      return;
    }

    // Validation on received quantities
    for (const item of selectedItems) {
      const rQty = Number(item.received_quantity);
      if (isNaN(rQty) || rQty <= 0) {
        toast.error(`Received Qty for "${item.item_name}" must be greater than 0!`);
        return;
      }
      if (rQty > item.balance_qty) {
        const confirmOver = window.confirm(
          `Received Qty (${rQty}) for "${item.item_name}" is greater than Balance PO Qty (${item.balance_qty}). Do you wish to continue?`
        );
        if (!confirmOver) return;
      }
      if (!item.batch_code || !item.batch_code.trim()) {
        toast.error(`Batch Code is required for "${item.item_name}"!`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        po_number: selectedPO.po_number,
        po_date: selectedPO.po_date,
        company_name: selectedPO.company_name,
        invoice_number: invoiceNumber.trim() || undefined,
        invoice_date: invoiceDate,
        transport_charges: Number(transportCharges) || 0,
        other_expense: Number(otherExpense) || 0,
        remarks: generalRemarks,
        items: selectedItems.map((item) => ({
          item_name: item.item_name,
          brand: item.brand,
          brand_code: item.brand_code,
          brand_description: item.brand_description,
          length: item.length,
          width: item.width,
          unit: item.unit,
          total_po_qty: item.total_po_qty,
          partial_po_qty: item.partial_po_qty,
          balance_qty: item.balance_qty,
          invoice_quantity: Number(item.invoice_quantity) || item.received_quantity,
          received_quantity: Number(item.received_quantity),
          po_rate: Number(item.po_rate),
          invoice_rate: Number(item.invoice_rate) || item.po_rate,
          batch_code: item.batch_code.trim(),
          transport_charges: Number(item.transport_charges) || 0,
          other_expense: Number(item.other_expense) || 0,
          remarks: item.remarks || generalRemarks,
        })),
      };

      const res = await axios.post(`${API_BASE}/grn/create-direct`, payload);

      if (res.data.success) {
        toast.success(res.data.message || "GRN Created Successfully!");
        setSuccessInfo({
          invoiceNumber: res.data.invoice_number,
          itemCount: res.data.items_count,
          poNumber: selectedPO.po_number,
          companyName: selectedPO.company_name,
        });

        // Refresh pending POs
        fetchPendingPOs();
        // Reset selections
        setSelectedPoNumber("");
        setSelectedPO(null);
        setItems([]);
        setInvoiceNumber("");
        setTransportCharges(0);
        setOtherExpense(0);
        setGeneralRemarks("");
      } else {
        toast.error(res.data.message || "Failed to create GRN");
      }
    } catch (err) {
      console.error("Error creating GRN:", err);
      toast.error(
        err.response?.data?.message || err.response?.data?.error || "Error saving GRN"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container fluid className="py-3">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-0 text-primary">
            <FaTruckLoading className="me-2" />
            GRN Module
          </h2>
          <small className="text-muted">
            Goods Receipt Note — Record incoming shipments against pending Purchase Orders
          </small>
        </div>
        <div className="d-flex gap-2 mt-2 mt-md-0">
          <Button
            variant="outline-secondary"
            onClick={fetchPendingPOs}
            disabled={loadingPOs}
          >
            <FaSync className={loadingPOs ? "fa-spin me-1" : "me-1"} /> Refresh POs
          </Button>
          <Button
            variant="outline-primary"
            onClick={() => navigate("/grn-record")}
          >
            <FaHistory className="me-1" /> View GRN Records
          </Button>
        </div>
      </div>

      {/* Success Banner */}
      {successInfo && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setSuccessInfo(null)}
          className="shadow-sm"
        >
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <h5 className="mb-1">
                <FaCheckCircle className="me-2 text-success" />
                GRN Created Successfully!
              </h5>
              <p className="mb-0">
                Invoice Number: <strong>{successInfo.invoiceNumber}</strong> | PO:{" "}
                <strong>{successInfo.poNumber}</strong> | Company:{" "}
                <strong>{successInfo.companyName}</strong> | Items Received:{" "}
                <strong>{successInfo.itemCount}</strong>
              </p>
            </div>
            <Button
              variant="success"
              size="sm"
              onClick={() => navigate("/grn-record")}
            >
              Open in GRN Records &rarr;
            </Button>
          </div>
        </Alert>
      )}

      {/* Main Form */}
      <Form onSubmit={handleSubmit}>
        {/* Section 1: Purchase Order & Company Selection */}
        <Card className="shadow-sm mb-4 border-0">
          <Card.Header className="bg-primary text-white py-2 fw-semibold">
            <FaFileInvoice className="me-2" /> 1. Purchase Order & Company Details
          </Card.Header>
          <Card.Body className="bg-light">
            <Row className="g-3">
              {/* PO Number (Auto from Pending POs) */}
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-bold">
                    PO NO <span className="text-danger">*</span>{" "}
                    <Badge bg="info" className="text-dark">Auto from Pending POs</Badge>
                  </Form.Label>
                  <Form.Select
                    value={selectedPoNumber}
                    onChange={(e) => handlePOSelect(e.target.value)}
                    required
                    className="form-select-lg"
                  >
                    <option value="">-- Select Pending PO --</option>
                    {pendingPOs.map((po) => (
                      <option key={po.po_number} value={po.po_number}>
                        {po.po_number} — {po.company_name} ({po.items?.length || 0} items)
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    {loadingPOs
                      ? "Loading pending POs..."
                      : `${pendingPOs.length} pending Purchase Order(s) available`}
                  </Form.Text>
                </Form.Group>
              </Col>

              {/* PO Date (Auto) */}
              <Col md={3}>
                <Form.Group>
                  <Form.Label className="fw-bold">
                    PO Date <Badge bg="secondary">Auto</Badge>
                  </Form.Label>
                  <InputGroup>
                    <InputGroup.Text><FaCalendarAlt /></InputGroup.Text>
                    <Form.Control
                      type="text"
                      readOnly
                      value={selectedPO?.po_date || "-"}
                      className="bg-white"
                      placeholder="Auto from PO"
                    />
                  </InputGroup>
                </Form.Group>
              </Col>

              {/* Company Name (Auto) */}
              <Col md={5}>
                <Form.Group>
                  <Form.Label className="fw-bold">
                    Company Name <Badge bg="secondary">Auto</Badge>
                  </Form.Label>
                  <InputGroup>
                    <InputGroup.Text><FaBuilding /></InputGroup.Text>
                    <Form.Control
                      type="text"
                      readOnly
                      value={selectedPO?.company_name || "-"}
                      className="bg-white fw-semibold text-primary"
                      placeholder="Auto from PO"
                    />
                  </InputGroup>
                </Form.Group>
              </Col>
            </Row>

            {/* Additional Invoice Details */}
            {selectedPO && (
              <Row className="g-3 mt-1 pt-2 border-top">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">
                      Supplier Invoice No (Optional)
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Auto-generated if blank"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Invoice Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">
                      Transport Charges (₹)
                    </Form.Label>
                    <InputGroup>
                      <InputGroup.Text><FaTruck /></InputGroup.Text>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={transportCharges}
                        onChange={(e) => setTransportCharges(e.target.value)}
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">
                      Other Expenses (₹)
                    </Form.Label>
                    <InputGroup>
                      <InputGroup.Text><FaReceipt /></InputGroup.Text>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={otherExpense}
                        onChange={(e) => setOtherExpense(e.target.value)}
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
              </Row>
            )}
          </Card.Body>
        </Card>

        {/* Section 2: Items to Receive */}
        {selectedPO && (
          <Card className="shadow-sm mb-4 border-0">
            <Card.Header className="bg-dark text-white py-2 d-flex justify-content-between align-items-center">
              <span>
                <FaBox className="me-2" /> 2. Items in Purchase Order:{" "}
                <strong>{selectedPO.po_number}</strong>
              </span>
              <Badge bg="warning" className="text-dark">
                {items.length} item(s) found
              </Badge>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table bordered hover className="align-middle mb-0 text-center">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "40px" }}>Select</th>
                      <th style={{ width: "180px" }}>Item Name</th>
                      <th>
                        Total PO Qty
                        <br />
                        <small className="text-muted">(Auto)</small>
                      </th>
                      <th>
                        Partial PO Qty
                        <br />
                        <small className="text-muted">(Auto Balance)</small>
                      </th>
                      <th style={{ width: "110px" }}>
                        Invoice Qty
                        <br />
                        <small className="text-primary">(To be filled)</small>
                      </th>
                      <th style={{ width: "110px" }}>
                        Received Qty
                        <br />
                        <small className="text-success">(To be filled)</small>
                      </th>
                      <th>
                        PO Rate
                        <br />
                        <small className="text-muted">(Auto)</small>
                      </th>
                      <th style={{ width: "110px" }}>
                        Invoice Rate
                        <br />
                        <small className="text-primary">(To be filled)</small>
                      </th>
                      <th style={{ width: "170px" }}>
                        Batch Code
                        <br />
                        <small className="text-primary">(To be filled)</small>
                      </th>
                      <th style={{ width: "140px" }}>
                        Remarks
                        <br />
                        <small className="text-muted">(Optional)</small>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const isPartial = item.partial_po_qty > 0;
                      return (
                        <tr
                          key={idx}
                          className={item.selected ? "table-active" : "opacity-75"}
                        >
                          {/* Checkbox */}
                          <td>
                            <Form.Check
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleSelect(idx)}
                            />
                          </td>

                          {/* Item Name */}
                          <td className="text-start">
                            <strong className="text-primary">{item.item_name}</strong>
                            {item.brand && (
                              <div className="text-muted small">
                                Brand: {item.brand} ({item.unit})
                              </div>
                            )}
                          </td>

                          {/* Total PO Qty (Auto) */}
                          <td>
                            <Badge bg="secondary" className="fs-6">
                              {item.total_po_qty} {item.unit}
                            </Badge>
                          </td>

                          {/* Partial PO Qty - Auto (shows balance qty) */}
                          <td>
                            <div>
                              <Badge
                                bg={isPartial ? "warning" : "light"}
                                className={isPartial ? "text-dark" : "text-secondary border"}
                              >
                                Recd: {item.partial_po_qty}
                              </Badge>
                            </div>
                            <div className="mt-1">
                              <Badge bg={item.balance_qty > 0 ? "danger" : "success"}>
                                Balance: {item.balance_qty} {item.unit}
                              </Badge>
                            </div>
                          </td>

                          {/* Invoice Qty (To be filled) */}
                          <td>
                            <Form.Control
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={!item.selected}
                              value={item.invoice_quantity}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  idx,
                                  "invoice_quantity",
                                  e.target.value
                                )
                              }
                              className="text-center fw-semibold"
                            />
                          </td>

                          {/* Received Qty (To be filled) */}
                          <td>
                            <Form.Control
                              type="number"
                              min="0.01"
                              step="0.01"
                              disabled={!item.selected}
                              value={item.received_quantity}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  idx,
                                  "received_quantity",
                                  e.target.value
                                )
                              }
                              className="text-center fw-bold text-success border-success"
                            />
                          </td>

                          {/* PO Rate (Auto) */}
                          <td>
                            <span className="fw-semibold text-muted">
                              ₹{item.po_rate?.toFixed(2)}
                            </span>
                          </td>

                          {/* Invoice Rate (To be filled) */}
                          <td>
                            <Form.Control
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={!item.selected}
                              value={item.invoice_rate}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  idx,
                                  "invoice_rate",
                                  e.target.value
                                )
                              }
                              className="text-center"
                            />
                          </td>

                          {/* Batch Code (To be filled) */}
                          <td>
                            <InputGroup size="sm">
                              <Form.Control
                                type="text"
                                disabled={!item.selected}
                                value={item.batch_code}
                                onChange={(e) =>
                                  handleItemFieldChange(
                                    idx,
                                    "batch_code",
                                    e.target.value
                                  )
                                }
                                placeholder="Batch Code"
                                className="font-monospace"
                              />
                              <Button
                                variant="outline-secondary"
                                title="Regenerate Batch Code"
                                disabled={!item.selected}
                                onClick={() => handleRegenerateBatch(idx)}
                              >
                                <FaBarcode />
                              </Button>
                            </InputGroup>
                          </td>

                          {/* Remarks (To be filled) */}
                          <td>
                            <Form.Control
                              type="text"
                              size="sm"
                              disabled={!item.selected}
                              value={item.remarks}
                              onChange={(e) =>
                                handleItemFieldChange(idx, "remarks", e.target.value)
                              }
                              placeholder="Remarks"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Section 3: Summary & Submission */}
        {selectedPO && selectedItems.length > 0 && (
          <Card className="shadow-sm border-0 mb-4 bg-light">
            <Card.Body>
              <Row className="align-items-center">
                <Col md={8}>
                  <Row className="text-center text-md-start g-2">
                    <Col xs={6} md={3}>
                      <small className="text-muted d-block">Selected Items</small>
                      <strong className="fs-5">{selectedItems.length}</strong>
                    </Col>
                    <Col xs={6} md={3}>
                      <small className="text-muted d-block">Total Received Qty</small>
                      <strong className="fs-5 text-success">
                        {totalReceivedQty.toFixed(2)}
                      </strong>
                    </Col>
                    <Col xs={6} md={3}>
                      <small className="text-muted d-block">Items Total (₹)</small>
                      <strong className="fs-5 text-primary">
                        ₹{totalInvoiceAmount.toFixed(2)}
                      </strong>
                    </Col>
                    <Col xs={6} md={3}>
                      <small className="text-muted d-block">Grand Total (+ Exp)</small>
                      <strong className="fs-5 text-dark">
                        ₹{grandTotal.toFixed(2)}
                      </strong>
                    </Col>
                  </Row>
                  <div className="mt-2">
                    <Form.Control
                      type="text"
                      placeholder="General GRN Remarks (Optional)"
                      value={generalRemarks}
                      onChange={(e) => setGeneralRemarks(e.target.value)}
                    />
                  </div>
                </Col>

                <Col md={4} className="text-center text-md-end mt-3 mt-md-0">
                  <Button
                    type="submit"
                    variant="success"
                    size="lg"
                    disabled={submitting}
                    className="px-4 py-2 fw-bold shadow"
                  >
                    {submitting ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          className="me-2"
                        />
                        Saving GRN...
                      </>
                    ) : (
                      <>
                        <FaCheckCircle className="me-2" />
                        Save GRN Record
                      </>
                    )}
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Empty placeholder */}
        {!selectedPO && !loadingPOs && (
          <div className="text-center py-5 text-muted bg-white rounded shadow-sm border">
            <FaTruckLoading size={50} className="mb-3 text-secondary" />
            <h4>No Purchase Order Selected</h4>
            <p>
              Please select a Purchase Order from the dropdown above to view items and
              fill the Goods Receipt Note.
            </p>
          </div>
        )}
      </Form>
    </Container>
  );
};

export default GRNEntry;

