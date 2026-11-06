from app import db
from datetime import datetime

class VisitReport(db.Model):
    __tablename__ = 'visit_reports'

    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(150), nullable=False)
    company_address = db.Column(db.String(250))
    pin_code = db.Column(db.String(10))
    industry_segment = db.Column(db.String(100))
    customer_name = db.Column(db.String(100))
    customer_mobile = db.Column(db.String(15), unique=False, nullable=False)
    customer_email = db.Column(db.String(120))
    department = db.Column(db.String(100))
    notes = db.Column(db.Text)
    attachment = db.Column(db.String(200))
    created_by = db.Column(db.String(100), default="Admin")
    created_at = db.Column(db.DateTime, default=datetime.now) 

    def to_dict(self):
        return {
            "id": self.id,
            "company_name": self.company_name,
            "company_address": self.company_address,
            "pin_code": self.pin_code,
            "industry_segment": self.industry_segment,
            "customer_name": self.customer_name,
            "customer_mobile": self.customer_mobile,
            "customer_email": self.customer_email,
            "department": self.department,
            "notes": self.notes,
            "attachment": self.attachment,
            "created_by": self.created_by,
             "created_at": self.created_at.isoformat() if self.created_at else None,  # ✅ ISO format
        }
