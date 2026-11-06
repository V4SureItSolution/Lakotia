from app import db

class AccessControl(db.Model):
    __tablename__ = "access_controls"

    id = db.Column(db.Integer, primary_key=True)

    # Foreign Key
    user_type_id = db.Column(db.Integer, db.ForeignKey("user_types.id"), nullable=False)

    # Permission field
    allow_access = db.Column(db.Boolean, default=False)

    # Relationship
    user_type = db.relationship("UserType", backref="access_controls", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "user_type_id": self.user_type_id,
            "user_type_name": self.user_type.name if self.user_type else None,
            "allow_access": self.allow_access
        }

    def __repr__(self):
        return f"<AccessControl user_type_id={self.user_type_id}, allow_access={self.allow_access}>"
