from app import db
from datetime import datetime

# ---------------------------
# QUOTATION MODEL
# ---------------------------
class Quotation(db.Model):
    __tablename__ = 'quotations'

    id = db.Column(db.Integer, primary_key=True)
    quote_number = db.Column(db.String(50), unique=True, nullable=False)

    # Date & Time
    date = db.Column(db.String(10), nullable=False)
    time = db.Column(db.String(10), nullable=False)

    # Company Details
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'), nullable=True)
    company_name = db.Column(db.String(200), nullable=False)
    company_address = db.Column(db.Text, nullable=True)
    company_gstin = db.Column(db.String(20), nullable=True)

    # Contact Details
    contact_person = db.Column(db.String(100))
    contact_mobile = db.Column(db.String(20))
    contact_email = db.Column(db.String(100))

    # Issuer
    issuer_details = db.Column(db.JSON, default={})

    # Totals
    subtotal = db.Column(db.Numeric(12, 2), default=0)
    total_discount = db.Column(db.Numeric(12, 2), default=0)
    total_packing = db.Column(db.Numeric(12, 2), default=0)
    total_freight = db.Column(db.Numeric(12, 2), default=0)
    total_tax = db.Column(db.Numeric(12, 2), default=0)
    grand_total = db.Column(db.Numeric(12, 2), default=0)

    # Status
    status = db.Column(db.String(20), default='draft')
    review_status = db.Column(db.String(20), default='pending')

    # Sales Order Tracking (NEW)
    sales_order_number = db.Column(db.String(50), nullable=True, unique=True)
    sales_order_date = db.Column(db.DateTime, nullable=True)
    sales_order_status = db.Column(db.String(20), default='not_created')
    # Sales Order Status Values: 'not_created', 'draft', 'confirmed', 'in_production', 
    # 'ready_for_dispatch', 'dispatched', 'delivered', 'cancelled'
    
    # Sales Order Remarks
    sales_order_remark = db.Column(db.Text, nullable=True)
    
    # User Tracking
    created_by = db.Column(db.String(100))
    updated_by = db.Column(db.String(100))

    # Notes
    notes = db.Column(db.Text)
    
    # New fields for requote
    requote_note = db.Column(db.Text)  # Note for re-quote reason
    original_quote_id = db.Column(db.Integer, nullable=True)  # Reference to original quote if this is a re-quote
    requote_date = db.Column(db.DateTime, nullable=True)  # When re-quote was created

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    items = db.relationship(
        'QuotationItem',
        backref='quotation',
        lazy=True,
        cascade='all, delete-orphan'
    )

    # Convert to dict
    def to_dict(self):
        return {
            'id': self.id,
            'quote_number': self.quote_number,
            'date': self.date,
            'time': self.time,
            'company_id': self.company_id,
            'company_name': self.company_name,
            'company_address': self.company_address,
            'company_gstin': self.company_gstin,
            'contact_person': self.contact_person,
            'contact_mobile': self.contact_mobile,
            'contact_email': self.contact_email,
            'issuer_details': self.issuer_details or {},
            'subtotal': float(self.subtotal) if self.subtotal is not None else 0,
            'total_discount': float(self.total_discount) if self.total_discount is not None else 0,
            'total_packing': float(self.total_packing) if getattr(self, 'total_packing', None) is not None else 0,
            'total_freight': float(self.total_freight) if getattr(self, 'total_freight', None) is not None else 0,
            'total_tax': float(self.total_tax) if self.total_tax is not None else 0,
            'grand_total': float(self.grand_total) if self.grand_total is not None else 0,
            'notes': self.notes,
            'requote_note': self.requote_note,
            'original_quote_id': self.original_quote_id,
            'requote_date': self.requote_date.isoformat() if self.requote_date else None,
            'status': self.status,
            'review_status': self.review_status,
            # Sales Order Fields (NEW)
            'sales_order_number': self.sales_order_number,
            'sales_order_date': self.sales_order_date.isoformat() if self.sales_order_date else None,
            'sales_order_status': self.sales_order_status,
            'sales_order_remark': self.sales_order_remark,
            'created_by': self.created_by,
            'updated_by': self.updated_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'items': [item.to_dict() for item in self.items]
        }


