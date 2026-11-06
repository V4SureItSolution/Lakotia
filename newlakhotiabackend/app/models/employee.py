from app import db
from datetime import datetime

class Employee(db.Model):
    __tablename__ = "employees"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    dob = db.Column(db.String(50), nullable=False)
    gender = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    address = db.Column(db.Text, nullable=False)
    department = db.Column(db.String(120), nullable=True)
    designation = db.Column(db.String(120), nullable=True)
    doj = db.Column(db.String(50), nullable=True)
    empType = db.Column(db.String(50), nullable=True)
    userType = db.Column(db.String(120), nullable=True)
    mobile = db.Column(db.String(15), nullable=False)
    altContact = db.Column(db.String(15), nullable=True)
    pan = db.Column(db.String(20), nullable=True)
    aadhar = db.Column(db.String(20), nullable=True)
    password = db.Column(db.String(120), nullable=False)
    photo = db.Column(db.String(255), nullable=True)
    panAttachment = db.Column(db.String(255), nullable=True)
    aadharAttachment = db.Column(db.String(255), nullable=True)

    # ✅ Changed from Boolean → String (for dropdown like "ESI", "PF", "Both", "None")
    esiPfStatus = db.Column(db.String(20), nullable=True)

    createdBy = db.Column(db.String(120), nullable=True)
    createdAt = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "dob": self.dob,
            "gender": self.gender,
            "email": self.email,
            "address": self.address,
            "department": self.department,
            "designation": self.designation,
            "doj": self.doj,
            "empType": self.empType,
            "userType": self.userType,
            "mobile": self.mobile,
            "altContact": self.altContact,
            "pan": self.pan,
            "aadhar": self.aadhar,
            "password": self.password,  # ✅ ADDED THIS LINE - MOST IMPORTANT!
            "photo": self.photo,
            "panAttachment": self.panAttachment,
            "aadharAttachment": self.aadharAttachment,
            "esiPfStatus": self.esiPfStatus,
            "createdBy": self.createdBy,
            "createdAt": self.createdAt.strftime("%Y-%m-%d %H:%M:%S") if self.createdAt else None
        }