from app import db
from datetime import datetime
from sqlalchemy import inspect
from sqlalchemy.orm import deferred

class StockSold(db.Model):
    __tablename__ = "stock_sold"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, nullable=False)  # Link to original task
    item_name = db.Column(db.String(200))
    company_name = db.Column(db.String(200))
    quantity = db.Column(db.Float)  # Sold quantity
    unit = db.Column(db.String(50), default="PCS")
    sold_date = db.Column(db.String(30))  # Date when sold (YYYY-MM-DD)
    customer_name = db.Column(db.String(200))
    sold_remarks = db.Column(db.String(500))
    created_on = db.Column(db.DateTime, default=datetime.utcnow)
    
    # ✅ Saved status tracking
    is_saved = db.Column(db.Boolean, default=True, nullable=False)  # True when saved to stock sold
    saved_on = db.Column(db.DateTime)  # When it was saved
    
    # ✅ ADDED: Stock deducted status
    stock_deducted = db.Column(db.String(10), default="No", nullable=False)  # Yes/No status
    deducted_on = db.Column(db.DateTime)  # When stock was deducted
    
    # Additional fields for detailed information
    hsn_sac = db.Column(db.String(100))
    invoice_remarks = db.Column(db.String(500))
    invoice_amount = db.Column(db.Float, default=0.0)
    mrp = db.Column(db.Float, default=0.0)
    material_type = db.Column(db.String(100))
    production_end_date = db.Column(db.String(30))
    production_start_date = db.Column(db.String(30))
    production_status = db.Column(db.String(100))
    quality_check = db.Column(db.String(100))
    thickness = db.Column(db.String(50))
    due_date = db.Column(db.String(30))
    
    # Use property getters/setters that check if column exists
    
    # Property for length
    @property
    def length(self):
        try:
            return self._length if hasattr(self, '_length') else 0.0
        except:
            return 0.0
    
    @length.setter
    def length(self, value):
        self._length = float(value) if value is not None else 0.0
    
    # Property for width
    @property
    def width(self):
        try:
            return self._width if hasattr(self, '_width') else 0.0
        except:
            return 0.0
    
    @width.setter
    def width(self, value):
        self._width = float(value) if value is not None else 0.0
    
    # Property for batch_code
    @property
    def batch_code(self):
        try:
            return self._batch_code if hasattr(self, '_batch_code') else ""
        except:
            return ""
    
    @batch_code.setter
    def batch_code(self, value):
        self._batch_code = str(value) if value is not None else ""
    
    # Property for brand_code
    @property
    def brand_code(self):
        try:
            return self._brand_code if hasattr(self, '_brand_code') else ""
        except:
            return ""
    
    @brand_code.setter
    def brand_code(self, value):
        self._brand_code = str(value) if value is not None else ""
    
    # Property for brand
    @property
    def brand(self):
        try:
            return self._brand if hasattr(self, '_brand') else ""
        except:
            return ""
    
    @brand.setter
    def brand(self, value):
        self._brand = str(value) if value is not None else ""
    
    def __init__(self, **kwargs):
        # Store kwargs for later processing
        self._init_kwargs = kwargs.copy()
        
        # Extract and process the new fields from kwargs
        length_val = kwargs.pop('length', 0.0)
        width_val = kwargs.pop('width', 0.0)
        batch_code_val = kwargs.pop('batch_code', '')
        brand_code_val = kwargs.pop('brand_code', '')
        brand_val = kwargs.pop('brand', '')
        
        # Set default values for existing columns
        if 'unit' not in kwargs:
            kwargs['unit'] = "PCS"
        if 'is_saved' not in kwargs:
            kwargs['is_saved'] = True
        if 'saved_on' not in kwargs and kwargs.get('is_saved', True):
            kwargs['saved_on'] = datetime.utcnow()
        if 'stock_deducted' not in kwargs:
            kwargs['stock_deducted'] = "No"
        
        # Ensure float fields have defaults
        float_fields = ['quantity', 'invoice_amount', 'mrp']
        for field in float_fields:
            if field in kwargs and kwargs[field] is None:
                kwargs[field] = 0.0
        
        # Call parent constructor with only existing columns
        super(StockSold, self).__init__(**kwargs)
        
        # Set the new fields as instance attributes
        self.length = length_val
        self.width = width_val
        self.batch_code = batch_code_val
        self.brand_code = brand_code_val
        self.brand = brand_val
    
    def to_dict(self):
        # Start with basic fields that definitely exist
        base_dict = {
            "id": self.id,
            "task_id": self.task_id,
            "item_name": self.item_name or "",
            "company_name": self.company_name or "",
            "quantity": float(self.quantity) if self.quantity else 0.0,
            "unit": self.unit or "PCS",
            "sold_date": self.sold_date or "",
            "customer_name": self.customer_name or "",
            "sold_remarks": self.sold_remarks or "",
            "created_on": self.created_on.isoformat() if self.created_on else None,
            "is_saved": bool(self.is_saved),
            "saved_on": self.saved_on.isoformat() if self.saved_on else None,
            "stock_deducted": self.stock_deducted or "No",  # ✅ Added
            "deducted_on": self.deducted_on.isoformat() if self.deducted_on else None,  # ✅ Added
            "hsn_sac": self.hsn_sac or "",
            "invoice_remarks": self.invoice_remarks or "",
            "invoice_amount": float(self.invoice_amount) if self.invoice_amount else 0.0,
            "mrp": float(self.mrp) if self.mrp else 0.0,
            "material_type": self.material_type or "",
            "production_end_date": self.production_end_date or "",
            "production_start_date": self.production_start_date or "",
            "production_status": self.production_status or "",
            "quality_check": self.quality_check or "",
            "thickness": self.thickness or "",
            "due_date": self.due_date or ""
        }
        
        # Add the new fields using properties
        base_dict.update({
            "length": self.length,  # Uses the property getter
            "width": self.width,    # Uses the property getter
            "batch_code": self.batch_code,
            "brand_code": self.brand_code,
            "brand": self.brand
        })
        
        return base_dict
    
    # ✅ Method to mark as saved
    def mark_as_saved(self):
        self.is_saved = True
        self.saved_on = datetime.utcnow()
    
    # ✅ Method to mark stock as deducted
    def mark_stock_deducted(self):
        self.stock_deducted = "Yes"
        self.deducted_on = datetime.utcnow()
    
    # ✅ Method to mark stock as not deducted
    def mark_stock_not_deducted(self):
        self.stock_deducted = "No"
        self.deducted_on = None
    
    def __repr__(self):
        return f"<StockSold {self.id}: {self.item_name} - Qty: {self.quantity} - Saved: {self.is_saved} - Deducted: {self.stock_deducted}>"
    
    @classmethod
    def check_column_exists(cls, column_name):
        """Check if a column exists in the database table"""
        try:
            inspector = inspect(db.engine)
            columns = inspector.get_columns(cls.__tablename__)
            return any(col['name'] == column_name for col in columns)
        except:
            return False