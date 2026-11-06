from datetime import datetime, timedelta
from sqlalchemy import func
from app import db


class EnquiryItem(db.Model):
    __tablename__ = 'enquiry_items'  # Changed to plural for consistency

    id = db.Column(db.Integer, primary_key=True)

    # Item details
    item_name = db.Column(db.String(200), nullable=False)
    hsn_sac = db.Column(db.String(20))
    supplier_part_no = db.Column(db.String(100))
    description = db.Column(db.Text)  # For general description

    cut_width = db.Column(db.Float, default=1.0)
    length = db.Column(db.Float, default=1.0)
    count = db.Column(db.Float, default=1.0)

    batch_no = db.Column(db.String(100))
    brand_code = db.Column(db.String(100))
    quantity = db.Column(db.Float, default=1.0)
    unit = db.Column(db.String(20), default='pcs')

    # REMOVED: item_status - only enquiry-level status
    customer_description = db.Column(db.Text)  # Direct field for customer description
    customer_requirements = db.Column(db.Text)
    notes = db.Column(db.Text)
    source = db.Column(db.String(50), default='email')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # FK - Fixed table name
    enquiry_id = db.Column(
        db.Integer,
        db.ForeignKey('enquiries.id'),  # Changed to 'enquiries'
        nullable=False
    )

    def to_dict(self):
        return {
            'id': self.id,
            'item_name': self.item_name,
            'hsn_sac': self.hsn_sac,
            'supplier_part_no': self.supplier_part_no,
            'description': self.description,
            'cut_width': self.cut_width,
            'length': self.length,
            'count': self.count,
            'batch_no': self.batch_no,
            'brand_code': self.brand_code,
            'quantity': self.quantity,
            'unit': self.unit,
            'customer_description': self.customer_description,
            'customer_requirements': self.customer_requirements,
            'notes': self.notes,
            'source': self.source,
            'enquiry_id': self.enquiry_id,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class Enquiry(db.Model):
    __tablename__ = 'enquiries'  # Changed to plural for consistency

    id = db.Column(db.Integer, primary_key=True)
    enquiry_number = db.Column(db.String(100), unique=True, nullable=False)

    # Issuer details (hardcoded)
    issuer_name = db.Column(db.String(200), default='Lakhotia')
    issuer_address = db.Column(db.Text, default='64/3A Sidco Industrial Estate, Ambatur, Chennai')
    issuer_phone = db.Column(db.String(15), default='7845663338')
    issuer_email = db.Column(db.String(100), default='vivek@lakhotia.net')
    issuer_gstin = db.Column(db.String(15), default='33AABFL9981E1Z7')
    issuer_state_code = db.Column(db.String(50), default='33-Tamil Nadu')

    # Company
    company_id = db.Column(db.Integer, db.ForeignKey('companies.id'))
    company_name = db.Column(db.String(200), nullable=False)
    company_address = db.Column(db.Text)
    company_pincode = db.Column(db.String(10))
    company_gstin = db.Column(db.String(20))

    # Contact
    contact_person = db.Column(db.String(100))
    contact_mobile = db.Column(db.String(15))
    contact_email = db.Column(db.String(100))

    # Enquiry status (only enquiry-level status, not item-level)
    status = db.Column(db.String(50), default='draft')
    total_items = db.Column(db.Integer, default=0)
    total_quantity = db.Column(db.Float, default=0.0)

    created_by = db.Column(db.String(100))
    updated_by = db.Column(db.String(100))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    date = db.Column(db.Date, default=lambda: datetime.utcnow().date())
    time = db.Column(db.Time, default=lambda: datetime.utcnow().time())

    # Relationships
    items = db.relationship(
        'EnquiryItem',
        backref='enquiry',
        cascade='all, delete-orphan',
        lazy=True,
        order_by='EnquiryItem.id'
    )

    company = db.relationship('Company', backref='enquiries', lazy=True)

    def to_dict(self):
        items_data = []
        for item in self.items:
            item_dict = item.to_dict()
            items_data.append(item_dict)

        return {
            'id': self.id,
            'enquiry_number': self.enquiry_number,
            'company_name': self.company_name,
            'company_address': self.company_address,
            'company_pincode': self.company_pincode,
            'company_gstin': self.company_gstin,
            'contact_person': self.contact_person,
            'contact_mobile': self.contact_mobile,
            'contact_email': self.contact_email,
            'status': self.status,
            'total_items': self.total_items,
            'total_quantity': self.total_quantity,
            'date': self.date.isoformat() if self.date else None,
            'time': str(self.time) if self.time else None,
            'created_by': self.created_by,
            'updated_by': self.updated_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'items': items_data,
            'issuer': {
                'name': self.issuer_name,
                'address': self.issuer_address,
                'phone': self.issuer_phone,
                'email': self.issuer_email,
                'gstin': self.issuer_gstin,
                'state_code': self.issuer_state_code
            }
        }

    @classmethod
    def generate_enquiry_number(cls):
        today = datetime.utcnow().strftime('%Y%m%d')
        
        # Check for any enquiry with today's date pattern
        today_prefix = f'ENQ-{today}-'
        
        # Get the last enquiry number for today
        last_enquiry = cls.query.filter(
            cls.enquiry_number.like(f'{today_prefix}%')
        ).order_by(cls.enquiry_number.desc()).first()
        
        if last_enquiry:
            try:
                # Extract the numeric part and increment
                last_num = int(last_enquiry.enquiry_number.split('-')[-1])
                next_num = last_num + 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1
        
        return f'{today_prefix}{next_num:04d}'

    @classmethod
    def get_statistics(cls):
        total = cls.query.count()

        statuses = ['draft', 'in_progress', 'responded', 'converted', 'lost']
        status_counts = {
            s: cls.query.filter_by(status=s).count()
            for s in statuses
        }

        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent = cls.query.filter(cls.created_at >= thirty_days_ago).count()

        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        this_month = cls.query.filter(cls.created_at >= month_start).count()

        # Calculate conversion rate
        total_converted = status_counts.get('converted', 0)
        conversion_rate = round((total_converted / total * 100) if total > 0 else 0, 2)

        return {
            'total': total,
            'status_counts': status_counts,
            'recent_30_days': recent,
            'this_month': this_month,
            'conversion_rate': conversion_rate
        }

    def update_totals(self):
        """Update total_items and total_quantity from items"""
        self.total_items = len(self.items)
        self.total_quantity = sum(item.quantity for item in self.items if item.quantity)
        db.session.commit()