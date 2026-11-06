from app import db
from datetime import datetime


class GRN(db.Model):
    __tablename__ = "grn"

    id = db.Column(db.Integer, primary_key=True)

    # Purchase Order reference
    po_number = db.Column(db.String(50), nullable=False)
    po_date = db.Column(db.String(20), nullable=True)

    # Invoice details
    invoice_number = db.Column(db.String(100), nullable=False)
    invoice_date = db.Column(db.String(20), nullable=False)  # kept as STRING

    # Company Details (from Purchase Order)
    company_name = db.Column(db.String(200))
    company_address = db.Column(db.String(500))
    customer_name = db.Column(db.String(100))
    customer_mobile = db.Column(db.String(15))
    customer_email = db.Column(db.String(100))
    department = db.Column(db.String(100))
    gst_number = db.Column(db.String(20))
    supplier_part_no = db.Column(db.String(100))
    supplier_description = db.Column(db.String(500))

    # Item Details
    item_name = db.Column(db.String(200), nullable=False)
    brand = db.Column(db.String(100))
    brand_code = db.Column(db.String(50))
    brand_description = db.Column(db.String(500))
    length = db.Column(db.String(50))
    width = db.Column(db.String(50))
    unit = db.Column(db.String(20), default="PCS")
    quantity = db.Column(db.Float, nullable=False, default=1.0)
    buy_price = db.Column(db.Float, nullable=False)

    # Auto generated batch code
    batch_code = db.Column(db.String(100), nullable=False)

    # GRN Status
    status = db.Column(db.String(20), default="active", nullable=False)  # active, cancelled, returned
    
    # Partial Delivery Flag
    is_partial = db.Column(db.Boolean, default=False, nullable=False)  # True if this is a partial delivery
    
    # Delivery Sequence (for tracking multiple deliveries of same PO)
    delivery_sequence = db.Column(db.Integer, default=1, nullable=False)
    
    # Original PO item details (for reference)
    original_quantity = db.Column(db.Float, nullable=True)  # Original ordered quantity from PO
    delivered_before = db.Column(db.Float, default=0.0, nullable=True)  # Quantity delivered before this GRN
    invoice_quantity = db.Column(db.Float, nullable=True)  # Quantity on Invoice
    invoice_rate = db.Column(db.Float, nullable=True)      # Rate on Invoice
    transport_charges = db.Column(db.Float, default=0.0, nullable=True)
    other_expense = db.Column(db.Float, default=0.0, nullable=True)
    remarks = db.Column(db.String(500), nullable=True)

    # Created timestamp
    created_on = db.Column(db.DateTime, default=datetime.utcnow)
    # Updated timestamp
    updated_on = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(
        self,
        po_number,
        invoice_number,
        invoice_date,
        company_name,
        customer_name,
        item_name,
        brand,
        buy_price,
        batch_code,
        company_address=None,
        customer_mobile=None,
        customer_email=None,
        department=None,
        gst_number=None,
        supplier_part_no=None,
        supplier_description=None,
        brand_code=None,
        brand_description=None,
        length=None,
        width=None,
        unit="PCS",
        quantity=1.0,
        status="active",
        is_partial=False,
        delivery_sequence=1,
        original_quantity=None,
        delivered_before=0.0,
        po_date=None,
        invoice_quantity=None,
        invoice_rate=None,
        transport_charges=0.0,
        other_expense=0.0,
        remarks=None
    ):
        self.po_number = po_number
        self.invoice_number = invoice_number
        self.invoice_date = invoice_date

        # Company details
        self.company_name = company_name
        self.company_address = company_address
        self.customer_name = customer_name
        self.customer_mobile = customer_mobile
        self.customer_email = customer_email
        self.department = department
        self.gst_number = gst_number
        self.supplier_part_no = supplier_part_no
        self.supplier_description = supplier_description

        # Item details
        self.item_name = item_name
        self.brand = brand
        self.brand_code = brand_code
        self.brand_description = brand_description
        self.length = length
        self.width = width
        self.unit = unit
        self.quantity = quantity
        self.buy_price = buy_price
        self.batch_code = batch_code
        self.status = status
        
        # Partial delivery tracking
        self.is_partial = is_partial
        self.delivery_sequence = delivery_sequence
        self.original_quantity = original_quantity
        self.delivered_before = delivered_before
        self.po_date = po_date
        self.invoice_quantity = invoice_quantity
        self.invoice_rate = invoice_rate
        self.transport_charges = transport_charges or 0.0
        self.other_expense = other_expense or 0.0
        self.remarks = remarks or ""

    def to_dict(self):
        def format_datetime(value):
            if isinstance(value, datetime):
                return value.strftime("%Y-%m-%d %H:%M:%S")
            return value

        return {
            "id": self.id,
            "po_number": self.po_number,
            "po_date": self.po_date,
            "invoice_number": self.invoice_number,
            "invoice_date": self.invoice_date,

            # Company details
            "company_name": self.company_name,
            "company_address": self.company_address,
            "customer_name": self.customer_name,
            "customer_mobile": self.customer_mobile,
            "customer_email": self.customer_email,
            "department": self.department,
            "gst_number": self.gst_number,
            "supplier_part_no": self.supplier_part_no,
            "supplier_description": self.supplier_description,

            # Item details
            "item_name": self.item_name,
            "brand": self.brand,
            "brand_code": self.brand_code,
            "brand_description": self.brand_description,
            "length": self.length,
            "width": self.width,
            "unit": self.unit,
            "quantity": float(self.quantity) if self.quantity is not None else 1.0,
            "buy_price": float(self.buy_price) if self.buy_price is not None else 0.0,
            "batch_code": self.batch_code,
            "status": self.status,
            
            # Partial delivery info
            "is_partial": self.is_partial,
            "delivery_sequence": self.delivery_sequence,
            "original_quantity": float(self.original_quantity) if self.original_quantity else None,
            "delivered_before": float(self.delivered_before) if self.delivered_before else 0.0,
            
            "invoice_quantity": float(self.invoice_quantity) if self.invoice_quantity is not None else None,
            "invoice_rate": float(self.invoice_rate) if self.invoice_rate is not None else None,
            "transport_charges": float(self.transport_charges) if self.transport_charges is not None else 0.0,
            "other_expense": float(self.other_expense) if self.other_expense is not None else 0.0,
            "remarks": self.remarks or "",

            # Calculated fields
            "remaining_quantity": float(self.original_quantity - (self.delivered_before + self.quantity)) 
                if self.original_quantity else None,

            # Safe datetime output
            "created_on": format_datetime(self.created_on),
            "updated_on": format_datetime(self.updated_on)
        }
    
    def get_delivery_summary(self):
        """Get delivery summary for this item"""
        if self.original_quantity:
            total_delivered = (self.delivered_before or 0) + self.quantity
            return {
                "original": self.original_quantity,
                "delivered_before": self.delivered_before or 0,
                "current_delivery": self.quantity,
                "total_delivered": total_delivered,
                "remaining": self.original_quantity - total_delivered,
                "delivery_percentage": (total_delivered / self.original_quantity * 100) if self.original_quantity > 0 else 0
            }
        return None


# Helper function to get PO delivery status
def get_po_delivery_status(po_number):
    """Get delivery status for a PO"""
    try:
        # Get all GRN items for this PO
        grn_items = GRN.query.filter_by(po_number=po_number, status='active').all()
        
        if not grn_items:
            return {
                'has_deliveries': False,
                'total_delivered': 0,
                'items_delivered': []
            }
        
        # Group by item name and sum quantities
        item_deliveries = {}
        for item in grn_items:
            if item.item_name not in item_deliveries:
                item_deliveries[item.item_name] = 0
            item_deliveries[item.item_name] += item.quantity
        
        # Get PO to compare with original quantities
        from app.models.purchaseorder import PurchaseOrder
        po = PurchaseOrder.query.filter_by(po_number=po_number).first()
        
        if po and po.items:
            item_status = []
            for po_item in po.items:
                item_name = po_item.get('item_name')
                ordered_qty = po_item.get('quantity', 0)
                delivered_qty = item_deliveries.get(item_name, 0)
                
                item_status.append({
                    'item_name': item_name,
                    'ordered_quantity': ordered_qty,
                    'delivered_quantity': delivered_qty,
                    'remaining_quantity': max(0, ordered_qty - delivered_qty),
                    'is_fully_delivered': delivered_qty >= ordered_qty
                })
            
            total_ordered = sum(item['ordered_quantity'] for item in item_status)
            total_delivered = sum(item['delivered_quantity'] for item in item_status)
            
            return {
                'has_deliveries': True,
                'total_ordered': total_ordered,
                'total_delivered': total_delivered,
                'total_remaining': total_ordered - total_delivered,
                'delivery_percentage': (total_delivered / total_ordered * 100) if total_ordered > 0 else 0,
                'items': item_status,
                'is_fully_delivered': all(item['is_fully_delivered'] for item in item_status)
            }
        
        return {
            'has_deliveries': True,
            'total_delivered': sum(item_deliveries.values()),
            'items_delivered': item_deliveries
        }
        
    except Exception as e:
        print(f"Error getting PO delivery status: {str(e)}")
        return {
            'has_deliveries': False,
            'error': str(e)
        }