# ---------------------------
# QUOTATION ITEM MODEL
# ---------------------------
class QuotationItem(db.Model):
    __tablename__ = 'quotation_items'

    id = db.Column(db.Integer, primary_key=True)
    quotation_id = db.Column(db.Integer, db.ForeignKey('quotations.id'), nullable=False)

    # Item Details
    item_name = db.Column(db.String(200), nullable=False)
    hsn_sac = db.Column(db.String(20))
    supplier_part_no = db.Column(db.String(100))
    customer_part_no = db.Column(db.String(100))
    description = db.Column(db.Text)
    customer_description = db.Column(db.Text)

    # Dimensions
    cut_width = db.Column(db.Numeric(10, 2), default=0)
    length = db.Column(db.Numeric(10, 2), default=0)

    # Batch
    batch_no = db.Column(db.String(50))

    # Pricing
    mrp = db.Column(db.Numeric(12, 2), default=0)
    quantity = db.Column(db.Numeric(10, 2), default=1)
    unit = db.Column(db.String(20), default='pcs')

    # Discount
    discount = db.Column(db.Numeric(10, 2), default=0)
    discount_type = db.Column(db.String(20), default='amount')   # amount or percentage

    # Tax
    tax_rate = db.Column(db.Numeric(5, 2), default=18.0)

    # Status
    item_status = db.Column(db.String(20), default='pending')
    review_status = db.Column(db.String(20), default='pending')

    # NEW: Sales order tracking
    sales_order_created = db.Column(db.Boolean, default=False)
    sales_order_remark = db.Column(db.Text)
    sales_order_date = db.Column(db.DateTime, nullable=True)
    
    # NEW: Item-level sales order status
    sales_order_item_status = db.Column(db.String(20), default='not_created')
    # Sales Order Item Status Values: 'not_created', 'ordered', 'in_production', 
    # 'ready', 'dispatched', 'delivered', 'rejected'
    
    # NEW: Rejection reason
    rejection_reason = db.Column(db.Text)
    
    updated_by = db.Column(db.String(100))

    # Charges & Profit
    packing_charges = db.Column(db.Numeric(10, 2), default=0)
    freight_charges = db.Column(db.Numeric(10, 2), default=0)
    profit_percentage = db.Column(db.Numeric(5, 2), default=20.0)

    # Calculated Fields
    price_per_unit = db.Column(db.Numeric(12, 2), default=0)
    amount_before_discount = db.Column(db.Numeric(12, 2), default=0)
    discount_amount = db.Column(db.Numeric(12, 2), default=0)
    amount_after_discount = db.Column(db.Numeric(12, 2), default=0)
    tax_amount = db.Column(db.Numeric(12, 2), default=0)
    item_total = db.Column(db.Numeric(12, 2), default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'quotation_id': self.quotation_id,
            'item_name': self.item_name,
            'hsn_sac': self.hsn_sac,
            'supplier_part_no': self.supplier_part_no,
            'customer_part_no': self.customer_part_no,
            'description': self.description,
            'customer_description': self.customer_description,
            'cut_width': float(self.cut_width) if self.cut_width is not None else 0,
            'length': float(self.length) if self.length is not None else 0,
            'batch_no': self.batch_no,
            'mrp': float(self.mrp) if self.mrp is not None else 0,
            'quantity': float(self.quantity) if self.quantity is not None else 1,
            'unit': self.unit,
            'discount': float(self.discount) if self.discount is not None else 0,
            'discount_type': self.discount_type,
            'packing_charges': float(self.packing_charges) if getattr(self, 'packing_charges', None) is not None else 0,
            'freight_charges': float(self.freight_charges) if getattr(self, 'freight_charges', None) is not None else 0,
            'profit_percentage': float(self.profit_percentage) if getattr(self, 'profit_percentage', None) is not None else 20.0,
            'tax_rate': float(self.tax_rate) if self.tax_rate is not None else 18.0,
            'item_status': self.item_status,
            'review_status': self.review_status,
            'sales_order_created': self.sales_order_created,
            'sales_order_remark': self.sales_order_remark,
            'sales_order_date': self.sales_order_date.isoformat() if self.sales_order_date else None,
            'sales_order_item_status': self.sales_order_item_status,
            'rejection_reason': self.rejection_reason,
            'updated_by': self.updated_by,
            'price_per_unit': float(self.price_per_unit) if self.price_per_unit is not None else 0,
            'amount_before_discount': float(self.amount_before_discount) if self.amount_before_discount is not None else 0,
            'discount_amount': float(self.discount_amount) if self.discount_amount is not None else 0,
            'amount_after_discount': float(self.amount_after_discount) if self.amount_after_discount is not None else 0,
            'tax_amount': float(self.tax_amount) if self.tax_amount is not None else 0,
            'item_total': float(self.item_total) if self.item_total is not None else 0
        }