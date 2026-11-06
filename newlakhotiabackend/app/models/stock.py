from app import db
from datetime import datetime
from sqlalchemy import event
import uuid


class Stock(db.Model):
    __tablename__ = "stocks"

    id = db.Column(db.Integer, primary_key=True)

    # Auto-generated, unique, never empty
    stock_id = db.Column(db.String(100), unique=True, nullable=False)

    item_name = db.Column(db.String(200))
    brand = db.Column(db.String(100))

    length = db.Column(db.Float, default=0)
    width = db.Column(db.Float, default=0)
    quantity = db.Column(db.Float, default=0)

    # length × width × quantity
    auto_calculate_count = db.Column(db.Float, default=0)

    buy_price = db.Column(db.Float, default=0)
    batch_code = db.Column(db.String(100))
    brand_code = db.Column(db.String(50))
    brand_description = db.Column(db.String(255))
    hsn = db.Column(db.String(50))
    mrp = db.Column(db.Float, default=0)
    unit = db.Column(db.String(20))
    gst = db.Column(db.Float, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def calculate_auto_count(self):
        self.auto_calculate_count = (
            (self.length or 0) *
            (self.width or 0) *
            (self.quantity or 0)
        )

    def __repr__(self):
        return f"<Stock {self.stock_id}: {self.item_name}>"


# 🔐 Auto-generate stock_id if missing
@event.listens_for(Stock, "before_insert")
def generate_stock_id(mapper, connection, target):
    if not target.stock_id:
        target.stock_id = f"STOCK-{uuid.uuid4().hex[:8]}"

    # Ensure auto_calculate_count is always correct
    target.calculate_auto_count()


# 🔄 Recalculate count on update
@event.listens_for(Stock, "before_update")
def update_auto_count(mapper, connection, target):
    target.calculate_auto_count()
