from app import db
from datetime import datetime

class DashboardSetter(db.Model):
    __tablename__ = "dashboard_setter"

    id = db.Column(db.Integer, primary_key=True)
    image_path = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