# Helper function to get all deliveries for a PO
def get_po_delivery_history(po_number):
    """Get all delivery history for a PO grouped by invoice"""
    try:
        deliveries = GRN.query.filter_by(
            po_number=po_number
        ).order_by(GRN.created_on).all()
        
        if not deliveries:
            return []
        
        # Group by invoice
        invoice_groups = {}
        for delivery in deliveries:
            if delivery.invoice_number not in invoice_groups:
                invoice_groups[delivery.invoice_number] = {
                    'invoice_number': delivery.invoice_number,
                    'invoice_date': delivery.invoice_date,
                    'created_on': delivery.created_on,
                    'items': [],
                    'is_partial': delivery.is_partial,
                    'total_quantity': 0,
                    'total_amount': 0
                }
            
            item_total = delivery.quantity * delivery.buy_price
            invoice_groups[delivery.invoice_number]['items'].append(delivery.to_dict())
            invoice_groups[delivery.invoice_number]['total_quantity'] += delivery.quantity
            invoice_groups[delivery.invoice_number]['total_amount'] += item_total
        
        return list(invoice_groups.values())
        
    except Exception as e:
        print(f"Error getting PO delivery history: {str(e)}")
        return []


# Helper function to check if PO is fully delivered
def is_po_fully_delivered(po_number):
    """Check if a PO is fully delivered"""
    try:
        from app.models.purchaseorder import PurchaseOrder
        
        po = PurchaseOrder.query.filter_by(po_number=po_number).first()
        if not po or not po.items:
            return False
        
        # Get all deliveries
        deliveries = GRN.query.filter_by(po_number=po_number, status='active').all()
        
        # Group deliveries by item
        delivered_quantities = {}
        for delivery in deliveries:
            if delivery.item_name not in delivered_quantities:
                delivered_quantities[delivery.item_name] = 0
            delivered_quantities[delivery.item_name] += delivery.quantity
        
        # Check each item
        for po_item in po.items:
            item_name = po_item.get('item_name')
            ordered_qty = po_item.get('quantity', 0)
            delivered_qty = delivered_quantities.get(item_name, 0)
            
            if delivered_qty < ordered_qty:
                return False
        
        return True
        
    except Exception as e:
        print(f"Error checking PO delivery status: {str(e)}")
        return False