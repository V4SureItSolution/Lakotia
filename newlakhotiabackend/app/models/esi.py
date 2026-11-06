from app import db
from datetime import datetime

class SalaryESIPF(db.Model):
    __tablename__ = "salary_esipf"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120))
    name = db.Column(db.String(120))
    month = db.Column(db.Integer)
    year = db.Column(db.Integer)

    leave = db.Column(db.Float, default=0)
    grace = db.Column(db.Float, default=0)
    working_days = db.Column(db.Float)
    present_days = db.Column(db.Float)

    salary_input = db.Column(db.Float)
    monthly_salary = db.Column(db.Float)

    basic = db.Column(db.Float)
    hra = db.Column(db.Float)
    conv = db.Column(db.Float)
    total = db.Column(db.Float)

    basic_conv = db.Column(db.Float)
    restricted_basic = db.Column(db.Float)
    pf = db.Column(db.Float)
    esi = db.Column(db.Float)

    loan = db.Column(db.Float)
    tds = db.Column(db.Float)
    ptax = db.Column(db.Float)
    total_ded = db.Column(db.Float)
    net_salary = db.Column(db.Float)

    created_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "month": self.month,
            "year": self.year,
            "leave": self.leave,
            "grace": self.grace,
            "workingDays": self.working_days,
            "presentDays": self.present_days,
            "salaryInput": self.salary_input,
            "monthlySalary": self.monthly_salary,
            "basic": self.basic,
            "hra": self.hra,
            "conv": self.conv,
            "total": self.total,
            "basicConv": self.basic_conv,
            "restrictedBasic": self.restricted_basic,
            "pf": self.pf,
            "esi": self.esi,
            "loan": self.loan,
            "tds": self.tds,
            "ptax": self.ptax,
            "totalDed": self.total_ded,
            "netSalary": self.net_salary,
            "created_at": self.created_at
        }
