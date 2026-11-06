from app import db

class Product(db.Model):
    __tablename__ = "product"

    id = db.Column(db.Integer, primary_key=True)

    item_name = db.Column(db.String(200), nullable=False)
    brand = db.Column(db.String(100), nullable=False)
    brand_code = db.Column(db.String(100), nullable=True)
    brand_description = db.Column(db.String(255), nullable=True)

    mrp = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "item_name": self.item_name,
            "brand": self.brand,
            "brand_code": self.brand_code,
            "brand_description": self.brand_description,
            "mrp": self.mrp,
        }

    def __repr__(self):
        return f"<Product {self.item_name} | {self.brand} | MRP: {self.mrp}>"
