from app import db
from datetime import datetime

class CasualSalary(db.Model):
    __tablename__ = "casual_salary"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False)
    name = db.Column(db.String(120), nullable=False)

    month = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)

    leave = db.Column(db.Float, default=0)
    grace = db.Column(db.Float, default=0)
    working_days = db.Column(db.Float, default=30)
    present_days = db.Column(db.Float, default=0)

    salary = db.Column(db.Float, default=0)
    salary_payable = db.Column(db.Float, default=0)
    loan = db.Column(db.Float, default=0)
    net_salary = db.Column(db.Float, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "month": self.month,
            "year": self.year,
            "leave": self.leave,
            "grace": self.grace,
            "working_days": self.working_days,
            "present_days": self.present_days,
            "salary": self.salary,
            "salary_payable": self.salary_payable,
            "loan": self.loan,
            "net_salary": self.net_salary,
            "created_at": self.created_at,
        }
