from app import db
from datetime import datetime
from decimal import Decimal

class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    
    # ✅ PO Number instead of Title
    po_number = db.Column(db.String(100), nullable=False, default="")  # Added default=""
    
    description = db.Column(db.Text)
    priority = db.Column(db.String(20), default="Medium")
    dueDate = db.Column(db.String(50))
    assignedTo = db.Column(db.String(100))
    assignedBy = db.Column(db.String(100))
    assignedByEmail = db.Column(db.String(100))
    
    # ✅ Quotation-related fields
    quotation_id = db.Column(db.Integer)
    quotation_number = db.Column(db.String(50))
    company_name = db.Column(db.String(100))
    company_address = db.Column(db.Text)  # Added for completeness
    item_id = db.Column(db.Integer)
    item_name = db.Column(db.String(100))
    
    # ✅ Item details from quotation - UPDATED
    supplier_part_no = db.Column(db.String(100))
    brand_code = db.Column(db.String(100))  # ✅ NEW: Brand Code from quotation
    batch_no = db.Column(db.String(100))    # ✅ NEW: Batch Number from quotation
    hsn_sac = db.Column(db.String(50))
    cut_width = db.Column(db.String(50))
    length = db.Column(db.String(50))
    quantity = db.Column(db.String(50))
    unit = db.Column(db.String(20), default="pcs")
    mrp = db.Column(db.String(50))
    material_type = db.Column(db.String(100))
    thickness = db.Column(db.String(50))
    
    # ✅ Task tracking
    status = db.Column(db.String(20), default="Pending")
    status_check = db.Column(db.String(20))
    note = db.Column(db.Text)
    createdAt = db.Column(db.DateTime, default=datetime.utcnow)
    
    # ✅ Invoice details
    invoice_number = db.Column(db.String(100))
    invoice_date = db.Column(db.DateTime)
    invoice_amount = db.Column(db.Float)
    invoice_remarks = db.Column(db.Text)
    invoice_created_at = db.Column(db.DateTime)
    
    # ✅ Manufacturing details
    production_start_date = db.Column(db.DateTime)
    production_end_date = db.Column(db.DateTime)
    production_status = db.Column(db.String(50))
    quality_check = db.Column(db.String(50))
    
    # ✅ Additional tracking fields
    updatedAt = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completedAt = db.Column(db.DateTime)
    cancelledAt = db.Column(db.DateTime)
    cancellation_reason = db.Column(db.Text)

    status_history = db.relationship('TaskStatusHistory', backref='task', lazy=True, order_by='TaskStatusHistory.created_at.asc()', cascade='all, delete-orphan')

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Auto-generate PO number if not provided
        if not self.po_number or self.po_number.strip() == "":
            self.po_number = self._generate_po_number()
    
    def _generate_po_number(self):
        """Generate PO number based on timestamp and quotation"""
        timestamp = datetime.utcnow().strftime("%y%m%d%H%M")
        quote_part = self.quotation_number[-4:] if self.quotation_number else "0000"
        return f"PO-{timestamp}-{quote_part}"
    
    @property
    def is_finally_completed(self):
        has_completed_status = (self.status == "Completed" or self.status_check == "Completed")
        has_invoice = bool(self.invoice_number and str(self.invoice_number).strip())
        return has_completed_status and has_invoice

    def to_dict(self):
        """Convert model to dictionary for JSON responses"""
        result = {}
        for c in self.__table__.columns:
            value = getattr(self, c.name)
            if isinstance(value, datetime):
                result[c.name] = value.isoformat() if value else None
            elif isinstance(value, Decimal):
                result[c.name] = float(value)
            else:
                result[c.name] = value
        result['status_history'] = [h.to_dict() for h in (self.status_history or [])]
        result['is_finally_completed'] = self.is_finally_completed
        return result
    
    def __repr__(self):
        return f"<Task {self.po_number}: {self.item_name} - {self.status}>"


class TaskStatusHistory(db.Model):
    __tablename__ = "task_status_history"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False)
    previous_status = db.Column(db.String(50))
    new_status = db.Column(db.String(50), nullable=False)
    remarks = db.Column(db.Text)
    updated_by = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'previous_status': self.previous_status,
            'new_status': self.new_status,
            'remarks': self.remarks,
            'updated_by': self.updated_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }