from app import db

class Company(db.Model):
    __tablename__ = "companies"

    id = db.Column(db.Integer, primary_key=True)

    company_name = db.Column(db.String(100), nullable=False)
    company_address = db.Column(db.String(255), nullable=False)
    pin_code = db.Column(db.String(10), nullable=False)
    industry_segment = db.Column(db.String(50), nullable=False)

    customer_name = db.Column(db.String(100), nullable=False)
    customer_mobile = db.Column(db.String(15), nullable=False)
    customer_email = db.Column(db.String(100), nullable=False)

    department = db.Column(db.String(100), nullable=False)
    personal_mobile = db.Column(db.String(15), nullable=False)
    personal_email = db.Column(db.String(100), nullable=False)

    # ✅ GST
    gst_number = db.Column(db.String(20), nullable=True)

    # ✅ PASSWORD (plain text as requested)
    password = db.Column(db.String(255), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "companyName": self.company_name,
            "companyAddress": self.company_address,
            "pinCode": self.pin_code,
            "industrySegment": self.industry_segment,
            "customerName": self.customer_name,
            "customerMobile": self.customer_mobile,
            "customerEmail": self.customer_email,
            "department": self.department,
            "personalMobile": self.personal_mobile,
            "personalEmail": self.personal_email,
            "gstNumber": self.gst_number
            # password intentionally not returned
        }
