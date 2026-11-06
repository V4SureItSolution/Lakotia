from app import db

class Holiday(db.Model):
    __tablename__ = "holidays"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(20), nullable=False, unique=True)   # "YYYY-MM-DD"
    description = db.Column(db.String(200), nullable=True)         # Optional description

    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date,
            "description": self.description
        }
