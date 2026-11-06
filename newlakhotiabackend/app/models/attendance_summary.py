from app import db

class AttendanceSummary(db.Model):
    __tablename__ = "attendance_summary"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(120))
    month = db.Column(db.Integer)
    year = db.Column(db.Integer)
    present = db.Column(db.Float)
    absent = db.Column(db.Float)
    total_days = db.Column(db.Integer)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "month": self.month,
            "year": self.year,
            "present": self.present,
            "absent": self.absent,
            "total_days": self.total_days,
        }
