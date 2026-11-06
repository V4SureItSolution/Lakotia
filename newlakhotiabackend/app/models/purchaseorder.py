from datetime import datetime
from app import db
from sqlalchemy import JSON


class PurchaseOrder(db.Model):
    __tablename__ = 'purchase_orders'

    id = db.Column(db.Integer, primary_key=True)

    po_number = db.Column(db.String(50), unique=True, nullable=False)
    po_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    delivery_date = db.Column(db.Date, nullable=True)

    # Company Information
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=True)
    company_name = db.Column(db.String(200), nullable=False)
    company_address = db.Column(db.String(500))
    customer_name = db.Column(db.String(100), nullable=False)
    customer_mobile = db.Column(db.String(15))
    customer_email = db.Column(db.String(100))
    department = db.Column(db.String(100))
    gst_number = db.Column(db.String(20))

    supplier_part_no = db.Column(db.String(100))
    supplier_description = db.Column(db.String(500))

    status = db.Column(
        db.String(20),
        nullable=False,
        default='pending'
    )  # pending, approved, rejected, completed

    # Approval/Rejection details
    approval_remarks = db.Column(db.String(500))
    rejection_remarks = db.Column(db.String(500))
    approved_date = db.Column(db.DateTime, nullable=True)
    rejected_date = db.Column(db.DateTime, nullable=True)

    items = db.Column(JSON, nullable=False)
    received_items = db.Column(JSON, default=list, nullable=True)  # Track received quantities
    total_amount = db.Column(db.Float, nullable=False, default=0.0)

    created_on = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_on = db.Column(
        db.DateTime,
        nullable=True,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    def __init__(
        self,
        po_number,
        po_date,
        company_name,
        customer_name,
        items,
        total_amount,
        company_id=None,
        company_address=None,
        customer_mobile=None,
        customer_email=None,
        department=None,
        gst_number=None,
        supplier_part_no=None,
        supplier_description=None,
        delivery_date=None,
        status='pending',
        approval_remarks=None,
        rejection_remarks=None,
        received_items=None
    ):
        self.po_number = po_number
        self.po_date = po_date
        self.delivery_date = delivery_date
        self.company_id = company_id
        self.company_name = company_name
        self.company_address = company_address
        self.customer_name = customer_name
        self.customer_mobile = customer_mobile
        self.customer_email = customer_email
        self.department = department
        self.gst_number = gst_number
        self.supplier_part_no = supplier_part_no
        self.supplier_description = supplier_description
        self.status = status
        self.approval_remarks = approval_remarks
        self.rejection_remarks = rejection_remarks
        self.items = items
        self.received_items = received_items if received_items is not None else []
        self.total_amount = total_amount

    def to_dict(self):
        # Calculate delivery status based on received items
        delivery_status = 'new'
        if self.received_items:
            total_items = len(self.items)
            received_items_count = len([r for r in self.received_items if r.get('received_quantity', 0) > 0])
            if 0 < received_items_count < total_items:
                delivery_status = 'partial'
            elif received_items_count == total_items:
                delivery_status = 'completed'
        
        # Add delivered and remaining quantities to items
        items_with_delivery = []
        if self.items:
            for idx, item in enumerate(self.items):
                item_copy = item.copy()
                # Find received quantity for this item
                received_qty = 0
                if self.received_items:
                    for received in self.received_items:
                        if received.get('item_index') == idx:
                            received_qty = received.get('received_quantity', 0)
                            break
                item_copy['delivered_quantity'] = received_qty
                item_copy['remaining_quantity'] = item.get('quantity', 0) - received_qty
                item_copy['original_quantity'] = item.get('quantity', 0)
                items_with_delivery.append(item_copy)
        
        # Calculate remaining items (only those with remaining quantity > 0)
        remaining_items = [
            item for item in items_with_delivery 
            if item.get('remaining_quantity', 0) > 0
        ]
        
        return {
            'id': self.id,
            'po_number': self.po_number,
            'po_date': self.po_date.isoformat() if self.po_date else None,
            'delivery_date': self.delivery_date.isoformat() if self.delivery_date else None,
            'company_id': self.company_id,
            'company_name': self.company_name,
            'company_address': self.company_address,
            'customer_name': self.customer_name,
            'customer_mobile': self.customer_mobile,
            'customer_email': self.customer_email,
            'department': self.department,
            'gst_number': self.gst_number,
            'supplier_part_no': self.supplier_part_no,
            'supplier_description': self.supplier_description,
            'status': self.status,
            'approval_remarks': self.approval_remarks,
            'rejection_remarks': self.rejection_remarks,
            'approved_date': self.approved_date.isoformat() if self.approved_date else None,
            'rejected_date': self.rejected_date.isoformat() if self.rejected_date else None,
            'items': items_with_delivery,
            'remaining_items': remaining_items,
            'received_items': self.received_items or [],
            'total_amount': float(self.total_amount) if self.total_amount else 0.0,
            'delivery_status': delivery_status,
            'created_on': self.created_on.isoformat() if self.created_on else None,
            'updated_on': self.updated_on.isoformat() if self.updated_on else None
        }