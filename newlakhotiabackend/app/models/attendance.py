from app import db
from datetime import datetime

class Attendance(db.Model):
    __tablename__ = "attendance"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False)      # ✅ email for backend linking
    username = db.Column(db.String(100), nullable=False)   # ✅ also store readable name
    date = db.Column(db.String(20), nullable=False)
    check_in = db.Column(db.String(20))
    check_out = db.Column(db.String(20))
    status = db.Column(db.String(20))
    duration = db.Column(db.String(20))
    device_in = db.Column(db.JSON)
    device_out = db.Column(db.JSON)
    location_in = db.Column(db.JSON)
    location_out = db.Column(db.JSON)
    created_on = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        # ✅ Safely convert duration (e.g., "8h 30m") → 8.5 hours
        def parse_duration(d):
            if not d or d == "-":
                return 0
            try:
                h, m = 0, 0
                if "h" in d:
                    parts = d.split("h")
                    h = int(parts[0].strip())
                    if "m" in parts[1]:
                        m = int(parts[1].replace("m", "").strip() or 0)
                elif "m" in d:
                    m = int(d.replace("m", "").strip() or 0)
                return round(h + m / 60, 2)
            except Exception:
                return 0

        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,  # ✅ include name in JSON output
            "date": self.date,
            "check_in": self.check_in,
            "check_out": self.check_out,
            "status": self.status,
            "duration": parse_duration(self.duration),
            "device_in": self.device_in,
            "device_out": self.device_out,
            "location_in": self.location_in,
            "location_out": self.location_out,
            "created_on": self.created_on.strftime("%Y-%m-%d %H:%M:%S") if self.created_on else None,
        }
