from app import db
from datetime import datetime

class NoEsiPfSalary(db.Model):
    __tablename__ = "no_esi_pf_salary"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(120))
    email = db.Column(db.String(120))

    month = db.Column(db.Integer)
    year = db.Column(db.Integer)

    salary = db.Column(db.Float)
    leave = db.Column(db.Float)
    grace = db.Column(db.Float)
    working_days = db.Column(db.Integer)
    present_days = db.Column(db.Float)

    salary_payable = db.Column(db.Float)
    loan = db.Column(db.Float)
    net_salary = db.Column(db.Float)

    created_on = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "month": self.month,
            "year": self.year,
            "salary": self.salary,
            "leave": self.leave,
            "grace": self.grace,
            "working_days": self.working_days,
            "present_days": self.present_days,
            "salary_payable": self.salary_payable,
            "loan": self.loan,
            "net_salary": self.net_salary,
            "created_on": self.created_on,
        }
